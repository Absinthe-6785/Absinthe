# K-334P09B04B06A — Minimal-v1 Migration and Recovery Safety Package

| Field | Value |
| --- | --- |
| Type | `K334MinimalV1MigrationRecoverySafetyPackage` |
| ID | `K-334P09B04B06A-MINIMAL-V1-MIGRATION-RECOVERY-PACKAGE-001` |
| Status | `MINIMAL_V1_MIGRATION_RECOVERY_PACKAGE_PROPOSED` |
| Effective authority | `PROPOSAL_ONLY_NO_IMPLEMENTATION_AUTHORITY` |
| Blockers addressed | `B04`, `B05`, `B06` |
| Rows | `ROW-12`, `ROW-14`, `ROW-15` |
| Mappings | `MAP-12`, `MAP-14`, `MAP-15` |

This single package proposes logically separate B04, B05, and B06 contracts
because their safety properties are one operational protocol: a migration
session cannot permit mutation without a verified checkpoint, and an
interruption cannot be classified without a session, checkpoint, and recovery
marker that agree exactly. The package does not accept any of those contracts,
install a store or index, authorize a writer, or grant runtime or production
authority.

## 1. Approved-source audit

| Fact | Classification | Source-grounded result |
| --- | --- | --- |
| Database transition | `EXPLICIT_APPROVED_AUTHORITY` | `absinthe-local-v2` v4 → v5 is additive; all v1–v4 data is retained. |
| B04 owner | `EXPLICIT_APPROVED_AUTHORITY` | `K334MigrationSessionPhysicalAuthorityV1` owns ROW-12 and MAP-12. |
| B05 owner | `EXPLICIT_APPROVED_AUTHORITY` | `K334MigrationCheckpointPhysicalAuthorityV1` owns ROW-14 and MAP-14. |
| B06 owner | `EXPLICIT_APPROVED_AUTHORITY` | `K334RecoveryMarkerPhysicalAuthorityV1` owns ROW-15 and MAP-15. |
| Stores and primary keys | `EXPLICIT_APPROVED_AUTHORITY` | `authority_migration_sessions` / `[namespaceKey,batchId]`; `authority_migration_checkpoints` / `[namespaceKey,checkpointId]`; `authority_recovery_markers` / `[namespaceKey,markerId]`; all `autoIncrement=false`. |
| Session semantics | `EXPLICIT_APPROVED_AUTHORITY` | Durable batch/source binding, CAS lease epoch, statuses `planned`, `running`, `blocked`, `failed`, `complete`; process metadata only. |
| Checkpoint semantics | `EXPLICIT_APPROVED_AUTHORITY` | Append-only batch/phase/sequence/status metadata with verified source/count/set digests; completion follows verification only. |
| Marker semantics | `EXPLICIT_APPROVED_AUTHORITY` | Append-only recovery metadata that blocks effect and is cleared only by superseding resolved evidence; it never grants authority. |
| Session digest | `EXPLICIT_APPROVED_AUTHORITY` | Domain `absinthe:k334:migration-session:v1:canonical-digest`; no K-334D3 canonical record kind or record ID. |
| Checkpoint identity/digest | `EXPLICIT_APPROVED_AUTHORITY` | `mcp:v1:<batchId>:<checkpointSequence>` and domain `absinthe:k334:migration-checkpoint:v1:canonical-digest`. |
| Marker identity/digest | `EXPLICIT_APPROVED_AUTHORITY` | `mrm:v1:<batchId>:<markerKind>:<markerSequence>` and domain `absinthe:k334:recovery-marker:v1:canonical-digest`. |
| Session indexes | `EXPLICIT_APPROVED_AUTHORITY` | `by_source_status` → `[namespaceKey,sourceDigest,sessionStatus]`, non-unique; `by_lease_epoch` → `[namespaceKey,batchId,leaseEpoch]`, unique. |
| Checkpoint indexes | `EXPLICIT_APPROVED_AUTHORITY` | `by_batch_sequence` → `[namespaceKey,batchId,checkpointSequence]`, unique; `by_batch_status` → `[namespaceKey,batchId,status]`, non-unique. |
| Marker index | `EXPLICIT_APPROVED_AUTHORITY` | `by_batch_status` → `[namespaceKey,batchId,markerStatus]`, non-unique. |
| Formal physical store identities | `NEW_MINIMAL_V1_DECISION` | The three `k334.store.*.v1` identifiers below bind the already approved store names one-to-one without changing inventory. |
| Formal physical index identities | `PARTIAL_AUTHORITY` | IDX-C25 and IDX-C31 identities are accepted by K-334P09T/X; the session identities and IDX-C24 identity below are `NEW_MINIMAL_V1_DECISION` bindings for already approved owner/name/key-path contracts. |
| Process provenance | `EXPLICIT_APPROVED_AUTHORITY` | Exact K-334 provenance object: `sourceKind`, nullable `sourceRecordId`, `sourceDigest`, `recorderId`. |
| Repository binding | `EXPLICIT_APPROVED_AUTHORITY` | `repositoryNamespace` is required in every preimage and must agree with the validation context; `namespaceKey` is the first physical key component. |
| C3 session pseudocode omission | `PARTIAL_AUTHORITY` | Its type sketch omitted `repositoryNamespace`, while its normative preimage and every-record rule require it. B04 resolves in favor of the normative requirement. |
| Exact batch/operation-key grammars, immutable retained-source artifact, envelopes, phase/reason registries, exhaustive null rules, and completion fence | `NEW_MINIMAL_V1_DECISION` | Fixed below; these are the named B04–B06 gaps and their bounded review corrections and do not come from tests, runtime behavior, or unaccepted K-334P09P text. |
| K-334D3 canonical wrapping for these rows | `NOT_FOUND` | No fabricated K-334D3 kind, `recordId`, or canonical envelope is permitted. |

The accepted K-334P09T/X index facts are used only where their B04–B06 owner
row is proposed here. K-334P09P remains unaccepted and supplies no authority.

## 2. Common minimal-v1 rules

The following scalar and encoding rules are normative:

- `Sha256` is exactly 64 lowercase ASCII hexadecimal characters.
- `CanonicalSequence` is a positive safe integer.
- `RecordCount` is a non-negative safe integer.
- `recordedAt` is strict UTC `YYYY-MM-DDTHH:mm:ss.sssZ`, must round-trip
  exactly, is assigned once at initial insertion, and is storage-only.
- `batchId` is opaque and generated once with grammar
  `^mbt:v1:[0-9a-f]{64}$`; it is not content-addressed.
- `operationKey` is derived before `batchId` allocation with grammar
  `^mop:v1:[0-9a-f]{64}$`.
- `checkpointOperationKey` and `markerOperationKey` have grammars
  `^mcpop:v1:[0-9a-f]{64}$` and `^mrmop:v1:[0-9a-f]{64}$`.
- A checkpoint sequence or marker sequence is the shortest base-10 rendering
  of a positive safe integer: no sign, whitespace, exponent, fraction, or
  leading zero.
- The exact migration scope literal is
  `absinthe_k334_authority_schema_v4_to_v5`.
- The exact source/target tuple is database `absinthe-local-v2`, source version
  `4`, target version `5`.
- Process preimage bytes use the accepted K-334 canonical scalar/object framing
  with the family digest domain bound exactly once and fields in the order
  specified below. No K-334D3 record-kind envelope is added.
- Every row is an exact object. Unknown, missing, normalized, defaulted, or
  coerced fields fail closed.
- `repositoryNamespace`, `namespaceKey`, batch, scope, source digest, and all
  cross-references must agree byte-for-byte across validation context and rows.

This package uses one explicit binary length frame for retained-source and
target-set material. `frame64(valueBytes)` is the unsigned 64-bit
big-endian byte length of `valueBytes`, followed by those exact bytes.
`utf8(value)` is strict UTF-8 of the already validated string with no Unicode
normalization. Every domain below is ASCII and is itself wrapped in
`frame64`. No JSON, host integer encoding, locale ordering, object-property
iteration, delimiter parsing, or alternate serialization is valid.

`UNSUPPORTED_OR_MALFORMED_INPUT` is the one shared failure policy: fail closed;
reject or quarantine; preserve recoverable material where technically
available; do not mutate accepted canonical state; emit one bounded structured
diagnostic; and require a future reviewed version for newly supported
semantics.

No destructive migration may begin before a complete, durable, verified
pre-mutation checkpoint. Row or index presence never grants permission,
applicability, completion, recovery, runtime access, or production eligibility.

## 3. A. Migration Session Contract — B04

### 3.1 Identity, intent, and lifecycle

`AuthorityMigrationSessionV1` is process metadata, not authority evidence. Its
physical identity is `[namespaceKey,batchId]`; it has no `recordId`.

The session preimage field order is:

1. `recordType`
2. `recordSchemaVersion`
3. `repositoryNamespace`
4. `namespaceKey`
5. `batchId`
6. `operationKey`
7. `databaseName`
8. `sourceSchemaVersion`
9. `targetSchemaVersion`
10. `migrationScope`
11. `sourceDigest`
12. `sessionStatus`
13. `leaseEpoch`
14. `leaseHolderId`
15. `leaseBoundarySequence`
16. `provenance.sourceKind`
17. `provenance.sourceRecordId`
18. `provenance.sourceDigest`
19. `provenance.recorderId`

The exact status registry is the already approved C3 registry:
`planned | running | blocked | failed | complete`.

Valid status/lease combinations are:

| Status | Required lease representation | Meaning |
| --- | --- | --- |
| `planned` | initial `leaseEpoch=1`; holder and boundary are `null` | Intent is durable; no mutation is permitted. |
| `running` | positive epoch; holder is an approved strict identifier; boundary is a positive sequence | One exact CAS holder may act, still subject to checkpoint and phase gates. |
| `blocked` | holder and boundary are `null` | No progress; an open recovery marker or bounded blocker evidence must explain the state. |
| `failed` | holder and boundary are `null` | Terminal failed attempt; no automatic retry or repair. |
| `complete` | holder and boundary are `null` | Terminal only after one verified completion checkpoint and target verification. |

Allowed session transitions are exactly:

- `planned → running | blocked | failed`
- `running → blocked | failed | complete`
- `blocked → running | failed`
- exact-state retry → no-op

`failed` and `complete` are terminal. Every non-no-op transition requires one
transactional CAS over the exact existing `canonicalDigest` and lease epoch.
Acquisition or reacquisition increments `leaseEpoch`; current-holder renewal
retains the epoch and strictly advances `leaseBoundarySequence`. A stale
holder, epoch, digest, namespace, source, or scope mismatch stops all writes.

The transition to `running` requires the verified pre-mutation checkpoint when
it will permit migration mutation. The transition to `complete` and insertion
of the unique verified completion checkpoint must occur in one IndexedDB
transaction after both are reread and validated; it cannot infer completion
from an index result.

`operationKey` is the durable idempotency mapping selected by this package.
Its digest input, computed before allocating a batch ID, is the exact ordered
K-334 process frame:

```text
domain = absinthe:k334:migration-operation:v1:operation-key
repositoryNamespace
namespaceKey
databaseName
sourceSchemaVersion
targetSchemaVersion
migrationScope
sourceDigest
provenance.sourceKind
provenance.sourceRecordId
provenance.sourceDigest
provenance.recorderId
```

`operationKey = "mop:v1:" + lowercaseHex(SHA-256(operationPreimageBytes))`.
It is unique within `[repositoryNamespace,namespaceKey,migrationScope]` and
maps immutably to one opaque `batchId`. The mapping is the session row itself;
no second store or index is introduced.

Session creation uses one read/write transaction over
`authority_migration_sessions`. It first scans the exact namespace for the
derived `operationKey`. One exact row returns its existing `batchId` and row
without a write. The same key with different operation-preimage bytes or more
than one matching row is corruption. If absent, the transaction verifies
there is no conflicting active source/scope session, allocates one `batchId`,
and adds the one session row atomically. A restarted caller must repeat this
lookup before allocating. A competing transaction observes the committed row
or aborts; it cannot add a second mapping.

Same intent plus the durable `operationKey` therefore returns the existing
session even when the caller no longer knows whether the first commit
succeeded. A new operation key for the same source/scope conflicts while any
`planned`, `running`, or `blocked` session exists. A new attempt after
`failed` requires separately authorized caller intent and is not granted by
this package. A completed intent returns its existing session.

### 3.2 Mutable representation boundary

ROW-12 is the one C3-approved CAS state row. Its intent bindings—repository,
namespace, operation key, batch, database/schema tuple, scope, source digest,
and provenance—are immutable. Only the exact status and lease fields may change through the
transition table. Critical phase and recovery history is append-only in ROW-14
and ROW-15; session replacement can neither erase nor supersede that evidence.

## 4. B. Durable Checkpoint Contract — B05

`AuthorityMigrationCheckpointV1` is immutable append-only process evidence.
Its physical identity is `[namespaceKey,checkpointId]`, where:

`checkpointId = "mcp:v1:" + batchId + ":" + checkpointSequence`

The complete grammar is
`^mcp:v1:mbt:v1:[0-9a-f]{64}:[1-9][0-9]{0,15}$`; the embedded `batchId` and
shortest-decimal positive-safe-integer sequence must parse and equal the row
fields exactly.

The exact phase registry is:

`pre_mutation | mutation_started | verification_pending | target_verified |
rollback_started | rollback_verified`

The exact status registry is `verified | complete`. `complete` is valid only
with phase `target_verified`; every other valid row has status `verified`.
There may be exactly one `complete` checkpoint per batch. Sequences start at
`1`, are contiguous, and order state; wall-clock time never orders checkpoints.

The first checkpoint is exactly `pre_mutation/verified`. Allowed next-phase
edges are exactly:

- `pre_mutation → mutation_started`
- `mutation_started → verification_pending | rollback_started`
- `verification_pending → target_verified | rollback_started`
- `target_verified/verified → target_verified/complete`
- `rollback_started → rollback_verified`

An exact phase/status retry is a no-op. No edge may be skipped or selected by
arrival time. `rollback_verified` closes the recovery attempt into a blocked
or failed session; it is not migration completion.

The checkpoint operation identity is
`[repositoryNamespace,namespaceKey,batchId,checkpointOperationKey]`. Its exact
ordered preimage is:

```text
domain = absinthe:k334:migration-checkpoint-operation:v1
repositoryNamespace
namespaceKey
batchId
databaseName
sourceSchemaVersion
targetSchemaVersion
migrationScope
sourceDigest
phase
status
predecessorCheckpointId or null
verifiedSourceSetDigest
expectedTargetSetDigest
expectedProjectionDigest
recoveryMarkerId or null
verifiedTargetSetDigest or null
verifiedProjectionDigest or null
verifiedRecoveryStateDigest or null
provenance.sourceKind
provenance.sourceRecordId
provenance.sourceDigest
provenance.recorderId
```

Each field uses the accepted K-334 typed process-field framing in that order;
explicit null has its distinct accepted null scalar frame. It excludes
`checkpointId`, `checkpointSequence`, and `recordedAt`. The result is
`"mcpop:v1:" + lowercaseHex(SHA-256(checkpointOperationPreimageBytes))`.

Checkpoint allocation is one CAS-guarded transaction over the session and
checkpoint stores. It first scans the batch for `checkpointOperationKey`. One
exact existing row is returned without mutation; different content or
multiple rows is corruption. If absent, the first operation must be
`pre_mutation` with sequence `1` and `predecessorCheckpointId=null`.
Otherwise the operation must reference the exact row at the current last
contiguous sequence and receives exactly the next sequence. The transaction
checks the session canonical digest, lease epoch where a holder is required,
last checkpoint ID/digest, and phase edge before add. Sequences are never
reused. No later sequence may be allocated while the immediately preceding
operation outcome is uncertain: the caller must first rediscover its
operation key.

Every checkpoint binds the exact session, database/schema tuple, migration
scope, source digest, and a complete protected-source reference:

- `checkpointOperationKey`
- required nullable `predecessorCheckpointId`
- `snapshotKind = immutable_retained_source_set_v1`
- `snapshotDatabaseName = absinthe-local-v2`
- `snapshotDatabaseVersion = 4`
- `retainedSourceSetBytes`
- `verifiedSourceDigest`
- `verifiedSourceRecordCount`
- `verifiedSourceSetDigest`
- `expectedTargetSetDigest`
- `expectedProjectionDigest`
- required nullable `verifiedTargetSetDigest`
- required nullable `verifiedProjectionDigest`
- required nullable `recoveryMarkerId`
- required nullable `verifiedRecoveryStateDigest`

### 4.1 `IMMUTABLE_RETAINED_SOURCE_SET_V1`

V1 selects one approach only: the complete immutable artifact bytes are
embedded in every checkpoint as `retainedSourceSetBytes`. Live source rows are
not the recovery payload after artifact creation. Later live-row mutation
cannot change the artifact, and a digest without the artifact bytes is
unusable.

The first `pre_mutation` checkpoint transaction includes
`writer_coordination_state`, `authority_migration_sessions`, and
`authority_migration_checkpoints` in one read/write scope. It performs the
complete source scan, constructs the artifact, requires its digest to equal
the already planned session source digest, and adds the checkpoint. A source
insert, update, or delete is therefore serialized before the scan or after the
artifact commit; it cannot alter the committed artifact. Any mismatch with the
planned source digest blocks that session rather than rebinding it.

The exact v4 source inventory is:

| Participating source family | Inclusion and representation | Exclusion and failure rule |
| --- | --- | --- |
| Approved v4 store `writer_coordination_state`; source identity `absinthe-local-v2:v4:writer_coordination_state`; family `PersistedWriterCoordinationEnvelopeV1` | Scan the complete store. Every physical key must be an exact two-string out-of-line key `[namespaceFingerprint,generationId]`. Include every row whose first component equals the session `namespaceKey`. The member key is that exact pair and the member value is the structured-clone `Uint8Array` byte sequence copied byte-for-byte. | Well-formed rows for another namespace are excluded. Every other v4 store, legacy Notes database/localStorage, K-333 in-memory codec value, K-325 binding, handoff database, and K-329 manifest is excluded. A malformed key/value, duplicate key, failed complete scan, or disappearing row before artifact commit blocks checkpoint creation. |

The empty set is explicitly valid and represents the C3 class-F no-source
case. IndexedDB key uniqueness does not replace artifact duplicate validation.
Two members with identical framed store/key identity are corruption. A missing
member during construction aborts construction; after commit the artifact
itself is the retained member and no live-row lookup is needed for recovery.

`storeIdentityBytes` is strict UTF-8 of the fixed source identity above.
For key `[namespaceFingerprint,generationId]`, both values must already satisfy
their approved strict scalar grammars, and:

```text
keyBytes =
  frame64(utf8("absinthe:k334:retained-source-key:v1")) ||
  frame64(utf8("utf8-string")) || frame64(utf8(namespaceFingerprint)) ||
  frame64(utf8("utf8-string")) || frame64(utf8(generationId))
```

The value is the exact copied `Uint8Array`; it is never parsed and reserialized
for retention. For each member:

```text
recordPreimage =
  frame64(utf8("absinthe:k334:retained-source-record:v1")) ||
  frame64(storeIdentityBytes) ||
  frame64(keyBytes) ||
  frame64(valueBytes)

recordDigest = lowercaseHex(SHA-256(recordPreimage))
```

Members are sorted first by unsigned-byte lexicographic
`storeIdentityBytes`, then by unsigned-byte lexicographic `keyBytes`; a strict
prefix sorts first. Each artifact member is:

```text
memberBytes =
  frame64(storeIdentityBytes) ||
  frame64(keyBytes) ||
  frame64(valueBytes) ||
  frame64(strictHexDecode(recordDigest))
```

The complete artifact is:

```text
retainedSourceSetBytes =
  frame64(utf8("absinthe:k334:immutable-retained-source-set:v1")) ||
  uint64be(memberCount) ||
  frame64(memberBytes[0]) || ... || frame64(memberBytes[n-1])

verifiedSourceSetDigest =
  lowercaseHex(SHA-256(retainedSourceSetBytes))
```

The logical artifact identity is reconstructed, never stored as another
possibly divergent field:

```text
retainedSourceArtifactId = "irs:v1:" + verifiedSourceSetDigest
```

Its grammar is `^irs:v1:[0-9a-f]{64}$`. Its physical container is the immutable
checkpoint at `[namespaceKey,checkpointId]`; every later checkpoint copy must
reconstruct the same logical artifact identity and contain byte-identical
artifact bytes.

`memberCount` is the exact non-negative safe-integer count encoded as an
unsigned 64-bit big-endian integer. Artifact decoding must reproduce the exact
inventory, ordering, framing, each record digest, count, bytes, and outer
digest. No duplicate member, trailing byte, alternate order, or normalized key
is accepted.

There is one source digest authority:

```text
session.sourceDigest
  === checkpoint.verifiedSourceDigest
  === checkpoint.verifiedSourceSetDigest
  === lowercaseHex(SHA-256(retainedSourceSetBytes))
  === provenance.sourceDigest
```

The distinct field names are compatibility projections of the same digest,
not separate authorities. `expectedTargetSetDigest` and
`expectedProjectionDigest` have different target-state domains and are not
source aliases.

Both expected digests are deterministically produced before mutation from the
verified artifact plus every accepted, exact source-classification and
source-to-target mapping rule for this scope, using the target/projection
member framing in Section 6.1. They are committed in the first checkpoint and
copied unchanged thereafter. If any required mapping family remains unresolved
or more than one expected set is possible, checkpoint creation is `BLOCKED`;
an implementation cannot select an expected result.

A checkpoint is usable only when the artifact bytes durably exist in that
exact immutable row; the complete inventory scan, member count, ordering,
framing, every record digest, outer digest, session/source/provenance equality,
repository, namespace, schema, scope, `completeness`, and
`verificationResult` all verify. Missing, inaccessible, truncated, or
unverifiable artifact bytes yield `MANUAL_INTERVENTION_REQUIRED`, even when
stored digest fields match.

Checkpoint rows and embedded artifacts are never updated, replaced, cleared,
or automatically deleted. They remain through verified closure. Cleanup
requires later separate authority and cannot be inferred from session,
checkpoint, or marker status.

`completeness` is the fixed literal `complete` and `verificationResult` is the
fixed literal `verified`. No row is written while snapshot material is partial
or unverified. Durable write completion means the full exact row and required
paired evidence committed successfully; a transaction abort leaves no
checkpoint. Row existence without strict decode, preimage/digest verification,
session/scope equality, reference verification, and sequence validation is
unusable.

Checkpoint creation retry with the same ID and authoritative/structural content
is a no-op retaining the original `recordedAt`. Different content at the same
ID, duplicate completion rows, a sequence gap, or any session/scope/digest
mismatch is corruption. Checkpoints are never updated, replaced, cleared, or
automatically deleted.

### 4.2 Exhaustive phase and nullability matrix

Notation is normative: `REQUIRED` means a present valid value;
`MUST_BE_NULL` means the required field is exactly `null`; `FIXED(x)` means
the exact literal; and `PROHIBITED` means no graph reference or action of that
kind may exist.

| Phase / status | `completeness` / `verificationResult` | Immutable artifact / source-set digest / expected target / expected projection | Verified target / verified projection | Recovery marker / verified recovery state | Completion | Only permitted next effect |
| --- | --- | --- | --- | --- | --- | --- |
| `pre_mutation/verified`, ordinary creation | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `MUST_BE_NULL` / `MUST_BE_NULL` | `MUST_BE_NULL`; open marker `PROHIBITED` / `MUST_BE_NULL` | `PROHIBITED` | After independent durable reread, acquire lease and append `mutation_started` |
| `pre_mutation/verified`, resumed checkpoint creation | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `MUST_BE_NULL` / `MUST_BE_NULL` | `REQUIRED`, exact open `checkpoint_interrupted/resume_permitted` marker / `MUST_BE_NULL` | `PROHIBITED` | Resolve that marker after checkpoint verification, then acquire lease |
| `mutation_started/verified` | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `MUST_BE_NULL` / `MUST_BE_NULL` | Row field `MUST_BE_NULL`; an interruption may later create the one exact open marker / `MUST_BE_NULL` | `PROHIBITED` | Migration writes, then `verification_pending`; or proven `rollback_started` |
| `verification_pending/verified` | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `MUST_BE_NULL` / `MUST_BE_NULL` | `MUST_BE_NULL`; open marker allowed only after classified interruption / `MUST_BE_NULL` | `PROHIBITED` | Read-only target verification to `target_verified`, or proven `rollback_started` |
| `target_verified/verified` | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `REQUIRED`, equals expected target / `REQUIRED`, equals expected projection | Row field `MUST_BE_NULL`; an interrupted completion may later create one exact `completion_record_interrupted/resume_permitted` marker / `MUST_BE_NULL` | Eligible, never sufficient alone | Fresh fenced completion transaction only |
| `target_verified/complete`, ordinary completion | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `REQUIRED`, equals expected target / `REQUIRED`, equals expected projection | `MUST_BE_NULL`; open marker `PROHIBITED` / `MUST_BE_NULL` | `FIXED(unique completion checkpoint)` | No migration or rollback action; later separately authorized closure only |
| `target_verified/complete`, resumed completion | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `REQUIRED`, equals expected target / `REQUIRED`, equals expected projection | `REQUIRED`, exact open `completion_record_interrupted/resume_permitted` marker / `MUST_BE_NULL` | `FIXED(unique completion checkpoint)` | Resolve that marker after verifying the committed completion pair; no migration action |
| `rollback_started/verified` | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `MUST_BE_NULL` / `MUST_BE_NULL` | `REQUIRED`, exact open `rollback_required` marker / `MUST_BE_NULL` | `PROHIBITED` | Continue only the already proven derived-state rollback, then verify |
| `rollback_verified/verified` | `FIXED(complete)` / `FIXED(verified)` | `REQUIRED` / `REQUIRED` / `REQUIRED` / `REQUIRED` | `MUST_BE_NULL` / `MUST_BE_NULL` | `REQUIRED`, exact open rollback marker / `REQUIRED`, equals verified post-rollback current-state digest and marker expected state | `PROHIBITED` | Append exact recovery resolution or block/manual intervention |

Projection verification is part of this migration scope; it is therefore
never optional. A ROW-14 must match exactly one matrix row. Any other
phase/status/null/reference combination, including early target values,
missing rollback evidence, or completion inferred from status, uses
`UNSUPPORTED_OR_MALFORMED_INPUT`.

`retainedSourceSetBytes`, source-set digest, expected target digest, and
expected projection digest are copied byte-identically from the first
checkpoint into every later checkpoint. Phase-specific nullable fields are
direct process-semantic inputs, are represented as explicit nulls where the
matrix requires, reconstruct with that exact meaning, and participate in
checkpoint operation-key, preimage, digest, and retry comparison. No
phase-specific defaulting or inference is permitted.

No incremental snapshot chain or arbitrary snapshot graph is introduced.

## 5. C. Recovery Marker Contract — B06

`AuthorityRecoveryMarkerV1` is immutable append-only blocking metadata. Its
physical identity is `[namespaceKey,markerId]`, where:

`markerId = "mrm:v1:" + batchId + ":" + markerKind + ":" + markerSequence`

The complete grammar is
`^mrm:v1:mbt:v1:[0-9a-f]{64}:(recovery_required|recovery_resolved):[1-9][0-9]{0,15}$`;
the embedded batch, kind, and shortest-decimal positive-safe-integer sequence
must equal the row fields exactly.

Marker sequences start at `1`, are contiguous across both marker kinds within
one batch, are never reused, and are allocated only in a read/write transaction
that validates the exact session digest/lease and the current last marker
ID/digest. Sequence `1` requires `predecessorMarkerId=null`; every later marker
requires `predecessorMarkerId` to equal the marker at sequence minus one.

`markerOperationKey` is computed before sequence allocation from:

```text
domain = absinthe:k334:recovery-marker-operation:v1
repositoryNamespace
namespaceKey
batchId
databaseName
sourceSchemaVersion
targetSchemaVersion
migrationScope
sourceDigest
markerKind
markerStatus
reasonCode
interruptedPhase
recoveryDecision
checkpointId or null
observedStateDigest
expectedStateDigest or null
resolvesMarkerId or null
provenance.sourceKind
provenance.sourceRecordId
provenance.sourceDigest
provenance.recorderId
```

It is
`"mrmop:v1:" + lowercaseHex(SHA-256(markerOperationPreimageBytes))`.
Every field uses the accepted K-334 typed process-field framing in the listed
order, including the distinct null scalar frame.
The operation identity is
`[repositoryNamespace,namespaceKey,batchId,markerOperationKey]`; a resolution
operation is additionally bound to its exact non-null `resolvesMarkerId`.
Neither `markerSequence`, `markerId`, `predecessorMarkerId`, nor `recordedAt`
is an operation-key input.

Before allocating a sequence, creation scans the exact batch for the operation
key. One exact row is returned without a write; different content or multiple
rows is corruption. If absent, only the next contiguous sequence may be
allocated, with exact predecessor CAS. A caller with an uncertain commit must
rediscover this operation key before any allocation. A different operation key
cannot create a second resolved marker for an open marker already resolved,
and cannot create another open marker while an open marker exists. Competing
IDs for one operation, gaps, or predecessor disagreement fail closed and
preserve every row.

The exact marker-kind registry is `recovery_required | recovery_resolved`.
The exact marker-status registry is `open | resolved`; only the pairs
`recovery_required/open` and `recovery_resolved/resolved` are valid.

The exact interrupted-phase registry is:

`checkpoint_creation | pre_mutation | mutation | target_verification |
completion_recording | rollback | marker_resolution`

The exact reason registry is:

- `checkpoint_interrupted`
- `mutation_interrupted`
- `target_verification_failed`
- `completion_record_interrupted`
- `rollback_interrupted`
- `recovery_verification_failed`
- `persisted_state_corrupt`
- `lease_or_schema_mismatch`
- `recovery_verified`

The exact decision registry is:

`resume_permitted | rollback_required | manual_intervention_required |
recovery_complete`

Reason, phase, and decision combinations are exact:

| Reason | Valid interrupted phase | Valid open decision |
| --- | --- | --- |
| `checkpoint_interrupted` | `checkpoint_creation` | `resume_permitted` only, with no mutation and nullable checkpoint rule satisfied |
| `mutation_interrupted` | `mutation` | `resume_permitted`, `rollback_required`, or `manual_intervention_required`, selected only by the proof rules below |
| `target_verification_failed` | `target_verification` | `rollback_required` or `manual_intervention_required` |
| `completion_record_interrupted` | `completion_recording` | `resume_permitted` only |
| `rollback_interrupted` | `rollback` | `rollback_required` or `manual_intervention_required` |
| `recovery_verification_failed` | `marker_resolution` | `manual_intervention_required` only |
| `persisted_state_corrupt` | Any listed phase | `manual_intervention_required` only |
| `lease_or_schema_mismatch` | Any listed phase except `marker_resolution` | `manual_intervention_required` only |

An open marker uses a reason other than `recovery_verified`, one of the first
three decisions, and `resolvesMarkerId=null`. A resolved marker uses reason
`recovery_verified`, decision `recovery_complete`, and a non-null exact
`resolvesMarkerId` that names one open marker in the same repository,
namespace, batch, and scope. `checkpointId` is required except for a
`checkpoint_interrupted` marker created before any migration mutation; in that
case it is explicitly `null`, and only pre-mutation checkpoint creation may
resume.

Each marker also requires `observedStateDigest`, required nullable
`expectedStateDigest`, exact session source digest, provenance, and the exact
repository/namespace/database/schema/scope tuple. At most one unresolved open
marker may exist for one batch/scope. A competing open marker is preserved as conflict and forces
`MANUAL_INTERVENTION_REQUIRED`; arrival time cannot choose a winner.

`expectedStateDigest` is non-null for `resume_permitted`,
`rollback_required`, and `recovery_complete`. It is `null` only for
`manual_intervention_required`, where no unique safe target state is proven.
The resolved `recovery_verified/recovery_complete` combination uses phase
`marker_resolution` and must match the verified post-recovery state digest.

A marker classifies durable evidence only. It does not perform rollback, grant
permission to continue, prove successful recovery, or create runtime authority.
An open marker is never overwritten or deleted. Resolution is a new marker and
is valid only after post-recovery verification, exact reference validation,
and rereading the current session/checkpoint/state graph.

## 6. D. Combined Interruption and Recovery Protocol

### 6.1 Fresh target-state completion fence

V1 selects transaction-scoped reread, not a separately persisted fence token.
The migration-output target set is exactly these C3 stores:

```text
authority_subjects
authority_issuers
authority_issuer_policies
authority_evidence
authority_rollback_permissions
authority_terminations
authority_compatibility_tuples
authority_external_mappings
authority_fork_observations
authority_conflict_observations
authority_quarantines
authority_migration_classifications
authority_audit_events
```

The projection set is exactly `authority_heads`. The control set is exactly
`authority_migration_sessions`, `authority_migration_checkpoints`, and
`authority_recovery_markers`. No other store may be added to or removed from
these sets by an implementation. Naming these C3 stores for transaction
coverage does not accept an unresolved B07/B08 row contract; if any required
family lacks accepted strict decoding and canonical reconstruction,
completion is `BLOCKED` and no completion row is written.

For every target or projection row in the exact namespace, the completion
validator strictly decodes its accepted family row, reconstructs its exact
family canonical/process bytes, and encodes the physical primary key using
ordered typed UTF-8 components under:

```text
frame64(utf8("absinthe:k334:target-store-key:v1")) ||
frame64(utf8(component-type)) || frame64(component-bytes) ...
```

Components occur in declared key-path order; strings use strict UTF-8, numeric
components use their shortest approved ASCII decimal, and no other scalar type
is accepted. A target member digest is SHA-256 of:

```text
frame64(utf8("absinthe:k334:migration-target-record:v1")) ||
frame64(utf8(approvedStoreIdentity)) ||
frame64(targetKeyBytes) ||
frame64(reconstructedCanonicalOrProcessBytes)
```

Target members are ordered by unsigned-byte store identity and then key bytes,
strict prefix first, with duplicates prohibited. `currentTargetSetDigest` is
the lowercase 64-hex SHA-256 of:

```text
frame64(utf8("absinthe:k334:migration-target-set:v1")) ||
uint64be(targetMemberCount) ||
frame64(strictHexDecode(memberDigest[0])) || ... ||
frame64(strictHexDecode(memberDigest[n-1]))
```

The projection digest uses the identical member rule but only
`authority_heads` and domains
`absinthe:k334:migration-projection-record:v1` and
`absinthe:k334:migration-projection-set:v1`; its result is likewise lowercase
64-hex SHA-256. Empty target and projection sets are valid only when their
expected digests encode those exact empty sets.

Target verification before completion produces the
`target_verified/verified` checkpoint. It is durable evidence, but it is not
the completion fence. The final completion transaction is one strict
read/write IndexedDB transaction whose scope contains all thirteen target
stores, `authority_heads`, and all three control stores. Inside that
transaction it:

1. rediscovers the session by `operationKey`;
2. verifies exact batch/session identity, expected prior `running` status,
   canonical digest, lease holder, lease epoch, scope, schema, namespace, and
   source artifact;
3. rediscovers the exact completion checkpoint operation and validates the
   preceding `target_verified/verified` checkpoint;
4. scans the complete target and projection member sets, strictly validates
   every row, and freshly recomputes both current digests;
5. requires the current digests to equal the target-verified checkpoint's
   verified and expected digest fields;
6. proves that no extra member or newer verified canonical state exists and
   that no contradictory recovery marker exists; the only permitted open
   marker is the exact `completion_record_interrupted/resume_permitted` marker
   named by a resumed completion checkpoint;
7. adds the unique `target_verified/complete` checkpoint and transitions the
   session to `complete`; and
8. preserves every prior row and artifact.

IndexedDB transaction isolation over every participating store is the one
fence. Any concurrent mutation of a target/control member is serialized before
the scan or after the completion commit; it cannot occur between this
transaction's validation and commit. A changed member, changed read set,
different digest, transaction abort, unavailable store, or family that cannot
participate in this one transaction yields no completion. If the required
stores cannot share one atomic IndexedDB transaction, v1 returns `BLOCKED` or
`MANUAL_INTERVENTION_REQUIRED`; it never uses an earlier external digest as a
partial fence.

After an uncertain completion outcome, the caller rediscovers the session by
`operationKey` and the completion checkpoint by
`checkpointOperationKey`, validates the exact atomic pair and retained
target/projection digest results, and returns the existing pair without a
write. A missing pair repeats the full fenced transaction. A partial pair,
second completion candidate, or different digest/content fails closed.
Storage-only timestamps are retained and excluded from retry equality.

### 6.2 Ordered protocol

The normative order is:

1. Create or strictly validate the exact migration intent.
2. Create the complete pre-mutation checkpoint.
3. Durably commit and independently verify that checkpoint.
4. Acquire the exact session lease and record `mutation_started`.
5. Perform only idempotent, scope-bound migration writes.
6. Record `verification_pending`; verify target counts, sets, lineage,
   projections, quarantine state, and digests.
7. In the complete target/control-store transaction above, freshly recompute
   target/projection digests, append the `target_verified/complete` checkpoint,
   and transition the session to `complete`.
8. Append a resolved marker only after recovery verification; never delete the
   open marker or checkpoint.

| Interruption boundary | Observable durable state | Safe permitted action | Prohibited action | Required classification |
| --- | --- | --- | --- | --- |
| Before checkpoint creation | `planned`; no checkpoint; no mutation | Revalidate intent/source and create checkpoint | Mutation or completion | Resume checkpoint creation only |
| During checkpoint creation | Transaction abort leaves no row; malformed/partial material is unusable | Retry exact checkpoint creation if no mutation exists; otherwise mark blocked | Treat partial material as usable | Resume or manual intervention if corruption exists |
| After verified checkpoint, before mutation | Verified `pre_mutation` checkpoint; no mutation-start boundary | Revalidate graph, acquire lease, begin exact migration | Recreate/replace checkpoint | Resume permitted |
| During mutation | Running session plus verified pre-checkpoint and mutation boundary; completion absent | Create/reuse open marker; resume only after exact idempotency/current-state proof | Assume completion or overwrite | Resume, rollback, or manual intervention from proof |
| After mutation, before verification | Verification-pending boundary; completion absent | Verify target only; persist blocker on mismatch | Re-run writes without comparison or mark complete | Resume verification |
| After verification, before completion | Verified target evidence; session not complete | Replay exact completion checkpoint/session CAS | Re-run migration or infer completion | Resume completion recording |
| During rollback/recovery | Open marker plus exact checkpoint; no resolved marker | Continue the same proven recovery decision after graph revalidation | Switch strategy heuristically or erase evidence | Rollback/resume or manual intervention |
| After recovery, before marker resolution | Post-recovery verification exists; open marker remains | Append exact resolved marker | Repeat recovery mutation or clear/delete marker | Resume resolution recording |

An interruption discovered after restart is classified from strict durable
state, not memory, wall-clock order, or a missing row assumption. Any
unlisted, contradictory, duplicated, or ambiguous graph uses
`MANUAL_INTERVENTION_REQUIRED`.

## 7. Resume, rollback, and manual-intervention rules

`RESUME_PERMITTED_V1` requires all of the following:

- exact supported database/schema tuple and migration scope;
- strict session, checkpoint, and any marker decode;
- repository, namespace, batch, operation key, immutable source artifact,
  source, scope, ID, sequence, predecessor, preimage, and digest agreement;
- a valid current lease CAS or safe pre-mutation no-holder state;
- the last contiguous checkpoint is complete and verified for its phase;
- no unresolved competing marker, corrupt row, stale writer, quarantine
  mismatch, or verified newer canonical state;
- the requested next action is exactly the deterministic action in the
  interruption table.

`ROLLBACK_REQUIRED_V1` requires a verified checkpoint bound to the exact
session and protected scope, no verified newer canonical state that would be
overwritten, complete byte-available immutable retained-source material,
deterministic restoration, a current-state digest matching the marker,
post-rollback verification, and retained checkpoint/marker evidence through
closure.

The v4→v5 migration is additive. Canonical authority evidence is never deleted
or overwritten as rollback. V1 rollback is limited to transaction abort or
exact restoration/rebuild of derived, non-canonical artifacts whose prior
state is proven by the checkpoint. If canonical writes exist and safe forward
recovery or derived-only rollback cannot be proven, the result is
`MANUAL_INTERVENTION_REQUIRED`, not deletion or best-effort repair.

`MANUAL_INTERVENTION_REQUIRED` is mandatory when neither resume nor rollback
meets every condition, when a newer verified state exists, when markers
compete, when a checkpoint is incomplete/corrupt, or when the durable graph is
ambiguous. It blocks writes and completion and grants no repair permission.

## 8. Idempotency and conflict rules

`SAME_AUTHORITATIVE_CONTENT_RETRY_NO_OP_V1` applies separately to session
creation/current-state retry, checkpoint creation/verification, marker
creation, migration completion recording, and recovery completion recording.
It covers both a retry with a known process ID and a restart that knows only
the durable operation key. Before any new opaque ID or sequence allocation,
the caller derives the same operation key, scans the exact bounded store/batch
scope, and validates the matching operation-preimage bytes. An exact match
rediscovers the committed ID, returns or preserves the existing row, and
performs no write.

Storage-only `recordedAt` is assigned once, strictly validated on reads,
retained for the row lifetime, excluded from process preimages, identity, and
digests, and never compared with a newly generated retry timestamp.

Different authoritative or structural content at one identity fails closed.
The same operation key with different authoritative content, two IDs for one
operation key, a second resolution for one open marker, or an operation key
whose expected row is missing after a later sequence exists is corruption.
Last-write-wins, verified-checkpoint replacement, silent marker overwrite,
automatic state advancement from incomplete evidence, retry-time identity
regeneration, mutation after failed validation, and implicit repair are
prohibited.

Session state change is not an idempotent content retry: it is valid only under
the exact CAS transition table. Checkpoint and marker rows are immutable.

## 9. Canonical bytes and digest boundary

| Family | K-334D3 `canonicalBytes` | K-334D3 `recordId` | Process preimage bytes | `canonicalDigest` | Physical digest alias | Storage-only fields |
| --- | --- | --- | --- | --- | --- | --- |
| B04 session | Absent | Absent | `sessionPreimageBytes`, required | Required under the approved session digest domain | Absent | `recordedAt` |
| B05 checkpoint | Absent | Absent; `checkpointId` is a process composite | `checkpointPreimageBytes`, required | Required under the approved checkpoint digest domain | Absent | `recordedAt` |
| B06 marker | Absent | Absent; `markerId` is a process composite | `markerPreimageBytes`, required | Required under the approved marker digest domain | Absent | `recordedAt` |

Preimage bytes must decode to the exact row semantic fields and re-encode
byte-identically before digest verification. A preimage/field/digest mismatch
is corruption. No standalone digest beyond the approved `canonicalDigest` and
the semantically required operation-key and source/scope/set/state verification
digests is added.

## 10. E. Durable Row and Mapping Contracts

### 10.1 ROW-12 / MAP-12

Store identity is `k334.store.authority_migration_sessions.v1`; store name is
`authority_migration_sessions`; key is `[namespaceKey,batchId]`;
`autoIncrement=false`.

| Physical field | Type/source and exact rule | Reconstruction/equality/retry |
| --- | --- | --- |
| `rowType` | Fixed `k334_physical_migration_session_row_v1` | Structural only; exact on read/retry |
| `rowVersion` | Fixed `1` | Structural only; unsupported versions fail |
| `recordType` | Fixed `authority_migration_session_v1` | Preimage field 1 |
| `recordSchemaVersion` | Fixed `1` | Preimage field 2 |
| `repositoryNamespace` | Approved strict scalar; validation context | Direct preimage/reconstruction equality |
| `namespaceKey` | Approved strict scalar; key component 1 | Direct preimage/key/context equality |
| `batchId` | Exact opaque B04 grammar; key component 2 | Direct preimage/key equality; process identity |
| `operationKey` | Exact deterministic B04 grammar and operation preimage | Direct preimage; unique durable mapping to `batchId`; rediscovery before allocation |
| `databaseName` | Fixed `absinthe-local-v2` | Direct preimage equality |
| `sourceSchemaVersion` | Fixed `4` | Direct preimage equality |
| `targetSchemaVersion` | Fixed `5` | Direct preimage equality |
| `migrationScope` | Fixed scope literal | Direct preimage equality |
| `sourceDigest` | `Sha256` | Direct preimage; equals source/provenance/checkpoints |
| `sessionStatus` | Exact B04 registry | Direct preimage; CAS transition only |
| `leaseEpoch` | Positive safe integer | Direct preimage; CAS equality |
| `leaseHolderId` | Required strict identifier or explicit `null` | Direct preimage; status-pair validation |
| `leaseBoundarySequence` | Required positive safe integer or explicit `null` | Direct preimage; status-pair validation |
| `provenance` | Exact approved four-field object | Flattened into ordered preimage; reconstructed losslessly |
| `sessionPreimageBytes` | Structured-clone `Uint8Array` | Strict decode/re-encode; exact retry equality |
| `canonicalDigest` | Approved session digest domain over exact preimage bytes | Recomputed; no identity effect |
| `recordedAt` | Strict UTC storage-only timestamp | Validated, retained, excluded from retry equality |

Every listed field is required. No canonical kind/version, record ID, UI
progress, wall-clock lease expiry, arbitrary payload, unknown field, or
additional status is permitted.

### 10.2 ROW-14 / MAP-14

Store identity is `k334.store.authority_migration_checkpoints.v1`; store name
is `authority_migration_checkpoints`; key is `[namespaceKey,checkpointId]`;
`autoIncrement=false`.

| Physical field | Type/source and exact rule | Reconstruction/equality/retry |
| --- | --- | --- |
| `rowType` / `rowVersion` | Fixed `k334_physical_migration_checkpoint_row_v1` / `1` | Structural only; exact |
| `recordType` / `recordSchemaVersion` | Fixed `authority_migration_checkpoint_v1` / `1` | Ordered preimage fields |
| `repositoryNamespace` / `namespaceKey` | Approved strict scalars | Direct context/preimage/key equality |
| `checkpointId` | Exact B05 composite; key component 2 | Recomputed from batch/sequence |
| `batchId` / `checkpointSequence` | Exact batch grammar / positive safe integer | Direct; composite-ID equality |
| `checkpointOperationKey` | Exact deterministic B05 grammar and operation preimage | Unique within batch; rediscovered before sequence allocation |
| `predecessorCheckpointId` | Required exact checkpoint ID or explicit `null` | Null only at sequence 1; otherwise exact sequence-minus-one row |
| `databaseName` / schema versions / scope | Fixed common tuple | Direct session/preimage equality |
| `sourceDigest` | `Sha256` | Must equal session source digest |
| `phase` / `status` | Exact B05 registries | Direct; valid pair and sequence checks |
| `snapshotKind` | Fixed `immutable_retained_source_set_v1` | Direct |
| `snapshotDatabaseName` / `snapshotDatabaseVersion` | Fixed `absinthe-local-v2` / `4` | Direct |
| `retainedSourceSetBytes` | Required structured-clone `Uint8Array`; exact immutable artifact | Strict artifact decode; retained byte-identically on every checkpoint/retry |
| `verifiedSourceDigest` | `Sha256` | Equals session/source digest |
| `verifiedSourceRecordCount` | Non-negative safe integer | Direct verified count |
| `verifiedSourceSetDigest` | `Sha256` | Recomputed from artifact bytes; equals source/session/provenance digest |
| `expectedTargetSetDigest` | `Sha256` | Direct expected result |
| `expectedProjectionDigest` | `Sha256` | Direct expected projection result |
| `verifiedTargetSetDigest` | Required `Sha256` or explicit `null` | Exact exhaustive matrix validation |
| `verifiedProjectionDigest` | Required `Sha256` or explicit `null` | Exact exhaustive matrix validation |
| `recoveryMarkerId` | Required exact marker ID or explicit `null` | Exact exhaustive matrix and marker-graph validation |
| `verifiedRecoveryStateDigest` | Required `Sha256` or explicit `null` | Exact exhaustive matrix; rollback proof only |
| `completeness` / `verificationResult` | Fixed `complete` / `verified` | Both required before use |
| `provenance` | Exact approved object | Ordered preimage/reconstruction |
| `checkpointPreimageBytes` | Structured-clone `Uint8Array` | Strict decode/re-encode |
| `canonicalDigest` | Approved checkpoint domain over preimage bytes | Recomputed |
| `recordedAt` | Strict UTC storage-only timestamp | Validated and retained on exact retry |

The checkpoint preimage order is exactly the table order from `recordType`
through provenance, excluding physical discriminator/version, process ID,
preimage bytes, digest, and `recordedAt`. Every row field is required; nullable
fields use explicit `null`.

### 10.3 ROW-15 / MAP-15

Store identity is `k334.store.authority_recovery_markers.v1`; store name is
`authority_recovery_markers`; key is `[namespaceKey,markerId]`;
`autoIncrement=false`.

| Physical field | Type/source and exact rule | Reconstruction/equality/retry |
| --- | --- | --- |
| `rowType` / `rowVersion` | Fixed `k334_physical_recovery_marker_row_v1` / `1` | Structural only; exact |
| `recordType` / `recordSchemaVersion` | Fixed `authority_recovery_marker_v1` / `1` | Ordered preimage fields |
| `repositoryNamespace` / `namespaceKey` | Approved strict scalars | Direct context/preimage/key equality |
| `markerId` | Exact B06 composite; key component 2 | Recomputed from batch/kind/sequence |
| `batchId` / `markerSequence` | Exact batch grammar / positive safe integer | Direct composite equality |
| `markerOperationKey` | Exact deterministic B06 grammar and operation preimage | Unique within batch; rediscovered before sequence allocation |
| `predecessorMarkerId` | Required exact marker ID or explicit `null` | Null only at sequence 1; otherwise exact sequence-minus-one row |
| `databaseName` / schema versions / scope | Fixed common tuple | Direct session/preimage equality |
| `sourceDigest` | `Sha256` | Equals session/checkpoint source |
| `markerKind` / `markerStatus` | Exact B06 registries | Valid-pair equality |
| `reasonCode` / `interruptedPhase` | Exact B06 registries | Direct classification |
| `recoveryDecision` | Exact B06 registry | Classification only; grants no permission |
| `checkpointId` | Required exact checkpoint ID or explicit `null` | Null allowed only by B06 rule |
| `observedStateDigest` | Required `Sha256` | Exact current-state proof; scope is validated from the complete named tuple |
| `expectedStateDigest` | Required `Sha256` or explicit `null` | Direct comparison target |
| `resolvesMarkerId` | Required exact marker ID or explicit `null` | Kind/status/reference rule |
| `provenance` | Exact approved object | Ordered preimage/reconstruction |
| `markerPreimageBytes` | Structured-clone `Uint8Array` | Strict decode/re-encode |
| `canonicalDigest` | Approved marker domain over preimage bytes | Recomputed |
| `recordedAt` | Strict UTC storage-only timestamp | Validated and retained on exact retry |

The marker preimage order is exactly the table order from `recordType` through
provenance, excluding physical discriminator/version, process ID, preimage
bytes, digest, and `recordedAt`. Every field is required; nullable values are
explicit `null`.

MAP-12, MAP-14, and MAP-15 are total, lossless, deterministic, and reversible
to their process-semantic records. They perform no normalization, defaulting,
heuristic inference, status selection, metadata insertion into semantic
meaning, or implementation-selected transformation. Any mapping, key,
reference, discriminator, preimage, digest, or reconstruction mismatch uses
`UNSUPPORTED_OR_MALFORMED_INPUT`.

## 11. F. Index and Shared-Constraint Bindings

All indexes are `multiEntry=false`, non-authoritative, and uninstalled.

| Identity / owner and name | Key path | Unique | Purpose and boundary |
| --- | --- | ---: | --- |
| `k334.index.authority_migration_sessions.by_source_status.v1` / `authority_migration_sessions` / `by_source_status` | `["namespaceKey","sourceDigest","sessionStatus"]` | false | Finds candidates for exact validation; never chooses by arrival order. |
| `k334.index.authority_migration_sessions.by_lease_epoch.v1` / `authority_migration_sessions` / `by_lease_epoch` | `["namespaceKey","batchId","leaseEpoch"]` | true | CAS candidate lookup; never proves holder authority. |
| `k334.index.authority_migration_checkpoints.by_batch_sequence.v1` / `authority_migration_checkpoints` / `by_batch_sequence` | `["namespaceKey","batchId","checkpointSequence"]` | true | Contiguous sequence lookup; every row still validates. |
| `k334.index.authority_migration_checkpoints.by_batch_status.v1` / `authority_migration_checkpoints` / `by_batch_status` | `["namespaceKey","batchId","status"]` | false | Finds verification/completion candidates; does not prove either. |
| `k334.index.authority_recovery_markers.by_batch_status.v1` / `authority_recovery_markers` / `by_batch_status` | `["namespaceKey","batchId","markerStatus"]` | false | Finds open/resolved candidates; does not prove a winning marker or recovery. |

No index independently proves migration completion, checkpoint validity,
rollback eligibility, recovery completion, runtime authority, or production
eligibility. No convenience index is added.

Only the B04–B06 portions of these shared constraints are proposed:

| Constraint portion | Exact proposed binding |
| --- | --- |
| Store identity/name coherence | Each of the three physical identities maps one-to-one to its exact store name and row family. |
| Key ordering | `namespaceKey` is first; the exact process ID is second; `autoIncrement=false`. |
| Family/store/mapping coherence | ROW-12/MAP-12, ROW-14/MAP-14, and ROW-15/MAP-15 never cross families. |
| Family discrimination | Exact `rowType`, `rowVersion`, `recordType`, and `recordSchemaVersion`; no inference from store presence. |
| Identity/digest/reconstruction | Composite IDs, preimage bytes, row fields, digests, keys, and validation context agree exactly. |
| Restart identity | Durable operation keys map one-to-one to opaque process IDs before allocation; checkpoint/marker predecessor chains are contiguous and CAS-guarded. |
| Lifecycle/status consistency | Only listed session transitions and checkpoint/marker registry combinations are valid. |
| Mutation boundary | Session state is CAS-only; checkpoints and markers are append-only and immutable. |
| Recovery material | Every checkpoint embeds the exact immutable retained-source artifact; missing bytes or any member/count/digest mismatch is unusable. |
| Completion fence | The complete target/projection/control store set is transactionally reread before the atomic completion pair; partial fencing is prohibited. |
| Provenance | Exact approved provenance is retained in each process preimage. |
| Repository/namespace/scope equality | All rows and references agree with the current repository, namespace, batch, source, schema tuple, and scope. |
| Evidence/audit separation | Process rows are not canonical authority evidence; B07 audit remains unresolved and is not embedded. |
| Cross-reference integrity | Checkpoints reference one session; markers reference that session and the exact checkpoint or explicit pre-checkpoint null; resolutions reference one exact open marker. |

No global shared constraint and no B07–B08 portion is accepted by this
proposal.

## 12. Data-safety invariants

This package requires all of the following:

- no migration mutation before a verified durable checkpoint;
- no checkpoint is usable without complete immutable retained-source bytes and
  exact member/digest verification;
- no migration success before durable commit and target verification;
- no completion uses target verification older than the fresh all-target-store
  transactional reread;
- no checkpoint use before completeness and integrity verification;
- no recovery-marker resolution before recovery verification;
- no rollback over a verified newer canonical state;
- no partial, malformed, unsupported, or corrupt row treated as valid;
- no ambiguous state silently advanced or automatically repaired;
- no destructive cleanup before durable closure evidence;
- no row or index presence grants authority;
- retries create no duplicate authoritative process record;
- uncertain commits are rediscovered by durable operation key before any new
  opaque ID or sequence allocation;
- corruption yields fail-closed quarantine or manual intervention;
- source v4 data, checkpoints, open markers, and resolution evidence are not
  implicitly deleted;
- no completion, resume, or rollback behavior remains implementation-selected.

## 13. G. Reusability Boundary

Reusable mechanism candidates are a phase/state validator, checkpoint verifier,
session/scope/reference equality verifier, exact retry comparator,
resume/rollback/manual-intervention classifier, exact-object validator,
declarative store/index descriptor, bounded diagnostic, and
corruption/quarantine outcome.

Absinthe-specific facts remain the migration meaning and v4→v5 scope, schema
identities, exact statuses/phases/reasons, immutable retained-v4 artifact,
store/mapping/index identities, B04–B06, and the K-334 lifecycle. No package,
generic workflow engine, arbitrary migration graph, or generic recovery
framework is created.

## 14. Explicitly unsupported v1 features

Distributed migrations, cross-device coordination, arbitrary migration graphs,
dependency solving, parallel branches, nested migrations, incremental snapshot
chains, heuristic repair, best-effort rollback, automatic conflict merging,
background expiry, automatic checkpoint deletion, cloud backup orchestration,
sync conflict resolution, generic job scheduling, and production activation
are unsupported. They use `UNSUPPORTED_OR_MALFORMED_INPUT`.

## 15. B04–B06 readiness

| Area | Item | Readiness |
| --- | --- | --- |
| B04 | Migration semantic contract | `READY_FOR_REVIEW` |
| B04 | Migration identity/scope | `READY_FOR_REVIEW` |
| B04 | Lifecycle/status | `READY_FOR_REVIEW` |
| B04 | Durable ROW-12 | `READY_FOR_REVIEW` |
| B04 | Complete MAP-12 | `READY_FOR_REVIEW` |
| B04 | Approved indexes | `READY_FOR_REVIEW` |
| B04 | Shared-constraint portions | `READY_FOR_REVIEW` |
| B05 | Checkpoint semantic contract | `READY_FOR_REVIEW` |
| B05 | Session/scope binding | `READY_FOR_REVIEW` |
| B05 | Completeness/verification | `READY_FOR_REVIEW` |
| B05 | Durable ROW-14 | `READY_FOR_REVIEW` |
| B05 | Complete MAP-14 | `READY_FOR_REVIEW` |
| B05 | Approved indexes | `READY_FOR_REVIEW` |
| B05 | Shared-constraint portions | `READY_FOR_REVIEW` |
| B06 | Recovery-marker semantic contract | `READY_FOR_REVIEW` |
| B06 | Reason/decision states | `READY_FOR_REVIEW` |
| B06 | Session/checkpoint binding | `READY_FOR_REVIEW` |
| B06 | Clear/resolve boundary | `READY_FOR_REVIEW` |
| B06 | Durable ROW-15 | `READY_FOR_REVIEW` |
| B06 | Complete MAP-15 | `READY_FOR_REVIEW` |
| B06 | Approved indexes | `READY_FOR_REVIEW` |
| B06 | Shared-constraint portions | `READY_FOR_REVIEW` |
| Combined | Interruption protocol | `READY_FOR_REVIEW` |
| Combined | Resume rule | `READY_FOR_REVIEW` |
| Combined | Rollback rule | `READY_FOR_REVIEW` |
| Combined | Manual-intervention rule | `READY_FOR_REVIEW` |
| Combined | Idempotency | `READY_FOR_REVIEW` |
| Combined | Data-safety invariants | `READY_FOR_REVIEW` |
| Combined | Reusable-core boundary | `READY_FOR_REVIEW` |

PACKAGE_READY_FOR_SINGLE_ARCHITECTURE_REVIEW

## 16. Authority state

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 1
- B01 authority resolution accepted: 1
- B02 authority resolution accepted: 1
- B03 authority resolution accepted: 1
- B04–B06 combined package proposed: 1
- B04 authority resolution accepted: 0
- B05 authority resolution accepted: 0
- B06 authority resolution accepted: 0
- B07–B08 authority resolution accepted: 0/2
- Descriptor-authority prerequisite accepted: 0
- Descriptor implementation authorization: 0/0
- Descriptor implementation: 0
- Effective D0-P09 execution authority: 0
- D0-P09 execution/satisfaction: 0/0
- D0-P10: 0/0
- K-334E/F: 0/0
- Runtime authorization: 0
- Production eligibility: 0

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
