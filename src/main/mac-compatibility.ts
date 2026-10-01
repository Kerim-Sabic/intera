/** Electron 44.4.5 / Chromium 152 chooses SCK below the CoreAudio tap threshold.
 * This is a runtime capability target; physical hardware validation is separate. */
export function macPlaybackPath(version:string):'unsupported'|'screen-capture-kit'|'core-audio-tap'{
 const match=/^(\d+)\.(\d+)(?:\.\d+)?$/.exec(version);
 if(!match)return 'unsupported';
 const major=Number(match[1]),minor=Number(match[2]);
 if(major<13)return 'unsupported';
 return major>14||(major===14&&minor>=2)?'core-audio-tap':'screen-capture-kit';
}
export function captureFailure(code:string,platform:string,version=''){
 if(platform==='darwin'){
  const permission=macPlaybackPath(version)==='screen-capture-kit'?'Screen Recording':'Screen & System Audio Recording / System Audio Recording';
  if(code==='NotAllowedError')return `Playback request was denied (NotAllowedError). Check Intera's current ${permission} permission, quit it, and reopen it. If it is already allowed, inspect Audio diagnostics; the app's capture policy can also reject a request.`;
 }
 if(code==='DeadAudioTrack')return 'The playback audio track ended before capture started (DeadAudioTrack). This does not establish a denied permission. Stop and retry the local playback test.';
 if(code==='InvalidStateError')return 'The capture request was not in an active state (InvalidStateError). This can involve activation or focus; changing macOS permission may not resolve it. Open Audio diagnostics.';
 if(code==='NotReadableError')return 'macOS or the playback device could not initialize capture (NotReadableError). Permission may already be granted. Open Audio diagnostics and retry the local playback test.';
 if(code==='NotFoundError'||code==='NoDisplaySource')return 'No display source was available for playback capture. Unlock the Mac and check the connected display, then retry.';
 if(code==='SourceListFailed')return 'The display source list could not be read. Open Audio diagnostics to check the actual permission status.';
 if(code==='CaptureHostLoadFailed')return 'Intera could not load its playback capture host. This is an app initialization failure, not evidence of missing permission. Reinstall the complete app from its DMG.';
 if(code==='UnsupportedChannels')return 'Playback supplied more than two audio channels. Select a supported mono/stereo playback device, then restart listening.';
 if(code==='AudioFormatChanged')return 'The playback format changed during capture. Capture stopped safely; restart listening after the output device is stable.';
 if(code==='QueueOverflow')return 'The audio queue exceeded its two-second limit. Capture stopped safely; restart listening when the app is responsive.';
 if(code==='NoPlaybackTrack')return 'The capture source supplied no playback audio. Stop, check system audio permissions and the output device, then retry. No microphone fallback is used.';
 if(code==='SourceEnded')return 'Playback source ended. Capture stopped; check permissions and the output device, then restart explicitly.';
 return 'Playback capture failed. Open Settings → Audio for the failure stage and code; permission denial has not been established.';
}
