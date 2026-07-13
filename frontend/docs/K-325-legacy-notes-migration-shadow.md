# K-325 Legacy Notes Migration and Shadow Verification

K-325 adds a dormant, capability-gated bridge that captures the authoritative legacy Notes vault, stages an
inactive `absinthe-local-v2` generation, and verifies it against an immutable manifest. K-325 never changes
which database powers production Notes.

## Legacy source inventory

The production legacy path uses IndexedDB database `absinthe-notes-v1`, version 1, object store `notes`,
with key path `id`. The current fallback is the single localStorage key `notes-v2`. IndexedDB capture reads
keys and records in one readonly transaction. The localStorage adapter captures one atomic `getItem` value;
it does not claim a transaction across unrelated keys.

The adapters are deliberately explicit and do not merge these alternative authorities. Before capture, the
developer caller must establish which path currently powers the vault (IndexedDB primary or confirmed
localStorage fallback) and select only that adapter. An existing empty IndexedDB store or an existing
localStorage key containing `[]` can represent an authoritative empty vault; an absent database/store/key is
`LEGACY_SOURCE_UNAVAILABLE`, not an empty snapshot.

Supported records are the current `NoteBase` shape: `id`, `title`, `body`, optional `createdAt` and
`lastOpenedAt`, `updatedAt`, `folderId`, `deletedAt`, optional `starred`, string properties, and string-array
relations. The older supported variant lacks `createdAt`; conversion deterministically uses `updatedAt` as
its creation time. A numeric non-null `deletedAt` is a tombstone. Unknown fields and malformed values fail
closed instead of being silently discarded.

The following are deliberately outside this migration:

- folder and active-note localStorage keys;
- obsolete legacy aliases that the current persistence layer already consolidates;
- IndexedDB revision and migration flags, sync cursors, checkpoints, leases, hydration state, conflict flags,
  drafts, UI state, and caches;
- attachment metadata and blob databases. `attachment://` identifiers embedded in Note bodies remain in the
  preserved body and receive a reference-set digest, but K-325 does not copy attachment blobs or metadata.

## Namespace and ownership policy

Legacy Note records have no user ID, project ref, or workspace owner field. The migration therefore never
assigns ownership from the current login. An adapter must carry a separately established namespace
fingerprint and declare either authenticated or local-only vault scope. That fingerprint must exactly match
the K-321 namespace. Per-record foreign, ambiguous, missing, or differently bound evidence fails closed.
The whole legacy store is treated as one vault only under that explicit adapter binding; raw user IDs are not
placed in diagnostics.

## Session and inactive generation

Strict version-1 sessions are stored in the existing `migration_state` store, avoiding a database upgrade.
K-325 does not share its persisted migration-state identifier space with unrelated migration record types.
The public logical session ID remains unchanged, while the stored compound key uses the deterministic
`k325:legacy-notes:<logical-session-id>` identifier. Persisted records bind that storage ID to a separate
logical session field plus the strict `legacy_notes_migration_v1` discriminator and version. All direct
lookups derive the prefixed key internally, and namespace scans parse only that discriminator. A malformed
prefix, mismatched storage/logical ID, discriminator, or version fails closed; unrelated rows with the same
logical ID coexist without being rewritten, deleted, or reclassified.
The `k325:legacy-notes:` prefix is reserved exclusively for internal persisted storage IDs. Public callers
never pass or receive storage IDs: logical IDs beginning with the reserved prefix, including prefix-only and
double-prefixed values, fail as `INVALID_LEGACY_MIGRATION` before any durable write or lookup. Ordinary
colon-containing logical IDs remain supported. A malformed persisted prefix or storage/logical relationship
is persisted-state corruption and continues to fail as `CORRUPT_PERSISTED_RECORD`.
K-325 uses one locale-independent canonical string comparator everywhere ordering contributes to persisted
state or a digest: case-sensitive JavaScript UTF-16 code-unit lexicographic order (`<` / `>`), with no case
folding, trimming, or Unicode normalization. Manifest generation and validation share the same domain/entity
tuple comparator; canonical object keys and attachment-reference sets use the same string comparator.
Snapshot and aggregate digest results are therefore independent of host locale and source enumeration order,
while case-distinct and Unicode-distinct identifiers remain distinct. Noncanonical persisted manifests still
fail closed, and this Draft implementation adds no compatibility reader, reordering repair, or auto-migration.
The lifecycle is `capturing -> staged -> verifying -> verified`, with terminal `cancelled` and `failed`
states. The session contains bounded source identity, counts, digests, target generation identity, manifest,
result counts, timestamps, and bounded failure codes—never Note payloads, auth state, tokens, cursors, or
queue state.

Capture persists the manifest before staging. The first resume transactionally creates the complete target
generation and entities and marks the session staged. A later resume or explicit verification continues from
that durable boundary. A namespace may have only one nonterminal migration session; exact duplicate capture
resolves deterministically to the existing session.

The target generation has creation reason `migration`, source kind `legacy_migration`, no fabricated
predecessor, status `preparing`, and no active-namespace index value. K-325 never updates the metadata active
generation pointer. It creates no outbox mutation or sync checkpoint.

## Conversion and manifest

Each legacy record becomes one revision-1 local entity. Domain timestamps come from the legacy record; the
migration time is stored only in migration provenance. Live records remain live and tombstones retain their
deletion timestamp. Title, body, folder reference, starred state, properties, relations, optional last-opened
time, and embedded attachment references remain in the domain payload.

Migration provenance binds conversion version, source adapter/schema, migration session, source snapshot
digest, migration time, and a one-way legacy-key digest. The entity owner is the already-authorized K-321
namespace owner; it is not inferred from a Note.

The canonical manifest is sorted by `domain + entityId`, rejects duplicate entity IDs and legacy keys, is
limited to 5,000 entries and 4 MiB, and contains no Note payload. Each entry binds classification, revisions,
source record digest, target entity digest, attachment-reference digest, and source timestamps. SHA-256
digests bind the source snapshot, manifest, and complete target durable state.

## Shadow verification and source-change fencing

A migration is verified only when the durable inactive target generation exactly matches the captured legacy
snapshot. Verification checks the complete key set, every entity digest, classification, revision, timestamps,
ownership, source and migration provenance, aggregate target digest, generation graph, unchanged active
pointer, and absence of target outbox/checkpoint rows. Counts alone never establish success.

The source is captured before target verification and again after it. Either capture differing from the
persisted snapshot or manifest fails the session with `MIGRATION_SOURCE_CHANGED`; no delta is merged and a new
session is required. Because legacy and new storage are separate databases and production writes are not
frozen, this is double-read fencing rather than a cross-database transaction.

Verified retries recapture the source and revalidate all durable target evidence before returning the stored
result. Missing, extra, malformed, or altered session, manifest, generation, entity, result, outbox, or
checkpoint evidence maps to `CORRUPT_PERSISTED_RECORD`; no repair, regeneration, cleanup, or activation runs.

Cancellation is allowed only before verification. It preserves any inactive staged evidence and never writes
the legacy store. Failed or cancelled sessions do not retry automatically.

## Dormancy and limitations

The API is available only from an explicitly capability-gated `LocalDatabaseRepository`. No production store,
component, startup path, timer, worker, service worker, network client, Supabase adapter, or K-323 call invokes
it. Tests use fake-indexeddb and synthetic Notes only. K-325 does not perform cutover, activation, dual-write,
incremental shadowing, remote reconciliation, attachment migration, or automatic cleanup.
