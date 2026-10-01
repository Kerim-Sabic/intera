import {app} from 'electron';
import path from 'node:path';
import {access} from 'node:fs/promises';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {gazeSupported,gazeEventSchema,type EyeContactView,type GazeSettings} from '../shared/eye-contact';
export class EyeContact{
 view:EyeContactView={supported:gazeSupported(process.platform,process.platform==='darwin'&&typeof process.getSystemVersion==='function'?process.getSystemVersion():''),installed:false,checked:false,status:'off',message:'Checking integrated camera readiness.'};
 private child:ChildProcessWithoutNullStreams|undefined;
 private timer:ReturnType<typeof setInterval>|undefined;
 private deadline:ReturnType<typeof setTimeout>|undefined;
 private starting=false;private pending=false;private buffer='';private generation=0;
 // Development-only override; the renderer cannot supply executables or paths.
 private executable=app.isPackaged?path.join(process.resourcesPath,'camera-runtime','intera-camera'):process.env.INTERA_GAZE_PYTHON;
 constructor(private publish:(view:EyeContactView)=>void,private preview:(frame:string)=>void){}
 private update(status:EyeContactView['status'],message:string){this.view={...this.view,status,message};this.publish(this.view);}
 async check(){let installed=false;if(this.view.supported&&this.executable)try{await access(this.executable);installed=true;}catch{/* Missing runtime stays unavailable. */}
  this.view={...this.view,checked:true,installed};if(!this.child)this.update('off',!this.view.supported?'Integrated eye contact targets macOS 14 or later.':installed?'Development engine available. Start preview to validate models and camera. Zoom output is not available yet.':'Integrated engine is not packaged yet. Model licensing and the signed Zoom camera extension remain pending.');}
 async start(settings:GazeSettings){if(this.child||this.starting)return;this.starting=true;try{await this.begin(settings);}finally{this.starting=false;}}
 private async begin(settings:GazeSettings){await this.check();if(!this.view.supported||!this.view.installed||!this.executable)throw new Error(this.view.message);
  const generation=++this.generation;this.update('starting','Validating models before opening your camera…');
  const args=app.isPackaged?[]:['-u',path.join(app.getAppPath(),'camera','worker.py')];
  const child=spawn(this.executable,args,{cwd:path.join(app.getAppPath(),'camera'),stdio:'pipe',windowsHide:true,env:{...process.env,INTERA_CAMERA_DATA:path.join(app.getPath('userData'),'camera'),TF_CPP_MIN_LOG_LEVEL:'3'}});this.child=child;this.buffer='';this.pending=false;
  const fail=()=>{if(generation!==this.generation)return;this.stop();this.update('error','Camera engine could not start or stopped. No corrected output is active.');};
  child.on('error',fail);child.on('exit',()=>{if(generation===this.generation)fail();});child.stderr.on('data',()=>{/* No webcam/model logs are persisted or forwarded. */});
  child.stdout.on('data',(chunk:Buffer)=>{if(generation!==this.generation)return;this.buffer+=chunk.toString('utf8');if(this.buffer.length>800000){fail();return;}let index:number;while((index=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,index);this.buffer=this.buffer.slice(index+1);let raw:unknown;try{raw=JSON.parse(line);}catch{fail();return;}const result=gazeEventSchema.safeParse(raw);if(!result.success){fail();return;}const event=result.data;if(event.type==='ready'){if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;this.update('preview','Local camera preview active. Zoom camera output is not installed.');this.configure(settings);this.timer=setInterval(()=>{if(!this.pending&&this.child===child){this.pending=true;this.deadline=setTimeout(fail,10000);child.stdin.write('{"type":"frame"}\n');}},200);}else if(event.type==='frame'){if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;this.pending=false;this.preview(event.jpeg);}else{this.stop();this.update('error',event.code==='models'?'Approved model files are missing or invalid. Camera was not opened.':event.code==='camera'?'Camera unavailable. Check macOS camera access and other apps.':'Correction engine failed. Preview stopped.');return;}}});
  child.stdin.on('error',fail);child.stdin.write(JSON.stringify(settings)+'\n');this.deadline=setTimeout(fail,30000);
 }
 configure(settings:GazeSettings){this.child?.stdin.write(JSON.stringify({type:'configure',...settings})+'\n');}
 stop(){++this.generation;if(this.timer)clearInterval(this.timer);if(this.deadline)clearTimeout(this.deadline);this.timer=undefined;this.deadline=undefined;const child=this.child;this.child=undefined;this.pending=false;this.buffer='';this.preview('');if(child){child.stdin.end('{"type":"stop"}\n');const timeout=setTimeout(()=>child.kill('SIGKILL'),2000);child.once('exit',()=>clearTimeout(timeout));child.kill('SIGTERM');}this.update('off','Camera off. No preview frames are saved or uploaded.');}
}
