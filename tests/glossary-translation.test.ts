import {EventEmitter} from 'node:events';
import type WebSocket from 'ws';
import {it,expect,vi} from 'vitest';
import {Coordinator} from '../src/main/coordinator';
import {defaults,glossarySchema} from '../src/shared/config';

it('rejects oversized context and Unicode-equivalent conflicting terms without truncating',()=>{
 const huge={terms:Array.from({length:100},(_,i)=>`${i}${'x'.repeat(97)}`),translations:[]};
 expect(glossarySchema.safeParse(huge).success).toBe(false);
 expect(huge.terms).toHaveLength(100);
 expect(glossarySchema.safeParse({terms:[],translations:[{source:'lijek č',target:'medicine'},{source:'lijek c\u030c',target:'drug'}]}).success).toBe(false);
});

it('sends both directional glossary mappings on each connection and renders both translation directions',async()=>{
 const sockets:ReturnType<typeof socket>[]=[];
 function socket(){return Object.assign(new EventEmitter(),{readyState:1,bufferedAmount:0,send:vi.fn(),terminate:vi.fn(),close:vi.fn()});}
 const c=new Coordinator({start:async()=>{},stop:()=>{}},()=>{},{...structuredClone(defaults),funding:'personal'},()=>{const ws=socket();sockets.push(ws);return ws as unknown as WebSocket;});
 c.key='synthetic-test-only';
 c.glossary={terms:['blood pressure','krvni pritisak'],translations:[{source:'blood pressure',target:'krvni pritisak'},{source:'krvni pritisak',target:'blood pressure'}]};
 try{
  for(let connection=0;connection<2;connection++){
   await c.start();const epoch=c.state.transcript.epoch;c.format(epoch,{sampleRate:48000,channels:2});const ws=sockets[connection];ws.emit('open');
   const config=JSON.parse(ws.send.mock.calls[0][0]);
   expect(config.translation).toEqual({type:'two_way',language_a:'en',language_b:'bs'});
   expect(config.context.terms).toEqual(c.glossary.terms);expect(config.context.translation_terms).toEqual(c.glossary.translations);
   for(const [speaker,language,target,source,translation] of [['1','en','bs','blood pressure','krvni pritisak'],['2','bs','en','krvni pritisak','blood pressure']]){
    ws.emit('message',Buffer.from(JSON.stringify({tokens:[{speaker,language,text:source,is_final:true,translation_status:'original'}]})));
    ws.emit('message',Buffer.from(JSON.stringify({tokens:[{speaker,language:target,source_language:language,text:translation,is_final:false,translation_status:'translation'}]})));
    ws.emit('message',Buffer.from(JSON.stringify({tokens:[{speaker,language:target,source_language:language,text:translation,is_final:true,translation_status:'translation'}]})));
   }
   const groups=c.state.transcript.groups.filter(g=>g.epoch===epoch);
   expect(groups.map(g=>[g.source,g.translation,g.translationDraft])).toEqual([['blood pressure','krvni pritisak',''],['krvni pritisak','blood pressure','']]);
   const stopped=c.stop(connection===0?'paused':'stopped');ws.emit('message',Buffer.from(JSON.stringify({finished:true,tokens:[]})));await stopped;
  }
 }finally{c.dispose();}
});
