# REL-05G human-assisted physical qualification protocol

Workstream: `REL_05G_WORKOUT_DEVICE_LIFETIME_HUMAN_ASSISTED_PHYSICAL_QUALIFICATION_PROTOCOL_CHARACTERIZATION`.
Protocol version: `rel05g-patha-human-v1`.

## 1. Result, exact baseline and authority ceiling

Primary result: **`HUMAN_ASSISTED_PATH_A_PROTOCOL_READY_FOR_REVIEW`**. This is one docs-only protocol-design artifact. It does not execute any physical test or implement a fixture. All 46 tests below are currently `NOT_EXECUTED`; no actual run bundle exists.

Repository: `Absinthe-6785/Absinthe`; canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`. Base/current main: `d656118752c58d47f72acc77d74253f2f5f2ca45`. New branch: `codex/rel05g-human-assisted-qualification-protocol`. No alternate workspace, destructive Git operation or unrelated dirty file is used.

[PR #752](https://github.com/Absinthe-6785/Absinthe/pull/752) is MERGED/CLOSED, reviewed head `e64f4b2303ae1c880ada3376043f5594e35cdf9f`, merge equal to this base, merged `2026-10-05T02:12:35Z`. Exact-main Push [37254484959](https://github.com/Absinthe-6785/Absinthe/actions/runs/37254484959) has all five required jobs SUCCESS. [PR #751](https://github.com/Absinthe-6785/Absinthe/pull/751) is also MERGED, reviewed head `10ed61fac9f4be17874023a6b6b436feb78cec46`, merge `d14e7b3db75dc4c55b46f254e382a0efbcece34d`; its independently verified closure is retained by the merged #752 record. Both predecessors are `CLOSED_IN_MAIN`. Their CI is not this publication's CI or physical evidence.

Five current-main canonical documents were re-read in full; their historical publication states are not overwritten:

1. [Authority contract and plan](REL-05G-workout-device-lifetime-authority-contract-and-plan.md).
2. [Bootstrap-admission prerequisite](REL-05G-workout-device-lifetime-bootstrap-admission-prerequisite.md).
3. [Admission evidence and writer-safe routing](REL-05G-workout-device-lifetime-admission-evidence-and-writer-safe-routing-characterization.md).
4. [E3 controlled-platform feasibility](REL-05G-workout-device-lifetime-e3-controlled-platform-procedure-feasibility.md).
5. [PATH A access-limited qualification 01](REL-05G-workout-device-lifetime-path-a-platform-qualification-01.md).

| Independent state | Current result |
| --- | --- |
| E3 feasibility | `NOT_ESTABLISHED` |
| Lifecycle evidence source | `REMAINS_UNAVAILABLE` |
| Physical platform behavioral qualification | `NOT_EXECUTED` |
| PATH A protocol/ordinary human observation | `CURRENT_BOUNDED_QUALIFICATION_DECISION = NO_NEW_PRODUCT_DECISION_REQUIRED` |
| PATH B capability commitment | `NEW_CAPABILITY_COMMITMENT = ADDITIONAL_PRODUCT_PLATFORM_DECISION_REQUIRED`; none selected |
| Bootstrap admission | `BLOCKED_BY_EVIDENCE_QUALIFICATION` |

Human operation collects physical observations; operator attestation supplies provenance, **not trusted lifecycle authority**. Neither a run PASS, complete track, docs merge, fixture telemetry nor CI supplies `compatibleCreatorsQuiesced=true`, admitted authority, lifecycle issuer status, bootstrap readiness, or satisfaction of P1-P7. Apparently stronger evidence must return for independent architecture review before promotion. Missing Codex Edge/iPhone access is an execution-environment limitation, not platform API absence, E3 impossibility or a PATH B trigger.

## 2. Fresh source baseline and writer firewall

No material source drift: nine direct production creation-capable calls in six groups. Internal helper delegation and runtime port invocation are traced but excluded from the direct count.

| Group | Exact-base direct call lines | Count |
| --- | --- | --- |
| [healthRoutineSync](../src/lib/healthRoutineSync.ts) | 830 | 1 |
| [workoutRuntimeAuthority](../src/lib/workoutRuntimeAuthority.ts) | 177 | 1 |
| [workoutRangeReader](../src/lib/workoutRangeReader.ts) | 37, 75, 80 | 3 |
| [workoutSelectedDayReader](../src/lib/workoutSelectedDayReader.ts) | 37 | 1 |
| [verifiedWorkoutRangeSnapshot](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts) | 185 | 1 |
| [useHealthSelectedDayComposite](../src/components/views/features/health/useHealthSelectedDayComposite.ts) | 139, 222 | 2 |

The [raw helper](../src/lib/workoutLocalReaderAuthority.ts) creates/repairs missing or format-invalid identity and preserves a valid string's exact case; the established helper rejects malformed existing values but delegates on null. Mirror writes remain raw helper line 11 and [dormant foundation](../src/lib/workoutDeviceLifetimeAuthority.ts) line 265. No production consumer of that foundation, production lifecycle issuer/admission owner, repository-owned SW protocol, privileged host or R2-U implementation was found. Dormant worker vocabulary is not an executing coordinator. Static entry/public/scripts/Vite/package inventory cannot inspect historical browser registrations or installed apps.

The Health `productionSessions` account Promise cache still calls the raw helper synchronously inside its cache-miss IIFE before awaiting repository open. Resolved and rejected Promises remain cached. Export/Settings/restore fan-in remains unchanged. Four gates remain false; [local database constants](../src/lib/localDatabase/types.ts) remain DB v7/schema v1.

This protocol and any future fixture must leave production deviceId, namespace, repository identity, cache ownership, rejected-promise behavior, retry/readiness/recovery/reset, outbox, digest, binding, CAS, receipts, transport and authorityEpoch untouched. No pause, forced flush/drain, eviction, new denial, reopen/rebind or identity reset is a test setup step. `WRITER_SEMANTIC_CHANGE_REQUIRES_SEPARATE_HIGH_RISK_PREREQUISITE = TECHNICALLY_FIXED`; a needed semantic change triggers STOP and separate authorization/review, not a waiver through operator consent.

## 3. Sacrificial environment and ordinary-operator boundary

An acceptable environment has an explicitly recorded, non-production origin used only by the qualification fixture; no real user data, login, canonical device identity, production keys, canonical repository or production outbox. Only disposable synthetic identity/state is seeded. A different path on the same origin is **not isolation**.

Existing `http://localhost:5173` is **not approved by default**: it serves the real application and may have historical origin storage/workers. Do not clear it or inspect/manipulate its production storage to make it safe. Minimum later prerequisite: a separately reserved unused host/port serving only standalone fixture files, verified not to serve/import the app or have an existing worker/controller. Exact scheme/host/port, delivery headers and fixture bytes must be recorded. No origin/server is created here. A dedicated HTTPS fixture origin reachable by the real iPhone is needed for mobile secure-context API tests; an iPhone's localhost is not the Windows host. Loopback trust on Windows does not qualify an HTTP LAN address on iPhone. Hosting choice/deployment is separately scoped, not promised in this document.

A fresh **test-only** origin is not E4 product-container migration: no production identity/data/authority is copied, created or transferred and no new product container is adopted. If a plan needs origin/profile replacement to preserve or migrate product data, it is `OUT_OF_SCOPE_PATH_B_E4`, not this environment.

Before each run the human checks that participating surfaces contain only the reviewed fixture and no unsaved personal work, pending production writes or other content that could be disrupted. Closing one fixture tab/window is allowed only when it contains no other user tabs. Whole-browser/app close, device lock, app switching and offline actions require a safely isolated device/use episode with no affected live writers or unsaved work; otherwise skip the step as `NOT_EXECUTED` with its exact blocker. Consent alone is not preservation proof. Do not stop/drain product writers to meet this condition. Do not kill processes, alter browser/OS policies or memory-pressure the device to force an outcome.

Cleanup is optional and postponed until evidence is exported/verified: close only fixture surfaces, release/abort only fixture locks, remove only exact run-prefixed keys/fixture DB created by the run. No `Storage.clear()`, all-origin site-data clearing, production IDB deletion, browser-profile deletion, arbitrary SW unregister, uninstall/reinstall or identity regeneration. Removing an installed fixture is not required; unknown deletion semantics means leave it in place. Any potentially container-altering uninstall/reinstall is `OUT_OF_SCOPE_PATH_B_E4`.

No extension, native helper, admin process controller, custom bridge, remote inspector requirement or production writer modification. Optional Task Manager/ordinary browser UI is observational only. A requirement for privileged complete process-to-container mapping is `PATH_B_E2_LIKE_CAPABILITY_REQUIRED`; exclude/STOP that subpath. New production SW/entry control, native/extension capability, migration/destructive reset or production assisted-support commitment requires a new explicit product/platform decision and separately reviewed work. No such capability is selected here.

## 4. Minimal fixture contract — design only

Planning classification: `PATH_A_FIXTURE_IMPLEMENTATION_READY`, conditional on protocol independent review/correction, Final Merge Gate, human merge and independently verified `CLOSED_IN_MAIN`, then a **separately authorized** fixture task. This label does not authorize implementation now or qualify a platform.

Use a tiny removable standalone HTML/JS fixture outside the normal application bundle, without production imports, framework/runtime ownership, backend requests, authentication or product writer dependency. On-page buttons and readable text/export controls must work with ordinary Edge and iPhone touch UI; no console or privileged inspector is necessary. An isolated manifest/icons may support test-only installation, without a SW. Microsoft documents that a SW is optional for Edge installability; actual target support still must be recorded. No worker/cache/entry-control implementation is included to force installability or offline success. [Microsoft PWA files and optional SW](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/)

Required fixture display/export:

- Immutable fixture role/build ID, protocol version, source Git SHA and reviewed artifact manifest (SHA-256 for actual HTML/JS/manifest assets), requested URL/origin and display mode. Startup logging must originate in the reviewed loaded artifact, not merely fetching the latest server manifest; self-report is fixture provenance, not trusted attestation.
- A fresh document instance ID at execution start, stable through that document's BFCache return; persistent test launch history records previous instance IDs, never reuses one to pretend a new document survived. Operator assigns synthetic surface/window labels; the fixture cannot enumerate all browser windows or installations.
- Dedicated localStorage write/read controls, optional separate IDB transaction-complete write/read, test lock request/hold/release/cancel, capability/error indicators, event export and visibility/page/navigation markers.
- Raw events with run/test/action/instance/build IDs, per-instance increasing sequence, `Date.now()` wall time, `performance.timeOrigin` and `performance.now()`, visibility state, event type and payload/error. Log `START`, `ACTION`, `STORAGE_WRITE/READ`, optional `IDB_COMMIT/READ`, `LOCK_REQUEST/ACQUIRED/RELEASED/ABORTED`, `visibilitychange`, `pagehide/pageshow` with persisted, available navigation timing, export and errors. Missing close events remain missing; do not synthesize them from a user statement.
- Logs persisted only into a separate exact run-prefixed evidence slot so previously flushed events survive relaunch; display flush status and export before disruptive steps. Missing/unflushed tail after termination is a limitation, never evidence that no action happened. Logger instrumentation may affect BFCache; record that caveat, avoid unload listeners and keep lock probes separate from navigation trials.

Qualification key prefix: `rel05g-patha-qual:v1:<runId>:`. Example suffixes: `scope-token`, `synthetic-identity`, `event-log:<instanceId>`, `launch-history`. Qualification lock: `rel05g-patha-qual:v1:<runId>:scope-lock`. Optional IDB name uses the same prefix and synthetic fixture-only records; it is not DB v7 nor a production schema change. Tokens must preserve exact bytes/case.

Never read/write/use `absinthe-health-routine-device-id:v1`, `absinthe-workout-device-authority:v1`, `absinthe-workout-device-adoption:v1`, production lock names, canonical repository records or outbox state. Isolation is enforced by a reviewed allowlist, not merely a warning label. No fixture admission flag, authority/lifetime record, lifecycle token, registry claim or API can be passed to product code.

| Variant | Required difference / allowed behavior | Forbidden inference |
| --- | --- | --- |
| OLD_FIXTURE | Immutable `/old/<build>/` artifact; records own build/instance, ignores CURRENT messages and never requests its lock or joins its membership channel. A manual button performs an intentionally noncooperating qualification-only raw token write even while CURRENT holds its test lock. Logging/export is observation, not cooperation with CURRENT | OLD does not become compatible because CURRENT exists; old page telemetry is not complete historical-context inventory |
| CURRENT_FIXTURE | Immutable `/current/<build>/` artifact; exposes explicit cooperative test lock and records its own observation window, which may contain no OLD messages. May poll only the test token after an operator action. Has no forced control over OLD | No response/free lock means only lack of cooperation/lock contention, never no old creators |

Shared pair tests use the **same recorded run ID/origin/key/lock**. Different test IDs do not change the resource under contention. Separate immutable URLs retain exact OLD/CURRENT bytes; changing a query parameter on mutable latest HTML is insufficient build provenance. No service worker is required or added. Safe browser HTTP-cache/offline observations may fail to load; that is an honest result, not permission to add delivery architecture.

## 5. Evidence bundle, integrity and storage decision

Each later run has one versioned manifest plus append-only raw events, operator journal and artifacts. Fields below are required; use explicit UNKNOWN/not available plus reason rather than guessing.

| Field group | Required content |
| --- | --- |
| Identity | runId, protocolVersion, track A/B/C/D, test IDs, run attempt, synthetic deviceLabel, operator pseudonym and operator attestation |
| Environment | model, OS version/build, browser running version/build/channel if known, profile/private/tab-group mode, install method/name/identity, display mode, origin, fixture builds/Git SHA/asset hashes, controller/cache state available without privilege |
| Timing/procedure | test start/end UTC and timezone, operator timestamp source, exact ordered steps/action IDs, raw per-instance machine timestamps/sequences, duration and abort reason |
| Artifacts | screenshots, screen recordings if used, raw fixture event exports, process/browser observations with capture scope, artifact path/hash/size/type/provenance |
| Results | Storage and independent Web Lock observations, navigation/restore class, fixture data preservation before/after, negative controls, unexpected behavior, individual/track result and reasons |
| Limits | P1-P7 impact labels individually, missing events/access/versions, clock-order limits, partition uncertainty, optional tests omitted, logger influence and attestation that this is not lifecycle authority |

Deterministic names: `<runId>/<track>/<testId>/<instanceId-or-operator>/<ordinal>-<kind>.<ext>`, e.g. `r001/A/A2/i02/003-lock-events.jsonl`. Sequence ordinal denotes capture/export order, not inferred global event order. Manifest records every completed, failed, aborted and skipped attempt; never discard counterexamples or replace a failed run with a success. Run IDs need uniqueness for provenance, not cryptographic authority.

Do not edit original screenshots/recordings except separately identified privacy redaction. Preserve original timestamps and raw events; never manually reorder or rewrite machine event order. Per-instance monotonic clocks are not a shared clock. Wall-clock sort cannot establish cross-instance causality. Use action IDs, reviewed request/release handshakes, foreground checks and continuous video where needed; report UNKNOWN order if they cannot resolve it. Record operator timestamps separately and clock uncertainty. Hash available artifacts/manifest with SHA-256; hashes detect alteration of retained bytes, not truthful execution or issuer identity. No signing is required.

No credentials, personal notes/workout records, production tokens/cookies, real account IDs or unrelated desktop/app content may be published. Never export cookies or whole browser/profile data. Crop/redact only sensitive information in a derivative, with a redaction manifest linking original hash, derivative hash and regions/reason; never conceal relevant test state, times, origin/build or outcomes. If unavoidable sensitive data appears, do not commit it. Original private material remains outside Git under operator-approved access/retention; do not upload it automatically. If essential raw evidence cannot be safely made available to independent reviewers, mark `EVIDENCE_UNREVIEWABLE` and the dependent result INCONCLUSIVE, not PASS. Retention/deletion requires a separate agreed policy; no external service or permanent retention commitment is assumed.

| Storage option | Tradeoff | Recommendation |
| --- | --- | --- |
| 1. Git-tracked sanitized artifacts | Direct reproducibility but immutable-history privacy/binary-size burden; redaction mistakes persist | Optional small non-sensitive text only after review; no binaries in this task |
| 2. Git summary + hashes; raw outside repo | Minimum Git disclosure; reviewer access to non-sensitive raw evidence remains mandatory, hashes alone insufficient | **Preferred minimum**: text summary, artifact/hash/redaction manifest and operator-authorized review access references |
| 3. Both | Can include selected sanitized events/screenshots while retaining originals privately; more review/disclosure burden | Optional later, not required to achieve this protocol |

Acceptable evidence: version UI screenshot tied to the run; continuous operator-sequence recording; raw fixture event log tied to actual displayed build/instance; Task Manager screenshot as context; manual journal linked to those artifacts. Insufficient alone: “I closed everything”, “no other tabs”, “Edge was fully gone”, “clean restart”, “same storage”, screenshot without provenance or user statement without a machine-visible fixture result. Operator attestation confirms who did which steps, not whole-scope death or compatibility.

## 6. Shared methods: exact steps and verdicts

Every track row below normatively inherits **G** (environment/safety/version/build/run setup), **E** (evidence/integrity in section 5), **V** (result rubric in section 11) and its named method. Each row adds its precondition, steps, expected events, artifacts, PASS/FAIL/INCONCLUSIVE condition, proof/limit and P1-P7 impact profile. Thus abbreviations are executable definitions, not omitted per-test obligations. All tests begin/end with the operator's action marker and export available raw logs. PASS concerns the row's measurable observation target, not an expected browser-sharing or lifecycle theory.

### M — environment/mode measurement

Use ordinary version/about/settings/installation UI. Capture exact model/OS build, running Edge version/channel, profile mode as a synthetic label, install source/app identity and URL/display mode as applicable. Never expose profile paths/account names. On iPhone record model/iOS version/build from Settings; Safari/WebKit exact build may not be exposed. Record UNKNOWN rather than deriving an exact running build from UA/OS or marketing number. PASS for the specific fields actually evidenced; missing essential target/mode/version information is INCONCLUSIVE and prevents version-specific track completion. START/build events corroborate the fixture but do not prove browser version or install identity.

### S — localStorage relationship

1. Foreground each participating instance and confirm reviewed build/origin/run/key plus own synthetic write/read control and no errors. No token value is manually copied into the peer, URL or another storage lane; only run/resource identity is shared.
2. A writes a fresh random token to the exact test key, confirms its own read equals it, logs action/value. B explicitly reads that key after the marked action, logging exact value/null/error, not just a storage event.
3. Reverse: B writes another fresh token; A explicitly reads. Repeat once with new tokens. Export both logs and capture result panels/action sequence.
4. `SAME_OBSERVED_STORAGE_SCOPE`: both directions/repeats observe the newly written peer token. `DIFFERENT_OBSERVED_STORAGE_SCOPE`: both instances' own writes/reads succeed, peer fresh reads repeatedly retain their distinct own tokens, exact resource/origin/run and ordering are verified with no copy/race/error. Mere null, delayed read or nonresponse is `INCONCLUSIVE_STORAGE_SCOPE`.

S PASS means a determinate SAME or DIFFERENT observation with controls, not that sharing is required. FAIL means a fixture/integrity requirement is violated (unexpected non-test write, corrupted own confirmed data, contradicted raw trace); otherwise missing control/error/order evidence is INCONCLUSIVE. Hidden/mobile scheduling may require later foreground reads; log that limitation. Relationship is this pair/version/configuration only, not all containers or lifecycle scope. [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html) defines state/events, not cross-agent locking or process enumeration; that distinction motivates this measurement.

Optional IDB uses a **separate** prefixed DB/record and waits for transaction completion before peer reads, then repeats/reverses with its own exported events and classification. Never infer IDB sharing/preservation from localStorage; an unperformed optional IDB probe remains NOT_EXECUTED.

### L — Web Lock relationship

1. Verify secure context/API availability and same exact test resource in both instances. A requests exclusive lock, callback logs ACQUIRED, keeps its callback Promise pending; show HELD status. Use release button and a recorded bounded safety timer (e.g. 60 seconds) only in the test fixture. Timer expiration ends the trial, not retirement evidence. No `steal`, production lock or permanent hold.
2. While A is freshly confirmed HELD, B logs LOCK_REQUEST for the same exclusive name. Foreground/video checks must establish whether A's callback remains held and whether B acquires. An optional `ifAvailable` probe logs its null/non-null callback, never substitutes timeout as scope evidence.
3. A manually releases; log action, callback completion and RELEASED. Observe B's ACQUIRED then release B. Repeat reversed with a fresh trial. Requests are cancelable, abort and timeout events retained.
4. `SAME_OBSERVED_WEB_LOCK_SCOPE`: B cannot acquire while A is confirmed held, acquires after release, reversed trial agrees, and causal evidence/controls exclude timer expiry or hidden holder loss. `DIFFERENT_OBSERVED_WEB_LOCK_SCOPE`: same-named exclusive locks are demonstrably held concurrently in both healthy instances with verified overlap and reversed controls. `INCONCLUSIVE_WEB_LOCK_SCOPE`: absent API/error, timeout, unconfirmed holder continuity, missing overlap evidence or conflicting trials.

L PASS requires determinate classification with request/acquisition/release events and both instance IDs. FAIL means a violated fixture invariant or trace-integrity rule, not merely DIFFERENT scope. A nonresponse is INCONCLUSIVE, not different scope or retirement. Desktop side-by-side windows can support overlap evidence; iPhone app switching may not, so an ambiguous trial must remain INCONCLUSIVE rather than assume background lock retention. [Web Locks specification](https://w3c.github.io/web-locks/) describes cooperating agents sharing a storage bucket, exclusive scheduling and callback-held locks. Inference: the measurement cannot exclude a creator that never requests the lock.

### T — visibility, close and persistence observation

Seed exact synthetic bytes, export pre-state/logs and release test locks before navigation/close trials so an artificial hold does not silently alter restoration behavior. Mark the planned operator action, perform only the row's safe UI action, then foreground/relaunch designated peer and read synthetic state plus events/instance/build. Required artifacts are pre/post panels, raw logs and a recording or action-linked screenshots of the transition. Missing terminal lifecycle events are normal uncertainty, not proof of termination. PASS when performed transition, available events, resulting state and limits are reviewable; INCONCLUSIVE when the transition/result cannot be distinguished; FAIL for unexpected confirmed test-data corruption or isolation/integrity violation. If fixture data changes, retain it as FAIL/preservation counterexample, not clear/reseed and report success. A lock trial repeated afterward is L, not implied by T.

### R — restore/re-entry classification

Export source instance/build, synthetic bytes and run navigation marker, then use the stated ordinary UI path without clearing cache/storage. Record START, pageshow/pagehide persisted flags, available navigation timing, old/new document instance, actual executed build, fixture state and operator action. Classify one primary entry mechanism plus independent build/context attributes:

| Class | Minimum evidence / limit |
| --- | --- |
| RELOAD | Operator reload plus navigation timing reload/new START; absent corroboration => UNKNOWN |
| NEW NAVIGATION | Operator direct launch/link plus new START/timing navigate, not automatically fresh storage |
| HISTORY RESTORE | Marked Back/Forward/history action and history timing/events; not automatically BFCache |
| BFCACHE RESTORE | `pageshow.persisted=true` in the returned document, retained instance/build corroboration; pagehide true alone is only eligibility, not actual return |
| SESSION RESTORE | Ordinary restore-session/tab UI action tied to retained run marker/build/instance; independent machine mechanism may remain UNKNOWN |
| OFFLINE OLD FIXTURE LOAD | Reviewed OLD build actually executes with evidenced safe offline setting and retained artifact identity; URL/name alone insufficient |
| RECREATED CONTEXT | Fresh START/document instance after a prior recorded instance; may accompany reload/history/session, not proof every old context died |
| UNKNOWN | Missing/contradictory signals; entry-specific test INCONCLUSIVE |

[Navigation Timing](https://www.w3.org/TR/navigation-timing-2/) distinguishes navigation/reload/history; [HTML PageTransitionEvent](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-pagetransitionevent-interface) defines persisted. A history timing value alone does not identify BFCache. Separate raw events from inferred classification and do not claim process death from an instance change. PASS for a reviewable supported classification; UNKNOWN is INCONCLUSIVE, confirmed data/isolation/integrity violation FAIL. Expected browser result is not prescribed. R inherits T's data comparison and artifacts.

### O — noncooperating OLD counterexample

1. Open OLD, record START/build/instance and a qualification token. Measure its localStorage pair with CURRENT using S; do not assume same scope. OLD must never run L or request CURRENT's lock. An optional L control uses two CURRENT instances in the separately identified surfaces; it does not establish OLD's lock participation or automatically map its lock scope from localStorage.
2. Hide/background OLD through ordinary UI; label visibility only, not proven OS suspension. Open CURRENT, mark a bounded observation window with no OLD messages (OLD intentionally has no membership response).
3. CURRENT acquires and confirms HELD test lock. Record its action/lock trial and held interval. This is not an admission attempt.
4. Return to OLD without reloading, record resume/instance or honest new START if recreated, then click its noncooperating raw-write button while CURRENT's hold is demonstrably still live. CURRENT foregrounds and reads the resulting qualification token. Record both action IDs, held-state checks and continuous sequence video where available. If mobile switching cannot prove overlap, the lock-overlap sub-result is INCONCLUSIVE.
5. Export both logs, release CURRENT lock and compare test data. Repeat with OLD visible as a control; do not add a registry response to make it convenient.

O PASS: a preserved/re-entered exact OLD fixture performs the raw action after CURRENT's no-response observation, with stable build provenance and causal ordering; the raw-write-during-lock counterexample additionally requires measured SAME localStorage scope and verified CURRENT hold overlap. This shows the lock does not intercept that nonparticipant's raw Storage write, not that OLD acquired a lock or that Storage and lock scopes are interchangeable. Record separate sub-results; missing required evidence makes that sub-result INCONCLUSIVE. A known old action is a COUNTEREXAMPLE to claiming silence/cooperative lock excludes it, **not P1/P2 proof**. If OLD does not run, FAIL only for a fixture contract violation; ordinary scheduling/restore uncertainty remains INCONCLUSIVE. This finite model cannot identify all historical app builds or whole-platform scope.

### F — safe offline observation

Only use a reviewed ordinary per-test/browser offline control that does not interrupt live user work, or an otherwise isolated sacrificial device with no affected production writers. Do not globally disconnect a working device, pause product sync or require remote developer tooling. If safe control/retained fixture bytes are unavailable, record NOT_EXECUTED/blocked reason. Start/export immutable OLD online, record chosen offline UI state, perform R and record network errors or actual loaded OLD build. Restore connectivity when safe; no SW/cache priming architecture added. Offline load failure is a measured outcome, not evidence old code cannot ever re-enter. OFFLINE OLD classification requires actual executed bytes; ambiguous network/build evidence => INCONCLUSIVE. F can complete an observation of failure without passing the distinct old-load sub-result.

## 7. TRACK A — Microsoft Edge normal browser on Windows (14 tests)

Track setup G includes actual running Edge/Windows versions, normal/private/profile label, read-only background/startup/session settings and fixture-only windows. No policies are changed. B installed results never substitute for A. Abbreviations for P1-P7 profiles are expanded in section 11; every row's profile applies to that row only.

| ID / precondition | Ordered human steps / method | Expected machine events; required artifacts | Observation verdict (in addition to V) | Proves / does NOT prove; impact |
| --- | --- | --- | --- | --- |
| A1 Two healthy same-profile fixture tabs | Open A/B with same run/origin; execute S in both directions/repeat | START and STORAGE_WRITE/READ; both panels/logs and action captures | PASS determinate S; FAIL violated S invariant; INCONCLUSIVE missing controls | Pair's localStorage relationship / not IDB, all profiles or retirement; SCOPE |
| A2 A1 resource identity verified | Execute L, reverse holder/requester | LOCK_REQUEST/ACQUIRED/RELEASED; both logs and hold/release video | PASS determinate L; FAIL fixture/trace violation; INCONCLUSIVE unverified overlap/availability | Pair's cooperative lock relationship / not nonparticipant absence; SCOPE |
| A3 Two tabs, no active lock trial | T: foreground A, select B so A hides, return A; run fresh S if needed | visibilitychange when delivered, reads; pre/post panels/logs, tab-switch video | PASS observable transition; FAIL T violation; INCONCLUSIVE missing signals | Delivered visibility/resume behavior / not actual suspension or death; LIFE |
| A4 Two fixture-only windows same profile | Open second window; S then L with side-by-side foreground checks | Separate START/instance and S/L events; both windows/logs/video | PASS recorded separate windows plus determinate subtests; FAIL invariants; INCONCLUSIVE scope ambiguity | These windows' scope / not all Edge windows; SCOPE |
| A5 Fixture-only window and peer | T: minimize one, interact with peer, restore and read; optional fresh L separately | Available visibility/events, instance/state; minimize/restore captures/logs | PASS observable transition; FAIL T violation; INCONCLUSIVE minimized state/result unverified | Window behavior / minimized not certified suspended/terminated; LIFE |
| A6 Two fixture tabs, peer remains | T: export and close only one fixture tab, foreground peer; read state | Peer events/state, optional final closed-tab events; action recording/logs | PASS closed-target/peer observed; FAIL data violation; INCONCLUSIVE no target provenance | One tab disappearance and peer continuation / not scope quiescence; LIFE |
| A7 Two fixture-only windows, peer remains | T: export/close one window; inspect peer/state | Peer reads/events; window-close recording/pre/post logs | PASS observed peer outcome; FAIL T violation; INCONCLUSIVE uncertain target | Selected-window close / not every process retired; LIFE |
| A8 Whole-Edge safety precondition satisfied | Export/release; close last visible Edge window by ordinary X; do not kill background processes | No terminal event required; saved logs plus UI recording, later A10 state | PASS UI close documented; FAIL isolation/data violation; INCONCLUSIVE last-visible inventory unclear | Visible-UI disappearance / not complete exit or P1; LIFE |
| A9 A8 context, ordinary Task Manager access | Open Windows Task Manager without elevation; capture Edge-named entries/time/filter, optional browser task manager before close; do not End task | No fixture event required while closed; process screenshot + journal linked to A8 | PASS process-list observation documented including filter/access limits; FAIL provenance tamper; INCONCLUSIVE unreadable/unmapped result | PROCESS_OBSERVATION_ONLY / never TRUSTED_PROCESS_ATTESTATION even zero visible; PROC |
| A10 Safe A8 closure, retained fixture state | Launch Edge normally; reopen exact fixture URL; T+R compare bytes/build/instances | START/pageshow/timing/READ where available; launch video/logs/pre/post state | PASS supported R and preservation observation; FAIL confirmed corruption; INCONCLUSIVE entry ambiguity | This launch/persistence / not all old code excluded; ENTRY |
| A11 Existing fixture navigation/session history only | Export; ordinary restore-closed-tab/session or select its history item; record which action, R | Navigation/instance/build/state; history-action recording and logs | PASS evidenced entry class; FAIL R violation; INCONCLUSIVE SESSION vs other entry unclear | Tested session/history route / not forced retirement or fresh build guarantee; ENTRY |
| A12 No held test lock; reviewed neutral fixture page | OLD navigate to neutral same test site, Back then Forward, R; record logger influence | pagehide/pageshow persisted, timing/instance; continuous navigation capture/logs | PASS observable R; BFCache sub-result needs persisted true; FAIL invariant; INCONCLUSIVE otherwise for BFCache | Actual returned document mechanism / not universal BFCache eligibility; ENTRY |
| A13 Safe offline control and retained immutable OLD | F then R; keep all failed loads and reconnect safely | START/build or network error plus offline-control capture/logs | PASS reviewable F outcome; old-load sub-result only if actual OLD executes; FAIL corruption; INCONCLUSIVE uncertain delivery | Tested offline behavior / failure not no stale re-entry guarantee; ENTRY |
| A14 OLD/CURRENT isolated, measured pair | Execute O hidden then visible control, release/export | OLD raw-write after CURRENT observation; lock/read action trace and video | PASS O evidence, distinct overlap sub-verdict; FAIL fixture violation; INCONCLUSIVE causal/scope gap | Noncooperative counterexample / not retirement or lifecycle authority; OLD |

Task Manager, browser task manager, OS tray/window inventory are **PROCESS_OBSERVATION_ONLY**, not trusted process attestation. Even an empty displayed list cannot certify P1 or bind every process to the identity container. Reliable complete mapping/continuous launch enforcement needing privilege is `PATH_B_E2_LIKE_CAPABILITY_REQUIRED`, STOP before tooling or an issuer.

## 8. TRACK B — Edge installed/PWA-style surface (10 tests)

Use only the sacrificial fixture install, not the production Absinthe icon. Record browser-installed/store-packaged/shortcut variant separately; this protocol supplies no store package. A future fixture task may provide test-only manifest/icons for ordinary browser installation, not extension/native/SW control. If actual installed mode cannot be obtained safely with ordinary UI, record unavailable/PHYSICAL_ACCESS_REQUIRED, not substitute a normal tab. Title alone is insufficient. No uninstall/reinstall is included.

| ID / precondition | Ordered human steps / method | Expected machine events; required artifacts | Observation verdict (in addition to V) | Proves / does NOT prove; impact |
| --- | --- | --- | --- | --- |
| B1 Safe fixture install available | M: launch its icon, inspect ordinary app/installation UI plus actual URL/display mode/manifest build | START/build/display; install UI and launched-window screenshots/logs | PASS evidenced mode; FAIL contradicting fixture/provenance; INCONCLUSIVE icon/title alone | Actual tested surface mode / not authority container or fresh storage; MODE |
| B2 B1, profile evidence accessible | M: record browser install profile label/private status via ordinary install/app-management UI; no profile changes | Fixture instance/build; redacted profile/install captures/journal | PASS evidenced synthetic profile binding; FAIL contradictory provenance; INCONCLUSIVE cannot bind install | Configuration binding / not complete process or Storage mapping; SCOPE |
| B3 Browser + installed fixture same origin/run | S simultaneously available; reverse/repeat, foreground reads | STORAGE_WRITE/READ both; paired surfaces/logs/video | PASS determinate S; FAIL invariant; INCONCLUSIVE controls absent | Measured browser/install storage pair / not assumed common container; SCOPE |
| B4 B3 resource binding | L browser holder/install requester then reverse | LOCK events; foreground hold/release video and both logs | PASS determinate L; FAIL invariant; INCONCLUSIVE hold/scope gap | Independent lock pair / not deduced from B3 or old absence; SCOPE |
| B5 Multiple installed windows technically supported | Open second via ordinary app UI; record identities; S+L; never duplicate a production install | Separate STARTs and S/L; app windows/identity captures/logs | PASS supported pairing/subtests; FAIL invariants; INCONCLUSIVE identity unknown; NOT_EXECUTED unsupported | These installed windows / not all installed copies; SCOPE |
| B6 Fixture-only installed window, browser peer | T: export/close installed only; browser reads; later installed R | Peer READ and later START; close/relaunch video/logs | PASS observed transition/state; FAIL preservation violation; INCONCLUSIVE target unknown | Surface-specific exit / not Edge-family death; LIFE |
| B7 Normal window fixture-only, installed remains | T: close normal browser window(s) only when safe; installed peer reads | Installed events/read; browser-close captures/logs | PASS peer outcome recorded; FAIL T violation; INCONCLUSIVE ambiguous peer | Installed continuation after browser UI close / not all browser processes; LIFE |
| B8 Whole-Edge safety condition met | Export/release all; close installed + normal visible UI; ordinary process observation as A9 | Saved events, UI/process captures, later B9 read | PASS bounded UI/process observation; FAIL isolation violation; INCONCLUSIVE visible inventory unclear | Known UI closure / not scope retirement; PROC |
| B9 Safe B8 close | Launch exact test icon, R; record actual loaded fixture | START/pageshow/timing/build; launch video/logs | PASS supported entry class; FAIL corruption/provenance; INCONCLUSIVE entry unknown | One installed relaunch / not browser A qualification; ENTRY |
| B10 B9, retained synthetic bytes/launch history | Read/compare exact bytes and instance; ordinary installed history/restore if available, T+R | READ/available restore events; pre/post state/logs/action capture | PASS preservation/entry observation; FAIL confirmed byte loss; INCONCLUSIVE missing baseline | Exact test data/restore / not production pending/outbox retention or reinstall safety; ENTRY |

Potentially data/container-altering uninstall/reinstall remains `OUT_OF_SCOPE_PATH_B_E4`, even for a tempting “clean start” explanation. No production identity or installed app is moved to the fixture origin.

## 9. TRACK C — real iPhone Safari (12 tests)

Requires separately scoped human access to a real iPhone, not desktop emulation/spoofed UA. The prior task lacked that access; this task requests no physical action. Normal/private/tab-group modes are recorded independently; privacy-mode comparisons cannot silently stand for normal Safari. Force-close or device/offline actions obey section 3's strict no-user-work/no-live-writer condition.

| ID / precondition | Ordered human steps / method | Expected machine events; required artifacts | Observation verdict (in addition to V) | Proves / does NOT prove; impact |
| --- | --- | --- | --- | --- |
| C1 Real device available | M: Settings model and iOS version/build, synthetic label, redact serial/account | No fixture event required; redacted Settings captures/journal | PASS exact visible model/OS; FAIL artifact inconsistency; INCONCLUSIVE missing version | Tested hardware/OS provenance / not Safari executable build; MODE |
| C2 Safe Safari fixture tab | M: show Safari normal/private/tab-group mode, exact origin, available browser/build information | START/build; mode/origin captures/logs | PASS actual mode established, unknown exact WebKit disclosed; FAIL mismatch; INCONCLUSIVE missing essential mode | Safari configuration / not Home Screen qualification; MODE |
| C3 Two healthy Safari fixture tabs same mode | S reverse/repeat using explicit foreground reads | STORAGE_WRITE/READ; both panels/logs/tab sequence video | PASS determinate S; FAIL invariant; INCONCLUSIVE scheduling/control gap | Safari tab storage relationship / not IDB or Home Screen; SCOPE |
| C4 Same resource, API checked | L alternating foreground as needed; retain hold-continuity limits | LOCK_REQUEST/ACQUIRED/RELEASED/error; logs/sequence video | PASS determinate L; FAIL invariant; INCONCLUSIVE missing API or overlap/continuity | Actual cooperative lock observation / not assumed from support docs; SCOPE |
| C5 Two fixture tabs, no active trial lock | T: select peer tab, return original, compare instance/state | Available visibility/pageshow/READ; tab-switch video/logs | PASS observed transition; FAIL T violation; INCONCLUSIVE missing state | Background-tab behavior / not OS suspended/dead; LIFE |
| C6 Safe device/app-switch episode | T: switch to Home Screen or benign system UI, return Safari | Available visibility/instance/read; switch recording/logs | PASS bounded transition recorded; FAIL data violation; INCONCLUSIVE events missing | Safari return behavior / not complete context retirement; LIFE |
| C7 No affected user work/live writers | T: mark/export, lock device, unlock normally, return fixture | Available lifecycle/read; pre/post logs and privacy-safe action capture | PASS bounded transition/state; FAIL preservation violation; INCONCLUSIVE action/result uncertain | Lock-screen return / not forced suspension or termination; LIFE |
| C8 Whole-Safari safety precondition satisfied | Export/release; ordinary App Switcher swipe-up Safari; do not reset/restart OS | No terminal event required; saved logs, app-switcher action capture | PASS visible dismissal documented; FAIL isolation violation; INCONCLUSIVE target unknown | Operator force-close gesture / not process retirement or P1; LIFE |
| C9 Safe C8, known retained marker | Tap Safari and open/recover exact test URL, T+R | START/pageshow/timing/read/build; launch video/logs | PASS supported entry/state; FAIL corruption; INCONCLUSIVE restored/recreated ambiguity | One Safari re-entry / not fresh compatible construction; ENTRY |
| C10 Existing fixture-only history/session | Use ordinary tab/session/history UI, record selected route, R | Instance/build/navigation/read; route capture/logs | PASS evidenced route; FAIL invariant; INCONCLUSIVE session mechanism unknown | Tested restore path / not elimination of old offline code; ENTRY |
| C11 No held lock, neutral reviewed fixture page | Navigate away, Back/Forward, R; don't require developer tools | pageshow/pagehide persisted/timing; continuous sequence/logs | PASS supported classification; BFCache requires actual persisted return; FAIL invariant; INCONCLUSIVE if unknown | Safari history/BFCache observation / not all navigation routes; ENTRY |
| C12 Safe offline mechanism/isolated device | F+R; no global disconnect on live device; record load failure too | Actual build START or error; offline/action capture/logs | PASS reviewable F outcome; old-load separate; FAIL corruption; INCONCLUSIVE delivery unclear | Tested Safari offline behavior / not Home Screen or P2; ENTRY |

Ordinary iPhone quit/reopen gestures are documented by [Apple](https://support.apple.com/guide/iphone/quit-and-reopen-an-app-iph83bfec492/ios). This provides UI steps, not a scope-complete process-retirement certificate. App-switcher images may require aggressive unrelated-content redaction; never publish personal app cards.

## 10. TRACK D — real iPhone Home Screen web app (10 tests)

Requires its own real sacrificial installation and scope measurements. Use ordinary Safari Add to Home Screen where supported in a later scoped setup, recording “Open as Web App”/standalone versus bookmark behavior rather than relying on icon name. [Apple Home Screen instructions](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iph42ab2f3a7/ios) describe the UI choice. [WebKit](https://webkit.org/tracking-prevention/) documents Home Screen website data isolation from Safari; this motivates an independent measurement, not an assumed result for an unrecorded OS/install/lock scope.

| ID / precondition | Ordered human steps / method | Expected machine events; required artifacts | Observation verdict (in addition to V) | Proves / does NOT prove; impact |
| --- | --- | --- | --- | --- |
| D1 Safe fixture icon available | M: record install name/method/identity, launch; capture whether standalone or Safari bookmark | START/build/display/origin; icon/launch UI/logs | PASS evidenced actual mode; FAIL contradictory provenance; INCONCLUSIVE name alone | Tested install mode / not authority or fresh container; MODE |
| D2 Physical device available | M: record actual iOS model/version/build for this run, not copy C result without artifact binding | No fixture event required; Settings capture/run journal | PASS exact version bound; FAIL inconsistency; INCONCLUSIVE missing binding | D environment / not Safari qualification; MODE |
| D3 Safari + Home Screen same test origin/run | S in both directions/repeat, foreground each; record expected isolation only as documentation context | STORAGE_WRITE/READ; both surfaces/logs/sequence capture | PASS determinate SAME/DIFFERENT; FAIL fixture invariant; INCONCLUSIVE controls gap | Actual pair storage relation / no install-name inference; SCOPE |
| D4 D3 resource identity, API checked | L reverse roles, document switching/holder limitations | LOCK events/errors; both logs/video | PASS determinate L; FAIL invariant; INCONCLUSIVE overlap or API unknown | Independent lock relationship / not deduced from D3; SCOPE |
| D5 Second fixture copy technically available safely | Record separate install identity via ordinary UI; S+L across copies; no production reinstall | Distinct instances/builds and S/L; copy identity captures/logs | PASS identified pair/subtests; FAIL invariants; INCONCLUSIVE identity gap; NOT_EXECUTED unsupported | These copies' scope / not every install/container; SCOPE |
| D6 Safe app-switch episode | T: background Home Screen app, switch benign UI/Safari fixture then return | Available visibility/instance/read; switch capture/logs | PASS transition evidenced; FAIL T violation; INCONCLUSIVE missing state | Installed background/return / not Safari behavior or death; LIFE |
| D7 No affected writer/unsaved work | T: export, device lock/unlock, reopen installed fixture | Available lifecycle/read; before/after logs and safe action capture | PASS transition/state; FAIL corruption; INCONCLUSIVE action unclear | Installed lock-screen return / not whole-scope retirement; LIFE |
| D8 Fixture-only app, no unsafe pending work | Export/release; App Switcher swipe-up exact fixture card | No terminal event required; action capture/saved logs | PASS dismissal observed; FAIL isolation violation; INCONCLUSIVE card identity uncertain | Known card dismissal / not trusted process attestation; LIFE |
| D9 Safe D8, known icon/marker | Tap same icon, T+R, compare exact bytes/build/instance | START/pageshow/timing/READ; launch video/logs | PASS supported entry/preservation; FAIL byte loss; INCONCLUSIVE restore class unclear | One installed relaunch / not Safari or other copies; ENTRY |
| D10 Safe offline/restore route, retained fixture | F+R with ordinary available navigation; no SW addition or uninstall | START/build/restore events or load error; raw logs/offline captures | PASS reviewable outcome; old-load separate; FAIL corruption; INCONCLUSIVE unsupported distinction | Tested installed offline/restore behavior / not universal re-entry fencing; ENTRY |

## 11. Strict impact and result rubrics

P1-P7 retain their canonical meanings: P1 complete-scope incompatible execution absent; P2 continuous exclusion through evidence-to-acquire; P3 exact reviewed entering build/protocol; P4 same identity Storage/lock scope; P5 one bounded episode; P6 exact product identity/durable data preservation; P7 unchanged writer semantics.

Allowed impact labels **only**: `SUPPORTING_OBSERVATION_ONLY`, `COUNTEREXAMPLE`, `SCOPE_CLARIFICATION`, `NO_IMPACT`, `UNKNOWN`. Never PASS, PROVEN or SATISFIED as a P1-P7 value. Profiles below prescribe the **maximum justified impact if the row's relevant evidence exists**, not current results. For each absent/ambiguous relevant component use UNKNOWN; non-relevant propositions remain NO_IMPACT. All current per-test impact results are UNKNOWN for relevant components because tests are NOT_EXECUTED.

| Profile used by each test | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MODE | NO_IMPACT | NO_IMPACT | SCOPE_CLARIFICATION | SCOPE_CLARIFICATION | NO_IMPACT | NO_IMPACT | NO_IMPACT |
| SCOPE | NO_IMPACT | NO_IMPACT | NO_IMPACT | SCOPE_CLARIFICATION | SUPPORTING_OBSERVATION_ONLY | NO_IMPACT | NO_IMPACT |
| LIFE | SUPPORTING_OBSERVATION_ONLY | UNKNOWN | NO_IMPACT | UNKNOWN | SUPPORTING_OBSERVATION_ONLY | SUPPORTING_OBSERVATION_ONLY | NO_IMPACT |
| PROC | SUPPORTING_OBSERVATION_ONLY | UNKNOWN | NO_IMPACT | UNKNOWN | SUPPORTING_OBSERVATION_ONLY | NO_IMPACT | NO_IMPACT |
| ENTRY | UNKNOWN | UNKNOWN | SUPPORTING_OBSERVATION_ONLY | UNKNOWN | SUPPORTING_OBSERVATION_ONLY | SUPPORTING_OBSERVATION_ONLY | NO_IMPACT |
| OLD | COUNTEREXAMPLE | COUNTEREXAMPLE | SUPPORTING_OBSERVATION_ONLY | SCOPE_CLARIFICATION | SUPPORTING_OBSERVATION_ONLY | NO_IMPACT | NO_IMPACT |

P6 SUPPORTING is only synthetic fixture byte persistence, not product deviceId/pending/outbox preservation. P3 support is executed fixture build provenance, not product compatible-build attestation. P1 lifecycle/process support is the documented observation only, not inference of absence. OLD COUNTEREXAMPLE addresses an unsupported admission inference within the measured model; no claim every platform always exhibits it. P7 stays NO_IMPACT: isolated fixtures have no production writer. Exact product preservation/writer proof requires separately reviewed work.

Individual test/result V:

| Result | Exact rule |
| --- | --- |
| PASS | Reviewed expected measurable observation obtained with required controls/provenance and a determinate classification; unexpected but valid partitioning is not automatically FAIL; no authority claim |
| FAIL | A defined fixture/isolation/data-integrity requirement is violated or machine evidence contradicts an asserted protocol result; retain evidence and stop unsafe continuation |
| INCONCLUSIVE | Attempted but insufficient versions, scope/control, causality, build, navigation, raw evidence or contradictory results prevent required classification; no upgrade by repetition/attestation |
| NOT_EXECUTED | Not attempted; fixture/origin missing, unsafe episode, unsupported optional route or deferred setup has exact reason |
| PHYSICAL_ACCESS_REQUIRED | Target real device/surface or ordinary observation access unavailable to this run; not a capability/impossibility claim |
| PATH_B_REQUIRED | Desired observation/control actually requires an excluded capability; STOP only that subpath before commitment and return for product/platform decision |

Each composite row records method sub-results; overall PASS requires all mandatory sub-results, optional omissions stay explicit. A load error can be a complete F observation but not PASS for the distinct OFFLINE OLD load objective. No synthetic test result is copied into product acceptance.

Track choices: `TRACK_OBSERVATIONS_COMPLETE` only if every mandatory row has a determinate documented result and evidence review can assess it (FAIL is a retained complete observation, not safety approval); `TRACK_PARTIAL` if some observations available but mandatory rows remain incomplete; `TRACK_BLOCKED` if prerequisite/safety/capability prevents useful continuation; `TRACK_NOT_EXECUTED` if no rows attempted; `PHYSICAL_ACCESS_REQUIRED` if physical access is the prerequisite. Enumerate optional omissions and all failed outcomes. No PLATFORM_SAFE/RETIRED/ADMITTED label. Currently A/B/C/D = TRACK_NOT_EXECUTED; future C/D require separately scoped physical access, not a claim the human lacks devices.

Overall future evidence-package choices: `PATH_A_QUALIFICATION_COMPLETE_WITH_OBSERVATIONS` when all scoped mandatory tracks/rows are completed with reviewable evidence and failures/limits retained; `PATH_A_QUALIFICATION_PARTIAL` for completed observations with incomplete tracks; `PATH_A_QUALIFICATION_BLOCKED` for blocking prerequisites. A single completed track never qualifies others. This docs-design task has **no overall physical run verdict**: PHYSICAL_PLATFORM_BEHAVIORAL_QUALIFICATION remains NOT_EXECUTED and predecessor qualification remains BLOCKED. Even an eventual COMPLETE_WITH_OBSERVATIONS leaves E3 NOT_ESTABLISHED and lifecycle source unavailable unless later independent architecture review promotes a concrete evidence mechanism; it does not promote itself.

## 12. Minimum separately scoped next-work decomposition

1. Independent review of this exact protocol head; correction/focused rereview if needed; Final Merge Gate; human merge; independently verify CLOSED_IN_MAIN. No physical or fixture action before this closure.
2. Separately authorize `REL_05G_WORKOUT_DEVICE_LIFETIME_PATH_A_QUALIFICATION_FIXTURE_IMPLEMENTATION`: implement only section 4's standalone OLD/CURRENT/neutral pages, on-page controls/raw export/test-only persistence, immutable build manifest and optional isolated install metadata. Choose/verify a sacrificial delivery origin separately without shipping to normal app behavior. No production imports/keys/writers, lifecycle issuer, SW, privileged bridge, schema/backend or product activation. Include isolation/key/lock allowlist tests and negative OLD cooperation controls. Fixture implementation label is planning readiness, not existing code or deployment permission.
3. Fixture independent implementation review, bounded corrections/rereview, Final Merge Gate, human merge and independently verified CLOSED_IN_MAIN; document origin/provenance/access and known optional offline/install limitations. Unsupported optional routes remain explicit rather than expand capability.
4. Separately scope a human Edge normal-browser A physical run (14 tests), collecting its own bundle; access/origin/fixture prerequisites first.
5. Separately scope a human Edge installed-surface B run (10 tests), recording actual fixture install/profile; no reuse of A verdict.
6. Separately scope a human real-iPhone Safari C run (12 tests), after physical access/setup. No emulation or desktop inference.
7. Separately scope a human real-iPhone Home Screen D run (10 tests), after safe install/access, independently measured scope. No C substitution.
8. Publish bounded sanitized evidence summary/manifest and authorized review access; tracks can be published/reviewed separately without waiting for simultaneous device access. Never hide failed/aborted runs.
9. Independent evidence-integrity/platform-boundary review; explicitly preserve fixture/process/human ceilings.
10. Only then reconsider E3 feasibility and any concrete sufficient mechanism in separately authorized architecture work. If progress needs PATH B, obtain new product/platform decision before selecting/implementing it. Retain E1 while no truthful lifecycle source exists.

All stages 2-10 remain NOT_EXECUTED/deferred; this task performs protocol publication only. No E3, R2-U, bootstrap implementation, Slice 2, #745 correction or G6 begins. A protocol with honest optional/missing-access outcomes is ready for review even when not every physical observation can later succeed. Access absence alone never forces a PATH B choice.

## 13. Frozen state and acceptance ceiling

| Item | Unchanged state |
| --- | --- |
| R2-U | NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF |
| Bootstrap admission | BLOCKED_BY_EVIDENCE_QUALIFICATION |
| [PR #745](https://github.com/Absinthe-6785/Absinthe/pull/745) | KEEP_DRAFT_BLOCKED; live Draft/Open/unmerged head `2ad2ec573490b5c0a507b23bb06e98cba34c65be`, not modified |
| REL05G-EXCOMP-OWNER-001 | BLOCKED_BY_DEVICE_AUTHORITY_PREREQUISITE |
| REL05G-EXCOMP-IMPL-001 | CLOSED |
| Slice 2 | BLOCKED_BY_BOOTSTRAP_ADMISSION_PREREQUISITE |
| [HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED](../src/components/views/features/health/healthSelectedDayCompositeConfig.ts) | false |
| [HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts) | false |
| [HOME_WORKOUT_COMPOSITE_READER_ENABLED](../src/components/views/features/home/homeWorkoutCompositeConfig.ts) | false |
| [SEARCH_WORKOUT_COMPOSITE_READER_ENABLED](../src/components/views/features/search/searchWorkoutCompositeConfig.ts) | false |
| G5B_UNBOUND_PRE_RESET_CREATE_BLOCKER | OPEN |
| G5B_ROLLBACK_VISIBILITY_BLOCKER | OPEN |
| G5B_OLD_NEW_WRITER_COEXISTENCE_BLOCKER | OPEN |
| G5B_UI_IDENTITY_GAP | OPEN |
| G5B_CANONICAL_FIELD_GAP | OPEN |
| G5B_ANALYTICS_PROJECTION_BLOCKER | OPEN |
| reset-fenced local edit policy | OPEN |
| REL05G5A-001 | ACTIVATION_PREREQUISITE |
| B1 cacheKey P3 | OPEN_NON_BLOCKING |
| LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP | UNRESOLVED, separate debt not an eighth writer blocker |
| DEVLIFE-ADMIT-C01-C20 (20 criteria) | All REQUIRED / NOT EXECUTED |
| DEVLIFE-C01-C28 (28 criteria) | All REQUIRED / NOT EXECUTED |
| FEATURE_REMOVAL_COMPATIBILITY | PRESERVED; optional surface/fixture removal does not transfer authority |
| SURFACE_IS_NOT_AUTHORITY | PRESERVED; UI/icon/operator/log never issues lifecycle authority |
| MULTI_SURFACE_COMPATIBILITY | PRESERVED as requirement, physically unqualified; separate tracks and actual scopes remain mandatory |
| DB/schema/stores/indexes/keyPaths/backend/WorkoutSessionV1 | v7/v1/all unchanged |

No original acceptance, live-writer blocker, public reader or cross-device/analytics claim is promoted. CI is repository regression validation, not physical qualification or P1-P7 proof. Search and other workstreams remain unchanged.

## 14. Validation and publication stop

Validate all local references, exact 9/6 inventory, 14/10/12/10 unique test IDs, frozen states, authority ceiling and docs-only diff; run `git diff --check`. External primary sources linked near relevant method claims were consulted on 2026-10-05; standards/vendor UI instructions define measurement vocabulary, not tested behavior/version support. No runtime tests or fixture/binary artifacts are added to obtain green CI.

Publish one new Markdown document via normal commit/push on the new dedicated branch and NEW Draft PR targeting main. Required hosted evidence: Push and PR at the **new exact head**, each test/typecheck/build/backend-rel05g1/backend-recovery SUCCESS; report run/head evidence outside this artifact to avoid a self-referential follow-up commit. Keep Draft; no Ready, merge, auto-merge or remote-branch deletion. No #745 modification.

Exact next step after publication/CI: **Independent review of the human-assisted PATH A qualification protocol exact head.** Do not execute the protocol, implement the fixture/E3/R2-U/bootstrap, resume Slice 2, activate readers/writers or start G6. Stop after this protocol report.
