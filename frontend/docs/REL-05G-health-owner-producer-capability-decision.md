# REL-05G Health owner producer capability decision

Task: REL_05G_F1_P2_PRODUCER_CAPABILITY_DECISION_01.

Status: PRODUCER_CAPABILITY_CHARACTERIZED_REVIEW_PENDING. This is a docs-only characterization and architecture recommendation, not independent review, human approval of a new capability, F1-P2 implementation, or positive runtime acceptance.

## 1. Decision, baseline and governing authority

    BASE_SHA = 06634f27eaeb42ee4e40cf9b775d9a1698786fea
    B1_CAUSAL_CAPABILITY = UNKNOWN
    RANGE_CAUSAL_CAPABILITY = UNKNOWN
    D_CAUSAL_CAPABILITY = UNSUPPORTED
    D_CAUSAL_WITNESS = UNSUPPORTED
    RECOMMENDED_CURRENT_PRODUCER_OPTION = C_EVIDENCE_ONLY_UNKNOWN_DENIED
    POSITIVE_CAUSAL_CAPABILITY_PROVEN_NOW = NONE
    F1_P2_IMPLEMENTATION_AUTHORIZATION = NOT_GRANTED
    REVIEW_STATUS = PENDING

OBSERVED_PRODUCTION_FACT: canonical workspace is C:\Users\이도현\GitRepos\Absinthe, repository Absinthe-6785/Absinthe. D:\Projects\Absinthe was not used. [PR #778](https://github.com/Absinthe-6785/Absinthe/pull/778), [PR #779](https://github.com/Absinthe-6785/Absinthe/pull/779) and [PR #780](https://github.com/Absinthe-6785/Absinthe/pull/780) are merged/closed. Their merge commits are respectively 1765a0fbf35eb3c1ac17b7dbe08b13367b35308f, 5ddb5f42b333639876ddee7eaabcece8ceb0811d and this BASE_SHA. All five jobs of [baseline main CI 38995983627](https://github.com/Absinthe-6785/Absinthe/actions/runs/38995983627) completed SUCCESS on BASE_SHA. These establish prerequisite closure, not approval or execution acceptance of this document.

The complete [F0 finite-admission contract](REL-05G-health-owner-finite-admission-contract.md) and [F1-P0 causal-witness characterization](REL-05G-health-owner-causal-witness-characterization.md) were read. Their old publication-pending labels and pre-P1 inventories are historical; #778/#779 closure is not reopened. Their substantive authority ceilings remain governing. In particular, #780 supersedes their descriptions of lost B1 lane attribution and flattened RANGE diagnostic reasons, but does not supply their missing causal relations.

| Prior contract | Constraint carried into this decision |
| --- | --- |
| [#772 product decision](REL-05G-health-parent-partial-source-availability-product-decision.md), sections 15/19 | Whole unsafe pair remains fenced; local and remote recovery stay separate; click, timeout and reload cannot create a fresh cause. |
| [#773 integration design](REL-05G-health-parent-partial-source-availability-integration-design.md), sections 16-19/30 | Raw RANGE then B1 then independently admitted D; routing is not admission; future consumePermit is not implemented authority. |
| [#774 date-ABA design](REL-05G-health-workout-operation-date-aba-correction-scope-design.md), sections 4-6/12 | Committed opaque lifetime and exact cleanup, not value equality or render-issued identity. |
| #775 Slice 0 implementation, S20/S21 below | Existing operation capture fences UI currentness, not root causes or read permissions. |
| #776 Slice A model, S22 | TRANSIENT/ELIGIBLE can be represented abstractly; a pure model is not a real issuer. |
| #777 Slice B adapters, S03 | Current owner/parent binding and fail-closed denial; no finite permission port. |

Options A-D in section 9 are this task's producer alternatives, not #772's UI composition alternatives or F0's differently lettered authority-origin alternatives. Choosing producer option C here continues F0's already approved deny-only policy; it does not select a new product policy.

Evidence labels throughout:

- OBSERVED_PRODUCTION_FACT: inspected checked-in production code at BASE_SHA, or verified GitHub lifecycle/CI metadata. This does not mean an active browser/session was exercised. B1/RANGE composite gates remain OFF.
- DESIGN_INFERENCE: conclusion from those facts and governing proof obligations, not runtime acceptance.
- FUTURE_PROPOSAL: a separately authorized design/implementation possibility or test requirement; no executable interface is introduced.
- UNSUPPORTED_CLAIM: an explicitly rejected promotion of insufficient evidence.

## 2. Exact source evidence catalog

All anchors below are immutable BASE_SHA permalinks. Line numbers refer to that tree, not older line references in F0/P0. Production files were read at the stated boundaries; the large repository modules were inspected at relevant open, validation, metadata, authoritative-read and restoration methods, not claimed exhaustively audited for unrelated features.

| ID | Exact source path and anchor | Inspected fact |
| --- | --- | --- |
| S01 | [frontend/src/components/views/features/health/useHealthSelectedDayComposite.ts:85][S01] | Raw retry, request/epoch/layout fences; loadPair/readCanonical and publication below. |
| S02 | [frontend/src/components/views/features/health/selectedDayLegacySnapshot.ts:57][S02] | One legacy readAll followed by selected-day projection; account isolation at line 21. |
| S03 | [frontend/src/components/views/features/health/healthWorkoutOwnerAdapters.ts:59][S03] | Reflection-free diagnostic lookup; source observation at 79; negative retry classification at 186. |
| S04 | [frontend/src/lib/workoutSelectedDayReader.ts:35][S04] | Canonical open/initialization; scope verification at 76, date read/isolation at 84. |
| S05 | [frontend/src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts:176][S05] | Captured publication fence; invalidation at 209, load at 221, ordered settlement at 247. |
| S06 | [frontend/src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts:273][S06] | Same-source diagnostic retention and final fence; derive/verify below. |
| S07 | [frontend/src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts:189][S07] | Raw invalidation, bounded automatic recovery, source replacement, load/derive and evidence binding. |
| S08 | [frontend/src/lib/workoutRangeReader.ts:35][S08] | Canonical open; device/generation verification at 74; broad active scan at 85. |
| S09 | [frontend/src/components/views/features/health/legacyPreviousCurrentness.ts:50][S09] | Exact scope/lifetime/publication observation; configure/close, dependency flights and flush below. |
| S10 | [frontend/src/components/views/features/health/legacyPreviousCurrentness.ts:128][S10] | ensure guards, batching and unavailable reuse; original-scope flush at 155. |
| S11 | [frontend/src/components/views/features/health/useLegacyPreviousCurrentness.ts:22][S11] | Retained-scope rejection latch and qualified newAdmission at 22-39; LOCAL loader at 44, layout retirement and existing listeners. |
| S12 | [frontend/src/components/views/features/health/prevWorkoutFetch.ts:23][S12] | Remote helper omission; LOCAL routing at 52, remote aggregate below. |
| S13 | [frontend/src/lib/healthLocalRuntime.ts:22][S13] | Shared driver promise and account repository wrapper, not a causal registry. |
| S14 | [frontend/src/lib/healthLocalRuntime.ts:256][S14] | LOCAL previous-block/cutoff query reads authoritative account datasets. |
| S15 | [frontend/src/lib/localDatabase/errors.ts:53][S15] | Private finite constructor-issued record; generic wrapper at 86. |
| S16 | [frontend/src/components/views/features/health/compositeWorkoutReadProjection.ts:47][S16] | Private isolation issuance; projection returns source error or throws isolation, not cause linkage. |
| S17 | [frontend/src/lib/localDatabase/repository.ts:4492][S17] | Real canonical open request handlers; no blocking-resource causal identity. |
| S18 | [frontend/src/lib/localDatabase/repository.ts:1072][S18] | Persisted scope/content predicates emit narrow failure classification, not causal lineage. |
| S19 | [frontend/src/lib/healthLocalRepository.ts:563][S19] | recoverPendingImport, authoritative read at 612, conditional restore at 700; readAll at 1060. |
| S20 | [frontend/src/components/views/features/health/healthWorkoutOperationScope.ts:34][S20] | Private issued date lifetime and original-operation currentness. |
| S21 | [frontend/src/components/views/features/health/useHealthWorkoutOperationLifetime.ts:8][S21] | Committed layout setup/state publication/exact cleanup. |
| S22 | [frontend/src/components/views/features/health/healthWorkoutParentAvailability.ts:298][S22] | Pure eligibility: UNKNOWN denied; abstract TRANSIENT needs matching episode/permit. |
| S23 | [frontend/src/lib/workoutLocalReaderAuthority.ts:16][S23] | Existing ID validation; absent ID delegates to conditional creation, malformed bytes not repaired. |
| S24 | [frontend/src/lib/healthLocalRepository.ts:208][S24] | Legacy open/request/transaction errors are native or plain Errors. |
| S25 | [frontend/src/lib/syncAuthority.ts:83][S25] | health_workouts LOCAL_FIRST; local-working-copy predicate at 111. |
| S26 | [frontend/src/lib/supabase.ts:22][S26] | Existing authFetch: boundary check, session/token, then fetch; no causal issuer. |
| S27 | [frontend/src/components/AppContent.tsx:366][S27] | Raw RANGE/B1 fanout; two wrapped UI callbacks would duplicate it. |
| S28 | [frontend/src/components/views/HealthView.tsx:420][S28] | D account/cutoff/authority/rejection configuration; operation lifetime at 439. |

## 3. Real producer inventory and owner assessment

### B1: two independently qualified lanes, one unsafe-pair veto

| Producer / original failing operation | Category and available identity | Source lifetime and recovery transition | Missing causal fact |
| --- | --- | --- | --- |
| Legacy IndexedDbLocalHealthDriver open/request/read/import-authority checks, then selected-day row projection (S02/S19/S24) | Native/plain Error becomes UNKNOWN; real row account mismatch becomes isolation. Account/date and original request/connection/publication identify context/work. A shared rejected driver promise can be re-observed (S13). | Existing account repository and committed owner; qualified read success or validated pending restoration changes observed availability. Raw B1 retry replaces request/publication; openingRef shares canonical opening, not causal identity. | No source-owned underlying-cause reference, relation across observations, distinct-new-cause fact or external resolution signal. Same rejected promise is not evidence the root cause still exists. |
| Canonical open, namespace initialization, active generation, selected-date query, persisted envelope and projection checks (S04/S17/S18) | Genuine finite negative codes and isolation; reader has account/device/namespace/generation. Open failure may leave no reader/scope. Record revision or metadata equality is data identity, not a failure episode. | Reader close/version/generation/device checks and owner fences retire work. One internal stale reopen and separately one whole-pair currentness recovery remain bounded existing behavior (S01). | onblocked does not identify the blocking connection/resource; validation predicates describe this read but export no cross-operation cause relation or repair certificate. No real transient category follows. |

OBSERVED_PRODUCTION_FACT: S01 retains LEGACY/CANONICAL READ attribution, CANONICAL SCOPE_VERIFICATION and PAIR_OWNER projection observations. Both lane failures survive; a successful sibling does not erase the failed lane. Isolation still withholds the pair. S03's deterministic retry veto uses the existing failures input. Silent row qualification downgrade or exhausted recovery can lack a retained thrown cause; no synthetic observation may fill that absence.

DESIGN_INFERENCE: pairing two correctly attributed observations cannot prove cross-request SAME or DISTINCT. Whole-owner retry safety is also separate: no lane-only retry exists, and deterministic/unsafe UNKNOWN siblings still veto the paired raw operation. B1_CAUSAL_CAPABILITY = UNKNOWN, not CONDITIONALLY_FEASIBLE merely because a type could be added. Persistence includes one legacy authoritative path per actual pair and separate canonical open/initialization; existing internal recovery can multiply attempts. No new attempt is admitted here.

### RANGE: repository facts survive settlement, not causal continuity

| Producer / original failing operation | Category and available identity | Source lifetime and recovery transition | Missing causal fact |
| --- | --- | --- | --- |
| Legacy account readAll and broad row projection (S05/S19) | Plain/native failures UNKNOWN, real legacy account checks isolation. Diagnostic source is LEGACY/READ. | One coordinator source attempt; original sequence/account/device fence; source snapshot can serve several derived bounds. Legacy restoration is inherited when pending state qualifies. | Same account or same failed row category cannot relate causes across attempts; no independent producer witness survives. |
| Canonical open/readAllActive and active-scope validation (S08/S17/S18) | Existing typed negative/isolation categories; exact reader scope and current source snapshot, not a cause handle. | Coordinator has at most two stale-generation attempts. Hook has its separate bounded automatic currentness reload, reset by raw invalidation or accepted success (S07). Source replacement closes/invalidate old work. | Request, reader, allSettled slot, snapshot and publication identities do not identify an unresolved cause. verifyCurrentScope false/null can discard reason; success alone is not root-cause resolution. |

OBSERVED_PRODUCTION_FACT: S05/S06 keep LEGACY then CANONICAL settled ordering, rethrow isolation, preserve sanitized rejection descriptions only on the same qualified snapshot, and fence immediately before installation. The hook borrows snapshot.sourceFailures only after exact coordinator-publication checks; terminal LOAD/DERIVATION is PAIR_OWNER. Ordinary source diagnostics do not retroactively enter the hook's authoritative failures input or change retry precedence. Bounds derivation is not another source read or occurrence. Current device accessors can invalidate observed replacement; equal final storage bytes do not reveal an unobserved round trip.

DESIGN_INFERENCE: RANGE_CAUSAL_CAPABILITY = UNKNOWN. Retention fixed information loss, not continuity. Replacing the coordinator, receiving a fresh snapshot, or retrying a settled partial result proves neither a fresh cause nor that the old one resolved. Do not bypass the hook through coordinator.retry().

### D: LOCAL and REMOTE must not be conflated

| Route / original operation | Available fact and stable identity | Existing behavior / causal gap |
| --- | --- | --- |
| Actual LOCAL loader (S10-S14/S28) | Exact configured account, beforeDate, local authority, dependency IDs, captured lifetime and per-block flights. readLocalPreviousWorkout reaches the account readAll before selecting prior rows. | ensure denies absent/rejected/unsupported scope, reuses qualified or UNAVAILABLE entries and same-block flights, then batches missing dependencies. Ordinary rejected flush records failure/UNAVAILABLE; qualified successful omission is query-scoped NO_MATCH. Neither is a source cause. No automatic retry on failed flush; invalidation/mutation-end/focus/visibility/bootstrap are existing refresh events, not cause-resolution notifications. |
| REMOTE helper branch (S12/S26), not the current qualified LOCAL D path | Existing request batch and per-block HTTP/JSON result; no LOCAL account/cutoff causal certificate. | Current S25 policy selects LOCAL_FIRST, so the actual configured D loader uses LOCAL. In the retained remote helper, non-OK or thrown auth/transport/JSON failure becomes undefined and is omitted. An aggregate omission loses failure-versus-absence distinction. It must not be imported as LOCAL NO_MATCH, UNAVAILABLE or transient evidence. No new remote fallback or policy change is proposed. |

OBSERVED_PRODUCTION_FACT: D close/configure revokes old lifetimes/flights, and the hook latches selected-day/range rejection independently (S09-S11). Within RETAINED_ADMITTED_SCOPE, a prior range-origin rejection needs affirmative RANGE recovery with nonnull parent identity and matching rangeIdentity; B1-only or D-only success cannot clear that unresolved sibling rejection. Partial recovery does not clear another source's retained rejection.

ADMITTED_NEW_SCOPE is a separate existing admission transition, not retained-scope recovery. S11 defines the predicate exactly as follows (quoted production source, not a proposed implementation):

```ts
const query = JSON.stringify([scope.accountId, scope.beforeDate, scope.authority]);
const changed = !!previous && (previous.query !== query || (!!previous.parentIdentity
  && !!scope.parentIdentity && previous.parentIdentity !== scope.parentIdentity));
const newAdmission = changed && trust.selectedDay === 'recovered' && !!scope.parentIdentity;
```

All conjunctions are required: a previous latch must exist; its query must change or both established parent identities must be truthy and unequal; selected-day trust must be recovered; and the new scope.parentIdentity must be truthy (nonnull and nonempty). B1 success without the other predicate conditions, a null-to-nonnull parent identity at the same query, selected-day trust other than recovered, or a query change without the other conditions does not satisfy newAdmission. HealthView supplies selected-day and RANGE trust independently (S28).

When that predicate holds, S11 uses prior = null and evaluates the new scope's own trust rather than carrying its old latch. The committed configure/close boundary retires old entries/flights/lifetime before admitting evidence under the new query/parent binding; late old-scope completions cannot publish into it (S09/S10). This does not unconditionally make D usable: current rejected trust or scope.rejected still suppresses the new scope. An old RANGE latch may therefore be retired when new-scope RANGE trust is unknown without asserting affirmative recovery of the old RANGE source. This preserves the governing product decision's section 5 admitted-new-scope rule. It proves neither old-cause resolution, SAME continuity nor DISTINCT cause issuance, revives no old authority/evidence, and grants no transient classification, retry allowance, episode or finite retry permit.

The flush can react to an injected CompositeWorkoutReadIsolationError, but the actual LOCAL repository/runtime path inspected does not establish that typed producer. It cannot borrow B1/RANGE projection isolation.

DESIGN_INFERENCE: D_CAUSAL_CAPABILITY and D_CAUSAL_WITNESS remain UNSUPPORTED under current authority. The helper's remote route is not a second admitted D owner. LOCAL generic failure, effective rejection, qualified NO_MATCH and remote omission are distinct outcomes, none a positive causal witness. An executed LOCAL flush may inherit account restoration; reused/denied/empty paths and the remote branch do not justify an extra LOCAL read.

## 4. What merged F1-P1 evidence proves

OBSERVED_PRODUCTION_FACT: actual observation shape is owner, source, boundary, disposition. Disposition contains only kind and reasonCode (S03). The graph is:

    concrete LocalDatabaseError / CompositeWorkoutReadIsolationError construction
    -> finite primitive code validation, length <=64, exact concrete new.target
    -> private WeakMap(exact Error reference -> frozen reasonCode)
    -> existing catch / ordered allSettled settlement
    -> exact-reference lookup without rejection reflection
    -> source-qualified frozen observation
    -> existing owner/snapshot publication and lifetime fences

The 16 deterministic, 8 known-unclassified and 4 isolation codes are descriptions, not a positive transient allowlist. Unissued generic errors, unsupported codes, subclasses, copied fields, foreign module instances without this record and wrapping Proxies are UNKNOWN. Registered public-field mutation does not change the frozen issued code. Existing source-side instanceof/code inspections and D's older classifier remain separate; F1-P1 does not certify arbitrary hostile source callbacks as safe.

| Evidence level | Proves now | Does not prove |
| --- | --- | --- |
| CONSTRUCTOR_ISSUANCE | This module's concrete constructor registered this exact object with a finite code. Public callers can construct it; only lookup, not arbitrary registration, is exported. | Authentic original source, cause identity, account or owner scope. A new concrete error with the same code has its own registration, not the first error's cause. |
| SOURCE_ATTRIBUTION | The known B1/RANGE catch or settled lane supplied the descriptive source/boundary label. PAIR_OWNER honestly preserves unattributed aggregate failures. | The Error came from a uniquely authenticated causal producer, or that a copied/serialized observation is a capability. |
| FAILURE_OBSERVATION | A bounded negative description retained alongside one qualified original owner publication. | A root-cause occurrence registry, stable cause across work, proof of resolution, or replenishable retry budget. |
| CAUSAL_CONTINUITY | NONE demonstrated by these records. | SAME_CAUSAL_EPISODE, DISTINCT_NEW_CAUSAL_EPISODE or CAUSE_RESOLVED. |

An Error may remain reachable beyond owner retirement, so its WeakMap record may still be readable. Owner evidence nevertheless requires its original live binding. GC, module reload, object reuse or record membership is not an authority-retirement protocol or a source-resolution event. Module-private identity cannot be serialized or transported as proof; separately instantiated modules/realms have no promised shared issuance or cause history. No arbitrary reflection fallback may repair an unknown lookup.

## 5. Q01-Q16 capability matrix

Each cell answers the causal question, not merely whether code can mint a token. PROVEN_NOW in Q16 means existing negative denial only, not real producer continuity. POSSIBLE_WITH_PRODUCER_CHANGE is a bounded design possibility using existing retirement boundaries; it is not a demonstrated issuer, feasibility verdict, implementation authorization or promise that the freeze can be satisfied. D REMOTE means the retained helper route, not active qualified LOCAL D authority.

| ID / question | B1 (both lanes) | RANGE (both lanes) | D LOCAL | D REMOTE | Production evidence / missing obligation |
| --- | --- | --- | --- | --- | --- |
| Q01 Underlying cause independent of catch? | UNKNOWN | UNKNOWN | UNKNOWN | UNSUPPORTED | S17/S18/S24 identify categories/predicates for one operation, not a source-owned causal relation. S12 erases remote failure distinction. |
| Q02 Same cause across operations? | UNKNOWN | UNKNOWN | UNKNOWN | UNSUPPORTED | S01/S05/S09 use request/publication/flight identities; no same-cause relation. |
| Q03 Distinct new cause? | UNKNOWN | UNKNOWN | UNKNOWN | UNSUPPORTED | No inspected producer exports distinctness or independent-normal-operation lineage. |
| Q04 Cause resolved, not successful retry? | UNKNOWN | UNKNOWN | UNKNOWN | UNSUPPORTED | Qualified results and S19 RESTORED/APPLIED concern data/operation outcomes, not root-cause disappearance. |
| Q05 Valid source lifetime for causal assertion? | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | UNSUPPORTED | Captured scope exists conditionally (S04/S05/S09), but no assertion is currently bound; open-failed/unknown scope cannot be fabricated. |
| Q06 Source replacement handled? | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | UNSUPPORTED | Existing close/invalidate/configure retires work; a future real assertion would need original binding and irreversible retirement. Replacement does not resolve a cause. |
| Q07 Account/date ABA handled for causal evidence? | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | UNSUPPORTED | S01/S07/S09/S20/S21 supply committed authority fences, not current causal evidence. Bounds-only RANGE reuse is not date-bound authority reuse. |
| Q08 Device/generation ABA proven? | UNKNOWN | UNKNOWN | UNSUPPORTED | UNSUPPORTED | Existing observed canonical rejection is useful; fully unobserved round trips remain unproved. D has no canonical proof to borrow (S23/S05/S08). |
| Q09 Stale causal evidence retired? | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | UNSUPPORTED | Current observations retire via original owner fences; no causal assertion store exists (S01/S07/S09). |
| Q10 Reuse after retirement prohibited? | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | UNSUPPORTED | Existing publication retirement does not revoke WeakMap readability; future binding must deny stale reuse without a new read. |
| Q11 Partial recovery independent? | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | POSSIBLE_WITH_PRODUCER_CHANGE | UNSUPPORTED | Source statuses and D latch preserve negative separation within retained admitted scope; qualified newAdmission retires the old scope, not a source cause. No root-cause retirement per source exists (S06/S11/S16; section 3). |
| Q12 Causal evidence without extra reads/retry? | UNKNOWN | UNKNOWN | UNKNOWN | UNSUPPORTED | F1-P1 observation adds no source execution by design; no real causal mechanism exists whose effects could be qualified. S19 makes probing consequential. |
| Q13 Causal assertions independently verifiable? | UNKNOWN | UNKNOWN | UNKNOWN | UNSUPPORTED | Exact call paths are inspectable; missing same/distinct/resolution facts cannot be independently checked. |
| Q14 Causal evidence across module/runtime boundaries? | UNKNOWN | UNKNOWN | UNKNOWN | UNSUPPORTED | Module-private WeakMaps and in-memory owner tokens are not cross-runtime cause authority (S15/S16/S20). |
| Q15 Real proposed causal fact in production? | UNKNOWN | UNKNOWN | UNKNOWN | UNSUPPORTED | Real failure observations exist; no proposed positive causal issuer found. Injected witness tests would not establish one. |
| Q16 UNKNOWN remains denied? | PROVEN_NOW | PROVEN_NOW | PROVEN_NOW | UNSUPPORTED | S03 returns no TRANSIENT/permit; S22 denies UNKNOWN; D additionally denies unsupported/rejected scope. Remote omission has no causal admission API and cannot qualify LOCAL. |

DESIGN_INFERENCE: Q05-Q11's possible binding work is necessary plumbing only. It cannot upgrade Q01-Q04, Q12-Q15, the per-owner verdicts or the empty positive category set. Complete observed owner recovery is not the task's CAUSE_RESOLVED relation. An inability to prove SAME is never evidence of DISTINCT. Q16 concerns proposed finite user admission: existing raw callbacks remain callable under their current lifecycle rules; it does not claim a new controller blocks every existing retry.

## 6. Smallest proposed producer contract: proof slots, not an interface

FUTURE_PROPOSAL: only consider a source-specific envelope after a human-authorized design identifies a real source-owned fact and independent relation verifier. Until then the only honest result is CONTINUITY_UNKNOWN/denied, without an episode/permit. This table deliberately specifies missing obligations rather than a runnable TypeScript type, schema, registry implementation or fake default values.

| Dimension / semantic field | Classification | Exact boundary and missing proof |
| --- | --- | --- |
| Issuing producer / original code boundary | PROVEN_NOW | S02/S04/S08/S14/S17/S19 are traceable code locations only. Authenticated causal issuance is REQUIRES_PRODUCER_CHANGE; a source string or public constructor does not provide it. |
| Original source operation | PROVEN_NOW | Original read/scan/open and request binding exist. A request is observation lineage, not cause identity or independent retry permission. |
| Trusted source scope | PROVEN_NOW | Conditional existing reader scope or legacy account/query scope only. Missing scope is unsupported; do not publish unavailable sentinels as proof. D REMOTE has no LOCAL scope. |
| Owner lifetime binding of a new causal assertion | REQUIRES_PRODUCER_CHANGE | Compose with exact original committed parent/connection/source/dependency binding, never stamp latest scope in catch. Existing tokens alone prove no causal fact. |
| Failure observation | PROVEN_NOW | B1/RANGE have S03's four-field description; D has its existing per-entry disposition. No sourceFailures shape is added to D here. |
| Independent causal relation / underlying cause | UNSUPPORTED | No demonstrated producer cause fact/verification rule; do not substitute UUID, code, request, Error, record hash or publication. |
| Same-cause evidence | UNSUPPORTED | Need a producer-verified unresolved relation across the actual operations, including retry descendants; none found. |
| Distinct-new-cause evidence | UNSUPPORTED | Need independently authorized normal-operation lineage plus a genuinely different producer fact, not lifecycle churn or failed retry. |
| Cause-resolution evidence | UNSUPPORTED | Need a scoped producer resolution fact; successful read, metadata verification or pending restoration alone is insufficient. |
| Authority retirement | REQUIRES_PRODUCER_CHANGE | Future real assertion must become permanently unusable at existing original owner/source retirement; do not invent a device watcher or persistent ledger. |
| Supersession | REQUIRES_PRODUCER_CHANGE | Reject late old assertions and incompatible source/owner replacement; do not claim replacement healed the old cause. |
| UNKNOWN handling | PROVEN_NOW | Retain current negative/unsupported outcome and no new dispatch. Future missing/invalid fields must stay unavailable, not synthesized. |

The supported descriptive fields do not make the unsupported relation implementable. A minimum future proposal must name a concrete condition the source can own, how same/distinct/resolution are independently falsifiable, and why no hidden source execution is required. Canonical validators can identify a particular failed invariant during an already-read batch, but current errors export only category/detail. Even a future invariant-specific relation would remain deterministic denial unless a separately reviewed positive category and whole-owner safety proof exist. onblocked/open errors currently expose no blocker identity or closure certificate. No positive producer candidate is selected in this packet.

Any future facts must be non-payload and private-origin: no account/device values, records, content hashes, raw Error/message/stack, callbacks or credentials in consumer diagnostics. Existing source predicates and internal data identity are not a new provenance capability. Independent verification must reject forged/copied/foreign-owner evidence and state its exact realm/reload limits. A correct source record without live owner binding is still non-executable.

## 7. C01-C18 architecture counterexamples

These are source-grounded architecture analyses, not executed runtime acceptance PASS claims. Every future runtime verification remains NOT_EXECUTED. Safest classification is CONTINUITY_UNKNOWN/denied unless an existing deterministic/isolation/rejection veto already gives a stronger denial; NO_MATCH remains qualified nonfailure, not a causal failure.

| ID / counterexample | What must be proven | Available evidence | Missing evidence / safest current classification | Smallest future proof obligation |
| --- | --- | --- | --- | --- |
| C01 Different failures, same code | Independent relation of underlying conditions | Finite category only (S15/S17/S24) | Same code does not prove SAME; UNKNOWN/denied | Real issuer distinguishes conditions, not a code bucket. |
| C02 One failure, multiple Errors | All observations belong to one unresolved condition | Each concrete object can get its own issued code | Object inequality does not prove DISTINCT; UNKNOWN | Producer relation remains stable across error allocation. |
| C03 Error reused after recovery | Whether its original cause persists/resolved/newly recurs | Frozen code remains readable on reachable key | Registry membership does not prove current cause; UNKNOWN | Independently verified relation and resolution plus original lifetime fence. |
| C04 Retry creates fresh work IDs | Retry lineage is not a new normal cause | S01/S05 allocate/supersede work/publication | Fresh request/publication proves neither DISTINCT nor replenishment | Preserve original cause lineage if actually proved; retry alone never renews it. |
| C05 Success without root resolution | Scoped cause-resolution fact independent of return value | Complete/partial query result, scope verification | Success proves observed operation only; causal resolution UNKNOWN | Specific issuer-owned resolution assertion, not another probing read. |
| C06 B1 one lane recovers | Which cause/lane is resolved while sibling remains failed | Independent source statuses/observations (S01/S03) | No sibling cause retirement; pair safety still fenced | Lane-specific causal relation plus unchanged whole-pair deterministic veto. |
| C07 RANGE source replaced midflight | Original source/owner still owns any assertion | Sequence, close, exact snapshot checks (S05/S07) | Old result retired; new source cause UNKNOWN | Bind real fact to original source and reject late superseded assertion. |
| C08 Account A-B-A | A2 cannot reuse A1 authority/cause claim | Committed account/connection/operation fences | Equal account string is not continuity; old evidence denied | Original account-generation/owner binding at issue and every use. |
| C09 Date X-Y-X | X2 differs from X1 lifetime | S20/S21 commit-issued date identity | Date equality/unchanged RANGE source is insufficient | Preserve original parent date binding; no newer-token borrowing. |
| C10 Device/generation A-B-A | Complete relevant transition history or sufficient producer fact | Existing observed device/generation checks (S04/S05/S08/S23) | Unobserved ABA UNKNOWN; D canonical proof unsupported | Separate proof under existing permitted source facts; otherwise deny, no new watcher/scan. |
| C11 Detach/remount | Old scope permanently retired, no allowance reset | Layout cleanup, coordinator close, D close | Fresh instance is not a new cause | Exact old binding revoked and no restoration by equal props. |
| C12 Late completion | Original operation/source/owner still valid | Existing request/epoch/flight guards | Retired completion cannot become current evidence | Assert original-bound settlement; never stamp current/newest owner. |
| C13 Reload, no causal registry | Continuity beyond the old realm | In-memory WeakMaps/tokens disappear | No causal history; UNKNOWN/denied, no replenishment | State reload limitation explicitly; any persistence/global guarantee needs new approval. |
| C14 Error mutated after issuance | Category snapshot versus current cause must be distinguished | S15/S16 preserve original finite code | Immutability proves description, not SAME/RESOLVED | Keep reflection-free lookup; causal relation must come from elsewhere. |
| C15 Injected witness mistaken for production | Genuine real issuer/fact independent of test injection | Boundary tests can exercise response only | Synthetic origin is UNSUPPORTED as capability proof | Trace real producer emission and negative mutant that removes the factual relation. |
| C16 D remote omission relabeled LOCAL transient | Correct route and qualified evidence kind | S12 omits non-OK/throw; S25 selects LOCAL | Remote omission neither LOCAL failure nor NO_MATCH proof | Keep routes separate; any remote design is separately scoped, never a LOCAL shortcut. |
| C17 Correct producer record, no owner binding | Both factual relation and current authority are valid | A hypothetical record may describe a real fact | Missing original owner lifetime denies use | Source fact plus exact original parent/owner/source/dependency fences, without granting a permit. |
| C18 Unobserved ABA called continuous | Observation coverage sufficient for asserted lifetime | Equal final values and intermittently sampled fences | Equality does not prove no transition; UNKNOWN | Demonstrate coverage without prohibited effects, or retain unsupported/denied. |

## 8. No-additional-effect and persistence analysis

OBSERVED_PRODUCTION_FACT (S19): HealthRepository.readAll -> readAuthoritativeDatasets -> recoverPendingImport -> conditional restorePendingIfStillCurrent. NO_PENDING follows absent/already-verified state, not proof of source health. Valid pending recovery verifies snapshot/account/hash/prior-state/counts, rechecks the exact pending account/snapshot inside the read-write transaction, restores that account's existing recovery dataset set, puts valid prior import state or deletes a null prior state, and verifies readback. Supersession returns STALE without applying restoration. A created read-write transaction is not an applied dataset write. A restored null prior can still leave authoritative read unavailable.

These existing targets/guards/transactions are not new writer authority. Canonical initialization is a separate existing open path and can write metadata. Absent device ID can be conditionally created by the existing read/open path; malformed established bytes remain rejected. Neither an extra invocation nor an added identity probe can be called inherited merely because the method already exists. No new total-write-zero requirement is introduced.

| Effect | Current path / smallest safe future condition |
| --- | --- |
| Extra repository reads | This document adds none. Future observation must use already produced facts, never readAll to obtain a witness; an extra NO_PENDING read still violates budget. |
| IndexedDB transactions | Separately count readonly/readwrite, store sets and actual put/add/delete. A future fact check cannot quietly add metadata transactions. |
| Canonical opens/scans | Count B1 date reads, RANGE broad scans, stale reopen and namespace initialization separately. No extra reader/coordinator or owner bypass. |
| Recovery triggers | Preserve recover/restore outcomes and exact pending-state checks; do not use restoration success as cause resolution or retry safety. |
| Listeners/polling | Preserve only existing managed/unmanaged focus/visibility/bootstrap/mutation ownership. No new device/source monitor, poller or global cause service. |
| Retry dispatch | No new raw retry, invalidate/ensure, remote/bootstrap, bind/push/pull/resync/reset, permit or retry controller. |
| Import restoration | Match valid-pending/prior-null/absent/verified/malformed/superseded states. Keep original account targets, inserts/deletes/import-state transition and readback. |
| Capture/fence cost | Existing RANGE device access and scope metadata verification are not free. New witness capture cannot add separate reads or invoke existing fences more often without explicit effect proof. |

DESIGN_INFERENCE: docs-only runtime delta is zero by unchanged-source diff, not a newly measured runtime guarantee. Existing #780 parity tests/CI qualify that existing implementation, not a future causal producer. A plausible in-memory instrumentation proposal is still unqualified until actual source/lifetime facts and matched interleavings establish no added effect. If it needs new listeners, scans, reads, recovery triggers or persistence/backend authority, STOP for a separate decision rather than weaken this task's freeze.

## 9. Options A-D and per-owner decision

| Option | Feasibility / missing evidence | Production scope and risk | Testability / authority | Recommendation |
| --- | --- | --- | --- | --- |
| A Real producer-origin causal witness already available | Not established for any inspected owner. Actual origin/category/lifetime guards are insufficient for Q01-Q04. | No existing witness to wire in; treating codes/handles as one changes semantics without proof. | Requires a real independently falsifiable relation. No positive acceptance or authority exists. | Not selectable as PROVEN_NOW. |
| B Narrow producer capability extension | Conceptually possible to design source-bound observation/retirement plumbing, but no concrete same/distinct/resolution fact or effects-safe positive issuer demonstrated. | New producer instrumentation at the actual source, original-operation and owner binding, and narrow tests would require separate scope/approval. No backend/schema change, watcher, persistent/global registry or extra read is authorized. | Would need real producer and matched effect proof; negative/category enrichment alone remains deny-only. Interface compilation is not capability proof. | Do not start implementation. Request a separate bounded design only if a concrete independently checkable source fact is first supplied. |
| C Evidence-only diagnostics, UNKNOWN/denied | Implemented negative boundary from #780; does not solve original F1. | No new runtime change. Retain source qualification, deterministic vetoes, lifetime fences and inherited effects. | Source and regression evidence support denial; no causal positives claimed. | Recommended current decision for B1/RANGE/D, retaining D unsupported. |
| D Synthetic identity from request/publication/Error/catch | Can label work or an occurrence, cannot establish a causal relation. | Fresh IDs can falsely replenish cause/allowance on retry, reload, remount or ABA; additional registries can add authority without facts. | Mock-only identity tests cannot falsify real causal claims. Conflicts with F0/P0. | Rejected as positive causal proof; no fallback implementation. |

| Owner | Source proves today | Needs new producer work / cannot currently prove | Further F1-P2 decision |
| --- | --- | --- | --- |
| B1: UNKNOWN | Lane-attributed bounded negatives, existing scope/currentness and pair veto. | Authenticated real cause relation, same/distinct/resolution, source lifetime sufficient for claimed device/ABA scope, whole-owner safety. | Outcome C now. Only a concrete producer-specific fact could justify outcome B's separate design/approval; no implementation request is created. |
| RANGE: UNKNOWN | Ordered source diagnostics on exact qualified snapshot and existing replacement fences. | Same causal obligations independently of allSettled/request/reader/snapshot identity; null/currentness loss cannot fill them. | Outcome C now; no scan/recovery/extra coordinator to obtain proof. A later source proposal must justify its own relation and budget. |
| D: UNSUPPORTED | LOCAL occurrence/qualified query outcome and independent rejection/dependency guards. | Real causal issuer, actual legacy typed origin where claimed, cutoff/dependency/source lifetime, distinctness/resolution. Remote omission is unusable LOCAL evidence. | Outcome C now. Keep D_CAUSAL_WITNESS unsupported; optional diagnostics would still need separate authorization and would not make a D bridge executable. |

UNKNOWN is not a finding of universal impossibility, and POSSIBLE_WITH_PRODUCER_CHANGE is not CONDITIONALLY_FEASIBLE positive capability. Original F1 remains BLOCKED_BY_MISSING_PRODUCER_OR_LIFETIME_PROOF. Missing causal proof is not a regression/reopening of #780's closed diagnostic R01.

## 10. Future acceptance specification: all NOT_EXECUTED

FUTURE_PROPOSAL: these requirements apply only after a separate producer design and implementation authorization. An independent reviewer must reject a mock-only positive issuer. Each oracle must detect its named faulty variant at the same real boundary, not merely a setup exception. No runtime causal acceptance is executed or passed by this document, source inspection, prior #780 tests or CI.

| ID | Future required verification / sensitivity | Status |
| --- | --- | --- |
| PC01 | Real production issuer, original operation and trusted lane trace; remove real origin while leaving an attractive record and require denial. | REQUIRED / NOT_EXECUTED |
| PC02 | Independent SAME proof across actual operations; equal code, repeated promise or fresh Error alone cannot satisfy the oracle. | REQUIRED / NOT_EXECUTED |
| PC03 | Independent DISTINCT proof and normal-operation lineage; retry/reclick/new publication must not replenish it. | REQUIRED / NOT_EXECUTED |
| PC04 | Scoped source-resolution proof distinguished from successful/partial read, NO_PENDING and RESTORED. | REQUIRED / NOT_EXECUTED |
| PC05 | Original source scope/lifetime, failed-open missing scope, source replacement and supersession; deny fabricated sentinels or newest-source borrowing. | REQUIRED / NOT_EXECUTED |
| PC06 | Committed owner/parent lifetime and irreversible retirement; valid source record without owner binding remains denied. | REQUIRED / NOT_EXECUTED |
| PC07 | Account A-B-A and date X-Y-X, detach/remount/layout replay; copied/equal context cannot revive old evidence. | REQUIRED / NOT_EXECUTED |
| PC08 | Observed device/generation retirement; unobserved ABA remains unsupported unless separately proved without a prohibited probe. | REQUIRED / NOT_EXECUTED |
| PC09 | Late success/failure settles only under original bindings; replacing captured scope with current scope must fail. | REQUIRED / NOT_EXECUTED |
| PC10 | Partial recovery preserves unrelated failures, whole-pair deterministic/isolation veto and independent D rejection. | REQUIRED / NOT_EXECUTED |
| PC11 | Reload and separate module/realm fail closed without causal continuity; no persisted/global ledger or fresh allowance inferred. | REQUIRED / NOT_EXECUTED |
| PC12 | UNKNOWN/unsupported/unissued/forged/copied evidence stays denied; no positive transient category by exclusion. | REQUIRED / NOT_EXECUTED |
| PC13 | Observation adds zero reads/opens/scans/recovery/fence calls/listeners/polls/retries relative to matched source lifecycle; an added real readAll must fail. | REQUIRED / NOT_EXECUTED |
| PC14 | Matched absent/verified/valid-pending/prior-null/malformed/concurrent-supersession and cold/warm initialization preserve transaction/write fingerprints, guards, account targets and import-state outcomes; detect hidden writes and a false zero-total-write oracle. | REQUIRED / NOT_EXECUTED |
| PC15 | Frozen bounded non-sensitive descriptions, no callbacks/raw Errors/messages/credentials/record hashes; mutation/Proxy/foreign-module cases do not trigger reflection fallback. | REQUIRED / NOT_EXECUTED |
| PC16 | No injected test witness promoted to real proof; reviewer can independently falsify each relation, not just validate a shape. | REQUIRED / NOT_EXECUTED |
| PC17 | Keep D LOCAL/REMOTE and unavailable/qualified NO_MATCH/omission/effective rejection separate. In RETAINED_ADMITTED_SCOPE, sibling success cannot clear unresolved range-origin rejection or lend causal authority. At the exact section 3 newAdmission predicate, preserve ADMITTED_NEW_SCOPE entry with prior latch/evidence retired and new query/parent trust evaluated independently. Reject clearance with missing qualifying parent identity or any incomplete predicate conjunction, same-scope unresolved RANGE, reuse of prior evidence, or late previous-scope completion. Reject interpreting new admission as old-cause resolution, SAME/DISTINCT proof, a transient category or replenished retry allowance/permit. | REQUIRED / NOT_EXECUTED |
| PC18 | No episode, permit, retry controller, writer or reader activation follows from source capability acceptance; any later F2 consumes separately approved F1/category/whole-owner proof. | REQUIRED / NOT_EXECUTED |

F0 FA01-FA20 and P0 W01-W16 are not marked passed here. B18 finite eligibility and B20 permit consumption remain NOT_PROVEN. A future source-specific verifier would need independent exact-head implementation review before original F1 could resume for a proven subset. Even that would not authorize F2 or Slice C.

## 11. Validation, unresolved obligations and authorization gates

Documentation validation: check immutable source line anchors and named symbols at BASE_SHA, governing relative links and #778-#780 closure, all Q01-Q16/C01-C18/PC01-PC18 rows, evidence-label separation and option/owner consistency. Verify one added Markdown file only, unchanged runtime/config/tests/backend/schema/gates, and git diff --check. No dedicated Markdown checker/dependency is added. Exact-head Push and PR CI must be observed for all five required jobs; actual new commit/PR/run IDs belong in the PR/report, not predicted inside this base-grounded artifact.

Source inspection and unchanged baseline main CI qualify no new runtime producer or physical browser. No application production DB/auth/data HTTP request, SQL query, fixture injection, causal runtime test or additional owner read was performed for this characterization. The Supabase skill's public changelog was fetched as required; that public documentation request produced no SDK/platform change or capability assertion. S26 is inspected repository behavior, not a security certification or an assertion that session access is universally cost-free. Existing Windows K-333B/K-330 history is not rerun/reclassified as green here.

Unresolved obligations: actual source-owned causal fact; independent SAME/DISTINCT/resolution relation; sufficiently observed source lifetime/device ABA; original owner binding and irreversible retirement; no-effect instrumentation proof; cross-module/reload limits; independently safe complete paired scope; D's independent causal/typed producer. None is filled with an invented field value.

Recommended next decision: retain producer option C under the existing approved denial policy. A human may separately authorize a bounded source-specific design/approval request only after it names an actual producer fact, its independently falsifiable relations, original-operation/source/owner scope and effects budget. If that cannot be supplied under the freeze, keep UNKNOWN/denied; do not create an implementation task to manufacture the missing capability. No permit/retry task, D bridge or product-policy expansion is created automatically. This packet itself needs independent design review and a separate Final Merge Gate; publication and CI are not approval.

    F0 = CLOSED_IN_MAIN
    F1_P0 = CLOSED_IN_MAIN
    F1_P1 = CLOSED_IN_MAIN
    F1 = BLOCKED_BY_MISSING_PRODUCER_OR_LIFETIME_PROOF
    F1_P2 = NOT_AUTHORIZED
    F2 = NOT_STARTED
    SLICE_C = BLOCKED_BY_CONTRACT_GAP
    POSITIVE_TRANSIENT_ALLOWLIST = EMPTY
    CURRENT_EXECUTABLE_FINITE_ADMISSION = NONE
    B18_FINITE_ELIGIBILITY = NOT_PROVEN
    B20_PERMIT_CONSUMPTION = NOT_PROVEN
    CAUSAL_EPISODE_ISSUANCE = NONE
    RETRY_PERMIT_ISSUANCE = NONE
    NEW_RETRY_DISPATCH = NONE
    ALL_FIVE_READER_GATES = false
    WRITER_AUTHORITY_CHANGED = NO
    WRITER_SEMANTICS_CHANGED = NO
    PROVENANCE_CAPABILITY = NONE
    LIVE_WRITER_BLOCKERS = 7 OPEN
    PUBLIC_ACTIVATION = NOT_AUTHORIZED
    DB_VERSION = 7
    SCHEMA_VERSION = 1
    PC01_PC18 = REQUIRED / NOT_EXECUTED
    REVIEW_STATUS = PENDING

No database/store/index/keyPath, WorkoutSessionV1, backend/RLS, reader/writer/adoption/data-plane, identity-repair or G6 change is authorized. Stop after Draft publication and exact-head CI observation; do not mark Ready, merge, enable auto-merge, self-declare review PASS or implement a producer/episode/permit/controller.

[S01]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/useHealthSelectedDayComposite.ts#L85
[S02]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/selectedDayLegacySnapshot.ts#L57
[S03]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/healthWorkoutOwnerAdapters.ts#L59
[S04]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/workoutSelectedDayReader.ts#L35
[S05]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts#L176
[S06]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts#L273
[S07]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts#L189
[S08]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/workoutRangeReader.ts#L35
[S09]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/legacyPreviousCurrentness.ts#L50
[S10]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/legacyPreviousCurrentness.ts#L128
[S11]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/useLegacyPreviousCurrentness.ts#L22
[S12]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/prevWorkoutFetch.ts#L23
[S13]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/healthLocalRuntime.ts#L22
[S14]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/healthLocalRuntime.ts#L256
[S15]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/localDatabase/errors.ts#L53
[S16]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/compositeWorkoutReadProjection.ts#L47
[S17]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/localDatabase/repository.ts#L4492
[S18]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/localDatabase/repository.ts#L1072
[S19]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/healthLocalRepository.ts#L563
[S20]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/healthWorkoutOperationScope.ts#L34
[S21]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/useHealthWorkoutOperationLifetime.ts#L8
[S22]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/features/health/healthWorkoutParentAvailability.ts#L298
[S23]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/workoutLocalReaderAuthority.ts#L16
[S24]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/healthLocalRepository.ts#L208
[S25]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/syncAuthority.ts#L83
[S26]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/lib/supabase.ts#L22
[S27]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/AppContent.tsx#L366
[S28]: https://github.com/Absinthe-6785/Absinthe/blob/06634f27eaeb42ee4e40cf9b775d9a1698786fea/frontend/src/components/views/HealthView.tsx#L420
