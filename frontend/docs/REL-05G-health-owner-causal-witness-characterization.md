# REL-05G Health owner producer and causal-witness characterization

Task: `REL_05G_HEALTH_OWNER_PRODUCER_CAUSAL_WITNESS_CHARACTERIZATION_01`.

Status: `CAUSAL_WITNESS_CONTRACT_CHARACTERIZED_REVIEW_PENDING`. This is one docs-only prerequisite packet, not F1 implementation, independent approval, transient-category selection, or executable retry authority. All W01-W16 requirements below are future acceptance definitions, `REQUIRED / NOT_EXECUTED`.

## 1. Exact baseline and governing authority

Repository: `Absinthe-6785/Absinthe`. Canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`; `D:\Projects\Absinthe` is excluded.

- Verified remote main: `1765a0fbf35eb3c1ac17b7dbe08b13367b35308f`.
- [PR #778](https://github.com/Absinthe-6785/Absinthe/pull/778): MERGED/CLOSED, reviewed head `f7e2c480bacaecdd0cbf8bc0f604558e9d4c2c57`, merge commit equal to this baseline, merged at `2026-10-16T06:55:54Z`.
- [Main CI #38864041655](https://github.com/Absinthe-6785/Absinthe/actions/runs/38864041655): exact baseline, Push, completed SUCCESS; test, typecheck, build, backend-rel05g1 and backend-recovery all SUCCESS. This is prerequisite evidence, not this new document head's CI.
- Starting tracked/index state clean. Local prior head was the reviewed #778 head with the same tree as main; the new topic branch starts at the exact merge commit. The existing unreadable `backend/.pytest_cache` warning is not a source change.
- No open PR existed at reconnaissance; a repository PR lookup for `codex/rel05g-health-owner-typed-failure-episode-f1` returned none. No F1 implementation, commit or PR was produced by the preceding blocked task.

The complete [F0 finite-admission contract](REL-05G-health-owner-finite-admission-contract.md) was reread. Its publication-time review-pending labels are historical after #778 closure, not grounds to reopen F0. Its substantive limits remain authoritative. Governing contracts and current implementation boundaries inspected:

| Contract | Relevant constraint |
| --- | --- |
| [#772 product decision](REL-05G-health-parent-partial-source-availability-product-decision.md), sections 5, 15 and 19 | Option C is selected policy; whole unsafe pairs remain fenced; a click/reload is not a new transient episode; LOCAL recovery excludes remote/bootstrap and writers. |
| [#773 integration design](REL-05G-health-parent-partial-source-availability-integration-design.md), sections 16-19, 21 and 25-30 | Raw RANGE then B1 then independently admitted D; no duplicate wrappers; typed cause, finite admission, committed lifetimes and bounded read ownership are separate proof obligations. |
| [#774 date ABA contract](REL-05G-health-workout-operation-date-aba-correction-scope-design.md), sections 4-6 and 12 | Commit-issued opaque date lifetime, exact layout cleanup and render-bound capture; equal date/account strings cannot restore retired authority. |
| #775 [operation scope](../src/components/views/features/health/healthWorkoutOperationScope.ts) and [layout owner](../src/components/views/features/health/useHealthWorkoutOperationLifetime.ts) | Actual issued UI operation authority; it supplies scope fencing, not source-cause identity or a retry permission. |
| #776 [Slice A model](../src/components/views/features/health/healthWorkoutParentAvailability.ts), `RetryDisposition` / `retryEligibility` | Pure abstract prerequisite model; its TRANSIENT input does not produce a witness, issue a permit or execute a callback. |
| #777 [Slice B adapters](../src/components/views/features/health/healthWorkoutOwnerAdapters.ts), `observeOwnerFailure` / `retry` | Genuine non-payload classifications, current owner publication and UNKNOWN denial. `currentEpisode` currently borrows a request tag for IN_FLIGHT, not a causal episode. Closed R01/R02 findings are not reopened. |

This task preserves `F0 = CLOSED_IN_MAIN`, `F1 = BLOCKED_BY_MISSING_PRODUCER_OR_LIFETIME_PROOF`, `F2 = NOT_STARTED`, and `SLICE_C = BLOCKED_BY_CONTRACT_GAP`.

## 2. Source-derived failure reproduction

The following observations were rechecked in production code at the baseline, not accepted solely from the prior F1 report. No real user data or physical browser was accessed.

### B1: paired selected-day owner

[useHealthSelectedDayComposite](../src/components/views/features/health/useHealthSelectedDayComposite.ts): canonical catch at lines 214-218, legacy catch at 227-228, pairing at 232-235, scope-verification catch at 250-259, device recovery at 263-272, and pair-projection catch at 306-314.

1. [selectedDayLegacySnapshot](../src/components/views/features/health/selectedDayLegacySnapshot.ts) calls the account repository's `readAll()` once at line 60. Its persisted-row account check can actually throw `CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH')`; malformed row/projection errors are plain Errors. These are not an established transient producer.
2. [WorkoutSelectedDayReader](../src/lib/workoutSelectedDayReader.ts) opens/initializes canonical metadata, verifies generation, and reads the selected date. Persisted account/namespace/generation/untrusted-scope evidence becomes typed isolation at lines 90-100; independent envelope checks also reject mismatches. Invalid trusted-scope content remains ordinary failure.
3. `OwnerFailureDisposition` is only `{ kind: ISOLATION | DETERMINISTIC | UNCLASSIFIED, reasonCode }`. The B1 paired `failures[]` retains classifications but no explicit legacy/canonical origin. Its conditional compacting means array position alone cannot identify the failing lane. A later metadata failure can append another canonical observation. Pair projection can fail after both reads; its catch does not prove which lane caused the projection failure.
4. Typed isolation withholds the entire pair, including `legacyDaily`. Existing adapter deterministic classification vetoes retry of the unsafe paired owner; adding attribution must not permit lane-only retry. Ordinary partial source qualification is distinct from retry safety.
5. Raw `retry()` increments request sequence, revokes publication and schedules refresh (83-89). Each load effect allocates a new request object (134-135), explicitly not a user-failure episode. Loading/settled publications are fresh objects. A code/comment calling a bounded internal load a whole-pair "episode" does not establish causal identity.
6. There is one internal STALE_GENERATION reopen in `readCanonical`, and separately one whole-pair currentness recovery per load effect. Exhaustion can settle unavailable with no retained failure. A changed/malformed device triggers that existing recovery; it does not prove transient cause or repair. Device checks occur in the read path, not a continuously observed device lifetime.

### RANGE: shared source snapshot and derived views

[WorkoutReadSnapshotCoordinator](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts): producer calls at 234-242; `Promise.allSettled` at 244; typed-isolation rethrow at 246-249; scope verification and stale retry at 251-254; source-error flattening at 263-266; snapshot at 269.

1. Legacy `readAll()` plus verified row projection and canonical [WorkoutRangeReader.readAllActive](../src/lib/workoutRangeReader.ts) run as one paired source attempt. The latter's canonical scan and persisted-identity isolation are real producers; legacy range projection also has real account-mismatch isolation checks. Generic open/scan/projection errors are not positive transient evidence.
2. `[legacy, canonical]` settled-result ordering is fixed by the supplied promise array, not completion order. Typed isolation is rethrown in that order before ordinary partial projection. Other rejected reasons become `{ status: 'error' }`, and `WorkoutReadSourceSnapshot` contains only account, nullable scope and result. Per-source causes do not survive that snapshot.
3. Scope verification can throw before projection. `verifyCurrentScope()` later catches and returns false, invalidating the snapshot (312-328). A false/null result has no retained reason and is not a source-proven transient category.
4. [useHealthWorkoutRangeSnapshot](../src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts) retains safe failure classification only when load/derive actually throws (289-301, 378-392). A successfully returned partial/error snapshot can therefore have source failures but an empty hook failure list. Successful view binding requires the exact live coordinator snapshot/publication (347-365), not merely completed derivation.
5. `load()` invalidates its predecessor; the sequence, snapshot object, captured publication and per-load/per-derive request objects identify source work/publication, not a persistent cause. `retry` is `invalidateAndReload`; it resets the existing internal currentness flag and schedules the existing pipeline. The coordinator has at most two stale-generation source attempts; the hook separately has one automatic currentness reload. Neither is a finite user allowance.
6. Captured publication `isCurrent()` observes device storage and irrevocably invalidates on an observed change (173-197). It cannot prove an entirely unobserved A-B-A device round trip. Derivation and scope verification retain their existing metadata/fence work; this is not permission to add a second pipeline or identity probe.

### D: independent legacy block/cutoff currentness

[useLegacyPreviousCurrentness](../src/components/views/features/health/useLegacyPreviousCurrentness.ts), lines 44-46, supplies the actual loader: [fetchPrevWorkoutForBlocks](../src/components/views/features/health/prevWorkoutFetch.ts).

| Route/state | Actual evidence and limit |
| --- | --- |
| LOCAL with account | Helper lines 52-53 call [readLocalPreviousWorkout](../src/lib/healthLocalRuntime.ts), lines 256-269, then account `readAll()`. A rejection reaches D `flush()` at [legacyPreviousCurrentness](../src/components/views/features/health/legacyPreviousCurrentness.ts) 161-162 and becomes non-payload failure plus UNAVAILABLE for qualifying batch members. |
| Qualified LOCAL omission | A successfully verified local query with no row for an exact consumed block and `beforeDate` can produce NO_MATCH. It is not failure, whole-source empty, canonical history proof, or a causal witness. |
| Remote helper | Non-OK HTTP at line 33 and transport/JSON rejection at 35-36 return `undefined`; the aggregate omits that block. This loses failure/absence distinction before D. It cannot qualify LOCAL causal or absence proof. Do not fix/reinterpret this remote route in the proposed evidence-only slice. |
| Missing account / unsupported scope | The helper can return `{}` without a local read, but the actual D `ensure` first denies absent/rejected/unsupported configured scope. A helper's empty return is not authority to bypass that owner guard. |
| Effective rejection | Parent trust is separately latched in the hook (22-40, 55-61). A range-origin rejection needs matching affirmative range recovery; B1 success alone and D-only success cannot clear it. |
| Dependency/cutoff mismatch | Exact configured scope, consumed block set, current entries, mutation barriers and cutoff govern qualification. A changed query/dependency is not a repaired source or new cause. |
| Typed isolation | D reacts fail-closed to `CompositeWorkoutReadIsolationError` at flush 163-166, but its actual LOCAL repository/runtime path does not establish that typed producer. Tests injecting it demonstrate reaction only. B1/RANGE legacy projections are different producers and cannot be borrowed. |

D batches consumed IDs, reuses same-block flights and qualified/UNAVAILABLE evidence, and revokes affected entries on invalidation. Failed flush has no automatic retry loop. Existing mutation-end/focus/visibility/bootstrap invalidations are unchanged, not cause-resolution notifications. `captureOwnerEvidence.request` is its aggregate publication only while flights exist. `close/configure` replaces lifetime; no causal lineage survives by value equality.

**`D_CAUSAL_WITNESS = UNSUPPORTED`.** Ordinary LOCAL failure remains UNKNOWN/denied; effective rejection remains a separate veto. No executable D bridge or synthetic positive episode follows.

### Shared low-level producers are not interchangeable

[Canonical openLocalDatabase](../src/lib/localDatabase/repository.ts), lines 4492-4532, actually produces OPEN_FAILED when no factory is available and OPEN_BLOCKED from its open request's blocked handler. Request errors are passed through `localDatabaseError`: an existing typed error survives, VersionError maps to UNSUPPORTED_SCHEMA_VERSION, and otherwise the wrapper yields TRANSACTION_FAILED. These facts identify a failed operation/category, not the blocking resource/cause lifetime, cause resolution or a distinct later cause. Even a real blocked handler is not a transient-episode issuer.

The separate [legacy database opener](../src/lib/healthLocalRepository.ts), lines 208-229, returns native request errors or plain Errors for open/block failure. Its authority/import/content checks also throw plain Errors. Do not parse those messages into canonical typed categories or claim that matching words identify one producer/cause. [readEstablishedWorkoutDeviceId](../src/lib/workoutLocalReaderAuthority.ts), lines 16-22, throws a plain Error for an existing malformed ID; that failure remains unclassified at the owner catch. With an absent ID it delegates to the existing read-or-create path: this conditional source-open effect must be counted against the matched baseline, not used as witness identity. Malformed existing bytes are not repaired. Neither witness observation nor this docs task adds identity allocation/repair authority or a new invocation of that path.

## 3. Four identities, not one token

| Identity | Fact it can prove | B1 / RANGE / D now | It cannot prove |
| --- | --- | --- | --- |
| A Operation/request identity | Which already-started operation a result belongs to | B1 fresh request plus sequence/epoch; RANGE fresh load/derive request plus source/sequence; D exact per-block flight and aggregate in-flight publication tag | Same underlying cause, new cause, cause resolved, or another allowed read |
| B Source publication identity | Which qualified loading/settled snapshot is currently exposed | B1 connection/publication; RANGE connection plus exact coordinator snapshot/publication; D exact configured lifetime/publication/entry | Persistent cause continuity through invalidation or retry |
| C Failure observation identity | One actual failure occurrence at a particular producer/catch under an originally current operation | Existing dispositions record limited occurrence information, but no dedicated stable per-observation handle. B1 loses lane; RANGE loses ordinary source reason; D has batch/entry failure dispositions. | That two occurrences share a cause, or that another occurrence is a distinct new episode |
| D Causal failure episode identity | Producer-proven relationship of observations to the same unresolved cause, under an exact owner/scope authority | Absent for all three owners. Slice B's `currentEpisode` name does not change this. | Execution permission: even a genuine episode is not F2's one-shot authority |

A future observation object issued at a current catch could label occurrence C, but its UUID/object identity would prove only that occurrence. Matching codes/messages, error object identity, timestamps, request counters or snapshot identity cannot upgrade C to D. [LocalDatabaseError](../src/lib/localDatabase/errors.ts) supplies code/operation/optional persisted-entity failure, not a causal relation. `observeOwnerFailure` intentionally excludes operation/message/raw error objects from the disposition.

The [legacy runtime](../src/lib/healthLocalRuntime.ts), lines 22-29, caches `sharedDriverPromise` without a rejection-reset path here. Re-observing that failed open promise is still operation evidence, not proof that its external cause persists/resolved or that a new allowance exists. This packet does not alter that cache.

## 4. Minimum producer-witness fact slots

This is a proposed proof model, **not a runnable interface, record schema, serialized token or capability implementation**. Fields below are semantic obligations. A caller constructing a matching object proves nothing. Internal scope references must not expose account IDs, records, device values, payload hashes, messages, exception objects or writer capabilities to consumers. "Producer origin" here means a traceable existing code boundary, not a new device/provenance issuer capability.

| Proposed fact slot | Authorized issuer / underlying fact | Independent verification obligation | Existing supply and unknown remainder |
| --- | --- | --- | --- |
| `producerRef` | The actual source boundary, authenticated by owner-controlled origin, not a caller-supplied string; identifies legacy/canonical/owner-stage producer | Trace real production producer -> catch -> owner; forged source, copied object or injected-only error must fail origin checks | Code locations are traceable; no causal producer capability is exposed. D's real legacy typed-isolation origin is unestablished. |
| `failureCategory` | Actual producer error, sanitized through the unchanged narrow classifier | Real boundary produces the category; plain Error stays UNKNOWN and OPEN_FAILED/OPEN_BLOCKED remain unclassified; no message parsing | Existing deterministic/isolation/unclassified codes only. No approved positive transient category. |
| `originalOperationRef` | Existing authoritative owner when its read starts; links settlement to its captured operation, including existing internal attempt role | Deferred completion passes the original request/epoch/currentness fences; never stamp with the newest token in catch | Existing A identities help. They do not establish normal-operation independence or causal continuity. |
| `observationRef` | The current producer/owner settlement boundary for one actual failure occurrence | Tie the occurrence to producer and original operation; stable repeated observation does not reissue it | A dedicated handle is absent and not necessary for mere attribution. A future catch-created occurrence handle is C only. |
| `sourceScopeRef` | Existing reader/source authority, referring privately to its established device/namespace/generation, or exact legacy account/query scope | Reuse actual captured source scope and existing fences; no sentinel/open-failed scope or sibling canonical scope accepted | Canonical reader scope and legacy account context exist, with different guarantees. Missing/open-failed scope and unobserved device ABA remain unsupported. |
| `ownerScopeRef` | Exact committed owner plus parent account-generation/date/route/shell lifetime where applicable | Layout retirement, account/date ABA, detach/replacement and cross-owner negatives; bind original committed scope, not equal values | #775/#777 supply relevant operation/publication fences, not causal linkage. D has no independent canonical lifetime to lend. |
| `causeRef` | Only a real producer capability that actually distinguishes its underlying cause; a downstream catch cannot mint it as a substitute | Demonstrate why observations correspond to the same source-owned cause; trace a real producer fact, not code/time/promise equality | **No suitable capability identified at this base.** A cause reference generated after catch would not satisfy this slot. |
| `continuityEvidence` | That producer's verifiable relation between original and subsequent observations, within still-valid source/owner authority | Prove SAME separately from UNKNOWN under retries and internal recovery, without extra identity reads | Absent; new request/publication and same error code prove neither relation. |
| `newCauseEvidence` | Producer evidence distinguishing a genuinely later cause following verified recovery or separately authorized correction, and an independently authorized normal operation | Reject retry descendants, clicks, reloads and lifecycle churn as new-cause issuers; require actual distinct source fact | Absent. A success counter, timestamp or fresh owner token is insufficient. No external correction capability is selected here. |
| `recoveryEvidence` | The exact owner/source's existing affirmative qualified result, bound to the failed scope and current operation | B1 whole pair complete; RANGE complete qualified Previous/month from exact source; D every consumed dependency CURRENT/NO_MATCH, nonempty/unrejected. Verify root-cause resolution separately if claimed | Operational RECOVERED can be observed now; that is not general proof that an underlying external cause disappeared or that a later cause is distinct. |
| `supersessionEvidence` | Actual current owner/source replacing or invalidating incompatible authority | Original token remains retired through same-value return; late settlement cannot borrow replacement | Existing invalidation/replacement fences help retire authority. They do not establish resolution or a fresh episode. |
| `retirementEvidence` | Committed owner/parent cleanup or existing authoritative scope/device/generation rejection, with a bounded reason | Old handle permanently unusable; distinguish authority retirement from cause resolution; no new probe/listener | Partial existing retirement evidence. Entirely unobserved device round trips and reload continuity remain unproved. |

Minimum conceptual relationship: an originally current producer observation is linked to an exact owner/source scope; only verified producer `causeRef` plus continuity facts could support a causal episode. Without either, expose UNCLASSIFIED_FENCED/unsupported evidence with **no causal episode**. A future F1-P1 record can carry attribution and bounded classifications while all causal slots remain unavailable. It must not create fake nonnull defaults.

## 5. Continuity outcomes and decision rules

| Outcome | Required evidence | Consequence, never permission |
| --- | --- | --- |
| `SAME_CAUSAL_EPISODE` | Same source-origin cause proven by the producer's continuity relation, exact valid owner/source scope and original-operation lineage | Keep the same episode if one was validly established; no replenishment from a new observation/request. None is established now. |
| `DISTINCT_NEW_EPISODE` | A current independently authorized normal operation, verified own recovery or separately authorized completed correction, **and** independently verified distinct-new-cause evidence under an allowed scope | At most supports later episode evidence after separate implementation/review. Recovery alone, new owner or new request is insufficient. A retry chain cannot establish this outcome to replenish allowance. |
| `EPISODE_RETIRED` | Authoritative retirement of the old owner/parent/source scope or a qualified terminal/rejection event under the original binding | Old authority never executes/revives. Underlying cause may remain unresolved; replacement begins without inherited positive permission. |
| `CONTINUITY_UNKNOWN` | Any missing producer relation, unresolved scope, flattened cause, unsupported route, conflicting or unqualified observation | UNKNOWN/denied. Must not be relabeled distinct-new, same-cause certainty or transient. |

Both SAME and DISTINCT require positive proof; failure to prove SAME is not proof of DISTINCT. Existing request/publication turnover can establish supersession but cannot choose between underlying causal relations.

## 6. Transition and retirement contract

`RETIREMENT_OF_AUTHORITY` and `PROOF_THAT_THE_UNDERLYING_CAUSE_RESOLVED` are separate dimensions. Incompatible old authority can be retired even while cause continuity remains UNKNOWN. No event below grants an execution allowance.

| Transition | Required future handling | Current evidence / cause-resolution limit |
| --- | --- | --- |
| Initial source failure | Retain genuine origin/category at its current catch. Without the section 4 causal slots, publish UNKNOWN/unsupported, not an episode | Codes and occurrence are insufficient to select a new episode. |
| Harmless rerender / repeated observation | Preserve already-bound observation/episode identity; pure observation adds no IO or issuance | Current publication binding is reusable evidence, not proof that a causal episode exists. |
| Repeated user click | No producer fact changed; cannot issue/refresh an episode | Current raw callbacks may schedule work; their existence must not be advertised as finite authority. |
| Source read retry | A new operation/publication, not automatically a new cause. SAME needs producer relation; otherwise UNKNOWN; never replenish | No current API supplies that relation. Any future F2-bound retry remains a descendant of the spent episode, not a fresh normal operation. |
| Automatic currentness retry | Preserve existing internal bounds and stale-result rejection; no user allowance/episode from the retry | STALE_GENERATION, device reopen or null-currentness recovery is not transient/cause-resolution proof. |
| Partial recovery | Qualify only the successful source. Do not retire a sibling's failure or claim whole-owner recovery | Lane success cannot remove pair-level deterministic veto or clear D trust. Even recovered-lane operational evidence does not identify root cause. |
| Complete recovery | Accept only exact affirmative whole-owner proof; retire an established owner episode as operationally recovered | Does not alone establish global/external cause resolution, a distinct new cause, or eligibility. A subsequent failure still needs section 5 DISTINCT proof. |
| Source replacement / incompatible supersession | Retire old authority and bind no old result to the new source | New source/snapshot is not proof the old source healed; fresh identity is not new-cause evidence. |
| Account change / A1-B-A2 | Retire old authority using committed account-generation/owner linkage; A2 cannot restore A1 by string equality | Old cause may persist. New owner with no producer witness remains UNKNOWN. |
| Date change / X1-Y-X2 | Retire date-bound authority using committed opaque lifetime; return to X2 cannot reuse X1 | No new episode from date navigation. RANGE source can survive bounds rederivation, but old parent/date-bound authority may not. |
| Observed device/generation replacement | Existing authoritative currentness rejection retires affected proof; no identity repair | RANGE observes device change through its existing fence; B1 checks on reads. No entirely unobserved A-B-A guarantee. D cannot borrow these facts. |
| Layout detach / owner replacement / unmount | Exact cleanup permanently retires bound authority, including layout reconnection/replacement | Scope retirement is not source recovery. Render/speculation must not mint or renew authority. |
| Late completion / unqualified late settlement | Check original operation and original owner/parent/source bindings; reject stale evidence without upgrading it to the current owner | No error/success at a retired boundary can create a new current episode. |
| Deterministic rejection | Preserve whole unsafe pair denial and effective D rejection; retire incompatible positive authority if any existed | Blocked does not mean healed. UNKNOWN is not promoted because the deterministic code disappeared. |
| Application reload | In-memory authority is gone; without retained authoritative producer continuity, start UNKNOWN | No persisted ledger, new reload detector, cross-tab/global continuity claim or reload-driven replenishment is authorized. |
| Same-value ABA | Observed committed transitions create incompatible lifetimes; no old token revival. Unobserved transitions stay unsupported | Equality is not continuity. No storage scan/poll/listener may be added to fill the missing proof here. |

F0's future reservation lifecycle remains unchanged: a validly bound child retry may revoke its failed read publication without erasing the episode's spent lineage; independent owner/scope replacement still retires it. This packet implements neither that registry nor child binding. Keeping a failed publication artificially current, or requiring a future child to use whichever publication is newest, would both be incorrect substitutes.

## 7. Safe evidence-only B1 sub-slice

**Source attribution alone is independently useful and conditionally safe; it does not complete F1.** A separately authorized F1-P1 can preserve the catch's known origin without changing reads, retries, pair qualification or currentness.

Proposed bounded observation shape, descriptive only:

- `source`: LEGACY, CANONICAL, or PAIR_OWNER when a combined projection cannot establish a lane;
- `boundary`: a closed, source-reviewed stage label such as READ, SCOPE_VERIFICATION or PAIR_PROJECTION, not exception operation/message text;
- `disposition`: the unchanged safe `OwnerFailureDisposition`, retaining only its known kind/code;
- association with the existing exact owner publication/original request, **not** an episode or permit.

At legacy catch, source is LEGACY; canonical read/open catch and metadata verification are CANONICAL. Pair-projection catch is PAIR_OWNER unless the actual producer independently proves a narrower origin. Never guess from a single error in the compacted array. Silent date-row qualification downgrade and exhausted currentness recovery lack a retained cause: describe evidence as unavailable/UNKNOWN, not a fabricated thrown error, transient category or witness.

Retain current isolation veto, deterministic owner denial, successful partial source records and unavailable-not-empty semantics exactly. Do not expose `legacyDaily`/records through diagnostics, infer correction from canonical success, change the raw B1 wrapper, or add a lane-only retry. Canonical scope may be null after failed open; do not manufacture namespace/generation/device proof from the legacy account. Future observation uses only already captured state; no new read or device check to obtain attribution.

Likely later files: B1 hook, existing adapter types/classifier consumption, and narrow owner tests; selected-day legacy/canonical readers require no behavior change for attribution at their known catches. Any actual producer enrichment beyond attribution needs a new reviewed scope. All inherited legacy restoration and canonical initialization effects in section 10 remain unchanged.

## 8. Safe evidence-only RANGE sub-slice

**Cause retention is independently implementable without causal episode issuance**, subject to a separately approved F1-P1 and exact tests. The minimum proposal is additive internal per-source diagnostic metadata alongside the existing `WorkoutReadSourceSnapshot` account/scope/result, propagated through the same current snapshot/hook publication. It is not a new public data/provenance API or a second read pipeline.

At `allSettled`, preserve at most one sanitized rejection disposition for each source attempt in stable LEGACY then CANONICAL order, using the section 7 source/boundary/disposition vocabulary. Derive it from actual settled reasons, not projection statuses. Keep `SourceRead` statuses, record ordering, `projectCompositeWorkoutRead`, typed-isolation rethrow order, canonical scope qualification and currentness fences unchanged. Do not persist raw rejection reasons or revive discarded attempt metadata.

The unchanged source snapshot can then carry ordinary partial/error evidence to the hook, which currently sees only the result. Derived Previous/month/preview views borrow that same snapshot evidence; they must not each create another observation, read or scan. A rederivation is a new view operation, not a new failure occurrence or cause.

Terminal load/derive/scope exceptions still follow their existing throw/null/recovery paths; diagnostics must not salvage a failed candidate into a published snapshot, alter retry precedence or suppress paired isolation. Hook-level failure attribution is limited to facts known at that actual boundary; do not claim which lane caused an unattributed terminal projection error. When currentness returns false/null without retained cause, evidence remains unavailable/UNKNOWN. Diagnostics cannot turn that null into successful empty, RECOVERED or a positive episode.

Likely later files: `verifiedWorkoutRangeSnapshot.ts`, range hook, adapter types/consumption, and their focused tests. Reuse one unchanged safe classification implementation; if a small pure helper extraction is needed to avoid layering/cycle issues, require compatibility tests and no duplicated/widened allowlist. `workoutRangeReader.ts`, repositories, transport and schema need no change for preservation of already-thrown reasons. No direct `coordinator.retry()` admission bypass, extra coordinator, metadata probe or automatic retry budget change.

## 9. D feasibility and safe denial

D has real LOCAL operation/failure evidence, but **no real producer witness suitable for causal F1 was identified**. `UNAVAILABLE` records that the loader did not provide qualifying evidence; it does not identify the underlying cause. NO_MATCH is only the qualified local block/cutoff query outcome. The current remote omission must not be retroactively classified as a local failure, local absence or causal episode.

Narrow LOCAL loader-route attribution could improve diagnostics under separate authorization; it would remain generic UNKNOWN and must retain exact account/cutoff/dependency/mutation/rejection fences. Do not add a legacy typed-isolation code merely because D's test fixture can inject it. Source files that would need an actual later producer contract are `healthLocalRepository.ts` / `healthLocalRuntime.ts` plus the D loader/flush boundary, but those persistence/projection behavior changes are **not** an authorized next implementation in this packet. A concrete source capability and effects-safe scope must first be demonstrated.

No D canonical scope, sibling witness, parent identity string or comparison/range revision substitutes for its independent query proof. Unsupported D remains a valid denied outcome; positive eligibility for every owner is not a requirement of this plan.

## 10. Inherited persistence effects and future oracle

Rechecked chain in [healthLocalRepository](../src/lib/healthLocalRepository.ts): `HealthRepository.readAll` (1060-1062) -> `readAuthoritativeDatasets` (612-629) -> `recoverPendingImport` (563-609) -> conditional `restorePendingIfStillCurrent` (700-751).

- Absent state or VERIFIED_IMPORT_COMPLETE returns NO_PENDING without restoration. An absent/unverified state still makes authoritative read fail; it is not successful empty.
- Valid pending recovery checks account/snapshot binding, hash, datasets, prior state and counts. The read-write transition rechecks exact account/snapshot pending state inside the transaction. Supersession returns STALE without applying restoration; transaction creation alone is not an applied write.
- Applied recovery deletes only that account's rows in the existing [HEALTH_RECOVERY_DATASETS](../src/lib/healthRecoveryExport.ts) set and reinserts the bound prior snapshot. It puts valid prior import state or deletes it when null, then verifies readback. A restored null prior state can still leave `readAll()` unverified/rejected.
- The ten targets are exercise_blocks, workout_logs, inbody_logs, health_routines, routines, routine_logs, protein_profiles, protein_sources, protein_intake_logs and workout_memos. No target, schema, hash rule, isolation check or transition changes here.
- Both canonical reader open paths separately call `initializeNamespace`, read metadata and validate active generation. Existing initialization may write canonical metadata; it is not legacy pending restoration or evidence of explicit Save/Delete.

B1 reaches legacy readAll per paired load, RANGE per source attempt, and D only for an actually executed admitted LOCAL loader batch. Reused entries/flights, denied D scope, remote helper and LOCAL-without-account helper do not justify counting an additional LOCAL read. [Health recovery tests](../src/lib/healthRecoveryImport.test.ts), including pending reopen at 564, runtime read gating at 609, authoritative snapshot at 625 and stale recovery at 683, are existing test seams, not causal-witness acceptance.

Future tests compare unchanged baseline and separately authorized evidence-only candidate with identical state, account, source schedule and concurrency interleaving. Instrument **all** of these independently:

| Counter / effect | Required oracle |
| --- | --- |
| Normal owner dispatch / source reads | Raw hook dispatch, coordinator attempts, readAll, canonical date query/domain scan, derive and D loader batch counted separately. Preserve existing internal recovery multiplicities, not an invented one-total-read guarantee. |
| Pending recovery | Count recover/restore calls, NO_PENDING/STALE/RESTORED/APPLIED outcomes, read-only/read-write transactions, actual account dataset deletes/inserts and import-state put/delete independently. No hidden write behind a zero explicit-writer count. |
| Explicit writer/remote callbacks | Save/Delete, other domain writers, startup/bootstrap retry, transport, reset and data-plane calls separately observed; evidence-only change adds none. |
| Canonical initialization / fence costs | Match cold/warm opens, absent/present/malformed established-ID state and its existing conditional creation, initializeNamespace, metadata transactions and existing storage-currentness accessors. Count existing fence work and identity/metadata writes separately; no new probe or extra accessor invocation merely to establish witness identity. |
| Observation overhead | Repeated capture/classification/rerender/diagnostic projection against the same baseline lifecycle adds zero source read/open, recovery trigger, scan, metadata transaction, storage probe, writer, listener or raw retry dispatch. Existing accessors are not described as cost-free. |

Required matched cases: (A) absent/already-verified import state; (B) valid pending with verified prior state; (C) valid pending with null prior state; (D) concurrent finalization/snapshot supersession; (E) malformed/cross-account/hash-invalid evidence; (F) cold/warm canonical initialization; (G) repeated evidence-only observation in each relevant case. Preserve original failure and recovery outcomes. B must still perform legitimate inherited restoration; D must not restore stale data; E must not gain repair. An extra observation-triggered readAll fails even if an earlier recovery makes it return NO_PENDING. No recovery may be triggered to gather witness identity.

The docs-only diff has no runtime effect, but no new absolute runtime counter measurements or W acceptance are claimed. These are future measurement requirements, not a zero-total-write assertion or permission to run a new recovery path.

## 11. Independent feasibility matrix

`PROVABLE_FROM_CURRENT_PRODUCER` applies to the specifically stated negative/occurrence fact only, never to a positive transient causal episode. `REQUIRES_SOURCE_PRODUCER_CHANGE` below means an explicitly scoped frontend source-owner evidence-envelope change, not authority to change backend, persistence or transport behavior.

| Owner | Current provable fact / safe negative | Missing fact and continuity | Smallest later change / files | Evidence-only feasibility | Positive causal/transient feasibility |
| --- | --- | --- | --- | --- | --- |
| B1 | PROVABLE_FROM_CURRENT_PRODUCER: real canonical/legacy isolation origins and sanitized catch dispositions; unknown plain/open failure remains denied; whole unsafe pair veto | Explicit lane attribution missing from compacted failures; no source-owned cause relation/new-cause witness; device-sensitive continuity not continuously established | Attribution at known legacy/canonical/owner catches in `useHealthSelectedDayComposite.ts`; narrow adapter/shared safe classifier types and tests. No reader/repository behavior change needed for this alone | REQUIRES_SOURCE_PRODUCER_CHANGE: safe bounded F1-P1 candidate without episode issuance, subject to separate authorization/review | UNSUPPORTED_WITH_CURRENT_AUTHORITY: producer cause/new-cause and sufficient lifetime proof absent. No positive category established |
| RANGE | PROVABLE_FROM_CURRENT_PRODUCER: real source attempts, typed isolation and exact snapshot qualification; partial/error is not transient proof | Ordinary reasons lost after allSettled; source snapshot/sequence supplies no cause continuity; unknown/unobserved scope transitions remain unproved | Add sanitized per-source evidence across the same coordinator snapshot/hook in `verifiedWorkoutRangeSnapshot.ts`, `useHealthWorkoutRangeSnapshot.ts`, adapter/shared classifier types and focused tests | REQUIRES_SOURCE_PRODUCER_CHANGE: safe preservation-only F1-P1 candidate, same statuses/ordering/fences/IO budget | UNSUPPORTED_WITH_CURRENT_AUTHORITY: even retained OPEN_BLOCKED/code is no stable causal witness; no positive transient proof |
| D | PROVABLE_FROM_CURRENT_PRODUCER: actual LOCAL loader failure is UNAVAILABLE/UNKNOWN; qualified local omission NO_MATCH; independent rejection/cutoff/dependencies matter | No actual legacy typed-isolation/transient cause capability or causal lineage; remote omission loses distinction; no independent canonical lifetime | Optional LOCAL-route attribution only at existing loader/flush. A real typed producer would first need a concrete independently scoped contract at legacy repository/runtime and D boundaries, not an enum injected in flush | REQUIRES_SOURCE_PRODUCER_CHANGE for optional attribution only; keep normal D evidence unchanged. No executable bridge | UNSUPPORTED_WITH_CURRENT_AUTHORITY; D_CAUSAL_WITNESS = UNSUPPORTED |

No owner is PROVABLE_FROM_CURRENT_PRODUCER for SAME/DISTINCT causal continuity or an additional finite user retry. F1-P1 success cannot change that verdict by itself. Missing evidence is not proof of universal impossibility; it is a concrete current-authority STOP, not permission to design a broader identity/provenance service.

## 12. Options and bounded recommendation

| Option | Traceability / continuity value | Authority and approval boundary | Disposition in this packet |
| --- | --- | --- | --- |
| A Attribution and cause preservation, no episode | Improves known source/boundary/classification trace. Can prevent ordinary RANGE reason loss. Does not prove SAME/DISTINCT or transient retryability | No product-policy revision is needed for faithful evidence-only preservation under existing denial. Requires a separately authorized implementation, real boundary tests, effects parity and independent review | Recommended minimum next engineering scope F1-P1, B1/RANGE only initially; D optional LOCAL diagnostics remains denied. Not implemented/authorized by publication |
| B Producer-issued stable causal witness | Could establish continuity **only** if an actual producer capability independently proves section 4 relations and lifetime bounds | No suitable capability selected/found now. Requires a concrete scoped producer proposal and separate implementation/review. A positive category also needs F0's explicit later category review/approval before F2. Broader provenance, device observation, persistent/cross-tab tracking or changed policy requires a separate decision, not implicit authority | Conditional F1-P2 research/implementation path only after capability evidence; otherwise STOP. No positive source recommendation |
| C Catch/request/publication-derived new failure identity | Can label occurrence/work, but invents continuity if treated as an episode; code equality/timestamps/UUID do not remedy this | Cannot satisfy the approved source-origin contract. A redefinition would require revising product/architecture policy; it is not approved here | Rejected as substitute for causal proof. An observation label must remain explicitly non-causal |
| D UNKNOWN/denied | Preserves safety while unsupported; does not advance causal proof or implement positive Slice C | Already selected current F0 policy. No new product decision or execution authority | Continue for all unsupported owners, including D; no obligation to make every owner positively eligible |

Recommendation is a scoped technical next step, not human approval of a new policy or capability. Preserve the approved empty positive allowlist. Generic Error, OPEN_FAILED, OPEN_BLOCKED, transaction failure, transport omission, pending restoration, device-currentness recovery and status:error remain insufficient. Do not widen a pair around a deterministic/unsafe UNKNOWN lane.

## 13. Future W01-W16 acceptance definitions

Every row is `REQUIRED / NOT_EXECUTED`. The oracle must run unmodified against both a valid scenario and its narrowly faulty test-only variant. Expected detection is a named evidence/identity/effect assertion, not arbitrary setup failure. No production fault hook is authorized. If the real producer prerequisite is absent, return unsupported instead of manufacturing a positive fixture.

| ID | Future scenario and required oracle | Sensitivity fault that must be detected | Status |
| --- | --- | --- | --- |
| W01 | New raw request/publication with no new producer fact remains CONTINUITY_UNKNOWN, no new causal episode | Substitute request identity for cause/new-episode proof | REQUIRED / NOT_EXECUTED |
| W02 | Two actual observations with equal codes but no producer relation do not prove SAME; differing codes alone do not prove DISTINCT | Group by error code/message/time | REQUIRED / NOT_EXECUTED |
| W03 | Catch-generated UUID/object labels at most observation C; forged witness rejected | Trust nonnull UUID/shape/private label without producer fact | REQUIRED / NOT_EXECUTED |
| W04 | Retry/reclick/rerender cannot issue a new causal episode or allowance. Any later separately authorized F2 test must preserve spent lineage | Reset episode/allowance on retry failure, refresh, reload or new publication | REQUIRED / NOT_EXECUTED |
| W05 | LEGACY/CANONICAL and B1/RANGE/D origins cannot borrow each other's witness or lifetime, even if account/code matches | Relabel source/owner or accept copied sibling evidence | REQUIRED / NOT_EXECUTED |
| W06 | Account A1-B-A2 retires A1 authority; A2 begins without positive inherited continuity | Match account strings or stamp latest generation at catch | REQUIRED / NOT_EXECUTED |
| W07 | Date X1-Y-X2, layout detach/reconnect and owner replacement never revive X1 | Compare date value, reuse old lifetime or rely on passive-only retirement | REQUIRED / NOT_EXECUTED |
| W08 | Observed device A-B-A retires proof; wholly unobserved ABA without authoritative witness remains unsupported | Treat equal final device string as continuous or add an identity probe to pass | REQUIRED / NOT_EXECUTED |
| W09 | Deferred old error/success after retirement cannot publish as a current episode | Bind late settlement to whichever owner/request is newest | REQUIRED / NOT_EXECUTED |
| W10 | One source recovers while the sibling fails: preserve qualified partial facts but not whole-pair recovery/causal resolution | Retire sibling failure or clear deterministic/rejection veto on any success | REQUIRED / NOT_EXECUTED |
| W11 | Real plain/open/transaction/flattened UNKNOWN stays denied, no transient inference by exclusion | Promote UNKNOWN/unrecognized code or missing metadata to transient | REQUIRED / NOT_EXECUTED |
| W12 | Actual remote non-OK/transport omission cannot become LOCAL NO_MATCH/causal witness; qualified LOCAL NO_MATCH stays a nonfailure | Feed omitted remote result into positive D witness or treat NO_MATCH as failure | REQUIRED / NOT_EXECUTED |
| W13 | Matched repeated evidence observation adds zero source read/open/scan/metadata probe/recovery trigger/listener/retry | Add readAll or device/metadata lookup to capture/classify | REQUIRED / NOT_EXECUTED |
| W14 | Matched valid-pending case retains the original account restoration, transactions/dataset/import-state effects; absent/STALE/invalid cases keep their original guards | Hide restoration behind writer=0, omit effect counters, remove legitimate recovery, change targets/guards, or add a recovery-triggering read | REQUIRED / NOT_EXECUTED |
| W15 | Every proposed witness slot traces exact baseline producer -> operation -> owner binding and independent real fact. Unsupported fields fail closed | Remove producer link/verification while leaving matching codes and an attractive token | REQUIRED / NOT_EXECUTED |
| W16 | Positive causal claim requires an actual production-origin capability and real owner boundary; an injected idealized cause proves only response to injection | Replace genuine producer with mock-only typed error/witness and still label it production proof | REQUIRED / NOT_EXECUTED |

Additional F1-P1 acceptance must directly exercise B1 lane/PAIR_OWNER attribution and RANGE allSettled preservation without changing source statuses, isolation rethrow order, partial qualification, existing currentness recovery, publication fences, payload exclusion or counters in section 10. Existing #775-#777 regressions remain mandatory. Passing P1 shapes/CI does not pass W causal positives, original F1-C01-C30 as a whole, B18/B20, or finite execution acceptance.

## 14. Minimum sequence, dependencies and STOP rules

| Step | Bounded scope | Prerequisite / exit / STOP |
| --- | --- | --- |
| F1-P0 | This docs-only producer/continuity characterization | Independent review of exact head, successful new Push/PR CI and separately requested merge gate. Characterization is REVIEW_PENDING, not self-approved |
| F1-P1 | Evidence-only B1 attribution and RANGE safe per-source cause retention; no observation-to-episode conversion, permit or retry change | P0 independently accepted, separately authorized narrow implementation. Exit: real producer/catch tests and IO/persistence/qualification parity, independent implementation review. STOP if status/retry/writer/recovery behavior or frozen policy must change. Useful even if all causal verdicts remain unsupported |
| F1-P2 | Source-origin causal continuity proof for a specifically demonstrated producer capability only | P1 does not imply capability. First supply concrete issuer/facts/independent SAME and DISTINCT verification, lifetime/retirement/effects scope. Separate authorization/review mandatory. If no genuine capability or sufficient existing lifetime proof, STOP blocked; no generic catch registry or new device/provenance service |
| F1-P3 | Independent source/episode review of an actual P2 implementation, if one exists | Exact producer-to-owner trace and W01-W16 sensitivity evidence; no synthetic-only positive. Denied owners stay denied. Failure returns to bounded correction or blocker, not alternate guessed identity |
| F1-P4 | Resume original F1 for the proven owner subset only | Accepted real producer/episode proof and separate implementation authorization; re-evaluate original F1 criteria including inherited recovery and source/parent/device limits. D may remain unsupported. No retry permission |
| F2 | Owner one-shot permission, only later | Independently accepted F1 subset, explicitly approved positive category/whole-owner safety and separate F2 authorization under F0. This packet starts none of F2/F3/F4 or Slice C |

F1-P3 is a prerequisite source/episode review, not F0's later F3 admission review. Do not confuse F1-P4 (resume evidence work) with F0 F4 (Slice C integration). Even after P4, F0's F2/F3 must close for the executable subset before separately authorized Slice C can restart. No controller counter, completion port, raw wrapper or D bridge is supplied by this sequence.

STOP for missing real origin, unknown continuity, inadequate device/ABA/reload proof, required additional reads/listeners/provenance, changed legacy recovery preconditions/targets/transactions, writer semantics, backend/schema or public activation. Record the exact unsupported owner/fact; do not redesign the product to force feasibility. A positive category approval under the existing F0 framework is not automatically a policy rewrite; authority expansion beyond that framework requires a separate revised decision.

## 15. Frozen state and publication validation

```text
F0 = CLOSED_IN_MAIN
F1 = BLOCKED_BY_MISSING_PRODUCER_OR_LIFETIME_PROOF
F2 = NOT_STARTED
F3 = NOT_STARTED
SLICE_C = BLOCKED_BY_CONTRACT_GAP
FA_PD01_PD04 = APPROVED_POLICY_ONLY
POSITIVE_TRANSIENT_ALLOWLIST = EMPTY
CURRENT_EXECUTABLE_FINITE_ADMISSION = NONE
B18_FINITE_ELIGIBILITY = NOT_PROVEN
B20_PERMIT_CONSUMPTION = NOT_PROVEN
D_CAUSAL_WITNESS = UNSUPPORTED
ALL_FIVE_READER_GATES = false
WRITER_AUTHORITY_CHANGED = NO
WRITER_SEMANTICS_CHANGED = NO
PROVENANCE_CAPABILITY = NONE
LIVE_WRITER_BLOCKERS = 7 OPEN
PUBLIC_ACTIVATION = NOT_AUTHORIZED
LOCAL_DATABASE_VERSION = 7
LOCAL_SCHEMA_VERSION = 1
W01_W16 = REQUIRED / NOT_EXECUTED
INDEPENDENT_REVIEW = PENDING
NEXT_RECOMMENDED_IMPLEMENTATION = SEPARATELY_AUTHORIZED_F1_P1_EVIDENCE_ONLY
```

Literal gates remain false in [B1 config](../src/components/views/features/health/healthSelectedDayCompositeConfig.ts), [RANGE config](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts), [comparison config](../src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts), [Home config](../src/components/views/features/home/homeWorkoutCompositeConfig.ts) and [Search config](../src/components/views/features/search/searchWorkoutCompositeConfig.ts). [DB/schema constants](../src/lib/localDatabase/types.ts), stores/indexes/keyPaths, WorkoutSessionV1, backend/RLS, writer/adoption/bind/push/pull/resync/reset and G6 remain unchanged. No product UI, identity allocation/recovery, remote startup behavior or approved F0 document is modified.

Publish this one new Markdown file on `codex/rel05g-health-owner-causal-witness-characterization` as a Draft PR targeting main. Validate relative source/document references, baseline line/symbol anchors, producer mapping, four-identity distinction, all transitions/fact slots, option/feasibility consistency, W01-W16 completeness, unchanged non-doc tree and `git diff --check`. There is no dedicated Markdown lint/link command in the frontend package/workflow; direct checks must not add config/dependencies. No F1 runtime tests or physical qualification PASS is claimed.

New exact-head Push **and** PR CI must each succeed for test/typecheck/build/backend-rel05g1/backend-recovery. Actual head/run IDs and observed CI outcomes belong in the PR body/report, not a predicted self-referential commit inside this packet. Hosted full-suite regression is not producer/causal proof. If any local full suite is run, classify the known Windows K-333B fixture-anchor limitation accurately and do not edit it. This docs-only task does not rerun or promote prior F1 baseline tests to new acceptance.

Stop after Draft publication, CI observation and characterization report. Do not self-declare REVIEW_PASS, mark Ready, merge, enable auto-merge, implement F1-P1/P2/F2, start Slice C, activate readers or close any live-writer blocker.
