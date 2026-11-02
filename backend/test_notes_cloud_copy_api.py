from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

import main
from notes_cloud_copy_candidate import CloudCopyError


OWNER = "11111111-1111-4111-8111-111111111111"
TOKEN = "test-user-jwt"
LOCAL_ID = "local-note-1"
SNAPSHOT = {"title": "Title", "body": "Text", "updated_at": 42, "starred": False}


@pytest.fixture
def http(monkeypatch: pytest.MonkeyPatch):
    main.app.dependency_overrides.clear()
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER
    monkeypatch.setattr(main, "NOTES_CLOUD_COPY_ENABLED", True)
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.clear()


def test_endpoint_is_default_off_and_does_not_construct_gateway(monkeypatch: pytest.MonkeyPatch):
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER
    monkeypatch.setattr(main, "NOTES_CLOUD_COPY_ENABLED", False)
    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: pytest.fail("gateway constructed while disabled"))
    try:
        response = TestClient(main.app).post(
            "/api/notes/cloud-copy", headers={"Authorization": f"Bearer {TOKEN}"},
            json={"localNoteId": LOCAL_ID, "snapshot": SNAPSHOT},
        )
    finally:
        main.app.dependency_overrides.clear()
    assert response.status_code == 423
    assert response.json() == {"detail": "NOTES_CLOUD_COPY_DISABLED"}


def test_authenticated_endpoint_passes_only_exact_note_snapshot_to_gateway_service(http, monkeypatch):
    calls = []

    class Service:
        def create_copy(self, token, local_note_id, snapshot):
            calls.append((token, local_note_id, snapshot))
            return {"status": "created", "localNoteId": local_note_id,
                    "cloudNoteId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}

    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: Service())
    response = http.post(
        "/api/notes/cloud-copy", headers={"Authorization": f"Bearer {TOKEN}"},
        json={"localNoteId": LOCAL_ID, "snapshot": SNAPSHOT},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "created", "localNoteId": LOCAL_ID,
                               "cloudNoteId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
    assert calls == [(TOKEN, LOCAL_ID, SNAPSHOT)]


def test_client_cannot_choose_account_or_add_extra_payload_fields(http, monkeypatch):
    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: pytest.fail("invalid body reached service"))
    response = http.post(
        "/api/notes/cloud-copy", headers={"Authorization": f"Bearer {TOKEN}"},
        json={"accountId": OWNER, "localNoteId": LOCAL_ID, "snapshot": SNAPSHOT},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "INVALID_CLOUD_COPY_REQUEST"}


def test_missing_bearer_is_rejected_before_service(http, monkeypatch):
    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: pytest.fail("unauthenticated service call"))
    response = http.post("/api/notes/cloud-copy", json={"localNoteId": LOCAL_ID, "snapshot": SNAPSHOT})
    assert response.status_code in {401, 403}


def test_streaming_body_limit_is_checked_before_gateway(monkeypatch: pytest.MonkeyPatch):
    main.app.dependency_overrides.clear()
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER
    monkeypatch.setattr(main, "NOTES_CLOUD_COPY_ENABLED", True)
    monkeypatch.setattr(main, "MAX_REQUEST_BYTES", 80)
    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: pytest.fail("oversized body reached service"))
    try:
        response = TestClient(main.app).post(
            "/api/notes/cloud-copy", headers={"Authorization": f"Bearer {TOKEN}"},
            json={"localNoteId": LOCAL_ID, "snapshot": {**SNAPSHOT, "body": "x" * 100}},
        )
    finally:
        main.app.dependency_overrides.clear()
    assert response.status_code == 413
    assert response.json() == {"detail": "INVALID_CLOUD_COPY_REQUEST"}


def test_gateway_error_is_sanitized_at_http_boundary(http, monkeypatch):
    class Service:
        def create_copy(self, *args):
            raise CloudCopyError("CLOUD_COPY_RESULT_INDETERMINATE", status_code=503)

    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: Service())
    response = http.post(
        "/api/notes/cloud-copy", headers={"Authorization": f"Bearer {TOKEN}"},
        json={"localNoteId": LOCAL_ID, "snapshot": SNAPSHOT},
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "CLOUD_COPY_RESULT_INDETERMINATE"}


def test_status_endpoint_is_default_off_and_does_not_construct_gateway(monkeypatch: pytest.MonkeyPatch):
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER
    monkeypatch.setattr(main, "NOTES_CLOUD_COPY_ENABLED", False)
    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: pytest.fail("gateway constructed while disabled"))
    try:
        response = TestClient(main.app).post(
            "/api/notes/cloud-copy/status", headers={"Authorization": f"Bearer {TOKEN}"},
            json={"localNoteId": LOCAL_ID},
        )
    finally:
        main.app.dependency_overrides.clear()
    assert response.status_code == 423
    assert response.json() == {"detail": "NOTES_CLOUD_COPY_DISABLED"}


def test_authenticated_status_endpoint_passes_only_local_identity_and_returns_bounded_status(http, monkeypatch):
    calls = []

    class Service:
        def read_copy_status(self, token, local_note_id):
            calls.append((token, local_note_id))
            return {"status": "LIVE"}

    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: Service())
    response = http.post(
        "/api/notes/cloud-copy/status", headers={"Authorization": f"Bearer {TOKEN}"},
        json={"localNoteId": LOCAL_ID},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "LIVE"}
    assert calls == [(TOKEN, LOCAL_ID)]


@pytest.mark.parametrize("extra", [
    {"accountId": OWNER}, {"cloudNoteId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
    {"generation": 9}, {"previousStatus": "LIVE"},
])
def test_status_client_cannot_choose_owner_generation_cloud_id_or_prior_result(http, monkeypatch, extra):
    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: pytest.fail("invalid body reached service"))
    response = http.post(
        "/api/notes/cloud-copy/status", headers={"Authorization": f"Bearer {TOKEN}"},
        json={"localNoteId": LOCAL_ID, **extra},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "INVALID_CLOUD_COPY_STATUS_REQUEST"}


def test_status_endpoint_rejects_missing_bearer_before_service(http, monkeypatch):
    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: pytest.fail("unauthenticated service call"))
    response = http.post("/api/notes/cloud-copy/status", json={"localNoteId": LOCAL_ID})
    assert response.status_code in {401, 403}


def test_status_endpoint_bounds_body_before_gateway(monkeypatch: pytest.MonkeyPatch):
    main.app.dependency_overrides.clear()
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER
    monkeypatch.setattr(main, "NOTES_CLOUD_COPY_ENABLED", True)
    monkeypatch.setattr(main, "MAX_REQUEST_BYTES", 20)
    monkeypatch.setattr(main, "_notes_cloud_copy_service", lambda: pytest.fail("oversized body reached service"))
    try:
        response = TestClient(main.app).post(
            "/api/notes/cloud-copy/status", headers={"Authorization": f"Bearer {TOKEN}"},
            json={"localNoteId": "x" * 512},
        )
    finally:
        main.app.dependency_overrides.clear()
    assert response.status_code == 413
    assert response.json() == {"detail": "INVALID_CLOUD_COPY_STATUS_REQUEST"}
