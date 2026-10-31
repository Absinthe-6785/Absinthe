-- TEST ONLY: loaded exclusively into a disposable synthetic PostgreSQL container.
-- Models trusted admission, NOT provenance for old IDs or production auth.
create role proof_owner nologin nosuperuser nobypassrls noinherit;
create role proof_issuer login password 'synthetic-only' nosuperuser nobypassrls noinherit;
create role proof_a login password 'synthetic-only' nosuperuser nobypassrls noinherit;
create role proof_b login password 'synthetic-only' nosuperuser nobypassrls noinherit;
create schema notes_identity_proof authorization proof_owner;
revoke all on schema notes_identity_proof from public;
grant usage on schema notes_identity_proof to proof_a, proof_b, proof_issuer;
set role proof_owner;

create table notes_identity_proof.identities (
  id text primary key,
  owner_id uuid not null,
  state text not null check (state in ('RESERVED', 'LIVE', 'RETIRED'))
);
create table notes_identity_proof.notes (
  id text primary key references notes_identity_proof.identities(id),
  owner_id uuid not null,
  payload jsonb not null
);
create table notes_identity_proof.insert_audit (id text not null);
create function notes_identity_proof.record_insert() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  insert into notes_identity_proof.insert_audit values (new.id);
  return new;
end $$;
create trigger note_insert_audit after insert on notes_identity_proof.notes
for each row execute function notes_identity_proof.record_insert();
create table notes_identity_proof.receipts (
  owner_id uuid not null,
  -- Fault injection only: forces failure AFTER the Note INSERT, before receipt.
  operation_id text not null check (operation_id <> 'fault-before-receipt'),
  note_id text not null references notes_identity_proof.identities(id),
  digest text not null,
  payload jsonb not null,
  constraint receipts_owner_operation_key primary key (owner_id, operation_id),
  unique (note_id)
);
-- No application DML (including TRUNCATE) or role membership is granted.
revoke all on all tables in schema notes_identity_proof from public;

create function notes_identity_proof.actor() returns uuid
language plpgsql stable set search_path = pg_catalog as $$
begin
  -- Separate authenticated DB logins, not a caller-settable JWT/GUC simulation.
  case session_user
    when 'proof_a' then return '11111111-1111-4111-8111-111111111111'::uuid;
    when 'proof_b' then return '22222222-2222-4222-8222-222222222222'::uuid;
    else raise exception 'IDENTITY_UNAVAILABLE' using errcode = '42501';
  end case;
end $$;

create function notes_identity_proof.guard_identity() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then raise exception 'IDENTITY_IMMUTABLE'; end if;
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
     or old.state = 'RETIRED'
     or not ((old.state = 'RESERVED' and new.state in ('LIVE', 'RETIRED'))
             or (old.state = 'LIVE' and new.state = 'RETIRED')) then
    raise exception 'IDENTITY_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger identity_guard before update or delete on notes_identity_proof.identities
for each row execute function notes_identity_proof.guard_identity();

create function notes_identity_proof.guard_receipt() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'RECEIPT_IMMUTABLE';
end $$;
create trigger receipt_guard before update or delete on notes_identity_proof.receipts
for each row execute function notes_identity_proof.guard_receipt();

create function notes_identity_proof.reserve(p_id text, p_owner uuid) returns text
language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- Only proof_issuer can execute this. The prefix is a synthetic restriction,
  -- NOT a real-world guarantee that the ID has never existed.
  if p_id is null or p_id not like 'fresh:%' or p_owner is null then
    raise exception 'IDENTITY_UNAVAILABLE';
  end if;
  insert into notes_identity_proof.identities values (p_id, p_owner, 'RESERVED');
  return 'RESERVED';
exception when unique_violation then
  raise exception 'IDENTITY_UNAVAILABLE';
end $$;

create function notes_identity_proof.publish(p_id text, p_operation text, p_payload jsonb)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := notes_identity_proof.actor();
  identity_row notes_identity_proof.identities%rowtype;
  receipt_row notes_identity_proof.receipts%rowtype;
  payload_digest text;
  conflict_constraint text;
begin
  -- Publication and retirement lock identity BEFORE notes, in one transaction.
  select * into identity_row from notes_identity_proof.identities
    where id = p_id and owner_id = actor_id for update;
  if not found or identity_row.owner_id <> actor_id then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  -- Exact supported snapshot shape. Extra metadata is rejected, not discarded.
  if p_operation is null or btrim(p_operation) = '' or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not (p_payload ?& array['title','body','updated_at','starred'])
     or p_payload - array['title','body','updated_at','starred'] <> '{}'::jsonb
     or jsonb_typeof(p_payload->'title') <> 'string'
     or jsonb_typeof(p_payload->'body') <> 'string'
     or jsonb_typeof(p_payload->'starred') <> 'boolean'
     or jsonb_typeof(p_payload->'updated_at') <> 'number'
     or (p_payload->>'updated_at') !~ '^[0-9]+$'
     or (p_payload->>'updated_at')::numeric > 9007199254740991 then
    raise exception 'UNSUPPORTED_PAYLOAD';
  end if;
  payload_digest := encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex');
  select * into receipt_row from notes_identity_proof.receipts
    where owner_id = actor_id and operation_id = p_operation;
  if found then
    if receipt_row.note_id <> p_id or receipt_row.digest <> payload_digest
       or receipt_row.payload <> p_payload then raise exception 'OPERATION_CONFLICT'; end if;
    if identity_row.state = 'RETIRED' then return 'APPLIED_THEN_RETIRED'; end if;
    if identity_row.state <> 'LIVE' or not exists (
      select 1 from notes_identity_proof.notes
      where id = p_id and owner_id = actor_id and payload = receipt_row.payload
    ) then raise exception 'RESULT_INDETERMINATE'; end if;
    return 'REPLAY_LIVE';
  end if;
  if identity_row.state <> 'RESERVED' then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  update notes_identity_proof.identities set state = 'LIVE' where id = p_id;
  insert into notes_identity_proof.notes values (p_id, actor_id, p_payload);
  begin
    insert into notes_identity_proof.receipts values (actor_id, p_operation, p_id, payload_digest, p_payload);
  exception when unique_violation then
    get stacked diagnostics conflict_constraint = constraint_name;
    if conflict_constraint = 'receipts_owner_operation_key' then
      raise exception 'OPERATION_CONFLICT';
    end if;
    raise;
  end;
  return 'CREATED';
end $$;

create function notes_identity_proof.retire(p_id text) returns text
language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := notes_identity_proof.actor();
  identity_row notes_identity_proof.identities%rowtype;
begin
  select * into identity_row from notes_identity_proof.identities
    where id = p_id and owner_id = actor_id for update;
  if not found or identity_row.owner_id <> actor_id then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  if identity_row.state = 'RETIRED' then return 'ALREADY_RETIRED'; end if;
  delete from notes_identity_proof.notes where id = p_id and owner_id = actor_id;
  update notes_identity_proof.identities set state = 'RETIRED' where id = p_id;
  return 'RETIRED';
end $$;

create function notes_identity_proof.read_note(p_id text) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := notes_identity_proof.actor();
  identity_row notes_identity_proof.identities%rowtype;
begin
  select * into identity_row from notes_identity_proof.identities
    where id = p_id and owner_id = actor_id for share;
  if not found or identity_row.owner_id <> actor_id then raise exception 'IDENTITY_UNAVAILABLE'; end if;
  return jsonb_build_object('state', identity_row.state, 'payload', (
    select payload from notes_identity_proof.notes where id = p_id and owner_id = actor_id
  ));
end $$;

-- Explicitly remove PostgreSQL's default PUBLIC function execution privilege.
revoke all on all functions in schema notes_identity_proof from public;
grant execute on function notes_identity_proof.reserve(text,uuid) to proof_issuer;
grant execute on function notes_identity_proof.publish(text,text,jsonb),
  notes_identity_proof.retire(text), notes_identity_proof.read_note(text) to proof_a, proof_b;
reset role;
