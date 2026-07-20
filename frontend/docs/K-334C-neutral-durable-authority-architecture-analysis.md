# K-334C - Neutral Durable Authority Architecture Analysis

## 1. Executive Verdict

K334C_NEUTRAL_ANALYSIS_COMPLETE

This is a neutral, source-grounded architecture analysis. It translates the twelve approved K-334B policy inputs into constraints only. It does not select a final schema or authorize implementation, admission, eligibility, or activation.

## 2. Authorization Boundary

Authorized: source facts, neutral candidate models, retention, indexes, atomicity, recovery, and staged questions. Not authorized: policy-dependent finalization, schema/migration work, repository/transaction implementation, runtime callers, admission, eligibility, activation, or any production change.

The safe default is fail closed while preserving available evidence. A decoder, digest, local row, remote row, account, session, or recovery artifact is not authority.

## 3. Authoritative Inputs

| Input | Role |
|---|---|
| [K-334A audit](K-334A-durable-protocol-repository-atomicity-audit.md) | Source-fact baseline and unresolved durable-authority questions. |
| [K-334B proposal](K-334B-owner-decision-proposal-and-approval-evidence.md) | Approved decision/version/option bindings. |
| [K334B-PUB-001](K-334B-publication-record-K334B-PUB-001.md) | Published proposal identity. |
| [K334B-OWNER-EVIDENCE-001](K-334B-owner-disposition-evidence-001.md) | Twelve approved recommendations and no approved alternatives. |
| 828a684f30e8b5d447d94387ae0d5a78832376c5 | Merge commit containing K-334B. |
| K-329/K-330/K-332/K-333 contracts | Existing ownership and canonical-record boundaries. |

Bindings: D01 K334B-D01-A, D02 K334B-D02-A, D03 K334B-D03-A, D04 K334B-D04-A, D05 K334B-D05-A, D06 K334B-D06-A, D07 K334B-D07-A, D08 K334B-D08-B, D09 K334B-D09-A, D10 K334B-D10-A, D11 K334B-D11-A, and D12 K334B-D12-A. These are policy inputs, not implementation permission.

## 4. Current Source Facts

| Path and symbol | Current behavior | Architectural implication / constraint | Scope |
|---|---|---|---|
| frontend/src/lib/localDatabase/types.ts: LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION, LocalDatabaseNamespace, GenerationRecord | Defines absinthe-local-v2, version 4, namespace fields, and local generations. | Existing namespace/generation concepts constrain a future binding but are not a protocol subject, grant, or accepted history. | Dormant local-first foundation. |
| frontend/src/lib/localDatabase/schema.ts: createLocalDatabaseSchema, LOCAL_DATABASE_STORES | Nine additive v1-v4 stores include generations, entities, outbox, migration state, and writer coordination. | A future additive upgrade is possible only after separately authorized topology/version selection. | Dormant local-first foundation. |
| frontend/src/lib/localDatabase/repository.ts: openLocalDatabase | Bounds blocked opens, checks schema/version, and closes stale connections on versionchange. | Upgrade/open race handling is an implementation requirement, not authority evidence. | Dormant local-first foundation. |
| frontend/src/lib/localDatabase/activeGenerationTransition.ts: activateGenerationInTransaction | Uses one native transaction for local generation pointer, mode, and migration state. | Same-database atomicity pattern only; cannot establish K-334 authority or cross-database atomicity. | Dormant local-first foundation. |
| frontend/src/lib/localDatabase/repository.ts: commitLocalMutation | Joins local entity and outbox writes in its participating database transaction. | A future authority acceptance joined here needs separately authorized same-boundary design. | Dormant local-first foundation. |
| frontend/src/lib/localDatabase/dormantWriterCoordinationRepository.ts: DormantWriterCoordinationRepository | Persists one bounded coordination envelope under developer/test capability controls. | K-330 storage must not silently become append-only K-334 history or authority. | Dormant production foundation. |
| frontend/src/lib/localDatabase/crossModuleSourceAuthorityK332.testSupport.ts: responsibility matrix | States K-333 protocol ownership and future K-334 storage/repository ownership; helpers keep eligibility/activation false. | Test support cannot supply production authority, runtime topology, or eligibility. | Test-only. |
| frontend/src/lib/localDatabase/protocol/canonicalProtocolPreimage.ts | Produces canonical protocol preimages/digests. | K-334 may store/index evidence but must not reimplement bytes/digest semantics. | Pure protocol library. |
| frontend/src/lib/localDatabase/protocol/strictProtocolDecode.ts | Rejects malformed/unknown object shapes with stable failures. | Future boundary reads must invoke it; successful decode is not acceptance or compatibility. | Pure protocol library. |
| frontend/src/lib/localDatabase/protocol/transactionEvidenceProtocol.ts: record creators | Validates immutable K-333 operation/admission/outbox/terminal relationships from supplied records. | A durable repository may retain values but cannot infer missing graph members or redefine records. | Pure protocol library. |
| frontend/src/lib/noteIndexedDb.ts: NOTES_IDB_NAME, openNotesDb, saveNotesToIndexedDb | absinthe-notes-v1 is the current primary Notes IndexedDB database; its notes store is opened and read/written through native IndexedDB transactions. | Primary Notes state is still legacy relative to K-334 and is not a K-334 authority store. It cannot natively transact with a separate database or localStorage. | Current production legacy-primary path. |
| frontend/src/components/views/noteUtils.ts: NOTES_KEY; frontend/src/lib/notePersistence.ts: initNotesPersistence, loadNotesFromLocalStorage, saveNotesToLocalStorageResult, migrateLocalStorageNotesToIndexedDb | NOTES_KEY is notes-v2. It is the localStorage fallback: init uses it when IndexedDB is unavailable or initialization fails, and read/write paths can fall back after IndexedDB failure. Migration reads notes-v2 only through guarded legacy migration behavior. | IndexedDB primary and notes-v2 fallback are separate storage domains, not one transaction. Fallback data, recovery from it, its timestamp, and its storage location do not manufacture authority or eligibility; any later migration remains fail closed. | Current production legacy-fallback/compatibility behavior. |
| frontend/src/lib/recoverySafetyPolicy.ts: recovery mode/cutover fence | Recovery is default-active; post-cutover legacy writes fail closed; K-326 authorization is scoped. | K-334 cannot bypass recovery policy or promote cutover capability to issuer/rollback/compatibility authority. | Current safety boundary. |
| [K-334A](K-334A-durable-protocol-repository-atomicity-audit.md), sections 4-11 | Records inventory, topology limits, and supplied-record boundary. | CROSS_DATABASE_ATOMICITY_IMPOSSIBLE remains binding until an authorized topology/reconciliation design exists. | Documentation of verified source facts. |

K-329 owns ReviewedWriterManifest, k329b-source-reviewed-v1, and its SHA-256 content digest. K-330 owns the dormant coordination envelope/admission reducer. K-332 owns the cross-module split and no production activation. K-333 owns canonical envelopes, codecs, preimages, strict decoders, proofs, compatibility-related structures, and stable errors. K-334 may plan durable storage, lookup, transactional persistence, and recovery only; it must not redefine K-329/K-333 contracts.

## 5. Approved Policy Consequences

| Decision | Architecture consequence |
|---|---|
| D01 | Exact issuer-grant scope/provenance is required; no account/session/digest-derived issuer inference. |
| D02 | Rollback evidence must be independently queryable; no implied issuer flag. |
| D03 | Terminality is explicit durable evidence, never deletion, timeout, closure, or successor creation. |
| D04 | Every generation is an independent exact subject with no inherited history, authority, compatibility, mapping, or lifecycle. |
| D05 | Acceptance compares exact predecessor/successor in one linearizable boundary; order/timestamp is non-authoritative. |
| D06 | Accepted, proposed, rejected, conflict, fork, lineage, and provenance evidence need append-only retention and capacity planning. |
| D07 | A subject-scoped fork quarantine preserves all branches and selects no head. |
| D08 | A pre-acceptance conflict preserves all proposals and blocks head advance pending explicit owner resolution. |
| D09 | Compatibility is explicit allowlist evidence; decoding is insufficient. |
| D10 | New policy applies prospectively and cannot silently reclassify accepted history. |
| D11 | Provider/account/session/remote ownership requires separate mapping evidence and no generation carry-forward. |
| D12 | Only neutral analysis is complete; finalization, schema, repository, runtime, admission, eligibility, and activation remain gates. |

## 6. Conceptual Entity Model

These are conceptual entities, not final table/object-store definitions.

| Entity | Immutable identity/bindings | Lifecycle and authority boundary |
|---|---|---|
| Protocol subject | Canonical namespace, physical source, exact generation. | Retained identity; never account/session-derived. |
| Physical source and generation | Canonical descriptor/digest, provenance, exact subject reference. | Generation lifecycle is independent; no automatic continuity. |
| Accepted event | Event digest/id, subject, predecessor, sequence, policy/evidence binding, provenance. | Append-only; persisted/decoded does not alone mean accepted. |
| Proposal and rejection | Candidate/predecessor relation, bounded reason, provenance. | Retain even when rejected; proposal cannot advance head. |
| Conflict group | Subject, predecessor, competing candidates, later resolution reference. | No automatic winner. |
| Fork/quarantine evidence | Branches, shared predecessor, detection basis, subject binding. | Permanent subject-scoped fail-closed state; no head. |
| Issuer and rollback grants | Grantor, exact scope/action/lifecycle, version, provenance. | Separate evidence; generic issuer grant does not satisfy rollback. |
| Termination event | Exact generation, authority, action, provenance. | Explicit append-only terminal evidence. |
| Compatibility entry | Exact tuple, approval, applicability, provenance. | Decoder success is not compatibility. |
| External subject/issuer mapping | Provider identity, local target/scope, authority, lifecycle, provenance. | No automatic carry-forward. |
| Owner resolution | Exact conflict target, resolution action, owner evidence. | Cannot silently repair an accepted fork. |
| Commit/import/export reference | Exact evidence-set/operation or artifact digest, provenance/dependencies. | Idempotent replay support; import is not authority. |

Candidate lookup patterns are exact subject, exact predecessor, event digest, grant scope/action/lifecycle, compatibility tuple, provider identity, and conflict/fork group. Any mutable metadata must be separated from immutable evidence and revalidated.

### Subject and generation identity

Candidate A embeds a canonical composite subject in every evidence record: self-contained exports and simple equality, at the cost of repeated bytes. Candidate B retains a canonical subject record plus immutable references: lower duplication, but reference integrity and import ordering become critical. Both require K-333 canonical identifier rules, unambiguous encoding, immutable physical-source/generation binding, and collision/normalization controls. Neither is selected. The K-329 manifest is a reviewed input, not subject identity; K-330/K-333 envelopes are not external mappings.

## 7. Accepted History Model

Accepted history is a validated append-only graph constrained to one line per exact subject. A root has no accepted predecessor. A non-root event cites one exact accepted predecessor and the next allowed sequence under a later-finalized contract. The head, if needed, derives only from validated accepted history; a materialized head is rebuildable and non-authoritative.

| Condition | Required result |
|---|---|
| Exact replay | Idempotently returns existing evidence; never duplicates lineage. |
| Missing predecessor | Preserve safe candidate/provenance, but do not accept or select a head. |
| One valid next successor | May be considered only in a future authorized acceptance transaction. |
| Competing proposals | Preserve conflict; no winner and no head advance. |
| More than one accepted successor | Preserve branches, derive/mark quarantine, and derive no head. |
| Terminal generation | Requires explicit terminal evidence and retains lineage. |
| Rollback | Requires separate rollback authority and explicit placement; never implicit reactivation. |
| New policy/compatibility | Binds prospective evaluation; never silently rewrites accepted history. |

Timestamp, insertion order, latest row, digest sort order, and decoding success never establish authority.

## 8. Conflict and Fork Model

| Property | Pre-acceptance conflict (D08) | Accepted-history fork (D07) |
|---|---|---|
| Trigger | Multiple proposals against one accepted predecessor before acceptance. | More than one accepted successor for one predecessor. |
| Durable evidence | Proposals, predecessor, conflict relation, owner resolution. | All branches, predecessor, detection evidence, quarantine evidence/marker. |
| Head | Unchanged. | No authoritative head for affected subject. |
| Winner | Explicit owner resolution only. | No automatic winner; resolution does not silently repair the fork. |
| Issuance | Blocks contested transition. | Blocks state-changing issuance for affected subject. |
| Scope | Exact predecessor/subject. | Exact subject only; unrelated subjects remain unaffected. |
| Reopen/retry | Rediscover preserved conflict. | Rediscover branches/quarantine. |

A quarantine marker is only a candidate projection if recomputable from immutable accepted events and consistency-checked. Derived-only versus checked materialization remains open.

## 9. Authority and Lifecycle Model

| Class | Exact scope/evidence | Fail-closed behavior |
|---|---|---|
| Ordinary issuer | Grantor, subject/namespace, physical source, generation/scope, action, applicability, version, provenance. | Missing/mismatched/revoked/malformed evidence blocks issuance. |
| Rollback | Separate explicit grant with rollback action. | Ordinary issuer authority is insufficient. |
| Termination | Owner-authorized exact-generation event with provenance. | No timeout/deletion/session loss/successor is terminal evidence. |
| Conflict resolution | Owner evidence bound to exact pre-acceptance conflict group. | Candidate existence cannot advance history. |
| Compatibility | Explicit allowlist entry bound to exact tuple/version. | Unknown or decoded-only tuple fails closed. |
| External mapping | Authority-bound provider identity to exact subject/issuer. | Account/token/session/remote possession is not mapping evidence. |

Revocation/supersession must be explicit, retained, and prospective where policy permits. D10 prohibits retrospective silent invalidation. D04 requires each generation to be independently evidenced.

## 10. Compatibility Model

A compatibility allowlist candidate spans manifest, protocol, codec, writer type, source type, feature set, and, only if separately justified, evidence-schema version. Exact tuples are easy to audit; bounded ranges reduce entries but require canonical range semantics and more difficult historical analysis. Neither is selected.

Entries need approval provenance, applicability, and explicit supersession if later allowed. Matching majors, structural similarity, current runtime support, and decoder success are not compatibility. Unknown tuples retain input evidence but block authority-dependent use. New entries apply prospectively.

## 11. External Mapping Model

A mapping is separate durable evidence for provider-scoped external identity to exact local subject or issuer. Candidate fields are provider discriminator, canonical external identifier representation, local target, exact generation/scope, mapping authority, lifecycle/applicability, provenance, and explicit supersession/revocation.

Reconnect, token rotation, provider migration, remote ownership change, stale/missing/conflicting mappings all require evidence evaluation. Account identity is not protocol identity; provider ownership is not issuer authority; remote-object possession is not authority. Mapping-dependent issuance blocks on absence or conflict.

## 12. Evidence Retention Model

D06 requires append-only retention of accepted, proposed, rejected, competing, fork, lineage, authority, mapping, compatibility, owner-resolution, and import/export provenance evidence. Retain stable identity/digest, exact subject binding, relationship references, version binding, bounded status/reason, and provenance reference.

Costs are storage growth, browser quota pressure, larger exports, restore/replay and audit time, index rebuild cost, and review burden. Those costs do not permit silent deletion, compaction, eviction, or reinterpretation. A future retention/compaction protocol needs separate authority.

## 13. Stored Versus Derived State

| State | Classification | Constraint |
|---|---|---|
| Events, proposals, rejections, grants, termination, mappings, compatibility, owner resolutions | Immutable authoritative evidence candidate | Append-only with provenance; revalidate before use. |
| Retry receipts and bounded failures | Mutable operational metadata candidate | Cannot become authority; no raw payload/exception dependency. |
| Accepted head | Recomputable index or durable derived marker candidate | Bound/revalidated to history; never authority by itself. |
| Conflict group | Evidence-derived relation; optional marker | Preserves all candidates and chooses no winner. |
| Fork quarantine | Evidence-derived state; optional marker | Marker must agree with complete evidence and remain subject-scoped. |
| Terminal state | Derived from explicit terminal evidence; optional projection | Never absence/time/session-derived. |
| Issuer/rollback/compatibility/mapping result | Derived evaluation result | No generic or external fallback. |
| Eligibility/activation | Prohibited inferred authority / future gated output | Admission does not imply eligibility; eligibility does not imply activation. |
| In-memory cache/lock | Transient runtime state | Reconstructible, never durable authority. |

## 14. Storage and Index Candidate Matrix

No topology, database, object-store, key path, index name, or version is approved here.

| Candidate collection | Exact lookups | Need / constraint |
|---|---|---|
| Subject reference | canonical subject; physical source; generation | Resolve immutable binding; embedded versus referenced remains open. |
| Accepted-event evidence | subject+digest; subject+predecessor; subject+sequence | Rebuild line, replay, fork detection; K-333 bytes remain K-333-owned. |
| Proposal/rejection | subject+predecessor; candidate digest; conflict group | Preserve D08; never a selected-head store. |
| Fork projection | subject; shared predecessor | Fast fail-closed check only with evidence consistency. |
| Grants | scope+action+lifecycle; grant identity | Exact issuer/rollback/termination/resolution evaluation. |
| Compatibility | canonical tuple; lifecycle | D09 lookup; exact-versus-range unresolved. |
| External mappings | provider+external identity; local target | D11 lookup/conflict discovery; provider policy is open. |
| Import/export provenance | artifact digest; dependency identity | Replay/missing-dependency state; import non-authoritative. |
| Receipts/projections | operation/commit identity; subject | Retry/rebuild support; bounded/non-authoritative. |

Existing absinthe-local-v2 is a source fact, not selected K-334 topology. A dedicated DB isolates evidence but cannot natively join legacy Notes/K-328/attachment stores. Co-location may join selected local-first stores but not legacy/localStorage/remote state. Extending K-330 needs a separately reviewed contract because a bounded envelope is not unbounded history.

## 15. Atomic Operation Matrix

Every row below is conceptual only. It selects neither an API nor a store/index/key path. “Native transaction” means one later-selected IndexedDB database only; IndexedDB, notes-v2 localStorage, other databases, attachments, and remote state are not one transaction.

| Operation and policy | Preconditions and required reads | Required writes, uniqueness, authority/rejection evidence | Retry, idempotency, crash, prohibited partial state | Scope/domain, open question, future stage |
|---|---|---|---|---|
| Accept root/successor (D05) | Exact subject; validated root or exact accepted predecessor; current line and policy/compatibility evidence. | Immutable event plus predecessor relation; unique subject/predecessor successor relation; retain rejected candidate/provenance. | Key: event digest; exact replay returns same result; abort leaves no acceptance/head; never leave head without event. | Exact subject; one native transaction; sequence/CAS remains open; repository/transaction stage. |
| Preserve pre-acceptance proposal (D08) | Exact subject/predecessor and proposal identity; read competing proposals. | Immutable proposal and conflict relation; unique proposal digest; retain all competing/rejected evidence. | Key: proposal digest; replay preserves same proposal; crash cannot advance head; no selected winner without resolution. | Exact predecessor/subject; one native transaction only if selected later; conflict representation open; repository/transaction stage. |
| Detect/quarantine accepted fork (D07) | Read complete accepted successors for exact predecessor and subject. | Preserve branch evidence and optional evidence-derived quarantine marker; unique fork relation. | Key: fork evidence digest; replay rediscovers quarantine; crash cannot leave a selected head; no automatic repair/winner. | Affected subject only; native transaction cannot include other stores; marker choice open; repository/transaction stage. |
| Grant scoped issuer authority (D01) | Exact subject/source/generation/scope exists; approving authority, actions, lifecycle applicability, and policy/evidence version validate. | Immutable grant, provenance, exact scope/action/applicability; unique grant identity; retain safely retainable rejected/malformed input. | Key: grant digest; retry cannot duplicate effective grant; crash cannot create authority without grant; no broad/account/session/token-derived authority. | Exact grant scope; one selected native domain; grant lifecycle semantics open; policy finalization then repository/transaction stage. |
| Grant rollback authority (D02) | Exact subject and rollback scope; separate approving evidence validates; ordinary issuer grant is read but insufficient. | Separate immutable rollback grant/provenance; unique rollback-grant identity; retain rejection evidence. | Key: rollback-grant digest; duplicate retry idempotent; crash cannot permit rollback without it; no rollback accepted from ordinary issuer/supersession evidence. | Exact rollback scope; one selected native domain; rollback lifecycle open; policy finalization then repository/transaction stage. |
| Record explicit generation termination (D03) | Exact generation; valid owner-authorized termination evidence; read existing terminal/conflicting evidence. | Immutable termination event/provenance; unique generation/event relation; preserve conflicting termination evidence. | Key: termination digest; duplicate replay idempotent; crash cannot leave terminal projection without event; no deletion/timeout/closure/session-loss/reopen/successor inference. | Exact generation; one selected native domain; terminal representation open; policy finalization then repository/transaction stage. |
| Record compatibility approval (D09) | Exact candidate dimensions (manifest, protocol, codec, writer, source, feature and justified evidence schema); owner approval validates. | Immutable allowlist evidence/provenance; unique canonical combination; retain rejected/unknown combination evidence. | Key: compatibility-entry digest; retry idempotent; crash cannot make tuple effective without evidence; decoder/major match never suffices. | Exact tuple/scope; one selected native domain; tuple/range semantics open; policy finalization then repository/transaction stage. |
| Record compatibility supersession (D09, D10) | Exact prior entry and prospective applicability; valid supersession authority; read historical accepted use. | Immutable supersession evidence/provenance; unique prior-to-successor relation; retain prior entry and rejection evidence. | Key: supersession digest; duplicate retry idempotent; crash cannot make new rule effective without evidence; no deletion or retrospective invalidation. | Exact compatibility scope; one selected native domain; supersession semantics open; policy finalization then repository/transaction stage. |
| Record external identity to local subject mapping (D11) | Provider-scoped canonical external identity, exact local subject/generation, approving evidence; read conflicting/stale mappings. | Immutable mapping/provenance; unique provider/identity/subject relation as later defined; retain conflict/rejection evidence. | Key: mapping digest; replay idempotent; crash cannot create mapping effect without evidence; no account/session/token/remote-ownership inference or generation inheritance. | Exact provider and subject; one selected native domain; provider semantics open; policy finalization then repository/transaction stage. |
| Record external identity to local issuer mapping (D11) | Provider identity, exact issuer target/scope, approving evidence; read conflicting/stale mappings and grant scope. | Immutable issuer-mapping/provenance; unique provider/identity/issuer relation as later defined; retain conflict/rejection evidence. | Key: issuer-mapping digest; retry idempotent; crash cannot confer issuer authority without mapping and grant evidence; no possession inference. | Exact provider/issuer scope; one selected native domain; mapping semantics open; policy finalization then repository/transaction stage. |
| Record external mapping supersession (D10, D11) | Exact prior mapping, new target, prospective authority, and conflict state validate. | Immutable supersession/provenance; unique prior-to-successor mapping relation; preserve prior/conflicting mappings. | Key: mapping-supersession digest; retry idempotent; crash cannot silently switch mapping; no historical deletion or automatic generation transfer. | Exact provider/mapping scope; one selected native domain; supersession semantics open; policy finalization then repository/transaction stage. |
| Record owner conflict resolution (D08) | Pre-acceptance conflict only; exact group and all proposals read; owner evidence identifies selected and rejected proposals. | Immutable resolution/provenance and explicit selected/rejected links; unique group-resolution relation; preserve every proposal. | Key: resolution digest; retry idempotent; crash cannot select winner without resolution and atomically consistent accepted-successor write; never repairs D07 fork. | Exact conflict group/subject; one selected native domain; resolution transaction shape open; policy finalization then repository/transaction stage. |
| Record owner fork-resolution evidence - conceptual only (D07) | Existing accepted fork/quarantine; no current authority permits repair. | No current effective write is authorized; retain all branch/quarantine evidence. | No current idempotency key or repair retry is valid; crash behavior remains quarantine; prohibited partial state is any repaired head/winner. | Affected subject; not a current operation; would require new owner policy and evidence version before any later stage. |
| Import/restore/replay retained evidence (D06, D10) | Read canonical evidence, provenance, dependencies, and exact subject binding. | Retain import/reference and safe dependency status; unique artifact/evidence identity; preserve malformed/rejected references safely. | Key: artifact/evidence digest; replay idempotent; crash cannot create acceptance/mapping/eligibility; no import-derived authority. | Exact imported subject/artifact; cross-store atomicity unavailable; import trust/reconciliation open; repository/transaction then runtime stage. |

## 16. Failure-Atomicity Matrix

Each row is a future test dimension, not implementation. A durable marker is optional only when recomputable from preserved evidence; it is never independent authority.

| Trigger | Accepted state, preserved evidence, and derived marker | Blocked action, retry/idempotency, crash consequence | Scope and high-level implication | Open question / future authorization |
|---|---|---|---|---|
| Missing issuer authority evidence | No issuer authority; retain safe candidate/provenance; marker: none. | Block issuance; retry only after explicit grant; no inferred success after crash. | Exact requested scope; operation remains unavailable. | Grant evaluator; policy finalization then repository/transaction. |
| Missing rollback authority evidence | No rollback authority; retain request/provenance; marker: none. | Block rollback even if ordinary issuer exists; retry only after separate grant; no crash-created rollback. | Exact rollback scope; rollback remains unavailable. | Rollback evaluator; policy finalization then repository/transaction. |
| Invalid/out-of-scope issuer grant | No effective grant; retain safely retainable rejected evidence and bounded reason; marker: none. | Block issuance; same invalid digest remains rejected/idempotent; crash preserves no effective authority. | Exact grant scope; no broadened authority. | Grant validation semantics; policy finalization. |
| Invalid/out-of-scope rollback grant | No effective rollback grant; retain safe rejection evidence; marker: none. | Block rollback; duplicate invalid request is stable; crash cannot relabel it as issuer authority. | Exact rollback scope; no rollback fallback. | Rollback validation semantics; policy finalization. |
| Duplicate issuer-grant retry | Existing exact grant remains authoritative evidence; marker may be rebuilt. | Return same result without duplicate grant; uncertain acknowledgement retries by digest; crash remains evidence-consistent. | Exact grant scope; no duplicate effective authority. | Receipt representation; repository/transaction. |
| Duplicate rollback-grant retry | Existing exact rollback grant remains evidence; marker may be rebuilt. | Return same result without duplicate rollback grant; crash leaves no extra permission. | Exact rollback scope; no ordinary-issuer substitution. | Receipt representation; repository/transaction. |
| Conflicting termination evidence | No inferred terminal winner; preserve all termination candidates/conflict relation; marker must not choose. | Block terminal interpretation requiring a winner; retry preserves conflict; crash exposes conflict. | Exact generation; lifecycle remains fail closed. | Conflict/termination resolution policy; policy finalization. |
| Unknown compatibility combination | No effective compatibility; retain candidate/rejection evidence; marker: none. | Block authority-dependent action; retry only after explicit approval; crash cannot infer from decoder. | Exact tuple; unavailable rather than silently compatible. | Tuple/range semantics; policy finalization. |
| Compatibility supersession interrupted | Prior evidence remains; incomplete successor is not effective; marker rebuilds from durable evidence. | Block changed compatibility effect; retry by supersession digest; crash cannot retrospectively alter history. | Exact compatibility scope; historical evidence visible. | Transaction boundary; repository/transaction. |
| Missing external subject mapping | No mapping result; retain request/provenance; marker: none. | Block mapping-dependent issuance; retry only after explicit mapping; crash creates no subject link. | Exact provider/subject request; unavailable. | Mapping evaluator; policy finalization. |
| Missing external issuer mapping | No issuer mapping result; retain request/provenance; marker: none. | Block mapping-dependent issuer use; retry only after explicit mapping and grant; crash creates no authority. | Exact provider/issuer scope; unavailable. | Mapping/grant composition; policy finalization. |
| Conflicting external mappings | No automatic mapping winner; preserve all candidates/conflict evidence; marker must not choose. | Block affected mapping-dependent use; retry remains conflict-preserving. | Exact provider/identity target; unrelated subjects unaffected. | Mapping conflict policy; policy finalization. |
| Mapping supersession interrupted | Prior mapping remains; incomplete successor is not effective; marker rebuilds from evidence. | Block changed mapping effect; retry by supersession digest; crash cannot silently switch target. | Exact provider/mapping scope; history retained. | Transaction boundary; repository/transaction. |
| Index creation/maintenance failure | No authority transition if required native transaction fails; evidence remains prior committed set; stale/missing index is recomputable only. | Block acceptance/operation; retry after repair/open; crash leaves no partial authority; no timestamp/latest-row/partial-scan fallback. | Selected database/schema; visible as unavailable. | Index upgrade/rebuild design; schema/migration then repository/transaction. |
| Quota exhaustion during append-only write | No new effective authority; retain prior evidence and bounded failed attempt/provenance where safe; marker unchanged. | Block operation; retry may require operational intervention; crash cannot infer success; no automatic deletion/compaction or localStorage cross-store fallback. | Exact affected subject; operation unavailable until capacity exists. | Capacity/retention protocol; policy finalization then schema/repository. |
| Crash after durable evidence commit before acknowledgement | Committed immutable evidence is authoritative candidate; projection revalidates/rebuilds. | Retry by digest returns same result; caller state alone is not proof; no duplicate write. | Exact operation scope; outcome can be rediscovered. | Receipt/recovery design; repository/transaction. |
| Crash after part of conceptual multi-record operation before native transaction commit | No partial accepted state if one selected native transaction aborts; only previously committed evidence remains. | Retry rereads complete state; no partial head/grant/mapping/projection. | One selected database only; no claim across databases/localStorage/remote. | Selected transaction topology; repository/transaction. |
| Retry after uncertain acknowledgement | Re-read immutable evidence and any bounded receipt; marker revalidates. | Idempotency key returns same result or preserves conflict; never infer success from time/cache. | Exact operation scope; stable retry outcome. | Receipt and idempotency-key format; repository/transaction. |

The index row distinguishes schema-upgrade creation, maintenance failure during a native transaction, and stale/missing recomputable indexes. The quota row separately preserves D06: no silent evidence drop, automatic compaction, deletion, or localStorage fallback can create authority. These limits remain consistent with K334C-INV-006, K334C-INV-007, K334C-INV-012, K334C-INV-013, K334C-INV-017, and K334C-INV-018.

## 17. Migration Analysis

K-334 is documented to own future additive stores/indexes, persistent version storage, strict reads, schema migration, and native transaction implementation. That does not choose a target database, version, store/index shape, co-location, or upgrade order.

A later migration must be additive, crash-safe, bounded under blocked opens/multi-tab races, retryable after quota failure, and preserve existing K-321 through K-333 records. Legacy rows lacking authority evidence remain legacy/non-authoritative; no issuer, compatibility, mapping, lineage, or acceptance is backfilled from present state. Imported/restored data, empty state, application-version rollback, partial upgrade, and cross-database intent require later explicit decisions. Existing Notes data cannot become eligible merely through persistence, decoding, migration marker, or upgrade.

## 18. Recovery, Restore, and Replay Analysis

Restart/reopen must strictly decode and revalidate complete immutable evidence, rebuild only projections, rediscover conflict/fork, and retain bounded corruption/missing-dependency evidence. A retry uses exact commit identity, never cache or time. Multi-tab state rereads the transaction boundary before mutation.

Restore, import, replay, sync hydration, remote/local arrival, and partial export preserve provenance but do not manufacture issuer, rollback, termination, compatibility, mapping, accepted lineage, eligibility, or activation. Missing lineage fails closed; timestamps/remote presence cannot resolve conflict/fork or overwrite newer evidence.

## 19. Repository Boundary Candidates

| Candidate boundary | Owns / permits | Must not do | Dependencies |
|---|---|---|---|
| Authority-evidence repository | Strict append/read grants, termination, compatibility, mapping. | Define K-333 bytes or infer grants. | Evidence and scope indexes. |
| Accepted-history repository | Append/replay history, derive heads. | Pick fork winner or use latest-row authority. | Event/predecessor/head compare. |
| Proposal/conflict repository | Preserve proposals/rejections/conflicts/resolutions. | Implicitly advance head. | Proposal/group/resolution relation. |
| Fork projection | Discover/report subject fork state. | Hide branches/unblock automatically. | Complete successor evidence. |
| Compatibility repository | Allowlist lookup. | Equate decoding/support with approval. | Exact tuple. |
| External-mapping repository | Preserve/evaluate provider mapping. | Auto-map account/session/token. | Mapping/lifecycle/conflict. |
| Atomic authority coordinator | Compose future same-DB writes. | Become codec/policy owner/runtime engine. | Selected same-DB stores only. |

Names and composition remain unresolved. Each implementation requires repository/transaction authorization.

## 20. Invariant Catalog

1. K334C-INV-001 - An exact accepted predecessor has at most one accepted successor.
2. K334C-INV-002 - An accepted fork has no automatically selected authoritative head.
3. K334C-INV-003 - A pre-acceptance conflict never advances accepted history.
4. K334C-INV-004 - Fork quarantine is exact-subject scoped and preserves every branch.
5. K334C-INV-005 - Missing/mismatched explicit issuer evidence blocks issuance.
6. K334C-INV-006 - Generic issuer permission never grants rollback permission.
7. K334C-INV-007 - Termination requires explicit durable authorized evidence.
8. K334C-INV-008 - Generations inherit neither authority, lifecycle, compatibility, mapping, nor history automatically.
9. K334C-INV-009 - Unknown compatibility fails closed; decoding is not compatibility.
10. K334C-INV-010 - External identity/ownership/session/token/remote possession does not imply authority.
11. K334C-INV-011 - Authority/history/provenance evidence is append-only.
12. K334C-INV-012 - Exact replay is idempotent and cannot duplicate accepted lineage.
13. K334C-INV-013 - Crash cannot leave accepted/projection state without required immutable evidence.
14. K334C-INV-014 - Rejected/competing evidence is not silently lost, compacted, or reinterpreted.
15. K334C-INV-015 - Later policy does not silently invalidate accepted evidence.
16. K334C-INV-016 - Policy approval does not authorize implementation; admission does not imply eligibility; eligibility does not imply activation.
17. K334C-INV-017 - Restore/import/replay/migration/remote presence cannot make a source eligible.
18. K334C-INV-018 - A materialized projection is recomputable and cannot outrank immutable evidence.

## 21. Remaining Open Questions

| ID | Category | Question / source | Safe default / next authorization |
|---|---|---|---|
| K334C-OQ-01 | A | Composite versus referenced subject identity; K-334A topology analysis. | Preserve exact binding; neutral architecture closure. |
| K334C-OQ-02 | A | Derived-only versus checked materialized fork quarantine. | Derive/fail closed; neutral architecture closure. |
| K334C-OQ-03 | B | Grant/revocation/supersession semantics. | D01-D03 do not select final lifecycle; policy-dependent finalization. |
| K334C-OQ-04 | B | Compatibility dimensions and exact-versus-range matching. | D09 requires allowlist, not syntax; policy-dependent finalization. |
| K334C-OQ-05 | B | Accepted-fork remediation. | D07 forbids auto-repair; policy-dependent finalization. |
| K334C-OQ-06 | C | DB/topology/stores/indexes/version/upgrade/legacy classification. | No destructive/backfill default; schema/migration authorization. |
| K334C-OQ-07 | D | Repository composition, CAS, receipt, cross-DB reconciliation. | Same-DB native atomicity only; repository/transaction authorization. |
| K334C-OQ-08 | E | Runtime callers, multi-tab UX, hydration/remote integration. | No production integration; runtime authorization. |
| K334C-OQ-09 | F | Admission, eligibility, activation. | Not eligible/not activated; admission/eligibility/activation authorization. |

Counts: A 2, B 3, C 1, D 1, E 1, F 1.

## 22. Candidate Options and Trade-Offs

| Candidate | Advantages | Disadvantages / decision stage |
|---|---|---|
| Embedded canonical subject | Self-contained exports, straightforward equality. | Repeated bytes; neutral shape decision. |
| Subject registry + immutable reference | Less duplication, central integrity. | Import ordering/reference integrity; neutral shape decision. |
| Derived-only fork state | No projection inconsistency. | Repeated scans as history grows; schema/repository decision. |
| Checked fork projection | Fast fail-closed lookup. | Requires atomic rebuild/consistency; schema/repository decision. |
| Exact compatibility tuples | Deterministic/auditable. | More rows; policy finalization controls content. |
| Bounded compatibility ranges | Fewer entries. | Complex range semantics/historical interpretation; policy finalization. |
| Future co-location | Can atomically join selected local-first stores. | Cannot join legacy/localStorage/K-328/attachments/remote; schema/repository stage. |
| Dedicated authority DB | Isolates evidence/upgrades. | Requires cross-DB intent/reconciliation; schema/repository stage. |

## 23. Recommended Future Work Slicing

No post-K-334C slice names exist in current documentation; labels below are proposed only.

| Proposed slice | Goal and prohibited scope | Required authorization / reviewer / lowest sufficient tier |
|---|---|---|
| K-334C1 | Close OQ-01/OQ-02 or new source facts; documentation only. | Neutral analysis; Codex; Terra medium. |
| K-334C2 | Finalize authority, compatibility, mapping, and fork-remediation semantics; no code. | Policy finalization; Protocol Owner + Codex; Terra high. |
| K-334C3 | Exact additive schema/index and migration safety design; no runtime wiring. | Schema/migration; Codex; Terra high. |
| K-334D | Durable evidence repositories; no runtime activation. | Repository implementation; Codex; Terra high. |
| K-334E | Accepted-history/conflict atomic transactions and restart evidence; no eligibility/activation. | Repository/transaction; Codex; Terra high. |
| K-334F | Recovery/replay integration; no automatic authority/eligibility. | Runtime integration; Codex; Terra high. |
| Later admission / eligibility / activation | Each separately evaluates, authorizes, then activates an exact source. | Respective independent authorization; Protocol Owner; Terra high. |

## 24. Production Boundary

No production source, schema, migration, repository, transaction, caller, admission evaluator, eligibility evaluator, or activation behavior is changed or authorized.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE

## 25. Final Recommendation

The smallest next authorized step is proposed K-334C1: documentation-only closure of the two neutral representation questions and a source-fact check. Any choice involving authority lifecycle, compatibility semantics, fork remediation, mapping policy, schema, transaction, runtime, eligibility, or activation must obtain its corresponding later authorization instead of being inferred.
