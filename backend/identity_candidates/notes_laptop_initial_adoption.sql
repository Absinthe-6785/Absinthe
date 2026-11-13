-- UNAPPLIED LOCAL CANDIDATE. No runtime API, migration or activation.
-- Explicit historical-ID adoption is NOT proof of never-published identity.
-- Depends only on the existing inactive notes_identity_guard.sql model.
begin;
set local role notes_candidate_owner;

create table notes_identity_candidate.laptop_adoptions (
  note_id text primary key references notes_identity_candidate.identities(id),
  owner_id uuid not null,
  generation bigint not null check (generation > 0),
  operation_id text not null check (btrim(operation_id) <> ''),
  payload jsonb not null,
  capture_sha256 text not null check (capture_sha256 ~ '^[0-9a-f]{64}$'),
  known_deleted_ids text[] not null,
  expires_at timestamptz not null,
  policy text not null check (policy = 'OWNER_APPROVED_HISTORICAL_ADOPTION'),
  unique (owner_id, operation_id)
);
revoke all on notes_identity_candidate.laptop_adoptions from public;
create trigger candidate_laptop_approval_immutable
before update or delete on notes_identity_candidate.laptop_adoptions
for each row execute function notes_identity_candidate.guard_receipt();

create function notes_identity_candidate.valid_laptop_payload(p jsonb)
returns boolean language sql immutable set search_path=pg_catalog as $$
  select coalesce(jsonb_typeof(p)='object'
    and p ?& array['title','body','updated_at','starred']
    and p-array['title','body','updated_at','starred']='{}'::jsonb
    and jsonb_typeof(p->'title')='string' and octet_length(p->>'title')<=8192
    and jsonb_typeof(p->'body')='string' and octet_length(p->>'body')<=1048576
    and jsonb_typeof(p->'starred')='boolean'
    and jsonb_typeof(p->'updated_at')='number'
    and (p->>'updated_at') ~ '^[0-9]{1,16}$'
    and case when (p->>'updated_at') ~ '^[0-9]{1,16}$'
      then (p->>'updated_at')::numeric<=9007199254740991 else false end
    -- Initial scope: no originals, embeds or explicit Wiki dependencies.
    and (p->>'body') !~* '(data:|blob:|attachment:|resource:|!\[|<(img|video|audio|object|embed|iframe)\y|\[\[)',
    false)
$$;

-- OWNER-ONLY, not a browser/backend RPC. A future trusted adapter must capture
-- durable local preflight and the complete known-deletion set before approval.
-- These attestations are operator assertions, NOT SQL proof of IndexedDB.
create function notes_identity_candidate.approve_laptop_adoption(
  p_owner uuid, p_generation bigint, p_id text, p_operation text, p_payload jsonb,
  p_capture_sha256 text, p_known_deleted_ids text[], p_expires_at timestamptz,
  p_local_attestation jsonb, p_policy text
) returns void language plpgsql set search_path=pg_catalog as $$
declare key text; i notes_identity_candidate.identities%rowtype;
begin
  perform notes_identity_candidate.require_ready(p_owner,p_generation);
  if p_policy is distinct from 'OWNER_APPROVED_HISTORICAL_ADOPTION'
    or p_local_attestation is distinct from
      '{"durable_local":true,"current_account":true,"active_complete":true,"no_dependencies":true,"no_pending_mutations":true,"known_deletions_complete":true}'::jsonb
    or p_capture_sha256 is null or p_capture_sha256 !~ '^[0-9a-f]{64}$'
    or p_expires_at is null or p_expires_at<=clock_timestamp()
    or p_expires_at>clock_timestamp()+interval '24 hours'
    or p_id is null or p_id<>btrim(p_id) or length(p_id) not between 1 and 512
    or p_operation is null or length(btrim(p_operation)) not between 1 and 512
    or not notes_identity_candidate.valid_laptop_payload(p_payload) then
    raise exception 'LAPTOP_ADOPTION_INELIGIBLE';
  end if;
  if p_known_deleted_ids is null or coalesce(array_ndims(p_known_deleted_ids),1)<>1
    or cardinality(p_known_deleted_ids)>500
    or exists(select 1 from unnest(p_known_deleted_ids) x
      where x is null or x<>btrim(x) or length(x) not between 1 and 512)
    or (select count(*) from unnest(p_known_deleted_ids) x)
      <> (select count(distinct x) from unnest(p_known_deleted_ids) x) then
    raise exception 'KNOWN_DELETIONS_INCOMPLETE';
  end if;
  if p_id=any(p_known_deleted_ids) then raise exception 'IDENTITY_RETIRED'; end if;
  -- Same ID namespace as issuance/fence. Sorted locking also serializes two
  -- concurrent approvals with overlapping deletion sets, without lock cycles.
  for key in select x from unnest(p_known_deleted_ids || array[p_id]) x order by x loop
    perform pg_advisory_xact_lock(hashtextextended('notes-issued-id:' || key,0));
  end loop;
  foreach key in array p_known_deleted_ids loop
    -- Never retire/delete an active remote Note as a side effect of approval.
    if exists(select 1 from public.notes where id=key
      and (user_id<>p_owner or deleted_at is null)) then
      raise exception 'KNOWN_RETIREMENT_CONFLICT';
    end if;
    select * into i from notes_identity_candidate.identities where id=key for update;
    if found then
      if i.owner_id<>p_owner or i.state<>'RETIRED' then
        raise exception 'KNOWN_RETIREMENT_CONFLICT';
      end if;
    else
      insert into notes_identity_candidate.identities values(key,p_owner,'RETIRED');
    end if;
  end loop;
  if exists(select 1 from public.notes where id=p_id)
    or exists(select 1 from notes_identity_candidate.identities where id=p_id) then
    raise exception 'IDENTITY_UNAVAILABLE';
  end if;
  insert into notes_identity_candidate.identities values(p_id,p_owner,'RESERVED');
  insert into notes_identity_candidate.laptop_adoptions values
    (p_id,p_owner,p_generation,p_operation,p_payload,p_capture_sha256,
     p_known_deleted_ids,p_expires_at,p_policy);
  -- Deliberately NO fabricated reserve receipt. Server issuance stays distinct.
end $$;

-- Enforce exact approval even if the existing low-level publish primitive is
-- called directly. This fires inside the same Note/receipt transaction.
create function notes_identity_candidate.guard_laptop_publication()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare a notes_identity_candidate.laptop_adoptions%rowtype;
begin
  select * into a from notes_identity_candidate.laptop_adoptions where note_id=new.note_id;
  if found and new.kind='publish' then
    perform notes_identity_candidate.require_ready(a.owner_id,a.generation);
    if new.owner_id<>a.owner_id or new.operation_id<>a.operation_id
      or new.payload is distinct from a.payload or clock_timestamp()>=a.expires_at then
      raise exception 'LAPTOP_APPROVAL_MISMATCH_OR_EXPIRED';
    end if;
  end if;
  return new;
end $$;
create trigger candidate_laptop_publication_guard
before insert on notes_identity_candidate.receipts
for each row execute function notes_identity_candidate.guard_laptop_publication();

create function notes_identity_candidate.read_laptop_publication(
  p_owner uuid, p_generation bigint, p_id text, p_operation text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a notes_identity_candidate.laptop_adoptions%rowtype;
  i notes_identity_candidate.identities%rowtype; n public.notes%rowtype;
  r notes_identity_candidate.receipts%rowtype;
begin
  perform notes_identity_candidate.require_ready(p_owner,p_generation);
  select * into a from notes_identity_candidate.laptop_adoptions
    where note_id=p_id and owner_id=p_owner and generation=p_generation for share;
  if not found or a.operation_id is distinct from p_operation
    or a.payload is distinct from p_payload then raise exception 'LAPTOP_APPROVAL_REQUIRED'; end if;
  select * into i from notes_identity_candidate.identities
    where id=p_id and owner_id=p_owner for share;
  if not found or i.state<>'LIVE' then raise exception 'LAPTOP_READBACK_UNCONFIRMED'; end if;
  select * into r from notes_identity_candidate.receipts
    where owner_id=p_owner and note_id=p_id and operation_id=p_operation and kind='publish';
  if not found or r.payload is distinct from p_payload
    or r.digest<>encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') then
    raise exception 'LAPTOP_READBACK_UNCONFIRMED';
  end if;
  select * into n from public.notes where id=p_id and user_id=p_owner;
  if not found or n.folder_id is not null or n.deleted_at is not null
    or coalesce(to_jsonb(n)->'properties','null'::jsonb)<>'null'::jsonb
    or coalesce(to_jsonb(n)->'relations','null'::jsonb)<>'null'::jsonb
    or jsonb_build_object('title',n.title,'body',n.body,'updated_at',n.updated_at,'starred',n.starred)
      is distinct from p_payload then raise exception 'LAPTOP_READBACK_UNCONFIRMED'; end if;
  return jsonb_build_object('account_id',p_owner,'generation',p_generation,
    'note_id',p_id,'operation_id',p_operation,'payload',r.payload,
    'capture_sha256',a.capture_sha256,'policy',a.policy);
end $$;

create function notes_identity_candidate.publish_laptop_note(
  p_owner uuid, p_generation bigint, p_id text, p_operation text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a notes_identity_candidate.laptop_adoptions%rowtype; effect text;
begin
  perform notes_identity_candidate.require_ready(p_owner,p_generation);
  select * into a from notes_identity_candidate.laptop_adoptions
    where note_id=p_id and owner_id=p_owner and generation=p_generation for share;
  if not found or a.operation_id is distinct from p_operation
    or a.payload is distinct from p_payload then raise exception 'LAPTOP_APPROVAL_REQUIRED'; end if;
  if exists(select 1 from notes_identity_candidate.identities where id=p_id and state='RETIRED') then
    raise exception 'IDENTITY_RETIRED';
  end if;
  effect := notes_identity_candidate.publish(p_owner,p_generation,p_id,p_operation,p_payload);
  if effect not in ('CREATED','REPLAY_LIVE') then raise exception 'IDENTITY_RETIRED'; end if;
  return jsonb_build_object('effect',effect,'requires_post_commit_readback',true,
    'snapshot',notes_identity_candidate.read_laptop_publication(
      p_owner,p_generation,p_id,p_operation,p_payload));
end $$;

revoke all on function notes_identity_candidate.valid_laptop_payload(jsonb),
  notes_identity_candidate.approve_laptop_adoption(uuid,bigint,text,text,jsonb,text,text[],timestamptz,jsonb,text),
  notes_identity_candidate.guard_laptop_publication(),
  notes_identity_candidate.read_laptop_publication(uuid,bigint,text,text,jsonb),
  notes_identity_candidate.publish_laptop_note(uuid,bigint,text,text,jsonb) from public;
grant execute on function
  notes_identity_candidate.read_laptop_publication(uuid,bigint,text,text,jsonb),
  notes_identity_candidate.publish_laptop_note(uuid,bigint,text,text,jsonb) to notes_candidate_gateway;
reset role;
commit;
