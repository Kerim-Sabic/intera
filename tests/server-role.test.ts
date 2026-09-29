import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
it('limits the server to private application data and a Boolean session check',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);');
  for(const name of ['20260929161033_whop_billing','20260929170242_managed_stream_leases','20260929182332_restricted_server_role','20260929184200_billing_review_runtime_update'])await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'));
  const user='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000002';
  await db.query('insert into auth.sessions values($1,$2,null)',[session,user]);
  await db.exec('set role intera_server');
  expect((await db.query('select private.session_is_active($1,$2) as active',[session,user])).rows).toEqual([{active:true}]);
  expect((await db.query('select private.session_is_active($1,$2) as active',[session,session])).rows).toEqual([{active:false}]);
  await db.query('select id from private.billing_lock for update');
  for(const reason of ['unlinked','quarantined'])await db.query("insert into private.billing_reviews(payment_id,reason,checked_at) values('pay_fixture',$1,now()) on conflict(payment_id) do update set reason=excluded.reason,checked_at=excluded.checked_at",[reason]);
  expect((await db.query("select reason from private.billing_reviews where payment_id='pay_fixture'")).rows).toEqual([{reason:'quarantined'}]);
  await expect(db.query('select * from auth.sessions')).rejects.toThrow();
  await expect(db.query('delete from private.allowance_entries')).rejects.toThrow();
  await expect(db.query('update private.stream_reservations set amount_ms=1')).rejects.toThrow();
  await expect(db.query('create table private.unapproved(id int)')).rejects.toThrow();
  await db.exec('reset role; set role authenticated');
  await expect(db.query('select private.session_is_active($1,$2)',[session,user])).rejects.toThrow();
  await expect(db.query('select * from private.billing_accounts')).rejects.toThrow();
 }finally{await db.close();}
},60000);
