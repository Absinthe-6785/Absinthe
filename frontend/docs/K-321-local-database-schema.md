# K-321 Dormant Local-First Database Foundation

K-321 creates a dormant local database foundation. It does not migrate user data, replace the
current runtime database, restore backups, or synchronize with Supabase.

## Database boundary

- Database name: `absinthe-local-v2`
- Database version: `1`
- Persistence schema version: `1`
- Opening requires an explicit developer/test capability. No production component imports the
  repository and no automatic initialization occurs.
- The legacy Notes, attachment, and localStorage stores coexist unchanged. The new code never opens
  a legacy database for mutation and never deletes a database.

## Namespace and keys

Every repository instance requires `userId`, `projectRef`, `deviceId`, `generationId`, and
`schemaVersion`. Components are bounded, credential-hostile safe identifiers. A SHA-256 fingerprint
of `[userId, projectRef, deviceId, schemaVersion]` is the namespace scope; generation remains a
separate compound-key dimension so generation activation can change without changing account,
project, or device scope.

Entity primary keys are structured IndexedDB compound keys:

`[namespaceKey, generationId, domain, entityId]`

Normal entities use a length-prefixed ID identity. Owner/date entities use a length-prefixed owner
and validated calendar date. Singleton identities contain owner plus singleton kind. Attachments use
an explicit attachment identity. Delimiter concatenation is not used to interpret components.

## Stores

| Store | Primary key | Purpose |
|---|---|---|
| `database_meta` | `namespaceKey` | Format, compatibility, and authoritative active generation |
| `generations` | `[namespaceKey, generationId]` | Preparing/active/sealed/abandoned/failed generations |
| `entities` | `[namespaceKey, generationId, domain, entityId]` | Payload-separated entity envelopes and tombstones |
| `outbox` | `[namespaceKey, generationId, mutationId]` | K-322 durable mutation reservation |
| `sync_checkpoints` | `[namespaceKey, generationId, provider, stream]` | Per-provider, per-stream checkpoints; no global cursor |
| `restore_sessions` | `[namespaceKey, sessionId]` | Restore staging metadata only |
| `migration_state` | `[namespaceKey, migrationId]` | Migration planning metadata only |
| `attachment_state` | `[namespaceKey, generationId, attachmentId]` | Attachment metadata only; no blob access |

Indexes cover generation status/creation, entity domain/owner/deletion state/update time, outbox
status/entity/idempotency, provider checkpoints, session status, migration phase, and attachment
sync/update state. `generations.activeNamespaceKey` has a unique index, enforcing at most one active
generation for each namespace in addition to the authoritative metadata pointer.

## Generations and durable fencing

Initialization creates one active generation. New generations begin `preparing`. Activation uses one
transaction across metadata and generations: it verifies the caller's expected active generation,
seals the predecessor, activates the target, and updates the metadata pointer. Failed activation
aborts all changes. Every entity or generation-scoped reserved-store write reads metadata and the
generation record inside its write transaction. Stale, sealed, abandoned, or failed generations
cannot write.

## Entity, revision, and tombstone rules

Payload is stored unchanged in `record`; namespace, identity, owner, revision, timestamps, deletion,
hash, and safe source data live in the envelope. Initial revision is `1`. Updates and tombstones
increment revision inside the transaction. `expectedRevision` provides compare-and-set semantics;
timestamps never choose a winner. Tombstones remain records with `deletedAt` and `deletionState` and
ordinary upsert cannot resurrect them. Physical purge, `clear()`, full-array replacement, and
unscoped reads are absent.

## Transaction guarantees

`runEntityMutationTransaction` can commit one entity mutation and one reserved outbox record in the
same IndexedDB transaction. Namespace/generation, revision, entity, and outbox validation occur
inside that flow. Its promise resolves only from `transaction.oncomplete`; abort or request failure
rejects with a machine-readable code and neither store retains a partial write. K-321 does not run,
upload, retry, or acknowledge outbox entries.

## Recovery and unsupported behavior

Recovery mode remains default-active. K-319 guards and K-320 exports are not bypassed or invoked.
K-321 does not implement migration, cutover, dual write, shadow read, restore, import, synchronization,
Supabase access, remote merge, conflict-winner selection, queue processing, attachment blob movement,
service-worker changes, UI changes, or legacy database deletion. K-322 may build the outbox runner on
the atomic reservation; K-323 may define remote synchronization against scoped checkpoints. Both
require separate review and activation work.
