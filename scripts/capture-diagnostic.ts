import {_electron as electron} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const env=Object.fromEntries(Object.entries(process.env).filter(([k,v])=>k!=='ELECTRON_RUN_AS_NODE'&&v!==undefined)) as Record<string,string>;
async function main(){
 const packaged=process.argv.includes('--packaged');const app=await electron.launch(packaged?{executablePath:'out/Intera-win32-x64/Intera.exe',args:['--test-isolated'],env}:{args:['.','--test-isolated'],env});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.intera);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Audio',exact:true}).click();
  await page.getByRole('button',{name:'Start local playback test'}).click();
  // Synthetic tone is played by the visible app. Only loopback captures it; no microphone call.
  await page.evaluate(async()=>{const ctx=new AudioContext();const osc=ctx.createOscillator();const gain=ctx.createGain();gain.gain.value=0.03;osc.frequency.value=440;osc.connect(gain).connect(ctx.destination);await ctx.resume();osc.start();osc.stop(ctx.currentTime+4);osc.onended=()=>void ctx.close();});
  let packets=0,maxLevel=0,health='',status='',audio:unknown=null,atMinimize=0;const mainWindow=await app.browserWindow(page);
  for(let n=0;n<60;n++){if(n===20){atMinimize=packets;await mainWindow.evaluate(w=>w.minimize());}await new Promise(r=>setTimeout(r,100));const s=await page.evaluate(()=>window.intera.snapshot());packets=s.packets;maxLevel=Math.max(maxLevel,s.meter);health=s.captureHealth;status=s.status+' '+s.message;audio=s.audio;}
  await page.evaluate(()=>window.intera.command({type:'stop'}));const after=await page.evaluate(()=>window.intera.snapshot());await new Promise(r=>setTimeout(r,400));const later=await page.evaluate(()=>window.intera.snapshot());
  const report={packaged,os:process.platform,arch:process.arch,runtime:await app.evaluate(()=>process.versions.electron),data:'Synthetic 440 Hz playback, 4 seconds. Local only; no provider request.',packets,maxLevel,health,status,audio,packetsWhileMinimized:packets-atMinimize,stoppedPacketsStable:after.packets===later.packets,providerUploaded:false,meetingApps:'NOT RUN',headphones:'NOT VERIFIED',result:packets>0&&maxLevel>0.0001?'PASS local loopback sample delivery':'FAIL / unavailable capture'};
  await mkdir('test-results',{recursive:true});await writeFile(packaged?'test-results/capture-packaged.json':'test-results/capture-diagnostic.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await app.close();}
}
main().catch(()=>{console.error('Capture diagnostic failed before completion.');process.exitCode=1;});
