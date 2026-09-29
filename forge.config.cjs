module.exports = {
  packagerConfig: {
    asar: true, executableName: 'Intera', appBundleId: 'com.intera.desktop', icon:'assets/brand/exports/intera',
    ignore: [/^\/src/, /^\/tests/, /^\/scripts/, /^\/docs/, /^\/server/, /^\/supabase/, /^\/\.env/, /^\/\.github/, /playwright/],
    extendInfo: { NSAudioCaptureUsageDescription: 'Intera listens to a copy of computer playback for transcription and translation.', NSScreenCaptureUsageDescription: 'Intera uses a display capture stream to acquire computer audio. Video frames are never displayed, saved or uploaded.', NSMicrophoneUsageDescription: 'Only Selected input mode uses an explicitly selected microphone or virtual audio device.' },
    ...(process.env.APPLE_SIGN_IDENTITY ? {osxSign:{identity:process.env.APPLE_SIGN_IDENTITY,hardenedRuntime:true,optionsForFile:()=>({entitlements:'assets/entitlements.plist'})}} : {}),
    ...(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID ? {osxNotarize:{appleId:process.env.APPLE_ID,appleIdPassword:process.env.APPLE_APP_SPECIFIC_PASSWORD,teamId:process.env.APPLE_TEAM_ID}} : {})
  },
  makers: [
    {name:'@electron-forge/maker-squirrel',config:{name:'Intera',...(process.env.WINDOWS_CERT_FILE ? {certificateFile:process.env.WINDOWS_CERT_FILE,certificatePassword:process.env.WINDOWS_CERT_PASSWORD}: {})}},
    {name:'@electron-forge/maker-dmg',platforms:['darwin'],config:{}},
    {name:'@electron-forge/maker-zip',platforms:['darwin','win32']}
  ]
};
