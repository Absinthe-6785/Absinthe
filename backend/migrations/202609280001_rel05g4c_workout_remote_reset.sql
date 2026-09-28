begin;

-- A reset is an owner/project Workout authority transition, not a table clear.
-- The G4A authority row already reserves RESET_FENCED and current_reset_job_id.
create table public.health_workout_reset_jobs (
  user_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  domain text not null default 'health_workout_session' check (domain = 'health_workout_session'),
  reset_id uuid not null check (reset_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  request_digest text not null check (request_digest ~ '^[a-f0-9]{64}$'),
  -- Two independent server UUIDv4 values contribute 244 unpredictable bits.
  -- This secret never leaves the service-function-only job table.
  receipt_secret bytea not null default pg_catalog.decode(
    replace(pg_catalog.gen_random_uuid()::text, '-', '') ||
    replace(pg_catalog.gen_random_uuid()::text, '-', ''), 'hex')
    check (pg_catalog.octet_length(receipt_secret) = 32),
  namespace_fingerprint text not null check (namespace_fingerprint ~ '^[a-f0-9]{64}$'),
  generation_id text not null check (generation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  device_id text not null check (device_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  generation_binding_id uuid not null,
  source_epoch bigint not null check (source_epoch between 1 and 9007199254740990),
  target_epoch bigint not null check (target_epoch = source_epoch + 1),
  phase text not null check (phase in ('APPLYING', 'COMPLETED')),
  inventory_count bigint not null check (inventory_count >= 0),
  active_count bigint not null check (active_count between 0 and inventory_count),
  applied_count bigint not null default 0 check (applied_count >= 0 and applied_count <= active_count),
  inventory_digest text not null check (inventory_digest ~ '^[a-f0-9]{64}$'),
  completion_digest text check (completion_digest ~ '^[a-f0-9]{64}$'),
  started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  primary key (user_id, project_scope, domain, reset_id),
  unique (user_id, project_scope, domain, source_epoch),
  check ((phase = 'APPLYING' and completed_at is null and completion_digest is null)
    or (phase = 'COMPLETED' and completed_at is not null and completion_digest is not null
      and applied_count = active_count))
);

create table public.health_workout_reset_items (
  user_id uuid not null,
  project_scope text not null,
  domain text not null default 'health_workout_session' check (domain = 'health_workout_session'),
  reset_id uuid not null,
  entity_id uuid not null,
  source_revision bigint not null check (source_revision between 1 and 9007199254740991),
  source_record jsonb not null check (jsonb_typeof(source_record) = 'object'),
  source_content_hash text check (source_content_hash ~ '^[a-f0-9]{64}$'),
  source_is_deleted boolean not null,
  source_deleted_at timestamptz,
  source_remote_ref uuid,
  reset_ref uuid not null,
  state text not null check (state in ('PENDING', 'APPLIED', 'ALREADY_DELETED')),
  change_sequence bigint check (change_sequence between 1 and 9007199254740991),
  applied_at timestamptz,
  primary key (user_id, project_scope, domain, reset_id, entity_id),
  foreign key (user_id, project_scope, domain, reset_id)
    references public.health_workout_reset_jobs (user_id, project_scope, domain, reset_id),
  check (source_is_deleted = (source_deleted_at is not null)),
  check ((source_is_deleted and state = 'ALREADY_DELETED'
      and change_sequence is null and applied_at is null)
    or (not source_is_deleted and source_content_hash is not null and source_remote_ref is not null
      and ((state = 'PENDING' and change_sequence is null and applied_at is null)
        or (state = 'APPLIED' and change_sequence is not null and applied_at is not null))))
);
create unique index health_workout_reset_items_ref
  on public.health_workout_reset_items (user_id, project_scope, reset_ref);
create index health_workout_reset_items_pending
  on public.health_workout_reset_items (user_id, project_scope, domain, reset_id, entity_id)
  where state = 'PENDING';

alter table public.health_workout_reset_jobs enable row level security;
alter table public.health_workout_reset_items enable row level security;
revoke all on public.health_workout_reset_jobs from public, anon, authenticated, service_role;
revoke all on public.health_workout_reset_items from public, anon, authenticated, service_role;

create function public.begin_health_workout_reset_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text, p_binding uuid, p_authority_epoch bigint,
  p_reset_id uuid, p_request_digest text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_job public.health_workout_reset_jobs%rowtype;
  v_authority public.health_workout_authorities%rowtype;
  v_error text;
  v_expected_digest text;
  v_inventory_count bigint;
  v_active_count bigint;
  v_inventory_digest text := repeat('0', 64);
  v_item public.health_workout_reset_items%rowtype;
begin
  if p_namespace is null or p_namespace !~ '^[a-f0-9]{64}$'
    or p_generation is null or p_generation !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_device is null or p_device !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_binding is null or p_authority_epoch is null
    or p_reset_id is null or p_reset_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_request_digest is null or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'REL05G4C_INVALID_RESET';
  end if;
  -- Context takes the sole G4A authority lock before reading capability/epoch.
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' = 'CAPABILITY_DISABLED' then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'CAPABILITY_DISABLED');
  end if;
  v_expected_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(replace(json_build_array(
    'absinthe-workout-reset-v1', 2, p_owner::text, p_project,
    'health_workout_session', p_namespace, p_generation, p_device,
    p_binding::text, p_authority_epoch, p_reset_id::text
  )::text, ', ', ','), 'UTF8')), 'hex');
  if p_request_digest <> v_expected_digest then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'REQUEST_DIGEST_MISMATCH');
  end if;
  select * into v_job from public.health_workout_reset_jobs
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session' and reset_id = p_reset_id;
  if found then
    if v_job.request_digest <> p_request_digest then
      return jsonb_build_object('status', 'rejected', 'errorCode', 'RESET_ID_CONFLICT');
    end if;
    return jsonb_build_object('protocolVersion', 2, 'status',
      case when v_job.phase = 'COMPLETED' then 'completed' else 'applying' end,
      'resetId', p_reset_id::text, 'sourceEpoch', v_job.source_epoch,
      'targetEpoch', v_job.target_epoch, 'inventoryCount', v_job.inventory_count,
      'activeCount', v_job.active_count, 'appliedCount', v_job.applied_count,
      'inventoryDigest', v_job.inventory_digest,
      'completionDigest', v_job.completion_digest, 'errorCode', null);
  end if;
  if v_context ->> 'errorCode' is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_context ->> 'errorCode');
  end if;
  if p_authority_epoch is distinct from (v_context ->> 'authorityEpoch')::bigint then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'STALE_AUTHORITY_EPOCH');
  end if;
  if p_authority_epoch >= 9007199254740991 then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'RESET_EPOCH_EXHAUSTED');
  end if;
  v_error := public.check_health_workout_binding_v1(
    p_owner, p_project, p_namespace, p_generation, p_device, p_binding, p_authority_epoch);
  if v_error is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', v_error);
  end if;
  select * into v_authority from public.health_workout_authorities
  where user_id = p_owner and project_scope = p_project and domain = 'health_workout_session';
  if v_authority.state <> 'OPEN' or v_authority.current_reset_job_id is not null then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'RESET_IN_PROGRESS');
  end if;
  -- G1 dormant rows without canonical G4A hash/ref/receipt cannot be made
  -- into a valid G4B3 change. Fail BEFORE advancing the authority epoch.
  if exists (select 1 from public.health_workout_sessions_v2 e
    where e.user_id = p_owner and e.project_scope = p_project and not e.is_deleted
      and (e.authority_epoch is distinct from p_authority_epoch
        or e.revision >= 9007199254740991
        or e.content_hash is null or e.content_hash !~ '^[a-f0-9]{64}$'
        or e.last_remote_mutation_ref is null
        or not exists (select 1 from public.remote_mutation_receipts r
          where r.authenticated_owner_id = p_owner and r.project_scope = p_project
            and r.domain = 'health_workout_session' and r.entity_id = e.id
            and r.remote_mutation_ref = e.last_remote_mutation_ref
            and r.result_revision = e.revision and r.authority_epoch = p_authority_epoch
            and r.content_hash = e.content_hash and r.result_code = 'APPLIED')))
    then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'RESET_INVENTORY_UNSUPPORTED');
  end if;
  insert into public.health_workout_reset_jobs (
    user_id, project_scope, reset_id, request_digest, namespace_fingerprint,
    generation_id, device_id, generation_binding_id, source_epoch, target_epoch,
    phase, inventory_count, active_count, inventory_digest
  ) values (
    p_owner, p_project, p_reset_id, p_request_digest, p_namespace,
    p_generation, p_device, p_binding, p_authority_epoch, p_authority_epoch + 1,
    'APPLYING', 0, 0, repeat('0', 64)
  );
  -- The authority lock excludes all G4A writes for this owner/project while
  -- this fixed manifest is built. Deleted rows are counted but not re-tombstoned.
  insert into public.health_workout_reset_items (
    user_id, project_scope, reset_id, entity_id, source_revision, source_record,
    source_content_hash, source_is_deleted, source_deleted_at, source_remote_ref,
    reset_ref, state
  )
  select p_owner, p_project, p_reset_id, e.id, e.revision, e.record,
    e.content_hash, e.is_deleted, e.deleted_at, e.last_remote_mutation_ref,
    pg_catalog.gen_random_uuid(),
    case when e.is_deleted then 'ALREADY_DELETED' else 'PENDING' end
  from public.health_workout_sessions_v2 e
  where e.user_id = p_owner and e.project_scope = p_project;
  select count(*), count(*) filter (where not source_is_deleted)
  into v_inventory_count, v_active_count
  from public.health_workout_reset_items
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session' and reset_id = p_reset_id;
  -- Rolling digest keeps memory bounded even for a large frozen inventory.
  for v_item in select * from public.health_workout_reset_items
    where user_id = p_owner and project_scope = p_project
      and domain = 'health_workout_session' and reset_id = p_reset_id
    order by entity_id
  loop
    v_inventory_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      v_inventory_digest || '|' || jsonb_build_array(v_item.entity_id::text,
        v_item.source_revision, v_item.source_is_deleted, v_item.source_deleted_at,
        v_item.source_content_hash, v_item.source_remote_ref::text,
        v_item.reset_ref::text)::text, 'UTF8')), 'hex');
  end loop;
  update public.health_workout_reset_jobs set
    inventory_count = v_inventory_count, active_count = v_active_count,
    inventory_digest = v_inventory_digest, updated_at = clock_timestamp()
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session' and reset_id = p_reset_id;
  update public.health_workout_authorities set
    authority_epoch = p_authority_epoch + 1, state = 'RESET_FENCED',
    current_reset_job_id = p_reset_id,
    transition_evidence = jsonb_build_object('resetId', p_reset_id::text,
      'sourceEpoch', p_authority_epoch, 'targetEpoch', p_authority_epoch + 1,
      'inventoryDigest', v_inventory_digest), updated_at = clock_timestamp()
  where user_id = p_owner and project_scope = p_project and domain = 'health_workout_session'
    and authority_epoch = p_authority_epoch and state = 'OPEN';
  if not found then raise exception 'REL05G4C_AUTHORITY_RACE'; end if;
  return jsonb_build_object('protocolVersion', 2, 'status', 'applying',
    'resetId', p_reset_id::text, 'sourceEpoch', p_authority_epoch,
    'targetEpoch', p_authority_epoch + 1, 'inventoryCount', v_inventory_count,
    'activeCount', v_active_count, 'appliedCount', 0,
    'inventoryDigest', v_inventory_digest, 'completionDigest', null, 'errorCode', null);
end
$$;

create function public.continue_health_workout_reset_v1(
  p_owner uuid, p_project text, p_namespace text, p_generation text,
  p_device text, p_binding uuid, p_authority_epoch bigint,
  p_reset_id uuid, p_request_digest text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_job public.health_workout_reset_jobs%rowtype;
  v_authority public.health_workout_authorities%rowtype;
  v_item public.health_workout_reset_items%rowtype;
  v_entity public.health_workout_sessions_v2%rowtype;
  v_batch uuid[] := array[]::uuid[];
  v_id uuid;
  v_sequence bigint;
  v_committed_at timestamptz;
  v_mutation_id text;
  v_mutation_digest text;
  v_idempotency_key text;
  v_payload_digest text;
  v_request_digest text;
  v_completion_digest text;
  v_applied_count bigint;
begin
  if p_reset_id is null or p_request_digest is null then
    raise exception 'REL05G4C_INVALID_RESET';
  end if;
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' = 'CAPABILITY_DISABLED' then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'CAPABILITY_DISABLED');
  end if;
  select * into v_job from public.health_workout_reset_jobs
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session' and reset_id = p_reset_id for update;
  if not found then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'RESET_NOT_FOUND');
  end if;
  if v_job.request_digest <> p_request_digest
    or v_job.namespace_fingerprint <> p_namespace
    or v_job.generation_id <> p_generation or v_job.device_id <> p_device
    or v_job.generation_binding_id <> p_binding
    or v_job.source_epoch <> p_authority_epoch then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'RESET_ID_CONFLICT');
  end if;
  if v_job.phase = 'COMPLETED' then
    return jsonb_build_object('protocolVersion', 2, 'status', 'completed',
      'resetId', p_reset_id::text, 'sourceEpoch', v_job.source_epoch,
      'targetEpoch', v_job.target_epoch, 'inventoryCount', v_job.inventory_count,
      'activeCount', v_job.active_count, 'appliedCount', v_job.applied_count,
      'inventoryDigest', v_job.inventory_digest,
      'completionDigest', v_job.completion_digest, 'errorCode', null);
  end if;
  select * into v_authority from public.health_workout_authorities
  where user_id = p_owner and project_scope = p_project and domain = 'health_workout_session';
  if v_authority.state <> 'RESET_FENCED'
    or v_authority.current_reset_job_id is distinct from p_reset_id
    or v_authority.authority_epoch <> v_job.target_epoch then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'RESET_INVENTORY_DRIFT');
  end if;
  -- Lock every entity selected for this batch before taking the stream lock.
  for v_item in select * from public.health_workout_reset_items
    where user_id = p_owner and project_scope = p_project
      and domain = 'health_workout_session' and reset_id = p_reset_id
      and state = 'PENDING' order by entity_id limit 25 for update
  loop
    select * into v_entity from public.health_workout_sessions_v2
    where user_id = p_owner and project_scope = p_project and id = v_item.entity_id for update;
    if not found or v_entity.revision <> v_item.source_revision
      or v_entity.record <> v_item.source_record
      or v_entity.content_hash is distinct from v_item.source_content_hash
      or v_entity.authority_epoch is distinct from v_job.source_epoch
      or v_entity.is_deleted or v_entity.deleted_at is not null
      or v_entity.last_remote_mutation_ref is distinct from v_item.source_remote_ref
      or v_entity.revision >= 9007199254740991 then
      raise exception 'REL05G4C_RESET_INVENTORY_DRIFT';
    end if;
    update public.health_workout_sessions_v2 set
      revision = v_item.source_revision + 1, authority_epoch = v_job.target_epoch,
      is_deleted = true, deleted_at = v_job.started_at,
      last_remote_mutation_ref = v_item.reset_ref, updated_at = clock_timestamp()
    where user_id = p_owner and project_scope = p_project and id = v_item.entity_id;
    v_batch := array_append(v_batch, v_item.entity_id);
  end loop;
  if array_length(v_batch, 1) is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      p_owner::text || '|' || p_project || '|stream', 0));
    insert into public.remote_reference_streams_v2 (authenticated_owner_id, project_scope)
    values (p_owner, p_project)
    on conflict (authenticated_owner_id, project_scope) do nothing;
    foreach v_id in array v_batch loop
      select * into v_item from public.health_workout_reset_items
      where user_id = p_owner and project_scope = p_project
        and domain = 'health_workout_session' and reset_id = p_reset_id
        and entity_id = v_id;
      v_sequence := nextval('public.remote_reference_changes_v2_sequence_seq'::regclass);
      if v_sequence > 9007199254740991 then raise exception 'REL05G4C_SEQUENCE_EXHAUSTED'; end if;
      v_committed_at := clock_timestamp();
      -- Server-private job entropy keeps these shared receipt uniqueness keys
      -- unpredictable before insertion. Distinct labels separate their uses.
      -- The old binding cannot replay them as a current client mutation.
      v_mutation_digest := pg_catalog.encode(pg_catalog.sha256(v_job.receipt_secret ||
        pg_catalog.convert_to('workout-reset-mutation-id|' || p_reset_id::text || '|' || v_id::text, 'UTF8')), 'hex');
      v_mutation_id := 'mut.' || substr(v_mutation_digest, 1, 8) || '-' ||
        substr(v_mutation_digest, 9, 4) || '-4' || substr(v_mutation_digest, 14, 3) ||
        '-8' || substr(v_mutation_digest, 18, 3) || '-' || substr(v_mutation_digest, 21, 12);
      v_idempotency_key := 'k322.' || pg_catalog.encode(pg_catalog.sha256(
        v_job.receipt_secret || pg_catalog.convert_to(
          'workout-reset-idem|' || p_reset_id::text || '|' || v_id::text, 'UTF8')), 'hex');
      v_payload_digest := pg_catalog.encode(pg_catalog.sha256(v_job.receipt_secret ||
        pg_catalog.convert_to('workout-reset-payload|' || p_reset_id::text || '|' || v_id::text, 'UTF8')), 'hex');
      v_request_digest := pg_catalog.encode(pg_catalog.sha256(v_job.receipt_secret ||
        pg_catalog.convert_to('workout-reset-receipt|' || v_job.request_digest || '|' || v_id::text, 'UTF8')), 'hex');
      begin
      insert into public.remote_mutation_receipts (
        authenticated_owner_id, project_scope, namespace_fingerprint, generation_id,
        domain, entity_id, mutation_id, idempotency_key, operation, base_revision,
        local_revision, payload_digest, request_digest, result_code, result_revision,
        result_entity_updated_at, remote_mutation_ref, response_payload,
        protocol_version, device_id, change_sequence, authority_epoch,
        generation_binding_id, content_hash
      ) values (
        p_owner, p_project, v_job.namespace_fingerprint, v_job.generation_id,
        'health_workout_session', v_id, v_mutation_id, v_idempotency_key,
        'tombstone', v_item.source_revision, v_item.source_revision + 1,
        v_payload_digest, v_request_digest, 'APPLIED', v_item.source_revision + 1,
        v_committed_at, v_item.reset_ref,
        jsonb_build_object('protocolVersion', 2, 'outcome', 'reset_tombstone',
          'resetId', p_reset_id::text, 'entityId', v_id::text,
          'serverRevision', v_item.source_revision + 1,
          'changeSequence', v_sequence, 'authorityEpoch', v_job.target_epoch),
        2, v_job.device_id, v_sequence, v_job.target_epoch,
        v_job.generation_binding_id, v_item.source_content_hash
      );
      exception when unique_violation then
        raise exception 'REL05G4C_RESET_RECEIPT_IDENTITY_COLLISION';
      end;
      insert into public.remote_reference_changes_v2 (
        sequence, authenticated_owner_id, project_scope, namespace_fingerprint,
        generation_id, domain, entity_id, operation, server_revision, record,
        is_deleted, deleted_at, remote_mutation_ref, server_committed_at,
        authority_epoch, content_hash
      ) values (
        v_sequence, p_owner, p_project, v_job.namespace_fingerprint,
        v_job.generation_id, 'health_workout_session', v_id, 'tombstone',
        v_item.source_revision + 1, v_item.source_record, true, v_job.started_at,
        v_item.reset_ref, v_committed_at, v_job.target_epoch, v_item.source_content_hash
      );
      update public.health_workout_reset_items set state = 'APPLIED',
        change_sequence = v_sequence, applied_at = v_committed_at
      where user_id = p_owner and project_scope = p_project
        and domain = 'health_workout_session' and reset_id = p_reset_id and entity_id = v_id;
    end loop;
    update public.health_workout_reset_jobs set
      applied_count = applied_count + array_length(v_batch, 1), updated_at = clock_timestamp()
    where user_id = p_owner and project_scope = p_project
      and domain = 'health_workout_session' and reset_id = p_reset_id;
  end if;
  select applied_count into v_applied_count from public.health_workout_reset_jobs
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session' and reset_id = p_reset_id;
  if v_applied_count = v_job.active_count then
    if exists (select 1 from public.health_workout_reset_items i
      left join public.health_workout_sessions_v2 e
        on e.user_id = i.user_id and e.project_scope = i.project_scope and e.id = i.entity_id
      left join public.remote_reference_changes_v2 c on c.sequence = i.change_sequence
      left join public.remote_mutation_receipts r
        on r.authenticated_owner_id = i.user_id and r.project_scope = i.project_scope
          and r.domain = 'health_workout_session' and r.remote_mutation_ref = i.reset_ref
      where i.user_id = p_owner and i.project_scope = p_project
        and i.domain = 'health_workout_session' and i.reset_id = p_reset_id
        and not i.source_is_deleted and (i.state <> 'APPLIED'
          or e.revision is distinct from i.source_revision + 1 or not e.is_deleted
          or e.authority_epoch is distinct from v_job.target_epoch
          or e.last_remote_mutation_ref is distinct from i.reset_ref
          or c.entity_id is distinct from i.entity_id
          or c.remote_mutation_ref is distinct from i.reset_ref
          or c.authority_epoch is distinct from v_job.target_epoch
          or r.result_revision is distinct from i.source_revision + 1)) then
      raise exception 'REL05G4C_COMPLETION_EVIDENCE_MISSING';
    end if;
    v_completion_digest := repeat('0', 64);
    for v_item in select * from public.health_workout_reset_items
      where user_id = p_owner and project_scope = p_project
        and domain = 'health_workout_session' and reset_id = p_reset_id
      order by entity_id
    loop
      v_completion_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        v_completion_digest || '|' || jsonb_build_array(v_item.entity_id::text,
          v_item.state, v_item.reset_ref::text, v_item.change_sequence)::text,
        'UTF8')), 'hex');
    end loop;
    update public.health_workout_reset_jobs set phase = 'COMPLETED',
      completion_digest = v_completion_digest, completed_at = clock_timestamp(),
      updated_at = clock_timestamp()
    where user_id = p_owner and project_scope = p_project
      and domain = 'health_workout_session' and reset_id = p_reset_id;
    update public.health_workout_authorities set state = 'OPEN',
      current_reset_job_id = null,
      transition_evidence = transition_evidence || jsonb_build_object(
        'completionDigest', v_completion_digest), updated_at = clock_timestamp()
    where user_id = p_owner and project_scope = p_project and domain = 'health_workout_session'
      and authority_epoch = v_job.target_epoch and current_reset_job_id = p_reset_id;
    if not found then raise exception 'REL05G4C_AUTHORITY_RACE'; end if;
  end if;
  return jsonb_build_object('protocolVersion', 2, 'status',
    case when v_applied_count = v_job.active_count then 'completed' else 'applying' end,
    'resetId', p_reset_id::text, 'sourceEpoch', v_job.source_epoch,
    'targetEpoch', v_job.target_epoch, 'inventoryCount', v_job.inventory_count,
    'activeCount', v_job.active_count, 'appliedCount', v_applied_count,
    'inventoryDigest', v_job.inventory_digest,
    'completionDigest', v_completion_digest, 'errorCode', null);
end
$$;

-- Recovery remains possible if the initiating client loses its local intent.
-- It can only finish an already-fenced job for the authenticated owner/scope;
-- it cannot create a reset or choose a different inventory.
create function public.continue_active_health_workout_reset_v1(
  p_owner uuid, p_project text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_authority public.health_workout_authorities%rowtype;
  v_job public.health_workout_reset_jobs%rowtype;
begin
  v_context := public.health_workout_authority_context_v1(p_owner, p_project);
  if v_context ->> 'errorCode' = 'CAPABILITY_DISABLED' then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'CAPABILITY_DISABLED');
  end if;
  select * into v_authority from public.health_workout_authorities
  where user_id = p_owner and project_scope = p_project and domain = 'health_workout_session';
  if v_authority.state <> 'RESET_FENCED' or v_authority.current_reset_job_id is null then
    return jsonb_build_object('status', 'rejected', 'errorCode', 'RESET_NOT_FOUND');
  end if;
  select * into v_job from public.health_workout_reset_jobs
  where user_id = p_owner and project_scope = p_project
    and domain = 'health_workout_session' and reset_id = v_authority.current_reset_job_id;
  if not found then raise exception 'REL05G4C_RESET_JOB_MISSING'; end if;
  return public.continue_health_workout_reset_v1(
    p_owner, p_project, v_job.namespace_fingerprint, v_job.generation_id,
    v_job.device_id, v_job.generation_binding_id, v_job.source_epoch,
    v_job.reset_id, v_job.request_digest);
end
$$;

revoke all on function public.begin_health_workout_reset_v1(
  uuid, text, text, text, text, uuid, bigint, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.continue_health_workout_reset_v1(
  uuid, text, text, text, text, uuid, bigint, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.begin_health_workout_reset_v1(
  uuid, text, text, text, text, uuid, bigint, uuid, text
) to service_role;
grant execute on function public.continue_health_workout_reset_v1(
  uuid, text, text, text, text, uuid, bigint, uuid, text
) to service_role;
revoke all on function public.continue_active_health_workout_reset_v1(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.continue_active_health_workout_reset_v1(uuid, text)
  to service_role;

commit;
