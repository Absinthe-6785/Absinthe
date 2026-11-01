"""Offline candidate checks: no deployed-role or PostgreSQL execution claim."""
import ast
from dataclasses import fields, replace
from pathlib import Path

import pytest

from notes_identity_guard_candidate import (
    AccountContext, OPERATIONS, Prerequisites, assess_candidate, supported_snapshot,
)

ROOT = Path(__file__).parent
SQL = ROOT / "identity_candidates" / "notes_identity_guard.sql"
A = AccountContext("11111111-1111-4111-8111-111111111111", 1)
B = AccountContext("22222222-2222-4222-8222-222222222222", 2)
READY = Prerequisites(**{f.name: True for f in fields(Prerequisites)})
PAYLOAD = {"title": "제목 / 題名", "body": "Original", "updated_at": 1, "starred": False}


def assess(**changes):
    args = dict(operation="publish", captured=A, current=A, prerequisites=READY,
                note_id="explicit-id", operation_id="exact-operation", payload=PAYLOAD,
                provenance="trusted_reservation", persistence_complete=True)
    return assess_candidate(**(args | changes))


@pytest.mark.parametrize("operation", sorted(OPERATIONS))
def test_no_operation_can_be_activated_even_with_all_prerequisites(operation, monkeypatch):
    monkeypatch.setenv("K323_REMOTE_MUTATION_ENABLED", "enabled")
    monkeypatch.setenv("NOTES_IDENTITY_GUARD_ENABLED", "true")
    verdict = assess(operation=operation, **({"note_id": None, "payload": None, "provenance": None} if operation == "reserve" else {}))
    assert verdict.allowed is False
    assert verdict.code == "CANDIDATE_NOT_ACTIVATED"


@pytest.mark.parametrize("name", [f.name for f in fields(Prerequisites)])
def test_every_missing_production_prerequisite_fails_closed(name):
    verdict = assess(prerequisites=replace(READY, **{name: False}))
    assert verdict.code == "PREREQUISITES_UNVERIFIED"
    assert verdict.missing == (name,)
    assert not verdict.allowed


def test_default_prerequisites_are_unknown_not_authorized():
    verdict = assess(prerequisites=Prerequisites())
    assert verdict.missing == tuple(f.name for f in fields(Prerequisites))
    assert not verdict.allowed
    assert assess(prerequisites=None).code == "PREREQUISITES_UNAVAILABLE"
    assert assess(prerequisites=replace(READY, deployed_roles="true")).missing == ("deployed_roles",)


@pytest.mark.parametrize("captured,current,code", [
    (None, A, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    (A, None, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    (AccountContext("", 1), A, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    (AccountContext(A.owner_id, True), A, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    (A, B, "STALE_ACCOUNT_AUTHORITY"),
    (A, AccountContext(A.owner_id, 3), "STALE_ACCOUNT_AUTHORITY"),
])
def test_missing_foreign_and_aba_contexts_never_yield_a_permit(captured, current, code):
    result = assess(captured=captured, current=current)
    assert result.code == code and not result.allowed


@pytest.mark.parametrize("provenance", [None, "remote_absence", "new_uuid", "fresh_prefix", "legacy_local"])
def test_absence_or_local_freshness_does_not_authorize_admission(provenance):
    assert assess(provenance=provenance).code == "IDENTITY_PROVENANCE_UNPROVEN"


@pytest.mark.parametrize("extra", [
    {"properties": {}}, {"relations": {}}, {"folder_id": None},
    {"attachmentOriginals": ["local-only"]}, {"history": ["old"]},
])
def test_extra_content_is_rejected_not_stripped(extra):
    original = PAYLOAD | extra
    before = dict(original)
    assert assess(payload=original).code == "UNSUPPORTED_CONTENT"
    assert original == before


@pytest.mark.parametrize("change", [{"updated_at": True}, {"updated_at": -1},
    {"updated_at": 9007199254740992}, {"starred": 1}, {"body": None}])
def test_invalid_supported_shape_is_denied(change):
    assert not supported_snapshot(PAYLOAD | change)
    assert assess(payload=PAYLOAD | change).code == "UNSUPPORTED_CONTENT"


def test_incomplete_persistence_and_missing_operation_identity_are_denied():
    assert assess(persistence_complete=False).code == "LOCAL_PERSISTENCE_INCOMPLETE"
    assert assess(note_id="").code == "INVALID_OPERATION_IDENTITY"
    assert assess(operation_id=" ").code == "INVALID_OPERATION_IDENTITY"
    assert assess(operation="unregistered").code == "UNSUPPORTED_OPERATION"


def test_reservation_diagnostic_never_authorizes_caller_supplied_identity_or_provenance():
    assert assess(operation="reserve").code == "CLIENT_RESERVATION_INPUT_FORBIDDEN"
    result = assess(operation="reserve", note_id=None, payload=None, provenance=None)
    assert result.code == "CANDIDATE_NOT_ACTIVATED" and not result.allowed


def test_sql_reservation_has_no_caller_owner_or_note_identity_and_is_not_a_runtime_rpc():
    source = SQL.read_text(encoding="utf-8")
    reserve = source.split("create function notes_identity_candidate.reserve(p_operation text)")[1].split("create function notes_identity_candidate.publish(")[0]
    assert "login=session_user" in reserve
    assert "gen_random_uuid()" in reserve and "pg_advisory_xact_lock" in reserve
    assert "record_receipt(principal.owner_id,issued,p_operation,'reserve'" in reserve
    assert "principal_bindings" in source and "from public" in source


def test_sql_is_unapplied_and_candidate_is_disconnected_from_live_modules():
    assert SQL.parent.name == "identity_candidates"
    source = SQL.read_text(encoding="utf-8")
    assert "UNAPPLIED LOCAL CANDIDATE" in source
    assert "enabled boolean not null default false" in source
    assert "create role " not in source.lower()
    assert "to service_role" not in source.lower()
    assert "to authenticated" not in source.lower()
    assert "case session_user" not in source.lower()
    assert "on conflict" not in source.lower()
    for path in ROOT.glob("*.py"):
        if path.name.startswith("test_") or path.name == "notes_identity_guard_candidate.py":
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                assert node.module != "notes_identity_guard_candidate", path
            elif isinstance(node, ast.Import):
                assert all(x.name != "notes_identity_guard_candidate" for x in node.names), path
