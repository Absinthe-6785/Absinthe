-- UNAPPLIED, private Notes-only extension of notes_identity_guard.sql.
-- Requires separately provisioned disposable role/pgcrypto in tests. No role,
-- extension, credential, production grant, migration or activation is created.
begin;
do $$
begin
  if not exists (select 1 from pg_roles where rolname='notes_candidate_private_gateway'
      and rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole
      and not rolcreatedb and not rolreplication)
    or pg_has_role('notes_candidate_private_gateway','notes_candidate_owner','MEMBER')
    or pg_has_role('notes_candidate_private_gateway','notes_candidate_gateway','MEMBER')
    or to_regprocedure('notes_identity_candidate.hmac(bytea,bytea,text)') is null then
    raise exception 'PRIVATE_GATEWAY_PREREQUISITES_UNVERIFIED';
  end if;
end $$;
set local role notes_candidate_owner;
create table notes_identity_candidate.private_gateway_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  signing_key bytea check(octet_length(signing_key)>=32)
);
insert into notes_identity_candidate.private_gateway_config(singleton) values(true);
create table notes_identity_candidate.private_contexts (
  owner_id uuid not null,
  operation_id text not null,
  context_id uuid not null unique,
  generation bigint not null check(generation>0),
  expires bigint not null,
  intent jsonb not null,
  primary key(owner_id,operation_id)
);
-- These rows have no client UPDATE/DELETE path, including after expiry/failure.
-- Reusing an operation cannot upgrade its captured generation or deadline.
create function notes_identity_candidate.private_check(p_text text,p_mac bytea,p_audience text)
returns jsonb language plpgsql set search_path=pg_catalog as $$
declare cfg notes_identity_candidate.private_gateway_config%rowtype;
  r notes_identity_candidate.readiness%rowtype;
  expected bytea; difference integer:=0; doc jsonb; signature text;
begin
  if session_user<>'notes_candidate_private_gateway' then raise exception 'PRIVATE_PRINCIPAL_REQUIRED'; end if;
  select * into r from notes_identity_candidate.readiness where singleton for share;
  if not found or not coalesce((select bool_and(value='true'::jsonb)
      from jsonb_each(to_jsonb(r)-'singleton')),false) then
    raise exception 'CANDIDATE_NOT_ACTIVATED';
  end if;
  select * into cfg from notes_identity_candidate.private_gateway_config where singleton for share;
  if not found or not cfg.enabled or cfg.signing_key is null then raise exception 'CANDIDATE_NOT_ACTIVATED'; end if;
  if exists(select 1 from pg_roles where rolname=session_user
      and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication))
    or pg_has_role(session_user,'notes_candidate_owner','MEMBER')
    or pg_has_role(session_user,'notes_candidate_gateway','MEMBER')
    or has_table_privilege(session_user,'public.notes','INSERT,UPDATE,DELETE,TRUNCATE')
    or has_any_column_privilege(session_user,'public.notes','INSERT,UPDATE')
    or has_function_privilege(session_user,'notes_identity_candidate.reserve(text)','EXECUTE')
    or has_function_privilege(session_user,'notes_identity_candidate.publish(uuid,bigint,text,text,jsonb)','EXECUTE')
    or has_function_privilege(session_user,'notes_identity_candidate.retire(uuid,bigint,text,text)','EXECUTE') then
    raise exception 'PRIVATE_PRIVILEGES_UNVERIFIED';
  end if;
  -- Optional cloud-copy candidate may be installed separately. The restricted
  -- login must NEVER gain raw lifecycle/read EXECUTE even through inheritance.
  foreach signature in array array[
    'notes_identity_candidate.reserve_cloud_copy(text,bigint,text)',
    'notes_identity_candidate.publish_cloud_copy(text,text,bigint,text,jsonb)',
    'notes_identity_candidate.retire_cloud_copy(text,text,bigint,text)',
    'notes_identity_candidate.read_cloud_copy(text,bigint)',
    'notes_identity_candidate.publish_laptop_note(uuid,bigint,text,text,jsonb)',
    'notes_identity_candidate.read_laptop_publication(uuid,bigint,text,text,jsonb)',
    'notes_identity_candidate.approve_laptop_adoption(uuid,bigint,text,text,jsonb,text,text[],timestamptz,jsonb,text)'
  ] loop
    if to_regprocedure(signature) is not null
      and has_function_privilege(session_user,to_regprocedure(signature),'EXECUTE') then
      raise exception 'PRIVATE_PRIVILEGES_UNVERIFIED';
    end if;
  end loop;
  if p_text is null or p_mac is null or octet_length(p_mac)<>32 then raise exception 'ASSERTION_DENIED'; end if;
  expected:=notes_identity_candidate.hmac(convert_to(p_text,'UTF8'),cfg.signing_key,'sha256');
  for i in 0..31 loop difference:=difference | (get_byte(expected,i) # get_byte(p_mac,i)); end loop;
  if difference<>0 then raise exception 'ASSERTION_DENIED'; end if;
  doc:=p_text::jsonb;
  if jsonb_typeof(doc)<>'object' or doc->>'aud' is distinct from p_audience
    or jsonb_typeof(doc->'expires') is distinct from 'number'
    or (doc->>'expires') !~ '^[0-9]+$'
    or (doc->>'expires')::numeric<=extract(epoch from clock_timestamp())
    or (doc->>'expires')::numeric>extract(epoch from clock_timestamp())+60 then
    raise exception 'ASSERTION_DENIED';
  end if;
  return doc;
end $$;

create function notes_identity_candidate.private_context_json(p notes_identity_candidate.private_contexts)
returns jsonb language sql set search_path=pg_catalog as $$
  select jsonb_build_object('context_id',(p).context_id,'generation',(p).generation,
                           'expires',(p).expires,'intent',(p).intent)
$$;

create function notes_identity_candidate.private_prepare(p_text text,p_mac bytea)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare doc jsonb; intent jsonb; v_owner uuid; gen bigint; required text[]; is_cloud boolean; is_laptop boolean;
  c notes_identity_candidate.private_contexts%rowtype;
begin
  doc:=notes_identity_candidate.private_check(p_text,p_mac,'absinthe.notes.private-gateway.candidate.v1.prepare');
  is_cloud:=doc->>'action' in ('cloud_reserve','cloud_publish','cloud_retire','cloud_read');
  is_laptop:=doc->>'action' in ('laptop_publish','laptop_read');
  required:=array['aud','expires','owner','action','operation_id','note_id','payload'];
  if is_cloud then required:=array_append(required,'local_note_id'); end if;
  if is_laptop then required:=array_append(required,'approval_operation_id'); end if;
  if not (doc ?& required) or doc-required<>'{}'::jsonb
    or jsonb_typeof(doc->'owner') is distinct from 'string'
    or jsonb_typeof(doc->'action') is distinct from 'string'
    or jsonb_typeof(doc->'operation_id') is distinct from 'string'
    or btrim(doc->>'operation_id')='' or length(doc->>'operation_id')>200
    or doc->>'action' not in ('reserve','publish','retire','cloud_reserve','cloud_publish','cloud_retire','cloud_read','laptop_publish','laptop_read')
    then raise exception 'INVALID_INTENT'; end if;
  v_owner:=(doc->>'owner')::uuid;
  if v_owner='00000000-0000-0000-0000-000000000000' then raise exception 'INVALID_INTENT'; end if;
  if is_laptop and (
    jsonb_typeof(doc->'approval_operation_id') is distinct from 'string'
    or length(btrim(doc->>'approval_operation_id')) not between 1 and 512
    or jsonb_typeof(doc->'payload') is distinct from 'object'
    or length(doc->>'note_id') not between 1 and 512) then raise exception 'INVALID_INTENT'; end if;
  if (is_cloud and (jsonb_typeof(doc->'local_note_id') is distinct from 'string'
                   or btrim(doc->>'local_note_id')=''))
    or (doc->>'action' in ('reserve','cloud_reserve','cloud_read')
        and (doc->'note_id'<>'null'::jsonb or doc->'payload'<>'null'::jsonb))
    or (doc->>'action' not in ('reserve','cloud_reserve','cloud_read') and
       (jsonb_typeof(doc->'note_id') is distinct from 'string' or btrim(doc->>'note_id')=''))
    or (doc->>'action' not in ('publish','cloud_publish','laptop_publish','laptop_read') and doc->'payload'<>'null'::jsonb)
    or (doc->>'action' in ('publish','cloud_publish','laptop_publish','laptop_read') and jsonb_typeof(doc->'payload') is distinct from 'object') then
    raise exception 'INVALID_INTENT';
  end if;
  intent:=doc-array['aud','expires'];
  -- Same ordering as reserve's existing account/operation transaction lock.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||(doc->>'operation_id'),0));
  select * into c from notes_identity_candidate.private_contexts p
    where p.owner_id=v_owner and p.operation_id=doc->>'operation_id';
  if found then
    if c.intent<>intent then raise exception 'OPERATION_CONFLICT'; end if;
    if c.expires<=extract(epoch from clock_timestamp()) then raise exception 'AUTHORITY_EXPIRED'; end if;
    return notes_identity_candidate.private_context_json(c);
  end if;
  select generation into gen from notes_identity_candidate.account_fences f
    where f.owner_id=v_owner and state='ACTIVE' for share;
  if not found then raise exception 'ACCOUNT_AUTHORITY_UNAVAILABLE'; end if;
  insert into notes_identity_candidate.private_contexts values
    (v_owner,doc->>'operation_id',gen_random_uuid(),gen,(doc->>'expires')::bigint,intent)
    returning * into c;
  return notes_identity_candidate.private_context_json(c);
end $$;

create function notes_identity_candidate.private_apply(p_text text,p_mac bytea)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare doc jsonb; c notes_identity_candidate.private_contexts%rowtype; result text;
begin
  doc:=notes_identity_candidate.private_check(p_text,p_mac,'absinthe.notes.private-gateway.candidate.v1.apply');
  if not (doc ?& array['aud','expires','context'])
    or doc-array['aud','expires','context']<>'{}'::jsonb
    or jsonb_typeof(doc->'context') is distinct from 'object' then raise exception 'INVALID_CONTEXT'; end if;
  select * into c from notes_identity_candidate.private_contexts
    where context_id=(doc->'context'->>'context_id')::uuid for update;
  if not found or notes_identity_candidate.private_context_json(c)<>doc->'context' then raise exception 'CONTEXT_DENIED'; end if;
  if c.expires<=extract(epoch from clock_timestamp()) then raise exception 'AUTHORITY_EXPIRED'; end if;
  -- Serialize only this shared login's short execution. No session/GUC state is
  -- set. Raw lifecycle EXECUTE is forbidden to this login, so the temporary
  -- binding is usable ONLY inside this atomic verified function invocation.
  perform pg_advisory_xact_lock(hashtextextended('private-notes-binding:'||session_user,0));
  if least((doc->>'expires')::numeric,c.expires::numeric)<=extract(epoch from clock_timestamp()) then
    raise exception 'AUTHORITY_EXPIRED';
  end if;
  if exists(select 1 from notes_identity_candidate.principal_bindings where login=session_user) then
    raise exception 'STALE_PRIVATE_BINDING';
  end if;
  insert into notes_identity_candidate.principal_bindings values(session_user,c.owner_id,c.generation);
  -- Existing require_ready rechecks the CURRENT ACTIVE fence under a shared
  -- lock before any identity/Note mutation. Stale contexts never get rebound.
  if c.intent->>'action'='reserve' then
    result:=notes_identity_candidate.reserve(c.operation_id);
  elsif c.intent->>'action'='publish' then
    result:=notes_identity_candidate.publish(c.owner_id,c.generation,c.intent->>'note_id',c.operation_id,c.intent->'payload');
  elsif c.intent->>'action'='retire' then
    result:=notes_identity_candidate.retire(c.owner_id,c.generation,c.intent->>'note_id',c.operation_id);
  elsif c.intent->>'action'='cloud_reserve' then
    result:=notes_identity_candidate.reserve_cloud_copy(c.intent->>'local_note_id',c.generation,c.operation_id);
  elsif c.intent->>'action'='cloud_publish' then
    result:=notes_identity_candidate.publish_cloud_copy(c.intent->>'local_note_id',c.intent->>'note_id',
      c.generation,c.operation_id,c.intent->'payload');
  elsif c.intent->>'action'='cloud_retire' then
    result:=notes_identity_candidate.retire_cloud_copy(c.intent->>'local_note_id',c.intent->>'note_id',
      c.generation,c.operation_id);
  elsif c.intent->>'action'='cloud_read' then
    -- This immutable read context cannot dispatch a mutation or refresh any
    -- mutation context/receipt. The mapping/receipt/snapshot are checked in SQL.
    result:=notes_identity_candidate.read_cloud_copy(c.intent->>'local_note_id',c.generation)::text;
  elsif c.intent->>'action'='laptop_publish' then
    -- No approval or adoption happens here. Only an exact owner-preapproved
    -- historical ID can pass the existing immutable approval boundary.
    result:=notes_identity_candidate.publish_laptop_note(c.owner_id,c.generation,
      c.intent->>'note_id',c.intent->>'approval_operation_id',c.intent->'payload')::text;
  elsif c.intent->>'action'='laptop_read' then
    result:=notes_identity_candidate.read_laptop_publication(c.owner_id,c.generation,
      c.intent->>'note_id',c.intent->>'approval_operation_id',c.intent->'payload')::text;
  else
    raise exception 'INVALID_CONTEXT';
  end if;
  -- Lower-level identity/Note locks may also have waited beyond the lease.
  -- Raise before returning so ALL effects of this statement roll back.
  if least((doc->>'expires')::numeric,c.expires::numeric)<=extract(epoch from clock_timestamp()) then
    raise exception 'AUTHORITY_EXPIRED';
  end if;
  delete from notes_identity_candidate.principal_bindings where login=session_user;
  if exists(select 1 from notes_identity_candidate.principal_bindings where login=session_user) then
    raise exception 'STALE_PRIVATE_BINDING';
  end if;
  return result;
  -- Any error rolls back Note, state, receipt AND temporary binding together.
end $$;

revoke all on notes_identity_candidate.private_gateway_config,notes_identity_candidate.private_contexts from public;
revoke all on function notes_identity_candidate.private_check(text,bytea,text),
  notes_identity_candidate.private_context_json(notes_identity_candidate.private_contexts),
  notes_identity_candidate.private_prepare(text,bytea),notes_identity_candidate.private_apply(text,bytea) from public;
grant usage on schema notes_identity_candidate to notes_candidate_private_gateway;
grant execute on function notes_identity_candidate.private_prepare(text,bytea),
  notes_identity_candidate.private_apply(text,bytea) to notes_candidate_private_gateway;
reset role;
commit;
