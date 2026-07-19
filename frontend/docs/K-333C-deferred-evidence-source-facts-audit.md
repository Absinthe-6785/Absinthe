# K-333C - Deferred Evidence Source-Facts Audit and Cross-Protocol Boundary

## 1. Executive verdict

**Selection: `NEEDS_PRECURSOR_CONTRACT`.** K-329 already owns the existing canonical `ReviewedWriterManifest` codec. K-333 must reuse that codec unchanged and must not create a competing manifest record, ID, schema, or self-digest. What remains unresolved is the source-authorized cross-protocol meaning of binding K-333 writer/session evidence to a specific K-329 manifest entry.

The next work is a focused source-authority contract-definition audit, not a manifest-codec implementation. It must determine whether a K-333 writer/session can be authoritatively matched to K-329 context/capability policy without inventing membership, authorization, persistence, or eligibility semantics.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Merged predecessor baseline

K-333B merged through PR #592. Its branch head was `053eb3e90ce14b550d2c8304b6f1e2bb53576e18`; merge commit `6e8f5796ab603d20e9e26ad74acf22c269fe1b74` is this audit's base.

K-333A/B provide dormant strict v1 writer, session, authority, transaction-reference, operation, admission, outbox, and terminal records. They preserve K-329 reviewed policy ownership and explicitly defer membership, receipts, projections, lifecycle lineage, MMR/checkpoint proofs, bootstrap/restore, and attachment authority. See `frontend/docs/K-333B-production-transaction-evidence-records.md:5-7,20,78-80,148-155`.

## 3. Correct source-authority hierarchy

| Rank | Source class | Use in this audit |
|---:|---|---|
| 1 | Merged production protocol and canonical-codec code plus permanent tests | Exact K-329 manifest fields, validation, canonical bytes, digest behavior, and K-333 record fields. |
| 2 | Merged reviewed architecture/source-facts documents | Ownership boundaries, K-333 scope, and explicit deferrals. |
| 3 | Reviewed test-support contracts | Receipt, projection, lifecycle, checkpoint, MMR, bootstrap, restore, and attachment concepts not adopted as production codecs. |
| 4 | Dormant persistence structures | K-330 coordination-envelope limits only. |
| 5 | Historical/speculative material | Not authoritative for a new record or binding. |

`frontend/src/lib/localDatabase/writerCoordinationEligibility.ts:122-138,475-521,694-723` is an existing implemented canonical coordination-policy codec, with permanent coverage in `writerCoordinationEligibility.test.ts:205-260,1026-1029`. It is authoritative for the manifest's exact contract, but is neither a K-333 transaction record nor proof of K-333 membership. K-333B preserves this ownership rather than redefining it (`K-333B-production-transaction-evidence-records.md:20,80`).

## 4. Search inventory and absence boundary

Repository searches covered `manifestDigest`, `ReviewedWriterManifest`, membership, writer membership, capability, context, physical source, receipt, projection, compaction, lifecycle, roots, MMR, checkpoint, proof, bootstrap, restore, attachment authority, eligibility, and activation.

The production K-333 protocol contains no membership record, manifest-entry decoder, membership proof, cross-protocol compatibility edge, or verifier that joins a K-333 writer/session to a K-329 manifest entry. This is a scoped absence finding for `frontend/src/lib/localDatabase/protocol/`; K-329's existing manifest codec is intentionally outside that module and remains the owner.

## 5. Candidate audit matrix

| Candidate | Existing source fact | Readiness / missing authority |
|---|---|---|
| K-329 manifest canonical codec | Exact validator, canonical encoder/decoder, source binding, and content digest exist. | **EXISTING / READY / OWNED_BY_K329**; reuse unchanged. |
| Manifest content digest | SHA-256 over K-329 canonical manifest bytes. | **EXISTING**; content reference only. |
| K-333 manifest reference | `WriterIdentityRecord.manifestDigest` is a strict digest field. | **EXISTING_BUT_OPAQUE**; K-333 does not decode a manifest or prove membership. |
| K-333 membership semantics | K-329 entries contain type/context/capability policy; no K-333 entry relation exists. | **BLOCKED_BY_MISSING_AUTHORITY** for implementation. |
| Cross-protocol binding | No authoritative field/edge selects one K-329 entry for a K-333 writer/session. | **MISSING_AUTHORITY**; source-authority definition is needed. |
| Raw receipt | K-331G test support has receipt/proof concepts. | Requires persistent graph lookup and proof verification. |
| Compacted projection | K-331 describes authenticated downstream compaction. | Requires receipt, checkpoint/MMR, and atomic compaction. |
| Lifecycle evidence | K-333 authority has only a paired nullable head pointer. | Requires durable event chain and resolution. |
| Registry roots | K-333B derives representative one-record roots only. | Requires multi-record root/proof semantics. |
| MMR/checkpoint | K-331 test support defines concepts only. | Requires persistence, append/seal, and verifier. |
| Bootstrap/restore | Existing recovery material is not K-333 authority evidence. | Requires historical durable-state contract. |
| Attachment classification | K-331 test support separates authority from transfer state. | Requires canonical authority-store decision. |

## 6. Existing K-329 ReviewedWriterManifest contract

`ReviewedWriterManifest` has exactly `kind`, `schemaVersion`, `byteFormatVersion`, `physicalSourceDigest`, `manifestVersion`, and `entries` (`writerCoordinationEligibility.ts:131-138,441-443`). Each entry has `writerTypeId`, `contextTypes`, `requiredCapabilities`, `authorityRole`, `coordinationRequirement`, and `exclusionProofCode` (`writerCoordinationEligibility.ts:122-129,440-442`).

The validator rejects extra/missing fields and requires `kind: 'absinthe_reviewed_writer_manifest'`, `schemaVersion: 1`, `byteFormatVersion: 1`, `manifestVersion: 'k329b-source-reviewed-v1'`, a physical-source digest, and a non-empty bounded entry list (`writerCoordinationEligibility.ts:6-12,475-506`). Entries are strictly increasing by `writerTypeId`; context and capability arrays are sorted and unique. `orderedManifest`, `encodeReviewedWriterManifestCanonical`, and `decodeReviewedWriterManifestCanonical` provide deterministic canonical bytes and strict decoding (`writerCoordinationEligibility.ts:509-515,660-697`).

`physicalSourceDigest` is part of canonical content. The creator uses the reviewed frozen entry inventory (`writerCoordinationEligibility.ts:174-179,517-521`). There is no standalone manifest ID, creation time, namespace, generation, session, writer-instance binding, persistent replacement, or supersession protocol. `ReviewedManifestAuthority.authorityId` is an authority identifier, not a manifest ID (`writerCoordinationEligibility.ts:182-191,702-706`).

## 7. Manifest digest classification

`deriveReviewedWriterManifestDigest` computes SHA-256 from the K-329 canonical manifest bytes (`writerCoordinationEligibility.ts:694-700`). It is a **content digest**, not a K-333 canonical-record self-digest and not independently declared as a standalone manifest identity.

`WriterIdentityRecord` carries a syntactically strict `manifestDigest` alongside `writerTypeId`; its creator and decoder validate only digest syntax plus the writer record's own self-digest (`frontend/src/lib/localDatabase/protocol/writerAuthorityProtocol.ts:26-35,110-112,196-217,274-280`). K-333 does not re-decode K-329 manifest content from that value, prove that the digest selects an entry, or prove a writer/session is a member.

Any future distinct record self-digest is an independently authorized future decision. It is not selected or proposed here.

## 8. Cross-protocol binding gap

| Question | Current classification |
|---|---|
| K-333 field matched to K-329 `writerTypeId` | Partially defined: both carry type identifiers, but no authoritative cross-protocol equality rule exists. |
| K-333 writer ID versus K-329 writer identity | Absent. |
| Canonical context evidence for the bridge | Absent. |
| Canonical capability evidence for the bridge | Absent; K-333 has only opaque `capabilityDigest`. |
| Writer-, session-, operation-, or role-scoped membership | Requires owner decision. |
| Namespace/generation effect on membership | Requires owner decision. |
| Manifest-digest content reference versus decoded material | Partially defined; content digest exists, membership use is absent. |
| Historical resolution, supersession, revocation | Absent; future persistence/authority decision. |
| Direct comparison versus membership evidence record | Requires owner decision. |
| Admission, transaction authorization, or eligibility consequence | Absent; no implementation may infer one. |

These missing facts prevent a membership codec, binding record, or compatibility edge from being implemented safely.

## 9. Manifest and membership separation

1. **Manifest representation:** existing K-329 canonical reviewed policy content.
2. **Manifest content digest:** SHA-256 over those K-329 canonical bytes.
3. **K-333 manifest reference:** `WriterIdentityRecord.manifestDigest`.
4. **Membership evidence:** not currently defined.
5. **Session capability/context evidence for this bridge:** not canonically defined.
6. **Transaction authorization:** not established by a valid manifest digest.
7. **Eligibility:** remains false.

K-333 manifest representation is not missing. K-333 membership and cross-protocol authority binding are missing.

Decoding a manifest does not prove membership; matching a digest does not prove an entry was selected; a valid writer record does not establish authorization.

## 10. Receipt, projection, lifecycle, and proof boundaries

K-333B `AdmissionRecord` and `TerminalStateRecord` are not durable source receipts. K-331's raw-receipt and compacted-projection concepts require an authority reader, durable graph lookup, and proof material (`productionWriterAdmissionK331G.testSupport.ts:220-230,452-593`; `K-331-production-writer-instrumentation-admission-integration.md:1120-1198,1435-1455`).

`SourceAuthorityRecord` currently validates only the paired nullability of `lifecycleHeadId` and `lifecycleHeadDigest`; it defines no lifecycle event, predecessor, ordering, or durable resolver (`writerAuthorityProtocol.ts:55-66,236-245,309-318`). K-333B's operation, terminal, and outbox roots are representative one-record formulas, not a multi-record registry/Merkle/MMR contract (`transactionEvidenceProtocol.ts:415-434,498-526`; `K-333B-production-transaction-evidence-records.md:96-102`).

## 11. Dependency graph

```text
K-329 ReviewedWriterManifest canonical bytes
  -> K-329 manifest content digest
  -> K-333 WriterIdentityRecord.manifestDigest

K-333 WriterIdentityRecord / WriterSessionRecord
  -X-> authoritative relation to a specific K-329 manifest entry (missing)

Potential future, not authoritative:
writer/session -> manifest entry -> admission/transaction authorization
membership -> source authority / transaction reference

K-333 evidence graph -> receipt -> checkpoint/MMR -> projection (persistence/proof deferred)
SourceAuthority lifecycle pointer -> lifecycle chain (persistence deferred)
```

Reusing K-329 introduces no digest cycle. The missing membership edge, history, persistence, and proof semantics must not be inferred from the content digest.

## 12. Threat model

The existing K-329 codec protects exact canonical manifest content, ordering, physical-source binding, and unknown-version rejection. It does not close these unresolved threats:

- a valid manifest digest paired with the wrong K-333 writer or session;
- cross-writer entry reuse, stale context, or stale session capability;
- cross-source or stale-generation reuse in a future bridge;
- superseded-manifest reuse or absent historical lookup;
- cross-graph membership mixing;
- valid manifest content combined with an unauthorized operation; and
- valid K-333 self-digests without manifest-entry membership.

A future K-333-to-K-329 binding and membership policy must address these. Historical lookup and proof requirements remain future persistence/authority decisions; eligibility/admission must remain disabled until then.

## 13. Version and compatibility boundary

K-329 authoritative facts are `schemaVersion: 1`, `byteFormatVersion: 1`, and `manifestVersion: 'k329b-source-reviewed-v1'`. K-333 records have separate strict v1 contracts. No production version exists for a K-333 membership record, cross-protocol compatibility edge, entry binding, capability/context evidence, supersession, or historical resolution.

K-333C adds no version, schema, compatibility-table entry, or manifest record.

## 14. Corrected selection decision

`NEEDS_PRECURSOR_CONTRACT`

The precursor is a focused **source-authority contract-definition audit** for the missing K-333-to-K-329 adoption/binding semantics. It is not an implementation task and not a new manifest representation. If that audit cannot source an exact bridge field inventory and authority relation, the next decision must be `BLOCKED_BY_MISSING_AUTHORITY` rather than an invented codec.

## 15. Protocol test attribution

The focused failing test is `rejects selector and loop-structure mutations in bounded source fixtures`. It reproduces on this branch and on base `6e8f5796ab603d20e9e26ad74acf22c269fe1b74`; `transactionEvidenceProtocol.ts` and its test have identical blobs at both revisions.

Both local checkouts use CRLF source text. The mutation fixture searches for an LF-only anchor: the LF anchor is absent and the CRLF anchor is present. Exact-head CI test jobs pass. The local protocol suite therefore remains 92/93 under this checkout, classified as:

`ENVIRONMENT_SENSITIVE_NON_BLOCKING`

K-333C1 makes no source/test correction. A later portability fix may be considered separately.

## 16. Validation and production boundary

This documentation-only correction is validated with the K-332 and K-331 focused suites, the K-333 protocol suite, TypeScript typecheck, production build, and `git diff --check`. Exact-head CI is inspected after push.

No codec implementation, record schema, database/store/index, migration, repository, durable transaction, runtime caller, writer registration, source interception, eligibility, activation, or K-334 work is added.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
