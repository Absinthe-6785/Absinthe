"""Local contract over the existing isolated SQL harness; no live account data."""
from copy import deepcopy
import json
from pathlib import Path
import uuid

import pytest

from test_notes_identity_guard_candidate_postgres import (
    SCHEMA, OWNER_A, OWNER_B, PAYLOAD, candidate, model_db, proof_db, ready,
    quote, retire,
)

ROOT = Path(__file__).parent
SQL = ROOT / 'identity_candidates' / 'notes_single_publish_contract.sql'


def call(kind, key, operation, payload=None, owner=OWNER_A, generation=1):
    assert kind in {'publish', 'read'}
    body = json.dumps(PAYLOAD if payload is None else payload, ensure_ascii=False)
    return (f"select {SCHEMA}.{kind}_single_note({quote(owner)},{generation},"
            f"{quote(key)},{quote(operation)},{quote(body)}::jsonb);")


@pytest.fixture(scope='module')
def contract_model(model_db):
    model_db.sql(SQL.read_text(encoding='utf-8'))
    return model_db


@pytest.fixture
def single_ready(ready, contract_model):
    assert ready is contract_model
    return ready


def test_contract_reuses_lifecycle_without_new_storage_activation_or_runtime():
    source = SQL.read_text(encoding='utf-8').lower()
    assert 'unapplied local candidate' in source
    assert SQL.parent.name == 'identity_candidates'
    assert 'notes_identity_candidate.publish(p_owner,p_generation,p_id,p_operation,p_payload)' in source
    assert 'notes_identity_candidate.require_ready' in source
    assert "kind='reserve'" in source and 'for update' in source and 'for share' in source
    assert "requires_post_commit_readback',true" in source
    for forbidden in ('create table', 'create schema', 'create role', 'on conflict',
                      'gen_random_uuid', 'set enabled', 'to authenticated', 'to service_role'):
        assert forbidden not in source
    assert SQL.name not in (ROOT / 'main.py').read_text(encoding='utf-8')
    assert SQL.name not in (ROOT / 'identity_candidates' / 'notes_pilot_installation.md').read_text(encoding='utf-8')
    assert 'test_notes_single_publish_contract.py' in (ROOT.parent / '.github' / 'workflows' / 'ci.yml').read_text(encoding='utf-8')


def test_contract_default_off(candidate, contract_model):
    candidate.sql(call('publish', 'unknown-local', 'never-dispatched'),
                  'notes_candidate_gateway', 'CANDIDATE_NOT_ACTIVATED')
    candidate.sql(call('read', 'unknown-local', 'never-dispatched'),
                  'notes_candidate_gateway', 'CANDIDATE_NOT_ACTIVATED')


def test_exact_issued_identity_and_post_commit_readback_preserve_local(single_ready):
    db = single_ready
    local = {'id': db.reserve(), **deepcopy(PAYLOAD)}
    frozen = deepcopy(local)
    key, op = local['id'], 'single:' + local['id']
    result = json.loads(db.sql(call('publish', key, op), 'notes_candidate_gateway'))
    assert result['effect'] == 'CREATED' and result['requires_post_commit_readback'] is True
    # Every db.sql creates a separate connection/transaction. Discard the write
    # response and verify only by an authenticated, exact-ID post-commit read.
    readback = json.loads(db.sql(call('read', key, op), 'notes_candidate_gateway'))
    assert readback == result['snapshot']
    assert readback['note_id'] == key and readback['account_id'] == OWNER_A
    assert readback['generation'] == 1 and readback['operation_id'] == op
    assert readback['payload'] == PAYLOAD and len(readback['receipt_digest']) == 64
    before = db.snapshot(key)
    replay = json.loads(db.sql(call('publish', key, op), 'notes_candidate_gateway'))
    assert replay['effect'] == 'REPLAY_LIVE' and db.snapshot(key) == before
    assert local == frozen  # synthetic local input, not an IndexedDB durability proof


@pytest.mark.parametrize('kind', ['unknown', 'unregistered-row', 'ledger-without-reserve'])
def test_unknown_history_is_denied_without_adoption(single_ready, kind):
    db = single_ready
    key = 'laptop-legacy:' + uuid.uuid4().hex
    if kind == 'unregistered-row':
        db.sql(f"insert into public.notes(id,user_id,title,body,updated_at) values({quote(key)},'{OWNER_A}','keep','original',1);")
    elif kind == 'ledger-without-reserve':
        # Owner-only synthetic corrupt/incomplete observation, never an issuer.
        db.sql(f"set role notes_candidate_owner;insert into {SCHEMA}.identities values({quote(key)},'{OWNER_A}','RESERVED');")
    before = db.snapshot(key)
    for action in ('publish', 'read'):
        db.sql(call(action, key, 'unknown:' + key), 'notes_candidate_gateway', 'IDENTITY_PROVENANCE_UNPROVEN')
    assert db.snapshot(key) == before


def test_retired_id_rejects_even_exact_replay_and_keeps_history(single_ready):
    db = single_ready
    key = db.reserve()
    op = 'retirement:' + key
    db.sql(call('publish', key, op), 'notes_candidate_gateway')
    db.sql(retire(key), 'notes_candidate_gateway')
    before = db.snapshot(key)
    for action in ('publish', 'read'):
        db.sql(call(action, key, op), 'notes_candidate_gateway', 'IDENTITY_RETIRED')
    assert before['state'] == 'RETIRED' and before['notes'] == 0 and before['receipts'] == 3
    assert db.snapshot(key) == before


def test_existing_id_and_changed_intent_never_overwrite(single_ready):
    db = single_ready
    key = db.reserve()
    # An independently inserted conflicting row cannot be treated as success.
    db.sql(f"insert into public.notes(id,user_id,title,body,updated_at) values({quote(key)},'{OWNER_A}','keep','original',1);")
    before = db.snapshot(key)
    db.sql(call('publish', key, 'collision:' + key), 'notes_candidate_gateway', '23505')
    assert db.snapshot(key) == before
    key = db.reserve()
    op = 'published:' + key
    db.sql(call('publish', key, op), 'notes_candidate_gateway')
    before = db.snapshot(key)
    db.sql(call('publish', key, op, PAYLOAD | {'body': 'different'}), 'notes_candidate_gateway', 'OPERATION_CONFLICT')
    db.sql(call('publish', key, 'new:' + op), 'notes_candidate_gateway', 'IDENTITY_UNAVAILABLE')
    assert db.snapshot(key) == before


def test_stale_generation_foreign_account_and_browser_denied(single_ready):
    db = single_ready
    key = db.reserve()
    before = db.snapshot(key)
    db.sql(call('publish', key, 'foreign', owner=OWNER_B), 'notes_candidate_gateway_b', 'IDENTITY_PROVENANCE_UNPROVEN')
    db.sql(call('publish', key, 'forged-owner', owner=OWNER_B), 'notes_candidate_gateway', 'ACCOUNT_AUTHORITY_UNAVAILABLE')
    db.sql(call('publish', key, 'browser'), 'notes_candidate_app', '42501')
    db.sql(f"update {SCHEMA}.principal_bindings set owner_id='{OWNER_B}',generation=2 where login='notes_candidate_gateway';")
    db.sql(call('publish', key, 'during-b'), 'notes_candidate_gateway', 'ACCOUNT_AUTHORITY_UNAVAILABLE')
    db.sql(f"update {SCHEMA}.account_fences set generation=3 where owner_id='{OWNER_A}';"
           f"update {SCHEMA}.principal_bindings set owner_id='{OWNER_A}',generation=3 where login='notes_candidate_gateway';")
    for action in ('publish', 'read'):
        db.sql(call(action, key, 'old'), 'notes_candidate_gateway', 'ACCOUNT_AUTHORITY_UNAVAILABLE')
    assert db.snapshot(key) == before


@pytest.mark.parametrize('extra', [{'properties': {}}, {'relations': {}}, {'attachmentOriginals': ['local']}, {'folder_id': None}])
def test_unsupported_dependencies_not_silently_dropped(single_ready, extra):
    db = single_ready
    key = db.reserve()
    before = db.snapshot(key)
    db.sql(call('publish', key, 'unsupported:' + key, PAYLOAD | extra), 'notes_candidate_gateway', 'UNSUPPORTED_PAYLOAD')
    assert db.snapshot(key) == before


def test_failed_transaction_and_unconfirmed_readback_do_not_claim_success(single_ready):
    db = single_ready
    key = db.reserve()
    before = db.snapshot(key)
    db.sql(call('publish', key, 'test-fail-after-note'), 'notes_candidate_gateway', '23514')
    assert db.snapshot(key) == before
    db.sql(call('read', key, 'test-fail-after-note'), 'notes_candidate_gateway', 'SINGLE_NOTE_READBACK_UNCONFIRMED')
    op = 'verify:' + key
    db.sql(call('publish', key, op), 'notes_candidate_gateway')
    db.sql(call('read', key, 'wrong-op'), 'notes_candidate_gateway', 'SINGLE_NOTE_READBACK_UNCONFIRMED')
    db.sql(call('read', key, op, PAYLOAD | {'body': 'different'}), 'notes_candidate_gateway', 'SINGLE_NOTE_READBACK_UNCONFIRMED')
    before = db.snapshot(key)
    db.sql('begin;update public.notes set body=\'tampered\' where id=' + quote(key) + ';'
           + call('read', key, op) + 'commit;', 'postgres', 'SINGLE_NOTE_READBACK_UNCONFIRMED')
    assert db.snapshot(key) == before


@pytest.mark.parametrize('second_kind', ['same-operation', 'other-operation', 'retire', 'retire-first'])
def test_concurrent_operations_serialize_without_overwrite_or_resurrection(single_ready, second_kind):
    db = single_ready
    key = db.reserve()
    op = 'concurrent:' + key
    first, second = db.connection(), db.connection()
    name = 'single_publish_' + uuid.uuid4().hex
    try:
        first_call = retire(key) if second_kind == 'retire-first' else call('publish', key, op)
        first.send("begin;\nselect 'PID:'||pg_backend_pid();\n" + first_call + '\n\\echo HELD')
        lines = first.until('HELD')
        pid = int(next(line[4:] for line in lines if line.startswith('PID:')))
        next_call = retire(key) if second_kind == 'retire' else call('publish', key, op if second_kind == 'same-operation' else 'other:' + op)
        second.send(f"set application_name={quote(name)};\n" + next_call + '\n\\q')
        db.wait_for_blocker(second, name, pid)
        first.send('commit;\n\\echo COMMITTED')
        first.until('COMMITTED')
        expected_error = {'other-operation': 'IDENTITY_UNAVAILABLE', 'retire-first': 'IDENTITY_RETIRED'}.get(second_kind)
        second.finish(expected_error)
        after = db.snapshot(key)
        is_retired = second_kind in {'retire', 'retire-first'}
        assert after['state'] == ('RETIRED' if is_retired else 'LIVE')
        assert after['notes'] == (0 if is_retired else 1)
        assert after['receipts'] == (3 if second_kind == 'retire' else 2)
    finally:
        first.close()
        second.close()
