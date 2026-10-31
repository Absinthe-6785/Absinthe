"""Offline POST seam tests, not live ledger/issuer or guarded UPDATE proof."""
from copy import deepcopy
from dataclasses import fields, replace

import pytest

import main
from notes_identity_guard_candidate import (
    AccountContext, IdentityObservation, Prerequisites, assess_post_candidate,
)
from test_notes_write_authority import NotesSupabase, note_payload, stored_row

A = AccountContext("11111111-1111-4111-8111-111111111111", 1)
B = AccountContext("22222222-2222-4222-8222-222222222222", 2)
READY = Prerequisites(**{f.name: True for f in fields(Prerequisites)})
PAYLOAD = {"title": "제목 / 題名", "body": "Original", "updated_at": 1, "starred": False}
ROW = {"id": "note-1", "user_id": A.owner_id}


def assess(**changes):
    return assess_post_candidate(**(dict(
        authenticated_owner=A.owner_id, captured=A, current=A, note_id="note-1",
        operation_id="publish:note-1", payload=deepcopy(PAYLOAD), owned_row=None,
        identity=IdentityObservation("note-1", A.owner_id, "RESERVED"),
        prerequisites=READY, persistence_complete=True,
    ) | changes))


@pytest.mark.parametrize("row,state,kind,code", [
    (ROW, "LIVE", "existing_update", "CANDIDATE_NOT_ACTIVATED"),
    (None, "RESERVED", "initial_publication", "CANDIDATE_NOT_ACTIVATED"),
    (None, "RETIRED", "retired_identity", "IDENTITY_RETIRED"),
    (ROW, "RETIRED", "retired_identity", "IDENTITY_RETIRED"),
    (None, "LIVE", "state_conflict", "LIVE_NOTE_MISSING"),
    (ROW, "RESERVED", "state_conflict", "RESERVED_NOTE_ALREADY_EXISTS"),
    (None, "invalid", "enforcement_unavailable", "IDENTITY_OBSERVATION_INVALID"),
])
def test_update_and_create_are_distinct_but_neither_is_executable(row, state, kind, code):
    result = assess(owned_row=row, identity=IdentityObservation("note-1", A.owner_id, state))
    assert (result.classification, result.denial.code) == (kind, code)
    assert not result.allowed and not result.denial.allowed


@pytest.mark.parametrize("row", [None, ROW])
def test_remote_absence_or_existing_legacy_row_is_not_initial_publication(row):
    result = assess(owned_row=row, identity=None)
    assert result.classification == "unknown_historical"
    assert result.denial.code == "IDENTITY_PROVENANCE_UNPROVEN"
    assert not result.allowed


@pytest.mark.parametrize("changes,code", [
    ({"captured": None}, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    ({"current": None}, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    ({"authenticated_owner": B.owner_id}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"current": B}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"current": replace(A, generation=3)}, "STALE_ACCOUNT_AUTHORITY"),
    ({"owned_row": {"id": "note-1", "user_id": B.owner_id}}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"identity": IdentityObservation("note-1", B.owner_id, "LIVE")}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"identity": IdentityObservation("other", A.owner_id, "LIVE")}, "IDENTITY_OBSERVATION_INVALID"),
    ({"identity": {"state": "RESERVED"}}, "IDENTITY_OBSERVATION_INVALID"),
    ({"owned_row": {}}, "NOTE_OBSERVATION_INVALID"),
    ({"owned_row": []}, "NOTE_OBSERVATION_INVALID"),
    ({"operation_id": " "}, "INVALID_OPERATION_IDENTITY"),
    ({"note_id": ""}, "INVALID_OPERATION_IDENTITY"),
])
def test_unavailable_mismatched_stale_and_malformed_authority_fails_closed(changes, code):
    result = assess(**changes)
    assert result.denial.code == code and not result.allowed


@pytest.mark.parametrize("field", [f.name for f in fields(Prerequisites)])
def test_each_missing_db_or_legacy_boundary_prevents_admission(field):
    result = assess(prerequisites=replace(READY, **{field: False}))
    assert result.classification == "enforcement_unavailable"
    assert result.denial.code == "DATABASE_ENFORCEMENT_UNAVAILABLE"
    assert result.denial.missing == (field,)
    assert not result.allowed


def test_missing_enforcement_and_persistence_never_dispatch_to_legacy_post():
    assert assess(prerequisites=Prerequisites()).classification == "enforcement_unavailable"
    assert assess(prerequisites=None).denial.code == "DATABASE_ENFORCEMENT_UNAVAILABLE"
    result = assess(persistence_complete=False)
    assert result.denial.code == "LOCAL_PERSISTENCE_INCOMPLETE" and not result.allowed


@pytest.mark.parametrize("extra", [
    {"user_id": B.owner_id}, {"provenance": "trusted_reservation"},
    {"guarded": True}, {"properties": {}}, {"relations": {}}, {"folder_id": None},
    {"deleted_at": None}, {"history": ["original"]}, {"attachmentOriginals": ["local"]},
])
def test_client_owner_provenance_flags_and_extra_metadata_are_not_authority(extra):
    payload = PAYLOAD | extra
    before = deepcopy(payload)
    result = assess(payload=payload)
    assert result.denial.code == "UNSUPPORTED_CONTENT" and not result.allowed
    assert payload == before


def test_repeated_or_changed_operation_is_not_a_receipt_or_write_permission(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("candidate must not use the legacy DB client")
    monkeypatch.setattr(main.supabase, "table", forbidden)
    for payload in (PAYLOAD, PAYLOAD, PAYLOAD | {"body": "Changed"}):
        result = assess(payload=payload)
        assert result.classification == "initial_publication" and not result.allowed
    assert assess(owned_row=ROW, identity=IdentityObservation("note-1", A.owner_id, "LIVE")).allowed is False
    assert ROW == {"id": "note-1", "user_id": A.owner_id}


@pytest.mark.asyncio
@pytest.mark.parametrize("exists", [False, True])
async def test_default_runtime_post_is_unchanged_despite_client_or_env_switches(monkeypatch, exists):
    client = NotesSupabase([stored_row()] if exists else [])
    monkeypatch.setattr(main, "supabase", client)
    monkeypatch.setenv("NOTES_IDENTITY_GUARD_ENABLED", "true")
    monkeypatch.setenv("NOTES_IDENTITY_POST_ENABLED", "true")
    note = main.NoteCreate(**note_payload(), guarded=True, provenance="trusted_reservation", user_id="foreign")
    result = await main.upsert_note(note, "account-a")
    assert result == stored_row()
    assert [op[0] for op in client.operations] == ["select", "update" if exists else "insert"]
    assert client.rows == [stored_row()]
