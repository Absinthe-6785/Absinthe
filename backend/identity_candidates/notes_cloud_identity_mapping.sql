-- UNAPPLIED, DEFAULT-OFF TEST CANDIDATE. NOT a migration or runtime endpoint.
-- NOTES-CLOUD-IDENTITY-MAPPING-PROOF-01
-- Requires the existing notes_identity_guard.sql disposable principal model.
-- An explicitly requested NEW cloud snapshot has a server-issued identity; the
-- local ID is an opaque, account-scoped source alias, NOT historical provenance.
-- Neither existing Notes nor their authored links/IDs are rewritten or adopted.
-- Legacy mutation enforcement, JWT transport, local journals, reset/restore and
-- account-retention policy remain separately blocked production work.
begin;
set local role notes_candidate_owner;

create table notes_identity_candidate.cloud_copy_readiness (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into notes_identity_candidate.cloud_copy_readiness(singleton) values (true);

create table notes_identity_candidate.cloud_aliases (
  owner_id uuid not null,
  local_note_id text not null check (btrim(local_note_id) <> ''),
  cloud_note_id text not null unique references notes_identity_candidate.identities(id),
  reserve_operation_id text not null check (btrim(reserve_operation_id) <> ''),
  primary key (owner_id, local_note_id),
  unique (owner_id, reserve_operation_id)
  -- Deliberately no cascading account/local-Note FK. Retirement never frees an alias.
);
alter table notes_identity_candidate.cloud_aliases enable row level security;
revoke all on notes_identity_candidate.cloud_copy_readiness,
  notes_identity_candidate.cloud_aliases from public;

create function notes_identity_candidate.guard_cloud_alias() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin raise exception 'CLOUD_ALIAS_IMMUTABLE'; end $$;
create trigger candidate_cloud_alias_guard before update or delete
  on notes_identity_candidate.cloud_aliases for each row
  execute function notes_identity_candidate.guard_cloud_alias();

-- Private helper: current model session, never a caller-selected owner/GUC/role.
-- Captured generation is checked, not upgraded after an A/B/A transition.
-- Lock order: mapping gate -> existing readiness/principal/account -> alias ->
-- existing reserve-operation/identity/Note/receipt locks. All are transaction scoped.
create function notes_identity_candidate.cloud_copy_scope(p_local text, p_generation bigint)
returns notes_identity_candidate.principal_bindings
language plpgsql set search_path = pg_catalog as $$
declare principal notes_identity_candidate.principal_bindings%rowtype;
begin
  perform 1 from notes_identity_candidate.cloud_copy_readiness
    where singleton and enabled for share;
  if not found then raise exception 'CLOUD_COPY_NOT_ACTIVATED'; end if;
  if p_local is null or btrim(p_local)='' then raise exception 'INVALID_LOCAL_ALIAS'; end if;
  select * into principal from notes_identity_candidate.principal_bindings where login=session_user;
  if not found or principal.generation is distinct from p_generation then
    raise exception 'ACCOUNT_AUTHORITY_UNAVAILABLE';
  end if;
  perform notes_identity_candidate.require_ready(principal.owner_id,p_generation);
  perform pg_advisory_xact_lock(hashtextextended('cloud-copy-v1:' || principal.owner_id::text || ':' || p_local,0));
  return principal;
end $$;

create function notes_identity_candidate.require_cloud_alias(p_owner uuid, p_local text, p_cloud text)
returns notes_identity_candidate.cloud_aliases
language plpgsql set search_path = pg_catalog as $$
declare alias notes_identity_candidate.cloud_aliases%rowtype;
begin
  select * into alias from notes_identity_candidate.cloud_aliases
    where owner_id=p_owner and local_note_id=p_local and cloud_note_id=p_cloud;
  if not found then raise exception 'CLOUD_ALIAS_UNAVAILABLE'; end if;
  return alias;
end $$;

-- Explicit NEW-COPY admission only. No arbitrary remote-ID registration.
-- Reservation replay is historical readback, never renewed publication permission.
-- A different operation cannot replace an established binding: read it back instead.
create function notes_identity_candidate.reserve_cloud_copy(p_local text, p_generation bigint, p_operation text)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare principal notes_identity_candidate.principal_bindings%rowtype;
  alias notes_identity_candidate.cloud_aliases%rowtype;
  issued text;
begin
  principal := notes_identity_candidate.cloud_copy_scope(p_local,p_generation);
  if p_operation is null or btrim(p_operation)='' then raise exception 'INVALID_OPERATION'; end if;
  perform pg_advisory_xact_lock(hashtextextended(principal.owner_id::text || ':' || p_operation,0));
  select * into alias from notes_identity_candidate.cloud_aliases
    where owner_id=principal.owner_id and local_note_id=p_local;
  if found then
    if alias.reserve_operation_id<>p_operation then raise exception 'CLOUD_ALIAS_ALREADY_BOUND'; end if;
    return alias.cloud_note_id;
  end if;
  if exists(select 1 from notes_identity_candidate.receipts
      where owner_id=principal.owner_id and operation_id=p_operation) then
    raise exception 'OPERATION_CONFLICT';
  end if;
  -- Do not reinterpret an existing/retired server ID as an unpublished local Note.
  -- Absence does NOT prove history: the result is explicitly a distinct new copy.
  if exists(select 1 from public.notes where id=p_local)
    or exists(select 1 from notes_identity_candidate.identities where id=p_local) then
    raise exception 'SOURCE_ID_UNAVAILABLE';
  end if;
  issued := notes_identity_candidate.reserve(p_operation);
  insert into notes_identity_candidate.cloud_aliases values(principal.owner_id,p_local,issued,p_operation);
  return issued;
end $$;

create function notes_identity_candidate.publish_cloud_copy(
  p_local text, p_cloud text, p_generation bigint, p_operation text, p_payload jsonb
) returns text language plpgsql security definer set search_path = pg_catalog as $$
declare principal notes_identity_candidate.principal_bindings%rowtype;
begin
  principal := notes_identity_candidate.cloud_copy_scope(p_local,p_generation);
  perform notes_identity_candidate.require_cloud_alias(principal.owner_id,p_local,p_cloud);
  -- Reuse strict payload validation, plain INSERT, terminal-state and exact-replay
  -- checks unchanged. Do not reuse a legacy metadata-stripping client serializer.
  return notes_identity_candidate.publish(principal.owner_id,p_generation,p_cloud,p_operation,p_payload);
end $$;

create function notes_identity_candidate.retire_cloud_copy(
  p_local text, p_cloud text, p_generation bigint, p_operation text
) returns text language plpgsql security definer set search_path = pg_catalog as $$
declare principal notes_identity_candidate.principal_bindings%rowtype;
begin
  principal := notes_identity_candidate.cloud_copy_scope(p_local,p_generation);
  perform notes_identity_candidate.require_cloud_alias(principal.owner_id,p_local,p_cloud);
  return notes_identity_candidate.retire(principal.owner_id,p_generation,p_cloud,p_operation);
end $$;

-- Read-only reconciliation after restart/lost response; never allocates or retries.
-- Serializes with the existing identity lifecycle, not just the alias wrapper.
create function notes_identity_candidate.read_cloud_copy(p_local text, p_generation bigint)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare principal notes_identity_candidate.principal_bindings%rowtype;
  alias notes_identity_candidate.cloud_aliases%rowtype;
  identity notes_identity_candidate.identities%rowtype;
  publication notes_identity_candidate.receipts%rowtype;
  retirement notes_identity_candidate.receipts%rowtype;
  note public.notes%rowtype;
begin
  principal := notes_identity_candidate.cloud_copy_scope(p_local,p_generation);
  select * into alias from notes_identity_candidate.cloud_aliases
    where owner_id=principal.owner_id and local_note_id=p_local;
  if not found then raise exception 'CLOUD_ALIAS_UNAVAILABLE'; end if;
  select * into identity from notes_identity_candidate.identities
    where id=alias.cloud_note_id and owner_id=principal.owner_id for share;
  if not found or not exists(select 1 from notes_identity_candidate.receipts
    where owner_id=principal.owner_id and note_id=identity.id and kind='reserve'
      and operation_id=alias.reserve_operation_id and payload='{}'::jsonb
      and digest=encode(sha256(convert_to('{}','UTF8')),'hex')) then
    raise exception 'RESULT_INDETERMINATE';
  end if;
  select * into note from public.notes where id=identity.id;
  select * into publication from notes_identity_candidate.receipts
    where note_id=identity.id and owner_id=principal.owner_id and kind='publish';
  select * into retirement from notes_identity_candidate.receipts
    where note_id=identity.id and owner_id=principal.owner_id and kind='retire';
  if identity.state='LIVE' then
    if note.id is null or note.user_id<>principal.owner_id or publication.note_id is null
      or retirement.note_id is not null or note.folder_id is not null or note.deleted_at is not null
      or coalesce(to_jsonb(note)->'properties','null'::jsonb)<>'null'::jsonb
      or coalesce(to_jsonb(note)->'relations','null'::jsonb)<>'null'::jsonb
      or publication.payload<>jsonb_build_object('title',note.title,'body',note.body,
        'updated_at',note.updated_at,'starred',note.starred)
      or publication.digest<>encode(sha256(convert_to(publication.payload::text,'UTF8')),'hex') then
      raise exception 'RESULT_INDETERMINATE';
    end if;
  elsif note.id is not null
    or (identity.state='RESERVED' and (publication.note_id is not null or retirement.note_id is not null))
    or (identity.state='RETIRED' and retirement.note_id is null) then
    raise exception 'RESULT_INDETERMINATE';
  end if;
  return jsonb_build_object('account_id',principal.owner_id,'local_note_id',p_local,
    'cloud_note_id',identity.id,'state',identity.state,'reserve_operation_id',alias.reserve_operation_id,
    'publication',case when publication.note_id is not null then jsonb_build_object(
      'operation_id',publication.operation_id,'payload',publication.payload,'digest',publication.digest) end,
    'retire_operation_id',retirement.operation_id);
end $$;

revoke all on function notes_identity_candidate.guard_cloud_alias(),
  notes_identity_candidate.cloud_copy_scope(text,bigint),
  notes_identity_candidate.require_cloud_alias(uuid,text,text),
  notes_identity_candidate.reserve_cloud_copy(text,bigint,text),
  notes_identity_candidate.publish_cloud_copy(text,text,bigint,text,jsonb),
  notes_identity_candidate.retire_cloud_copy(text,text,bigint,text),
  notes_identity_candidate.read_cloud_copy(text,bigint) from public;
grant execute on function notes_identity_candidate.reserve_cloud_copy(text,bigint,text),
  notes_identity_candidate.publish_cloud_copy(text,text,bigint,text,jsonb),
  notes_identity_candidate.retire_cloud_copy(text,text,bigint,text),
  notes_identity_candidate.read_cloud_copy(text,bigint) to notes_candidate_gateway;
reset role;
commit;
