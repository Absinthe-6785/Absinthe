# REL-05G Workout exercise comparison truth characterization

## 1. Baseline, authorization, and result

- Task: `REL_05G_WORKOUT_EXERCISE_COMPARISON_TRUTH_CHARACTERIZATION`.
- Naming status: **PROPOSED_WORKSTREAM_NAME**, not an established numbered REL workstream. No E/F or new D-line number is assigned.
- Repository: `Absinthe-6785/Absinthe`; canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`.
- Authoritative starting main: `7661169b2c0e3f2521fed987b957695d3f7c9ba7` (PR #741 merge).
- Authorization: `NEXT_WORKSTREAM_CHARACTERIZATION_ONLY`, source inspection plus this single documentation artifact and its Draft publication.
- Result / maximum next technical ceiling for complete-source comparison: **COMPARISON_BLOCKED_BY_PRODUCT_DECISION_AND_LEGACY_ISOLATION_PREREQUISITE**.

The current mounted per-exercise comparison reads verified **legacy** history only. Canonical-only observations cannot populate its `prev_sets` or `pr_kg`. Existing composite history cards are a different consumer and do not change that fact. Product semantics remain undecided; source-symmetric complete-source comparison additionally needs the legacy ownership-classification prerequisite in section 10. Explicitly source-scoped alternatives do not automatically require that fix. No comparison implementation or activation is authorized by this document.

Docs-only correction: `REL_05G_WORKOUT_EXERCISE_COMPARISON_TRUTH_CHARACTERIZATION_CORRECTION`, addressing the single P2 finding `REL05G-EXCOMP-CHAR-001` from the review of head `b13490db46929ad79ce3ac1500df234068f3bd6d`. This corrects the characterization, not the underlying runtime. The next step is a focused independent rereview of that finding, then a bounded product-decision package if accepted.

G5B2 preparation/projection, B1 selected-day reader, range snapshot foundation, Previous/Calendar, Home, and Search D0/D1 diagnostic work are CLOSED_IN_MAIN at their approved default-OFF scopes. Do not reimplement them. `SEARCH_COMPOSITE_DIAGNOSTIC_LINE_CLOSED` and `NO_NEXT_D_LINE_IMPLEMENTATION` remain in force.

Terminology used below:

- `SOURCE_FACT`: directly observed current code behavior, not a newly approved product policy.
- `SAFE_DERIVATION`: a conclusion from validated evidence within explicit source/date coverage, not identity/adoption authority.
- `PRODUCT_DECISION_REQUIRED`: changing or extending the comparison meaning requires approval.
- `UNSUPPORTED`: evidence or an implemented contract is absent; do not fabricate it.

## 2. Source graph and ownership

Source locations below are repository-relative and were inspected at the pinned baseline.

| Boundary | Source | Observed responsibility |
| --- | --- | --- |
| Mounted editor / cache / triggers | `frontend/src/components/views/HealthView.tsx` (`prevData`, `ensurePrevData`, `fetchPrevForBlock`, routine/add handlers, card rendering) | Account/date inputs; block-keyed React cache; draft PR and previous cues |
| Transport choice | `frontend/src/components/views/features/health/prevWorkoutFetch.ts` | LOCAL_FIRST batch lookup, or inactive per-block remote fallback |
| Authority policy | `frontend/src/lib/syncAuthority.ts` | `health_workouts` uses LOCAL_FIRST |
| Local lookup | `frontend/src/lib/healthLocalRuntime.ts::readLocalPreviousWorkout` | One verified dataset read; exact block ID and strict prior-date filter |
| Verified legacy storage | `frontend/src/lib/healthLocalRepository.ts::HealthRepository.readAll`, `readAuthoritativeDatasets` | Account snapshot/import verification, content validation, ordered datasets |
| Legacy validation/order | `frontend/src/lib/healthRecoveryExport.ts` | Numeric-or-empty sets, UUID row/block ownership evidence, dataset date/ID order |
| Official mounted badge | `frontend/src/components/views/features/health/computeWorkoutPrBadge.ts`, `WorkoutPrBadge.tsx` | Draft maximum kg versus historical threshold; PR/difference rendering |
| Previous micro-cues | `frontend/src/components/views/features/health/previousMicroCue.ts` | Latest-row best completed set, compatible per-set references |
| Count-based suggestions | `workoutSetCount.ts`, `routinePresets.ts::routinePresetPlannedSetCount`, `useRoutinePresetController.ts` in that Health directory | Fresh empty-set count and preset fallback, not historical value copying |
| Units / assistance | `healthWeight.ts` in that directory; `frontend/src/lib/healthAssistedReps.ts` | Saved source/display units and total/assisted/unassisted semantics |
| Editable shape | `frontend/src/types/index.ts`, `useHealthWorkoutDraft.ts` in the Health directory | Legacy `Workout[]`, set numbers, scoped transient draft |
| Canonical contract | `frontend/src/lib/workoutSessionV1.ts`, `workoutSessionRepository.ts` | Frozen exact V1 records and active envelope reads |
| Shared paired snapshot | `frontend/src/lib/workoutRangeReader.ts`; `verifiedWorkoutRangeSnapshot.ts`, `useHealthWorkoutRangeSnapshot.ts` in the Health directory | D0 isolation, all-active canonical scan, verified legacy snapshot, bounded derived views |
| Composite identity/partial status | `compositeWorkoutReadProjection.ts` in that directory | Source-qualified records; complete/partial/error; paired isolation failure |
| Separate Previous browser | `previousWorkoutSession.ts`, `previousWorkoutProjection.ts`, `compositePreviousWorkoutProjection.ts`, `PreviousWorkoutView.tsx`, `CompositePreviousWorkoutView.tsx`, `PreviousWorkoutSheet.tsx` | One-year date browser; weekday initial selection; source-separated cards |
| Shared freshness | `frontend/src/components/AppContent.tsx` | Range owner, commit notification, bootstrap/focus/visibility fanout |
| Date/copy | `frontend/src/hooks/useNow.ts`; `frontend/src/lib/i18n.ts`, `i18n/en.ts`, `i18n/ko.ts` | User-zone selected date key and mounted labels |
| Inactive API reference | `backend/main.py::get_prev_workout` | Authenticated user predicate, strict prior date, last ten legacy rows |

```text
Health editor/routine effects or explicit add/load action
  -> ensurePrevData(block IDs) / fetchPrevForBlock(one block)
  -> fetchPrevWorkoutForBlocks(..., formatDate(selectedDate), ..., user.id)
  -> LOCAL_FIRST: readLocalPreviousWorkout(account, IDs, beforeDate)
  -> HealthRepository.readAll() -> verified account legacy datasets
  -> workout_logs: block_id === requested ID AND date < beforeDate
  -> { prev_sets, prev_date, pr_kg } keyed by block ID
  -> prevData React state / prevDataRef
     -> previous-best and per-set micro-cues
     -> fresh-set count / routine fallback
     -> computeWorkoutPrBadgeMap(localWorkouts, prevData) -> WorkoutPrBadge

Separate path, not an input to the above:
AppContent shared Workout range owner
  -> verified paired legacy/canonical snapshot -> deriveRange
  -> composite Previous date browser / read-only identity-preserving cards
```

### Read lifecycle, errors, and invalidation

1. `ensurePrevData` runs from the `localWorkouts` effect and selected routine-preset effect. It deduplicates nonempty IDs, removes `__session__`, and requests only IDs absent from `prevDataRef`.
2. Routine loading and adding an exercise also call `fetchPrevForBlock`; its cache-hit path reads `prevData`. Reads use **selectedDate**, not wall-clock today or the separately selected Previous browser date.
3. LOCAL_FIRST performs one `readAll()` per invocation/batch, not one physical read per requested block. The lookup iterates each distinct block over the returned dataset. It does not query canonical storage.
4. Rows are sorted descending by date. `prev_sets` is a clone of the first row's entire set array; `prev_date` is its date. The local lookup has no one-year/ten-row bound. `pr_kg` scans every matching prior row (details in section 3).
5. Verified legacy datasets are first ordered by their dataset definition: workout rows by date then row ID, with stable content fallback. Equal-date rows retain that input order in the date-only lookup sort. This is technical ordering, **not session chronology**; lookup does not use `sort_order` to select a historical occurrence.
6. Positive local hits are merged into block-keyed state; a no-match local result has no key and therefore no durable/negative cache entry. Concurrent effects can request the same still-missing IDs before publication. The shared driver is reused, but datasets are not one universally shared comparison read.
7. Cache reset is an effect on selectedDate/account/memo scope. Account-generation plus mounted checks reject stale account continuations, including account ABA. Comparison fetch publication has **no captured selected-date/request-sequence fence**; do not infer date-transition race closure from the separate range implementation. A future subscriber must explicitly fence date/request lifetimes.
8. LOCAL_FIRST read/verification failures reject the promise. These comparison functions have no comparison loading/error DTO or local error-to-empty catch. Effect calls use `void`; action reads can reject before the action adds sets. Omission, failed lookup, and pending lookup are not distinguished by the cue UI. An already-cached positive value is not automatically invalidated by a later source failure.
9. Cache has no dedicated focus/bootstrap/save/delete subscription. Existing save/delete handlers revalidate daily/month/static data and notify AppContent's composite owner; they do not clear `prevData`. Shared range freshness is a **different** path and must be explicitly reused by any future comparison subscriber.
10. The inactive remote fallback sends one authenticated request per distinct block, maximum four concurrently. HTTP/network failures omit the key; a successful API no-match supplies an empty payload/key. The API filters user ID, block ID and `date < before_date`, orders descending, limits ten rows, and computes historical kg from completed, nonempty/nonzero sets. This is **not equivalent** to the current unlimited/local unfinished-set threshold. No remote contract is changed here.

## 3. Current mounted meanings: Previous, PR, and suggestions

### Distinct meanings of Previous

| Consumer / term | Current source meaning | Not implied |
| --- | --- | --- |
| `prev_sets` / `prev_date` | Entire most recent prior legacy row for that exact block ID | Previous human session; previous completed observation; all-source latest entry |
| Previous best micro-cue | Best usable **completed** set within that one row | Historical PR across all rows/sources |
| Per-set Previous cue | Compatible strength/bodyweight/drop group within that row, matched by unique semantic set number, otherwise compatible completed order | Canonical set UUID equality; cross-session identity |
| New exercise suggestion | Prior row's array length creates fresh empty sets (strength/bodyweight bounded 1..12; cardio one); no hit defaults to one | Copying historical kg/reps/assistance or using only completed-set count |
| Routine suggestion | Stored preset count first; else prior row count; else three; cardio one. Construction clamps non-cardio count 1..12 | Same default as direct add, or PR policy |
| Compatibility helper `plannedSetCount` (not directly mounted) | Current local row length first, then prior row length, then one; the mounted routine controller uses the separate preset policy above | Canonical session selection or an additional mounted consumer |
| Previous history browser | Bounded prior dates; initial nearest earlier same weekday, otherwise latest prior date; user may select another date | Per-exercise latest occurrence or chronological same-day session |
| `makeNextSet(prev)` | Immediately preceding **current draft** set copied into a fresh not-done sibling | Historical comparison read |

The browser uses `previousWorkoutRange(referenceDate)`: one calendar year before the reference through the preceding day. Its legacy "session" is a date presentation group, not a proved human-session identity. Composite Previous preserves every canonical session and repeated entry, and uses a presentation-only legacy date-group key. Its automatic weekday choice does not feed `prevData`.

### Exact mounted PR formula (`SOURCE_FACT`, not a new policy)

The LOCAL_FIRST historical threshold is the maximum `Number(set.kg)` that is finite among objects with a `kg` property in **all** prior matching legacy rows. It does not filter `done`, reps, assistance, drop status, or set variant; empty kg coerces to zero. No kg-bearing prior value leaves `pr_kg=null`; no prior row leaves no payload at all. Typed/verified legacy strength kg is numeric-or-empty; invalid persisted null/nonfinite values fail the verified read rather than being valid comparison evidence.

`computeWorkoutPrBadge` returns null for no payload or a cardio exercise block. Otherwise:

- Current maximum: max positive finite kg, lower-bounded at zero, from `isStrengthSet` (strength **or bodyweight**) with `done=true` and `kg !== ''` in **localWorkouts**, including an unsaved draft.
- Latest-row comparison maximum: same eligibility applied only to `pd.prev_sets`.
- PR: `pd.pr_kg !== null && currentMaxKg > 0 && currentMaxKg > pd.pr_kg`.
- No equal-or-greater reps constraint, 1RM, assistance exclusion/discount, or dropset exclusion is applied.
- Diff: display-unit current/latest-row maxima, rounded to one decimal; displayed when previous max is positive and PR is false. PR truth is decided before display rounding. The badge may therefore show a positive diff but no PR because an older or unfinished historical set supplies the threshold.
- `prev_date` is not displayed beside per-exercise cues/badge. Current card name/type comes from the current editor/catalog, not a frozen legacy historical snapshot.
- Map identity is `block_id`; a duplicate current row with the same block ID overwrites the earlier map entry. Normal add/write paths prevent duplicate logical block/date writes, but this is not a multiple-canonical-entry model.

Ordinary bodyweight input has empty kg, so it normally yields no kg PR badge; the predicate does not categorically exclude a bodyweight set carrying positive legacy kg. There is **no bodyweight-rep PR formula**. Cardio has no badge PR/cue formula. `detectRecentPr` elsewhere is a different name-based metrics helper, not the mounted official badge source; do not substitute its semantics.

### Cue and eligibility details

`previousMicroCue` excludes not-done and unusable sets from best/performance display. Weighted best orders by source-aware normalized kg, then unassisted reps; bodyweight best orders by unassisted reps. Exact ties retain historical array order. Cardio is not a strength cue. Best selection can include a dropset; per-set matching separates normal/drop and weighted/bodyweight compatibility groups.

Unique valid semantic set numbers are preferred. If an exact numbered reference is incomplete, its formatter yields no cue; the code does not substitute a later completed set. Positional fallback uses compatible completed usable sets and does not repeat the final prior set for extra current rows. A set number is still an ordinal/reference signal, never stable persisted set identity.

Legacy `reps` is total performed reps including assistance. Valid `assisted_reps` is a positive integer subset; comparison/display derives `unassisted = total - assisted` and preserves both. All-assisted sets can have derived unassisted zero. No assistance field uses positive finite reps; invalid/empty assisted evidence must not fabricate a breakdown. Official kg PR ignores this dimension even though micro-cues use it.

## 4. Legacy identity and catalog relationship

Legacy evidence: account ownership (`user_id` and verified account read), row UUID, nullable UUID `block_id`, calendar `date`, row `sort_order`, ordered set array, numeric-or-empty kg/reps, optional source weight metadata, boolean `done`, optional assisted/drop fields. Set `set` is a number, **not a UUID**. A strength/bodyweight set has no durable entry identity. Cardio stores time/distance/pace representations, not a PR metric definition.

Names/types in editor/history generally come from the **current mutable exercise catalog**. Shared composite fallback may preserve a row-provided historical display name or an ID-labelled placeholder when its catalog block is absent; this is not proof of a frozen exercise type/name snapshot. `readLocalPreviousWorkout` itself matches raw block ID and does not consult names/types.

Missing evidence: human-session UUID/boundary, chronological session time, frozen exercise-at-performance identity/version, stable set UUID, canonical namespace/generation lineage, and an adoption link. A legacy row ID is not a canonical session ID; a date group is not necessarily one human session.

New local saves enforce `(date,blockId)` logical-key uniqueness and replace that key transactionally. Historical/imported rows with distinct row IDs must not be collapsed by analytics merely because block/date agree. The comparison function itself picks one equal-date row technically and includes all such rows in its threshold.

## 5. Canonical historical evidence

`WorkoutSessionV1` is exactly `{version:1,id,localDate,entries}`. The strict validator enforces session/entry/set UUIDv4 identity uniqueness by UUID value, nonempty entries/sets, one-based set ordinals, variant consistency, exact fields, bounded canonical values, and byte budget.

| Level | Available exact evidence |
| --- | --- |
| Session | UUID; date-only `localDate` |
| Entry | UUID; frozen exercise `{id: string|null, name, type, tags, cardioMode}`; ordered entries |
| Common set | UUID, ordinal, `kind`, boolean `done` |
| Strength | `loadKind:'external_weight'`, `weightKg`, `sourceValue`, `sourceUnit`, `reps`, `assistedReps`, `dropset` |
| Bodyweight | `loadKind:'bodyweight'`, `reps`, `assistedReps`, `dropset`; **no weight fields** |
| Cardio | `durationSeconds`, `distanceMeters`; no stored pace PR definition |
| Reader envelope, outside V1 | Account/namespace/generation, entity identity, local revision, active-only eligibility, source-qualified read ID |

No `performedAt`, `timeZone`, memo, session label, or session sort/time field exists. UUID order is only a technical tie-break. Entry/set order can identify positions within a record but cannot prove workout chronology across same-day sessions or that a later entry was performed later.

The dormant typed editor adapter already landed in G5B1 (#728). It allocates IDs only for new objects, preserves hydration identities and frozen snapshots, and normalizes supported variants. It does not activate a canonical editor or turn legacy rows into canonical sessions.

## 6. Analytical exercise matching candidates

No option is selected here. Precision assessments are conditional, not measured accuracy percentages.

| Candidate | Precision / false-positive risk | False negatives | Rename / missing / null behavior | Reused-ID / identity implications |
| --- | --- | --- | --- | --- |
| Legacy `block_id == frozen exercise.id` | Strongest available lineage hint if catalog identity continuity is trusted; not independently proved exercise equivalence | Unlinked/imported IDs, null ID, recreated block | Survives name rename; retained ID can match deleted catalog history; null cannot match | Reused/reassigned historical IDs can misassociate; no catalog-era proof. Equality never identifies records |
| Normalized name | Weak; homonyms, normalization/collation/transliteration collisions | Rename, missing fallback name, different spelling | Rename-sensitive; null ID can still offer a name, but not identity | New block with same name can false-match; never dedupe |
| Name + type | Better family separation than name alone; same-name same-type collision remains | Rename, missing legacy historical type/name | Frozen canonical type versus mutable/fallback legacy type can disagree | Does not prove catalog identity or session equivalence |
| Block ID plus name verification | Conservative only under approved rename/verification policy | Legitimate canonical frozen-old-name versus current catalog rename | Name mismatch may be rename, not wrong exercise; null/no catalog requires explicit handling | Still cannot prove an ID was never reused; verification is analytical, not adoption |
| No cross-source matching | No cross-source false-positive match | Every genuine cross-source continuation is intentionally omitted | Honest source-separated limitation survives rename/null | Records remain separate; PR/previous must be source-scoped or unavailable |

Canonical exercise IDs are nullable strings, not required UUIDs by V1. Current legacy lookup uses exact string equality; do not silently introduce name normalization, UUID-case normalization, or fallback hierarchy as approved policy. Normal creation of a new catalog block does not prove historical IDs can never be reused/imported; the comparison reader has no reuse-history contract. A possible risk is not evidence that reuse has actually occurred.

## 7. Catalog mutation, dates, and same-day ambiguity

| Sequence | Supported evidence / limitation |
| --- | --- |
| Rename after canonical save | Frozen old canonical name/type remain. Retained exercise ID is a potential analytical bridge, not automatic match approval |
| Rename after legacy save | Catalog-based legacy display follows current name; original performance name is not guaranteed. Name matching can gain/lose matches |
| Delete block | Canonical snapshot remains. Legacy retained ID may remain comparable by ID; null/unavailable ID cannot match the selected nonnull block. Fallback display is not a frozen snapshot. Comparison code does not establish backend FK deletion behavior |
| Canonical exercise ID null/unavailable | Entry/set/session identity and frozen description survive; ID matching cannot prove correspondence |
| New block with similar/same name | Name alone cannot prove continuity; new ID does not imply the old record should be relabelled |
| Same name, different IDs | Keep separate records; any analytical grouping requires explicit policy |

Current lookup is `legacy date < formatDate(selectedDate)` and remote fallback also uses strict `< before_date`. The per-exercise anchor is not today and not the date selected inside Previous history. `useNow.formatDate` applies the configured user timezone to the selected Date/DateTime; stored V1 `localDate` contains no zone or instant. Do not convert a historical date-only value into an invented timestamp or reinterpret its original timezone.

Two canonical sessions on the same prior date, repeated entries within one session, and repeated exercise entries across sessions remain independently addressable observations. The closest prior **date** can be known; a first/last chronological session that day cannot. Same-day earlier-session eligibility is UNSUPPORTED without additional evidence/policy. Sorting UUIDs, source type, row IDs or `sort_order` is not chronological evidence.

Legacy duplicate block/date rows and mixed same-date records can be shown separately or summarized by an approved analytic policy. The existing composite technical canonical-before-legacy order is **not source precedence for Previous or PR**. Current per-exercise lookup ignores all canonical candidates in every same-day/mixed ordering.

## 8. Variant, units, and proposed PR/suggestion policies

### Variant facts versus possible future derivations

| Dimension | Current mounted comparison | Future evidence / classification |
| --- | --- | --- |
| Strength weight | Badge uses positive done draft kg versus local all-prior kg threshold; best cue uses completed source-aware kg | Validated canonical normalized weight is SOURCE_FACT; comparing equal analytical exercise evidence in a declared unit/range is SAFE_DERIVATION after policy approval |
| Reps | Not a kg PR constraint; best cue uses unassisted reps as weight tie-break | Equal-or-greater reps, rep-range PR, volume or 1RM are PRODUCT_DECISION_REQUIRED |
| Bodyweight | Completed previous-best/per-set reps cues; ordinary empty kg means no badge PR | Reps-only/bodyweight PR is PRODUCT_DECISION_REQUIRED; adding body mass/load not stored in V1 is UNSUPPORTED |
| Assistance | Total reps plus positive subset; cues preserve/derive unassisted work; kg PR ignores assistance | Deriving valid unassisted reps is SAFE_DERIVATION; inclusion, exclusion or ranking of assisted sets is PRODUCT_DECISION_REQUIRED |
| Dropset | Best/threshold may include it; per-set references require matching drop family | Normal/drop eligibility and cross-family PR aggregation are PRODUCT_DECISION_REQUIRED |
| Cardio | Historical display and count fallback; no performance cue or badge PR | Seconds/meters conversion is SAFE_DERIVATION when legacy input is parseable and unit known; duration/distance/pace optimization direction and comparability are PRODUCT_DECISION_REQUIRED |
| Not-done sets | Count suggestion includes them; local threshold also includes them; cues and current maximum exclude them | Planned-versus-completed comparison must be explicitly chosen, not silently unified |
| Null/empty/zero | Legacy empty kg can establish threshold zero; zero cannot qualify current max; canonical null differs from validated numeric zero | Do not equate missing with zero. Positive-value eligibility is PRODUCT_DECISION_REQUIRED for each future metric |

### Existing normalization contracts

- Legacy set kg is numeric/string canonical-kg representation, with optional paired `weight_source_value`/`weight_source_unit` and draft-only raw input fields. Saving new raw weight input strips those raw fields and rounds source and canonical kg to two decimals. With no raw input, unit-only/non-weight edits preserve existing kg-only or source-aware values rather than recanonicalizing history. Source/display helpers use `1 lbs = 0.45359237 kg`; matching saved display units preserve two source decimals, cross-unit display rounds to one. kg-only legacy data is interpreted as kg.
- Current official badge uses stored kg directly; micro-cues prefer valid source metadata and convert it to kg. Legacy validation does not impose the V1 exact source/normalized equality contract, so those paths must not be assumed identical for inconsistent historical records. Future mismatch handling requires policy, not an in-place rewrite.
- V1 strength `sourceValue` and `weightKg` are nonnegative canonical decimal strings, at most two decimal places; both source fields and weight are null together. `normalizeWeightInput` uses integer arithmetic/HALF_UP; the validator proves stored kg agrees with source value/unit. Comparison should not use rounded display text as numeric evidence.
- V1 repetitions are null or nonnegative safe integers; assisted repetitions normalize empty/zero to null and otherwise must be positive and no greater than total reps. Legacy durable assistance omits empty/zero instead.
- Legacy cardio stores time string, distance represented by UI as km, and pace string. UI blur formats digits into minutes/MM:SS/H:MM:SS but is not the strict V1 duration validator. Do not assume every legacy string is valid seconds evidence.
- `normalizeCardioDurationInput` accepts supported digit/colon forms, converts to safe integer seconds and rejects invalid subordinate minute/second fields. Empty becomes null. `normalizeKilometersToMeters` converts exactly to meters, rejecting precision requiring more than three meter decimals. V1 distance is a nonnegative canonical decimal string (max three decimals), duration null or nonnegative safe integer.
- A future projection may derive consistent internal kg/seconds/meters without changing records. Choice of legacy source versus stored kg on inconsistency, display precision, zero eligibility and metric policy still need approval. Unknown legacy units/invalid parse must remain unavailable, not guessed.

### PR alternatives, not selected formulas

| Policy | Current support / available data | New decision and variant coverage | Risk |
| --- | --- | --- | --- |
| Max external weight among completed strength sets | Cue/current maximum are similar; local historical threshold is **not** completed-only. V1 has weight/done | Done/assistance/drop/coverage/matching policy; strength only | Calling this a compatibility-only change hides current threshold semantics |
| Max weight with equal-or-greater reps | Weight/reps exist when nonnull | Rep eligibility, assistance, which current target, ties; strength | Different performances cannot be ranked without approved relation |
| Estimated 1RM | Weight/reps may exist | New formula, domain limits, assisted/drop handling | Unapproved estimation; no formula implemented here |
| Max bodyweight reps | Canonical and legacy total/assisted reps exist | Total versus unassisted, assistance/drop eligibility | V1 has no body-mass evidence; not kg PR |
| Cardio duration/distance/pace PR | Canonical seconds/meters; legacy parsing is conditional | Event/comparable distance, speed/endurance direction, mode, units | Longer duration is not universally better; mixed event types not comparable automatically |
| Current legacy-compatible kg PR only | Exact mounted formula described in section 3 | Explicit legacy/date/source limitations and existing asymmetries retained | Honest only as source-scoped; not complete-source personal record |

### Previous-set suggestion alternatives

Available units include closest prior date, latest matching row/entry observation, all sets of that observation, completed-only sets, or planned-plus-done sets. Same-date multiple sessions can be presented as separate options or aggregated by approved rules; chronological first/last selection cannot be derived. A deterministic UUID choice would be a **technical** selection policy, not latest performed session.

Source precedence is not established. Source-separated evidence is possible without pretending one legacy date group equals one canonical session. Count-only suggestions and value/reps suggestions are different features; current add/load creates empty sets, not copied history. No future policy may silently replace the current one/three/preset defaults with canonical count or load suggestions.

## 9. Source-valid cases and exact current consequences

Fixture symbols use real valid UUIDs, not minted production data: account A=`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`; block B=`bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`; legacy L=`44444444-4444-4444-8444-444444444444`; same-date control row T=`55555555-5555-4555-8555-555555555555`. Selected key is `2026-10-02`. Legacy catalog B is Squat/strength with tags `[]`, cardio_mode null, user A; rows have user A, B, sort_order 0 and valid typed sets. All other legacy datasets are empty.

The canonical positive record has session `11111111-1111-4111-8111-111111111111`, localDate `2026-09-30`, entry `22222222-2222-4222-8222-222222222222`, frozen exercise `{id:B,name:'Squat',type:'strength',tags:[],cardioMode:null}`, and set `33333333-3333-4333-8333-333333333333` with ordinal 1, kind strength, loadKind external_weight, weightKg/sourceValue `'120'`, sourceUnit kg, reps 5, assistedReps null, dropset false, done true. This exact V1 shape was validated. No performedAt/time/label is supplied.

| Case | Current local output / UI consequence | Truthful future knowledge, not policy |
| --- | --- | --- |
| Legacy positive control: L on 09-25, completed 100x5 and 90x8; draft 110x5 done; T on selected date 300x5 | `prev_date=09-25`, full two sets, `pr_kg=100`; PR true; direct add builds two empty not-done sets. Selected-date 300 excluded | Preserve this explicitly documented compatibility case under the chosen future policy |
| Canonical-only 120x5 on 09-30; no legacy rows; draft 110x5 | Local lookup `{}`; badge and best cue null; direct add one fresh set. Routine fallback may be stored preset or three, not necessarily one | Valid matching canonical observation exists if approved analytical key matches. Current UI **omits** comparison; it does not render a per-exercise "verified no previous data" label |
| Mixed: legacy 100x5 on 09-25, canonical 120x5 on 09-30, draft 110x5 | Legacy 09-25 chosen; legacy PR true; canonical 120 excluded | 09-30 is closest prior date, but choosing/aggregating its entries and claiming a PR requires matching/eligibility policy. Unqualified all-source PR would be unsupported |
| Eligibility split: latest legacy row contains unfinished 150x5 and completed 100x5; draft 110x5 done | `pr_kg=150`, previous-best cue 100; no PR, positive latest-completed diff | Current PR and cue eligibility differ. Do not relabel this as completed-only historical PR |

The four rows above were isolated **source-function probes**, using the existing function body with a stubbed repository. Legacy datasets passed their current validator/orderer and the canonical example passed V1 validation. This is not real IDB, mounted browser, device QA, or execution of a future composite feature.

Additional mixed cases are source-derived examples, not newly executed acceptance tests:

| Prior observations for B | Current comparison sees | A future verified view can know |
| --- | --- | --- |
| Canonical 09-20, legacy 09-25 | Legacy 09-25 | Closest prior date is 09-25 if both sources verified; older canonical value may still matter to an approved historical PR |
| Legacy and canonical both 09-25, different values | One selected legacy row and legacy threshold | Both observations, with no chronology/source winner inferred |
| Two canonical sessions on 09-30, repeated B entries in either | None without legacy hit | Distinct session/entry/set identities and values; neither chronological last session nor single previous observation is proved |
| Closest prior evidence is older than one year | Local legacy lookup can still find it; current browser previousView excludes it | View coverage is not all prior history. Do not publish all-history absence/PR from that bounded view |

## 10. Partial/error/isolation truth table

The following table describes **current shared range snapshot behavior**, not the mounted block-keyed comparison cache or a future acceptance result. Partial outcomes require the surviving source to succeed and current scope/publication fences to pass.

| Failure source | Current classification | Paired outcome |
| --- | --- | --- |
| Canonical persisted account/namespace/generation mismatch or untrusted envelope scope | Payload-free persisted failure promoted to typed `CompositeWorkoutReadIsolationError` | Paired publication fails closed; neither source survives |
| Canonical trusted invalid content or ordinary availability/I/O failure | Ordinary canonical source error | Verified legacy evidence may survive as `partial_data` |
| Legacy verified dataset malformed content or owner mismatch | Generic legacy repository/source error; detailed validation issue is lost | Valid canonical evidence may survive as `partial_data`; rejected legacy records are not published |
| Both sources have ordinary errors | Both source statuses are error | `error`, no records |

This second table states the comparison claims permitted by those source-qualified outcomes and declared coverage; it is not an already implemented composite comparison policy.

| Legacy | Canonical | Paired truth | Allowed comparison statement |
| --- | --- | --- | --- |
| Success + match | Success + match | Complete evidence within declared range | Show approved matching candidates; derive chosen metric only under approved policy |
| Success, no match | Success, no match | Verified no matching evidence **within that range and matching policy** | Not all-time absence; not proof of no human exercise occurrence |
| Success | Trusted canonical content failure / ordinary availability failure | partial_data, legacy evidence only | Explicit legacy-scoped cue; no complete-source PR/no-PR or absence claim |
| Legacy verified owner/content validation failure, or ordinary availability failure | Success | Currently generic legacy error; partial_data, canonical evidence only | Explicit canonical-scoped evidence, not verified legacy absence or complete-source truth; contaminated legacy record is not published |
| Ordinary failure | Ordinary failure | error, no records | Comparison unavailable, not empty history |
| Any legacy state | Canonical untrusted persisted scope promoted to typed isolation | **D0 canonical isolation error; fail paired publication closed** | Publish neither source, no partial fallback or cached comparison |
| Pending / disabled / superseded | Any | No current settled paired evidence | Loading/unavailable; no cached old-owner claim |

A match from one successful source does not establish completeness when the other is unavailable. Neither source having a visible match is also not proof of no history when one failed. A product may explicitly retain source-scoped evidence, but it must not use that evidence to label a full-source personal record.

D0 remains authoritative **for canonical persisted envelopes**. `LocalDatabaseRepository.validatePersistedEntityScope` and its batch scope-first validation preserve `ACCOUNT_MISMATCH`, `NAMESPACE_MISMATCH`, `GENERATION_MISMATCH`, and `UNTRUSTED_SCOPE` in `LocalDatabaseError.persistedEntityFailure`. `WorkoutRangeReader.readAllActive` promotes those failures to `CompositeWorkoutReadIsolationError`; the coordinator recognizes that typed rejection before paired publication. Trusted canonical content corruption remains an ordinary canonical source error. These checks precede date/matching filters. D0 closed the canonical persisted-envelope classification loss identified in Search D0; it did **not** establish universal typed scope-distrust classification for the legacy Health verified repository. D0 canonical isolation guarantees must not be generalized to every legacy Health validation failure.

An explicit typed isolation boundary still fails the pair closed regardless of which source rejects: for example, `projectVerifiedWorkoutRangeLegacyRows` checks `user_id` and can throw typed `ACCOUNT_MISMATCH` if it receives a foreign-owned row. However, the real verified `readAll()` path validates first and rejects such a row generically, so that later adapter check does not repair the earlier classification loss. Do not claim symmetry merely from the adapter or a mocked `readAll()` test. A future comparison must consume the existing verified boundary, retain canonical typed isolation/currentness, and honor the legacy limitation below; do not scan canonical envelopes separately, catch typed isolation as generic partial, or use raw `Workout[]` as persisted completeness evidence.

### Current technical limitation: LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP

This is a descriptive technical limitation/debt, **not a new numbered REL blocker**. At the pinned source, `healthRecoveryExport.ts::validateHealthRecoveryDatasets` detects `source_owner_mismatch` (L240). `healthLocalRepository.ts::assertDatasetsValid` collapses any validation issue into the supplied generic error (L421-424); `readAuthoritativeDatasets` supplies `health_local_verified_data_malformed` (L623), and `HealthRepository.readAll` propagates it. `verifiedWorkoutRangeSnapshot.ts` promotes rejected sources only when they already carry `CompositeWorkoutReadIsolationError` (L206-210), otherwise mapping the rejected legacy read to ordinary source error (L223-224).

Consequences: the paired coordinator cannot distinguish detected legacy owner corruption from ordinary legacy availability/content failure; valid canonical evidence can remain `partial_data`. The malformed/foreign legacy row itself is rejected, **not published**. Source-qualified surviving evidence may therefore remain safe, but it proves neither verified legacy absence nor universal paired isolation. A future comparison requiring source-symmetric scope isolation needs a separately reviewed typed legacy ownership-classification prerequisite (or architecture-equivalent safe trust boundary). An explicit reviewed source-scoped partial contract may instead avoid complete-source claims; product UX approval cannot override an unsafe technical trust boundary.

This does not reopen canonical D0, invalidate default-OFF Search D1, change writer authorization, or authorize a runtime fix in this characterization.

## 11. Shared range feasibility and read budget

**Reuse is feasible; no extra canonical repository scan is inherently required.** A normal successful stable-scope source-snapshot load performs one verified legacy `readAll()` and one `WorkoutSessionRepository.listWorkoutSessions()` active-domain scan. A failed canonical open can perform no scan; bounded stale-generation recovery can retry the pair once. Neither is permission for per-block scans. The reader excludes tombstones, validates V1/envelope identity and scopes, and retains all active records from a successful source. Date-range views are inclusive pure derivations of that frozen evidence; device/generation/owner/publication fences run before exposing them. Physical domain coverage and published date coverage are different.

Physical reuse does not imply symmetric failure taxonomy: the legacy source's owner-error classification is weaker than the canonical source's (section 10). Future comparison reuse must either accept an explicit reviewed source-scoped partial contract with no complete-source claim on legacy failure, or separately restore typed legacy ownership classification/another safe trust boundary before asserting source-symmetric complete-source isolation. The snapshot is not physically unusable, and this qualification adds no scan/store/index authorization.

Current `previousView` is one-year bounded and `monthView` is the calendar month. They are sufficient for approved **bounded** comparison but **not** a drop-in replacement for the current unbounded legacy prior-row/PR lookup. A product must choose bounded-history language or separately approve an owner-derived prior-history view with adequate declared coverage. The underlying source snapshot has full local active-domain evidence, so that view need not introduce a second canonical scan. UI consumers must not receive the coordinator, DB handle, mutable repository, or private currentSnapshot. Any owner API/view change would be separately reviewed implementation, not silently authorized here.

| Path | Physical work | Repetition/cache/currentness |
| --- | --- | --- |
| Current LOCAL_FIRST per-exercise batch of K distinct IDs | One full verified legacy dataset read per call; approximately K filters/sorts over N workout rows plus set scans | Positive block cache within account/date; no local no-hit cache or in-flight batch dedupe; effects can overlap |
| Current explicit routine loading without cached hits | Sequential fetch per missing block; each local call reads the full dataset | Preset effect may already populate positives, but no guaranteed one-read routine transaction |
| Inactive remote fallback | Per-block HTTP queries, concurrency four, ten rows per block | Different historical coverage/error/no-hit payload contract |
| Existing shared composite snapshot | Stable-scope load: one legacy dataset read + one canonical domain scan; explicitly bounded stale-generation retry may repeat once | Previous/month/selected-day derive from same evidence; range hook listener-free |
| Possible future comparison projection | Pure scan/index of already derived approved evidence; no per-block physical canonical scan | Reuse owner freshness/currentness and declared bounds; projection/index optimization remains unimplemented |

AppContent invalidates the paired snapshot synchronously on matching-account durable save/delete notifications, and shares retry/bootstrap/focus/visibility freshness. Account ABA, device/generation changes, gate lifetime and publication sequence must also fence future comparison. The existing per-exercise cache does not inherit those guarantees automatically. Large-history scans still need measured read/CPU/memory budget before broad activation; this doc does not authorize an index/store/DB change.

## 12. Mounted UI claim audit

Copy is observed in the current render branches and translations, not from an activated production canonical writer.

| Mounted copy/behavior | Classification | Scope/consequence |
| --- | --- | --- |
| Previous best weight/reps and per-set Previous cue | `LEGACY_SCOPED_BUT_UNLABELED` | Latest selected legacy row, not browser-selected date/all-source best; no inline source/date next to the cue |
| `PR` trophy / +/- kg or lbs | `LEGACY_SCOPED_BUT_UNLABELED`; all-source interpretation is `AMBIGUOUS` | Source graph cannot support universal PR. Mixed/canonical-only historical maxima invalidate an unqualified all-source interpretation (`FALSE_WITH_CANONICAL_ONLY_HISTORY` under that interpretation), not the explicitly legacy-scoped formula |
| Missing per-exercise payload/cue | `SAFE_AS_CURRENTLY_WORDED` as omission; absence interpretation `AMBIGUOUS` | No per-exercise "no previous data" message. Missing/loading/failure is not a verified empty result |
| Fresh empty sets / preset count suggestion | `AMBIGUOUS` | Current counts are a legacy planning fallback, not the number of canonical completed sets |
| Separate legacy browser "No previous workout yet" | `AMBIGUOUS` outside its bounded legacy scope | Does not prove all-time/all-source absence; do not reuse as comparison empty copy |
| Composite browser partial/error/loading branches | `SAFE_AS_CURRENTLY_WORDED` for bounded source-qualified display | Partial no-record text refers to currently accessible sources, errors have retry; does not upgrade PR completeness |
| Composite browser "Exercise comparison and PR cues remain legacy-only" | `SAFE_AS_CURRENTLY_WORDED` | Explicit preview limitation, rendered with selected bucket; not a universal inline badge label or empty-branch label |
| Future publicly complete-source Previous/PR promise | `PRODUCT_DECISION_REQUIRED` | Needs composite policy/implementation, explicit legacy limitation, source-separated evidence, or hiding policy |

Canonical-only history within the range can be visible in composite Previous while the editor omits its comparison; this is an acknowledged preview limitation, not proof the writer/PR line is closed. The selected-day preview's older copy saying Home/Search remain legacy-only is partly superseded by later gated implementations, but shipped gates remain OFF. Copy alignment is a future public-readiness concern; this characterization changes no translation or closed reader line.

## 13. Writer and public-reader dependencies

| Milestone | Comparison dependency |
| --- | --- |
| Dormant canonical editor integration | Neither comparison policy nor the legacy classification fix is a prerequisite to pure typed draft/identity/CAS foundation. Keep code OFF; do not promise complete-source comparison |
| Disposable staged account writer | **PRODUCT_DECISION_REQUIRED**: explicitly legacy-only comparison labels, qualified separate evidence, or hiding could be acceptable alternatives without universal paired isolation. Complete-source comparison additionally has the section 10 trust prerequisite. This is not approval. Identity, creation-era/reset semantics, isolation/recovery conditions and the reviewed cutover order still apply |
| General writer rollout | Must settle truthful comparison/suggestion scope before offering full-source PR/Previous behavior. Complete-source paired comparison requires the section 10 trust prerequisite; an approved legacy-only/source-scoped limitation or hiding does not automatically require that fix. Seven live-writer blockers/G5C/G6/QA remain separate; this limitation is not a standalone writer authorization decision |
| Public composite reader activation | Must resolve this feature's scope/copy. A public complete-source comparison claim requires the section 10 trust prerequisite; an explicit reviewed source-scoped partial/legacy-only limitation or hiding may avoid that claim. Product approval, source/error/currentness and physical QA remain required. Read-only rollout does not inherit writer authority |
| Complete-source comparison implementation | Source-symmetric paired scope isolation requires separately preserved typed legacy ownership classification or another reviewed safe trust boundary. Retaining current generic legacy failure requires an explicit source-scoped partial contract, not silently calling it complete-source truth |

No implementation/rollout option is authorized here. The presence of canonical read cards does not authorize new draft writes or assert other devices see unsynced local sessions.

## 14. Bounded PRODUCT_DECISION_REQUIRED matrix

All rows are **OPEN / PRODUCT_DECISION_REQUIRED**, not decisions made by this document. "Before implementation" refers to the affected option, not this source characterization or unrelated pure foundations.

| ID | Question / supported options | Technical consequence | Required before / safely deferrable |
| --- | --- | --- | --- |
| EXCOMP-PD01 | Analytical match: retained ID, normalized name, name+type, ID+name check, no cross-source match | Candidate grouping, rename/null/reuse/case handling; never record identity | B/C matching implementation; defer under explicitly legacy-only A |
| EXCOMP-PD02 | Previous: latest prior matching date/observation versus browser weekday; one-year versus declared all-local-prior coverage | Input view bounds, absence copy, latest selection and historical PR horizon | Affected comparison/view change; bounded evidence cannot silently replace unlimited behavior |
| EXCOMP-PD03 | Multiple same-day sessions/entries: separate options, date aggregation, labelled deterministic pick, exclusion | No performed-time ordering available; preserve IDs | Any single-result B or same-day feature; defer if evidence remains separate |
| EXCOMP-PD04 | Source precedence: none/separate, approved precedence, chosen analytic aggregation | Mixed closest-date and equal-date behavior | Any cross-source collapse; no default based on technical sort |
| EXCOMP-PD05 | Planned versus done: all-set count plan, completed-only reference, explicit separate sets | Changes counts/eligibility and existing local threshold compatibility | Affected PR/suggestion change; current scoped behavior can remain |
| EXCOMP-PD06 | PR: current legacy formula, completed max weight, rep-constrained relation, estimated 1RM | Formula, ties, horizon, null/zero and draft-vs-saved status | Any new PR formula; defer new formulas under A/C/D |
| EXCOMP-PD07 | Bodyweight: reps, unassisted reps, no PR, source evidence only | No V1 body-mass/load field; cannot reuse external-weight PR | Bodyweight performance extension; defer unsupported PR |
| EXCOMP-PD08 | Assistance: include, exclude, separate assisted/unassisted evidence | Reps are total; valid subset derivation does not choose ranking | Ranking/eligibility change; displaying exact validated fields can remain separate |
| EXCOMP-PD09 | Dropsets: include, exclude, separate family | Existing best/threshold and per-set compatibility differ | New aggregation policy; retain current documented scope otherwise |
| EXCOMP-PD10 | Cardio: distance/duration/pace, comparable event/mode, no PR | Parse validity, optimization direction, same-distance/same-duration basis | Cardio comparison extension; safely defer PR |
| EXCOMP-PD11 | Internal values versus source/display units; inconsistent legacy metadata; precision | Normalize validated kg/seconds/meters; never compare rounded labels or guess invalid units | Numeric composite implementation; display policy also needs approval |
| EXCOMP-PD12 | Partial/error UX: source-scoped evidence, unavailable, or hide complete claim | No PR/no-PR/absence from incomplete pair; canonical typed D0 isolation fails paired closed. Legacy owner-classification prerequisite is technical, not a UX choice that can override trust | Any new public comparison subscriber; resolve section 10 trust prerequisite for source-symmetric complete-source comparison, or explicitly review source-scoped partial behavior. Existing diagnostics do not approve UX |
| EXCOMP-PD13 | Keep legacy-only limitation versus separate evidence or canonical-aware hiding | Label placement/accessibility; ensure source/date/horizon constraints remain visible | Public scope-label/hide change; docs may describe alternatives only |
| EXCOMP-PD14 | Requirement before staged writer/general writer/public reader; current draft versus persisted achievement | Approved rollout/QA requirements and which feature is promised | Affected activation. Dormant adapter/editor foundations may proceed only under separate authorization |

Search PD01-PD10 remain untouched. Exercise comparison decisions do not approve public Search ranking, matching fields, recents or navigation.

## 15. Implementation options, not selected by convenience

| Option | Correctness / UX | Size and decisions | Read budget | Writer/readiness consequences |
| --- | --- | --- | --- | --- |
| A. Explicitly legacy-only Previous/PR | Honest if every relevant cue/suggestion/PR scope is clear; preserves current positive baseline/asymmetries. Canonical history intentionally omitted; malformed legacy read is not verified absence | Narrow copy/scope implementation, but PD13/14 approval and claim placement required. Does not automatically require paired isolation symmetry or the legacy classification fix | Existing local reads; no canonical scan added | Possible approved limitation for staged/public scopes, not automatic general writer approval |
| B. Source-aware composite comparison | Can include validated canonical evidence, if analytical grouping, eligibility, dates/variants/formula are approved. Collapsed complete-source claims cannot assume symmetric legacy isolation | Medium projection + owner/view + UI/currentness integration; core PD01-PD12 unresolved; separately restore typed legacy owner classification or prove another reviewed safe trust contract. Current generic failure can support only explicitly qualified partial behavior | Reuse shared snapshot; no extra canonical scan; coverage may need owner-derived view | Supports a chosen complete-source feature only with its trust prerequisites, not writer/reset/convergence closure |
| C. Separate legacy/canonical evidence | Preserves distinct observations without one source winning or one invented Previous/PR. May tolerate current ordinary-source partial semantics under explicit reviewed qualification, never generic legacy failure as verified absence | Medium evidence UI; matching/bounds/partial/copy still decisions. Can avoid new PR formula; no universal paired-isolation claim for legacy owner corruption | Same paired snapshot; potentially many observations, budget/virtualization review | Useful source-scoped readiness alternative; does not by itself provide one complete-source PR or suggested plan |
| D. Hide/disable comparison when completeness is unknown | Avoids misleading claims if unknown/partial/canonical conditions are defined; intentional feature loss. May avoid complete-source claims without restoring classification if generic failure is unavailable/hidden, not empty | Narrow-to-medium guard/UX. PD12-14 and a verified input are needed to know hiding conditions; explicit error/currentness policy must preserve canonical typed isolation | Can reuse source presence/status; detecting canonical conditions still needs shared evidence, not an independent scan | Possible staged/public restriction after approval; no authorization here |

No option is chosen solely because it needs fewer code changes. In particular, "canonical present" detection for D and bounded view expansion for B are implementation work, not this artifact.

## 16. Recommended next technical ceiling

**COMPARISON_BLOCKED_BY_PRODUCT_DECISION_AND_LEGACY_ISOLATION_PREREQUISITE** for source-symmetric complete-source comparison.

The existing paired snapshot and V1 provide enough raw evidence for a future source-aware projection; there is no established missing-store/index/second-scan prerequisite. However, exercise matching, horizon, same-day selection, set eligibility, numeric trust, and partial UX determine the result itself. In addition, `LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP` prevents assuming source-symmetric paired isolation: complete-source implementation requires a separately reviewed typed legacy ownership-classification prerequisite or architecture-equivalent safe trust boundary. Current generic legacy failure must not become verified absence or complete-source truth.

These are separate blockers: product semantics do not repair error classification, and classification repair does not choose exercise matching/PR policy. Explicit legacy-only Option A, qualified source-separated Option C, or unavailable/hiding Option D may avoid the symmetric-isolation requirement under a reviewed source-scoped contract. They remain product-decision-blocked, not automatically implementation-ready. This ceiling does not require a lower-layer fix merely to label a genuinely legacy-only feature, select a product option, or perform separately authorized dormant editor work. Therefore neither COMPOSITE_COMPARISON_IMPLEMENTATION_READY nor unconditional LEGACY_ONLY_SCOPE_LABELING_READY is justified.

After focused correction rereview, obtain a bounded EXCOMP-PD decision selecting scope/options and compatibility promises, with the section 10 technical trust prerequisite explicitly resolved or an acceptable source-scoped partial contract separately reviewed. Only then authorize the affected default-OFF implementation ceiling. Keep all source-qualified records and canonical D0/currentness boundaries; no writer/data-plane authority follows from that later implementation. No technical fix is implemented or authorized by this document.

## 17. Future acceptance matrix

These are requirements for a **future authorized implementation**, including applicable limitation/evidence/hiding branches. All 32 rows are **REQUIRED / NOT EXECUTED**. Existing tests/probes in section 19 do not execute this future matrix. A chosen option must explicitly resolve applicability without silently claiming unsupported features passed.

| ID | Future acceptance criterion | Status |
| --- | --- | --- |
| EXCOMP-C01 | Legacy-only positive case preserves approved latest-row, threshold/cue and count compatibility | REQUIRED / NOT EXECUTED |
| EXCOMP-C02 | Canonical-only validated prior evidence is included or explicitly limited/hidden; never declared verified absent | REQUIRED / NOT EXECUTED |
| EXCOMP-C03 | Mixed older/newer/equal-date sources retain provenance and implement only approved precedence | REQUIRED / NOT EXECUTED |
| EXCOMP-C04 | Two canonical same-day sessions remain separate; no inferred chronological latest | REQUIRED / NOT EXECUTED |
| EXCOMP-C05 | Repeated matching entries within/across sessions keep entry/set identity and approved analytic treatment | REQUIRED / NOT EXECUTED |
| EXCOMP-C06 | Nullable/unavailable canonical exercise ID follows approved no-match/fallback policy without ID synthesis | REQUIRED / NOT EXECUTED |
| EXCOMP-C07 | Canonical rename retains frozen snapshot; legitimate retained-ID rename policy is explicit | REQUIRED / NOT EXECUTED |
| EXCOMP-C08 | Legacy rename/deleted/missing/null block evidence remains honest and not replaced by fabricated snapshot | REQUIRED / NOT EXECUTED |
| EXCOMP-C09 | Same-name different-ID observations never imply persisted identity/adoption/dedupe | REQUIRED / NOT EXECUTED |
| EXCOMP-C10 | Possible reused/unlinked block IDs follow approved ambiguity policy, not automatic equivalence | REQUIRED / NOT EXECUTED |
| EXCOMP-C11 | Legacy failure plus canonical match/no-match remains partial and source-qualified | REQUIRED / NOT EXECUTED |
| EXCOMP-C12 | Canonical failure plus legacy match/no-match remains partial and source-qualified | REQUIRED / NOT EXECUTED |
| EXCOMP-C13 | Both sources fail or load is pending: unavailable/loading, not empty/complete no-PR | REQUIRED / NOT EXECUTED |
| EXCOMP-C14 | Prove BOTH the real canonical persisted-envelope account/namespace/generation/untrusted-scope path (typed D0 isolation suppresses both sources before matching/date filters) AND the real legacy Health repository/driver owner-mismatch path through readAuthoritativeDatasets/readAll. Do not bypass legacy validation with a post-read adapter mock or assume it already fails paired closed: source-symmetric complete-source comparison must prove preserved typed owner isolation/another safe trust boundary; alternatively prove an explicit reviewed source-scoped partial contract, no contaminated legacy publication, no verified-absence/complete-source claim, and correct currentness | REQUIRED / NOT EXECUTED |
| EXCOMP-C15 | Strict selectedDate boundary, not today or browser-selected historical date, is enforced | REQUIRED / NOT EXECUTED |
| EXCOMP-C16 | Same-day UUID/row/ordinal technical order is never presented as performed-time chronology | REQUIRED / NOT EXECUTED |
| EXCOMP-C17 | Strength eligibility/formula distinguishes raw local compatibility from approved completed-only policy | REQUIRED / NOT EXECUTED |
| EXCOMP-C18 | Bodyweight uses approved reps semantics; no fabricated mass/external weight or accidental kg PR | REQUIRED / NOT EXECUTED |
| EXCOMP-C19 | Total/assisted/unassisted evidence and invalid/null/zero handling obey approved policy | REQUIRED / NOT EXECUTED |
| EXCOMP-C20 | Drop and normal families obey approved eligibility/reference rules without wrong pairing | REQUIRED / NOT EXECUTED |
| EXCOMP-C21 | Cardio parsing/mode/metric direction are approved; no arbitrary duration/distance PR | REQUIRED / NOT EXECUTED |
| EXCOMP-C22 | Internal/source/display units and inconsistent legacy metadata do not cause incompatible or display-rounded comparisons | REQUIRED / NOT EXECUTED |
| EXCOMP-C23 | Declared history horizon is enforced; one-year view cannot claim all-time absence/PR | REQUIRED / NOT EXECUTED |
| EXCOMP-C24 | Approved stable-scope read budget reuses one paired load; recovery exceptions are bounded/documented; no extra canonical scan per block/candidate | REQUIRED / NOT EXECUTED |
| EXCOMP-C25 | Same block/name/date/values never cause adoption, source suppression, dedupe or session/ID synthesis | REQUIRED / NOT EXECUTED |
| EXCOMP-C26 | Account A->B->A prevents stale comparison publication/click use | REQUIRED / NOT EXECUTED |
| EXCOMP-C27 | Selected-date A->B->A and late concurrent lookup/request continuations are fenced | REQUIRED / NOT EXECUTED |
| EXCOMP-C28 | Device/generation/enable-owner lifetime transitions and unmount prevent stale scope publication | REQUIRED / NOT EXECUTED |
| EXCOMP-C29 | If subscribed, durable save/delete synchronously invalidates comparison and refreshes once within shared freshness budget | REQUIRED / NOT EXECUTED |
| EXCOMP-C30 | Public cue/PR/suggestion copy exposes approved source/horizon/partial limitation, including no-result branch | REQUIRED / NOT EXECUTED |
| EXCOMP-C31 | Draft-versus-persisted achievement and no-PR/absence claims follow policy; incomplete evidence never becomes full-source truth | REQUIRED / NOT EXECUTED |
| EXCOMP-C32 | Default-OFF implementation preserves gates, V1/DB/backend/writer/data-plane/G6 frozen boundaries | REQUIRED / NOT EXECUTED |

## 18. Frozen boundaries and debt disposition

Exactly one documentation file is changed. Runtime/product code, tests, config, reader gates, DB version **7**, schema version **1**, stores/indexes/keyPaths, WorkoutSessionV1/validator, backend, canonical writer, bind/push/pull/full resync/reset, G6, Search PD decisions, and B1 cacheKey API remain unchanged.

All four reader gates remain false: `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED`, `HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED`, `HOME_WORKOUT_COMPOSITE_READER_ENABLED`, `SEARCH_WORKOUT_COMPOSITE_READER_ENABLED`.

All seven live-writer blockers remain OPEN: unbound pre-reset create; rollback visibility; old/new writer coexistence; mounted UI identity integration (dormant adapter subpart already closed); canonical field ownership; analytics/projection (now narrowed to remaining comparison/public claims/future mounted features); reset-fenced local edit policy. Characterization/narrowing is not closure.

`LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP` is separately recorded characterization debt/prerequisite for the affected future comparison trust contract, not automatically an eighth live-writer blocker. No writer activation decision or change to the closed default-OFF Search D0/D1 line follows from it.

`REL05G5A-001 = ACTIVATION_PREREQUISITE`; B1 cacheKey P3 = `OPEN_NON_BLOCKING`. Physical device/large-history/public activation QA remains unperformed. No automatic adoption, source suppression/dedupe, canonical ID synthesis, or legacy session synthesis is permitted from equal block ID, name, date, or set values. No Ready/merge/auto-merge/G6 action is part of this workstream.

## 19. Targeted validation and evidence limits

- Source inspection: graph, mounted consumers/copy, verification/order, inactive API predicates, exact V1/normalizers, D0 paired snapshot and freshness ownership at the pinned baseline.
- Existing tests: **12 files / 176 tests PASS**. Files: `previousMicroCue.test.ts`, `healthWeight.test.ts`, `healthAssistedReps.test.ts`, `workout/workoutMetrics.test.ts`, `workoutSetCount.test.ts`, `previousWorkoutProjection.test.ts`, `compositeWorkoutReadProjection.test.ts`, `compositePreviousWorkoutProjection.test.ts`, `verifiedWorkoutRangeSnapshot.test.ts`, `workoutRangeReader.test.ts`, `workoutSessionV1.test.ts`, `useHealthWorkoutRangeSnapshot.test.ts` (under their existing source locations).
- Four isolated source-function probes PASS: legacy positive/same-date exclusion, canonical-only omission, mixed-source legacy PR, unfinished historical threshold versus completed best cue. Existing source was transpiled in memory; the repository was stubbed, validators/orderer ran, and no test/probe file was added. These are not mounted browser or real persisted-IDB end-to-end acceptance.
- Existing tests prove their current helper/reader/D0/currentness contracts, not a future composite exercise-matching/PR policy. No future EXCOMP criterion is marked executed.
- No repository-specific Markdown/docs lint script was found in package scripts or CI. `git diff --check` is the docs static check; full frontend suite/typecheck/build were not run locally merely for this documentation task. Exact-head hosted CI is observed separately at publication, not assumed green here.
- The Supabase skill was used narrowly for the inactive API's authenticated account/date boundary. Changelog was retrieved read-only; no new Supabase feature/API, schema, auth, key or database change was made. This is not a project-wide auth/RLS security audit.

Correction validation is source inspection of the six boundaries in section 10 at the reviewed head; runtime sources are identical to the pinned main. The independent review's in-memory reproduction used the real legacy IndexedDB driver and coordinator with a healthy validated canonical-reader stub: account A's indexed wrapper contained a foreign `record.user_id`; legacy rejected with `health_local_verified_data_malformed`, while the paired result retained only canonical records as `partial_data`. That is current classification evidence, not real two-store/mounted acceptance, a claim of foreign-record leakage, or an EXCOMP-C14 PASS. No new test/probe file is included; the existing validation claims above retain their original scope.

Publication/correction remains a docs-only Draft targeting main. Its next step is focused independent rereview of `REL05G-EXCOMP-CHAR-001`, **not implementation**.
