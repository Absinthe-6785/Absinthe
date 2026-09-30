# REL-05G5B2B2B — Workout consumer-integration preparation

## 1. Authority, hygiene and decision

This is **preparation only**, inspected on `main` baseline `37c00aee96e1c042b5f18642d06a8af69d93a51d`. PR #734 is MERGED (2026-09-30); its reviewed head is `956ab53d3b94bc572f85d45c872d6cff40ac24fc` and its merge commit is the baseline. Both `git ls-remote origin refs/heads/main` and fetched `origin/main` matched exactly. Repository/workspace: `Absinthe-6785/Absinthe`, `C:\Users\이도현\GitRepos\Absinthe` (not `D:\Projects\Absinthe`).

Post-merge hygiene: tracked and index diffs were clean; `git fetch --prune origin`, `git switch main`, and `git merge --ff-only origin/main` completed. Git confirmed the prior foundation branch was fully merged before `git branch -d codex/rel05g5b2b2a-workout-read-snapshot-foundation`. No remote branch was deleted by this task, no forced operation, automatic stash, reset, clean or cache deletion occurred. The `backend/.pytest_cache` access warning is `CACHE_WARNING_NON_BLOCKING`: an escalated read found pytest cache files, none tracked, and `git check-ignore -v backend/.pytest_cache/README.md` proved the cache's own `*` ignore rule. Preparation branch: `codex/rel05g5b2b2b-consumer-integration-prep`.

`REL_05G5B2B2_PRODUCT_READER_EXPANSION_PREP` and `REL_05G5B2B2A_WORKOUT_READ_SNAPSHOT_FOUNDATION` are **CLOSED_IN_MAIN**. Source search found no established `REL-05G5B2B2B` / `REL_05G5B2B2B` identifier before this document. `REL_05G5B2B2B` is therefore the **new proposed reviewed workstream name**, not an older canonical label.

**Exactly one next implementation:** `REL_05G5B2B2B_PREVIOUS_CALENDAR_COMPOSITE_INTEGRATION` (option B). Integrate Previous date buckets and calendar activity atomically under one default-OFF static child preview gate. The dedicated range hook is an internal prerequisite in that one PR, not a separate mounted-only PR. No implementation is authorized by this document.

This choice is source-grounded, not merely inherited from the older rollout: Previous and calendar currently make two independent legacy `readAll()` calls, while the merged coordinator can serve both from one paired snapshot. A canonical-only prior date visible in Previous but unmarked in the same Health calendar would be a conspicuous QA contradiction. The calendar change is a bounded additive truth/status prop, not a broad redesign. Previous-only could be acceptable as an explicitly incomplete, never-public preview, but it leaves that contradiction and duplicates later lifecycle work. Coordinator-only would mount a scan without correcting a consumer. Neither is selected. Home has no hard atomic dependency and remains later work.

### Frozen baseline facts

- `WorkoutRangeReader`, `WorkoutReadSnapshotCoordinator`, `deriveWorkoutRange`, and the pure `workoutLocalReaderAuthority` boundary are present. Non-test runtime references to the range classes/helper are confined to the foundation modules: **ZERO mounted consumers**.
- `healthSelectedDayCompositeConfig.ts` sets `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED = false`: **B1 OFF**, public reader activation **NO**.
- `workoutRangeReader.importBoundary.test.ts` installs spies before each cold import of authority/range reader/range snapshot/selected-day reader and checks zero auth client construction, listeners, fetch, IDB open, storage access/write and UUID allocation. Construction also does no I/O/listeners; explicit local opening may establish the shared missing device ID and namespace metadata.
- Product Workout writer remains `LEGACY_HEALTH_LOCAL`. Canonical writer, bind/push/pull/full-resync/reset product activation and G6 remain **INACTIVE**. The read facade is safe by encapsulation, not a claim that every underlying repository API is intrinsically read-only.
- `LOCAL_DATABASE_VERSION = 7`, `LOCAL_SCHEMA_VERSION = 1`; stores, indexes, key paths and `WorkoutSessionV1` are unchanged. Backend unchanged.

## 2. Exact mounted source graphs on the baseline

References below are repository-relative source files/functions at the baseline; proposed APIs later in this document do not already exist.

### Previous history

`HealthView.tsx` owns `mobileHealthTab`, `isPreviousSheetOpen`, `selectedPreviousDate` and the fetch. Desktop Today/Previous toggle sets the shared tab; the mobile contextual Previous action opens the sheet. `isDesktopPrevious = !isMobile && mobileHealthTab === 'previous'`; `isPreviousContextOpen = isDesktopPrevious || isPreviousSheetOpen` (range block around lines 1164–1213).

`selectedDateKey = formatDate(selectedDate)` → `previousWorkoutRange(selectedDateKey)` → conditional SWR key:

- local: `['local', user.id, startDate, endDate]` → `readLocalPreviousWorkoutRows` → `createLocalHealthRepository(accountId).readAll()` → `projectLocalPreviousWorkoutRows`;
- remote legacy mode: `['remote', user.id, remoteSWRKey(rangeUrl)]` → existing `/api/workouts/range` fetch → `normalizePreviousWorkoutRows`;
- closed context: key `null`, no new Previous fetch. This is SWR-owned history cache, not `prevData` and not the new snapshot foundation.

Rows, reference date and selected date → `buildPreviousWorkoutHistoryProjection` → `listPreviousWorkoutSessions` / `defaultPreviousWorkoutDate` / `resolvePreviousWorkoutSessionByDate` → desktop `PreviousWorkoutView` or mobile `PreviousWorkoutSheet` → the same view. SWR destructures `data = []`, plus `error` and `isLoading`; `previousWorkoutSWRConfig` disables focus revalidation but retains normal stale-on-remount behavior. Retry calls `mutatePreviousWorkout`. Current save/delete handlers explicitly mutate daily/month/static, **not** Previous; close/reopen relies on SWR revalidation (covered by `previousWorkoutSWR.test.ts`).

Current semantics: a UI “session” is **one local date group**, not a durable legacy human-session entity. `listPreviousWorkoutSessions` excludes current/future dates and rows with no sets; groups eligible rows by date, dates descending; row order is `sortOrder`, then `rowId`, then stable original position. Existing historical values are cloned. Local display uses catalog exercise block or historical fallback. There is no persisted session ID or reliable intra-day chronology.

`defaultPreviousWorkoutDate` selects newest available matching weekday, otherwise newest eligible date, otherwise null. A valid explicit selected date overrides it; the HealthView selection effect retains it while present, otherwise selects the automatic date. Account effect clears selection/sheet; `AppContent` mounts `HealthView key={authUser.id}`. Reference-date changes rederive bounds and invalidate an ineligible selection, not an unconditional selection reset. Sheet close/reopen preserves selection; a responsive transition closes a mobile sheet and restores the Workout tab on entering mobile. Sheet owns modal/focus/body-scroll cleanup; view's only controls are date selection and retry. No copy/apply/edit/delete/restore actions exist in Previous itself. The editor's separate summary-copy action is not a Previous action.

### Calendar month

`WorkoutMonthCalendar` month buttons → `setCurrentDate` → HealthView `year/month` → `monthStart/monthEnd` → SWR key `['local-health-workout-range', user.id, monthStart, monthEnd]` (or guarded remote legacy range key) → `readLocalHealthWorkoutRange` → repository `readAll()` → `projectLocalHealthWorkoutRange` → `buildHealthProjection({rangeWorkouts, selectedDateKey, weightUnits})` → `workoutDates: ReadonlySet<string>` → `HealthSupportingPanels` → `WorkoutMonthCalendar` → `buildMonthCellDecorations` / `hasWorkout` dots. Selecting a cell sets selected date and current month, and affects the existing selected-day editor.

HealthView's month SWR destructures `data = []` and `mutate`, **not error/loading**. The calendar's `workoutDates?.has(dateStr) ?? false` cannot distinguish unavailable from known absent. Supporting panels defer their children until `useElementVisible('160px')`; this is a visibility optimization, not a data-completeness boundary. Calendar has no partial warning, unknown-cell state or retry prop. Inbody/protein siblings are unrelated and must remain unchanged. The otherwise broad `buildHealthProjection` also computes legacy row-based monthly counts and distinct-date weekly counts, but only `workoutDates` feeds this mounted calendar; `HealthAnalyticsPanel` is not mounted. Do not repurpose those totals as composite metrics.

### Per-exercise Previous / PR (separate legacy graph)

HealthView `localWorkouts` / selected routine → `ensurePrevData` → missing non-`__session__` block IDs → `fetchPrevWorkoutForBlocks` → local `readLocalPreviousWorkout(accountId, blockIds, beforeDate)` (another verified legacy `readAll()`), or bounded-concurrency legacy `/api/workouts/prev/{blockId}` requests (limit 4). `prevData` / `prevDataRef` are block-ID-keyed component state, reset on account/reference-date memo effect. Account-operation checks suppress late foreign-account results.

`prev_sets` → `fetchPrevForBlock`, add-exercise set counts, preset planned counts, best-set/micro cues and set-reference values. `pr_kg` / `computeWorkoutPrBadgeMap(localWorkouts, prevData, ...)` → legacy editor PR badges. This is not the date-browser SWR cache and not canonical identity. Do not feed canonical sessions into `block_id` comparisons, set suggestions or editor callbacks.

### Bootstrap/readiness and commit graph

`AppContent` starts account-scoped Health recovery (`runHealthBootstrapSingleFlight` / `bootstrapHealthFromSupabase`) independently of the non-blocking G5A authority controller. Parent OFF: Health waits for current-account Health readiness or displays startup failure. Parent ON preview: verified local B1 sources load independently, bootstrap pending/failure is a separate notice. `HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT` is dispatched after durable bootstrap persistence, with no account payload; preserved-local disposition need not dispatch it. AppContent currently refreshes daily/static on it; B1 separately installs bootstrap/focus/visibility listeners.

`HealthView.handleSaveWorkouts` → `saveHealthWorkouts({..., onLocalCommit: onLocalWorkoutCommitted})` → await legacy repository `saveWorkouts` → **synchronous `onLocalCommit`** → scope continuation check → HealthView UI completion/daily/month/static mutations. Delete is `handleRemoveWorkout` → `deleteHealthWorkout` → await `deleteWorkout` → same synchronous callback → continuation/UI effects. In the B1 render path AppContent passes `selectedDayRead.retry`; B1 retry increments its request sequence synchronously before scheduling React work. The persistence helper already has the right boundary; no writer/API/schema change is needed. Temp/session separator removal has no durable commit; failures/aborts before commit must not claim one.

## 3. Implementation-ready source-qualified Previous model

Use the merged `WorkoutRangeView.dates` as source evidence, never adapt canonical records to `Workout[]` or fabricate `PreviousWorkoutSession` objects to reuse legacy rendering.

Proposed `CompositePreviousWorkoutProjection` contains account/scope and bounded publication token, the shared `CompositeWorkoutReadResult` status tuple, descending eligible `dateBuckets`, `automaticDate`, `effectiveDate`, and `selectedBucket`. A bucket contains:

- `localDate`;
- optional `legacyGroup: {source: 'legacy', presentationKey, rows}`. Each row retains its actual source-qualified `readId`, persisted `rowId`, block/display data, sets and order. Apply the existing Previous non-empty-sets eligibility rule; the underlying snapshot still retains zero-set rows for calendar presence. No content dedupe;
- `canonicalSessions`: zero/many distinct `source: 'canonical'` records, each with existing `readId`, entity identity, frozen V1 entries/sets and read-only capability;
- shared source completeness/status, not an independently invented success flag.

A date is eligible when it has a displayable legacy group or at least one canonical session, including a valid canonical empty-entry session as a persisted record. Dates are strictly earlier than the reference date and inside **existing `previousWorkoutRange`**: one calendar year before reference date through yesterday, inclusive (including its leap-day clamp). Calendar uses its own exact month bounds on the **same source snapshot**; it does not inherit Previous's one-year window.

Mixed same-day layout: one date heading, a clearly named “legacy date group” section if present, and separate read-only canonical session cards A/B/etc. All eligible legacy rows and every canonical session survive. Keep merged technical canonical order (UUID tie-break) and legacy stored row order; source sections are grouping, **not chronological interleaving**. No “latest session”, performedAt, timezone, memo, session label or morning/evening inference. A technical V1 session ID may be shown to distinguish cards, not as a human title or timestamp.

Select a **date bucket and render all its source records**. There is no second session auto-selection, avoiding the otherwise unresolved same-date session-selection decision. Reuse `defaultPreviousWorkoutDate`'s date-level weekday/fallback policy through a narrow shared date-only helper `defaultPreviousWorkoutDateFromDates(dates, referenceDate)` extracted in `previousWorkoutSession.ts`; preserve its existing callers/tests. Do not manufacture legacy sessions just to satisfy that function's current rows-based type. Preserve explicit selected date while eligible; account changes reset it. Partial data chooses from known dates with an incomplete warning, never claims the list contains the latest/complete history. Preserve explicit selection intent across loading; re-evaluate when the scoped settled result arrives.

Presentation keys: `JSON.stringify(['presentation-only', 'legacy-date-group', accountId, localDate])` is a non-persisted grouping key, **not legacySessionId, adoption identity, nor a replacement for row readId**. Canonical cards use existing `readId` (source + namespace + generation + normalized entity), entries/sets use their frozen IDs nested inside that card. Any future expansion/focus/record-selection state must be `{source, readId}` plus current scope, never raw UUID/date alone. Date selection is expressly bucket selection; it is not record selection. Do not equate textual IDs across sources.

Canonical display: exercise snapshot name/type/tags/cardio mode, entry/set order/IDs, V1 set values (`weightKg`, source value/unit, reps/assistedReps, dropset, done, durationSeconds, distanceMeters), localDate, technical session identity. Null stays unknown/dash; no fabricated zero or legacy unit interpretation. Legacy display keeps catalog or truthful historical fallback and saved set values. Both history branches are read-only. No canonical item enters `handleAddWorkoutToToday`, `fetchPrevForBlock`, edit/delete/restore, draft hydration, writer arrays, adoption or clipboard-to-editor flows.

## 4. One mounted lifecycle owner and bounded state

**Selected owner:** new `useHealthWorkoutRangeSnapshot` called once in **AppContent's Health/account scope**, alongside B1. AppContent already owns B1, startup events, selected date/current month, the account-keyed HealthView and its commit callback; placing the hook here avoids a HealthView callback-registration bridge or an application singleton. It is inactive outside the effective Health child preview. HealthView receives an immutable, typed read model; Previous/sheet/supporting calendar install no DB or lifecycle listeners. This remains one feature-scoped owner, not a global cache/provider redesign.

Proposed input: `{enabled, accountId, previousBounds, monthBounds}`; bounds are derived with existing date helpers. Proposed read model: `phase: disabled | loading | settled`, normalized account/scope (scope null for genuinely unavailable canonical source), `isolationError`, `sourceStatuses`, current `previousView` / `monthView`, bounded publication token, `retry/invalidate` read-lifecycle operations. No create/update/delete/restore/bind method, DB/repository handle, outbox or mutable canonical DTO is exposed. The coordinator/current source snapshot stays private. Source statuses come from the paired result, not from separate consumer catches.

Lifecycle protocol:

1. When effective enable/account lifetime begins, create one coordinator and load one pair; a constructor/import must not perform work while OFF. Hold one current paired source snapshot only.
2. `load()` → `deriveRange(previousBounds)` and `deriveRange(monthBounds)` → pure Previous/calendar models. Derive BOTH under a captured coordinator/snapshot identity + owner request sequence + mount epoch + account + bounds token. Publish one shared result after both succeed/currentness checks finish. Suppress null/superseded derivations; never publish one new view with an old other view. Recheck final scope and established device identity, snapshot identity, owner sequence and requested bounds before React publication; a late S1 continuation cannot publish or invalidate S2. Never bypass the coordinator's verified derivation by directly exposing its raw snapshot.
3. A date/month bound change supersedes pending derivations, not the loaded source snapshot. Re-derive in memory with bounded metadata checks. Date browser clicks merely select a bucket. Closing Previous releases its rendered view but does not close the shared calendar snapshot; reopening reuses current evidence after a currentness check. Neither close/reopen nor ordinary month navigation is a domain-rescan trigger by itself.
4. Account A→B, A→B→A, sign-out, Health unmount, disabled gate or device change immediately hides old records and closes/supersedes the old coordinator/openers. Guard render by current enable/account token even before effect cleanup; compare mount/sequence, not account string alone. Late openers/read/derive/verify completions close or no-op without touching a new lifetime.
5. G1→G2: use the foundation's active-generation fence, discard G1 and allow its bounded one paired retry for G2; do not reuse G1 legacy evidence with G2 canonical evidence. A later currentness failure requires a new load. No infinite auto-retry on persistent source/identity error; settle safely with retry UI.

One source attempt costs **one verified legacy `readAll()` + one canonical `listWorkoutSessions()`**, plus bounded namespace/generation/device checks. A stale-generation recovery may cost two attempts (up to 2 + 2), not N-date scans. Previous/year and calendar/month filters cost zero additional domain scans. Under child ON, disable both legacy month and Previous SWR keys (null); do not leave their automatic reads running beside the new pair. Gate OFF keeps the original SWR keys/config/projection/rendering unchanged. Do not route canonical evidence through `RangeWorkoutRow` or `buildHealthProjection` metrics. Keep one current source value and at most the current two derived views; no persistent range Map, SWR range cache, visited-month collection or persisted invalidation counter.

B1 remains a separate selected-day architecture. One normal preview load therefore costs range 1 legacy + 1 canonical domain scan **plus B1 1 verified legacy + 1 selected-day canonical domain scan** (its date query currently lists the domain then filters). Up to two independent canonical scans per coordinated refresh is **acceptable bounded preview cost / later consolidation debt**, not a blocker or license to redesign B1. Static/per-exercise/protein existing legacy reads are additional baseline costs, not part of the range pair. B1 selected-date changes can reload B1, but must not reload range sources just because bounds changed. Derived Previous/calendar add zero per-date/per-cell scans.

## 5. Single invalidation fanout, listeners and commit races

**Fanout owner: AppContent**, using an account/mount-fenced `invalidateHealthWorkoutReads(reason)` callback. Range hook owns its synchronous `invalidateAndReload` operation; B1 retains `retry` and its data loader. Fanout first supersedes range and B1 synchronously, then schedules their bounded loads. It never awaits between fences. A captured callback from an old account/mount must not invalidate or reopen the current account; use an account epoch (including A→B→A), not only equality of IDs. Same-account historical writes still invalidate the shared range even if the editor's selected date changes after commit.

For managed child preview, make a **narrow additive B1 hook lifecycle option**: AppContent owns external bootstrap/focus/visibility triggers; B1 suppresses its own three listeners in this mode only. Default/parent-only B1 behavior remains unchanged. This is listener/fanout plumbing, not replacing B1 with a range cache or changing its cacheKey API. Range hook is listener-free; views have no listeners. AppContent's existing bootstrap listener is extended, not duplicated. In parent-only preview B1 can retain its existing listeners, while AppContent retains its existing legacy daily/static listener; no new range listener exists there.

In managed mode, the read model passed to HealthView uses the shared fanout as its UI retry callback (including B1's Refresh button); fanout retains the internal B1 `retry` for supersession, so the wrapper cannot call itself recursively. Previous/calendar retry uses the same fanout. This is read-lifecycle invalidation only, not a new product mutation API or cacheKey change.

| Trigger | Exact next-slice owner/action |
| --- | --- |
| Durable local Workout save/delete | AppContent passes the scoped shared fanout through existing `HealthView.onLocalWorkoutCommitted` into existing persistence `onLocalCommit`. Immediately after `saveWorkouts`/`deleteWorkout` resolves, both publication sequences are superseded before helper completion/HealthView UI callbacks. Do not delay this to `mutateMonthWorkoutRows`, a toast, React effect or panel refresh. Existing legacy completion mutations remain gate-OFF behavior. |
| Bootstrap complete | Existing AppContent listener invokes shared fanout before daily/static refresh. Payload-less event means conservatively refresh only CURRENT mounted account from its own namespaces; do not infer which account bootstrapped or publish event-carried data. No duplicate B1/range/panel bootstrap listener in managed mode. |
| Focus/visibility | AppContent installs one window `focus` and one document `visibilitychange` listener only while managed preview is mounted; ignore hidden state; coalesce the pair within the existing 250 ms policy. Both are needed for desktop focus and Home Screen resume without reliable focus. Cleanup on disable/account/unmount. One fanout, not one per consumer. |
| Currentness recheck | Metadata/device verification failure discards scoped evidence and reloads a bounded pair. Visible focus/resume also reloads after invalidation even if scope is unchanged: metadata alone cannot detect a same-generation legacy write elsewhere. No claim of live subscription to every out-of-band IDB change. |
| Manual retry | Scoped shared retry supersedes pending work and reloads the same bounded sources; no new persistent key. |
| Device/generation observed during derive/load | Discard before publication, close/reopen within bounded policy; report persistent failure without repairing malformed identity. No new remote listener, polling loop or writer event bus. |

These are snapshot stale triggers: committed owned write, bootstrap persistence event, account/device/generation change, visible focus/resume revalidation, explicit retry, or failed currentness fence. Date/month navigation alone is **not stale**. An out-of-band same-generation local write while continuously focused without any event is not automatically observable; focus/retry gives freshness, and owned writes must always emit the existing commit callback. Do not promise cross-device convergence from local readers.

`B1-P3-SAVE_DELETE_INTEGRATION_TEST` is reclassified **CLOSE_WITH_NEXT_SLICE**. Source already has synchronous commit plumbing and B1 hook/helper unit tests, but the new fanout changes their real wiring. Require a full mounted HealthView + AppContent-owned fanout integration test for **both save and delete**, B1 + range old loads started → durable legacy commit → synchronous supersession → old continuation resolves and cannot publish/editor-hydrate → new pair reflects the commit in Previous/calendar/B1. Also cover account/date change during commit, failure before commit, unmount, historical write, and no duplicate reads from duplicate events. Do not claim that `healthWorkoutPersistence.test.ts` or direct coordinator invalidate tests alone close the full integration debt. It is not fixed in this preparation.

## 6. Shared completeness, calendar truth and loading

Use one paired `CompositeWorkoutReadResult` status tuple for BOTH derived ranges. Ordinary source failures may be partial; any `CompositeWorkoutReadIsolationError` (account/namespace/generation mismatch) overrides partial and publishes **no records**. Genuine canonical opening failure may produce a legacy partial view with **null scope**, not a fabricated namespace. Keep the merged null-scope device fence and S1/S2 publication fence intact.

| Shared state | Previous | Calendar |
| --- | --- | --- |
| Loading / superseded bounds | Loading status, no fabricated empty history; do not display old account/generation content. Preserve selection intent only, not authoritative old records. | Month remains navigable but all activity is unknown/loading until its current derived month is ready. No empty-month claim. |
| Complete, records | Eligible date buckets and all source sections; source labels, no dedupe. | `present` iff any persisted legacy row OR active canonical session exists on date; otherwise `absent`. Two canonical sessions yield one date-presence dot, not one merged session. |
| Partial, legacy error | Canonical cards survive with explicit unavailable legacy/incomplete coverage. No “no history” from empty survivor. | Known canonical-present dates `present`; all other dates `unknown`, not `absent`. Incomplete warning names legacy failure. |
| Partial, canonical error | Legacy groups survive with explicit unavailable canonical/incomplete coverage. No complete-history/empty claim. | Known legacy-present dates `present`; all others `unknown`; warning names canonical failure. |
| Both-source error | Error, no records; shared retry. | All dates unknown/error, no empty-month claim; shared retry. |
| Isolation failure | No records, scoped error, retry; never partial. | All activity unknown, no stale marks. |
| Complete empty | Verified no eligible prior history in this bounded interval (not a global all-time claim). | Every date in verified month `absent`; legitimate empty month. |

Smallest additive calendar contract: optional **discriminated composite activity model**, not another bare `Set`: `{mode: 'composite', phase, status, legacyStatus, canonicalStatus, monthStart, monthEnd, knownPresentDates, onRetry}`. Cell state derives as `present | absent | unknown` with `absent` allowed only for complete settled evidence covering that cell. Unsupported/out-of-bounds cell is unknown. Existing `workoutDates` path stays exactly legacy mode; never silently choose it as fallback after a composite source failure. Preserve month navigation and selected-day actions. Add visible source warning/retry and an accessible unknown indicator distinct from “no workout”/present, in both current calendar render branches; never only hide an unknown dot. Keep styling/IA compact; do not redesign calendar, Inbody or nutrition.

Partial copy and visual unknown-state treatment are **PRODUCT_DECISION_REQUIRED** before any public activation. Next preview implementation can use explicit, testable diagnostic wording (“legacy unavailable”, “canonical unavailable”, “activity unknown”) but cannot treat that as approved public copy. Both consumers receive the same completeness evidence; neither independently promotes partial to complete.

## 7. Static gate and product scope

Exactly one proposed new child constant: `HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED = false` in new `healthWorkoutRangeCompositeConfig.ts`. Effective enable is **parent AND child AND active Health view** (and account presence); assert the invalid parent-OFF/child-ON combination fails closed without mounting/opening/listening. No remote flag, localStorage override, account allowlist, G5A-ready or remote authority-OPEN dependency. The next implementation retains both shipped constants OFF.

| Parent B1 | Child range | Behavior |
| --- | --- | --- |
| OFF | OFF | Exact existing legacy product behavior. |
| ON | OFF | Existing selected-day-only QA preview; range unmounted, existing history/calendar legacy-only. |
| ON | ON | Reviewed selected-day + Previous/calendar QA preview, one range owner/managed event fanout. **Not public activation.** |
| OFF | ON | Invalid: fail closed, no range mounts/I/O/listeners; ordinary legacy path remains. |

Per-exercise Previous/PR comparison **implementation is excluded**; however the child preview must visibly label existing editor comparison cues/PR as **legacy-only**, and B1's current blanket “other workout views remain legacy-only” sentence must be made accurate for range preview without claiming Home/Search are composite. This bounded scope copy is necessary to distinguish the source-qualified date browser from legacy suggestions. No canonical comparison, history PR computation or suggest/apply behavior is added. Whether to retain a prominent legacy-only comparison claim publicly or implement canonical comparison later remains a product decision.

Home, Search, metrics, Archive and export are **not in the next slice**:

- Home `buildHomeFoundationProjection.buildWorkoutSummary` uses selected legacy `Workout[]` or account/date draft; a canonical-only today can still look empty. It is a later activation blocker, not an atomic dependency of Health range preview.
- Search `GlobalSearchHost` → `useSearchProjection` / `buildSearchProjection` → `buildHealthSearchResults` consumes legacy `Workout[]` + catalog. AppContent explicitly keeps legacy daily Search active even in B1 preview. Future scope/readId/read-only target/navigation decision remains required; no unqualified all-source discovery claim.
- Unmounted Health metrics/LegacyAnalytics are not wired; no mixed session count, PR, volume or streak totals. Calendar activity is boolean date presence, not analytics.
- Archive composes note history/trash/snapshots/domain marks, not canonical Workout entities. CSV `exportAllToCsv` guards local-first domains before remote export. No all-source Workout archive/export promise, no change to recovery or export formats.

Legacy selected-day editor, dirty-draft guards, account/date completion policy and all persistence semantics remain unchanged. Canonical Previous is read-only. No canonical create/update/delete/restore, dual-write, legacy adoption/migration, reset or remote data-plane call is authorized.

## 8. Exact one-slice file handoff and future validation

All paths are repository-relative. Expected **production files** for `REL_05G5B2B2B_PREVIOUS_CALENDAR_COMPOSITE_INTEGRATION`:

| File | Bounded purpose |
| --- | --- |
| `frontend/src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts` (new) | Single enabled/account-scoped range coordinator, paired derivation, fences, bounded immutable read state and synchronous invalidation. No listeners/writers. |
| `frontend/src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts` (new) | Default-OFF static child and effective gate contract. |
| `frontend/src/components/AppContent.tsx` | Invoke one feature hook; compute existing bounds; scoped shared commit/bootstrap/focus fanout; pass typed result/commit callback. Not Home/Search wiring or G5A changes. |
| `frontend/src/components/views/features/health/useHealthSelectedDayComposite.ts` | Add optional externally managed lifecycle triggers, preserve default loader/retry/cacheKey/parent-only semantics. |
| `frontend/src/types/index.ts` | Add typed optional Health range-read prop only, not `Workout[]`/writer mutation shape. |
| `frontend/src/components/views/HealthView.tsx` | Gated range read consumption, OFF-equivalent SWR path, disable redundant month/Previous reads in preview, date bucket selection, accurate scope label beside legacy PR/cues. Do not change writer handlers beyond using the already supplied commit callback. |
| `frontend/src/components/views/features/health/compositePreviousWorkoutProjection.ts` (new) | Pure bounded buckets/source identity/selection/completeness adapter. |
| `frontend/src/components/views/features/health/previousWorkoutSession.ts` | Narrow extraction/reuse of date-only default helper; preserve legacy Previous behavior. |
| `frontend/src/components/views/features/health/CompositePreviousWorkoutView.tsx` (new) | Read-only source sections/card presentation; no canonical-to-legacy adapter. |
| `frontend/src/components/views/features/health/PreviousWorkoutSheet.tsx` | Add typed composite content branch while keeping legacy props/scroll/focus path and default behavior; same composite view as desktop. |
| `frontend/src/components/views/features/health/workoutCalendarActivity.ts` (new) | Pure typed tri-state calendar model from current verified month, no metrics/I/O. |
| `frontend/src/components/views/features/health/HealthSupportingPanels.tsx` | Pass additive calendar activity model; no Inbody/nutrition changes. |
| `frontend/src/components/views/features/health/WorkoutMonthCalendar.tsx` | Warning/retry/known-present/unknown cells, legacy OFF path unchanged. |
| `frontend/src/components/views/features/health/HealthSelectedDayCompositePanel.tsx` | Child-preview-aware source-scope sentence only; keep B1 card/editor boundaries. |
| `frontend/src/lib/i18n/keys.ts`, `frontend/src/lib/i18n/en.ts`, `frontend/src/lib/i18n/ko.ts`, `frontend/src/lib/i18n/ja.ts` | Bounded source/unknown/read-only scope vocabulary; public wording approval remains separate. |

Foundation modules (`workoutRangeReader.ts`, `verifiedWorkoutRangeSnapshot.ts`, `workoutLocalReaderAuthority.ts`, `compositeWorkoutReadProjection.ts`), persistence helper, backend, DB/schema/indexes, V1 and G5A authority are frozen. If integration reveals a foundation defect, report it separately; do not casually redesign the merged contract. No global provider, singleton, canonical mutable repository or extra schema is needed.

Expected **new test files** (existing test runner conventions use `.test.ts`, including mounted React harnesses):

- `frontend/src/components/views/features/health/useHealthWorkoutRangeSnapshot.test.ts`;
- `frontend/src/components/views/features/health/healthWorkoutRangeCompositeConfig.test.ts`;
- `frontend/src/components/views/features/health/compositePreviousWorkoutProjection.test.ts`;
- `frontend/src/components/views/features/health/CompositePreviousWorkoutView.test.ts`;
- `frontend/src/components/views/features/health/workoutCalendarActivity.test.ts`;
- `frontend/src/components/views/features/health/WorkoutMonthCalendar.test.ts`;
- `frontend/src/components/views/healthWorkoutRangeConsumerIntegration.test.ts` (full mounted HealthView/fanout save/delete/late-load races, not source-text-only tests).

Expected narrow updates/regressions in `frontend/src/components/views/features/health/`: `previousWorkoutSession.test.ts`, `PreviousWorkoutSheet.test.ts`, `useHealthSelectedDayComposite.test.ts`, `HealthSelectedDayCompositePanel.test.ts`, `previousWorkoutSWR.test.ts`, `healthWorkoutPersistence.test.ts`; also `frontend/src/components/views/healthRoutinePresetAccountIsolation.test.ts` and `frontend/src/components/views/renderedCompositionContracts.test.ts` when changed props require them. Retain legacy `PreviousWorkoutView.test.ts`/`previousWorkoutProjection.test.ts` unchanged behavior. Run existing range cold-import/fence suites and canonical selected-day/repository regressions without changing foundation behavior.

### Required direct matrices (future implementation, NOT claimed executed here)

1. **Previous projection/render:** legacy-only; canonical-only; mixed same date; A/B canonical sessions same date; multiple legacy rows; same textual ID cross-source; frozen exercise entries/sets, zero/null/assisted/bodyweight/cardio values; existing non-empty legacy eligibility; canonical empty entries; one-year/yesterday/leap boundaries; weekday date default and most-recent fallback; explicit date retained/reset; loading selection intent; no intra-day chronology/content dedupe/synthetic identity; read-only cards with no canonical writer callbacks or `Workout[]` hydration.
2. **Completeness/isolation:** each source error, partial survivor with zero records, both errors, verified complete empty; account/namespace/generation mismatch overrides partial, null-scope canonical unavailable with device unchanged/change-during-derive; Previous/calendar share exact status tuple and load identity.
3. **Calendar:** legacy-only/canonical-only/mixed present day; two sessions one mark; zero-set persisted legacy presence; complete empty month absent; partial known-present + unknown absence; all-error/isolation/loading all unknown; warning/retry/accessible unknown distinct from false in both render branches; ordinary month navigation and simultaneous one-year Previous use same pair, no rescan.
4. **Mounted lifecycle/read budget:** one legacy + one canonical per attempt; stale G1 pair discarded and at most one G2 retry; no per-date/card/render scans, no extra legacy month/Previous SWR in child preview; B1 coexistence exact bounded counters; A→B→A, sign-out, unmount, enable transitions, StrictMode replay, late opener/load/derive/verify, S1 cannot publish/invalidate S2, bounds changes during derivation, malformed device fail-safe/no repair; one current snapshot/no visited-range cache.
5. **Full save/delete integration:** start delayed B1 and range source pairs; trigger actual HealthView save/delete with controlled durable legacy persistence; prove synchronous supersession happens before old resolution and post-helper UI completion; new B1/Previous/calendar reflect committed rows; old completion cannot overwrite/hydrate. Repeat with account/date transition, commit then stale continuation, failure/no commit, temp separator removal and unmount. Exercise AppContent-owned callback wiring, not only helper or hook harnesses. Gate OFF preserves writer payloads/versions/draft policy.
6. **Events/gates:** managed mode installs exactly one focus + one visibility listener and one existing bootstrap listener; hidden ignored, event-pair coalesced, cleanup removes them, no per-panel listeners; payload-less old-account bootstrap refreshes current scope only; offline and remote-bootstrap failure do not gate canonical local reads; G5A not ready/remote OPEN irrelevant; both constants OFF produce exact baseline behavior; parent OFF child ON no I/O/mount/listener; parent-only B1 retains existing behavior, managed mode no duplicate B1 events. Scope labels truthful; Home/Search/metrics/export untouched.

Future validation: focused matrices + related B1/B2A/legacy/persistence/account/composition regressions, frontend full suite, typecheck, build, `git diff --check`, exact-head hosted CI (test/typecheck/build/backend-rel05g1/backend-recovery). Do not fix unrelated Windows K-333B fixture-anchor failures; report local results honestly and use successful exact-head hosted full-suite evidence. This docs-only PR requires diff/scope verification and normal hosted CI, not runtime tests solely for a Markdown edit.

## 9. Product decisions, later QA and unchanged blockers

**PRODUCT_DECISION_REQUIRED:** mixed/multi-session date bucket visual hierarchy/density (contract fixes all records visible, not final styling); public partial-data wording; accessible calendar unknown/present/absent treatment; whether per-exercise PR stays prominently legacy-only publicly or gains a separately reviewed canonical comparison; later Home truth and Search scope/read-only navigation/export claims. Date-only selection plus rendering all records **avoids** an unresolved same-date default-session choice. No policy for automatic canonical session selection is approved. Preview diagnostic labels cannot silently become public wording. These decisions do not block this preparation/design review; freeze/approve affected layout/copy before the later public activation decision, and report any actual preview usability blocker before implementing around it.

Physical QA is **LATER_GATE**, not silently included in the next implementation: Windows Edge installed PWA and iPhone Safari Home Screen Web App separately, each with its own IDB/localStorage/device identity; legacy-only, canonical-only and same-day multi-session fixtures; offline; remote bootstrap pending/failed with verified local success/error; account A→B→A; generation/device changes and resume. Unsynced records on device A are not promised on device B. Review measured dataset size/performance before public use; bounded cache cardinality does not imply a tiny source dataset or an index migration authorization.

`REL05G5A-001`: **ACTIVATION_PREREQUISITE**, not implementation prerequisite for this default-OFF, fail-safe local preview. Current shared identity helpers can accept malformed established device values later rejected by namespace validation; preserve unavailable/fail-closed behavior and test it, do not repair/reidentify devices here. Public availability for those devices still requires separate correction.

`B1 HealthSelectedDayReadModel.cacheKey` naming/API P3: **OPEN_NON_BLOCKING**. Managed listener plumbing touches B1 but does not depend on/change that metadata field; no cacheKey redesign is required. New owner epoch is explicitly a publication token, not persisted cache identity. Full B1 save/delete race debt is **CLOSE_WITH_NEXT_SLICE**, not closed by this doc.

All seven live-writer blockers remain **OPEN**, including after successful preview consumer work: (1) unbound pre-reset create, (2) rollback visibility, (3) old/new writer coexistence, (4) product UI identity integration, (5) canonical field/product ownership, (6) projection integration, (7) reset-fenced local edit policy. Reader progress may inform 4/6 but closes neither product-wide blocker.

Public activation still requires separately reviewed Home canonical-only truth, Search scope/navigation, per-exercise Previous/PR claim decision, full B1 save/delete race coverage, REL05G5A-001 disposition/correction, partial-data UX/copy approval, physical/offline/performance QA and an explicit public-reader activation decision. No runtime activation, writer cutover, backend/DB/V1 change, G6, Ready transition or merge is authorized by this preparation or implied by CI success.

## 10. Acceptance trace — preparation artifact, not implementation completion

Each PASS below means the required source characterization/design decision is present. Future runtime tests and product activation are not claimed complete.

| Criterion | Result | Trace |
| --- | --- | --- |
| G5B2B2B-P01 | PASS | §1 exact PR #734 merge/main/hygiene evidence. |
| G5B2B2B-P02 | PASS | §1 foundation CLOSED_IN_MAIN. |
| G5B2B2B-P03 | PASS | §1 source search: zero mounted foundation consumers. |
| G5B2B2B-P04 | PASS | §1 existing static parent false. |
| G5B2B2B-P05 | PASS | §2 Previous open/key/read/project/view/sheet/lifecycle graph. |
| G5B2B2B-P06 | PASS | §2 month SWR/projection/calendar/error fallback graph. |
| G5B2B2B-P07 | PASS | §2 separate block-ID prevData/cue/PR graph. |
| G5B2B2B-P08 | PASS | §2–3 date grouping, order, non-empty legacy eligibility. |
| G5B2B2B-P09 | PASS | §3 distinct same-day canonical cards A/B. |
| G5B2B2B-P10 | PASS | §3 legacy group plus all canonical sessions in bucket. |
| G5B2B2B-P11 | PASS | §3 explicitly presentation-only key, real row readIds. |
| G5B2B2B-P12 | PASS | §3 technical ordering, no performedAt/session chronology. |
| G5B2B2B-P13 | PASS | §3 date-only selection, preserve eligible explicit date. |
| G5B2B2B-P14 | PASS | §2–3 weekday/newest-date fallback shared helper. |
| G5B2B2B-P15 | PASS | §2–3 read-only UI; selection/retry/close, no writer actions. |
| G5B2B2B-P16 | PASS | §6 shared complete/partial/error/empty contract. |
| G5B2B2B-P17 | PASS | §3 existing prior-year/yesterday inclusive helper. |
| G5B2B2B-P18 | PASS | §4 load → verified two ranges → pure consumer projections. |
| G5B2B2B-P19 | PASS | §4 one dedicated hook in AppContent Health scope. |
| G5B2B2B-P20 | PASS | §4–5 epoch/current-account/ABA/sign-out/late cleanup. |
| G5B2B2B-P21 | PASS | §4–5 device and active-generation fences/reload. |
| G5B2B2B-P22 | PASS | §5 one AppContent focus/visibility owner/coalescing/cleanup. |
| G5B2B2B-P23 | PASS | §5 existing AppContent bootstrap listener extended. |
| G5B2B2B-P24 | PASS | §2, §5 save durable commit → synchronous scoped fanout. |
| G5B2B2B-P25 | PASS | §2, §5 delete uses same exact commit boundary. |
| G5B2B2B-P26 | PASS | §5 CLOSE_WITH_NEXT_SLICE with full mounted race coverage. |
| G5B2B2B-P27 | PASS | §6 persisted legacy OR active canonical date presence. |
| G5B2B2B-P28 | PASS | §6 partial known-present, unknown absence, never false. |
| G5B2B2B-P29 | PASS | §2 current boolean-only gap; §6 additive typed contract. |
| G5B2B2B-P30 | PASS | §1 option B atomic decision and alternatives assessed. |
| G5B2B2B-P31 | PASS | §7 exactly one shared static child strategy. |
| G5B2B2B-P32 | PASS | §7 proposed child defaults false, no live flag here. |
| G5B2B2B-P33 | PASS | §7 parent OFF child ON cannot mount/read/listen. |
| G5B2B2B-P34 | PASS | §7 preview not public activation. |
| G5B2B2B-P35 | PASS | §7 Home later truth blocker, not included. |
| G5B2B2B-P36 | PASS | §7 Search later source/target decision, not included. |
| G5B2B2B-P37 | PASS | §2, §7 PR computation excluded; scope label required. |
| G5B2B2B-P38 | PASS | §2, §7 no mixed/unmounted metrics wiring. |
| G5B2B2B-P39 | PASS | §7 Archive/export excluded and claims bounded. |
| G5B2B2B-P40 | PASS | §4 enabled phase/scope/status/current two-view model. |
| G5B2B2B-P41 | PASS | §4 only read/retry/invalidate, no mutation/repository handle. |
| G5B2B2B-P42 | PASS | §5 one scoped AppContent invalidation fanout. |
| G5B2B2B-P43 | PASS | §4 range+B1 quantified bounded preview cost/later debt. |
| G5B2B2B-P44 | PASS | §4 no per-date/card/cell canonical scan. |
| G5B2B2B-P45 | PASS | §4 same pair derives month/year without rescan. |
| G5B2B2B-P46 | PASS | §5 exact stale triggers and out-of-band limitation. |
| G5B2B2B-P47 | PASS | §4 one snapshot/two current views, no persistent Map/cache. |
| G5B2B2B-P48 | PASS | §6 one shared result status tuple. |
| G5B2B2B-P49 | PASS | §6 loading not empty; legacy OFF path unchanged. |
| G5B2B2B-P50 | PASS | §6 both-error Previous no records/calendar unknown. |
| G5B2B2B-P51 | PASS | §9 explicit unresolved product decisions. |
| G5B2B2B-P52 | PASS | §3 render all bucket records, no automatic session choice. |
| G5B2B2B-P53 | PASS | §3 source/readId/scope-qualified record UI state. |
| G5B2B2B-P54 | PASS | §8 direct Previous matrix and exact future tests. |
| G5B2B2B-P55 | PASS | §8 direct calendar partial/union/shared-read matrix. |
| G5B2B2B-P56 | PASS | §5, §8 full HealthView/fanout race owner and steps. |
| G5B2B2B-P57 | PASS | §9 separate installed-PWA/Home-Screen/offline QA gate. |
| G5B2B2B-P58 | PASS | §1, §8 exactly one next implementation work item. |
| G5B2B2B-P59 | PASS | §1 new proposed reviewed REL_05G5B2B2B name. |
| G5B2B2B-P60 | PASS | §8 exact bounded production/test file handoff. |
| G5B2B2B-P61 | PASS | §1, §8 no backend change. |
| G5B2B2B-P62 | PASS | §1, §8 DB7/schema1/index/keyPath unchanged. |
| G5B2B2B-P63 | PASS | §1, §8 V1 unchanged. |
| G5B2B2B-P64 | PASS | §7 no canonical create/update/delete/restore. |
| G5B2B2B-P65 | PASS | §1, §7 no bind/push/pull/resync/reset activation. |
| G5B2B2B-P66 | PASS | §1 G6 inactive. |
| G5B2B2B-P67 | PASS | §9 all seven live-writer blockers OPEN. |
| G5B2B2B-P68 | PASS | §9 REL05G5A-001 activation prerequisite, not fixed. |
| G5B2B2B-P69 | PASS | §9 B1 cacheKey OPEN_NON_BLOCKING, no dependency. |
| G5B2B2B-P70 | PASS | §9 full remaining public activation gate. |

Preparation blockers: **0**. Handoff: `REL_05G5B2B2B_CONSUMER_INTEGRATION_PREP_INDEPENDENT_REVIEW`, recommended reviewer **GPT-6.1 Sol XHigh**. Review the atomic scope, account-fenced event fanout, shared publication/completeness, tri-state calendar and full race-test obligation before implementation. This artifact is docs-only; its commit/PR exact-head CI evidence is reported separately so the document does not embed a circular own-commit SHA.
