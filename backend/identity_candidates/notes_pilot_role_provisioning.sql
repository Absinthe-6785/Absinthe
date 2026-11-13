-- UNAPPLIED, DEFAULT-OFF. Run once as postgres in a controlled DDL window.
-- No passwords, signing keys, account fences, provider grants or activation.
begin isolation level read committed;
set local search_path=pg_catalog;
do $admit$
begin
  if current_user<>'postgres' or session_user<>'postgres'
    or current_setting('server_version_num')<>'170006'
    or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolcreaterole))
    or not has_database_privilege(current_user,current_database(),'CREATE')
    or not exists(select 1 from pg_class where oid=to_regclass('public.notes')
      and relowner='postgres'::regrole and relkind='r' and relrowsecurity and not relforcerowsecurity)
    or to_regnamespace('notes_identity_candidate') is not null
    or exists(select 1 from pg_roles where rolname in
      ('notes_candidate_owner','notes_candidate_gateway','notes_candidate_app','notes_candidate_private_gateway')) then
    raise exception 'PILOT_ROLE_PREREQUISITES_UNVERIFIED';
  end if;
end $admit$;

create role notes_candidate_owner nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication password null;
create role notes_candidate_gateway nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication password null;
create role notes_candidate_app nologin noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication password null;
-- LOGIN is required by the existing private contract, but connection limit zero
-- closes even trust/certificate authentication. Opening it is NOT installation.
create role notes_candidate_private_gateway login connection limit 0 noinherit nosuperuser nobypassrls nocreaterole nocreatedb noreplication password null;
-- Managed postgres need not be superuser. Only the trusted installer can SET
-- the non-login owner. Existing installers also access the private schema
-- before SET ROLE; explicit inheritance is required ONLY for trusted postgres.
grant notes_candidate_owner to postgres with inherit true, set true;
grant usage on schema public to notes_candidate_owner;

do $verify$
declare r record;
begin
  for r in select * from pg_roles where rolname in
    ('notes_candidate_owner','notes_candidate_gateway','notes_candidate_app','notes_candidate_private_gateway') loop
    if r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb or r.rolreplication or r.rolinherit
      or r.rolcanlogin<>(r.rolname='notes_candidate_private_gateway')
      or (r.rolcanlogin and r.rolconnlimit<>0)
      or has_schema_privilege(r.oid,'public','CREATE')
      or has_schema_privilege(r.oid,'extensions','CREATE')
      or has_database_privilege(r.oid,current_database(),'CREATE')
      or has_table_privilege(r.oid,'public.notes','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
      or has_any_column_privilege(r.oid,'public.notes','SELECT,INSERT,UPDATE')
      or exists(select 1 from pg_auth_members m where m.member=r.oid
        or (m.roleid=r.oid and m.member<>'postgres'::regrole)) then
      raise exception 'PILOT_ROLE_EFFECTIVE_AUTHORITY_UNVERIFIED';
    end if;
  end loop;
  if not pg_has_role('postgres','notes_candidate_owner','SET')
    or not pg_has_role('postgres','notes_candidate_owner','USAGE') then
    raise exception 'PILOT_ROLE_INSTALLER_UNVERIFIED';
  end if;
end $verify$;
commit;
