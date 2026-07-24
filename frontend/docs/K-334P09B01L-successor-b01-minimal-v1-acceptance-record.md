# K-334P09B01L Successor B01 Minimal-v1 Acceptance Record

## 1. Record identity and binding

| Field | Value |
| --- | --- |
| Type | `K334SuccessorB01MinimalV1AcceptanceRecord` |
| ID | `K-334P09B01L-SUCCESSOR-B01-ACCEPTANCE-001` |
| Status | `B01_MINIMAL_V1_AUTHORITY_ACCEPTED` |
| Effective authority | `ACCEPTED_B01_SEMANTIC_AND_PHYSICAL_CONTRACTS_NO_IMPLEMENTATION_AUTHORITY` |
| Bound package | `K-334P09B01J-MINIMAL-V1-SUBJECT-PACKAGE-001` |
| Bound architecture review | `K-334P09B01K` / `PASS` |
| Bound deferred proposal | `K-334P09B01-SUBJECT-ROW-AUTHORITY-001` |
| Bound deferred acceptance | `K-334P09B01G-SUBJECT-ROW-DEFERRED-ACCEPTANCE-001` |

This record supersedes only B01's deferred state because the previously missing semantic and physical inputs are now reviewed and accepted. It does not supersede, amend, resolve, or authorize any unrelated blocker.

## 2. Accepted semantic contract

| Property | Accepted value |
| --- | --- |
| Semantic kind | `authority_subject_registration_v1` |
| Semantic version | integer literal `1` |
| Semantic identity | `["authority_subject_registration_v1", namespaceKey, subjectId]` |
| Required fields | `semanticKind`, `semanticVersion`, `repositoryNamespace`, `namespaceKey`, `subjectId`, `provenance` |
| Cardinality | one immutable registration assertion per subject slot |

The semantic object is exact: all fields are required, unknown fields are rejected, scalar equality is exact, and no input is normalized. There is one immutable provenance object; it participates in semantic equality but not identity. Differing provenance for one identity is an integrity conflict and fails closed.

There are no semantic aliases, supersession, termination, deletion lifecycle, mutable lifecycle status, external-mapping content, standalone semantic digest, canonical-byte requirement, optional extension bag, or runtime state.

`repositoryNamespace` is accepted as a required semantic validation field and required persisted ROW-01 field. It is excluded from canonical subject identity and must equal the exact repository validation context. A mismatch for one semantic identity is an integrity conflict.

## 3. Accepted ROW-01 contract

| Property | Accepted value |
| --- | --- |
| Store identity | `k334.store.authority_subjects.v1` |
| Store name | `authority_subjects` |
| Key path | `["namespaceKey","subjectId"]` |
| `autoIncrement` | `false` |
| Own fields | `repositoryNamespace`, `namespaceKey`, `subjectId`, `rowVersion`, `provenance` |
| Row version | exact integer `1` |

ROW-01 is one canonical immutable subject-registration row. There is no separate discriminator field; this accepted rule depends on the dedicated `authority_subjects` store, exact `rowVersion=1`, strict complete-object validation, and unknown-field rejection.

`row.namespaceKey` must exactly equal primary-key component one, and `row.subjectId` must exactly equal primary-key component two. Any mismatch fails closed.

ROW-01 has no `rowType`, `recordId`, aliases, alias fields, lifecycle fields, supersession, termination, deletion state, external provider or identifier fields, canonical bytes, canonical digest, digest projections, timestamps outside provenance, storage metadata, or extension fields.

## 4. Accepted MAP-01

MAP-01 is total and lossless.

| Semantic value | Physical destination |
| --- | --- |
| `repositoryNamespace` | `row.repositoryNamespace` |
| `namespaceKey` | `row.namespaceKey`, then primary-key component one |
| `subjectId` | `row.subjectId`, then primary-key component two |
| semantic version `1` | `row.rowVersion` equal to `1` |
| `provenance` | `row.provenance` |
| fixed semantic kind | no row field; exact fixed reconstruction from dedicated store and row version |

Mapping performs no normalization, defaulting, aliasing, hashing, metadata insertion, or lossy omission. Reconstruction and equality are exact, every mismatch fails closed, and every physical row field has the accepted source above.

## 5. Accepted C35 binding

| Property | Value |
| --- | --- |
| Identity | `k334.index.authority_subjects.by_subject_namespace.v1` |
| Owner | `authority_subjects` |
| Key path | `["namespaceKey","subjectId"]` |
| `unique` | `true` |
| `multiEntry` | `false` |
| Source | direct own ROW-01 `namespaceKey` and `subjectId` fields |
| Purpose | non-authoritative lookup |

Primary-key duplication is intentional and structurally required. C35 creates no independent semantic authority and cannot differ from the primary key. It is ready for later descriptor implementation but is not installed by this record.

## 6. Accepted B01 portions of SC-06 and SC-08

### SC-06

Only the B01 portion is accepted: no separate discriminator; dedicated-store identity; exact `rowVersion=1`; strict complete-object validation; unknown-field rejection; and fail-closed unsupported versions. This does not resolve SC-06 for B02 through B08 or mark global SC-06 accepted.

### SC-08

Only the B01 portion is accepted. The semantic identity is `["authority_subject_registration_v1", namespaceKey, subjectId]`; the physical store slot is `[namespaceKey, subjectId]`; and physical row identity is the dedicated store, exact physical key, and `rowVersion=1`.

`repositoryNamespace` is an equality and integrity-validation field rather than an identity component. Provenance is required for semantic equality, not identity. Reconstruction is exact, differing valid semantic content for one identity fails closed, and row presence grants no independent authority effect. Semantic aliases, physical aliases, semantic/physical digests, and canonical bytes are absent.

This does not resolve SC-08 for unrelated record families or mark global SC-08 accepted.

## 7. Accepted unsupported-input policy and reusability boundary

`UNSUPPORTED_OR_MALFORMED_INPUT` is accepted for B01 inputs: unknown fields, malformed scalars, unsupported row versions, key/row mismatch, alias fields, digest fields, lifecycle fields, and external-mapping content. It means fail closed; reject or quarantine; preserve recoverable material where technically available; do not mutate accepted canonical state; return one bounded structured diagnostic; and require a future schema version for newly supported semantics.

The intended reusable mechanism boundary is strict scalar decoding, exact-object validation, unknown-field rejection, declarative store/index descriptors, key/row equality verification, reconstruction verification, bounded fail-closed results, and corruption/quarantine result types.

Absinthe-specific contracts remain subject registration meaning, repository and namespace semantics, provenance meaning, `authority_subjects`, ROW-01, MAP-01, C35, B01, and the K-334 lifecycle. This acceptance creates no reusable package; extraction remains deferred until implementation stabilizes.

## 8. B01 closure effect and non-advancement

This record advances:

- Combined B01 minimal-v1 package accepted: 0 → 1
- B01 authority resolution accepted: 0 → 1
- ROW-01 contract accepted: 0 → 1
- MAP-01 contract accepted: 0 → 1
- C35 B01 binding accepted: 0 → 1
- SC-06 B01 portion accepted: 0 → 1
- SC-08 B01 portion accepted: 0 → 1

B01 is authority-resolved but not implemented.

This record does not advance B02 through B08, global SC-06 or SC-08, descriptor-authority prerequisite acceptance, descriptor implementation authorization or implementation, D0-P09 rebound or execution, D0-P10, K-334E/F, runtime authorization, or production eligibility.

## 9. Authorization state

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 1
- B01 deferred disposition accepted: 1
- Combined B01 minimal-v1 package proposed: 1
- Combined B01 minimal-v1 package accepted: 1
- B01 authority resolution accepted: 1
- ROW-01 contract accepted: 1
- MAP-01 contract accepted: 1
- C35 B01 binding accepted: 1
- SC-06 B01 portion accepted: 1
- SC-08 B01 portion accepted: 1
- B02–B08 authority resolution accepted: 0/7
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

No implementation, descriptor installation, source code, migration, recovery, runtime, proof, or production behavior is authorized by this record.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
