#include <node_api.h>
#import <Foundation/Foundation.h>
#import <SystemExtensions/SystemExtensions.h>
#import <CoreMediaIO/CoreMediaIO.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <ImageIO/ImageIO.h>
#include <vector>

// Loaded in Intera's trusted main process, so the activation host is Intera.app.
static NSString *activation = @"inactive";
static CMIODeviceID device = 0;
static CMIOStreamID sink = 0;
static CMSimpleQueueRef buffers = nullptr;
@interface InteraActivation : NSObject <OSSystemExtensionRequestDelegate>
@end
@implementation InteraActivation
- (void)requestNeedsUserApproval:(OSSystemExtensionRequest *)request { activation = @"needs-owner-approval"; }
- (void)request:(OSSystemExtensionRequest *)request didFinishWithResult:(OSSystemExtensionRequestResult)result { activation = result == OSSystemExtensionRequestCompleted ? @"activated" : @"restart-required"; }
- (void)request:(OSSystemExtensionRequest *)request didFailWithError:(NSError *)error { activation = @"failed"; }
- (OSSystemExtensionReplacementAction)request:(OSSystemExtensionRequest *)request actionForReplacingExtension:(OSSystemExtensionProperties *)oldExtension withExtension:(OSSystemExtensionProperties *)newExtension { return OSSystemExtensionReplacementActionReplace; }
@end
static InteraActivation *delegate;
static napi_value boolean(napi_env env, bool value) { napi_value result; napi_get_boolean(env, value, &result); return result; }
static napi_value state(napi_env env, napi_callback_info info) { napi_value result; napi_create_string_utf8(env, activation.UTF8String, NAPI_AUTO_LENGTH, &result); return result; }
static napi_value activate(napi_env env, napi_callback_info info) {
    // This action is called only by an explicit owner-facing button.
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!delegate) delegate = [InteraActivation new];
        OSSystemExtensionRequest *request = [OSSystemExtensionRequest activationRequestForExtension:@"com.intera.camera-extension" queue:dispatch_get_main_queue()];
        request.delegate = delegate; activation = @"requesting";
        [[OSSystemExtensionManager sharedManager] submitRequest:request];
    });
    return boolean(env, true);
}
static std::vector<UInt32> objects(CMIOObjectID object, CMIOObjectPropertySelector selector) {
    CMIOObjectPropertyAddress address = {selector, kCMIOObjectPropertyScopeGlobal, kCMIOObjectPropertyElementMain};
    UInt32 bytes = 0;
    if (CMIOObjectGetPropertyDataSize(object, &address, 0, nullptr, &bytes) != noErr || bytes > 65536) return {};
    std::vector<UInt32> result(bytes / sizeof(UInt32));
    if (CMIOObjectGetPropertyData(object, &address, 0, nullptr, bytes, &bytes, result.data()) != noErr) return {};
    return result;
}
static NSString *name(CMIOObjectID object, CMIOObjectPropertySelector selector) {
    CMIOObjectPropertyAddress address = {selector, kCMIOObjectPropertyScopeGlobal, kCMIOObjectPropertyElementMain};
    CFStringRef value = nullptr; UInt32 size = sizeof(value);
    if (CMIOObjectGetPropertyData(object, &address, 0, nullptr, size, &size, &value) != noErr || !value) return nil;
    return CFBridgingRelease(value);
}
static void releaseSink() {
    if (device && sink) CMIODeviceStopStream(device, sink);
    if (buffers) { while (CMSimpleQueueGetCount(buffers)) { auto item = CMSimpleQueueDequeue(buffers); if (item) CFRelease(item); } CFRelease(buffers); }
    device = sink = 0; buffers = nullptr;
}
static napi_value start(napi_env env, napi_callback_info info) {
    if (sink) return boolean(env, true);
    for (auto candidate : objects(kCMIOObjectSystemObject, kCMIOHardwarePropertyDevices)) {
        NSString *uid = name(candidate, kCMIODevicePropertyDeviceUID);
        if (![uid.lowercaseString isEqualToString:@"d843482c-c61b-44a2-a317-e2869f0c5d91"]) continue;
        for (auto stream : objects(candidate, kCMIODevicePropertyStreams)) {
            if (![name(stream, kCMIOObjectPropertyName) isEqualToString:@"Intera Camera Input"]) continue;
            CMSimpleQueueRef queue = nullptr;
            if (CMIOStreamCopyBufferQueue(stream, nullptr, nullptr, &queue) != noErr || !queue) continue;
            device = candidate; sink = stream; buffers = queue;
            if (CMIODeviceStartStream(device, sink) == noErr) return boolean(env, true);
            releaseSink();
        }
    }
    return boolean(env, false);
}
static napi_value stop(napi_env env, napi_callback_info info) { releaseSink(); return boolean(env, true); }
static napi_value submit(napi_env env, napi_callback_info info) {
    size_t argc = 1; napi_value args[1]; napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    void *data = nullptr; size_t length = 0; bool isBuffer = false;
    if (argc != 1 || napi_is_buffer(env, args[0], &isBuffer) != napi_ok || !isBuffer || napi_get_buffer_info(env, args[0], &data, &length) != napi_ok || length > 525000 || !buffers || CMSimpleQueueGetCount(buffers) >= 2) return boolean(env, false);
    @autoreleasepool {
        NSData *jpeg = [NSData dataWithBytesNoCopy:data length:length freeWhenDone:NO];
        CGImageSourceRef imageSource = CGImageSourceCreateWithData((__bridge CFDataRef)jpeg, nullptr);
        if (!imageSource) return boolean(env, false);
        CGImageRef image = CGImageSourceCreateImageAtIndex(imageSource, 0, nullptr); CFRelease(imageSource);
        if (!image) return boolean(env, false);
        if (CGImageGetWidth(image) != 640 || CGImageGetHeight(image) != 480) { CGImageRelease(image); return boolean(env, false); }
        CVPixelBufferRef pixel = nullptr;
        if (CVPixelBufferCreate(kCFAllocatorDefault, 640, 480, kCVPixelFormatType_32BGRA, nullptr, &pixel) != kCVReturnSuccess) { CGImageRelease(image); return boolean(env, false); }
        CVPixelBufferLockBaseAddress(pixel, 0);
        CGColorSpaceRef colors = CGColorSpaceCreateDeviceRGB();
        CGContextRef context = CGBitmapContextCreate(CVPixelBufferGetBaseAddress(pixel), 640, 480, 8, CVPixelBufferGetBytesPerRow(pixel), colors, kCGBitmapByteOrder32Little | kCGImageAlphaPremultipliedFirst);
        CGColorSpaceRelease(colors);
        if (!context) { CVPixelBufferUnlockBaseAddress(pixel, 0); CVPixelBufferRelease(pixel); CGImageRelease(image); return boolean(env, false); }
        CGContextDrawImage(context, CGRectMake(0, 0, 640, 480), image); CGContextRelease(context); CGImageRelease(image); CVPixelBufferUnlockBaseAddress(pixel, 0);
        CMVideoFormatDescriptionRef format = nullptr;
        CMSampleBufferRef sample = nullptr;
        auto now = CMClockGetTime(CMClockGetHostTimeClock());
        CMSampleTimingInfo timing = {CMTimeMake(1, 30), now, kCMTimeInvalid};
        OSStatus result = CMVideoFormatDescriptionCreateForImageBuffer(kCFAllocatorDefault, pixel, &format);
        if (result == noErr) result = CMSampleBufferCreateReadyWithImageBuffer(kCFAllocatorDefault, pixel, format, &timing, &sample);
        if (format) CFRelease(format); CVPixelBufferRelease(pixel);
        if (result != noErr || !sample) return boolean(env, false);
        // The queue consumer owns this retained buffer after successful enqueue.
        result = CMSimpleQueueEnqueue(buffers, sample);
        if (result != noErr) CFRelease(sample);
        return boolean(env, result == noErr);
    }
}
static void cleanup(void *) { releaseSink(); }
static napi_value initialize(napi_env env, napi_value exports) {
    napi_property_descriptor functions[] = {{"activate",0,activate,0,0,0,napi_default,0},{"state",0,state,0,0,0,napi_default,0},{"start",0,start,0,0,0,napi_default,0},{"submit",0,submit,0,0,0,napi_default,0},{"stop",0,stop,0,0,0,napi_default,0}};
    napi_define_properties(env, exports, 5, functions); napi_add_env_cleanup_hook(env, cleanup, nullptr); return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
