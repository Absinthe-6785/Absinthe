begin;

-- G4A is dormant. Only an explicit trusted capability row permits its RPCs.
alter table public.health_workout_capabilities
  drop constraint if exists health_workout_capabilities_g1_dormant_only;
alter table public.health_workout_capabilities
  drop constraint if exists health_workout_capabilities_g4a_states;
alter table public.health_workout_capabilities
  add constraint health_workout_capabilities_g4a_states
  check (state in ('DISABLED', 'FOUNDATION_READY')) not valid;

create table if not exists public.health_workout_authorities (
  user_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  domain text not null default 'health_workout_session'
    check (domain = 'health_workout_session'),
  authority_epoch bigint not null default 1
    check (authority_epoch between 1 and 9007199254740991),
  state text not null default 'OPEN' check (state in ('OPEN', 'RESET_FENCED')),
  current_reset_job_id uuid,
  transition_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, project_scope, domain),
  check ((state = 'OPEN' and current_reset_job_id is null)
    or (state = 'RESET_FENCED' and current_reset_job_id is not null))
);

create table if not exists public.health_workout_generation_bindings (
  user_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  domain text not null default 'health_workout_session'
    check (domain = 'health_workout_session'),
  namespace_fingerprint text not null check (namespace_fingerprint ~ '^[a-f0-9]{64}$'),
  generation_id text not null check (generation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  device_id text not null check (device_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  binding_id uuid not null default gen_random_uuid(),
  authority_epoch bigint not null check (authority_epoch between 1 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, project_scope, domain, namespace_fingerprint, generation_id),
  unique (user_id, project_scope, domain, binding_id)
);

create table if not exists public.health_workout_snapshot_tokens (
  snapshot_id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  domain text not null default 'health_workout_session'
    check (domain = 'health_workout_session'),
  binding_id uuid not null,
  authority_epoch bigint not null check (authority_epoch between 1 and 9007199254740991),
  server_epoch uuid not null,
  watermark bigint not null check (watermark between 0 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp()
);

alter table public.health_workout_sessions_v2
  add column if not exists content_hash text,
  add column if not exists authority_epoch bigint;
alter table public.health_workout_sessions_v2
  drop constraint if exists health_workout_sessions_v2_g4a_evidence;
alter table public.health_workout_sessions_v2
  add constraint health_workout_sessions_v2_g4a_evidence
  check ((content_hash is null and authority_epoch is null)
    or (content_hash ~ '^[a-f0-9]{64}$' and authority_epoch between 1 and 9007199254740991)) not valid;

alter table public.remote_mutation_receipts
  add column if not exists authority_epoch bigint,
  add column if not exists generation_binding_id uuid,
  add column if not exists content_hash text;
alter table public.remote_mutation_receipts
  drop constraint if exists remote_mutation_receipts_domain_check;
alter table public.remote_mutation_receipts
  add constraint remote_mutation_receipts_domain_check
  check (domain in ('notes', 'reference_alpha', 'reference_beta',
    'health_routine_preset', 'health_routine_profile', 'health_workout_session')) not valid;
alter table public.remote_mutation_receipts
  drop constraint if exists remote_mutation_receipts_v2_shape_check;
alter table public.remote_mutation_receipts
  add constraint remote_mutation_receipts_v2_shape_check
  check (protocol_version = 1 or (
    domain in ('reference_alpha', 'reference_beta',
      'health_routine_preset', 'health_routine_profile', 'health_workout_session')
    and device_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    and ((result_code = 'APPLIED') = (change_sequence is not null))
  )) not valid;
alter table public.remote_mutation_receipts
  drop constraint if exists remote_mutation_receipts_workout_evidence;
alter table public.remote_mutation_receipts
  add constraint remote_mutation_receipts_workout_evidence
  check (domain <> 'health_workout_session' or (
    protocol_version = 2 and result_code = 'APPLIED'
    and authority_epoch between 1 and 9007199254740991
    and generation_binding_id is not null and content_hash ~ '^[a-f0-9]{64}$'
    and remote_mutation_ref is not null and result_revision is not null
  )) not valid;

alter table public.remote_reference_changes_v2
  add column if not exists authority_epoch bigint,
  add column if not exists content_hash text;
-- The original jsonb::text bound counts PostgreSQL's display whitespace,
-- unlike the canonical UTF-8 wire bound. G4A validates exact canonical bytes
-- before the trusted RPC; retain the old DB bound for all older domains.
alter table public.remote_reference_changes_v2
  drop constraint if exists remote_reference_changes_v2_record_check;
alter table public.remote_reference_changes_v2
  add constraint remote_reference_changes_v2_record_check
  check (domain = 'health_workout_session' or octet_length(record::text) <= 131072) not valid;
alter table public.remote_reference_changes_v2
  drop constraint if exists remote_reference_changes_v2_domain_check;
alter table public.remote_reference_changes_v2
  add constraint remote_reference_changes_v2_domain_check
  check (domain in ('reference_alpha', 'reference_beta',
    'health_routine_preset', 'health_routine_profile', 'health_workout_session')) not valid;
alter table public.remote_reference_changes_v2
  drop constraint if exists remote_reference_changes_v2_workout_evidence;
alter table public.remote_reference_changes_v2
  add constraint remote_reference_changes_v2_workout_evidence
  check (domain <> 'health_workout_session' or (
    authority_epoch between 1 and 9007199254740991
    and content_hash ~ '^[a-f0-9]{64}$'
  )) not valid;
create index if not exists remote_reference_changes_v2_workout_account
  on public.remote_reference_changes_v2
  (authenticated_owner_id, project_scope, domain, sequence)
  where domain = 'health_workout_session';
create index if not exists remote_reference_changes_v2_workout_snapshot
  on public.remote_reference_changes_v2
  (authenticated_owner_id, project_scope, domain, entity_id, sequence desc)
  where domain = 'health_workout_session';

alter table public.health_workout_authorities enable row level security;
alter table public.health_workout_generation_bindings enable row level security;
alter table public.health_workout_snapshot_tokens enable row level security;
revoke all on public.health_workout_sessions_v2 from public, anon, authenticated, service_role;
revoke all on public.health_workout_authorities from public, anon, authenticated, service_role;
revoke all on public.health_workout_generation_bindings from public, anon, authenticated, service_role;
revoke all on public.health_workout_snapshot_tokens from public, anon, authenticated, service_role;

create or replace function public.reject_immutable_workout_row_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'REL05G4A_IMMUTABLE_ROW';
end
$$;
drop trigger if exists health_workout_bindings_immutable
  on public.health_workout_generation_bindings;
create trigger health_workout_bindings_immutable before update or delete
  on public.health_workout_generation_bindings
  for each row execute function public.reject_immutable_workout_row_v1();
drop trigger if exists health_workout_snapshots_immutable
  on public.health_workout_snapshot_tokens;
create trigger health_workout_snapshots_immutable before update or delete
  on public.health_workout_snapshot_tokens
  for each row execute function public.reject_immutable_workout_row_v1();

-- Existing K-323 domains already grant service_role INSERT on the shared
-- ledger/stream. For workout rows, only the migration owner's SECURITY
-- DEFINER RPC may insert. This closes a direct service-role bypass without
-- changing any existing domain's grants or behavior.
create or replace function public.guard_workout_shared_insert_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_owner name;
begin
  if new.domain = 'health_workout_session' then
    select pg_get_userbyid(relowner) into v_owner from pg_catalog.pg_class
    where oid = tg_relid;
    if current_user <> v_owner then
      raise exception 'REL05G4A_RPC_ONLY';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists remote_mutation_receipts_workout_rpc_only
  on public.remote_mutation_receipts;
create trigger remote_mutation_receipts_workout_rpc_only before insert
  on public.remote_mutation_receipts for each row
  execute function public.guard_workout_shared_insert_v1();
drop trigger if exists remote_reference_changes_workout_rpc_only
  on public.remote_reference_changes_v2;
create trigger remote_reference_changes_workout_rpc_only before insert
  on public.remote_reference_changes_v2 for each row
  execute function public.guard_workout_shared_insert_v1();

-- The sole lock contract is shared with future G4C reset operations. The
-- backend passes JWT-derived owner and configured project; no client-facing
-- role can call this internal helper directly.
create or replace function public.lock_health_workout_authority_v1(
  p_owner uuid, p_project text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_owner::text || '|' || p_project || '|health_workout_session|authority', 0));
end
$$;

-- All authority decisions acquire the lock before reading capability/epoch.
-- Disabled accounts do not gain an authority row as a side effect.
create or replace function public.health_workout_authority_context_v1(
  p_owner uuid, p_project text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_capability text;
  v_authority public.health_workout_authorities%rowtype;
begin
  if p_owner is null or p_project is null
    or p_project !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'REL05G4A_INVALID_SCOPE';
  end if;
  perform public.lock_health_workout_authority_v1(p_owner, p_project);
  select state into v_capability from public.health_workout_capabilities
  where user_id = p_owner and project_scope = p_project;
  if v_capability is distinct from 'FOUNDATION_READY' then
    return jsonb_build_object('errorCode', 'CAPABILITY_DISABLED',
      'capability', coalesce(v_capability, 'DISABLED'), 'authorityEpoch', null);
  end if;
  insert into public.health_workout_authorities (user_id, project_scope)
  values (p_owner, p_project)
  on conflict (user_id, project_scope, domain) do nothing;
  select * into v_authority from public.health_workout_authorities
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session';
  return jsonb_build_object('errorCode',
    case when v_authority.state = 'OPEN' then null else 'AUTHORITY_RESET_FENCED' end,
    'capability', v_capability, 'authorityEpoch', v_authority.authority_epoch,
    'authorityState', v_authority.state);
end
$$;

-- A binding remains historical across an epoch change. Generation lifecycle
-- uses the existing shared transition lock to exclude a concurrent stale flip.
create or replace function public.check_health_workout_binding_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text, p_binding uuid, p_epoch bigint
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_binding public.health_workout_generation_bindings%rowtype;
  v_status text;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended(
    p_owner::text || '|' || p_project || '|generation|' ||
      p_namespace || '|' || p_generation, 0));
  select * into v_binding from public.health_workout_generation_bindings
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session'
    and namespace_fingerprint = p_namespace and generation_id = p_generation;
  if not found or v_binding.binding_id is distinct from p_binding
    or v_binding.device_id is distinct from p_device
    or v_binding.authority_epoch is distinct from p_epoch then
    return 'STALE_GENERATION_BINDING';
  end if;
  select status into v_status from public.remote_sync_generations
  where owner_id = p_owner and project_scope = p_project
    and namespace_fingerprint = p_namespace and generation_id = p_generation;
  if v_status is distinct from 'active' then
    return 'STALE_GENERATION_BINDING';
  end if;
  return null;
end
$$;

create or replace function public.read_health_workout_authority_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_binding public.health_workout_generation_bindings%rowtype;
  v_stream_epoch uuid;
  v_status text;
begin
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' is not null then
    return jsonb_build_object('protocolVersion', 2, 'domain', 'health_workout_session',
      'capability', v_context ->> 'capability',
      'authorityEpoch', v_context -> 'authorityEpoch',
      'authorityState', v_context ->> 'authorityState',
      'bindingState', 'registration_required', 'bindingId', null,
      'serverEpoch', null, 'errorCode', v_context ->> 'errorCode');
  end if;
  select server_epoch into v_stream_epoch from public.remote_reference_streams_v2
  where authenticated_owner_id = p_owner and project_scope = p_project;
  select * into v_binding from public.health_workout_generation_bindings
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session'
    and namespace_fingerprint = p_namespace and generation_id = p_generation;
  if found and v_binding.device_id = p_device
    and v_binding.authority_epoch = (v_context ->> 'authorityEpoch')::bigint then
    v_status := public.check_health_workout_binding_v1(
      p_owner, p_project, p_namespace, p_generation, p_device,
      v_binding.binding_id, v_binding.authority_epoch);
  else
    v_status := 'STALE_GENERATION_BINDING';
  end if;
  return jsonb_build_object('protocolVersion', 2, 'domain', 'health_workout_session',
    'capability', v_context ->> 'capability',
    'authorityEpoch', v_context -> 'authorityEpoch',
    'authorityState', v_context ->> 'authorityState',
    'bindingState', case when v_status is null then 'bound' else 'registration_required' end,
    'bindingId', case when v_status is null then v_binding.binding_id::text else null end,
    'serverEpoch', v_stream_epoch::text, 'errorCode', null);
end
$$;

create or replace function public.register_health_workout_generation_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_binding public.health_workout_generation_bindings%rowtype;
  v_generation_status text;
  v_server_epoch uuid;
begin
  if p_namespace is null or p_namespace !~ '^[a-f0-9]{64}$'
    or p_generation is null or p_generation !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_device is null or p_device !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'REL05G4A_INVALID_GENERATION';
  end if;
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_context ->> 'errorCode');
  end if;
  perform pg_advisory_xact_lock_shared(hashtextextended(
    p_owner::text || '|' || p_project || '|generation|' ||
      p_namespace || '|' || p_generation, 0));
  select status into v_generation_status from public.remote_sync_generations
  where owner_id = p_owner and project_scope = p_project
    and namespace_fingerprint = p_namespace and generation_id = p_generation;
  if v_generation_status is distinct from 'active' then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'STALE_GENERATION_BINDING');
  end if;
  select * into v_binding from public.health_workout_generation_bindings
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session'
    and namespace_fingerprint = p_namespace and generation_id = p_generation;
  if found then
    if v_binding.device_id <> p_device
      or v_binding.authority_epoch <> (v_context ->> 'authorityEpoch')::bigint then
      return jsonb_build_object('status', 'rejected', 'errorCode', 'STALE_GENERATION_BINDING');
    end if;
  else
    insert into public.health_workout_generation_bindings (
      user_id, project_scope, namespace_fingerprint, generation_id, device_id, authority_epoch
    ) values (
      p_owner, p_project, p_namespace, p_generation, p_device,
      (v_context ->> 'authorityEpoch')::bigint
    ) returning * into v_binding;
  end if;
  insert into public.remote_reference_streams_v2 (authenticated_owner_id, project_scope)
  values (p_owner, p_project)
  on conflict (authenticated_owner_id, project_scope) do nothing;
  select server_epoch into v_server_epoch from public.remote_reference_streams_v2
  where authenticated_owner_id = p_owner and project_scope = p_project;
  return jsonb_build_object('protocolVersion', 2, 'status', 'bound',
    'domain', 'health_workout_session', 'namespaceKey', p_namespace,
    'generationId', p_generation, 'deviceId', p_device,
    'bindingId', v_binding.binding_id::text,
    'authorityEpoch', v_binding.authority_epoch,
    'serverEpoch', v_server_epoch::text, 'errorCode', null);
end
$$;

create or replace function public.apply_health_workout_mutation_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text, p_binding uuid, p_authority_epoch bigint,
  p_entity_id uuid, p_mutation_id text, p_idempotency_key text,
  p_operation text, p_base_revision bigint, p_local_revision bigint,
  p_payload jsonb, p_payload_hash text, p_content_hash text,
  p_request_digest text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_binding_error text;
  v_receipt public.remote_mutation_receipts%rowtype;
  v_entity public.health_workout_sessions_v2%rowtype;
  v_record jsonb;
  v_content_hash text;
  v_revision bigint;
  v_deleted_at timestamptz;
  v_ref uuid := gen_random_uuid();
  v_committed_at timestamptz := clock_timestamp();
  v_sequence bigint;
  v_response jsonb;
  v_error text;
  v_expected_digest text;
begin
  if p_namespace is null or p_namespace !~ '^[a-f0-9]{64}$'
    or p_generation is null or p_generation !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_device is null or p_device !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_binding is null or p_authority_epoch is null
    or p_entity_id is null
    or p_entity_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_mutation_id is null
    or p_mutation_id !~ '^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_idempotency_key is null or p_idempotency_key !~ '^k322\.[a-f0-9]{64}$'
    or p_operation is null or p_operation not in ('upsert', 'tombstone', 'restore')
    or p_local_revision is null or p_local_revision not between 1 and 9007199254740991
    or (p_base_revision is not null and p_base_revision not between 1 and 9007199254740991)
    or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_request_digest is null or p_request_digest !~ '^[a-f0-9]{64}$'
    or p_payload is null then
    raise exception 'REL05G4A_INVALID_MUTATION';
  end if;
  if p_operation in ('upsert', 'restore') then
    if p_payload ->> 'kind' is distinct from 'entity_snapshot'
      or p_payload #>> '{record,id}' is distinct from p_entity_id::text
      or p_content_hash is null or p_content_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'REL05G4A_INVALID_PAYLOAD';
    end if;
  elsif p_payload ->> 'kind' is distinct from 'tombstone'
    or p_payload ->> 'entityId' is distinct from p_entity_id::text
    or p_payload ->> 'revision' is distinct from p_local_revision::text
    or p_payload ->> 'deletedAt' is null then
    raise exception 'REL05G4A_INVALID_PAYLOAD';
  end if;

  -- Authority is established before any receipt lookup. All workout RPCs use
  -- the same transaction-scoped advisory key through this context helper.
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' is not null then
    return jsonb_build_object('outcome', 'rejected', 'errorCode', v_context ->> 'errorCode');
  end if;
  if p_authority_epoch <> (v_context ->> 'authorityEpoch')::bigint then
    return jsonb_build_object('outcome', 'rejected', 'errorCode', 'STALE_AUTHORITY_EPOCH',
      'authorityEpoch', v_context -> 'authorityEpoch');
  end if;
  v_binding_error := public.check_health_workout_binding_v1(
    p_owner, p_project, p_namespace, p_generation, p_device, p_binding, p_authority_epoch);
  if v_binding_error is not null then
    return jsonb_build_object('outcome', 'rejected', 'errorCode', v_binding_error);
  end if;

  -- All digest tuple values are ASCII-safe identifiers/UUIDs/integers. The
  -- JSON array has the same field order as Python/JS; json_build_array emits
  -- comma-space separators, so remove only those separators (no bound string
  -- can contain comma/space under the validated identifier grammar).
  v_expected_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(replace(json_build_array(
    'absinthe-workout-remote-v1', 2, p_owner::text, p_project,
    'health_workout_session', p_namespace, p_generation, p_device,
    p_binding::text, (v_context ->> 'authorityEpoch')::bigint,
    p_mutation_id, p_idempotency_key, p_entity_id::text, p_operation,
    p_base_revision, p_local_revision, p_payload_hash
  )::text, ', ', ','), 'UTF8')), 'hex');
  if p_request_digest <> v_expected_digest then
    return jsonb_build_object('outcome', 'rejected',
      'errorCode', 'REQUEST_DIGEST_MISMATCH');
  end if;

  -- Shared receipt uniqueness also spans older K-323 domains. Match their
  -- lock keys so a concurrent non-workout insert cannot race this decision.
  perform pg_advisory_xact_lock(hashtextextended(
    p_owner::text || '|' || p_project || '|idem|' || p_idempotency_key, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    p_owner::text || '|' || p_project || '|mutation|' || p_mutation_id, 0));
  select * into v_receipt from public.remote_mutation_receipts
  where authenticated_owner_id = p_owner and project_scope = p_project
    and mutation_id = p_mutation_id;
  if found then
    if v_receipt.domain = 'health_workout_session'
      and v_receipt.authority_epoch = p_authority_epoch
      and v_receipt.generation_binding_id = p_binding
      and v_receipt.request_digest = p_request_digest
      and v_receipt.idempotency_key = p_idempotency_key then
      return v_receipt.response_payload || jsonb_build_object('outcome', 'exact_replay');
    end if;
    return jsonb_build_object('outcome', 'rejected', 'errorCode', 'MUTATION_ID_CONFLICT');
  end if;
  if exists (select 1 from public.remote_mutation_receipts
    where authenticated_owner_id = p_owner and project_scope = p_project
      and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('outcome', 'rejected', 'errorCode', 'IDEMPOTENCY_CONFLICT');
  end if;

  select * into v_entity from public.health_workout_sessions_v2
  where user_id = p_owner and project_scope = p_project and id = p_entity_id
  for update;
  if p_base_revision is null then
    if found then
      v_error := 'ENTITY_ALREADY_EXISTS';
    elsif p_operation <> 'upsert' then
      v_error := 'NOT_FOUND';
    else
      v_revision := 1;
      v_record := p_payload -> 'record';
      v_content_hash := p_content_hash;
    end if;
  elsif not found then
    v_error := 'NOT_FOUND';
  elsif v_entity.revision <> p_base_revision then
    v_error := 'CAS_CONFLICT';
  elsif p_operation = 'restore' and not v_entity.is_deleted then
    v_error := 'ENTITY_NOT_TOMBSTONED';
  elsif p_operation <> 'restore' and v_entity.is_deleted then
    v_error := 'ENTITY_TOMBSTONED';
  elsif v_entity.revision >= 9007199254740991 then
    v_error := 'CAS_CONFLICT';
  else
    v_revision := v_entity.revision + 1;
    v_record := case when p_operation = 'tombstone' then v_entity.record
      else p_payload -> 'record' end;
    v_content_hash := case when p_operation = 'tombstone' then v_entity.content_hash
      else p_content_hash end;
  end if;
  if v_error is not null then
    return jsonb_build_object('outcome', 'rejected', 'errorCode', v_error,
      'currentServerRevision', v_entity.revision,
      'currentContentHash', v_entity.content_hash,
      'currentIsDeleted', v_entity.is_deleted,
      'currentRemoteMutationRef', v_entity.last_remote_mutation_ref::text);
  end if;
  if p_operation = 'tombstone' then
    begin
      v_deleted_at := (p_payload ->> 'deletedAt')::timestamptz;
    exception when others then
      raise exception 'REL05G4A_INVALID_PAYLOAD';
    end;
    if v_deleted_at is null then
      raise exception 'REL05G4A_INVALID_PAYLOAD';
    end if;
  end if;

  if p_base_revision is null then
    insert into public.health_workout_sessions_v2 (
      user_id, project_scope, id, revision, record, content_hash,
      authority_epoch, is_deleted, deleted_at, last_remote_mutation_ref,
      created_at, updated_at
    ) values (
      p_owner, p_project, p_entity_id, v_revision, v_record, v_content_hash,
      p_authority_epoch, false, null, v_ref, v_committed_at, v_committed_at
    );
  else
    update public.health_workout_sessions_v2 set
      revision = v_revision, record = v_record, content_hash = v_content_hash,
      authority_epoch = p_authority_epoch, is_deleted = (p_operation = 'tombstone'),
      deleted_at = v_deleted_at, last_remote_mutation_ref = v_ref,
      updated_at = v_committed_at
    where user_id = p_owner and project_scope = p_project and id = p_entity_id
      and revision = p_base_revision;
    if not found then
      raise exception 'REL05G4A_CAS_RACE';
    end if;
  end if;

  -- The existing owner/project stream lock serializes sequence allocation and
  -- fixed-watermark issuance, including unrelated K-323 domain appends.
  perform pg_advisory_xact_lock(hashtextextended(
    p_owner::text || '|' || p_project || '|stream', 0));
  insert into public.remote_reference_streams_v2 (authenticated_owner_id, project_scope)
  values (p_owner, p_project)
  on conflict (authenticated_owner_id, project_scope) do nothing;
  v_sequence := nextval('public.remote_reference_changes_v2_sequence_seq'::regclass);
  if v_sequence > 9007199254740991 then
    raise exception 'REL05G4A_SEQUENCE_EXHAUSTED';
  end if;
  v_response := jsonb_build_object(
    'protocolVersion', 2, 'outcome', 'success', 'errorCode', null,
    'domain', 'health_workout_session', 'entityId', p_entity_id::text,
    'mutationId', p_mutation_id, 'idempotencyKey', p_idempotency_key,
    'operation', p_operation, 'payloadHash', p_payload_hash,
    'contentHash', v_content_hash, 'authorityEpoch', p_authority_epoch,
    'bindingId', p_binding::text, 'remoteMutationRef', v_ref::text,
    'serverRevision', v_revision, 'changeSequence', v_sequence,
    'serverCommittedAt', v_committed_at);

  insert into public.remote_mutation_receipts (
    authenticated_owner_id, project_scope, namespace_fingerprint, generation_id,
    domain, entity_id, mutation_id, idempotency_key, operation, base_revision,
    local_revision, payload_digest, request_digest, result_code, result_revision,
    result_entity_updated_at, remote_mutation_ref, response_payload,
    protocol_version, device_id, change_sequence, authority_epoch,
    generation_binding_id, content_hash
  ) values (
    p_owner, p_project, p_namespace, p_generation, 'health_workout_session',
    p_entity_id, p_mutation_id, p_idempotency_key, p_operation, p_base_revision,
    p_local_revision, p_payload_hash, p_request_digest, 'APPLIED', v_revision,
    v_committed_at, v_ref, v_response, 2, p_device, v_sequence,
    p_authority_epoch, p_binding, v_content_hash
  );
  insert into public.remote_reference_changes_v2 (
    sequence, authenticated_owner_id, project_scope, namespace_fingerprint,
    generation_id, domain, entity_id, operation, server_revision, record,
    is_deleted, deleted_at, remote_mutation_ref, server_committed_at,
    authority_epoch, content_hash
  ) values (
    v_sequence, p_owner, p_project, p_namespace, p_generation,
    'health_workout_session', p_entity_id, p_operation, v_revision, v_record,
    p_operation = 'tombstone', v_deleted_at, v_ref, v_committed_at,
    p_authority_epoch, v_content_hash
  );
  return v_response;
end
$$;

create or replace function public.pull_health_workout_changes_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text, p_binding uuid, p_authority_epoch bigint,
  p_cursor bigint, p_server_epoch uuid, p_limit integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_error text;
  v_stream public.remote_reference_streams_v2%rowtype;
  v_changes jsonb;
  v_next_cursor bigint;
begin
  if p_cursor is null or p_cursor not between 0 and 9007199254740991
    or p_limit is null or p_limit not between 1 and 500 then
    raise exception 'REL05G4A_INVALID_PULL';
  end if;
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_context ->> 'errorCode');
  end if;
  if p_authority_epoch is distinct from (v_context ->> 'authorityEpoch')::bigint then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'STALE_AUTHORITY_EPOCH');
  end if;
  v_error := public.check_health_workout_binding_v1(
    p_owner, p_project, p_namespace, p_generation, p_device, p_binding, p_authority_epoch);
  if v_error is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_error);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_owner::text || '|' || p_project || '|stream', 0));
  select * into v_stream from public.remote_reference_streams_v2
  where authenticated_owner_id = p_owner and project_scope = p_project;
  if not found then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'FULL_RESYNC_REQUIRED');
  end if;
  if p_server_epoch is not null and p_server_epoch <> v_stream.server_epoch then
    return jsonb_build_object('protocolVersion', 2, 'status', 'full_resync_required',
      'errorCode', 'SERVER_EPOCH_MISMATCH', 'serverEpoch', v_stream.server_epoch::text,
      'retentionFloor', v_stream.retention_floor, 'nextCursor', v_stream.retention_floor,
      'changes', '[]'::jsonb);
  end if;
  if p_cursor < v_stream.retention_floor then
    return jsonb_build_object('protocolVersion', 2, 'status', 'full_resync_required',
      'errorCode', 'CURSOR_INVALID', 'serverEpoch', v_stream.server_epoch::text,
      'retentionFloor', v_stream.retention_floor, 'nextCursor', v_stream.retention_floor,
      'changes', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', page.sequence, 'domain', page.domain,
    'entityId', page.entity_id::text, 'operation', page.operation,
    'serverRevision', page.server_revision, 'record', page.record,
    'contentHash', page.content_hash, 'isDeleted', page.is_deleted,
    'deletedAt', page.deleted_at, 'remoteMutationRef', page.remote_mutation_ref::text,
    'serverCommittedAt', page.server_committed_at,
    'authorityEpoch', page.authority_epoch, 'serverEpoch', v_stream.server_epoch::text
  ) order by page.sequence), '[]'::jsonb), coalesce(max(page.sequence), p_cursor)
  into v_changes, v_next_cursor
  from (
    select * from public.remote_reference_changes_v2
    where authenticated_owner_id = p_owner and project_scope = p_project
      and domain = 'health_workout_session' and sequence > p_cursor
    order by sequence limit p_limit
  ) page;
  return jsonb_build_object('protocolVersion', 2, 'status', 'changes',
    'domain', 'health_workout_session', 'authorityEpoch', p_authority_epoch,
    'serverEpoch', v_stream.server_epoch::text,
    'retentionFloor', v_stream.retention_floor,
    'nextCursor', v_next_cursor, 'changes', v_changes, 'errorCode', null);
end
$$;

create or replace function public.begin_health_workout_snapshot_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text, p_binding uuid, p_authority_epoch bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_error text;
  v_server_epoch uuid;
  v_watermark bigint;
  v_token uuid;
begin
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_context ->> 'errorCode');
  end if;
  if p_authority_epoch is distinct from (v_context ->> 'authorityEpoch')::bigint then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'STALE_AUTHORITY_EPOCH');
  end if;
  v_error := public.check_health_workout_binding_v1(
    p_owner, p_project, p_namespace, p_generation, p_device, p_binding, p_authority_epoch);
  if v_error is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_error);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_owner::text || '|' || p_project || '|stream', 0));
  select server_epoch into v_server_epoch from public.remote_reference_streams_v2
  where authenticated_owner_id = p_owner and project_scope = p_project;
  if not found then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'FULL_RESYNC_REQUIRED');
  end if;
  select coalesce(max(sequence), 0) into v_watermark
  from public.remote_reference_changes_v2
  where authenticated_owner_id = p_owner and project_scope = p_project;
  insert into public.health_workout_snapshot_tokens (
    user_id, project_scope, binding_id, authority_epoch, server_epoch, watermark
  ) values (
    p_owner, p_project, p_binding, p_authority_epoch, v_server_epoch, v_watermark
  ) returning snapshot_id into v_token;
  return jsonb_build_object('protocolVersion', 2, 'status', 'snapshot',
    'domain', 'health_workout_session', 'snapshotToken', v_token::text,
    'authorityEpoch', p_authority_epoch, 'serverEpoch', v_server_epoch::text,
    'watermark', v_watermark, 'errorCode', null);
end
$$;

create or replace function public.page_health_workout_snapshot_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text, p_binding uuid, p_authority_epoch bigint,
  p_snapshot_token uuid, p_after_entity_id uuid, p_limit integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_error text;
  v_snapshot public.health_workout_snapshot_tokens%rowtype;
  v_current_server_epoch uuid;
  v_row record;
  v_rows jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_next_cursor uuid;
  v_has_more boolean := false;
begin
  if p_snapshot_token is null or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'REL05G4A_INVALID_SNAPSHOT_PAGE';
  end if;
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_context ->> 'errorCode');
  end if;
  if p_authority_epoch is distinct from (v_context ->> 'authorityEpoch')::bigint then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'STALE_AUTHORITY_EPOCH');
  end if;
  v_error := public.check_health_workout_binding_v1(
    p_owner, p_project, p_namespace, p_generation, p_device, p_binding, p_authority_epoch);
  if v_error is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_error);
  end if;
  select * into v_snapshot from public.health_workout_snapshot_tokens
  where snapshot_id = p_snapshot_token and user_id = p_owner
    and project_scope = p_project and domain = 'health_workout_session';
  if not found or v_snapshot.binding_id <> p_binding
    or v_snapshot.authority_epoch <> p_authority_epoch then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'SNAPSHOT_TOKEN_INVALID');
  end if;
  select server_epoch into v_current_server_epoch from public.remote_reference_streams_v2
  where authenticated_owner_id = p_owner and project_scope = p_project;
  if v_current_server_epoch is distinct from v_snapshot.server_epoch then
    return jsonb_build_object('status', 'full_resync_required',
      'errorCode', 'SNAPSHOT_TOKEN_INVALID');
  end if;
  -- DISTINCT ON picks the last committed event at/before the immutable
  -- watermark. Paging over mutable current rows would violate this contract.
  for v_row in
    select latest.* from (
      select distinct on (entity_id) * from public.remote_reference_changes_v2
      where authenticated_owner_id = p_owner and project_scope = p_project
        and domain = 'health_workout_session'
        and sequence <= v_snapshot.watermark
        and (p_after_entity_id is null or entity_id > p_after_entity_id)
      order by entity_id, sequence desc
    ) latest order by latest.entity_id limit p_limit + 1
  loop
    if v_count = p_limit then
      v_has_more := true;
      exit;
    end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'entityId', v_row.entity_id::text, 'serverRevision', v_row.server_revision,
      'record', v_row.record, 'contentHash', v_row.content_hash,
      'isDeleted', v_row.is_deleted, 'deletedAt', v_row.deleted_at,
      'remoteMutationRef', v_row.remote_mutation_ref::text,
      'serverCommittedAt', v_row.server_committed_at,
      'sequence', v_row.sequence));
    v_next_cursor := v_row.entity_id;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('protocolVersion', 2, 'status', 'snapshot_page',
    'domain', 'health_workout_session', 'snapshotToken', p_snapshot_token::text,
    'authorityEpoch', v_snapshot.authority_epoch,
    'serverEpoch', v_snapshot.server_epoch::text,
    'watermark', v_snapshot.watermark, 'rows', v_rows,
    'nextEntityId', case when v_has_more then v_next_cursor::text else null end,
    'hasMore', v_has_more, 'errorCode', null);
end
$$;

-- Only the trusted backend's service role can execute the authority RPCs.
-- Direct workout table DML stays revoked; existing generic K-323 grants are
-- unchanged for their already-active domains.
revoke all on function public.lock_health_workout_authority_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.reject_immutable_workout_row_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_workout_shared_insert_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.health_workout_authority_context_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.check_health_workout_binding_v1(
  uuid, text, text, text, text, uuid, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.read_health_workout_authority_v1(
  uuid, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.register_health_workout_generation_v1(
  uuid, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.apply_health_workout_mutation_v1(
  uuid, text, text, text, text, uuid, bigint,
  uuid, text, text, text, bigint, bigint, jsonb, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.pull_health_workout_changes_v1(
  uuid, text, text, text, text, uuid, bigint, bigint, uuid, integer
) from public, anon, authenticated, service_role;
revoke all on function public.begin_health_workout_snapshot_v1(
  uuid, text, text, text, text, uuid, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.page_health_workout_snapshot_v1(
  uuid, text, text, text, text, uuid, bigint, uuid, uuid, integer
) from public, anon, authenticated, service_role;

grant execute on function public.read_health_workout_authority_v1(
  uuid, text, text, text, text
) to service_role;
grant execute on function public.register_health_workout_generation_v1(
  uuid, text, text, text, text
) to service_role;
grant execute on function public.apply_health_workout_mutation_v1(
  uuid, text, text, text, text, uuid, bigint,
  uuid, text, text, text, bigint, bigint, jsonb, text, text, text
) to service_role;
grant execute on function public.pull_health_workout_changes_v1(
  uuid, text, text, text, text, uuid, bigint, bigint, uuid, integer
) to service_role;
grant execute on function public.begin_health_workout_snapshot_v1(
  uuid, text, text, text, text, uuid, bigint
) to service_role;
grant execute on function public.page_health_workout_snapshot_v1(
  uuid, text, text, text, text, uuid, bigint, uuid, uuid, integer
) to service_role;

commit;
