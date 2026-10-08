# REL-05G exercise comparison public-readiness characterization

Task: `REL_05G_WORKOUT_EXERCISE_COMPARISON_PUBLIC_READINESS_CHARACTERIZATION_01`.

Repository: `Absinthe-6785/Absinthe`. Source baseline: `3ab3638e959184ef0298535246150cf1bf84e2c1`.

## 1. Decision and evidence ceiling

**Primary readiness classification: `EXCOMP_PUBLIC_ACTIVATION_BLOCKED_BY_MULTIPLE_PREREQUISITES`.**

The approved Option C implementation is proven within its bounded default-OFF contract. Public activation is not authorized. The remaining prerequisites are the coupled Health parent readers' public readiness, public copy/accessibility/localization and feature-level browser acceptance, and measured large-history qualification with an approved threshold/support policy. This is not a finding that the merged preview implementation must be redesigned.

| Current acceptance | Status | Meaning |
| --- | --- | --- |
| `BOUNDED_DEFAULT_OFF_ACCEPTANCE` | `PROVEN` | Merged projection, owner, real persisted trust paths and mounted preview acceptance |
| `C14` | `C14_PASS_SOURCE_QUALIFIED_PARTIAL_CONTRACT` | Real canonical isolation plus real legacy owner-mismatch rejection under the approved asymmetric partial contract |
| `C26_MOUNTED_ACCOUNT_ABA` | `PASS` | No old-account continuation revival |
| `C27_MOUNTED_DATE_REQUEST_ABA` | `PASS` | Date and concurrent per-key requests fenced |
| `C28_MOUNTED_LIFETIME_FENCES` | `PASS` | Device/generation/gate/owner/unmount fences, including committed-tree and aborted-render safety |
| `C29_MOUNTED_SAVE_DELETE_INVALIDATION` | `PASS` | Actual durable Health save/delete fences the borrowed evidence and reloads one shared pair |
| `C30_DEFAULT_OFF_PREVIEW_ACCEPTANCE` | `PASS` | Localized preview states, placement, fail-closed gates and compatibility DOM |
| `PUBLIC_C30` | `NOT_EXECUTED` | Preview acceptance is not public-language, accessibility or physical-browser approval |
| `PUBLIC_ACTIVATION_ACCEPTANCE` | `NOT_YET_AUTHORIZED` | No flag change, public rollout or approval record in this task |

[PR #744](https://github.com/Absinthe-6785/Absinthe/pull/744), [#745](https://github.com/Absinthe-6785/Absinthe/pull/745), [#759](https://github.com/Absinthe-6785/Absinthe/pull/759) and [#760](https://github.com/Absinthe-6785/Absinthe/pull/760) are the merged implementation lineage. Remote truth was fetched for this task: #760 is MERGED/CLOSED at the baseline above. [Main-push CI 37779490860](https://github.com/Absinthe-6785/Absinthe/actions/runs/37779490860) has SUCCESS for `test`, `typecheck`, `build`, `backend-rel05g1` and `backend-recovery` on that exact main.

The older [truth characterization](REL-05G-workout-exercise-comparison-truth-characterization.md) and [approved product-decision package](REL-05G-workout-exercise-comparison-product-decision-package.md) describe their earlier preparation/publication states. Their historical `REQUIRED / NOT EXECUTED` matrix is not the current implementation verdict; section 9 below refreshes it without rewriting history or expanding the approved contract.

## 2. Exact candidate public surface and effective gate

The candidate is a subordinate, read-only evidence panel in each currently displayed Health workout-editor exercise card. It sits below the exercise header, legacy Previous micro-cue and `WorkoutPrBadge`, and above the set editor. It does not create editor cards for canonical-only exercises, replace the separate canonical selected-day session surface, or become the global Previous browser.

Current source facts are in [AppContent](../src/components/AppContent.tsx), [HealthView](../src/components/views/HealthView.tsx), [Health range config](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts), [comparison config](../src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts) and [range hook](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts).

Define `B1 = HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED`, `R = HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED`, `C = HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED`, `H = activeTab === 'health'`, `A = Boolean(authUser.id)`.

```text
selectedDayReaderEnabled = B1 && H
workoutRangeReaderEnabled = B1 && R && H && A
rangeSourceEnabled = workoutRangeReaderEnabled || searchCompositeEnabled
comparisonContext.enabled = workoutRangeReaderEnabled && C
hookComparisonEnabled = rangeSourceEnabled && comparisonContext.enabled

effective requested public comparison gate = B1 && R && C && H && A
```

This expression requests the consumer; usable evidence additionally requires the current committed source lifetime, current selected-date/exact exercise-key context, successful guarded derive/publication and current account/device/namespace/generation verification. Loading, partial, ordinary failure, isolation and stale suppression remain legitimate outcomes, not fabricated readiness.

| Flag combination / source | Current consequence |
| --- | --- |
| C ON with R OFF | No Health comparison consumer; no comparison-induced source load |
| R/C ON with B1 OFF | Parent fails closed; no Health range/comparison mount |
| B1/R ON with C OFF | Selected-day, Previous and calendar parent behaviors only; no comparison borrower |
| B1/R/C ON with current Health/account | Candidate comparison mounts under the Health range lifetime |
| Search-only shared pair active, Health parent OFF | Does **not** authorize comparison: its context still uses `workoutRangeReaderEnabled`, not merely `rangeSourceEnabled` |

**`COMPARISON_PUBLIC_ACTIVATION_DEPENDS_ON_HEALTH_RANGE_READER`.** Independent activation with R OFF is not implemented. Giving comparison a new owner or independent parent would be a separate architecture change, not a literal activation or a recommendation of this task. All five shipped gates remain false.

## 3. Approved evidence semantics, not new analytics

The [pure projection](../src/lib/workoutExerciseComparisonProjection.ts) and [guarded owner](../src/lib/workoutExerciseComparisonOwner.ts) implement the owner-approved Option C S/T/M/P ceiling:

- Separate legacy/canonical observations and separate latest eligible prior dates; no source winner, global Previous, global/composite/canonical PR or estimated 1RM.
- All locally available **active** history strictly before Health's selected day, not today, the separate Previous browser's selected bucket, one-calendar-year coverage or remote/all-time completeness.
- Eligibility precedes date selection independently per successful source. Preserve every eligible observation on that source's maximum eligible prior date; UUID/row/ordinal order is technical, not performed chronology.
- Legacy exact block-ID association; canonical exact non-null frozen ID plus exact current catalog name/type. No normalization, fuzzy/name fallback, rename repair, null-ID synthesis or catalog-era continuity proof. Legitimate renamed/unlinked records can be omitted under the approved policy.
- New evidence includes completed normal/non-dropset external-weight strength factual claims. Weight and repetitions have independent trust/withholding; validated total/assisted/unassisted and explicit zero remain facts, not ranks. New bodyweight/drop/cardio comparison semantics remain deferred.
- No adoption, equivalence/dedupe, source suppression, synthesized session identity, manual copy-to-plan, automatic prescription or canonical evidence as writer input.

Existing compatibility cues/badges/count/preset/default behavior stays separate. [Legacy badge calculation](../src/components/views/features/health/computeWorkoutPrBadge.ts) consumes the legacy editor draft and legacy per-block prior/threshold data, not canonical comparison. It can react to unsaved draft values. Its current/previous maxima and historical threshold are not a newly unified completed-only evidence rule. New evidence dates can differ intentionally from the legacy cue's date and the one-year Previous browser. Public wording must explain these distinctions rather than change the old formulas here.

## 4. Parent activation blast radius and trust ownership

Comparison C itself adds a borrower of the existing range pair, not a second coordinator. Starting all necessary flags from the current OFF baseline, however, starts previously dormant parent behavior as well. A comparison-only public approval cannot silently approve that larger rollout.

| Coupled surface / lifecycle | What enabling B1/R changes | Remaining public disposition |
| --- | --- | --- |
| Health selected day | Local verified legacy + separate canonical read-only panel; legacy-only editor input. Health can mount local content while remote recovery is pending/failed, with a separate recovery notice/retry. Daily/static/routine activity gating changes. | Parent surface/copy/accessibility/offline acceptance required; not a remote bootstrap-success guarantee |
| Selected-day presentation | [Panel](../src/components/views/features/health/HealthSelectedDayCompositePanel.tsx) still has hard-coded English heading/buttons/statuses and raw session/exercise UUID/technical fields. | Not a finished EN/KO/JA public surface merely because comparison copy is localized |
| Previous desktop/mobile | Uses composite date buckets and separate source records instead of the legacy SWR path. Multiple same-day canonical sessions stay distinct. Browser has its existing one-year bounds, unlike all-local comparison. | Parent provenance/date selection/empty/partial/copy acceptance |
| Calendar | Composite active-day union; verified absent only with complete coverage, otherwise unknown/incomplete rather than false absence. Independent legacy month/Previous SWR keys are disabled in composite mode. | Parent incomplete-state/visual/accessibility QA |
| Source lifecycle | One shared full-active legacy/canonical range pair, plus the separately scoped selected-day read. They are not one universal physical read for every Health surface. | Measure entire coupled rollout, not comparison CPU alone |
| Retry/freshness | AppContent parent fanout refreshes the range pair and selected-day reader. The comparison panel's own `read.retry` comes from the hook and reloads the shared **range pair**; it does not independently call the parent selected-day wrapper. | Public retry labels must not promise unrelated readers refreshed by every button |
| Durable save/delete | Current same-account durable commit synchronously invalidates range/borrowed evidence and retries B1. UI success continuation has its own current-scope fence. | Merged race closure preserved; real-browser behavior still needs feature QA |
| Bootstrap/focus/visibility | Managed B1 mode delegates source fanout to AppContent. Bootstrap event refreshes current scope conservatively; focus/visible events are coalesced (250 ms), hidden state ignored. No per-card listener or scanner. | Cold/warm/offline/focus/background behavior belongs in parent + feature QA |
| Date/month/card changes | Derive from existing pair; no full pair per card/date/month. Card release invalidates all comparison requests, so surviving cards rederive in memory. | Read-budget correctness is proven; worst-case rederive responsiveness is not physically qualified |
| Search coexistence | May share the same pair when its own gate/lifetime is authorized. Search-only lifetime does not open the comparison gate. | Separate Search decisions/activation remain unchanged; do not manufacture a Health owner |
| Home/Search outside Health | Their child gates remain false if only B1/R/C are changed. Dormant integration availability is not public activation. | Existing parent minimum coherent truth-set requirements still need current disposition |

The [parent expansion preparation](REL-05G5B2B2-product-reader-expansion-prep.md) and [consumer preparation section 9](REL-05G5B2B2B-consumer-integration-prep.md) require coherent selected-day/Previous/calendar truth plus truthful Home and Search scope before broad public rollout. Home/Search default-OFF implementations have since been merged; that is not proof of their public activation readiness. A parent-readiness task must decide whether the proposed public scope activates the relevant child surfaces or uses separately approved truthful limitation/withholding. Leaving canonical-only Home false-empty or implying complete legacy-only Search cannot be waived by comparison acceptance. This characterization does not reopen their closed bounded implementations or flip their flags.

### Reader trust, metadata and bootstrap boundaries

[Coordinator](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts), [bounded canonical reader](../src/lib/workoutRangeReader.ts), [local identity helper](../src/lib/workoutLocalReaderAuthority.ts) and [borrower](../src/components/views/features/health/healthExerciseComparisonBorrower.ts) retain current fences:

- Range lifetime owns account-scoped sources. Current publication captures its actual snapshot/sequence/device; final durable scope verification is required. Account ABA, generation/device changes, superseding requests and close cannot revive older evidence.
- Ordinary one-source failure permits only surviving source-qualified incomplete evidence; both ordinary failures are unavailable. Canonical typed isolation suppresses both lanes. A failed source never proves empty/no-match. The real legacy boundary rejects contaminated payload before comparison receives it (section 7).
- Retry/invalidation replaces the source publication, not pending writer requests. Scope recovery can reopen/retry stale generation once; the documented stable-scope one-pair budget does not claim all failure recovery is exactly one physical scan.
- Child close/disable releases the borrower without closing the shared source. Parent/account/unmount closes its owner. No component receives an unrestricted repository handle.
- Missing mirror identity can be established by the existing creator; canonical local open can initialize namespace metadata/generation. Thus this is **domain-read-only**, not literally zero localStorage/IndexedDB metadata writes. No Workout entity edit, outbox creation, adoption or transport activation follows.
- The broad established mirror format check can accept a value later rejected by strict namespace validation. `REL05G5A-001 = ACTIVATION_PREREQUISITE` remains open for broad parent public rollout; unavailable/fail-closed behavior is not a correction or permission to repair/reidentify devices. B1 cacheKey P3 stays `OPEN_NON_BLOCKING`.
- Existing local read readiness is independent of Supabase remote recovery success and G5A remote authority OPEN/ready. The Supabase boundary review was limited to that distinction; no Auth/RLS/API/database change is needed or authorized by comparison display.

## 5. EN/KO/JA copy readiness

Audited the twenty current comparison keys in [keys](../src/lib/i18n/keys.ts), [English](../src/lib/i18n/en.ts), [Korean](../src/lib/i18n/ko.ts) and [Japanese](../src/lib/i18n/ja.ts), plus the actual [mounted panel](../src/components/views/features/health/HealthExerciseComparisonPreview.tsx). All three languages express the same bounded-source, no-winner, local-prior, strength-only and compatibility semantics. `i18n.test.ts` preserves existing key correspondence; automated parity is not native-language approval.

The following classifications concern **semantic safety of the state's current text**. Common preview title/presentation refinements and native-language/physical QA remain required even for an `AS_WRITTEN` row. No state is credited as final PUBLIC_C30 acceptance.

| Visible state | Current key(s) / qualification in EN, KO, JA | Classification | Public work remaining |
| --- | --- | --- | --- |
| Loading | `exerciseComparisonLoading`: loading, not empty or failed | `PUBLIC_SAFE_AS_WRITTEN` | Verify multi-card announcements and retry behavior |
| Source-separated complete evidence | Title/scope/compatibility + lane labels + per-lane prior date; no single winner/PR | `PUBLIC_SAFE_WITH_MINOR_COPY_CHANGE` | Replace QA-preview title for an approved public surface; explain Legacy/Canonical terminology and scope where users encounter the badge/cue |
| Partial evidence | `exerciseComparisonPartial`: unavailable source, surviving facts incomplete, no full-source/absence claim | `PUBLIC_SAFE_AS_WRITTEN` | Native readability and partial/no-result state QA |
| One source unavailable | `exerciseComparisonSourceUnavailable` + partial qualifier, not absence | `PUBLIC_SAFE_AS_WRITTEN` | Verify the unavailable lane remains understandable alongside surviving evidence |
| Both unavailable/error | `exerciseComparisonUnavailable`: empty history not verified | `PUBLIC_SAFE_AS_WRITTEN` | Retry/focus/error announcement QA |
| Typed isolation | `exerciseComparisonIsolation`: neither source published | `PUBLIC_SAFE_AS_WRITTEN` | Understandable recovery guidance without exposing technical/foreign payload |
| Verified both-source storage empty | `exerciseComparisonVerifiedEmpty`: two verified local active stores have no persisted workout records, not all-time/remote absence | `PUBLIC_SAFE_AS_WRITTEN` | Verify users distinguish whole active-store empty from no eligible prior exercise evidence; no tombstoned/remote completeness claim |
| Successful source with no eligible match | `exerciseComparisonNoMatch`: exact key/prior-date/strength policy, explicitly not never performed | `PUBLIC_SAFE_WITH_MINOR_COPY_CHANGE` | Plain-language omissions for renamed/null-ID/unsupported evidence, legible density; preserve exact matching policy |
| Stale/suppressed | `exerciseComparisonStale`: stale evidence hidden, shared refresh suggested | `PUBLIC_SAFE_AS_WRITTEN` | Real transition/focus/recovery QA; do not imply old evidence is current |
| Cardio/bodyweight/drop-only path | Common scope excludes these; generic strength no-match can appear. There is no dedicated unsupported-variant status. | `PUBLIC_SAFE_WITH_MINOR_COPY_CHANGE` | Clearly distinguish outside this feature's scope from no exercise history. Excluded recent sets may legitimately yield older eligible normal strength evidence. No new variant policy |

Additional public copy requirements: each source date must remain separate and visibly tied to that source; selected-day boundary must be understandable during date changes; local active coverage must never become cloud/all-time coverage. Canonical facts must not be mistaken for input to the adjacent legacy PR badge or set suggestions. Existing compatibility sentence says legacy-only/unchanged/no planning but does not fully explain the legacy draft/historical-threshold versus newly eligible completed-set distinction. That is a public disclosure/placement gap, not permission to recalculate the badge.

Overall: `CURRENT_COPY_READINESS = PUBLIC_SAFE_WITH_MINOR_COPY_CHANGE; PUBLIC_LANGUAGE_APPROVAL_NOT_EXECUTED`. No unsafe full-source assertion was found in the current bounded comparison strings. This does not approve hard-coded parent reader copy or new marketing claims.

## 6. Presentation and accessibility readiness

Source inspection establishes structural affordances, not WCAG conformance or physical-render acceptance.

| Area | Current fact | Public gap / qualification |
| --- | --- | --- |
| Hierarchy/placement | Exercise h3, comparison h4, source h5; subordinate to legacy header/badge and above editable sets | Verify users do not read it as a second PR/Previous control or a suggested plan; contextualize legacy cue/date differences |
| Source/date display | Separate lane sections and `<time dateTime>` ISO dates | Dates are raw YYYY-MM-DD, not localized display formatting; review readability and selected-day association |
| Numeric evidence | Normalized kg plus preserved source value/unit, total and assistance facts, withheld-claim text | Repetition/rounding/unit repetition and multiple same-day observations need readability QA, not ranking or consolidation |
| Repeated cards | No hard-coded panel DOM `id`; each panel repeats a generic translated aria-label and retry label | No duplicate DOM IDs found, but generic names omit exercise context. Assess contextual accessible labels and discoverability across many cards |
| Status semantics | Loading/stale/partial/source-unavailable use `role=status`; both unavailable/isolation use `role=alert` | Potential repeated multi-card announcements; verify live updates are neither lost nor excessively noisy |
| Keyboard/focus | Native retry button, min-h-11; no copy/edit/planning callbacks | Keyboard order, focus visibility/contrast and focus when card/account/date/gate transitions remove content are unqualified. No automatic focus move is implemented |
| Mobile/density | text-xs disclosure repeats per card; two columns at sm, one below; all eligible same-date observations listed | Narrow widths, long EN/KO/JA text, large fonts/zoom, many rows/cards and scrolling need real responsive QA |
| Hidden/visible transitions | Currentness/phase suppress stale lanes; retry can replace multiple dependent views | Validate visible/announced recovery, no old-source flash, assistive navigation after source replacement |
| Parent surfaces | B1 selected-day controls/statuses partly hard-coded English; Previous/calendar also join activation | Comparison-local quality cannot approve the coupled parent presentation |

`CURRENT_ACCESSIBILITY_READINESS = REQUIRES_PRESENTATION_AND_REAL_BROWSER_ACCESSIBILITY_QA`. No redesign, contrast measurement, screen-reader execution or physical feature QA was performed here.

## 7. Feature QA, global physical qualification and legacy trust

### Distinct qualification lanes

**`NOT_A_DIRECT_PREREQUISITE_FOR_READ_ONLY_COMPARISON_ACTIVATION`** is the disposition of the global device-lifetime Track A/E3 evidence package, not a waiver of reader safety or feature QA.

Current read-only range/selected-day behavior still uses established local mirror/namespace/generation fences; it does not consume an admitted device-lifetime authority to authorize a canonical mutation or bind/push/reset operation. It cannot claim destructive-event/rollback-resistant lifetime detection merely from a stable device string. Global Track A qualification and bootstrap admission remain prerequisites in their own future authority/writer routing lane. They must not be relabelled proven by comparison tests.

The distinct existing malformed-identity parent activation prerequisite `REL05G5A-001` remains required as classified in section 4. Global E3 incompleteness neither repairs that defect nor automatically makes every current read-only comparison depend on finishing the entire writer/device-lifetime rollout.

Feature-level QA **is required** before public activation, with an isolated, separately authorized candidate build and no public flag flip in this task:

- Real Edge/Chrome Health editor, multiple visible cards, cold/re-entry and warm source reuse; single/mixed/canonical-only local history without a canonical writer.
- Actual local save/delete, date ABA, account A→B→A/sign-out, device/generation loss and recovery, focus/visibility/background and retry fanout; assert no stale/foreign evidence and one-pair invalidation budget.
- EN/KO/JA, light/dark, narrow/touch/zoom, keyboard and assistive-technology navigation; separate dates, legacy badge/draft compatibility, all empty/partial/unavailable/isolation/stale/unsupported variants.
- Offline/restart and remote recovery pending/failed: local source availability must not imply remote completeness. Test Windows Edge installed PWA and iPhone Safari Home Screen separately if included in the public support scope, as already required by parent preparation. This is feature/local-storage QA, **not** E3 device-lifetime-loss qualification. Each device has its own unsynced data.
- Stress history/card/same-date-observation sizes and record actual layout/paint/responsiveness, not only Node CPU proxies (section 8).

`FEATURE_LEVEL_REAL_BROWSER_QA = REQUIRED`. Physical execution was not performed.

### Legacy classification limitation

**`LEGACY_GAP_DOES_NOT_BLOCK_QUALIFIED_OPTION_C_BUT_BLOCKS_COMPLETE_SOURCE_CLAIMS`.**

[Real persisted C14 tests](../src/lib/workoutExerciseComparisonPersistedTrust.test.ts) prove canonical envelope account/namespace/generation/untrusted-scope mismatches suppress the pair, and real legacy Health driver/repository owner mismatch rejects contaminated legacy bytes without publishing them. The latter remains generic `health_local_verified_data_malformed`, so a healthy canonical source can survive as **partial**, not source-symmetric isolation/complete truth. Both ordinary failures are unavailable; only two verified successful empty reads establish scoped storage empty. Matching/date filters cannot hide foreign canonical evidence before its trust check.

That is the explicitly approved and independently reviewed C14 partial contract. `LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP = UNRESOLVED`; no taxonomy repair is required merely to retain these qualified Option C semantics, and no new complete-source guarantee is inferred. A future symmetric/complete-source promise needs separately reviewed typed legacy ownership classification or an equivalent safe trust boundary. Public copy must preserve this limitation through no-result states as well as positive evidence.

## 8. Large-history qualification and exploratory measurements

**`LARGE_HISTORY_QA_REQUIRED_BEFORE_PUBLIC_ACTIVATION`.** One shared pair avoids repeated physical domain reads, but each visible exact exercise derives from the loaded history. CPU cost grows approximately with visible cards × loaded records/entries/sets; release invalidates all child requests, causing surviving cards to rederive. No performance index, cache, schema or optimization is approved here.

### TEMP-only exploratory proxy, not a qualification PASS

On 2026-10-08 22:26:09 Asia/Seoul, a fresh LF export of exact baseline main was measured using Node v24.14.0, Vitest v4.1.8, happy-dom, Windows and AMD Ryzen 7 7840HS (16 logical processors). The final TEMP probe passed 1 test. No tracked source/test file was added or changed.

Protocol: `excomp-public-readiness-cpu-proxy-v1`. Harness SHA-256: `86389cdf3b8a4429addc29d00f88d263cf9a04e24744fa1f7bcff3b50ce63562`.

Local recovery material only (not required as a repository link): `%TEMP%/excomp-public-readiness-20261008-221840/frontend/src/components/views/features/health/publicReadiness.measurement.test.ts` and sibling export-root `public-readiness-metrics.json`. The generated observations are recorded below so the characterization does not depend on reviewers having that machine's TEMP directory.

Reproduction recipe: export pinned main to TEMP and borrow its existing dependencies; mock only `healthLocalRuntime` legacy readAll and `WorkoutRangeReader.open/readAllActive/verifyCurrentScope` with pre-built valid in-memory sources. Run the real coordinator load/adaptation/validation/clone/freeze, borrower/owner derive+guarded publish and real React preview under happy-dom. For each N, create N canonical sessions and N legacy logical date-workout groups, dated one day apart backward from 2026-10-01, with 12 matching strength exercises × 6 completed normal 20 kg/8 reps sets (canonical 2 assisted); maintain unique session/entry/set and legacy row identities. This produces 12N legacy rows, N canonical sessions and 72N sets in each source. Before selectedDate 2026-10-02, every key has six latest-date observations per source. Keep one pair for the three card-count cases, create a fresh borrower per case, derive/publish all keys, then measure mount, explicit borrower invalidation, remove/re-add one card and change selectedDate to 2026-10-03. Settle React effects/microtasks and assert every card completes and each source load count remains exactly one. Unmount/close afterward. This method can be reproduced in an untracked TEMP probe based on the merged mounted-test mock pattern; it is not a new performance test convention.

All timing columns are milliseconds, one exploratory observation per cell, no percentile/statistical guarantee:

| History groups/sessions per source | Visible cards | Coordinator load proxy | Derive + publish total | Mount settle | Invalidate/rederive settle | Remove/re-add settle | Date-context settle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 1 | 47.45 | 1.73 | 17.01 | 3.58 | 3.46 | 4.88 |
| 100 | 6 | 47.45 | 1.90 | 15.16 | 14.76 | 22.23 | 12.28 |
| 100 | 12 | 47.45 | 2.88 | 23.76 | 26.30 | 49.06 | 25.57 |
| 500 | 1 | 190.92 | 1.74 | 3.91 | 3.59 | 3.52 | 3.09 |
| 500 | 6 | 190.92 | 8.79 | 15.81 | 16.94 | 27.36 | 17.97 |
| 500 | 12 | 190.92 | 14.25 | 32.15 | 27.24 | 34.19 | 25.48 |
| 1,000 | 1 | 341.59 | 2.36 | 4.54 | 4.45 | 4.47 | 4.85 |
| 1,000 | 6 | 341.59 | 14.92 | 23.66 | 26.21 | 34.42 | 24.42 |
| 1,000 | 12 | 341.59 | 29.86 | 48.70 | 50.60 | 77.72 | 49.97 |

Coordinator load is measured once per N and repeated in the table only for comparison. Generated fixture construction is outside that timer. It includes actual in-memory adaptation/validation/clone/freeze, **not persisted repository/IndexedDB I/O**, namespace establishment latency, remote bootstrap or layout/paint. Derive includes mocked metadata verification; React settlement is not physical frame responsiveness. Initial/warm JIT, GC and test scheduling affect results; non-monotonic small cells are not a claim of constant-time scaling.

Sampled process heap delta immediately around the source load was +18.16 MiB / -5.43 MiB / +12.80 MiB for N=100/500/1,000. No forced GC or peak tracking: the negative delta demonstrates why this is **not** retained-source or browser memory qualification. Each N case kept one legacy and one canonical load through derive/invalidate/release/date changes; no extra full read was observed. This does not measure durable-save, focus or failure-recovery I/O.

### Remaining measured gate

No approved feature-specific public timing/memory budget was identified in the inspected contract/source. Do not invent a 16 ms, 100 ms, session-count ceiling or PASS threshold from this sample. Product/support owners must choose representative supported devices/history/card/observation sizes, cold/warm/retry measurement definitions, acceptable interaction/long-task/loading behavior and memory/recovery limits. Then qualify with persisted sources and actual supported browsers, repeated runs and tail behavior. Include 100/500/1,000+ sessions, many exercise entries/sets, many visible cards, many latest-date sessions/observations, whole coupled B1/R views, release/re-add/rapid date navigation and offline/background recovery. The proxy is evidence that qualification is practical, not evidence public activation is already fast enough.

`LARGE_HISTORY_QA = REQUIRED`; no performance budget or optimization decision is made here.

## 9. EXCOMP-C01–C32 refreshed acceptance matrix

Status ceiling: bounded/unit, real persisted-path and mounted-test proof are distinguished from public QA. Where new variants were explicitly excluded, exclusion safety is acknowledged without claiming their deferred metric semantics implemented. C10's remaining catalog-era uncertainty is an approved limitation, not a new writer/Option C policy blocker.

Evidence abbreviations: [P](../src/lib/workoutExerciseComparisonProjection.test.ts) = pure projection; [O](../src/lib/workoutExerciseComparisonOwner.test.ts) = guarded owner; [T](../src/lib/workoutExerciseComparisonPersistedTrust.test.ts) = real persisted trust; [M](../src/components/views/features/health/healthExerciseComparisonMounted.integration.test.ts) = mounted borrower/preview; [A](../src/components/healthExerciseComparisonAppContent.integration.test.ts) = real AppContent/Health durable integration. Tests are on merged main; none is physical/public-language qualification.

| Criterion | Refreshed classification | Evidence and exact limitation |
| --- | --- | --- |
| EXCOMP-C01 | `PASS_MOUNTED_DEFAULT_OFF` | A compares OFF editor DOM/cues/PR/planning with ON subordinate panel; P preserves legacy-only compatibility, not a new PR formula |
| EXCOMP-C02 | `PASS_BOUNDED_DEFAULT_OFF` | P includes canonical-only validated prior facts; empty source versus no eligible match distinguished. No editor card fabrication |
| EXCOMP-C03 | `PASS_BOUNDED_DEFAULT_OFF` | P older/newer/equal dates stay independent with no winner/global Previous |
| EXCOMP-C04 | `PASS_BOUNDED_DEFAULT_OFF` | P retains multiple same-day canonical sessions; technical ordering is not chronology |
| EXCOMP-C05 | `PASS_BOUNDED_DEFAULT_OFF` | P retains repeated entries/sets and real origin identity, no dedupe |
| EXCOMP-C06 | `PASS_BOUNDED_DEFAULT_OFF` | P null/unavailable ID follows exact-key omission; no synthesis/name fallback |
| EXCOMP-C07 | `PASS_BOUNDED_DEFAULT_OFF` | P frozen renamed/case-varied names fail exact guard; legitimate rename omission is approved |
| EXCOMP-C08 | `PASS_BOUNDED_DEFAULT_OFF` | P exact legacy ID and honest historical fallback; adapter rejects invalid/missing row identity rather than fabricating a canonical snapshot. Not catalog history reconstruction |
| EXCOMP-C09 | `PASS_BOUNDED_DEFAULT_OFF` | P different ID/case never matches by name or implies persisted equivalence |
| EXCOMP-C10 | `PARTIAL` | Exact ID/name/type guard and no record equivalence are proven; same-ID/name/type reuse cannot establish catalog-era continuity. That proof/mechanism remains explicitly deferred, not a new claim |
| EXCOMP-C11 | `PASS_PERSISTED_REAL_PATH` | T real legacy rejection leaves only qualified canonical evidence, M partial rendering; legacy match/no-match is never inferred from failure |
| EXCOMP-C12 | `PASS_PERSISTED_REAL_PATH` | T ordinary canonical persisted failure can leave qualified legacy facts; typed isolation instead suppresses pair |
| EXCOMP-C13 | `PASS_PERSISTED_REAL_PATH` | T both real ordinary failures unavailable; M loading and no-result states do not imply verified absence |
| EXCOMP-C14 | `PASS_PERSISTED_REAL_PATH` | `C14_PASS_SOURCE_QUALIFIED_PARTIAL_CONTRACT`: real canonical envelope isolation and real legacy owner mismatch; no contaminated payload or symmetric-complete claim |
| EXCOMP-C15 | `PASS_BOUNDED_DEFAULT_OFF` | P strict prior selectedDate on both sources; O/M date context independent of browser bucket/today |
| EXCOMP-C16 | `PASS_BOUNDED_DEFAULT_OFF` | P multiple same-day origins kept; no performed-time/latest-session assertion |
| EXCOMP-C17 | `PASS_BOUNDED_DEFAULT_OFF` | P unfinished/drop/unknown eligibility before max date; legacy compatibility stays separate, no new ranking/formula |
| EXCOMP-C18 | `DEFERRED_BY_PRODUCT_SCOPE` | Approved new bodyweight exclusion is tested; new bodyweight reps comparison/ranking is not implemented. No fabricated external kg |
| EXCOMP-C19 | `PASS_BOUNDED_DEFAULT_OFF` | P total/assisted/unassisted, all-assisted zero, null/invalid/withheld facts; no assistance rank |
| EXCOMP-C20 | `PASS_BOUNDED_DEFAULT_OFF` | P excludes drop/ambiguous legacy flags before date selection; eligible older normal sets remain. New drop comparison/aggregation deferred |
| EXCOMP-C21 | `DEFERRED_BY_PRODUCT_SCOPE` | Cardio outside new evidence; no arbitrary duration/distance PR. New parsing/mode/metric-direction comparison not implemented |
| EXCOMP-C22 | `PASS_BOUNDED_DEFAULT_OFF` | P preserves canonical exact decimals and consistent legacy lbs provenance; withholds inconsistent values, no display-rounded comparison |
| EXCOMP-C23 | `PASS_BOUNDED_DEFAULT_OFF` | P history older than one year remains eligible; horizon all-local-active-prior, not all-time/cloud truth |
| EXCOMP-C24 | `PASS_PERSISTED_REAL_PATH` | T real reader/repository pair and repeated derives; M/A shared load budget. Metadata verification and bounded recovery remain, no scan per card |
| EXCOMP-C25 | `PASS_BOUNDED_DEFAULT_OFF` | P pure frozen-input/no plan tests: same name/block/date/value never dedupes/adopts/suppresses or synthesizes session IDs |
| EXCOMP-C26 | `PASS_MOUNTED_DEFAULT_OFF` | M/A mounted account ABA; old tokens and foreign payload cannot publish |
| EXCOMP-C27 | `PASS_MOUNTED_DEFAULT_OFF` | M/A date ABA and out-of-order per-key requests; different visible keys independent |
| EXCOMP-C28 | `PASS_MOUNTED_DEFAULT_OFF` | M device/generation/gate/source/unmount/StrictMode/aborted-render safety; committed tree owns lifetime |
| EXCOMP-C29 | `PASS_MOUNTED_DEFAULT_OFF` | A actual durable save/delete commit invalidates before late publication and refreshes one shared pair |
| EXCOMP-C30 | `REQUIRED_FOR_PUBLIC_ACTIVATION` | `C30_DEFAULT_OFF_PREVIEW_ACCEPTANCE = PASS`; `PUBLIC_C30 = NOT_EXECUTED`. Section 10 is the remaining public gate, not a downgrade of preview proof |
| EXCOMP-C31 | `PASS_BOUNDED_DEFAULT_OFF` | P/M/A no new achievement/global PR, draft compatibility independent, incomplete never full-source truth. Final disclosure approval still C30; new achievement badges deferred |
| EXCOMP-C32 | `PASS_MOUNTED_DEFAULT_OFF` | M/A literal OFF/invalid-parent tests, compatibility/no writer contamination and exact scoped source diff; authority stays frozen |

## 10. Exact remaining PUBLIC_C30 acceptance

To set `PUBLIC_C30 = PASS` later, all of the following need evidence and a separate approval record, not only a green unit suite:

1. Approve the coupled public reader scope: B1/R/C dependencies, parent selected-day/Previous/calendar behavior, Home/Search truthful scope, and `REL05G5A-001` disposition/correction. No wider activation inferred from comparison review.
2. Approve public EN/KO/JA wording/placement: remove or intentionally approve QA-preview labelling, understandable source terms, separate source dates/selected-day boundary/local-active horizon, exact matching omissions, legacy draft/PR/cue/planning limitations and no canonical writer input.
3. Approve all visible states in section 5, including successful no eligible match versus verified storage empty, surviving partial versus complete, ordinary unavailable versus typed isolation, stale suppression, withheld numeric claims and unsupported variants. No failure-based absence or new metric.
4. Qualify section 6 in real supported browsers/assistive technology: contextual repeated-card names, heading/status/alert behavior, keyboard/focus/recovery, contrast, touch/zoom and responsive localized density. Parent surfaces included.
5. Execute section 7 feature-level real-browser/local/offline protocol including actual durable save/delete, multi-card/date/account/generation lifecycle and bootstrap/focus recovery. Keep global Track A/E3 qualification status distinct.
6. Approve the performance/support threshold policy and execute persisted large-history/whole-parent qualification from section 8. TEMP CPU results cannot close it.
7. Record human product-owner public-scope/copy acceptance and independent review of that evidence. A separately authorized dedicated activation PR must prove exact gate combinations, reversibility and frozen writer/data-plane boundaries. This document authorizes neither its creation nor a flag flip.

`PUBLIC_C30 = NOT_EXECUTED` throughout this characterization. Public activation is not authorized by merged #760, product approval of the earlier default-OFF ceiling, TEMP probes or this document.

## 11. Seven live-writer blockers: no blanket reader dependency

Every global blocker below remains **OPEN**. The table classifies its relevance to the bounded reader, not its closure or overall writer readiness.

| Global live-writer blocker | Public comparison relevance | Reason |
| --- | --- | --- |
| Unbound pre-reset create | `NOT_REQUIRED_FOR_READ_ONLY_ACTIVATION` / `REQUIRED_ONLY_FOR_WRITER_ROLLOUT` | No canonical create/bind/reset; current scope verification still required |
| Old-client rollback visibility | `NOT_REQUIRED_FOR_READ_ONLY_ACTIVATION` / `REQUIRED_ONLY_FOR_WRITER_ROLLOUT` | Read existing records without starting a writer that old clients cannot see; no cross-client/cross-device completeness claim |
| Old/new writer coexistence | `NOT_REQUIRED_FOR_READ_ONLY_ACTIVATION` / `REQUIRED_ONLY_FOR_WRITER_ROLLOUT` | No new writer/adoption/suppression or canonical plan input |
| Product UI identity integration | `NOT_REQUIRED_FOR_READ_ONLY_ACTIVATION` / `REQUIRED_ONLY_FOR_WRITER_ROLLOUT` | Source observation identity is retained; editable canonical-session identity mapping is not introduced |
| Canonical field/product ownership | `NOT_REQUIRED_FOR_READ_ONLY_ACTIVATION` / `REQUIRED_ONLY_FOR_WRITER_ROLLOUT` | No new editable fields or WorkoutSessionV1 change |
| Remaining analytics/projection/public claims | `REQUIRED_INDIRECTLY` for this reader's claim/copy and parent coherence only | Public C30 and related parent truth set must pass; global/composite PR, future analytics/export and general writer promises remain outside Option C. Reader acceptance closes no product-wide blocker |
| Reset-fenced local edit policy | `NOT_REQUIRED_FOR_READ_ONLY_ACTIVATION` / `REQUIRED_ONLY_FOR_WRITER_ROLLOUT` | No canonical edit/reset activation; read-only account/generation/currentness fences already required and proven |

No writer/G6 rollout or global authority adoption is a blanket prerequisite for qualified Option C display. Conversely, public reader QA is not authorization for any writer or data-plane operation.

## 12. Activation options and exactly one next task

| Option | Disposition and order |
| --- | --- |
| 1. Keep comparison default OFF while readiness work proceeds | Required current state; maintains proven bounded acceptance without implying public readiness |
| 2. Separate default-OFF public-copy/accessibility correction | Useful after parent scope identifies all coupled disclosures/controls; does not solve parent coupling, identity availability or performance/browser qualification alone |
| 3. Prepare parent reader public activation prerequisites first | **Selected next step**: determine coherent public scope and existing parent debt before approving comparison-only presentation or measuring an incomplete rollout |
| 4. Dedicated comparison activation PR | Not authorized now; only after remaining acceptance/explicit public decision, with reviewed parent flags and no writer/data-plane authority |

Exactly one recommended next task: **`REL_05G_HEALTH_SELECTED_DAY_AND_RANGE_PARENT_PUBLIC_READINESS_CHARACTERIZATION_01`**.

Proposed bounded scope: docs-only/default-OFF current parent-readiness characterization, including selected-day/Previous/calendar and Home/Search public truth-set coupling, `REL05G5A-001` activation-prerequisite disposition, parent copy/accessibility and feature/offline/performance QA scope. Preserve all closed default-OFF implementations and seven OPEN writer blockers. Do not implement correction, flip gates or start physical execution merely from this recommendation. Sequencing is driven by the coupled product surface, not code-size convenience.

## 13. Validation and frozen authority

Source and historical-contract inspection, not old unexecuted matrix wording, substantiates this record. On the exact baseline this task ran:

```text
npm test -- src/lib/workoutExerciseComparisonProjection.test.ts
  src/lib/workoutExerciseComparisonOwner.test.ts
  src/lib/workoutExerciseComparisonPersistedTrust.test.ts
  src/components/views/features/health/healthExerciseComparisonMounted.integration.test.ts
  src/components/healthExerciseComparisonAppContent.integration.test.ts
  src/lib/workoutLocalReaderAuthority.test.ts src/lib/i18n.test.ts
```

Result: **7 files / 198 tests PASS**, 2026-10-08 22:18:33 Asia/Seoul. TEMP-only measurement: final 1/1 PASS (section 8), not a new tracked test or public QA. No expensive full suite was run solely for docs; exact-baseline main CI above and the new Draft PR's hosted CI carry repository regression evidence. Initial Draft CI status belongs in the publication report, not a promise of completed future checks.

Publication boundary: this one new Markdown artifact only. Required hygiene: exact changed-file check, local relative-link consistency and `git diff --check`; normal topic commit/push, Draft targeting main. No Ready, merge or auto-merge authority is included.

Frozen without modification:

| Boundary | Retained state |
| --- | --- |
| `HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED` | `false` |
| `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED` | `false` |
| `HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED` | `false` |
| `HOME_WORKOUT_COMPOSITE_READER_ENABLED` | `false` |
| `SEARCH_WORKOUT_COMPOSITE_READER_ENABLED` | `false` |
| `TRACK_A_STATUS` | `TRACK_PARTIAL` / `PATH_A_QUALIFICATION_PARTIAL` |
| `E3_FEASIBILITY` | `NOT_ESTABLISHED` |
| `LIFECYCLE_EVIDENCE_SOURCE` | `REMAINS_UNAVAILABLE` |
| `BOOTSTRAP_ADMISSION` | `BLOCKED_BY_EVIDENCE_QUALIFICATION` |
| `R2-U` | `NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF` |
| Tracks B/C/D | `NOT_EXECUTED` |
| Legacy verified-owner classification gap | `UNRESOLVED` |
| Seven live-writer blockers | `OPEN` |
| Authority/source shape | DB v7, schema v1, stores/indexes/keyPaths, backend and WorkoutSessionV1 unchanged |
| Product permissions | No public reader, canonical writer, bind/push/pull/resync/reset or G6 activation; physical qualification deferred unchanged |

Primary readiness classification: **`EXCOMP_PUBLIC_ACTIVATION_BLOCKED_BY_MULTIPLE_PREREQUISITES`**.
