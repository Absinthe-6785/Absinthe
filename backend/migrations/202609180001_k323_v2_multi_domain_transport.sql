begin;

-- REL-05E reuses the K-323 owner/project-scoped immutable receipt ledger.
-- V1 rows retain protocol_version=1; v2 adds only bounded reference domains.
alter table public.remote_mutation_receipts
  add column if not exists protocol_version smallint not null default 1,
  add column if not exists device_id text,
  add column if not exists change_sequence bigint;

alter table public.remote_mutation_receipts
  drop constraint if exists remote_mutation_receipts_domain_check;
alter table public.remote_mutation_receipts
  add constraint remote_mutation_receipts_domain_check
  check (domain in ('notes', 'reference_alpha', 'reference_beta')) not valid;

alter table public.remote_mutation_receipts
  drop constraint if exists remote_mutation_receipts_operation_check;
alter table public.remote_mutation_receipts
  add constraint remote_mutation_receipts_operation_check
  check (operation in ('upsert', 'tombstone', 'restore')) not valid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'remote_mutation_receipts_protocol_version_check'
      and conrelid = 'public.remote_mutation_receipts'::regclass
  ) then
    alter table public.remote_mutation_receipts
      add constraint remote_mutation_receipts_protocol_version_check
      check (protocol_version in (1, 2)) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'remote_mutation_receipts_v2_shape_check'
      and conrelid = 'public.remote_mutation_receipts'::regclass
  ) then
    alter table public.remote_mutation_receipts
      add constraint remote_mutation_receipts_v2_shape_check
      check (
        protocol_version = 1 or (
          domain in ('reference_alpha', 'reference_beta')
          and device_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
          and ((result_code = 'APPLIED') = (change_sequence is not null))
        )
      ) not valid;
  end if;
end
$$;

create table if not exists public.remote_reference_streams_v2 (
  authenticated_owner_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  server_epoch uuid not null default gen_random_uuid(),
  retention_floor bigint not null default 0
    check (retention_floor between 0 and 9007199254740991),
  created_at timestamptz not null default clock_timestamp(),
  primary key (authenticated_owner_id, project_scope)
);

create table if not exists public.remote_reference_entities_v2 (
  authenticated_owner_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  namespace_fingerprint text not null check (namespace_fingerprint ~ '^[a-f0-9]{64}$'),
  generation_id text not null check (generation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  domain text not null check (domain in ('reference_alpha', 'reference_beta')),
  entity_id uuid not null,
  record jsonb not null,
  server_revision bigint not null check (server_revision between 1 and 9007199254740991),
  is_deleted boolean not null,
  deleted_at timestamptz,
  last_remote_mutation_ref uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (authenticated_owner_id, project_scope, domain, entity_id),
  check (is_deleted = (deleted_at is not null)),
  check (octet_length(record::text) <= 131072)
);

create table if not exists public.remote_reference_changes_v2 (
  sequence bigserial primary key,
  authenticated_owner_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  namespace_fingerprint text not null check (namespace_fingerprint ~ '^[a-f0-9]{64}$'),
  generation_id text not null check (generation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  domain text not null check (domain in ('reference_alpha', 'reference_beta')),
  entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'tombstone', 'restore')),
  server_revision bigint not null check (server_revision between 1 and 9007199254740991),
  record jsonb not null,
  is_deleted boolean not null,
  deleted_at timestamptz,
  remote_mutation_ref uuid not null,
  server_committed_at timestamptz not null,
  check (is_deleted = (deleted_at is not null)),
  check (octet_length(record::text) <= 131072)
);

create index if not exists remote_reference_changes_v2_pull
  on public.remote_reference_changes_v2 (
    authenticated_owner_id, project_scope, namespace_fingerprint,
    generation_id, domain, sequence
  );

create unique index if not exists remote_reference_changes_v2_entity_revision
  on public.remote_reference_changes_v2 (
    authenticated_owner_id, project_scope, domain, entity_id, server_revision
  );

create unique index if not exists remote_reference_changes_v2_remote_ref
  on public.remote_reference_changes_v2 (
    authenticated_owner_id, project_scope, remote_mutation_ref
  );

alter table public.remote_reference_streams_v2 enable row level security;
alter table public.remote_reference_entities_v2 enable row level security;
alter table public.remote_reference_changes_v2 enable row level security;

-- Mutations and pulls hold a shared transaction-scoped generation lock while
-- validating and using an active generation. Any status transition or delete
-- takes the matching exclusive lock, so it cannot commit concurrently with an
-- operation that already passed the generation fence. This preserves the
-- lifecycle invariant without granting service_role UPDATE solely for a row
-- locking SELECT.
create or replace function public.lock_remote_sync_generation_transition_v2()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    old.owner_id::text || '|' || old.project_scope || '|generation|' ||
      old.namespace_fingerprint || '|' || old.generation_id,
    0
  ));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists remote_sync_generations_transition_lock_v2
  on public.remote_sync_generations;
create trigger remote_sync_generations_transition_lock_v2
before update of status or delete on public.remote_sync_generations
for each row execute function public.lock_remote_sync_generation_transition_v2();

create or replace function public.reject_remote_reference_change_v2()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'K323_V2_IMMUTABLE_CHANGE';
end
$$;

drop trigger if exists remote_reference_changes_v2_immutable
  on public.remote_reference_changes_v2;
create trigger remote_reference_changes_v2_immutable
before update or delete on public.remote_reference_changes_v2
for each row execute function public.reject_remote_reference_change_v2();

create or replace function public.apply_remote_reference_mutation_v2(
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
  v_entity public.remote_reference_entities_v2%rowtype;
  v_response jsonb;
  v_record jsonb;
  v_remote_ref uuid := gen_random_uuid();
  v_committed_at timestamptz := clock_timestamp();
  v_deleted_at timestamptz;
  v_server_revision bigint;
  v_change_sequence bigint;
  v_error_code text;
  v_outcome text;
begin
  if p_authenticated_owner_id is null
    or p_project_scope !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_namespace_fingerprint !~ '^[a-f0-9]{64}$'
    or p_generation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_device_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_domain not in ('reference_alpha', 'reference_beta')
    or p_operation not in ('upsert', 'tombstone', 'restore')
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

  if p_base_revision is not null
    and (p_base_revision < 1 or p_base_revision > 9007199254740991) then
    raise exception 'K323_V2_INVALID_MUTATION';
  end if;
  if p_operation in ('upsert', 'restore') then
    if p_payload #>> '{kind}' <> 'entity_snapshot'
      or p_payload #>> '{record,id}' <> p_entity_id then
      raise exception 'K323_V2_INVALID_MUTATION';
    end if;
  elsif p_payload #>> '{kind}' <> 'tombstone'
    or p_payload #>> '{entityId}' <> p_entity_id
    or (p_payload #>> '{revision}')::bigint <> p_local_revision then
    raise exception 'K323_V2_INVALID_MUTATION';
  end if;

  -- Generation readers share this lock; a status transition/delete trigger
  -- acquires the exclusive form before changing lifecycle authority.
  perform pg_advisory_xact_lock_shared(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|generation|' ||
      p_namespace_fingerprint || '|' || p_generation_id,
    0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|idem|' || p_idempotency_key, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|mutation|' || p_mutation_id, 0
  ));
  -- Sequence values are pull cursors. Serialize appends per owner/project so a
  -- later sequence can never commit before an earlier invisible transaction.
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|stream', 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|entity|' || p_domain || '|' || p_entity_id, 0
  ));

  select * into v_existing_receipt
  from public.remote_mutation_receipts
  where authenticated_owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_receipt.protocol_version = 2
      and v_existing_receipt.mutation_id = p_mutation_id
      and v_existing_receipt.request_digest = p_request_digest then
      return v_existing_receipt.response_payload;
    end if;
    return jsonb_build_object(
      'protocolVersion', 2, 'outcome', 'rejected',
      'mutationId', p_mutation_id, 'idempotencyKey', p_idempotency_key,
      'domain', p_domain, 'entityId', p_entity_id, 'operation', p_operation,
      'payloadHash', p_payload_digest, 'remoteMutationRef', null,
      'serverRevision', null, 'changeSequence', null, 'serverCommittedAt', null,
      'errorCode', 'IDEMPOTENCY_CONFLICT', 'retryable', false
    );
  end if;

  select * into v_existing_receipt
  from public.remote_mutation_receipts
  where authenticated_owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope
    and mutation_id = p_mutation_id;
  if found then
    return jsonb_build_object(
      'protocolVersion', 2, 'outcome', 'rejected',
      'mutationId', p_mutation_id, 'idempotencyKey', p_idempotency_key,
      'domain', p_domain, 'entityId', p_entity_id, 'operation', p_operation,
      'payloadHash', p_payload_digest, 'remoteMutationRef', null,
      'serverRevision', null, 'changeSequence', null, 'serverCommittedAt', null,
      'errorCode', 'MUTATION_ID_CONFLICT', 'retryable', false
    );
  end if;

  select status into v_generation_status
  from public.remote_sync_generations
  where owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope
    and namespace_fingerprint = p_namespace_fingerprint
    and generation_id = p_generation_id;
  if not found then
    v_error_code := 'UNKNOWN_GENERATION';
  elsif v_generation_status <> 'active' then
    v_error_code := 'STALE_GENERATION';
  end if;

  if v_error_code is null then
    select * into v_entity
    from public.remote_reference_entities_v2
    where authenticated_owner_id = p_authenticated_owner_id
      and project_scope = p_project_scope
      and domain = p_domain
      and entity_id = v_entity_id
    for update;

    if p_base_revision is null then
      if found then
        v_error_code := 'REMOTE_ENTITY_ALREADY_EXISTS';
      elsif p_operation <> 'upsert' then
        v_error_code := 'REMOTE_ENTITY_NOT_FOUND';
      else
        v_server_revision := 1;
        v_record := p_payload #> '{record}';
        v_deleted_at := null;
      end if;
    elsif not found then
      v_error_code := 'REMOTE_ENTITY_NOT_FOUND';
    elsif v_entity.namespace_fingerprint is distinct from p_namespace_fingerprint
      or v_entity.generation_id is distinct from p_generation_id then
      v_error_code := 'STALE_GENERATION';
    elsif v_entity.server_revision is distinct from p_base_revision then
      v_error_code := 'REMOTE_REVISION_CONFLICT';
    elsif p_operation = 'restore' and not v_entity.is_deleted then
      v_error_code := 'REMOTE_ENTITY_NOT_TOMBSTONED';
    elsif p_operation <> 'restore' and v_entity.is_deleted then
      v_error_code := 'REMOTE_ENTITY_TOMBSTONED';
    else
      v_server_revision := v_entity.server_revision + 1;
      v_record := case when p_operation = 'tombstone' then v_entity.record else p_payload #> '{record}' end;
      v_deleted_at := case when p_operation = 'tombstone' then (p_payload #>> '{deletedAt}')::timestamptz else null end;
    end if;
  end if;

  if v_error_code is null then
    insert into public.remote_reference_streams_v2 (authenticated_owner_id, project_scope)
    values (p_authenticated_owner_id, p_project_scope)
    on conflict (authenticated_owner_id, project_scope) do nothing;

    insert into public.remote_reference_entities_v2 (
      authenticated_owner_id, project_scope, namespace_fingerprint, generation_id,
      domain, entity_id, record, server_revision, is_deleted, deleted_at,
      last_remote_mutation_ref, created_at, updated_at
    ) values (
      p_authenticated_owner_id, p_project_scope, p_namespace_fingerprint, p_generation_id,
      p_domain, v_entity_id, v_record, v_server_revision, p_operation = 'tombstone', v_deleted_at,
      v_remote_ref, v_committed_at, v_committed_at
    )
    on conflict (authenticated_owner_id, project_scope, domain, entity_id) do update set
      record = excluded.record,
      server_revision = excluded.server_revision,
      is_deleted = excluded.is_deleted,
      deleted_at = excluded.deleted_at,
      last_remote_mutation_ref = excluded.last_remote_mutation_ref,
      updated_at = excluded.updated_at;

    insert into public.remote_reference_changes_v2 (
      authenticated_owner_id, project_scope, namespace_fingerprint, generation_id,
      domain, entity_id, operation, server_revision, record, is_deleted, deleted_at,
      remote_mutation_ref, server_committed_at
    ) values (
      p_authenticated_owner_id, p_project_scope, p_namespace_fingerprint, p_generation_id,
      p_domain, v_entity_id, p_operation, v_server_revision, v_record,
      p_operation = 'tombstone', v_deleted_at, v_remote_ref, v_committed_at
    ) returning sequence into v_change_sequence;

    v_outcome := 'applied';
    v_response := jsonb_build_object(
      'protocolVersion', 2, 'outcome', v_outcome,
      'mutationId', p_mutation_id, 'idempotencyKey', p_idempotency_key,
      'domain', p_domain, 'entityId', p_entity_id, 'operation', p_operation,
      'payloadHash', p_payload_digest, 'remoteMutationRef', v_remote_ref::text,
      'serverRevision', v_server_revision, 'changeSequence', v_change_sequence,
      'serverCommittedAt', v_committed_at, 'errorCode', null, 'retryable', false
    );
  else
    v_outcome := case when v_error_code = 'REMOTE_REVISION_CONFLICT' then 'revision_conflict' else 'rejected' end;
    v_remote_ref := null;
    v_committed_at := null;
    v_response := jsonb_build_object(
      'protocolVersion', 2, 'outcome', v_outcome,
      'mutationId', p_mutation_id, 'idempotencyKey', p_idempotency_key,
      'domain', p_domain, 'entityId', p_entity_id, 'operation', p_operation,
      'payloadHash', p_payload_digest, 'remoteMutationRef', null,
      'serverRevision', null, 'changeSequence', null, 'serverCommittedAt', null,
      'errorCode', v_error_code, 'retryable', false
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

create or replace function public.pull_remote_reference_changes_v2(
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
    or p_domain not in ('reference_alpha', 'reference_beta')
    or p_cursor < 0 or p_cursor > 9007199254740991
    or p_limit < 1 or p_limit > 500
    or (p_server_epoch is not null and p_server_epoch !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    raise exception 'K323_V2_INVALID_PULL';
  end if;

  perform pg_advisory_xact_lock_shared(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|generation|' ||
      p_namespace_fingerprint || '|' || p_generation_id,
    0
  ));

  insert into public.remote_reference_streams_v2 (authenticated_owner_id, project_scope)
  values (p_authenticated_owner_id, p_project_scope)
  on conflict (authenticated_owner_id, project_scope) do nothing;
  select * into v_stream from public.remote_reference_streams_v2
  where authenticated_owner_id = p_authenticated_owner_id and project_scope = p_project_scope;

  select status into v_generation_status
  from public.remote_sync_generations
  where owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope
    and namespace_fingerprint = p_namespace_fingerprint
    and generation_id = p_generation_id;
  if not found then
    v_error_code := 'UNKNOWN_GENERATION';
  elsif v_generation_status <> 'active' then
    v_error_code := 'STALE_GENERATION';
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
      'nextCursor', v_stream.retention_floor, 'changes', '[]'::jsonb,
      'errorCode', 'CURSOR_INVALID'
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', page.sequence,
    'domain', page.domain,
    'entityId', page.entity_id::text,
    'operation', page.operation,
    'serverRevision', page.server_revision,
    'record', page.record,
    'isDeleted', page.is_deleted,
    'deletedAt', page.deleted_at,
    'remoteMutationRef', page.remote_mutation_ref::text,
    'serverCommittedAt', page.server_committed_at
  ) order by page.sequence), '[]'::jsonb), coalesce(max(page.sequence), p_cursor)
  into v_changes, v_next_cursor
  from (
    select * from public.remote_reference_changes_v2
    where authenticated_owner_id = p_authenticated_owner_id
      and project_scope = p_project_scope
      and namespace_fingerprint = p_namespace_fingerprint
      and generation_id = p_generation_id
      and domain = p_domain
      and sequence > p_cursor
    order by sequence
    limit p_limit
  ) page;

  return jsonb_build_object(
    'protocolVersion', 2, 'status', 'changes', 'domain', p_domain,
    'serverEpoch', v_stream.server_epoch::text, 'retentionFloor', v_stream.retention_floor,
    'nextCursor', v_next_cursor, 'changes', v_changes, 'errorCode', null
  );
end
$$;

revoke all on public.remote_reference_streams_v2 from public, anon, authenticated, service_role;
revoke all on public.remote_reference_entities_v2 from public, anon, authenticated, service_role;
revoke all on public.remote_reference_changes_v2 from public, anon, authenticated, service_role;
revoke all on sequence public.remote_reference_changes_v2_sequence_seq
  from public, anon, authenticated, service_role;
revoke all on function public.reject_remote_reference_change_v2()
  from public, anon, authenticated, service_role;
revoke all on function public.lock_remote_sync_generation_transition_v2()
  from public, anon, authenticated, service_role;
revoke all on function public.apply_remote_reference_mutation_v2(
  uuid, text, text, text, text, text, text, text, text, text,
  bigint, bigint, jsonb, text, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.pull_remote_reference_changes_v2(
  uuid, text, text, text, text, bigint, text, integer
) from public, anon, authenticated, service_role;

-- The dormant backend is the only caller. SECURITY INVOKER keeps the RPCs from
-- silently acquiring the migration owner's authority; service_role receives only
-- the table operations exercised by these two functions.
revoke all on public.remote_sync_generations from service_role;
revoke all on public.remote_mutation_receipts from service_role;
grant select on public.remote_sync_generations to service_role;
grant select, insert on public.remote_mutation_receipts to service_role;
grant select, insert on public.remote_reference_streams_v2 to service_role;
grant select, insert, update on public.remote_reference_entities_v2 to service_role;
grant select, insert on public.remote_reference_changes_v2 to service_role;
grant usage, select on sequence public.remote_reference_changes_v2_sequence_seq to service_role;

grant execute on function public.apply_remote_reference_mutation_v2(
  uuid, text, text, text, text, text, text, text, text, text,
  bigint, bigint, jsonb, text, text, timestamptz
) to service_role;
grant execute on function public.pull_remote_reference_changes_v2(
  uuid, text, text, text, text, bigint, text, integer
) to service_role;

commit;
