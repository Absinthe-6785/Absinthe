"""Explicit historical-ID exception; synthetic accounts and disposable SQL only."""
from copy import deepcopy
import json
from pathlib import Path
import uuid

import pytest

from test_notes_identity_guard_candidate_postgres import (
    SCHEMA, OWNER_A, OWNER_B, PAYLOAD, candidate, model_db, proof_db, ready,
    quote, publish, retire,
)

ROOT = Path(__file__).parent
SQL = ROOT / "identity_candidates" / "notes_laptop_initial_adoption.sql"
POLICY = "OWNER_APPROVED_HISTORICAL_ADOPTION"
ATTESTATION = dict.fromkeys((
    "durable_local", "current_account", "active_complete", "no_dependencies",
    "no_pending_mutations", "known_deletions_complete",
), True)


def fresh():
    return "laptop-existing:" + uuid.uuid4().hex


def approval(key, op=None, payload=None, owner=OWNER_A, generation=1,
             known=(), attestation=None, policy=POLICY,
             expiry="clock_timestamp()+interval '1 hour'"):
    body = json.dumps(PAYLOAD if payload is None else payload, ensure_ascii=False)
    evidence = json.dumps(ATTESTATION if attestation is None else attestation)
    deleted = "array[" + ",".join(quote(x) for x in known) + "]::text[]"
    return (
        f"select {SCHEMA}.approve_laptop_adoption({quote(owner)},{generation},"
        f"{quote(key)},{quote(op or 'adopt:'+key)},{quote(body)}::jsonb,"
        f"{quote('a'*64)},{deleted},{expiry},{quote(evidence)}::jsonb,{quote(policy)});"
    )


def call(kind, key, op=None, payload=None, owner=OWNER_A, generation=1):
    assert kind in {"publish_laptop_note", "read_laptop_publication"}
    body = json.dumps(PAYLOAD if payload is None else payload, ensure_ascii=False)
    return (
        f"select {SCHEMA}.{kind}({quote(owner)},{generation},{quote(key)},"
        f"{quote(op or 'adopt:'+key)},{quote(body)}::jsonb);"
    )


@pytest.fixture(scope="module")
def adoption_model(model_db):
    model_db.sql(SQL.read_text(encoding="utf-8"))
    return model_db


@pytest.fixture
def adoption_ready(ready, adoption_model):
    assert ready is adoption_model
    return ready


def approve(db, key, **kwargs):
    return db.sql("set role notes_candidate_owner;" + approval(key, **kwargs))


def test_candidate_has_no_runtime_migration_or_activation():
    source = SQL.read_text(encoding="utf-8").lower()
    assert "unapplied local candidate" in source
    assert SQL.parent.name == "identity_candidates"
    assert "notes_identity_candidate.publish(p_owner,p_generation,p_id,p_operation,p_payload)" in source
    assert "notes_identity_candidate.require_ready" in source
    for forbidden in ("create role", "create schema", "set enabled", "on conflict",
                      "to authenticated", "to anon", "to service_role", "gen_random_uuid"):
        assert forbidden not in source
    assert SQL.name not in (ROOT / "main.py").read_text(encoding="utf-8")
    assert SQL.name not in (ROOT / "identity_candidates" / "notes_pilot_installation.md").read_text(encoding="utf-8")
    assert "test_notes_laptop_initial_adoption.py" in (ROOT.parent / ".github/workflows/ci.yml").read_text(encoding="utf-8")


def test_candidate_reuses_terminal_history_without_fabricating_issuance():
    source = SQL.read_text(encoding="utf-8")
    assert "'RETIRED'" in source and "'RESERVED'" in source
    assert "record_receipt(" not in source
    assert "candidate_laptop_approval_immutable" in source
    assert "before insert on notes_identity_candidate.receipts" in source
    assert "requires_post_commit_readback',true" in source
    assert "clock_timestamp()>=a.expires_at" in source
    assert "for update" in source and "for share" in source


def test_default_off_denies_approval_publication_and_read(candidate, adoption_model):
    key = fresh()
    candidate.sql(approval(key), error="CANDIDATE_NOT_ACTIVATED")
    for kind in ("publish_laptop_note", "read_laptop_publication"):
        candidate.sql(call(kind, key), "notes_candidate_gateway", "CANDIDATE_NOT_ACTIVATED")
    assert candidate.snapshot(key)["state"] is None


def test_exact_historical_adoption_readback_and_no_write_replay(adoption_ready):
    db = adoption_ready
    local = {"id": fresh(), **deepcopy(PAYLOAD)}
    before = deepcopy(local)
    key = local["id"]
    approve(db, key)
    assert db.snapshot(key)["state"] == "RESERVED"
    assert db.snapshot(key)["receipts"] == 0  # not falsely called server-issued
    result = json.loads(db.sql(call("publish_laptop_note", key), "notes_candidate_gateway"))
    assert result["effect"] == "CREATED" and result["requires_post_commit_readback"] is True
    # Fresh connection after commit, not the write response or Promise resolution.
    readback = json.loads(db.sql(call("read_laptop_publication", key), "notes_candidate_gateway"))
    assert readback == result["snapshot"]
    assert readback == dict(account_id=OWNER_A, generation=1, note_id=key,
                           operation_id="adopt:"+key, payload=PAYLOAD,
                           capture_sha256="a"*64, policy=POLICY)
    committed = db.snapshot(key)
    assert json.loads(db.sql(call("publish_laptop_note", key), "notes_candidate_gateway"))["effect"] == "REPLAY_LIVE"
    assert db.snapshot(key) == committed and local == before


def test_unknown_id_without_explicit_approval_stays_denied(adoption_ready):
    db, key = adoption_ready, fresh()
    for kind in ("publish_laptop_note", "read_laptop_publication"):
        db.sql(call(kind, key), "notes_candidate_gateway", "LAPTOP_APPROVAL_REQUIRED")
    assert db.snapshot(key)["state"] is None


@pytest.mark.parametrize("field", tuple(ATTESTATION))
def test_each_missing_local_attestation_blocks_approval(adoption_ready, field):
    db, key = adoption_ready, fresh()
    db.sql(approval(key, attestation=ATTESTATION | {field: False}), error="LAPTOP_ADOPTION_INELIGIBLE")
    assert db.snapshot(key)["state"] is None


@pytest.mark.parametrize("kind", ("existing-owned", "existing-foreign", "soft-deleted", "retired", "reserved"))
def test_existing_and_retired_id_never_adopted(adoption_ready, kind):
    db, key = adoption_ready, fresh()
    if kind.startswith("existing") or kind == "soft-deleted":
        owner = OWNER_B if kind == "existing-foreign" else OWNER_A
        deleted = "9" if kind == "soft-deleted" else "null"
        db.sql(f"insert into public.notes(id,user_id,title,body,updated_at,deleted_at) "
               f"values({quote(key)},'{owner}','keep','unchanged',1,{deleted});")
    else:
        db.sql(f"insert into {SCHEMA}.identities values({quote(key)},'{OWNER_A}',"
               f"'{kind.upper()}');")
    before = db.snapshot(key)
    db.sql(approval(key), error="IDENTITY_UNAVAILABLE")
    assert db.snapshot(key) == before


def test_known_deleted_ids_are_permanently_excluded_without_note_mutation(adoption_ready):
    db, key, deleted = adoption_ready, fresh(), fresh()
    db.sql(f"insert into public.notes(id,user_id,title,body,updated_at,deleted_at) "
           f"values({quote(deleted)},'{OWNER_A}','tombstone','keep',1,9);")
    before = db.snapshot(deleted)
    approve(db, key, known=(deleted,))
    assert db.snapshot(deleted) == before | {"state": "RETIRED", "owner": OWNER_A}
    db.sql(approval(deleted), error="IDENTITY_UNAVAILABLE")
    db.sql(approval(fresh(), known=(key,)), error="KNOWN_RETIREMENT_CONFLICT")
    db.sql(approval(deleted, known=(deleted,)), error="IDENTITY_RETIRED")
    db.sql(f"set role notes_candidate_owner;delete from {SCHEMA}.identities where id={quote(deleted)};",
           error="IDENTITY_IMMUTABLE")


def test_conflicting_deletion_list_rolls_back_entire_approval(adoption_ready):
    db, key, active, first_deleted = adoption_ready, fresh(), fresh(), fresh()
    db.sql(f"insert into public.notes(id,user_id,title,body,updated_at) "
           f"values({quote(active)},'{OWNER_A}','keep','unchanged',1);")
    before = db.snapshot(active)
    db.sql(approval(key, known=(first_deleted, active)), error="KNOWN_RETIREMENT_CONFLICT")
    assert db.snapshot(key)["state"] is None and db.snapshot(first_deleted)["state"] is None
    assert db.snapshot(active) == before


@pytest.mark.parametrize("known", (("",), (" x",), ("same", "same")))
def test_malformed_or_duplicate_known_ids_fail_closed(adoption_ready, known):
    adoption_ready.sql(approval(fresh(), known=known), error="KNOWN_DELETIONS_INCOMPLETE")


@pytest.mark.parametrize("payload", (
    PAYLOAD | {"folder_id": "unresolved"},
    PAYLOAD | {"relations": []},
    PAYLOAD | {"body": "![original](attachment:missing)"},
    PAYLOAD | {"body": "[[id:other|relationship]]"},
    PAYLOAD | {"updated_at": -1},
))
def test_unsupported_or_oversized_content_cannot_be_approved(adoption_ready, payload):
    key = fresh()
    adoption_ready.sql(approval(key, payload=payload), error="LAPTOP_ADOPTION_INELIGIBLE")
    assert adoption_ready.snapshot(key)["state"] is None


def test_oversized_body_rejected_inside_database_without_large_command_line(adoption_ready):
    key = fresh()
    encoded = quote(json.dumps(PAYLOAD, ensure_ascii=False)) + "::jsonb"
    sql = approval(key).replace(encoded, f"jsonb_set({encoded},'{{body}}',to_jsonb(repeat('x',1048577)))")
    adoption_ready.sql(sql, error="LAPTOP_ADOPTION_INELIGIBLE")
    assert adoption_ready.snapshot(key)["state"] is None


def test_account_stale_generation_and_owner_only_approval(adoption_ready):
    db, key = adoption_ready, fresh()
    db.sql(approval(key), "notes_candidate_gateway", "42501")
    approve(db, key)
    db.sql(call("publish_laptop_note", key, owner=OWNER_B), "notes_candidate_gateway_b", "LAPTOP_APPROVAL_REQUIRED")
    db.sql(f"update {SCHEMA}.account_fences set generation=3 where owner_id='{OWNER_A}';")
    db.sql(call("publish_laptop_note", key), "notes_candidate_gateway", "ACCOUNT_AUTHORITY_UNAVAILABLE")
    db.sql(f"update {SCHEMA}.principal_bindings set generation=3 where login='notes_candidate_gateway';")
    db.sql(call("publish_laptop_note", key, generation=3), "notes_candidate_gateway", "LAPTOP_APPROVAL_REQUIRED")
    assert db.snapshot(key)["state"] == "RESERVED"


def test_approval_is_immutable_and_wrong_intent_cannot_use_low_level_publish(adoption_ready):
    db, key = adoption_ready, fresh()
    approve(db, key)
    before = db.snapshot(key)
    db.sql(publish(key, operation="adopt:"+key, payload=PAYLOAD | {"body": "different"}),
           "notes_candidate_gateway", "LAPTOP_APPROVAL_MISMATCH_OR_EXPIRED")
    db.sql(publish(key, operation="different-operation"), "notes_candidate_gateway",
           "LAPTOP_APPROVAL_MISMATCH_OR_EXPIRED")
    assert db.snapshot(key) == before
    db.sql(f"set role notes_candidate_owner;delete from {SCHEMA}.laptop_adoptions where note_id={quote(key)};",
           error="RECEIPT_IMMUTABLE")


def test_expired_approval_and_failed_transaction_leave_no_publication(adoption_ready):
    db, key = adoption_ready, fresh()
    db.sql(approval(key, expiry="clock_timestamp()-interval '1 second'"),
           error="LAPTOP_ADOPTION_INELIGIBLE")
    approve(db, key)
    # Test-owner-only expiry fault injection; no sleep/timing-sensitive deadline.
    db.sql(f"begin;alter table {SCHEMA}.laptop_adoptions disable trigger candidate_laptop_approval_immutable;"
           f"update {SCHEMA}.laptop_adoptions set expires_at=clock_timestamp()-interval '1 hour' where note_id={quote(key)};"
           f"alter table {SCHEMA}.laptop_adoptions enable trigger candidate_laptop_approval_immutable;commit;")
    db.sql(call("publish_laptop_note", key), "notes_candidate_gateway", "LAPTOP_APPROVAL_MISMATCH_OR_EXPIRED")
    assert db.snapshot(key)["state"] == "RESERVED" and db.snapshot(key)["notes"] == 0
    key = fresh()
    approve(db, key, op="test-fail-after-note")
    db.sql(call("publish_laptop_note", key, op="test-fail-after-note"),
           "notes_candidate_gateway", "23514")
    assert db.snapshot(key)["state"] == "RESERVED" and db.snapshot(key)["notes"] == 0
    db.sql(call("read_laptop_publication", key, op="test-fail-after-note"),
           "notes_candidate_gateway", "LAPTOP_READBACK_UNCONFIRMED")


def test_retirement_preserves_evidence_and_blocks_all_replays(adoption_ready):
    db, key = adoption_ready, fresh()
    approve(db, key)
    db.sql(call("publish_laptop_note", key), "notes_candidate_gateway")
    db.sql(retire(key), "notes_candidate_gateway")
    before = db.snapshot(key)
    assert before["state"] == "RETIRED" and before["notes"] == 0 and before["receipts"] == 2
    db.sql(call("publish_laptop_note", key), "notes_candidate_gateway", "IDENTITY_RETIRED")
    db.sql(call("read_laptop_publication", key), "notes_candidate_gateway", "LAPTOP_READBACK_UNCONFIRMED")
    db.sql(approval(key), error="IDENTITY_UNAVAILABLE")
    assert db.snapshot(key) == before


@pytest.mark.parametrize("kind", ("same", "other-intent", "retire"))
def test_concurrent_calls_serialize_without_overwrite_or_resurrection(adoption_ready, kind):
    db, key = adoption_ready, fresh()
    approve(db, key)
    first, second = db.connection(), db.connection()
    name = "laptop_adoption_" + uuid.uuid4().hex
    try:
        first.send("begin;\nselect 'PID:'||pg_backend_pid();\n"
                   + call("publish_laptop_note", key) + "\n\\echo HELD")
        pid = int(next(x[4:] for x in first.until("HELD") if x.startswith("PID:")))
        next_call = (retire(key) if kind == "retire" else
                     call("publish_laptop_note", key) if kind == "same" else
                     publish(key, operation="different-operation"))
        second.send(f"set application_name={quote(name)};\n{next_call}\n\\q")
        db.wait_for_blocker(second, name, pid)
        first.send("commit;\n\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish("IDENTITY_UNAVAILABLE" if kind == "other-intent" else None)
        after = db.snapshot(key)
        assert after["state"] == ("RETIRED" if kind == "retire" else "LIVE")
        assert after["notes"] == (0 if kind == "retire" else 1)
        assert after["payload"] == (None if kind == "retire" else PAYLOAD)
    finally:
        second.close()
        first.close()
