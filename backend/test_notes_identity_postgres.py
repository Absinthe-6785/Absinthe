"""Test-only Notes identity proof. PostgreSQL results require K323_POSTGRES_INTEGRATION=1.

No DSN, production URL, port binding or host volume is accepted. Login roles model
a trusted backend/account binding, NOT production Supabase JWT verification.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import threading
import time
import uuid

import pytest

from test_remote_mutation_v2_postgres import (
    POSTGRES_TEST_PASSWORD,
    _assert_postgres_success,
    _postgres_psql_command,
    _run,
    _wait_for_postgres,
)

ROOT = Path(__file__).parent
FIXTURE = ROOT / "test_fixtures" / "notes_identity_contract.sql"
SCHEMA = "notes_identity_proof"
OWNER_A = "11111111-1111-4111-8111-111111111111"
OWNER_B = "22222222-2222-4222-8222-222222222222"
PAYLOAD = {"title": "같은 제목 / 同じ題名", "body": "Synthetic original", "updated_at": 1, "starred": False}
ROLES = {"postgres", "proof_a", "proof_b", "proof_issuer"}


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def publish_sql(note_id: str, operation: str | None = None, payload: dict | None = None) -> str:
    encoded = json.dumps(PAYLOAD if payload is None else payload, ensure_ascii=False)
    operation = "op:" + note_id if operation is None else operation
    return f"select {SCHEMA}.publish({quote(note_id)}, {quote(operation)}, {quote(encoded)}::jsonb);"


def retire_sql(note_id: str) -> str:
    return f"select {SCHEMA}.retire({quote(note_id)});"


def command(docker: str, name: str, role: str) -> list[str]:
    if role not in ROLES:
        raise ValueError("unapproved synthetic role")
    result = _postgres_psql_command(docker, name)
    result[result.index("-U") + 1] = role
    if role != "postgres":
        result = ["PGPASSWORD=synthetic-only" if x.startswith("PGPASSWORD=") else x for x in result]
    return result + ["-X", "-q", "-A", "-t", "-v", "VERBOSITY=verbose"]


class Session:
    """A real independent psql connection, with bounded stdout barriers."""

    def __init__(self, cmd: list[str]):
        self.process = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, encoding="utf-8",
        )
        self.lines: queue.Queue[str | None] = queue.Queue()
        self.log: list[str] = []

        def drain() -> None:
            assert self.process.stdout is not None
            for line in self.process.stdout:
                self.lines.put(line.rstrip())
            self.lines.put(None)

        threading.Thread(target=drain, daemon=True).start()

    def send(self, sql: str) -> None:
        assert self.process.stdin is not None
        self.process.stdin.write(sql + "\n")
        self.process.stdin.flush()

    def until(self, marker: str, timeout: float = 15) -> list[str]:
        end = time.monotonic() + timeout
        found: list[str] = []
        while True:
            remaining = end - time.monotonic()
            if remaining <= 0:
                pytest.fail(f"missing psql barrier {marker}: {self.log}")
            try:
                line = self.lines.get(timeout=remaining)
            except queue.Empty:
                pytest.fail(f"missing psql barrier {marker}: {self.log}")
            if line is None:
                pytest.fail(f"psql exited before {marker}: {self.log}")
            self.log.append(line)
            found.append(line)
            if line == marker:
                return found

    def finish(self, error: str | None = None) -> None:
        self.process.wait(timeout=15)
        while True:
            line = self.lines.get(timeout=5)
            if line is None:
                break
            self.log.append(line)
        output = "\n".join(self.log)
        if error:
            assert self.process.returncode != 0, output
            assert error in output, output
        else:
            assert self.process.returncode == 0, output

    def close(self) -> None:
        if self.process.poll() is None:
            try:
                self.send("rollback;\n\\q")
                self.process.wait(timeout=5)
            except (BrokenPipeError, OSError, subprocess.TimeoutExpired):
                self.process.terminate()
                self.process.wait(timeout=5)


class Database:
    def __init__(self, docker: str, name: str):
        self.docker, self.name = docker, name

    def sql(self, sql: str, role: str = "postgres", error: str | None = None) -> str:
        result = _run(command(self.docker, self.name, role) + ["-c", sql], timeout=20, encoding="utf-8")
        if error:
            assert result.returncode != 0, result.stdout
            assert error in result.stderr, result.stderr
        else:
            _assert_postgres_success(result, self.docker, self.name)
        return result.stdout.strip()

    def reserve(self, owner: str = OWNER_A) -> str:
        note_id = "fresh:" + uuid.uuid4().hex
        assert self.sql(f"select {SCHEMA}.reserve({quote(note_id)}, {quote(owner)});", "proof_issuer") == "RESERVED"
        return note_id

    def snapshot(self, note_id: str) -> dict:
        key = quote(note_id)
        result = self.sql(f"""
select json_build_object(
 'state', (select state from {SCHEMA}.identities where id={key}),
 'owner', (select owner_id from {SCHEMA}.identities where id={key}),
 'notes', (select count(*) from {SCHEMA}.notes where id={key}),
 'payload', (select payload from {SCHEMA}.notes where id={key}),
 'receipts', (select count(*) from {SCHEMA}.receipts where note_id={key}),
 'receipt_payload', (select payload from {SCHEMA}.receipts where note_id={key}),
 'digest', (select digest from {SCHEMA}.receipts where note_id={key}),
 'inserts', (select count(*) from {SCHEMA}.insert_audit where id={key})
);""")
        return json.loads(result)

    def assert_state(self, note_id: str, state: str, notes: int, receipts: int, inserts: int,
                     owner: str = OWNER_A) -> dict:
        actual = self.snapshot(note_id)
        assert (actual["state"], actual["owner"], actual["notes"], actual["receipts"], actual["inserts"]) == (
            state, owner, notes, receipts, inserts,
        ), actual
        assert actual["payload"] == (PAYLOAD if notes else None)
        assert actual["receipt_payload"] == (PAYLOAD if receipts else None)
        if receipts:
            assert isinstance(actual["digest"], str) and len(actual["digest"]) == 64
        else:
            assert actual["digest"] is None
        return actual

    def connection(self, role: str = "proof_a") -> Session:
        return Session(command(self.docker, self.name, role))

    def wait_for_blocker(self, waiter: Session, name: str, blocker_pid: int) -> None:
        # Observe the actual lock dependency, NOT a sleep/elapsed-time inference.
        end = time.monotonic() + 15
        while time.monotonic() < end:
            assert waiter.process.poll() is None, waiter.log
            count = self.sql(f"""select count(*) from pg_stat_activity
where application_name={quote(name)} and wait_event_type='Lock'
and {blocker_pid}=any(pg_blocking_pids(pid));""")
            if count == "1":
                return
            time.sleep(0.02)  # bounded polling backoff, never used to order transactions
        pytest.fail(f"waiter never blocked on expected PostgreSQL connection {blocker_pid}")


def cleanup_container(docker: str, name: str, original_error: BaseException | None = None) -> None:
    """Remove only this proof's labelled disposable container; preserve setup errors."""
    try:
        inspected = _run([
            docker, "container", "inspect", "--format",
            '{{ index .Config.Labels "absinthe.test" }}', name,
        ], timeout=20)
        if inspected.returncode != 0:
            if any(f"{message}: {name}" in inspected.stderr
                   for message in ("No such container", "No such object")):
                return
            raise RuntimeError(f"proof container inspection failed: {inspected.stderr}")
        if inspected.stdout.strip() != "notes-identity-proof":
            raise RuntimeError("refusing to remove container without the proof ownership label")
        removed = _run([docker, "rm", "--force", name], timeout=20)
        if removed.returncode != 0:
            raise RuntimeError(f"proof container cleanup failed: {removed.stderr}")
    except Exception as cleanup_error:
        if original_error is None:
            raise
        original_error.add_note(f"Additional disposable-container cleanup failure: {cleanup_error}")


@pytest.fixture(scope="module")
def db(request):
    if os.getenv("K323_POSTGRES_INTEGRATION") != "1":
        pytest.skip("real PostgreSQL proof: enable K323_POSTGRES_INTEGRATION=1 in existing CI")
    docker = shutil.which("docker")
    if docker is None:
        pytest.fail("K323_POSTGRES_INTEGRATION=1 but docker is unavailable")
    name = "absinthe-notes-proof-" + uuid.uuid4().hex[:12]
    try:
        result = _run([
            docker, "run", "--detach", "--name", name,
            "--label", "absinthe.test=notes-identity-proof", "--network", "none",
            "--tmpfs", "/var/lib/postgresql/data", "-e",
            f"POSTGRES_PASSWORD={POSTGRES_TEST_PASSWORD}",
            # Only this dedicated module uses the prebuilt Python/driver image.
            # All existing SQL proofs keep their original image and assertions.
            "absinthe-notes-private-driver:test" if request.module.__name__.split(".")[-1]
            == "test_notes_private_gateway_driver_harness" else "postgres:15-alpine",
        ], timeout=120)
        _assert_postgres_success(result, docker, name)
        _wait_for_postgres(docker, name)
        database = Database(docker, name)
        database.sql(FIXTURE.read_text(encoding="utf-8"))
        yield database
    finally:
        # docker run can create a container even when startup fails or times out.
        cleanup_container(docker, name, sys.exc_info()[1])


def test_local_psql_command_is_loopback_only_and_uses_distinct_logins():
    a = command("docker", "synthetic-container", "proof_a")
    b = command("docker", "synthetic-container", "proof_b")
    assert a[a.index("-h") + 1] == b[b.index("-h") + 1] == "127.0.0.1"
    assert a[a.index("-U") + 1] == "proof_a"
    assert b[b.index("-U") + 1] == "proof_b"
    assert a[a.index("-d") + 1] == "postgres"
    assert "PGPASSWORD=synthetic-only" in a and "ON_ERROR_STOP=1" in a
    with pytest.raises(ValueError, match="unapproved"):
        command("docker", "synthetic-container", "external-user")


def test_local_fixture_is_not_a_production_migration():
    assert FIXTURE.parent.name == "test_fixtures"
    assert FIXTURE.is_file()
    assert "TEST ONLY" in FIXTURE.read_text(encoding="utf-8")


@pytest.mark.parametrize("scenario", ["missing", "owned", "foreign", "failed", "original-error"])
def test_local_cleanup_ownership_and_failure_reporting(monkeypatch, scenario):
    # Mock only the process-cleanup helper, never PostgreSQL contract behavior.
    calls = []
    name = "absinthe-notes-proof-synthetic"

    def run(cmd, **kwargs):
        calls.append(cmd)
        if cmd[1] == "container":
            if scenario == "missing":
                return subprocess.CompletedProcess(cmd, 1, "", f"No such container: {name}")
            return subprocess.CompletedProcess(cmd, 0,
                "other-container" if scenario == "foreign" else "notes-identity-proof", "")
        return subprocess.CompletedProcess(cmd, int(scenario in {"failed", "original-error"}), "", "cleanup error")

    monkeypatch.setattr(sys.modules[__name__], "_run", run)
    original = RuntimeError("original docker startup failure") if scenario == "original-error" else None
    if scenario in {"foreign", "failed"}:
        with pytest.raises(RuntimeError):
            cleanup_container("docker", name, original)
    else:
        cleanup_container("docker", name, original)
    assert len(calls) == (1 if scenario in {"missing", "foreign"} else 2)
    if original:
        assert str(original) == "original docker startup failure"
        assert "cleanup failure" in original.__notes__[0]


@pytest.mark.parametrize("same_operation", [True, False])
def test_concurrent_publications_serialize_on_identity_and_commit_one_insert(db, same_operation):
    note_id = db.reserve()
    first, second = db.connection(), db.connection()
    waiter_name = "publication_" + uuid.uuid4().hex
    try:
        first.send("begin;\nselect 'PID:'||pg_backend_pid();\n" + publish_sql(note_id) + "\n\\echo HELD")
        output = first.until("HELD")
        pid = int(next(x[4:] for x in output if x.startswith("PID:")))
        second.send(f"set application_name={quote(waiter_name)};\n" +
                    publish_sql(note_id, None if same_operation else "other:" + note_id) + "\n\\q")
        db.wait_for_blocker(second, waiter_name, pid)
        first.send("commit;\n\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish(None if same_operation else "IDENTITY_UNAVAILABLE")
        assert ("REPLAY_LIVE" if same_operation else "IDENTITY_UNAVAILABLE") in "\n".join(second.log)
        db.assert_state(note_id, "LIVE", 1, 1, 1)
    finally:
        first.close()
        second.close()


@pytest.mark.parametrize("publication_first", [True, False])
def test_publication_retirement_race_in_both_commit_orders(db, publication_first):
    note_id = db.reserve()
    first, second = db.connection(), db.connection()
    waiter_name = "retirement_" + uuid.uuid4().hex
    initial = publish_sql(note_id) if publication_first else retire_sql(note_id)
    following = retire_sql(note_id) if publication_first else publish_sql(note_id)
    try:
        first.send("begin;\nselect 'PID:'||pg_backend_pid();\n" + initial + "\n\\echo HELD")
        output = first.until("HELD")
        pid = int(next(x[4:] for x in output if x.startswith("PID:")))
        second.send(f"set application_name={quote(waiter_name)};\n" + following + "\n\\q")
        db.wait_for_blocker(second, waiter_name, pid)
        first.send("commit;\n\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish(None if publication_first else "IDENTITY_UNAVAILABLE")
        db.assert_state(note_id, "RETIRED", 0, int(publication_first), int(publication_first))
        if publication_first:
            assert db.sql(publish_sql(note_id), "proof_a") == "APPLIED_THEN_RETIRED"
        db.sql(publish_sql(note_id, "new-op"), "proof_a", "IDENTITY_UNAVAILABLE")
        db.assert_state(note_id, "RETIRED", 0, int(publication_first), int(publication_first))
    finally:
        first.close()
        second.close()


def test_same_operation_racing_different_id_rolls_back_loser_completely(db):
    first_id, second_id = db.reserve(), db.reserve()
    operation = "shared:" + uuid.uuid4().hex
    first, second = db.connection(), db.connection()
    waiter_name = "receipt_" + uuid.uuid4().hex
    try:
        first.send("begin;\nselect 'PID:'||pg_backend_pid();\n" +
                   publish_sql(first_id, operation) + "\n\\echo HELD")
        output = first.until("HELD")
        pid = int(next(x[4:] for x in output if x.startswith("PID:")))
        second.send(f"set application_name={quote(waiter_name)};\n" +
                    publish_sql(second_id, operation) + "\n\\q")
        db.wait_for_blocker(second, waiter_name, pid)
        first.send("commit;\n\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish("OPERATION_CONFLICT")
        db.assert_state(first_id, "LIVE", 1, 1, 1)
        db.assert_state(second_id, "RESERVED", 0, 0, 0)
    finally:
        first.close()
        second.close()


def test_reserved_retirement_is_terminal_before_any_publication(db):
    note_id = db.reserve()
    assert db.sql(retire_sql(note_id), "proof_a") == "RETIRED"
    assert db.sql(retire_sql(note_id), "proof_a") == "ALREADY_RETIRED"
    db.sql(publish_sql(note_id), "proof_a", "IDENTITY_UNAVAILABLE")
    db.assert_state(note_id, "RETIRED", 0, 0, 0)


def test_precommit_rollback_includes_identity_note_receipt_and_insert_audit(db):
    note_id = db.reserve()
    db.sql("begin;" + publish_sql(note_id) + "rollback;", "proof_a")
    db.assert_state(note_id, "RESERVED", 0, 0, 0)
    # Failure at receipt insertion occurs AFTER identity and Note mutations.
    db.sql(publish_sql(note_id, "fault-before-receipt"), "proof_a", "23514")
    db.assert_state(note_id, "RESERVED", 0, 0, 0)
    assert db.sql(publish_sql(note_id), "proof_a") == "CREATED"
    db.assert_state(note_id, "LIVE", 1, 1, 1)
    db.sql("begin;" + retire_sql(note_id) + "rollback;", "proof_a")
    db.assert_state(note_id, "LIVE", 1, 1, 1)


def test_lost_response_exact_retry_and_changed_retry_do_not_mutate(db):
    note_id = db.reserve()
    db.sql(publish_sql(note_id), "proof_a")  # Simulate losing this committed response.
    before = db.assert_state(note_id, "LIVE", 1, 1, 1)
    assert db.sql(publish_sql(note_id), "proof_a") == "REPLAY_LIVE"
    db.sql(publish_sql(note_id, payload={**PAYLOAD, "body": "changed"}), "proof_a", "OPERATION_CONFLICT")
    db.sql(publish_sql(note_id, "different-op"), "proof_a", "IDENTITY_UNAVAILABLE")
    assert db.snapshot(note_id) == before
    assert db.sql(retire_sql(note_id), "proof_a") == "RETIRED"
    retired = db.assert_state(note_id, "RETIRED", 0, 1, 1)
    assert db.sql(publish_sql(note_id), "proof_a") == "APPLIED_THEN_RETIRED"
    assert db.snapshot(note_id) == retired


def test_partial_success_then_failure_keeps_each_committed_state(db):
    first, second = db.reserve(), db.reserve()
    db.sql(publish_sql(first), "proof_a")
    db.sql("begin;" + publish_sql(second, "second-op") + "select 1/0;commit;", "proof_a", "22012")
    db.assert_state(first, "LIVE", 1, 1, 1)
    db.assert_state(second, "RESERVED", 0, 0, 0)
    db.sql(publish_sql(second, "op:" + first), "proof_a", "OPERATION_CONFLICT")
    db.assert_state(second, "RESERVED", 0, 0, 0)


def test_duplicate_titles_preserve_distinct_ids(db):
    first, second = db.reserve(), db.reserve()
    db.sql(publish_sql(first, "first-" + first), "proof_a")
    db.sql(publish_sql(second, "second-" + second), "proof_a")
    assert first != second
    db.assert_state(first, "LIVE", 1, 1, 1)
    db.assert_state(second, "LIVE", 1, 1, 1)


def test_global_collision_foreign_disclosure_and_untrusted_reservation(db):
    note_id = db.reserve()
    db.sql(publish_sql(note_id), "proof_a")
    before = db.snapshot(note_id)
    db.sql(f"select {SCHEMA}.reserve({quote(note_id)}, {quote(OWNER_B)});", "proof_issuer", "IDENTITY_UNAVAILABLE")
    db.sql(f"select {SCHEMA}.reserve('fresh:untrusted', {quote(OWNER_A)});", "proof_a", "42501")
    for sql in (publish_sql(note_id), retire_sql(note_id), f"select {SCHEMA}.read_note({quote(note_id)});"):
        db.sql(sql, "proof_b", "IDENTITY_UNAVAILABLE")
    db.sql(f"set request.jwt.claim.sub={quote(OWNER_A)};select {SCHEMA}.read_note({quote(note_id)});",
           "proof_b", "IDENTITY_UNAVAILABLE")
    db.sql("set role proof_owner;", "proof_a", "42501")
    db.sql("set session authorization proof_b;", "proof_a", "42501")
    assert json.loads(db.sql(f"select {SCHEMA}.read_note({quote(note_id)});", "proof_a")) == {
        "state": "LIVE", "payload": PAYLOAD,
    }
    assert db.snapshot(note_id) == before


@pytest.mark.parametrize("key", ["historic:unknown", "fresh:unissued"])
def test_missing_row_is_not_admission(db, key):
    db.sql(publish_sql(key), "proof_a", "IDENTITY_UNAVAILABLE")
    assert db.snapshot(key) == dict(state=None, owner=None, notes=0, payload=None,
                                   receipts=0, receipt_payload=None, digest=None, inserts=0)


@pytest.mark.parametrize("extra", [
    {"properties": {"tag": "keep"}}, {"relations": {"Related": ["other"]}},
    {"folder_id": "unproven-folder"}, {"attachmentOriginals": ["local-only"]}, {"history": ["old"]},
])
def test_unsupported_metadata_is_rejected_without_mutation(db, extra):
    note_id = db.reserve()
    db.sql(publish_sql(note_id, payload={**PAYLOAD, **extra}), "proof_a", "UNSUPPORTED_PAYLOAD")
    db.assert_state(note_id, "RESERVED", 0, 0, 0)


@pytest.mark.parametrize("mutation", [
    "insert into {s}.notes values ({id}, '{owner}', '{{}}');",
    "update {s}.notes set payload='{{}}' where id={id};",
    "delete from {s}.notes where id={id};",
    "insert into {s}.notes values ({id}, '{owner}', '{{}}') on conflict(id) do update set payload='{{}}';",
    "update {s}.identities set state='RESERVED' where id={id};",
    "insert into {s}.receipts values ('{owner}','forged',{id},'digest','{{}}');",
    "truncate {s}.notes;",
    "select * from {s}.receipts;",
])
def test_application_direct_write_and_private_read_bypass_are_denied(db, mutation):
    note_id = db.reserve()
    db.sql(publish_sql(note_id), "proof_a")
    before = db.snapshot(note_id)
    db.sql(mutation.format(s=SCHEMA, id=quote(note_id), owner=OWNER_A), "proof_a", "42501")
    assert db.snapshot(note_id) == before


def test_receipt_and_retired_identity_integrity_including_owner_role(db):
    note_id = db.reserve()
    db.sql(publish_sql(note_id), "proof_a")
    db.sql(retire_sql(note_id), "proof_a")
    before = db.snapshot(note_id)
    for mutation, message in [
        (f"update {SCHEMA}.receipts set digest='changed' where note_id={quote(note_id)};", "RECEIPT_IMMUTABLE"),
        (f"delete from {SCHEMA}.receipts where note_id={quote(note_id)};", "RECEIPT_IMMUTABLE"),
        (f"update {SCHEMA}.identities set state='LIVE' where id={quote(note_id)};", "IDENTITY_IMMUTABLE"),
        (f"update {SCHEMA}.identities set owner_id='{OWNER_B}' where id={quote(note_id)};", "IDENTITY_IMMUTABLE"),
        (f"delete from {SCHEMA}.identities where id={quote(note_id)};", "IDENTITY_IMMUTABLE"),
    ]:
        db.sql("set role proof_owner;" + mutation, error=message)
        assert db.snapshot(note_id) == before


def test_database_owner_is_explicitly_outside_application_protection(db):
    # Deliberately demonstrate a privileged owner bypass, NOT a safety pass for
    # production service-role/direct-DML access. No production role is tested.
    note_id = "admin:" + uuid.uuid4().hex
    encoded = quote(json.dumps(PAYLOAD, ensure_ascii=False))
    db.sql(f"""set role proof_owner;
insert into {SCHEMA}.identities values ({quote(note_id)}, '{OWNER_A}', 'RESERVED');
update {SCHEMA}.identities set state='LIVE' where id={quote(note_id)};
insert into {SCHEMA}.notes values ({quote(note_id)}, '{OWNER_A}', {encoded}::jsonb);""")
    actual = db.snapshot(note_id)
    assert actual["state"] == "LIVE" and actual["notes"] == actual["inserts"] == 1
    assert actual["receipts"] == 0
