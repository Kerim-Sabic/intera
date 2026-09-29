import {beforeEach,afterEach,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import type {Database} from '../server/db';
import {VipService} from '../server/vip';
import {VipTreasury} from '../server/vip-treasury';
import {vipConfiguration} from '../server/vip-config';
import {vipCharge,usd,decimal} from '../server/vip-money';
import type {Provider,Payment} from '../server/whop';
import type {BillingConfig} from '../server/catalog';
import {StreamingService} from '../server/streaming';
import {grant,balances} from '../server/ledger';
let pg:PGlite,db:Database,vip:VipService,stream:StreamingService,account:string,now:Date,invite:string,issued:number;
const config:BillingConfig={environment:'sandbox',companyId:'biz_fixture',apiKey:'fixture-api',webhookSecret:'ws_fixture_not_real_secret',plans:{essential:'plan_e',professional:'plan_p',intensive:'plan_i',extra:'plan_x'},returnUrl:'https://example.com/return',salesEnabled:true,taxArrangement:'whop_collects_and_remits',taxBehavior:'exclusive'};
beforeEach(async()=>{
 pg=new PGlite();await pg.exec('create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);');
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await pg.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 db={query:(s,v)=>pg.query(s,v),transaction:f=>pg.transaction(t=>f({query:(s,v)=>t.query(s,v)}))};
 now=new Date();account=randomUUID();const user=randomUUID();invite=randomUUID();issued=0;
 await db.query('insert into auth.users values($1)',[user]);await db.query('insert into private.billing_accounts(id,auth_user_id,created_at) values($1,$2,$3)',[account,user,now.toISOString()]);
 const provider:Provider={checkout:async()=>({id:'ch_regular',url:'https://sandbox.whop.com/checkout/regular'}),checkoutCredit:async()=>({id:'ch_vip',url:'https://sandbox.whop.com/checkout/vip'}),payment:async()=>{throw Error('not used');},membership:async()=>{throw Error('not used');},payments:async function*(){},eventPayment:async()=>'',retireCheckout:async()=>{}};
 const v=vipConfiguration({VIP_INVITATION_ENABLED:'true',VIP_INVITE_SHA256:createHash('sha256').update(invite).digest('hex'),VIP_INVITE_GENERATION:'fixture',VIP_TOPUPS_ENABLED:'true',VIP_SESSIONS_ENABLED:'true',VIP_PROVIDER_FUNDING_KILL_SWITCH:'false',WHOP_VIP_PLAN_22:'plan_vip'});
 const treasury=new VipTreasury(db,v,{environment:'sandbox',companyId:'biz_fixture',projectRef:'project-fixture',region:'us'},()=>now);
 vip=new VipService(db,provider,config,v,treasury,()=>now);
 stream=new StreamingService(db,{check:async()=>{},issue:async()=>{issued++;return {api_key:'temporary-fixture',expires_at:new Date(now.getTime()+30000).toISOString()};},logs:async()=>({usage_logs:[],next_page_cursor:null})},{enabled:true,region:'us',projectRef:'project-fixture',key:'fixture',accounts:new Set([account]),maxSeconds:1800},()=>now);stream.vip=vip;await stream.initialize();
},60000);
afterEach(async()=>{await pg.close();});
async function paid(){
 await vip.redeem(account,invite);const id=randomUUID();await vip.checkout(account,'22',id);
 const p:Payment={id:'pay_fixture',company:{id:'biz_fixture'},plan:{id:'plan_vip'},membership:null,user:{id:'user_fixture'},metadata:{intera_vip_intent_id:id,intera_billing_account_id:account,intera_environment:'sandbox'},checkout_configuration_id:'ch_vip',status:'paid',substatus:'succeeded',currency:'usd',subtotal:2200,total:2200,tax_amount:0,refunded_amount:0,tax_refunded_amount:0,paid_at:now.toISOString(),created_at:now.toISOString(),billing_reason:'one_time',disputes:[]};
 await vip.reconcilePayment(p);return p;
}
async function capacity(){
 const id=randomUUID();await db.query("insert into private.vip_provider_funding(id,external_id,amount_usd,state,created_at,confirmed_at,evidence_ref) values($1,'fund_fixture',20,'confirmed',$2,$2,'fixture')",[id,now.toISOString()]);
 await db.query('insert into private.vip_funding_allocations values($1,\'pay_fixture\',20)',[id]);
 await db.query(`insert into private.vip_treasury_observations values($1,$2,$3,'operator_observed','sandbox','biz_fixture','project-fixture','us',20,0,0,'off','fixture')`,[randomUUID(),now.toISOString(),new Date(now.getTime()+60000).toISOString()]);
}
const usage=(lease:string,cost='0.8462')=>({uuid:randomUUID(),request_scope:'api' as const,client_reference_id:lease,model:'stt-rt-v5',start_time:new Date(now.getTime()+1000).toISOString(),end_time:new Date(now.getTime()+60000).toISOString(),input_audio_duration_ms:59000,cost_usd:cost});
it.each(['0.000001','0.01','0.8462','1','10'])('preserves exact API cost plus ten percent for %s',cost=>{const c=vipCharge(cost);expect(usd(c.total)*10n).toBe(usd(cost)*11n);});
it('sums tiny requests without cent rounding',()=>{const total=Array.from({length:1000},()=>usd(vipCharge('0.000001').total)).reduce((a,b)=>a+b,0n);expect(decimal(total)).toBe('0.00110000000000');expect(vipCharge('0.8462')).toMatchObject({fee:'0.08462000000000',total:'0.93082000000000'});expect(()=>vipCharge('-1')).toThrow();});
it('limits invite retries, never stores submitted codes, and denies non-VIP access',async()=>{
 expect(await vip.summary(account)).toBeUndefined();await expect(vip.checkout(account,'22',randomUUID())).rejects.toThrow('VIP');
 for(let n=0;n<5;n++)await expect(vip.redeem(account,'wrong-fixture')).rejects.toThrow();await expect(vip.redeem(account,invite)).rejects.toThrow();
 expect((await db.query('select * from private.vip_invite_attempts')).rows).toHaveLength(5);
 expect(JSON.stringify((await db.query('select * from private.vip_invite_attempts')).rows)).not.toContain('wrong-fixture');
});
it('closes invitation after setup and preserves regular allowance on VIP grant',async()=>{
 await grant(db,{accountId:account,key:'regular',kind:'extra',milliseconds:72000000});await vip.redeem(account,invite);
 expect((await balances(db,account,now.toISOString()))[0].remainingMs).toBe(72000000);await expect(vip.redeem(account,invite)).rejects.toThrow();
});
it('deduplicates canonical topups and keeps full face value independent of capacity',async()=>{
 const p=await paid();await vip.reconcilePayment(p);expect(await vip.summary(account)).toMatchObject({availableUsd:'22.00000000000000',managedReady:false});
 await expect(stream.admit(account,randomUUID(),'vip')).rejects.toThrow('capacity');expect(issued).toBe(0);expect((await db.query('select * from private.vip_grants')).rows).toHaveLength(1);
});
it('reserves bounded credit, retains it after Stop, and settles once without consuming hours',async()=>{
 await paid();await capacity();await grant(db,{accountId:account,key:'regular',kind:'extra',milliseconds:72000000});
 const id=randomUUID(),a=await stream.admit(account,id,'vip');expect(await vip.summary(account)).toMatchObject({availableUsd:'20.90000000000000',reservedUsd:'1.10000000000000'});
 await expect(stream.admit(account,id,'allowance')).rejects.toThrow('immutable');await stream.endIntent(account,a.leaseId);
 expect((await vip.summary(account))?.finalizing).toBe(true);const record=usage(a.leaseId);await stream.settle(record);await stream.settle(record);
 expect(await vip.summary(account)).toMatchObject({availableUsd:'21.06918000000000',reservedUsd:'0.00000000000000',finalizing:false});
 expect((await balances(db,account,now.toISOString()))[0].remainingMs).toBe(72000000);expect((await db.query('select * from private.vip_settlements')).rows).toHaveLength(1);
});
it('quarantines cost overrun without a postpaid debit or releasing unresolved funds',async()=>{
 await paid();await capacity();const a=await stream.admit(account,randomUUID(),'vip');await stream.settle(usage(a.leaseId,'10'));
 expect(await vip.summary(account)).toMatchObject({reviewRequired:true,availableUsd:'20.90000000000000',reservedUsd:'1.10000000000000'});
 expect((await db.query("select * from private.vip_entries where kind='usage'")).rows).toHaveLength(0);
});
it('reverses unused refunded credit but freezes refunds during unresolved usage',async()=>{
 const p=await paid();await vip.reconcilePayment({...p,refunded_amount:1100});expect((await vip.summary(account))?.availableUsd).toBe('11.00000000000000');
 await capacity();await stream.admit(account,randomUUID(),'vip');await vip.reconcilePayment({...p,refunded_amount:2200});expect((await vip.summary(account))?.reviewRequired).toBe(true);
});
it('retains financial history and blocks future use after revocation',async()=>{
 await paid();const actor=randomUUID();vip.config.operators.add(actor);await vip.operator(actor,account,'revoke');
 await expect(vip.checkout(account,'22',randomUUID())).rejects.toThrow();expect(await vip.summary(account)).toMatchObject({status:'revoked',availableUsd:'22.00000000000000'});
});
