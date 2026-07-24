# K-334P09B03A — Minimal-v1 Compatibility Authority and Durable Row Package

## 1. Package identity and authority boundary

| Property | Value |
| --- | --- |
| Type | `K334MinimalV1CompatibilityAuthorityAndRowPackage` |
| ID | `K-334P09B03A-MINIMAL-V1-COMPATIBILITY-PACKAGE-001` |
| Status | `MINIMAL_V1_COMPATIBILITY_PACKAGE_PROPOSED` |
| Effective authority | `PROPOSAL_ONLY_NO_IMPLEMENTATION_AUTHORITY` |
| Bound blocker | `B03` / `K334CompatibilityTupleLifecyclePhysicalAuthorityV1` |
| Semantic contract | `K334CanonicalExactCompatibilityTupleV1` |
| Lifecycle contract | `IMMUTABLE_DIRECT_COMPATIBILITY_V1` |
| Durable row | `ROW-07` / `K334CompatibilityTupleDurableRowV1` |
| Mapping | `MAP-07` |
| Indexes | `C04`, `C05` |

This single package proposes, but does not accept, the complete B03 semantic,
lifecycle, physical-row, mapping, index, and B03-only shared-constraint
contract. Sections A through E are normative and ordered: the lifecycle and
physical contracts depend on the semantic contract, MAP-07 depends on all
three, and the indexes and shared-constraint bindings depend on MAP-07.

This package creates no compatibility tuple instance, installs no store or
index, changes no descriptor, and authorizes no implementation, transaction,
migration, recovery, runtime evaluation, eligibility, activation, or
production behavior.

## 2. Unified minimal-v1 policy

`UNSUPPORTED_OR_MALFORMED_INPUT` is the one B03 failure policy. It means:

1. fail closed;
2. reject or quarantine;
3. preserve recoverable material where technically available;
4. do not mutate accepted canonical state;
5. emit one bounded structured diagnostic without raw payload, stack, cause,
   namespace value, or unbounded message; and
6. require a future reviewed schema version before newly supported semantics
   can be recognized.

Unknown fields, unsupported versions, invalid scalar values, relationship
mismatches, prohibited lifecycle material, ranges, wildcards, aliases, and
unrecognized compatibility expressions all use this policy. No malformed input
is normalized, defaulted, repaired, partially accepted, or converted to a
different tuple.

## 3. Approved source audit

Tests, fixtures, runtime objects, naming conventions, unused prototypes, and
the unaccepted K-334P09P proposal were inspected only as negative or
cross-checking evidence. They are not authority for this package.

| Source fact | Classification | Exact conclusion |
| --- | --- | --- |
| K334B-D09-A and K334C2-D02-B | `EXPLICIT_APPROVED_AUTHORITY` | Compatibility is an explicit owner-reviewed allowlist of immutable complete exact tuples; no range, wildcard, Cartesian expansion, decoder inference, or runtime inference is permitted. |
| K334C2 prospective policy | `EXPLICIT_APPROVED_AUTHORITY` | A newly listed tuple affects future applicability only. It does not rewrite historical accepted or rejected evidence. |
| K334C2 no-inheritance rule | `EXPLICIT_APPROVED_AUTHORITY` | No generation inherits compatibility, authority, mapping, lifecycle, or history. |
| K334C3 compatibility entity | `EXPLICIT_APPROVED_AUTHORITY` | Store is `authority_compatibility_tuples`; key is `["namespaceKey","tupleId"]`; `autoIncrement=false`; the store is canonical append-only policy evidence. |
| K334C3 compatibility tuple | `EXPLICIT_APPROVED_AUTHORITY` | The tuple has ten ordered dimensions: `authorityProtocolVersion`, `authorityRecordSchemaVersion`, `manifestEvidenceVersion`, `subjectNamespace`, `issuerNamespace`, `compatibilityPolicyVersion`, `installationNamespace`, `action`, `sourceClass`, and `migrationEpoch`. |
| K334C3 exact-tuple index | `EXPLICIT_APPROVED_AUTHORITY` | `by_exact_tuple` uses `["namespaceKey","tupleDigest"]`, `unique=true`, `multiEntry=false`. |
| K334C3 status index plus K334P09T/X C05 disposition | `EXPLICIT_APPROVED_AUTHORITY` | `by_tuple_status` uses `["namespaceKey","lifecycleStatus"]`, `unique=false`, `multiEntry=false`; its physical status source remains B03-owned. |
| K-334D3 compatibility canonical record | `EXPLICIT_APPROVED_AUTHORITY` | Kind is `compatibility_tuple`, envelope version is `1`, record type is `authority_compatibility_tuple_v1`, record ID prefix is `dat:v1:`, and canonical identity/digest domains are fixed. |
| K-334D3 tuple validation | `EXPLICIT_APPROVED_AUTHORITY` | Four version values equal numeric `1`; namespaces, action, source class, migration epoch, boundary, provenance, repository namespace, and namespace key use strict existing validators. |
| K-334D3 installation binding | `EXPLICIT_APPROVED_AUTHORITY` | `installationNamespace` equals `repositoryNamespace` byte-for-byte. |
| K-334D3 tuple lifecycle fields | `NOT_FOUND` | The canonical compatibility tuple contains no `lifecycleStatus`, predecessor, supersession, or termination field. |
| K-334D3 termination target | `EXPLICIT_APPROVED_AUTHORITY` | A separate canonical termination may target a `compatibility_tuple` by its exact `dat:v1:` record ID. |
| K334P09T/X B03 deferral | `EXPLICIT_APPROVED_AUTHORITY` | B03 must close ROW-07, MAP-07, aliases, lifecycle representation, null/omission rules, C05, and the B03 portions of SC-06, SC-08, and SC-11 together. |
| `tupleId=recordId`, `tupleDigest=canonicalDigest` | `DERIVED_WITHOUT_INTERPRETATION` | The physical aliases copy already authoritative K-334D3 envelope identity and digest exactly. |
| Dedicated row/store discriminator | `PARTIAL_AUTHORITY` | The common physical strategy requires strict family discrimination; the exact ROW-07 literal is a B03 choice. |
| Mutable tuple lifecycle or embedded supersession | `NOT_FOUND` | No approved semantic source can support either in ROW-07. |
| `IMMUTABLE_DIRECT_COMPATIBILITY_V1` and fixed row status `recorded` | `NEW_MINIMAL_V1_DECISION` | The row preserves the immutable tuple and exposes only its recorded-evidence category; applicability remains a separate future evaluation. |
| C04/C05 descriptor identities | `NEW_MINIMAL_V1_DECISION` | Exact stable identifiers are fixed below without relying on unaccepted K-334P09P content. |

The approved tuple dimensions do not describe a generic directed graph edge.
Accordingly, B03 does not invent source and target artifact fields. The exact
evaluated combination is the source of a match operation; the immutable
allowlist tuple record is its target. The only relationship is exact membership
matching defined below.

## 4. A. Canonical Compatibility Semantic Contract

### 4.1 Kind, version, and exact meaning

| Property | Normative value |
| --- | --- |
| Semantic kind | `compatibility_tuple` |
| Record type | `authority_compatibility_tuple_v1` |
| Semantic/envelope version | `1` |
| Relationship | `EXACT_ALLOWLIST_TUPLE_MATCH_V1` |
| Direct meaning | An evaluated combination is listed by this tuple only when all ten ordered dimensions equal the tuple values exactly and the repository/namespace and prospective-boundary validations also succeed. |
| Does not mean | interpretation permission, replacement, coexistence, predecessor status, migration permission, activation, admission, eligibility, or production authority |

The match is directional: an evaluated input combination is compared to one
stored tuple. A stored tuple is not compared “back” to create a second
relationship. The relation is neither symmetric nor transitive, and no reverse
edge exists. Two partial matches cannot be combined. Matching tuple A and tuple
B separately creates no A-to-B relationship.

The source identity for evaluation is the complete ordered ten-component
combination plus its exact repository and namespace validation context. The
target identity is the exact tuple record identified by `tupleId`. Source and
target are not interchangeable physical fields. The tuple is an allowlist
membership assertion, not an artifact-to-artifact compatibility edge.

### 4.2 Canonical identity and equality

The canonical identity is the K-334D3 `recordId`:

```text
dat:v1:<64 lowercase hexadecimal SHA-256 characters>
```

It is derived under:

```text
absinthe:k334:compatibility-tuple:v1:tuple-id
```

from the fixed K-334D3 ordered preimage. `tupleId` is an exact physical alias
for this `recordId`. Semantic equality requires:

- the same canonical identity;
- byte-identical canonical bytes;
- the same canonical digest;
- exact equality of all ten tuple dimensions, boundary values, and provenance;
- exact repository and namespace bindings.

The canonical digest uses:

```text
absinthe:k334:compatibility-tuple:v1:canonical-digest
```

and is aliased physically as `tupleDigest`. Same identity and byte-identical
content is idempotent. Same identity with different bytes or digest is an
integrity conflict. A different identity is a different tuple even when some
dimensions match.

### 4.3 Tuple components

All fields are required, non-null, and contribute to canonical identity unless
the table states validation-context behavior. No component is normalized.

| Order | Component | Type and grammar | Meaning | Equality | Identity | Physical destination |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `authorityProtocolVersion` | numeric literal `1` | exact authority protocol version | numeric exact | yes | canonical bytes only |
| 2 | `authorityRecordSchemaVersion` | numeric literal `1` | exact authority record schema version | numeric exact | yes | canonical bytes only |
| 3 | `manifestEvidenceVersion` | numeric literal `1` | exact manifest-evidence version | numeric exact | yes | canonical bytes only |
| 4 | `subjectNamespace` | `subject.` plus strict lowercase identifier segment; 8–128 ASCII bytes | exact subject namespace dimension | byte-for-byte | yes | canonical bytes only |
| 5 | `issuerNamespace` | `issuer.` plus strict lowercase identifier segment; 8–128 ASCII bytes | exact issuer namespace dimension | byte-for-byte | yes | canonical bytes only |
| 6 | `compatibilityPolicyVersion` | numeric literal `1` | exact compatibility policy version | numeric exact | yes | canonical bytes only |
| 7 | `installationNamespace` | strict `absinthe.installation.<identifier>`; 24–128 ASCII bytes; must equal `repositoryNamespace` | exact installation/repository binding | byte-for-byte | yes | canonical bytes only |
| 8 | `action` | one of `grant`, `revoke`, `supersede`, `terminate` | exact authority action dimension | byte-for-byte literal | yes | canonical bytes only |
| 9 | `sourceClass` | one of `k333_codec`, `owner_evidence`, `legacy`, `migration` | exact source classification dimension | byte-for-byte literal | yes | canonical bytes only |
| 10 | `migrationEpoch` | positive safe integer; no zero, negative, fraction, unsafe integer, or negative zero | exact migration epoch dimension | numeric exact | yes | canonical bytes only |

`repositoryNamespace` is a required semantic field with the same strict grammar
as `installationNamespace`, and the two values must be byte-identical.
`namespaceKey` is a required 64-character lowercase hexadecimal namespace
fingerprint. Both participate in the canonical preimage and physical validation
context. The physical key's first component is the exact `namespaceKey`.

The tuple cannot encode ambiguous source/target ordering because it has no
source/target edge fields. “Self-compatibility” is therefore not a
representable relation and is prohibited as an interpretation. Exact matching
of an input combination to the tuple itself is the intended membership
operation, not a self-edge.

### 4.4 Boundary

The three required boundary fields remain inside canonical bytes:

| Field | Rule |
| --- | --- |
| `boundary.effectiveSequence` | positive safe integer |
| `boundary.effectiveAfterRecordId` | exact supported K-334 record ID or explicit `null` |
| `boundary.prospectiveOnly` | literal `true` |

The boundary records prospective semantics only. This package defines no
evaluation algorithm, sequence advancement, ordering transaction, or
historical rewrite.

### 4.5 Provenance

The required immutable provenance object is represented by the four fixed
K-334D3 payload paths:

| Field | Validation and meaning |
| --- | --- |
| `provenance.sourceKind` | exact `SourceClass` literal; identifies the class of evidence from which the tuple assertion was recorded |
| `provenance.sourceRecordId` | strict identifier or explicit `null`; identifies the exact source record when one exists |
| `provenance.sourceDigest` | 64 lowercase hexadecimal SHA-256 characters; binds source material |
| `provenance.recorderId` | strict lowercase identifier segment; identifies the recorder |

Provenance participates in semantic equality, canonical bytes, record identity,
and digest because K-334D3 already includes it in both preimages. It does not
change any tuple dimension and does not create a second compatibility identity.
ROW-07 stores it only inside `canonicalBytes`; no flattened duplicate object is
permitted. Reconstruction recovers it by strict canonical decode.

Differing provenance produces different canonical bytes and therefore a
different valid identity when correctly encoded. A purported same identity
with different provenance is corruption. No provenance chain, history graph,
or inferred owner approval is created.

### 4.6 Version and range boundary

`NO_VERSION_RANGE_LANGUAGE_V1` is normative. Every version dimension is the
exact numeric literal `1`. Wildcards, semantic-version strings, ranges,
open-ended intervals, dependency expressions, Boolean expressions,
prerelease rules, future-version inference, and numeric coercion are
unsupported.

### 4.7 Canonical bytes and digest

K-334D3 already requires canonical bytes, record identity, and canonical
digest; therefore B03 cannot select the generic no-digest default.

- `canonicalBytes` is the only durable semantic payload.
- Bytes are structured-clone `Uint8Array`, never base64, hex, JSON text, or a
  platform string.
- Strict decoding, byte-identical re-encoding, record ID verification, and
  canonical digest verification are mandatory.
- No second semantic payload, standalone projection digest, signature input,
  or additional content-addressing scheme is introduced.

## 5. B. Minimal Compatibility Lifecycle Contract

The lifecycle is `IMMUTABLE_DIRECT_COMPATIBILITY_V1`.

ROW-07 represents one immutable, recorded direct tuple assertion. Its exact
physical `lifecycleStatus` is the fixed literal `recorded`. This status means
only that a strictly validated tuple row is recorded in the dedicated store. It
does not mean approved, accepted, applicable, active, terminated, eligible, or
production-ready.

The canonical tuple has no predecessor, supersession, termination, or mutable
lifecycle field. Consequently:

- `predecessorRecordId`, `supersedesRecordId`, and embedded
  `terminationRecordId` are prohibited ROW-07 fields;
- tuple mutation and automatic supersession are prohibited;
- a new exact tuple is a new immutable record, never a mutation of an existing
  tuple;
- a separate canonical termination record may target the exact compatibility
  tuple ID because K-334D3 already permits target kind `compatibility_tuple`;
- no termination state is copied into or inferred from ROW-07;
- termination absence proves no active or non-terminated state;
- termination evaluation, supersession evaluation, winner selection, and
  effective-policy computation remain outside B03 and are not authorized.

This explicitly resolves the separate-lifecycle-record relationship: immutable
tuple content stays in ROW-07; lifecycle evidence, when separately authorized
and present, stays in its canonical store and refers to `tupleId`. There is no
mutable row projection of cross-record lifecycle. The fixed `recorded` value is
not derived from external lifecycle evidence and cannot outrank it.

The only permitted ROW-07 lifecycle transition is creation of the immutable
recorded row. There is no in-row transition. Exact retry is idempotent;
different bytes at the same key conflict. Unsupported lifecycle fields use
`UNSUPPORTED_OR_MALFORMED_INPUT`.

## 6. C. Durable Compatibility Row Contract

### 6.1 Store and key

| Property | Normative value |
| --- | --- |
| Row category | dedicated immutable compatibility tuple row |
| Store identity | `k334.store.authority_compatibility_tuples.v1` |
| Store name | `authority_compatibility_tuples` |
| Primary key path | `["namespaceKey","tupleId"]` |
| Key order | namespace first, tuple identity second |
| `autoIncrement` | `false` |
| Row version | numeric literal `1` |
| Family discriminator | `rowType="k334_physical_compatibility_tuple_row_v1"` |
| Canonical discriminator | `canonicalKind="compatibility_tuple"` |

### 6.2 Exact own-field inventory

Every listed field is required and non-null. Every unlisted field is
prohibited.

| Field | Exact type/source |
| --- | --- |
| `rowType` | literal `k334_physical_compatibility_tuple_row_v1` |
| `rowVersion` | numeric literal `1` |
| `canonicalKind` | literal `compatibility_tuple` |
| `canonicalVersion` | numeric literal `1` |
| `recordId` | strictly decoded K-334D3 `dat:v1:` identity |
| `canonicalDigest` | 64 lowercase hexadecimal K-334D3 digest |
| `repositoryNamespace` | exact decoded canonical payload value |
| `namespaceKey` | exact decoded canonical payload value |
| `canonicalBytes` | structured-clone `Uint8Array`; exact K-334D3 bytes |
| `recordedAt` | strict UTC metadata timestamp under the accepted common physical strategy; non-authoritative |
| `tupleId` | exact alias of `recordId` |
| `tupleDigest` | exact alias of `canonicalDigest` |
| `lifecycleStatus` | fixed literal `recorded` |

No tuple dimension is flattened because C04 uses the exact canonical digest and
K-334D3 canonical bytes reconstruct all dimensions without loss. There is no
provenance field outside `canonicalBytes`, no predecessor, supersedes,
termination, range, alias set, external reference, feature bag, migration
plan, runtime flag, evidence payload, audit payload, storage metadata beyond
`recordedAt`, or duplicate decoded payload.

`recordedAt` must use the accepted common strict UTC representation. It is
assigned exactly once during the initial successful durable insertion and the
persisted value is retained unchanged for the lifetime of the row. It is
excluded from canonical identity, canonical semantic equality,
`canonicalBytes`, `recordId`, `canonicalDigest`, `tupleDigest`, ordering,
lifecycle, compatibility, and authority. It cannot make different canonical
content idempotent and cannot choose a winner.

### 6.3 Key, row, and reconstruction rules

Validation must:

1. require the physical key to equal `[row.namespaceKey,row.tupleId]`;
2. strict-decode `canonicalBytes` as K-334D3 kind `compatibility_tuple`,
   version `1`;
3. require byte-identical canonical re-encoding;
4. require `canonicalKind`, `canonicalVersion`, `recordId`,
   `canonicalDigest`, `repositoryNamespace`, and `namespaceKey` to equal the
   decoded envelope values exactly;
5. require `tupleId===recordId` and `tupleDigest===canonicalDigest`;
6. require `lifecycleStatus==="recorded"`;
7. require persisted `recordedAt` to satisfy the strict UTC metadata grammar;
8. revalidate all semantic fields, boundary fields, provenance fields,
   identity, and digest;
9. reject every unknown or missing field.

Reconstruction is exactly the strict-decoded K-334D3 canonical record. Physical
discriminators, aliases, `recordedAt`, and fixed `lifecycleStatus` are verified
structural representation and are not added to the reconstructed semantic
payload.

`SAME_CANONICAL_CONTENT_RETRY_NO_OP_V1` is normative. A retry is idempotent
when the existing row and incoming canonical content have the same
`canonicalBytes`, `recordId`, `canonicalDigest`, `tupleId`, `tupleDigest`,
`repositoryNamespace`, `namespaceKey`, `rowType`, `rowVersion`,
`canonicalKind`, `canonicalVersion`, `lifecycleStatus`, required bindings, and
primary-key fields. The existing row is returned or preserved without a write.
Its persisted `recordedAt` is retained, never regenerated or replaced, and is
not compared with a newly generated retry timestamp.

The persisted `recordedAt` remains required and strictly validated when a row
is read. A missing, malformed, out-of-contract, or internally corrupted
persisted value fails closed. A mismatch in any authoritative or structural
field listed above, including canonical tuple dimensions, boundary, or
provenance content within `canonicalBytes`, is an immutable integrity conflict.
Last-write-wins, repair, and row mutation during retry are prohibited.

## 7. D. Complete B03 Mapping

### 7.1 Semantic-to-physical mapping

| Semantic source | Physical destination / role | Transformation | Validation / equality | Reconstruction |
| --- | --- | --- | --- | --- |
| kind `compatibility_tuple` | `canonicalKind` | fixed exact literal | must equal decoded kind | kind comes from canonical bytes |
| envelope version `1` | `canonicalVersion` | direct | exact numeric equality | version comes from canonical bytes |
| `recordId` | `recordId`, `tupleId`, primary key component 2 | exact copy | all three byte-identical | `recordId` from canonical bytes |
| `canonicalDigest` | `canonicalDigest`, `tupleDigest`, C04 component 2 | exact copy | aliases byte-identical and digest verified | digest from canonical bytes |
| `repositoryNamespace` | `repositoryNamespace`; validation context | exact copy | exact decoded equality; equals `installationNamespace` | from canonical bytes |
| `namespaceKey` | `namespaceKey`, primary key component 1, C04/C05 component 1 | exact copy | exact decoded equality | from canonical bytes |
| ten ordered tuple dimensions | `canonicalBytes` only | canonical K-334D3 encoding | strict scalar and relationship validation | strict decode restores every field |
| boundary fields | `canonicalBytes` only | canonical K-334D3 encoding | positive sequence, exact nullable reference, literal `true` | strict decode |
| provenance fields | `canonicalBytes` only | canonical K-334D3 encoding | strict source class, nullable ID, digest, recorder | strict decode |
| semantic immutability | row conflict rule | no transformation | same identity requires same bytes | immutable record |
| semantic absence of row lifecycle | structural `lifecycleStatus="recorded"` | fixed B03 physical classification | exact literal; no semantic inference | omitted from semantic reconstruction |

### 7.2 Physical-to-semantic or structural mapping

| Physical field | Semantic source / structural purpose | Exact validation | Reconstruction effect |
| --- | --- | --- | --- |
| `rowType` | ROW-07 family discriminator | exact literal | none |
| `rowVersion` | physical schema version | exact numeric `1` | none |
| `canonicalKind` | decoded kind duplicate | exact `compatibility_tuple` | verifies kind |
| `canonicalVersion` | decoded version duplicate | exact numeric `1` | verifies version |
| `recordId` | canonical identity duplicate | exact decoded equality | verifies identity |
| `canonicalDigest` | canonical digest duplicate | exact decoded equality | verifies content |
| `repositoryNamespace` | canonical/context duplicate | exact decoded equality | verifies repository binding |
| `namespaceKey` | canonical/key duplicate | exact decoded and key equality | verifies namespace binding |
| `canonicalBytes` | sole semantic payload | strict decode and identical re-encode | reconstructs complete semantic record |
| `recordedAt` | insertion-time physical metadata; no semantic source | assigned once on initial durable insertion; strict UTC metadata grammar on persisted-row read; retained and not compared to a newly generated replay timestamp | none |
| `tupleId` | primary family alias | equals `recordId` | none |
| `tupleDigest` | C04 family alias | equals `canonicalDigest` | none |
| `lifecycleStatus` | fixed recorded-row classification for C05 | exact `recorded` | none; grants no lifecycle state |

MAP-07 is total and lossless. It performs no normalization, defaulting,
inference, direction reversal, transitive expansion, metadata insertion into
semantic content, or additional hashing. There is no implementation-selected
field.

## 8. E. Index and Shared-Constraint Bindings

### 8.1 Compatibility indexes

| Catalog / identity | Owner / name | Key path | Unique / multiEntry | Source | Purpose and authority boundary |
| --- | --- | --- | --- | --- | --- |
| C04 / `k334.index.authority_compatibility_tuples.by_exact_tuple.v1` | `authority_compatibility_tuples` / `by_exact_tuple` | `["namespaceKey","tupleDigest"]` | `true` / `false` | direct ROW-07 aliases | exact candidate lookup and same-family integrity check only |
| C05 / `k334.index.authority_compatibility_tuples.by_tuple_status.v1` | `authority_compatibility_tuples` / `by_tuple_status` | `["namespaceKey","lifecycleStatus"]` | `false` / `false` | direct namespace plus fixed ROW-07 status | non-authoritative retrieval of recorded tuple rows only |

C04 cannot prove acceptance or applicability; a digest lookup result must still
strictly validate the complete row and external authority context. C05 cannot
prove active, accepted, effective, superseded, or terminated state. Neither
index creates reverse compatibility, symmetry, transitivity, lifecycle
authority, runtime authority, or production eligibility.

Both indexes are declarative design only and remain uninstalled. The exact
store identity is `k334.store.authority_compatibility_tuples.v1`.

### 8.2 B03-only shared-constraint portions

| Constraint | B03 binding |
| --- | --- |
| `SC-01` store identity/name coherence | Store identity, name, compound key, and `autoIncrement=false` are exact and one-to-one for ROW-07. |
| `SC-03` compound-key order | `namespaceKey` is first and `tupleId` second; no alternate ordering or normalized key is valid. |
| `SC-05` family/store/mapping coherence | Compatibility semantic kind, ROW-07, `authority_compatibility_tuples`, and MAP-07 form one exact family. |
| `SC-06` durable family discrimination | Exact `rowType`, `rowVersion`, `canonicalKind`, and `canonicalVersion` are required; no family is inferred from store presence. |
| `SC-08` identity/equality/reconstruction | `tupleId===recordId`, `tupleDigest===canonicalDigest`, key fields equal row fields, bytes re-encode identically, and reconstruction is exact. |
| `SC-11` lifecycle relationships | B03 tuple rows are immutable recorded assertions; predecessor/supersedes/embedded termination are prohibited; any termination is a separate exact canonical record. SC-11 remains globally unresolved until B08 is accepted. |
| Provenance | The complete immutable provenance object is retained losslessly inside canonical bytes and reconstructed exactly. |
| Repository/namespace | Repository namespace, installation namespace, namespace key, physical key, and validation context must agree exactly. |
| External mapping separation | No external mapping content is embedded or inferred. |
| Evidence/audit separation | No evidence role, owner approval, audit event, or acceptance payload is embedded or inferred. |

No global shared constraint is accepted by this proposal. No B04 through B08
portion is proposed or accepted.

## 9. Conflict and data-safety rules

| Condition | Required result |
| --- | --- |
| same authoritative and structural content at one tuple key, with any newly generated retry timestamp | `SAME_CANONICAL_CONTENT_RETRY_NO_OP_V1`; retain and return the existing row without writing or replacing `recordedAt` |
| same key with different canonical bytes, ID/digest, alias, repository/namespace, discriminator/version, lifecycle status, binding, tuple dimension, boundary, or provenance | immutable integrity conflict; preserve evidence if possible; no overwrite |
| missing, malformed, out-of-contract, or internally corrupted persisted `recordedAt` | reject/quarantine; do not repair or replace it |
| same ten dimensions with different provenance/boundary | distinct correctly derived identity or corruption if identity is reused; never merge |
| source/target reversal request | unsupported because B03 is exact membership, not an edge |
| duplicate physical representation | same canonical/structural content is idempotent while retaining existing `recordedAt`; any authoritative or structural mismatch conflicts |
| repository, installation, namespace, key, or row mismatch | reject/quarantine |
| unknown field or missing required field | reject/quarantine |
| unsupported row, envelope, protocol, schema, manifest, or policy version | reject/quarantine |
| malformed scalar or invalid enum | reject/quarantine |
| lifecycle status other than `recorded` | reject/quarantine |
| predecessor, supersedes, embedded termination, range, wildcard, alias, or expression field | reject/quarantine |
| requested self-compatibility edge | reject as unrepresentable semantics |
| missing tuple or unlisted combination | incompatible/fail closed; decode success is insufficient |

Prohibited behavior includes last-write-wins, implicit merge,
normalization-based identity collapse, automatic reverse-edge creation,
transitive inference, graph expansion, automatic canonical repair, authority
inference from row/index presence, and mutation of accepted canonical state
after validation failure.

This package defines no runtime transaction, concurrency, migration, recovery,
repair, cleanup, or evaluation behavior.

## 10. Reusability boundary

Domain-neutral reusable mechanisms may include:

- strict fixed-order tuple decoding;
- exact directed match input-to-allowlist comparison without graph semantics;
- exact-object and unknown-field validation;
- declarative store/index descriptors;
- key/row and alias equality verification;
- canonical reconstruction verification;
- immutable-conflict and unsupported-version results;
- bounded diagnostics; and
- corruption/quarantine outcomes.

Absinthe-specific meaning remains:

- the ten compatibility dimensions and their exact semantics;
- repository, installation, subject, and issuer namespace meanings;
- `EXACT_ALLOWLIST_TUPLE_MATCH_V1`;
- K-334 provenance and prospective boundary meaning;
- `authority_compatibility_tuples`, ROW-07, MAP-07, C04, and C05;
- the separate K-334 termination relationship; and
- K-334 lifecycle, authority, admission, eligibility, and production
  boundaries.

No reusable package or generic dependency solver is created.

## 11. Explicitly unsupported v1 features

The following are unsupported:

- compatibility ranges, wildcards, semver expressions, arbitrary version
  algebra, open intervals, and Boolean expressions;
- dependency solving and transitive closure;
- symmetry, reverse-edge, or direction inference;
- compatibility graph creation or traversal;
- conditional or environment-specific compatibility;
- aliases and independent per-dimension value sets;
- mutable ROW-07 lifecycle, expiry, automatic supersession, and background
  policy transitions;
- embedded predecessor, supersession, termination, migration plans, evidence,
  audit events, or external mappings;
- a second canonical-byte representation, additional semantic digest, or
  physical digest projection beyond the exact accepted aliases;
- runtime activation, migration permission, admission, eligibility,
  production use, and sync behavior.

All unsupported fields and values use
`UNSUPPORTED_OR_MALFORMED_INPUT`.

## 12. B03 readiness

| Readiness item | State |
| --- | --- |
| compatibility semantic meaning | `READY_FOR_REVIEW` |
| source identity | `READY_FOR_REVIEW` |
| target identity | `READY_FOR_REVIEW` |
| tuple and direction | `READY_FOR_REVIEW` |
| lifecycle | `READY_FOR_REVIEW` |
| version/range boundary | `READY_FOR_REVIEW` |
| provenance | `READY_FOR_REVIEW` |
| durable row | `READY_FOR_REVIEW` |
| complete B03 mapping | `READY_FOR_REVIEW` |
| C04 exact-tuple index | `READY_FOR_REVIEW` |
| C05 tuple-status index | `READY_FOR_REVIEW` |
| B03 shared-constraint portions | `READY_FOR_REVIEW` |
| conflict/data-safety rules | `READY_FOR_REVIEW` |
| external-authority separation | `READY_FOR_REVIEW` |
| reusable-core boundary | `READY_FOR_REVIEW` |

`PACKAGE_READY_FOR_SINGLE_ARCHITECTURE_REVIEW`

## 13. Authority state

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 1
- B01 authority resolution accepted: 1
- B02 authority resolution accepted: 1
- B03 minimal-v1 package proposed: 1
- B03 authority resolution accepted: 0
- B04–B08 authority resolution accepted: 0/5
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
