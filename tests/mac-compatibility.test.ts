import {describe,it,expect} from 'vitest';
import {macPlaybackPath,captureFailure} from '../src/main/mac-compatibility';
describe('pinned Mac runtime capture policy',()=>{
 it('allows Ventura including the reported M1 13.1 target through SCK',()=>{
  for(const v of ['13.0','13.1','13.7.8','14.0','14.1.2'])expect(macPlaybackPath(v)).toBe('screen-capture-kit');
 });
 it('keeps CoreAudio tap selection at its real OS boundary',()=>{
  for(const v of ['14.2','14.2.1','15.0','26.0'])expect(macPlaybackPath(v)).toBe('core-audio-tap');
  for(const v of ['12.7.6','unknown','13','13junk.1'])expect(macPlaybackPath(v)).toBe('unsupported');
 });
 it('points denied capture to version-appropriate privacy controls',()=>{
  expect(captureFailure('NotAllowedError','darwin','13.1')).toContain('Screen Recording');
  expect(captureFailure('NotAllowedError','darwin','15.0')).toContain('System Audio Recording');
  expect(captureFailure('DeadAudioTrack','darwin','15.0')).toContain('does not establish');
  expect(captureFailure('NoPlaybackTrack','win32')).toContain('no playback audio');
 });
 it('does not mislabel host or active-state failures as OS permission denial',()=>{expect(captureFailure('CaptureHostLoadFailed','darwin','13.1')).toContain('app initialization');expect(captureFailure('InvalidStateError','darwin','13.1')).toContain('activation or focus');expect(captureFailure('NotReadableError','darwin','13.1')).toContain('Permission may already be granted');});
});
