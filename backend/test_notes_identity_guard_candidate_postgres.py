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
        if role not in {"notes_candidate_gateway", "notes_candidate_gateway_b", "notes_candidate_unbound", "notes_candidate_app"}:
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
        # Real SQL issuance, never an INSERT of a test-selected Note identity.
        role = "notes_candidate_gateway" if owner == OWNER_A else "notes_candidate_gateway_b"
        return self.sql(reserve("s:" + uuid.uuid4().hex), role)

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


def reserve(operation):
    return f"select {SCHEMA}.reserve({quote(operation)});"


def retire(key, operation=None, owner=OWNER_A, generation=1):
    return f"select {SCHEMA}.retire({quote(owner)},{generation},{quote(key)},{quote(operation or 'r:'+key)});"


@pytest.fixture(scope="module")
def model_db(proof_db):
    db = CandidateDatabase(proof_db.docker, proof_db.name)
    # Synthetic catalog model of the reported column types and FK cascade.
    # Deployed defaults/nullability, auth.uid/RLS policy and JWT-to-role binding
    # are NOT established here. Production grants are never modified.
    db.sql("""create role notes_candidate_owner nologin nosuperuser nobypassrls noinherit;
      create role notes_candidate_gateway login password 'synthetic-only' nosuperuser nobypassrls noinherit;
      create role notes_candidate_app login password 'synthetic-only' nosuperuser nobypassrls noinherit;
      create role notes_candidate_gateway_b login password 'synthetic-only' nosuperuser nobypassrls inherit;
      create role notes_candidate_unbound login password 'synthetic-only' nosuperuser nobypassrls inherit;
      grant notes_candidate_gateway to notes_candidate_gateway_b,notes_candidate_unbound;
      create role anon nologin nosuperuser nobypassrls;
      create role authenticated nologin nosuperuser nobypassrls;
      create role service_role nologin nosuperuser bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create table public.notes(id text primary key,
        user_id uuid not null references auth.users(id) on delete cascade,
        title text not null,body text not null,updated_at bigint not null,
        created_at timestamptz,folder_id text,deleted_at bigint,
        starred boolean not null default false);""")
    db.sql(f"insert into auth.users values ('{OWNER_A}'),('{OWNER_B}');")
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
    # Test-only trusted login bindings, NOT Supabase JWT/production admission.
    # postgres binding exists solely for existing rollback/DDL fault injections.
    candidate.sql(f"""insert into {SCHEMA}.principal_bindings values
      ('notes_candidate_gateway','{OWNER_A}',1),('notes_candidate_gateway_b','{OWNER_B}',1),('postgres','{OWNER_A}',1)
      on conflict(login) do update set owner_id=excluded.owner_id,generation=excluded.generation;""")
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
    ready.sql(publish(key, owner=OWNER_B), "notes_candidate_gateway_b", "IDENTITY_UNAVAILABLE")
    assert ready.sql(publish(key), "notes_candidate_gateway") == "CREATED"
    assert ready.sql(publish(key), "notes_candidate_gateway") == "REPLAY_LIVE"
    before = ready.snapshot(key)
    ready.sql(publish(key, payload=PAYLOAD | {"body": "changed"}), "notes_candidate_gateway", "OPERATION_CONFLICT")
    assert ready.snapshot(key) == before
    assert ready.sql(retire(key), "notes_candidate_gateway") == "RETIRED"
    retired = ready.snapshot(key)
    assert retired["state"] == "RETIRED" and retired["notes"] == 0 and retired["receipts"] == 3
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
        assert actual["state"] == "LIVE" and actual["notes"] == 1 and actual["receipts"] == 2
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
        assert actual["receipts"] == (3 if publication_first else 2)
    finally:
        first.close()
        second.close()


def test_reported_column_shape_and_missing_metadata_columns_support_exact_replay(ready):
    columns = json.loads(ready.sql("""select json_object_agg(column_name,data_type)
      from information_schema.columns where table_schema='public' and table_name='notes';"""))
    assert columns == {"id": "text", "user_id": "uuid", "title": "text", "body": "text",
                       "updated_at": "bigint", "created_at": "timestamp with time zone",
                       "folder_id": "text", "deleted_at": "bigint", "starred": "boolean"}
    key = ready.reserve()
    assert ready.sql(publish(key), "notes_candidate_gateway") == "CREATED"
    before = ready.snapshot(key)
    assert before["payload"] == PAYLOAD
    assert ready.sql(publish(key), "notes_candidate_gateway") == "REPLAY_LIVE"
    assert ready.snapshot(key) == before
    assert ready.sql(retire(key), "notes_candidate_gateway") == "RETIRED"


@pytest.mark.parametrize("column", ["properties", "relations"])
def test_replay_still_rejects_unsupported_remote_metadata_if_a_column_exists(ready, column):
    key = ready.reserve()
    ready.sql(publish(key), "notes_candidate_gateway")
    before = ready.snapshot(key)
    # ON_ERROR_STOP closes the aborted transaction, rolling back both temporary
    # DDL and row changes. No shared fixture schema/record is left modified.
    ready.sql(f"begin;alter table public.notes add column {column} jsonb;"
              f"update public.notes set {column}='{{\"keep\":true}}' where id={quote(key)};"
              + publish(key) + "commit;", error="RESULT_INDETERMINATE")
    assert ready.snapshot(key) == before


@pytest.mark.parametrize("role", ["anon", "authenticated", "service_role"])
@pytest.mark.parametrize("privilege", ["INSERT", "UPDATE", "DELETE", "TRUNCATE",
                                       "INSERT (title)", "UPDATE (body)"])
def test_deployed_role_table_or_column_write_grants_deny_before_mutation(ready, role, privilege):
    key = ready.reserve()
    before = ready.snapshot(key)
    for operation in (publish(key), retire(key)):
        ready.sql(f"begin;grant {privilege} on public.notes to {role};" + operation + "commit;",
                  error="CANDIDATE_DIRECT_WRITE_GRANTS_REMAIN")
        assert ready.snapshot(key) == before


def test_unavailable_deployed_role_evidence_fails_closed(ready):
    key = ready.reserve()
    before = ready.snapshot(key)
    ready.sql("begin;alter role anon rename to candidate_unavailable_anon;" + publish(key) + "commit;",
              error="CANDIDATE_DEPLOYED_ROLES_UNVERIFIED")
    assert ready.snapshot(key) == before


def test_synthetic_auth_cascade_preserves_identity_without_inventing_termination_authority(ready):
    key = ready.reserve()
    ready.sql(publish(key), "notes_candidate_gateway")
    before = ready.snapshot(key)
    # Synthetic, rolled-back Auth deletion, NOT an account retention/erasure
    # implementation. A cascade is not an authoritative account-close fence.
    observed = ready.sql(f"""begin;
      update {SCHEMA}.readiness set account_termination=false;
      delete from auth.users where id='{OWNER_A}';
      select json_build_object(
        'notes',(select count(*) from public.notes where id={quote(key)}),
        'identity',(select state from {SCHEMA}.identities where id={quote(key)}),
        'receipts',(select count(*) from {SCHEMA}.receipts where note_id={quote(key)}),
        'fence',(select state from {SCHEMA}.account_fences where owner_id='{OWNER_A}'));
      """ + publish(key) + "commit;", error="CANDIDATE_NOT_ACTIVATED")
    assert json.loads(observed) == {"notes": 0, "identity": "LIVE", "receipts": 2, "fence": "ACTIVE"}
    assert ready.snapshot(key) == before  # failed transaction did not persist deletion


def test_server_issuance_preserves_exact_identity_and_terminal_history(ready):
    operation = 'reserve:' + uuid.uuid4().hex
    key = ready.sql(reserve(operation), 'notes_candidate_gateway')
    assert str(uuid.UUID(key)) == key
    reserved = ready.snapshot(key)
    assert reserved == dict(state='RESERVED', owner=OWNER_A, notes=0, payload=None, receipts=1)
    assert ready.sql(reserve(operation), 'notes_candidate_gateway') == key
    assert ready.snapshot(key) == reserved
    ready.sql(publish(key), 'notes_candidate_gateway')
    assert ready.snapshot(key)['payload'] == PAYLOAD
    ready.sql(retire(key), 'notes_candidate_gateway')
    terminal = ready.snapshot(key)
    assert terminal == dict(state='RETIRED', owner=OWNER_A, notes=0, payload=None, receipts=3)
    assert ready.sql(reserve(operation), 'notes_candidate_gateway') == key  # historical replay only
    ready.sql(publish(key, 'new-publication'), 'notes_candidate_gateway', 'IDENTITY_UNAVAILABLE')
    ready.sql(retire(key, 'new-retirement'), 'notes_candidate_gateway', 'IDENTITY_UNAVAILABLE')
    assert ready.snapshot(key) == terminal


def test_no_adoption_of_absent_or_physically_deleted_historical_ids(ready):
    key = 'unknown:' + uuid.uuid4().hex
    ready.sql(f"insert into public.notes(id,user_id,title,body,updated_at) values({quote(key)},'{OWNER_A}','keep','original',1);")
    ready.sql(f"delete from public.notes where id={quote(key)};")  # disposable historical deletion model
    before = ready.snapshot(key)
    assert before['state'] is None and before['receipts'] == before['notes'] == 0
    ready.sql(publish(key), 'notes_candidate_gateway', 'IDENTITY_UNAVAILABLE')
    ready.sql(retire(key), 'notes_candidate_gateway', 'IDENTITY_UNAVAILABLE')
    # There is no overload accepting a requested ID or owner.
    ready.sql(f"select {SCHEMA}.reserve('op',{quote(key)},'{OWNER_A}');", 'notes_candidate_gateway', '42883')
    assert ready.snapshot(key) == before


@pytest.mark.parametrize('role', ['notes_candidate_app', 'notes_candidate_unbound'])
def test_untrusted_or_unbound_principal_cannot_reserve(candidate, ready, role):
    expected = '42501' if role == 'notes_candidate_app' else 'ACCOUNT_AUTHORITY_UNAVAILABLE'
    before = ready.sql(f'select count(*) from {SCHEMA}.identities;')
    ready.sql(reserve('forbidden'), role, expected)
    ready.sql(f"insert into {SCHEMA}.principal_bindings values(current_user,'{OWNER_A}',1);", role, '42501')
    assert ready.sql(f'select count(*) from {SCHEMA}.identities;') == before


def test_authenticated_login_not_caller_owner_or_role_selects_account(ready):
    key = ready.reserve(OWNER_B)
    before = ready.snapshot(key)
    ready.sql(publish(key, owner=OWNER_B), 'notes_candidate_gateway', 'ACCOUNT_AUTHORITY_UNAVAILABLE')
    ready.sql(publish(key, owner=OWNER_A), 'notes_candidate_gateway_b', 'ACCOUNT_AUTHORITY_UNAVAILABLE')
    # Role membership grants function use, never changes session_user's binding.
    assert ready.sql('set role notes_candidate_gateway;' + publish(key, owner=OWNER_B), 'notes_candidate_gateway_b') == 'CREATED'
    ready.sql(f"set session authorization notes_candidate_gateway_b;" + publish(key, owner=OWNER_B),
              'notes_candidate_gateway', '42501')
    assert before['owner'] == ready.snapshot(key)['owner'] == OWNER_B


def test_reservation_and_receipt_are_one_transaction_and_operation_namespace(ready):
    before = ready.sql(f'select count(*) from {SCHEMA}.identities;')
    ready.sql(reserve('test-fail-after-note'), 'notes_candidate_gateway', '23514')
    assert ready.sql(f'select count(*) from {SCHEMA}.identities;') == before
    operation = 'reservation:' + uuid.uuid4().hex
    key = ready.sql(reserve(operation), 'notes_candidate_gateway')
    before = ready.snapshot(key)
    ready.sql(publish(key, operation), 'notes_candidate_gateway', 'OPERATION_CONFLICT')
    ready.sql(retire(key, operation), 'notes_candidate_gateway', 'OPERATION_CONFLICT')
    assert ready.snapshot(key) == before
    ready.sql(publish(key), 'notes_candidate_gateway')
    ready.sql(reserve('p:' + key), 'notes_candidate_gateway', 'OPERATION_CONFLICT')


def test_concurrent_reservation_replays_return_one_identity_and_one_receipt(ready):
    operation = 'concurrent-reserve:' + uuid.uuid4().hex
    first, second = ready.connection(), ready.connection()
    name = 'candidate_reserve_' + uuid.uuid4().hex
    try:
        first.send("begin;\nselect 'PID:'||pg_backend_pid();\n" + reserve(operation) + "\n\\echo HELD")
        output = first.until('HELD')
        pid = int(next(line[4:] for line in output if line.startswith('PID:')))
        key = next(line for line in output if len(line) == 36)
        second.send(f'set application_name={quote(name)};\n' + reserve(operation) + '\n\\q')
        ready.wait_for_blocker(second, name, pid)
        first.send('commit;\n\\echo COMMITTED'); first.until('COMMITTED')
        second.finish()
        assert key in second.log
        assert ready.snapshot(key) == dict(state='RESERVED', owner=OWNER_A, notes=0, payload=None, receipts=1)
    finally:
        first.close(); second.close()


def test_generation_changes_invalidate_old_bindings_and_captured_operations(ready):
    key = ready.reserve()
    before = ready.snapshot(key)
    # Rolled-back model of A/B/A generation advancement, not a lifecycle API.
    ready.sql(f"begin;update {SCHEMA}.account_fences set generation=3 where owner_id='{OWNER_A}';"
              + reserve('stale-generation') + 'commit;', error='ACCOUNT_AUTHORITY_UNAVAILABLE')
    ready.sql(f"begin;update {SCHEMA}.account_fences set generation=3 where owner_id='{OWNER_A}';"
              f"update {SCHEMA}.principal_bindings set generation=3 where owner_id='{OWNER_A}';"
              + publish(key) + 'commit;', error='ACCOUNT_AUTHORITY_UNAVAILABLE')
    assert ready.snapshot(key) == before


def test_retirement_does_not_accept_a_foreign_current_row_for_a_reserved_id(ready):
    key = ready.reserve()
    ready.sql(f"insert into public.notes(id,user_id,title,body,updated_at) values({quote(key)},'{OWNER_B}','foreign','keep',1);")
    before = ready.snapshot(key)
    ready.sql(retire(key), 'notes_candidate_gateway', 'RESULT_INDETERMINATE')
    assert ready.snapshot(key) == before
