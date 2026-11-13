"""Unapplied fence proof; real SQL cases reuse the no-network disposable harness.

No production DSN, credentials, Auth mutation or local Docker repair is accepted.
READ COMMITTED is an explicit candidate admission requirement, not a claim that
all external legacy consumers/isolation levels have been verified.
"""
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import uuid

import pytest

from test_notes_identity_guard_candidate_postgres import (
    model_db, candidate, ready, proof_db, SCHEMA,
)
from test_notes_identity_private_gateway_postgres import (
    private_db, private_ready, client, signed_apply, LOGIN, PrivateDatabase,
)
from test_notes_identity_postgres import (
    PAYLOAD, quote, db as privilege_proof_db, db as pgrst_proof_db,
    db as compatibility_proof_db, proof_image, OWNER_A, OWNER_B,
)
from test_notes_identity_private_gateway import token

ROOT = Path(__file__).parent
SQL = ROOT / "identity_candidates" / "notes_cloud_copy_legacy_write_fence.sql"

# NOTES-DB-TRIGGER-PRIVILEGE-CUTOVER-01: reviewable FUTURE operation, not a
# migration, installer, runtime import, or permission to execute in production.
# Production requires fresh dependency approval and an exclusive administrative
# permission/role/DDL change window. The relation lock does NOT serialize role
# catalogs or guarantee that another administrator cannot regrant after COMMIT.
# No Note content is inspected by this transaction; row preservation is checked
# independently below, using synthetic data only.
# The provider exception is pinned to the read-only observed deployment, not a
# name/prefix/owner allowlist. A provider/PG upgrade or replacement requires a new
# contract decision. Before/after checks do NOT defeat concurrent privileged
# replacement-and-restoration (ABA); the exclusive admin change window is still
# mandatory. No production execution or automatic compensating GRANT is approved.
TRIGGER_PRIVILEGE_CUTOVER_SQL = r"""
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL search_path = pg_catalog;
DO $cutover$
DECLARE
  relation_oid oid := to_regclass('public.notes');
  owner_oid oid;
  targets oid[];
  before_state jsonb;
  after_state jsonb;
  invariant_query text := $snapshot$
    SELECT jsonb_build_object(
      'relation', (SELECT jsonb_build_array(c.oid,c.relname,c.relnamespace,c.relowner,
        c.relkind,c.relpersistence,c.relrowsecurity,c.relforcerowsecurity,
        c.relispartition,c.reloptions) FROM pg_class c WHERE c.oid=$1),
      'columns', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attnum)
        FROM pg_attribute a WHERE a.attrelid=$1),
      'constraints', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid)
        FROM pg_constraint c WHERE c.conrelid=$1 OR c.confrelid=$1),
      'indexes', (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.indexrelid)
        FROM pg_index i WHERE i.indrelid=$1),
      'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid)
        FROM pg_policy p WHERE p.polrelid=$1),
      'triggers', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid)
        FROM pg_trigger t WHERE t.tgrelid=$1),
      'acl_except_target_trigger', (SELECT jsonb_agg(to_jsonb(a)
          ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
        FROM pg_class c CROSS JOIN LATERAL
          aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
        WHERE c.oid=$1 AND NOT (a.grantee=ANY($2) AND a.privilege_type='TRIGGER')),
      'other_effective_privileges', (SELECT jsonb_agg(jsonb_build_array(r.oid,
          p.privilege_type,has_table_privilege(r.oid,$1,p.privilege_type))
          ORDER BY r.oid,p.privilege_type)
        FROM pg_roles r CROSS JOIN pg_class c CROSS JOIN LATERAL
          aclexplode(acldefault('r',c.relowner)) p
        WHERE c.oid=$1 AND NOT (r.oid=ANY($2) AND p.privilege_type='TRIGGER')),
      'roles', (SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,
          rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) ORDER BY oid)
        FROM pg_roles),
      'memberships', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor)
        FROM pg_auth_members m),
      'event_triggers', (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.oid) FROM pg_event_trigger e),
      'default_acl', (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d)
    )
  $snapshot$;
BEGIN
  SELECT c.relowner INTO owner_oid FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.oid=relation_oid AND n.nspname='public' AND c.relname='notes'
      AND c.relkind='r' AND c.relpersistence='p' AND NOT c.relispartition
      AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')
      AND c.relrowsecurity AND NOT c.relforcerowsecurity;
  IF NOT FOUND OR current_user<>'postgres' THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_RELATION_OR_EXECUTOR_DRIFT';
  END IF;
  LOCK TABLE public.notes IN ACCESS EXCLUSIVE MODE NOWAIT;
  IF to_regclass('public.notes') IS DISTINCT FROM relation_oid
    OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=relation_oid AND relowner=owner_oid
      AND relkind='r' AND relpersistence='p' AND relrowsecurity
      AND NOT relforcerowsecurity AND NOT relispartition)
    OR EXISTS(SELECT 1 FROM pg_inherits
      WHERE inhrelid=relation_oid OR inhparent=relation_oid) THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_RELATION_DRIFT';
  END IF;
  SELECT array_agg(oid ORDER BY oid) INTO targets FROM pg_roles
    WHERE rolname IN ('anon','authenticated','service_role');
  IF cardinality(targets) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_ROLES_MISSING';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles root CROSS JOIN pg_roles reachable
      WHERE root.oid=ANY(targets)
        AND (root.oid=reachable.oid OR pg_has_role(root.oid,reachable.oid,'MEMBER'))
        AND (reachable.oid=owner_oid OR reachable.rolsuper OR reachable.rolcreaterole
          OR reachable.rolcreatedb OR reachable.rolreplication
          OR (reachable.oid<>root.oid
            AND has_table_privilege(reachable.oid,relation_oid,'TRIGGER')))) THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_ROLE_AUTHORITY_DRIFT';
  END IF;
  IF (SELECT count(*) FROM pg_class c CROSS JOIN LATERAL
        aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=relation_oid AND a.grantee=ANY(targets)
        AND a.privilege_type='TRIGGER' AND a.grantor=owner_oid
        AND NOT a.is_grantable) <> 3
    OR EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL
        aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=relation_oid AND a.privilege_type='TRIGGER'
        AND (a.grantor<>owner_oid OR a.is_grantable
          OR (a.grantee<>owner_oid AND NOT a.grantee=ANY(targets)))) THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_DIRECT_GRANT_DRIFT';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN
      unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p
      WHERE r.oid=ANY(targets) AND NOT has_table_privilege(r.oid,relation_oid,p))
    OR EXISTS(SELECT 1 FROM pg_roles r WHERE r.oid=ANY(targets)
      AND has_table_privilege(r.oid,relation_oid,'TRUNCATE')) THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_OTHER_PRIVILEGE_DRIFT';
  END IF;
  -- REVOKE can fire DDL event triggers in this SAME transaction/session.
  -- Catalog equality alone cannot detect their arbitrary user-data effects.
  -- Conservatively reject origin/replica/always-enabled matching handlers,
  -- regardless of this session's replication setting. Never disable a handler.
  IF EXISTS(SELECT 1 FROM pg_event_trigger
      WHERE evtenabled<>'D' AND evtevent IN ('ddl_command_start','ddl_command_end')
        AND (evttags IS NULL OR 'REVOKE'=ANY(evttags))) THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_DDL_SIDE_EFFECT_UNPROVEN';
  END IF;
  EXECUTE invariant_query INTO before_state USING relation_oid,targets;

  REVOKE TRIGGER ON TABLE public.notes FROM anon, authenticated, service_role RESTRICT;

  IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.oid=ANY(targets)
      AND has_table_privilege(r.oid,relation_oid,'TRIGGER')) THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_AUTHORITY_REMAINS';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL
      aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=relation_oid AND a.grantee=ANY(targets)
        AND a.privilege_type='TRIGGER') THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_ACL_REMAINS';
  END IF;
  EXECUTE invariant_query INTO after_state USING relation_oid,targets;
  IF after_state IS DISTINCT FROM before_state THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_UNEXPECTED_EFFECT';
  END IF;
END
$cutover$;
COMMIT;
"""

# Separately reviewable proposal. The approved original above remains byte-exact.
# Fixed source transformations have no caller/environment inputs; any anchor
# drift raises before producing SQL. Never execute either artifact on import.
def _pgrst_cutover_proposal():
    sql = TRIGGER_PRIVILEGE_CUTOVER_SQL
    for old, new in (
        (r"""  invariant_query text := $snapshot$""", r"""  expected_event_oid oid := 16576;
  expected_function_oid oid := 16563;
  expected_helper_oid oid := 4568;
  pgrst_before jsonb;
  pgrst_after jsonb;
  pgrst_query text := $provider$
    SELECT jsonb_build_object('event',to_jsonb(e),'function',to_jsonb(p),
      'helper',to_jsonb(h),'language',to_jsonb(l),'helper_language',to_jsonb(hl),
      'server_version',current_setting('server_version_num'))
    FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid
      JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
      JOIN pg_proc h ON h.oid=$3 JOIN pg_namespace hn ON hn.oid=h.pronamespace
      JOIN pg_language hl ON hl.oid=h.prolang
    WHERE current_setting('server_version_num')='170006'
      AND e.oid=$1 AND e.evtname='pgrst_ddl_watch' AND e.evtevent='ddl_command_end'
      AND e.evtenabled='O' AND e.evttags IS NULL
      AND p.oid=$2 AND p.oid=to_regprocedure('extensions.pgrst_ddl_watch()')
      AND n.nspname='extensions' AND p.proname='pgrst_ddl_watch'
      AND e.evtowner=p.proowner AND pg_get_userbyid(p.proowner)='supabase_admin'
      AND l.lanname='plpgsql' AND p.prokind='f' AND p.pronargs=0
      AND p.prorettype='pg_catalog.event_trigger'::regtype AND NOT p.proretset
      AND NOT p.prosecdef AND NOT p.proisstrict AND p.provolatile='v'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=
        'de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0'
      AND encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')=
        '2b4b5d702ddf70fbd1a05c9825f9f9016d5c0ef97dd3df5f5b012ea23d9b94b1'
      AND h.oid='pg_catalog.pg_event_trigger_ddl_commands()'::regprocedure
      AND hn.nspname='pg_catalog' AND h.proname='pg_event_trigger_ddl_commands'
      AND pg_get_userbyid(h.proowner)='supabase_admin' AND hl.lanname='internal'
      AND h.prokind='f' AND h.pronargs=0 AND h.prorettype='pg_catalog.record'::regtype
      AND h.proretset AND NOT h.prosecdef AND h.provolatile='s'
      AND h.proconfig IS NULL AND h.prosrc='pg_event_trigger_ddl_commands'
  $provider$;
  invariant_query text := $snapshot$"""),
        (r"""  -- REVOKE can fire DDL event triggers in this SAME transaction/session.
  -- Catalog equality alone cannot detect their arbitrary user-data effects.
  -- Conservatively reject origin/replica/always-enabled matching handlers,
  -- regardless of this session's replication setting. Never disable a handler.
  IF EXISTS(SELECT 1 FROM pg_event_trigger
      WHERE evtenabled<>'D' AND evtevent IN ('ddl_command_start','ddl_command_end')
        AND (evttags IS NULL OR 'REVOKE'=ANY(evttags))) THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_DDL_SIDE_EFFECT_UNPROVEN';
  END IF;
""", r"""  -- The exact deployed provider body reads DDL metadata and only notifies for
  -- its fixed CREATE/ALTER/COMMENT list; REVOKE is NOT in that list. Accept no
  -- other body, owner, binding, execution mode, helper, search path or version.
  EXECUTE pgrst_query INTO pgrst_before
    USING expected_event_oid,expected_function_oid,expected_helper_oid;
  IF pgrst_before IS NULL THEN RAISE EXCEPTION 'NOTES_TRIGGER_PGRST_PIN_DRIFT'; END IF;
  -- Every other matching origin/replica/always handler remains denied. No
  -- handler is disabled, rewritten, or exempted merely because it is provider-owned.
  IF EXISTS(SELECT 1 FROM pg_event_trigger
      WHERE evtenabled<>'D' AND evtevent IN ('ddl_command_start','ddl_command_end')
        AND (evttags IS NULL OR 'REVOKE'=ANY(evttags))
        AND NOT (pgrst_before IS NOT NULL AND oid=expected_event_oid AND evtfoid=expected_function_oid)) THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_DDL_SIDE_EFFECT_UNPROVEN';
  END IF;
"""),
        (r"""  EXECUTE invariant_query INTO after_state USING relation_oid,targets;""", r"""  EXECUTE pgrst_query INTO pgrst_after
    USING expected_event_oid,expected_function_oid,expected_helper_oid;
  IF pgrst_after IS DISTINCT FROM pgrst_before THEN
    RAISE EXCEPTION 'NOTES_TRIGGER_PGRST_STATE_CHANGED';
  END IF;
  EXECUTE invariant_query INTO after_state USING relation_oid,targets;"""),
    ):
        if sql.count(old) != 1:
            raise ValueError("cutover proposal anchor drift")
        sql = sql.replace(old, new, 1)
    return sql


PGRST_TRIGGER_PRIVILEGE_CUTOVER_SQL = _pgrst_cutover_proposal()



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


TRIGGER_REVOKE = "REVOKE TRIGGER ON TABLE public.notes FROM anon, authenticated, service_role RESTRICT;"
TRIGGER_ROLES = ("anon", "authenticated", "service_role")


def test_trigger_cutover_artifact_is_one_transaction_with_one_exact_revoke():
    statements = "\n".join(line.split("--", 1)[0] for line in TRIGGER_PRIVILEGE_CUTOVER_SQL.splitlines())
    assert statements.count(TRIGGER_REVOKE) == statements.count("REVOKE ") == 1
    assert statements.strip().startswith("BEGIN ISOLATION LEVEL READ COMMITTED;")
    assert statements.strip().endswith("COMMIT;")
    assert "ACCESS EXCLUSIVE MODE NOWAIT" in statements
    for forbidden in ("CASCADE", "GRANT ", "ALTER ", "CREATE ", "INSERT ", "UPDATE ", "DELETE ",
                      "SET ROLE", "EXCEPTION WHEN", "notes_identity_candidate"):
        assert forbidden not in statements
    for check in ("DIRECT_GRANT_DRIFT", "ROLE_AUTHORITY_DRIFT", "OTHER_PRIVILEGE_DRIFT",
                  "DDL_SIDE_EFFECT_UNPROVEN", "AUTHORITY_REMAINS", "ACL_REMAINS", "UNEXPECTED_EFFECT"):
        assert "NOTES_TRIGGER_" + check in statements


@contextmanager
def _trigger_privilege_case(db):
    # Caller selects a separately named instance of the SAME disposable fixture.
    # Never share the public.notes/roles installed by model_db/fenced_db.
    assert db.sql("select to_regclass('public.notes') is null "
                  "and to_regnamespace('notes_identity_candidate') is null;") == "t"
    assert db.sql("select count(*) from pg_roles where rolname in "
                  "('anon','authenticated','service_role','trigger_cutover_parent','trigger_cutover_child');") == "0"
    db.sql(f"""
      create role anon nologin nosuperuser nobypassrls;
      create role authenticated nologin nosuperuser nobypassrls;
      create role service_role nologin nosuperuser bypassrls;
      create role trigger_cutover_parent nologin;
      create role trigger_cutover_child nologin;
      create table public.notes(id text primary key,user_id uuid not null,
        title text not null,body text not null);
      alter table public.notes enable row level security;
      create policy cutover_owner on public.notes for all
        using(user_id=nullif(current_setting('test.owner',true),'')::uuid)
        with check(user_id=nullif(current_setting('test.owner',true),'')::uuid);
      insert into public.notes values
        ('a','{OWNER_A}','Original A','Original body'),
        ('b','{OWNER_B}','Original B','Other account');
      grant select,insert,update,delete,references,trigger on public.notes
        to anon,authenticated,service_role;
      create function public.trigger_cutover_existing() returns trigger language plpgsql as $$
        begin if new.title='blocked-by-existing-trigger' then
          raise exception 'EXISTING_TRIGGER_STILL_ACTIVE'; end if; return new; end $$;
      create trigger cutover_existing before insert or update on public.notes
        for each row execute function public.trigger_cutover_existing();
    """)
    try:
        yield db
    finally:
        # Only fixed synthetic objects inside the labelled disposable container.
        # No production connection, arbitrary identifier, or host cleanup path.
        db.sql("drop event trigger if exists cutover_ddl_effect;"
               "drop function if exists public.trigger_cutover_ddl_effect();"
               "drop table public.notes;drop function public.trigger_cutover_existing();"
               "drop role if exists anon,authenticated,service_role,trigger_cutover_parent,trigger_cutover_child;")
        assert db.sql("select to_regclass('public.notes') is null "
                      "and to_regnamespace('notes_identity_candidate') is null;") == "t"


@pytest.fixture
def trigger_privilege_case(privilege_proof_db):
    with _trigger_privilege_case(privilege_proof_db) as db:
        yield db


def trigger_privilege_snapshot(db):
    # Independent full ACL/data oracle: unlike the SQL's internal invariant
    # snapshot, do NOT exclude the intended changes here.
    return json.loads(db.sql("""select jsonb_build_object(
      'acl',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantee),
        pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
        order by a.grantee,a.grantor,a.privilege_type,a.is_grantable)
        from pg_class c cross join lateral aclexplode(c.relacl) a
        where c.oid='public.notes'::regclass),
      'effective',(select jsonb_agg(jsonb_build_array(r.rolname,p,
        has_table_privilege(r.oid,'public.notes',p)) order by r.rolname,p)
        from pg_roles r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE',
          'TRUNCATE','REFERENCES','TRIGGER']) p),
      'owner_rls',(select jsonb_build_array(relowner,relrowsecurity,relforcerowsecurity)
        from pg_class where oid='public.notes'::regclass),
      'columns',(select jsonb_agg(to_jsonb(a) order by attnum) from pg_attribute a
        where attrelid='public.notes'::regclass),
      'constraints',(select jsonb_agg(to_jsonb(c) order by oid) from pg_constraint c
        where conrelid='public.notes'::regclass),
      'policies',(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p
        where polrelid='public.notes'::regclass),
      'triggers',(select jsonb_agg(to_jsonb(t) order by oid) from pg_trigger t
        where tgrelid='public.notes'::regclass),
      'rows',(select jsonb_agg(to_jsonb(n) order by id) from public.notes n),
      'roles',(select jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,
        rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) order by oid) from pg_roles),
      'memberships',(select jsonb_agg(to_jsonb(m) order by roleid,member,grantor) from pg_auth_members m),
      'event_triggers',(select jsonb_agg(to_jsonb(e) order by oid) from pg_event_trigger e),
      'pgrst_functions',(select jsonb_agg(to_jsonb(p) order by oid) from pg_proc p
        where p.oid=to_regprocedure('extensions.pgrst_ddl_watch()')
          or p.oid='pg_catalog.pg_event_trigger_ddl_commands()'::regprocedure),
      'default_acl',(select jsonb_agg(to_jsonb(d) order by oid) from pg_default_acl d));"""))


def assert_trigger_only_delta(before, after):
    expected = dict(before)
    expected['acl'] = [a for a in before['acl'] if not (a[0] in TRIGGER_ROLES and a[2] == 'TRIGGER')]
    expected['effective'] = [[r, p, False if r in TRIGGER_ROLES and p == 'TRIGGER' else value]
                             for r, p, value in before['effective']]
    assert after == expected


def ordinary_notes_crud(db, role):
    # SET ROLE is fixture-admin-only. The actual SQL permission check uses the
    # affected current_user, with an independently existing RLS account scope.
    return db.sql(f"""begin;set local role {role};set local test.owner='{OWNER_A}';
      insert into public.notes values('new','{OWNER_A}','Created','New body');
      update public.notes set title='Edited' where id='new' and user_id='{OWNER_A}';
      select title from public.notes where id='new';
      delete from public.notes where id='new' and user_id='{OWNER_A}';
      select count(*) from public.notes where user_id='{OWNER_B}';
      rollback;""").splitlines()


@pytest.mark.parametrize('role', TRIGGER_ROLES)
def test_trigger_only_cutover_preserves_crud_rls_data_and_existing_trigger(trigger_privilege_case, role):
    db = trigger_privilege_case
    before = trigger_privilege_snapshot(db)
    # Positive control: CREATE TRIGGER really worked before the cutover.
    db.sql(f"begin;set local role {role};create trigger cutover_can_create before insert on public.notes "
           "for each row execute function public.trigger_cutover_existing();rollback;")
    expected_crud = ['Edited', '1' if role == 'service_role' else '0']
    assert ordinary_notes_crud(db, role) == expected_crud
    db.sql(TRIGGER_PRIVILEGE_CUTOVER_SQL)
    assert_trigger_only_delta(before, trigger_privilege_snapshot(db))
    db.sql(f"begin;set local role {role};create trigger cutover_cannot_create before insert on public.notes "
           "for each row execute function public.trigger_cutover_existing();commit;", error='42501')
    assert ordinary_notes_crud(db, role) == expected_crud
    db.sql(f"begin;set local role {role};set local test.owner='{OWNER_A}';"
           "update public.notes set title='blocked-by-existing-trigger' where id='a';commit;",
           error='EXISTING_TRIGGER_STILL_ACTIVE')
    assert_trigger_only_delta(before, trigger_privilege_snapshot(db))


@pytest.mark.parametrize('drift,error', [
    ("revoke trigger on public.notes from anon;", 'DIRECT_GRANT_DRIFT'),
    ("grant trigger on public.notes to PUBLIC;", 'DIRECT_GRANT_DRIFT'),
    ("grant trigger on public.notes to trigger_cutover_parent;"
     "grant trigger_cutover_parent to authenticated;", 'ROLE_AUTHORITY_DRIFT'),
    ("alter role authenticated noinherit;grant trigger on public.notes to trigger_cutover_parent;"
     "grant trigger_cutover_parent to authenticated;", 'ROLE_AUTHORITY_DRIFT'),
    ("grant postgres to authenticated;", 'ROLE_AUTHORITY_DRIFT'),
    ("alter table public.notes owner to anon;", 'RELATION_OR_EXECUTOR_DRIFT'),
    ("alter role anon superuser;", 'ROLE_AUTHORITY_DRIFT'),
    ("grant trigger on public.notes to anon with grant option;set role anon;"
     "grant trigger on public.notes to trigger_cutover_child;reset role;", 'DIRECT_GRANT_DRIFT'),
    ("grant trigger on public.notes to trigger_cutover_child;", 'DIRECT_GRANT_DRIFT'),
    ("revoke all on public.notes from anon;drop role anon;", 'ROLES_MISSING'),
    ("revoke update on public.notes from authenticated;", 'OTHER_PRIVILEGE_DRIFT'),
    ("grant truncate on public.notes to service_role;", 'OTHER_PRIVILEGE_DRIFT'),
    # Another inheriting role's effective TRIGGER cannot be silently removed.
    ("grant authenticated to trigger_cutover_child;", 'UNEXPECTED_EFFECT'),
])
def test_trigger_cutover_drift_aborts_without_partial_revoke(trigger_privilege_case, drift, error):
    db = trigger_privilege_case
    db.sql(drift)
    before = trigger_privilege_snapshot(db)
    db.sql(TRIGGER_PRIVILEGE_CUTOVER_SQL, error='NOTES_TRIGGER_' + error)
    assert trigger_privilege_snapshot(db) == before


@pytest.mark.parametrize('fault', ('missing_revoke', 'forced_post_failure', 'extra_update_revoke'))
def test_trigger_cutover_postcondition_faults_roll_back_all_acl_changes(trigger_privilege_case, fault):
    db = trigger_privilege_case
    before = trigger_privilege_snapshot(db)
    if fault == 'missing_revoke':
        broken = TRIGGER_PRIVILEGE_CUTOVER_SQL.replace(TRIGGER_REVOKE, '')
        error = 'NOTES_TRIGGER_AUTHORITY_REMAINS'
    elif fault == 'extra_update_revoke':
        broken = TRIGGER_PRIVILEGE_CUTOVER_SQL.replace(TRIGGER_REVOKE,
            TRIGGER_REVOKE + '\nREVOKE UPDATE ON TABLE public.notes FROM anon RESTRICT;')
        error = 'NOTES_TRIGGER_UNEXPECTED_EFFECT'
    else:
        broken = TRIGGER_PRIVILEGE_CUTOVER_SQL.replace(TRIGGER_REVOKE,
            TRIGGER_REVOKE + "\nRAISE EXCEPTION 'TEST_FORCED_POST_FAILURE';")
        error = 'TEST_FORCED_POST_FAILURE'
    assert broken != TRIGGER_PRIVILEGE_CUTOVER_SQL
    db.sql(broken, error=error)
    assert trigger_privilege_snapshot(db) == before


def install_cutover_event_trigger(db, event, tags, enabled):
    # Fixed synthetic DDL only; no arbitrary production identifier or function.
    assert event in ('ddl_command_start', 'ddl_command_end')
    assert tags in ('', "when tag in ('REVOKE')", "when tag in ('CREATE TABLE')")
    assert enabled in ('enable', 'enable always', 'enable replica', 'disable')
    db.sql("create function public.trigger_cutover_ddl_effect() returns event_trigger "
           "language plpgsql as $$begin update public.notes set body='event-trigger-mutated';end $$;"
           f"create event trigger cutover_ddl_effect on {event} {tags} "
           "execute function public.trigger_cutover_ddl_effect();"
           f"alter event trigger cutover_ddl_effect {enabled};")


@pytest.mark.parametrize('event', ('ddl_command_start', 'ddl_command_end'))
@pytest.mark.parametrize('tags', ('', "when tag in ('REVOKE')"))
@pytest.mark.parametrize('enabled', ('enable', 'enable always', 'enable replica'))
def test_trigger_cutover_rejects_ddl_event_side_effects_before_any_revoke(
        trigger_privilege_case, event, tags, enabled):
    db = trigger_privilege_case
    install_cutover_event_trigger(db, event, tags, enabled)
    before = trigger_privilege_snapshot(db)
    # Real positive control: the exact bare revoke can mutate synthetic rows.
    # Roll it back before testing the protected, UNMODIFIED transaction.
    replica = "set local session_replication_role=replica;" if enabled == 'enable replica' else ''
    result = db.sql(f"begin;{replica}{TRIGGER_REVOKE}"
                    "select count(*) from public.notes where body='event-trigger-mutated';rollback;")
    assert result == '2'
    assert trigger_privilege_snapshot(db) == before
    db.sql(TRIGGER_PRIVILEGE_CUTOVER_SQL, error='NOTES_TRIGGER_DDL_SIDE_EFFECT_UNPROVEN')
    assert trigger_privilege_snapshot(db) == before


@pytest.mark.parametrize('tags,enabled', [
    ("when tag in ('REVOKE')", 'disable'),
    ("when tag in ('CREATE TABLE')", 'enable'),
])
def test_trigger_cutover_preserves_non_firing_event_triggers(trigger_privilege_case, tags, enabled):
    db = trigger_privilege_case
    install_cutover_event_trigger(db, 'ddl_command_end', tags, enabled)
    before = trigger_privilege_snapshot(db)
    db.sql(TRIGGER_PRIVILEGE_CUTOVER_SQL)
    assert_trigger_only_delta(before, trigger_privilege_snapshot(db))


# Exact pg_get_functiondef read-only evidence from the deployed handler. This is
# installed ONLY by the disposable fixture below, never by either cutover SQL.
DEPLOYED_PGRST_DEFINITION = """CREATE OR REPLACE FUNCTION extensions.pgrst_ddl_watch()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $function$
"""
PG17_PROOF = pytest.mark.parametrize('pgrst_proof_db', ['postgres:17.6-alpine'], indirect=True)


def test_provider_proposal_preserves_original_and_pins_observed_definition():
    assert hashlib.sha256(TRIGGER_PRIVILEGE_CUTOVER_SQL.encode()).hexdigest() == (
        '4565916b4e4df153be81b69575d0f5015680fa89cf383a9cce049aa9c78cd070')
    assert hashlib.sha256(DEPLOYED_PGRST_DEFINITION.encode()).hexdigest() == (
        '2b4b5d702ddf70fbd1a05c9825f9f9016d5c0ef97dd3df5f5b012ea23d9b94b1')
    assert hashlib.sha256(DEPLOYED_PGRST_DEFINITION.split('$function$')[1].encode()).hexdigest() == (
        'de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0')
    statements = '\n'.join(line.split('--', 1)[0] for line in PGRST_TRIGGER_PRIVILEGE_CUTOVER_SQL.splitlines())
    assert statements.count(TRIGGER_REVOKE) == statements.count('REVOKE ') == 1
    assert statements.strip().startswith('BEGIN ISOLATION LEVEL READ COMMITTED;')
    assert statements.strip().endswith('COMMIT;')
    for forbidden in ('GRANT ', 'ALTER ', 'CREATE ', 'DELETE ', 'INSERT ', 'UPDATE ', 'CASCADE', 'SET ROLE'):
        assert forbidden not in statements
    assert "current_setting('server_version_num')='170006'" in statements
    assert 'NOTES_TRIGGER_PGRST_PIN_DRIFT' in statements
    assert 'NOTES_TRIGGER_PGRST_STATE_CHANGED' in statements
    assert 'NOTES_TRIGGER_DDL_SIDE_EFFECT_UNPROVEN' in statements


def test_provider_image_selection_is_fixed_and_keeps_existing_defaults():
    def request(module, image=None):
        return SimpleNamespace(module=SimpleNamespace(__name__=module), param=image)
    assert proof_image(request('test_notes_identity_postgres')) == 'postgres:15-alpine'
    assert proof_image(request('test_notes_private_gateway_driver_harness')) == 'absinthe-notes-private-driver:test'
    assert proof_image(request('test_notes_cloud_copy_legacy_write_fence', 'postgres:17.6-alpine')) == 'postgres:17.6-alpine'
    for module, image in [('test_notes_identity_postgres', 'postgres:17.6-alpine'),
                          ('test_notes_cloud_copy_legacy_write_fence', 'postgres:latest'),
                          ('test_notes_cloud_copy_legacy_write_fence', 'external/image:17.6')]:
        with pytest.raises(ValueError, match='unapproved'):
            proof_image(request(module, image))


def mapped_pgrst_sql(db):
    # Disposable catalogs allocate different object IDs. Remap ONLY the three
    # expected-OID declarations; NEVER replace version, hashes, owners or checks.
    # Production retains the exact observed IDs and has no caller parameters.
    raw_ids = json.loads(db.sql("""select json_build_array(e.oid,p.oid,h.oid)
      from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid
      cross join pg_proc h where e.evtname='pgrst_ddl_watch'
        and p.oid='extensions.pgrst_ddl_watch()'::regprocedure
        and h.oid='pg_catalog.pg_event_trigger_ddl_commands()'::regprocedure;"""))
    assert len(raw_ids) == 3
    ids = []
    for oid in raw_ids:
        # PostgreSQL's JSON output for the oid type is decimal text, whereas
        # synthetic fixtures and some adapters may return JSON integers.
        if isinstance(oid, str) and oid.isascii() and oid.isdecimal():
            oid = int(oid)
        assert isinstance(oid, int) and not isinstance(oid, bool) and oid > 0
        ids.append(oid)
    sql = PGRST_TRIGGER_PRIVILEGE_CUTOVER_SQL
    for name, observed, synthetic in zip(('event', 'function', 'helper'), (16576, 16563, 4568), ids):
        old = f'expected_{name}_oid oid := {observed};'
        assert sql.count(old) == 1
        sql = sql.replace(old, f'expected_{name}_oid oid := {synthetic};', 1)
    return sql


@pytest.mark.parametrize("catalog_json", (
    "[10001, 10002, 10003]",
    '["10001", "10002", "4568"]',
))
def test_disposable_binding_remaps_only_expected_oids(catalog_json):
    class SyntheticCatalog:
        def sql(self, _):
            return catalog_json
    sql = mapped_pgrst_sql(SyntheticCatalog())
    synthetic_ids = [int(oid) for oid in json.loads(catalog_json)]
    for name, observed, synthetic in zip(('event', 'function', 'helper'), (16576, 16563, 4568), synthetic_ids):
        sql = sql.replace(f'expected_{name}_oid oid := {synthetic};', f'expected_{name}_oid oid := {observed};', 1)
    assert sql == PGRST_TRIGGER_PRIVILEGE_CUTOVER_SQL


@contextmanager
def deployed_pgrst_case(db):
    assert db.sql("select to_regnamespace('extensions') is null;") == 't'
    assert db.sql("select pg_get_userbyid(proowner) from pg_proc "
                  "where oid='pg_catalog.pg_event_trigger_ddl_commands()'::regprocedure;") == 'postgres'
    db.sql("create role supabase_admin superuser nologin;"
           "create schema extensions authorization supabase_admin;"
           + DEPLOYED_PGRST_DEFINITION + ";"
           "alter function extensions.pgrst_ddl_watch() owner to supabase_admin;"
           "alter function pg_catalog.pg_event_trigger_ddl_commands() owner to supabase_admin;"
           "create event trigger pgrst_ddl_watch on ddl_command_end "
           "execute function extensions.pgrst_ddl_watch();"
           "alter event trigger pgrst_ddl_watch owner to supabase_admin;")
    try:
        yield db
    finally:
        # Only this fixture's contained provider model; restore the helper's
        # original upstream owner/settings before another synthetic case starts.
        db.sql("drop event trigger if exists pgrst_ddl_watch;"
               "drop function if exists extensions.pgrst_ddl_watch();"
               "drop schema extensions;"
               "alter function pg_catalog.pg_event_trigger_ddl_commands() owner to postgres;"
               "alter function pg_catalog.pg_event_trigger_ddl_commands() security invoker;"
               "alter function pg_catalog.pg_event_trigger_ddl_commands() reset all;"
               "drop role supabase_admin;")


@pytest.fixture
def pgrst_case(pgrst_proof_db):
    assert pgrst_proof_db.sql("select current_setting('server_version_num');") == '170006'
    with _trigger_privilege_case(pgrst_proof_db) as db:
        # The observed PG17 deployment also grants MAINTAIN. It is NOT part of
        # the cutover and must survive alongside the existing DML/REFERENCES.
        db.sql('grant maintain on public.notes to anon,authenticated,service_role;')
        with deployed_pgrst_case(db):
            yield db, mapped_pgrst_sql(db)


@PG17_PROOF
@pytest.mark.parametrize('role', TRIGGER_ROLES)
def test_pgrst_exact_handler_allows_only_trigger_cutover_on_pg17(pgrst_case, role):
    db, sql = pgrst_case
    before = trigger_privilege_snapshot(db)
    # The literal old SQL remains a fail-closed control, not silently upgraded.
    db.sql(TRIGGER_PRIVILEGE_CUTOVER_SQL, error='NOTES_TRIGGER_DDL_SIDE_EFFECT_UNPROVEN')
    assert trigger_privilege_snapshot(db) == before
    db.sql(sql)
    assert_trigger_only_delta(before, trigger_privilege_snapshot(db))
    assert db.sql(f"select has_table_privilege('{role}','public.notes','MAINTAIN');") == 't'
    assert ordinary_notes_crud(db, role) == ['Edited', '1' if role == 'service_role' else '0']
    db.sql(f"begin;set local role {role};create trigger cannot_create before insert on public.notes "
           "for each row execute function public.trigger_cutover_existing();commit;", error='42501')
    assert_trigger_only_delta(before, trigger_privilege_snapshot(db))


@PG17_PROOF
@pytest.mark.parametrize('drift', [
    "alter function extensions.pgrst_ddl_watch() security definer;",
    "alter function extensions.pgrst_ddl_watch() set search_path=public;",
    "alter function extensions.pgrst_ddl_watch() owner to postgres;",
    "alter event trigger pgrst_ddl_watch disable;",
    "alter event trigger pgrst_ddl_watch enable replica;",
    "alter event trigger pgrst_ddl_watch enable always;",
    "alter function pg_catalog.pg_event_trigger_ddl_commands() owner to postgres;",
    "alter function pg_catalog.pg_event_trigger_ddl_commands() set search_path=pg_catalog;",
    "drop event trigger pgrst_ddl_watch;",
])
def test_pgrst_metadata_or_missing_binding_drift_is_denied(pgrst_case, drift):
    db, sql = pgrst_case
    db.sql(drift)
    before = trigger_privilege_snapshot(db)
    db.sql(sql, error='NOTES_TRIGGER_PGRST_PIN_DRIFT')
    assert trigger_privilege_snapshot(db) == before


@PG17_PROOF
@pytest.mark.parametrize('body', [
    "\nbegin update public.notes set body='forged';end; ",
    DEPLOYED_PGRST_DEFINITION.split('$function$')[1].replace("'COMMENT'", "'COMMENT', 'REVOKE'"),
    DEPLOYED_PGRST_DEFINITION.split('$function$')[1] + '\n',
])
def test_pgrst_same_name_body_changes_cannot_gain_the_exception(pgrst_case, body):
    db, sql = pgrst_case
    altered = DEPLOYED_PGRST_DEFINITION.split('$function$')
    db.sql(altered[0] + '$function$' + body + '$function$' + altered[2] + ';')
    before = trigger_privilege_snapshot(db)
    db.sql(sql, error='NOTES_TRIGGER_PGRST_PIN_DRIFT')
    assert trigger_privilege_snapshot(db) == before


@PG17_PROOF
def test_pgrst_recreation_with_identical_body_still_requires_new_oid_approval(pgrst_case):
    db, sql = pgrst_case
    db.sql("drop event trigger pgrst_ddl_watch;drop function extensions.pgrst_ddl_watch();"
           + DEPLOYED_PGRST_DEFINITION + ";"
           "alter function extensions.pgrst_ddl_watch() owner to supabase_admin;"
           "create event trigger pgrst_ddl_watch on ddl_command_end "
           "execute function extensions.pgrst_ddl_watch();"
           "alter event trigger pgrst_ddl_watch owner to supabase_admin;")
    before = trigger_privilege_snapshot(db)
    db.sql(sql, error='NOTES_TRIGGER_PGRST_PIN_DRIFT')
    assert trigger_privilege_snapshot(db) == before


@PG17_PROOF
def test_pgrst_exception_does_not_admit_an_additional_mutating_handler(pgrst_case):
    db, sql = pgrst_case
    install_cutover_event_trigger(db, 'ddl_command_end', "when tag in ('REVOKE')", 'enable')
    before = trigger_privilege_snapshot(db)
    db.sql(sql, error='NOTES_TRIGGER_DDL_SIDE_EFFECT_UNPROVEN')
    assert trigger_privilege_snapshot(db) == before


@PG17_PROOF
def test_pgrst_post_effect_definition_change_rolls_back_privileges_and_function(pgrst_case):
    db, sql = pgrst_case
    before = trigger_privilege_snapshot(db)
    faulty = sql.replace(TRIGGER_REVOKE, TRIGGER_REVOKE +
        '\nalter function extensions.pgrst_ddl_watch() security definer;')
    assert faulty != sql
    db.sql(faulty, error='NOTES_TRIGGER_PGRST_STATE_CHANGED')
    assert trigger_privilege_snapshot(db) == before


@PG17_PROOF
def test_pgrst_unreviewed_server_version_is_denied(pgrst_case):
    db, sql = pgrst_case
    wrong_version = sql.replace("current_setting('server_version_num')='170006'",
                                "current_setting('server_version_num')='170007'")
    assert wrong_version != sql
    before = trigger_privilege_snapshot(db)
    db.sql(wrong_version, error='NOTES_TRIGGER_PGRST_PIN_DRIFT')
    assert trigger_privilege_snapshot(db) == before


def test_pgrst_deployed_body_on_pg15_is_not_treated_as_pg17_proof(trigger_privilege_case):
    db = trigger_privilege_case
    assert db.sql("select current_setting('server_version_num')::int/10000;") == '15'
    with deployed_pgrst_case(db):
        before = trigger_privilege_snapshot(db)
        db.sql(mapped_pgrst_sql(db), error='NOTES_TRIGGER_PGRST_PIN_DRIFT')
        assert trigger_privilege_snapshot(db) == before


# Local-only HMAC/RLS compatibility, using the SAME labelled/no-network harness.
# This alias gets its own disposable container; the provider cutover fixtures and
# their existing negative assertions above are not modified or reused as RLS proof.
COMPAT = ROOT / "identity_candidates" / "notes_private_rls_compatibility.sql"
PG17_COMPAT = pytest.mark.parametrize(
    'compatibility_proof_db', ['postgres:17.6-alpine'], indirect=True)


def test_private_compatibility_is_inactive_and_keeps_all_existing_algorithms():
    source = COMPAT.read_text(encoding="utf-8")
    assert COMPAT.parent.name == "identity_candidates"
    assert source.count("begin isolation level read committed;") == 1
    assert source.count("commit;") == 1
    assert "extensions.hmac($1,$2,$3)" in source
    assert "security definer" not in source.lower()
    assert source.count("as restrictive") == 3
    assert "request.jwt." not in source.split("as $scope$")[1].split("$scope$")[0]
    assert "for select to notes_candidate_owner using (true)" in source
    for forbidden in ("create extension", "alter extension", "create role",
                      "enable row level", "disable row level", "bypassrls;",
                      "update notes_identity_candidate", "delete from public.notes"):
        assert forbidden not in source.lower()
    hashes = {
        "notes_identity_guard.sql": "c857cbf826e09e22507316f61ce4f8957458a3d996b469376a418144d619a36e",
        "notes_cloud_identity_mapping.sql": "681bf1ae1a1c9db9d89f73ec30598d2b051e17757e8351b52f9dbaa47b281ec4",
        "notes_identity_private_gateway.sql": "5036ded852d72582c3341823cba4c562e184d7e461c26cb4ea55d514e993c68e",
        "notes_cloud_copy_legacy_write_fence.sql": "3d6fa2fb70c6b28fa3765cbd353c9b12db1f6400debd0830ad05a9bdac40fcf7",
    }
    for name, expected in hashes.items():
        assert hashlib.sha256(COMPAT.with_name(name).read_text(encoding="utf-8").encode()).hexdigest() == expected


@pytest.fixture(scope="module")
def compatibility_db(compatibility_proof_db):
    db = PrivateDatabase(compatibility_proof_db.docker, compatibility_proof_db.name)
    assert db.sql("select current_setting('server_version_num');") == "170006"
    # Synthetic model of the inspected public policy and extensions placement.
    # No production roles, credentials, accounts, or Note bodies are used.
    db.sql(f"""
      create role notes_candidate_owner nologin nosuperuser nobypassrls noinherit;
      create role notes_candidate_gateway login password 'synthetic-only' nosuperuser nobypassrls noinherit;
      create role notes_candidate_app login password 'synthetic-only' nosuperuser nobypassrls noinherit;
      create role {LOGIN} login password 'synthetic-only' nosuperuser nobypassrls noinherit;
      create role anon nologin nosuperuser nobypassrls;
      create role authenticated nologin nosuperuser nobypassrls;
      create role service_role nologin nosuperuser bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('{OWNER_A}'),('{OWNER_B}');
      create function auth.uid() returns uuid language sql stable as $uid$
        select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
          nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
      $uid$;
      create table public.notes(id text primary key,
        user_id uuid not null references auth.users(id) on delete cascade,
        title text not null,body text not null,updated_at bigint not null,
        created_at timestamptz,folder_id text,deleted_at bigint,starred boolean not null default false);
      insert into public.notes(id,user_id,title,body,updated_at) values
        ('compat-legacy-a','{OWNER_A}','같은 제목','원본 A',1),
        ('compat-legacy-b','{OWNER_B}','같은 제목','원본 B',2);
      create table public.note_folders(id text primary key,name text);
      insert into public.note_folders values('legacy-folder','unchanged');
      alter table public.notes enable row level security;
      create policy notes_owner on public.notes for all to public using(auth.uid()=user_id);
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant usage on schema public to notes_candidate_owner;
      grant select,insert,update,delete on public.notes to anon,authenticated,service_role;
      create schema extensions;
      create extension pgcrypto with schema extensions;
      grant usage on schema extensions to anon,authenticated,service_role;
    """)
    db.sql(COMPAT.with_name("notes_identity_guard.sql").read_text(encoding="utf-8"))
    return db  # Only the existing container ownership/label teardown removes it.


def compatibility_snapshot(db):
    return json.loads(db.sql(f"""select jsonb_build_object(
      'notes',(select jsonb_agg(to_jsonb(n) order by id) from public.notes n),
      'folders',(select jsonb_agg(to_jsonb(f) order by id) from public.note_folders f),
      'policy',(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p
        where polrelid='public.notes'::regclass),
      'functions',(select jsonb_agg(to_jsonb(p) order by oid) from pg_proc p
        where pronamespace='notes_identity_candidate'::regnamespace
          or oid='extensions.hmac(bytea,bytea,text)'::regprocedure),
      'extension_acl',(select nspacl from pg_namespace where nspname='extensions'),
      'notes_acl',(select relacl from pg_class where oid='public.notes'::regclass),
      'readiness',(select to_jsonb(r) from {SCHEMA}.readiness r));"""))


@PG17_COMPAT
def test_pg17_private_hmac_rls_installation_and_account_bound_lifecycle(compatibility_db):
    import hmac
    db = compatibility_db
    sql = COMPAT.read_text(encoding="utf-8")
    original = compatibility_snapshot(db)
    # Initial catalog/role/provider drift is rejected without partial grants.
    for drift, restore, error in [
        ("alter table public.notes disable row level security;",
         "alter table public.notes enable row level security;", "CATALOG_UNVERIFIED"),
        ("grant notes_candidate_owner to notes_candidate_app;",
         "revoke notes_candidate_owner from notes_candidate_app;", "OWNER_UNVERIFIED"),
        ("alter function extensions.hmac(bytea,bytea,text) owner to notes_candidate_owner;",
         "alter function extensions.hmac(bytea,bytea,text) owner to postgres;", "HMAC_UNVERIFIED"),
        ("create policy unexpected on public.notes as restrictive using(true);",
         "drop policy unexpected on public.notes;", "LEGACY_POLICY_UNVERIFIED"),
    ]:
        db.sql(drift)
        before = compatibility_snapshot(db)
        db.sql(sql, error="PRIVATE_COMPAT_" + error)
        assert compatibility_snapshot(db) == before
        db.sql(restore)
    # Failure after ALL policy/grant creation rolls the entire adapter back.
    before = compatibility_snapshot(db)
    faulty = sql.replace("commit;", "do $$begin raise exception 'COMPAT_TEST_ABORT';end $$;commit;")
    assert faulty != sql
    db.sql(faulty, error="COMPAT_TEST_ABORT")
    assert compatibility_snapshot(db) == before
    db.sql(sql)
    db.sql(sql, error="PRIVATE_COMPAT_LEGACY_POLICY_UNVERIFIED")  # no overwrite/reinstall
    assert db.sql("select count(*) from pg_policy where polrelid='public.notes'::regclass;") == "7"
    assert db.sql("select pg_get_expr(polqual,polrelid) from pg_policy where polname='notes_owner';") == "(auth.uid() = user_id)"
    assert db.sql(f"select bool_or(value='true'::jsonb) from {SCHEMA}.readiness r,"
                  "lateral jsonb_each(to_jsonb(r)-'singleton');") == "f"
    assert db.sql("select count(*) from pg_roles where rolname='notes_candidate_owner' and "
                  "(rolcanlogin or rolbypassrls or rolsuper);") == "0"
    assert db.sql("select count(*) from pg_proc where oid='notes_identity_candidate.hmac(bytea,bytea,text)'::regprocedure "
                  "and not prosecdef and proconfig=array['search_path=pg_catalog'];") == "1"
    assert db.sql("begin;set local role notes_candidate_owner;select count(*) from public.notes;rollback;") == "2"
    # Compare exact synthetic bytes with the real extension and Python HMAC.
    expected = hmac.new(b"synthetic-key", "원본 / 原本".encode(), "sha256").hexdigest()
    assert db.sql("begin;set local role notes_candidate_owner;select encode("
                  "notes_identity_candidate.hmac(convert_to('원본 / 原本','UTF8'),"
                  "convert_to('synthetic-key','UTF8'),'sha256'),'hex');rollback;") == expected
    db.sql("begin;set local role anon;select notes_identity_candidate.hmac('a'::bytea,'b'::bytea,'sha256');",
           error="42501")
    # Existing sources are installed unchanged. No readiness or credentials
    # are supplied by the compatibility artifact.
    db.sql(COMPAT.with_name("notes_cloud_identity_mapping.sql").read_text(encoding="utf-8"))
    db.sql(COMPAT.with_name("notes_identity_private_gateway.sql").read_text(encoding="utf-8"))
    db.sql(SQL.read_text(encoding="utf-8"))
    assert db.sql(f"select enabled from {SCHEMA}.private_gateway_config;") == "f"
    assert db.sql(f"select enabled from {SCHEMA}.cloud_copy_readiness;") == "f"
    db.sql("select id from public.notes;", LOGIN, error="42501")
    db.sql(f"select {SCHEMA}.hmac('a'::bytea,'b'::bytea,'sha256');", LOGIN, error="42501")
    db.sql(f"select {SCHEMA}.private_notes_write_scope('{OWNER_A}');", LOGIN, error="42501")
    after = compatibility_snapshot(db)
    assert after["notes"] == original["notes"]
    assert after["folders"] == original["folders"]
    assert after["notes_acl"] == original["notes_acl"]
    db.sql(f"select {SCHEMA}.private_prepare('{{}}',decode(repeat('00',32),'hex'));", LOGIN,
           error="CANDIDATE_NOT_ACTIVATED")
    # Legacy JWT-scoped CRUD still works, without exposing the other account.
    assert db.sql(f"""begin;set local role authenticated;
      set local request.jwt.claim.sub='{OWNER_A}';
      insert into public.notes(id,user_id,title,body,updated_at)
        values('compat-crud','{OWNER_A}','new','body',3);
      update public.notes set title='edited' where id='compat-crud';
      select title from public.notes where id='compat-crud';
      select count(*) from public.notes where user_id='{OWNER_B}';
      delete from public.notes where id='compat-crud';rollback;""").splitlines() == ["edited", "0"]
    # TEST-ONLY activation and signing bytes, contained in this disposable DB.
    db.signing_key = bytes(range(32))
    db.sql(f"""update {SCHEMA}.readiness set enabled=true,authenticated_owner_binding=true,
      deployed_schema=true,deployed_roles=true,existing_identity_registration=true,
      legacy_mutations=true,k323_enforcement=true,reset_restore=true,account_termination=true;
      update {SCHEMA}.private_gateway_config set enabled=true,signing_key=decode('{db.signing_key.hex()}','hex');
      update {SCHEMA}.cloud_copy_readiness set enabled=true;
      insert into {SCHEMA}.account_fences values('{OWNER_A}',1,'ACTIVE'),('{OWNER_B}',1,'ACTIVE');""")
    g = client(db)
    # An A request must see a conflicting B-owned legacy ID, not RLS-hidden absence.
    ctx = g.prepare(token(OWNER_A), "cloud_reserve", op(), local_note_id="compat-legacy-b")
    db.sql(signed_apply(g, ctx, token(OWNER_A)), LOGIN, error="SOURCE_ID_UNAVAILABLE")
    local = "compat-local-" + op()
    cloud = g.run(token(OWNER_A), "cloud_reserve", op(), local_note_id=local)
    assert cloud != local
    assert g.run(token(OWNER_A), "cloud_publish", op(), local_note_id=local, note_id=cloud, payload=PAYLOAD) == "CREATED"
    read = g.run(token(OWNER_A), "cloud_read", op(), local_note_id=local)
    assert read["cloud_note_id"] == cloud and read["publication"]["payload"] == PAYLOAD
    for action in ("cloud_read", "cloud_publish"):
        ctx = g.prepare(token(OWNER_B), action, op(), local_note_id=local,
                        **({"note_id": cloud, "payload": PAYLOAD} if action == "cloud_publish" else {}))
        db.sql(signed_apply(g, ctx, token(OWNER_B)), LOGIN, error="CLOUD_ALIAS_UNAVAILABLE")
    # A/B/A generation changes do not revive a captured operation.
    ctx = g.prepare(token(OWNER_A), "cloud_read", op(), local_note_id=local)
    db.sql(f"update {SCHEMA}.account_fences set generation=3 where owner_id='{OWNER_A}';")
    db.sql(signed_apply(g, ctx, token(OWNER_A)), LOGIN, error="ACCOUNT_AUTHORITY_UNAVAILABLE")
    db.sql(f"begin;set local role service_role;delete from public.notes where id={quote(cloud)};",
           error="PROTECTED_NOTE_MUTATION")
    assert g.run(token(OWNER_A), "cloud_retire", op(), local_note_id=local, note_id=cloud) == "RETIRED"
    ctx = g.prepare(token(OWNER_A), "cloud_publish", op(), local_note_id=local, note_id=cloud, payload=PAYLOAD)
    db.sql(signed_apply(g, ctx, token(OWNER_A)), LOGIN, error="IDENTITY_UNAVAILABLE")
    assert db.sql(f"select state from {SCHEMA}.identities where id={quote(cloud)};") == "RETIRED"
    assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings;") == "0"
    # An intentionally unsafe TEST hook isolates policy behavior from the signed
    # RPC. It is NOT in any candidate artifact and is never used as auth proof.
    db.sql(f"""set role notes_candidate_owner;
      create function {SCHEMA}.compat_test_probe(bound uuid,target uuid,gen bigint) returns void
      language plpgsql security definer set search_path=pg_catalog as $probe$
      begin
        if bound is not null then
          insert into notes_identity_candidate.principal_bindings values(session_user,bound,gen);
        end if;
        insert into public.notes(id,user_id,title,body,updated_at)
          values('compat-probe',target,'probe','probe',1);
      end $probe$;reset role;
      revoke all on function {SCHEMA}.compat_test_probe(uuid,uuid,bigint) from public;
      grant execute on function {SCHEMA}.compat_test_probe(uuid,uuid,bigint) to {LOGIN};""")
    try:
        for bound, target, gen in [("null", OWNER_A, 3), (quote(OWNER_A), OWNER_B, 3), (quote(OWNER_A), OWNER_A, 1)]:
            db.sql(f"begin;set local request.jwt.claim.sub='{target}';"
                   f"select {SCHEMA}.compat_test_probe({bound},'{target}',{gen});commit;", LOGIN, error="42501")
        assert db.sql("select count(*) from public.notes where id='compat-probe';") == "0"
        assert db.sql(f"select count(*) from {SCHEMA}.principal_bindings;") == "0"
    finally:
        db.sql(f"drop function {SCHEMA}.compat_test_probe(uuid,uuid,bigint);")
        db.sql(f"update {SCHEMA}.readiness set enabled=false;"
               f"update {SCHEMA}.private_gateway_config set enabled=false,signing_key=null;"
               f"update {SCHEMA}.cloud_copy_readiness set enabled=false;")
    # No rollback/uninstall removes the retired ledger, aliases or receipts.
    assert db.sql(f"select state from {SCHEMA}.identities where id={quote(cloud)};") == "RETIRED"
    final = compatibility_snapshot(db)
    assert final["notes"] == original["notes"] and final["folders"] == original["folders"]
