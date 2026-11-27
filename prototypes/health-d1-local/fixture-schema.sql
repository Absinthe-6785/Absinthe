-- In-memory Miniflare fixture schema only. No migration or seed endpoint.
CREATE TABLE workout_authority (
  owner TEXT NOT NULL, project TEXT NOT NULL, epoch INTEGER NOT NULL CHECK (epoch > 0),
  server_epoch TEXT NOT NULL, is_open INTEGER NOT NULL CHECK (is_open IN (0, 1)),
  PRIMARY KEY (owner, project)
) WITHOUT ROWID;
-- fixture-statement
CREATE TABLE workout_bindings (
  owner TEXT NOT NULL, project TEXT NOT NULL, namespace TEXT NOT NULL, generation TEXT NOT NULL,
  device TEXT NOT NULL, binding TEXT NOT NULL UNIQUE, epoch INTEGER NOT NULL,
  is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
  PRIMARY KEY (owner, project, namespace, generation),
  FOREIGN KEY (owner, project) REFERENCES workout_authority (owner, project)
) WITHOUT ROWID;
-- fixture-statement
CREATE TABLE workout_entities (
  owner TEXT NOT NULL, project TEXT NOT NULL, entity TEXT NOT NULL,
  revision INTEGER NOT NULL, sequence INTEGER NOT NULL,
  PRIMARY KEY (owner, project, entity),
  FOREIGN KEY (owner, project, sequence) REFERENCES workout_changes (owner, project, sequence)
) WITHOUT ROWID;
-- fixture-statement
CREATE TABLE workout_changes (
  owner TEXT NOT NULL, project TEXT NOT NULL, sequence INTEGER NOT NULL
    CHECK (sequence BETWEEN 1 AND 9007199254740991),
  entity TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  record TEXT NOT NULL, content_hash TEXT NOT NULL, remote_ref TEXT NOT NULL UNIQUE,
  committed_at TEXT NOT NULL, epoch INTEGER NOT NULL, server_epoch TEXT NOT NULL, binding TEXT NOT NULL,
  mutation TEXT NOT NULL, idempotency TEXT NOT NULL, payload_hash TEXT NOT NULL, digest TEXT NOT NULL,
  PRIMARY KEY (owner, project, sequence)
) WITHOUT ROWID;
-- fixture-statement
CREATE TABLE workout_receipts (
  owner TEXT NOT NULL, project TEXT NOT NULL, mutation TEXT NOT NULL,
  idempotency TEXT NOT NULL, sequence INTEGER NOT NULL,
  PRIMARY KEY (owner, project, mutation),
  UNIQUE (owner, project, idempotency),
  FOREIGN KEY (owner, project, sequence) REFERENCES workout_changes (owner, project, sequence)
) WITHOUT ROWID;

-- fixture-statement
-- Only the guarded event insert can advance the current entity. The mutable
-- pointer avoids storing a second copy of the current record. The receipt never
-- points to that mutable pointer: both reads of history use the original event.
CREATE TRIGGER workout_commit_revision AFTER INSERT ON workout_changes BEGIN
  INSERT INTO workout_entities (owner, project, entity, revision, sequence)
    VALUES (new.owner, new.project, new.entity, new.revision, new.sequence)
    ON CONFLICT (owner, project, entity) DO UPDATE SET revision = excluded.revision, sequence = excluded.sequence;
  INSERT INTO workout_receipts (owner, project, mutation, idempotency, sequence)
    VALUES (new.owner, new.project, new.mutation, new.idempotency, new.sequence);
END;
