# REL-05G Health parent established-identity recovery contract and product decisions

## 1. Baseline and prerequisite closure

Task: `REL_05G_HEALTH_PARENT_ESTABLISHED_IDENTITY_RECOVERY_CONTRACT_AND_PRODUCT_DECISION_01`.
Correction task: `REL_05G_HEALTH_ID_RECOVERY_CONTRACT_PRODUCT_DECISION_CORRECTION_01`.
Approval publication task: `REL_05G_HEALTH_ID_RECOVERY_CONTRACT_PRODUCT_OWNER_APPROVAL_PUBLICATION_01`.
Status: `CONTRACT_REVIEWED_PRODUCT_DECISIONS_APPROVED_PENDING_APPROVAL_DELTA_REVIEW`.
Evidence date: 2026-10-10. Repository: `Absinthe-6785/Absinthe`; canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`.

| Live prerequisite | Verified value |
| --- | --- |
| Base / current main | `59f69036c461ec649e2d6d1c9a5b2d78e9a2779b` |
| [PR #765](https://github.com/Absinthe-6785/Absinthe/pull/765) | MERGED / CLOSED; reviewed head `aefa82f408eacca3f582e7052ef65386c881c804` |
| PR #765 merge commit | `59f69036c461ec649e2d6d1c9a5b2d78e9a2779b` |
| [Exact-main push CI 38018551230](https://github.com/Absinthe-6785/Absinthe/actions/runs/38018551230) | completed / success: test, typecheck, build, backend-rel05g1, backend-recovery |
| CHARACTERIZATION_STATUS | `CLOSED_IN_MAIN` |
| REL05G5A-001 | `ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION` |
| READER_ONLY_CORRECTION_FEASIBLE | `NO` |
| NON_DESTRUCTIVE_RUNTIME_CORRECTION_FEASIBLE | `CONDITIONAL` |
| RECOMMENDED_POLICY | `F` |
| PRODUCTION_EXACT_ORIGINAL_PROVENANCE_AVAILABLE | `NO` |
| HEALTH-ID-C01 through C15 | `REQUIRED / NOT EXECUTED` |

The [merged characterization](REL-05G-health-parent-established-device-id-correction-characterization.md) is authoritative, including its final classification of eight NEW decisions, three inherited constraints and eight fixed constraints. Its publication closure does not close runtime acceptance. PR #765 synchronized that closed characterization; older pre-merge review/publication states are chronology, not current authority.

The corrected contract at `b26928b06c871ae210a3f116c0af8e4f0fccf2cb` received focused independent `REREVIEW_PASS`; `REL05G-HEALTH-ID-CONTRACT-001 = CLOSED`, with new P0/P1/P2/P3 = `0/0/0/0`. The human product owner subsequently approved all eight reviewed recommended selections on 2026-10-10. This approval publication itself is pending independent approval-delta review, Final Merge Gate, human merge and exact-main verification. No recommendation, review, CI, publication or future merge establishes recovery execution, platform qualification or implementation authorization.

## 2. Scope, non-goals and refreshed source facts

Define controlled, evidence-backed restoration of the **proven exact original** established device identity and retained scope. Do not reinterpret repair as allocation of a plausible new identity. No recovery API, routing, support/admin tool, physical procedure, UI, storage access to real user data, migration, source/test/config/backend change or activation is included.

The baseline source was inspected, not merely inferred from the earlier nine-site count. Excluding tests, there are nine direct production helper call sites across six groups; helper delegation, reexports, injected port invocation and raw-key guards are separately accounted for:

| Group / source | Identity acquisition and late-use facts |
| --- | --- |
| [Local helper](../src/lib/workoutLocalReaderAuthority.ts) | Defines `absinthe-health-routine-device-id:v1`; creator writes a generated UUID when existing bytes fail its format check. Established-reader helper rejects established invalid bytes, delegating creation only for `null`. Neither helper grants recovery provenance. |
| [Routine writer](../src/lib/healthRoutineSync.ts) | One direct creator at line 830; per-account `productionSession` caches a Promise, including success, rejection and in-flight creation. The device is captured before asynchronous repository open; snapshot, reset, recover and sync share this factory. No factory eviction policy proves recovery safe. |
| [Runtime authority](../src/lib/workoutRuntimeAuthority.ts) | One direct creator in production ports at line 177; controller invokes the port, reads the raw mirror separately and fences its own attempts/account. Cancellation is not global writer retirement. |
| [Selected-day reader](../src/lib/workoutSelectedDayReader.ts) | One established-helper call on open; captures device/namespace and checks active generation. Persisted mismatch mapping remains the #763 contract. |
| [Range reader](../src/lib/workoutRangeReader.ts) | Three established-helper calls: open, pre-use and post-read. A final helper call can create on missing bytes; it cannot be repurposed as a non-creating recovery probe. |
| [Selected-day owner](../src/components/views/features/health/useHealthSelectedDayComposite.ts) | Two established-helper calls for reuse and final publication; request/mount/account/date checks do not prove unseen device ABA or global lifetime retirement. |
| [Range owner](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts) | One established-helper call plus raw-key checks at start, reuse, verification and publication. Owner sequence invalidation is local, not proof that all old contexts are excluded. |
| [Dormant lifetime foundation](../src/lib/workoutDeviceLifetimeAuthority.ts) | A second mirror-write implementation, distinct from the helper; authority/adoption/prepared/READY validation. No current product caller routes through it. Its creator-recovery generates a new target; it is not Policy F exact-original recovery. |
| [Remote client](../src/lib/workoutRemoteClient.ts), [push](../src/lib/workoutRemotePush.ts), [pull](../src/lib/workoutRemotePull.ts) | Raw mirror reads fence captured request context. They are not original-ID issuers or acquisition writers; no pull-based push acknowledgement or rebase may be added. |

The inventory also includes production writer fan-in from Health save/online paths, Settings snapshot/reset, note/export snapshot and vault recovery. An apparently read-only export/snapshot can create the cached writer session. Pure helper imports/reexports do not perform identity I/O; a future routing change must retain that property and cover factory and final-use calls below removable surfaces.

[Namespace](../src/lib/localDatabase/namespace.ts) fingerprints exact `[userId, projectRef, deviceId, schemaVersion]`; case changes alter the fingerprint. Generation is separate, not part of that hash. Helper-format acceptance and namespace safety are both required for an existing compatible identity: a safe non-UUID value accepted today must remain exact; an all-hyphen helper-accepted value is namespace-unsafe and cannot become a recovery target. No trim, case fold, alias, hash-derived device ID or strict historical UUID migration.

[Repository](../src/lib/localDatabase/repository.ts) initialization can create missing namespace metadata/generation; normal open can create/upgrade a database. A successful empty newly initialized scope is not historical reachability evidence. [Schema](../src/lib/localDatabase/schema.ts), [types](../src/lib/localDatabase/types.ts) and [outbox identity](../src/lib/localDatabase/outboxIdentity.ts) freeze DB 7/schema 1 and namespace/generation-dependent immutable identity. This contract requires a separately reviewed non-creating inspection capability; it does not claim that current open/initialize APIs already supply it.

## 3. Authoritative inherited and fixed constraints

The following current merged documents were read as authority, not as proof of new recovery execution:

- **AUTH**: [device-lifetime authority contract and plan](REL-05G-workout-device-lifetime-authority-contract-and-plan.md), sections 9-10, 20-21 and 25: exact compatible established IDs/case, role-restricted acquisition, writer firewall and complete-bundle approval.
- **ADMIT**: [bootstrap-admission prerequisite](REL-05G-workout-device-lifetime-bootstrap-admission-prerequisite.md), sections 10, 12-13: conditional admission, deferred assisted support, non-waivable constraints and review/merge/main gates.
- **ER**: [admission evidence and writer-safe routing characterization](REL-05G-workout-device-lifetime-admission-evidence-and-writer-safe-routing-characterization.md), sections 8 and 10: current ownership/cached writer premises, ER-PD01-PD03 investigation ceiling and writer STOP. Investigation approval is not a production assisted procedure.
- **PARENT**: [selected-day/range parent public readiness](REL-05G-health-selected-day-range-parent-public-readiness-characterization.md): public activation and established-ID recovery remain prerequisites, not closed by preview tests.
- [Selected-day integration prep](REL-05G5B2B-product-reader-integration-prep.md), [reader expansion prep](REL-05G5B2B2-product-reader-expansion-prep.md) and [consumer integration prep](REL-05G5B2B2B-consumer-integration-prep.md): qualified local source truth, isolation, currentness, bounded scope and default-OFF ceilings.

Sections 13 and 14 enumerate the disjoint inherited/fixed sets and trace them to acceptance. No DEVLIFE-PD14, admission evidence envelope or writer-firewall reapproval is requested. New product decisions may narrow support/investment, not waive these constraints.

## 4. Policy F exact recovery contract

Policy F remains the minimum defensible non-destructive recovery direction: only `PROVEN_EXACT_ORIGINAL_ID`, actual original scope and proven writer safety permit a recovery attempt. Otherwise preserve storage and deny/escalate. A typed unavailable result is truthful failure, not successful correction. Choosing Policy F does not create the currently missing proof source.

### 4.1 Conceptual episode and common invariants

A future reviewed recovery episode must bind the exact target bytes, authenticated provenance reference, original origin/storage partition, account/project and affected namespace/generation set, observed corrupt/missing mirror classification, source transition/currentness fence, admitted evidence scope if used, consent and immutable pre-recovery inventory. An audit reference must not expose raw personal histories or credentials. This is a conceptual contract, not a new API, record format, storage key, store or issuer implementation.

All phases revalidate the current episode before and after asynchronous work and at the mutation/publication boundary. A newer account, device lifetime, generation, consent withdrawal or competing transition invalidates the old permit. Re-entry cannot silently widen a permit or infer it from mirror equality. Exact bytes returning in A -> B -> A do not restore an old lifetime. Failure preserves domain/pending bytes, withholds canonical success/empty claims and records which premises remain unproven; it never calls a creator fallback. Same episode + same authenticated target is idempotent; different target or unknown progress is not a retry.

The phase list describes logical obligations, not permission to delay revocation until phase 9. **PREPARE must invalidate affected old publications before any mirror/authority mutation**. Phase 9 verifies that invalidation remained effective and rejects late completions; no old-to-new publication gap is allowed. Revocation must be owned below removable UI and cover both selected-day and range, not only one mounted component. New source publication remains withheld until final verification; revoked tokens are never reinstated, even on failure.

### 4.2 Phase obligations

Each row specifies inputs/trust, preconditions, mutation and writer limits, currentness/audit, and failure/idempotency. Section 7 is an additional gate, not an optional implementation detail.

| Phase | Inputs / trusted source / preconditions | Permitted versus forbidden mutation; writer interaction | Currentness / audit / idempotency / failure |
| --- | --- | --- | --- |
| 1 DETECT | Authenticated read context; non-creating mirror read with errors distinguished from null; trusted reader error classification | Classification only; no creator invocation, mirror write, repository initialization or writer cancellation | Capture error category and observation fence without unnecessary raw bytes; stale observation discarded. Repeated unchanged read is the same failure, not repair. Storage error -> transient/durable classification, never guessed missing. |
| 2 CLASSIFY | Established-invalid/namespace-unsafe versus missing versus compatible identity; helper AND namespace predicates; current source state | No normalization or replacement; leave current creator semantics unchanged in this task; route a future recovered candidate only through separately approved transition | Recheck account/origin and observation; audit classification/rule version. Existing compatible path is not recovery; ambiguous classification stops, repeated classification does not allocate. |
| 3 ESTABLISH_PROVENANCE | Independently authenticated historical issuer evidence satisfying section 5; unique exact original candidate | Verify evidence only, not local candidate-as-issuer or user memory promotion; no writer authority or domain writes | Bind issuer/episode/expiry/scope/target, reject stale/corrupt/multiple candidates. Same valid evidence is reusable only within its exact permit. Missing source -> unsupported/evidence escalation. |
| 4 ESTABLISH_SCOPE_REACHABILITY | Proven target plus non-creating original namespace/meta/generation/data inventory under authorized inspection | Read exact existing scope; no create/upgrade/init, scanning-to-choose, copy, historical generation activation or outbox edits | Compare exact fingerprint, active generation and ownership scope; audit manifest of expected reachability and immutable pending state. Failure/foreign payload stops, not empty. Repeat must agree or require a new episode. |
| 5 ESTABLISH_WRITER_SAFETY | Complete relevant creator/factory/cache/in-flight/transport inventory, authenticated coordination/lifecycle premises and unsaved-work ownership | Demonstrate exact behavior continuity; no guessed quiescence, cache deletion, queue drain, forced logout or broad cancellation | Validate old/new ownership and suspended-context fences; audit admitted evidence and limits. Unproven preservation -> STOP pending further proof/design, not semantic change YES. Only an actually required frozen writer/control-contract change triggers a separately authorized high-risk prerequisite. Rechecks do not mint authority. |
| 6 PREPARE_RECOVERY | Sections 5-7 satisfied; explicit consent; separately reviewed crash intent/representation and approved transition | Durably bind one exact original target and allowed progress, invalidate old publications before writes; only approved control metadata changes, no domain/pending mutations | Recheck source fence and permit; audit intent, consent, revoked token/transition reference. Prepare is idempotent for that intent only. Failure before durable preparation makes no identity change; uncertain preparation fails closed. |
| 7 COMMIT_EXACT_ORIGINAL | Current durable intent, exact original bytes, still-valid scope/writer/evidence permit | Restore mirror only to frozen exact original; authority/marker/lifetime changes solely under the separately reviewed inherited-compatible protocol in section 7.2; never new device allocation | Fence/read-back every allowed control write; audit actual progress. No localStorage/IDB cross-store atomicity claim. Partial failure remains incomplete; resume exact intent or stop, no new target/old lifetime revival. |
| 8 VERIFY_REOPENED_SCOPE | Read-back exact target/control state plus original preflight inventory; non-creating reopen | Read/compare scope and pending records; no repair-by-init, domain copy, rebind, ACK, rebase, reset or generation switch | Verify section 6 fully, including selected-day/range equivalence and no orphaning. Audit results without granting public activation. Mismatch/failure is not recovered; rerun verification only on unchanged valid intent. |
| 9 INVALIDATE_OLD_PUBLICATIONS | Evidence that phase 6 revoked all affected old tokens; source/current lifetime and reader request fences | Verify old async completions cannot publish; stale completions discarded. Do not newly invalidate too late or restore old READY/publications | Audit selected-day/range/account/date/generation/ABA negative checks. Any surviving old publication blocks completion. Verification repeats cannot authorize old token reuse. |
| 10 COMPLETE / FAIL_CLOSED | All proofs, writer continuity, exact scope verification, revocation and consent still current | Complete control intent/audit only within reviewed protocol; no data-plane operation. Failure never fabricates success or automatically rolls back to old lifetime | Emit `RECOVERED_EXACT_ORIGINAL` only for verified declared scope; same completed intent returns same result without extra identity/lifetime. Otherwise typed failure, evidence and explicit escalation; new read requires fresh current token and existing activation authority. |

## 5. Exact-original provenance contract

`PRODUCTION_EXACT_ORIGINAL_PROVENANCE_AVAILABLE = NO`. No inspected helper, cached session, namespace metadata, outbox, authenticated Supabase account or dormant authority establishes an independently authenticated historical original device identity. Current malformed bytes can describe the problem, not certify their replacement. The characterization's TEMP fake-storage/IDB probes establish mechanism behavior only, not production provenance or a physical procedure.

`PROVEN_EXACT_ORIGINAL_ID` requires all of the following from a **separately reviewed trustworthy source**, not a source invented here:

1. Authenticated issuer and evidence integrity independent of the recovery candidate and currently corrupted mirror. Verification must establish issuer authority and anti-tamper/anti-replay properties, not merely a caller-supplied boolean or signature from an untrusted key.
2. Historical binding of the exact original device bytes/case to the same origin, storage partition/profile, project and affected account/namespace history **before** corruption. Newly recording a guessed ID cannot establish that history retroactively.
3. Uniqueness and consistency against retained namespace/generation evidence. A fingerprint match can corroborate a proven candidate but cannot select original ownership by itself. Multiple candidates, absent history, rollback, unauthenticated backup or inconsistent bindings fail closed.
4. A current, narrowly scoped recovery permit with issuer/build/protocol/evidence references, episode freshness/expiry/invalidation, consent and an auditable verification chain. Exact original bytes may be historical; permission to act now must be current. No permanent universal platform certificate.
5. Sufficient coverage of all device-sharing affected scopes. An authenticated single account is not proof of ownership of every account sharing an origin-wide device mirror. Do not expose or reassign another account's payload while investigating.
6. Privacy/security review of collection, storage, retention and operator access. Never publish auth tokens, raw local histories or full recovery credentials in PRs/logs. Source issuance, keys and recovery record representation remain unimplemented design prerequisites.

Rejected as **sole proof**: malformed mirror bytes; one populated namespace; matching account alone; matching generation alone; outbox deviceId alone; user memory alone; localStorage backup without authenticated provenance; timeout; no visible old tab; Web Lock possession; `compatibleCreatorsQuiesced=true`; deployment timestamp; app version alone. Authenticated account/session ownership does not imply exact original device provenance or creator retirement.

The [Web Locks specification](https://w3c.github.io/web-locks/) describes coordinating cooperating execution contexts through a storage-bucket lock manager. It does not certify a historical device ID or that nonparticipating/restored old creators are absent. Lock acquisition is at most one coordination mechanism inside a separately proven admission episode, never the issuer or evidence substitute.

No currently trustworthy authoritative proof of **absence of all retained old scope** is established either. A failed lookup, inaccessible IDB, empty current query, scan returning no visible rows or unique namespace is insufficient. Therefore the recommended new-target policy in section 11 is A, not the characterization's conditional generated-UUID option for an independently supported no-residual branch. This narrows proposed investment without changing Policy F, inherited historical syntax or runtime behavior.

## 6. Reachability and no-orphaning contract

Before preparation, establish a non-creating inventory of the proven exact original namespace(s) and the specific retained histories being claimed. Current repository open/initialize must not be mistaken for this capability: creating a fresh empty namespace would manufacture the apparent verification result. If non-creating inspection cannot establish existence, stop. No new store/keyPath/index/schema is authorized to implement this requirement here.

After mirror/control commit and before reporting success, require:

- Exact expected namespace fingerprint reopened, not a new fingerprint computed from replacement/normalized device bytes; expected metadata, current active generation and ownership agree with preflight.
- Declared current canonical sessions, local-only sessions and tombstone evidence are reachable exactly as expected. Tombstones stay deleted, not restored as active sessions. Historical generation bytes are preserved; access to historical generations is a separately deferred support claim, never implicitly supplied by active-generation reads.
- Expected pending/unbound/bound/claimed/retry/conflict/acknowledged outbox, dependencies, payload/hash, mutation/idempotency identities, delivery binding, request digest, CAS base, epoch, receipts and checkpoints remain identical **as a recovery action**. No duplicate send/drop, pull ACK, rebase or replay to a new scope.
- Conflicts, checkpoints, metadata and other retained scopes are not cleared/copied/reassigned. Compare a stable preflight baseline under proven ownership/coordination. Normal writer progress may occur only under existing legitimate semantics with attributable evidence; an unexplained difference is not waved away as concurrent progress. If a stable/proven comparison would require new draining/freezing/cancellation, section 7 STOP applies.
- Selected-day and range reads for the same applicable context agree on account/project/device/namespace/current generation and local completeness. Different date/range requests are not forced to report identical content. No old request, captured account/date/generation, observed identity transition or A -> B -> A lifetime can publish after revocation.
- No foreign-account payload exposure, newly orphaned retained scope or hidden canonical history represented as verified empty. Revalidate current account/device/lifetime/generation and consent at completion; a mid-flight change invalidates the permit.

If exact mirror restoration succeeds but IDB verification fails, recovery remains incomplete/failed, not successful because bytes were preserved. Do not automatically undo the mirror into an old READY lifetime, switch generation to make rows visible or initialize away a failure. Return a truthful failure with deterministic intent progress and escalation. Completion confirms only the selected supported local scope, never cloud completeness, universal history recovery or public activation.

## 7. Writer-transition contract and mutation envelope

### 7.1 Baseline assessment and per-path obligations

The current evidence supports three distinct states, not a mandatory writer-transition conclusion:

- `WRITER_CONTINUITY_STATUS = NOT_YET_PROVEN`.
- `WRITER_SEMANTIC_CHANGE_REQUIRED = NOT_ESTABLISHED`.
- `SEPARATE_HIGH_RISK_WRITER_TRANSITION_PREREQUISITE_REQUIRED = CONDITIONAL`.
- `EXECUTABLE_RECOVERY_WITH_UNPROVEN_WRITER_CONTINUITY = BLOCKED`.

Relevant behavior preservation is not proven, and the current creator/factory path is not a reviewed exact-original recovery route. Unproven preservation requires STOP pending further evidence/design; it does not prove that a semantic change is necessary. No same-ID retention path is proven safe, and no writer-semantic change is proven necessary. This is neither `PROVEN_SAFE` continuity nor a `NO` finding that changes are unnecessary.

A later separately evidenced exact-same-ID case must demonstrate every applicable obligation without assuming cache eviction, session recreation or cancellation. If unchanged-semantics continuity is proven, this specific high-risk prerequisite is not triggered merely by Policy F. If the selected route actually requires changes to writer availability, cache/rejected-Promise/retry/readiness/recovery/reopen, identity, binding/digest/CAS, receipts, transport, epoch, shutdown/drain, unsaved work or a frozen control contract, STOP for a separately authorized high-risk prerequisite. This package authorizes neither such changes nor a writer-firewall waiver.

Every row's present proof state is for the proposed recovery episode, not a claim that ordinary production operations have changed. An actual-change trigger is conditional; listing it is not evidence that it is required.

| Writer / owner state | Preservation condition | Current recovery proof state | Actual change trigger / consequence |
| --- | --- | --- | --- |
| `healthRoutineSync productionSession`, cached success | Captured repository/device/worker and namespace remain the proven exact original; all operations, ownership and availability remain valid | NOT_YET_PROVEN; a matching cached session is a candidate for continuity proof, not proof itself. Key repair does not change its captured device. | Required eviction, recreation, reopen/rebind or cache/ownership/availability change -> separate high-risk prerequisite. A differing captured scope stops recovery; do not assume replacement is the solution. |
| Cached rejected Promise | Existing rejection/cache/retry semantics remain unchanged; any renewed acquisition is separately assessed | NOT_YET_PROVEN; current factory retains rejection. A desired successful retry does not establish unchanged continuity. | Required eviction/retry or changed rejection/availability semantics -> high-risk prerequisite, not ordinary reader Retry. |
| In-flight session creation | Captured-before-await identity and late repository completion remain owned by the current episode; no superseded session installs | NOT_YET_PROVEN; blanket cancellation/reload is not ownership proof. | Required race, installation, cancellation or factory ownership change -> separate high-risk prerequisite. |
| Runtime authority controller | Attempt/account cancellation and READY/open semantics remain exact, with no assumed control of routine factory | NOT_YET_PROVEN; local controller cancellation does not retire other writers. | Required readiness denial, retry, recovery/reopen or identity-routing semantic change -> high-risk STOP. |
| Snapshot / export | Potential first session creation and late snapshot use stay exact and immutable | NOT_YET_PROVEN; Health/Settings/note export fan-in participates. Hiding an editor cannot exclude these creators. | Required snapshot drain, new denial or late-owner/session change -> high-risk prerequisite. |
| Reset | Existing reset/generation/epoch fences and pending work remain unaffected; no reset is used to repair mirror | NOT_YET_PROVEN for recovery continuity; reset is not a fallback proof. | Required reset, generation, epoch or reset-transport change -> separately authorized reset/writer prerequisite, outside this Policy F envelope. |
| Recover / vault restore | Existing session acquisition, restore mutation ownership and late completions remain exact | NOT_YET_PROVEN; vault import/adoption/copy is neither original proof nor recovery fallback. | Required restore/recovery/acquisition semantic change -> separate high-risk authorization. |
| Online sync | Worker identity, claims/leases, retries and auth account fences remain valid | NOT_YET_PROVEN; existing worker operation alone does not qualify a recovery episode. | Required new blocking, draining, cancellation or worker/repository replacement -> high-risk prerequisite. |
| Remote push | Bound requests retain exact bytes/digest/CAS/lease/context; no send under a new scope | NOT_YET_PROVEN; raw mirror guard alone is not a complete recovery permit. | Required identity, binding, digest, CAS, lease or transport change -> high-risk prerequisite. Do not edit requests to make them pass. |
| Remote pull / resync | Account/epoch/checkpoint/conflict and own-echo rules remain unchanged | NOT_YET_PROVEN; no pull-based push ACK, auto-rebase or reset/full-resync as repair. | Required transport/recovery/epoch/ACK or rebase semantic change -> separate high-risk prerequisite, not a waiver of the frozen contract. |
| Pending unbound outbox | Mutation identities/payloads/dependencies/status stay unchanged; future normal binding still targets exact original scope | NOT_YET_PROVEN; namespace reassignment would change identity, not establish continuity. | Required drop, recreation, move, reassignment or new-device rebind -> high-risk prerequisite; preserve original work. |
| Claimed/bound request, retry/conflict | Exact claim/lease/request/receipt relationship remains valid through the approved episode | NOT_YET_PROVEN; guessed lease expiry or rewriting claimed work is not proof. | Required retry/release/queue, claim or request-relationship change -> high-risk prerequisite. |
| Receipts / checkpoints | Immutable acknowledged evidence, epoch and sequence semantics remain valid under original scope | NOT_YET_PROVEN; acknowledged evidence does not by itself prove recovery continuity. | Required recovery-related checkpoint rewind/advance, receipt or own-echo semantic change -> separate high-risk prerequisite; no fabricated receipt or weakening here. |
| A -> B -> A, sign-out/account changes, late async | Source-owned lifetime/transition and account/request fences reject old completion even if mirror bytes equal again | NOT_YET_PROVEN; byte comparison cannot dismiss unobserved ABA. Forced logout/app restart does not prove retirement. | Required new writer lifetime, account/readiness, shutdown or late-work behavior -> separate high-risk prerequisite; additional proof alone is not that change. |
| Cross-tab, hidden/suspended/restored contexts | Complete relevant creator participation/exclusion and re-entry premises are truthfully qualified | NOT_YET_PROVEN; no visible-tab inventory, timeout, Web Lock or checkbox suffices. Unproven coexistence -> STOP pending evidence. | Required creator/writer participation, denial or ownership semantic change -> separate high-risk prerequisite plus relevant evidence; qualification alone is not a writer change. |
| Unsaved mounted work | Current owner and disposition remain unchanged and disclosed | NOT_YET_PROVEN; silent discard/cancel-all does not prove preservation. | Required new save/discard/availability or unsaved-work ownership policy -> separate high-risk scope. |

Do not silently solve any row with deleting `productionSession`, recreating repository, reloading the page, forcing logout, draining queues or cancelling all work. Read-side stale-publication invalidation required by this contract must not be conflated with changing writer readiness or cancelling writer work. Unresolved continuity remains STOP pending further proof/design. If the needed fences actually require writer behavior changes, obtain the separately authorized high-risk prerequisite; do not implement them under a reader-only label.

### 7.2 Future mutation permissions, not permission in this task

| State | Conservative future Policy F envelope |
| --- | --- |
| Legacy device mirror | May be restored **only** to the frozen proven exact original bytes/case, after approved safe transition and read-back. No generated replacement, alias or canonical hash as device target. |
| Device-lifetime authority record | Only a separately reviewed transition conforming to inherited admission/currentness/record validation may change control state. No direct READY injection or ad hoc record kind. |
| Adoption marker | Only inherited-compatible protocol, where genuinely admitted; never erase/reset to regain legacy adoption or claim fresh install. If exact-original recovery cannot be expressed safely, STOP for a separately reviewed control-contract prerequisite. |
| `lifetimeId` | No old lifetime resurrection. A new lifetime for the same device is not a new device; it may be allocated once only under approved authority protocol and frozen recovery intent, never per retry. No lifetime change outside that protocol. |
| Namespace metadata / active generation | Immutable as recovery action; no initialize, switch, owner/generation reassignment or fabricated fresh scope. |
| WorkoutSessionV1 / tombstones | Immutable; no restore/adoption/copy, rewrite, canonical field ownership change or projection migration. |
| Outbox / bindings | Immutable pending identity, payload/hash/dependency/digest/CAS/status/binding; NO MOVE / COPY / REBIND / REASSIGN. |
| Checkpoints / conflicts / receipts | Preserve exact evidence; no clear, fabricated ACK, recovery-related replay/rebase or sequence change. |
| Remote state | No backend/API/auth/RLS/schema/data mutation; no automatic bind/push/pull/resync/reset. |

The dormant lifetime foundation has closed prepared kinds (`legacy-adoption`, `fresh-create`, `creator-recovery`); creator-recovery is role-restricted and allocates a new UUID for malformed/missing acquisition. It does **not** take an independently proven exact-original recovery target and is not Policy F. Do not misuse this route, accept a namespace-unsafe target, invent a compatibleCreatorsQuiesced assertion, remove an adoption marker or bypass its parser to implement F.

`EXACT_TARGET_CONTROL_PROTOCOL_REQUIRED = FUTURE_SEPARATELY_REVIEWED_DESIGN / NOT_IMPLEMENTED`. A future exact-target intent/control representation requires separately authorized inherited-compatible design and review. That missing protocol is not, by itself, proof of a required writer-semantic change. Assess the concrete proposal against the frozen control contract: an actually required frozen control-contract or writer-semantic change triggers the separate high-risk prerequisite; unresolved compatibility still stops execution pending proof/design. None is implemented or approved by these eight product recommendations. A DB/schema change would require a new scope and STOP.

### 7.3 Relationship to the seven live-writer blockers

| Existing blocker | Relationship to proposed recovery | Status / boundary |
| --- | --- | --- |
| Unbound pre-reset create | INDEPENDENT of exact mirror restoration; WOULD_REQUIRE_SEPARATE_CLOSURE if reset/binding semantics are touched | OPEN; no rebind or reset activation. |
| Rollback visibility | OVERLAPS old/restored-context fencing | OPEN; recovery qualification must not claim global rollback safety. |
| Old/new writer coexistence | BLOCKED_BY relevant creator/currentness evidence for an executable recovery | OPEN; scoped proof is required, not automatic global blocker closure. |
| Mounted UI identity integration | OVERLAPS source identity/currentness and unsaved work | OPEN; no editor activation or cancel/discard policy. |
| Canonical field ownership | INDEPENDENT | OPEN; no canonical fields changed. |
| Remaining analytics/projection/public claims | OVERLAPS truthful bounded reader results | OPEN; local recovery success is not remaining projection/analytics closure. |
| Reset-fenced local-edit policy | INDEPENDENT while reset/local-edit semantics remain untouched; WOULD_REQUIRE_SEPARATE_CLOSURE if relied upon or changed | OPEN; cannot use reset as a repair escape. |

No eighth live-writer blocker is automatically created. Unproven continuity is a bounded STOP pending proof/design; a separate high-risk prerequisite is conditional on an actually required frozen writer/control-contract change, not automatically triggered by Policy F. Document or future recovery closure closes none of these seven by implication.

## 8. Crash and idempotency requirements

The future durable intent must freeze exact target, verified provenance/permit, affected source fence, allowed control progress and audit identity. Its representation and resume mechanism need independent review. Existing localStorage authority writes and IndexedDB writes are not one atomic transaction. No new store/schema or pseudo-transaction is invented here.

| Interruption / retry | Required deterministic behavior |
| --- | --- |
| Crash before prepared state | No identity mutation; detect/classify again without allocating. If preparation outcome is uncertain, inspect verified control progress, not assume no work. |
| Crash after revocation, before mirror update | Old publications remain invalid. Resume exact durable intent only if permit/currentness still valid, otherwise fail closed. Never resurrect old lifetime to make UI available. |
| Crash after mirror update, before authority READY | Preserve known exact-target partial progress; no public success. Resume same admissible control transition or stop. Mirror equality alone cannot recreate missing intent/permit. |
| Storage write failure | Record actual completed/uncertain control steps and classify failure. No creator fallback, repeated new UUID, storage clearing or assumed all-or-nothing rollback. |
| Storage read-back mismatch | Durable failure/competing transition; do not overwrite observed newer bytes or report recovery. Escalate evidence/storage integrity. |
| IDB open/verification failure | No success/empty claim, create/upgrade/init/copy or generation switch. Known mirror commit remains incomplete and auditable; investigate non-destructively. |
| Repeated operator action | Same authenticated intent yields same target/progress/result; no duplicate transition, new lifetime per click, domain mutation or send. Different/missing evidence is not the same action. |
| Retry after partial progress | Revalidate original intent, provenance, consent and currentness; permit may expire. Exact deterministic resume or explicit fail closed; a fresh permit may require a separately reviewed continuation, never infer from bytes. |
| Conflicting newer transition | Old episode is permanently invalid; never overwrite newer state or roll it back into old READY. New investigation must own a new explicitly verified episode. |
| Second tab attempting recovery | Serialize participating actions under verified ownership and intent; lock alone is insufficient. Same intent may observe/resume under valid protocol; competing intent denied. Unqualified old contexts -> STOP. |
| Restored old tab after recovery | Old lifetime/publications cannot regain ownership from equal bytes. Qualified re-entry must reacquire current authority; old bypass builds invalidate the support claim and require STOP/evidence qualification. High-risk escalation applies only if an actual frozen writer/control-contract change is required. |

Rollback means a separately reviewed safe control outcome, not restoration of an old revoked lifetime or rollback of domain data. Resume/fail-closed rules must preserve supported read reachability and demonstrate eventual completion for every claimed supported case. Perpetual failure with better copy is not HEALTH-ID-C10 acceptance.

## 9. Conceptual public result taxonomy and source truth

Names below are contract vocabulary only, not new TypeScript/UI implementation. Public outcomes must stay distinct from transport/bootstrap errors and legacy-cache freshness. Public activation remains unauthorized even after a future local recovery result.

| Outcome | Truth and source/public behavior |
| --- | --- |
| RECOVERED_EXACT_ORIGINAL | All section 6 checks and writer/intent/currentness checks pass for the declared supported scope; new source read can use fresh tokens under existing authority. Local completeness only; empty is allowed only from a successfully verified, complete applicable query, not from recovery itself. |
| RECOVERY_REQUIRED | Established identity cannot safely open retained canonical scope; preserve bytes and suppress canonical absence claims. Explain need for justified correction, not cloud/bootstrap Retry. |
| RECOVERY_UNSUPPORTED | Outside selected support envelope or no currently qualified procedure; non-destructive escalation, not verified empty or a repair-success state. |
| RECOVERY_PROVENANCE_AMBIGUOUS | Missing/multiple/inconsistent ownership proof; no target selection. Withhold canonical payload and disclose uncertainty. |
| RECOVERY_WRITER_SAFETY_UNPROVEN | Safe current ownership/immutable work cannot be demonstrated; STOP pending further continuity proof/design. This result alone does not establish required semantic change. A separately authorized high-risk prerequisite is required only if an actual frozen writer/control-contract change is needed. No queue drain/cancel-all offered as routine guidance. |
| RECOVERY_PHYSICAL_EVIDENCE_REQUIRED | Claimed operating mode/episode premise lacks qualification; procedure unavailable for that scope pending evidence, not universally certified by another platform. |
| RECOVERY_FAILED_TRANSIENT | Storage/DB availability failure is plausibly transient under a valid read episode; one bounded manual read Retry may be offered under PD08-A, never automatic identity repair. |
| RECOVERY_FAILED_DURABLE | Deterministic bytes, integrity/read-back/reachability or partial-transition failure; preserve known progress and deny unchanged retry-to-success. Escalate with audit reference. |

Preserve #763 exactly: `ACCOUNT_MISMATCH`, `NAMESPACE_MISMATCH`, `GENERATION_MISMATCH` -> typed isolation; `UNTRUSTED_SCOPE` -> `INVALID_CONTEXT`; trusted-scope invalid content -> ordinary source failure. Ordinary failure may retain independently qualified legacy partial; persisted scope distrust withholds both, and a healthy legacy source cannot waive canonical distrust. Partial calendars remain unknown rather than absence/zero. Do not create a broad recovery error that erases these distinctions.

No copy promises hidden canonical data is absent, synced elsewhere or recoverable from cloud. Warn against clear-site-data, database deletion, reinstall, profile/origin switching and console/localStorage edits; these can destroy access even when some bytes persist. Later EN/KO/JA wording, keyboard/screen-reader announcements, focus behavior and supported physical-mode QA are separate acceptance, not completed here.

## 10. Approved policy support-scope ceiling

Every recovery classification below is an **approved product-policy ceiling pending approval-publication review/canonical closure, separately authorized implementation and proof**. It is not currently offered support. `SUPPORTED_IF_PROVEN_ORIGINAL_EXISTING_SCOPE_WRITER_CONTINUITY` means all sections 5-8 and applicable acceptance/evidence are satisfied. Continuity proof is always required; any actually needed frozen writer/control-contract change additionally requires a separately authorized and closed high-risk prerequisite. Unproven continuity alone does not establish that change. No premise is assumed true today.

| Retained history / identity | Policy classification (not runtime availability) | Exact limit / reason |
| --- | --- | --- |
| 1 Proven original + existing original namespace + current active generation | SUPPORTED_IF_PROVEN_ORIGINAL_EXISTING_SCOPE_WRITER_CONTINUITY | Restore exact compatible target, reopen existing metadata/active generation, verify declared current canonical scope; no newly initialized scope. |
| 2 Original namespace with historical generations | DEFERRED for historical read recovery | Preserve all bytes/metadata and verify no orphaning; current active-generation access does not promise historical generation selection/access. Broader access is a separate support/migration design. |
| 3 Tombstones | SUPPORTED_IF_PROVEN_ORIGINAL_EXISTING_SCOPE_WRITER_CONTINUITY | Tombstone evidence remains reachable/identical and deleted; no resurrection or inference that deleted rows are active sessions. |
| 4 Local-only unsynced sessions | SUPPORTED_IF_PROVEN_ORIGINAL_EXISTING_SCOPE_WRITER_CONTINUITY | Current-generation local history must actually be readable; no cloud or cross-device completeness promise. |
| 5 Pending unbound outbox | SUPPORTED_IF_PROVEN_ORIGINAL_EXISTING_SCOPE_WRITER_CONTINUITY | Exact original namespace, mutation/payload/hash/dependencies/status unchanged; future normal binding unchanged, no recovery binding. |
| 6 Bound/claimed/retry outbox | SUPPORTED_IF_PROVEN_ORIGINAL_EXISTING_SCOPE_WRITER_CONTINUITY | Exact request/digest/CAS/binding/lease/receipt continuity proven; otherwise UNSUPPORTED/STOP pending proof/design. Only an actually required semantic change triggers separate high-risk authorization/closure; work is not rewritten to fit. |
| 7 Conflicts/checkpoints | SUPPORTED_IF_PROVEN_ORIGINAL_EXISTING_SCOPE_WRITER_CONTINUITY | Preserve exact epoch/sequence/candidate/ack evidence; no rewind/replay/clear as recovery. |
| 8 Multiple candidate namespaces | UNSUPPORTED while original uniqueness is unproven | Independent authenticated proof, not population/recency heuristics, would be required to change classification. No chooser that grants ownership. |
| 9 Ambiguous original provenance | UNSUPPORTED | Deny/escalate; no guessed reconstruction or self-issued backup proof. |
| 10 Residual canonical bytes without trustworthy ownership | UNSUPPORTED | Physical presence is not supported reachability; no ownership reassignment. |
| 11 No residual old namespace/data | UNSUPPORTED in this workstream | PD05-A approves no new-target branch; no absence-by-scan proof and no allocation fallback. |
| 12 Current safe existing non-UUID identity | SUPPORTED existing compatible acquisition/read behavior, not a recovery promise | Preserve exact accepted bytes under helper AND namespace checks; inherited PD04/PD05-B. |
| 13 Mixed-case safe identity | SUPPORTED existing compatible acquisition/read behavior, not a recovery promise | Preserve exact case/fingerprint; no lowercasing or historical UUID normalization. |
| 14 Namespace-unsafe helper-accepted value | UNSUPPORTED as recovery target | Never open/accept/normalize that target. If it is corrupt mirror evidence and a different compatible exact original is independently proven, only row 1's full premises can apply. Otherwise addressing such historical ownership requires a separately scoped migration program. |

Rows may coexist. An unsupported historical generation does not permit losing its bytes; row 1 cannot be advertised as recovering that historical generation. Multiple retained accounts/namespaces require actual preservation of every affected scope without foreign payload exposure, not a promise of universal access. If the selected narrow history cannot satisfy these limits, it stays unresolved and the runtime prerequisite remains open.

## 11. Eight NEW product decisions

`NEW_PRODUCT_DECISION_COUNT = 8`; `NEW_PRODUCT_DECISIONS_APPROVED = YES`; every NEW row is `PRODUCT_OWNER_APPROVED`. The exact reviewed recommendations below are now the human-selected choices, unchanged in substance. Approval selects policy/investment only, subject to section 15; it does not independently authorize runtime code, issuer rollout, operator execution or public activation.

Approval provenance: `PRODUCT_OWNER_DECISION = ALL_EIGHT_REVIEWED_RECOMMENDATIONS_APPROVED`; `PRODUCT_OWNER_DECISION_DATE = 2026-10-10`. Source: the explicit human product-owner instruction after focused rereview PASS: **“8개 신규 결정 모두 reviewed recommendation대로 승인”**. This instruction approves only the eight NEW reviewed recommended selections on corrected head `b26928b06c871ae210a3f116c0af8e4f0fccf2cb`. It does not newly approve the three inherited constraints, convert the eight fixed constraints into waivable choices, or approve implementation/evidence/activation. Approval is not inferred from recommendations, review, CI, PR creation/body, publication or merge. Section 18 preserves the exact review chronology.

`APPROVAL_DELTA_INDEPENDENT_REVIEW = NOT_YET_PERFORMED`; `FINAL_MERGE_GATE = NOT_PERFORMED`; `READY = NOT_PERFORMED`; `MERGE = NOT_PERFORMED`; `IMPLEMENTATION = NOT_AUTHORIZED`; `ACTIVATION = NOT_AUTHORIZED`.

| ID | Question | Choices | Reviewed recommended choice (now approved) | Reason | Cost/risk | Dependency | Policy authorization ceiling | What it does NOT authorize | Approval state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HEALTH-ID-PD01-A | What established-invalid recovery does the product support? | A typed unavailable only; B proven exact-original or deny/escalate; C broad reconstruction; D automatic repair | B_PROVEN_EXACT_ORIGINAL_OR_DENY_ESCALATE | F can regain actual original scope without guessing; A alone cannot close runtime liveness | Provenance/coordination cost; unresolved histories remain inaccessible | PD03/06/09 and fixed proof/writer constraints | Conditional Policy F support envelope | Replacement, alias, guessed ownership or current implementation | PRODUCT_OWNER_APPROVED |
| HEALTH-ID-PD02-A | May established invalid identity be automatically replaced? | No; bounded automatic replacement under asserted premise | NO_AUTOMATIC_REPLACEMENT | New device -> new fingerprint -> potentially orphaned old history | Denied convenience; avoids silent loss of reachability | PD01/05; acquisition-role distinction | Explicit no-auto-replacement support policy | Changing today's missing-mirror creator behavior or approving fresh-install inference | PRODUCT_OWNER_APPROVED |
| HEALTH-ID-PD03-A | Which retained histories are promised recovery? | Narrow current active scope with exact proof/continuity; historical expansion; universal reconstruction | NARROW_CURRENT_ACTIVE_GENERATION_WITH_PROVEN_EXACT_ID_AND_UNCHANGED_WRITERS | Existing readers address active generation; pending evidence must stay exact | Historical coverage deferred; bound requests may require high-risk prerequisite | Sections 6/7/10; PD01/06/09 | Conditional rows 1/3-7, compatible existing behavior rows 12-13 | Historical activation, universal support, writer rewrite or migration | PRODUCT_OWNER_APPROVED |
| HEALTH-ID-PD05-A | Is a new recovery target supported where exact restoration is irrelevant? | A none; B generated UUID after positive no-residual proof; C absence-by-scan; D automatic replacement | A_NO_NEW_TARGET_RECOVERY_IN_THIS_WORKSTREAM | No trustworthy no-residual premise exists today | No recovery convenience for empty/no-history cases; future scope cost | PD02/03/09; inherited historical syntax | Exclusion/deferment of a new-target recovery branch | Ambiguous-data fallback, new-ID allocation or historical validator change | PRODUCT_OWNER_APPROVED |
| HEALTH-ID-PD06-A | Does product commit to assisted recovery, and who operates it? | End-user service; conditional internal operator; development-only diagnostics; unsupported escalation only; future E3 investigation | CONDITIONAL_INTERNAL_OPERATOR_ONLY_NO_CURRENT_EXECUTION_END_USER_SELF_SERVICE_DEFERRED | Controlled authenticated evidence is required before a supported procedure | Security/privacy, training/audit, platform QA; no immediate service | PD01/03/07/09; writer-continuity proof, conditional high-risk prerequisite and separate procedure qualification | Conditional future operator support commitment after all gates/proof | Console edits, clear-site-data, procedure/tool rollout or E3 production approval | PRODUCT_OWNER_APPROVED |
| HEALTH-ID-PD07-A | What recovery state/flow is exposed to users? | Typed local recovery-required/unavailable/conditional-assisted; generic unavailable only; misleading empty/cloud-recovery claim (inadmissible) | TYPED_LOCAL_RECOVERY_REQUIRED_UNAVAILABLE_CONDITIONAL_ASSISTED | Distinguishes data-source limits without fabricated absence | Translation/accessibility/copy and physical UX QA | PD06/08; fixed source truth/#763 | Bounded vocabulary/disclosures and future flow requirements | UI implementation, activation, legacy Refresh or cloud/local-only recovery promise | PRODUCT_OWNER_APPROVED |
| HEALTH-ID-PD08-A | What finite Retry/support behavior is offered? | One transient manual Retry; fresh read after authorized recovery; none for deterministic failure; automatic until-success (inadmissible) | ONE_MANUAL_RETRY_PER_TRANSIENT_EPISODE_NONE_FOR_UNCHANGED_DETERMINISTIC_FAILURE_FRESH_READ_AFTER_AUTHORIZED_CORRECTION | Retry cannot repair unchanged bytes; finite liveness remains truthful | Some failures require escalation instead of retry convenience | PD06/07; fixed retry and writer cache semantics | Finite read-episode UX, not identity repair | Busy loop, writer Promise eviction, queue retry changes or restart-as-repair | PRODUCT_OWNER_APPROVED |
| HEALTH-ID-PD09-A | Which NEW evidence/operational investment is selected? | Unsupported until proof; controlled operator provenance source; future qualified E3; trusted local recovery record; broad migration | PROVENANCE_FEASIBILITY_FIRST_FOR_CONTROLLED_OPERATOR_PATH_REMAIN_UNSUPPORTED_UNTIL_QUALIFIED | Source availability and E3 feasibility are not established | Historical issuer feasibility, security/audit and physical qualification investment may fail | PD01/03/06; inherited PD09-B | Separately scoped feasibility/design investment priority | Issuer implementation, self-issued evidence, broad migration or reapproval of PD09-B | PRODUCT_OWNER_APPROVED |

Inadmissible choices are shown to explain rejected alternatives, not offered as selectable technical waivers. If an owner wants a different admissible support/investment selection, revise/review the coherent contract before implementation; C/D do not become safe through approval alone.

### PD01-A implications

Question/choices/recommendation: table above, **B**. A is a truthful interim denial but not recovery completion; C lacks independent ownership proof; D changes scope and can orphan data. User/product benefit: narrowly recover retained local history under the original namespace. Data-loss/reachability risk: unsupported cases remain inaccessible; guessing can misassign/strand data. Writer-authority risk: original mirror repair still crosses acquisition/currentness and requires section 7. Support cost: issuer verification, retained-scope inventory and operator escalation. Physical dependency: claimed procedure mode/creator exclusion, not all Track A just to choose policy. Implementation consequence: one evidence-gated exact-target transition, separately authorized. Deferred: broad reconstruction/new target. Interactions: PD02 prohibits auto-replacement, PD03 bounds history, PD06/09 supply conditional support/evidence. STOP: no unique authenticated original, real reachability or writer proof.

### PD02-A implications

Question/choices/recommendation: table above, **NO**. A bounded automatic replacement premise is not currently established and cannot waive preservation. Benefit: no silent new fingerprint while old bytes survive out of reach. Data risk: continued unavailable scope is explicit rather than mislabeled successful empty scope. Writer risk: changing existing creator output/availability is independently high risk. Operational cost: more denied/escalated cases instead of unattended repair. Physical dependency: none to choose NO; future exact recovery still needs claimed-mode evidence. Implementation consequence: future reader/final-use failures cannot allocate; preserve today's missing-role behavior unless separately authorized. Deferred: automatic replacement/migration. Interactions: PD01 F and PD05 exclusion. STOP: any proposed recovery generates/normalizes a target or reinterprets established-invalid as missing.

### PD03-A implications

`CURRENT_ACTIVE_GENERATION_SCOPE_POLICY = APPROVED` is the desired conditional support envelope only. It does not prove current-active-generation recovery implementation, writer continuity or reachability acceptance. C01-C15 remain `REQUIRED / NOT EXECUTED`; all section 7 proof/change-trigger distinctions remain unchanged.

Question/choices/recommendation: table above, **narrow current active generation**; exact section 10 matrix is the promise ceiling. Benefit: evidence-backed current local sessions, including local-only history, without inventing historical reader coverage. Data risk: historical access remains deferred but bytes cannot be orphaned; all pending/tombstone/conflict/receipt scope must still be preserved. Writer risk: bound/claimed work has no rewrite exception. Operational cost: fine-grained scope inventory and immutable comparisons. Physical dependency: continuity/re-entry for relevant writer modes. Implementation consequence: explicit supported-case tests, never initializing a successful empty scope. Deferred: historical generation selection and universal/multiple-ambiguous recovery. Interactions: PD01 uniqueness, PD06 procedure, PD09 evidence. STOP: any promised row cannot prove access/immutability; narrower wording is not executed runtime closure.

### PD05-A implications

Question/choices/recommendation: table above, **A**. B would require independently authoritative historical absence coverage across all retained affected scopes, not a scan or current failure; no such source is available. C/D are unsafe. Benefit: prevents a new-target fallback from hiding unresolved data ownership. Data risk: true no-history cases also stay outside this recovery feature; that limitation is disclosed. Writer risk: no rotation or changed creator role is approved. Operational cost: future new-target premise/design requires a separate decision, not ad hoc support. Physical dependency: none to choose exclusion; any later B would need its own qualified absence/admission evidence. Implementation consequence: no new-target branch in F. Deferred: independently proven-no-residual feature and its new-target-only validation. Interactions: PD02 NO and PD03 row 11. STOP: treating missing rows, empty query or inaccessible DB as positive absence proof. Inherited compatible historical syntax is unchanged.

### PD06-A implications and procedure ceiling

`ASSISTED_RECOVERY_PRODUCT_POLICY = APPROVED_CONDITIONAL_INTERNAL_OPERATOR`; `ASSISTED_RECOVERY_RUNTIME_AVAILABILITY = NOT_AVAILABLE`; `ASSISTED_RECOVERY_IMPLEMENTATION = NOT_AUTHORIZED`; `ASSISTED_RECOVERY_PROCEDURE_QUALIFIED = NO`; `END_USER_SELF_SERVICE = DEFERRED`. Current production operator execution is **NOT AVAILABLE / NOT AUTHORIZED**.

Question/choices/recommendation: table above, **conditional internal operator only**, no current execution; end-user self-service deferred. Unsupported escalation is the present behavior until gates/premises are qualified. Development-only diagnostics do not become a supported service; future E3 investigation is distinct and still not feasible by assertion.

Benefit: a controlled path could regain proven local history with explicit limitations. Data risk: failed/partial recovery can remain unavailable and must preserve retained bytes/pending work. Writer risk: operator privilege does not grant cache eviction, cancellation or creator retirement. Operational cost: authentication/authorization, privacy/security review, training, consent, incident audit, retention and platform-specific procedure qualification. Physical dependency: every claimed normal/browser/PWA/lifecycle episode premise; desktop tests cannot certify unexecuted platforms. Implementation consequence: a separately reviewed procedure/tool and demonstrated writer continuity; only an actually required frozen writer/control-contract change adds the separately authorized high-risk prerequisite. Unproven continuity stops execution pending proof/design without establishing change necessity. These are not commands in this document. Deferred: public self-service, broad migration, direct console editing. Interactions: PD01/03 define eligible cases, PD07 disclosures, PD08 retry, PD09 issuer investment. STOP: unverified evidence, operator authority, user consent, reachability, writer safety or platform premises.

A future authorized invoker must be authenticated, narrowly authorized for the affected user's exact case, possess verified issuer evidence and use a separately qualified tool. The user must give revocable informed consent for scope and risk, including pending/unsaved work and local-only history; consent is not ownership/lifecycle proof. Manual entry of the exact original ID could be a **data-entry mechanism only** if authenticated issuer evidence independently binds those exact bytes, the tool verifies them and freezes the target. User memory or copied storage text alone is never authority. No localStorage console editing or clear-site-data instruction is authorized. Audit operator/consent/issuer/episode/progress/result references without leaking credentials/content. Partial failure remains typed/incomplete; rollback cannot revive a revoked lifetime. No production procedure is promised available today.

### PD07-A implications

Question/choices/recommendation: table above, **typed local recovery-required / unavailable / conditional-assisted**. Proposed presentation categories: `CANONICAL_IDENTITY_RECOVERY_REQUIRED`, `CANONICAL_IDENTITY_RECOVERY_UNAVAILABLE`, and `CANONICAL_IDENTITY_RECOVERY_SUPPORTED_ASSISTED` only when that exact case/procedure is genuinely qualified. Do not display assisted availability based solely on selecting PD06.

Benefit: understandable local-source limitations and non-destructive escalation. Data risk: avoid false empty/calendar absence/cloud recovery; independently qualified legacy partial can remain visible only under ordinary failure, never isolation. Writer risk: no action button implicitly rotates or cancels work. Operational cost: reviewed EN/KO/JA copy, accessible status/focus/keyboard flow and supported physical-mode QA. Physical dependency: actual procedure and UI mode, not an emulated test. Implementation consequence: preserve section 9 taxonomy and #763 exact distrust mapping; suppress canonical absence claims. Deferred: UI implementation/activation, legacy Refresh. Interactions: PD06 determines real support availability and PD08 finite action. STOP: wording hides canonical evidence, implies complete cloud recovery, offers destructive routine advice or uses legacy to waive distrust.

### PD08-A implications and finite episode rules

Question/choices/recommendation: table above, **one manual transient Retry; no unchanged deterministic Retry; fresh read after authorized correction**. Benefit: useful bounded availability recovery without fake identity repair. Data risk: repeated reads cannot become writes or clear hidden history. Writer risk: reader Retry must not evict rejected writer Promise, recreate sessions or alter transport/queue retries. Operational cost: episode tracking and escalation after exhausted budget. Physical dependency: later supported-mode/copy acceptance. Implementation consequence: a bounded read UX, separately reviewed, not a new identity transition. Deferred: writer retry redesign and legacy Refresh. Interactions: PD06 authorized procedure, PD07 truthful status. STOP: deterministic bytes keep receiving retries or automatic retry-to-success appears.

`RETRY_ELIGIBILITY`: genuinely transient Storage/DB read availability, or a new read after an independently authorized completed recovery; not deterministic unchanged identity/integrity/provenance/writer-safety failure. `RETRY_BUDGET`: one user-triggered additional read for a transient episode; exhaustion -> typed unavailable/escalation. `RETRY_INVALIDATION`: account/origin/scope/request/observed error-class change or an authenticated authorized transition invalidates old results and may establish a distinct current episode. A click, timeout, reload or opening another tab is not proof of such a boundary and must not replenish the same persistent-failure budget. New read after recovery does not resume an old source token. Restart may remove in-memory transient state, but does not repair bytes, attest original identity or globally retire writers. Existing internal bounded reader generation handling is not changed by this recovery UX proposal.

### PD09-A implications

The approved provenance-feasibility-first investment direction permits future planning/scoping of a feasibility investigation after this contract package is canonically closed. It does not establish feasibility or authorize E3 implementation, issuer deployment, operator tooling, privileged/native verification, trusted-local-record implementation, broad migration or writer transition. None is started by this approval-publication task.

Question/choices/recommendation: table above, **provenance feasibility first for a controlled operator path, remain unsupported until qualified**. Unsupported-only is viable interim behavior but no recovery investment; E3, trusted-local-record and broad migration alternatives need proof that does not exist. Benefit: prioritize the missing historical proof instead of cosmetic retry or guessed recovery. Data risk: a future local record cannot retroactively prove previously lost history; evidence must authentically predate corruption or have an independently authoritative historical chain. Writer risk: issuer/procedure cannot self-assert quiescence or alter writers. Operational cost: feasibility may conclude impossible for historical cases; separate security/privacy, issuer/audit design and physical differential studies. Physical dependency: required lifecycle/creator premises for each claimed supported mode, not blanket Track A completion for conditional policy approval. Implementation consequence: a separately scoped feasibility/design investigation, followed only by explicitly authorized reviewed work. Deferred: actual issuer deployment, native/E3 execution, trusted record rollout and migration program. Interactions: PD01/03 promise ceiling and PD06 operator commitment. STOP: no authentic historical source or qualified ownership/lifecycle evidence; remain unsupported, do not lower threshold.

This NEW investment is distinct from inherited PD09-B. `E3_FEASIBILITY = NOT_ESTABLISHED`, `LIFECYCLE_EVIDENCE_SOURCE = REMAINS_UNAVAILABLE`, and `R2-U = NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF`. The prior ER investigation approval remains inherited authority, not the source of this NEW operator/provenance investment approval; the current explicit human instruction is that source.

## 12. One coherent approved policy bundle

`PRODUCT_OWNER_APPROVED_BUNDLE = POLICY_F_PROVEN_ORIGINAL_OPERATOR_CONDITIONAL_NO_NEW_TARGET`.
`BUNDLE_APPROVAL_STATUS = PRODUCT_OWNER_APPROVED`.

All eight reviewed selections are explicitly approved. The following is the approved product-policy ceiling, not executable recovery authorization; approval-publication review and canonical closure remain outstanding:

| Dimension | Approved combined policy ceiling |
| --- | --- |
| SUPPORTED CASES | Conditional exact compatible original identity, independently authenticated origin/account/project/storage history, existing original namespace/current active generation, immutable domain/pending evidence, verified reachability and proven writer continuity. Unchanged-semantics proof does not itself trigger the high-risk prerequisite; an actually required frozen writer/control-contract change requires separate authorization/closure and continuity proof under that reviewed contract, not a proof waiver. Sections 10 rows 1/3-7; no current execution claim. |
| UNSUPPORTED CASES | Ambiguous/no original proof, multiple plausible ownership candidates, residual bytes alone, unsafe target, no-residual new target, unqualified writer/lifecycle/procedure. Historical read expansion and broad migration deferred. |
| ASSISTED SUPPORT COMMITMENT | Conditional internal operator procedure after qualified issuer, consent, proven writer continuity, platform procedure and separate authorization. High-risk writer prerequisite only if actual frozen writer/control-contract change is needed. No current service or end-user self-service promise. |
| AUTO-REPLACEMENT POLICY | None for established-invalid recovery; missing creator role is separate, unchanged here. |
| NEW-TARGET POLICY | None in this workstream; no absence-by-scan fallback. |
| RETRY POLICY | One additional manual transient read per genuine episode; none for unchanged deterministic failure; fresh read after authorized correction, no writer-cache or transport retry change. |
| USER-FACING STATE | Typed local recovery required/unavailable; conditional-assisted only when actually qualified. Qualified legacy partial subject to #763; no hidden-absence/cloud-complete claim. |
| EVIDENCE PATH | First separately investigate authentic historical provenance for a controlled operator path; remain unsupported until qualified. No assumed E3/issuer feasibility. |
| WRITER STOP CONDITIONS | Unproven exact continuity -> STOP pending further proof/design; semantic change necessity remains NOT_ESTABLISHED. Actually required cache/retry/readiness/creator/recovery/reopen/transport/unsaved-work, pending or frozen control-contract change -> separately authorized high-risk prerequisite. No eviction/drain/logout workaround. |
| PHYSICAL EVIDENCE DEPENDENCY | Scope-specific issuer/admission/lifecycle/procedure premises before trusted execution, not full Track A merely to approve conditional policy. |

The explicit policy approval is not runtime implementation/activation authorization. If issuer feasibility fails, the policy's denial branch remains truthful but the runtime correction is not declared closed through unsupported copy alone.

## 13. Inherited/fixed non-decisions: exact disjoint sets

These three rows are `ALREADY_APPROVED_INHERITED_CONSTRAINT`, not NEW approval requests:

| ID | Retained constraint / provenance |
| --- | --- |
| HEALTH-ID-PD04 | Exact compatible established device ID/case, including safe accepted non-UUID/mixed-case; AUTH sections 9-10, 21/25 (DEVLIFE-PD14); characterization section 10. |
| HEALTH-ID-PD05-B | No retroactive rejection/normalization/rekey/migration of compatible historical identities; lifetime UUID validation does not rewrite historical device syntax; AUTH sections 9-10, 21/25. |
| HEALTH-ID-PD09-B | Existing conditional admission/lifetime evidence envelope if that model is used; truthful qualified issuer/build/lifecycle episode and physical QA; AUTH 10/21, ADMIT 10/12-13, ER 8/10. |

These eight rows are `TECHNICALLY_FIXED_CONSTRAINT`, mandatory and not owner-selectable waivers:

| ID | Retained constraint / provenance |
| --- | --- |
| HEALTH-ID-PD01-B | No fabricated ownership, guessed repair or silent orphaning; characterization 4-9/C02/C04/C05/C09/C10, AUTH 10/20, ER 10. |
| HEALTH-ID-PD02-B | Malformed != missing, no inferred fresh install/broadened reader recovery trigger; writer role/output/cache/retry/readiness change -> separate high-risk STOP; AUTH 10/20, ADMIT 12, ER 10. |
| HEALTH-ID-PD03-B | Real claimed reachability and immutable pending work, not physical-byte retention/fresh empty scope; characterization C05/C06/C09/C10, AUTH 10/20, ER 10. |
| HEALTH-ID-PD06-B | Authenticated provenance and verified procedure premises, no self-issued ownership/lifecycle or consent-as-proof; characterization C04/C08/C09/C13, ADMIT 12, ER 10. |
| HEALTH-ID-PD07-B | Unavailable != empty; qualified partial stays partial; local-only/cloud limits; exact #763 source distrust; characterization C12/C13 and reader contracts. |
| HEALTH-ID-PD08-B | No busy retry/automatic repair; unchanged deterministic bytes need justified correction, not infinite Retry; characterization C02/C09/C10/C13, ADMIT 9. |
| HEALTH-ID-PD09-C | Complete relevant creator/current ownership evidence, immutable pending work; no guessed quiescence/timeout/checkbox/lock-only absence; unproven preservation -> STOP; any actually required frozen writer/control-contract change separately authorized, not inferred from missing proof; characterization C06-C08/C14, AUTH 20, ADMIT 12, ER 10. |
| HEALTH-ID-PD10 | Approved scope -> separately authorized implementation -> independent review/correction -> Final Merge Gate -> human merge -> verified exact main, with deterministic supported-case safety/reachability/liveness; ADMIT 12-13, ER 10, characterization C10/C14/C15. |

`DEVLIFE_PD14_REOPENED = NO`; `WRITER_FIREWALL_REOPENED = NO`. The eight NEW IDs in section 11, three inherited IDs and eight fixed IDs are exhaustive, distinct sets. Selecting support investment cannot waive fixed proof or approve an inherited-incompatible authority transition.

## 14. HEALTH-ID-C01-C15 traceability

All rows remain `REQUIRED / NOT EXECUTED`. Classification labels allocate future work, not completed evidence; `PRODUCT_DECISION_APPROVED` records policy selection only, not criterion acceptance. `CONTRACT_DEFINED` means the obligation is described, not independently accepted or executed. `SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED` means an actual frozen writer/control-contract change is needed, not merely that continuity proof is absent. Unproven continuity still stops executable recovery. No criterion is marked PASS.

| ID | Contract / decision coverage and exact future proof obligation | Classification | Execution state |
| --- | --- | --- | --- |
| HEALTH-ID-C01 | Sections 2/4/7: current complete helper/key/alias/factory/late-guard inventory; no import I/O; all relevant creators below removable surfaces, including exports/restore | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED; SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C02 | Sections 2/4/11 PD02/08: null != established empty/invalid; Storage/entropy/write errors not guessed missing; no reader/final-use replacement | CONTRACT_DEFINED; PRODUCT_DECISION_APPROVED; IMPLEMENTATION_PROOF_REQUIRED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C03 | Sections 2/7/10/13: exact safe non-UUID/mixed-case retained, unsafe denied, no alias/normalization/strict historical migration | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C04 | Sections 5/11 PD01/06/09: trusted exact original plus authenticated scope; absent/multiple/corrupt/stale denied, no unique-namespace guess | CONTRACT_DEFINED; PRODUCT_DECISION_APPROVED; IMPLEMENTATION_PROOF_REQUIRED; PHYSICAL_EVIDENCE_REQUIRED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C05 | Sections 6/10/11 PD03: characterization A-F scenarios with active/historical generations, sessions/tombstones/meta/conflicts/checkpoints/local-only; real supported access/no orphaning | CONTRACT_DEFINED; PRODUCT_DECISION_APPROVED; IMPLEMENTATION_PROOF_REQUIRED; SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C06 | Sections 6/7: pending/claimed/retry/conflict/ack and bound/unbound exact identity/payload/hash/dependency/digest/CAS/binding/receipt/epoch; no ACK/rebase/duplicate/drop/new-scope replay | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED; SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C07 | Section 7: cached success/rejection/in-flight, ABA/sign-out, late snapshot/export/reset/restore/online retry, newer/old scope and unsaved work; no blanket eviction | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED; SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C08 | Sections 4/5/7/8: complete relevant creator exclusion/coordination, bypass/suspended/restored/cross-surface entry, exact episode validity; no boolean/lock-only proof | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED; PHYSICAL_EVIDENCE_REQUIRED; SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C09 | Sections 4/7/8: reviewed durable exact-target intent, deterministic crash resume/partial rollback, Storage/IDB errors, repeated operator/retry, no new target/lost supported access | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED; PHYSICAL_EVIDENCE_REQUIRED; SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C10 | Sections 6/8/10/12: deterministic eventual completion for every promised malformed/unsafe case; original canonical evidence readable; unsupported copy is not execution | CONTRACT_DEFINED; PRODUCT_DECISION_APPROVED; IMPLEMENTATION_PROOF_REQUIRED; PHYSICAL_EVIDENCE_REQUIRED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C11 | Sections 4/6/9: selected-day/range agree; source-owned old token revocation including observed ABA; account/date/generation/late continuations cannot mix scopes | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED; PHYSICAL_EVIDENCE_REQUIRED; SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C12 | Section 9: exact persisted #763 isolation/INVALID_CONTEXT vs ordinary trusted-source failure; legacy partial never waives distrust | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C13 | Sections 9/11 PD06/07/08: local-only/unavailable != empty, calendar unknown, finite Retry, restart/manual/destructive warnings, physical-mode EN/KO/JA/accessibility QA | CONTRACT_DEFINED; PRODUCT_DECISION_APPROVED; IMPLEMENTATION_PROOF_REQUIRED; PHYSICAL_EVIDENCE_REQUIRED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C14 | Sections 7/16/17: no domain clear/copy/adoption/owner/generation/digest/schema/backend/gate change; writer regressions/exact-head CI; expansion STOP | CONTRACT_DEFINED; IMPLEMENTATION_PROOF_REQUIRED; SEPARATE_HIGH_RISK_PREREQUISITE_IF_TRIGGERED | REQUIRED / NOT EXECUTED |
| HEALTH-ID-C15 | Sections 11/13/15/18: explicit human selections policy-satisfied only; approval-delta review/canonical closure, reviewed/corrected implementation, Final Gate, manual merge/exact-main verification remain outstanding; no E3/writer/reader/G6 automatic closure | CONTRACT_DEFINED; PRODUCT_DECISION_APPROVED; IMPLEMENTATION_PROOF_REQUIRED | REQUIRED / NOT EXECUTED |

Future tests must include the characterization's A-F mechanism/control cases and supported-history matrix, real cached writer/late asynchronous paths, immutable requests and crash/liveness cases. Synthetic fixture tests cannot substitute for original production provenance, physical admission or creator retirement. Narrow support declarations must identify unresolved histories; runtime prerequisite closure still requires the characterization's full closure condition, not a policy-only publication.

## 15. Implementation authorization gate

`IMPLEMENTATION_AUTHORIZATION = BLOCKED_PENDING_CANONICAL_APPROVAL_PUBLICATION_REVIEW_FINAL_GATE_MERGE_AND_ALL_APPLICABLE_TECHNICAL_EVIDENCE`.

Product selections are no longer pending. Approval-delta independent review/correction closure, Final Merge Gate, human merge, exact-main/post-merge verification and all applicable technical premises remain gates. Production exact-original provenance remains unavailable; writer continuity is unproven; exact-target control protocol is not implemented; required evidence/procedure/physical premises and C01-C15 are unexecuted. Any actually required frozen writer/control-contract change still triggers the conditional separate high-risk prerequisite. This commit alone cannot start implementation.

Before any recovery runtime implementation task can start, require all applicable gates:

1. **Satisfied for the pre-approval corrected head only:** independent focused rereview at `b26928b06c871ae210a3f116c0af8e4f0fccf2cb` passed and closed the reviewed P2 finding. It does not review this later approval delta.
2. **Policy selection satisfied:** the human explicitly approved all eight reviewed recommendations on 2026-10-10 after that rereview. No inherited/fixed reapproval or implicit approval from publication/merge.
3. **Pending canonical approval-publication closure:** this artifact publishes the final choices and human provenance on the Draft PR; substantive approval-record/contract deltas still require independent review and closure of any contradictions/corrections.
4. **Pending:** Final Merge Gate, manual human merge, exact-main and post-merge required CI/authority-state verification. No auto-merge/Ready action in this task.
5. Classify the selected implementation scope without treating missing proof as change necessity. **Unchanged-semantics continuity proven**: this specific high-risk writer prerequisite is not triggered, but all other authorization/evidence gates remain. **Actual frozen writer/control-contract change required**: STOP; first obtain separate explicit high-risk prerequisite authorization and its independent review/correction/Final Gate/human merge/exact-main closure, then prove continuity under that reviewed contract. Eight policy approvals are not that authorization. **Continuity unresolved / necessity not established**: STOP pending further proof/design; do not assume same-ID retention is safe, assume change is unnecessary, or invent a mandatory high-risk transition. Future exact-target control-protocol design/review is separately required by section 7.2; it becomes a high-risk prerequisite only when an actual frozen contract change is needed.
6. Evidence-dependent scope has a truthful issuer/feasibility plan or is explicitly conditional. A separately authorized dormant implementation may remain fail-closed without proof; actual production recovery cannot execute or claim support until all needed historical provenance/lifecycle/procedure premises are qualified. No fabricated issuer, assumed E3 or forced full-Track-A condition merely for policy selection.
7. A new separately bounded implementation request defines supported cases, non-goals, C01-C15 acceptance/regressions and exact starting main. Issuer/tool/procedure work and activation each need their own explicit scope; contract closure does not start them automatically.

After implementation, require independent implementation review/corrections, exact-head regression/required physical acceptance, Final Merge Gate, human merge and verified exact main before claiming runtime closure. This first package has no implementation-readiness status. `REL05G5A-001` stays `ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION`; no automatic public/Health parent/writer/data-plane/G6 activation follows even from later recovery acceptance.

## 16. STOP and escalation matrix

| STOP condition | Required next escalation; safe result |
| --- | --- |
| Exact original provenance unavailable for a claimed supported case | Evidence/issuer feasibility qualification; RECOVERY_UNSUPPORTED or PHYSICAL_EVIDENCE_REQUIRED as appropriate. No guess or threshold reduction. |
| Multiple plausible original identities / corrupt or stale proof | Independent ownership/provenance investigation; PROVENANCE_AMBIGUOUS. No population/recency chooser or manual self-certification. |
| Old canonical scope cannot be reopened non-creatively | Storage/reachability incident investigation; FAILED_TRANSIENT or FAILED_DURABLE. No init/empty success. |
| Pending work needs rebind/rewrite/drop/new scope | Separately authorized high-risk writer/migration design; WRITER_SAFETY_UNPROVEN. Preserve original work. |
| Writer continuity cannot be proven; semantic-change necessity remains unresolved | STOP pending further continuity proof/design; RECOVERY_WRITER_SAFETY_UNPROVEN. Required semantic change is NOT_ESTABLISHED, not YES or NO. No safe-retention assumption or executable recovery. |
| Actual cache/retry/readiness/creator/recovery/reopen/transport/unsaved-work or frozen writer/control-contract change is required | SEPARATE_HIGH_RISK_WRITER_TRANSITION_PREREQUISITE_REQUIRED for that concrete change; separate authorization/review/closure first. No cache eviction, reload/logout or draining workaround. |
| Old creator exclusion/current ownership unproven | Scoped lifecycle/creator evidence qualification and, if semantics change, high-risk prerequisite. No lock/timeout/checkbox proof. |
| Required physical lifecycle/procedure premise not demonstrated | Supported-mode qualification or explicit unsupported mode; PHYSICAL_EVIDENCE_REQUIRED. No emulation-to-physical promotion. |
| Data copy/migration needed | Separate migration program with data-loss/ownership/rollback acceptance; no Policy F fallback. |
| Domain ownership reassignment needed | Separate ownership/security architecture/product review; never infer ownership from bytes. |
| DB/store/index/keyPath/schema/backend/RLS/remote API change needed | New explicitly scoped architecture/implementation blocker; stop this envelope. |
| Proposed choice conflicts with inherited or fixed constraint | Reject waiver, revise admissible product choice and independently review coherent package; no reopening DEVLIFE-PD14/firewall by implication. |
| Newer transition, expired permit or unexplained inventory difference | Invalidate old episode; exact intent investigation/authorized continuation only. No overwrite/rebase or old lifetime revival. |
| Reader/writer/data-plane/G6 activation requested implicitly | Separate explicit activation authority after relevant prerequisites; NOT_AUTHORIZED here. |

## 17. Frozen authority state and validation ceiling

| State | Retained value |
| --- | --- |
| HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED | `false` |
| HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED | `false` |
| HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED | `false` |
| HOME_WORKOUT_COMPOSITE_READER_ENABLED | `false` |
| SEARCH_WORKOUT_COMPOSITE_READER_ENABLED | `false` |
| PUBLIC_READER_ACTIVATION / HEALTH_PARENT_PUBLIC_READER_ACTIVATION | `NOT_AUTHORIZED` |
| REL05G5A-001 | `ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION` |
| LEGACY_COMPATIBILITY_CACHE_FRESHNESS | `REQUIRES_POLICY_AND_ACCEPTANCE` |
| REFRESH | `NOT APPROVED / NOT IMPLEMENTED`; no prevData refresh bundled |
| TRACK_A_STATUS | `TRACK_PARTIAL / PATH_A_QUALIFICATION_PARTIAL` |
| E3_FEASIBILITY | `NOT_ESTABLISHED` |
| LIFECYCLE_EVIDENCE_SOURCE | `REMAINS_UNAVAILABLE` |
| BOOTSTRAP_ADMISSION | `BLOCKED_BY_EVIDENCE_QUALIFICATION` |
| R2-U | `NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF` |
| Tracks B/C/D | `NOT_EXECUTED` |
| LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP | `UNRESOLVED` |
| Seven live-writer blockers | `OPEN`, section 7.3; no automatic eighth blocker/closure |
| Local database / schema / WorkoutSessionV1 | `7 / 1 / unchanged`; stores/indexes/keyPaths unchanged |
| Supabase/RLS/backend/remote schemas/APIs | Unchanged |
| Canonical writer / bind / push / pull / resync / reset / G6 | No activation or new implementation |
| Physical qualification | `DEFERRED_UNCHANGED` |
| New decisions / recovery acceptance | Eight `PRODUCT_OWNER_APPROVED` policy selections; C01-C15 `REQUIRED / NOT EXECUTED` |

Validation for this approval publication: only this Markdown artifact on existing Draft PR #766, no production/tests/config/schema/backend/gate changes; relative links resolved and `git diff --check` required; normal same-branch commit/push and clean repository after commit. No full frontend suite is required for this docs-only package. Hosted approval-publication exact-head Push/PR CI is the regression signal, observed separately rather than copied from the pre-approval reviewed head or prerequisite main CI. Pre-approval Push CI `38032555577` and PR CI `38032557837` both completed/success for test, typecheck, build, backend-rel05g1 and backend-recovery on `b26928b06c871ae210a3f116c0af8e4f0fccf2cb`, independently reverified before this publication; those results are prerequisite evidence only, not approval-head qualification. No production localStorage/IDB, Supabase mutation, real-user payload or physical procedure was accessed/executed for this contract.

Supabase skill guidance informed inspection of account/session-dependent writer fan-in: authenticated account authority is explicitly separated from historical device provenance and lifecycle evidence. No Supabase/cloud/auth configuration change follows from that inspection.

## 18. Exact next step

`INDEPENDENT_REVIEW_REL_05G_HEALTH_ID_RECOVERY_PRODUCT_APPROVAL_DELTA_01`.

Review chronology: original publication head `7ad43a542c36b64b64430ac25af07479bab1ccd8` received independent `CHANGES_REQUIRED`, P0/P1/P2/P3 = `0/0/1/0`, for `REL05G-HEALTH-ID-CONTRACT-001 / P2`. The defect promoted unproven continuity into mandatory writer semantic change and a mandatory high-risk prerequisite. Correction head `b26928b06c871ae210a3f116c0af8e4f0fccf2cb` distinguished `NOT_YET_PROVEN` continuity, `NOT_ESTABLISHED` change necessity and `CONDITIONAL` high-risk prerequisite, preserving the executable-recovery STOP. The focused independent rereview of that exact corrected head returned `REREVIEW_PASS`; `REL05G-HEALTH-ID-CONTRACT-001 = CLOSED`; new P0/P1/P2/P3 = `0/0/0/0`. Review provenance is the completed independent focused-rereview report in this task conversation, not an inferred GitHub approval or this publication's self-review.

After that review closure, the explicit human instruction “8개 신규 결정 모두 reviewed recommendation대로 승인” selected all eight unchanged reviewed recommendations on 2026-10-10: `PRODUCT_OWNER_DECISION = ALL_EIGHT_REVIEWED_RECOMMENDATIONS_APPROVED`. That is product-policy approval only. The reviewed writer classification and every technical STOP/proof boundary remain unchanged. The approval delta itself has not been independently reviewed, and no Final Merge Gate, Ready or merge has occurred.

Publish this approval record and synchronize the same Draft PR body, then stop. The next independent review must verify human provenance, the exact eight selections/no expansion, unchanged writer classification/provenance/evidence/authority/gates, C01-C15 still unexecuted and implementation still blocked. Only after approval-delta review/correction closure may Final Merge Gate occur; manual human merge and exact-main verification must precede separately authorized future work under section 15. Characterization closure remains intact; runtime prerequisite and all unexecuted acceptance/evidence states remain open.
