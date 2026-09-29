import {randomUUID} from 'node:crypto';
import {billingLock,type Database,type Sql} from './db';
import {decimal,usd,minMoney} from './vip-money';
import type {VipConfig} from './vip-config';
export class VipTreasury {
 constructor(readonly db:Database,readonly config:VipConfig,readonly binding:{environment:string;companyId:string;projectRef:string;region:string},readonly now:()=>Date=()=>new Date()){}
 async status(sql:Sql=this.db){
  const observation=(await sql.query('select * from private.vip_treasury_observations order by observed_at desc limit 1')).rows[0];
  const total=async(query:string)=>usd(String((await sql.query(query)).rows[0].amount));
  const purchased=await total("select coalesce(sum(amount_usd),0)::text amount from private.vip_provider_funding where state='confirmed'");
  const pending=await total("select coalesce(sum(amount_usd),0)::text amount from private.vip_provider_funding where state in ('pending','review')");
  const used=await total('select coalesce(sum(cost_usd),0)::text amount from private.provider_requests');
  const reserved=await total(`select coalesce(sum(r.amount_usd)/1.10,0)::numeric(38,14)::text amount from private.vip_reservations r
   where not exists(select 1 from private.vip_releases x where x.lease_id=r.lease_id)`);
  const matching=observation&&observation.environment===this.binding.environment&&observation.company_id===this.binding.companyId&&observation.project_ref===this.binding.projectRef&&observation.region===this.binding.region;
  const fresh=matching&&new Date(observation.expires_at)>this.now()&&new Date(observation.observed_at)<=this.now();
  const regular=observation?usd(observation.regular_liability_usd):0n;
  const capacity=fresh?minMoney(usd(observation.provider_available_usd),purchased-used)-reserved-regular:0n;
  // No supported live balance/AutoPay connector is configured yet. Operator observations
  // may support a supervised internal beta; they never prove automatic/public funding.
  const healthy=Boolean(fresh&&!this.config.treasury.kill&&capacity>0n&&(!this.config.autopayExpected||observation.autopay_health==='healthy'));
  return {healthy,capacity:decimal(capacity>0n?capacity:0n),purchased:decimal(purchased),reserved:decimal(reserved),pending:decimal(pending),
   providerSpend:decimal(used),providerBalance:fresh?observation.provider_available_usd:null,autopay:observation?.autopay_health??'unknown',
   automaticFundingVerified:false,publicReady:false,reason:!fresh?'Funding observation missing or stale':this.config.treasury.kill?'Provider funding kill switch active':capacity<=0n?'Receipt-backed provider capacity unavailable':!healthy?'Provider AutoPay unavailable':'Internal supervised capacity only'};
 }
 // Reserves actual receipt-backed treasury before an operator/provider can fund the pool.
 // This creates an intent, not a financial charge or proof of provider credit.
 async reserveRefill(){return this.db.transaction(async sql=>{
  await billingLock(sql);const p=this.config.treasury;if(p.kill)throw new Error('Provider funding disabled.');
  const now=this.now(),state=await this.status(sql);
  if(state.providerBalance===null||usd(state.providerBalance)>=usd(p.low))throw new Error('No verified refill trigger.');
  const unresolved=(await sql.query("select id from private.vip_provider_funding where state in ('pending','review')")).rows;
  if(unresolved.length)throw new Error('Funding already unresolved.');
  const recent=(await sql.query('select created_at from private.vip_provider_funding order by created_at desc limit 1')).rows[0];
  if(recent&&now.getTime()-new Date(recent.created_at).getTime()<p.cooldownSeconds*1000)throw new Error('Funding cooldown.');
  const totals=(await sql.query(`select coalesce(sum(amount_usd) filter(where created_at >= $1),0)::text daily,coalesce(sum(amount_usd),0)::text monthly from private.vip_provider_funding where created_at >= $2`,[new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString(),new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString()])).rows[0];
  const receipts=(await sql.query(`select a.*,g.face_usd,coalesce((select sum(f.amount_usd) from private.vip_funding_allocations f join private.vip_provider_funding p on p.id=f.funding_id where f.payment_id=a.payment_id and p.state<>'failed'),0)::text allocated
   from private.vip_receipt_availability a join private.vip_grants g on g.payment_id=a.payment_id join private.vip_accounts v on v.account_id=g.account_id
   where a.expires_at>$1 and not v.frozen and not exists(select 1 from private.vip_reviews r where r.payment_id=a.payment_id) order by g.created_at`,[now.toISOString()])).rows;
  const funds=receipts.map(r=>({id:r.payment_id,amount:minMoney(usd(r.face_usd)-usd(r.fees_usd)-usd(r.hold_usd)-usd(r.refund_reserve_usd),usd(r.net_spendable_usd))-usd(r.allocated)})).filter(r=>r.amount>0n);
  const obs=(await sql.query('select whop_spendable_usd from private.vip_treasury_observations order by observed_at desc limit 1')).rows[0];
  const amount=minMoney(usd(p.target)-usd(state.providerBalance),usd(p.single),usd(p.daily)-usd(totals.daily),usd(p.monthly)-usd(totals.monthly),usd(obs.whop_spendable_usd),funds.reduce((n,r)=>n+r.amount,0n));
  if(amount<=0n)throw new Error('Insufficient receipt-backed refill budget.');
  const id=randomUUID();await sql.query("insert into private.vip_provider_funding(id,amount_usd,state,created_at) values($1,$2,'pending',$3)",[id,decimal(amount),now.toISOString()]);
  let left=amount;for(const r of funds){const part=minMoney(left,r.amount);await sql.query('insert into private.vip_funding_allocations values($1,$2,$3)',[id,r.id,decimal(part)]);left-=part;if(!left)break;}
  return {id,amount:decimal(amount),state:'pending',financialActionPerformed:false};
 });}
}
