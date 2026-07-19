# K-333C — Deferred Evidence Layer Source-Facts Audit and Contract Selection

## 1. Executive verdict

**Selection: `NEEDS_PRECURSOR_CONTRACT`.** The desired next layer is reviewed-manifest membership, but it cannot safely be represented as a transaction-level membership record yet. The repository has a precise, immutable, physical-source-bound `ReviewedWriterManifest` architecture contract, but K-333A/B production records retain only an opaque `manifestDigest`; they do not carry the reviewed entry, context, or capability material needed to prove membership. The smallest safe precursor is therefore a canonical production representation of the existing **`ReviewedWriterManifest`** contract, not a newly named membership record and not a change to K-333A/B.

This is a source-facts audit only. It adds no codec, schema, repository, store, source transaction, runtime caller, writer registration, proof implementation, or eligibility path.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Merged predecessor baseline

K-333B merged through PR #592. Its final branch head was `053eb3e90ce14b550d2c8304b6f1e2bb53576e18`; merge commit `6e8f5796ab603d20e9e26ad74acf22c269fe1b74` is the current audit base.

The merged production protocol establishes strict v1 `WriterIdentityRecord`, `WriterSessionRecord`, `SourceAuthorityRecord`, `SourceTransactionReferenceRecord`, `OperationRecord`, `AdmissionRecord`, immutable outbox intent, and terminal state records. K-333B keeps receipts, compacted projections, lifecycle lineage, MMR/checkpoint proofs, bootstrap/restore, and manifest membership deferred. See [K-333B](K-333B-production-transaction-evidence-records.md#manifesttype-membership-contract) and [K-333B](K-333B-production-transaction-evidence-records.md#remaining-k-333-work) (merged reviewed architecture, descriptive/normative boundary).

## 3. Source authority hierarchy

| Rank | Source | Authority | Facts used here |
|---:|---|---|---|
| 1 | `frontend/src/lib/localDatabase/protocol/writerAuthorityProtocol.ts:26-126, 196-408` and `transactionEvidenceProtocol.ts:370-539` | Production code and permanent tests | Exact current record fields, opaque pointer fields, self-digests, strict v1 decoding, and representative one-record roots. |
| 2 | `frontend/docs/K-333A-canonical-production-protocol-foundation.md`, `K-333B-production-transaction-evidence-records.md:78-159` | Merged reviewed architecture | K-333 scope, explicit manifest-membership deferral, no multi-record proof extrapolation, dormant boundary. |
| 3 | `frontend/docs/K-329-writer-coordination-eligibility-preconditions.md:15-30, 74-109`; `writerCoordinationEligibility.ts:122-190, 475-532, 704-710` | Merged reviewed architecture plus deterministic model | Reviewed manifest identity, fixed ordering, exact 30-entry inventory, physical-source binding, canonical digest and authority reconstruction. It is architecture evidence, not a production K-333 codec. |
| 3 | `frontend/docs/K-331-production-writer-instrumentation-admission-integration.md:1433-1457, 1614-1650, 1668-1728`; `productionWriterAdmissionK331G.testSupport.ts:1-35, 199-230, 392-593, 1113-1163` | Merged test-support contract | Receipt, projection, lifecycle, checkpoint, MMR, bootstrap, and restore semantics; explicitly test-support/architecture only. |
| 3 | `frontend/docs/K-332-cross-module-source-authority-protocol-contract.md:113-180, 248-337`; `crossModuleSourceAuthorityK332.testSupport.ts:1-10, 64-83, 125-171` | Merged cross-module contract | Protocol-before-repository ownership and fixture/non-production boundary. |
| 4 | `frontend/docs/K-330-dormant-writer-registry-admission-foundation.md:16-18, 98-166`; `dormantWriterCoordinationRepository.ts:27-30, 703-759` | Existing dormant persistence constraint | K-330 is a separate, capability-gated coordination envelope; it is not the source receipt/proof registry required by deferred candidates. |

No higher-authority source conflicts with this conclusion. Lower-authority fixture names and domains are not treated as final production names or formats where K-333A/B has not adopted them.

## 4. Search inventory

Repository-wide searches covered: `manifestDigest`, `reviewed manifest`, `membership`, `receipt`, `projection`, `compacted projection`, `lifecycle`, `epoch`, `generation`, `operationRegistryRoot`, `terminalRoot`, `outboxRoot`, `MMR`, `Merkle`, `checkpoint`, `inclusion`, `consistency`, `accumulator`, `registry`, `source revision`, `committed revision`, `transaction reference`, `proof`, `witness`, `admission`, `terminal`, `outbox`, `restore`, `bootstrap`, `migration`, `attachment`, and `eligibility`.

Inspected material includes K-329 through K-333B documents, K-329/K-330 source and tests, K-331G test support, K-332 test support, K-333A/B production protocol modules and tests, recovery/local-database boundaries, and protocol package configuration.

Meaningful no-result findings in current production protocol modules:

- no `absinthe_raw_source_receipt`, compacted projection, lifecycle-event, segment-checkpoint, or MMR-state decoder exists under `frontend/src/lib/localDatabase/protocol/`;
- no production manifest-membership record or production Merkle/inclusion/consistency-proof verifier exists there;
- `SourceAuthorityRecord` and `SourceTransactionReferenceRecord` carry MMR/checkpoint/lifecycle IDs and digests only (`writerAuthorityProtocol.ts:55-95, 201-208`);
- `transactionEvidenceProtocol.ts:415-434` defines only one-record representative root formulas, not a collection-root or proof contract.

## 5. Candidate audit matrix

| Candidate | Existing structure and intended meaning | Binding / digest facts | Dependency and risk | Verdict |
|---|---|---|---|---|
| Reviewed-manifest membership | Prove a writer type/context/capability was permitted by a reviewed source policy. | Manifest has physical-source binding and canonical digest; production writer has only `writerTypeId` and opaque `manifestDigest`. | Needs canonical manifest payload plus context/capabilities to validate a membership assertion. | **PARTIALLY_DEFINED** |
| Raw operation receipt | Immutable proof that a source transaction committed a revision. | K-331G fixture has receipt, reference, checkpoint, proof, and digest fields. | Verification resolves an authority graph and proof material by durable lookup. | **REQUIRES_PERSISTENCE / REQUIRES_PROOF_LAYER** |
| Compacted authority projection | Retained authenticated substitute after raw receipt compaction. | K-331G binds original receipt, checkpoint, proof, and compaction boundary. | Cannot be authoritative before raw receipt, checkpoint/MMR, and repository compaction semantics. | **REQUIRES_PERSISTENCE / REQUIRES_PROOF_LAYER** |
| Lifecycle evidence | Tombstone/resurrection predecessor chain and current head. | K-331G fixture defines event/head digests; production authority exposes only nullable head pointer. | Requires per-identity durable lineage and authoritative update ordering. | **REQUIRES_PERSISTENCE** |
| Operation registry proof | Multi-operation membership under `operationRegistryRoot`. | Production only derives a one-operation root. | Ordering, empty/multi-leaf, duplicate and proof semantics absent from production. | **REQUIRES_PROOF_LAYER** |
| Terminal registry proof | Multi-terminal membership under `terminalRoot`. | Same one-record limitation. | Same collection/proof semantics absent. | **REQUIRES_PROOF_LAYER** |
| Outbox registry proof | Multi-intent membership under `outboxRoot`. | Same one-record limitation. | Same collection/proof semantics absent. | **REQUIRES_PROOF_LAYER** |
| MMR inclusion/consistency proof | Bounded historical receipt membership/append consistency. | K-331G fixture specifies bounded proof concepts and K-331 architecture chooses segment/MMR mechanics. | Fixture uses test-support records/readers; no production state or verifier is adopted. | **REQUIRES_PROOF_LAYER / REQUIRES_PERSISTENCE** |
| Checkpoint evidence | Seal receipt segment and bind a source authority MMR state. | Fixture fields and v1 digest exist in test support. | Requires append/seal transaction, ordering, and durable predecessor. | **REQUIRES_PERSISTENCE** |
| Bootstrap/restore evidence | Bound initial/restore graph finalization. | K-331 test support has detailed segment/accumulator/manifest fixtures. | Explicitly requires future stores and lookup finalization. | **REQUIRES_PERSISTENCE** |
| Attachment classification evidence | Separate canonical attachment authority from operational transfer state. | K-331G fixture classification exists. | Depends on future canonical attachment authority store and record selection. | **PARTIALLY_DEFINED / REQUIRES_PERSISTENCE** |

## 6. Reviewed-manifest membership audit

### Established facts

`ReviewedWriterManifest` is an existing source-grounded structure: `kind`, schema/byte-format v1, `physicalSourceDigest`, `manifestVersion`, and sorted `entries` (`writerCoordinationEligibility.ts:131-138, 441-443, 475-521`). Each entry fixes `writerTypeId`, sorted context types, sorted required capabilities, authority role, coordination requirement, and a nullable exclusion proof code (`writerCoordinationEligibility.ts:122-129, 483-506`). `ReviewedManifestAuthority` fixes the authority ID, manifest version, physical source, `manifestDigest`, and entry count and verifies the digest by reconstructing that exact manifest (`writerCoordinationEligibility.ts:182-191, 524-532, 704-710`).

This establishes a fixed-order, immutable policy snapshot: entry reorder, role/context/capability change, count change, version change, or physical-source change fails (`frontend/docs/K-329-writer-coordination-eligibility-preconditions.md:15-30`, merged reviewed architecture). It is source-specific and versioned, but it has no namespace, generation, writer instance ID, session, validity interval, epoch, record ID, or self-digest field of its own. `manifestDigest` is a digest of canonical manifest bytes including physical source, not a manifest membership proof.

K-333A `WriterIdentityRecord` contains `namespaceId`, physical source, `writerTypeId`, and `manifestDigest`, while `WriterSessionRecord` contains generation, writer binding, epoch, and only an opaque `capabilityDigest` (`frontend/src/lib/localDatabase/protocol/writerAuthorityProtocol.ts:26-47, 111-115, 196-220`, production code). It does not carry a context type or a canonical capability set that can be checked against a manifest entry. K-333B therefore correctly calls membership an explicit deferred relationship (`frontend/docs/K-333B-production-transaction-evidence-records.md:78-80`, merged reviewed architecture).

### Missing facts for membership

The repository does not yet define a production membership record ID, membership self-digest, membership timing/revision, historical manifest retention rule, direct membership proof, or a production graph rule joining entry context/capabilities to K-333A writer/session records. A caller-supplied manifest lookup or boolean would violate K-332's rule that caller truth is not authority (`frontend/docs/K-332-cross-module-source-authority-protocol-contract.md:248-275`, merged reviewed architecture).

### Minimal precursor

The next contract must be a production canonical representation of the existing **`ReviewedWriterManifest`** semantics, with no renamed or expanded policy:

| Element | Source-grounded precursor rule |
|---|---|
| Authoritative name | `ReviewedWriterManifest` (existing K-329 symbol). |
| Purpose | Canonically decode the exact reviewed policy snapshot whose digest is already carried by `WriterIdentityRecord`. |
| Fields | Existing fields only: `kind`, version fields, `physicalSourceDigest`, `manifestVersion`, ordered entries; entry fields exactly as above. |
| Digest | Reuse the existing manifest canonical-digest meaning; do not add a new self-digest field without a separate source fact. |
| Version | Existing K-329 manifest and byte-format v1 are the only defined source facts; unknown versions fail closed. |
| Construction | fixed reviewed entry source -> canonical manifest -> derived manifest digest -> existing writer identity may bind that digest. |
| Compatibility | No K-333A/B compatibility edge can be added until a following membership graph supplies context/capability evidence. |
| Tests | exact ordering/count; source binding; entry mutation/reordering rejection; digest round trip; writer `manifestDigest` equality only; no membership claim. |

It remains payload-free with respect to Notes and remains dormant. A later membership contract may bind this manifest, a writer identity/session, and independently represented context/capabilities, but those fields must first be selected from source facts.

## 7. Receipt audit

The repository distinguishes, rather than collapses, these meanings:

| Meaning | Source fact | Status |
|---|---|---|
| Admission evidence | K-333B `AdmissionRecord` binds admitted decision, operation, writer/session, and exact-operation commitment. | Production canonical record; not a commit receipt. |
| Terminal evidence | K-333B `TerminalStateRecord` binds committed result and exact-operation commitment. | Production canonical record; not a durability proof. |
| Source receipt | K-331 calls for an immutable source receipt and source-revision lineage (`frontend/docs/K-331-production-writer-instrumentation-admission-integration.md:1435-1442, 1625-1631`, merged test-support architecture). | Architecture/test support only. |
| Raw source receipt | K-331G fixture type carries transaction reference, operation, committed revision, checkpoint coordinate, proof bytes, and receipt digest (`productionWriterAdmissionK331G.testSupport.ts:220-226, 392-405`). | Requires durable graph/proof verification. |
| Compacted projection | Fixture retains original receipt digest, checkpoint/proof coordinate, and compaction boundary (`frontend/src/lib/localDatabase/productionWriterAdmissionK331G.testSupport.ts:228-230, 405-421`, test support). | Derived retention evidence; cannot precede raw receipt semantics. |
| Remote acknowledgement / user-visible success | K-331 separates local source commit from asynchronous remote delivery (`frontend/docs/K-331-production-writer-instrumentation-admission-integration.md:1446-1455`, merged test-support architecture). | Operational/UI meaning; not selected as source authority. |

`verifyRawReceipt` and `verifyCompactedProjection` resolve records through an `AuthorityReader`, then verify graph and proof material (`productionWriterAdmissionK331G.testSupport.ts:452-593`). Therefore they are not standalone production codecs that can safely be selected before K-334 lookup semantics.

## 8. Projection audit

Compacted authority projection is not a mutable UI cache in K-331's selected architecture: it is a derived, authenticated retention product that may replace raw receipt detail only after membership is recomputed and an atomic compaction transaction commits (`frontend/docs/K-331-production-writer-instrumentation-admission-integration.md:1160-1198`, merged test-support architecture). Nonetheless it is not independently ready: its trust derives from raw receipt, checkpoint, MMR state, source authority, terminal/outbox graph, and a compaction boundary. It has no production implementation or durable source store. Treating it as an immediate immutable authority record would skip exactly those predecessor contracts.

Ordinary view/UI projections and attachment operational state remain derived/mutable and excluded from authority; K-331 explicitly separates canonical attachment authority from transfer/cache observations (`frontend/docs/K-331-production-writer-instrumentation-admission-integration.md:1200-1228`, merged test-support architecture).

## 9. Lifecycle audit

Production `SourceAuthorityRecord` currently enforces only that lifecycle head ID and digest are both null or both present (`writerAuthorityProtocol.ts:55-65, 236-245, 309-318`). It does not define event kinds, predecessor order, per-identity scope, or head resolution.

K-331G fixture semantics define a tombstone/resurrection event and a head, then resolve the predecessor chain by durable reader (`productionWriterAdmissionK331G.testSupport.ts:204-209, 326-354, 598-656`). These are useful source facts, but remain test-support semantics requiring a persistent lineage store. No production lifecycle state machine is selected by this audit.

## 10. Root and proof audit

K-333B production functions derive only a representative one-record SHA-256 root for operation, terminal, and outbox (`frontend/src/lib/localDatabase/protocol/transactionEvidenceProtocol.ts:415-434`) and compare those values in the public graph (`frontend/src/lib/localDatabase/protocol/transactionEvidenceProtocol.ts:498-526`). The merged document explicitly prohibits extrapolating those formulas into a general collection/Merkle/MMR contract (`frontend/docs/K-333B-production-transaction-evidence-records.md:96-102`, merged reviewed architecture).

K-331G fixture code has a bounded proof encoding, segment/MMR fixture decoders, and independent graph resolution (`frontend/src/lib/localDatabase/productionWriterAdmissionK331G.testSupport.ts:225-230, 538-593, 1113-1163`, test support). K-331 architecture defines a 64-receipt segment and bounded MMR proof design, but also assigns append/seal/compact persistence to K-334 (`frontend/docs/K-331-production-writer-instrumentation-admission-integration.md:1120-1198, 1644-1650`, merged test-support architecture). No production canonical leaf ordering, empty root, multi-leaf root, duplicate rule, inclusion proof, or consistency proof is adopted in K-333A/B. All root/proof candidates remain deferred.

## 11. Dependency graph

```text
WriterIdentity(manifestDigest, writerTypeId)
  + WriterSession(generation, epoch, capabilityDigest)
  + [ReviewedWriterManifest precursor: policy entries + physical source + digest]
  -> future MembershipRecord (requires context/capability representation)

Writer/Session/Authority/Reference/Operation/Admission/Outbox/Terminal
  -> RawReceipt -> SegmentCheckpoint -> MMRState -> SourceAuthority/Reference
  -> CompactedProjection

SourceAuthority(lifecycle head pointer) -> LifecycleHead -> LifecycleEvent chain
```

Edges from current production records are ID, self-digest, namespace/generation, physical-source, authority, revision, and root-pointer edges. The receipt/projection/lifecycle downstream edges require persistent lookup; receipt/projection also require proof verification. No cycle is introduced by the selected manifest precursor because it exposes the already-derived manifest digest before a later writer membership assertion. A membership record that tried to derive the manifest from the writer record would be circular or caller-authoritative and is rejected.

## 12. Threat model

| Threat | Existing protection | Missing binding / consequence |
|---|---|---|
| Same-ID different-content replay | K-333 self-digests and exact-operation digest reject selected record tampering. | Future membership needs manifest-content and context/capability binding. |
| Stale generation/session replay | Session/reference/operation bind generation, writer/session and epoch. | Manifest itself has no generation/session timing. |
| Cross-source / cross-manifest reuse | Writer identity binds physical source and manifest digest. | Digest alone does not show the supplied policy entry permits the writer. |
| Cross-graph mixing | K-333B validates representative graph and nine compatibility edges. | Receipt/projection need durable graph and proof linkage. |
| Root or proof substitution | Representative roots bind one selected record. | Multi-record/proof semantics are not production-defined. |
| Lifecycle rollback | Pointer pair is structurally checked. | Event predecessor/sequence and durable current head are absent in production. |
| Projection substitution | K-331G fixture binds a compaction boundary. | No production raw receipt, checkpoint/MMR, or atomic compaction store. |
| Unknown version | K-333 v1 decoders fail closed. | Candidate records have only test-support versions until adopted. |

## 13. Version and compatibility audit

Current production record versions are closed v1, with fixed K-333B compatibility edges. `ReviewedWriterManifest` source facts define schema/byte-format v1 and a manifest version, but no K-333 production envelope or compatibility edge. The precursor can define strict unknown-version rejection and digest equivalence; it must not extend the K-333A/B compatibility tables because no transaction membership relationship exists yet.

Raw receipt, projection, lifecycle, checkpoint and MMR fixture versions are v1 in K-331G, but their relationship version matrix is explicitly test support (`productionWriterAdmissionK331G.testSupport.ts:1113-1163`). That is insufficient to add production compatibility entries without selecting a proof/lookup contract.

## 14. Persistence and runtime boundary

| Candidate | Pure decode possible now | Durable lookup/proof needed for authoritative validation | Runtime/persistence effect if implemented now |
|---|---:|---:|---|
| Existing ReviewedWriterManifest precursor | Yes | No for record-local canonical validation; later historical retention is K-334 work. | None; dormant codec only. |
| Membership record | No | Yes, unless a canonical manifest and context/capability evidence are represented first. | Must remain dormant after precursor. |
| Raw receipt / projection | Record-local fixture decode only | Yes | Requires K-334 receipt/checkpoint/MMR stores and transaction. |
| Lifecycle | Record-local fixture decode only | Yes | Requires durable per-identity chain/head. |
| Registry/MMR/checkpoint proof | No complete production verifier | Yes | Requires proof and persistent collection state. |

K-332 assigns canonical protocol representation to K-333 and persistence/atomic lookup to K-334 (`frontend/docs/K-332-cross-module-source-authority-protocol-contract.md:248-275`, merged reviewed architecture). This audit makes no source eligible and adds no runtime consumer.

## 15. Candidate ranking

1. **Reviewed-manifest membership, after the existing ReviewedWriterManifest precursor** — highest security value and lowest new semantics; exact policy fields/order/digest are already source-grounded.
2. Raw receipt — strong authority value but inseparable from a durable graph and proof material.
3. Lifecycle event/head — field concepts exist but require durable lineage and per-identity ordering.
4. Segment checkpoint/MMR proof — necessary for historical receipt proof, but collection and persistence dependent.
5. Compacted projection — strictly downstream of receipts and proof.
6. Bootstrap/restore and attachment classification — broader persistence/authority surfaces; not next minimal layer.

## 16. Selected outcome

`NEEDS_PRECURSOR_CONTRACT`

Desired candidate: reviewed-manifest membership.

Required first: a production canonical representation of the existing `ReviewedWriterManifest` contract. Implementing membership first would either accept a caller-provided policy lookup/boolean, embed undefined context/capability semantics, or add unsupported historical/persistence behavior. Each violates K-332 fail-closed ownership.

## 17. Next-task acceptance criteria

The precursor task may proceed only if it:

1. reuses the existing `ReviewedWriterManifest` field inventory and fixed ordering exactly;
2. derives and validates the existing manifest digest meaning and physical-source binding;
3. uses strict canonical bytes, unknown-field rejection, bounded errors, v1-only decoding, and no added policy fields;
4. does not change `WriterIdentityRecord`, `WriterSessionRecord`, K-333B records, roots, or compatibility edges;
5. contains no store, repository, lookup, transaction, runtime import, writer registration, or eligibility path;
6. makes no membership assertion until a separately reviewed context/capability binding exists;
7. proves no production source becomes eligible.

## 18. Explicit non-goals

No production codec is implemented here. This audit does not implement membership, receipts, projection, lifecycle, checkpoint, MMR/Merkle proof, bootstrap, restore, attachment authority, persistence, K-334, source mutation, remote delivery, source eligibility, or activation.

## 19. Validation evidence

This document was derived from merged main at `6e8f5796ab603d20e9e26ad74acf22c269fe1b74`, including PR #592 merged state and the cited source/test-support contracts. Validation for this documentation-only change is recorded with the K-333 protocol suite, K-332 and K-331 focused tests, TypeScript typecheck, production build, and `git diff --check`.

## 20. Residual risks

- The existing reviewed manifest is a code-reviewed policy snapshot, not a retained historical production manifest store.
- K-333A session capability material is opaque, so it cannot yet establish manifest capability membership.
- K-331 receipt/proof/lifecycle fixtures are rich architecture evidence, but they do not replace K-334 durable lookup and atomicity evidence.
- No real-browser, multi-context, crash, quota/eviction, mixed-version, or production source-transaction evidence exists.

## 21. Production boundary

No schema version, store/index, migration, repository, durable transaction, source commit wiring, runtime consumer, eligibility mechanism, or activation is added.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
