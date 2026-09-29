import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import WebSocket from 'ws';
import {defaults,selectProfile,providerConfig,destination,regionSchema} from '../src/shared/config';
import {responseSchema} from '../src/shared/transcript';
// Explicit authorized raw PCM only. No desktop capture, logs of content or reference-free accuracy claims.
async function main(){
 const args=process.argv.slice(2),smoke=args.includes('--smoke');
 if(!args.includes('--authorized'))throw new Error('Requires --authorized. Audio will be sent to Soniox and may incur usage charges.');
 const file=args.find(a=>a.startsWith('--file='))?.slice(7);const key=process.env.SONIOX_API_KEY;
 if(!file||!key)throw new Error('Set SONIOX_API_KEY and pass --file=authorized.pcm (48 kHz stereo PCM16 LE).');
 const region=regionSchema.parse(process.env.SONIOX_REGION??'us');const pcm=await readFile(file);
 if(!pcm.length||pcm.length%4||pcm.length>48000*4*120)throw new Error('Sample must be complete 48 kHz stereo PCM16 frames, at most 120 seconds.');
 const repetitions=smoke?1:3;const names=smoke?['Balanced'] as const:['Speed','Balanced','Accuracy-first'] as const;
 for(let run=1;run<=repetitions;run++)for(const name of names){
  const report=await new Promise<Record<string,unknown>>((resolve,reject)=>{
   const ws=new WebSocket(destination(region),{handshakeTimeout:10000});const start=performance.now();let position=0;let firstSource:number|null=null,firstTranslation:number|null=null,lastSourceFinal:number|null=null,lastTranslationFinal:number|null=null,endpoints=0,revisions=0,previousDraft='';let timer:ReturnType<typeof setInterval>|undefined;
   const timeout=setTimeout(()=>{ws.terminate();reject(new Error('Run exceeded duration bound'));},pcm.length/(48000*4)*1000+15000);
   const finish=()=>{clearTimeout(timeout);clearInterval(timer);};
   ws.on('open',()=>{ws.send(JSON.stringify({...providerConfig(selectProfile(defaults.processing,name),{sampleRate:48000,channels:2}),api_key:key}));timer=setInterval(()=>{if(position>=pcm.length){clearInterval(timer);ws.send(Buffer.alloc(0));return;}ws.send(pcm.subarray(position,position+15360));position+=15360;},80);});
   ws.on('message',data=>{try{const event=responseSchema.parse(JSON.parse(data.toString()));if(event.error_code){finish();ws.terminate();reject(new Error(`Provider rejected run (${event.error_code})`));return;}let draft='';for(const t of event.tokens){const now=performance.now()-start;if(t.text==='<end>'||t.text==='<fin>'){endpoints++;continue;}if(t.translation_status==='translation'){firstTranslation??=now;if(t.is_final)lastTranslationFinal=now;}else{firstSource??=now;if(t.is_final)lastSourceFinal=now;}if(!t.is_final)draft+=t.text;}if(previousDraft&&draft!==previousDraft)revisions++;previousDraft=draft;if(event.finished){finish();resolve({run,profile:name,region,model:'stt-rt-v5',sampleRate:48000,channels:2,packetMs:80,firstSourceMs:firstSource,firstTranslationMs:firstTranslation,lastSourceFinalArrivalMs:lastSourceFinal,lastTranslationFinalArrivalMs:lastTranslationFinal,endpoints,draftRevisionEvents:revisions,paintLatencyMs:null,accuracy:'Not evaluated',translationMeaning:'Not evaluated',note:'Arrival timings relative to connection attempt; not speech-end latency. Revision count is not accuracy.'});ws.close();}}catch{finish();ws.terminate();reject(new Error('Invalid provider event'));}});
   ws.on('error',()=>{finish();reject(new Error('Provider connection failed'));});ws.on('close',()=>{finish();reject(new Error('Connection closed before finished'));});
  });console.log(JSON.stringify(report));
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
