import {app} from 'electron';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
const codesign=(args:string[])=>new Promise<{stdout:string;stderr:string}>((resolve,reject)=>execFile('/usr/bin/codesign',args,{encoding:'utf8',timeout:10000},(error,stdout,stderr)=>error?reject(error):resolve({stdout,stderr})));
type NativeCamera={activate:()=>boolean;state:()=>string;start:()=>boolean;submit:(jpeg:Buffer)=>boolean;stop:()=>boolean};
export class CameraExtension{
 private native:NativeCamera|undefined;
 available=false;output=false;
 private checking:Promise<void>|undefined;
 check(){return this.checking??=this.inspect();}
 private async inspect(){
  if(process.platform!=='darwin'||!app.isPackaged)return;
  const addon=path.join(process.resourcesPath,'camera-runtime','intera-camera.node');
  const application=path.resolve(process.resourcesPath,'../..');
  const extension=path.join(application,'Contents','Library','SystemExtensions','com.intera.camera-extension.systemextension');
  try{
   // Trust is established from installed signatures, never a renderer checkbox.
   let team='';for(const file of [application,extension,addon]){
    await codesign(['--verify','--strict',file]);
    const result=await codesign(['-d','--verbose=4',file]);
    const found=/^TeamIdentifier=([A-Z0-9]{10})$/m.exec(result.stderr)?.[1];
    if(!found||(team&&found!==team))return;team=found;
   }
   const native=createRequire(__filename)(addon) as NativeCamera;
   if(!['activate','state','start','submit','stop'].every(key=>typeof native[key as keyof NativeCamera]==='function'))return;
   this.native=native;this.available=true;
  }catch{return;}
 }
 state(){return this.native?.state()??'unavailable';}
 activate(){if(!this.native)throw new Error('Signed Intera camera extension is not installed.');return this.native.activate();}
 start(){this.output=!!this.native?.start();return this.output;}
 frame(jpeg:string){if(this.output&&!this.native?.submit(Buffer.from(jpeg,'base64'))){this.stop();throw new Error('Virtual camera could not accept a frame. Output stopped.');}}
 stop(){this.output=false;this.native?.stop();}
}
