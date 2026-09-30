import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync(new URL('../src/capture/host.js',import.meta.url),'utf8');
function harness(acquire:()=>Promise<unknown>,close:()=>Promise<void>=async()=>{}){
 let command:(cmd:{type:string;epoch:number;packetMs:number})=>Promise<void>=async()=>{};
 const error=vi.fn(),contextCreated=vi.fn();
 const connect=()=>({connect:()=>({})});
 class Context{constructor(){contextCreated();}audioWorklet={addModule:async()=>{}};destination={};createMediaStreamSource(){return {connect};}createGain(){return {gain:{value:0},connect};}resume=async()=>{};close=close;}
 class Worklet{port={postMessage:vi.fn(),onmessage:null};disconnect=vi.fn();connect=connect;}
 runInNewContext(script,{window:{capture:{onCommand:(cb:typeof command)=>{command=cb;},error,format:vi.fn(),packet:vi.fn()}},navigator:{mediaDevices:{getDisplayMedia:acquire}},AudioContext:Context,AudioWorkletNode:Worklet,MediaStream:class{constructor(_tracks:unknown){void _tracks;}}});
 return {start:(epoch=1)=>command({type:'start',epoch,packetMs:80}),stop:()=>command({type:'stop',epoch:1,packetMs:80}),error,contextCreated};
}
function playback(state='live'){const track={readyState:state,stop:vi.fn(),onended:null};return {track,stream:{getAudioTracks:()=>[track],getTracks:()=>[track]}};}
describe('real capture-host lifecycle',()=>{
 it('rejects an ended Mac audio track without constructing a context',async()=>{const {track,stream}=playback('ended');const h=harness(async()=>stream);await h.start();expect(h.error).toHaveBeenCalledWith(1,'DeadAudioTrack');expect(h.contextCreated).not.toHaveBeenCalled();expect(track.stop).toHaveBeenCalled();});
 it('releases a late capture result after Stop',async()=>{const {track,stream}=playback();let deliver:(s:unknown)=>void=()=>{};const h=harness(()=>new Promise(r=>{deliver=r;}));const start=h.start();await Promise.resolve();await h.stop();deliver(stream);await start;expect(track.stop).toHaveBeenCalled();expect(h.contextCreated).not.toHaveBeenCalled();});
 it('does not restart acquisition after Stop while a prior context closes',async()=>{
  let release:()=>void=()=>{};const closing=new Promise<void>(r=>{release=r;});const acquire=vi.fn(async()=>playback().stream);const h=harness(acquire,()=>closing);
  await h.start();const restart=h.start(2);await Promise.resolve();await h.stop();release();await restart;expect(acquire).toHaveBeenCalledTimes(1);
 });
});
