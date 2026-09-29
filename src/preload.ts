import {contextBridge,ipcRenderer} from 'electron';
import type {Bridge,State} from './shared/protocol';
let cached:State|undefined;
async function snapshot(){const state:State=await ipcRenderer.invoke('snapshot');if(!cached||state.sequence>=cached.sequence)cached=state;return cached;}
const api:Bridge={snapshot,command:cmd=>ipcRenderer.invoke('command',cmd),subscribe:cb=>{const fn=async(_e:unknown,patch:{base:number;sequence:number;changes:Partial<State>})=>{if(cached&&patch.sequence<=cached.sequence)return;if(!cached||cached.sequence!==patch.base){cb(await snapshot());return;}cached={...cached,...patch.changes,sequence:patch.sequence};cb(cached);};ipcRenderer.on('state',fn);return()=>ipcRenderer.removeListener('state',fn);}};
contextBridge.exposeInMainWorld('intera',api);
