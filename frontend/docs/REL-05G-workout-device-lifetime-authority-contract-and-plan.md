# Workout device lifetime authority: contract, plan, and product-decision package

## 1. Executive status

- Task: `REL_05G_WORKOUT_DEVICE_LIFETIME_AUTHORITY_CONTRACT_AND_PLAN`.
- Package status: `PRODUCT_OWNER_APPROVED`; contract approval recorded in section 25, not runtime implementation or activation authority.
- Repository/workspace: `Absinthe-6785/Absinthe`, `C:\Users\이도현\GitRepos\Absinthe`; never `D:\Projects\Absinthe`.
- Verified main/base: `ce12d8de15b823bb1febb9b7b4e572f26b717482`.
- Blocked [PR #745](https://github.com/Absinthe-6785/Absinthe/pull/745): Draft/Open/Unmerged, head `2ad2ec573490b5c0a507b23bb06e98cba34c65be`; one original implementation commit, no correction commit.
- Source authority: completed `REL_05G_WORKOUT_DEVICE_LIFETIME_AUTHORITY_CHARACTERIZATION = COMPLETE`, supplied in the preceding characterization report and the task instruction. That report is not represented as an already merged repository document.
- Characterization disposition: `DEVICE_AUTHORITY_PREREQUISITE_REQUIRED`, `KEEP_PR_745_DRAFT_BLOCKED`; current `REL05G-EXCOMP-OWNER-001 = BLOCKED_BY_DEVICE_AUTHORITY_PREREQUISITE`. Product policy is decided; the technical prerequisite remains unimplemented, not corrected or CLOSED.
- Later workstream: `REL_05G_WORKOUT_DEVICE_LIFETIME_AUTHORITY_FOUNDATION = AUTHORIZED_FOR_SEPARATE_IMPLEMENTATION_TASK`; do not implement in this docs PR or before PR #746 is merged into main.
- Deliverable: this one Markdown file. No runtime, tests, configuration, Storage, IDB, writer, backend, or PR #745 changes.
- Correction task: `REL_05G_WORKOUT_DEVICE_LIFETIME_AUTHORITY_BOOTSTRAP_ADMISSION_CORRECTION`; previous reviewed head `ab6d6c04e94311ca9f073b0c897c69500c62a48e`.
- `REL05G-DEVLIFE-CONTRACT-001 = CLOSED` by focused independent rereview of head `77221d4eb9dc2946de3a5728892c29272957bd31`; verdict PASS, P0/P1/P2/P3 = 0. Approach 2 was then included in the explicit complete-bundle owner approval.
- Finalization task: `REL_05G_WORKOUT_DEVICE_LIFETIME_AUTHORITY_OWNER_APPROVAL_RECORD`; documentation-only approval record.

Recommendation: a shared, local-only device authority owner, one persistent logical authority record containing the exact existing device ID and a fresh opaque lifetime ID, and an origin/storage-context-wide transition boundary. Preserve the current plain-string device key as a compatibility mirror, not a second authority. Serialize supported transitions and final publications with one named Web Lock. Storage events are optional fast invalidation assistance, never the proof. This is recommended architecture D with C's authoritative transition boundary and E's optional signaling; it is ONE bundle, not several selectable implementations.

The approved design includes only a sticky adoption-start marker to distinguish first admission from later loss of the authority record. It carries no device/lifetime tuple and cannot authorize publication. No marker/key is implemented by this document. Its crash fail-closed and rollback limits are included in the complete PD09/PD19 approval.

Every decision in section 21 is `PRODUCT_OWNER_APPROVED` by the explicit instruction recorded in section 25, not by publication, review, merge, CI or silence. PR #745 remains technically blocked; no C28 PASS, owner-integration closure, analytics closure, public activation, or writer activation follows.

## 2. Source characterization summary

The completed characterization is the factual starting point. Relevant baseline sources are:

| Source | Established fact, not a new product policy |
| --- | --- |
| [workoutLocalReaderAuthority](../src/lib/workoutLocalReaderAuthority.ts) | `HEALTH_ROUTINE_DEVICE_ID_KEY = absinthe-health-routine-device-id:v1`; read/create is not lifetime authority. Production key writes are concentrated in `readOrCreateDeviceId`. Reader helper rejects malformed established identity instead of repairing it. |
| [namespace](../src/lib/localDatabase/namespace.ts), [types](../src/lib/localDatabase/types.ts) | Namespace fingerprint uses userId/projectRef/deviceId/schemaVersion, not generationId; local DB v7/schema v1. |
| [WorkoutRangeReader](../src/lib/workoutRangeReader.ts), [WorkoutSelectedDayReader](../src/lib/workoutSelectedDayReader.ts) | Readers capture device/account/namespace/generation; currentness is not device-transition history. Range verification compares device strings around durable metadata reads. |
| [snapshot coordinator](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts), [selected-day hook](../src/components/views/features/health/useHealthSelectedDayComposite.ts) | Current owners fence captured values and observed invalidation. They do not own a device lifetime. PR #745 additionally exposes borrowed snapshot publications. |
| [runtime authority](../src/lib/workoutRuntimeAuthority.ts), [routine sync](../src/lib/healthRoutineSync.ts) | Existing creation/control-plane consumers also obtain the same device ID. Their outputs and remote authority semantics cannot silently change. |
| [Settings](../src/components/views/SettingsView.tsx), [portable extensions](../src/lib/vaultPortableExtensions.ts), [extension apply](../src/lib/vaultExtensionApply.ts), [canonical restore](../src/lib/localDatabase/restore.ts), [adoption](../src/lib/workoutAdoption/index.ts) | Current product reset/restore/adoption do not intentionally replace the global device key. Data/provenance restoration is not identity restoration. |
| [request contract](../src/lib/workoutRemoteContract.ts), [outbox identity](../src/lib/localDatabase/outboxIdentity.ts), [remote reset](../src/lib/workoutRemoteReset.ts) | Device/namespace participate in request/delivery identity. Server authority epoch is a separate reset contract. |
| [approved exercise comparison package](REL-05G-workout-exercise-comparison-product-decision-package.md) | Existing exercise semantics, debt, partial-source limits, and writer/reader activation restrictions remain unchanged. Its approval is not approval of device lifetime policy. |

Device ID is account-independent within a browser origin/storage container and is a repository client/sync-producer identifier, not hardware attestation. Same-origin tabs in the same storage context share it. No Workout device-lifetime storage-event/BroadcastChannel authority exists today. Observed mismatch already invalidates old evidence. Unobserved A -> B -> A passes equality-based guards, including a durable-generation async gap and the shared range derivation. The characterized defect is `WORKOUT_READ_OWNER_SHARED_DEFECT`, not comparison-only. The diagnostic used memory Storage/fake IDB and mocked legacy input; it was not physical multi-tab QA or a supported-transition implementation test.

Browser contracts used in this plan: [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) and [request modes/lifetime](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request) provide cooperating same-origin shared/exclusive locking in supported secure contexts. [Storage events](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) do not notify the writing window; the [HTML storage specification](https://html.spec.whatwg.org/multipage/webstorage.html) queues notifications in other contexts. These facts justify explicit locking/proof rather than an event-delivery assumption. Browser/API availability on the target installed applications remains a QA requirement, not a claim established by documentation.

## 3. Current authority map

| Concept | Current owner/location | Lifetime and relationship |
| --- | --- | --- |
| deviceId | Shared read/create helper; origin-local localStorage key | Persists through ordinary reload/logout/current data reset; shared by accounts; no transition history. |
| accountId | Auth/runtime account context | Separate authorization/data owner. Logout/account change is not device replacement. |
| namespaceKey | Derived fingerprint and scoped IDB records | Same account/project/device/schema inputs produce the same key; lifetime must not be added to this fingerprint. |
| generationId | Repository generation records and active metadata | Durable data-generation authority in a namespace; normal old generation becomes sealed. Not a device epoch. |
| authorityEpoch | Server Workout authority and discovered local metadata | Account/project/domain remote-reset epoch; not installation/device lifetime. |
| coordinator sequence | One in-memory coordinator | Load/retry/account/invalidate/close revocation; not a shared device transition clock. |
| reader scope | Reader's captured scope plus durable verification | Account/device/namespace/generation still required after lifetime adoption. |
| proposed lifetimeId | Shared local device authority record | Additional read-side non-revival evidence; not a namespace, account, generation, request, or server epoch. |

Returning to device A can return to A's existing namespace and unchanged active generation. Thus generation verification cannot distinguish A1 from A2. Hashing the device string cannot distinguish them either.

## 4. Supported mutation threat model

All policies below are approved contract choices, not statements that runtime support exists or arbitrary Storage edits were already supported. The supported runtime is cooperating upgraded application contexts sharing the origin's Storage and Web Lock scope. Separate browsers/profiles/origins and separately partitioned embedded contexts are distinct authority contexts.

| Scenario | Recommended policy | Exact boundary |
| --- | --- | --- |
| Normal product helper creation | `SUPPORTED_AND_MUST_BE_FENCED` | Missing installation identity is created only by the shared authority boundary; concurrent creation is serialized. |
| Malformed identity recovery | `SUPPORTED_AND_MUST_BE_FENCED` | Only the existing authorized creator/recovery role, not a read guard, may recover. It must revoke old evidence, rotate lifetime, and preserve prior namespace data without transfer. Malformed bootstrap/read state itself fails closed; no availability repair is authorized here. |
| Explicit future identity replacement | `DEFERRED_REQUIRES_SEPARATE_PRODUCT_DECISION` | No replacement UI/API is introduced by the foundation. If later approved it must use this transition contract. |
| Identity reset | `DEFERRED_REQUIRES_SEPARATE_PRODUCT_DECISION` | Current data reset is not identity reset. |
| Migration-driven identity replacement | `DEFERRED_REQUIRES_SEPARATE_PRODUCT_DECISION` | Ordinary data/schema migration preserves identity; replacement needs its own approved migration. |
| Restore-driven identity replacement | `DEFERRED_REQUIRES_SEPARATE_PRODUCT_DECISION` | Ordinary product restore remains data-only. Installation clone is separate. |
| Second-tab supported product transition | `SUPPORTED_AND_MUST_BE_FENCED` | Accepted supported transition in one cooperating live tab must revoke old final-use authority in another. |
| Same-origin raw localStorage rewrite | `OUTSIDE_SUPPORTED_CONTRACT` | Bypassing the boundary is not a guaranteed transition. Observable mismatch/malformed state still fails closed. |
| DevTools rewrite | `OUTSIDE_SUPPORTED_CONTRACT` | No unconditional proof of arbitrary unobserved rollback. |
| Extension/arbitrary-script rewrite | `OUTSIDE_SUPPORTED_CONTRACT` | Not an application transition API; no claim to defend a fully compromised origin. |
| Browser/profile backup rollback | `OUTSIDE_SUPPORTED_CONTRACT` | Whole-authority rollback while a context remains live is not guaranteed; observed inconsistency fails closed. A supported clone/restore protocol is deferred. |
| Partial site-data deletion | `FAIL_CLOSED_IF_OBSERVED` | Observed loss revokes captured tokens. A retained adoption marker also denies missing-authority bootstrap after restart. Joint unobserved deletion of marker and authority cannot be distinguished from first admission; section 10 discloses that limit. No residual-data reassignment. |
| Total site-data deletion | `FAIL_CLOSED_IF_OBSERVED` | Old captured evidence fails if observed; all three identity metadata values absent allows only admitted fresh creation, not proof that residual IDB is empty. Destructive recovery and unobserved whole-context rollback are not promised. |
| Profile/origin switch | `OUTSIDE_SUPPORTED_CONTRACT` | Another installation/storage context, not a transition of the old process owner. |
| Tests directly mutating Storage | `OUTSIDE_SUPPORTED_CONTRACT` | Useful corruption/diagnostic injection, not proof that product transitions rotate lifetime. Supported ABA acceptance must use the real boundary. |

Recommended baseline: all supported product identity changes use the authority boundary and rotate lifetime; live cooperating same-origin tabs are supported; raw edits are not guaranteed transitions; observed malformed/mismatched authority fails closed; future identity replacement is not implicitly authorized. This fits local-first operation: local coordination and evidence, no remote success requirement, and no invented cross-device identity synchronization.

## 5. Device versus lifetime invariant

`DEVICE_IDENTITY_IS_NOT_DEVICE_LIFETIME`: equal device IDs do not imply the same read authority lifetime.

`SUPPORTED_DEVICE_TRANSITIONS_MUST_ROTATE_LIFETIME`: A1 -> B -> A2 has distinct opaque lifetime IDs, even when A1.deviceId equals A2.deviceId. A1 publications remain revoked without any guard observing B. An explicit accepted re-identification to the same logical ID also rotates lifetime. Ordinary repeated reads and ordinary data changes are not identity transitions.

Retain `SURFACE_IS_NOT_AUTHORITY`, `MULTI_SURFACE_COMPATIBILITY`, and `FEATURE_REMOVAL_COMPATIBILITY`. Account/view/coordinator lifetimes remain independent fences. A guard that observes any invalid authority or missing/invalid adoption marker permanently revokes its captured token; restoring the previous serialized values must not revive that already-revoked token. An entirely unobserved arbitrary rewrite/rollback of the record, mirror and admission evidence is outside the proposed contract.

## 6. Option comparison

Model labels in this package follow this task's options, not the preceding characterization's labels. All persistent models require every supported mutation to update the proof; persistence alone does not supply write authority.

| Model | Same-process / live cross-tab ABA | Reload, reset, restore, migration | Bootstrap / old-new coexistence / atomicity | Failure, cost, reuse, writer risk |
| --- | --- | --- | --- | --- |
| A: single API + memory epoch | Same-process only if all accepted transitions use API; independent tab epochs cannot prove remote history | Reload drops publications; another live tab remains a gap. Reset/restore/migration must invoke API | Simple local bootstrap; old client bypass persists; no coherent cross-tab authority | Low cost, reusable shared owner, but insufficient recommended tab guarantee; no automatic writer rewrite |
| B: persistent token paired with existing ID, without one transition owner | Detects only changes that also update token; unsupported/missed writes remain ambiguous | Persists through reload; replayed old token cannot prove restore history | Two-key races and competing bootstrap unless another serialization contract exists; old client can bypass | Medium cost; fail closed on mismatch; metadata reusable but persistence-only is insufficient; mistaken repair may reidentify writers |
| C: single API + persistent token | Can satisfy both with coherent capture and serialized transitions/final use | Reset/restore/migration must obey same protocol; reload itself does not demand a new token | Needs exact representation, locking, bootstrap, and old-client admission rules | Medium cost; reusable; selected transition mechanism, but too underspecified as storage design alone |
| D: one persistent logical record with deviceId + lifetimeId | Coherent tuple can distinguish both, provided C's boundary and final-use serialization exist | Stable reload token; approved identity changes mint fresh token; data-only operations preserve it | One complete record per write; compatibility mirror still needs explicit two-key protocol; existing ID preserved | Medium cost with no canonical schema change; selected primary architecture; read proof must not enter request digests |
| E: persistent token + storage-event/BroadcastChannel assistance | Fast revocation when delivered, not sufficient proof of an unobserved transition or final-use race | Reload reads record; missing events/rollback cannot be repaired by messages | Still needs C/D bootstrap and serialization; cannot teach an old client to rotate | Additional listener complexity; optional storage event only initially; no BroadcastChannel requirement or writer activation |
| F: supported transitions only; raw rewrites excluded | Defines which transitions must be fenced; cannot itself revoke anything | Defines destruction/rollback limits, not persistence mechanics | Requires explicit policy and tests; old product code is not magically compliant | Selected threat-model boundary, not a substitute architecture; no waiver of C28 before implementation |

Pure ID equality, before/after ID reads, ID hash, comparison-local epoch, previous observed value, observed-only sequence bumps, test-only APIs, generationId substitution, and canonical scope checks alone are insufficient. They cannot prove unobserved device history. Moving the proof to account/generation metadata creates the wrong owner; adding a canonical store/server epoch is unnecessary for the recommended bounded local contract.

## 7. Recommended architecture

Recommend D + the single authoritative transition boundary, under F's explicit supported-mutation policy. Persistent evidence is justified by LIVE cross-tab consumers, not by JavaScript reload alone. Use the existing device ID unchanged wherever namespace/request contracts currently require it. Introduce a proposed separate localStorage key `absinthe-workout-device-authority:v1`; it holds the entire logical authority record. The old `absinthe-health-routine-device-id:v1` remains a plain-string compatibility mirror.

Bootstrap admission uses the additional proposed localStorage key `absinthe-workout-device-adoption:v1` owned by the SAME layer/lock. Its only valid value is the closed record `{"format":1,"adoption":"started"}`. It proves that protocol admission has begun, not that READY committed. It contains no identity, lifetime, account, namespace, generation or transition target: it is a sticky deny-rebootstrap latch, not a second competing authority or a history journal. Only the admitted bootstrap owner writes it, once, before first authority preparation; ordinary reads/transitions never remove or rewrite it. Product data reset/restore/migration never clear or import it. Unknown/malformed marker formats fail closed.

Use one fixed origin-wide Web Lock, proposed name `absinthe-workout-device-authority:v1`, independent of account, device string, namespace, generation, feature, or view. Transitions/bootstrap/recovery take exclusive mode. A final publication takes shared mode through its synchronous consumption. Multiple readers can coexist; device transitions cannot interleave that final-use critical section. A captured token's synchronous `isCurrent` is an advisory fail-fast check, not the lock-protected final publication operation.

No silent fallback to process-local locking, an uncoordinated two-key write, or event-only fencing is allowed if Web Locks/Storage are unavailable. Return authority-unavailable, not verified-empty. Verify API support on the supported HTTPS installed applications; no browser compatibility or physical QA is claimed here. Do not add IDB/backend fallback in the bounded foundation; inability to meet the lock capability is a stop condition requiring a revised reviewed plan.

The original record/mirror alone cannot distinguish never-adopted installation from authority loss after restart. Section 17 fixes old-client participation but supplies no existing authoritative rollout-phase source; deployment/first-boot guesses are insufficient. Therefore one local sticky marker is the bounded recommended addition rather than a remote phase dependency or unspecified context permission. A is too weak for tabs; B lacks write ownership; E alone lacks proof; replacing the old key with JSON breaks old readers; canonical/account metadata widens the wrong authority scope. Notifications remain optional. No unrelated authority redesign is proposed.

## 8. Authority ownership

The owner is a shared local Workout identity-authority layer below repositories/read owners and above raw Storage access. Proposed placement is a separate module adjacent to `workoutLocalReaderAuthority`, not inside its callers' presentation code. Imports and constructors perform no I/O or listener installation. Capture/bootstrap/transition operations are explicit. The record is device-global within its storage context, not account-scoped.

It is usable by RangeReader, SelectedDayReader, coordinator, Home, Search, Previous/Calendar, comparison borrowers, and relevant control-plane/recovery callers. Views neither create lifetime IDs nor own locks/listeners. Closing one view does not close the shared authority or another surface. Removing the comparison feature leaves authority safety intact.

Future implementation must inventory and route ALL production device key creators/recovery writers, including helper aliases and routine/runtime bootstrap, through the accepted boundary before claiming its guarantee. Routing identity acquisition does not authorize request/outbox behavior changes. If preserving an existing caller's identity semantics requires a writer-affecting change, stop for a separate high-risk review. `REL05G5A-001` is not repaired by merely naming this owner.

## 9. Storage and atomicity contract

The recommended logical READY record has exactly `format: 1`, `phase: ready`, `deviceId`, and `lifetimeId`. `deviceId` preserves the exact valid established string, including case; no normalization, namespace rekey, or canonical rewrite. It must satisfy the existing applicable helper AND namespace safety contract. `lifetimeId` is a newly generated opaque cryptographic UUID, never a device-string hash, timestamp, server epoch, or account identifier. Supported operations never reuse a retired lifetime ID. Normal captures do not mint IDs.

A TRANSITIONING record contains the same target tuple with `phase: transitioning`, plus narrowly validated prepared-transition evidence: transition kind, previous lifetime ID (or null for first initialization), and a fingerprint of the expected previous mirror bytes (or null for absent mirror). The mirror fingerprint only recognizes interrupted write progress; it is NOT the lifetime/ABA proof. Closed record formats reject unknown/invalid fields and unsupported versions. Transition kind must correspond to an authorized creation/recovery operation; future replacement/reset/clone kinds are not enabled by this foundation.

There is no atomic localStorage transaction covering the authority, mirror and admission marker. The normative protocol is:

1. Acquire the exclusive authority lock; re-read authority, mirror and adoption marker. Apply section 10 admission before initialization. Do not use a pre-lock cached value as current authority. On admitted first bootstrap only, write and re-read the exact adoption-start marker BEFORE any authority or mirror write. Marker write/read failure aborts initialization; never delete it to retry as never-adopted.
2. For an already coherent READY tuple, ordinary acquire/capture reuses it. A supported transition allocates a fresh target lifetime exactly once for its prepared intent.
3. Write the complete TRANSITIONING record first. This is the revocation boundary for the previous lifetime. Never modify the legacy mirror first while the previous READY proof still appears current.
4. Write the target plain-string device ID to the legacy mirror, if it changes.
5. Write the complete target READY record as the commit boundary; re-read both representations and validate the retained marker before reporting success. No successful capture/publication is allowed on TRANSITIONING, mismatched records or missing/invalid marker.
6. Notify local subscribers explicitly. Other-context storage events may accelerate invalidation. Notifications do not establish commit or authorize capture.

If any storage operation fails, reject the operation. If failure precedes step 3, the unchanged old coherent READY state may remain current; if failure follows revocation, never restore its old lifetime to hide the failure. Leave non-ready state fail-closed. A bounded retry under the lock may complete an exact validated durable prepared intent only when the mirror matches its recorded pre-write fingerprint or exact target ID and the pending record is still that intent. Resume the prepared target lifetime; do not mint competing lifetimes on every retry. Unexpected mirror bytes, invalid intent, unsupported version, or ambiguous destruction require explicit controlled recovery, not a guessed upgrade or overwrite. Bounded wait/cancellation yields unavailable; no busy retry loop.

For admitted valid existing-ID bootstrap, preserve the mirror exactly but still use marker -> TRANSITIONING -> unchanged mirror -> READY. There is no direct-READY admission bypass. A crash after marker write but BEFORE durable prepared intent leaves marker-present/authority-missing: unavailable, no automatic bootstrap/recovery, separately reviewed controlled repair required. This conservative loss of availability is explicitly included in owner approval. With an exact validated prepared intent, bounded recovery retains the SAME target lifetime under the lock; marker presence alone never reconstructs a lost target. A marker-write failure may itself have persisted the marker, so retry always re-reads and classifies state, never assumes the write failed atomically.

Synchronous advisory reads use record -> mirror/marker -> record and require identical valid READY tuples matching captured token/mirror plus the exact marker. These are bounded metadata reads, not a multi-key atomicity claim. The lock-protected final fence remains mandatory for publication. A crash before the marker persisted can leave a still-never-admitted state; there was no authority to resurrect. Later supported transitions retain the marker and keep TRANSITIONING -> mirror -> READY ordering unchanged.

## 10. Existing-install bootstrap

Approved selection: APPROACH 2, durable adoption-start evidence, `PRODUCT_OWNER_APPROVED`. Valid mirror A + missing authority alone cannot distinguish legitimate first upgrade from prior authority deletion after restart. No process-memory history survives restart. The additional marker supplies evidence of prior admission when retained; mirror validity NEVER proves first adoption.

`BOOTSTRAP_ADMISSION = TRUE` requires: marker absent, authority absent, identity absent or valid under BOTH existing helper and namespace validation, and an explicit acquisition in a cooperating, creator-quiesced context meeting section 17. The shared owner evaluates this under exclusive lock. An allowed existing reader first-acquisition may delegate valid-ID admission to that owner; read guards/final fences never mutate or repair. Missing-ID initialization requires the existing trusted creator role. Marker present makes the context `MANDATORY_AUTHORITY` permanently for supported operations, even if first READY never completed. There is no calendar/build-phase exception allowing rebootstrap from a plain mirror in that mode.

| Persisted state under lock | Bootstrap allowed? | Capture allowed? | Recovery / mutating role | Fail-closed rule |
| --- | --- | --- | --- | --- |
| Valid ID + coherent matching READY + exact marker | No initialization; reuse | Yes, existing fences still required | No repair; supported transitions only through owner | No rotation for read/reload/account/data reset/retry |
| Valid ID + authority missing + marker absent + bootstrap admission TRUE | Yes, exact-ID first adoption | Only AFTER marker/prepared/READY commit | Shared bootstrap owner; no ID/case or namespace change | No pre-commit publication |
| Valid ID + authority missing + bootstrap admission FALSE (retained marker, or context not admitted) | No | No | No automatic recovery; separately reviewed controlled repair only | Unavailable, even after restart/retry |
| No ID + no authority + marker absent in admitted creator context | Yes, fresh identity/lifetime | Only after full commit | Explicit trusted creator via shared owner | No implicit residual-IDB ownership |
| Authority present + mirror missing + exact marker | No bootstrap | No | Only existing explicitly admitted creator recovery with a valid READY source under paragraph below; otherwise controlled repair | Readers always unavailable until new coherent commit |
| Mirror present + malformed authority | No | No | Separate controlled repair, not ordinary creator repair | Unavailable; do not overwrite evidence |
| Valid READY/ID mismatch | No | No | Separate controlled repair unless the mirror meets ONLY the existing admitted missing/format-invalid creator trigger below | No inferred first upgrade or reader repair |
| Valid TRANSITIONING/prepared + exact marker | No new bootstrap | No until READY | Shared owner may resume exact validated intent using section 9; unexplained intent needs controlled repair | Never mint a competing target on retry |
| Unsupported/future authority format | No | No | Separate approved format/repair decision | Fail closed, not fabricated absence |
| Marker missing/invalid/future while authority present, or retained marker with both authority/ID absent | No | No | Separate controlled repair | Never synthesize missing adoption evidence or clear marker |
| Malformed established ID, authority absent, marker absent | No reader bootstrap | No | Only existing explicit creator recovery below, with marker written before preparation | Helper-accepted but namespace-invalid values remain ineligible |

For an admitted valid legacy installation, re-read exact ID/case under lock, write the marker first, mint one CURRENT lifetime in the prepared intent and commit READY without changing ID/namespace/entities/outbox. Concurrent cooperating callers reuse the same READY or resume the same exact prepared intent, not competing lifetimes. No historical lifetime is invented.

Recovery admission is an explicit trusted creator call, never an automatic retry of failed reader capture. Preserve the current helper's recovery trigger: missing identity or an identity rejected by its existing format check. An established value accepted by that helper but rejected by namespace safety is NOT newly eligible for recovery under this package; it still fails closed and leaves `REL05G5A-001` open. The only recovery starting states are never-admitted marker/authority absent with that established creator trigger, OR an exact marker plus valid READY authority with that trigger. Marker-present/authority-missing is NOT eligible, nor authority-present/marker-missing. For admitted first creator recovery, persist the marker first; for later admitted recovery retain it. Validate the source under exclusive lock, record the exact prior mirror fingerprint, prepare a fresh device/lifetime, and follow section 9. Malformed/future authority or marker and unexplained prepared intent require separately reviewed controlled repair. Prior canonical/outbox data remains under its original namespace without reassignment; recovery does not expand reader roles or close `REL05G5A-001`.

Running-token loss and restart admission are different: any already-captured token observing authority/marker disappearance is permanently revoked, regardless of later repair/initialization. After restart, retained marker + absent authority fails closed without needing process history. First upgrade has no marker; authority-record-only deletion after adoption retains one, so those states are distinguishable. However unobserved joint deletion of marker AND authority followed by restart with valid mirror recreates pre-admission bytes and may be admitted anew. No local contract can infer that erased history. This is an explicit unsupported destructive/rollback limitation, NOT a rollout availability exception or a promise to detect arbitrary deletion. Likewise a new process cannot detect unobserved restoration of the complete old metadata. Owner approval includes these limits; a stronger evidence design would require separate review and approval.

No WorkoutSessionV1 changes, entity migration, full-store clear, existing outbox rebind, or namespace change is part of valid-ID bootstrap. Marker evidence is local metadata only; no server dependency, remote admission query or DB/schema migration is proposed.

## 11. Cross-tab contract

Recommend YES: cooperating live same-origin contexts sharing the Storage/lock partition are supported. Tab 1's accepted device transition revokes tab 2's captured lifetime without requiring tab 2 to observe intermediate device B or receive an event. Tab 2 must obtain the shared authority lock and read the persisted READY tuple/mirror at final use.

Linearization is explicit: transition revocation starts at the TRANSITIONING record write while holding exclusive mode; final publication holds shared mode until synchronous consumption returns. If a transition has revoked/committed before final-use acquisition, an older captured lifetime fails. If publication already holds shared mode, a transition request waits; publication is ordered before the accepted transition, not retroactively undone. Queueing a transition request is not itself a committed identity change. No claim is made to stop arbitrary scripts that ignore the lock.

The browser lock is not a server authority lock and must not nest with outbox/worker/recovery locks. Final sections perform only bounded metadata verification and synchronous consumption, not domain scans, network calls, UI interaction waits, or nested authority acquisition. Use bounded acquisition/cancellation, never `steal`. Lock unavailability/cancellation fails closed. Different physical devices and separate profiles do not share this local lifetime.

## 12. Reload contract

Old JS publications disappear on actual reload. Reload alone does not require lifetime rotation. Reopen reads the coherent persisted READY record and preserves device/lifetime/namespace. Other still-live contexts retain tokens; persistence and final-use locking make their transitions visible without event dependence.

Do not restore lifetime records or admission markers from product backups. Persistence is not rollback resistance: a browser/profile tool restoring old record/mirror/marker without any observer can recreate the same bytes. That operation is outside the baseline. Observed deletion/rollback/mismatch permanently revokes the observing token. Restart-time absent authority with retained marker fails closed; absence of both authority and marker has only section 10's limited admission meaning. A supported future installation-clone/authority-recovery operation must mint a fresh lifetime through a separately reviewed protocol, not replay an exported one.

## 13. Account, namespace, and generation contract

Device lifetime remains global per storage context because current device identity is shared by accounts. Compose it with account-owner lifetime and the existing namespace/generation scope; do not replace those fences. Login/logout/account A -> B -> A does not rotate device authority by itself, but must invalidate account-owned reads and prevent an old A continuation borrowing the later A publication. Device metadata is not an auth credential and grants no access to any user's rows. No auth/session/RLS/service-key change is proposed; the Supabase skill is used only for this isolation boundary check, not as a completed service security audit.

Same-ID lifetime rotation is orthogonal to namespace: preserve deviceId, namespaceKey, entities, pending payloads and delivery records. A genuinely different device ID implies a different namespace under the existing formula; retain old data without automatic reassignment, merging, binding or deletion. Explicit future replacement must decide how users can access those residual namespaces before being authorized. Do not add lifetimeId to namespace hashes.

Generation transitions retain the same device lifetime unless device ownership also changes. Continue checking active-generation metadata. Remote authority reset epoch is also independent. Neither generation nor server epoch is incremented to manufacture device-history proof.

## 14. Reset contract

| Reset category | Recommended device/lifetime rule | Additional fence and limit |
| --- | --- | --- |
| Ordinary product data reset | Preserve deviceId and lifetimeId | Existing data/source/generation invalidation must revoke affected snapshots; device currentness is not data currentness. Current Settings behavior unchanged. |
| Remote authority reset | Preserve deviceId and lifetimeId | Existing authorityEpoch/reset-intent contract remains; device foundation does not run or change G4C. |
| Future identity reset | Deferred; if approved, mint a new deviceId and fresh lifetime through exclusive protocol | New namespace under current formula; old namespace retained, no automatic migration or outbox rebind. Same-ID re-identification still rotates lifetime. |
| Running context observes authority/marker disappearance | Permanently revoke captured token | Later bootstrap or controlled repair never renews that token; no historical restart inference needed. |
| Restart with missing authority before adoption (marker absent) | Only section 10's explicit bootstrap admission allows first adoption | No rollout blanket permission. Joint unobserved marker/authority loss is indistinguishable and excluded from guaranteed detection. |
| Restart in mandatory-authority mode (marker retained), authority missing | Unavailable; no bootstrap from plain mirror | Includes residual canonical IDB; separately reviewed controlled repair required, no automatic fresh lifetime for availability. |
| Other partial site-data destruction | Invalid/missing marker with existing authority, torn or mismatched values fail closed | Exact prepared intent plus valid retained marker may resume under section 9. No automatic residual namespace reassignment. |
| Total clean site-data destruction followed by fresh start | All three metadata values absent: admitted creator makes fresh device/lifetime/marker; old JS evidence not reused | This is not proof IDB was erased. Residual canonical records retain original ownership; no import, migration, clear or outbox rebind. Unobserved arbitrary full rollback is not covered. |

No product reset semantics are changed by this package. Identity reset and broad recovery remain separately reviewed decisions. Reset-related source invalidation remains necessary even where device lifetime is preserved.

## 15. Restore contract

Recommend data-only restore into CURRENT device authority. Do not export/import the authority key, adoption marker or legacy device key as portable identity/admission. Existing Vault and canonical restore semantics remain: restore data/provenance into an already validated namespace/generation contract, not an installation identity. Data restoration may change generation/source lifetime without rotating device lifetime.

No future restore may silently overwrite authority with an exported old lifetime. Installation clone/identity replacement is deferred for explicit product and high-risk namespace/writer review. External profile backup rollback remains unsupported as an unconditional transition guarantee; observed bad state fails closed. No portable format change is implemented or authorized here.

## 16. Migration contract

Ordinary schema/data migration preserves device/lifetime and the adoption marker unless identity ownership actually changes. Initial authority migration is marker-absent, explicitly admitted valid-ID bootstrap, preserving exact ID/namespace; not a retroactive history journal. It writes adoption-start evidence before preparation; marker-only interrupted admission cannot be retried as a first upgrade. Future authority/marker format upgrade must validate its source version under exclusive lock, preserve identity, and explicitly rotate lifetime if authority interpretation/ownership changes. Old tokens cannot borrow an upgraded proof without an approved compatibility rule. No existing implementation produces the proposed authority/marker formats today, so no undocumented READY-without-marker migration exception exists.

Identity replacement/migration and recovering ambiguous missing/malformed authority require separate product approval. No entity backfill, device-case normalization, schema bump, keyPath/index change, canonical-store migration, or writer-record migration is required by the recommended representation.

## 17. Old/new client coexistence

Old clients understand only the plain-string key. They may create/recover it without taking the lock or rotating lifetime; a compatibility mirror does NOT make them compliant. An observed mismatch makes new readers fail closed, but cannot prove that an old client never performed an unobserved bypass. No event shim can repair an unobserved history.

Recommend forward-only participation in the NEW authority guarantee: do not activate it for public readers while pre-authority creator contexts remain accepted. Existing old contexts must be quiesced/reloaded to a compatible build before public acceptance. A deployment or service-worker update is not by itself proof that old tabs have exited. The later rollout plan must explicitly document verified build/context admission and supported browser/installed-app restart procedure; inability to establish that admission is a STOP, not a waiver or force reload introduced here.

During dormant development, old builds can still parse the preserved plain key, but no mixed-version device-lifetime guarantee is advertised. New readers do not auto-repair READY/mirror mismatch caused by an old writer. Both-missing initialization is supported only for a clean/quiesced context, not evidence that live old clients were never present. No time-limited heuristic or "old key looks valid" rule grants coexistence acceptance.

PD10 context admission remains a prerequisite, NOT the historical bootstrap proof. The selected approach has no unimplemented rollout-phase oracle: an admitted new context with authority/marker absent may first-adopt; a retained marker ends bootstrap eligibility durably for that installation. Old plain-only clients cannot remove that latch through supported product behavior and may not reset admission by recreating the mirror. Raw marker deletion remains the explicit section 10 limitation. Public acceptance still waits for verified compatible creator contexts, coherent READY plus marker and physical QA; a marker alone neither proves old-client retirement nor authorizes a public reader. If that coexistence evidence is unavailable, STOP, even when bootstrap bytes are eligible.

This intersects the concerns of `G5B_OLD_NEW_WRITER_COEXISTENCE_BLOCKER` but does NOT resolve it. Reader authority admission is narrower than writer rollout; dormant read adoption does not authorize canonical writer, bind/push/pull/resync/reset, old-client writer retirement, or G6. A compatibility shim is acceptable only if every accepted identity writer actually routes through the shared protocol; changing only new-client readers is not such a shim.

## 18. Reader and coordinator adoption contract

Conceptual interface (names not yet frozen): capture a current device authority returning deviceId, lifetimeId, a permanently revocable token, advisory `isCurrent`, asynchronous preflight verification, and a lock-protected final-use operation. Plain `verifyCurrent() -> true` is not authority for later consumption after its lock has been released.

Required reader behavior:

- Capture a validated coherent READY tuple with the exact retained adoption marker before opening the device-scoped repository; reverify after async open/read/metadata boundaries. Admission never substitutes for current authority.
- Preserve account/namespace/active-generation checks. Authority validation is metadata work, not another Workout domain scan.
- A1 token compares lifetimeId as well as deviceId; B -> A2 cannot match A1. A captured revoked token never renews in place.
- Reader-less ordinary-error partial snapshots still require valid device authority, account, source publication identity and final-use protection. No canonical-open fallback bypasses this rule. Authority-unavailable itself cannot be represented as verified-empty or current partial evidence.
- Observed authority mismatch may revoke only the captured owner/snapshot still current by identity; an old continuation cannot invalidate a newer snapshot/lifetime.
- Source load/retry captures fresh current authority. Coordinator sequence remains its independent load/account/invalidate/close lifetime; both sequence and device lifetime must be current.

Final publication contract:

1. Optional preflight work may happen before the shared lock and does not authorize publication.
2. Acquire shared mode on the SAME authority lock used exclusively by transitions.
3. Validate the persisted record and legacy mirror against the captured tuple and the exact adoption marker; reject non-ready, malformed, missing or inconsistent state. No bootstrap/repair inside final use.
4. Perform existing bounded durable generation verification where a canonical reader exists, still inside the final-use critical section. No scan/network operation is added.
5. Re-read coherent authority and synchronously check account/coordinator/snapshot/view/request lifetimes immediately before consumption.
6. Consume the frozen DTO synchronously while shared mode remains held; then release. No awaited callback, delayed click, promise use or retained DTO receives authority. Later use repeats final publication.

Do not recursively acquire the authority lock from reader verification while it is already held. The shared source owner provides one final-use operation to borrowers, with an internal no-nested-lock metadata verification path. Views provide only their own synchronous currentness check/consumer. This avoids a comparison-specific authority implementation and protects multiple surfaces without closing sibling owners.

## 19. PR #745 correction contract

Explicit owner approval is now recorded; AFTER independently reviewed/merged foundation plus shared reader adoption, rebase/correct PR #745 against that merged authority in its separate slice. Keep comparison owner a borrower. It must use the shared lock-protected publication operation; a returned boolean from released verification is not enough. Remove string equality as the ABA proof; retain mismatch as optional fail-fast defense.

Add supported-boundary A1 -> B -> A2 tests with no intermediate guard observation, and an async-gap test where supported transitions complete before final-use lock acquisition. Also test that a transition queued after shared final-use acquisition is ordered after synchronous consumption, not incorrectly reported as an already-accepted change. Preserve per-exercise request/date/enable/close invalidation, account/snapshot supersession, observed fail-closed behavior, multi-view independence, frozen DTOs, source-qualified partial limits and zero additional domain scans.

`PR #745 = KEEP_DRAFT_BLOCKED` until all five conditions hold: explicit product approval (now satisfied for this bundle); prerequisite implemented; independent review and merge; #745 corrected against merged authority; independent focused rereview closes `REL05G-EXCOMP-OWNER-001`. Its current status is `BLOCKED_BY_DEVICE_AUTHORITY_PREREQUISITE`, not corrected or CLOSED. C28 remains not PASS until those tests and review genuinely establish the claimed contract. Do not alter #745 in this documentation task.

## 20. Writer/data-plane firewall

LifetimeId is read-proof metadata only. It must NOT enter namespace fingerprints, mutation/idempotency identity, delivery bindings, request digests, CAS bases, remote mutation refs/receipts, server authority locks, server epochs/authorityEpoch, reset intents, or transport payloads. No pending outbox record, payload/hash, binding, request, receipt, or writer state is rewritten/rebased/rebound by foundation/bootstrap/adoption.

The adoption marker has the SAME firewall: admission metadata never enters these frozen contracts or any canonical record. A marker loss/repair decision cannot transfer residual entities or immutable writer records to another identity.

All existing production device creators must eventually cooperate to claim the reader guarantee, but changing the acquisition boundary must preserve the device output and existing role distinction. Malformed recovery or intentional identity change never transfers existing writer records to the new namespace. If routing requires changing request construction, delivery semantics, namespace ownership, cached writer context, recovery/reset protocol, or existing sync behavior, STOP for a separately authorized high-risk workstream. Do not hide that change in the reader prerequisite.

Backend/SQL/API changes and product writer activation are outside the package. The local Web Lock is NOT a replacement for worker leases or remote authority locking. Existing G4A/B/C, G2/G3, K323 and REL-05D frozen contracts remain intact. No analytics or live-writer blocker closes from this firewall statement.

## 21. Product decision table

Every row has status `PRODUCT_OWNER_APPROVED` under the exact complete-bundle instruction in section 25. Approval includes storage/locking, fail-closed availability and old-client admission, and preserves the deferral of future operations; it does not authorize the deferred features.

| ID / decision | Recommended choice | Alternatives | Rationale | Implementation consequence | Deferred semantics |
| --- | --- | --- | --- | --- | --- |
| DEVLIFE-PD01 Supported mutation model | All current product creation and admitted creator recovery use one boundary | Observation-only guards; unrestricted raw writes | Product-owned writes must rotate proof | Inventory/route every production key writer | New replacement features |
| DEVLIFE-PD02 Raw Storage policy | Outside supported transition contract; observed bad state fails closed | Guarantee arbitrary raw rewrites | Unobserved complete rollback has no local history proof | Tests distinguish protocol transitions from injection | Arbitrary-script/XSS defense |
| DEVLIFE-PD03 Same-process ABA | A1/B/A2 distinct, A1 remains revoked without observing B | Require intermediate guard observation | Closes shared read-owner safety gap | Real-boundary synchronous/async-gap tests | None within supported scope |
| DEVLIFE-PD04 Live cross-tab guarantee | YES for cooperating contexts sharing Storage/lock scope | Single-tab-only support | Shared identity and local-first multi-tab usage | Exclusive transitions/shared final-use lock | Separate storage partitions/devices |
| DEVLIFE-PD05 Reload | Preserve coherent persisted device/lifetime; reopen new JS owners | Rotate on every reload | Old publications vanish; unnecessary namespace churn avoided | Reload/bootstrap tests | Whole-record external rollback |
| DEVLIFE-PD06 Persistence | Required for approved live cross-tab contract, not merely reload | Memory-only | Other live contexts retain captures | Persistent logical authority proof | Rollback-resistant external authority |
| DEVLIFE-PD07 Authority owner | Shared local Workout authority below surfaces | Comparison/UI/account owner | Reusable correct ownership | Explicit acquisition and final-use capability | Unrelated domain authority unification |
| DEVLIFE-PD08 Representation | One logical JSON authority record + plain mirror + sticky admission-only marker | Replace old key; competing authorities; IDB metadata | Marker proves admission started, never current tuple; no canonical schema expansion | Marker-first admission then unchanged prepared/ready ordering | IDB/backend fallback |
| DEVLIFE-PD09 Bootstrap | Approach 2: authority/marker absent AND explicit compatible-context admission; preserve valid exact ID; persist marker before preparation | Concrete rollout-phase authority with disclosed rebootstrap tradeoff; guess first boot | Retained marker distinguishes authority-record-only loss after restart; no entity/namespace migration | Concurrent bootstrap, marker-only crash and deletion tests; conservative fail-closed availability | Controlled repair; stronger rollback evidence |
| DEVLIFE-PD10 Old/new coexistence | Forward-only participants; verified old-creator quiescence before admission/public guarantee; retained marker ends first-bootstrap eligibility | Assume old tabs obey lock; deployment is phase proof; event shim | Creator admission is separate from durable adoption history | Context/build QA and activation STOP; plain key cannot reset marker | General writer rollout/retirement |
| DEVLIFE-PD11 Reset | Data/remote reset preserve device/lifetime; identity reset deferred | Rotate on every data reset | Separate data/remote/device authority | Existing source/generation invalidation retained | Identity-reset UI/data migration |
| DEVLIFE-PD12 Restore | Data only into current authority; never import old lifetime | Import installation identity with data | Avoid rollback/revival and data-owner confusion | Export/restore exclusion tests | Installation clone |
| DEVLIFE-PD13 Migration | Preserve identity on ordinary data migration; explicit protocol on authority migration | Implicit reidentification | Avoid silent namespace changes | Format validation and migration tests | Identity-replacement migration |
| DEVLIFE-PD14 Namespace | Lifetime orthogonal; do not hash lifetime or normalize device case | New namespace on every lifetime | Keep persisted data/request contracts | Namespace/outbox invariance tests | Access to residual namespaces after replacement |
| DEVLIFE-PD15 Writer firewall | No request/outbox/CAS/binding/epoch changes | Unified reader/writer rewrite | Device already participates in delivery identity | Exact vectors and immutable-pending regressions | High-risk writer integration |
| DEVLIFE-PD16 External threat model | DevTools/extensions/profile rollback outside unconditional guarantee | Treat arbitrary rewrites as supported | Local proof cannot infer unobserved restored bytes | Explicit disclosure; fail closed when observed | Security hardening/new trusted authority |
| DEVLIFE-PD17 Physical QA | Edge installed PWA and iPhone Safari Home Screen app required | Unit/CI-only acceptance | Storage/locking/process lifecycle must be observed | Real same-context tabs and lifecycle checks per platform | Cross-device sync claims |
| DEVLIFE-PD18 Lock and availability | Web Locks required; unsupported/unavailable fails closed; no steal/fallback | Memory lock, event-only, lease workaround | Serialized bootstrap/final consumption | Bounded cancellation; no nested authority locks | Alternate mechanism if target fails QA |
| DEVLIFE-PD19 Corruption/destruction | Marker-absent admitted first bootstrap only; marker-retained missing authority and malformed/mismatched metadata fail closed; observed token loss permanent | Blanket missing-state repair; rollout rebootstrap after loss | Distinguish restart admission from observed revocation; disclose joint marker/authority loss limit | Marker-first crash, mandatory-loss and residual-IDB tests; no silent marker reset/data reassignment | Controlled repair, rollback resistance and REL05G5A-001 closure |
| DEVLIFE-PD20 Rollout/approval | Approve complete bundle explicitly; separate reviewed default-OFF implementation and activation | Merge implies approval; foundation implies activation | Prevent acceptance and authority inflation | Approval record, independent reviews, separate activation gate | Public reader/writer activation and G6 |

## 22. Future implementation slices

This approved bounded sequence is `AUTHORIZED_FOR_SEPARATE_IMPLEMENTATION_TASK`, not implementation inside PR #746. Start Slice 1 only after this approval-record update is independently reviewed, final-gated and PR #746 merged into main, under a separate bounded task. All remain default-OFF/no new product reader activation. Each slice requires independent review and its own merge gate; a slice passes only its own reviewed acceptance ceiling.

| Slice | Scope | Frozen boundaries | Required tests | Independent review | STOP condition |
| --- | --- | --- | --- | --- | --- |
| 1: local device authority foundation | Explicit dormant acquisition/transition/final-use primitives; record/marker parsing, evidence-gated locked bootstrap, prepared recovery and advisory token | Existing device string, namespaces, DB/schema/V1, server/request/outbox contracts; no new replacement/reset UI | Concurrent bootstrap, marker-first crash/loss, unchanged capture, real-boundary A1/B/A2, lock ordering, malformed/torn/crash/Storage failure, cancellation, no I/O on import | Architecture-to-code review of storage, admission and transition coverage | No explicit bundle approval; unsupported lock; need schema/backend/writer change; ambiguous recovery |
| 2: shared readers/coordinator and acquisition routing | Range/selected-day/coordinator adoption; source-owned final-use operation; route accepted identity creators with role/output preserved; Home/Search/Previous/Calendar inherit ownership | No extra scans, no partial trust upgrade, four gates false, no delivery changes, existing debt unchanged | Same/other-tab async fences, reader-less partial, generation/account ABA, stale continuation, retry/load, multi-surface, full creator inventory; existing K323/G2/G3/G4 vectors | Independent shared-owner and writer-firewall regression review | Any product creator bypass; caller routing changes frozen delivery/recovery behavior; legacy client admission falsely claimed |
| 3: PR #745 correction | Rebase onto merged prerequisites; comparison remains borrower; guarded synchronous consumption | Exercise S/T/M/P semantics, date/request/enable/close lifetimes, zero new scan, no sibling close | Unobserved and async-gap supported ABA; queued transition order; observed mismatch; view/account/source supersession | Focused rereview of REL05G-EXCOMP-OWNER-001 | Foundation/adoption not merged; tests use only fake transition API; C28 proof missing |
| 4: focused cross-tab and physical QA | Real target browser/installed-app lifecycle, compatible-context admission and exact contract evidence | No activation/Ready/merge/writer/G6 by QA itself | Tab events delayed/absent, concurrent first use, suspend/resume/reload, lock availability, corruption/reset/data-only restore/migration, old-client bypass fail-closed | Independent evidence/activation-prerequisite review | Old identity writers remain accepted; platform lacks lock/storage support; results differ from contract |

If acquisition routing crosses writer semantics, split it into a separately authorized high-risk prerequisite rather than broadening slice 2. If target QA rejects Web Locks availability, return to this decision package; do not quietly substitute a weaker algorithm. No public guarantee is advertised before coexistence admission and physical QA.

## 23. Acceptance matrix

All rows are `REQUIRED / NOT EXECUTED`. They are FUTURE runtime/QA criteria, not documentary PASS results. Prior characterization diagnostics and existing CI do not execute the future authority implementation. `DEVLIFE-C28` below is distinct from existing EXCOMP C28.

| Criterion | Required proof | Status |
| --- | --- | --- |
| DEVLIFE-C01 | Explicitly admitted, creator-quiesced valid legacy installation with authority/marker absent writes adoption marker before prepared/READY, preserves exact case/namespace/entities/outbox, and establishes one lifetime under concurrent callers; retained marker forbids repeat first adoption | REQUIRED / NOT EXECUTED |
| DEVLIFE-C02 | Repeated read/capture/reload/login with unchanged READY authority does not rotate or mutate it | REQUIRED / NOT EXECUTED |
| DEVLIFE-C03 | Every accepted supported creation/recovery/reidentification transition uses owner boundary and fresh non-reused lifetime | REQUIRED / NOT EXECUTED |
| DEVLIFE-C04 | Real-boundary A1 -> B -> A2 without guard observing B permanently rejects A1 publication | REQUIRED / NOT EXECUTED |
| DEVLIFE-C05 | ABA accepted during pre-final async gap fails final publication; transition queued behind shared final-use lock is correctly ordered after consumption | REQUIRED / NOT EXECUTED |
| DEVLIFE-C06 | Same-tab transitions notify locally and fail token/final-use checks without depending on a storage event | REQUIRED / NOT EXECUTED |
| DEVLIFE-C07 | Same-context cross-tab transition fails old final fence even with notifications delayed/disabled | REQUIRED / NOT EXECUTED |
| DEVLIFE-C08 | Reload drops JS publications, preserves coherent persisted authority, and leaves other live tabs correctly fenced | REQUIRED / NOT EXECUTED |
| DEVLIFE-C09 | Every torn-write/crash point is non-publishable; marker-write failure reclassifies persisted state; marker-only gap fails closed without guessed intent; exact prepared intent plus marker resumes under lock with same target, no old-lifetime revival/competing commits | REQUIRED / NOT EXECUTED |
| DEVLIFE-C10 | Malformed/future/mismatched authority/marker fails read/bootstrap closed; retained-marker or non-admitted missing authority fails closed; authority/marker absent in explicitly admitted initial mode permits ONLY defined bootstrap; guards/final fences never repair or fabricate absence | REQUIRED / NOT EXECUTED |
| DEVLIFE-C11 | Account A -> B -> A and logout/login revoke old account owners independently of stable global device lifetime | REQUIRED / NOT EXECUTED |
| DEVLIFE-C12 | Same-ID lifetime rotation preserves namespace hashes, entities, pending payloads and bound delivery records exactly | REQUIRED / NOT EXECUTED |
| DEVLIFE-C13 | Generation change still fails durable scope; unchanged generation cannot revive a retired device lifetime | REQUIRED / NOT EXECUTED |
| DEVLIFE-C14 | Reader-less partial path uses same authority and final-use fence; invalid authority is not current partial or verified-empty | REQUIRED / NOT EXECUTED |
| DEVLIFE-C15 | Retry/load captures new current authority; old continuation cannot invalidate/borrow newer source publication | REQUIRED / NOT EXECUTED |
| DEVLIFE-C16 | Ordinary data reset preserves authority while invalidating affected source; remote reset preserves device lifetime and existing epoch contract | REQUIRED / NOT EXECUTED |
| DEVLIFE-C17 | Product data-only restore does not export/import/replay device authority or admission marker; restored data remains current-namespace scoped | REQUIRED / NOT EXECUTED |
| DEVLIFE-C18 | Data migration preserves authority; approved authority-format migration follows explicit protocol without V1/entity backfill | REQUIRED / NOT EXECUTED |
| DEVLIFE-C19 | Old plain-key creator bypass is not compliant and cannot clear adoption latch through supported behavior; observed mismatch fails closed; public acceptance waits for verified compatible-context admission, coherent READY/marker and QA, not marker/deployment alone | REQUIRED / NOT EXECUTED |
| DEVLIFE-C20 | Request vectors, mutation identity, immutable pending outbox/binding/CAS/digests/receipts, epochs and server locks remain unchanged | REQUIRED / NOT EXECUTED |
| DEVLIFE-C21 | Domain scan counts unchanged; final use adds bounded authority/generation metadata work only | REQUIRED / NOT EXECUTED |
| DEVLIFE-C22 | Physical Edge installed PWA and iPhone Safari Home Screen QA proves relevant storage/lock, suspend/resume, reload and live-context behavior separately | REQUIRED / NOT EXECUTED |
| DEVLIFE-C23 | Multiple Home/Search/Health/Previous/Calendar/comparison consumers share authority; closing/removing one optional view does not close siblings | REQUIRED / NOT EXECUTED |
| DEVLIFE-C24 | Observed invalid authority permanently revokes that token even if old bytes return; raw full rollback is clearly outside supported guarantee | REQUIRED / NOT EXECUTED |
| DEVLIFE-C25 | Missing lock/Storage, write/read error, bounded cancellation or unsupported format yields unavailable without fallback, retry loop, steal or nested-lock deadlock | REQUIRED / NOT EXECUTED |
| DEVLIFE-C26 | Final consumption is synchronous while shared lock held; naked verified boolean/retained DTO/delayed callback cannot authorize later use | REQUIRED / NOT EXECUTED |
| DEVLIFE-C27 | Distinguish admitted marker-absent first adoption, permanently revoked observed-loss token, restart mandatory missing authority with retained marker, and all-metadata-absent fresh creator; test authority-only loss versus joint marker/authority erasure limits; residual IDB remains original-namespace owned, never silently reassigned/cleared/rebound | REQUIRED / NOT EXECUTED |
| DEVLIFE-C28 | Complete production creator/recovery inventory routes through boundary; imports do no I/O; all four reader gates and writer/data-plane activation remain unchanged | REQUIRED / NOT EXECUTED |

Document validation is limited to baseline verification, one-file scope, reference/decision/criterion consistency and `git diff --check`. No new document-specific repository test was found; existing source scans target runtime files or named older documents. Automatic hosted CI is observed at publication, not presented as execution of DEVLIFE criteria.

## 24. Open and deferred decisions

TECHNICALLY_DETERMINED: current authority has no lifetime; observed mismatch is safe; unobserved ABA passes; generation/server epoch is not device lifetime; old plain-key code can bypass a new owner; notifications alone are not final authority; ID/namespace already affect writer semantics.

PRODUCT_POLICY_DECISION: all DEVLIFE-PD01-PD20 recommended selections, including supported creator role, multi-tab guarantee, availability tradeoff, data-only restore, and forward-only authority participation, are `PRODUCT_OWNER_APPROVED` at the revision recorded in section 25. A later change to that bundle requires explicit revision/review and owner approval, not a partial implementation substitution.

MIGRATION_DECISION: admission-evidenced exact-ID bootstrap, sticky marker and representation protocol are approved, including marker-only crash unavailability and unobserved joint-erasure limits. There is no implicit rollout-phase permission. Future identity reset/replacement, malformed-availability repair, clone, residual-namespace access, format migration, and broad destructive recovery remain separately scoped; no guessed historic lifetime or automatic namespace transfer.

SECURITY/THREAT_MODEL_DECISION: unsupported raw/DevTools/extension/profile rollback boundaries are accepted in the approved contract. Local metadata/locks are not tamper-resistant credentials. Expanding to adversarial complete rollback needs a separate trusted-authority design, not another hash or event handler.

TEST/QA_DECISION: requirements for real cooperating-transition acceptance, capability/failure/crash testing, physical Edge/iOS evidence and compatible-context admission before public claims are approved, not executed. Unit mocks and CI alone do not retire old clients or prove installed-app behavior.

Implementation details still subject to independent code review: final module/API names; strict serialization/parser encoding; bounded lock-acquisition budget; test injection of Storage/lock ports; local subscriber disposal; verified version/context rollout evidence. The normative owner, record phases, ordering, final-use lock, firewall and fail-closed semantics are not left optional. Any change to them requires package revision/approval, not an implementation shortcut.

## 25. Owner approval block

Approval status: `PRODUCT_OWNER_APPROVED` for the COMPLETE recommended `DEVLIFE-PD01` through `DEVLIFE-PD20` bundle (20 decisions), including their stated limits and deferred semantics.

- Approved reviewed revision/head: `77221d4eb9dc2946de3a5728892c29272957bd31`.
- Exact product-owner instruction: “DEVLIFE-PD01–PD20 권고 bundle 전체 승인”.
- Approval context/date: explicit human instruction in `REL_05G_WORKOUT_DEVICE_LIFETIME_AUTHORITY_OWNER_APPROVAL_RECORD`, 2026-10-03 (Asia/Seoul), after the focused independent rereview.
- Focused rereview: `REL05G-DEVLIFE-CONTRACT-001 = CLOSED`; verdict PASS; P0/P1/P2/P3 = 0.
- Approved-revision CI: Push `37102313174` and PR `37102316484`, each test/typecheck/build/backend-rel05g1/backend-recovery = SUCCESS. These runs are not evidence for the later approval-record commit.
- Runtime criteria: every `DEVLIFE-C01` through `DEVLIFE-C28` remains `REQUIRED / NOT EXECUTED`; approval, documentary review and hosted CI establish no runtime PASS.

Approved bundle and limits: supported product transitions only; persistent logical record plus plain mirror and sticky admission-only marker; Web Lock serialized transition/final consumption; evidence-gated valid-ID bootstrap; fail-closed marker-only crash and mandatory-mode authority loss; inability to detect unobserved joint admission/authority erasure or full rollback; forward-only participants; data-only restore; deferred identity replacement; unchanged namespace/writer contracts; physical QA and separate activation permission. No rollout oracle, broad recovery or weaker substitute is approved. Approval preserves the deferral of explicit future device replacement, identity-reset UI, installation clone, broad destructive recovery, arbitrary raw Storage/DevTools/extension rollback guarantees, writer integration, public reader activation and G6.

This is contract approval only, recorded from the exact human instruction rather than inferred from merge, CI, prior EXCOMP approval or Draft publication. `REL_05G_WORKOUT_DEVICE_LIFETIME_AUTHORITY_FOUNDATION = AUTHORIZED_FOR_SEPARATE_IMPLEMENTATION_TASK` authorizes preparation of the previously defined bounded sequence, not work inside PR #746. Do not implement Slice 1 until PR #746 is merged into main. Subsequent slices retain their prerequisite ordering, independent reviews and individual merge gates.

Approval does NOT mean runtime implementation exists, any DEVLIFE-C criterion passed, PR #746 is merged, reader activation is allowed, PR #745 is corrected, `REL05G-EXCOMP-OWNER-001` is CLOSED, writer/data-plane changes are allowed, or G6 is authorized. The product-decision blocker is resolved; the owner-integration finding remains `BLOCKED_BY_DEVICE_AUTHORITY_PREREQUISITE`. Public reader activation, high-risk writer work, Ready/merge and G6 require separate authority.

## 26. Frozen boundaries and non-goals

All four gates remain false: `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED`, `HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED`, `HOME_WORKOUT_COMPOSITE_READER_ENABLED`, `SEARCH_WORKOUT_COMPOSITE_READER_ENABLED`.

DB v7, schema v1, stores, indexes, keyPaths, WorkoutSessionV1, canonical persistence, backend/SQL/API, writer, bind, push, pull, full resync, reset behavior and G6 are unchanged. No authority record, epoch, listener, lock, Storage behavior, migration, test or runtime implementation is added by this document. No full-store clear, new domain scan, public reader behavior, or legacy isolation repair is included.

Existing debt remains unchanged:

- Seven live-writer blockers = OPEN: unbound pre-reset create; rollback visibility; old/new writer coexistence; mounted UI identity integration; canonical field ownership; remaining analytics/projection/public claims; reset-fenced local-edit policy.
- `REL05G5A-001 = ACTIVATION_PREREQUISITE`.
- B1 cacheKey P3 = `OPEN_NON_BLOCKING`.
- `LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP = UNRESOLVED`, not an automatic eighth writer blocker.
- `REL05G-EXCOMP-IMPL-001 = CLOSED`; do not reopen its normal/dropset correction.
- `REL05G-EXCOMP-OWNER-001 = BLOCKED_BY_DEVICE_AUTHORITY_PREREQUISITE`; product decision resolved, technical prerequisite unimplemented, finding not corrected or CLOSED.
- PR #745 = `KEEP_DRAFT_BLOCKED`; no correction or metadata mutation here.
- Search PD01-PD10 remain unchanged and outside scope. Existing source-qualified partial/error restrictions remain; no analytics closure or C28 PASS.

Publish this docs-only approval-record update on the existing branch/Draft PR #746 targeting exact verified main; no new PR. Do not mark Ready, merge, enable auto-merge, delete branches, alter #745 or implement/activate authority. Stop after approval-record publication and initial NEW exact-head Push/PR CI observation. Next step is independent focused review of the approval-record update, followed by Final Merge Gate for PR #746 if clean. Only after PR #746 is merged into main may the separate Slice 1 device authority foundation implementation task begin.
