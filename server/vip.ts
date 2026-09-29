import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {billingLock,type Database,type Sql} from './db';
import {decimal,usd,minMoney,vipCharge} from './vip-money';
import type {VipConfig} from './vip-config';
import type {BillingConfig} from './catalog';
import {hostedUrl} from './catalog';
import type {Payment,Provider} from './whop';
import {VipTreasury} from './vip-treasury';

export class VipDenied extends Error {}
export class VipService {
 constructor(readonly db:Database,readonly provider:Provider,readonly billing:BillingConfig,readonly config:VipConfig,
  readonly treasury:VipTreasury,readonly now:()=>Date=()=>new Date()){
  if(Object.values(config.plans).some(p=>Object.values(billing.plans).includes(p)))throw new Error('VIP and regular plans must be distinct.');
 }
 async entitlement(account:string,sql:Sql=this.db){return (await sql.query('select * from private.vip_accounts where account_id=$1',[account])).rows[0];}
 async requireVip(account:string,sql:Sql=this.db){const e=await this.entitlement(account,sql);if(!e||e.status!=='active'||e.frozen)throw new VipDenied('VIP access unavailable.');return e;}
 async setupAvailable(account:string){const row=(await this.db.query('select setup_completed_at,created_at from private.billing_accounts where id=$1',[account])).rows[0];return Boolean(row&&!row.setup_completed_at&&this.now().getTime()-new Date(row.created_at).getTime()<86400_000);}
 async completeSetup(account:string){await this.db.query('update private.billing_accounts set setup_completed_at=coalesce(setup_completed_at,$2) where id=$1',[account,this.now().toISOString()]);}
 async redeem(account:string,submitted:string){
  const result=await this.db.transaction(async sql=>{
   await billingLock(sql);const row=(await sql.query('select * from private.billing_accounts where id=$1 for update',[account])).rows[0];
   if(!this.config.inviteEnabled||!row||row.setup_completed_at||this.now().getTime()-new Date(row.created_at).getTime()>=86400_000)return false;
   const attempts=(await sql.query('select count(*) filter(where account_id=$1)::int personal,count(*)::int global from private.vip_invite_attempts where attempted_at>$2',[account,new Date(this.now().getTime()-15*60_000).toISOString()])).rows[0];
   if(attempts.personal>=5||attempts.global>=100)return false;
   await sql.query('insert into private.vip_invite_attempts values($1,$2,$3)',[randomUUID(),account,this.now().toISOString()]);
   const actual=createHash('sha256').update(submitted).digest();
   const configured=/^[a-f0-9]{64}$/.test(this.config.inviteHash);
   const expected=Buffer.from(configured?this.config.inviteHash:'0'.repeat(64),'hex');
   if(!timingSafeEqual(actual,expected)||!configured)return false;
   await sql.query("insert into private.vip_accounts(account_id,status,generation,redeemed_at) values($1,'active',$2,$3) on conflict do nothing",[account,this.config.generation,this.now().toISOString()]);
   await sql.query("insert into private.vip_audit(id,account_id,actor,action) values($1,$2,'verified-account','invite-redeemed')",[randomUUID(),account]);
   await sql.query('update private.billing_accounts set setup_completed_at=$2 where id=$1',[account,this.now().toISOString()]);return true;
  });
  if(!result)throw new VipDenied('Invitation unavailable, invalid, or retry limit reached.');return {redeemed:true};
 }
 async buckets(account:string,sql:Sql=this.db){return (await sql.query(`select g.id,g.payment_id,g.created_at,
  coalesce((select sum(e.amount_usd) from private.vip_entries e where e.grant_id=g.id),0)::text balance,
  coalesce((select sum(r.amount_usd) from private.vip_reservations r where r.grant_id=g.id and not exists(select 1 from private.vip_releases x where x.lease_id=r.lease_id)),0)::text reserved
  from private.vip_grants g where g.account_id=$1 order by g.created_at,g.id`,[account])).rows;}
 async summary(account:string){
  const ent=await this.entitlement(account);if(!ent)return undefined;
  const buckets=await this.buckets(account),balance=buckets.reduce((n,b)=>n+usd(b.balance),0n),reserved=buckets.reduce((n,b)=>n+usd(b.reserved),0n);
  const capacity=await this.treasury.status();
  const usage=(await this.db.query('select lease_id,provider_cost_usd::text,fee_usd::text,total_usd::text,status,created_at from private.vip_settlements where account_id=$1 order by created_at desc limit 100',[account])).rows;
  const topups=(await this.db.query('select id,face_usd::text,state,created_at from private.vip_topups where account_id=$1 order by created_at desc limit 100',[account])).rows;
  const active=(await this.db.query("select id,status from private.stream_leases where account_id=$1 and funding_mode='vip' and status<>'settled'",[account])).rows;
  const permitted=ent.status==='active'&&!ent.frozen;
  return {status:ent.status,reviewRequired:ent.frozen,preferredMode:ent.preferred_mode,availableUsd:decimal(balance-reserved),reservedUsd:decimal(reserved),
   finalizing:active.length>0,usage,topups,markupBps:1000,autoTopup:{enabled:false,available:false,reason:'Saved-method charging is not verified for this merchant.'},
   paymentMethod:{status:'not_verified'},topupsEnabled:permitted&&this.config.topupsEnabled&&this.billing.environment==='sandbox',
   managedReady:permitted&&this.config.sessionsEnabled&&capacity.healthy&&balance>reserved,
   fundingStatus:capacity.healthy?'Capacity ready for supervised beta':'Payment confirmed — preparing usage capacity',
   offers:Object.keys(this.config.plans).map(amount=>({amount,label:`$${amount} prepaid Intera usage credit`}))};
 }
 async selectMode(account:string,mode:'vip'|'allowance'){await this.requireVip(account);await this.db.query('update private.vip_accounts set preferred_mode=$2 where account_id=$1',[account,mode]);return {mode};}
 async checkout(account:string,amount:string,id:string){
  const plan=this.config.plans[amount];
  if(!this.config.topupsEnabled||!plan||!this.provider.checkoutCredit)throw new VipDenied('VIP top-ups are unavailable.');
  // Public collection stays closed until the complete funding route has live evidence.
  if(this.billing.environment!=='sandbox')throw new VipDenied('Public VIP collection is disabled pending funding verification.');
  const prior=await this.db.transaction(async sql=>{
   await billingLock(sql);await this.requireVip(account,sql);
   const previous=(await sql.query('select * from private.vip_topups where id=$1',[id])).rows[0];
   if(previous&&(previous.account_id!==account||previous.plan_id!==plan))throw new VipDenied('Top-up ownership mismatch.');
   if(previous)return previous;
   const pending=(await sql.query("select * from private.vip_topups where account_id=$1 and state in ('pending','checkout','requires_action','review')",[account])).rows[0];
   if(pending)return pending;
   await sql.query("insert into private.vip_topups(id,account_id,plan_id,face_usd,state,created_at) values($1,$2,$3,$4,'pending',$5)",[id,account,plan,decimal(usd(amount)),this.now().toISOString()]);return null;
  });
  if(prior){if(prior.state==='checkout'&&prior.purchase_url)return {url:hostedUrl(prior.purchase_url,this.billing)};throw new VipDenied('Top-up unresolved; reconcile before retrying.');}
  // Intent committed first. A network timeout cannot cause another checkout on restart.
  const checkout=await this.provider.checkoutCredit(plan,amount,account,id);
  await this.db.query("update private.vip_topups set provider_id=$2,purchase_url=$3,state='checkout' where id=$1",[id,checkout.id,checkout.url]);
  return {url:hostedUrl(checkout.url,this.billing)};
 }
 private async review(sql:Sql,key:string,account:string,payment:string|null,reason:string){
  await sql.query('insert into private.vip_reviews(key,account_id,payment_id,reason) values($1,$2,$3,$4) on conflict do nothing',[key,account,payment,reason]);
  await sql.query('update private.vip_accounts set frozen=true where account_id=$1',[account]);
 }
 // Called from the existing canonical payment worker, never from a redirect.
 async reconcilePayment(p:Payment):Promise<boolean>{
  const claim=p.metadata?.intera_vip_intent_id;
  const existing=(await this.db.query('select * from private.vip_grants where payment_id=$1',[p.id])).rows[0];
  const intent=(await this.db.query('select * from private.vip_topups where id::text=$1 or payment_id=$2',[typeof claim==='string'?claim:'',p.id])).rows[0];
  if(!intent&&!existing)return false;
  await this.db.transaction(async sql=>{
   await billingLock(sql);const account=intent?.account_id??existing.account_id;
   const grant=(await sql.query('select * from private.vip_grants where payment_id=$1',[p.id])).rows[0];
   if(!intent||p.company.id!==this.billing.companyId||p.plan?.id!==intent.plan_id||p.metadata?.intera_billing_account_id!==account||p.metadata?.intera_environment!==this.billing.environment||!p.user||p.currency!=='usd'||p.subtotal===null||decimal(BigInt(p.subtotal)*1_000_000_000_000n)!==decimal(usd(intent.face_usd))||!p.checkout_configuration_id||p.checkout_configuration_id!==intent.provider_id){
    await this.review(sql,`identity:${p.id}`,account,p.id,'Top-up payment identity or amount mismatch.');return;
   }
   const billingAccount=(await sql.query('select whop_user_id from private.billing_accounts where id=$1',[account])).rows[0];
   if((billingAccount.whop_user_id&&billingAccount.whop_user_id!==p.user.id)||(grant&&grant.whop_user_id!==p.user.id)||(await sql.query('select id from private.billing_accounts where whop_user_id=$1 and id<>$2',[p.user.id,account])).rows.length){await this.review(sql,`transfer:${p.id}`,account,p.id,'Purchase ownership requires review.');return;}
   const disputed=p.disputes.some(d=>d.status!=='won');
   if(disputed){await this.review(sql,`dispute:${p.id}`,account,p.id,'Disputed prepaid payment.');return;}
   if(p.status!=='paid'||!p.paid_at){
    if(grant){await this.review(sql,`state:${p.id}`,account,p.id,'Credited payment is no longer canonically paid.');return;}
    await sql.query("update private.vip_topups set state=$2 where id=$1",[intent.id,p.status==='failed'?'failed':p.status==='requires_action'?'requires_action':'pending']);return;
   }
   if(intent.payment_id&&intent.payment_id!==p.id){await this.review(sql,`reused:${p.id}`,account,p.id,'Checkout used for multiple payments.');return;}
   if(!grant){
    if((p.refunded_amount??0)>0){await this.review(sql,`pre-refund:${p.id}`,account,p.id,'Payment was refunded before grant; review required.');return;}
    const id=randomUUID();await sql.query('insert into private.vip_grants values($1,$2,$3,$4,$5,$6,\'usd\',$7)',[id,account,p.id,intent.id,p.user.id,intent.face_usd,p.paid_at]);
    await sql.query("insert into private.vip_entries(id,grant_id,operation_key,amount_usd,kind) values($1,$2,$3,$4,'grant')",[randomUUID(),id,`topup:${p.id}`,intent.face_usd]);
    await sql.query('update private.billing_accounts set whop_user_id=$2 where id=$1',[account,p.user.id]);
   }
   await sql.query("update private.vip_topups set state='paid',payment_id=$2 where id=$1",[intent.id,p.id]);
   const refunded=(p.refunded_amount??0)-(p.tax_refunded_amount??0);
   if(refunded<0){await this.review(sql,`refund-tax:${p.id}`,account,p.id,'Invalid refund tax allocation.');return;}
   if(refunded>0){
    const g=(await sql.query('select * from private.vip_grants where payment_id=$1',[p.id])).rows[0];
    const refund=BigInt(refunded)*1_000_000_000_000n;
    const prior=(await sql.query("select coalesce(-sum(amount_usd),0)::text amount from private.vip_entries where grant_id=$1 and kind='refund'",[g.id])).rows[0];
    const delta=refund-usd(prior.amount);if(delta<=0n)return;
    const bucket=(await this.buckets(account,sql)).find(b=>b.id===g.id)!;
    if(usd(bucket.reserved)>0n||usd(bucket.balance)<delta){await this.review(sql,`refund:${p.id}:${refunded}`,account,p.id,'Refund overlaps consumed or unresolved credit; operator review required.');return;}
    await sql.query("insert into private.vip_entries(id,grant_id,operation_key,amount_usd,kind) values($1,$2,$3,$4,'refund')",[randomUUID(),g.id,`refund:${p.id}:${refunded}`,decimal(-delta)]);
   }
  });return true;
 }
 async reserve(sql:Sql,account:string,lease:string){
  await this.requireVip(account,sql);if(!this.config.sessionsEnabled)throw new VipDenied('VIP sessions disabled.');
  const state=await this.treasury.status(sql);if(!state.healthy)throw new VipDenied('Provider capacity unavailable.');
  const target=usd(this.config.reserveUsd);if(target<=0n)throw new VipDenied('Invalid reservation policy.');
  const buckets=await this.buckets(account,sql),available=buckets.reduce((n,b)=>n+usd(b.balance)-usd(b.reserved),0n);
  if(available<target)throw new VipDenied('Add credit before starting.');
  if(usd(state.capacity)*11000n/10000n<target)throw new VipDenied('Provider capacity insufficient.');
  let left=target,ordinal=0;for(const b of buckets){const part=minMoney(left,usd(b.balance)-usd(b.reserved));if(part>0n){await sql.query('insert into private.vip_reservations values($1,$2,$3,$4)',[lease,b.id,ordinal++,decimal(part)]);left-=part;}if(!left)break;}
 }
 async settle(sql:Sql,account:string,lease:string,request:string,cost:string){
  const charge=vipCharge(cost),buckets=(await sql.query('select * from private.vip_reservations where lease_id=$1 order by ordinal',[lease])).rows;
  const held=buckets.reduce((n,b)=>n+usd(b.amount_usd),0n);
  if(!buckets.length)throw new Error('VIP reservation missing.');
  const over=usd(charge.total)>held;
  await sql.query("insert into private.vip_settlements(request_id,lease_id,account_id,funding_mode,provider_cost_usd,markup_bps,fee_usd,total_usd,currency,status) values($1,$2,$3,'vip',$4,1000,$5,$6,'usd',$7)",[request,lease,account,charge.api,charge.fee,charge.total,over?'review':'confirmed']);
  if(over){await this.review(sql,`cost:${request}`,account,null,'Provider cost exceeded prepaid reservation; no guessed or unfunded customer debit.');return false;}
  let left=usd(charge.total);for(const b of buckets){const part=minMoney(left,usd(b.amount_usd));if(part)await sql.query("insert into private.vip_entries(id,grant_id,operation_key,amount_usd,kind) values($1,$2,$3,$4,'usage')",[randomUUID(),b.grant_id,`usage:${request}:${b.ordinal}`,decimal(-part)]);left-=part;if(!left)break;}
  await sql.query('insert into private.vip_releases(lease_id,request_id) values($1,$2)',[lease,request]);return true;
 }
 async operator(actor:string,account:string,action:'grant'|'revoke'){
  if(!this.config.operators.has(actor))throw new VipDenied('Operator access required.');
  return this.db.transaction(async sql=>{await billingLock(sql);
   if(action==='grant')await sql.query("insert into private.vip_accounts(account_id,status,generation) values($1,'active','operator') on conflict(account_id) do update set status='active',revoked_at=null",[account]);
   else{await sql.query("update private.vip_accounts set status='revoked',revoked_at=$2,preferred_mode='allowance' where account_id=$1",[account,this.now().toISOString()]);await sql.query('update private.vip_auto_policies set enabled=false where account_id=$1',[account]);}
   await sql.query('insert into private.vip_audit(id,account_id,actor,action) values($1,$2,$3,$4)',[randomUUID(),account,actor,action]);return {recorded:true};});
 }
 async operatorHealth(actor:string){if(!this.config.operators.has(actor))throw new VipDenied('Operator access required.');
  return {treasury:await this.treasury.status(),totals:(await this.db.query(`select (select count(*) from private.vip_accounts where status='active')::int vip_accounts,
   (select coalesce(sum(amount_usd),0)::text from private.vip_entries) outstanding_credit,
   (select coalesce(sum(fee_usd),0)::text from private.vip_settlements where status='confirmed') intera_fees,
   (select count(*) from private.vip_reviews)::int review_cases,
   (select count(*) from private.vip_topups where state='failed')::int failed_topups,
   (select count(*) from private.vip_provider_funding where state='failed')::int failed_refills`)).rows[0]};}
 async disableAuto(account:string){await this.db.query('update private.vip_auto_policies set enabled=false,updated_at=$2 where account_id=$1',[account,this.now().toISOString()]);return {enabled:false};}
}
