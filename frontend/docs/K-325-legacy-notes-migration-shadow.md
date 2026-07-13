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

Legacy IndexedDB discovery and open use a one-settlement request boundary. A blocked open, browser open
error, or unexpected upgrade rejects immediately as the bounded
`LEGACY_SOURCE_UNAVAILABLE:open_legacy_database` outcome; an unexpected upgrade transaction is aborted.
If a database handle arrives after an earlier rejection, it is closed without changing the primary outcome.
A successful open transfers handle ownership to the readonly capture, which closes it in `finally`. These
paths do not retry, select localStorage automatically, create migration evidence, or mutate the legacy source.

Supported records are the current `NoteBase` shape: `id`, `title`, `body`, optional `createdAt` and
`lastOpenedAt`, `updatedAt`, `folderId`, `deletedAt`, optional `starred`, string properties, and string-array
relations. The older supported variant lacks `createdAt`; conversion deterministically uses `updatedAt` as
its creation time. A numeric non-null `deletedAt` is a tombstone. Unknown fields and malformed values fail
closed instead of being silently discarded.

K-325G validates this shape exclusively through own property descriptors before reading source values.
`id`, `title`, `body`, `updatedAt`, `folderId`, and `deletedAt` are required own data properties. `createdAt`,
`lastOpenedAt`, `starred`, `properties`, and `relations` are optional, but when present they must also be own
data properties. A prototype-only optional value is absent; a prototype-only required value cannot satisfy
the schema. Null-prototype and custom-prototype containers are allowed when their own fields satisfy the
same strict contract, while inherited values never enter normalization, digests, manifests, or target rows.
Unknown own string keys, symbol keys, and accessor descriptors are rejected. Accessors are rejected from
their descriptors without invoking getters or setters.

Identifiers must be nonempty and contain at least one ECMAScript non-whitespace code point (`/\S/u`). A
nonblank accepted ID, including leading/trailing whitespace or Unicode-distinct spelling, is preserved
byte-for-byte; validation never trims or rewrites it. The supported no-`createdAt` variant remains the only
missing-field compatibility form, and it deterministically reuses the validated `updatedAt` value.

Validated property and relation names and values are preserved exactly as normalized own data properties. Construction
uses `Object.fromEntries` rather than assignment through an untrusted key, so `__proto__`, `constructor`, and
`prototype` remain ordinary own keys without replacing or mutating an object prototype. Ordinary,
case-distinct, numeric-looking, punctuation, and Unicode keys receive the same lossless treatment; no key is
trimmed, normalized, inherited, or silently omitted. Empty metadata objects retain the existing absent-field
normalization, while any malformed metadata value rejects the complete source snapshot. Special metadata
keys and values participate in the normalized source record, snapshot and source-record digests, manifest,
staged target entity and target-state digest, exact verification, and verified retry. K-325 performs no
compatibility repair or key-dropping fallback.

Nested `properties` and `relations` containers use the same own-descriptor boundary. Arbitrary own string
metadata keys, including `__proto__`, `constructor`, `prototype`, case-distinct keys, and Unicode-distinct
keys, are preserved without assignment through prototype setters. Inherited keys are ignored, symbol keys
and accessors are rejected, and non-enumerable own data keys are preserved as normalized own data. Relation
arrays must be real dense arrays whose `length` and every index are own data properties; sparse arrays,
prototype-provided indices, accessor indices, malformed elements, and proxy/descriptor failures reject the
whole snapshot. Duplicate relation values retain the existing source semantics.

All source-controlled shape inspection, descriptor lookup, nested validation, normalization, and plan/digest
construction run behind a bounded validation boundary before a migration session is written. One malformed
row rejects the complete snapshot: no session, manifest, generation, entity, outbox, checkpoint, or active
pointer change is committed. Unexpected proxy, descriptor, validation, or canonicalization exceptions map
to the generic `INVALID_LEGACY_MIGRATION:validate_legacy_source` error. Original exception objects, messages,
stacks, property names, and source payloads are neither returned nor persisted.

The following are deliberately outside this migration:

- folder and active-note localStorage keys;
- obsolete legacy aliases that the current persistence layer already consolidates;
- IndexedDB revision and migration flags, sync cursors, checkpoints, leases, hydration state, conflict flags,
  drafts, UI state, and caches;
- attachment metadata and blob databases. `attachment://` identifiers embedded in Note bodies remain in the
  preserved body and receive a reference-set digest, but K-325 does not copy attachment blobs or metadata.

Attachment reference extraction reuses the application's canonical, case-sensitive whole-reference parser.
The parser accepts only complete `attachment://` tokens whose IDs satisfy the application attachment-ID
grammar. It de-duplicates recognized IDs without locale-sensitive ordering; K-325 then applies its canonical
comparator before hashing the set. Embedded schemes, URL-path substrings, valid-looking prefixes of malformed
percent-encoded/path/query/fragment tokens, encoded or escaped schemes, and identifiers truncated at Unicode
or zero-width continuations are not attachment references. They remain ordinary, byte-preserved body text.
The full source-record and target-entity digests independently bind that complete body, so changing any such
text is still detected even when the recognized reference set remains empty. A syntactically valid reference
does not require local metadata or a blob to exist: K-325 reads neither store and never claims either asset was
migrated, repaired, uploaded, or verified.

## Namespace and ownership policy

Legacy Note records have no user ID, project ref, or workspace owner field. The migration therefore never
assigns ownership from the current login or from adapter options. Before an adapter can be constructed, a
dormant explicit API must persist a strict `legacy_notes_source_authority_v1` record in the existing
`migration_state` store. Registration does not read Notes, create a migration session or generation, stage
data, or activate anything.

Registration stores two mutually linked strict records under the reserved global authority namespace. A
`legacy_notes_source_root_binding_v1` record is keyed as `root:<externalRootDigest>`; the root digest is a
domain-separated SHA-256 digest of the bounded, operator-issued opaque root alone. Source type, descriptor,
namespace, authority ID, and ownership do not affect that global exclusivity key. A separate domain-separated
`sourceBindingDigest` covers the root digest plus exact source type and descriptor/instance. Type or descriptor
changes therefore alter the full binding evidence but cannot create a second root-level exclusivity domain.

The strict `legacy_notes_source_authority_v1` record is keyed as `authority:<authorityId>` and binds the root
digest, root-binding version/digest, full source-binding digest, exact namespace fingerprint,
user/project/device/schema, authenticated or local-only scope, explicit-operator method, timestamps,
revocation state, and authority digest. The root and authority records point to each other and must agree on
every binding field. Both are created with `add` in one `migration_state` readwrite transaction after a global
scan; either both commit or neither does. An exact repeated claim returns the canonical record. Reusing a root
with another type, descriptor, namespace, owner, project, device, schema, ownership mode, or authority ID is a
bounded conflict. Orphans, duplicate keys, malformed records, and broken mutual references are corruption and
are never repaired.

Neither record contains the opaque root, Note payload, token, auth claim, cursor, or migration-session data.
The digests are not hashes of current Note payloads, so identical rows do not establish source continuity.
The operator-issued root asserts which physical/logical vault is being bound; K-325 cannot cryptographically
prove that a supplied browser storage handle is that vault. Replacing or recreating a source requires an
explicit new root, and an existing session cannot continue merely because payloads match. No identity marker
is written into legacy storage. Revocation changes only `revokedAt` and the authority digest; the immutable
root binding remains intact and no source or target evidence is removed.

Adapters consume a validated authority record and derive namespace and ownership scope only from it. They
cannot accept a caller namespace or synthesize bound evidence from current runtime auth. IndexedDB authority
cannot be used for localStorage or vice versa, and the declared source descriptor must match the adapter.
The persisted authority and root binding are revalidated during capture, atomic capture commit, staging,
source-change failure handling, verification, final verified commit, continuation session reads, and verified
retry. Missing, revoked, malformed, replaced, or namespace-mismatched evidence fails before target writes or
verification success. Target `ownerId` comes from the validated authority and must match the K-321 namespace.

Per-record foreign, ambiguous, missing, or differently bound evidence also fails closed. The whole legacy
store is treated as one vault only under the explicit durable binding; raw identifiers are not placed in
errors or diagnostics.

## Session and inactive generation

Strict version-1 sessions are stored in the existing `migration_state` store, avoiding a database upgrade.
Each session and manifest bind authority ID/version/digest, external-root digest, root-binding version/digest,
full source-binding digest, source type, and source instance. Draft-only sessions lacking these fields fail
closed; there is no compatibility inference or repair.
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
Database metadata, target generation, and entity-envelope validators are wrapped only at this K-325 durable
target-read boundary. Their input-oriented validation failures and unexpected exceptions are normalized to
the bounded `CORRUPT_PERSISTED_RECORD:validate_persisted_legacy_target` result without retaining a cause,
payload, field value, or original exception message. New caller-provided entities and malformed public
migration requests keep their existing `INVALID_ENTITY` or `INVALID_LEGACY_MIGRATION` semantics; K-325 does
not globally remap validation errors. Staged target evidence is preflight-validated before the lifecycle is
advanced to `verifying`, so corruption cannot rewrite the session or trigger repair, cleanup, or activation.

Continuation and administration are separate contracts. Capture, resume, stage, verification, and verified
retry require a live, valid, non-revoked authority/root pair. The bounded administrative view reads only a
strict session and reports its ID, lifecycle state, namespace fingerprint, authority ID and bounded status
(`valid`, `revoked`, `missing`, `corrupt`, or `mismatched`), target generation ID, timestamps, failure code, and
whether continuation is allowed. It never reads the legacy source or returns manifest/Note contents.

Cancellation is namespace-scoped administrative terminalization and is allowed from `capturing`, `staged`, or
`verifying` even when authority evidence is missing, revoked, mismatched, or corrupt. It atomically changes
only the strict session status to `cancelled`; it does not rewrite its captured authority digest, repair root or
authority evidence, delete the manifest/generation/entities, access legacy storage, activate the target, or
write outbox/checkpoint state. Repeated cancellation is idempotent. Verified and failed sessions cannot be
cancelled. A corrupt session or another namespace cannot be inspected or cancelled. Failed or cancelled
sessions do not retry automatically.

## Dormancy and limitations

The API is available only from an explicitly capability-gated `LocalDatabaseRepository`. No production store,
component, startup path, timer, worker, service worker, network client, Supabase adapter, or K-323 call invokes
it. Tests use fake-indexeddb and synthetic Notes only. K-325 does not perform cutover, activation, dual-write,
incremental shadowing, remote reconciliation, attachment migration, or automatic cleanup.
