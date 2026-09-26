"""Real PostgreSQL authority, transport, replay, snapshot and lock tests."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import uuid

import pytest

from remote_mutation_v2 import payload_hash
from test_remote_mutation_v2_postgres import (
    SETUP_SQL, V1_MIGRATION, V2_MIGRATION, HEALTH_MIGRATION,
    WORKOUT_FOUNDATION_MIGRATION,
)


pytestmark = pytest.mark.skipif(
    os.getenv("K323_POSTGRES_INTEGRATION") != "1",
    reason="set K323_POSTGRES_INTEGRATION=1 for the isolated real PostgreSQL suite",
)

MIGRATION = Path(__file__).parent / "migrations" / "202609240001_rel05g4a_workout_authority_transport.sql"
OWNER_A = "11111111-1111-4111-8111-111111111111"
OWNER_B = "22222222-2222-4222-8222-222222222222"
PROJECT = "project-test"
DESKTOP = ("a" * 64, "generation-desktop", "device-desktop")
MOBILE = ("b" * 64, "generation-mobile", "device-mobile")


def _run(command: list[str], *, input: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, input=input, text=True, capture_output=True, check=False)


def _psql(docker: str, name: str, sql: str, *, expect_error: bool = False) -> str:
    result = _run([
        docker, "exec", "-i", name, "psql", "-U", "postgres", "-d", "postgres",
        "-t", "-A", "-v", "ON_ERROR_STOP=1",
    ], input=sql)
    if expect_error:
        assert result.returncode != 0, result.stdout
        return result.stderr
    assert result.returncode == 0, f"SQL FAILED\n{result.stdout}\n{result.stderr}"
    return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""


def _quoted(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _record(entity_id: str) -> dict:
    return {
        "version": 1, "id": entity_id, "localDate": "2026-09-24",
        "entries": [{
            "id": str(uuid.uuid4()),
            "exercise": {"id": None, "name": "Push-up", "type": "bodyweight", "tags": [], "cardioMode": None},
            "sets": [{
                "id": str(uuid.uuid4()), "ordinal": 1, "kind": "bodyweight",
                "loadKind": "bodyweight", "reps": 10, "assistedReps": None,
                "dropset": False, "done": True,
            }],
        }],
    }


def _identity() -> tuple[str, str]:
    return "mut." + str(uuid.uuid4()), "k322." + uuid.uuid4().hex + uuid.uuid4().hex


def _mutation_sql(
    owner: str, generation: tuple[str, str, str], binding: str,
    entity_id: str, mutation_id: str, idempotency_key: str, operation: str,
    base: int | None, local: int, record: dict,
    *, digest: str | None = None, epoch: int = 1,
) -> str:
    payload = ({"kind": "tombstone", "entityId": entity_id, "revision": local,
                "deletedAt": "2026-09-24T10:00:00Z"}
               if operation == "tombstone" else {"kind": "entity_snapshot", "record": record})
    payload_json = _quoted(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    base_sql = "null" if base is None else str(base)
    content_hash_sql = "null" if operation == "tombstone" else _quoted(payload_hash(record))
    canonical_payload_hash = payload_hash(payload)
    expected_tuple = [
        "absinthe-workout-remote-v1", 2, owner, PROJECT, "health_workout_session",
        generation[0], generation[1], generation[2], binding, epoch,
        mutation_id, idempotency_key, entity_id, operation, base, local,
        canonical_payload_hash,
    ]
    request_digest = digest or hashlib.sha256(json.dumps(
        expected_tuple, ensure_ascii=False, separators=(",", ":"),
    ).encode("utf-8")).hexdigest()
    return (
        "select public.apply_health_workout_mutation_v1("
        f"{_quoted(owner)}::uuid, {_quoted(PROJECT)}, {_quoted(generation[0])}, "
        f"{_quoted(generation[1])}, {_quoted(generation[2])}, {_quoted(binding)}::uuid, {epoch}, "
        f"{_quoted(entity_id)}::uuid, {_quoted(mutation_id)}, {_quoted(idempotency_key)}, "
        f"{_quoted(operation)}, {base_sql}, {local}, {payload_json}::jsonb, "
        f"{_quoted(canonical_payload_hash)}, {content_hash_sql}, {_quoted(request_digest)})"
    )


def _call(docker: str, name: str, sql: str) -> dict:
    return json.loads(_psql(docker, name, "set role service_role;\n" + sql + ";"))


def _register(docker: str, name: str, owner: str, generation: tuple[str, str, str]) -> dict:
    return _call(docker, name,
        "select public.register_health_workout_generation_v1("
        f"{_quoted(owner)}::uuid, {_quoted(PROJECT)}, {_quoted(generation[0])}, "
        f"{_quoted(generation[1])}, {_quoted(generation[2])})")


@pytest.fixture(scope="module")
def postgres():
    docker = shutil.which("docker")
    if docker is None:
        pytest.fail("K323_POSTGRES_INTEGRATION=1 but Docker is unavailable")
    name = "absinthe-rel05g4a-" + uuid.uuid4().hex[:10]
    started = _run([
        docker, "run", "--detach", "--rm", "--name", name,
        "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_PASSWORD=rel05g4a-test",
        "postgres:15-alpine",
    ])
    assert started.returncode == 0, started.stderr
    try:
        for _ in range(60):
            if _run([docker, "exec", name, "pg_isready", "-U", "postgres"]).returncode == 0:
                break
            time.sleep(0.5)
        else:
            pytest.fail("isolated PostgreSQL did not start")
        setup = "\n".join([
            SETUP_SQL, V1_MIGRATION.read_text(encoding="utf-8"),
            V2_MIGRATION.read_text(encoding="utf-8"),
            HEALTH_MIGRATION.read_text(encoding="utf-8"),
            WORKOUT_FOUNDATION_MIGRATION.read_text(encoding="utf-8"),
            # Pre-existing dormant G1 row must survive the additive migration.
            """insert into public.health_workout_sessions_v2
            (user_id, project_scope, id, revision, record, is_deleted)
            values ('11111111-1111-4111-8111-111111111111', 'project-test',
              'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1,
              '{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}'::jsonb, false);""",
            MIGRATION.read_text(encoding="utf-8"),
            MIGRATION.read_text(encoding="utf-8"),
        ])
        _psql(docker, name, setup)
        assert _psql(docker, name,
            "select count(*) from public.health_workout_sessions_v2 "
            "where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and content_hash is null;") == "1"
        yield docker, name
    finally:
        _run([docker, "rm", "--force", name])


def _ready(docker: str, name: str, owner: str, generation: tuple[str, str, str]) -> str:
    _psql(docker, name, f"""
        insert into public.health_workout_capabilities(user_id,project_scope,state)
        values ({_quoted(owner)}::uuid,{_quoted(PROJECT)},'FOUNDATION_READY')
        on conflict (user_id,project_scope) do update set state='FOUNDATION_READY';
        insert into public.remote_sync_generations
          (owner_id,project_scope,namespace_fingerprint,generation_id,status)
        values ({_quoted(owner)}::uuid,{_quoted(PROJECT)},{_quoted(generation[0])},
          {_quoted(generation[1])},'active')
        on conflict (owner_id,project_scope,namespace_fingerprint,generation_id)
        do update set status='active';
    """)
    result = _register(docker, name, owner, generation)
    assert result["status"] == "bound" and result["authorityEpoch"] == 1, result
    return result["bindingId"]


def test_capability_binding_scope_and_direct_dml_guards(postgres) -> None:
    docker, name = postgres
    absent = _register(docker, name, OWNER_A, DESKTOP)
    assert absent["errorCode"] == "CAPABILITY_DISABLED"
    assert _psql(docker, name, "select count(*) from public.health_workout_authorities;") == "0"
    binding = _ready(docker, name, OWNER_A, DESKTOP)
    assert _register(docker, name, OWNER_A, DESKTOP)["bindingId"] == binding
    assert _psql(docker, name,
        "select count(*) from public.health_workout_generation_bindings;") == "1"
    assert _register(docker, name, OWNER_A, (DESKTOP[0], DESKTOP[1], "forged-device"))["errorCode"] \
        == "STALE_GENERATION_BINDING"
    assert _register(docker, name, OWNER_B, DESKTOP)["errorCode"] == "CAPABILITY_DISABLED"
    assert _psql(docker, name, "select authority_epoch from public.health_workout_authorities;") == "1"
    for table in (
        "health_workout_sessions_v2", "health_workout_authorities",
        "health_workout_generation_bindings", "health_workout_snapshot_tokens",
    ):
        assert _psql(docker, name,
            f"select has_table_privilege('service_role','public.{table}','INSERT');") == "f"
        assert _psql(docker, name,
            f"select has_table_privilege('authenticated','public.{table}','INSERT');") == "f"
    assert "REL05G4A_RPC_ONLY" in _psql(docker, name,
        "set role service_role; insert into public.remote_mutation_receipts "
        "(authenticated_owner_id,domain) values "
        f"('{OWNER_A}'::uuid,'health_workout_session');", expect_error=True)
    assert "REL05G4A_RPC_ONLY" in _psql(docker, name,
        "set role service_role; insert into public.remote_reference_changes_v2(domain) "
        "values ('health_workout_session');", expect_error=True)
    assert _psql(docker, name,
        "select count(*) from public.remote_mutation_receipts where domain='health_workout_session';") == "0"


def test_cas_replay_cross_device_pull_snapshot_and_account_isolation(postgres) -> None:
    docker, name = postgres
    desktop_binding = _register(docker, name, OWNER_A, DESKTOP)["bindingId"]
    mobile_binding = _ready(docker, name, OWNER_A, MOBILE)
    b_binding = _ready(docker, name, OWNER_B, DESKTOP)
    entity_id = str(uuid.uuid4())
    record = _record(entity_id)
    mutation_id, idempotency_key = _identity()
    create_sql = _mutation_sql(OWNER_A, DESKTOP, desktop_binding, entity_id,
                               mutation_id, idempotency_key, "upsert", None, 1, record)
    first = _call(docker, name, create_sql)
    assert first["outcome"] == "success" and first["serverRevision"] == 1
    replay = _call(docker, name, create_sql)
    assert replay["outcome"] == "exact_replay"
    assert replay["remoteMutationRef"] == first["remoteMutationRef"]
    assert replay["changeSequence"] == first["changeSequence"]
    changed_digest = _mutation_sql(OWNER_A, DESKTOP, desktop_binding, entity_id,
                                   mutation_id, idempotency_key, "upsert", None, 1, record,
                                   digest="2" * 64)
    assert _call(docker, name, changed_digest)["errorCode"] == "REQUEST_DIGEST_MISMATCH"
    valid_changed_tuple = _mutation_sql(OWNER_A, DESKTOP, desktop_binding, entity_id,
        mutation_id, idempotency_key, "upsert", None, 2, record)
    assert _call(docker, name, valid_changed_tuple)["errorCode"] == "MUTATION_ID_CONFLICT"
    stale_epoch = _mutation_sql(OWNER_A, DESKTOP, desktop_binding, entity_id,
                                mutation_id, idempotency_key, "upsert", None, 1, record, epoch=2)
    assert _call(docker, name, stale_epoch)["errorCode"] == "STALE_AUTHORITY_EPOCH"

    mobile_pull = _call(docker, name, "select public.pull_health_workout_changes_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{MOBILE[0]}','{MOBILE[1]}','{MOBILE[2]}',"
        f"'{mobile_binding}'::uuid,1,0,null,100)")
    assert mobile_pull["status"] == "changes"
    assert any(change["entityId"] == entity_id for change in mobile_pull["changes"])
    assert all(change["domain"] == "health_workout_session" for change in mobile_pull["changes"])
    assert all(change["serverEpoch"] == mobile_pull["serverEpoch"] for change in mobile_pull["changes"])
    b_pull = _call(docker, name, "select public.pull_health_workout_changes_v1("
        f"'{OWNER_B}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{b_binding}'::uuid,1,0,null,100)")
    assert b_pull["changes"] == []

    update_id, update_key = _identity()
    updated = _call(docker, name, _mutation_sql(OWNER_A, MOBILE, mobile_binding, entity_id,
        update_id, update_key, "upsert", 1, 2, record))
    assert updated["serverRevision"] == 2
    desktop_pull = _call(docker, name, "select public.pull_health_workout_changes_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{desktop_binding}'::uuid,1,{first['changeSequence']},null,100)")
    assert any(change["remoteMutationRef"] == updated["remoteMutationRef"]
               for change in desktop_pull["changes"])

    tomb_id, tomb_key = _identity()
    tombstone = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, desktop_binding, entity_id,
        tomb_id, tomb_key, "tombstone", 2, 3, record))
    assert tombstone["serverRevision"] == 3
    restore_id, restore_key = _identity()
    restore = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, desktop_binding, entity_id,
        restore_id, restore_key, "restore", 3, 4, record))
    assert restore["serverRevision"] == 4
    assert _psql(docker, name, "select count(*) from public.remote_reference_changes_v2 "
        f"where entity_id='{entity_id}'::uuid;") == "4"
    assert _psql(docker, name, "select count(*) from public.remote_mutation_receipts "
        f"where entity_id='{entity_id}'::uuid;") == "4"

    pre_snapshot_entities = {entity_id}
    for _ in range(3):
        extra_id = str(uuid.uuid4())
        extra_mut, extra_key = _identity()
        extra = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, desktop_binding,
            extra_id, extra_mut, extra_key, "upsert", None, 1, _record(extra_id)))
        assert extra["outcome"] == "success"
        pre_snapshot_entities.add(extra_id)

    snap = _call(docker, name, "select public.begin_health_workout_snapshot_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{desktop_binding}'::uuid,1)")
    watermark = snap["watermark"]
    page = _call(docker, name, "select public.page_health_workout_snapshot_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{desktop_binding}'::uuid,1,'{snap['snapshotToken']}'::uuid,null,1)")
    seen = list(page["rows"])
    assert page["hasMore"]
    post_id = str(uuid.uuid4())
    post_mut, post_key = _identity()
    post = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, desktop_binding, post_id,
        post_mut, post_key, "upsert", None, 1, _record(post_id)))
    assert post["changeSequence"] > watermark
    while page["hasMore"]:
        page = _call(docker, name, "select public.page_health_workout_snapshot_v1("
            f"'{OWNER_A}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
            f"'{desktop_binding}'::uuid,1,'{snap['snapshotToken']}'::uuid,"
            f"'{page['nextEntityId']}'::uuid,1)")
        seen.extend(page["rows"])
    assert len({row["entityId"] for row in seen}) == len(seen)
    assert {row["entityId"] for row in seen} == pre_snapshot_entities
    assert post_id not in {row["entityId"] for row in seen}
    assert any(row["entityId"] == entity_id and row["serverRevision"] == 4 for row in seen)
    post_pull = _call(docker, name, "select public.pull_health_workout_changes_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{desktop_binding}'::uuid,1,{watermark},'{snap['serverEpoch']}'::uuid,100)")
    assert any(change["entityId"] == post_id for change in post_pull["changes"])
    b_snapshot = _call(docker, name, "select public.begin_health_workout_snapshot_v1("
        f"'{OWNER_B}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{b_binding}'::uuid,1)")
    b_page = _call(docker, name, "select public.page_health_workout_snapshot_v1("
        f"'{OWNER_B}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{b_binding}'::uuid,1,'{b_snapshot['snapshotToken']}'::uuid,null,16)")
    assert b_page["rows"] == []
    stolen = _call(docker, name, "select public.page_health_workout_snapshot_v1("
        f"'{OWNER_B}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{b_binding}'::uuid,1,'{snap['snapshotToken']}'::uuid,null,16)")
    assert stolen["errorCode"] == "SNAPSHOT_TOKEN_INVALID"
    _psql(docker, name, "update public.remote_reference_streams_v2 "
        f"set server_epoch=gen_random_uuid() where authenticated_owner_id='{OWNER_A}'::uuid "
        f"and project_scope='{PROJECT}';")
    invalid_epoch = _call(docker, name, "select public.page_health_workout_snapshot_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}','{DESKTOP[2]}',"
        f"'{desktop_binding}'::uuid,1,'{snap['snapshotToken']}'::uuid,null,16)")
    assert invalid_epoch["status"] == "full_resync_required"


def test_real_concurrent_replay_cas_digest_race_and_authority_lock(postgres) -> None:
    docker, name = postgres
    binding = _register(docker, name, OWNER_A, DESKTOP)["bindingId"]

    def race(first: str, second: str) -> list[dict]:
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(_call, docker, name, sql) for sql in (first, second)]
            return [future.result() for future in futures]

    entity = str(uuid.uuid4())
    record = _record(entity)
    mutation_id, key = _identity()
    create = _mutation_sql(OWNER_A, DESKTOP, binding, entity, mutation_id, key,
                           "upsert", None, 1, record)
    two = race(create, create)
    assert {item["outcome"] for item in two} == {"success", "exact_replay"}
    assert len({item["remoteMutationRef"] for item in two}) == 1
    assert _psql(docker, name, "select count(*) from public.remote_reference_changes_v2 "
        f"where entity_id='{entity}'::uuid;") == "1"

    update_a, key_a = _identity()
    update_b, key_b = _identity()
    a = _mutation_sql(OWNER_A, DESKTOP, binding, entity, update_a, key_a, "upsert", 1, 2, record)
    b = _mutation_sql(OWNER_A, DESKTOP, binding, entity, update_b, key_b, "upsert", 1, 2, record)
    competitors = race(a, b)
    assert {item.get("errorCode") for item in competitors} == {None, "CAS_CONFLICT"}
    assert _psql(docker, name, "select revision from public.health_workout_sessions_v2 "
        f"where id='{entity}'::uuid;") == "2"

    collision_entity = str(uuid.uuid4())
    collision_record = _record(collision_entity)
    collision_id, collision_key = _identity()
    same_id_a = _mutation_sql(OWNER_A, DESKTOP, binding, collision_entity,
        collision_id, collision_key, "upsert", None, 1, collision_record)
    same_id_b = _mutation_sql(OWNER_A, DESKTOP, binding, collision_entity,
        collision_id, collision_key, "upsert", None, 2, collision_record)
    collision = race(same_id_a, same_id_b)
    assert {item.get("errorCode") for item in collision} == {None, "MUTATION_ID_CONFLICT"}
    assert _psql(docker, name, "select count(*) from public.remote_reference_changes_v2 "
        f"where entity_id='{collision_entity}'::uuid;") == "1"

    # Hold the exact frozen authority key in one backend and prove a mutation
    # waits, while a different account can acquire its own key concurrently.
    hold = subprocess.Popen([
        docker, "exec", "-i", name, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
    ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert hold.stdin is not None
    hold.stdin.write(
        "begin; select public.lock_health_workout_authority_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}'); select pg_sleep(2); commit;\n"
    )
    hold.stdin.close()
    for _ in range(20):
        if _psql(docker, name,
            "select count(*) from pg_catalog.pg_locks "
            "where locktype='advisory' and granted and pid<>pg_backend_pid();") != "0":
            break
        time.sleep(0.05)
    else:
        pytest.fail("authority lock holder never acquired the advisory lock")
    assert _psql(docker, name,
        "select pg_try_advisory_xact_lock(hashtextextended("
        f"'{OWNER_B}|{PROJECT}|health_workout_session|authority',0));") == "t"
    held_entity = str(uuid.uuid4())
    held_id, held_key = _identity()
    started = time.monotonic()
    result = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, binding, held_entity,
        held_id, held_key, "upsert", None, 1, _record(held_entity)))
    elapsed = time.monotonic() - started
    hold.wait(timeout=10)
    assert hold.returncode == 0, hold.stderr.read() if hold.stderr else ""
    assert result["outcome"] == "success" and elapsed >= 1.0

    _psql(docker, name, "begin; select public.lock_health_workout_authority_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}'); update public.health_workout_authorities "
        "set state='RESET_FENCED', current_reset_job_id=gen_random_uuid() "
        f"where user_id='{OWNER_A}'::uuid and project_scope='{PROJECT}'; commit;")
    assert _call(docker, name, create)["errorCode"] == "AUTHORITY_RESET_FENCED"
    _psql(docker, name, "begin; select public.lock_health_workout_authority_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}'); update public.health_workout_authorities "
        "set state='OPEN', current_reset_job_id=null "
        f"where user_id='{OWNER_A}'::uuid and project_scope='{PROJECT}'; commit;")

    # A receipt failure must roll back the preceding entity CAS as well as the
    # yet-to-be-written shared change event.
    _psql(docker, name, """
        create or replace function public.rel05g4a_fail_receipt_test()
        returns trigger language plpgsql as $$ begin
          if new.domain='health_workout_session' then
            raise exception 'REL05G4A_SYNTHETIC_RECEIPT_FAILURE';
          end if;
          return new;
        end $$;
        create trigger rel05g4a_fail_receipt_test before insert
        on public.remote_mutation_receipts for each row
        execute function public.rel05g4a_fail_receipt_test();
    """)
    failure_entity = str(uuid.uuid4())
    failure_id, failure_key = _identity()
    failure_sql = _mutation_sql(OWNER_A, DESKTOP, binding, failure_entity,
        failure_id, failure_key, "upsert", None, 1, _record(failure_entity))
    assert "REL05G4A_SYNTHETIC_RECEIPT_FAILURE" in _psql(
        docker, name, "set role service_role; " + failure_sql + ";", expect_error=True,
    )
    assert _psql(docker, name, "select count(*) from public.health_workout_sessions_v2 "
        f"where id='{failure_entity}'::uuid;") == "0"
    assert _psql(docker, name, "select count(*) from public.remote_reference_changes_v2 "
        f"where entity_id='{failure_entity}'::uuid;") == "0"
    _psql(docker, name, "drop trigger rel05g4a_fail_receipt_test "
        "on public.remote_mutation_receipts; drop function public.rel05g4a_fail_receipt_test();")

    # Simulate the later G4C epoch transition using the frozen lock. The old
    # receipt remains durable but cannot replay as current authority.
    _psql(docker, name, "begin; select public.lock_health_workout_authority_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}'); update public.health_workout_authorities "
        "set authority_epoch=2 "
        f"where user_id='{OWNER_A}'::uuid and project_scope='{PROJECT}'; commit;")
    assert _call(docker, name, create)["errorCode"] == "STALE_AUTHORITY_EPOCH"
    assert _psql(docker, name, "select count(*) from public.remote_mutation_receipts "
        f"where mutation_id='{mutation_id}';") == "1"
