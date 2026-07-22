# K-334C3 — Durable Authority Schema and Migration Design

## 1. Executive Verdict

**Design status:** documentation-only design execution has started under the
exact K-334C3 authorization package merged by PR #601. This document proposes
a durable authority schema and migration model; it does not select, create, or
upgrade a production database.

The proposed target is an additive `absinthe-local-v2` database-format upgrade
from version **4** to version **5**. It separates append-only authority
evidence from rebuildable projections, binds all records to an exact namespace
and subject, represents compatibility as exact tuples, and permanently
quarantines a confirmed fork for the exact subject only. Every unresolved,
unknown, ambiguous, unsupported, malformed, or conflicting input fails closed.

This design does not make a writer, legacy source, authority record, database,
or production source eligible. K-334D/E/F own later implementation and remain
unauthorized.

## 2. Authorization and Scope Boundary

### Authorized design work

PR #601 merged `K334C3-AUTH-D01-A`: documentation-only design of durable
authority entities, identities, proposed version/stores/indexes, migration,
atomicity, recovery, proof obligations, and future task boundaries.

| State | Count |
|---|---:|
| Documentation-design authorization | 1 |
| K-334C3 design started | 1 |
| K-334C3 design document created | 1 |
| Independent design review | 0 |
| Design approved for implementation | 0 |

### Non-authorization boundary

This document does **not** authorize an IndexedDB upgrade callback, a store or
index, a data mutation, a repository, transaction, lock, migration executor,
runtime integration, admission, eligibility, activation, or production rollout.
All such work is a future separately reviewed task.

## 3. Authoritative Predecessors

| Evidence | Exact binding | Design consequence |
|---|---|---|
| K-334C2 policy | `K334C2-D01-A`, `K334C2-D02-B`, `K334C2-D03-A` | Append-only prospective lifecycle; exact tuples; permanent exact-subject fork quarantine. |
| Authorization proposal | `K334C3-AUTH-PROPOSAL-001`, `K334C3-AUTH-D01-v1` | Defines the allowed documentation-design boundary. |
| Publication | `K334C3-PUB-001` | Binds the reviewed proposal bytes. |
| Owner evidence | `K334C3-OWNER-EVIDENCE-001` | `OWNER_APPROVED_RECOMMENDATION`, option `K334C3-AUTH-D01-A`. |
| Merge | `f254c188c547889904fc00c0850620e4ad6d985e` | Completes the bounded Ready/Merge gate only. |

The proposal binding remains commit
`f8bd74cd2f09d71fa2d26ead00d5a02fd264c20f`, blob
`a58100f2b67f0af7d67c16fcea56ec217dba8d31`, SHA-256
`F0AFC803D3DDAFECB4B2EB5EF856D2071A56A6D690FE08870D1C948690190C4E`.

## 4. Current Source-Facts Audit

The following are source facts, not proposed behavior.

| Source | Confirmed fact | Consequence for this design |
|---|---|---|
| `frontend/src/lib/localDatabase/types.ts` | `LOCAL_DATABASE_NAME` is `absinthe-local-v2`; `LOCAL_DATABASE_VERSION` is 4; local namespaces contain user, project, device, generation, and schema version. | The proposal is a same-database **v4 → v5** additive upgrade scoped by the existing namespace key. |
| `frontend/src/lib/localDatabase/schema.ts` | v1 created eight stores; v2 added outbox indexes; v3 added restore indexes; v4 added only `writer_coordination_state`. Upgrades accept only old versions 0–3. | K-334D must extend the upgrade allowlist and add only v5 stores/indexes. It must not recreate existing stores. |
| `schema.ts:assertLocalDatabaseVersion` and `repository.ts:openLocalDatabase` | Opened version is strict; blocked opens are bounded; stale connections close on `versionchange`. | Upgrade and stale-tab behavior must remain fail-closed. |
| `types.ts` / `schema.ts` | Existing canonical local-first stores are metadata, generations, entities, outbox, checkpoints, restore sessions, migration state, attachment state, and writer coordination state. | Existing records are not silently reclassified as K-334 accepted authority. |
| `protocol/writerAuthorityProtocol.ts` | K-333 provides strict canonical record codecs and digest-bound representative writer/session/source-authority records. | K-334 stores exact canonical bytes/digests; it must not redefine K-333 codecs. |
| `protocol/transactionEvidenceProtocol.ts` | K-333 transaction evidence binds operation, admission, outbox intent, terminal state, and source references. | Durable authority evidence must reference exact K-333 identities/digests where applicable. |
| `frontend/docs/K-329-writer-coordination-eligibility-preconditions.md` | Reviewed writer inventory/manifest is not a durable resolver and current sources remain ineligible. | A manifest digest alone is never an issuer, mapping, compatibility tuple, or acceptance decision. |
| `frontend/docs/K-332-cross-module-source-authority-protocol-contract.md` | K-333 owns codecs/compatibility proofs; K-334 owns future additive persistence and transactions. | This design preserves the ownership split. |
| `frontend/docs/K-334A-durable-protocol-repository-atomicity-audit.md` | Existing v4 topology has no K-334 durable authority history; a durable byte or derived view is not acceptance. | All K-334 records are future proposed stores, not current runtime facts. |
| `frontend/docs/K-334C-neutral-durable-authority-architecture-analysis.md` | Existing handoff, local-first, legacy fallback, and writer-coordination state do not establish K-334 authority. | Legacy classification defaults to quarantine or no-source, never acceptance. |

**Confirmed current version:** 4. **Proposed future target:** 5. The target is
an implementation proposal, not an authorization to alter version 4.

## 5. Design Principles

1. **Append-only evidence.** Canonical authority, policy, termination, mapping,
   observation, and provenance records are immutable. Corrections add a linked
   record; they never overwrite prior evidence.
2. **Prospective effects.** A lifecycle, mapping, compatibility, or
   termination event applies only from its explicit logical effective boundary.
   Timestamps are recording metadata, never authority ordering or expiry.
3. **Strict linear accepted history.** One accepted successor may occupy each
   exact subject/lineage/predecessor position. A competitor creates preserved
   conflict/fork evidence, not last-write-wins.
4. **Exact compatibility.** A record is compatible only when a canonical,
   exact tuple matches one accepted allowlist entry. There is no range,
   family, Cartesian, or “close enough” inference.
5. **Exact-subject fork quarantine.** A confirmed fork permanently blocks
   acceptance and state-changing issuance for that exact subject, while leaving
   unrelated subjects unaffected.
6. **Explicit mappings.** External identities require durable mapping evidence;
   name, account, ownership, time, or proximity never supplies a mapping.
7. **Fail closed.** Unknown, unsupported, missing, malformed, ambiguous,
   duplicate, cyclic, or conflicting data receives no authority effect.
8. **Evidence before projection.** A head or status projection is rebuildable
   convenience state and can never outrank canonical evidence.

## 6. Proposed Entity Model

All records carry `recordType`, `recordSchemaVersion`, `recordId`,
`repositoryNamespace`, `provenance`, `recordedAt`, and `canonicalDigest` unless
the row is explicitly a derived projection. `recordedAt` is audit metadata only.

| Entity | Purpose and identity | Canonical status / behavior | Proposed store and key |
|---|---|---|---|
| Authority subject | Exact authority subject; `subjectId` is opaque and namespace-bound. | Canonical identity; immutable; no inherited authority across generation. | `authority_subjects`; `[namespaceKey, subjectId]` |
| Authority issuer | Exact issuer identity, distinct from an external mapping. | Canonical identity; immutable. | `authority_issuers`; `[namespaceKey, issuerId]` |
| Scoped issuer policy | Explicit issuer/action/subject-scope permission. | Canonical policy state; append-only lifecycle links; no inferred issuer. | `authority_issuer_policies`; `[namespaceKey, policyId]` |
| Authority grant | Proposed/accepted lifecycle evidence for an action. | Canonical append-only evidence; one lineage position only. | `authority_evidence`; `[namespaceKey, evidenceId]` |
| Successor relationship | Exact predecessor-to-successor link. | Canonical evidence plus non-unique logical-position lookup; competing link is observed and preserved, never replaced. | `authority_evidence` |
| Durable termination | Prospective termination of exact grant/policy/mapping. | Canonical append-only evidence; does not delete target. | `authority_terminations`; `[namespaceKey, terminationId]` |
| Rollback permission | Separate permission for an exact rollback target/scope. | Canonical policy evidence; never inferred from an issuer grant. | `authority_rollback_permissions`; `[namespaceKey, permissionId]` |
| Compatibility tuple | Exact allowlist tuple and policy lifecycle. | Canonical policy state; tuple identity is canonical serialization digest. | `authority_compatibility_tuples`; `[namespaceKey, tupleId]` |
| External subject mapping | Explicit external-to-subject association. | Canonical append-only mapping; ambiguity blocks both directions. | `authority_external_mappings`; `[namespaceKey, mappingId]` |
| External issuer mapping | Explicit external-to-issuer association. | Canonical append-only mapping; never creates issuer authority itself. | `authority_external_mappings`; `[namespaceKey, mappingId]` |
| Fork observation | Evidence of same-position competing accepted candidates. | Append-only observation; preserves all branches. | `authority_fork_observations`; `[namespaceKey, observationId]` |
| Conflict observation | Evidence of non-fork semantic conflict. | Append-only observation; no auto-resolution. | `authority_conflict_observations`; `[namespaceKey, observationId]` |
| Subject quarantine | Exact-subject durable fail-closed state. | Durable quarantine state plus immutable basis references; permanent for confirmed fork. | `authority_quarantines`; `[namespaceKey, subjectId]` |
| Accepted evidence | Acceptance decision over exact evidence and policy bindings. | Canonical append-only evidence, distinct from raw grant bytes. | `authority_evidence` (`kind=accepted_authority_evidence`) |
| Rejected/unsupported evidence | Preserves non-accepted inputs and bounded reason code. | Append-only observation; never silently dropped. | `authority_evidence` (`kind=rejected_or_unsupported`) |
| Migration session / lease | Durable batch identity, source binding, and CAS lease epoch. | Recovery metadata; no authority effect and no in-memory-only ownership. | `authority_migration_sessions`; `[namespaceKey, batchId]` |
| Migration classification | Per legacy source/record disposition A–F. | Migration metadata; immutable classification revision with supersession. | `authority_migration_classifications`; `[namespaceKey, classificationId]` |
| Migration checkpoint | Batch/session progress and verified counts/digests. | Recovery metadata; append-only checkpoints, one completion marker. | `authority_migration_checkpoints`; `[namespaceKey, checkpointId]` |
| Recovery/reconciliation marker | Detects interrupted projection/replay and blocks effect. | Recovery metadata; never grants authority. | `authority_recovery_markers`; `[namespaceKey, markerId]` |
| Authority head | Current accepted head for exact subject/lineage. | Rebuildable derived view; digest-bound to canonical set. | `authority_heads`; `[namespaceKey, subjectId, lineageId]` |
| Audit/provenance event | Stable reference to source, recorder, action, and digest. | Append-only audit evidence; payload-free references where possible. | `authority_audit_events`; `[namespaceKey, auditEventId]` |

Canonical records retain predecessor/supersession references and effective
boundaries. Derived records may be deleted and rebuilt only in a future,
authorized recovery operation; canonical evidence may not.

### Entity validation, retention, and effect contract

The following matrix supplies the fields not repeated in the concise entity
catalog. Every `issuer` and provenance reference is exact, optional only where
shown, and strictly decoded. “No effect” means no acceptance, eligibility, or
runtime activation.

| Entity group | Required issuer/provenance | Lineage, boundary, termination, conflict | Validation and fail-closed rule | Retention / view |
|---|---|---|---|---|
| Subject / issuer | No issuer; creation provenance required. | No lifecycle effect by identity alone. | Duplicate exact ID with different bytes is corruption. | Canonical, retain forever. |
| Issuer policy / rollback permission | Exact issuer, source evidence, recorder, tuple, subject/action scope. | Predecessor/supersession; prospective boundary; explicit termination; conflict observation. | Missing policy/tuple/mapping or duplicate active claim blocks applicability. | Canonical policy, append-only. |
| Grant / successor / accepted-rejected evidence | Exact issuer and source/provenance required. | Lineage + predecessor; prospective sequence; termination reference; competitor becomes observation. | Reject cycles, missing predecessor, unsupported kind, invalid digest. Same-position candidates are preserved and conflict/fork handling blocks acceptance. | Canonical, append-only. |
| Termination | Exact terminating issuer/policy and target evidence. | Target-specific prospective boundary; may itself be superseded/terminated only by explicit future evidence. | No target deletion or retrospective reclassification. | Canonical, append-only. |
| Tuple / external mapping | Recorder, source evidence, exact namespace required; mapping also provider/identifier. | Explicit supersession/termination and conflict handling. | Tuple/mapping ambiguity, implicit relation, or unknown provider blocks lookup. | Canonical, append-only. |
| Fork/conflict/quarantine | Detection provenance and exact observed evidence digests. | Fork binds exact subject permanently; conflict has no inferred successor. | Any confirmed fork invalidates that subject head; unrelated subject remains unaffected. | Observations and quarantine retained. |
| Classification / checkpoint / marker | Migration batch and source digest required. | Classification supersession; checkpoint sequence; marker resolution only by new evidence. | Missing/invalid checkpoint blocks resume and effect. | Metadata; append-only history. |
| Head / audit | Head references canonical-set digest; audit references source record/digest. | Head has projection epoch only; audit is append-only. | Head mismatch/staleness is unusable; audit cannot substitute for evidence. | Head rebuildable; audit retained. |

## 7. Identity and Key Model

| Identity | Form | Generation/collision rule |
|---|---|---|
| `repositoryNamespace` | exact opaque repository/install namespace | Required in every record; mismatch rejects. |
| `namespaceKey` | existing local namespace fingerprint/key | Required first key component; prevents cross-user/project/device reuse. |
| `subjectId`, `issuerId`, `lineageId` | opaque externally supplied or deterministically derived canonical identifiers | Validate strict identifier codec; no display-name or auto-increment identity. |
| `recordId` | fixed typed prefix and fixed record-id domain tag from the Section 7 tag registry | Content-addressed only for the record kinds listed below. Same semantic preimage is the same ID; same ID with different canonical bytes is an integrity conflict. |
| `predecessorRecordId`, `supersedesRecordId` | exact record IDs or `null` | Missing referenced row, cycle, or self-link fails closed. |
| `tupleId` | `dat:v1:<sha256(tuple-id preimage)>` | Same exact tuple bytes are idempotent; no normalized range expansion. |
| mapping / observation / quarantine / checkpoint / audit IDs | content-addressed or exact composite as specified in the preimage table | Never depend solely on time or object/array insertion order. |
| `migrationBatchId` | locally generated, strict opaque session ID bound in its body to namespace + source digest | A restart reuses the same validated batch, not a new implicit batch. It is process-oriented, not content-addressed authority. |

An external identifier is unique only within its exact `(provider,
externalNamespace, externalIdentifier, mappingKind)` key. A subject identity is
not an external identity, and an issuer identity is not a subject identity.

### Canonical bytes, preimages, and digest relationships

K-334 uses the existing K-333 primitive
`frontend/src/lib/localDatabase/protocol/canonicalProtocolValue.ts` exactly for
canonical payload bytes (`encodeCanonicalProtocolValue`) and
`canonicalProtocolPreimage.ts` exactly for outer framing
(`buildCanonicalProtocolPreimage`). This is a precise reuse, not raw
JavaScript `JSON.stringify`: the future K-334D domain registry must add only
the domain tags listed below to that preimage primitive before it accepts a
K-334 record. K-334 owns the record-field contracts and K-334D owns that
future codec implementation; neither is implemented by this document.

For every content-addressed input, the payload passed to the primitive is an
ordered array of `[fieldName, value]` pairs in the exact order in the table
below. It is therefore independent of object-key iteration. The existing
primitive supplies UTF-8 bytes, NFC-only valid Unicode strings, lexicographic
UTF-8 ordering for any nested object keys, lowercase JSON literals `true`,
`false`, and `null`, decimal safe-integer representation without `-0`, and
rejects `undefined`, non-finite numbers, sparse arrays, non-plain objects,
and non-canonical bytes. Every optional protocol field is present in its
listed position and is encoded as `null`; omission is invalid. Digests are
lowercase ASCII SHA-256 hex strings, byte values are lowercase hex strings,
and sequences are positive safe integers. Arrays are in protocol order (never
arrival or locale order). Prose examples never override this ordered-field
contract. A codec change, new field, domain change, or limit change requires a
new explicit schema/version and golden byte fixtures.

For a content-addressed row, `recordId` and `canonicalDigest` are computed
independently over the *same* immutable semantic ordered-field list but with
the two literal ASCII domain tags assigned to that record type in the tag
registry below. Placeholder tags, inferred tag construction, and a tag from a
different record type are invalid:

```text
record-id bytes = buildCanonicalProtocolPreimage(
  recordType.fixedRecordIdDomainTag, 1, orderedFields)
canonical-digest bytes = buildCanonicalProtocolPreimage(
  recordType.fixedCanonicalDigestDomainTag, 1, orderedFields)
```

`recordType.fixed…DomainTag` is notation for a literal registry cell, never a
payload field, runtime lookup rule, or tag-construction algorithm.

The stored identifier is the typed prefix in the table plus the SHA-256 of its
record-id bytes. `canonicalDigest` is the SHA-256 of its canonical-digest
bytes. Thus neither includes `recordId`, `canonicalDigest`, storage keys,
timestamps, projection status, validation results, migration bookkeeping, or
database-generated metadata. `recordedAt` is non-identity metadata in every
record, and source bytes remain represented only by the separately validated
`sourceDigest`. Unknown schema/domain tags are unsupported and fail closed.
`subjectId`, `issuerId`, and `lineageId` themselves remain strict opaque
protocol identifiers rather than K-334 content-addressed record IDs; their
future creation/registration has no authority effect and is blocked absent
their own validated provenance. Every K-334 canonical record that *is*
content-addressed is enumerated below.

In the table, the shorthand **boundary fields in order** is exactly
`boundary.effectiveSequence`, `boundary.effectiveAfterRecordId`,
`boundary.prospectiveOnly`; **provenance fields in order** is exactly
`provenance.sourceKind`, `provenance.sourceRecordId`,
`provenance.sourceDigest`, `provenance.recorderId`. Each nested value is the
strict scalar or explicit `null` described above, never an object serialized
by insertion order.

| Record type | ID method and domain tag | Exact ordered semantic preimage fields | Explicit exclusions | Digest relationship and conflict rule |
|---|---|---|---|---|
| authority evidence | `dar:v1:authority-evidence:<sha256>`; `absinthe:k334:authority-evidence:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `subjectId`, `issuerId`, `lineageId`, `predecessorRecordId`, `supersedesRecordId`, `action`, `lifecycleStatus`, `boundary.effectiveSequence`, `boundary.effectiveAfterRecordId`, `boundary.prospectiveOnly`, `compatibilityTupleId`, `provenance.sourceKind`, `provenance.sourceRecordId`, `provenance.sourceDigest`, `provenance.recorderId` | `recordId`, `canonicalDigest`, `recordedAt`, projection/head fields, validation/migration fields | Same list with `absinthe:k334:authority-evidence:v1:canonical-digest`; same ID + same bytes is idempotent, different bytes is integrity conflict. |
| issuer policy | `dar:v1:issuer-policy:<sha256>`; `absinthe:k334:issuer-policy:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `issuerId`, `subjectId`, `action`, `compatibilityTupleId`, `lifecycleStatus`, `predecessorRecordId`, `supersedesRecordId`, `terminationRecordId` or `null`, boundary fields in order, provenance fields in order | `policyId`, `recordId`, `canonicalDigest`, `recordedAt`, applicability cache/current state | Same list under `absinthe:k334:issuer-policy:v1:canonical-digest`; duplicate-by-ID rules above. |
| rollback permission | `dar:v1:rollback-permission:<sha256>`; `absinthe:k334:rollback-permission:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `issuerId`, `subjectId`, `rollbackTargetRecordId`, `compatibilityTupleId`, `predecessorRecordId`, `supersedesRecordId`, `terminationRecordId` or `null`, boundary fields in order, provenance fields in order | `permissionId`, `recordId`, `canonicalDigest`, `recordedAt`, current applicability | Same list under `absinthe:k334:rollback-permission:v1:canonical-digest`; duplicate-by-ID rules above. |
| termination | `dar:v1:termination:<sha256>`; `absinthe:k334:termination:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `subjectId`, `issuerId`, `targetKind`, `targetRecordId`, `issuerAuthorityRecordId`, `predecessorRecordId`, `supersedesRecordId`, boundary fields in order, provenance fields in order | `terminationId`, `recordId`, `canonicalDigest`, `recordedAt`, current terminated state | Same list under `absinthe:k334:termination:v1:canonical-digest`; duplicate-by-ID rules above. |
| compatibility tuple | `dat:v1:<sha256>`; `absinthe:k334:compatibility-tuple:v1:tuple-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, then exactly `(authorityProtocolVersion, authorityRecordSchemaVersion, manifestEvidenceVersion, subjectNamespace, issuerNamespace, compatibilityPolicyVersion, installationNamespace, action, sourceClass, migrationEpoch)`, then boundary and provenance fields in the order above | `tupleId`, `canonicalDigest`, `recordedAt`, lookup cache/status projection | Same tuple list under `absinthe:k334:compatibility-tuple:v1:canonical-digest`; byte-identical tuple is idempotent; same ID/different bytes blocks use. |
| external subject mapping | `dar:v1:external-subject-mapping:<sha256>`; `absinthe:k334:external-subject-mapping:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `mappingKind`, `provider`, `externalNamespace`, `externalIdentifier`, `internalId`, `predecessorRecordId`, `supersedesRecordId`, boundary, provenance | `mappingId`, `canonicalDigest`, `recordedAt`, reverse cache/ambiguity result | Same list under `absinthe:k334:external-subject-mapping:v1:canonical-digest`; same external key with a different target is preserved as conflict, never normalized. |
| external issuer mapping | `dar:v1:external-issuer-mapping:<sha256>`; `absinthe:k334:external-issuer-mapping:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `mappingKind`, `provider`, `externalNamespace`, `externalIdentifier`, `internalId`, `predecessorRecordId`, `supersedesRecordId`, boundary, provenance | `mappingId`, `canonicalDigest`, `recordedAt`, reverse cache/ambiguity result | Same list under `absinthe:k334:external-issuer-mapping:v1:canonical-digest`; same external key with a different target is preserved as conflict, never normalized. |
| fork observation | `dar:v1:fork-observation:<sha256>`; `absinthe:k334:fork-observation:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `subjectId`, `lineageId` or `null`, `effectiveSequence`, `predecessorRecordId` or `null`, `candidateCollectionBytes` lowercase hex, bounded reason/code, provenance | `observationId`, `canonicalDigest`, `recordedAt`, head/quarantine projection fields | Same list under `absinthe:k334:fork-observation:v1:canonical-digest`; exact duplicate is idempotent, distinct observation is retained. |
| conflict observation | `dar:v1:conflict-observation:<sha256>`; `absinthe:k334:conflict-observation:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `subjectId`, `lineageId` or `null`, `effectiveSequence`, `predecessorRecordId` or `null`, `candidateCollectionBytes` lowercase hex, bounded reason/code, provenance | `observationId`, `canonicalDigest`, `recordedAt`, head/quarantine projection fields | Same list under `absinthe:k334:conflict-observation:v1:canonical-digest`; exact duplicate is idempotent, distinct observation is retained. |
| quarantine | exact physical subject slot `[namespaceKey, subjectId]` plus `dar:v1:subject-quarantine:<sha256>` record identity; `absinthe:k334:subject-quarantine:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `subjectId`, `quarantineState`, `reasonCode`, `quarantineBasisCollectionBytes` lowercase hex, `permanent`, boundary, provenance | physical slot, `quarantineRecordId`, `basisDigest`, `canonicalDigest`, `recordedAt`, head invalidation flag | Same list under `absinthe:k334:subject-quarantine:v1:canonical-digest`; membership changes change both record identity and digest. The physical slot is only the exact-subject state projection and never substitutes for the immutable identity. |
| migration session / lease | opaque strict `migrationBatchId` generated once; session digest domain `absinthe:k334:migration-session:v1:canonical-digest` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `batchId`, `sourceDigest`, `sessionStatus`, `leaseEpoch`, `leaseHolderId` or `null`, `leaseBoundarySequence` or `null`, provenance | `canonicalDigest`, wall-clock lease timestamps, UI progress, storage metadata | Process-oriented batch identity; same primary key + different canonical bytes requires a validated CAS transition or fails as corruption. It cannot be used as authority evidence. |
| migration classification | `dar:v1:migration-classification:<sha256>`; `absinthe:k334:migration-classification:v1:record-id` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `batchId`, `sourceKind`, `sourceDigest`, `classification`, `supersedesClassificationId` or `null`, provenance | `classificationId`, `canonicalDigest`, progress display, `recordedAt` | Same list under `absinthe:k334:migration-classification:v1:canonical-digest`; one source may have superseding classifications, which remain preserved. |
| migration checkpoint / recovery marker | exact composite `mcp:v1:<batchId>:<checkpointSequence>` or `mrm:v1:<batchId>:<markerKind>:<markerSequence>`; digest domains `absinthe:k334:migration-checkpoint:v1:canonical-digest` and `absinthe:k334:recovery-marker:v1:canonical-digest` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `batchId`, exact sequence, phase/status or marker kind/status, verified source/count/set digests, provenance | own process ID, `canonicalDigest`, wall-clock timestamp, mutable UI progress | Process-oriented IDs are deterministic composites; a same composite + different canonical bytes is corruption, never overwrite. |
| audit event | exact composite `dae:v1:<recordId>:<eventKind>:<eventSequence>`; digest domain `absinthe:k334:audit-event:v1:canonical-digest` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `recordId`, `eventKind`, `eventSequence`, `sourceDigest`, `recorderId`, bounded context code | `auditEventId`, `canonicalDigest`, `recordedAt`, payload, stack/cause | Same composite + different canonical bytes is corruption; no audit event substitutes for canonical evidence. |
| authority-head projection | exact derived key `[namespaceKey, subjectId, lineageId]`; digest domain `absinthe:k334:authority-head:v1:projection-digest` | `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `subjectId`, `lineageId`, `acceptedEvidenceId` or `null`, `acceptedEvidenceDigest` or `null`, `effectiveSequence` or `null`, `canonicalSetDigest`, `projectionEpoch`, `projectionState` | storage key, `projectionDigest`, rebuild metadata/timestamps | Derived and rebuildable, never canonical evidence. Mismatch, duplicate derived candidate, or missing matching accepted evidence blocks use. |

### Normative K-334 tag registry

Every tag in this table is a fixed ASCII byte sequence. A decoder compares it
byte-for-byte; an unknown tag, wrong tag/type pairing, or a tag whose declared
schema does not match the payload is an integrity conflict and fails closed.
Changing a schema, canonical bytes, field order, codec rule, or limit requires
a new explicit tag/version and golden byte fixtures. No tag is assembled from
runtime strings.

For every canonical preimage in this design, its fixed domain tag is bound
**exactly once**. The K-333 outer `domain` parameter is the sole domain/version
marker for that layer; semantic payload fields never restate the same literal.
A same-layer duplicate domain field is non-canonical and must be rejected or
fail closed. Nested layers are valid only when their tags differ: canonical
pair bytes bind one pair domain, a collection binds one collection domain while
embedding those pair bytes, and a parent record binds one parent domain while
embedding collection bytes. Manually prepending or adding the same layer's
domain literal again is invalid.

| Record or helper type | Fixed ID / primary tag | Fixed digest / projection tag | Schema | Ordered preimage reference | Namespace-bearing | Duplicate behavior | Unknown/wrong tag behavior |
|---|---|---|---|---|---|---|---|
| authority evidence | `absinthe:k334:authority-evidence:v1:record-id` | `absinthe:k334:authority-evidence:v1:canonical-digest` | v1 | Section 7 authority-evidence row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| issuer policy | `absinthe:k334:issuer-policy:v1:record-id` | `absinthe:k334:issuer-policy:v1:canonical-digest` | v1 | Section 7 issuer-policy row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| rollback permission | `absinthe:k334:rollback-permission:v1:record-id` | `absinthe:k334:rollback-permission:v1:canonical-digest` | v1 | Section 7 rollback-permission row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| termination | `absinthe:k334:termination:v1:record-id` | `absinthe:k334:termination:v1:canonical-digest` | v1 | Section 7 termination row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| compatibility tuple | `absinthe:k334:compatibility-tuple:v1:tuple-id` | `absinthe:k334:compatibility-tuple:v1:canonical-digest` | v1 | Section 7 compatibility-tuple row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| external subject mapping | `absinthe:k334:external-subject-mapping:v1:record-id` | `absinthe:k334:external-subject-mapping:v1:canonical-digest` | v1 | Section 7 subject-mapping row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| external issuer mapping | `absinthe:k334:external-issuer-mapping:v1:record-id` | `absinthe:k334:external-issuer-mapping:v1:canonical-digest` | v1 | Section 7 issuer-mapping row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| conflict observation | `absinthe:k334:conflict-observation:v1:record-id` | `absinthe:k334:conflict-observation:v1:canonical-digest` | v1 | Section 7 conflict-observation row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| fork observation | `absinthe:k334:fork-observation:v1:record-id` | `absinthe:k334:fork-observation:v1:canonical-digest` | v1 | Section 7 fork-observation row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| subject quarantine | `absinthe:k334:subject-quarantine:v1:record-id` | `absinthe:k334:subject-quarantine:v1:canonical-digest` | v1 | Section 7 quarantine row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| migration classification | `absinthe:k334:migration-classification:v1:record-id` | `absinthe:k334:migration-classification:v1:canonical-digest` | v1 | Section 7 classification row | required | same bytes no-op; different bytes conflict | unsupported / integrity conflict |
| migration session | strict opaque `migrationBatchId` composite | `absinthe:k334:migration-session:v1:canonical-digest` | v1 | Section 7 session row | required | same composite/bytes no-op; different bytes corrupt | unsupported / integrity conflict |
| migration checkpoint | `mcp:v1:<batchId>:<checkpointSequence>` composite | `absinthe:k334:migration-checkpoint:v1:canonical-digest` | v1 | Section 7 checkpoint row | required | same composite/bytes no-op; different bytes corrupt | unsupported / integrity conflict |
| recovery marker | `mrm:v1:<batchId>:<markerKind>:<markerSequence>` composite | `absinthe:k334:recovery-marker:v1:canonical-digest` | v1 | Section 7 marker row | required | same composite/bytes no-op; different bytes corrupt | unsupported / integrity conflict |
| audit event | `dae:v1:<recordId>:<eventKind>:<eventSequence>` composite | `absinthe:k334:audit-event:v1:canonical-digest` | v1 | Section 7 audit row | required | same composite/bytes no-op; different bytes corrupt | unsupported / integrity conflict |
| authority-head projection | `[namespaceKey, subjectId, lineageId]` composite | `absinthe:k334:authority-head:v1:projection-digest` | v1 | Section 7 head row | required | same projection no-op; mismatch blocks | unsupported / integrity conflict |
| candidate reference pair | `absinthe:k334:candidate-reference:v1:pair` | none; bytes embedded only | v1 | Section 7 pair payload | inherited from parent | byte-identical pair dedup only | unsupported / integrity conflict |
| candidate reference collection | `absinthe:k334:candidate-reference:v1:collection` | none; bytes embedded only | v1 | Section 7 collection payload | inherited from parent | sort then byte-identical pair dedup | unsupported / integrity conflict |
| quarantine-basis reference pair | `absinthe:k334:quarantine-basis-reference:v1:pair` | none; bytes embedded only | v1 | Section 7 basis-pair payload | inherited from parent | byte-identical pair dedup only | unsupported / integrity conflict |
| quarantine-basis reference collection | `absinthe:k334:quarantine-basis-reference:v1:collection` | none; bytes embedded only | v1 | Section 7 basis-collection payload | inherited from parent | sort then byte-identical pair dedup | unsupported / integrity conflict |

### Candidate and quarantine-basis byte collections

`CandidateReferenceV1` is the exact, inseparable candidate binding:

```ts
type CandidateReferenceV1 = {
  candidateRecordId: RecordId;
  candidateCanonicalDigest: Sha256;
};

type QuarantineBasisReferenceV1 = {
  observationRecordId: RecordId;
  observationCanonicalDigest: Sha256;
};
```

Each candidate pair is canonical UTF-8 bytes from
`buildCanonicalProtocolPreimage("absinthe:k334:candidate-reference:v1:pair",
1, payload)` where the outer domain is its sole tag/version marker and
`payload` is exactly the fixed-order array
`[["candidateRecordId", id], ["candidateCanonicalDigest", digest]]`.
There are no optional, null, metadata, timestamp, provenance, or ordering
fields in that pair. A quarantine-basis pair uses the same K-333 primitive and
outer length framing with fixed tag
`absinthe:k334:quarantine-basis-reference:v1:pair` and exactly
`[["observationRecordId", id], ["observationCanonicalDigest", digest]]`.
Neither pair payload contains `pairTag`, `domainTag`, a version marker, or a
literal equivalent to its outer domain. Pair equality is byte-identical final
K-333-framed bytes; the outer domain frames the payload before its bytes and
does not appear again inside it. A double-tag encoding (outer domain plus an
equivalent payload field) produces non-canonical bytes and must not validate as
a canonical pair.

A collection first canonically encodes every pair, then sorts the **full pair
byte sequences** by unsigned bytewise lexicographic comparison from byte zero;
when one is a strict prefix, the shorter sequence sorts first. It does not use
locale comparison, case folding, timestamp, arrival order, object iteration,
or textual ID/digest order. It then rejects a repeated record/observation ID
paired with a different digest as an integrity conflict; deduplicates only
byte-identical adjacent pairs; preserves different IDs with the same digest;
and permits an empty collection only when the owning record type explicitly
allows it. Candidate collection bytes are the K-333 outer frame for
`absinthe:k334:candidate-reference:v1:collection`, version 1, and the exact
payload:

```text
[["elementCount", N],
 ["elements", [[pairByteLength, lowercaseHexPairBytes], ...]]]
```

The quarantine-basis collection uses the identical fixed payload shape with
`absinthe:k334:quarantine-basis-reference:v1:collection`. `pairByteLength`
must equal the decoded byte length of its lowercase hex exactly. Thus the
collection is framed pair-by-pair under the K-333 primitive; it never relies
on raw concatenation, an unframed hash-of-hashes, or parallel arrays. Sorting,
ID/digest binding, duplicate detection, and byte-length validation complete
before a parent record ID or digest is calculated.

The collection outer domain is likewise its sole tag/version marker. Neither
collection payload contains `collectionTag`, `domainTag`, a version marker, or
a literal equivalent to its outer domain. Thus the semantic payload is only
the final post-deduplication element count followed by independently framed,
sorted pair bytes. A double-tag encoding (outer domain plus an equivalent
payload field) produces non-canonical bytes and must not validate as a
canonical collection.

When a parent canonical payload includes a collection, its field value is the
lowercase hex encoding of the entire framed collection byte sequence (named
`candidateCollectionBytes` or `quarantineBasisCollectionBytes` as applicable).
The parent does not decode, reserialize, concatenate, or hash that value again
as a substitute for collection membership.

| Helper preimage | Sole outer domain | Exact ordered semantic payload | Explicit exclusions |
|---|---|---|---|
| candidate reference pair | `absinthe:k334:candidate-reference:v1:pair` | `candidateRecordId`, `candidateCanonicalDigest` | `pairTag`, any domain/version field, status, timestamp, projection state, mutable metadata |
| candidate reference collection | `absinthe:k334:candidate-reference:v1:collection` | final `elementCount`, ordered individually framed `candidatePairBytes` | `collectionTag`, any domain/version field, arrival order, source indexes, mutable metadata |
| quarantine-basis reference pair | `absinthe:k334:quarantine-basis-reference:v1:pair` | `observationRecordId`, `observationCanonicalDigest` | `pairTag`, any domain/version field, status, timestamp, projection state, mutable metadata |
| quarantine-basis reference collection | `absinthe:k334:quarantine-basis-reference:v1:collection` | final `elementCount`, ordered individually framed `quarantineBasisPairBytes` | `collectionTag`, any domain/version field, arrival order, source indexes, mutable metadata |

Conflict and fork observation preimages include the candidate collection bytes
in their listed field position, after predecessor and before bounded reason and
provenance. Quarantine preimages include the quarantine-basis collection bytes
in their listed field position, after reason and before permanence, boundary,
and provenance. Changing collection membership changes the corresponding
parent record ID and canonical digest; a permutation of the same valid pairs
does not. Implementations must never separately sort and zip IDs and digests,
infer a digest by array position, accept a mismatched pair, deduplicate by ID
or digest alone, use JSON insertion order, `localeCompare`, timestamps, or
arrival order.

`sourceDigest` is not an authority-record ID: it is the digest required by the
strict source codec for the exact supplied source bytes. `tupleId` is the
table's fixed ten-dimension tuple in exactly the displayed order; it excludes
`tupleId`, `canonicalDigest`, activation/head fields, and mutable recording
metadata. The future K-334D implementation must expose golden preimage bytes
for every row above and reject circular field sets before persistence.

## 8. Proposed Database Version

### Proposed transition

`absinthe-local-v2`: **4 → 5**, one additive version step.

Version 4 is a confirmed source fact from
`frontend/src/lib/localDatabase/types.ts`; `createLocalDatabaseSchema()` in
`schema.ts` currently recognizes historical upgrades through v3 and adds
`writer_coordination_state` at v4. K-334D must extend—not replace—that logic
to accept v4 and create the proposed stores/indexes in the native versionchange
transaction.

### Compatibility and rollback

- A v4 client cannot understand v5 authority stores. It must close on
  `versionchange` and fail closed rather than write/clear unknown stores.
- IndexedDB versions do not support a normal downgrade. “Rollback” is logical:
  preserve canonical v5 evidence, quarantine/ignore a failed batch, and rebuild
  projections after a later authorized protocol.
- Additive creation preserves existing v1–v4 stores, active generation,
  entities, outbox, restore, migration, attachment, and writer-coordination
  records.
- Blocked upgrade, quota failure, unsupported future version, or an unexpected
  oldVersion fails closed; no destructive fallback is allowed.

## 9. Proposed Object Stores

All names below are proposals for v5. `autoIncrement` is false for every store.
“K-334D/E/F” identifies a future implementation owner, not current code.

| Store | Class | Key path | Index family / transaction group | Delete/rebuild / migration source |
|---|---|---|---|---|
| `authority_subjects` | canonical identity | `[namespaceKey, subjectId]` | subject, subject namespace; identity/policy | Never delete; no trustworthy legacy source by default. |
| `authority_issuers` | canonical identity | `[namespaceKey, issuerId]` | issuer, external mapping reference | Never delete; no implicit legacy issuer. |
| `authority_issuer_policies` | canonical policy | `[namespaceKey, policyId]` | subject/action/effective sequence | Append-only; legacy only with explicit policy evidence. |
| `authority_evidence` | canonical append-only evidence | `[namespaceKey, evidenceId]` | subject, issuer, lineage/predecessor, status, digest | Never delete; preserves accepted/rejected/unsupported evidence. |
| `authority_rollback_permissions` | canonical policy | `[namespaceKey, permissionId]` | subject, issuer, target, status | Append-only; no inferred source. |
| `authority_terminations` | canonical lifecycle evidence | `[namespaceKey, terminationId]` | target ID, issuer, subject, effective sequence | Append-only; no target deletion. |
| `authority_compatibility_tuples` | canonical policy | `[namespaceKey, tupleId]` | exact tuple composite, status, supersedes | Append-only; explicit allowlist only. |
| `authority_external_mappings` | canonical mapping evidence | `[namespaceKey, mappingId]` | provider/type/external ID; internal ID; status | Append-only; ambiguity quarantined. |
| `authority_fork_observations` | append-only observation | `[namespaceKey, observationId]` | subject, lineage, predecessor, candidate digest | Never delete; basis for permanent quarantine. |
| `authority_conflict_observations` | append-only observation | `[namespaceKey, observationId]` | subject, conflict code, evidence digest | Never delete; no automatic resolution. |
| `authority_quarantines` | durable quarantine state | `[namespaceKey, subjectId]` | subject, state, basis digest | One exact state per subject; no delete/release without future authorization. |
| `authority_migration_sessions` | migration/lease metadata | `[namespaceKey, batchId]` | source digest, status, lease epoch | One durable batch session; lease state is CAS-bound and never inferred from memory. |
| `authority_migration_classifications` | migration metadata | `[namespaceKey, classificationId]` | batch, source kind, class, source digest | Append-only supersession; preserves unsupported source. |
| `authority_migration_checkpoints` | recovery metadata | `[namespaceKey, checkpointId]` | batch, phase, sequence, status | Append-only checkpoints; completion only after verification. |
| `authority_recovery_markers` | recovery metadata | `[namespaceKey, markerId]` | batch/subject, marker status | Append-only; cleared only by superseding resolved marker. |
| `authority_heads` | derived view | `[namespaceKey, subjectId, lineageId]` | subject/lineage, head digest, projection epoch | Rebuildable; mismatch blocks effect. |
| `authority_audit_events` | append-only audit | `[namespaceKey, auditEventId]` | subject, record ID, source digest, recorded sequence | Retain; no payload-only audit replacement. |

Every future write owner is K-334D repository interface plus K-334E transaction
coordination. K-334F owns migration/rebuild/recovery execution. Runtime readers
are not authorized by this document.

### Store ownership, cardinality, and recovery schedule

| Store | Expected cardinality | Future writer / reader | Transaction grouping | Deletion, rebuild, and recovery |
|---|---|---|---|---|
| `authority_subjects`, `authority_issuers` | bounded by exact known identities | K-334D/E / future validator only | identity + policy/evidence | no deletion; reopen/strict-decode on recovery |
| `authority_issuer_policies`, `authority_rollback_permissions`, `authority_terminations` | append-only per subject/action | K-334D/E / future validator | policy/lifecycle + audit | no deletion; replay from canonical rows |
| `authority_evidence` | append-only, potentially highest volume | K-334D/E / future validator/projection builder | evidence + audit + head/quarantine | no deletion; canonical replay source |
| `authority_compatibility_tuples`, `authority_external_mappings` | bounded allowlist/mapping history | K-334D/E / future validator | policy/mapping + audit | no deletion; ambiguity is retained |
| `authority_fork_observations`, `authority_conflict_observations`, `authority_quarantines` | sparse per affected subject | K-334E / future validator | conflict + quarantine + head + audit | no deletion; quarantine remains durable |
| `authority_migration_sessions`, `authority_migration_classifications`, `authority_migration_checkpoints`, `authority_recovery_markers` | bounded by batches and preserved source rows | K-334E/F / future recovery | migration session/lease + batch/checkpoint | append-only history; CAS lease and resume from last verified checkpoint |
| `authority_heads` | at most one derived head per subject/lineage | K-334E/F / future read gate | evidence/policy + head | may be invalidated and rebuilt, never trusted alone |
| `authority_audit_events` | append-only per write/recovery event | K-334D/E/F / audit only | paired with every canonical mutation | retain; never replace evidence |

## 10. Proposed Indexes

All proposed indexes are `multiEntry: false`. A “canonical” index supports
validation; a “convenience” index is never authority by itself.

| Store / index | Key path | Unique | Use and failure behavior |
|---|---|---:|---|
| `authority_evidence/by_subject_lineage_sequence` | `[namespaceKey, subjectId, lineageId, effectiveSequence]` | false | Lookup and conflict discovery only. It returns every canonical candidate at a logical position and is never proof that one candidate is accepted. |
| `authority_evidence/by_predecessor` | `[namespaceKey, predecessorRecordId]` | false | Finds competitors; arrival order never chooses a winner. |
| `authority_evidence/by_subject_status` | `[namespaceKey, subjectId, lifecycleStatus]` | false | Convenience validation lookup; stale result cannot grant authority. |
| `authority_evidence/by_issuer` | `[namespaceKey, issuerId]` | false | Audit/policy validation. |
| `authority_evidence/by_digest` | `[namespaceKey, canonicalDigest]` | true | Idempotency and byte-conflict detection. |
| `authority_issuer_policies/by_subject_action_sequence` | `[namespaceKey, subjectId, action, effectiveSequence]` | false | Exact issuer-policy applicability. |
| `authority_rollback_permissions/by_target` | `[namespaceKey, subjectId, rollbackTargetRecordId]` | false | Requires separate exact permission. |
| `authority_terminations/by_target` | `[namespaceKey, targetRecordId, effectiveSequence]` | false | Prospective lifecycle validation. |
| `authority_compatibility_tuples/by_exact_tuple` | `[namespaceKey, tupleDigest]` | true | Exact allowlist lookup; missing/duplicate fails closed. |
| `authority_external_mappings/by_external` | `[namespaceKey, mappingKind, provider, externalNamespace, externalIdentifier]` | false | Ambiguity detection, never implicit lookup. |
| `authority_external_mappings/by_internal` | `[namespaceKey, mappingKind, internalId]` | false | Reverse audit; conflict blocks use. |
| `authority_fork_observations/by_subject_predecessor` | `[namespaceKey, subjectId, predecessorRecordId]` | false | Fork evidence and exact quarantine basis. |
| `authority_conflict_observations/by_subject_code` | `[namespaceKey, subjectId, conflictCode]` | false | Preserves unresolved conflicts. |
| `authority_quarantines/by_state` | `[namespaceKey, quarantineState]` | false | Convenience check; exact subject key is canonical. |
| `authority_migration_sessions/by_source_status` | `[namespaceKey, sourceDigest, sessionStatus]` | false | Finds a validated reusable session; never selects a holder by arrival order. |
| `authority_migration_sessions/by_lease_epoch` | `[namespaceKey, batchId, leaseEpoch]` | true | Exact session/epoch CAS lookup; stale holder conflicts and stops writes. |
| `authority_migration_classifications/by_batch_class` | `[namespaceKey, batchId, classification]` | false | Batch accounting; never accepts source evidence. |
| `authority_migration_checkpoints/by_batch_sequence` | `[namespaceKey, batchId, checkpointSequence]` | true | Resumption ordering; not wall-clock ordering. |
| `authority_heads/by_subject` | `[namespaceKey, subjectId]` | false | Derived lookup only; requires canonical digest revalidation. The unique projection slot is the primary key `[namespaceKey, subjectId, lineageId]`, not an evidence index. |

No timestamp index is an authority ordering source. If operational ordering is
needed, it is secondary to an explicit canonical sequence and predecessor link.

### Complete index coverage

| Store | Exact proposed indexes not otherwise listed | Classification |
|---|---|---|
| `authority_subjects` | `by_subject_namespace` → `[namespaceKey, subjectId]` unique | canonical identity |
| `authority_issuers` | `by_issuer_namespace` → `[namespaceKey, issuerId]` unique | canonical identity |
| `authority_issuer_policies` | `by_issuer_subject_action` → `[namespaceKey, issuerId, subjectId, action]`; `by_policy_digest` → `[namespaceKey, canonicalDigest]` unique | canonical lookup |
| `authority_evidence` | the five indexes in the preceding table | canonical lookup |
| `authority_rollback_permissions` | `by_issuer_subject` → `[namespaceKey, issuerId, subjectId]`; `by_permission_digest` unique | canonical lookup |
| `authority_terminations` | `by_subject_sequence` → `[namespaceKey, subjectId, effectiveSequence]`; `by_termination_digest` unique | canonical lookup |
| `authority_compatibility_tuples` | `by_exact_tuple`; `by_tuple_status` → `[namespaceKey, lifecycleStatus]` | canonical lookup |
| `authority_external_mappings` | `by_external`; `by_internal`; `by_mapping_digest` unique | canonical lookup |
| `authority_fork_observations` | `by_subject_predecessor`; `by_observation_digest` unique | observation lookup |
| `authority_conflict_observations` | `by_subject_code`; `by_observation_digest` unique | observation lookup |
| `authority_quarantines` | `by_state`; exact primary key is one-per-subject | canonical state |
| `authority_migration_sessions` | `by_source_status`; `by_lease_epoch` | migration/lease metadata |
| `authority_migration_classifications` | `by_batch_class`; `by_source_digest` → `[namespaceKey, sourceDigest]` | migration metadata |
| `authority_migration_checkpoints` | `by_batch_sequence`; `by_batch_status` → `[namespaceKey, batchId, status]` | recovery metadata |
| `authority_recovery_markers` | `by_batch_status` → `[namespaceKey, batchId, markerStatus]` | recovery metadata |
| `authority_heads` | `by_subject`; `by_projection_digest` → `[namespaceKey, canonicalSetDigest]` | convenience only |
| `authority_audit_events` | `by_subject`; `by_record` → `[namespaceKey, recordId]`; `by_source_digest` | audit lookup |

The only unique accepted-position slot is the derived `authority_heads` primary
key `[namespaceKey, subjectId, lineageId]`. Sequence is deliberately omitted:
the row represents the one current accepted head for that exact lineage, with
its accepted sequence in the row body. Older accepted canonical evidence and
all same-position candidates remain append-only evidence. No IndexedDB unique
index on canonical authority evidence enforces conditional accepted-state
uniqueness. Every other unique index collision is validation evidence of a
duplicate/corrupt *identity* input and must abort the affected write; a
competing evidence candidate is preserved rather than rejected.

## 11. Proposed Record Schemas

The following is non-executable design pseudocode. `Required<T>` means a
strictly decoded canonical value; optional fields are explicit `null`, never
inferred. All canonical shapes reject unknown fields in the future codec.
Fields labelled `canonical input` appear in their record-kind ordered preimage
from Section 7; `derived` fields are computed only after those bytes; and
`metadata` never changes canonical identity or digest.

```ts
type AuthorityBoundary = {
  effectiveSequence: CanonicalSequence; // required, not timestamp-derived
  effectiveAfterRecordId: RecordId | null;
  prospectiveOnly: true;
};

type Provenance = {
  sourceKind: 'k333_codec' | 'legacy' | 'owner_evidence' | 'migration';
  sourceRecordId: string | null;
  sourceDigest: Sha256;
  recorderId: string;
};

type AuthorityEvidenceV1 = {
  recordType: 'authority_evidence_v1'; recordSchemaVersion: 1;
  recordId: RecordId; // derived: never preimage input
  repositoryNamespace: RepositoryNamespace; // canonical input
  namespaceKey: NamespaceKey; subjectId: SubjectId; issuerId: IssuerId;
  lineageId: LineageId; predecessorRecordId: RecordId | null;
  supersedesRecordId: RecordId | null; action: AuthorityAction;
  lifecycleStatus: 'proposed' | 'recorded' | 'accepted' | 'superseded' |
    'terminated' | 'rollback_applied' | 'unsupported' | 'malformed';
  boundary: AuthorityBoundary; compatibilityTupleId: TupleId;
  provenance: Provenance; canonicalDigest: Sha256; // derived: never preimage input
  recordedAt: IsoTime; // non-identity metadata
};

type CompatibilityTupleV1 = {
  recordType: 'authority_compatibility_tuple_v1'; recordSchemaVersion: 1;
  tupleId: TupleId; // derived: never tuple preimage input
  repositoryNamespace: RepositoryNamespace;
  authorityProtocolVersion: 1; authorityRecordSchemaVersion: 1;
  manifestEvidenceVersion: 1; subjectNamespace: string; issuerNamespace: string;
  compatibilityPolicyVersion: 1; installationNamespace: string;
  action: AuthorityAction; sourceClass: SourceClass; migrationEpoch: string;
  boundary: AuthorityBoundary; provenance: Provenance; canonicalDigest: Sha256; // derived
};

type ExternalSubjectMappingV1 = {
  recordType: 'external_subject_mapping_v1';
  recordSchemaVersion: 1; mappingId: RecordId; // derived: never preimage input
  repositoryNamespace: RepositoryNamespace;
  mappingKind: 'subject'; provider: string; externalNamespace: string;
  externalIdentifier: string; internalId: SubjectId;
  predecessorRecordId: RecordId | null; supersedesRecordId: RecordId | null;
  boundary: AuthorityBoundary; provenance: Provenance; canonicalDigest: Sha256; // derived
};

type ExternalIssuerMappingV1 = {
  recordType: 'external_issuer_mapping_v1';
  recordSchemaVersion: 1; mappingId: RecordId; // derived: never preimage input
  repositoryNamespace: RepositoryNamespace;
  mappingKind: 'issuer'; provider: string; externalNamespace: string;
  externalIdentifier: string; internalId: IssuerId;
  predecessorRecordId: RecordId | null; supersedesRecordId: RecordId | null;
  boundary: AuthorityBoundary; provenance: Provenance; canonicalDigest: Sha256; // derived
};

type CandidateReferenceV1 = {
  candidateRecordId: RecordId;
  candidateCanonicalDigest: Sha256;
};

type QuarantineBasisReferenceV1 = {
  observationRecordId: RecordId;
  observationCanonicalDigest: Sha256;
};

type SubjectQuarantineV1 = {
  recordType: 'subject_quarantine_v1'; recordSchemaVersion: 1;
  quarantineRecordId: RecordId; // derived; physical slot is [namespaceKey, subjectId]
  repositoryNamespace: RepositoryNamespace;
  namespaceKey: NamespaceKey; subjectId: SubjectId; quarantineState: 'forked';
  reasonCode: string;
  quarantineBasisCollectionBytes: LowercaseHex; // framed Section 7 collection
  basisDigest: Sha256; // derived from those exact collection bytes
  permanent: true; boundary: AuthorityBoundary; provenance: Provenance;
  recordedAt: IsoTime; canonicalDigest: Sha256; // metadata / derived
};

type AuthorityMigrationSessionV1 = {
  // process-oriented primary key: [namespaceKey, batchId], never authority evidence
  recordType: 'authority_migration_session_v1'; recordSchemaVersion: 1;
  namespaceKey: NamespaceKey; batchId: string; sourceDigest: Sha256;
  sessionStatus: 'planned' | 'running' | 'blocked' | 'failed' | 'complete';
  leaseEpoch: CanonicalSequence; leaseHolderId: string | null;
  leaseBoundarySequence: CanonicalSequence | null; provenance: Provenance;
  canonicalDigest: Sha256; recordedAt: IsoTime; // derived / metadata
};

type AuthorityHeadV1 = {
  // derived projection, never canonical evidence and never an acceptance grant
  recordType: 'authority_head_v1'; recordSchemaVersion: 1;
  namespaceKey: NamespaceKey; subjectId: SubjectId; lineageId: LineageId;
  acceptedEvidenceId: RecordId | null; acceptedEvidenceDigest: Sha256 | null;
  effectiveSequence: CanonicalSequence | null; canonicalSetDigest: Sha256;
  projectionEpoch: CanonicalSequence; projectionState: 'verified' | 'blocked';
  projectionDigest: Sha256; // derived; exact Section 7 projection preimage
};
```

`AuthorityHeadV1` has exactly one physical projection slot per
`[namespaceKey, subjectId, lineageId]`. It cannot exist without a matching,
strictly revalidated canonical accepted-evidence row. A missing, stale,
duplicated, blocked, corrupt, or digest-mismatched head is unusable; it never
falls back to evidence arrival order. No shape may infer issuer authority,
mapping, compatibility, expiry, predecessor, or acceptance from a timestamp,
name, account, or row order.

### Canonical record-kind field matrix

| Record kind | Additional required canonical fields | Optional fields | Derived-only fields |
|---|---|---|---|
| subject / issuer | exact opaque ID, namespace, provenance digest | external mapping reference | none |
| issuer policy | issuer, subject/action scope, tuple ID, lifecycle status | predecessor, supersedes, termination | applicability cache |
| authority grant / acceptance / rejection | issuer, subject, lineage, predecessor, sequence, action, tuple, evidence digest | supersedes, termination | accepted-head pointer |
| rollback permission | issuer, subject, exact rollback target, tuple, boundary | termination/supersedes | current rollback applicability |
| termination | target kind/ID, issuer authority reference, subject, boundary | predecessor/supersedes | current terminated state |
| compatibility tuple | all ten tuple dimensions, boundary, provenance | predecessor/supersedes/termination | tuple lookup cache |
| external mapping | fixed subject-or-issuer kind, provider, external/internal IDs, boundary, provenance | predecessor/supersedes/termination | reverse lookup cache |
| fork/conflict observation | subject, lineage, effective sequence, predecessor, canonical candidate-reference collection bytes, bounded reason, provenance | none for v1 collection | none |
| quarantine | exact subject, reason, canonical quarantine-basis collection bytes, permanent flag, boundary, provenance | none for v1 confirmed fork | head invalidation flag |
| classification/checkpoint/marker | batch, source digest, exact status/sequence, provenance | supersedes/resolution reference | progress display |
| audit event | referenced record/action/source digest and recorder | bounded context code | none |

## 12. Authority Lifecycle Model

| From → to | Required evidence and transaction | Prohibited behavior |
|---|---|---|
| proposed → recorded | Strict codec success and immutable recording transaction. | Acceptance by decode alone. |
| recorded → accepted | Exact issuer policy, mapping, tuple, predecessor, sequence, and no quarantine; canonical + projection transaction. | Timestamp/latest-row choice. |
| accepted → effective | Exact accepted projection rebuilt/verified under later authorized runtime gate. | Implied effect from storage or migration. |
| accepted → superseded | New append-only exact successor with valid predecessor. | In-place replacement. |
| accepted/policy/mapping → terminated | Separate authorized termination with prospective boundary. | Deleting history or retroactive invalidation. |
| accepted → rollback-permitted / rollback-applied | Separate rollback permission, then exact lineage target. | Generic issuer authority as rollback permission. |
| recorded/accepted → conflicted/forked | Preserved competitor observation, then exact-subject quarantine for confirmed fork. | Automatic resolution. |
| any → unsupported/malformed/legacy-unclassified | Preserve source plus bounded reason and recovery marker. | Drop or default acceptance. |

Every transition is an append-only new record. A projection rebuild is required
after canonical set change; it cannot erase earlier accepted evidence.

## 13. Issuer Policy Model

An issuer policy is a canonical scoped record with exact `issuerId`,
`subjectId` (or explicitly enumerated exact subject set), `action`, tuple ID,
boundary, predecessor/supersession, termination reference, provenance, and
policy digest. Its applicability requires all exact bindings to match.

No policy may be inferred from user ownership, account relationship, prior
unrelated grant, email/name, record creator, or external login. Policy conflict
creates an observation and blocks effect for the exact subject/action.

## 14. Rollback Permission Model

Rollback permission is a separate `authority_rollback_permission_v1` record:
issuer, exact subject, permitted target record/lineage, exact tuple,
prospective boundary, termination/supersession links, provenance, and digest.
K334C2-D01-A selects no automatic expiry; a future termination record is the
only end of applicability. A rollback permission does not perform a rollback;
the later rollback event references it in the same canonical transaction.

## 15. Durable Termination Model

Termination is `authority_termination_v1`, bound to one target kind and target
record ID, issuer policy/authority evidence, subject, effective sequence,
provenance, and digest. It ends future applicability only. Existing accepted
history remains readable and auditable. Competing or unauthorized termination
is preserved as conflict/unsupported evidence and produces no effect.

## 16. Exact Compatibility Tuple Model

The v1 exact compatibility tuple is:

`(authorityProtocolVersion, authorityRecordSchemaVersion,
manifestEvidenceVersion, subjectNamespace, issuerNamespace,
compatibilityPolicyVersion, installationNamespace, action, sourceClass,
migrationEpoch)`.

The tuple ID is the SHA-256 digest of a fixed-order canonical serialization of
those ten dimensions. Lookup requires byte-for-byte equality against one
accepted, non-terminated tuple record. A missing, duplicate, unsupported, or
superseded tuple fails closed. Decoder success is not compatibility.

## 17. External Mapping Model

Subject and issuer mappings use distinct `mappingKind` values and records.
They contain provider, external namespace, external identifier, exact internal
ID, evidence source, recorder, boundary, lineage/supersession/termination,
provenance, and digest. The external composite index detects multiple active
claims; ambiguity creates conflict evidence and blocks both forward and reverse
use. Matching email, username, display name, ownership, or provider login is
not mapping evidence.

## 18. Fork, Conflict, and Quarantine Model

A competing successor is two distinct evidence records for the same exact
subject, lineage, predecessor, and effective sequence. A conflict may concern
policy, mapping, termination, or compatibility without proving a lineage fork.
A confirmed fork creates immutable observations for every branch and exactly one
`authority_quarantines` row for its subject. The row is permanent for a
confirmed fork, survives restart/migration/replay, selects no head, blocks
state-changing issuance for that subject, and never quarantines another subject.
There is no automatic resolution, timestamp winner, or evidence deletion.

Every fork/conflict observation carries the Section 7 canonical candidate
collection, not parallel candidate-ID and digest arrays. The observation
preimage order is exactly record type, schema, repository namespace, namespace
key, subject, lineage or `null`, effective sequence, predecessor or `null`,
candidate collection bytes, bounded reason/code, then provenance fields. The
quarantine row carries the separate Section 7 quarantine-basis collection of
observation `(recordId, digest)` pairs. It is intentionally not a candidate
collection: its members are observations. Its preimage order is exactly record
type, schema, repository namespace, namespace key, subject, quarantine state,
reason code, basis collection bytes, permanent flag, boundary fields, then
provenance fields. This prevents a mutable, bare ID list from being mistaken
for evidence. Basis membership changes the quarantine record identity and
digest, while valid ordering permutations do not.

## 19. Canonical Evidence and Derived Views

Canonical: subjects, issuers, issuer policies, grants/acceptance/rejection,
rollback permissions, terminations, tuples, mappings, observations,
quarantines, classifications, checkpoints, markers, and audit events.

Derived: `authority_heads` and any future query acceleration view. A derived
head records the canonical-set digest and projection epoch. On missing row,
digest mismatch, stale epoch, quarantine, or rebuild marker, it is unusable and
the caller fails closed. Rebuild scans canonical evidence in canonical sequence,
verifies every reference/tuple/policy, and writes a new projection atomically
where practical; otherwise a durable recovery marker prevents effect until the
rebuild is verified.

Accepting a successor is not evidence insertion. The future acceptance
transaction reads **all** canonical candidates for the exact
`[namespaceKey, subjectId, lineageId, effectiveSequence]` position, the exact
predecessor, applicable issuer policy, compatibility tuple, required mappings,
termination/rollback state, quarantine, observations, and the current head.
It verifies strict predecessor continuity and that there is no competing
accepted candidate, conflict, fork, or quarantine. It preserves the candidate
in canonical evidence, then atomically updates the one derived head slot only
when that full graph validates. A competitor instead creates/preserves
observation and exact-subject quarantine state, invalidates or blocks the
projection, and aborts permissive advancement. It never deletes either
candidate. Projection mismatch triggers rebuild, reconciliation, conflict, or
quarantine; it cannot grant authority.

Candidate discovery must first produce exact `CandidateReferenceV1` pairs,
validate each pair against its evidence record and canonical digest, and build
the Section 7 canonical collection before any acceptance/fork/conflict parent
identity is calculated. The acceptance path never treats an ID-only lookup,
arrival order, or a digest from another pair as membership evidence.

## 20. Transaction and Atomicity Matrix

The following is an operation-level future contract, not implementation. Store
codes are: `E` evidence, `P` issuer policies, `R` rollback permissions, `T`
terminations, `U` tuples, `M` external mappings, `F` fork observations, `C`
conflict observations, `Q` quarantines, `H` derived heads, `S` migration
sessions/leases, `G` classifications, `K` checkpoints, `X` recovery markers,
and `A` audit events. `rw` means one native IndexedDB readwrite transaction
over the stated scope; `ro` is read-only. `same-bytes` means the Section 7
same-ID/same-canonical-bytes idempotent duplicate rule; `different-bytes`
means integrity conflict. `abort` rolls back that transaction; a crash before
commit is equivalent to abort and after commit is recovered from the durable
postcondition. All retry keys are exact canonical/composite IDs, never clocks.

| Operation ID | Operation name | Purpose | Canonical inputs | Stores read | Stores written | Transaction mode | Atomicity scope | Preconditions | Validation steps | Postconditions | Unique/conflict checks | Fail-closed outcome | Abort behavior | Crash point behavior | Retry behavior | Idempotency key | Duplicate handling | Recovery / reconciliation path | Projection impact | Quarantine impact | Future implementation owner | Future test categories |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T01 | Insert authority evidence | Append raw canonical evidence. | Section 7 evidence body | E | E,A | rw | E,A | strict decoded namespace | codec, preimage, digest, refs | immutable row + audit | ID/digest; logical index non-unique | reject unsupported/corrupt | no row | before commit none; after commit audit present | same ID replay | evidence ID | same-bytes no-op; different-bytes conflict | inspect E/A; mark X if audit absent | none | none | K-334D | codec, duplicate, crash |
| T02 | Insert scoped issuer policy | Preserve prospective policy. | policy body | P,U,E,Q | P,A | rw | P,A | exact scope/tuple | codec, issuer, boundary | policy retained | policy ID/digest; competing scopes observed later | no applicability | no row | replay P/A pair | same ID replay | policy ID | same-bytes no-op | audit/revalidate policy graph | none | policy conflict may later block | K-334D | codec, policy conflict |
| T03 | Insert rollback permission | Preserve separate rollback authority. | permission body | R,P,U,E,Q | R,A | rw | R,A | exact target/policy | codec, target, tuple, prospective boundary | permission retained | ID/digest and target conflict | no rollback effect | no row | replay permission/audit | same ID replay | permission ID | same-bytes no-op | revalidate target graph | none | conflict blocks use | K-334D | policy, duplicate |
| T04 | Insert durable termination | Preserve prospective termination. | termination body | T,P,E,U,Q | T,A | rw | T,A | exact target/policy | codec, authority, boundary | termination retained | ID/digest; competing termination preserved | no lifecycle change | no row | replay termination/audit | same ID replay | termination ID | same-bytes no-op | recompute/invalidate H | invalidate affected H | conflict blocks subject/action | K-334D | lifecycle, crash |
| T05 | Insert exact compatibility tuple | Preserve allowlist tuple. | exact ten-dimension tuple | U | U,A | rw | U,A | exact tuple only | tuple preimage/digest | tuple retained | tuple ID/digest | tuple unavailable | no row | replay tuple/audit | same ID replay | tuple ID | same-bytes no-op | strict tuple lookup | none | none | K-334D | golden bytes, duplicate |
| T06 | Insert external subject mapping | Preserve subject mapping. | subject mapping body | M,U,Q | M,A | rw | M,A | exact provider key | codec, target, boundary | mapping retained | external key different target is conflict | mapping unusable | no row | replay mapping/audit | same ID replay | mapping ID | same-bytes no-op | discover ambiguity, create T10 | none | ambiguity blocks subject | K-334D | mapping ambiguity |
| T07 | Insert external issuer mapping | Preserve issuer mapping. | issuer mapping body | M,U,Q | M,A | rw | M,A | exact provider key | codec, target, boundary | mapping retained | external key different target is conflict | mapping unusable | no row | replay mapping/audit | same ID replay | mapping ID | same-bytes no-op | discover ambiguity, create T10 | none | ambiguity blocks affected use | K-334D | mapping ambiguity |
| T08 | Accept a linear successor | Advance only verified lineage. | candidate ID + accepted evidence body | E,P,U,M,T,R,F,C,Q,H | E,H,A | rw | E,H,A plus C/F/Q if conflict discovered | exact predecessor/current H | all same-position candidates, policy, tuple, mappings, no termination/quarantine | accepted evidence and matching H | no competing accepted/candidate; H primary slot | abort advancement and route T09–T12 | no acceptance/head | before commit no advance; after commit H/evidence agree | re-read full graph | evidence ID + head key | same accepted bytes no-op; otherwise conflict | T30/T31/T32 on mismatch | atomically set verified H | blocks if any conflict/fork | K-334E | successor, race, crash |
| T09 | Observe a competing successor | Retain competing candidate. | canonical candidate-reference collection bytes | E,H,Q | E,F,A | rw | E,F,A | candidates share exact position | pair binding, exactly-once outer domains, unsigned byte sort, duplicate/conflict rules | evidence + fork observation retained | never unique-index reject candidate | no projection advancement | no partial observation | committed observation persists; uncommitted none | same observation replay | observation ID | same-bytes no-op | T11/T12 and T31 | mark H blocked if needed | candidate basis preserved | K-334E | coexistence, pair binding, fork |
| T10 | Declare a conflict | Preserve non-fork conflict. | conflict observation plus canonical candidate-reference collection bytes | E,P,R,T,U,M,Q,H | C,A,H | rw | C,A,H | exact conflicting inputs | bounded code, digest/ref checks, pair binding, exactly-once outer domains | conflict retained, H blocked if affected | same conflict ID; no inferred winner | affected lookup unusable | no partial state | replay observation/head invalidation | same conflict replay | observation ID | same-bytes no-op | T31 reconcile H | invalidate/block affected H | create T12 if subject-wide | K-334E | policy/mapping conflict, pair binding |
| T11 | Confirm a fork | Establish permanent exact-subject fork. | canonical candidate-reference collection plus observation bodies | E,F,C,Q,H | F,C,Q,H,A | rw | F,C,Q,H,A | verified distinct successors | exact subject/lineage/predecessor/sequence, canonical collection, exactly-once outer domains | all observations + permanent Q; H blocked | preserve every branch; Q one subject key | no authority for subject | no partial fork state | after commit Q/H durable; before none | same branch set replay | fork observation ID | same-bytes no-op | T12/T31/T30 only blocked rebuild | selected head removed/blocked | exact-subject permanent Q | K-334E | exact-subject fork, collection replay |
| T12 | Create or preserve exact-subject quarantine | Make subject fail closed. | quarantine body plus canonical quarantine-basis collection bytes | Q,F,C,E,H | Q,H,A | rw | Q,H,A | exact subject/basis | observation pair binding, exactly-once outer domains, unsigned byte sort, basis digest, permanent state | Q exists and H blocked | Q slot one subject; different immutable basis identity reconciled | no release/inference | no partial Q | before commit no Q; after commit Q/H durable | replay Q/H pair | subject slot + quarantine record ID | same bytes no-op; mismatched pair/basis conflict | T31 reconcile basis | block H | preserves or creates Q | K-334E | restart, corruption, basis binding |
| T13 | Update accepted authority-head projection | Write derived verified head only. | Section 7 projection body | E,P,U,M,T,R,F,C,Q,H | H,A | rw | H,A | T08 graph valid | canonical set digest, accepted row, no conflict/Q | one verified H row | primary slot CAS; stale epoch conflicts | H unusable | old H unchanged | postcommit revalidate digest | rebuild-safe retry | H primary key + epoch | same projection no-op | T30/T31 | set/replace derived H | none | K-334E | CAS, stale head |
| T14 | Insert rejected or unsupported evidence | Preserve non-authoritative source. | evidence body + bounded reason | E,Q | E,X,A | rw | E,X,A | strict bounded source available | codec failure classification/digest | non-authoritative row/marker retained | ID/digest | never accepted | no row | replay row/marker | same ID replay | evidence ID | same-bytes no-op | T32 inspect marker | none | none unless subject conflict | K-334D/F | malformed, replay |
| T15 | Insert malformed evidence preservation record | Preserve undecodable bytes metadata. | bounded source digest/kind/reason | X,G | X,G,A | rw | X,G,A | source bytes retained externally | bounds, reason, source digest | marker/classification retained | composite marker key | no decoding/acceptance | no row | resume from marker | same marker replay | marker ID | same-bytes no-op | T20/T26 | none | none | K-334F | malformed, crash |
| T16 | Classify one legacy source record | Persist A–F disposition. | source digest/classification | G,S | G,A | rw | G,A | live lease/session | source identity, class evidence | immutable classification retained | classification ID/source supersession | no promotion by class alone | no row | before commit no classification; after classification retained | replay classification | same source/class key | same-bytes no-op | T17–T20 | none | C/E paths preserve/block | K-334F | classification property |
| T17 | Migrate one class-A record | Promote verified A only. | A classification + canonical body | S,G,E,P,U,M,Q,H | E,G,A,X | rw | S,E,G,A,X | verified A, lease, no Q | exact source digest/full graph | canonical row + verified migration evidence | source/record ID/digest | stop batch | no partial promotion | marker permits replay | retry after lease recheck | source digest + record ID | same-bytes no-op | T25/T32 | no H unless separately T08/T30 | Q blocks promotion | K-334F | migration, crash |
| T18 | Preserve class-B pending evidence | Retain evidence awaiting policy. | B classification/source digest | S,G | G,X,A | rw | G,X,A | verified B, lease | no policy/tuple/mapping sufficient | pending marker retained | classification/source digest | no promotion | no partial marker | before commit none; after marker retained | replay marker | same key | same-bytes no-op | resume only on new evidence | none | none | K-334F | pending evidence |
| T19 | Preserve and quarantine class-C record | Retain unsafe legacy source. | C classification/source digest | S,G,Q,H | G,Q,H,X,A | rw | G,Q,H,X,A | verified C, lease | bounded reason/basis | source retained and blocked | subject key/basis | no promotion | no partial block | before commit no block; after Q/marker durable | replay Q/marker | source digest | same-bytes no-op | T31/T32 | H blocked | exact subject if mapped; otherwise marker | K-334F | quarantine migration |
| T20 | Preserve class-E unsupported/malformed record | Retain unsupported source. | E classification/source digest | S,G | G,X,A | rw | G,X,A | verified E, lease | strict unsupported reason | source marker retained | source digest | no promotion | no row | before commit none; after marker durable | replay marker | source digest | same-bytes no-op | T26/T32 | none | none | K-334F | unsupported replay |
| T21 | Create migration session | Establish durable batch. | session body/source digest | S,G,K,X | S,A | rw | S,A | no conflicting active session | namespace/source/status/ID | session planned | batch ID/source status | no migration start | no session | before commit no session; after session durable | replay session | batch ID | same-bytes no-op | T22/T26 | none | none | K-334E/F | session lifecycle |
| T22 | Acquire migration lease or single-writer ownership | Linearize batch writes. | batch ID, holder, expected epoch | S | S,A | rw | S,A | session resumable, no valid other holder | exact CAS epoch/namespace | holder+epoch advanced | stale epoch/holder conflicts | stop writes | no lease change | committed epoch wins | reread then retry only new epoch | batch ID+expected epoch | same holder epoch no-op | T24/T26/T33 | none | none | K-334E | multi-tab, CAS |
| T23 | Renew migration lease | Maintain verified holder. | batch ID, holder, epoch | S | S,A | rw | S,A | held exact lease | CAS holder/epoch/boundary | renewal recorded | stale holder conflicts | stop writer | no renewal | stale tab loses after commit | only current holder retry | batch/holder/epoch | same renewal no-op | T24/T33 | none | none | K-334E | stale tab |
| T24 | Release or abandon migration lease | End ownership without deletion. | batch ID, holder, epoch, reason | S | S,A,X | rw | S,A,X | exact current holder or proved abandonment | CAS/recovery proof | released/abandoned state retained | stale release conflicts | lease remains blocking | no partial release | resume validates state | idempotent state retry | batch/epoch/status | same state no-op | T22/T26 | none | none | K-334E/F | abandonment, restart |
| T25 | Write migration checkpoint | Record verified batch boundary. | batch phase/sequence/digests | S,G,K,E,H,X | K,A | rw | K,A | held lease, verified prior work | counts/set/projection digests | append checkpoint | batch+sequence unique | batch blocked | no checkpoint | postcommit checkpoint resumes | same checkpoint retry | checkpoint ID | same-bytes no-op | T26/T34 | H digest referenced only | none | K-334F | checkpoint crash |
| T26 | Resume interrupted migration batch | Continue only verified state. | session/checkpoint IDs | S,K,X,G,E,H | S,X,A | rw | S,K,X,A | valid session/lease/checkpoint | strict decode/digest/reconcile | resumable phase or blocked marker | duplicate/invalid checkpoint | no new writes | no partial resume status | crash leaves prior checkpoint | deterministic replay | batch+checkpoint digest | same decision no-op | T17–T25/T32 | H revalidated | Q preserved | K-334F | restart, corruption |
| T27 | Mark migration blocked | Persist safe non-progress. | batch/status/reason | S,K,X | S,X,A | rw | S,X,A | unresolved safe blocker | bounded reason/digests | blocked retained | session CAS | no further batch writes | no state change | before commit prior state; after blocked durable | replay blocked state | batch/status | same state no-op | owner evidence later; T26 rechecks | H unusable | Q unchanged | K-334F | blocked restart |
| T28 | Mark migration failed | Persist failure without repair. | batch/status/reason | S,K,X | S,X,A | rw | S,X,A | verified failure | bounded failure context | failed retained | session CAS | no retry without recovery | no state change | before commit prior state; after failed durable | replay failed state | batch/status | same state no-op | later explicit recovery only | H unchanged/unusable | Q unchanged | K-334F | failure privacy |
| T29 | Mark migration complete | Close only verified batch. | batch/final digests | S,K,G,E,H,X | S,K,A | rw | S,K,A | held lease, all verification passes | counts, lineage, H/set digest | completion marker/session retained | completion once | no effect if partial | no completion | before commit incomplete; after completion durable | recheck completed state | batch+final digest | same complete no-op | T34 validates again | H must verify | Q prevents completion where required | K-334F | completion gate |
| T30 | Build or rebuild one authority-head projection | Recreate derived head. | subject/lineage/rebuild epoch | E,P,U,M,T,R,F,C,Q,H,X | H,X,A | rw | H,X,A | canonical scan available | full graph/set digest | verified H or blocked marker | competing/corrupt candidates | no usable H | old H retained/blocked | marker covers interruption | deterministic rebuild retry | H key+set digest | same projection no-op | T31/T32 | writes only derived H | Q always blocks H | K-334F | rebuild/property |
| T31 | Reconcile projection mismatch | Diagnose H/evidence divergence. | H key/current digests | E,P,U,M,T,R,F,C,Q,H,X | H,C,Q,X,A | rw | H,C,Q,X,A | mismatch observed | re-read canonical graph | repaired derived H or durable block | any ambiguity remains conflict | no authority | no partial reconciliation | before commit old H; after verified H or durable block | replay from marker | H key+set digest | same result no-op | T30/T32 | revalidate or block H | preserve/create as warranted | K-334F | corruption/reconcile |
| T32 | Recover canonical-write/projection-write interruption | Resolve durable boundary interruption. | marker/session/checkpoint | E,H,X,K,S,Q | H,X,K,A | rw | E,H,X,K,A | marker or digest mismatch | re-read canonical commit/set | projection rebuilt or blocked marker | never infer missing evidence | no effect | no partial recovery | crash repeats same marker | idempotent resume | marker ID + set digest | same recovery no-op | T30/T31/T26 | rebuild/block H | Q respected | K-334F | every boundary crash |
| T33 | Handle stale-tab or old-schema writer detection | Fence unsafe writer. | namespace/batch/epoch/schema evidence | S,K,X,H | S,X,A | rw | S,X,A | stale/old writer detected | version, CAS, namespace | writer stopped marker retained | epoch/schema mismatch | no authority writes | no partial fence | durable fence persists | same detection replay | batch+epoch+reason | same marker no-op | T24/T26 | H not advanced | Q unchanged | K-334E | multi-tab, versionchange |
| T34 | Verify post-migration counts and digests | Prove completed batch. | batch/final expected digests | S,G,K,E,P,U,M,F,C,Q,H,X | K,X,A | rw | K,X,A | candidate completion | exact counts, set/lineage/H digest | verified checkpoint or blocker | any mismatch blocks complete | no completion | no partial verification | before commit no verification; after durable checkpoint/blocker | replay verification | batch+verification digest | same verified no-op | T29/T31 | H digest checked | Q checked | K-334F | aggregate/property |
| T35 | Record audit/provenance event | Pair durable bounded audit. | exact referenced record/event | relevant canonical store,A | A | rw | canonical store,A | referenced durable mutation | ID/source digest/bounds | audit retained | event composite collision | mutation aborts if paired audit required | no partial audit | before commit no audit; after paired audit durable | replay audit | audit event ID | same-bytes no-op | T32 only for required pair | none | none | K-334D/E/F | audit, crash |

No row authorizes an implementation. All write groups are future native
IndexedDB `readwrite` transactions across the listed stores. A transaction
abort leaves no partial write in that transaction. Cross-transaction work uses
append-only checkpoints, recovery markers, and exact idempotency keys; it never
uses a full-store clear/rewrite.

## 21. Legacy Source Classification

| Existing source | Current facts | Class | Proposed future action |
|---|---|---|---|
| `writer_coordination_state` in v4 | Dormant K-330 coordination envelope; not append-only K-334 authority. | F — no existing production authority source | Preserve untouched; do not migrate as authority. |
| K-333 protocol codecs | Pure canonical codecs/records, not a durable K-334 store. | F | Use only as future strict decoder/provenance input. |
| Legacy Notes IndexedDB/localStorage (`noteIndexedDb.ts`, `notePersistence.ts`) | Notes payload/fallback persistence, not authority evidence. | C — preserve/quarantine | Do not reinterpret or migrate as authority. |
| K-325 legacy source authority/root bindings | Migration-bound provenance for Notes migration, not issuer/compatibility authority. | B/C | Require explicit mapping/policy/tuple evidence; otherwise preserve quarantine. |
| Cross-context handoff database | Separate handoff evidence topology; no K-334 authority resolver. | C | Preserve as referenced provenance only after explicit mapping/evidence. |
| K-329 reviewed manifest | Reviewed static manifest/digest; no durable selection/history resolver. | B | Reference exact digest only when explicit future policy and tuple evidence exist. |

No discovered source is class A. Therefore the initial future migration may
create metadata/classification records but must create **zero accepted authority
records** unless later explicit evidence satisfies the policy.

## 22. Migration Sequence

1. **Preflight:** open only supported v4, inspect stores, validate namespace,
   acquire future durable migration lease, create an append-only batch/checkpoint
   plan; make no destructive change.
2. **Additive schema:** in one versionchange transaction create only v5 stores
   and indexes; retain every v1–v4 store.
3. **Deterministic classification:** hash and classify each candidate source;
   write class A–F evidence idempotently. Current expected accepted count is
   zero because no class-A authority source is established.
4. **Evidence-dependent handling:** B waits for explicit tuple/mapping/policy;
   C is quarantined; E is preserved unsupported; F is recorded as no source.
5. **Projection:** build heads only from accepted canonical evidence; verify
   counts, lineage, tuple, and canonical-set digest; conflicts fail closed.
6. **Completion:** append a completion marker only after every required
   checkpoint and projection verification succeeds. States remain explicit:
   complete, partial, blocked, failed.
7. **Cleanup:** excluded; any deletion/compaction is later separately
   authorized.

## 23. Crash Consistency

IndexedDB atomically commits or aborts one transaction; it does not make a
multi-transaction migration atomic, resolve blocked upgrades, or guarantee
application-level progress. Thus:

| Interruption | Required outcome |
|---|---|
| Before versionchange / blocked old tab | No v5 mutation; block/retry only after old connection closes. |
| During store/index creation | Versionchange transaction aborts or commits all schema changes; reopen and validate exact version/stores. |
| During a migration batch | No completion marker; retry using source digest/idempotency key and prior checkpoint. |
| Canonical write before projection | Recovery marker blocks effect; rebuild projection from canonical evidence. |
| Projection before checkpoint | Revalidate projection digest; either write idempotent checkpoint or invalidate/rebuild. |
| Checkpoint before completion | Resume verification; checkpoint is not completion. |
| Shutdown/quota/storage failure | Abort or mark bounded failure; preserve prior evidence; fail closed. |
| Multi-tab contention | Lease/CAS and versionchange closure are required; no in-memory-only lock. |

## 24. Rollback and Forward Recovery

- **Schema rollback:** no normal IndexedDB downgrade is proposed. An older
  client seeing unsupported v5 fails closed.
- **Logical rollback:** append a later authorized quarantine/termination or
  ignore a failed migration batch; never delete canonical evidence.
- **Forward recovery:** validate batch/checkpoint digests, replay idempotent
  writes, and continue from the last verified checkpoint.
- **Projection rebuild:** discard only derived heads after marking them stale;
  reconstruct from canonical evidence.
- **Unsupported future version:** close, emit a bounded error, and perform no
  fallback write into authority stores.

## 25. Multi-Tab and Concurrency Requirements

K-334E must implement a durable, namespace-bound migration lease/CAS with a
holder identity, epoch, explicit abandonment/recovery proof, and a bounded
lease policy. It must handle `blocked`/`versionchange`, stale tabs, old-schema
writes, concurrent migration attempts, and holder shutdown. The old tab must
close on versionchange; it may not clear, overwrite, or manufacture v5
authority state. A new writer revalidates lease, namespace, generation,
checkpoint, and exact source digest in its transaction. In-memory locks are
insufficient.

## 26. Fail-Closed Legacy and Unknown Data Handling

Missing schema version, unknown record type, duplicate ID with different bytes,
broken/missing predecessor, cycle, missing issuer, ambiguous mapping,
unsupported tuple, conflicting termination/rollback permission, malformed time,
invalid digest, unknown repository namespace, missing provenance, and impossible
lifecycle transition are all preserved as rejected/unsupported evidence with a
bounded reason. They do not enter an accepted projection and are never silently
dropped or repaired.

## 27. Proof Obligations

| ID | Invariant / threat | Future test type / owner | Severity |
|---|---|---|---|
| P01 | Unclassified legacy data never becomes accepted authority. | migration + property / K-334F | P1 |
| P02 | Unsupported tuple never becomes accepted. | codec/repository / K-334D | P1 |
| P03 | No implicit external mapping. | codec/repository / K-334D | P1 |
| P04 | Competitor never resolves by timestamp/arrival. | transaction/property / K-334E | P1 |
| P05 | Confirmed fork quarantines exactly one subject permanently. | repository + recovery / K-334E/F | P1 |
| P06 | Projection rebuild preserves canonical evidence. | recovery / K-334F | P1 |
| P07 | Termination retains historical evidence. | repository / K-334D | P1 |
| P08 | Rollback needs separate permission. | repository/transaction / K-334D/E | P1 |
| P09 | Interrupted migration is idempotent. | IndexedDB recovery / K-334F | P1 |
| P10 | Stale tab cannot clear/overwrite v5 stores. | browser multi-tab / K-334E | P1 |
| P11 | Partial migration never creates effective authority. | transaction/recovery / K-334E/F | P1 |
| P12 | Unknown schema versions fail closed. | codec/schema / K-334D | P1 |
| P13 | Completion follows durable verification only. | transaction/recovery / K-334F | P1 |
| P14 | Derived-view corruption cannot grant authority. | recovery/property / K-334F | P1 |
| P15 | This design document authorizes no implementation stage. | protocol audit / K-334C3 review | P1 |
| P16 | Canonical candidates at one subject/lineage/sequence coexist; storage uniqueness never drops a competitor. | IndexedDB transaction/property / K-334E | P1 |
| P17 | Accepted-position exclusivity comes only from full-graph validation and the derived head slot, never conditional evidence-index uniqueness. | transaction/concurrency / K-334E | P1 |
| P18 | Every canonical layer binds its fixed Section 7 ASCII domain exactly once through the K-333 outer frame, keeps ID/digest preimages non-circular, permits distinct nested-layer domains only, and rejects self-derived fields, unknown/wrong tags, same-layer double tags, and byte-changing codec/version reuse. | codec/golden fixture / K-334D | P1 |
| P19 | Candidate and quarantine-basis pairs bind exact ID/digest values and exclude payload tag fields; collections use one outer domain, sort full pair bytes unsigned-bytewise, frame each element, deduplicate only byte-identical pairs, reject double-tag encodings, and produce identical bytes across runtimes. | codec/cross-runtime property / K-334D | P1 |
| P20 | Every T01–T35 state-changing operation has complete read/write, precondition, idempotency, crash, and recovery behavior. | transaction/recovery matrix / K-334D/E/F | P1 |

## 28. Future Test Matrix

| Scenario | Required future category |
|---|---|
| v4→v5 upgrade, blocked/retry, old client | IndexedDB integration; browser/multi-tab |
| interrupted/replayed batch and checkpoint corruption | recovery; transaction; property |
| malformed/unknown legacy record and future DB version | codec/schema; repository |
| ambiguous mapping and incompatible tuple | codec/schema; repository; mutation |
| competing successor, fork, exact quarantine | transaction; property; recovery |
| two proposed candidates or accepted-plus-competitor at one logical position | IndexedDB transaction; conflict discovery; fork preservation |
| non-unique evidence index and invalid duplicate head advancement | IndexedDB integration; transaction/CAS |
| projection corruption, stale head, and candidate conflict | recovery; property; quarantine |
| record ID/digest circular fields, field permutations, optional null, Unicode | codec; golden bytes; cross-runtime |
| same ID with different canonical bytes and tuple-ID fixtures | codec; integrity; property |
| every K-334 content-addressed record type has fixed record-id/digest tag fixtures; wrong/unknown/type-mismatched tags fail closed | codec; golden bytes; integrity |
| candidate pair exact field order, pair tag, outer framing, ID/digest mismatch, same-ID/different-digest conflict | codec; golden bytes; property |
| candidate collection unsigned-byte sort, strict-prefix rule, byte-identical dedup, different-ID/same-digest preservation, empty-collection owner rule | codec; property; cross-runtime |
| collection element byte length/hex framing, no parallel-array zip, no locale/timestamp/arrival ordering | codec; integrity; cross-runtime |
| conflict/fork parent identity changes with candidate membership but not valid input permutation | codec; transaction; property |
| quarantine-basis pair/collection binding, membership identity change, and exact-subject slot reconciliation | codec; repository; recovery |
| every T01–T35 idempotent replay and each canonical/head/checkpoint crash boundary | transaction; recovery; browser multi-tab |
| termination and separate rollback permission | repository; transaction |
| projection rebuild/mismatch/staleness | recovery; property |
| quota failure and transaction abort | IndexedDB integration; recovery |
| cross-installation namespace mismatch | codec/schema; protocol audit |

### Required K334C3A1 golden/property coverage

These are future tests only; no test implementation is authorized here.

| # | Required fixture or property | Future owner | Severity |
|---:|---|---|---|
| 1 | fixed external-subject-mapping record-ID tag golden fixture | K-334D | P1 |
| 2 | fixed external-subject-mapping canonical-digest tag golden fixture | K-334D | P1 |
| 3 | fixed external-issuer-mapping record-ID tag golden fixture | K-334D | P1 |
| 4 | fixed external-issuer-mapping canonical-digest tag golden fixture | K-334D | P1 |
| 5 | fixed conflict-observation record-ID and canonical-digest fixtures | K-334D | P1 |
| 6 | fixed fork-observation record-ID and canonical-digest fixtures | K-334D | P1 |
| 7 | unknown or templated domain tag rejects fail closed | K-334D | P1 |
| 8 | wrong type/tag combination is an integrity conflict | K-334D | P1 |
| 9 | candidate-pair field swap changes bytes and rejects | K-334D | P1 |
| 10 | candidate-collection permutation yields identical canonical bytes | K-334D | P1 |
| 11 | byte-identical duplicate pair collapses to one | K-334D | P1 |
| 12 | same record ID with different digest fails closed | K-334D | P1 |
| 13 | different IDs with the same digest remain distinct | K-334D | P1 |
| 14 | prefix ordering makes the shorter sequence first only for strict prefix | K-334D | P1 |
| 15 | unsigned byte comparison is identical across runtimes | K-334D | P1 |
| 16 | prohibited parallel-array reordering cannot break pair binding | K-334D | P1 |
| 17 | quarantine-basis permutation yields identical record ID/digest | K-334D | P1 |
| 18 | quarantine-basis membership change yields different record ID/digest | K-334D | P1 |
| 19 | cross-runtime golden fixture covers pair and collection bytes | K-334D | P1 |
| 20 | Unicode and case differences compare only by canonical bytes | K-334D | P1 |
| 21 | candidate pair exactly-once golden fixture: pair domain appears only in the K-333 outer frame | K-334D | P1 |
| 22 | candidate collection exactly-once golden fixture: collection domain appears only in the K-333 outer frame | K-334D | P1 |
| 23 | outer pair domain plus payload `pairTag` rejects as non-canonical | K-334D | P1 |
| 24 | outer collection domain plus payload `collectionTag` rejects as non-canonical | K-334D | P1 |
| 25 | nested pair, collection, and parent domains each appear once and remain valid | K-334D | P1 |
| 26 | independent runtimes produce equal exactly-once pair and collection bytes | K-334D | P1 |

## 29. Open Questions

None of OQ-01 through OQ-05 defers or weakens the Section 7 identity contract,
Section 10 non-unique evidence lookup, or T01–T35 transaction contracts:
those have the stated fail-closed defaults now. OQ-01 and OQ-02 still block
future repository acceptance writes; OQ-05 still blocks migration execution.
They do not block a future K-334D codec/store proposal from implementing these
contracts after its separate authorization. No open question defers K334C3A-R04,
K334C3A-R05, or K334C3A1-R07: their fixed-tag, pair/collection, and
exactly-once contracts are specified here and await independent review only.
Other separately authorized policy or implementation work remains fail-closed.

| ID | Question / safe default | Blocking / owner | May K-334D proceed? |
|---|---|---|---|
| OQ-01 | Exact `repositoryNamespace` derivation for a future multi-install deployment. Default: reject absent/mismatched namespace. | Blocking for repository writes; Protocol Owner policy input. | Only codec/store scaffolding, not acceptance. |
| OQ-02 | Canonical subject namespace registry. Default: no cross-generation inheritance and reject unknown namespace. | Blocking for acceptance; K-334C4. | Yes for inert schema contract only. |
| OQ-03 | Explicit owner remediation protocol for permanent fork quarantine. Default: no remediation/release. | Non-blocking to quarantine; future owner decision. | Yes. |
| OQ-04 | Retention/export capacity for append-only observations. Default: retain canonical evidence and prohibit compaction. | Non-blocking to additive stores; K-334C4. | Yes, without deletion. |
| OQ-05 | Exact migration lease abandonment proof. Default: block/recover without a new holder. | Blocking for K-334E migration execution. | Yes for K-334D interfaces only. |

## 30. Future Task Slicing

| Task | Entry criteria | Exit criteria |
|---|---|---|
| K-334C4 — Schema Contract Finalization | Resolve blocking OQ-01/OQ-02; retain policy bindings. | Version/store/index/codec contract reviewed; still documentation only. |
| K-334D — Durable Repository Layer | Separate authorization; finalized schema contract. | Additive stores, strict codecs, indexes, repository adapters; no runtime activation. |
| K-334E — Atomic Transactions and Concurrency | K-334D contract implemented and reviewed. | Multi-store transactions, CAS/lease, stale-tab/fork-safe behavior; no runtime activation. |
| K-334F — Migration Recovery and Replay | K-334D/E are reviewed; recovery plan finalized. | Checkpoints, replay, projection rebuild, interruption handling; no runtime admission. |
| Later admission/activation | All prior implementation and production authorizations separately granted. | Explicit runtime gate only after independent safety review. |

## 31. Authorization Counts

| State | Count |
|---|---:|
| K-334C3 documentation-design authorization | 1 |
| K-334C3 design started | 1 |
| K-334C3 design document created | 1 |
| K-334C3 correction started | 1 |
| K-334C3 correction document updated | 1 |
| K-334C3A1 correction started | 1 |
| K-334C3A1 document updated | 1 |
| K-334C3A2 correction started | 1 |
| K-334C3A2 document updated | 1 |
| K-334C3 design independently reviewed | 0 |
| K-334C3 design review findings closed | 0 |
| K-334C3 design approved for implementation | 0 |
| Schema implementation authorization | 0 |
| Migration implementation authorization | 0 |
| Database-version mutation authorization | 0 |
| Store creation authorization | 0 |
| Index creation authorization | 0 |
| Existing-data mutation authorization | 0 |
| Repository implementation authorization | 0 |
| Transaction implementation authorization | 0 |
| Concurrency implementation authorization | 0 |
| Runtime integration authorization | 0 |
| Recovery integration authorization | 0 |
| Admission authorization | 0 |
| Compatibility activation authorization | 0 |
| Eligibility authorization | 0 |
| Source activation authorization | 0 |
| Production rollout authorization | 0 |
| K-334D authorization | 0 |
| K-334E authorization | 0 |
| K-334F authorization | 0 |
| Production sources eligible | 0 |

## 32. Final Design Statement

This document converts the approved durable-authority policy semantics into a
future implementation contract without changing current storage or behavior.
It requires append-only canonical evidence, exact compatibility and mapping,
prospective lifecycle effects, permanent exact-subject fork quarantine,
rebuildable derived views, and fail-closed migration/recovery. Any actual
version upgrade, store/index creation, repository, transaction, migration,
runtime, or eligibility work remains separately unauthorized.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
