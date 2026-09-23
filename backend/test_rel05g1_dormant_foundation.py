from __future__ import annotations

from pathlib import Path
import re

from fastapi.testclient import TestClient
import pytest

import main
from remote_mutation_v2 import V2_DOMAINS
from test_remote_mutation_v2 import OWNER_A, request_payload


MIGRATION = Path(__file__).parent / "migrations" / "202609230001_rel05g1_workout_dormant_foundation.sql"


class RpcRecorder:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []

    def rpc(self, name: str, parameters: dict):
        self.calls.append((name, parameters))
        raise AssertionError("REL-05G1 must reject before any RPC")


@pytest.fixture
def dormant_client(monkeypatch: pytest.MonkeyPatch):
    rpc = RpcRecorder()
    monkeypatch.setattr(main, "K323_SUPABASE_CLIENT", rpc)
    monkeypatch.setattr(main, "K323_V2_TRANSPORT_ENABLED", True)
    monkeypatch.setattr(main, "HEALTH_ROUTINE_SYNC_ENABLED", True)
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER_A
    try:
        yield TestClient(main.app), rpc
    finally:
        main.app.dependency_overrides.pop(main.get_remote_mutation_user, None)


@pytest.mark.parametrize("enabled", [False, True])
def test_workout_mutation_is_rejected_before_any_rpc(dormant_client, monkeypatch, enabled: bool) -> None:
    client, rpc = dormant_client
    monkeypatch.setattr(main, "K323_V2_TRANSPORT_ENABLED", enabled)

    response = client.post(
        "/api/sync/v2/mutations",
        json=request_payload(domain="health_workout_session"),
    )

    assert response.status_code == 423
    assert response.json() == {"detail": "WORKOUT_DOMAIN_DISABLED"}
    assert rpc.calls == []


@pytest.mark.parametrize("enabled", [False, True])
def test_workout_pull_is_rejected_before_any_rpc(dormant_client, monkeypatch, enabled: bool) -> None:
    client, rpc = dormant_client
    monkeypatch.setattr(main, "K323_V2_TRANSPORT_ENABLED", enabled)

    response = client.get("/api/sync/v2/changes", params={
        "namespaceKey": "1" * 64,
        "generationId": "generation-1",
        "domain": "health_workout_session",
    })

    assert response.status_code == 423
    assert response.json() == {"detail": "WORKOUT_DOMAIN_DISABLED"}
    assert rpc.calls == []


def test_unknown_domain_still_uses_existing_fail_closed_behavior(dormant_client) -> None:
    client, rpc = dormant_client

    response = client.post("/api/sync/v2/mutations", json=request_payload(domain="notes"))

    assert response.status_code == 400
    assert response.json()["errorCode"] == "UNKNOWN_DOMAIN"
    assert rpc.calls == []


def test_g1_migration_is_additive_private_and_dormant() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert sql.startswith("begin;") and sql.rstrip().endswith("commit;")
    assert "create table if not exists public.health_workout_sessions_v2" in sql
    assert "create table if not exists public.health_workout_capabilities" in sql
    assert "primary key (user_id, project_scope, id)" in sql
    assert "primary key (user_id, project_scope)" in sql
    assert "health_workout_sessions_v2_tombstone_shape" in sql
    assert "health_workout_sessions_v2_id_uuid_v4" in sql
    assert "health_workout_sessions_v2_revision_check" in sql
    assert "health_workout_sessions_v2_record_object" in sql
    assert "health_workout_capabilities_g1_dormant_only" in sql
    assert "return coalesce(v_state, 'disabled')" in sql
    assert "security invoker" in sql and "security definer" not in sql
    assert "set search_path = ''" in sql
    assert "revoke all on public.health_workout_sessions_v2" in sql
    assert "revoke all on public.health_workout_capabilities" in sql
    assert "revoke all on function public.read_health_workout_capability_v1" in sql
    assert "grant select on public.health_workout_capabilities to service_role" in sql
    assert "grant execute on function public.read_health_workout_capability_v1(uuid, text)\n  to service_role" in sql
    assert "enable row level security" in sql
    assert "remote_mutation_receipts" not in sql
    assert "remote_reference_changes_v2" not in sql
    assert "remote_sync_generations" not in sql
    assert "workout_logs" not in sql
    assert "create policy" not in sql
    assert "insert into public.health_workout_capabilities" not in sql
    assert "update public.health_workout_capabilities" not in sql
    assert "foundation_ready'" in sql and "adoption_ready'" in sql and "'active'" in sql
    assert "health_workout_session" not in V2_DOMAINS
    transport = (Path(__file__).parent.parent / "frontend/src/lib/localDatabase/k323V2Transport.ts").read_text(
        encoding="utf-8"
    )
    assert "health_workout_session" not in transport


def test_migration_has_no_date_block_or_exercise_uniqueness_or_foreign_key() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    workout_table = sql.split("create table if not exists public.health_workout_sessions_v2", 1)[1]
    workout_table = workout_table.split("alter table public.health_workout_sessions_v2 enable", 1)[0]

    assert "unique" not in workout_table
    assert "references " not in workout_table
    assert re.search(r"\bdate\b", workout_table) is None
    assert "block_id" not in workout_table
