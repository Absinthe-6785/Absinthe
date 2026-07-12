# K-324 Transactional Restore and Explicit Resurrection

K-324 implements a dormant restore/import contract for `absinthe-local-v2`. It does not activate the
v2 persistence path, replace the legacy restore path, call the remote mutation API, migrate legacy
data, run synchronization, or restore real user data.

## Package and authority

`RestorePackageV1` is protocol version `1` and contains a safe package ID, zoned export timestamp,
source kind, namespace/project fingerprints, Notes entities, and a manifest count plus SHA-256
content digest. The digest covers the complete ordered entity array and all routing evidence outside
the manifest. Parsing rejects unknown fields, unknown versions/domains, duplicate IDs, unsafe
integers, malformed timestamps, inconsistent live/deleted state, count/digest mismatch, and
oversized payloads.

Limits are 5,000 entities, 2 MiB per package, and 128 KiB per entity. Note titles, bodies, optional
metadata, UUID relations, and timestamps are bounded independently. Packages cannot supply owner,
auth, mutation, outbox, cursor, generation activation, purge, or local database keys. The repository
derives the authoritative namespace fingerprint and project fingerprint from its capability-gated
local context. K-324 uses a fail-closed exact-fingerprint policy; cross-namespace and cross-project
packages are rejected.

## Session lifecycle and generations

The durable lifecycle is:

`created -> validating -> staged -> committing -> committed`

`failed` and `cancelled` are terminal. Non-retryable entity, tombstone, or active-generation conflicts
become `failed` with bounded codes. A transient IndexedDB abort leaves `validating` or `committing`
evidence that can be resumed with the exact same session/package binding. Committed exact retries
return the stored target generation and summary without writing again. Unique indexes on package ID,
package digest, and staging generation prevent a second session from reapplying the same package.
Malformed persisted sessions fail as `CORRUPT_PERSISTED_RECORD`; reads never normalize them or expose
payload/namespace values.

Each session owns a new deterministic `preparing` restore generation. Validation never activates it.
Staging creates a complete overlay target by copying the current active generation and replacing only
planned package entities. Omitted local entities remain present; omission is never deletion authority.
No store is cleared and no active-generation entity is overwritten during staging. Failed staging may
leave diagnosable generation/session metadata, but active reads remain on the predecessor.

## Classification and revision policy

Every package entity is classified deterministically:

- `insert`: no local entity; create local revision 1.
- `skip_identical`: canonical payload and deletion state match; no revision or mutation.
- `replace`: only with explicit `conflictPolicy: 'replace'`; revision is current + 1.
- `preserve_local`: only with explicit `conflictPolicy: 'preserve_local'`; no mutation.
- `conflict`: the default for divergent live data; the session fails before activation.
- `resurrect`: a live package entity overlays a known local tombstone only when
  `allowResurrection` is explicitly true.

Timestamps never choose a winner. Backup revisions and historical update times are provenance only.
Inserted records start at revision 1; replacement and resurrection use exact current revision + 1.
Imported tombstones do not receive implicit deletion authority; ambiguous or divergent tombstone
evidence produces `RESTORE_TOMBSTONE_CONFLICT`.

## Explicit resurrection

Resurrection does not merely clear `deletedAt`. The staged entity records the package/session,
historical source revision/timestamps, the superseded tombstone revision, and a new `restoredAt`.
The active revision increments from the tombstone revision, `updatedAt` is the restore commit time,
and `deletedAt` becomes null only with the transactionally created upsert mutation.

The outbox record stores the same resurrection provenance and
`deliveryBlockCode: REMOTE_RESURRECTION_UNSUPPORTED`. K-322 delivery selection excludes blocked
records. K-323 currently rejects upsert over a remote tombstone, so K-324 never calls K-323 or weakens
its tombstone protections. A later reviewed server policy must explicitly add remote resurrection.
Tombstone history is retained; K-324 implements no physical purge.

## Atomic commit and concurrency

The final IndexedDB transaction spans database metadata, generations, entities, outbox, and restore
sessions. It re-reads the authoritative active generation, session digest/status, staging generation,
the complete active entity set, entity revisions/content, and inherited outbox history. It then:

1. verifies staging still represents an overlay of the current active generation;
2. preserves scoped outbox history in the target generation;
3. creates exactly one pending K-322 upsert for each inserted/replaced/resurrected entity;
4. seals the predecessor and activates the target;
5. updates the metadata pointer; and
6. marks the restore session committed.

The API resolves only from `transaction.oncomplete`. Any request failure or injected abort rolls back
outbox additions, activation, metadata, and committed session status together. Staged entities remain
non-active diagnostic evidence. IndexedDB write serialization plus generation/entity revalidation
ensures that only one restore can commit against an active-generation assumption and that a normal
local mutation after staging cannot be overwritten.

## Errors, resume, and dormancy

Errors are bounded machine codes including protocol/package/count/digest/scope errors, session
conflict/cancellation, active-generation and entity-revision conflicts, tombstone conflicts, remote
resurrection blocking, transaction failure, and persisted corruption. No Note payload is placed in
session metadata or error text.

`resumeRestoreSession` requires the exact package ID, digest, and session ID. `validating` resumes
staging; `staged` or `committing` revalidates and retries the atomic commit. A committed transaction
is recognized only by the consistent committed session and active target generation produced in the
same transaction. Failed/cancelled sessions cannot activate or create outbox entries. No timer,
worker, service worker, network call, checkpoint advancement, cleanup, production import, UI wiring,
legacy IndexedDB mutation, migration, or cutover is included.
