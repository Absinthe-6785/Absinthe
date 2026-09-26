from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

import main
from test_rel05g4a_workout_contract import VECTORS, wire


class FakeWorkoutRpc:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []

    def rpc(self, name: str, params: dict):
        self.calls.append((name, params))
        if name == "apply_health_workout_mutation_v1":
            data = {"outcome": "success", "serverRevision": 1, "errorCode": None}
        elif name == "register_health_workout_generation_v1":
            data = {"status": "bound", "bindingId": VECTORS["bindingId"], "errorCode": None}
        elif name == "read_health_workout_authority_v1":
            data = {"capability": "FOUNDATION_READY", "authorityEpoch": 1,
                    "bindingState": "bound", "serverEpoch": VECTORS["bindingId"], "errorCode": None}
        elif name == "pull_health_workout_changes_v1":
            data = {"status": "changes", "changes": [], "errorCode": None}
        elif name == "begin_health_workout_snapshot_v1":
            data = {"status": "snapshot", "snapshotToken": VECTORS["bindingId"], "errorCode": None}
        else:
            data = {"status": "snapshot_page", "rows": [], "errorCode": None}
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=data))


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    fake = FakeWorkoutRpc()
    monkeypatch.setattr(main, "K323_SUPABASE_CLIENT", fake)
    monkeypatch.setattr(main, "WORKOUT_REMOTE_FOUNDATION_ENABLED", True)
    monkeypatch.setattr(main, "K323_PROJECT_SCOPE", VECTORS["projectScope"])
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: VECTORS["ownerId"]
    try:
        yield TestClient(main.app), fake
    finally:
        main.app.dependency_overrides.clear()


def test_default_off_even_for_valid_workout_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "WORKOUT_REMOTE_FOUNDATION_ENABLED", False)
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: VECTORS["ownerId"]
    try:
        response = TestClient(main.app).post(
            "/api/sync/v2/workouts/mutations", json=wire(VECTORS["vectors"][0]),
        )
        assert response.status_code == 423
    finally:
        main.app.dependency_overrides.clear()


def test_workout_endpoints_require_authentication() -> None:
    http = TestClient(main.app)
    mutation = http.post("/api/sync/v2/workouts/mutations", json=wire(VECTORS["vectors"][0]))
    pull = http.get("/api/sync/v2/workouts/changes")
    assert mutation.status_code in {401, 403}
    assert pull.status_code in {401, 403}


def test_server_derives_owner_and_project_and_recomputes_digest(client) -> None:
    http, fake = client
    request = wire(VECTORS["vectors"][0])
    response = http.post("/api/sync/v2/workouts/mutations", json=request)
    assert response.status_code == 200 and response.json()["serverRevision"] == 1
    assert len(fake.calls) == 1
    name, params = fake.calls[0]
    assert name == "apply_health_workout_mutation_v1"
    assert params["p_owner"] == VECTORS["ownerId"]
    assert params["p_project"] == VECTORS["projectScope"]
    assert params["p_request_digest"] == request["requestDigest"]
    assert params["p_content_hash"] == VECTORS["vectors"][0]["expectedContentHash"]
    assert "accountId" not in params and "p_domain" not in params

    forged = http.post("/api/sync/v2/workouts/mutations", json={
        **request, "accountId": "22222222-2222-4222-8222-222222222222",
    })
    assert forged.status_code == 400 and len(fake.calls) == 1


def test_forged_request_digest_and_invalid_record_never_reach_rpc(client) -> None:
    http, fake = client
    request = wire(VECTORS["vectors"][0])
    bad_digest = http.post("/api/sync/v2/workouts/mutations", json={
        **request, "requestDigest": "f" * 64,
    })
    assert bad_digest.status_code == 400
    assert bad_digest.json()["errorCode"] == "REQUEST_DIGEST_MISMATCH"
    bad_record = deepcopy(wire(VECTORS["vectors"][0]))
    bad_record["payload"]["record"]["entries"][0]["sets"][0]["weightKg"] = "10.50"
    response = http.post("/api/sync/v2/workouts/mutations", json=bad_record)
    assert response.status_code == 400
    assert fake.calls == []


@pytest.mark.parametrize("field,value", [
    ("mutationId", "mut.AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"),
    ("mutationId", "mut.Aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ("entityId", "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"),
    ("bindingId", "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB"),
])
def test_noncanonical_mutation_identity_is_http_400_before_rpc(client, field: str, value: str) -> None:
    http, fake = client
    request = deepcopy(wire(VECTORS["vectors"][0]))
    request[field] = value
    if field == "entityId":
        request["payload"]["record"]["id"] = value
    response = http.post("/api/sync/v2/workouts/mutations", json=request)
    assert response.status_code == 400 and response.json()["detail"] == "INVALID_PAYLOAD"
    assert fake.calls == []


def test_unicode_date_and_noncanonical_query_uuid_are_rejected_before_rpc(client) -> None:
    http, fake = client
    request = deepcopy(wire(VECTORS["vectors"][0]))
    request["payload"]["record"]["localDate"] = "٢٠٢٦-٠٩-٢٤"
    response = http.post("/api/sync/v2/workouts/mutations", json=request)
    assert response.status_code == 400 and response.json()["detail"] == "INVALID_PAYLOAD"
    response = http.get("/api/sync/v2/workouts/changes", params={
        "namespaceKey": VECTORS["namespaceKey"],
        "generationId": VECTORS["generationId"],
        "deviceId": VECTORS["deviceId"],
        "bindingId": VECTORS["bindingId"].upper(),
        "authorityEpoch": 1,
    })
    assert response.status_code == 400 and response.json()["detail"] == "INVALID_PULL"
    response = http.get(
        "/api/sync/v2/workouts/snapshots/" + VECTORS["bindingId"].upper(),
        params={
            "namespaceKey": VECTORS["namespaceKey"],
            "generationId": VECTORS["generationId"],
            "deviceId": VECTORS["deviceId"],
            "bindingId": VECTORS["bindingId"],
            "authorityEpoch": 1,
        },
    )
    assert response.status_code == 400 and response.json()["detail"] == "INVALID_SNAPSHOT_PAGE"
    assert fake.calls == []


def test_dormant_row_conflict_has_stable_http_mapping() -> None:
    response = main._workout_result({"outcome": "rejected", "errorCode": "AUTHORITY_EVIDENCE_MISSING"})
    assert response.status_code == 409


def test_binding_pull_and_snapshot_pass_only_jwt_scope(client) -> None:
    http, fake = client
    generation = {
        "protocolVersion": 2, "namespaceKey": VECTORS["namespaceKey"],
        "generationId": VECTORS["generationId"], "deviceId": VECTORS["deviceId"],
    }
    assert http.post("/api/sync/v2/workouts/generations", json=generation).status_code == 200
    bound = {**generation, "bindingId": VECTORS["bindingId"], "authorityEpoch": 1}
    assert http.get("/api/sync/v2/workouts/authority", params={
        "namespaceKey": generation["namespaceKey"],
        "generationId": generation["generationId"], "deviceId": generation["deviceId"],
    }).status_code == 200
    assert http.get("/api/sync/v2/workouts/changes", params={
        **{key: value for key, value in bound.items() if key != "protocolVersion"},
        "cursor": 0,
    }).status_code == 200
    assert http.post("/api/sync/v2/workouts/snapshots", json=bound).status_code == 200
    assert http.get("/api/sync/v2/workouts/snapshots/" + VECTORS["bindingId"], params={
        **{key: value for key, value in bound.items() if key != "protocolVersion"},
        "limit": 16,
    }).status_code == 200
    assert all(params["p_owner"] == VECTORS["ownerId"] and
               params["p_project"] == VECTORS["projectScope"] for _, params in fake.calls)
