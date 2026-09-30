import {autoUpdater} from 'electron';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {macUpdateFeed,type UpdateView} from '../shared/updates';
const run=promisify(execFile);
export class MacUpdates{
 view:UpdateView={status:'blocked',message:'Automatic Mac updates require a signed, notarized release and approved update channel. This beta uses manual downloads.'};
 private timer:ReturnType<typeof setInterval>|undefined;
 constructor(private publish:(view:UpdateView)=>void,private busy:()=>boolean){}
 private set(status:UpdateView['status'],message:string){this.view={status,message};this.publish(this.view);}
 async initialize(options:{packaged:boolean;platform:string;arch:string;version:string;bundlePath:string;teamId?:string;approved?:boolean}){
  if(!options.packaged||options.platform!=='darwin'||!options.approved||!options.teamId)return;
  try{await run('/usr/bin/codesign',['--verify','--deep','--strict',options.bundlePath],{timeout:10000});await run('/usr/sbin/spctl',['--assess','--type','execute',options.bundlePath],{timeout:10000});const identity=await run('/usr/bin/codesign',['--display','--verbose=4',options.bundlePath],{timeout:10000});if(!identity.stderr.includes(`TeamIdentifier=${options.teamId}\n`))throw new Error('Wrong signing team');
   autoUpdater.setFeedURL({url:macUpdateFeed(options.arch,options.version)});
   autoUpdater.on('error',()=>this.set('error','Update check failed. Your current app is unchanged; try again later.'));
   autoUpdater.on('checking-for-update',()=>this.set('checking','Checking for a signed update…'));
   autoUpdater.on('update-available',()=>this.set('downloading','Downloading update. Listening can continue; restart when your meeting is finished.'));
   autoUpdater.on('update-not-available',()=>this.set('idle','This release is up to date.'));
   autoUpdater.on('update-downloaded',()=>this.set('ready','Update ready. Save your meeting, then restart when convenient.'));
   this.set('idle','Automatic checks enabled. Updates never restart an active meeting.');if(!this.busy())this.check();this.timer=setInterval(()=>{if(!this.busy())this.check();},6*60*60*1000);this.timer.unref();
  }catch{this.set('blocked','Mac update trust checks failed. Install a verified signed release manually.');}
 }
 check(){if(this.view.status==='blocked')throw new Error(this.view.message);if(this.busy())throw new Error('Finish listening before checking for updates.');if(['checking','downloading','ready'].includes(this.view.status))return;try{autoUpdater.checkForUpdates();}catch{this.set('error','Update check failed. Try again later.');}}
 install(){if(this.busy()||this.view.status!=='ready')throw new Error('Finish your meeting before restarting to install.');autoUpdater.quitAndInstall();}
 dispose(){if(this.timer)clearInterval(this.timer);}
}
