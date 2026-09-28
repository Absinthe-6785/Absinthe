"""Isolated PostgreSQL tests for the dormant G4C authority reset transport."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import time
import uuid

import pytest

from test_remote_mutation_v2_postgres import (
    SETUP_SQL, V1_MIGRATION, V2_MIGRATION, HEALTH_MIGRATION,
    WORKOUT_FOUNDATION_MIGRATION,
)
from test_rel05g4a_workout_postgres import (
    MIGRATION as G4A_MIGRATION, TOMBSTONE_UUID_MIGRATION,
    OWNER_A, OWNER_B, PROJECT, DESKTOP, MOBILE,
    _run, _psql, _quoted, _call, _ready, _register,
    _record, _identity, _mutation_sql,
)
from workout_remote_authority import WorkoutResetRequest, workout_reset_request_digest


pytestmark = pytest.mark.skipif(
    os.getenv("K323_POSTGRES_INTEGRATION") != "1",
    reason="set K323_POSTGRES_INTEGRATION=1 for isolated PostgreSQL",
)
MIGRATION = Path(__file__).parent / "migrations" / "202609280001_rel05g4c_workout_remote_reset.sql"


@pytest.fixture
def postgres():
    docker = shutil.which("docker")
    if docker is None:
        pytest.fail("K323_POSTGRES_INTEGRATION=1 but Docker is unavailable")
    name = "absinthe-rel05g4c-" + uuid.uuid4().hex[:10]
    started = _run([docker, "run", "--detach", "--rm", "--name", name,
        "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_PASSWORD=rel05g4c-test",
        "postgres:15-alpine"])
    assert started.returncode == 0, started.stderr
    try:
        for _ in range(60):
            if _run([docker, "exec", name, "pg_isready", "-h", "127.0.0.1",
                     "-U", "postgres"]).returncode == 0:
                break
            time.sleep(0.5)
        else:
            pytest.fail("isolated PostgreSQL did not start")
        _psql(docker, name, "\n".join([
            SETUP_SQL, V1_MIGRATION.read_text(encoding="utf-8"),
            V2_MIGRATION.read_text(encoding="utf-8"),
            HEALTH_MIGRATION.read_text(encoding="utf-8"),
            WORKOUT_FOUNDATION_MIGRATION.read_text(encoding="utf-8"),
            G4A_MIGRATION.read_text(encoding="utf-8"),
            TOMBSTONE_UUID_MIGRATION.read_text(encoding="utf-8"),
            MIGRATION.read_text(encoding="utf-8"),
        ]))
        yield docker, name
    finally:
        _run([docker, "rm", "--force", name])


def _reset_identity(owner: str, binding: str, generation=DESKTOP,
                    *, epoch: int = 1, reset_id: str | None = None) -> dict:
    value = {
        "protocolVersion": 2, "namespaceKey": generation[0],
        "generationId": generation[1], "deviceId": generation[2],
        "bindingId": binding, "authorityEpoch": epoch,
        "resetId": reset_id or str(uuid.uuid4()), "requestDigest": "0" * 64,
    }
    value["requestDigest"] = workout_reset_request_digest(
        WorkoutResetRequest.model_validate(value), owner, PROJECT)
    return value


def _reset_sql(owner: str, identity: dict, *, continue_job: bool = False) -> str:
    name = "continue_health_workout_reset_v1" if continue_job else "begin_health_workout_reset_v1"
    return (f"select public.{name}("
        f"{_quoted(owner)}::uuid, {_quoted(PROJECT)}, {_quoted(identity['namespaceKey'])}, "
        f"{_quoted(identity['generationId'])}, {_quoted(identity['deviceId'])}, "
        f"{_quoted(identity['bindingId'])}::uuid, {identity['authorityEpoch']}, "
        f"{_quoted(identity['resetId'])}::uuid, {_quoted(identity['requestDigest'])})")


def _create(docker: str, name: str, owner: str, binding: str, *, generation=DESKTOP) -> tuple[str, dict, dict]:
    entity = str(uuid.uuid4())
    record = _record(entity)
    mutation_id, key = _identity()
    applied = _call(docker, name, _mutation_sql(owner, generation, binding, entity,
        mutation_id, key, "upsert", None, 1, record))
    assert applied["outcome"] == "success"
    return entity, record, applied


def _register_target(docker: str, name: str, owner: str, generation=MOBILE) -> str:
    _psql(docker, name, f"""
      insert into public.remote_sync_generations
      (owner_id, project_scope, namespace_fingerprint, generation_id, status)
      values ('{owner}'::uuid, '{PROJECT}', '{generation[0]}', '{generation[1]}', 'active');
    """)
    response = _register(docker, name, owner, generation)
    assert response["status"] == "bound" and response["authorityEpoch"] == 2
    return response["bindingId"]


def test_reset_freezes_inventory_fences_writes_and_emits_recoverable_tombstones(postgres) -> None:
    docker, name = postgres
    binding = _ready(docker, name, OWNER_A, DESKTOP)
    active, record, created = _create(docker, name, OWNER_A, binding)
    deleted, deleted_record, _ = _create(docker, name, OWNER_A, binding)
    tomb_id, tomb_key = _identity()
    tomb = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, binding, deleted,
        tomb_id, tomb_key, "tombstone", 1, 2, deleted_record))
    assert tomb["outcome"] == "success"
    snapshot = _call(docker, name, "select public.begin_health_workout_snapshot_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}',"
        f"'{DESKTOP[2]}','{binding}'::uuid,1)")
    assert snapshot["status"] == "snapshot"

    identity = _reset_identity(OWNER_A, binding)
    started = _call(docker, name, _reset_sql(OWNER_A, identity))
    assert started["status"] == "applying" and started["sourceEpoch"] == 1
    assert started["targetEpoch"] == 2 and started["inventoryCount"] == 2
    assert started["activeCount"] == 1 and started["appliedCount"] == 0
    assert _call(docker, name, _reset_sql(OWNER_A, identity)) == started
    assert _psql(docker, name, "select authority_epoch || ':' || state from "
        f"public.health_workout_authorities where user_id='{OWNER_A}'::uuid;") == "2:RESET_FENCED"
    old_id, old_key = _identity()
    future_entity = str(uuid.uuid4())
    fenced = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, binding,
        future_entity, old_id, old_key, "upsert", None, 1, _record(future_entity)))
    assert fenced["errorCode"] == "AUTHORITY_RESET_FENCED"

    finished = _call(docker, name, _reset_sql(OWNER_A, identity, continue_job=True))
    assert finished["status"] == "completed" and finished["appliedCount"] == 1
    assert finished["inventoryDigest"] == started["inventoryDigest"]
    assert finished["completionDigest"]
    assert _call(docker, name, _reset_sql(OWNER_A, identity, continue_job=True)) == finished
    assert _call(docker, name, _reset_sql(OWNER_A, identity)) == finished
    assert _psql(docker, name, "select authority_epoch || ':' || state from "
        f"public.health_workout_authorities where user_id='{OWNER_A}'::uuid;") == "2:OPEN"
    assert _psql(docker, name, f"select revision || ':' || is_deleted::text || ':' || authority_epoch "
        f"from public.health_workout_sessions_v2 where user_id='{OWNER_A}'::uuid and id='{active}'::uuid;") == "2:true:2"
    assert _psql(docker, name, f"select revision from public.health_workout_sessions_v2 "
        f"where user_id='{OWNER_A}'::uuid and id='{deleted}'::uuid;") == "2"
    assert _psql(docker, name, f"select count(*) from public.remote_reference_changes_v2 "
        f"where authenticated_owner_id='{OWNER_A}'::uuid and entity_id='{active}'::uuid;") == "2"
    assert _psql(docker, name, f"select count(*) from public.remote_mutation_receipts "
        f"where authenticated_owner_id='{OWNER_A}'::uuid and mutation_id='{created['mutationId']}';") == "1"
    old_replay = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, binding,
        active, old_id, old_key, "restore", 2, 3, record))
    assert old_replay["errorCode"] == "STALE_AUTHORITY_EPOCH"
    lost_response_replay = _call(docker, name, _mutation_sql(OWNER_A, DESKTOP, binding,
        active, created["mutationId"], created["idempotencyKey"],
        "upsert", None, 1, record))
    assert lost_response_replay["errorCode"] == "STALE_AUTHORITY_EPOCH"
    assert _psql(docker, name, f"select count(*) from public.remote_mutation_receipts "
        f"where authenticated_owner_id='{OWNER_A}'::uuid and entity_id='{active}'::uuid;") == "2"
    assert _register(docker, name, OWNER_A, DESKTOP)["errorCode"] == "STALE_GENERATION_BINDING"
    old_page = _call(docker, name, "select public.page_health_workout_snapshot_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{DESKTOP[0]}','{DESKTOP[1]}',"
        f"'{DESKTOP[2]}','{binding}'::uuid,1,'{snapshot['snapshotToken']}'::uuid,null,16)")
    assert old_page["errorCode"] == "STALE_AUTHORITY_EPOCH"

    new_binding = _register_target(docker, name, OWNER_A)
    changes = _call(docker, name, "select public.pull_health_workout_changes_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{MOBILE[0]}','{MOBILE[1]}',"
        f"'{MOBILE[2]}','{new_binding}'::uuid,2,0,null,100)")
    assert changes["status"] == "changes"
    assert any(row["entityId"] == active and row["isDeleted"]
        and row["authorityEpoch"] == 2 for row in changes["changes"])
    fresh_snapshot = _call(docker, name, "select public.begin_health_workout_snapshot_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{MOBILE[0]}','{MOBILE[1]}',"
        f"'{MOBILE[2]}','{new_binding}'::uuid,2)")
    fresh_page = _call(docker, name, "select public.page_health_workout_snapshot_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}','{MOBILE[0]}','{MOBILE[1]}',"
        f"'{MOBILE[2]}','{new_binding}'::uuid,2,"
        f"'{fresh_snapshot['snapshotToken']}'::uuid,null,16)")
    assert fresh_page["status"] == "snapshot_page"
    assert any(row["entityId"] == active and row["isDeleted"] for row in fresh_page["rows"])
    restore_id, restore_key = _identity()
    restored = _call(docker, name, _mutation_sql(OWNER_A, MOBILE, new_binding,
        active, restore_id, restore_key, "restore", 2, 3, record, epoch=2))
    assert restored["outcome"] == "success" and restored["serverRevision"] == 3


def test_unsupported_dormant_row_fails_before_epoch_transition(postgres) -> None:
    docker, name = postgres
    binding = _ready(docker, name, OWNER_B, DESKTOP)
    entity = str(uuid.uuid4())
    _psql(docker, name, f"insert into public.health_workout_sessions_v2 "
        f"(user_id,project_scope,id,revision,record,is_deleted) values "
        f"('{OWNER_B}'::uuid,'{PROJECT}','{entity}'::uuid,1,"
        f"'{{\"id\":\"{entity}\"}}'::jsonb,false);")
    identity = _reset_identity(OWNER_B, binding)
    result = _call(docker, name, _reset_sql(OWNER_B, identity))
    assert result["errorCode"] == "RESET_INVENTORY_UNSUPPORTED"
    assert _psql(docker, name, "select authority_epoch || ':' || state from "
        f"public.health_workout_authorities where user_id='{OWNER_B}'::uuid;") == "1:OPEN"
    assert _psql(docker, name, "select count(*) from public.health_workout_reset_jobs "
        f"where user_id='{OWNER_B}'::uuid;") == "0"


def test_empty_reset_and_later_distinct_reset_advance_one_epoch_each(postgres) -> None:
    docker, name = postgres
    binding = _ready(docker, name, OWNER_A, DESKTOP)
    first = _reset_identity(OWNER_A, binding)
    started = _call(docker, name, _reset_sql(OWNER_A, first))
    assert started["status"] == "applying" and started["inventoryCount"] == 0
    completed = _call(docker, name, _reset_sql(OWNER_A, first, continue_job=True))
    assert completed["status"] == "completed" and completed["targetEpoch"] == 2
    assert _call(docker, name, _reset_sql(OWNER_A, first)) == completed
    binding2 = _register_target(docker, name, OWNER_A)
    second = _reset_identity(OWNER_A, binding2, MOBILE, epoch=2)
    assert _call(docker, name, _reset_sql(OWNER_A, second))["targetEpoch"] == 3
    assert _call(docker, name, _reset_sql(OWNER_A, second, continue_job=True))["status"] == "completed"
    assert _psql(docker, name, f"select authority_epoch from public.health_workout_authorities "
        f"where user_id='{OWNER_A}'::uuid and project_scope='{PROJECT}';") == "3"
    assert _call(docker, name, _reset_sql(OWNER_A, first)) == completed
    assert _psql(docker, name, f"select count(*) from public.health_workout_reset_jobs "
        f"where user_id='{OWNER_A}'::uuid and project_scope='{PROJECT}';") == "2"


def test_reset_tables_and_rpcs_are_service_function_only(postgres) -> None:
    docker, name = postgres
    for table in ("health_workout_reset_jobs", "health_workout_reset_items"):
        assert _psql(docker, name, f"select relrowsecurity::text from pg_catalog.pg_class "
            f"where oid='public.{table}'::regclass;") == "true"
        assert _psql(docker, name, f"select has_table_privilege('service_role',"
            f"'public.{table}','INSERT')::text;") == "false"
        assert _psql(docker, name, f"select has_table_privilege('authenticated',"
            f"'public.{table}','SELECT')::text;") == "false"
    signature = "uuid,text,text,text,text,uuid,bigint,uuid,text"
    assert _psql(docker, name, "select has_function_privilege('service_role',"
        f"'public.begin_health_workout_reset_v1({signature})','EXECUTE')::text;") == "true"
    assert _psql(docker, name, "select has_function_privilege('authenticated',"
        f"'public.begin_health_workout_reset_v1({signature})','EXECUTE')::text;") == "false"


def test_bounded_batch_recovers_from_lost_client_and_preserves_exact_inventory(postgres) -> None:
    docker, name = postgres
    binding = _ready(docker, name, OWNER_A, DESKTOP)
    statements = []
    for _ in range(26):
        entity = str(uuid.uuid4())
        mutation_id, key = _identity()
        statements.append(_mutation_sql(OWNER_A, DESKTOP, binding, entity,
            mutation_id, key, "upsert", None, 1, _record(entity)) + ";")
    _psql(docker, name, "set role service_role;\n" + "\n".join(statements))
    identity = _reset_identity(OWNER_A, binding)
    started = _call(docker, name, _reset_sql(OWNER_A, identity))
    assert started["activeCount"] == 26
    first_batch = _call(docker, name, _reset_sql(OWNER_A, identity, continue_job=True))
    assert first_batch["status"] == "applying" and first_batch["appliedCount"] == 25
    assert _psql(docker, name, f"select count(*) from public.health_workout_reset_items "
        f"where user_id='{OWNER_A}'::uuid and state='PENDING';") == "1"
    # The initiating client is gone. Authenticated owner recovery finishes the
    # fixed manifest rather than starting another epoch/inventory.
    recovered = _call(docker, name, "select public.continue_active_health_workout_reset_v1("
        f"'{OWNER_A}'::uuid,'{PROJECT}')")
    assert recovered["status"] == "completed" and recovered["appliedCount"] == 26
    assert _call(docker, name, _reset_sql(OWNER_A, identity, continue_job=True)) == recovered
    assert _psql(docker, name, f"select count(*) from public.remote_reference_changes_v2 "
        f"where authenticated_owner_id='{OWNER_A}'::uuid and authority_epoch=2 "
        f"and operation='tombstone';") == "26"
    assert _psql(docker, name, f"select count(*) from public.health_workout_sessions_v2 "
        f"where user_id='{OWNER_A}'::uuid and not is_deleted;") == "0"
    assert _call(docker, name, "select public.continue_active_health_workout_reset_v1("
        f"'{OWNER_B}'::uuid,'{PROJECT}')")["errorCode"] == "CAPABILITY_DISABLED"


def test_concurrent_mutation_and_reset_have_one_safe_authority_order(postgres) -> None:
    docker, name = postgres
    binding = _ready(docker, name, OWNER_A, DESKTOP)
    identity = _reset_identity(OWNER_A, binding)
    entity = str(uuid.uuid4())
    mutation_id, key = _identity()
    mutation = _mutation_sql(OWNER_A, DESKTOP, binding, entity,
        mutation_id, key, "upsert", None, 1, _record(entity))
    with ThreadPoolExecutor(max_workers=2) as pool:
        mutation_future = pool.submit(_call, docker, name, mutation)
        reset_future = pool.submit(_call, docker, name, _reset_sql(OWNER_A, identity))
        mutation_result = mutation_future.result(timeout=30)
        started = reset_future.result(timeout=30)
    assert started["status"] == "applying"
    if mutation_result["outcome"] == "success":
        assert started["inventoryCount"] == 1
    else:
        assert mutation_result["errorCode"] == "AUTHORITY_RESET_FENCED"
        assert started["inventoryCount"] == 0
    assert _call(docker, name, _reset_sql(OWNER_A, identity, continue_job=True))["status"] == "completed"
    assert _psql(docker, name, f"select count(*) from public.health_workout_sessions_v2 "
        f"where user_id='{OWNER_A}'::uuid and project_scope='{PROJECT}' and not is_deleted;") == "0"


def test_reset_is_owner_scoped_and_same_id_with_different_intent_conflicts(postgres) -> None:
    docker, name = postgres
    binding_a = _ready(docker, name, OWNER_A, DESKTOP)
    binding_b = _ready(docker, name, OWNER_B, DESKTOP)
    other, _, _ = _create(docker, name, OWNER_B, binding_b)
    other_project_entity = str(uuid.uuid4())
    _psql(docker, name, "insert into public.health_workout_sessions_v2 "
        f"(user_id,project_scope,id,revision,record,is_deleted) values "
        f"('{OWNER_A}'::uuid,'other-project','{other_project_entity}'::uuid,1,"
        f"'{{\"id\":\"{other_project_entity}\"}}'::jsonb,false);")
    identity = _reset_identity(OWNER_A, binding_a)
    assert _call(docker, name, _reset_sql(OWNER_A, identity))["status"] == "applying"
    altered = {**identity, "deviceId": "other-device", "requestDigest": "0" * 64}
    altered["requestDigest"] = workout_reset_request_digest(
        WorkoutResetRequest.model_validate(altered), OWNER_A, PROJECT)
    assert _call(docker, name, _reset_sql(OWNER_A, altered))["errorCode"] == "RESET_ID_CONFLICT"
    assert _call(docker, name, _reset_sql(OWNER_A, identity, continue_job=True))["status"] == "completed"
    assert _psql(docker, name, f"select revision || ':' || is_deleted::text from "
        f"public.health_workout_sessions_v2 where user_id='{OWNER_B}'::uuid and id='{other}'::uuid;") == "1:false"
    assert _psql(docker, name, f"select authority_epoch from public.health_workout_authorities "
        f"where user_id='{OWNER_B}'::uuid and project_scope='{PROJECT}';") == "1"
    assert _psql(docker, name, f"select is_deleted::text from public.health_workout_sessions_v2 "
        f"where user_id='{OWNER_A}'::uuid and project_scope='other-project' "
        f"and id='{other_project_entity}'::uuid;") == "false"
