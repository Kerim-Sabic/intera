-- Password-free migration. Provision the login separately through protected server setup.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='intera_server') then
    create role intera_server nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end $$;
grant usage on schema private to intera_server;

do $$ declare t text; begin
  foreach t in array array['billing_lock','billing_environment','billing_reviews','billing_accounts','checkout_intents','memberships',
    'payment_records','allowance_grants','allowance_entries','webhook_jobs','stream_environment','stream_leases',
    'stream_reservations','provider_requests','stream_alerts','usage_cursors'] loop
    execute format('grant select, insert on private.%I to intera_server',t);
    execute format('create policy intera_server_access on private.%I to intera_server using (true) with check (true)',t);
  end loop;
end $$;
grant update on private.billing_lock,private.billing_accounts,private.checkout_intents,private.memberships,
  private.payment_records,private.webhook_jobs,private.stream_leases,private.usage_cursors to intera_server;

-- One Boolean lookup, never auth-table access or a public RPC. getUser still verifies
-- the JWT before this session-presence check is called by the authenticated server.
create function private.session_is_active(p_session_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions s where s.id=p_session_id and s.user_id=p_user_id
    and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function private.session_is_active(uuid,uuid) from public,anon,authenticated;
grant execute on function private.session_is_active(uuid,uuid) to intera_server;
