import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {MeetingStore,type MeetingCrypto} from '../src/main/meetings';
import {visualFixture} from '../src/shared/visual-fixture';
async function clean(dir:string){if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('intera-meetings-'))throw new Error('Unexpected test cleanup path');await rm(dir,{recursive:true,force:true});}
describe('encrypted local meeting persistence',()=>{
 it('round-trips revisions without plaintext files, rejects tampering and traversal, and deletes only the selected meeting',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'intera-meetings-')),key=randomBytes(32);
  const crypto:MeetingCrypto={available:async()=>true,encrypt:async text=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const ciphertext=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]);},decrypt:async bytes=>{const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');}};
  try{const store=new MeetingStore(dir,crypto),transcript=visualFixture();const saved=await store.save({title:'Synthetic meeting',demo:true,names:{},transcript});
   expect((await store.get(saved.id)).transcript.groups).toEqual(transcript.groups);expect(await store.list()).toMatchObject([{id:saved.id,title:'Synthetic meeting',demo:true,turns:12}]);
   const bytes=await readFile(path.join(dir,saved.id+'.bin'));expect(bytes.toString()).not.toContain('Synthetic meeting');expect(bytes.toString()).not.toContain(transcript.groups[0].source);
   await expect(store.delete('../outside')).rejects.toThrow('Invalid meeting ID');
   const second=await store.save({title:'Second',demo:false,names:{},transcript});const file=path.join(dir,second.id+'.bin');const tampered=await readFile(file);tampered[35]^=1;await writeFile(file,tampered);await expect(store.get(second.id)).rejects.toThrow();
   await store.delete(saved.id);expect(await readdir(dir)).toEqual([second.id+'.bin']);
  }finally{await clean(dir);}
 });
 it('does not fall back to plaintext when secure storage is unavailable',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'intera-meetings-'));try{const store=new MeetingStore(dir,{available:async()=>false,encrypt:async()=>Buffer.alloc(0),decrypt:async()=>''});await expect(store.save({title:'Synthetic',demo:true,names:{},transcript:visualFixture()})).rejects.toThrow('Secure device storage');expect(await readdir(dir)).toEqual([]);}finally{await clean(dir);}
 });
});
