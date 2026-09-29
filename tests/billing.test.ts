import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {randomUUID,createHmac} from 'node:crypto';
import {BillingService} from '../server/billing';
import {type Database,billingLock} from '../server/db';
import {consume} from '../server/ledger';
import {cents,configuration,hostedUrl,type BillingConfig} from '../server/catalog';
import {verifyEvent,WhopProvider,type Payment,type Membership,type Provider} from '../server/whop';
import {billingServer} from '../server/http';

const config:BillingConfig={environment:'sandbox',companyId:'biz_intera',apiKey:'not-a-real-api-key',
  webhookSecret:'ws_test_secret_that_never_leaves_local_tests',plans:{essential:'plan_essential',professional:'plan_professional',intensive:'plan_intensive',extra:'plan_extra'},
  returnUrl:'https://intera.example/return',salesEnabled:true,taxArrangement:'whop_collects_and_remits',taxBehavior:'exclusive'};
const start='2026-09-01T00:00:00.000Z',end='2026-10-01T00:00:00.000Z';
class FakeWhop implements Provider {
  records=new Map<string,Payment>();members=new Map<string,Membership>();checkouts=0;fail=false;
  async checkout(){if(this.fail)throw new Error('offline');return {id:`ch_${++this.checkouts}`,url:`https://sandbox.whop.com/checkout/ch_${this.checkouts}/`};}
  async payment(id:string){if(this.fail)throw new Error('offline');return structuredClone(this.records.get(id)!);}
  async membership(id:string){if(this.fail)throw new Error('offline');return structuredClone(this.members.get(id)!);}
  async *payments(id?:string){for(const p of this.records.values())if(!id || p.membership?.id===id)yield p.id;}
  async eventPayment(){return 'pay_first';}
  async retireCheckout(){}
}
let pg:PGlite,db:Database,service:BillingService,provider:FakeWhop,accountId:string,userId:string;
let now=new Date('2026-09-10T12:00:00Z');
beforeEach(async()=>{
  pg=new PGlite();
  await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);`);
  await pg.exec(readFileSync('supabase/migrations/20260929161033_whop_billing.sql','utf8'));
  db={query:(sql,values)=>pg.query(sql,values),transaction:fn=>pg.transaction(tx=>fn({query:(sql,values)=>tx.query(sql,values)}))};
  provider=new FakeWhop();now=new Date('2026-09-10T12:00:00Z');service=new BillingService(db,provider,config,()=>now);
  await service.initialize();
  userId=randomUUID();await db.query('insert into auth.users values($1)',[userId]);accountId=(await service.account(userId)).id;
},20_000);
afterEach(async()=>{await pg.close();});
async function purchase() {
  const intent=randomUUID();await service.checkout(accountId,'essential',intent);
  const m:Membership={id:'mem_first',company:{id:config.companyId},plan:{id:config.plans.essential},user:{id:'user_buyer'},metadata:{},
    status:'active',cancel_at_period_end:false,manage_url:'https://sandbox.whop.com/billing/manage/mber_first/',
    renewal_period_start:start,renewal_period_end:end};
  const p:Payment={id:'pay_first',company:{id:config.companyId},plan:{id:config.plans.essential},membership:{id:m.id},user:{id:'user_buyer'},
    metadata:{intera_billing_account_id:accountId,intera_checkout_intent_id:intent,intera_environment:'sandbox',intera_catalog:'2026-09-v1'},
    checkout_configuration_id:'ch_1',status:'paid',substatus:'succeeded',currency:'usd',subtotal:1900,total:1900,tax_amount:0,
    refunded_amount:0,tax_refunded_amount:0,paid_at:'2026-09-02T00:00:00.000Z',created_at:'2026-09-02T00:00:00.000Z',billing_reason:'subscription_create',disputes:[]};
  provider.members.set(m.id,m);provider.records.set(p.id,p);await service.reconcilePayment(p.id);return {p,m,intent};
}
async function paidBalance(){const s=await service.status(accountId);return s.buckets.filter(b=>b.kind!=='trial').reduce((n,b)=>n+b.remainingMs,0);}
function signed(type='payment.succeeded',resource='pay_first',id='msg_test',timestamp=Math.floor(Date.now()/1000)){
  const raw=JSON.stringify({id,type,api_version:'v1',company_id:config.companyId,data:{id:resource}});
  const signature=createHmac('sha256',config.webhookSecret).update(`${id}.${timestamp}.${raw}`).digest('base64');
  return {raw,headers:{'webhook-id':id,'webhook-timestamp':String(timestamp),'webhook-signature':`v1,${signature}`}};
}

describe('Whop billing database invariants',()=>{
  it('refuses to reuse a sandbox database for production',async()=>{
    const other=new BillingService(db,provider,{...config,environment:'production'});
    await expect(other.initialize()).rejects.toThrow('another Whop environment');
  });
  it('creates the 30-minute trial once, with a fixed 14-day expiry',async()=>{
    await service.account(userId);expect((await service.status(accountId)).remainingMs).toBe(1_800_000);
    now=new Date('2026-09-25T12:00:00Z');await service.account(userId);
    expect((await service.status(accountId)).remainingMs).toBe(0);
  });
  it('creates checkout server-side and never grants from its creation or redirect',async()=>{
    const id=randomUUID();await service.checkout(accountId,'essential',id);await service.checkout(accountId,'essential',id);
    expect(provider.checkouts).toBe(1);expect(await paidBalance()).toBe(0);
  });
  it('retains uncertain checkout intents and does not automatically repeat remote creation',async()=>{
    provider.fail=true;const id=randomUUID();await expect(service.checkout(accountId,'essential',id)).rejects.toThrow();
    provider.fail=false;await expect(service.checkout(accountId,'essential',id)).rejects.toThrow('pending review');
    await expect(service.checkout(accountId,'essential',randomUUID())).rejects.toThrow('unfinished');expect(provider.checkouts).toBe(0);
  });
  it('grants once per payment AND membership billing period, including distinct duplicate payments',async()=>{
    const {p}=await purchase();await Promise.all([service.reconcilePayment(p.id),service.reconcilePayment(p.id)]);
    provider.records.set('pay_duplicate',{...p,id:'pay_duplicate',billing_reason:'subscription_cycle'});
    await service.reconcilePayment('pay_duplicate');expect(await paidBalance()).toBe(36_000_000);
  });
  it('retires a confirmed checkout and never reopens it as a new purchase',async()=>{
    const {intent}=await purchase();const row=(await db.query('select retired from private.checkout_intents where id=$1',[intent])).rows[0];
    expect(row.retired).toBe(true);await expect(service.checkout(accountId,'essential',intent)).rejects.toThrow('already confirmed');
  });
  it('never assigns a delayed old payment to a newer billing period',async()=>{
    const {p,m}=await purchase();now=new Date('2026-10-02T00:00:00Z');m.renewal_period_start=end;m.renewal_period_end='2026-10-31T00:00:00.000Z';
    await service.reconcilePayment(p.id);expect(await paidBalance()).toBe(0);
  });
  it('failed renewal gives no new allowance; a canonical successful retry grants once',async()=>{
    const {p,m}=await purchase();now=new Date('2026-10-02T00:00:00Z');m.renewal_period_start=end;m.renewal_period_end='2026-10-31T00:00:00.000Z';m.status='past_due';
    const renewal={...p,id:'pay_renewal',metadata:null,status:'open',paid_at:null,created_at:'2026-10-01T00:00:01.000Z',billing_reason:'subscription_cycle'};
    provider.records.set(renewal.id,renewal);await service.reconcilePayment(renewal.id);expect(await paidBalance()).toBe(0);
    renewal.status='paid';renewal.paid_at='2026-10-02T00:00:00.000Z' as any;m.status='active';await service.reconcilePayment(renewal.id);
    expect(await paidBalance()).toBe(36_000_000);
  });
  it('rejects email-only, wrong-environment and forged checkout ownership',async()=>{
    const {p}=await purchase();p.id='pay_forged';p.membership=null;p.metadata={email:'same@example.com',intera_billing_account_id:accountId};
    provider.records.set(p.id,p);expect(await service.reconcilePayment(p.id)).toBe('unlinked');expect(await paidBalance()).toBe(36_000_000);
  });
  it('quarantines transferred membership and rejects old portal access, even if it transfers back',async()=>{
    const {m}=await purchase();m.user={id:'user_new'};
    await expect(service.portal(accountId,m.id)).rejects.toThrow('ownership');expect(await paidBalance()).toBe(0);
    m.user={id:'user_buyer'};await service.reconcileMembership(m.id);expect(await paidBalance()).toBe(0);
  });
  it('revokes old credits even when the canonical payment buyer changes during transfer',async()=>{
    const {m,p}=await purchase();m.user={id:'user_new'};p.user={id:'user_new'};
    await service.reconcilePayment(p.id);expect(await paidBalance()).toBe(0);
    expect((await db.query('select * from private.billing_reviews')).rows).toHaveLength(1);
  });
  it('does not grant if transfer occurred before the first payment delivery',async()=>{
    const {m,p}=await purchase();await db.query('delete from private.webhook_jobs');
    // A second new membership pays with the old user and is already owned by a new user.
    const secondUser=randomUUID();await db.query('insert into auth.users values($1)',[secondUser]);
    const second=(await service.account(secondUser)).id;const intent=randomUUID();await service.checkout(second,'essential',intent);
    provider.members.set('mem_second',{...m,id:'mem_second',user:{id:'user_transferred'}});
    provider.records.set('pay_second',{...p,id:'pay_second',user:{id:'user_second'},membership:{id:'mem_second'},checkout_configuration_id:'ch_2',
      metadata:{...p.metadata,intera_billing_account_id:second,intera_checkout_intent_id:intent}});
    expect(await service.reconcilePayment('pay_second')).toBe('quarantined');
    expect((await service.status(second)).remainingMs).toBe(1_800_000);
  });
  it('binds a Whop user to only one internal account',async()=>{
    const {p,m}=await purchase();const user=randomUUID();await db.query('insert into auth.users values($1)',[user]);
    const second=(await service.account(user)).id;const intent=randomUUID();await service.checkout(second,'essential',intent);
    provider.members.set('mem_second',{...m,id:'mem_second'});provider.records.set('pay_second',{...p,id:'pay_second',membership:{id:'mem_second'},
      checkout_configuration_id:'ch_2',metadata:{...p.metadata,intera_billing_account_id:second,intera_checkout_intent_id:intent}});
    expect(await service.reconcilePayment('pay_second')).toBe('quarantined');
  });
  it('partial and full refunds create cumulative append-only adjustments, without duplicate reversals',async()=>{
    const {p}=await purchase();p.refunded_amount=950;await service.reconcilePayment(p.id);await service.reconcilePayment(p.id);
    expect(await paidBalance()).toBe(18_000_000);p.refunded_amount=1900;await service.reconcilePayment(p.id);expect(await paidBalance()).toBe(0);
    expect((await db.query("select * from private.allowance_entries where kind='refund'")).rows).toHaveLength(2);
    await expect(db.query('delete from private.allowance_entries')).rejects.toThrow('append-only');
  });
  it('requires paid membership for extra purchases and preserves purchased extra time after cancellation',async()=>{
    await expect(service.checkout(accountId,'extra',randomUUID())).rejects.toThrow('active paid');
    const {p,m}=await purchase();const intent=randomUUID();await service.checkout(accountId,'extra',intent);
    const extra={...p,id:'pay_extra',membership:null,plan:{id:config.plans.extra},billing_reason:'one_time',subtotal:1500,total:1500,
      checkout_configuration_id:'ch_2',metadata:{...p.metadata,intera_checkout_intent_id:intent}};
    provider.records.set(extra.id,extra);await service.reconcilePayment(extra.id);expect(await paidBalance()).toBe(72_000_000);
    m.status='canceled';now=new Date('2026-10-02T00:00:00Z');await service.refreshAccount(accountId);expect(await paidBalance()).toBe(36_000_000);
  });
  it('consumes expiring allowances first, prevents overspending and cannot authorize from membership alone',async()=>{
    await purchase();await db.transaction(async sql=>{await billingLock(sql);await consume(sql,accountId,'provider-session-1',1_800_001,now.toISOString());});
    expect((await service.status(accountId)).buckets.find(b=>b.kind==='trial')?.remainingMs).toBe(0);
    expect(await paidBalance()).toBe(35_999_999);
    await expect(db.transaction(sql=>consume(sql,accountId,'overspend',36_000_000,now.toISOString()))).rejects.toThrow('exhausted');
    expect((await service.status(accountId)).managedStreamingAvailable).toBe(false);
  });
  it('denies direct database reads and writes to anonymous/authenticated clients',async()=>{
    for(const role of ['anon','authenticated']){
      await pg.exec(`set role ${role}`);await expect(pg.query('select * from private.billing_accounts')).rejects.toThrow();await pg.exec('reset role');
    }
    const rows=await db.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'");
    expect(rows.rows.every(r=>r.relrowsecurity)).toBe(true);
  });
  it('persists signed jobs, rejects replays/tampering and reconciles canonical state on duplicate events',async()=>{
    const {p}=await purchase();const e=signed();await service.acceptWebhook(e.raw,e.headers);await service.acceptWebhook(e.raw,e.headers);
    expect((await db.query('select * from private.webhook_jobs')).rows).toHaveLength(1);
    p.refunded_amount=1900;await service.workOne();expect(await paidBalance()).toBe(0);
    await expect(service.acceptWebhook(e.raw+' ',e.headers)).rejects.toThrow();
    const expired=signed('payment.succeeded','pay_first','msg_expired',Math.floor(Date.now()/1000)-600);
    expect(()=>verifyEvent(expired.raw,expired.headers,config)).toThrow();
  });
  it('retains failed work for retry instead of acknowledging fulfillment',async()=>{
    const e=signed();await service.acceptWebhook(e.raw,e.headers);provider.fail=true;await service.workOne();
    const row=(await db.query('select * from private.webhook_jobs')).rows[0];expect(row.done).toBe(false);expect(row.attempts).toBe(1);
  });
  it('recovers missed events by canonical sweep and preserves credits on provider outage',async()=>{
    const {p}=await purchase();p.refunded_amount=950;await service.reconcileAll();expect(await paidBalance()).toBe(18_000_000);
    provider.fail=true;await expect(service.reconcileAll()).rejects.toThrow();expect(await paidBalance()).toBe(18_000_000);
  });
  it('HTTP denies unauthenticated checkout, arbitrary metadata, redirect fulfillment and managed tokens',async()=>{
    const server=billingServer(service,async header=>{if(header!=='Bearer test')throw new Error();return userId;});
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const addr=server.address() as {port:number};
    const url=`http://127.0.0.1:${addr.port}`;
    try{
      expect((await fetch(url+'/billing/checkout',{method:'POST',body:'{}'})).status).toBe(401);
      expect((await fetch(url+'/billing/checkout',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({offer:'extra',requestId:randomUUID(),patient:'must not pass'})})).status).toBe(400);
      expect((await fetch(url+'/billing-return?success=true',{headers:{Authorization:'Bearer test'}})).status).toBe(404);
      expect((await fetch(url+'/stream/token',{method:'POST',headers:{Authorization:'Bearer test'}})).status).toBe(404);
    }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
  });
});

describe('provider contract',()=>{
  it('uses explicit API pins, allowlisted plan, minimal metadata and hosted sandbox checkout',async()=>{
    const calls:{url:string;init:RequestInit}[]=[];
    const request=async(url:any,init:any)=>{calls.push({url:String(url),init});return new Response(JSON.stringify(calls.length===1?
      {id:'plan_essential',account:{id:'biz_intera'},currency:'usd',plan_type:'renewal',initial_price:0,renewal_price:19,billing_period:30,
        trial_period_days:null,collect_tax:true,tax_type:'exclusive',adaptive_pricing_enabled:false,split_pay_required_payments:null}:
      {id:'ch_test',purchase_url:'https://sandbox.whop.com/checkout/ch_test/'}));};
    const provider=new WhopProvider(config,request);const account=randomUUID(),intent=randomUUID();await provider.checkout('essential',account,intent);
    expect(calls[0].url).toContain('/variants/plan_essential');expect(calls[0].init.headers).toHaveProperty('Api-Version-Date','2026-09-29');
    expect(calls[1].init.headers).toHaveProperty('Api-Version-Date','2025-01-01');
    const data=JSON.parse(calls[1].init.body as string);expect(Object.keys(data.metadata).sort()).toEqual(['intera_billing_account_id','intera_catalog','intera_checkout_intent_id','intera_environment']);
    expect(data.plan_id).toBe('plan_essential');expect(data.metadata.intera_billing_account_id).toBe(account);
  });
  it('money parsing is exact and rejects unsupported precision',()=>{
    expect(cents('19.01')).toBe(1901);expect(cents(19)).toBe(1900);expect(()=>cents('0.001')).toThrow();expect(()=>cents(-1)).toThrow();
  });
  it('rejects wrong environment, credentials in URLs, lookalike hosts and HTTP',()=>{
    for(const url of ['https://whop.com/checkout/ch_x','https://sandbox.whop.com.evil.test/','https://me:secret@sandbox.whop.com/','http://sandbox.whop.com/'])
      expect(()=>hostedUrl(url,config)).toThrow();
  });
  it('production sales require explicit external evidence',()=>{
    expect(()=>configuration({WHOP_ENVIRONMENT:'production',BILLING_SALES_ENABLED:'true'})).toThrow('WHOP_MERCHANT_APPROVAL_REFERENCE');
  });
});
