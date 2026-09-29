import {app,BrowserWindow,ipcMain,session,desktopCapturer,dialog,powerMonitor,screen,Menu} from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import path from 'node:path';
import os from 'node:os';
import {readFile,writeFile} from 'node:fs/promises';
import {Store} from './store';
import {Coordinator} from './coordinator';
import {AccountClient} from './account';
import {commandSchema,type State} from '../shared/protocol';
import {BRAND,preferencesSchema,regions} from '../shared/config';
import {displayed} from '../shared/transcript';
import {visualFixture} from '../shared/visual-fixture';
if(process.argv.includes('--test-isolated')){
 const label=process.argv.find(v=>v.startsWith('--test-profile='))?.slice(15);
 app.setPath('userData',path.join(os.tmpdir(),label&&/^[a-z0-9-]{1,80}$/.test(label)?`intera-test-${label}`:`intera-test-${process.pid}`));
}
let coordinator:Coordinator;let captureHost:BrowserWindow|null=null;let compact:BrowserWindow|null=null;const views=new Set<BrowserWindow>();let quitting=false;let previous:State|undefined;
const single=!squirrelStartup&&app.requestSingleInstanceLock();if(!single)app.quit();
app.on('second-instance',()=>{const w=[...views][0];if(w){w.restore();w.focus();}});
function protect(w:BrowserWindow){w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());w.webContents.on('render-process-gone',()=>{if(w===captureHost)coordinator?.fail('Capture host stopped. Restart listening explicitly.');});}
function windowView(small=false){
 const w=new BrowserWindow({width:small?500:1100,height:small?280:760,minWidth:small?360:680,minHeight:small?220:520,title:BRAND,alwaysOnTop:small,show:!small,icon:path.join(app.getAppPath(),'assets/brand/exports/intera.ico'),backgroundColor:'#F5F3ED',titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,spellcheck:false,backgroundThrottling:false}});
 if(small)w.once('ready-to-show',()=>w.showInactive());views.add(w);protect(w);w.loadFile(path.join(__dirname,'ui/index.html'),{query:small?{compact:'1'}:{}});
 w.on('closed',()=>{views.delete(w);if(compact===w)compact=null;if(!views.size)void coordinator.stop();});return w;
}
async function makeCapture(){
 if(captureHost&&!captureHost.isDestroyed())return captureHost;
 const w=new BrowserWindow({show:false,width:32,height:32,webPreferences:{preload:path.join(__dirname,'capture-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,spellcheck:false,backgroundThrottling:false,partition:'capture'}});captureHost=w;protect(w);
 const captureSession=w.webContents.session;
 captureSession.setPermissionRequestHandler((wc,permission,callback)=>callback(wc===w.webContents&&coordinator.busy()&&(permission==='display-capture'||permission==='media')));
 captureSession.setPermissionCheckHandler((wc,permission)=>wc===w.webContents&&coordinator.busy()&&(permission==='display-capture'||permission==='media'));
 captureSession.setDisplayMediaRequestHandler(async(request,callback)=>{if(request.frame!==w.webContents.mainFrame||!coordinator.busy()){callback({});return;}try{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});if(!coordinator.busy()||!sources[0]){callback({});return;}callback({video:sources[0],audio:'loopback'});}catch{callback({});}});
 await w.loadFile(path.join(__dirname,'host.html'));return w;
}
function trusted(event:Electron.IpcMainInvokeEvent|Electron.IpcMainEvent,capture=false){const w=BrowserWindow.fromWebContents(event.sender);return !!w&&(capture?w===captureHost:views.has(w))&&event.senderFrame===event.sender.mainFrame;}
if(single)app.whenReady().then(async()=>{
 app.setName(BRAND);
 const build=JSON.parse(await readFile(path.join(__dirname,'build-info.json'),'utf8')) as {sha:string;dirty:boolean};
 app.setAboutPanelOptions({applicationName:BRAND,applicationVersion:app.getVersion(),version:`${build.sha.slice(0,12)}${build.dirty?' · working changes':''} · unsigned unless separately signed`,iconPath:path.join(app.getAppPath(),'assets/brand/exports/app-icon.png'),copyright:'Intera — internal beta. Human interpretation remains essential.'});
 Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform==='darwin'?[{role:'appMenu'},{role:'editMenu'},{role:'windowMenu'}]:[{role:'editMenu'},{role:'windowMenu'},{label:'Help',submenu:[{label:'About Intera',click:()=>app.showAboutPanel()}]}]));
 session.defaultSession.setPermissionRequestHandler((wc,p,cb)=>cb(p==='clipboard-sanitized-write'&&views.has(BrowserWindow.fromWebContents(wc)!)));session.defaultSession.setPermissionCheckHandler((wc,p)=>p==='clipboard-sanitized-write'&&!!wc&&views.has(BrowserWindow.fromWebContents(wc)!));
 const store=new Store();
 const accounts=new AccountClient();
 ipcMain.handle('billing',async(e,raw)=>{if(!trusted(e))return {ok:false,message:'Denied'};if(raw?.type==='sign-out')await coordinator.stop();return accounts.command(raw);});
 coordinator=new Coordinator({start:async(epoch,packetMs)=>{if(process.platform==='darwin'){const [major,minor]=process.getSystemVersion().split('.').map(Number);if(major<14||(major===14&&minor<2))throw new Error('Native capture requires macOS 14.2+');}const w=await makeCapture();if(coordinator.busy()&&coordinator.state.transcript.epoch===epoch)w.webContents.send('capture-command',{type:'start',epoch,packetMs});},stop:()=>{if(captureHost&&!captureHost.isDestroyed()){captureHost.destroy();captureHost=null;}}},state=>{const changes=Object.fromEntries(Object.entries(state).filter(([key,value])=>!previous||previous[key as keyof State]!==value));const patch={base:previous?.sequence??-1,sequence:state.sequence,changes};previous={...state};for(const w of views)if(!w.isDestroyed())w.webContents.send('state',patch);},store.preferences(),undefined,accounts);
 coordinator.key=await store.key();coordinator.glossary=store.glossary();coordinator.state.keyStored=!!coordinator.key;coordinator.state.secureStorage=await store.secure();
 ipcMain.handle('snapshot',e=>{if(!trusted(e))throw new Error('Denied');return coordinator.state;});
 ipcMain.on('capture-format',(e,epoch,format)=>{if(trusted(e,true))try{coordinator.format(epoch,format);}catch{coordinator.fail('Unsupported capture format.');}});
 ipcMain.handle('capture-packet',(e,epoch,position,buffer)=>{if(trusted(e,true))coordinator.packet(epoch,position,buffer);});
 ipcMain.on('capture-error',(e,epoch,code)=>{if(trusted(e,true)&&coordinator.state.transcript.epoch===epoch)coordinator.fail('Playback capture failed ('+(['NotAllowedError','InvalidStateError','NotFoundError','NotReadableError','AbortError'].includes(code)?code:'source ended')+'). Check permissions and audio device.');});
 ipcMain.handle('command',async(e,raw)=>{
  if(!trusted(e))return {ok:false,message:'Denied'};
  try{
   const c=commandSchema.parse(raw);
   switch(c.type){
    case 'start':await coordinator.start(coordinator.state.status==='paused'&&coordinator.state.demo);break;
    case 'demo':await coordinator.stop();await coordinator.clear();await coordinator.start(true);break;
    case 'local-test':await coordinator.start(false,true);break;
    case 'pause':await coordinator.stop('paused');break;
    case 'stop':await coordinator.stop();break;
    case 'clear':await coordinator.clear();break;
    case 'finish':coordinator.finalize();break;
    case 'compact':if(!compact)compact=windowView(true);else compact.showInactive();break;
    case 'hold':coordinator.state.hold=coordinator.state.hold?null:structuredClone(coordinator.state.transcript);break;
    case 'preferences':if('preferences' in c){await coordinator.preferences(c.preferences,c.timing);store.save(c.preferences);}break;
    case 'cancel-pending':if(coordinator.state.effective){coordinator.state.preferences={...coordinator.state.preferences,processing:coordinator.state.effective};store.save(coordinator.state.preferences);}coordinator.state.pending=null;break;
    case 'key':if('key' in c){if(coordinator.busy())throw new Error('Stop listening before changing credentials.');await store.setKey(c.key,c.persist);coordinator.key=c.key;coordinator.state.keyStored=true;}break;
    case 'forget-key':if(coordinator.busy())throw new Error('Stop first.');store.forget();coordinator.key='';coordinator.state.keyStored=false;break;
    case 'validate-key':{if(!coordinator.key)throw new Error('Add a key first.');const result=await fetch(`https://api${regions[coordinator.state.preferences.region]}.soniox.com/v1/models`,{headers:{Authorization:`Bearer ${coordinator.key}`},signal:AbortSignal.timeout(10000)});if(!result.ok)throw new Error(`Key validation failed (${result.status}).`);coordinator.state.message='Key accepted by models API. No audio was uploaded. Real-time access still requires account capability.';break;}
    case 'group':if('id' in c)coordinator.group(c.id,c.action,c.edit);break;
    case 'rename':if('id' in c)coordinator.state.names={...coordinator.state.names,[c.id]:c.name};break;
    case 'glossary':if('glossary' in c){if(coordinator.busy())throw new Error('Stop before changing session terminology.');coordinator.glossary=c.glossary;if(c.save)store.saveGlossary(c.glossary);}break;
    case 'export':if('format' in c){const confirm=await dialog.showMessageBox({type:'warning',buttons:['Cancel','Export'],defaultId:0,cancelId:0,message:'Export may contain sensitive conversation text. Save only to an authorized location.'});if(confirm.response!==1)break;const file=await dialog.showSaveDialog({defaultPath:`Intera-session.${c.format}`,filters:[{name:'Transcript',extensions:[c.format]}]});if(file.filePath){const groups=coordinator.state.transcript.groups;const content=c.format==='json'?JSON.stringify({version:1,demo:coordinator.state.demo,groups},null,2):groups.map(g=>{const d=displayed(g,false);return `[Connection ${g.epoch} · ${g.speaker} · ${g.language}]\n${d.source}\n${d.translation}`;}).join('\n\n');await writeFile(file.filePath,content,'utf8');}}break;
    case 'export-settings':{const file=await dialog.showSaveDialog({defaultPath:'Intera-preferences.json'});if(file.filePath)await writeFile(file.filePath,JSON.stringify(coordinator.state.preferences,null,2));break;}
    case 'import-settings':{const f=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Preferences',extensions:['json']}]});if(!f.canceled){const data=await readFile(f.filePaths[0],'utf8');if(data.length>64000)throw new Error('Import too large.');return {ok:true,preview:preferencesSchema.parse(JSON.parse(data))};}break;}
   }
   coordinator.emit();return {ok:true};
  }catch(error){return {ok:false,message:error instanceof Error&&error.name!=='ZodError'?error.message:'Invalid settings or command. Nothing was applied.'};}
 });
 powerMonitor.on('suspend',()=>void coordinator.stop('paused'));powerMonitor.on('lock-screen',()=>void coordinator.stop('paused'));
 screen.on('display-removed',()=>{if(compact){const area=screen.getPrimaryDisplay().workArea;compact.setPosition(area.x+20,area.y+20);}});
 if(process.argv.includes('--test-isolated')&&process.argv.includes('--visual-fixture')){coordinator.state.transcript=visualFixture();coordinator.state.demo=true;coordinator.state.status='stopped';coordinator.state.captureHealth='Simulated';}
 windowView();if(process.argv.includes('--demo'))await coordinator.start(true);
});
app.on('activate',()=>{if(!views.size&&coordinator)windowView();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(!quitting){quitting=true;coordinator?.dispose();}});


