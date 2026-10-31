-- UNAPPLIED CANDIDATE: outside automatic migrations; no runtime activation.
-- Execute only with separately approved table-owner authority, never at startup.
-- No DML, RLS, ownership, membership or Identity Guard activation changes.
-- PUBLIC/inherited grants are not silently rewritten: remaining effective
-- TRUNCATE authority aborts and rolls back the complete candidate.
-- External SQL consumers and SET ROLE/owner/function bypass need separate review.
BEGIN;

REVOKE TRUNCATE ON TABLE public.notes, public.note_folders
  FROM anon, authenticated, service_role RESTRICT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    CROSS JOIN (VALUES ('public.notes'), ('public.note_folders')) AS t(name)
    WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
      AND pg_catalog.has_table_privilege(r.oid, t.name, 'TRUNCATE')
  ) THEN
    RAISE EXCEPTION 'NOTES_TRUNCATE_AUTHORITY_REMAINS';
  END IF;
END $$;

COMMIT;
