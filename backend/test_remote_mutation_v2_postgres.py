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


SETUP_SQL = r"""
set client_min_messages = warning;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create table public.notes (
  id uuid primary key,
  user_id uuid not null,
  title text not null default '',
  body text not null default '',
  updated_at bigint not null default 0,
  folder_id uuid,
  deleted_at bigint
);
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


def _run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, text=True, capture_output=True, check=False, **kwargs)


def test_v2_migration_service_role_rpc_replay_rollback_and_privileges() -> None:
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
        ])
        result = _run(
            [docker, "exec", "-i", name, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
            input=sql,
        )
        assert result.returncode == 0, f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        assert "REL05E_POSTGRES_INTEGRATION_PASS" in result.stdout

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
