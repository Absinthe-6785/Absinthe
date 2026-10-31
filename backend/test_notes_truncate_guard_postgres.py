"""Unapplied permission candidate, tested only in the existing disposable PG harness.

Synthetic RLS/session identity is NOT deployed Supabase authorization evidence.
No production DSN, host port, external database or migration runner is used.
"""
import json
from pathlib import Path

import pytest

from test_notes_identity_postgres import db as proof_db, OWNER_A, OWNER_B

SQL = Path(__file__).parent / "identity_candidates" / "notes_truncate_guard.sql"
ROLES = ("anon", "authenticated", "service_role")
TABLES = ("notes", "note_folders")


def test_candidate_is_unapplied_and_only_revokes_target_truncate():
    source = SQL.read_text(encoding="utf-8")
    assert SQL.parent.name == "identity_candidates"
    assert "UNAPPLIED CANDIDATE" in source
    statements = "\n".join(line for line in source.splitlines() if not line.startswith("--"))
    assert "REVOKE TRUNCATE ON TABLE public.notes, public.note_folders" in statements
    assert "FROM anon, authenticated, service_role RESTRICT;" in statements
    assert statements.count("REVOKE ") == 1
    assert "has_table_privilege" in statements
    assert "NOTES_TRUNCATE_AUTHORITY_REMAINS" in statements
    for forbidden in ("GRANT ", "ALTER ", "DELETE ", "INSERT ", "UPDATE ", "CASCADE", "enabled=true"):
        assert forbidden not in statements


@pytest.fixture(scope="module")
def model(proof_db):
    proof_db.sql(f"""
      CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
      CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS INHERIT;
      CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
      CREATE ROLE truncate_parent NOLOGIN;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('{OWNER_A}'), ('{OWNER_B}');
    """)
    for table in TABLES:
        proof_db.sql(f"""
          CREATE TABLE public.{table}(id text PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            title text NOT NULL);
          ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;
          CREATE POLICY own_rows ON public.{table} FOR ALL
            USING (user_id = nullif(current_setting('test.owner', true), '')::uuid)
            WITH CHECK (user_id = nullif(current_setting('test.owner', true), '')::uuid);
          INSERT INTO public.{table} VALUES ('a','{OWNER_A}','Original A'), ('b','{OWNER_B}','Original B');
        """)
    return proof_db


@pytest.fixture
def granted(model):
    model.sql("GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.notes, public.note_folders "
              "TO anon, authenticated, service_role;")
    return model


def snapshot(db):
    return json.loads(db.sql("""SELECT json_build_object(
      'dml',(SELECT json_agg(json_build_array(r.rolname,c.relname,p,
        has_table_privilege(r.oid,c.oid,p)) ORDER BY r.rolname,c.relname,p)
        FROM pg_roles r CROSS JOIN pg_class c CROSS JOIN
        unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p
        WHERE r.rolname IN ('anon','authenticated','service_role')
          AND c.oid IN ('public.notes'::regclass,'public.note_folders'::regclass)),
      'tables',(SELECT json_agg(json_build_array(relname,relowner,relrowsecurity,relforcerowsecurity)
        ORDER BY relname) FROM pg_class
        WHERE oid IN ('public.notes'::regclass,'public.note_folders'::regclass)),
      'policies',(SELECT json_agg(row_to_json(p) ORDER BY tablename)
        FROM pg_policies p WHERE schemaname='public' AND tablename IN ('notes','note_folders')),
      'notes',(SELECT json_agg(n ORDER BY id) FROM public.notes n),
      'folders',(SELECT json_agg(n ORDER BY id) FROM public.note_folders n));"""))


@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("role", ROLES)
def test_direct_truncate_is_removed_without_changing_dml_rls_or_rows(granted, table, role):
    before = snapshot(granted)
    # Demonstrate actual pre-correction authority; rollback preserves sentinels.
    granted.sql(f"BEGIN; SET LOCAL ROLE {role}; TRUNCATE public.{table}; ROLLBACK;")
    granted.sql(SQL.read_text(encoding="utf-8"))
    assert granted.sql(f"SELECT has_table_privilege('{role}','public.{table}','TRUNCATE');") == "f"
    granted.sql(f"SET ROLE {role}; TRUNCATE public.{table};", error="42501")
    assert snapshot(granted) == before
    granted.sql(SQL.read_text(encoding="utf-8"))  # idempotent
    assert snapshot(granted) == before


@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("role", ROLES)
def test_modeled_crud_scoped_reset_and_restore_still_work(granted, table, role):
    granted.sql(SQL.read_text(encoding="utf-8"))
    before = snapshot(granted)
    result = granted.sql(f"""BEGIN; SET LOCAL ROLE {role}; SET LOCAL test.owner='{OWNER_A}';
      INSERT INTO public.{table} VALUES ('new','{OWNER_A}','Created');
      UPDATE public.{table} SET title='Edited' WHERE id='new' AND user_id='{OWNER_A}';
      SELECT title FROM public.{table} WHERE id='new' AND user_id='{OWNER_A}';
      DELETE FROM public.{table} WHERE id='new' AND user_id='{OWNER_A}';
      DELETE FROM public.{table} WHERE user_id='{OWNER_A}';
      INSERT INTO public.{table} VALUES ('a','{OWNER_A}','Restored')
        ON CONFLICT(id) DO UPDATE SET title=excluded.title;
      SELECT title FROM public.{table} WHERE id='a' AND user_id='{OWNER_A}';
      ROLLBACK;""")
    assert result.splitlines() == ['Edited', 'Restored']
    assert snapshot(granted) == before


@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("source", ("PUBLIC", "truncate_parent"))
def test_remaining_public_or_inherited_truncate_aborts_atomically(granted, table, source):
    if source == "truncate_parent":
        granted.sql("GRANT truncate_parent TO authenticated;")
    granted.sql(f"GRANT TRUNCATE ON public.{table} TO {source};")
    before = snapshot(granted)
    try:
        granted.sql(SQL.read_text(encoding="utf-8"), error="NOTES_TRUNCATE_AUTHORITY_REMAINS")
        # Revokes on BOTH tables rolled back, not partially applied.
        for target in TABLES:
            for role in ROLES:
                assert granted.sql(f"SELECT has_table_privilege('{role}','public.{target}','TRUNCATE');") == "t"
        assert snapshot(granted) == before
    finally:
        granted.sql(f"REVOKE TRUNCATE ON public.{table} FROM {source};")
        if source == "truncate_parent":
            granted.sql("REVOKE truncate_parent FROM authenticated;")


def test_postcondition_rejects_missing_revoke(granted):
    source = SQL.read_text(encoding="utf-8")
    broken = source.replace("REVOKE TRUNCATE ON TABLE public.notes, public.note_folders\n"
                            "  FROM anon, authenticated, service_role RESTRICT;", "")
    assert broken != source
    granted.sql(broken, error="NOTES_TRUNCATE_AUTHORITY_REMAINS")


@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("role", ROLES)
def test_account_rls_and_existing_service_bypass_are_unchanged(granted, table, role):
    granted.sql(SQL.read_text(encoding="utf-8"))
    before = snapshot(granted)
    result = granted.sql(f"""BEGIN; SET LOCAL ROLE {role}; SET LOCAL test.owner='{OWNER_A}';
      SELECT count(*) FROM public.{table} WHERE user_id='{OWNER_B}';
      UPDATE public.{table} SET title='Foreign edit' WHERE user_id='{OWNER_B}';
      ROLLBACK;""")
    assert result == ('1' if role == 'service_role' else '0')
    assert snapshot(granted) == before
