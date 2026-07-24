# K-334P09P — Canonical Descriptor-Authority Prerequisite Proposal

## 1. Proposal Identity and K-334P09P2 Disposition

| Field | Value |
| --- | --- |
| Type | `K334CanonicalDescriptorAuthorityPrerequisiteProposal` |
| Proposal ID | `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001` |
| Status | `DESCRIPTOR_AUTHORITY_PREREQUISITE_PROPOSED` |
| Effective authority | `PROPOSAL_ONLY_NO_IMPLEMENTATION_AUTHORITY` |
| Reconsideration | `K-334P09P2` |
| Disposition | `K334P09P_AMENDED_IN_PLACE` |
| Previous proposal SHA-256 | `9DC01A05765CFCD9B0CF1F17B98977AE6654ADB82DE734BA46A43B2F7D325276` |
| Current revised SHA-256 binding | `EXTERNAL_POST_EDIT_ARTIFACT_BINDING_REQUIRED` |

The proposal identity and purpose remain valid. The former unresolved
ROW/MAP/index placeholders are replaced by the exact accepted K-334P09T/X and
B01–B08 values. No successor identity is needed.

The current file cannot contain its own final SHA-256: changing a literal
inside the file changes the hashed bytes. K-334P09P2 therefore binds the
current revised SHA externally in its post-edit validation report, after the
final byte is written. This field is an explicit non-self-referential binding
rule, not an unresolved descriptor fact.

This remains a proposal. It neither accepts the prerequisite nor grants
implementation, installation, proof-execution, runtime, or production
authority.

`DESCRIPTOR_AUTHORITY_IS_NOT_DESCRIPTOR_IMPLEMENTATION_AUTHORITY`

## 2. Accepted Authority Inputs

Every accepted value is incorporated from the exact record and bound package;
summaries here cannot extend or weaken them.

| Blocker | Accepted record and status | Exact accepted scope |
| --- | --- | --- |
| B01 | `K-334P09B01L-SUCCESSOR-B01-ACCEPTANCE-001`; `B01_MINIMAL_V1_AUTHORITY_ACCEPTED`; SHA-256 `CEFC79C5CEBE481804D3B6EEA8743AC95F7671D11A3C0FBFFA332589307EC8FE` | `authority_subject_registration_v1`; ROW-01/MAP-01; subject store/key; C35; B01 portions of SC-06/SC-08 |
| B02 | `K-334P09B02C-MINIMAL-V1-ISSUER-ACCEPTANCE-001`; `B02_MINIMAL_V1_AUTHORITY_ACCEPTED`; SHA-256 `80A842BBDF279F0939E651FF3732FF5D00E52979C32D78E86BDE04947C4B63A3` | `authority_issuer_registration_v1`; ROW-02/MAP-02; issuer store/key; C23; B02 shared-constraint portions |
| B03 | `K-334P09B03E-MINIMAL-V1-COMPATIBILITY-ACCEPTANCE-001`; `B03_MINIMAL_V1_AUTHORITY_ACCEPTED`; SHA-256 `2457E8ADD78F56C5498EEEAFD860876658E9CCF32FFA6618345EEC29E2EEF3F7` | `compatibility_tuple`; ROW-07/MAP-07; C04/C05; `IMMUTABLE_DIRECT_COMPATIBILITY_V1`; exact retry; B03 portions of SC-01/03/05/06/08/11 |
| B04 | `K-334P09B04B06E-MINIMAL-V1-MIGRATION-RECOVERY-ACCEPTANCE-001`; `B04_B05_B06_MINIMAL_V1_AUTHORITY_ACCEPTED`; SHA-256 `CA42ECAFBB3F98B842EEC6016C6444C427D95DC715DB3E4C6172AC70799F221A` | ROW-12/MAP-12; operation-key rediscovery; status/lease/CAS model; C28/C29 |
| B05 | same B04–B06 record and SHA | ROW-14/MAP-14; `IMMUTABLE_RETAINED_SOURCE_SET_V1`; exhaustive phase matrix; C24/C25 |
| B06 | same B04–B06 record and SHA | ROW-15/MAP-15; append-only open/resolved marker model; C31 |
| B07 | `K-334P09B07B08G-FINAL-MINIMAL-V1-AUTHORITY-ACCEPTANCE-001`; `B07_B08_MINIMAL_V1_AUTHORITY_ACCEPTED`; SHA-256 `9CE0F9A033A8E7D72CD2AD8115D064D3225AA20F9CAFCBD4937F27F89584EAB6` | ROW-17/MAP-17; C01/C02; C03 removal; required-pair participation |
| B08 | same B07/B08 record and SHA | ROW-04/MAP-04; C08–C12; lifecycle/predecessor matrix; logical position and competitors; required-pair participation |

The remaining ROW, MAP, index, and shared-constraint values are the 35 accepted
records in `K-334P09X-AUTHORITY-INPUT-ACCEPTANCE-001`, SHA-256
`98781F8AD3E9299CDCCD3C91ACBD60A47DAEE6E1C922CE1146E989C6CF18D465`,
which incorporates the exact K-334P09T records. B01–B08 subsequently resolve
all 22 records that K-334P09X intentionally left deferred. Anonymous blockers
are zero.

## 3. Existing Proposal Audit

| Material section | Classification | Reconsidered result |
| --- | --- | --- |
| Proposal identity, purpose, proposal-only status | `STILL_EXACT` | Retained |
| One canonical descriptor, exact-only compatibility, ownership | `STILL_EXACT` | Retained |
| RFC 8785 canonicalization, unsigned UTF-8 ordering, checksum domain/framing | `STILL_EXACT` | Retained |
| Former candidate-family scope | `REQUIRES_ACCEPTED_INPUT_SUBSTITUTION` | Replaced by the exact 17-store accepted scope |
| Former 17 unresolved rows and mappings | `REQUIRES_ACCEPTED_INPUT_SUBSTITUTION` | Replaced by accepted ROW-01–ROW-17 and MAP-01–MAP-17 |
| Former 38-index inventory with 16 unresolved entries | `REQUIRES_CORRECTION` | Replaced by 37 installable indexes plus excluded C03 |
| Former B01–B08 placeholders and blockers | `REQUIRES_REMOVAL` | Removed; all eight are accepted |
| Database/source/target/install boundary | `MISSING_REQUIRED_SECTION` | Added from accepted K-334C3 and B04–B06 authority |
| Cross-descriptor dependencies and transaction groups | `MISSING_REQUIRED_SECTION` | Added without converting semantic references into install dependencies |
| Migration/recovery and B07/B08 installation boundaries | `MISSING_REQUIRED_SECTION` | Added by exact accepted-contract binding |
| Conflict, retry, and post-install verification | `MISSING_REQUIRED_SECTION` | Added as prerequisite only |
| Former “not acceptance-ready” conclusion | `REQUIRES_CORRECTION` | Replaced by ready-for-review, not accepted |

No accepted authority fact remains missing. No descriptor value is left for an
implementer to choose.

## 4. Canonical Descriptor Set

| Field | Exact proposed value |
| --- | --- |
| Descriptor-set kind | `K334CanonicalPhysicalSchemaDescriptor` |
| Descriptor-set ID | `K-334-CANONICAL-PHYSICAL-SCHEMA-001` |
| Descriptor-set version | `1` |
| Physical schema revision | `K334_PHYSICAL_SCHEMA_REVISION_1` |
| Database identity | `absinthe-local-v2` |
| Source schema version | `4` |
| Target schema version | `5` |
| Installation namespace | Existing exact validated `repositoryNamespace` and `namespaceKey` context; no user/device/session value is embedded in the global descriptor |
| Store inventory | 17 accepted stores |
| Installable index inventory | 37 accepted indexes |
| Excluded index inventory | C03 only |
| Compatibility | `EXACT_ONLY`; `K334_DESCRIPTOR_COMPATIBILITY_EXACT_ONLY_V1` |
| Canonicalization | `K334_DESCRIPTOR_CANONICALIZATION_V1`; RFC 8785; UTF-8; no BOM/newline; input strings must already be NFC |
| Digest domain | `absinthe:k334:canonical-physical-schema-descriptor:v1` |
| Digest algorithm | SHA-256, 64 lowercase hexadecimal characters |
| Database-version authority | `NOT_OWNED_BY_THIS_DESCRIPTOR` |
| Canonical future module | `frontend/src/lib/localDatabase/protocol/k334CanonicalPhysicalSchemaDescriptor.ts` |
| Canonical future export | `K334_CANONICAL_PHYSICAL_SCHEMA_DESCRIPTOR` |
| Descriptor owner | `ABSINTHE_PROTOCOL_OWNER` |
| Change authority | `ABSINTHE_PROTOCOL_OWNER_VIA_SEPARATE_PUBLISHED_DISPOSITION_AND_INDEPENDENT_REVIEW` |

### 4.1 Exact root object

`K334_CANONICAL_PHYSICAL_SCHEMA_DESCRIPTOR_V1` is one exact JSON object with
these 23 required enumerable own data properties and no others:

| Root key | Exact JSON type and value rule |
| --- | --- |
| `descriptorKind` | string literal `K334CanonicalPhysicalSchemaDescriptor` |
| `descriptorId` | string literal `K-334-CANONICAL-PHYSICAL-SCHEMA-001` |
| `descriptorVersion` | safe integer `1` |
| `physicalSchemaRevision` | string literal `K334_PHYSICAL_SCHEMA_REVISION_1` |
| `databaseName` | string literal `absinthe-local-v2` |
| `sourceDatabaseVersion` | safe integer `4` |
| `targetDatabaseVersion` | safe integer `5` |
| `installationNamespaceContract` | exact object from Section 4.2 |
| `databaseVersionAuthority` | string literal `NOT_OWNED_BY_THIS_DESCRIPTOR` |
| `descriptorVersionOwner` | string literal `ABSINTHE_PROTOCOL_OWNER` |
| `changeAuthorityOwner` | string literal `ABSINTHE_PROTOCOL_OWNER_VIA_SEPARATE_PUBLISHED_DISPOSITION_AND_INDEPENDENT_REVIEW` |
| `compatibilityMode` | string literal `EXACT_ONLY` |
| `compatibilityStatementId` | string literal `K334_DESCRIPTOR_COMPATIBILITY_EXACT_ONLY_V1` |
| `canonicalization` | exact object from Section 4.3 |
| `stores` | exact 17-element array from Sections 4.4 and 5, ordinal 1 through 17 |
| `indexes` | exact 38-element array from Sections 4.5 and 6, C01 through C38 |
| `dependencies` | exact ordered array from Section 4.6 |
| `transactionGroups` | one-element array containing Section 4.7's exact object |
| `conflictPolicy` | exact object from Section 4.8 |
| `retryPolicy` | exact object from Section 4.8 |
| `postInstallVerification` | exact object from Section 4.8 |
| `proofLayers` | exact three-element string array from Section 12 |
| `authorityExclusions` | exact ordered array from Section 4.8 |

Every key is required. Null is prohibited except in the exact store/index
fields where Sections 4.4 and 4.5 require it. Unknown keys, aliases, alternate
spellings, inherited properties, accessors, symbols, sparse arrays,
`undefined`, non-finite numbers, negative zero, and non-safe integers are
invalid.

RFC 8785 determines object-key serialization order. Array order is normative
as specified below and is never locale-sorted or inferred from construction
order.

### 4.2 Exact installation namespace contract

`installationNamespaceContract` is exactly:

```json
{
  "crossNamespaceInstallation": false,
  "kind": "repository_namespace_and_namespace_key_context_v1",
  "namespaceKeySource": "validated_operation_context",
  "repositoryNamespaceSource": "validated_operation_context"
}
```

It defines a row-validation and operation-context contract, not one concrete
user namespace. Actual `repositoryNamespace`, `namespaceKey`, user, project,
device, session, or account values do not appear in the global descriptor.
Every future row operation must supply exact validated context values; any
cross-context or cross-namespace mismatch fails closed. No alternate object,
source literal, normalization, or inferred namespace is valid.

### 4.3 Exact canonicalization object and digest

`canonicalization` is exactly:

```json
{
  "canonicalizationId": "K334_DESCRIPTOR_CANONICALIZATION_V1",
  "compoundKeyPathOrder": "PRESERVE_DECLARED_ORDER",
  "digestAlgorithm": "SHA-256",
  "digestDomain": "absinthe:k334:canonical-physical-schema-descriptor:v1",
  "digestTextEncoding": "LOWERCASE_HEX_64",
  "jsonCanonicalization": "RFC_8785",
  "setOrder": "UNSIGNED_UTF8_CANONICAL_ID_ASCENDING",
  "stringNormalization": "REJECT_NON_NFC",
  "textEncoding": "UTF-8_NO_BOM_NO_TRAILING_NEWLINE"
}
```

Every root and nested canonical field in Sections 4.1–4.8 and the exact value
tables in Sections 5–6 participates. The canonical descriptor bytes are the
RFC 8785 UTF-8 encoding of the one root object. The digest preimage is exactly:

1. UTF-8 bytes of
   `absinthe:k334:canonical-physical-schema-descriptor:v1`;
2. one byte `0x00`; and
3. the canonical descriptor bytes.

SHA-256 over that preimage produces exactly 64 lowercase hexadecimal
characters. There is no alternate base64, uppercase, delimited, or
platform-specific encoding.

The descriptor digest is an output of
`RECONSTRUCT_ACCEPTED_DESCRIPTOR_V1`, held in accepted configuration/review
authority for the classification attempt. It is excluded from the root object
and its own preimage and is never presumed to be stored in IndexedDB.
`generatedAt`, `recordedAt`, comments, headings, prose, citations,
module/export paths, commits, execution IDs, proof results, and temporary
database names are excluded. The proposal-document SHA-256 is an artifact hash,
not the descriptor-set digest; Markdown bytes are not canonical descriptor
bytes. Same descriptor ID with different canonical bytes or digest is an exact
conflict.

### 4.4 Exact store-descriptor object schema

Every `stores` entry has exactly these 20 required keys:

| Key | Exact representation |
| --- | --- |
| `ordinal` | safe integer 1 through 17 |
| `owner` | exact string in Section 5.1 |
| `semanticFamily` | exact string in Section 5.1 |
| `storeIdentity` | exact canonical store ID in Section 5 |
| `storeName` | exact physical name in Section 5 |
| `rowId` | string `ROW-01` through `ROW-17` matching ordinal |
| `mapId` | string `MAP-01` through `MAP-17` matching ordinal |
| `keyPath` | non-empty ordered JSON array of strings from Section 5 |
| `autoIncrement` | boolean `false` |
| `discriminatorMode` | exact enum in Section 5.1 |
| `rowType` | exact string or explicit JSON null from Section 5.1 |
| `rowVersion` | safe integer `1` or explicit JSON null from Section 5.1 |
| `recordType` | exact string or explicit JSON null from Section 5.1 |
| `recordSchemaVersion` | safe integer `1` or explicit JSON null from Section 5.1 |
| `canonicalBindingMode` | exact enum in Section 5.1 |
| `canonicalKind` | exact string, exact ordered non-empty string array, or explicit JSON null from Section 5.1 |
| `canonicalVersion` | safe integer `1` or explicit JSON null from Section 5.1 |
| `lifecycleModel` | exact enum in Section 5.1 |
| `authorityClassification` | exact enum in Section 5.1 |
| `installationDisposition` | string literal `ACCEPTED_ADDITIVE_STORE` |

Null means only “inapplicable under the selected accepted binding mode.” It
never means unknown. Omission, `"none"`, empty string, or an alternate
sentinel is invalid. Entries are ordered by `ordinal`; changing array order is
a descriptor-byte change.

### 4.5 Exact index-descriptor object schema

Every `indexes` entry has exactly these 14 required keys:

| Key | Exact representation |
| --- | --- |
| `ordinal` | safe integer 1 through 38 |
| `indexId` | exact string `C01` through `C38` matching ordinal |
| `indexIdentity` | exact canonical index ID in Section 6 |
| `ownerStoreIdentity` | exact owner canonical store ID |
| `ownerStoreName` | exact physical owner name |
| `indexName` | exact index name |
| `keyPath` | installable: ordered non-empty string array; C03: JSON null |
| `unique` | installable: exact boolean; C03: JSON null |
| `multiEntry` | installable: boolean `false`; C03: JSON null |
| `disposition` | `ACCEPTED_INSTALLABLE_INDEX` or, only for C03, `ACCEPTED_EXCLUDED_INDEX` |
| `directSourceFields` | installable: exact copy of `keyPath`; C03: `[]` |
| `nullOrMissingBehavior` | exact enum from Section 6.1 |
| `lookupPurpose` | exact enum from Section 6.1 |
| `authorityEffect` | string literal `NON_AUTHORITATIVE_LOOKUP_ONLY` |

For every installable index, `exclusionReason` is not a field. C03 uses this
complete exact object representation for the otherwise structural fields:

```json
{
  "authorityEffect": "NON_AUTHORITATIVE_LOOKUP_ONLY",
  "directSourceFields": [],
  "disposition": "ACCEPTED_EXCLUDED_INDEX",
  "indexId": "C03",
  "indexIdentity": "k334.index.authority_audit_events.by_subject.v1",
  "indexName": "by_subject",
  "keyPath": null,
  "lookupPurpose": "EXCLUDED_NO_SUBJECT_SOURCE",
  "multiEntry": null,
  "nullOrMissingBehavior": "NOT_APPLICABLE_EXCLUDED_INDEX",
  "ordinal": 3,
  "ownerStoreIdentity": "k334.store.authority_audit_events.v1",
  "ownerStoreName": "authority_audit_events",
  "unique": null
}
```

The Markdown words “none” and “n/a” in the human inventory are explanatory
only and never enter canonical bytes. All indexes not represented by one of
the 38 objects are prohibited by `conflictPolicy`.

### 4.6 Exact dependency objects

Every dependency has exactly `dependencyId`, `dependencyKind`, `sources`,
`targets`, `required`, and `authorityEffect`. The root `dependencies` value is
exactly the following array; object-key order shown is non-semantic under RFC
8785, but object fields, array membership, and displayed array order are
normative:

```json
[
  {
    "authorityEffect": "PHYSICAL_CREATION_ORDER_ONLY_NO_SEMANTIC_AUTHORITY",
    "dependencyId": "DEP-01",
    "dependencyKind": "STORE_BEFORE_INDEX",
    "required": true,
    "sources": [
      "k334.store.authority_subjects.v1",
      "k334.store.authority_issuers.v1",
      "k334.store.authority_issuer_policies.v1",
      "k334.store.authority_evidence.v1",
      "k334.store.authority_rollback_permissions.v1",
      "k334.store.authority_terminations.v1",
      "k334.store.authority_compatibility_tuples.v1",
      "k334.store.authority_external_mappings.v1",
      "k334.store.authority_fork_observations.v1",
      "k334.store.authority_conflict_observations.v1",
      "k334.store.authority_quarantines.v1",
      "k334.store.authority_migration_sessions.v1",
      "k334.store.authority_migration_classifications.v1",
      "k334.store.authority_migration_checkpoints.v1",
      "k334.store.authority_recovery_markers.v1",
      "k334.store.authority_heads.v1",
      "k334.store.authority_audit_events.v1"
    ],
    "targets": [
      "C01","C02","C04","C05","C06","C07","C08","C09","C10","C11",
      "C12","C13","C14","C15","C16","C17","C18","C19","C20","C21",
      "C22","C23","C24","C25","C26","C27","C28","C29","C30","C31",
      "C32","C33","C34","C35","C36","C37","C38"
    ]
  },
  {
    "authorityEffect": "PHYSICAL_ATOMICITY_ONLY_NO_EXECUTION_AUTHORITY",
    "dependencyId": "DEP-02",
    "dependencyKind": "SAME_VERSIONCHANGE_TRANSACTION_PARTICIPATION",
    "required": true,
    "sources": ["absinthe-local-v2@4"],
    "targets": ["TG-K334-V4-V5-ADDITIVE-001"]
  },
  {
    "authorityEffect": "FUTURE_AVAILABILITY_ONLY_NO_RUNTIME_AUTHORITY",
    "dependencyId": "DEP-03",
    "dependencyKind": "FUTURE_RUNTIME_TRANSACTION_PARTICIPATION",
    "required": true,
    "sources": [
      "k334.store.authority_migration_sessions.v1",
      "k334.store.authority_migration_checkpoints.v1",
      "k334.store.authority_recovery_markers.v1"
    ],
    "targets": ["B04_B05_B06_ACCEPTED_TARGET_AND_CONTROL_STORE_SET"]
  },
  {
    "authorityEffect": "FUTURE_ATOMIC_PAIR_AVAILABILITY_ONLY",
    "dependencyId": "DEP-04",
    "dependencyKind": "FUTURE_RUNTIME_TRANSACTION_PARTICIPATION",
    "required": true,
    "sources": [
      "k334.store.authority_evidence.v1",
      "k334.store.authority_audit_events.v1"
    ],
    "targets": ["T01","T35"]
  },
  {
    "authorityEffect": "RESTART_LOOKUP_ONLY_NO_SEMANTIC_AUTHORITY",
    "dependencyId": "DEP-05",
    "dependencyKind": "INDEX_LOOKUP_REQUIRED_BY_ACCEPTED_PROTOCOL",
    "required": true,
    "sources": [
      "k334.store.authority_evidence.v1",
      "k334.index.authority_audit_events.by_record.v1"
    ],
    "targets": ["EVIDENCE_AUDIT_ATOMIC_PAIR_V1"]
  },
  {
    "authorityEffect": "COMPETITOR_LOOKUP_ONLY_NO_WINNER_AUTHORITY",
    "dependencyId": "DEP-06",
    "dependencyKind": "INDEX_LOOKUP_REQUIRED_BY_ACCEPTED_PROTOCOL",
    "required": true,
    "sources": [
      "k334.store.authority_evidence.v1",
      "k334.index.authority_evidence.by_subject_lineage_sequence.v1"
    ],
    "targets": ["B08_LOGICAL_POSITION_V1"]
  },
  {
    "authorityEffect": "NO_SCHEMA_ORDERING_AND_NO_AUTHORITY_EFFECT",
    "dependencyId": "DEP-07",
    "dependencyKind": "SEMANTIC_REFERENCE_NOT_SCHEMA_ORDERING",
    "required": false,
    "sources": [
      "k334.store.authority_subjects.v1",
      "k334.store.authority_issuers.v1",
      "k334.store.authority_issuer_policies.v1",
      "k334.store.authority_evidence.v1",
      "k334.store.authority_compatibility_tuples.v1"
    ],
    "targets": ["K334_SEMANTIC_REFERENCE_VALIDATION"]
  }
]
```

Dependencies are ordered by `dependencyId`. Their `sources` and `targets`
arrays preserve the exact display order above and are not re-sorted. For
DEP-01, each index descriptor's owner supplies the exact owner-before-own-index
pairing; the array does not require every unrelated store before every index.
DEP-03 through DEP-07 describe future physical availability only and grant no
transaction, lookup, semantic, or runtime execution.

### 4.7 Exact transaction-group object

`transactionGroups` contains exactly one object with these eleven keys and
values:

| Key | Exact value |
| --- | --- |
| `transactionGroupId` | `TG-K334-V4-V5-ADDITIVE-001` |
| `databaseName` | `absinthe-local-v2` |
| `sourceVersion` | `4` |
| `targetVersion` | `5` |
| `transactionKind` | `NATIVE_INDEXEDDB_VERSIONCHANGE` |
| `memberStoreIdentities` | the 17 canonical store IDs in Section 5 ordinal order |
| `memberIndexIds` | `["C01","C02","C04","C05","C06","C07","C08","C09","C10","C11","C12","C13","C14","C15","C16","C17","C18","C19","C20","C21","C22","C23","C24","C25","C26","C27","C28","C29","C30","C31","C32","C33","C34","C35","C36","C37","C38"]` |
| `excludedIndexIds` | `["C03"]` |
| `atomicity` | `COMMIT_ALL_OR_ABORT_ALL` |
| `predecessorDataPolicy` | `PRESERVE_EXISTING_V4_STORES_INDEXES_AND_RECORDS_BYTE_UNCHANGED` |
| `failureEffect` | `ABORT_NO_PARTIAL_SCHEMA_MUTATION` |

The member-store array is, exactly:

```json
[
  "k334.store.authority_subjects.v1",
  "k334.store.authority_issuers.v1",
  "k334.store.authority_issuer_policies.v1",
  "k334.store.authority_evidence.v1",
  "k334.store.authority_rollback_permissions.v1",
  "k334.store.authority_terminations.v1",
  "k334.store.authority_compatibility_tuples.v1",
  "k334.store.authority_external_mappings.v1",
  "k334.store.authority_fork_observations.v1",
  "k334.store.authority_conflict_observations.v1",
  "k334.store.authority_quarantines.v1",
  "k334.store.authority_migration_sessions.v1",
  "k334.store.authority_migration_classifications.v1",
  "k334.store.authority_migration_checkpoints.v1",
  "k334.store.authority_recovery_markers.v1",
  "k334.store.authority_heads.v1",
  "k334.store.authority_audit_events.v1"
]
```

### 4.8 Exact policy, proof, and exclusion objects

`conflictPolicy` has exactly these keys:

```json
{
  "boundedDiagnostics": true,
  "conflictEffect": "FAIL_CLOSED_NO_MUTATION",
  "partialInstallationPolicy": "PARTIAL_INSTALLATION_ALWAYS_CONFLICTS_V1",
  "policyId": "K334_DESCRIPTOR_CONFLICT_POLICY_V1",
  "prohibitedIndexPolicy": "ALL_UNLISTED_INDEXES_PROHIBITED",
  "repairAuthority": "NOT_GRANTED",
  "stateMachineId": "K334_DESCRIPTOR_INSTALLATION_STATE_V1"
}
```

`retryPolicy` has exactly:

```json
{
  "blindRerun": false,
  "exactV4Effect": "REPORT_INSTALLATION_NOT_COMMITTED_NO_RETRY_AUTHORITY",
  "exactV5Effect": "NO_OP_NO_MUTATION",
  "partialOrConflictEffect": "FAIL_CLOSED_NO_MUTATION",
  "policyId": "K334_DESCRIPTOR_RETRY_POLICY_V1",
  "sameIdDifferentBytes": "CONFLICT"
}
```

`postInstallVerification` has exactly:

```json
{
  "comparisonPolicyId": "K334_IDB_METADATA_EXACT_COMPARISON_V1",
  "policyId": "POST_INSTALL_PHYSICAL_METADATA_VERIFICATION_V1",
  "result": "PHYSICAL_SCHEMA_INSTALLED_EXACTLY_AS_DECLARED_V1"
}
```

`authorityExclusions` is exactly this ordered array:

```json
[
  "DESCRIPTOR_PREREQUISITE_ACCEPTANCE",
  "DESCRIPTOR_IMPLEMENTATION_AUTHORIZATION",
  "DESCRIPTOR_IMPLEMENTATION",
  "SCHEMA_MUTATION",
  "D0_P09_REBOUND",
  "D0_P09_EXECUTION",
  "D0_P09_SATISFACTION",
  "D0_P10_EXECUTION",
  "K334E_AUTHORIZATION",
  "K334F_AUTHORIZATION",
  "RUNTIME_AUTHORIZATION",
  "PRODUCTION_ELIGIBILITY"
]
```

The order above is normative, not re-sorted. Explanatory prose and citations
are outside canonical bytes.

### 4.9 Mechanically checkable construction

The complete canonical object is constructed without prose choices:

1. use the exact 23-key root schema and scalar literals in Section 4.1;
2. use the exact namespace and canonicalization objects in Sections 4.2–4.3;
3. construct each store object from the Section 5 identity row plus the
   same-ordinal Section 5.1 binding row under Section 4.4's exact key set;
4. construct each index object from the Section 6 identity row plus the
   same-C-ID Section 6.1 behavior row under Section 4.5's exact key set;
5. use the dependency, transaction, policy, proof-layer, and exclusion values
   from Sections 4.6–4.8 and 12; and
6. reject a missing, extra, reordered, unknown, or differently represented
   value before RFC 8785 encoding.

The B01 no-discriminator entry, B08 canonical-wrapper entry, B04 process entry,
C01 installable entry, C03 excluded entry, dependencies, transaction group,
and authority exclusions are therefore all represented by the complete
machine-oriented tables. No shortened JSON example is the descriptor.

Exact retry of the same future descriptor is a no-op only after full identity,
bytes, digest, store, index, exclusion, dependency, transaction, policy, proof,
and authority-exclusion equality. Any difference is an exact conflict.

### 4.10 Accepted configuration, reconstruction, and physical binding

`ACCEPTED_DESCRIPTOR_CONFIGURATION_INPUT_V1` is the sole authoritative input
for document conformance, installation planning, post-install verification,
reopen classification, and retry verification. It is the immutable tuple of:

1. the exact `K334_CANONICAL_PHYSICAL_SCHEMA_DESCRIPTOR_V1` root object
   constructed by Section 4.9; and
2. the exact v4 predecessor observable-metadata baseline in the table below.

Its representation has exactly these four required own data fields and no
others: `configurationKind` (string literal
`ACCEPTED_DESCRIPTOR_CONFIGURATION_INPUT_V1`), `configurationVersion` (safe
integer `1`), `canonicalDescriptor` (the exact root object), and
`predecessorObservableMetadataBaseline` (the exact baseline below). Unknown,
optional, inherited, accessor, symbol, or alternate fields are invalid. This
configuration envelope is reviewed input only; it is not a new descriptor,
does not alter the root's 23-key schema, and is not serialized into the root
descriptor digest.

The first member includes every root field, all 17 store objects, all 38 index
disposition objects, the seven dependencies, one transaction group, policies,
proof layers, and authority exclusions. The second member is configuration
authority for validating the declared v4 predecessor only; it is not a root
descriptor field and does not enter the canonical descriptor digest. Neither
member is derived from the observed database, runtime guesses, or user-specific
namespace values. The tuple is immutable for descriptor ID/version/revision.
The same descriptor ID with different configuration bytes is `CONFLICT`.

`V4_PREDECESSOR_OBSERVABLE_METADATA_BASELINE_V1` has database name
`absinthe-local-v2`, version `4`, and exactly these stores, key paths, and
indexes. Every store has `autoIncrement=false`; every listed index has
`multiEntry=false`. Index notation is `name: keyPath: unique`.

| Store | `keyPath` | Exact indexes |
| --- | --- | --- |
| `database_meta` | `"namespaceKey"` | `by_schema_version: "schemaVersion": false` |
| `generations` | `["namespaceKey","generationId"]` | `by_namespace_status: ["namespaceKey","status"]: false`; `by_namespace_created: ["namespaceKey","createdAt"]: false`; `one_active_per_namespace: "activeNamespaceKey": true` |
| `entities` | `["namespaceKey","generationId","domain","entityId"]` | `by_namespace_generation_domain: ["namespaceKey","generationId","domain"]: false`; `by_namespace_generation_owner: ["namespaceKey","generationId","ownerId"]: false`; `by_namespace_generation_deleted: ["namespaceKey","generationId","deletionState"]: false`; `by_namespace_generation_updated: ["namespaceKey","generationId","updatedAt"]: false` |
| `outbox` | `["namespaceKey","generationId","mutationId"]` | `by_namespace_generation_status: ["namespaceKey","generationId","status"]: false`; `by_namespace_generation_entity: ["namespaceKey","generationId","domain","entityId"]: false`; `by_idempotency_key: ["namespaceKey","generationId","idempotencyKey"]: true`; `by_namespace_generation_status_available: ["namespaceKey","generationId","status","availableAt"]: false`; `by_namespace_generation_status_lease: ["namespaceKey","generationId","status","leaseExpiresAt"]: false`; `by_namespace_generation_entity_revision: ["namespaceKey","generationId","domain","entityId","localRevision"]: true` |
| `sync_checkpoints` | `["namespaceKey","generationId","provider","stream"]` | `by_namespace_generation_provider: ["namespaceKey","generationId","provider"]: false` |
| `restore_sessions` | `["namespaceKey","sessionId"]` | `by_namespace_status: ["namespaceKey","status"]: false`; `by_namespace_package_id: ["namespaceKey","packageId"]: true`; `by_namespace_package_digest: ["namespaceKey","packageDigest"]: true`; `by_namespace_staging_generation: ["namespaceKey","stagingGenerationId"]: true` |
| `migration_state` | `["namespaceKey","migrationId"]` | `by_namespace_phase: ["namespaceKey","phase"]: false` |
| `attachment_state` | `["namespaceKey","generationId","attachmentId"]` | `by_namespace_generation_sync: ["namespaceKey","generationId","syncState"]: false`; `by_namespace_generation_updated: ["namespaceKey","generationId","updatedAt"]: false` |
| `writer_coordination_state` | `null` (out-of-line key) | `[]` |

No other predecessor store or index is accepted by this configuration input.
The table is fixed configuration data, not a request to enumerate, hash, read,
or validate persisted row contents.

`RECONSTRUCT_ACCEPTED_DESCRIPTOR_V1` is side-effect free and has exactly these
steps:

1. load `ACCEPTED_DESCRIPTOR_CONFIGURATION_INPUT_V1`;
2. validate the exact 23-key root schema and every exact nested object;
3. validate complete inventories, duplicate absence, canonical nulls, and all
   normative array orders;
4. reject unknown, omitted, malformed, alternate, or differently ordered
   values;
5. construct the one canonical descriptor JSON value under Section 4.9;
6. RFC 8785-canonicalize it and UTF-8 encode the resulting bytes;
7. frame the bytes with the Section 4.3 domain plus one `0x00` byte; and
8. compute SHA-256 lowercase-hex-64.

Its outputs are exactly `descriptorId`, `descriptorVersion`,
`physicalSchemaRevision`, `canonicalDescriptorValue`,
`canonicalDescriptorBytes`, `descriptorDigest`, and the fixed predecessor
baseline. It reads and writes no IndexedDB row, store, localStorage key, or
descriptor/digest sentinel.

`DESCRIPTOR_DOCUMENT_CONFORMANCE_V1` is a required precondition for
installation planning, post-install physical verification, reopen
classification, and retry verification. Configuration conformance failure is
`CONFLICTING_OR_PARTIAL_STATE` with its bounded configuration reason; it must
not be treated as an alternate descriptor, repaired from physical metadata, or
used to mutate schema.

`DESCRIPTOR_PHYSICAL_METADATA_PROJECTION_V1` is derived from those outputs.
It contains exactly:

| Projection field | Exact derivation |
| --- | --- |
| `databaseName`, `sourceDatabaseVersion`, `targetDatabaseVersion` | corresponding reconstructed root scalars |
| `requiredPredecessorStoreNames`, `requiredPredecessorObservableMetadata` | the ordered names and exact table above from the fixed predecessor baseline |
| `targetStoreNames` | `stores[].storeName` in ordinal order |
| `targetStores` | each accepted additive store projected to `storeName`, ordered `keyPath`, `autoIncrement`, and its installable index names in C order |
| `installableIndexes` | every index with `ACCEPTED_INSTALLABLE_INDEX`, projected to `ownerStoreName`, `indexName`, ordered `keyPath`, `unique`, and `multiEntry`, in C order |
| `excludedIndexNames` | `[{"ownerStoreName":"authority_audit_events","indexName":"by_subject"}]` |
| `prohibitedUnlistedK334Indexes` | string literal `ALL_UNLISTED_INDEXES_PROHIBITED` |
| `comparisonNormalization` | exact rules in the next paragraph |

Only accepted additive stores enter target projections. C03 enters only
`excludedIndexNames`; it is never projected as an installed index. All unlisted
K-334 indexes are prohibited. No discriminator, row version, codec, MAP,
lifecycle, reference, row-content, or descriptor-digest-as-observed-metadata
field exists in this projection.

`FRESH_INDEXEDDB_METADATA_SNAPSHOT_V1` is a fresh read-only observation with
only `databaseName`, `databaseVersion`, `objectStoreNames`, and, for each
relevant existing store, `storeName`, `keyPath`, `autoIncrement`, `indexNames`,
and each index's `indexName`, `keyPath`, `unique`, and `multiEntry`.
`DOMStringList` becomes a plain array and is sorted by unsigned UTF-8 bytes
only where membership order is non-semantic. Compound key-path arrays preserve
component order; a string, an array, and null remain distinct; names use exact
code-unit equality; booleans are exact; no locale comparison, normalization,
or case folding is allowed. The snapshot never infers row semantics.

`COMPARE_DESCRIPTOR_PROJECTION_TO_METADATA_V1` takes the reconstructed
descriptor outputs, its physical projection, a fresh snapshot, and governing
operation context (`initial_classification`, `post_install_verification`, or
`reopen_retry_classification`). It returns exactly one of:

- `EXACT_ACCEPTED_DESCRIPTOR_PREDECESSOR_V4`;
- `EXACT_ACCEPTED_DESCRIPTOR_TARGET_V5`;
- `EXACT_ACCEPTED_DESCRIPTOR_RETRY_V5`; or
- `CONFLICTING_OR_PARTIAL_STATE` with one bounded reason:
  `ACCEPTED_CONFIGURATION_UNAVAILABLE`, `CONFIGURATION_SCHEMA_INVALID`,
  `DESCRIPTOR_DIGEST_MISMATCH`, `SAME_ID_DIFFERENT_BYTES`,
  `UNACCEPTED_DESCRIPTOR_CONFIGURATION`, `PROJECTION_DERIVATION_FAILED`,
  `METADATA_SNAPSHOT_FAILED`, `PHYSICAL_METADATA_MISMATCH`,
  `UNEXPECTED_K334_SCHEMA_OBJECT`, or `PARTIAL_TARGET_PROJECTION`.

The comparator first requires document/configuration conformance, then compares
database name/version, exact predecessor or target store membership, each
store key path/`autoIncrement`, per-store index membership, each index key
path/`unique`/`multiEntry`, C03 absence, unlisted K-334 index absence, and
required predecessor observable metadata. Descriptor digest equality alone
never proves a physical match; physical metadata alone never proves which
descriptor was supplied.

The proposal Markdown SHA-256 binds this reviewed document; the canonical
descriptor digest identifies the reconstructed `canonicalDescriptor`; and the
fresh observed physical metadata has no native descriptor digest. A verifier
may compare metadata field by field only. It must not call such a transient
comparison a descriptor digest, persist it, or use it in place of the direct
comparison.

`DESCRIPTOR_CONFIGURATION_AND_PHYSICAL_PROJECTION_MATCH_V1` means the accepted
reviewed configuration reconstructed one descriptor ID/bytes/digest, that
descriptor deterministically produced one physical projection, and the fresh
snapshot equals that projection under applicable v4/v5 rules. IndexedDB does
not store the descriptor ID, descriptor bytes, or descriptor digest, and the
comparison does not claim database cryptographic attestation.

If another configuration projects to the same physical metadata but differs in
descriptor ID/version/revision, canonical bytes/digest, dependencies, proof
layers, or authority exclusions, it is not selected by the metadata. Only the
one accepted configuration is authorized; a different value under the same ID
is `CONFLICT`, and an unaccepted ID is `UNSUPPORTED_OR_MALFORMED_INPUT`.

## 5. Store Descriptor Inventory

All primary key paths are ordered compound arrays and every store has
`autoIncrement=false`. Each row and nested object uses exact-object validation:
all required fields must exist, accepted explicit nulls remain explicit,
unknown/inherited/accessor/symbol fields fail, and no normalization or repair
is permitted. “Canonical” below means the accepted canonical bytes are the
semantic payload authority and all flat fields are verified projections.

| Owner / family | ROW / MAP | Canonical store ID / exact name | Primary key path | Discriminator / physical version | Canonical or process binding | Lifecycle, dependency, and authority effect |
| --- | --- | --- | --- | --- | --- | --- |
| B01 subject registration | ROW-01 / MAP-01 | `k334.store.authority_subjects.v1` / `authority_subjects` | `["namespaceKey","subjectId"]` | no discriminator / `rowVersion=1` | fixed semantic `authority_subject_registration_v1`; no canonical wrapper/bytes/digest | Immutable exact registration; dedicated store required; presence grants no authority |
| B02 issuer registration | ROW-02 / MAP-02 | `k334.store.authority_issuers.v1` / `authority_issuers` | `["namespaceKey","issuerId"]` | no discriminator / `rowVersion=1` | fixed semantic `authority_issuer_registration_v1`; no canonical wrapper/bytes/digest | Immutable exact registration; no embedded policy/capability; presence grants no authority |
| K-334P09X issuer policy | ROW-03 / MAP-03 | `k334.store.authority_issuer_policies.v1` / `authority_issuer_policies` | `["namespaceKey","policyId"]` | `k334_physical_issuer_policy_row_v1` / `1` | canonical `issuer_policy` / `1`; `policyId===recordId` | Immutable canonical row; separate lifecycle evaluation; no applicability authority |
| B08 authority evidence | ROW-04 / MAP-04 | `k334.store.authority_evidence.v1` / `authority_evidence` | `["namespaceKey","evidenceId"]` | `k334_physical_authority_evidence_row_v1` / `1` | canonical `authority_evidence` / `1`; `evidenceId===recordId` | Append-only; exact eight-row lifecycle/reference matrix; required pair needs ROW-17; no winner/effect from presence |
| K-334P09X rollback permission | ROW-05 / MAP-05 | `k334.store.authority_rollback_permissions.v1` / `authority_rollback_permissions` | `["namespaceKey","permissionId"]` | `k334_physical_rollback_permission_row_v1` / `1` | canonical `rollback_permission` / `1`; `permissionId===recordId` | Immutable canonical row; no rollback execution authority |
| K-334P09X termination | ROW-06 / MAP-06 | `k334.store.authority_terminations.v1` / `authority_terminations` | `["namespaceKey","terminationId"]` | `k334_physical_termination_row_v1` / `1` | canonical `termination` / `1`; `terminationId===recordId` | Immutable canonical row; no target lifecycle evaluation |
| B03 compatibility tuple | ROW-07 / MAP-07 | `k334.store.authority_compatibility_tuples.v1` / `authority_compatibility_tuples` | `["namespaceKey","tupleId"]` | `k334_physical_compatibility_tuple_row_v1` / `1` | canonical `compatibility_tuple` / `1`; `tupleId===recordId`; `tupleDigest===canonicalDigest` | `IMMUTABLE_DIRECT_COMPATIBILITY_V1`; fixed physical status `recorded`; separate termination evidence; no activation |
| K-334P09X external mappings | ROW-08 / MAP-08 | `k334.store.authority_external_mappings.v1` / `authority_external_mappings` | `["namespaceKey","mappingId"]` | `k334_physical_external_mapping_row_v1` / `1` | canonical `external_subject_mapping` or `external_issuer_mapping` / `1`; exact `mappingKind`; `mappingId===recordId` | `SEPARATE_TERMINATION_RECORD_AUTHORITY`; no embedded termination state |
| K-334P09X fork observation | ROW-09 / MAP-09 | `k334.store.authority_fork_observations.v1` / `authority_fork_observations` | `["namespaceKey","observationId"]` | `k334_physical_fork_observation_row_v1` / `1` | canonical `fork_observation` / `1`; `observationId===recordId`; candidate bytes remain opaque canonical bytes | Immutable observation; no fork confirmation/quarantine authority |
| K-334P09X conflict observation | ROW-10 / MAP-10 | `k334.store.authority_conflict_observations.v1` / `authority_conflict_observations` | `["namespaceKey","observationId"]` | `k334_physical_conflict_observation_row_v1` / `1` | canonical `conflict_observation` / `1`; `observationId===recordId`; `conflictCode===reasonCode` | Immutable observation; no conflict resolution authority |
| K-334P09X quarantine | ROW-11 / MAP-11 | `k334.store.authority_quarantines.v1` / `authority_quarantines` | `["namespaceKey","subjectId"]` | `k334_physical_subject_quarantine_row_v1` / `1` | canonical `subject_quarantine` / `1`; `quarantineRecordId===recordId`; verified `basisDigest` | Physical subject slot is not record identity; no quarantine activation authority |
| B04 migration session | ROW-12 / MAP-12 | `k334.store.authority_migration_sessions.v1` / `authority_migration_sessions` | `["namespaceKey","batchId"]` | `k334_physical_migration_session_row_v1` / `1`; `recordType=authority_migration_session_v1`; schema `1` | exact process preimage; no K-334D3 canonical wrapper; operation key maps one-to-one to opaque batch ID | Intent immutable; status/lease mutable only through accepted CAS; required with ROW-14/15 and migration target/control stores; no execution authority |
| K-334P09X migration classification | ROW-13 / MAP-13 | `k334.store.authority_migration_classifications.v1` / `authority_migration_classifications` | `["namespaceKey","classificationId"]` | `k334_physical_migration_classification_row_v1` / `1` | canonical `migration_classification` / `1`; `classificationId===recordId` | Immutable canonical row; no classification/supersession execution |
| B05 migration checkpoint | ROW-14 / MAP-14 | `k334.store.authority_migration_checkpoints.v1` / `authority_migration_checkpoints` | `["namespaceKey","checkpointId"]` | `k334_physical_migration_checkpoint_row_v1` / `1`; `recordType=authority_migration_checkpoint_v1`; schema `1` | exact process preimage and composite ID; no K-334D3 wrapper | Append-only immutable; embeds `IMMUTABLE_RETAINED_SOURCE_SET_V1`; contiguous CAS-guarded chain; no resume authority |
| B06 recovery marker | ROW-15 / MAP-15 | `k334.store.authority_recovery_markers.v1` / `authority_recovery_markers` | `["namespaceKey","markerId"]` | `k334_physical_recovery_marker_row_v1` / `1`; `recordType=authority_recovery_marker_v1`; schema `1` | exact process preimage and composite ID; no K-334D3 wrapper | Append-only open/resolved model; exact predecessor/resolution graph; no repair/recovery authority |
| K-334P09X derived head | ROW-16 / MAP-16 | `k334.store.authority_heads.v1` / `authority_heads` | `["namespaceKey","subjectId","lineageId"]` | `recordType=authority_head_v1`; `recordSchemaVersion=1`; no `rowType` or canonical wrapper | exact projection preimage; `DERIVED_REBUILDABLE_NON_AUTHORITY` | Derived/rebuildable; cannot substitute for canonical evidence; no update/freshness authority |
| B07 audit event | ROW-17 / MAP-17 | `k334.store.authority_audit_events.v1` / `authority_audit_events` | `["namespaceKey","auditEventId"]` | `k334_physical_audit_event_row_v1` / `1`; `recordType=authority_audit_event_v1`; schema `1` | exact process preimage/digest; K-334D3 canonical kind/version prohibited | Append-only immutable; exact retry; required pair with ROW-04 for T01/T35 only; no semantic acceptance authority |

Store totals: 17 unique IDs, 17 unique names, ROW-01 through ROW-17 exactly
once, MAP-01 through MAP-17 exactly once, zero speculative stores, and zero
pair-operation stores.

### 5.1 Exact store binding values

The following table is canonical data, not explanatory shorthand. Each row
combines with the same-ordinal row in Section 5 to produce one complete
Section 4.4 store object. A quoted `null` below means the JSON token `null`,
not the string `"null"`. The only array-valued `canonicalKind` is ROW-08 and
its displayed order is normative.

| Ordinal | `owner` | `semanticFamily` | `discriminatorMode` | `rowType` | `rowVersion` | `recordType` | `recordSchemaVersion` | `canonicalBindingMode` | `canonicalKind` | `canonicalVersion` | `lifecycleModel` | `authorityClassification` |
| ---: | --- | --- | --- | --- | ---: | --- | ---: | --- | --- | ---: | --- | --- |
| 1 | `B01` | `authority_subject_registration_v1` | `NO_DISCRIMINATOR` | null | 1 | null | null | `FIXED_SEMANTIC_KIND_NO_CANONICAL_WRAPPER` | null | null | `IMMUTABLE_SUBJECT_REGISTRATION_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 2 | `B02` | `authority_issuer_registration_v1` | `NO_DISCRIMINATOR` | null | 1 | null | null | `FIXED_SEMANTIC_KIND_NO_CANONICAL_WRAPPER` | null | null | `IMMUTABLE_ISSUER_REGISTRATION_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 3 | `K-334P09X` | `issuer_policy` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_issuer_policy_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `issuer_policy` | 1 | `IMMUTABLE_CANONICAL_POLICY_ROW_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 4 | `B08` | `authority_evidence` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_authority_evidence_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `authority_evidence` | 1 | `APPEND_ONLY_B08_LIFECYCLE_MATRIX_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 5 | `K-334P09X` | `rollback_permission` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_rollback_permission_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `rollback_permission` | 1 | `IMMUTABLE_CANONICAL_ROLLBACK_PERMISSION_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 6 | `K-334P09X` | `termination` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_termination_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `termination` | 1 | `IMMUTABLE_CANONICAL_TERMINATION_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 7 | `B03` | `compatibility_tuple` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_compatibility_tuple_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `compatibility_tuple` | 1 | `IMMUTABLE_DIRECT_COMPATIBILITY_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 8 | `K-334P09X` | `external_mapping` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_external_mapping_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD_DISCRIMINATED_PAIR` | `["external_subject_mapping","external_issuer_mapping"]` | 1 | `SEPARATE_TERMINATION_RECORD_AUTHORITY` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 9 | `K-334P09X` | `fork_observation` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_fork_observation_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `fork_observation` | 1 | `IMMUTABLE_CANONICAL_FORK_OBSERVATION_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 10 | `K-334P09X` | `conflict_observation` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_conflict_observation_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `conflict_observation` | 1 | `IMMUTABLE_CANONICAL_CONFLICT_OBSERVATION_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 11 | `K-334P09X` | `subject_quarantine` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_subject_quarantine_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `subject_quarantine` | 1 | `IMMUTABLE_CANONICAL_QUARANTINE_RECORD_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 12 | `B04` | `authority_migration_session_v1` | `ROW_TYPE_AND_PROCESS_RECORD_TYPE` | `k334_physical_migration_session_row_v1` | 1 | `authority_migration_session_v1` | 1 | `PROCESS_PREIMAGE_NO_CANONICAL_WRAPPER` | null | null | `IMMUTABLE_INTENT_CAS_STATUS_LEASE_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 13 | `K-334P09X` | `migration_classification` | `ROW_TYPE_AND_CANONICAL_KIND` | `k334_physical_migration_classification_row_v1` | 1 | null | null | `K334_CANONICAL_RECORD` | `migration_classification` | 1 | `IMMUTABLE_CANONICAL_MIGRATION_CLASSIFICATION_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 14 | `B05` | `authority_migration_checkpoint_v1` | `ROW_TYPE_AND_PROCESS_RECORD_TYPE` | `k334_physical_migration_checkpoint_row_v1` | 1 | `authority_migration_checkpoint_v1` | 1 | `PROCESS_PREIMAGE_NO_CANONICAL_WRAPPER` | null | null | `APPEND_ONLY_IMMUTABLE_CONTIGUOUS_CHECKPOINT_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 15 | `B06` | `authority_recovery_marker_v1` | `ROW_TYPE_AND_PROCESS_RECORD_TYPE` | `k334_physical_recovery_marker_row_v1` | 1 | `authority_recovery_marker_v1` | 1 | `PROCESS_PREIMAGE_NO_CANONICAL_WRAPPER` | null | null | `APPEND_ONLY_OPEN_RESOLVED_RECOVERY_MARKER_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |
| 16 | `K-334P09X` | `authority_head_v1` | `PROCESS_RECORD_TYPE_ONLY` | null | null | `authority_head_v1` | 1 | `DERIVED_PROJECTION_PREIMAGE_NO_CANONICAL_WRAPPER` | null | null | `DERIVED_REBUILDABLE_NON_AUTHORITY` | `DERIVED_REBUILDABLE_NON_AUTHORITY` |
| 17 | `B07` | `authority_audit_event_v1` | `ROW_TYPE_AND_PROCESS_RECORD_TYPE` | `k334_physical_audit_event_row_v1` | 1 | `authority_audit_event_v1` | 1 | `PROCESS_PREIMAGE_NO_CANONICAL_WRAPPER` | null | null | `APPEND_ONLY_IMMUTABLE_AUDIT_EVENT_V1` | `PHYSICAL_PRESENCE_GRANTS_NO_AUTHORITY` |

## 6. Index Descriptor Inventory

All indexes are non-authoritative and `multiEntry=false`. Every listed key-path
component comes from direct validated own row fields. A required non-null
source produces an entry. An accepted explicit `null` that is not an
IndexedDB key mechanically produces no index entry; a missing required field
is malformed, not an omitted-index convention.

| C / canonical index ID | Owner / exact name | Exact key path | `unique` | Source / purpose | Disposition |
| --- | --- | --- | ---: | --- | --- |
| C01 / `k334.index.authority_audit_events.by_record.v1` | `authority_audit_events` / `by_record` | `["namespaceKey","recordId"]` | false | ROW-17 direct fields; audit lookup/restart rediscovery | `ACCEPTED_INSTALLABLE_INDEX` |
| C02 / `k334.index.authority_audit_events.by_source_digest.v1` | `authority_audit_events` / `by_source_digest` | `["namespaceKey","sourceDigest"]` | false | ROW-17 direct fields; source audit lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C03 / `k334.index.authority_audit_events.by_subject.v1` | `authority_audit_events` / `by_subject` | none; ROW-17 has no `subjectId` | n/a | Subject may not be inferred through a referenced record | `ACCEPTED_EXCLUDED_INDEX`; `EXPLICIT_VERSIONED_INDEX_REMOVAL_V1` |
| C04 / `k334.index.authority_compatibility_tuples.by_exact_tuple.v1` | `authority_compatibility_tuples` / `by_exact_tuple` | `["namespaceKey","tupleDigest"]` | true | ROW-07 verified alias; exact tuple lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C05 / `k334.index.authority_compatibility_tuples.by_tuple_status.v1` | `authority_compatibility_tuples` / `by_tuple_status` | `["namespaceKey","lifecycleStatus"]` | false | ROW-07 fixed physical status; recorded-row lookup only | `ACCEPTED_INSTALLABLE_INDEX` |
| C06 / `k334.index.authority_conflict_observations.by_observation_digest.v1` | `authority_conflict_observations` / `by_observation_digest` | `["namespaceKey","canonicalDigest"]` | true | ROW-10 verified envelope digest; integrity lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C07 / `k334.index.authority_conflict_observations.by_subject_code.v1` | `authority_conflict_observations` / `by_subject_code` | `["namespaceKey","subjectId","conflictCode"]` | false | ROW-10 direct/verified alias fields; conflict lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C08 / `k334.index.authority_evidence.by_digest.v1` | `authority_evidence` / `by_digest` | `["namespaceKey","canonicalDigest"]` | true | ROW-04 verified envelope digest; integrity/idempotency lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C09 / `k334.index.authority_evidence.by_issuer.v1` | `authority_evidence` / `by_issuer` | `["namespaceKey","issuerId"]` | false | ROW-04 verified projection; audit/policy lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C10 / `k334.index.authority_evidence.by_predecessor.v1` | `authority_evidence` / `by_predecessor` | `["namespaceKey","predecessorRecordId"]` | false | ROW-04 verified nullable projection; explicit null creates no entry; competitor/reference lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C11 / `k334.index.authority_evidence.by_subject_lineage_sequence.v1` | `authority_evidence` / `by_subject_lineage_sequence` | `["namespaceKey","subjectId","lineageId","effectiveSequence"]` | false | ROW-04 verified projections; all candidates at one logical position | `ACCEPTED_INSTALLABLE_INDEX` |
| C12 / `k334.index.authority_evidence.by_subject_status.v1` | `authority_evidence` / `by_subject_status` | `["namespaceKey","subjectId","lifecycleStatus"]` | false | ROW-04 verified projections; validation lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C13 / `k334.index.authority_external_mappings.by_external.v1` | `authority_external_mappings` / `by_external` | `["namespaceKey","mappingKind","provider","externalNamespace","externalIdentifier"]` | false | ROW-08 verified projections; ambiguity lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C14 / `k334.index.authority_external_mappings.by_internal.v1` | `authority_external_mappings` / `by_internal` | `["namespaceKey","mappingKind","internalId"]` | false | ROW-08 verified projections; reverse audit | `ACCEPTED_INSTALLABLE_INDEX` |
| C15 / `k334.index.authority_external_mappings.by_mapping_digest.v1` | `authority_external_mappings` / `by_mapping_digest` | `["namespaceKey","canonicalDigest"]` | true | ROW-08 verified envelope digest; integrity lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C16 / `k334.index.authority_fork_observations.by_observation_digest.v1` | `authority_fork_observations` / `by_observation_digest` | `["namespaceKey","canonicalDigest"]` | true | ROW-09 verified envelope digest; integrity lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C17 / `k334.index.authority_fork_observations.by_subject_predecessor.v1` | `authority_fork_observations` / `by_subject_predecessor` | `["namespaceKey","subjectId","predecessorRecordId"]` | false | ROW-09 verified projections; fork lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C18 / `k334.index.authority_heads.by_projection_digest.v1` | `authority_heads` / `by_projection_digest` | `["namespaceKey","canonicalSetDigest"]` | false | ROW-16 direct derived field; projection lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C19 / `k334.index.authority_heads.by_subject.v1` | `authority_heads` / `by_subject` | `["namespaceKey","subjectId"]` | false | ROW-16 direct fields; derived lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C20 / `k334.index.authority_issuer_policies.by_issuer_subject_action.v1` | `authority_issuer_policies` / `by_issuer_subject_action` | `["namespaceKey","issuerId","subjectId","action"]` | false | ROW-03 verified projections; policy lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C21 / `k334.index.authority_issuer_policies.by_policy_digest.v1` | `authority_issuer_policies` / `by_policy_digest` | `["namespaceKey","canonicalDigest"]` | true | ROW-03 verified envelope digest; integrity lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C22 / `k334.index.authority_issuer_policies.by_subject_action_sequence.v1` | `authority_issuer_policies` / `by_subject_action_sequence` | `["namespaceKey","subjectId","action","effectiveSequence"]` | false | ROW-03 verified projections; applicability-candidate lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C23 / `k334.index.authority_issuers.by_issuer_namespace.v1` | `authority_issuers` / `by_issuer_namespace` | `["namespaceKey","issuerId"]` | true | ROW-02 direct fields; structural primary-key duplicate | `ACCEPTED_INSTALLABLE_INDEX` |
| C24 / `k334.index.authority_migration_checkpoints.by_batch_sequence.v1` | `authority_migration_checkpoints` / `by_batch_sequence` | `["namespaceKey","batchId","checkpointSequence"]` | true | ROW-14 direct fields; contiguous sequence lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C25 / `k334.index.authority_migration_checkpoints.by_batch_status.v1` | `authority_migration_checkpoints` / `by_batch_status` | `["namespaceKey","batchId","status"]` | false | ROW-14 direct fields; verification/completion candidate lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C26 / `k334.index.authority_migration_classifications.by_batch_class.v1` | `authority_migration_classifications` / `by_batch_class` | `["namespaceKey","batchId","classification"]` | false | ROW-13 verified projections; batch accounting | `ACCEPTED_INSTALLABLE_INDEX` |
| C27 / `k334.index.authority_migration_classifications.by_source_digest.v1` | `authority_migration_classifications` / `by_source_digest` | `["namespaceKey","sourceDigest"]` | false | ROW-13 verified projection; source lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C28 / `k334.index.authority_migration_sessions.by_lease_epoch.v1` | `authority_migration_sessions` / `by_lease_epoch` | `["namespaceKey","batchId","leaseEpoch"]` | true | ROW-12 direct fields; CAS candidate lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C29 / `k334.index.authority_migration_sessions.by_source_status.v1` | `authority_migration_sessions` / `by_source_status` | `["namespaceKey","sourceDigest","sessionStatus"]` | false | ROW-12 direct fields; exact-validation candidate lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C30 / `k334.index.authority_quarantines.by_state.v1` | `authority_quarantines` / `by_state` | `["namespaceKey","quarantineState"]` | false | ROW-11 verified projection; convenience state lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C31 / `k334.index.authority_recovery_markers.by_batch_status.v1` | `authority_recovery_markers` / `by_batch_status` | `["namespaceKey","batchId","markerStatus"]` | false | ROW-15 direct fields; open/resolved candidate lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C32 / `k334.index.authority_rollback_permissions.by_issuer_subject.v1` | `authority_rollback_permissions` / `by_issuer_subject` | `["namespaceKey","issuerId","subjectId"]` | false | ROW-05 verified projections; policy lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C33 / `k334.index.authority_rollback_permissions.by_permission_digest.v1` | `authority_rollback_permissions` / `by_permission_digest` | `["namespaceKey","canonicalDigest"]` | true | ROW-05 verified envelope digest; integrity lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C34 / `k334.index.authority_rollback_permissions.by_target.v1` | `authority_rollback_permissions` / `by_target` | `["namespaceKey","subjectId","rollbackTargetRecordId"]` | false | ROW-05 verified projections; exact-target lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C35 / `k334.index.authority_subjects.by_subject_namespace.v1` | `authority_subjects` / `by_subject_namespace` | `["namespaceKey","subjectId"]` | true | ROW-01 direct fields; structural primary-key duplicate | `ACCEPTED_INSTALLABLE_INDEX` |
| C36 / `k334.index.authority_terminations.by_subject_sequence.v1` | `authority_terminations` / `by_subject_sequence` | `["namespaceKey","subjectId","effectiveSequence"]` | false | ROW-06 verified projections; lifecycle-candidate lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C37 / `k334.index.authority_terminations.by_target.v1` | `authority_terminations` / `by_target` | `["namespaceKey","targetRecordId","effectiveSequence"]` | false | ROW-06 verified projections; prospective target lookup | `ACCEPTED_INSTALLABLE_INDEX` |
| C38 / `k334.index.authority_terminations.by_termination_digest.v1` | `authority_terminations` / `by_termination_digest` | `["namespaceKey","canonicalDigest"]` | true | ROW-06 verified envelope digest; integrity lookup | `ACCEPTED_INSTALLABLE_INDEX` |

Disposition totals: 37 `ACCEPTED_INSTALLABLE_INDEX`, one
`ACCEPTED_EXCLUDED_INDEX`, and zero accepted unresolved indexes. Every index
not listed is `UNRESOLVED_OR_PROHIBITED_INDEX` and cannot be implementation
selected. C03 and every alternate B07 subject index must be absent.

### 6.1 Exact index behavior values

The following table is canonical data. Each row combines with the same C-ID
row in Section 6 to produce one complete Section 4.5 index object.
`directSourceFields` is an exact element-for-element copy of the ordered
`keyPath` for every installable entry and is `[]` for C03. The
`authorityEffect` is `NON_AUTHORITATIVE_LOOKUP_ONLY` for all 38 entries.

| C ID | `nullOrMissingBehavior` | `lookupPurpose` |
| --- | --- | --- |
| C01 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `AUDIT_RECORD_RESTART_LOOKUP` |
| C02 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `AUDIT_SOURCE_LOOKUP` |
| C03 | `NOT_APPLICABLE_EXCLUDED_INDEX` | `EXCLUDED_NO_SUBJECT_SOURCE` |
| C04 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `EXACT_TUPLE_LOOKUP` |
| C05 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `RECORDED_TUPLE_STATUS_LOOKUP` |
| C06 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `CONFLICT_DIGEST_INTEGRITY_LOOKUP` |
| C07 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `CONFLICT_SUBJECT_CODE_LOOKUP` |
| C08 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `EVIDENCE_DIGEST_INTEGRITY_LOOKUP` |
| C09 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `EVIDENCE_ISSUER_AUDIT_POLICY_LOOKUP` |
| C10 | `EXPLICIT_NULL_PRODUCES_NO_ENTRY_MISSING_FIELD_MALFORMED` | `EVIDENCE_PREDECESSOR_COMPETITOR_LOOKUP` |
| C11 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `EVIDENCE_LOGICAL_POSITION_COMPETITOR_LOOKUP` |
| C12 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `EVIDENCE_SUBJECT_STATUS_VALIDATION_LOOKUP` |
| C13 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `EXTERNAL_MAPPING_AMBIGUITY_LOOKUP` |
| C14 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `EXTERNAL_MAPPING_REVERSE_AUDIT_LOOKUP` |
| C15 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `EXTERNAL_MAPPING_DIGEST_INTEGRITY_LOOKUP` |
| C16 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `FORK_DIGEST_INTEGRITY_LOOKUP` |
| C17 | `EXPLICIT_NULL_PRODUCES_NO_ENTRY_MISSING_FIELD_MALFORMED` | `FORK_SUBJECT_PREDECESSOR_LOOKUP` |
| C18 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `DERIVED_HEAD_PROJECTION_DIGEST_LOOKUP` |
| C19 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `DERIVED_HEAD_SUBJECT_LOOKUP` |
| C20 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `ISSUER_POLICY_CANDIDATE_LOOKUP` |
| C21 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `ISSUER_POLICY_DIGEST_INTEGRITY_LOOKUP` |
| C22 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `ISSUER_POLICY_APPLICABILITY_CANDIDATE_LOOKUP` |
| C23 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `ISSUER_PRIMARY_KEY_DUPLICATE_LOOKUP` |
| C24 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `CHECKPOINT_CONTIGUOUS_SEQUENCE_LOOKUP` |
| C25 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `CHECKPOINT_STATUS_CANDIDATE_LOOKUP` |
| C26 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `MIGRATION_CLASS_BATCH_ACCOUNTING_LOOKUP` |
| C27 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `MIGRATION_CLASS_SOURCE_LOOKUP` |
| C28 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `MIGRATION_SESSION_CAS_EPOCH_LOOKUP` |
| C29 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `MIGRATION_SESSION_SOURCE_STATUS_LOOKUP` |
| C30 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `QUARANTINE_STATE_LOOKUP` |
| C31 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `RECOVERY_MARKER_STATUS_LOOKUP` |
| C32 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `ROLLBACK_PERMISSION_ISSUER_SUBJECT_LOOKUP` |
| C33 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `ROLLBACK_PERMISSION_DIGEST_INTEGRITY_LOOKUP` |
| C34 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `ROLLBACK_PERMISSION_TARGET_LOOKUP` |
| C35 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `SUBJECT_PRIMARY_KEY_DUPLICATE_LOOKUP` |
| C36 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `TERMINATION_SUBJECT_SEQUENCE_LOOKUP` |
| C37 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `TERMINATION_TARGET_SEQUENCE_LOOKUP` |
| C38 | `REQUIRED_DIRECT_FIELDS_INDEX_ENTRY_REQUIRED_MISSING_FIELD_MALFORMED` | `TERMINATION_DIGEST_INTEGRITY_LOOKUP` |

For installable indexes, Section 6 supplies the exact `ownerStoreName`,
`indexName`, ordered `keyPath`, and `unique`; the owner store row supplies the
exact `ownerStoreIdentity`; `multiEntry` is `false`; and `disposition` is
`ACCEPTED_INSTALLABLE_INDEX`. For C03, the exact complete object in Section
4.5 overrides the prose-only `none` and `n/a` cells in Section 6. Unknown
behavior literals or alternate null/missing rules are invalid.

## 7. ROW/MAP/Descriptor Consistency

For each store, the descriptor binds exactly one semantic/process family, ROW,
MAP, canonical store ID, physical name, ordered primary key, discriminator or
accepted exact absence, physical version, canonical/process binding or exact
absence, alias rules, digest/preimage fields, and index projections.

Validation fails closed unless:

1. ROW-01–ROW-17 and MAP-01–MAP-17 are each present exactly once;
2. every MAP points to its one ROW/store and every store points back;
3. request key components equal exact row fields in the accepted order;
4. B01/B02 reconstruct their fixed semantic kind without adding a row
   discriminator or canonical wrapper;
5. canonical rows decode and byte-identically re-encode, and every alias,
   digest, kind/version, repository/namespace, and projection equals decoded
   canonical bytes;
6. process rows reproduce their exact framed preimage, ID, digest, context,
   discriminator, and version;
7. ROW-16 remains derived/rebuildable/non-authoritative;
8. every index owner/field source exists in its exact ROW; and
9. C03 is absent and no subject field is invented for ROW-17.

Accepted ROW/MAP contracts remain semantic and physical authority. The
descriptor is only their exact installation declaration and cannot become a
second semantic authority.

## 8. Cross-Descriptor Dependencies and Installation Order

The exact installation order is ROW-01 through ROW-17 store order above,
followed by C01 through C38 order with C03 skipped. Stores precede their own
indexes. Canonical evidence set order remains separate from this installation
order.

The future v4-to-v5 schema upgrade must validate the whole descriptor before
mutation and install all 17 stores plus all 37 indexes in one native IndexedDB
`versionchange` transaction. This is the sole schema-installation atomic group:
commit installs the complete exact set; abort installs none. It is not a
generic migration engine.

This descriptor governs the additive K-334 v5 store/index set, not the
pre-existing v4 store inventory. Every accepted v4 store, index, and record
must remain present and byte-unchanged. Existing v4 names are required
predecessor state, not “unexpected stores”; an unexpected new K-334-reserved
store/index or a mismatch to the known v4 predecessor is a conflict.

The following availability dependencies are load-bearing:

- B01/ROW-01 and B02/ROW-02 must exist before any later record protocol may
  validate their references, but those semantic references do not require a
  different schema-creation order.
- B03/ROW-07 is the canonical compatibility store required by later exact
  compatibility reference validation.
- B04 ROW-12, B05 ROW-14, and B06 ROW-15 plus the accepted migration
  target/control stores must all be present before a future migration protocol
  can satisfy its transaction scopes.
- B07 ROW-17 and B08 ROW-04 must both be available for the accepted T01/T35
  required atomic pair; no third pair-operation store exists.
- ROW-16 depends semantically on validated canonical evidence but remains a
  derived store, not an installation authority.

No dependency is inferred from an index. Reference validation prerequisites
are not schema-installation dependencies beyond complete store availability.

## 9. Migration and Recovery Installation Boundary

The descriptor binds, without executing, the accepted B04–B06 contracts:

- ROW-12/MAP-12 operation-key rediscovery before batch allocation, exact
  status/lease/CAS model, and source-4/target-5/database/scope tuple;
- ROW-14/MAP-14 checkpoint-before-mutation, contiguous CAS-guarded sequence,
  immutable checkpoint rows, exact phase/status matrix, and embedded
  byte-complete `IMMUTABLE_RETAINED_SOURCE_SET_V1`;
- ROW-15/MAP-15 append-only open/resolved markers, exact predecessor and
  resolution references, and fail-closed state/digest validation;
- availability of the exact session/checkpoint/marker and accepted
  target/control stores in every later required transaction;
- the fresh target/projection/control reread and atomic completion pair; and
- failure when a required store cannot participate.

Installation cannot be declared successful until the post-install inventory
verification in Section 12 succeeds. Nothing here starts, resumes, repairs,
rolls back, cleans up, or completes migration/recovery.

## 10. B07/B08 Installation Boundary

The descriptor includes ROW-17 `authority_audit_events` with only C01/C02 and
ROW-04 `authority_evidence` with C08–C12. C03/by_subject is excluded; ROW-17
has no `subjectId`; referenced evidence cannot supply it.

The accepted `EVIDENCE_AUDIT_ATOMIC_PAIR_V1` and
`REQUIRED_EVIDENCE_AUDIT_ATOMIC_INTEGRITY_V1` require the two stores to
participate atomically for the T01/T35 required-pair branch. No third store
records a pair operation. Restart rediscovery uses the B08 primary key first
and then B07 C01/by_record. B08 C11/by_subject_lineage_sequence supplies
competitor lookup for the exact logical position; it never chooses a winner.

Indexes remain non-authoritative. Store/index presence grants neither evidence
authority nor audit authority, and the required pair does not merge their
semantic meanings.

## 11. Existing-Schema Conflict Policy and Installation Retry

`K334_DESCRIPTOR_INSTALLATION_STATE_V1` has exactly five states. Classification
uses a conformed `ACCEPTED_DESCRIPTOR_CONFIGURATION_INPUT_V1`, its reconstructed
physical projection, a fresh observable metadata snapshot, and whether the
classifier is executing inside the one authorized native `versionchange`
transaction. It does not infer state from rows, runtime intent, or a digest
supposedly stored in IndexedDB.

### 11.1 `PRE_INSTALL_V4_EXPECTED_STATE`

This state requires all of the following:

- database name is exactly `absinthe-local-v2`;
- committed database version is exactly 4;
- every required v4 predecessor store, index, key path, index flag, and other
  physically observable predecessor metadata equals the fixed accepted
  predecessor projection;
- all 17 additive K-334 v5 stores are absent;
- all 37 installable K-334 indexes are absent because their owner stores are
  absent;
- C03 is absent; and
- no partial, unknown, or unexpected K-334 v5 store/index structure exists.

This exact absence is valid predecessor state, not a conflict. Only this state
may proceed to a separately authorized whole-set v4-to-v5 installation. This
proposal provides neither that implementation nor execution authority.
Predecessor row preservation remains the transaction's
`PRESERVE_EXISTING_V4_STORES_INDEXES_AND_RECORDS_BYTE_UNCHANGED` write boundary;
it is not inferred from a metadata snapshot.

### 11.2 `IN_TRANSACTION_TARGET_CONSTRUCTION`

This is an internal transient state visible only while the one native
IndexedDB `versionchange` transaction constructs the target in deterministic
store/index order. Stores and indexes may be temporarily incomplete inside
that transaction. Such incompleteness is not an externally accepted committed
state, and no other connection may classify it as installed. Commit requires
the complete exact target set; abort returns the database to the committed
predecessor under IndexedDB transaction semantics. Ordinary reopen-time retry
classification never returns this state.

### 11.3 `POST_INSTALL_V5_EXACT_STATE`

This is the sole successful committed installation result and requires:

- database name `absinthe-local-v2` and committed version 5;
- all 17 declared stores with exact names, ordered key paths, and
  `autoIncrement=false`;
- all 37 installable indexes with exact owner, name, ordered key path,
  `unique`, and `multiEntry=false`;
- C03 and every unlisted K-334 index absent;
- all required v4 stores, indexes, and observable metadata retained;
- no unknown or unexpected K-334 schema object; and
- `DESCRIPTOR_CONFIGURATION_AND_PHYSICAL_PROJECTION_MATCH_V1` for the
  reconstructed accepted descriptor and fresh target snapshot.

This state proves only the physical result identified in Section 12. It does
not prove persisted-row semantics or grant runtime authority.

### 11.4 `EXACT_V5_RETRY_STATE`

On reopen, reconstruction of the same accepted configuration followed by
`EXACT_ACCEPTED_DESCRIPTOR_TARGET_V5` classification produces
`EXACT_V5_RETRY_STATE`. The required effect is `NO_OP_NO_MUTATION`: no
versionchange, store/index creation or deletion, record rewrite, repair, or
new authority. The same descriptor ID with different canonical bytes or digest
is a conflict; no stored digest row is consulted.

### 11.5 `CONFLICTING_OR_PARTIAL_STATE`

Every committed state other than exact Section 11.1 or exact Section 11.3 is
`CONFLICTING_OR_PARTIAL_STATE`, including:

- version 4 with any K-334 v5 store or index unexpectedly present;
- version 5 with any required store or index missing;
- any strict subset of the 17 stores or 37 installable indexes;
- C03, an unlisted K-334 index, an unknown K-334 store, or another unexpected
  schema object present;
- a wrong store/index owner, name, key path, `autoIncrement`, `unique`, or
  `multiEntry`;
- a wrong database name/version;
- altered or missing accepted v4 predecessor observable metadata;
- configuration, descriptor identity, canonical-byte, digest, or projection
  mismatch; or
- any mixture of exact and absent target structures.

The exact policy is `PARTIAL_INSTALLATION_ALWAYS_CONFLICTS_V1`. It fails closed
with bounded diagnostics and no mutation. It must not complete a missing
subset, alter a partial structure, drop, clear, replace, rename, normalize, or
repair anything. Recovery or migration requires separate reviewed authority.

### 11.6 Reopen after an uncertain transaction outcome

The exact reopen algorithm is:

1. reopen or inspect the committed database without a blind install rerun;
2. conform and reconstruct the accepted descriptor, then derive its predecessor
   and target physical projections;
3. take a fresh metadata snapshot and classify exact Section 11.1, exact
   Section 11.3, or Section 11.5;
4. for exact v4, report
   `REPORT_INSTALLATION_NOT_COMMITTED_NO_RETRY_AUTHORITY`;
5. for exact v5, return `EXACT_V5_RETRY_STATE` and no-op; and
6. for conflict/partial, return `FAIL_CLOSED_NO_MUTATION`.

An abort that leaves exact v4 is not a conflict, but exact v4 does not itself
authorize another attempt. Any later install still requires separate
implementation and execution authority.

Missing-structure interpretation is therefore state-scoped: absence of all
target structures is required in exact pre-install v4; temporary absence is
internal during target construction; any target absence is a conflict in
committed v5; and target absence mixed with target presence is always partial
conflict. No other interpretation is valid.

## 12. Post-Install Verification Prerequisite

The descriptor declares exactly three non-interchangeable proof layers, in
this normative array order:

1. `DESCRIPTOR_DOCUMENT_CONFORMANCE_V1`;
2. `POST_INSTALL_PHYSICAL_METADATA_VERIFICATION_V1`; and
3. `PERSISTED_ROW_AND_RUNTIME_SEMANTIC_VALIDATION_V1`.

### 12.1 Descriptor-document conformance

`DESCRIPTOR_DOCUMENT_CONFORMANCE_V1` may establish that one descriptor object
matches the exact root and nested schemas; its digest verifies; all 17 store
declarations and all 38 index dispositions are present; ROW/MAP identifiers
and declared bindings are internally consistent; and dependencies,
transaction groups, policies, proof layers, and exclusions are complete. This
is document/configuration conformance only.

### 12.2 Physical metadata verification

`POST_INSTALL_PHYSICAL_METADATA_VERIFICATION_V1` performs a fresh read of
observable IndexedDB metadata only after
`DESCRIPTOR_DOCUMENT_CONFORMANCE_V1` has reconstructed the accepted descriptor
and `DESCRIPTOR_PHYSICAL_METADATA_PROJECTION_V1` has been derived. It may
establish only:

- exact database name and version;
- exact `objectStoreNames` membership;
- each store's `keyPath`, `autoIncrement`, and `indexNames`;
- each index's owner, name, `keyPath`, `unique`, and `multiEntry`;
- exact store/index inventory membership;
- C03 and every unlisted K-334 index absent; and
- predecessor store names and other required physically observable metadata
  preserved.

`K334_IDB_METADATA_EXACT_COMPARISON_V1` defines the comparison:

- copy each `DOMStringList` to a plain string array, reject duplicates, sort
  only for set-membership comparison by unsigned UTF-8 bytes, and compare
  exact membership;
- compare a `keyPath` by exact JavaScript/IndexedDB value category: string,
  ordered string array, or null;
- preserve compound-key array component order and compare each string by exact
  code-point sequence without normalization, case folding, or locale rules;
- compare store/index names as exact strings; and
- compare `autoIncrement`, `unique`, and `multiEntry` as exact booleans.

All 17 declared store key paths and all 37 installable index key paths are
ordered arrays, so any observed alternate category or component order fails.
C03 has no metadata entry because it must be absent.

The exact successful comparison outcome is
`PHYSICAL_SCHEMA_MATCHES_ACCEPTED_DESCRIPTOR_PROJECTION_V1`: accepted
configuration conformed, its descriptor ID/bytes/digest were deterministically
reconstructed, and fresh physical metadata exactly matched that descriptor's
projection. It does not state that IndexedDB stored the descriptor ID, bytes,
or digest. The root-level physical result remains
`PHYSICAL_SCHEMA_INSTALLED_EXACTLY_AS_DECLARED_V1`.

This layer cannot prove row discriminator behavior, `rowVersion` enforcement,
canonical codec correctness, canonical record bytes/digests, process-preimage
validation, MAP reconstruction, lifecycle compatibility, reference integrity,
checkpoint safety, required evidence/audit row presence, logical-position
correctness, or ROW-16 head correctness/freshness. It cannot prove transaction
atomicity retrospectively beyond observing the exact committed physical
result.

### 12.3 Persisted-row and runtime semantic validation

`PERSISTED_ROW_AND_RUNTIME_SEMANTIC_VALIDATION_V1` belongs to a future
separately authorized codec/runtime/recovery implementation. That future proof
may test exact-object codecs, discriminator and version checks, canonical
bytes/digests, total lossless MAP reconstruction, relational validation,
lifecycle behavior, checkpoints, atomic row pairs, and derived projections.
Empty-store schema metadata proves none of these declarations.

The descriptor may require this future implementation conformance before a
later execution authorization; it does not implement, execute, or satisfy that
proof layer here.

### 12.4 Installation creates no authority rows

`DESCRIPTOR_INSTALLATION_CREATES_NO_AUTHORITY_ROWS_V1` is exact: the future
schema installation transaction creates only stores and indexes. It must not
create, seed, synthesize, rewrite, or delete subject registrations, issuer
registrations, issuer policies, authority evidence, rollback permissions,
terminations, compatibility tuples, external mappings, fork observations,
conflict observations, quarantines, migration sessions, migration
classifications, checkpoints, recovery markers, authority heads, or audit
events.

Immediately after a successful exact v4-to-v5 installation, each of the 17
new K-334 stores contains zero rows and every pre-existing v4 record remains
untouched. ROW-16 is not initialized or populated; no head correctness is
claimed. No checkpoint/marker or evidence/audit pair is created. Empty store
creation grants no semantic authority. The zero-row result is an installation
write prohibition and would require a separate data observation to evidence;
it is not inferred from IndexedDB metadata.

Descriptor identity/digest remains accepted configuration and review authority.
No descriptor metadata, manifest, digest, sentinel, or hidden row is seeded in
any of the 17 stores; no localStorage binding is introduced; and no existing
row is mutated by this comparison procedure.

Successful physical verification establishes only
`PHYSICAL_SCHEMA_INSTALLED_EXACTLY_AS_DECLARED_V1`. It does not retroactively
authorize descriptor implementation, prove ROW/MAP semantics or persisted-row
validity, complete migration, establish recovery/evidence/audit/head safety,
grant runtime readiness, or make a production source eligible.

Any document or physical verification failure leaves its own proof layer
unsatisfied and returns `UNSUPPORTED_OR_MALFORMED_INPUT` with bounded
diagnostics. This proposal defines prerequisites only; it neither implements
nor executes them and does not rebound D0-P09.

## 13. Descriptor-Level Shared Constraints

The complete descriptor-level constraint set is:

- exact required root and nested own-field inventories, scalar types,
  literals, canonical nulls, and normative array order;
- exact RFC 8785 canonical bytes, digest participation/exclusions, domain
  framing, SHA-256, and lowercase-hex representation;
- unique store IDs/names and unique index IDs/owner-name pairs;
- exact ordered keys and explicit `autoIncrement=false`;
- exact family/ROW/MAP/store coherence;
- exact accepted discriminator or exact accepted absence and physical version;
- exact canonical kind/version or process-record binding;
- canonical identity/digest/bytes, fixed accepted configuration, side-effect
  free reconstruction, and exact physical-projection equality;
- direct index ownership and field-source equality;
- C03/alternate-subject-index exclusion;
- ROW-16 derived/non-authoritative classification;
- deterministic installation ordering and the complete upgrade transaction;
- B04–B06 required store participation;
- B07/B08 two-store participation with no pair-operation store;
- the five-state exact-v4/exact-v5/partial installation classifier;
- exact no-op retry and `PARTIAL_INSTALLATION_ALWAYS_CONFLICTS_V1`;
- no descriptor/digest row or store, with fresh metadata compared directly to
  the accepted descriptor projection;
- three distinct proof layers with physical metadata unable to prove semantic
  declarations;
- `DESCRIPTOR_INSTALLATION_CREATES_NO_AUTHORITY_ROWS_V1`; and
- exact post-install physical inventory verification establishing only
  `PHYSICAL_SCHEMA_INSTALLED_EXACTLY_AS_DECLARED_V1`.

Record-level constraints remain owned by their accepted records, not by the
descriptor: policy applicability; compatibility evaluation; lifecycle winner
selection; predecessor/supersession/termination effect; fork/conflict
resolution; quarantine effect; migration status/CAS execution; checkpoint
resume; recovery decision; evidence/audit semantic meaning; competitor
handling; and derived-head correctness/freshness.

## 14. Authority Exclusions and Unsupported Scope

This proposal establishes only descriptor-authority prerequisite content.
It does not accept that content or authorize:

- descriptor implementation, codecs, validators, serializer, checksum code,
  tests, fixtures, or a module;
- IndexedDB opening, version change, store/index installation, or schema
  mutation;
- migration, recovery, checkpoint, marker, transaction, CAS, writer, or
  concurrency execution;
- D0-P09 rebinding, execution, or satisfaction;
- D0-P10 execution;
- K-334E or K-334F;
- runtime records, production imports, startup/background work, cleanup,
  destructive replacement, automatic repair, best-effort upgrade,
  cross-device coordination, plugin descriptors, or speculative stores/indexes;
- admission, eligibility, activation, rollout, or production behavior.

Malformed, unknown-version, partial, extra, conflicting, or unsupported input
uses `UNSUPPORTED_OR_MALFORMED_INPUT`, fails closed or is quarantined only
where separately accepted authority permits, and exposes only bounded
diagnostics.

## 15. Prerequisite Readiness

| Readiness item | State |
| --- | --- |
| B01 authority input | `READY_FOR_REVIEW` |
| B02 authority input | `READY_FOR_REVIEW` |
| B03 authority input | `READY_FOR_REVIEW` |
| B04 authority input | `READY_FOR_REVIEW` |
| B05 authority input | `READY_FOR_REVIEW` |
| B06 authority input | `READY_FOR_REVIEW` |
| B07 authority input | `READY_FOR_REVIEW` |
| B08 authority input | `READY_FOR_REVIEW` |
| Descriptor identity/version and database boundary | `READY_FOR_REVIEW` |
| Complete 17-store inventory | `READY_FOR_REVIEW` |
| Complete 37-index installable inventory | `READY_FOR_REVIEW` |
| C03 excluded-index inventory | `READY_FOR_REVIEW` |
| ROW/MAP/descriptor consistency | `READY_FOR_REVIEW` |
| Canonical bytes/digest boundary | `READY_FOR_REVIEW` |
| Cross-descriptor dependencies | `READY_FOR_REVIEW` |
| Installation order and atomic group | `READY_FOR_REVIEW` |
| Existing-schema conflict handling | `READY_FOR_REVIEW` |
| Exact retry/idempotency | `READY_FOR_REVIEW` |
| Post-install verification | `READY_FOR_REVIEW` |
| Descriptor-level shared constraints | `READY_FOR_REVIEW` |
| Authority exclusions | `READY_FOR_REVIEW` |

`DESCRIPTOR_AUTHORITY_PREREQUISITE_READY_FOR_SINGLE_ARCHITECTURE_REVIEW`

This is readiness for review, not prerequisite acceptance.

## 16. Authorization State

| State | Count |
| --- | ---: |
| Authority-input resolution proposal | 1 |
| Authority-input resolution accepted | 1 |
| B01 authority resolution accepted | 1 |
| B02 authority resolution accepted | 1 |
| B03 authority resolution accepted | 1 |
| B04 authority resolution accepted | 1 |
| B05 authority resolution accepted | 1 |
| B06 authority resolution accepted | 1 |
| B07 authority resolution accepted | 1 |
| B08 authority resolution accepted | 1 |
| B01–B08 authority inputs resolved | 1 |
| Descriptor-authority prerequisite proposed | 1 |
| Descriptor-authority prerequisite accepted | 0 |
| Descriptor implementation authorization | 0/0 |
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

## 17. Production Boundary

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
