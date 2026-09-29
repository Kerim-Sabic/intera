import { randomUUID } from 'node:crypto';
import type { Sql } from './db';

export async function grant(sql: Sql, input: {
  accountId:string; key:string; paymentId?:string; membershipId?:string;
  kind:'trial'|'period'|'extra'; milliseconds:number; expiresAt:string|null;
}) {
  const id = randomUUID();
  const inserted = await sql.query(`insert into private.allowance_grants
    (id,account_id,source_key,payment_id,membership_id,kind,amount_ms,expires_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing returning id`,
    [id,input.accountId,input.key,input.paymentId??null,input.membershipId??null,input.kind,input.milliseconds,input.expiresAt]);
  if (inserted.rows.length) await sql.query(`insert into private.allowance_entries
    (id,grant_id,operation_key,amount_ms,kind) values ($1,$2,$3,$4,'grant')`,
    [randomUUID(),id,`grant:${input.key}`,input.milliseconds]);
}

export async function balances(sql: Sql, accountId: string, now: string) {
  const result = await sql.query<{id:string; remaining_ms:string; expires_at:string|null; kind:string}>(`
    select g.id,g.expires_at,g.kind,greatest(0,sum(e.amount_ms))::text as remaining_ms
    from private.allowance_grants g join private.allowance_entries e on e.grant_id=g.id
    left join private.payment_records p on p.id=g.payment_id
    left join private.memberships m on m.id=g.membership_id
    where g.account_id=$1 and (g.expires_at is null or g.expires_at>$2)
      and not coalesce(p.blocked,false) and not coalesce(m.blocked,false)
    group by g.id order by g.expires_at asc nulls last,g.created_at,g.id`, [accountId,now]);
  return result.rows.map(row=>({...row,remainingMs:Number(row.remaining_ms)}));
}

// Internal metering boundary only; never expose a client-selected usage amount or operation
// key over HTTP. Caller must hold the billing lock and supply authoritative provider usage.
export async function consume(sql: Sql, accountId:string, operation:string, milliseconds:number, now:string) {
  if (!Number.isSafeInteger(milliseconds) || milliseconds<=0) throw new Error('Invalid streaming duration.');
  const old = await sql.query('select id from private.allowance_entries where operation_key=$1', [`usage:${operation}:0`]);
  if (old.rows.length) return;
  const buckets = await balances(sql,accountId,now);
  if (buckets.reduce((sum,b)=>sum+b.remainingMs,0)<milliseconds) throw new Error('Streaming allowance exhausted.');
  let remaining=milliseconds,index=0;
  for (const bucket of buckets) {
    const used=Math.min(bucket.remainingMs,remaining);
    if (!used) continue;
    await sql.query(`insert into private.allowance_entries (id,grant_id,operation_key,amount_ms,kind)
      values ($1,$2,$3,$4,'usage')`,[randomUUID(),bucket.id,`usage:${operation}:${index++}`,-used]);
    remaining-=used;if(!remaining)break;
  }
}
