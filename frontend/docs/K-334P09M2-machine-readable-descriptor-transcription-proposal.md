# K-334P09M2 — Machine-Readable Descriptor Transcription Proposal

## 1. Document Identity

| Field | Exact value |
| --- | --- |
| Type | `K334MachineReadableDescriptorTranscriptionProposal` |
| Proposal ID | `K-334P09M2-MACHINE-READABLE-DESCRIPTOR-TRANSCRIPTION-001` |
| Status | `MACHINE_READABLE_DESCRIPTOR_INPUT_PROPOSED` |
| Effective authority | `PROPOSED_MACHINE_READABLE_DESCRIPTOR_INPUT_NO_EFFECTIVE_AUTHORITY` |
| Artifact semantic identity | `K-334-CANONICAL-PHYSICAL-SCHEMA-001` |
| Artifact format | `K334_MACHINE_READABLE_DESCRIPTOR_JSON_V1` |
| Descriptor version | `1` |
| Physical revision | `K334_PHYSICAL_SCHEMA_REVISION_1` |
| Mapping domain | `ARTIFACT_DESCRIPTOR_MAPPING_DOMAIN_V1` |
| Predecessor domain | `PREDECESSOR_BASELINE_EVIDENCE_MAPPING_DOMAIN_V1` |

This record proposes a byte-exact, machine-readable transcription and no more. The JSON artifact has no effective descriptor authority until the separately authorized M3 review and M4 acceptance lifecycle is completed.

## 2. Governing Authority

| Authority | Exact binding |
| --- | --- |
| M1 design | `K-334P09M1-MACHINE-READABLE-CANONICAL-DESCRIPTOR-INPUT-AUTHORITY-DESIGN-001` |
| M1 reviewed SHA-256 | `ed7b0c2cd25f08be41313fdb18c5830ce88d55fb734b5b4a53d01cd93fadc1f5` |
| M1 review | `K-334P09M1R5` — `PASS` |
| Governing proposal | `frontend/docs/K-334P09P-canonical-descriptor-authority-prerequisite-proposal.md` |
| Proposal ID | `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001` |
| Proposal source SHA-256 / I04 | `e21782092cbb03bdd68d65c4e57d7ac87f14078a60561b9dd1e36f1e5827c92a` |
| Governing acceptance | `frontend/docs/K-334P09P8-canonical-descriptor-authority-prerequisite-acceptance-record.md` |
| Acceptance ID | `K-334P09P8-DESCRIPTOR-AUTHORITY-PREREQUISITE-ACCEPTANCE-001` |

The governing Markdown proposal and acceptance remain authoritative. This M2 record does not supersede either source and does not create a second schema authority.

## 3. Proposal-Only Authority State

The lifecycle state is proposed only: one machine-readable input is proposed, zero are accepted, every mapping row is `UNREVIEWED`, and no implementation, schema mutation, proof execution, runtime, eligibility, or production authority is created. M3 review is mandatory, and the later M4 acceptance plus M4A archive binding are mandatory before completed acceptance archival closure.

## 4. Artifact Path and Format

- Artifact: `frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json`
- Encoding: UTF-8.
- BOM: absent.
- Line endings: LF.
- Indentation: two spaces.
- Final terminator: exactly one LF.
- Raw artifact byte length: `55437`.
- Raw artifact SHA-256: `8fb8e8604cd26a2da91bc7537f0fb17cbc4ec0195e5a95271928d6e1def73313`.
- Root presentation order: the exact 23-key order required by M1, beginning with `descriptorKind` and ending with `authorityExclusions`.
- Strict parse boundary: duplicate object member names are rejected before canonicalization; trailing tokens, non-integer numbers, negative zero, unpaired surrogates, and non-NFC strings are rejected.

## 5. Transcription Boundary

The artifact is a literal transcription of the accepted K-334P09P descriptor authority. M2 does not infer missing values, repair source text, choose implementation behavior, install schema, open a database, execute D0-P09/D0-P10, or create acceptance authority.

## 6. Root Descriptor Completeness

| Inventory | Exact count |
| --- | ---: |
| Root keys | 23 |
| Stores | 17 |
| Store keys per entry | 20 |
| Index records | 38 |
| Index keys per entry | 14 |
| Installable indexes | 37 |
| Rejected index declarations | 1 |
| Dependency edges | 7 |
| Transaction groups | 1 |
| Proof layers | 3 |
| Authority exclusions | 12 |

The root contains the exact closed 23-key inventory in the required presentation order and no unknown key.

## 7. Store Inventory Summary

The artifact contains the exact 17 accepted store descriptors in ordinal order. Every store entry has exactly 20 keys, the accepted key path, `autoIncrement=false`, exact binding fields, and `installationDisposition=ACCEPTED_ADDITIVE_STORE`.

## 8. Index Inventory Summary

The artifact contains the exact 38 index records in C01–C38 ordinal order: 37 `ACCEPTED_INSTALLABLE_INDEX` records and one exact excluded record. Every entry has exactly 14 keys.

## 9. C03 Exclusion Confirmation

`C03` is present exactly as a rejected, non-installed index declaration with null physical index fields and no fabricated direct-source fields. It is not an installable index.

Its exact identity is `k334.index.authority_audit_events.by_subject.v1`; its owner is `k334.store.authority_audit_events.v1`; its name is `by_subject`; its disposition is `ACCEPTED_EXCLUDED_INDEX`; its behavior is `NOT_APPLICABLE_EXCLUDED_INDEX` / `EXCLUDED_NO_SUBJECT_SOURCE`.

## 10. Canonicalization Bootstrap Selection

Option A was used because the repository does not contain a currently valid, accepted machine artifact to which Option B could bind. Two independent temporary strict parsers and RFC 8785 serializers were run against the same final raw bytes.

## 11. Canonicalization Evidence

| Evidence | Derivation A | Derivation B |
| --- | --- | --- |
| Tool identity | `K334_M2_CANONICALIZER_A_V2` | `K334_M2_CANONICALIZER_B_V2` |
| Parser identity | `recursive-descent-strict-json-a-v2` | `independent-lexical-duplicate-scan-plus-json-parse-b-v2` |
| Runtime | `v24.14.0` | `v24.14.0` |
| Script SHA-256 | `ce9c1c98f3609a0f1ed1ddc3eefec2ac1ed59607248157637c439c4d05544f01` | `3a330d582f9b8e391cfc84fce9aea26e05db172d5265276e9b0d2a345543cc3c` |
| Exact invocation | `node .tmp-k334-m2-canon-a.mjs frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json` | `node .tmp-k334-m2-canon-b.mjs frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json` |
| Raw SHA-256 | `8fb8e8604cd26a2da91bc7537f0fb17cbc4ec0195e5a95271928d6e1def73313` | `8fb8e8604cd26a2da91bc7537f0fb17cbc4ec0195e5a95271928d6e1def73313` |
| Canonical byte length | 43010 | 43010 |
| I02 | `127916e6d6008bd03b68eaef1c4bf128772ce007ee56207d9481e9ad08f70d02` | `127916e6d6008bd03b68eaef1c4bf128772ce007ee56207d9481e9ad08f70d02` |
| I03 | `bf5609cada6425f6a82bec65d7574d60a71c334b92ec98e41e7f5d6234d22e07` | `bf5609cada6425f6a82bec65d7574d60a71c334b92ec98e41e7f5d6234d22e07` |

Result: `MATCH`. The tools were temporary documentation-only derivations, imported no production module, consumed no production expected-output fixture, and were deleted after validation. Their script hashes and exact invocations remain recorded here.

## 12. I01–I04 Identity Record

| Identity | Exact value or procedure |
| --- | --- |
| I01 | SHA-256 of exact raw artifact bytes = `8fb8e8604cd26a2da91bc7537f0fb17cbc4ec0195e5a95271928d6e1def73313` |
| I02 | SHA-256 of RFC 8785 canonical JSON bytes = `127916e6d6008bd03b68eaef1c4bf128772ce007ee56207d9481e9ad08f70d02` |
| I03 | SHA-256 of `UTF8("absinthe:k334:canonical-physical-schema-descriptor:v1") || 0x00 || canonicalBytes` = `bf5609cada6425f6a82bec65d7574d60a71c334b92ec98e41e7f5d6234d22e07` |
| I04 | Lowercase governing proposal source hash = `e21782092cbb03bdd68d65c4e57d7ac87f14078a60561b9dd1e36f1e5827c92a` |

## 13. I05 Post-Finalization Procedure

I05 is not embedded. M3 must first finalize and freeze the exact M2 Markdown bytes, then compute I05 from those final bytes. M4 must bind that M3-derived I05. M2 does not create I06, does not self-hash an unfinished document, and does not claim an M3 or M4 identity.

## 14. Machine-Readable Field Mapping Manifest

Traversal is `K334_DESCRIPTOR_MAPPING_DEPTH_FIRST_UTF16_V1`: root pointer is the empty string, traversal is depth-first preorder, object members are sorted by UTF-16 code-unit order, and arrays use ascending zero-based indexes. Pointer escaping is RFC 6901. Container display values are literal `OBJECT` or `ARRAY`; scalar/null display values are their RFC 8785 JSON tokens.

Every row has the exact eight required fields and independently traceable proposal and acceptance locations.

| ordinal | jsonPointer | valueKind | normalizedDisplayValue | governingProposalLocation | governingAcceptanceLocation | transcriptionStatus | reviewerStatus |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `""` | `OBJECT` | `OBJECT` | Section 4.1 exact root object; Section 4.9 mechanically checkable construction | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 2 | `/authorityExclusions` | `ARRAY` | `ARRAY` | Section 4.1 root key authorityExclusions; Sections 4.8 and 14 exact exclusions | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 3 | `/authorityExclusions/0` | `STRING` | `"DESCRIPTOR_PREREQUISITE_ACCEPTANCE"` | Sections 4.8 and 14 exact authority exclusion 1 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 4 | `/authorityExclusions/1` | `STRING` | `"DESCRIPTOR_IMPLEMENTATION_AUTHORIZATION"` | Sections 4.8 and 14 exact authority exclusion 2 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 5 | `/authorityExclusions/2` | `STRING` | `"DESCRIPTOR_IMPLEMENTATION"` | Sections 4.8 and 14 exact authority exclusion 3 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 6 | `/authorityExclusions/3` | `STRING` | `"SCHEMA_MUTATION"` | Sections 4.8 and 14 exact authority exclusion 4 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 7 | `/authorityExclusions/4` | `STRING` | `"D0_P09_REBOUND"` | Sections 4.8 and 14 exact authority exclusion 5 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 8 | `/authorityExclusions/5` | `STRING` | `"D0_P09_EXECUTION"` | Sections 4.8 and 14 exact authority exclusion 6 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 9 | `/authorityExclusions/6` | `STRING` | `"D0_P09_SATISFACTION"` | Sections 4.8 and 14 exact authority exclusion 7 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 10 | `/authorityExclusions/7` | `STRING` | `"D0_P10_EXECUTION"` | Sections 4.8 and 14 exact authority exclusion 8 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 11 | `/authorityExclusions/8` | `STRING` | `"K334E_AUTHORIZATION"` | Sections 4.8 and 14 exact authority exclusion 9 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 12 | `/authorityExclusions/9` | `STRING` | `"K334F_AUTHORIZATION"` | Sections 4.8 and 14 exact authority exclusion 10 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 13 | `/authorityExclusions/10` | `STRING` | `"RUNTIME_AUTHORIZATION"` | Sections 4.8 and 14 exact authority exclusion 11 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 14 | `/authorityExclusions/11` | `STRING` | `"PRODUCTION_ELIGIBILITY"` | Sections 4.8 and 14 exact authority exclusion 12 | Sections 3 and 10 exact accepted exclusion and authorization boundary | `EXACT` | `UNREVIEWED` |
| 15 | `/canonicalization` | `OBJECT` | `OBJECT` | Section 4.1 root key canonicalization; Section 4.3 exact canonicalization object | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 16 | `/canonicalization/canonicalizationId` | `STRING` | `"K334_DESCRIPTOR_CANONICALIZATION_V1"` | Section 4.3 exact member canonicalizationId | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 17 | `/canonicalization/compoundKeyPathOrder` | `STRING` | `"PRESERVE_DECLARED_ORDER"` | Section 4.3 exact member compoundKeyPathOrder | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 18 | `/canonicalization/digestAlgorithm` | `STRING` | `"SHA-256"` | Section 4.3 exact member digestAlgorithm | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 19 | `/canonicalization/digestDomain` | `STRING` | `"absinthe:k334:canonical-physical-schema-descriptor:v1"` | Section 4.3 exact member digestDomain | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 20 | `/canonicalization/digestTextEncoding` | `STRING` | `"LOWERCASE_HEX_64"` | Section 4.3 exact member digestTextEncoding | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 21 | `/canonicalization/jsonCanonicalization` | `STRING` | `"RFC_8785"` | Section 4.3 exact member jsonCanonicalization | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 22 | `/canonicalization/setOrder` | `STRING` | `"UNSIGNED_UTF8_CANONICAL_ID_ASCENDING"` | Section 4.3 exact member setOrder | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 23 | `/canonicalization/stringNormalization` | `STRING` | `"REJECT_NON_NFC"` | Section 4.3 exact member stringNormalization | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 24 | `/canonicalization/textEncoding` | `STRING` | `"UTF-8_NO_BOM_NO_TRAILING_NEWLINE"` | Section 4.3 exact member textEncoding | Section 6 exact accepted canonicalization and identity rules | `EXACT` | `UNREVIEWED` |
| 25 | `/changeAuthorityOwner` | `STRING` | `"ABSINTHE_PROTOCOL_OWNER_VIA_SEPARATE_PUBLISHED_DISPOSITION_AND_INDEPENDENT_REVIEW"` | Section 4.1 exact root member changeAuthorityOwner | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 26 | `/compatibilityMode` | `STRING` | `"EXACT_ONLY"` | Section 4.1 exact root member compatibilityMode | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 27 | `/compatibilityStatementId` | `STRING` | `"K334_DESCRIPTOR_COMPATIBILITY_EXACT_ONLY_V1"` | Section 4.1 exact root member compatibilityStatementId | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 28 | `/conflictPolicy` | `OBJECT` | `OBJECT` | Section 4.1 root key conflictPolicy; Section 4.8 exact conflict policy | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 29 | `/conflictPolicy/boundedDiagnostics` | `BOOLEAN` | `true` | Section 4.8 exact conflict policy; member boundedDiagnostics | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 30 | `/conflictPolicy/conflictEffect` | `STRING` | `"FAIL_CLOSED_NO_MUTATION"` | Section 4.8 exact conflict policy; member conflictEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 31 | `/conflictPolicy/partialInstallationPolicy` | `STRING` | `"PARTIAL_INSTALLATION_ALWAYS_CONFLICTS_V1"` | Section 4.8 exact conflict policy; member partialInstallationPolicy | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 32 | `/conflictPolicy/policyId` | `STRING` | `"K334_DESCRIPTOR_CONFLICT_POLICY_V1"` | Section 4.8 exact conflict policy; member policyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 33 | `/conflictPolicy/prohibitedIndexPolicy` | `STRING` | `"ALL_UNLISTED_INDEXES_PROHIBITED"` | Section 4.8 exact conflict policy; member prohibitedIndexPolicy | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 34 | `/conflictPolicy/repairAuthority` | `STRING` | `"NOT_GRANTED"` | Section 4.8 exact conflict policy; member repairAuthority | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 35 | `/conflictPolicy/stateMachineId` | `STRING` | `"K334_DESCRIPTOR_INSTALLATION_STATE_V1"` | Section 4.8 exact conflict policy; member stateMachineId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 36 | `/databaseName` | `STRING` | `"absinthe-local-v2"` | Section 4.1 exact root member databaseName | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 37 | `/databaseVersionAuthority` | `STRING` | `"NOT_OWNED_BY_THIS_DESCRIPTOR"` | Section 4.1 exact root member databaseVersionAuthority | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 38 | `/dependencies` | `ARRAY` | `ARRAY` | Section 4.1 root key dependencies; Section 4.6 exact dependency array | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 39 | `/dependencies/0` | `OBJECT` | `OBJECT` | Section 4.6 exact dependency DEP-01; complete entry | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 40 | `/dependencies/0/authorityEffect` | `STRING` | `"PHYSICAL_CREATION_ORDER_ONLY_NO_SEMANTIC_AUTHORITY"` | Section 4.6 exact dependency DEP-01; authorityEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 41 | `/dependencies/0/dependencyId` | `STRING` | `"DEP-01"` | Section 4.6 exact dependency DEP-01; dependencyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 42 | `/dependencies/0/dependencyKind` | `STRING` | `"STORE_BEFORE_INDEX"` | Section 4.6 exact dependency DEP-01; dependencyKind | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 43 | `/dependencies/0/required` | `BOOLEAN` | `true` | Section 4.6 exact dependency DEP-01; required | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 44 | `/dependencies/0/sources` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 45 | `/dependencies/0/sources/0` | `STRING` | `"k334.store.authority_subjects.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 46 | `/dependencies/0/sources/1` | `STRING` | `"k334.store.authority_issuers.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 47 | `/dependencies/0/sources/2` | `STRING` | `"k334.store.authority_issuer_policies.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 48 | `/dependencies/0/sources/3` | `STRING` | `"k334.store.authority_evidence.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 49 | `/dependencies/0/sources/4` | `STRING` | `"k334.store.authority_rollback_permissions.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 50 | `/dependencies/0/sources/5` | `STRING` | `"k334.store.authority_terminations.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 51 | `/dependencies/0/sources/6` | `STRING` | `"k334.store.authority_compatibility_tuples.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 52 | `/dependencies/0/sources/7` | `STRING` | `"k334.store.authority_external_mappings.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 53 | `/dependencies/0/sources/8` | `STRING` | `"k334.store.authority_fork_observations.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 54 | `/dependencies/0/sources/9` | `STRING` | `"k334.store.authority_conflict_observations.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 55 | `/dependencies/0/sources/10` | `STRING` | `"k334.store.authority_quarantines.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 56 | `/dependencies/0/sources/11` | `STRING` | `"k334.store.authority_migration_sessions.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 57 | `/dependencies/0/sources/12` | `STRING` | `"k334.store.authority_migration_classifications.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 58 | `/dependencies/0/sources/13` | `STRING` | `"k334.store.authority_migration_checkpoints.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 59 | `/dependencies/0/sources/14` | `STRING` | `"k334.store.authority_recovery_markers.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 60 | `/dependencies/0/sources/15` | `STRING` | `"k334.store.authority_heads.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 61 | `/dependencies/0/sources/16` | `STRING` | `"k334.store.authority_audit_events.v1"` | Section 4.6 exact dependency DEP-01; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 62 | `/dependencies/0/targets` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 63 | `/dependencies/0/targets/0` | `STRING` | `"C01"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 64 | `/dependencies/0/targets/1` | `STRING` | `"C02"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 65 | `/dependencies/0/targets/2` | `STRING` | `"C04"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 66 | `/dependencies/0/targets/3` | `STRING` | `"C05"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 67 | `/dependencies/0/targets/4` | `STRING` | `"C06"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 68 | `/dependencies/0/targets/5` | `STRING` | `"C07"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 69 | `/dependencies/0/targets/6` | `STRING` | `"C08"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 70 | `/dependencies/0/targets/7` | `STRING` | `"C09"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 71 | `/dependencies/0/targets/8` | `STRING` | `"C10"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 72 | `/dependencies/0/targets/9` | `STRING` | `"C11"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 73 | `/dependencies/0/targets/10` | `STRING` | `"C12"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 74 | `/dependencies/0/targets/11` | `STRING` | `"C13"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 75 | `/dependencies/0/targets/12` | `STRING` | `"C14"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 76 | `/dependencies/0/targets/13` | `STRING` | `"C15"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 77 | `/dependencies/0/targets/14` | `STRING` | `"C16"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 78 | `/dependencies/0/targets/15` | `STRING` | `"C17"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 79 | `/dependencies/0/targets/16` | `STRING` | `"C18"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 80 | `/dependencies/0/targets/17` | `STRING` | `"C19"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 81 | `/dependencies/0/targets/18` | `STRING` | `"C20"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 82 | `/dependencies/0/targets/19` | `STRING` | `"C21"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 83 | `/dependencies/0/targets/20` | `STRING` | `"C22"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 84 | `/dependencies/0/targets/21` | `STRING` | `"C23"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 85 | `/dependencies/0/targets/22` | `STRING` | `"C24"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 86 | `/dependencies/0/targets/23` | `STRING` | `"C25"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 87 | `/dependencies/0/targets/24` | `STRING` | `"C26"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 88 | `/dependencies/0/targets/25` | `STRING` | `"C27"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 89 | `/dependencies/0/targets/26` | `STRING` | `"C28"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 90 | `/dependencies/0/targets/27` | `STRING` | `"C29"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 91 | `/dependencies/0/targets/28` | `STRING` | `"C30"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 92 | `/dependencies/0/targets/29` | `STRING` | `"C31"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 93 | `/dependencies/0/targets/30` | `STRING` | `"C32"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 94 | `/dependencies/0/targets/31` | `STRING` | `"C33"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 95 | `/dependencies/0/targets/32` | `STRING` | `"C34"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 96 | `/dependencies/0/targets/33` | `STRING` | `"C35"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 97 | `/dependencies/0/targets/34` | `STRING` | `"C36"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 98 | `/dependencies/0/targets/35` | `STRING` | `"C37"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 99 | `/dependencies/0/targets/36` | `STRING` | `"C38"` | Section 4.6 exact dependency DEP-01; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 100 | `/dependencies/1` | `OBJECT` | `OBJECT` | Section 4.6 exact dependency DEP-02; complete entry | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 101 | `/dependencies/1/authorityEffect` | `STRING` | `"PHYSICAL_ATOMICITY_ONLY_NO_EXECUTION_AUTHORITY"` | Section 4.6 exact dependency DEP-02; authorityEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 102 | `/dependencies/1/dependencyId` | `STRING` | `"DEP-02"` | Section 4.6 exact dependency DEP-02; dependencyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 103 | `/dependencies/1/dependencyKind` | `STRING` | `"SAME_VERSIONCHANGE_TRANSACTION_PARTICIPATION"` | Section 4.6 exact dependency DEP-02; dependencyKind | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 104 | `/dependencies/1/required` | `BOOLEAN` | `true` | Section 4.6 exact dependency DEP-02; required | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 105 | `/dependencies/1/sources` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-02; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 106 | `/dependencies/1/sources/0` | `STRING` | `"absinthe-local-v2@4"` | Section 4.6 exact dependency DEP-02; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 107 | `/dependencies/1/targets` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-02; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 108 | `/dependencies/1/targets/0` | `STRING` | `"TG-K334-V4-V5-ADDITIVE-001"` | Section 4.6 exact dependency DEP-02; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 109 | `/dependencies/2` | `OBJECT` | `OBJECT` | Section 4.6 exact dependency DEP-03; complete entry | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 110 | `/dependencies/2/authorityEffect` | `STRING` | `"FUTURE_AVAILABILITY_ONLY_NO_RUNTIME_AUTHORITY"` | Section 4.6 exact dependency DEP-03; authorityEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 111 | `/dependencies/2/dependencyId` | `STRING` | `"DEP-03"` | Section 4.6 exact dependency DEP-03; dependencyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 112 | `/dependencies/2/dependencyKind` | `STRING` | `"FUTURE_RUNTIME_TRANSACTION_PARTICIPATION"` | Section 4.6 exact dependency DEP-03; dependencyKind | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 113 | `/dependencies/2/required` | `BOOLEAN` | `true` | Section 4.6 exact dependency DEP-03; required | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 114 | `/dependencies/2/sources` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-03; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 115 | `/dependencies/2/sources/0` | `STRING` | `"k334.store.authority_migration_sessions.v1"` | Section 4.6 exact dependency DEP-03; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 116 | `/dependencies/2/sources/1` | `STRING` | `"k334.store.authority_migration_checkpoints.v1"` | Section 4.6 exact dependency DEP-03; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 117 | `/dependencies/2/sources/2` | `STRING` | `"k334.store.authority_recovery_markers.v1"` | Section 4.6 exact dependency DEP-03; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 118 | `/dependencies/2/targets` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-03; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 119 | `/dependencies/2/targets/0` | `STRING` | `"B04_B05_B06_ACCEPTED_TARGET_AND_CONTROL_STORE_SET"` | Section 4.6 exact dependency DEP-03; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 120 | `/dependencies/3` | `OBJECT` | `OBJECT` | Section 4.6 exact dependency DEP-04; complete entry | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 121 | `/dependencies/3/authorityEffect` | `STRING` | `"FUTURE_ATOMIC_PAIR_AVAILABILITY_ONLY"` | Section 4.6 exact dependency DEP-04; authorityEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 122 | `/dependencies/3/dependencyId` | `STRING` | `"DEP-04"` | Section 4.6 exact dependency DEP-04; dependencyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 123 | `/dependencies/3/dependencyKind` | `STRING` | `"FUTURE_RUNTIME_TRANSACTION_PARTICIPATION"` | Section 4.6 exact dependency DEP-04; dependencyKind | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 124 | `/dependencies/3/required` | `BOOLEAN` | `true` | Section 4.6 exact dependency DEP-04; required | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 125 | `/dependencies/3/sources` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-04; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 126 | `/dependencies/3/sources/0` | `STRING` | `"k334.store.authority_evidence.v1"` | Section 4.6 exact dependency DEP-04; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 127 | `/dependencies/3/sources/1` | `STRING` | `"k334.store.authority_audit_events.v1"` | Section 4.6 exact dependency DEP-04; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 128 | `/dependencies/3/targets` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-04; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 129 | `/dependencies/3/targets/0` | `STRING` | `"T01"` | Section 4.6 exact dependency DEP-04; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 130 | `/dependencies/3/targets/1` | `STRING` | `"T35"` | Section 4.6 exact dependency DEP-04; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 131 | `/dependencies/4` | `OBJECT` | `OBJECT` | Section 4.6 exact dependency DEP-05; complete entry | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 132 | `/dependencies/4/authorityEffect` | `STRING` | `"RESTART_LOOKUP_ONLY_NO_SEMANTIC_AUTHORITY"` | Section 4.6 exact dependency DEP-05; authorityEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 133 | `/dependencies/4/dependencyId` | `STRING` | `"DEP-05"` | Section 4.6 exact dependency DEP-05; dependencyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 134 | `/dependencies/4/dependencyKind` | `STRING` | `"INDEX_LOOKUP_REQUIRED_BY_ACCEPTED_PROTOCOL"` | Section 4.6 exact dependency DEP-05; dependencyKind | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 135 | `/dependencies/4/required` | `BOOLEAN` | `true` | Section 4.6 exact dependency DEP-05; required | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 136 | `/dependencies/4/sources` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-05; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 137 | `/dependencies/4/sources/0` | `STRING` | `"k334.store.authority_evidence.v1"` | Section 4.6 exact dependency DEP-05; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 138 | `/dependencies/4/sources/1` | `STRING` | `"k334.index.authority_audit_events.by_record.v1"` | Section 4.6 exact dependency DEP-05; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 139 | `/dependencies/4/targets` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-05; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 140 | `/dependencies/4/targets/0` | `STRING` | `"EVIDENCE_AUDIT_ATOMIC_PAIR_V1"` | Section 4.6 exact dependency DEP-05; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 141 | `/dependencies/5` | `OBJECT` | `OBJECT` | Section 4.6 exact dependency DEP-06; complete entry | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 142 | `/dependencies/5/authorityEffect` | `STRING` | `"COMPETITOR_LOOKUP_ONLY_NO_WINNER_AUTHORITY"` | Section 4.6 exact dependency DEP-06; authorityEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 143 | `/dependencies/5/dependencyId` | `STRING` | `"DEP-06"` | Section 4.6 exact dependency DEP-06; dependencyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 144 | `/dependencies/5/dependencyKind` | `STRING` | `"INDEX_LOOKUP_REQUIRED_BY_ACCEPTED_PROTOCOL"` | Section 4.6 exact dependency DEP-06; dependencyKind | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 145 | `/dependencies/5/required` | `BOOLEAN` | `true` | Section 4.6 exact dependency DEP-06; required | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 146 | `/dependencies/5/sources` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-06; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 147 | `/dependencies/5/sources/0` | `STRING` | `"k334.store.authority_evidence.v1"` | Section 4.6 exact dependency DEP-06; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 148 | `/dependencies/5/sources/1` | `STRING` | `"k334.index.authority_evidence.by_subject_lineage_sequence.v1"` | Section 4.6 exact dependency DEP-06; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 149 | `/dependencies/5/targets` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-06; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 150 | `/dependencies/5/targets/0` | `STRING` | `"B08_LOGICAL_POSITION_V1"` | Section 4.6 exact dependency DEP-06; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 151 | `/dependencies/6` | `OBJECT` | `OBJECT` | Section 4.6 exact dependency DEP-07; complete entry | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 152 | `/dependencies/6/authorityEffect` | `STRING` | `"NO_SCHEMA_ORDERING_AND_NO_AUTHORITY_EFFECT"` | Section 4.6 exact dependency DEP-07; authorityEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 153 | `/dependencies/6/dependencyId` | `STRING` | `"DEP-07"` | Section 4.6 exact dependency DEP-07; dependencyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 154 | `/dependencies/6/dependencyKind` | `STRING` | `"SEMANTIC_REFERENCE_NOT_SCHEMA_ORDERING"` | Section 4.6 exact dependency DEP-07; dependencyKind | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 155 | `/dependencies/6/required` | `BOOLEAN` | `false` | Section 4.6 exact dependency DEP-07; required | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 156 | `/dependencies/6/sources` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-07; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 157 | `/dependencies/6/sources/0` | `STRING` | `"k334.store.authority_subjects.v1"` | Section 4.6 exact dependency DEP-07; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 158 | `/dependencies/6/sources/1` | `STRING` | `"k334.store.authority_issuers.v1"` | Section 4.6 exact dependency DEP-07; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 159 | `/dependencies/6/sources/2` | `STRING` | `"k334.store.authority_issuer_policies.v1"` | Section 4.6 exact dependency DEP-07; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 160 | `/dependencies/6/sources/3` | `STRING` | `"k334.store.authority_evidence.v1"` | Section 4.6 exact dependency DEP-07; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 161 | `/dependencies/6/sources/4` | `STRING` | `"k334.store.authority_compatibility_tuples.v1"` | Section 4.6 exact dependency DEP-07; sources | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 162 | `/dependencies/6/targets` | `ARRAY` | `ARRAY` | Section 4.6 exact dependency DEP-07; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 163 | `/dependencies/6/targets/0` | `STRING` | `"K334_SEMANTIC_REFERENCE_VALIDATION"` | Section 4.6 exact dependency DEP-07; targets | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 164 | `/descriptorId` | `STRING` | `"K-334-CANONICAL-PHYSICAL-SCHEMA-001"` | Section 4.1 exact root member descriptorId | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 165 | `/descriptorKind` | `STRING` | `"K334CanonicalPhysicalSchemaDescriptor"` | Section 4.1 exact root member descriptorKind | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 166 | `/descriptorVersion` | `INTEGER` | `1` | Section 4.1 exact root member descriptorVersion | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 167 | `/descriptorVersionOwner` | `STRING` | `"ABSINTHE_PROTOCOL_OWNER"` | Section 4.1 exact root member descriptorVersionOwner | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 168 | `/indexes` | `ARRAY` | `ARRAY` | Section 4.1 root key indexes; Sections 4.5, 6, and 6.1 exact 38-index inventory | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 169 | `/indexes/0` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 170 | `/indexes/0/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 171 | `/indexes/0/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 172 | `/indexes/0/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 173 | `/indexes/0/directSourceFields/1` | `STRING` | `"recordId"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 174 | `/indexes/0/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 175 | `/indexes/0/indexId` | `STRING` | `"C01"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 176 | `/indexes/0/indexIdentity` | `STRING` | `"k334.index.authority_audit_events.by_record.v1"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 177 | `/indexes/0/indexName` | `STRING` | `"by_record"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 178 | `/indexes/0/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 179 | `/indexes/0/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 180 | `/indexes/0/keyPath/1` | `STRING` | `"recordId"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 181 | `/indexes/0/lookupPurpose` | `STRING` | `"AUDIT_RECORD_RESTART_LOOKUP"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 182 | `/indexes/0/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 183 | `/indexes/0/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 184 | `/indexes/0/ordinal` | `INTEGER` | `1` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 185 | `/indexes/0/ownerStoreIdentity` | `STRING` | `"k334.store.authority_audit_events.v1"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 186 | `/indexes/0/ownerStoreName` | `STRING` | `"authority_audit_events"` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 187 | `/indexes/0/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C01, and 6.1 row C01; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 188 | `/indexes/1` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 189 | `/indexes/1/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 190 | `/indexes/1/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 191 | `/indexes/1/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 192 | `/indexes/1/directSourceFields/1` | `STRING` | `"sourceDigest"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 193 | `/indexes/1/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 194 | `/indexes/1/indexId` | `STRING` | `"C02"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 195 | `/indexes/1/indexIdentity` | `STRING` | `"k334.index.authority_audit_events.by_source_digest.v1"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 196 | `/indexes/1/indexName` | `STRING` | `"by_source_digest"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 197 | `/indexes/1/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 198 | `/indexes/1/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 199 | `/indexes/1/keyPath/1` | `STRING` | `"sourceDigest"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 200 | `/indexes/1/lookupPurpose` | `STRING` | `"AUDIT_SOURCE_LOOKUP"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 201 | `/indexes/1/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 202 | `/indexes/1/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 203 | `/indexes/1/ordinal` | `INTEGER` | `2` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 204 | `/indexes/1/ownerStoreIdentity` | `STRING` | `"k334.store.authority_audit_events.v1"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 205 | `/indexes/1/ownerStoreName` | `STRING` | `"authority_audit_events"` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 206 | `/indexes/1/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C02, and 6.1 row C02; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 207 | `/indexes/2` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 208 | `/indexes/2/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 209 | `/indexes/2/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 210 | `/indexes/2/disposition` | `STRING` | `"ACCEPTED_EXCLUDED_INDEX"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 211 | `/indexes/2/indexId` | `STRING` | `"C03"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 212 | `/indexes/2/indexIdentity` | `STRING` | `"k334.index.authority_audit_events.by_subject.v1"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 213 | `/indexes/2/indexName` | `STRING` | `"by_subject"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 214 | `/indexes/2/keyPath` | `NULL` | `null` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 215 | `/indexes/2/lookupPurpose` | `STRING` | `"EXCLUDED_NO_SUBJECT_SOURCE"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 216 | `/indexes/2/multiEntry` | `NULL` | `null` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 217 | `/indexes/2/nullOrMissingBehavior` | `STRING` | `"NOT_APPLICABLE_EXCLUDED_INDEX"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 218 | `/indexes/2/ordinal` | `INTEGER` | `3` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 219 | `/indexes/2/ownerStoreIdentity` | `STRING` | `"k334.store.authority_audit_events.v1"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 220 | `/indexes/2/ownerStoreName` | `STRING` | `"authority_audit_events"` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 221 | `/indexes/2/unique` | `NULL` | `null` | Sections 4.5, 6 row C03, and 6.1 row C03; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 222 | `/indexes/3` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 223 | `/indexes/3/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 224 | `/indexes/3/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 225 | `/indexes/3/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 226 | `/indexes/3/directSourceFields/1` | `STRING` | `"tupleDigest"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 227 | `/indexes/3/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 228 | `/indexes/3/indexId` | `STRING` | `"C04"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 229 | `/indexes/3/indexIdentity` | `STRING` | `"k334.index.authority_compatibility_tuples.by_exact_tuple.v1"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 230 | `/indexes/3/indexName` | `STRING` | `"by_exact_tuple"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 231 | `/indexes/3/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 232 | `/indexes/3/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 233 | `/indexes/3/keyPath/1` | `STRING` | `"tupleDigest"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 234 | `/indexes/3/lookupPurpose` | `STRING` | `"EXACT_TUPLE_LOOKUP"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 235 | `/indexes/3/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 236 | `/indexes/3/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 237 | `/indexes/3/ordinal` | `INTEGER` | `4` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 238 | `/indexes/3/ownerStoreIdentity` | `STRING` | `"k334.store.authority_compatibility_tuples.v1"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 239 | `/indexes/3/ownerStoreName` | `STRING` | `"authority_compatibility_tuples"` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 240 | `/indexes/3/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C04, and 6.1 row C04; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 241 | `/indexes/4` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 242 | `/indexes/4/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 243 | `/indexes/4/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 244 | `/indexes/4/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 245 | `/indexes/4/directSourceFields/1` | `STRING` | `"lifecycleStatus"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 246 | `/indexes/4/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 247 | `/indexes/4/indexId` | `STRING` | `"C05"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 248 | `/indexes/4/indexIdentity` | `STRING` | `"k334.index.authority_compatibility_tuples.by_tuple_status.v1"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 249 | `/indexes/4/indexName` | `STRING` | `"by_tuple_status"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 250 | `/indexes/4/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 251 | `/indexes/4/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 252 | `/indexes/4/keyPath/1` | `STRING` | `"lifecycleStatus"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 253 | `/indexes/4/lookupPurpose` | `STRING` | `"RECORDED_TUPLE_STATUS_LOOKUP"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 254 | `/indexes/4/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 255 | `/indexes/4/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 256 | `/indexes/4/ordinal` | `INTEGER` | `5` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 257 | `/indexes/4/ownerStoreIdentity` | `STRING` | `"k334.store.authority_compatibility_tuples.v1"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 258 | `/indexes/4/ownerStoreName` | `STRING` | `"authority_compatibility_tuples"` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 259 | `/indexes/4/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C05, and 6.1 row C05; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 260 | `/indexes/5` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 261 | `/indexes/5/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 262 | `/indexes/5/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 263 | `/indexes/5/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 264 | `/indexes/5/directSourceFields/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 265 | `/indexes/5/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 266 | `/indexes/5/indexId` | `STRING` | `"C06"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 267 | `/indexes/5/indexIdentity` | `STRING` | `"k334.index.authority_conflict_observations.by_observation_digest.v1"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 268 | `/indexes/5/indexName` | `STRING` | `"by_observation_digest"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 269 | `/indexes/5/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 270 | `/indexes/5/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 271 | `/indexes/5/keyPath/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 272 | `/indexes/5/lookupPurpose` | `STRING` | `"CONFLICT_DIGEST_INTEGRITY_LOOKUP"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 273 | `/indexes/5/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 274 | `/indexes/5/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 275 | `/indexes/5/ordinal` | `INTEGER` | `6` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 276 | `/indexes/5/ownerStoreIdentity` | `STRING` | `"k334.store.authority_conflict_observations.v1"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 277 | `/indexes/5/ownerStoreName` | `STRING` | `"authority_conflict_observations"` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 278 | `/indexes/5/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C06, and 6.1 row C06; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 279 | `/indexes/6` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 280 | `/indexes/6/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 281 | `/indexes/6/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 282 | `/indexes/6/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 283 | `/indexes/6/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 284 | `/indexes/6/directSourceFields/2` | `STRING` | `"conflictCode"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 285 | `/indexes/6/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 286 | `/indexes/6/indexId` | `STRING` | `"C07"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 287 | `/indexes/6/indexIdentity` | `STRING` | `"k334.index.authority_conflict_observations.by_subject_code.v1"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 288 | `/indexes/6/indexName` | `STRING` | `"by_subject_code"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 289 | `/indexes/6/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 290 | `/indexes/6/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 291 | `/indexes/6/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 292 | `/indexes/6/keyPath/2` | `STRING` | `"conflictCode"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 293 | `/indexes/6/lookupPurpose` | `STRING` | `"CONFLICT_SUBJECT_CODE_LOOKUP"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 294 | `/indexes/6/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 295 | `/indexes/6/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 296 | `/indexes/6/ordinal` | `INTEGER` | `7` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 297 | `/indexes/6/ownerStoreIdentity` | `STRING` | `"k334.store.authority_conflict_observations.v1"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 298 | `/indexes/6/ownerStoreName` | `STRING` | `"authority_conflict_observations"` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 299 | `/indexes/6/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C07, and 6.1 row C07; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 300 | `/indexes/7` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 301 | `/indexes/7/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 302 | `/indexes/7/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 303 | `/indexes/7/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 304 | `/indexes/7/directSourceFields/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 305 | `/indexes/7/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 306 | `/indexes/7/indexId` | `STRING` | `"C08"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 307 | `/indexes/7/indexIdentity` | `STRING` | `"k334.index.authority_evidence.by_digest.v1"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 308 | `/indexes/7/indexName` | `STRING` | `"by_digest"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 309 | `/indexes/7/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 310 | `/indexes/7/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 311 | `/indexes/7/keyPath/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 312 | `/indexes/7/lookupPurpose` | `STRING` | `"EVIDENCE_DIGEST_INTEGRITY_LOOKUP"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 313 | `/indexes/7/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 314 | `/indexes/7/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 315 | `/indexes/7/ordinal` | `INTEGER` | `8` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 316 | `/indexes/7/ownerStoreIdentity` | `STRING` | `"k334.store.authority_evidence.v1"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 317 | `/indexes/7/ownerStoreName` | `STRING` | `"authority_evidence"` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 318 | `/indexes/7/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C08, and 6.1 row C08; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 319 | `/indexes/8` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 320 | `/indexes/8/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 321 | `/indexes/8/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 322 | `/indexes/8/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 323 | `/indexes/8/directSourceFields/1` | `STRING` | `"issuerId"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 324 | `/indexes/8/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 325 | `/indexes/8/indexId` | `STRING` | `"C09"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 326 | `/indexes/8/indexIdentity` | `STRING` | `"k334.index.authority_evidence.by_issuer.v1"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 327 | `/indexes/8/indexName` | `STRING` | `"by_issuer"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 328 | `/indexes/8/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 329 | `/indexes/8/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 330 | `/indexes/8/keyPath/1` | `STRING` | `"issuerId"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 331 | `/indexes/8/lookupPurpose` | `STRING` | `"EVIDENCE_ISSUER_AUDIT_POLICY_LOOKUP"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 332 | `/indexes/8/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 333 | `/indexes/8/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 334 | `/indexes/8/ordinal` | `INTEGER` | `9` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 335 | `/indexes/8/ownerStoreIdentity` | `STRING` | `"k334.store.authority_evidence.v1"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 336 | `/indexes/8/ownerStoreName` | `STRING` | `"authority_evidence"` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 337 | `/indexes/8/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C09, and 6.1 row C09; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 338 | `/indexes/9` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 339 | `/indexes/9/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 340 | `/indexes/9/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 341 | `/indexes/9/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 342 | `/indexes/9/directSourceFields/1` | `STRING` | `"predecessorRecordId"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 343 | `/indexes/9/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 344 | `/indexes/9/indexId` | `STRING` | `"C10"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 345 | `/indexes/9/indexIdentity` | `STRING` | `"k334.index.authority_evidence.by_predecessor.v1"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 346 | `/indexes/9/indexName` | `STRING` | `"by_predecessor"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 347 | `/indexes/9/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 348 | `/indexes/9/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 349 | `/indexes/9/keyPath/1` | `STRING` | `"predecessorRecordId"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 350 | `/indexes/9/lookupPurpose` | `STRING` | `"EVIDENCE_PREDECESSOR_COMPETITOR_LOOKUP"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 351 | `/indexes/9/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 352 | `/indexes/9/nullOrMissingBehavior` | `STRING` | `"EXPLICIT_NULL_PRODUCES_NO_ENTRY_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 353 | `/indexes/9/ordinal` | `INTEGER` | `10` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 354 | `/indexes/9/ownerStoreIdentity` | `STRING` | `"k334.store.authority_evidence.v1"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 355 | `/indexes/9/ownerStoreName` | `STRING` | `"authority_evidence"` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 356 | `/indexes/9/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C10, and 6.1 row C10; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 357 | `/indexes/10` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 358 | `/indexes/10/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 359 | `/indexes/10/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 360 | `/indexes/10/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 361 | `/indexes/10/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 362 | `/indexes/10/directSourceFields/2` | `STRING` | `"lineageId"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 363 | `/indexes/10/directSourceFields/3` | `STRING` | `"effectiveSequence"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 364 | `/indexes/10/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 365 | `/indexes/10/indexId` | `STRING` | `"C11"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 366 | `/indexes/10/indexIdentity` | `STRING` | `"k334.index.authority_evidence.by_subject_lineage_sequence.v1"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 367 | `/indexes/10/indexName` | `STRING` | `"by_subject_lineage_sequence"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 368 | `/indexes/10/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 369 | `/indexes/10/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 370 | `/indexes/10/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 371 | `/indexes/10/keyPath/2` | `STRING` | `"lineageId"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 372 | `/indexes/10/keyPath/3` | `STRING` | `"effectiveSequence"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 373 | `/indexes/10/lookupPurpose` | `STRING` | `"EVIDENCE_LOGICAL_POSITION_COMPETITOR_LOOKUP"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 374 | `/indexes/10/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 375 | `/indexes/10/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 376 | `/indexes/10/ordinal` | `INTEGER` | `11` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 377 | `/indexes/10/ownerStoreIdentity` | `STRING` | `"k334.store.authority_evidence.v1"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 378 | `/indexes/10/ownerStoreName` | `STRING` | `"authority_evidence"` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 379 | `/indexes/10/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C11, and 6.1 row C11; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 380 | `/indexes/11` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 381 | `/indexes/11/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 382 | `/indexes/11/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 383 | `/indexes/11/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 384 | `/indexes/11/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 385 | `/indexes/11/directSourceFields/2` | `STRING` | `"lifecycleStatus"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 386 | `/indexes/11/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 387 | `/indexes/11/indexId` | `STRING` | `"C12"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 388 | `/indexes/11/indexIdentity` | `STRING` | `"k334.index.authority_evidence.by_subject_status.v1"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 389 | `/indexes/11/indexName` | `STRING` | `"by_subject_status"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 390 | `/indexes/11/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 391 | `/indexes/11/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 392 | `/indexes/11/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 393 | `/indexes/11/keyPath/2` | `STRING` | `"lifecycleStatus"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 394 | `/indexes/11/lookupPurpose` | `STRING` | `"EVIDENCE_SUBJECT_STATUS_VALIDATION_LOOKUP"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 395 | `/indexes/11/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 396 | `/indexes/11/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 397 | `/indexes/11/ordinal` | `INTEGER` | `12` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 398 | `/indexes/11/ownerStoreIdentity` | `STRING` | `"k334.store.authority_evidence.v1"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 399 | `/indexes/11/ownerStoreName` | `STRING` | `"authority_evidence"` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 400 | `/indexes/11/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C12, and 6.1 row C12; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 401 | `/indexes/12` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 402 | `/indexes/12/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 403 | `/indexes/12/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 404 | `/indexes/12/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 405 | `/indexes/12/directSourceFields/1` | `STRING` | `"mappingKind"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 406 | `/indexes/12/directSourceFields/2` | `STRING` | `"provider"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 407 | `/indexes/12/directSourceFields/3` | `STRING` | `"externalNamespace"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 408 | `/indexes/12/directSourceFields/4` | `STRING` | `"externalIdentifier"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 409 | `/indexes/12/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 410 | `/indexes/12/indexId` | `STRING` | `"C13"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 411 | `/indexes/12/indexIdentity` | `STRING` | `"k334.index.authority_external_mappings.by_external.v1"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 412 | `/indexes/12/indexName` | `STRING` | `"by_external"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 413 | `/indexes/12/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 414 | `/indexes/12/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 415 | `/indexes/12/keyPath/1` | `STRING` | `"mappingKind"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 416 | `/indexes/12/keyPath/2` | `STRING` | `"provider"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 417 | `/indexes/12/keyPath/3` | `STRING` | `"externalNamespace"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 418 | `/indexes/12/keyPath/4` | `STRING` | `"externalIdentifier"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 419 | `/indexes/12/lookupPurpose` | `STRING` | `"EXTERNAL_MAPPING_AMBIGUITY_LOOKUP"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 420 | `/indexes/12/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 421 | `/indexes/12/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 422 | `/indexes/12/ordinal` | `INTEGER` | `13` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 423 | `/indexes/12/ownerStoreIdentity` | `STRING` | `"k334.store.authority_external_mappings.v1"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 424 | `/indexes/12/ownerStoreName` | `STRING` | `"authority_external_mappings"` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 425 | `/indexes/12/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C13, and 6.1 row C13; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 426 | `/indexes/13` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 427 | `/indexes/13/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 428 | `/indexes/13/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 429 | `/indexes/13/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 430 | `/indexes/13/directSourceFields/1` | `STRING` | `"mappingKind"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 431 | `/indexes/13/directSourceFields/2` | `STRING` | `"internalId"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 432 | `/indexes/13/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 433 | `/indexes/13/indexId` | `STRING` | `"C14"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 434 | `/indexes/13/indexIdentity` | `STRING` | `"k334.index.authority_external_mappings.by_internal.v1"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 435 | `/indexes/13/indexName` | `STRING` | `"by_internal"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 436 | `/indexes/13/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 437 | `/indexes/13/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 438 | `/indexes/13/keyPath/1` | `STRING` | `"mappingKind"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 439 | `/indexes/13/keyPath/2` | `STRING` | `"internalId"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 440 | `/indexes/13/lookupPurpose` | `STRING` | `"EXTERNAL_MAPPING_REVERSE_AUDIT_LOOKUP"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 441 | `/indexes/13/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 442 | `/indexes/13/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 443 | `/indexes/13/ordinal` | `INTEGER` | `14` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 444 | `/indexes/13/ownerStoreIdentity` | `STRING` | `"k334.store.authority_external_mappings.v1"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 445 | `/indexes/13/ownerStoreName` | `STRING` | `"authority_external_mappings"` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 446 | `/indexes/13/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C14, and 6.1 row C14; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 447 | `/indexes/14` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 448 | `/indexes/14/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 449 | `/indexes/14/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 450 | `/indexes/14/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 451 | `/indexes/14/directSourceFields/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 452 | `/indexes/14/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 453 | `/indexes/14/indexId` | `STRING` | `"C15"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 454 | `/indexes/14/indexIdentity` | `STRING` | `"k334.index.authority_external_mappings.by_mapping_digest.v1"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 455 | `/indexes/14/indexName` | `STRING` | `"by_mapping_digest"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 456 | `/indexes/14/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 457 | `/indexes/14/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 458 | `/indexes/14/keyPath/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 459 | `/indexes/14/lookupPurpose` | `STRING` | `"EXTERNAL_MAPPING_DIGEST_INTEGRITY_LOOKUP"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 460 | `/indexes/14/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 461 | `/indexes/14/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 462 | `/indexes/14/ordinal` | `INTEGER` | `15` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 463 | `/indexes/14/ownerStoreIdentity` | `STRING` | `"k334.store.authority_external_mappings.v1"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 464 | `/indexes/14/ownerStoreName` | `STRING` | `"authority_external_mappings"` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 465 | `/indexes/14/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C15, and 6.1 row C15; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 466 | `/indexes/15` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 467 | `/indexes/15/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 468 | `/indexes/15/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 469 | `/indexes/15/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 470 | `/indexes/15/directSourceFields/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 471 | `/indexes/15/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 472 | `/indexes/15/indexId` | `STRING` | `"C16"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 473 | `/indexes/15/indexIdentity` | `STRING` | `"k334.index.authority_fork_observations.by_observation_digest.v1"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 474 | `/indexes/15/indexName` | `STRING` | `"by_observation_digest"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 475 | `/indexes/15/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 476 | `/indexes/15/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 477 | `/indexes/15/keyPath/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 478 | `/indexes/15/lookupPurpose` | `STRING` | `"FORK_DIGEST_INTEGRITY_LOOKUP"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 479 | `/indexes/15/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 480 | `/indexes/15/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 481 | `/indexes/15/ordinal` | `INTEGER` | `16` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 482 | `/indexes/15/ownerStoreIdentity` | `STRING` | `"k334.store.authority_fork_observations.v1"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 483 | `/indexes/15/ownerStoreName` | `STRING` | `"authority_fork_observations"` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 484 | `/indexes/15/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C16, and 6.1 row C16; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 485 | `/indexes/16` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 486 | `/indexes/16/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 487 | `/indexes/16/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 488 | `/indexes/16/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 489 | `/indexes/16/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 490 | `/indexes/16/directSourceFields/2` | `STRING` | `"predecessorRecordId"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 491 | `/indexes/16/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 492 | `/indexes/16/indexId` | `STRING` | `"C17"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 493 | `/indexes/16/indexIdentity` | `STRING` | `"k334.index.authority_fork_observations.by_subject_predecessor.v1"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 494 | `/indexes/16/indexName` | `STRING` | `"by_subject_predecessor"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 495 | `/indexes/16/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 496 | `/indexes/16/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 497 | `/indexes/16/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 498 | `/indexes/16/keyPath/2` | `STRING` | `"predecessorRecordId"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 499 | `/indexes/16/lookupPurpose` | `STRING` | `"FORK_SUBJECT_PREDECESSOR_LOOKUP"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 500 | `/indexes/16/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 501 | `/indexes/16/nullOrMissingBehavior` | `STRING` | `"EXPLICIT_NULL_PRODUCES_NO_ENTRY_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 502 | `/indexes/16/ordinal` | `INTEGER` | `17` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 503 | `/indexes/16/ownerStoreIdentity` | `STRING` | `"k334.store.authority_fork_observations.v1"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 504 | `/indexes/16/ownerStoreName` | `STRING` | `"authority_fork_observations"` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 505 | `/indexes/16/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C17, and 6.1 row C17; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 506 | `/indexes/17` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 507 | `/indexes/17/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 508 | `/indexes/17/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 509 | `/indexes/17/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 510 | `/indexes/17/directSourceFields/1` | `STRING` | `"canonicalSetDigest"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 511 | `/indexes/17/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 512 | `/indexes/17/indexId` | `STRING` | `"C18"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 513 | `/indexes/17/indexIdentity` | `STRING` | `"k334.index.authority_heads.by_projection_digest.v1"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 514 | `/indexes/17/indexName` | `STRING` | `"by_projection_digest"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 515 | `/indexes/17/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 516 | `/indexes/17/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 517 | `/indexes/17/keyPath/1` | `STRING` | `"canonicalSetDigest"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 518 | `/indexes/17/lookupPurpose` | `STRING` | `"DERIVED_HEAD_PROJECTION_DIGEST_LOOKUP"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 519 | `/indexes/17/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 520 | `/indexes/17/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 521 | `/indexes/17/ordinal` | `INTEGER` | `18` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 522 | `/indexes/17/ownerStoreIdentity` | `STRING` | `"k334.store.authority_heads.v1"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 523 | `/indexes/17/ownerStoreName` | `STRING` | `"authority_heads"` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 524 | `/indexes/17/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C18, and 6.1 row C18; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 525 | `/indexes/18` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 526 | `/indexes/18/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 527 | `/indexes/18/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 528 | `/indexes/18/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 529 | `/indexes/18/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 530 | `/indexes/18/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 531 | `/indexes/18/indexId` | `STRING` | `"C19"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 532 | `/indexes/18/indexIdentity` | `STRING` | `"k334.index.authority_heads.by_subject.v1"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 533 | `/indexes/18/indexName` | `STRING` | `"by_subject"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 534 | `/indexes/18/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 535 | `/indexes/18/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 536 | `/indexes/18/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 537 | `/indexes/18/lookupPurpose` | `STRING` | `"DERIVED_HEAD_SUBJECT_LOOKUP"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 538 | `/indexes/18/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 539 | `/indexes/18/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 540 | `/indexes/18/ordinal` | `INTEGER` | `19` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 541 | `/indexes/18/ownerStoreIdentity` | `STRING` | `"k334.store.authority_heads.v1"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 542 | `/indexes/18/ownerStoreName` | `STRING` | `"authority_heads"` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 543 | `/indexes/18/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C19, and 6.1 row C19; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 544 | `/indexes/19` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 545 | `/indexes/19/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 546 | `/indexes/19/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 547 | `/indexes/19/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 548 | `/indexes/19/directSourceFields/1` | `STRING` | `"issuerId"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 549 | `/indexes/19/directSourceFields/2` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 550 | `/indexes/19/directSourceFields/3` | `STRING` | `"action"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 551 | `/indexes/19/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 552 | `/indexes/19/indexId` | `STRING` | `"C20"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 553 | `/indexes/19/indexIdentity` | `STRING` | `"k334.index.authority_issuer_policies.by_issuer_subject_action.v1"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 554 | `/indexes/19/indexName` | `STRING` | `"by_issuer_subject_action"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 555 | `/indexes/19/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 556 | `/indexes/19/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 557 | `/indexes/19/keyPath/1` | `STRING` | `"issuerId"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 558 | `/indexes/19/keyPath/2` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 559 | `/indexes/19/keyPath/3` | `STRING` | `"action"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 560 | `/indexes/19/lookupPurpose` | `STRING` | `"ISSUER_POLICY_CANDIDATE_LOOKUP"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 561 | `/indexes/19/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 562 | `/indexes/19/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 563 | `/indexes/19/ordinal` | `INTEGER` | `20` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 564 | `/indexes/19/ownerStoreIdentity` | `STRING` | `"k334.store.authority_issuer_policies.v1"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 565 | `/indexes/19/ownerStoreName` | `STRING` | `"authority_issuer_policies"` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 566 | `/indexes/19/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C20, and 6.1 row C20; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 567 | `/indexes/20` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 568 | `/indexes/20/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 569 | `/indexes/20/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 570 | `/indexes/20/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 571 | `/indexes/20/directSourceFields/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 572 | `/indexes/20/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 573 | `/indexes/20/indexId` | `STRING` | `"C21"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 574 | `/indexes/20/indexIdentity` | `STRING` | `"k334.index.authority_issuer_policies.by_policy_digest.v1"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 575 | `/indexes/20/indexName` | `STRING` | `"by_policy_digest"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 576 | `/indexes/20/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 577 | `/indexes/20/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 578 | `/indexes/20/keyPath/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 579 | `/indexes/20/lookupPurpose` | `STRING` | `"ISSUER_POLICY_DIGEST_INTEGRITY_LOOKUP"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 580 | `/indexes/20/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 581 | `/indexes/20/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 582 | `/indexes/20/ordinal` | `INTEGER` | `21` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 583 | `/indexes/20/ownerStoreIdentity` | `STRING` | `"k334.store.authority_issuer_policies.v1"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 584 | `/indexes/20/ownerStoreName` | `STRING` | `"authority_issuer_policies"` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 585 | `/indexes/20/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C21, and 6.1 row C21; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 586 | `/indexes/21` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 587 | `/indexes/21/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 588 | `/indexes/21/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 589 | `/indexes/21/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 590 | `/indexes/21/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 591 | `/indexes/21/directSourceFields/2` | `STRING` | `"action"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 592 | `/indexes/21/directSourceFields/3` | `STRING` | `"effectiveSequence"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 593 | `/indexes/21/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 594 | `/indexes/21/indexId` | `STRING` | `"C22"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 595 | `/indexes/21/indexIdentity` | `STRING` | `"k334.index.authority_issuer_policies.by_subject_action_sequence.v1"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 596 | `/indexes/21/indexName` | `STRING` | `"by_subject_action_sequence"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 597 | `/indexes/21/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 598 | `/indexes/21/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 599 | `/indexes/21/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 600 | `/indexes/21/keyPath/2` | `STRING` | `"action"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 601 | `/indexes/21/keyPath/3` | `STRING` | `"effectiveSequence"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 602 | `/indexes/21/lookupPurpose` | `STRING` | `"ISSUER_POLICY_APPLICABILITY_CANDIDATE_LOOKUP"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 603 | `/indexes/21/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 604 | `/indexes/21/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 605 | `/indexes/21/ordinal` | `INTEGER` | `22` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 606 | `/indexes/21/ownerStoreIdentity` | `STRING` | `"k334.store.authority_issuer_policies.v1"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 607 | `/indexes/21/ownerStoreName` | `STRING` | `"authority_issuer_policies"` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 608 | `/indexes/21/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C22, and 6.1 row C22; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 609 | `/indexes/22` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 610 | `/indexes/22/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 611 | `/indexes/22/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 612 | `/indexes/22/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 613 | `/indexes/22/directSourceFields/1` | `STRING` | `"issuerId"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 614 | `/indexes/22/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 615 | `/indexes/22/indexId` | `STRING` | `"C23"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 616 | `/indexes/22/indexIdentity` | `STRING` | `"k334.index.authority_issuers.by_issuer_namespace.v1"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 617 | `/indexes/22/indexName` | `STRING` | `"by_issuer_namespace"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 618 | `/indexes/22/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 619 | `/indexes/22/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 620 | `/indexes/22/keyPath/1` | `STRING` | `"issuerId"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 621 | `/indexes/22/lookupPurpose` | `STRING` | `"ISSUER_PRIMARY_KEY_DUPLICATE_LOOKUP"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 622 | `/indexes/22/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 623 | `/indexes/22/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 624 | `/indexes/22/ordinal` | `INTEGER` | `23` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 625 | `/indexes/22/ownerStoreIdentity` | `STRING` | `"k334.store.authority_issuers.v1"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 626 | `/indexes/22/ownerStoreName` | `STRING` | `"authority_issuers"` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 627 | `/indexes/22/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C23, and 6.1 row C23; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 628 | `/indexes/23` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 629 | `/indexes/23/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 630 | `/indexes/23/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 631 | `/indexes/23/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 632 | `/indexes/23/directSourceFields/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 633 | `/indexes/23/directSourceFields/2` | `STRING` | `"checkpointSequence"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 634 | `/indexes/23/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 635 | `/indexes/23/indexId` | `STRING` | `"C24"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 636 | `/indexes/23/indexIdentity` | `STRING` | `"k334.index.authority_migration_checkpoints.by_batch_sequence.v1"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 637 | `/indexes/23/indexName` | `STRING` | `"by_batch_sequence"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 638 | `/indexes/23/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 639 | `/indexes/23/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 640 | `/indexes/23/keyPath/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 641 | `/indexes/23/keyPath/2` | `STRING` | `"checkpointSequence"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 642 | `/indexes/23/lookupPurpose` | `STRING` | `"CHECKPOINT_CONTIGUOUS_SEQUENCE_LOOKUP"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 643 | `/indexes/23/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 644 | `/indexes/23/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 645 | `/indexes/23/ordinal` | `INTEGER` | `24` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 646 | `/indexes/23/ownerStoreIdentity` | `STRING` | `"k334.store.authority_migration_checkpoints.v1"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 647 | `/indexes/23/ownerStoreName` | `STRING` | `"authority_migration_checkpoints"` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 648 | `/indexes/23/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C24, and 6.1 row C24; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 649 | `/indexes/24` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 650 | `/indexes/24/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 651 | `/indexes/24/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 652 | `/indexes/24/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 653 | `/indexes/24/directSourceFields/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 654 | `/indexes/24/directSourceFields/2` | `STRING` | `"status"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 655 | `/indexes/24/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 656 | `/indexes/24/indexId` | `STRING` | `"C25"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 657 | `/indexes/24/indexIdentity` | `STRING` | `"k334.index.authority_migration_checkpoints.by_batch_status.v1"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 658 | `/indexes/24/indexName` | `STRING` | `"by_batch_status"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 659 | `/indexes/24/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 660 | `/indexes/24/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 661 | `/indexes/24/keyPath/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 662 | `/indexes/24/keyPath/2` | `STRING` | `"status"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 663 | `/indexes/24/lookupPurpose` | `STRING` | `"CHECKPOINT_STATUS_CANDIDATE_LOOKUP"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 664 | `/indexes/24/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 665 | `/indexes/24/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 666 | `/indexes/24/ordinal` | `INTEGER` | `25` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 667 | `/indexes/24/ownerStoreIdentity` | `STRING` | `"k334.store.authority_migration_checkpoints.v1"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 668 | `/indexes/24/ownerStoreName` | `STRING` | `"authority_migration_checkpoints"` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 669 | `/indexes/24/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C25, and 6.1 row C25; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 670 | `/indexes/25` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 671 | `/indexes/25/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 672 | `/indexes/25/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 673 | `/indexes/25/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 674 | `/indexes/25/directSourceFields/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 675 | `/indexes/25/directSourceFields/2` | `STRING` | `"classification"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 676 | `/indexes/25/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 677 | `/indexes/25/indexId` | `STRING` | `"C26"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 678 | `/indexes/25/indexIdentity` | `STRING` | `"k334.index.authority_migration_classifications.by_batch_class.v1"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 679 | `/indexes/25/indexName` | `STRING` | `"by_batch_class"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 680 | `/indexes/25/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 681 | `/indexes/25/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 682 | `/indexes/25/keyPath/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 683 | `/indexes/25/keyPath/2` | `STRING` | `"classification"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 684 | `/indexes/25/lookupPurpose` | `STRING` | `"MIGRATION_CLASS_BATCH_ACCOUNTING_LOOKUP"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 685 | `/indexes/25/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 686 | `/indexes/25/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 687 | `/indexes/25/ordinal` | `INTEGER` | `26` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 688 | `/indexes/25/ownerStoreIdentity` | `STRING` | `"k334.store.authority_migration_classifications.v1"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 689 | `/indexes/25/ownerStoreName` | `STRING` | `"authority_migration_classifications"` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 690 | `/indexes/25/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C26, and 6.1 row C26; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 691 | `/indexes/26` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 692 | `/indexes/26/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 693 | `/indexes/26/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 694 | `/indexes/26/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 695 | `/indexes/26/directSourceFields/1` | `STRING` | `"sourceDigest"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 696 | `/indexes/26/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 697 | `/indexes/26/indexId` | `STRING` | `"C27"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 698 | `/indexes/26/indexIdentity` | `STRING` | `"k334.index.authority_migration_classifications.by_source_digest.v1"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 699 | `/indexes/26/indexName` | `STRING` | `"by_source_digest"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 700 | `/indexes/26/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 701 | `/indexes/26/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 702 | `/indexes/26/keyPath/1` | `STRING` | `"sourceDigest"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 703 | `/indexes/26/lookupPurpose` | `STRING` | `"MIGRATION_CLASS_SOURCE_LOOKUP"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 704 | `/indexes/26/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 705 | `/indexes/26/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 706 | `/indexes/26/ordinal` | `INTEGER` | `27` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 707 | `/indexes/26/ownerStoreIdentity` | `STRING` | `"k334.store.authority_migration_classifications.v1"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 708 | `/indexes/26/ownerStoreName` | `STRING` | `"authority_migration_classifications"` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 709 | `/indexes/26/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C27, and 6.1 row C27; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 710 | `/indexes/27` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 711 | `/indexes/27/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 712 | `/indexes/27/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 713 | `/indexes/27/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 714 | `/indexes/27/directSourceFields/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 715 | `/indexes/27/directSourceFields/2` | `STRING` | `"leaseEpoch"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 716 | `/indexes/27/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 717 | `/indexes/27/indexId` | `STRING` | `"C28"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 718 | `/indexes/27/indexIdentity` | `STRING` | `"k334.index.authority_migration_sessions.by_lease_epoch.v1"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 719 | `/indexes/27/indexName` | `STRING` | `"by_lease_epoch"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 720 | `/indexes/27/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 721 | `/indexes/27/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 722 | `/indexes/27/keyPath/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 723 | `/indexes/27/keyPath/2` | `STRING` | `"leaseEpoch"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 724 | `/indexes/27/lookupPurpose` | `STRING` | `"MIGRATION_SESSION_CAS_EPOCH_LOOKUP"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 725 | `/indexes/27/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 726 | `/indexes/27/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 727 | `/indexes/27/ordinal` | `INTEGER` | `28` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 728 | `/indexes/27/ownerStoreIdentity` | `STRING` | `"k334.store.authority_migration_sessions.v1"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 729 | `/indexes/27/ownerStoreName` | `STRING` | `"authority_migration_sessions"` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 730 | `/indexes/27/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C28, and 6.1 row C28; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 731 | `/indexes/28` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 732 | `/indexes/28/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 733 | `/indexes/28/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 734 | `/indexes/28/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 735 | `/indexes/28/directSourceFields/1` | `STRING` | `"sourceDigest"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 736 | `/indexes/28/directSourceFields/2` | `STRING` | `"sessionStatus"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 737 | `/indexes/28/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 738 | `/indexes/28/indexId` | `STRING` | `"C29"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 739 | `/indexes/28/indexIdentity` | `STRING` | `"k334.index.authority_migration_sessions.by_source_status.v1"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 740 | `/indexes/28/indexName` | `STRING` | `"by_source_status"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 741 | `/indexes/28/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 742 | `/indexes/28/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 743 | `/indexes/28/keyPath/1` | `STRING` | `"sourceDigest"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 744 | `/indexes/28/keyPath/2` | `STRING` | `"sessionStatus"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 745 | `/indexes/28/lookupPurpose` | `STRING` | `"MIGRATION_SESSION_SOURCE_STATUS_LOOKUP"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 746 | `/indexes/28/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 747 | `/indexes/28/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 748 | `/indexes/28/ordinal` | `INTEGER` | `29` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 749 | `/indexes/28/ownerStoreIdentity` | `STRING` | `"k334.store.authority_migration_sessions.v1"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 750 | `/indexes/28/ownerStoreName` | `STRING` | `"authority_migration_sessions"` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 751 | `/indexes/28/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C29, and 6.1 row C29; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 752 | `/indexes/29` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 753 | `/indexes/29/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 754 | `/indexes/29/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 755 | `/indexes/29/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 756 | `/indexes/29/directSourceFields/1` | `STRING` | `"quarantineState"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 757 | `/indexes/29/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 758 | `/indexes/29/indexId` | `STRING` | `"C30"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 759 | `/indexes/29/indexIdentity` | `STRING` | `"k334.index.authority_quarantines.by_state.v1"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 760 | `/indexes/29/indexName` | `STRING` | `"by_state"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 761 | `/indexes/29/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 762 | `/indexes/29/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 763 | `/indexes/29/keyPath/1` | `STRING` | `"quarantineState"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 764 | `/indexes/29/lookupPurpose` | `STRING` | `"QUARANTINE_STATE_LOOKUP"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 765 | `/indexes/29/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 766 | `/indexes/29/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 767 | `/indexes/29/ordinal` | `INTEGER` | `30` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 768 | `/indexes/29/ownerStoreIdentity` | `STRING` | `"k334.store.authority_quarantines.v1"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 769 | `/indexes/29/ownerStoreName` | `STRING` | `"authority_quarantines"` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 770 | `/indexes/29/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C30, and 6.1 row C30; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 771 | `/indexes/30` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 772 | `/indexes/30/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 773 | `/indexes/30/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 774 | `/indexes/30/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 775 | `/indexes/30/directSourceFields/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 776 | `/indexes/30/directSourceFields/2` | `STRING` | `"markerStatus"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 777 | `/indexes/30/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 778 | `/indexes/30/indexId` | `STRING` | `"C31"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 779 | `/indexes/30/indexIdentity` | `STRING` | `"k334.index.authority_recovery_markers.by_batch_status.v1"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 780 | `/indexes/30/indexName` | `STRING` | `"by_batch_status"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 781 | `/indexes/30/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 782 | `/indexes/30/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 783 | `/indexes/30/keyPath/1` | `STRING` | `"batchId"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 784 | `/indexes/30/keyPath/2` | `STRING` | `"markerStatus"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 785 | `/indexes/30/lookupPurpose` | `STRING` | `"RECOVERY_MARKER_STATUS_LOOKUP"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 786 | `/indexes/30/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 787 | `/indexes/30/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 788 | `/indexes/30/ordinal` | `INTEGER` | `31` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 789 | `/indexes/30/ownerStoreIdentity` | `STRING` | `"k334.store.authority_recovery_markers.v1"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 790 | `/indexes/30/ownerStoreName` | `STRING` | `"authority_recovery_markers"` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 791 | `/indexes/30/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C31, and 6.1 row C31; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 792 | `/indexes/31` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 793 | `/indexes/31/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 794 | `/indexes/31/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 795 | `/indexes/31/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 796 | `/indexes/31/directSourceFields/1` | `STRING` | `"issuerId"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 797 | `/indexes/31/directSourceFields/2` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 798 | `/indexes/31/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 799 | `/indexes/31/indexId` | `STRING` | `"C32"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 800 | `/indexes/31/indexIdentity` | `STRING` | `"k334.index.authority_rollback_permissions.by_issuer_subject.v1"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 801 | `/indexes/31/indexName` | `STRING` | `"by_issuer_subject"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 802 | `/indexes/31/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 803 | `/indexes/31/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 804 | `/indexes/31/keyPath/1` | `STRING` | `"issuerId"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 805 | `/indexes/31/keyPath/2` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 806 | `/indexes/31/lookupPurpose` | `STRING` | `"ROLLBACK_PERMISSION_ISSUER_SUBJECT_LOOKUP"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 807 | `/indexes/31/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 808 | `/indexes/31/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 809 | `/indexes/31/ordinal` | `INTEGER` | `32` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 810 | `/indexes/31/ownerStoreIdentity` | `STRING` | `"k334.store.authority_rollback_permissions.v1"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 811 | `/indexes/31/ownerStoreName` | `STRING` | `"authority_rollback_permissions"` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 812 | `/indexes/31/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C32, and 6.1 row C32; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 813 | `/indexes/32` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 814 | `/indexes/32/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 815 | `/indexes/32/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 816 | `/indexes/32/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 817 | `/indexes/32/directSourceFields/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 818 | `/indexes/32/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 819 | `/indexes/32/indexId` | `STRING` | `"C33"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 820 | `/indexes/32/indexIdentity` | `STRING` | `"k334.index.authority_rollback_permissions.by_permission_digest.v1"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 821 | `/indexes/32/indexName` | `STRING` | `"by_permission_digest"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 822 | `/indexes/32/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 823 | `/indexes/32/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 824 | `/indexes/32/keyPath/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 825 | `/indexes/32/lookupPurpose` | `STRING` | `"ROLLBACK_PERMISSION_DIGEST_INTEGRITY_LOOKUP"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 826 | `/indexes/32/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 827 | `/indexes/32/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 828 | `/indexes/32/ordinal` | `INTEGER` | `33` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 829 | `/indexes/32/ownerStoreIdentity` | `STRING` | `"k334.store.authority_rollback_permissions.v1"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 830 | `/indexes/32/ownerStoreName` | `STRING` | `"authority_rollback_permissions"` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 831 | `/indexes/32/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C33, and 6.1 row C33; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 832 | `/indexes/33` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 833 | `/indexes/33/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 834 | `/indexes/33/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 835 | `/indexes/33/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 836 | `/indexes/33/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 837 | `/indexes/33/directSourceFields/2` | `STRING` | `"rollbackTargetRecordId"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 838 | `/indexes/33/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 839 | `/indexes/33/indexId` | `STRING` | `"C34"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 840 | `/indexes/33/indexIdentity` | `STRING` | `"k334.index.authority_rollback_permissions.by_target.v1"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 841 | `/indexes/33/indexName` | `STRING` | `"by_target"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 842 | `/indexes/33/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 843 | `/indexes/33/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 844 | `/indexes/33/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 845 | `/indexes/33/keyPath/2` | `STRING` | `"rollbackTargetRecordId"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 846 | `/indexes/33/lookupPurpose` | `STRING` | `"ROLLBACK_PERMISSION_TARGET_LOOKUP"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 847 | `/indexes/33/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 848 | `/indexes/33/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 849 | `/indexes/33/ordinal` | `INTEGER` | `34` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 850 | `/indexes/33/ownerStoreIdentity` | `STRING` | `"k334.store.authority_rollback_permissions.v1"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 851 | `/indexes/33/ownerStoreName` | `STRING` | `"authority_rollback_permissions"` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 852 | `/indexes/33/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C34, and 6.1 row C34; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 853 | `/indexes/34` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 854 | `/indexes/34/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 855 | `/indexes/34/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 856 | `/indexes/34/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 857 | `/indexes/34/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 858 | `/indexes/34/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 859 | `/indexes/34/indexId` | `STRING` | `"C35"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 860 | `/indexes/34/indexIdentity` | `STRING` | `"k334.index.authority_subjects.by_subject_namespace.v1"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 861 | `/indexes/34/indexName` | `STRING` | `"by_subject_namespace"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 862 | `/indexes/34/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 863 | `/indexes/34/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 864 | `/indexes/34/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 865 | `/indexes/34/lookupPurpose` | `STRING` | `"SUBJECT_PRIMARY_KEY_DUPLICATE_LOOKUP"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 866 | `/indexes/34/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 867 | `/indexes/34/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 868 | `/indexes/34/ordinal` | `INTEGER` | `35` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 869 | `/indexes/34/ownerStoreIdentity` | `STRING` | `"k334.store.authority_subjects.v1"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 870 | `/indexes/34/ownerStoreName` | `STRING` | `"authority_subjects"` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 871 | `/indexes/34/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C35, and 6.1 row C35; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 872 | `/indexes/35` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 873 | `/indexes/35/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 874 | `/indexes/35/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 875 | `/indexes/35/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 876 | `/indexes/35/directSourceFields/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 877 | `/indexes/35/directSourceFields/2` | `STRING` | `"effectiveSequence"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 878 | `/indexes/35/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 879 | `/indexes/35/indexId` | `STRING` | `"C36"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 880 | `/indexes/35/indexIdentity` | `STRING` | `"k334.index.authority_terminations.by_subject_sequence.v1"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 881 | `/indexes/35/indexName` | `STRING` | `"by_subject_sequence"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 882 | `/indexes/35/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 883 | `/indexes/35/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 884 | `/indexes/35/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 885 | `/indexes/35/keyPath/2` | `STRING` | `"effectiveSequence"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 886 | `/indexes/35/lookupPurpose` | `STRING` | `"TERMINATION_SUBJECT_SEQUENCE_LOOKUP"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 887 | `/indexes/35/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 888 | `/indexes/35/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 889 | `/indexes/35/ordinal` | `INTEGER` | `36` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 890 | `/indexes/35/ownerStoreIdentity` | `STRING` | `"k334.store.authority_terminations.v1"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 891 | `/indexes/35/ownerStoreName` | `STRING` | `"authority_terminations"` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 892 | `/indexes/35/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C36, and 6.1 row C36; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 893 | `/indexes/36` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 894 | `/indexes/36/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 895 | `/indexes/36/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 896 | `/indexes/36/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 897 | `/indexes/36/directSourceFields/1` | `STRING` | `"targetRecordId"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 898 | `/indexes/36/directSourceFields/2` | `STRING` | `"effectiveSequence"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 899 | `/indexes/36/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 900 | `/indexes/36/indexId` | `STRING` | `"C37"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 901 | `/indexes/36/indexIdentity` | `STRING` | `"k334.index.authority_terminations.by_target.v1"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 902 | `/indexes/36/indexName` | `STRING` | `"by_target"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 903 | `/indexes/36/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 904 | `/indexes/36/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 905 | `/indexes/36/keyPath/1` | `STRING` | `"targetRecordId"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 906 | `/indexes/36/keyPath/2` | `STRING` | `"effectiveSequence"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 907 | `/indexes/36/lookupPurpose` | `STRING` | `"TERMINATION_TARGET_SEQUENCE_LOOKUP"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 908 | `/indexes/36/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 909 | `/indexes/36/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 910 | `/indexes/36/ordinal` | `INTEGER` | `37` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 911 | `/indexes/36/ownerStoreIdentity` | `STRING` | `"k334.store.authority_terminations.v1"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 912 | `/indexes/36/ownerStoreName` | `STRING` | `"authority_terminations"` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 913 | `/indexes/36/unique` | `BOOLEAN` | `false` | Sections 4.5, 6 row C37, and 6.1 row C37; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 914 | `/indexes/37` | `OBJECT` | `OBJECT` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 915 | `/indexes/37/authorityEffect` | `STRING` | `"NON_AUTHORITATIVE_LOOKUP_ONLY"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index authorityEffect | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 916 | `/indexes/37/directSourceFields` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 917 | `/indexes/37/directSourceFields/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 918 | `/indexes/37/directSourceFields/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index directSourceFields | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 919 | `/indexes/37/disposition` | `STRING` | `"ACCEPTED_INSTALLABLE_INDEX"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index disposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 920 | `/indexes/37/indexId` | `STRING` | `"C38"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index indexId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 921 | `/indexes/37/indexIdentity` | `STRING` | `"k334.index.authority_terminations.by_termination_digest.v1"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index indexIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 922 | `/indexes/37/indexName` | `STRING` | `"by_termination_digest"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index indexName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 923 | `/indexes/37/keyPath` | `ARRAY` | `ARRAY` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 924 | `/indexes/37/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 925 | `/indexes/37/keyPath/1` | `STRING` | `"canonicalDigest"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 926 | `/indexes/37/lookupPurpose` | `STRING` | `"TERMINATION_DIGEST_INTEGRITY_LOOKUP"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index lookupPurpose | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 927 | `/indexes/37/multiEntry` | `BOOLEAN` | `false` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index multiEntry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 928 | `/indexes/37/nullOrMissingBehavior` | `STRING` | `"REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index nullOrMissingBehavior | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 929 | `/indexes/37/ordinal` | `INTEGER` | `38` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 930 | `/indexes/37/ownerStoreIdentity` | `STRING` | `"k334.store.authority_terminations.v1"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index ownerStoreIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 931 | `/indexes/37/ownerStoreName` | `STRING` | `"authority_terminations"` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index ownerStoreName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 932 | `/indexes/37/unique` | `BOOLEAN` | `true` | Sections 4.5, 6 row C38, and 6.1 row C38; exact index unique | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 933 | `/installationNamespaceContract` | `OBJECT` | `OBJECT` | Section 4.1 root key installationNamespaceContract; Section 4.2 exact installation namespace contract | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 934 | `/installationNamespaceContract/crossNamespaceInstallation` | `BOOLEAN` | `false` | Section 4.2 exact member crossNamespaceInstallation | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 935 | `/installationNamespaceContract/kind` | `STRING` | `"repository_namespace_and_namespace_key_context_v1"` | Section 4.2 exact member kind | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 936 | `/installationNamespaceContract/namespaceKeySource` | `STRING` | `"validated_operation_context"` | Section 4.2 exact member namespaceKeySource | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 937 | `/installationNamespaceContract/repositoryNamespaceSource` | `STRING` | `"validated_operation_context"` | Section 4.2 exact member repositoryNamespaceSource | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 938 | `/physicalSchemaRevision` | `STRING` | `"K334_PHYSICAL_SCHEMA_REVISION_1"` | Section 4.1 exact root member physicalSchemaRevision | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 939 | `/postInstallVerification` | `OBJECT` | `OBJECT` | Section 4.1 root key postInstallVerification; Section 4.8 exact post-install verification | Section 9 exact accepted proof and no-row-validation boundary | `EXACT` | `UNREVIEWED` |
| 940 | `/postInstallVerification/comparisonPolicyId` | `STRING` | `"K334_IDB_METADATA_EXACT_COMPARISON_V1"` | Section 4.8 exact post-install verification; member comparisonPolicyId | Section 9 exact accepted proof and no-row-validation boundary | `EXACT` | `UNREVIEWED` |
| 941 | `/postInstallVerification/policyId` | `STRING` | `"POST_INSTALL_PHYSICAL_METADATA_VERIFICATION_V1"` | Section 4.8 exact post-install verification; member policyId | Section 9 exact accepted proof and no-row-validation boundary | `EXACT` | `UNREVIEWED` |
| 942 | `/postInstallVerification/result` | `STRING` | `"PHYSICAL_SCHEMA_INSTALLED_EXACTLY_AS_DECLARED_V1"` | Section 4.8 exact post-install verification; member result | Section 9 exact accepted proof and no-row-validation boundary | `EXACT` | `UNREVIEWED` |
| 943 | `/proofLayers` | `ARRAY` | `ARRAY` | Section 4.1 root key proofLayers; Section 12 exact proof-layer inventory | Section 9 exact accepted proof and no-row-validation boundary | `EXACT` | `UNREVIEWED` |
| 944 | `/proofLayers/0` | `STRING` | `"DESCRIPTOR_DOCUMENT_CONFORMANCE_V1"` | Section 12 exact proof layer 1 | Section 9 exact accepted proof and no-row-validation boundary | `EXACT` | `UNREVIEWED` |
| 945 | `/proofLayers/1` | `STRING` | `"POST_INSTALL_PHYSICAL_METADATA_VERIFICATION_V1"` | Section 12 exact proof layer 2 | Section 9 exact accepted proof and no-row-validation boundary | `EXACT` | `UNREVIEWED` |
| 946 | `/proofLayers/2` | `STRING` | `"PERSISTED_ROW_AND_RUNTIME_SEMANTIC_VALIDATION_V1"` | Section 12 exact proof layer 3 | Section 9 exact accepted proof and no-row-validation boundary | `EXACT` | `UNREVIEWED` |
| 947 | `/retryPolicy` | `OBJECT` | `OBJECT` | Section 4.1 root key retryPolicy; Section 4.8 exact retry policy | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 948 | `/retryPolicy/blindRerun` | `BOOLEAN` | `false` | Section 4.8 exact retry policy; member blindRerun | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 949 | `/retryPolicy/exactV4Effect` | `STRING` | `"REPORT_INSTALLATION_NOT_COMMITTED_NO_RETRY_AUTHORITY"` | Section 4.8 exact retry policy; member exactV4Effect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 950 | `/retryPolicy/exactV5Effect` | `STRING` | `"NO_OP_NO_MUTATION"` | Section 4.8 exact retry policy; member exactV5Effect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 951 | `/retryPolicy/partialOrConflictEffect` | `STRING` | `"FAIL_CLOSED_NO_MUTATION"` | Section 4.8 exact retry policy; member partialOrConflictEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 952 | `/retryPolicy/policyId` | `STRING` | `"K334_DESCRIPTOR_RETRY_POLICY_V1"` | Section 4.8 exact retry policy; member policyId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 953 | `/retryPolicy/sameIdDifferentBytes` | `STRING` | `"CONFLICT"` | Section 4.8 exact retry policy; member sameIdDifferentBytes | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 954 | `/sourceDatabaseVersion` | `INTEGER` | `4` | Section 4.1 exact root member sourceDatabaseVersion | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 955 | `/stores` | `ARRAY` | `ARRAY` | Section 4.1 root key stores; Sections 4.4 and 5 exact 17-store inventory | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 956 | `/stores/0` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 957 | `/stores/0/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 958 | `/stores/0/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 959 | `/stores/0/canonicalBindingMode` | `STRING` | `"FIXED_SEMANTIC_KIND_NO_CANONICAL_WRAPPER"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 960 | `/stores/0/canonicalKind` | `NULL` | `null` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 961 | `/stores/0/canonicalVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 962 | `/stores/0/discriminatorMode` | `STRING` | `"NO_DISCRIMINATOR"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 963 | `/stores/0/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 964 | `/stores/0/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 965 | `/stores/0/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 966 | `/stores/0/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 967 | `/stores/0/lifecycleModel` | `STRING` | `"IMMUTABLE_SUBJECT_REGISTRATION_V1"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 968 | `/stores/0/mapId` | `STRING` | `"MAP-01"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 969 | `/stores/0/ordinal` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 970 | `/stores/0/owner` | `STRING` | `"B01"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 971 | `/stores/0/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 972 | `/stores/0/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 973 | `/stores/0/rowId` | `STRING` | `"ROW-01"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 974 | `/stores/0/rowType` | `NULL` | `null` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 975 | `/stores/0/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 976 | `/stores/0/semanticFamily` | `STRING` | `"authority_subject_registration_v1"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 977 | `/stores/0/storeIdentity` | `STRING` | `"k334.store.authority_subjects.v1"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 978 | `/stores/0/storeName` | `STRING` | `"authority_subjects"` | Sections 4.4, 5 ordinal 1, and 5.1 ordinal 1; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 979 | `/stores/1` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 980 | `/stores/1/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 981 | `/stores/1/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 982 | `/stores/1/canonicalBindingMode` | `STRING` | `"FIXED_SEMANTIC_KIND_NO_CANONICAL_WRAPPER"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 983 | `/stores/1/canonicalKind` | `NULL` | `null` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 984 | `/stores/1/canonicalVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 985 | `/stores/1/discriminatorMode` | `STRING` | `"NO_DISCRIMINATOR"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 986 | `/stores/1/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 987 | `/stores/1/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 988 | `/stores/1/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 989 | `/stores/1/keyPath/1` | `STRING` | `"issuerId"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 990 | `/stores/1/lifecycleModel` | `STRING` | `"IMMUTABLE_ISSUER_REGISTRATION_V1"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 991 | `/stores/1/mapId` | `STRING` | `"MAP-02"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 992 | `/stores/1/ordinal` | `INTEGER` | `2` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 993 | `/stores/1/owner` | `STRING` | `"B02"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 994 | `/stores/1/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 995 | `/stores/1/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 996 | `/stores/1/rowId` | `STRING` | `"ROW-02"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 997 | `/stores/1/rowType` | `NULL` | `null` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 998 | `/stores/1/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 999 | `/stores/1/semanticFamily` | `STRING` | `"authority_issuer_registration_v1"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1000 | `/stores/1/storeIdentity` | `STRING` | `"k334.store.authority_issuers.v1"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1001 | `/stores/1/storeName` | `STRING` | `"authority_issuers"` | Sections 4.4, 5 ordinal 2, and 5.1 ordinal 2; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1002 | `/stores/2` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1003 | `/stores/2/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1004 | `/stores/2/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1005 | `/stores/2/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1006 | `/stores/2/canonicalKind` | `STRING` | `"issuer_policy"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1007 | `/stores/2/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1008 | `/stores/2/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1009 | `/stores/2/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1010 | `/stores/2/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1011 | `/stores/2/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1012 | `/stores/2/keyPath/1` | `STRING` | `"policyId"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1013 | `/stores/2/lifecycleModel` | `STRING` | `"IMMUTABLE_CANONICAL_POLICY_ROW_V1"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1014 | `/stores/2/mapId` | `STRING` | `"MAP-03"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1015 | `/stores/2/ordinal` | `INTEGER` | `3` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1016 | `/stores/2/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1017 | `/stores/2/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1018 | `/stores/2/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1019 | `/stores/2/rowId` | `STRING` | `"ROW-03"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1020 | `/stores/2/rowType` | `STRING` | `"k334_physical_issuer_policy_row_v1"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1021 | `/stores/2/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1022 | `/stores/2/semanticFamily` | `STRING` | `"issuer_policy"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1023 | `/stores/2/storeIdentity` | `STRING` | `"k334.store.authority_issuer_policies.v1"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1024 | `/stores/2/storeName` | `STRING` | `"authority_issuer_policies"` | Sections 4.4, 5 ordinal 3, and 5.1 ordinal 3; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1025 | `/stores/3` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1026 | `/stores/3/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1027 | `/stores/3/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1028 | `/stores/3/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1029 | `/stores/3/canonicalKind` | `STRING` | `"authority_evidence"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1030 | `/stores/3/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1031 | `/stores/3/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1032 | `/stores/3/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1033 | `/stores/3/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1034 | `/stores/3/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1035 | `/stores/3/keyPath/1` | `STRING` | `"evidenceId"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1036 | `/stores/3/lifecycleModel` | `STRING` | `"APPEND_ONLY_B08_LIFECYCLE_MATRIX_V1"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1037 | `/stores/3/mapId` | `STRING` | `"MAP-04"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1038 | `/stores/3/ordinal` | `INTEGER` | `4` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1039 | `/stores/3/owner` | `STRING` | `"B08"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1040 | `/stores/3/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1041 | `/stores/3/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1042 | `/stores/3/rowId` | `STRING` | `"ROW-04"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1043 | `/stores/3/rowType` | `STRING` | `"k334_physical_authority_evidence_row_v1"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1044 | `/stores/3/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1045 | `/stores/3/semanticFamily` | `STRING` | `"authority_evidence"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1046 | `/stores/3/storeIdentity` | `STRING` | `"k334.store.authority_evidence.v1"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1047 | `/stores/3/storeName` | `STRING` | `"authority_evidence"` | Sections 4.4, 5 ordinal 4, and 5.1 ordinal 4; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1048 | `/stores/4` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1049 | `/stores/4/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1050 | `/stores/4/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1051 | `/stores/4/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1052 | `/stores/4/canonicalKind` | `STRING` | `"rollback_permission"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1053 | `/stores/4/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1054 | `/stores/4/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1055 | `/stores/4/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1056 | `/stores/4/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1057 | `/stores/4/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1058 | `/stores/4/keyPath/1` | `STRING` | `"permissionId"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1059 | `/stores/4/lifecycleModel` | `STRING` | `"IMMUTABLE_CANONICAL_ROLLBACK_PERMISSION_V1"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1060 | `/stores/4/mapId` | `STRING` | `"MAP-05"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1061 | `/stores/4/ordinal` | `INTEGER` | `5` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1062 | `/stores/4/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1063 | `/stores/4/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1064 | `/stores/4/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1065 | `/stores/4/rowId` | `STRING` | `"ROW-05"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1066 | `/stores/4/rowType` | `STRING` | `"k334_physical_rollback_permission_row_v1"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1067 | `/stores/4/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1068 | `/stores/4/semanticFamily` | `STRING` | `"rollback_permission"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1069 | `/stores/4/storeIdentity` | `STRING` | `"k334.store.authority_rollback_permissions.v1"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1070 | `/stores/4/storeName` | `STRING` | `"authority_rollback_permissions"` | Sections 4.4, 5 ordinal 5, and 5.1 ordinal 5; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1071 | `/stores/5` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1072 | `/stores/5/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1073 | `/stores/5/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1074 | `/stores/5/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1075 | `/stores/5/canonicalKind` | `STRING` | `"termination"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1076 | `/stores/5/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1077 | `/stores/5/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1078 | `/stores/5/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1079 | `/stores/5/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1080 | `/stores/5/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1081 | `/stores/5/keyPath/1` | `STRING` | `"terminationId"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1082 | `/stores/5/lifecycleModel` | `STRING` | `"IMMUTABLE_CANONICAL_TERMINATION_V1"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1083 | `/stores/5/mapId` | `STRING` | `"MAP-06"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1084 | `/stores/5/ordinal` | `INTEGER` | `6` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1085 | `/stores/5/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1086 | `/stores/5/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1087 | `/stores/5/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1088 | `/stores/5/rowId` | `STRING` | `"ROW-06"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1089 | `/stores/5/rowType` | `STRING` | `"k334_physical_termination_row_v1"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1090 | `/stores/5/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1091 | `/stores/5/semanticFamily` | `STRING` | `"termination"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1092 | `/stores/5/storeIdentity` | `STRING` | `"k334.store.authority_terminations.v1"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1093 | `/stores/5/storeName` | `STRING` | `"authority_terminations"` | Sections 4.4, 5 ordinal 6, and 5.1 ordinal 6; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1094 | `/stores/6` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1095 | `/stores/6/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1096 | `/stores/6/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1097 | `/stores/6/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1098 | `/stores/6/canonicalKind` | `STRING` | `"compatibility_tuple"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1099 | `/stores/6/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1100 | `/stores/6/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1101 | `/stores/6/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1102 | `/stores/6/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1103 | `/stores/6/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1104 | `/stores/6/keyPath/1` | `STRING` | `"tupleId"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1105 | `/stores/6/lifecycleModel` | `STRING` | `"IMMUTABLE_DIRECT_COMPATIBILITY_V1"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1106 | `/stores/6/mapId` | `STRING` | `"MAP-07"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1107 | `/stores/6/ordinal` | `INTEGER` | `7` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1108 | `/stores/6/owner` | `STRING` | `"B03"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1109 | `/stores/6/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1110 | `/stores/6/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1111 | `/stores/6/rowId` | `STRING` | `"ROW-07"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1112 | `/stores/6/rowType` | `STRING` | `"k334_physical_compatibility_tuple_row_v1"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1113 | `/stores/6/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1114 | `/stores/6/semanticFamily` | `STRING` | `"compatibility_tuple"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1115 | `/stores/6/storeIdentity` | `STRING` | `"k334.store.authority_compatibility_tuples.v1"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1116 | `/stores/6/storeName` | `STRING` | `"authority_compatibility_tuples"` | Sections 4.4, 5 ordinal 7, and 5.1 ordinal 7; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1117 | `/stores/7` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1118 | `/stores/7/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1119 | `/stores/7/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1120 | `/stores/7/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD_DISCRIMINATED_PAIR"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1121 | `/stores/7/canonicalKind` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1122 | `/stores/7/canonicalKind/0` | `STRING` | `"external_subject_mapping"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1123 | `/stores/7/canonicalKind/1` | `STRING` | `"external_issuer_mapping"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1124 | `/stores/7/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1125 | `/stores/7/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1126 | `/stores/7/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1127 | `/stores/7/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1128 | `/stores/7/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1129 | `/stores/7/keyPath/1` | `STRING` | `"mappingId"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1130 | `/stores/7/lifecycleModel` | `STRING` | `"SEPARATE_TERMINATION_RECORD_AUTHORITY"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1131 | `/stores/7/mapId` | `STRING` | `"MAP-08"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1132 | `/stores/7/ordinal` | `INTEGER` | `8` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1133 | `/stores/7/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1134 | `/stores/7/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1135 | `/stores/7/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1136 | `/stores/7/rowId` | `STRING` | `"ROW-08"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1137 | `/stores/7/rowType` | `STRING` | `"k334_physical_external_mapping_row_v1"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1138 | `/stores/7/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1139 | `/stores/7/semanticFamily` | `STRING` | `"external_mapping"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1140 | `/stores/7/storeIdentity` | `STRING` | `"k334.store.authority_external_mappings.v1"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1141 | `/stores/7/storeName` | `STRING` | `"authority_external_mappings"` | Sections 4.4, 5 ordinal 8, and 5.1 ordinal 8; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1142 | `/stores/8` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1143 | `/stores/8/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1144 | `/stores/8/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1145 | `/stores/8/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1146 | `/stores/8/canonicalKind` | `STRING` | `"fork_observation"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1147 | `/stores/8/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1148 | `/stores/8/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1149 | `/stores/8/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1150 | `/stores/8/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1151 | `/stores/8/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1152 | `/stores/8/keyPath/1` | `STRING` | `"observationId"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1153 | `/stores/8/lifecycleModel` | `STRING` | `"IMMUTABLE_CANONICAL_FORK_OBSERVATION_V1"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1154 | `/stores/8/mapId` | `STRING` | `"MAP-09"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1155 | `/stores/8/ordinal` | `INTEGER` | `9` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1156 | `/stores/8/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1157 | `/stores/8/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1158 | `/stores/8/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1159 | `/stores/8/rowId` | `STRING` | `"ROW-09"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1160 | `/stores/8/rowType` | `STRING` | `"k334_physical_fork_observation_row_v1"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1161 | `/stores/8/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1162 | `/stores/8/semanticFamily` | `STRING` | `"fork_observation"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1163 | `/stores/8/storeIdentity` | `STRING` | `"k334.store.authority_fork_observations.v1"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1164 | `/stores/8/storeName` | `STRING` | `"authority_fork_observations"` | Sections 4.4, 5 ordinal 9, and 5.1 ordinal 9; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1165 | `/stores/9` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1166 | `/stores/9/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1167 | `/stores/9/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1168 | `/stores/9/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1169 | `/stores/9/canonicalKind` | `STRING` | `"conflict_observation"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1170 | `/stores/9/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1171 | `/stores/9/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1172 | `/stores/9/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1173 | `/stores/9/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1174 | `/stores/9/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1175 | `/stores/9/keyPath/1` | `STRING` | `"observationId"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1176 | `/stores/9/lifecycleModel` | `STRING` | `"IMMUTABLE_CANONICAL_CONFLICT_OBSERVATION_V1"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1177 | `/stores/9/mapId` | `STRING` | `"MAP-10"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1178 | `/stores/9/ordinal` | `INTEGER` | `10` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1179 | `/stores/9/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1180 | `/stores/9/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1181 | `/stores/9/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1182 | `/stores/9/rowId` | `STRING` | `"ROW-10"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1183 | `/stores/9/rowType` | `STRING` | `"k334_physical_conflict_observation_row_v1"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1184 | `/stores/9/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1185 | `/stores/9/semanticFamily` | `STRING` | `"conflict_observation"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1186 | `/stores/9/storeIdentity` | `STRING` | `"k334.store.authority_conflict_observations.v1"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1187 | `/stores/9/storeName` | `STRING` | `"authority_conflict_observations"` | Sections 4.4, 5 ordinal 10, and 5.1 ordinal 10; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1188 | `/stores/10` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1189 | `/stores/10/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1190 | `/stores/10/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1191 | `/stores/10/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1192 | `/stores/10/canonicalKind` | `STRING` | `"subject_quarantine"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1193 | `/stores/10/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1194 | `/stores/10/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1195 | `/stores/10/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1196 | `/stores/10/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1197 | `/stores/10/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1198 | `/stores/10/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1199 | `/stores/10/lifecycleModel` | `STRING` | `"IMMUTABLE_CANONICAL_QUARANTINE_RECORD_V1"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1200 | `/stores/10/mapId` | `STRING` | `"MAP-11"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1201 | `/stores/10/ordinal` | `INTEGER` | `11` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1202 | `/stores/10/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1203 | `/stores/10/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1204 | `/stores/10/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1205 | `/stores/10/rowId` | `STRING` | `"ROW-11"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1206 | `/stores/10/rowType` | `STRING` | `"k334_physical_subject_quarantine_row_v1"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1207 | `/stores/10/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1208 | `/stores/10/semanticFamily` | `STRING` | `"subject_quarantine"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1209 | `/stores/10/storeIdentity` | `STRING` | `"k334.store.authority_quarantines.v1"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1210 | `/stores/10/storeName` | `STRING` | `"authority_quarantines"` | Sections 4.4, 5 ordinal 11, and 5.1 ordinal 11; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1211 | `/stores/11` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1212 | `/stores/11/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1213 | `/stores/11/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1214 | `/stores/11/canonicalBindingMode` | `STRING` | `"PROCESS_PREIMAGE_NO_CANONICAL_WRAPPER"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1215 | `/stores/11/canonicalKind` | `NULL` | `null` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1216 | `/stores/11/canonicalVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1217 | `/stores/11/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_PROCESS_RECORD_TYPE"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1218 | `/stores/11/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1219 | `/stores/11/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1220 | `/stores/11/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1221 | `/stores/11/keyPath/1` | `STRING` | `"batchId"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1222 | `/stores/11/lifecycleModel` | `STRING` | `"IMMUTABLE_INTENT_CAS_STATUS_LEASE_V1"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1223 | `/stores/11/mapId` | `STRING` | `"MAP-12"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1224 | `/stores/11/ordinal` | `INTEGER` | `12` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1225 | `/stores/11/owner` | `STRING` | `"B04"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1226 | `/stores/11/recordSchemaVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1227 | `/stores/11/recordType` | `STRING` | `"authority_migration_session_v1"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1228 | `/stores/11/rowId` | `STRING` | `"ROW-12"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1229 | `/stores/11/rowType` | `STRING` | `"k334_physical_migration_session_row_v1"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1230 | `/stores/11/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1231 | `/stores/11/semanticFamily` | `STRING` | `"authority_migration_session_v1"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1232 | `/stores/11/storeIdentity` | `STRING` | `"k334.store.authority_migration_sessions.v1"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1233 | `/stores/11/storeName` | `STRING` | `"authority_migration_sessions"` | Sections 4.4, 5 ordinal 12, and 5.1 ordinal 12; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1234 | `/stores/12` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1235 | `/stores/12/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1236 | `/stores/12/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1237 | `/stores/12/canonicalBindingMode` | `STRING` | `"K334_CANONICAL_RECORD"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1238 | `/stores/12/canonicalKind` | `STRING` | `"migration_classification"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1239 | `/stores/12/canonicalVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1240 | `/stores/12/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_CANONICAL_KIND"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1241 | `/stores/12/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1242 | `/stores/12/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1243 | `/stores/12/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1244 | `/stores/12/keyPath/1` | `STRING` | `"classificationId"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1245 | `/stores/12/lifecycleModel` | `STRING` | `"IMMUTABLE_CANONICAL_MIGRATION_CLASSIFICATION_V1"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1246 | `/stores/12/mapId` | `STRING` | `"MAP-13"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1247 | `/stores/12/ordinal` | `INTEGER` | `13` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1248 | `/stores/12/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1249 | `/stores/12/recordSchemaVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1250 | `/stores/12/recordType` | `NULL` | `null` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1251 | `/stores/12/rowId` | `STRING` | `"ROW-13"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1252 | `/stores/12/rowType` | `STRING` | `"k334_physical_migration_classification_row_v1"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1253 | `/stores/12/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1254 | `/stores/12/semanticFamily` | `STRING` | `"migration_classification"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1255 | `/stores/12/storeIdentity` | `STRING` | `"k334.store.authority_migration_classifications.v1"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1256 | `/stores/12/storeName` | `STRING` | `"authority_migration_classifications"` | Sections 4.4, 5 ordinal 13, and 5.1 ordinal 13; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1257 | `/stores/13` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1258 | `/stores/13/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1259 | `/stores/13/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1260 | `/stores/13/canonicalBindingMode` | `STRING` | `"PROCESS_PREIMAGE_NO_CANONICAL_WRAPPER"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1261 | `/stores/13/canonicalKind` | `NULL` | `null` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1262 | `/stores/13/canonicalVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1263 | `/stores/13/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_PROCESS_RECORD_TYPE"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1264 | `/stores/13/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1265 | `/stores/13/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1266 | `/stores/13/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1267 | `/stores/13/keyPath/1` | `STRING` | `"checkpointId"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1268 | `/stores/13/lifecycleModel` | `STRING` | `"APPEND_ONLY_IMMUTABLE_CONTIGUOUS_CHECKPOINT_V1"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1269 | `/stores/13/mapId` | `STRING` | `"MAP-14"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1270 | `/stores/13/ordinal` | `INTEGER` | `14` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1271 | `/stores/13/owner` | `STRING` | `"B05"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1272 | `/stores/13/recordSchemaVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1273 | `/stores/13/recordType` | `STRING` | `"authority_migration_checkpoint_v1"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1274 | `/stores/13/rowId` | `STRING` | `"ROW-14"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1275 | `/stores/13/rowType` | `STRING` | `"k334_physical_migration_checkpoint_row_v1"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1276 | `/stores/13/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1277 | `/stores/13/semanticFamily` | `STRING` | `"authority_migration_checkpoint_v1"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1278 | `/stores/13/storeIdentity` | `STRING` | `"k334.store.authority_migration_checkpoints.v1"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1279 | `/stores/13/storeName` | `STRING` | `"authority_migration_checkpoints"` | Sections 4.4, 5 ordinal 14, and 5.1 ordinal 14; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1280 | `/stores/14` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1281 | `/stores/14/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1282 | `/stores/14/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1283 | `/stores/14/canonicalBindingMode` | `STRING` | `"PROCESS_PREIMAGE_NO_CANONICAL_WRAPPER"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1284 | `/stores/14/canonicalKind` | `NULL` | `null` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1285 | `/stores/14/canonicalVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1286 | `/stores/14/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_PROCESS_RECORD_TYPE"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1287 | `/stores/14/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1288 | `/stores/14/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1289 | `/stores/14/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1290 | `/stores/14/keyPath/1` | `STRING` | `"markerId"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1291 | `/stores/14/lifecycleModel` | `STRING` | `"APPEND_ONLY_OPEN_RESOLVED_RECOVERY_MARKER_V1"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1292 | `/stores/14/mapId` | `STRING` | `"MAP-15"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1293 | `/stores/14/ordinal` | `INTEGER` | `15` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1294 | `/stores/14/owner` | `STRING` | `"B06"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1295 | `/stores/14/recordSchemaVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1296 | `/stores/14/recordType` | `STRING` | `"authority_recovery_marker_v1"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1297 | `/stores/14/rowId` | `STRING` | `"ROW-15"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1298 | `/stores/14/rowType` | `STRING` | `"k334_physical_recovery_marker_row_v1"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1299 | `/stores/14/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1300 | `/stores/14/semanticFamily` | `STRING` | `"authority_recovery_marker_v1"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1301 | `/stores/14/storeIdentity` | `STRING` | `"k334.store.authority_recovery_markers.v1"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1302 | `/stores/14/storeName` | `STRING` | `"authority_recovery_markers"` | Sections 4.4, 5 ordinal 15, and 5.1 ordinal 15; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1303 | `/stores/15` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1304 | `/stores/15/authorityClassification` | `STRING` | `"DERIVED_REBUILDABLE_NON_AUTHORITY"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1305 | `/stores/15/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1306 | `/stores/15/canonicalBindingMode` | `STRING` | `"DERIVED_PROJECTION_PREIMAGE_NO_CANONICAL_WRAPPER"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1307 | `/stores/15/canonicalKind` | `NULL` | `null` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1308 | `/stores/15/canonicalVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1309 | `/stores/15/discriminatorMode` | `STRING` | `"PROCESS_RECORD_TYPE_ONLY"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1310 | `/stores/15/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1311 | `/stores/15/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1312 | `/stores/15/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1313 | `/stores/15/keyPath/1` | `STRING` | `"subjectId"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1314 | `/stores/15/keyPath/2` | `STRING` | `"lineageId"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1315 | `/stores/15/lifecycleModel` | `STRING` | `"DERIVED_REBUILDABLE_NON_AUTHORITY"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1316 | `/stores/15/mapId` | `STRING` | `"MAP-16"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1317 | `/stores/15/ordinal` | `INTEGER` | `16` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1318 | `/stores/15/owner` | `STRING` | `"K-334P09X"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1319 | `/stores/15/recordSchemaVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1320 | `/stores/15/recordType` | `STRING` | `"authority_head_v1"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1321 | `/stores/15/rowId` | `STRING` | `"ROW-16"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1322 | `/stores/15/rowType` | `NULL` | `null` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1323 | `/stores/15/rowVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1324 | `/stores/15/semanticFamily` | `STRING` | `"authority_head_v1"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1325 | `/stores/15/storeIdentity` | `STRING` | `"k334.store.authority_heads.v1"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1326 | `/stores/15/storeName` | `STRING` | `"authority_heads"` | Sections 4.4, 5 ordinal 16, and 5.1 ordinal 16; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1327 | `/stores/16` | `OBJECT` | `OBJECT` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store complete entry | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1328 | `/stores/16/authorityClassification` | `STRING` | `"PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store authorityClassification | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1329 | `/stores/16/autoIncrement` | `BOOLEAN` | `false` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store autoIncrement | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1330 | `/stores/16/canonicalBindingMode` | `STRING` | `"PROCESS_PREIMAGE_NO_CANONICAL_WRAPPER"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store canonicalBindingMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1331 | `/stores/16/canonicalKind` | `NULL` | `null` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store canonicalKind | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1332 | `/stores/16/canonicalVersion` | `NULL` | `null` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store canonicalVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1333 | `/stores/16/discriminatorMode` | `STRING` | `"ROW_TYPE_AND_PROCESS_RECORD_TYPE"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store discriminatorMode | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1334 | `/stores/16/installationDisposition` | `STRING` | `"ACCEPTED_ADDITIVE_STORE"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store installationDisposition | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1335 | `/stores/16/keyPath` | `ARRAY` | `ARRAY` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1336 | `/stores/16/keyPath/0` | `STRING` | `"namespaceKey"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1337 | `/stores/16/keyPath/1` | `STRING` | `"auditEventId"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store keyPath | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1338 | `/stores/16/lifecycleModel` | `STRING` | `"APPEND_ONLY_IMMUTABLE_AUDIT_EVENT_V1"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store lifecycleModel | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1339 | `/stores/16/mapId` | `STRING` | `"MAP-17"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store mapId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1340 | `/stores/16/ordinal` | `INTEGER` | `17` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store ordinal | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1341 | `/stores/16/owner` | `STRING` | `"B07"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store owner | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1342 | `/stores/16/recordSchemaVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store recordSchemaVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1343 | `/stores/16/recordType` | `STRING` | `"authority_audit_event_v1"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store recordType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1344 | `/stores/16/rowId` | `STRING` | `"ROW-17"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store rowId | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1345 | `/stores/16/rowType` | `STRING` | `"k334_physical_audit_event_row_v1"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store rowType | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1346 | `/stores/16/rowVersion` | `INTEGER` | `1` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store rowVersion | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1347 | `/stores/16/semanticFamily` | `STRING` | `"authority_audit_event_v1"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store semanticFamily | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1348 | `/stores/16/storeIdentity` | `STRING` | `"k334.store.authority_audit_events.v1"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store storeIdentity | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1349 | `/stores/16/storeName` | `STRING` | `"authority_audit_events"` | Sections 4.4, 5 ordinal 17, and 5.1 ordinal 17; exact store storeName | Section 5 exact accepted store and index declarations | `EXACT` | `UNREVIEWED` |
| 1350 | `/targetDatabaseVersion` | `INTEGER` | `5` | Section 4.1 exact root member targetDatabaseVersion | Section 4 exact accepted root configuration and namespace/root-key inventory | `EXACT` | `UNREVIEWED` |
| 1351 | `/transactionGroups` | `ARRAY` | `ARRAY` | Section 4.1 root key transactionGroups; Section 4.7 exact transaction-group array | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1352 | `/transactionGroups/0` | `OBJECT` | `OBJECT` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; complete entry | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1353 | `/transactionGroups/0/atomicity` | `STRING` | `"COMMIT_ALL_OR_ABORT_ALL"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; atomicity | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1354 | `/transactionGroups/0/databaseName` | `STRING` | `"absinthe-local-v2"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; databaseName | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1355 | `/transactionGroups/0/excludedIndexIds` | `ARRAY` | `ARRAY` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; excludedIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1356 | `/transactionGroups/0/excludedIndexIds/0` | `STRING` | `"C03"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; excludedIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1357 | `/transactionGroups/0/failureEffect` | `STRING` | `"ABORT_NO_PARTIAL_SCHEMA_MUTATION"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; failureEffect | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1358 | `/transactionGroups/0/memberIndexIds` | `ARRAY` | `ARRAY` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1359 | `/transactionGroups/0/memberIndexIds/0` | `STRING` | `"C01"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1360 | `/transactionGroups/0/memberIndexIds/1` | `STRING` | `"C02"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1361 | `/transactionGroups/0/memberIndexIds/2` | `STRING` | `"C04"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1362 | `/transactionGroups/0/memberIndexIds/3` | `STRING` | `"C05"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1363 | `/transactionGroups/0/memberIndexIds/4` | `STRING` | `"C06"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1364 | `/transactionGroups/0/memberIndexIds/5` | `STRING` | `"C07"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1365 | `/transactionGroups/0/memberIndexIds/6` | `STRING` | `"C08"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1366 | `/transactionGroups/0/memberIndexIds/7` | `STRING` | `"C09"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1367 | `/transactionGroups/0/memberIndexIds/8` | `STRING` | `"C10"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1368 | `/transactionGroups/0/memberIndexIds/9` | `STRING` | `"C11"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1369 | `/transactionGroups/0/memberIndexIds/10` | `STRING` | `"C12"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1370 | `/transactionGroups/0/memberIndexIds/11` | `STRING` | `"C13"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1371 | `/transactionGroups/0/memberIndexIds/12` | `STRING` | `"C14"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1372 | `/transactionGroups/0/memberIndexIds/13` | `STRING` | `"C15"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1373 | `/transactionGroups/0/memberIndexIds/14` | `STRING` | `"C16"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1374 | `/transactionGroups/0/memberIndexIds/15` | `STRING` | `"C17"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1375 | `/transactionGroups/0/memberIndexIds/16` | `STRING` | `"C18"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1376 | `/transactionGroups/0/memberIndexIds/17` | `STRING` | `"C19"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1377 | `/transactionGroups/0/memberIndexIds/18` | `STRING` | `"C20"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1378 | `/transactionGroups/0/memberIndexIds/19` | `STRING` | `"C21"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1379 | `/transactionGroups/0/memberIndexIds/20` | `STRING` | `"C22"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1380 | `/transactionGroups/0/memberIndexIds/21` | `STRING` | `"C23"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1381 | `/transactionGroups/0/memberIndexIds/22` | `STRING` | `"C24"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1382 | `/transactionGroups/0/memberIndexIds/23` | `STRING` | `"C25"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1383 | `/transactionGroups/0/memberIndexIds/24` | `STRING` | `"C26"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1384 | `/transactionGroups/0/memberIndexIds/25` | `STRING` | `"C27"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1385 | `/transactionGroups/0/memberIndexIds/26` | `STRING` | `"C28"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1386 | `/transactionGroups/0/memberIndexIds/27` | `STRING` | `"C29"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1387 | `/transactionGroups/0/memberIndexIds/28` | `STRING` | `"C30"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1388 | `/transactionGroups/0/memberIndexIds/29` | `STRING` | `"C31"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1389 | `/transactionGroups/0/memberIndexIds/30` | `STRING` | `"C32"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1390 | `/transactionGroups/0/memberIndexIds/31` | `STRING` | `"C33"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1391 | `/transactionGroups/0/memberIndexIds/32` | `STRING` | `"C34"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1392 | `/transactionGroups/0/memberIndexIds/33` | `STRING` | `"C35"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1393 | `/transactionGroups/0/memberIndexIds/34` | `STRING` | `"C36"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1394 | `/transactionGroups/0/memberIndexIds/35` | `STRING` | `"C37"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1395 | `/transactionGroups/0/memberIndexIds/36` | `STRING` | `"C38"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberIndexIds | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1396 | `/transactionGroups/0/memberStoreIdentities` | `ARRAY` | `ARRAY` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1397 | `/transactionGroups/0/memberStoreIdentities/0` | `STRING` | `"k334.store.authority_subjects.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1398 | `/transactionGroups/0/memberStoreIdentities/1` | `STRING` | `"k334.store.authority_issuers.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1399 | `/transactionGroups/0/memberStoreIdentities/2` | `STRING` | `"k334.store.authority_issuer_policies.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1400 | `/transactionGroups/0/memberStoreIdentities/3` | `STRING` | `"k334.store.authority_evidence.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1401 | `/transactionGroups/0/memberStoreIdentities/4` | `STRING` | `"k334.store.authority_rollback_permissions.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1402 | `/transactionGroups/0/memberStoreIdentities/5` | `STRING` | `"k334.store.authority_terminations.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1403 | `/transactionGroups/0/memberStoreIdentities/6` | `STRING` | `"k334.store.authority_compatibility_tuples.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1404 | `/transactionGroups/0/memberStoreIdentities/7` | `STRING` | `"k334.store.authority_external_mappings.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1405 | `/transactionGroups/0/memberStoreIdentities/8` | `STRING` | `"k334.store.authority_fork_observations.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1406 | `/transactionGroups/0/memberStoreIdentities/9` | `STRING` | `"k334.store.authority_conflict_observations.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1407 | `/transactionGroups/0/memberStoreIdentities/10` | `STRING` | `"k334.store.authority_quarantines.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1408 | `/transactionGroups/0/memberStoreIdentities/11` | `STRING` | `"k334.store.authority_migration_sessions.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1409 | `/transactionGroups/0/memberStoreIdentities/12` | `STRING` | `"k334.store.authority_migration_classifications.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1410 | `/transactionGroups/0/memberStoreIdentities/13` | `STRING` | `"k334.store.authority_migration_checkpoints.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1411 | `/transactionGroups/0/memberStoreIdentities/14` | `STRING` | `"k334.store.authority_recovery_markers.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1412 | `/transactionGroups/0/memberStoreIdentities/15` | `STRING` | `"k334.store.authority_heads.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1413 | `/transactionGroups/0/memberStoreIdentities/16` | `STRING` | `"k334.store.authority_audit_events.v1"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; memberStoreIdentities | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1414 | `/transactionGroups/0/predecessorDataPolicy` | `STRING` | `"PRESERVE_EXISTING_V4_STORES_INDEXES_AND_RECORDS_BYTE_UNCHANGED"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; predecessorDataPolicy | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1415 | `/transactionGroups/0/sourceVersion` | `INTEGER` | `4` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; sourceVersion | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1416 | `/transactionGroups/0/targetVersion` | `INTEGER` | `5` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; targetVersion | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1417 | `/transactionGroups/0/transactionGroupId` | `STRING` | `"TG-K334-V4-V5-ADDITIVE-001"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; transactionGroupId | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |
| 1418 | `/transactionGroups/0/transactionKind` | `STRING` | `"NATIVE_INDEXEDDB_VERSIONCHANGE"` | Section 4.7 exact transaction group TG-K334-V4-V5-ADDITIVE-001; transactionKind | Section 8 exact accepted dependency, transaction, conflict, and retry state | `EXACT` | `UNREVIEWED` |

## 15. Predecessor Baseline Evidence Mapping Manifest

Traversal is `K334_PREDECESSOR_EVIDENCE_DEPTH_FIRST_V1`; paths use `K334_PREDECESSOR_EVIDENCE_PATH_V1` with the `predecessor://` scheme and `K334_PREDECESSOR_PATH_PERCENT_ENCODING_V1`. The evidence covers the exact version-4 database identity, nine stores, every store key-path component, 22 globally ordinaled indexes, every index key-path component, and all boolean/null/scalar nodes.

| ordinal | evidencePath | valueKind | normalizedDisplayValue | governingProposalLocation | governingAcceptanceLocation | transcriptionStatus | reviewerStatus |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `predecessor://` | `OBJECT` | `OBJECT` | Section 4.10 exact predecessor baseline root | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 2 | `predecessor://database` | `OBJECT` | `OBJECT` | Section 4.10 exact predecessor database baseline | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 3 | `predecessor://database/name` | `STRING` | `"absinthe-local-v2"` | Section 4.10 exact predecessor database name | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 4 | `predecessor://database/version` | `INTEGER` | `4` | Section 4.10 exact predecessor database version | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 5 | `predecessor://stores` | `ARRAY` | `ARRAY` | Section 4.10 exact predecessor store collection | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 6 | `predecessor://stores/1` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 1 (database_meta) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 7 | `predecessor://stores/1/name` | `STRING` | `"database_meta"` | Section 4.10 predecessor store row 1 (database_meta) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 8 | `predecessor://stores/1/keyPath` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor store row 1 (database_meta) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 9 | `predecessor://stores/1/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 1 (database_meta) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 10 | `predecessor://stores/2` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 2 (generations) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 11 | `predecessor://stores/2/name` | `STRING` | `"generations"` | Section 4.10 predecessor store row 2 (generations) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 12 | `predecessor://stores/2/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor store row 2 (generations) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 13 | `predecessor://stores/2/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor store row 2 (generations) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 14 | `predecessor://stores/2/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor store row 2 (generations) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 15 | `predecessor://stores/2/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 2 (generations) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 16 | `predecessor://stores/3` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 3 (entities) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 17 | `predecessor://stores/3/name` | `STRING` | `"entities"` | Section 4.10 predecessor store row 3 (entities) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 18 | `predecessor://stores/3/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor store row 3 (entities) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 19 | `predecessor://stores/3/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor store row 3 (entities) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 20 | `predecessor://stores/3/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor store row 3 (entities) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 21 | `predecessor://stores/3/keyPath/2` | `STRING` | `"domain"` | Section 4.10 predecessor store row 3 (entities) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 22 | `predecessor://stores/3/keyPath/3` | `STRING` | `"entityId"` | Section 4.10 predecessor store row 3 (entities) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 23 | `predecessor://stores/3/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 3 (entities) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 24 | `predecessor://stores/4` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 4 (outbox) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 25 | `predecessor://stores/4/name` | `STRING` | `"outbox"` | Section 4.10 predecessor store row 4 (outbox) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 26 | `predecessor://stores/4/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor store row 4 (outbox) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 27 | `predecessor://stores/4/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor store row 4 (outbox) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 28 | `predecessor://stores/4/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor store row 4 (outbox) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 29 | `predecessor://stores/4/keyPath/2` | `STRING` | `"mutationId"` | Section 4.10 predecessor store row 4 (outbox) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 30 | `predecessor://stores/4/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 4 (outbox) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 31 | `predecessor://stores/5` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 5 (sync_checkpoints) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 32 | `predecessor://stores/5/name` | `STRING` | `"sync_checkpoints"` | Section 4.10 predecessor store row 5 (sync_checkpoints) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 33 | `predecessor://stores/5/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor store row 5 (sync_checkpoints) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 34 | `predecessor://stores/5/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor store row 5 (sync_checkpoints) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 35 | `predecessor://stores/5/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor store row 5 (sync_checkpoints) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 36 | `predecessor://stores/5/keyPath/2` | `STRING` | `"provider"` | Section 4.10 predecessor store row 5 (sync_checkpoints) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 37 | `predecessor://stores/5/keyPath/3` | `STRING` | `"stream"` | Section 4.10 predecessor store row 5 (sync_checkpoints) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 38 | `predecessor://stores/5/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 5 (sync_checkpoints) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 39 | `predecessor://stores/6` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 6 (restore_sessions) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 40 | `predecessor://stores/6/name` | `STRING` | `"restore_sessions"` | Section 4.10 predecessor store row 6 (restore_sessions) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 41 | `predecessor://stores/6/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor store row 6 (restore_sessions) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 42 | `predecessor://stores/6/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor store row 6 (restore_sessions) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 43 | `predecessor://stores/6/keyPath/1` | `STRING` | `"sessionId"` | Section 4.10 predecessor store row 6 (restore_sessions) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 44 | `predecessor://stores/6/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 6 (restore_sessions) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 45 | `predecessor://stores/7` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 7 (migration_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 46 | `predecessor://stores/7/name` | `STRING` | `"migration_state"` | Section 4.10 predecessor store row 7 (migration_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 47 | `predecessor://stores/7/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor store row 7 (migration_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 48 | `predecessor://stores/7/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor store row 7 (migration_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 49 | `predecessor://stores/7/keyPath/1` | `STRING` | `"migrationId"` | Section 4.10 predecessor store row 7 (migration_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 50 | `predecessor://stores/7/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 7 (migration_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 51 | `predecessor://stores/8` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 8 (attachment_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 52 | `predecessor://stores/8/name` | `STRING` | `"attachment_state"` | Section 4.10 predecessor store row 8 (attachment_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 53 | `predecessor://stores/8/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor store row 8 (attachment_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 54 | `predecessor://stores/8/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor store row 8 (attachment_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 55 | `predecessor://stores/8/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor store row 8 (attachment_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 56 | `predecessor://stores/8/keyPath/2` | `STRING` | `"attachmentId"` | Section 4.10 predecessor store row 8 (attachment_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 57 | `predecessor://stores/8/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 8 (attachment_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 58 | `predecessor://stores/9` | `OBJECT` | `OBJECT` | Section 4.10 predecessor store row 9 (writer_coordination_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 59 | `predecessor://stores/9/name` | `STRING` | `"writer_coordination_state"` | Section 4.10 predecessor store row 9 (writer_coordination_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 60 | `predecessor://stores/9/keyPath` | `NULL` | `null` | Section 4.10 predecessor store row 9 (writer_coordination_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 61 | `predecessor://stores/9/autoIncrement` | `BOOLEAN` | `false` | Section 4.10 predecessor store row 9 (writer_coordination_state) | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 62 | `predecessor://indexes` | `ARRAY` | `ARRAY` | Section 4.10 exact predecessor index collection | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 63 | `predecessor://indexes/1` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 1 (by_schema_version) under store ordinal 1 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 64 | `predecessor://indexes/1/storeOrdinal` | `INTEGER` | `1` | Section 4.10 predecessor index 1 (by_schema_version) under store ordinal 1 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 65 | `predecessor://indexes/1/name` | `STRING` | `"by_schema_version"` | Section 4.10 predecessor index 1 (by_schema_version) under store ordinal 1 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 66 | `predecessor://indexes/1/keyPath` | `STRING` | `"schemaVersion"` | Section 4.10 predecessor index 1 (by_schema_version) under store ordinal 1 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 67 | `predecessor://indexes/1/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 1 (by_schema_version) under store ordinal 1 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 68 | `predecessor://indexes/1/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 1 (by_schema_version) under store ordinal 1 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 69 | `predecessor://indexes/2` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 2 (by_namespace_status) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 70 | `predecessor://indexes/2/storeOrdinal` | `INTEGER` | `2` | Section 4.10 predecessor index 2 (by_namespace_status) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 71 | `predecessor://indexes/2/name` | `STRING` | `"by_namespace_status"` | Section 4.10 predecessor index 2 (by_namespace_status) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 72 | `predecessor://indexes/2/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 2 (by_namespace_status) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 73 | `predecessor://indexes/2/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 2 (by_namespace_status) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 74 | `predecessor://indexes/2/keyPath/1` | `STRING` | `"status"` | Section 4.10 predecessor index 2 (by_namespace_status) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 75 | `predecessor://indexes/2/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 2 (by_namespace_status) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 76 | `predecessor://indexes/2/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 2 (by_namespace_status) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 77 | `predecessor://indexes/3` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 3 (by_namespace_created) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 78 | `predecessor://indexes/3/storeOrdinal` | `INTEGER` | `2` | Section 4.10 predecessor index 3 (by_namespace_created) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 79 | `predecessor://indexes/3/name` | `STRING` | `"by_namespace_created"` | Section 4.10 predecessor index 3 (by_namespace_created) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 80 | `predecessor://indexes/3/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 3 (by_namespace_created) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 81 | `predecessor://indexes/3/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 3 (by_namespace_created) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 82 | `predecessor://indexes/3/keyPath/1` | `STRING` | `"createdAt"` | Section 4.10 predecessor index 3 (by_namespace_created) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 83 | `predecessor://indexes/3/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 3 (by_namespace_created) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 84 | `predecessor://indexes/3/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 3 (by_namespace_created) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 85 | `predecessor://indexes/4` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 4 (one_active_per_namespace) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 86 | `predecessor://indexes/4/storeOrdinal` | `INTEGER` | `2` | Section 4.10 predecessor index 4 (one_active_per_namespace) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 87 | `predecessor://indexes/4/name` | `STRING` | `"one_active_per_namespace"` | Section 4.10 predecessor index 4 (one_active_per_namespace) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 88 | `predecessor://indexes/4/keyPath` | `STRING` | `"activeNamespaceKey"` | Section 4.10 predecessor index 4 (one_active_per_namespace) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 89 | `predecessor://indexes/4/unique` | `BOOLEAN` | `true` | Section 4.10 predecessor index 4 (one_active_per_namespace) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 90 | `predecessor://indexes/4/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 4 (one_active_per_namespace) under store ordinal 2 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 91 | `predecessor://indexes/5` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 92 | `predecessor://indexes/5/storeOrdinal` | `INTEGER` | `3` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 93 | `predecessor://indexes/5/name` | `STRING` | `"by_namespace_generation_domain"` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 94 | `predecessor://indexes/5/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 95 | `predecessor://indexes/5/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 96 | `predecessor://indexes/5/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 97 | `predecessor://indexes/5/keyPath/2` | `STRING` | `"domain"` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 98 | `predecessor://indexes/5/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 99 | `predecessor://indexes/5/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 5 (by_namespace_generation_domain) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 100 | `predecessor://indexes/6` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 101 | `predecessor://indexes/6/storeOrdinal` | `INTEGER` | `3` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 102 | `predecessor://indexes/6/name` | `STRING` | `"by_namespace_generation_owner"` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 103 | `predecessor://indexes/6/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 104 | `predecessor://indexes/6/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 105 | `predecessor://indexes/6/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 106 | `predecessor://indexes/6/keyPath/2` | `STRING` | `"ownerId"` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 107 | `predecessor://indexes/6/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 108 | `predecessor://indexes/6/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 6 (by_namespace_generation_owner) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 109 | `predecessor://indexes/7` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 110 | `predecessor://indexes/7/storeOrdinal` | `INTEGER` | `3` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 111 | `predecessor://indexes/7/name` | `STRING` | `"by_namespace_generation_deleted"` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 112 | `predecessor://indexes/7/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 113 | `predecessor://indexes/7/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 114 | `predecessor://indexes/7/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 115 | `predecessor://indexes/7/keyPath/2` | `STRING` | `"deletionState"` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 116 | `predecessor://indexes/7/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 117 | `predecessor://indexes/7/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 7 (by_namespace_generation_deleted) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 118 | `predecessor://indexes/8` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 119 | `predecessor://indexes/8/storeOrdinal` | `INTEGER` | `3` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 120 | `predecessor://indexes/8/name` | `STRING` | `"by_namespace_generation_updated"` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 121 | `predecessor://indexes/8/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 122 | `predecessor://indexes/8/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 123 | `predecessor://indexes/8/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 124 | `predecessor://indexes/8/keyPath/2` | `STRING` | `"updatedAt"` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 125 | `predecessor://indexes/8/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 126 | `predecessor://indexes/8/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 8 (by_namespace_generation_updated) under store ordinal 3 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 127 | `predecessor://indexes/9` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 128 | `predecessor://indexes/9/storeOrdinal` | `INTEGER` | `4` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 129 | `predecessor://indexes/9/name` | `STRING` | `"by_namespace_generation_status"` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 130 | `predecessor://indexes/9/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 131 | `predecessor://indexes/9/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 132 | `predecessor://indexes/9/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 133 | `predecessor://indexes/9/keyPath/2` | `STRING` | `"status"` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 134 | `predecessor://indexes/9/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 135 | `predecessor://indexes/9/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 9 (by_namespace_generation_status) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 136 | `predecessor://indexes/10` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 137 | `predecessor://indexes/10/storeOrdinal` | `INTEGER` | `4` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 138 | `predecessor://indexes/10/name` | `STRING` | `"by_namespace_generation_entity"` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 139 | `predecessor://indexes/10/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 140 | `predecessor://indexes/10/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 141 | `predecessor://indexes/10/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 142 | `predecessor://indexes/10/keyPath/2` | `STRING` | `"domain"` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 143 | `predecessor://indexes/10/keyPath/3` | `STRING` | `"entityId"` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 144 | `predecessor://indexes/10/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 145 | `predecessor://indexes/10/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 10 (by_namespace_generation_entity) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 146 | `predecessor://indexes/11` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 147 | `predecessor://indexes/11/storeOrdinal` | `INTEGER` | `4` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 148 | `predecessor://indexes/11/name` | `STRING` | `"by_idempotency_key"` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 149 | `predecessor://indexes/11/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 150 | `predecessor://indexes/11/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 151 | `predecessor://indexes/11/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 152 | `predecessor://indexes/11/keyPath/2` | `STRING` | `"idempotencyKey"` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 153 | `predecessor://indexes/11/unique` | `BOOLEAN` | `true` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 154 | `predecessor://indexes/11/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 11 (by_idempotency_key) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 155 | `predecessor://indexes/12` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 156 | `predecessor://indexes/12/storeOrdinal` | `INTEGER` | `4` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 157 | `predecessor://indexes/12/name` | `STRING` | `"by_namespace_generation_status_available"` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 158 | `predecessor://indexes/12/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 159 | `predecessor://indexes/12/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 160 | `predecessor://indexes/12/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 161 | `predecessor://indexes/12/keyPath/2` | `STRING` | `"status"` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 162 | `predecessor://indexes/12/keyPath/3` | `STRING` | `"availableAt"` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 163 | `predecessor://indexes/12/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 164 | `predecessor://indexes/12/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 12 (by_namespace_generation_status_available) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 165 | `predecessor://indexes/13` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 166 | `predecessor://indexes/13/storeOrdinal` | `INTEGER` | `4` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 167 | `predecessor://indexes/13/name` | `STRING` | `"by_namespace_generation_status_lease"` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 168 | `predecessor://indexes/13/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 169 | `predecessor://indexes/13/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 170 | `predecessor://indexes/13/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 171 | `predecessor://indexes/13/keyPath/2` | `STRING` | `"status"` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 172 | `predecessor://indexes/13/keyPath/3` | `STRING` | `"leaseExpiresAt"` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 173 | `predecessor://indexes/13/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 174 | `predecessor://indexes/13/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 13 (by_namespace_generation_status_lease) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 175 | `predecessor://indexes/14` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 176 | `predecessor://indexes/14/storeOrdinal` | `INTEGER` | `4` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 177 | `predecessor://indexes/14/name` | `STRING` | `"by_namespace_generation_entity_revision"` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 178 | `predecessor://indexes/14/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 179 | `predecessor://indexes/14/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 180 | `predecessor://indexes/14/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 181 | `predecessor://indexes/14/keyPath/2` | `STRING` | `"domain"` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 182 | `predecessor://indexes/14/keyPath/3` | `STRING` | `"entityId"` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 183 | `predecessor://indexes/14/keyPath/4` | `STRING` | `"localRevision"` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 184 | `predecessor://indexes/14/unique` | `BOOLEAN` | `true` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 185 | `predecessor://indexes/14/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 14 (by_namespace_generation_entity_revision) under store ordinal 4 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 186 | `predecessor://indexes/15` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 187 | `predecessor://indexes/15/storeOrdinal` | `INTEGER` | `5` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 188 | `predecessor://indexes/15/name` | `STRING` | `"by_namespace_generation_provider"` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 189 | `predecessor://indexes/15/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 190 | `predecessor://indexes/15/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 191 | `predecessor://indexes/15/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 192 | `predecessor://indexes/15/keyPath/2` | `STRING` | `"provider"` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 193 | `predecessor://indexes/15/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 194 | `predecessor://indexes/15/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 15 (by_namespace_generation_provider) under store ordinal 5 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 195 | `predecessor://indexes/16` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 16 (by_namespace_status) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 196 | `predecessor://indexes/16/storeOrdinal` | `INTEGER` | `6` | Section 4.10 predecessor index 16 (by_namespace_status) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 197 | `predecessor://indexes/16/name` | `STRING` | `"by_namespace_status"` | Section 4.10 predecessor index 16 (by_namespace_status) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 198 | `predecessor://indexes/16/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 16 (by_namespace_status) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 199 | `predecessor://indexes/16/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 16 (by_namespace_status) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 200 | `predecessor://indexes/16/keyPath/1` | `STRING` | `"status"` | Section 4.10 predecessor index 16 (by_namespace_status) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 201 | `predecessor://indexes/16/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 16 (by_namespace_status) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 202 | `predecessor://indexes/16/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 16 (by_namespace_status) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 203 | `predecessor://indexes/17` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 17 (by_namespace_package_id) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 204 | `predecessor://indexes/17/storeOrdinal` | `INTEGER` | `6` | Section 4.10 predecessor index 17 (by_namespace_package_id) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 205 | `predecessor://indexes/17/name` | `STRING` | `"by_namespace_package_id"` | Section 4.10 predecessor index 17 (by_namespace_package_id) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 206 | `predecessor://indexes/17/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 17 (by_namespace_package_id) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 207 | `predecessor://indexes/17/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 17 (by_namespace_package_id) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 208 | `predecessor://indexes/17/keyPath/1` | `STRING` | `"packageId"` | Section 4.10 predecessor index 17 (by_namespace_package_id) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 209 | `predecessor://indexes/17/unique` | `BOOLEAN` | `true` | Section 4.10 predecessor index 17 (by_namespace_package_id) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 210 | `predecessor://indexes/17/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 17 (by_namespace_package_id) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 211 | `predecessor://indexes/18` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 18 (by_namespace_package_digest) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 212 | `predecessor://indexes/18/storeOrdinal` | `INTEGER` | `6` | Section 4.10 predecessor index 18 (by_namespace_package_digest) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 213 | `predecessor://indexes/18/name` | `STRING` | `"by_namespace_package_digest"` | Section 4.10 predecessor index 18 (by_namespace_package_digest) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 214 | `predecessor://indexes/18/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 18 (by_namespace_package_digest) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 215 | `predecessor://indexes/18/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 18 (by_namespace_package_digest) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 216 | `predecessor://indexes/18/keyPath/1` | `STRING` | `"packageDigest"` | Section 4.10 predecessor index 18 (by_namespace_package_digest) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 217 | `predecessor://indexes/18/unique` | `BOOLEAN` | `true` | Section 4.10 predecessor index 18 (by_namespace_package_digest) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 218 | `predecessor://indexes/18/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 18 (by_namespace_package_digest) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 219 | `predecessor://indexes/19` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 19 (by_namespace_staging_generation) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 220 | `predecessor://indexes/19/storeOrdinal` | `INTEGER` | `6` | Section 4.10 predecessor index 19 (by_namespace_staging_generation) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 221 | `predecessor://indexes/19/name` | `STRING` | `"by_namespace_staging_generation"` | Section 4.10 predecessor index 19 (by_namespace_staging_generation) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 222 | `predecessor://indexes/19/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 19 (by_namespace_staging_generation) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 223 | `predecessor://indexes/19/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 19 (by_namespace_staging_generation) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 224 | `predecessor://indexes/19/keyPath/1` | `STRING` | `"stagingGenerationId"` | Section 4.10 predecessor index 19 (by_namespace_staging_generation) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 225 | `predecessor://indexes/19/unique` | `BOOLEAN` | `true` | Section 4.10 predecessor index 19 (by_namespace_staging_generation) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 226 | `predecessor://indexes/19/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 19 (by_namespace_staging_generation) under store ordinal 6 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 227 | `predecessor://indexes/20` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 20 (by_namespace_phase) under store ordinal 7 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 228 | `predecessor://indexes/20/storeOrdinal` | `INTEGER` | `7` | Section 4.10 predecessor index 20 (by_namespace_phase) under store ordinal 7 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 229 | `predecessor://indexes/20/name` | `STRING` | `"by_namespace_phase"` | Section 4.10 predecessor index 20 (by_namespace_phase) under store ordinal 7 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 230 | `predecessor://indexes/20/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 20 (by_namespace_phase) under store ordinal 7 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 231 | `predecessor://indexes/20/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 20 (by_namespace_phase) under store ordinal 7 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 232 | `predecessor://indexes/20/keyPath/1` | `STRING` | `"phase"` | Section 4.10 predecessor index 20 (by_namespace_phase) under store ordinal 7 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 233 | `predecessor://indexes/20/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 20 (by_namespace_phase) under store ordinal 7 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 234 | `predecessor://indexes/20/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 20 (by_namespace_phase) under store ordinal 7 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 235 | `predecessor://indexes/21` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 236 | `predecessor://indexes/21/storeOrdinal` | `INTEGER` | `8` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 237 | `predecessor://indexes/21/name` | `STRING` | `"by_namespace_generation_sync"` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 238 | `predecessor://indexes/21/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 239 | `predecessor://indexes/21/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 240 | `predecessor://indexes/21/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 241 | `predecessor://indexes/21/keyPath/2` | `STRING` | `"syncState"` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 242 | `predecessor://indexes/21/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 243 | `predecessor://indexes/21/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 21 (by_namespace_generation_sync) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 244 | `predecessor://indexes/22` | `OBJECT` | `OBJECT` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 245 | `predecessor://indexes/22/storeOrdinal` | `INTEGER` | `8` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 246 | `predecessor://indexes/22/name` | `STRING` | `"by_namespace_generation_updated"` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 247 | `predecessor://indexes/22/keyPath` | `ARRAY` | `ARRAY` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 248 | `predecessor://indexes/22/keyPath/0` | `STRING` | `"namespaceKey"` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 249 | `predecessor://indexes/22/keyPath/1` | `STRING` | `"generationId"` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 250 | `predecessor://indexes/22/keyPath/2` | `STRING` | `"updatedAt"` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 251 | `predecessor://indexes/22/unique` | `BOOLEAN` | `false` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |
| 252 | `predecessor://indexes/22/multiEntry` | `BOOLEAN` | `false` | Section 4.10 predecessor index 22 (by_namespace_generation_updated) under store ordinal 8 | Section 7 exact accepted predecessor-baseline authority and version-4 populated evidence | `EXACT` | `UNREVIEWED` |

## 16. Artifact Mapping Completeness Manifest

```json
{
  "manifestKind": "K334_DESCRIPTOR_FIELD_MAPPING_COMPLETENESS_MANIFEST_V1",
  "mappingSchemaKind": "K334_DESCRIPTOR_FIELD_MAPPING_ROW_V1",
  "traversalKind": "K334_DESCRIPTOR_MAPPING_DEPTH_FIRST_UTF16_V1",
  "mappingRowCount": 1418,
  "totalNodeCount": 1418,
  "objectNodeCount": 69,
  "arrayNodeCount": 116,
  "stringNodeCount": 996,
  "integerNodeCount": 91,
  "booleanNodeCount": 101,
  "nullNodeCount": 45,
  "storeEntryRowRanges": [
    {
      "ordinal": 1,
      "identity": "k334.store.authority_subjects.v1",
      "pointer": "/stores/0",
      "firstRow": 956,
      "lastRow": 978,
      "rowCount": 23
    },
    {
      "ordinal": 2,
      "identity": "k334.store.authority_issuers.v1",
      "pointer": "/stores/1",
      "firstRow": 979,
      "lastRow": 1001,
      "rowCount": 23
    },
    {
      "ordinal": 3,
      "identity": "k334.store.authority_issuer_policies.v1",
      "pointer": "/stores/2",
      "firstRow": 1002,
      "lastRow": 1024,
      "rowCount": 23
    },
    {
      "ordinal": 4,
      "identity": "k334.store.authority_evidence.v1",
      "pointer": "/stores/3",
      "firstRow": 1025,
      "lastRow": 1047,
      "rowCount": 23
    },
    {
      "ordinal": 5,
      "identity": "k334.store.authority_rollback_permissions.v1",
      "pointer": "/stores/4",
      "firstRow": 1048,
      "lastRow": 1070,
      "rowCount": 23
    },
    {
      "ordinal": 6,
      "identity": "k334.store.authority_terminations.v1",
      "pointer": "/stores/5",
      "firstRow": 1071,
      "lastRow": 1093,
      "rowCount": 23
    },
    {
      "ordinal": 7,
      "identity": "k334.store.authority_compatibility_tuples.v1",
      "pointer": "/stores/6",
      "firstRow": 1094,
      "lastRow": 1116,
      "rowCount": 23
    },
    {
      "ordinal": 8,
      "identity": "k334.store.authority_external_mappings.v1",
      "pointer": "/stores/7",
      "firstRow": 1117,
      "lastRow": 1141,
      "rowCount": 25
    },
    {
      "ordinal": 9,
      "identity": "k334.store.authority_fork_observations.v1",
      "pointer": "/stores/8",
      "firstRow": 1142,
      "lastRow": 1164,
      "rowCount": 23
    },
    {
      "ordinal": 10,
      "identity": "k334.store.authority_conflict_observations.v1",
      "pointer": "/stores/9",
      "firstRow": 1165,
      "lastRow": 1187,
      "rowCount": 23
    },
    {
      "ordinal": 11,
      "identity": "k334.store.authority_quarantines.v1",
      "pointer": "/stores/10",
      "firstRow": 1188,
      "lastRow": 1210,
      "rowCount": 23
    },
    {
      "ordinal": 12,
      "identity": "k334.store.authority_migration_sessions.v1",
      "pointer": "/stores/11",
      "firstRow": 1211,
      "lastRow": 1233,
      "rowCount": 23
    },
    {
      "ordinal": 13,
      "identity": "k334.store.authority_migration_classifications.v1",
      "pointer": "/stores/12",
      "firstRow": 1234,
      "lastRow": 1256,
      "rowCount": 23
    },
    {
      "ordinal": 14,
      "identity": "k334.store.authority_migration_checkpoints.v1",
      "pointer": "/stores/13",
      "firstRow": 1257,
      "lastRow": 1279,
      "rowCount": 23
    },
    {
      "ordinal": 15,
      "identity": "k334.store.authority_recovery_markers.v1",
      "pointer": "/stores/14",
      "firstRow": 1280,
      "lastRow": 1302,
      "rowCount": 23
    },
    {
      "ordinal": 16,
      "identity": "k334.store.authority_heads.v1",
      "pointer": "/stores/15",
      "firstRow": 1303,
      "lastRow": 1326,
      "rowCount": 24
    },
    {
      "ordinal": 17,
      "identity": "k334.store.authority_audit_events.v1",
      "pointer": "/stores/16",
      "firstRow": 1327,
      "lastRow": 1349,
      "rowCount": 23
    }
  ],
  "indexEntryRowRanges": [
    {
      "ordinal": 1,
      "identity": "k334.index.authority_audit_events.by_record.v1",
      "pointer": "/indexes/0",
      "firstRow": 169,
      "lastRow": 187,
      "rowCount": 19
    },
    {
      "ordinal": 2,
      "identity": "k334.index.authority_audit_events.by_source_digest.v1",
      "pointer": "/indexes/1",
      "firstRow": 188,
      "lastRow": 206,
      "rowCount": 19
    },
    {
      "ordinal": 3,
      "identity": "k334.index.authority_audit_events.by_subject.v1",
      "pointer": "/indexes/2",
      "firstRow": 207,
      "lastRow": 221,
      "rowCount": 15
    },
    {
      "ordinal": 4,
      "identity": "k334.index.authority_compatibility_tuples.by_exact_tuple.v1",
      "pointer": "/indexes/3",
      "firstRow": 222,
      "lastRow": 240,
      "rowCount": 19
    },
    {
      "ordinal": 5,
      "identity": "k334.index.authority_compatibility_tuples.by_tuple_status.v1",
      "pointer": "/indexes/4",
      "firstRow": 241,
      "lastRow": 259,
      "rowCount": 19
    },
    {
      "ordinal": 6,
      "identity": "k334.index.authority_conflict_observations.by_observation_digest.v1",
      "pointer": "/indexes/5",
      "firstRow": 260,
      "lastRow": 278,
      "rowCount": 19
    },
    {
      "ordinal": 7,
      "identity": "k334.index.authority_conflict_observations.by_subject_code.v1",
      "pointer": "/indexes/6",
      "firstRow": 279,
      "lastRow": 299,
      "rowCount": 21
    },
    {
      "ordinal": 8,
      "identity": "k334.index.authority_evidence.by_digest.v1",
      "pointer": "/indexes/7",
      "firstRow": 300,
      "lastRow": 318,
      "rowCount": 19
    },
    {
      "ordinal": 9,
      "identity": "k334.index.authority_evidence.by_issuer.v1",
      "pointer": "/indexes/8",
      "firstRow": 319,
      "lastRow": 337,
      "rowCount": 19
    },
    {
      "ordinal": 10,
      "identity": "k334.index.authority_evidence.by_predecessor.v1",
      "pointer": "/indexes/9",
      "firstRow": 338,
      "lastRow": 356,
      "rowCount": 19
    },
    {
      "ordinal": 11,
      "identity": "k334.index.authority_evidence.by_subject_lineage_sequence.v1",
      "pointer": "/indexes/10",
      "firstRow": 357,
      "lastRow": 379,
      "rowCount": 23
    },
    {
      "ordinal": 12,
      "identity": "k334.index.authority_evidence.by_subject_status.v1",
      "pointer": "/indexes/11",
      "firstRow": 380,
      "lastRow": 400,
      "rowCount": 21
    },
    {
      "ordinal": 13,
      "identity": "k334.index.authority_external_mappings.by_external.v1",
      "pointer": "/indexes/12",
      "firstRow": 401,
      "lastRow": 425,
      "rowCount": 25
    },
    {
      "ordinal": 14,
      "identity": "k334.index.authority_external_mappings.by_internal.v1",
      "pointer": "/indexes/13",
      "firstRow": 426,
      "lastRow": 446,
      "rowCount": 21
    },
    {
      "ordinal": 15,
      "identity": "k334.index.authority_external_mappings.by_mapping_digest.v1",
      "pointer": "/indexes/14",
      "firstRow": 447,
      "lastRow": 465,
      "rowCount": 19
    },
    {
      "ordinal": 16,
      "identity": "k334.index.authority_fork_observations.by_observation_digest.v1",
      "pointer": "/indexes/15",
      "firstRow": 466,
      "lastRow": 484,
      "rowCount": 19
    },
    {
      "ordinal": 17,
      "identity": "k334.index.authority_fork_observations.by_subject_predecessor.v1",
      "pointer": "/indexes/16",
      "firstRow": 485,
      "lastRow": 505,
      "rowCount": 21
    },
    {
      "ordinal": 18,
      "identity": "k334.index.authority_heads.by_projection_digest.v1",
      "pointer": "/indexes/17",
      "firstRow": 506,
      "lastRow": 524,
      "rowCount": 19
    },
    {
      "ordinal": 19,
      "identity": "k334.index.authority_heads.by_subject.v1",
      "pointer": "/indexes/18",
      "firstRow": 525,
      "lastRow": 543,
      "rowCount": 19
    },
    {
      "ordinal": 20,
      "identity": "k334.index.authority_issuer_policies.by_issuer_subject_action.v1",
      "pointer": "/indexes/19",
      "firstRow": 544,
      "lastRow": 566,
      "rowCount": 23
    },
    {
      "ordinal": 21,
      "identity": "k334.index.authority_issuer_policies.by_policy_digest.v1",
      "pointer": "/indexes/20",
      "firstRow": 567,
      "lastRow": 585,
      "rowCount": 19
    },
    {
      "ordinal": 22,
      "identity": "k334.index.authority_issuer_policies.by_subject_action_sequence.v1",
      "pointer": "/indexes/21",
      "firstRow": 586,
      "lastRow": 608,
      "rowCount": 23
    },
    {
      "ordinal": 23,
      "identity": "k334.index.authority_issuers.by_issuer_namespace.v1",
      "pointer": "/indexes/22",
      "firstRow": 609,
      "lastRow": 627,
      "rowCount": 19
    },
    {
      "ordinal": 24,
      "identity": "k334.index.authority_migration_checkpoints.by_batch_sequence.v1",
      "pointer": "/indexes/23",
      "firstRow": 628,
      "lastRow": 648,
      "rowCount": 21
    },
    {
      "ordinal": 25,
      "identity": "k334.index.authority_migration_checkpoints.by_batch_status.v1",
      "pointer": "/indexes/24",
      "firstRow": 649,
      "lastRow": 669,
      "rowCount": 21
    },
    {
      "ordinal": 26,
      "identity": "k334.index.authority_migration_classifications.by_batch_class.v1",
      "pointer": "/indexes/25",
      "firstRow": 670,
      "lastRow": 690,
      "rowCount": 21
    },
    {
      "ordinal": 27,
      "identity": "k334.index.authority_migration_classifications.by_source_digest.v1",
      "pointer": "/indexes/26",
      "firstRow": 691,
      "lastRow": 709,
      "rowCount": 19
    },
    {
      "ordinal": 28,
      "identity": "k334.index.authority_migration_sessions.by_lease_epoch.v1",
      "pointer": "/indexes/27",
      "firstRow": 710,
      "lastRow": 730,
      "rowCount": 21
    },
    {
      "ordinal": 29,
      "identity": "k334.index.authority_migration_sessions.by_source_status.v1",
      "pointer": "/indexes/28",
      "firstRow": 731,
      "lastRow": 751,
      "rowCount": 21
    },
    {
      "ordinal": 30,
      "identity": "k334.index.authority_quarantines.by_state.v1",
      "pointer": "/indexes/29",
      "firstRow": 752,
      "lastRow": 770,
      "rowCount": 19
    },
    {
      "ordinal": 31,
      "identity": "k334.index.authority_recovery_markers.by_batch_status.v1",
      "pointer": "/indexes/30",
      "firstRow": 771,
      "lastRow": 791,
      "rowCount": 21
    },
    {
      "ordinal": 32,
      "identity": "k334.index.authority_rollback_permissions.by_issuer_subject.v1",
      "pointer": "/indexes/31",
      "firstRow": 792,
      "lastRow": 812,
      "rowCount": 21
    },
    {
      "ordinal": 33,
      "identity": "k334.index.authority_rollback_permissions.by_permission_digest.v1",
      "pointer": "/indexes/32",
      "firstRow": 813,
      "lastRow": 831,
      "rowCount": 19
    },
    {
      "ordinal": 34,
      "identity": "k334.index.authority_rollback_permissions.by_target.v1",
      "pointer": "/indexes/33",
      "firstRow": 832,
      "lastRow": 852,
      "rowCount": 21
    },
    {
      "ordinal": 35,
      "identity": "k334.index.authority_subjects.by_subject_namespace.v1",
      "pointer": "/indexes/34",
      "firstRow": 853,
      "lastRow": 871,
      "rowCount": 19
    },
    {
      "ordinal": 36,
      "identity": "k334.index.authority_terminations.by_subject_sequence.v1",
      "pointer": "/indexes/35",
      "firstRow": 872,
      "lastRow": 892,
      "rowCount": 21
    },
    {
      "ordinal": 37,
      "identity": "k334.index.authority_terminations.by_target.v1",
      "pointer": "/indexes/36",
      "firstRow": 893,
      "lastRow": 913,
      "rowCount": 21
    },
    {
      "ordinal": 38,
      "identity": "k334.index.authority_terminations.by_termination_digest.v1",
      "pointer": "/indexes/37",
      "firstRow": 914,
      "lastRow": 932,
      "rowCount": 19
    }
  ],
  "pointerSetSha256": "7a729057e3294249b5b43a454734c15c3c014c891bef19c0b2dc60761814a01c",
  "mappingRowsSha256": "5c4d1e84ce295d1d955e9234102ce2ad8954f05e1771dd0d5c9b6c76028047a0",
  "artifactNodeTypeManifestSha256": "79e2b4a9361e011f3639b3c3a71f0c01644c71a18dc3706518d6c6d8474c9a55",
  "duplicatePointerCount": 0,
  "missingPointerCount": 0,
  "extraPointerCount": 0
}
```

Exact artifact node/type checksum preimage:

```json
{
  "manifestKind": "K334_ARTIFACT_NODE_TYPE_MANIFEST_V1",
  "traversalKind": "K334_DESCRIPTOR_MAPPING_DEPTH_FIRST_UTF16_V1",
  "totalNodes": 1418,
  "objectNodes": 69,
  "arrayNodes": 116,
  "stringNodes": 996,
  "integerNodes": 91,
  "booleanNodes": 101,
  "nullNodes": 45
}
```

Store-entry row ranges:

| Store ordinal | identity | pointer | first row | last row | row count |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | `k334.store.authority_subjects.v1` | `/stores/0` | 956 | 978 | 23 |
| 2 | `k334.store.authority_issuers.v1` | `/stores/1` | 979 | 1001 | 23 |
| 3 | `k334.store.authority_issuer_policies.v1` | `/stores/2` | 1002 | 1024 | 23 |
| 4 | `k334.store.authority_evidence.v1` | `/stores/3` | 1025 | 1047 | 23 |
| 5 | `k334.store.authority_rollback_permissions.v1` | `/stores/4` | 1048 | 1070 | 23 |
| 6 | `k334.store.authority_terminations.v1` | `/stores/5` | 1071 | 1093 | 23 |
| 7 | `k334.store.authority_compatibility_tuples.v1` | `/stores/6` | 1094 | 1116 | 23 |
| 8 | `k334.store.authority_external_mappings.v1` | `/stores/7` | 1117 | 1141 | 25 |
| 9 | `k334.store.authority_fork_observations.v1` | `/stores/8` | 1142 | 1164 | 23 |
| 10 | `k334.store.authority_conflict_observations.v1` | `/stores/9` | 1165 | 1187 | 23 |
| 11 | `k334.store.authority_quarantines.v1` | `/stores/10` | 1188 | 1210 | 23 |
| 12 | `k334.store.authority_migration_sessions.v1` | `/stores/11` | 1211 | 1233 | 23 |
| 13 | `k334.store.authority_migration_classifications.v1` | `/stores/12` | 1234 | 1256 | 23 |
| 14 | `k334.store.authority_migration_checkpoints.v1` | `/stores/13` | 1257 | 1279 | 23 |
| 15 | `k334.store.authority_recovery_markers.v1` | `/stores/14` | 1280 | 1302 | 23 |
| 16 | `k334.store.authority_heads.v1` | `/stores/15` | 1303 | 1326 | 24 |
| 17 | `k334.store.authority_audit_events.v1` | `/stores/16` | 1327 | 1349 | 23 |

Index-entry row ranges:

| Index ordinal | identity | pointer | first row | last row | row count |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | `k334.index.authority_audit_events.by_record.v1` | `/indexes/0` | 169 | 187 | 19 |
| 2 | `k334.index.authority_audit_events.by_source_digest.v1` | `/indexes/1` | 188 | 206 | 19 |
| 3 | `k334.index.authority_audit_events.by_subject.v1` | `/indexes/2` | 207 | 221 | 15 |
| 4 | `k334.index.authority_compatibility_tuples.by_exact_tuple.v1` | `/indexes/3` | 222 | 240 | 19 |
| 5 | `k334.index.authority_compatibility_tuples.by_tuple_status.v1` | `/indexes/4` | 241 | 259 | 19 |
| 6 | `k334.index.authority_conflict_observations.by_observation_digest.v1` | `/indexes/5` | 260 | 278 | 19 |
| 7 | `k334.index.authority_conflict_observations.by_subject_code.v1` | `/indexes/6` | 279 | 299 | 21 |
| 8 | `k334.index.authority_evidence.by_digest.v1` | `/indexes/7` | 300 | 318 | 19 |
| 9 | `k334.index.authority_evidence.by_issuer.v1` | `/indexes/8` | 319 | 337 | 19 |
| 10 | `k334.index.authority_evidence.by_predecessor.v1` | `/indexes/9` | 338 | 356 | 19 |
| 11 | `k334.index.authority_evidence.by_subject_lineage_sequence.v1` | `/indexes/10` | 357 | 379 | 23 |
| 12 | `k334.index.authority_evidence.by_subject_status.v1` | `/indexes/11` | 380 | 400 | 21 |
| 13 | `k334.index.authority_external_mappings.by_external.v1` | `/indexes/12` | 401 | 425 | 25 |
| 14 | `k334.index.authority_external_mappings.by_internal.v1` | `/indexes/13` | 426 | 446 | 21 |
| 15 | `k334.index.authority_external_mappings.by_mapping_digest.v1` | `/indexes/14` | 447 | 465 | 19 |
| 16 | `k334.index.authority_fork_observations.by_observation_digest.v1` | `/indexes/15` | 466 | 484 | 19 |
| 17 | `k334.index.authority_fork_observations.by_subject_predecessor.v1` | `/indexes/16` | 485 | 505 | 21 |
| 18 | `k334.index.authority_heads.by_projection_digest.v1` | `/indexes/17` | 506 | 524 | 19 |
| 19 | `k334.index.authority_heads.by_subject.v1` | `/indexes/18` | 525 | 543 | 19 |
| 20 | `k334.index.authority_issuer_policies.by_issuer_subject_action.v1` | `/indexes/19` | 544 | 566 | 23 |
| 21 | `k334.index.authority_issuer_policies.by_policy_digest.v1` | `/indexes/20` | 567 | 585 | 19 |
| 22 | `k334.index.authority_issuer_policies.by_subject_action_sequence.v1` | `/indexes/21` | 586 | 608 | 23 |
| 23 | `k334.index.authority_issuers.by_issuer_namespace.v1` | `/indexes/22` | 609 | 627 | 19 |
| 24 | `k334.index.authority_migration_checkpoints.by_batch_sequence.v1` | `/indexes/23` | 628 | 648 | 21 |
| 25 | `k334.index.authority_migration_checkpoints.by_batch_status.v1` | `/indexes/24` | 649 | 669 | 21 |
| 26 | `k334.index.authority_migration_classifications.by_batch_class.v1` | `/indexes/25` | 670 | 690 | 21 |
| 27 | `k334.index.authority_migration_classifications.by_source_digest.v1` | `/indexes/26` | 691 | 709 | 19 |
| 28 | `k334.index.authority_migration_sessions.by_lease_epoch.v1` | `/indexes/27` | 710 | 730 | 21 |
| 29 | `k334.index.authority_migration_sessions.by_source_status.v1` | `/indexes/28` | 731 | 751 | 21 |
| 30 | `k334.index.authority_quarantines.by_state.v1` | `/indexes/29` | 752 | 770 | 19 |
| 31 | `k334.index.authority_recovery_markers.by_batch_status.v1` | `/indexes/30` | 771 | 791 | 21 |
| 32 | `k334.index.authority_rollback_permissions.by_issuer_subject.v1` | `/indexes/31` | 792 | 812 | 21 |
| 33 | `k334.index.authority_rollback_permissions.by_permission_digest.v1` | `/indexes/32` | 813 | 831 | 19 |
| 34 | `k334.index.authority_rollback_permissions.by_target.v1` | `/indexes/33` | 832 | 852 | 21 |
| 35 | `k334.index.authority_subjects.by_subject_namespace.v1` | `/indexes/34` | 853 | 871 | 19 |
| 36 | `k334.index.authority_terminations.by_subject_sequence.v1` | `/indexes/35` | 872 | 892 | 21 |
| 37 | `k334.index.authority_terminations.by_target.v1` | `/indexes/36` | 893 | 913 | 21 |
| 38 | `k334.index.authority_terminations.by_termination_digest.v1` | `/indexes/37` | 914 | 932 | 19 |

## 17. Predecessor Mapping Completeness Manifest

```json
{
  "manifestKind": "K334_PREDECESSOR_EVIDENCE_MAPPING_COMPLETENESS_MANIFEST_V1",
  "mappingSchemaKind": "K334_PREDECESSOR_EVIDENCE_MAPPING_ROW_V1",
  "traversalKind": "K334_PREDECESSOR_EVIDENCE_DEPTH_FIRST_V1",
  "mappingRowCount": 252,
  "totalNodeCount": 252,
  "objectNodeCount": 33,
  "arrayNodeCount": 29,
  "stringNodeCount": 113,
  "integerNodeCount": 23,
  "booleanNodeCount": 53,
  "nullNodeCount": 1,
  "storeCount": 9,
  "indexCount": 22,
  "pathSetSha256": "4ac35f84f8853305f61b692d32369687203239fb2c97569df5f0ab22fcbde8d5",
  "mappingRowsSha256": "bfbcf0c879437fe8e0489901f86ff08724382a4486723db993bb425e8a1728df",
  "predecessorNodeTypeManifestSha256": "7fc8584ffcf88e8189fb4325ff67f90a0ca4f942c51565aa5d68b7604a98a758",
  "duplicatePathCount": 0,
  "missingPathCount": 0,
  "extraPathCount": 0
}
```

Exact predecessor node/type checksum preimage:

```json
{
  "manifestKind": "K334_PREDECESSOR_NODE_TYPE_MANIFEST_V1",
  "traversalKind": "K334_PREDECESSOR_EVIDENCE_DEPTH_FIRST_V1",
  "totalNodes": 252,
  "objectNodes": 33,
  "arrayNodes": 29,
  "stringNodes": 113,
  "integerNodes": 23,
  "booleanNodes": 53,
  "nullNodes": 1
}
```

## 18. Artifact Checksum Record

| Checksum | Exact lowercase hex64 value |
| --- | --- |
| `MAPPING_POINTER_SET_SHA256` | `7a729057e3294249b5b43a454734c15c3c014c891bef19c0b2dc60761814a01c` |
| `MAPPING_ROWS_SHA256` | `5c4d1e84ce295d1d955e9234102ce2ad8954f05e1771dd0d5c9b6c76028047a0` |
| `ARTIFACT_NODE_TYPE_MANIFEST_SHA256` | `79e2b4a9361e011f3639b3c3a71f0c01644c71a18dc3706518d6c6d8474c9a55` |

## 19. Predecessor Checksum Record

| Checksum | Exact lowercase hex64 value |
| --- | --- |
| `PREDECESSOR_PATH_SET_SHA256` | `4ac35f84f8853305f61b692d32369687203239fb2c97569df5f0ab22fcbde8d5` |
| `PREDECESSOR_MAPPING_ROWS_SHA256` | `bfbcf0c879437fe8e0489901f86ff08724382a4486723db993bb425e8a1728df` |
| `PREDECESSOR_NODE_TYPE_MANIFEST_SHA256` | `7fc8584ffcf88e8189fb4325ff67f90a0ca4f942c51565aa5d68b7604a98a758` |

All six checksums use RFC 8785 canonical JSON UTF-8 preimages, not rendered Markdown.

## 20. Exactness Validation

```json
{
  "artifact": {
    "EXACT": 1418,
    "BLOCKED": 0,
    "NOT_APPLICABLE": 0,
    "UNREVIEWED": 1418,
    "missing": 0
  },
  "predecessor": {
    "EXACT": 252,
    "BLOCKED": 0,
    "NOT_APPLICABLE": 0,
    "UNREVIEWED": 252,
    "missing": 0
  }
}
```

Combined exact rows: 1670. Combined blocked rows: 0. Combined not-applicable rows: 0. Combined missing rows: 0. Every M2 row remains `UNREVIEWED`; M2 does not claim independent acceptance.

Artifact pointer/valueKind/ordinal and predecessor path/valueKind/ordinal comparisons are exact; duplicate, missing, and extra counts are all 0.

## 21. Dormancy Evidence

The following repository searches were scoped to production/runtime and package/config surfaces, not documentation:

| Search | Result |
| --- | ---: |
| `rg -n --fixed-strings "k334-canonical-physical-schema-descriptor-v1.json" frontend/src backend components hooks lib protocol public` | 0 references |
| `rg -n --fixed-strings "K-334-CANONICAL-PHYSICAL-SCHEMA-001" frontend/src backend components hooks lib protocol public` | 0 references |
| `rg -n --fixed-strings "k334-canonical-physical-schema-descriptor-v1.json" frontend/package.json frontend/vite.config.ts` | 0 references |
| Startup import/invocation | 0 |
| Runtime database open | 0 |
| Service worker/background path | 0 |
| Package/build hook | 0 |

The artifact is dormant documentation input. No runtime or proof harness consumes it.

## 22. Historical Evidence Classification

| Historical item | Classification | Treatment |
| --- | --- | --- |
| 8192-byte design limit | `PROPOSED_DESIGN_LIMIT_NOT_IMPLEMENTATION_AUTHORITY` | Preserved as design history only; not promoted into a runtime limit or proof result. |
| 2580-byte provisional measurement | `PROVISIONAL_MEASUREMENT_REQUIRES_REDERIVATION` | Not reused as final evidence. |
| 5612-byte provisional measurement | `PROVISIONAL_MEASUREMENT_REQUIRES_REDERIVATION` | Not reused as final evidence. |
| Historical topology SHA values | `PROVISIONAL_MEASUREMENT_REQUIRES_REDERIVATION` | Not reused as final evidence. |
| Historical temporary scripts/provenance | `PROVISIONAL_MEASUREMENT_REQUIRES_REDERIVATION` | Not reused as final evidence. |

This M2 artifact records its actual raw/canonical byte evidence above and makes no claim that historical provisional measurements bind these bytes.

## 23. Authorization State

### Unknown, duplicate, and drift handling

- Unknown root, store, index, policy, dependency, transaction, proof, or exclusion fields fail closed.
- Duplicate JSON member names fail before canonicalization.
- Any mapping pointer/path omission, duplication, reordered row, changed source location, or changed display value invalidates the corresponding manifest checksum.
- Any artifact/predecessor node-count mismatch is `CORRUPT_OR_DRIFTED_EVIDENCE`.
- Any I01/I02/I03 disagreement is `CANONICALIZATION_DERIVATION_MISMATCH`.
- No automatic repair, default insertion, semantic inference, or authority promotion is allowed.

### M4 acceptance boundary

Only a separately authorized M4 acceptance record may make the reviewed artifact an accepted descriptor input. M4 must bind I01, I02, I03, I04, M3's exact final M2-byte hash I05, the accepted mapping and predecessor manifests, and the exact semantic identity. M4 must not convert descriptor acceptance into schema-change, proof-execution, runtime, eligibility, or production authority.

### M4A archive-binding boundary

M4A remains absent and is not created or authorized by M2. After final M4 bytes are frozen, the separately bounded M4A archive-binding record must bind I06, the exact M4 identity, final byte length, and M3 PASS as the non-self-referential archival closure. It adds no semantic, implementation, schema, runtime, D0-P09, eligibility, or production authority.

### D0 proof boundary

| Gate | State |
| --- | --- |
| D0-P09 authorization | 0/0 |
| D0-P09 execution | 0/0 |
| D0-P09 satisfaction | 0/0 |
| D0-P10 execution | 0/0 |
| D0-P10 satisfaction | 0/0 |

The artifact is input evidence only. Its existence and hashes do not execute or satisfy a proof gate.

### Runtime and database boundary

This task creates no source, test, fixture, schema, migration, IndexedDB, package, build, runtime, recovery, service-worker, or database change. It performs no database open and no production read or write.

### Exact authority counts

| State | Count |
| --- | ---: |
| Machine-readable descriptor input proposed | 1 |
| Machine-readable descriptor input accepted | 0 |
| M3 independent review PASS | 0 |
| M4A archive binding | 0 |
| Descriptor implementation authorization proposed/accepted | 0/0 |
| Descriptor implementation | 0 |
| Schema mutation authorization | 0 |
| D0-P09 authority/execution/satisfaction | 0/0/0 |
| D0-P10 execution/satisfaction | 0/0 |
| K-334E/F authorization | 0/0 |
| Runtime authorization | 0 |
| Production eligibility | 0 |

### Files and temporary-artifact policy

The only durable files created by M2 are:

- `frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json`
- `frontend/docs/K-334P09M2-machine-readable-descriptor-transcription-proposal.md`

The two canonicalization scripts and the construction helper were temporary, documentation-only tools and are not durable repository outputs. They must be deleted before M2 handoff.

### Review stop conditions

Stop and reject if the artifact identity, governing SHA, exact inventories, C03 disposition, predecessor baseline, mapping completeness, canonicalization results, dormancy, or authority boundary differs. Stop if any future lifecycle record exists prematurely, any production reference appears, or any source/package/schema/runtime file changes.

## 24. M3 Review Requirement

M3 must independently validate exact artifact bytes, strict duplicate rejection, root/store/index field inventories, every mapping row, both completeness manifests, every source location, I01/I02/I03/I04, Option A provenance, dormancy evidence, historical evidence classification, and the absence of M2 self-hashing. M3 may accept or reject; it may not edit the artifact or silently substitute mappings.

## 25. Production Boundary

M2 creates no runtime or production authority, no eligible source, no database effect, and no proof satisfaction.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
