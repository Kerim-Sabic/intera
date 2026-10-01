const developerIdentity = process.env.APPLE_SIGN_IDENTITY;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Forge requires a CommonJS configuration.
const path = require('node:path');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Forge requires a CommonJS configuration.
const fs = require('node:fs');
const cameraBundle = process.env.INTERA_CAMERA_BUNDLE && path.resolve(process.env.INTERA_CAMERA_BUNDLE);
if(cameraBundle){
  if(process.platform!=='darwin'||!developerIdentity||!process.env.APPLE_TEAM_ID)throw new Error('Integrated camera packaging requires a real Mac signing environment.');
  const prepared=JSON.parse(fs.readFileSync(path.join(cameraBundle,'preparation.json'),'utf8'));
  if(prepared.team!==process.env.APPLE_TEAM_ID||prepared.arch!==process.arch)throw new Error('Camera bundle signing team or architecture does not match the desktop build.');
  for(const item of ['camera-runtime/intera-camera','camera-runtime/intera-camera.node','camera-runtime/upstream/approved-models.json','com.intera.camera-extension.systemextension/Contents/MacOS/InteraCamera','extension.entitlements','host.entitlements'])if(!fs.existsSync(path.join(cameraBundle,item)))throw new Error('Prepared camera bundle is incomplete.');
}
const notarization = [process.env.APPLE_ID, process.env.APPLE_APP_SPECIFIC_PASSWORD, process.env.APPLE_TEAM_ID];
if (notarization.some(Boolean) && (!developerIdentity || !notarization.every(Boolean))) {
  throw new Error('Notarization requires a Developer ID identity and all three Apple notarization settings.');
}
module.exports = {
  packagerConfig: {
    asar: true, executableName: 'Intera', appBundleId: 'com.intera.desktop', icon:'assets/brand/exports/intera',
    ignore: [/^\/src/, /^\/tests/, /^\/scripts/, /^\/docs/, /^\/camera/, /^\/server/, /^\/supabase/, /^\/\.env/, /^\/\.github/, /playwright/],
    ...(cameraBundle?{extraResource:[path.join(cameraBundle,'camera-runtime')],afterCopy:[(buildPath,_version,_platform,_arch,callback)=>{fs.promises.cp(path.join(cameraBundle,'com.intera.camera-extension.systemextension'),path.resolve(buildPath,'../../Library/SystemExtensions/com.intera.camera-extension.systemextension'),{recursive:true}).then(()=>callback(),callback);}]}:{}),
    extendInfo: { LSMinimumSystemVersion: '13.0', NSAudioCaptureUsageDescription: 'Intera listens to a copy of computer playback for transcription and translation.', NSScreenCaptureUsageDescription: 'Intera uses a display capture stream to acquire computer audio. Video frames are never displayed, saved or uploaded.',...(cameraBundle?{NSCameraUsageDescription:'Intera processes webcam video locally for optional eye-contact correction. Webcam audio is not captured.',NSSystemExtensionUsageDescription:'Intera Camera provides locally processed video to the meeting app you select.'}:{}) },
    // Re-sign the modified bundle, including nested Electron helpers. A beta ad-hoc
    // signature provides integrity, NOT Developer ID trust or notarization.
    osxSign: {identity:developerIdentity || '-',identityValidation:!!developerIdentity,continueOnError:false,preAutoEntitlements:false,preEmbedProvisioningProfile:false,optionsForFile:file=>({hardenedRuntime:!!developerIdentity,entitlements:cameraBundle?(file.includes('.systemextension')?path.join(cameraBundle,'extension.entitlements'):file.endsWith('/Intera.app')?path.join(cameraBundle,'host.entitlements'):'assets/entitlements.plist'):'assets/entitlements.plist',...(!developerIdentity?{timestamp:'none'}:{})})},
    ...(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID ? {osxNotarize:{appleId:process.env.APPLE_ID,appleIdPassword:process.env.APPLE_APP_SPECIFIC_PASSWORD,teamId:process.env.APPLE_TEAM_ID}} : {})
  },
  makers: [
    {name:'@electron-forge/maker-squirrel',config:{name:'Intera',...(process.env.WINDOWS_CERT_FILE ? {certificateFile:process.env.WINDOWS_CERT_FILE,certificatePassword:process.env.WINDOWS_CERT_PASSWORD}: {})}},
    {name:'@electron-forge/maker-dmg',platforms:['darwin'],config:{}},
    {name:'@electron-forge/maker-zip',platforms:['darwin','win32']}
  ]
};
