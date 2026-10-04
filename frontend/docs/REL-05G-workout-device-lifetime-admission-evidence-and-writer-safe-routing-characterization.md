# Workout bootstrap admission: evidence and writer-safe routing characterization

Workstream: `REL_05G_WORKOUT_DEVICE_LIFETIME_BOOTSTRAP_ADMISSION_EVIDENCE_AND_WRITER_SAFE_ROUTING_CHARACTERIZATION`.

## 1. Result, baseline and authority ceiling

Historical primary result before ER decision approval: **ADDITIONAL_PRODUCT_PLATFORM_DECISION_REQUIRED**.

Current post-approval status: `PRODUCT_DECISION_REQUIRED = SATISFIED`; `DEVLIFE-ER-PD01-PD03 = PRODUCT_OWNER_APPROVED`. Technical dependencies remain `EVIDENCE_SOURCE_PREREQUISITE = UNSATISFIED` and `BOOTSTRAP_ADMISSION_IMPLEMENTATION = NOT_READY / BLOCKED_BY_EVIDENCE_QUALIFICATION`. Product approval does not establish implementation readiness, lifecycle evidence or live cutover safety. This approval record remains pending independent review; the package is not CLOSED_IN_MAIN.

- `LIFECYCLE_EVIDENCE_SOURCE = UNAVAILABLE` in the current production browser/PWA stack. A usable new issuer requires a separately selected, justified capability/procedure; policy approval does not create that capability.
- `WRITER_SAFE_ACQUISITION_ROUTING = FEASIBLE_WITHOUT_WRITER_SEMANTIC_CHANGE` only for the bounded, synchronous **UNADOPTED / NO-GUARANTEE** routing seam described below. This does not mean the complete admission prerequisite is implementation-ready.
- General writer transition: **UNRESOLVED / CONDITIONAL_SEPARATE_HIGH_RISK_PREREQUISITE**. The source does not prove that every successful cached writer must be evicted; nor does it prove a general live authority cutover safe.

Repository: `Absinthe-6785/Absinthe`; canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`. Base/current main at characterization: `aa3102956b19f7eeea3307e8bda8805d9f0a50ec`. PR #748 is merged, characterization head `e2c82a0ddfdafff064fa74600034accafddc4340`; main-push run `37175901823` is 5/5 SUCCESS. PR #745 remains Draft/Open/Unmerged at `2ad2ec573490b5c0a507b23bb06e98cba34c65be`, untouched.

The prior prerequisite implementation stopped before editing: `NO_TRUTHFUL_PRODUCTION_LIFECYCLE_EVIDENCE_ISSUER` (A) and `WRITER_FIREWALL_BLOCKS_NAIVE_CREATOR_DENIAL` (B). No implementation branch/PR/source changes/commit/push resulted. This branch publishes characterization and the explicit human approval record only, not implementation.

Normative dependencies: [approved bootstrap-admission prerequisite](REL-05G-workout-device-lifetime-bootstrap-admission-prerequisite.md), especially sections 8-13, and [approved device-lifetime contract](REL-05G-workout-device-lifetime-authority-contract-and-plan.md). DEVLIFE-ADMIT-PD01-PD10 remain PRODUCT_OWNER_APPROVED. Their implementation-readiness planning label preceded the attempted implementation's STOP; this companion records the exposed dependencies, not a retrospective rewrite of PR #748. No approved constraint is relaxed. All admission and original acceptance criteria remain REQUIRED / NOT EXECUTED.

## 2. Fresh source inventory and ownership

Current inventory is still **nine direct creation-capable calls across six groups**, with no drift. Counts exclude helper-internal delegation and the runtime port invocation; both are nevertheless traced.

| Caller group / source | Direct calls at base | Reachability / role |
| --- | --- | --- |
| [healthRoutineSync](../src/lib/healthRoutineSync.ts) | 830 (1) | Production persistence factory; bootstrap/save/sync/export/snapshot/reset/restore fan-in |
| [workoutRuntimeAuthority](../src/lib/workoutRuntimeAuthority.ts) | 177 (1) | Production control-plane port; invocation at 86, catches acquisition failure to null |
| [workoutRangeReader](../src/lib/workoutRangeReader.ts) | 37, 75, 80 (3) | Constructor and late guards; `readEstablishedWorkoutDeviceId` creates on absence |
| [workoutSelectedDayReader](../src/lib/workoutSelectedDayReader.ts) | 37 (1) | Constructor; helper re-export at 21 |
| [verifiedWorkoutRangeSnapshot](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts) | 185 (1) | Canonical-open preparation; catches helper failure, open reports error |
| [useHealthSelectedDayComposite](../src/components/views/features/health/useHealthSelectedDayComposite.ts) | 139, 222 (2) | Reuse and late currentness guards, not merely initial startup |

[workoutLocalReaderAuthority](../src/lib/workoutLocalReaderAuthority.ts) contains the two helpers and the plain mirror key. `healthRoutineSync` re-exports the raw creator. The established-reader alias creates only when the key is null; malformed/empty existing values throw. The raw creator instead repairs missing/format-invalid values. A future owner must preserve that role distinction, not turn a read guard into a recovery creator.

There are two mirror-write implementations: raw helper line 11 and dormant [device-lifetime foundation](../src/lib/workoutDeviceLifetimeAuthority.ts) line 265. The latter has no production caller/import outside its module. Its boolean admission assertion checks the supplied claim, not a production issuer. Its factory supplies Storage, Web Locks and entropy, not lifecycle proof. Raw-mirror checks in remote client/push/pull and coordinator are currentness fences, not issuers. Exports in [note export](../src/components/views/noteview/actions/useNoteImportExportActions.ts), [restore](../src/lib/vaultRestorePipeline.ts) and [Settings](../src/components/views/SettingsView.tsx) all feed the same production session; routing only visible Health bootstrap misses these entries.

The current frontend source/public/scripts/index/Vite/package/workflow inventory contains no Service Worker registration, PWA worker plugin, BroadcastChannel/worker coordinator, host-issued lifecycle nonce, privileged bridge, membership registry or production bootstrap-admission issuer. [main](../src/main.tsx), [AppContent](../src/components/AppContent.tsx), [index](../index.html) and [Vite config](../vite.config.ts) provide no construction proof. Mobile/install icons and backup app-version `1.0.0` are not admission evidence. Lazy imports alone create no device; actual factory/constructor/late-guard calls can.

## 3. Existing-install evidence: exact ceilings

The following classifications concern retirement in the relevant device-global **Storage / Web Lock authority scope**, not authentication or namespace ownership. An API's existence is not a production issuer. No candidate below is PROVES_RETIREMENT today.

| Candidate | Classification | What it can / cannot establish |
| --- | --- | --- |
| Web Locks request/query | PROVES_ONLY_COOPERATING_CONTEXT_STATE | Serializes participants requesting the same lock; query is a held/pending-lock snapshot, not an inventory of raw creators |
| localStorage mirror/authority/marker | HEURISTIC_ONLY | Present bytes/history/coherence; missing bytes or a valid UUID cannot prove no old realm |
| BroadcastChannel | PROVES_ONLY_COOPERATING_CONTEXT_STATE | Replies from participating eligible channel objects; silent/nonparticipating realms are not disproved; no production channel today |
| storage events | PROVES_ONLY_COOPERATING_CONTEXT_STATE | Observed writes/listeners, not absence; silence and delayed delivery do not certify retirement |
| Service Worker/client enumeration | UNAVAILABLE | No production SW; hypothetical enumeration has a broader ceiling than voluntary replies, but is not implemented or an atomic admission/re-entry fence |
| app build/version | CURRENT_REALM_ONLY | Reviewed protocol identity of this execution can be implemented; backup version alone is not even the reviewed bundle allowlist |
| deployment identity/time | HEURISTIC_ONLY | What was served/deployed, not what all resident/offline/restored realms execute |
| navigation type | CURRENT_REALM_ONLY | This document's navigation, not retirement of browser/PWA peers |
| sessionStorage | CURRENT_REALM_ONLY | Window/session-local state; not device-global inventory or freshness proof |
| visibility/lifecycle | CURRENT_REALM_ONLY | This document's activity; hidden/suspended is not terminated |
| beforeunload/pagehide | CURRENT_REALM_ONLY | Local lifecycle/flush attempts, not complete all-context shutdown or durable retirement certificate |
| PWA install state | HEURISTIC_ONLY | Presentation/installation does not certify a new authority/storage scope or old-peer exit |
| browser restart assertion | OUTSIDE_WEB_APP_TRUST_BOUNDARY | Current page cannot attest complete relevant process/container retirement and restored-code re-entry merely from a restart claim |
| controlled reload | CURRENT_REALM_ONLY | Reload of one document does not establish global scope retirement or prohibit old-bundle re-entry |
| account/session state | HEURISTIC_ONLY | Authenticated account/session and account fencing, not device-global browser lifecycle |

Primary-source ceilings: [Web Locks, including query](https://w3c.github.io/web-locks/); [BroadcastChannel](https://html.spec.whatwg.org/multipage/web-messaging.html#broadcasting-to-other-browsing-contexts); [Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html). The conclusion about Absinthe's raw helper bypass is an inference from those ceilings **and section 2's source**, not a specification claim about every conceivable browser architecture.

Important SW nuance: [clients.matchAll](https://w3c.github.io/ServiceWorker/#clients-matchall) with `includeUncontrolled: true` and appropriate type can enumerate eligible uncontrolled clients too; it is not limited to voluntary new-protocol members. Eligibility/storage-key/execution conditions and a returned snapshot are not exact loaded-build attestation, a creator-entry barrier, or proof that future restored entry is compatible. Claim/update does not rewrite already executing old code. A new controlled delivery/re-entry protocol might change the available evidence, but is absent today and requires separate feasibility/qualification. This characterization does not claim that all possible web-only architectures are impossible or that SW necessarily omits every suspended client.

[Navigation timing](https://www.w3.org/TR/navigation-timing-2/#dom-performancenavigationtiming-type), [HTML document lifecycle](https://html.spec.whatwg.org/multipage/browsing-the-web.html) and [Web App Manifest](https://w3c.github.io/manifest/) do not supply the missing production issuer. [Supabase getSession](https://supabase.com/docs/reference/javascript/auth-getsession) reads the attached session storage and can refresh a session; the account fence in the transport is useful but orthogonal to global device retirement. No auth/session SDK or configuration change is proposed.

### Indistinguishable worlds

X has no incompatible resident creator. Y has the same current-realm bytes/locks/build/account observations, plus a silent/suspended old realm which never joins new coordination. Current Absinthe has no inventory/control facility that excludes Y. Lock availability, registry absence, channel/event silence, UUID, current deployment and timeouts yield the same observation in X/Y. Hence **WEB_ONLY_OLD_CONTEXT_RETIREMENT_PROOF_UNAVAILABLE** for the **current product and evidence channels**, not a universal prohibition on future qualified platform capabilities. A user checkbox/restart statement is intent, not machine proof.

## 4. Clean-construction premise

PD03 allows a genuinely fresh container by construction, not an inference from missing metadata. No inspected current production component provides that premise: **CLEAN_CONSTRUCTION_PRODUCTION_SOURCE_UNAVAILABLE**.

| Candidate | Exists today / before creator? | Fresh authority-scope proof? | PD08 and scope consequence |
| --- | --- | --- | --- |
| First PWA install | No issuer; icons are not lifecycle tracking | No: first install does not establish fresh origin storage | No reusable admission; physical partition/lifecycle unknown |
| SW first control | No registered worker/protocol | No: control does not imply no preexisting data/realms | New web delivery capability would need review |
| New origin deployment | Existing delivery, no fresh-container verifier | Deployment at same origin is not construction; a different container changes ownership | E4, explicit migration/product scope, not a workaround |
| Browser profile creation | No privileged observer | A proven fresh profile could be a premise; page cannot prove creation | External capability; profile switching is not authorized |
| Account creation time | Auth exists, no lifecycle issuer | No: account is not Storage/lock container | Cannot extend evidence across sessions/re-entry |
| Missing local metadata | Observable before helper | No: deletion/partial loss/old realm gives same bytes | Approved missing/marker/crash rules still apply |
| Application install metadata | No trustworthy fresh-container metadata | No current proof | Requires platform attestation and physical qualification |
| Server registration | No device-lifecycle protocol; account/server facts exist | No: server does not observe local resident contexts | Would need independently justified client/platform evidence |
| Host/launcher nonce | No bridge/issuer | Only if trusted host actually constructs/fences complete scope; random page nonce proves nothing | E2/E4 capability; one scoped episode, not eternal latch |
| Native wrapper / extension / privileged helper | None | Potential externally justified construction/lifecycle capability, not current evidence | Deferred platform expansion, approval and QA required |

No candidate survives beyond PD08 by merely retaining a record. Each later restart/re-entry needs the approved episode's justified scope or renewed evidence. No storage clear, origin/profile switch, data transfer or guessed rebootstrap is recommended.

## 5. Health writer ownership and the naive-denial defect

Exact source sequence in `healthRoutineSync.ts:824-850`:

1. `productionSessions` is a module-lifetime Map keyed by the exact supplied accountId, holding a Promise of `HealthRoutineSyncSession`.
2. Cache miss starts an async IIFE. The raw helper synchronously reads/creates the device ID **before** the first await at repository open. It preserves a format-accepted existing string's exact case; Storage/entropy errors throw synchronously at the helper.
3. Repository open uses that ID with the existing user/project/generation/schema values. The transport and session are then constructed. [Local repository](../src/lib/localDatabase/repository.ts), lines 414-423, freezes a copy of its namespace; the session's repository/transport are readonly references.
4. The IIFE's promise is inserted in the map immediately after the IIFE returns, before its awaited open settles. A synchronous helper error becomes a rejected IIFE promise, and that rejected promise is cached too. Subsequent factory calls reuse it; there is no eviction/retry-open/catch-finally cleanup.
5. Production bootstrap, commitState/save, sync, snapshot/export, reset and recover await the same cached session. Its scope/worker identity derives from the captured repository deviceId, not a new helper call on each method.
6. Account switch/logout does not clear this map. A-B-A reuses A's cached session promise during this module lifetime. The async factory's returned wrapper adopts that cached promise; returned-wrapper object identity is not the cache guarantee. `close()` exists on the class at 819, but the production factory/adapter never calls it or removes entries. Tests of directly constructed sessions do not constitute production retirement.

[useRoutinePresetController](../src/components/views/features/health/useRoutinePresetController.ts), lines 113-167/195, initially has no account binding, awaits persistence bootstrap, catches failure without binding, and gates CRUD/background sync on `accountReady`. Naively denying a formerly valid creator when admission is unavailable can reject and poison the cached session promise: routine readiness stays false, save is gated, and export/reset/recover reuse the rejection. Adding eviction changes existing retry/recovery ownership; it is not a harmless remedy.

Do not overstate this as an automatic failure of the independent AppContent Health/Supabase startup barrier. That barrier is separate. The proven regression is routine persistence/controller availability plus persistence-dependent controls. Making the new admission barrier govern whole Health startup would itself cross the firewall. G5A control-plane acquisition is independently scheduled/cancelled, not a global writer/device barrier.

**BLOCKER B is confirmed for naive denial, not for all routing.** Minimum candidate seam: a domain owner synchronously delegates the **same raw helper once, at the same point inside the existing IIFE**, with unchanged arguments/result/exceptions; no await, lock, evidence read, policy denial, namespace validation expansion, cache edit or fallback is added in the unadopted lane. It preserves exact storage/entropy call order and the wrapper's existing rejected-promise semantics. Merely changing an import without tracing aliases/late guards is not complete routing.

## 6. Writer firewall matrix

R2-U means the narrow unadopted seam, not admission transition. R3 means adding enforced pre-routing writer quiescence, not merely externally observing a stopped app. R4 leaves the writer unchanged/raw. R5 is current behavior plus authority-disabled deferral. R2-T means a general live cutover not yet proven.

| Dimension | R1 naive deny | R2-U | R3 enforced quiescence | R4 reader-only | R5 defer | R2-T |
| --- | --- | --- | --- | --- | --- | --- |
| deviceId output | AVAILABILITY_CHANGE | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| namespace | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| repository open identity | AVAILABILITY_CHANGE | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| productionSessions cache ownership | UNCHANGED | UNCHANGED | OWNERSHIP_CHANGE | UNCHANGED | UNCHANGED | UNKNOWN |
| rejection caching | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| retry behavior | AVAILABILITY_CHANGE | UNCHANGED | RECOVERY_CHANGE | UNCHANGED | UNCHANGED | UNKNOWN |
| bootstrap readiness | AVAILABILITY_CHANGE | UNCHANGED | AVAILABILITY_CHANGE | UNCHANGED | UNCHANGED | UNKNOWN |
| recovery | AVAILABILITY_CHANGE | UNCHANGED | RECOVERY_CHANGE | UNCHANGED | UNCHANGED | UNKNOWN |
| reset | AVAILABILITY_CHANGE | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| outbox identity | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| digest | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| binding | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| CAS | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| receipts | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| transport | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |
| authorityEpoch | UNCHANGED | UNCHANGED | UNKNOWN | UNCHANGED | UNCHANGED | UNKNOWN |

UNCHANGED means no proposed change to the field/algorithm, not successful availability or proof of authority. For example, R1 retains the rejection-cache algorithm but introduces new persistent failures. R2-U changes acquisition ownership **routing**, not `productionSessions` cache ownership or writer ordering. Any R3/R2-T UNKNOWN must be resolved, not treated as UNCHANGED. No identity replacement/reopen/rebinding is implicit in any viable metadata-only proposal.

Required future R2-U proof: differential vectors for accepted mixed-case ID, missing/invalid/empty key, Storage read/write and entropy failure; same synchronous call/exception sequence; helper failure still captured in the same IIFE and same promise cache; successful/rejected reuse across bootstrap/save/snapshot/reset/recover/account-switch; identical repository namespace and all request/outbox/digest/binding/CAS/receipt/transport/epoch vectors. Preserve established-reader versus raw-creator roles. Imports remain lazy; view/remount/StrictMode/retry/late entry cannot introduce a bypass. These are future tests, not executed acceptance here.

## 7. Routing alternatives and contract compatibility

| Option | C01 scope / writer semantics | Authority confusion / forward-only | Feasibility, prerequisites and verdict |
| --- | --- | --- | --- |
| R1 NAIVE_FAIL_CLOSED_ALL_CREATORS | Could route all calls, but new writer denial violates C13/firewall | Denial alone is not truthful C02 evidence | REJECT: source-proven readiness/cache regression; separately reviewed writer redesign cannot be smuggled into routing |
| R2 SHARED_OWNER_WITH_LEGACY_COMPATIBILITY_LANE_AND_ADMITTED_AUTHORITY_LANE | All paths can structurally route; only R2-U writer invariance is currently supported | Explicit disjoint capabilities; no automatic promotion/fallback; future complete-scope evidence mandatory | BOUNDED CANDIDATE, NOT IMPLEMENTATION-READY: ER-PD02 selects conditional no-guarantee preparation as a sequencing direction only; issuer qualification, transition proof and separate implementation review still needed |
| R3 FULL_WRITER_QUIESCENCE_BEFORE_ANY_ROUTING | Potentially full scope but imposed shutdown/cache handling changes C13 | Quiescence of known writers still cannot exclude unknown old realms | NOT REQUIRED for a transparent R2-U seam; if imposed for cutover, separate high-risk writer prerequisite plus evidence needed |
| R4 SEPARATE_READER_ONLY_OWNER | Fails complete C01: writer remains a creation/recovery bypass | Raw writer can mutate mirror despite reader's locks; no admitted lifetime guarantee | INSUFFICIENT for admission; permissible only as explicitly unadopted/default-OFF/no-guarantee deferral |
| R5 KEEP_CURRENT_ACQUISITION_AND_DEFER_AUTHORITY | No C01 routing completion; exact writer behavior retained | No confusion only because authority remains unavailable | FEASIBLE current safe posture, not a solution/issuer; does not unblock Slice 2 |

The approved policies allow unsupported admission, but do not waive all-path routing, forward-only guarantees or writer preservation. R2-U is a proposed staged preparation, **not** satisfaction of C01-C03 as a complete admission prerequisite. Their accepted barrier/race/issuer obligations still apply to the eventual authority-entering implementation. ER-PD02 now records the separate explicit product/work-scope choice for conditional preparation before a useful issuer exists, not a silent reinterpretation of the original approved policy. Any preparatory task remains separately scoped after the package closure gate in section 14.

An UNADOPTED compatibility phase can exist with NO guarantee and all authority-dependent readers unavailable/default-OFF. It cannot be used in an authority-mandatory scope merely because admission later failed. Once marker/authority history makes the approved forward-only rules mandatory, raw missing/invalid-key repair must not remain reachable through the compatibility lane. A reader-only owner while an old/raw writer remains capable of mirror mutation cannot solve that requirement.

### Two modes and minimum capability separation (design only)

- `LegacyCompatibilityDeviceIdentity`: exact legacy string/role output, NO lifetime/admission claim; writer use only under the explicitly permitted unadopted phase. Do not assert `compatibleCreatorsQuiesced` or attach a lifetime.
- `BootstrapAdmissionEvidence`: sole reviewed issuer's scoped, exact build/protocol and current acquisition-episode evidence; not a checkbox, arbitrary boolean, token copied from UI, or persistent proof-of-absence latch.
- `AdmittedDeviceAuthority`: owner-issued capture under the approved exclusive protocol, then exact lifetime token/final-use protocol. Legacy identity cannot structurally satisfy this API. No naked-string overload, cast-based upgrade or `mode` default silently selects admission.
- `AuthorityUnavailable`: bounded typed scoped result; unavailable is not verified-empty, migration success, whole-Health failure or legacy admitted fallback.

Use disjoint branded/opaque owner-issued capabilities plus runtime provenance/currentness enforcement; a TypeScript label alone cannot make external evidence truthful. Views may display state, never own issuance/mode/promotion. A serialized DTO cannot grant continued authority beyond its episode/lifetime. Keep final-use checks under the source-owned owner; observed revocation is permanent for that token.

Admitted mode uses existing marker -> prepared TRANSITIONING revocation -> mirror -> READY protocol with exact-case device ID and strict lifetime UUIDv4, exclusive device-global lock, non-nested shared final-use locking with synchronous decisive local use, and no network/user wait inside locks. The existing Slice 2 requirement for async durable-generation verification inside the final-use lock remains separate and unchanged; it is not lifecycle proof. READY reuse requires coherent exact device/lifetime; marker-only crash, retained marker/missing authority and unexplained/malformed metadata remain unavailable; only exact prepared intent resumes. Existing creator recovery triggers are not expanded. Lifetime is NOT a namespace, outbox, digest, binding, CAS, receipt, transport or epoch field. No new metadata/schema/registry is selected here.

## 8. Transition and cached-writer retirement

Before authority entry, prove **all** of the following, not merely completion of the R2-U refactor:

- Every new-build creator/alias/late guard/exports/restore/retry entry is routed; creator versus read-only role is explicit. No compatibility creation/repair remains callable after mandatory authority entry in any participating realm.
- Truthful current lifecycle/construction evidence covers the actual complete Storage/lock scope, excludes incompatible old execution, constrains re-entry/restored bundles, and names the exact reviewed build/protocol. Registry age/absence cannot fill a gap.
- Evidence validity is one controlled acquisition episode (PD08), not later restart/re-entry by default. Storage/lock failure and mandatory-history loss never reopen a compatibility fallback.
- Identify successful, rejected and in-flight `productionSessions`, worker queues, pending outbox/writes, unsaved UI work, reset/recovery and repository identity. Do not alter/lose/rebind them or claim that auth cancellation retires device-global contexts.
- Prove immutable exact device/namespace continuity for any retained writer, plus no surviving raw creator capability. A created authority using another device cannot silently reuse that repository/outbox.

**Conditional same-ID case:** source shows a successful cached session does not re-run the identity helper or write the global mirror on its methods. It captures an immutable repository namespace. Thus first metadata adoption that preserves the exact ID does not intrinsically require its eviction/reopen/rebind or an empty outbox. Retention is only a candidate if future creator entries are fenced, whole-scope lifecycle evidence is valid, all cached/in-flight identities match, and no reset/recovery/readiness/ownership contract changes. This is not evidence that current realms can perform that cutover safely; those premises are unproved today.

**General case:** if cutover needs new writer denial, shutdown/draining, cache eviction, failed-promise retry change, repository reopening, identity replacement, rebinding, UI unsaved-work coordination or recovery/reset changes, STOP. Separately scope `REL_05G_WORKOUT_DEVICE_LIFETIME_WRITER_TRANSITION_PREREQUISITE` (conditional proposed task, NOT AUTHORIZED), with precise session/worker/cache/queue/data-plane contracts and independent high-risk review. It cannot fix missing lifecycle evidence by stopping only known writers.

| Mechanism | Requirement classification | Evidence / limitation |
| --- | --- | --- |
| Wait for old productionSessions to disappear | NOT_REQUIRED / ineffective as a general mechanism | Map has no natural eviction; waiting does not retire hidden peer realms |
| Explicit close/eviction | UNRESOLVED for general cutover; NOT_REQUIRED in proven same-ID retention case | Production does not do this; changes ownership/retry/recovery and requires separate scope if chosen |
| Full app/browser restart | UNRESOLVED | Could retire in-memory maps; web page cannot attest complete scope or old re-entry; unsaved work remains a separate risk |
| Controlled quiescent checkpoint | UNRESOLVED for live cutover | Optional candidate for evidence-backed procedure, not currently enforced; waiting/draining can change availability |
| No pending mutations | NOT_REQUIRED for metadata-only same-ID retention; UNRESOLVED otherwise | Pending records cannot be dropped/rebound; an imposed drain is a separate writer policy |
| All identity-creators fenced plus truthful evidence | TECHNICALLY_REQUIRED for admitted entry | Exact same-ID/capability retention still needs proof; no current issuer supplies it |

Forward-only does not mean forcibly rewriting every existing writer's namespace. It means no admitted guarantee may coexist with a still-reachable incompatible identity creator in its scope. Device recovery that rotates identity is NOT the above same-ID case and remains constrained by the original writer firewall and residual-IDB rules.

## 9. Missing-evidence options

All options preserve FEATURE_REMOVAL_COMPATIBILITY by keeping authority below replaceable surfaces; all must preserve SURFACE_IS_NOT_AUTHORITY and complete-scope MULTI_SURFACE_COMPATIBILITY. A dedicated UI button does not establish evidence. No option below authorizes source implementation.

| Option | Truthfulness / scope and friction | Coverage, physical QA / writer and data risks | Approval / deferred boundary |
| --- | --- | --- | --- |
| E1 WEB_ONLY_NO_EXISTING_INSTALL_ADMISSION | Truthful current posture: unsupported existing/ambiguous admission; clean admission only if genuine construction source exists, which is absent now | Existing writers retain no-guarantee semantics; all authority readers remain unavailable/OFF. No data migration. Lost prospective availability must be disclosed | Existing PDs authorize denial; staying denied needs no reapproval. ER decisions below now record the investment/staging direction, not evidence qualification. Does NOT make implementation useful/ready |
| E2 PRIVILEGED_OR_NATIVE_VERIFIER | Potential trusted host/extension verifier of complete scope/construction/re-entry; not just a signed self-report | New platform/deployment/support surface, high friction and per-platform QA. Writer retirement/launch interception could cross firewall; no implicit migration | Beyond deferred privileged/native boundary; separate product approval, protocol/security/physical review. PD02 did not implement/authorize that expansion |
| E3 CONTROLLED_PLATFORM_MIGRATION_PROCEDURE | Potential non-destructive externally supervised restart/migration with machine-verifiable platform evidence, NOT a checkbox/reload/time delay | Feasibility unknown on Edge/iPhone; high assisted-support/QA burden. Must preserve unsaved/pending work and exact identity; any shutdown/cache semantic change separately scoped | Commission qualification first if chosen; production assisted support is beyond PD10's initial unsupported posture. PD09 requires qualification, not presumed proof |
| E4 NEW_AUTHORITY_CONTAINER | Fresh independently attested container could distinguish construction; page-generated nonce or new deployment alone cannot | Explicit durable-data ownership/migration protocol, highest migration/rebind/rollback risks and new cross-container UX. Not implicit origin/profile switching or clearing | New product/platform and high-risk migration review required; not authorized by PD03 or current writer contract |
| E5 QUALIFIED WEB DELIVERY/ENTRY CONTROL | No actual current evidence-backed model found. Future SW/managed delivery protocol is a research candidate, not an issuer | Would need complete eligible-scope/build/re-entry guarantees and physical QA; deployment alone insufficient. Writer impact UNKNOWN | NOT SELECTED; feasibility characterization separately authorized if desired; cannot claim availability from an API spec |

The human owner explicitly selected E1 as the **immediate posture** in the separate instruction recorded in section 10; the earlier recommendation did not itself select it or supply an issuer. If useful admitted authority remains a product goal, E3 feasibility/evidence qualification is the approved preferred next investigation before broader platform expansion. There is no assurance E3 will work; E2/E4 still require distinct expansion decisions. ER-PD02 selects conditional R2-U preparation only when its value justifies cost, still with no admitted contexts and no implementation in this publication.

Existing DEVLIFE-ADMIT-PD01-PD10 remain sufficient to say **do not admit without evidence**, not to invent a production evidence source or commission native/assisted/migration scope. Exact build encoding, dependency ports, branded capability representation and transparent call-site wiring remain deferred technical details. The formerly required ER platform/support investment and staging choices are now PRODUCT_OWNER_APPROVED. That product-decision gate is SATISFIED, while evidence qualification is UNSATISFIED and the complete bootstrap-admission implementation remains NOT_READY / BLOCKED_BY_EVIDENCE_QUALIFICATION. No technical dependency is resolved merely by this approval.

## 10. Explicit human-approved decision package (all PRODUCT_OWNER_APPROVED)

Approval provenance: a separate explicit human product-owner instruction on 2026-10-04, after the focused independent rereview of exact head `0b594eca28b8265de13a4c4373ca1ce22d24419d`, selected the reviewed recommendation bundle below. That rereview recorded `REL05G-DEVLIFE-ER-PD03-001 = CLOSED`, `PR750_PD03_DECISION_FRAMING_CORRECTION = CLOSED_BY_FOCUSED_REREVIEW`, `PRODUCT_DECISION_PACKAGE_CANONICAL` and FOCUSED_REREVIEW_PASS with P0=0/P1=0/P2=0/P3=0 for that reviewed head only. This approval-publication delta still requires its own independent review.

Publication records the human decision; it does not create approval from recommendation text, reviewer verdict, document publication, CI or GitHub merge. Aggregate current decision state: `DEVLIFE-ER-PD01-PD03 = PRODUCT_OWNER_APPROVED`. Only the reviewed recommendation bundle is selected; no different alternative is approved or existing DEVLIFE-ADMIT-PD01-PD10 reopened.

| ID | Reviewed choices and recommendation | Cost/risk / deferred work / non-authorization | Explicitly approved selection | Status |
| --- | --- | --- | --- | --- |
| DEVLIFE-ER-PD01 Evidence/platform path | E1 current unsupported posture; commission E3 feasibility; investigate E2; scope E4; separately characterize E5. Recommend retain E1 now and, only if useful admission remains required, commission E3 evidence feasibility first | E1 leaves admission unavailable; E3 may fail and has physical/support cost; E2/E4 expand product. No issuer, platform support claim, assisted production procedure, data migration, storage clear or writer change authorized by recommendation | Keep E1 WEB_ONLY_NO_EXISTING_INSTALL_ADMISSION now; existing/ambiguous installations remain unsupported for admitted authority while truthful lifecycle evidence is absent. If useful admitted authority remains a product goal, prioritize E3 CONTROLLED_PLATFORM_MIGRATION_PROCEDURE feasibility/evidence qualification before broader platform expansion; E3 is not assumed feasible | PRODUCT_OWNER_APPROVED |
| DEVLIFE-ER-PD02 Staged acquisition routing | R2-U exact synchronous no-guarantee routing preparation versus R5 keep current code until evidence path is justified. Recommend reviewed R2-U planning scope if its preparatory value justifies cost | Routing is not admission/C01-C20 acceptance; all gates OFF and unadopted limitation explicit. No ready/admitted fallback, raw repair after mandatory entry, new denial/readiness/cache/retry change, Slice 2 or implementation authorized by this document | Permit separately scoped, reviewed R2-U preparation when its preparatory value justifies cost: a transparent synchronous UNADOPTED / NO-GUARANTEE seam preserving exact legacy writer semantics. Project/product sequencing approval only, not implementation or differential proof | PRODUCT_OWNER_APPROVED |
| DEVLIFE-ER-PD03 Future cutover envelope | PRODUCT CHOICE: pursue a first candidate limited to evidence-backed exact-ID continuity/no writer semantic change; defer cutover work; or invest in a separately scoped broader writer-transition program if broader support is desired. Recommend the narrow continuity envelope | Successful cache retention is conditional, not proven general policy; rejected/in-flight/recovery cases may require distinct work. No eviction, shutdown, drain, reopen, delivery rebinding or live-writer blocker closure authorized | Prefer a narrow first candidate limited to evidence-backed exact-ID continuity with NO writer semantic change. Any later broader writer-transition investment remains a separate product choice; live cutover safety is not proven | PRODUCT_OWNER_APPROVED |

FIXED CONSTRAINT (outside the product choices): `WRITER_SEMANTIC_CHANGE_REQUIRES_SEPARATE_HIGH_RISK_PREREQUISITE = TECHNICALLY_FIXED`. Regardless of the selected cutover/support/investment envelope, writer-preservation proof is mandatory; if preservation cannot be proven, implementation MUST STOP. Any required change to writer availability, cache ownership, rejected-promise/retry behavior, recovery/readiness, writer identity, repository reopening/rebinding, outbox/digest/binding/CAS/receipt/transport/authorityEpoch, or shutdown/eviction/drain semantics requires a separately authorized high-risk writer-transition prerequisite. This is the existing approved writer firewall, not a recommendation or an owner-selectable waiver; selecting broader investment does not authorize that prerequisite's implementation or bypass its independent review/closure gates.

Fixed constraints, not selectable options: truthful complete-scope evidence; PD08 episode limit; exact build identity before creator; no byte/timeout proof; all creator paths; marker/crash/revocation rules; data/identity preservation; writer STOP; no admitted compatibility fallback; authority below views; all implementation/review/merge gates. Original approved PDs remain approved; the three now-approved scoped ER choices do not reopen them or waive the firewall.

Approval ceiling: no E3 production implementation, assisted production migration, unproven machine-evidence or platform-support claim, E2 native/privileged verifier, E4 container migration, E5 delivery/control implementation, storage clearing or origin/profile switching is authorized. R2-U remains `ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF`: no implementation, `compatibleCreatorsQuiesced` assertion, lifetime/admitted-authority claim, mandatory admitted fallback, writer semantic change, C01 completion, lifecycle evidence, bootstrap-admission completion or Slice 2 readiness is supplied by sequencing approval. Neither E3 qualification nor R2-U work starts in this publication or before section 14's package-closure gate; any later task must be separately scoped.

## 11. Conceptual availability states and failure scope

This is a proposed model, not stored metadata/runtime. Separate domain state from feature gate and independent whole-Health readiness.

| State | Legacy writer | Authority-dependent reader / lifetime | `compatibleCreatorsQuiesced` / entry / forbidden transition |
| --- | --- | --- | --- |
| UNADOPTED_LEGACY_COMPATIBILITY | Existing semantics only; no guarantee | Unavailable/default-OFF; no admitted lifetime | Never asserted. Routing preparation is possible; no promotion from string/registry/bytes |
| ADMISSION_UNAVAILABLE (never-adopted scope) | May retain approved no-guarantee behavior only in explicit unadopted phase | Scoped unavailable, not verified-empty | Never asserted. Renewed justified evidence required; no silent repair of mandatory metadata |
| ADMISSION_EVIDENCED | Existing same-ID cached writer only under proven continuity; new acquisition follows selected reviewed barrier | No READY token yet; acquisition not public activation | Sole issuer may supply scoped current claim only after routed-scope proof. Cannot outlive episode or skip foundation checks |
| AUTHORITY_READY | Retained identity-continuous writer only if proven; all future creator entries use authority path | Lifetime capture/final-use may serve later separately reviewed Slice 2; gates still OFF here | Claim not reusable forever. No compatibility identity creation/fallback in mandatory scope |
| MANDATORY_AUTHORITY_UNAVAILABLE | No legacy identity repair; behavior of affected writer requires preserved contract or separate STOP/prerequisite | Scoped unavailable/revoked; no valid capture | No return to UNADOPTED on missing/malformed metadata; exact prepared recovery only under original protocol |

PD07 scopes unavailable to the affected authority/read, not whole Health bootstrap, routine readiness, export/reset/recovery denial or a new account barrier. UI must distinguish unsupported platform, missing evidence, unavailable authority, and a separately proposed migration requirement. It must not label unavailable as verified-empty or automatically migrate. Surface removal must not remove the domain fence; Health/Home/Search/Previous/Calendar share source authority, not surface-specific admission.

## 12. Platform evidence: source versus physical unknowns

SOURCE CHARACTERIZATION: no current issuer, worker/host bridge or trusted construction source; Web Lock/Storage access is not all-context retirement. Runtime has no Edge- or iPhone-specific verified scope/entry procedure. Unit mocks/spec reading can define failure boundaries, not prove a device's physical state.

PHYSICAL QA STILL REQUIRED:

- **Edge installed app + browser:** actual shared/isolated Storage and lock scope; profiles/windows/install modes; hidden/suspended/background processes; all relevant window/process shutdown; restored tabs/back-forward/offline bundle versions; relaunch/build-before-creator order; what machine-verifiable external evidence a procedure can acquire; non-destructive preservation of unsaved UI and pending records. No blanket assertion that installing/restarting Edge constructs fresh storage.
- **iPhone Safari + Home Screen:** independently establish storage/lock partition/support, process suspension versus termination, app switch/force-close/restart/relaunch behavior, restored page/offline bundle/re-entry, concurrent browser/Home Screen scope, before-creator evidence and durable data preservation. Desktop observations do not qualify iPhone; a page cannot certify these from lifecycle events alone.

No physical tests executed and no platform support certified by this document. If procedure feasibility relies on a physical lifecycle fact, acquire evidence before trusting its issuer; full original physical/public acceptance remains a later gate.

## 13. Acceptance impact, not acceptance execution

Every row remains **REQUIRED / NOT EXECUTED**; impacts below are dependencies, not PASS. "Design" means clarified only, "Prerequisite" means actual implementation/proof still needed, "Decision" means the now-approved scoped ER direction, not implementation evidence, "Physical" means real-device evidence still unexecuted.

| Criterion | Impact from this characterization | Status |
| --- | --- | --- |
| DEVLIFE-ADMIT-C01 | Design: nine/six inventory and all-path seam; Prerequisite: route aliases/late entries/races; Decision: staged R2-U is not completion | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C02 | Prerequisite + Decision: no production issuer; sole truthful capability cannot be synthesized | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C03 | Design: synchronous IIFE seam preserves writer timing; Prerequisite: authority barrier/entry ordering without C13 change | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C04 | Design: current X/Y proof; Prerequisite: negative first-rollout/bypass tests | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C05 | Decision + Prerequisite + Physical: selected scoped evidence/procedure, re-entry and validity | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C06 | Design + Prerequisite: no clean-construction source; exact case/residual data; platform premise if selected needs Physical | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C07 | Design: typed authority unavailable, not writer denial; Prerequisite: fail-closed/no-busy-retry tests | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C08 | Design + Prerequisite: cooperative join/re-entry cannot infer old absence; operational substitute depends on Decision/Physical | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C09 | Design + Prerequisite: exact pre-creator reviewed build; stale/offline/restored behavior needs Physical | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C10 | Design + Prerequisite: evidence not persistent absence latch; marker/prepared/mandatory-loss unchanged | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C11 | Design + Prerequisite: only evidence-backed exclusive acquisition/READY reuse, role-limited recovery | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C12 | Design + Prerequisite: exact immutable writer vectors; no identity/digest/binding/CAS/epoch changes | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C13 | Design + Prerequisite: cached rejection/continuity/readiness; conditional separate writer task if proof fails, Decision for cutover envelope | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C14 | Design: all gates and runtime debt frozen; Prerequisite: later implementation regression checks | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C15 | Design + Prerequisite: no scans/schema/backend; device-global non-nested bounded lock protocol | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C16 | Design + Prerequisite: no verified-empty/partial/admitted fallback; independent surface ownership | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C17 | Prerequisite + Physical: actual old bypass/suspend/restored peers, delayed events and selected procedure | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C18 | Physical + Decision: installed Edge/browser scope/lifecycle procedure remains unqualified | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C19 | Physical + Decision: separate iPhone Safari/Home Screen scope/lifecycle remains unqualified | REQUIRED / NOT EXECUTED |
| DEVLIFE-ADMIT-C20 | Design: bounded ceiling; Prerequisite review must not auto-close original C19/C28, writer debt/#745/public claims | REQUIRED / NOT EXECUTED |

Original DEVLIFE-C01-C28 (28 rows) remain REQUIRED / NOT EXECUTED. Neither source tracing, docs merge, CI nor R2-U alone passes them. No original C19/C28, writer coexistence, analytics or physical/public acceptance is closed.

## 14. Frozen state and minimum next-work decomposition

- PR #745 = KEEP_DRAFT_BLOCKED; `REL05G-EXCOMP-OWNER-001 = BLOCKED_BY_DEVICE_AUTHORITY_PREREQUISITE`; `REL05G-EXCOMP-IMPL-001 = CLOSED`.
- Slice 2 = `BLOCKED_BY_BOOTSTRAP_ADMISSION_PREREQUISITE`; no source-owned shared adoption implemented here.
- Four gates remain false: [Health selected-day](../src/components/views/features/health/healthSelectedDayCompositeConfig.ts), [Health range](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts), [Home](../src/components/views/features/home/homeWorkoutCompositeConfig.ts), [Search](../src/components/views/features/search/searchWorkoutCompositeConfig.ts).
- Seven live-writer blockers remain OPEN: unbound pre-reset create; rollback visibility; old/new writer coexistence; mounted UI identity integration; canonical field ownership; remaining analytics/projection/public claims; reset-fenced local-edit policy.
- `REL05G5A-001 = ACTIVATION_PREREQUISITE`; B1 cacheKey P3 = OPEN_NON_BLOCKING; `LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP = UNRESOLVED`, not an eighth writer blocker.
- DB v7, schema v1, stores/indexes/keyPaths, backend and WorkoutSessionV1 unchanged; device lifetime remains metadata-only, not transport identity. Search policy and other workstreams unchanged.

Minimum justified sequence (not authorization):

1. The ER product-decision gate is satisfied by the explicit human instruction; publish this approval record, obtain independent review and any required correction/confirmed rereview, then Final Merge Gate, human merge and independently verified CLOSED_IN_MAIN. None of those remaining package gates is completed by approval or this publication. Do not begin E3 qualification or R2-U work before that closure.
2. After package closure, if useful admitted authority remains a product goal, separately scope E3 controlled-platform-procedure feasibility/evidence qualification and necessary physical evidence. E3 feasibility is unproven; if no truthful source is established, retain E1/R5 and STOP admission work. R2-U preparatory routing may optionally be separately scoped in parallel only when value justifies cost and its transparent synchronous UNADOPTED / NO-GUARANTEE ceiling remains explicit.
3. Design/review the selected R2 acquisition owner and exact cutover envelope. Prove writer-preserving routing/retention. If any availability/identity/cache/recovery effect is necessary, STOP and complete a separately authorized high-risk writer-transition prerequisite first. Do not require it merely from the existence of cached sessions.
4. Implement the scoped bootstrap-admission prerequisite only with justified issuer, all-path routing, explicit lane separation/forward-only transition and unchanged writer contract (or independently closed authorized dependency). Routing preparation alone is not that implementation. The task may need separate issuer/router slices; do not assume one task suffices.
5. Independent implementation review, required corrections and confirmed rereview, Final Merge Gate, human merge, independently verified CLOSED_IN_MAIN. Then and only then a separate Slice 2 task may resume under the original gate; #745 remains blocked until that point. Public activation/physical acceptance and writer work remain separate.

Exact next step: **Independent review of the approval-publication exact head.** The human decision is recorded, but this package has not completed its publication review, Final Merge Gate, human merge or independently verified CLOSED_IN_MAIN. Do not begin E3 feasibility, R2-U implementation, issuer/bootstrap admission, writer transition or Slice 2 in this task or before the required package closure and separately scoped next work. Approval does not close either technical implementation dependency.

## 15. Validation and publication ceiling

One new companion document only; no edits to the historical merged artifacts, runtime/source/tests/config or schema. Static helper/alias/key/registration/gate inventory and local-reference validation plus `git diff --check` substantiate this characterization. No runtime tests required/run for the docs-only change. Hosted Push and PR CI must both complete at the new exact docs head with test, typecheck, build, backend-rel05g1 and backend-recovery SUCCESS; run/head evidence is reported with publication, not embedded as self-referential commit metadata. CI does not execute future admission or physical criteria.

No E3/R2-U/bootstrap implementation, issuer/router/registry/lifecycle metadata, Health readiness/recovery/cache, writer/data-plane, public reader, Slice 2/#745, G6, Ready, merge or auto-merge action is included. Stop after approval-record publication and new exact-head CI evidence; completion is COMPLETE_PENDING_INDEPENDENT_REVIEW, not CLOSED_IN_MAIN.
