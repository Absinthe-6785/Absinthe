begin;

-- Deploy the backend that strips edit_revision from Recipe exports BEFORE
-- applying this file. The former SELECT * exporter would expose the column
-- and make those archives fail restore validation. Keep the export filter
-- in place on rollback while the column exists. Edit saves can remain
-- unavailable during this handoff; never fall back to unconditional PUT.
alter table public.recipes
  add column edit_revision uuid not null default pg_catalog.gen_random_uuid();

-- A version is authority for this live row only, not restorable user content.
-- Rotate on every write, including favorites, soft delete, and restore.
create function public.assign_recipe_edit_revision()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.edit_revision := pg_catalog.gen_random_uuid();
  return new;
end;
$$;

create trigger recipes_assign_edit_revision
  before insert or update on public.recipes
  for each row execute function public.assign_recipe_edit_revision();

commit;
