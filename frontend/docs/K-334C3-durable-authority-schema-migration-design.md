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
| Successor relationship | Exact predecessor-to-successor link. | Canonical evidence embedded in grant plus unique index; competing link is observed, never replaced. | `authority_evidence` |
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
| Grant / successor / accepted-rejected evidence | Exact issuer and source/provenance required. | Lineage + predecessor; prospective sequence; termination reference; competitor becomes observation. | Reject cycles, missing predecessor, sequence collision, unsupported kind, invalid digest. | Canonical, append-only. |
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
| `recordId` | `dar:v1:<kind>:<sha256(canonical-preimage)>` | Content-addressed, deterministic; duplicate same bytes is idempotent, same ID/different bytes is corruption/conflict. |
| `predecessorRecordId`, `supersedesRecordId` | exact record IDs or `null` | Missing referenced row, cycle, or self-link fails closed. |
| `tupleId` | `dat:v1:<sha256(canonical tuple)>` | Same exact tuple bytes are idempotent; no normalized range expansion. |
| `mappingId`, observation, checkpoint, marker, audit ID | deterministic canonical digest of kind, namespace, subject, source evidence, and logical sequence | Never depend solely on time or array order. |
| `migrationBatchId` | locally generated opaque session ID bound to namespace + source digest | A restart reuses the same validated batch, not a new implicit batch. |

An external identifier is unique only within its exact `(provider,
externalNamespace, externalIdentifier, mappingKind)` key. A subject identity is
not an external identity, and an issuer identity is not a subject identity.

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
| `authority_migration_classifications`, `authority_migration_checkpoints`, `authority_recovery_markers` | bounded by batches and preserved source rows | K-334F / future recovery | migration batch/checkpoint | append-only; resume from last verified checkpoint |
| `authority_heads` | at most one derived head per subject/lineage | K-334E/F / future read gate | evidence/policy + head | may be invalidated and rebuilt, never trusted alone |
| `authority_audit_events` | append-only per write/recovery event | K-334D/E/F / audit only | paired with every canonical mutation | retain; never replace evidence |

## 10. Proposed Indexes

All proposed indexes are `multiEntry: false`. A “canonical” index supports
validation; a “convenience” index is never authority by itself.

| Store / index | Key path | Unique | Use and failure behavior |
|---|---|---:|---|
| `authority_evidence/by_subject_lineage_sequence` | `[namespaceKey, subjectId, lineageId, effectiveSequence]` | true for accepted-position projection write | Detects a second accepted successor; collision preserves observation and fails closed. |
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
| `authority_migration_classifications/by_batch_class` | `[namespaceKey, batchId, classification]` | false | Batch accounting; never accepts source evidence. |
| `authority_migration_checkpoints/by_batch_sequence` | `[namespaceKey, batchId, checkpointSequence]` | true | Resumption ordering; not wall-clock ordering. |
| `authority_heads/by_subject` | `[namespaceKey, subjectId]` | false | Derived lookup only; requires canonical digest revalidation. |

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
| `authority_migration_classifications` | `by_batch_class`; `by_source_digest` → `[namespaceKey, sourceDigest]` | migration metadata |
| `authority_migration_checkpoints` | `by_batch_sequence`; `by_batch_status` → `[namespaceKey, batchId, status]` | recovery metadata |
| `authority_recovery_markers` | `by_batch_status` → `[namespaceKey, batchId, markerStatus]` | recovery metadata |
| `authority_heads` | `by_subject`; `by_projection_digest` → `[namespaceKey, canonicalSetDigest]` | convenience only |
| `authority_audit_events` | `by_subject`; `by_record` → `[namespaceKey, recordId]`; `by_source_digest` | audit lookup |

Every unique index collision is validation evidence of duplicate/corrupt or
competing input and must abort the acceptance path. Convenience indexes remain
non-authoritative.

## 11. Proposed Record Schemas

The following is non-executable design pseudocode. `Required<T>` means a
strictly decoded canonical value; optional fields are explicit `null`, never
inferred. All canonical shapes reject unknown fields in the future codec.

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
  recordId: RecordId; repositoryNamespace: RepositoryNamespace;
  namespaceKey: NamespaceKey; subjectId: SubjectId; issuerId: IssuerId;
  lineageId: LineageId; predecessorRecordId: RecordId | null;
  supersedesRecordId: RecordId | null; action: AuthorityAction;
  lifecycleStatus: 'proposed' | 'recorded' | 'accepted' | 'superseded' |
    'terminated' | 'rollback_applied' | 'unsupported' | 'malformed';
  boundary: AuthorityBoundary; compatibilityTupleId: TupleId;
  provenance: Provenance; canonicalDigest: Sha256; recordedAt: IsoTime;
};

type CompatibilityTupleV1 = {
  recordType: 'authority_compatibility_tuple_v1'; recordSchemaVersion: 1;
  tupleId: TupleId; repositoryNamespace: RepositoryNamespace;
  authorityProtocolVersion: 1; authorityRecordSchemaVersion: 1;
  manifestEvidenceVersion: 1; subjectNamespace: string; issuerNamespace: string;
  compatibilityPolicyVersion: 1; installationNamespace: string;
  action: AuthorityAction; sourceClass: SourceClass; migrationEpoch: string;
  boundary: AuthorityBoundary; provenance: Provenance; canonicalDigest: Sha256;
};

type ExternalMappingV1 = {
  recordType: 'external_subject_mapping_v1' | 'external_issuer_mapping_v1';
  recordSchemaVersion: 1; mappingId: RecordId; repositoryNamespace: RepositoryNamespace;
  mappingKind: 'subject' | 'issuer'; provider: string; externalNamespace: string;
  externalIdentifier: string; internalId: SubjectId | IssuerId;
  predecessorRecordId: RecordId | null; supersedesRecordId: RecordId | null;
  boundary: AuthorityBoundary; provenance: Provenance; canonicalDigest: Sha256;
};

type SubjectQuarantineV1 = {
  recordType: 'subject_quarantine_v1'; recordSchemaVersion: 1;
  namespaceKey: NamespaceKey; subjectId: SubjectId; quarantineState: 'forked';
  basisObservationIds: readonly RecordId[]; basisDigest: Sha256;
  permanent: true; recordedAt: IsoTime; canonicalDigest: Sha256;
};
```

`AuthorityHeadV1` is derived, stores the selected canonical evidence digest and
projection epoch, and is never evidence of acceptance by itself. No shape may
infer issuer authority, mapping, compatibility, expiry, predecessor, or
acceptance from a timestamp, name, account, or row order.

### Canonical record-kind field matrix

| Record kind | Additional required canonical fields | Optional fields | Derived-only fields |
|---|---|---|---|
| subject / issuer | exact opaque ID, namespace, provenance digest | external mapping reference | none |
| issuer policy | issuer, subject/action scope, tuple ID, lifecycle status | predecessor, supersedes, termination | applicability cache |
| authority grant / acceptance / rejection | issuer, subject, lineage, predecessor, sequence, action, tuple, evidence digest | supersedes, termination | accepted-head pointer |
| rollback permission | issuer, subject, exact rollback target, tuple, boundary | termination/supersedes | current rollback applicability |
| termination | target kind/ID, issuer authority reference, subject, boundary | predecessor/supersedes | current terminated state |
| compatibility tuple | all ten tuple dimensions, boundary, provenance | predecessor/supersedes/termination | tuple lookup cache |
| external mapping | kind, provider, external/internal IDs, boundary, provenance | predecessor/supersedes/termination | reverse lookup cache |
| fork/conflict observation | subject, conflicting evidence IDs/digests, bounded reason | predecessor where relevant | none |
| quarantine | exact subject, basis IDs/digest, permanent flag | none for v1 confirmed fork | head invalidation flag |
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

## 20. Transaction and Atomicity Matrix

| Future operation | Read / write stores | Atomic requirement and owner |
|---|---|---|
| Record authority evidence | policies, tuples, mappings, quarantine, evidence / evidence, audit | Validate exact graph; canonical evidence + audit in one readwrite transaction. K-334D/E. |
| Accept successor | evidence, policies, tuples, terminations, quarantine, heads / evidence, observations, quarantine, heads, audit | Position uniqueness; competitor creates observation/quarantine, never overwrite. K-334E. |
| Record issuer policy, rollback, termination, tuple, mapping | relevant canonical store plus evidence / record, audit, recovery marker | Idempotency by canonical digest; prospective boundary only. K-334D/E. |
| Observe conflict/fork | evidence, observations, quarantine / observations, quarantine, heads, audit | Preserve all candidates and invalidate head atomically. K-334E. |
| Migrate one legacy record | classifications, checkpoints, canonical stores / classification, evidence or rejected evidence, audit, checkpoint | Source digest idempotency; never accept a B/C/E source. K-334F. |
| Checkpoint/recover migration | checkpoints, markers, canonical stores, heads / checkpoint or marker | Completion after durable verification only. K-334F. |
| Rebuild projection | canonical stores, heads, markers / heads, marker, audit | Rebuild from canonical evidence; mismatch cannot grant effect. K-334F. |

All write groups are native IndexedDB `readwrite` transactions across the listed
stores. A transaction abort leaves no partial write in that transaction. Cross-
transaction work uses append-only checkpoints and idempotency keys; it never
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

## 28. Future Test Matrix

| Scenario | Required future category |
|---|---|
| v4→v5 upgrade, blocked/retry, old client | IndexedDB integration; browser/multi-tab |
| interrupted/replayed batch and checkpoint corruption | recovery; transaction; property |
| malformed/unknown legacy record and future DB version | codec/schema; repository |
| ambiguous mapping and incompatible tuple | codec/schema; repository; mutation |
| competing successor, fork, exact quarantine | transaction; property; recovery |
| termination and separate rollback permission | repository; transaction |
| projection rebuild/mismatch/staleness | recovery; property |
| quota failure and transaction abort | IndexedDB integration; recovery |
| cross-installation namespace mismatch | codec/schema; protocol audit |

## 29. Open Questions

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
| K-334C3 design independently reviewed | 0 |
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
