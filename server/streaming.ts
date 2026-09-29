import {randomUUID} from 'node:crypto';
import {billingLock,type Database,type Sql} from './db';
import {balances} from './ledger';
import {destination} from '../src/shared/config';
import {usageRecord,exactCost,type SpeechProvider,type StreamConfig,type UsageRecord} from './soniox';
import type {VipService} from './vip';

export class StreamingService{
 vip?:VipService;
 private checkedAt=0;
 private bound=false;
 constructor(readonly db:Database,readonly provider:SpeechProvider,readonly config:StreamConfig,readonly now=()=>new Date()){}
 async initialize(){
  if(!this.config.enabled)return;
  if(!this.config.key||!this.config.projectRef||!this.config.accounts.size)throw new Error('Managed beta is not configured.');
  await this.db.transaction(async sql=>{await billingLock(sql);await sql.query('insert into private.stream_environment values(1,$1,$2) on conflict do nothing',[this.config.region,this.config.projectRef]);
   const row=(await sql.query('select * from private.stream_environment where id=1')).rows[0];if(row.region!==this.config.region||row.project_ref!==this.config.projectRef)throw new Error('Soniox project/region mismatch.');});
  await this.provider.check();this.bound=true;this.checkedAt=this.now().getTime();
 }
 private eligible(account:string){return this.bound&&this.config.enabled&&this.config.accounts.has(account)&&this.now().getTime()-this.checkedAt<120_000;}
 async status(account:string){
  const buckets=await balances(this.db,account,this.now().toISOString());
  const held=await this.db.query(`select r.grant_id,sum(r.amount_ms)::text as ms from private.stream_reservations r join private.stream_leases l on l.id=r.lease_id where l.account_id=$1 and l.status<>'settled' group by r.grant_id`,[account]);
  const holds=new Map(held.rows.map(r=>[r.grant_id,Number(r.ms)]));
  const leases=await this.db.query('select id,status,reserved_ms::text,created_at,conservative_end_at from private.stream_leases where account_id=$1 and status<>\'settled\' order by created_at',[account]);
  const alerts=await this.db.query('select reason from private.stream_alerts where (account_id=$1 or account_id is null) and resolved_at is null',[account]);
  return {managedStreamingAvailable:this.eligible(account)&&!alerts.rows.length,region:this.config.region,publicAdmission:false,
   availableMs:buckets.reduce((n,b)=>n+Math.max(0,b.remainingMs-(holds.get(b.id)??0)),0),reservedMs:held.rows.reduce((n,r)=>n+Number(r.ms),0),
   finalizing:leases.rows.length>0,leases:leases.rows,reviewRequired:alerts.rows.length>0};
 }
 async admit(account:string,requestId:string,mode:'allowance'|'vip'='allowance'){
  if(!this.eligible(account))throw new Error('Managed internal beta is not ready for this account.');
  const now=this.now(),id=randomUUID();
  const reservation=await this.db.transaction(async sql=>{
   await billingLock(sql);await sql.query('select id from private.billing_accounts where id=$1 for update',[account]);
   const prior=(await sql.query('select * from private.stream_leases where account_id=$1 and request_id=$2',[account,requestId])).rows[0];
   if(prior){if((prior.funding_mode??'allowance')!==mode)throw new Error('Session funding mode is immutable.');return {prior};}
   const alerts=await sql.query('select key from private.stream_alerts where (account_id=$1 or account_id is null) and resolved_at is null',[account]);if(alerts.rows.length)throw new Error('Usage needs review.');
   const unresolved=await sql.query(`select id,conservative_end_at from private.stream_leases where account_id=$1 and status<>'settled'`,[account]);
   if(unresolved.rows.length>=2||unresolved.rows.some(l=>new Date(l.conservative_end_at)>now))throw new Error('Previous stream is still finalizing.');
   const rate=await sql.query('select count(*)::int as count from private.stream_leases where account_id=$1 and created_at>$2',[account,new Date(now.getTime()-60_000).toISOString()]);if(rate.rows[0].count>=3)throw new Error('Admission rate exceeded.');
   if(mode==='vip'){
    if(!this.vip)throw new Error('VIP unavailable.');
    const seconds=Math.min(this.config.maxSeconds,this.vip.config.sessionSeconds);
    await sql.query(`insert into private.stream_leases(id,account_id,request_id,region,project_ref,status,reserved_ms,max_seconds,created_at,admission_expires_at,conservative_end_at,funding_mode)
     values($1,$2,$3,$4,$5,'issuing',$6,$7,$8,$9,$10,'vip')`,[id,account,requestId,this.config.region,this.config.projectRef,seconds*1000,seconds,now.toISOString(),new Date(now.getTime()+40_000).toISOString(),new Date(now.getTime()+(seconds+60)*1000).toISOString()]);
    await this.vip.reserve(sql,account,id);return {seconds};
   }
   const buckets=await balances(sql,account,now.toISOString());
   const held=await sql.query(`select r.grant_id,sum(r.amount_ms)::text as ms from private.stream_reservations r join private.stream_leases l on l.id=r.lease_id where l.account_id=$1 and l.status<>'settled' group by r.grant_id`,[account]);
   const holds=new Map(held.rows.map(r=>[r.grant_id,Number(r.ms)]));
   const funds=buckets.map(b=>({...b,available:Math.max(0,b.remainingMs-(holds.get(b.id)??0))})).filter(b=>b.available>0);
   // Entire stream ends before the earliest funding bucket expires, allowing delayed settlement
   // to use original buckets without guessing per-token audio timestamps.
   const expires=funds.find(b=>b.expires_at)?.expires_at;
   const seconds=Math.floor(Math.min(this.config.maxSeconds*1000,funds.reduce((n,b)=>n+b.available,0),expires?new Date(expires).getTime()-now.getTime()-60_000:Infinity)/1000);
   if(seconds<1)throw new Error('No eligible funded time.');
   await sql.query(`insert into private.stream_leases(id,account_id,request_id,region,project_ref,status,reserved_ms,max_seconds,created_at,admission_expires_at,conservative_end_at) values($1,$2,$3,$4,$5,'issuing',$6,$7,$8,$9,$10)`,
    [id,account,requestId,this.config.region,this.config.projectRef,seconds*1000,seconds,now.toISOString(),new Date(now.getTime()+40_000).toISOString(),new Date(now.getTime()+(seconds+60)*1000).toISOString()]);
   let left=seconds*1000,ordinal=0;for(const b of funds){const amount=Math.min(left,b.available);if(amount){await sql.query('insert into private.stream_reservations values($1,$2,$3,$4)',[id,b.id,ordinal++,amount]);left-=amount;}if(!left)break;}
   return {seconds};
  });
  if('prior' in reservation)return {leaseId:reservation.prior!.id,status:reservation.prior!.status,retryable:false};
  try{
   const credential=await this.provider.issue(id,reservation.seconds!);
   // A response outside the documented short admission window is never delivered.
   if(new Date(credential.expires_at).getTime()>now.getTime()+45_000||new Date(credential.expires_at)<=this.now())throw new Error('Unexpected credential expiry.');
   await this.db.query(`update private.stream_leases set status=case when end_intent_at is null then 'issued' else 'finalizing' end where id=$1`,[id]);
   return {leaseId:id,status:'issued',apiKey:credential.api_key,expiresAt:credential.expires_at,maxSeconds:reservation.seconds,region:this.config.region,endpoint:destination(this.config.region)};
  }catch{
   await this.db.query("update private.stream_leases set status='uncertain' where id=$1",[id]);
   throw new Error('Credential issuance is unresolved. Reservation retained; do not automatically retry.');
  }
 }
 async endIntent(account:string,lease:string){await this.db.query(`update private.stream_leases set end_intent_at=coalesce(end_intent_at,$3),status=case when status in ('issued','issuing') then 'finalizing' else status end where id=$1 and account_id=$2`,[lease,account,this.now().toISOString()]);return {finalizing:true};}
 private async alert(sql:Sql,key:string,account:string|null,reason:string){await sql.query('insert into private.stream_alerts(key,account_id,reason) values($1,$2,$3) on conflict do nothing',[key,account,reason]);}
 async settle(raw:UsageRecord){const record=usageRecord.parse(raw);return this.db.transaction(async sql=>{
  await billingLock(sql);
  if((await sql.query('select id from private.provider_requests where id=$1',[record.uuid])).rows.length)return;
  const lease=(await sql.query('select * from private.stream_leases where id::text=$1 for update',[record.client_reference_id])).rows[0];
  if(!lease){await this.alert(sql,`unknown:${record.uuid}`,null,'Provider request has no known funded lease.');return;}
  if(lease.project_ref!==this.config.projectRef||lease.region!==this.config.region||record.model!=='stt-rt-v5'||new Date(record.start_time)<new Date(lease.created_at)||new Date(record.end_time)<new Date(record.start_time)||new Date(record.start_time)>new Date(lease.admission_expires_at)||new Date(record.end_time)>new Date(lease.conservative_end_at)){
   await this.alert(sql,`invalid:${record.uuid}`,lease.account_id,'Provider request identity, model or timing mismatch.');await sql.query("update private.stream_leases set status='review' where id=$1",[lease.id]);return;
  }
  if((await sql.query('select id from private.provider_requests where lease_id=$1',[lease.id])).rows.length){await this.alert(sql,`replay:${record.uuid}`,lease.account_id,'Multiple provider requests for one single-use lease.');return;}
  await sql.query('insert into private.provider_requests(id,lease_id,region,project_ref,model,started_at,ended_at,input_audio_ms,cost_usd) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[record.uuid,lease.id,lease.region,lease.project_ref,record.model,record.start_time,record.end_time,record.input_audio_duration_ms,record.cost_usd]);
  if(lease.funding_mode==='vip'){
   if(!this.vip)throw new Error('VIP settlement unavailable.');
   const settled=await this.vip.settle(sql,lease.account_id,lease.id,record.uuid,record.cost_usd);
   await sql.query('update private.stream_leases set status=$2 where id=$1',[lease.id,settled?'settled':'review']);return;
  }
  const buckets=(await sql.query('select * from private.stream_reservations where lease_id=$1 order by ordinal',[lease.id])).rows;
  let left=record.input_audio_duration_ms;
  for(let i=0;i<buckets.length;i++){const b=buckets[i],used=i===buckets.length-1?left:Math.min(left,Number(b.amount_ms));if(used)await sql.query("insert into private.allowance_entries(id,grant_id,operation_key,amount_ms,kind) values($1,$2,$3,$4,'usage') on conflict do nothing",[randomUUID(),b.grant_id,`soniox:${record.uuid}:${i}`,-used]);left-=used;}
  if(record.input_audio_duration_ms>Number(lease.reserved_ms))await this.alert(sql,`overrun:${record.uuid}`,lease.account_id,'Verified input duration exceeded funded reservation; original bucket debited, account paused for review.');
  await sql.query("update private.stream_leases set status='settled' where id=$1",[lease.id]);
 });}
 async reconcile(){
  if(!this.config.enabled||!this.bound)return;
  await this.provider.check();this.checkedAt=this.now().getTime();
  const now=this.now();
  await this.db.query('insert into private.usage_cursors(id,window_start,window_end) values(1,$1,$2) on conflict do nothing',[new Date(now.getTime()-48*3600_000).toISOString(),now.toISOString()]);
  const row=(await this.db.query('select * from private.usage_cursors where id=1')).rows[0];
  const start=new Date(row.window_start).toISOString(),end=new Date(row.window_end).toISOString();
  const page=await this.provider.logs(start,end,row.cursor??undefined);
  for(const item of page.usage_logs)await this.settle(item);
  if(page.next_page_cursor && page.next_page_cursor===row.cursor){
   await this.alert(this.db,'usage-pagination-stalled',null,'Provider repeated a usage cursor; reconciliation requires review.');
   throw new Error('Provider usage pagination did not advance.');
  }
  if(page.next_page_cursor)await this.db.query('update private.usage_cursors set cursor=$1,checked_at=$2 where id=1 and window_start=$3 and window_end=$4 and cursor is not distinct from $5',[page.next_page_cursor,now.toISOString(),start,end,row.cursor]);
  else{
   const oldest=(await this.db.query("select min(created_at) as oldest from private.stream_leases where status<>'settled'")).rows[0].oldest;
   const since=Math.min(now.getTime()-48*3600_000,oldest?new Date(oldest).getTime():Infinity);
   if(since<now.getTime()-30*86400_000)await this.alert(this.db,'records-overdue',null,'Unresolved provider records older than 30 days require historical reconciliation.');
   await this.db.query('update private.usage_cursors set window_start=$1,window_end=$2,cursor=null,checked_at=$2 where id=1 and window_start=$3 and window_end=$4 and cursor is not distinct from $5',[new Date(Math.max(since,now.getTime()-30*86400_000)).toISOString(),now.toISOString(),start,end,row.cursor]);
   // Compare a completed UTC day, avoiding an in-flight daily aggregate. A mismatch
   // is an alert, never an invented customer debit. Dedicated project is required.
   if(this.provider.summary){const dayEnd=new Date(now);dayEnd.setUTCHours(0,0,0,0);const dayStart=new Date(dayEnd.getTime()-86400_000);
    const total=await this.provider.summary(dayStart.toISOString(),dayEnd.toISOString());
    const local=(await this.db.query('select coalesce(sum(cost_usd),0)::text as cost from private.provider_requests where ended_at >= $1 and ended_at < $2',[dayStart.toISOString(),dayEnd.toISOString()])).rows[0].cost;
    if(exactCost(total)!==exactCost(local))await this.alert(this.db,`spend:${dayStart.toISOString()}`,null,'Provider daily spend differs from reconciled requests; review required.');
   }
  }
 }
}
