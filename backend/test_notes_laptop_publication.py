"""Application/JWT/HMAC/SQL vertical proof; all data and principals synthetic."""
import copy
import json
from pathlib import Path
import uuid

import pytest
import main
from fastapi.testclient import TestClient
from identity_candidates.notes_private_gateway import GatewayDenied, GatewayIndeterminate, PrivateGateway
from notes_laptop_publication import LaptopPublicationError, NotesLaptopPublicationService
from test_notes_identity_private_gateway import Calls, token, verifier
from test_notes_identity_private_gateway_postgres import (
    private_db, private_ready, model_db, ready, candidate, proof_db, client, LOGIN,
)
from test_notes_laptop_initial_adoption import approval
from test_notes_identity_postgres import OWNER_A, OWNER_B, PAYLOAD, quote
from test_notes_identity_private_gateway_postgres import signed_apply

SCHEMA = "notes_identity_candidate"
ROOT = Path(__file__).parent
NOTE = "existing-laptop-id"
OP = "operator-approved-operation"


class LaptopCalls(Calls):
    def call(self, name, text, mac):
        if name == "prepare":
            return super().call(name, text, mac)
        self.seen.append((name, text, mac))
        doc = json.loads(text)["context"]
        intent = doc["intent"]
        result = dict(account_id=intent["owner"], generation=doc["generation"],
                      note_id=intent["note_id"], operation_id=intent["approval_operation_id"],
                      payload=intent["payload"], capture_sha256="a"*64,
                      policy="OWNER_APPROVED_HISTORICAL_ADOPTION")
        if intent["action"] == "laptop_publish":
            result = dict(effect="CREATED", requires_post_commit_readback=True, snapshot=result)
        return json.dumps(result)


def service(calls=None):
    return NotesLaptopPublicationService(PrivateGateway(
        verifier(), calls or LaptopCalls(), b"x"*32, enabled=True))


def test_application_service_requires_fresh_authenticated_readback():
    calls = LaptopCalls()
    original = copy.deepcopy(PAYLOAD)
    result = service(calls).publish(token(), OWNER_A, NOTE, OP, PAYLOAD)
    assert result == dict(status="VERIFIED", noteId=NOTE, approvalOperationId=OP)
    intents = [json.loads(text)["action"] for name, text, mac in calls.seen if name == "prepare"]
    assert intents == ["laptop_publish", "laptop_read"]
    contexts = [json.loads(text)["context"]["context_id"] for name, text, mac in calls.seen if name == "apply"]
    assert len(set(contexts)) == 2 and PAYLOAD == original
    assert all("approve" not in action for action in intents)


@pytest.mark.parametrize("failure", [GatewayIndeterminate("lost response"), RuntimeError("connection exit")])
def test_ambiguous_dispatch_is_not_retried_or_reported_verified(failure):
    class CallsFail(LaptopCalls):
        def call(self, name, text, mac):
            if name == "apply":
                self.seen.append((name, text, mac))
                raise failure
            return super().call(name, text, mac)
    calls = CallsFail()
    with pytest.raises(LaptopPublicationError, match="INDETERMINATE"):
        service(calls).publish(token(), OWNER_A, NOTE, OP, PAYLOAD)
    assert sum(name == "apply" for name, _, _ in calls.seen) == 1


def test_manual_readback_never_sends_a_publish():
    calls = LaptopCalls()
    assert service(calls).readback(token(), OWNER_A, NOTE, OP, PAYLOAD)["status"] == "VERIFIED"
    assert [json.loads(text)["action"] for name, text, _ in calls.seen if name == "prepare"] == ["laptop_read"]


@pytest.mark.parametrize("change", [
    {"account_id": OWNER_B}, {"note_id": "foreign"}, {"operation_id": "wrong"},
    {"generation": 2}, {"payload": PAYLOAD | {"starred": 0}},
])
def test_gateway_rejects_mismatched_readback(change):
    class Changed(LaptopCalls):
        def call(self, name, text, mac):
            result = super().call(name, text, mac)
            if name == "apply":
                value = json.loads(result)
                value = value | change
                return json.dumps(value)
            return result
    with pytest.raises(LaptopPublicationError, match="INDETERMINATE"):
        service(Changed()).readback(token(), OWNER_A, NOTE, OP, PAYLOAD)


def test_bad_token_and_owner_mismatch_cannot_report_success():
    calls = LaptopCalls()
    with pytest.raises(LaptopPublicationError):
        service(calls).publish("invalid", OWNER_A, NOTE, OP, PAYLOAD)
    assert not calls.seen
    with pytest.raises(LaptopPublicationError, match="INDETERMINATE"):
        service().publish(token(), OWNER_B, NOTE, OP, PAYLOAD)


@pytest.mark.parametrize("payload", [
    PAYLOAD | {"folder_id": "folder"}, PAYLOAD | {"relations": []},
    PAYLOAD | {"body": "![original](attachment:missing)"}, PAYLOAD | {"body": "[[id:other|link]]"},
])
def test_dependencies_remain_ineligible_without_silent_stripping(payload):
    calls = LaptopCalls()
    with pytest.raises(LaptopPublicationError, match="INVALID"):
        service(calls).publish(token(), OWNER_A, NOTE, OP, payload)
    assert not calls.seen


@pytest.fixture
def http(monkeypatch):
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: OWNER_A
    monkeypatch.setattr(main, "NOTES_LAPTOP_PUBLISH_ENABLED", True)
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.clear()


@pytest.mark.parametrize("suffix", ["", "/status"])
def test_routes_default_off_without_constructing_gateway(http, monkeypatch, suffix):
    monkeypatch.setattr(main, "NOTES_LAPTOP_PUBLISH_ENABLED", False)
    monkeypatch.setattr(main, "_notes_laptop_publication_service", lambda: pytest.fail("constructed while off"))
    response = http.post("/api/notes/laptop-publication"+suffix,
                         headers={"Authorization": "Bearer "+token()}, json={})
    assert response.status_code == 423


@pytest.mark.parametrize("extra", [{"owner": OWNER_B}, {"generation": 3},
                                   {"localAttestation": {"durable_local": True}}, {"knownDeletedIds": []}])
def test_browser_attestations_never_become_operator_approval(http, monkeypatch, extra):
    monkeypatch.setattr(main, "_notes_laptop_publication_service", lambda: pytest.fail("extra fields reached service"))
    response = http.post("/api/notes/laptop-publication", headers={"Authorization": "Bearer "+token()},
                         json=dict(noteId=NOTE, approvalOperationId=OP, snapshot=PAYLOAD) | extra)
    assert response.status_code == 400


@pytest.mark.parametrize("suffix", ["", "/status"])
def test_authenticated_http_roundtrip_uses_the_real_service_and_hmac(http, monkeypatch, suffix):
    calls = LaptopCalls()
    monkeypatch.setattr(main, "_notes_laptop_publication_service", lambda: service(calls))
    response = http.post("/api/notes/laptop-publication"+suffix,
                         headers={"Authorization": "Bearer "+token()},
                         json=dict(noteId=NOTE, approvalOperationId=OP, snapshot=PAYLOAD))
    assert response.status_code == 200 and response.json()["noteId"] == NOTE


@pytest.fixture(scope="module")
def laptop_model(private_db):
    private_db.sql((ROOT/"identity_candidates/notes_laptop_initial_adoption.sql").read_text(encoding="utf-8"))
    return private_db


@pytest.fixture
def laptop_ready(private_ready, laptop_model):
    assert private_ready is laptop_model
    return laptop_model


def approved(db):
    note_id, op, deleted = "laptop:"+uuid.uuid4().hex, "approval:"+uuid.uuid4().hex, "deleted:"+uuid.uuid4().hex
    # Trusted operator-only fixture, outside the HTTP application.
    db.sql("set role notes_candidate_owner;" + approval(note_id, op=op, known=(deleted,)))
    return note_id, op, deleted


def test_isolated_http_to_sql_original_id_publication_and_readback(laptop_ready, http, monkeypatch):
    db = laptop_ready
    note_id, op, deleted = approved(db)
    monkeypatch.setattr(main, "_notes_laptop_publication_service",
                        lambda: NotesLaptopPublicationService(client(db)))
    before_local = dict(id=note_id, **copy.deepcopy(PAYLOAD))
    response = http.post("/api/notes/laptop-publication", headers={"Authorization": "Bearer "+token()},
                         json=dict(noteId=note_id, approvalOperationId=op, snapshot=PAYLOAD))
    assert response.status_code == 200 and response.json()["status"] == "VERIFIED"
    assert db.snapshot(note_id)["payload"] == PAYLOAD
    assert db.snapshot(note_id)["state"] == "LIVE"
    assert db.snapshot(deleted)["state"] == "RETIRED"
    assert before_local == dict(id=note_id, **PAYLOAD)
    assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


def test_sql_gateway_never_approves_or_gains_raw_privileges(laptop_ready):
    db = laptop_ready
    db.sql(approval("unknown"), LOGIN, "42501")
    for signature in ("publish_laptop_note(uuid,bigint,text,text,jsonb)",
                      "read_laptop_publication(uuid,bigint,text,text,jsonb)"):
        assert db.sql(f"select has_function_privilege('{LOGIN}','{SCHEMA}.{signature}','EXECUTE');") == "f"
    with pytest.raises(pytest.fail.Exception, match="LAPTOP_APPROVAL_REQUIRED"):
        NotesLaptopPublicationService(client(db)).gateway.run_laptop(
            token(), "publish", uuid.uuid4().hex, note_id="unknown",
            approval_operation_id="fake", payload=PAYLOAD)


def test_sql_foreign_stale_changed_content_and_retired_denied(laptop_ready):
    db = laptop_ready
    note_id, op, deleted = approved(db)
    gateway = client(db)
    for access, payload in ((token(OWNER_B), PAYLOAD), (token(), PAYLOAD | {"body": "changed"})):
        with pytest.raises(pytest.fail.Exception, match="LAPTOP_APPROVAL_REQUIRED"):
            gateway.run_laptop(access, "publish", uuid.uuid4().hex, note_id=note_id,
                               approval_operation_id=op, payload=payload)
    context = gateway.prepare(token(), "laptop_publish", uuid.uuid4().hex, note_id=note_id,
                              approval_operation_id=op, payload=PAYLOAD)
    db.sql(f"update {SCHEMA}.account_fences set generation=3 where owner_id='{OWNER_A}';")
    with pytest.raises(pytest.fail.Exception, match="ACCOUNT_AUTHORITY_UNAVAILABLE"):
        gateway.apply(token(), context)
    assert db.snapshot(note_id)["state"] == "RESERVED"


def test_sql_replay_and_retirement_do_not_resurrect(laptop_ready):
    db = laptop_ready
    note_id, op, _ = approved(db)
    svc = NotesLaptopPublicationService(client(db))
    svc.publish(token(), OWNER_A, note_id, op, PAYLOAD)
    before = db.snapshot(note_id)
    svc.publish(token(), OWNER_A, note_id, op, PAYLOAD)
    assert db.snapshot(note_id) == before
    svc.gateway.run(token(), "retire", uuid.uuid4().hex, note_id=note_id)
    with pytest.raises(LaptopPublicationError):
        svc.publish(token(), OWNER_A, note_id, op, PAYLOAD)
    assert db.snapshot(note_id)["state"] == "RETIRED" and db.snapshot(note_id)["notes"] == 0


def test_sql_lost_commit_response_resolves_only_by_explicit_readback(laptop_ready):
    db = laptop_ready
    note_id, op, _ = approved(db)

    class Lost:
        def __init__(self):
            self.applies = 0

        def call(self, name, text, mac):
            value = db.call(name, text, mac)  # real SQL commits first
            if name == "apply":
                self.applies += 1
                if self.applies == 1:
                    raise GatewayIndeterminate("synthetic lost completion")
            return value

    calls = Lost()
    svc = NotesLaptopPublicationService(PrivateGateway(verifier(), calls, db.signing_key, enabled=True))
    with pytest.raises(LaptopPublicationError, match="INDETERMINATE"):
        svc.publish(token(), OWNER_A, note_id, op, PAYLOAD)
    assert calls.applies == 1 and db.snapshot(note_id)["state"] == "LIVE"
    committed = db.snapshot(note_id)
    assert svc.readback(token(), OWNER_A, note_id, op, PAYLOAD)["status"] == "VERIFIED"
    assert db.snapshot(note_id) == committed
    assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


@pytest.mark.parametrize("second_action", ["laptop_publish", "retire"])
def test_sql_gateway_concurrency_preserves_approval_and_terminal_history(laptop_ready, second_action):
    db = laptop_ready
    note_id, op, _ = approved(db)
    g = client(db)
    first_context = g.prepare(token(), "laptop_publish", uuid.uuid4().hex,
                              note_id=note_id, approval_operation_id=op, payload=PAYLOAD)
    kwargs = dict(note_id=note_id)
    if second_action == "laptop_publish":
        kwargs.update(approval_operation_id=op, payload=PAYLOAD)
    second_context = g.prepare(token(), second_action, uuid.uuid4().hex, **kwargs)
    first, second = db.connection(LOGIN), db.connection(LOGIN)
    name = "laptop_concurrency_"+uuid.uuid4().hex
    try:
        first.send("begin;select 'PID:'||pg_backend_pid();"+signed_apply(g, first_context)+"\\echo HELD")
        pid = int(next(x[4:] for x in first.until("HELD") if x.startswith("PID:")))
        second.send(f"set application_name={quote(name)};"+signed_apply(g, second_context)+"\\q")
        db.wait_for_blocker(second, name, pid)
        first.send("commit;\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish()
        assert db.snapshot(note_id)["state"] == ("LIVE" if second_action == "laptop_publish" else "RETIRED")
        assert db.snapshot(note_id)["notes"] == (1 if second_action == "laptop_publish" else 0)
        assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"
    finally:
        second.close()
        first.close()
