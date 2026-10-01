# REL-05G5B2B2D — Search composite Workout truth characterization

## 1. Authority, scope and decision

Workstream: `REL_05G5B2B2D_SEARCH_COMPOSITE_TRUTH_CHARACTERIZATION`.

Pinned authoritative main: `f135febc635f4ff5550d182e062253ba51a3e8da`.
PR #738 was verified **MERGED**, with that exact merge commit, on 2026-10-01. GitHub main, fetched `origin/main` and fast-forwarded local `main` agreed. The canonical workspace is `C:\Users\이도현\GitRepos\Absinthe`; tracked/index state was clean before creating this document's topic branch. No existing exact Search workstream/naming replacement was found in `frontend/docs`.

This is source/product characterization and **one docs-only publication**, not implementation, runtime acceptance, reader activation or writer cutover. Home characterization and default-OFF Home integration are closed in main. This document changes neither. All future behavior below is a proposed contract, not current behavior or an executed acceptance result.

Final readiness decision: **`SEARCH_COMPOSITE_TRUTH_IMPLEMENTATION_READY`**.

This decision applies only to one separately reviewed, default-OFF, non-public **selected-day source-aware diagnostic preview**, defined in §12. Its technical unit is a saved exercise observation: one persisted legacy row or one canonical entry, with source identity retained. Its scope is explicitly the current Health selected date, even when the palette opens from Home. It does not silently select the public meaning of global Workout Search, claim all history, or unify sessions with rows. Public granularity, coverage and copy remain `PRODUCT_DECISION_REQUIRED` (§10). No public activation follows from this decision.

## 2. Pinned source/evidence index

Every source link below pins the main SHA above. Line anchors identify the inspected implementation, not PR-body metadata. E01–E22 are source facts; E23–E25 are existing test/document evidence, not newly executed runtime acceptance.

| ID | Pinned source | Evidence |
| --- | --- | --- |
| E01 | [AppContent.tsx, L272](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/AppContent.tsx#L272) | `dateStr`, B1/Home eligibility, daily input, Health-only range owner, durable routing; Search props at L600. |
| E02 | [GlobalSearchHost.tsx, L19](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/GlobalSearchHost.tsx#L19) | Workout[] props; continuously mounted host; open/query signal, recipe-only host fetch and projection. |
| E03 | [buildSearchDomainResults.ts, L103](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/buildSearchDomainResults.ts#L103) | Saved legacy row and catalog matching, IDs, fields, ordering, combined Health cap of 12. |
| E04 | [searchProjectionModels.ts, L23](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/searchProjectionModels.ts#L23) | Result model has no Workout localDate/session/entry target; counts and Health kinds. |
| E05 | [buildSearchProjection.ts, L145](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/buildSearchProjection.ts#L145) | Health input is legacy Workout[] + catalog; Health state at L160 is catalog state, not Workout source completeness. |
| E06 | [useSearchProjection.ts, L5](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/hooks/useSearchProjection.ts#L5) | Pure projection memo; query/render is not a Workout reader; default `now` creates a Date each render. |
| E07 | [SearchWorkspacePalette.tsx, L61](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/components/SearchWorkspacePalette.tsx#L61) | Recent recording, Health navigation at L107, keyboard/click common handler, state/empty/count rendering. |
| E08 | [SearchResultCard.tsx, L46](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/components/SearchResultCard.tsx#L46) | Title/category/optional subtitle/date display; no Workout snippet or source/date target logic. |
| E09 | [searchDomainNavigation.ts, L3](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/searchDomainNavigation.ts#L3) | Mount-registered `onOpenHealthDay(dateLabel)` callback, not a session selector. |
| E10 | [HealthView.tsx, L1330](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/HealthView.tsx#L1330) | Registered handler parses a date, sets selectedDate only, then opens a Health note. Durable notifications at L801/L999. |
| E11 | [noteNavigation.ts, L147](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/lib/noteNavigation.ts#L147) | Health note helper can create/update a note and switches to Notes; not read-only date navigation. |
| E12 | [useDaily.ts, L79](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/hooks/useDaily.ts#L79) | Account/date local SWR source; remote compatibility URL; Workout[] fallback and absent Workout readiness. |
| E13 | [healthLocalRuntime.ts, L106](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/lib/healthLocalRuntime.ts#L106) | Persisted row adaptation, selected-date filter, historical missing-catalog fallback, readAll at L163. |
| E14 | [types/index.ts, L94](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/types/index.ts#L94) | Legacy Workout row contains no date/account/session identity. |
| E15 | [healthLocalRepository.ts, L612](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/lib/healthLocalRepository.ts#L612) | Verified account legacy snapshot, import-state/integrity checks; repository delegation at L1060. |
| E16 | [workoutSessionRepository.ts, L145](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/lib/workoutSessionRepository.ts#L145) | list validates all active sessions; date query lists whole domain then filters. |
| E17 | [localDatabase/repository.ts, L1945](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/lib/localDatabase/repository.ts#L1945) | Existing namespace/generation/domain getAll index; excludes tombstones by default, no date index. |
| E18 | [workoutRangeReader.ts, L74](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/lib/workoutRangeReader.ts#L74) | Active-domain scan, envelope isolation and device/generation verification. |
| E19 | [verifiedWorkoutRangeSnapshot.ts, L116](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts#L116) | Inclusive pure range derivation; coordinator owns one all-date paired snapshot at L144; final derive fence at L252. |
| E20 | [useHealthWorkoutRangeSnapshot.ts, L56](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts#L56) | Single listener-free account owner; currently exposes only Previous/month views, bounded recovery and publication sequence. |
| E21 | [compositeWorkoutReadProjection.ts, L55](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/health/compositeWorkoutReadProjection.ts#L55) | Source-qualified readId, capability, complete/partial/error; whole-source invalidation and isolation errors. |
| E22 | [workoutSessionV1.ts, L60](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/lib/workoutSessionV1.ts#L60) | V1 session/entry/exercise/set snapshots; strict nonempty entry/set and UUID-value uniqueness validation. |
| E23 | [lean04bSearchSourceCharacterization.test.ts](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/lean04bSearchSourceCharacterization.test.ts), [lean04bGlobalSearchLifecycleCharacterization.test.ts](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/search/lean04bGlobalSearchLifecycleCharacterization.test.ts) | Existing ownership/open/closed projection and query activation cases. Older tests' lack of `healthReady` does not mean current catalog readiness is absent. |
| E24 | [verifiedWorkoutRangeSnapshot.test.ts](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/health/verifiedWorkoutRangeSnapshot.test.ts), [useHealthWorkoutRangeSnapshot.test.ts](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/src/components/views/features/health/useHealthWorkoutRangeSnapshot.test.ts) | Existing scan reuse, range fences, recovery, isolation, device/account ABA tests; future Search consumption still needs mounted tests. |
| E25 | [merged Home characterization](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/docs/REL-05G5B2B2C-home-composite-truth-characterization.md#L218), [writer-cutover preparation](https://github.com/Absinthe-6785/Absinthe/blob/f135febc635f4ff5550d182e062253ba51a3e8da/frontend/docs/REL-05G5B-product-cutover-prep.md#L62) | Seven writer blockers OPEN, Search separate activation dependency, REL05G5A-001 and B1 cacheKey debt. |

Additional inspected boundaries in the same pinned tree: `useHealthSelectedDayComposite.ts` (L44 owner, L156 canonical read, L184 paired load, L274 visible fence); `workoutSelectedDayReader.ts` (L84 date read); `searchRecentStorage.ts` (L73 global non-recipe recent write); `searchHighlight.ts`; `SearchVirtualList.tsx`; `useNow.ts`; `useStatic.ts` (L166 catalog readiness); `syncAuthority.ts` (L83 LOCAL_FIRST Workout policy); `healthSelectedDayCompositeConfig.ts`, `homeWorkoutCompositeConfig.ts`, `healthWorkoutRangeCompositeConfig.ts` (the three false gates); `localDatabase/types.ts` (L2 DB v7, L3 schema v1). These are not mutable branch references.

## 3. Exact current Search source graph

```text
AppContent.selectedDate -> useNow.formatDate -> dateStr
  -> useDailyData(dateStr, accountId, legacyDailyActive, ...)
     production LOCAL_FIRST health_workouts:
       SWR ['local-health-daily', accountId, dateStr]
       -> readLocalHealthDaily(accountId, dateStr)
       -> HealthRepository.readAll -> verified account legacy datasets
       -> projectLocalHealthDaily -> workout_logs WHERE date == dateStr
       -> Workout[] (persisted row id; date/owner dropped from row type)
  -> GlobalSearchHost.workouts (AppContent L609, NOT B1/Home canonical result)
  -> useSearchProjection -> buildSearchProjection
  -> buildHealthSearchResults(query, Workout[], healthBlocks, now)
  -> Health group -> SearchVirtualList -> SearchResultCard
  -> palette common click/Enter handler -> navigateResult
     -> switchToTab('health')
     -> registered onOpenHealthDay(subtitle prefix OR exercise title), if present
     -> optional selectedDate parse + openHealthDayNote -> Notes / possible note creation
```

Catalog is a parallel path: `useStaticData` account-scoped `healthBlocks` plus `healthBlocksState` -> `exercise-block` results. Recipe is the only direct open-driven dataset fetch in GlobalSearchHost; Search itself does not fetch Workout history. The remote-compatible daily branch requests `/api/workouts?date=dateStr`, not a range. `syncAuthority.ts` currently declares health_workouts LOCAL_FIRST; both branches expose only Workout[].

The host is continuously mounted but keyed by `authUser.id` (E01 L601), so account changes remount it. `open && query.trim()` signals deferred datasets upward. Closing clears the live query; a persisted query can be restored on reopen. Query/projection work exists while closed, but the palette returns null. Existing SWR account/date keys own daily reads and caches; pure Search projection owns no Workout persistence cache, canonical handle or listeners.

## 4. Current result, match, count and navigation semantics

**Saved Workout result:** one matching legacy row, ID `workout-${w.id}`, domain `health`, kind `workout`, title `exercise_blocks.name`, category `exercise_blocks.type ?? 'Workout'`, score 0 exact / 1 prefix / 2 substring (case-insensitive). It also stores `plannerItemId=w.id` for recent recording, not an exercise-row navigation target. No date, subtitle, snippet, set summary or session ID is emitted. No dedupe is applied to distinct row IDs, even for the same exercise. Duplicate raw IDs would collide in result keys/highlight maps; current builder does not validate them.

**Catalog result:** `block-${block.id}`, kind `exercise-block`; matches block name or tags, score offset +1. It is an exercise definition, not proof of a saved workout. A saved-row result and a matching catalog result may both appear. Health results are sorted by score then title and capped at **12 combined row/catalog cards**. Current `counts.health` and `counts.total` count emitted result items after those caps, not sessions, unique exercises, dates, or real-world workouts.

Workout matching uses **name only**, including the legacy historical fallback name where the catalog is missing. It does not search type/category, tags on saved rows, sets, values, date, memo or notes. The card highlights title characters. V1 offers frozen `exercise.name/type/tags/cardioMode/id`, entry/set IDs and set values, but has no session title, memo, performedAt, timeZone or session timestamp. A future preview can match frozen name only without inventing parity; additional match fields are a public product decision.

**Navigation is not currently a reliable day deep link.** E07 derives `day` from a subtitle prefix before `·`, otherwise the title. Saved Workout results have no subtitle, so the argument is normally an exercise name. E10's mounted Health handler parses `YYYY-MM-DD`-shaped text, sets selectedDate if its numeric components are truthy, then unconditionally opens a Health day note. The note helper can create/update a note and switches to Notes (E11). It never sets AppContent.currentDate, selects a row/session/entry, or validates a canonical target. If Health was not mounted when Search opened, switching tabs does not synchronously register its effect; there may be no handler for this click, leaving only the Health tab switch. If Health was already mounted, the note path is reachable. A date-shaped exercise name is not a valid saved-date contract.

Consequently, a future read-only canonical result must not reuse this handler or infer a date from title/subtitle. Current app setters can support **Health + exact localDate + corresponding calendar month**, through an AppContent-owned typed callback. There is no canonical session/entry deep-link selection UI to invoke. A technical entry identity can remain distinct while navigation is date-level, visibly labelled as such. Whether public results should instead open a note/editor/session requires a separate product decision.

Recent Health items are another boundary: E07 normally writes the bare row ID, and `searchRecentStorage.ts` scopes recipes by account but other domains use a global bounded key (16 entries). Future preview must not persist canonical names/IDs there, claim that account remount alone isolates existing recent history, or treat a recent row ID as a valid composite/date target. The bounded private preview below bypasses recent recording for its new result kinds; gate-OFF recent behavior remains unchanged.

## 5. Source-grounded reachable truth gaps

These are consequences of the input graph, not assumptions inherited from Home docs. Canonical entities can exist through dormant repository/test/previously established local data; this does **not** claim today's public UI has an active canonical writer.

| Persisted/source state | Current Workout Search outcome | Truth/claim consequence |
| --- | --- | --- |
| Matching legacy row on selectedDate | One row result, possibly alongside catalog; subject to combined cap 12. | Saved legacy row is discoverable, not a session. |
| Canonical-only session on selectedDate | No canonical saved result: its record is not an input. A same-name catalog definition may still match. | Catalog visibility does not close canonical saved-evidence invisibility. With no matching catalog/other domain, global no-results is reachable. |
| Legacy + canonical, same date/exercise | Only legacy row/catalog are considered. | Canonical provenance and additional observations are lost from discovery. |
| Multiple canonical sessions same date | None are Search inputs. | Session multiplicity is invisible, not deduped or unified. |
| Repeated entries in one canonical session/across sessions | None are Search inputs. | Entry multiplicity is invisible. |
| Repeated legacy exercise rows, distinct row IDs | Separate matching results before cap. | Current unit is row occurrence, not unique exercise. |
| Canonical unavailable/invalid/wrong namespace | No canonical attempt or canonical state exists in Search. | Cannot infer availability or absence from legacy results. |
| Legacy unavailable/not-ready/loading, no cached current daily data | Daily fallback Workout[] is empty. Catalog state may independently be ready. | No Workout readiness reaches Search; catalog success cannot prove saved-workout empty. |
| Both persisted sources unavailable | Canonical still absent from graph; legacy fallback empty. Catalog can show definitions or no match. | No complete persisted-source claim is possible. |
| Account switch | Host remount + account-bound daily/static keys change; old account is not an intended daily input. | No canonical generation/device fence exists because Search does not read canonical. Global Health recents remain a separate legacy limitation. |
| Historical row outside selectedDate | Excluded by local daily filter, even though underlying readAll touched it. | Global Search has no Workout history source; switching Health selectedDate changes the searchable saved rows. |
| Home today differs from Health selectedDate | Search still receives dateStr daily rows, not Home's today B1 result. | Do not silently inherit Home today as Search coverage. |

Current loading/error UI supports catalog readiness (`healthBlocksState`) and recipe/todo states. `empty.noResults` is result-card cardinality, with stateful groups able to suppress its generic display. It does not encode paired Workout coverage. A ready catalog and absent Workout state can therefore allow a false “no results” impression for saved Workout evidence. The host's 80ms `isSearching` indicator is query animation, not proof that a persisted read completed.

### Representability/source probes (not runtime acceptance)

An in-memory Node/Vite SSR module probe, without a saved test or product file change, invoked the actual V1 validator and current pure Health result builder. Distinct UUID-v4 session/entry/set IDs were used; two entries had the same frozen exercise name, and all sets had `done=false` with nullable reps/assistedReps. Results:

- repeated entries and two sessions on the same localDate are valid;
- a nonempty saved session with zero completed sets is valid;
- empty entries, empty sets and duplicate UUID-value entry identity are rejected;
- `buildHealthSearchResults(term, [], [], now)` emits zero results; canonical data has no parameter/path into it;
- two matching legacy rows emit `workout-w1`, `workout-w2`;
- catalog-only matching emits `exercise-block`, not saved `workout`.

This confirms fixture shape and pure-source consequences, not mounted Search behavior or future acceptance. No full suite, public UI or physical-device acceptance was executed for this document.

## 6. Identity and plausible result granularities

Existing composite projection already provides independent read identities (E21):

- legacy: JSON tuple `['legacy', accountId, rowId]`;
- canonical session: `['canonical', namespaceKey, generationId, lowerCase(entityId)]`;
- canonical entry observation: proposed `['workout-search-entry', canonicalReadId, lowerCase(entry.id)]`;
- legacy observation: proposed `['workout-search-row', legacyReadId]`;
- set detail identity, if later needed: session readId + entry UUID + set UUID, not ordinal/value;
- date bucket: account + explicit semantic date/range scope, not session identity.

Preserve original payload UUID spelling; normalize only technical UUID-value identity. Canonical entry/set uniqueness is enforced within the session, not across sessions, so the session component is mandatory. Date/name/content cannot replace identity. Source-qualified rows never collide with canonical entries, even with identical raw IDs/content/date. Multiple same-day sessions, repeated entries and repeated legacy rows remain separate observations. No adopted legacy↔canonical identity relation is assumed.

| Option | Matching / identity | Navigation and duplicate/count consequence | Assessment |
| --- | --- | --- | --- |
| One canonical session result | Match any entry snapshot; canonical readId. V1 has no session title. | Date-level only; multiple matching entries collapse into a session card; count sessions vs legacy rows is asymmetric. | Plausible public option, `PRODUCT_DECISION_REQUIRED`; cannot invent a representative session name/default entry. |
| One canonical entry result | Exact frozen name; canonical readId + entry UUID. | Date-level target; all repeated entries/sessions preserved. Count entries, not sessions. | Suitable **technical non-public preview** next to source-qualified legacy rows; public use remains undecided. |
| One date result | Explicit account/date bucket. | Date navigation; source multiplicity requires nested evidence, not content dedupe. Counts dates only. | Redefines current row-result unit; `PRODUCT_DECISION_REQUIRED`. |
| Source-separated heterogeneous session/row results | Each source's identity remains. | Honest provenance but heterogeneous counts and match summaries need copy. | Possible later public approach, `PRODUCT_DECISION_REQUIRED`. |
| Set results | Entry/set UUID tuple and numeric matching rules. | No set deep link exists; mixes field search with exercise occurrence discovery. | Not current intent or next preview scope. |

Current Health Search is a **mixed domain abstraction**: selected-day saved legacy rows plus reusable exercise catalog definitions. It is neither all saved sessions nor all workout dates. Global palette naming alone does not establish all-history coverage. The preview must visibly separate saved observations from catalog definitions; matching a catalog entry is never evidence of persistence.

## 7. Date coverage and scan cost

Current saved Workout coverage is **one AppContent selectedDate**, not necessarily today. `Workout[]` drops date at adaptation; its surrounding SWR key is the date authority. There is no Search-owned historical range read, Health range reuse or canonical scan. The legacy local loader reads all verified account datasets before filtering one day, but only that day's rows reach Search. Physical I/O breadth is not Search coverage.

B1 returns one paired selected-day result. It can cover an explicitly selected-day Search only when its account/date/lifetime agrees; Home may simultaneously request today while Search still means historical Health selectedDate. Blind reuse is wrong. It cannot fulfill unspecified global history.

The merged range foundation loads **all locally present verified legacy rows + all active canonical sessions** for one account/device/current generation, then derives inclusive dates without another source scan. The product hook currently exposes only Previous's bounds and the current month, and is enabled only for Health. Neither exposed view is a general Search snapshot: selectedDate can be outside the month or Previous window; month may include dates after selectedDate. Search must not take their union and claim history completeness, or read `currentSnapshot` directly without the final scope fence.

Canonical `queryWorkoutSessionsByLocalDate` calls `listWorkoutSessions` and filters in memory. The latter uses the existing namespace/generation/domain index and validates every active entity. Thus D separate date queries cost D **whole-domain scans**, not indexed date queries. Range/all-locally-present discovery can use **one** domain scan; date filtering is pure. An invalid active V1 even outside the desired date can make that canonical source unavailable; this task cannot promise selective salvage or a new date index. Tombstones are excluded upstream.

No new index/schema is needed for the bounded selected-day preview. “Bounded” means one current owner/snapshot and fixed derived-view cardinality, **not** a cap on stored history bytes. Existing source loading is O(all verified legacy data + active canonical session/entry/set bytes); Search matching is O(observations in its selected day). Memory remains a constant number of current source/derived views, not a Map of visited dates or query keys. A future all-history public rollout still needs large-data/physical-device performance decisions; if it requires an index, that is a separately reviewed schema blocker, not authorization here.

## 8. Reader ownership alternatives

L = one verified legacy snapshot read; C = one canonical domain scan. Counts exclude metadata verification and unrelated shell datasets. Recovery is distinct from normal load.

| Option | Normal source cost / coverage | Ownership, cache/listeners and fences | Decision |
| --- | --- | --- | --- |
| A. Reuse selected-day B1 | +0L/+0C when already current for exact requested date; otherwise 1L/1C. One date only. | Existing B1 lifetime/ABA/device/generation and bounded recovery; no new cache/listener if same owner. Home today vs historical Search can conflict. | Not the selected owner: forcing B1's one date would change Home/Health budgets or need a second reader/conditional architecture. |
| B. Reuse/extend existing range snapshot | 1L/1C if no current range owner; +0L/+0C when sharing one current snapshot with Health. Can derive exact Search date or a future approved range. | One AppContent-owned coordinator; fixed derived views; range hook has zero listeners; verified derive publication. Needs narrow Search-view/lifetime extension, not exposing raw snapshot to palette. | **Selected for the private preview.** Coverage is explicit; no second range coordinator/scan. |
| C. Search-specific paired range reader | 1L/1C in addition to any Health range owner, even at same account/range. | Another lifecycle/cache/focus policy/currentness implementation; partial/navigation can be correct but duplicate scan ownership persists. | Reject for next slice while B can safely supply evidence. |
| D. Derive another already-owned snapshot | +0 source scans if exact scope/date coverage is authoritative. Existing Home projection has presence/counts, B1 only its requested date, useDaily only legacy rows. | Must retain source status, identity and final scope fencing; cannot use aggregate counts as records. | No currently wired alternative independently covers Search's requested date in every tab; B is the viable snapshot reuse. |
| E. Keep legacy-only | +0 canonical scans; current daily legacy reads/caches unchanged. | No new owner/listener; canonical gap and unavailable/empty ambiguity remain. | Safe fallback with honest limited claims, but does not resolve the characterized reader gap. |

All viable composite choices need account/date or range tokens plus namespace/generation/device checks, typed date navigation and partial-state semantics. Source-aware models alone do not establish currentness. Range foundation metadata can be reused, but raw snapshot access, Health-only gate assumptions and stale visible-state exposure cannot be inherited without mounted consumer tests.

### Accounted preview budget

- Normal new shared range load: **1L + 1C**. Health Previous/calendar/Search projections from that source add **0 canonical scans**. Search changing term/rendering adds 0 source reads. A result click performs no preliminary Search source scan; ordinary destination Health/B1 lifecycle reads are separate, not silently counted as zero.
- Existing useDailyData still separately reads selected-day legacy data when ready; do not change it in this slice. Search alone in a non-Health/Home tab can therefore total **2L + 1C**, including daily legacy. If daily is ineligible, the preview pair remains independent (legacy can be unavailable).
- Home with Home B1 preview + Search preview: daily 1L + Home B1 1L/1C + shared range 1L/1C = **3L + 2C**. Search does not silently consume Home's different day. Eliminating the second canonical scan would require a separately reviewed B1/range consolidation, not this slice.
- Health B1 + Search preview, whether Health range child is ON or OFF: daily Search legacy 1L + B1 1L/1C + one shared range 1L/1C = **3L + 2C**. When the Health range child already owns a current snapshot, Search adds no range source load; that daily legacy activation is still accounted for.
- Date/range change within a live shared snapshot: pure range derivation + metadata verification, 0L/0C for that shared snapshot unless currentness fails and bounded recovery reloads. Existing daily/B1 owners may perform their normal new-date reads independently; this is not a zero-total-I/O claim. Last-owner close tears down; reopen loads one fresh pair. No per-date/result/preliminary-click Search scan or persistent multi-date cache.
- Navigation from a tab with no current B1 owner can enable Health B1 and cost its normal 1L/1C pair. Home today -> historical Health selectedDate can likewise change B1's requested date. If Health range child becomes eligible while the Search-shared range owner is already current, preserve that owner continuously and derive Health views with 0 extra range source scans; if no valid owner survives, a new normal range pair is required. Test these handoffs separately from per-click preliminary I/O.
- Existing coordinator permits at most two load attempts for stale generation; outer range hook permits one extra automatic currentness recovery before unavailable. The future Search publication must retain a finite combined ceiling (at most **4L/4C attempts** per automatic episode when both layers reach reads), not claim all failure recovery is one pair. Explicit retry/lifecycle events start a new episode; query typing must not.

AppContent already has one bootstrap handler and a coalesced range-mode focus/visibility pair. Extend that ownership condition to the shared Health-or-Search range owner; do not install Search listeners. When B1 also runs, use its existing `managedLifecycle` option under that shared range lifecycle so B1 suppresses duplicate focus/visibility/bootstrap listeners. Gate OFF preserves the existing option/eligibility path. Views, cards, result matching and range hook own **zero** new browser listeners. Existing palette keyboard/modal listeners remain unrelated and unchanged.

## 9. Partial/error/isolation and result-count truth

This is the future preview contract, not today's catalog-only readiness pipeline. Pass a typed Workout source state separately from catalog readiness. Do not squeeze paired-source completeness into `healthBlocksState`, or fabricate `READY_EMPTY` from an empty array.

| Paired read / publication | Matching result treatment | Truthful preview message |
| --- | --- | --- |
| Both sources success, matches | Preserve every matching source observation and identity. | Complete **selected-day local persisted-source** match set; not all-history/cloud/global completeness. |
| Both success, no matches | Zero matches is verified for the explicit day and name-only predicate. | No matching saved observations on this date; catalog/other domains have their own state. |
| Legacy success, canonical error | Only legacy matches survive. | Partial; canonical unavailable. Zero legacy matches is not verified no-result. |
| Canonical success, legacy error | Only canonical entry matches survive. | Partial; legacy unavailable. Zero canonical matches is not verified no-result. |
| Both error / final unavailable | No persisted results. | Unavailable, with retry; not no-results. |
| Invalid V1/envelope/duplicate source identity | Reject the affected whole source under existing projection rules; other verified source may survive. | Partial/error, never salvage invalid canonical entries as persistence evidence. |
| Account/namespace/generation isolation error | Fail closed, hide **all** paired results, including otherwise valid legacy. | Isolation-unavailable; no cross-owner partial publication. |
| Loading / invalidated / changed range | Hide old settled match results until verified current publication. | Loading; not empty. |
| Superseded account/date/enable lifetime/in-flight pair | Drop continuation; no old results or error overwrite. | Current lifetime owns its own loading/settlement. |

Distinct query matches may be partial even if some cards survive. Catalog matches never upgrade partial persisted state to complete. Generic global “no results” must be suppressed while the enabled preview's persisted sources are loading/partial-zero/error/isolation-unavailable, even when catalog is ready-empty. No stale results may remain clickable during invalidation. The existing 80ms query animation is not a source lifecycle.

Preview counts mean **matching legacy-row observations** and **matching canonical-entry observations**, separately; canonical sessions represented may be an independently labelled technical count, not an additive workout total. Catalog results stay definitions. If ordinary palette totals include preview cards, they must explicitly mean rendered result items, with partial/lower-bound status where applicable. They are not unique exercises, dates, sessions or real-world workouts. No content/date/name dedupe or cross-source addition labelled “workouts.” Public unified count policy is still undecided.

## 10. Product decisions and activation inventory

The following are explicitly **`PRODUCT_DECISION_REQUIRED`** before public Search canonical coverage. They do not silently become approved through the diagnostic preview:

| ID | Unresolved public decision | Private preview limit |
| --- | --- | --- |
| SEARCH-PD01 | Saved-result unit: sessions, entries, dates, source-separated heterogeneous records; relationship to existing catalog results. | Technical row/entry observations only, not a public default choice. |
| SEARCH-PD02 | Coverage window: selected day, selected month, explicit bounded history, all locally present history; visible global claim. | Exact Health selectedDate labelled with bounds. Never assume all history. |
| SEARCH-PD03 | Source provenance copy/layout and mixed same-exercise/date behavior; distinction between saved data and definitions. | Explicit legacy/canonical diagnostic source labels, no merge/dedupe. |
| SEARCH-PD04 | Navigation depth and whether public Search should open Health, note, editor or a future session selector. | AppContent-owned validated date/month navigation only; no Notes side effect or session selection. |
| SEARCH-PD05 | Partial/unavailable/loading/isolation language and accessible empty-state behavior, including generic no-result suppression. | Technical source-state labels with no unsupported absence claim. |
| SEARCH-PD06 | Counts, ranking, truncation/paging and treatment of many same-day sessions/entries. | Source-separated observation counts; deterministic technical ties, all matching observations retained with virtualization. |
| SEARCH-PD07 | Match fields beyond saved exercise name: frozen canonical tags/type, legacy fallback, values/date, possibly future memo model. | Name-only, current legacy matching asymmetry retained. V1 is not extended. |
| SEARCH-PD08 | Recent-history account isolation and persistence of canonical titles/technical targets. | New preview kinds do not write recent history; existing non-preview behavior unchanged. |
| SEARCH-PD09 | Public local-only/device/offline/large-history performance claims and physical QA; any future indexed/ranged data access need. | Local active-generation evidence only, no cross-device or cloud completeness promise. |
| SEARCH-PD10 | Separate public-reader activation review, REL05G5A-001 disposition, interaction with PR/cues/metrics/export claims. | All gates OFF; no writer/data-plane authority inferred. |

Three milestones remain distinct: (1) reviewed default-OFF diagnostic reader implementation; (2) separately approved public Search activation after these decisions and QA; (3) writer cutover after all writer/reset/rollback/coexistence blockers. None implies the next. Public reader dependencies listed in the merged Home/reader preparation are not closed by a document or preview PR.

## 11. Durable save/delete currentness and Home/B1 implications

Current real Health save/delete passes the operation's account to `onLocalWorkoutCommitted` **at durable local commit**, before the old UI continuation guard (E10 L801/L999). AppContent's stable callback currently routes only when a shared B1 owner is mounted for that account, invalidates range first if Health range is enabled, then retries B1 (E01 L337). Search is not a recipient today; a late A1 durable commit on another tab can require a future Search-only recipient even with no current B1 owner. Existing `mutateDaily` is not a verified canonical snapshot invalidator and an old Health UI continuation can legitimately be suppressed.

Future routing must keep the existing payload-free, account-tagged notification and add the current shared range/Search owner to the recipient check. On matching current account, invalidate the range coordinator and Search visible publication **synchronously before scheduling** its new pair; invalidate current B1 if eligible, independently. Do not edit arrays optimistically, retain committed payload in Search, mutate cache records, queue replay with no owner, or alter writer/persistence behavior.

Required timeline: A1 Health save/delete starts -> account B -> A2 Search preview -> old A1 durable commit -> matching **current A2** shared snapshot is fenced -> fresh pair sees commit -> old A1 pair/UI cannot publish. Current B + late A is no-op. A callback must not permanently discard a valid same-account durable notification merely because its originating UI lifetime is old, nor accept a stale Search result-click callback simply because account string A returned.

B1's render-time scopeVersion, request sequence, mount/enable epoch, independent device/generation checks and bounded recovery are useful **patterns**, not a mandate to reuse its snapshot for another date. Range coordinator already supplies account/device/generation and final derived-view fences. The proposed Search view must also publish an explicit owner/child-enable/date token and use it in its render-visible guard and click handler; existing Health range shape alone is insufficient to prove a new hidden consumer's ABA. Keep B1 cacheKey API P3 unchanged. Do not expose coordinator/database/currentSnapshot to GlobalSearchHost/Home/HealthView. No Home integration expansion or B1/range consolidation is part of the next slice.

## 12. Exactly one proposed bounded next implementation slice

**`REL_05G5B2B2D1_SEARCH_COMPOSITE_SELECTED_DAY_PREVIEW`** — gated, non-public, read-only saved-observation Search preview. This handoff needs its own implementation authorization/review; it is not implemented here.

1. **Exact owner:** the single AppContent invocation of `useHealthWorkoutRangeSnapshot`, narrowly extended to supply an optional verified Search selected-day view. One `WorkoutReadSnapshotCoordinator` owns the paired source for current account/device/generation; no second Search reader/coordinator. Health Previous/month consumption retains its own Health-only eligibility even if Search alone keeps the source owner alive.
2. **Gate:** new static `SEARCH_WORKOUT_COMPOSITE_READER_ENABLED = false`, child of `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED`. Preview eligibility = parent AND Search child AND account present AND palette open AND nonempty query. Do not require Health range child ON to use its dormant foundation. All existing production gates remain false. No env/localStorage/query/remote-config activation; parent OFF + child ON gives zero preview I/O. Existing `searchHasQuery` already means open + nonempty; keep query text in the host and avoid an effect on every keystroke. Gate OFF preserves the current graph/navigation/recents.
3. **Coverage:** immutable `[dateStr, dateStr]` from AppContent Health selectedDate, not Home today or month union. Visible diagnostic heading identifies the day and local-only scope. Source owner enabled = existing Health range eligible OR Search preview eligible; selection/range changes derive from its current snapshot, not reload each date. Search child close/open lifetime is independently fenced even when Health retains the source owner.
4. **Inputs/matching:** verified source-qualified `WorkoutRangeView.result` only, never Workout[] conversion. One legacy row observation by its available display name; one canonical entry observation by frozen `exercise.name`, exact/prefix/substring scoring consistent with current name matching. No catalog enrichment of frozen canonical snapshots, no drafts/metrics/sets/memo/date matching. Catalog definitions retain a separate presentation/state, not persistence evidence. In the private branch, source-aware saved observations replace that branch's legacy saved-row cards rather than duplicating them; other domains and gate-OFF behavior remain unchanged.
5. **Identity/presentation:** §6 tuple identities; explicit localDate, source and read-only capability on a discriminated preview result. Preserve every same-day session/entry/legacy-row observation; use existing virtual list rather than content dedupe, synthetic session title or arbitrary default session. Technical ties are stable by date/source/readId/entry ID, not claimed chronology. Source-specific diagnostic counts (§9); public granularity/count/ordering still undecided.
6. **Navigation:** explicit preview callback owned by AppContent. Validate calendar localDate and current account/child-lifetime/publication token first; set selectedDate and currentDate from the same locally constructed date using existing timezone/calendar interpretation; switch to Health. No per-click canonical query, session/entry selection, editor focus, Notes helper, canonical recent write or data mutation. A technical canonical entry ID remains internal; copy says date-level destination. Old callback after A->B->A or close/reopen cannot navigate.
7. **Publication/errors:** optional Search view has render-time account/date/enabled scope version, owner epoch and publication sequence; final `deriveRange` verification is mandatory. Hide superseded/currently invalidated data synchronously. Preserve whole-source invalidity and global isolation failure (§9), current bounded recovery and manual retry, generic no-result suppression. Do not pass fabricated currentness tokens as authority.
8. **Lifecycle/read budget:** §8 exact budgets, one shared source, fixed current derived views. No key/Map per query/date or persistent canonical cache. Extend existing AppContent bootstrap/focus/visibility fanout, coalesce same focus event, use B1's managedLifecycle only where this shared owner runs. Range hook/palette/card have no new Workout listeners. Gate OFF yields no listener/read budget change.
9. **Durable invalidation:** §11; current account recipients include B1 and shared range independently, source fence before React scheduling, no-owner no-op. Existing Health persistence and durable callback payload remain unchanged; mounted real save/delete tests are required.

Expected production-file scope (paths are a proposed ceiling, not permission to edit now):

| File | Narrow expected change |
| --- | --- |
| `frontend/src/components/AppContent.tsx` | Shared range eligibility, optional Search bounds/view, managed listener/current-account durable fanout, fenced date/month callback and dedicated Search props. Preserve Health/Home eligibility separately. |
| `frontend/src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts` | Optional Search derived view and publication/child-lifetime fences; single coordinator, fixed state, unchanged existing Health-only API behavior when absent. |
| `frontend/src/components/views/features/search/searchWorkoutCompositeConfig.ts` | Static false child and parent fail-closed eligibility. |
| `frontend/src/components/views/features/search/searchWorkoutCompositeProjection.ts` | Pure source-aware selected-day observation/result/status projection; no reads/writes/listeners. |
| `frontend/src/components/views/features/search/searchProjectionModels.ts` | Additive discriminated preview results/status; no canonical cast into legacy Workout. |
| `frontend/src/components/views/features/search/GlobalSearchHost.tsx` | Dedicated typed preview props/currentness and existing open/query-presence signal. No reader handle. |
| `frontend/src/components/views/features/search/buildSearchProjection.ts`, `hooks/useSearchProjection.ts` | Optional private preview branch and scoped states/counts; legacy builder remains gate-OFF path. |
| `frontend/src/components/views/features/search/components/SearchWorkspacePalette.tsx`, `SearchResultCard.tsx` | Source/date diagnostic section, source-status empty/count rules, fenced preview navigation without old Notes/recent path. |
| `frontend/src/lib/i18n/{keys,en,ko,ja}.ts` | Only precise preview/local-date/source/unavailable labels, not public rollout promises. |

Expected tests: pure projection/config tests; Search projection/palette keyboard/click/readiness/count regressions; optional range-hook and mounted AppContent ownership/budget tests; real save/delete A1->B->A2 Search races; close/reopen enable ABA, date/generation/device/account stale publication and navigation tests; gate-OFF/parent-OFF-child-ON regression; Home/B1/range/legacy Search regressions; V1-valid repeated-entry/multiple-session/zero-done fixtures plus invalid/isolation cases. Acceptance is §14, not already PASS.

Forbidden next-slice scope: `useDaily.ts`, shared Workout array/type conversion, `HealthView.tsx` writer/navigation redesign, persistence helpers, V1/validator, DB version/stores/indexes/keyPaths, backend, `WorkoutSessionRepository`, low-level selected-day/range reader or authority protocol changes, canonical entity/outbox mutation, bind/push/pull/resync/reset, G6, metrics/analytics/PR/cues/Archive/export, public activation, persistent canonical recents or multi-date cache, public all-history semantics, and B1 cacheKey redesign. If implementation requires one of these, stop/report the evidenced scope blocker, not silently widen.

## 13. Frozen boundaries and live-writer blocker interaction

At the pinned source all three production constants are false: `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED`, `HOME_WORKOUT_COMPOSITE_READER_ENABLED`, `HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED`. Home is merged but default OFF. Canonical writer, Workout bind/push/pull/full-resync/reset and G6 remain inactive; the existing G5A authority control-plane bootstrap is not reader or data-plane activation. No backend runtime, DB v7/schema v1, store/index/keyPath, WorkoutSessionV1 or validator change is proposed or made. Existing reader initialization/verified legacy import recovery is not a new canonical entity/outbox writer; do not promise every underlying metadata/recovery operation is byte-level read-only.

All seven live-writer blockers remain **OPEN**:

1. `G5B_UNBOUND_PRE_RESET_CREATE_BLOCKER` — Search cannot repair creation-era epoch proof.
2. `G5B_ROLLBACK_VISIBILITY_BLOCKER` — a default-OFF preview does not make old rollback clients see new canonical writes.
3. `G5B_OLD_NEW_WRITER_COEXISTENCE_BLOCKER` — preserving source-separated observations does not fence old writers or define adoption/dedupe.
4. `G5B_UI_IDENTITY_GAP` — technical Search identity helps read discovery, not product editor/session identity selection or writer cutover.
5. `G5B_CANONICAL_FIELD_GAP` — matching existing snapshots does not decide field/memo ownership or extend V1.
6. `G5B_ANALYTICS_PROJECTION_BLOCKER` / broader projection integration — this characterizes another discovery gap and would provide evidence toward reader coverage; metrics/PR/cues/export/public claims remain separate, so the blocker is not closed.
7. Reset-fenced local edit policy (no separate ID assigned in the pinned preparation) — reader invalidation and date navigation are not a reset-fenced write policy.

`REL05G5A-001` remains **ACTIVATION_PREREQUISITE**. B1 cacheKey P3 remains **OPEN_NON_BLOCKING**. Do not infer either is resolved from Search gating, fixture validation or CI. Remote/cloud availability does not prove local Search coverage, and a local preview cannot promise another physical device sees unsynced canonical records.

## 14. Future acceptance matrix

All rows are **REQUIRED / NOT EXECUTED** for the proposed future implementation. This document is not runtime acceptance evidence.

| ID | Case | Required future result |
| --- | --- | --- |
| SEARCH-C01 | Legacy-only match | Exact persisted row identity, explicit legacy source/date, read-only observation; catalog separate. |
| SEARCH-C02 | Canonical-only match | Frozen canonical entry name/identity visible for selected day; no legacy conversion. |
| SEARCH-C03 | Mixed same date/raw IDs/name | Both source observations retained, no content/date/name dedupe or unqualified workout total. |
| SEARCH-C04 | Multiple canonical sessions | All matching entry observations retain their different session identities. |
| SEARCH-C05 | Repeated canonical entries | Distinct entry UUIDs preserved within/across sessions; set IDs/ordinals not used as entry identity. |
| SEARCH-C06 | Repeated legacy rows | Distinct row IDs remain distinct; duplicate source identity fails source validation, not silent dedupe. |
| SEARCH-C07 | No match, both source success | Verified name-only no-match for explicit selected date, not all-history empty. |
| SEARCH-C08 | No match, one source unavailable | Partial-zero shown; generic no-result suppressed, no verified absence. |
| SEARCH-C09 | Partial with surviving matches | Valid surviving source cards remain, missing-source state visible, counts qualified. |
| SEARCH-C10 | Both sources unavailable | Unavailable/retry, no empty claim and no clickable stale cards. |
| SEARCH-C11 | Invalid canonical V1/envelope/identity | Whole canonical source error; valid legacy may survive. Empty entries/sets invalid, nonempty zero-done valid. |
| SEARCH-C12 | Isolation failure in either source | All paired results hidden; never cross-owner partial. |
| SEARCH-C13 | Account switch | Render-time hide, source owner closed/superseded, old result/error/click cannot affect new account. |
| SEARCH-C14 | A->B->A, slow open/read/derive | Old A1 cannot publish/click as A2; current A2 durable invalidation still works. |
| SEARCH-C15 | Selected date/range changes | Exact bounds/currentness verified; same snapshot re-derived without source scans; outside-day records excluded. |
| SEARCH-C16 | Stale in-flight load/derive/retry | Synchronous invalidation fences old publication; old continuation cannot invalidate newer snapshot. |
| SEARCH-C17 | Real durable local save | Fresh current matching-account Search pair sees commit; late UI/toast cannot overwrite; no-owner no queued replay. |
| SEARCH-C18 | Real durable local delete | Same fence/routing as save; removed legacy observation absent after verified refresh, no source-array patch. |
| SEARCH-C19 | Current B + late A save/delete | No invalidation/publication into B. |
| SEARCH-C20 | Gate OFF | Current legacy Search source/results/navigation/recents intact; zero preview reads/listeners. |
| SEARCH-C21 | Parent OFF + Search child ON | Fail closed; zero preview reads/listeners, regardless of query or tab. |
| SEARCH-C22 | Normal owner/source budget | New owner 1L/1C; current Health shared snapshot adds 0L/0C; Home/Health combined budgets exactly §8. |
| SEARCH-C23 | Rerender/card/minute/query typing | Zero additional canonical scans/source loads; only pure matching/projection changes. |
| SEARCH-C24 | Mouse/Enter result navigation | Fenced exact localDate+month Health target; no title-derived date, Notes creation, preliminary Search canonical query, session/edit selection or canonical recent write. Ordinary destination B1/range lifecycle budget follows §8. |
| SEARCH-C25 | Home today != selectedDate | Home still today; Search explicitly selectedDate; no forced B1 date takeover. |
| SEARCH-C26 | Child close/reopen while Health owner persists | Search lifetime token invalidates old visible rows/clicks; derive current view without duplicate source owner. |
| SEARCH-C27 | Generation/device transitions/offline/bootstrap failure | Final scope fence or bounded unavailable; no identity repair/cross-device claim or dependency on remote G5A readiness. |
| SEARCH-C28 | Repeated automatic currentness failures | Finite combined recovery ceiling, then settled unavailable/manual retry; typing does not reset budget. |
| SEARCH-C29 | Listener/read lifetime and shared event fanout | One existing shared bootstrap/focus/visibility lifecycle, B1 managed where necessary; no Search listeners or per-date cache growth. |
| SEARCH-C30 | Canonical-to-Workout[] conversion | None; typed source-aware preview contract throughout. |
| SEARCH-C31 | Writer/data plane/schema/backend | Zero new entity/outbox/writer/bind/push/pull/resync/reset/G6 calls; DB7/schema1/V1/backend frozen. |
| SEARCH-C32 | Catalog, other domains, gate-OFF regressions | Definition results not persistence evidence; existing notes/planner/recipe/archive behavior unchanged. |
| SEARCH-C33 | Public claim/debt boundaries | Technical preview not public rollout; seven blockers OPEN, REL05G5A-001 prerequisite and B1 P3 unchanged. |

## 15. Docs-only validation and publication boundary

Characterization validation: exact merged baseline and naming inspected; current source anchors checked against the pinned main; pure validator/builder probes above completed; valid proposed canonical fixtures obey frozen V1; source identity/date/multiplicity and costs are not conflated; partial-zero/isolation and currentness are not labelled absence; no schema/backend/writer change is implied. The complete document was reviewed for contradictions between one-day preview scope, physical whole-domain reads, shared ownership and public undecided semantics. `git diff --check` is required before publication.

Only this Markdown artifact is intended for commit/push/Draft PR. Hosted CI on its publication head is repository validation, not proof that the proposed Search runtime acceptance matrix ran. Do not mark Ready, merge, enable auto-merge, activate any gate/writer/data plane or start G6. Stop after docs publication and initial exact-head CI observation.
