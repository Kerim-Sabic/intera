import Foundation
import CoreMediaIO
import CoreMedia
import CoreVideo
import IOKit.audio

// The sink accepts Intera frames; meeting apps capture the separate source.
// No network endpoints or persisted camera buffers are used by this extension.
final class InteraStream: NSObject, CMIOExtensionStreamSource {
    var stream: CMIOExtensionStream!
    let formats: [CMIOExtensionStreamFormat]
    let input: Bool
    weak var owner: InteraDevice?
    var client: CMIOExtensionClient?
    var active = false
    var availableProperties: Set<CMIOExtensionProperty> {
        input ? [.streamActiveFormatIndex, .streamFrameDuration, .streamSinkBufferQueueSize, .streamSinkBuffersRequiredForStartup, .streamSinkBufferUnderrunCount, .streamSinkEndOfData] : [.streamActiveFormatIndex, .streamFrameDuration]
    }
    init(input: Bool, format: CMIOExtensionStreamFormat) {
        self.input = input
        self.formats = [format]
        super.init()
        stream = CMIOExtensionStream(localizedName: input ? "Intera Camera Input" : "Intera Camera", streamID: UUID(uuidString: input ? "E2BB3927-DFDC-4CAE-BEAE-23716731BC92" : "21D3EBCA-46BD-47A9-B1E5-58D174674E06")!, direction: input ? .sink : .source, clockType: .hostTime, source: self)
    }
    func streamProperties(forProperties properties: Set<CMIOExtensionProperty>) throws -> CMIOExtensionStreamProperties {
        let result = CMIOExtensionStreamProperties(dictionary: [:])
        result.activeFormatIndex = 0
        result.frameDuration = CMTime(value: 1, timescale: 30)
        if input {
            result.sinkBufferQueueSize = 2
            result.sinkBuffersRequiredForStartup = 1
            result.sinkBufferUnderrunCount = 0
            result.sinkEndOfData = active ? 0 : 1
        }
        return result
    }
    func setStreamProperties(_ properties: CMIOExtensionStreamProperties) throws {
        if let index = properties.activeFormatIndex, index != 0 { throw NSError(domain: "InteraCamera", code: 1) }
    }
    func authorizedToStartStream(for client: CMIOExtensionClient) -> Bool {
        if input {
            // Authorization belongs to the system-verified signing identifier.
            guard client.signingID == "com.intera.desktop", self.client == nil || self.client?.clientID == client.clientID else { return false }
            self.client = client
        }
        return true
    }
    func startStream() throws { active = true; owner?.start() }
    func stopStream() throws { active = false; if input { client = nil; owner?.clear() }; owner?.stopIfIdle() }
}

final class InteraDevice: NSObject, CMIOExtensionDeviceSource {
    var device: CMIOExtensionDevice!
    var source: InteraStream!
    var sink: InteraStream!
    private let queue = DispatchQueue(label: "com.intera.camera.frames")
    private var timer: DispatchSourceTimer?
    private var outstanding = false
    private var latest: CVPixelBuffer?
    private var lastInput: UInt64 = 0
    private var format: CMFormatDescription!
    private var black: CVPixelBuffer!
    var availableProperties: Set<CMIOExtensionProperty> { [.deviceTransportType, .deviceModel] }
    override init() {
        super.init()
        var pixel: CVPixelBuffer?
        CVPixelBufferCreate(kCFAllocatorDefault, 640, 480, kCVPixelFormatType_32BGRA, nil, &pixel)
        black = pixel
        CVPixelBufferLockBaseAddress(black, [])
        memset(CVPixelBufferGetBaseAddress(black), 0, CVPixelBufferGetDataSize(black))
        CVPixelBufferUnlockBaseAddress(black, [])
        CMVideoFormatDescriptionCreateForImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: black, formatDescriptionOut: &format)
        let streamFormat = CMIOExtensionStreamFormat(formatDescription: format, maxFrameDuration: CMTime(value: 1, timescale: 30), minFrameDuration: CMTime(value: 1, timescale: 30), validFrameDurations: nil)
        device = CMIOExtensionDevice(localizedName: "Intera Camera", deviceID: UUID(uuidString: "D843482C-C61B-44A2-A317-E2869F0C5D91")!, legacyDeviceID: nil, source: self)
        source = InteraStream(input: false, format: streamFormat)
        sink = InteraStream(input: true, format: streamFormat)
        source.owner = self; sink.owner = self
        try! device.addStream(source.stream)
        try! device.addStream(sink.stream)
    }
    func deviceProperties(forProperties properties: Set<CMIOExtensionProperty>) throws -> CMIOExtensionDeviceProperties {
        let result = CMIOExtensionDeviceProperties(dictionary: [:])
        result.transportType = kIOAudioDeviceTransportTypeVirtual
        result.model = "Intera local gaze camera"
        return result
    }
    func setDeviceProperties(_ properties: CMIOExtensionDeviceProperties) throws {}
    func clear() { queue.async { self.latest = nil; self.lastInput = 0 } }
    func start() {
        queue.async {
            guard self.timer == nil else { return }
            let timer = DispatchSource.makeTimerSource(queue: self.queue)
            timer.schedule(deadline: .now(), repeating: .milliseconds(33))
            timer.setEventHandler { self.tick() }
            self.timer = timer; timer.resume()
        }
    }
    func stopIfIdle() {
        queue.async { if !self.source.active && !self.sink.active { self.timer?.cancel(); self.timer = nil; self.latest = nil; self.lastInput = 0 } }
    }
    private func tick() {
        if sink.active, let client = sink.client, !outstanding {
            outstanding = true
            sink.stream.consumeSampleBuffer(from: client) { sample, _, _, _, error in
                self.queue.async {
                    self.outstanding = false
                    guard self.sink.active, error == nil, let sample = sample, let pixel = CMSampleBufferGetImageBuffer(sample), CVPixelBufferGetWidth(pixel) == 640, CVPixelBufferGetHeight(pixel) == 480, CVPixelBufferGetPixelFormatType(pixel) == kCVPixelFormatType_32BGRA else { return }
                    self.latest = pixel
                    self.lastInput = DispatchTime.now().uptimeNanoseconds
                }
            }
        }
        guard source.active else { return }
        let now = DispatchTime.now().uptimeNanoseconds
        // Never leave a patient's last image frozen indefinitely on worker loss.
        let fresh = sink.active && lastInput > 0 && now - lastInput < 1_000_000_000
        let pixel = fresh ? latest ?? black! : black!
        var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: 30), presentationTimeStamp: CMTime(value: Int64(now), timescale: 1_000_000_000), decodeTimeStamp: .invalid)
        var sample: CMSampleBuffer?
        guard CMSampleBufferCreateReadyWithImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: pixel, formatDescription: format, sampleTiming: &timing, sampleBufferOut: &sample) == noErr, let sample = sample else { return }
        source.stream.send(sample, discontinuity: [], hostTimeInNanoseconds: now)
    }
}

final class InteraProvider: NSObject, CMIOExtensionProviderSource {
    var provider: CMIOExtensionProvider!
    private let camera = InteraDevice()
    var availableProperties: Set<CMIOExtensionProperty> { [.providerManufacturer] }
    override init() { super.init(); provider = CMIOExtensionProvider(source: self, clientQueue: nil); try! provider.addDevice(camera.device) }
    func connect(to client: CMIOExtensionClient) throws {}
    func disconnect(from client: CMIOExtensionClient) { if camera.sink.client?.clientID == client.clientID { camera.sink.client = nil; camera.sink.active = false; camera.clear(); camera.stopIfIdle() } }
    func providerProperties(forProperties properties: Set<CMIOExtensionProperty>) throws -> CMIOExtensionProviderProperties { let result = CMIOExtensionProviderProperties(dictionary: [:]); result.manufacturer = "Intera"; return result }
    func setProviderProperties(_ properties: CMIOExtensionProviderProperties) throws {}
}
