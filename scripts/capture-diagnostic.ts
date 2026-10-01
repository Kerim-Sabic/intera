import {_electron as electron} from '@playwright/test';
import {writeFile,mkdir,mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {spawn,type ChildProcess} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;
async function main(){
 const packaged=process.argv.includes('--packaged');const executablePath=process.env.INTERA_CAPTURE_EXECUTABLE||(process.platform==='darwin'?`out/Intera-darwin-${process.arch}/Intera.app/Contents/MacOS/Intera`:'out/Intera-win32-x64/Intera.exe');const app=await electron.launch(packaged?{executablePath,args:['--test-isolated'],env}:{args:['.','--test-isolated'],env});
 let player:ChildProcess|undefined;let toneDirectory:string|undefined;let toneExit:number|null|undefined;let toneStarted=false;
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.intera);
  await page.waitForFunction(async()=>!(await window.intera.snapshot()).storageLoading,{},{timeout:15000});
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Audio',exact:true}).click();
  await page.getByRole('button',{name:'Start local playback test'}).click();
  const acquisitionStarted=Date.now(),acquisitionDeadline=acquisitionStarted+35000;
  while(Date.now()<acquisitionDeadline){const state=await page.evaluate(()=>window.intera.snapshot());if(state.audio||state.status==='error')break;await new Promise(resolve=>setTimeout(resolve,200));}
  const acquired=await page.evaluate(()=>window.intera.snapshot());const captureReady=!!acquired.audio,acquisitionWaitMs=Date.now()-acquisitionStarted;
  // A separate native player exercises Mac system playback without depending on capture of Intera itself.
  if(captureReady&&process.platform==='darwin'){
   toneDirectory=await mkdtemp(path.join(tmpdir(),'intera-local-tone-'));const rate=48000,seconds=4,frames=rate*seconds;const wav=Buffer.alloc(44+frames*4);
   wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*4,40);
   for(let i=0;i<frames;i++){const sample=Math.round(Math.sin(2*Math.PI*440*i/rate)*983);wav.writeInt16LE(sample,44+i*4);wav.writeInt16LE(sample,46+i*4);}
   const toneFile=path.join(toneDirectory,'synthetic.wav');await writeFile(toneFile,wav,{mode:0o600});player=spawn('/usr/bin/afplay',[toneFile],{stdio:'ignore'});player.on('spawn',()=>{toneStarted=true;});player.on('error',()=>{toneExit=-1;});player.on('exit',code=>{toneExit=code;});
  }else if(captureReady){await page.evaluate(async()=>{const ctx=new AudioContext();const osc=ctx.createOscillator();const gain=ctx.createGain();gain.gain.value=0.03;osc.frequency.value=440;osc.connect(gain).connect(ctx.destination);await ctx.resume();osc.start();osc.stop(ctx.currentTime+4);osc.onended=()=>void ctx.close();});}
  let captureDiagnostic:unknown;let packets=0,maxLevel=0,health='',status='',audio:unknown=null,atMinimize=0;const mainWindow=await app.browserWindow(page);
  for(let n=0;n<(captureReady?60:1);n++){if(n===20){atMinimize=packets;await mainWindow.evaluate(w=>w.minimize());}await new Promise(r=>setTimeout(r,100));const s=await page.evaluate(()=>window.intera.snapshot());captureDiagnostic=s.captureDiagnostic;packets=s.packets;maxLevel=Math.max(maxLevel,s.meter);health=s.captureHealth;status=s.status+' '+s.message;audio=s.audio;}
  await page.evaluate(()=>window.intera.command({type:'stop'}));const after=await page.evaluate(()=>window.intera.snapshot());await new Promise(r=>setTimeout(r,400));const later=await page.evaluate(()=>window.intera.snapshot());
  const passed=packets>0&&maxLevel>0.0001&&packets>atMinimize&&after.packets===later.packets;
  const report={acquisitionWaitMs,captureReady,captureDiagnostic,packaged,os:process.platform,osVersion:await app.evaluate(()=>process.getSystemVersion()),arch:process.arch,runtime:await app.evaluate(()=>process.versions.electron),data:'Synthetic 440 Hz playback, 4 seconds. Local only; no provider request.',toneSource:!captureReady?'NOT PLAYED — capture did not initialize':process.platform==='darwin'?'Separate afplay process':'Intera renderer; not an external application',toneStarted:process.platform==='darwin'?toneStarted:undefined,toneExit:process.platform==='darwin'?toneExit:undefined,packets,maxLevel,health,status,audio,packetsWhileMinimized:packets-atMinimize,stoppedPacketsStable:after.packets===later.packets,providerUploaded:false,meetingApps:'NOT RUN',headphones:'NOT VERIFIED',result:passed?'PASS local loopback sample delivery':'FAIL / unavailable capture'};
  await mkdir('test-results',{recursive:true});await writeFile(packaged?'test-results/capture-packaged.json':'test-results/capture-diagnostic.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  if(!passed)process.exitCode=1;
 }finally{player?.kill();if(toneDirectory){await unlink(path.join(toneDirectory,'synthetic.wav')).catch(()=>{});await rmdir(toneDirectory).catch(()=>{});}await app.close();}
}
main().catch(()=>{console.error('Capture diagnostic failed before completion.');process.exitCode=1;});
