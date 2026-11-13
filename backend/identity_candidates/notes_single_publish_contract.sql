-- UNAPPLIED LOCAL CANDIDATE. No runtime route, migration or activation.
-- Optional exact-ID boundary over notes_identity_guard.sql. It neither issues
-- nor adopts an ID: a real server reserve receipt must already exist. Unknown
-- historical/local IDs remain denied. Existing six installation files unchanged.
begin;
set local role notes_candidate_owner;

create function notes_identity_candidate.read_single_note(
  p_owner uuid, p_generation bigint, p_id text, p_operation text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i notes_identity_candidate.identities%rowtype;
  r notes_identity_candidate.receipts%rowtype;
  n public.notes%rowtype;
begin
  perform notes_identity_candidate.require_ready(p_owner,p_generation);
  -- Same lifecycle lock order; retirement cannot pass this read while it holds
  -- the identity lock. This is one observed state, not a future-state promise.
  select * into i from notes_identity_candidate.identities
    where id=p_id and owner_id=p_owner for share;
  if not found then raise exception 'IDENTITY_PROVENANCE_UNPROVEN'; end if;
  if i.state='RETIRED' then raise exception 'IDENTITY_RETIRED'; end if;
  if not exists(select 1 from notes_identity_candidate.receipts
    where note_id=p_id and owner_id=p_owner and kind='reserve' and payload='{}'::jsonb
      and digest=encode(sha256(convert_to('{}','UTF8')),'hex')) then
    raise exception 'IDENTITY_PROVENANCE_UNPROVEN';
  end if;
  if i.state<>'LIVE' then raise exception 'SINGLE_NOTE_READBACK_UNCONFIRMED'; end if;
  select * into r from notes_identity_candidate.receipts
    where owner_id=p_owner and operation_id=p_operation and note_id=p_id and kind='publish';
  if not found or r.payload is distinct from p_payload
    or r.digest<>encode(sha256(convert_to(r.payload::text,'UTF8')),'hex') then
    raise exception 'SINGLE_NOTE_READBACK_UNCONFIRMED';
  end if;
  select * into n from public.notes where id=p_id and user_id=p_owner;
  if not found or n.folder_id is not null or n.deleted_at is not null
    or coalesce(to_jsonb(n)->'properties','null'::jsonb)<>'null'::jsonb
    or coalesce(to_jsonb(n)->'relations','null'::jsonb)<>'null'::jsonb
    or jsonb_build_object('title',n.title,'body',n.body,'updated_at',n.updated_at,'starred',n.starred)
      is distinct from p_payload then
    raise exception 'SINGLE_NOTE_READBACK_UNCONFIRMED';
  end if;
  return jsonb_build_object('account_id',n.user_id,'generation',p_generation,
    'note_id',n.id,'operation_id',p_operation,'payload',r.payload,'receipt_digest',r.digest);
end $$;

create function notes_identity_candidate.publish_single_note(
  p_owner uuid, p_generation bigint, p_id text, p_operation text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i notes_identity_candidate.identities%rowtype; effect text;
begin
  perform notes_identity_candidate.require_ready(p_owner,p_generation);
  select * into i from notes_identity_candidate.identities
    where id=p_id and owner_id=p_owner for update;
  if not found then raise exception 'IDENTITY_PROVENANCE_UNPROVEN'; end if;
  if i.state='RETIRED' then raise exception 'IDENTITY_RETIRED'; end if;
  -- A ledger observation or client provenance string alone is insufficient.
  if not exists(select 1 from notes_identity_candidate.receipts
    where note_id=p_id and owner_id=p_owner and kind='reserve' and payload='{}'::jsonb
      and digest=encode(sha256(convert_to('{}','UTF8')),'hex')) then
    raise exception 'IDENTITY_PROVENANCE_UNPROVEN';
  end if;
  -- Existing primitive atomically checks the exact payload/operation, plain
  -- INSERTs, records the receipt and transitions RESERVED -> LIVE. No UPDATE of
  -- existing Note content, missing-column fallback or second identity issuance.
  effect := notes_identity_candidate.publish(p_owner,p_generation,p_id,p_operation,p_payload);
  if effect not in ('CREATED','REPLAY_LIVE') then
    raise exception 'SINGLE_NOTE_READBACK_UNCONFIRMED';
  end if;
  return jsonb_build_object('effect',effect,'requires_post_commit_readback',true,
    'snapshot',notes_identity_candidate.read_single_note(p_owner,p_generation,p_id,p_operation,p_payload));
end $$;

revoke all on function notes_identity_candidate.publish_single_note(uuid,bigint,text,text,jsonb),
  notes_identity_candidate.read_single_note(uuid,bigint,text,text,jsonb) from public;
grant execute on function notes_identity_candidate.publish_single_note(uuid,bigint,text,text,jsonb),
  notes_identity_candidate.read_single_note(uuid,bigint,text,text,jsonb) to notes_candidate_gateway;
reset role;
commit;
