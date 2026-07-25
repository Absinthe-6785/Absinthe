# K-334P09M1 Machine-Readable Canonical Descriptor Input Authority Design

## 1. Design Identity

| Field | Value |
| --- | --- |
| Type | `K334MachineReadableCanonicalDescriptorInputAuthorityDesign` |
| ID | `K-334P09M1-MACHINE-READABLE-CANONICAL-DESCRIPTOR-INPUT-AUTHORITY-DESIGN-001` |
| Status | `MACHINE_READABLE_DESCRIPTOR_INPUT_AUTHORITY_DESIGN_PROPOSED` |
| Effective authority | `PROPOSAL_ONLY_NO_DESCRIPTOR_INPUT_AUTHORITY_NO_IMPLEMENTATION_AUTHORITY` |
| Governing blocker | `K-334P09I11` / `BLOCKED` |
| Bound accepted proposal | `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001` |
| Bound accepted proposal SHA-256 | `E21782092CBB03BDD68D65C4E57D7AC87F14078A60561B9DD1E36F1E5827C92A` |
| Bound acceptance | `K-334P09P8-DESCRIPTOR-AUTHORITY-PREREQUISITE-ACCEPTANCE-001` |
| Recommended artifact model | `DOCUMENTATION_OWNED_CANONICAL_JSON_ARTIFACT` |
| Readiness | `MACHINE_READABLE_DESCRIPTOR_ARTIFACT_PACKAGE_READY_FOR_ARCHITECTURE_REVIEW` |

This document designs an authority package. It does not create or accept the
machine-readable descriptor input, authorize descriptor implementation, create
schema authority, or change any proof gate.

## 2. Governing Blocker and Scope

`K-334P09I11` is blocked because the accepted descriptor is distributed across
Markdown tables, prose contracts, and partial JSON fragments. Those sources
define the accepted configuration, but the repository has no single accepted
machine-readable descriptor value whose parsed value, canonical bytes,
complete topology, and independent conformance vectors can be reproduced.

This design resolves only how a future artifact may be proposed, independently
reviewed, and accepted. It does not create that artifact.

Historical aggregate counts and temporary derivations cannot substitute for
the absent input. No production source, test, fixture, package manifest,
database artifact, schema version, or runtime path is changed.

## 3. Core Artifact Decision

The one recommended model is:

`DOCUMENTATION_OWNED_CANONICAL_JSON_ARTIFACT`

The proposed future path is:

`frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json`

The path is documentation-owned and is outside `frontend/src`,
`frontend/public`, test fixtures, build inputs, package lifecycle hooks, and
runtime assets. A dedicated `authority` subdirectory separates exact accepted
data artifacts from narrative Markdown without turning the artifact into
production configuration.

The first authority artifact must not be TypeScript, generated runtime
configuration, a database row, localStorage, package metadata, a source
comment, a Markdown code block, or YAML. The JSON file is an evidence artifact,
not a runtime configuration source.

## 4. Authority Relationship

The authority chain has five distinct roles:

| Role | Artifact | Authority relationship |
| --- | --- | --- |
| A | Accepted proposal `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001` at SHA-256 `E217...C92A` | Governing semantic authority for the exact descriptor values and ordering |
| B | Acceptance `K-334P09P8-DESCRIPTOR-AUTHORITY-PREREQUISITE-ACCEPTANCE-001` | Accepts A and its exact descriptor prerequisite; grants no implementation authority |
| C | Future JSON artifact | Exact machine-readable transcription of A as accepted by B; never a new schema design |
| D | Future artifact acceptance record | Independently accepts the exact C file bytes and parsed descriptor after equivalence review |
| E | Future implementation source | May consume or transcribe accepted C only under separate implementation authorization |

A and B remain governing semantic authority. C cannot change, extend, weaken,
or fill gaps in A or B. D must bind C only after an independent equivalence
review. E has no authority from this design, C, or D alone.

C grants no implementation, schema mutation, database installation, runtime,
D0-P09, admission, eligibility, activation, or production authority.

## 5. Accepted Transcription Boundary

`ACCEPTED_SEMANTIC_TRANSCRIPTION` means that all of the following hold:

1. the JSON path and value are directly and unambiguously supported by A;
2. B accepts the relevant A contract without modification;
3. the JSON type, literal, null/empty-array form, and array position are exact;
4. no convenience or provenance field is added to the 23-key root;
5. no undefined normalization, sorting, inference, or implementation convention
   is used; and
6. the mapping record classifies the field `EXACT` and the independent reviewer
   confirms it.

`NEW_OR_CHANGED_DESCRIPTOR_AUTHORITY` is any field or representation requiring:

- interpretation between conflicting passages;
- an omitted value to be supplied;
- a semantic order to be invented;
- a choice between plausible encodings;
- convenience metadata;
- normalization not already specified;
- a changed inventory, relationship, policy, or schema meaning; or
- a value inferred from implementation conventions.

Any such item is `BLOCKED`. It must not be silently resolved by an artifact
author, parser, generator, reviewer, or implementation.

Object presentation order in the pretty-printed source file follows the exact
root and nested key tables for reviewability. It does not create canonical
semantic order: RFC 8785 independently determines canonical object-key order.
Normative array order remains exactly the order accepted by A and B.

## 6. Accepted Descriptor Completeness Audit

### 6.1 Root field matrix

Every root field is directly transcribable from proposal Sections 4.1 through
4.8 and is accepted by acceptance Sections 4 through 9.

| # | JSON path | Governing proposal location | Classification |
| ---: | --- | --- | --- |
| 1 | `/descriptorKind` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 2 | `/descriptorId` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 3 | `/descriptorVersion` | Section 4.1 safe integer | `EXACTLY_TRANSCRIBABLE` |
| 4 | `/physicalSchemaRevision` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 5 | `/databaseName` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 6 | `/sourceDatabaseVersion` | Section 4.1 safe integer | `EXACTLY_TRANSCRIBABLE` |
| 7 | `/targetDatabaseVersion` | Section 4.1 safe integer | `EXACTLY_TRANSCRIBABLE` |
| 8 | `/installationNamespaceContract` | Section 4.2 exact JSON object | `EXACTLY_TRANSCRIBABLE` |
| 9 | `/databaseVersionAuthority` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 10 | `/descriptorVersionOwner` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 11 | `/changeAuthorityOwner` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 12 | `/compatibilityMode` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 13 | `/compatibilityStatementId` | Section 4.1 literal | `EXACTLY_TRANSCRIBABLE` |
| 14 | `/canonicalization` | Section 4.3 exact JSON object | `EXACTLY_TRANSCRIBABLE` |
| 15 | `/stores` | Sections 4.4, 5, and 5.1 | `EXACTLY_TRANSCRIBABLE` |
| 16 | `/indexes` | Sections 4.5, 6, and 6.1 | `EXACTLY_TRANSCRIBABLE` |
| 17 | `/dependencies` | Section 4.6 exact JSON array | `EXACTLY_TRANSCRIBABLE` |
| 18 | `/transactionGroups` | Section 4.7 exact one-element array | `EXACTLY_TRANSCRIBABLE` |
| 19 | `/conflictPolicy` | Section 4.8 exact JSON object | `EXACTLY_TRANSCRIBABLE` |
| 20 | `/retryPolicy` | Section 4.8 exact JSON object | `EXACTLY_TRANSCRIBABLE` |
| 21 | `/postInstallVerification` | Section 4.8 exact JSON object | `EXACTLY_TRANSCRIBABLE` |
| 22 | `/proofLayers` | Section 12 exact ordered three-element array | `EXACTLY_TRANSCRIBABLE` |
| 23 | `/authorityExclusions` | Section 4.8 exact ordered array | `EXACTLY_TRANSCRIBABLE` |

The future artifact root contains exactly these 23 keys and no provenance,
checksum, predecessor-baseline, timestamp, comment, or acceptance fields.

### 6.2 Nested schema matrix

| Structure | Exact accepted contract | Classification |
| --- | --- | --- |
| `installationNamespaceContract` | Four exact keys, literals, and boolean in Section 4.2 | `EXACTLY_TRANSCRIBABLE` |
| `canonicalization` | Nine exact keys and literals in Section 4.3 | `EXACTLY_TRANSCRIBABLE` |
| Every store entry | Exact 20-key schema in Section 4.4; identity and values joined by ordinal from Sections 5/5.1 | `EXACTLY_TRANSCRIBABLE` |
| Every index entry | Exact 14-key schema in Section 4.5; identity and values joined by C ID from Sections 6/6.1 | `EXACTLY_TRANSCRIBABLE` |
| C03 | Complete exact 14-key excluded object in Section 4.5 | `EXACTLY_TRANSCRIBABLE` |
| Dependencies | Seven exact six-key objects and normative nested array order in Section 4.6 | `EXACTLY_TRANSCRIBABLE` |
| Transaction group | One exact eleven-key object and exact member arrays in Section 4.7 | `EXACTLY_TRANSCRIBABLE` |
| Conflict policy | Exact seven-key object in Section 4.8 | `EXACTLY_TRANSCRIBABLE` |
| Retry policy | Exact six-key object in Section 4.8 | `EXACTLY_TRANSCRIBABLE` |
| Post-install verification | Exact three-key object in Section 4.8 | `EXACTLY_TRANSCRIBABLE` |
| Proof layers | Exact ordered strings in Section 12 | `EXACTLY_TRANSCRIBABLE` |
| Authority exclusions | Exact ordered strings in Section 4.8 | `EXACTLY_TRANSCRIBABLE` |

The accepted representation defines exact nulls, empty arrays, booleans,
integers, enum strings, key sets, and ordering. No nested literal requires
additional semantic confirmation.

### 6.3 Store inventory matrix

The store array order is ordinal 1 through 17. Each entry is formed only by
the deterministic Section 4.9 join of the same-ordinal rows in Sections 5 and
5.1.

| Ordinal | Store identity / name | Binding | Classification |
| ---: | --- | --- | --- |
| 1 | `k334.store.authority_subjects.v1` / `authority_subjects` | `ROW-01` / `MAP-01` | `EXACTLY_TRANSCRIBABLE` |
| 2 | `k334.store.authority_issuers.v1` / `authority_issuers` | `ROW-02` / `MAP-02` | `EXACTLY_TRANSCRIBABLE` |
| 3 | `k334.store.authority_issuer_policies.v1` / `authority_issuer_policies` | `ROW-03` / `MAP-03` | `EXACTLY_TRANSCRIBABLE` |
| 4 | `k334.store.authority_evidence.v1` / `authority_evidence` | `ROW-04` / `MAP-04` | `EXACTLY_TRANSCRIBABLE` |
| 5 | `k334.store.authority_rollback_permissions.v1` / `authority_rollback_permissions` | `ROW-05` / `MAP-05` | `EXACTLY_TRANSCRIBABLE` |
| 6 | `k334.store.authority_terminations.v1` / `authority_terminations` | `ROW-06` / `MAP-06` | `EXACTLY_TRANSCRIBABLE` |
| 7 | `k334.store.authority_compatibility_tuples.v1` / `authority_compatibility_tuples` | `ROW-07` / `MAP-07` | `EXACTLY_TRANSCRIBABLE` |
| 8 | `k334.store.authority_external_mappings.v1` / `authority_external_mappings` | `ROW-08` / `MAP-08` | `EXACTLY_TRANSCRIBABLE` |
| 9 | `k334.store.authority_fork_observations.v1` / `authority_fork_observations` | `ROW-09` / `MAP-09` | `EXACTLY_TRANSCRIBABLE` |
| 10 | `k334.store.authority_conflict_observations.v1` / `authority_conflict_observations` | `ROW-10` / `MAP-10` | `EXACTLY_TRANSCRIBABLE` |
| 11 | `k334.store.authority_quarantines.v1` / `authority_quarantines` | `ROW-11` / `MAP-11` | `EXACTLY_TRANSCRIBABLE` |
| 12 | `k334.store.authority_migration_sessions.v1` / `authority_migration_sessions` | `ROW-12` / `MAP-12` | `EXACTLY_TRANSCRIBABLE` |
| 13 | `k334.store.authority_migration_classifications.v1` / `authority_migration_classifications` | `ROW-13` / `MAP-13` | `EXACTLY_TRANSCRIBABLE` |
| 14 | `k334.store.authority_migration_checkpoints.v1` / `authority_migration_checkpoints` | `ROW-14` / `MAP-14` | `EXACTLY_TRANSCRIBABLE` |
| 15 | `k334.store.authority_recovery_markers.v1` / `authority_recovery_markers` | `ROW-15` / `MAP-15` | `EXACTLY_TRANSCRIBABLE` |
| 16 | `k334.store.authority_heads.v1` / `authority_heads` | `ROW-16` / `MAP-16` | `EXACTLY_TRANSCRIBABLE` |
| 17 | `k334.store.authority_audit_events.v1` / `authority_audit_events` | `ROW-17` / `MAP-17` | `EXACTLY_TRANSCRIBABLE` |

All 17 use exact ordered key paths, `autoIncrement=false`, the accepted
discriminator/version or no-discriminator representation, the exact
canonical/process binding, lifecycle model, authority classification, and
`ACCEPTED_ADDITIVE_STORE`.

### 6.4 Index inventory matrix

The index array order is C01 through C38. Section 6 supplies identity,
ownership, name, key path, and uniqueness; Section 6.1 supplies exact behavior;
Section 4.5 supplies the remaining fixed fields and C03's complete excluded
representation.

| Ordinal | Index ID and disposition | Classification |
| ---: | --- | --- |
| 1 | C01 `by_record` / installable | `EXACTLY_TRANSCRIBABLE` |
| 2 | C02 `by_source_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 3 | C03 `by_subject` / excluded | `EXACTLY_TRANSCRIBABLE` |
| 4 | C04 `by_exact_tuple` / installable | `EXACTLY_TRANSCRIBABLE` |
| 5 | C05 `by_tuple_status` / installable | `EXACTLY_TRANSCRIBABLE` |
| 6 | C06 `by_observation_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 7 | C07 `by_subject_code` / installable | `EXACTLY_TRANSCRIBABLE` |
| 8 | C08 `by_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 9 | C09 `by_issuer` / installable | `EXACTLY_TRANSCRIBABLE` |
| 10 | C10 `by_predecessor` / installable | `EXACTLY_TRANSCRIBABLE` |
| 11 | C11 `by_subject_lineage_sequence` / installable | `EXACTLY_TRANSCRIBABLE` |
| 12 | C12 `by_subject_status` / installable | `EXACTLY_TRANSCRIBABLE` |
| 13 | C13 `by_external` / installable | `EXACTLY_TRANSCRIBABLE` |
| 14 | C14 `by_internal` / installable | `EXACTLY_TRANSCRIBABLE` |
| 15 | C15 `by_mapping_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 16 | C16 `by_observation_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 17 | C17 `by_subject_predecessor` / installable | `EXACTLY_TRANSCRIBABLE` |
| 18 | C18 `by_projection_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 19 | C19 `by_subject` / installable | `EXACTLY_TRANSCRIBABLE` |
| 20 | C20 `by_issuer_subject_action` / installable | `EXACTLY_TRANSCRIBABLE` |
| 21 | C21 `by_policy_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 22 | C22 `by_subject_action_sequence` / installable | `EXACTLY_TRANSCRIBABLE` |
| 23 | C23 `by_issuer_namespace` / installable | `EXACTLY_TRANSCRIBABLE` |
| 24 | C24 `by_batch_sequence` / installable | `EXACTLY_TRANSCRIBABLE` |
| 25 | C25 `by_batch_status` / installable | `EXACTLY_TRANSCRIBABLE` |
| 26 | C26 `by_batch_class` / installable | `EXACTLY_TRANSCRIBABLE` |
| 27 | C27 `by_source_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 28 | C28 `by_lease_epoch` / installable | `EXACTLY_TRANSCRIBABLE` |
| 29 | C29 `by_source_status` / installable | `EXACTLY_TRANSCRIBABLE` |
| 30 | C30 `by_state` / installable | `EXACTLY_TRANSCRIBABLE` |
| 31 | C31 `by_batch_status` / installable | `EXACTLY_TRANSCRIBABLE` |
| 32 | C32 `by_issuer_subject` / installable | `EXACTLY_TRANSCRIBABLE` |
| 33 | C33 `by_permission_digest` / installable | `EXACTLY_TRANSCRIBABLE` |
| 34 | C34 `by_target` / installable | `EXACTLY_TRANSCRIBABLE` |
| 35 | C35 `by_subject_namespace` / installable | `EXACTLY_TRANSCRIBABLE` |
| 36 | C36 `by_subject_sequence` / installable | `EXACTLY_TRANSCRIBABLE` |
| 37 | C37 `by_target` / installable | `EXACTLY_TRANSCRIBABLE` |
| 38 | C38 `by_termination_digest` / installable | `EXACTLY_TRANSCRIBABLE` |

C03 is exactly the Section 4.5 object: `keyPath`, `unique`, and `multiEntry`
are JSON `null`; `directSourceFields` is `[]`; disposition is
`ACCEPTED_EXCLUDED_INDEX`. The remaining 37 entries are installable and use
`multiEntry=false`.

### 6.5 Predecessor, policies, proof, exclusions, and ordering

| Item | Exact accepted state | Classification |
| --- | --- | --- |
| Database transition | `absinthe-local-v2`, v4 to v5 | `EXACTLY_TRANSCRIBABLE` |
| Predecessor baseline | Section 4.10 exact 9-store/22-index metadata table | `EXACTLY_TRANSCRIBABLE` |
| Predecessor store metadata | Names, string/array/null key paths, `autoIncrement=false` | `EXACTLY_TRANSCRIBABLE` |
| Predecessor index metadata | Owner/name/key path/unique and `multiEntry=false` | `EXACTLY_TRANSCRIBABLE` |
| Dependencies | DEP-01 through DEP-07 in displayed order | `EXACTLY_TRANSCRIBABLE` |
| Transaction group | One v4-to-v5 atomic group with exact member/excluded arrays | `EXACTLY_TRANSCRIBABLE` |
| Conflict policy | Exact Section 4.8 object | `EXACTLY_TRANSCRIBABLE` |
| Retry policy | Exact Section 4.8 object | `EXACTLY_TRANSCRIBABLE` |
| Verification policy | Exact Section 4.8 object | `EXACTLY_TRANSCRIBABLE` |
| Proof layers | Three strings in Section 12 order | `EXACTLY_TRANSCRIBABLE` |
| Authority exclusions | Twelve strings in Section 4.8 order | `EXACTLY_TRANSCRIBABLE` |
| Store ordering | Ordinal 1 through 17 | `EXACTLY_TRANSCRIBABLE` |
| Index ordering | C01 through C38 including C03 | `EXACTLY_TRANSCRIBABLE` |
| Nested array ordering | Explicit display, ordinal, C-ID, dependency-ID, or declared order | `EXACTLY_TRANSCRIBABLE` |

The predecessor baseline is configuration authority outside the descriptor
root and does not enter the descriptor digest. The future artifact acceptance
package binds it through the exhaustive field-mapping and equivalence record;
it must not add a twenty-fourth root key.

## 7. Ambiguity and Missing-Input Result

No `AMBIGUOUS`, `MISSING`, or `CONFLICTING` descriptor field was found in the
accepted A/B source pair.

The accepted proposal supplies:

- exact root and nested key sets;
- all scalar values and types;
- exact canonical null and empty-array representations;
- exact store and index join rules;
- all order-sensitive arrays;
- the complete C03 representation;
- the exact predecessor baseline;
- all dependency, transaction, policy, proof, and exclusion values; and
- the RFC 8785 and digest rules.

The artifact-creation phase must still stop as `BLOCKED` if its exhaustive
mapping identifies any discrepancy not visible in this design audit. Readiness
for architecture review is not artifact acceptance.

## 8. Artifact Format

`K334_MACHINE_READABLE_CANONICAL_DESCRIPTOR_JSON_V1` has this source-file
format:

- UTF-8 without BOM;
- exactly one JSON object value;
- no comments;
- no trailing commas;
- no duplicate object keys;
- no `undefined`, non-finite number, negative zero, or non-integer number;
- two-space indentation for the checked-in review form;
- LF line endings;
- one final LF after the closing brace; and
- exact 23-key root and accepted nested key sets only.

The pretty-printed source bytes are not canonical descriptor bytes. The parsed
root is validated first, then canonical descriptor bytes are derived by the
accepted RFC 8785 profile. The source-file final LF participates only in the
raw artifact-file SHA.

## 9. Documentation Canonicalization Bootstrap

`K334_DOCUMENTATION_CANONICALIZATION_BOOTSTRAP_V1` is the sole M2/M3 contract
for accepting canonical descriptor bytes and the domain-framed descriptor
digest. It provides two mutually exclusive paths:

- `TWO_INDEPENDENT_DOCUMENTATION_CANONICALIZATION_DERIVATIONS`; or
- `SEPARATELY_REVIEWED_RFC8785_REFERENCE_IMPLEMENTATION`.

No future production descriptor encoder, including
`k334PhysicalSchemaDescriptor.ts`, may generate an M2/M3 expected value or
serve as an acceptance oracle. Accepted documentation vectors may become test
expectations only after M4 and under later separate implementation authority.

### 9.1 Option A: independent documentation derivations

Each of two independently implemented documentation-only derivations must:

1. consume the exact raw JSON artifact bytes;
2. use a strict duplicate-key-rejecting parser;
3. emit the parsed descriptor value;
4. independently canonicalize that value under the accepted RFC 8785 profile;
5. emit canonical descriptor bytes, canonical-byte length, and canonical-byte
   SHA-256;
6. construct the exact UTF-8 domain plus one `0x00` byte plus canonical-byte
   preimage;
7. emit the domain-framed descriptor digest; and
8. record its tool, runtime, version, script SHA-256, and exact invocation.

The derivations must not import each other, share copied canonicalization code,
use another derivation's expected output, accept a prefilled expected checksum
or digest, import the future six-file package, or import a production helper.
Outputs are compared only after both derivations complete.

### 9.2 Option B: separately reviewed reference implementation

`SEPARATELY_REVIEWED_RFC8785_REFERENCE_IMPLEMENTATION` requires one reference
record that binds all of the following:

1. reference implementation name;
2. an immutable implementation identity: exact source commit SHA, signed or
   checksummed release-artifact digest, package tarball/content digest, or
   immutable executable SHA-256;
3. runtime or interpreter identity and version;
4. separately reviewed RFC 8785 compatibility-record identity and exact
   supported K-334 descriptor-value profile;
5. `STRICT_DUPLICATE_JSON_KEY_REJECTION_V1`: duplicate keys at every nesting
   depth are rejected before parsed-value acceptance or canonicalization;
6. exact-one-root-object parsing and malformed-Unicode rejection;
7. canonical descriptor byte length and either canonical descriptor bytes or
   I02;
8. exact UTF-8 domain framing and I03;
9. exact I01 input artifact;
10. exact invocation; and
11. reviewer and review-record identity.

A human-readable version may be recorded, but is never sufficient alone; a
package name, mutable branch, latest tag, or URL without an immutable content
identity is also insufficient. Last-key-wins and first-key-wins parsing are
forbidden. The separately reviewed reference must prove this behavior with
fixed duplicate-key fixtures, or a separately reviewed raw-token validator
must reject duplicates before the reference parser runs. Rejected input emits
neither I02 nor I03. The reference must not depend on future production
descriptor code.

### 9.3 Acceptance comparison

For Option A, parsed-value structural checks, canonical-byte lengths,
canonical bytes or their canonical-byte checksums, and framed descriptor
digests must all match exactly. For Option B, M3 independently verifies the
reviewed reference's input identity and invocation, and M4 archives the
result. Any mismatch is
`MACHINE_READABLE_DESCRIPTOR_CANONICALIZATION_CONFLICT` and blocks M4.

## 10. Complete Identity Inventory

The following identities are separate and must use these exact names; the
ambiguous phrase "canonical SHA" is prohibited. Every future I01-I06 field is
represented as `LOWERCASE_HEX64_SHA256_V1`: exactly 64 ASCII characters from
`0-9` and `a-f`, without a prefix, separator, whitespace, quote, or uppercase
character. Byte-digest equality is authoritative; textual comparison uses this
normalized representation. Existing uppercase hashes in historical documents
remain historical source facts rather than future I01-I06 field values.

| ID | Exact identity | Definition |
| --- | --- | --- |
| I01 | `RAW_DESCRIPTOR_ARTIFACT_FILE_SHA256` | SHA-256 of exact checked-in UTF-8 JSON file bytes, including formatting and final LF |
| I02 | `PARSED_DESCRIPTOR_CANONICAL_BYTES_SHA256` | SHA-256 of RFC 8785 canonical descriptor bytes from the parsed root, without domain prefix or delimiter |
| I03 | `DOMAIN_FRAMED_DESCRIPTOR_DIGEST_SHA256` | SHA-256 of UTF-8 accepted domain, `0x00`, and canonical descriptor bytes |
| I04 | `GOVERNING_PROPOSAL_DOCUMENT_SHA256` | SHA-256 of final governing-proposal document bytes; the current historical source fact is `E21782092CBB03BDD68D65C4E57D7AC87F14078A60561B9DD1E36F1E5827C92A`, normalized into `LOWERCASE_HEX64_SHA256_V1` when recorded as future I04 evidence |
| I05 | `M2_TRANSCRIPTION_PROPOSAL_DOCUMENT_SHA256` | SHA-256 of final M2 transcription proposal document bytes, bound after finalization by M3 and M4 rather than self-embedded in M2 |
| I06 | `M4_ACCEPTANCE_RECORD_DOCUMENT_SHA256` | SHA-256 of final M4 acceptance record document bytes, bound after finalization by its external archive binding rather than self-embedded in M4 |

Raw artifact byte length, canonical descriptor byte length, artifact-format
identity, descriptor semantic identity, artifact path, and parsed descriptor
ID/version/revision supplement I01-I06 but never replace them. None belongs in
the 23-key descriptor root.

M2 records its artifact path, format identity, raw byte length, I01, parsed
descriptor identity, canonical byte length, I02, I03, I04, its proposal ID,
the exact external post-finalization I05-binding requirement, selected bootstrap
option, and derivation/reference identities. M3 records the final I05 value.
M2 remains proposed with no effective authority.

M4 binds the exact path; I01 through I05; M3 review identity and `PASS`;
format identity; descriptor ID/version/revision; mapping checksums; selected
bootstrap evidence; and the required M4A archive-binding procedure below. M4A
then records I06 after final M4 bytes exist. This is the accepted
non-self-referential hash pattern: neither M2 nor M4 can truthfully contain its
own final document SHA. A formatting-only edit requires a new I01 and
controlled re-archival even if I02/I03 remain unchanged.

## 11. Future Package Identities

| Role | Proposed exact identity |
| --- | --- |
| Descriptor semantic identity | `K-334-CANONICAL-PHYSICAL-SCHEMA-001` |
| Artifact format identity | `K334_MACHINE_READABLE_CANONICAL_DESCRIPTOR_JSON_V1` |
| Artifact path | `frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json` |
| M2 transcription proposal type | `K334MachineReadableDescriptorTranscriptionProposal` |
| M2 transcription proposal ID | `K-334P09M2-MACHINE-READABLE-DESCRIPTOR-TRANSCRIPTION-001` |
| M3 review type | `K334MachineReadableDescriptorEquivalenceReview` |
| M3 review ID | `K-334P09M3-MACHINE-READABLE-DESCRIPTOR-EQUIVALENCE-REVIEW-001` |
| M4 acceptance type | `K334MachineReadableDescriptorInputAcceptanceRecord` |
| M4 acceptance ID | `K-334P09M4-MACHINE-READABLE-DESCRIPTOR-INPUT-ACCEPTANCE-001` |
| M4 acceptance path | `frontend/docs/K-334P09M4-machine-readable-descriptor-input-acceptance-record.md` |
| M4 acceptance status | `MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED` |
| M4 effective authority | `MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED_NO_IMPLEMENTATION_AUTHORITY` |
| M4A archive-binding type | `K334MachineReadableDescriptorAcceptanceArchiveBinding` |
| M4A archive-binding ID | `K-334P09M4A-MACHINE-READABLE-DESCRIPTOR-ACCEPTANCE-ARCHIVE-BINDING-001` |
| M4A archive-binding path | `frontend/docs/K-334P09M4A-machine-readable-descriptor-acceptance-archive-binding.md` |
| M4A archive-binding status | `MACHINE_READABLE_DESCRIPTOR_ACCEPTANCE_ARCHIVE_BOUND` |
| M4A effective authority | `ARCHIVE_IDENTITY_BINDING_ONLY_NO_ADDITIONAL_SEMANTIC_OR_IMPLEMENTATION_AUTHORITY` |

These names are proposals until the M1 architecture review accepts this design.

## 12. Controlled Creation and Field Mapping

M2 has exactly two persistent outputs: the JSON artifact and
`frontend/docs/K-334P09M2-machine-readable-descriptor-transcription-proposal.md`.
The latter contains two dedicated normative sections: `Machine-Readable Field
Mapping Manifest` for artifact nodes and `Predecessor Baseline Evidence Mapping
Manifest` for predecessor evidence. It also contains bootstrap evidence, the
identity inventory, dormancy evidence, and exactness results. No third
persistent mapping artifact is created.

### 12.1 Mapping row schema

`K334_DESCRIPTOR_FIELD_MAPPING_ROW_V1` has exactly these eight fields:

1. `ordinal` — positive safe integer, contiguous from 1;
2. `jsonPointer` — exact pointer under Section 12.2;
3. `valueKind` — one of `OBJECT`, `ARRAY`, `STRING`, `INTEGER`, `BOOLEAN`, or
   `NULL`;
4. `normalizedDisplayValue` — for scalar/null values, the RFC 8785 JSON token;
   for containers, the exact literal `OBJECT` or `ARRAY`;
5. `governingProposalLocation` — exact proposal section/table/row citation;
6. `governingAcceptanceLocation` — exact acceptance citation or literal
   `NOT_APPLICABLE` when no distinct acceptance passage applies;
7. `transcriptionStatus` — exactly `EXACT`, `BLOCKED`, or `NOT_APPLICABLE`;
   and
8. `reviewerStatus` — exactly `UNREVIEWED`, `VERIFIED`, or `REJECTED`.

No free-form row shape, optional field, or invented provenance field is
permitted. `normalizedDisplayValue` is review display evidence only and never
enters the 23-key descriptor root. `INTEGER` requires the accepted integer
grammar. Its display value is canonical base-10 integer text without exponent
notation, a plus sign, a leading zero other than `0`, or `-0`; semantic equality
uses the parsed integer and `valueKind`, not the display text. `NUMBER`,
`FLOAT`, `DECIMAL`, and generic `SCALAR` are prohibited.

### 12.2 Artifact descriptor mapping domain

`ARTIFACT_DESCRIPTOR_MAPPING_DOMAIN_V1` contains only nodes present inside the
parsed 23-key JSON artifact and is the sole participant in artifact pointer-set
totality.

Pointers are RFC 6901-compatible. The root pointer is the empty string;
`~` and `/` are escaped as `~0` and `~1`; array indices are base-10 decimal
without leading zeroes; and wildcards are prohibited. Object property names do
not receive separate rows: the pointer identifies each property value.

Every root/object/array container has a row. Every object property value,
array element, scalar leaf, null leaf, empty object, and empty array has a
row. A container row is the sole row for an empty container; no parent-summary
row may replace child rows for a non-empty container.

The sole mapping order is deterministic depth-first pre-order. Object children
are traversed by ascending UTF-16 code-unit property name; array children are
traversed by ascending numeric index. This order is mapping-only: it neither
changes source-file presentation nor replaces RFC 8785 object-key order or any
accepted semantic array order. The resulting rows receive the contiguous
`ordinal` sequence.

### 12.3 Artifact completeness manifest and checksums

`K334_DESCRIPTOR_FIELD_MAPPING_COMPLETENESS_MANIFEST_V1` records exactly:

- mapping schema identity and traversal/order identity;
- total mapping row count; container row count; object count; array count;
  string count; integer count; boolean count; and null count;
- store-entry row range/count and index-entry row range/count;
- `MAPPING_POINTER_SET_SHA256`, computed over the RFC 8785 canonical UTF-8 JSON
  array of traversal-ordered pointer strings;
- `MAPPING_ROWS_SHA256`, computed over the RFC 8785 canonical UTF-8 JSON array
  of all eight-key mapping-row records in ordinal order;
- `ARTIFACT_NODE_TYPE_MANIFEST_SHA256`, defined below;
- duplicate pointer count, missing pointer count, and extra pointer count,
  each required to be 0.

Temporary documentation tooling independently derives from the parsed JSON
artifact the complete pointer set, container/leaf classification, traversal
order, expected row count, and exact pointer/`valueKind`/ordinal tuple. It then
requires exact pointer equality, `valueKind` equality, ordinal equality,
row-count equality, an exact `ARTIFACT_NODE_TYPE_MANIFEST_SHA256` match, zero
duplicate/missing/extra pointers, schema-valid rows, and a governing source
location for every `EXACT` row. A correct pointer with an incorrect `valueKind`
fails. A `BLOCKED` row blocks M2 readiness. The tool checks syntax and totality
only; it cannot infer a semantic value.

`ARTIFACT_NODE_TYPE_MANIFEST_SHA256` is SHA-256 of RFC 8785 UTF-8 bytes of
exactly this object, with the displayed placeholders replaced by JSON integer
values rather than strings:

```json
{
  "manifestKind": "K334_ARTIFACT_NODE_TYPE_MANIFEST_V1",
  "traversalKind": "K334_DESCRIPTOR_MAPPING_DEPTH_FIRST_UTF16_V1",
  "totalNodes": "<integer>",
  "objectNodes": "<integer>",
  "arrayNodes": "<integer>",
  "stringNodes": "<integer>",
  "integerNodes": "<integer>",
  "booleanNodes": "<integer>",
  "nullNodes": "<integer>"
}
```

The resulting hash text uses `LOWERCASE_HEX64_SHA256_V1`.

### 12.4 Predecessor baseline evidence mapping domain

`PREDECESSOR_BASELINE_EVIDENCE_MAPPING_DOMAIN_V1` contains accepted v4
predecessor metadata that governs the descriptor but is not a node inside its
23-key root. It never uses artifact JSON pointers.

#### 12.4.1 Canonical predecessor evidence path contract

`K334_PREDECESSOR_EVIDENCE_PATH_V1` is the sole grammar for this domain and
supersedes every generic predecessor-path example in this document. Its scheme
is exactly `predecessor://`; every path is absolute and no alternative syntax is
permitted. The root inventory is exactly:

- `predecessor://` (`OBJECT`), containing exactly `database`, `stores`, and
  `indexes`;
- `predecessor://database` (`OBJECT`), with exactly `name` then `version`;
- `predecessor://database/name` (`STRING`) and
  `predecessor://database/version` (`INTEGER`);
- `predecessor://stores` (`ARRAY`); and
- `predecessor://indexes` (`ARRAY`).

Store ordinals are global predecessor ordinals, not implementation store IDs:
ASCII decimal `1` through `9`, with no leading zero. Each store object is
`predecessor://stores/{storeOrdinal}` (`OBJECT`). The complete, fixed store
field inventory, in traversal order, is `name`, `keyPath`, and `autoIncrement`:

- `name` is `STRING`;
- `keyPath` is `STRING`, `ARRAY`, or `NULL`; and
- `autoIncrement` is `BOOLEAN`.

Thus the only permitted store-field form is
`predecessor://stores/{storeOrdinal}/{fieldName}` for one of those three names.
There is no store-local `indexes` field and no store-nested index path.

Index ordinals are `GLOBAL_PREDECESSOR_INDEX_ORDINAL`: global across all 22
accepted predecessor indexes, ASCII decimal `1` through `22`, no leading zero,
and in accepted predecessor-index order. Each index object is
`predecessor://indexes/{indexOrdinal}` (`OBJECT`). Its complete fixed field
inventory, in traversal order, is `storeOrdinal`, `name`, `keyPath`, `unique`,
and `multiEntry`:

- `storeOrdinal` is `INTEGER` and refers to one of the nine global store
  ordinals;
- `name` is `STRING`;
- `keyPath` is `STRING`, `ARRAY`, or `NULL`;
- `unique` is `BOOLEAN`; and
- `multiEntry` is `BOOLEAN`.

The only permitted index-field form is
`predecessor://indexes/{indexOrdinal}/{fieldName}` for one of those five names.
Names are values only; neither a store name nor index name is an ordinal
identity. No field outside these database, store, and index inventories may be
introduced. If accepted authority exposes one, M2 returns `BLOCKED` rather than
inventing a path.

For an array-valued `keyPath`, the container has its own `ARRAY` row and each
element has `{fieldPath}/{arrayIndex}` with a zero-based ASCII decimal index,
no leading zero except `0`, in ascending order. Scalar and `NULL` key paths
have no child paths. Every root, object, collection, field, array container,
and array element receives exactly one row; allowed `valueKind` values are only
`OBJECT`, `ARRAY`, `STRING`, `INTEGER`, `BOOLEAN`, and `NULL`.

`K334_PREDECESSOR_PATH_PERCENT_ENCODING_V1` derives each variable segment from
UTF-8 bytes. Only `A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, and `~` remain literal;
every other byte is percent-encoded with uppercase hexadecimal (for example
`%2F`, never `%2f`). `/` is solely a segment separator, percent-decoding must
produce valid UTF-8, and malformed or noncanonical encodings fail closed.

Traversal is exactly: root; database; database `name`, `version`; stores;
stores `1` through `9`, each with `name`, `keyPath` (immediately followed by
array elements when applicable), and `autoIncrement`; indexes; indexes `1`
through `22`, each with `storeOrdinal`, `name`, `keyPath` (immediately followed
by array elements when applicable), `unique`, and `multiEntry`. This order
defines row ordinal, path-set order, mapping-row checksum order, and node/type
manifest derivation. The root/database/stores/indexes relationship is exclusive:
indexes reference their owning store through `storeOrdinal`, indexes are never
nested under stores, and no node has both global and store-local paths.

Totality requires exact coverage of the stated root paths, database fields,
nine store objects and all store fields, 22 index objects and all index fields,
and all required array components; exact evidencePath/valueKind/ordinal equality;
and zero duplicate, missing, or extra paths. `PREDECESSOR_PATH_SET_SHA256` is
SHA-256 of RFC 8785 UTF-8 bytes for the ordered evidencePath array;
`PREDECESSOR_MAPPING_ROWS_SHA256` is SHA-256 of RFC 8785 UTF-8 bytes for the
ordinal-ordered `K334_PREDECESSOR_EVIDENCE_MAPPING_ROW_V1` array; and
`PREDECESSOR_NODE_TYPE_MANIFEST_SHA256` is SHA-256 of RFC 8785 UTF-8 bytes for
the exact node/type manifest below. All outputs use `LOWERCASE_HEX64_SHA256_V1`.

`K334_PREDECESSOR_EVIDENCE_MAPPING_ROW_V1` has exactly these eight fields:

1. `ordinal`;
2. `evidencePath`;
3. `valueKind`;
4. `normalizedDisplayValue`;
5. `governingProposalLocation`;
6. `governingAcceptanceLocation`;
7. `transcriptionStatus`; and
8. `reviewerStatus`.

It uses the same finite `valueKind` and status enums as the artifact-row schema.
Artifact pointers and predecessor paths never share an ambiguous field.

`K334_PREDECESSOR_EVIDENCE_MAPPING_COMPLETENESS_MANIFEST_V1` records total
predecessor row count; store and index row counts; object, array, string,
integer, boolean, and null counts as applicable; exact nine-store and 22-index
coverage; the accepted ordering identity; and zero duplicate, missing, and
extra evidence paths. It also records:

- `PREDECESSOR_PATH_SET_SHA256`: SHA-256 of RFC 8785 UTF-8 bytes of the
  traversal-ordered JSON array of `evidencePath` strings;
- `PREDECESSOR_MAPPING_ROWS_SHA256`: SHA-256 of RFC 8785 UTF-8 bytes of the
  ordinal-ordered JSON array of all eight-key predecessor-row records; and
- `PREDECESSOR_NODE_TYPE_MANIFEST_SHA256`: SHA-256 of RFC 8785 UTF-8 bytes of
  exactly this object, with the displayed placeholders replaced by JSON integer
  values rather than strings:

  ```json
  {
    "manifestKind": "K334_PREDECESSOR_NODE_TYPE_MANIFEST_V1",
    "traversalKind": "K334_PREDECESSOR_EVIDENCE_DEPTH_FIRST_V1",
    "totalNodes": "<integer>",
    "objectNodes": "<integer>",
    "arrayNodes": "<integer>",
    "stringNodes": "<integer>",
    "integerNodes": "<integer>",
    "booleanNodes": "<integer>",
    "nullNodes": "<integer>"
  }
  ```

All six mapping-checksum identities use `LOWERCASE_HEX64_SHA256_V1`; rendered
Markdown bytes are never checksum preimages. M3 independently derives expected
predecessor evidence from accepted proposal authority, then requires
evidence-path equality, `valueKind` equality, ordinal equality, row-count
equality, exact predecessor-manifest checksums, and zero duplicate/missing/extra
paths.

Rows remain reviewable by grouping the M2 section into root/configuration,
predecessor baseline, stores, indexes, dependencies, transaction groups,
policies, proof layers, and authority exclusions. Store groups use accepted
ordinal order and index groups use C-ID order. Bounded/collapsible Markdown
presentation is allowed only when the full deterministic manifest and its
checksums cover every row in its own domain. Predecessor rows do not appear in
`MAPPING_POINTER_SET_SHA256`, do not count as extra artifact pointers, and are
not satisfied by artifact-pointer rows; artifact rows likewise do not satisfy
predecessor coverage. Each domain is independently complete, and no combined
pointer/path set is the sole totality proof.

M2 creates the exhaustive mapping before JSON assembly, constructs the root
only from `EXACT` mappings, validates exact keys/counts/order/JSON lexical
constraints, computes I01-I04 and bootstrap evidence, and submits artifact,
proposal, both mapping domains, hashes, and creation evidence to M3. M2 records
the future I05 binding procedure but cannot compute its own final I05. An
undocumented Markdown parser cannot establish authority.

## 13. Independent Equivalence Review

M3 is required before any acceptance. The artifact author cannot be the sole
verifier.

The reviewer independently verifies:

- every artifact field has direct accepted support;
- no accepted field is omitted and no extra field is added;
- all 23 root keys and exact nested key sets are present;
- all order-sensitive arrays match accepted authority;
- all 17 store objects and 38 index disposition objects are complete;
- C03 uses the exact excluded representation;
- the 9-store/22-index predecessor baseline is correctly bound by the mapping
  and acceptance package without entering the root;
- values, integers, nulls, arrays, booleans, and strings match exactly;
- I01 through I05 are recomputed in `LOWERCASE_HEX64_SHA256_V1`, and M4A binds
  I06 only after final M4 bytes exist;
- Option A independently derives canonical bytes/checksums/digests twice, or
  Option B independently verifies immutable reference identity, strict
  duplicate-key rejection, exact-one-root-object parsing, malformed-Unicode
  rejection, canonical-byte length, input, and invocation;
- parsed-value reconstruction and descriptor digest are deterministic without a
  production encoder;
- artifact and predecessor row schemas, pointer/path syntax, traversal,
  pointer-or-path/`valueKind`/ordinal totality manifests, and all six mapping
  checksums are independently checked rather than accepted from M2's own script
  output;
- every `EXACT` source location is correct and no `BLOCKED` or `REJECTED` row
  remains;
- no semantic change was introduced;
- no production import, build, database, or runtime path reaches the artifact;
  and
- all provisional fragment evidence remains non-authoritative.

Any unsupported, omitted, extra, differently ordered, or ambiguously encoded
value produces `BLOCKED`, not a reviewer correction or inferred value.

Maximum architecture reasoning is required because equivalence spans multiple
accepted tables and exact join rules, not because the output is executable.
One mistaken join, null form, order, or authority elevation would change
canonical bytes while appearing superficially documentation-only.

## 14. Creation and Acceptance Phases

| Phase | Work | Resulting authority |
| --- | --- | --- |
| M2 | Create exactly the JSON artifact and transcription proposal with both mapping manifests, I01-I04, the future-I05 binding procedure, bootstrap, dormancy, and exactness evidence | `PROPOSED_MACHINE_READABLE_DESCRIPTOR_INPUT_NO_EFFECTIVE_AUTHORITY` |
| M3 | Sol / Maximum independent architecture, parse, bootstrap, mapping-totality, hash, and dormancy review; `PASS` or `CHANGES_REQUIRED` only | Review result only; no acceptance by review alone |
| M4 | Bounded documentation-only acceptance after M3 `PASS`, at `frontend/docs/K-334P09M4-machine-readable-descriptor-input-acceptance-record.md`, binding I01-I05 directly, M3, both mapping domains, bootstrap evidence, and correct historical classification | Status `MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED`; effective authority `MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED_NO_IMPLEMENTATION_AUTHORITY` |
| M4A | After M4 finalization, create `K334MachineReadableDescriptorAcceptanceArchiveBinding` at the exact M4A path, bind the exact M4 type/ID/path/status/effective authority, I06, and final M4 byte length, and add no authority | Status `MACHINE_READABLE_DESCRIPTOR_ACCEPTANCE_ARCHIVE_BOUND`; effective authority `ARCHIVE_IDENTITY_BINDING_ONLY_NO_ADDITIONAL_SEMANTIC_OR_IMPLEMENTATION_AUTHORITY` |

Artifact creation and acceptance cannot be combined. M3 must occur after M2
has fixed the exact artifact bytes and before M4 grants input authority. M4A
then follows only in this order: finalize M4, freeze final M4 bytes, compute
I06, create M4A, verify both files, then commit/archive. M4 never self-hashes.

### 14.1 M4A archive-binding record

M4A is owned by the documentation/archive closure owner and is created during
the same bounded M4 closure only after the M4 acceptance text is finalized. It
is reviewed under that closure, does not replace M4, and does not extend M4
authority. Altering M4 invalidates the M4A binding; altering M4A requires a
controlled archival correction.

`K334MachineReadableDescriptorAcceptanceArchiveBinding` at
`frontend/docs/K-334P09M4A-machine-readable-descriptor-acceptance-archive-binding.md`
must bind exactly its type, ID, status, exact M4 type, exact M4 ID, exact M4
path, final M4 byte length, I06 in `LOWERCASE_HEX64_SHA256_V1`, M4 finalization
state, M3 review ID and `PASS`, artifact path, and descriptor ID/version/revision.
It must state explicitly that it adds no semantic authority and no
implementation, schema, runtime, or D0-P09 authority. M4A is an archive
identity record only; its own normal repository-document SHA is established by
commit/archive evidence, not self-embedded in its body.

### 14.2 Exact M4/M4A identity and archival closure

M4 has exact type `K334MachineReadableDescriptorInputAcceptanceRecord`, ID
`K-334P09M4-MACHINE-READABLE-DESCRIPTOR-INPUT-ACCEPTANCE-001`, path
`frontend/docs/K-334P09M4-machine-readable-descriptor-input-acceptance-record.md`,
status `MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED`, and effective authority
`MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED_NO_IMPLEMENTATION_AUTHORITY`.
M4A has exact type `K334MachineReadableDescriptorAcceptanceArchiveBinding`, ID
`K-334P09M4A-MACHINE-READABLE-DESCRIPTOR-ACCEPTANCE-ARCHIVE-BINDING-001`, path
`frontend/docs/K-334P09M4A-machine-readable-descriptor-acceptance-archive-binding.md`,
status `MACHINE_READABLE_DESCRIPTOR_ACCEPTANCE_ARCHIVE_BOUND`, and effective
authority `ARCHIVE_IDENTITY_BINDING_ONLY_NO_ADDITIONAL_SEMANTIC_OR_IMPLEMENTATION_AUTHORITY`.
M4A binds that exact M4 type, ID, path, status, effective authority, final UTF-8
byte length, I06, M3 review ID/PASS, artifact path, and descriptor ID/version/revision.

`K334_MACHINE_READABLE_DESCRIPTOR_ARCHIVAL_CLOSURE_V1` has exactly these states
in order: `M3_REVIEW_PASSED`, `M4_DRAFTED`, `M4_FINALIZED_BYTES_FROZEN`,
`I06_COMPUTED`, `M4A_CREATED`, `M4A_VERIFIED`, and
`ARCHIVAL_CLOSURE_COMPLETE`. Only `ARCHIVAL_CLOSURE_COMPLETE` completes the M4
archival closure. The accepted effective state
`MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED_NO_IMPLEMENTATION_AUTHORITY` is
archival-complete only when M4 is final, I06 is computed from final M4 bytes,
M4A exists and binds the exact M4 identity and I06, both records pass closure
verification, and both are included in that same completed closure. M4 text
alone is not completed archival closure.

The mandatory same-closure order is finalize M4, freeze M4 bytes, compute I06,
create M4A, verify M4/M4A, commit both, push, then post-push verify both. Every
one of the following cases produces exactly
`MACHINE_READABLE_DESCRIPTOR_ARCHIVAL_CLOSURE_INCOMPLETE`, never
`ARCHIVAL_CLOSURE_COMPLETE`:

- M4 changes after I06 calculation;
- M4A is absent;
- M4A has the wrong status;
- M4A binds an M4 type other than
  `K334MachineReadableDescriptorInputAcceptanceRecord`, even if its M4 ID,
  path, I06, and every other field are correct;
- M4A binds the wrong M4 ID;
- M4A binds the wrong M4 path;
- the final M4 byte length mismatches;
- I06 mismatches;
- M4A verification fails;
- only M4 is archived;
- only M4A is archived;
- M4 and M4A are both archived but outside the same completed bounded archival
  closure, including a delayed M4A backfill or separate verification that never
  verifies both records together as one closure unit;
- M4 and M4A are not jointly post-push verified; or
- any required archival state transition is skipped.

No invalid case creates a partially accepted archival state. M4 semantic text
may exist, but archival completion remains incomplete, and no implementation,
schema, runtime, or D0-P09 authority follows. A delayed M4A backfill cannot make
an earlier closure complete without a controlled replacement archival closure.
M4A has I06 but no self-hash; no M4B or recursive binding record is required.
M4A adds no semantic authority, but remains mandatory for archival completion.

## 15. Version and Change Control

The artifact represents:

- `descriptorVersion` 1; and
- `K334_PHYSICAL_SCHEMA_REVISION_1`.

The following rules fail closed:

- the same artifact semantic identity with a different parsed value is a
  conflict;
- the same descriptor ID/version/revision with different canonical bytes or
  digest is a conflict;
- a semantic edit cannot be treated as formatting;
- any post-acceptance semantic edit requires a new reviewed artifact revision
  or an explicit corrected acceptance process; and
- any formatting-only edit changes the raw file SHA and requires controlled
  re-archival even if parsed canonical bytes and descriptor digest are
  unchanged.

No accepted artifact is silently updated in place.

## 16. Exactness Test Plan

M2/M3 use temporary documentation-conformance tooling only. It must verify:

1. strict valid JSON parsing with duplicate-key rejection;
2. one root object and the exact 23-key root set;
3. exact nested key sets and no extra fields;
4. exact 17-store count, ordinal order, and 20-key store objects;
5. exact 38-index record count, C-ID order, and 14-key index objects;
6. exactly 37 installable indexes;
7. exact C03 excluded form;
8. exact store/index uniqueness and owner binding;
9. exact dependency, transaction-group, policy, proof, and exclusion arrays;
10. exact database name and v4-to-v5 scalar fields;
11. exact binding to the 9-store/22-index predecessor baseline;
12. exact null, empty-array, boolean, safe-integer, and string forms;
13. deterministic RFC 8785 canonical bytes;
14. Option A two-independent derivation comparison or Option B immutable
     reference identity, strict duplicate-key rejection, canonical-byte length,
     I02/I03, and reviewed-reference verification, with mismatch blocking
     acceptance;
15. lowercase-hex64 I01-I06 separation, exact byte lengths, artifact path,
     I02 canonical-byte checksum, I03 framed digest, and the M4A I06 binding;
16. exact artifact mapping row schema, RFC 6901 pointers, deterministic
     traversal, pointer/`valueKind`/ordinal equality, required zero
     duplicate/missing/extra counts, `MAPPING_POINTER_SET_SHA256`,
     `MAPPING_ROWS_SHA256`, and `ARTIFACT_NODE_TYPE_MANIFEST_SHA256`;
17. separate predecessor evidence paths, exact 9-store/22-index coverage,
     path/`valueKind`/ordinal equality, zero duplicate/missing/extra paths, and
     all three predecessor checksum identities;
18. parse and deterministic reserialization stability;
19. byte-identical reconstruction from the reviewed mapping;
20. no production source, runtime, Vite, public-asset, package-hook, database,
     or automatic-tooling reference to the artifact; and
21. removal of all temporary tools and outputs before archival.

The checks do not create production validators, source modules, schema
mutations, database rows, or implementation authority.

## 17. K-334P09I1 Unblocking Path

After M4 acceptance, a later separately scoped correction may:

- replace prose-derived reconstruction assumptions with the accepted artifact
  input identity;
- derive the complete descriptor topology and topology bytes from that input;
- run two derivations that receive no expected fragment value;
- establish a newly derived fragment count, sequence checksum, and vectors;
  and
- complete the K-334P09I1 architecture review.

M4 does not authorize the six-file implementation scope, source consumption,
fragment limits or counts, schema installation, D0-P09 rebound, or D0-P09
execution. Each later authority boundary remains separate.

## 18. Historical Evidence Classification

Two categories remain distinct.

| Category | Evidence | Meaning |
| --- | --- | --- |
| `PROPOSED_DESIGN_LIMIT_NOT_IMPLEMENTATION_AUTHORITY` | Fragment limit `8,192` | The proposed K-334P09I1 canonical fragment ceiling; it was not invalidated by failed topology derivations, remains subject to later architecture review, and must be rebound in a future implementation-authorization package. |
| `PROVISIONAL_MEASUREMENT_REQUIRES_REDERIVATION` | Fragment count `2,580`; margin `5,612`; aggregate topology SHA `EE624658E1CA3A9F476C1A5A34830E3F7539248D175FC9FC8D0BE1213D8C2F6E`; prior temporary derivation script SHAs; prior fragment-count provenance | Not accepted implementation-authorization evidence, not a fixed test literal, and not implementation-readiness proof. Each must be re-derived from the M4-accepted artifact without expected-value input. |

The proposed `8,192` ceiling is independent of whether `2,580` is valid.
`5,612` is derived from `8,192 - 2,580`, remains provisional, and may change
after re-derivation. A re-derived count greater than `8,192` reopens the
proposed design limit. M4 acceptance does not itself validate the count or
margin.

## 19. Source-Authority and Dormancy Exclusions

The proposed JSON artifact is documentation authority only:

- production TypeScript must not import it without separate design and
  authorization;
- it is not Vite-bundled, copied into public assets, loaded by database code,
  or interpreted by a package hook;
- no runtime code path reads it;
- acceptance does not make any source eligible;
- artifact tooling cannot modify schema or database version;
- artifact creation creates no authority row, localStorage value, runtime
  configuration, or package metadata; and
- no automatic source generation occurs.

This design does not authorize K-334D implementation, K-334E/F, D0-P09,
D0-P10, runtime, admission, eligibility, activation, or production behavior.

## 20. Review Strategy

| Work | Reviewer/model | Reasoning |
| --- | --- | --- |
| M1 design and M2 artifact/transcription architecture review | Sol | Maximum |
| M3 independent equivalence review | Sol | Maximum |
| M4 bounded acceptance | GPT-5.6 | Medium |
| M4A documentation/archive closure | GPT-5.6 | Medium |
| Later exact topology/vector derivation after acceptance | GPT-5.6 | Medium or Low |

M3 is independent from M2 authoring and directly inspects the governing
proposal/acceptance, strict parse, bootstrap derivation or reference,
mapping-totality evidence, hashes, and dormancy. It returns only `PASS` or
`CHANGES_REQUIRED` and creates no acceptance authority. The equivalence review
needs maximum reasoning because it must prove a total cross-document
transcription, exact joins, exact array order, canonical nulls, and unchanged
authority boundaries. Later calculations become bounded and mechanical only
after the input value is accepted.

## 21. Readiness Result

All accepted descriptor fields and ordering rules appear sufficient to create
a complete exact artifact without semantic invention.

| Readiness item identity | Exact contract or section | State | Evidence |
| --- | --- | --- | --- |
| Exact M4 type | Section 14.2 | `READY_FOR_REVIEW` | One fixed type literal. |
| Exact M4 ID | Sections 11 and 14.2 | `READY_FOR_REVIEW` | One fixed acceptance-record ID. |
| Exact M4 path | Sections 11 and 14.2 | `READY_FOR_REVIEW` | One fixed repository path. |
| Exact M4 status | Sections 11 and 14.2 | `READY_FOR_REVIEW` | One fixed accepted status. |
| Exact M4 effective authority | Sections 11 and 14.2 | `READY_FOR_REVIEW` | Input authority excludes implementation. |
| Exact M4A type | Section 14.2 | `READY_FOR_REVIEW` | One fixed archive-binding type. |
| Exact M4A ID | Sections 11 and 14.2 | `READY_FOR_REVIEW` | One fixed archive-binding ID. |
| Exact M4A path | Sections 11 and 14.2 | `READY_FOR_REVIEW` | One fixed repository path. |
| Exact M4A status | Sections 11 and 14.2 | `READY_FOR_REVIEW` | One fixed archive-bound status. |
| Exact M4A effective authority | Sections 11 and 14.2 | `READY_FOR_REVIEW` | Archive identity only. |
| Exact bound M4 type | Section 14.2 | `READY_FOR_REVIEW` | M4A binds the fixed M4 type. |
| Exact bound M4 ID | Section 14.2 | `READY_FOR_REVIEW` | M4A binds the fixed M4 ID. |
| Exact bound M4 path | Section 14.2 | `READY_FOR_REVIEW` | M4A binds the fixed M4 path. |
| Exact M4 final-byte-length binding | Section 14.2 | `READY_FOR_REVIEW` | Final UTF-8 byte length is mandatory. |
| Exact I06 binding | Sections 10 and 14.2 | `READY_FOR_REVIEW` | M4A binds the final-M4 SHA-256. |
| Archival state-machine identity | Section 14.2 | `READY_FOR_REVIEW` | One fixed lifecycle identity. |
| Ordered seven-state sequence | Section 14.2 | `READY_FOR_REVIEW` | All seven states are fixed in order. |
| M4 finalization before I06 | Section 14.2 | `READY_FOR_REVIEW` | Final M4 bytes are frozen first. |
| M4A creation after I06 | Section 14.2 | `READY_FOR_REVIEW` | M4A follows I06 computation. |
| M4A verification requirement | Section 14.2 | `READY_FOR_REVIEW` | Verification precedes completion. |
| Archival authority timing | Section 14.2 | `READY_FOR_REVIEW` | M4 text alone is incomplete. |
| Same-closure requirement | Section 14.2 | `READY_FOR_REVIEW` | M4 and M4A share one bounded closure. |
| Post-push joint verification | Section 14.2 | `READY_FOR_REVIEW` | Both records are verified together after push. |
| M4A failure rule | Section 14.2 | `READY_FOR_REVIEW` | Every enumerated failure maps to incomplete. |
| Wrong-M4-type failure rule | Section 14.2 | `READY_FOR_REVIEW` | Wrong bound type maps to incomplete. |
| Outside-same-closure failure rule | Section 14.2 | `READY_FOR_REVIEW` | Delayed or separate archival maps to incomplete. |
| Incomplete-closure state | Section 14.2 | `READY_FOR_REVIEW` | One exact bounded failure state. |
| No partial-success rule | Section 14.2 | `READY_FOR_REVIEW` | Invalid closure creates no partial acceptance. |
| Non-recursive M4 binding | Sections 10 and 14.2 | `READY_FOR_REVIEW` | M4 does not contain I06. |
| Non-recursive M4A binding | Section 14.2 | `READY_FOR_REVIEW` | M4A contains no normative self-hash. |
| No M4B requirement | Section 14.2 | `READY_FOR_REVIEW` | External archive evidence terminates the chain. |
| Predecessor scheme | Section 12.4.1 | `READY_FOR_REVIEW` | The scheme is exactly `predecessor://`. |
| Predecessor root path | Section 12.4.1 | `READY_FOR_REVIEW` | The evidence root has one exact path. |
| Database object path | Section 12.4.1 | `READY_FOR_REVIEW` | The database object has one exact path. |
| Database name path | Section 12.4.1 | `READY_FOR_REVIEW` | Database name has one exact path. |
| Database version path | Section 12.4.1 | `READY_FOR_REVIEW` | Database version has one exact path. |
| Stores collection path | Section 12.4.1 | `READY_FOR_REVIEW` | Stores have one collection path. |
| Indexes collection path | Section 12.4.1 | `READY_FOR_REVIEW` | Indexes have one global collection path. |
| Root top-level child relationship | Section 12.4.1 | `READY_FOR_REVIEW` | Only database, stores, and indexes are children. |
| Global store ordinal scope | Section 12.4.1 | `READY_FOR_REVIEW` | Store ordinals are predecessor-global. |
| Store ordinal range 1..9 | Section 12.4.1 | `READY_FOR_REVIEW` | Exactly nine ordinals are allowed. |
| Store ordinal decimal syntax | Section 12.4.1 | `READY_FOR_REVIEW` | Ordinals use ASCII decimal. |
| Store ordinal no-leading-zero rule | Section 12.4.1 | `READY_FOR_REVIEW` | Leading zeroes are forbidden. |
| Store base-path grammar | Section 12.4.1 | `READY_FOR_REVIEW` | One ordinal-based form is fixed. |
| Closed store field inventory | Section 12.4.1 | `READY_FOR_REVIEW` | Exactly three field names are allowed. |
| Store field ordering | Section 12.4.1 | `READY_FOR_REVIEW` | Field traversal order is fixed. |
| Store keyPath array-component grammar | Section 12.4.1 | `READY_FOR_REVIEW` | Array container and element paths are exact. |
| Exact nine-store coverage | Sections 12.4 and 12.4.1 | `READY_FOR_REVIEW` | All nine store objects are mandatory. |
| Global index ordinal scope | Section 12.4.1 | `READY_FOR_REVIEW` | Index ordinals are predecessor-global. |
| Index ordinal range 1..22 | Section 12.4.1 | `READY_FOR_REVIEW` | Exactly 22 ordinals are allowed. |
| Index ordinal decimal syntax | Section 12.4.1 | `READY_FOR_REVIEW` | Ordinals use ASCII decimal. |
| Index ordinal no-leading-zero rule | Section 12.4.1 | `READY_FOR_REVIEW` | Leading zeroes are forbidden. |
| Index base-path grammar | Section 12.4.1 | `READY_FOR_REVIEW` | One global ordinal-based form is fixed. |
| Closed index field inventory | Section 12.4.1 | `READY_FOR_REVIEW` | Exactly five field names are allowed. |
| Index field ordering | Section 12.4.1 | `READY_FOR_REVIEW` | Field traversal order is fixed. |
| storeOrdinal ownership field | Section 12.4.1 | `READY_FOR_REVIEW` | Every index identifies its owning store. |
| Prohibition on store-nested index identities | Section 12.4.1 | `READY_FOR_REVIEW` | Only global index paths are allowed. |
| Index keyPath array-component grammar | Section 12.4.1 | `READY_FOR_REVIEW` | Array container and element paths are exact. |
| Exact 22-index coverage | Sections 12.4 and 12.4.1 | `READY_FOR_REVIEW` | All 22 index objects are mandatory. |
| UTF-8 segment encoding | Section 12.4.1 | `READY_FOR_REVIEW` | Variable segments derive from UTF-8 bytes. |
| Unreserved-character rule | Section 12.4.1 | `READY_FOR_REVIEW` | The literal character set is fixed. |
| Percent encoding of all other bytes | Section 12.4.1 | `READY_FOR_REVIEW` | Every non-unreserved byte is encoded. |
| Uppercase percent-hex requirement | Section 12.4.1 | `READY_FOR_REVIEW` | Lowercase hex is noncanonical. |
| Slash separator rule | Section 12.4.1 | `READY_FOR_REVIEW` | Slash only separates grammar segments. |
| Valid UTF-8 decode requirement | Section 12.4.1 | `READY_FOR_REVIEW` | Decoding must yield valid UTF-8. |
| Malformed encoding rejection | Section 12.4.1 | `READY_FOR_REVIEW` | Malformed encoding fails closed. |
| Noncanonical encoding rejection | Section 12.4.1 | `READY_FOR_REVIEW` | Noncanonical encoding fails closed. |
| Root-first traversal | Section 12.4.1 | `READY_FOR_REVIEW` | Traversal begins at the evidence root. |
| Database-before-collections ordering | Section 12.4.1 | `READY_FOR_REVIEW` | Database precedes both collections. |
| Fixed database-field order | Section 12.4.1 | `READY_FOR_REVIEW` | Name precedes version. |
| Stores-before-indexes ordering | Section 12.4.1 | `READY_FOR_REVIEW` | Stores precede global indexes. |
| Store ordinal traversal 1..9 | Section 12.4.1 | `READY_FOR_REVIEW` | Stores traverse in ascending ordinal order. |
| Fixed store-field order | Section 12.4.1 | `READY_FOR_REVIEW` | Store child order is exact. |
| Array elements immediately after container | Section 12.4.1 | `READY_FOR_REVIEW` | Components directly follow their array row. |
| Index ordinal traversal 1..22 | Section 12.4.1 | `READY_FOR_REVIEW` | Indexes traverse in ascending global order. |
| Fixed index-field order | Section 12.4.1 | `READY_FOR_REVIEW` | Index child order is exact. |
| Traversal-to-row-ordinal binding | Section 12.4.1 | `READY_FOR_REVIEW` | Traversal fixes row ordinals. |
| Traversal-to-path-checksum binding | Section 12.4.1 | `READY_FOR_REVIEW` | Traversal fixes path-set order. |
| Traversal-to-row-checksum binding | Section 12.4.1 | `READY_FOR_REVIEW` | Traversal fixes mapping-row order. |
| Traversal-to-node-type-manifest binding | Section 12.4.1 | `READY_FOR_REVIEW` | Traversal identity enters the manifest. |
| Exact predecessor root coverage | Section 12.4.1 | `READY_FOR_REVIEW` | The root has exactly one row. |
| Exact predecessor database coverage | Section 12.4.1 | `READY_FOR_REVIEW` | The database object has exactly one row. |
| Exact stores collection coverage | Section 12.4.1 | `READY_FOR_REVIEW` | The stores collection has exactly one row. |
| Exact indexes collection coverage | Section 12.4.1 | `READY_FOR_REVIEW` | The indexes collection has exactly one row. |
| Exact database-field coverage | Section 12.4.1 | `READY_FOR_REVIEW` | Both fixed database fields are covered. |
| Exact store-object coverage | Section 12.4.1 | `READY_FOR_REVIEW` | Every required store object is covered. |
| Exact store-field coverage | Section 12.4.1 | `READY_FOR_REVIEW` | Every fixed store field is covered. |
| Exact index-object coverage | Section 12.4.1 | `READY_FOR_REVIEW` | Every required index object is covered. |
| Exact index-field coverage | Section 12.4.1 | `READY_FOR_REVIEW` | Every fixed index field is covered. |
| Exact array-component coverage | Section 12.4.1 | `READY_FOR_REVIEW` | Every required component row is covered. |
| Predecessor evidencePath equality | Sections 12.4 and 13 | `READY_FOR_REVIEW` | Expected and observed paths must match. |
| Predecessor valueKind equality | Sections 12.4 and 13 | `READY_FOR_REVIEW` | Expected and observed kinds must match. |
| Predecessor ordinal equality | Sections 12.4 and 13 | `READY_FOR_REVIEW` | Expected and observed ordinals must match. |
| Predecessor row-count equality | Sections 12.4 and 13 | `READY_FOR_REVIEW` | Expected and observed counts must match. |
| Duplicate predecessor paths = 0 | Section 12.4 | `READY_FOR_REVIEW` | Duplicate paths block acceptance. |
| Missing predecessor paths = 0 | Section 12.4 | `READY_FOR_REVIEW` | Missing paths block acceptance. |
| Extra predecessor paths = 0 | Section 12.4 | `READY_FOR_REVIEW` | Extra paths block acceptance. |
| PREDECESSOR_PATH_SET_SHA256 identity | Section 12.4 | `READY_FOR_REVIEW` | One exact checksum identity is fixed. |
| Predecessor path-set preimage | Section 12.4 | `READY_FOR_REVIEW` | Ordered evidencePath array is the preimage. |
| PREDECESSOR_MAPPING_ROWS_SHA256 identity | Section 12.4 | `READY_FOR_REVIEW` | One exact checksum identity is fixed. |
| Predecessor mapping-row preimage | Section 12.4 | `READY_FOR_REVIEW` | Ordinal-ordered exact rows are the preimage. |
| PREDECESSOR_NODE_TYPE_MANIFEST_SHA256 identity | Section 12.4 | `READY_FOR_REVIEW` | One exact checksum identity is fixed. |
| Predecessor node/type manifest preimage | Section 12.4 | `READY_FOR_REVIEW` | Exact counts and traversal identity form the preimage. |
| Predecessor RFC 8785 encoding | Section 12.4 | `READY_FOR_REVIEW` | Each checksum uses canonical JSON. |
| Predecessor UTF-8 byte domain | Section 12.4 | `READY_FOR_REVIEW` | Canonical JSON is UTF-8 encoded. |
| Predecessor SHA-256 algorithm | Section 12.4 | `READY_FOR_REVIEW` | SHA-256 is mandatory. |
| Predecessor lowercase-hex64 output | Sections 10 and 12.4 | `READY_FOR_REVIEW` | Output uses `LOWERCASE_HEX64_SHA256_V1`. |
| Rendered-Markdown checksum exclusion | Section 12.4 | `READY_FOR_REVIEW` | Rendered Markdown is never a preimage. |
| Documentation-owned artifact model | Sections 2 and 3 | `READY_FOR_REVIEW` | The JSON remains documentation authority. |
| Accepted transcription boundary | Sections 3 and 4 | `READY_FOR_REVIEW` | Only accepted semantic facts are transcribed. |
| Canonicalization bootstrap selection | Section 9 | `READY_FOR_REVIEW` | M2 must select exactly one reviewed option. |
| Option A requirements | Section 9.1 | `READY_FOR_REVIEW` | Independent derivations are fully specified. |
| Option B requirements | Section 9.2 | `READY_FOR_REVIEW` | Immutable reference evidence is fully specified. |
| Strict duplicate-key rejection | Section 9.2 | `READY_FOR_REVIEW` | Duplicate keys fail before parsing acceptance. |
| Production-oracle exclusion | Sections 9 and 19 | `READY_FOR_REVIEW` | Production code cannot establish descriptor truth. |
| I01 raw artifact identity | Section 10 | `READY_FOR_REVIEW` | Exact raw-file digest identity is fixed. |
| I02 canonical-byte identity | Section 10 | `READY_FOR_REVIEW` | Exact parsed canonical-byte digest is fixed. |
| I03 domain-framed identity | Section 10 | `READY_FOR_REVIEW` | Exact framed descriptor digest is fixed. |
| I04 governing-proposal identity | Section 10 | `READY_FOR_REVIEW` | Exact proposal-document digest is fixed. |
| I05 non-self-reference | Section 10 | `READY_FOR_REVIEW` | M3/M4 bind finalized M2 bytes externally. |
| I06 non-self-reference | Sections 10 and 14.2 | `READY_FOR_REVIEW` | M4A binds finalized M4 bytes externally. |
| Artifact mapping domain | Section 12 | `READY_FOR_REVIEW` | Artifact nodes use their own manifest domain. |
| Artifact row schema | Section 12.1 | `READY_FOR_REVIEW` | The exact eight-field row schema is fixed. |
| INTEGER value kind | Section 12.1 | `READY_FOR_REVIEW` | Integer values have a distinct exact kind. |
| Artifact pointer semantics | Section 12.2 | `READY_FOR_REVIEW` | RFC 6901 pointer rules are exact. |
| Artifact one-pointer-one-row model | Section 12.2 | `READY_FOR_REVIEW` | Every artifact node receives one row. |
| Artifact traversal | Section 12.2 | `READY_FOR_REVIEW` | Depth-first UTF-16 ordering is fixed. |
| Artifact pointer equality | Sections 12.3 and 13 | `READY_FOR_REVIEW` | Expected and observed pointers must match. |
| Artifact valueKind equality | Sections 12.3 and 13 | `READY_FOR_REVIEW` | Expected and observed kinds must match. |
| Artifact ordinal equality | Sections 12.3 and 13 | `READY_FOR_REVIEW` | Expected and observed ordinals must match. |
| Artifact completeness manifest | Section 12.3 | `READY_FOR_REVIEW` | Counts and zero-error totals are fixed. |
| Artifact pointer-set checksum | Section 12.3 | `READY_FOR_REVIEW` | Pointer-set preimage is exact. |
| Artifact mapping-row checksum | Section 12.3 | `READY_FOR_REVIEW` | Mapping-row preimage is exact. |
| Artifact node/type manifest checksum | Section 12.3 | `READY_FOR_REVIEW` | Node/type preimage is exact. |
| Cross-domain separation | Section 12.4 | `READY_FOR_REVIEW` | Neither domain satisfies the other. |
| M3 independence | Section 13 | `READY_FOR_REVIEW` | Independent verification precedes acceptance. |
| M4/M4A closure | Section 14.2 | `READY_FOR_REVIEW` | Acceptance archival closure is deterministic. |
| Historical design-limit classification | Section 18 | `READY_FOR_REVIEW` | The limit remains proposed-only. |
| Provisional measurement classification | Section 18 | `READY_FOR_REVIEW` | Measurements require re-derivation. |
| Production dormancy | Section 19 | `READY_FOR_REVIEW` | No runtime path reaches the artifact. |
| Authority exclusions | Sections 19 and 22 | `READY_FOR_REVIEW` | Implementation and proof authority remain absent. |

`MACHINE_READABLE_DESCRIPTOR_ARTIFACT_PACKAGE_READY_FOR_ARCHITECTURE_REVIEW`

Every readiness entry is exactly `READY_FOR_REVIEW` or `BLOCKED`. The package
result above is permitted only when every required entry is `READY_FOR_REVIEW`;
otherwise the result is `MACHINE_READABLE_DESCRIPTOR_ARTIFACT_PACKAGE_BLOCKED`.
This is readiness to review the design. It is not descriptor-input acceptance,
implementation authorization, or proof authority.

## 22. Authorization State

| State | Count |
| --- | ---: |
| Authority-input resolution proposal | 1 |
| Authority-input resolution accepted | 1 |
| B01-B08 authority inputs resolved | 1 |
| Descriptor-authority prerequisite proposed | 1 |
| Descriptor-authority prerequisite accepted | 1 |
| Machine-readable descriptor input proposed | 0 |
| Machine-readable descriptor input accepted | 0 |
| Descriptor implementation authorization proposed | 0 |
| Descriptor implementation authorization accepted | 0 |
| Descriptor implementation | 0 |
| Descriptor authority accepted | 0 |
| D0-P09 authorization rebound | 0/0 |
| Effective D0-P09 execution authority | 0 |
| D0-P09 execution | 0 |
| D0-P09 satisfaction | 0 |
| D0-P10 | 0/0 |
| K-334E/F authorization | 0/0 |
| Runtime authorization | 0 |
| Production eligibility | 0 |

## 23. Production Boundary

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
