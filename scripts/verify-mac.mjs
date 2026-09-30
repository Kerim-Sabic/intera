import {execFileSync,spawnSync} from 'node:child_process';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
if(process.platform!=='darwin')throw new Error('Run Mac verification on macOS.');
const root=path.resolve(process.argv[2]||'out');
const inspect=process.argv.includes('--inspect-only');
await mkdir('test-results/mac',{recursive:true});
function run(command,args){const result=spawnSync(command,args,{encoding:'utf8',timeout:120000});return {ok:result.status===0,exitCode:result.status,output:(result.stdout||'')+(result.stderr||'')};}
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});const result=[];for(const e of entries){const p=path.join(dir,e.name);if(e.isDirectory()&&!e.name.endsWith('.app'))result.push(...await files(p));else if(e.name.endsWith('.app')||e.name.endsWith('.dmg')||e.name.endsWith('.zip'))result.push(p);}return result;}
const report={kind:inspect?'Original artifact inspection':'Mac artifact integrity; not physical capture certification',os:execFileSync('sw_vers',['-productVersion'],{encoding:'utf8'}).trim(),arch:process.arch,apps:[],containers:[],checksums:[]};
let failed=false;
async function inspectApp(app,label){
 const plist=path.join(app,'Contents/Info.plist');
 const info=JSON.parse(execFileSync('plutil',['-convert','json','-o','-',plist],{encoding:'utf8'}));
 const signature=run('codesign',['--verify','--deep','--strict','--verbose=4',app]);
 const identity=run('codesign',['--display','--verbose=4',app]);
 const gatekeeper=run('spctl',['--assess','--type','execute','--verbose=4',app]);
 const binary=run('lipo',['-archs',path.join(app,'Contents/MacOS',info.CFBundleExecutable)]);
 const validMetadata=info.CFBundleIdentifier==='com.intera.desktop'&&info.LSMinimumSystemVersion==='13.0'&&!!info.NSAudioCaptureUsageDescription&&!!info.NSScreenCaptureUsageDescription;
 report.apps.push({label,version:info.CFBundleShortVersionString,minimumOS:info.LSMinimumSystemVersion,validMetadata,signature,identity,gatekeeper,binary});
 if(!signature.ok||!validMetadata)failed=true;
 // Gatekeeper rejection is expected for internal ad-hoc builds, never for a
 // build explicitly requested as a notarized distribution candidate.
 if(process.env.INTERA_REQUIRE_NOTARIZED==='1'&&!gatekeeper.ok)failed=true;
}
for(const file of await files(root)){
 if(file.endsWith('.app')){await inspectApp(file,'packaged app');continue;}
 const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);report.checksums.push({file:path.relative(root,file),sha256:hash.digest('hex')});
 if(file.endsWith('.dmg')){
  const verify=run('hdiutil',['verify',file]);report.containers.push({file,verify});if(!verify.ok)failed=true;
  const mount=path.join(process.env.RUNNER_TEMP||'/tmp',`intera-audit-${process.pid}-${report.containers.length}`);await mkdir(mount,{recursive:true});
  execFileSync('hdiutil',['attach','-readonly','-nobrowse','-mountpoint',mount,file],{stdio:'pipe'});
  try{for(const e of await readdir(mount))if(e.endsWith('.app'))await inspectApp(path.join(mount,e),'inside DMG');}finally{execFileSync('hdiutil',['detach',mount],{stdio:'pipe'});}
 }else{
  const verify=run('unzip',['-t',file]);report.containers.push({file,verify});if(!verify.ok)failed=true;
  const target=path.join(process.env.RUNNER_TEMP||'/tmp',`intera-zip-audit-${process.pid}-${report.containers.length}`);await mkdir(target,{recursive:true});
  execFileSync('ditto',['-x','-k',file,target]);for(const app of await files(target))if(app.endsWith('.app'))await inspectApp(app,'ZIP round trip');
 }
}
if(!report.apps.length)failed=true;
report.result=failed?'FAIL':'PASS integrity (Gatekeeper status reported separately)';
await writeFile(`test-results/mac/${inspect?'baseline':'integrity'}.json`,JSON.stringify(report,null,2));
await writeFile(`test-results/mac/${inspect?'baseline':'SHA256SUMS'}.txt`,report.checksums.map(x=>`${x.sha256}  ${x.file}`).join('\n')+'\n');
console.log(JSON.stringify(report,null,2));
if(failed&&!inspect)process.exitCode=1;
