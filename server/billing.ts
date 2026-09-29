import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { offers, hostedUrl, type BillingConfig, type Offer } from './catalog';
import { billingLock, type Database, type Sql } from './db';
import { balances, grant } from './ledger';
import { verifyEvent, type Provider, type Membership, type Payment } from './whop';

type Account = {id:string; auth_user_id:string; whop_user_id:string|null};
export class BillingService {
  constructor(readonly db:Database, readonly provider:Provider, readonly config:BillingConfig,
    readonly now:()=>Date=()=>new Date()) {}

  async initialize(){
    await this.db.transaction(async sql=>{
      await billingLock(sql);
      await sql.query(`insert into private.billing_environment(id,environment,company_id) values(1,$1,$2)
        on conflict(id) do nothing`,[this.config.environment,this.config.companyId]);
      const stored=(await sql.query('select * from private.billing_environment where id=1')).rows[0];
      if(stored.environment!==this.config.environment || stored.company_id!==this.config.companyId)
        throw new Error('This database belongs to another Whop environment or company.');
    });
  }

  async account(authUserId:string) {
    return this.db.transaction(async sql=>{
      await billingLock(sql);
      const result=await sql.query<Account>(`insert into private.billing_accounts(id,auth_user_id) values ($1,$2)
        on conflict(auth_user_id) do update set auth_user_id=excluded.auth_user_id returning *`,[randomUUID(),authUserId]);
      const account=result.rows[0];
      await grant(sql,{accountId:account.id,key:`trial:${account.id}`,kind:'trial',milliseconds:1_800_000,
        expiresAt:new Date(this.now().getTime()+14*86400_000).toISOString()});
      return account;
    });
  }
  async status(accountId:string) {
    const buckets=await balances(this.db,accountId,this.now().toISOString());
    const {rows:memberships}=await this.db.query(`select id,status,blocked,cancel_at_period_end,period_end,plan_id
      from private.memberships where account_id=$1 order by checked_at desc`,[accountId]);
    const pending=await this.db.query('select offer from private.checkout_intents where account_id=$1 and payment_id is null',[accountId]);
    return {environment:this.config.environment, salesEnabled:this.config.salesEnabled,
      managedStreamingAvailable:false, // No company credential issuer until authoritative Soniox metering ships.
      taxArrangement:this.config.taxArrangement, taxBehavior:this.config.taxBehavior,
      remainingMs:buckets.reduce((sum,b)=>sum+b.remainingMs,0), buckets, memberships,
      pendingCheckoutOffers:pending.rows.map(r=>r.offer),
      catalog:Object.entries(offers).map(([id,offer])=>({id,...offer})),
    };
  }
  private async paidSubscriber(sql:Sql, accountId:string) {
    const result=await sql.query(`select m.id from private.memberships m
      where m.account_id=$1 and m.status='active' and not m.blocked and m.period_end>$2
      and exists(select 1 from private.allowance_grants g join private.payment_records p on p.id=g.payment_id
        where g.membership_id=m.id and g.kind='period' and g.expires_at>$2 and not p.blocked)
      limit 1`,[accountId,this.now().toISOString()]);
    return result.rows.length>0;
  }
  async checkout(accountId:string, offer:Offer, intentId:string) {
    z.uuid().parse(intentId);
    if (!this.config.salesEnabled) throw new Error('Paid checkout is not enabled.');
    // Refresh first, so canceled/transferred subscriptions cannot purchase extra time.
    if (offer==='extra') await this.refreshAccount(accountId);
    return this.db.transaction(async sql=>{
      await billingLock(sql);
      const prior=(await sql.query('select * from private.checkout_intents where id=$1',[intentId])).rows[0];
      if(prior){
        if(prior.account_id!==accountId || prior.offer!==offer)throw new Error('Checkout request does not match.');
        if(prior.payment_id)throw new Error('This purchase is already confirmed. Refresh before starting a new purchase.');
        if(!prior.purchase_url)throw new Error('Checkout creation is pending review. Do not retry with a new request ID.');
        return {url:hostedUrl(prior.purchase_url,this.config)};
      }
      const pending=(await sql.query(`select * from private.checkout_intents where account_id=$1
        and payment_id is null order by created_at desc limit 1`,[accountId])).rows[0];
      if(pending){
        if(pending.offer===offer && pending.purchase_url)return {url:hostedUrl(pending.purchase_url,this.config)};
        throw new Error('An unfinished checkout needs review before another is created.');
      }
      if(offer==='extra' && !await this.paidSubscriber(sql,accountId))throw new Error('Extra time requires an active paid subscription.');
      if(offer!=='extra'){
        const existing=await sql.query(`select id from private.memberships where account_id=$1
          and status in ('active','trialing','past_due') and not blocked`,[accountId]);
        if(existing.rows.length)throw new Error('Manage your existing subscription before purchasing another plan.');
      }
      await sql.query(`insert into private.checkout_intents(id,account_id,offer,plan_id) values($1,$2,$3,$4)`,
        [intentId,accountId,offer,this.config.plans[offer]]);
      // The intent must commit BEFORE the remote request. See completeCheckout below.
      return {url:null};
    }).then(async result=>result.url?result:this.completeCheckout(accountId,offer,intentId));
  }
  private async completeCheckout(accountId:string,offer:Offer,intentId:string) {
    const checkout=await this.provider.checkout(offer,accountId,intentId);
    await this.db.query(`update private.checkout_intents set provider_id=$1,purchase_url=$2 where id=$3
      and account_id=$4 and provider_id is null`,[checkout.id,checkout.url,intentId,accountId]);
    return {url:checkout.url};
  }
  async portal(accountId:string,membershipId:string) {
    return this.db.transaction(async sql=>{
      await billingLock(sql);
      const stored=(await sql.query('select * from private.memberships where id=$1 and account_id=$2',[membershipId,accountId])).rows[0];
      if(!stored)throw new Error('Membership not found.');
      const current=await this.provider.membership(membershipId);
      await this.applyMembership(sql,current);
      // Commit any transfer block before rejecting portal access.
      if(current.user?.id!==stored.whop_user_id || stored.blocked || !current.manage_url)return null;
      return hostedUrl(current.manage_url,this.config);
    }).then(url=>{if(!url)throw new Error('Membership ownership needs review.');return {url};});
  }
  async acceptWebhook(raw:string,headers:Record<string,string>) {
    const event=verifyEvent(raw,headers,this.config);
    const id=z.string().min(1).max(200).parse(headers['webhook-id']);
    const hash=createHash('sha256').update(raw).digest('hex');
    const relevant=/^(payment\.|membership\.|refund\.|dispute\.)/.test(event.type);
    await this.db.query(`insert into private.webhook_jobs(id,body_hash,event_type,resource_id,done,next_attempt_at)
      values($1,$2,$3,$4,$5,$6) on conflict(id) do nothing`,[id,hash,event.type,event.data.id,!relevant,this.now().toISOString()]);
    const stored=(await this.db.query('select body_hash from private.webhook_jobs where id=$1',[id])).rows[0];
    if(stored.body_hash!==hash)throw new Error('Webhook ID reused with different content.');
    // Durable receipt precedes acknowledgment. No raw payload/PII stored.
  }
  private assertCompany(company:string) { if(company!==this.config.companyId)throw new Error('Wrong billing company.'); }
  private async applyMembership(sql:Sql,m:Membership) {
    this.assertCompany(m.company.id);
    const old=(await sql.query('select * from private.memberships where id=$1',[m.id])).rows[0];
    if(!old)return;
    // Sticky quarantine: transferring back cannot silently restore already reassigned access.
    await sql.query(`update private.memberships set status=$1,blocked=blocked or $2,
      cancel_at_period_end=$3,period_start=$4,period_end=$5,checked_at=$6 where id=$7`,
      [m.status,m.user?.id!==old.whop_user_id || m.plan.id!==old.plan_id,m.cancel_at_period_end,
        m.renewal_period_start,m.renewal_period_end,this.now().toISOString(),m.id]);
  }
  async reconcilePayment(id:string) {
    const outcome=await this.db.transaction(async sql=>{
      await billingLock(sql);
      const p=await this.provider.payment(id);
      if(p.id!==id)throw new Error('Payment identifier mismatch.');
      this.assertCompany(p.company.id);
      const m=p.membership?await this.provider.membership(p.membership.id):null;
      if(m){if(m.id!==p.membership!.id)throw new Error('Membership identifier mismatch.');this.assertCompany(m.company.id);}
      const result=await this.applyPayment(sql,p,m);
      if(result==='quarantined' || result==='unlinked')await sql.query(`insert into private.billing_reviews(payment_id,reason,checked_at)
        values($1,$2,$3) on conflict(payment_id) do update set reason=excluded.reason,checked_at=excluded.checked_at`,
        [p.id,result,this.now().toISOString()]);
      else if(result!=='unrelated' && p.status==='paid'){
        const credited=await sql.query('select id from private.allowance_grants where payment_id=$1',[p.id]);
        if(!credited.rows.length)await sql.query(`insert into private.billing_reviews(payment_id,reason,checked_at)
          values($1,'paid_without_eligible_grant',$2) on conflict(payment_id) do update set checked_at=excluded.checked_at`,[p.id,this.now().toISOString()]);
      }
      return result;
    });
    const completed=await this.db.query(`select id,provider_id from private.checkout_intents
      where payment_id=$1 and not retired and provider_id is not null`,[id]);
    for(const intent of completed.rows){
      await this.provider.retireCheckout(intent.provider_id);
      await this.db.query('update private.checkout_intents set retired=true where id=$1',[intent.id]);
    }
    return outcome;
  }
  private async applyPayment(sql:Sql,p:Payment,m:Membership|null) {
    const offer=(Object.keys(offers) as Offer[]).find(k=>this.config.plans[k]===p.plan?.id);
    if(!offer)return 'unrelated';
    const product=offers[offer];
    const prior=(await sql.query('select * from private.payment_records where id=$1',[p.id])).rows[0];
    let member=m?(await sql.query('select * from private.memberships where id=$1',[m.id])).rows[0]:undefined;
    if(m && member)await this.applyMembership(sql,m);
    const metadata=p.metadata??{};
    let accountId:string|undefined=prior?.account_id??member?.account_id;
    let intent:any;
    // Every extra-time purchase must originate from its own explicit Intera intent,
    // even when Whop reuses an existing membership for the one-time product.
    if(!product.recurring && !prior)accountId=undefined;
    if(!accountId){
      const intentId=z.uuid().safeParse(metadata.intera_checkout_intent_id);
      const account=z.uuid().safeParse(metadata.intera_billing_account_id);
      if(!intentId.success || !account.success || metadata.intera_environment!==this.config.environment
        || metadata.intera_catalog!=='2026-09-v1')return 'unlinked';
      intent=(await sql.query(`select * from private.checkout_intents where id=$1 and account_id=$2
        and offer=$3 and plan_id=$4`,[intentId.data,account.data,offer,p.plan!.id])).rows[0];
      if(!intent || intent.provider_id!==p.checkout_configuration_id ||
        (intent.payment_id && intent.payment_id!==p.id))return 'quarantined';
      accountId=account.data;
    }
    const account=(await sql.query<Account>('select * from private.billing_accounts where id=$1',[accountId])).rows[0];
    if(!account || !p.user)return 'quarantined';
    if(member && member.account_id!==account.id)return 'quarantined';
    if(!intent && p.billing_reason!=='subscription_cycle'){
      const metadataId=z.uuid().safeParse(metadata.intera_checkout_intent_id);
      if(metadataId.success)intent=(await sql.query(`select * from private.checkout_intents where id=$1
        and account_id=$2 and plan_id=$3`,[metadataId.data,account.id,p.plan!.id])).rows[0];
    }
    if(intent && (intent.provider_id!==p.checkout_configuration_id || (intent.payment_id && intent.payment_id!==p.id)))return 'quarantined';
    if(account.whop_user_id && account.whop_user_id!==p.user.id){
      if(prior)await sql.query('update private.payment_records set blocked=true where id=$1',[p.id]);
      return 'quarantined';
    }
    const owner=(await sql.query('select id from private.billing_accounts where whop_user_id=$1',[p.user.id])).rows[0];
    if(owner && owner.id!==account.id)return 'quarantined';
    if(!account.whop_user_id && p.status==='paid')
      await sql.query('update private.billing_accounts set whop_user_id=$1 where id=$2',[p.user.id,account.id]);
    if(m){
      if(!member){
        await sql.query(`insert into private.memberships(id,account_id,whop_user_id,plan_id,status)
          values($1,$2,$3,$4,$5)`,[m.id,account.id,p.user.id,p.plan!.id,m.status]);
      }
      await this.applyMembership(sql,m);
      member=(await sql.query('select * from private.memberships where id=$1',[m.id])).rows[0];
    }
    const refund=Math.max(0,(p.refunded_amount??0)-(p.tax_refunded_amount??0));
    const disputed=p.disputes.some(d=>!['won','closed'].includes(d.status));
    const blocked=!!member?.blocked || disputed || ['refunded','disputed','chargeback'].includes(p.substatus);
    await sql.query(`insert into private.payment_records(id,account_id,membership_id,status,refunded_cents,blocked,checked_at)
      values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set status=excluded.status,
      refunded_cents=greatest(private.payment_records.refunded_cents,excluded.refunded_cents),
      blocked=private.payment_records.blocked or excluded.blocked,checked_at=excluded.checked_at`,
      [p.id,account.id,m?.id??null,p.status??'unknown',refund,blocked,this.now().toISOString()]);
    if(intent && p.status==='paid' && p.billing_reason!=='subscription_cycle')await sql.query('update private.checkout_intents set payment_id=$1 where id=$2',[p.id,intent.id]);
    if(p.status==='paid' && p.paid_at && !blocked && p.currency==='usd' && p.subtotal===product.cents
      && (p.total??0)-(p.tax_amount??0)===product.cents){
      if(product.recurring && m && ['subscription_create','subscription_cycle'].includes(p.billing_reason??'')){
        const start=m.renewal_period_start,end=m.renewal_period_end;
        // The API has no historical paid-period snapshot. Never map an old payment to
        // today's period: ambiguous/late backfills remain ungranted for operator review.
        if(start && end && Date.parse(start)<Date.parse(end) && Date.parse(end)>this.now().getTime()
          && Date.parse(p.paid_at)>=Date.parse(start) && Date.parse(p.paid_at)<Date.parse(end)
          && Date.parse(p.created_at)>=Date.parse(start) && Date.parse(p.created_at)<Date.parse(end))
          await grant(sql,{accountId:account.id,key:`period:${m.id}:${new Date(start).toISOString()}`,paymentId:p.id,membershipId:m.id,
            kind:'period',milliseconds:product.milliseconds,expiresAt:end});
      }else if(!product.recurring && p.billing_reason==='one_time' && await this.paidSubscriber(sql,account.id)){
        await grant(sql,{accountId:account.id,key:`extra:${p.id}`,paymentId:p.id,membershipId:m?.id,
          kind:'extra',milliseconds:product.milliseconds,expiresAt:null});
      }
    }
    await this.refund(sql,p.id,product.cents);
    return blocked?'quarantined':'reconciled';
  }
  private async refund(sql:Sql,paymentId:string,priceCents:number) {
    const g=(await sql.query(`select g.id,g.amount_ms,p.refunded_cents from private.allowance_grants g
      join private.payment_records p on p.id=g.payment_id where p.id=$1`,[paymentId])).rows[0];
    if(!g)return;
    const removed=(await sql.query(`select coalesce(-sum(amount_ms),0)::text as ms from private.allowance_entries
      where grant_id=$1 and kind='refund'`,[g.id])).rows[0];
    const target=Number((BigInt(g.amount_ms)*BigInt(Math.min(Number(g.refunded_cents),priceCents))
      +BigInt(priceCents)-1n)/BigInt(priceCents));
    const difference=target-Number(removed.ms);
    if(difference>0)await sql.query(`insert into private.allowance_entries(id,grant_id,operation_key,amount_ms,kind)
      values($1,$2,$3,$4,'refund') on conflict(operation_key) do nothing`,
      [randomUUID(),g.id,`refund:${paymentId}:${target}`,-difference]);
  }
  async refreshAccount(accountId:string) {
    const memberships=(await this.db.query('select id from private.memberships where account_id=$1',[accountId])).rows;
    for(const row of memberships)await this.reconcileMembership(row.id);
  }
  async reconcileMembership(id:string) {
    await this.db.transaction(async sql=>{await billingLock(sql);const m=await this.provider.membership(id);
      if(m.id!==id)throw new Error('Membership identifier mismatch.');await this.applyMembership(sql,m);});
    for await(const paymentId of this.provider.payments(id))await this.reconcilePayment(paymentId);
  }
  async reconcileAll() {
    // Full cursor walk intentionally includes old payments: catches missed refunds and
    // payments delivered while the endpoint was disabled. API failure never advances a cursor.
    for await(const id of this.provider.payments())await this.reconcilePayment(id);
    const members=await this.db.query('select id from private.memberships');
    for(const row of members.rows)await this.db.transaction(async sql=>{
      await billingLock(sql);await this.applyMembership(sql,await this.provider.membership(row.id));
    });
  }
  async workOne() {
    const job=(await this.db.query(`select * from private.webhook_jobs where not done and next_attempt_at<=$1
      order by received_at limit 1`,[this.now().toISOString()])).rows[0];
    if(!job)return false;
    try{
      if(job.event_type.startsWith('membership.'))await this.reconcileMembership(job.resource_id);
      else await this.reconcilePayment(job.event_type.startsWith('payment.')?job.resource_id:
        await this.provider.eventPayment(job.event_type,job.resource_id));
      await this.db.query('update private.webhook_jobs set done=true,attempts=attempts+1 where id=$1',[job.id]);
    }catch{
      await this.db.query(`update private.webhook_jobs set attempts=attempts+1,next_attempt_at=$1 where id=$2`,
        [new Date(this.now().getTime()+Math.min(3600,2**Math.min(job.attempts+1,12))*1000).toISOString(),job.id]);
    }
    return true;
  }
}
