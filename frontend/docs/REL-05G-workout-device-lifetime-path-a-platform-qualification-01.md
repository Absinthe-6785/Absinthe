# REL-05G PATH A bounded platform qualification 01: access-limited evidence record

Workstream: `REL_05G_WORKOUT_DEVICE_LIFETIME_PATH_A_BOUNDED_PLATFORM_QUALIFICATION_01`.

## 1. Result and authority ceiling

Overall result: **`PATH_A_QUALIFICATION_BLOCKED`** by the executing environment's browser-observation limitations. The evidence publication is a docs-only record of attempted access, installed-file/OS metadata and remaining unknowns; it is **not completed Edge or iPhone behavioral qualification**.

| Independent state | Current result |
| --- | --- |
| E3 feasibility | `NOT_ESTABLISHED` |
| Lifecycle evidence source | `REMAINS_UNAVAILABLE` |
| Physical platform behavioral qualification | `NOT_EXECUTED` |
| Current bounded qualification decision | `NO_NEW_PRODUCT_DECISION_REQUIRED` for the authorized PATH A subset |
| New capability commitment | `ADDITIONAL_PRODUCT_PLATFORM_DECISION_REQUIRED`; no capability selected |
| Bootstrap admission | `BLOCKED_BY_EVIDENCE_QUALIFICATION` |

No observation below establishes P1-P7, issues lifecycle evidence, asserts creator retirement, supplies `compatibleCreatorsQuiesced=true`, permits an admitted authority, or changes an acceptance criterion. Tool unavailability is **not** a finding that Edge lacks an API or that E3 is universally impossible. A publicly reachable HTML document is not platform lifecycle evidence.

## 2. Exact baseline and predecessor closure

- Repository: `Absinthe-6785/Absinthe`.
- Canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`; `D:\Projects\Absinthe` was not used.
- Authoritative base/main: `d14e7b3db75dc4c55b46f254e382a0efbcece34d`.
- New topic branch: `codex/rel05g-path-a-platform-qualification-01`, created normally from that exact base with the tracked/index state clean; no reset, clean, stash or force operation.
- [PR #751](https://github.com/Absinthe-6785/Absinthe/pull/751): MERGED, reviewed head `10ed61fac9f4be17874023a6b6b436feb78cec46`, merge `d14e7b3db75dc4c55b46f254e382a0efbcece34d`, merged at `2026-10-05T00:44:22Z`.
- [Main-push run 37248673254](https://github.com/Absinthe-6785/Absinthe/actions/runs/37248673254): event `push`, exact merge head, completed SUCCESS; test/typecheck/build/backend-rel05g1/backend-recovery each SUCCESS. Thus the predecessor is independently `CLOSED_IN_MAIN`. Its CI is not evidence for this new publication or physical behavior.
- Live remote main was rechecked before preparing this document and remained the exact authoritative base.

All four **current-main** canonical documents were re-read in full before qualification attempts; historical publication-status prose within them remains historical:

1. [Authority contract and plan](REL-05G-workout-device-lifetime-authority-contract-and-plan.md).
2. [Bootstrap-admission prerequisite](REL-05G-workout-device-lifetime-bootstrap-admission-prerequisite.md).
3. [Admission evidence and writer-safe routing characterization](REL-05G-workout-device-lifetime-admission-evidence-and-writer-safe-routing-characterization.md).
4. [E3 controlled-platform feasibility](REL-05G-workout-device-lifetime-e3-controlled-platform-procedure-feasibility.md).

This publication does not revise their approved decisions or conclusions.

## 3. Current source baseline: no material drift

The exact-base inventory remains **nine direct production creation-capable calls in six groups**. The helper-internal delegation and runtime port invocation are excluded from the direct count, not ignored.

| Group | Direct source call lines | Count |
| --- | --- | --- |
| [healthRoutineSync](../src/lib/healthRoutineSync.ts) | 830 | 1 |
| [workoutRuntimeAuthority](../src/lib/workoutRuntimeAuthority.ts) | 177 | 1 |
| [workoutRangeReader](../src/lib/workoutRangeReader.ts) | 37, 75, 80 | 3 |
| [workoutSelectedDayReader](../src/lib/workoutSelectedDayReader.ts) | 37 | 1 |
| [verifiedWorkoutRangeSnapshot](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts) | 185 | 1 |
| [useHealthSelectedDayComposite](../src/components/views/features/health/useHealthSelectedDayComposite.ts) | 139, 222 | 2 |

[The raw helper](../src/lib/workoutLocalReaderAuthority.ts) still creates/repairs missing or format-invalid identity; the established-reader helper rejects malformed existing identity but delegates on absence. Exact valid string/case is preserved. The raw mirror write at line 11 and dormant foundation mirror write at line 265 remain the two implementations. The foundation's assertion validates the caller's supplied admission, not old-context absence; source scanning found no production import/consumer of that foundation.

The account-keyed `productionSessions` Promise cache still acquires identity synchronously inside its cache-miss IIFE before repository open; successful and rejected promises remain cached. No eviction, new denial, retry/readiness/recovery change or routing was introduced. Export/Settings/restore fan-in remains unchanged.

Source/public/scripts/entry/Vite/package scans reconfirm no repository-owned production lifecycle issuer, SW registration/admission protocol, privileged host, or R2-U implementation. Pure dormant writer-coordination vocabulary is not active admission. All four reader gates remain false. DB v7/schema v1 and the frozen writer debt remain unchanged. This source inspection does not enumerate historical registered workers, extensions, resident builds or a physical browser's containers.

## 4. Available environments and access boundary

| Target | Actually available to this task | Missing access / result |
| --- | --- | --- |
| Windows + Edge normal browser | Local read-only OS metadata and installed Edge binary metadata; Edge window inventory | No usable Edge browser connector; native browser capture stopped because it could not confidently determine the current URL. Storage/locks/lifecycle not executed |
| Edge installed-app/PWA-style surface | An earlier Edge inventory title was `fOr_Absinthe` | Title alone does not establish install mode. No install/profile identity or sacrificial surface was verified |
| iPhone Safari | No physical iPhone observation channel supplied to the executing task | `PHYSICAL_ACCESS_REQUIRED`; model/iOS/WebKit/mode UNKNOWN |
| iPhone Home Screen app | No physical installation available to the executing task | `PHYSICAL_ACCESS_REQUIRED`; install/container/version UNKNOWN |

The iPhone classification concerns **access available to this task**, not a claim that the human owns no iPhone. No responsive emulation, spoofed UA, desktop Safari substitute or inferred mobile result was used.

The browser inventory was rechecked on 2026-10-05: only Codex In-app Browser and Codex MCP Apps were exposed; Microsoft Edge was not exposed. `createBrowserTab('edge', ...)` had returned `Browser is not available: edge`. An in-app browser was not substituted for Edge physical evidence.

Windows computer-use inventory did list an actual `MSEdge` window. The initial state capture reported a minimized window. The recovery/capture attempt returned a policy stop: the current browser URL could not be determined with enough confidence. After the human supplied the public URL, a later inventory showed an Edge-style title suffix and a capture attempt also stopped; that title does not independently verify browser/install/private mode. No screenshot/DOM/profile evidence was successfully acquired. The computer-use stop rule was honored; no alternate input API, injected script, custom observer or policy bypass was attempted.

## 5. Retained observations and exact ceilings

All observations occurred on **2026-10-05 (Asia/Seoul)**. Exact UTC time is recorded where captured; earlier access attempts without a retained clock reading have date-only precision and are not presented as exact timed lifecycle traces. No personal profile path, auth token, other-app content or user record is published. Logs below are retained in this document; no screenshots were successfully produced for the qualification.

### O1 — installed Edge file and local OS registry metadata

Precondition: canonical workspace unchanged; read-only PowerShell diagnostics, no browser launch/control, permission change or privileged helper installation. At `2026-10-05T01:20:02.3778162Z` (10:20:02 Asia/Seoul), read Windows `CurrentVersion` fields and the file version of the Edge executable registered in `App Paths\msedge.exe`.

```json
{
  "ObservedAtUtc": "2026-10-05T01:20:02.3778162Z",
  "WindowsRegistry": {
    "ProductName": "Windows 10 Home",
    "DisplayVersion": "25H2",
    "CurrentBuildNumber": "26200",
    "UBR": 9457,
    "EditionID": "Core"
  },
  "InstalledEdgeFile": {
    "ProductName": "Microsoft Edge",
    "ProductVersion": "154.0.4258.53",
    "FileVersion": "154.0.4258.53"
  }
}
```

Reproduction: read only `ProductName/DisplayVersion/CurrentBuildNumber/UBR/EditionID` from `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion`; resolve the default registered Edge app path and read `VersionInfo.ProductName/ProductVersion/FileVersion`. Repeated reads in this task returned the same values. Do not publish the resolved user/profile path. A separate non-mutating `Get-CimInstance Win32_OperatingSystem` query was access-denied; no elevation was used to obtain its caption.

**Ceiling:** these are registry and installed-file observations. Preserve the registry's literal ProductName; do not reconcile it into an independently verified OS marketing name. Build/revision observed = `26200.9457`. Running Edge build, channel, private mode, profile, background/startup/restore policies and browser version UI remain UNKNOWN. Installed binary version is not proof of the version executing a retained realm, compatible Absinthe build, or any Storage/lock container. O1 reduces installed-metadata unknowns only; no lifecycle guarantee follows.

### O2 — browser/window access attempts

Precondition: only returned browser/app objects were used for target selection. Steps: enumerate browser providers; attempt requested Edge provider; enumerate native apps; select the uniquely returned MSEdge window; attempt read-only state capture; follow the prescribed minimized-window recovery; stop at the URL-confidence policy refusal. A later attempt with the newly inventoried MSEdge window also stopped. On resumption, enumerate browser providers again and retain the unchanged lack of an Edge connection without repeatedly issuing stopped Windows input.

Observed: Edge provider unavailable; native inventory reported MSEdge running and a window; state capture reported minimized, then policy refusal. Window title/application inventory is **`PROCESS_OBSERVATION_ONLY`**, not complete process-family mapping. Last-visible-window closure, remaining-process inspection via Task Manager, suspension, discard, restore, BFCache and offline tests were **NOT EXECUTED**. No process was killed; no existing user tab/window was closed. The underlying URL-confidence issue was not diagnosed or repaired in this workstream.

Reproducibility: provider absence was observed again; native URL-confidence refusal recurred. That recurrence describes this automation environment, not Edge's web-platform support. Exact timestamps for the earlier attempts were not retained. Origin/profile/install scope for the inventoried window remains unverified. O2 supplies no execution-state classification beyond the tool's minimized report and no retirement/absence claim.

### O3 — public HTML response, not platform qualification

After the human supplied [the public Absinthe URL](https://absinthe-beryl.vercel.app/), the web-reading tool reported the URL inaccessible through that tool. A separate unauthenticated, read-only HTTP GET using `Invoke-WebRequest -UseBasicParsing` returned HTTP `200`, content type `text/html; charset=utf-8`, HTML length `1066`, title `fOr_Absinthe`. This was a shell HTTP request, **not** an Edge navigation or executed JavaScript. Date precision: 2026-10-05; exact request timestamp was not retained. One successful GET was retained; repeat behavior is not qualified.

Precondition/steps: request only the supplied public root URL, with no credentials or browser profile; inspect status, content type, length and HTML title. No login, form submission, browser storage, production identity or real user data was accessed or changed. A successful root document response does not prove application rendering, authentication, loaded JS graph/build, deployment-to-base correspondence, service-worker state, profile/container scope or lifecycle behavior. No public runtime test was performed. P1-P7 impact is NO_IMPACT.

## 6. Storage, locks and execution-state results

| Surface pair / target | Storage result | Independent Web Lock result | Behavioral execution |
| --- | --- | --- | --- |
| Two same-profile Edge tabs | `UNKNOWN_STORAGE_SCOPE` | `UNKNOWN_WEB_LOCK_SCOPE` | NOT_EXECUTED |
| Edge visible/hidden/minimized/separate-window peers | `UNKNOWN_STORAGE_SCOPE` | `UNKNOWN_WEB_LOCK_SCOPE` | NOT_EXECUTED |
| Edge browser + installed surface | `UNKNOWN_STORAGE_SCOPE` | `UNKNOWN_WEB_LOCK_SCOPE` | NOT_EXECUTED |
| iPhone Safari tabs | `UNKNOWN_STORAGE_SCOPE` | `UNKNOWN_WEB_LOCK_SCOPE` | PHYSICAL_ACCESS_REQUIRED |
| Safari + Home Screen / multiple installs | `UNKNOWN_STORAGE_SCOPE` | `UNKNOWN_WEB_LOCK_SCOPE` | PHYSICAL_ACCESS_REQUIRED |

No localStorage/IDB test record was seeded. No test origin/profile/container was established; the public URL is **not** the sacrificial origin. No OLD_FIXTURE or CURRENT_FIXTURE was created because executable fixture observation was unavailable. Thus the noncooperating old-context counterexample, lock-contention test, durable-data persistence comparison and evidence-to-entry ordering experiment are **NOT_EXECUTED**, not negative results.

No tested surface can be labeled QUIESCED, RETIRED, SAFE or COMPATIBLE_CREATORS_GONE. Browser/app close, background-process survival, restored/reloaded/recreated state, history/BFCache/offline old-bundle behavior and installed-window coexistence remain UNKNOWN. No reinstall, site-data deletion, install, system-policy modification or force exit occurred.

## 7. P1-P7 impact matrix

Allowed labels here describe impact only. None is a proposition acceptance result.

| Observation | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| O1 installed-file/registry metadata | NO_IMPACT | NO_IMPACT | SCOPE_CLARIFICATION | NO_IMPACT | NO_IMPACT | NO_IMPACT | NO_IMPACT |
| O2 access/inventory limitation | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NO_IMPACT | NO_IMPACT | NO_IMPACT |
| O3 public HTTP HTML response | NO_IMPACT | NO_IMPACT | NO_IMPACT | NO_IMPACT | NO_IMPACT | NO_IMPACT | NO_IMPACT |

P3 scope clarification is specifically that **installed browser binary version is not entering application build/protocol attestation**. P4 remains unmeasured. P1/P2 remain missing complete-scope retirement/continuous-entry evidence; no counterexample experiment ran. P5 has no qualified episode/issuer. No P6/P7 future shutdown or cutover procedure was tested. The docs-only publication itself leaves data and writer source unchanged, which is not proof of a future procedure's preservation.

## 8. PATH B stop boundaries and writer firewall

No PATH B capability was selected or implemented. An unavailable automation connector is not permission to install an extension, create a privileged observer, build a native bridge or add production delivery architecture. Such a proposed dependency requires `ADDITIONAL_PRODUCT_PLATFORM_DECISION_REQUIRED` before commitment.

If a future complete container/process-to-storage mapping and continuous launch exclusion requires privileged enforcement, classify that subpath `PATH_B_E2_LIKE_CAPABILITY_REQUIRED` and stop. Ordinary window inventory/Task Manager observations would still be PROCESS_OBSERVATION_ONLY, not TRUSTED_PROCESS_ATTESTATION. If a proposed reinstall, new origin/profile/container, storage reset or migration changes data ownership, stop at the E4 boundary. No migration workaround or capability is chosen here.

Writer firewall preserved by scope: no deviceId, namespace/repository identity, productionSessions cache/rejected Promise, retry/readiness/recovery/reset, mutation/outbox identity, digest, binding, CAS, receipt, transport or authorityEpoch change. No drain/flush/eviction, writer denial or data-plane operation occurred. Any future observation needing a writer semantic change requires STOP and the separate high-risk prerequisite; user consent or qualification CI cannot waive it.

## 9. Frozen states

| Item | Unchanged result |
| --- | --- |
| R2-U | NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF |
| Bootstrap admission | BLOCKED_BY_EVIDENCE_QUALIFICATION |
| [PR #745](https://github.com/Absinthe-6785/Absinthe/pull/745) | KEEP_DRAFT_BLOCKED; live Draft/Open/Unmerged, head `2ad2ec573490b5c0a507b23bb06e98cba34c65be`; not modified |
| REL05G-EXCOMP-OWNER-001 | BLOCKED_BY_DEVICE_AUTHORITY_PREREQUISITE |
| REL05G-EXCOMP-IMPL-001 | CLOSED |
| Slice 2 | BLOCKED_BY_BOOTSTRAP_ADMISSION_PREREQUISITE |
| HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED | false |
| HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED | false |
| HOME_WORKOUT_COMPOSITE_READER_ENABLED | false |
| SEARCH_WORKOUT_COMPOSITE_READER_ENABLED | false |
| G5B_UNBOUND_PRE_RESET_CREATE_BLOCKER | OPEN |
| G5B_ROLLBACK_VISIBILITY_BLOCKER | OPEN |
| G5B_OLD_NEW_WRITER_COEXISTENCE_BLOCKER | OPEN |
| G5B_UI_IDENTITY_GAP | OPEN |
| G5B_CANONICAL_FIELD_GAP | OPEN |
| G5B_ANALYTICS_PROJECTION_BLOCKER | OPEN |
| reset-fenced local edit policy | OPEN |
| REL05G5A-001 | ACTIVATION_PREREQUISITE |
| B1 cacheKey P3 | OPEN_NON_BLOCKING |
| LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP | UNRESOLVED |
| FEATURE_REMOVAL_COMPATIBILITY | PRESERVED; no optional surface change |
| SURFACE_IS_NOT_AUTHORITY | PRESERVED; no page/title/operator assertion issues authority |
| MULTI_SURFACE_COMPATIBILITY | PRESERVED as requirement, physically unqualified |
| Local DB / schema / stores / indexes / keyPaths / WorkoutSessionV1 / backend | v7 / v1 / all unchanged |

All original DEVLIFE-C01-C28 and DEVLIFE-ADMIT-C01-C20 remain at their existing REQUIRED / NOT_EXECUTED ceiling. No writer blocker, reader activation, analytics claim or G6 acceptance is closed.

## 10. Validation, publication and exact next step

Only this new Markdown evidence record is published. No fixture, production/runtime/source/test/config/dependency/backend edit. Static local-link/scope/status consistency validation and `git diff --check` are required before commit. Runtime tests were not added merely to obtain green CI. New exact-head Push and PR CI must each finish test/typecheck/build/backend-rel05g1/backend-recovery SUCCESS; run/head evidence belongs in the publication report/PR body, not a self-referential artifact commit. CI validates repository regression only, **not these observations or any physical qualification**.

Publication uses a normal commit/push on the new topic branch and a NEW Draft PR targeting main, never PR #751 or #745. Do not mark Ready, merge, enable auto-merge or delete branches. Publication completion cannot turn `PATH_A_QUALIFICATION_BLOCKED` into behavioral qualification completion.

Exact next step: **independent review of this PATH A publication's exact head and evidence claims**, with the explicit blocked/NOT_EXECUTED ceiling. A separately resumed PATH A observation task needs a working approved Edge observation channel and an explicitly sacrificial origin before storage/lock/lifecycle experiments; physical iPhone access remains required for Safari/Home Screen. Do not implement E3, R2-U, bootstrap admission, resume Slice 2, modify #745, activate readers/writers or start G6. No observation is promoted into lifecycle authority before independent review.
