# PATH A isolated qualification fixture

Workstream: `REL_05G_WORKOUT_DEVICE_LIFETIME_PATH_A_QUALIFICATION_FIXTURE_IMPLEMENTATION`.
Base: `7c52ff3dfa06d0b762d7e9dd7ea220678b6f3d9a` (PR #753 merge).
Protocol: `rel05g-patha-human-v1`.

This is removable test-only instrumentation and delivery, **not physical qualification or an authority capability**. All 46 physical rows remain NOT_EXECUTED. An independent implementation review, corrections as needed, Final Merge Gate, human merge and independent CLOSED_IN_MAIN verification must precede a separately authorized physical run. Do not execute a track merely because its fixture is available.

## Normative inputs and unchanged source

All six current-main documents were read in full before implementation:

- [Authority contract and plan](../../docs/REL-05G-workout-device-lifetime-authority-contract-and-plan.md).
- [Bootstrap-admission prerequisite](../../docs/REL-05G-workout-device-lifetime-bootstrap-admission-prerequisite.md).
- [Admission evidence / writer-safe routing](../../docs/REL-05G-workout-device-lifetime-admission-evidence-and-writer-safe-routing-characterization.md).
- [E3 feasibility](../../docs/REL-05G-workout-device-lifetime-e3-controlled-platform-procedure-feasibility.md).
- [PATH A qualification 01](../../docs/REL-05G-workout-device-lifetime-path-a-platform-qualification-01.md).
- [Human-assisted physical protocol](../../docs/REL-05G-workout-device-lifetime-human-assisted-physical-qualification-protocol.md).

Historical publication states in those artifacts are unchanged. PR #753 was independently verified MERGED at the exact base; main-push run 37261390524 has five required jobs SUCCESS. That is predecessor closure, not this fixture's CI or physical evidence.

Fresh source inventory remains 9 direct creation-capable calls / 6 groups: healthRoutineSync:830; workoutRuntimeAuthority:177 (port invocation:86 excluded); workoutRangeReader:37/75/80; workoutSelectedDayReader:37; verifiedWorkoutRangeSnapshot:185; useHealthSelectedDayComposite:139/222. Raw mirror write:11; dormant foundation write:265. No production foundation consumer, lifecycle issuer, R2-U or product SW is added. Health's synchronous acquisition and resolved/rejected account Promise cache remain unchanged.

## Isolation and roles

Files are outside `src`, `public`, normal Vite entry points and product routes. The normal product build does not copy them. No product runtime/build configuration is changed. The only shared workflow change adds a separate Node invariant-test step to the existing `test` job.

- OLD: manually writes synthetic raw Storage tokens, own-instance logging/export; never requests a lock or participates in membership/signaling.
- CURRENT: same Storage controls plus explicit exclusive test-lock request, confirmed HELD, release/cancel and a 60-second scheduled safety timer. No `steal`, registry, peer census or interpretation of silence.
- NEUTRAL: provenance, Storage and lifecycle/event controls; no cooperative lock. Same-origin neutral navigation links support Back/Forward trials.

Exact resource prefix: `rel05g-patha-qual:v1:<runId>:`. Storage suffix allowlist: `scope-token`, `synthetic-identity`, `launch-history`, `event-log:<UUID>`. Exact lock: `rel05g-patha-qual:v1:<runId>:scope-lock`. Test IDs never alter the pair's resource. Every other key/lock is excluded; the three production device/adoption/authority keys are explicitly documented in the denylist. There is no arbitrary full-key API, unrelated Storage enumeration, `Storage.clear()`, product repository, auth, backend, credentials, cookies, IndexedDB or outbox access.

Origin allowlist: exact Windows loopback `http://127.0.0.1:4189` / `http://localhost:4189`, or HTTPS hosts `rel05g-patha-qual[-<deployment-and-scope>].vercel.app`. Other origins (including `absinthe-beryl.vercel.app`, any product alias/custom domain, localhost:5173 and HTTP LAN) stop before Storage/lock access. This naming allowlist is an accident-prevention firewall, not trusted platform attestation. A different path on the product origin is never isolation. Registration/controller preflight refuses existing workers; it never unregisters or clears them. Check again at explicit run start.

## Immutable artifacts and delivery

Build with Node 20+ from a clean tracked exact commit:

```powershell
node frontend/qualification/rel05g-patha/build.mjs
```

Output: `frontend/qualification/rel05g-patha/dist/<sourceGitSha>/` (ignored). Dirty tracked release builds refuse; `--allow-dirty-for-tests` is explicitly non-release. Fixture-local Git attributes fix module line endings to LF for Windows/Linux reproducibility. The builder hashes its own source plus browser core/UI source, protocol and exact Git SHA into the build ID. It produces immutable `/<buildId>/old/`, `/<buildId>/current/`, `/<buildId>/neutral/`, role-specific boot modules, shared assets and fixture-only manifests/icon. A changed existing immutable file is never overwritten. No source tree/app files are copied.

`/<buildId>/artifact-manifest.json` records path, actual byte size, SHA-256, role, build ID, source Git SHA and protocol for all executed HTML/JS and install/style/icon assets. `artifact-manifest.sha256` hashes the manifest itself, avoiding a self-hash cycle. The landing index and static-host configuration are delivery scaffolding, not execution identity; they point to an exact build. Each executed boot module embeds role/build/source/protocol before manifest fetch. Preflight hashes all same-build delivered assets and shows the fetched manifest hash. This is reproducible current-realm provenance, **not trusted loaded-code or lifecycle attestation**. No signing or mutable `latest` identity is used.

Minimum real-phone delivery: a **new, separately authorized Vercel project `rel05g-patha-qual`**, static files only, no Git auto-deploy connection, app framework, functions, product env variables, normal app rewrites or product domains. The human explicitly approved this separate test project. Upload only the generated output directory; never the repository or `frontend` root. Its generated `vercel.json` uses no framework/build command, static output `.`, no rewrites, same-origin CSP and no-referrer/nosniff headers. [Vercel CLI deploy](https://vercel.com/docs/cli/deploy) accepts an explicit project directory; [project configuration](https://vercel.com/docs/project-configuration) controls static output/headers. Consulted 2026-10-05. Pin CLI 62.2.0 for the publication operation; no production deployment tooling/dependency is added.

After confirming the new project's identity, link ONLY that generated directory, then deploy it. The generated `.vercelignore` excludes CLI-local env/credential/project/Git files from the static upload; do not inspect or publish their contents. Use the resulting deployment-specific HTTPS URL plus build/source/manifest hash for review and later paired surfaces. A moving project alias is for discovery only: never swap a run's origin mid-test. An exact deployment retains a single artifact set; later correction gets a new source/build/deployment and needs fresh review. Do not promote it to the Absinthe project or enable Git auto-deploy. Record the exact deployment URL/build/hash in the PR/report, outside the source commit to avoid a self-referential head.

Vercel TLS provides the proposed phone secure origin; a PC loopback/LAN address is not mobile HTTPS delivery. Reachability is checked with unauthenticated static HTTP reads, not an Edge/iPhone behavioral run. Real iPhone network reachability, actual secure-context API support and install behavior remain PHYSICAL_ONLY / NOT_EXECUTED. If deployment protection requires login, resolve access only on the new fixture project or report blocked; never export account credentials. No production infrastructure, container migration, privileged helper, extension, native launcher or SW is needed. This delivery is PATH A test infrastructure, not PATH B product capability.

Optional Windows convenience server:

```powershell
node frontend/qualification/rel05g-patha/serve.mjs <exact-generated-output-directory>
```

It binds only 127.0.0.1:4189, rejects other Host values, source/app roots, traversal and symlink escape; GET/HEAD static assets only, no SPA fallback. A port-in-use error means stop, not replace a server. It does not serve to the iPhone. A fresh dedicated origin must contain no historical product/SW state; never clear another origin to manufacture that premise.

## Operator controls and honest evidence

Boot generates a fresh in-memory document instance immediately at module execution. Explicit run start binds it to a validated synthetic run/test; persistent history records prior IDs only. No Storage test runs automatically. Pre-start events are not persisted and remain a disclosed missing interval. BFCache keeps the module instance; `pagehide.persisted` is only a signal, while actual `pageshow.persisted=true` is a raw return observation. Do not infer process death or automatic RELOAD/HISTORY/SESSION/OFFLINE classes. UI/manual classification remains UNKNOWN until the separate run's evidence review.

Action IDs, exact tokens, key/lock names, HELD state, raw request/acquisition/release timestamps and document/build IDs are visible without devtools. Write produces a fresh random synthetic token and an explicit own-read control. Peers read the key themselves; reverse/repeat per method S. Copy is only for retaining exact displayed bytes, not seeding a peer. Unexpected loss/errors remain failures, not a clear/reseed success. CURRENT's cancellation/timeout ends a trial only, never yields DIFFERENT_SCOPE or retirement. Browser suspension may delay its timer; a nominal 60 seconds is not a real-time liveness certificate. Export/release before T/R/F navigation/offline trials.

Events include protocol/run/test/action/role/build/instance, increasing per-instance sequence, Date.now, performance.timeOrigin/now, visibility, type and allowlisted synthetic payload/error. Each event attempts persistence to its own exact log slot; success/failure sequence is visible. No unload handler or fabricated terminal event. Abrupt-close/missing/unflushed tails and logger/fetch/BFCache observer effects remain limitations. Cross-instance wall-time sort is not causality; use protocol action/video/foreground controls and retain UNKNOWN when overlap cannot be shown.

Explicit export is deterministic versioned JSON: closed provenance shape, own raw events, capability observations, exact current synthetic token, lock/flush/error state and limits. No automatic upload or evidence backend; only same-origin GETs for artifact verification. Export previous flushed raw logs separately; they never become the current document's timeline. Full human environment/attestation/journal/video/P1-P7 impact and artifact review-access manifest remain separate later-run artifacts. Do not substitute fixture export for the full protocol bundle. Hashes establish retained-byte integrity, not truthful execution. No personal free-text/log/cookie fields are accepted by the UI.

Cleanup is optional AFTER verified export, with coordinated peers and no live trial: release/cancel this instance's test lock, remove exact run token/identity/history and log IDs known from its captured history, then close this run. Never enumerate arbitrary storage or delete unknown/orphan keys. Concurrent history writes are not transactional; missing/orphan logs are a retained limitation, not permission for broader cleanup. Active peers can recreate their logs, so end/close them before cleanup. No production identity reset, IDB delete, all-site clearing, profile deletion or reinstall.

Optional separate IDB is **omitted**: mandatory protocol methods use Storage and locks; adding another durable engine is unnecessary for this slice. IDB relationship/preservation remains NOT_EXECUTED and cannot be inferred from Storage. Fixture-only manifests/icon support ordinary install attempts; no SW/offline cache priming. Actual Edge/iPhone installability and optional offline OLD loads may fail honestly. Do not add a SW to force success.

## Exact protocol support mapping (not execution)

Each row has one primary implementation classification. FIXTURE_SUPPORTED means the explicit observation controls are present, NOT that a physical row passed. PHYSICAL_ONLY requires ordinary human/version/OS/UI action plus available fixture logs. FIXTURE_OPTIONAL retains the protocol's safe/support-dependent route. UNSUPPORTED_WITHOUT_FUTURE_DECISION count is zero for this bounded protocol; any later demand for SW/privilege/migration remains excluded PATH B.

| Row | Classification | Implemented support / remaining boundary |
| --- | --- | --- |
| A1 | FIXTURE_SUPPORTED | Two-way token controls; physical pair scope not measured |
| A2 | FIXTURE_SUPPORTED | Confirmed test-lock controls; physical overlap not measured |
| A3 | PHYSICAL_ONLY | Human tab switching + delivered visibility/state |
| A4 | FIXTURE_SUPPORTED | Same-run window links, independent S/L controls |
| A5 | PHYSICAL_ONLY | Human minimize/restore; optional separate L |
| A6 | PHYSICAL_ONLY | Human safe tab close; exported retained evidence |
| A7 | PHYSICAL_ONLY | Human safe window close; peer read |
| A8 | PHYSICAL_ONLY | Safe last-visible closure; no death certificate |
| A9 | PHYSICAL_ONLY | Ordinary Task Manager observation, never privileged attestation |
| A10 | PHYSICAL_ONLY | Human relaunch + fresh/prior IDs/read; manual R |
| A11 | PHYSICAL_ONLY | Human history/session UI; manual R |
| A12 | FIXTURE_SUPPORTED | Neutral links + pagehide/pageshow/timing; actual BFCache unknown |
| A13 | FIXTURE_OPTIONAL | Safe ordinary offline control + actual OLD/load-error evidence; no SW |
| A14 | FIXTURE_SUPPORTED | OLD raw write / CURRENT hold / explicit read, physical causality required |
| B1 | PHYSICAL_ONLY | Manifest/icon provided; actual install mode must be observed |
| B2 | PHYSICAL_ONLY | Human install/profile UI provenance |
| B3 | FIXTURE_SUPPORTED | Browser/install S controls; scope not assumed |
| B4 | FIXTURE_SUPPORTED | Independent browser/install L controls |
| B5 | FIXTURE_OPTIONAL | Ordinary multiple-window support, S/L if obtainable |
| B6 | PHYSICAL_ONLY | Safe installed close/relaunch + peer logs |
| B7 | PHYSICAL_ONLY | Safe normal-window close + installed peer logs |
| B8 | PHYSICAL_ONLY | Safe whole-visible closure + ordinary process observation |
| B9 | PHYSICAL_ONLY | Human icon relaunch + raw R signals |
| B10 | PHYSICAL_ONLY | Human retained-byte/history comparison |
| C1 | PHYSICAL_ONLY | Real iPhone Settings provenance, no emulation |
| C2 | PHYSICAL_ONLY | Safari mode/build UI; exact unknown WebKit disclosed |
| C3 | FIXTURE_SUPPORTED | Safari pair S controls, real device required |
| C4 | FIXTURE_SUPPORTED | Safari pair L controls; overlap may be inconclusive |
| C5 | PHYSICAL_ONLY | Human tab switch + raw events |
| C6 | PHYSICAL_ONLY | Safe human app switch/return |
| C7 | PHYSICAL_ONLY | Safe human lock/unlock |
| C8 | PHYSICAL_ONLY | Safe ordinary swipe-up, not process proof |
| C9 | PHYSICAL_ONLY | Human Safari relaunch + manual R/preservation |
| C10 | PHYSICAL_ONLY | Human session/history route |
| C11 | FIXTURE_SUPPORTED | Neutral/Back/Forward signals; actual BFCache unknown |
| C12 | FIXTURE_OPTIONAL | Safe ordinary offline/load result, no SW |
| D1 | PHYSICAL_ONLY | Actual Home Screen vs bookmark install mode |
| D2 | PHYSICAL_ONLY | Independently bound real-device Settings provenance |
| D3 | FIXTURE_SUPPORTED | Safari/Home Screen S; sharing/isolation not assumed |
| D4 | FIXTURE_SUPPORTED | Independent pair L; no deduction from S |
| D5 | FIXTURE_OPTIONAL | Ordinary second-copy support/identity before S/L |
| D6 | PHYSICAL_ONLY | Safe human installed app switching |
| D7 | PHYSICAL_ONLY | Safe human lock/unlock |
| D8 | PHYSICAL_ONLY | Safe exact-card swipe-up; no termination inference |
| D9 | PHYSICAL_ONLY | Exact icon relaunch + manual R/preservation |
| D10 | FIXTURE_OPTIONAL | Safe offline/restore route, no SW/uninstall |

Counts: A 5 supported / 8 physical / 1 optional; B 2 / 7 / 1; C 3 / 8 / 1; D 2 / 6 / 2. Total **12 FIXTURE_SUPPORTED + 29 PHYSICAL_ONLY + 5 FIXTURE_OPTIONAL = 46**, unsupported-without-future-decision = 0. Every physical result remains NOT_EXECUTED.

## Validation and frozen gate

```powershell
cd frontend
node --test qualification/rel05g-patha/fixture.test.mjs
npm run typecheck
npm run build
```

Invariant tests cover namespace/denylist/origin/worker isolation, OLD/NEUTRAL noncooperation, CURRENT test lock/cancel/timer, exact tokens, fresh IDs/BFCache normalization, sequence/flush/error/privacy/cleanup, prior logs, deterministic asset bytes/hashes/immutability, no product imports/assets and DOM-only UI models. Mocks/DOM tests are NOT Edge/iPhone observations. Required new exact-head Push and PR CI each have test/typecheck/build/backend-rel05g1/backend-recovery SUCCESS; report the exact run IDs outside source. Product bundle is separately scanned for qualification content. Do not fix unrelated Windows K-333B fixture-anchor behavior.

E3 = NOT_ESTABLISHED; lifecycle source = REMAINS_UNAVAILABLE; physical qualification = NOT_EXECUTED. R2-U = NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF; bootstrap/Slice 2 = BLOCKED_BY_EVIDENCE_QUALIFICATION / BLOCKED_BY_BOOTSTRAP_ADMISSION_PREREQUISITE. PR #745 = KEEP_DRAFT_BLOCKED, untouched. No compatibleCreatorsQuiesced claim, authority/lifetime/admission record, creator router, registry, writer or G6 activation exists in this fixture.

Four reader gates remain false. Seven live-writer blockers remain OPEN (unbound pre-reset create; rollback visibility; old/new writer coexistence; UI identity gap; canonical field gap; analytics/projection/public claims; reset-fenced local edit). REL05G5A-001 = ACTIVATION_PREREQUISITE; B1 cacheKey P3 = OPEN_NON_BLOCKING; LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP = UNRESOLVED. All 20 ADMIT and 28 original acceptance criteria remain REQUIRED / NOT_EXECUTED. DB v7/schema v1/stores/indexes/keyPaths/backend/WorkoutSessionV1 unchanged.

FEATURE_REMOVAL_COMPATIBILITY and SURFACE_IS_NOT_AUTHORITY preserved: removing this fixture cannot affect production ownership; UI cannot issue authority. MULTI_SURFACE_COMPATIBILITY preserved as a requirement, physically unqualified. Any product SW, privilege, support commitment, container migration or writer-semantic requirement stops that subpath at PATH B/separate high-risk review.

Exact next step: **independent implementation review of the exact fixture head and delivery design**. Keep new PR Draft; no Ready, merge, auto-merge, remote branch deletion, physical run or subsequent implementation in this task.
