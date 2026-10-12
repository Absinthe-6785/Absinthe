# REL-05G Health parent legacy previous-currentness D implementation

Current workstream: `REL_05G_HEALTH_PARENT_PREVDATA_FRESHNESS_D_IMPLEMENTATION_CORRECTION_01`.

Original implementation: `REL_05G_HEALTH_PARENT_LEGACY_PREVDATA_FRESHNESS_D_IMPLEMENTATION_01`.

Repository: `Absinthe-6785/Absinthe`. Workspace: `C:\Users\이도현\GitRepos\Absinthe`.

## Baseline and authorization

- Exact implementation base/main: `3e4a363841566c3b4137a7881d5654be3f732d9b`.
- [PR #769](https://github.com/Absinthe-6785/Absinthe/pull/769): MERGED / CLOSED; reviewed head `b93f2c4ae07b1f26cdc70245b3ee2fa331cb50cd`; merge commit equals the base above.
- [Post-merge CI 38195543323](https://github.com/Absinthe-6785/Absinthe/actions/runs/38195543323): all five required jobs completed/success at that exact main.
- The [merged product decision](REL-05G-health-parent-legacy-prevdata-freshness-product-decision.md) selects `D_HYBRID_STATE_DEPENDENT`, PRODUCT_OWNER_APPROVED. A/B/C/HOLD freshness alternatives remain NOT_SELECTED.
- This subsequent human task authorizes implementation and automated acceptance only. The merged policy document's historical publication lifecycle is not rewritten. Independent implementation review is still required; this document is not self-approval.

## Independent review and bounded correction

PR #770's reviewed head was `c102bf71adf50bc5fda56000ba79904e18294ed6`. The independent result was `CHANGES_REQUIRED`, with P0/P1/P2/P3 = 0/1/2/0. Its C08/C10/C12 and evidence-accuracy classifications were FAIL. The original blanket acceptance claim is superseded, not independently approved.

| Finding | Original defect | Current implementation-author status |
| --- | --- | --- |
| PR770-R01 / P1 | Held routine load restored a removed captured draft and lacked workflow/preset supersession. | CLOSED_PENDING_INDEPENDENT_REREVIEW |
| PR770-R02 / P2 | Assembly displayed a live historical fallback, so refresh blanked/reseeded an initialized count. | CLOSED_PENDING_INDEPENDENT_REREVIEW |
| PR770-R03 / P2 | Loading cleared typed parent rejection before trustworthy recovery. | CLOSED_PENDING_INDEPENDENT_REREVIEW |

The authorized correction changes HealthView, its existing previous-currentness hook, existing mounted/hook regression tests and this evidence document only. No new helper module, editor transaction framework, source owner, gate, writer or durable record is introduced. Closure labels above mean author-tested correction, not independent finding closure. The exact correction SHA and hosted run IDs are recorded in the publication report and PR body.

## One compatibility owner, two separate paths

[LegacyPreviousCurrentness](../src/components/views/features/health/legacyPreviousCurrentness.ts) owns in-memory qualification. [The hook](../src/components/views/features/health/useLegacyPreviousCurrentness.ts) binds it to one committed Health mount and the existing B1 parent eligibility lifetime. `previousEnabled` is internal eligibility derived from the existing `selectedDayComposite` prop, not a sixth rollout gate.

Gate OFF retains the original block-keyed cache, previous fetch behavior, PR/cue formulas and planning defaults. It subscribes to no additional focus/visibility/bootstrap/mutation listener and performs no additional source read, retry or UI status publication. AppContent, Home and Search behavior is unchanged.

Gate ON uses qualified payloads only. Query identity is account + strict before-selected-local-date cutoff + exact block ID + local legacy authority. Publication additionally requires the current committed owner/lifetime and the exact live per-block evidence object. Account/date/parent transitions replace lifetime identity; A→B→A cannot recover an old proof. Mutation/retry invalidation replaces affected evidence/flight identities synchronously. Neither numeric notification version, value equality, wall-clock age nor a child reader revision qualifies data.

Established B1 account/namespace/generation cache identity participates only in parent eligibility. A newly established different identity revokes the old owner. A null cache identity during ordinary canonical failure/retry does not pretend the legacy account-history query changed or erase an independently qualified result. Known account/date mismatch or typed B1/range isolation rejects the parent. No ID is repaired or invented.

R03 adds separate committed B1/range rejection provenance inside the existing hook. A pure render guard withholds evidence before layout reconciliation; the hook's layout effect commits the latch and configures the existing owner. HealthView-local ephemeral child booleans were insufficient because they lost the rejection during loading. The latch therefore lives with configuration/publication eligibility, not in a new cache/reader. `unknown`, loading, null identity and ordinary retry failure cannot clear a typed rejection. B1 recovery requires a matching account/date, established cache identity and settled complete pair. Range recovery requires settled complete previous/month views whose account/namespace/generation agree with the established B1 identity. Each rejecting boundary must recover; success of an unrelated boundary is insufficient. A genuinely new, affirmatively admitted parent scope can retire old rejection provenance, but owner replacement still revokes old evidence. Ordinary failure/loading without prior typed rejection retains independently qualified compatibility evidence and adds no legacy source read. No comparison publication revision is borrowed.

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

Synthetic owner-level `CompositeWorkoutReadIsolationError` rejects all consumed compatibility dependencies, including other already-current blocks and qualified negatives. Health's paired surface is suppressed without clearing its draft. A superseded typed failure cannot reject a newer qualified publication. No blind identity recovery or fallback to old positives is attempted.

`REAL_LEGACY_TYPED_ISOLATION_PATH = NOT_ESTABLISHED`. The actual unchanged adapter delegates directly to `readLocalPreviousWorkout` and repository validation. Independent review observed foreign legacy ownership reported as `health_local_verified_data_malformed`, not `CompositeWorkoutReadIsolationError`; foreign payload did not escape. Synthetic owner tests prove handling of that supplied class only, not a real legacy-adapter typed-isolation conversion. Generic malformed content is not newly converted into scope isolation. Mounted R03 tests inject typed failures into the real B1/range hook lifecycle; their underlying fixture readers remain doubles. They do not establish a new real legacy typed path.

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
- Routine load (R01): every explicit load owns a fresh intent object. A newer load supersedes it immediately; committed account/date/preset/configuration changes replace context identity, and explicit preset selection cancels the old intent before its async commit. A→B→A cannot revive the token. Owner/account/evidence and intent are rechecked inside the publication updater, not only before enqueueing it. Merge rule: preserve the current row's latest edits; if a row existed at capture but is now absent, omit it rather than restore the captured row. A genuinely new row may be inserted only by the still-current intent and unless an explicit removal marked its pending block cancelled. Unrelated current rows remain. Existing workouts and explicit preset/cardio counts remain independent; no canonical data enters the formula.
- Routine assembly (R02): an absent count key is UNINITIALIZED, not no-history. Qualified history or verified NO_MATCH can materialize the unchanged count formula once into the current assembly draft. Explicit preset/manual counts take precedence and are never overwritten by the initialization effect. Later refresh success/failure can change source status, not an initialized count. An initially unavailable/stale/refreshing field remains blank; its first qualifying result may initialize only while its key remains absent and the committed assembly context/evidence is still valid. Opening creates a fresh intent even for equal identities. A changed account/preset/routine-day fences and closes the old gated modal; a newly opened legitimate lifetime initializes independently. A selected-date change fences old history callbacks but retains already owned routine draft counts: preset persistence is not date-keyed. Gate OFF retains the original live fallback and lifecycle. Separate functional state updates do not nest updates in the active path.
- PR/diff map and best/per-set Previous cues: only qualified payloads are supplied to the existing helpers. Unqualified guidance is replaced with a legacy-specific state surface; hidden is not “no PR” or “no previous”.

`buildSetsFromPrevCount`, `plannedSetCount`, `routinePresetPlannedSetCount`, cardio/non-cardio clamps, unit/rounding, assistance/drop behavior, and `computeWorkoutPrBadge*` are unchanged. The corrected no-reseed and workflow-preservation claims are implementation-author evidence pending independent rereview, supported by the regression matrix below. Historical values are not copied into new sets. Canonical/comparison evidence never substitutes for compatibility inputs.

`RANGE_INVALIDATION_ALWAYS_INVALIDATES_PREVDATA = CONDITIONAL`; `B1_REFRESH_INVALIDATES_PREVDATA = CONDITIONAL`; `COMPARISON_PUBLICATION_REVISION_QUALIFIES_PREVDATA = NO`. Ordinary child-only retries/projection changes do not invalidate or qualify previous history. No existing narrower Refresh button is silently redefined. The clear internal parent-currentness recovery API is `previousOwner.invalidate('unknown')`; a future separately accepted parent-currentness gesture must call it in addition to the appropriate existing readers. Public gesture/copy acceptance remains pending.

[LegacyPreviousStatus](../src/components/views/features/health/LegacyPreviousStatus.tsx) provides accessible source-state markup. Four keys are appended in EN/KO/JA. The localization integrity test retains hashes for all 2,142 prior key/value pairs and checks the four-key suffix; no historical locale value is changed. These locale files are the only production changes outside Health/currentness, necessary for the requested state surface.

## Automated acceptance matrix

All results below are implementation-author regression evidence on the correction, pending independent exact-head rereview. They are not REVIEW_PASS or public acceptance. Original review passed C01-C07/C09/C11/C13-C15 source, but found C08/C10/C12 incomplete.

| Criterion | Author result | Evidence |
| --- | --- | --- |
| C01 | PASS_PENDING_INDEPENDENT_REREVIEW | Pure owner positive/negative account ABA; full-mounted returning-account durable fanout regression. |
| C02 | PASS_PENDING_INDEPENDENT_REREVIEW | Pure owner positive/negative cutoff ABA; mounted selected-date ABA regression. |
| C03 | PASS_PENDING_INDEPENDENT_REREVIEW | Held old completion after replacement failure stays UNAVAILABLE; obsolete typed failure cannot suppress replacement. |
| C04 | PASS_PENDING_INDEPENDENT_REREVIEW | Reversed equal responses preserve only the new evidence identity. |
| C05 | PASS_PENDING_INDEPENDENT_REREVIEW | Owner barriers; real IndexedDB save/delete cross captured previous reads; older maximum deletion; failed delete recovery; disjoint retention. |
| C06 | PASS_PENDING_INDEPENDENT_REREVIEW | Coalesced 1/20/100 dependencies and held/synchronous retries; unchanged exact read budgets. |
| C07 | PASS_PENDING_INDEPENDENT_REREVIEW | Close/re-entry tokens, StrictMode hook cleanup, mounted exit/re-entry regression. |
| C08 | PASS_PENDING_INDEPENDENT_REREVIEW | Original identity/authority fences plus mounted R03 loading/null rejection, matching recovery, and newly admitted account; hook query/generation and foreign recovery-identity rejection. |
| C09 | PASS_PENDING_INDEPENDENT_REREVIEW | Failure→verified current/no-match; real local bootstrap recovery; first assembly qualification without manual overwrite. |
| C10 | PASS_PENDING_INDEPENDENT_REREVIEW | Mounted typed B1/range rejection stays latched through held/failed retries; affirmative recovery only; simultaneous-boundary hook rejection. Synthetic legacy handling is not real-adapter typed proof. |
| C11 | PASS_PENDING_INDEPENDENT_REREVIEW | Ordinary child failure/retry retains independent legacy with zero additional previous reads; child revisions never qualify it. |
| C12 | PASS_PENDING_INDEPENDENT_REREVIEW | Mounted R01 removal/edit/preset ABA/reverse load/valid addition; R02 2→refresh→5/failure retains 2, manual 4, explicit 7, unavailable vs NO_MATCH default 3, reopen/preset lifetime separation and retention of owned count across date-query changes. |
| C13 | PASS_PENDING_INDEPENDENT_REREVIEW | Unchanged helpers/formulas; real historical max/latest-row behavior; canonical 900kg never enters planning/writer input. |
| C14 | PASS_PENDING_INDEPENDENT_REREVIEW | Offline retention, visibility/focus/bootstrap bursts, real local adapter without remote success. |
| C15_SOURCE_STATE_IMPLEMENTATION | PASS_PENDING_INDEPENDENT_REREVIEW | Mounted status, accessible role, EN/KO/JA parity and OFF DOM/read/listener tests. |
| C15_PUBLIC_ACCEPTANCE | NOT_EXECUTED | No public copy/gesture or physical-browser acceptance claim. |

Tests: [pure owner](../src/components/views/features/health/legacyPreviousCurrentness.test.ts), [hook/lifecycle](../src/components/views/features/health/useLegacyPreviousCurrentness.test.ts), and [real-adapter/mounted/durable integration](../src/components/healthExerciseComparisonAppContent.integration.test.ts). Existing AppContent comparison tests retain their original test-double cases; the added D cases explicitly delegate to the real previous adapter and real verified IndexedDB transactions. Paired canonical/B1 fixture readers remain test fixtures, not new physical/source qualification claims.

Correction evidence: 18 mounted cases plus five hook trust-latch cases cover R01-A–E, R02-A–F and R03-A–G, including combined cases and extra preset/date/simultaneous/foreign-identity checks. Before production edits, the first 16 mounted cases yielded 10 expected semantic failures / 6 passes at the reviewed head; fixture UUID/verified-account setup was corrected before that final red baseline. After correction all mounted cases and existing integration cases pass. R01-C uses a later explicit-count routine B that completes before held history-dependent A; it does not claim two independent source batches when the owner legitimately coalesces requests. R02 uses the real previous adapter/IndexedDB history mutations; R03 uses real parent hook/coordinator lifecycles with injected fixture source errors. No assertions or existing timeouts are weakened.

### First correction CI and completion-barrier follow-up

The first correction publication was `cd8854ea7d7961691b0b89169a8ca31ab45b403b`. [Push run 38209087157](https://github.com/Absinthe-6785/Absinthe/actions/runs/38209087157) and [PR run 38209090920](https://github.com/Absinthe-6785/Absinthe/actions/runs/38209090920) both passed typecheck/build/backend-rel05g1/backend-recovery, but their test jobs failed for different reasons; they are not successful final qualification.

- PR test: R01-A observed zero cards before its required new Squat row was published. Its fixed microtask/gate-ACK helper did not await the real async loader. The follow-up waits for the actual source Promises and settled parent fixture before evaluating workflow publication. A separately controlled pre-source gate proves that releasing the response gate is not source completion. The exact assertion remains one Squat and no resurrected Bench; cancelled-load assertions now also follow actual completion, avoiding false negative-result passes. R01-A passed ten independent local executions. This follow-up changes tests/documentation only, not production behavior, assertions or timeouts.
- Push test: unchanged `recoveryExportPackage.test.ts` K-320A ZIP-byte determinism failed. Both package source/test blobs are unchanged from main. A read-only in-memory execution of the actual archive function with JSZip 3.10.1 and a controlled two-second clock step reproduced different bytes for the same package: seven automatically created directory entries used current dates while explicit file dates stayed fixed. This separate pre-existing timestamp issue is outside this correction; neither recovery implementation nor its test is changed. A green exact-head CI run is still required, and any retry/failure must be disclosed rather than treating this failed run as PASS.

## Read budget and validation

- 1, 20 or 100 simultaneous same-scope dependencies: exactly one loader call; warm qualified negatives: zero additional calls.
- 20 synchronous invalidations: exactly one replacement call. Twenty retries during a held flight: two total calls (obsolete + replacement), never reuse the old proof.
- Three consumed IDs with 20 focus/visibility event pairs: initial one read + one recovery read; 20 bootstrap events in one burst add one read.
- Real mounted cold one-block history: exactly one previous adapter/readAll call. Ordinary range retry adds zero; focus recovery adds exactly one. Failed durable attempt recovery adds exactly one.
- Routine dependencies batch before per-block planning. Explicit preset/manual counts do not require previous proof for their count, although visible legacy PR/cue dependencies can independently need their own one batched read.
- Gate OFF: zero additional owned listeners, zero currentness reads/status/fanout. Mounted legacy card DOM is unchanged after focus/bootstrap events.
- No 100/500/1000-row timing, byte/memory, latency or physical performance thresholds were approved or measured. These are read-count assertions, not PERFORMANCE_ACCEPTANCE.

Historical original-head local validation on 2026-10-12 (not correction qualification):

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

Correction validation on 2026-10-12 before publication:

| Check | Result |
| --- | --- |
| Final focused command: 19 owner/hook/mounted/persistence/isolation/B1/range/formula/locale files | 272 PASS, 0 FAIL, 0 SKIP |
| `npm run typecheck` | PASS: editor, bare-identifier and app |
| `npm run build` | PASS; existing Browserslist-age/large-chunk warnings only |
| Full `npm test -- --maxWorkers=4` after completion-barrier follow-up | 756 files: 754 PASS, 1 known K-333B FAIL, 1 SKIP; 7,815 tests: 7,807 PASS, 1 known K-333B FAIL, 7 SKIP; 395.45s |
| `git diff --check` | PASS before publication |

Hosted CI on the new exact correction head is required before handoff for focused rereview. Its result does not independently close R01/R02/R03.

The sole local failure has the unchanged K-333B `Mutation anchor missing` signature. Both related Git blobs are identical to main/reviewed head. The raw CRLF source lacks the test's LF anchor; in-memory LF normalization finds it. No on-disk normalization, fixture change, timeout change or assertion relaxation was performed. `K333B_FAILURE_CLASSIFICATION = UNRELATED_CONFIRMED`, subject to exact-head hosted full-suite qualification.

## Frozen state and handoff

All five production reader gates remain false; PUBLIC_READER_ACTIVATION and HEALTH_PARENT_PUBLIC_READER_ACTIVATION remain NOT_AUTHORIZED. DB v7/schema v1, WorkoutSessionV1, stores/indexes/keyPaths and backend/Supabase/RLS remain unchanged. No AppContent/Home/Search source change, writer/bind/push/pull/resync/reset activation, G6, remote registry/API or durable freshness metadata is included.

`REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION`; prospective provenance PD01 remains `HOLD_NO_CAPABILITY_SELECTION_YET`; provenance collection/research NOT_AUTHORIZED; writer continuity NOT_YET_PROVEN; E3 NOT_ESTABLISHED; lifecycle evidence REMAINS_UNAVAILABLE; exact target control NOT_IMPLEMENTED; all seven live-writer blockers OPEN.

PERFORMANCE_ACCEPTANCE, PUBLIC_COPY_ACCEPTANCE, PHYSICAL_BROWSER_QA and C15_PUBLIC_ACCEPTANCE = NOT_EXECUTED.

`PUBLIC_READER_CURRENTNESS_PREREQUISITE = IMPLEMENTATION_CORRECTED_PENDING_INDEPENDENT_REREVIEW_PUBLIC_ACCEPTANCE_PENDING`; not CLOSED. Passing author regressions/CI is not independent review approval or public acceptance.

Next action after exact-head CI: `FOCUSED_REREVIEW_REL_05G_HEALTH_PARENT_PREVDATA_FRESHNESS_D_IMPLEMENTATION_CORRECTION_01`. Keep PR #770 Draft. No Ready, merge or auto-merge. Rereview the original failures before/after and regression-check owner/mutation/gate-OFF boundaries, trust recovery and read budget. Do not infer product/public/writer activation from passing automated tests.
