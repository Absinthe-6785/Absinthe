from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import time
import uuid

import pytest


pytestmark = pytest.mark.skipif(
    os.getenv("K323_POSTGRES_INTEGRATION") != "1",
    reason="set K323_POSTGRES_INTEGRATION=1 to run the isolated PostgreSQL transport test",
)


ROOT = Path(__file__).parent
V1_MIGRATION = ROOT / "migrations" / "202607120001_k323_idempotent_remote_mutation.sql"
V2_MIGRATION = ROOT / "migrations" / "202609180001_k323_v2_multi_domain_transport.sql"
HEALTH_MIGRATION = ROOT / "migrations" / "202609190001_rel05f_health_routine_aggregate.sql"


SETUP_SQL = r"""
set client_min_messages = warning;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.notes (
  id uuid primary key,
  user_id uuid not null,
  title text not null default '',
  body text not null default '',
  updated_at bigint not null default 0,
  folder_id uuid,
  deleted_at bigint
);

create table public.health_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day_name text not null,
  blocks uuid[] not null default '{}'
);
insert into public.health_routines (user_id, day_name, blocks) values
  ('11111111-1111-4111-8111-111111111111', 'Day 4', array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid]);
"""


PRE_V2_SENTINEL_SQL = r"""
insert into public.remote_sync_generations (
  owner_id, project_scope, namespace_fingerprint, generation_id, status
) values (
  '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64), 'generation-1', 'active'
);

insert into public.remote_mutation_receipts (
  authenticated_owner_id, project_scope, namespace_fingerprint, generation_id,
  domain, entity_id, mutation_id, idempotency_key, operation, base_revision,
  local_revision, payload_digest, request_digest, result_code, result_revision,
  result_entity_updated_at, remote_mutation_ref, response_payload
) values (
  '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64), 'generation-1',
  'notes', '99999999-9999-4999-8999-999999999999',
  'mut.99999999-9999-4999-8999-999999999999', 'k322.' || repeat('9', 64),
  'upsert', null, 1, repeat('8', 64), repeat('7', 64), 'APPLIED', 1,
  '2026-09-18T00:00:00Z', '88888888-8888-4888-8888-888888888888',
  '{"protocolVersion":1,"outcome":"applied"}'::jsonb
);
"""


ASSERTIONS_SQL = r"""
do $$
begin
  if not exists (
    select 1 from public.remote_mutation_receipts
    where mutation_id = 'mut.99999999-9999-4999-8999-999999999999'
      and protocol_version = 1
      and domain = 'notes'
  ) then
    raise exception 'REL05E_V1_SENTINEL_LOST';
  end if;
end
$$;

create or replace function public.rel05e_fail_v2_receipt_insert_test()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.protocol_version = 2
    and current_setting('absinthe.rel05e_fail_receipt', true) = 'on' then
    raise exception 'REL05E_SYNTHETIC_RECEIPT_FAILURE';
  end if;
  return new;
end
$$;

create trigger rel05e_fail_v2_receipt_insert_test
before insert on public.remote_mutation_receipts
for each row execute function public.rel05e_fail_v2_receipt_insert_test();
revoke all on function public.rel05e_fail_v2_receipt_insert_test()
  from public, anon, authenticated, service_role;

set role service_role;

do $$
declare
  v_first jsonb;
  v_replay jsonb;
  v_stale jsonb;
  v_v1 jsonb;
  v_count bigint;
begin
  v_first := public.apply_remote_reference_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'reference_alpha',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'mut.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'k322.' || repeat('a', 64),
    'upsert', null, 1,
    '{"kind":"entity_snapshot","record":{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","label":"alpha","ordinal":7}}'::jsonb,
    repeat('b', 64), repeat('c', 64), '2026-09-18T00:00:00Z'
  );
  if v_first #>> '{outcome}' <> 'applied'
    or (v_first #>> '{serverRevision}')::bigint <> 1
    or (v_first #>> '{changeSequence}')::bigint <> 1 then
    raise exception 'REL05E_FIRST_MUTATION_FAILED: %', v_first;
  end if;

  select count(*) into v_count from public.remote_reference_entities_v2
  where entity_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 1 then raise exception 'REL05E_ENTITY_COUNT: %', v_count; end if;
  select count(*) into v_count from public.remote_reference_changes_v2
  where entity_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 1 then raise exception 'REL05E_CHANGE_COUNT: %', v_count; end if;
  select count(*) into v_count from public.remote_mutation_receipts
  where mutation_id = 'mut.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 1 then raise exception 'REL05E_RECEIPT_COUNT: %', v_count; end if;

  v_replay := public.apply_remote_reference_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'reference_alpha',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'mut.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'k322.' || repeat('a', 64),
    'upsert', null, 1,
    '{"kind":"entity_snapshot","record":{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","label":"alpha","ordinal":7}}'::jsonb,
    repeat('b', 64), repeat('c', 64), '2026-09-18T00:00:00Z'
  );
  if v_replay is distinct from v_first then
    raise exception 'REL05E_REPLAY_CHANGED: % / %', v_first, v_replay;
  end if;
  select count(*) into v_count from public.remote_reference_changes_v2
  where entity_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 1 then raise exception 'REL05E_REPLAY_DUPLICATED_CHANGE: %', v_count; end if;

  v_stale := public.apply_remote_reference_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'reference_alpha',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'mut.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'k322.' || repeat('d', 64),
    'upsert', 99, 2,
    '{"kind":"entity_snapshot","record":{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","label":"stale","ordinal":8}}'::jsonb,
    repeat('e', 64), repeat('f', 64), '2026-09-18T00:00:01Z'
  );
  if v_stale #>> '{errorCode}' <> 'REMOTE_REVISION_CONFLICT' then
    raise exception 'REL05E_STALE_REVISION_ACCEPTED: %', v_stale;
  end if;
  select server_revision into v_count from public.remote_reference_entities_v2
  where entity_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 1 then raise exception 'REL05E_STALE_CHANGED_REVISION: %', v_count; end if;
  select count(*) into v_count from public.remote_reference_changes_v2
  where entity_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 1 then raise exception 'REL05E_STALE_APPENDED_CHANGE: %', v_count; end if;

  v_v1 := public.apply_remote_note_mutation_v1(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'notes', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'mut.dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'k322.' || repeat('6', 64),
    'upsert', null, 1,
    '{"kind":"entity_snapshot","record":{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","title":"v1","body":"compatible","updatedAt":1,"folderId":"","deletedAt":null,"starred":false,"properties":{},"relations":[]}}'::jsonb,
    repeat('5', 64), repeat('4', 64), '2026-09-18T00:00:02Z'
  );
  if v_v1 #>> '{outcome}' <> 'applied' then
    raise exception 'REL05E_V1_RPC_FAILED: %', v_v1;
  end if;
end
$$;

set absinthe.rel05e_fail_receipt = 'on';
do $$
declare
  v_count bigint;
begin
  begin
    perform public.apply_remote_reference_mutation_v2(
      '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
      'generation-1', 'device-a', 'reference_alpha',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'mut.cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'k322.' || repeat('3', 64),
      'upsert', null, 1,
      '{"kind":"entity_snapshot","record":{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","label":"rollback","ordinal":9}}'::jsonb,
      repeat('2', 64), repeat('1', 64), '2026-09-18T00:00:03Z'
    );
    raise exception 'REL05E_EXPECTED_TRANSACTION_FAILURE';
  exception when others then
    if sqlerrm <> 'REL05E_SYNTHETIC_RECEIPT_FAILURE' then raise; end if;
  end;

  select count(*) into v_count from public.remote_reference_entities_v2
  where entity_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  if v_count <> 0 then raise exception 'REL05E_ROLLBACK_ENTITY_FAILED'; end if;
  select count(*) into v_count from public.remote_reference_changes_v2
  where entity_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  if v_count <> 0 then raise exception 'REL05E_ROLLBACK_CHANGE_FAILED'; end if;
  select count(*) into v_count from public.remote_mutation_receipts
  where mutation_id = 'mut.cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  if v_count <> 0 then raise exception 'REL05E_ROLLBACK_RECEIPT_FAILED'; end if;
end
$$;

reset role;

do $$
begin
  if has_table_privilege('service_role', 'public.remote_sync_generations', 'UPDATE')
    or has_table_privilege('service_role', 'public.remote_mutation_receipts', 'UPDATE')
    or has_table_privilege('service_role', 'public.remote_reference_changes_v2', 'UPDATE')
    or has_table_privilege('service_role', 'public.remote_reference_changes_v2', 'DELETE') then
    raise exception 'REL05E_EXCESS_SERVICE_ROLE_MUTATION_PRIVILEGE';
  end if;
  if has_table_privilege('authenticated', 'public.remote_reference_entities_v2', 'SELECT')
    or has_table_privilege('authenticated', 'public.remote_reference_changes_v2', 'SELECT')
    or has_table_privilege('authenticated', 'public.remote_mutation_receipts', 'SELECT') then
    raise exception 'REL05E_AUTHENTICATED_DIRECT_ACCESS';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.apply_remote_reference_mutation_v2(uuid,text,text,text,text,text,text,text,text,text,bigint,bigint,jsonb,text,text,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'REL05E_AUTHENTICATED_RPC_EXECUTE';
  end if;

  begin
    update public.remote_mutation_receipts
    set result_code = result_code
    where mutation_id = 'mut.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'REL05E_RECEIPT_UPDATE_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'K323_IMMUTABLE_RECEIPT' then raise; end if;
  end;

  begin
    update public.remote_reference_changes_v2
    set operation = operation
    where entity_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'REL05E_CHANGE_UPDATE_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'K323_V2_IMMUTABLE_CHANGE' then raise; end if;
  end;
end
$$;

select 'REL05E_POSTGRES_INTEGRATION_PASS' as result;
"""


HEALTH_ASSERTIONS_SQL = r"""
reset absinthe.rel05e_fail_receipt;

do $$
begin
  if not exists (
    select 1 from public.health_routines
    where user_id = '11111111-1111-4111-8111-111111111111' and day_name = 'Day 4'
  ) then raise exception 'REL05F_ADDITIVE_MIGRATION_LOST_LEGACY_ROW'; end if;
end
$$;

set role service_role;

do $$
declare
  v_generation jsonb;
  v_first jsonb;
  v_replay jsonb;
  v_three_day jsonb;
  v_profile jsonb;
  v_named jsonb;
  v_tombstone jsonb;
  v_restore jsonb;
  v_stale jsonb;
  v_pull jsonb;
  v_count bigint;
begin
  v_generation := public.ensure_remote_health_generation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a'
  );
  if v_generation #>> '{status}' <> 'active' then
    raise exception 'REL05F_GENERATION_FAILED: %', v_generation;
  end if;

  v_first := public.apply_health_routine_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'health_routine_preset',
    '00000000-0000-5000-8000-000000000001',
    'mut.10000000-0000-4000-8000-000000000001', 'k322.' || repeat('1', 64),
    'upsert', null, 1,
    '{"kind":"entity_snapshot","record":{"id":"00000000-0000-5000-8000-000000000001","name":"Default","splitCount":4,"days":[{"dayName":"Day 1","blocks":["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],"plannedSets":{"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa":4}},{"dayName":"Day 2","blocks":[],"plannedSets":{}},{"dayName":"Day 3","blocks":[],"plannedSets":{}},{"dayName":"Day 4","blocks":["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],"plannedSets":{}}],"isDefault":true}}'::jsonb,
    repeat('2', 64), repeat('3', 64), '2026-09-19T00:00:00Z'
  );
  if v_first #>> '{outcome}' <> 'applied' or (v_first #>> '{serverRevision}')::bigint <> 1 then
    raise exception 'REL05F_FIRST_PRESET_FAILED: %', v_first;
  end if;

  v_replay := public.apply_health_routine_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'health_routine_preset',
    '00000000-0000-5000-8000-000000000001',
    'mut.10000000-0000-4000-8000-000000000001', 'k322.' || repeat('1', 64),
    'upsert', null, 1,
    '{"kind":"entity_snapshot","record":{"id":"00000000-0000-5000-8000-000000000001","name":"Default","splitCount":4,"days":[{"dayName":"Day 1","blocks":["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],"plannedSets":{"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa":4}},{"dayName":"Day 2","blocks":[],"plannedSets":{}},{"dayName":"Day 3","blocks":[],"plannedSets":{}},{"dayName":"Day 4","blocks":["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],"plannedSets":{}}],"isDefault":true}}'::jsonb,
    repeat('2', 64), repeat('3', 64), '2026-09-19T00:00:00Z'
  );
  if v_replay is distinct from v_first then raise exception 'REL05F_REPLAY_CHANGED'; end if;

  v_three_day := public.apply_health_routine_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'health_routine_preset',
    '00000000-0000-5000-8000-000000000001',
    'mut.10000000-0000-4000-8000-000000000002', 'k322.' || repeat('4', 64),
    'upsert', 1, 2,
    '{"kind":"entity_snapshot","record":{"id":"00000000-0000-5000-8000-000000000001","name":"Default","splitCount":3,"days":[{"dayName":"Day 1","blocks":["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],"plannedSets":{"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa":4}},{"dayName":"Day 2","blocks":[],"plannedSets":{}},{"dayName":"Day 3","blocks":[],"plannedSets":{}}],"isDefault":true}}'::jsonb,
    repeat('5', 64), repeat('6', 64), '2026-09-19T00:00:01Z'
  );
  if (v_three_day #>> '{serverRevision}')::bigint <> 2 then
    raise exception 'REL05F_THREE_DAY_REVISION_FAILED: %', v_three_day;
  end if;
  select count(*) into v_count from public.health_routines
  where user_id = '11111111-1111-4111-8111-111111111111';
  if v_count <> 3 then raise exception 'REL05F_LEGACY_PROJECTION_COUNT: %', v_count; end if;
  if exists (select 1 from public.health_routines where user_id = '11111111-1111-4111-8111-111111111111' and day_name = 'Day 4') then
    raise exception 'REL05F_STALE_DAY4_SURVIVED';
  end if;

  v_profile := public.apply_health_routine_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'health_routine_profile',
    '00000000-0000-5000-8000-000000000002',
    'mut.10000000-0000-4000-8000-000000000003', 'k322.' || repeat('7', 64),
    'upsert', null, 1,
    '{"kind":"entity_snapshot","record":{"id":"00000000-0000-5000-8000-000000000002","activePresetId":"00000000-0000-5000-8000-000000000001"}}'::jsonb,
    repeat('8', 64), repeat('9', 64), '2026-09-19T00:00:02Z'
  );
  if v_profile #>> '{outcome}' <> 'applied' then raise exception 'REL05F_PROFILE_FAILED: %', v_profile; end if;

  v_named := public.apply_health_routine_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'health_routine_preset',
    '00000000-0000-5000-8000-000000000003',
    'mut.10000000-0000-4000-8000-000000000004', 'k322.' || repeat('a', 64),
    'upsert', null, 1,
    '{"kind":"entity_snapshot","record":{"id":"00000000-0000-5000-8000-000000000003","name":"Named","splitCount":1,"days":[{"dayName":"Day 1","blocks":[],"plannedSets":{}}],"isDefault":false}}'::jsonb,
    repeat('b', 64), repeat('c', 64), '2026-09-19T00:00:03Z'
  );
  if v_named #>> '{outcome}' <> 'applied' then raise exception 'REL05F_NAMED_FAILED: %', v_named; end if;

  v_tombstone := public.apply_health_routine_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'health_routine_preset',
    '00000000-0000-5000-8000-000000000003',
    'mut.10000000-0000-4000-8000-000000000005', 'k322.' || repeat('d', 64),
    'tombstone', 1, 2,
    '{"kind":"tombstone","entityId":"00000000-0000-5000-8000-000000000003","deletedAt":"2026-09-19T00:00:04Z","revision":2}'::jsonb,
    repeat('e', 64), repeat('f', 64), '2026-09-19T00:00:04Z'
  );
  if v_tombstone #>> '{outcome}' <> 'applied' then raise exception 'REL05F_TOMBSTONE_FAILED: %', v_tombstone; end if;

  v_restore := public.apply_health_routine_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'health_routine_preset',
    '00000000-0000-5000-8000-000000000003',
    'mut.10000000-0000-4000-8000-000000000006', 'k322.' || repeat('0', 64),
    'restore', 2, 3,
    '{"kind":"entity_snapshot","record":{"id":"00000000-0000-5000-8000-000000000003","name":"Named restored","splitCount":1,"days":[{"dayName":"Day 1","blocks":[],"plannedSets":{}}],"isDefault":false}}'::jsonb,
    repeat('0', 64), repeat('1', 64), '2026-09-19T00:00:05Z'
  );
  if v_restore #>> '{outcome}' <> 'applied' or (v_restore #>> '{serverRevision}')::bigint <> 3 then
    raise exception 'REL05F_RESTORE_FAILED: %', v_restore;
  end if;

  v_stale := public.apply_health_routine_mutation_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'device-a', 'health_routine_preset',
    '00000000-0000-5000-8000-000000000001',
    'mut.10000000-0000-4000-8000-000000000007', 'k322.' || repeat('2', 64),
    'upsert', 99, 3,
    '{"kind":"entity_snapshot","record":{"id":"00000000-0000-5000-8000-000000000001","name":"Stale","splitCount":1,"days":[{"dayName":"Day 1","blocks":[],"plannedSets":{}}],"isDefault":true}}'::jsonb,
    repeat('3', 64), repeat('4', 64), '2026-09-19T00:00:06Z'
  );
  if v_stale #>> '{errorCode}' <> 'REMOTE_REVISION_CONFLICT' then
    raise exception 'REL05F_STALE_REVISION_ACCEPTED: %', v_stale;
  end if;

  v_pull := public.pull_health_routine_changes_v2(
    '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
    'generation-1', 'health_routine_preset', 0, null, 100
  );
  if v_pull #>> '{status}' <> 'changes' or jsonb_array_length(v_pull #> '{changes}') <> 5 then
    raise exception 'REL05F_PULL_FAILED: %', v_pull;
  end if;
end
$$;

reset role;

do $$
begin
  if has_table_privilege('authenticated', 'public.health_routine_presets', 'SELECT')
    or has_table_privilege('authenticated', 'public.health_routine_presets', 'INSERT')
    or has_table_privilege('authenticated', 'public.health_routine_profile', 'SELECT')
    or has_table_privilege('authenticated', 'public.health_routine_profile', 'UPDATE') then
    raise exception 'REL05F_AUTHENTICATED_DIRECT_ACCESS';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.apply_health_routine_mutation_v2(uuid,text,text,text,text,text,text,text,text,text,bigint,bigint,jsonb,text,text,timestamptz)',
    'EXECUTE'
  ) then raise exception 'REL05F_AUTHENTICATED_RPC_EXECUTE'; end if;
end
$$;

select 'REL05F_POSTGRES_INTEGRATION_PASS' as result;
"""


def _run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, text=True, capture_output=True, check=False, **kwargs)


def test_v2_and_health_migrations_service_role_rpc_replay_rollback_and_privileges() -> None:
    docker = shutil.which("docker")
    if docker is None:
        pytest.fail("K323_POSTGRES_INTEGRATION=1 but docker is unavailable")

    name = f"absinthe-rel05e-{uuid.uuid4().hex[:12]}"
    started = _run([
        docker, "run", "--detach", "--rm", "--name", name,
        "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_PASSWORD=rel05e-test",
        "postgres:15-alpine",
    ])
    assert started.returncode == 0, started.stderr
    try:
        for _ in range(60):
            ready = _run([docker, "exec", name, "pg_isready", "-U", "postgres"])
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            pytest.fail("isolated PostgreSQL did not become ready")

        sql = "\n".join([
            SETUP_SQL,
            V1_MIGRATION.read_text(encoding="utf-8"),
            PRE_V2_SENTINEL_SQL,
            V2_MIGRATION.read_text(encoding="utf-8"),
            ASSERTIONS_SQL,
            HEALTH_MIGRATION.read_text(encoding="utf-8"),
            HEALTH_ASSERTIONS_SQL,
        ])
        result = _run(
            [docker, "exec", "-i", name, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
            input=sql,
        )
        assert result.returncode == 0, f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        assert "REL05E_POSTGRES_INTEGRATION_PASS" in result.stdout
        assert "REL05F_POSTGRES_INTEGRATION_PASS" in result.stdout

        # A pull holds the shared generation fence until its transaction ends.
        # A direct status transition must wait in the trigger for the matching
        # exclusive advisory lock, proving the lifecycle race is serialized.
        pull_transaction = """
begin;
set role service_role;
select public.pull_remote_reference_changes_v2(
  '11111111-1111-4111-8111-111111111111', 'project-test', repeat('1', 64),
  'generation-1', 'reference_alpha', 0, null, 10
);
select pg_sleep(2);
commit;
"""
        locker = subprocess.Popen(
            [docker, "exec", "-i", name, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        assert locker.stdin is not None
        locker.stdin.write(pull_transaction)
        locker.stdin.close()
        time.sleep(0.5)
        transition_started = time.monotonic()
        transition = _run([
            docker, "exec", name, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
            "-c", "update public.remote_sync_generations set status='stale' where generation_id='generation-1'",
        ])
        transition_elapsed = time.monotonic() - transition_started
        locker.wait(timeout=10)
        locker_stderr = locker.stderr.read() if locker.stderr is not None else ""
        assert locker.returncode == 0, locker_stderr
        assert transition.returncode == 0, transition.stderr
        assert transition_elapsed >= 1.0, "generation transition did not wait for the shared operation fence"
    finally:
        _run([docker, "rm", "--force", name])
