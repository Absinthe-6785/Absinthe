# K-333F: Manifest Selection and History Contract Definition

## 1. Executive contract

**Result: `CONTRACT_READY_FOR_OWNER_REVIEW`.** This documentation-only future-contract definition describes how a future K-333 Manifest Selection and History Authority may select one existing K-329 canonical manifest for one exact subject, retain reconstructible history, and resolve historical bytes. It creates no production authority, record, codec, store, selector, API, registry, migration, or runtime behavior.

A valid selection/history proof establishes only one K-329 manifest digest, selected by the future K-333 Manifest Selection and History Authority, for one exact physical-source/namespace/generation subject, under one supported contract version, with one reconstructible append-only lifecycle, at one determinable effective history boundary.

It does **not** prove writer identity membership, writer identity adoption, current context, capability material, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation. It does **not** authorize runtime use, production sync, source activation, data deletion, or policy fallback.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Existing authority baseline

| Existing source | Existing authority preserved | K-333F boundary |
|---|---|---|
| K-329 `ReviewedWriterManifest`, validation, canonical codec, and content digest | K-329 owns manifest representation, canonical bytes, physical-source binding, and SHA-256 digest derivation. | No K-333F codec, manifest ID, digest domain, or ownership change. |
| K-333 identity and session records | Identity/session values remain distinct; `manifestDigest` remains opaque. | No manifest resolver, selector, membership, capability, or context authority is created. |
| K-333E selection/history baseline | Selection is subject-scoped, append-only, historically resolvable, and separate from persistence and downstream consequences. | This document only makes the future selection/history contract deterministic. |

No existing source resolves a K-329 manifest by digest for K-333, selects a manifest for a K-333 subject, evaluates selection history, supersedes or revokes a selection, or treats `WriterIdentityRecord.manifestDigest` as complete selection authority.

## 3. Status vocabulary

- `ALREADY_AUTHORITATIVE`: existing repository authority that this document does not extend.
- `DEFINED_FOR_FUTURE_CONTRACT`: a complete conceptual rule that later implementation need not guess.
- `OWNER_DECISION_REQUIRED`: an owner policy must choose among identified options before implementation.
- `DEFERRED`: a later contract concern not required to make this contract coherent.
- `REJECTED`: an unsafe interpretation a later contract must not adopt.

“Selection event”, “subject”, “sequence”, “head”, and “resolution” are conceptual terms only; none is a field name, schema, storage key, wire format, API, or export.

## 4. Selection subject and manifest identity

`DEFINED_FOR_FUTURE_CONTRACT`: the exact subject is:

```text
ManifestSelectionSubject = {
  physicalSourceDigest,
  namespaceId,
  generationId,
}
```

Each component is required. K-329 binds its manifest to `physicalSourceDigest`; K-333 provides namespace and generation facts. A selection for one tuple is never reusable for another tuple. Source clone, namespace change, restore, or migration implies neither identity equivalence nor selection carry-forward.

`DEFINED_FOR_FUTURE_CONTRACT`: selected manifest identity is the K-329 SHA-256 content digest together with exact canonical bytes that recompute to it. Possession of a digest or bytes grants no authority. K-329 remains the sole owner of the canonical codec and digest algorithm.

`REJECTED`: newest-by-time, display name, branch name, runtime object identity, arbitrary caller bytes, or a new K-333F manifest identifier.

## 5. Future authority split

| Role | Future responsibility | Explicit exclusion |
|---|---|---|
| K-333 Manifest Selection and History Authority | Validates predecessor/action/sequence, authorizes next sequence, issues one authoritative lifecycle event, and owns subject-local linearization. | Does not own K-329 bytes/codec, persistence, adoption, conformity, authorization, admission, eligibility, or activation. |
| K-333 Cross-Protocol Evidence Persistence Authority | Retains append-only evidence, bytes or resolution metadata, and bounded diagnostics; detects conflicts and supports lookup. | Does not allocate authority, choose a winner, authorize a successor, or derive authority from storage order. |
| Absinthe Protocol Owner | Approves future policy decisions through repository-recorded decisions. | Is not a runtime issuer, record, admission, eligibility, or activation authority. |
| Later downstream authorities | May consume bounded selection evidence. | Must independently establish adoption, context, capability, conformity, authorization, admission, eligibility, and activation. |

Only the future Manifest Selection and History Authority may issue lifecycle events. Its concrete issuer authorization mechanism remains an owner decision; K-333F defines no keys, credentials, or runtime authentication.

## 6. Conceptual event family and proof boundary

`DEFINED_FOR_FUTURE_CONTRACT`: a conceptual immutable event family has a common subject/history envelope and action-specific semantics. Its conceptual components are contract kind/version, subject tuple, selected digest, compatibility metadata, predecessor reference, action, subject-local sequence, issuer-authority reference, bounded reason/category, evidence reference, and an event digest derived only after semantic payload completion. This is not a record schema.

Actions are `SELECT`, `SUPERSEDE`, `REVOKE`, and `ROLLBACK_DECISION`. `RESTORE_REFERENCE`, if retained as recovery metadata, is non-authoritative and non-head-changing; it cannot establish or change current selection.

A valid event, valid action, valid sequence, valid issuer, resolved bytes, or derived current selection establishes only the exact proof described in the Executive contract: one K-329 digest selected by the future authority for one exact subject under one supported version, reconstructible lifecycle, and determinable boundary. It does **not** prove writer identity membership, writer identity adoption, current context, capability material, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation; nor authorize runtime use, production sync, source activation, data deletion, or policy fallback.

## 7. Deterministic sequence allocation and linearization

`DEFINED_FOR_FUTURE_CONTRACT`: the future Manifest Selection and History Authority owns subject-local linearization for one exact `{ physicalSourceDigest, namespaceId, generationId }` subject.

- `SELECT` is the only genesis event: predecessor absent and sequence equal to the defined genesis value.
- Every successor names the exact current unique head for the same subject and uses predecessor sequence plus one.
- Allocation occurs only after validating the current authoritative head, matching subject, issuer authorization, compatible selected bytes, and the action transition.
- The future issuer must atomically establish **predecessor + next sequence + successor event**. This is a future implementation requirement, not an implementation in K-333F.
- No two valid successors may issue from the same predecessor. At most one may become authoritative.
- Competing attempts fail `CONCURRENT_SUCCESSOR_CONFLICT` or `SUCCESSOR_ALREADY_EXISTS`; no timestamp tie-breaker, local-last-write-wins, remote-wins, arbitrary winner, or automatic fork reconciliation is allowed.
- Persistence may retain evidence and detect a conflict but may not choose its winner or turn the newest persisted event into authority.
- Detected conflicts preserve all evidence, fail closed for production enforcement, and require explicit owner-governed future resolution.

Wall-clock time is diagnostic-only and cannot order, select, repair, or reconcile history.

## 8. Action-transition table

Every state-changing successor requires the current unique head, same exact subject, exact next sequence, authorized issuer, and valid canonical selected material where an action selects a digest. Every action preserves prior events and has the full proof boundary from section 1.

| Current authoritative state | Proposed action | Required predecessor | Allowed | Resulting state | Sequence | Required checks | Explicit non-consequence | Failure |
|---|---|---|---|---|---|---|---|---|
| no prior event | `SELECT` | absent | yes | `ACTIVE_SELECTION` | genesis | no prior history; valid bytes; authorized issuer | does not prove adoption, conformity, authorization, admission, eligibility, or activation | `INVALID_ACTION_TRANSITION` if any genesis rule fails |
| no prior event | `SUPERSEDE`, `REVOKE`, `ROLLBACK_DECISION` | n/a | no | unchanged | none | genesis-only restriction | does not create a selection | `INVALID_ACTION_TRANSITION` |
| `ACTIVE_SELECTION` | `SELECT` | current head | no | unchanged | none | `SELECT` is genesis-only | does not silently replace selection | `SELECT_NOT_GENESIS` |
| `ACTIVE_SELECTION` | `SUPERSEDE` | current unique head | yes | `ACTIVE_SELECTION` with new digest | next | new digest; effective-boundary policy when later consumed | does not rewrite/delete prior evidence | `PREDECESSOR_NOT_CURRENT_HEAD`, `SEQUENCE_NOT_NEXT`, or authorization failure |
| `ACTIVE_SELECTION` | `REVOKE` | current unique head | yes | `NO_EFFECTIVE_SELECTION` | next | exact head; prospective effect by default | never selects a replacement | transition/sequence/issuer failure |
| `ACTIVE_SELECTION` | `ROLLBACK_DECISION` | current unique head | only with future rollback authorization | `ACTIVE_SELECTION` using historically known digest | next | historical target; source and compatibility revalidation | does not delete intermediate history or perform database rollback | `ROLLBACK_TARGET_NOT_HISTORICAL` or authorization failure |
| `NO_EFFECTIVE_SELECTION` | `SELECT` | current revocation head | no | unchanged | none | history already exists | does not silently restart lifecycle | `SELECT_NOT_GENESIS` |
| `NO_EFFECTIVE_SELECTION` | `SUPERSEDE` | current unique head | yes, subject to issuer/effective-boundary policy | `ACTIVE_SELECTION` with new digest | next | exact head and ordinary successor checks | does not erase revocation evidence | transition/sequence/issuer failure |
| `NO_EFFECTIVE_SELECTION` | `REVOKE` | current head | no | unchanged | none | duplicate terminal revocation rejected | does not amend a reason | `INVALID_ACTION_TRANSITION` |
| any | `RESTORE_REFERENCE` | n/a | metadata only | unchanged | no lifecycle sequence | exact subject/reference validation | not selection-changing authority | `RESTORE_REFERENCE_NOT_AUTHORITATIVE` if used as authority |

`ROLLBACK_DECISION` is distinct from `SUPERSEDE` because it selects a historically used digest, requires explicit rollback authorization, carries distinct audit/security meaning, and revalidates source and compatibility. Ordinary supersession may select an approved previously unused digest.

For **each** action in this table, the non-consequence is exact and complete: valid action evidence does **not** prove writer identity membership, writer identity adoption, current context, capability material, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation; and it does **not** authorize runtime use, production sync, source activation, data deletion, or policy fallback.

## 9. Append-only history, derivation, and lifetime

History is append-only and subject-local. Resolver validation requires one contiguous predecessor chain, exact subject equality, action validity, supported versions, and a unique terminal head. Missing predecessors, cycles, gaps, repeated sequences, two terminal heads, unsupported versions, or unavailable evidence yield no effective selection for enforcement.

Current selection is derived, not a mutable current-pointer authority:

- valid `SELECT`, `SUPERSEDE`, or authorized `ROLLBACK_DECISION` derives one selected digest;
- valid `REVOKE` derives no effective selection until a later valid successor;
- forked, invalid, unavailable, truncated, or unsupported history derives none.

A selection remains scoped to its exact subject until explicit supersession, explicit revocation, authorized rollback successor, unsupported compatibility, or a **future approved generation-lifecycle terminal state**. K-333F itself does not determine when a generation ends. Until approved lifecycle evidence exists, generation mismatch is invalid/stale for another subject, not a termination signal. A different generation is a different subject and never receives automatic migration or restore inheritance.

## 10. Generation, restore, and offline semantics

Restore may preserve exact graph evidence or references that later resolve verified bytes. It must retain the exact subject, predecessor relation, digest verification, and history; it cannot restore only a mutable “current” result. Restore completion does not imply eligibility or activation.

Offline or missing evidence is unavailable, not policy denial. Previously resolved evidence may be available only to later approved non-production workflows. No automatic newest-manifest fetch, substitution, destructive data action, stale-generation promotion, or offline production eligibility is authorized.

## 11. Digest validity taxonomy and decision tree

| State | Category | Detection / enforcement | Local-data and recovery behavior | Future owner |
|---|---|---|---|---|
| `UNREFERENCED_MANIFEST_DIGEST` | invalid evidence | A digest has no valid authoritative selection/history reference for the exact subject; reject as selection proof and fail closed. | Retain bounded diagnostics; do not resolve merely because bytes exist or caller possesses them. | Selection/History |
| `SELECTED_MANIFEST_BYTES_UNRESOLVED` | evidence unavailable | Valid subject history references digest but canonical bytes are not currently resolvable; fail closed for production enforcement. | Preserve history/digest; retry trusted resolution; never substitute or infer contents. | Persistence + Selection/History |
| `MANIFEST_DIGEST_MISMATCH` | corruption | Resolved canonical bytes recompute to a different digest; reject bytes. | Retain bounded diagnostic; obtain verified bytes. | K-329 codec + Persistence |
| `PHYSICAL_SOURCE_MISMATCH` | invalid evidence | Canonical bytes do not bind the event subject source. | Preserve evidence; reject cross-source use. | K-329 codec + Selection/History |
| `UNKNOWN_SUBJECT`, `MISSING_HISTORY`, `FORKED_HISTORY` | invalid/unavailable/corrupt evidence | Subject tuple has no valid complete unique lineage. | Retain all evidence; do not derive or auto-resolve. | Selection/History + Persistence |
| `ISSUER_NOT_AUTHORIZED` | denied evidence | Issuer does not satisfy the future owner-approved issuer policy; no lifecycle event is issued. | Retain bounded attempted-evidence diagnostics where permitted; no authority is created. | Selection/History |
| `UNSUPPORTED_MANIFEST_VERSION` | unsupported evidence | Referenced manifest or selection version has no approved compatible decoder/relation; fail closed. | Retain evidence; do not infer compatibility or downgrade validation. | Compatibility Authority |
| `INVALID_ACTION_TRANSITION`, `SELECT_NOT_GENESIS`, `PREDECESSOR_NOT_CURRENT_HEAD`, `SEQUENCE_NOT_NEXT`, `CONCURRENT_SUCCESSOR_CONFLICT`, `SUCCESSOR_ALREADY_EXISTS` | invalid/conflict evidence | Transition, head, or allocation precondition fails. | Preserve all evidence; no deletion, reordering, timestamp tie-break, or arbitrary winner; owner-governed resolution if needed. | Selection/History |
| `ROLLBACK_TARGET_NOT_HISTORICAL`, `RESTORE_REFERENCE_NOT_AUTHORITATIVE` | invalid evidence | Rollback target was not historical, or metadata was used as selection authority. | Preserve diagnostics and evidence; reject enforcement. | Selection/History |

Decision tree for a supplied digest:

1. Is it referenced by valid authoritative history for the exact subject? If no: `UNREFERENCED_MANIFEST_DIGEST` (invalid evidence).
2. Are canonical K-329 bytes resolvable? If no: `SELECTED_MANIFEST_BYTES_UNRESOLVED` (evidence unavailable).
3. Does the recomputed digest match? If no: `MANIFEST_DIGEST_MISMATCH` (corruption).
4. Does physical-source binding match? If no: `PHYSICAL_SOURCE_MISMATCH` (invalid evidence).
5. Is the version supported? If no: unsupported, fail closed.
6. Otherwise, selected manifest material is available for later downstream validation only.

Resolved material still does not prove identity adoption or conformity.

## 12. Consumer contracts and proof boundary

| Consumer | May receive | Must independently establish | Explicit boundary |
|---|---|---|---|
| Identity Adoption | selected digest, subject, history boundary | writer identity membership and adoption | selection is not membership or adoption |
| Conformity | exact bytes, lifecycle state, subject, boundary | current context, capability material/satisfaction, session conformity | selection is not context, capability, or conformity proof |
| Authorization / Admission / Eligibility / Activation | only later approved composite evidence | operation authorization, admission, eligibility, activation | selection alone never authorizes, admits, makes eligible, or activates |
| Persistence | events, bytes, resolution metadata, diagnostics | retention/resolution under separate policy | persistence never chooses policy or a history winner |

For every consumer, a valid selection/history proof establishes only one K-329 digest selected by the future authority for one exact subject under one supported version, reconstructible lifecycle, and determinable boundary. It does **not** prove writer identity membership, writer identity adoption, current context, capability material, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation; nor authorize runtime use, production sync, source activation, data deletion, or policy fallback.

## 13. Supersession, revocation, rollback, and effective boundary

Supersession is an ordinary same-subject successor selecting a new digest. Revocation is prospective by default, produces no effective selection, and never selects a replacement. Rollback is a separately authorized append-only successor to one historically known digest; it never deletes or rewrites intermediate history. Retrospective invalidation is never automatic, leaves cryptographic history intact, and needs an owner-approved policy.

History order is deterministic, but mapping an event to an external session, operation, transaction, or downstream effective boundary is intentionally not inferred. A downstream contract must explicitly reference selection event identity or sequence after an owner-approved policy chooses the mapping.

## 14. Persistence, dependency, and version boundary

Persistence/history resolution is a precondition to future production enforcement, not an optimization. A later persistence contract must define append-only retention, deterministic lookup, decoder/compatibility metadata retention, bounded diagnostics, corruption handling, and authority separation. K-333F approves no database, store, repository, schema, index, migration, cache format, network service, or retention period.

There is no digest cycle: K-329 bytes precede manifest digest; semantic event payload precedes event digest; predecessor evidence precedes successor issuance; history precedes derived selection; selection precedes only later consumers. No future consumer may treat unavailable bytes as validated selection material.

K-329 schema version 1, byte-format version 1, manifest version `k329b-source-reviewed-v1`, and existing K-333 v1 records remain unchanged. Exact version combinations, compatibility workflow, migration semantics, deprecation policy, and decoder-retention implementation remain owner decisions. Unsupported versions fail closed.

## 15. Threat model

| Threat | Prevention / detection | Failure behavior | Residual risk |
|---|---|---|---|
| digest substitution or possession-as-authority | canonical digest recomputation, exact subject history, issuer preconditions | fail closed; preserve diagnostic | concrete issuer trust is future policy |
| replay, stale selection, truncation, fork, duplicate head, or wall-clock manipulation | exact tuple, predecessor/sequence validation, append-only retained evidence | reject/unavailable; no automatic winner or repair | future retention and fork policy needed |
| rollback abuse, restore selecting stale policy, or remote override | append-only rollback, historical target/source/compatibility checks, no automatic override | deny/unavailable; preserve data | rollback authorization unresolved |
| selection interpreted as membership, adoption, context conformity, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation | strict proof-boundary typing and consumer contracts; forbidden dependency-edge audit | reject downstream use; retain evidence and bounded diagnostics | misuse by unreviewed integration |
| selection used to authorize runtime use, production sync, source activation, data deletion, or policy fallback | full proof boundary in every consumer and non-goal | reject downstream use | later contracts must preserve boundary |

The threat boundary is complete: a valid selection/history proof establishes only one K-329 digest selected by the future authority for one exact subject under one supported version, reconstructible lifecycle, and determinable boundary. It does **not** prove writer identity membership, writer identity adoption, current context, capability material, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation; nor authorize runtime use, production sync, source activation, data deletion, or policy fallback.

## 16. Decision matrix

| Decision | Existing authority | Defined contract rule | Status | Owner | Subject | Lifecycle | Persistence dependency | Validation input | Failure behavior | Consumer impact | Explicit non-consequence | Unresolved choice | Required future contract |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Selection subject | K-329/K-333 facts | exact source + namespace + generation tuple | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | exact tuple | immutable scope | retain tuple/history | exact equality | mismatch fails closed | bounds later consumers | no cross-scope reuse | none | Selection/History |
| Selected manifest identity | K-329 digest | digest plus resolvable canonical bytes | DEFINED_FOR_FUTURE_CONTRACT | K-329 canonical manifest codec | digest/source | content-addressed | bytes/resolution | recomputed digest | unavailable/corrupt | later input only | no authority from possession | none | Historical Resolution |
| Selection event model | none | action-specific immutable conceptual event family | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject/history | append-only | event retention | complete semantic payload before digest | corrupt fails closed | lifecycle proof | no schema now | encoding form | Event Contract |
| Event ordering | none | predecessor plus contiguous local sequence is authoritative | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | one subject | monotonic | complete predecessors | exact chain | fork/truncation fails closed | deterministic derivation | no wall-clock authority | none | Event Contract |
| Sequence allocation and linearization | none | validated head + exact next sequence + atomic successor establishment | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | one subject | genesis then contiguous successors | retain graph | head, sequence, subject, action | conflict fails closed | deterministic lifecycle only | no persistence winner | implementation mechanism | Event Contract |
| Action transition validity | none | table in section 8 governs all lifecycle actions | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | one subject | append-only | retain graph | state/action/head | invalid transition rejected | lifecycle proof only | no downstream authority | none | Event Contract |
| Selection authority | none | scoped immutable selector and derived result | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject | append-only | complete graph | authoritative lineage | fail closed | bounded future proof | no conformity | none | Selection/History |
| Canonical byte resolution | K-329 codec | exact bytes required for selected digest | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | digest/source | while referenced | durable resolution | codec/digest/source | unavailable | later validation input | no inferred bytes | retention mechanism | Historical Resolution |
| Historical byte resolution | K-329 codec | retained selected digests resolve to exact canonical bytes | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | retained digest | while referenced | bytes/decoder metadata | digest/codec/source | unavailable blocks enforcement | later conformity input | no inferred bytes | resolution topology | Historical Resolution |
| Current selection derivation | none | unique validated terminal action only | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | one subject | recomputable | verified history | graph/action | none if invalid | later input | no mutable pointer authority | cache policy | Resolver Contract |
| Selection lifetime | none | explicit event, support, or future validated terminal lifecycle evidence only | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | exact subject | scoped | history retained | action/compatibility | fail closed | stable proof | no newest update | terminal evidence source | Lifecycle Contract |
| Supersession mechanics | none | same-subject ordinary successor | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | same subject | append-only | predecessor retained | exact head/next sequence | reject stale | boundary input later | no rewrite/delete | none | Lifecycle Contract |
| Revocation mechanics | none | prospective explicit successor; no replacement | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | same subject | append-only | reason/history retained | valid action/head | no effective selection | downstream sees revoked state | no replacement | none | Revocation Contract |
| Rollback mechanics | none | authorized successor to historically known digest | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | same subject | append-only | full graph/bytes | history/source/compatibility | deny if invalid | boundary input later | no database rollback | none | Rollback Contract |
| Restore reference | K-324 patterns | metadata only; cannot change selection | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | restored tuple | non-authoritative | retain graph/bytes | scope/digest/history | reject authority use | recovery input only | no implicit selection | reference encoding | Restore Contract |
| Missing selected bytes | none | preserve and fail closed | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | digest | recoverable | history/digest retained | trusted resolution | unavailable | no enforcement | no newest fallback | recovery channel | Persistence Contract |
| Missing history | none | incomplete lineage is unavailable; no derivation | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | subject | recoverable | complete graph | history lookup | fail closed | no enforcement | no local deletion | recovery channel | Persistence Contract |
| Unreferenced digest | none | reject as selection proof | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | exact subject/digest | n/a | diagnostics | valid history reference | invalid evidence | none | caller bytes are not authority | none | Historical Resolution |
| Fork detection | none | retain conflicting evidence; derive no winner | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject graph | terminal until resolved | all branches retained | heads/sequences | corrupt/conflict fail closed | no current result | no automatic winner | resolution policy | Fork Resolution Contract |
| Duplicate effective selection | none | multiple valid results are rejected | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject/boundary | terminal until resolved | retained graph | derived result count | fail closed | no consumer use | no latest-wins | resolution policy | Resolver Contract |
| Offline behavior | none | unavailable authority/bytes never enable production enforcement | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | evidence availability | temporary | retained resolution | availability state | unavailable, not denial | later non-production only | no offline eligibility | local workflow policy | Offline Contract |
| Versioning | K-329/K-333 v1 | independent future selection version; unknown versions fail closed | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Compatibility Authority | contract relation | decoder retained while referenced | version metadata | explicit support | unsupported | compatibility input | no versions assigned now | exact formats | Compatibility Contract |
| Compatibility base rule | K-329/K-333 v1 facts | compatibility must be explicit and unsupported combinations fail closed | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Compatibility Authority | version relation | owner-governed | metadata retained | approved relation | unsupported | prerequisite only | no implied edge | none | Compatibility Contract |
| External effective-boundary mapping | none | order deterministic; downstream must explicitly identify boundary | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | session/operation/transaction relation | later policy | retained selection identity | approved mapping | downstream use rejected until defined | no inferred wall-clock mapping | local sequence, session, transaction, operation, explicit reference | Boundary Contract |
| Issuer authorization policy | none | only future authority issues; mechanism absent | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | subject/action | before issuance | issuer evidence | approved policy | `ISSUER_NOT_AUTHORIZED` | no event | no runtime auth now | static, capability, governance, cryptographic options | Issuer Policy |
| Cross-generation inheritance | none | no implicit inheritance; new generation is new subject | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | old/new generation | later policy | historical evidence retained | approved evidence | reject automatic carry-forward | no migration/restore adoption | never, copy-forward, new event, external contract | Generation Contract |
| Generation lifecycle termination authority | existing generation facts only | K-333F does not determine generation end | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | one generation | future validated terminal evidence | retained lifecycle evidence | approved lifecycle contract | mismatch/stale fails closed | no automatic ending | lifecycle authority, consumed terminal evidence, immutable replacement | Generation Lifecycle Contract |
| Retrospective invalidation | none | prospective revocation default; no automatic retroactivity | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | bounded historical evidence | later emergency policy | audit history | approved policy/time | fail closed | none until approved | no deletion/rewrite | scope/time/effect policy | Retrospective Policy |
| Rollback authorization policy | none | mechanics defined separately; issuer policy unresolved | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | rollback action | before issuance | history retained | approved authorization | deny rollback | no change | authorizer, reason, emergency path | Rollback Policy |
| History topology | none | one unique accepted lineage required; forks retained | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | subject graph | append-only | graph retained | topology policy | no derivation on ambiguity | deterministic only after policy | no storage-order authority | chain, DAG, archived-conflict options | Persistence/History Contract |
| History retention policy | none | no destructive pruning while referenced evidence depends on it | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | graph/bytes | while referenced | durable evidence | approved retention policy | unavailable/corrupt | reconstructibility | no permanent-retention claim | duration/transport | Persistence Contract |
| Fork-resolution policy | none | no automatic winner; preserve branches | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | conflict graph | later explicit resolution | all branches retained | approved policy | fail closed | none before resolution | no timestamp/storage winner | resolution authority/form | Fork Resolution Contract |
| Concurrent successor conflict resolution | none | conflict detected; no automatic resolution | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | one predecessor | after conflict | competing evidence retained | approved policy | fail closed | none before resolution | no arbitrary winner | owner-governed resolution | Fork Resolution Contract |
| Compatibility combinations | K-329/K-333 v1 facts | unsupported versions fail closed; no table created | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | version relation | decoder retained while referenced | metadata retained | approved pairs | unsupported | prerequisite only | no implied compatibility edge | pairs, workflow, migration, deprecation | Compatibility Contract |
| Identity adoption consumer | none | consume selection only as bounded input | DEFERRED | K-333 Identity Adoption Authority | selection proof | later | retained selection | resolved digest/scope | unavailable | must prove adoption | selection is not adoption | full contract | Identity Adoption |
| Conformity consumer | none | consume bytes/state/boundary only as bounded input | DEFERRED | K-333 Conformity Validation Authority | selection proof | later | resolved history | bytes/scope/state | unavailable | must validate all other inputs | selection is not conformity | full contract | Conformity Validation |
| Authorization non-consequence | none | separate authority required | DEFERRED | Future Operation Authorization Authority | operation | later | later evidence | approved composite inputs | deny by policy | none now | selection never authorizes | policy | Authorization |
| Admission non-consequence | none | separate authority required | DEFERRED | Future Admission Authority | admission | later | later evidence | authorization/evidence | deny by policy | none now | selection never admits | policy | Admission |
| Eligibility non-consequence | none | separate authority required | DEFERRED | Future Eligibility Authority | source | later | later evidence | approved prior evidence | fail closed | none now | selection never makes eligible | policy | Eligibility |
| Activation non-consequence | none | separate authority required | DEFERRED | Future Activation Authority | production | later | later evidence | explicit activation policy | fail closed | none now | selection never activates | policy | Activation |
| Persistence prerequisite | none | historical resolution is required before future enforcement | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | retained evidence | before enforcement | append-only authority | resolvable graph/bytes | unavailable blocks | prerequisite only | no policy owner | topology | Persistence Contract |
| Persistence implementation | none | implementation is not selected | DEFERRED | Future Persistence Authority | retained evidence | later | n/a | future contract | unavailable blocks enforcement | prerequisite only | no DB/store/repository chosen | implementation | Persistence Contract |
| Implementation gate | K-333E owner gate | explicit recorded owner approval before code | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | all future contracts | before code | repository decision | owner record | work blocked | permits review only | no runtime approval | decision | Owner Approval Policy |

**Matrix status count (43 rows):** `DEFINED_FOR_FUTURE_CONTRACT` 24; `OWNER_DECISION_REQUIRED` 12; `DEFERRED` 7; `ALREADY_AUTHORITATIVE` 0; `REJECTED` 0. Every owner-required decision has its own row; no owner-required sub-decision is hidden in a defined row.

The full proof boundary applies to every matrix row: valid selection/history proof establishes only one K-329 digest selected by the future authority for one exact subject under one supported version, reconstructible lifecycle, and determinable boundary. It does **not** prove writer identity membership, writer identity adoption, current context, capability material, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation; nor authorize runtime use, production sync, source activation, data deletion, or policy fallback.

## 17. Explicit non-goals

K-333F defines or implements none of: writer identity membership, writer identity adoption, context evidence, capability evidence, capability-policy satisfaction, session conformity, operation authorization, admission, eligibility, activation, schema, codec, vectors, persistence, sequence allocator, transaction, compare-and-swap, locking, consensus, fork resolver, current pointer, runtime selector, network authority, restore executor, database, store, repository, migration, or K-334.

It also does not prove or authorize anything beyond the exact boundary: a valid selection/history proof establishes only one K-329 digest selected by the future authority for one exact subject under one supported version, reconstructible lifecycle, and determinable boundary. It does **not** prove writer identity membership, writer identity adoption, current context, capability material, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation; nor authorize runtime use, production sync, source activation, data deletion, or policy fallback.

## 18. Unresolved owner decisions

All remaining decisions are independently reviewable and `OWNER_DECISION_REQUIRED`:

1. issuer authorization policy;
2. cross-generation inheritance;
3. generation lifecycle termination authority;
4. external effective-boundary mapping;
5. retrospective invalidation;
6. rollback authorization;
7. history topology;
8. history retention;
9. fork resolution;
10. concurrent-successor conflict resolution; and
11. compatibility combinations.
12. implementation-gate owner approval record policy.

These decisions do not authorize code or alter K-329 ownership.

## 19. Validation

Documentation consistency requires the focused K-329, K-332, and K-333 protocol suites, typecheck, build, and `git diff --check`. The known fixture-anchor CRLF/LF result is `ENVIRONMENT_SENSITIVE_NON_BLOCKING` only when source/test blobs are unchanged from base and exact-head CI remains merge-gating authority.

## 20. Final contract status

### CONTRACT_READY_FOR_OWNER_REVIEW

Subject identity, manifest identity, authority split, deterministic sequence/linearization requirements, action transitions, append-only derivation, generation boundary, supersession, revocation, authorized rollback mechanics, digest taxonomy, historical resolution, consumer separation, version principle, and owner-decision rows are coherent at the architecture-contract level. No runtime or persistence implementation, admission, eligibility, or activation authority is created.

The final proof boundary remains complete: valid selection/history proof establishes only one K-329 digest selected by the future authority for one exact subject under one supported version, reconstructible lifecycle, and determinable boundary. It does **not** prove writer identity membership, writer identity adoption, current context, capability material, capability satisfaction, session conformity, operation authorization, admission, eligibility, or activation; nor authorize runtime use, production sync, source activation, data deletion, or policy fallback.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
