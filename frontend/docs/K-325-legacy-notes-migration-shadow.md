# K-325 Legacy Notes Migration and Shadow Verification

K-325 adds a dormant, capability-gated bridge that captures the authoritative legacy Notes vault, stages an
inactive `absinthe-local-v2` generation, and verifies it against an immutable manifest. K-325 never changes
which database powers production Notes.

## Legacy source inventory

The production legacy path uses IndexedDB database `absinthe-notes-v1`, version 1, object store `notes`,
with key path `id`. The current fallback is the single localStorage key `notes-v2`. IndexedDB capture reads
keys and records in one readonly transaction. The localStorage adapter captures one atomic `getItem` value;
it does not claim a transaction across unrelated keys.

The adapters are deliberately explicit and do not merge these alternative sources. Before capture, the
developer/operator must establish which path currently powers the vault (IndexedDB primary or confirmed
localStorage fallback), register an explicit durable source authority, and select only the adapter consuming
that authority. An existing empty IndexedDB store or an existing
localStorage key containing `[]` can represent an authoritative empty vault; an absent database/store/key is
`LEGACY_SOURCE_UNAVAILABLE`, not an empty snapshot.

Supported records are the current `NoteBase` shape: `id`, `title`, `body`, optional `createdAt` and
`lastOpenedAt`, `updatedAt`, `folderId`, `deletedAt`, optional `starred`, string properties, and string-array
relations. The older supported variant lacks `createdAt`; conversion deterministically uses `updatedAt` as
its creation time. A numeric non-null `deletedAt` is a tombstone. Unknown fields and malformed values fail
closed instead of being silently discarded.

Validated property and relation names are preserved as exact enumerable own data properties. Construction
uses `Object.fromEntries` rather than assignment through an untrusted key, so `__proto__`, `constructor`, and
`prototype` remain ordinary own keys without replacing or mutating an object prototype. Ordinary,
case-distinct, numeric-looking, punctuation, and Unicode keys receive the same lossless treatment; no key is
trimmed, normalized, inherited, or silently omitted. Empty metadata objects retain the existing absent-field
normalization, while any malformed metadata value rejects the complete source snapshot. Special metadata
keys and values participate in the normalized source record, snapshot and source-record digests, manifest,
staged target entity and target-state digest, exact verification, and verified retry. K-325 performs no
compatibility repair or key-dropping fallback.

The following are deliberately outside this migration:

- folder and active-note localStorage keys;
- obsolete legacy aliases that the current persistence layer already consolidates;
- IndexedDB revision and migration flags, sync cursors, checkpoints, leases, hydration state, conflict flags,
  drafts, UI state, and caches;
- attachment metadata and blob databases. `attachment://` identifiers embedded in Note bodies remain in the
  preserved body and receive a reference-set digest, but K-325 does not copy attachment blobs or metadata.

## Namespace and ownership policy

Legacy Note records have no user ID, project ref, or workspace owner field. The migration therefore never
assigns ownership from the current login or from adapter options. Before an adapter can be constructed, a
dormant explicit API must persist a strict `legacy_notes_source_authority_v1` record in the existing
`migration_state` store. Registration does not read Notes, create a migration session or generation, stage
data, or activate anything.

The authority record contains a strict version/discriminator, operator-supplied authority ID, source type and
descriptor, opaque source-identity digest, exact namespace fingerprint, user/project/device/schema binding,
authenticated or local-only scope, explicit-operator method, timestamps, revocation state, and an authority
digest. It contains no Note payload, token, auth claim, cursor, or migration-session dependency. Immutable
binding fields cannot be rewritten. Revocation only sets `revokedAt` and recomputes the authority digest; it
does not remove source or target evidence.

Authority records live under a reserved global key namespace and are keyed by source-identity digest. One
readwrite transaction scans and validates that global authority namespace before adding a claim. IndexedDB
serializes competing claims on the store, so at most one namespace can bind a source identity; an identical
same-namespace claim reuses the canonical record, while cross-user, cross-project, cross-device, altered-ID,
or conflicting claims fail closed. Malformed records fail as persisted corruption.

Source identity uses an externally issued opaque identity root together with source type and descriptor. The
digest is not a hash of current Note payloads, so identical rows do not establish source continuity. The
binding artifact identifies the physical/logical vault chosen by the operator; K-325 does not and cannot
cryptographically prove that a supplied browser storage handle is that vault. Replacing or recreating a
source therefore requires an explicit new authority identity, and an existing session cannot continue with
that replacement merely because payloads match. No identity marker is written into legacy storage.

Adapters consume a validated authority record and derive namespace and ownership scope only from it. They
cannot accept a caller namespace or synthesize bound evidence from current runtime auth. IndexedDB authority
cannot be used for localStorage or vice versa, and the declared source descriptor must match the adapter.
The persisted authority is revalidated during capture, the atomic capture commit, staging, source-change
failure handling, verification, final verified commit, session reads, cancellation, and verified retry.
Missing, revoked, malformed, replaced, or namespace-mismatched authority fails before target writes or
verification success. Target `ownerId` comes from the validated authority and must match the K-321 namespace.

Per-record foreign, ambiguous, missing, or differently bound evidence also fails closed. The whole legacy
store is treated as one vault only under the explicit durable binding; raw identifiers are not placed in
errors or diagnostics.

## Session and inactive generation

Strict version-1 sessions are stored in the existing `migration_state` store, avoiding a database upgrade.
Each session and manifest bind authority ID/version/digest, source type, source instance and source-identity
digest. Draft-only sessions lacking these fields fail closed; there is no compatibility inference or repair.
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
