import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
if(process.platform!=='darwin')throw new Error('Camera native build requires the macOS SDK.');
const arch=process.arch==='arm64'?'arm64':'x86_64';
const root=path.resolve('out/camera-native');
await mkdir(path.join(root,'headers'),{recursive:true});
// Stable N-API headers from the exact CI Node version; no node-gyp ABI guess.
for(const name of ['node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h']){
 const response=await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/src/${name}`);
 if(!response.ok)throw new Error('Could not obtain pinned official Node headers.');
 await writeFile(path.join(root,'headers',name),await response.text());
}
execFileSync('xcrun',['swiftc','-swift-version','5','-target',`${arch}-apple-macos14.0`,'-framework','CoreMediaIO','-framework','IOKit','camera/native/Provider.swift','camera/native/main.swift','-o',path.join(root,'InteraCamera')],{stdio:'inherit'});
execFileSync('xcrun',['clang++','-std=c++17','-fobjc-arc','-arch',arch,'-mmacosx-version-min=14.0','-bundle','-undefined','dynamic_lookup','-I',path.join(root,'headers'),'-framework','Foundation','-framework','SystemExtensions','-framework','CoreMediaIO','-framework','CoreMedia','-framework','CoreVideo','-framework','CoreGraphics','-framework','ImageIO','camera/native/bridge.mm','-o',path.join(root,'intera-camera.node')],{stdio:'inherit'});
await writeFile(path.join(root,'build-evidence.json'),JSON.stringify({arch,minimumMacOS:'14.0',nodeHeaders:process.version,sdk:execFileSync('xcrun',['--show-sdk-version'],{encoding:'utf8'}).trim(),status:'COMPILED ONLY',signed:false,activated:false,zoomVerified:false,modelsBundled:false},null,2));
console.log('Native camera code compiled. No signature, activation, model approval or Zoom verification implied.');
