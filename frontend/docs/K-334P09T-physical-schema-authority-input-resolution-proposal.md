# K-334P09T Physical Schema Authority Input Resolution Proposal

## 1. Proposal identity

| Field | Value |
| --- | --- |
| Record type | `K334PhysicalSchemaAuthorityInputResolutionProposal` |
| Record ID | `K-334P09T-AUTHORITY-INPUT-RESOLUTION-001` |
| Status | `AUTHORITY_INPUT_RESOLUTION_PROPOSED` |
| Bound production main | `83bb5d2b7d61a8d1f4b5bb231bee550b12ed5d91` |
| Bound working head | `16b52312454693d65989c41864a34442e2d3f004` |
| Bound prerequisite | `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001` / `DESCRIPTOR_AUTHORITY_PREREQUISITE_PROPOSED` |
| Bound prerequisite file SHA-256 | `9dc01a05765cfcd9b0cf1f17b98977ae6654adb82de734ba46a43b2f7d325276` |
| Bound concrete-registry review | `K-334P09S` / `PASS` |
| Accepted review meaning | `CONCRETE_REGISTRY_AND_BLOCKER_INVENTORY_ACCEPTED_FOR_NEXT_AUTHORITY_RESOLUTION` |
| Bound blocked authorization | `K-334-D0-P09-EXECUTION-AUTH-001` |
| Bound blocked-authorization file SHA-256 | `534826572479e88254c9666971026eb9c1de6b846ebd00eb4218c8828741e625` |
| Effective authority | `PROPOSAL_ONLY_NO_EXECUTION_AUTHORITY` |

This record proposes values for separate review. It does not accept its own
resolutions, amend or accept K-334P09P, authorize a descriptor implementation,
create descriptor authority, rebind D0-P09, or authorize proof execution.

## 2. Governing authority and source order

The following source order applies only when interpreting a resolution in this
proposal:

1. the approved K-334C2 decisions D01-A, D02-B, and D03-A;
2. the approved K-334C3 durable-authority schema and migration design;
3. the merged K-334D3 canonical protocol implementation for record families
   that it actually encodes and validates;
4. the reviewed K-334P09P concrete registry for store, key-path, index, and
   structural-constraint identities;
5. this proposal, but only after a separate review and explicit acceptance.

K-334D3 is semantic authority only for its eleven implemented canonical record
kinds. It is not authority for IndexedDB rows. K-334C3 design pseudocode is
authority input for this proposal, not executable code. Tests and fixtures are
supporting evidence and do not create missing physical authority.

## 3. Dispositions and named blockers

Every resolution record uses exactly one disposition:

- `RESOLUTION_PROPOSED`: this document supplies the complete normative value;
- `DEFERRED_PENDING_NAMED_AUTHORITY`: no value may be implemented until the
  named authority record is separately proposed, reviewed, and accepted;
- `EXCLUDED_FROM_INITIAL_DESCRIPTOR`: the input would be removed from the
  initial scope, with that scope change stated explicitly;
- `UNRESOLVED_FAIL_CLOSED`: the input has neither a value nor a bounded named
  authority path.

This proposal uses only the first two dispositions. It excludes no accepted
store scope and leaves no anonymous implementer choice.

| Blocker ID | Required named authority | Exact unresolved subject |
| --- | --- | --- |
| `B01` | `K334SubjectDurableRowAuthorityV1` | Complete standalone subject row/envelope, identity/digest, provenance, timestamp, and external-reference representation |
| `B02` | `K334IssuerDurableRowAuthorityV1` | Complete standalone issuer row/envelope, identity/digest, provenance, timestamp, and external-reference representation |
| `B03` | `K334CompatibilityTupleLifecyclePhysicalAuthorityV1` | Complete ROW-07 durable row/envelope and MAP-07 mapping, including tuple aliases, null/omission rules, `lifecycleStatus`, predecessor, supersession, and termination representations; the exact relationship between tuple identity and separate lifecycle records; C05 conditional indexability; and SC-06, SC-08, and SC-11 dependencies |
| `B04` | `K334MigrationSessionPhysicalAuthorityV1` | Exact batch-ID scalar grammar, complete physical envelope, canonical-preimage representation, and storage-metadata boundary |
| `B05` | `K334MigrationCheckpointPhysicalAuthorityV1` | Exact checkpoint fields, phase/status registry, verified-digest field names, canonical bytes, and composite-ID grammar |
| `B06` | `K334RecoveryMarkerPhysicalAuthorityV1` | Exact marker kind/status registries, verified-digest fields, resolution references, canonical bytes, and composite-ID grammar |
| `B07` | `K334AuditEventPhysicalAuthorityV1` | Complete audit row/envelope plus an explicit subject source or explicit removal/versioning of `by_subject` |
| `B08` | `K334AuthorityEvidenceRolePhysicalAuthorityV1` | Exact physical discrimination for C3 accepted/rejected/unsupported evidence roles without inventing a K-334D3 field or lifecycle literal |

Acceptance of one blocker authority does not accept another.

### 3.1 External-mapping termination disposition

The proposed disposition is
`SEPARATE_TERMINATION_RECORD_AUTHORITY`.

K-334D3 defines `external_subject_mapping` and `external_issuer_mapping`
canonical records without an embedded termination field. It separately defines
the canonical `termination` record, whose exact `targetKind` registry includes
both external-mapping kinds and whose `targetRecordId` must match the
corresponding mapping-record identity. C3 lifecycle wording is therefore
reconciled as a cross-record relationship from `authority_terminations` to the
immutable external-mapping record, not as an embedded ROW-08 field.

ROW-08 stores only the exact mapping canonical record and its verified physical
projections. It contains no termination timestamp, status, reason, record ID,
lifecycle winner, or independently authoritative active/terminated state.
Missing embedded termination data proves nothing and cannot be defaulted or
inferred. Any relationship from a termination record to a mapping must use the
separately approved termination target kind and exact target record identity.
An unexpected termination-related ROW-08 field fails descriptor validation.

This absence is intentional and lossless relative to the approved K-334D3
mapping records. It defines no termination lookup, traversal, applicability,
winner selection, transition, transaction, or runtime behavior. C15 remains
only the canonical external-mapping digest index and never indexes termination
state.

### 3.2 B03 atomic lifecycle ownership

B03 owns the complete compatibility-tuple lifecycle representation as one
authority decision: ROW-07, MAP-07, tuple identity/digest aliases,
`lifecycleStatus`, predecessor, supersession, termination, all corresponding
null/omission rules, C05, and the applicable SC-06, SC-08, and SC-11
dependencies. No tuple lifecycle field may be inferred from a name, fixture,
codec omission, store presence, timestamp, arrival order, or runtime behavior.
C05 is only a conditional proposed index until B03 is accepted, and SC-11
cannot be globally resolved while either B03 or B08 remains open.

Every resolution record below also carries this exact common disposition
metadata:

| Required attribute | `RESOLUTION_PROPOSED` | `DEFERRED_PENDING_NAMED_AUTHORITY` |
| --- | --- | --- |
| Input identity | The exact `ROW`, `IDX`, `MAP`, or `SC` ID in its table | The exact table ID plus its `B01`-`B08` dependency |
| Governing source | K-334D3 for implemented canonical fields; K-334C3 for physical inventory, non-codec metadata, and derived heads; K-334P09P for registry identity | The same sources establish the gap but do not supply its value |
| Design rationale | Preserve canonical bytes and make only strict, equality-checked physical projections | Prevent a future implementer from creating a missing semantic or scalar value |
| Compatibility impact | No current database change; acceptance would constrain a future descriptor version exactly as stated | No representation may be installed, read as authoritative, or migrated |
| Lifecycle impact | Structural representation only; no lifecycle decision or transition | None; the input remains unusable |
| Accepted store scope | No change to the 17-store included scope | No change; the included store remains blocked rather than excluded |
| Later migration/runtime authority | Always required separately if a later implementation would touch data or runtime | Required only after the named authority is accepted and descriptor lifecycle separately advances |
| Reviewer acceptance requirement | Independent architecture/data-model/authority review, correction of any finding, then explicit acceptance before incorporation | Separate proposal/review/acceptance of the named authority, followed by re-review of the dependent resolution |

The per-record tables supply the exact value or exact question, physical owner,
field source, conflict rule, and any family-specific compatibility consequence.
No common metadata in this table weakens a narrower per-record boundary.

## 4. Resolution strategy

### 4.1 Primary strategy: canonical bytes plus verified projections

For a K-334D3-backed family, the proposed durable row uses
`CANONICAL_BYTES_WITH_VERIFIED_FLAT_INDEX_FIELDS_V1`.

The exact common fields are:

```ts
type K334CanonicalPhysicalRowV1 = {
  rowType: string;                  // exact family literal from Section 5
  rowVersion: 1;
  repositoryNamespace: string;     // exact canonical payload value
  namespaceKey: string;            // exact canonical payload value
  recordId: string;                // exact K-334D3 envelope value
  canonicalKind: string;           // exact K-334D3 envelope kind
  canonicalVersion: 1;             // exact K-334D3 envelope version
  canonicalDigest: string;         // exact K-334D3 envelope value
  canonicalBytes: Uint8Array;       // exact encodeK334CanonicalRecord bytes
  recordedAt: string;              // storage-only audit metadata
  // one required family-specific primary-key alias
  // zero or more required verified projections listed in Section 5
};
```

`recordedAt` is proposed as exactly 24 ASCII bytes in
`YYYY-MM-DDTHH:mm:ss.sssZ` UTC form. Month/day/time must be calendar-valid,
seconds are `00` through `59`, offsets and leap seconds are rejected, and the
value is never an identity, digest, ordering, lifecycle, or acceptance input.

All common fields, aliases, and listed projections are required. A field whose
source value is nullable is present with explicit `null`; it is never omitted.
A semantic field not listed in the exact physical inventory remains only in
`canonicalBytes` and must not be added as an undeclared projection. Unknown row
fields fail descriptor validation.

The immutable record identity and digest authority are, respectively,
`recordId` and `canonicalDigest` from the strictly decoded canonical envelope.
The primary-key alias equals `recordId` byte-for-byte. `canonicalBytes` is the
only durable payload representation; a second decoded payload object is
forbidden. Binary bytes are stored as structured-clone `Uint8Array` data, not
base64, hex, JSON text, or a platform string.

Validation must:

1. decode `canonicalBytes` with `decodeK334CanonicalRecordBytes`;
2. require byte-identical re-encoding through `encodeK334CanonicalRecord`;
3. require the decoded `kind`, `version`, `recordId`, `canonicalDigest`,
   `repositoryNamespace`, and `namespaceKey` to equal the duplicated fields;
4. require every alias and projection to equal its exact decoded payload source
   without case folding, coercion, trimming, normalization, or defaulting;
5. require every embedded candidate or quarantine-basis collection to remain
   inside `canonicalBytes` in its canonical order;
6. fail closed on any mismatch, unknown field, missing field, duplicate
   identity with different bytes, or same physical key with different bytes.

Explicit `null` projections produce no IndexedDB entry when a key component is
not a valid key. That mechanical absence is non-authoritative and does not
change the stored `null`.

The physical `rowType`, `rowVersion`, primary alias, `recordedAt`, and flat
projections are storage representation only. They cannot establish authority,
identity, lifecycle, compatibility, acceptance, or ordering.

### 4.2 Deferred physical-metadata exception: migration session

`authority_migration_sessions` is not a K-334D3 canonical record and must never
be wrapped in a fabricated K-334D3 kind. C3 fixes candidate semantic fields and
a digest domain but does not fix a complete physical envelope or the exact
`batchId` scalar grammar. `NORMALIZED_PROCESS_METADATA_WITH_CANONICAL_PREIMAGE_V1`
is therefore only the named design question for B04, not a proposed row.
This proposal defines no writer, lease, CAS, transition, resume, retry, or
migration behavior.

### 4.3 Derived exception: authority head

`authority_heads` uses
`NORMALIZED_DERIVED_PROJECTION_WITH_PREIMAGE_V1`. It has no canonical evidence
envelope. Its row contains the exact projection preimage and explicit
`DERIVED_REBUILDABLE_NON_AUTHORITY` classification. This proposal defines no
projection algorithm, freshness rule, replacement rule, or transaction.

### 4.4 Deferred families

Subject, issuer, authority-evidence role, compatibility-tuple lifecycle,
migration-session, checkpoint, recovery-marker, and audit-event rows remain
fail closed behind `B01` through `B08`. No partial row shape in this document
is authority for those families.

## 5. Row authority resolution matrix

The `Immutable` column describes internal row-integrity validation only; it does
not authorize a write or transition. `None` means the category is intentionally
absent, not optional.

| Row resolution / store | Disposition | Exact physical model and field inventory | Key, identity, nullability, indexes, and ownership | Compatibility, lifecycle, scope, and remaining blocker |
| --- | --- | --- | --- | --- |
| `ROW-01` / `authority_subjects` | `DEFERRED_PENDING_NAMED_AUTHORITY` | No row is proposed. Primary requirements are `namespaceKey`, `subjectId`; every envelope, record identity, digest, provenance, `recordedAt`, discriminator, storage/derived field, null rule, and immutability rule remains forbidden until specified. | Key remains `[namespaceKey,subjectId]`; validation/provenance owner unresolved. | No scope change; no migration/runtime authority. `B01` is the exact blocker. |
| `ROW-02` / `authority_issuers` | `DEFERRED_PENDING_NAMED_AUTHORITY` | No row is proposed. Primary requirements are `namespaceKey`, `issuerId`; every envelope, record identity, digest, provenance, `recordedAt`, discriminator, storage/derived field, null rule, and immutability rule remains forbidden until specified. | Key remains `[namespaceKey,issuerId]`; validation/provenance owner unresolved. | No scope change; no migration/runtime authority. `B02` is the exact blocker. |
| `ROW-03` / `authority_issuer_policies` | `RESOLUTION_PROPOSED` | Common canonical row; `rowType="k334_physical_issuer_policy_row_v1"`; `policyId`, `issuerId`, `subjectId`, `action`, `lifecycleStatus`, `effectiveSequence`, `predecessorRecordId`, `supersedesRecordId`, `terminationRecordId`. Sequence is a positive safe integer. The three relationship fields are required and nullable exactly as K-334D3 permits. | Key `[namespaceKey,policyId]`; `policyId===recordId`; kind `issuer_policy`. Index-visible: namespace, canonical digest, issuer, subject, action, sequence. Validation: K-334D3 plus physical validator; provenance remains inside canonical bytes. All fields immutable as a row snapshot. | Lossless canonical reconstruction; history remains append-only in semantics, but no writer is authorized. No scope change. No blocker. |
| `ROW-04` / `authority_evidence` | `DEFERRED_PENDING_NAMED_AUTHORITY` | No complete row is proposed. K-334D3 supplies canonical `authority_evidence` bytes, identity, digest, subject/issuer/lineage, relationships, `action="grant"`, lifecycle status, and boundary. C3 additionally requires physical discrimination among accepted, rejected, unsupported, grant, and successor evidence roles. K-334D3 has no `evidenceRole` and its lifecycle registry has no `rejected` literal. | Key remains `[namespaceKey,evidenceId]`; known index requirements remain namespace, digest, subject, issuer, lineage, predecessor, lifecycle status, and sequence. `evidenceId=recordId` cannot authorize a partial row. No role may be inferred from action, status, arrival, or store presence. | No scope change and no acceptance/rejection behavior. `B08` must select an exact source-grounded role representation or explicitly revise the aggregate contract. |
| `ROW-05` / `authority_rollback_permissions` | `RESOLUTION_PROPOSED` | Common canonical row; `rowType="k334_physical_rollback_permission_row_v1"`; `permissionId`, `issuerId`, `subjectId`, `rollbackTargetRecordId`, `effectiveSequence`, `predecessorRecordId`, `supersedesRecordId`, `terminationRecordId`. Relationship fields are required nullable values; lifecycle/status field is intentionally absent because K-334D3 defines none. | Key `[namespaceKey,permissionId]`; `permissionId===recordId`; kind `rollback_permission`. Index-visible: namespace, digest, issuer, subject, rollback target. | No applicability or rollback behavior. Lossless, no scope change, no blocker. |
| `ROW-06` / `authority_terminations` | `RESOLUTION_PROPOSED` | Common canonical row; `rowType="k334_physical_termination_row_v1"`; `terminationId`, `subjectId`, `issuerId`, `targetKind`, `targetRecordId`, `issuerAuthorityRecordId`, `effectiveSequence`, `predecessorRecordId`, `supersedesRecordId`. Relationship fields are required nullable values; lifecycle/status field is intentionally absent. | Key `[namespaceKey,terminationId]`; `terminationId===recordId`; kind `termination`. Index-visible: namespace, digest, subject, target record, sequence. | No termination evaluation or transition. Lossless, no scope change, no blocker. |
| `ROW-07` / `authority_compatibility_tuples` | `DEFERRED_PENDING_NAMED_AUTHORITY` | No complete row is proposed. K-334D3 supplies tuple canonical bytes, `recordId`, and `canonicalDigest`, but does not supply the C3-required complete physical lifecycle representation. B03 must define the exact durable envelope, aliases, `lifecycleStatus`, predecessor, supersession, termination, and every null/omission rule. None may be invented, defaulted, or inferred from presence. | Key remains `[namespaceKey,tupleId]`; C04's `tupleDigest` alias and C05's status projection can become physical only with the complete row. Validation ownership and the exact relationship between tuple identity and separate lifecycle records remain unresolved. | No scope change and no compatibility activation. B03 owns ROW-07, MAP-07, C05, and its SC-06, SC-08, and SC-11 dependencies as one lifecycle-authority decision. |
| `ROW-08` / `authority_external_mappings` | `RESOLUTION_PROPOSED` | Common canonical row; `rowType="k334_physical_external_mapping_row_v1"`; `mappingId`, `mappingKind`, `provider`, `externalNamespace`, `externalIdentifier`, `internalId`, `effectiveSequence`, `predecessorRecordId`, `supersedesRecordId`. Relationship fields are required nullable values. `canonicalKind` is exactly `external_subject_mapping` or `external_issuer_mapping`; `mappingKind` is exactly `subject` or `issuer` and must match that kind. Under `SEPARATE_TERMINATION_RECORD_AUTHORITY`, termination timestamp/status/reason/record ID and lifecycle-winner fields are prohibited. | Key `[namespaceKey,mappingId]`; `mappingId===recordId`. Index-visible: namespace, digest, mapping kind, provider, external namespace/identifier, internal ID. Termination is represented only by a separate canonical termination record whose approved target kind and exact target identity reference this mapping; absence of an embedded field proves no lifecycle state. | C3 lifecycle wording is a cross-record relationship, not a ROW-08 field. The omission is intentional and lossless relative to K-334D3. Unexpected termination-related fields fail closed. No termination lookup, applicability, inference, transition, or ambiguity resolution is authorized. No scope change or blocker. |
| `ROW-09` / `authority_fork_observations` | `RESOLUTION_PROPOSED` | Common canonical row; `rowType="k334_physical_fork_observation_row_v1"`; `observationId`, `subjectId`, `lineageId`, `effectiveSequence`, `predecessorRecordId`, `reasonCode`. `lineageId` and predecessor are required nullable values. `candidateCollectionBytes` remains only inside canonical bytes and is never flattened or reordered. Lifecycle/status and issuer are intentionally absent. | Key `[namespaceKey,observationId]`; `observationId===recordId`; kind `fork_observation`. Index-visible: namespace, digest, subject, predecessor. | No fork confirmation or quarantine behavior. Lossless, no scope change, no blocker. |
| `ROW-10` / `authority_conflict_observations` | `RESOLUTION_PROPOSED` | Common canonical row; `rowType="k334_physical_conflict_observation_row_v1"`; `observationId`, `subjectId`, `lineageId`, `effectiveSequence`, `predecessorRecordId`, `reasonCode`, `conflictCode`. `conflictCode` is a required exact alias of `reasonCode`, not a second semantic value. Nullable and embedded-byte rules equal ROW-09. | Key `[namespaceKey,observationId]`; `observationId===recordId`; kind `conflict_observation`. Index-visible: namespace, digest, subject, conflict code. | No conflict resolution behavior. Lossless, no scope change, no blocker. |
| `ROW-11` / `authority_quarantines` | `RESOLUTION_PROPOSED` | Common canonical row; `rowType="k334_physical_subject_quarantine_row_v1"`; `quarantineRecordId`, `subjectId`, `quarantineState`, `reasonCode`, `permanent`, `effectiveSequence`, `basisDigest`. `quarantineRecordId===recordId`. `basisDigest` is lowercase SHA-256 of the exact bytes obtained by strict lowercase-hex decoding of canonical `quarantineBasisCollectionBytes`; the collection itself remains only inside canonical bytes. No predecessor/supersession/status field exists. | Physical slot `[namespaceKey,subjectId]`; immutable record identity remains `quarantineRecordId`, not the slot. Index-visible: namespace, subject, quarantine state. | The row's presence or slot does not prove authority, confirmation, or activation. No replacement behavior. Lossless canonical bytes, no scope change, no blocker. |
| `ROW-12` / `authority_migration_sessions` | `DEFERRED_PENDING_NAMED_AUTHORITY` | No row is proposed. C3 identifies candidate fields (`recordType`, version, repository/namespace, batch, source digest, status, lease epoch/holder/boundary, provenance, digest, and timestamp), but its pseudocode omits `repositoryNamespace` from the Section 7 preimage and it does not fix an exact `batchId` scalar grammar or durable envelope. | Key remains `[namespaceKey,batchId]`; known index requirements are namespace, batch, source digest, session status, and lease epoch. No canonical identity field, canonical bytes, storage-only fields, or null rules beyond the candidate C3 semantics may be implemented. | No CAS, lease, transition, migration, resume, or writer behavior. No scope change. `B04` is required. |
| `ROW-13` / `authority_migration_classifications` | `RESOLUTION_PROPOSED` | Common canonical row; `rowType="k334_physical_migration_classification_row_v1"`; `classificationId`, `batchId`, `sourceKind`, `sourceDigest`, `classification`, `supersedesClassificationId`. Supersession is required nullable; no sequence/status/subject/issuer field exists. | Key `[namespaceKey,classificationId]`; `classificationId===recordId`; kind `migration_classification`. Index-visible: namespace, batch, classification, source digest. | No classification execution or supersession behavior. Lossless, no scope change, no blocker. |
| `ROW-14` / `authority_migration_checkpoints` | `DEFERRED_PENDING_NAMED_AUTHORITY` | No row is proposed. The exact record type, phase/status registry, verified source/count/set digest field names, composite-ID byte grammar, canonical preimage bytes, metadata, and nullability are unresolved. | Key remains `[namespaceKey,checkpointId]`; known physical requirements are batch, sequence, and status only. | No resume/retry/recovery behavior and no scope change. `B05` is required. |
| `ROW-15` / `authority_recovery_markers` | `DEFERRED_PENDING_NAMED_AUTHORITY` | No row is proposed. The exact record type, marker kind/status registries, verified digest fields, resolution reference, composite-ID byte grammar, canonical preimage bytes, metadata, and nullability are unresolved. | Key remains `[namespaceKey,markerId]`; known physical requirements are batch and marker status only. | No repair/replay/recovery behavior and no scope change. `B06` is required. |
| `ROW-16` / `authority_heads` | `RESOLUTION_PROPOSED` | Exact normalized row: `recordType="authority_head_v1"`, `recordSchemaVersion=1`, `repositoryNamespace`, `namespaceKey`, `subjectId`, `lineageId`, required nullable `acceptedEvidenceId`, required nullable `acceptedEvidenceDigest`, required nullable positive-safe-integer `effectiveSequence`, `canonicalSetDigest`, positive-safe-integer `projectionEpoch`, `projectionState` in `verified|blocked`, `projectionDigest`, `projectionBytes:Uint8Array`, and `rowClass="DERIVED_REBUILDABLE_NON_AUTHORITY"`. `recordedAt`, canonical record ID, canonical envelope, provenance, issuer, predecessor, and supersession are absent. | Key `[namespaceKey,subjectId,lineageId]`; this slot is the physical identity. Projection bytes use Section 7's exact projection preimage and digest domain. Index-visible: namespace, subject, canonical set digest. Validation owner is the physical descriptor validator; source references are the accepted evidence ID/digest pair. | Derived, non-authoritative, rebuildable. D0-P09 can prove shape only, not correctness, freshness, or update behavior. No scope change, no blocker. |
| `ROW-17` / `authority_audit_events` | `DEFERRED_PENDING_NAMED_AUTHORITY` | No complete row is proposed. C3 supplies a composite identity and preimage candidates (`recordId`, event kind/sequence, source digest, recorder, bounded context), but no K-334D3 envelope and no subject source. No subject may be inferred through `recordId` or referenced evidence. | Key remains `[namespaceKey,auditEventId]`; C01/C02 can be specified structurally, but C03 and the complete row cannot. | No scope change. `B07` must define event/actor/timestamp/payload fields and subject policy or versioned index removal. |

## 6. Index authority resolution matrix

Every proposed key path is an ordered compound string array and every
`multiEntry` value is exactly `false`. Every index is non-authoritative.
`unique=true` on a canonical digest is an integrity constraint: an otherwise
distinct row with the same family/store digest is a collision or corrupt
duplicate, not valid history. History/query indexes are non-unique so that
competing or superseding records remain preservable.

| Resolution / canonical index | Owner / exact name | Exact key path; `unique`; `multiEntry` | Purpose, field source, compatibility analysis | Disposition / blocker |
| --- | --- | --- | --- | --- |
| `IDX-C01` / `k334.index.authority_audit_events.by_record.v1` | `authority_audit_events` / `by_record` | `["namespaceKey","recordId"]`; `false`; `false` | C3 audit preimage; multiple events per record are legal, so uniqueness would reject history. | `RESOLUTION_PROPOSED`; row still blocked by `B07`. |
| `IDX-C02` / `k334.index.authority_audit_events.by_source_digest.v1` | `authority_audit_events` / `by_source_digest` | `["namespaceKey","sourceDigest"]`; `false`; `false` | C3 audit preimage; multiple events may share source evidence. | `RESOLUTION_PROPOSED`; row still blocked by `B07`. |
| `IDX-C03` / `k334.index.authority_audit_events.by_subject.v1` | `authority_audit_events` / `by_subject` | Key path, component order, and `unique` remain unset; `multiEntry=false` | Audit preimage has no subject. Neither `["namespaceKey","subjectId"]` nor uniqueness may be inferred. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B07`. |
| `IDX-C05` / `k334.index.authority_compatibility_tuples.by_tuple_status.v1` | `authority_compatibility_tuples` / `by_tuple_status` | `["namespaceKey","lifecycleStatus"]`; `false`; `false` | Multiple historical tuples may share a status; uniqueness would collapse valid entries. | `RESOLUTION_PROPOSED`; physical status source remains `B03`. |
| `IDX-C06` / `k334.index.authority_conflict_observations.by_observation_digest.v1` | `authority_conflict_observations` / `by_observation_digest` | `["namespaceKey","canonicalDigest"]`; `true`; `false` | ROW-10 envelope digest; duplicate digest in this family is idempotent/corrupt, not separate history. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C15` / `k334.index.authority_external_mappings.by_mapping_digest.v1` | `authority_external_mappings` / `by_mapping_digest` | `["namespaceKey","canonicalDigest"]`; `true`; `false` | ROW-08 envelope digest only; subject and issuer domains remain distinct, and a digest collision fails closed. It contains and indexes no termination state. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C16` / `k334.index.authority_fork_observations.by_observation_digest.v1` | `authority_fork_observations` / `by_observation_digest` | `["namespaceKey","canonicalDigest"]`; `true`; `false` | ROW-09 envelope digest; exact duplicates are not independent observations. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C18` / `k334.index.authority_heads.by_projection_digest.v1` | `authority_heads` / `by_projection_digest` | `["namespaceKey","canonicalSetDigest"]`; `false`; `false` | ROW-16 derived set digest. Different subject/lineage slots may legitimately have the same set digest, including an empty set. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C20` / `k334.index.authority_issuer_policies.by_issuer_subject_action.v1` | `authority_issuer_policies` / `by_issuer_subject_action` | `["namespaceKey","issuerId","subjectId","action"]`; `false`; `false` | ROW-03 projections; policy history and competitors are legal, so this lookup cannot enforce identity. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C25` / `k334.index.authority_migration_checkpoints.by_batch_status.v1` | `authority_migration_checkpoints` / `by_batch_status` | `["namespaceKey","batchId","status"]`; `false`; `false` | Multiple checkpoint sequences may share a status. | `RESOLUTION_PROPOSED`; row/field registry remains `B05`. |
| `IDX-C27` / `k334.index.authority_migration_classifications.by_source_digest.v1` | `authority_migration_classifications` / `by_source_digest` | `["namespaceKey","sourceDigest"]`; `false`; `false` | ROW-13 projection; superseding classifications for one source must coexist. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C31` / `k334.index.authority_recovery_markers.by_batch_status.v1` | `authority_recovery_markers` / `by_batch_status` | `["namespaceKey","batchId","markerStatus"]`; `false`; `false` | Multiple marker kinds/sequences may share a batch/status. | `RESOLUTION_PROPOSED`; row/field registry remains `B06`. |
| `IDX-C32` / `k334.index.authority_rollback_permissions.by_issuer_subject.v1` | `authority_rollback_permissions` / `by_issuer_subject` | `["namespaceKey","issuerId","subjectId"]`; `false`; `false` | ROW-05 projections; multiple exact-target permissions and history are legal. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C33` / `k334.index.authority_rollback_permissions.by_permission_digest.v1` | `authority_rollback_permissions` / `by_permission_digest` | `["namespaceKey","canonicalDigest"]`; `true`; `false` | ROW-05 envelope digest; integrity, not query identity. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C36` / `k334.index.authority_terminations.by_subject_sequence.v1` | `authority_terminations` / `by_subject_sequence` | `["namespaceKey","subjectId","effectiveSequence"]`; `false`; `false` | ROW-06 projections; competing targets at a position must remain observable. | `RESOLUTION_PROPOSED`; none. |
| `IDX-C38` / `k334.index.authority_terminations.by_termination_digest.v1` | `authority_terminations` / `by_termination_digest` | `["namespaceKey","canonicalDigest"]`; `true`; `false` | ROW-06 envelope digest; integrity, not lifecycle selection. | `RESOLUTION_PROPOSED`; none. |

These choices imply future descriptor-version and database-migration work only
if later accepted and implemented against an existing installed schema. This
proposal authorizes neither.

## 7. Semantic-to-physical mapping resolution matrix

For all proposed mappings: strings and bytes are copied exactly; no Unicode
normalization, locale comparison, trimming, case folding, numeric coercion, or
default is allowed. Required nullable values remain explicit `null`.
`canonicalBytes` validation and duplicate conflict rules are those in Section
4. The governing physical owner is the future accepted descriptor; the
semantic/provenance owner is K-334D3 for its record kinds and K-334C3 for the
two explicit exceptions.

| Mapping | Semantic source to physical destination and alias rule | Null/omission, validation, conflict, owner | Disposition / blocker |
| --- | --- | --- | --- |
| `MAP-01` | No mapping proposed beyond the already bound key requirements `namespaceKey` and `subjectId`. | All other fields remain forbidden; no default row. Owner pending `B01`. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B01`. |
| `MAP-02` | No mapping proposed beyond `namespaceKey` and `issuerId`. | All other fields remain forbidden; no default row. Owner pending `B02`. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B02`. |
| `MAP-03` | K-334D3 envelope to ROW-03; `policyId=recordId`; payload fields with the same names map directly; `boundary.effectiveSequence` maps to `effectiveSequence`. | Nullable predecessor/supersedes/termination are preserved. Any alias/projection mismatch is corrupt. | `RESOLUTION_PROPOSED`; none. |
| `MAP-04` | `evidenceId=recordId` and direct canonical projections are candidate aliases only; no complete mapping is proposed because C3 role discrimination has no exact K-334D3 source. | No role inference from `action`, lifecycle status, predecessor, timestamp, or presence. Owner pending `B08`. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B08`. |
| `MAP-05` | K-334D3 envelope to ROW-05; `permissionId=recordId`; exact issuer, subject, target, relationship, and boundary-sequence fields map directly. | Three nullable relationship fields preserved. Digest is envelope `canonicalDigest`; mismatch corrupt. | `RESOLUTION_PROPOSED`; none. |
| `MAP-06` | K-334D3 envelope to ROW-06; `terminationId=recordId`; exact target, issuer authority, subject/issuer, relationship, and boundary-sequence fields map directly. | Nullable predecessor/supersedes preserved. No status default. | `RESOLUTION_PROPOSED`; none. |
| `MAP-07` | `tupleId=recordId` and `tupleDigest=canonicalDigest` are candidate aliases only; no complete mapping is approved because the exact `lifecycleStatus`, predecessor, supersession, termination, and separate-lifecycle-record relationship have no complete physical authority. | B03 owns all aliases, null/omission rules, ROW-07, C05, and SC-06/08/11 dependencies. No tuple lifecycle field may be omitted, defaulted, or inferred, and the envelope cannot be installed partially. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B03`. |
| `MAP-08` | K-334D3 subject/issuer mapping envelopes to ROW-08; `mappingId=recordId`; payload maps directly. `canonicalKind=external_subject_mapping` iff `mappingKind=subject`; `canonicalKind=external_issuer_mapping` iff `mappingKind=issuer`. `SEPARATE_TERMINATION_RECORD_AUTHORITY` means mapping termination is represented only by a separate canonical termination record targeting the exact mapping kind and `mappingId`. | Nullable predecessor/supersedes are preserved. Termination timestamp/status/reason/record ID and lifecycle-winner fields are prohibited in ROW-08; absence never implies active or terminated. A discriminator mismatch, unexpected termination field, or same external key with a different target is conflict, never normalization. | `RESOLUTION_PROPOSED`; none. |
| `MAP-09` | K-334D3 fork envelope to ROW-09; `observationId=recordId`; direct subject/lineage/sequence/predecessor/reason projections. Candidate collection stays embedded. | Lineage and predecessor are required nullable values. Collection bytes may not be split, sorted, or reconstructed. | `RESOLUTION_PROPOSED`; none. |
| `MAP-10` | K-334D3 conflict envelope to ROW-10; `observationId=recordId`; `conflictCode=reasonCode` exactly; other projections direct. Candidate collection stays embedded. | Alias disagreement is corruption. Nullable lineage/predecessor preserved. | `RESOLUTION_PROPOSED`; none. |
| `MAP-11` | K-334D3 quarantine envelope to ROW-11; `quarantineRecordId=recordId`; subject/state/reason/permanent/sequence direct; `basisDigest=SHA-256(strictHexDecode(quarantineBasisCollectionBytes))`. | Slot key is not an alias for record ID. Basis bytes remain embedded and must validate before digest derivation. | `RESOLUTION_PROPOSED`; none. |
| `MAP-12` | No physical mapping is proposed. C3's candidate session fields do not fix the exact batch-ID grammar, reconcile its Section 7/pseudocode repository-namespace difference, or define a complete durable envelope. | No process identity bytes, status normalization, storage default, or fabricated K-334D3 envelope. Owner pending `B04`. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B04`. |
| `MAP-13` | K-334D3 classification envelope to ROW-13; `classificationId=recordId`; batch/source/class/supersession direct. | `supersedesClassificationId` required nullable. Different bytes at one ID fail closed; no supersession execution. | `RESOLUTION_PROPOSED`; none. |
| `MAP-14` | No physical mapping is proposed. Known semantic candidates do not fix exact phase/status/digest field inventory or composite-ID byte grammar. | No field default, normalization, or inferred resume state. Owner pending `B05`. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B05`. |
| `MAP-15` | No physical mapping is proposed. Known semantic candidates do not fix marker kind/status, resolution reference, verified digests, or composite-ID byte grammar. | No field default, repair inference, or status normalization. Owner pending `B06`. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B06`. |
| `MAP-16` | C3 Section 7 head projection fields to ROW-16; key is exact `[namespaceKey,subjectId,lineageId]`; projection digest and bytes map from the exact preimage; accepted evidence ID/digest are the only source-record references. | Accepted ID/digest/sequence are explicit nullable values. Their relationship is not evaluated by D0-P09. Any preimage/field mismatch corrupts the projection. | `RESOLUTION_PROPOSED`; none. |
| `MAP-17` | No complete audit mapping is proposed. The C3 composite identifies event by referenced `recordId`, event kind, and sequence, but does not establish `subjectId`. | Subject cannot be inferred from referenced records; timestamp/payload/actor layout remains unapproved. Owner pending `B07`. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B07`. |

## 8. Structural-constraint resolution matrix

| Constraint | Exact proposed rule or exact unresolved question | Owners, evidence, failure, compatibility, runtime boundary | Disposition / blocker |
| --- | --- | --- | --- |
| `SC-04` / complete index authority | If accepted, 37 indexes have complete key path, type, order, `unique`, and `multiEntry=false`. C03 remains without key path or uniqueness until its subject authority is selected. | Semantic owner C3 plus accepted resolutions; physical owner descriptor/IDB metadata. Evidence: `DESCRIPTOR_VALIDATED` plus `IDB_METADATA_OBSERVED`. Missing/mismatched metadata fails. No runtime behavior. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B07` is the sole remaining index blocker. |
| `SC-06` / durable family discriminator | Proposed rows use exact `rowType`; K-334D3 rows additionally use exact `canonicalKind`. No kind is inferred. A complete global rule still requires row discriminators for all eight deferred families. | Semantic owner K-334D3/C3; physical owner descriptor validator. Evidence: `DESCRIPTOR_VALIDATED`. Unknown/mismatch fails. No runtime effect. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B01`-`B08`. |
| `SC-07` / external mapping discriminator | ROW-08 must satisfy the exact two-way relation between `canonicalKind` and `mappingKind` stated in MAP-08. Provider or identifier content can never choose a kind. | K-334D3 semantic owner; descriptor physical owner. `DESCRIPTOR_VALIDATED`; mismatch fails. Preserves existing shared-store scope and adds no runtime authority. | `RESOLUTION_PROPOSED`; none. |
| `SC-08` / immutable identity and key alias | For each proposed canonical row, the family alias equals decoded `recordId`, digest equals decoded `canonicalDigest`, and bytes re-encode identically. The head exception uses only its stated projection slot. A global rule still requires identities for deferred rows. | K-334D3/C3 semantic owner; descriptor physical owner. `DESCRIPTOR_VALIDATED`; mismatch fails. Mutation behavior is `OUT_OF_SCOPE_D0_P09`. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B01`-`B08`. |
| `SC-11` / supersession, predecessor, and termination mapping | For proposed rows, same-named predecessor/supersession projections preserve explicit `null` and never use timestamp/arrival inference. ROW-08 termination is exclusively a separate termination-record relationship and never an embedded mapping field. The complete cross-family rule cannot be accepted until B03 supplies the tuple lifecycle representation and B08 supplies the evidence role/envelope and relationship representation. | K-334D3/C3 semantic owners; descriptor physical owner. `DESCRIPTOR_VALIDATED`; mismatch fails. SC-11 remains unresolved until both B03 and B08 are accepted. It defines no traversal, winner selection, supersession or termination execution, transaction, concurrency, migration, recovery, or runtime effect. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B03`, `B08`. |
| `SC-12` / quarantine slot and identity | ROW-11 primary slot is `[namespaceKey,subjectId]`; immutable identity is `quarantineRecordId===recordId`; basis authority remains canonical embedded bytes plus verified `basisDigest`. None may substitute for another. | K-334D3 semantic owner; descriptor physical owner. `DESCRIPTOR_VALIDATED`; mismatch fails. Quarantine behavior is `OUT_OF_SCOPE_D0_P09`. | `RESOLUTION_PROPOSED`; none. |
| `SC-13` / audit subject mapping | C03 may exist only after `B07` names an exact direct `subjectId` source or explicitly versions/removes that index. Referenced evidence, record type, issuer, or event kind cannot supply it. | C3 semantic owner; descriptor physical owner. `DESCRIPTOR_VALIDATED`; missing/indirect subject fails. No runtime behavior. | `DEFERRED_PENDING_NAMED_AUTHORITY`; `B07`. |

## 9. Migration and recovery boundary

ROW-13 defines static physical metadata only. ROW-12, ROW-14, and ROW-15
remain deferred. Nothing in those records defines or authorizes:

- a writer or state-transition graph;
- CAS, lease acquisition, renewal, expiry, or takeover;
- resume, retry, repair, replay, rollback, or cleanup;
- checkpoint advancement or marker resolution;
- migration ordering or execution;
- runtime access to any store.

The candidate session statuses quoted from C3 are not accepted physical values
in this proposal. Even after a later authority selects them, their presence
would not prove that a transition is legal or occurred. Indexes C25 and C31
are structurally proposed but unusable until their row authorities are accepted.

## 10. Derived-head boundary

ROW-16 is a derived projection. Its slot, accepted-evidence references,
projection digest, canonical-set digest, and literal classification are exact
physical evidence. They do not prove:

- that the referenced evidence exists or is accepted;
- that the projection is current or correctly computed;
- that a blocked projection may be replaced;
- that a head may be updated;
- that any transaction or stale-head policy exists.

D0-P09 could eventually prove descriptor/IndexedDB shape only. Projection
correctness, reconstruction, update ordering, and concurrency remain outside
that proof.

## 11. Audit-event boundary

C01 and C02 are complete proposals:

- `by_record`: `["namespaceKey","recordId"]`, non-unique, non-multi-entry;
- `by_source_digest`: `["namespaceKey","sourceDigest"]`, non-unique,
  non-multi-entry.

C03 and ROW-17 remain blocked by B07. In particular, this proposal does not add
`subjectId`, derive it from a referenced record, introduce an actor/issuer
alias, select a timestamp representation, or choose an audit payload envelope.
Those are the exact responsibilities of `B07`.

## 12. Compatibility and data-loss analysis

1. K-334D3-backed proposed rows reconstruct their complete canonical record
   losslessly from `canonicalBytes`; no canonical payload member is discarded.
2. Canonical bytes, record ID, and canonical digest remain authoritative.
   Physical aliases and projections cannot override them.
3. Duplicate flat fields can drift only in corrupt data; strict equality and
   byte round-trip validation fail closed rather than normalize or repair.
4. All proposed history/query indexes are non-unique. Proposed unique digest
   indexes reject only an idempotent duplicate/collision in the same store, not
   valid historical positions.
5. Explicit `null` is preserved in rows. Omission is allowed only for fields
   declared absent from that family's exact inventory.
6. Embedded candidate and quarantine-basis collections remain in canonical
   bytes, retaining their canonical order and framing. No array projection is
   introduced.
7. The head exception retains exact projection preimage bytes so normalized
   fields cannot silently become a second integrity source. Session fields are
   not authorized at all.
8. Future physical evolution requires a new row/descriptor version and explicit
   compatibility review. This proposal authorizes no migration.
9. Any later installation into an existing database could require migration and
   concurrency authority. Those implications are recorded, not authorized.
10. The choices constrain K-334E/F only by requiring fail-closed validation of
    accepted physical rows. They do not authorize K-334E/F behavior.
11. The eight deferred families cannot be installed partially. This prevents
    silent data loss or fabricated fields while retaining all 17 stores in the
    proposed initial descriptor scope.
12. External-mapping termination remains lossless through the separate
    canonical termination record/store relationship. ROW-08 contains no
    competing lifecycle state, and unexpected termination fields fail closed.
13. Compatibility-tuple predecessor, supersession, termination, lifecycle
    status, aliases, and null/omission rules remain atomically deferred to B03;
    C05 and SC-11 cannot bypass that authority.

## 13. Package consistency

The package contains:

- 17 unique row resolution records, `ROW-01` through `ROW-17`;
- 16 unique unresolved-index resolution records, `IDX-C01`, `IDX-C02`,
  `IDX-C03`, `IDX-C05`, `IDX-C06`, `IDX-C15`, `IDX-C16`, `IDX-C18`,
  `IDX-C20`, `IDX-C25`, `IDX-C27`, `IDX-C31`, `IDX-C32`, `IDX-C33`,
  `IDX-C36`, and `IDX-C38`;
- 17 unique semantic mapping records, `MAP-01` through `MAP-17`;
- 7 unique structural constraints, `SC-04`, `SC-06`, `SC-07`, `SC-08`,
  `SC-11`, `SC-12`, and `SC-13`.

Proposed field ownership is one-to-one:

- primary aliases are owned by their matching `MAP`;
- flat projections are owned by the exact same-name semantic field mapping,
  except `conflictCode` (MAP-10) and `basisDigest` (MAP-11);
- common envelope duplicates are owned by Section 4 validation;
- head fields are owned by MAP-16.

Every proposed index key-path field is present in its proposed row, except where
the row is explicitly deferred behind B03, B04, B05, B06, B07, or B08. C03 has no
proposed key path. Discriminators, aliases, nullability, and duplicate sources
are explicit. Deferred values are never defaults.

| Category | Total | `RESOLUTION_PROPOSED` | `DEFERRED_PENDING_NAMED_AUTHORITY` | Excluded | Anonymous unresolved |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rows | 17 | 9 | 8 | 0 | 0 |
| Indexes | 16 | 15 | 1 | 0 | 0 |
| Mappings | 17 | 9 | 8 | 0 | 0 |
| Constraints | 7 | 2 | 5 | 0 | 0 |
| All resolution records | 57 | 35 | 22 | 0 | 0 |

There are 22 unresolved resolution records consolidated into eight distinct
named blockers B01 through B08. Acceptance must close all eight and all 22
dependent records before K-334P09P can be fully resolved. External-mapping
termination has the explicit `SEPARATE_TERMINATION_RECORD_AUTHORITY`
disposition and is not an anonymous blocker. B03 owns every unresolved
compatibility-tuple lifecycle relationship, and SC-11 depends on both B03 and
B08. Anonymous unresolved blockers remain zero.

## 14. Acceptance effect and required sequence

If independently reviewed and later accepted, this proposal would authorize
only incorporation of its accepted values into K-334P09P. It would not itself
accept K-334P09P or any deferred authority.

The required sequence is:

1. create this proposal;
2. independently review and correct it;
3. separately resolve B01 through B08;
4. explicitly accept the resolution decisions;
5. amend K-334P09P with only accepted values;
6. independently review the fully resolved prerequisite;
7. explicitly accept the prerequisite;
8. create and review descriptor implementation authorization;
9. continue the separate descriptor lifecycle;
10. separately rebind D0-P09 only if every required authority and artifact
    exists.

No step automatically authorizes the next.

## 15. Explicitly unauthorized scope

This proposal does not authorize:

- modifying K-334P09P or the blocked D0-P09 authorization;
- accepting this proposal or any named blocker authority;
- accepting the descriptor prerequisite;
- descriptor, serializer, checksum, manifest, fixture, test, installer, or
  proof-adapter implementation;
- IndexedDB opening, database versioning, store/index installation, or schema
  mutation;
- writer, transaction, locking, concurrency, CAS, lease, migration, recovery,
  repair, retry, replay, rollback, or cleanup behavior;
- runtime integration, admission, eligibility, activation, or production use;
- D0-P09 rebinding, execution, or satisfaction;
- D0-P10;
- K-334E or K-334F;
- a commit, push, pull request, Ready transition, merge, or main change.

## 16. Authorization state

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 0
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

## 17. Production boundary

This proposal is inert documentation. It opens no database, reaches no startup
or worker path, changes no production source, and grants no eligibility.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
