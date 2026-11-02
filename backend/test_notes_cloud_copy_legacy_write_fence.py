"""Unapplied fence proof; real SQL cases reuse the no-network disposable harness.

No production DSN, credentials, Auth mutation or local Docker repair is accepted.
READ COMMITTED is an explicit candidate admission requirement, not a claim that
all external legacy consumers/isolation levels have been verified.
"""
import json
from pathlib import Path
import uuid

import pytest

from test_notes_identity_guard_candidate_postgres import (
    model_db, candidate, ready, proof_db, SCHEMA,
)
from test_notes_identity_private_gateway_postgres import (
    private_db, private_ready, client, signed_apply, LOGIN,
)
from test_notes_identity_postgres import PAYLOAD, quote
from test_notes_identity_private_gateway import token

ROOT = Path(__file__).parent
SQL = ROOT / "identity_candidates" / "notes_cloud_copy_legacy_write_fence.sql"


def test_fence_is_unapplied_without_activation_or_application_grants():
    source = SQL.read_text(encoding="utf-8").lower()
    assert SQL.parent.name == "identity_candidates"
    assert "unapplied, inactive test candidate" in source
    statements = "\n".join(line.split("--", 1)[0] for line in source.splitlines())
    for forbidden in ["create role", "grant ", "update notes_identity_candidate.readiness",
                      "alter table auth.", "delete from auth.", "create schema auth"]:
        assert forbidden not in statements
    assert "set search_path=pg_catalog" in source
    assert "fence_isolation_unsupported" in source


def test_permits_are_transaction_scoped_and_not_client_controlled():
    source = (SQL.parent / "notes_identity_guard.sql").read_text(encoding="utf-8")
    fence = SQL.read_text(encoding="utf-8")
    assert "create table notes_identity_candidate.note_write_permits" in source
    assert "(pg_backend_pid(),txid_current(),session_user,p_id,p_owner,'INSERT',p_payload)" in source
    assert "(pg_backend_pid(),txid_current(),session_user,p_id,p_owner,'DELETE','{}'::jsonb)" in source
    assert "login=session_user and note_id=new.id" in fence
    assert "returning true into accepted" in fence
    assert "current_setting('request." not in fence
    note_guard = fence.split("create function notes_identity_candidate.fence_note_write()")[1].split(
        "create function notes_identity_candidate.fence_note_truncate()")[0]
    assert "current_user" not in note_guard  # no trusted-role shortcut on Notes
    assert "language plpgsql security invoker" in fence
    assert "current_user <> 'notes_candidate_owner'" in fence  # mint-time identity


def test_same_id_lock_and_always_triggers_cover_replication_setting():
    source = (SQL.parent / "notes_identity_guard.sql").read_text(encoding="utf-8")
    fence = SQL.read_text(encoding="utf-8")
    assert "'notes-issued-id:' || issued" in source
    assert "'notes-issued-id:' || new.id" in fence
    assert fence.count("enable always trigger") == 10
    assert "pg_has_role(role_name,p.oid,'MEMBER')" in fence
    assert "perform notes_identity_candidate.assert_notes_write_boundary();" in fence
    assert "has_any_column_privilege" in fence


def test_existing_ci_registers_real_fence_module():
    ci = (ROOT.parent / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    command = next(line for line in ci.splitlines() if "test_notes_identity_guard_candidate_postgres.py" in line)
    assert "test_notes_cloud_copy_legacy_write_fence.py" in command
    assert "K323_POSTGRES_INTEGRATION: '1'" in ci


@pytest.fixture(scope="module")
def fenced_db(private_db):
    private_db.sql(SQL.read_text(encoding="utf-8"))
    # Synthetic grants only, after the original candidate installer. Real
    # effective roles (including BYPASSRLS) exercise the trigger, not RLS claims.
    private_db.sql("grant select,insert,update,delete,truncate on public.notes "
                   "to notes_candidate_app,anon,authenticated,service_role;")
    return private_db


@pytest.fixture
def fenced_ready(fenced_db, private_ready):
    yield fenced_db
    # Keep module tests independent without erasing history. Only the existing
    # authenticated lifecycle retires this disposable module's leftover copies.
    g = client(fenced_db)
    aliases = json.loads(fenced_db.sql(f"""select coalesce(json_agg(json_build_object(
      'owner',a.owner_id,'local',a.local_note_id,'cloud',a.cloud_note_id)),'[]'::json)
      from {SCHEMA}.cloud_aliases a join {SCHEMA}.identities i on i.id=a.cloud_note_id
      where i.state='LIVE';"""))
    for a in aliases:
        assert g.run(token(a["owner"]), "cloud_retire", op(),
                     local_note_id=a["local"], note_id=a["cloud"]) == "RETIRED"
    assert fenced_db.sql(f"select count(*) from {SCHEMA}.note_write_permits;") == "0"
    assert fenced_db.sql(f"select count(*) from {SCHEMA}.principal_bindings where login='{LOGIN}';") == "0"


def op():
    return uuid.uuid4().hex


def account(db):
    owner = str(uuid.uuid4())
    db.sql(f"insert into auth.users values('{owner}');"
           f"insert into {SCHEMA}.account_fences values('{owner}',1,'ACTIVE');")
    return owner


def copy(db, *, publish=True):
    owner, local = account(db), "local-" + op()
    g = client(db)
    cloud = g.run(token(owner), "cloud_reserve", op(), local_note_id=local)
    if publish:
        assert g.run(token(owner), "cloud_publish", op(), local_note_id=local,
                     note_id=cloud, payload=PAYLOAD) == "CREATED"
    return g, owner, local, cloud


def snapshot(db, owner, local, cloud):
    return json.loads(db.sql(f"""select json_build_object(
      'auth',(select to_jsonb(u) from auth.users u where id={quote(owner)}),
      'note',(select to_jsonb(n) from public.notes n where id={quote(cloud)}),
      'identity',(select to_jsonb(i) from {SCHEMA}.identities i where id={quote(cloud)}),
      'alias',(select to_jsonb(a) from {SCHEMA}.cloud_aliases a
        where owner_id={quote(owner)} and local_note_id={quote(local)}),
      'receipts',(select json_agg(to_jsonb(r) order by kind)
        from {SCHEMA}.receipts r where note_id={quote(cloud)}),
      'fence',(select to_jsonb(f) from {SCHEMA}.account_fences f where owner_id={quote(owner)}));"""))


def insert_note(key, owner):
    return f"insert into public.notes(id,user_id,title,body,updated_at) values({quote(key)},{quote(owner)},'legacy','body',1);"


def test_valid_restricted_gateway_and_permanent_retirement(fenced_ready):
    db = fenced_ready
    g, owner, local, cloud = copy(db)
    assert g.run(token(owner), "cloud_read", op(), local_note_id=local)["state"] == "LIVE"
    assert g.run(token(owner), "cloud_retire", op(), local_note_id=local, note_id=cloud) == "RETIRED"
    state = snapshot(db, owner, local, cloud)
    assert state["note"] is None and state["identity"]["state"] == "RETIRED"
    assert len(state["receipts"]) == 3 and state["alias"]["cloud_note_id"] == cloud
    db.sql(insert_note(cloud, owner), "notes_candidate_app", "PROTECTED_NOTE_MUTATION")
    assert snapshot(db, owner, local, cloud) == state


@pytest.mark.parametrize("role", ["notes_candidate_app", "anon", "authenticated", "service_role", "postgres"])
@pytest.mark.parametrize("operation", ["insert", "update", "owner", "rekey", "delete", "truncate"])
def test_effective_legacy_and_privileged_direct_dml_cannot_bypass(fenced_ready, role, operation):
    db = fenced_ready
    _, owner, local, cloud = copy(db)
    before = snapshot(db, owner, local, cloud)
    commands = {
        "insert": insert_note(cloud, owner),
        "update": f"update public.notes set body='changed' where id={quote(cloud)};",
        "owner": f"update public.notes set user_id={quote(account(db))} where id={quote(cloud)};",
        "rekey": f"update public.notes set id='legacy-{op()}' where id={quote(cloud)};",
        "delete": f"delete from public.notes where id={quote(cloud)};",
        "truncate": "truncate public.notes;",
    }
    # SET ROLE is performed only by the fixture administrator, not by a client.
    db.sql(f"set role {role};"+commands[operation],
           error="PROTECTED_NOTE_TRUNCATE" if operation == "truncate" else "PROTECTED_NOTE_MUTATION")
    assert snapshot(db, owner, local, cloud) == before


def test_legacy_crud_and_legacy_only_auth_deletion_are_preserved(fenced_ready):
    db, key = fenced_ready, "legacy-" + op()
    owner = account(db)
    before = db.sql(f"select count(*) from {SCHEMA}.receipts;")
    db.sql(insert_note(key, owner), "notes_candidate_app")
    db.sql(f"update public.notes set title='edited' where id={quote(key)};", "notes_candidate_app")
    assert db.sql(f"select title from public.notes where id={quote(key)};") == "edited"
    db.sql(f"delete from public.notes where id={quote(key)};", "notes_candidate_app")
    db.sql(insert_note(key, owner), "notes_candidate_app")
    db.sql(f"delete from auth.users where id={quote(owner)};")
    assert db.sql(f"select count(*) from public.notes where id={quote(key)};") == "0"
    assert db.sql(f"select count(*) from {SCHEMA}.receipts;") == before


def test_legacy_only_truncate_does_not_erase_retired_history(fenced_ready):
    db = fenced_ready
    g, owner, local, cloud = copy(db)
    g.run(token(owner), "cloud_retire", op(), local_note_id=local, note_id=cloud)
    before = snapshot(db, owner, local, cloud)
    db.sql(insert_note("legacy-" + op(), owner), "notes_candidate_app")
    db.sql("truncate public.notes;", "notes_candidate_app")
    assert snapshot(db, owner, local, cloud) == before


def test_protected_cascade_denial_rolls_back_all_rows_without_retirement(fenced_ready):
    db = fenced_ready
    _, owner, local, cloud = copy(db)
    legacy = "legacy-" + op()
    db.sql(insert_note(legacy, owner))
    before = snapshot(db, owner, local, cloud)
    # Preserve the pre-fence regression's exact unsafe-state oracle:
    # notes=0 + LIVE + only two receipts must NEVER become the committed result.
    db.sql(f"begin;update public.notes set title='partial' where id={quote(legacy)};"
           f"delete from auth.users where id={quote(owner)};commit;", error="PROTECTED_NOTE_MUTATION")
    after = snapshot(db, owner, local, cloud)
    assert after == before
    assert after["auth"] is not None and after["note"] is not None
    assert after["identity"]["state"] == "LIVE" and len(after["receipts"]) == 2
    assert after["fence"]["state"] == "ACTIVE"
    assert db.sql(f"select title from public.notes where id={quote(legacy)};") == "legacy"


def test_no_role_guc_parameter_or_private_table_forgery(fenced_ready):
    db = fenced_ready
    _, owner, local, cloud = copy(db)
    before = snapshot(db, owner, local, cloud)
    for sql in [
        "set role notes_candidate_owner;",
        "set session_replication_role=replica;",
        f"insert into {SCHEMA}.note_write_permits values(pg_backend_pid(),txid_current(),session_user,{quote(cloud)},{quote(owner)},'DELETE','{{}}');",
    ]:
        db.sql(sql, "notes_candidate_app", "42501")
    db.sql("set request.notes_lifecycle='true';"
           f"delete from public.notes where id={quote(cloud)};", "notes_candidate_app", "PROTECTED_NOTE_MUTATION")
    # Even administrator DML with replication triggers suppressed has no permit.
    db.sql("set session_replication_role=replica;"
           f"delete from public.notes where id={quote(cloud)};", error="PROTECTED_NOTE_MUTATION")
    assert snapshot(db, owner, local, cloud) == before


@pytest.mark.parametrize("indirect", [False, True])
def test_noinherit_set_role_permit_forgery_is_denied_at_admission_and_effect(fenced_ready, indirect):
    db = fenced_ready
    g, owner, local, cloud = copy(db)
    before = snapshot(db,owner,local,cloud)
    helper, bridge = "permit_"+op(), "bridge_"+op()
    db.sql(f"create role {helper} nologin noinherit;"
           f"grant usage on schema {SCHEMA} to {helper};"
           f"grant insert on {SCHEMA}.note_write_permits to {helper};")
    if indirect:
        db.sql(f"create role {bridge} nologin noinherit;grant {helper} to {bridge};")
    membership = bridge if indirect else helper
    db.sql(f"grant {membership} to notes_candidate_app;")
    try:
        # Effective privileges alone miss this deliberately NOINHERIT grant.
        assert db.sql(f"select has_table_privilege('notes_candidate_app','{SCHEMA}.note_write_permits','INSERT');") == "f"
        with pytest.raises(pytest.fail.Exception, match="LEGACY_FENCE_PRIVILEGES_UNVERIFIED"):
            g.run(token(owner),"cloud_read",op(),local_note_id=local)
        db.sql(f"begin;set role {helper};"
               f"insert into {SCHEMA}.note_write_permits values(pg_backend_pid(),txid_current(),"
               f"session_user,{quote(cloud)},{quote(owner)},'DELETE','{{}}');reset role;"
               f"delete from public.notes where id={quote(cloud)};commit;",
               "notes_candidate_app", "PERMIT_MINT_DENIED")
        assert snapshot(db,owner,local,cloud) == before
        assert db.sql(f"select count(*) from {SCHEMA}.note_write_permits;") == "0"
    finally:
        db.sql(f"revoke {membership} from notes_candidate_app;")
        if indirect:
            db.sql(f"revoke {helper} from {bridge};drop role {bridge};")
        db.sql(f"revoke all on {SCHEMA}.note_write_permits from {helper};"
               f"revoke usage on schema {SCHEMA} from {helper};drop role {helper};")


def test_admin_option_cannot_mint_then_revoke_membership_before_note_delete(fenced_ready):
    db = fenced_ready
    _, owner, local, cloud = copy(db)
    before = snapshot(db,owner,local,cloud)
    helper = "admin_permit_"+op()
    db.sql(f"create role {helper} nologin noinherit;"
           f"grant usage on schema {SCHEMA} to {helper};"
           f"grant insert on {SCHEMA}.note_write_permits to {helper};"
           f"grant {helper} to notes_candidate_app with admin option;")
    try:
        assert db.sql("select rolcreaterole from pg_roles where rolname='notes_candidate_app';") == "f"
        # If mint were allowed, self-revocation would erase the evidence used by
        # the effect-time privilege graph check. Denial must happen at INSERT.
        db.sql(f"begin;set role {helper};"
               f"insert into {SCHEMA}.note_write_permits values(pg_backend_pid(),txid_current(),"
               f"session_user,{quote(cloud)},{quote(owner)},'DELETE','{{}}');reset role;"
               f"revoke {helper} from notes_candidate_app;"
               f"delete from public.notes where id={quote(cloud)};commit;",
               "notes_candidate_app", "PERMIT_MINT_DENIED")
        # Independently prove the premise: ADMIN OPTION really can remove the
        # membership without CREATEROLE. No permit survived the failed mint.
        db.sql(f"revoke {helper} from notes_candidate_app;", "notes_candidate_app")
        assert db.sql(f"select pg_has_role('notes_candidate_app','{helper}','MEMBER');") == "f"
        assert db.sql(f"select count(*) from {SCHEMA}.note_write_permits;") == "0"
        db.sql(f"delete from public.notes where id={quote(cloud)};",
               "notes_candidate_app", "PROTECTED_NOTE_MUTATION")
        assert snapshot(db,owner,local,cloud) == before
    finally:
        db.sql(f"revoke {helper} from notes_candidate_app;"
               f"revoke all on {SCHEMA}.note_write_permits from {helper};"
               f"revoke usage on schema {SCHEMA} from {helper};drop role {helper};")


def test_set_role_owner_is_not_a_verified_private_gateway_invocation(fenced_ready):
    db = fenced_ready
    _, owner, local, cloud = copy(db)
    before = snapshot(db,owner,local,cloud)
    # A deliberately invalid disposable membership cannot change session_user.
    # Even effective owner authority is not a verified gateway invocation.
    db.sql("grant notes_candidate_owner to notes_candidate_app;")
    try:
        db.sql("begin;set role notes_candidate_owner;"
               f"insert into {SCHEMA}.note_write_permits values(pg_backend_pid(),txid_current(),"
               f"session_user,{quote(cloud)},{quote(owner)},'DELETE','{{}}');commit;",
               "notes_candidate_app", "PERMIT_MINT_DENIED")
        assert snapshot(db,owner,local,cloud) == before
        assert db.sql(f"select count(*) from {SCHEMA}.note_write_permits;") == "0"
    finally:
        db.sql("revoke notes_candidate_owner from notes_candidate_app;")


@pytest.mark.parametrize("table,error", [
    ("identities","IDENTITY_HISTORY_IMMUTABLE"),
    ("receipts","IDENTITY_HISTORY_IMMUTABLE"),
    ("cloud_aliases","IDENTITY_HISTORY_IMMUTABLE"),
])
def test_immutable_history_cannot_be_truncated_even_by_direct_owner_dml(fenced_ready, table, error):
    db = fenced_ready
    _, owner, local, cloud = copy(db)
    before = snapshot(db, owner, local, cloud)
    db.sql(f"truncate {SCHEMA}.{table} cascade;", error=error)
    assert snapshot(db, owner, local, cloud) == before


@pytest.mark.parametrize("table,error", [("receipts","RECEIPT_IMMUTABLE"),("cloud_aliases","CLOUD_ALIAS_IMMUTABLE")])
@pytest.mark.parametrize("operation", ["update","delete"])
def test_alias_and_receipt_rewrites_remain_denied(fenced_ready, table, error, operation):
    db = fenced_ready
    _, owner, local, cloud = copy(db)
    before = snapshot(db, owner, local, cloud)
    statement = (f"update {SCHEMA}.{table} set owner_id={quote(account(db))} where owner_id={quote(owner)};"
                 if operation == "update" else f"delete from {SCHEMA}.{table} where owner_id={quote(owner)};")
    db.sql("set session_replication_role=replica;"+statement, error=error)
    assert snapshot(db, owner, local, cloud) == before


def test_reserved_and_foreign_identity_writes_are_denied(fenced_ready):
    db = fenced_ready
    g, owner, local, cloud = copy(db, publish=False)
    before = snapshot(db, owner, local, cloud)
    foreign = account(db)
    db.sql(insert_note(cloud, foreign), "notes_candidate_app", "PROTECTED_NOTE_MUTATION")
    ctx = g.prepare(token(foreign), "cloud_publish", op(), local_note_id=local, note_id=cloud, payload=PAYLOAD)
    db.sql(signed_apply(g, ctx, token(foreign)), LOGIN, "CLOUD_ALIAS_UNAVAILABLE")
    assert snapshot(db, owner, local, cloud) == before


def test_failure_after_note_effect_rolls_back_permit_identity_and_receipt(fenced_ready):
    db = fenced_ready
    g, owner, local, cloud = copy(db, publish=False)
    before = snapshot(db, owner, local, cloud)
    ctx = g.prepare(token(owner), "cloud_publish", "test-fail-after-note",
                    local_note_id=local, note_id=cloud, payload=PAYLOAD)
    db.sql(signed_apply(g, ctx, token(owner)), LOGIN, "23514")
    assert snapshot(db, owner, local, cloud) == before
    assert db.sql(f"select count(*) from {SCHEMA}.note_write_permits;") == "0"


def test_default_off_and_damaged_fence_fail_before_lifecycle_effect(fenced_db, ready):
    db, g = fenced_db, client(fenced_db)
    owner = account(db)
    with pytest.raises(pytest.fail.Exception, match="CANDIDATE_NOT_ACTIVATED"):
        g.prepare(token(owner), "cloud_reserve", op(), local_note_id="off-"+op())
    db.sql(f"update {SCHEMA}.private_gateway_config set enabled=true;"
           f"update {SCHEMA}.cloud_copy_readiness set enabled=true;"
           "alter table public.notes disable trigger candidate_notes_write_fence;")
    try:
        with pytest.raises(pytest.fail.Exception, match="LEGACY_FENCE_UNVERIFIED"):
            g.run(token(owner), "cloud_reserve", op(), local_note_id="damaged-"+op())
    finally:
        db.sql("alter table public.notes enable always trigger candidate_notes_write_fence;")


@pytest.mark.parametrize("isolation", ["repeatable read","serializable"])
def test_old_snapshots_fail_closed_instead_of_missing_a_retired_identity(fenced_ready, isolation):
    db = fenced_ready
    session = db.connection("notes_candidate_app")
    try:
        session.send(f"begin isolation level {isolation};select count(*) from public.notes;\\echo SNAPSHOT")
        session.until("SNAPSHOT")
        g, owner, local, cloud = copy(db)
        g.run(token(owner), "cloud_retire", op(), local_note_id=local, note_id=cloud)
        before = snapshot(db,owner,local,cloud)
        session.send(insert_note(cloud,owner)+"\\q")
        session.finish("FENCE_ISOLATION_UNSUPPORTED")
        assert snapshot(db,owner,local,cloud) == before
    finally:
        session.close()


def test_concurrent_publication_and_legacy_insert_observe_same_id_lock(fenced_ready):
    db = fenced_ready
    g, owner, local, cloud = copy(db, publish=False)
    ctx = g.prepare(token(owner), "cloud_publish", op(), local_note_id=local, note_id=cloud, payload=PAYLOAD)
    first, second = db.connection(LOGIN), db.connection("notes_candidate_app")
    name = "fence_insert_" + op()
    try:
        first.send("begin;select 'PID:'||pg_backend_pid();"+signed_apply(g,ctx,token(owner))+"\\echo HELD")
        pid = int(next(x[4:] for x in first.until("HELD") if x.startswith("PID:")))
        second.send(f"set application_name={quote(name)};"+insert_note(cloud,owner)+"\\q")
        db.wait_for_blocker(second,name,pid)
        first.send("commit;\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish("PROTECTED_NOTE_MUTATION")
        after = snapshot(db,owner,local,cloud)
        assert after["identity"]["state"] == "LIVE" and after["note"]["body"] == PAYLOAD["body"]
        assert len(after["receipts"]) == 2
    finally:
        first.close()
        second.close()


def test_retirement_first_allows_waiting_auth_delete_only_after_commit(fenced_ready):
    db = fenced_ready
    g, owner, local, cloud = copy(db)
    before = snapshot(db,owner,local,cloud)
    ctx = g.prepare(token(owner), "cloud_retire", op(), local_note_id=local, note_id=cloud)
    first, second = db.connection(LOGIN), db.connection("postgres")
    name = "fence_auth_" + op()
    try:
        first.send("begin;select 'PID:'||pg_backend_pid();"+signed_apply(g,ctx,token(owner))+"\\echo HELD")
        pid = int(next(x[4:] for x in first.until("HELD") if x.startswith("PID:")))
        second.send(f"set application_name={quote(name)};delete from auth.users where id={quote(owner)};\\q")
        db.wait_for_blocker(second,name,pid)
        first.send("commit;\\echo COMMITTED")
        first.until("COMMITTED")
        second.finish()
        after = snapshot(db,owner,local,cloud)
        assert after["auth"] is None and after["note"] is None
        assert after["identity"]["state"] == "RETIRED" and len(after["receipts"]) == 3
        assert after["alias"] == before["alias"] and after["fence"] == before["fence"]
    finally:
        first.close()
        second.close()


def test_cascade_first_denies_without_waiting_on_retirements_identity_lock(fenced_ready):
    db = fenced_ready
    g, owner, local, cloud = copy(db)
    ctx = g.prepare(token(owner), "cloud_retire", op(), local_note_id=local, note_id=cloud)
    first, second = db.connection("postgres"), db.connection(LOGIN)
    name = "fence_retire_" + op()
    try:
        first.send("begin;select 'PID:'||pg_backend_pid();"
                   f"select id from public.notes where id={quote(cloud)} for update;\\echo HELD")
        pid = int(next(x[4:] for x in first.until("HELD") if x.startswith("PID:")))
        second.send(f"set application_name={quote(name)};"+signed_apply(g,ctx,token(owner))+"\\q")
        db.wait_for_blocker(second,name,pid)
        first.send(f"delete from auth.users where id={quote(owner)};\\q")
        first.finish("PROTECTED_NOTE_MUTATION")
        second.finish()
        after = snapshot(db,owner,local,cloud)
        assert after["auth"] is not None and after["note"] is None
        assert after["identity"]["state"] == "RETIRED" and len(after["receipts"]) == 3
    finally:
        first.close()
        second.close()
