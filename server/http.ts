import { createServer, type IncomingMessage } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './db';
import { offerSchema } from './catalog';
import type { BillingService } from './billing';
import type {StreamingService} from './streaming';
import {VipDenied,type VipService} from './vip';

export type Authenticate = (authorization:string|undefined)=>Promise<string>;
export function supabaseAuthenticator(db:Database,url:string,publishableKey:string):Authenticate {
  const supabase=createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  return async authorization=>{
    if(!authorization?.startsWith('Bearer '))throw new Error('Sign in required.');
    const token=authorization.slice(7);
    const {data,error}=await supabase.auth.getUser(token);
    if(error || !data.user?.email_confirmed_at)throw new Error('Verified account required.');
    // getUser validates the token first. Session presence also closes the logout/deletion JWT window.
    const claims=z.object({session_id:z.uuid(),sub:z.uuid()}).parse(JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()));
    if(claims.sub!==data.user.id)throw new Error('Invalid session.');
    const session=await db.query('select private.session_is_active($1,$2) as active',[claims.session_id,data.user.id]);
    if(session.rows[0]?.active!==true)throw new Error('Session expired.');
    return data.user.id;
  };
}
async function body(req:IncomingMessage,max=64_000) {
  let size=0;const chunks:Buffer[]=[];
  for await(const chunk of req){size+=chunk.length;if(size>max)throw new Error('Request too large.');chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
}
export function billingServer(service:BillingService,authenticate:Authenticate,streaming?:StreamingService,vip?:VipService) {
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const send=(status:number,value:unknown)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    const route=req.url?.split('?')[0];
    try{
      if(route==='/health' && req.method==='GET')return send(200,{ok:true});
      if(route==='/webhooks/whop' && req.method==='POST'){
        const raw=await body(req,1_000_000);
        const headers=Object.fromEntries(Object.entries(req.headers).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
        try{await service.acceptWebhook(raw,headers);}catch{return send(400,{error:'Webhook rejected.'});}
        return send(200,{received:true});
      }
      let userId:string;
      try{userId=await authenticate(req.headers.authorization);}catch{return send(401,{error:'Sign in with a verified account.'});}
      const account=await service.account(userId);
      if(route==='/account/setup'&&req.method==='POST'&&vip){
        const input=z.object({invite:z.string().min(1).max(128).optional()}).strict().parse(JSON.parse(await body(req,1024)));
        if(input.invite)return send(200,await vip.redeem(account.id,input.invite));
        await vip.completeSetup(account.id);return send(200,{completed:true});
      }
      if(route?.startsWith('/vip/')&&vip){
        await vip.requireVip(account.id);
        if(route==='/vip/status'&&req.method==='GET')return send(200,await vip.summary(account.id));
        if(route==='/vip/checkout'&&req.method==='POST'){
          const p=z.object({amount:z.enum(['11','22','55','110']),requestId:z.uuid()}).strict().parse(JSON.parse(await body(req,1024)));
          return send(200,await vip.checkout(account.id,p.amount,p.requestId));
        }
        if(route==='/vip/funding-mode'&&req.method==='POST'){
          const p=z.object({mode:z.enum(['allowance','vip'])}).strict().parse(JSON.parse(await body(req,1024)));
          return send(200,await vip.selectMode(account.id,p.mode));
        }
        if(route==='/vip/auto-topup'&&req.method==='POST'){
          z.object({enabled:z.literal(false)}).strict().parse(JSON.parse(await body(req,1024)));
          return send(200,await vip.disableAuto(account.id));
        }
      }
      if(route==='/operator/vip'&&vip){
        if(req.method==='GET')return send(200,await vip.operatorHealth(userId));
        if(req.method==='POST'){const p=z.object({accountId:z.uuid(),action:z.enum(['grant','revoke'])}).strict().parse(JSON.parse(await body(req,1024)));return send(200,await vip.operator(userId,p.accountId,p.action));}
      }
      if(route==='/stream/status'&&req.method==='GET'&&streaming)return send(200,await streaming.status(account.id));
      if(route==='/stream/admit'&&req.method==='POST'&&streaming){
        const input=z.object({requestId:z.uuid(),fundingMode:z.enum(['allowance','vip']).optional()}).strict().parse(JSON.parse(await body(req)));
        return send(200,await streaming.admit(account.id,input.requestId,input.fundingMode??'allowance'));
      }
      if(route==='/stream/end'&&req.method==='POST'&&streaming){
        const input=z.object({leaseId:z.uuid()}).strict().parse(JSON.parse(await body(req)));
        return send(200,await streaming.endIntent(account.id,input.leaseId));
      }
      if(route==='/billing' && req.method==='GET'){
        await service.refreshAccount(account.id);const billing=await service.status(account.id);
        const usage=streaming?await streaming.status(account.id):undefined;
        return send(200,{...billing,...(usage?{managedStreamingAvailable:usage.managedStreamingAvailable,remainingMs:usage.availableMs,usage}:{}),
          ...(vip?{initialSetupAvailable:await vip.setupAvailable(account.id),vip:await vip.summary(account.id)}:{})});
      }
      if(route==='/billing/checkout' && req.method==='POST'){
        const input=z.object({offer:offerSchema,requestId:z.uuid()}).strict().parse(JSON.parse(await body(req)));
        return send(200,await service.checkout(account.id,input.offer,input.requestId));
      }
      if(route==='/billing/portal' && req.method==='POST'){
        const input=z.object({membershipId:z.string().regex(/^mem_[a-zA-Z0-9]+$/)}).strict().parse(JSON.parse(await body(req)));
        return send(200,await service.portal(account.id,input.membershipId));
      }
      return send(404,{error:'Not found.'});
    }catch(error){
      if(error instanceof VipDenied)return send(403,{error:error.message});
      const invalid=error instanceof z.ZodError || error instanceof SyntaxError;
      // Avoid returning provider payloads, tokens, SQL errors, or medical information.
      return send(invalid?400:503,{error:invalid?'Invalid request.':'Billing is unavailable or the request needs review. Please refresh before retrying.'});
    }
  });
}
