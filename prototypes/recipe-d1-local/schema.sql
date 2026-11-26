CREATE TABLE recipes (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  steps TEXT NOT NULL,
  memo TEXT NOT NULL,
  starred INTEGER NOT NULL CHECK (starred IN (0, 1)),
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  edit_revision TEXT NOT NULL
) STRICT;

CREATE INDEX recipes_owner_active_order ON recipes (user_id, created_at DESC, id)
  WHERE deleted_at IS NULL;

CREATE INDEX recipes_owner_trash_order ON recipes (user_id, deleted_at DESC, id)
  WHERE deleted_at IS NOT NULL;
