"""Candidate integration on a disposable DB only; never a production DSN.

Reuse PR #847's labelled/no-network container, psql sessions and lock observer.
The trusted gateway owner argument is an EXPLICIT MODEL, not JWT verification.
No account deletion, retention, deployed role or legacy integration is proven.
"""
import json
from pathlib import Path
import uuid

import pytest

from test_notes_identity_postgres import (
    Database, Session, command, db as proof_db, quote, _run, _assert_postgres_success,
    OWNER_A, OWNER_B, PAYLOAD,
)

SCHEMA = "notes_identity_candidate"
SQL = Path(__file__).parent / "identity_candidates" / "notes_identity_guard.sql"


class CandidateDatabase(Database):
    def cmd(self, role):
        if role == "postgres":
            return command(self.docker, self.name, role)
        if role not in {"notes_candidate_gateway", "notes_candidate_app"}:
            raise ValueError("unapproved candidate test login")
        result = command(self.docker, self.name, "proof_a")
        result[result.index("-U") + 1] = role
        return result

    def sql(self, sql, role="postgres", error=None):
        result = _run(self.cmd(role) + ["-c", sql], timeout=20, encoding="utf-8")
        if error:
            assert result.returncode != 0, result.stdout
            assert error in result.stderr, result.stderr
        else:
            _assert_postgres_success(result, self.docker, self.name)
        return result.stdout.strip()

    def connection(self, role="notes_candidate_gateway"):
        return Session(self.cmd(role))

    def reserve(self, owner=OWNER_A):
        # Explicit fixture-only trusted issuance. No issuer/freshness guarantee.
        key = "model:" + uuid.uuid4().hex
        self.sql(f"set role notes_candidate_owner;insert into {SCHEMA}.identities values ({quote(key)},{quote(owner)},'RESERVED');")
        return key

    def snapshot(self, key):
        key = quote(key)
        return json.loads(self.sql(f"""select json_build_object(
          'state',(select state from {SCHEMA}.identities where id={key}),
          'owner',(select owner_id from {SCHEMA}.identities where id={key}),
          'notes',(select count(*) from public.notes where id={key}),
          'payload',(select jsonb_build_object('title',title,'body',body,'updated_at',updated_at,'starred',starred)
                     from public.notes where id={key}),
          'receipts',(select count(*) from {SCHEMA}.receipts where note_id={key}));"""))


def publish(key, operation=None, payload=None, owner=OWNER_A, generation=1):
    body = json.dumps(PAYLOAD if payload is None else payload, ensure_ascii=False)
    return f"select {SCHEMA}.publish({quote(owner)},{generation},{quote(key)},{quote(operation or 'p:'+key)},{quote(body)}::jsonb);"


def retire(key, operation=None, owner=OWNER_A, generation=1):
    return f"select {SCHEMA}.retire({quote(owner)},{generation},{quote(key)},{quote(operation or 'r:'+key)});"


@pytest.fixture(scope="module")
def model_db(proof_db):
    db = CandidateDatabase(proof_db.docker, proof_db.name)
    # Synthetic public.notes shape only: no deployed FK/cascade is assumed.
    db.sql("""create role notes_candidate_owner nologin nosuperuser nobypassrls noinherit;
      create role notes_candidate_gateway login password 'synthetic-only' nosuperuser nobypassrls noinherit;
      create role notes_candidate_app login password 'synthetic-only' nosuperuser nobypassrls noinherit;
      create table public.notes(id text primary key,user_id uuid not null,title text not null,
        body text not null,updated_at bigint not null,starred boolean not null default false,
        folder_id text,deleted_at bigint,properties jsonb,relations jsonb);""")
    db.sql(SQL.read_text(encoding="utf-8"))
    # A failure AFTER Note mutation must roll the entire candidate call back.
    db.sql(f"alter table {SCHEMA}.receipts add check(operation_id <> 'test-fail-after-note');")
    yield db


@pytest.fixture
def candidate(model_db):
    model_db.sql(f"update {SCHEMA}.readiness set enabled=false;")
    return model_db


@pytest.fixture
def ready(candidate):
    # Owner-only TEST attestation. These values are not production evidence.
    candidate.sql(f"""update {SCHEMA}.readiness set enabled=true,
      authenticated_owner_binding=true,deployed_schema=true,deployed_roles=true,
      existing_identity_registration=true,legacy_mutations=true,k323_enforcement=true,
      reset_restore=true,account_termination=true;
      insert into {SCHEMA}.account_fences values ('{OWNER_A}',1,'ACTIVE'),('{OWNER_B}',1,'ACTIVE')
      on conflict(owner_id) do update set generation=1,state='ACTIVE';""")
    return candidate


def test_default_off_cannot_be_changed_by_gateway(candidate):
    candidate.sql(publish("unknown"), "notes_candidate_gateway", "CANDIDATE_NOT_ACTIVATED")
    candidate.sql(f"update {SCHEMA}.readiness set enabled=true;", "notes_candidate_gateway", "42501")


@pytest.mark.parametrize("field", ["authenticated_owner_binding", "deployed_schema", "deployed_roles",
    "existing_identity_registration", "legacy_mutations", "k323_enforcement", "reset_restore", "account_termination"])
def test_each_unverified_integration_blocks_sql_before_mutation(ready, field):
    key = ready.reserve()
    ready.sql(f"update {SCHEMA}.readiness set {field}=false;")
    before = ready.snapshot(key)
    ready.sql(publish(key), "notes_candidate_gateway", "CANDIDATE_NOT_ACTIVATED")
    assert ready.snapshot(key) == before


def test_exact_replay_retirement_and_unknown_ids(ready):
    key = ready.reserve()
    ready.sql(publish("historically-unknown"), "notes_candidate_gateway", "IDENTITY_UNAVAILABLE")
    ready.sql(publish(key, owner=OWNER_B), "notes_candidate_gateway", "IDENTITY_UNAVAILABLE")
    assert ready.sql(publish(key), "notes_candidate_gateway") == "CREATED"
    assert ready.sql(publish(key), "notes_candidate_gateway") == "REPLAY_LIVE"
    before = ready.snapshot(key)
    ready.sql(publish(key, payload=PAYLOAD | {"body": "changed"}), "notes_candidate_gateway", "OPERATION_CONFLICT")
    assert ready.snapshot(key) == before
    assert ready.sql(retire(key), "notes_candidate_gateway") == "RETIRED"
    retired = ready.snapshot(key)
    assert retired["state"] == "RETIRED" and retired["notes"] == 0 and retired["receipts"] == 2
    assert ready.sql(retire(key), "notes_candidate_gateway") == "ALREADY_RETIRED"
    assert ready.sql(publish(key), "notes_candidate_gateway") == "APPLIED_THEN_RETIRED"
    ready.sql(publish(key, "other"), "notes_candidate_gateway", "IDENTITY_UNAVAILABLE")
    assert ready.snapshot(key) == retired


def test_partial_failure_rolls_back_note_identity_and_both_kinds_of_receipt(ready):
    first, second = ready.reserve(), ready.reserve()
    ready.sql(publish(first), "notes_candidate_gateway")
    before = ready.snapshot(second)
    ready.sql(publish(second, "test-fail-after-note"), "notes_candidate_gateway", "23514")
    assert ready.snapshot(second) == before
    ready.sql(publish(second), "notes_candidate_gateway")
    before = ready.snapshot(second)
    ready.sql(retire(second, "test-fail-after-note"), "notes_candidate_gateway", "23514")
    assert ready.snapshot(second) == before
    assert ready.snapshot(first)["payload"] == PAYLOAD


def test_stale_aba_closed_and_unavailable_account_authority(ready):
    key = ready.reserve()
    ready.sql(f"update {SCHEMA}.account_fences set generation=3 where owner_id='{OWNER_A}';")
    ready.sql(publish(key), "notes_candidate_gateway", "ACCOUNT_AUTHORITY_UNAVAILABLE")
    ready.sql(f"update {SCHEMA}.account_fences set state='CLOSED' where owner_id='{OWNER_A}';")
    ready.sql(publish(key, generation=3), "notes_candidate_gateway", "ACCOUNT_AUTHORITY_UNAVAILABLE")
    assert ready.snapshot(key)["state"] == "RESERVED"


def test_model_browser_cannot_supply_a_trusted_owner_argument(ready):
    key = ready.reserve()
    ready.sql(publish(key), "notes_candidate_app", "42501")
    assert ready.snapshot(key)["state"] == "RESERVED"


def test_immutable_owner_terminal_retirement_and_receipts(ready):
    key = ready.reserve()
    ready.sql(publish(key), "notes_candidate_gateway")
    ready.sql(retire(key), "notes_candidate_gateway")
    before = ready.snapshot(key)
    for mutation in [f"update {SCHEMA}.identities set owner_id='{OWNER_B}' where id={quote(key)};",
                     f"update {SCHEMA}.identities set state='LIVE' where id={quote(key)};",
                     f"delete from {SCHEMA}.identities where id={quote(key)};"]:
        ready.sql("set role notes_candidate_owner;" + mutation, error="IDENTITY_IMMUTABLE")
    for mutation in [f"delete from {SCHEMA}.receipts where note_id={quote(key)};",
                     f"update {SCHEMA}.receipts set digest='changed' where note_id={quote(key)};"]:
        ready.sql("set role notes_candidate_owner;" + mutation, error="RECEIPT_IMMUTABLE")
    assert ready.snapshot(key) == before


def test_operation_conflicts_and_existing_remote_row_never_overwrite(ready):
    first, second = ready.reserve(), ready.reserve()
    ready.sql(publish(first, "shared-operation"), "notes_candidate_gateway")
    ready.sql(retire(first, "shared-operation"), "notes_candidate_gateway", "OPERATION_CONFLICT")
    before = ready.snapshot(second)
    ready.sql(publish(second, "shared-operation"), "notes_candidate_gateway", "OPERATION_CONFLICT")
    assert ready.snapshot(second) == before
    ready.sql(f"insert into public.notes(id,user_id,title,body,updated_at) values({quote(second)},'{OWNER_B}','remote','keep',1);")
    before = ready.snapshot(second)
    ready.sql(publish(second), "notes_candidate_gateway", "23505")
    assert ready.snapshot(second) == before


@pytest.mark.parametrize("same_operation", [True, False])
def test_concurrent_publications_commit_only_one_initial_insert(ready, same_operation):
    key = ready.reserve()
    first, second = ready.connection(), ready.connection()
    name = "candidate_publish_" + uuid.uuid4().hex
    try:
        first.send("begin;\nselect 'PID:'||pg_backend_pid();\n" + publish(key) + "\n\\echo HELD")
        pid = int(next(x[4:] for x in first.until("HELD") if x.startswith("PID:")))
        second.send(f"set application_name={quote(name)};\n" +
                    publish(key, None if same_operation else "other-operation") + "\n\\q")
        ready.wait_for_blocker(second, name, pid)
        first.send("commit;\n\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish(None if same_operation else "IDENTITY_UNAVAILABLE")
        actual = ready.snapshot(key)
        assert actual["state"] == "LIVE" and actual["notes"] == actual["receipts"] == 1
        assert actual["payload"] == PAYLOAD
    finally:
        first.close()
        second.close()


@pytest.mark.parametrize("extra", [{"properties": {}}, {"relations": {}}, {"folder_id": None},
    {"attachmentOriginals": ["local"]}, {"history": []}])
def test_unsupported_content_never_gets_stripped(ready, extra):
    key = ready.reserve()
    before = ready.snapshot(key)
    ready.sql(publish(key, payload=PAYLOAD | extra), "notes_candidate_gateway", "UNSUPPORTED_PAYLOAD")
    assert ready.snapshot(key) == before


@pytest.mark.parametrize("sql", [
    "insert into public.notes(id,user_id,title,body,updated_at) values('bypass','{owner}','x','y',1);",
    "update public.notes set body='changed';", "delete from public.notes;", "truncate public.notes;",
    "update {s}.identities set state='RESERVED';", "delete from {s}.receipts;",
    "select {s}.record_receipt('{owner}','x','y','publish','{{}}');",
    "set role notes_candidate_owner;",
])
@pytest.mark.parametrize("role", ["notes_candidate_app", "notes_candidate_gateway"])
def test_modeled_application_and_gateway_cannot_use_direct_dml_or_internal_helpers(ready, sql, role):
    key = ready.reserve()
    ready.sql(publish(key), "notes_candidate_gateway")
    before = ready.snapshot(key)
    ready.sql(sql.format(s=SCHEMA, owner=OWNER_A), role, "42501")
    assert ready.snapshot(key) == before


@pytest.mark.parametrize("publication_first", [True, False])
def test_publication_retirement_race_reuses_observed_pg_lock_barriers(ready, publication_first):
    key = ready.reserve()
    first, second = ready.connection(), ready.connection()
    name = "candidate_race_" + uuid.uuid4().hex
    initial = publish(key) if publication_first else retire(key)
    following = retire(key) if publication_first else publish(key)
    try:
        first.send("begin;\nselect 'PID:'||pg_backend_pid();\n" + initial + "\n\\echo HELD")
        pid = int(next(x[4:] for x in first.until("HELD") if x.startswith("PID:")))
        second.send(f"set application_name={quote(name)};\n" + following + "\n\\q")
        ready.wait_for_blocker(second, name, pid)
        first.send("commit;\n\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish(None if publication_first else "IDENTITY_UNAVAILABLE")
        actual = ready.snapshot(key)
        assert actual["state"] == "RETIRED" and actual["notes"] == 0
        assert actual["receipts"] == (2 if publication_first else 1)
    finally:
        first.close()
        second.close()
