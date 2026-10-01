import {EyeContact} from './eye-contact';
import {MeetingStore} from './meetings';
import {MacUpdates} from './updates';
import {startupDeadline} from './startup';
import {app,BrowserWindow,ipcMain,session,desktopCapturer,dialog,powerMonitor,screen,Menu,shell,safeStorage,systemPreferences} from 'electron';
import {captureDiagnosticSchema,CaptureStartupError,type CaptureDiagnostic} from '../shared/capture-diagnostic';
import squirrelStartup from 'electron-squirrel-startup';
import path from 'node:path';
import os from 'node:os';
import {readFile,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {Store} from './store';
import {Coordinator} from './coordinator';
import {AccountClient} from './account';
import {commandSchema,type State} from '../shared/protocol';
import {BRAND,preferencesSchema,regions} from '../shared/config';
import {displayed} from '../shared/transcript';
import {visualFixture} from '../shared/visual-fixture';
import {providerLinks} from '../shared/provider-links';
import {macPlaybackPath,captureFailure} from './mac-compatibility';
if(process.argv.includes('--test-isolated')){
 const label=process.argv.find(v=>v.startsWith('--test-profile='))?.slice(15);
 app.setPath('userData',path.join(os.tmpdir(),label&&/^[a-z0-9-]{1,80}$/.test(label)?`intera-test-${label}`:`intera-test-${process.pid}`));
}
let eyeContact:EyeContact;let coordinator:Coordinator;let updates:MacUpdates;let windowOptions={floating:true,protection:false};let captureHost:BrowserWindow|null=null;let compact:BrowserWindow|null=null;const views=new Set<BrowserWindow>();let quitting=false;let previous:State|undefined;
let storageLoading=true;let startupPhase='launch';
function startupRecord(phase:string){startupPhase=phase;try{writeFileSync(path.join(app.getPath('userData'),'startup-status.json'),JSON.stringify({phase,version:app.getVersion(),platform:process.platform,os:os.release(),arch:process.arch,electron:process.versions.electron,at:new Date().toISOString()}),{mode:0o600});}catch{/* Diagnostics must never prevent startup. */}}
const single=!squirrelStartup&&app.requestSingleInstanceLock();if(!single)app.quit();
function revealReader(){if(quitting||!coordinator)return;const w=[...views].find(w=>!w.isDestroyed());if(w){if(w.isMinimized())w.restore();w.show();w.focus();}else windowView();}
app.on('second-instance',revealReader);
function protect(w:BrowserWindow){w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());w.webContents.on('render-process-gone',()=>{if(w===captureHost)coordinator?.fail('Capture host stopped. Restart listening explicitly.');else if(views.has(w))coordinator?.fail('Reader stopped responding. Capture stopped; reopen Intera before listening again.');});}
function windowView(small=false){
 const w=new BrowserWindow({width:small?500:1100,height:small?280:760,minWidth:small?360:680,minHeight:small?220:520,title:BRAND,alwaysOnTop:small&&windowOptions.floating,show:!small,icon:path.join(app.getAppPath(),'assets/brand/exports/intera.ico'),backgroundColor:'#F5F3ED',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',...(process.platform==='darwin'?{trafficLightPosition:{x:14,y:small?14:24}}:{}),webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,spellcheck:false,backgroundThrottling:false}});
 w.setContentProtection(windowOptions.protection);if(small)w.once('ready-to-show',()=>w.showInactive());views.add(w);protect(w);void w.loadFile(path.join(__dirname,'ui/index.html'),{query:small?{compact:'1'}:{}}).catch(()=>{startupRecord('reader-load-failed');dialog.showErrorBox('Intera reader could not open','Installed reader files could not load. Replace the app with the matching Apple Silicon or Intel beta. Your saved files have not been deleted.');});
 w.on('closed',()=>{views.delete(w);if(compact===w)compact=null;if(!views.size){eyeContact?.stop();void coordinator.stop();}});return w;
}
function recordCapture(epoch:number,raw:unknown){if(!coordinator||coordinator.state.transcript.epoch!==epoch)return;const parsed=captureDiagnosticSchema.safeParse(raw);if(!parsed.success)return;let screenPermission:CaptureDiagnostic['screenPermission'];if(process.platform==='darwin')try{screenPermission=systemPreferences.getMediaAccessStatus('screen');}catch{screenPermission='unknown';}coordinator.state.captureDiagnostic={...parsed.data,screenPermission};try{writeFileSync(path.join(app.getPath('userData'),'capture-status.json'),JSON.stringify({...coordinator.state.captureDiagnostic,version:app.getVersion(),electron:process.versions.electron,os:process.platform==='darwin'?process.getSystemVersion():os.release(),arch:process.arch}),{mode:0o600});}catch{/* Diagnostic storage is optional. */}coordinator.emit();}
async function makeCapture(){
 const epoch=coordinator.state.transcript.epoch;recordCapture(epoch,{stage:'capture-host'});
 if(captureHost&&!captureHost.isDestroyed())return captureHost;
 const w=new BrowserWindow({show:false,width:32,height:32,webPreferences:{preload:path.join(__dirname,'capture-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,spellcheck:false,backgroundThrottling:false,partition:'capture'}});captureHost=w;protect(w);
 const captureSession=w.webContents.session;
 captureSession.setPermissionRequestHandler((wc,permission,callback)=>callback(wc===w.webContents&&coordinator.busy()&&(permission==='display-capture'||permission==='media')));
 captureSession.setPermissionCheckHandler((wc,permission)=>wc===w.webContents&&coordinator.busy()&&(permission==='display-capture'||permission==='media'));
 captureSession.setDisplayMediaRequestHandler(async(request,callback)=>{if(w.isDestroyed()||w!==captureHost||request.frame!==w.webContents.mainFrame||!coordinator.busy()){callback({});return;}try{recordCapture(epoch,{stage:'source-list'});const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});if(w.isDestroyed()||w!==captureHost||!coordinator.busy()){callback({});return;}if(!sources[0]){recordCapture(epoch,{stage:'source-list',code:'NoDisplaySource'});callback({});return;}callback({video:sources[0],audio:'loopback'});}catch{recordCapture(epoch,{stage:'source-list',code:'SourceListFailed'});callback({});}});
 try{await w.loadFile(path.join(__dirname,'host.html'));}catch{recordCapture(epoch,{stage:'capture-host',code:'CaptureHostLoadFailed'});throw new CaptureStartupError(captureFailure('CaptureHostLoadFailed',process.platform));}return w;
}
function trusted(event:Electron.IpcMainInvokeEvent|Electron.IpcMainEvent,capture=false){const w=BrowserWindow.fromWebContents(event.sender);return !!w&&(capture?w===captureHost:views.has(w))&&event.senderFrame===event.sender.mainFrame;}
if(single)app.whenReady().then(async()=>{
 startupRecord('ready');
 app.setName(BRAND);
 const build=JSON.parse(await readFile(path.join(__dirname,'build-info.json'),'utf8')) as {sha:string;dirty:boolean;macUpdatesApproved?:boolean;updateTeamId?:string};
 app.setAboutPanelOptions({applicationName:BRAND,applicationVersion:app.getVersion(),version:`${build.sha.slice(0,12)}${build.dirty?' · working changes':''} · internal beta`,iconPath:path.join(app.getAppPath(),'assets/brand/exports/app-icon.png'),copyright:'Intera — internal beta. Human interpretation remains essential.'});
 Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform==='darwin'?[{role:'appMenu'},{role:'editMenu'},{role:'windowMenu'}]:[{role:'editMenu'},{role:'windowMenu'},{label:'Help',submenu:[{label:'About Intera',click:()=>app.showAboutPanel()}]}]));
 session.defaultSession.setPermissionRequestHandler((wc,p,cb)=>cb(p==='clipboard-sanitized-write'&&views.has(BrowserWindow.fromWebContents(wc)!)));session.defaultSession.setPermissionCheckHandler((wc,p)=>p==='clipboard-sanitized-write'&&!!wc&&views.has(BrowserWindow.fromWebContents(wc)!));
 const store=new Store();let credentialChange=false;let meetingOperation=false;
 const accounts=new AccountClient();eyeContact=new EyeContact(view=>{coordinator.state.eyeContact=view;coordinator.emit();},frame=>{for(const w of views)if(!w.isDestroyed())w.webContents.send('gaze-frame',frame);});
 ipcMain.handle('billing',async(e,raw)=>{if(!trusted(e))return {ok:false,message:'Denied'};if(raw?.type==='sign-out')await coordinator.stop();return accounts.command(raw);});
 coordinator=new Coordinator({start:async(epoch,packetMs)=>{if(process.platform==='darwin'&&macPlaybackPath(process.getSystemVersion())==='unsupported')throw new Error('Playback capture requires macOS 13 or later.');const w=await makeCapture();if(coordinator.busy()&&coordinator.state.transcript.epoch===epoch)w.webContents.send('capture-command',{type:'start',epoch,packetMs});},stop:()=>{if(captureHost&&!captureHost.isDestroyed()){captureHost.destroy();captureHost=null;}}},state=>{const changes=Object.fromEntries(Object.entries(state).filter(([key,value])=>!previous||previous[key as keyof State]!==value));const patch={base:previous?.sequence??-1,sequence:state.sequence,changes};previous={...state};for(const w of views)if(!w.isDestroyed())w.webContents.send('state',patch);},store.preferences(),undefined,accounts);
 coordinator.glossary=store.glossary();coordinator.state.glossary=structuredClone(coordinator.glossary);coordinator.state.storageLoading=true;
 const meetingStore=new MeetingStore(path.join(app.getPath('userData'),'meetings'),{available:()=>store.secure(),encrypt:text=>safeStorage.encryptStringAsync(text),decrypt:async bytes=>(await safeStorage.decryptStringAsync(bytes)).result});
 const refreshMeetings=async()=>{try{coordinator.state.meetings=await meetingStore.list();coordinator.state.meetingStorageError=undefined;}catch{coordinator.state.meetingStorageError='Secure meeting library is unavailable or a saved file could not be read. No file was deleted.';}};
 windowOptions=store.windowOptions();coordinator.state.windowOptions={...windowOptions};
 updates=new MacUpdates(view=>{coordinator.state.updates=view;coordinator.emit();},()=>coordinator.busy());coordinator.state.updates=updates.view;void updates.initialize({packaged:app.isPackaged,platform:process.platform,arch:process.arch,version:app.getVersion(),bundlePath:process.platform==='darwin'?path.resolve(process.execPath,'../../..'):app.getAppPath(),teamId:build.updateTeamId,approved:build.macUpdatesApproved});
 ipcMain.handle('snapshot',e=>{if(!trusted(e))throw new Error('Denied');return coordinator.state;});
 ipcMain.on('capture-format',(e,epoch,format)=>{if(trusted(e,true))try{coordinator.format(epoch,format);}catch{coordinator.fail('Unsupported capture format.');}});
 ipcMain.handle('capture-packet',(e,epoch,position,buffer)=>{if(trusted(e,true))coordinator.packet(epoch,position,buffer);});
 ipcMain.on('capture-diagnostic',(e,epoch,raw)=>{if(trusted(e,true)&&coordinator.busy())recordCapture(epoch,raw);});
 ipcMain.on('capture-error',(e,epoch,code,stage)=>{if(trusted(e,true)&&coordinator.state.transcript.epoch===epoch){const previous=coordinator.state.captureDiagnostic;const raw=previous?.stage==='source-list'&&previous.code?{stage:previous.stage,code:previous.code}:{stage:stage??previous?.stage??'acquire',code:typeof code==='string'?code:'CaptureFailure'};const diagnostic=captureDiagnosticSchema.safeParse(raw);recordCapture(epoch,diagnostic.success?diagnostic.data:{stage:'acquire',code:'CaptureFailure'});const d=coordinator.state.captureDiagnostic;coordinator.fail(`${captureFailure(d?.code??'CaptureFailure',process.platform,process.platform==='darwin'?process.getSystemVersion():'')} [${d?.stage} / ${d?.code}]`);}});
 ipcMain.handle('command',async(e,raw)=>{
  if(!trusted(e))return {ok:false,message:'Denied'};
  let ownsMeetingOperation=false;
  try{
   const c=commandSchema.parse(raw);if(meetingOperation&&c.type!=='stop')throw new Error('Meeting operation in progress. Please wait.');if(['save-meeting','open-meeting','new-meeting','delete-meeting','clear','demo'].includes(c.type)){meetingOperation=true;ownsMeetingOperation=true;}
   if(credentialChange&&!['stop','pause'].includes(c.type))throw new Error('Credential update in progress. Try again when it finishes.');
   if(storageLoading&&['start','local-test','key','connect-personal','forget-key','validate-key','save-meeting','open-meeting','delete-meeting'].includes(c.type))throw new Error('Opening secure storage. Please wait a moment; Demo and settings remain available.');
   switch(c.type){
    case 'start':if(coordinator.state.meetingReview)throw new Error('Start a new meeting before listening. Saved meetings are for review.');coordinator.state.savedMeeting=undefined;await coordinator.start(coordinator.state.status==='paused'&&coordinator.state.demo);break;
    case 'demo':coordinator.state.meetingReview=false;coordinator.state.savedMeeting=undefined;await coordinator.stop();await coordinator.clear();await coordinator.start(true);break;
    case 'local-test':await coordinator.start(false,true);break;
    case 'pause':await coordinator.stop('paused');break;
    case 'stop':await coordinator.stop();break;
    case 'clear':case 'new-meeting':await coordinator.clear();coordinator.state.savedMeeting=undefined;coordinator.state.meetingReview=false;break;
    case 'save-meeting':{await coordinator.stop();if(!coordinator.state.transcript.groups.length)throw new Error('No meeting text to save.');const meeting=await meetingStore.save({title:c.title,demo:coordinator.state.demo,names:coordinator.state.names,transcript:structuredClone(coordinator.state.transcript)});coordinator.state.savedMeeting=meeting.id;await refreshMeetings();break;}
    case 'open-meeting':{await coordinator.stop();const meeting=await meetingStore.get(c.id);coordinator.state.transcript=meeting.transcript;coordinator.state.names=meeting.names;coordinator.state.demo=meeting.demo;coordinator.state.hold=null;coordinator.state.savedMeeting=meeting.id;coordinator.state.meetingReview=true;coordinator.state.translationHealth=undefined;coordinator.state.message='Saved meeting — review only. Start a new meeting to listen.';break;}
    case 'delete-meeting':await meetingStore.delete(c.id);if(coordinator.state.savedMeeting===c.id)coordinator.state.savedMeeting=undefined;await refreshMeetings();break;
    case 'window-options':windowOptions={floating:c.floating,protection:c.protection};coordinator.state.windowOptions={...windowOptions};for(const w of views){w.setContentProtection(c.protection);if(w===compact)w.setAlwaysOnTop(c.floating);}store.saveWindowOptions(windowOptions);break;
    case 'gaze-check':await eyeContact.check();break;
    case 'gaze-start':await eyeContact.start(c.settings);break;
    case 'gaze-configure':eyeContact.configure(c.settings);break;
    case 'gaze-stop':eyeContact.stop();break;
    case 'check-updates':updates.check();break;
    case 'install-update':if(coordinator.state.transcript.groups.length&&!coordinator.state.savedMeeting)throw new Error('Save or clear your meeting before restarting.');updates.install();break;
    case 'finish':coordinator.finalize();break;
    case 'compact':if(!compact)compact=windowView(true);else compact.showInactive();break;
    case 'hold':coordinator.state.hold=coordinator.state.hold?null:structuredClone(coordinator.state.transcript);break;
    case 'preferences':if('preferences' in c){await coordinator.preferences(c.preferences,c.timing);store.save(c.preferences);}break;
    case 'cancel-pending':if(coordinator.state.effective){coordinator.state.preferences={...coordinator.state.preferences,processing:coordinator.state.effective};store.save(coordinator.state.preferences);}coordinator.state.pending=null;break;
    case 'key':if('key' in c){if(coordinator.busy())throw new Error('Stop listening before changing credentials.');credentialChange=true;try{await store.setKey(c.key,c.persist);coordinator.key=c.key;coordinator.state.keyStored=true;}finally{credentialChange=false;}}break;
    case 'connect-personal':{
      if(coordinator.busy())throw new Error('Stop listening before changing the payment account.');
      credentialChange=true;try{const preferences={...coordinator.state.preferences,funding:'personal' as const,region:c.region};
      await store.setKey(c.key,c.persist);coordinator.key=c.key;coordinator.state.keyStored=true;
      await coordinator.preferences(preferences,'next');store.save(preferences);
      coordinator.state.message='Direct Soniox payment selected. Intera adds no usage fee; Soniox bills your provider account.';}finally{credentialChange=false;}break;
    }
    case 'provider-page':await shell.openExternal(providerLinks[c.page]);break;
    case 'forget-key':if(coordinator.busy())throw new Error('Stop first.');store.forget();coordinator.key='';coordinator.state.keyStored=false;break;
    case 'validate-key':{if(!coordinator.key)throw new Error('Add a key first.');const result=await fetch(`https://api${regions[coordinator.state.preferences.region]}.soniox.com/v1/models`,{headers:{Authorization:`Bearer ${coordinator.key}`},signal:AbortSignal.timeout(10000)});if(!result.ok)throw new Error(`Key validation failed (${result.status}).`);coordinator.state.message='Key accepted by models API. No audio was uploaded. Real-time access still requires account capability.';break;}
    case 'group':coordinator.state.savedMeeting=undefined;if('id' in c)coordinator.group(c.id,c.action,c.edit);break;
    case 'rename':coordinator.state.savedMeeting=undefined;if('id' in c)coordinator.state.names={...coordinator.state.names,[c.id]:c.name};break;
    case 'glossary':if('glossary' in c){if(coordinator.busy())throw new Error('Stop before changing session terminology.');coordinator.glossary=c.glossary;coordinator.state.glossary=structuredClone(c.glossary);if(c.save)store.saveGlossary(c.glossary);}break;
    case 'export':if('format' in c){const confirm=await dialog.showMessageBox({type:'warning',buttons:['Cancel','Export'],defaultId:0,cancelId:0,message:'Export may contain sensitive conversation text. Save only to an authorized location.'});if(confirm.response!==1)break;const file=await dialog.showSaveDialog({defaultPath:`Intera-session.${c.format}`,filters:[{name:'Transcript',extensions:[c.format]}]});if(file.filePath){const groups=coordinator.state.transcript.groups;const content=c.format==='json'?JSON.stringify({version:1,demo:coordinator.state.demo,groups},null,2):groups.map(g=>{const d=displayed(g,false);return `[Connection ${g.epoch} · ${g.speaker} · ${g.language}]\n${d.source}\n${d.translation}`;}).join('\n\n');await writeFile(file.filePath,content,'utf8');}}break;
    case 'export-settings':{const file=await dialog.showSaveDialog({defaultPath:'Intera-preferences.json'});if(file.filePath)await writeFile(file.filePath,JSON.stringify(coordinator.state.preferences,null,2));break;}
    case 'import-settings':{const f=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Preferences',extensions:['json']}]});if(!f.canceled){const data=await readFile(f.filePaths[0],'utf8');if(data.length>64000)throw new Error('Import too large.');return {ok:true,preview:preferencesSchema.parse(JSON.parse(data))};}break;}
   }
   coordinator.emit();return {ok:true};
  }catch(error){return {ok:false,message:error instanceof Error&&error.name!=='ZodError'?error.message:'Invalid settings or command. Nothing was applied.'};}finally{if(ownsMeetingOperation)meetingOperation=false;}
 });
 powerMonitor.on('suspend',()=>void coordinator.stop('paused'));powerMonitor.on('lock-screen',()=>void coordinator.stop('paused'));
 screen.on('display-removed',()=>{if(compact){const area=screen.getPrimaryDisplay().workArea;compact.setPosition(area.x+20,area.y+20);}});
 if(process.argv.includes('--test-isolated')&&process.argv.includes('--visual-fixture')){coordinator.state.transcript=visualFixture();coordinator.state.demo=true;coordinator.state.status='stopped';coordinator.state.captureHealth='Simulated';}
 windowView();startupRecord('reader-created');void eyeContact.check();
 // Keychain prompts and damaged saved meetings must not delay the first window.
 void (async()=>{try{const restored=await startupDeadline((async()=>{
   if(process.argv.includes('--test-isolated')&&process.argv.includes('--test-storage-hang'))await new Promise(()=>{});
   const secure=await store.secure();const key=secure?await store.key():'';
   let meetings:State['meetings'];let meetingError:string|undefined;
   try{meetings=secure?await meetingStore.list():[];}catch{meetingError='A saved meeting could not be read. No file was deleted.';}
   return {secure,key,meetings,meetingError};
  })());if(quitting)return;coordinator.key=restored.key;coordinator.state.keyStored=!!restored.key;coordinator.state.secureStorage=restored.secure;coordinator.state.meetings=restored.meetings;coordinator.state.meetingStorageError=restored.meetingError;startupRecord('storage-ready');
 }catch{if(quitting)return;coordinator.state.meetingStorageError='Secure storage did not respond. Saved files are unchanged. You can use Demo or connect a session-only key; quit and reopen to retry secure storage.';startupRecord('storage-unavailable');}
 finally{if(!quitting){storageLoading=false;coordinator.state.storageLoading=false;coordinator.emit();}}})();
 if(process.argv.includes('--demo'))await coordinator.start(true);
}).catch(()=>{startupRecord(`failed-${startupPhase}`);dialog.showErrorBox('Intera could not start','The desktop startup failed. A non-secret startup-status.json report is in ~/Library/Application Support/Intera. Report that file and the app/macOS versions. Your saved data was not deleted.');app.quit();});
app.on('activate',revealReader);
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(!quitting){quitting=true;eyeContact?.stop();updates?.dispose();coordinator?.dispose();}});


