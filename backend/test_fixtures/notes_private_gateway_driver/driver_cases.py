"""Explicitly invoked ONLY inside the disposable PostgreSQL/driver test image.

Actual candidate calls, JWT fixtures and psycopg connections; not a fake driver.
Synthetic post-commit exit injection proves lack of acknowledgement, NOT rollback.
No TLS, external pool, remote Supabase or production credentials are tested.
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import json
import time
import uuid

import psycopg
from psycopg.pq import TransactionStatus
import pytest

from identity_candidates.notes_private_gateway import CALLS, GatewayDenied, PrivateGateway, PsycopgCalls
from test_notes_identity_private_gateway import OWNER_A, OWNER_B, token, verifier

SCHEMA = "notes_identity_candidate"
LOGIN = "notes_candidate_private_gateway"
# Populated on stdin by the host coordinator, never from owner environment/DSN.
SIGNING_KEY = None
PAYLOAD = None


def operation():
    return uuid.uuid4().hex


def connect(*, admin=False, name="notes-driver-proof", cls=psycopg.Connection):
    return cls.connect(host="127.0.0.1", port=5432, dbname="postgres",
                       user="postgres" if admin else LOGIN,
                       password="rel05e-test" if admin else "synthetic-only",
                       sslmode="disable", connect_timeout=5, application_name=name)


class RecordingConnection(psycopg.Connection):
    def execute(self, query, params=None, **kwargs):
        if query in CALLS.values():
            self.dispatches += 1
        return super().execute(query, params, **kwargs)


class Factory:
    """Per-test recorder, NOT a pool or production transport configuration."""
    def __init__(self, name="notes-driver-proof"):
        self.connections = []
        self.name = name

    @contextmanager
    def __call__(self):
        conn = connect(name=self.name, cls=RecordingConnection)
        conn.dispatches = 0
        conn.proof_pid, conn.proof_user = conn.info.backend_pid, conn.info.user
        self.connections.append(conn)
        with conn:
            yield conn


def gateway(factory=None, **kwargs):
    return PrivateGateway(verifier(), PsycopgCalls(factory or Factory()), SIGNING_KEY, enabled=True, **kwargs)


def read(sql, params=()):
    with connect(admin=True) as c:
        return c.execute(sql, params).fetchone()[0]


def snapshot(key):
    return read(f"""select jsonb_build_object(
        'owner',(select owner_id from {SCHEMA}.identities where id=%s),
        'state',(select state from {SCHEMA}.identities where id=%s),
        'payload',(select jsonb_build_object('title',title,'body',body,'updated_at',updated_at,'starred',starred)
                   from public.notes where id=%s),
        'receipts',(select count(*) from {SCHEMA}.receipts where note_id=%s))""", (key,)*4)


def receipts(op):
    return read(f"select count(*) from {SCHEMA}.receipts where operation_id=%s", (op,))


@pytest.fixture(autouse=True)
def no_surviving_binding():
    assert type(SIGNING_KEY) is bytes and len(SIGNING_KEY) == 32
    assert type(PAYLOAD) is dict
    sql = f"select count(*) from {SCHEMA}.principal_bindings where login=%s"
    assert read(sql, (LOGIN,)) == 0
    yield
    assert read(sql, (LOGIN,)) == 0


def test_real_versions_principal_and_success_closes_connections():
    f = Factory()
    g = gateway(f)
    key = g.run(token(), "reserve", operation())
    assert str(uuid.UUID(key)) == key and snapshot(key)["owner"] == OWNER_A
    assert len(f.connections) == 2
    assert all(c.closed and c.dispatches == 1 and c.proof_user == LOGIN for c in f.connections)
    with connect() as c:
        assert c.execute("select session_user,current_user").fetchone() == (LOGIN, LOGIN)
        assert c.execute("select rolsuper or rolbypassrls or rolcreaterole or rolcreatedb from pg_roles where rolname=current_user").fetchone() == (False,)
    assert c.closed
    assert psycopg.__version__ == "3.2.13"
    version = read("select current_setting('server_version_num')::int")
    assert version == 150019
    print("REAL_DRIVER_VERSIONS=" + json.dumps(dict(psycopg=psycopg.__version__, postgres=version,
                                                    libpq=psycopg.pq.version(), principal=LOGIN)))


def test_lifecycle_unknown_retired_ids_and_exact_replay():
    g = gateway()
    key = g.run(token(), "reserve", operation())
    op = operation()
    ctx = g.prepare(token(), "publish", op, note_id=key, payload=PAYLOAD)
    assert g.apply(token(), ctx) == "CREATED"
    assert snapshot(key)["payload"] == PAYLOAD and receipts(op) == 1
    assert g.apply(token(), ctx) == "REPLAY_LIVE"
    assert receipts(op) == 1
    assert g.run(token(), "retire", operation(), note_id=key) == "RETIRED"
    before = snapshot(key)
    for target in (key, "unknown-history-" + operation()):
        with pytest.raises(GatewayDenied, match="DATABASE_DENIED"):
            g.run(token(), "publish", operation(), note_id=target, payload=PAYLOAD)
    assert snapshot(key) == before
    assert before["state"] == "RETIRED" and before["payload"] is None


def test_default_off_and_bad_auth_never_connect():
    f = Factory()
    g = PrivateGateway(verifier(), PsycopgCalls(f), SIGNING_KEY)
    with pytest.raises(GatewayDenied, match="NOT_ACTIVATED"):
        g.prepare(token(), "reserve", operation())
    g.enabled = True
    with pytest.raises(GatewayDenied, match="AUTHENTICATION_DENIED"):
        g.prepare("malformed", "reserve", operation())
    assert not f.connections


def test_actual_shared_connection_reuse_across_a_b_a():
    conn = connect(cls=RecordingConnection)
    conn.dispatches = 0
    pid = conn.info.backend_pid

    @contextmanager
    def borrow():
        assert conn.info.transaction_status == TransactionStatus.IDLE
        yield conn
        assert conn.info.transaction_status == TransactionStatus.IDLE

    try:
        g = gateway(borrow)
        for owner in (OWNER_A, OWNER_B, OWNER_A):
            key = g.run(token(owner), "reserve", operation())
            assert snapshot(key)["owner"] == owner
            assert conn.info.backend_pid == pid and not conn.closed
            assert read(f"select count(*) from {SCHEMA}.principal_bindings where login=%s", (LOGIN,)) == 0
        assert conn.dispatches == 6
    finally:
        conn.close()
    assert conn.closed


def test_foreign_context_and_foreign_identity_fail_without_mutation():
    f, g = Factory(), gateway()
    key = g.run(token(), "reserve", operation())
    before = snapshot(key)
    other = gateway(f)
    ctx = g.prepare(token(), "publish", operation(), note_id=key, payload=PAYLOAD)
    with pytest.raises(GatewayDenied, match="CONTEXT_ACCOUNT_MISMATCH"):
        other.apply(token(OWNER_B), ctx)
    assert not f.connections
    with pytest.raises(GatewayDenied, match="DATABASE_DENIED"):
        other.run(token(OWNER_B), "publish", operation(), note_id=key, payload=PAYLOAD)
    assert snapshot(key) == before


def test_concurrent_real_connections_wait_and_keep_exact_accounts():
    g = gateway()
    contexts = [g.prepare(token(owner), "reserve", operation()) for owner in (OWNER_A, OWNER_B)]
    name = "driver-" + operation()
    f = Factory(name)
    worker = gateway(f)
    with ThreadPoolExecutor(max_workers=2) as executor:
        with connect(admin=True) as holder:
            pid = holder.info.backend_pid
            holder.execute("select pg_advisory_xact_lock(hashtextextended(%s,0))", ("private-notes-binding:"+LOGIN,))
            jobs = [executor.submit(worker.apply, token(owner), ctx) for owner, ctx in zip((OWNER_A, OWNER_B), contexts)]
            deadline = time.monotonic()+15
            while True:
                count = read("""select count(*) from pg_stat_activity where application_name=%s
                    and wait_event_type='Lock' and (cardinality(pg_blocking_pids(pid))>0)""", (name,))
                if count == 2:
                    break
                assert time.monotonic() < deadline, "two actual lock waiters were not observed"
                assert not any(job.done() for job in jobs)
                time.sleep(0.02)
            assert read("select count(*) from pg_stat_activity where pid=%s and state='idle in transaction'", (pid,)) == 1
        keys = [job.result(timeout=15) for job in jobs]
    assert [snapshot(key)["owner"] for key in keys] == [OWNER_A, OWNER_B]
    assert len({c.proof_pid for c in f.connections}) == 2
    assert all(c.closed and c.dispatches == 1 for c in f.connections)


def test_stale_generation_context_is_not_rebound():
    g = gateway()
    op = operation()
    ctx = g.prepare(token(), "reserve", op)
    before = read(f"select count(*) from {SCHEMA}.identities")
    try:
        with connect(admin=True) as c:
            c.execute(f"update {SCHEMA}.account_fences set generation=3 where owner_id=%s", (OWNER_A,))
        assert g.prepare(token(), "reserve", op) == ctx
        with pytest.raises(GatewayDenied, match="DATABASE_DENIED"):
            g.apply(token(), ctx)
        assert read(f"select count(*) from {SCHEMA}.identities") == before
        fresh = g.prepare(token(), "reserve", operation())
        assert fresh["generation"] == 3
        assert snapshot(g.apply(token(), fresh))["owner"] == OWNER_A
    finally:
        with connect(admin=True) as c:
            c.execute(f"update {SCHEMA}.account_fences set generation=1 where owner_id=%s", (OWNER_A,))


def test_expired_signed_authority_is_denied_by_real_database():
    g = gateway(clock=lambda: time.time()-28)
    ctx = g.prepare(token(), "reserve", operation())
    before = read(f"select count(*) from {SCHEMA}.identities")
    with connect(admin=True) as c:
        c.execute("select pg_sleep(greatest(0,%s-extract(epoch from clock_timestamp())+0.02))", (ctx["expires"],))
        assert c.execute("select extract(epoch from clock_timestamp()) >= %s", (ctx["expires"],)).fetchone() == (True,)
    # Test clock still permits dispatch: the actual DB clock rejects the MAC lease.
    with pytest.raises(GatewayDenied, match="DATABASE_DENIED"):
        g.apply(token(), ctx)
    assert read(f"select count(*) from {SCHEMA}.identities") == before
    assert receipts(ctx["intent"]["operation_id"]) == 0


def test_sql_failure_is_known_rollback_and_never_acknowledged():
    g = gateway()
    key = g.run(token(), "reserve", operation())
    before = snapshot(key)
    ctx = g.prepare(token(), "publish", "test-fail-after-note", note_id=key, payload=PAYLOAD)
    f = Factory()
    with pytest.raises(GatewayDenied, match="DATABASE_DENIED"):
        gateway(f).apply(token(), ctx)
    assert snapshot(key) == before and receipts("test-fail-after-note") == 0
    assert len(f.connections) == 1 and f.connections[0].closed and f.connections[0].dispatches == 1


def test_actual_deferred_commit_failure_rolls_back_all_effects():
    g = gateway()
    key, op = g.run(token(), "reserve", operation()), operation()
    before = snapshot(key)
    ctx = g.prepare(token(), "publish", op, note_id=key, payload=PAYLOAD)
    with connect(admin=True) as c:
        c.execute(f"""create function {SCHEMA}.driver_fail_commit() returns trigger language plpgsql as $$
          begin raise exception 'synthetic deferred commit failure' using errcode='23514'; end $$;
          create constraint trigger driver_fail_commit after insert on {SCHEMA}.receipts
          deferrable initially deferred for each row execute function {SCHEMA}.driver_fail_commit();""")
    f = Factory()
    try:
        with pytest.raises(GatewayDenied, match="DATABASE_DENIED"):
            gateway(f).apply(token(), ctx)
        assert snapshot(key) == before and receipts(op) == 0
        assert len(f.connections) == 1 and f.connections[0].closed and f.connections[0].dispatches == 1
    finally:
        with connect(admin=True) as c:
            c.execute(f"drop trigger driver_fail_commit on {SCHEMA}.receipts; drop function {SCHEMA}.driver_fail_commit();")


def test_postcommit_exit_failure_is_ambiguous_not_a_rollback_or_retry():
    g = gateway()
    key, op = g.run(token(), "reserve", operation()), operation()
    ctx = g.prepare(token(), "publish", op, note_id=key, payload=PAYLOAD)
    f = Factory()

    @contextmanager
    def fail_after_real_commit_and_close():
        with f() as c:
            yield c
        assert c.closed
        raise ConnectionError("synthetic loss AFTER real commit and connection close")

    with pytest.raises(GatewayDenied, match="DATABASE_DENIED"):
        gateway(fail_after_real_commit_and_close).apply(token(), ctx)
    assert len(f.connections) == 1 and f.connections[0].dispatches == 1
    # Caller received no success. Independent readback proves this case committed.
    assert snapshot(key)["payload"] == PAYLOAD and receipts(op) == 1
    assert g.apply(token(), ctx) == "REPLAY_LIVE"  # Explicit exact replay, not an automatic retry.
    assert receipts(op) == 1


def test_connection_failure_is_before_dispatch_and_not_retried():
    calls = []

    def unavailable():
        calls.append("connect")
        raise ConnectionError("synthetic connection acquisition failure")

    before = read(f"select count(*) from {SCHEMA}.private_contexts")
    with pytest.raises(GatewayDenied, match="DATABASE_DENIED"):
        gateway(unavailable).prepare(token(), "reserve", operation())
    assert calls == ["connect"]
    assert read(f"select count(*) from {SCHEMA}.private_contexts") == before


def test_real_nonidle_connection_is_denied_before_candidate_dispatch():
    c = connect(cls=RecordingConnection)
    c.dispatches = 0
    c.execute("select 1")
    assert c.info.transaction_status == TransactionStatus.INTRANS

    @contextmanager
    def nonidle():
        with c:
            yield c

    before = read(f"select count(*) from {SCHEMA}.private_contexts")
    with pytest.raises(GatewayDenied, match="TRANSPORT_NOT_IDLE"):
        gateway(nonidle).prepare(token(), "reserve", operation())
    assert c.closed and c.dispatches == 0
    assert read(f"select count(*) from {SCHEMA}.private_contexts") == before


@pytest.mark.parametrize("statement", [
    "insert into public.notes(id,user_id,title,body,updated_at) values('x','"+OWNER_A+"','x','x',1)",
    "update public.notes set title='x'",
    f"update {SCHEMA}.identities set state='LIVE'",
    f"delete from {SCHEMA}.receipts",
    f"select signing_key from {SCHEMA}.private_gateway_config",
    "truncate public.notes",
])
def test_real_restricted_principal_cannot_directly_mutate_or_read_keys(statement):
    before = (read("select count(*) from public.notes"), read(f"select count(*) from {SCHEMA}.identities"),
              read(f"select count(*) from {SCHEMA}.receipts"))
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with connect() as c:
            c.execute(statement)
    assert c.closed
    assert (read("select count(*) from public.notes"), read(f"select count(*) from {SCHEMA}.identities"),
            read(f"select count(*) from {SCHEMA}.receipts")) == before
