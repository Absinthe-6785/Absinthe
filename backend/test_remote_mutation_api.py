from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

import main
from test_remote_mutation import OWNER_A, request_payload


class FakeSupabase:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []

    def rpc(self, name: str, parameters: dict):
        self.calls.append((name, parameters))
        return SimpleNamespace(execute=lambda: SimpleNamespace(data={
            "protocolVersion": 1, "outcome": "applied",
            "mutationId": parameters["p_mutation_id"],
            "idempotencyKey": parameters["p_idempotency_key"],
            "remoteMutationRef": "33333333-3333-4333-8333-333333333333",
            "appliedRevision": parameters["p_local_revision"],
            "serverCommittedAt": "2026-07-12T00:00:01Z",
            "errorCode": None, "retryable": False,
        }))


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    fake = FakeSupabase()
    monkeypatch.setattr(main, "K323_SUPABASE_CLIENT", fake)
    monkeypatch.setattr(main, "K323_REMOTE_MUTATION_ENABLED", True)
    monkeypatch.setattr(main, "K323_PROJECT_SCOPE", "project-test")
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER_A
    try:
        yield TestClient(main.app), fake
    finally:
        main.app.dependency_overrides.clear()


def test_endpoint_is_default_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "K323_REMOTE_MUTATION_ENABLED", False)
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER_A
    try:
        response = TestClient(main.app).post("/api/sync/v1/mutations", json=request_payload())
        assert response.status_code == 423
        assert response.json()["detail"] == "K323_REMOTE_MUTATION_DISABLED"
    finally:
        main.app.dependency_overrides.clear()


def test_unauthenticated_endpoint_is_rejected() -> None:
    response = TestClient(main.app).post("/api/sync/v1/mutations", json=request_payload())
    assert response.status_code in {401, 403}


def test_valid_request_invokes_one_versioned_rpc(client) -> None:
    http, fake = client
    response = http.post("/api/sync/v1/mutations", json=request_payload())
    assert response.status_code == 200
    assert response.json()["outcome"] == "applied"
    assert len(fake.calls) == 1 and fake.calls[0][0] == "apply_remote_note_mutation_v1"
    assert "user_id" not in request_payload()


@pytest.mark.parametrize(("change", "code"), [
    ({"protocolVersion": 2}, "INVALID_PROTOCOL_VERSION"),
    ({"domain": "recipes"}, "UNSUPPORTED_DOMAIN"),
    ({"unexpected": True}, "INVALID_MUTATION"),
])
def test_invalid_requests_are_bounded_and_never_reach_rpc(client, change: dict, code: str) -> None:
    http, fake = client
    payload = request_payload(); payload.update(change)
    response = http.post("/api/sync/v1/mutations", json=payload)
    assert response.status_code == 400
    assert response.json()["errorCode"] == code
    assert response.json()["mutationId"] == "mut.invalid"
    assert fake.calls == []


def test_idempotency_mismatch_never_reaches_rpc(client) -> None:
    http, fake = client
    payload = request_payload(); payload["idempotencyKey"] = "k322." + "f" * 64
    response = http.post("/api/sync/v1/mutations", json=payload)
    assert response.status_code == 400
    assert response.json()["errorCode"] == "IDEMPOTENCY_KEY_MISMATCH"
    assert fake.calls == []


def test_oversized_request_is_rejected_before_rpc(client) -> None:
    http, fake = client
    response = http.post(
        "/api/sync/v1/mutations", content=b"{}", headers={"content-type": "application/json", "content-length": "262145"},
    )
    assert response.status_code == 413
    assert fake.calls == []
