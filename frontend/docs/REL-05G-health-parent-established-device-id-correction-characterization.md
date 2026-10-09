# REL-05G Health parent: established device identity correction characterization

Task: `REL_05G_HEALTH_PARENT_ESTABLISHED_DEVICE_ID_CORRECTION_CHARACTERIZATION_01`.

Status: `CHARACTERIZATION_COMPLETE_PENDING_INDEPENDENT_REVIEW`. This is characterization and product-policy preparation, NOT correction implementation, approval, finding closure, identity repair, physical qualification or public activation.

## 1. Baseline and decisive result

Repository: `Absinthe-6785/Absinthe`. Canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`. Authoritative source/main: `b9331e78dbe3dd47aa00e67ef452b587e2b97a09`, fetched and independently checked on 2026-10-09. [PR #763](https://github.com/Absinthe-6785/Absinthe/pull/763) is MERGED/CLOSED; merge commit equals this main, merged at `2026-10-09T13:19:10Z`. [Post-merge push CI 37935992499](https://github.com/Absinthe-6785/Absinthe/actions/runs/37935992499) is completed/SUCCESS on that exact SHA: `test`, `typecheck`, `build`, `backend-rel05g1`, `backend-recovery` each completed/SUCCESS. That baseline run does not qualify the forthcoming docs head.

`REL05G5A-001 = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION`. A malformed established mirror is rejected without repair by local readers; a broad-format-accepted but namespace-unsafe mirror passes the helper and fails canonical open. With unchanged bytes, retries cannot restore canonical availability. Healthy legacy partial evidence is not proof that canonical-only records are absent or reachable. Better unavailable copy alone cannot close this prerequisite.

**`REL05G5A_001_READER_ONLY_CORRECTION_FEASIBLE = NO`.** No general reader-only/metadata-only correction that preserves the established identity solves these failures under the current contracts. Early validation and typed UX make failure clearer, not recoverable. Accepting unsafe inputs or deriving an alias changes persistence identity; changing the accepted established syntax silently breaks compatibility. A previously valid identity lost from the mirror cannot generally be reconstructed from the malformed string.

`NON_DESTRUCTIVE_RUNTIME_CORRECTION_FEASIBLE = CONDITIONAL`: a separately reviewed controlled operation could restore the *proven exact original safe identity* and reopen its unchanged namespace. The isolated probe proves that mechanism, NOT production provenance, admission or writer safety. There is no currently authorized production recovery API/procedure. New-identity recovery with old data requires a different, high-risk migration/reachability design; retaining bytes while hiding them is NOT non-destructive recovery.

Minimum recommended policy: **F, controlled exact-established-identity recovery, with A/B as interim diagnostics only, CURRENT_COMPATIBILITY for safe established values, no automatic replacement, and a separately reviewed identity/writer-transition contract before implementation.** Do not select C's bare rotation or E's alias. If exact-original recovery cannot be proven, STOP recovery; explicitly scope D only through a separate owner-approved migration program, not a fallback inside F. This recommendation is not product-owner approval and does not claim a bounded universal runtime repair exists.

## 2. Normative continuity

Read current merged versions completely:

- [Health parent public-readiness characterization](REL-05G-health-selected-day-range-parent-public-readiness-characterization.md).
- [Product-reader integration](REL-05G5B2B-product-reader-integration-prep.md).
- [Product-reader expansion](REL-05G5B2B2-product-reader-expansion-prep.md).
- [Previous/calendar consumer integration](REL-05G5B2B2B-consumer-integration-prep.md).
- [Approved device-lifetime authority contract](REL-05G-workout-device-lifetime-authority-contract-and-plan.md).
- [Approved bootstrap-admission prerequisite](REL-05G-workout-device-lifetime-bootstrap-admission-prerequisite.md).
- [Admission evidence and writer-safe routing](REL-05G-workout-device-lifetime-admission-evidence-and-writer-safe-routing-characterization.md).

Historical next-step/status text in those documents is not a substitute for current merged source. In particular, #763 now closes the selected-day persisted-isolation implementation discrepancy; it does not close established-identity availability. Preserve its `ACCOUNT_MISMATCH`, `NAMESPACE_MISMATCH`, `GENERATION_MISMATCH` -> typed isolation, `UNTRUSTED_SCOPE` -> `INVALID_CONTEXT`, and trusted-scope ordinary-error behavior in [selected-day reader](../src/lib/workoutSelectedDayReader.ts), lines 90-105. Identity acquisition/open is a separate boundary.

The lifetime contract's exact-case established-ID preservation, role-restricted recovery, mandatory-history/marker rules, episode-limited admission and writer firewall remain authoritative. Its dormant creator-recovery capability does NOT prove old canonical reachability or authorize public identity replacement. Helper-accepted/namespace-unsafe values do not acquire a new recovery trigger there. No simplified identity owner replaces these contracts.

## 3. Exact production creator/reader ownership graph

Source inventory searched the repository for both helper names, their re-exports/imports, the key symbol and literal (including aliases and indirect factory callers). There are **nine direct creation-capable call sites in six groups**. Count excludes the helper's internal delegation and the runtime port invocation, both traced below. Import/construction alone performs no identity acquisition.

```text
Device-global mirror: absinthe-health-routine-device-id:v1
  workoutLocalReaderAuthority (sole active helper implementation)
    readOrCreateDeviceId: missing / format-invalid -> UUID + mirror write
      healthRoutineSync productionSession cache miss
        HealthView -> routine controller -> bootstrap/commitState/sync
        Settings / note export -> snapshot; Settings -> reset
        vaultRestorePipeline -> recover
      workoutRuntimeAuthority production port
        AppContent account effect -> controller.start -> online/account check
    readEstablishedWorkoutDeviceId: existing invalid -> throw; null -> creator
      WorkoutSelectedDayReader.open
        shared selected-day hook -> gated Health / Home read projections
        hook reuse + post-async publication guards
      WorkoutRangeReader.open + two currentness guards
        WorkoutReadSnapshotCoordinator preflight/open/raw mirror fences
        range hook -> gated Previous/calendar/comparison/Search projections
  raw getItem currentness consumers (no repair)
    remote control client / push options / pull options; runtime currentDeviceId
  dormant device-lifetime foundation (second write implementation, no product caller)
    role + admission + marker/prepared/READY protocol; not a recovery shortcut
```

| Group / source | Exact acquisition sites at baseline | Ownership and creation ceiling |
| --- | --- | --- |
| [Shared helpers](../src/lib/workoutLocalReaderAuthority.ts) | creator 7-13; established reader 16-23; key 2; delegation 22 | Two different roles. Reader can write **only on null**, so domain-read-only is not literally metadata-write-free |
| [Health routine sync](../src/lib/healthRoutineSync.ts) | imported creator 47; re-exports 51-53; call 830 (1) | `productionSession` cache miss, before awaited DB open; routine compatibility writer/persistence, not canonical Workout writer activation |
| [Workout runtime authority](../src/lib/workoutRuntimeAuthority.ts) | creator import 11; production port 177 (1); port declaration 30, invocation 86 | Non-blocking account control-plane start; production port catches acquisition failure to null; raw mirror guard 181 |
| [Selected-day reader](../src/lib/workoutSelectedDayReader.ts) | import 8, re-export 21, open 37 (1) | Current account lowercased; device output preserved; canonical open/metadata/active-generation selection |
| [Range reader](../src/lib/workoutRangeReader.ts) | open 37, verification 75 and 80 (3) | Initial open and late guards remain creation-capable on missing mirror; no malformed repair |
| [Selected-day hook](../src/components/views/features/health/useHealthSelectedDayComposite.ts) | reuse 139; final device check 222 (2); open 144 | AppContent shared selected-day owner; catches source errors, generation recovery bounded; typed distrust withholds both |
| [Range coordinator](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts) | preflight 225 (1); real open 235 | Helper exception deferred to canonical open; raw mirror reads 181/226/229/303/317 fence scoped and reader-less partial publication |

Indirect creator fan-in, not additional helper counts: [HealthView](../src/components/views/HealthView.tsx) 150-160 supplies production persistence to [routine controller](../src/components/views/features/health/useRoutinePresetController.ts) 124-151; controller bootstrap, mutations and online sync reuse it. [Settings](../src/components/views/SettingsView.tsx) 153/207/219 uses snapshot/reset; [note import/export actions](../src/components/views/noteview/actions/useNoteImportExportActions.ts) 73/89 uses snapshot; [vault restore](../src/lib/vaultRestorePipeline.ts) 271 uses recover. Each adapter method in healthRoutineSync 853-885 awaits the same session factory; none is a surface-owned identity authority. [AppContent](../src/components/AppContent.tsx) 235-245 separately schedules/cancels the runtime authority controller on account lifetime. Its composite source ownership is below the child read surfaces, not a global creator barrier.

[Remote client](../src/lib/workoutRemoteClient.ts) 223, [push](../src/lib/workoutRemotePush.ts) 283 and [pull](../src/lib/workoutRemotePull.ts) 250 read the raw mirror as current-device fences; they do not write, repair or admit. G4B bound requests retain captured identity and currentness checks; no new push/pull/bind is invoked here. [Device-lifetime foundation](../src/lib/workoutDeviceLifetimeAuthority.ts) has the other mirror write at 265, prepared recovery reads and exact tuple guards at 164/245/250/263/294/315. Search found no non-test product import/caller of that module. It is dormant; its `compatibleCreatorsQuiesced:true` input is not a production issuer.

The standalone [qualification core](../qualification/rel05g-patha/core.mjs) includes the literal in `DENIED_KEYS` (line 6), not a product mirror creator. Tests/qualification fixtures are not extra production owners. No additional production literal/symbol/helper caller was found at this baseline. Future inventory must repeat the search; the count is not a permanent guarantee.

## 4. Current syntax and missing/malformed matrix

Exact helper acceptance is `/^[0-9a-f-]{36}$/i`, NOT strict RFC UUID. Creator requires a truthy existing value matching it; reader distinguishes `existing !== null` and throws on any failing established value (including empty string). Neither normalizes case. Reader error is plain `Error('workout_selected_day_device_id_invalid')`, not a currently implemented typed identity-recovery state.

[Namespace validation](../src/lib/localDatabase/namespace.ts) 4-25 requires every component to match `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/` and not match the sensitive-token pattern; schema must be 1. Device syntax is not a UUID check. `openLocalDatabase` validates before IDB open (repository 4502). All other components must independently pass validation.

| Mirror state | Reader today | Compatibility creator today | Canonical scope consequence / executed evidence |
| --- | --- | --- | --- |
| MISSING (`null`) | Delegates to creator; may persist UUID | Creates UUID | Open may initialize namespace/generation metadata, no domain mutation; probe PASS |
| `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` or accepted mixed-case UUID | Exact reuse/no write | Exact reuse/no write | Safe namespace, subject to remaining scope checks; case-preserving probe PASS |
| `malformed`, `''`, 35 or 37 `a`, 36 `g` | Throws/no write; repeated attempts preserve exact bytes | Generates/writes replacement UUID | Same input has different role semantics; 10 separate reader/creator vectors PASS |
| 36 hyphens | Helper returns exact string | Returns exact string/no write | Real selected-day AND range open reject `UNSAFE_NAMESPACE`, no fake DB opened; repeated attempts still fail; PASS |
| 36 `a` | Accepts/no write | Accepts/no write | Real selected-day AND range open/read succeed; namespace-safe non-UUID; PASS |
| Valid UUID or safe accepted non-UUID with canonical data | Reads captured account/device namespace and active generation | Preserves accepted ID | Changing mirror changes fingerprint and subsequent scope; old entities/outbox/checkpoint retained but hidden from new scope; PASS |
| Storage/entropy failure | Error/unavailable, not missing or empty evidence | May throw, no promised successful creation | Existing source catches differ; failure is not permission to guess identity or clear storage (source-traced, not new executed fault matrix) |

`MISSING_MALFORMED_DISTINCTION = PRESERVED`. A missing mirror currently permits creation, but **null is not proof of a fresh installation or absence of old IDB/authority/history**. Future recovery must not infer clean construction from null; admitted/lost-metadata scope continues to follow the existing lifetime rules. No changed missing behavior is implemented or approved here.

`ESTABLISHED_IDENTITY_SYNTAX_POLICY = CURRENT_COMPATIBILITY` (recommended): preserve exact currently helper-accepted **and namespace-safe** historical values, including 36 `a` and mixed case. Do not lowercase device IDs or retroactively impose RFC shape. Newly allocated IDs already use `crypto.randomUUID()`; a strict generation/validation rule for *new targets only* may be specified separately without rejecting established safe values. Do not confuse strict lifetime UUIDv4 validation in the dormant foundation with established device validity. PD04/PD05 still require explicit owner disposition in this correction package; previously approved exact-ID compatibility constraints cannot silently be superseded.

## 5. Data reachability and immutable identity

Source facts: [namespace fingerprint](../src/lib/localDatabase/namespace.ts) 32-36 hashes JSON `[userId, projectRef, deviceId, schemaVersion]` exactly; generation is excluded from that hash but separately key-scoped. [Repository](../src/lib/localDatabase/repository.ts) 421-423 freezes namespace; 444-489 initializes/reads metadata by fingerprint; 518 selects that namespace's active generation. [Schema](../src/lib/localDatabase/schema.ts) 21-41 keys metadata by namespace and generation/entity/outbox/checkpoint by namespace plus their respective dimensions. Domain reads at repository 1960-1991 do not scan other namespaces. A new mirror cannot recover the old hash by opening the same database name `absinthe-local-v2`.

| Durable/current object | After replacement device ID, current new opener | Old scope retained? / prohibition |
| --- | --- | --- |
| Namespace/fingerprint | Different exact input -> different namespaceKey; device case change also differs | Old keys remain; no alias/rename/hash normalization |
| Metadata/active generation | New fingerprint may initialize its own initial generation; it does not select the old active generation | Old metadata/generation remain; matching generation text does not unify scopes |
| WorkoutSessionV1/entities/tombstones | New scoped index cannot see old sessions or tombstones | Preserve record, owner/account, revision, deleted state and provenance; no move/copy/adoption |
| Outbox/pending local work | New namespace's list does not list the old pending operation | Old namespace/device, mutationId, idempotencyKey, payload/hash, dependency, binding, digest/CAS, receipt, lease/status remain bound to old scope |
| Checkpoints/conflicts/remote authority/resync/reset metadata | New namespace cannot inherit old scoped checkpoint, epoch/binding or recovery session | Old state is not transferable proof; no cursor transplant/rebase/rebind |
| Cached routine session/transport and in-flight work | Already successful factory session retains old frozen repository, rather than following mirror on every method | Do not silently evict/reopen, drain/discard, alter failed-promise retry or writer readiness |

[Outbox identity](../src/lib/localDatabase/outboxIdentity.ts) binds mutation/idempotency derivation to namespace/generation/domain/entity/local revision/operation/payload hash. [Types](../src/lib/localDatabase/types.ts) preserve namespace/device and bound delivery identity. Changing the mirror is therefore not harmless configuration repair even if it is a one-key localStorage write. Retained bytes != normal reader reachability != safely resumable writer state.

Executed reachability controls for BOTH mixed-case valid UUID and 36-`a` original ID: real repository commits one active WorkoutSessionV1 and pending/unbound outbox; checkpoint sequence 42; original reader sees session. Synthetic mirror corrupted to `malformed`; reader rejects; raw creator replaces with fixed UUID. New selected-day/range readers see zero canonical sessions, new outbox empty and checkpoint null. Original entity, metadata, generation, outbox and checkpoint compare exactly unchanged. Old range reader's current-device fence rejects. Test-only restoration of exact original ID makes the session readable again without data movement. This is an ordered source-mechanism reproduction, NOT production recovery or proof of a real concurrent writer incident. Bound-request preservation, multi-generation history and crash-safe production recovery remain future acceptance, not executed claims.

Recovery provenance is unresolved today: database_meta stores the fingerprint rather than a trustworthy mirror history; optional outbox `deviceId` or a candidate hash can support cross-checking but is not an automatic issuer. Multiple accounts/namespaces/generations, absent outbox, stale backups and corrupt records defeat guessing. A lone matching/only populated namespace is not enough to infer current device ownership. No whole-store discovery scan, account reassignment or hidden namespace adoption is authorized in the reader. A future operator inventory needs explicit scope/privacy/ownership/provenance rules and must account for all residual data, not just today's workouts.

## 6. Writer divergence: demonstrated capability, not invented race

`READER_CREATOR_SEMANTIC_DIVERGENCE = YES`. Reader rejects `malformed` unchanged; both production raw creator paths can replace it. The runtime controller reaches its creator after account and online checks, independent of child reader gates. The routine factory reaches its creator on account cache miss from bootstrap, save/sync, snapshot/export, reset or recover. Thus replacement can occur before a reader attempt or after a failed reader attempt; the latter ordered sequence is reproduced. No mutual identity lock/creator barrier is present. This is source-proven capability/ordering risk, not evidence that a particular user's mirror raced in the wild.

Nuance: healthRoutineSync 824-850 caches a promise keyed by the supplied account. It captures identity before awaited open, caches even a rejected IIFE promise, has no production eviction on sign-out/account switch, and successful methods use captured repository/transport (119-145). A-B-A may reuse A's old scope. Snapshot/reset/recover are not guaranteed to invoke a fresh helper if cached. Another uncached account or independent control-plane start still can. Do not claim every writer call rewrites identity or every cached writer must be shut down.

Correcting *all* malformed-identity acquisition semantics eventually requires an owned role-aware boundary that prevents new creator replacement bypasses during/after controlled recovery, including late reader guards, exports/restore and other realms. Routing alone can preserve the raw helper's existing output (R2-U); **unifying its invalid-ID policy cannot**. Denying/replacing/retiring/reopening existing compatibility sessions changes writer availability/identity/cache/recovery semantics and crosses the fixed writer firewall. Reader-only locks cannot constrain an old raw creator; changing a single helper import is not proof of whole-scope coordination. Do not silently make routine/controller startup fail in a poisoned cached promise to protect the reader. Future transition must explicitly prove preserved writer behavior or obtain separate high-risk authorization; policy approval cannot waive that proof.

## 7. Candidate policies A-F and orphaning matrix

These are proposed policies, not implemented/approved alternatives. Labels below mean: `PRESERVES_REACHABILITY` = preserves the relevant prior readable scope (or no prior records in the explicitly verified-empty case), **not necessarily repairs current failure**; `MAY_ORPHAN` includes leaving known residual data hidden and any unproved access guarantee; `DESTRUCTIVE` includes erasure or rotation that knowingly removes the sole supported access path; `INAPPLICABLE` = cannot address that scenario as defined. Conditional qualifications are mandatory.

Scenarios: **A** malformed mirror, verified no canonical namespace ever created; **B** malformed mirror has already been replaced by another path, residual prior scope may exist; **C** safe accepted non-UUID with data; **D** broad-format-accepted unsafe value (36 hyphens); **E** valid UUID with data; **F** mirror changes while old active WorkoutSessionV1 remains. B/F explicitly cover historical residuals; D's current unsafe string cannot itself have opened a namespace under this validator, but that does not exclude other historical scopes.

| Candidate | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| A Fail-closed + actionable unavailable, no identity write | INAPPLICABLE (no restoration mechanism) | MAY_ORPHAN (no old-scope recovery) | PRESERVES_REACHABILITY | INAPPLICABLE (failure retained) | PRESERVES_REACHABILITY | MAY_ORPHAN (leaves prior scope hidden) |
| B Namespace-safe pre-open validation only, compatibility retained | INAPPLICABLE | MAY_ORPHAN | PRESERVES_REACHABILITY | INAPPLICABLE (early error only) | PRESERVES_REACHABILITY | MAY_ORPHAN |
| C New identity, no move/copy/adoption or explicit old-scope reader | PRESERVES_REACHABILITY only with A's independently proven no-data premise | MAY_ORPHAN; DESTRUCTIVE if sole old access knowingly lost | MAY_ORPHAN / DESTRUCTIVE if forced rotation | MAY_ORPHAN if residual scope exists; unsafe string is not empty proof | MAY_ORPHAN / DESTRUCTIVE if forced rotation | DESTRUCTIVE if sole old access knowingly lost |
| D Explicit full migration with reviewed old/new read + writer protocol | PRESERVES_REACHABILITY only after no-data proof; migration unnecessary | MAY_ORPHAN until ownership and every residual scope are proven | MAY_ORPHAN until exact migration/rollback proven; not needed for safe value | MAY_ORPHAN until historical ownership resolved | MAY_ORPHAN until proven; not needed for valid value | MAY_ORPHAN until crash/concurrency/writer/access proof |
| E Exact logical ID plus derived safe storage alias | MAY_ORPHAN if prior representation unknown | MAY_ORPHAN | MAY_ORPHAN if alias changes existing hash; exact no-op preserves | MAY_ORPHAN (new representation != historic hash); not approved | MAY_ORPHAN if changed; exact no-op preserves | MAY_ORPHAN |
| F Controlled exact-original recovery, no operation without evidence | PRESERVES_REACHABILITY only if no-data proof permits separate fresh-create procedure | PRESERVES_REACHABILITY only if all retained scopes/identity continuity proven; otherwise MAY_ORPHAN and deny | PRESERVES_REACHABILITY: keep exact safe value, no repair | PRESERVES_REACHABILITY only for proven prior safe scope restoration/no-data branch; otherwise MAY_ORPHAN and deny | PRESERVES_REACHABILITY: keep exact valid value | PRESERVES_REACHABILITY only with exact original scope + writer/currentness evidence; otherwise MAY_ORPHAN and deny |

A/B are useful non-mutating interim boundaries but **do not CLOSE REL05G5A-001**. Already hidden residuals are not caused by A/B; those rows say these policies do not restore their access. A broader strict-UUID B variant would wrongly reject C and change E's accepted set; it is not the selected B. Unsafe early validation must not make safe non-UUID legacy values invalid.

C cannot honestly be called “non-destructive reidentification” when new ordinary readers have no old-namespace path. An explicit old-ID read-only scope selector would itself be new ownership/provenance/public-currentness architecture, not an existing reader feature; it needs review and does not solve cached writer identity. Do not invent dual ownership, flatten old data into new evidence, or advertise retained bytes as recovered.

D can be considered only in a separately authorized high-risk program. It needs complete source/target namespace/account ownership, active and historical generations, all entities/tombstones/provenance, conflicts/metadata/checkpoints, outbox dependencies/payloads/receipts/bindings, pending/in-flight operations, unsaved UI, exact eligibility and concurrent old-client retirement. Define crash-atomic durable intent and idempotent resume, cross-localStorage/IDB failure boundaries, verified cutover, access during recovery, abort/rollback and no duplicate remote delivery. Existing namespace-bound IDs/digests cannot simply be recomputed/rebound or checkpoints transplanted; any inability to preserve them blocks the scope. Clearing old data, overwrite, loss of supported access or dropping pending work is DESTRUCTIVE, not the default. Schema/backend change remains unauthorized; if a future design needs it, STOP for separate scope.

E is not byte-preserving just because a logical string remains in memory. Current fingerprint hashes the raw exact device string; escaping/hashing/base64/normalizing it changes key identity and may outbox identity, cross-version lookup, binding and old-client behavior. Aliasing unsafe strings would require an explicit versioned persistence/ownership mapping and review; none exists. Exact no-op on an already safe value is compatibility, not a repair of unsafe values. Rejected as the minimum solution.

F is selected as the least invasive *future contract envelope*, not a blanket support promise. Prefer proven exact-original safe-ID restoration while every old namespace remains readable and pending writer identity remains immutable. Fresh target creation only when the separately approved procedure genuinely proves no identity-bound residual state, not because the current malformed ID cannot open. No opportunistic automatic replacement or namespace transfer. Ambiguous/multiple/lost-original evidence remains blocked and escalated; F does not close the prerequisite for those cases. If the intended public support includes them, a separately approved D-level identity/writer-transition design is necessary, or an explicit supported-scope decision remains unresolved. Unsupported wording alone cannot claim the runtime prerequisite closed.

## 8. Feasibility and device-lifetime dependencies

Why no reader-only solution: keeping rejected identity cannot make today's validator/open succeed; relaxing it changes the accepted persistence contract; deriving a storage alias changes fingerprint; replacement changes identity; discovering another scope is not proof of ownership. Current bytes do not encode a unique, trustworthy original safe device ID. Error mapping/refresh/restart cannot recover that missing evidence. Therefore the minimum real correction is a **separately reviewed identity/writer-transition prerequisite**, even if its final successful operation is only an exact mirror restoration.

| Proposed part | Global authority dependency / boundary |
| --- | --- |
| Non-mutating classification, earlier safety check and truthful unavailable UX | Independent of E3/Track A; no authority claim, no actual recovery/closure |
| Preserve exact safe established non-UUID/UUID on healthy reads | Current compatibility, no new lifetime claim or E3 requirement just to read |
| Controlled mirror restoration / new target after verified absence | Requires evidence of ownership, exact scope and complete relevant creator/writer coordination; writer boundary **YES** for changed acquisition/retirement/availability semantics. Even exact old-ID restoration can invalidate/reopen a cached newer-ID session |
| Invoke/adopt the existing lifetime foundation or claim admitted authority | Requires its truthful current admission issuer and qualified lifecycle premise; bootstrap is still blocked. Cannot pass `compatibleCreatorsQuiesced:true` from a checkbox, valid mirror, elapsed retry or one reload |
| General identity migration or enforced writer shutdown/cache change | Separate high-risk prerequisite; may overlap old/new coexistence, UI identity and reset-fenced edit blockers without closing them |

`WRITER_BOUNDARY_CROSSED_BY_RECOMMENDED_POLICY = YES`: the recommendation deliberately selects a separately authorized transition contract, not an allegedly writer-neutral reader patch. `DEVICE_LIFETIME_EVIDENCE_REQUIRED = CONDITIONAL`: non-mutating classification and healthy existing local reads do not require completing global qualification. If F claims admitted lifetime or uses the E3 procedure to establish cross-context exclusion, qualified episode-scoped evidence is mandatory before that operation. A different independently reviewed mechanism could prove an appropriately scoped recovery premise without claiming global E3; none is selected or proven here. A cooperative Web Lock by itself cannot exclude existing bypass creators. No blanket requirement to finish all Track A/B/C/D just to draft policy; no waiver of required evidence to perform recovery.

Automatic creator semantics must eventually be reconciled with the recovery owner across all creation-capable paths; approved R2-U **preserves** the old malformed replacement and is not this fix. It remains unimplemented. Creator routing, lifecycle evidence, old/new data-plane coexistence and writer quiescence are distinct proofs, not one boolean. A successful cached same-ID session does not intrinsically need eviction under prior ER-PD03; changed ID, rejected/in-flight/newer session or broader recovery requires specific proof and STOP on unpreserved writer behavior.

## 9. Public recovery UX requirement, not UI implementation

Truthful minimum: identify canonical **local** identity/open unavailable and incomplete source coverage, never verified empty. Healthy verified legacy may remain qualified partial in selected-day/Previous/range; calendar known legacy presence plus unknown elsewhere; both ordinary sources failed -> unavailable. Canonical-only evidence may be completely hidden. Current Health parent mount guards may also withhold desktop Previous/calendar when B1 legacy is unavailable; do not promise projected partial evidence is visible in every layout. Keep #763 persisted distrust separate: typed isolation withholds both sources, not ordinary identity/open partial fallback.

Explain whether recovery is required, unresolved or unavailable under the approved support procedure; distinguish it from remote bootstrap failure and ordinary local-source Refresh. Ordinary Retry may help transient Storage/DB availability or observe an externally *authorized* corrected identity, but cannot fix unchanged deterministic bad bytes. No busy automatic retry loop, silently renewed identity or “restart will repair it” promise. Restart may remove transient in-memory/session state; it does not prove global retirement or restore an original ID. Do not tell users to clear site data, delete database, reinstall/switch profile/origin or run mirror-edit commands as routine guidance.

Before any future identity-changing/manual action, disclose preservation/reachability scope, pending/unsaved work implications, evidence/support cost and whether data could become unavailable. Actions that knowingly remove access are destructive even if bytes persist. Unapproved recovery should be blocked with a non-destructive support path, not a self-confirming checkbox. Do not promise cloud recovery of unsynced local-only sessions or cross-device completeness. Final public EN/KO/JA guidance, accessibility and real supported-mode QA remain required elsewhere.

`LEGACY_COMPATIBILITY_CACHE_FRESHNESS = REQUIRES_POLICY_AND_ACCEPTANCE`; `REFRESH = NOT APPROVED / NOT IMPLEMENTED`. Identity/open recovery neither refreshes `prevData` nor approves that separate policy.

## 10. Product-owner decision package (recommendations, no self-approval)

Prefix below is local to this package: `HEALTH-ID-PD01` through `HEALTH-ID-PD10`. Prior approved DEVLIFE/ADMIT/ER decisions remain intact; if this recovery expands their envelope, obtain separate explicit authorization rather than rewriting them. All rows currently `REQUIRES_PRODUCT_OWNER_APPROVAL`.

| ID | Decision required / recommended choice | Approval state |
| --- | --- | --- |
| HEALTH-ID-PD01 | Established malformed/unsafe mirror: preserve bytes automatically; typed unavailable; only controlled evidence-backed exact-original recovery, otherwise deny/escalate | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD02 | Automatic replacement: NO for established invalid identity. Changing today's raw creator replacement/denial behavior requires separate writer-transition authorization/proof. Missing retains distinct existing role; no inferred clean install | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD03 | Old canonical namespace must remain actually readable after successful recovery, including prior active/history scope and pending state, not merely retained. No new-identity success claim with hidden residuals | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD04 | Grandfather exact namespace-safe currently accepted non-UUID values and case. No historical UUID migration | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD05 | New target allocation uses valid generated UUIDs; strict validation limited to new targets/lifetime as separately specified, never retroactive rejection of established compatible IDs | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD06 | Manual/operator recovery acceptable only as separately scoped supported non-destructive procedure with provenance and verifiable premises; assistance/support commitment not already granted by earlier E3 investigation approval | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD07 | Unresolved state: canonical-local unavailable + qualified legacy partial/unknown, recovery-required/support limitation; never empty or cloud-complete | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD08 | One finite read episode/manual Retry; persistent identity error remains blocked pending justified correction, no automatic repair/retry-until-success | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD09 | Recovery entry requires proven relevant creator/writer coordination, current ownership and immutable pending work. Qualified E3/admission evidence if that authority model is used; no guessed quiescence, shutdown or new denial smuggled into reader scope | REQUIRES_PRODUCT_OWNER_APPROVAL |
| HEALTH-ID-PD10 | Closure only after approved scope/policy, separately authorized recovery/transition implementation, review/corrections, merge/main verification and deterministic reachability/safety/liveness acceptance; unresolved public-support scenarios keep prerequisite open | REQUIRES_PRODUCT_OWNER_APPROVAL |

Technical constraints are not selectable waivers: no fabricated ownership, no silent orphaning, no namespace-unsafe acceptance, no malformed-as-missing, no writer-field mutation or self-issued lifecycle evidence. An owner can choose investment/support scope; it cannot turn unchanged indefinite failure into executed correction. This document selects a recommendation, not ten approvals or implementation readiness.

## 11. Required future acceptance and closure condition

All criteria below are `REQUIRED / NOT EXECUTED` for a future implementation. TEMP mechanism probes are not acceptance of the proposed recovery protocol. The next contract must allocate scope and issuer before code; no schema/source/gate change is authorized now.

| ID | Required direct evidence |
| --- | --- |
| HEALTH-ID-C01 | Exact all-production helper/key/alias/factory/late-guard inventory; no import-time identity I/O; all participating recovery creators route below removable surfaces |
| HEALTH-ID-C02 | Null vs established empty/invalid preserved; entropy/read/write errors not guessed missing; no automatic replacement on reader/final-use failure |
| HEALTH-ID-C03 | Exact safe non-UUID/mixed-case UUID preservation, namespace-unsafe early denial; no broadened validator, alias or strict historical migration |
| HEALTH-ID-C04 | Trusted original-ID provenance + authenticated account/project/device/storage scope; multiple/absent/corrupt/stale candidates deny, no unique-namespace guessing |
| HEALTH-ID-C05 | A-F scenario matrix executed with active/historical generations, entities/tombstones, metadata/conflicts/checkpoints and local-only canonical sessions; successful recovery retains actual readable scope, not just bytes |
| HEALTH-ID-C06 | Pending/claimed/retry/conflict/acknowledged and bound/unbound outbox exact identity/payload/hash/dependency/digest/CAS/binding/receipt/epoch unchanged; no pull ACK/rebase, duplicate send, drop or replay to new scope |
| HEALTH-ID-C07 | Cached successful/rejected/in-flight routine sessions; A-B-A/sign-out, late export/reset/restore/online retry; old/newer-ID scopes and unsaved work. Any cache/readiness/transport transition separately scoped/proven, no blanket eviction |
| HEALTH-ID-C08 | Complete relevant creator exclusion/coordination, old bypass, suspended/restored/cross-surface entry and evidence episode validity; no boolean/timeout/lock-only absence proof |
| HEALTH-ID-C09 | Reviewed durable recovery intent, exact-target idempotent crash resume, Storage/IDB failure/partial-write rollback, repeated recovery/retry; no opportunistic new target or lost supported read access |
| HEALTH-ID-C10 | Deterministic recovery liveness for every supported malformed/unsafe scenario; canonical-only evidence visible again under original verified scope. Unrecoverable cases explicitly unresolved, not PASS via unavailable copy |
| HEALTH-ID-C11 | Selected-day and range behavior agree; original publication tokens revoked on observed identity transition/ABA; account/date/generation/late continuations cannot publish old/new mixed scope |
| HEALTH-ID-C12 | #763 real persisted isolation mapping remains exact, ordinary trusted-scope errors preserve qualified partial; no healthy legacy used to waive canonical scope distrust |
| HEALTH-ID-C13 | Typed public local-only unavailable vs verified-empty, partial calendar unknown, finite Retry, truthful restart/manual/destructive warning; supported physical-mode/copy/accessibility recovery QA |
| HEALTH-ID-C14 | No domain clear/copy/adoption, owner/generation reassignment, identity digest/schema/backend/gate change; full writer regressions and exact-head hosted CI; any needed expansion STOP for distinct authorization |
| HEALTH-ID-C15 | Public-scope owner decisions explicitly approved; implementation independently reviewed/corrected, Final Merge Gate passed, human-merged and exact main verified. No automatic E3/writer/reader/G6 closure |

`REL05G5A_001_CLOSURE_CONDITION`: explicit approved non-destructive support/identity-transition policy **plus** implemented reviewed deterministic recovery preserving existing canonical reachability and immutable pending writer state for every claimed supported case, agreed incremental reader/currentness behavior, regression and required procedure/physical evidence, then merge/main verification. A/B alone, dormant foundation, passing syntax tests, policy/document merge, fresh empty namespace or wording “unsupported” alone do NOT close it. If supported unresolved histories cannot satisfy these constraints, separately scope high-risk migration/design and leave this prerequisite open; no bounded-runtime-readiness claim.

## 12. Executed methodology, validation and limits

Executed 2026-10-09 on the exact baseline using a fresh fake-IndexedDB factory per test, private `FakeStorage`, installed Vitest/happy-dom and real unmodified helpers/namespace/repository/readers/WorkoutSessionRepository. TEMP directory outside repository: `C:\Users\이도현\AppData\Local\Temp\health-established-device-id-20261009`. Config/test were created only there; dependency junction points to existing frontend node_modules. No browser automation, production user localStorage/IDB, Supabase request or physical platform interaction occurred. Test UUID allocation is stubbed; canonical writes/checkpoint/corruption are exclusively synthetic test-owned fixtures, not source implementation or product mutations.

Reproduce from `frontend`: `node node_modules/vitest/vitest.mjs run --config 'C:\Users\이도현\AppData\Local\Temp\health-established-device-id-20261009\vitest.config.mjs'`.

Final result: **1 file / 18 tests PASS**, Vitest 4.1.8, 1.17 seconds reported. Breakdown: missing creation (1), valid exact-case reuse (1), invalid reader vectors (5), same invalid creator vectors (5), unsafe hyphen opens (1), safe non-UUID opens (1), existing-data visibility/immutable residual state/exact-original reopening (2), device-case fingerprint difference (1), fake-storage/factory isolation (1). First TEMP run had 16 PASS / 2 harness failures (`INVALID_OUTBOX_QUERY`: domain filter lacked required entityId). Only TEMP query inputs were corrected to the existing API; no repository/test source changed. Final rerun passed all 18.

SHA256: config `fedb63aa0b87beeff8d504ba87663e34a6b77e53b1ef24c76ba3a7e388b99843`; test `a4cce4e72e23a107ab3d439e5e899ef45c2fa19b8986f605065873f926748f77`. These local TEMP files are supporting, non-authoritative mechanism evidence; not remote/physical evidence artifacts or committed regression coverage. They do not establish production original-ID provenance, complete creator retirement, a safe recovery procedure, bound-request migration, public UX or E3. Full frontend suite/typecheck/build not rerun solely for this docs-only publication; hosted exact-head PR CI is the regression signal, reported separately without circular own-head metadata.

Publication validation: exactly this one Markdown artifact; no tracked runtime/source/tests/config/backend changes; relative source/document links resolve; `git diff --check`; normal dedicated-branch commit/push/Draft PR; clean repository after commit. Supabase skill was used to inspect account/session-dependent sync fan-in with no cloud/schema/security changes; identity recovery remains separate from authenticated session ownership. No full-store scan/clear or source/test change was introduced by probes.

## 13. Frozen authority and single next task

| State | Retained value |
| --- | --- |
| HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED | `false` |
| HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED | `false` |
| HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED | `false` |
| HOME_WORKOUT_COMPOSITE_READER_ENABLED | `false` |
| SEARCH_WORKOUT_COMPOSITE_READER_ENABLED | `false` |
| PUBLIC_READER_ACTIVATION / HEALTH_PARENT_PUBLIC_READER_ACTIVATION | `NOT_AUTHORIZED` |
| REL05G5A-001 | `ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION` |
| LEGACY_COMPATIBILITY_CACHE_FRESHNESS / REFRESH | `REQUIRES_POLICY_AND_ACCEPTANCE / NOT APPROVED / NOT IMPLEMENTED` |
| TRACK_A_STATUS | `TRACK_PARTIAL / PATH_A_QUALIFICATION_PARTIAL` |
| E3_FEASIBILITY | `NOT_ESTABLISHED` |
| LIFECYCLE_EVIDENCE_SOURCE | `REMAINS_UNAVAILABLE` |
| BOOTSTRAP_ADMISSION | `BLOCKED_BY_EVIDENCE_QUALIFICATION` |
| R2-U | `NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF` |
| Tracks B/C/D | `NOT_EXECUTED` |
| LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP | `UNRESOLVED` |
| Seven live-writer blockers | `OPEN`: unbound pre-reset create; rollback visibility; old/new writer coexistence; mounted UI identity integration; canonical field ownership; remaining analytics/projection/public claims; reset-fenced local-edit policy |
| Local DB / schema / V1 | `7 / 1 / WorkoutSessionV1 unchanged`; stores/indexes/keyPaths unchanged |
| Supabase/RLS/backend/remote API | Unchanged |
| Canonical writer/bind/push/pull/resync/reset/G6 | No activation or new implementation |
| Physical qualification | `DEFERRED_UNCHANGED` |

Characterization blockers: 0. **Correction implementation is NOT authorized/ready**: product decisions, original-identity/reachability proof and creator/writer-transition/evidence dependencies remain. This is not closure of any seven-writer blocker, #745/Slice 2, Track A/E3/admission or Health public readiness.

Exactly one recommended next task: **`REL_05G_HEALTH_PARENT_ESTABLISHED_IDENTITY_RECOVERY_CONTRACT_AND_PRODUCT_DECISION_01`**. Separately scope the high-risk identity/writer-transition contract and human decisions for F's exact-original/no-orphan recovery envelope; resolve provenance, supported ambiguous histories, creator coordination and cached/pending writer semantics before any correction code. Do not disguise this as a reader patch or automatically commission migration. Independent review of this characterization comes before that future task; no implementation, Ready, merge or auto-merge in this publication.

REL05G5A_001_CHARACTERIZATION_READY_FOR_REVIEW
