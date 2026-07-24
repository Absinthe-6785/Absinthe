# K-334P09B07B08A — Final Minimal-v1 B07/B08 Authority Package

| Field | Value |
| --- | --- |
| Type | `K334FinalMinimalV1B07B08AuthorityPackage` |
| ID | `K-334P09B07B08A-FINAL-MINIMAL-V1-AUTHORITY-PACKAGE-001` |
| Status | `FINAL_MINIMAL_V1_B07_B08_PACKAGE_PROPOSED` |
| Effective authority | `PROPOSAL_ONLY_NO_IMPLEMENTATION_AUTHORITY` |
| B07 owner | `K334AuditEventPhysicalAuthorityV1` |
| B08 owner | `K334AuthorityEvidenceRolePhysicalAuthorityV1` |
| Combination decision | `B07_B08_LOGICALLY_SEPARATE_WITHIN_ONE_PACKAGE` |
| Failure outcome | `UNSUPPORTED_OR_MALFORMED_INPUT` |

This package proposes the final minimal-v1 semantic and physical authority
needed to resolve B07 and B08. It does not accept either blocker, amend the
descriptor prerequisite, authorize a descriptor, authorize a writer, or
advance D0-P09.

`UNSUPPORTED_OR_MALFORMED_INPUT` means: fail closed; reject or quarantine;
preserve recoverable material where technically available; do not mutate
accepted canonical state; emit one bounded structured diagnostic containing no
payload, stack, cause, or unbounded text; and require a future reviewed version
for new semantics.

## 1. A. Approved Source and Ownership Resolution

The source audit treats the approved K-334C/C2/C3 documents, the implemented
and reviewed K-334D3 canonical protocol, K-334P09T/X, and the accepted B01–B06
packages as authority. Tests, fixtures, current runtime behavior, unused
prototypes, naming conventions, and the unaccepted K-334P09P document are not
authority.

| Fact | Classification | Exact finding |
| --- | --- | --- |
| B07 title and purpose | `EXPLICIT_APPROVED_AUTHORITY` | B07 is “Complete audit-event physical authority and subject-index disposition”; it owns ROW-17, MAP-17, C03, and the B07 portions of SC-04, SC-06, SC-08, and SC-13. |
| B07 semantic owner | `EXPLICIT_APPROVED_AUTHORITY` | K-334C3 defines a retained append-only audit/provenance event that references a record, event/action, source digest, recorder, sequence, and bounded context. An audit event never substitutes for canonical evidence. |
| B07 dependent consumer | `EXPLICIT_APPROVED_AUTHORITY` | A future descriptor and future K-334D/E/F transaction/audit writer are the consumers. No such writer or transaction behavior is authorized here. |
| B07 store and key | `EXPLICIT_APPROVED_AUTHORITY` | Store `authority_audit_events`; primary key `["namespaceKey","auditEventId"]`; key order is namespace first and audit event second; `autoIncrement=false`. |
| B07 identity and digest | `EXPLICIT_APPROVED_AUTHORITY` | Composite `dae:v1:<recordId>:<eventKind>:<eventSequence>` and digest domain `absinthe:k334:audit-event:v1:canonical-digest`. |
| B07 process preimage | `EXPLICIT_APPROVED_AUTHORITY` | Ordered fields are `recordType`, `recordSchemaVersion`, `repositoryNamespace`, `namespaceKey`, `recordId`, `eventKind`, `eventSequence`, `sourceDigest`, `recorderId`, and bounded context code. |
| B07 exclusions | `EXPLICIT_APPROVED_AUTHORITY` | `auditEventId`, `canonicalDigest`, `recordedAt`, payload, stack, and cause are excluded from the preimage. Audit is retained and cannot replace canonical evidence. |
| Required evidence/audit pair | `EXPLICIT_APPROVED_AUTHORITY` | K-334C3 T01 writes E and A atomically; T35 preserves the required-pair postcondition and aborts the governing mutation when its required audit cannot commit. |
| B07 C01 | `EXPLICIT_APPROVED_AUTHORITY` | `by_record` uses `["namespaceKey","recordId"]`, `unique=false`, `multiEntry=false`; multiple events for one record are legal. |
| B07 C02 | `EXPLICIT_APPROVED_AUTHORITY` | `by_source_digest` uses `["namespaceKey","sourceDigest"]`, `unique=false`, `multiEntry=false`; multiple events may share source evidence. |
| B07 C03 gap | `EXPLICIT_APPROVED_AUTHORITY` | No approved audit `subjectId` source exists. Subject cannot be derived through a referenced record, evidence, issuer, event kind, or store presence. B07 may instead remove the index explicitly for this version. |
| B07 K-334D3 envelope | `NOT_FOUND` | K-334D3 defines no audit-event kind or canonical record wrapper. Fabricating one is prohibited. |
| B07 exact event/context scalars and row envelope | `PARTIAL_AUTHORITY` | C3 fixes their positions and bounded purpose but not their exact v1 grammar, discriminator, preimage-bytes field, or complete physical row. |
| B07 exact event/context choices and v1 subject-index removal | `NEW_MINIMAL_V1_DECISION` | Sections 3–4 select one closed event literal, a bounded uninterpreted context-code scalar, an exact process envelope, and explicit C03 removal without inventing a subject. |
| B08 title and purpose | `EXPLICIT_APPROVED_AUTHORITY` | B08 is “Complete authority-evidence role, envelope, and lifecycle/relationship physical authority”; it owns ROW-04, MAP-04, and the B08 portions of SC-06, SC-08, and SC-11. |
| B08 semantic owner | `EXPLICIT_APPROVED_AUTHORITY` | K-334D3 kind `authority_evidence`, envelope version `1`, and payload record type `authority_evidence_v1` are the exact canonical semantic authority. |
| B08 identity and digest | `EXPLICIT_APPROVED_AUTHORITY` | Record ID is `dar:v1:authority-evidence:<sha256>` under `absinthe:k334:authority-evidence:v1:record-id`; digest uses `absinthe:k334:authority-evidence:v1:canonical-digest`. |
| B08 fields | `EXPLICIT_APPROVED_AUTHORITY` | K-334D3 fixes subject, issuer, lineage, nullable predecessor and supersedes references, action literal `grant`, lifecycle status, boundary, compatibility tuple, and four-field provenance. |
| B08 store and key | `EXPLICIT_APPROVED_AUTHORITY` | Store `authority_evidence`; key `["namespaceKey","evidenceId"]`; `autoIncrement=false`; evidence is retained and append-only. |
| B08 indexes | `EXPLICIT_APPROVED_AUTHORITY` | C3 fixes `by_digest`, `by_issuer`, `by_predecessor`, `by_subject_lineage_sequence`, and `by_subject_status`, including their key paths and uniqueness behavior. |
| B08 role gap | `EXPLICIT_APPROVED_AUTHORITY` | C3 describes accepted, rejected/unsupported, grant, and successor evidence categories, while K-334D3 has no `evidenceRole` and has no `rejected` lifecycle literal. No role may be inferred from action, status, predecessor, timestamp, or presence. |
| B08 relationship authority | `PARTIAL_AUTHORITY` | K-334D3 supplies predecessor/supersedes/boundary fields and separate termination records, but K-334P09T/X require B08 to choose the physical aggregate representation. |
| B08 v1 role disposition | `NEW_MINIMAL_V1_DECISION` | Section 5 selects `NO_INDEPENDENT_EVIDENCE_ROLE_V1`: ROW-04 stores exactly the existing canonical authority-evidence family and no second role field. Unrepresentable `rejected` semantics require a future canonical version. |
| B08 v1 lifecycle/reference matrix | `NEW_MINIMAL_V1_DECISION` | Section 6.3 closes status/reference compatibility, direction, exact context equality, sequence, self-link, cycle, missing-reference, and same-position conflict behavior without adding a canonical field. |
| Evidence/audit pair operation identity | `NEW_MINIMAL_V1_DECISION` | Section 8 binds T01/T35 integrity to one deterministic operation preimage and exact E/A postcondition without merging either family or authorizing a writer. |
| Formal B07/B08 store and index identities | `NEW_MINIMAL_V1_DECISION` | Stable `k334.store.*.v1` and `k334.index.*.v1` identifiers below bind approved names and shapes one-to-one; no identity is taken from the unaccepted descriptor proposal. |
| B07/B08 implementation, descriptor installation, and runtime reachability | `NOT_FOUND` | No approved source authorizes any of them. |

The exact reason B07 remained deferred was the missing event/actor/timestamp/
payload envelope and missing direct subject source. The exact reason B08
remained deferred was the mismatch between C3’s aggregate role descriptions
and the narrower canonical K-334D3 record, plus the unresolved physical
lifecycle/relationship representation.

## 2. B07/B08 Combination Decision

`B07_B08_LOGICALLY_SEPARATE_WITHIN_ONE_PACKAGE`

B07 is a C3 process-oriented audit record with its own composite identity and
digest preimage. B08 is a K-334D3 content-addressed canonical record. They share
no semantic identity, lifecycle, durable row, mapping, retry comparator, or
authority effect. A B07 `recordId` may generically name a B08 record, but that
reference grants neither record additional meaning.

Logical separation does not imply universal transaction independence. Approved
K-334C3 T01 and the required-pair branch of T35 impose the operation-specific
`EVIDENCE_AUDIT_ATOMIC_PAIR_V1` integrity contract in Section 8. Outside an
approved required-pair operation, neither family requires the other merely
because both exist. B07 and B08 therefore remain separate contracts inside one
review and closure chain while an exact governing operation may require their
atomic durability.

## 3. Common Minimal-v1 Scalars and Validation

The following rules are exact:

- `StrictIdentifier` is 3–256 lowercase ASCII characters matching
  `^[a-z][a-z0-9_.:-]{2,255}$`.
- `RepositoryNamespace` is 24–128 ASCII characters matching
  `^absinthe\.installation\.[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`.
- `NamespaceKey` and `Sha256` are exactly 64 lowercase hexadecimal characters
  matching `^[a-f0-9]{64}$`.
- `CanonicalSequence` is a positive safe integer. Its identity rendering is
  the shortest base-10 form with no sign, exponent, fraction, whitespace, or
  leading zero.
- `RecordedAt` is exactly 24 ASCII bytes in calendar-valid
  `YYYY-MM-DDTHH:mm:ss.sssZ` UTC form. Offsets and leap seconds are invalid.
  It is assigned once at initial durable insertion and is storage-only.
- `AuditEventKindV1` is the single literal `recorded`.
- `AuditContextCodeV1` is either explicit `null` or 3–64 lowercase ASCII
  characters matching `^[a-z][a-z0-9_]{2,63}$`. A non-null value is an exact
  bounded diagnostic label only. B07 interprets no policy or authority from
  it.
- Every row and nested object is exact. Unknown or missing own fields,
  unsupported versions, invalid prototypes/accessors, coercion, trimming,
  case conversion, Unicode normalization, defaulting, aliases, and extension
  bags fail closed.
- Repository namespace, namespace key, primary key, row fields, canonical
  bytes or preimage bytes, digest, references, and validation context must
  agree byte-for-byte.

## 4. B. B07 Semantic Contract

### 4.1 Assertion, identity, and authority meaning

The semantic kind is `authority_audit_event_v1`; its semantic and record schema
version is exactly `1`.

One B07 event makes only the assertion
`REFERENCED_RECORD_DURABLY_RECORDED_V1`:

> The exact record identified by `recordId` was durably recorded under the
> audit event's exact `repositoryNamespace`, `namespaceKey`, `sourceDigest`,
> `recorderId`, caller-supplied `eventSequence`, and bounded `contextCode`
> bindings.

`eventKind="recorded"` describes the referenced record's durable recording, not
merely the recording of an audit observation. It does not prove that the
referenced record is semantically accepted, current, applicable, lifecycle
valid, eligible, activated, or effective.

For a governing operation that writes the target and audit atomically, the
target must exist in that transaction; its exact identity must equal
`recordId`; its repository and namespace must agree; its validated target-family
digest must have the exact relationship to `sourceDigest` required below; and
the target and audit writes must share the approved atomic boundary. For an
audit of a pre-existing record, the target must be resolved in the same
repository and namespace and its identity, persisted integrity, target-family
digest relationship, and required context must validate before the audit is
usable. Generic unresolved or dangling opaque references are unsupported in v1.
A missing, cross-context, malformed, or corrupt target fails closed; it is never
inferred, repaired, accepted, or activated by B07.

For a B08 target in T01/T35, `recordId` must equal the exact
`evidenceId`/`recordId` and B07 `sourceDigest` must equal the exact B08
`canonicalDigest`. For any other supported target family, `sourceDigest` must
equal the digest selected by that target family's separately accepted audit
source-digest rule. If no such exact rule exists, the audit operation is
unsupported rather than implementation-selected.

The governing operation supplies `eventSequence`; B07 validates but never
allocates it. For a required E/A pair the operation durably binds and reuses
that sequence as specified in Section 8. Its numeric order has no winner,
completeness, wall-clock, or lifecycle meaning. Generated sequences and
implicit max-plus-one allocation are unsupported in v1.

The canonical identity is exactly:

`"dae:v1:" + recordId + ":recorded:" + shortestBase10(eventSequence)`

The identity is recomputed from the already decoded fields and compared as one
exact string; it is never accepted by ambiguous delimiter-only parsing.

### 4.2 Required semantic content

| Order | Field | Exact rule and meaning |
| ---: | --- | --- |
| 1 | `recordType` | literal `authority_audit_event_v1` |
| 2 | `recordSchemaVersion` | numeric literal `1` |
| 3 | `repositoryNamespace` | exact `RepositoryNamespace`; repository validation boundary |
| 4 | `namespaceKey` | exact `NamespaceKey`; namespace and first key component |
| 5 | `recordId` | exact `StrictIdentifier`; opaque referenced-record identity |
| 6 | `eventKind` | literal `recorded` |
| 7 | `eventSequence` | exact `CanonicalSequence`; caller-supplied event discriminator |
| 8 | `sourceDigest` | exact `Sha256`; exact target-family audit-source digest, equal to B08 `canonicalDigest` for a T01/T35 evidence pair |
| 9 | `recorderId` | exact `StrictIdentifier`; actor bound to the referenced record's durable recording |
| 10 | `contextCode` | exact `AuditContextCodeV1`; diagnostic context only |

The audit-specific provenance is exactly the pair `sourceDigest` and
`recorderId` plus the referenced `recordId`. No generic provenance object,
`sourceKind`, `sourceRecordId`, subject, issuer, payload, actor alias,
attachment, arbitrary context object, stack, cause, or message exists in v1.
The governing target-family rule determines the exact source-digest
relationship. In a B08 T01/T35 pair it is exact equality with the referenced
evidence `canonicalDigest`; no other equality is inferred.

### 4.3 Equality, lifecycle, conflict, and exclusions

Semantic equality is field-for-field exact equality of all ten ordered fields.
The lifecycle is append-only and immutable. There is no update, deletion,
supersession, termination, acceptance, rejection, acknowledgement, or mutable
status. An exact retry is a no-op. The same identity with different semantic
content is corruption and fails closed.

A B07 record grants or proves no semantic acceptance, schema validity beyond
the governing operation's exact integrity checks, applicability, lifecycle
validity, evidence role, compatibility, policy authority, admission,
eligibility, activation, runtime access, production access, ordering, subject
membership, or permission to mutate the referenced record. It confirms only
the bounded durable-recording assertion above.

## 5. C. B07 Durable Row and Mapping Contract

### 5.1 ROW-17 physical contract

| Property | Exact value |
| --- | --- |
| Row identifier | `ROW-17` |
| Store identity | `k334.store.authority_audit_events.v1` |
| Store name | `authority_audit_events` |
| Key path | `["namespaceKey","auditEventId"]` |
| Key order | `namespaceKey`, then `auditEventId` |
| `autoIncrement` | `false` |
| Row discriminator | `rowType="k334_physical_audit_event_row_v1"` |
| Row version | `rowVersion=1` |
| K-334D3 canonical kind/version | absent; prohibited |

The row has exactly these required own fields in this logical order:

| Physical field | Exact source/type | Reconstruction and equality |
| --- | --- | --- |
| `rowType` | literal `k334_physical_audit_event_row_v1` | structural discriminator only |
| `rowVersion` | numeric literal `1` | physical schema only |
| `recordType` | literal `authority_audit_event_v1` | process preimage field 1 |
| `recordSchemaVersion` | numeric literal `1` | process preimage field 2 |
| `repositoryNamespace` | exact semantic value | preimage/context equality |
| `namespaceKey` | exact semantic value; key component 1 | preimage/key/context equality |
| `auditEventId` | recomputed exact composite; key component 2 | process identity; excluded from preimage |
| `recordId` | exact semantic value | preimage and C01 source |
| `eventKind` | literal `recorded` | preimage |
| `eventSequence` | exact semantic value | preimage and identity |
| `sourceDigest` | exact semantic value | preimage and C02 source |
| `recorderId` | exact semantic value | preimage |
| `contextCode` | exact semantic value, including explicit `null` | preimage |
| `auditPreimageBytes` | structured-clone `Uint8Array` | strict decode and byte-identical re-encode |
| `canonicalDigest` | exact digest under the audit-event digest domain | recomputed from exact preimage bytes |
| `recordedAt` | exact `RecordedAt` | storage-only; retained on retry |

All fields are required. `contextCode` alone may contain explicit `null`.
`subjectId`, `canonicalKind`, `canonicalVersion`, `canonicalBytes`, `payload`,
generic `provenance`, lifecycle/status fields, relationship fields, operation
keys, generated IDs, timestamps other than `recordedAt`, stack, cause, message,
and every unlisted field are prohibited.

The process preimage uses the accepted K-334 canonical scalar/ordered-pair
framing under the outer domain
`absinthe:k334:audit-event:v1:canonical-digest`, version `1`, bound exactly
once. Its pairs are the ten semantic fields in Section 4.2 in exactly that
order. Explicit `null` uses the canonical null scalar. No JSON, delimiter
serialization, host integer encoding, locale ordering, duplicate domain, or
object-property iteration is valid.

`auditPreimageBytes` is the exact framed preimage. `canonicalDigest` is the
lowercase hexadecimal SHA-256 result produced by the accepted K-334 process
digest primitive for that exact domain/version/preimage. The digest is an
integrity value, not the row identity or authority.

### 5.2 MAP-17 complete mapping

| Semantic source | Physical destination | Transformation | Reverse reconstruction |
| --- | --- | --- | --- |
| fixed semantic kind | `recordType` | exact literal | exact literal |
| semantic version | `recordSchemaVersion`; `rowVersion` | exact numeric `1` | exact numeric `1` |
| `repositoryNamespace` | same field | exact copy | exact copy |
| `namespaceKey` | same field; key component 1 | exact copy | exact copy |
| `recordId` | same field | exact copy | exact copy |
| `eventKind` | same field | exact copy | exact copy |
| `eventSequence` | same field | numeric exact | numeric exact |
| `sourceDigest` | same field | exact copy | exact copy |
| `recorderId` | same field | exact copy | exact copy |
| `contextCode` | same field | exact value, including `null` | exact value |
| ordered semantic object | `auditPreimageBytes` | exact K-334 process framing | strict decode restores all ten fields |
| ordered semantic object | `canonicalDigest` | exact approved digest domain | recompute and compare |
| canonical identity | `auditEventId`; key component 2 | exact composite construction | recompute and compare |
| physical family | `rowType` | fixed literal | verify only; no semantic output |
| insertion metadata | `recordedAt` | assigned once | validate only; no semantic output |

MAP-17 is total, lossless, deterministic, and free of normalization, defaults,
heuristics, hidden aliases, and implementation-selected values. Its reconstructed
semantic object yields `REFERENCED_RECORD_DURABLY_RECORDED_V1`; it does not
reconstruct acceptance, applicability, lifecycle effect, or authority. Exact
retry verifies that same assertion and, for a required E/A pair, defers to the
operation-stable sequence and pair retry in Section 8.

## 6. D. B08 Semantic Contract

### 6.1 Canonical assertion and role disposition

The semantic kind is exactly K-334D3 `authority_evidence`, envelope version
`1`, with payload `recordType="authority_evidence_v1"` and
`recordSchemaVersion=1`.

The v1 role rule is:

`NO_INDEPENDENT_EVIDENCE_ROLE_V1`

There is no `evidenceRole` semantic or physical field. ROW-04 contains exactly
one family: canonical K-334D3 authority-evidence records. The direct canonical
fields retain their own meanings:

- `action` is always the literal `grant`;
- `lifecycleStatus` is one of `proposed`, `recorded`, `accepted`,
  `superseded`, `terminated`, `rollback_applied`, `unsupported`, or
  `malformed`;
- a non-null `predecessorRecordId` asserts that exact predecessor reference;
- a non-null `supersedesRecordId` asserts that exact supersession reference;
- the boundary is exact and prospective;
- the compatibility tuple and provenance are exact canonical inputs.

These are canonical field assertions, not inferred roles. In particular:

- status `accepted` does not make row presence sufficient proof of operative
  acceptance or applicability;
- status `unsupported` or `malformed` grants no authority;
- `rejected` is not a K-334D3 literal and has no v1 representation;
- no status is normalized to `rejected`;
- a predecessor does not manufacture a `successor` role;
- action `grant` does not manufacture an `accepted-grant` role.

New rejected-evidence semantics require a future reviewed canonical kind or
version. Preserving recoverable rejected input outside accepted canonical
state is required by failure policy, but no unspecified durable row is created
by this package. This is the explicit minimal-v1 revision of C3’s broader
aggregate-role description.

### 6.2 Identity, fields, context, and lifecycle

Canonical identity, bytes, and digest are exactly those produced and verified
by K-334D3:

- ID prefix `dar:v1:authority-evidence:`;
- ID domain `absinthe:k334:authority-evidence:v1:record-id`;
- digest domain `absinthe:k334:authority-evidence:v1:canonical-digest`;
- `canonicalBytes` is the exact `encodeK334CanonicalRecord` result.

The ordered semantic payload is exactly:

1. `recordType`;
2. `recordSchemaVersion`;
3. `repositoryNamespace`;
4. `namespaceKey`;
5. `subjectId`;
6. `issuerId`;
7. `lineageId`;
8. `predecessorRecordId`;
9. `supersedesRecordId`;
10. `action`;
11. `lifecycleStatus`;
12. `boundary.effectiveSequence`;
13. `boundary.effectiveAfterRecordId`;
14. `boundary.prospectiveOnly`;
15. `compatibilityTupleId`;
16. `provenance.sourceKind`;
17. `provenance.sourceRecordId`;
18. `provenance.sourceDigest`;
19. `provenance.recorderId`.

K-334D3 scalar validators are authoritative: identifiers are strict;
predecessor, supersedes, source-record, and effective-after references retain
explicit nullability; `effectiveSequence` is positive and safe;
`prospectiveOnly` is literal `true`; compatibility tuple has the `dat:v1:`
prefix; source kind is one of `k333_codec`, `owner_evidence`, `legacy`, or
`migration`; and digests are lowercase SHA-256.

Semantic equality is exact canonical-byte equality together with the exact
verified record ID and digest. The record is immutable and append-only. A
separate canonical termination record may target kind `authority_evidence` and
the exact evidence ID. No termination state is embedded in or inferred from
ROW-04. The bounded relationship-integrity traversal in Section 6.3 is required
for validation, but no general graph traversal, winner selection, acceptance
evaluation, lifecycle transition, or mutation is authorized.

The B08 record does not itself grant issuer authority, policy applicability,
compatibility, admission, eligibility, activation, runtime access, production
access, or authority to execute its declared lifecycle state.

### 6.3 Exhaustive lifecycle and relationship matrix

`B08_LIFECYCLE_REFERENCE_MATRIX_V1` is the complete minimal-v1 compatibility
matrix. `boundary.effectiveSequence` is the subject-lineage sequence used by
this matrix. Every row defines its own initial eligibility, exact predecessor
status, reference nullability, and permitted successor class; a merely valid
B08 predecessor is never sufficient. Every record has
`boundary.prospectiveOnly=FIXED(true)`.

The canonical action is `FIXED(grant)` in every row:

| Matrix row | `lifecycleStatus` | Initial / predecessor / sequence rule | `supersedesRecordId` | Terminal and exact permitted successor class | Exact status-specific meaning and prohibitions |
| --- | --- | --- | --- | --- |
| `B08-L01` | `proposed` | Initial only: sequence exactly `1`; `predecessorRecordId` and `boundary.effectiveAfterRecordId` are both `MUST_BE_NULL`. No predecessor is permitted. | `MUST_BE_NULL` | Not terminal; only `recorded` may directly succeed. | Proposed grant evidence only; no acceptance or effect. |
| `B08-L02` | `recorded` | Continuation only: predecessor is `REQUIRED`, has status exactly `proposed`, `boundary.effectiveAfterRecordId=MUST_EQUAL(predecessorRecordId)`, and current sequence is predecessor sequence plus one. | `MUST_BE_NULL` | Not terminal; only `accepted` may directly succeed. | Durably recorded grant evidence only; recording is not acceptance. |
| `B08-L03` | `accepted` | Continuation only: predecessor is `REQUIRED`, has status exactly `recorded`, `boundary.effectiveAfterRecordId=MUST_EQUAL(predecessorRecordId)`, and current sequence is predecessor sequence plus one. | `MUST_BE_NULL` | Not terminal; only `superseded`, `terminated`, or `rollback_applied` may directly succeed, subject to their row rules. | Canonical accepted-status assertion only; operative acceptance still requires the separately authorized full graph/projection gate. |
| `B08-L04` | `superseded` | Continuation only: predecessor is `REQUIRED`, has status exactly `accepted`, `boundary.effectiveAfterRecordId=MUST_EQUAL(predecessorRecordId)`, and current sequence is predecessor sequence plus one. | `REQUIRED_ACCEPTED_EARLIER_RECORD` | Terminal for normal v1 progression; no successor is permitted. | Records a prospective supersession assertion over the exact earlier accepted evidence; it neither deletes the target nor selects a successor head. |
| `B08-L05` | `terminated` | Continuation only: predecessor is `REQUIRED`, has status exactly `accepted`, `boundary.effectiveAfterRecordId=MUST_EQUAL(predecessorRecordId)`, and current sequence is predecessor sequence plus one. | `MUST_BE_NULL`; the exact termination reference remains required in the separately canonical termination record. | Terminal for normal v1 progression; no successor is permitted. | Records only the canonical status assertion. Operative termination still requires a separate canonical termination record and authority; no embedded termination effect exists. |
| `B08-L06` | `rollback_applied` | Continuation only: predecessor is `REQUIRED`, has status exactly `accepted`, `boundary.effectiveAfterRecordId=MUST_EQUAL(predecessorRecordId)`, and current sequence is predecessor sequence plus one. | `REQUIRED_ACCEPTED_EARLIER_RECORD` | Terminal for normal v1 progression; no successor is permitted. | Records a rollback-applied assertion over the exact accepted lineage target; separate rollback permission and approved rollback context remain mandatory and are not inferred. |
| `B08-L07` | `unsupported` | Initial-only preserved input: sequence exactly `1`; `predecessorRecordId` and `boundary.effectiveAfterRecordId` are both `MUST_BE_NULL`. No predecessor or failed-source reference is represented by v1. | `MUST_BE_NULL` | Terminal for v1 lifecycle progression; no successor is permitted. | Preserved non-authoritative canonical input; it cannot participate as accepted authority or re-enter the normal chain. |
| `B08-L08` | `malformed` | Initial-only preserved bounded assertion: sequence exactly `1`; `predecessorRecordId` and `boundary.effectiveAfterRecordId` are both `MUST_BE_NULL`. No predecessor or failed-source reference is represented by v1. | `MUST_BE_NULL` | Terminal for v1 lifecycle progression; no successor is permitted. | Preserved bounded malformed-status assertion; it cannot participate as accepted authority or re-enter the normal chain. |

No `rejected` row exists. A decoded B08 record must match exactly one row,
including its predecessor-status and position branch. Zero matches or multiple
matches fail closed. In particular, `accepted` after `terminated` or
`malformed`, superseded or terminated without an accepted predecessor,
`rollback_applied` from any other predecessor, and every continuation after an
`unsupported` or `malformed` terminal state fail closed. Status, primary-key
presence, or index membership cannot substitute for the matrix.

For every row, every lifecycle status not named as that row's exact permitted
predecessor is prohibited. The status-specific successor column is exhaustive
for normal v1 progression; no implicit branch, recovery path, normalization, or
automatic repair is available.

#### 6.3.1 Reference direction, existence, and equality

Both accepted reference fields point from the current, later record to an
earlier record. `predecessorRecordId` names the immediately preceding lineage
position. A non-null `supersedesRecordId` names the earlier accepted record
whose future applicability is displaced by the current supersession or rollback
assertion. Reverse interpretation and direction inferred from an index are
prohibited.

Every required reference must resolve before, or atomically with, the governing
operation to a canonical `authority_evidence` version `1` ROW-04 record in the
same repository and namespace. The target key must equal
`[namespaceKey,evidenceId]`; `evidenceId` must equal the decoded `recordId`;
canonical bytes, ID, digest, projections, matrix row, and persisted integrity
must validate. Missing, dangling, malformed, unknown-version, or wrong-family
references fail closed.

Across current and referenced records, the following must be byte-for-byte
equal: `repositoryNamespace`, `namespaceKey`, `subjectId`, `issuerId`,
`lineageId`, `recordType`, `recordSchemaVersion`, `action`,
`compatibilityTupleId`, and `boundary.prospectiveOnly`. The current
`boundary.effectiveAfterRecordId` is governed by the matrix row's exact
predecessor rule, rather than copied from its predecessor. Permitted differences are only the current
record/evidence ID, canonical digest, lifecycle status, effective sequence,
effective-after reference as fixed by the position rule, provenance of the new
record, and the two explicit relationship references. No other difference is
implementation-selectable.

A required supersession or rollback target must have
`lifecycleStatus="accepted"`, the same context above, and an effective sequence
strictly less than the current sequence. If `predecessorRecordId` and
`supersedesRecordId` are equal, that equality is valid only when the one target
simultaneously satisfies the immediate-predecessor rule and the exact accepted
displaced-target rule. Otherwise equality is contradictory and fails closed.

#### 6.3.2 Sequence conflicts, self-links, and cycles

The accepted scalar is the existing positive-safe-integer
`boundary.effectiveSequence`. Initial value is exactly `1`; every continuation
is exactly predecessor sequence plus one. The storage layer never allocates a
sequence.

`B08_LOGICAL_POSITION_V1` is repository context plus
`(namespaceKey,subjectId,lineageId,effectiveSequence)`. Its approved physical
candidate lookup is the non-unique
`[namespaceKey,subjectId,lineageId,effectiveSequence]`
`by_subject_lineage_sequence` index; every returned candidate must also match
the exact `repositoryNamespace` context. A repository mismatch is not an
alternate winner and fails closed under the context-integrity rule.

At one logical position, one row with the same evidence ID/record ID,
canonical bytes, canonical digest, action/status, issuer, relationships,
compatibility/boundary, and provenance is an exact retry and no-op. Every
distinct canonical row is competing content, including a difference in issuer,
action, lifecycle status, predecessor, relationship, boundary, compatibility,
provenance, digest, or any other canonical field. Zero rows means no existing
position claim; one distinct row is a blocking competitor; multiple rows must
all be strictly decoded and classified, and are a blocking competitor set unless
they are byte-identical aliases of one canonical record. No lifecycle operation
may select, advance, or derive authority from a blocking position until the
separately authorized conflict/fork protocol resolves or quarantines it.
Issuer, compatibility, and boundary differences never create separate
positions. Issuer, status, timestamp, insertion order, index order, digest
sorting, or application preference never choose a winner; accepted canonical
rows are neither mutated nor deleted during conflict handling.

`predecessorRecordId===evidenceId` and
`supersedesRecordId===evidenceId` are prohibited. Validation follows both
reference fields through accepted B08 v1 rows within the exact repository,
namespace, subject, issuer, and lineage, recording every visited evidence ID.
Revisiting any ID is a cycle and fails closed. Traversal is limited to 1,024
resolved records; reaching the bound before all paths terminate fails closed
with a bounded `REFERENCE_GRAPH_LIMIT_EXCEEDED` diagnostic. Missing, malformed,
wrong-context, or cyclic records are never repaired, skipped, or treated as
lineage roots. This is a bounded relationship-integrity check, not a general
graph engine or lifecycle evaluator.

## 7. E. B08 Durable Row and Mapping Contract

### 7.1 ROW-04 physical contract

| Property | Exact value |
| --- | --- |
| Row identifier | `ROW-04` |
| Store identity | `k334.store.authority_evidence.v1` |
| Store name | `authority_evidence` |
| Key path | `["namespaceKey","evidenceId"]` |
| Key order | `namespaceKey`, then `evidenceId` |
| `autoIncrement` | `false` |
| Row discriminator | `rowType="k334_physical_authority_evidence_row_v1"` |
| Row version | `rowVersion=1` |
| Canonical discriminator | `canonicalKind="authority_evidence"` |
| Canonical version | `canonicalVersion=1` |

The row has exactly these required own fields in this logical order:

| Physical field | Exact source/type | Reconstruction and equality |
| --- | --- | --- |
| `rowType` | fixed physical discriminator | structural only |
| `rowVersion` | numeric literal `1` | physical schema only |
| `canonicalKind` | literal `authority_evidence` | equals decoded envelope kind |
| `canonicalVersion` | numeric literal `1` | equals decoded envelope version |
| `recordId` | decoded canonical envelope | exact envelope identity |
| `canonicalDigest` | decoded canonical envelope | exact envelope digest and C08 source |
| `repositoryNamespace` | decoded canonical payload | context equality |
| `namespaceKey` | decoded canonical payload; key component 1 | context/key equality |
| `canonicalBytes` | structured-clone `Uint8Array` | sole durable semantic payload |
| `recordedAt` | exact `RecordedAt` | storage-only; retained on retry |
| `evidenceId` | exact alias of `recordId`; key component 2 | alias/key equality |
| `subjectId` | exact decoded payload projection | C11/C12 source |
| `issuerId` | exact decoded payload projection | C09 source |
| `lineageId` | exact decoded payload projection | C11 source |
| `predecessorRecordId` | exact decoded payload projection, including `null` | C10 and relationship source |
| `supersedesRecordId` | exact decoded payload projection, including `null` | relationship source |
| `action` | exact decoded literal `grant` | direct canonical projection |
| `lifecycleStatus` | exact decoded lifecycle literal | C12 source; no inferred role |
| `effectiveSequence` | exact decoded boundary sequence | C11 source |
| `compatibilityTupleId` | exact decoded tuple reference | relationship validation source |

Every field is required. Nullable canonical projections are present with
explicit `null`; IndexedDB mechanically creates no C10 entry for a null
predecessor, which has no semantic effect. Provenance,
`boundary.effectiveAfterRecordId`, and `boundary.prospectiveOnly` remain
losslessly inside `canonicalBytes` and are revalidated on every read.

`evidenceRole`, `rejected`, payload duplicates, decoded payload objects,
termination fields, winner/current flags, approval fields, applicability
fields, policy caches, audit fields, operation keys, extension bags, and all
unlisted fields are prohibited.

Validation must:

1. require the request key to equal
   `[row.namespaceKey,row.evidenceId]`;
2. decode `canonicalBytes` with `decodeK334CanonicalRecordBytes`;
3. require byte-identical re-encoding with `encodeK334CanonicalRecord`;
4. require canonical kind/version, ID/digest, repository/namespace, aliases,
   and every flat projection to equal the decoded values exactly;
5. revalidate all canonical payload fields, boundary, references, tuple, and
   provenance;
6. require exactly one `B08_LIFECYCLE_REFERENCE_MATRIX_V1` row and position
   branch;
7. resolve every required reference and validate direction, target family and
   version, subject/issuer/context equality, sequence, self-link absence, and
   bounded cycle absence;
8. treat distinct same-position candidates as a blocking competitor set rather
   than choosing by index or arrival order;
9. validate the storage-only timestamp; and
10. reject every missing, unknown, unsupported, mismatched, contradictory,
    dangling, cyclic, or corrupt value.

Reconstruction is exactly the decoded K-334D3 canonical record.
Discriminators, aliases, projections, and `recordedAt` add no semantic field.

### 7.2 MAP-04 complete mapping

| Semantic source | Physical destination | Transformation | Reverse reconstruction |
| --- | --- | --- | --- |
| envelope kind | `canonicalKind` | exact copy | verify against decoded bytes |
| envelope version | `canonicalVersion` | numeric exact | verify |
| envelope `recordId` | `recordId`; `evidenceId`; key component 2 | exact copy and alias | identity comes from canonical bytes |
| envelope `canonicalDigest` | `canonicalDigest` | exact copy | digest comes from canonical bytes |
| full canonical envelope | `canonicalBytes` | exact K-334D3 encoding | strict decode reconstructs all semantics |
| payload `repositoryNamespace` | same field; validation context | exact copy | from canonical bytes |
| payload `namespaceKey` | same field; key component 1 | exact copy | from canonical bytes |
| payload `subjectId` | same field | exact copy | from canonical bytes |
| payload `issuerId` | same field | exact copy | from canonical bytes |
| payload `lineageId` | same field | exact copy | from canonical bytes |
| payload `predecessorRecordId` | same field | exact copy including `null` | from canonical bytes |
| payload `supersedesRecordId` | same field | exact copy including `null` | from canonical bytes |
| payload `action` | same field | exact copy; must be `grant` | from canonical bytes |
| payload `lifecycleStatus` | same field | exact copy | from canonical bytes |
| payload `boundary.effectiveSequence` | `effectiveSequence` | exact numeric copy | from canonical bytes |
| payload `compatibilityTupleId` | same field | exact copy | from canonical bytes |
| remaining boundary and provenance fields | `canonicalBytes` only | canonical K-334D3 encoding | strict decode restores all fields |
| absence of a semantic role | no `evidenceRole` field | no transformation | no role reconstructed or inferred |
| physical family | `rowType`; `rowVersion` | fixed literals | verification only |
| insertion metadata | `recordedAt` | assigned once | no semantic output |

MAP-04 is total and lossless. It neither drops a canonical field nor turns a
flat projection into semantic authority. Reconstruction alone is insufficient
for acceptance: the reconstructed record must also pass the complete Section
6.3 lifecycle, reference, equality, sequence, self-link, and cycle validation.

## 8. F. B07/B08 Cross-Contract Relationship

`NO_B07_B08_CROSS_RECORD_AUTHORITY_V1`

B07 does not contain `evidenceId`, B08 does not contain `auditEventId`, and
neither obtains semantic authority from the other. A B07 `recordId` may
reference a B08 `evidenceId`, but the reference:

- creates no reverse semantic edge;
- changes no B08 field, lifecycle, status, applicability, or authority;
- does not make audit presence proof of evidence acceptance or effect;
- does not make evidence presence proof of an audit event outside a required
  pair; and
- never permits either missing record to be inferred or synthesized.

This authority rule coexists with the distinct integrity rule
`REQUIRED_EVIDENCE_AUDIT_ATOMIC_INTEGRITY_V1`: approved governing operations
such as T01 and the required-pair branch of T35 require the exact B08 evidence
and exact B07 audit event to satisfy the following atomic pair contract.

### 8.1 EVIDENCE_AUDIT_ATOMIC_PAIR_V1

For every governing operation classified by approved authority as requiring an
evidence/audit pair, one exact B08 evidence record `E`, one exact B07 audit
event `A`, and one exact pair operation identity must validate and commit in one
native IndexedDB transaction. The only stores in that transaction are
`authority_evidence` and `authority_audit_events`; K-334C3 T01/T35 approves no
third control store, and this package invents none. If these stores cannot share
one native transaction, the required-pair operation is prohibited in v1.

The atomic outcome is exactly one of:

1. both absent, both inserted, and both durably accepted at commit;
2. both already present with exact authoritative content, producing a no-write
   retry; or
3. transaction abort with neither member newly accepted.

An evidence-only or audit-only durable state is invalid. Discovery of one
member without the other is corruption requiring bounded manual intervention;
the missing member is never silently synthesized.

### 8.2 Pair operation identity

The governing operation identity is

`"eap:v1:" + sha256(pairOperationPreimageBytes)`

under the exact outer domain
`absinthe:k334:evidence-audit-atomic-pair:v1:operation-id`, version `1`, bound
exactly once with the accepted K-334 canonical scalar/ordered-pair framing.
`sha256` is the exact lowercase 64-hexadecimal `Sha256` output.
`pairOperationPreimageBytes` contains exactly these fields in order:

1. `recordType` = `evidence_audit_atomic_pair_v1`;
2. `recordSchemaVersion` = `1`;
3. `repositoryNamespace`;
4. `namespaceKey`;
5. `governingOperation`, exactly
   `t01_insert_authority_evidence` or
   `t35_record_required_authority_evidence_audit`;
6. `evidenceId`;
7. `evidenceCanonicalDigest`;
8. `auditEventId`;
9. `auditEventKind` = `recorded`;
10. `auditEventSequence`;
11. `auditCanonicalDigest`;
12. `auditSourceDigest`;
13. `auditRecorderId`;
14. `auditContextCode`;
15. `evidenceProvenanceSourceKind`;
16. `evidenceProvenanceSourceRecordId`;
17. `evidenceProvenanceSourceDigest`; and
18. `evidenceProvenanceRecorderId`.

The context code is fixed by the operation:
`t01_authority_evidence` for T01 and
`t35_required_evidence_audit` for the required-pair T35 branch. The pair
requires `A.recordId===E.evidenceId===E.recordId`,
`A.sourceDigest===E.canonicalDigest`, and
`A.recorderId===E.provenance.recorderId`. Every remaining preimage field must
equal its decoded E/A or governing-operation source exactly.

The exact sequence-reuse domain is
`(repositoryNamespace,namespaceKey,governingOperation,evidenceId,recorded)`.
Within that domain one `eventSequence` binds exactly one audit event and pair
operation identity. Reusing the sequence with another audit ID, digest,
recorder, context, or operation preimage fails closed. Sequence values may
repeat only in a different exact domain; no cross-domain ordering or authority
is inferred.

The pair operation ID is a deterministic operation key, not a new semantic
field or durable row. It is verified from the exact operation preimage and is
reconstructible from the two durable members plus the fixed governing
operation/context. It need not be stored separately when the complete pair is
strictly decoded and the exact operation preimage is reconstructed. No
implementation may substitute a clock, generated sequence, scan order, or
alternate operation identity. If any preimage component cannot be reconstructed
from the durable pair and the restart-reproducible governing input below, the
operation fails closed rather than guessing.

### 8.2.1 Restart-safe evidence-first pair rediscovery

For a T01/T35 retry, the minimum restart-reproducible governing input is the
exact repository namespace, namespace key, governing-operation discriminator,
fixed operation context code, and the complete authoritative B08 governing
input sufficient to reconstruct and strictly validate the exact canonical
evidence record. That reconstruction deterministically supplies the exact
`evidenceId`/`recordId`, evidence canonical digest, and four-field evidence
provenance, including the recorder identity. The restarted caller does not need
to retain an `eap` value, audit event ID, event sequence, or an original audit
preimage.

Before any event-sequence allocation, audit-event-ID construction, or pair
insertion, the operation must:

1. reconstruct and strictly validate the exact B08 canonical evidence from
   that governing input;
2. derive its exact `evidenceId`/`recordId` and canonical digest;
3. read `authority_evidence` by the approved primary key
   `[namespaceKey,evidenceId]`;
4. search `authority_audit_events` only through the approved direct C01
   `by_record` index at `[namespaceKey,evidenceId]`;
5. strictly decode every returned B07 candidate and retain only a candidate
   whose event kind is `recorded`, source digest equals the reconstructed
   evidence canonical digest, repository namespace and namespace key equal the
   governing input, recorder equals evidence provenance recorder, context code
   is the exact fixed governing-operation context, and target-integrity rules
   identify the same evidence record; and
6. classify evidence and retained audit candidates exactly as follows.

| Result | Exact condition | Required result |
| --- | --- | --- |
| Case 0 | Evidence absent and matching audit absent | `PAIR_NOT_COMMITTED`; only then may the governing operation obtain its approved durable event sequence for initial pair creation. |
| Case 1 | Exact evidence present and exactly one matching audit present | `EXACT_PAIR_ALREADY_COMMITTED`; validate the complete pair, reconstruct `eap`, and return both members as a no-write retry. |
| Case 2 | Evidence present and matching audit absent | `PARTIAL_PAIR_CORRUPTION`; fail closed and require bounded manual intervention. |
| Case 3 | Evidence absent and one or more matching audits present | `PARTIAL_PAIR_CORRUPTION`; fail closed and require bounded manual intervention. |
| Case 4 | More than one matching audit candidate | `AMBIGUOUS_OR_DUPLICATE_PAIR_CORRUPTION`; fail closed without selecting by sequence, timestamp, index order, or arrival order. |
| Case 5 | Evidence or audit candidate exists but any authoritative pair field conflicts | `PAIR_CONTENT_CONFLICT`; fail closed. |

No other result is implementation-selectable. For Case 1, the one audit row
must contain a positive safe-integer event sequence; its audit event ID must
recompute from `recordId`, `recorded`, and that sequence; the complete pair
preimage and `eap:v1:<sha256>` must recompute; and all pair bindings must
validate. The persisted sequence is reused and no new sequence is allocated.
For Case 0, the sequence comes only from the approved governing durable
operation, is bound before insertion, and is never generated by B07. Completion
of the pair makes it recoverable through this same evidence-primary-key and
`by_record` procedure.

### 8.3 Atomic creation and postcondition

The governing operation must:

1. perform Section 8.2.1 rediscovery before allocating a sequence or
   constructing an audit identity;
2. return a Case 1 exact pair without writes and fail closed for Cases 2--5;
3. for Case 0 only, obtain the governing operation's approved durable sequence,
   construct and strictly validate the corrected B07 durable-recording
   assertion, and validate the pair preimage, operation ID,
   identity/digest/provenance/recorder/context equality, and operation-stable
   sequence;
4. open one readwrite transaction over exactly
   `authority_evidence` and `authority_audit_events`;
5. repeat the Section 8.2.1 evidence-primary-key and `by_record` discovery in
   that transaction, before inserting, and reject any result other than Case 0;
6. insert E and A inside that transaction; and
7. commit only when the complete pair postcondition holds.

After commit, the exact evidence and audit rows both exist; both reconstruct the
same pair operation identity; the audit `recordId` names the exact evidence;
the audit source digest, recorder, sequence, and context equal the pair
contract; and both rows remain independently valid and immutable. Neither
record is reconstructed from the other, and pair durability grants no
additional semantic authority, acceptance, applicability, lifecycle effect,
runtime authority, or production eligibility.

### 8.4 Uncertain commit and pair retry

After an uncertain commit, the caller reruns Section 8.2.1 from the
restart-reproducible governing input. It must rediscover before it allocates an
event sequence, constructs an audit event ID, or inserts either member. Case 1
is a no-write success retaining both original `recordedAt` values and the one
persisted sequence. Cases 2--5 fail closed; the missing member is never
synthesized and a competing-session-style conflict check after allocating a new
identity is insufficient.

This section specifies a proposed integrity contract only. It authorizes no
reader, writer, transaction implementation, descriptor, store installation, or
runtime consumer.

## 9. Canonical Bytes, IDs, and Digests

| Family | K-334D3 `canonicalBytes` | Canonical/process ID | Preimage bytes | Digest | Storage-only |
| --- | --- | --- | --- | --- | --- |
| B07 audit event | absent and prohibited | exact process composite `dae:v1:<recordId>:recorded:<eventSequence>` | required `auditPreimageBytes` under the audit process frame | `canonicalDigest` under `absinthe:k334:audit-event:v1:canonical-digest` | `recordedAt` |
| B08 authority evidence | required exact K-334D3 bytes | exact K-334D3 `dar:v1:authority-evidence:<sha256>` | embedded in K-334D3 canonical encoding; no second process preimage field | exact K-334D3 `canonicalDigest` | `recordedAt` |

B07 does not receive a fabricated K-334D3 wrapper. B08 does not receive a
second digest, physical digest alias, role digest, or audit preimage.
Storage-only metadata is excluded from semantic identity, bytes, digest,
ordering, status, and authority for both families.

Any digest mismatch, non-canonical re-encoding, same identity with different
authoritative bytes, or physical alias/projection mismatch is an immutable
integrity conflict. No collision is resolved by arrival time or overwrite.

## 10. H. Conflict, Retry, and Fail-Closed Rules

### 10.1 B07 exact retry

`SAME_AUDIT_EVENT_CONTENT_RETRY_NO_OP_V1` requires rediscovery by exact
`[namespaceKey,auditEventId]` before insertion. It compares every semantic and
structural field, the exact preimage bytes, recomputed digest, request key,
repository/namespace context, discriminator, and versions. If identical, it
returns or preserves the existing row without a write and retains its original
`recordedAt`.

The event sequence is supplied, not generated; B07 has no general allocator.
An isolated non-paired caller that cannot reproduce the exact sequence has no
valid retry. A same composite with different fields/preimage/digest, or a
different composite presented as the same operation, fails closed. For a
required E/A pair, Section 8's evidence-first rediscovery and
operation-stable-sequence rules take precedence: retry must first classify the
durable pair through E primary key and B07 `by_record`, then recover and reuse
the one exact persisted sequence or fail closed before any new identity is
allocated.

### 10.2 B08 exact retry

`SAME_AUTHORITY_EVIDENCE_CONTENT_RETRY_NO_OP_V1` requires rediscovery by exact
`[namespaceKey,evidenceId]`. It compares exact canonical bytes, ID, digest,
aliases, projections, primary key, repository/namespace, discriminators,
versions, lifecycle matrix row, relationships, boundary, tuple, provenance,
reference targets, context equality, sequence, and bounded cycle result.
Identical content is a no-op retaining the original `recordedAt`.

Different canonical bytes, ID/digest, alias, projection, reference, status,
boundary, tuple, provenance, key, or context for one evidence identity is an
immutable conflict. A second valid canonical identity remains a distinct
record; no winner is selected. Distinct incompatible evidence at one lifecycle
position, a duplicate sequence competitor, changed or missing reference target,
contradictory direction, self-link, or introduced cycle blocks lifecycle use
and is routed to the separately authorized conflict/fork boundary. An existing
row is never mutated to advance lifecycle. Required E/A pairs additionally use
the Section 8 pair retry.

For both families, malformed persisted `recordedAt` is corruption. It is not
repaired, regenerated, or used to make content idempotent. Last-write-wins,
merge, replacement, normalization, silent deletion, and automatic repair are
prohibited.

## 11. G. Index and Shared-Constraint Bindings

### 11.1 B07 index bindings

| Identity | Owner/name | Key path | `unique` / `multiEntry` | Direct source and purpose |
| --- | --- | --- | --- | --- |
| `k334.index.authority_audit_events.by_record.v1` | `authority_audit_events` / `by_record` | `["namespaceKey","recordId"]` | `false` / `false` | direct row fields; non-authoritative record audit lookup |
| `k334.index.authority_audit_events.by_source_digest.v1` | `authority_audit_events` / `by_source_digest` | `["namespaceKey","sourceDigest"]` | `false` / `false` | direct row fields; non-authoritative source audit lookup |

C03 receives the exact disposition
`EXPLICIT_VERSIONED_INDEX_REMOVAL_V1`. The identity
`k334.index.authority_audit_events.by_subject.v1`, index name `by_subject`, and
every alternate subject index are absent from the B07 v1 descriptor set and
must not be installed. ROW-17 contains no `subjectId`. A future direct subject
source requires a new reviewed row and index version; it cannot alter v1.

### 11.2 B08 index bindings

| Identity | Owner/name | Key path | `unique` / `multiEntry` | Direct source and purpose |
| --- | --- | --- | --- | --- |
| `k334.index.authority_evidence.by_digest.v1` | `authority_evidence` / `by_digest` | `["namespaceKey","canonicalDigest"]` | `true` / `false` | direct row fields; integrity/idempotency lookup |
| `k334.index.authority_evidence.by_issuer.v1` | `authority_evidence` / `by_issuer` | `["namespaceKey","issuerId"]` | `false` / `false` | direct row fields; audit/policy validation lookup |
| `k334.index.authority_evidence.by_predecessor.v1` | `authority_evidence` / `by_predecessor` | `["namespaceKey","predecessorRecordId"]` | `false` / `false` | direct row fields; competitor/reference lookup |
| `k334.index.authority_evidence.by_subject_lineage_sequence.v1` | `authority_evidence` / `by_subject_lineage_sequence` | `["namespaceKey","subjectId","lineageId","effectiveSequence"]` | `false` / `false` | direct row fields; all candidates at one logical position |
| `k334.index.authority_evidence.by_subject_status.v1` | `authority_evidence` / `by_subject_status` | `["namespaceKey","subjectId","lifecycleStatus"]` | `false` / `false` | direct row fields; non-authoritative validation lookup |

All indexes are declarative, non-authoritative, and uninstalled. Index presence
or a lookup result never proves validity, status effect, acceptance, winner,
applicability, or eligibility.

### 11.3 Shared-constraint bindings

| Constraint | B07/B08 minimal-v1 binding |
| --- | --- |
| Store identity/name coherence | Each stable store identity maps one-to-one to its exact store name and family; no family shares a row discriminator. |
| Key ordering | `namespaceKey` is first and the exact family identity is second; both stores use `autoIncrement=false`. |
| Family/store/mapping coherence | B07/ROW-17/MAP-17 remains process audit; B08/ROW-04/MAP-04 remains canonical authority evidence. No cross-family reconstruction is valid. |
| SC-04 index completeness | B07 v1 has exactly C01 and C02; C03 is explicitly removed for v1. No unspecified B07 index remains. This resolves only the B07 portion and accepts no global descriptor. |
| SC-06 discrimination | B07 requires row/record discriminators and forbids canonical-kind fields. B08 requires row and canonical discriminators. Store presence never supplies a missing discriminator. |
| SC-08 identity/digest/reconstruction | B07 key, composite, preimage, digest, and context agree exactly. B08 key, `evidenceId===recordId`, bytes, digest, projections, and context agree exactly. Reconstruction is lossless. |
| SC-11 lifecycle/relationships | B08 must match exactly one Section 6.3 matrix row, including exact predecessor lifecycle-status compatibility and terminality; predecessor/supersedes direction, target family/version, exact context equality, sequence, missing-reference, self-link, bounded-cycle, and canonical logical-position competitor rules are mandatory. `B08_LOGICAL_POSITION_V1` is repository context plus `[namespaceKey,subjectId,lineageId,effectiveSequence]`; issuer, compatibility, boundary, and status differences are competitor content, never winner selection. Termination effect remains a separate canonical reference and no role, winner, or effect is inferred. This proposes only B08's portion and accepts no global constraint. |
| SC-13 audit subject mapping | B07 v1 contains no subject field and explicitly removes the subject index. Referenced records cannot supply a subject. |
| Provenance | B07 retains its approved audit-specific `sourceDigest`/`recorderId` fields; B08 retains the complete canonical four-field provenance in canonical bytes. Neither fabricates the other form. |
| Repository/namespace/scope | Every row, key, bytes/preimage, reference validation, and caller context must agree exactly. Cross-namespace or cross-repository reuse fails. |
| External references | B07 validates target existence and exact target-family integrity while granting no target semantics. B08 predecessor/supersedes references resolve and validate under Section 6.3; tuple and separate termination references remain exact and cannot be inferred. |
| Evidence/audit/policy separation | Audit cannot substitute for evidence; evidence cannot substitute for policy; status and presence cannot grant effect. |
| Required evidence/audit integrity | `EVIDENCE_AUDIT_ATOMIC_PAIR_V1` and `REQUIRED_EVIDENCE_AUDIT_ATOMIC_INTEGRITY_V1` bind required T01/T35 E/A durability, pair operation identity, postcondition, and evidence-primary-key plus B07 `by_record` rediscovery without merging semantic authority. Zero, exact, partial, duplicate, and conflicting outcomes are fixed before allocation. |
| Audit meaning and sequence | B07 asserts `REFERENCED_RECORD_DURABLY_RECORDED_V1`; a required pair binds its caller-supplied sequence to the governing operation, recovers it only from one exact persisted audit after rediscovery, and never allocates before rediscovery or on retry. |
| Retry/idempotency | Exact isolated content is a no-op retaining metadata; a required pair is a no-op only when evidence-first discovery yields both exact members and reconstructed `eap`. Partial, duplicate, conflicting, cyclic, or competing content never overwrites, repairs, or selects a winner. |

No global shared constraint, descriptor, transaction implementation, writer, or
schema installation is accepted by this proposal.

## 12. Data-Safety and Authority Invariants

1. No malformed, partial, unknown-version, or extra-field row is valid.
2. No missing authoritative reference is inferred or manufactured.
3. No conflicting record silently replaces another.
4. No exact retry creates duplicate authority or replaces storage metadata.
5. No index or row presence grants semantic authority.
6. No lifecycle field grants runtime or production eligibility.
7. No evidence record grants the authority it merely records.
8. B07 may validate only the target existence and integrity required by its
   governing operation; it never semantically accepts, activates, mutates,
   terminates, or supersedes the referenced record.
9. No audit subject is inferred; C03 is absent from v1.
10. No B08 evidence role is inferred from action, status, predecessor,
    timestamp, key, index, or store presence.
11. No unsupported `rejected` value is normalized to another status.
12. No external mapping becomes canonical identity through either family.
13. No canonical bytes, process preimage, digest, ID, relationship, or
    storage-only value may substitute for another.
14. No destructive cleanup, repair, deletion, migration, recovery, or
    projection mutation is authorized.
15. Corruption, ambiguity, missing evidence, and reference mismatch fail
    closed and require quarantine, block, or manual resolution.
16. A required evidence/audit pair commits atomically or not at all; a partial
    pair is corruption and is never repaired by synthesizing the missing row.
17. Every B08 row matches exactly one lifecycle matrix row; contradictory,
    dangling, self-linked, cyclic, or context-incompatible relationships fail
    closed.
18. A required-pair retry rediscovery precedes sequence allocation and audit-ID
    construction; zero, exact, partial, duplicate, and conflicting candidates
    have only the Section 8.2.1 outcomes.
19. A B08 lifecycle continuation requires the exact predecessor status selected
    by its matrix row; terminal `unsupported` and `malformed` states never
    re-enter normal v1 progression.
20. B08 logical-position candidates compete within exact repository context at
    `[namespaceKey,subjectId,lineageId,effectiveSequence]`; no issuer,
    compatibility, boundary, status, order, or timestamp selects a winner.

## 13. I. Reusability Boundary

Reusable mechanisms are limited to strict scalar and tuple decoders,
exact-object validators, primary-key/context equality checks, reference
equality verifiers, canonical bytes/ID/digest verifiers, process-preimage
verifiers, immutable same-content retry comparators, declarative store/index
descriptors, reconstruction checks, bounded diagnostics, and
corruption/quarantine outcomes.

Domain-specific and not reusable as generic policy are B07/B08 meanings,
identifiers, event/status vocabularies, fields, provenance meaning, lifecycle,
stores, mappings, index sets, subject-index removal, evidence-role
disposition, reference boundaries, and the K-334 authority lifecycle. This
document creates no reusable implementation package.

## 14. Explicitly Unsupported v1 Features

Unsupported features are additional audit event kinds, generated audit
sequences, audit payloads, arbitrary context objects, audit subject inference,
the C03 subject index, mutable/deletable audit history, independent evidence
roles, a `rejected` evidence status, embedded termination state, automatic
lifecycle inference, winner selection, generalized policy engines, arbitrary
graph traversal, dependency solving, sync orchestration, migration execution,
recovery execution, background cleanup, runtime activation, admission,
eligibility, and production behavior.

## 15. J. Final Descriptor-Prerequisite Readiness Impact

This package proposes complete minimal-v1 values for ROW-17/MAP-17/C03 and
ROW-04/MAP-04 plus the B07/B08 portions of their shared constraints. It does
not accept those values.

Current effect:

- B01–B06 remain accepted and unchanged.
- B07 and B08 remain unaccepted.
- the descriptor-authority prerequisite remains unaccepted and blocked from
  relying on these proposed values;
- descriptor implementation authority remains zero;
- effective D0-P09 execution authority remains zero; and
- runtime and production authority remain zero.

If and only if one future combined B07/B08 review passes and a separate
acceptance/archive action accepts both exact contracts:

- B01–B08 authority inputs would be resolved;
- the descriptor-authority prerequisite could become eligible for a separate
  amendment or replacement and independent acceptance review;
- descriptor implementation authority would still remain `0/0`;
- effective D0-P09 execution authority would still remain `0`;
- D0-P09 execution/satisfaction would remain `0/0`; and
- runtime and production authority would remain zero.

This task does not amend, accept, stage, or commit K-334P09P and does not alter
the blocked D0-P09 authorization document.

## 16. B07–B08 Readiness

| Area | Readiness item | Result |
| --- | --- | --- |
| B07 | ownership and meaning | `READY_FOR_REVIEW` |
| B07 | referenced-record durable-recording assertion | `READY_FOR_REVIEW` |
| B07 | identity | `READY_FOR_REVIEW` |
| B07 | fields and scalar contracts | `READY_FOR_REVIEW` |
| B07 | lifecycle | `READY_FOR_REVIEW` |
| B07 | provenance | `READY_FOR_REVIEW` |
| B07 | bytes/digest boundary | `READY_FOR_REVIEW` |
| B07 | durable row | `READY_FOR_REVIEW` |
| B07 | complete mapping | `READY_FOR_REVIEW` |
| B07 | indexes | `READY_FOR_REVIEW` |
| B07 | shared constraints | `READY_FOR_REVIEW` |
| B07 | retry/conflict behavior | `READY_FOR_REVIEW` |
| B08 | ownership and meaning | `READY_FOR_REVIEW` |
| B08 | identity | `READY_FOR_REVIEW` |
| B08 | fields and scalar contracts | `READY_FOR_REVIEW` |
| B08 | lifecycle | `READY_FOR_REVIEW` |
| B08 | exhaustive lifecycle/reference matrix | `READY_FOR_REVIEW` |
| B08 | provenance | `READY_FOR_REVIEW` |
| B08 | bytes/digest boundary | `READY_FOR_REVIEW` |
| B08 | durable row | `READY_FOR_REVIEW` |
| B08 | complete mapping | `READY_FOR_REVIEW` |
| B08 | indexes | `READY_FOR_REVIEW` |
| B08 | shared constraints | `READY_FOR_REVIEW` |
| B08 | retry/conflict behavior | `READY_FOR_REVIEW` |
| Combined | combination decision | `READY_FOR_REVIEW` |
| Combined | cross-contract relationship | `READY_FOR_REVIEW` |
| Combined | required evidence/audit atomic pair | `READY_FOR_REVIEW` |
| Combined | data-safety invariants | `READY_FOR_REVIEW` |
| Combined | reusable boundary | `READY_FOR_REVIEW` |
| Combined | final descriptor-prerequisite impact | `READY_FOR_REVIEW` |

`PACKAGE_READY_FOR_SINGLE_ARCHITECTURE_REVIEW`

## 17. Authority State

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 1
- B01 authority resolution accepted: 1
- B02 authority resolution accepted: 1
- B03 authority resolution accepted: 1
- B04 authority resolution accepted: 1
- B05 authority resolution accepted: 1
- B06 authority resolution accepted: 1
- B07–B08 final package proposed: 1
- B07 authority resolution accepted: 0
- B08 authority resolution accepted: 0
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
