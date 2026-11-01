"""Real SQL/MAC/verified-JWT boundary on the EXISTING disposable psql harness.

Not a deployed Supabase proof and NOT a test of psycopg/TLS/pool provisioning.
No DSN, host port, new container framework or production credential is accepted.
"""
import json
from pathlib import Path
import secrets
import time
import uuid

import pytest

from identity_candidates.notes_private_gateway import AUDIENCE, PrivateGateway
from test_notes_identity_guard_candidate_postgres import (
    CandidateDatabase, SCHEMA, model_db, candidate, ready, proof_db,
)
from test_notes_identity_postgres import OWNER_A, OWNER_B, PAYLOAD, quote
from test_notes_identity_private_gateway import token, verifier

SQL = Path(__file__).parent/"identity_candidates"/"notes_identity_private_gateway.sql"
LOGIN = "notes_candidate_private_gateway"


class PrivateDatabase(CandidateDatabase):
    def cmd(self, role):
        if role != LOGIN:
            return super().cmd(role)
        result = super().cmd("notes_candidate_gateway")
        result[result.index("-U")+1] = LOGIN
        return result

    def call(self, name, text, mac):
        result = self.sql(call_sql(name, text, mac), LOGIN)
        return json.loads(result) if name == "prepare" else result


def call_sql(name, text, mac):
    assert name in {"prepare", "apply"}
    return f"select {SCHEMA}.private_{name}({quote(text)},decode('{mac.hex()}','hex'));"


def signed_apply(g, context, access_token=None):
    # Only the SQL connection-state tests use this bridge. Normal integration
    # paths below call the actual PrivateGateway API with real JWT verification.
    owner, expiry = g._authenticate(access_token or token())
    assert owner == context["intent"]["owner"]
    text, mac = g._sign(dict(aud=AUDIENCE+".apply", context=context,
                             expires=min(expiry, context["expires"])))
    return call_sql("apply", text, mac)


@pytest.fixture(scope="module")
def private_db(model_db):
    db = PrivateDatabase(model_db.docker, model_db.name)
    db.sql(f"create role {LOGIN} login password 'synthetic-only' nosuperuser nobypassrls noinherit nocreatedb nocreaterole noreplication;")
    db.sql(f"create extension pgcrypto with schema {SCHEMA};")
    db.sql(SQL.read_text(encoding="utf-8"))
    db.signing_key = secrets.token_bytes(32)
    db.sql(f"update {SCHEMA}.private_gateway_config set signing_key=decode('{db.signing_key.hex()}','hex');")
    yield db


@pytest.fixture
def private_ready(private_db, ready):
    private_db.sql(f"update {SCHEMA}.private_gateway_config set enabled=true;")
    yield private_db
    private_db.sql(f"update {SCHEMA}.private_gateway_config set enabled=false;")


def client(db):
    return PrivateGateway(verifier(), db, db.signing_key, enabled=True)


def operation():
    return uuid.uuid4().hex


def test_private_gateway_is_disabled_in_database_by_default(private_db, ready):
    with pytest.raises(pytest.fail.Exception, match="CANDIDATE_NOT_ACTIVATED"):
        client(private_db).prepare(token(), "reserve", operation())
    assert private_db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


def test_two_verified_users_and_terminal_identity_contract(private_ready):
    db, g = private_ready, client(private_ready)
    a = g.run(token(), "reserve", operation())
    b = g.run(token(OWNER_B), "reserve", operation())
    assert a != b and db.snapshot(a)["owner"] == OWNER_A and db.snapshot(b)["owner"] == OWNER_B
    before = db.snapshot(a)
    for action in ("publish", "retire"):
        ctx = g.prepare(token(OWNER_B), action, operation(), note_id=a,
                        payload=PAYLOAD if action=="publish" else None)
        db.sql(signed_apply(g, ctx, token(OWNER_B)), LOGIN, "IDENTITY_UNAVAILABLE")
        assert db.snapshot(a) == before
    assert g.run(token(), "publish", operation(), note_id=a, payload=PAYLOAD) == "CREATED"
    assert g.run(token(), "retire", operation(), note_id=a) == "RETIRED"
    ctx = g.prepare(token(), "publish", operation(), note_id=a, payload=PAYLOAD)
    db.sql(signed_apply(g, ctx), LOGIN, "IDENTITY_UNAVAILABLE")
    unknown = g.prepare(token(), "publish", operation(), note_id="historically-unknown", payload=PAYLOAD)
    db.sql(signed_apply(g, unknown), LOGIN, "IDENTITY_UNAVAILABLE")
    assert db.snapshot(a)["state"] == "RETIRED" and db.snapshot(a)["notes"] == 0
    assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


def test_db_rejects_tampering_and_invalid_assertions(private_ready):
    db, g = private_ready, client(private_ready)
    c = g.prepare(token(), "reserve", operation())
    before = db.sql(f"select count(*) from {SCHEMA}.identities;")
    text, mac = g._sign(dict(aud=AUDIENCE+".apply", context=c, expires=c["expires"]))
    for changed in [
        text.replace(OWNER_A, OWNER_B),
        text.replace(c["intent"]["operation_id"], operation()),
        text.replace('"generation":1', '"generation":3'),
    ]:
        db.sql(call_sql("apply", changed, mac), LOGIN, "ASSERTION_DENIED")
    db.sql(call_sql("apply", text, bytes(32)), LOGIN, "ASSERTION_DENIED")
    expired, signature = g._sign(dict(aud=AUDIENCE+".apply", context=c, expires=1))
    db.sql(call_sql("apply", expired, signature), LOGIN, "ASSERTION_DENIED")
    assert db.sql(f"select count(*) from {SCHEMA}.identities;") == before


def test_db_pins_first_generation_and_never_upgrades_old_operation(private_ready):
    db, g, op = private_ready, client(private_ready), operation()
    c = g.prepare(token(), "reserve", op)
    assert c["generation"] == 1
    db.sql(f"update {SCHEMA}.account_fences set generation=3 where owner_id='{OWNER_A}';")
    assert g.prepare(token(), "reserve", op) == c
    db.sql(signed_apply(g, c), LOGIN, "ACCOUNT_AUTHORITY_UNAVAILABLE")
    new = g.prepare(token(), "reserve", operation())
    assert new["generation"] == 3
    key = g.apply(token(), new)
    assert db.snapshot(key)["owner"] == OWNER_A
    assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


def test_same_connection_never_retains_account_binding(private_ready):
    db, g = private_ready, client(private_ready)
    a, b = g.prepare(token(), "reserve", operation()), g.prepare(token(OWNER_B), "reserve", operation())
    session = db.connection(LOGIN)
    try:
        session.send("begin;"+signed_apply(g,a)+"commit;begin;"+signed_apply(g,b,token(OWNER_B))+"commit;\\echo BOTH_DONE")
        lines = session.until("BOTH_DONE")
        assert len([x for x in lines if len(x)==36 and x.count("-")==4]) == 2
        session.send("\\q")
        session.finish()
    finally:
        session.close()
    assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


def test_concurrent_shared_login_serializes_without_cross_account_leak(private_ready):
    db, g = private_ready, client(private_ready)
    a, b = g.prepare(token(), "reserve", operation()), g.prepare(token(OWNER_B), "reserve", operation())
    first, second = db.connection(LOGIN), db.connection(LOGIN)
    name = "private_notes_" + operation()
    try:
        first.send("begin;select 'PID:'||pg_backend_pid();"+signed_apply(g,a)+"\\echo HELD")
        held = first.until("HELD")
        pid = int(next(x[4:] for x in held if x.startswith("PID:")))
        first_id = next(x for x in held if len(x)==36 and x.count("-")==4)
        second.send(f"set application_name={quote(name)};"+signed_apply(g,b,token(OWNER_B))+"\\q")
        db.wait_for_blocker(second, name, pid)
        first.send("commit;\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish()
        second_id = next(x for x in second.log if len(x)==36 and x.count("-")==4)
        assert db.snapshot(first_id)["owner"] == OWNER_A
        assert db.snapshot(second_id)["owner"] == OWNER_B
        assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"
    finally:
        first.close()
        second.close()


def test_partial_failure_rolls_back_note_receipt_and_binding(private_ready):
    db, g = private_ready, client(private_ready)
    key = g.run(token(), "reserve", operation())
    before = db.snapshot(key)
    ctx = g.prepare(token(), "publish", "test-fail-after-note", note_id=key, payload=PAYLOAD)
    db.sql(signed_apply(g, ctx), LOGIN, "23514")
    assert db.snapshot(key) == before
    assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


@pytest.mark.parametrize("stage", ["shared_login", "identity"])
def test_expiry_during_observed_lock_wait_rolls_back_every_effect(private_ready, stage):
    db, g = private_ready, client(private_ready)
    key = g.run(token(), "reserve", operation()) if stage == "identity" else None
    snapshot = db.snapshot(key) if key else None
    count = db.sql(f"select count(*) from {SCHEMA}.identities;")
    # Short signed lease, without weakening any existing harness timeout.
    g.clock = lambda: time.time()-24
    ctx = g.prepare(token(), "publish" if key else "reserve", operation(),
                    note_id=key, payload=PAYLOAD if key else None)
    holder = db.connection("postgres" if key else LOGIN)
    waiter = db.connection(LOGIN)
    name = "private_expiry_" + operation()
    try:
        lock = (f"select id from {SCHEMA}.identities where id={quote(key)} for update;" if key else
                "select pg_advisory_xact_lock(hashtextextended('private-notes-binding:'||session_user,0));")
        holder.send("begin;select 'PID:'||pg_backend_pid();"+lock+"\\echo HELD")
        pid = int(next(x[4:] for x in holder.until("HELD") if x.startswith("PID:")))
        waiter.send(f"set application_name={quote(name)};"+signed_apply(g,ctx)+"\\q")
        db.wait_for_blocker(waiter,name,pid)
        # The lock dependency is observed first. Wait against the DB deadline,
        # then explicitly confirm that DB time passed it BEFORE releasing.
        holder.send(f"select pg_sleep(greatest(0,{ctx['expires']}-extract(epoch from clock_timestamp())+0.02));"
                    f"select (extract(epoch from clock_timestamp())>={ctx['expires']})::text;commit;\\echo RELEASED")
        assert "true" in holder.until("RELEASED")
        waiter.finish("AUTHORITY_EXPIRED")
        assert db.sql(f"select count(*) from {SCHEMA}.identities;") == count
        if key:
            assert db.snapshot(key) == snapshot
        assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"
    finally:
        holder.close()
        waiter.close()


def test_closed_authority_and_changed_context_are_denied(private_ready):
    db, g = private_ready, client(private_ready)
    ctx = g.prepare(token(), "reserve", operation())
    changed = dict(ctx, generation=ctx["generation"]+2)
    db.sql(signed_apply(g, changed), LOGIN, "CONTEXT_DENIED")
    db.sql(f"update {SCHEMA}.account_fences set state='CLOSED' where owner_id='{OWNER_A}';")
    db.sql(signed_apply(g, ctx), LOGIN, "ACCOUNT_AUTHORITY_UNAVAILABLE")
    assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


@pytest.mark.parametrize("statement", [
    "insert into public.notes(id,user_id,title,body,updated_at) values('x','"+OWNER_A+"','x','x',1);",
    "update public.notes set title='x';", "delete from public.notes;", "truncate public.notes;",
    f"select signing_key from {SCHEMA}.private_gateway_config;",
    f"delete from {SCHEMA}.private_contexts;",
    f"insert into {SCHEMA}.principal_bindings values(current_user,'{OWNER_B}',1);",
    f"select {SCHEMA}.reserve('bypass');",
    f"select {SCHEMA}.private_check('x',decode('00','hex'),'x');",
    "set role notes_candidate_owner;",
])
def test_restricted_role_cannot_bypass_gateway(private_ready, statement):
    private_ready.sql(statement, LOGIN, "42501")


@pytest.mark.parametrize("role", ["anon", "authenticated", "service_role", "notes_candidate_app"])
def test_browser_and_legacy_roles_have_no_private_execution(private_ready, role):
    db = private_ready
    assert db.sql(f"select has_function_privilege('{role}','{SCHEMA}.private_apply(text,bytea)','EXECUTE');") == "f"
    assert db.sql(f"select has_table_privilege('{role}','{SCHEMA}.private_gateway_config','SELECT');") == "f"
