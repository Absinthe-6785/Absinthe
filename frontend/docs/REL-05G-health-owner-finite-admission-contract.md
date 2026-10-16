# REL-05G Health owner finite admission contract

## 1. Decision and publication boundary

Task: REL_05G_HEALTH_OWNER_FINITE_ADMISSION_CONTRACT_01.

Recommend **D now: deny execution until authoritative source-owner evidence exists**, with **A as the proposed future authority origin: an owner-issued one-shot permission derived from a proven transient episode**. Neither a controller counter nor a raw retry callback supplies the missing permission. This packet does not select a production transient error category.

The immediate contract gap is reproducible: Slice B reports UNKNOWN / FINITE_PERMIT_NOT_EXPOSED for an unclassified failed owner; it exposes no executable request or consumption API. B18 and B20 remain NOT_PROVEN for positive finite eligibility and consumption. Their passing regression tests prove denial, not an available permit.

    PACKET_STATUS = CORRECTION_IMPLEMENTED_FOCUSED_REREVIEW_PENDING
    CONTRACT_APPROVAL = NOT_APPROVED
    PRODUCT_DECISIONS = PENDING_EXPLICIT_HUMAN_DISPOSITION
    CURRENT_EXECUTABLE_FINITE_ADMISSION = NONE
    SLICE_C_STATUS = BLOCKED_BY_CONTRACT_GAP
    SLICE_C_AUTHORIZATION_GRANTED = NO

This is a docs-only decision packet for independent architecture/contract review. It creates no permit, execution port, controller, D bridge, reader or public UI. The proposed requirements below are future acceptance conditions, not implemented capabilities.

Correction task: PR_778_R01_LEGACY_RECOVERY_EFFECT_CONTRACT_CORRECTION_01. The original independent review of head fb955b8f7645e1c4b0fd9c66c39c9929c2a58760 returned CHANGES_REQUIRED, P0/P1/P2/P3 = 0/0/1/0, with finding PR778-R01. This correction documents inherited legacy recovery effects only. PR778-R01 remains open pending independent focused rereview; it is not self-closed. FA01–FA20 remain NOT_EXECUTED and FA-PD01–04 remain PENDING.

## 2. Exact baseline and governing contracts

Repository: Absinthe-6785/Absinthe. Canonical workspace: C:\Users\이도현\GitRepos\Absinthe. D:\Projects\Absinthe is excluded.

Base main: f5246ab529f1839cc3d256a80736bc1bdff2afee. [PR #777](https://github.com/Absinthe-6785/Absinthe/pull/777) is merged/closed; reviewed head feffe9962d5ca43296c565f367734ffae6fb31f7 is its second parent. Both have tree 55d32a68e1d110491fcfe6702c3d6c5c4386aade. [Post-merge CI 38837955031](https://github.com/Absinthe-6785/Absinthe/actions/runs/38837955031) completed SUCCESS for test, typecheck, build, backend-rel05g1 and backend-recovery. The starting tracked/index state was clean. An existing unreadable backend/.pytest_cache warning is not a source change.

| Contract | Governing content at this base |
| --- | --- |
| [PR #772](https://github.com/Absinthe-6785/Absinthe/pull/772), [product decision](REL-05G-health-parent-partial-source-availability-product-decision.md), sections 15, 19 and 22 | Option C policy and permitted-owner LOCAL fanout; one additional user read only for a genuine transient episode; unchanged deterministic failures do not receive another attempt. UNKNOWN remains fenced. Policy approval is not execution proof. |
| [PR #773](https://github.com/Absinthe-6785/Absinthe/pull/773), [integration design](REL-05G-health-parent-partial-source-availability-integration-design.md), sections 16–19 and 30 | Raw RANGE then B1 then independent D, no wrapped duplication; only ELIGIBLE with owner-scoped consumePermit enters a plan. Partial classification proof and an unestablished real legacy typed-isolation path remain explicit. |
| [PR #774](https://github.com/Absinthe-6785/Absinthe/pull/774), [date ABA scope](REL-05G-health-workout-operation-date-aba-correction-scope-design.md) | Committed opaque lifetime, not account/date equality, render mutation or a revision counter, governs operation currentness. |
| [PR #775](https://github.com/Absinthe-6785/Absinthe/pull/775), [operation authority](../src/components/views/features/health/healthWorkoutOperationScope.ts), [layout lifetime](../src/components/views/features/health/useHealthWorkoutOperationLifetime.ts) | Actual private-issued operation identities and layout retirement. Future retry authority must compose with these boundaries, not turn a writer operation token into a read permit. |
| [PR #776](https://github.com/Absinthe-6785/Absinthe/pull/776), [Slice A model](../src/components/views/features/health/healthWorkoutParentAvailability.ts) | Pure prerequisite derivation. Its abstract TRANSIENT/permit input can represent a future admission; it does not issue or consume one. |
| [PR #777](https://github.com/Absinthe-6785/Absinthe/pull/777), [Slice B adapters](../src/components/views/features/health/healthWorkoutOwnerAdapters.ts) | Real owner publication bindings, payload-free observed failures and fail-closed UNKNOWN; no finite user admission or consumption. R01/R02 remain closed. |

The three approved documents, #775 operation/lifetime modules and Slice A model are unchanged from their corresponding merged contracts at this base. Slice B is CLOSED_IN_MAIN. Historical pending labels inside earlier design documents do not reopen already closed slices. This packet does not change those documents or review their old findings again.

## 3. Actual owner capability inventory

### Shared legacy read and inherited recovery effects

[HealthRepository.readAll](../src/lib/healthLocalRepository.ts) follows readAuthoritativeDatasets → recoverPendingImport → restorePendingIfStillCurrent; the last call is conditional. This legacy account-scoped path is not literally read-only in every valid repository state, and not every readAll performs a restoration write.

With no import state or an already VERIFIED_IMPORT_COMPLETE state, recoverPendingImport returns NO_PENDING without restoring datasets; readAuthoritativeDatasets still requires valid verified authority and dataset/count consistency before returning data. With IMPORT_COMMITTED_PENDING_READBACK, recovery validates the account/snapshot binding, snapshot hash/content and prior import state/counts. restorePendingIfStillCurrent rechecks the exact account/snapshot pending state inside a read-write transaction before deleting that account's rows across the existing HEALTH_RECOVERY_DATASETS set and reinserting the prior snapshot. It puts the valid prior import state, or deletes import state if the prior state was null. Post-restore readback is verified; readAll can still reject if verified authority is absent. Invalid evidence is not permission to repair it. A superseded pending state returns STALE without applying the restoration; an opened read-write transaction is not itself proof of a dataset write.

These are inherited recovery preconditions, transactions, target datasets and semantics, not new authority introduced by finite-admission work. The target is the existing account recovery dataset set, not merely the selected date or queried blocks. The [existing pending-import scenario](../src/lib/healthRecoveryImport.test.ts) creates IMPORT_COMMITTED_PENDING_READBACK and then calls readAll, observing restoration of the old verified data/import state. That test source was inspected, not executed for this correction.

| Owner | Exact transitive reachability |
| --- | --- |
| B1 | loadPair → loadVerifiedSelectedDayLegacySnapshot → createLocalHealthRepository(accountId).readAll(). |
| RANGE | WorkoutReadSnapshotCoordinator.load legacyPromise → createLocalHealthRepository(accountId).readAll(). |
| D | The private hook's loader → fetchPrevWorkoutForBlocks → readLocalPreviousWorkout → createLocalHealthRepository(accountId).readAll(), only when the loader actually runs through the LOCAL branch with an account. D ensure denies absent/rejected/unsupported scope; reused evidence, blocked/empty dependency sets or existing flights need not start a loader. The helper's remote branch and LOCAL-without-account return do not reach this repository read. |

Distinguish normal verified reads, conditional legacy restoration, existing canonical namespace/metadata initialization, explicit writer callbacks, and genuinely new effects. NO_NEW_WRITER_AUTHORITY does not imply NO_PERSISTENCE_WRITE_CAN_OCCUR_DURING_READ. An independently admitted owner read may inherit the established restoration path without invoking Save/Delete, but that effect is neither harmless by definition nor exempt from measurement. Conversely, any additional adapter/controller read beyond that admitted unchanged owner operation is a new effect even if it calls an existing method. Canonical initialization is a separate existing open path; it must not stand in for the legacy restoration inventory. No recovery precondition, transaction behavior, dataset target, import-state transition or authority is changed or expanded by this packet.

### B1 selected day owner

The owner is [useHealthSelectedDayComposite](../src/components/views/features/health/useHealthSelectedDayComposite.ts), constructed in [AppContent](../src/components/AppContent.tsx). One loadPair reads legacy and canonical sources together. [selectedDayLegacySnapshot](../src/components/views/features/health/selectedDayLegacySnapshot.ts) derives editor and persisted-row projections from one legacy repository readAll. [WorkoutSelectedDayReader](../src/lib/workoutSelectedDayReader.ts) opens the canonical scope, verifies active generation and queries sessions by local date.

| Concern | Actual baseline capability |
| --- | --- |
| Failure origins | Legacy open/read/projection catch; canonical open/read catch; final current-scope verification catch; composite projection catch. |
| Retained categories | observeOwnerFailure preserves genuine CompositeWorkoutReadIsolationError, the narrow deterministic LocalDatabaseError allowlist, or UNCLASSIFIED with a code/UNKNOWN. No error message or source payload is exposed. Plain malformed-row/projection errors stay unclassified despite a possibly deterministic cause. |
| Typed transient evidence | NONE for an additional user retry. STALE_GENERATION/device changes drive existing internal currentness recovery, not a user-transient disposition. |
| Unknown examples | Plain Error; OPEN_FAILED; generic transaction/open errors; exhausted currentness recovery settling without qualified data. Some caught currentness failures do not retain a cause. |
| Failure episode | No durable or in-memory finite-user-failure episode exists. Each load has a fresh request object; that object explicitly is not an execution permit. |
| Publication and retirement | Exact layout-issued connection, owner lifetime, source publication, request sequence, mount epoch and committed account/date scope version. Retry, replacement, cleanup or layout disconnect revoke held evidence. No consumed-permit state exists to retire. |
| Automatic recovery | One stale-generation reopen in readCanonical; separately one whole-pair currentness recovery per manual/lifecycle load effect. Those internal bounds do not cap user gestures. |
| User entry point | Raw retry(): void increments sequence, revokes publication and schedules refresh. It does not classify admission, atomically consume a user allowance or return the eventual result. |
| Existing coalescing | openingRef shares an in-progress canonical open. Sequence fencing discards superseded work. Neither proves one admitted retry per failure episode or shared results for concurrent user callers. |
| Scope and side effects | Account/date and committed-connection checks surround publication; canonical scope and established device are checked in the read path. Raw retry schedules existing reads/invalidation/state updates, whose legacy readAll can conditionally restore account recovery datasets/import state as described above. Canonical opening can separately initialize existing namespace metadata. Neither is a direct Save/Delete callback or a grant of new writer/restoration authority. |

### RANGE source owner

The owner is [useHealthWorkoutRangeSnapshot](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts), also in AppContent, backed by [WorkoutReadSnapshotCoordinator](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts) and [WorkoutRangeReader](../src/lib/workoutRangeReader.ts). It shares a broad source snapshot across Previous, Calendar and qualified Search/comparison borrowers; bounds derivation is not a second independent source owner.

| Concern | Actual baseline capability |
| --- | --- |
| Failure origins | Canonical open/readAllActive and legacy repository readAll inside coordinator.load; active-scope checks; pure row/composite projection; deriveRange and final publication verification. |
| Retained categories | Hook load/derive catches call observeOwnerFailure. Coordinator Promise.allSettled can instead turn a rejected source into status:error, retaining no per-source typed reason in WorkoutReadSourceSnapshot. Typed pair isolation is rethrown; currentness verification can collapse a failure to false/null. A settled partial result is not proof of a transient cause. |
| Typed transient evidence | NONE for an additional user retry. No source-produced transient episode or consumption API survives these boundaries. |
| Unknown examples | Unclassified thrown error, OPEN_FAILED, swallowed source error in a partial snapshot, null currentness result without a retained cause. |
| Failure episode | Fresh load/derive request objects and publicationSequence identify work, not a stable finite-user-failure episode. |
| Publication and retirement | Layout connection, source/coordinator lifetime, owner epoch, exact bounds/preview identity and request publication. Settled views also require the captured coordinator snapshot/publication and its live currentness accessor. Invalidation, layout retirement, owner replacement and cleanup revoke proof. |
| Automatic recovery | Coordinator load loop has at most two source attempts for STALE_GENERATION. The hook separately permits one automatic currentness reload before settling; invalidateAndReload resets that internal flag, and admitted current success also resets it. This is not a one-user-attempt ledger. |
| User entry point | Raw invalidateAndReload(): void; retry is its alias. It invalidates comparison/coordinator/publications and schedules refresh, without an admission receipt or shared completion. Coordinator.retry() calls load() directly and is not an alternative product-owner admission port. |
| Existing coalescing | Many views reuse one source snapshot. load() invalidates preceding work; it does not share a finite-user-retry result. Existing source reuse must not be advertised as request coalescing authority. |
| Scope and side effects | Account, device, namespace/generation, exact source and bounds fences; legacy readAll with the shared conditional restoration effects, separate existing canonical metadata/open work, and borrower invalidation. Currentness accessors may read established device storage and revoke a stale coordinator; they are not zero-cost pure booleans. |

### D independent Previous currentness owner

[LegacyPreviousCurrentness](../src/components/views/features/health/legacyPreviousCurrentness.ts) is private to HealthView through [useLegacyPreviousCurrentness](../src/components/views/features/health/useLegacyPreviousCurrentness.ts). It is not the legacy Previous SWR mutate callback and is not a B1/RANGE sub-owner.

| Concern | Actual baseline capability |
| --- | --- |
| Failure origins | flush catches its loader; the production loader is [fetchPrevWorkoutForBlocks](../src/components/views/features/health/prevWorkoutFetch.ts). Its LOCAL branch calls [readLocalPreviousWorkout](../src/lib/healthLocalRuntime.ts) for exact account/block IDs/beforeDate. |
| Retained categories | A caught ordinary loader failure yields UNAVAILABLE and observed non-payload failure; an injected typed CompositeWorkoutReadIsolationError rejects/suppresses the owner. A successful local omission yields per-query NO_MATCH, not whole-source emptiness. |
| Production evidence limit | The helper's remote branch collapses HTTP failure/transport rejection to omission before D sees it; it is not transient or absence proof for LOCAL admission. The actual legacy typed-isolation production path remains NOT_ESTABLISHED. Tests injecting that error prove reaction, not production provenance. |
| Typed transient evidence | NONE. UNAVAILABLE and a callable invalidate method do not supply it. |
| Failure episode | No stable finite-user-failure episode. captureOwnerEvidence.request is the aggregate publication tag only while flights exist, and explicitly not a permit. |
| Publication and retirement | Exact configured scope object/lifetime/publication; close/configure revoke prior evidence and resolve old flights as STALE_OR_SUPPRESSED. The hook commits effective rejection and parent trust in layout. |
| Automatic recovery | No retry loop on failed flush. Existing mutation end/focus/visibility/bootstrap invalidation may refresh consumed dependencies; those lifecycle events are not a new finite user episode. |
| User entry point | No production upward D retry/registration port in HealthProps. ensure(ids) reuses qualified/UNAVAILABLE evidence or existing flights; invalidate('unknown') revokes dependencies and starts ensure without returning their completion. It is not admitted merely because it is callable. |
| Existing coalescing | Same-block pending promises are reused; microtask batching groups queued dependencies. Repeated invalidate can revoke those flights, so this is not atomic user-retry coalescing. |
| Scope and side effects | Current account, exact beforeDate, consumed block identities, configured local authority, mutation barriers and effective parent rejection. An actual LOCAL loader can reach legacy readAll and inherit its conditional account recovery writes; the shared reachability limits above apply. It has no independent canonical device/namespace proof or legacy typed-isolation producer to lend to siblings. Reads and invalidation cannot clear parent rejection or grant new writer/restoration authority. |

### Existing routing boundaries

AppContent.refreshCompositeWorkoutReaders invokes raw RANGE then raw B1. Both public Health retry wrappers borrow that fanout; calling both duplicates it. onLocalWorkoutCommitted is an account-fenced durable-commit notification, not a user recovery permit. Existing focus/visibility/bootstrap refresh paths retain their own lifecycle semantics.

Home borrows the selected-day owner. Search's qualified retry invokes raw range invalidation; comparison borrows the range retry alias. HealthView's legacy Previous mutate callback revalidates its SWR path, not D. None of these borrowers creates admission authority. [startupBootstrapCoordinator](../src/lib/startupBootstrapCoordinator.ts).retry('health') starts remote/bootstrap work and must remain excluded from LOCAL recovery.

## 4. Approved policy and missing execution contracts

Already approved: independent source trust, fail-closed rejection, genuine-transient finite ceiling, no deterministic retry loop, raw owner routing without duplicate wrappers, separate remote recovery, and committed lifecycle fences.

Missing at the actual owner boundaries: a positively established transient category and producer; a stable failure-episode identity; an owner-owned atomic one-shot registry; a captured operation bound to consumption; and a completion handle that concurrent callers can share. Keeping a code string, a current publication or a private WeakSet alone does not establish all of these.

The Slice A abstract TRANSIENT input and #773's proposed ELIGIBLE shape are specifications, not authority producers. Slice B intentionally supplies observation-only UNKNOWN. No owner can currently admit the new finite user retry through this proposed contract.

## 5. Candidate authority origins

| Option | Actual evidence and new authority required | Agreement and failure or ABA risk | IO and trust implications | Decision requirement |
| --- | --- | --- | --- | --- |
| A Owner-issued permission from proven transient episode | Current catches and lifetime fences are available; positive typed transient producer, episode lifecycle and atomic consumption are missing. | Matches #772 finite ceiling and #773 admission model if the failure is genuinely proven and the whole owner is safe to retry. Request changes/reclicks cannot replenish it. | Reuses raw owner IO only after admission, preserving and separately accounting for inherited recovery under sections 3/13; no new source/listener/writer or restoration authority. Exact fence cost must be counted. Owner retains classification and execution authority. | Independent contract review and explicit human disposition of the choices in section 16; separate implementation requests and real proof. Not available now. |
| B Controller-owned one-shot counter without owner permission | Raw methods are callable, but a counter cannot classify their cause or authorize the call. | Conflicts with #773 if used as a substitute for owner admission. Remount/ABA/new counter can replenish an unjustified attempt; one unsafe call is still unsafe. | Can retry deterministic or rejected sources and duplicate broader pair reads. Controller would replace owner trust. | Not recommended. Any policy replacing owner authority would need a new explicit product/architecture decision; this packet does not make it. Bookkeeping after A consumption is not this option. |
| C Raw callback equals executable authority | Existence and existing uses of retry/invalidate prove behavior only. No finite episode or consumption evidence. | Conflicts with #772/#773. Repeated clicks/lifecycle changes can schedule unbounded new requests; stale closures and paired wrappers add risk. | Unqualified local reads and duplicate fanout; using startup callbacks also crosses remote authority. | Reject as a contract interpretation; no implicit approval or implementation authorization. |
| D Deny-only pending owner evidence | Existing UNKNOWN/blocked/in-flight/recovered classifications and live fences are sufficient to withhold dispatch. | Preserves #772/#773; it does not complete Slice C's positive execution/coalescing requirements. | No new retry/read/listener/writer; no bypass of independent D trust. | Recommend as current disposition, not a new public behavior change. Future A remains separately gated. |

## 6. Typed classification requirements

All classifications must originate at the authoritative owner's existing failure/settlement boundary and be bound to its exact current operation. A caller-supplied code, boolean, callback or copied record cannot create evidence.

| Required classification | Minimum evidence | Actually proven at this base |
| --- | --- | --- |
| TRANSIENT_RETRYABLE_EPISODE | Genuine typed cause from a reviewed producer; safe whole-owner read retry with inherited persistence effects qualified under sections 3/13, not a literal write-free guarantee or new restoration authority; every lane reread by the raw call qualified safe or proven transient, with deterministic or unsafe UNKNOWN lanes vetoing the whole call; exact committed parent/owner/source scope; stable new-cause witness and episode; inherited one-user allowance not used by this episode. | NOT_PROVEN for B1/RANGE/D. There is no production-positive category selected here. |
| DETERMINISTIC_IDENTITY_OR_INTEGRITY_BLOCK | Genuine CompositeWorkoutReadIsolationError or actual LocalDatabaseError in observeOwnerFailure's narrow deterministic allowlist, observed at the owner boundary. Preserve denial and required external correction, never infer correction from another owner's success. | Typed isolation handling and allowlisted deterministic-code retention are implemented. B1/RANGE have concrete persisted-entity and legacy account-check origins. D's reaction to injection is proven; a real legacy typed-isolation producer is not. |
| UNCLASSIFIED_FENCED | Missing/unrecognized cause, plain error, flattened source:error, or insufficient scope/episode proof. Diagnostic reason must not include payload/message/operation text. | Implemented. OPEN_FAILED is deliberately UNCLASSIFIED; absence of a deterministic code does not make a cause transient. |
| CURRENTLY_IN_FLIGHT | Exact current owner/request publication is loading/REFRESHING with a live operation. This denies a new execution; it does not itself provide a future admission flight handle. | Observed by Slice B for each owner. Raw hook callbacks still return void; current loading tags do not prove controller result sharing. |
| RECOVERED | Current affirmative evidence for the whole requested owner, not a successful promise alone. B1 complete pair; RANGE complete current Previous/month views from exact source; D all exact consumed dependencies CURRENT/NO_MATCH, nonempty and unrejected. | Current observation implemented, subject to each owner's fences. A healthy sibling cannot satisfy it. |

Device-currentness failure, STALE_GENERATION and a failed metadata fence are **not** genuine transient classification by themselves. Retire stale evidence; retain existing bounded internal recovery only. Namespace/generation identity mismatch and persisted entity integrity failures remain blocked where typed, otherwise UNKNOWN, never transient by exclusion. A possible transport/network outage, HTTP omission, timeout or generic open failure does not prove a retryable local episode. D effective rejection blocks; missing cutoff/block proof is unsupported or temporarily ineligible, not evidence of a transient failure.

[Local database errors](../src/lib/localDatabase/errors.ts) distinguish codes but do not define finite-user-retry policy. Even an actual OPEN_BLOCKED event in [openLocalDatabase](../src/lib/localDatabase/repository.ts) proves a blocked open, not safe eventual recovery or cause resolution. Naming any such code as transient requires separate source-level proof and review.

## 7. Independent feasibility verdicts

| Owner | Verdict | Required code boundary and non-payload observation proposal | May admit user retry now |
| --- | --- | --- | --- |
| B1 | BLOCKED_BY_MISSING_TYPED_EVIDENCE | Existing loadPair/readCanonical/legacy catches must first preserve authoritative lane disposition and a genuinely proven cause episode. A future owner port may expose exact owner/connection/episode handles, reviewed reason code, eligibility state, live currentness and consumption method; no daily/session data. | NO; UNKNOWN stays denied. A lane-only retry is not available; any deterministic/unknown unsafe lane fences the whole paired owner. |
| RANGE | BLOCKED_BY_MISSING_TYPED_EVIDENCE | First retain typed non-payload per-source failure provenance across coordinator.load's allSettled projection and hook load/derive/currentness settlement. Then bind a proven episode to the exact owner/source/bounds and currentness fence. Do not obtain an admission by calling coordinator.retry directly. | NO; a partial snapshot or generic null does not establish cause. |
| D | BLOCKED_BY_MISSING_TYPED_EVIDENCE | First prove a real local loader failure producer and exact dependency/cutoff/rejection qualification at flush plus the hook trust boundary. Proposed observation has opaque scope/dependency-set/episode handles, reason and denied/eligible state, not block payloads or a rejection-clear function. Unsupported remains a valid future bridge capability. | NO; no finite transient proof, independent D safety prerequisites remain mandatory. |

REQUIRES_BOUNDED_OWNER_CHANGE would be appropriate only after a positive typed source category and its safe scope have actually been proved, leaving bounded publication/episode mechanics to implement. It is not the present verdict. Merely adding an enum case at the catch would not change these verdicts. PROVABLE_NOW applies to none of the three.

## 8. Proposed failure episode lifecycle

This lifecycle is a future requirement for option A, not a replacement for current owner IO/request identities.

1. The authoritative owner observes a reviewed typed failure for a current issued operation after existing internal recovery has settled. It validates the whole owner is retry-safe. If any proof is missing, publish UNCLASSIFIED_FENCED without an episode or permission.
2. The owner alone issues an opaque failure episode, recording a non-payload causal witness, exact registered owner, committed parent account-operation/date/route/shell lifetime, source lifetime/publication, and existing device/namespace/generation proof where applicable. Render, controller construction, request sequence and gesture never issue it.
3. An unconsumed episode can expose ELIGIBLE only while all currentness/rejection/dependency requirements still hold. A rerender may publish another view of the same episode; it must not reset allowance. Metadata-only publication replacement is not a new failure cause.
4. Consumption changes the existing episode to reserved/in-flight. The new retry request/publication is a child operation of that same episode, not another one-permit episode. Failure of the admitted retry exhausts it, even if a catch sees the same typed cause again.
5. Verified own recovery retires the episode as recovered. Only a subsequent independently initiated, authorized normal operation with a genuinely distinct, proven failure cause may create a new episode after recovery. A retry chain cannot do so. An independently completed external correction must provide its separately authorized proof, not a click or assumed repair.
6. Account/date/route/shell layout retirement, owner replacement/detach, device/scope invalidation, conflicting rejection or superseding incompatible operation permanently retire the old episode. Same strings on return never reinstall it. Late success/failure must pass the original operation and episode fences before settlement; otherwise it settles as retired without granting fresh authority.

An authorized retry necessarily revokes the failed read publication. Its consumed episode remains in the owner registry solely to track that exact reserved child operation and shared result; old admission snapshots do not remain executable. Do not require the invalidated failed publication to stay current for the child to finish, and do not substitute whichever publication is newest. The owner must bind the child request before it can publish/settle, while independent scope/connection/source replacement still retires it. Existing invalidation-driven automatic recovery does not become an alternate child or replenish the user allowance.

Account A→B→A and date X→Y→X require the existing committed opaque-lifetime boundaries. A fresh mount or page reload with no retained authoritative cause witness starts UNKNOWN; it is not permission replenishment. This proposal is in-memory, exact-owner-lifetime admission, not a persistent or cross-tab global retry ledger.

Device A→B→A requires particular care. Existing RANGE currentness invalidates its publication when it **observes** a changed device; B1 checks device in its read path. These do not prove that an entire unobserved A→B→A storage cycle can be detected by equal final values. F1 must establish sufficient existing device-lifetime evidence for any proposed positive category; otherwise deny device-sensitive admission. No new device identity, polling, listener, metadata probe or provenance capability is authorized to hide this limitation. D cannot borrow a sibling's canonical device proof.

## 9. Proposed one shot consumption semantics

The conceptual #773 consumePermit() must perform an owner-owned synchronous state transition, not return a boolean derived from a copied snapshot. No runnable API is introduced in this packet.

| Boundary | Required future behavior |
| --- | --- |
| Before consumption | Verify exact registered owner, private-issued episode and committed scope; current failure classification; no rejection; no incompatible active flight; unconsumed state. Existing authoritative fence accessors, not caller booleans, perform validation. |
| Linearization | In one synchronous critical section in the owner realm, change UNCONSUMED to RESERVED and install one shared attempt/result identity. A second caller cannot also reserve. Private registry membership plus mutable consumed state is required; object identity or Object.freeze alone is insufficient. |
| Returned authority | A successful consume result is an opaque owner-bound reservation/attempt handle, not arbitrary permission to call any function. The owner retains an exact one-use dispatch operation; copying/spreading/serializing a handle, or replacing an owner, cannot produce registry membership or another allowance. |
| Synchronous dispatch | Prefer owner-controlled consume-and-start in the same turn with an immediate final live fence. The underlying operation must be the same raw B1/range/D action authorized for that owner, never a broader wrapper. |
| Deferred dispatch | If React scheduling/async preflight separates consumption from invocation, the owner must recheck scope, episode, source and rejection immediately before the actual call/read starts and bind the resulting hook request to the reservation. A bare callback scheduling setRefresh is not a completed attempt. |
| Detach before start | Do not invoke; settle NOT_STARTED_RETIRED. The consumed reservation remains spent/retired, not refundable into a new lifetime. |
| Throw or dispatch failure | Settle DISPATCH_FAILED/FAILED on the shared result, retain consumption, do not retry automatically or refund. Failed reads do not become new episodes. |
| Cancellation | Detach/retirement/cancel revokes publication and later execution; abort only where the existing operation supports it. Already-started IO may complete but cannot publish to another lifetime. Cancellation does not restore allowance. |
| Successful completion | Require the exact owner's fresh affirmative proof before SUCCEEDED. Promise fulfillment, partial success and sibling recovery do not qualify. Retire the episode; future requests get RECOVERED, not another consumed action. |
| Exhaustion | Every later same-episode request is consumed/denied, or joins its still-active attempt. No rerender, reclick, timeout, focus, reload or equal-value return resets it. |

The owner must reserve the attempt before invoking callbacks so synchronous reentrancy is also fenced. The future implementation must not expose a time-of-check/time-of-use gap where consumption succeeds but a consumer invokes an unbound raw retry after the owner retires. A controller may track plans only after this owner transition; it cannot own a competing permission ledger. This atomicity claim is restricted to one authoritative owner realm, not multiple tabs/processes.

## 10. Proposed coalescing and shared results

For the same exact owner/parent/episode, all valid simultaneous callers must join the installed attempt handle rather than invoke the raw callback again. They observe the same completion and typed non-payload outcome. Requesting a subset of owners may share those per-owner flights; a different aggregate plan is not permission for duplicate underlying work.

An already-running unrelated normal read has no user attempt reservation to consume. Classify ALREADY_IN_FLIGHT, skip new dispatch and report it exactly. Only join a completion if the owner actually exposes a bound handle; current Slice B loading tags do not. A fulfilled but not freshly qualified attempt ends unavailable/blocked, not recovered. Caller cancellation may abandon that caller's wait but cannot cancel another caller's right to the shared result; owner retirement still retires the attempt for all.

Outcome vocabulary must separate STARTED, JOINED, ALREADY_IN_FLIGHT, RECOVERED, CONSUMED, UNSUPPORTED_CLASSIFICATION, WAITING_FOR_PARENT, NO_DEPENDENCIES, BLOCKED, RETIRED and dispatch/read failure. These are proposed semantic outcomes, not new production enum values. Stable reporting retains requested owners and exact skipped reasons in RANGE, B1, D order; no skipped owner is relabeled as recovered. Receipt/result fields contain identities and status, never source records, error messages or writer capabilities.

## 11. D rejection and dependency restrictions

D eligibility additionally requires its exact current account, local authority, beforeDate cutoff, current consumed dependency set and per-block evidence. There must be a real useful dependency; absent cutoff proof or a block/dependency mismatch denies dispatch. If dependencies change between classification and consume/invoke, retire the old admission and reclassify without inventing a fresh episode. The controller must not receive arbitrary block IDs/impact or a payload query pipeline to reconstruct this proof.

Effective D rejection is a separate veto even if the owner has a transient failure observation. Existing hook latch semantics remain: matching affirmative recovery clears only the dependencies it actually proves; B1 recovery cannot clear a range-origin latch. Loading/null/partial evidence and successful D reads do not clear parent rejection. An injected typed-isolation failure test is not an established legacy production path.

A future narrow HealthView adapter may expose unsupported/unknown and exact layout attach/detach before executable D authority is proven. That registration must not call ensure/invalidate, add another read/subscription, or move D to AppContent. An executable request, if later established, performs at most one admitted unknown-impact invalidation of existing dependencies. No rejection-clear API, sibling/revision/default shortcut, network fallback or cross-account recovery is permitted.

## 12. Compatibility with future Slice C routing

| Target | Requested owner order | Current outcome | Future option A prerequisite |
| --- | --- | --- | --- |
| LOCAL_PARENT | RANGE, B1, D | No positive finite admission available; UNKNOWN/blocked owners stay skipped, no execution. | Each requested owner independently provides reviewed current admission. Partial eligibility executes only admitted owners and reports all others. D may stay explicitly unsupported. |
| LOCAL_PAIRED_READERS | RANGE, B1 | No finite user admission; do not substitute the two public wrappers. | Preserve disclosed paired UI scope but dispatch each admitted raw owner at most once. Neither request grants permission to a denied sibling. |
| LEGACY_CURRENTNESS | D only | Unsupported/unknown; independent rejection retained. | Exact D authority and dependency/cutoff episode plus private adapter; never B1/range or remote recovery. |

All three routing plans can be represented with denied/unsupported capabilities. Positive execution for each owner cannot be built from current APIs. Future B1/RANGE capability would permit their admitted subset without making D executable; all-owner positive execution requires separate proof for all three. Using a raw method is necessary to avoid fanout duplication, but not sufficient to admit it. Startup retry, bootstrap, resync/reset, daily/static/routine writes and canonical writers remain outside every LOCAL plan.

Committed account/date/owner ABA and exact attach/detach must fence classify, consume, actual invocation and result publication. No always-mounted candidate controller, polling or new listener is justified behind a disabled gate. This packet does not implement any route.

## 13. Read and listener budgets

These are source-derived operation boundaries, not measured browser performance or exact transaction totals.

| Owner or surface | Existing reads and subscriptions | Proposed future budget condition |
| --- | --- | --- |
| B1 | Per loadPair, one legacy readAll/projection, including its conditional recovery under section 3, and canonical date read with existing open/metadata fences and bounded recovery. Unmanaged enabled hook installs bootstrap/focus/visibility listeners; managed lifecycle borrows AppContent fanout. | At most one admitted raw owner dispatch per episode, not necessarily one DB read or zero writes because inherited effects/internal recovery remain. Account for them separately; no per-card pipeline or new recovery subscriber. |
| RANGE | One canonical broad readAllActive and legacy readAll with conditional account restoration per coordinator source attempt; source snapshot reused for bounds. Derivation still verifies metadata/currentness. AppContent supplies existing focus/visibility plus local bootstrap refresh. | Count canonical scans, legacy reads, restoration effects, IDB transactions, metadata checks and raw dispatch separately. No second coordinator, direct coordinator bypass or duplicate wrapped B1/RANGE retry. |
| D | One legacy readAll with conditional account restoration per actual LOCAL flushed loader batch of consumed IDs; same-block promise reuse and microtask batching. Existing useSyncExternalStore subscription, enabled mutation subscription and enabled focus/visibility/bootstrap listeners. | One admitted existing unknown-impact invalidation, with inherited effects separately counted; no additional D reader or subscription. Multiple consumed blocks do not authorize arbitrary queries or an expansion of restoration targets. |
| Currentness checks | B1 read path checks established device; RANGE captured publication.isCurrent reads device storage and may invalidate stale evidence; verifyCurrentScope performs existing metadata reads. | Record additional fence calls and their storage/metadata work explicitly. Do not label them zero cost or add separate storage/provenance probes. Missing proof must deny. |
| Legacy persistence | readAll verifies authority/import state and may invoke the validated pending-restoration chain. A restoration can delete/reinsert account recovery dataset rows and put/delete prior import state in one read-write transition, followed by readback. | Count readAll/recoverPendingImport/restorePendingIfStillCurrent calls and outcomes, read-only/read-write transactions, actual dataset deletes/inserts and import-state transitions separately. A no-op/STALE transaction is not an applied write. Preserve original preconditions, target set, concurrency guards and semantics. |
| Canonical initialization | Existing WorkoutSelectedDayReader/WorkoutRangeReader open paths can initialize namespace metadata independently of legacy import recovery. | Count existing initialization transactions/writes under matched cold/warm-open conditions. Do not assert zero total writes when the unchanged baseline initializes metadata, and do not add initialization operations or authority. |
| Explicit writers and new effects | Startup/remote recovery and Save/Delete or other explicit writer callbacks are separate from inherited read-triggered restoration. | No LOCAL remote/startup/explicit-writer callback or new restoration authority/trigger beyond the independently admitted unchanged owner read path. Existing conditional writes are not a waiver for extra adapter/controller reads, repeated restoration attempts, import-state manipulation, changed datasets or new persistence operations. |

Use the unchanged base owner path as the comparator, with matched account/import state, snapshot and prior state, canonical cold/warm initialization, request schedule and concurrency interleaving. Separate the normal gate-OFF comparison from a future separately authorized owner execution; neither comparison is a new permission to trigger recovery.

| Case | Baseline and required future oracle |
| --- | --- |
| A No pending restoration | Under matched absent/already-verified import state, no unexpected recovery dataset or import-state write. Any existing canonical initialization is counted separately against the same baseline, not hidden or falsely required to be zero. Invalid pending evidence must retain the existing failure/guard behavior, not gain a repair path. |
| B Valid pending restoration | With a valid bound pending snapshot/prior state, the original conditional recovery remains available with unchanged validation, exact-pending-state recheck, transaction behavior, account dataset targets, prior-state handling and readback. Compare actual transitions and writes, not a blanket zero-total-writes assertion. Concurrent finalization/supersession must retain the existing STALE/no-restore behavior. |
| C Observation without authorized execution | Relative to the same baseline lifecycle in A or B, capture/classification/registration alone adds no recovery-triggering legacy read/open, restoration attempt, dataset/import-state write or transaction. An extra readAll remains a violation even if a preceding recovery makes that extra call return NO_PENDING. No recovery probe is allowed to qualify the owner. |
| D Future authorized LOCAL retry encountering pending restoration | Only after actual owner permission is independently established, compare the admitted raw owner call with that same unchanged raw path/state/interleaving. Record its inherited recovery transactions, dataset deletes/inserts and import-state transitions separately from forbidden new writer/startup/reset calls or added recovery triggers. Preserve all original conditions and targets; a new controller/adapter effect cannot be relabeled inherited merely because it uses the same repository method. |

This docs-only candidate has no executable diff and no measured runtime acceptance. F1/F2/F4 must show gate-OFF zero deltas for reads, scans, transactions, metadata/initialization, existing fence calls, listeners, owner retries, explicit writer/remote calls and inherited recovery effects under matched A/B baselines. Separately account for admitted execution in D. Negative controls must detect an observation-triggered extra read/recovery, omitted recovery-write instrumentation, changed restoration guards/targets/import state, duplicate dispatch and any new explicit writer/remote call; they must not reject the legitimate B restoration merely because it writes. No such mutation tests are executed by this documentation correction.

## 14. Negative control acceptance matrix

All FA acceptance below is **NOT_EXECUTED** for the proposed capability. Existing Slice A/B regressions are supporting boundary evidence only, not executable admission acceptance. Mock-created ELIGIBLE/permit objects cannot establish a real production failure producer.

| ID | Required direct scenario and oracle | Required sensitivity control |
| --- | --- | --- |
| FA01 | Unknown plain error / OPEN_FAILED / timeout / flattened partial cause dispatches zero raw retries. | Force UNKNOWN→ELIGIBLE; fail on any call. |
| FA02 | Real selected source producer proves a typed transient episode at the actual catch; no permit in F1. Missing producer leaves verdict blocked. | Replace origin with forged code/plain error; classification must deny. |
| FA03 | Genuine isolation/allowlisted integrity failure blocks whole unsafe B1/RANGE pair and independent D rejection. | Disable deterministic veto; fail if call occurs. |
| FA04 | Same owner/episode: two simultaneous and reentrant consumers produce one reservation and one underlying dispatch. | Remove atomic state transition; two-call failure detected. |
| FA05 | Same admitted active flight: callers share the bound completion; click cannot replenish. Unrelated normal flight skips. | Return unrelated result or dispatch twice; fail on identity/count mismatch. |
| FA06 | Copied/serialized/forged handle, wrong owner or changed registry denied. | Trust shape/object equality without registry state; fail. |
| FA07 | Consumed episode remains spent through retry failure, rerender, refresh, reclick, timeout and cancellation. | Reset allowance on request/publication change or failure; fail. |
| FA08 | Account A→B→A cannot consume/invoke/publish old authority. | Compare account strings only; fail. |
| FA09 | Date X→Y→X, layout disconnect/reconnect and unmount permanently retire old authority. | Restore old token or use passive-only cleanup; fail. |
| FA10 | Owner/source replacement or changed generation/namespace invalidates held attempt; late failure/success cannot reissue. | Bind to whichever owner is current at completion; fail. |
| FA11 | Observed device A→B→A retires old episode. Unobserved ABA without authoritative evidence stays NOT_PROVEN/denied. | Treat equal final device string as continuous lifetime; fail the unsupported-admission oracle. |
| FA12 | Detach between consume and invoke causes no call and a shared retired outcome; no refund. | Omit final invocation fence; fail. |
| FA13 | Synchronous throw / async dispatch/read failure / cancelled attempt spends allowance and shares failure, without a retry chain. | Refund or mint an episode from the retry catch; fail. |
| FA14 | D missing cutoff/block/dependency proof, unsupported authority or effective rejection denies; no new arbitrary IDs. | Bypass rejection or accept sibling/revision/default proof; fail. |
| FA15 | B1 success cannot clear a range-origin D rejection; D success cannot clear parent rejection. | Clear aggregate latch after any sibling success; fail. |
| FA16 | LOCAL_PARENT / PAIRED / D-only invoke exact admitted raw set in stable order with complete skipped reasons. | Call both fanout wrappers or promote a skipped sibling; fail. |
| FA17 | Own success retires the episode; only a later independently authorized operation with newly proven cause can create another. Reload without proof remains UNKNOWN. | Mint on click, every request or mount; fail. |
| FA18 | No transport omission converted into local transient/empty proof; no invented legacy typed-isolation producer. | Inject an idealized error and label it a real producer; evidence review must reject. |
| FA19 | Apply section 13 cases A–D: gate-OFF has zero IO/listener/fence/retry/recovery deltas against the matched base; observation alone adds no recovery-triggering legacy read/write, and existing fence calls/costs remain explicitly counted. Normal no-pending state has no unexpected write; valid inherited pending restoration and canonical initialization retain their original preconditions/effects and are separately counted. Future admitted execution accounts for recovery datasets/import-state transitions and transactions without authorizing new writer/startup/reset or recovery triggers. | Detect added observation readAll/recovery, duplicate trigger, hidden recovery-write counts, changed guards/targets/import state, background subscriber/poll or explicit writer/startup call. Also detect an oracle that incorrectly forbids the valid baseline restoration solely for writing. |
| FA20 | Real hook/owner integration proves classify→consume→scheduled request→current result, with bounded internal retries accounted for. | Replace real boundary with a mock-only permit; reject positive proof claim. |

## 15. Concrete scenarios and limits

| Scenario | Required disposition and evidence status |
| --- | --- |
| Valid transient episode | HYPOTHETICAL / NOT YET PROVEN: a reviewed real source producer establishes a transient read cause and its distinct causal witness for the exact live owner, with no unsafe paired lane. Only then can a future F2 owner issue one allowance. No current production error code is supplied as a positive example. |
| Generic UNKNOWN failure | ACTUAL CONTRACT: a plain open Error or LocalDatabaseError OPEN_FAILED remains unclassified, no attempt. B18 tests this denial, not transient recovery. |
| Deterministic isolation | ACTUAL PRODUCER: canonical persisted-entity account/namespace/generation mismatch becomes typed pair isolation in WorkoutSelectedDayReader/WorkoutRangeReader. Block, do not repair identity or retry under guessed scope. |
| Two concurrent consumers | HYPOTHETICAL FUTURE POSITIVE: first consumer atomically reserves; second joins that exact attempt or reports consumed if terminal. Existing raw callbacks do not provide this. |
| Retry click during active flight | Current classification denies a new retry; future user-attempt callers can join only a real owner-exposed handle. A loading publication is not a substitute handle. |
| Failed dispatch after consumption | HYPOTHETICAL FUTURE POSITIVE: one spent reservation, shared dispatch failure, no refund/new episode. Detach before the scheduled hook starts yields NOT_STARTED_RETIRED. |
| Account A→B→A | Current committed-lifetime fencing is reusable evidence; future admission must bind all three phases so A1 cannot execute as A2. Finite consumption behavior is NOT YET PROVEN. |
| Date X→Y→X | Same requirement for distinct committed date lifetimes, not equality or a memo. Late X1 failure cannot mint X2 authority. |
| Device A→B→A | Observed transition revokes existing source proof; wholly unobserved round trip is NOT YET PROVEN by current storage equality. No finite permission may assume otherwise. |
| D rejection surviving B1 recovery | ACTUAL TRUST CONTRACT: a range-origin latch persists until matching affirmative range proof; B1 recovery alone is insufficient. A D retry cannot clear either parent's rejection. |

## 16. Product owner decision points

All selections below are **PENDING**, not inferred from publication, passing CI or the earlier Option C selection. Independent review may evaluate consistency but cannot make these human choices.

| ID | Proposed disposition for explicit human decision | Approval boundary |
| --- | --- | --- |
| FA-PD01 Authority origin | Retain D deny-only now; choose A as the only future finite-user-retry origin. Do not substitute B/C. | Does not authorize code, select a transient source or grant Slice C/public activation. |
| FA-PD02 Eligible source policy | Require a narrowly enumerated, source-proven transient read category, with inherited effects qualified under sections 3/13; current positive allowlist is empty for all owners. If F1 cannot demonstrate a category, remain blocked rather than reclassify plain/open/transport errors. | Any later positive category and whole-pair safety proof require reviewed disposition before F2 execution authority. No new writer/restoration authority or approval of this PENDING decision is implied by accounting for existing effects. |
| FA-PD03 Consumption and failure policy | Synchronous owner reservation; shared result; no refund on dispatch failure, cancellation or retirement; no retry-derived new episode; unrelated active read skips. | Preserves the inherited one-additional-user-attempt ceiling; no numeric escalation or automatic fallback loop. |
| FA-PD04 Lifetime and unsupported routes | Exact in-memory owner/committed scope, no reload replenishment and no cross-tab global-permit claim. Device-sensitive paths lacking sufficient lifetime evidence and D without independent proof remain denied. | No persistent ledger, device/provenance expansion or new listener/probe is approved. Supporting a stronger continuity guarantee would require separate characterization. |

## 17. Minimal implementation sequence and restart gates

| Step | Scope | Exact prerequisite and exit evidence |
| --- | --- | --- |
| F0 Finite admission contract decision | This docs-only packet, independent contract review, explicit product dispositions. | Exact-base source references and options verified; no claim of contract approval until independent review and explicit human disposition. No runtime implementation authority is granted by this PR. |
| F1 Owner typed failure and episode proof | A separately authorized bounded source/owner change retaining non-payload cause and stable, current failure episode; no permit or retry execution. Scope B1/RANGE/D independently, starting only where a real producer can be proved. | F0 decisions and separate task authorization. Real boundary evidence plus scope/ABA/unknown/deterministic controls. Preserve flattened RANGE causes only where needed; do not manufacture a typed cause. If none exists or device/D proof is insufficient, STOP with the owner still blocked. |
| F2 Owner one shot permission | A separate implementation of private atomic consumption/reservation, actual-request binding and shared completion for only F1-proven owners; no parent controller or D bridge. | F1 evidence independently reviewed and accepted, source category policy approved, separate implementation authorization. Real producer→owner→one-shot→completion tests; no mock-only positive proof. Unsupported owners stay unsupported. |
| F3 Independent focused owner admission review | Review exact-head F2 runtime proof, failure/ABA/atomicity/cost controls and limits. | Positive eligible and consumption claims may change from NOT_PROVEN only for actually established owners. Review failure returns to bounded correction; no self-declared pass or source substitution. |
| F4 Resume Slice C | Separately authorize bounded controller and private D bridge using reviewed owner capabilities; no public button/shell. | F0–F3 closed for every owner allowed to execute; exact supported/unsupported set recorded, #773 routing retained, C01–C30 mapped. An unsupported D may register denial only, not execute. Reconfirm baseline/main CI and all freezes. |
| F5 Slice C independent integration review | Real owner routing, shared results, deterministic skips, lifecycle races and gate-OFF IO/remote/writer isolation. | Exact-head CI and real-boundary evidence; negative controls sensitive. No public activation or Slice D–G authority follows from this review. |

Do not combine F1, F2 and F4 into one implementation. An empty positive source set is a valid F1 blocked result, not permission to use a controller budget. Passing shape/unit tests of a synthetic permit does not satisfy F1, F2, F3 or Slice C restart.

F1/F2 must also establish the exact legacy read path, inherited write effects, actual owner permission boundary and original restoration preconditions, with the section 13 negative controls. No observation-triggered recovery, retry-based import-state manipulation, changed restoration targets/transactions or new persistence authority is permitted. Preserve legacy account/snapshot isolation and the separate canonical namespace/generation fences; the account-scoped legacy repository is not canonical scope proof, and D cannot borrow that proof. If any required safety/isolation/effect boundary cannot be established under the freeze, OWNER_FINITE_ADMISSION = DENIED and STOP for a separate reviewed disposition. Do not implement a workaround or broaden recovery to make admission possible.

Remaining unsupported capabilities: real finite transient classification; causal episode continuity/retirement for user admission; atomic consumption; bound shared attempt completion; full device ABA evidence for positive admission; executable private D bridge; and real legacy typed-isolation production provenance. Slice C remains blocked until the necessary owner subset is actually established and a new Slice C request authorizes implementation.

## 18. Security freeze and documentation validation

    ALL_FIVE_READER_GATES = false
    WRITER_AUTHORITY_CHANGED = NO
    WRITER_SEMANTICS_CHANGED = NO
    PROVENANCE_CAPABILITY = NONE
    LIVE_WRITER_BLOCKERS = 7 OPEN
    PUBLIC_ACTIVATION = NOT_AUTHORIZED
    B18_REAL_FINITE_ELIGIBILITY = NOT_PROVEN
    B20_REAL_PERMIT_CONSUMPTION = NOT_PROVEN

The five unchanged gates are HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED, HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED, HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED, HOME_WORKOUT_COMPOSITE_READER_ENABLED and SEARCH_WORKOUT_COMPOSITE_READER_ENABLED. DB v7, schema v1, stores, indexes, keyPaths, backend and WorkoutSessionV1 remain unchanged. No startup reuse, G6, writer adoption, identity creation, payload-bearing failure disposition or retry-driven episode refresh is authorized.

Documentation validation requires one new Markdown file only; every relative source/document target and named symbol checked at the exact base; option/feasibility/decision consistency; unchanged approved contracts, gates and runtime tree; and git diff --check. The repository frontend package and CI workflow expose no dedicated Markdown lint/link script, so validate this packet's relative targets and section coverage directly without adding config or dependencies. Normal Push and PR CI remain applicable, including all five required jobs.

No executable finite-admission tests are claimed by this publication. Existing regression results and hosted frontend/backend CI do not prove the proposed authority. Preserve the known Windows K-333B CRLF fixture-anchor baseline classification if a local full suite is run; do not edit its tests or claim a local full-suite PASS on failure. Exact-head CI links and publication SHA belong in the Draft PR/report; this base-specific contract does not predict its own commit SHA.

Next step: independent focused contract rereview of PR778-R01 on the corrected exact head. The original CHANGES_REQUIRED finding remains open until that review closes it; product decisions still require explicit human disposition before a separately authorized F1. Do not mark Ready, merge, enable auto-merge, implement F1/F2 or Slice C, or treat this decision packet as APPROVED.
