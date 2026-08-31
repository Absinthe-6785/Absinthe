begin;

-- Normal Recipe deletion is recoverable. Existing rows remain active because
-- the new nullable state column defaults to NULL.
alter table public.recipes
  add column if not exists deleted_at timestamptz;

create index if not exists recipes_user_deleted_at_created_at_idx
  on public.recipes (user_id, deleted_at, created_at desc);

commit;
