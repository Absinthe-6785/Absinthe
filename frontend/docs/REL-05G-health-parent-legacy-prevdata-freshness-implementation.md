# REL-05G Health parent legacy previous-currentness D implementation

Workstream: `REL_05G_HEALTH_PARENT_LEGACY_PREVDATA_FRESHNESS_D_IMPLEMENTATION_01`.

Repository: `Absinthe-6785/Absinthe`. Workspace: `C:\Users\이도현\GitRepos\Absinthe`.

## Baseline and authorization

- Exact implementation base/main: `3e4a363841566c3b4137a7881d5654be3f732d9b`.
- [PR #769](https://github.com/Absinthe-6785/Absinthe/pull/769): MERGED / CLOSED; reviewed head `b93f2c4ae07b1f26cdc70245b3ee2fa331cb50cd`; merge commit equals the base above.
- [Post-merge CI 38195543323](https://github.com/Absinthe-6785/Absinthe/actions/runs/38195543323): all five required jobs completed/success at that exact main.
- The [merged product decision](REL-05G-health-parent-legacy-prevdata-freshness-product-decision.md) selects `D_HYBRID_STATE_DEPENDENT`, PRODUCT_OWNER_APPROVED. A/B/C/HOLD freshness alternatives remain NOT_SELECTED.
- This subsequent human task authorizes implementation and automated acceptance only. The merged policy document's historical publication lifecycle is not rewritten. Independent implementation review is still required; this document is not self-approval.

## One compatibility owner, two separate paths

[LegacyPreviousCurrentness](../src/components/views/features/health/legacyPreviousCurrentness.ts) owns in-memory qualification. [The hook](../src/components/views/features/health/useLegacyPreviousCurrentness.ts) binds it to one committed Health mount and the existing B1 parent eligibility lifetime. `previousEnabled` is internal eligibility derived from the existing `selectedDayComposite` prop, not a sixth rollout gate.

Gate OFF retains the original block-keyed cache, previous fetch behavior, PR/cue formulas and planning defaults. It subscribes to no additional focus/visibility/bootstrap/mutation listener and performs no additional source read, retry or UI status publication. AppContent, Home and Search behavior is unchanged.

Gate ON uses qualified payloads only. Query identity is account + strict before-selected-local-date cutoff + exact block ID + local legacy authority. Publication additionally requires the current committed owner/lifetime and the exact live per-block evidence object. Account/date/parent transitions replace lifetime identity; A→B→A cannot recover an old proof. Mutation/retry invalidation replaces affected evidence/flight identities synchronously. Neither numeric notification version, value equality, wall-clock age nor a child reader revision qualifies data.

Established B1 account/namespace/generation cache identity participates only in parent eligibility. A newly established different identity revokes the old owner. A null cache identity during ordinary canonical failure/retry does not pretend the legacy account-history query changed or erase an independently qualified result. Known account/date mismatch or typed B1/range isolation rejects the parent. No ID is repaired or invented.

The owner is reconciled in layout effects, not by mutating its proof during speculative renders. A render-scope guard withholds incompatible evidence even before reconciliation. Unmount/StrictMode cleanup closes the old lifetime and resolves old consumers as suppressed. Pending writes retain their account-qualified tokens across account/date transitions; an A write cannot block B, but returning A cannot read before that write settles.

## States and source boundary

| State | Meaning / consumer permission |
| --- | --- |
| CURRENT | Successful verified local query with a matching previous row; unchanged payload is usable while its evidence object remains qualified. |
| NO_MATCH | Successful verified local query omitted this exact block/cutoff; existing no-history formulas may run. It does not mean never performed or whole-source empty. |
| REFRESHING | A qualifying batch is pending; no old PR/diff/cue or historical seed is exposed. |
| UNAVAILABLE | Ordinary read failure; not no-match and not a default-count permission. Explicit recovery is required; no automatic retry loop. |
| STALE_OR_SUPPRESSED | Never qualified, invalidated, foreign/superseded or rejected owner; private/raw values do not seed or publish. |

The adapter remains [fetchPrevWorkoutForBlocks](../src/components/views/features/health/prevWorkoutFetch.ts) → [readLocalPreviousWorkout](../src/lib/healthLocalRuntime.ts). One call performs one verified account `readAll()`. Its unchanged semantics are latest prior whole-set array/date and all-prior finite numeric kg maximum. The active owner accepts this successful omission contract only in local-working-copy mode with a nonempty account; unsupported authority/sign-out cannot manufacture NO_MATCH. It does not fabricate VERIFIED_EMPTY, because this adapter does not expose whole-account emptiness proof.

Typed `CompositeWorkoutReadIsolationError` rejects all consumed compatibility dependencies, including other already-current blocks and qualified negatives. Health's paired surface is suppressed without clearing its draft. A superseded typed failure cannot reject a newer qualified publication. No blind identity recovery or fallback to old positives is attempted.

## Mutation coverage and recovery

[The persistence boundary](../src/components/views/features/health/healthWorkoutPersistence.ts) is the production workout save/delete caller found in source inspection. [Mutation coverage](../src/components/views/features/health/legacyWorkoutMutationCoverage.ts) is an ephemeral same-JS-context begin/end signal, not a durable epoch or new writer/data plane.

1. After repository acquisition/current-operation admission, revoke affected proof immediately before the durable attempt. This must be pre-attempt: a concurrent read must not publish while a write is in progress.
2. Do not acquire replacement evidence while a relevant write token is active.
3. Preserve the existing durable-commit callback and its original-account fanout ordering. Returning-account reader races are not reopened.
4. In `finally`, retire coverage and acquire one post-attempt qualifying batch. A failed/aborted attempt also re-reads verified truth; it never revives a pre-attempt proof or reports successful absence.

New, unpersisted rows have proven new block/date impact; facts for another block or a cutoff at/before that date can remain qualified. Existing UUID saves can replace storage identity/old block/date, and ID/version-only deletes do not expose the deleted scope. They are explicitly UNKNOWN rather than pretending a view's current date proves old impact. UNKNOWN fences consumed dependencies in one batch. Thus older historical PR maxima, latest rows and possible old/new movements are covered without a guessed targeted rule. No extra pre-write account scan is added to manufacture targeting metadata.

Bootstrap completion is UNKNOWN impact and causes bounded requalification. Focus/visibility recovery covers uncertain missed/cross-context intervals: hidden visibility immediately revokes proof; visible/focus bursts coalesce at the existing 250ms-style lifecycle boundary. Offline alone causes no invalidation, and all qualifying reads remain local; network/login/cloud success is not required. This is local truth as of a verified snapshot, not continuous global/cloud completeness. Unobserved external writes are not claimed to be continuously covered by the same-context signal.

Only invalidated dependency IDs are queued. Same account/cutoff/lifetime requests share per-block flights and one microtask batch; direct add/routine can join only a still-valid flight. Invalidated flights cannot be reused. Many synchronous invalidations are one replacement batch; separate effective barriers can request separate batches. No automatic retry is performed after ordinary failure.

## Consumer integration and formulas

[HealthView](../src/components/views/HealthView.tsx) uses the one owner for:

- Direct exercise add: an explicit qualified result discriminator prevents unavailable/stale history from becoming default 1. Evidence is checked again before applying the new draft; functional updates preserve concurrently existing user drafts.
- Routine load: history-dependent blocks qualify in one batch. Each evidence object and the captured owner operation are checked again before publication. Existing workouts and explicit preset/cardio counts remain independent; no canonical data enters the formula.
- Routine assembly: unavailable historical counts display blank/status, not default 3. Newly history-derived counts require live proof. Existing preset/manual counts remain usable; modal/day/preset/query ABA is fenced. Separate functional state updates do not nest updates in the active path.
- PR/diff map and best/per-set Previous cues: only qualified payloads are supplied to the existing helpers. Unqualified guidance is replaced with a legacy-specific state surface; hidden is not “no PR” or “no previous”.

`buildSetsFromPrevCount`, `plannedSetCount`, `routinePresetPlannedSetCount`, cardio/non-cardio clamps, unit/rounding, assistance/drop behavior, and `computeWorkoutPrBadge*` are unchanged. Refresh does not reseed a valid current-scope draft or copy historical values into new sets. Canonical/comparison evidence never substitutes for compatibility inputs.

`RANGE_INVALIDATION_ALWAYS_INVALIDATES_PREVDATA = CONDITIONAL`; `B1_REFRESH_INVALIDATES_PREVDATA = CONDITIONAL`; `COMPARISON_PUBLICATION_REVISION_QUALIFIES_PREVDATA = NO`. Ordinary child-only retries/projection changes do not invalidate or qualify previous history. No existing narrower Refresh button is silently redefined. The clear internal parent-currentness recovery API is `previousOwner.invalidate('unknown')`; a future separately accepted parent-currentness gesture must call it in addition to the appropriate existing readers. Public gesture/copy acceptance remains pending.

[LegacyPreviousStatus](../src/components/views/features/health/LegacyPreviousStatus.tsx) provides accessible source-state markup. Four keys are appended in EN/KO/JA. The localization integrity test retains hashes for all 2,142 prior key/value pairs and checks the four-key suffix; no historical locale value is changed. These locale files are the only production changes outside Health/currentness, necessary for the requested state surface.

## Automated acceptance matrix

| Criterion | Result | Evidence |
| --- | --- | --- |
| C01 | PASS | Pure owner positive/negative account ABA; existing full-mounted returning-account durable fanout regression. |
| C02 | PASS | Pure owner positive/negative overlapping cutoff ABA; mounted selected-date ABA regression. |
| C03 | PASS | Held old completion after replacement failure stays UNAVAILABLE; obsolete typed failure cannot suppress replacement. |
| C04 | PASS | Reversed equal responses preserve only the new evidence identity. |
| C05 | PASS | Owner save/delete barriers; real IndexedDB save/delete cross a captured previous read; older maximum deletion preserves the latest prior row and restores PR arithmetic; failed durable delete requalifies truth; proven disjoint retention. |
| C06 | PASS | Coalesced 1/20/100 dependencies, 20 retries before a batch and during a held read; exact read counts below. |
| C07 | PASS | Close/re-entry tokens, StrictMode hook cleanup, existing mounted exit/re-entry regression. |
| C08 | PASS | Device/namespace/generation parent identity changes, account owner rejection, unsupported authority/sign-out; no identity repair. |
| C09 | PASS | Failure→verified current/no-match; real local recovery after bootstrap. |
| C10 | PASS | Rejected parent and typed legacy isolation revoke all positive/negative guidance synchronously. |
| C11 | PASS | Ordinary range/comparison retry does not re-read/qualify legacy; independently current legacy survives canonical child operations. |
| C12 | PASS | Mounted add/routine unavailable vs verified no-match default 1/3; explicit preset 7; assembly blank then explicit manual 4; history refresh does not change the existing one-set/20kg draft. |
| C13 | PASS | Unchanged formula/helper regression; real historical max/latest-row behavior beside canonical 900kg not used in writer/planning. |
| C14 | PASS | Offline retention, hidden/visible and focus bursts, bootstrap bursts, local adapter without remote success. |
| C15_SOURCE_STATE_IMPLEMENTATION | PASS | Typed states, mounted suppressed/refreshing/unavailable/no-match, accessible role, EN/KO/JA parity and OFF DOM/read/listener tests. |
| C15_PUBLIC_ACCEPTANCE | NOT_EXECUTED | No public copy/gesture or physical-browser acceptance claim. |

Tests: [pure owner](../src/components/views/features/health/legacyPreviousCurrentness.test.ts), [hook/lifecycle](../src/components/views/features/health/useLegacyPreviousCurrentness.test.ts), and [real-adapter/mounted/durable integration](../src/components/healthExerciseComparisonAppContent.integration.test.ts). Existing AppContent comparison tests retain their original test-double cases; the added D cases explicitly delegate to the real previous adapter and real verified IndexedDB transactions. Paired canonical/B1 fixture readers remain test fixtures, not new physical/source qualification claims.

## Read budget and validation

- 1, 20 or 100 simultaneous same-scope dependencies: exactly one loader call; warm qualified negatives: zero additional calls.
- 20 synchronous invalidations: exactly one replacement call. Twenty retries during a held flight: two total calls (obsolete + replacement), never reuse the old proof.
- Three consumed IDs with 20 focus/visibility event pairs: initial one read + one recovery read; 20 bootstrap events in one burst add one read.
- Real mounted cold one-block history: exactly one previous adapter/readAll call. Ordinary range retry adds zero; focus recovery adds exactly one. Failed durable attempt recovery adds exactly one.
- Routine dependencies batch before per-block planning. Explicit preset/manual counts do not require previous proof for their count, although visible legacy PR/cue dependencies can independently need their own one batched read.
- Gate OFF: zero additional owned listeners, zero currentness reads/status/fanout. Mounted legacy card DOM is unchanged after focus/bootstrap events.
- No 100/500/1000-row timing, byte/memory, latency or physical performance thresholds were approved or measured. These are read-count assertions, not PERFORMANCE_ACCEPTANCE.

Local validation on 2026-10-12 before publication:

| Check | Result |
| --- | --- |
| Final focused command: 18 owner/hook/mounted/persistence/isolation/formula/locale files | 226 PASS, 0 FAIL, 0 SKIP |
| Full `npm test -- --maxWorkers=4` | 756 files: 754 PASS, 1 FAIL, 1 SKIP; 7,792 tests: 7,784 PASS, 1 FAIL, 7 SKIP |
| Sole bounded-worker full-suite failure | Known Windows K-333B `transactionEvidenceProtocol.test.ts` fixture-anchor mismatch; unchanged source/test, no fix attempted |
| Earlier default-worker full suite | K-333B plus two unrelated 5s production-dormancy source-scan timeouts; bounded workers removed both timeouts without changing tests/timeouts |
| `npm run typecheck` | PASS: editor, bare-identifier and app checks |
| `npm run build` | PASS; existing Browserslist-age/large-chunk warnings, no build failure |
| `git diff --check` | PASS |

Exact-head push/PR hosted CI is required and recorded in the publication report/PR body. At artifact authoring it is not yet available; this historical local validation table does not self-certify later CI. The known unrelated Windows K-333B fixture anchor is not changed; hosted exact-head CI supplies final full-suite qualification. No test assertion or timeout is weakened to obtain green CI. Read-budget assertions do not claim physical/performance acceptance.

## Frozen state and handoff

All five production reader gates remain false; PUBLIC_READER_ACTIVATION and HEALTH_PARENT_PUBLIC_READER_ACTIVATION remain NOT_AUTHORIZED. DB v7/schema v1, WorkoutSessionV1, stores/indexes/keyPaths and backend/Supabase/RLS remain unchanged. No AppContent/Home/Search source change, writer/bind/push/pull/resync/reset activation, G6, remote registry/API or durable freshness metadata is included.

`REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION`; prospective provenance PD01 remains `HOLD_NO_CAPABILITY_SELECTION_YET`; provenance collection/research NOT_AUTHORIZED; writer continuity NOT_YET_PROVEN; E3 NOT_ESTABLISHED; lifecycle evidence REMAINS_UNAVAILABLE; exact target control NOT_IMPLEMENTED; all seven live-writer blockers OPEN.

PERFORMANCE_ACCEPTANCE, PUBLIC_COPY_ACCEPTANCE, PHYSICAL_BROWSER_QA and C15_PUBLIC_ACCEPTANCE = NOT_EXECUTED. Public currentness prerequisite is implementation/automated-evidence complete only when the final exact-head regression gates pass; public acceptance remains pending, not CLOSED.

Next action: `INDEPENDENT_REVIEW_REL_05G_HEALTH_PARENT_PREVDATA_FRESHNESS_D_IMPLEMENTATION_01`. Keep the implementation PR Draft. No Ready, merge or auto-merge. Review request ordering/ABA, mutation coverage, negative-result distinction, every planning consumer, PR/cue suppression, gate-OFF equivalence, conditional child recovery and read budget. Do not infer product/public/writer activation from passing automated tests.
