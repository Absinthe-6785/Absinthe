# K-334P09B04B06E — Minimal-v1 Migration and Recovery Authority Acceptance Record

| Field | Value |
| --- | --- |
| Type | `K334MinimalV1MigrationRecoveryAuthorityAcceptanceRecord` |
| ID | `K-334P09B04B06E-MINIMAL-V1-MIGRATION-RECOVERY-ACCEPTANCE-001` |
| Status | `B04_B05_B06_MINIMAL_V1_AUTHORITY_ACCEPTED` |
| Effective authority | `ACCEPTED_B04_B05_B06_MIGRATION_RECOVERY_CONTRACTS_NO_IMPLEMENTATION_AUTHORITY` |
| Scope | B04 migration session, B05 checkpoint, B06 recovery marker, and only their combined protocol boundaries |

## 1. Exact bindings and disposition

This record accepts the reviewed semantic and physical-contract package, not an
implementation, migration run, runtime behavior, or production behavior.

| Binding | Exact value |
| --- | --- |
| Package | `K-334P09B04B06A-MINIMAL-V1-MIGRATION-RECOVERY-PACKAGE-001` |
| Corrected package SHA-256 | `7C43F863B99114235B7552E5F17CF088BF43F2CD6399555B548913DDFB715B03` |
| Prior review | `K-334P09B04B06B` / `CHANGES_REQUIRED` |
| Correction | `K-334P09B04B06C` / R01–R04 correction |
| Closure review | `K-334P09B04B06D` / `PASS` |
| Approved source facts | K-334C/C2/C3 migration, checkpoint, recovery, store, key, and index facts |
| Deferral history | Accepted K-334P09T/X B04–B06 deferral history |

B04, B05, and B06 are authority-resolved but not implemented.

This acceptance does not grant descriptor implementation, migration execution,
runtime, production eligibility, checkpoint or artifact cleanup, deletion, or
B07–B08 authority resolution.

## 2. Accepted B04 migration-session contract

The accepted ROW-12/MAP-12 contract has the opaque batch grammar
`mbt:v1:<64-lowercase-hex>` and one immutable deterministic
`operationKey` to `batchId` mapping. Lookup occurs before allocation and the
mapping/session insertion is atomic.

The accepted operation identity binds repository, namespace, database,
source and target schema versions, exact migration scope, source digest, and
provenance. Exact retry rediscovers the same batch; conflict, collision, stale
worker, competing active session, and last-write-wins behavior fail closed.

Only the accepted status/lease representation is mutable through CAS:
`planned`, `running`, `blocked`, `failed`, and `complete`. Intent bindings are
immutable. `complete` is valid only through the accepted fresh-target atomic
completion protocol and never itself grants execution, runtime, or production
authority.

## 3. Accepted B05 durable-checkpoint contract

The accepted ROW-14/MAP-14 identity grammar is
`mcp:v1:<batchId>:<sequence>`. Sequences start at `1`, are positive safe
integers, contiguous per batch, non-reusable, and allocated with the exact
session/checkpoint CAS checks.

`checkpointOperationKey` is deterministic, binds the exact predecessor and
phase-specific evidence, and is rediscovered before allocation after an
uncertain outcome. Checkpoints are append-only and immutable: exact retry is a
no-op, while divergent content, sequence gaps, duplicate completion, or
replacement fails closed. No checkpoint is partially accepted, deleted, or
usable through digest-only reconstruction.

## 4. Accepted immutable retained-source artifact

`IMMUTABLE_RETAINED_SOURCE_SET_V1` is accepted as a byte-complete immutable
artifact embedded in every ROW-14 checkpoint. It is independent of live-row
mutation or deletion and is required for checkpoint usability until separately
authorized cleanup.

The exact source inventory is `absinthe-local-v2` v4
`writer_coordination_state`, with only exact
`[namespaceFingerprint,generationId]` rows matching the session namespace.
All other v4 stores, unrelated namespaces, legacy sources, and external
sources are excluded. Members occur exactly once; duplicates, missing or
inaccessible material fail closed; the empty set remains the package-defined
deterministic case; ordering never depends on IndexedDB enumeration.

Each retained member binds `storeIdentityBytes`, `keyBytes`, `valueBytes`, and
`recordDigest`. The accepted framing uses strict UTF-8 where applicable,
unsigned 64-bit lengths, no normalization, no locale behavior, and exact
structured-clone `Uint8Array` bytes without parsing or reserialization.

The accepted record domain is `absinthe:k334:retained-source-record:v1`.
The set order is unsigned-byte store identity then key bytes; count, all
members, and the exact retained-source-set preimage are bound. Where textual,
digests are lowercase 64-hex. Session source digest, checkpoint source digest
fields, applicable provenance source digest, and the artifact source-set digest
are the same accepted artifact digest and must agree exactly.

## 5. Accepted checkpoint usability and ROW-14 phase matrix

A checkpoint is usable only after strict verification of its embedded artifact,
source inventory, count, framing, member digests, outer digest, session/schema/
repository/namespace/scope bindings, completeness, verification result, and one
exact ROW-14 matrix match. Row presence or a matching digest alone is
insufficient. Missing, malformed, inaccessible, contradictory, or incomplete
material requires `MANUAL_INTERVENTION_REQUIRED` unless another exact accepted
safe action applies.

The complete nine-row phase/status/nullability/reference matrix is accepted.
It fixes phase, status, completeness, verification result, artifact and source
digest requirements, expected and verified target/projection digests, recovery
state digest, marker references, completion eligibility, and the sole permitted
next action. Every valid ROW-14 matches exactly one row; zero or multiple
matches fail closed. No status, null, or variant is implementation-inferred.

The accepted phase safety is:

- `pre_mutation` requires the complete artifact and source verification; target
  and projection verification are null and mutation has not started.
- `mutation_started` and `verification_pending` retain the source checkpoint
  and prohibit completion.
- `target_verified/verified` requires target/projection values equal to the
  expected values and may proceed only through the fresh completion fence.
- `target_verified/complete` is the unique atomic completion checkpoint with no
  contradictory unresolved recovery condition.
- `rollback_started` requires the exact open rollback marker and prohibits
  completion; `rollback_verified` requires the exact post-rollback evidence and
  does not infer completion.

## 6. Accepted B06 recovery-marker contract

The accepted ROW-15/MAP-15 grammar is
`mrm:v1:<batchId>:<kind>:<sequence>`. The only kind/status pairs are
`recovery_required/open` and `recovery_resolved/resolved`.

The exact phase, reason, and decision registries; session/checkpoint/state/
repository/namespace/scope bindings; and explicit nullability are accepted.
Marker sequences begin at `1`, are positive safe integers, contiguous,
non-reusable, and CAS-guarded. `markerOperationKey` provides restart-safe
rediscovery. At most one open marker exists per batch/scope, each resolution
binds one exact open marker, and resolution is append-only. A retry cannot
create multiple resolved markers for one operation; competing identity or
content fails closed.

Marker presence never grants resume, rollback, continuation, recovery success,
runtime, or production authority.

## 7. Accepted interruption, resume, rollback, and manual-intervention rules

The deterministic interruption protocol is accepted for checkpoint creation,
mutation, verification, completion recording, rollback/recovery, and marker
resolution. Every accepted boundary retains its exact observable state,
permitted action, prohibited action, and resume/rollback/manual-intervention
decision. Ambiguous, contradictory, unknown, or unproved state cannot advance;
best-effort repair and implicit advancement are prohibited.

`RESUME_PERMITTED_V1` requires exact operation/session, schema, repository,
namespace, scope, checkpoint, source, current-state, marker-graph, lease, and
phase agreement, plus the one exact next action. Stale workers, incomplete
checkpoints, contradictory markers, and newer verified canonical state block
resume. Resume grants no runtime or production authority.

`ROLLBACK_REQUIRED_V1` requires a verified usable checkpoint, exact bindings,
byte-available retained material, no newer verified canonical state,
deterministic permitted restoration, post-rollback verification, and retained
evidence. V1 rollback is limited to transaction abort or proven derived-state
restoration. Arbitrary canonical-state restoration, blind overwrite,
digest-only reconstruction, best-effort repair, deletion of newer state, and
automatic completion are not accepted.

`MANUAL_INTERVENTION_REQUIRED` blocks automatic progress, preserves recoverable
evidence, grants no repair authority, and applies to corruption, missing
material, graph conflict, unknown state, digest/scope mismatch, unsafe lease,
newer state, or any condition for which neither resume nor rollback is proven.

## 8. Accepted restart-safe retry contract

`SAME_AUTHORITATIVE_CONTENT_RETRY_NO_OP_V1` is accepted for session creation,
checkpoint creation and verification, recovery-required and recovery-resolution
markers, migration completion, and recovery completion. It covers both a
known-record-ID retry and a restart with only the durable operation key.

Exact retry first rediscovers committed records, retains original sequence and
storage-only timestamp, performs no mutation, allocates no replacement
identity, and creates no duplicate authority. Different authoritative content,
operation-key collision, mapping conflict, sequence gap, or identity divergence
fails closed.

## 9. Accepted fresh target completion fence and atomic pair

The accepted completion mechanism is a strict one-transaction reread of the
fixed thirteen migration-output stores, `authority_heads`, migration sessions,
checkpoints, and recovery markers. The inventory is not runtime-discovered.
Every target/projection row is strictly decoded, exact member sets are
reconstructed, and current target/projection digests are freshly recomputed.

Additional, missing, malformed, changed, or newer canonical members; a digest
mismatch; a contradictory unresolved marker; an unavailable participating
store; or reliance on an external stale digest blocks completion.

In that same transaction, the accepted protocol validates session and operation
identity, prior status, lease, predecessor checkpoint, completion key, unique
completion identity, scope, current read sets, expected/verified digests, and
recovery-marker graph; then it inserts the unique completion checkpoint and
transitions the session to `complete`. Neither fact can commit alone. There is
no multi-transaction or best-effort fallback, and `complete` grants no runtime
or production authority.

After an uncertain completion outcome, the exact session/checkpoint pair and
its target/projection values are rediscovered. An exact existing pair is a
no-op; divergent or partial evidence fails closed; migration writes do not need
replay merely to determine whether completion committed.

## 10. Accepted ROW/MAP, index, and shared-constraint portions

The complete ROW-12/MAP-12, ROW-14/MAP-14, and ROW-15/MAP-15 contracts are
accepted, including store identity/name, compound key, `autoIncrement=false`,
own-field inventory, grammar, discriminators, row version, preimage/digest
representation, semantic versus storage-only fields, strict exact-object
validation, reference equality, unsupported-version handling, corruption
handling, and total lossless reconstruction. Normalization, defaulting,
heuristic inference, and implementation-selected nullability or status are not
accepted.

Only these B04–B06 index bindings are accepted: session `by_source_status` and
`by_lease_epoch`; checkpoint `by_batch_sequence` and `by_batch_status`; marker
`by_batch_status`. They remain non-authoritative, uninstalled, and pending
separate descriptor implementation authority.

Only B04–B06 shared-constraint portions are accepted: store/key/family
coherence; discrimination; identity/preimage/digest/reconstruction; lifecycle,
lease, and CAS boundaries; append-only evidence; provenance; exact bindings;
cross-reference integrity; evidence/audit separation; retained artifact
integrity; operation-key rediscovery; matrix exclusivity; and fresh completion
fencing. No global shared constraint or B07–B08 portion is accepted.

## 11. Accepted data-safety and reusability boundaries

The accepted invariants prohibit mutation before a verified durable checkpoint,
checkpoint use before artifact verification, success from stale verification,
recovery resolution before verified closure, rollback over newer verified
canonical state, malformed/ambiguous state advancement, destructive cleanup,
duplicate retry authority, replacement identity allocation after uncertain
commit, and completion without one atomic participating-store transaction.
Corruption results only in quarantine, block, or manual intervention; recovery
evidence remains retained.

Reusable mechanism candidates are validators, artifact and equality verifiers,
operation-key rediscovery, CAS and retry helpers, recovery classification,
target-read-set verification, exact-object validation, declarative descriptors,
bounded diagnostics, and corruption/quarantine outcomes. The v4→v5 migration
meaning, source/target inventory, identities, registries, artifact meaning,
rows/maps/indexes, B04–B06, and K-334 lifecycle remain Absinthe-specific. This
record does not create or implement a reusable package.

## 12. B04–B06 closure effect

The following transition from `0` to `1` is accepted: the B04–B06 combined
package; B04, B05, and B06 authority resolution; B04 migration-session, B05
durable-checkpoint, and B06 recovery-marker contracts;
`IMMUTABLE_RETAINED_SOURCE_SET_V1`; durable operation-key rediscovery; the
exhaustive ROW-14 matrix; `RESUME_PERMITTED_V1`; `ROLLBACK_REQUIRED_V1`;
`MANUAL_INTERVENTION_REQUIRED`; `SAME_AUTHORITATIVE_CONTENT_RETRY_NO_OP_V1`;
the fresh target completion fence; the atomic completion pair; ROW/MAP 12, 14,
and 15; approved B04–B06 indexes; and B04–B06 shared-constraint portions.

No transition is made for global shared constraints, B07–B08,
K-334P09P acceptance, descriptor authority or implementation, migration
execution, D0-P09 rebound/execution/satisfaction, D0-P10, K-334E/F, runtime,
production eligibility, or checkpoint/artifact cleanup.

B04, B05, and B06 are authority-resolved but not implemented.

## 13. Authorization state

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 1
- B01 authority resolution accepted: 1
- B02 authority resolution accepted: 1
- B03 authority resolution accepted: 1
- B04–B06 combined package proposed: 1
- B04–B06 combined package accepted: 1
- B04 authority resolution accepted: 1
- B05 authority resolution accepted: 1
- B06 authority resolution accepted: 1
- B04 migration-session contract accepted: 1
- B05 durable-checkpoint contract accepted: 1
- B06 recovery-marker contract accepted: 1
- IMMUTABLE_RETAINED_SOURCE_SET_V1 accepted: 1
- Durable operation-key rediscovery accepted: 1
- Exhaustive ROW-14 phase matrix accepted: 1
- RESUME_PERMITTED_V1 accepted: 1
- ROLLBACK_REQUIRED_V1 accepted: 1
- MANUAL_INTERVENTION_REQUIRED accepted: 1
- SAME_AUTHORITATIVE_CONTENT_RETRY_NO_OP_V1 accepted: 1
- Fresh target completion fence accepted: 1
- Atomic completion pair accepted: 1
- ROW-12 / MAP-12 accepted: 1
- ROW-14 / MAP-14 accepted: 1
- ROW-15 / MAP-15 accepted: 1
- Approved B04–B06 index bindings accepted: 1
- B04–B06 shared-constraint portions accepted: 1
- B07–B08 authority resolution accepted: 0/2
- Descriptor-authority prerequisite accepted: 0
- Descriptor implementation authorization: 0/0
- Descriptor implementation: 0
- Descriptor authority accepted: 0
- D0-P09 authorization rebound: 0/0
- Effective D0-P09 execution authority: 0
- D0-P09 execution: 0
- D0-P09 satisfaction: 0
- D0-P10: 0/0
- K-334E/F authorization: 0/0
- Runtime authorization: 0
- Production eligibility: 0

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
