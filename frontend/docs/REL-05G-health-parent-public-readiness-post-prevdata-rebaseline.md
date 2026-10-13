# REL-05G Health parent public readiness after prevData

Task: `REL_05G_HEALTH_PARENT_PUBLIC_READINESS_POST_PREVDATA_REBASELINE_01`.

Publication workstream: `REL_05G_HEALTH_PARENT_POSTMERGE_EVIDENCE_AND_PUBLIC_READINESS_REBASELINE_01`.

Status: `CHARACTERIZATION_COMPLETE_PENDING_INDEPENDENT_REVIEW`. This is a docs-only rebaseline and recommendation, not product-owner approval, implementation, activation, public-copy acceptance, measurement or physical qualification.

## 1. Exact current baseline and decision

Repository: `Absinthe-6785/Absinthe`; canonical workspace `C:\Users\이도현\GitRepos\Absinthe`. Source inspection and live remote verification: 2026-10-13 (UTC+09:00), exact main `e20c8f58d3300e36758e9a4f85d65a029306d095`.

| Closure | Verified evidence | What it does not close |
| --- | --- | --- |
| [PR #763](https://github.com/Absinthe-6785/Absinthe/pull/763) | MERGED/CLOSED; merge `b9331e78dbe3dd47aa00e67ef452b587e2b97a09`; selected-day persisted canonical scope-distrust classification aligned with range | Public isolation/recovery copy or REL05G5A-001 |
| [PR #769](https://github.com/Absinthe-6785/Absinthe/pull/769) | MERGED/CLOSED; merge `3e4a363841566c3b4137a7881d5654be3f732d9b`; explicit human policy `D_HYBRID_STATE_DEPENDENT` | Public reader activation, presentation/support thresholds |
| [PR #770](https://github.com/Absinthe-6785/Absinthe/pull/770) | MERGED/CLOSED; reviewed/final head `cd632ec5af31f4d3b21398a920ad313fa5b492c1`; merge equals current main; R01-R05 CLOSED; focused rereview and Final Gate PASS | Physical/copy/performance acceptance, real legacy typed-isolation conversion or writer readiness |
| [Post-merge CI 38264972138](https://github.com/Absinthe-6785/Absinthe/actions/runs/38264972138) | Exact main above; test/typecheck/build/backend-rel05g1/backend-recovery completed/success (5/5) | The forthcoming docs head's CI, public acceptance or human decisions |

Primary result: `HEALTH_PARENT_PUBLIC_ACTIVATION_STILL_BLOCKED`; the technical prerequisites corrected by #763 and #770 are not reopened. The best bounded future candidate remains B1 ON + range ON + comparison OFF, with Home/Search separately OFF unless separately authorized. This is `BEST_BOUNDED_FUTURE_CANDIDATE`, **RECOMMENDED, NOT APPROVED**. Every literal production gate remains false.

Exactly one next substantive task is recommended:

`REL_05G_HEALTH_PARENT_PARTIAL_SOURCE_AVAILABILITY_PRODUCT_DECISION_01`.

Parent mount/partial-source semantics determine which states and controls actually exist on desktop/mobile. Decide that state model before public presentation implementation. Performance/support decisions may be prepared in parallel, but measurement/physical acceptance depend on the implemented, reviewed candidate. The frozen identity blocker remains a separate hard activation veto; it is not an authorized recovery implementation task.

## 2. Authoritative inputs and source method

Historical artifacts are retained, not overwritten or mechanically inherited:

- [Earlier selected-day/range parent characterization](REL-05G-health-selected-day-range-parent-public-readiness-characterization.md): old prerequisite matrix, mount asymmetry and public gaps.
- [Comparison public readiness](REL-05G-workout-exercise-comparison-public-readiness-characterization.md): distinct child C / PUBLIC_C30 ceiling and whole-parent measurement limitations.
- [Established device-ID characterization](REL-05G-health-parent-established-device-id-correction-characterization.md): reader-only correction feasibility NO, unavailable versus empty and compatibility limits.
- [Approved identity recovery contract/product decision](REL-05G-health-parent-established-identity-recovery-contract-and-product-decision.md): Policy F, proven exact original, no orphaning, writer continuity and execution gates.
- [Exact-original provenance feasibility](REL-05G-health-id-exact-original-provenance-feasibility-characterization.md): no authoritative source in the verified repository-defined set; unknown external archives are not inspected or proven absent.
- [Prospective provenance decision](REL-05G-health-id-prospective-provenance-capability-product-architecture-decision.md): explicit human HOLD, no selected capability or follow-up research/implementation authority.
- [Approved prevData policy](REL-05G-health-parent-legacy-prevdata-freshness-product-decision.md): D selected, A/B/C/HOLD alternatives NOT_SELECTED; historical publication-time implementation labels are superseded by #770, not erased.
- [Post-merge implementation evidence](REL-05G-health-parent-legacy-prevdata-freshness-implementation.md): exact review/CI chronology and automated/public acceptance separation.
- [Reader expansion contract](REL-05G5B2B2-product-reader-expansion-prep.md): source/date/session separation, partial/unknown semantics and no canonical editor input. Its old implementation handoffs do not imply that merged range/Home/Search work is absent.

Current-source inspection covers [AppContent](../src/components/AppContent.tsx), [HealthView](../src/components/views/HealthView.tsx), [selected-day panel](../src/components/views/features/health/HealthSelectedDayCompositePanel.tsx), [selected-day reader](../src/lib/workoutSelectedDayReader.ts), [hook](../src/components/views/features/health/useHealthSelectedDayComposite.ts), [range reader](../src/lib/workoutRangeReader.ts), [coordinator](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts), [range hook](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts), [Previous projection](../src/components/views/features/health/compositePreviousWorkoutProjection.ts), [Previous view](../src/components/views/features/health/CompositePreviousWorkoutView.tsx), [mobile sheet](../src/components/views/features/health/PreviousWorkoutSheet.tsx), [calendar activity](../src/components/views/features/health/workoutCalendarActivity.ts), [calendar](../src/components/views/features/health/WorkoutMonthCalendar.tsx), and [supporting panels](../src/components/views/features/health/HealthSupportingPanels.tsx). Gate/source ownership and visible branches, not merely projection output, determine this rebaseline.

No production user data, real browser storage, remote user rows, operator archive or physical device was accessed. No new provenance investigation, policy selection, source correction, fixture or measurement is performed. Statements about public behavior below describe the existing controlled gate-ON candidate's source paths; they do not imply those gates are currently deployed ON.

## 3. Reclassification of every earlier prerequisite

The first status in each row uses the earlier matrix's requested classification vocabulary. Additional public acceptance requirements remain explicit.

| Earlier prerequisite | Current classification | Rebaseline / remaining obligation |
| --- | --- | --- |
| Selected-day presentation/copy | REQUIRES_CORRECTION | English-only controls/states, IDs/enums/session formatting remain; visible state model must first be decided |
| Selected-day accessibility | PARTIALLY_SATISFIED | Roles/headings/native controls exist; localized full-date/control names and announcements need source work, then real browser/AT QA |
| Selected-day source truth | SATISFIED | #763 maps actual persisted canonical scope distrust to isolation; ordinary corruption remains ordinary partial failure. This is source classification, not public recovery acceptance |
| Legacy editor / canonical separation | PARTIALLY_SATISFIED | Canonical never hydrates/adopts into draft/planning; localized Save/Delete and canonical-only empty-editor explanation/comprehension remain |
| Parent mount / partial-source availability | REQUIRES_PRODUCT_DECISION | Desktop read-only siblings remain inside legacy-success/non-rejection guard; already-open mobile sheet is outside it; #770 did not choose public parity |
| Previous bounded/source-separated truth | SATISFIED | One-year eligible date buckets, distinct sources/all same-day sessions remain; no merged session identity or cloud/all-time claim |
| Previous presentation | REQUIRES_CORRECTION | UUIDs/raw fields, bounded no-bucket wording and ordinary-error versus isolation guidance; parity depends on mount decision |
| Calendar unknown/partial truth | SATISFIED | Known-present union and verified-covered absence remain; unknown is visibly `?` when calendar is mounted |
| Calendar presentation/accessibility | REQUIRES_CORRECTION | Hard-coded weekdays, numeric date buttons, selected/full-date semantics and distinct recovery explanations |
| Account/date/request and source-generation fences | SATISFIED | Reviewed bounded source publication/currentness fences plus #770 legacy query/owner/request/mutation ABA; not continuous observation of every out-of-band write or physical QA |
| Durable save/delete reader invalidation | SATISFIED | Captured committed-account fanout invalidates range before B1; #770 adds separate same-context legacy pre-attempt/end coverage without writer-semantic change |
| REL05G5A-001 | BLOCKED_BY_FROZEN_AUTHORITY | Still ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION; proven original provenance absent, capability HOLD, recovery control/writer proof not available |
| Legacy prevData freshness | SATISFIED | #769 policy selected; #770 merged; C01-C14 and C15 source-state automated PASS. Public currentness copy/gesture, performance and physical acceptance still required |
| Bootstrap/offline public copy | REQUIRES_CORRECTION | Local evidence versus remote recovery/completeness, pending English notice, separate local/remote retry purposes |
| Home product coherence | REQUIRES_PRODUCT_DECISION | Not Health runtime dependency; H OFF can omit canonical-only presence and combine today-facing claims with selected-date legacy input; visible Home limitation/correction needs separate approval |
| Search product coherence | REQUIRES_PRODUCT_DECISION | Not Health runtime dependency; S OFF legacy/catalog/date scope must not claim comprehensive saved composite history |
| EN/KO/JA public language approval | REQUIRES_PRODUCT_DECISION | Existing keys/translations are implementation, not human approval of final public source/session/empty/recovery wording |
| Performance threshold/support scope | REQUIRES_PRODUCT_DECISION | Whole B1/range/legacy-history parent budgets, device/mode/data-scale and latency/tail/memory targets not selected; measurement follows decision |
| Feature-level real browser/AT QA | REQUIRES_QA | Supported-mode protocol and execution after reviewed visible-state implementation; no physical feature acceptance yet |
| Explicit coupled parent public approval | REQUIRES_PRODUCT_DECISION | No approval to publish B1/range or sibling children; later reviewed readiness evidence and separate human activation instruction required |
| Global E3/Track A/B/C/D qualification | NOT_REQUIRED | Not a blanket direct prerequisite for existing-scope bounded read-only display; recovery/admission operations may have their own evidence dependencies and remain blocked |
| Canonical writer/data-plane/G6 rollout | DEFERRED | No writer/adoption/reset/transport activation; all seven live-writer blockers remain OPEN |

`SELECTED_DAY_PERSISTED_ISOLATION_PREREQUISITE = SATISFIED`.
`AUTOMATED_CURRENTNESS_PREREQUISITE = SATISFIED`.
`PUBLIC_CURRENTNESS_ACCEPTANCE = REQUIRES_QA_AND_PUBLIC_ACCEPTANCE`.
`PUBLIC_READER_CURRENTNESS_PREREQUISITE = IMPLEMENTED_AUTOMATED_ACCEPTANCE_COMPLETE_PUBLIC_ACCEPTANCE_PENDING`.

## 4. Closed technical prerequisites, exact limits

### Selected-day durable distrust after #763

`WorkoutSelectedDayReader.read` catches `LocalDatabaseError(CORRUPT_PERSISTED_RECORD)` from the actual repository query before returned-row checks. ACCOUNT_MISMATCH, NAMESPACE_MISMATCH and GENERATION_MISMATCH become the corresponding `CompositeWorkoutReadIsolationError`; UNTRUSTED_SCOPE becomes INVALID_CONTEXT. Trusted-scope INVALID_ENTITY and unclassified corruption/I/O pass through as ordinary errors. [Real persisted-path tests](../src/components/views/features/health/selectedDayPersistedIsolation.integration.test.ts) cover the four details and nonempty qualified legacy positive controls. The B1 hook publishes isolation with result/legacyDaily null, so contaminated scope is not partial evidence or an empty editor.

This aligns that exact trust prerequisite with range; it does not prove final recovery copy, actual AT comprehension, a real legacy-adapter typed conversion or established-device identity recovery.

### Legacy currentness after #769/#770

[LegacyPreviousCurrentness](../src/components/views/features/health/legacyPreviousCurrentness.ts) and [its hook](../src/components/views/features/health/useLegacyPreviousCurrentness.ts) implement in-memory D qualification: query account/date/authority, separate publication lifetime/evidence identity, successful NO_MATCH versus UNAVAILABLE, request supersession, coalescing and explicit recovery. [Mutation coverage](../src/components/views/features/health/legacyWorkoutMutationCoverage.ts) and [persistence boundary](../src/components/views/features/health/healthWorkoutPersistence.ts) revoke before relevant local attempts and refresh after success/failure, preserving existing durable commit/account fanout. Focus/visibility/bootstrap recovery is owned; child publication revisions do not qualify legacy history.

R01 current draft/remove/latest load intent, R02 one-time assembly ownership, R03 typed B1/range rejection latches, and R04 latest committed explicit count/semantic ABA all retain reviewed closure. R05 chronology is independently closed. Four EN/KO/JA source-state strings and role=status exist; neither those strings nor read-count assertions establish public-copy, physical or latency/memory acceptance. `REAL_LEGACY_TYPED_ISOLATION_PATH = NOT_ESTABLISHED` remains exact.

Parent B1/range Refresh still invokes AppContent's source fanout, not automatically `previousOwner.invalidate('unknown')`. The internal D recovery API is separate; any final public parent-currentness gesture and retry labeling must be explicitly specified and accepted. No failure automatically supplies no-history defaults, erases an owned draft or injects canonical planning input.

## 5. Current parent mount and partial-source visibility

AppContent mounts the gated Health local reader independently of remote-bootstrap readiness. HealthView's selected-day panel sits **outside** `HealthWorkoutComposition`. The composition requires no previous-currentness rejection, settled B1 and `result.legacyStatus === 'success'`. Desktop Previous is inside it; calendar is inside it and also behind supporting-panel visibility loading. #770 added rejection provenance/currentness checks, not source-partial public availability policy.

The mobile `PreviousWorkoutSheet` call remains outside the composition guard, with `open = isPreviousSheetOpen && isMobile`. An already-open sheet may consume its independently fenced range projection even when desktop siblings are unmounted. This is not a promise the user can open it from every failed state: controls inside the removed composition may be unreachable. No projection test proves physical desktop/mobile parity.

| Current candidate state | Selected-day panel / editor | Desktop Previous + calendar | Already-open mobile Previous |
| --- | --- | --- | --- |
| B1 loading/old publication withheld; range healthy | B1 loading; editor withheld | Composition withheld despite healthy independent range | May show its independently qualified range view |
| B1 legacy ordinary failure + canonical healthy; range canonical healthy | Canonical read-only partial panel remains; legacy editor withheld | Healthy canonical range buckets/activity are hidden by parent guard | May show canonical partial/success according to its own range result |
| B1 legacy healthy + canonical ordinary failure; no typed rejection | Legacy partial panel/editor can remain; canonical unavailable, not empty | Composition mounted; qualified range legacy buckets/presence can remain, unknown elsewhere | Same range projection when open; physical layout/reachability unqualified |
| Both B1 ordinary sources fail; independently healthy range | B1 unavailable; editor withheld | Composition withheld; independent range does not waive guard | Own range state, not automatically identical to B1 |
| Typed B1/range or legacy-owner rejection | #770 effective previous rejection suppresses panel records/legacyDaily and composition; old proof not readmitted by loading/null | Withheld; no fallback to contaminated/old evidence | Its own range trust result governs; isolated range withholds records. A blanket new cross-reader public recovery policy is not inferred |
| Both B1 sources verified empty | Persisted-day empty only when no dirty draft; empty legacy editor remains distinct | Each child's independently covered range result governs | Bounded projection result, not all-time absence |
| Canonical-only / mixed / multiple same-day sessions | Separate canonical read-only sessions; legacy draft never adopted/locked from them | Range keeps source-separated eligible date buckets; calendar uses date union | Same projection semantics, not proven identical interaction |

`PARENT_PARTIAL_SOURCE_AVAILABILITY = REQUIRES_PRODUCT_DECISION`.

The decision package should compare all-or-nothing versus source-partial composition, then specify selected-day/editor/Previous/calendar eligibility, desktop/mobile reachability/parity, ordinary unavailable versus typed distrust, bounded empty states and exact retry ownership. Preserve editor trust and draft ownership in every option. Do not implement a guard removal, reinterpret isolation, choose automatic repair/adoption or make a product-owner choice here.

## 6. Public presentation and accessibility inventory

| Surface | Current source evidence | Remaining work and approval boundary |
| --- | --- | --- |
| Selected-day | Semantic section/headings; loading/status and unavailable/isolation alerts; source-separated records; null != zero | Hard-coded English title/arrow aria labels/Refresh/status notices; ISO selected date without live selected-date announcement; UUID session labels, Exercise ID/tags/type/cardio enums, raw kind/done/dropset. Human-readable session/source model, localized controls, recovery guidance and legacy Save/Delete scope need implementation after state decision, then human copy/AT acceptance |
| Previous | Localized loading/retry/read-only/source labels; date group aria-label and selected aria-pressed; same-date sessions retained | Complete no-bucket `previousWorkoutEmpty` does not state the one-calendar-year/eligible-record bound. Ordinary error and isolation share `workoutCompositeSourcesError`. Session/entry/set IDs, types/cardio/raw booleans remain debug-oriented. Decide public session naming, source-specific recovery and desktop/sheet parity; no session winner/merge or all-time empty claim |
| Calendar | Visible incomplete role=status + retry; known-present dot, unknown `?` with localized aria-label, covered verified absence; localized month navigation | Mo/Tu/etc. hard-coded; visible grid day buttons are numeric, without full-date/selected-state association. Incomplete banner does not distinguish loading/error/isolation recovery. Unknown discoverability, non-color presence, focus/date announcement and selected/today states need source correction and real AT QA. The separately coded mobile strip is `hidden`; its tests do not qualify a visible mobile strip |
| Legacy previous-currentness | Four appended EN/KO/JA strings: refreshing, unavailable, suppressed, per-query no-match; source-state automated acceptance PASS | Final public terms/placement/recovery gesture NOT accepted. NO_MATCH is this exact block/cutoff, not whole-history empty. Repeated per-card status/alert behavior and interaction with B1/range states need approved public treatment |
| Bootstrap/offline | B1-enabled local reader can mount while remote bootstrap pending/failed; local source verification remains required | Pending notice hard-coded English; distinguish remote recovery retry from local source Refresh and compatibility-currentness recovery. Verified local day/range is never cloud, cross-device or all-time completeness. Other routine/InBody/static sources have independent eligibility |

`SELECTED_DAY_PRESENTATION = REQUIRES_STATE_DECISION_THEN_CORRECTION_AND_PUBLIC_ACCEPTANCE`.
`PREVIOUS_PRESENTATION = REQUIRES_STATE_DECISION_THEN_CORRECTION_AND_PUBLIC_ACCEPTANCE`.
`CALENDAR_PRESENTATION = REQUIRES_CORRECTION_AND_PUBLIC_ACCEPTANCE` (its eligibility still depends on the parent decision).
`ACCESSIBILITY_SOURCE_READINESS = PARTIALLY_SATISFIED_REQUIRES_SOURCE_CORRECTION_AND_REAL_AT_QA`.

Source accessibility support is not physical AT acceptance. Future correction/QA must cover localized full-date names, selected/today/present/absent/unknown associations, context for repeated controls/sessions, keyboard order/visible focus, focus after date/retry, status/alert frequency, non-color cues, target sizing, zoom/reflow/contrast and sheet focus trap/restore/scrolling. Happy-dom roles/aria assertions do not establish a WCAG or real-browser/AT PASS.

## 7. Identity blocker versus actionable product work

[readEstablishedWorkoutDeviceId](../src/lib/workoutLocalReaderAuthority.ts) still preserves an established accepted value, throws on a malformed established mirror and creates only for a missing key. The existing broad `/^[0-9a-f-]{36}$/i` is not strict UUID validation: 36 `a` characters pass it, while namespace-unsafe accepted shapes can fail opening. Retry cannot reconstruct a trustworthy original identity. No syntax tightening, alias, mirror rotation, repair-by-init or writer-session eviction is introduced.

```text
REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION
REL05G5A_001_READER_ONLY_CORRECTION_FEASIBLE = NO
CURRENT_PRODUCTION_AUTHORITATIVE_PROVENANCE_SOURCE = NOT_FOUND
PRODUCTION_EXACT_ORIGINAL_PROVENANCE_AVAILABLE = NO
PROSPECTIVE_PROVENANCE_PD01 = HOLD_NO_CAPABILITY_SELECTION_YET
SELECTED_PROVENANCE_CAPABILITY = NONE
REL05G5A_001_ACTIONABILITY = BLOCKED_BY_FROZEN_PRODUCT_AUTHORITY
```

NO/NOT_FOUND concerns the current verified repository-defined source set, not universal absence of external historical evidence. No external acquisition is authorized here. Approved Policy F does not supply its missing provenance, writer continuity or exact-target control. HOLD is not selection of option A or B/C/D/E, and authorizes no automatic feasibility research, collection, architecture or recovery implementation.

This remains a hard public-activation blocker even if source-partial UI is improved. Non-destructive public unavailable copy is possible later, but cannot close canonical availability/reachability by itself. Work on unrelated public semantics can proceed as separately authorized planning while this veto remains; a release cannot bypass it by calling legacy partial success coherent global availability.

## 8. Whole-parent performance and feature QA, not execution

`PERFORMANCE_READINESS = REQUIRES_PRODUCT_DECISION_AND_MEASUREMENT`; `PERFORMANCE_ACCEPTANCE = NOT_EXECUTED`.

The future comparison-OFF candidate has distinct physical sources: B1 verified legacy selected-day read + canonical query; canonical date query lists active-domain sessions before filtering ([repository](../src/lib/workoutSessionRepository.ts)). Range loads its own verified legacy `readAll` + canonical active-domain scan, then shares in-memory Previous/month projections. [Previous adapter](../src/components/views/features/health/prevWorkoutFetch.ts) is a separate all-prior legacy read path; D coalesces matching query/lifetime dependencies, with qualified warm negatives avoiding extra reads. B1/range pairs are not collapsed into one universal pair by sharing a driver. Focus/retry/bootstrap/save/delete can reload both plus affected legacy previous evidence; metadata/current-generation verification and bounded recovery also cost work. Comparison OFF removes the child, not these parent costs.

Reviewed 1/20/100-consumer coalescing/read-count assertions are not latency/tail/memory acceptance. Earlier comparison-only TEMP CPU measurements are neither persisted I/O nor this whole candidate. Before measurement, the owner must choose representative/max legacy rows, canonical sessions/entries/sets, active cards/routine size, supported device/browser/mode classes, cold/warm/retry definitions, latency/tail/main-thread/memory/read budgets and background/focus/offline recovery expectations. No numeric threshold, supported scale or device approval is invented here.

After those decisions and reviewed implementation, measure the whole visible candidate: cold/warm/reload, mount/re-entry, B1 date navigation versus range month/Previous derivation, routine assembly/load/manual count, save/delete, partial/error/isolation recovery, focus/retry bursts and large histories. Separate physical reads, derivation, React commit, layout/paint, retained/peak memory and user-perceived/tail latency. Record reproducible environment/raw evidence and approved PASS criteria before calling acceptance complete.

`FEATURE_LEVEL_PUBLIC_READER_QA = REQUIRES_APPROVED_PROTOCOL_AND_PHYSICAL_EXECUTION`; `PHYSICAL_BROWSER_QA = NOT_EXECUTED`.

| Future protocol slice | Required cases after support/state decisions | Current evidence ceiling |
| --- | --- | --- |
| Desktop | Confirm supported Windows Edge normal-browser version/mode; mount/reload/focus; account/date ABA; success/partial/ordinary error/typed and persisted isolation; canonical-only/mixed/multiple sessions; offline/remote bootstrap vs local evidence; local and remote retry purposes; save/delete, prevData statuses, routine assembly, Previous/calendar; wide/narrow, light/dark, EN/KO/JA | Planning matrix only; not physical execution or an approved support list |
| Mobile/PWA | Include installed Edge PWA, mobile browser or iPhone Safari/Home Screen only if owner selects that support scope; opening/already-open sheet, navigation/recovery reachability, scrolling, touch/rotation/zoom and parity | Not silently inferred from responsive markup or earlier PATH A evidence |
| Accessibility | Keyboard/focus order and restoration, date/retry announcements, status/alert behavior, unknown/presence semantics and real AT in each approved mode | Source roles/aria and happy-dom tests only; no real AT acceptance |

Global device-lifetime Track A/E3 qualification remains separate and deferred unchanged. Feature-level QA can be required for a bounded public reader without claiming creator exclusion, lifetime admission, writer continuity or E3. This task executes neither protocol.

## 9. Home/Search coherence and separate comparison child

[Home](../src/components/views/HomeView.tsx) and [H gate](../src/components/views/features/home/homeWorkoutCompositeConfig.ts) are not Health mount/runtime dependencies. H ON uses shared selected-day ownership at today and draft-precedence/source-separated projection; that default-OFF integration already exists. H OFF receives legacy `workouts` from the AppContent selected-date foundation while rendering today-facing workout/draft claims; canonical-only presence can be omitted and `homeWorkoutEmpty` can falsely imply no workout today. Health could be truthful with H OFF only after separately approved, actually visible Home scope/limitation or correction. A notice only inside Health does not repair Home's claim. No automatic H activation or bundled implementation is recommended.

[Search S](../src/components/views/features/search/searchWorkoutCompositeConfig.ts) likewise is not a Health runtime dependency. S OFF legacy/catalog/current-date discovery and generic no-results must not be comprehensive saved composite-history claims. The already merged [S preview projection](../src/components/views/features/search/searchWorkoutCompositeProjection.ts) uses current qualified palette lifetime, selected-day saved name-only source-separated identities and read-only date navigation; it is not editing/global history. Shared range ownership does not authorize Search, Health Previous/calendar or comparison. Separate truthful visible scope/coherence decisions remain; do not resurrect obsolete D0 scan-foundation implementation debt.

`HOME_COHERENCE = SEPARATE_PRODUCT_COHERENCE_DECISION_NOT_RUNTIME_DEPENDENCY`.
`SEARCH_COHERENCE = SEPARATE_PRODUCT_COHERENCE_DECISION_NOT_RUNTIME_DEPENDENCY`.

[Comparison C](../src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts) is a separate child: effective enable requires Health range eligibility AND C. It is not required to display qualified selected-day/Previous/calendar facts. Parent/currentness closure does not close comparison's public presentation/QA/support/approval gate. `COMPARISON_PUBLIC_STATUS = DEFAULT_OFF_PUBLIC_C30_NOT_EXECUTED`; `PUBLIC_C30 = NOT_EXECUTED`.

B1-only remains incoherent as written for a composite public parent: selected-day canonical evidence would be visible while old Previous/calendar exclude it; a deliberately limited B1-only product would require a new explicit limitation/state decision. Range-only cannot be the independent public Health mode because effective Health R depends on B1. Search's qualified shared range when Health R is OFF is a different lifetime, not a workaround. Hence B1 + R together, C OFF is still the best bounded future candidate, not a release approval; H/S remain separate decisions.

## 10. Dependency graph and exact next task

The graph distinguishes completed automated foundations from decisions, implementation, evidence and frozen vetoes:

```text
A SATISFIED: #763 persisted distrust + #769 D policy + #770 automated currentness
  + reviewed source separation / bounded range / save-delete fences
  |
  v
C FIRST: parent partial-source availability decision (NOT_SELECTED)
  | defines actual visible state/control model and desktop/mobile parity
  v
C public terms / empty-unavailable-isolation / recovery / action-scope decisions
  v
B separately authorized default-OFF presentation/accessibility implementation
  |
  +------ C performance + device/mode/data-scale support decisions --------+
  |                                                                     |
  v                                                                     v
D feature physical browser/AT protocol + execution       D whole-parent measurement
  |                                                                     |
  +-------- reviewed public copy / feature / performance acceptance ------+
  |             + separate Home/Search visible-coherence decisions
  v
C explicit coupled public-scope/activation approval -> separate activation PR
  ^
  | HARD VETO, not next authorized implementation:
E REL05G5A-001 -> proven original provenance + writer/control proof prerequisites
  blocked by HOLD / no selected capability; cannot be bypassed by UI/QA success

F global writer/G6 rollout and blanket Track A/B/C/D closure: deferred/separate
  not a universal prerequisite for existing-scope bounded read-only display
  but recovery/admission proposals must satisfy their own proof dependencies
```

Among the five sequencing candidates, partial-source semantics is first **for substantive public UI work**: it changes whether the read-only siblings and retries are visible, so copy implementation before that choice would bake in an unapproved state model. Public language follows; support/performance decisions can be developed in parallel without choosing thresholds here; the physical protocol can be planned but final execution requires reviewed UI/support scope. Provenance HOLD is a release veto, not authority to start a recovery mechanism or choose B/C/D/E. Resolving that veto would require a separate human-authorized authority workstream, not automatic priority inversion into forbidden implementation.

```text
NEXT_SUBSTANTIVE_TASK = REL_05G_HEALTH_PARENT_PARTIAL_SOURCE_AVAILABILITY_PRODUCT_DECISION_01
NEXT_TASK_RATIONALE = Decide visible partial-source states, desktop/mobile parity and retry ownership before public presentation implementation and its QA matrix.
```

Recommended decision scope: all-or-nothing versus source-partial composition; independently healthy canonical/range visibility while legacy editor is unavailable; selected-day/Previous/calendar eligibility and reachability; desktop/mobile parity; local source retry versus compatibility-currentness and remote bootstrap retry; truthful bounded empty/unavailable/isolation semantics. Preserve draft ownership, source isolation, no canonical writer/planning/adoption and all gates OFF. Compare/recommend options and obtain an explicit human decision only in the separately authorized package; no approval is recorded here.

## 11. Frozen authority and publication validation

Literal production values reverified in current source: [B1](../src/components/views/features/health/healthSelectedDayCompositeConfig.ts), [R](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts), [C](../src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts), [H](../src/components/views/features/home/homeWorkoutCompositeConfig.ts), [S](../src/components/views/features/search/searchWorkoutCompositeConfig.ts) all false.

```text
ALL_FIVE_GATES = false
PUBLIC_READER_ACTIVATION = NOT_AUTHORIZED
HEALTH_PARENT_PUBLIC_READER_ACTIVATION = NOT_AUTHORIZED
PROSPECTIVE_PROVENANCE_PD01 = HOLD_NO_CAPABILITY_SELECTION_YET
SELECTED_PROVENANCE_CAPABILITY = NONE
REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION
WRITER_CONTINUITY_STATUS = NOT_YET_PROVEN
E3_FEASIBILITY = NOT_ESTABLISHED
LIFECYCLE_EVIDENCE_SOURCE = REMAINS_UNAVAILABLE
EXACT_TARGET_CONTROL_PROTOCOL = NOT_IMPLEMENTED
SEVEN_LIVE_WRITER_BLOCKERS = OPEN
PERFORMANCE_ACCEPTANCE = NOT_EXECUTED
PUBLIC_COPY_ACCEPTANCE = NOT_EXECUTED
PHYSICAL_BROWSER_QA = NOT_EXECUTED
PREVDATA_C15_PUBLIC_ACCEPTANCE = NOT_EXECUTED
```

DB7/schema1/WorkoutSessionV1/stores/indexes/keyPaths/backend/Supabase/RLS and writer authority remain unchanged. No durable freshness metadata, registry/API, canonical write/adoption/bind/push/pull/resync/reset/G6 or physical qualification is added. K320A ZIP-directory timestamp risk and K333B Windows CRLF fixture-anchor issue remain unrelated residuals, neither fixed nor closed by this publication.

Docs scope is exactly this new rebaseline and the existing prevData implementation evidence closure. The earlier parent/comparison/identity/reader-expansion artifacts are not rewritten. Validate relative links, docs-only unstaged/staged/committed diff, exact baseline and repository cleanliness; normal topic commit/push and Draft PR targeting main. The unchanged normal workflow runs all five jobs for Push and PR; require new exact-head success before review handoff, do not substitute #770's post-merge CI. No costly full local suite is required solely for prose, and no physical/browser/AT measurement is run. Actual head/run IDs and outcomes are recorded in the PR body/publication report, not invented in advance.

Required next publication action: `INDEPENDENT_REVIEW_REL_05G_HEALTH_PARENT_POSTMERGE_EVIDENCE_AND_PUBLIC_READINESS_REBASELINE_01`. Keep Draft; do not Ready, merge or auto-merge. This new docs package's independent review is pending; completed #770 implementation review is not self-approval of the rebaseline recommendation.
