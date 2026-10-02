import Foundation
import CoreMediaIO
let source = InteraProvider()
CMIOExtensionProvider.startService(provider: source.provider)
CFRunLoopRun()
