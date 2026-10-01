import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('capture',{
 onCommand:(cb:(cmd:unknown)=>void)=>ipcRenderer.on('capture-command',(_e,cmd)=>cb(cmd)),
 format:(epoch:number,format:unknown)=>ipcRenderer.send('capture-format',epoch,format),
 packet:(epoch:number,position:number,buffer:ArrayBuffer)=>ipcRenderer.invoke('capture-packet',epoch,position,buffer),
 diagnostic:(epoch:number,stage:string)=>ipcRenderer.send('capture-diagnostic',epoch,{stage}),
 error:(epoch:number,code:string,stage:string)=>ipcRenderer.send('capture-error',epoch,code,stage)
});
