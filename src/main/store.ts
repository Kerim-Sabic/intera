import {app,safeStorage} from 'electron';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import path from 'node:path';
import {defaults,preferencesSchema,glossarySchema,emptyGlossary,type Preferences,type Glossary} from '../shared/config';
export class Store{
 private file(name:string){return path.join(app.getPath('userData'),name);}
 private write(name:string,data:string|Buffer){const target=this.file(name);writeFileSync(target+'.tmp',data,{mode:0o600});renameSync(target+'.tmp',target);}
 preferences():Preferences{try{return preferencesSchema.parse(JSON.parse(readFileSync(this.file('preferences.json'),'utf8')));}catch{return structuredClone(defaults);}}
 save(p:Preferences){this.write('preferences.json',JSON.stringify(preferencesSchema.parse(p)));}
 windowOptions(){try{const data=JSON.parse(readFileSync(this.file('window-options.json'),'utf8'));if(typeof data.floating!=='boolean'||typeof data.protection!=='boolean')throw new Error('Invalid options');return {floating:data.floating as boolean,protection:data.protection as boolean};}catch{return {floating:true,protection:false};}}
 saveWindowOptions(options:{floating:boolean;protection:boolean}){this.write('window-options.json',JSON.stringify(options));}
 glossary():Glossary{try{return glossarySchema.parse(JSON.parse(readFileSync(this.file('generic-glossary.json'),'utf8')));}catch{return emptyGlossary;}}
 saveGlossary(g:Glossary){this.write('generic-glossary.json',JSON.stringify(glossarySchema.parse(g)));}
 async secure(){return process.platform!=='linux' && await safeStorage.isAsyncEncryptionAvailable();}
 async key():Promise<string>{try{if(!await this.secure())return '';const decrypted=await safeStorage.decryptStringAsync(readFileSync(this.file('credential.bin')));if(decrypted.shouldReEncrypt)this.write('credential.bin',await safeStorage.encryptStringAsync(decrypted.result));return decrypted.result;}catch{return '';}}
 async setKey(key:string,persist:boolean){if(persist){if(!await this.secure())throw new Error('Secure storage unavailable. Use session-only storage.');const encrypted=await safeStorage.encryptStringAsync(key);this.write('credential.bin',encrypted);}else this.forget();}
 forget(){if(existsSync(this.file('credential.bin')))unlinkSync(this.file('credential.bin'));}
}
