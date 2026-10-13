# REL-05G Health parent legacy previous-currentness D implementation

Current workstream: `REL_05G_HEALTH_PARENT_POSTMERGE_EVIDENCE_AND_PUBLIC_READINESS_REBASELINE_01` (docs-only post-merge evidence closure).

Original implementation: `REL_05G_HEALTH_PARENT_LEGACY_PREVDATA_FRESHNESS_D_IMPLEMENTATION_01`.

Repository: `Absinthe-6785/Absinthe`. Workspace: `C:\Users\이도현\GitRepos\Absinthe`.

## Baseline and authorization

- Exact implementation base/main: `3e4a363841566c3b4137a7881d5654be3f732d9b`.
- [PR #769](https://github.com/Absinthe-6785/Absinthe/pull/769): MERGED / CLOSED; reviewed head `b93f2c4ae07b1f26cdc70245b3ee2fa331cb50cd`; merge commit equals the base above.
- [Post-merge CI 38195543323](https://github.com/Absinthe-6785/Absinthe/actions/runs/38195543323): all five required jobs completed/success at that exact main.
- The [merged product decision](REL-05G-health-parent-legacy-prevdata-freshness-product-decision.md) selects `D_HYBRID_STATE_DEPENDENT`, PRODUCT_OWNER_APPROVED. A/B/C/HOLD freshness alternatives remain NOT_SELECTED.
- The implementation task authorized implementation and automated acceptance only. Its independent implementation review, corrections and Final Merge Gate subsequently completed. This post-merge task authorizes documentation only; it grants no public acceptance or activation. The merged policy document's historical publication lifecycle is not rewritten.

### Current merged baseline, independently reviewed closure

Observed on 2026-10-13 (UTC+09:00): [PR #770](https://github.com/Absinthe-6785/Absinthe/pull/770) is MERGED / CLOSED; reviewed/final head `cd632ec5af31f4d3b21398a920ad313fa5b492c1`; merge commit and exact live main `e20c8f58d3300e36758e9a4f85d65a029306d095`. [Post-merge push CI 38264972138](https://github.com/Absinthe-6785/Absinthe/actions/runs/38264972138) completed/success at that main for test, typecheck, build, backend-rel05g1 and backend-recovery (5/5). That run is merged implementation evidence, not this new docs head's CI.

Correction-02 focused independent rereview: `REREVIEW_PASS`, P0/P1/P2/P3 = `0/0/0/0`, `NEW_FINDINGS = NONE`. It CLOSED R04/R05 and preserved independent R01/R02/R03 closures. Final Merge Gate: PASS; fresh synthetic integration TREE `d72956aeb810162a374670a7d4d277169df9118e`, conflict-free and equal to the reviewed head tree; expected 15-file scope, both exact-head required CI runs successful. The gate recommended merge but performed no Ready/merge/activation; the subsequent human merge is recorded separately above.

```text
PR770_R01 = CLOSED
PR770_R02 = CLOSED
PR770_R03 = CLOSED
PR770_R04 = CLOSED
PR770_R05 = CLOSED
AUTOMATED_CURRENTNESS_ACCEPTANCE = PASS
PREVDATA_C01 = PASS
PREVDATA_C02 = PASS
PREVDATA_C03 = PASS
PREVDATA_C04 = PASS
PREVDATA_C05 = PASS
PREVDATA_C06 = PASS
PREVDATA_C07 = PASS
PREVDATA_C08 = PASS
PREVDATA_C09 = PASS
PREVDATA_C10 = PASS
PREVDATA_C11 = PASS
PREVDATA_C12 = PASS
PREVDATA_C13 = PASS
PREVDATA_C14 = PASS
PREVDATA_C15_SOURCE_STATE_IMPLEMENTATION = PASS
PREVDATA_C15_PUBLIC_ACCEPTANCE = NOT_EXECUTED
```

## Independent review and bounded correction

PR #770's reviewed head was `c102bf71adf50bc5fda56000ba79904e18294ed6`. The independent result was `CHANGES_REQUIRED`, with P0/P1/P2/P3 = 0/1/2/0. Its C08/C10/C12 and evidence-accuracy classifications were FAIL. The original blanket acceptance claim is superseded, not independently approved.

Correction-01 author publication preceded independent rereview: its intended state was `CORRECTED_PENDING_REREVIEW`, not independent closure. The former table's `CLOSED_PENDING_INDEPENDENT_REREVIEW` wording was the subsequently reviewed nonblocking R05 taxonomy defect; it did not claim approval and is corrected here without rewriting that chronology.

Focused independent rereview at correction-01 head `4e78d8097ce7c308d1b3c562c57648ed6bacc44d` returned `CHANGES_REQUIRED`, P0/P1/P2/P3 = 0/0/1/1. It CLOSED R01/R02/R03, passed C08/C10, and found C12 FAIL because of the distinct pending-first-initialization race R04. At correction-02 publication, R04/R05 were historically `CORRECTED_PENDING_REREVIEW`; the later independent rereview at `cd632ec5af31f4d3b21398a920ad313fa5b492c1` returned `REREVIEW_PASS`, 0/0/0/0, no new findings, CLOSED R04/R05 and passed C12. The current table records those independent closures, not author self-approval.

| Finding | Defect | Current state / basis |
| --- | --- | --- |
| PR770-R01 / P1 | Held routine load restored a removed captured draft and lacked workflow/preset supersession. | CLOSED — independent correction-01 rereview |
| PR770-R02 / P2 | Assembly displayed a live historical fallback, so refresh blanked/reseeded an initialized count. | CLOSED — independent correction-01 rereview |
| PR770-R03 / P2 | Loading cleared typed parent rejection before trustworthy recovery. | CLOSED — independent correction-01 rereview |
| PR770-R04 / P2 | Pending first initialization used an old history count after the same preset acquired a newer explicit count. | CLOSED — independent correction-02 rereview |
| PR770-R05 / P3 | Correction-01 finding-state wording did not match its intended pending-review taxonomy. | CLOSED — independent correction-02 rereview |

Correction-01 changed HealthView, its existing currentness hook, mounted/hook tests and this evidence document. Correction-02 was limited to HealthView, the existing mounted integration test and this document. Owner/latch/persistence/mutation modules were unchanged by correction-02; no additional production file or helper module was introduced. The final correction head is `cd632ec5af31f4d3b21398a920ad313fa5b492c1`; final [Push 38255920340](https://github.com/Absinthe-6785/Absinthe/actions/runs/38255920340) and [PR 38255927476](https://github.com/Absinthe-6785/Absinthe/actions/runs/38255927476) both completed/success for all five required jobs. Each hosted frontend suite: 755 files PASS / 1 SKIP; 7,819 tests PASS / 0 FAIL / 7 SKIP. Each run_attempt was 1. Historical failed runs below are retained, not substituted for this qualification.

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

`buildSetsFromPrevCount`, `plannedSetCount`, `routinePresetPlannedSetCount`, cardio/non-cardio clamps, unit/rounding, assistance/drop behavior, and `computeWorkoutPrBadge*` are unchanged. R01/R02/R03 closure was independently established at correction-01 rereview; correction-02 independent rereview subsequently CLOSED R04/R05 and passed C12, including the latest-preset-authority behavior. Historical values are not copied into new sets. Canonical/comparison evidence never substitutes for compatibility inputs.

### Correction-02: pending first initialization vs current preset authority

The real preset controller can replace the same preset through its `online`/background synchronization callback. Assembly's modal intent remains independent: existing owned counts, including manual counts, must not be reset by an external preset change. Therefore configuration updates do NOT reopen or clear the assembly lifetime.

HealthView maintains a layout-committed copied day/count snapshot. Each block has an identity token derived from semantic block type, preset-day membership and the effective explicit count, inside the existing account/preset/day/modal/date context. Equal semantic object clones retain the token; an observed semantic change replaces it even if later values return to equality. No raw `activePreset.days` reference is used as the R04 authority fence. A render-derived semantic key only triggers the initialization effect for in-place changes; it grants no authority.

At BOTH async-toggle and functional count-updater boundaries, current committed explicit/cardio authority is consulted first. A latest 7/8 is materialized only while the draft count key is absent. Otherwise history requires the original per-block token, still-qualified owner evidence and the current assembly intent. The initialization effect also rechecks committed selected membership; explicit removal revokes it synchronously. Per-block toggle intentions prevent an older addition from undoing a newer removal. No nested setters, speculative authority-ref writes or currentness-owner changes are introduced. All count calculations delegate to the unchanged production `routinePresetPlannedSetCount` formula; valid stored counts start at 1, zero is not explicit, and cardio remains 1.

Existing precedence is preserved: an already-owned temp count wins, whether initialized or manually edited. Thus manual 4 survives external explicit 7, and already-owned history 2 survives refresh 5/external preset changes. A still-uninitialized field uses the latest explicit count before history. This distinguishes R04's first-write race from closed R02's no-reseed rule.

For no-explicit → 7 → no-explicit while an addition is still pending and owns no count, the old history token remains revoked: no block/count is inserted by that callback. A fresh explicit add may use currently qualified history. If an explicit count has already been committed into the draft, it is an owned count and follows R02 preservation instead of being retrospectively erased. New modal lifetimes may initialize afresh. This adds no product precedence or canonical input.

`RANGE_INVALIDATION_ALWAYS_INVALIDATES_PREVDATA = CONDITIONAL`; `B1_REFRESH_INVALIDATES_PREVDATA = CONDITIONAL`; `COMPARISON_PUBLICATION_REVISION_QUALIFIES_PREVDATA = NO`. Ordinary child-only retries/projection changes do not invalidate or qualify previous history. No existing narrower Refresh button is silently redefined. The clear internal parent-currentness recovery API is `previousOwner.invalidate('unknown')`; a future separately accepted parent-currentness gesture must call it in addition to the appropriate existing readers. Public gesture/copy acceptance remains pending.

[LegacyPreviousStatus](../src/components/views/features/health/LegacyPreviousStatus.tsx) provides accessible source-state markup. Four keys are appended in EN/KO/JA. The localization integrity test retains hashes for all 2,142 prior key/value pairs and checks the four-key suffix; no historical locale value is changed. These locale files are the only production changes outside Health/currentness, necessary for the requested state surface.

## Automated acceptance matrix

The initial review passed C01-C07/C09/C11/C13-C15 source but found C08/C10/C12 incomplete. Correction-01 independent rereview passed C08/C10 and CLOSED R01/R02/R03, while C12 remained FAIL for R04. Correction-02 independent rereview CLOSED R04/R05 and passed C12 with prior closures preserved. Final Merge Gate verified C01-C14 and C15 source-state PASS. The table records current reviewed automated acceptance; C15 public acceptance remains separately NOT_EXECUTED. This documentation task supplies no new implementation/public approval.

| Criterion | Reviewed result | Evidence |
| --- | --- | --- |
| C01 | PASS | Pure owner positive/negative account ABA; full-mounted returning-account durable fanout regression. |
| C02 | PASS | Pure owner positive/negative cutoff ABA; mounted selected-date ABA regression. |
| C03 | PASS | Held old completion after replacement failure stays UNAVAILABLE; obsolete typed failure cannot suppress replacement. |
| C04 | PASS | Reversed equal responses preserve only the new evidence identity. |
| C05 | PASS | Owner barriers; real IndexedDB save/delete cross captured previous reads; older maximum deletion; failed delete recovery; disjoint retention. |
| C06 | PASS | Coalesced 1/20/100 dependencies and held/synchronous retries; unchanged exact read budgets. |
| C07 | PASS | Close/re-entry tokens, StrictMode hook cleanup, mounted exit/re-entry regression. |
| C08 | PASS | Independent correction-01 rereview: identity/authority fences, R03 loading/null rejection, matching recovery/new scope, query/generation and foreign recovery-identity rejection. Correction-02 preserves that boundary. |
| C09 | PASS | Failure→verified current/no-match; real local bootstrap recovery; first assembly qualification without manual overwrite. |
| C10 | PASS | Independent correction-01 rereview: typed B1/range rejection stays latched through held/failed retries; affirmative recovery and simultaneous-boundary separation. Synthetic legacy handling is not real-adapter typed proof; correction-02 changes no latch module. |
| C11 | PASS | Ordinary child failure/retry retains independent legacy with zero additional previous reads; child revisions never qualify it. |
| C12 | PASS | Independent correction-02 closure: R01/R02 regressions plus mounted R04 current explicit 7/latest 8 persistence-facing counts, manual 4, removal/reopen, semantic ABA, equivalent clones and in-place changes. Latest authority is revalidated at first-write time without reseeding owned counts. |
| C13 | PASS | Unchanged helpers/formulas; real historical max/latest-row behavior; canonical 900kg never enters planning/writer input. |
| C14 | PASS | Offline retention, visibility/focus/bootstrap bursts, real local adapter without remote success. |
| C15_SOURCE_STATE_IMPLEMENTATION | PASS | Mounted status, accessible role, EN/KO/JA parity and OFF DOM/read/listener tests; not final public-language/physical acceptance. |
| C15_PUBLIC_ACCEPTANCE | NOT_EXECUTED | No public copy/gesture or physical-browser acceptance claim. |

Tests: [pure owner](../src/components/views/features/health/legacyPreviousCurrentness.test.ts), [hook/lifecycle](../src/components/views/features/health/useLegacyPreviousCurrentness.test.ts), and [real-adapter/mounted/durable integration](../src/components/healthExerciseComparisonAppContent.integration.test.ts). Existing AppContent comparison tests retain their original test-double cases; the added D cases explicitly delegate to the real previous adapter and real verified IndexedDB transactions. Paired canonical/B1 fixture readers remain test fixtures, not new physical/source qualification claims.

Correction evidence: 18 mounted cases plus five hook trust-latch cases cover R01-A–E, R02-A–F and R03-A–G, including combined cases and extra preset/date/simultaneous/foreign-identity checks. Before production edits, the first 16 mounted cases yielded 10 expected semantic failures / 6 passes at the reviewed head; fixture UUID/verified-account setup was corrected before that final red baseline. After correction all mounted cases and existing integration cases pass. R01-C uses a later explicit-count routine B that completes before held history-dependent A; it does not claim two independent source batches when the owner legitimately coalesces requests. R02 uses the real previous adapter/IndexedDB history mutations; R03 uses real parent hook/coordinator lifecycles with injected fixture source errors. No assertions or existing timeouts are weakened.

Correction-02 adds 11 mounted R04 regressions covering A–H plus equal-object/in-place/owned-count variants. Before production changes, nine new cases yielded three expected semantic failures (2 instead of 7; 2 instead of 8; obsolete ABA callback inserting 2) and six passes, after correcting an initial UI selector setup error. The in-place selected-blank case additionally exposed the need for semantic effect notification. Tests use actual AppContent/HealthView, the real routine controller's online state-replacement path, real assembly effect/functional updates and the real previous adapter/IndexedDB history. Routine persistence is a fixture: assertions inspect the production controller's actual save-facing count payload, not a new durable routine-writer qualification. B1/range readers remain fixtures. The StrictMode assembly case starts from an owned Today draft; it does not qualify unrelated StrictMode hydration or physical-browser behavior.

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

Historically, exact-head push/PR hosted CI was not available at original artifact authoring. The historical local table does not self-certify later CI. Final correction-02 runs and exact-main post-merge CI are now verified above. The known unrelated Windows K-333B fixture anchor is unchanged; hosted exact-head CI supplies final full-suite qualification. No test assertion or timeout was weakened to obtain green CI. Read-budget assertions do not claim physical/performance acceptance.

Historical correction-01 validation on 2026-10-12 before publication:

| Check | Result |
| --- | --- |
| Final focused command: 19 owner/hook/mounted/persistence/isolation/B1/range/formula/locale files | 272 PASS, 0 FAIL, 0 SKIP |
| `npm run typecheck` | PASS: editor, bare-identifier and app |
| `npm run build` | PASS; existing Browserslist-age/large-chunk warnings only |
| Full `npm test -- --maxWorkers=4` after completion-barrier follow-up | 756 files: 754 PASS, 1 known K-333B FAIL, 1 SKIP; 7,815 tests: 7,807 PASS, 1 known K-333B FAIL, 7 SKIP; 395.45s |
| `git diff --check` | PASS before publication |

Correction-01 final [Push 38212546677](https://github.com/Absinthe-6785/Absinthe/actions/runs/38212546677) and [PR 38212551931](https://github.com/Absinthe-6785/Absinthe/actions/runs/38212551931) succeeded on `4e78d8097ce7c308d1b3c562c57648ed6bacc44d`, each with 7,808 frontend tests PASS / 7 SKIP / 0 FAIL and all five required jobs successful. Subsequent independent rereview closed R01/R02/R03, not CI itself. Correction-02's separate exact-head qualification is recorded above; prior-head runs remain historical only.

The sole local failure has the unchanged K-333B `Mutation anchor missing` signature. Both related Git blobs are identical to main/reviewed head. The raw CRLF source lacks the test's LF anchor; in-memory LF normalization finds it. No on-disk normalization, fixture change, timeout change or assertion relaxation was performed. `K333B_FAILURE_CLASSIFICATION = UNRELATED_CONFIRMED`, subject to exact-head hosted full-suite qualification.

### Correction-02 local validation

| Check | Author result |
| --- | --- |
| Focused owner/hook/mounted/durable/preset/formula/locale suite | 23 files / 420 PASS / 0 FAIL / 0 SKIP |
| R04 mounted matrix | 11 new cases; actual controller online transition, save-facing count payload, semantic ABA/equal-reference/in-place and owned-draft StrictMode coverage |
| R04 fresh-process repeat | 5/5 processes PASS; each 11 selected cases PASS / 35 unrelated cases filtered out |
| Full `npm test -- --maxWorkers=4` | 756 files: 754 PASS, 1 known K-333B FAIL, 1 SKIP; 7,826 tests: 7,818 PASS, 1 known K-333B FAIL, 7 SKIP; 291.30s |
| `npm run typecheck` / `npm run build` | PASS; existing Browserslist/chunk warnings only |
| `git diff --check` | PASS |

The author's full suite's sole failure was the unchanged CRLF K-333B anchor at test line 707 / `replaceOnce` line 285. K-320A passed locally; its separately diagnosed directory timestamp risk remains `UNRELATED_CONFIRMED`, not fixed or closed. Both areas were unchanged by PR #770. Historically R04/R05 were `CORRECTED_PENDING_REREVIEW` after author validation; they are now independently CLOSED. The later focused rereview reran 23 files / 420 PASS, R04 in five fresh processes (each 11 PASS / 35 filtered), typecheck PASS and build PASS (10.34s). Its local full suite: 756 files = 754 PASS / 1 known unrelated K-333B FAIL / 1 SKIP; 7,826 tests = 7,818 PASS / 1 same FAIL / 7 SKIP (258.34s). This local result is NOT all-green. The independent reviewer also passed eight read-only runtime-memory mounted diagnostics across three fresh processes; routine persistence/B1/range fixtures retain the limits stated above. Final Gate freshly passed the same 23-file / 420-test focused suite (8.56s). No supplemental diagnostic establishes physical QA or a real legacy-adapter typed conversion.

## Frozen state and handoff

All five production reader gates remain false; PUBLIC_READER_ACTIVATION and HEALTH_PARENT_PUBLIC_READER_ACTIVATION remain NOT_AUTHORIZED. DB v7/schema v1, WorkoutSessionV1, stores/indexes/keyPaths and backend/Supabase/RLS remain unchanged. No AppContent/Home/Search source change, writer/bind/push/pull/resync/reset activation, G6, remote registry/API or durable freshness metadata is included.

`REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION`; prospective provenance PD01 remains `HOLD_NO_CAPABILITY_SELECTION_YET`; provenance collection/research NOT_AUTHORIZED; writer continuity NOT_YET_PROVEN; E3 NOT_ESTABLISHED; lifecycle evidence REMAINS_UNAVAILABLE; exact target control NOT_IMPLEMENTED; all seven live-writer blockers OPEN.

PERFORMANCE_ACCEPTANCE, PUBLIC_COPY_ACCEPTANCE, PHYSICAL_BROWSER_QA and C15_PUBLIC_ACCEPTANCE = NOT_EXECUTED.

```text
PREVDATA_IMPLEMENTATION_STATUS = MERGED_AUTOMATED_ACCEPTANCE_COMPLETE_PUBLIC_ACCEPTANCE_PENDING
PR_770 = MERGED / CLOSED
PR_770_MERGE_COMMIT = e20c8f58d3300e36758e9a4f85d65a029306d095
PR_770_POSTMERGE_CI = PASS
PR_770_POSTMERGE_CI_RUN = 38264972138
PUBLIC_READER_CURRENTNESS_PREREQUISITE = IMPLEMENTED_AUTOMATED_ACCEPTANCE_COMPLETE_PUBLIC_ACCEPTANCE_PENDING
REAL_LEGACY_TYPED_ISOLATION_PATH = NOT_ESTABLISHED
PERFORMANCE_ACCEPTANCE = NOT_EXECUTED
PUBLIC_COPY_ACCEPTANCE = NOT_EXECUTED
PHYSICAL_BROWSER_QA = NOT_EXECUTED
PREVDATA_C15_PUBLIC_ACCEPTANCE = NOT_EXECUTED
```

The implementation/currentness automated prerequisite is complete; public readiness is not. The [post-prevData parent rebaseline](REL-05G-health-parent-public-readiness-post-prevdata-rebaseline.md) separates remaining public semantics, presentation, measurement/QA and frozen identity authority. Review of this docs-only publication is still required; it is not another implementation rereview or an activation decision.
