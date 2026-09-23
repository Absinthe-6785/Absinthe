begin;

-- REL-05F adds two closed Health domains to the existing K-323 v2 receipt and
-- append-only change infrastructure. Health authority itself lives in typed
-- tables below; reference_entities_v2 remains reference-only.
alter table public.remote_mutation_receipts
  drop constraint if exists remote_mutation_receipts_domain_check;
alter table public.remote_mutation_receipts
  add constraint remote_mutation_receipts_domain_check
  check (domain in (
    'notes', 'reference_alpha', 'reference_beta',
    'health_routine_preset', 'health_routine_profile'
  )) not valid;

alter table public.remote_mutation_receipts
  drop constraint if exists remote_mutation_receipts_v2_shape_check;
alter table public.remote_mutation_receipts
  add constraint remote_mutation_receipts_v2_shape_check
  check (
    protocol_version = 1 or (
      domain in (
        'reference_alpha', 'reference_beta',
        'health_routine_preset', 'health_routine_profile'
      )
      and device_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
      and ((result_code = 'APPLIED') = (change_sequence is not null))
    )
  ) not valid;

alter table public.remote_reference_changes_v2
  drop constraint if exists remote_reference_changes_v2_domain_check;
alter table public.remote_reference_changes_v2
  add constraint remote_reference_changes_v2_domain_check
  check (domain in (
    'reference_alpha', 'reference_beta',
    'health_routine_preset', 'health_routine_profile'
  )) not valid;

create table if not exists public.health_routine_presets (
  user_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  id uuid not null,
  name text not null check (char_length(name) between 1 and 48 and name = btrim(name)),
  split_count smallint not null check (split_count between 1 and 7),
  days jsonb not null,
  is_default boolean not null,
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  last_remote_mutation_ref uuid not null,
  primary key (user_id, project_scope, id),
  check (jsonb_typeof(days) = 'array'),
  check (jsonb_array_length(days) = split_count),
  check (octet_length(days::text) <= 131072)
);

create unique index if not exists health_routine_presets_one_live_default
  on public.health_routine_presets (user_id, project_scope)
  where is_default and deleted_at is null;
create index if not exists health_routine_presets_live_owner
  on public.health_routine_presets (user_id, project_scope, updated_at, id)
  where deleted_at is null;

create table if not exists public.health_routine_profile (
  user_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  id uuid not null,
  active_preset_id uuid,
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null,
  last_remote_mutation_ref uuid not null,
  primary key (user_id, project_scope),
  unique (user_id, project_scope, id),
  check (id = '00000000-0000-5000-8000-000000000002'::uuid)
);

alter table public.health_routine_presets enable row level security;
alter table public.health_routine_profile enable row level security;

drop policy if exists health_routine_presets_owner_select on public.health_routine_presets;
create policy health_routine_presets_owner_select on public.health_routine_presets
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists health_routine_profile_owner_select on public.health_routine_profile;
create policy health_routine_profile_owner_select on public.health_routine_profile
  for select to authenticated using ((select auth.uid()) = user_id);

-- Backend-authenticated generation registration. The JWT owner is supplied by
-- the backend only; callers cannot choose another owner through the public API.
create or replace function public.ensure_remote_health_generation_v2(
  p_authenticated_owner_id uuid,
  p_project_scope text,
  p_namespace_fingerprint text,
  p_generation_id text,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_epoch uuid;
begin
  if p_authenticated_owner_id is null
    or p_project_scope !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_namespace_fingerprint !~ '^[a-f0-9]{64}$'
    or p_generation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_device_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'K323_V2_INVALID_GENERATION';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|generation|' || p_namespace_fingerprint,
    0
  ));
  update public.remote_sync_generations
  set status = 'stale'
  where owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope
    and namespace_fingerprint = p_namespace_fingerprint
    and generation_id <> p_generation_id
    and status = 'active';
  insert into public.remote_sync_generations (
    owner_id, project_scope, namespace_fingerprint, generation_id, status
  ) values (
    p_authenticated_owner_id, p_project_scope, p_namespace_fingerprint, p_generation_id, 'active'
  ) on conflict (owner_id, project_scope, namespace_fingerprint, generation_id)
  do update set status = 'active';

  insert into public.remote_reference_streams_v2 (authenticated_owner_id, project_scope)
  values (p_authenticated_owner_id, p_project_scope)
  on conflict (authenticated_owner_id, project_scope) do nothing;
  select server_epoch into v_epoch
  from public.remote_reference_streams_v2
  where authenticated_owner_id = p_authenticated_owner_id and project_scope = p_project_scope;

  return jsonb_build_object(
    'protocolVersion', 2, 'status', 'active',
    'namespaceKey', p_namespace_fingerprint, 'generationId', p_generation_id,
    'deviceId', p_device_id, 'serverEpoch', v_epoch::text
  );
end
$$;

-- Legacy child rows are a one-way compatibility projection only. Rebuilding
-- the complete default preset removes stale rows (including a removed Day 4)
-- in the same transaction as the aggregate mutation.
create or replace function public.project_health_routines_legacy_v2(
  p_user_id uuid,
  p_days jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocks_udt text;
begin
  if to_regclass('public.health_routines') is null then
    return;
  end if;
  execute 'delete from public.health_routines where user_id = $1' using p_user_id;
  if p_days is null then
    return;
  end if;
  select udt_name into v_blocks_udt
  from information_schema.columns
  where table_schema = 'public' and table_name = 'health_routines' and column_name = 'blocks';
  if v_blocks_udt = '_uuid' then
    execute $projection$
      insert into public.health_routines (user_id, day_name, blocks)
      select $1, day ->> 'dayName',
        array(select jsonb_array_elements_text(day -> 'blocks'))::uuid[]
      from jsonb_array_elements($2) day
    $projection$ using p_user_id, p_days;
  else
    execute $projection$
      insert into public.health_routines (user_id, day_name, blocks)
      select $1, day ->> 'dayName', day -> 'blocks'
      from jsonb_array_elements($2) day
    $projection$ using p_user_id, p_days;
  end if;
end
$$;

create or replace function public.apply_health_routine_mutation_v2(
  p_authenticated_owner_id uuid,
  p_project_scope text,
  p_namespace_fingerprint text,
  p_generation_id text,
  p_device_id text,
  p_domain text,
  p_entity_id text,
  p_mutation_id text,
  p_idempotency_key text,
  p_operation text,
  p_base_revision bigint,
  p_local_revision bigint,
  p_payload jsonb,
  p_payload_digest text,
  p_request_digest text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entity_id uuid;
  v_generation_status text;
  v_existing_receipt public.remote_mutation_receipts%rowtype;
  v_record jsonb;
  v_existing_record jsonb;
  v_existing_revision bigint;
  v_existing_deleted_at timestamptz;
  v_exists boolean := false;
  v_remote_ref uuid := gen_random_uuid();
  v_committed_at timestamptz := clock_timestamp();
  v_deleted_at timestamptz;
  v_server_revision bigint;
  v_change_sequence bigint;
  v_error_code text;
  v_outcome text;
  v_response jsonb;
  v_active_preset_id uuid;
  v_default_days jsonb;
begin
  if p_authenticated_owner_id is null
    or p_project_scope !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_namespace_fingerprint !~ '^[a-f0-9]{64}$'
    or p_generation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_device_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_domain not in ('health_routine_preset', 'health_routine_profile')
    or p_operation not in ('upsert', 'tombstone', 'restore')
    or (p_domain = 'health_routine_profile' and p_operation <> 'upsert')
    or p_mutation_id !~ '^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_idempotency_key !~ '^k322\.[a-f0-9]{64}$'
    or p_payload_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$'
    or p_local_revision < 1 or p_local_revision > 9007199254740991
    or p_created_at is null then
    raise exception 'K323_V2_INVALID_MUTATION';
  end if;
  begin
    v_entity_id := p_entity_id::uuid;
  exception when invalid_text_representation then
    raise exception 'K323_V2_INVALID_MUTATION';
  end;
  if p_base_revision is not null and (p_base_revision < 1 or p_base_revision > 9007199254740991) then
    raise exception 'K323_V2_INVALID_MUTATION';
  end if;
  if p_operation in ('upsert', 'restore') then
    if p_payload #>> '{kind}' <> 'entity_snapshot' or p_payload #>> '{record,id}' <> p_entity_id then
      raise exception 'K323_V2_INVALID_MUTATION';
    end if;
    v_record := p_payload #> '{record}';
  elsif p_payload #>> '{kind}' <> 'tombstone'
    or p_payload #>> '{entityId}' <> p_entity_id
    or (p_payload #>> '{revision}')::bigint <> p_local_revision then
    raise exception 'K323_V2_INVALID_MUTATION';
  end if;

  perform pg_advisory_xact_lock_shared(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|generation|' ||
      p_namespace_fingerprint || '|' || p_generation_id, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|idem|' || p_idempotency_key, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|mutation|' || p_mutation_id, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|stream', 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|health|' || p_domain || '|' || p_entity_id, 0
  ));

  select * into v_existing_receipt
  from public.remote_mutation_receipts
  where authenticated_owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_receipt.protocol_version = 2
      and v_existing_receipt.mutation_id = p_mutation_id
      and v_existing_receipt.request_digest = p_request_digest then
      return v_existing_receipt.response_payload;
    end if;
    return jsonb_build_object(
      'protocolVersion', 2, 'outcome', 'rejected', 'mutationId', p_mutation_id,
      'idempotencyKey', p_idempotency_key, 'domain', p_domain, 'entityId', p_entity_id,
      'operation', p_operation, 'payloadHash', p_payload_digest, 'remoteMutationRef', null,
      'serverRevision', null, 'changeSequence', null, 'serverCommittedAt', null,
      'errorCode', 'IDEMPOTENCY_CONFLICT', 'retryable', false
    );
  end if;
  select * into v_existing_receipt
  from public.remote_mutation_receipts
  where authenticated_owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope and mutation_id = p_mutation_id;
  if found then
    return jsonb_build_object(
      'protocolVersion', 2, 'outcome', 'rejected', 'mutationId', p_mutation_id,
      'idempotencyKey', p_idempotency_key, 'domain', p_domain, 'entityId', p_entity_id,
      'operation', p_operation, 'payloadHash', p_payload_digest, 'remoteMutationRef', null,
      'serverRevision', null, 'changeSequence', null, 'serverCommittedAt', null,
      'errorCode', 'MUTATION_ID_CONFLICT', 'retryable', false
    );
  end if;

  select status into v_generation_status
  from public.remote_sync_generations
  where owner_id = p_authenticated_owner_id and project_scope = p_project_scope
    and namespace_fingerprint = p_namespace_fingerprint and generation_id = p_generation_id;
  if not found then v_error_code := 'UNKNOWN_GENERATION';
  elsif v_generation_status <> 'active' then v_error_code := 'STALE_GENERATION';
  end if;

  if v_error_code is null and p_domain = 'health_routine_preset'
    and p_operation = 'tombstone'
    and v_entity_id = '00000000-0000-5000-8000-000000000001'::uuid then
    v_error_code := 'DEFAULT_PRESET_REQUIRED';
  elsif v_error_code is null and p_domain = 'health_routine_preset'
    and p_operation in ('upsert', 'restore')
    and case
      when jsonb_typeof(v_record -> 'isDefault') = 'boolean' then
        (v_record ->> 'isDefault')::boolean is distinct from
          (v_entity_id = '00000000-0000-5000-8000-000000000001'::uuid)
      else true
    end then
    v_error_code := 'MALFORMED_PAYLOAD';
  end if;

  if v_error_code is null and p_domain = 'health_routine_preset' then
    select jsonb_build_object(
      'id', id::text, 'name', name, 'splitCount', split_count,
      'days', days, 'isDefault', is_default
    ), revision, deleted_at, true
    into v_existing_record, v_existing_revision, v_existing_deleted_at, v_exists
    from public.health_routine_presets
    where user_id = p_authenticated_owner_id and project_scope = p_project_scope and id = v_entity_id
    for update;
    v_exists := found;
  elsif v_error_code is null then
    select jsonb_build_object('id', id::text, 'activePresetId', active_preset_id::text),
      revision, null::timestamptz, true
    into v_existing_record, v_existing_revision, v_existing_deleted_at, v_exists
    from public.health_routine_profile
    where user_id = p_authenticated_owner_id and project_scope = p_project_scope
    for update;
    v_exists := found;
  end if;

  if v_error_code is null then
    if p_base_revision is null then
      if v_exists then v_error_code := 'REMOTE_ENTITY_ALREADY_EXISTS';
      elsif p_operation <> 'upsert' then v_error_code := 'REMOTE_ENTITY_NOT_FOUND';
      else v_server_revision := 1; v_deleted_at := null;
      end if;
    elsif not v_exists then v_error_code := 'REMOTE_ENTITY_NOT_FOUND';
    elsif v_existing_revision is distinct from p_base_revision then v_error_code := 'REMOTE_REVISION_CONFLICT';
    elsif p_operation = 'restore' and v_existing_deleted_at is null then v_error_code := 'REMOTE_ENTITY_NOT_TOMBSTONED';
    elsif p_operation <> 'restore' and v_existing_deleted_at is not null then v_error_code := 'REMOTE_ENTITY_TOMBSTONED';
    else
      v_server_revision := v_existing_revision + 1;
      v_deleted_at := case when p_operation = 'tombstone'
        then (p_payload #>> '{deletedAt}')::timestamptz else null end;
      if p_operation = 'tombstone' then v_record := v_existing_record; end if;
    end if;
  end if;

  if v_error_code is null and p_domain = 'health_routine_profile' then
    if v_entity_id <> '00000000-0000-5000-8000-000000000002'::uuid then
      v_error_code := 'MALFORMED_PAYLOAD';
    elsif v_record ->> 'activePresetId' is not null then
      begin v_active_preset_id := (v_record ->> 'activePresetId')::uuid;
      exception when invalid_text_representation then v_error_code := 'MALFORMED_PAYLOAD'; end;
      if v_error_code is null and not exists (
        select 1 from public.health_routine_presets
        where user_id = p_authenticated_owner_id and project_scope = p_project_scope
          and id = v_active_preset_id and deleted_at is null
      ) then v_error_code := 'ACTIVE_PRESET_NOT_FOUND'; end if;
    end if;
  elsif v_error_code is null and p_domain = 'health_routine_preset' and p_operation = 'tombstone'
    and exists (
      select 1 from public.health_routine_profile
      where user_id = p_authenticated_owner_id and project_scope = p_project_scope
        and active_preset_id = v_entity_id
    ) then
    v_error_code := 'ACTIVE_PRESET_DELETE_REQUIRES_PROFILE_UPDATE';
  end if;

  if v_error_code is null then
    if p_domain = 'health_routine_preset' then
      insert into public.health_routine_presets (
        user_id, project_scope, id, name, split_count, days, is_default,
        revision, updated_at, deleted_at, last_remote_mutation_ref
      ) values (
        p_authenticated_owner_id, p_project_scope, v_entity_id,
        v_record ->> 'name', (v_record ->> 'splitCount')::smallint,
        v_record -> 'days', (v_record ->> 'isDefault')::boolean,
        v_server_revision, v_committed_at, v_deleted_at, v_remote_ref
      ) on conflict (user_id, project_scope, id) do update set
        name = excluded.name, split_count = excluded.split_count, days = excluded.days,
        is_default = excluded.is_default, revision = excluded.revision,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
        last_remote_mutation_ref = excluded.last_remote_mutation_ref;
    else
      v_active_preset_id := nullif(v_record ->> 'activePresetId', '')::uuid;
      insert into public.health_routine_profile (
        user_id, project_scope, id, active_preset_id, revision, updated_at, last_remote_mutation_ref
      ) values (
        p_authenticated_owner_id, p_project_scope, v_entity_id, v_active_preset_id,
        v_server_revision, v_committed_at, v_remote_ref
      ) on conflict (user_id, project_scope) do update set
        id = excluded.id, active_preset_id = excluded.active_preset_id,
        revision = excluded.revision, updated_at = excluded.updated_at,
        last_remote_mutation_ref = excluded.last_remote_mutation_ref;
    end if;

    insert into public.remote_reference_changes_v2 (
      authenticated_owner_id, project_scope, namespace_fingerprint, generation_id,
      domain, entity_id, operation, server_revision, record, is_deleted, deleted_at,
      remote_mutation_ref, server_committed_at
    ) values (
      p_authenticated_owner_id, p_project_scope, p_namespace_fingerprint, p_generation_id,
      p_domain, v_entity_id, p_operation, v_server_revision, v_record,
      p_operation = 'tombstone', v_deleted_at, v_remote_ref, v_committed_at
    ) returning sequence into v_change_sequence;

    if p_domain = 'health_routine_preset' then
      select days into v_default_days from public.health_routine_presets
      where user_id = p_authenticated_owner_id and project_scope = p_project_scope
        and is_default and deleted_at is null;
      perform public.project_health_routines_legacy_v2(p_authenticated_owner_id, v_default_days);
    end if;

    v_outcome := 'applied';
    v_response := jsonb_build_object(
      'protocolVersion', 2, 'outcome', v_outcome, 'mutationId', p_mutation_id,
      'idempotencyKey', p_idempotency_key, 'domain', p_domain, 'entityId', p_entity_id,
      'operation', p_operation, 'payloadHash', p_payload_digest,
      'remoteMutationRef', v_remote_ref::text, 'serverRevision', v_server_revision,
      'changeSequence', v_change_sequence, 'serverCommittedAt', v_committed_at,
      'errorCode', null, 'retryable', false
    );
  else
    v_outcome := case when v_error_code = 'REMOTE_REVISION_CONFLICT' then 'revision_conflict' else 'rejected' end;
    v_remote_ref := null; v_committed_at := null;
    v_response := jsonb_build_object(
      'protocolVersion', 2, 'outcome', v_outcome, 'mutationId', p_mutation_id,
      'idempotencyKey', p_idempotency_key, 'domain', p_domain, 'entityId', p_entity_id,
      'operation', p_operation, 'payloadHash', p_payload_digest,
      'remoteMutationRef', null, 'serverRevision', null, 'changeSequence', null,
      'serverCommittedAt', null, 'errorCode', v_error_code, 'retryable', false
    );
  end if;

  insert into public.remote_mutation_receipts (
    authenticated_owner_id, project_scope, namespace_fingerprint, generation_id,
    domain, entity_id, mutation_id, idempotency_key, operation, base_revision,
    local_revision, payload_digest, request_digest, result_code, result_revision,
    result_entity_updated_at, remote_mutation_ref, response_payload,
    protocol_version, device_id, change_sequence
  ) values (
    p_authenticated_owner_id, p_project_scope, p_namespace_fingerprint, p_generation_id,
    p_domain, v_entity_id, p_mutation_id, p_idempotency_key, p_operation, p_base_revision,
    p_local_revision, p_payload_digest, p_request_digest, coalesce(v_error_code, 'APPLIED'),
    v_server_revision, v_committed_at, v_remote_ref, v_response, 2, p_device_id, v_change_sequence
  );
  return v_response;
end
$$;

create or replace function public.pull_health_routine_changes_v2(
  p_authenticated_owner_id uuid,
  p_project_scope text,
  p_namespace_fingerprint text,
  p_generation_id text,
  p_domain text,
  p_cursor bigint,
  p_server_epoch text,
  p_limit integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_generation_status text;
  v_stream public.remote_reference_streams_v2%rowtype;
  v_changes jsonb;
  v_next_cursor bigint;
  v_error_code text;
begin
  if p_authenticated_owner_id is null
    or p_project_scope !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_namespace_fingerprint !~ '^[a-f0-9]{64}$'
    or p_generation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_domain not in ('health_routine_preset', 'health_routine_profile')
    or p_cursor < 0 or p_cursor > 9007199254740991
    or p_limit < 1 or p_limit > 500
    or (p_server_epoch is not null and p_server_epoch !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    raise exception 'K323_V2_INVALID_PULL';
  end if;
  perform pg_advisory_xact_lock_shared(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|generation|' ||
      p_namespace_fingerprint || '|' || p_generation_id, 0
  ));
  select * into v_stream from public.remote_reference_streams_v2
  where authenticated_owner_id = p_authenticated_owner_id and project_scope = p_project_scope;
  select status into v_generation_status from public.remote_sync_generations
  where owner_id = p_authenticated_owner_id and project_scope = p_project_scope
    and namespace_fingerprint = p_namespace_fingerprint and generation_id = p_generation_id;
  if not found then v_error_code := 'UNKNOWN_GENERATION';
  elsif v_generation_status <> 'active' then v_error_code := 'STALE_GENERATION';
  end if;
  if v_error_code is not null then
    return jsonb_build_object(
      'protocolVersion', 2, 'status', 'rejected', 'domain', p_domain,
      'serverEpoch', v_stream.server_epoch::text, 'retentionFloor', v_stream.retention_floor,
      'nextCursor', p_cursor, 'changes', '[]'::jsonb, 'errorCode', v_error_code
    );
  end if;
  if p_server_epoch is not null and p_server_epoch::uuid <> v_stream.server_epoch then
    return jsonb_build_object(
      'protocolVersion', 2, 'status', 'full_resync_required', 'domain', p_domain,
      'serverEpoch', v_stream.server_epoch::text, 'retentionFloor', v_stream.retention_floor,
      'nextCursor', v_stream.retention_floor, 'changes', '[]'::jsonb,
      'errorCode', 'SERVER_EPOCH_MISMATCH'
    );
  end if;
  if p_cursor < v_stream.retention_floor then
    return jsonb_build_object(
      'protocolVersion', 2, 'status', 'full_resync_required', 'domain', p_domain,
      'serverEpoch', v_stream.server_epoch::text, 'retentionFloor', v_stream.retention_floor,
      'nextCursor', v_stream.retention_floor, 'changes', '[]'::jsonb, 'errorCode', 'CURSOR_INVALID'
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', page.sequence, 'domain', page.domain, 'entityId', page.entity_id::text,
    'operation', page.operation, 'serverRevision', page.server_revision, 'record', page.record,
    'isDeleted', page.is_deleted, 'deletedAt', page.deleted_at,
    'remoteMutationRef', page.remote_mutation_ref::text,
    'serverCommittedAt', page.server_committed_at
  ) order by page.sequence), '[]'::jsonb), coalesce(max(page.sequence), p_cursor)
  into v_changes, v_next_cursor
  from (
    select * from public.remote_reference_changes_v2
    where authenticated_owner_id = p_authenticated_owner_id
      and project_scope = p_project_scope and domain = p_domain and sequence > p_cursor
    order by sequence limit p_limit
  ) page;
  return jsonb_build_object(
    'protocolVersion', 2, 'status', 'changes', 'domain', p_domain,
    'serverEpoch', v_stream.server_epoch::text, 'retentionFloor', v_stream.retention_floor,
    'nextCursor', v_next_cursor, 'changes', v_changes, 'errorCode', null
  );
end
$$;

revoke all on public.health_routine_presets from public, anon, authenticated, service_role;
revoke all on public.health_routine_profile from public, anon, authenticated, service_role;
grant select, insert, update on public.health_routine_presets to service_role;
grant select, insert, update on public.health_routine_profile to service_role;

revoke all on function public.ensure_remote_health_generation_v2(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.project_health_routines_legacy_v2(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_health_routine_mutation_v2(
  uuid, text, text, text, text, text, text, text, text, text,
  bigint, bigint, jsonb, text, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.pull_health_routine_changes_v2(
  uuid, text, text, text, text, bigint, text, integer
) from public, anon, authenticated, service_role;

grant execute on function public.ensure_remote_health_generation_v2(uuid, text, text, text, text)
  to service_role;
grant execute on function public.project_health_routines_legacy_v2(uuid, jsonb)
  to service_role;
grant execute on function public.apply_health_routine_mutation_v2(
  uuid, text, text, text, text, text, text, text, text, text,
  bigint, bigint, jsonb, text, text, timestamptz
) to service_role;
grant execute on function public.pull_health_routine_changes_v2(
  uuid, text, text, text, text, bigint, text, integer
) to service_role;

commit;
