from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

import main
from test_remote_mutation_v2 import DEFAULT_PRESET, EPOCH_A, OWNER_A, request_payload


class FakeSupabaseV2:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []

    def rpc(self, name: str, parameters: dict):
        self.calls.append((name, parameters))
        if name == "ensure_remote_health_generation_v2":
            data = {
                "protocolVersion": 2, "status": "active",
                "namespaceKey": parameters["p_namespace_fingerprint"],
                "generationId": parameters["p_generation_id"],
                "deviceId": parameters["p_device_id"], "serverEpoch": EPOCH_A,
            }
        elif name in {"pull_remote_reference_changes_v2", "pull_health_routine_changes_v2"}:
            data = {
                "protocolVersion": 2, "status": "changes", "domain": parameters["p_domain"],
                "serverEpoch": EPOCH_A, "retentionFloor": 0, "nextCursor": parameters["p_cursor"],
                "changes": [], "errorCode": None,
            }
        else:
            data = {
                "protocolVersion": 2, "outcome": "applied",
                "mutationId": parameters["p_mutation_id"],
                "idempotencyKey": parameters["p_idempotency_key"],
                "domain": parameters["p_domain"], "entityId": parameters["p_entity_id"],
                "operation": parameters["p_operation"], "payloadHash": parameters["p_payload_digest"],
                "remoteMutationRef": "33333333-3333-4333-8333-333333333333",
                "serverRevision": 1, "changeSequence": 1,
                "serverCommittedAt": "2026-09-18T00:00:01Z", "errorCode": None, "retryable": False,
            }
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=data))


class UncertainSupabaseV2:
    def rpc(self, name: str, parameters: dict):
        assert name == "apply_remote_reference_mutation_v2"
        return SimpleNamespace(execute=lambda: (_ for _ in ()).throw(RuntimeError("response_lost_after_rpc")))


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    fake = FakeSupabaseV2()
    monkeypatch.setattr(main, "K323_SUPABASE_CLIENT", fake)
    monkeypatch.setattr(main, "K323_V2_TRANSPORT_ENABLED", True)
    monkeypatch.setattr(main, "HEALTH_ROUTINE_SYNC_ENABLED", True)
    monkeypatch.setattr(main, "K323_PROJECT_SCOPE", "project-test")
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER_A
    try:
        yield TestClient(main.app), fake
    finally:
        main.app.dependency_overrides.clear()


def test_v2_endpoint_is_default_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "K323_V2_TRANSPORT_ENABLED", False)
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER_A
    try:
        response = TestClient(main.app).post("/api/sync/v2/mutations", json=request_payload())
        assert response.status_code == 423
        assert response.json()["detail"] == "K323_V2_TRANSPORT_DISABLED"
    finally:
        main.app.dependency_overrides.clear()


def test_v2_unauthenticated_mutation_and_pull_fail_closed() -> None:
    mutation = TestClient(main.app).post("/api/sync/v2/mutations", json=request_payload())
    pull = TestClient(main.app).get(
        "/api/sync/v2/changes",
        params={"namespaceKey": "1" * 64, "generationId": "generation-1", "domain": "reference_alpha"},
    )
    assert mutation.status_code in {401, 403} and pull.status_code in {401, 403}


def test_valid_mutation_uses_authenticated_owner_and_one_v2_rpc(client) -> None:
    http, fake = client
    response = http.post("/api/sync/v2/mutations", json=request_payload())
    assert response.status_code == 200 and response.json()["serverRevision"] == 1
    assert len(fake.calls) == 1 and fake.calls[0][0] == "apply_remote_reference_mutation_v2"
    assert fake.calls[0][1]["p_authenticated_owner_id"] == OWNER_A
    assert "accountId" not in request_payload()


def test_health_domain_is_bounded_active_when_generic_transport_is_disabled(client, monkeypatch: pytest.MonkeyPatch) -> None:
    http, fake = client
    monkeypatch.setattr(main, "K323_V2_TRANSPORT_ENABLED", False)
    payload = request_payload(domain="health_routine_preset", entity_id=DEFAULT_PRESET, label="Default")
    response = http.post("/api/sync/v2/mutations", json=payload)
    assert response.status_code == 200
    assert fake.calls[0][0] == "apply_health_routine_mutation_v2"
    assert fake.calls[0][1]["p_authenticated_owner_id"] == OWNER_A


def test_fixed_default_tombstone_is_rejected_before_rpc(client) -> None:
    http, fake = client
    payload = request_payload(
        domain="health_routine_preset", entity_id=DEFAULT_PRESET,
        operation="tombstone", base_revision=1, local_revision=2,
    )
    response = http.post("/api/sync/v2/mutations", json=payload)
    assert response.status_code == 400
    assert response.json()["errorCode"] == "DEFAULT_PRESET_REQUIRED"
    assert fake.calls == []


def test_health_generation_registration_binds_body_account_to_jwt_owner(client) -> None:
    http, fake = client
    body = {
        "protocolVersion": 2, "accountId": OWNER_A, "namespaceKey": "1" * 64,
        "generationId": "health-routine-v1", "deviceId": "device-a",
        "domains": ["health_routine_preset", "health_routine_profile"],
    }
    response = http.post("/api/sync/v2/generations", json=body)
    assert response.status_code == 200 and response.json()["status"] == "active"
    assert fake.calls[0][0] == "ensure_remote_health_generation_v2"
    assert fake.calls[0][1]["p_authenticated_owner_id"] == OWNER_A

    foreign = http.post("/api/sync/v2/generations", json={
        **body, "accountId": "22222222-2222-4222-8222-222222222222",
    })
    assert foreign.status_code == 403
    assert len(fake.calls) == 1


def test_uncertain_rpc_result_is_a_bound_retryable_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "K323_SUPABASE_CLIENT", UncertainSupabaseV2())
    monkeypatch.setattr(main, "K323_V2_TRANSPORT_ENABLED", True)
    monkeypatch.setattr(main, "K323_PROJECT_SCOPE", "project-test")
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER_A
    payload = request_payload()
    try:
        response = TestClient(main.app).post("/api/sync/v2/mutations", json=payload)
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {
        "protocolVersion": 2,
        "outcome": "rejected",
        "mutationId": payload["mutationId"],
        "idempotencyKey": payload["idempotencyKey"],
        "domain": payload["domain"],
        "entityId": payload["entityId"],
        "operation": payload["operation"],
        "payloadHash": payload["payloadHash"],
        "remoteMutationRef": None,
        "serverRevision": None,
        "changeSequence": None,
        "serverCommittedAt": None,
        "errorCode": "TRANSIENT_SERVER_FAILURE",
        "retryable": True,
    }


@pytest.mark.parametrize(("change", "code"), [
    ({"protocolVersion": 1}, "INVALID_PROTOCOL_VERSION"),
    ({"domain": "notes"}, "UNKNOWN_DOMAIN"),
    ({"operation": "purge"}, "INVALID_OPERATION"),
    ({"accountId": "22222222-2222-4222-8222-222222222222"}, "INVALID_MUTATION"),
])
def test_invalid_v2_requests_never_reach_rpc(client, change: dict, code: str) -> None:
    http, fake = client
    payload = request_payload(); payload.update(change)
    response = http.post("/api/sync/v2/mutations", json=payload)
    assert response.status_code == 400 and response.json()["errorCode"] == code
    assert fake.calls == []


def test_payload_hash_mismatch_never_reaches_rpc(client) -> None:
    http, fake = client
    payload = request_payload(); payload["payload"]["record"]["label"] = "changed"
    response = http.post("/api/sync/v2/mutations", json=payload)
    assert response.status_code == 400 and response.json()["errorCode"] == "PAYLOAD_HASH_MISMATCH"
    assert fake.calls == []


def test_pull_uses_owner_scoped_v2_rpc(client) -> None:
    http, fake = client
    response = http.get("/api/sync/v2/changes", params={
        "namespaceKey": "1" * 64, "generationId": "generation-1", "domain": "reference_beta",
        "cursor": 0, "limit": 10,
    })
    assert response.status_code == 200 and response.json()["serverEpoch"] == EPOCH_A
    assert len(fake.calls) == 1
    assert fake.calls[0][0] == "pull_remote_reference_changes_v2"
    assert fake.calls[0][1]["p_authenticated_owner_id"] == OWNER_A


def test_oversized_v2_request_is_rejected_before_rpc(client) -> None:
    http, fake = client
    response = http.post(
        "/api/sync/v2/mutations", content=b"{}",
        headers={"content-type": "application/json", "content-length": "262145"},
    )
    assert response.status_code == 413 and fake.calls == []
