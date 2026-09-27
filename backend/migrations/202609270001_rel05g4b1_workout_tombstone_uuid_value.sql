-- REL-05G4B1: accept frozen mixed-case UUIDv4 tombstone payload spelling.
-- The wire entity ID, payload bytes/hash, digest tuple, and authority/CAS
-- semantics remain unchanged. CREATE OR REPLACE preserves existing grants.
begin;

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
      -- Payload UUIDv4 spelling is frozen canonical content and may be mixed
      -- case. Compare its value to the lowercase external UUID without
      -- rewriting the JSON string or its content hash.
      or p_payload #>> '{record,id}' !~
        '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$'
      or pg_catalog.lower(p_payload #>> '{record,id}') is distinct from p_entity_id::text
      or p_content_hash is null or p_content_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'REL05G4A_INVALID_PAYLOAD';
    end if;
  else
    if p_payload ->> 'kind' is distinct from 'tombstone'
      or p_payload ->> 'revision' is distinct from p_local_revision::text
      or p_payload ->> 'deletedAt' is null
      or p_payload ->> 'entityId' !~
        '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$' then
      raise exception 'REL05G4A_INVALID_PAYLOAD';
    end if;
    -- The grammar check above is a separate branch: malformed text never
    -- reaches this cast or escapes as a raw PostgreSQL UUID exception.
    if (p_payload ->> 'entityId')::uuid is distinct from p_entity_id then
      raise exception 'REL05G4A_INVALID_PAYLOAD';
    end if;
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
  -- A matching revision alone does not establish G4A provenance. In
  -- particular, dormant G1 rows have no epoch/hash/committed receipt and
  -- must never be silently adopted by an update, tombstone, or restore.
  if found and p_base_revision is not null and (
    v_entity.authority_epoch is distinct from p_authority_epoch
    or v_entity.content_hash is null
    or v_entity.content_hash !~ '^[a-f0-9]{64}$'
    or v_entity.last_remote_mutation_ref is null
    or not exists (
      select 1 from public.remote_mutation_receipts as evidence
      where evidence.authenticated_owner_id = p_owner
        and evidence.project_scope = p_project
        and evidence.domain = 'health_workout_session'
        and evidence.entity_id = p_entity_id
        and evidence.remote_mutation_ref = v_entity.last_remote_mutation_ref
        and evidence.result_revision = v_entity.revision
        and evidence.authority_epoch = p_authority_epoch
        and evidence.content_hash = v_entity.content_hash
        and evidence.result_code = 'APPLIED'
    )
  ) then
    return jsonb_build_object('outcome', 'rejected',
      'errorCode', 'AUTHORITY_EVIDENCE_MISSING');
  end if;
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

commit;
