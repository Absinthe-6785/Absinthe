# REL-05G Health parent partial-source availability integration design

Task: `REL_05G_HEALTH_PARENT_PARTIAL_SOURCE_AVAILABILITY_INTEGRATION_DESIGN_01`.

Status: `INTEGRATION_DESIGN_CORRECTION_01_PENDING_FOCUSED_REREVIEW`; `DESIGN_IMPLEMENTATION_READY = NO_PENDING_SHARED_DATE_ABA_CORRECTION`. This is a docs-only characterization of the already approved Option C policy. It does not implement the design or the existing shared date ABA correction, activate a reader or writer, choose public copy, pass PA-C01 through PA-C18, or authorize a later slice. Finding `PR773-R01` is `CORRECTED_PENDING_REREVIEW`, not independently closed.

## 1. Exact merged baseline and authority

Repository: `Absinthe-6785/Absinthe`; canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`.

The exact source baseline was re-established before authoring:

- `origin/main = 6944e52c68faa875404caf29c177be61429e3aab`.
- [PR #772](https://github.com/Absinthe-6785/Absinthe/pull/772) is MERGED/CLOSED. Its reviewed/final head is `6b8cdd91bc03841679f516235602e179981b2b8d`; its merge commit is `6944e52c68faa875404caf29c177be61429e3aab`.
- [Post-merge CI 38355598670](https://github.com/Absinthe-6785/Absinthe/actions/runs/38355598670) ran on that merge commit. `test`, `typecheck`, `build`, `backend-rel05g1`, and `backend-recovery` all completed successfully.
- The [selected product decision](REL-05G-health-parent-partial-source-availability-product-decision.md) is authoritative. Its publication-time baseline text is historical; its approved policy and frozen ceilings are not reopened here.

```text
BASE_MAIN = 6944e52c68faa875404caf29c177be61429e3aab
PR_772 = MERGED / CLOSED
PR_772_MERGE_COMMIT = 6944e52c68faa875404caf29c177be61429e3aab
PR_772_POSTMERGE_CI = PASS
PR_772_POSTMERGE_CI_RUN = 38355598670
DESIGN_SCOPE = DOCUMENTATION_ONLY
```

## 2. Selected product policy

The human-selected policy is an input, not an open design choice:

```text
SELECTED_PARTIAL_SOURCE_POLICY = C_HYBRID_STRUCTURAL_SHELL_WITH_SOURCE_QUALIFIED_CHILDREN
PA_PD01 = C_STABLE_SHELL_QUALIFIED_CHILDREN
PA_PD02 = SAME_ELIGIBILITY_AND_SELECTION
PA_PD03 = STABLE_ADMITTED_WORKOUT_SHELL
PA_PD04 = HYBRID_EXPLICIT_LOCAL_OWNER_FANOUT_REMOTE_SEPARATE
PA_PD05 = RETAIN_SAME_SCOPE_NONINTERACTIVE_PREVIEW_SAVE_DELETE_FENCED
PRODUCT_OWNER_DECISION = COMPLETE
PRODUCT_OWNER_APPROVAL = APPROVED
PARTIAL_SOURCE_POLICY_ALREADY_SELECTED = YES
OPTION_A = VIABLE_CONDITIONAL_NOT_SELECTED
OPTION_B = VIABLE_CONDITIONAL_NOT_SELECTED
OPTION_C = SELECTED
```

Component mount, visible state, source qualification, and interaction authority remain four separate permissions. A stable shell is not a retained publication, an editor permit, or a write permit.

## 3. Current source ownership and mount graph

Current-main source and directly relevant tests were inspected, including callback bodies and refs rather than JSX alone.

| Current owner | Current behavior |
| --- | --- |
| [AppContent](../src/components/AppContent.tsx) | B1 eligibility is computed at 293-297; range eligibility at 298-303. B1 is owned at 313-318 and the range snapshot at 342-350. Refs at 351-365 lead to `refreshCompositeWorkoutReaders` at 366-369, which invokes raw range invalidation once and raw B1 retry once. Both public read models receive this same wrapper at 380-387. Durable local commit fanout at 370-379 is account-fenced and ordered range then B1. One managed focus/visibility lifecycle is installed at 421-437; remote/bootstrap recovery at 555-595 remains separate. |
| [HealthView](../src/components/views/HealthView.tsx) | The D trust inputs, latch and owner are at 395-435. Draft ownership is delegated to `useHealthWorkoutDraft` at 456-471. B1-qualified hydration is at 567-582. Durable delete is reached through `handleRemoveWorkout` at 1020-1065; durable Save through `handleSaveWorkouts` at 1215-1303. Range-derived Previous/Calendar models are built at 1412-1501. The selected-day panel is outside the composition guard at 1643-1648; the editor, desktop Previous and current support row are inside the guard beginning at 1649; the mobile Previous sheet is outside that exact guard at 2460-2487. |
| [B1 hook](../src/components/views/features/health/useHealthSelectedDayComposite.ts) | One paired selected-day episode reads verified legacy daily state plus canonical day state. Request sequence, mount epoch and account/date scope version prevent stale publication. Retry hides old evidence. Typed isolation withholds the whole pair; ordinary failures can yield qualified partial evidence. The public model does not expose a typed ordinary-error disposition or an opaque publication permit. |
| [Range hook](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts) | One account owner loads a paired source snapshot and derives Previous, month and optional preview views in memory. `invalidateAndReload` synchronously revokes coordinator/publication state. It exposes phase and `isolationError`, but not a complete retry disposition. Bounds changes rederive without another source scan. |
| [D hook](../src/components/views/features/health/useLegacyPreviousCurrentness.ts) / [D owner](../src/components/views/features/health/legacyPreviousCurrentness.ts) | The owner is private to HealthView. It batches consumed block IDs, represents `CURRENT`, `NO_MATCH`, `REFRESHING`, `UNAVAILABLE`, and `STALE_OR_SUPPRESSED`, and owns its own focus/bootstrap recovery. Matching affirmative B1/range recovery is required to clear parent rejection. It does not expose a parent retry adapter or enough error detail to classify every retry. |
| [Selected-day panel](../src/components/views/features/health/HealthSelectedDayCompositePanel.tsx) | Renders loading, ordinary partial/error, isolation, complete empty and canonical read-only records. Its Refresh invokes the supplied model callback. It is not the legacy draft owner. |
| [Previous projection](../src/components/views/features/health/compositePreviousWorkoutProjection.ts) / [desktop view](../src/components/views/features/health/CompositePreviousWorkoutView.tsx) / [sheet](../src/components/views/features/health/PreviousWorkoutSheet.tsx) | The projection is shared, but `selectedPreviousDate` reconciliation and containment remain in HealthView. Desktop and sheet render the same record component; the open sheet is structurally outside the current composition guard. |
| [Calendar activity](../src/components/views/features/health/workoutCalendarActivity.ts) / [Calendar](../src/components/views/features/health/WorkoutMonthCalendar.tsx) | Existing types already represent known `present`, complete-covered `absent`, and `unknown`. Loading/error/isolation have no qualified old marks. |
| [Supporting panels](../src/components/views/features/health/HealthSupportingPanels.tsx) | Calendar shares one lazy wrapper with unrelated InBody Save and compact nutrition. Moving/stabilizing this entire wrapper would broaden authority. |
| [Draft hook](../src/components/views/features/health/useHealthWorkoutDraft.ts) | Owns `localWorkouts`, `isDirty`, raw input, account/date draft storage, scope reset/restore and dirty-clear after acknowledgement. Clean hydration is not dirty. |
| [Persistence](../src/components/views/features/health/healthWorkoutPersistence.ts) / [operation scope](../src/components/views/features/health/healthWorkoutOperationScope.ts) | Persistence owns unchanged local/remote durable behavior and calls payload-free local commit fanout after a durable local commit. Current UI scope checks account generation and date string. Account A→B→A is fenced by generation; date X→Y→X is not fenced by string equality alone. |

The directly relevant tests confirm present boundaries, not the new policy: [B1 hook tests](../src/components/views/features/health/useHealthSelectedDayComposite.test.ts), [range hook tests](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.test.ts), [D hook tests](../src/components/views/features/health/useLegacyPreviousCurrentness.test.ts), [D owner tests](../src/components/views/features/health/legacyPreviousCurrentness.test.ts), [draft tests](../src/components/views/features/health/useHealthWorkoutDraft.test.ts), [persistence tests](../src/components/views/features/health/healthWorkoutPersistence.test.ts), [operation-scope tests](../src/components/views/features/health/healthWorkoutOperationScope.test.ts), [Previous component tests](../src/components/views/features/health/CompositePreviousWorkoutView.test.ts), [sheet tests](../src/components/views/features/health/PreviousWorkoutSheet.test.ts), [Calendar tests](../src/components/views/features/health/WorkoutMonthCalendar.test.ts), [durable fanout integration](../src/components/healthWorkoutRangeConsumerIntegration.test.ts), and [Health integration/selection tests](../src/components/views/healthRoutinePresetAccountIsolation.test.ts).

```text
CURRENT_SELECTED_DAY_PANEL_OUTSIDE_COMPOSITION = YES
CURRENT_LEGACY_EDITOR_INSIDE_COMPOSITION = YES
CURRENT_DESKTOP_PREVIOUS_INSIDE_COMPOSITION = YES
CURRENT_CALENDAR_INSIDE_MIXED_SUPPORTING_CONTENT = YES
CURRENT_MOBILE_SHEET_OUTSIDE_EXACT_COMPOSITION_GUARD = YES
CURRENT_B1_RANGE_UI_RETRY_WRAPPER_SHARED = YES
CURRENT_D_OWNER_LOCATION = HEALTH_VIEW_PRIVATE
CURRENT_PARENT_TO_D_BRIDGE = NONE
```

## 4. Stable workout-shell boundary

Introduce a candidate-only structural component named `HealthWorkoutAvailabilityShell` under `components/views/features/health`. It is a layout/status boundary, not a hook, reader, repository or action owner. It receives already-derived slot states and renders exactly these stable workout surfaces:

1. selected-day source/status/date-navigation slot;
2. Today legacy-draft slot, including its read-only preview state;
3. Today/Previous launcher and desktop Previous slot;
4. a Calendar-only slot extracted from the mixed supporting wrapper;
5. one stable local-recovery/status region.

Classification of current content:

| Class | Content | Rule |
| --- | --- | --- |
| A. Stable workout shell | selected-day slot, Today/Previous structural header and launcher, editor/status slot, desktop Previous/status slot, Calendar/status slot, local recovery region | Remains structurally reachable for the admitted Option C candidate even when a child is loading/unavailable/isolated. |
| B. Source-qualified children | selected-day legacy/canonical records, Previous legacy/canonical buckets, Calendar known-present/covered-absence facts | Render only from each current qualified owner. |
| C. Legacy editor/action content | `localWorkouts`, set/exercise mutations, quick add, routine-to-draft load, session separators, lock/edit, Save, persisted workout removal, history-derived planning | Editor state and callback permits govern these independently of shell mount. Routine/block/preset writers retain their existing owners; shell visibility grants none of them. |
| D. Unrelated supporting content | InBody editor/Save, full and compact nutrition/protein, recovery/notes/connections and other non-workout support | Stays outside this refactor and under existing domain ownership. |

`HealthSupportingPanels` must not be moved wholesale. A later structural slice extracts only a pure `HealthWorkoutCalendarSlot`; InBody and Protein remain in an unchanged non-workout support region. The block library and routine/preset surfaces may retain their current layout positions, but all draft-affecting entry points must consume the editor/action model; routine/block/preset persistence is not brought under the new shell and is not newly exposed by it.

```text
STABLE_SHELL_COMPONENT_BOUNDARY = HEALTH_WORKOUT_AVAILABILITY_SHELL_WITH_SELECTED_DAY_EDITOR_PREVIOUS_CALENDAR_AND_LOCAL_RECOVERY_SLOTS
STABLE_SHELL_EXTRACTION_REQUIRED = YES
UNRELATED_SUPPORTING_DOMAIN_MOVEMENT = NONE
```

## 5. Parent admission contract

The shell is admitted from parent context, never from stale child payload:

```text
shellAdmitted =
  committed Health route is active
  AND current authenticated accountId is nonempty
  AND selectedDate has one valid current local-date key
  AND the Option C candidate is enabled by the existing B1 and range compile-time gates
  AND this committed HealthView belongs to the current account/route lifetime
```

The shell lifetime is a fresh opaque object for every committed account, Health-route admission, candidate enable, or selected-date-context transition. Sign-out, account change, leaving Health, gate disable and unmount retire it synchronously. A return to the same account or date creates a new token.

B1/range model identity and proof are child inputs. A missing, mismatched, loading or rejected model makes its child unqualified; it does not turn stale data into shell admission and does not collapse another independently current child. Remote Health bootstrap success is not required for the local shell or qualified local facts. Remote/bootstrap status and retry remain separate.

```text
PARENT_SHELL_ADMISSION_CONTRACT = CURRENT_AUTHENTICATED_HEALTH_ROUTE_PLUS_VALID_SELECTED_DATE_PLUS_EXISTING_B1_AND_RANGE_CANDIDATE_GATES_WITH_FRESH_COMMITTED_LIFETIME_TOKEN; CHILD_PROOFS_AND_REMOTE_BOOTSTRAP_ARE_NOT_PARENT_ADMISSION
```

## 6. Selected-day state model

The derived parent model maps B1 and effective D rejection to exactly one selected-day state:

| State | Evidence | Visible facts | Editor/retry consequence |
| --- | --- | --- | --- |
| `DISABLED` | shell candidate not admitted | no candidate UI/read | legacy gate-OFF path remains equivalent subject to the separately reviewed shared date ABA correctness correction in section 24 |
| `LOADING` | current account/date B1 phase loading, no effective rejection | status only; no prior records | same-scope dirty preview may remain; B1/R retry is temporarily ineligible while current flight runs |
| `COMPLETE` | settled complete, at least one persisted record | all qualified source-separated facts | legacy editor may be interactive only if legacy evidence is qualified |
| `PARTIAL_LEGACY` | settled partial, legacy success/canonical error | qualified legacy persisted facts only | legacy editor may be admitted; canonical unavailable |
| `PARTIAL_CANONICAL` | settled partial, canonical success/legacy error | canonical read-only facts only | editor unqualified; same-scope dirty preview only |
| `UNAVAILABLE` | settled missing/error result or both ordinary source errors | diagnostic/status only; never empty | editor unqualified; retry only from an eligible finite permit |
| `ISOLATION` | B1 typed isolation, identity mismatch, or effective D/parent rejection | distrust status only; pair records and legacyDaily withheld | editor/action permits denied; D alone cannot clear parent rejection |
| `VERIFIED_EMPTY` | current settled complete, both sources success, zero persisted records | exact selected-day persisted empty; dirty draft separately stated | empty legacy draft may be interactive; dirty draft prevents an overall-empty claim |

Canonical ordinary failure does not revoke independently verified legacy editor eligibility. Legacy ordinary failure never becomes a clean empty editor. No old B1 payload survives loading/retry/rejection.

## 7. Legacy editor admission state model

The future model derives these states from current B1 publication authority plus the current draft owner:

```text
legacySourceQualified =
  shellAdmitted
  AND B1 account/date exactly match current parent context
  AND B1 publication token is current
  AND B1 phase = settled
  AND isolationError = false
  AND effective D/parent rejection = false
  AND result.legacyStatus = success
  AND legacyDaily is present

sameScopeDirtyDraft =
  draft owner account/date/lifetime token exactly matches the shell lifetime
  AND isDirty = true
```

| Editor state | Admission |
| --- | --- |
| `EDITOR_INTERACTIVE` | `legacySourceQualified`; existing lock/workflow rules still apply. Canonical ordinary failure alone does not deny it. D ordinary `UNAVAILABLE`/`REFRESHING` does not destroy an owned draft, but history-derived operations remain separately fenced. |
| `EDITOR_NONINTERACTIVE_DRAFT_PREVIEW` | legacy source is not qualified, but `sameScopeDirtyDraft` is true. Show only the user-owned draft snapshot; all draft edits, planning/default seeding, Save and persisted Delete are fenced. Never show rejected persisted `legacyDaily` through this state. |
| `EDITOR_HIDDEN` | shell not admitted, scope transition/retirement, or source unqualified with no same-scope dirty draft. The stable slot may show status but no editor body. |

Fresh qualified legacy hydration is allowed only while the draft is clean. Loading/error/isolation never hydrates. Recovery re-evaluates interactivity; it does not overwrite the dirty draft. A clean array previously placed by hydration has `isDirty = false` and cannot masquerade as user-owned preview data.

```text
EDITOR_ADMISSION_STATE_MACHINE = HIDDEN_UNLESS_CURRENT_SHELL; INTERACTIVE_ONLY_FOR_CURRENT_SETTLED_QUALIFIED_LEGACY_PUBLICATION_WITHOUT_EFFECTIVE_REJECTION; OTHERWISE_SAME_SCOPE_DIRTY_DRAFT_ONLY_AS_NONINTERACTIVE_PREVIEW
DIRTY_DRAFT_PREVIEW_SOURCE = USE_HEALTH_WORKOUT_DRAFT_CURRENT_ACCOUNT_DATE_LIFETIME_LOCALWORKOUTS_WHEN_ISDIRTY_TRUE
CLEAN_STALE_HYDRATION_ALLOWED_AS_PREVIEW = NO
```

## 8. Save callback characterization and admission

The current UI path is `WorkspaceToolbarPrimary.onClick` → `handleSaveWorkouts` → normalization → `saveHealthWorkouts`. The handler captures `user.id`, account generation, selected date string, current draft rows, display units and local/remote mode. Persistence receives the captured account/date/payload, `shouldContinue`, and payload-free `onLocalCommit`; local durable commit fanout occurs before stale UI completion is discarded.

The later implementation must add an event-boundary `captureWorkoutActionPermit('save')`. It returns a permit only when:

1. the opaque shell, account and date-generation tokens are current;
2. the B1 publication permit is current and `legacySourceQualified` is still true;
3. editor state is `EDITOR_INTERACTIVE` and not locked by another save;
4. the draft owner token is current and the payload contains at least one non-separator workout;
5. no effective B1/range/D rejection invalidates the selected editor lane.

The handler rejects before normalization/persistence when capture fails, captures an immutable account/date/generation/draft/publication scope plus immutable payload, and rechecks that permit immediately before dispatch. Once a valid durable operation is dispatched, source refresh alone does not retroactively rewrite or cancel writer semantics. The separately reviewed Slice 0 strengthens shared date-lifetime UI currentness; existing account/unmount fencing, optimistic versions, validation, remote ordering, durable commit, original-account fanout and other late UI suppression stay intact. Disabled markup is secondary defense, never proof.

```text
SAVE_CALLBACK_ADMISSION_DESIGN = EVENT_BOUNDARY_OPAQUE_SAVE_PERMIT_OVER_CURRENT_SHELL_DATE_GENERATION_B1_PUBLICATION_EDITOR_AND_DRAFT_LIFETIMES; RECHECK_BEFORE_DISPATCH; PRESERVE_EXISTING_PERSISTENCE_AND_POSTCOMMIT_FANOUT
SAVE_ADMISSION_PROOF_REQUIRED = YES
SAVE_DELETE_ADMISSION_CLASSIFICATION = DESIGNED_PENDING_IMPLEMENTATION_PROOF
```

## 9. Delete callback characterization and admission

Current workout removal has two paths inside `handleRemoveWorkout`: session/temp rows are draft-only removal; a persisted row invokes `deleteHealthWorkout` using captured account, workout ID, expected version, date scope, `shouldContinue`, and the same local commit fanout.

Future admission therefore has a shared base and operation-specific checks:

- Base `captureWorkoutMutationPermit(kind)` checks the same shell/account/date-generation/B1/editor/draft/effective-rejection authority as Save.
- Draft-only row/set/exercise removal additionally proves the row belongs to the current draft token.
- Persisted Delete additionally proves the exact row is still present in that draft snapshot and captures immutable `workoutId` plus required `local_version`; it rechecks the permit before dispatch.
- Delete completion preserves current durable behavior and uses the shared date-lifetime correction from Slice 0 for late UI suppression. A source failure after dispatch does not fabricate rollback; account/date/lifetime retirement suppresses stale UI continuation.

```text
DELETE_CALLBACK_ADMISSION_DESIGN = SHARED_BASE_MUTATION_PERMIT_PLUS_EXACT_CURRENT_DRAFT_ROW_AND_PERSISTED_ID_VERSION_CHECK_FOR_DURABLE_DELETE; RECHECK_BEFORE_DISPATCH; NO_WRITER_SEMANTIC_CHANGE
SAVE_DELETE_SHARED_ADMISSION_HELPER = CONDITIONAL
```

The helper is shared for parent/source/editor/lifetime authority. Save and Delete retain distinct payload, nonempty, row-membership and optimistic-version validation.

## 10. Other edit and planning action classification

| Action | Classification | Admission |
| --- | --- | --- |
| Add/remove exercise, quick add, session separator, set add/remove/update, assisted reps, weight input/unit edit, reorder, unlock/edit | `DRAFT_EDIT_REQUIRES_EDITOR_ADMISSION` | Current interactive editor permit and current draft token; no preview mutation. |
| Remove a persisted workout | `WRITE_REQUIRES_CALLBACK_ADMISSION` | Delete permit from section 9. |
| Complete/Save workout | `WRITE_REQUIRES_CALLBACK_ADMISSION` | Save permit from section 8. |
| Load routine into Today, previous-count/default seeding, assembly fallback counts | `HISTORICAL_CURRENTNESS_DEPENDENT` plus `DRAFT_EDIT_REQUIRES_EDITOR_ADMISSION` | Interactive editor plus current qualified D evidence for every consumed block; explicit preset/manual counts retain existing priority. |
| Create/edit/delete exercise block; create/rename/duplicate/delete/split/save routine preset | `WRITE_REQUIRES_CALLBACK_ADMISSION`, but outside this parent policy | Existing block/routine owners only. Stable-shell mount grants no new access and this design does not alter those writers. |
| Copy current same-scope draft summary | `READ_ONLY_SAFE` | May use the exact current draft snapshot, including preview, but must not imply persisted/current source truth. Final exposure/copy is a later UI decision. |
| Selected-day previous/next, Calendar date/month navigation | `NAVIGATION_ONLY` | Current shell action token; navigation retires the old date lifetime and grants no editor authority. |
| Open/close Previous, choose a qualified Previous date | `NAVIGATION_ONLY` | Current Previous scope token and shared state; no record copy/adoption. |
| PR badges, previous micro-cues and history-derived planning | `HISTORICAL_CURRENTNESS_DEPENDENT` | Exact D `CURRENT`/`NO_MATCH` evidence; no B1/range/comparison substitution. |
| InBody, nutrition, Notes and connection actions | Outside this classification | Existing owners and gates remain untouched. |

## 11. Shared Previous state owner

Add one Health-local presentation coordinator, `useHealthPreviousAvailabilityState`, mounted only inside the admitted candidate component. It owns the private selection intent and invokes the existing pure `buildCompositePreviousWorkoutProjection` through the parent availability derivation. It exposes one immutable `PreviousSharedState` containing phase/status, source statuses, qualified buckets, effective selection, selected bucket, retry admission and a scoped `selectDate` action.

Both desktop `CompositePreviousWorkoutView` and mobile `PreviousWorkoutSheet` receive the same `PreviousSharedState` object. The sheet owns only open/closed modal presentation; it must not rebuild eligibility or selection. `PreviousWorkoutSheet` may continue rendering the shared view component, but no independent projection/effect is permitted.

```text
PREVIOUS_SHARED_STATE_OWNER = ONE_HEALTH_LOCAL_USE_HEALTH_PREVIOUS_AVAILABILITY_STATE_COORDINATOR_CONSUMING_THE_PARENT_DERIVED_MODEL
DUPLICATED_DESKTOP_MOBILE_ELIGIBILITY = FORBIDDEN
```

## 12. Previous selection degradation and recovery

Selection has two layers: a private preferred-date intent bound to an opaque account/reference-date/range-owner lifetime, and a publishable effective selection derived only from the current range publication.

| Transition | Private intent | Publishable selection/records |
| --- | --- | --- |
| Range reload begins | retain only for the same opaque lifetime | effective selection becomes null; no old selected records |
| Settled result still contains preferred bucket | retain | publish that current bucket |
| New complete result omits preferred bucket | replace intent with the existing deterministic automatic bucket, or null | publish only that current automatic bucket/null; complete result proves disappearance |
| Partial result omits preferred bucket | retain intent privately because failed source absence is unproven | may publish the current deterministic surviving automatic bucket, clearly partial, or null; never claim the preferred bucket absent |
| Ordinary error | retain same-lifetime intent privately | null selection and status only |
| Typed isolation/effective lifetime rejection | retire current range publication and selection permit; do not expose records | null selection and isolation state |
| Recovery | use preferred intent only if it belongs to the still-current opaque lifetime and the newly qualified bucket exists; otherwise current automatic/null | never revive records or a token from an older publication |
| Account or selected-date context change | create a new lifetime and reset intent | no A or X intent can return by value equality |
| Sheet open during degradation | presentation open state may remain | consumes exactly the same status/null records as desktop |

```text
PREVIOUS_SELECTION_STATE_MACHINE = PRIVATE_SCOPE_TOKEN_BOUND_INTENT_SEPARATE_FROM_CURRENT_PUBLICATION; NO_RECORDS_DURING_LOADING_ERROR_OR_ISOLATION; COMPLETE_RECONCILES; PARTIAL_PRESERVES_UNPROVEN_INTENT_PRIVATELY; ACCOUNT_DATE_OWNER_ABA_RETIRES_INTENT
```

## 13. Mobile sheet degradation

The recommended behavior is to keep an already-open sheet open for same-parent loading, partial, unavailable or isolation transitions and replace its record body with the same shared semantic state used on desktop. This preserves the modal/focus context without granting an already-open privilege. Old records disappear synchronously with owner revocation.

The sheet closes on account/sign-out/Health-route/shell-lifetime retirement, explicit user close, or responsive transition under the existing mobile-only rule. On degradation it keeps the focus trap; focus moves to a stable sheet heading/status or the admitted retry control if the previously focused record disappears. On close, focus returns only to a still-current launcher.

```text
MOBILE_SHEET_DEGRADATION_DESIGN = REMAIN_OPEN_FOR_SAME_PARENT_AND_SWAP_TO_SHARED_LOADING_PARTIAL_UNAVAILABLE_OR_ISOLATION_STATE_WITH_NO_STALE_RECORDS; CLOSE_ON_PARENT_LIFETIME_RETIREMENT
```

## 14. Calendar stable-slot design

The existing `buildWorkoutCalendarActivity` and `WorkoutMonthCalendar` already support the required evidence states:

- complete covered date: `present` or verified `absent`;
- ordinary partial: surviving known `present`, every non-proven date `unknown`;
- loading, both-error or isolation: no old view, therefore every displayed date `unknown` plus a distinct status;
- outside exact derived bounds: `unknown`.

Extract a Calendar-only `HealthWorkoutCalendarSlot` from `HealthSupportingPanels`. It remains inside the stable workout shell and consumes the parent's range state plus controller-provided retry action. The InBody and Protein children remain in the non-workout support region with their current lazy/visibility and writer behavior. Calendar date/month buttons remain navigation, not source or writer admission.

```text
CALENDAR_SLOT_DESIGN = EXTRACT_CALENDAR_ONLY_STABLE_SLOT_REUSING_EXISTING_ACTIVITY_TRISTATE; KEEP_INBODY_AND_NUTRITION_OUTSIDE
UNKNOWN_RENDERING_PRESERVED = YES
```

## 15. Current retry owner graph

```text
AppContent/current account
  raw B1 retry ------------------------------+
  raw range invalidateAndReload -------------+--> current shared B1/R UI wrapper
  one focus/visibility/bootstrap fanout ------+
  remote startup retry('health') ----------------> separate remote owner

HealthView/current account/date
  LegacyPreviousCurrentness owner
    invalidate('unknown') -----------------------> D consumed-ID batch when admitted
    private focus/bootstrap listeners
```

Calling both current `selectedDayRead.retry` and `workoutRangeRead.retry` duplicates the same B1/R wrapper. AppContent cannot currently call D. Routing exists for B1/R, but finite public retry admission does not.

## 16. Selected local retry routing

Create one account/Health-lifetime `HealthLocalRecoveryController` in AppContent. It receives the **raw** B1 and raw range callbacks, not either wrapped UI retry. HealthView receives the controller and attaches the bounded D adapter described next.

A request contains an opaque current scope token and a target: `LOCAL_PARENT`, `LOCAL_PAIRED_READERS`, or `LEGACY_CURRENTNESS`. The controller first asks each targeted adapter for admission, snapshots one plan, then:

1. invokes raw range invalidation at most once when admitted;
2. invokes raw B1 retry at most once when admitted;
3. invokes D `invalidate('unknown')` at most once when admitted;
4. coalesces a duplicate gesture for the same owner episode as `ALREADY_IN_FLIGHT`.

`LOCAL_PARENT` targets all three but skips any non-admitted owner and reports the exact requested/skipped set. It is not transactional and claims no shared revision. `LOCAL_PAIRED_READERS` preserves the currently disclosed local B1+R scope for selected-day/Previous/Calendar controls; it is one controller request, not two wrapper calls. `LEGACY_CURRENTNESS` targets D alone. No target invokes startup/bootstrap remote retry, `mutateDaily`, `mutateStatic`, a writer, reset, identity/provenance recovery, transport, bind/push/pull/resync or comparison.

If parent rejection makes D ineligible until matching B1/range recovery, that gesture skips D; a later current permit may request D. D retry alone never clears the latch.

```text
LOCAL_PARENT_RETRY_ROUTING_DESIGN = ONE_ACCOUNT_LIFETIME_CONTROLLER_CALLING_RAW_RANGE_ONCE_RAW_B1_ONCE_AND_BOUNDED_D_ONCE_ONLY_WHEN_EACH_OWNER_ADMITS; NO_WRAPPED_DUPLICATION_OR_REMOTE_WRITER_SIDE_EFFECT
CURRENT_LOCAL_PARENT_RETRY_BRIDGE = NOT_IMPLEMENTED
```

## 17. D-owner bridge options and recommendation

| Option | Evaluation |
| --- | --- |
| A. Upward callback from HealthView | Small, but closure replacement and a boolean `canRetry` make account/date/lifetime capture easy to misuse; weak surface for classification and coalescing. |
| B. Bounded D adapter attached to a Health-local controller | Keeps D ownership in HealthView, exposes only classification plus scoped unknown-impact invalidation, uses opaque lifetime identity, supports deterministic detach, exact call-count tests and no payload access. |
| C. Move D owner to AppContent | Leaks block/cutoff dependencies, mutation subscriptions and HealthView trust coupling into the app shell; unnecessary authority expansion. |
| D. Global event/bus | Hides routing/admission, complicates account/date ABA and creates unbounded coupling. |

Choose B. `HealthView` creates a `LegacyPreviousRecoveryAdapter` with `classify(scopeToken)` and `request(scopeToken)`. A committed layout effect attaches it to the current controller and cleanup detaches that exact object. The adapter captures the D owner lifetime, current account/date/parent identity and rejection state; it exposes no owner, payload, rejection-clear method or arbitrary impact. `request` can only call `previousOwner.invalidate('unknown')` while the opaque scope remains current.

```text
D_OWNER_BRIDGE_RECOMMENDATION = OPTION_B_BOUNDED_LEGACY_PREVIOUS_RECOVERY_ADAPTER_ATTACHED_TO_ACCOUNT_SCOPED_HEALTH_LOCAL_RECOVERY_CONTROLLER
D_OWNER_ROUTING = DESIGNED_NOT_IMPLEMENTED
```

## 18. Retry admission model

Routing and admission are separate. Each owner adapter returns an immutable `RetryAdmission` bound to owner episode and parent scope:

```text
ELIGIBLE                 { owner, scopeToken, episodeToken, reasonCode, consumePermit() }
TEMPORARILY_INELIGIBLE   { owner, reason: NOT_ADMITTED | WAITING_FOR_PARENT | NO_DEPENDENCIES }
DETERMINISTICALLY_BLOCKED{ owner, reasonCode, recoveryRequirement }
ALREADY_IN_FLIGHT        { owner, episodeToken }
UNSUPPORTED_CLASSIFICATION { owner, observedState }
```

Only `ELIGIBLE` enters a retry plan. `consumePermit` is one-shot and owner-scoped; the controller rechecks object identity immediately before invocation. Loading/active flight is `ALREADY_IN_FLIGHT`, not another request. Typed identity/integrity rejection is `DETERMINISTICALLY_BLOCKED`. An ordinary failure without enough typed evidence is `UNSUPPORTED_CLASSIFICATION` and keeps the public control fenced. `TEMPORARILY_INELIGIBLE` means no current owner operation is useful, not an error or empty result.

The view model may expose an aggregate parent action only when at least one targeted owner is eligible, and must disclose skipped owners semantically. It never upgrades a skipped owner to recovered.

```text
RETRY_ADMISSION_MODEL = PER_OWNER_SCOPE_AND_EPISODE_TAGGED_DISCRIMINATED_ADMISSION_WITH_ONE_SHOT_PERMIT; ROUTE_ONLY_ELIGIBLE_AND_FENCE_UNKNOWN_OR_DETERMINISTIC_FAILURE
PER_SOURCE_RETRY_ELIGIBILITY = DESIGNED_PENDING_IMPLEMENTATION_PROOF
```

## 19. Finite retry and error classification

Current APIs prove only part of the required classification:

| Source | Proved now | Missing now |
| --- | --- | --- |
| B1 | loading/in flight; settled qualified recovery; typed pair isolation; internally bounded stale-generation/device-currentness attempts | ordinary legacy/canonical failure reason and persistent malformed/open identity disposition are collapsed to source `error`/`isolationError` boolean |
| Range | loading/in flight; settled recovery; typed pair isolation; one bounded automatic currentness recovery | ordinary load/derive failure reason is discarded by the public model |
| D | `REFRESHING`, `CURRENT`, `NO_MATCH`, `UNAVAILABLE`, suppressed/rejected | `UNAVAILABLE` has no transient/deterministic code; remote helper can collapse HTTP/transport failure to omission before D sees it; real legacy typed-isolation production path remains unestablished |

Later owner adapters must retain a small non-payload disposition from the existing catch boundary:

```text
TRANSIENT_RETRYABLE_EPISODE { episodeToken, oneUserPermit }
DETERMINISTIC_IDENTITY_OR_INTEGRITY_BLOCK { reasonCode, requiredExternalCorrection }
UNCLASSIFIED_FENCED { reasonCode: UNKNOWN }
CURRENTLY_IN_FLIGHT { episodeToken }
RECOVERED { publicationToken }
```

Known `CompositeWorkoutReadIsolationError` and known deterministic `LocalDatabaseError` categories map fail-closed. A genuine transient episode receives only the inherited finite permit; clicking, timeout, reload or equal-value context return does not mint a new episode. Plain errors remain `UNCLASSIFIED_FENCED` until their originating adapter supplies typed evidence. No storage probe, guessed provenance or numeric loop budget may classify them. B1/range internal bounded currentness recovery remains unchanged.

```text
FINITE_RETRY_CLASSIFICATION_DESIGN = RETAIN_TYPED_NONPAYLOAD_FAILURE_DISPOSITION_AND_OPAQUE_EPISODE_AT_EACH_OWNER_CATCH_BOUNDARY; ONE_INHERITED_TRANSIENT_PERMIT; DETERMINISTIC_AND_UNKNOWN_STATES_FENCED
FINITE_RETRY_PROVABLE_WITH_CURRENT_APIS = PARTIAL
REAL_LEGACY_TYPED_ISOLATION_PATH = NOT_ESTABLISHED
```

Public controls after implementation should expose both the parent LOCAL request and truthful bounded owner-scope controls: B1/Range controls route to the existing disclosed `LOCAL_PAIRED_READERS` scope; D status may route only D. Canonical-only, legacy-only, Previous-only-date, Calendar-date or arbitrary lane retries are forbidden because the owners do not safely expose them.

## 20. Refreshing and stale-publication rule

- B1 retry immediately removes B1 records/legacyDaily and shows selected-day refreshing; an untouched current range publication may remain.
- Range retry immediately removes Previous buckets and Calendar marks/absence, shows Previous loading and Calendar unknown; an untouched current B1 publication may remain.
- D invalidation immediately revokes D cues/default seeding for consumed dependencies. It does not erase a same-scope owned draft or independently qualified range records. Existing rejection remains until matching affirmative B1/range recovery; D-only success is not clearance.
- Combined LOCAL recovery applies those rules per admitted owner. Isolation never reveals prerejection evidence during a retry.
- A stable slot may retain layout/status, never revoked payload.

```text
REFRESHING_PUBLICATION_DESIGN = REVOKE_ONLY_EACH_REQUESTED_OWNERS_PUBLICATION_SYNCHRONOUSLY; KEEP_UNTOUCHED_INDEPENDENTLY_CURRENT_SIBLINGS; NEVER_SHOW_OLD_RECORDS_AS_CURRENT
```

## 21. D currentness integration

The parent model consumes the current `previousRejected`, `previousCurrentness.current`, current owner evidence, B1 trust and range trust exactly as #770 established:

1. B1 or range typed rejection remains latched.
2. B1 recovery requires current matching account/date identity and settled complete pair proof.
3. Range recovery requires current matching established identity and complete Previous/month proof.
4. Loading, null cache identity, ordinary partial/failure, ordinary retry or D-only success cannot clear either latch.
5. D `CURRENT`/`NO_MATCH` is required for the exact block/cutoff fact used by cues/defaults; range buckets, B1 records, comparison revision or sibling success are never substitutes.
6. D ordinary `UNAVAILABLE`/`REFRESHING` withholds history-derived facts but does not convert the whole editor to isolation unless the existing effective rejection says so.

```text
D_DEPENDENCY_INTEGRATION = PRESERVE_EXISTING_B1_AND_RANGE_REJECTION_LATCHES_AND_MATCHED_COMPLETE_RECOVERY; CONSUME_ONLY_CURRENT_D_OWNER_BLOCK_CUTOFF_EVIDENCE; NO_SIBLING_REVISION_OR_D_ONLY_CLEARANCE
```

## 22. Parent action-authority model

Define a single immutable `HealthWorkoutParentAvailability` value per render:

```text
shell: DISABLED | ADMITTED
selectedDay: DISABLED | LOADING | COMPLETE | PARTIAL_LEGACY | PARTIAL_CANONICAL | UNAVAILABLE | ISOLATION | VERIFIED_EMPTY
editor: HIDDEN | NONINTERACTIVE_DRAFT_PREVIEW | INTERACTIVE
previous: { state, qualifiedBuckets, effectiveSelection, selectionAction }
calendar: { state, activity }
history: CURRENT | PARTIAL | REFRESHING | UNAVAILABLE | REJECTED
actions: {
  navigateDate, openPrevious, selectPrevious, copyDraft,
  editDraft, useHistoricalPlanning, save, deletePersisted
}
retry: { localParent, localPairedReaders, legacyCurrentness }
lifetime: { shellToken, dateGenerationToken, ownerTokens }
```

Every action is `ADMITTED` with an opaque capture function or `FENCED` with a reason; children never reconstruct authority from visibility booleans. `HealthView` owns the committed parent/context tokens and consumes this value. AppContent owns only the local recovery controller. Source hooks keep source ownership.

```text
ACTION_AUTHORITY_MODEL = ONE_IMMUTABLE_HEALTH_WORKOUT_PARENT_AVAILABILITY_VALUE_WITH_EXPLICIT_CHILD_STATES_ACTION_PERMITS_RETRY_ADMISSIONS_AND_OPAQUE_LIFETIME_TOKENS
```

## 23. Pure derived view-model recommendation

Add `components/views/features/health/healthWorkoutParentAvailability.ts` containing a pure `deriveHealthWorkoutParentAvailability(input)` and exhaustive discriminated types. Inputs are snapshots only: B1 phase/result/isolation/publication identity, range phase/views/isolation/publication identity, effective D state, current account/date/lifetime tokens, draft dirty/scope state and feature eligibility. Outputs are the model in section 22.

The module must import no React hook, storage, repository, fetcher, writer, bootstrap controller or translation. It does not call retries or writes. Opaque permits/adapters are supplied as inputs and only selected into outputs. A small `useHealthPreviousAvailabilityState` hook separately owns presentation intent because selection transitions are stateful; it calls the pure derivation and is the sole desktop/mobile selection owner.

This split makes the 18 product matrix rows and action denial paths directly testable and prevents HealthView from accumulating independent booleans.

```text
PARENT_VIEW_MODEL_RECOMMENDATION = ADD_PURE_HEALTH_WORKOUT_PARENT_AVAILABILITY_DERIVATION_PLUS_ONE_STATEFUL_SHARED_PREVIOUS_SELECTION_COORDINATOR; NO_IO_OR_AUTHORITY_IN_THE_PURE_MODULE
```

## 24. Option C gate-OFF equivalence and shared correctness correction

The implementation must mount a new `HealthWorkoutAvailabilityCandidate` child only when AppContent has admitted the existing B1 **and** range candidate and supplies both models. When either candidate is absent, HealthView executes the current legacy subtree without the new shell/controller/adapter/selection hook.

### A. Option C gate-OFF equivalence

This component boundary, rather than conditional hook calls in HealthView, preserves the unrelated legacy behavior against the baseline after the separately reviewed Slice 0 correction:

- no new B1/range/D read or source owner;
- no new focus/visibility/bootstrap listener or retry controller work;
- no new layout/status/copy;
- no Option C writer-semantic change and no block/routine, InBody or nutrition behavior change;
- no draft mount/reset/storage/hydration change;
- no current legacy SWR/fallback behavior change.

### B. Shared correctness correction

The existing shared `HealthWorkoutOperationScope` must independently gain date-lifetime currentness for both gate-OFF Save/Delete and future Option C actions. This intentionally changes late-completion admission for the confirmed X1→Y→X2 defect. It is a correctness correction, not a feature-gated product behavior change, and cannot be claimed as exact preservation of pre-correction Save/Delete behavior. A candidate-only fix would leave the existing gate-OFF defect unresolved.

Slice 0 changes only this confirmed UI/action currentness boundary; its acceptance contract in section 30 must prove unchanged writer semantics and all unrelated legacy behavior. Later Option C slices compare gate-OFF behavior with that corrected baseline. The five literal gate constants remain false and no env/storage/runtime override is introduced.

```text
GATE_OFF_EQUIVALENCE_DESIGN = PASS_EXCEPT_FOR_SEPARATELY_REVIEWED_SHARED_DATE_ABA_CORRECTION
```

## 25. Read and listener budget

For one admitted current account/candidate lifetime:

- B1: at most the existing one verified legacy + canonical selected-day pair per admitted episode, including its existing bounded internal currentness recovery.
- Range: one paired source-snapshot load per owner episode; Previous, month Calendar and preview derive from that snapshot without extra scans.
- D: one coalesced batch for the currently consumed block IDs when admitted; no read per card/render.
- Managed recovery: retain AppContent's one coalesced focus/visibility path for B1/range. Do not add a shell listener. Retain D's current owner listener until a separately reviewed consolidation proves equivalence.
- UI: no per-child, per-Previous-date or per-Calendar-cell reader; no polling, hidden cache or unbounded retry loop.

Stable slots and status derivation are pure render work. The later implementation measures the whole selected architecture under separately selected performance criteria; no numeric threshold is invented here.

```text
READ_OWNER_BUDGET = ONE_EXISTING_B1_PAIR_AND_ONE_EXISTING_RANGE_SNAPSHOT_PER_ADMITTED_EPISODE_PLUS_ONE_COALESCED_D_BATCH_FOR_CONSUMED_IDS; ZERO_PER_SLOT_DATE_CARD_READS_AND_ZERO_NEW_LISTENERS_OR_POLLING
```

## 26. Account, date and ABA fences

Existing account generation already distinguishes account A1→B→A2. Existing `HealthWorkoutOperationScope` contains only `accountOperation` and `dateKey`; its currentness helper checks date-string equality plus current account generation. Both Save and persisted Delete in HealthView use this shared helper. The existing operation-scope tests cover a simple X→Y switch, not X1→Y→X2. An old X1 completion can therefore appear current again at X2.

This defect predates Option C and affects shared Save/Delete UI/action currentness and late-completion suppression. Option C exposed the need to reason explicitly about that lifetime; it did not create the defect. These source facts do not establish a writer-data durability failure. Changing the shared helper is an intentional correctness correction across gate-OFF and candidate paths, not candidate-only behavior preservation.

```text
DATE_ABA_CHARACTERIZATION = PASS
DATE_ABA_FIX_SCOPE = BROADER_EXISTING_DEFECT
HEALTH_WORKOUT_OPERATION_SCOPE_DATE_ABA = CONFIRMED_EXISTING_SHARED_UI_CURRENTNESS_DEFECT
DATE_OPERATION_SCOPE_TARGET = ACCOUNT_GENERATION_PLUS_OPAQUE_DATE_LIFETIME
DATE_EQUALITY_ALONE = INSUFFICIENT
```

Slice 0 must establish a shared operation scope containing `accountOperation`, `dateKey`, and an opaque date-lifetime token (or equivalent committed generation). The exact representation is finalized in that separately reviewed precursor. Every committed date transition creates fresh authority: `dateToken(X1) != dateToken(X2)` even when `dateKey(X1) == dateKey(X2)`. Unmount and scope retirement revoke UI currentness. Later Option C permits compose with this corrected shared boundary rather than implementing a second candidate-only repair.

Every newly reachable data/action path captures:

- account generation token;
- selected-date generation token, new on every committed transition including X→Y→X;
- shell lifetime token;
- exact B1/range/D owner publication/episode token used by the action;
- draft lifetime token where relevant;
- namespace/generation/device proof already owned by readers;
- request/operation token and mounted state.

Currentness requires object/token identity, not equal account/date strings or arrival order. Unmount and scope retirement revoke the token synchronously. Selection, retry permits, Save/Delete, navigation continuations and D planning all use this rule. A late durable local commit still sends payload-free fanout tagged with its captured original account; stale UI continuation remains suppressed.

```text
NEW_ACTION_ABA_FENCE_DESIGN = ACCOUNT_GENERATION_PLUS_NEW_DATE_GENERATION_PLUS_SHELL_SOURCE_DRAFT_REQUEST_IDENTITY_TOKENS_AND_UNMOUNT_FENCE; NO_EQUALITY_BASED_A_OR_X_REVIVAL
```

## 27. Durable commit preservation

The new layer is pre-dispatch admission and stronger UI currentness, not a writer redesign. It must not change local transaction semantics, expected-version handling, UUID behavior, remote sequential request shape, partial remote result semantics, assisted-reps validation, local mutation coverage, or fanout order.

Pre-dispatch/UI currentness and post-durable-commit fanout have different jobs. Slice 0 strengthens the shared scope check before an operation is dispatched and for its UI continuation; it preserves existing persistence stop points and request semantics. Once a valid local transaction has been dispatched, later navigation does not roll back or semantically cancel its durable effect.

After durable local commit, `onLocalCommit` continues to invalidate current eligible range first and B1 second for the captured original account even if that operation's UI scope has become stale. Persistence currently calls this fanout before checking postcommit `shouldContinue`. If X1 commits after navigation to Y/X2, the original-account fanout still runs, while stale X1 success/toast/lock/draft-clear/row-removal continuations cannot act as current X2 completion. Postcommit suppression cannot undo durable data. No existing admitted in-flight operation is cancelled solely because a read owner begins refreshing after valid dispatch. This docs correction implements none of these fences.

```text
DURABLE_COMMIT_PRESERVATION = PASS
POSTCOMMIT_ORIGINAL_ACCOUNT_FANOUT = MUST_BE_PRESERVED
```

## 28. Accessibility topology

The structural design is implementable without final copy or physical acceptance:

1. Each stable slot has one persistent labelled heading and one status container; state changes update that container rather than remounting the entire region.
2. Record-body loss never moves focus into detached content silently. If the initiating control remains, focus stays there; otherwise focus moves to the stable slot heading/status (`tabIndex=-1`) or its admitted retry control.
3. An open mobile sheet retains its modal trap during same-parent degradation and swaps to the shared state. Parent retirement closes it; focus restoration targets only the still-current launcher.
4. Retry controls remain keyboard reachable and expose exact LOCAL/paired/D scope; no disabled-only authority proof.
5. Announcements are coalesced per state/episode at parent slots. Repeated cards/cells do not create announcement storms.
6. Calendar `unknown` retains a non-color text/accessible-name cue distinct from absence/presence.
7. When a Previous selected record disappears, `aria-pressed` clears or moves only to the current effective bucket; focus moves to the date-group/status boundary, never to a stale record.
8. Loading, partial, unavailable, isolation, empty and draft preview remain semantically distinct at zoom/reflow/touch layouts.

```text
ACCESSIBILITY_TOPOLOGY = PASS
PHYSICAL_BROWSER_QA = NOT_EXECUTED
PHYSICAL_AT_ACCEPTANCE = NOT_EXECUTED
```

## 29. Copy-state taxonomy dependency

The later copy package must localize, for EN/KO/JA, at least:

- selected-day verified empty;
- partial with no surviving eligible record;
- ordinary unavailable;
- refreshing/current proof being reacquired;
- typed/effective isolation;
- unknown Calendar date versus complete covered absence;
- same-scope unsaved dirty draft preview;
- Save/Delete/edit/planning fenced and why;
- local parent retry, local paired-readers retry, D currentness retry, and separate remote/bootstrap retry;
- skipped/blocked/unclassified owners without claiming recovery.

This is a semantic input, not final wording or public acceptance.

```text
COPY_STATE_TAXONOMY_INPUT = PASS
PUBLIC_COPY_ACCEPTANCE = NOT_EXECUTED
```

## 30. Implementation slices and dependency graph

The design requires a reviewed sequence. Listing a slice does not authorize it.

### Slice 0 — shared date operation ABA correction

Task: `REL_05G_HEALTH_WORKOUT_OPERATION_DATE_ABA_CORRECTION_01`; label: `SLICE_0_SHARED_DATE_OPERATION_ABA_CORRECTION`.

- Purpose: close the broader existing X1→Y→X2 defect in shared Health workout Save/Delete UI currentness before Option C callback admission depends on it.
- Likely files: `healthWorkoutOperationScope.ts`, HealthView shared Save/persisted Delete scope capture and currentness, their focused helper/mounted tests, and persistence/fanout regression tests. Persistence behavior remains unchanged.
- Prerequisite: this correction receives focused rereview; Slice 0 scope/design is then separately authorized and independently reviewed before implementation.
- Acceptance: the twelve criteria below, plus explicit unmount/currentness coverage. After implementation, focused review and merge must complete before the ordered Option C sequence begins.
- Untouched: Option C presentation/permits, source owners/retry routing, gates, DB/schema/backend, durable writer transaction and request contracts.

| ID | Future acceptance requirement | Status |
| --- | --- | --- |
| ABA0-C01 | Shared operation scope distinguishes date lifetime, not only equal date string; every committed X1→Y→X2 transition produces a fresh token. | REQUIRED / NOT_EXECUTED |
| ABA0-C02 | Late X1 Save completion cannot mutate X2 UI state as if it belonged to X2. | REQUIRED / NOT_EXECUTED |
| ABA0-C03 | Late X1 persisted Delete completion cannot mutate X2 UI state as if it belonged to X2. | REQUIRED / NOT_EXECUTED |
| ABA0-C04 | Account A1→B→A2 fencing remains intact. | REQUIRED / NOT_EXECUTED |
| ABA0-C05 | Simple X→Y invalidation remains intact. | REQUIRED / NOT_EXECUTED |
| ABA0-C06 | Valid same-lifetime Save/Delete remains admitted; unmount retires currentness and cannot admit a late continuation. | REQUIRED / NOT_EXECUTED |
| ABA0-C07 | A validly dispatched durable local commit is not rolled back or semantically cancelled by later date navigation. | REQUIRED / NOT_EXECUTED |
| ABA0-C08 | After durable local commit, payload-free `onLocalCommit` invalidation/fanout for the captured original account remains independent of stale UI scope. | REQUIRED / NOT_EXECUTED |
| ABA0-C09 | Stale date lifetime suppresses late UI success/toast/lock/draft-clear/row removal. | REQUIRED / NOT_EXECUTED |
| ABA0-C10 | DB/schema/backend, expected-version, remote request, and durable writer semantics remain unchanged. | REQUIRED / NOT_EXECUTED |
| ABA0-C11 | All five gate values remain false. | REQUIRED / NOT_EXECUTED |
| ABA0-C12 | Current legacy behavior changes only by closing this confirmed shared date ABA currentness defect. | REQUIRED / NOT_EXECUTED |

```text
SLICE_0 = SHARED_DATE_OPERATION_ABA_CORRECTION
FIRST_REQUIRED_IMPLEMENTATION_PREREQUISITE = REL_05G_HEALTH_WORKOUT_OPERATION_DATE_ABA_CORRECTION_01
ABA0_C01_C12 = REQUIRED / NOT_EXECUTED
```

### Slice A — pure availability/action model foundation

- Likely files: new `healthWorkoutParentAvailability.ts` and tests only.
- Prerequisite: this design independently reviewed and Slice 0 implemented, focused-reviewed and merged under the conservative sequence.
- Acceptance: exhaustive Option C matrix, independent-source survival, editor states, action/retry denial reasons; no mount or runtime behavior.
- Untouched: HealthView JSX, owners, writers, gates, DB/backend.

### Slice B — owner publication and finite-retry adapters

- Likely files: B1/range hooks and D owner/hook plus narrow tests and types.
- Prerequisite: Slice A contracts frozen.
- Acceptance: opaque publication/episode identity, typed non-payload failure disposition, current-API unknown stays fenced, no extra read/listener.
- Untouched: rendering, writer semantics, gates, database/backend; real legacy typed path remains unclaimed.

### Slice C — local recovery controller and bounded D bridge

- Likely files: AppContent, new controller/adapter modules, HealthProps/HealthView registration, integration tests.
- Prerequisite: Slice B admission types.
- Acceptance: range/B1/D at most once, exact skipped set, coalescing, detach/account/date ABA, no remote/writer side effect.
- Untouched: public presentation, persistence, startup controller, gates.

### Slice D — stable shell and Calendar-only extraction

- Likely files: HealthView, HealthCompositionLayout or new shell, HealthSupportingPanels split, Calendar slot, structural tests.
- Prerequisite: Slice A model and Slice C recovery surface.
- Acceptance: stable selected-day/editor/Previous/Calendar/status slots; InBody/nutrition unchanged and outside; gate-OFF DOM/layout exact.
- Untouched: writer internals, source owner budgets, sibling Home/Search/comparison.

### Slice E — one desktop/mobile Previous owner

- Likely files: new `useHealthPreviousAvailabilityState`, projection/view/sheet wiring and focused tests.
- Prerequisite: shell/model.
- Acceptance: shared eligibility/selection object; loading/partial/error/isolation transitions; same-parent open sheet; account/date/range ABA and no stale records.
- Untouched: range reader, D policy, editor/writers.

### Slice F — draft preview and action admission

- Likely files: HealthView, draft/candidate permit composition and focused mounted/persistence tests; consume the corrected shared operation-scope helper from Slice 0.
- Prerequisite: Slice 0 implemented, focused-reviewed and merged; publication permits, parent model and its corrected shared date-lifetime token.
- Acceptance: dirty preview noninteractive; clean stale hydration hidden; every edit/planning/Save/Delete event guarded at callback; X→Y→X and A→B→A; durable fanout unchanged.
- Untouched: persistence transaction/request contracts, canonical adoption, block/routine/InBody/nutrition writers.

### Slice G — integrated acceptance candidate

- Likely files: bounded parent integration tests, status/copy/i18n presentation files and accessibility tests as separately approved.
- Prerequisite: Slice 0 implemented, focused-reviewed and merged; A-F individually reviewed.
- Acceptance: PA-C01 through PA-C14 automated matrix, gate-OFF/read-listener regression, qualitative instrumentation; PA-C15-C17 remain pending until their separately authorized public/physical/performance work.
- Untouched: activation gates, provenance/identity/writer blockers, DB/backend/G6.

Conservative delivery order: `0 → A → B → C → D → E → F → G`. Dependencies: `0 → A`; `A → B → C`; `A + C → D`; `D → E`; `0 + A + B + D → F`; `0 + C + E + F → G`.

A pure model can technically be reviewed without runtime effect before Slice 0, and B/C/D/E can only be independently safe if they expose no new writer action and respect their own dependencies. This package nevertheless selects the conservative order: no A-E implementation is recommended before Slice 0 closes. D must keep candidate editor mutations/Save/Delete unavailable until F supplies admission; structural visibility cannot bypass that dependency. F cannot land without Slice 0, and G cannot pass without it. No slice may claim final Option C implementation readiness before the shared correction closes.

```text
IMPLEMENTATION_SHAPE = MULTI_SLICE_SEQUENCE
IMPLEMENTATION_SLICES = SLICE_0_SHARED_DATE_OPERATION_ABA_CORRECTION, A_MODEL, B_OWNER_ADAPTERS, C_LOCAL_RECOVERY_AND_D_BRIDGE, D_STABLE_SHELL_AND_CALENDAR, E_SHARED_PREVIOUS, F_EDITOR_AND_CALLBACK_ADMISSION, G_INTEGRATED_ACCEPTANCE
IMPLEMENTATION_SLICE_ORDER = CORRECTED_WITH_SLICE_0
SLICE_INDEPENDENT_SAFETY = PASS_WITH_EXPLICIT_DEPENDENCIES
```

One PR would combine source trust typing, controller authority, risky callback fencing, layout extraction and responsive state behavior, making independent review and rollback unsafe. Every slice requires separate authorization and retains all gates false. Slice 0 corrects shared currentness even with gates OFF; all Option C behavior remains default OFF.

## 31. PA-C01 through PA-C18 traceability

Every criterion remains `REQUIRED / NOT_EXECUTED`.

| ID | Design owner | Implementation location | Automated proof | Physical/public proof if required |
| --- | --- | --- | --- | --- |
| PA-C01 | parent availability model | Slice A + selected-day slot in D | all selected-day state rows, dirty distinction, no stale publication | final localized state comprehension under PA-C15/16 |
| PA-C02 | editor/action permits + shared date currentness | Slice 0 prerequisite + Slice F | ABA0-C01-C12 and mounted event tests for every edit/planning/Save/Delete callback, not disabled DOM | keyboard/touch/focus and public action explanation |
| PA-C03 | shared Previous model | Slice E | all matrix rows including independently healthy range | responsive desktop review |
| PA-C04 | shared Previous model + sheet presentation | Slice E | same object/selection, open degradation, retirement, no stale records | supported mobile browser and AT modal/focus execution |
| PA-C05 | Calendar activity + stable slot | Slice D/G | present/covered-absent/unknown under complete/partial/loading/error/isolation | non-color/reflow/browser verification |
| PA-C06 | pure parent model and existing projections | Slice A/G | surviving source facts, both-error and partial-no-record not empty | public copy acceptance |
| PA-C07 | B1/range trust + D latch | Slice B/G | typed pair fail-closed, pre-existing rejection, matched complete recovery and independent range positive control | none beyond later public semantics |
| PA-C08 | draft owner + editor model | Slice F | preserve/restore/no auto-save/no erase/no reseed/account-date ABA | preview clarity and focus behavior |
| PA-C09 | draft/planning authority | Slice A/F | no canonical hydration/copy/adoption; formula and explicit-count precedence regression | none |
| PA-C10 | recovery controller/adapters | Slice B/C/G | exact owner call counts, dedupe, finite episodes, deterministic/unknown fence, no remote/writer effect | truthful recovery labels and user flow |
| PA-C11 | shared date-lifetime correction + opaque lifetime permits | Slice 0 prerequisite + Slice B/C/E/F | ABA0-C01-C12; A→B→A, X1→Y→X2, owner/device/namespace/generation, unmount, late completion and captured-account fanout | interruption/navigation browser scenarios |
| PA-C12 | D hook/owner adapter | Slice B/C/F | exact block/cutoff proof; no sibling/revision/default/rejection shortcuts | none |
| PA-C13 | candidate boundary + explicit shared correctness exception | Slice 0 baseline + Slice C/D/G | gates OFF: equivalent UI and zero Option C reads/listeners/retries against the corrected baseline; ABA0-C12 proves the intentional shared ABA fix is the only legacy behavior change, with draft/writer regression | whole-parent performance later under PA-C17 |
| PA-C14 | compile-time gate authority | every slice | literal five-gate false assertions; no env/storage override | activation requires a different reviewed task |
| PA-C15 | copy/accessibility owner | separate copy/acceptance task after G | translation-key completeness and role/focus unit tests are supporting only | reviewed EN/KO/JA copy plus accessibility acceptance |
| PA-C16 | qualification owner | separate authorized protocol | unit/CI cannot pass this criterion | supported physical browser/AT raw evidence required |
| PA-C17 | performance owner | separate authorized measurement | instrumentation integrity only | whole selected architecture measured against owner-selected criteria |
| PA-C18 | global authority/product owner | every review/gate | frozen constants/docs and no forbidden diff | explicit future authority required; no physical test can waive veto |

```text
PA_C01_C18_TRACEABILITY = PASS
PA_C01_C18_STATUS = REQUIRED / NOT_EXECUTED
```

## 32. Authority and frozen-state matrix

| Authority/state | Frozen value |
| --- | --- |
| `REL05G5A_001_STATUS` | `ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION` |
| `REL05G5A_001_ACTIONABILITY` | `BLOCKED_BY_FROZEN_PRODUCT_AUTHORITY` |
| `PROSPECTIVE_PROVENANCE_PD01` | `HOLD_NO_CAPABILITY_SELECTION_YET` |
| `SELECTED_PROVENANCE_CAPABILITY` | `NONE` |
| `HOME_COHERENCE` | `SEPARATE_PRODUCT_COHERENCE_DECISION_NOT_RUNTIME_DEPENDENCY` |
| `SEARCH_COHERENCE` | `SEPARATE_PRODUCT_COHERENCE_DECISION_NOT_RUNTIME_DEPENDENCY` |
| `COMPARISON_PUBLIC_STATUS` | `DEFAULT_OFF_PUBLIC_C30_NOT_EXECUTED` |
| `PUBLIC_COPY_ACCEPTANCE` | `NOT_EXECUTED` |
| `PERFORMANCE_ACCEPTANCE` | `NOT_EXECUTED` |
| `PHYSICAL_BROWSER_QA` | `NOT_EXECUTED` |
| `PHYSICAL_AT_ACCEPTANCE` | `NOT_EXECUTED` |
| `PREVDATA_C15_PUBLIC_ACCEPTANCE` | `NOT_EXECUTED` |
| `PUBLIC_C30` | `NOT_EXECUTED` |
| `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED` | `false` in [config](../src/components/views/features/health/healthSelectedDayCompositeConfig.ts) |
| `HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED` | `false` in [config](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts) |
| `HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED` | `false` in [config](../src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts) |
| `HOME_WORKOUT_COMPOSITE_READER_ENABLED` | `false` in [config](../src/components/views/features/home/homeWorkoutCompositeConfig.ts) |
| `SEARCH_WORKOUT_COMPOSITE_READER_ENABLED` | `false` in [config](../src/components/views/features/search/searchWorkoutCompositeConfig.ts) |
| `ALL_FIVE_GATES` | `false` |
| `PUBLIC_READER_ACTIVATION` | `NOT_AUTHORIZED` |
| `HEALTH_PARENT_PUBLIC_READER_ACTIVATION` | `NOT_AUTHORIZED` |
| `SEVEN_LIVE_WRITER_BLOCKERS` | `OPEN` |
| `WRITER_CONTINUITY_STATUS` | `NOT_YET_PROVEN` |
| `E3_FEASIBILITY` | `NOT_ESTABLISHED` |
| `LIFECYCLE_EVIDENCE_SOURCE` | `REMAINS_UNAVAILABLE` |
| `EXACT_TARGET_CONTROL_PROTOCOL` | `NOT_IMPLEMENTED` |
| `LOCAL_DATABASE_VERSION` | `7` in [types](../src/lib/localDatabase/types.ts) |
| `LOCAL_SCHEMA_VERSION` | `1` in [types](../src/lib/localDatabase/types.ts) |
| WorkoutSessionV1/stores/indexes/keyPaths/backend/Supabase/RLS | unchanged |
| `WRITER_AUTHORITY_CHANGED` | `NO` |

No selected policy requirement needs a schema, backend, writer-semantic, provenance, typed-isolation weakening, gate activation or unrelated-supporting-domain move. The architecture STOP condition is therefore not triggered.

## 33. Exact recommended next task

```text
STABLE_SHELL_COMPONENT_BOUNDARY = HEALTH_WORKOUT_AVAILABILITY_SHELL_WITH_SELECTED_DAY_EDITOR_PREVIOUS_CALENDAR_AND_LOCAL_RECOVERY_SLOTS
PARENT_SHELL_ADMISSION_CONTRACT = CURRENT_AUTHENTICATED_HEALTH_ROUTE_PLUS_VALID_SELECTED_DATE_PLUS_EXISTING_B1_AND_RANGE_CANDIDATE_GATES_WITH_FRESH_COMMITTED_LIFETIME_TOKEN; CHILD_PROOFS_AND_REMOTE_BOOTSTRAP_ARE_NOT_PARENT_ADMISSION
EDITOR_ADMISSION_STATE_MACHINE = HIDDEN_UNLESS_CURRENT_SHELL; INTERACTIVE_ONLY_FOR_CURRENT_SETTLED_QUALIFIED_LEGACY_PUBLICATION_WITHOUT_EFFECTIVE_REJECTION; OTHERWISE_SAME_SCOPE_DIRTY_DRAFT_ONLY_AS_NONINTERACTIVE_PREVIEW
SAVE_CALLBACK_ADMISSION_DESIGN = EVENT_BOUNDARY_OPAQUE_SAVE_PERMIT_OVER_CURRENT_SHELL_DATE_GENERATION_B1_PUBLICATION_EDITOR_AND_DRAFT_LIFETIMES; RECHECK_BEFORE_DISPATCH; PRESERVE_EXISTING_PERSISTENCE_AND_POSTCOMMIT_FANOUT
DELETE_CALLBACK_ADMISSION_DESIGN = SHARED_BASE_MUTATION_PERMIT_PLUS_EXACT_CURRENT_DRAFT_ROW_AND_PERSISTED_ID_VERSION_CHECK_FOR_DURABLE_DELETE; RECHECK_BEFORE_DISPATCH; NO_WRITER_SEMANTIC_CHANGE
PREVIOUS_SHARED_STATE_OWNER = ONE_HEALTH_LOCAL_USE_HEALTH_PREVIOUS_AVAILABILITY_STATE_COORDINATOR_CONSUMING_THE_PARENT_DERIVED_MODEL
PREVIOUS_SELECTION_STATE_MACHINE = PRIVATE_SCOPE_TOKEN_BOUND_INTENT_SEPARATE_FROM_CURRENT_PUBLICATION; NO_RECORDS_DURING_LOADING_ERROR_OR_ISOLATION; COMPLETE_RECONCILES; PARTIAL_PRESERVES_UNPROVEN_INTENT_PRIVATELY; ACCOUNT_DATE_OWNER_ABA_RETIRES_INTENT
MOBILE_SHEET_DEGRADATION_DESIGN = REMAIN_OPEN_FOR_SAME_PARENT_AND_SWAP_TO_SHARED_LOADING_PARTIAL_UNAVAILABLE_OR_ISOLATION_STATE_WITH_NO_STALE_RECORDS; CLOSE_ON_PARENT_LIFETIME_RETIREMENT
CALENDAR_SLOT_DESIGN = EXTRACT_CALENDAR_ONLY_STABLE_SLOT_REUSING_EXISTING_ACTIVITY_TRISTATE; KEEP_INBODY_AND_NUTRITION_OUTSIDE
LOCAL_PARENT_RETRY_ROUTING_DESIGN = ONE_ACCOUNT_LIFETIME_CONTROLLER_CALLING_RAW_RANGE_ONCE_RAW_B1_ONCE_AND_BOUNDED_D_ONCE_ONLY_WHEN_EACH_OWNER_ADMITS; NO_WRAPPED_DUPLICATION_OR_REMOTE_WRITER_SIDE_EFFECT
D_OWNER_BRIDGE_RECOMMENDATION = OPTION_B_BOUNDED_LEGACY_PREVIOUS_RECOVERY_ADAPTER_ATTACHED_TO_ACCOUNT_SCOPED_HEALTH_LOCAL_RECOVERY_CONTROLLER
RETRY_ADMISSION_MODEL = PER_OWNER_SCOPE_AND_EPISODE_TAGGED_DISCRIMINATED_ADMISSION_WITH_ONE_SHOT_PERMIT; ROUTE_ONLY_ELIGIBLE_AND_FENCE_UNKNOWN_OR_DETERMINISTIC_FAILURE
FINITE_RETRY_CLASSIFICATION_DESIGN = RETAIN_TYPED_NONPAYLOAD_FAILURE_DISPOSITION_AND_OPAQUE_EPISODE_AT_EACH_OWNER_CATCH_BOUNDARY; ONE_INHERITED_TRANSIENT_PERMIT; DETERMINISTIC_AND_UNKNOWN_STATES_FENCED
FINITE_RETRY_PROVABLE_WITH_CURRENT_APIS = PARTIAL
D_DEPENDENCY_INTEGRATION = PRESERVE_EXISTING_B1_AND_RANGE_REJECTION_LATCHES_AND_MATCHED_COMPLETE_RECOVERY; CONSUME_ONLY_CURRENT_D_OWNER_BLOCK_CUTOFF_EVIDENCE; NO_SIBLING_REVISION_OR_D_ONLY_CLEARANCE
ACTION_AUTHORITY_MODEL = ONE_IMMUTABLE_HEALTH_WORKOUT_PARENT_AVAILABILITY_VALUE_WITH_EXPLICIT_CHILD_STATES_ACTION_PERMITS_RETRY_ADMISSIONS_AND_OPAQUE_LIFETIME_TOKENS
PARENT_VIEW_MODEL_RECOMMENDATION = ADD_PURE_HEALTH_WORKOUT_PARENT_AVAILABILITY_DERIVATION_PLUS_ONE_STATEFUL_SHARED_PREVIOUS_SELECTION_COORDINATOR; NO_IO_OR_AUTHORITY_IN_THE_PURE_MODULE
GATE_OFF_EQUIVALENCE_DESIGN = PASS_EXCEPT_FOR_SEPARATELY_REVIEWED_SHARED_DATE_ABA_CORRECTION
READ_OWNER_BUDGET = ONE_EXISTING_B1_PAIR_AND_ONE_EXISTING_RANGE_SNAPSHOT_PER_ADMITTED_EPISODE_PLUS_ONE_COALESCED_D_BATCH_FOR_CONSUMED_IDS; ZERO_PER_SLOT_DATE_CARD_READS_AND_ZERO_NEW_LISTENERS_OR_POLLING
NEW_ACTION_ABA_FENCE_DESIGN = ACCOUNT_GENERATION_PLUS_NEW_DATE_GENERATION_PLUS_SHELL_SOURCE_DRAFT_REQUEST_IDENTITY_TOKENS_AND_UNMOUNT_FENCE; NO_EQUALITY_BASED_A_OR_X_REVIVAL
DURABLE_COMMIT_PRESERVATION = PASS
POSTCOMMIT_ORIGINAL_ACCOUNT_FANOUT = MUST_BE_PRESERVED
ACCESSIBILITY_TOPOLOGY = PASS
COPY_STATE_TAXONOMY_INPUT = PASS
IMPLEMENTATION_SHAPE = MULTI_SLICE_SEQUENCE
DATE_ABA_CHARACTERIZATION = PASS
DATE_ABA_FIX_SCOPE = BROADER_EXISTING_DEFECT
HEALTH_WORKOUT_OPERATION_SCOPE_DATE_ABA = CONFIRMED_EXISTING_SHARED_UI_CURRENTNESS_DEFECT
DATE_OPERATION_SCOPE_TARGET = ACCOUNT_GENERATION_PLUS_OPAQUE_DATE_LIFETIME
DATE_EQUALITY_ALONE = INSUFFICIENT
SLICE_0 = SHARED_DATE_OPERATION_ABA_CORRECTION
IMPLEMENTATION_SLICE_ORDER = CORRECTED_WITH_SLICE_0
SLICE_INDEPENDENT_SAFETY = PASS_WITH_EXPLICIT_DEPENDENCIES
DESIGN_IMPLEMENTATION_READY = NO_PENDING_SHARED_DATE_ABA_CORRECTION
DESIGN_BLOCKER = PR773-R01_SHARED_DATE_OPERATION_ABA_SCOPE
FIRST_REQUIRED_IMPLEMENTATION_PREREQUISITE = REL_05G_HEALTH_WORKOUT_OPERATION_DATE_ABA_CORRECTION_01
PR773_R01 = CORRECTED_PENDING_REREVIEW
```

The integration design becomes implementation-ready only after Slice 0 scope/design is independently reviewed, the shared defect correction is implemented, and its focused review and merge are complete. This docs correction does not close the runtime defect or authorize Slice 0 or A_MODEL implementation. The immediate next action is focused rereview of this correction.

```text
NEXT_ACTION = FOCUSED_REREVIEW_PR_773_INTEGRATION_DESIGN_CORRECTION_01
RECOMMENDED_NEXT_ACTION = FOCUSED_REREVIEW_PR_773_INTEGRATION_DESIGN_CORRECTION_01
```
