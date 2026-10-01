# REL-05G5B2B2C — Home composite Workout truth characterization

Workstream: `REL_05G5B2B2C_HOME_COMPOSITE_TRUTH_CHARACTERIZATION`.

Decision: **HOME_COMPOSITE_TRUTH_IMPLEMENTATION_READY**, for one default-OFF, read-only preview implementation proposed below. This document does not implement it or approve public activation. PR #736's `REL_05G5B2B2B_PREVIOUS_CALENDAR_COMPOSITE_INTEGRATION` is **CLOSED_IN_MAIN**.

## 1. Verified post-merge baseline

- Repository/workspace: `Absinthe-6785/Absinthe`, `C:\Users\이도현\GitRepos\Absinthe`; origin is `https://github.com/Absinthe-6785/Absinthe.git`.
- [PR #736](https://github.com/Absinthe-6785/Absinthe/pull/736) is MERGED, at `2026-10-01T01:41:58Z`. Reviewed implementation head: `00ed42ca0edccfee63283cf36f40bff5ca24780b`.
- Merge commit, authoritative remote main, fetched `origin/main`, and local main all matched **`10699c49b254551b598da699c85047e80f8d76d7`** before analysis.
- Tracked/index diffs were clean. `git fetch --prune origin`, `git switch main`, and `git merge --ff-only origin/main` completed. `git branch -d codex/rel05g5b2b2b-previous-calendar-composite-integration` succeeded only after Git confirmed the branch was merged. Fetch pruned an already-deleted remote-tracking ref; this task did not delete a remote branch.
- `backend/.pytest_cache` access warning: **CACHE_WARNING_NON_BLOCKING**. Read-only inspection confirmed its own `.gitignore` contains `*`; `git check-ignore -v backend/.pytest_cache/README.md` confirmed that rule; `git ls-files backend/.pytest_cache` returned nothing. No cache was changed.
- Document branch: `codex/rel05g5b2b2c-home-composite-truth-characterization`. No reset, clean, stash, force operation, unrelated cleanup, product edit, or data mutation is part of this task.

Both shipped reader constants are still `false`; the canonical product writer and remote Workout bind/push/pull/resync/reset remain inactive, and G6 remains inactive. `LOCAL_DATABASE_VERSION=7`, `LOCAL_SCHEMA_VERSION=1`; stores/indexes/keyPaths and `WorkoutSessionV1` are frozen. The existence of merged Health composite paths is not public reader activation.

## 2. Evidence index on this exact main

All source links are pinned to the baseline above, not moving `main`. Line anchors and named functions were checked against that checkout. Proposed files/APIs in later sections do not exist yet.

| Ref | Exact source and fact |
| --- | --- |
| E1 | [AppContent: daily and composite ownership](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/AppContent.tsx#L270-L344): `dateStr` follows `selectedDate`; B1 and range enable only in Health; one B1 invocation; account-tagged durable fanout. |
| E2 | [AppContent: lifecycle and view props](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/AppContent.tsx#L368-L399), [rendering](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/AppContent.tsx#L428-L513): Home receives `globalProps`, Health alone gets separate composite props. |
| E3 | [useDailyData](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/hooks/useDaily.ts#L142-L153), [return contract](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/hooks/useDaily.ts#L216-L229): legacy account/date key, readiness gate, default `[]`, no Home workout error/status. |
| E4 | [Legacy daily projection](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/lib/healthLocalRuntime.ts#L125-L165): one verified `readAll`, date filter, legacy rows converted to `Workout[]`. [Verified authority](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/lib/healthLocalRepository.ts#L612-L629) validates import state/datasets/counts. |
| E5 | [Home inputs/projection](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/HomeView.tsx#L110-L201), [Workout card/navigation](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/HomeView.tsx#L356-L394): today's heading/draft key, passed legacy workouts, global loading, active/saved badge or whole-day empty. |
| E6 | [Home summary](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/home/buildHomeFoundationProjection.ts#L17-L27), [draft precedence](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/home/buildHomeFoundationProjection.ts#L80-L94), [model](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/home/homeFoundationModels.ts#L16-L23): length-based booleans and unqualified counts. |
| E7 | [Draft storage reader](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/lib/healthBackfillUiSafety.ts#L9-L30), [Health draft owner](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/useHealthWorkoutDraft.ts): account/date localStorage array, dirty hydration guard, explicit save/discard cleanup. |
| E8 | [B1 hook](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/useHealthSelectedDayComposite.ts): paired sources, request/mount/date fences, `managedLifecycle`, current device/generation checks, read-only result. |
| E9 | [Paired legacy loader](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/selectedDayLegacySnapshot.ts#L14-L62): editor/daily and persisted source rows from the same verified snapshot. |
| E10 | [Canonical selected-day reader](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/lib/workoutSelectedDayReader.ts#L35-L113), [repository query](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/lib/workoutSessionRepository.ts#L145-L156): private scoped handle, active validated entities; selected-day query scans the domain then filters. |
| E11 | [Composite projection](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/compositeWorkoutReadProjection.ts): source-qualified identities, complete/partial/error, mismatch fails closed, technical order only. |
| E12 | [Range hook](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts), [snapshot coordinator](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts): Health-only paired range owner, two public derived views, listener-free, verified derivation required. |
| E13 | [Parent gate](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/healthSelectedDayCompositeConfig.ts), [range child](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts): both false. [DB/schema](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/lib/localDatabase/types.ts#L1-L3): 7/1. |
| E14 | [Home tests](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/home/buildHomeFoundationProjection.test.ts), [Home/Planner isolation tests](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/plannerAccountIsolation.integration.test.ts): two foundation tests, one for legacy saved summary; Planner harness mocks the Home projection. Neither proves canonical Home truth. |
| E15 | [Health composite panel](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/HealthSelectedDayCompositePanel.tsx), [mounted save/delete races](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/healthWorkoutFullMountedRace.integration.test.ts): canonical cards remain separate; current Health commit fencing has real mounted coverage. |
| E16 | [Frozen V1 validation](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/lib/workoutSessionV1.ts#L298-L319), [empty-structure tests](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/lib/workoutSessionV1.test.ts#L52-L58), [invalid canonical projection test](https://github.com/Absinthe-6785/Absinthe/blob/10699c49b254551b598da699c85047e80f8d76d7/frontend/src/components/views/features/health/compositeWorkoutReadProjection.test.ts#L203-L210): empty session entries or empty entry sets are invalid; invalid canonical evidence follows the existing whole-source error contract. |

Merged design inputs were read in full: [G5B cutover](REL-05G5B-product-cutover-prep.md), [G5B2 composite](REL-05G5B2-composite-reader-prep.md), [G5B2B first integration](REL-05G5B2B-product-reader-integration-prep.md), [G5B2B2 expansion](REL-05G5B2B2-product-reader-expansion-prep.md), and [G5B2B2B consumer integration](REL-05G5B2B2B-consumer-integration-prep.md). Their earlier baseline maps are historical; E1–E16 establish current behavior. They consistently require a later Home presence/draft distinction, no canonical-to-`Workout[]` conversion, visible partial coverage, and separate public-copy approval.

## 3. Current source graph and contradictions

```text
AppContent.selectedDate -> formatDate -> dateStr
  -> useDailyData(dateStr, account, legacyDailyActive)
  -> ['local-health-daily', account, dateStr]
  -> readLocalHealthDaily -> verified HealthRepository.readAll
  -> projectLocalHealthDaily(dateStr) -> legacy Workout[]
  -> globalProps.workouts -> HomeView
HomeView.now -> today's local date key
  -> buildHomeFoundationProjection(workouts, account, todayKey)
  -> readLocalHealthWorkoutDraft(healthDraft:account:todayKey)
  -> active = nonempty draft ?? passed legacy workouts
  -> length/count summary -> loading OR Active/Saved OR whole-day empty

Separate, currently default-OFF Health preview:
AppContent -> useHealthSelectedDayComposite(account, dateStr)
  -> paired verified legacy snapshot + WorkoutSelectedDayReader.read(dateStr)
  -> source-qualified complete/partial/error -> HealthView canonical cards
AppContent -> Health-only range hook -> Previous + calendar
Neither composite result is passed to Home.
```

**Canonical-only false empty is reachable by construction.** For an account/day with a valid active canonical session, no legacy rows and no nonempty legacy draft, E3/E4 return `workouts=[]`. E6 returns `{hasSession:false,isDraft:false,isLocked:false,exerciseCount:0,setCount:0,doneCount:0}`. Once legacy loading settles, E5 chooses `homeWorkoutEmpty`, whose English value is “No workout logged today” (`frontend/src/lib/i18n/en.ts:48`, aligned with `keys.ts:48`). In a B1-enabled QA build, navigating to the same date in Health lets E8–E11 publish the canonical session and E15 render it. Two or more canonical sessions produce the same Home false empty. These are source-derived reachable outcomes, not claims that the shipped OFF gates or dormant writer currently produce canonical data for every user.

**Selected date is not necessarily today.** `AppContent.tsx:156,271,301,434,472` carries the Health/Planner selected date into Home's workouts. Home uses `now` for the heading and draft key (`HomeView.tsx:127,197,295`), and does not refilter the passed workouts. Selecting a historical date then returning Home can label that date's legacy records as today's saved workout, or show today empty despite today's legacy records. Today's draft can also mask another date's saved data. All three Workout-related Home actions only call `switchToTab('health')` (`HomeView.tsx:374,389,446`); `noteNavigation.ts:113` delegates tab switching and does not set the date. “Open today's workout” can therefore open a historical Health day.

**Unavailable is not verified empty.** Home receives no legacy workout error or canonical source status. Readiness-disabled/no-data legacy SWR gives `[]`; settled failure without cached data does too. A previous cached legacy value may remain and be labelled saved without an availability warning. During bootstrap pending/failure, `legacyDailyActive` can be false while Home still mounts. E3's loading bit is not a bootstrap/composite coverage state. Canonical read failure/device/generation problems are never consulted by Home at all.

## 4. Legacy-specific assumptions and present truth matrix

`Workout` is an exercise row with `block_id`, mutable/current catalog display and a `sets` array (`types/index.ts:94`), not a durable session. E6 counts rows except `__session__`, sums array lengths and truthy `done`; duplicate exercises count repeatedly. A separator-only nonempty array still makes `hasSession=true` with zero counted exercises/sets. `setCount` and `isLocked` are computed but Home renders neither; it renders exercise and done counts plus one Active/Saved badge. `isLocked` is a Home summary property, not authority to lock the Health canonical editor.

Draft precedence is wholesale replacement: a nonempty account/today draft supplies all counts and the active badge, hiding every persisted legacy count. It does not prove persistence, canonical identity or current dirty state beyond the stored array. Empty array means no draft. E7 accepts any parsed array without structural Workout validation; invalid JSON removes that storage key, non-array JSON returns null, and storage access exceptions can escape. Home has no draft change subscription; it rereads on projection recomputation/remount, including ordinary `now`-driven recomputations, rather than receiving a durable commit or canonical-generation signal. Health alone owns draft editing, persistence and cleanup.

Matrix assumptions: selected date equals today, valid draft/rows, initial loading has settled, no retained failed-source SWR value. `L` = legacy persisted rows; `C` = active canonical sessions; `D` = nonempty legacy draft. Counts `l/d` describe that array alone. Variations on retained cache/readiness/date are described above, not hidden by this table.

| Current state | Actual Home summary/render | Truth gap |
| --- | --- | --- |
| No persisted workout, no D | false / empty; 0 counts | Correct only if both stores actually have no active record; Home cannot verify that. |
| L only | true / Saved; l counts; locked summary | Legacy saved evidence only; not a proven human-session count. |
| C only | false / empty | Canonical active record omitted. |
| L + C | true / Saved; l counts | Canonical records/counts invisible. |
| Multiple C today, no L | false / empty | Every canonical session omitted. |
| D only | true / Active; d counts; unlocked summary | Unsaved legacy draft, not saved session. |
| D + L | true / Active; d counts | Persisted L hidden by draft precedence. |
| D + C | true / Active; d counts | Persisted C invisible; only draft acknowledged. |
| D + L + C | true / Active; d counts | Both persisted branches hidden/omitted. |
| Legacy unavailable, canonical succeeds | empty without D; Active with D | No partial/retry state; valid C can be hidden. |
| Canonical unavailable, legacy succeeds | Saved L or empty; Active if D | Identical to canonical success from Home's perspective; no incomplete coverage. |
| Both sources unavailable | empty without D; Active with D | No error/unknown persisted state. |
| Account isolation failure | Legacy authority rejects foreign data; Home can receive default empty/stale scoped cache | Account keys/remount help isolation, but rejection is not surfaced as Home coverage. |
| Canonical namespace/generation/device isolation failure | No effect on current Home computation | No canonical bytes are read/leaked through this path; also no valid all-source empty conclusion. |

Existing Home foundation tests cover resume-workspace and legacy saved summary only (E14). The Planner/Home harness verifies account-bound remote Planner/Recipe paths with a mocked foundation projection, so it is not evidence for draft + canonical completeness, Home canonical isolation or reader budgets.

## 5. Selected ownership boundary and alternatives

| Option | Source-grounded assessment | Decision |
| --- | --- | --- |
| A. Share AppContent's one B1 selected-day lifecycle across active Home/Health | One invocation already belongs to account-owned shell state, supports exact date, paired snapshots, scope fences, current read retry and managed listeners. Tabs are mutually exclusive. Home needs one date, not a range. | **Select ownership A.** Broaden invocation eligibility/date selection under a new Home child gate; preserve Health render eligibility separately. |
| B. Pure Home projection from already-owned composite evidence | B1's returned typed result can drive this without I/O. The existing range hook cannot currently supply Home: it is Health-only, Previous excludes today, browsed month can exclude today, and raw coordinator snapshot is private and cannot bypass `deriveRange` verification. | **Use pure projection B over A's B1 result.** Extending range scope/public views/lifetime is unnecessary here. |
| C. Separate Home reader/hook/opener | No source fact requires independent concurrent dates: only one tab renders. Would duplicate opener, canonical scan and event/fencing ownership, or recreate a shared cache. | Reject for this slice. Revisit only with a new concurrency requirement and measurements. |

Proposed effective Home eligibility: parent `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED` AND new static `HOME_WORKOUT_COMPOSITE_READER_ENABLED=false` AND active Home AND authenticated account. Range child remains independently Health-only. Parent OFF/Home child ON fails closed with zero Home composite I/O/listeners. All constants remain OFF in the implementation; no remote flag/localStorage override/G5A readiness dependency.

AppContent calls `useHealthSelectedDayComposite` **once** with `enabled = healthB1Enabled || homeCompositeEnabled`. The requested date is `formatDate(now)` in Home and existing `dateStr` in Health. Keep `healthB1Enabled` separate from shared-reader enabled: broadening the latter must not accidentally render Health under Home, disable Search's legacy source, or change Health bootstrap/editor/static eligibility. Home receives a dedicated typed read prop and a today-navigation callback through a Home-specific props intersection, not composite records inside `ViewProps.workouts`. Pure Home projection consumes that returned evidence plus separately read account/today draft status. No DB handle/coordinator/currentSnapshot is exposed to Home.

Keep B1's default lifecycle in Home and parent-only Health; in range-enabled Health use existing `managedLifecycle` and AppContent fanout. This preserves existing ownership without a new global listener. Home-to-Health transition on the same date/enable/account can reuse the B1 pair; changing date triggers one fresh pair. The range hook still closes outside Health. No cross-tab background owner or multi-date cache is introduced.

## 6. Future truth contract: persisted evidence and draft are separate

Use an additive discriminated Home model, retaining the legacy OFF model unchanged. The composite branch must not call the old `buildWorkoutSummary` and then override its output, because that would still invoke E7's storage cleanup and length assumptions. A pure `buildHomeWorkoutCompositeProjection` supplies the composite branch to the foundation/rendering; its inputs carry the current account/today/read lifetime and source status.

The old `hasSession` continues to mean nonempty active **legacy array** on the OFF path. Do not reuse it as a complete-source boolean. The new model uses `persistedPresence: present | absent | unknown` plus independent `draft: absent | present | unavailable`. If a compatibility `hasSession` is exposed, true means observed workout evidence (valid draft or persisted record); false must never select empty without checking completeness. Neither field is a human-session count or editor lock.

Canonical evidence may establish persisted presence only after passing the existing frozen `validateWorkoutSessionV1` and composite source validation (E10/E11/E16). A session with `entries=[]`, or any entry with `sets=[]`, is invalid canonical evidence, not a valid persisted session or a verified empty source. It follows the existing canonical source error/unavailable contract: surviving valid legacy records yield `partial_data` with legacy evidence only and presence `present` from legacy, not from the invalid canonical payload; successful but empty legacy yields partial coverage with presence `unknown`; both sources failing yields error/unknown. Do not introduce a Home-only validation category, bypass the validator, or change V1. In contrast, an otherwise validated session with at least one valid entry and at least one valid set per entry may have **zero completed sets** (no set has `done=true`); it still establishes canonical persisted presence.

| Evidence | Persisted presence | Draft/UI disposition |
| --- | --- | --- |
| Settled complete; no L/C; draft absent | absent | Verified today empty. |
| Complete L only | present | Saved local legacy rows; retain actual row identities. |
| Complete C only | present | Saved locally, read-only validated V1/composite session evidence; preserve every valid session identity, including sessions with zero completed sets. |
| Complete L+C or multiple C | present | Distinct source summaries; all C count/IDs retained; no singleton/chronology/content dedupe. |
| Complete empty + D | absent | Unsaved legacy draft primary; not whole-day empty. |
| D + L, D + C, D + mixed | present | Draft stays primary editable-work status; separate persisted-source summary remains visible. Do not add draft counts to persisted counts. |
| Partial with surviving records | present | Show observed persisted sources plus missing-source warning/retry; D may coexist. |
| Partial with zero survivors | unknown | Coverage unavailable, never verified empty; D may coexist. |
| Both-source error / settled null result | unknown | Error/retry; valid scoped D remains separately labelled unsaved. |
| Loading, superseded date/scope, disabled owner | unknown | No previous-scope persisted content/empty claim. Current scoped draft can be shown independently. |
| True account/namespace/generation isolation error | unknown | No persisted records/counts from either source. A separately validated current-account/today draft may be shown, with isolation error explicit. |
| Malformed/unreadable draft | Based on valid persisted evidence | Draft unavailable; preserve storage bytes, no whole-card empty that claims no draft. |

An existing malformed device ID that prevents canonical opening is canonical **unavailability** and can leave verified legacy evidence partial. A device change during an in-flight read instead supersedes the captured pair; retry in the new device scope before publishing. Neither is permission to repair identity or treat unavailable canonical data as empty. Foreign account/namespace/generation in returned records is the fail-closed isolation case, regardless of any other successful source.

Counts are occurrence counts, not unique exercises or human activity totals. Preserve source-qualified `readId` in the projection; retain canonical session IDs and nested entry/set IDs. Canonical session count counts distinct validated session identities, not date buckets. Legacy row count never becomes a session count. Legacy exercise-row/set/done counts can be computed for that successful source after validating the fields actually counted; canonical entry/set/done counts can be computed directly per validated V1 session. Repeated exercise entries remain repeated occurrences. On partial data, successful-source counts may be shown only explicitly as observed source counts with missing coverage; no unqualified total/zero. Unknown/malformed legacy set completion suppresses that count rather than coercing it to zero or truthy done.

For canonical summaries, zero completed sets means `doneCount=0`, not `setCount=0` or `entryCount=0`. Every validated V1 session has nonempty entries and each entry has nonempty sets; invalid structures contribute no published canonical identity or count.

For the smallest preview, display separate legacy persisted row and canonical persisted session presence/counts, plus the existing draft's own exercise/set/done counts with an unsaved label. Do not expose a mixed exercise/done/session total. Mathematically summing stored occurrences under complete coverage would count representations, not prove unique exercises or distinct real-world workouts; adopting that public metric is a product decision. Source-labelled summaries and a date-level Health link preserve truth without cloning all Health cards into Home. Do not call one canonical session “latest” or select one automatically; Health renders all current-date canonical cards.

“Saved” means verified local persistence in the named source, never remote ACK or sync completion. “Draft” means the separate unsaved legacy buffer, never canonical editor state. Canonical presence sets no legacy lock and cannot trigger save/delete/adoption. When D exists, its primary badge does not hide persisted evidence and does not declare C unsaved. A mixed-source summary requires visible source provenance; one unqualified Saved/exercise badge is insufficient.

Read the draft using the existing exact `healthDraft:{account}:{today}` key, but a bounded Home-only read facade must use `getItem` only, distinguish absent/valid/unavailable, and validate the fields needed for summary. It must not call the shared helper's invalid-JSON `removeItem`, write/migrate/normalize drafts, change Health's draft schema, attach generation/session identity, or clear a draft on composite refresh. Empty arrays are absent; a valid separator-only legacy draft remains an unsaved buffer with zero exercise counts, not a persisted session. Re-read on Home entry, account/today change, and owned refresh/focus/retry; no new draft event bus or IDB scan. Continuously focused out-of-band draft changes without a signal remain a documented preview freshness limit. Public malformed-draft recovery UX remains a later product decision; the preview preserves bytes and reports unavailable.

All Workout-card links and its Workout quick action in the composite Home branch should use one AppContent callback: choose the current semantic today date/month, then navigate to Health. Scope the callback to the current account/Home lifetime. Do not reset Health date merely when entering Home, alter Planner/Search navigation, or invent session-level selection. Gate OFF retains existing navigation. This closes the card's evidenced “today” mismatch within the proposed preview boundary.

## 7. Read/lifecycle budget and isolation requirements

Budget counts source attempts, not individual IDB metadata transactions, and assumes settled normal mount (development StrictMode replays are separately tested). The canonical selected-day query is a whole-domain active scan despite its name (E10); no latency claim is made without dataset measurement.

| Trigger/surface | Composite legacy verified reads | Canonical scans | Lifecycle/effect |
| --- | --- | --- | --- |
| Gates OFF | 0 added | 0 added | Current legacy product path unchanged. |
| Home preview initial pair / explicit retry / coalesced visible resume | 1 | 1 | Single shared B1 owner. Existing legacy `useDailyData` can add one separate legacy read when readiness permits; see below. |
| Ordinary Home render, minute tick within same date, card rendering, draft count derivation | 0 | 0 | Pure projection; no effect dependency on `now` object/render identity. |
| Home midnight/date rollover | 1 | 1 | Exact semantic date changes once; no stale yesterday claim. |
| Home -> Health today, both enabled, same account/date | 0 for shared B1 | 0 for shared B1 | Reuse B1 evidence. If range child ON, one range pair adds 1+1 on entering Health. |
| Home <-> Health with different requested dates | 1 per date change | 1 per date change | One owner changes scope; not two simultaneous selected-day readers. Health range costs remain separate. |
| Leave Home/Health to unrelated tab, then return | 1 on new enabled lifetime | 1 | Close/fence old owner; no background scans or old settled-result flash. |
| A -> B -> A with each lifetime settling | 3 total | 3 total | One pair per lifetime; original A promises cannot publish into new A. Superseded physical reads may finish but are discarded. |
| Matching account durable legacy Workout commit | 1 new B1 pair | 1 | Fence synchronously before fresh read. If current range Health owner exists, retain existing additional 1+1 range fanout. |
| Nonmatching account commit / no current owner | 0 | 0 | No queued replay or new owner. |
| Bootstrap complete | 1 per handled event | 1 | Refresh current owner's namespaces only; event carries no Workout payload/account proof. |

Home preview retains `useDailyData` for unrelated shell/legacy consumers; its legacy daily read is **not** composite persistence evidence. Thus a normal ready Home can cost **2 legacy reads + 1 canonical scan overall**, of which one pair is the new B1-owned Home truth. Existing static/Planner/Archive reads are outside this budget. Search remains selected-date legacy only; do not replace its cache or change `useDailyData` merely to optimize the extra legacy read. Reusing the paired daily result for other consumers is later consolidation, not required for correct Home truth. Home never adds a second canonical scan, and Home rerenders add none. Health range+B1 keeps its reviewed 2+2 preview budget. No per-card/date/click canonical query, extra index, persistent multi-date Map or unbounded key growth is proposed.

Listeners: Home/parent-only Health B1 owns one bootstrap, one focus, one visibility listener with 250 ms visible focus/visibility coalescing. AppContent's existing legacy daily/static bootstrap listener remains (so **two total bootstrap handlers**, only one for composite in this mode). Range-enabled Health uses AppContent's single composite focus/visibility fanout and existing bootstrap handler; B1's three listeners are suppressed. No HomeView/projection/listener duplication. Managed-mode changes on tab transition alone must not reload B1. Cleanup removes listeners and closes handles on disable/account/unmount. Bootstrap itself is network recovery already present; no new listener for G5A or remote data plane.

Required bounded lifecycle refinements in the future touched B1 hook:

1. Retain exact account/date, reader namespace/generation/device, request sequence and mount/enable epoch fencing. Re-entry with the same account/date after a disabled interval must return loading before any old settled result can render; E8's current visible guard checks only account/date/enabled, so this new consumption contract requires an explicit current enabled-lifetime publication guard. A cacheKey label alone is not authority.
2. `retry` already synchronously increments request sequence; the composite-visible contract must also hide/supersede old settled evidence immediately on refresh before an older promise or render can claim it current. Implement this narrowly in the shared hook with Health regressions, not by adding a Home repository/cache.
3. E8 has a one-reopen stale-generation attempt in `readCanonical`, but final generation/device checks also call `retry()`; do **not** claim all whole-pair retries are bounded today. Add a bounded automatic currentness recovery budget for load/publication failure (one new paired recovery per episode, then settled unavailable/manual retry). Persistent churn/malformed identity must not create an infinite loading/scan loop. Normal load is 1+1; a permitted recovery adds at most one further pair; an in-read canonical stale-generation reopen can additionally repeat that canonical scan. Count these separately in tests, reset the automatic budget only on successful current publication or explicit user/lifecycle retry, and keep the B1 cacheKey P3 untouched.
4. Broaden AppContent's call-time current reader account ref from Health-only to the active shared Home-or-Health B1 owner. Retain stable account-only durable notification and range-first/B1-second synchronous fanout when range exists. Late A1 Health commit while A2 Home is current invalidates A2's current evidence; late A commit while B is current no-ops. Old Health UI completion remains fenced separately. Home adds no writer or notification payload.
5. Recheck active generation and established device before canonical publication; ordinary source unavailable may be partial, true record account/namespace/generation mismatch suppresses all persisted data. A stale generation is discarded/reopened under bounded policy, never used as current. Do not repair malformed device IDs or invent a namespace. Reader opening may establish a missing shared device ID/namespace metadata as already documented; zero canonical entity/outbox mutations still applies.

A readonly scoped draft is account/date storage, not namespace/generation persisted evidence; validate its current scope independently and never use it to prove canonical source success. Do not interpret G5A ready/reset-fenced state as local reader readiness. Windows Edge PWA and iPhone Home Screen each expose their own device's local records; no unsynced cross-device promise. Focus/retry detects out-of-band same-generation changes, not a continuous local-write subscription.

## 8. Product decisions, bounded scope and handoff

**PRODUCT_DECISION_REQUIRED before public activation**, not silently resolved by this preview:

- Public wording/visual priority for “legacy unsaved draft” alongside locally persisted legacy rows/canonical sessions, and source-labelled observed partial counts.
- Whether a future Home public metric should count stored occurrences, unique exercise definitions or real-world workouts; no mixed metric in the proposed slice.
- Public partial/unknown/error and malformed-draft recovery language/accessibility; the preview uses explicit source/unavailable/retry semantics and preserves bytes.
- Public reader rollout/physical offline and size/performance QA, Search claim/navigation policy, legacy-only PR/cue policy, and remaining activation prerequisites.

None requires choosing a canonical session, fabricating chronology, changing V1, or implementing a writer for the bounded Home preview. If a product requirement instead insists on one unified saved/draft badge, one human-session total, or canonical edits, this document does not authorize that change; it would need another design decision. The current proposed source-separated preview is implementation-ready, not public-copy approval.

**Exactly one proposed next implementation:** `REL_05G5B2B2C_HOME_COMPOSITE_TRUTH_INTEGRATION`. Integrate Home today presence, separate draft/persisted source summaries, correct today navigation, and the narrow shared B1 lifecycle refinements atomically under the new default-OFF child. Do not split off a scan-only Home owner PR. Independent design review of this document must precede implementation.

Expected production files (repository-relative; these are future changes):

| File | Exact bounded purpose |
| --- | --- |
| `frontend/src/components/AppContent.tsx` | One shared selected-day invocation, separate Health/Home eligibility and exact today date, dedicated typed Home props/navigation, broaden call-time durable routing without changing writer APIs. |
| `frontend/src/components/views/HomeView.tsx` | Gated composite Workout card and current scoped draft read; independent composite loading/error rather than legacy global spinner; correct Workout navigation; other Home sections unchanged. |
| `frontend/src/components/views/features/home/homeWorkoutCompositeConfig.ts` (new) | `HOME_WORKOUT_COMPOSITE_READER_ENABLED=false`, parent/active/account fail-closed predicate. |
| `frontend/src/components/views/features/home/homeWorkoutCompositeProjection.ts` (new) | Pure source/draft/presence/status summary; all identities retained, no I/O/count fabrications. |
| `frontend/src/components/views/features/home/homeWorkoutDraftRead.ts` (new) | `getItem`-only current account/today draft read/status/summary-field validation; no mutation or format change. |
| `frontend/src/components/views/features/home/homeFoundationModels.ts` | Additive discriminated composite summary, preserve legacy OFF model. |
| `frontend/src/components/views/features/home/buildHomeFoundationProjection.ts` | Accept precomputed composite branch, bypass old draft summary there; keep other sections and OFF behavior. |
| `frontend/src/components/views/features/health/useHealthSelectedDayComposite.ts` | Narrow visible enable/request-lifetime guard and bounded currentness recovery; existing source pairing/capability/cacheKey unchanged. |
| `frontend/src/lib/i18n/{keys,en,ko,ja}.ts` | Explicit source/draft/unavailable/local-only preview vocabulary, consistently aligned. |

Expected test files:

- New `frontend/src/components/views/features/home/homeWorkoutCompositeConfig.test.ts`, `homeWorkoutCompositeProjection.test.ts`, `homeWorkoutDraftRead.test.ts`.
- New `frontend/src/components/views/HomeView.workoutComposite.test.ts` (real card rendering; unavailable/partial/loading/source copy/actions) and `frontend/src/components/AppContent.homeWorkoutComposite.integration.test.ts` (real Home + shared B1 lifecycle, controlled lower repository sources, budgets/races/navigation).
- Update `frontend/src/components/views/features/home/buildHomeFoundationProjection.test.ts`, `frontend/src/components/views/features/health/useHealthSelectedDayComposite.test.ts`, `frontend/src/components/healthWorkoutFullMountedRace.integration.test.ts` for Health-origin late save AND delete routed into Home; update `frontend/src/lib/i18n.test.ts` when key fixtures change.
- Run unchanged `AppContent.selectedDayComposite.integration.test.ts`, `healthWorkoutRangeConsumerIntegration.test.ts`, `useHealthWorkoutRangeSnapshot.test.ts`, selected-day loader/reader/projection tests, Home/Planner account isolation, gate-OFF shell/startup/composition regressions. No mocked Home foundation result may stand in for real composite rendering in the new integration test.

No expected change to `useDaily.ts`, `healthBackfillUiSafety.ts`, `HealthView.tsx`, persistence helpers, `types/index.ts` shared Workout arrays, `WorkoutSessionRepository`, range reader/coordinator, composite source projection, authority controller, backend, DB schema, V1, Search, PR/cues, metrics/analytics, Archive/export, writer or data plane. Dedicated Home props avoid expanding shared `ViewProps`; any actual implementation need outside the listed scope must be reported with source evidence.

All seven live-writer blockers remain **OPEN**: unbound pre-reset create; rollback visibility; old/new writer coexistence; product UI identity integration; canonical field/product ownership; projection integration; reset-fenced local edit policy. Reader evidence helps parts of identity/projection work but closes none of the product-wide writer gates. `REL05G5A-001` remains **ACTIVATION_PREREQUISITE**; B1 cacheKey P3 remains **OPEN_NON_BLOCKING**. The real Health save/delete race coverage from #736 remains closed and is extended, not replaced.

Search is a separate later characterization. Its canonical coverage/claim policy is still a public activation dependency. This slice neither designs Search result identity/navigation nor injects canonical records into its legacy `Workout[]`. No Search/PR/metrics/Archive/export change is needed to make the bounded OFF Home preview coherent, and that bounded preview does not establish global/public convergence.

## 9. Acceptance and validation

The future implementation must prove all of these, independently of this docs-only task:

| ID | Required proof |
| --- | --- |
| HOME-C01 | Gate OFF preserves Home summary/navigation/other sections and zero added canonical I/O. Parent OFF/Home child ON fails closed. |
| HOME-C02 | Current today is used regardless of historical selectedDate/month; midnight rollover cannot publish yesterday as today. |
| HOME-C03 | Verified both-empty and no draft is the only whole-day empty; initial loading/disabled bootstrap do not fabricate it. |
| HOME-C04 | Legacy-only, validated canonical-only, mixed and multiple C have truthful persisted presence. An otherwise validated canonical session with nonempty entries and nonempty sets per entry but zero completed sets remains persisted present. `entries=[]` or any entry with `sets=[]` is invalid canonical source evidence, never published as a persisted canonical record and never establishes presence from that payload; preserve existing V1/composite validation without bypass or contract change. |
| HOME-C05 | D only, D+L, D+C, D+mixed preserve draft bytes and display persisted evidence separately; no count addition/legacy lock from C. |
| HOME-C06 | Each partial direction with records and with zero survivors remains partial/unknown as appropriate; both errors/null result show retry. Test invalid canonical empty-entry and empty-set structures separately: surviving valid legacy evidence yields `partial_data`, canonical source error and legacy records only; successful empty legacy yields partial/unknown, not verified empty. Invalid canonical plus failed legacy yields error/unknown. |
| HOME-C07 | Account/namespace/generation isolation suppresses all persisted records; active-only loader excludes tombstones, no data enters Workout[]. |
| HOME-C08 | Source-qualified identities/multiple same-day sessions/repeated entries remain distinct; no chronology/content/adoption dedupe. |
| HOME-C09 | Counts are validated/source-scoped; zero canonical completed sets does not mean zero sets/entries or absent persistence. Invalid canonical structures contribute no canonical counts. No legacy-row-as-session, unique-exercise or incomplete-total claim. |
| HOME-C10 | Valid/empty/non-array/malformed/unreadable draft cases: no storage mutation, wrong-account/date reuse or parse-to-saved/empty claim. |
| HOME-C11 | Real Home loading/partial/empty/error/canonical/draft card rendering and accessible status/retry, not projection-only mocks. |
| HOME-C12 | One shared B1 invocation, 1+1 normal composite attempt, zero render/card/minute scans, documented existing extra legacy read. |
| HOME-C13 | Same-date Home/Health transition reuses B1; different date/new enabled lifetime rereads; range remains Health-only. |
| HOME-C14 | Exactly the documented listeners/coalescing/cleanup; no Home panel listener; bootstrap/focus/retry use current account only. |
| HOME-C15 | A->B->A, date changes, disable/re-enable, unmount, StrictMode, slow opener/read/verify and retry hide old evidence before paint/publication. |
| HOME-C16 | Generation/device change reloads/fails safely; persistent final-fence churn stops automatically under explicit counters; malformed device is not repaired. |
| HOME-C17 | Real delayed Health save AND delete commit after Home A2 loads: synchronous current-account invalidation, new pair sees commit, old pair/UI cannot overwrite. B current/no-owner cases no-op. |
| HOME-C18 | Workout card and quick action open current today/month in Health, no inferred session choice; gate OFF navigation unchanged. |
| HOME-C19 | Existing B1/range/persistence/account/startup/Search legacy paths regressions pass; cacheKey P3 is not redesigned. |
| HOME-C20 | No canonical writer/entity/outbox mutation or remote data-plane/G6 call; no backend/DB/index/keyPath/V1 or unrelated consumer change. |

This characterization supplies the exact graph, current-state proof/matrix, ownership comparison, bounded handoff and unresolved decision classification. Runtime acceptance above is **not claimed executed or closed** by a document.

Validation for this PR: source links/line anchors against baseline; exactly one docs file; docs diff/scope review; `git diff --check`; normal hosted CI for the resulting document commit (`test`, `typecheck`, `build`, `backend-rel05g1`, `backend-recovery`). No runtime test modification or unrelated local full-suite rerun is necessary solely for this Markdown edit. Actual commit/PR/CI results belong in the correction report, avoiding a circular own-head SHA in this artifact.

Final decision: **HOME_COMPOSITE_TRUTH_IMPLEMENTATION_READY**. Proposed next slice: **REL_05G5B2B2C_HOME_COMPOSITE_TRUTH_INTEGRATION**, after independent design review. Public activation, canonical writers, remote Workout convergence and G6 remain unauthorized. Keep this docs PR Draft; do not mark Ready or merge.
