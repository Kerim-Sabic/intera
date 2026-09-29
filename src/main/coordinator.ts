import WebSocket from 'ws';
import {defaults,providerConfig,audioSchema,destination,preferencesSchema,type Preferences,type Glossary} from '../shared/config';
import {initialTranscript,beginEpoch,reduceTokens,responseSchema,changeGroup} from '../shared/transcript';
import {demoEvents} from '../shared/demo';
import type {State,Status} from '../shared/protocol';
export interface Capture{start:(epoch:number,packetMs:number)=>Promise<void>;stop:()=>void}
export class Coordinator{
 state:State;key='';glossary:Glossary={terms:[],translations:[]};
 private epoch=0;private socket:WebSocket|null=null;private queue:Buffer[]=[];private bytes=0;private position=0;private event=0;private timer:ReturnType<typeof setInterval>|null=null;private drain:ReturnType<typeof setTimeout>|null=null;private watchdog:ReturnType<typeof setInterval>|null=null;private lastPacket=0;private started=0;private ending:Promise<void>|null=null;private endResolve:(()=>void)|null=null;
 constructor(private capture:Capture,private publish:(s:State)=>void,preferences:Preferences=structuredClone(defaults),private connect:(url:string)=>WebSocket=url=>new WebSocket(url,{handshakeTimeout:10000,maxPayload:2*1024*1024,perMessageDeflate:false})){
  this.state={sequence:0,status:'idle',demo:false,preferences,effective:null,pending:null,transcript:initialTranscript(),keyStored:false,secureStorage:false,message:'Ready to interpret',meter:0,packets:0,audio:null,names:{},hold:null,platform:process.platform,captureHealth:'Off',networkHealth:'Disconnected'};
 }
 emit(){this.state={...this.state,sequence:this.state.sequence+1};this.publish(this.state);}
 busy(){return ['connecting','listening','local-test','stopping'].includes(this.state.status);}
 async start(demo=false,local=false){
  if(this.busy())return;
  if(!demo&&!local&&!this.key)throw new Error('Add your Soniox key in Settings first.');
  const resume=this.state.status==='paused';
  if(!resume||this.state.pending?.timing==='pause'||!this.state.effective)this.state.effective=structuredClone(this.state.preferences.processing);
  if(!resume||this.state.pending?.timing==='pause')this.state.pending=null;
  const epoch=++this.epoch;this.event=0;this.position=0;this.queue=[];this.bytes=0;
  this.state.transcript=beginEpoch(this.state.transcript,epoch);this.state.demo=demo;this.state.status=local?'local-test':demo?'listening':'connecting';this.state.meter=0;this.state.packets=0;this.state.audio=null;this.state.message=demo?'Demo — simulated conversation':local?'Local playback test — nothing is uploaded':'Starting a new connection. Speech during the gap is not captured.';this.state.captureHealth=demo?'Simulated':'Waiting for samples';this.state.networkHealth=local||demo?'Not connected':'Connecting';this.started=Date.now();this.lastPacket=Date.now();this.emit();
  if(demo){let n=0;this.timer=setInterval(()=>{if(epoch!==this.epoch)return;if(n<demoEvents.length){this.state.transcript=reduceTokens(this.state.transcript,epoch,++this.event,demoEvents[n++]);this.emit();}else{this.cleanup();this.state.status='error';this.state.message='Demo — simulated network failure. Resume starts a new epoch.';this.emit();}},1100);return;}
  this.watchdog=setInterval(()=>{if(epoch!==this.epoch)return;if(Date.now()-this.lastPacket>6000)this.fail('No playback samples received. This is different from delivered silent samples. Check permissions and the playback device.');else if(Date.now()-this.started>295*60000){this.state.message='Provider duration limit approaching. Pause and Resume to open a new request.';this.emit();if(Date.now()-this.started>299*60000)void this.stop('paused');}},1000);
  try{await this.capture.start(epoch,this.state.effective!.packetMs);}catch{if(epoch===this.epoch)this.fail('Playback capture could not start. Check system audio permission.');}
 }
 format(epoch:number,input:unknown){
  if(epoch!==this.epoch||!['connecting','local-test'].includes(this.state.status))return;
  const audio=audioSchema.parse(input);this.state.audio=audio;
  if(this.state.status==='local-test'){this.emit();return;}
  if(this.socket)return;
  const ws=this.connect(destination(this.state.preferences.region));this.socket=ws;
  ws.on('open',()=>{if(epoch!==this.epoch||this.state.status!=='connecting'){ws.close();return;}ws.send(JSON.stringify({...providerConfig(this.state.effective!,audio,this.glossary),api_key:this.key}));this.state.status='listening';this.state.networkHealth='Connected';this.state.message='Listening to computer audio — all playback';for(const b of this.queue)ws.send(b);this.queue=[];this.bytes=0;this.emit();});
  ws.on('message',raw=>{if(epoch!==this.epoch)return;try{const event=responseSchema.parse(JSON.parse(raw.toString()));if(event.error_code){this.fail(`Soniox request failed (${event.error_code}). Check key, regional access, quota or connection; resume explicitly.`);return;}if(!['listening','stopping'].includes(this.state.status))return;this.state.transcript=reduceTokens(this.state.transcript,epoch,++this.event,event.tokens);if(this.state.transcript.groups.reduce((n,g)=>n+g.source.length+g.translation.length,0)>2_000_000){this.fail('Session memory limit reached. Export or clear before continuing.');return;}this.emit();if(event.finished&&this.state.status==='stopping')this.finishStop();}catch{this.fail('Malformed provider response. Capture stopped.');}});
  ws.on('error',()=>{if(epoch===this.epoch)this.fail('Secure provider connection failed. Capture stopped; resume explicitly.');});
  ws.on('close',()=>{if(epoch!==this.epoch)return;if(this.state.status==='stopping')this.finishStop();else if(['connecting','listening'].includes(this.state.status))this.fail('Provider connection closed. Gap recorded; resume explicitly.');});
 }
 packet(epoch:number,position:number,raw:ArrayBuffer){
  if(epoch!==this.epoch||!['connecting','listening','local-test'].includes(this.state.status))return;
  const a=this.state.audio;if(!a||!(raw instanceof ArrayBuffer)||!Number.isSafeInteger(position)||position!==this.position||raw.byteLength===0||raw.byteLength>48000||raw.byteLength%(a.channels*2)){this.fail('Invalid or discontinuous audio packet. Capture stopped.');return;}
  const b=Buffer.from(raw);this.position+=b.length/(a.channels*2);this.lastPacket=Date.now();this.state.packets++;let sum=0;for(let i=0;i<b.length;i+=2)sum+=(b.readInt16LE(i)/32768)**2;this.state.meter=Math.sqrt(sum/(b.length/2));this.state.captureHealth=this.state.meter>0.0001?'Samples arriving':'Samples arriving — silence';
  if(this.state.status!=='local-test'){
   const limit=a.sampleRate*a.channels*2*2;
   if((this.socket?.bufferedAmount??0)+this.bytes+b.length>limit){this.fail('Audio congestion exceeded two seconds. Capture stopped; the next connection has an explicit gap.');return;}
   if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(b);else{this.queue.push(b);this.bytes+=b.length;}
  }
  this.emit();
 }
 async preferences(p:Preferences,timing:'now'|'pause'|'next'){
  p=preferencesSchema.parse(p);
  if(this.busy()&&p.region!==this.state.preferences.region)throw new Error('Stop listening before changing processing region.');
  const changed=JSON.stringify(p.processing)!==JSON.stringify(this.state.preferences.processing);this.state.preferences=p;
  if(changed&&this.busy()){this.state.pending={config:p.processing,timing:timing==='next'?'next':'pause'};if(timing==='now'){const demo=this.state.demo;await this.stop('paused');if(this.state.status==='paused')await this.start(demo);}}else if(changed&&this.state.status==='paused'){this.state.pending={config:p.processing,timing:timing==='next'?'next':'pause'};}
  this.emit();
 }
 private stopTarget:Status='stopped';
 stop(target:Status='stopped'):Promise<void>{
  if(this.ending){if(target==='stopped')this.stopTarget='stopped';return this.ending;}
  this.capture.stop();this.queue=[];this.bytes=0;this.state.meter=0;this.state.captureHealth='Off';this.clearTimers();this.stopTarget=target;
  if(!this.socket||this.socket.readyState!==WebSocket.OPEN){this.cleanup();this.epoch++;this.state.status=target;this.emit();return Promise.resolve();}
  this.state.status='stopping';this.state.message='Capture stopped. Finishing only audio already sent.';
  this.ending=new Promise(r=>{this.endResolve=r;});const promise=this.ending;
  this.socket.send(Buffer.alloc(0));this.drain=setTimeout(()=>this.finishStop(),3000);this.emit();return promise;
 }
 private finishStop(){this.cleanup();this.epoch++;this.state.status=this.stopTarget;this.state.message=this.stopTarget==='paused'?'Paused — no audio is acquired or uploaded':'Stopped — text retained for review';const done=this.endResolve;this.endResolve=null;this.ending=null;this.emit();done?.();}
 private clearTimers(){if(this.timer)clearInterval(this.timer);if(this.watchdog)clearInterval(this.watchdog);this.timer=null;this.watchdog=null;}
 cleanup(){this.capture.stop();this.clearTimers();if(this.drain)clearTimeout(this.drain);this.drain=null;const ws=this.socket;this.socket=null;ws?.removeAllListeners();ws?.on('error',()=>{});ws?.terminate();this.queue=[];this.bytes=0;this.state.networkHealth='Disconnected';this.state.captureHealth='Off';}
 fail(message:string){this.cleanup();this.epoch++;this.state.status='error';this.state.message=message;this.state.meter=0;const done=this.endResolve;this.endResolve=null;this.ending=null;this.emit();done?.();}
 async clear(){await this.stop();this.state.transcript=initialTranscript();this.state.hold=null;this.state.names={};this.state.status='idle';this.state.message='Session cleared. Exported copies are unaffected.';this.emit();}
 group(id:string,action:'pin'|'interpreted'|'edit',edit?:{source:string;translation:string}){this.state.transcript=changeGroup(this.state.transcript,id,action,this.state.preferences.drafts,edit);this.emit();}
 finalize(){if(this.socket?.readyState===WebSocket.OPEN&&this.state.status==='listening')this.socket.send(JSON.stringify({type:'finalize'}));}
 dispose(){this.epoch++;this.cleanup();}
}
