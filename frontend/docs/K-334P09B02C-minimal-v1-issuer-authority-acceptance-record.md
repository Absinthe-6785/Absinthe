# K-334P09B02C Minimal-v1 Issuer Authority Acceptance Record

## 1. Record identity and binding

| Field | Value |
| --- | --- |
| Type | `K334MinimalV1IssuerAuthorityAcceptanceRecord` |
| ID | `K-334P09B02C-MINIMAL-V1-ISSUER-ACCEPTANCE-001` |
| Status | `B02_MINIMAL_V1_AUTHORITY_ACCEPTED` |
| Effective authority | `ACCEPTED_B02_SEMANTIC_AND_PHYSICAL_CONTRACTS_NO_IMPLEMENTATION_AUTHORITY` |
| Bound package | `K-334P09B02A-MINIMAL-V1-ISSUER-PACKAGE-001` |
| Bound architecture review | `K-334P09B02B` / `PASS` |
| Bound deferred history | K-334P09T B02 / ROW-02 / MAP-02 deferral and K-334P09X accepted deferral record |
| Accepted source facts | K-334C3 issuer identity, store, key, `autoIncrement`, and C23 facts |

This record accepts only the reviewed minimal-v1 B02 issuer semantic and
physical contracts. It supersedes only B02's deferred state; it does not amend,
accept, or resolve B01, B03 through B08, K-334P09P, or any global shared
constraint.

B02 is authority-resolved but not implemented.

## 2. Accepted issuer semantic contract

| Property | Accepted value |
| --- | --- |
| Semantic authority | `K334CanonicalIssuerSemanticAuthorityV1` |
| Semantic kind | `authority_issuer_registration_v1` |
| Semantic version | integer literal `1` |
| Semantic identity | `["authority_issuer_registration_v1", namespaceKey, issuerId]` |
| Required fields | `semanticKind`, `semanticVersion`, `repositoryNamespace`, `namespaceKey`, `issuerId`, `provenance` |
| Cardinality | one immutable assertion per exact issuer slot |

The assertion establishes one exact canonical issuer reference only. Its
existence creates no issuer policy, permission, capability, admission,
eligibility, activation, trust, delegation, ownership, cryptographic identity,
evidence validity, audit validity, runtime authority, or production authority.

The semantic object is exact: all fields are required; unknown fields are
rejected; scalar equality is exact; inputs are never normalized; and
reconstruction is exact. Provenance participates in semantic equality but not
issuer identity. Different provenance for the same identity is an integrity
conflict and fails closed.

There are no aliases, delegation, hierarchy, rotation, revocation,
supersession, termination, mutable lifecycle state, embedded evidence, embedded
audit content, embedded external-mapping content, canonical-byte storage,
semantic digest, optional extension field, or runtime state.

`NO_EMBEDDED_ISSUER_POLICY_V1` is accepted. Policy authority remains separately
owned by `authority_issuer_policies`; issuer registration does not substitute
for policy evaluation or capability evidence.

## 3. Accepted scalar, context, and provenance contract

`issuerId` is a required, non-null lowercase ASCII string matching
`^[a-z][a-z0-9_.:-]{2,255}$`, with length 3 through 256 characters. Equality
is exact. Trimming, Unicode normalization, case conversion, aliasing, null,
and omission are rejected.

`namespaceKey` retains its approved exact scalar contract. It must exactly
equal the namespace validation context, the ROW-02 own field, and primary-key
component one.

`repositoryNamespace` is a required semantic validation field and required
persisted ROW-02 field. It is excluded from issuer identity, must equal the
repository validation context exactly, and is neither normalized nor inferred.
A mismatch for one issuer identity is an integrity conflict.

Exactly one immutable issuer-registration creation-provenance object is
accepted. It has exactly `sourceKind`, `sourceRecordId`, `sourceDigest`,
and `recorderId`. `sourceKind` is exactly one of `k333_codec`,
`owner_evidence`, `legacy`, or `migration`; `sourceRecordId` is an explicit
`null` or a strict identifier; `sourceDigest` is exactly 64 lowercase
hexadecimal characters; and `recorderId` is a strict identifier. It records
only the validated source classification, source material, and recorder that
established the issuer registration.

The provenance object is required, non-null, and non-optional; its only
explicitly nullable member is `sourceRecordId`. It has no runtime-only
metadata, embeds physically without loss, reconstructs exactly, participates
in semantic equality, and is excluded from issuer identity. No provenance
chain, variant, supersession, timestamp beyond approved provenance content, or
multiple provenance record is accepted.

## 4. Accepted ROW-02 contract

| Property | Accepted value |
| --- | --- |
| Store identity | `k334.store.authority_issuers.v1` |
| Store name | `authority_issuers` |
| Primary key path | `["namespaceKey","issuerId"]` |
| `autoIncrement` | `false` |
| Own fields | `repositoryNamespace`, `namespaceKey`, `issuerId`, `rowVersion`, `provenance` |
| Row version | exact integer `1` |
| Discriminator | no separate discriminator field |

ROW-02 is one canonical immutable issuer row. The no-discriminator rule is
accepted only with all of these conditions: dedicated `authority_issuers`
store, exact `rowVersion=1`, complete exact-object validation, and unknown-field
rejection.

ROW-02 has no `rowType`, `recordId`, aliases, policy or permission fields,
delegation, trust, cryptographic keys, activation or eligibility state,
lifecycle, rotation or revocation state, evidence, audit content, external
mapping content, `canonicalBytes`, semantic or physical digest fields,
storage-only metadata, optional extensions, or timestamps outside provenance.

`row.namespaceKey` exactly equals primary-key component one and
`row.issuerId` exactly equals primary-key component two. Request key, row
fields, repository context, and namespace context must agree exactly; every
mismatch fails closed.

This record does not authorize store creation or row installation.

## 5. Accepted MAP-02

MAP-02 is accepted as total and lossless.

| Semantic value | Physical destination |
| --- | --- |
| `repositoryNamespace` | `row.repositoryNamespace` |
| `namespaceKey` | `row.namespaceKey`, then primary-key component one |
| `issuerId` | `row.issuerId`, then primary-key component two |
| semantic version `1` | `row.rowVersion` equal to `1` |
| `provenance` | `row.provenance` |
| fixed semantic kind | reconstructed from the dedicated issuer store and accepted version |

Mapping performs no normalization, defaulting, inference, aliasing, hashing,
metadata insertion, or lossy omission. Every semantic field reconstructs
exactly; every physical field has the accepted semantic source or structural
role above; and any mismatch fails closed.

## 6. Accepted C23 binding

| Property | Accepted value |
| --- | --- |
| Identity | `k334.index.authority_issuers.by_issuer_namespace.v1` |
| Owner store | `authority_issuers` |
| Index name | `by_issuer_namespace` |
| Key path | `["namespaceKey","issuerId"]` |
| `unique` | `true` |
| `multiEntry` | `false` |
| Source | direct ROW-02 own fields |
| Purpose | non-authoritative structural lookup |

C23 intentionally duplicates the primary key. Its values cannot legitimately
differ from that key. It creates no issuer, policy, capability, trust,
admission, eligibility, activation, runtime, or production authority. It is
ready for a later separately authorized descriptor implementation and remains
uninstalled by this record.

## 7. Accepted B02 shared-constraint portions

Only these B02 portions are accepted:

| Constraint or boundary | Accepted B02 portion |
| --- | --- |
| `SC-01` | issuer store identity/name binding |
| `SC-03` | exact issuer compound-key ordering |
| `SC-05` | issuer family, dedicated store, and MAP-02 coherence |
| `SC-06` | dedicated-store no-discriminator rule using exact row version and strict validation |
| `SC-08` | issuer semantic identity, physical slot, key equality, provenance, reconstruction, conflict, and no-alias/no-digest relationships |
| Provenance | lossless one-object mapping and exact reconstruction |
| Repository/namespace | exact validation context and key-field equality |
| External mapping | separate authority; no embedded mapping content |
| Evidence/audit | separate authorities; no embedded content |

No global shared constraint is fully accepted, and no B03 through B08 portion
is accepted.

## 8. Accepted unsupported-input policy

`UNSUPPORTED_OR_MALFORMED_INPUT` is accepted for B02. It means:

1. fail closed;
2. reject or quarantine;
3. preserve recoverable material where technically available;
4. do not mutate accepted canonical state;
5. emit one bounded structured diagnostic; and
6. require a future reviewed schema version for newly supported semantics.

It applies to unknown fields, unsupported row versions, malformed scalars,
key/row mismatch, repository or namespace mismatch, aliases, policy or
capability fields, delegation or hierarchy fields, lifecycle/rotation/revocation
fields, trust or cryptographic-key fields, evidence/audit content, external
mapping content, and bytes or digest fields. No separate exception protocol is
created.

## 9. Accepted reusability boundary

Accepted reusable mechanism candidates are strict scalar decoders,
exact-object validation, unknown-field rejection, declarative store/index
descriptors, key/row equality verification, reconstruction verification,
immutable-record conflict results, bounded diagnostics, and
corruption/quarantine outcomes.

Absinthe-specific meaning remains issuer semantics, `issuerId`, repository and
namespace semantics, provenance meaning, `authority_issuers`, MAP-02, C23,
B02, and the K-334 lifecycle. This record creates or extracts no reusable
package.

## 10. B02 closure effect and non-advancement

This record advances:

- B02 minimal-v1 package accepted: 0 -> 1
- B02 authority resolution accepted: 0 -> 1
- ROW-02 contract accepted: 0 -> 1
- MAP-02 contract accepted: 0 -> 1
- C23 B02 binding accepted: 0 -> 1
- SC-01 B02 portion accepted: 0 -> 1
- SC-03 B02 portion accepted: 0 -> 1
- SC-05 B02 portion accepted: 0 -> 1
- SC-06 B02 portion accepted: 0 -> 1
- SC-08 B02 portion accepted: 0 -> 1

This record does not advance any global shared-constraint acceptance, B03
through B08, K-334P09P acceptance, descriptor implementation authorization,
descriptor implementation, D0-P09 rebound/execution/satisfaction, D0-P10,
K-334E/F, runtime authorization, or production eligibility.

B02 is authority-resolved but not implemented.

## 11. Authorization state

- Authority-input resolution proposal: 1
- Authority-input resolution accepted: 1
- B01 authority resolution accepted: 1
- B02 minimal-v1 package proposed: 1
- B02 minimal-v1 package accepted: 1
- B02 authority resolution accepted: 1
- ROW-02 contract accepted: 1
- MAP-02 contract accepted: 1
- C23 B02 binding accepted: 1
- SC-01 B02 portion accepted: 1
- SC-03 B02 portion accepted: 1
- SC-05 B02 portion accepted: 1
- SC-06 B02 portion accepted: 1
- SC-08 B02 portion accepted: 1
- B03-B08 authority resolution accepted: 0/6
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

No implementation, descriptor installation, source change, migration, recovery,
proof execution, runtime behavior, or production behavior is authorized by this
record.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
