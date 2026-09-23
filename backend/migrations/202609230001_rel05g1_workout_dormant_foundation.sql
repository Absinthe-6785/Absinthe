begin;

create table if not exists public.health_workout_sessions_v2 (
  user_id uuid not null,
  project_scope text not null
    check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  id uuid not null,
  revision bigint not null
    check (revision between 1 and 9007199254740991),
  record jsonb not null,
  is_deleted boolean not null,
  deleted_at timestamptz,
  last_remote_mutation_ref uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint health_workout_sessions_v2_pkey
    primary key (user_id, project_scope, id),
  constraint health_workout_sessions_v2_id_uuid_v4
    check (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  constraint health_workout_sessions_v2_record_object
    check (jsonb_typeof(record) = 'object'),
  constraint health_workout_sessions_v2_record_id
    check (record ->> 'id' is not null and record ->> 'id' = id::text),
  constraint health_workout_sessions_v2_tombstone_shape
    check (is_deleted = (deleted_at is not null))
);

alter table public.health_workout_sessions_v2 enable row level security;

create table if not exists public.health_workout_capabilities (
  user_id uuid not null,
  project_scope text not null
    check (project_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  state text not null default 'DISABLED',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint health_workout_capabilities_pkey
    primary key (user_id, project_scope),
  constraint health_workout_capabilities_known_state
    check (state in ('DISABLED', 'FOUNDATION_READY', 'ADOPTION_READY', 'ACTIVE')),
  constraint health_workout_capabilities_g1_dormant_only
    check (state = 'DISABLED')
);

alter table public.health_workout_capabilities enable row level security;

revoke all on public.health_workout_sessions_v2
  from public, anon, authenticated, service_role;
revoke all on public.health_workout_capabilities
  from public, anon, authenticated, service_role;
grant select on public.health_workout_capabilities to service_role;

create or replace function public.read_health_workout_capability_v1(
  p_authenticated_owner_id uuid,
  p_project_scope text
)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_state text;
begin
  if p_authenticated_owner_id is null
    or p_project_scope is null
    or p_project_scope !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception using
      errcode = '22023',
      message = 'REL05G1_INVALID_CAPABILITY_SCOPE';
  end if;

  select capability.state into v_state
  from public.health_workout_capabilities as capability
  where capability.user_id = p_authenticated_owner_id
    and capability.project_scope = p_project_scope;

  return coalesce(v_state, 'DISABLED');
end
$$;

revoke all on function public.read_health_workout_capability_v1(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_health_workout_capability_v1(uuid, text)
  to service_role;

-- IF NOT EXISTS follows the repository's additive migration convention. These
-- checks make a pre-existing object with an incompatible shape fail the whole
-- transaction instead of being silently accepted.
do $$
declare
  v_primary_key name[];
  v_columns name[];
  v_column_types text[];
  v_column_not_null boolean[];
  v_not_null_count integer;
  v_column_count integer;
begin
  select array_agg(attribute.attname order by attribute.attnum),
         array_agg(pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) order by attribute.attnum),
         array_agg(attribute.attnotnull order by attribute.attnum),
         count(*) filter (where attribute.attnotnull)::integer
    into v_columns, v_column_types, v_column_not_null, v_not_null_count
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.health_workout_sessions_v2'::regclass
    and attribute.attnum > 0 and not attribute.attisdropped;
  if v_columns is distinct from array[
      'user_id', 'project_scope', 'id', 'revision', 'record', 'is_deleted',
      'deleted_at', 'last_remote_mutation_ref', 'created_at', 'updated_at'
    ]::name[] then
    raise exception 'REL05G1_WORKOUT_TABLE_COLUMN_NAMES_MISMATCH';
  end if;
  if v_column_types is distinct from array[
      'uuid', 'text', 'uuid', 'bigint', 'jsonb', 'boolean',
      'timestamp with time zone', 'uuid', 'timestamp with time zone', 'timestamp with time zone'
    ]::text[] or v_column_not_null is distinct from array[
      true, true, true, true, true, true, false, false, true, true
    ]::boolean[] or v_not_null_count <> 8 then
    raise exception 'REL05G1_WORKOUT_TABLE_COLUMN_TYPES_MISMATCH';
  end if;

  select array_agg(attribute.attname order by key_column.ordinality)
    into v_primary_key
  from pg_catalog.pg_constraint as constraint_row
  cross join lateral unnest(constraint_row.conkey) with ordinality
    as key_column(attnum, ordinality)
  join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = constraint_row.conrelid
   and attribute.attnum = key_column.attnum
  where constraint_row.conrelid = 'public.health_workout_sessions_v2'::regclass
    and constraint_row.contype = 'p';

  if v_primary_key is distinct from array['user_id', 'project_scope', 'id']::name[] then
    raise exception 'REL05G1_WORKOUT_TABLE_PRIMARY_KEY_MISMATCH';
  end if;

  select count(*) into v_column_count
  from pg_catalog.pg_attribute
  where attrelid = 'public.health_workout_sessions_v2'::regclass
    and attnum > 0 and not attisdropped;
  if v_column_count <> 10 then
    raise exception 'REL05G1_WORKOUT_TABLE_COLUMN_SHAPE_MISMATCH';
  end if;

  if exists (
      select 1 from pg_catalog.pg_index
      where indrelid = 'public.health_workout_sessions_v2'::regclass
        and indisunique and not indisprimary
    ) or exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_sessions_v2'::regclass
        and contype = 'f'
    ) then
    raise exception 'REL05G1_WORKOUT_TABLE_UNPLANNED_UNIQUENESS_OR_FOREIGN_KEY';
  end if;

  if not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_sessions_v2'::regclass
        and conname = 'health_workout_sessions_v2_id_uuid_v4' and contype = 'c'
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_sessions_v2'::regclass
        and conname = 'health_workout_sessions_v2_project_scope_check' and contype = 'c'
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_sessions_v2'::regclass
        and conname = 'health_workout_sessions_v2_revision_check' and contype = 'c'
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_sessions_v2'::regclass
        and conname = 'health_workout_sessions_v2_record_object' and contype = 'c'
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_sessions_v2'::regclass
        and conname = 'health_workout_sessions_v2_tombstone_shape' and contype = 'c'
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_sessions_v2'::regclass
        and conname = 'health_workout_sessions_v2_record_id' and contype = 'c'
    ) then
    raise exception 'REL05G1_WORKOUT_TABLE_CONSTRAINT_MISMATCH';
  end if;

  if not (
      select relrowsecurity from pg_catalog.pg_class
      where oid = 'public.health_workout_sessions_v2'::regclass
    ) then
    raise exception 'REL05G1_WORKOUT_TABLE_RLS_DISABLED';
  end if;

  select array_agg(attribute.attname order by key_column.ordinality)
    into v_primary_key
  from pg_catalog.pg_constraint as constraint_row
  cross join lateral unnest(constraint_row.conkey) with ordinality
    as key_column(attnum, ordinality)
  join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = constraint_row.conrelid
   and attribute.attnum = key_column.attnum
  where constraint_row.conrelid = 'public.health_workout_capabilities'::regclass
    and constraint_row.contype = 'p';

  if v_primary_key is distinct from array['user_id', 'project_scope']::name[] then
    raise exception 'REL05G1_CAPABILITY_TABLE_PRIMARY_KEY_MISMATCH';
  end if;

  select array_agg(attribute.attname order by attribute.attnum),
         array_agg(pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) order by attribute.attnum),
         array_agg(attribute.attnotnull order by attribute.attnum),
         count(*) filter (where attribute.attnotnull)::integer
    into v_columns, v_column_types, v_column_not_null, v_not_null_count
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = 'public.health_workout_capabilities'::regclass
    and attribute.attnum > 0 and not attribute.attisdropped;
  if v_columns is distinct from array[
      'user_id', 'project_scope', 'state', 'created_at', 'updated_at'
    ]::name[] then
    raise exception 'REL05G1_CAPABILITY_TABLE_COLUMN_NAMES_MISMATCH';
  end if;
  if v_column_types is distinct from array[
      'uuid', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone'
    ]::text[] or v_column_not_null is distinct from array[
      true, true, true, true, true
    ]::boolean[] or v_not_null_count <> 5 then
    raise exception 'REL05G1_CAPABILITY_TABLE_COLUMN_TYPES_MISMATCH';
  end if;

  if not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_capabilities'::regclass
        and conname = 'health_workout_capabilities_g1_dormant_only' and contype = 'c'
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_capabilities'::regclass
        and conname = 'health_workout_capabilities_project_scope_check' and contype = 'c'
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.health_workout_capabilities'::regclass
        and conname = 'health_workout_capabilities_known_state' and contype = 'c'
    )
    or not (
      select relrowsecurity from pg_catalog.pg_class
      where oid = 'public.health_workout_capabilities'::regclass
    ) then
    raise exception 'REL05G1_CAPABILITY_TABLE_NOT_DORMANT_OR_RLS_DISABLED';
  end if;
end
$$;

commit;
