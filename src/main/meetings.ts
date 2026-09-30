import {mkdir,readFile,writeFile,rename,readdir,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {meetingSchema,type Meeting,type MeetingSummary} from '../shared/meetings';
export interface MeetingCrypto{available:()=>Promise<boolean>;encrypt:(text:string)=>Promise<Buffer>;decrypt:(bytes:Buffer)=>Promise<string>}
export class MeetingStore{
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private directory:string,private crypto:MeetingCrypto){}
 private file(id:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Invalid meeting ID');return path.join(this.directory,id+'.bin');}
 private async ready(){if(!await this.crypto.available())throw new Error('Secure device storage is unavailable. Meetings cannot be stored on this device.');await mkdir(this.directory,{recursive:true,mode:0o700});}
 async list():Promise<MeetingSummary[]>{await this.ready();const result:MeetingSummary[]=[];const files=await readdir(this.directory);for(const file of files.filter(f=>f.endsWith('.bin')).slice(0,100)){const meeting=await this.get(file.slice(0,-4));result.push({id:meeting.id,title:meeting.title,savedAt:meeting.savedAt,demo:meeting.demo,turns:meeting.transcript.groups.length});}return result.sort((a,b)=>b.savedAt.localeCompare(a.savedAt));}
 async get(id:string):Promise<Meeting>{await this.ready();const file=this.file(id);if((await stat(file)).size>16_000_000)throw new Error('Saved meeting exceeds the size limit');const data=await this.crypto.decrypt(await readFile(file));if(Buffer.byteLength(data)>8_000_000)throw new Error('Saved meeting exceeds the size limit');const meeting=meetingSchema.parse(JSON.parse(data));if(meeting.id!==id)throw new Error('Meeting identity mismatch');return meeting;}
 save(input:Omit<Meeting,'version'|'id'|'savedAt'>):Promise<Meeting>{const save=async()=>{await this.ready();if((await readdir(this.directory)).filter(f=>f.endsWith('.bin')).length>=100)throw new Error('Meeting library is full. Delete an old meeting first.');const meeting=meetingSchema.parse({...input,version:1,id:randomUUID(),savedAt:new Date().toISOString()});const text=JSON.stringify(meeting);if(Buffer.byteLength(text)>8_000_000)throw new Error('Meeting is too large to save');const file=this.file(meeting.id);const bytes=await this.crypto.encrypt(text);await writeFile(file+'.tmp',bytes,{mode:0o600});await rename(file+'.tmp',file);return meeting;};const result=this.queue.then(save);this.queue=result.catch(()=>{});return result;}
 async delete(id:string){await this.ready();await unlink(this.file(id));}
}
