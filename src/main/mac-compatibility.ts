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
  if(code==='NotAllowedError'||code==='DeadAudioTrack')return `Playback access was denied or unavailable. In System Settings → Privacy & Security → ${permission}, allow Intera, quit it, and reopen it. No microphone fallback is used.`;
 }
 if(code==='NoPlaybackTrack')return 'The capture source supplied no playback audio. Stop, check system audio permissions and the output device, then retry. No microphone fallback is used.';
 if(code==='SourceEnded')return 'Playback source ended. Capture stopped; check permissions and the output device, then restart explicitly.';
 return 'Playback capture could not start. Check system audio permission and the playback device, then restart explicitly.';
}
