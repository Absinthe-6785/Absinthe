# REL-05G Health parent legacy prevData freshness product decision

## 1. Merged baseline and decision boundary

Current workstream: `REL_05G_HEALTH_PARENT_LEGACY_PREVDATA_FRESHNESS_PRODUCT_OWNER_DECISION_PUBLICATION_01`.

Original package: `REL_05G_HEALTH_PARENT_LEGACY_PREVDATA_FRESHNESS_PRODUCT_DECISION_01`.

Repository: `Absinthe-6785/Absinthe`. Canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`.

| Baseline evidence | Verified value |
| --- | --- |
| Main / origin main | `22bb6b8f7a30297aa0da67912d53b129a307215a` |
| [PR #768](https://github.com/Absinthe-6785/Absinthe/pull/768) | `MERGED / CLOSED` |
| Independently reviewed approval head | `9d9c12ebe2f8ed073f542726a68c18b528989ab0` |
| Merge commit | `22bb6b8f7a30297aa0da67912d53b129a307215a` |
| [Post-merge main CI](https://github.com/Absinthe-6785/Absinthe/actions/runs/38151394080) | `PASS`: test, typecheck, build, backend-rel05g1, backend-recovery completed/success |

`DECISION_PACKAGE_STATUS = HEALTH_PARENT_LEGACY_PREVDATA_FRESHNESS_PRODUCT_OWNER_APPROVED_PENDING_APPROVAL_DELTA_REVIEW`.

`LEGACY_COMPATIBILITY_FRESHNESS_DECISION = PRODUCT_OWNER_APPROVED`.

`PUBLIC_READER_CURRENTNESS_PREREQUISITE = POLICY_SELECTED_IMPLEMENTATION_AND_ACCEPTANCE_PENDING`; not CLOSED.

`PRODUCT_OWNER_DECISION_STATUS = PRODUCT_OWNER_APPROVED`; `PRODUCT_OWNER_DECISION = D_HYBRID_STATE_DEPENDENT`; `PREVDATA_FRESHNESS_PD01 = D_HYBRID_STATE_DEPENDENT`.

`NEW_PRODUCT_DECISION_MADE = YES`; `SELECTED_PREVDATA_FRESHNESS_POLICY = D_HYBRID_STATE_DEPENDENT`; `FRESHNESS_POLICY_IMPLEMENTED = NO`.

This docs-only publication records the explicit human approval of the D product policy in section 18. It is not implementation or activation authorization, an identity-recovery route, or a writer transition. Approval-delta review and canonical review/merge must precede a separately authorized implementation task. Baseline CI proves regression checks at that head, not freshness implementation acceptance.

### Inputs reconciled against this baseline

The six architecture inputs and five requested source files were read completely; relevant tests and helpers were inspected:

- [Health selected-day/range parent public readiness](REL-05G-health-selected-day-range-parent-public-readiness-characterization.md).
- [Exercise comparison public readiness](REL-05G-workout-exercise-comparison-public-readiness-characterization.md).
- [Approved comparison product decision](REL-05G-workout-exercise-comparison-product-decision-package.md).
- [Exercise comparison truth characterization](REL-05G-workout-exercise-comparison-truth-characterization.md).
- [Reader expansion preparation](REL-05G5B2B2-product-reader-expansion-prep.md).
- [Previous/Calendar consumer integration preparation](REL-05G5B2B2B-consumer-integration-prep.md).
- [HealthView](../src/components/views/HealthView.tsx), [previous fetch adapter](../src/components/views/features/health/prevWorkoutFetch.ts), [local Health runtime](../src/lib/healthLocalRuntime.ts), [range owner](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts), and [AppContent](../src/components/AppContent.tsx).

The earlier preparation documents describe historical stages; their then-unmounted reader gaps are not new findings against current main. Current gated B1/range/comparison and Home/Search integrations exist but remain OFF. Current B1 handles typed persisted canonical isolation; this package does not reopen its historical classification defect. Approved source separation and compatibility formulas remain binding, but they do not approve independent `prevData` currentness.

## 2. Exact current cache ownership and lifetime

| Current source evidence | Actual guarantee / limitation |
| --- | --- |
| HealthView lines 297-304 | React `prevData` is block-keyed; `prevDataRef` mirrors it. Payload contains `prev_sets`, `prev_date`, `pr_kg`, not a publication/source epoch. |
| HealthView lines 390-409 | Account/date/memo-scope effects empty the cache. This is not an explicit request-scoped date-ABA fence for every previous fetch. |
| HealthView lines 129-145, 449-483 | Account-operation generation and mounted checks constrain continuations. `ensurePrevData` fetches only undefined entries; `fetchPrevForBlock` returns cached `prev_sets` early. Even an empty array is truthy for that early return. Neither function captures an independent invalidation/request revision. |
| HealthView lines 461-489 | Local workout and selected-routine consumers can request missing IDs. Overlapping missing requests are possible before a result is published; there is no shared per-scope in-flight previous-query dedupe here. |
| Previous fetch adapter lines 46-70 | Current local-working-copy mode reads the account-local legacy source. The inactive HTTP branch has concurrency four and can omit failed results; that limit is not a local read budget. |
| Local Health runtime lines 256-284 | Each invocation performs one verified account `readAll()`, filters exact block ID and `row.date < beforeDate`, and sorts prior rows by date descending. It returns the latest prior row's whole cloned set array/date. When there is no matching row, the block key is omitted. |
| Same local runtime function | `pr_kg` considers finite numeric kg across all matching prior rows, without the new comparison eligibility filters. A shared driver is not a shared history snapshot or a source revision attached to `prevData`. |
| HealthView lines 591-609, 628-662, 736-748 | Routine assembly/application and direct add use historical counts; existing workouts and explicit routine counts also affect planning. Fresh sets do not copy historical workout values. |
| HealthView lines 1299-1302, 1652-1675, 1795-1824 | Legacy PR/diff and best/per-set previous micro-cues consume this cache independently of the adjacent composite comparison. |
| HealthView lines 783-824, 974-1062 | Durable delete/save have their own stronger account/date operation scope and fanout. They do not explicitly invalidate/refetch `prevData`. These guards are not proof of previous-fetch date/request freshness. |
| AppContent lines 366-419, 421-437 | Current-account durable fanout, managed focus/visibility recovery, and shared B1/range retry govern their readers, not this cache. Range owns comparison retry. Bootstrap/startup paths do not qualify the previous payload. |
| HealthView lines 503-516, 1408-1409 | B1 loading/legacy availability and dirty-draft guards can mask or preserve editor UI. Masking an old cue during one transition is not proof that its cache was refreshed. |

The legacy previous query covers all local prior history, not the range reader's bounded history window. Range or comparison evidence is therefore not a substitute, even when it includes a legacy lane. Same-date sorting does not establish session chronology. No current cache payload proves whether a durable write occurred after its read.

## 3. Currentness problem statement

The pre-approval characterization at `5a49c95d148ce3be5aa2e24f92380a41c8c52b7d` was `INDEPENDENT_CACHE_LIFETIMES_WITHOUT_APPROVED_PUBLIC_COHERENCE_POLICY`.

The decision question was how public legacy Previous/PR/planning consumers respond to freshness-relevant changes beside independently invalidated B1/range/comparison readers. Section 18 now selects that product policy; the independent runtime cache lifetimes remain unchanged and implementation/acceptance remain pending. Cached positive evidence can be reused without a new legacy read. A newer incomplete comparison cannot certify that the old compatibility badge remains current.

This is not proof that every retry displays a stale visible bug. Current resets, account guards, conditional rendering and unchanged history can prevent a visible mismatch. Conversely, passing comparison fanout tests does not establish this cache's freshness. Public activation needs both honest suppression and bounded recovery, not merely a stronger claim about existing tests.

## 4. Fixed product and source contract

The approved comparison Option C remains source-separated. Canonical evidence never auto-plans, changes legacy PR arithmetic, or wins a global cross-source comparison. Comparison's completed eligible normal weighted-strength rules do not replace the legacy latest-row/count/all-prior-kg rules. Legitimately different dates or candidates across those rules are not themselves staleness.

Ordinary source failure can leave independently qualified evidence from the other source usable as partial. Typed isolation suppresses the paired comparison publication; old account/date/device/generation/owner-lifetime publication is never reused by identity coincidence. Failure is not verified absence. This package does not change the source-symmetric isolation contracts or any projection formula.

Compatibility currentness is a wrapper around unchanged legacy facts, not a new fact producer. It must not manufacture no-previous, no-PR, zero sets, cloud completeness, identity validity, or writer permission.

## 5. Freshness trigger inventory

This table assesses eligibility for reusing a cached result, not proof that current code implements the action. `CONDITIONAL` requires same query/publication scope plus independent legacy currentness evidence; current payloads alone lack that evidence. `NO` means the old result cannot qualify the new scope/transition. Even a safe value match cannot revive a rejected operation.

Action vocabulary: **R** = bounded verified legacy re-read for affected/querying IDs; **F** = immediately fence old publication and historical default seeding; **W** = suppress unqualified compatibility evidence with status; **K** = retain only with independent proof of unaffected legacy facts; **X** = reject late/foreign result. A/B/C each still require account/mount/isolation safety. R never means remote sync, canonical read substitution, or clearing user drafts.

| # / Trigger | CURRENT_CACHE_SAFE_TO_REUSE | ACTION_UNDER_A | ACTION_UNDER_B | ACTION_UNDER_C | ACTION_UNDER_D |
| --- | --- | --- | --- | --- | --- |
| 1 Account A -> B | NO | F; R only for B | F; different account fence | W for old A | F/X; R B when requested |
| 2 Account A -> B -> A | NO | F; new A-lifetime R | F; reject old A token | W until new qualification | F/X; fresh A owner, R |
| 3 Sign-out | NO | F; no authenticated-account R | Revoke owner/scope | W; no prior-account cue | Revoke/X; preserve no foreign draft |
| 4 Selected date A -> B | NO | F; R with B cutoff | F date/request scope | W until B qualifies | F; R active IDs for B |
| 5 Selected date A -> B -> A | NO | F; new A operation R | New token, not date equality | W old A publication | F/X; new A operation R |
| 6 Legacy durable save | CONDITIONAL: only proven unaffected query | R affected IDs; unknown impact batches active IDs | F affected legacy epoch | W affected evidence | F then R affected IDs after commit; K proven unrelated |
| 7 Legacy durable delete | CONDITIONAL: latest/prior maximum can change | R affected IDs; same unknown-impact rule | F affected epoch | W affected evidence | F then R after commit; K proven unrelated |
| 8 Canonical-only durable change via range/comparison | CONDITIONAL: no legacy mutation and valid scope | K if proven unrelated; otherwise R | Own legacy fence, not child revision | W only if legacy proof lost | K proven canonical-only; F/R if impact unknown |
| 9 Manual selected-day Refresh | CONDITIONAL: its approved coverage matters | R if compatibility included | Revalidate independent legacy fence | W until independently qualified | Parent-currentness gesture F/R; narrower B1-only gesture K if proven unrelated |
| 10 Manual range/comparison retry | CONDITIONAL: child retry is not proof | R if parent compatibility recovery requested | Revalidate own legacy fence | W if proof unavailable | Explicit parent recovery F/R; unrelated child-only reload K |
| 11 Startup/bootstrap retry | CONDITIONAL: write/scope effects may be unknown | R after relevant legacy changes/unknown impact | Revalidate owner and legacy epoch | W unproven | F/R on legacy mutation or uncertainty; K otherwise |
| 12 Focus/visibility recovery | CONDITIONAL: possible missed legacy changes | R when freshness coverage cannot be shown | Validate independent mutation coverage | W if no coverage proof | Coalesced R active IDs on uncertainty; K if proof covers interval |
| 13 Offline -> online | CONDITIONAL: connectivity alone changes no local fact | K unless actual local change/unknown interval | Validate local fence | W only unqualified, not merely offline | K verified local snapshot; R relevant change/uncertainty |
| 14 Device ID change | NO for old parent publication | F; new-scope R if valid | Revoke eligibility token | W; no identity repair | F/X; requalify existing valid legacy scope only |
| 15 Namespace change | NO for old parent publication | F; R admitted scope only | Revoke namespace fence | W | F/X; no guessed namespace or data transfer |
| 16 Generation change | NO for old parent publication | F; R valid current scope | Revoke generation fence | W | F/X; requalify, never resurrect old generation |
| 17 Owner/current-scope rejection | NO | X; R only new valid owner | Revoke token; X | W | F/X; bounded new-owner recovery |
| 18 Ordinary error -> success | CONDITIONAL: new read must qualify | R result publishes only current scope | Qualify own successful source token | Withhold until qualifying success | Qualified success replaces status; no arrival-order revival |
| 19 Success -> partial | CONDITIONAL: which source failed matters | R if legacy unproven, not for canonical failure alone | Keep only independently qualified legacy | W stale/unqualified legacy | K fresh legacy after canonical ordinary failure; F/W/R if legacy lost |
| 20 Partial -> complete | CONDITIONAL: paired completeness not legacy-cache proof | R unqualified compatibility IDs | Require separate legacy proof | W until separate qualification | Recheck own proof; R only if unqualified |
| 21 Typed isolation | NO for rejected/paired scope | F/W; no blind recovery loop | Revoke compromised publication | W isolation, not empty | F/X/W; no cross-source replacement or identity recovery |
| 22 Health exit -> re-entry | NO for old mounted publication | New owner R | New mount token; old result unqualified | W until requalified | New mount F/R; no old in-flight reuse |
| 23 Add exercise | CONDITIONAL: exact query/currentness proof | R if missing/unqualified | Verify block proof before seeding | W historical defaults while unproven | K qualified block or R; explicit/manual path remains available |
| 24 Assemble/apply routine | CONDITIONAL: each block, count source differs | Batch R unqualified historical IDs | Verify each historical dependency | W historical seeding, retain explicit counts | Batch R; keep explicit preset/manual counts and existing drafts |
| 25 Fetch completes after invalidation | NO | X; use post-invalidation R | X old token | W; X | X even if account/date matches |
| 26 Multiple rapid retries | NO for superseded operations | Coalesce new scope; superseded X | Latest valid token only | W while no qualified result | One bounded qualifying batch per effective scope; X old completions |
| 27 Save/delete during previous fetch | CONDITIONAL: proven disjoint writes only | X affected old read; R after commit | F epoch crossing affected write | W affected; no false absence | F/X affected; post-commit R; preserve editor drafts |

Known affected IDs include both old/new block IDs and old/new dates if a mutation moves a row. A change at/after the selected cutoff is disjoint only if no earlier row, block mapping or source eligibility changed. Deleting an older maximum can affect `pr_kg` even when it does not change the latest previous row. An unknown legacy impact invalidates all currently consumed historical dependencies; inactive IDs remain unqualified until requested. No canonical-only event is relabeled a legacy mutation.

## 6. Required currentness scope

`PREVDATA_REQUIRED_SCOPE_KEY = (accountId, beforeSelectedLocalDate, blockId, legacyAuthorityMode, healthMountLifetime, accountOperationGeneration, previousRequestEpoch, previousInvalidationEpoch, legacyMutationCoverageEpoch, parentEligibilityScope(deviceId?, namespace?, generationId?))`.

This is a conceptual qualification tuple, not an implemented cache key, new durable record, or approved metadata design. Question marks mean a dimension is bound when the active parent/source contract provides it; they do not mean unknown identity may be invented or a changed established identity ignored.

| Dimension | Role and evidence boundary |
| --- | --- |
| Account, normalized selected local date, exact block ID | Actual query identity: account-local history, strict before-date cutoff, exact legacy block. Block ID alone is insufficient. |
| Legacy authority mode | Local-working-copy result cannot be reused as an HTTP/other-authority result. No mode switch authorized here. |
| Mount, account operation generation | Publication eligibility and ABA protection, not history content. A returning account is a new lifetime. |
| Previous request/invalidation epochs | Proposed ordering fence: an earlier request cannot publish after a qualifying transition, even with equal query strings. Not present in current payload. |
| Legacy mutation coverage epoch | Proposed proof that relevant committed legacy changes did not cross the accepted read, or that the read followed them. Existing row logical versions are not automatically this all-prior-query revision. No universal epoch is currently exposed by this cache. |
| Device/namespace/generation parent eligibility | Revoke old parent publication on a known change/rejection. These are not direct parameters of current legacy `readAll(account)` and do not turn canonical identity failure into legacy emptiness. Independently valid legacy evidence can survive ordinary canonical failure. |
| Read completion time | Diagnostic/as-of label only; wall-clock recency is not mutation coverage or authorization. Record completion with proof if later implemented, not as sole qualification. |
| Range/comparison publication revision | Independent consumer publication; excluded as a qualifier of this tuple. Neither chronology nor equal revision numbers proves matching legacy query coverage. |

Future implementation must establish notification/coverage boundaries for relevant legacy writes, bootstrap/import effects and missed or cross-context changes. If coverage cannot be proven, a bounded fresh verified legacy read is needed at the public-currentness barrier; no timestamp/TTL or unobserved-mutation claim fills the gap. A result is local currentness as of its qualified snapshot, not continuous global/cloud completeness. A safe implementation design still requires separate review; this package does not add an epoch source or require a schema migration.

## 7. Option A — A_BOUNDED_REFRESH

Invalidate affected compatibility entries at an approved trigger, fence old reads/publication, then read verified legacy history before reusing historical cues/defaults. All-active-ID refresh is appropriate only for unknown relevant impact or an explicit parent recovery request, not every child publication. Batch visible/workflow-required IDs; direct add and routine paths must wait for their qualifying historical dependency or use explicit user inputs, never stale seeding.

| Required classification | Assessment |
| --- | --- |
| REFRESH_TRUTH_SAFETY | CONDITIONAL: verified source coverage plus scope/request fences; re-reading alone cannot prevent late ABA publication. |
| REFRESH_CURRENTNESS_STRENGTH | Strong after an accepted post-transition legacy snapshot; no guarantee across missed writes without an observation contract. |
| REFRESH_READ_COST | Potentially high: full account-history read per invocation, not indexed per-block reads. Batching/coalescing essential to measure. |
| REFRESH_RACE_COMPLEXITY | HIGH: writes during reads, superseded retries and owner/date lifetimes need independent acceptance proofs. |
| REFRESH_PUBLIC_UX_IMPACT | Refresh status and short historical-cue/default pauses; failed reads need honest unavailable/withheld state and manual recovery. |

`OPTION_A_BOUNDED_REFRESH = CONDITIONAL`. Viable but a blanket all-child-refresh rule spends reads without proving a legacy dependency; it still needs fencing and a failure policy. It preserves every PR/count/planning formula and local ownership, not historical value copying. No automatic reload storm or network requirement is acceptable.

## 8. Option B — B_REVISION_FENCE

Retain raw values privately, qualify publication with an independently owned legacy query/scope token, and suppress values when proof no longer applies. A Health compatibility-read owner would own its token, not borrow the range/comparison number. Retention must not allow stale values back into planning by a non-UI path.

| Required classification | Assessment |
| --- | --- |
| FENCE_TRUTH_SAFETY | CONDITIONAL: safe suppression if all consumers, including planning, check the independent proof. |
| FENCE_CURRENTNESS_STRENGTH | Strong revocation, not evidence acquisition. Cannot make an old value fresh merely by incrementing/stamping a token. |
| FENCE_IMPLEMENTATION_COMPLEXITY | HIGH: new conceptual metadata/owner ordering and exhaustive consumer checks are not currently implemented. |
| FENCE_CROSS_SOURCE_VALIDITY | Range/comparison revision is INVALID as legacy-cache qualification; independent legacy coverage is required. |
| FENCE_PUBLIC_UX_IMPACT | May withhold indefinitely unless a separately qualifying legacy read/recovery exists; retained values must not look current. |

`OPTION_B_REVISION_FENCE = CONDITIONAL_NOT_SUFFICIENT_ALONE`. Useful safety mechanism, not a standalone liveness solution with current payloads. A date/account ABA or stale-but-retained positive hit must fail the old token. No false shared revision is proposed.

## 9. Option C — C_WITHHOLD_WHEN_UNPROVEN

Suppress unqualified previous best/per-set cues, PR/diff badges and historical default seeding. Keep the current account's valid editor draft and explicit counts usable. Private retained data is not a source of a hidden default. A qualifying legacy read, not a successful unrelated paired read, permits recovery.

| Required classification | Assessment |
| --- | --- |
| WITHHOLD_TRUTH_SAFETY | Strong fail-closed publication, conditional on all planning/cue consumers following it. |
| WITHHOLD_RECOVERY_ENVELOPE | Current-scope verified local read/manual recovery; indefinite withholding possible without a bounded acquisition policy. |
| WITHHOLD_PRODUCT_DEGRADATION | Reduced historical guidance and blocked history-derived initialization, not disabled manual editing or erased drafts. |
| WITHHOLD_COPY_REQUIREMENT | Explicit unqualified/stale/unavailable status; never “no previous”, “no PR” or zero planned sets as error fallback. |
| WITHHOLD_OFFLINE_BEHAVIOR | Verified local evidence remains usable offline; only unqualified/local-failed evidence is withheld. |

`OPTION_C_WITHHOLD = SAFE_SUPPRESSION_INCOMPLETE_RECOVERY_POLICY`. Safe degradation can be chosen explicitly, but should not be mistaken for currentness acquisition. A stale dated cue could be offered as a separately approved historical-only UX, unlike a present PR claim; this package does not recommend or approve that variant.

## 10. Option D — D_HYBRID_STATE_DEPENDENT

`HYBRID_POLICY_FEASIBILITY = CONDITIONAL`; `OPTION_D_HYBRID_STATE_DEPENDENT = CONDITIONAL`.

Product-approved policy shape, derived from the query and lifecycle rather than UI adjacency; none of these freshness behaviors is implemented by this publication:

1. Revoke compatibility publication/historical seeding immediately on scope rejection, relevant legacy mutation or uncertain currentness. Do not erase existing same-scope user drafts.
2. Refresh affected consumed IDs after relevant durable legacy commit, on an explicit parent-currentness recovery request, and when a new mount/query or uncertain recovery interval lacks proof. Batch IDs sharing the exact query/lifetime; do not globally refresh merely because a canonical child publication changed.
3. Keep a qualified independent legacy result when an event is proven disjoint, including canonical-only ordinary failure/reload. Unknown impact is not “disjoint”.
4. While refreshing, fence all previous consumers. On ordinary legacy failure withhold them with status; on isolation revoke the rejected scope and suppress paired publication. No remote requirement, blind automatic retry, or identity repair.
5. Accept only a verified legacy result whose query, owner, request and mutation coverage still qualify at publication and before historical seeding. A post-write/retry read supersedes the old in-flight read; late arrival never wins.
6. Recovery resumes unchanged legacy formulas from qualified evidence; it does not reseed/overwrite an existing draft or inject canonical inputs.

The condition is real: mutation coverage, trigger routing, bounded batching, public recovery semantics and performance are not implemented/proven. Pure refresh needs failure fences; pure fence/withhold lacks recovery. D makes those roles explicit without a shared-source revision. There is no second recommendation hidden in these constituent mechanisms.

## 11. Planning-default safety

`PLANNING_DEFAULT_CURRENTNESS_POLICY = RETAIN_EXISTING_DRAFT_ONLY_BUT_DO_NOT_RESEED`.

Product-approved within D, not implemented: unproven historical freshness must not discard or reseed an existing valid draft; new history-derived defaults require freshness proof. A later qualifying refresh must still not overwrite user edits.

| Candidate choice | Assessment |
| --- | --- |
| YES_ALWAYS | Reject: a private stale cache hit would silently seed a new public draft. |
| YES_ONLY_IF_FRESHNESS_PROVEN | Necessary for new historical defaults, but does not by itself specify treatment of existing user draft. |
| RETAIN_EXISTING_DRAFT_ONLY_BUT_DO_NOT_RESEED | Selected within D: preserve valid current-scope draft; do not derive a new count from stale history or auto-reseed after refresh. |
| WITHHOLD_NEW_DEFAULTS_WHILE_STALE | Necessary for the history-derived branch, not a prohibition on explicit preset/manual counts. |

Current [set constructors](../src/components/views/features/health/workoutSetCount.ts) retain count precedence/default 1 and non-cardio clamp 1-12; cardio gets one. The mounted routine [preset count](../src/components/views/features/health/routinePresets.ts) prefers an explicit stored count, then previous length, then default 3, subject to existing cardio/clamp behavior. Whole previous arrays, including unfinished sets, influence compatibility count. These formulas are not changed or replaced with comparison eligibility.

A verified successful no-prior result may use the existing no-history fallback. A qualified prior row with an empty set array also retains the existing count fallback, but is not an empty history source or proof that no prior row exists. An undefined payload caused by failure/staleness is not either verified result: do not route it through default 1/3 as if absence were verified. A user-explicit count or stored routine count is independent of historical proof and remains usable; editor/manual-set alternatives need explicit UX, not an invented fallback formula. Adding/applying a routine must distinguish those branches per block. Existing drafts are preserved only within their valid account/date lifetime, never moved across scope, and refreshed history must not rewrite user choices. No canonical auto-planning.

## 12. Legacy PR badge safety

`LEGACY_PR_BADGE_CURRENTNESS_POLICY = HIDE_UNQUALIFIED_BADGE_REPLACE_WITH_STATUS`.

Product-approved within D, not implemented; includes historical diff.

The [PR helper](../src/components/views/features/health/computeWorkoutPrBadge.ts) compares completed current strength-set positive kg against `pr_kg`, and computes the display-unit diff against completed positive kg in the latest previous sets. All-prior legacy `pr_kg` and latest-row diff have different coverage; neither may be qualified by the bounded comparison window. Preserve rounding/unit and assistance compatibility, not the new comparison filters.

An old PR badge is a claim about current-vs-history, not just a dated fact. A stale label on the same “PR” badge risks retaining that claim; the approved policy requires hiding unqualified PR/diff and showing currentness status. Hidden is not “no PR”. A newer partial comparison must not coexist with an unqualified old badge as current. Conversely, independently fresh full-query legacy evidence can support the unchanged badge after ordinary canonical failure, marked as legacy/local evidence with no complete composite claim. It reappears only when the current legacy query qualifies, not when comparison becomes complete.

## 13. Legacy Previous micro-cue safety

`LEGACY_PREVIOUS_CUE_CURRENTNESS_POLICY = HIDE_UNQUALIFIED_CUE_REPLACE_WITH_STATUS`.

Product-approved within D, not implemented; covers both best-session and per-set references, without deleting existing draft values.

This was evaluated separately from PR: a previous cue can be a dated historical candidate rather than a superlative against all history. A clearly stale, dated historical-only cue is therefore more defensible than a stale PR badge, but that variant remains unselected and must never seed new defaults. The selected D policy requires withholding the unqualified cue to avoid ambiguous adjacent-currentness UX, not because the two computations are identical. Qualified previous cues retain completed/usable-set, semantic set-number/drop and unit rules; no comparison candidate silently replaces them. See [cue tests](../src/components/views/features/health/previousMicroCue.test.ts).

## 14. Public states and local-first behavior

These are requirements of the selected policy, not implemented strings or accepted public copy/interaction behavior. Public copy acceptance remains NOT_EXECUTED. Status must be accessible/localized, scoped to legacy compatibility evidence, and separate from the unchanged draft and independently qualified comparison lanes.

| State | Under A (unselected) | Under B (unselected) | Under C (unselected) | Under selected D (not implemented) |
| --- | --- | --- | --- | --- |
| Current | Accepted fresh read shows unchanged facts | Independently qualified token permits facts | Qualifying event permits facts | Qualified local legacy evidence shows facts |
| Refreshing | Hide old current claim; show read status | Old token fenced; show qualification pending | Withhold; show recovery pending if attempted | Fence old cues/defaults; show bounded refresh status |
| Unavailable | Failed read, retry possible | No valid qualification source | Suppressed with unavailable status | Local legacy failure, no fabricated absence |
| Stale/suppressed | Known invalidated evidence hidden | Private stale values retained but fenced | Private values may remain, not usable as defaults | Cues/PR replaced by status; existing draft only retained |
| Partial | Show only independently qualified sources | Token never borrows other-source success | Qualified source may survive | Fresh legacy survives canonical ordinary failure; stale legacy does not |
| Isolation | Rejected scope suppressed, no auto-repair | Revoke scope token | Isolation notice, not empty | Suppress paired comparison and rejected compatibility scope; no unsafe fallback |
| Offline | Local verified refresh can succeed | Valid local proof remains valid | Do not hide solely for being offline | Offline alone does not invalidate local truth; failed local read is unavailable |
| No prior eligible legacy evidence | Successful query proves no matching prior row | Same verified scope required | No-prior only after qualification | Existing no-history defaults only after verified no-match |
| Verified legacy empty | Complete verified account-history read is empty | Proof must cover history, not absence of a token | Empty only with independent evidence | Distinguish empty whole source from no match for this block/cutoff |

“Eligible” in the no-prior row means eligible for this unchanged legacy query, not new exercise-comparison eligibility. Current omitted block keys do not encode success/error scope metadata on their own. A future wrapper must distinguish verified query no-match from incomplete/failed read before publishing copy or fallback defaults. `STALE`, `UNAVAILABLE`, `NO_MATCH`, and `VERIFIED_EMPTY` are distinct; a nonempty source can still have no match for one block/date.

`LOCAL_FIRST_CURRENTNESS_COMPATIBILITY = PASS` for the selected policy's design constraints, not an executed runtime result. Local account legacy evidence remains the compatibility owner and can qualify offline. No forced login or remote success solely to refresh local history; no cloud completeness claim. Fresh legacy remains useful under ordinary canonical unavailability without guessed identity. Typed isolation and invalid account ownership remain fail-closed. Home/Search publication cannot manufacture qualification.

## 15. Read and performance budget

Current parent can issue selected-day paired reads, range paired reads and a separate legacy previous-query path. Reusing the range result is not free full-history coverage. Current previous batching performs one full verified account-history read per call, then per-block filtering/sorting; individual `fetchPrevForBlock` calls and routine applications can repeat that work. A successful local no-match omits the key rather than storing a qualified negative result, so subsequent undefined-entry requests can repeat the read too. The HTTP concurrency cap does not bound this local path.

Proposed measurement/acceptance plan for a separately authorized implementation:

- Compare global invalidation, affected-ID refresh and one batched query for visible/workflow IDs. Include prior rows beyond range bounds and deletion of an older kg maximum; targeted optimization must retain truth coverage.
- Measure actual source-read count, rows/bytes processed, filter/sort and cloning cost, CPU/main-thread time, memory, end-to-end cue-ready latency and tail latency. Do not count a shared driver as deduped reads.
- Exercise 100/500/1000+ history records, increasing visible exercise cards and routine size, cold/warm mount re-entry, save/delete fanout, focus bursts and repeated manual retries. Record environment and raw measurements; approve thresholds later, not invented here.
- Consider batch/coalescing only for matching query/lifetime/mutation coverage. A retry or relevant committed write must revoke an earlier flight's right to qualify; “reuse in flight” must not return pre-transition evidence. Disjoint proven writes may retain proof without a read.
- Bound effective recovery batches and surface manual retry after failure; no unbounded automatic loop. Verify listener/fanout ownership and prevent per-card reload storms without changing history semantics.
- Separately qualify real-browser offline, interaction latency and status transitions. Hosted unit CI is not physical/platform/performance qualification. No schema/index optimization, new instrumentation code or acceptance threshold in this task.

## 16. Race/ABA and future acceptance requirements

All following checks are `REQUIRED / NOT EXECUTED` for a future implementation. Inspection of existing tests is not their execution or proof of this new policy.

| ID | Required future assertion |
| --- | --- |
| PREVDATA-C01 | Account A -> B -> A: old A completion cannot publish or seed the new A lifetime; no B history/draft crosses into A. |
| PREVDATA-C02 | Date A -> B -> A: old A request rejected even when formatted cutoff returns to A; missing and positive cached cases both tested. |
| PREVDATA-C03 | Late completion after invalidation: old values never become current by arriving last; failed replacement remains unavailable, not no-match. |
| PREVDATA-C04 | Two refreshes resolve in reverse order: only qualifying current request accepted; equal values do not revive old tokens. |
| PREVDATA-C05 | Save/delete during fetch: affected old read fenced; post-commit read includes updated latest row/all-prior PR; drafts preserved. Include older maximum deletion and proven disjoint cutoff change. |
| PREVDATA-C06 | Retry during fetch/rapid retries: bounded batch count, correct supersession, no stale in-flight reuse or reload storm. |
| PREVDATA-C07 | Unmount/re-entry: old callbacks rejected; new owner requalifies; source errors do not use an old positive hit as fresh. |
| PREVDATA-C08 | Device/namespace/generation change or owner rejection: revoke old publication/seeding, no repair/reidentify/foreign data. |
| PREVDATA-C09 | Ordinary failure -> success: status recovers only on current verified legacy query; distinguish no-match, verified empty and partial history. |
| PREVDATA-C10 | Success -> isolation: paired publication and rejected compatibility scope suppressed synchronously; no stale fallback or false empty. |
| PREVDATA-C11 | Newer partial comparison: unqualified legacy PR/cue suppressed; independently fresh legacy can survive ordinary canonical failure; no shared revision inference. |
| PREVDATA-C12 | Planning: stale history cannot seed add/routine paths; explicit count and existing valid draft remain; refresh never reseeds; verified no-history retains exact old defaults/clamps. |
| PREVDATA-C13 | Formulas: legacy whole-array count, latest-row cue, all-prior PR, unit/rounding and assistance/drop behavior unchanged; canonical never plans or changes PR. |
| PREVDATA-C14 | Offline and focus/bootstrap: verified local evidence usable without network/login; unknown mutation interval requalifies; no claim of remote/global completeness. |
| PREVDATA-C15 | Public states: stale/unavailable/no-match/empty distinct; hidden PR is not no-PR; accessible recovery/copy and measured read budget reviewed before activation. |

Existing coverage inspected: [AppContent comparison integration](../src/components/healthExerciseComparisonAppContent.integration.test.ts) exercises save/delete fanout and OFF editor parity but mocks previous fetch; it cannot prove real previous-cache refresh. [Mounted Health races](../src/components/healthWorkoutFullMountedRace.integration.test.ts) exercise late original-account commit into the returning current-account lifetime for the readers, not this cache. A future previous-cache fanout must follow the same current-account routing and reject old UI payloads, not reopen that closed reader race.

[Range owner tests](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.test.ts) cover synchronous revocation, account ABA, retry budget and no source rescan on projection bounds. [Mounted comparison tests](../src/components/views/features/health/healthExerciseComparisonMounted.integration.test.ts) cover partial/isolation/no-eligible/empty and publication ABA/device/generation. These qualify their owners only. [Operation-scope tests](../src/components/views/features/health/healthWorkoutOperationScope.test.ts) cover save/delete scope, not every previous-fetch continuation. [Metrics tests](../src/components/views/features/health/workout/workoutMetrics.test.ts), [set-count tests](../src/components/views/features/health/workoutSetCount.test.ts) and [preset tests](../src/components/views/features/health/routinePresets.test.ts) protect formulas, not freshness.

## 17. Range/comparison/B1 and other dependencies

`RANGE_INVALIDATION_ALWAYS_INVALIDATES_PREVDATA = CONDITIONAL` as the selected product policy, not current runtime wiring. Relevant legacy mutation or unknown legacy impact revokes affected previous proof; a proven canonical-only change or range-only projection/bounds change does not. Range-window coverage cannot prove the all-prior query unchanged.

`COMPARISON_PUBLICATION_REVISION_QUALIFIES_PREVDATA = NO`. A newer or complete comparison is insufficient; an incomplete comparison does not automatically make independently fresh legacy history stale. Each source's success, query coverage and eligibility must be established separately.

`B1_REFRESH_INVALIDATES_PREVDATA = CONDITIONAL`. A refresh of the selected-day record is not logically a query of all history strictly before that day. Under selected D, a Health parent-currentness/manual recovery gesture includes a bounded compatibility refresh; a truly narrower B1-only source-refresh event may preserve proven unaffected legacy proof. Public copy/coverage must make that distinction explicit before implementation. The same distinction applies to a manual range/comparison retry versus a programmatic unrelated child reload. Current B1 retry/range fanout does not automatically implement either previous-cache action; no blanket runtime rule is authorized by this publication.

`HOME_DEPENDENCY = NONE_FOR_THIS_DECISION`; `SEARCH_DEPENDENCY = NONE_FOR_THIS_DECISION`. Their shared/read-range lifecycles do not own Health's compatibility cache, authorize its public currentness, or receive behavior changes here. No Home/Search gate or public routing activation follows.

`REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION`; `REL05G5A_001_PRESERVED = YES`. Freshness cannot repair malformed established identity; canonical unavailability is not removed by this decision or hidden through empty copy.

## 18. Product-owner choices and explicit human approval record

`PREVDATA_FRESHNESS_PD01 = D_HYBRID_STATE_DEPENDENT`: selected public-currentness product policy for legacy `prevData`.

| Exclusive owner choice | Current selection | Product commitment / ceiling |
| --- | --- | --- |
| A_BOUNDED_REFRESH | `NOT_SELECTED` | Bounded legacy refresh with scope fencing and truthful failure handling; no blanket child-revision freshness claim. |
| B_REVISION_FENCE | `NOT_SELECTED` | Private retained values with independent qualification; not permission to stamp a range revision on old values. |
| C_WITHHOLD_WHEN_UNPROVEN | `NOT_SELECTED` | Explicit degradation while proof is absent; not false absence or editor/draft erasure. |
| D_HYBRID_STATE_DEPENDENT | `PRODUCT_OWNER_APPROVED` | Section 10's relevant/uncertain-trigger refresh, independent publication fences, failure withholding, preservation of independently proven disjoint evidence and sections 11-14 consumer treatment. Implementation/acceptance remain separate. |
| HOLD_NO_POLICY_SELECTION_YET | `NOT_SELECTED` | Deferral alternative, not the current decision; would not authorize implementation or activation. |

### Approval provenance and pre-approval qualification

- Approval date: `2026-10-12` (UTC+09:00).
- Exact human product-owner instruction supplied in this chat for this publication task: `PREVDATA_FRESHNESS_PD01 = D_HYBRID_STATE_DEPENDENT`.
- `PRODUCT_OWNER_DECISION = D_HYBRID_STATE_DEPENDENT`; `PRODUCT_OWNER_DECISION_STATUS = PRODUCT_OWNER_APPROVED`; `HUMAN_APPROVAL_PROVENANCE = EXPLICIT_HUMAN_PRODUCT_OWNER_INSTRUCTION`.
- `SELECTED_PREVDATA_FRESHNESS_POLICY = D_HYBRID_STATE_DEPENDENT`; `NEW_PRODUCT_DECISION_MADE = YES`.
- Pre-approval reviewed head: `5a49c95d148ce3be5aa2e24f92380a41c8c52b7d`. The independently reported review in this conversation was `REVIEW_PASS`, P0/P1/P2/P3 `0/0/0/0`, `FINDINGS = NONE`; `PRE_APPROVAL_REVIEW = PASS`.
- All requested pre-approval problem/source/scope/query-vs-publication/mutation/trigger/reuse, range/comparison/B1, A-D/hybrid, planning/PR/cue/no-match/coverage, race/epoch/mount/eligibility, local-first/performance/formula/source-owner, Home/Search/provenance/REL05G5A-001/authority, choice/calibration/no-self-approval checks were PASS. This qualifies that prior head, **not this approval-publication delta**.
- Pre-approval exact-head CI `38154680453` at that same head: test, typecheck, build, backend-rel05g1 and backend-recovery completed/success; `PRE_APPROVAL_CI = PASS`. CI is regression evidence, not approval or freshness acceptance.
- Historical pre-approval values were `PRODUCT_OWNER_DECISION_STATUS = REQUIRES_EXPLICIT_APPROVAL`, `PREVDATA_FRESHNESS_PD01 = NOT_SELECTED`, and `PUBLIC_READER_CURRENTNESS_PREREQUISITE = OPEN`; these are no longer the current values.

Only D is selected by the explicit human instruction, not by recommendation, review PASS, CI, publication, PR body, silence or eventual merge. Approval means the policy shape in section 10 and sub-policies in sections 11-14 are selected: relevant/unknown impact immediately fences unqualified publication; superseded completions are rejected; required fresh evidence comes from bounded verified legacy refresh; independently proven unrelated evidence may remain; failed qualification withholds with truthful status. Range/comparison revision, canonical success, value equality, or matching account/date after ABA never manufacture previous-cache freshness. Valid same-scope drafts remain intact; unqualified history never seeds new defaults; unqualified PR and previous cues are hidden/replaced with status; stale/unavailable/no-match/verified-empty remain distinct. No canonical auto-planning or legacy PR arithmetic change, and no failed refresh is turned into absence.

`QUERY_IDENTITY != PUBLICATION_CURRENTNESS_PROOF`. The reviewed conceptual tuple in section 6 is unchanged. Request/invalidation/mutation-coverage epochs remain future concepts, not current runtime capabilities. Selecting D is not reader activation, identity recovery, provenance research or closure of any writer blocker. Variations, including dated stale cue display, require a separate explicit decision/review rather than an inferred exception.

### Implementation, acceptance and publication ceiling

| Field | Current state |
| --- | --- |
| FRESHNESS_POLICY_IMPLEMENTATION / PRODUCTION_IMPLEMENTATION | `NOT_AUTHORIZED / NOT_AUTHORIZED` |
| FRESHNESS_POLICY_IMPLEMENTED | `NO` |
| NEW_EPOCHS_OR_COUNTERS / NEW_CACHE_KEY / NEW_HOOKS / NEW_TESTS | `NOT_IMPLEMENTED / NOT_IMPLEMENTED / NOT_IMPLEMENTED / NOT_IMPLEMENTED` |
| READER_ACTIVATION / PUBLIC_READER_ACTIVATION / HEALTH_PARENT_PUBLIC_READER_ACTIVATION | `NOT_AUTHORIZED / NOT_AUTHORIZED / NOT_AUTHORIZED` |
| PREVDATA-C01 through PREVDATA-C15 | `REQUIRED / NOT EXECUTED` |
| PERFORMANCE_ACCEPTANCE / PUBLIC_COPY_ACCEPTANCE / PHYSICAL_BROWSER_QA | `NOT_EXECUTED / NOT_EXECUTED / NOT_EXECUTED` |
| PUBLIC_READER_CURRENTNESS_PREREQUISITE | `POLICY_SELECTED_IMPLEMENTATION_AND_ACCEPTANCE_PENDING`, not CLOSED |
| APPROVAL_DELTA_INDEPENDENT_REVIEW | `NOT_YET_PERFORMED` |
| FINAL_MERGE_GATE / READY / MERGE / AUTO_MERGE | `NOT_PERFORMED / NOT_PERFORMED / NOT_PERFORMED / NOT_PERFORMED` |
| IMPLEMENTATION / ACTIVATION | `NOT_AUTHORIZED / NOT_AUTHORIZED` |

All future race/ABA, mutation, partial/isolation, no-reseed, formula, offline/focus and truthful public-state assertions remain required. Product approval is not acceptance evidence or proof that refresh cost is acceptable. No thresholds are invented. After approval-delta independent review and canonical review/merge, implementation still requires a separate authorized task.

## 19. One recommendation

`RECOMMENDED_PREVDATA_FRESHNESS_POLICY = D_HYBRID_STATE_DEPENDENT`.

`RECOMMENDATION_CONFIDENCE = MEDIUM`.

D provides acquisition after relevant changes, fail-closed ordering during transitions and honest fallback after failure, while avoiding unrelated global reloads. It preserves local-first availability, existing drafts/explicit counts, unchanged legacy arithmetic and source-separated partial evidence. A alone over-refreshes if tied blindly to all child invalidations; B alone cannot acquire new proof; C alone can indefinitely degrade guidance. D's targeted coverage and consumer distinctions address those costs without fabricating a shared source revision.

Confidence remains medium because actual mutation-observation coverage, all historical seeding paths, copy/gesture scope, read coalescing and physical performance need separate implementation evidence and owner-approved acceptance thresholds. Recommendation confidence does not supply approval; section 18 records the independent human policy selection, not implemented epochs or accepted performance. Next action after new exact-head CI: `INDEPENDENT_REVIEW_REL_05G_HEALTH_PARENT_PREVDATA_FRESHNESS_D_APPROVAL_DELTA_01`, not direct Final Merge Gate or implementation.

## 20. Frozen authority and publication validation

The [approved prospective-provenance HOLD record](REL-05G-health-id-prospective-provenance-capability-product-architecture-decision.md) remains closed/canonical from PR #768. This task does not reopen it or treat currentness as identity recovery.

| Frozen field | Unchanged value |
| --- | --- |
| PROSPECTIVE_PROVENANCE_PD01 | `HOLD_NO_CAPABILITY_SELECTION_YET` |
| A_NO_NEW_PROVENANCE_CAPABILITY | `NOT_SELECTED` |
| B_TRUSTED_LOCAL_PROVENANCE | `NOT_SELECTED` |
| C_REMOTE_PROVENANCE | `NOT_SELECTED` |
| D_HYBRID_PROVENANCE | `NOT_SELECTED` |
| E_PRIVILEGED_PLATFORM_PROVENANCE | `NOT_SELECTED` |
| SELECTED_CAPABILITY | `NONE` |
| ROOT_FEASIBILITY_RESEARCH_AUTHORIZATION / PROVENANCE_COLLECTION | `NOT_AUTHORIZED / NOT_AUTHORIZED` |
| PROVENANCE_HOLD_PRESERVED | `YES`; no B/C/D/E research, archive inspection, issuer design or collection |
| WRITER_CONTINUITY_STATUS | `NOT_YET_PROVEN` |
| E3_FEASIBILITY / LIFECYCLE_EVIDENCE_SOURCE | `NOT_ESTABLISHED / REMAINS_UNAVAILABLE` |
| EXACT_TARGET_CONTROL_PROTOCOL | `NOT_IMPLEMENTED` |
| SEVEN_LIVE_WRITER_BLOCKERS | `OPEN`: unbound pre-reset create; rollback visibility; old/new coexistence; mounted UI identity; canonical field ownership; analytics projection/public claims; reset-fenced local-edit policy |
| HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED | `false` |
| HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED | `false` |
| HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED | `false` |
| HOME_WORKOUT_COMPOSITE_READER_ENABLED | `false` |
| SEARCH_WORKOUT_COMPOSITE_READER_ENABLED | `false` |
| PUBLIC_READER_ACTIVATION / HEALTH_PARENT_PUBLIC_READER_ACTIVATION | `NOT_AUTHORIZED / NOT_AUTHORIZED` |
| ASSISTED_RECOVERY_RUNTIME_AVAILABILITY | `NOT_AVAILABLE` |
| TRACK_A | `TRACK_PARTIAL / PATH_A_QUALIFICATION_PARTIAL` |
| TRACKS_B_C_D | `NOT_EXECUTED` |
| BOOTSTRAP_ADMISSION | `BLOCKED_BY_EVIDENCE_QUALIFICATION` |
| R2-U | `NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF` |
| PHYSICAL_QUALIFICATION_STATE | `DEFERRED_UNCHANGED` |
| NO_NEW_PR_FORMULA | `YES` |
| NO_NEW_PLANNING_FORMULA | `YES` |
| NO_CANONICAL_AUTO_PLANNING | `YES` |
| NO_COMPARISON_FILTER_SUBSTITUTION_IN_LEGACY_PR | `YES` |
| NO_HISTORY_SEMANTIC_REWRITE | `YES` |
| LOCAL_DATABASE_VERSION / LOCAL_SCHEMA_VERSION | `7 / 1`, verified in [local database types](../src/lib/localDatabase/types.ts) |
| WorkoutSessionV1; stores/indexes/keyPaths; Supabase/RLS/backend | Unchanged; no API, database, schema or remote work |
| AUTHORITY_STATE | `UNCHANGED`; no canonical writer, bind/push/pull/resync/reset activation or G6 |

Approval-publication scope is exactly this Markdown artifact and synchronization of existing Draft PR #769's body. Validate relative links and `git diff --check`, inspect the one-file approval delta, commit/push normally to the same branch, and keep Draft. No production/test/config/gate changes; no local full suite required solely for this document. New exact-head hosted CI is required regression evidence, not acceptance. The pre-approval review applies only to the recorded prior head; approval-delta independent review is NOT_YET_PERFORMED and Final Merge Gate is NOT_PERFORMED. Only the explicit human product-policy approval in section 18 is recorded. Do not create another PR, mark Ready, merge, enable auto-merge or implement. Stop after publication, PR-body synchronization and new exact-head CI qualification/report.
