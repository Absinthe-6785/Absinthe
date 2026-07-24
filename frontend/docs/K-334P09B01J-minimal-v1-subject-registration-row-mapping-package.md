# K-334P09B01J Minimal-v1 Subject Registration and Row Mapping Package

## 1. Package identity

| Field | Value |
| --- | --- |
| Type | `K334MinimalV1SubjectRegistrationAndRowMappingPackage` |
| ID | `K-334P09B01J-MINIMAL-V1-SUBJECT-PACKAGE-001` |
| Status | `MINIMAL_V1_SUBJECT_PACKAGE_PROPOSED` |
| Effective authority | `PROPOSAL_ONLY_NO_IMPLEMENTATION_AUTHORITY` |
| Bound deferred proposal | `K-334P09B01-SUBJECT-ROW-AUTHORITY-001` |
| Bound deferred acceptance | `K-334P09B01G-SUBJECT-ROW-DEFERRED-ACCEPTANCE-001` |
| Semantic contract | `K334CanonicalSubjectRegistrationSemanticAuthorityV1` |
| Dependent physical contract | `K334SubjectDurableRowMappingAuthorityV1` |

This is one architecture-review package with two logically separate normative
contracts. Section A defines the semantic contract first. Section B depends
exclusively on Section A and may not add semantic content. The package proposes
both contracts for review; it accepts neither contract, does not accept B01,
and grants no implementation or execution authority.

## 2. Common minimal-v1 policy

Only the fields and behavior defined below exist in v1. Optional extension
bags, unknown fields, aliases, supersession, termination, mutable lifecycle,
multiple provenance entries, embedded external mappings, and future-version
interpretation do not exist.

`UNSUPPORTED_OR_MALFORMED_INPUT` is the single policy for every unknown field,
unknown kind, unsupported version, malformed scalar, missing field, extra
field, invalid object shape, key/row mismatch, reconstruction mismatch, and
unsupported rare case:

1. fail closed;
2. do not install, replace, repair, or mutate canonical state;
3. preserve the original recoverable input outside canonical state when
   technically available;
4. return one bounded structured diagnostic whose code is
   `UNSUPPORTED_OR_MALFORMED_INPUT` and whose context identifies only the
   operation and bounded field/category, never payload data; and
5. require an explicitly reviewed future schema version before newly supported
   semantics can be interpreted.

No implementation may normalize an input into validity or select a fallback.

## 3. Fixed approved inputs

| Item | Fixed value |
| --- | --- |
| Store identity | `k334.store.authority_subjects.v1` |
| Store name | `authority_subjects` |
| Key path | `["namespaceKey","subjectId"]` |
| Key order | `namespaceKey`, then `subjectId` |
| `autoIncrement` | `false` |
| `subjectId` | `^[a-z][a-z0-9_.:-]{2,255}$`; 3–256 lowercase ASCII characters; exact equality; no normalization; null/omission rejected |
| `namespaceKey` | `^[a-f0-9]{64}$`; exactly 64 lowercase hexadecimal characters; exact equality; no normalization; null/omission rejected |
| C35 identity | `k334.index.authority_subjects.by_subject_namespace.v1` |
| C35 owner/key | `authority_subjects`; `["namespaceKey","subjectId"]` |
| C35 flags | `unique=true`; `multiEntry=false`; non-authoritative |

`repositoryNamespace` remains a required repository/record validation boundary.
Its v1 scalar is the existing exact string contract:
`^absinthe\.installation\.[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`, 24 through
128 ASCII characters. It is preserved exactly and is neither normalized nor a
component of the canonical subject-registration identity.

# A. Canonical Subject Registration Semantic Contract

## 4. Semantic assertion and identity

Exactly one explicit immutable semantic assertion exists per exact subject
slot.

| Property | Minimal-v1 decision |
| --- | --- |
| Semantic authority name | `K334CanonicalSubjectRegistrationSemanticAuthorityV1` |
| Semantic kind literal | `authority_subject_registration_v1` |
| Semantic version | integer literal `1` |
| Canonical identity | typed ordered composite `["authority_subject_registration_v1", namespaceKey, subjectId]` |
| Cardinality | at most one assertion for an exact canonical identity |
| Authority effect | existence alone grants none |

The identity binds the exact validated `namespaceKey` and `subjectId`.
`repositoryNamespace` is required validation context for the assertion and its
durable row, but is not an identity component, alias, digest component, or
substitute for `namespaceKey`.

A repeated canonical identity with field-for-field identical semantic content
is the same assertion and is idempotent. The same canonical identity with any
different semantic field is an integrity conflict and fails closed; it is
never an update, replacement, successor, or second registration.

## 5. Exact semantic fields

The semantic assertion is an exact object with these fields in this normative
logical order:

1. `semanticKind`: literal `authority_subject_registration_v1`;
2. `semanticVersion`: integer literal `1`;
3. `repositoryNamespace`: exact validated repository boundary;
4. `namespaceKey`: exact validated 64-lowercase-hex namespace key;
5. `subjectId`: exact validated opaque subject identifier; and
6. `provenance`: the exact creation-provenance object in Section 6.

All six fields are required. Null is prohibited except for the explicitly
nullable `provenance.sourceRecordId`. Unknown, optional, metadata, timestamp,
lifecycle, external-reference, alias, and extension fields are prohibited.
The assertion must be a plain exact object (ordinary or null prototype) whose
required properties are enumerable own data properties; accessors, symbols,
non-enumerable fields, inherited fields, and exotic prototypes fail closed.

## 6. Creation provenance

There is exactly one immutable creation-provenance object. It means: the exact
validated source classification and source evidence from which this subject
registration was recorded, plus the exact recorder identity that performed
that recording. It is evidence of creation origin only; it is not an issuer,
grant, external mapping, policy, or authority effect.

The object has exactly these required enumerable own data properties in this
logical order:

1. `sourceKind`: exactly one of `k333_codec`, `owner_evidence`, `legacy`, or
   `migration`;
2. `sourceRecordId`: either `null` or a strict identifier matching
   `^[a-z][a-z0-9_.:-]{2,255}$`; `null` explicitly asserts that the source has
   no independently addressable source record;
3. `sourceDigest`: the SHA-256 digest represented as exactly 64 lowercase
   hexadecimal characters matching `^[a-f0-9]{64}$`, identifying the
   preserved source material that justified creation; and
4. `recorderId`: strict opaque identifier matching
   `^[a-z][a-z0-9_.:-]{2,255}$`.

All strings are preserved exactly. No trimming, case conversion, Unicode
normalization, alternate digest notation, defaulting, or inferred recorder is
permitted. No additional provenance object, chain, variant, predecessor, or
supersession exists in v1.

Provenance is part of semantic content and therefore participates in exact
semantic equality and conflict detection. It does not create a standalone
identity or digest. Because v1 defines neither standalone semantic canonical
bytes nor a semantic digest, provenance contributes to neither; no
implementation may invent one.

## 7. Canonicalization, validation, and reconstruction

Canonicalization is strict validation plus exact-value preservation. It does
not transform input. A successfully decoded semantic assertion is represented
in the fixed logical field order in Sections 5 and 6, with the exact accepted
scalar values.

Semantic equality is exact field-by-field equality across all fields, including
the four provenance fields. Object property insertion order is not semantic.
Reconstruction succeeds only when every reconstructed field validates and is
exactly equal to the semantic value defined here.

There is no standalone semantic digest and no standalone canonical-bytes
artifact in v1. No digest domain, record ID, byte field, or content-addressed
subject identity is introduced. This is consistent with the approved rule that
`subjectId` remains an opaque namespace-bound identity rather than a K-334
content-addressed record ID. Conflict verification uses the exact decoded
semantic fields, not a digest surrogate.

## 8. Semantic lifecycle and external boundary

The assertion is immutable and retained. V1 has no semantic aliases,
supersession, termination, mutable status, deletion, merge, split, or
replacement. A future version must define any such semantics separately.

The assertion contains no external-mapping reference or content.
`authority_external_mappings` remains the sole authority for provider,
external namespace, external identifier, mapping status, predecessor,
supersession, termination, and external-to-internal association. Neither an
external mapping nor a subject row proves the other.

# B. Durable ROW-01 Mapping Contract

## 9. Dependency and row category

`K334SubjectDurableRowMappingAuthorityV1` is valid for review only as a
dependent mapping of the exact Section A contract. It cannot be accepted before
Section A is independently accepted, and it cannot modify, omit, or invent
semantic content. Acceptance of Section A alone does not accept or authorize
any Section B schema choice.

The row category is `canonical immutable subject-registration row`. It lives
only in the dedicated `authority_subjects` store. Its physical identity is
exactly the IndexedDB primary-key tuple `[namespaceKey, subjectId]`. There is
no separate `recordId` or row identity.

## 10. Exact ROW-01 representation

ROW-01 is an exact object with these five and only these five required
enumerable own data properties in this logical schema order:

1. `repositoryNamespace`: exact validated repository boundary;
2. `namespaceKey`: exact validated first primary-key component;
3. `subjectId`: exact validated second primary-key component;
4. `rowVersion`: integer literal `1`; and
5. `provenance`: an exact nested object with, in order,
   `sourceKind`, `sourceRecordId`, `sourceDigest`, and `recorderId`, using the
   exact Section 6 types and validation.

All top-level and nested fields are required. Null is prohibited except for
`provenance.sourceRecordId`. Unknown fields, aliases, lifecycle fields,
timestamps, metadata, external provider/identifier fields, canonical bytes,
digest fields, projections, and optional extension fields are prohibited.

The row and nested provenance object must each be an ordinary or null-prototype
exact object with enumerable own data properties. Accessors, symbols,
non-enumerable properties, inherited properties, arrays, and exotic prototypes
fail closed.

## 11. Version, SC-06, and physical validation

The B01 portion of SC-06 selects the explicit no-discriminator rule. ROW-01 has
no `rowType`, `recordType`, `kind`, or other discriminator field. This is safe
because all four conditions are mandatory:

1. ROW-01 exists only in the dedicated `authority_subjects` store;
2. `rowVersion` must equal integer literal `1`;
3. the complete top-level and nested objects are strictly validated; and
4. every unknown field is rejected.

`rowVersion` selects the physical decoding schema only. It grants no semantic,
lifecycle, acceptance, or authority effect. A missing, non-integer, zero,
negative, or unknown version uses `UNSUPPORTED_OR_MALFORMED_INPUT`.

The IndexedDB request key and the row's own fields must satisfy:

`requestKey[0] === row.namespaceKey` and
`requestKey[1] === row.subjectId`.

The key must have exactly two components in that order. Any contradiction,
normalization requirement, or malformed component fails closed.

## 12. Physical bytes, digests, and corruption

ROW-01 stores no canonical-bytes field, semantic digest, row digest, projection
digest, `recordId`, or byte cache. No such value is derived during mapping.

Physical corruption exists when any of these is true:

- the stored value is not the exact ROW-01 object;
- a required field is absent or an unknown field is present;
- a scalar, provenance value, or `rowVersion` is invalid;
- the physical key and own key fields differ;
- reconstruction does not produce the exact Section A assertion; or
- an existing exact physical identity has different decoded semantic content.

Corruption never triggers normalization, overwrite, deletion, automatic
repair, or acceptance of one candidate. The original recoverable row is
preserved when technically available and canonical use fails closed.

## 13. Complete MAP-01

| Semantic source | Physical destination | Transformation | Validation | Reconstruction | Equality | Failure |
| --- | --- | --- | --- | --- | --- | --- |
| fixed `semanticKind="authority_subject_registration_v1"` | no row field | omit fixed constant | Section A literal | inject fixed constant after exact store/row validation | reconstructed literal exact | common fail-closed policy |
| `semanticVersion=1` | `rowVersion` | rename only | exact integer literal `1` | rename to `semanticVersion` | exact integer equality | common fail-closed policy |
| `repositoryNamespace` validation context | `repositoryNamespace` | none | exact repository-namespace grammar and length | copy exactly | exact string equality | common fail-closed policy |
| `namespaceKey` | `namespaceKey`; key component 1 | none | exact 64 lowercase hex; row/key match | copy exactly | exact string equality | common fail-closed policy |
| `subjectId` | `subjectId`; key component 2 | none | exact subject grammar; row/key match | copy exactly | exact string equality | common fail-closed policy |
| `provenance.sourceKind` | `provenance.sourceKind` | none | exact four-value enum | copy exactly | exact string equality | common fail-closed policy |
| `provenance.sourceRecordId` | `provenance.sourceRecordId` | none | strict identifier or explicit `null` | copy exactly | exact value equality | common fail-closed policy |
| `provenance.sourceDigest` | `provenance.sourceDigest` | none | exact 64 lowercase hex | copy exactly | exact string equality | common fail-closed policy |
| `provenance.recorderId` | `provenance.recorderId` | none | strict identifier | copy exactly | exact string equality | common fail-closed policy |

MAP-01 is total for every Section A field and context value. It performs no
normalization, aliasing, defaulting, inference, digesting, metadata addition,
or lossy omission. Physical acceptance alone cannot resolve B01; the package
and a separately reviewed successor B01 resolution must both be accepted.

## 14. C35 binding

C35 is a required structural duplicate of the primary key:

- its sources are the direct own fields `namespaceKey` and `subjectId`;
- those fields exactly equal primary-key components one and two;
- its key path is `["namespaceKey","subjectId"]`;
- `unique=true` detects duplicate physical projections but creates no semantic
  identity or authority; and
- `multiEntry=false`.

C35 becomes design-complete here but is not installable until this package and
the separately reviewed successor B01 resolution are accepted. This task does
not install it.

## 15. SC-08 resolution for B01

The B01 portion of SC-08 is resolved by these exact relationships:

| Concept | Exact v1 relationship |
| --- | --- |
| Semantic registration identity | `["authority_subject_registration_v1", namespaceKey, subjectId]` |
| Physical slot and row identity | `[namespaceKey, subjectId]`; no separate row ID |
| `repositoryNamespace` | required persisted validation boundary; not an identity component |
| Semantic aliases | unsupported |
| Physical aliases | absent |
| Canonical bytes | absent |
| Semantic/physical digest | absent |
| Provenance | one semantic creation-provenance object embedded losslessly as one physical object |
| Reconstruction | total MAP-01; exact field equality required |
| Conflict | same identity/slot with different semantic content is corruption and blocks use |
| Authority effect | row presence alone grants none |

This resolution defines no mutation, update, deletion, transaction,
concurrency, migration, recovery, or runtime writer behavior. SC-08 portions
outside B01 remain untouched.

## 16. Reusability boundary

Reusable storage-safety mechanisms are:

- strict scalar and enum decoding;
- exact-object validation with unknown-field rejection;
- declarative store, key-path, and index descriptors;
- request-key/row-field equality verification;
- field-by-field reconstruction verification;
- the bounded `UNSUPPORTED_OR_MALFORMED_INPUT` result;
- corruption/quarantine-style outcomes that preserve recoverable input; and
- an optional canonical encoder interface for other record families that
  actually require canonical bytes.

Absinthe-specific domain semantics are:

- the meaning and identity of subject registration;
- `repositoryNamespace` and `namespaceKey` roles;
- the creation-provenance meaning and accepted source classes;
- `authority_subjects`, ROW-01, MAP-01, C35, B01, and the K-334 lifecycle.

No shared package or abstraction is created now. Extraction is intentionally
deferred until implementation identifies at least two real consumers or an
already proven reusable mechanism. The subject contract must not be hidden
behind a generic event, identity, or authority abstraction.

## 17. Explicitly unsupported v1 features

V1 does not support aliases or alias migration; supersession; termination;
subject deletion; merge or split; multiple provenance records; provenance
graphs; external identity content or lifecycle; optional external references;
future-version compatibility; generic event sourcing; CRDT behavior; sync
conflict resolution; migration sessions; checkpoints; recovery markers; audit
events; evidence envelopes; application/runtime state; mutable status;
timestamps; storage metadata; canonical-byte storage; or digest projections.

Every appearance of such input uses `UNSUPPORTED_OR_MALFORMED_INPUT`. Support
requires a separately authorized future version.

## 18. Successor B01 readiness

| Review item | State |
| --- | --- |
| Semantic contract completeness | `READY_FOR_REVIEW` |
| ROW-01 completeness | `READY_FOR_REVIEW` |
| MAP-01 completeness | `READY_FOR_REVIEW` |
| C35 binding | `READY_FOR_REVIEW` |
| SC-06 B01 portion | `READY_FOR_REVIEW` |
| SC-08 B01 portion | `READY_FOR_REVIEW` |
| Provenance | `READY_FOR_REVIEW` |
| External-reference boundary | `READY_FOR_REVIEW` |
| Reusable-core boundary | `READY_FOR_REVIEW` |

`PACKAGE_READY_FOR_SINGLE_ARCHITECTURE_REVIEW`

This readiness statement does not accept either contract or B01 and does not
authorize implementation.

## 19. Authorization state

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 1
- B01 deferred disposition accepted: 1
- B01 authority resolution accepted: 0
- Combined B01 minimal-v1 package proposed: 1
- Combined B01 minimal-v1 package accepted: 0
- Successor B01 resolution accepted: 0
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
