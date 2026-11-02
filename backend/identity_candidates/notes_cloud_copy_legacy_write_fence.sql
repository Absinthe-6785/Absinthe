-- UNAPPLIED, INACTIVE TEST CANDIDATE. Never loaded by a migration/runtime route.
-- Requires the existing identity/mapping/PrivateGateway disposable model.
-- Does not enable ANY readiness flag or grant ANY application privilege.
--
-- Protected = an ID in the immutable server-issued ledger, including the
-- reservation-to-alias window and permanent RETIRED IDs. An unregistered legacy
-- ID is NOT classified as historically fresh and receives no cloud admission.
-- All modeled writes require READ COMMITTED: older MVCC snapshots must fail
-- closed, not miss a subsequently issued/retired identity. Production isolation,
-- table ownership, DDL authority and provider integration remain activation gates.
-- A DBA can alter/drop database protections; no claim covers hostile owner DDL.
-- There is NO privileged DML/cascade exemption and NO automatic retirement.
begin;
set local role notes_candidate_owner;

create function notes_identity_candidate.fence_note_write() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare i notes_identity_candidate.identities%rowtype; accepted boolean;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'FENCE_ISOLATION_UNSUPPORTED';
  end if;
  if tg_op='UPDATE' then
    -- No identity row/advisory lock is acquired after locking an existing Note.
    -- In particular a cascade cannot wait on a retirement holding the identity
    -- lock while that retirement waits on this Note's row lock.
    perform 1 from notes_identity_candidate.identities where id=old.id;
    if found then raise exception 'PROTECTED_NOTE_MUTATION'; end if;
  end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.id is distinct from old.id) then
    perform pg_advisory_xact_lock(hashtextextended('notes-issued-id:' || new.id,0));
  end if;
  if tg_op='DELETE' then
    select * into i from notes_identity_candidate.identities where id=old.id;
  else
    select * into i from notes_identity_candidate.identities where id=new.id;
  end if;
  if not found then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='UPDATE' or i.state<>'LIVE' then raise exception 'PROTECTED_NOTE_MUTATION'; end if;
  -- Recheck at the effect, not only gateway admission: a later grant must not
  -- let a legacy session forge a permit through a NOINHERIT/SET ROLE helper.
  perform notes_identity_candidate.assert_notes_write_boundary();
  if tg_op='INSERT' then
    if new.user_id<>i.owner_id or new.folder_id is not null or new.deleted_at is not null
      or coalesce(to_jsonb(new)->'properties','null'::jsonb)<>'null'::jsonb
      or coalesce(to_jsonb(new)->'relations','null'::jsonb)<>'null'::jsonb then
      raise exception 'PROTECTED_NOTE_MUTATION';
    end if;
    delete from notes_identity_candidate.note_write_permits
      where backend_pid=pg_backend_pid() and transaction_id=txid_current()
        and login=session_user and note_id=new.id and owner_id=new.user_id and kind='INSERT'
        and payload=jsonb_build_object('title',new.title,'body',new.body,
          'updated_at',new.updated_at,'starred',new.starred)
      returning true into accepted;
  else
    delete from notes_identity_candidate.note_write_permits
      where backend_pid=pg_backend_pid() and transaction_id=txid_current()
        and login=session_user and note_id=old.id and owner_id=old.user_id
        and owner_id=i.owner_id and kind='DELETE' and payload='{}'::jsonb
      returning true into accepted;
  end if;
  if accepted is distinct from true then raise exception 'PROTECTED_NOTE_MUTATION'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

create function notes_identity_candidate.fence_note_truncate() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'FENCE_ISOLATION_UNSUPPORTED';
  end if;
  -- TRUNCATE already holds ACCESS EXCLUSIVE on notes. No identity lock is
  -- requested: a lifecycle writer cannot be waiting behind it with a Note lock.
  -- Legacy-only table truncation remains possible in this disposable model.
  if exists(select 1 from public.notes n join notes_identity_candidate.identities i on i.id=n.id) then
    raise exception 'PROTECTED_NOTE_TRUNCATE';
  end if;
  return null;
end $$;

create function notes_identity_candidate.fence_identity_truncate() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'IDENTITY_HISTORY_IMMUTABLE'; end $$;

-- Invoker security is essential: a client with an accidental permit-table
-- grant must not acquire the owner's authority merely by firing this trigger.
-- Only existing SECURITY DEFINER lifecycle primitives execute as the private
-- NOLOGIN owner. Reachability is checked AT MINT, before an ADMIN OPTION holder
-- could revoke its own membership and present a clean graph at Note mutation.
create function notes_identity_candidate.fence_permit_mint() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if current_user <> 'notes_candidate_owner'
    or session_user <> 'notes_candidate_private_gateway' or tg_op='UPDATE' then
    raise exception 'PERMIT_MINT_DENIED';
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.login<>session_user or not exists(select 1
    from notes_identity_candidate.principal_bindings b
    join notes_identity_candidate.account_fences f on f.owner_id=b.owner_id
      and f.generation=b.generation and f.state='ACTIVE'
    where b.login=session_user and b.owner_id=new.owner_id) then
    raise exception 'PERMIT_MINT_DENIED';
  end if;
  perform notes_identity_candidate.assert_notes_write_boundary();
  return new;
end $$;

-- Only the optional fence changes blanket write-grant denial into an actual
-- enforcement proof. All other default-false readiness gates stay unchanged.
create or replace function notes_identity_candidate.assert_notes_write_boundary() returns void
language plpgsql set search_path=pg_catalog as $$
declare role_name text; reachable record; table_name text;
begin
  if not exists(select 1 from pg_trigger where tgrelid='public.notes'::regclass
    and tgname='candidate_notes_write_fence' and tgenabled='A' and tgtype=31
    and tgfoid='notes_identity_candidate.fence_note_write()'::regprocedure)
    or not exists(select 1 from pg_trigger where tgrelid='public.notes'::regclass
    and tgname='candidate_notes_truncate_fence' and tgenabled='A' and tgtype=34
    and tgfoid='notes_identity_candidate.fence_note_truncate()'::regprocedure) then
    raise exception 'LEGACY_FENCE_UNVERIFIED';
  end if;
  if exists(select 1 from (values
    ('identities','candidate_identity_guard','guard_identity()',27),
    ('receipts','candidate_receipt_guard','guard_receipt()',27),
    ('cloud_aliases','candidate_cloud_alias_guard','guard_cloud_alias()',27),
    ('note_write_permits','candidate_permit_mint_fence','fence_permit_mint()',31),
    ('note_write_permits','candidate_permit_truncate_fence','fence_identity_truncate()',34),
    ('identities','candidate_identity_truncate_fence','fence_identity_truncate()',34),
    ('receipts','candidate_receipt_truncate_fence','fence_identity_truncate()',34),
    ('cloud_aliases','candidate_alias_truncate_fence','fence_identity_truncate()',34)
  ) as e(relation_name,trigger_name,function_name,trigger_type)
    left join pg_trigger t on t.tgrelid=to_regclass('notes_identity_candidate.'||e.relation_name)
      and t.tgname=e.trigger_name and t.tgenabled='A' and t.tgtype=e.trigger_type
      and t.tgfoid=to_regprocedure('notes_identity_candidate.'||e.function_name)
    where t.oid is null) then raise exception 'LEGACY_FENCE_UNVERIFIED'; end if;
  for role_name in
    select unnest(array['anon','authenticated','service_role','notes_candidate_app',
      'notes_candidate_gateway','notes_candidate_private_gateway'])
    union select session_user::text where not exists
      (select 1 from pg_roles where rolname=session_user and rolsuper)
  loop
    -- MEMBER is conservative across PostgreSQL versions: include all direct and
    -- transitive SET ROLE possibilities, even NOINHERIT and SET-option denial.
    -- The actual non-DBA session is covered as well as the modeled app roles.
    -- DBA DDL/private-table forgery is outside the model, but DBA direct Notes
    -- DML still has no exemption from the one-shot permit requirement.
    if not exists(select 1 from pg_roles where rolname=role_name) then
      raise exception 'LEGACY_FENCE_PRIVILEGES_UNVERIFIED';
    end if;
    for reachable in select p.* from pg_roles p
      where p.rolname=role_name or pg_has_role(role_name,p.oid,'MEMBER') loop
      if reachable.rolname='notes_candidate_owner' or reachable.rolsuper
        or reachable.rolcreaterole or reachable.rolcreatedb or reachable.rolreplication
        or has_table_privilege(reachable.oid,'public.notes','TRIGGER') then
        raise exception 'LEGACY_FENCE_PRIVILEGES_UNVERIFIED';
      end if;
      for table_name in select c.oid::regclass::text from pg_class c
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='notes_identity_candidate' and c.relkind='r' loop
        if has_table_privilege(reachable.oid,table_name,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
          or has_any_column_privilege(reachable.oid,table_name,'INSERT,UPDATE') then
          raise exception 'LEGACY_FENCE_PRIVILEGES_UNVERIFIED';
        end if;
      end loop;
    end loop;
  end loop;
end $$;
revoke all on function notes_identity_candidate.fence_note_write(),
  notes_identity_candidate.fence_note_truncate(),
  notes_identity_candidate.fence_identity_truncate(),
  notes_identity_candidate.fence_permit_mint(),
  notes_identity_candidate.assert_notes_write_boundary() from public;
reset role;

-- Test candidate installer needs table-owner DDL. No application role receives it.
create trigger candidate_notes_write_fence before insert or update or delete on public.notes
  for each row execute function notes_identity_candidate.fence_note_write();
alter table public.notes enable always trigger candidate_notes_write_fence;
create trigger candidate_notes_truncate_fence before truncate on public.notes
  execute function notes_identity_candidate.fence_note_truncate();
alter table public.notes enable always trigger candidate_notes_truncate_fence;
create trigger candidate_identity_truncate_fence before truncate on notes_identity_candidate.identities
  execute function notes_identity_candidate.fence_identity_truncate();
alter table notes_identity_candidate.identities enable always trigger candidate_identity_truncate_fence;
create trigger candidate_receipt_truncate_fence before truncate on notes_identity_candidate.receipts
  execute function notes_identity_candidate.fence_identity_truncate();
alter table notes_identity_candidate.receipts enable always trigger candidate_receipt_truncate_fence;
create trigger candidate_alias_truncate_fence before truncate on notes_identity_candidate.cloud_aliases
  execute function notes_identity_candidate.fence_identity_truncate();
alter table notes_identity_candidate.cloud_aliases enable always trigger candidate_alias_truncate_fence;
create trigger candidate_permit_mint_fence before insert or update or delete
  on notes_identity_candidate.note_write_permits
  for each row execute function notes_identity_candidate.fence_permit_mint();
alter table notes_identity_candidate.note_write_permits enable always trigger candidate_permit_mint_fence;
create trigger candidate_permit_truncate_fence before truncate on notes_identity_candidate.note_write_permits
  execute function notes_identity_candidate.fence_identity_truncate();
alter table notes_identity_candidate.note_write_permits enable always trigger candidate_permit_truncate_fence;
alter table notes_identity_candidate.identities enable always trigger candidate_identity_guard;
alter table notes_identity_candidate.receipts enable always trigger candidate_receipt_guard;
alter table notes_identity_candidate.cloud_aliases enable always trigger candidate_cloud_alias_guard;
commit;
