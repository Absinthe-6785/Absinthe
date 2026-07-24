# K-334P09B01 Subject Durable Row Authority Resolution Proposal

## 1. Proposal identity

| Field | Value |
| --- | --- |
| Record type | `K334SubjectDurableRowAuthorityResolutionProposal` |
| Record ID | `K-334P09B01-SUBJECT-ROW-AUTHORITY-001` |
| Status | `SUBJECT_ROW_AUTHORITY_RESOLUTION_PROPOSED` |
| Effective authority | `PROPOSAL_ONLY_NO_EXECUTION_AUTHORITY` |
| Bound blocker | `B01` / `K334SubjectDurableRowAuthorityV1` |
| Bound row | `ROW-01` / `authority_subjects` |
| Bound mapping | `MAP-01` |
| Bound constraint portions | `SC-06` subject-family portion; `SC-08` subject-family portion |
| Bound archival commit | `f62b568959905f1a9e81a90afef0378be57e1b4c` |
| Bound resolution proposal | `K334PhysicalSchemaAuthorityInputResolutionProposal` / `K-334P09T-AUTHORITY-INPUT-RESOLUTION-001` |
| Bound acceptance record | `K334PhysicalSchemaAuthorityInputResolutionAcceptanceRecord` / `K-334P09X-AUTHORITY-INPUT-ACCEPTANCE-001` |
| Selected disposition | `DEFERRED_PENDING_SEPARATE_CANONICAL_SUBJECT_AUTHORITY` |

This proposal addresses only B01. It does not accept B01, ROW-01, MAP-01, or
either constraint portion. It does not resolve B02 through B08, amend or accept
K-334P09P, authorize a descriptor implementation, create descriptor authority,
rebind D0-P09, or authorize proof execution.

## 2. Governing authority and inspection result

The governing sources were inspected in this order:

1. approved K-334C3 durable-authority schema and migration design;
2. K-334D0 owner-authorized repository/codec implementation scope;
3. K-334D1 and K-334D2 implementation task and execution records;
4. merged K-334D3 canonical protocol and isolated repository primitives;
5. K-334P09P's concrete store, key, and C35 registry;
6. the archived K-334P09T B01, ROW-01, MAP-01, SC-06, and SC-08 records;
7. the archived K-334P09X deferred B01 disposition.

Tests and fixtures are corroboration only. TypeScript field names, fixture
shapes, legacy rows, runtime objects, and naming conventions create no
authority.

### 2.1 Authority that already exists

The approved sources establish all of the following:

- an authority subject is an exact authority identity;
- `subjectId` is a strict opaque, case-sensitive, namespace-bound identifier
  and not a display name, external account, or auto-increment value;
- `repositoryNamespace` mismatch rejects use;
- `namespaceKey` is the first physical key component;
- the `authority_subjects` store has primary key
  `["namespaceKey","subjectId"]` with `autoIncrement=false`;
- the subject identity is immutable, carries no authority effect merely by
  existing, and inherits no authority across a generation;
- subject creation requires validated provenance;
- the canonical subject identity is retained forever;
- a duplicate exact subject identity with different authoritative bytes is
  corruption;
- external identity is distinct from subject identity and requires explicit
  durable external-mapping evidence;
- no timestamp, arrival order, name, account, or proximity can create subject
  identity or external mapping authority.

These approved facts occupy three distinct layers:

1. `subjectId` is the approved opaque scalar identity fact. It is
   case-sensitive, namespace-bound, non-null, non-omittable, not normalized,
   and not aliasable by case folding, Unicode normalization, trimming, or an
   alternative textual representation.
2. `["namespaceKey","subjectId"]` is the approved physical repository slot.
   It is the `authority_subjects` object-store key path, ordered
   `namespaceKey` first and `subjectId` second. The slot is not a complete
   canonical subject-registration identity and is not evidence that a
   canonical registration artifact exists.
3. `repositoryNamespace` is an approved repository/record validation boundary
   wherever the governing protocol requires it. Current authority does not
   establish it as a canonical subject-identity component, a ROW-01 field, a
   digest component, or a MAP-01 identity component.

The relationship among `repositoryNamespace`, `namespaceKey`, `subjectId`, the
future semantic registration identity, and the physical ROW-01 key remains to
be defined by successor authorities. This proposal substitutes no other
canonical identity tuple.

### 2.2 Approved scalar contract

#### `subjectId`

- scalar type: string;
- exact grammar: `^[a-z][a-z0-9_.:-]{2,255}$`;
- opaque and case-sensitive;
- the exact accepted byte/code-unit representation is preserved;
- no lowercasing, uppercasing, trimming, Unicode normalization, alias
  generation, or alternative textual representation;
- null, omission, empty strings, uppercase forms, and every other value that
  fails the approved strict decoder are rejected;
- equality is exact string equality after successful strict validation.

#### `namespaceKey`

- scalar type: string;
- exact grammar: `^[a-f0-9]{64}$`;
- exactly 64 lowercase hexadecimal characters;
- uppercase or mixed-case forms are rejected rather than normalized;
- no trimming, prefix insertion or removal, alternate digest notation, alias
  generation, or alternative textual representation;
- null, omission, and every value that fails the approved strict decoder are
  rejected;
- equality is exact string equality after successful strict validation.

#### Repository validation boundary

Where applicable, `repositoryNamespace` preserves the approved decoder:
string form
`^absinthe\.installation\.[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`, with the
approved `absinthe.installation.` prefix, segment validation, and 24-to-128
byte bound. Mismatch or invalid syntax rejects use. This proposal neither
normalizes it nor establishes it as canonical subject identity, ROW-01
storage, digest input, or MAP-01 composition.

Successor semantic and physical authorities must preserve these scalar
contracts and may not redefine, normalize, alias, or weaken them.

### 2.3 Authority that does not exist

The approved sources do not establish:

- a standalone K-334 canonical subject record kind;
- a canonical subject payload or envelope;
- a subject `recordId`, record-ID domain, canonical-digest domain, or exact
  canonical byte encoding;
- whether ROW-01 is an identity-registry envelope or a canonical-record
  envelope;
- whether creation provenance is embedded as the four standard provenance
  fields, represented by a provenance digest/reference, or represented by
  another exact structure;
- the exact source artifact that is sufficient to create/register a subject;
- whether an optional external-mapping reference is embedded in ROW-01, and if
  so its cardinality, ordering, nullability, or canonical contribution;
- the exact discriminator field and literal for ROW-01;
- the exact immutable physical row identity or row/record alias relation
  beyond the compound physical slot;
- the exact row checksum/digest, `recordedAt` representation, storage-only
  metadata, null rules, omission rules, and unknown-field policy.

K-334D3 implements eleven content-addressed canonical record kinds. A
standalone subject record is not among them. Its generic strict identifier and
provenance decoders validate scalars used by existing canonical records; they
do not independently create a subject registration record or ROW-01 envelope.

## 3. Selected disposition

The selected disposition is:

`DEFERRED_PENDING_SEPARATE_CANONICAL_SUBJECT_AUTHORITY`

Options A and B are not selected:

- `SUBJECT_IDENTITY_REGISTRY_ROW_PROPOSED` would require this document to
  invent an exact row envelope, provenance representation, digest contract,
  timestamp/storage boundary, and discriminator not supplied by approved
  authority.
- `CANONICAL_SUBJECT_RECORD_PROPOSED` would extend K-334D3 semantic scope with
  a new record kind, payload, domain tags, codec, and identity/digest rules.
  That is a separate semantic-authority decision, not an implicit physical
  mapping choice.

`UNRESOLVED_FAIL_CLOSED` is not selected because the missing authority is
bounded and can be assigned to two exact, ordered successor authorities.

## 4. Exact ordered successor authorities

### 4.1 Canonical semantic authority

The first required authority is:

`K334CanonicalSubjectRegistrationSemanticAuthorityV1`

Its purpose is to define the canonical semantic subject-registration
assertion independently of IndexedDB and the physical ROW-01 representation.
It owns only:

- whether a distinct subject-registration assertion exists;
- its canonical semantic kind, identity, payload, and versioning;
- the relationship among `subjectId`, `namespaceKey`, and
  `repositoryNamespace`;
- whether semantic aliases are permitted, their exact semantic equivalence, or
  an explicit semantic no-alias rule;
- required creation-provenance semantics;
- any semantic external-reference relationship;
- semantic null and omission rules;
- canonicalization and semantic validation;
- canonical bytes or an explicit no-canonical-bytes rule;
- whether canonical semantic digest identity exists, its exact semantic domain
  and meaning, or an explicit semantic no-digest rule;
- the relationship between semantic digest identity and registration identity;
- semantic equality, conflict, and reconstruction meaning involving aliases or
  digests;
- the semantic lifecycle boundary.

It must not define object-store fields, an IndexedDB key path, a physical
discriminator, `rowType`, `rowVersion`, physical provenance or
external-reference layout, index installation, storage metadata, or physical
null/omission encoding.

### 4.2 Dependent physical mapping authority

The second required authority is:

`K334SubjectDurableRowMappingAuthorityV1`

It depends on independent prior acceptance of
`K334CanonicalSubjectRegistrationSemanticAuthorityV1`. Its purpose is to map
that accepted semantic registration authority into the complete physical
`authority_subjects` ROW-01 contract. It owns only:

- row category, physical row identity, and complete field inventory;
- physical row/record aliases required by accepted semantic authority and
  physical fields representing accepted semantic aliases;
- `rowType`, `rowVersion`, and the relationship to the compound key;
- physical representation of accepted semantic provenance and external
  references;
- canonical-bytes storage or explicit absence;
- physical digest fields, projections, and equality binding to an accepted
  semantic digest, or their explicit physical absence;
- the discriminator or explicit no-discriminator rule;
- physical null/omission encoding and storage-only metadata;
- lossless reconstruction to the accepted semantic artifact;
- projection equality and corruption handling;
- MAP-01, C35 installability, and the B01 portions of SC-06 and SC-08.

The physical mapping authority may not create semantic aliases, redefine
semantic alias equivalence, create semantic digest identity, change semantic
digest meaning, infer semantic identity from a physical digest, or add aliases
or digests absent from accepted semantic authority.

### 4.3 Exact dependency and acceptance boundary

`K334CanonicalSubjectRegistrationSemanticAuthorityV1` must be proposed,
independently reviewed, corrected if required, accepted through a separate
acceptance record, independently reviewed as accepted, and archived before
`K334SubjectDurableRowMappingAuthorityV1` may be finalized and accepted.

Both accepted authorities must then be bound by a successor B01 resolution
before B01 can become accepted.

B01 remains unresolved until both authorities are independently accepted and
that successor B01 resolution binds them.

Acceptance of the semantic authority alone cannot authorize ROW-01, MAP-01,
C35 installation, descriptor implementation, or any physical schema choice.
Acceptance of this deferred B01 proposal accepts neither successor authority.
No implementation value may be chosen while the applicable successor
authority is absent.

`REMAINING_B01_AUTHORITIES`:

- `K334CanonicalSubjectRegistrationSemanticAuthorityV1`
- `K334SubjectDurableRowMappingAuthorityV1`

`SUCCESSOR_B01_RESOLUTION_REQUIRED`: `YES`

## 5. Required authority questions

| Question | Source-grounded answer |
| --- | --- |
| What approved subject identity fact exists? | `subjectId` is an exact opaque, case-sensitive, namespace-bound scalar. Current authority does not define the complete canonical semantic registration identity. Identity alone grants no policy, evidence, mapping, lifecycle, eligibility, or runtime authority. |
| Does an independently canonical K-334 subject record already exist? | No. K-334D3 contains no standalone subject record kind or codec. |
| What physical category owns ROW-01? | Not yet selected. C3 calls it a canonical identity store, but does not choose between an identity-registry envelope and a canonical-record envelope. |
| What is canonical subject-registration identity? | Unresolved. The semantic authority must define it without changing the approved `subjectId`, `namespaceKey`, or repository-boundary scalar contracts. |
| What role does `repositoryNamespace` have? | It is an exact repository/record validation boundary where required. It is not currently established as canonical subject identity, a ROW-01 field, a digest component, or a MAP-01 component. |
| What is the physical row identity? | The slot key is fixed as `[namespaceKey,subjectId]`; whether a separate immutable row/record identity exists is deferred. |
| How many physical rows exist per subject? | At most one slot per exact namespace/subject pair by the primary key and C35 uniqueness. The meaning and bytes of that slot remain deferred. |
| What owns creation provenance? | Semantic meaning belongs to `K334CanonicalSubjectRegistrationSemanticAuthorityV1`; physical representation belongs to `K334SubjectDurableRowMappingAuthorityV1`. |
| What owns external references? | Canonical `authority_external_mappings` records own mappings. The semantic authority decides whether registration references one; the physical authority maps any accepted reference into ROW-01. |
| Are digest and provenance fields semantic or physical? | Semantic ownership and contribution are decided first; physical placement or projection is decided second. Neither may be defaulted or inferred. |
| Can subject rows be replaced, superseded, or accumulated? | Approved authority permits none of those conclusions. The identity is immutable and retained forever; no mutation protocol is authorized. |
| What can be defined without runtime behavior? | The approved scalar, store, key, and C35 facts plus the two ordered missing authorities can be recorded. Creation, persistence, mutation, migration, and runtime use cannot. |

## 6. ROW-01 disposition

ROW-01 remains:

`DEFERRED_PENDING_SEPARATE_CANONICAL_SUBJECT_AUTHORITY`

### 6.1 Fixed structural contract

| Property | Fixed value |
| --- | --- |
| Resolution identity | `ROW-01` |
| Store identity | `k334.store.authority_subjects.v1` |
| Store name | `authority_subjects` |
| Store purpose | Required physical subject slot; presence alone has no authority effect |
| Primary key | `["namespaceKey","subjectId"]` |
| Key component order | `namespaceKey` then `subjectId` |
| Key type | Compound |
| `autoIncrement` | `false` |
| Required key fields | Direct own fields `namespaceKey`, `subjectId`; null and omission rejected |
| Namespace rule | Exact `^[a-f0-9]{64}$`; cross-namespace reuse, normalization, and aliases are invalid |
| Subject rule | Exact strict `^[a-z][a-z0-9_.:-]{2,255}$`; opaque, case-sensitive, and not normalized |
| Slot cardinality | One physical slot per exact namespace/subject pair |

Every primary-key and C35 key field must exist as an own row field if ROW-01
is later accepted. No computed getter, nested alias, default, or database
inference may supply either field. These fields define only a required physical
slot and are insufficient to define a valid complete row.

### 6.2 Deferred complete row contract

`K334CanonicalSubjectRegistrationSemanticAuthorityV1` must define:

- the semantic registration artifact and semantic registration identity;
- semantic provenance and external-reference meaning;
- semantic digest and canonicalization decisions;
- semantic conflict, reconstruction, and lifecycle meaning.

Only after that authority is accepted,
`K334SubjectDurableRowMappingAuthorityV1` must define:

- row category and complete row field inventory;
- row identity beyond the compound slot;
- row type literal, row version, and any separate row or record ID;
- physical provenance and external-reference representation;
- digest, canonical-bytes, derived-field, and metadata layout;
- discriminator and physical null/omission encoding;
- reconstruction and projection equality;
- conflict, corruption, unknown-field, and forward-version behavior;
- physical lifecycle representation, if the accepted semantic authority
  requires one.

No minimal `{namespaceKey, subjectId}` row is proposed. Those fields are
necessary key inputs, not a complete subject registration assertion.
`repositoryNamespace` is not established as a ROW-01 field by this proposal.

### 6.3 Prohibited ROW-01 fields and inferences

Until both successor authorities are accepted and bound by a successor B01
resolution, ROW-01 must not contain or imply:

- issuer authority, policy, action, compatibility, evidence acceptance, or
  eligibility;
- lifecycle status, current/active state, predecessor, supersession,
  termination, or winner selection;
- external provider/identifier data copied from ROW-08;
- display name, account, ownership, timestamp, arrival order, or generation as
  identity;
- a fabricated K-334D3 canonical envelope, `canonicalKind`, record ID, digest,
  or canonical bytes;
- migration, recovery, transaction, concurrency, or runtime state.

Malformed or partially specified ROW-01 data is unusable and fails closed. No
automatic repair, normalization, aliasing, defaulting, or downgrade is
permitted.

## 7. C35 binding

The existing C35 structural value is bound without alteration:

| Property | Exact value |
| --- | --- |
| Index identity | `C35` / `k334.index.authority_subjects.by_subject_namespace.v1` |
| Owner | `authority_subjects` |
| Index name | `by_subject_namespace` |
| Key path | `["namespaceKey","subjectId"]` |
| Component order | `namespaceKey` then `subjectId` |
| Key type | Compound |
| `unique` | `true` |
| `multiEntry` | `false` |
| Physical field source | Direct own, strictly validated ROW-01 key fields `namespaceKey` and `subjectId` |
| Purpose | Canonical identity lookup; non-authority |
| Duplicate legality | No second row may occupy the same exact namespace/subject physical slot |
| Relationship to ROW-01 | Index key equals the ROW-01 primary-key tuple |

C35 adds no second identity and grants no authority from an index hit. Its
duplication of the object-store key fields is explicitly required by approved
K-334C3 structure and creates no independent semantic uniqueness authority.
Its structural value is known, but the index is not installable until ROW-01
has a complete accepted row contract supplying both fields coherently. A
duplicate exact key with different candidate row bytes is corruption, not
replacement or last-write-wins.

`K334SubjectDurableRowMappingAuthorityV1` must bind C35 to the complete ROW-01
contract without changing any accepted C35 structural value.

## 8. MAP-01 disposition

MAP-01 remains:

`DEFERRED_PENDING_SEPARATE_CANONICAL_SUBJECT_AUTHORITY`

The only complete mapping facts currently available are:

| Approved validated scalar | Physical destination |
| --- | --- |
| exact `namespaceKey` | direct own `namespaceKey` field and compound-key component 1 |
| exact opaque `subjectId` | direct own `subjectId` field and compound-key component 2 |

Both mappings preserve exact validated strings. No normalization, case folding,
trimming, aliasing, defaulting, or alternative representation is permitted.
These mappings describe a physical slot only, not a complete semantic identity
mapping.

`K334CanonicalSubjectRegistrationSemanticAuthorityV1` must first define the
semantic registration artifact and identity.
`K334SubjectDurableRowMappingAuthorityV1` must then define the complete
semantic-to-physical mapping.

The following remain deferred:

- the `repositoryNamespace` relationship;
- semantic registration identity;
- physical row identity beyond the compound slot;
- provenance and external-reference mappings;
- digest, canonical bytes, storage metadata, and derived fields;
- reconstruction and conflict behavior;
- null and omission behavior beyond strict key-field requirements.

No semantic subject field may be discarded, and no physical field may be added
without a semantic mapping or explicit storage-only classification. No mapping
may be inferred from accepted ROW-08 external-mapping records: ROW-08 proves an
external-to-internal relation only after its own validation and never creates
the subject registration row it references.

MAP-01 remains non-installable and non-implementable.

## 9. SC-06 subject-family portion

The subject-family portion of SC-06 remains deferred.

`K334SubjectDurableRowMappingAuthorityV1` must choose exactly one of:

- an exact physical ROW-01 discriminator field and one exact literal; or
- an explicit no-discriminator rule justified by dedicated-store identity,
  row versioning, and complete validation.

`K334CanonicalSubjectRegistrationSemanticAuthorityV1` may define a semantic
record kind, but that does not select the physical row discriminator.
Unknown or mismatched physical discriminators fail closed. A discriminator, if
selected, may identify only the physical row family. It may not encode or imply
lifecycle, acceptance, mapping validity, eligibility, or runtime state. The
dedicated `authority_subjects` store name is not by itself authority to invent
an unreviewed row discriminator.

SC-06 is not globally resolved. B02 through B08 retain their own portions.

## 10. SC-08 subject-family portion

The following subject-family identity facts are fixed:

- `namespaceKey` and `subjectId` are exact strictly validated scalars;
- the physical slot is exact `[namespaceKey,subjectId]`;
- key mismatch, namespace mismatch, subject mismatch, normalization, aliasing,
  or case folding fails closed;
- row identity fields cannot contradict the physical key;
- row presence alone grants no authority effect;
- a row cannot change either key component and remain the same physical
  subject slot;
- subject identity cannot be replaced by display name, external identity,
  issuer identity, mapping identity, record arrival, timestamp, or row order.

`K334CanonicalSubjectRegistrationSemanticAuthorityV1` owns unresolved:

- canonical semantic registration identity and its relationship to
  `repositoryNamespace`, `namespaceKey`, and `subjectId`;
- semantic alias policy and exact semantic equivalence if aliases exist, or an
  explicit semantic no-alias rule if they do not;
- canonical semantic digest identity, its semantic domain and meaning if it
  exists, or an explicit semantic no-digest rule if it does not;
- semantic equality and conflict meaning involving aliases or digests.

`K334SubjectDurableRowMappingAuthorityV1` owns only unresolved physical
identity and representation questions:

- physical ROW-01 identity beyond the compound slot and any separate immutable
  row/record ID;
- physical row/record aliases required by accepted semantic authority, plus
  physical alias fields and projections;
- physical digest fields and projections, equality binding to an accepted
  semantic digest, and physical mismatch/corruption handling;
- the envelope relationship, canonical-bytes storage relationship, and
  byte-round-trip behavior;
- the relation between the physical slot and any immutable registration
  record;
- physical null/omission encoding and storage-only digest metadata.

The physical mapping authority may not create semantic aliases, redefine
semantic alias equivalence, create semantic digest identity, change semantic
digest meaning, infer semantic identity from a physical digest, or add aliases
or digests absent from accepted semantic authority.

The structural prohibition on contradictory identity does not authorize
update, deletion, replacement, transaction, concurrency, migration, or
recovery behavior.

SC-08 remains unresolved for B01 and globally. B02 through B08 retain their
own portions.

## 11. Provenance and external-reference disposition

### 11.1 Creation provenance

Creation provenance is mandatory, but its semantic content and ROW-01
representation remain separately deferred. The approved standard provenance
shape used by existing K-334D3 canonical records proves an available validated
vocabulary; it does not prove that ROW-01 embeds those fields rather than a
reference or digest to a separate registration artifact.

`K334CanonicalSubjectRegistrationSemanticAuthorityV1` owns:

- whether provenance is part of the registration assertion;
- semantic provenance fields, cardinality, meaning, and immutability;
- contribution to semantic identity or digest;
- semantic validation and reconstruction requirements.

`K334SubjectDurableRowMappingAuthorityV1` owns:

- embedded versus referenced physical representation;
- physical field names, types, and separate-record references;
- digest projections and index participation;
- physical null/omission encoding and storage metadata;
- physical validation and lossless reconstruction.

No issuer relationship is inferred. No legacy row, authenticated account,
external mapping, owner name, or recorder identity alone creates a subject.
Mandatory provenance may not be omitted, fabricated, or selected by
implementation.

### 11.2 External references

External identity remains exclusively authoritative through canonical
`authority_external_mappings` records with `mappingKind="subject"` and exact
`internalId=subjectId`. ROW-01 must not duplicate provider, external namespace,
external identifier, mapping lifecycle, predecessor, or supersession fields.

Whether ROW-01 contains any optional, non-authoritative mapping-record
reference remains deferred.

`K334CanonicalSubjectRegistrationSemanticAuthorityV1` owns whether a
registration assertion semantically references an external mapping, the
semantic cardinality and meaning of such references, or an explicit
no-external-reference rule.

`K334SubjectDurableRowMappingAuthorityV1` owns physical representation of any
accepted semantic reference, including reference IDs, projections, omission
rules, validation, and reconstruction, or an explicit no-physical-reference
rule. Neither question is resolved here.

An external mapping never substitutes for subject identity or proves subject
registration. A subject row never proves an external mapping.

## 12. Lifecycle and mutability boundary

Approved authority establishes that subject identity is immutable, has no
lifecycle effect by identity alone, and is retained forever. It does not
establish a write protocol.

This proposal authorizes none of:

- insertion or registration;
- update or replacement;
- deletion;
- merge or deduplication;
- append/accumulation behavior;
- supersession or termination;
- migration or recovery;
- conflict resolution;
- transaction, locking, CAS, or concurrency behavior;
- runtime lookup, admission, eligibility, or activation.

ROW-01 is neither a current-state slot nor a derived/rebuildable projection
under this proposal. It is also not yet a usable immutable-record store,
because the authoritative registration bytes and identity relation remain
undefined. No implementation may infer lifecycle behavior from its eventual
physical shape.

## 13. Compatibility and data-safety analysis

| Risk | Required fail-closed effect |
| --- | --- |
| Duplicate subject | Primary key and C35 prohibit a second exact namespace/subject slot; different candidate bytes are corruption, never overwrite. |
| Namespace confusion | Both repository and namespace bindings must validate; no cross-namespace or cross-installation reuse. |
| Identity collision | Strict opaque subject IDs and exact namespace context are preserved; external IDs and record IDs cannot substitute. |
| Accidental replacement | No replacement/update protocol exists; physical mutation semantics remain unauthorized. |
| Lossless reconstruction | Cannot yet be claimed. The semantic authority must define the target; the dependent physical authority must define lossless row reconstruction. |
| Provenance loss | A key-only row is forbidden; missing or unbound creation provenance keeps the row unusable. |
| External-reference loss | ROW-08 remains separate canonical evidence; no external relation is inferred from ROW-01 or silently copied into it. |
| Future evolution | A future accepted version must use an explicit discriminator/version policy; unknown versions fail closed. |
| Future migration | Migration cannot synthesize subjects from legacy IDs, accounts, or mappings without separate source and registration authority. |
| Issuer policies/evidence | A subject reference must equal the exact opaque ID, but the referencing record does not create ROW-01 or resolve B02/B08. |
| Quarantine | The quarantine subject slot remains distinct; quarantine presence or absence does not create a subject row. |
| Audit events | B07's missing direct subject source is unchanged; ROW-01 cannot supply it indirectly through inference. |
| External mappings | Accepted ROW-08 records remain independent; mapping ambiguity and lifecycle are not resolved by B01. |

This analysis records implications only. It creates no behavior and resolves no
non-B01 blocker.

## 14. B01 acceptance effect

Future acceptance of this proposal may authorize only:

- acceptance that current approved sources are insufficient;
- acceptance of the deferred disposition;
- preservation of directly approved store, key, C35, and scalar facts;
- acceptance that the two ordered successor authorities are required;
- continued deferral of ROW-01 and MAP-01;
- continued deferral of the B01 portions of SC-06 and SC-08;
- continued blocking of C35 installation;
- creation of later, separate semantic-authority work.

Acceptance of this proposal would not:

- accept either successor authority;
- accept or resolve B01;
- select or accept a physical ROW-01 contract;
- accept, install, or implement MAP-01;
- install C35;
- resolve any portion of SC-06 or SC-08;
- resolve B02 through B08 or C03;
- amend or accept K-334P09P;
- authorize descriptor implementation or create descriptor authority;
- authorize D0-P09, D0-P10, K-334E/F, runtime, or production.

## 15. Required lifecycle

1. Create this deferred B01 resolution proposal.
2. Independently review this proposal.
3. Correct this proposal if required.
4. Create a separate B01 deferred-disposition acceptance record accepting
   only current authority insufficiency, approved partial store/key/index/scalar
   facts, and the two ordered successor-authority requirements.
5. Independently review the B01 deferred-disposition acceptance record.
6. Archive the reviewed B01 deferred proposal and acceptance record in a
   separate bounded archival task.
7. Create `K334CanonicalSubjectRegistrationSemanticAuthorityV1` as a separate
   proposal.
8. Independently review, correct if required, and separately accept the
   semantic authority.
9. Independently review the semantic-authority acceptance record and archive
   the accepted semantic authority through a bounded task.
10. Create `K334SubjectDurableRowMappingAuthorityV1` as a separate proposal
    dependent on the accepted semantic authority.
11. Independently review, correct if required, and separately accept the
    physical durable-row mapping authority.
12. Independently review the physical-mapping acceptance record and archive
    the accepted physical authority through a bounded task.
13. Create a successor B01 resolution binding the accepted semantic authority,
    accepted physical mapping authority, complete ROW-01, complete MAP-01, C35
    installability boundary, and B01 portions of SC-06 and SC-08.
14. Independently review and correct the successor B01 resolution if required.
15. Create and independently review a separate successor-B01 acceptance
    record.
16. Archive the accepted successor B01 resolution.
17. Resolve B02 through B08 through separate authority lifecycles.
18. Amend K-334P09P only after B01 through B08 are all accepted.
19. Independently review the fully resolved amended K-334P09P.
20. Accept the descriptor-authority prerequisite only after that review
    returns PASS.
21. Create and independently review separate descriptor implementation
    authorization before implementation.

No step automatically authorizes the next.

Semantic proposal and acceptance, semantic and physical authority, physical
acceptance and B01 resolution, B01 resolution and acceptance, prerequisite
review and acceptance, and prerequisite acceptance and implementation
authorization remain separate gates.

## 16. Authorization state

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 1
- B01 authority-resolution proposal: 1
- B01 authority resolution accepted: 0
- Canonical subject semantic authority proposal: 0
- Canonical subject semantic authority accepted: 0
- Subject durable-row mapping authority proposal: 0
- Subject durable-row mapping authority accepted: 0
- Successor B01 resolution proposal: 0
- Successor B01 resolution accepted: 0
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

This document is an inert proposal. It defines no schema object, codec,
repository operation, transaction, migration, database opening, runtime path,
admission decision, eligibility decision, or production behavior.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
