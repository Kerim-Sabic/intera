import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('capture',{
 onCommand:(cb:(cmd:unknown)=>void)=>ipcRenderer.on('capture-command',(_e,cmd)=>cb(cmd)),
 format:(epoch:number,format:unknown)=>ipcRenderer.send('capture-format',epoch,format),
 packet:(epoch:number,position:number,buffer:ArrayBuffer)=>ipcRenderer.invoke('capture-packet',epoch,position,buffer),
 error:(epoch:number,message:string)=>ipcRenderer.send('capture-error',epoch,message)
});
