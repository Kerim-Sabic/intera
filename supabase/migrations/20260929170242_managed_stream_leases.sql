-- Server-only managed streaming. Reservations never become portable credit.
create table private.stream_environment (
 id integer primary key check(id=1), region text not null, project_ref text not null
);
create table private.stream_leases (
 id uuid primary key, account_id uuid not null references private.billing_accounts(id),
 request_id uuid not null, region text not null, project_ref text not null,
 status text not null check(status in ('issuing','issued','uncertain','finalizing','settled','review')),
 reserved_ms bigint not null check(reserved_ms>0), max_seconds integer not null check(max_seconds between 1 and 18000),
 created_at timestamptz not null, admission_expires_at timestamptz not null,
 conservative_end_at timestamptz not null, end_intent_at timestamptz,
 unique(account_id,request_id)
);
create index stream_leases_account on private.stream_leases(account_id,created_at);
create table private.stream_reservations (
 lease_id uuid not null references private.stream_leases(id),
 grant_id uuid not null references private.allowance_grants(id),
 ordinal integer not null, amount_ms bigint not null check(amount_ms>0),
 primary key(lease_id,grant_id), unique(lease_id,ordinal)
);
create table private.provider_requests (
 id uuid primary key, lease_id uuid not null references private.stream_leases(id),
 region text not null, project_ref text not null, model text not null,
 started_at timestamptz not null, ended_at timestamptz not null,
 input_audio_ms bigint not null check(input_audio_ms>=0), cost_usd numeric(30,10) not null check(cost_usd>=0),
 settled_at timestamptz not null default now(), unique(lease_id)
);
create table private.stream_alerts (
 key text primary key, account_id uuid references private.billing_accounts(id),
 reason text not null, created_at timestamptz not null default now(), resolved_at timestamptz
);
create table private.usage_cursors (
 id integer primary key check(id=1), window_start timestamptz not null,
 window_end timestamptz not null, cursor text, checked_at timestamptz
);
alter table private.stream_environment enable row level security;
alter table private.stream_leases enable row level security;
alter table private.stream_reservations enable row level security;
alter table private.provider_requests enable row level security;
alter table private.stream_alerts enable row level security;
alter table private.usage_cursors enable row level security;
revoke all on private.stream_environment,private.stream_leases,private.stream_reservations,
 private.provider_requests,private.stream_alerts,private.usage_cursors from public,anon,authenticated;
create trigger immutable_stream_reservations before update or delete on private.stream_reservations
for each row execute function private.deny_ledger_mutation();
create trigger immutable_provider_requests before update or delete on private.provider_requests
for each row execute function private.deny_ledger_mutation();
