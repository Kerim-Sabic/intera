create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.billing_lock (id integer primary key check (id = 1));
insert into private.billing_lock values (1);
create table private.billing_environment (
  id integer primary key check (id=1),
  environment text not null check (environment in ('sandbox','production')),
  company_id text not null
);
create table private.billing_reviews (
  payment_id text primary key,
  reason text not null,
  checked_at timestamptz not null
);
create table private.billing_accounts (
  id uuid primary key,
  auth_user_id uuid not null unique references auth.users(id),
  whop_user_id text unique,
  created_at timestamptz not null default now()
);
create table private.checkout_intents (
  id uuid primary key,
  account_id uuid not null references private.billing_accounts(id),
  offer text not null check (offer in ('essential','professional','intensive','extra')),
  plan_id text not null,
  provider_id text unique,
  purchase_url text,
  payment_id text unique,
  retired boolean not null default false,
  created_at timestamptz not null default now()
);
create table private.memberships (
  id text primary key,
  account_id uuid not null references private.billing_accounts(id),
  whop_user_id text not null,
  plan_id text not null,
  status text not null,
  blocked boolean not null default false,
  cancel_at_period_end boolean not null default false,
  period_start timestamptz,
  period_end timestamptz,
  checked_at timestamptz not null default now()
);
create table private.payment_records (
  id text primary key,
  account_id uuid not null references private.billing_accounts(id),
  membership_id text references private.memberships(id),
  status text not null,
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  blocked boolean not null default false,
  checked_at timestamptz not null default now()
);
create table private.allowance_grants (
  id uuid primary key,
  account_id uuid not null references private.billing_accounts(id),
  source_key text not null unique,
  payment_id text unique references private.payment_records(id),
  membership_id text references private.memberships(id),
  kind text not null check (kind in ('trial','period','extra')),
  amount_ms bigint not null check (amount_ms > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create table private.allowance_entries (
  id uuid primary key,
  grant_id uuid not null references private.allowance_grants(id),
  operation_key text not null unique,
  amount_ms bigint not null check (amount_ms <> 0),
  kind text not null check (kind in ('grant','usage','refund')),
  created_at timestamptz not null default now()
);
create table private.webhook_jobs (
  id text primary key,
  body_hash text not null,
  event_type text not null,
  resource_id text not null,
  attempts integer not null default 0,
  done boolean not null default false,
  next_attempt_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);
create index on private.webhook_jobs(next_attempt_at) where not done;
create index on private.allowance_grants(account_id);
create index on private.allowance_entries(grant_id);
create index on private.memberships(account_id);
create index on private.payment_records(account_id);
create index on private.checkout_intents(account_id);

create function private.deny_ledger_mutation() returns trigger language plpgsql
set search_path = '' as $$ begin raise exception 'Allowance history is append-only'; end; $$;
create trigger immutable_grants before update or delete on private.allowance_grants
for each row execute function private.deny_ledger_mutation();
create trigger immutable_entries before update or delete on private.allowance_entries
for each row execute function private.deny_ledger_mutation();

-- No browser access, no public RPC, no SECURITY DEFINER. The authenticated HTTP service
-- is the only writer. Use a separate database/project for sandbox and production.
do $$ declare t text; begin
  foreach t in array array['billing_lock','billing_environment','billing_reviews','billing_accounts','checkout_intents','memberships',
    'payment_records','allowance_grants','allowance_entries','webhook_jobs'] loop
    execute format('alter table private.%I enable row level security', t);
    execute format('revoke all on private.%I from public, anon, authenticated', t);
  end loop;
end $$;
revoke all on all functions in schema private from public, anon, authenticated;
