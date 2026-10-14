# REL-05G shared Health workout date ABA correction: scope and design

Task: `REL_05G_HEALTH_WORKOUT_OPERATION_DATE_ABA_CORRECTION_01_SCOPE_DESIGN`.

Status: `SCOPE_DESIGN_CORRECTION_01_PENDING_FOCUSED_REREVIEW`. The original independent review returned `CHANGES_REQUIRED` (P0/P1/P2/P3 = 0/0/1/0, finding PR774-R01). This docs-only correction makes real mounted draft/hydration preservation proof mandatory; PR774-R01 is `CORRECTED_PENDING_REREVIEW`, not self-declared CLOSED. The selected lifetime mechanism is unchanged. This document specifies Slice 0. It does not implement it or authorize runtime work. Every proposed regression scenario and ABA0 criterion remains `REQUIRED / NOT_EXECUTED`.

## 1. Exact baseline and authority

Repository: `Absinthe-6785/Absinthe`; canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`.

- Live `origin/main` was verified as `295c6711aafaf35410e2b187ffccc0627762684c` before authoring.
- [PR #773](https://github.com/Absinthe-6785/Absinthe/pull/773) is MERGED/CLOSED. Its reviewed head was `21a0b706ce4fdef7a8b6fc63e1fb3d15fa2baa5c`; its merge commit is this baseline.
- [Post-merge CI 38403618207](https://github.com/Absinthe-6785/Absinthe/actions/runs/38403618207) targets that merge commit. `test`, `typecheck`, `build`, `backend-rel05g1`, and `backend-recovery` all completed successfully.
- The current-main [product decision](REL-05G-health-parent-partial-source-availability-product-decision.md) selects Option C. The current-main [integration design](REL-05G-health-parent-partial-source-availability-integration-design.md), sections 24, 26, 27, 30 and 31, supplies the shared-correction exception, Slice 0 dependency and ABA0-C01 through ABA0-C12. Publication-time pending-review labels in the merged artifact are historical; PR773-R01 closed at design level after independent rereview. The runtime defect remains open.

```text
BASE_MAIN = 295c6711aafaf35410e2b187ffccc0627762684c
PR_773 = MERGED / CLOSED
PR_773_REVIEWED_HEAD = 21a0b706ce4fdef7a8b6fc63e1fb3d15fa2baa5c
PR_773_MERGE_COMMIT = 295c6711aafaf35410e2b187ffccc0627762684c
PR_773_POSTMERGE_CI = PASS
PR_773_POSTMERGE_CI_RUN = 38403618207
SLICE_0 = SHARED_DATE_OPERATION_ABA_CORRECTION
DATE_ABA_FIX_SCOPE = BROADER_EXISTING_DEFECT
HEALTH_WORKOUT_OPERATION_SCOPE_DATE_ABA = CONFIRMED_EXISTING_SHARED_UI_CURRENTNESS_DEFECT
DATE_OPERATION_SCOPE_TARGET = ACCOUNT_GENERATION_PLUS_OPAQUE_DATE_LIFETIME
DATE_EQUALITY_ALONE = INSUFFICIENT
GATE_OFF_EQUIVALENCE_DESIGN = PASS_EXCEPT_FOR_SEPARATELY_REVIEWED_SHARED_DATE_ABA_CORRECTION
DESIGN_IMPLEMENTATION_READY = NO_PENDING_SHARED_DATE_ABA_CORRECTION
RUNTIME_DATE_ABA_CORRECTION = NOT_IMPLEMENTED
```

## 2. Observed source and existing proof

These are observations at the baseline, not proposed implementation results. Source anchors were rechecked rather than copied from old design references.

| Source | Observed boundary |
| --- | --- |
| [Operation scope](../src/components/views/features/health/healthWorkoutOperationScope.ts), lines 3-13 | Scope has `accountOperation` and `dateKey`; currentness uses equal date strings and the supplied account-generation predicate. No distinct date lifetime. |
| [Operation-scope tests](../src/components/views/features/health/healthWorkoutOperationScope.test.ts), lines 14-52 | Delayed Save/Delete after X→Y and Save after account switch are covered. They do not prove X1→Y→X2. |
| [HealthView](../src/components/views/HealthView.tsx), lines 131-148 and 436-443 | Mount fencing uses a passive effect. Account ID/generation refs update during render and the existing predicate reads them. The active workout date ref also updates during render. It is not committed date authority and can observe a speculative date render. |
| HealthView, lines 1020-1065 | Removal first marks the routine-load intent, then captures the shared scope. Session/temp IDs take the draft-only branch. Persisted rows send captured ID/version/account to `deleteHealthWorkout`; post-await scope checks guard cache mutations, row replacement, dirty/storage clear and failure toast. |
| HealthView, lines 1215-1303 | Save checks nonempty rows, captures scope, sets saving, normalizes units, invokes persistence, then checks scope. Local success replaces IDs/versions, clears saving/dirty/storage, locks, toasts and mutates caches. Remote success/partial/failure and catch have their own UI effects; remote success/partial schedules a mobile animation-frame scroll. |
| HealthView, lines 557-582 | Account/date changes reset lock/saving and other existing state in a passive effect. Qualified hydration follows existing dirty protection. Slice 0 must not redesign these owners. |
| [Draft hook](../src/components/views/features/health/useHealthWorkoutDraft.ts) | Account/date storage key; passive reset/restore and persistence effects; dirty hydration guard; `clearDirtyAfterSave` clears the dirty ref, state and scoped storage. No date-operation token or storage migration exists. |
| [Account safety](../src/lib/healthBackfillUiSafety.ts) | Account generation compares both ID and generation; conflict disposition does not clear draft or show success. It remains an independent conjunct. |
| [Persistence](../src/components/views/features/health/healthWorkoutPersistence.ts), lines 87-190 | Local Save/Delete await repository construction, check `shouldContinue`, dispatch the repository operation, call `onLocalCommit` after success, then check currentness again. Remote Save sends sequential POSTs and checks currentness after each response/catch; remote Delete sends DELETE, checks status, then currentness. |
| [AppContent](../src/components/AppContent.tsx), lines 370-379 and 439-442 | Payload-free notification takes the captured original account ID. It independently gates the currently mounted eligible owners and invalidates range before B1. A stale HealthView operation does not itself authorize another account's readers. |

Directly inspected tests:

- [Persistence tests](../src/components/views/features/health/healthWorkoutPersistence.test.ts): `invalidates immediately after durable local save/delete, before a stale completion can return`; request/UUID/version/session-filter regressions; sequential remote requests, partial/failure outcomes, stale-scope stop and expected-version Delete.
- [Mounted HealthView tests](../src/components/views/healthRoutinePresetAccountIsolation.test.ts), lines 556-640: actual Save/Delete original-account notification wiring and deferred A1→B→A2 completion with UI suppression. Persistence is mocked here, so this layer alone does not prove a real transaction.
- [Full mounted races](../src/components/healthWorkoutFullMountedRace.integration.test.ts), lines 388-459: real HealthView + AppContent + persistence path with a deferred fake repository; A1 Save/Delete commits refresh A2 readers while old UI/publications are fenced. Its Home tests also preserve routing after Health unmount. This is automated integration, not a physical browser or actual backend transaction proof.
- [Fanout integration](../src/components/healthWorkoutRangeConsumerIntegration.test.ts), lines 115-185: real persistence notification, payload-free range→B1 order, A1→B→A2 delivery, other-account and unmount filtering.

No existing mounted test in these seams proves date X1→Y→X2. Account ABA coverage must remain; it is not interchangeable with date ABA proof.

Correction-01 source recheck at the same main SHA:

- `useHealthWorkoutDraft.ts`, lines 59-76, restores account/date drafts in a passive effect. Nonempty restoration sets both `isDirty` and `isDirtyRef.current` true. `scopeTransitionRef` skips the persistence effect's old render snapshot once; lines 80-88 otherwise write `JSON.stringify(localWorkouts)` only when dirty and nonempty. This is not a new storage parser or a token-owned draft.
- `healthBackfillUiSafety.ts`, lines 9-30, owns the real `localHealthDraftKey` and `readLocalHealthWorkoutDraft`: account/date key, JSON array parsing, and corrupt-byte removal. Both exports must remain real in the new mounted track.
- HealthView, lines 457-471 and 559-582, uses that real hook, separately resets saving/lock on account/date changes, and adopts sorted `workouts` only when the existing source condition permits, `isDirtyRef.current` is false, and the array differs from `lastHydratedWorkoutsRef`. Nonempty clean hydration locks; restored dirty rows block hydration. The comment about hook ownership does not move the actual HealthView hydration effect into the hook.
- `healthRoutinePresetAccountIsolation.test.ts`, lines 88-98, replaces the draft reader with `() => null`. Its passing late-completion checks are fixture-level evidence, not proof of restoration/persisted-byte safety. It cannot satisfy H01-H09 unchanged.
- [Real draft hook tests](../src/components/views/features/health/useHealthWorkoutDraft.test.ts) cover scoped restoration, dirty state, clean hydration, date/account transitions and acknowledgement storage clear. They mount a hook probe, not the real HealthView hydration/reset effects or the proposed layout owner; they are supporting regressions only.
- [Startup account integration](../src/components/AppContent.startup.integration.test.ts), lines 115-132 and 304-331, uses the real draft hook inside a mocked HealthView. [Comparison mounted integration](../src/components/healthExerciseComparisonAppContent.integration.test.ts), lines 539-558, preserves edited inputs during source refresh in a real HealthView. Neither substitutes for the new joint publication/draft/hydration proof.
- The full mounted race fixture uses a real HealthView, draft hook and persistence, but its fake selected-day snapshot is hardcoded to one date and its daily hook is mocked. Future date tests must make source snapshots account/date-specific, not reuse this as an always-eligible hydration oracle. [Real daily owner](../src/hooks/useDaily.ts), lines 142-152, uses account/date SWR keys and `readLocalHealthDaily`; the gated counterpart uses [verified paired legacy projection](../src/components/views/features/health/selectedDayLegacySnapshot.ts). These are distinct source qualification seams, not date-token logic.

The proposed layout publication can flush passive effects earlier; that platform fact is not application preservation evidence. The following required mounted track addresses this proof-contract omission without a production draft/hydration rewrite; independent finding closure is pending rereview.

## 3. Exact failure and intentional correction

Save captures account generation A and date key X while X1 is current. A repository call remains pending. Health commits Y, then commits X2 with the same date string. The existing predicate now accepts `(A, X)` again. Old Save may replace X2 draft rows, clear its dirty/storage state, lock it or show a success/failure toast. Persisted Delete can similarly apply its old row filter and clear current draft storage. The data request still targets its captured account/date/ID; these facts confirm UI/action currentness failure, not a writer-data durability failure.

The future shared correction must distinguish X1 and X2 even with all composite gates OFF. Fixing only a future Option C candidate is insufficient. It must also remove the workout operation's reliance on a date ref written during render. Unrelated Health domain account owners, readers and draft storage keep their current contracts.

## 4. Alternatives and selected ownership

| Alternative | Assessment |
| --- | --- |
| A. Opaque object lifetime issued during commit | Selected. Identity comparison has no counter reset/overflow semantics; fresh setup can never reuse an old object. The object stays in memory and contains no payload/provenance/writer capability. |
| B. Monotonic date generation issued during commit | Viable if combined with instance identity and no reset/reuse. Adds counter/instance rules without reducing the React publication problem; not selected. A render counter is invalid. |
| C. `useMemo` date object, render ref assignment, passive-effect-only generation, or date-value comparison | Not authority mechanisms. Memo identity may be discarded; render may be abandoned; passive retirement can lag commit; equal dates admit ABA. |

Owner: one unconditional `useHealthWorkoutOperationLifetime` hook in the existing HealthView, independent of Option C gates. Keep the pure capture/currentness functions in `healthWorkoutOperationScope.ts`; add a small React owner module because a pure helper alone cannot prove committed authority.

The owner has an initially null private current-authority ref and initially null publication state. Render neither issues nor retires a lifetime. The ref is read only in events/currentness checks and written only in layout setup/cleanup. Publication state binds handler closures without reading a mutable authority ref during render.

### Committed lifetime mechanism

1. Use one layout effect keyed only by primitive `accountId`, the existing account-generation snapshot and normalized `dateKey`. Unrelated draft/lock/read/array/function rerenders are not dependencies.
2. After a valid account/date commit, setup creates a fresh frozen opaque object and a private descriptor containing that object and the committed account/date snapshot. Install the descriptor in the current ref and publish the same descriptor through state.
3. This state update produces a synchronous binding render before paint. It rebinds event handlers to the issued token; it is necessary, not an incidental ref reread. Initial/transition renders with null or mismatched publication are fenced. Same-key publication render does not rerun the effect or issue another token.
4. Cleanup clears the ref only if it still points to that setup's exact descriptor. Never restore the previous descriptor. Every dependency transition, layout teardown and unmount retires the old token before a later asynchronous continuation can be current.
5. A replacement setup always issues a new object, including X2, remount, StrictMode cleanup/setup replay or layout reconnection. There is no cache of tokens by date string.
6. Invalid account/date commits publish no authority. Sign-out either changes context to invalid or unmounts Health; both retire the current token.

`dateToken(X1) != dateToken(X2)` is mandatory. The read-only date/account metadata may match; object identity may not. A new Date object that formats to the same local key does not rotate authority by itself.

```text
DATE_LIFETIME_OWNER = HEALTH_VIEW_UNCONDITIONAL_USE_HEALTH_WORKOUT_OPERATION_LIFETIME
COMMITTED_DATE_LIFETIME_MECHANISM = LAYOUT_EFFECT_ISSUED_OPAQUE_TOKEN_WITH_STATE_PUBLICATION_AND_EXACT_CLEANUP
CURRENT_AUTHORITY_WRITES_DURING_RENDER = NONE
STALE_HANDLER_TOKEN_REFRESH = FORBIDDEN
```

## 5. React timing and closure contract

The React platform basis is explicit: layout setup/cleanup follows committed dependency changes, layout state updates complete before paint, and such updates can flush remaining passive effects earlier. This design uses those documented boundaries, not render counts. See [React useLayoutEffect](https://react.dev/reference/react/useLayoutEffect). The existing draft/reset effects must be checked under this publication render; no storage format or hydration rule changes are proposed.

Ref mutation during render is unsuitable authority; see [React useRef](https://react.dev/reference/react/useRef). Memoization is not a semantic lifetime guarantee; see [React useMemo](https://react.dev/reference/react/useMemo). Development effect replay requires reversible cleanup; see [React StrictMode](https://react.dev/reference/react/StrictMode). These are platform facts. The token ownership/capture scheme is this task's proposed design and still requires the deterministic tests below.

| Timing case | Required future behavior |
| --- | --- |
| Event from last committed bound tree | Its closure carries the publication token and account-generation value from that render. Compare them with the owner's current descriptor at event entry. |
| Unrelated same-date rerender | Effect dependencies unchanged; same token; current Save/Delete remains admitted. Do not depend on freshly allocated callbacks or account objects. |
| Pending/suspended/abandoned Y render while committed X remains visible | No layout setup/cleanup for the abandoned render, no authority ref write, no token issuance; committed X remains valid. Do not keep the existing render-written active-date ref as an alternative currentness source. |
| Y commits | Cleanup revokes X; new Y token is issued. Intermediate old publication cannot capture a valid operation for Y. |
| X2 commits after Y | Fresh X2 token; X1 scope and any retained X1 event callback fail identity checks even though their date keys equal X2. |
| First mount or pre-publication layout callback | Bound token is null/mismatched; return without toast/state/write. The subsequent binding render admits normal browser events. Do not upgrade a null-bound callback from the current ref. |
| Promise resolution after commit | Read the current ref through a stable getter, but compare against the immutable captured operation token; never replace the captured token. |
| StrictMode setup→cleanup→setup | First token is retired; replacement token is fresh; no old scope becomes valid again. The settled second lifetime admits valid operations. |
| Unmount / logout / layout disconnection | Layout cleanup immediately revokes date authority even before the existing passive mounted flag clears. A later remount/reconnection cannot revive the object. |
| Account A1→B→A2 | Account ID/generation participates in issuance and capture; the existing `currentAccountOperation` remains an independent check. Do not replace or relax its generation or mounted check. |

React commit work is synchronous; ordinary browser events and Promise microtasks do not interleave within its layout cleanup/setup. Programmatic child-layout/ref callbacks must nevertheless fail closed until they carry the bound published token. No event replay may acquire a newer token on behalf of an older closure.

The current account refs are already mutated during render. Slice 0 does not redesign that broader account owner: speculative account work can conservatively reject an operation through the existing account predicate. Do not claim that every speculative account transition preserves old admission. R05's date-only abandoned-render proof must hold independently; account ABA cannot be weakened to achieve it.

## 6. Future operation-scope API

Proposed contract, not executable implementation:

```ts
type HealthWorkoutDateLifetime = Readonly<{ readonly [dateLifetimeBrand]: true }>;
type HealthWorkoutOperationScope = Readonly<{
  accountOperation: HealthAccountGenerationToken;
  dateKey: string;
  dateLifetime: HealthWorkoutDateLifetime;
}>;
type CommittedWorkoutAuthority = Readonly<{
  accountOperation: HealthAccountGenerationToken;
  dateKey: string;
  dateLifetime: HealthWorkoutDateLifetime;
}>;
// Hook publishes a render-bound descriptor and a stable event-time getter.
// The opaque brand is private to the owner; identity, not structural shape, grants currentness.
captureHealthWorkoutOperationScope(
  renderBound: CommittedWorkoutAuthority | null,
  renderAccount: HealthAccountGenerationToken,
  renderDateKey: string,
  current: CommittedWorkoutAuthority | null,
  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean,
): HealthWorkoutOperationScope | null;
isCurrentHealthWorkoutOperationScope(
  scope: HealthWorkoutOperationScope,
  current: CommittedWorkoutAuthority | null,
  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean,
): boolean;
```

Capture requires nonnull bound/current descriptors with identical lifetime objects, matching date keys and account ID/generation snapshots, valid context, and the independent current-account predicate. Return a frozen scope with copied account metadata. Currentness requires that exact token still be the owner's installed token, all metadata agree, and the account predicate remains true. Missing, malformed, foreign or retired lifetime returns null/false; no optional token overload and no date-equality compatibility path.

HealthView takes an account-generation value snapshot for each render; Save/Delete closures retain that value and the publication-state descriptor. They must not read the latest generation ref to stamp an old callback at invocation. The event-time getter reads current authority only to validate, never to supply a replacement token. Existing scopes from X1 remain immutable throughout async work.

Migrate the two production capture sites and all helper tests together. `HealthWorkoutOperationScope` is transient UI state, not persisted or transmitted; there is no storage/schema/version migration. Search all callers before implementation completion and require compile-time errors for missing lifetime. The date-key-only helper signature is removed, not supported in parallel.

## 7. Save path and complete continuation coverage

Proposed order: capture/validate the render-bound scope first, then the current nonempty validation, then `setIsSaving`, unit normalization and immutable payload capture; recheck immediately before calling persistence. This prevents a retained old handler from even issuing a `noWorkouts` toast or changing saving state. Normalization and dispatch remain synchronous; the second check is explicit and testable.

Pass the same scope to existing `shouldContinue` closures. After await and in catch, check it before every UI/cache continuation. Preserve local ID/version reconciliation and remote success/partial/failure behavior only for the same lifetime. Guard:

- `setLocalWorkouts`, `setIsSaving`, `setIsWorkoutLocked`;
- success, partial-save, validation, conflict and generic failure toasts;
- `clearDirtyAfterSave`, dirty-ref acknowledgement and scoped storage clear;
- `mutateDaily`, `mutateMonthWorkoutRows`, `mutateStatic` from the UI continuation;
- the body of each scheduled mobile `requestAnimationFrame` callback, not just the scheduling site.

Current-scope SWR hydration remains owned by HealthView/draft hook. Slice 0 suppresses stale Save acknowledgement; it must not suppress independently current hydration or reader fanout. Do not add a new per-operation concurrency protocol, auto-save, source-qualified Option C permit or writer cancellation mechanism. Existing date/account reset effects continue to reset current saving/lock state; an old completion cannot clear a later lifetime's saving state.

## 8. Delete paths

Move scope capture/entry validation before the routine-load `removed` bookkeeping so an old callback cannot mutate a new current intent. Carry the same scope through both branches.

- Session/temp removal stays synchronous and local: no repository/API/fanout. Validate before row filtering, `setLocalWorkouts`, empty-draft dirty clear or storage removal. Preserve the current ID classification.
- Persisted Delete retains captured `workoutId`, `local_version`, mode and account. Recheck before persistence entry; pass unchanged expected-version semantics and the scope predicate. After await, validate before all cache mutation, old row-array replacement and draft/storage effects. Catch validation precedes conflict/failure toast.
- Scope retirement does not authorize deleting another row or resolving a conflict by retry. Row/version consistency and same-lifetime concurrent-edit semantics beyond the identified date ABA remain unchanged.

## 9. Persistence stop points and fanout preservation

`healthWorkoutPersistence.ts` needs no production change. A started handler is not necessarily a dispatched durable write.

| Boundary | Exact preserved contract |
| --- | --- |
| Before handler persistence entry | Invalid capture/recheck causes no request and no UI continuation. |
| Local repository factory pending | After it resolves, existing `shouldContinue` may reject. Then no repository save/delete is dispatched, no durable effect and no `onLocalCommit`. The new token supplies this existing predicate. |
| Repository save/delete already dispatched | No new date predicate is inserted into the transaction. Navigation does not roll back a successful commit. Existing repository failures/version conflicts remain failures. |
| Successful durable local return | Call `onLocalCommit` once before postcommit `shouldContinue`, even for stale UI. Its closure carries the original account ID and no payload. Postcommit result may be `aborted` despite the durable effect. |
| Remote Save | Existing sequential POST shapes/order and response/catch checks remain. A sent request is not undone; stale predicate stops later rows at the existing checkpoint. Do not add persistence-internal request checks or claim all started batches complete. |
| Remote Delete | Existing request/status handling and post-response currentness stay. No local commit notification is invented for remote mode. |

AppContent's original-account routing remains untouched. Delivery of `onLocalCommit(A)` is required after local commit; actual reader calls remain conditional on current mounted eligible A owners. It can refresh A2 after A1→B→A2, must not refresh B while B is current, and may do no work after AppContent unmount or with all relevant reader gates OFF. Range precedes B1 when both are eligible. Health date lifetime never gates this payload-free notification.

```text
DURABLE_COMMIT_PRESERVATION = PASS
POSTCOMMIT_ORIGINAL_ACCOUNT_FANOUT = MUST_BE_PRESERVED
WRITER_SEMANTIC_EXPANSION = NONE
```

`PASS` here evaluates the preservation contract in this design; it does not pass ABA0-C07/C08 or assert executed runtime acceptance.

## 10. Deterministic regression matrix

All scenarios are proposed and `REQUIRED / NOT_EXECUTED`. IDs are exact future test-name prefixes. Use deferred promises with separate factory/dispatch/commit markers and explicit `act`/`flushSync` commits; no timing sleeps or polling loops. M = mounted real HealthView with mocked persistence; P = real persistence with deferred fake repository/authFetch; I = real HealthView/AppContent/persistence with instrumented fake repository and test-only reader adapters; H = mounted owner-hook harness; U = pure helper tests. Local and remote modes must be distinguished as stated.

| ID / exact proposed test suffix | Layer, setup and trigger | Persisted/request assertions | UI/currentness assertions |
| --- | --- | --- | --- |
| S01 `same_lifetime_save_success` | M+P; edit X and resolve a same-lifetime Save, local and remote | Expected payload/version/UUID and sequential remote shapes unchanged | Local reconciliation or remote result branch succeeds; one current toast, dirty clear and lock; unrelated rerender does not revoke it |
| S02 `save_X_to_Y_late_completion` | M+P; dispatch X local commit or first remote row, commit Y, resolve | Local dispatched effect remains; remote stops later rows at existing check | No X completion toast, saving/lock update, Y row replacement/storage clear/cache continuation |
| S03 `save_X1_Y_X2_late_completion` | M+I; hold X1 dispatch, commit Y then X2, create distinguishable X2 dirty draft/new Save state, resolve X1 | Only original captured data is written; no second request from X1; required local fanout remains | X2 draft bytes, rows, dirty, saving and lock unchanged by X1; no X1 success/partial/failure toast or delayed scroll |
| S04 `save_A1_B_A2_late_completion` | M+I; retain existing account-race setup, return to A2 before release | Original A commit notification; eligible A2 fanout, never B | A1 UI remains suppressed despite equal account ID; generation check retained |
| S05 `save_completion_after_unmount` | M+P; dispatch, unmount Health, resolve | Successful local commit and notification retained; remote request not undone | No state/toast/storage/cache/animation-frame effect from removed Health; owner current ref null |
| S06 `save_original_account_fanout_after_navigation` | I; hold dispatched local write, navigate Y/X2, release; also Health→Home and A→B controls | Commit marker before notification; exactly payload-free captured A; range→B1 only when both eligible | No stale Save acknowledgement; current admitted readers may refresh independently |
| S07 `save_stale_error_and_partial_toast` | M+P; X1→Y→X2, reject local/version/validation continuation or resolve remote failure/partial; retain X2 sentinel draft | Failure/conflict writes nothing; already successful remote rows stay; no invented local fanout | No stale error/partial/success toast, dirty clear, lock or saving reset; same-lifetime error control retains existing behavior |
| S08 `save_capture_normalize_dispatch_fence` | U+M+P; invoke retained handler including empty rows, simulate invalid capture/recheck; hold repository factory and commit Y before release | Invalid entry causes zero normalization/persistence calls; stale factory yields zero repository write; valid entry keeps existing normalization | No stale `noWorkouts` toast or saving state; null publication rejects; valid current same-lifetime succeeds |
| D01 `same_lifetime_persisted_delete` | M+P; current row ID/version; resolve local and remote | Exact ID/version; one existing request/write | Correct current row removed; existing cache and empty-draft behavior preserved |
| D02 `delete_X_to_Y_late_completion` | M+P; dispatch X Delete, commit Y, resolve | Original Delete remains; no new row/version/request | Y rows/storage/dirty untouched by X; no stale toast/cache effect |
| D03 `delete_X1_Y_X2_late_completion` | M+I; dispatch X1, commit Y/X2 and establish X2 sentinel rows/storage, resolve | Only captured X1 ID/version; local fanout still delivered | Old X1 filter cannot replace X2 rows or clear X2 storage; no stale UI effect |
| D04 `delete_A1_B_A2_late_completion` | M+I; preserve existing A race, release at A2 | Captured A notification, correct eligible-owner routing | No old A1 row filter or toast reaches A2 |
| D05 `delete_completion_after_unmount` | M+P; dispatch, unmount, resolve | Existing local durable effect/notification or remote response preserved | Date authority retired; no row/storage/toast/cache continuation |
| D06 `delete_original_account_fanout_after_navigation` | I; dispatched local Delete then date/route/account change before commit | Notification after commit; range→B1 ordering and B/unmount filtering unchanged | UI currentness cannot gate notification; stale row-removal continuation suppressed |
| D07 `delete_stale_conflict_and_error` | M+P; reject expected-version conflict or remote non-OK after X1→Y→X2 | No local successful-commit fanout; ID/version unchanged; no repair/retry | X2 rows/dirty/storage/toast unchanged; same-lifetime error positive control preserved |
| D08 `draft_only_delete_stays_local` | M; temp/session removal same lifetime, then invoke retained stale callback after X1→Y→X2 | Zero persistence/fanout in both cases | Current draft removal works; stale callback cannot mark current routine intent, remove rows or clear storage |
| R01 `unrelated_rerender_keeps_date_lifetime` | H+M; change lock/dirty/read data and new same-key Date object | No write initiated by owner | Same object token and capture remain valid; no effect reissue from callback/object identity |
| R02 `same_date_return_never_revives_handler` | H+M; retain X1 token and event callback, commit Y/X2, invoke old callback | Zero new persistence from old callback | X1 token differs from X2; old callback cannot stamp itself with current ref/token/generation; new X2 callback succeeds |
| R03 `rapid_committed_date_transitions` | H+M; separately commit X→Y→Z→X with retained scopes | No owner IO | Every committed transition retires prior token; batched X→Y→X that never commits Y stays one lifetime and is a separate positive control |
| R04 `strictmode_cleanup_never_restores_token` | H+M; root StrictMode setup/cleanup replay, retain first setup identity and settle second | No owner IO/write | First token forever invalid, current second setup works; cleanup compares exact descriptor and cannot clear a newer one |
| R05 `aborted_date_render_preserves_committed_authority` | H+M with controlled Suspense; begin uncommitted Y transition then abandon it while X remains mounted; separately test committed fallback layout teardown/reconnect | No new token or write for abandoned render; any explicitly dispatched X write keeps existing semantics | Visible committed X remains valid for date-only speculation; layout-disconnected/reconnected case retires token and issues a fresh one rather than restoring it |
| R06 `logout_and_remount_retire_date_lifetime` | H+M; sign out/unmount A, remount same A/X; invoke retained callback | Zero old-handler request; valid new handler preserves existing contract | Null authority during teardown, fresh remount token, account-generation checks still independent |

S03/S07 must explicitly retain a queued animation-frame callback, navigate before executing it, and prove it cannot scroll current InBody UI. S03/D03 use distinct X2 draft contents and storage sentinels: checking only absence of a toast is insufficient. I tests must observe durable notification and UI suppression separately; pure helper PASS cannot substitute for mounted handler proof. At least one I positive control uses both test-only B1/range gates enabled for fanout order; a production gate-OFF control observes zero new readers/listeners/layout/retry while shared currentness is fixed.

### 10.1 Mandatory real-draft mounted track and shared oracles

H01-H09 below are additional mandatory scenarios, not replacements for the original 22 S01-S08/D01-D08/R01-R06. Each is `REQUIRED / NOT_EXECUTED`. Here H-series IDs name scenarios; the original layer H still means the isolated owner-hook harness. An isolated owner harness or mocked-null draft fixture cannot discharge these scenarios.

The required future file is `frontend/src/components/views/healthWorkoutDateLifetimeDraftHydration.integration.test.ts`. Its MD layer mounts the **real HealthView**, real `useHealthWorkoutDraft`, real key/read helpers and future real layout owner/capture/currentness functions. A string-preserving in-memory `Storage` replaces only the environment's `localStorage`, with `getItem`/`setItem`/`removeItem` logs; use `vi.stubGlobal` with cleanup. Pass that same storage to hook probes. The adapter stores exact strings and delegates parsing to the real helper; no simplified parser, constant-null reader, forced dirty value or always-true currentness/hydration guard is allowed. Unrelated visual/network dependencies may be mocked, not the asserted draft or guard logic.

Use these named fixtures before mounting (fresh storage per subcase):

- PXY: Account A/date X = DRAFT_X, Account A/date Y = DRAFT_Y, unrelated B/date Z = DRAFT_Z. Use valid `Workout[]` with different IDs, block/exercise names and set kg/reps/done values; persisted Delete variants carry valid UUIDs and `local_version`, separate from temp/session-only controls. Use `JSON.stringify` to seed compact bytes so the existing legitimate serialization does not create a whitespace-only delta. Record `STORAGE_X_BEFORE`, `STORAGE_Y_BEFORE`, `STORAGE_Z_BEFORE` with real keys. Assert exact equality, not re-parsed equality or row counts alone.
- P0: X/Y keys absent, unrelated Z bytes recorded; qualified clean source rows HYDRATED_X/HYDRATED_Y differ from all drafts. Missing means `getItem === null`, not an invented empty-array string.
- PX2: after independently proving X/Y transition bytes and state, edit the restored X2 through real UI to produce DRAFT_X2; capture the actual bytes/state immediately before releasing X1. Do not reseed a damaged Y key or insert a sentinel before checking transition damage.

Every H scenario records rendered IDs/names/set inputs and independently observes `localWorkouts`, `isDirty`, `isDirtyRef.current`, `isSaving`, `isWorkoutLocked`, exact X/Y/Z storage bytes, toast/status and each postcompletion/cache/RAF/fanout action. A test-only import wrapper may call the real draft hook and append read-only snapshots/callback markers; it must return the real state unchanged. Saving/lock use DOM button/disabled/locked behavior plus a narrowly instrumented **test-only** transformed HealthView observer if DOM cannot distinguish them. The observer reads named real state at commits; it may not replace setters, manufacture state or add a production API. If reliable observation cannot be implemented, the criterion stays unmet; omit neither field nor negative controls.

Observe token setup/cleanup and render-bound publication via a transparent test-only wrapper around the real future owner. Log committed descriptors and real cleanup/setup, never issue a fake token or return mocked currentness. Observe storage reads/writes/removes, draft restoration callback, committed state and hydration delivery/decision. Assert semantic partial ordering and state at named checkpoints, **not** a fixed render count or a guessed total order between publication and passive flushes. React may run restoration before the binding render. On initial X, observe committed scope, layout issuance, published binding and settled restored draft; on X→Y, observe exact X cleanup/Y issuance, binding and Y restoration; on Y→X2, fresh issuance/binding and X restoration. The scope-transition pass must not write prior-scope rows under the new key. Any write log violating scoped contents fails even if a later correct write repairs final bytes.

Hydration seam: MD supplies controlled immutable, account/date-labeled source arrays to real HealthView props, including pending→settled/success and unsuccessful composite model controls where applicable; the actual HealthView eligibility/dirty/ref/array-identity logic runs unchanged. For parent/source qualification, required MP mounts real AppContent + HealthView + `useDailyData` + SWR with isolated cache and a deferred fake `readLocalHealthDaily(accountId,date)` returning valid scoped projections. Do not mock SWR/key ownership/qualification for MP. The real selected-day owner and verified projection are used for gated ID fanout controls, with a deferred fake repository read, not a hardcoded success predicate. Source timing is controlled independently from token/persistence timing. Same-array repeat is a no-readoption control; a fresh eligible array is the adoption positive control. No production source activation is involved.

### 10.2 Required H-series scenarios

Each entry below uses the common byte/state/action oracle above. Source hydration and repository factory/dispatch gates are distinct named deferred boundaries. At every intermediate checkpoint assert before taking the next step; final X2 sentinels alone cannot hide X→Y damage.

**H01 `CLEAN_HYDRATION` — MD + MP, P0.** Mount clean committed X, observe layout issuance/publication/passive reset, then release the independently held eligible X source with a fresh HYDRATED_X array. Real hydration adopts sorted HYDRATED_X; dirty and dirty-ref stay false, saving false, lock true for nonempty rows. X/Y remain absent and Z bytes unchanged; no draft-restored or Save-success toast, persistence or commit fanout. Repeat the same array and an ineligible pending/error composite source: neither may manufacture an adoption; then a fresh eligible array must adopt. Failure is lost clean hydration, unexpected dirty/storage, incorrect lock or bypassed eligibility. Compare gate-OFF legacy MD/MP results with the frozen main baseline.

**H02 `DIRTY_HYDRATION` — MD + MP, P0 then real edit.** Hydrate clean X as H01; unlock/edit via actual UI to DIRTY_X, await dirty/ref true and record exact X bytes (Y absent, Z unchanged). Release a different eligible HYDRATED_X2, before and after an unrelated same-date publication-stable rerender. Dirty rows and bytes stay DIRTY_X, dirty/ref true, saving false, lock false; hydration decision is blocked by the real dirty guard. No success toast/write/fanout from hydration. Failure is source overwrite, dirty reset, storage removal or relock. Held source delivery must not directly write expected draft state.

**H03 `RESTORED_DRAFT` — MD + MP, PXY.** Mount X with source held; real key/read restores DRAFT_X, dirty/ref true, saving false, lock false. Release fresh qualified X hydration after restoration and, separately, make it available during the layout/passive publication cycle. Both runs preserve DRAFT_X/bytes and block hydration; Y/Z bytes unchanged. Observe the existing draft-restored notification (baseline-matched, including separate StrictMode behavior), no Save acknowledgement/fanout. Navigate Y with source independently held and repeat for DRAFT_Y before returning X2. Failure is lost restoration, wrong scope/dirty/lock, or clean rows replacing a restored draft, even if a later sentinel would conceal it.

**H04 `CROSS_DATE_HYDRATION` — MP + MD guard controls, P0 and PXY runs.** Hold X source read, explicitly commit Y, then release X while Y is current; independently release Y source. Real account/date SWR ownership must prevent X rows from being delivered as current Y; clean Y adopts HYDRATED_Y with dirty false/lock true, restored dirty Y preserves DRAFT_Y with dirty true/lock false. Saving false; X/Y/Z bytes equal their pre-release snapshots (P0 remains absent). Commit X2 and release a retained X1 operation/UI continuation: it stays retired. Independently qualified current X2 source may still hydrate clean X2; cached/revalidated same-date data is not itself a revived operation token. A dirty restored X2 blocks that hydration. No X-origin UI toast/storage/lock/cache action reaches Y or dirty X2; source reads alone issue no commit fanout. Failure is foreign-scope delivery, bypassed dirty protection or X1 operation revival. This tests existing source guards; it does not invent a new hydration cancellation protocol. A discovered unrelated source defect is a STOP/scope review, not silent expansion.

**H05 `PUBLICATION_EFFECT_ORDER` — MD, PXY, source held then released.** Record initial X commit/issuance/binding/restoration; trigger ordinary same-key rerender; separately commit X→Y and Y→X2 with exact cleanup/new issuance/binding/restoration markers. Assert token stability on ordinary rerender, fresh X2, and settled DRAFT_X/DRAFT_Y/DRAFT_X dirty/ref true, saving false, lock false. Release qualified source at each transition in separate runs; restored dirty rows block it. Inspect every storage operation: skipped transition persistence cannot write X/empty/stale rows to Y or Y rows to X; all X/Y/Z bytes remain exactly preseeded. Draft-restored notifications follow existing baseline, no Save status/persistence/fanout. Failure is an intermediate wrong-key write even when final bytes recover, loop/reissue, lost dirty/restoration or changed source decision. Instrumentation must record early passive flushes without forcing their order or inferring success from a guessed number of renders.

**H06 `PRESEEDED_X_Y_BYTES` — MD, PXY, no operation dispatch.** Before mount record X/Y/Z strings; with hydration held, mount X, navigate Y, return X2, then release eligible hydration at each settled dirty scope. At **each** checkpoint verify complete row IDs/exercise/set values, dirty/ref true, saving false, lock false and all three exact strings; verify scoped restore callback and hydration blocked, zero persistence/fanout/Save toast. Include same-date rerender and account-switch sentinel control. Failure is any wrong row, missing byte, cross-account/date write or read/restore loss. This case has no late completion or freshly installed X2 sentinel: it independently catches the original review's masked-transition false positive.

**H07 `SAVING_LOCK_TRANSITIONS` — MD + real persistence with deferred fake repository, PXY/PX2, paired S01/S03/D01/D03/D08 controls.** Initial restored X is dirty/unlocked/not saving. Start Save X1, observe saving true/unlocked and unchanged bytes; same-date rerender preserves it. Commit Y: reset yields not saving/unlocked with dirty DRAFT_Y; assert before returning X2. Return X2 restores dirty DRAFT_X with not saving/unlocked. Edit to DRAFT_X2 and hold a separate X2 Save (saving true/unlocked); record rows/ref/bytes/status/actions, then resolve X1. X1 must not clear X2 saving/dirty/storage, reconcile rows, lock/unlock, toast or mutate UI caches/RAF. Separately resolve a valid same-lifetime Save: normal reconciliation, saving false/lock true/dirty-ref false/X key removed and expected current success actions; Y/Z unchanged. Repeat the stale-release sentinel with X2's locked acknowledged state so an unwanted unlock is observable. Hydration stays independently held for these action assertions, then clean-vs-dirty delivery follows H01/H02. Same-lifetime Delete and draft-only Delete retain D01/D08 semantics (last row may legitimately clear dirty/storage); D03 additionally snapshots dirty X2 and bytes before stale Delete. Fail on any unexpected intermediate reset or stale action, not just final row count. Only dispatched successful local calls produce captured-account commit notification; no test directly mutates draft on persistence resolution.

**H08 `DURABLE_COMMIT_WITH_X2_DIRTY_SENTINEL` — required ID + MD-OFF companion, PXY/PX2, S06/D06.** Extend the existing full mounted AppContent race infrastructure: real HealthView/draft/key/read/storage/persistence/parent fanout; fake repository has separate factory, dispatch and successful local-return markers, per-account/date records and valid projection data. Hold X1 after dispatch (Save and persisted Delete variants); prove Y restoration/bytes, return X2 and establish DRAFT_X2 through real edit, record dirty/ref true, saving/lock sentinels and bytes; release X1 success. Captured X1 payload/ID/version persists once; original-account payload-free notification executes once **before** stale postcommit predicate, independent of UI retirement. With only test-local B1/range eligibility enabled in ID, admitted A readers refresh range→B1, B/unmounted owners do not. Current dirty X2 must reject independently refreshed qualified hydration: rows/ref/bytes/saving/lock/status remain the snapshot, no old toast/cache/RAF/draft-clear. MD companion keeps all five gates OFF but supplies a captured-account notification spy through existing props: real persistence still notifies; no composite reader is activated. It proves the same UI/byte assertions with no new reader/listener, while ID proves real routing. The two tests share dispatch/navigation/commit markers and independent state oracles; neither mocked persistence nor gate-ON routing alone suffices. Failure is lost/changed durable write, date-gated fanout, wrong account/order, or stale/rehydration damage. These fake-repository tests are frontend boundary evidence, not actual IndexedDB/backend durability acceptance.

**H09 `NEGATIVE_CONTROL` — MD, PXY/PX2; REQUIRED test-only sensitivity probes.** Run H06 with a bounded faulty test adapter that delegates the real helper except withholding the first nonempty restoration result. The **same** original oracle must fail on missing DRAFT_X/restored dirty state, independently of token mismatch; the unperturbed run must satisfy it. Also run the H05 log oracle with a test-only injected old-X write at the Y transition storage seam, and H03 with a test-only transformed dirty guard bypass: detect wrong Y bytes/write history and hydration overwrite respectively. An optional H07 stale-clear perturbation must fail X2 byte/dirty assertions. Use isolated test module instances/storage and restore adapters; never edit production files or force a production mutation. All probes keep real lifetime currentness intact and valid input/source data. Saving/lock/status/fanout must remain baseline-matched unless the targeted fault causes the independently expected assertion failure. Expected result is a specifically identified preservation assertion failure, not an arbitrary thrown setup error or token rejection. This sensitivity requirement remains NOT_EXECUTED now.

```text
PR774_R01 = CORRECTED_PENDING_REREVIEW
MANDATORY_REAL_DRAFT_MOUNTED_TRACK = DEFINED
PRESEEDED_DISTINCT_DRAFTS = YES
STORAGE_BYTE_ORACLE = EXACT
PUBLICATION_EFFECT_ORDER_PROOF = DEFINED
CLEAN_HYDRATION_PROOF = DEFINED
DIRTY_HYDRATION_PROOF = DEFINED
RESTORED_DRAFT_PROOF = DEFINED
SAVING_LOCK_PRESERVATION_PROOF = DEFINED
DURABLE_DRAFT_INTEGRATION_PROOF = DEFINED
DRAFT_FALSE_POSITIVE_CONTROL = DEFINED
MOCK_FALSE_POSITIVE_RISK = BOUNDED_BY_REQUIRED_REAL_DRAFT_PROOF
REGRESSION_MATRIX_COMPLETENESS = CORRECTED_PENDING_REREVIEW
```

`DEFINED` labels the proposed mandatory proof contract, not executed acceptance or independent closure. Production layout mechanism, draft hook, hydration semantics, writer stop points and fanout are unchanged by this docs-only correction.

## 11. ABA0 acceptance traceability

Every row remains `REQUIRED / NOT_EXECUTED`; completeness of this table is a design result, not criterion PASS.

| Criterion | Implementation seam | Exact scenario prefixes | Observable assertion | Prohibited regression | Status |
| --- | --- | --- | --- | --- | --- |
| ABA0-C01 | Layout owner + pure predicate + real draft | R01/R02/R03/R05/H05/H06 | Stable same-lifetime identity; fresh X2; no speculative ref change; logged publication/effect order preserves scoped restoration | Equality-only fallback, render issuance or hidden transition write | REQUIRED / NOT_EXECUTED |
| ABA0-C02 | Save capture/continuations + real draft | S02/S03/S07/S08/R02/H07/H08 | Sentinel X2 rows/dirty/ref/exact storage/saving/lock/toast/scroll survive X1 after independently checked Y restoration | Old Save acknowledged as X2 or sentinel masks earlier draft damage | REQUIRED / NOT_EXECUTED |
| ABA0-C03 | Persisted Delete scope + real draft | D02/D03/D07/H07/H08 | X2 rows/dirty/ref/exact scoped storage untouched by old filter; valid Delete control retains existing clear semantics | Stale Delete removes current draft | REQUIRED / NOT_EXECUTED |
| ABA0-C04 | Independent account predicate | S04/D04/R06 | A1 scope fails in A2; captured A fanout routing preserved | Replace account generation with date/ID equality | REQUIRED / NOT_EXECUTED |
| ABA0-C05 | Shared predicate at existing stop points | S02/D02 | X scope fails after Y commit | Lose simple date-switch protection | REQUIRED / NOT_EXECUTED |
| ABA0-C06 | Capture and layout cleanup + real draft | S01/D01/S05/D05/R01/R04/H07 | Settled same-lifetime valid with correct storage/dirty/lock acknowledgement; removed/replayed scope invalid | All operations permanently fenced, wrong reset or unmount revival | REQUIRED / NOT_EXECUTED |
| ABA0-C07 | Existing persistence dispatch boundary + real mounted draft | S06/D06/H08 plus P factory/dispatch gates | Factory-pending cancellation versus successful dispatched commit distinguished; durable success does not erase dirty X2 | Rollback, every-started-call-commits overclaim or mock-built draft success | REQUIRED / NOT_EXECUTED |
| ABA0-C08 | HealthView notification + AppContent routing | S06/D06/S04/D04/H08; existing fanout tests | Original A notification after commit; admitted range before B1; B/unmount filtered; refreshed source preserves dirty X2 | Date fence suppresses fanout or foreign reader refresh | REQUIRED / NOT_EXECUTED |
| ABA0-C09 | All UI continuation sites + RAF body + mounted state oracle | S03/S05/S07/D03/D05/D07/H07/H08 | No stale state/toast/draft-clear/row removal/scroll/saving/lock update; exact X2 bytes/ref preserved | Guard await only, omit scheduled continuation or miss state/storage mutation | REQUIRED / NOT_EXECUTED |
| ABA0-C10 | Scope helper/HealthView only; persistence regression | S01/D01/S06/D06/S08 and existing request/version tests | Unchanged requests, UUID/version/coverage and successful-commit semantics; forbidden diff absent | Writer/schema/backend change | REQUIRED / NOT_EXECUTED |
| ABA0-C11 | Existing five config modules | Production OFF control + literal-source assertions | All five false; no runtime override | Feature activation to prove correction | REQUIRED / NOT_EXECUTED |
| ABA0-C12 | Mandatory MD/MP/ID real draft/hydration track + bounded change set | H01/H02/H03/H04/H05/H06/H07/H08/H09 plus R01/S01/D01/D08 and paired production OFF baseline | Preseeded byte-exact restoration; clean adoption/dirty protection; logged layout/passive ordering; dirty/ref/saving/lock/actions unchanged outside intended ABA delta; negative probes detect damage | Mocked-null-only proof, guessed render order, overwritten bytes, changed adoption or Option C rollout | REQUIRED / NOT_EXECUTED |

`ABA0_C01_C12_TRACEABILITY = CORRECTED_PENDING_REREVIEW`. All twelve criteria remain `REQUIRED / NOT_EXECUTED`; neither a traceability mapping nor hosted docs CI promotes them to PASS.

## 12. Gate-OFF correction boundary

Slice 0 intentionally changes shared legacy currentness, including production with all gates OFF. After it merges, later Option C gate-OFF equivalence uses the corrected baseline. It adds no composite reader, retry controller, stable shell, D bridge, layout, draft storage format, data-plane action or writer authority. Current writer, manual/preset formula, hydration, unrelated InBody/nutrition/routine UI and local draft adoption semantics remain unchanged.

The small layout publication render is an authority-binding mechanism, not a visible shell or new source episode. It can advance passive-effect timing as React documents; the implementation must prove the existing draft reset/restore/hydration/storage results remain scoped and unchanged. If that cannot be proved without changing draft or writer semantics, STOP rather than expanding Slice 0 silently.

Proof baseline is exact current main `295c6711aafaf35410e2b187ffccc0627762684c` with all five gates OFF, compared with a separately authorized future Slice 0 candidate with all five gates OFF and identical source/storage/action inputs. Run mandatory H01-H07/H09 MD/MP cases and H08 OFF companion against both using isolated module/cache/storage instances; absence of the future owner on main is observed, not faked. Internal publication/render/passive scheduling may differ. Settled rows and every storage write/removal, draft restoration/dirty/ref, clean hydration/dirty protection, saving/lock, toast/status, request bytes/count/stop points and original-account fanout must match outside the documented stale-operation difference. Compare notification counts under the same StrictMode configuration, not an invented single-render baseline. The sole allowed delta is suppressing stale X1 operation entry/UI continuations after retirement/return to X2, including queued scroll and its forbidden draft/state/cache changes. No lost draft, erased dirty state, suppressed eligible clean hydration, foreign-key write (even later repaired), extra source read/listener, changed writer request or changed fanout is allowed. Existing unrelated legacy behaviors are not silently repaired; new contradictions require STOP/review.

`GATE_OFF_CORRECTNESS_EXCEPTION = BOUNDED_WITH_MOUNTED_DRAFT_HYDRATION_PROOF`. This is a bounded pending proof obligation, not an executed gate-OFF equivalence PASS. The ID test-local gate-ON fanout control is complementary and cannot replace the OFF baseline.

## 13. Future implementation file plan

Paths in this table are repository-relative; the new hook path is proposed and does not exist in this docs-only PR.

| Candidate file | Classification | Exact allowed future work |
| --- | --- | --- |
| `frontend/src/components/views/features/health/healthWorkoutOperationScope.ts` | REQUIRED | Mandatory opaque lifetime in transient scope; capture/currentness API; remove date-only compatibility. Keep pure. |
| `frontend/src/components/views/features/health/healthWorkoutOperationScope.test.ts` | REQUIRED | Lifetime identity, invalid/missing token, account and simple-date regressions. |
| `frontend/src/components/views/features/health/useHealthWorkoutOperationLifetime.ts` | REQUIRED | Minimal commit-issued owner hook and state publication; no IO/listeners/storage. Required because closure rebinding and commit cleanup are not pure-helper work. |
| `frontend/src/components/views/features/health/useHealthWorkoutOperationLifetime.test.ts` | REQUIRED | H timing cases R01-R06 including controlled Suspense, StrictMode, cleanup and missing-publication admission. |
| `frontend/src/components/views/HealthView.tsx` | REQUIRED | Unconditional owner, render-bound account/token capture, two handler scopes, pre-entry fences, continuation/RAF checks; remove render-written workout-date authority. No global account ref redesign. |
| `frontend/src/components/views/healthWorkoutDateLifetime.integration.test.ts` | REQUIRED | New focused real HealthView mounted date-race tests, production OFF and local/remote currentness modes; reuse established fixture patterns without altering unrelated tests. |
| `frontend/src/components/views/healthWorkoutDateLifetimeDraftHydration.integration.test.ts` | REQUIRED | New H01-H07/H09 MD/MP track with real HealthView/draft/key/read/layout owner, exact in-memory Storage, independently deferred source delivery, real SWR/date qualification for MP, observable state/order and test-only fault probes. Main-versus-candidate gates-OFF proof mandatory. Test-local transparent wrappers/transforms live here; no production observer API. |
| `frontend/src/components/healthWorkoutFullMountedRace.integration.test.ts` | REQUIRED | Add H08/S06/D06 date-navigation counterpart using real AppContent/draft/storage/persistence/parent routing with per-account/date fake repository and qualified source projection; source delivery independently deferred; ID gate-ON order control plus MD-OFF companion joint coverage. Preserve existing account/Home regressions. |
| `frontend/src/components/views/features/health/healthWorkoutPersistence.test.ts` | REQUIRED | Deferred factory versus dispatched commit tests and remote stale-stop regression; production persistence untouched. |
| `frontend/src/components/healthWorkoutRangeConsumerIntegration.test.ts` | CONDITIONAL | Add original-account fanout/order assertions only if existing tests plus full mounted counterpart leave a concrete coverage gap. |
| `frontend/src/components/views/healthRoutinePresetAccountIsolation.test.ts` | CONDITIONAL | Retained-handler/account regressions only; current constant-null draft reader cannot discharge H-series/ABA0-C12. Reuse fixture patterns without carrying that mock into the required real-draft track; no routine product changes. |
| `frontend/src/components/views/features/health/useHealthWorkoutDraft.test.ts` | REQUIRED_REGRESSION / CONDITIONAL_TEST_EDIT | Run existing real hook storage/dirty/acknowledgement regressions; add hook-only assertions only for a demonstrated coverage gap. They do not substitute for real HealthView hydration/reset/publication tests. |
| `frontend/src/components/views/features/health/useHealthWorkoutDraft.ts` and `frontend/src/lib/healthBackfillUiSafety.ts` | OUT_OF_SCOPE | Inspect/regress existing draft and account ownership; no storage format, account algorithm or adoption change. |
| `frontend/src/components/views/features/health/healthWorkoutPersistence.ts` and `frontend/src/components/AppContent.tsx` | OUT_OF_SCOPE | Preserve writer stop points and notification routing. No production edit is needed by this design. |
| Five gate configs, DB/schema/stores/indexes/keyPaths, backend/Supabase/RLS, WorkoutSessionV1, Option C A-G presentation/retry/D modules | OUT_OF_SCOPE | No change or activation. |

No production persistence edit is justified by the inspected source. If later evidence demands it, stop for explicit scope/authority review rather than converting this plan into writer work. The exact test split can reuse fixtures, but cannot drop the H/M/P/I assertions or enlarge the runtime scope.

The additional test file is mandatory because the existing routine fixture removes restoration and the full mounted race fixture alone does not exercise the production-OFF daily source. No additional test utility file is required: keep string Storage, transparent observation and fault adapters test-local. Real draft/account helpers, `useDailyData`, paired legacy projection and parent routing remain production OUT_OF_SCOPE. Any infeasible observation or qualification seam blocks proof rather than authorizing a draft hook rewrite or manufactured eligibility.

## 14. Risks, proof obligations and STOP conditions

- Publication needs a layout-triggered binding render per lifetime; keep primitive dependencies and prove no loop or per-rerender rotation. No extra read/listener is permitted.
- Existing account generation mutates in render. Preserve its conservative rejection and account ABA; this design does not certify broader account commit timing or redesign other domains.
- Passive draft/hydration effects and scheduled scroll can expose mistakes that pure helpers miss. Mounted sentinel tests and controlled scheduling are mandatory.
- Stale closures must fail entry before any side effect. Reading latest token/generation to build a new scope defeats the design even if awaited completions are fenced.
- Same-date concurrent edit/version behavior beyond date ABA is not newly resolved. Do not claim per-operation serialization or conflict recovery.
- React testing must separate an abandoned render from committed layout disconnection. The latter legitimately retires authority; no restoration of an old token is allowed.

STOP and mark the implementation design blocked if it needs a writer protocol or semantics change, DB/schema/backend mutation, expected-version/UUID/remote ordering change, account-generation relaxation, gate activation, unrelated domain movement, identity/provenance recovery, weakened isolation, new draft schema or altered adoption/hydration contract. No such dependency was found in this scope design; runtime proof is still pending.

## 15. Frozen state and exact handoff

```text
RUNTIME_DATE_ABA_CORRECTION = NOT_IMPLEMENTED
ABA0_C01_C12 = REQUIRED / NOT_EXECUTED
PA_C01_C18_STATUS = REQUIRED / NOT_EXECUTED
DESIGN_IMPLEMENTATION_READY = NO_PENDING_SHARED_DATE_ABA_CORRECTION
REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION
REL05G5A_001_ACTIONABILITY = BLOCKED_BY_FROZEN_PRODUCT_AUTHORITY
PROSPECTIVE_PROVENANCE_PD01 = HOLD_NO_CAPABILITY_SELECTION_YET
SELECTED_PROVENANCE_CAPABILITY = NONE
REAL_LEGACY_TYPED_ISOLATION_PATH = NOT_ESTABLISHED
ALL_FIVE_GATES = false
PUBLIC_READER_ACTIVATION = NOT_AUTHORIZED
HEALTH_PARENT_PUBLIC_READER_ACTIVATION = NOT_AUTHORIZED
SEVEN_LIVE_WRITER_BLOCKERS = OPEN
WRITER_AUTHORITY_CHANGED = NO
GLOBAL_AUTHORITY_STATE = UNCHANGED
PUBLIC_COPY_ACCEPTANCE = NOT_EXECUTED
PERFORMANCE_ACCEPTANCE = NOT_EXECUTED
PHYSICAL_BROWSER_QA = NOT_EXECUTED
PHYSICAL_AT_ACCEPTANCE = NOT_EXECUTED
LOCAL_DATABASE_VERSION = 7
LOCAL_SCHEMA_VERSION = 1
NEXT_IMPLEMENTATION_TASK = REL_05G_HEALTH_WORKOUT_OPERATION_DATE_ABA_CORRECTION_01
NEXT_IMPLEMENTATION_TASK_STATUS = FOCUSED_DESIGN_REREVIEW_PENDING_NOT_AUTHORIZED
PR774_R01 = CORRECTED_PENDING_REREVIEW
RECOMMENDED_NEXT_ACTION = FOCUSED_REREVIEW_PR_774_DATE_ABA_SCOPE_DESIGN_CORRECTION_01
```

Publish only this Markdown correction on the same topic branch and existing Draft PR #774; do not create another PR. Verify source trace, relative links, one-file correction diff and `git diff --check`; require new corrected-head Push/PR CI with all five jobs. Original reviewed-head/baseline CI is supporting history, not the corrected document's CI. Preserve the original CHANGES_REQUIRED review and PR774-R01 chronology in the PR body, adding corrected-pending-rereview status only after exact-head CI qualification. No new acceptance tests, physical QA or runtime acceptance are executed. Stop after publication/CI and this correction report; focused independent rereview, Ready, merge and implementation are separate actions.
