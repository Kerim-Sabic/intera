import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {it,expect} from 'vitest';
it('worklet preserves stereo order, native rate, positions and bounded backlog',()=>{
 let Constructor:any;const messages:any[]=[];
 const context=vm.createContext({AudioWorkletProcessor:class{port={postMessage:(x:any)=>messages.push(x),onmessage:()=>{}};},sampleRate:48000,registerProcessor:(_name:string,c:any)=>{Constructor=c;}});
 vm.runInContext(readFileSync('src/capture/pcm-worklet.js','utf8'),context);
 const worklet=new Constructor({processorOptions:{packetMs:80}});
 const l=new Float32Array(128).fill(0.5),r=new Float32Array(128).fill(-0.5);
 for(let n=0;n<30;n++)worklet.process([[l,r]]);
 expect(messages[0].format).toEqual({sampleRate:48000,channels:2});
 const view=new DataView(messages[1].buffer);expect(view.getInt16(0,true)).toBe(16384);expect(view.getInt16(2,true)).toBe(-16384);expect(messages[1].position).toBe(0);expect(view.byteLength).toBe(3840*4);
 for(let n=0;n<30*26;n++)worklet.process([[l,r]]);
 expect(messages.some(m=>m.error?.includes('backlog'))).toBe(true);
});
