"""Offline DELETE diagnostics, not atomic retirement or production DB proof."""
from copy import deepcopy
from dataclasses import fields, replace
from hashlib import sha256

import pytest
from fastapi import HTTPException

import main
import notes_identity_guard_candidate as candidate
from notes_identity_guard_candidate import (
    AccountContext, IdentityObservation, Prerequisites, assess_delete_candidate,
)
from test_notes_delete import NotesSupabase

A = AccountContext("11111111-1111-4111-8111-111111111111", 1)
B = AccountContext("22222222-2222-4222-8222-222222222222", 2)
READY = Prerequisites(**{f.name: True for f in fields(Prerequisites)})
ROW = {"id": "note-1", "user_id": A.owner_id, "body": "Original / 원본 / 原本"}
RECEIPT = dict(owner_id=A.owner_id, note_id="note-1", operation_id="retire:note-1",
               kind="retire", payload={}, digest=sha256(b"{}").hexdigest())


def assess(**changes):
    return assess_delete_candidate(**(dict(
        authenticated_owner=A.owner_id, captured=A, current=A, note_id="note-1",
        operation_id="retire:note-1", owned_row=deepcopy(ROW),
        identity=IdentityObservation("note-1", A.owner_id, "LIVE"),
        prerequisites=READY,
    ) | changes))


@pytest.mark.parametrize("row,state,receipt,kind,code", [
    (ROW, "LIVE", None, "live_retirement", "CANDIDATE_NOT_ACTIVATED"),
    (None, "RESERVED", None, "reserved_retirement", "CANDIDATE_NOT_ACTIVATED"),
    (None, "RETIRED", None, "retired_identity", "RETIREMENT_RECEIPT_UNPROVEN"),
    (None, "RETIRED", RECEIPT, "retired_identity", "CANDIDATE_NOT_ACTIVATED"),
    (ROW, "RETIRED", RECEIPT, "state_conflict", "RETIRED_NOTE_PRESENT"),
    (ROW, "RETIRED", None, "state_conflict", "RETIRED_NOTE_PRESENT"),
    (None, "LIVE", None, "state_conflict", "LIVE_NOTE_MISSING"),
    (None, "LIVE", RECEIPT, "state_conflict", "LIVE_NOTE_MISSING"),
    (ROW, "RESERVED", None, "state_conflict", "RESERVED_NOTE_ALREADY_EXISTS"),
    (ROW, "LIVE", RECEIPT, "state_conflict", "RETIREMENT_RESULT_INDETERMINATE"),
    (None, "RESERVED", RECEIPT, "state_conflict", "RETIREMENT_RESULT_INDETERMINATE"),
    (None, "invalid", None, "enforcement_unavailable", "IDENTITY_OBSERVATION_INVALID"),
])
def test_all_states_and_receipts_remain_denied(row, state, receipt, kind, code):
    result = assess(owned_row=row, identity=IdentityObservation("note-1", A.owner_id, state), receipt=receipt)
    assert (result.classification, result.denial.code) == (kind, code)
    assert result.allowed is False and result.denial.allowed is False
    assert set(vars(result)) == {"classification", "denial"}


@pytest.mark.parametrize("row", [None, ROW])
@pytest.mark.parametrize("receipt", [None, RECEIPT])
def test_absence_or_receipt_does_not_establish_unknown_historical_identity(row, receipt):
    result = assess(owned_row=row, identity=None, receipt=receipt)
    assert result.classification == "unknown_historical"
    assert result.denial.code == "IDENTITY_PROVENANCE_UNPROVEN"
    assert not result.allowed


@pytest.mark.parametrize("changes,code", [
    ({"captured": None}, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    ({"current": None}, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    ({"captured": AccountContext("invalid", 1)}, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    ({"current": replace(A, generation=True)}, "ACCOUNT_AUTHORITY_UNAVAILABLE"),
    ({"authenticated_owner": None}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"authenticated_owner": B.owner_id}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"current": B}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"current": replace(A, generation=3)}, "STALE_ACCOUNT_AUTHORITY"),
    ({"owned_row": ROW | {"user_id": B.owner_id}}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"owned_row": ROW | {"id": "other"}}, "NOTE_OBSERVATION_INVALID"),
    ({"owned_row": []}, "NOTE_OBSERVATION_INVALID"),
    ({"identity": IdentityObservation("note-1", B.owner_id, "LIVE")}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"identity": IdentityObservation("other", A.owner_id, "LIVE")}, "IDENTITY_OBSERVATION_INVALID"),
    ({"identity": {"state": "LIVE"}}, "IDENTITY_OBSERVATION_INVALID"),
    ({"receipt": RECEIPT | {"owner_id": B.owner_id}}, "ACCOUNT_AUTHORITY_MISMATCH"),
    ({"receipt": []}, "RECEIPT_OBSERVATION_INVALID"),
])
def test_missing_foreign_stale_aba_and_malformed_observations_fail_closed(changes, code):
    result = assess(**changes)
    assert result.denial.code == code and not result.allowed


@pytest.mark.parametrize("field", ["note_id", "operation_id"])
@pytest.mark.parametrize("value", [None, "", " ", 1, True, {}])
def test_missing_or_malformed_operation_identity_is_never_a_delete(field, value):
    result = assess(**{field: value})
    assert result.denial.code == "INVALID_OPERATION_IDENTITY" and not result.allowed


@pytest.mark.parametrize("change", [
    {"operation_id": "retire:other-operation"}, {"note_id": "other"}, {"kind": "publish"},
    {"payload": {"body": "different"}}, {"payload": None}, {"digest": "wrong"},
])
@pytest.mark.parametrize("state", ["LIVE", "RESERVED", "RETIRED"])
def test_conflicting_receipts_do_not_confirm_retirement_or_replay(change, state):
    result = assess(owned_row=None if state != "LIVE" else ROW,
                    identity=IdentityObservation("note-1", A.owner_id, state), receipt=RECEIPT | change)
    assert result.classification == "operation_conflict"
    assert result.denial.code == "OPERATION_CONFLICT" and not result.allowed


@pytest.mark.parametrize("field", [f.name for f in fields(Prerequisites)])
def test_each_missing_enforcement_boundary_denies_retirement(field):
    result = assess(prerequisites=replace(READY, **{field: False}))
    assert result.classification == "enforcement_unavailable"
    assert result.denial.code == "DATABASE_ENFORCEMENT_UNAVAILABLE"
    assert result.denial.missing == (field,) and not result.allowed


def test_default_or_unavailable_prerequisites_do_not_enable_delete():
    for prerequisites in (None, Prerequisites(), replace(READY, deployed_roles="true")):
        result = assess(prerequisites=prerequisites)
        assert result.denial.code == "DATABASE_ENFORCEMENT_UNAVAILABLE" and not result.allowed


def test_env_flags_repetition_and_changed_operations_cannot_dispatch_or_mutate(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("candidate must not call a database transport")
    monkeypatch.setattr(main.supabase, "table", forbidden)
    monkeypatch.setattr(main.supabase, "rpc", forbidden)
    monkeypatch.setenv("NOTES_IDENTITY_GUARD_ENABLED", "true")
    monkeypatch.setenv("NOTES_IDENTITY_DELETE_ENABLED", "true")
    monkeypatch.setenv("K323_REMOTE_MUTATION_ENABLED", "enabled")
    row, receipt = deepcopy(ROW), deepcopy(RECEIPT)
    before = deepcopy((row, receipt))
    for operation_id in ("retire:note-1", "retire:note-1", "different-operation"):
        result = assess(operation_id=operation_id, owned_row=row, receipt=receipt)
        assert not result.allowed and not result.denial.allowed
    assert (row, receipt) == before
    # Request-style authority/activation arguments are not part of the seam.
    for extra in ({"user_id": B.owner_id}, {"provenance": "trusted"}, {"enabled": True}):
        with pytest.raises(TypeError):
            assess(**extra)


@pytest.mark.asyncio
@pytest.mark.parametrize("selected,deleted,status", [
    ({"user_id": A.owner_id}, [ROW], None),
    (None, [ROW], 404),
    ({"user_id": B.owner_id}, [ROW], 403),
    ({"user_id": A.owner_id}, [], 409),
    ({"user_id": A.owner_id}, [ROW | {"id": "other"}], 409),
    ({"user_id": A.owner_id}, [ROW | {"user_id": B.owner_id}], 409),
    ({"user_id": A.owner_id}, [ROW, ROW], 409),
])
async def test_existing_runtime_delete_behavior_is_unchanged(monkeypatch, selected, deleted, status):
    def forbidden(*args, **kwargs):
        raise AssertionError("live DELETE must remain disconnected from the candidate")
    monkeypatch.setattr(candidate, "assess_delete_candidate", forbidden)
    monkeypatch.setenv("NOTES_IDENTITY_GUARD_ENABLED", "true")
    monkeypatch.setenv("NOTES_IDENTITY_DELETE_ENABLED", "true")
    client = NotesSupabase(selected, deleted)
    read_query, delete_query = client.queries
    monkeypatch.setattr(main, "supabase", client)
    if status is None:
        assert await main.delete_note("note-1", A.owner_id) == {
            "deleted": True, "note_id": "note-1", "account_id": A.owner_id,
        }
    else:
        with pytest.raises(HTTPException) as error:
            await main.delete_note("note-1", A.owner_id)
        assert error.value.status_code == status
    assert read_query.filters == [("id", "note-1")]
    if status in (403, 404):
        assert client.queries == [delete_query] and delete_query.filters == []
    else:
        assert client.queries == []
        assert delete_query.filters == [("id", "note-1"), ("user_id", A.owner_id)]
