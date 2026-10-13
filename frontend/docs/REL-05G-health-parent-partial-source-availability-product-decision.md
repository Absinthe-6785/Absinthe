# REL-05G Health parent partial-source availability product decision

Task: `REL_05G_HEALTH_PARENT_PARTIAL_SOURCE_AVAILABILITY_PRODUCT_DECISION_01`.

Status: `PRODUCT_DECISION_PENDING_HUMAN_APPROVAL`. This is a docs-only product/architecture recommendation. No availability policy is selected by publication, review, CI or merge. No implementation, public copy, physical QA, performance acceptance, provenance recovery or activation is included.

## 1. Exact baseline and authority ceiling

Repository: `Absinthe-6785/Absinthe`; canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`. Current main independently verified on 2026-10-13 (UTC+09:00): `5ad12bb973a37e35164fd3124ed69da9b0ef8cbd`.

- [PR #771](https://github.com/Absinthe-6785/Absinthe/pull/771): MERGED/CLOSED; reviewed/final head `7e3abac779060322d3bd9f029f4bb8975d617ccb`; merge equals this baseline. Initial review at `3fe67d954fc58966dee72c02cc9ddd692cec5837` was CHANGES_REQUIRED (0/0/0/1); the one-sentence correction received independent REREVIEW_PASS (0/0/0/0), PR771-R01 CLOSED, then Final Merge Gate PASS and human merge.
- [Post-merge CI 38337906850](https://github.com/Absinthe-6785/Absinthe/actions/runs/38337906850): exact baseline, test/typecheck/build/backend-rel05g1/backend-recovery completed/success (5/5). This is baseline regression evidence, not the new decision head's CI or product approval.
- Current authority is the [merged post-prevData rebaseline](REL-05G-health-parent-public-readiness-post-prevdata-rebaseline.md). Its publication-time pending-review labels are historical after #771 closure. Its substantive conclusion remains `HEALTH_PARENT_PUBLIC_ACTIVATION_STILL_BLOCKED`.
- B1 ON + range ON + comparison OFF remains the best bounded **future candidate**, RECOMMENDED / NOT APPROVED. B1/R/C/H/S are all literally OFF in production. This package analyzes that candidate, not shipped gate-ON behavior.

```text
SELECTED_DAY_PERSISTED_ISOLATION_PREREQUISITE = SATISFIED
AUTOMATED_CURRENTNESS_PREREQUISITE = SATISFIED
PUBLIC_READER_CURRENTNESS_PREREQUISITE = IMPLEMENTED_AUTOMATED_ACCEPTANCE_COMPLETE_PUBLIC_ACCEPTANCE_PENDING
PARENT_PARTIAL_SOURCE_AVAILABILITY = REQUIRES_PRODUCT_DECISION
PARTIAL_SOURCE_POLICY_ALREADY_SELECTED = NO
PRODUCT_OWNER_DECISION = REQUIRED
PRODUCT_OWNER_APPROVAL = NOT_YET_PERFORMED
```

## 2. Inputs, chronology and problem

Current-main inputs cross-checked for their relevant source/trust/product boundaries:

1. [Post-prevData rebaseline](REL-05G-health-parent-public-readiness-post-prevdata-rebaseline.md): current sequencing, mount asymmetry and frozen vetoes.
2. [Earlier parent characterization](REL-05G-health-selected-day-range-parent-public-readiness-characterization.md): source/control graph, bounded history and actual uncertainty rendering. Its old B1 persisted-isolation and prevData implementation debts are superseded by #763/#770, not reopened.
3. [PrevData D product decision](REL-05G-health-parent-legacy-prevdata-freshness-product-decision.md): independently owned legacy currentness, no-reseed and no borrowed child revision. Its publication-time implementation-pending text is historical.
4. [Merged prevData implementation evidence](REL-05G-health-parent-legacy-prevdata-freshness-implementation.md): R01-R05 CLOSED, C01-C14 and C15 source-state PASS; public C15 NOT_EXECUTED; real legacy-adapter typed-isolation path NOT_ESTABLISHED.
5. [Comparison public readiness](REL-05G-workout-exercise-comparison-public-readiness-characterization.md): comparison remains a separate child, PUBLIC_C30 NOT_EXECUTED, preview/feature/global qualification distinct.
6. [Established-ID characterization](REL-05G-health-parent-established-device-id-correction-characterization.md): malformed identity is not emptiness; reader-only recovery infeasible; retained bytes are not reachability proof.
7. [Identity recovery contract](REL-05G-health-parent-established-identity-recovery-contract-and-product-decision.md): no guessed/new recovery target; writer/provenance proof and finite transient-episode retry ceiling, especially section 11 PD08-A.
8. [Prospective provenance HOLD](REL-05G-health-id-prospective-provenance-capability-product-architecture-decision.md): HOLD is not permanent option A, no capability selected, no automatic research/collection.
9. [Reader expansion preparation](REL-05G5B2B2-product-reader-expansion-prep.md): source/date/session separation, qualified partial records, complete covered absence only, private read capabilities and bounded source ownership. Earlier range/Home/Search implementation handoffs are historical, not missing foundations now.

The question is not whether partial projection data exists. It is which **visible and interactive** Health workout surfaces should remain available when an independent reader is healthy but another is loading, ordinarily unavailable or distrusted. The current conditional layout can hide healthy history on desktop while an already-open mobile sheet still shows it. That structural accident is not approved product policy.

## 3. Current source ownership and mount graph

The current source, not projection code alone, was inspected at the baseline:

| Owner / current source | Verified behavior and line anchors |
| --- | --- |
| [AppContent](../src/components/AppContent.tsx) | B1 / range eligibility at 293-303; separate B1 paired owner at 313-318 and shared range owner at 342-350. Local fanout 366-369 invokes range invalidation then B1 retry. Commit callback 370-379 fences the captured/current account. Wrappers 380-387 expose that common fanout as B1 and range UI retry. Remote bootstrap controls 575-595 are separate. |
| [HealthView](../src/components/views/HealthView.tsx) | D trust dependencies/recovery 404-430; paired panel outside composition 1643-1648; composition guard 1649-1651; desktop Previous 1779-1790; supporting Calendar 2433-2455; mobile sheet call 2460 onward outside the exact composition. |
| [Selected-day panel](../src/components/views/features/health/HealthSelectedDayCompositePanel.tsx) | Own loading/ordinary partial/error/isolation/complete-empty markup and canonical read-only records; dirty draft suppresses its persisted-day empty headline. Refresh is the supplied model callback, not an independent universal recovery operation. |
| [Supporting panels](../src/components/views/features/health/HealthSupportingPanels.tsx) | Calendar is also visibility-lazy behind a skeleton; the same wrapper contains independently owned InBody Save and nutrition. Moving that entire wrapper would broaden scope beyond workout availability. |
| [Desktop Previous](../src/components/views/features/health/CompositePreviousWorkoutView.tsx) / [mobile sheet](../src/components/views/features/health/PreviousWorkoutSheet.tsx) | Same projection component, different containment/scroll/modal presentation. Loading/error/isolation/partial/no-bucket branches precede records. Current generic error/isolation copy and public bounded-empty language need later work. |
| [Calendar](../src/components/views/features/health/WorkoutMonthCalendar.tsx) / [activity](../src/components/views/features/health/workoutCalendarActivity.ts) | Visible grid, known-present dot and unknown `?`, complete covered absence only. The separate horizontal strip is hidden, not an approved mobile surface. Navigation changes read context, not writer permission. |
| [B1 hook](../src/components/views/features/health/useHealthSelectedDayComposite.ts) | Current account/date/request/mount fences; visible loading returns no old pair. Typed error withholds result and legacyDaily. Ordinary failure composes partial/error; private retained daily identity is not exposed while loading. |
| [Range hook](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts) | `invalidateAndReload` revokes sequence, coordinator and publication; range derives Previous/month views in memory. Typed error withholds both views. Old publication is not shown as current during reload. |
| [D hook](../src/components/views/features/health/useLegacyPreviousCurrentness.ts) / [D owner](../src/components/views/features/health/legacyPreviousCurrentness.ts) | Rejection provenance remains latched through loading/null/ordinary retry failure. Matching affirmative recovery is required, not sibling success or value equality. Ordinary currentness failure withholds cues/default seeding without destroying the user draft. |
| [Selected-day reader](../src/lib/workoutSelectedDayReader.ts) / [range reader](../src/lib/workoutRangeReader.ts) | Persisted account/namespace/generation mismatch -> typed isolation; UNTRUSTED_SCOPE -> INVALID_CONTEXT; trusted-scope invalid content remains ordinary error. Identity/open failure is distinct; neither reader supplies identity repair. |

```text
Current authenticated AppContent / current account
  B1 selected-day pair (legacy daily + canonical day)
  range pair (verified legacy snapshot + canonical active-domain snapshot)
    -> independently derived Previous + month activity
  HealthView / current selected day
    selected-day panel [outside composition, but effective D rejection suppresses it]
    conditional HealthWorkoutComposition
      legacy editable draft / routine controls
      desktop Previous
      supporting Calendar + unrelated supporting domains
    mobile Previous sheet [outside exact composition; same range projection]
    D currentness owner [legacy block/cutoff; separate from bounded Previous]
```

## 4. Existing asymmetry and four separate permissions

Composition requires settled B1 legacy success and no effective `previousRejected`. Thus B1 legacy ordinary failure/loading hides desktop Previous/Calendar even when range is healthy. An already-open sheet may retain its **own** qualified range result, but its opener inside the disappearing composition may be unreachable. Neither reachability nor physical parity is proven by a projection test.

| Layer | Contract question | What it never proves |
| --- | --- | --- |
| COMPONENT_MOUNT | Does an admitted Health workout shell/slot exist? | That its source data is qualified |
| VISIBLE_SURFACE | Are header/status/navigation/records currently rendered? | That records or actions are authorized |
| SOURCE_DATA_QUALIFICATION | Does the reader's current proof permit this exact source/scope payload? | Writable editor state or continuous/cloud completeness |
| INTERACTION_AUTHORITY | Is this navigation/retry/edit/save/delete action admitted now? | Authority from visibility, a mount, a dirty draft or another source's success |

Stable shell means stable structural/status slots within an admitted account/date Health lifetime, not keeping a reader, foreign data or modal across sign-out/account change. Visibility-lazy rendering may use an accessible placeholder; it must not remove recovery reachability because an unrelated source failed.

## 5. Hard invariants and existing distrust dependency graph

All options below preserve these constraints:

- Keep legacy persisted rows/date groups and each canonical session/entry/set source-qualified. No merged session, content dedupe, chronology guess, canonical hydration/adoption/copy-to-plan or PR/count formula change.
- Ordinary source error permits only independently qualified surviving source evidence. Both ordinary failures are unavailable. Failed or missing evidence is never complete empty.
- B1 typed isolation withholds its **entire paired publication**, including legacyDaily; range typed isolation withholds its entire range pair and derived records. No selective salvage of a lane within a rejected pair.
- Preserve the existing D dependencies: either B1/range typed rejection feeds the trust latch; effective D/parent rejection suppresses compatibility evidence **and the effective selected-day panel/editor**, even if raw B1 data looks healthy. This package does not remove that dependency, narrow the latch or map ordinary corruption into a new typed category.
- A separately current range publication may support read-only Previous/Calendar despite a B1/D rejection only when its own owner/account/device/namespace/generation/bounds fences still qualify. B1/D failure neither certifies nor revokes that independent publication by UI inference. If range is itself rejected, stale, foreign, superseded or unverified, no range records survive. Shared identity changes are still handled by each existing owner, never ignored because a sibling previously succeeded.
- Recovery of the latched dependencies retains #770's matching affirmative B1/range complete-proof requirements and admitted new-scope rules. Loading, null cache identity, partial success, ordinary failure or D-only retry cannot erase rejection. A same-value account/date/ID return cannot revive an old lifetime.
- D ordinary UNAVAILABLE/REFRESHING differs from effective rejection: it withholds historical badges/cues/new history-derived seeding, not otherwise valid manual/preset counts or existing owned drafts. No new legacy typed path is claimed; `REAL_LEGACY_TYPED_ISOLATION_PATH = NOT_ESTABLISHED`.
- Preserve same-account/date dirty drafts; never publish them as persisted proof. Retention does not permit unsafe Save/Delete or transfer into another lifetime. In-flight durable commit/account fanout semantics remain unchanged.
- Invalid/sign-out/foreign context withholds all data/actions; none of the matrices is a substitute for account/scope admission. No identity repair, writer shutdown, store clearing or device allocation is authorized.

The following is a visibility recommendation over existing trust outcomes, **not a new trust rule**. If safe decoupling cannot preserve these dependencies, STOP the later implementation design; do not make the UI resilient by weakening them.

## 6. Option A — ALL_OR_NOTHING_PARENT_COMPOSITION

`OPTION_A = VIABLE_CONDITIONAL_ALL_OR_NOTHING_NOT_RECOMMENDED`.

Use the current legacy-parent eligibility as the gate for editor, desktop Previous, mobile Previous and Calendar together. Selected-day diagnostics/qualified partial panel remains intentionally separate, under its effective trust rule. On lost eligibility, composition records and controls disappear; a persistent external unavailable/loading/isolation notice retains permitted retry/navigation. Close the mobile record presentation too; preserve dirty draft memory and same-scope selection intent privately, never old records.

Benefits: one availability rule, intentional parity, fewer mixed layouts. Costs: discards useful qualified range evidence from visible desktop **and mobile** whenever legacy B1 fails; ties local read-only history to editor availability; repeated layout/focus disruption. It is source-safe but sacrifices local-first utility. Empty editor/day does not imply empty Previous/month. The external recovery notice is required, not an optional implementation detail. It needs no new source reads by itself, but remount/focus effects must not multiply existing owner reads.

## 7. Option B — SOURCE_PARTIAL_PARENT_COMPOSITION

`OPTION_B = VIABLE_CONDITIONAL_SOURCE_PARTIAL_NOT_RECOMMENDED`.

Each read-only record body is conditionally mounted from its own current qualified result. A status/retry stub remains reachable outside the unavailable body; Previous's mobile opener is not inside legacy editor eligibility. The editor remains conditional. Calendar's data grid is present for complete/partial qualified activity; loading/error/isolation shows a status stub rather than an always-visible unknown grid. An open mobile sheet changes to the same qualified-body/status-stub semantics as desktop, not a privileged old-data path.

Benefits: qualified local facts survive unrelated ordinary errors; smaller possible layout extraction than a stable shell. Costs: individual record bodies/grids still appear/disappear; retry/focus/selection placement is distributed; accessibility and layout continuity require more distinct paths. A collection of independently conditional regions without permanent reachable stubs is **not** this option. It reuses existing source owners, not one scan per card. B is an admissible product choice, not an implicit approval of current ad hoc asymmetry.

## 8. Option C — HYBRID_STRUCTURAL_SHELL_WITH_SOURCE_QUALIFIED_CHILDREN

`OPTION_C = VIABLE_CONDITIONAL_STABLE_SHELL_RECOMMENDED`.

An admitted Health workout parent has stable selected-day, legacy-draft, Previous/recovery and Calendar slots. Source bodies are current qualified facts or explicit state surfaces. Keep a calendar date grid with unknown markers under loading/error/isolation, never fabricated absence. A Previous launcher/status is reachable regardless of ordinary editor failure; an open sheet follows the same state machine as desktop. Retain a same-scope dirty draft as a **noninteractive user-draft preview** while editor eligibility is unqualified; do not expose old clean hydrated records as current persisted truth.

Benefits: retains source-separated local-first facts, clear stable recovery locations, intentional desktop/mobile semantics and less focus/layout disappearance. Fail-closed data qualification remains independent of mount. Costs: a reviewed split of the current combined layout; persistent status slots, read-only draft treatment, action admission and retry bridge need design/tests. It is not a wholesale remount of unrelated InBody/nutrition/routine writers, a new cache or a new source reader. Reuse B1/range/D owners; structural mount alone must cause no extra scans/listeners.

No materially better fourth architecture was found within the frozen owners/trust contracts. `OPTION_D = NOT_PROPOSED`; human OTHER/HOLD may request a revised package, not an invented runtime route.

## 9. Complete option state matrices

Every row is scoped to an admitted current account/date/owner. Unless stated, the other reader is complete/current and no prior rejection is latched; a prior latch takes precedence over all ordinary rows. A shown record remains source-qualified. These matrices are **proposed contracts**, not implemented or accepted behavior.

Legend:

- Panel `Q`: own complete qualified state (records or exact bounded empty); `P(C)`/`P(L)`: only successful canonical/legacy evidence with incomplete-source state; `L`: loading, no old records; `U`: ordinary unavailable; `I`: effective paired distrust, no records/legacyDaily.
- Editor `E`: minimum read eligibility satisfied, existing lock/draft/formula/write admission still applies; **not an unconditional writable permission**. `H`: composition hidden, dirty draft preserved privately. `F`: same-scope dirty draft preview only, all editing/planning/Save/Delete fenced; otherwise unavailable placeholder. `E(draft)` preserves the dirty draft independently of canonical evidence.
- Previous `Q/P`: qualified complete/partial date buckets; `L/U/I`: state only, no old records; `N`: complete no eligible bucket; `PN`: partial no surviving eligible record (not empty); `H`: parent-withheld status outside record body. Mobile `=` means exactly desktop's semantic state, whether closed/open; the launcher remains reachable for B/C.
- Calendar `K`: current known-present union / covered verified absence / unknown elsewhere; `KP`: surviving known presence, unknown everywhere not proven present; `?L/?U/?I`: mounted unknown grid plus distinct loading/unavailable/isolation status (C); `stub L/U/I` (B); `H` (A). Neither `KP` nor `?I` exposes stale dots or verified absence.
- Retry `B1`, `R`, `D`, `RB`: selected-day, range, D-currentness and remote-bootstrap owners. `B1/R` is the **existing paired local UI fanout**, not two duplicate wrapper calls. `LOCAL` is the proposed explicit B1 + R + D parent gesture. All are **permitted-owner requests only**, subject to section 15 finite/unchanged-deterministic-failure rules. `T` means no blind retry: guarded scoped re-read only when existing trust/retry contracts permit it; otherwise status/escalation. `—` means no recovery action required for that row.

### A: conditional parent composition

| # / State | Selected-day panel | Legacy editor | Desktop Previous | Mobile Previous | Calendar | Retry controls | Public semantic classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 B1 loading, range healthy | L | H | H | = | H | B1/R after current flight, guarded | Parent refreshing; healthy history intentionally withheld |
| 2 Legacy B1 ordinary failure, canonical/range healthy | P(C) | H | H | = | H | B1/R; D separately if unqualified | Partial day, composition unavailable; not empty |
| 3 Canonical B1 ordinary failure, legacy/range healthy | P(L) | E | Q | = | K | B1/R subject to identity rule | Legacy editable eligibility, canonical unavailable |
| 4 Both B1 ordinary errors, range healthy | U | H | H | = | H | B1/R | Parent unavailable despite healthy range |
| 5 B1 complete, range loading | Q | E | L | = | ?L | B1/R when admitted | Range refreshing; no old history/absence |
| 6 B1 complete, range one-source ordinary partial | Q | E | P | = | KP | B1/R | Source-qualified partial range |
| 7 B1 complete, both range ordinary errors | Q | E | U | = | ?U | B1/R | Range unavailable, not empty |
| 8 B1 typed isolation, independently qualified range | I | H | H | = | H | T(B1/R); no D-only clearance | Paired B1/parent distrust |
| 9 Range typed isolation | I via D latch | H | H | = | H | T(B1/R) | Range distrust plus existing parent rejection |
| 10 Effective D owner rejection, range independently qualified | I | H | H | = | H | T; valid new/recovered scope required | Rejected compatibility parent, not no-history |
| 11 Both selected-day sources verified empty, no dirty draft | Q: empty day | E: empty legacy draft | Q from range | = | K | — | VERIFIED_EMPTY_DAY, not all-history absence |
| 12 Complete range, no eligible Previous bucket | Q | E | N | = | K | — | NO_ELIGIBLE_PREVIOUS_BUCKET within window |
| 13 Partial range, no surviving Previous record | Q | E | PN | = | KP | B1/R | PARTIAL_NO_SURVIVING_RECORD; calendar predicate separate |
| 14 Covered complete Calendar absence | Q | E | Q | = | K: absent on covered date | — | Verified local date absence only |
| 15 Unknown/uncovered Calendar date | Q | E | Q/P as own view | = | K/KP: ? on that date | B1/R only for failure, not merely bounds | UNKNOWN_CALENDAR_DATE |
| 16 Remote bootstrap pending/failed, local healthy | Q | E | Q | = | K | RB separately; local controls unchanged | Local verified evidence, remote recovery incomplete |
| 17 Offline, local proof still qualified | Q | E | Q | = | K | No network-only invalidation; local request allowed | Local as-of truth, not cloud completeness |
| 18 Dirty draft + canonical-only persisted day; legacy verified empty | Q: canonical + separate draft distinction | E(draft) | Q | = | K | — | Unsaved legacy draft != canonical persisted session |

Calendar's ?L/?U states in A are visible only when parent eligibility remains valid (rows 5/7); A does not invent an all-unknown grid when its composition itself is withheld.

### B: independently conditional record bodies and external status stubs

| # / State | Selected-day panel | Legacy editor | Desktop Previous | Mobile Previous | Calendar | Retry controls | Public semantic classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 B1 loading, range healthy | L | H | Q | = | K | B1/R | Day refreshing, independent range current |
| 2 Legacy B1 ordinary failure, canonical/range healthy | P(C) | H | Q | = | K | B1/R; D as needed | Qualified read-only partial day, editor unavailable |
| 3 Canonical B1 ordinary failure, legacy/range healthy | P(L) | E | Q | = | K | B1/R subject to identity rule | Canonical unavailable, legacy independent |
| 4 Both B1 ordinary errors, range healthy | U | H | Q | = | K | B1/R | Day unavailable; qualified range still available |
| 5 B1 complete, range loading | Q | E | L stub | = | stub L | B1/R | Range refreshing, data bodies withheld |
| 6 B1 complete, range one-source ordinary partial | Q | E | P | = | KP | B1/R | Incomplete source-qualified records/marks |
| 7 B1 complete, both range ordinary errors | Q | E | U stub | = | stub U | B1/R | Range unavailable, no absence claim |
| 8 B1 typed isolation, independently qualified range | I | H | Q only on own current proof | = | K only on own proof | T(B1/R) | B1 distrust; no rejected-lane salvage |
| 9 Range typed isolation | I via D latch | H | I stub | = | stub I | T(B1/R) | Range pair withheld, parent rejection latched |
| 10 Effective D owner rejection, range independently qualified | I | H | Q only on own current proof | = | K only on own proof | T; D cannot reset trust | Parent/compatibility rejected, independent range scoped |
| 11 Both selected-day sources verified empty, no dirty draft | Q: empty day | E: empty legacy draft | Q from range | = | K | — | VERIFIED_EMPTY_DAY only |
| 12 Complete range, no eligible Previous bucket | Q | E | N | = | K | — | Complete bounded no-bucket |
| 13 Partial range, no surviving Previous record | Q | E | PN | = | KP | B1/R | Partial no surviving record, not absence |
| 14 Covered complete Calendar absence | Q | E | Q | = | K: covered absent | — | Exact local date absence |
| 15 Unknown/uncovered Calendar date | Q | E | Q/P | = | K/KP: ? | B1/R only for failure | Unknown, not no workout |
| 16 Remote bootstrap pending/failed, local healthy | Q | E | Q | = | K | RB separate | Verified local scope only |
| 17 Offline, local proof still qualified | Q | E | Q | = | K | Local request allowed; remote separate | Offline is not a source error |
| 18 Dirty draft + canonical-only persisted day; legacy verified empty | Q: canonical distinct | E(draft) | Q | = | K | — | Draft retained, no canonical hydration/lock |

### C: stable structural slots with qualified bodies/statuses

| # / State | Selected-day panel | Legacy editor | Desktop Previous | Mobile Previous | Calendar | Retry controls | Public semantic classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 B1 loading, range healthy | L | F | Q | = | K | LOCAL when permitted; local owner scopes explicit | Day refreshing, current range remains |
| 2 Legacy B1 ordinary failure, canonical/range healthy | P(C) | F | Q | = | K | LOCAL / B1/R; D separate if needed | Read-only partial evidence + unavailable editor |
| 3 Canonical B1 ordinary failure, legacy/range healthy | P(L) | E | Q | = | K | LOCAL eligible owners only | Legacy eligibility independent; canonical unavailable |
| 4 Both B1 ordinary errors, range healthy | U | F | Q | = | K | LOCAL eligible owners | Day unavailable, qualified range usable |
| 5 B1 complete, range loading | Q | E | L | = | ?L | LOCAL / B1/R after admission | Range refreshing, old records/marks withheld |
| 6 B1 complete, range one-source ordinary partial | Q | E | P | = | KP | LOCAL / B1/R | Partial positive facts, unknown remainder |
| 7 B1 complete, both range ordinary errors | Q | E | U | = | ?U | LOCAL eligible owners | Range unavailable, shell stays visible |
| 8 B1 typed isolation, independently qualified range | I | F | Q only on own current proof | = | K only on own proof | T; guarded owners only | Paired B1 distrust, no editor/paired fallback |
| 9 Range typed isolation | I via D latch | F | I | = | ?I | T; matched B1/R recovery required | Range pair withheld and parent rejection retained |
| 10 Effective D owner rejection, range independently qualified | I | F | Q only on own current proof | = | K only on own proof | T; D retry alone insufficient | Rejected parent/currentness, not ordinary partial |
| 11 Both selected-day sources verified empty, no dirty draft | Q: empty day | E: empty legacy draft | Q from range | = | K | — | VERIFIED_EMPTY_DAY, draft and history separate |
| 12 Complete range, no eligible Previous bucket | Q | E | N | = | K | — | Bounded NO_ELIGIBLE_PREVIOUS_BUCKET |
| 13 Partial range, no surviving Previous record | Q | E | PN | = | KP | LOCAL / B1/R | PARTIAL_NO_SURVIVING_RECORD, not empty history |
| 14 Covered complete Calendar absence | Q | E | Q | = | K: covered absent | — | Verified absence for exact covered local date |
| 15 Unknown/uncovered Calendar date | Q | E | Q/P | = | K/KP: ? | Local recovery only for failure | UNKNOWN_CALENDAR_DATE, date navigation allowed |
| 16 Remote bootstrap pending/failed, local healthy | Q | E | Q | = | K | RB separate; LOCAL doesn't retry cloud | Qualified local != remote readiness/completeness |
| 17 Offline, local proof still qualified | Q | E | Q | = | K | No forced network/login; local requests subject to proof | Local as-of availability retained |
| 18 Dirty draft + canonical-only persisted day; legacy verified empty | Q: canonical, no false empty headline | E(draft) | Q | = | K | — | Dirty draft != persisted proof/canonical editor |

Rows 8/10 never promise range success if its own scope was affected. Rows 1-7 assume no old rejection; e.g. B1 complete + range ordinary error cannot clear a previously latched range rejection. Unknown-grid navigation is a date-context action, not proof that the destination is empty or writable.

## 10. Legacy editor contract

For the recommendation, minimum `E` eligibility is the current admitted account/date, settled B1 verified legacy success, no B1/effective D rejection, and the existing draft/lock/workflow eligibility. Canonical ordinary failure alone does not invalidate verified legacy eligibility. Canonical-only persisted day with verified legacy empty permits the **legacy draft lane**, not editing the canonical session. A saved legacy draft remains locked according to the existing editor policy; visibility does not unlock it.

When legacy B1 is loading/ordinarily unavailable or parent/D trust rejected: no hydration, add/routine/history seeding, editing, Save or Delete from the newly visible frozen slot. Preserve a dirty same-scope draft preview under C, without raw rejected persisted-source content or historical cues. Under A/B preserve the draft privately while hiding composition. Qualified D CURRENT/NO_MATCH is still required for new history-derived counts; explicit existing preset/manual counts retain their existing priority when `E` is valid. D ordinary failure alone does not erase or reseed owned counts.

**Implementation-design prerequisite:** the present Save handler (`HealthView` 1215 onward) uses account/date operation fencing; it is not an independent proof of this proposed source-eligibility admission. A stable mounted slot must not expose a hidden callable Save/Delete path merely by disabling a button. Before later integration, prove event/admission guards at all newly reachable mutation paths, account/date ABA and late callbacks, without changing persistence, already-admitted durable operations, optimistic versions or commit fanout. If that requires a frozen writer semantic change, STOP for separate authorization. This document does not claim those guards already exist, approve writes in rejected states or cancel in-flight writes.

Moving Calendar must not automatically expose InBody Save/nutrition/routine controls from `HealthSupportingPanels`. Keep their existing independent source/eligibility contracts; factor only the bounded workout read-only slot if later authorized. No supporting-domain rollout is part of this decision.

## 11. Selected-day panel contract

Intentionally independent from editor visibility, but **not** independent of the existing effective D/B1 rejection dependency. It remains a source panel, not the draft. Loading publishes no old pair. Complete/ordinary partial display only qualified source facts. Ordinary both-error is unavailable. Typed/effective rejection shows a distinct distrust state, no records or legacyDaily, not a fallback to the other lane. Qualified complete-empty means no persisted records in either verified local source **for this day**; dirty draft is a separate unsaved fact and prevents a misleading overall-empty headline.

Canonical-only data remains read-only; legacy unavailable is not no workout. Date navigation changes the account/day query lifetime and fences the old publication. No claim of cloud, cross-device or continuously observed external writes. Final labels/localization/session formatting are not chosen here.

## 12. Previous desktop/mobile contract and selection

Recommend `SAME_ELIGIBILITY`: one range projection/state model for desktop and mobile, with the same typed-isolation suppression, bounded-empty/partial taxonomy, action ownership and date selection. Modal open/close, focus trap/restore and scrolling are presentation-only differences requiring later physical QA. Under B/C the launcher must be outside legacy-editor eligibility; under A both presentations follow the composition gate. An already-open sheet may remain open with **state only** on degradation; it must never keep old records while desktop withholds them. Account/Health lifetime retirement closes or fully resets the presentation, not just its record list.

Previous remains the existing one-calendar-year-before-selected-day window through yesterday, not D's all-prior per-block query. Every same-day canonical session remains separate; legacy rows are a date group, not one minted session. No new session winner, default session selection or copy-to-editor action.

Selection follows the current qualified date-bucket algorithm: retain explicit date only if a bucket survives in the current projection; otherwise the existing newest-same-weekday/newest eligible date default, or null. During loading, same-scope selection intent may remain private, but no old selected records or valid-selection claim is shown. Settled error/isolation/no bucket has no effective record selection; recovery selects only from newly qualified buckets, never resurrects an old token. Partial may keep a selected date only if its surviving source-qualified bucket exists; missing bucket is not proof the failed source had none. Desktop/sheet use the same selection owner, not two competing effects.

## 13. Calendar contract

Reuse the range owner's independently derived displayed-month activity: known-present union; verified absence only for complete covered bounds; unknown for partial, uncovered or withheld publication. A zero-set legacy row may mark Calendar presence while providing no eligible Previous bucket; do not erase that intentional predicate difference.

C keeps date/navigation/unknown grid reachable for range loading/error/isolation. Those states have **no usable old dots or absent claims** and carry distinct source/trust explanations. B uses a visible status stub when the grid is unqualified; A shows Calendar only while parent composition is eligible. Partial qualified known presence remains visible with incomplete state, other dates `?`. Do not remove `?` for visual simplicity. Changing displayed bounds derives a view from current owner evidence; it does not infer absence outside coverage or start a writer.

## 14. Dirty draft ownership

Recommend `RETAIN_SAME_SCOPE_NONINTERACTIVE_DRAFT_PREVIEW_WHEN_UNQUALIFIED`. This is narrower than letting an unqualified editor remain editable. Draft visibility, Save authority and persisted truth are separate. Never erase on source failure/retry, replace with canonical data, lock because canonical exists, reseed owned counts on refresh or display a clean old hydration as a dirty user draft.

Account/date changes use existing owned draft lifetime/reset/storage behavior: no previous-account/date draft leaks into the new slot. This package adds no new durable draft format, cross-scope draft transfer or on-exit save. On qualifying recovery, the existing dirty-draft protection prevents hydration overwrite; editability/write admission must be re-evaluated, not inherited from the preview being mounted. Source-qualified range data does not confer draft writer authority.

## 15. Retry ownership and failure policy

Recommend `HYBRID_EXPLICIT_LOCAL_OWNER_FANOUT_REMOTE_SEPARATE`.

| Control / owner | Actual current contract | Proposed public contract, conditional on approval/design |
| --- | --- | --- |
| Selected-day B1 Refresh | In the B1+R candidate, AppContent supplies its B1/R paired fanout, not merely raw B1 retry | Preserve/disclose that exact local fanout; do not silently add D or claim every Health domain refreshed. A future genuinely narrower control would need explicit reviewed routing/label scope, not assumed source-only API support. |
| Range Refresh (Previous/Calendar) | Same AppContent B1/R wrapper; raw range invalidation itself is a distinct owner operation | Preserve/disclose current scope. It revokes the range pair; derived dates/months do not each launch a scan. No D qualification from range success. |
| Legacy compatibility-currentness recovery | HealthView's existing `previousOwner.invalidate('unknown')` invalidates consumed D dependencies and acquires a qualifying batch only when its scope is admitted | Separate explicit D control; no comparison/B1 revision as proof, no clearing rejection from an ordinary successful history read. |
| Remote/bootstrap recovery | Startup controller `retry('health')`, possibly followed by separately owned local bootstrap invalidation | Remains a separately labelled remote operation. Never inside a local-only recovery gesture or a requirement for local evidence. |
| Proposed parent LOCAL gesture | NOT IMPLEMENTED; AppContent cannot currently call HealthView's private D owner through the existing B1/R wrapper | Explicit current-lifetime routing: revoke/admit each requested owner before asynchronous completion; invoke raw range invalidation once, raw B1 retry once, and D unknown-impact invalidation once when each is permitted. Do not call two B1/R wrappers and duplicate the pair. No remote/bootstrap, daily/static/routine writer, reset, transport or identity action. |

A/B may use source-specific controls without the new LOCAL bridge; C recommends the hybrid because a local-parent promise needs all three explicitly distinct owners. The parent action is not a transactional common source revision: each result recovers on its own existing fence. If some action is disallowed, show that owner as unavailable and state which permitted owners were requested; never label a skipped deterministic identity failure repaired or refreshed. Source stubs/launcher must keep recovery reachability independent of editor visibility.

Finite retry constraints inherited from the identity contract take precedence over every matrix shorthand. Unchanged deterministic identity/integrity/provenance/writer-safety failure gets no repeated Retry/automatic loop; one additional user-triggered read is allowed for a genuine transient identity/open read episode, then unavailable/escalation. Click/timeout/reload is not a new episode or proof of repair. Fresh read after an independently authorized completed correction uses a new current permit, never this task's authority. Existing internal bounded generation-recovery behavior is not expanded.

**Design prerequisite:** current paired B1/R APIs do not expose arbitrary per-source retry, and some identity errors are plain Errors. A future public implementation must prove how it classifies/adopts the inherited retry eligibility and routes only allowed owners without reading storage to invent provenance or changing writer-cache retries. If a pair cannot safely retry around a deterministic canonical failure, skip that pair; do not promise a lane-only retry that does not exist. Independently admitted D recovery may remain useful, but cannot reset B1/range rejection. Unresolved eligibility -> fenced control plus status, not guessed permission.

During B1/R retry, those owners' old publications remain withheld exactly as now; stable shell shows REFRESHING/unknown, not cached current facts. An untouched independently qualified owner may stay visible. D invalidation fences historical cues/defaults immediately; owned draft counts remain. Isolation never displays pre-rejection evidence during retry. Late account/date/request/owner/generation completion is discarded; equality/arrival order cannot revive it. Bursts coalesce at existing per-owner scope/flight boundaries or an explicitly designed finite UI admission boundary; no extra per-card listener/reader, permanent busy loop or unmeasured numeric retry budget is invented.

## 16. Conceptual taxonomy, not final copy

| Semantic state | Required evidence / meaning | Forbidden collapse |
| --- | --- | --- |
| VERIFIED_EMPTY_DAY | Both selected-day sources verified successful and no persisted records for that local day; draft separately accounted for | No workouts ever / cloud empty / editor saved |
| NO_ELIGIBLE_PREVIOUS_BUCKET | Complete qualified bounded range, no eligible date bucket under existing Previous rules | Whole-account empty or never performed |
| PREVDATA_NO_MATCH_FOR_BLOCK_AND_CUTOFF | D verified legacy query omitted that exact block/cutoff; existing no-history formula may use this qualified outcome | Whole-source empty or canonical previous absence |
| PARTIAL_NO_SURVIVING_RECORD | Surviving qualified source yields no eligible displayed record; failed source unknown | Verified empty/no previous |
| UNAVAILABLE | Ordinary failure or insufficient usable read publication; no absence proof | Zero records/sets, identity repaired |
| REFRESHING | Current owner acquiring proof; superseded payload not current | Old records qualified because shell remains mounted |
| ISOLATION | Existing typed/effective distrust; rejected pair/dependencies suppressed | Ordinary partial with salvage inside rejected pair |
| UNKNOWN_CALENDAR_DATE | No covered complete absence proof and no qualified known presence for the exact date | No workout / absent |

Identity/open unavailable may additionally require the existing local recovery-required/unavailable semantics, without pretending every plain error is typed isolation. Approved asymmetric legacy ordinary-error classification remains intact. This package introduces no final user-facing strings, translations or error-code change.

## 17. Qualitative performance and accessibility implications

| Option | Mount/retention | Local reads/retry | Render/state costs and later evidence |
| --- | --- | --- | --- |
| A | Conditional combined composition; hidden dirty draft still retained by its existing owner | Same B1 pair, range pair and D path; no inherent scan reduction from hiding borrowed UI | Few mixed states, but remount/focus churn; measure whole parent, not only visible records |
| B | Individual qualified bodies plus reachable status stubs; selection and projections remain current-owner bounded | Reuse owners; no new scan for each body. Existing B1/R retries; D separate | More conditional layout/focus paths and partial/unknown presentation |
| C | Stable bounded workout/status slots, conditional qualified record bodies; no unbounded per-date cache or stale record retention | Same sources. LOCAL may request the existing B1 pair + shared range pair + one consumed-ID D batch; not one universal pair, not a read per slot | More status coordination but stable focus/recovery locations; account teardown and modal/lazy rendering must release correctly |

Structural visibility alone grants no additional local read, canonical opener, focus/bootstrap listener or writer session. Measure mounted/hidden slot retention, projection/React/layout cost, cold/warm/re-entry and permitted retry fanout on owner-approved history/card/device/mode scales later. Numeric thresholds/support devices are NOT selected. `PERFORMANCE_ACCEPTANCE = NOT_EXECUTED`.

Later presentation must express source, scope, bounded emptiness, distrust and action purpose separately in EN/KO/JA. Require localized full-date/selected/today/present/unknown associations; reachable recovery controls; status/alert frequency without repeated-card announcement storms; focus after degradation/recovery; keyboard and sheet trap/restore/scroll; non-color cues, contrast, zoom/reflow and touch sizing. Source roles/happy-dom assertions are not physical AT acceptance. No copy implementation or WCAG/physical PASS is recorded.

## 18. Identity/provenance hard veto and sibling boundaries

```text
REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION
REL05G5A_001_ACTIONABILITY = BLOCKED_BY_FROZEN_PRODUCT_AUTHORITY
PROSPECTIVE_PROVENANCE_PD01 = HOLD_NO_CAPABILITY_SELECTION_YET
SELECTED_PROVENANCE_CAPABILITY = NONE
HOME_COHERENCE = SEPARATE_PRODUCT_COHERENCE_DECISION_NOT_RUNTIME_DEPENDENCY
SEARCH_COHERENCE = SEPARATE_PRODUCT_COHERENCE_DECISION_NOT_RUNTIME_DEPENDENCY
COMPARISON_PUBLIC_STATUS = DEFAULT_OFF_PUBLIC_C30_NOT_EXECUTED
PUBLIC_C30 = NOT_EXECUTED
```

Partial-source UI can honestly show eligible local evidence; it cannot restore hidden canonical reachability, close REL05G5A-001, downgrade identity failure to empty, rotate/create a recovery target, acquire/issue provenance, alter cached writers or waive the activation veto. HOLD authorizes no automatic research/collection/issuer/control design. Proven original provenance and writer/control proof remain their separately authorized lane. Unknown external archives remain unknown, not inspected here.

Home/Search implementation or activation is not bundled. These semantic terms might inform later consistency decisions, not authorize sibling behavior. Comparison is OFF and not an eligibility or recovery prerequisite for Previous/Calendar; neither it nor a healthy legacy surface proves whole-product completeness. Seven live-writer blockers remain OPEN, none closed by a visibility policy.

## 19. One recommendation and explicit owner decision block

```text
RECOMMENDED_OPTION = C_HYBRID_STRUCTURAL_SHELL_WITH_SOURCE_QUALIFIED_CHILDREN
PRODUCT_OWNER_DECISION = REQUIRED
PRODUCT_OWNER_APPROVAL = NOT_YET_PERFORMED
PARTIAL_SOURCE_POLICY_ALREADY_SELECTED = NO
DECISION_PACKAGE_STATUS = PRODUCT_DECISION_PENDING_HUMAN_APPROVAL
```

C best preserves useful independently verified local history without disguising failed/distrusted sources, retains owned drafts without writable-by-visibility inference, intentionally unifies desktop/sheet semantics, and gives later accessible status/recovery work stable locations. Its bounded scope is the workout shell/read-only slots, existing trust owners and UI admission proofs, not general Health supporting writers or a new data plane. A remains safe but unnecessarily couples independent history to editor health; B preserves source utility but leaves more structural disappearance paths. C is recommended for these product properties, not because it is cheaper; its UI/fence/retry design prerequisites are explicit and unproven.

The recommendation is a coherent conditional bundle. Owner selections must not contradict invariants or each other: C requires stable shell and same Previous eligibility; choosing different semantics requires a revised/reviewed contract, not silently combining A's hiding rule with C's labels. Explicit HOLD is allowed. All fields below are currently **UNSELECTED**. Approval must be a separate human instruction after review; no approval record or selected policy is written here.

### PRODUCT_OWNER_DECISION_REQUIRED

| ID | Explicit choices | Recommended, not selected |
| --- | --- | --- |
| PA-PD01 Parent availability | A_ALL_OR_NOTHING / B_SOURCE_PARTIAL_CONDITIONAL_BODIES / C_STABLE_SHELL_QUALIFIED_CHILDREN / OTHER_REVISE / HOLD | C_STABLE_SHELL_QUALIFIED_CHILDREN |
| PA-PD02 Desktop/mobile Previous | SAME_ELIGIBILITY_AND_SELECTION / DIFFERENT_BY_DESIGN_REQUIRES_REVISED_MATRIX / HOLD | SAME_ELIGIBILITY_AND_SELECTION |
| PA-PD03 Workout shell | STABLE_ADMITTED_WORKOUT_SHELL / CONDITIONAL_COMPOSITION_WITH_EXTERNAL_RECOVERY / HOLD | STABLE_ADMITTED_WORKOUT_SHELL |
| PA-PD04 Retry | SOURCE_SPECIFIC_CURRENT_SCOPES / EXPLICIT_LOCAL_PARENT_FANOUT_REMOTE_SEPARATE / HYBRID_EXPLICIT_LOCAL_OWNER_FANOUT_REMOTE_SEPARATE / HOLD | HYBRID_EXPLICIT_LOCAL_OWNER_FANOUT_REMOTE_SEPARATE |
| PA-PD05 Dirty draft when unqualified | RETAIN_SAME_SCOPE_NONINTERACTIVE_PREVIEW_SAVE_DELETE_FENCED / HIDE_BUT_PRESERVE_OWNED_DRAFT / OTHER_REVISE / HOLD | RETAIN_SAME_SCOPE_NONINTERACTIVE_PREVIEW_SAVE_DELETE_FENCED |

An owner can reply with the five exact PA-PD selections. This approves a policy only if supplied separately; it is not implementation/physical/public activation authority. If choices conflict, return a revised coherent package for review before recording approval. No implicit “all recommendations” approval is inferred from asking to prepare/publish this document.

## 20. Future implementation acceptance contract

Every criterion below is `REQUIRED / NOT_EXECUTED`. They are specifications, not acceptance results from current CI or source inspection.

| ID | Required future proof |
| --- | --- |
| PA-C01 | Selected-day visible states obey the explicitly selected policy; source facts and dirty draft remain distinct. |
| PA-C02 | Legacy editor eligibility obeys policy; source-unqualified states admit no newly exposed Save/Delete/edit/planning action; prove callback admission, not only disabled DOM. |
| PA-C03 | Desktop Previous availability/state follows policy under every matrix row, including independently healthy range. |
| PA-C04 | Mobile opener/open sheet uses intentional same eligibility/selection/empty/isolation/retry semantics; no already-open stale privilege. |
| PA-C05 | Calendar known-present union, complete covered absence and visible unknown remain; range loading/error/isolation uses no stale marks. |
| PA-C06 | Authorized ordinary partial evidence survives source-qualified; both ordinary failures and partial no-record states never become empty. |
| PA-C07 | Typed B1/range pairs and existing D rejection dependencies remain fail-closed; loading/partial/ordinary retry cannot clear latches. Test independent range positive control without changing trust rules. |
| PA-C08 | Dirty same-scope draft is preserved, never auto-saved/erased/reseeded, and never crosses account/date lifetime. |
| PA-C09 | Canonical records never hydrate/copy/adopt/plan the legacy editor; formulas/PR/count precedence unchanged. |
| PA-C10 | Each retry invokes exactly its disclosed admitted owner set; LOCAL has no duplicate paired fanout, remote/writer side effect or unchanged-deterministic retry loop. Prove finite episode classification or keep controls fenced. |
| PA-C11 | Account/date/request/owner/device/namespace/generation ABA and unmount fence data and all newly reachable actions; late durable callbacks retain captured-account fanout. |
| PA-C12 | D remains independent block/cutoff/currentness proof; no borrowed range/B1/comparison revision, stale cue, default seeding or rejection-clearance shortcut. |
| PA-C13 | Gate-OFF UI, read/listener budgets, writer behavior and account/draft lifecycle remain equivalent. |
| PA-C14 | B1/R/C/H/S remain false until a separately authorized activation; no runtime/env/storage override introduced. |
| PA-C15 | Public source/state/recovery/action-scope copy and accessibility implementation require separate reviewed acceptance, not this taxonomy. |
| PA-C16 | Feature browser/AT execution requires approved supported-mode/protocol and raw evidence; no unit-CI or PATH A/global qualification promotion. |
| PA-C17 | Whole chosen parent architecture is separately measured/accepted against owner-selected support/data/performance criteria; no threshold invented here. |
| PA-C18 | REL05G5A-001 remains a hard activation veto; HOLD/no-capability/writer-control proof and seven OPEN writer blockers unchanged. |

Use all 18 matrix scenarios, plus stale/ABA/late retry, deterministic/transient failure, pre-existing rejection through loading, own-scope range rejection, dirty/clean hydration distinction, actual Save/Delete event admission and scoped draft recovery. Current source/CI supplies regression evidence only, not these new policy tests. No expensive runtime/physical tests were run for this document.

## 21. Frozen authority and publication validation

```text
HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED = false
HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED = false
HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED = false
HOME_WORKOUT_COMPOSITE_READER_ENABLED = false
SEARCH_WORKOUT_COMPOSITE_READER_ENABLED = false
ALL_FIVE_GATES = false
PUBLIC_READER_ACTIVATION = NOT_AUTHORIZED
HEALTH_PARENT_PUBLIC_READER_ACTIVATION = NOT_AUTHORIZED
PUBLIC_COPY_ACCEPTANCE = NOT_EXECUTED
PERFORMANCE_ACCEPTANCE = NOT_EXECUTED
PHYSICAL_BROWSER_QA = NOT_EXECUTED
PHYSICAL_AT_ACCEPTANCE = NOT_EXECUTED
PREVDATA_C15_PUBLIC_ACCEPTANCE = NOT_EXECUTED
PUBLIC_C30 = NOT_EXECUTED
SEVEN_LIVE_WRITER_BLOCKERS = OPEN
WRITER_CONTINUITY_STATUS = NOT_YET_PROVEN
E3_FEASIBILITY = NOT_ESTABLISHED
LIFECYCLE_EVIDENCE_SOURCE = REMAINS_UNAVAILABLE
EXACT_TARGET_CONTROL_PROTOCOL = NOT_IMPLEMENTED
LOCAL_DATABASE_VERSION = 7
LOCAL_SCHEMA_VERSION = 1
WRITER_AUTHORITY_CHANGED = NO
```

Literal gates verified in [B1](../src/components/views/features/health/healthSelectedDayCompositeConfig.ts), [range](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts), [comparison](../src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts), [Home](../src/components/views/features/home/homeWorkoutCompositeConfig.ts) and [Search](../src/components/views/features/search/searchWorkoutCompositeConfig.ts); DB/schema in [types](../src/lib/localDatabase/types.ts). WorkoutSessionV1/stores/indexes/keyPaths/backend/Supabase/RLS remain unchanged. No writer/adoption/bind/push/pull/resync/reset/G6, registry/API, real user-data access, browser automation or physical QA.

Scope: this one new Markdown file. Existing rebaseline/decision documents are not rewritten. Validate current-source trace, relative links and unstaged/staged/committed diff check; normal dedicated topic commit/push and Draft PR targeting exact current main. Require NEW exact-head Push and PR CI test/typecheck/build/backend-rel05g1/backend-recovery success, distinct from #771 main CI. Head/run IDs and actual outcomes belong in PR body/report rather than invented source evidence. Keep Draft; no Ready/merge/auto-merge. K320A/K333B remain unrelated residuals, neither fixed nor closed.

## 22. Exact next action and conditional later work

```text
NEXT_ACTION = HUMAN_PRODUCT_DECISION_REL_05G_HEALTH_PARENT_PARTIAL_SOURCE_AVAILABILITY
RECOMMENDED_NEXT_ACTION = INDEPENDENT_REVIEW_REL_05G_HEALTH_PARENT_PARTIAL_SOURCE_AVAILABILITY_PRODUCT_DECISION_01
```

First independently review this pending decision package after exact-head CI, then obtain a separate explicit human PA-PD selection. No implementation prompt is auto-created. With no decision/HOLD, remain pending and keep all runtime authority frozen. A later coherent human-approved/reviewed/canonically closed policy still requires a separately authorized default-OFF integration design/plan or characterization task, including action-admission and finite-retry prerequisites above; only then can a separately scoped implementation be requested. Approval alone does not make those prerequisites proven, waive writer STOP, authorize provenance work or grant public activation. Different/OTHER choices require package revision/review, not an automatic alternate implementation.
