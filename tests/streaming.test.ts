import {beforeEach,afterEach,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {Database} from '../server/db';
import {grant,balances} from '../server/ledger';
import {StreamingService} from '../server/streaming';
import type {SpeechProvider,StreamConfig,UsageRecord} from '../server/soniox';
let pg:PGlite,db:Database,service:StreamingService,account:string,now:Date,calls:number,fail:boolean;
beforeEach(async()=>{
 pg=new PGlite();await pg.exec('create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);');
 for(const file of ['20260929161033_whop_billing.sql','20260929170242_managed_stream_leases.sql'])await pg.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 db={query:(s,v)=>pg.query(s,v),transaction:f=>pg.transaction(tx=>f({query:(s,v)=>tx.query(s,v)}))};
 now=new Date('2026-09-29T12:00:00Z');account=randomUUID();const user=randomUUID();await db.query('insert into auth.users values($1)',[user]);await db.query('insert into private.billing_accounts(id,auth_user_id) values($1,$2)',[account,user]);
 await grant(db,{accountId:account,key:'trial',kind:'trial',milliseconds:1800000,expiresAt:'2026-10-01T12:00:00Z'});calls=0;fail=false;
 const config:StreamConfig={enabled:true,region:'us',projectRef:'test-project',key:'fixture-only',accounts:new Set([account]),maxSeconds:1800};
 const provider:SpeechProvider={check:async()=>{},logs:async()=>({usage_logs:[],next_page_cursor:null}),issue:async()=>{calls++;if(fail)throw new Error('timeout');return {api_key:'fixture-temporary',expires_at:new Date(now.getTime()+30000).toISOString()};}};
 service=new StreamingService(db,provider,config,()=>now);await service.initialize();
// Cold PGlite WASM initialization exceeded 20s on the shared Intel Mac runner.
// Only fixture startup gets this budget; assertion timeouts remain unchanged.
},60000);
afterEach(async()=>pg.close());
const record=(lease:string,ms=60000):UsageRecord=>({uuid:randomUUID(),client_reference_id:lease,request_scope:'api',model:'stt-rt-v5',start_time:'2026-09-29T12:00:01Z',end_time:'2026-09-29T12:01:01Z',input_audio_duration_ms:ms,cost_usd:'0.0001234567'});
it('reserves before issuance and repeated admission never mints another key',async()=>{const id=randomUUID(),first=await service.admit(account,id);expect((await service.status(account)).availableMs).toBe(0);expect(await service.admit(account,id)).toMatchObject({leaseId:first.leaseId,retryable:false});expect(calls).toBe(1);await expect(service.admit(account,randomUUID())).rejects.toThrow('finalizing');});
it('retains reservation after Stop and missing records',async()=>{const lease=await service.admit(account,randomUUID());await service.endIntent(account,lease.leaseId);await service.reconcile();expect(await service.status(account)).toMatchObject({availableMs:0,reservedMs:1800000,finalizing:true});});
it('settles only original buckets after expiry and ignores duplicate records',async()=>{const lease=await service.admit(account,randomUUID()),usage=record(lease.leaseId);now=new Date('2026-10-02T12:00:00Z');await grant(db,{accountId:account,key:'new-period',kind:'period',milliseconds:36000000,expiresAt:'2026-11-01T12:00:00Z'});await service.settle(usage);await service.settle(usage);const entries=(await db.query("select operation_key,amount_ms::text from private.allowance_entries where kind='usage'")).rows;expect(entries).toHaveLength(1);expect(entries[0].amount_ms).toBe('-60000');expect((await balances(db,account,now.toISOString()))[0].remainingMs).toBe(36000000);expect((await db.query('select cost_usd::text from private.provider_requests')).rows[0].cost_usd).toBe('0.0001234567');});
it('keeps ambiguous issuance funded and bounded',async()=>{fail=true;const id=randomUUID();await expect(service.admit(account,id)).rejects.toThrow('unresolved');expect((await service.admit(account,id)).status).toBe('uncertain');expect(calls).toBe(1);expect((await service.status(account)).reservedMs).toBe(1800000);});
it('does not accept another account Stop or provide its allowance',async()=>{const lease=await service.admit(account,randomUUID());await service.endIntent(randomUUID(),lease.leaseId);expect((await db.query('select end_intent_at from private.stream_leases')).rows[0].end_intent_at).toBeNull();await expect(service.admit(randomUUID(),randomUUID())).rejects.toThrow('not ready');});
it('quarantines accelerated duration overrun without spending a new grant',async()=>{const lease=await service.admit(account,randomUUID());await service.settle(record(lease.leaseId,2000000));expect((await service.status(account)).reviewRequired).toBe(true);expect((await db.query("select sum(amount_ms)::text as ms from private.allowance_entries")).rows[0].ms).toBe('-200000');});
it('rejects wrong model and keeps its reservation unresolved',async()=>{const lease=await service.admit(account,randomUUID());await service.settle({...record(lease.leaseId),model:'different-model'});expect(await service.status(account)).toMatchObject({reviewRequired:true,reservedMs:1800000});expect((await db.query('select * from private.provider_requests')).rows).toHaveLength(0);});
it('prevents API roles from reading private leases',async()=>{await db.query('set role authenticated');await expect(db.query('select * from private.stream_leases')).rejects.toThrow();});
