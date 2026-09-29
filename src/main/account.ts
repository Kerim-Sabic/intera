import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {app,safeStorage,shell} from 'electron';
import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {billingCommand,billingSummary,type BillingView,type BillingReply} from '../shared/billing';

export class AccountClient {
  private auth:SupabaseClient|null=null;
  private backend:string|null=null;
  private lastCode=0;
  private checkoutRequests=new Map<string,string>();
  private storageQueue:Promise<unknown>=Promise.resolve();
  constructor(){
    // Public deployment configuration only. Company keys are never read by this module.
    const backend=process.env.INTERA_BILLING_URL,url=process.env.INTERA_SUPABASE_URL,key=process.env.INTERA_SUPABASE_PUBLISHABLE_KEY;
    if(!backend || !url || !key)return;
    try{if(new URL(backend).protocol!=='https:' || new URL(url).protocol!=='https:')return;
      this.backend=new URL(backend).origin;}catch{return;}
    const file=path.join(app.getPath('userData'),'account-session.bin');
    const load=async():Promise<Record<string,string>>=>{
      try{if(!await safeStorage.isAsyncEncryptionAvailable())return {};
        return JSON.parse((await safeStorage.decryptStringAsync(await readFile(file))).result);}catch{return {};}
    };
    const update=(mutate:(values:Record<string,string>)=>void)=>{
      const action=this.storageQueue.then(async()=>{
        if(!await safeStorage.isAsyncEncryptionAvailable())throw new Error('Secure account storage is unavailable.');
        const values=await load();mutate(values);
        if(!Object.keys(values).length){await rm(file,{force:true});return;}
        await writeFile(file+'.tmp',await safeStorage.encryptStringAsync(JSON.stringify(values)),{mode:0o600});await rename(file+'.tmp',file);
      });
      this.storageQueue=action.catch(()=>undefined);return action;
    };
    const storage={
      getItem:async(key:string)=>{await this.storageQueue;return (await load())[key]??null;},
      setItem:(key:string,value:string)=>update(values=>{values[key]=value;}),
      removeItem:(key:string)=>update(values=>{delete values[key];}),
    };
    this.auth=createClient(url,key,{auth:{storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  }
  private async api(route:string,body?:unknown){
    const session=await this.auth!.auth.getSession();
    if(!session.data.session)throw new Error('Sign in first.');
    const response=await fetch(this.backend+route,{method:body?'POST':'GET',redirect:'error',
      headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20_000)});
    if(!response.ok)throw new Error(response.status===401?'Sign in again.':'Billing could not be refreshed. No purchase or allowance was confirmed.');
    return response.json();
  }
  private async view():Promise<BillingView>{
    if(!this.auth)return {configured:false};
    const {data}=await this.auth.auth.getSession();
    if(!data.session)return {configured:true};
    const summary=billingSummary.parse(await this.api('/billing'));
    for(const offer of this.checkoutRequests.keys())if(!summary.pendingCheckoutOffers.includes(offer))this.checkoutRequests.delete(offer);
    return {configured:true,email:data.session.user.email,summary};
  }
  async command(raw:unknown):Promise<BillingReply>{
    try{
      const c=billingCommand.parse(raw);
      if(c.type==='status')return {ok:true,view:await this.view()};
      if(!this.auth)throw new Error('Account service is not configured for this build.');
      if(c.type==='send-code'){
        if(Date.now()-this.lastCode<60_000)throw new Error('Wait one minute before requesting another code.');
        this.lastCode=Date.now();const result=await this.auth.auth.signInWithOtp({email:c.email});
        if(result.error)throw new Error('Unable to send a sign-in code. Try again later.');
        return {ok:true,message:'Check your email for the sign-in code.'};
      }
      if(c.type==='verify-code'){
        const result=await this.auth.auth.verifyOtp({email:c.email,token:c.code,type:'email'});
        if(result.error)throw new Error('The code is invalid or expired.');
      }
      if(c.type==='sign-out'){
        const result=await this.auth.auth.signOut({scope:'local'});
        if(result.error)throw new Error('Sign-out could not be confirmed. Try again when online.');
        this.checkoutRequests.clear();
      }
      if(c.type==='checkout' || c.type==='portal'){
        let payload:unknown;
        if(c.type==='checkout'){
          let requestId=this.checkoutRequests.get(c.offer);
          if(!requestId){requestId=randomUUID();this.checkoutRequests.set(c.offer,requestId);}
          payload={offer:c.offer,requestId};
        }else payload={membershipId:c.membershipId};
        const result=await this.api(c.type==='checkout'?'/billing/checkout':'/billing/portal',payload);
        const url=new URL(result.url);
        if(url.protocol!=='https:' || !['whop.com','sandbox.whop.com'].includes(url.hostname) || url.username || url.password || url.port)
          throw new Error('Billing returned an untrusted destination.');
        await shell.openExternal(url.href);
        return {ok:true,message:'Opened in your browser. Return here and refresh after completing your action.'};
      }
      return {ok:true,view:await this.view()};
    }catch(error){return {ok:false,message:error instanceof Error && error.name!=='ZodError'?error.message:'Invalid account request.'};}
  }
}
