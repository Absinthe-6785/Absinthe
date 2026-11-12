-- UNAPPLIED, DEFAULT-OFF LOCAL CANDIDATE. No runtime/migration installer.
-- Order: guard -> this compatibility candidate -> mapping -> private gateway -> fence.
-- Prerequisites (separate provisioning): existing restricted candidate roles,
-- owner USAGE on public, and existing pgcrypto 1.3 in extensions.
-- No extension relocation, role creation, credentials, JWT GUC binding or activation.
begin isolation level read committed;
set local search_path=pg_catalog;
do $admission$
declare owner_id oid := to_regrole('notes_candidate_owner');
begin
  if current_user<>'postgres' or current_setting('server_version_num')<>'170006'
    or not exists(select 1 from pg_class where oid=to_regclass('public.notes')
      and relowner='postgres'::regrole and relkind='r' and relpersistence='p'
      and relrowsecurity and not relforcerowsecurity and not relispartition)
    or exists(select 1 from pg_inherits
      where inhrelid='public.notes'::regclass or inhparent='public.notes'::regclass) then
    raise exception 'PRIVATE_COMPAT_CATALOG_UNVERIFIED';
  end if;
  lock table public.notes in access exclusive mode nowait;
  if not exists(select 1 from pg_roles where oid=owner_id
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit
    and not rolcreaterole and not rolcreatedb and not rolreplication)
    or exists(select 1 from pg_roles r where r.oid<>owner_id and
      ((not r.rolsuper and r.rolname<>'postgres' and pg_has_role(r.oid,owner_id,'MEMBER'))
        or pg_has_role(owner_id,r.oid,'MEMBER')))
    or not pg_has_role(current_user,owner_id,'SET')
    or not has_schema_privilege(owner_id,'public','USAGE')
    or has_schema_privilege(owner_id,'extensions','CREATE')
    or exists(select 1 from unnest(array['SELECT','INSERT','DELETE']) p
      where not has_table_privilege(owner_id,'public.notes',p))
    or has_table_privilege(owner_id,'public.notes','UPDATE,TRUNCATE,TRIGGER') then
    raise exception 'PRIVATE_COMPAT_OWNER_UNVERIFIED';
  end if;
  if (select count(*) from pg_roles where rolname in
      ('anon','authenticated','service_role','notes_candidate_gateway',
       'notes_candidate_app','notes_candidate_private_gateway'))<>6
    or exists(select 1 from pg_roles where rolname in
      ('anon','authenticated','service_role','notes_candidate_gateway',
       'notes_candidate_app','notes_candidate_private_gateway')
      and has_table_privilege(oid,'public.notes','TRIGGER')) then
    raise exception 'PRIVATE_COMPAT_APPLICATION_PRIVILEGES_UNVERIFIED';
  end if;
  if not exists(select 1 from pg_namespace where oid=to_regnamespace('notes_identity_candidate')
      and nspowner=owner_id)
    or not exists(select 1 from notes_identity_candidate.readiness where singleton
      and not enabled and not authenticated_owner_binding and not deployed_schema
      and not deployed_roles and not existing_identity_registration and not legacy_mutations
      and not k323_enforcement and not reset_restore and not account_termination) then
    raise exception 'PRIVATE_COMPAT_DEFAULT_OFF_REQUIRED';
  end if;
  -- Admit the observed legacy policy without changing it. Additional/restrictive
  -- policies could hide rows from the existing global ID collision/fence reads.
  if (select count(*) from pg_policy where polrelid='public.notes'::regclass)<>1
    or not exists(select 1 from pg_policy where polrelid='public.notes'::regclass
      and polname='notes_owner' and polcmd='*' and polpermissive
      and polroles=array[0::oid] and polwithcheck is null
      and pg_get_expr(polqual,polrelid)='(auth.uid() = user_id)') then
    raise exception 'PRIVATE_COMPAT_LEGACY_POLICY_UNVERIFIED';
  end if;
  if not exists(select 1 from pg_proc p
    join pg_language l on l.oid=p.prolang
    join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'
      and d.refclassid='pg_extension'::regclass
    join pg_extension e on e.oid=d.refobjid
    where p.oid=to_regprocedure('extensions.hmac(bytea,bytea,text)')
      and e.extname='pgcrypto' and e.extversion='1.3' and e.extowner='postgres'::regrole
      and e.extnamespace='extensions'::regnamespace
      and p.proowner='postgres'::regrole and l.lanname='c'
      and p.prorettype='bytea'::regtype and p.prokind='f' and not p.proretset
      and not p.prosecdef and p.proisstrict and p.provolatile='i' and p.proconfig is null)
    or to_regprocedure('notes_identity_candidate.hmac(bytea,bytea,text)') is not null then
    raise exception 'PRIVATE_COMPAT_HMAC_UNVERIFIED';
  end if;
end
$admission$;

grant usage on schema extensions to notes_candidate_owner;
grant execute on function extensions.hmac(bytea,bytea,text) to notes_candidate_owner;
set local role notes_candidate_owner;
create function notes_identity_candidate.hmac(bytea,bytea,text) returns bytea
language sql immutable strict security invoker set search_path=pg_catalog as $hmac$
  select extensions.hmac($1,$2,$3)
$hmac$;
revoke all on function notes_identity_candidate.hmac(bytea,bytea,text) from public;

-- This predicate is NOT a client-supplied owner or JWT setting. private_apply
-- inserts the authenticated one-invocation binding before lifecycle DML, then
-- removes it; failures roll back it and all effects. require_ready already holds
-- the account/principal locks. No per-Note permit lookup here: BEFORE triggers
-- consume that permit BEFORE the INSERT WITH CHECK expression is evaluated.
create function notes_identity_candidate.private_notes_write_scope(p_owner uuid)
returns boolean language sql stable strict security invoker set search_path=pg_catalog as $scope$
  select current_user='notes_candidate_owner'
    and session_user='notes_candidate_private_gateway'
    and exists(select 1 from notes_identity_candidate.principal_bindings b
      join notes_identity_candidate.account_fences f on f.owner_id=b.owner_id
        and f.generation=b.generation and f.state='ACTIVE'
      where b.login=session_user and b.owner_id=p_owner)
    and exists(select 1 from notes_identity_candidate.readiness r where singleton
      and r.enabled and r.authenticated_owner_binding and r.deployed_schema
      and r.deployed_roles and r.existing_identity_registration and r.legacy_mutations
      and r.k323_enforcement and r.reset_restore and r.account_termination)
$scope$;
revoke all on function notes_identity_candidate.private_notes_write_scope(uuid) from public;
reset role;

-- Internal global SELECT is deliberate: reserve(), reserve_cloud_copy(),
-- retire(), and the truncate fence must see OTHER accounts' existing IDs.
-- The NOLOGIN owner has no untrusted members; browser/private login gets no
-- direct table SELECT and only fixed authenticated RPCs can return Note content.
create policy candidate_private_notes_select on public.notes as permissive
  for select to notes_candidate_owner using (true);
create policy candidate_private_notes_insert on public.notes as permissive
  for insert to notes_candidate_owner
  with check (notes_identity_candidate.private_notes_write_scope(user_id));
create policy candidate_private_notes_delete on public.notes as permissive
  for delete to notes_candidate_owner
  using (notes_identity_candidate.private_notes_write_scope(user_id));
-- PUBLIC legacy policies combine with permissive policies using OR. These
-- AND guards prevent a forged request.jwt.* setting from bypassing the binding.
create policy candidate_private_notes_insert_guard on public.notes as restrictive
  for insert to notes_candidate_owner
  with check (notes_identity_candidate.private_notes_write_scope(user_id));
create policy candidate_private_notes_delete_guard on public.notes as restrictive
  for delete to notes_candidate_owner
  using (notes_identity_candidate.private_notes_write_scope(user_id));
create policy candidate_private_notes_no_update on public.notes as restrictive
  for update to notes_candidate_owner using (false) with check (false);
commit;
