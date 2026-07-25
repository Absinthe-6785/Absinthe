# K-334P09M4: Machine-Readable Descriptor Input Acceptance Record

## 1. Document Identity

| Field | Value |
| --- | --- |
| Type | `K334MachineReadableDescriptorInputAcceptanceRecord` |
| ID | `K-334P09M4-MACHINE-READABLE-DESCRIPTOR-INPUT-ACCEPTANCE-001` |
| Path | `frontend/docs/K-334P09M4-machine-readable-descriptor-input-acceptance-record.md` |
| Status | `MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED` |
| Effective authority | `MACHINE_READABLE_DESCRIPTOR_INPUT_ACCEPTED_NO_IMPLEMENTATION_AUTHORITY` |

## 2. Governing Authority

This record applies the accepted semantic prerequisite proposal `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001` and its acceptance `K-334P09P8-DESCRIPTOR-AUTHORITY-PREREQUISITE-ACCEPTANCE-001`. Their frozen document SHA-256 values are respectively `e21782092cbb03bdd68d65c4e57d7ac87f14078a60561b9dd1e36f1e5827c92a` and the repository-bound acceptance evidence identified by that acceptance record. It accepts the M1/M2 input package only; it creates no implementation authority.

## 3. Accepted Artifact Identity

| Field | Value |
| --- | --- |
| Path | `frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json` |
| Descriptor ID | `K-334-CANONICAL-PHYSICAL-SCHEMA-001` |
| Format | `K334_MACHINE_READABLE_DESCRIPTOR_JSON_V1` |
| Descriptor version | `1` |
| Physical schema revision | `K334_PHYSICAL_SCHEMA_REVISION_1` |

## 4. Bound I01-I05 Identity Inventory

All values use `LOWERCASE_HEX64_SHA256_V1`.

| Identity | Bound value |
| --- | --- |
| I01 raw JSON artifact | `8fb8e8604cd26a2da91bc7537f0fb17cbc4ec0195e5a95271928d6e1def73313` |
| I02 parsed canonical descriptor bytes | `127916e6d6008bd03b68eaef1c4bf128772ce007ee56207d9481e9ad08f70d02` |
| I03 domain-framed descriptor digest | `bf5609cada6425f6a82bec65d7574d60a71c334b92ec98e41e7f5d6234d22e07` |
| I04 governing semantic proposal | `e21782092cbb03bdd68d65c4e57d7ac87f14078a60561b9dd1e36f1e5827c92a` |
| I05 frozen M2 proposal | `ac638857475fbc8dd1b352ddaef1728a5e636c6016e76f17a363ca7a59559723` |

The M1 design is `K-334P09M1-MACHINE-READABLE-CANONICAL-DESCRIPTOR-INPUT-AUTHORITY-DESIGN-001` at `frontend/docs/K-334P09M1-machine-readable-canonical-descriptor-input-authority-design.md`, SHA-256 `ed7b0c2cd25f08be41313fdb18c5830ce88d55fb734b5b4a53d01cd93fadc1f5`. The M2 proposal is `K-334P09M2-MACHINE-READABLE-DESCRIPTOR-TRANSCRIPTION-001` at `frontend/docs/K-334P09M2-machine-readable-descriptor-transcription-proposal.md` and is bound by I05.

## 5. Artifact Format and Byte Facts

The accepted raw JSON is 55,437 UTF-8 bytes. Its independently canonicalized parsed descriptor is 43,010 bytes. It has 23 root fields, 17 stores, 38 index descriptor records, 37 installable indexes, seven dependencies, one transaction group, three proof layers, and 12 authority exclusions.

## 6. Descriptor Completeness

Acceptance covers the exact 23-root-field descriptor value, including its identity, version, physical revision, database/version authority, canonicalization, stores, indexes, dependencies, transaction group, policies, verification, proof layers, and authority exclusions. It accepts no inferred or alternate descriptor.

## 7. Store and Index Acceptance

The exact accepted stores are `authority_subjects`, `authority_issuers`, `authority_issuer_policies`, `authority_evidence`, `authority_rollback_permissions`, `authority_terminations`, `authority_compatibility_tuples`, `authority_external_mappings`, `authority_fork_observations`, `authority_conflict_observations`, `authority_quarantines`, `authority_migration_sessions`, `authority_migration_classifications`, `authority_migration_checkpoints`, `authority_recovery_markers`, `authority_heads`, and `authority_audit_events`. The exact index inventory is C01 through C38, subject only to the C03 exclusion below.

## 8. C03 Exclusion Acceptance

`C03` is the sole accepted excluded index. The 37 installable indexes are exactly C01, C02, and C04 through C38; this acceptance neither installs nor authorizes any index.

## 9. Dependency and Transaction Acceptance

Acceptance binds the seven exact dependency records and the single transaction group `TG-K334-V4-V5-ADDITIVE-001`, including its exact member stores, installable indexes, excluded C03, atomicity, predecessor-preservation, and failure-effect declarations. Those declarations are descriptor evidence only, not permission to mutate a database.

## 10. Policy and Proof-Layer Acceptance

Acceptance binds the exact conflict policy, retry policy, post-install verification declaration, three proof layers, and 12 authority exclusions encoded in the artifact. It does not execute or satisfy any proof.

## 11. Artifact Mapping Acceptance

The artifact mapping is total for 1,418 rows: 69 object, 116 array, 996 string, 91 integer, 101 boolean, and 45 null nodes. This accepts the mapping as evidence of the bound artifact only.

## 12. Predecessor Mapping Acceptance

The predecessor evidence mapping is total for 252 rows: 33 object, 29 array, 113 string, 23 integer, 53 boolean, and one null node, covering nine predecessor stores and 22 predecessor indexes. It is evidence, not a migration instruction.

## 13. Mapping Checksum Acceptance

| Mapping identity | SHA-256 |
| --- | --- |
| `MAPPING_POINTER_SET_SHA256` | `7a729057e3294249b5b43a454734c15c3c014c891bef19c0b2dc60761814a01c` |
| `MAPPING_ROWS_SHA256` | `5c4d1e84ce295d1d955e9234102ce2ad8954f05e1771dd0d5c9b6c76028047a0` |
| `ARTIFACT_NODE_TYPE_MANIFEST_SHA256` | `79e2b4a9361e011f3639b3c3a71f0c01644c71a18dc3706518d6c6d8474c9a55` |
| `PREDECESSOR_PATH_SET_SHA256` | `4ac35f84f8853305f61b692d32369687203239fb2c97569df5f0ab22fcbde8d5` |
| `PREDECESSOR_MAPPING_ROWS_SHA256` | `bfbcf0c879437fe8e0489901f86ff08724382a4486723db993bb425e8a1728df` |
| `PREDECESSOR_NODE_TYPE_MANIFEST_SHA256` | `7fc8584ffcf88e8189fb4325ff67f90a0ca4f942c51565aa5d68b7604a98a758` |

Together, 1,670 mapping rows were independently verified and zero were rejected.

## 14. M3 Independent Review Binding

This acceptance is informed by `K-334P09M3`, whose verdict was `PASS`. Its independent tool identity is `K334_M3_INDEPENDENT_EQUIVALENCE_REVIEW_TOOL_V1`, SHA-256 `27cab3ac3fc07adfcb2aed4562bee8f623097924fd613a4f87caa4ab1efe6f84`, executed on Node `v24.14.0`. M3 independently verified canonical length 43,010, 1,670 rows, and zero rejected rows; it found no remaining defects. M3 did not itself create acceptance authority.

## 15. Canonicalization Evidence Binding

I02 and I03 bind the independently parsed canonical descriptor bytes and domain-framed digest. This record accepts that canonicalization evidence, but does not authorize a canonicalization helper, source generation, or runtime consumer.

## 16. Dormancy Confirmation

The artifact is documentation-owned and dormant: production JSON imports, artifact-path and descriptor-ID references, source/runtime loaders, Vite/public copies, build/package hooks, schema/database consumers, source generators, and production test fixtures are all zero. Documentation references are permitted.

## 17. Historical Evidence Classification

`8,192` remains `PROPOSED_DESIGN_LIMIT_NOT_IMPLEMENTATION_AUTHORITY`. The historical fragment count `2,580`, fragment margin `5,612`, historical aggregate topology SHA, prior temporary-script hashes, and prior count provenance remain provisional. Acceptance of the JSON does not validate those historical implementation measurements; they must be re-derived later under the accepted-artifact I1 contract.

## 18. Exact Acceptance Scope

This record accepts exactly the bound JSON artifact, parsed canonical descriptor value, I01-I05, descriptor ID/version/revision, exact root/store/index/dependency/transaction/policy/proof/exclusion contents, artifact and predecessor evidence mappings, all six mapping identities, M3 `PASS`, and documentation ownership/dormancy.

## 19. Authority Exclusions

This acceptance does not accept or authorize production implementation, IndexedDB metadata helpers, schema installers, v4-to-v5 database mutation, migration or recovery execution, runtime loading, test-fixture generation, D0-P10, K-334E/F, or production eligibility.

## 20. Implementation-Authority Denial

Descriptor implementation authorization proposed: `0`; descriptor implementation authorization accepted: `0`; descriptor implementation: `0`; schema mutation: `0`. Acceptance of input is not authorization to create source, repositories, or transactions.

## 21. Schema/Runtime/D0-P09 Denial

No database version change is authorized. Runtime authorization is `0`. D0-P09 authorization rebound is `0/0`, execution is `0`, and satisfaction is `0`; D0-P10 is `0/0`; K-334E/F is `0/0`. This record does not rebound or execute D0-P09.

## 22. M4A Requirement

Before archival closure, this M4 document must be finalized as UTF-8 without BOM, LF-only with exactly one final LF and no trailing whitespace. Its frozen raw bytes must be hashed as I06, then a separate M4A archive-binding record must bind that exact byte length and I06. M4 must not be changed after that freeze.

## 23. Production Boundary

Machine-readable descriptor input proposed: `1`; accepted: `1`; M3 review: `PASS`. This is documentation authority only: the JSON is not runtime-loadable, no source is eligible, and no database version change is authorized.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
