-- VIP service credit is separate from the existing duration ledger.
alter table private.billing_accounts add column setup_completed_at timestamptz;
update private.billing_accounts set setup_completed_at=now();
alter table private.stream_leases add column funding_mode text not null default 'allowance'
 check(funding_mode in ('allowance','vip'));
create function private.immutable_lease_funding() returns trigger language plpgsql as $$ begin
 if new.funding_mode<>old.funding_mode or new.account_id<>old.account_id then raise exception 'Immutable lease funding'; end if;
 return new; end $$;
create trigger immutable_lease_funding before update on private.stream_leases
 for each row execute function private.immutable_lease_funding();

create table private.vip_accounts(
 account_id uuid primary key references private.billing_accounts(id),
 status text not null check(status in ('active','revoked')), generation text not null,
 redeemed_at timestamptz not null default now(), revoked_at timestamptz,
 preferred_mode text not null default 'vip' check(preferred_mode in ('vip','allowance')),
 frozen boolean not null default false
);
create table private.vip_invite_attempts(id uuid primary key,account_id uuid not null references private.billing_accounts(id),attempted_at timestamptz not null);
create index vip_attempt_time on private.vip_invite_attempts(account_id,attempted_at);
create table private.vip_audit(id uuid primary key,account_id uuid references private.billing_accounts(id),actor text not null,
 action text not null,created_at timestamptz not null default now());
create table private.vip_topups(
 id uuid primary key,account_id uuid not null references private.billing_accounts(id),plan_id text not null,
 face_usd numeric(38,14) not null check(face_usd>0),kind text not null default 'manual' check(kind in ('manual','automatic')),
 state text not null check(state in ('pending','checkout','requires_action','paid','failed','review')),
 provider_id text unique,purchase_url text,payment_id text unique,created_at timestamptz not null,
 unique(id,account_id)
);
create unique index one_unresolved_vip_topup on private.vip_topups(account_id) where state in ('pending','checkout','requires_action','review');
create table private.vip_grants(
 id uuid primary key,account_id uuid not null references private.billing_accounts(id),payment_id text not null unique,
 intent_id uuid not null references private.vip_topups(id),whop_user_id text not null,
 face_usd numeric(38,14) not null check(face_usd>0),currency text not null check(currency='usd'),created_at timestamptz not null
);
create table private.vip_entries(
 id uuid primary key,grant_id uuid not null references private.vip_grants(id),operation_key text not null unique,
 amount_usd numeric(38,14) not null,kind text not null check(kind in ('grant','usage','refund','correction')),
 created_at timestamptz not null default now()
);
create table private.vip_reservations(
 lease_id uuid not null references private.stream_leases(id),grant_id uuid not null references private.vip_grants(id),
 ordinal integer not null,amount_usd numeric(38,14) not null check(amount_usd>0),
 primary key(lease_id,grant_id),unique(lease_id,ordinal)
);
create table private.vip_settlements(
 request_id uuid primary key references private.provider_requests(id),lease_id uuid not null unique references private.stream_leases(id),
 account_id uuid not null references private.billing_accounts(id),funding_mode text not null check(funding_mode='vip'),
 provider_cost_usd numeric(38,14) not null check(provider_cost_usd>=0),markup_bps integer not null check(markup_bps=1000),
 fee_usd numeric(38,14) not null,total_usd numeric(38,14) not null,
 currency text not null check(currency='usd'),status text not null check(status in ('confirmed','review')),
 created_at timestamptz not null default now(),check(total_usd=provider_cost_usd+fee_usd),check(fee_usd=provider_cost_usd*0.10)
);
create table private.vip_releases(lease_id uuid primary key references private.stream_leases(id),request_id uuid not null references private.vip_settlements(request_id),created_at timestamptz not null default now());
create table private.vip_reviews(key text primary key,account_id uuid references private.billing_accounts(id),payment_id text,reason text not null,created_at timestamptz not null default now());

-- Observations are evidence inputs, never balance grants. No console-scraping payment bot.
create table private.vip_treasury_observations(
 id uuid primary key,observed_at timestamptz not null,expires_at timestamptz not null,
 source text not null check(source in ('operator_observed','supported_api')),
 environment text not null check(environment in ('sandbox','production')),company_id text not null,project_ref text not null,region text not null,
 provider_available_usd numeric(38,14) not null check(provider_available_usd>=0),
 whop_spendable_usd numeric(38,14) not null check(whop_spendable_usd>=0),
 regular_liability_usd numeric(38,14) not null check(regular_liability_usd>=0),
 autopay_health text not null check(autopay_health in ('unknown','off','healthy','failed')),evidence_ref text not null
);
create table private.vip_receipt_availability(
 payment_id text primary key references private.vip_grants(payment_id),
 net_spendable_usd numeric(38,14) not null check(net_spendable_usd>=0),
 fees_usd numeric(38,14) not null check(fees_usd>=0),tax_usd numeric(38,14) not null check(tax_usd>=0),
 hold_usd numeric(38,14) not null check(hold_usd>=0),refund_reserve_usd numeric(38,14) not null check(refund_reserve_usd>=0),
 observed_at timestamptz not null,expires_at timestamptz not null,evidence_ref text not null
);
create table private.vip_provider_funding(
 id uuid primary key,external_id text unique,amount_usd numeric(38,14) not null check(amount_usd>0),
 state text not null check(state in ('pending','confirmed','failed','review')),created_at timestamptz not null,
 confirmed_at timestamptz,evidence_ref text
);
create unique index one_unresolved_provider_funding on private.vip_provider_funding((true)) where state in ('pending','review');
create table private.vip_funding_allocations(
 funding_id uuid not null references private.vip_provider_funding(id),payment_id text not null references private.vip_grants(payment_id),
 amount_usd numeric(38,14) not null check(amount_usd>0),primary key(funding_id,payment_id)
);
create table private.vip_auto_policies(
 account_id uuid primary key references private.vip_accounts(account_id),enabled boolean not null default false,
 consent_version text,consented_at timestamptz,plan_id text,trigger_usd numeric(38,14),
 max_count integer check(max_count between 1 and 10),max_usd numeric(38,14),
 period_start timestamptz,updated_at timestamptz not null default now()
);

do $$ declare t text; begin
 foreach t in array array['vip_accounts','vip_invite_attempts','vip_audit','vip_topups','vip_grants','vip_entries','vip_reservations','vip_settlements','vip_releases','vip_reviews','vip_treasury_observations','vip_receipt_availability','vip_provider_funding','vip_funding_allocations','vip_auto_policies'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
  execute format('grant select,insert on private.%I to intera_server',t);
  execute format('create policy server_access on private.%I to intera_server using(true) with check(true)',t);
 end loop;
 foreach t in array array['vip_audit','vip_grants','vip_entries','vip_reservations','vip_settlements','vip_releases','vip_reviews','vip_treasury_observations','vip_funding_allocations'] loop
  execute format('create trigger immutable_vip_entry before update or delete on private.%I for each row execute function private.deny_ledger_mutation()',t);
 end loop;
end $$;
grant update on private.vip_accounts,private.vip_topups,private.vip_auto_policies,private.vip_receipt_availability,private.vip_provider_funding to intera_server;
