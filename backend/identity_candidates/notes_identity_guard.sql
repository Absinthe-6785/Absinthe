-- UNAPPLIED LOCAL CANDIDATE, deliberately outside backend/migrations.
-- Reuses PR #847's identity/receipt algorithm, NOT its synthetic actor().
-- Tests model the reported deployed Notes columns, not production integration.
-- NO role creation, live grants, backfill, account deletion,
-- retention policy, production issuer API, legacy adapter or activation is supplied here.
-- Model gateway is a TRUSTED SERVER, never a browser role: p_owner must be bound
-- by separately verified backend authentication. These model grants prove no
-- production service-role/JWT properties. Owner/DBA bypass is out of scope.
begin;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'notes_candidate_owner'
      and not rolcanlogin and not rolsuper and not rolbypassrls)
    or not exists (select 1 from pg_roles where rolname = 'notes_candidate_gateway'
      and not rolsuper and not rolbypassrls)
    or not exists (select 1 from pg_roles where rolname = 'notes_candidate_app'
      and not rolsuper and not rolbypassrls) then
    raise exception 'CANDIDATE_MODEL_ROLES_REQUIRED';
  end if;
  if pg_has_role('notes_candidate_gateway', 'notes_candidate_owner', 'MEMBER')
    or pg_has_role('notes_candidate_app', 'notes_candidate_owner', 'MEMBER') then
    raise exception 'CANDIDATE_OWNER_MEMBERSHIP_FORBIDDEN';
  end if;
end $$;

create schema notes_identity_candidate authorization notes_candidate_owner;
revoke all on schema notes_identity_candidate from public;
grant usage on schema notes_identity_candidate to notes_candidate_gateway;
-- Only explicitly modeled roles are changed. No anon/authenticated/service_role
-- or provider-owned schema is altered. Production legacy bypasses remain OPEN.
revoke all on public.notes from notes_candidate_gateway, notes_candidate_app;
grant select, insert, delete on public.notes to notes_candidate_owner;
set local role notes_candidate_owner;

create table notes_identity_candidate.readiness (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  authenticated_owner_binding boolean not null default false,
  deployed_schema boolean not null default false,
  deployed_roles boolean not null default false,
  existing_identity_registration boolean not null default false,
  legacy_mutations boolean not null default false,
  k323_enforcement boolean not null default false,
  reset_restore boolean not null default false,
  account_termination boolean not null default false
);
insert into notes_identity_candidate.readiness(singleton) values (true);
-- TEST MODEL of a future account lifecycle authority, not Supabase Auth.
-- No function creates/reopens/closes accounts or chooses retention semantics.
create table notes_identity_candidate.account_fences (
  owner_id uuid primary key,
  generation bigint not null check (generation > 0),
  state text not null check (state in ('ACTIVE', 'CLOSED'))
);
-- Private test model of server-authenticated database principals. Only the model
-- owner provisions bindings; clients cannot set owner/generation through a GUC
-- or SET ROLE. This is NOT a deployed Supabase JWT-to-DB-role adapter.
create table notes_identity_candidate.principal_bindings (
  login name primary key,
  owner_id uuid not null,
  generation bigint not null check (generation > 0)
);
create table notes_identity_candidate.identities (
  id text primary key check (btrim(id) <> ''),
  owner_id uuid not null,
  state text not null check (state in ('RESERVED', 'LIVE', 'RETIRED'))
  -- No FK to auth.users: survival/erasure policy is NOT decided by this draft.
);
create table notes_identity_candidate.receipts (
  owner_id uuid not null,
  operation_id text not null check (btrim(operation_id) <> ''),
  kind text not null check (kind in ('reserve', 'publish', 'retire')),
  note_id text not null references notes_identity_candidate.identities(id),
  digest text not null,
  payload jsonb not null,
  constraint candidate_receipt_operation_key primary key (owner_id, operation_id),
  unique (note_id, kind)
);
revoke all on all tables in schema notes_identity_candidate from public;

create function notes_identity_candidate.guard_identity() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then raise exception 'IDENTITY_IMMUTABLE'; end if;
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
    or old.state = 'RETIRED'
    or not ((old.state = 'RESERVED' and new.state in ('LIVE','RETIRED'))
            or (old.state = 'LIVE' and new.state = 'RETIRED')) then
    raise exception 'IDENTITY_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger candidate_identity_guard before update or delete on notes_identity_candidate.identities
for each row execute function notes_identity_candidate.guard_identity();
create function notes_identity_candidate.guard_receipt() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin raise exception 'RECEIPT_IMMUTABLE'; end $$;
create trigger candidate_receipt_guard before update or delete on notes_identity_candidate.receipts
for each row execute function notes_identity_candidate.guard_receipt();

create function notes_identity_candidate.require_ready(p_owner uuid, p_generation bigint) returns void
language plpgsql set search_path = pg_catalog as $$
declare r notes_identity_candidate.readiness%rowtype;
begin
  -- Readiness changes serialize with transactions; only the model owner has DML.
  select * into r from notes_identity_candidate.readiness where singleton for share;
  if not found or not (r.enabled and r.authenticated_owner_binding and r.deployed_schema
      and r.deployed_roles and r.existing_identity_registration and r.legacy_mutations
      and r.k323_enforcement and r.reset_restore and r.account_termination) then
    raise exception 'CANDIDATE_NOT_ACTIVATED';
  end if;
  perform 1 from notes_identity_candidate.principal_bindings
    where login=session_user and owner_id=p_owner and generation=p_generation for share;
  if not found then raise exception 'ACCOUNT_AUTHORITY_UNAVAILABLE'; end if;
  -- Read-only safety gate, NOT a repair of deployed privileges. Runtime role
  -- binding and unguarded API/SECURITY DEFINER paths still require the separate
  -- default-false attestations above. Owner/DBA bypass is not covered here.
  if (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')) <> 3 then
    raise exception 'CANDIDATE_DEPLOYED_ROLES_UNVERIFIED';
  end if;
  if exists (select 1 from pg_roles p
    where p.rolname in ('anon','authenticated','service_role','notes_candidate_app','notes_candidate_gateway')
      and (pg_catalog.has_table_privilege(p.oid,'public.notes','INSERT,UPDATE,DELETE,TRUNCATE')
        or pg_catalog.has_any_column_privilege(p.oid,'public.notes','INSERT,UPDATE'))) then
    raise exception 'CANDIDATE_DIRECT_WRITE_GRANTS_REMAIN';
  end if;
  -- Fixed order: readiness -> principal -> account fence -> operation (reserve)
  -- -> identity -> Note -> receipt. All locks are transaction-scoped.
  perform 1 from notes_identity_candidate.account_fences
    where owner_id=p_owner and generation=p_generation and state='ACTIVE' for share;
  if not found then raise exception 'ACCOUNT_AUTHORITY_UNAVAILABLE'; end if;
end $$;

create function notes_identity_candidate.record_receipt(
  p_owner uuid, p_id text, p_operation text, p_kind text, p_payload jsonb
) returns void language plpgsql set search_path = pg_catalog as $$
declare constraint_id text;
begin
  insert into notes_identity_candidate.receipts values
    (p_owner,p_operation,p_kind,p_id,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),p_payload);
exception when unique_violation then
  get stacked diagnostics constraint_id = constraint_name;
  if constraint_id = 'candidate_receipt_operation_key' then raise exception 'OPERATION_CONFLICT'; end if;
  raise;
end $$;

-- No requested Note ID, owner, provenance, timestamp or UUID is accepted.
-- Only a private authenticated server principal can obtain a newly issued ID.
create function notes_identity_candidate.reserve(p_operation text) returns text
language plpgsql security definer set search_path = pg_catalog as $$
declare principal notes_identity_candidate.principal_bindings%rowtype;
  r notes_identity_candidate.receipts%rowtype;
  issued text;
begin
  select * into principal from notes_identity_candidate.principal_bindings where login=session_user;
  if not found then raise exception 'ACCOUNT_AUTHORITY_UNAVAILABLE'; end if;
  perform notes_identity_candidate.require_ready(principal.owner_id,principal.generation);
  if p_operation is null or btrim(p_operation)='' then raise exception 'INVALID_OPERATION'; end if;
  -- Serialize concurrent reservation replays before generating another identity.
  -- Hash collisions only serialize unrelated operations; they never authorize one.
  perform pg_advisory_xact_lock(hashtextextended(principal.owner_id::text || ':' || p_operation,0));
  select * into r from notes_identity_candidate.receipts
    where owner_id=principal.owner_id and operation_id=p_operation;
  if found then
    if r.kind<>'reserve' or r.payload<>'{}'::jsonb
      or r.digest<>encode(sha256(convert_to('{}','UTF8')),'hex')
      or not exists (select 1 from notes_identity_candidate.identities
        where id=r.note_id and owner_id=principal.owner_id) then
      raise exception 'OPERATION_CONFLICT';
    end if;
    -- Replay returns historical issuance identity, NOT fresh publication authority.
    return r.note_id;
  end if;
  issued := gen_random_uuid()::text;
  if exists (select 1 from public.notes where id=issued) then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  insert into notes_identity_candidate.identities values(issued,principal.owner_id,'RESERVED');
  perform notes_identity_candidate.record_receipt(principal.owner_id,issued,p_operation,'reserve','{}'::jsonb);
  return issued;
end $$;

create function notes_identity_candidate.publish(
  p_owner uuid, p_generation bigint, p_id text, p_operation text, p_payload jsonb
) returns text language plpgsql security definer set search_path = pg_catalog as $$
declare i notes_identity_candidate.identities%rowtype;
  r notes_identity_candidate.receipts%rowtype;
begin
  perform notes_identity_candidate.require_ready(p_owner,p_generation);
  select * into i from notes_identity_candidate.identities
    where id=p_id and owner_id=p_owner for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  if p_operation is null or btrim(p_operation)='' or p_payload is null
    or jsonb_typeof(p_payload)<>'object'
    or not (p_payload ?& array['title','body','updated_at','starred'])
    or p_payload-array['title','body','updated_at','starred']<>'{}'::jsonb
    or jsonb_typeof(p_payload->'title')<>'string'
    or jsonb_typeof(p_payload->'body')<>'string'
    or jsonb_typeof(p_payload->'starred')<>'boolean'
    or jsonb_typeof(p_payload->'updated_at')<>'number'
    or (p_payload->>'updated_at') !~ '^[0-9]+$'
    or (p_payload->>'updated_at')::numeric>9007199254740991 then
    raise exception 'UNSUPPORTED_PAYLOAD';
  end if;
  select * into r from notes_identity_candidate.receipts where owner_id=p_owner and operation_id=p_operation;
  if found then
    if r.kind<>'publish' or r.note_id<>p_id or r.payload<>p_payload
      or r.digest<>encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') then
      raise exception 'OPERATION_CONFLICT';
    end if;
    if i.state='RETIRED' then return 'APPLIED_THEN_RETIRED'; end if;
    if i.state<>'LIVE' or not exists (select 1 from public.notes n where id=p_id and user_id=p_owner
      and title=p_payload->>'title' and body=p_payload->>'body'
      and updated_at=(p_payload->>'updated_at')::bigint and starred=(p_payload->>'starred')::boolean
      and folder_id is null and deleted_at is null
      -- Optional columns are absent in the reported deployed schema. JSON row
      -- inspection also rejects non-null metadata if such columns are present.
      and coalesce(to_jsonb(n)->'properties','null'::jsonb)='null'::jsonb
      and coalesce(to_jsonb(n)->'relations','null'::jsonb)='null'::jsonb) then
      raise exception 'RESULT_INDETERMINATE';
    end if;
    return 'REPLAY_LIVE';
  end if;
  if i.state<>'RESERVED' then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  update notes_identity_candidate.identities set state='LIVE' where id=p_id;
  -- Plain INSERT, never upsert or a missing-column/drop-metadata fallback.
  insert into public.notes(id,user_id,title,body,updated_at,starred,folder_id,deleted_at)
    values(p_id,p_owner,p_payload->>'title',p_payload->>'body',(p_payload->>'updated_at')::bigint,
      (p_payload->>'starred')::boolean,null,null);
  perform notes_identity_candidate.record_receipt(p_owner,p_id,p_operation,'publish',p_payload);
  return 'CREATED';
end $$;

create function notes_identity_candidate.retire(
  p_owner uuid, p_generation bigint, p_id text, p_operation text
) returns text language plpgsql security definer set search_path = pg_catalog as $$
declare i notes_identity_candidate.identities%rowtype;
  r notes_identity_candidate.receipts%rowtype;
  affected bigint;
begin
  perform notes_identity_candidate.require_ready(p_owner,p_generation);
  if p_operation is null or btrim(p_operation)='' then raise exception 'INVALID_OPERATION'; end if;
  select * into i from notes_identity_candidate.identities where id=p_id and owner_id=p_owner for update;
  if not found then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  select * into r from notes_identity_candidate.receipts where owner_id=p_owner and operation_id=p_operation;
  if found and (r.kind<>'retire' or r.note_id<>p_id or r.payload<>'{}'::jsonb
    or r.digest<>encode(sha256(convert_to('{}','UTF8')),'hex')) then
    raise exception 'OPERATION_CONFLICT';
  end if;
  if i.state='RETIRED' then
    if found then return 'ALREADY_RETIRED'; end if;
    raise exception 'IDENTITY_UNAVAILABLE';
  end if;
  if found then raise exception 'RESULT_INDETERMINATE'; end if;
  if exists (select 1 from public.notes where id=p_id and user_id<>p_owner) then
    raise exception 'RESULT_INDETERMINATE';
  end if;
  delete from public.notes where id=p_id and user_id=p_owner;
  get diagnostics affected = row_count;
  if (i.state='LIVE' and affected<>1) or (i.state='RESERVED' and affected<>0) then
    raise exception 'RESULT_INDETERMINATE';
  end if;
  update notes_identity_candidate.identities set state='RETIRED' where id=p_id;
  perform notes_identity_candidate.record_receipt(p_owner,p_id,p_operation,'retire','{}'::jsonb);
  return 'RETIRED';
end $$;

revoke all on all functions in schema notes_identity_candidate from public;
grant execute on function notes_identity_candidate.publish(uuid,bigint,text,text,jsonb),
  notes_identity_candidate.retire(uuid,bigint,text,text),
  notes_identity_candidate.reserve(text) to notes_candidate_gateway;
-- Only the model server role can reserve. No arbitrary-ID registration,
-- configuration/account-close RPC, browser grant or runtime route is supplied.
reset role;
do $$
begin
  -- REVOKE from a role alone is insufficient if PUBLIC/inherited grants remain.
  if has_table_privilege('notes_candidate_gateway','public.notes','INSERT,UPDATE,DELETE,TRUNCATE')
    or has_table_privilege('notes_candidate_app','public.notes','INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'CANDIDATE_DIRECT_WRITE_GRANTS_REMAIN';
  end if;
end $$;
commit;
