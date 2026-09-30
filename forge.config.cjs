const developerIdentity = process.env.APPLE_SIGN_IDENTITY;
const notarization = [process.env.APPLE_ID, process.env.APPLE_APP_SPECIFIC_PASSWORD, process.env.APPLE_TEAM_ID];
if (notarization.some(Boolean) && (!developerIdentity || !notarization.every(Boolean))) {
  throw new Error('Notarization requires a Developer ID identity and all three Apple notarization settings.');
}
module.exports = {
  packagerConfig: {
    asar: true, executableName: 'Intera', appBundleId: 'com.intera.desktop', icon:'assets/brand/exports/intera',
    ignore: [/^\/src/, /^\/tests/, /^\/scripts/, /^\/docs/, /^\/server/, /^\/supabase/, /^\/\.env/, /^\/\.github/, /playwright/],
    extendInfo: { LSMinimumSystemVersion: '13.0', NSAudioCaptureUsageDescription: 'Intera listens to a copy of computer playback for transcription and translation.', NSScreenCaptureUsageDescription: 'Intera uses a display capture stream to acquire computer audio. Video frames are never displayed, saved or uploaded.' },
    // Re-sign the modified bundle, including nested Electron helpers. A beta ad-hoc
    // signature provides integrity, NOT Developer ID trust or notarization.
    osxSign: {identity:developerIdentity || '-',identityValidation:!!developerIdentity,continueOnError:false,preAutoEntitlements:false,preEmbedProvisioningProfile:false,optionsForFile:()=>({hardenedRuntime:!!developerIdentity,entitlements:'assets/entitlements.plist',...(!developerIdentity?{timestamp:'none'}:{})})},
    ...(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID ? {osxNotarize:{appleId:process.env.APPLE_ID,appleIdPassword:process.env.APPLE_APP_SPECIFIC_PASSWORD,teamId:process.env.APPLE_TEAM_ID}} : {})
  },
  makers: [
    {name:'@electron-forge/maker-squirrel',config:{name:'Intera',...(process.env.WINDOWS_CERT_FILE ? {certificateFile:process.env.WINDOWS_CERT_FILE,certificatePassword:process.env.WINDOWS_CERT_PASSWORD}: {})}},
    {name:'@electron-forge/maker-dmg',platforms:['darwin'],config:{}},
    {name:'@electron-forge/maker-zip',platforms:['darwin','win32']}
  ]
};
