begin;

create extension if not exists pgcrypto;

create table if not exists public.remote_sync_generations (
  owner_id uuid not null,
  project_scope text not null check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  namespace_fingerprint text not null check (namespace_fingerprint ~ '^[a-f0-9]{64}$'),
  generation_id text not null check (generation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  status text not null check (status in ('active', 'stale')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (owner_id, project_scope, namespace_fingerprint, generation_id)
);

create unique index if not exists remote_sync_generations_one_active
  on public.remote_sync_generations (owner_id, project_scope, namespace_fingerprint)
  where status = 'active';

alter table public.remote_sync_generations enable row level security;

alter table public.notes add column if not exists sync_revision bigint;
alter table public.notes add column if not exists sync_namespace_fingerprint text;
alter table public.notes add column if not exists sync_generation_id text;
alter table public.notes add column if not exists sync_project_scope text;
alter table public.notes add column if not exists last_remote_mutation_ref uuid;
alter table public.notes add column if not exists starred boolean;
alter table public.notes add column if not exists properties jsonb;
alter table public.notes add column if not exists relations jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notes_sync_revision_positive' and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes add constraint notes_sync_revision_positive
      check (sync_revision is null or sync_revision > 0) not valid;
  end if;
end
$$;

create index if not exists notes_k323_owner_scope_entity
  on public.notes (user_id, sync_project_scope, sync_namespace_fingerprint, id);

create table if not exists public.remote_mutation_receipts (
  id uuid primary key default gen_random_uuid(),
  authenticated_owner_id uuid not null,
  project_scope text not null,
  namespace_fingerprint text not null,
  generation_id text not null,
  domain text not null check (domain = 'notes'),
  entity_id uuid not null,
  mutation_id text not null check (mutation_id ~ '^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  idempotency_key text not null check (idempotency_key ~ '^k322\.[a-f0-9]{64}$'),
  operation text not null check (operation in ('upsert', 'tombstone')),
  base_revision bigint,
  local_revision bigint not null check (local_revision > 0),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  request_digest text not null check (request_digest ~ '^[a-f0-9]{64}$'),
  result_code text not null,
  result_revision bigint,
  result_entity_updated_at timestamptz,
  remote_mutation_ref uuid,
  response_payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (authenticated_owner_id, project_scope, mutation_id),
  unique (authenticated_owner_id, project_scope, idempotency_key),
  check (octet_length(response_payload::text) <= 4096)
);

create index if not exists remote_mutation_receipts_entity_revision
  on public.remote_mutation_receipts (
    authenticated_owner_id, project_scope, domain, entity_id, local_revision
  );

alter table public.remote_mutation_receipts enable row level security;

create or replace function public.reject_remote_mutation_receipt_change_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'K323_IMMUTABLE_RECEIPT';
end
$$;

drop trigger if exists remote_mutation_receipts_immutable on public.remote_mutation_receipts;
create trigger remote_mutation_receipts_immutable
before update or delete on public.remote_mutation_receipts
for each row execute function public.reject_remote_mutation_receipt_change_v1();

create or replace function public.record_remote_mutation_receipt_v1(
  p_authenticated_owner_id uuid,
  p_project_scope text,
  p_namespace_fingerprint text,
  p_generation_id text,
  p_domain text,
  p_entity_id uuid,
  p_mutation_id text,
  p_idempotency_key text,
  p_operation text,
  p_base_revision bigint,
  p_local_revision bigint,
  p_payload_digest text,
  p_request_digest text,
  p_result_code text,
  p_result_revision bigint,
  p_result_entity_updated_at timestamptz,
  p_remote_mutation_ref uuid,
  p_response_payload jsonb
)
returns void
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  insert into public.remote_mutation_receipts (
    authenticated_owner_id, project_scope, namespace_fingerprint, generation_id,
    domain, entity_id, mutation_id, idempotency_key, operation, base_revision,
    local_revision, payload_digest, request_digest, result_code, result_revision,
    result_entity_updated_at, remote_mutation_ref, response_payload
  ) values (
    p_authenticated_owner_id, p_project_scope, p_namespace_fingerprint, p_generation_id,
    p_domain, p_entity_id, p_mutation_id, p_idempotency_key, p_operation, p_base_revision,
    p_local_revision, p_payload_digest, p_request_digest, p_result_code, p_result_revision,
    p_result_entity_updated_at, p_remote_mutation_ref, p_response_payload
  );
$$;

create or replace function public.apply_remote_note_mutation_v1(
  p_authenticated_owner_id uuid,
  p_project_scope text,
  p_namespace_fingerprint text,
  p_generation_id text,
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
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_entity_id uuid;
  v_generation_status text;
  v_existing_receipt public.remote_mutation_receipts%rowtype;
  v_note record;
  v_response jsonb;
  v_remote_ref uuid := gen_random_uuid();
  v_committed_at timestamptz := clock_timestamp();
  v_error_code text;
  v_outcome text;
begin
  if p_authenticated_owner_id is null
    or p_project_scope !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_namespace_fingerprint !~ '^[a-f0-9]{64}$'
    or p_generation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_domain <> 'notes'
    or p_operation not in ('upsert', 'tombstone')
    or p_mutation_id !~ '^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_idempotency_key !~ '^k322\.[a-f0-9]{64}$'
    or p_payload_digest !~ '^[a-f0-9]{64}$'
    or p_request_digest !~ '^[a-f0-9]{64}$'
    or p_local_revision < 1
    or p_created_at is null then
    raise exception 'K323_INVALID_MUTATION';
  end if;

  begin
    v_entity_id := p_entity_id::uuid;
  exception when invalid_text_representation then
    raise exception 'K323_INVALID_MUTATION';
  end;

  if (p_base_revision is null and (p_operation <> 'upsert' or p_local_revision <> 1))
    or (p_base_revision is not null and (p_base_revision < 1 or p_local_revision <> p_base_revision + 1)) then
    raise exception 'K323_INVALID_MUTATION';
  end if;

  -- Serialize all identities before inspecting receipts; these are transaction-scoped locks.
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|idem|' || p_idempotency_key, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|mutation|' || p_mutation_id, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_authenticated_owner_id::text || '|' || p_project_scope || '|entity|' || p_domain || '|' || p_entity_id, 0
  ));

  select * into v_existing_receipt
  from public.remote_mutation_receipts
  where authenticated_owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope
    and idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_receipt.mutation_id = p_mutation_id
      and v_existing_receipt.request_digest = p_request_digest then
      return v_existing_receipt.response_payload;
    end if;
    return jsonb_build_object(
      'protocolVersion', 1, 'outcome', 'rejected', 'mutationId', p_mutation_id,
      'idempotencyKey', p_idempotency_key, 'remoteMutationRef', null,
      'appliedRevision', null, 'serverCommittedAt', null,
      'errorCode', 'IDEMPOTENCY_CONFLICT', 'retryable', false
    );
  end if;

  select * into v_existing_receipt
  from public.remote_mutation_receipts
  where authenticated_owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope
    and mutation_id = p_mutation_id
  for update;
  if found then
    return jsonb_build_object(
      'protocolVersion', 1, 'outcome', 'rejected', 'mutationId', p_mutation_id,
      'idempotencyKey', p_idempotency_key, 'remoteMutationRef', null,
      'appliedRevision', null, 'serverCommittedAt', null,
      'errorCode', 'MUTATION_ID_CONFLICT', 'retryable', false
    );
  end if;

  select status into v_generation_status
  from public.remote_sync_generations
  where owner_id = p_authenticated_owner_id
    and project_scope = p_project_scope
    and namespace_fingerprint = p_namespace_fingerprint
    and generation_id = p_generation_id
  for update;
  if not found then
    v_error_code := 'UNKNOWN_GENERATION';
  elsif v_generation_status <> 'active' then
    v_error_code := 'STALE_GENERATION';
  end if;

  if v_error_code is null then
    select * into v_note from public.notes where id = v_entity_id for update;
    if found and v_note.user_id <> p_authenticated_owner_id then
      -- Cross-owner existence is deliberately hidden and no receipt is recorded.
      return jsonb_build_object(
        'protocolVersion', 1, 'outcome', 'rejected', 'mutationId', p_mutation_id,
        'idempotencyKey', p_idempotency_key, 'remoteMutationRef', null,
        'appliedRevision', null, 'serverCommittedAt', null,
        'errorCode', 'REMOTE_ENTITY_NOT_FOUND', 'retryable', false
      );
    end if;

    if p_base_revision is null then
      if found then
        v_error_code := 'REMOTE_ENTITY_ALREADY_EXISTS';
      elsif p_payload #>> '{kind}' <> 'entity_snapshot'
        or p_payload #>> '{record,id}' <> p_entity_id
        or p_payload #> '{record,deletedAt}' is distinct from 'null'::jsonb then
        raise exception 'K323_INVALID_MUTATION';
      else
        insert into public.notes (
          id, user_id, title, body, updated_at, folder_id, deleted_at, starred,
          properties, relations, sync_revision, sync_generation_id,
          sync_project_scope, sync_namespace_fingerprint, last_remote_mutation_ref
        ) values (
          v_entity_id, p_authenticated_owner_id,
          p_payload #>> '{record,title}', p_payload #>> '{record,body}',
          (p_payload #>> '{record,updatedAt}')::bigint,
          nullif(p_payload #>> '{record,folderId}', '')::uuid,
          null, (p_payload #>> '{record,starred}')::boolean,
          p_payload #> '{record,properties}', p_payload #> '{record,relations}',
          p_local_revision, p_generation_id, p_project_scope, p_namespace_fingerprint, v_remote_ref
        );
      end if;
    elsif not found then
      v_error_code := 'REMOTE_ENTITY_NOT_FOUND';
    elsif v_note.sync_project_scope is distinct from p_project_scope
      or v_note.sync_namespace_fingerprint is distinct from p_namespace_fingerprint
      or v_note.sync_generation_id is distinct from p_generation_id then
      v_error_code := 'STALE_GENERATION';
    elsif v_note.deleted_at is not null then
      v_error_code := 'REMOTE_ENTITY_TOMBSTONED';
    elsif v_note.sync_revision is distinct from p_base_revision then
      v_error_code := 'REMOTE_REVISION_CONFLICT';
    elsif p_operation = 'upsert' then
      if p_payload #>> '{kind}' <> 'entity_snapshot'
        or p_payload #>> '{record,id}' <> p_entity_id
        or p_payload #> '{record,deletedAt}' is distinct from 'null'::jsonb then
        raise exception 'K323_INVALID_MUTATION';
      end if;
      update public.notes set
        title = p_payload #>> '{record,title}',
        body = p_payload #>> '{record,body}',
        updated_at = (p_payload #>> '{record,updatedAt}')::bigint,
        folder_id = nullif(p_payload #>> '{record,folderId}', '')::uuid,
        starred = (p_payload #>> '{record,starred}')::boolean,
        properties = p_payload #> '{record,properties}',
        relations = p_payload #> '{record,relations}',
        sync_revision = p_local_revision,
        last_remote_mutation_ref = v_remote_ref
      where id = v_entity_id and user_id = p_authenticated_owner_id;
    else
      if p_payload #>> '{kind}' <> 'tombstone'
        or p_payload #>> '{entityId}' <> p_entity_id
        or (p_payload #>> '{revision}')::bigint <> p_local_revision then
        raise exception 'K323_INVALID_MUTATION';
      end if;
      update public.notes set
        deleted_at = floor(extract(epoch from (p_payload #>> '{deletedAt}')::timestamptz) * 1000)::bigint,
        updated_at = floor(extract(epoch from v_committed_at) * 1000)::bigint,
        sync_revision = p_local_revision,
        last_remote_mutation_ref = v_remote_ref
      where id = v_entity_id and user_id = p_authenticated_owner_id;
    end if;
  end if;

  if v_error_code is null then
    v_outcome := 'applied';
    v_response := jsonb_build_object(
      'protocolVersion', 1, 'outcome', v_outcome, 'mutationId', p_mutation_id,
      'idempotencyKey', p_idempotency_key, 'remoteMutationRef', v_remote_ref::text,
      'appliedRevision', p_local_revision, 'serverCommittedAt', v_committed_at,
      'errorCode', null, 'retryable', false
    );
  else
    v_outcome := case when v_error_code = 'REMOTE_REVISION_CONFLICT' then 'revision_conflict' else 'rejected' end;
    v_remote_ref := null;
    v_committed_at := null;
    v_response := jsonb_build_object(
      'protocolVersion', 1, 'outcome', v_outcome, 'mutationId', p_mutation_id,
      'idempotencyKey', p_idempotency_key, 'remoteMutationRef', null,
      'appliedRevision', null, 'serverCommittedAt', null,
      'errorCode', v_error_code, 'retryable', false
    );
  end if;

  perform public.record_remote_mutation_receipt_v1(
    p_authenticated_owner_id, p_project_scope, p_namespace_fingerprint, p_generation_id,
    p_domain, v_entity_id, p_mutation_id, p_idempotency_key, p_operation,
    p_base_revision, p_local_revision, p_payload_digest, p_request_digest,
    coalesce(v_error_code, 'APPLIED'),
    case when v_error_code is null then p_local_revision else null end,
    v_committed_at, v_remote_ref, v_response
  );
  return v_response;
end
$$;

revoke all on public.remote_sync_generations from public, anon, authenticated;
revoke all on public.remote_mutation_receipts from public, anon, authenticated;
revoke all on function public.reject_remote_mutation_receipt_change_v1() from public, anon, authenticated;
revoke all on function public.record_remote_mutation_receipt_v1(
  uuid, text, text, text, text, uuid, text, text, text, bigint, bigint,
  text, text, text, bigint, timestamptz, uuid, jsonb
) from public, anon, authenticated;
revoke all on function public.apply_remote_note_mutation_v1(
  uuid, text, text, text, text, text, text, text, text, bigint, bigint,
  jsonb, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.apply_remote_note_mutation_v1(
  uuid, text, text, text, text, text, text, text, text, bigint, bigint,
  jsonb, text, text, timestamptz
) to service_role;

commit;
