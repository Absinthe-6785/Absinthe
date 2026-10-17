# REL-05G Option C post-decision handoff

Task: REL_05G_OPTION_C_POST_DECISION_HANDOFF_01.

Status: OPTION_C_POST_DECISION_HANDOFF_REVIEW_PENDING. Docs-only handoff; independent architecture review is PENDING. No next-task implementation is authorized.

## 1. Baseline, evidence labels and closed decision

OBSERVED_FACT: repository Absinthe-6785/Absinthe, canonical workspace `C:\Users\이도현\GitRepos\Absinthe`, tracked/index clean at start, and local topic start, origin/main and remotely queried main all equal `7d76193ddfe9e24df0974f762f09bef97343abba` (BASE_SHA). The forbidden alternate workspace was not used. This artifact is grounded in that immutable baseline, not future main.

OBSERVED_FACT: these are four distinct evidence labels throughout this handoff. OBSERVED_FACT means inspected checked-in source/contract, verified GitHub metadata, or the explicitly limited local probe below. DESIGN_INFERENCE means a bounded deduction, not an established capability. RECOMMENDATION means a priority or required future proof. UNAUTHORIZED_PROPOSAL means a possible separately authorized task, not permission from this document. Table rows inherit their explicit Kind column; role-owner assignments are architectural responsibility recommendations, not claims about assigned people.

| PR | Kind | Verified merged commit | Governing artifact at BASE_SHA and closure scope |
| --- | --- | --- | --- |
| [#778](https://github.com/Absinthe-6785/Absinthe/pull/778) | OBSERVED_FACT | `1765a0fbf35eb3c1ac17b7dbe08b13367b35308f` | [F0 finite-admission contract][F0]; policy/contract CLOSED_IN_MAIN, not executable finite admission. |
| [#779](https://github.com/Absinthe-6785/Absinthe/pull/779) | OBSERVED_FACT | `5ddb5f42b333639876ddee7eaabcece8ceb0811d` | [F1-P0 witness characterization][P0]; CLOSED_IN_MAIN, not a source issuer. |
| [#780](https://github.com/Absinthe-6785/Absinthe/pull/780) | OBSERVED_FACT | `06634f27eaeb42ee4e40cf9b775d9a1698786fea` | Implementation artifact: [bounded diagnostic issuance][ERROR], [owner attribution/adapters][ADAPTER], [B1][B1], [RANGE][RANGE], [effect regressions][EFFECT_TEST]. F1-P1 CLOSED_IN_MAIN; no dedicated Markdown deliverable is invented for this code PR. |
| [#781](https://github.com/Absinthe-6785/Absinthe/pull/781) | OBSERVED_FACT | `7456abcadf11aa4b2df637da4b6b6a0ac278ad1d` | [Producer-capability characterization/decision][P2]; CLOSED_IN_MAIN, not F1-P2 implementation or PC runtime acceptance. |
| [#782](https://github.com/Absinthe-6785/Absinthe/pull/782) | OBSERVED_FACT | `7d76193ddfe9e24df0974f762f09bef97343abba` | [Post-characterization decision][POST]; CLOSED_IN_MAIN. DECISION_POLICY = MAINTAIN_OPTION_C. |

OBSERVED_FACT: all five governing artifacts were read, including #780's actual implementation rather than treating a PR title as proof. Publication-time review-pending/next-action labels inside older documents remain historical records after their verified merges. This handoff does not rerun their reviews, erase review history, or equate a merged design with completed runtime acceptance. [Baseline main Push CI 39034238374](https://github.com/Absinthe-6785/Absinthe/actions/runs/39034238374) succeeded for test, typecheck, build, backend-rel05g1 and backend-recovery; this is not CI or independent review of the new handoff.

OBSERVED_FACT: MAINTAIN_OPTION_C preserves the existing evidence-only implementation and UNKNOWN/denied new finite admission. B1_CAUSAL_CAPABILITY = UNKNOWN; RANGE_CAUSAL_CAPABILITY = UNKNOWN; D_CAUSAL_CAPABILITY = UNSUPPORTED. There is no currently qualified positive causal producer. The UI composition Option C, producer decision option C and F0's current deny-only policy are related but differently named decisions; this document changes none of them.

## 2. Current workstream inventory

OBSERVED_FACT: classification vocabulary is A CLOSED_IN_MAIN; B BLOCKED_BY_CAUSAL_CONTRACT; C BLOCKED_BY_WRITER_AUTHORITY; D BLOCKED_BY_PRODUCT_DECISION; E INDEPENDENTLY_ACTIONABLE; F REQUIRES_CHARACTERIZATION; G HISTORICAL_OR_SUPERSEDED. A describes the named delivered boundary only, not every larger workstream containing it. E means technically independent under an existing functional contract, not implementation authorization here. Multiple independent dependencies are stated rather than hidden by one letter.

| Work item | Class / Kind | Actual current boundary and remaining dependency |
| --- | --- | --- |
| Dormant canonical Workout local/remote foundations through G4C | A / OBSERVED_FACT | [Session repository][SESSION_REPO], [binding/pull repository][BIND], [reset foundation][RESET] and [authority bootstrap][AUTHORITY] exist in main. These are delivered foundation APIs, not a product writer/worker cutover or proof that the seven blockers are closed. |
| G5A account authority/bootstrap control plane | A foundation; C/D activation / DESIGN_INFERENCE | The controller discovers/persists authority; its ready state is not Save permission. Malformed established identity remains REL05G5A-001 ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION, separately preserved by [provenance HOLD][PROVENANCE]. |
| Strict typed editor/V1 adapter | A / OBSERVED_FACT | [Adapter][EDITOR] has closed keys and stable session/entry/set identity operations. This closes the pure dormant adapter subpart, not mounted UI/draft writer identity or unsupported canonical fields. |
| Gated selected-day, shared range, Previous/Calendar, Home/Search and comparison reader work | A delivered gated boundaries; D public rollout / OBSERVED_FACT | [AppContent][APP] owns shared day/range hooks; [HealthView][HEALTH] consumes existing Previous/Calendar paths. Five literal false gates remain. Shared source reuse and qualified unavailable-versus-empty behavior do not authorize public activation or all analytics claims. |
| Existing independent legacy Previous currentness D | A / OBSERVED_FACT | [D owner][D_OWNER] and [hook][D_HOOK] are implemented. This D is not the unimplemented upward Slice C bridge and is not proof of D causal capability. Existing LOCAL/REMOTE and block/cutoff/rejection rules remain. |
| Slice 0 shared operation/date-ABA | A / OBSERVED_FACT | [Opaque operation scope][OP] plus [committed lifetime][LIFE] are present and used in HealthView. Currentness retirement is not source causal continuity. |
| Slice A pure parent availability/action model | A / OBSERVED_FACT | [Pure model][MODEL] is delivered; representable TRANSIENT/ELIGIBLE inputs do not create real facts or permits. |
| Slice B owner publication adapters | A negative/currentness boundary; B positive admission / OBSERVED_FACT | [Adapters][ADAPTER] capture current owner evidence, deny UNKNOWN and expose FINITE_PERMIT_NOT_EXPOSED. No finite consumption/dispatch port exists. B18/B20 denial tests are not positive acceptance. |
| F0, F1-P0, F1-P1, producer characterization and post-characterization decision | A / OBSERVED_FACT | Exact closures are in section 1. #780's reflection-free bounded diagnostics are retained, not reopened as defective without a new reproduction. |
| F1-P2 qualified causal producer, positive transient classification | B / OBSERVED_FACT | NOT_AUTHORIZED, no proven subset/positive allowlist; [capability matrix and PC01-PC18][P2_ACCEPTANCE] are requirements, NOT_EXECUTED runtime acceptance. |
| F2 finite permit; B18 eligibility; B20 consumption | B / OBSERVED_FACT | F2 NOT_STARTED; both criteria NOT_PROVEN. Existing raw reload/recovery APIs do not fill the gap. |
| Slice C local recovery controller + bounded D bridge | B / OBSERVED_FACT | BLOCKED_BY_CONTRACT_GAP. [Current restart/routing contract][F0_ROUTE] and [post-decision boundary][POST_C] do not authorize an all-denied implementation as completion. |
| Slice D stable shell/Calendar-only extraction | B transitively; separate implementation authorization / DESIGN_INFERENCE | [Design][SLICES] requires A + C. Existing Calendar component is not this stable parent-shell integration. No approved dependency substitution. |
| Slice E shared desktop/mobile Previous availability owner | B transitively; separate implementation authorization / DESIGN_INFERENCE | Requires D shell/model. Existing Previous components/D currentness do not complete the proposed shared eligibility/selection owner. |
| Slice F draft-preview/callback admission | B transitively; writer semantics frozen / DESIGN_INFERENCE | Requires 0 + A + B + D. Shared date-ABA and existing callback guards are delivered subparts; complete Option C preview/action composition is not claimed delivered. |
| Slice G integrated Option C acceptance | B plus D/F / DESIGN_INFERENCE | Requires 0 + C + E + F, then separately authorized copy/accessibility/physical/performance work. PA-C01-C18 overall completion is not inferred from foundation CI. |
| Seven live-writer blockers / G5C product data plane / G6 | C, some D / OBSERVED_FACT | All seven OPEN (section 3). Dormant bind/push/pull/resync/reset APIs do not grant activation; no G6. |
| Device-lifetime/provenance recovery, creator/writer continuity, E3/target control | D plus C; F only if separately commissioned / OBSERVED_FACT | [Approved HOLD][PROVENANCE] selects no capability or automatic research. Prior bounded platform/fixture evidence is not provenance, supported-platform-wide acceptance or writer-transition proof. |
| EN/KO/JA public state/action copy, physical browser/AT and whole-parent performance acceptance | D/F, integration also B / OBSERVED_FACT | [PA-C15-C18][PUBLIC_ACCEPTANCE] retain separate owner-selected criteria and execution. Existing CI/fixture evidence cannot pass these; no copy selection or product measurement starts here. |
| Recovery archive byte determinism | E / OBSERVED_FACT | Current concrete defect reproduced below within the existing pure supplied-package contract; no causal or writer prerequisite. Preferred future candidate I1. |
| K-333B Windows source-fixture portability | E with bounded characterization / OBSERVED_FACT | Literal LF mutation anchors mismatch a CRLF checkout; I2 below. This is test infrastructure, not transaction-protocol authority. No fix included here. |
| Older prep “next” model/adapter/Home/Search characterization and shared date-ABA tasks | G for scheduling / DESIGN_INFERENCE | Delivered subparts above supersede those next-action instructions. Preserve design history; do not schedule duplicate work from stale headers. |
| Generic repeated producer survey or synthetic witness registry | G for current scheduling; B for any positive use / RECOMMENDATION | #781/#782 already close the surveyed negative decision. Do not restart without section 8 evidence. A new identifier/error taxonomy cannot supply the missing cause. |

DESIGN_INFERENCE: F1-P2 is therefore not a universal Health prerequisite. Pure adapter/model work, the shared ABA correction and existing recovery tooling are independent examples. Conversely, moving a blocked shell/recovery slice under “cleanup” does not make it independent. No proposed UI extraction has been demonstrated safe enough here to outrank the two concrete isolated candidates.

## 3. Seven live-writer blockers, all OPEN

OBSERVED_FACT: [G5B cutover preparation][WRITER_LIST] defines the seven; [current provenance freeze][PROVENANCE_FREEZE] preserves their current wording, including mounted UI identity and analytics/public claims. The older list predates the delivered pure adapter and dormant readers. The matrix below carries that progress forward without closing any blocker. REL05G5A-001 remains a separate activation prerequisite, not an automatically invented eighth writer blocker.

| Blocker / status | Kind; proposed responsible owner and affected route | Existing authority versus missing authority | Required proof; causal dependency; independently bounded characterization |
| --- | --- | --- | --- |
| G5B_UNBOUND_PRE_RESET_CREATE_BLOCKER / OPEN | DESIGN_INFERENCE; local-outbox/reset architecture owner; offline first-create -> later bind across reset/epoch | [G2 create][SESSION_REPO] freezes an unbound mutation; [G4B1 binder][BIND_BASE] can bind an initial no-remote-base create with CAS null. Dormancy is safe today, not durable proof of creation-era authority. Missing: reviewed creation-era epoch evidence and stale-intent quarantine/resolution before binding. | Prove pre-reset offline create cannot appear as new-epoch intent; exact replay/CAS/lease/epoch and pending mutation immutability. Not causally dependent on F1 UI retry; requires writer/data-plane contract. Static contract/race characterization can be separately scoped without activating delivery; implementation cannot. |
| G5B_ROLLBACK_VISIBILITY_BLOCKER / OPEN | DESIGN_INFERENCE; product/release + reader owner; V7-only save -> old/rolled-back legacy-only client | Dormant composite readers can represent both sources. Missing: approved rollback-compatible reader or forward-only rollout/recovery policy. Bytes surviving is not product visibility; no cross-DB dual-write escape hatch. | Drill old/new deployment visibility, recovery and unsupported/offline clients with explicit policy. Not dependent on finite causal permits; writer rollout authority is missing. Static version/visibility matrix is independently characterizable, not a rollout approval. |
| G5B_OLD_NEW_WRITER_COEXISTENCE_BLOCKER / OPEN | DESIGN_INFERENCE; release/G6 and legacy/canonical writer owners; old/offline legacy writes beside new canonical writes | [Current persistence][PERSIST] still supports legacy rows; dormant composite reads preserve honest coexistence. Missing: reviewed restriction/fencing and old-client/offline arrival policy. Read coexistence is not convergent dedupe. | Prove late old-client writes cannot bypass chosen fence or lose user intent; forward/rollback compatibility. No F1 dependency; G6/writer policy dependency. Static client-version/queue inventory can be separately scoped; no G6 execution here. |
| G5B_UI_IDENTITY_GAP / OPEN | DESIGN_INFERENCE; Health editor/draft + canonical repository owners; mounted Today/planning/Save/Delete | [Typed adapter][EDITOR] is delivered and rejects unknown fields. [Mounted HealthView][HEALTH] and [legacy persistence][PERSIST] are not a canonical UUID round-trip writer. Missing: separately reviewed editor/draft integration and callback ownership. | Same-day multiple sessions; exact surviving entry/set UUIDs; hydration/reorder/delete; account/date ABA; CAS/failure preserves draft; no accidental legacy/canonical adoption. F1 is not inherently needed for a pure adapter; proposed Option C mounted composition has its own Slice C dependencies. Bounded identity-flow characterization is possible; no writer wiring. |
| G5B_CANONICAL_FIELD_GAP / OPEN | DESIGN_INFERENCE; product owner + V1 contract owner; session memo/performedAt/timeZone/labels versus external date/account memo | [Closed editor keys][EDITOR] and V1 intentionally exclude these session-owned fields; current memo is separate. Missing: explicit field-ownership/product disposition and a separate reviewed contract if new durable fields are wanted. | Prove external memo remains external and unsupported input is rejected, not silently dropped. No causal admission dependency. Static field/consumer matrix is independently possible; no V1/schema change or product choice here. |
| G5B_ANALYTICS_PROJECTION_BLOCKER / OPEN | DESIGN_INFERENCE; reader/analytics/export + product owners; Health range/Previous/Calendar/Home/Search/metrics/export/public truth | Several gated projections/consumers are already in main ([APP], [HEALTH]); not all are absent as the original prep said. Missing: complete reviewed consumer/metrics/export semantics and separately approved visibility/rollout/acceptance for V7-only product writes. | Mixed legacy/canonical/multi-session/no-collapse, partial/unavailable not empty, supported consumer coverage and old-client visibility. Pure projection checks need no causal proof; full Option C parent activation still has separate causal/product vetoes. Bounded consumer-coverage characterization is possible; no new source scan or public claim. |
| Reset-fenced local edit policy / OPEN | DESIGN_INFERENCE; local-first editor/outbox/reset architecture + product owners; Save while reset_fenced and later resolution | [Authority state][AUTHORITY] and [dormant reset][RESET] exist; local-first save must not wait for G5A ready. Missing: explicit local durability/unbound/quarantine semantics and “saved here, not synchronized” warning/resolution. | Prove durable save and draft/failure handling while fenced, no automatic old-epoch rebind, exact conflict/resolution ownership. Independent of finite UI causal retry; requires writer/product authority. Static state/intent matrix possible; executable transition is not authorized. |

RECOMMENDATION: keep technical characterization permission distinct from a product decision and from implementation permission for every row. The proposed owners/proofs are a handoff responsibility map, not new API contracts. No writer blocker is closed by this inventory, the ZIP recommendation or future tests; no existing local save becomes contingent on causal permits or G5A readiness.

## 4. Current Slice C versus a possible alternate path

OBSERVED_FACT: CURRENT_SLICE_C_CONTRACT = local recovery controller + bounded D bridge; SLICE_C = BLOCKED_BY_CONTRACT_GAP. [F0][F0_RESTART] requires reviewed admission for each owner allowed to execute, then separate Slice C authorization. RANGE/B1/D raw methods are necessary routing targets, not permits. D can remain unsupported; an admitted subset would still require proof for that subset. Positive transient classification, B18 and B20 remain unavailable.

DESIGN_INFERENCE: POSSIBLE_FUTURE_DENY_ONLY_VARIANT is conceptually separable as status/unsupported registration with zero executable requests, but feasibility and product usefulness are NOT_ESTABLISHED. Representability in a model is not fulfillment of #773/F0 recovery/coalescing acceptance. D ensure/invalidate, existing refresh methods, new listeners or a hidden controller cannot be smuggled into it.

UNAUTHORIZED_PROPOSAL: any such variant needs (1) separate human product decision on truthful no-execution recovery UX and existing independent recovery preservation; (2) explicit new contract disposing of Slice C restart/acceptance and Slice D downstream dependencies; (3) independent review; (4) separate implementation authorization. It is not the preferred task, not a replacement contract in this handoff and not a promise that D/E/F/G may proceed. No speculative scaffolding is created.

## 5. Independent candidates and product-debt ranking

RECOMMENDATION: rank only work with concrete source evidence and acceptance, without unsupported numeric scores. Both candidates below are UNAUTHORIZED_PROPOSAL for later execution. Their existing functional/test authority is sufficient to define a bounded scope without a new causal producer, finite permit, reader activation, writer capability or backend/schema migration; it does not grant implementation permission now.

### I1 — recovery ZIP timestamp determinism (preferred)

OBSERVED_FACT: [K-320 format contract][EXPORT_CONTRACT] promises fixed ZIP timestamps/permissions/order. It is supplied-data preservation, not restore/migration/sync; [package descriptors][EXPORT_DATASETS] include Health datasets. [createRecoveryExportArchive][ARCHIVE] fixes file dates to 1980-01-01 but passes createFolders=true. Its automatically created directory entries retain current dates. [Existing byte-equality test][ARCHIVE_TEST] compares adjacent calls without controlling time. [Prior diagnosis][HISTORICAL_ZIP] explicitly retained this risk as unrelated, not fixed by #770.

OBSERVED_FACT: a current read-only, memory-only probe evaluated the actual BASE_SHA TypeScript module through local TypeScript transpilation, with Node v24.14.0 and JSZip 3.10.1. It built one synthetic supplied package (exportedAt 2026-10-17T00:00:00.000Z, workoutLogs present_empty), then invoked the actual archive function twice on the same package while controlling zero-argument Date/Date.now four seconds apart; explicit date constructors were preserved and the process-local clock override restored. Source SHA-256 of local checkout bytes was `d6573d25541a35400f5fa8a811f55d775a2d67cc129fa9d8d74f6a67b08c6251` (checkout line endings, not the Git blob hash).

| Probe result | Kind | Observation |
| --- | --- | --- |
| ZIP bytes | OBSERVED_FACT | Unequal: first SHA-256 `884e80db730eda9a9392e308fa9d1604dc5be5c14b1d7618fa315b61442feaed`; second `7574215c041699147793792b7e632a090967ab4653f810aecf1153901b6d2f4c`. |
| Changed entries | OBSERVED_FACT | Seven directories: root absinthe-recovery-export/ and attachments/, health/, metadata/, notes/, planning/, recipes/ below it. Dates changed from 00:00:00Z to 00:00:04Z. |
| Payloads and package | OBSERVED_FACT | No entry payload differences; package object unchanged; actual package verifier returned valid. No product owner/database reads; no files written. |
| Scope limit | DESIGN_INFERENCE | Confirms byte reproducibility debt and a wall-clock-dependent test hazard. Does NOT demonstrate payload corruption, restore data loss, physical-platform qualification or any causal witness. One controlled environment is not universal byte identity across library/runtime versions. |

UNAUTHORIZED_PROPOSAL: exact scope is archive serialization in recoveryExportPackage.ts plus its focused test. Keep format schema 2, supplied inputs, manifest/checksums/content and safe paths unchanged. No source-adapter expansion or live export acquisition. Value: make the existing recovery artifact determinism promise true and the regression falsifiable across time, rather than merely silencing a CI failure. Oracle: identical package under separated controlled clocks yields identical ZIP bytes and safe extracted payloads. Risks: implicit-directory handling can alter entry layout; retain validator/CLI compatibility. STOP if satisfying the contract needs acquisition/restore changes, new archive format, dependency upgrade, writer/reader authority or broad export refactoring.

### I2 — K-333B source-fixture newline portability (second)

OBSERVED_FACT: [replaceOnce][FIXTURE_REPLACE] throws when a mutation anchor is missing; [test fixtures][FIXTURE_TEST] read raw transactionEvidenceProtocol.ts and embed LF-specific multi-line anchors. A current read-only string probe of this checkout found CRLF=true, raw LF loop-anchor=false, and the exact same anchor after in-memory CRLF-to-LF normalization=true. [Prior validation][HISTORICAL_FIXTURE] records the unchanged Windows Mutation anchor missing failure. This probe is not a new full-suite run and does not prove every possible newline issue.

UNAUTHORIZED_PROPOSAL: exact scope is the source-fixture construction in transactionEvidenceProtocol.test.ts, not the production protocol. Bounded prerequisite: inventory every multi-line mutation anchor and prove the semantic analyzer/negative mutations have identical expected outcomes for supplied LF and CRLF variants. Potential test-only correction normalizes the in-memory fixture boundary, not repository files. Value: portable independent mutation tests and trustworthy local safety feedback. Oracle: every intentionally bad selector/loop mutation still produces its exact expected failure, pristine variants both pass, missing/duplicate anchors remain explicit failures. No causal fact, owner read or writer authority is required. Risks: overbroad string normalization could weaken mutation controls or change locations; STOP if production protocol, assertions, error codes, timeouts, CI skips or global line-ending/config changes are needed. It is not fixed in this handoff and must not be mixed into I1.

RECOMMENDATION: I1 ranks first: a currently reproduced violation of the existing recovery artifact contract, pure isolated function, two-file likely boundary and a direct failing clock-separated oracle. Payload integrity is preserved in the probe, so data-loss urgency is not fabricated. I2 ranks second: real local verification debt with a strong semantic-negative-control oracle, but test-only rather than an artifact correctness fix. A diagnostic “quality refactor,” generic UI extraction, deny-only shell, more producer research and broad consumer migration are not ranked actionable implementations: no new defect/independence proof or missing product authority was established for them. Seven-writer characterization can be independently scoped later but is higher-authority/risk work, not an automatic next implementation.

## 6. Exactly one preferred next task

UNAUTHORIZED_PROPOSAL:

    NEXT_TASK = REL_05G_RECOVERY_EXPORT_ZIP_TIMESTAMP_DETERMINISM_CORRECTION_01
    AUTHORIZATION_STATUS = PROPOSED_NOT_AUTHORIZED
    EXPECTED_PR_TYPE = BOUNDED_RUNTIME_CORRECTION_PLUS_REGRESSION_TESTS / DRAFT

UNAUTHORIZED_PROPOSAL: objective is to satisfy the existing fixed-metadata ZIP contract for identical supplied RecoveryExportPackage inputs, including implicit folders, across a controlled clock change. It is not a new export source, recovery action, provenance capability or feature. Source evidence is section 5 I1, not an inferred transient-failure cause.

| Boundary | Kind | Required next-task scope, only after separate authorization |
| --- | --- | --- |
| Concrete affected files | UNAUTHORIZED_PROPOSAL | Production: frontend/src/lib/recoveryExportPackage.ts, createRecoveryExportArchive only. Tests: frontend/src/lib/recoveryExportPackage.test.ts. Read-only compatibility targets: frontend/scripts/recovery-zip-safety.mjs and frontend/scripts/recovery-package-cli.mjs. No unrelated K-333B edit. |
| Existing authority | OBSERVED_FACT | K-320 already promises fixed archive metadata for supplied sources. Its contract expressly excludes live IDB crawl, restore/reconcile/migrate/sync. Local DB v7/schema v1 and export package schema v2 are different contracts; neither changes. |
| Minimal implementation | UNAUTHORIZED_PROPOSAL | First add the failing controlled-clock regression. Make directory metadata deterministic without changing payload semantics. Prefer preserving current directory/file entry structure and fixing all directory dates explicitly; any alternative must independently demonstrate existing ZIP safety and CLI compatibility, not assume them. Keep sorted entries, permissions, STORE compression and DOS platform behavior. |
| Required characterization | UNAUTHORIZED_PROPOSAL | Reproduce actual builder output under fixed Date at T and T+4s in an isolated test with finally/restoration; inventory every directory and relevant archive metadata. This bounded archive check is sufficient; do not reopen F1 producer/platform research. If nondeterminism has another source, document it and stop expansion before changing dependencies/format. |
| Acceptance tests | RECOMMENDATION | Identical package -> identical bytes across controlled DOS timestamp ticks; all file/directory timestamps deterministic; enumeration permutations still equal; repeated calls leave package unchanged; payload/manifest/checksum/completeness/tombstone/availability semantics unchanged; safe archive-entry validation and CLI export/verify directory/verify ZIP round-trip still pass. |
| Negative controls | RECOMMENDATION | A test-only variant omitting directory date normalization must fail clock-separated byte equality; changing content must change bytes/checksum as appropriate. Retain traversal, duplicate/case-collision, directory/file and local/central-name disagreement rejection. Do not replace byte equality with extraction-only equality. No real sleeping, random time or increased timeout as the fix. |
| Validation and independent review | RECOMMENDATION | Run focused recovery suite, full frontend suite, typecheck, build, diff check, then exact-head Push and PR CI with all five required jobs. Accurately retain any unrelated known Windows K-333B failure and require hosted exact-head full-suite evidence; do not fix it opportunistically. Reviewer independently reproduces the original defect, checks narrow metadata-only fix and negative-control effectiveness, package compatibility and unchanged authority. No author self-certification. |
| STOP | RECOMMENDATION | Stop on baseline drift, unexpected dirty overlap, broader required files/format/dependency changes, failed compatibility/negative controls, new source reads/restoration/IDB/storage probes, reader or writer activation, provenance work, schema/backend/V1 change or any causal/permit claim. Ask for a new bounded scope; do not expand automatically. |

RECOMMENDATION: a separate human request must authorize this future correction. Publish only this handoff now. Do not create an implementation branch, issue, second PR, prototype, test file or dependency patch for NEXT_TASK in this task.

## 7. Bounded dependency graph

DESIGN_INFERENCE: arrows below mean required dependency, not execution authority. The independent branch is not a hidden prerequisite or solution for the blocked branch.

```text
CLOSED FOUNDATION
  Slice 0 -> A -> B negative adapters
  F0 + F1-P0 + F1-P1 + producer characterization + MAINTAIN_OPTION_C
       |
       +-> CURRENT CAUSAL BLOCKERS: real producer/continuity proof absent
       |     -> F1-P2 NOT_AUTHORIZED -> F2 NOT_STARTED
       |     -> B18/B20 NOT_PROVEN -> Slice C BLOCKED_BY_CONTRACT_GAP
       |     -> D shell -> E shared Previous
       |     -> F preview/action composition -> G integrated acceptance
       |        (exact additional 0/A/B/D dependencies remain in #773)
       |
       +-> CURRENT WRITER/PRODUCT BLOCKERS: seven OPEN + provenance HOLD
       |     -> separately approved writer/rollout/identity contracts and proof
       |     -> separately authorized implementation/qualification; no G6 now
       |
       +-> INDEPENDENT EXISTING-CONTRACT WORK, no causal/writer edge
             I1 ZIP determinism preferred; I2 test-fixture portability second
             -> separate bounded human authorization
             -> implementation + independent review + ordinary final gate

FUTURE DECISION GATES (not satisfied by I1/I2)
  named causal reopening packet -> separate feasibility/design/F1 authority
  possible deny-only variant -> product decision + new contract + review + authorization
  public copy/physical/whole-parent performance + identity veto disposition
  -> separate activation decision; all current reader gates remain false
```

OBSERVED_FACT: the exact conservative [design dependency graph][SLICES] remains `0 -> A; A -> B -> C; A+C -> D; D -> E; 0+A+B+D -> F; 0+C+E+F -> G`. I1/I2 satisfy none of these missing dependencies. Existing public-facing legacy behavior and independent recovery continue under their own contracts.

## 8. Causal reopening rules and persistence/effect freeze

RECOMMENDATION: reopen the closed negative producer decision only with one named real production issuer/operation and a concrete source-owned condition, independent SAME/DISTINCT/RESOLVED oracle, original source lifetime and committed owner lifetime, retirement/account/date/layout/device/generation ABA and reload/realm limits, no hidden read/recovery effects, matched persistence-effect parity and falsifiable negative controls. [PC01-PC18][P2_ACCEPTANCE] and [post-decision reopening rules][REOPEN] remain unsatisfied runtime obligations, not passed by this handoff.

OBSERVED_FACT: a request, publication, observed failure occurrence and causal episode are distinct. Equal codes/data/Error objects, WeakMap membership, timestamps, repeated promises, generated UUIDs and synthetic witness shapes do not establish continuity. SAME-unknown is not DISTINCT; successful read/reload/restoration is not root-cause RESOLVED. An unsupported RESOLVED oracle needs an explicit safe denied disposition, not silent allowance replenishment. The ZIP clock probe establishes archive nondeterminism only, never source-causal proof.

OBSERVED_FACT: retain the actual chain [HealthRepository.readAll()][READALL] -> [readAuthoritativeDatasets()][AUTHORITATIVE] -> [recoverPendingImport()][RECOVERY] -> conditional [restorePendingIfStillCurrent()][RESTORE]. Valid bound pending import evidence can legitimately restore account datasets and prior import state; exact pending-state recheck prevents stale/superseded restoration. Prior-null/unverified outcomes remain distinct from verified success. Canonical opens can separately initialize metadata. A created read-write transaction is not necessarily an applied write.

RECOMMENDATION: preserve original account/hash/snapshot/prior-state guards, targets, delete/insert/import-state transitions, concurrency fences and readback. Compare matched absent/verified/valid-pending/prior-null/malformed/superseded state and cold/warm opens; count reads/scans, metadata/storage fences, readonly/readwrite transactions, recovery/restore outcomes and actual writes separately. Existing [effect tests][EFFECT_TEST] include detection of an extra real readAll even after NO_PENDING and omitted restoration effects. They are regressions for inherited behavior, not a positive causal oracle or universal physical qualification.

OBSERVED_FACT: this docs-only task adds no product source read, canonical open, transaction, recovery trigger, polling, listener, retry dispatch or writer authority. In-memory evaluation of supplied synthetic archive input is not a product repository operation. No extra readAll may be relabeled side-effect-free diagnostics; existing RANGE isCurrent storage checks are not cost-free or permission for extra probes. Maintaining Option C does not disable or broaden existing bounded stale/currentness recovery, D batches, raw callbacks, startup/remote recovery or local-first persistence.

## 9. Frozen authority, validation and independent review handoff

OBSERVED_FACT: the following inherited authority remains unchanged by this document:

```text
F0 = CLOSED_IN_MAIN
F1_P0 = CLOSED_IN_MAIN
F1_P1 = CLOSED_IN_MAIN
PRODUCER_CAPABILITY_CHARACTERIZATION = CLOSED_IN_MAIN
POST_CHARACTERIZATION_DECISION = CLOSED_IN_MAIN
DECISION_POLICY = MAINTAIN_OPTION_C
B1_CAUSAL_CAPABILITY = UNKNOWN
RANGE_CAUSAL_CAPABILITY = UNKNOWN
D_CAUSAL_CAPABILITY = UNSUPPORTED
F1_P2 = NOT_AUTHORIZED
F2 = NOT_STARTED
SLICE_C = BLOCKED_BY_CONTRACT_GAP
POSITIVE_TRANSIENT_ALLOWLIST = EMPTY
CURRENT_EXECUTABLE_FINITE_ADMISSION = NONE
CAUSAL_EPISODE_ISSUANCE = NONE
RETRY_PERMIT_ISSUANCE = NONE
NEW_RETRY_DISPATCH = NONE
B18_FINITE_ELIGIBILITY = NOT_PROVEN
B20_PERMIT_CONSUMPTION = NOT_PROVEN
ALL_FIVE_READER_GATES = false
WRITER_AUTHORITY_CHANGED = NO
WRITER_SEMANTICS_CHANGED = NO
PROVENANCE_CAPABILITY = NONE
LIVE_WRITER_BLOCKERS = 7 OPEN
PUBLIC_ACTIVATION = NOT_AUTHORIZED
LOCAL_DATABASE_VERSION = 7
LOCAL_SCHEMA_VERSION = 1
REVIEW_STATUS = PENDING
```

OBSERVED_FACT: the literal gates checked are HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED ([day][DAY_GATE]); HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED ([range][RANGE_GATE]); HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED ([comparison][COMPARISON_GATE]); HOME_WORKOUT_COMPOSITE_READER_ENABLED ([Home][HOME_GATE]); SEARCH_WORKOUT_COMPOSITE_READER_ENABLED ([Search][SEARCH_GATE]). No env/storage override, public reader behavior, canonical writer/adoption, bind/push/pull/resync/reset, startup recovery, G6, DB stores/indexes/keyPaths, backend or WorkoutSessionV1 change is included. DB/schema constants remain [7/1][DB_VERSION].

RECOMMENDATION: publication validation must check every fixed-SHA reference/path/line and its meaning, exact main and PR closures, current source rather than historical next-action labels, all seven OPEN rows, the five false literals, causal/writer/persistence freeze, one preferred NEXT_TASK with PROPOSED_NOT_AUTHORIZED, explicit STOP and one added Markdown file only. Run git diff --check. No new Markdown dependency or runtime full-suite claim is needed from local docs validation.

RECOMMENDATION: commit only this document on codex/rel05g-option-c-post-decision-handoff; normal push, Draft PR to main. Require exact-head Push AND PR CI, each test/typecheck/build/backend-rel05g1/backend-recovery SUCCESS; put actual head/PR/run evidence in the PR/report, not predictions in this baseline artifact. Independent reviewer must reassess inventory/partial closures, seven blockers, archive reproduction and honest risk calibration, candidate independence/ranking, Slice C non-substitution, fixed references and full authority freeze. A successful CI run is not architecture review, approval of NEXT_TASK or activation acceptance. Preserve REVIEW_STATUS = PENDING until that separate review.

RECOMMENDATION: STOP publication on baseline drift, unexpected non-doc diff or an inconsistency requiring a product/architecture choice; report rather than silently revising frozen decisions. Stop after Draft creation and exact-head CI observation. Do not mark Ready, merge, enable auto-merge, delete remote branches, start independent review yourself or implement the proposed next task.

[F0]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-finite-admission-contract.md#L116
[P0]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-causal-witness-characterization.md#L80
[ERROR]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/localDatabase/errors.ts#L50
[ADAPTER]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/healthWorkoutOwnerAdapters.ts#L186
[B1]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/useHealthSelectedDayComposite.ts#L164
[RANGE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts#L221
[EFFECT_TEST]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/healthWorkoutAttributionEffects.test.ts#L262
[P2]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-producer-capability-decision.md#L149
[POST]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-post-characterization-decision.md#L7
[SESSION_REPO]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/workoutSessionRepository.ts#L43
[BIND]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/localDatabase/repository.ts#L844
[RESET]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/workoutRemoteReset.ts#L58
[AUTHORITY]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/workoutRuntimeAuthority.ts#L60
[PROVENANCE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-id-prospective-provenance-capability-product-architecture-decision.md#L323
[EDITOR]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/workoutSessionEditorAdapter.ts#L32
[APP]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/AppContent.tsx#L293
[HEALTH]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/HealthView.tsx#L401
[D_OWNER]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/legacyPreviousCurrentness.ts#L50
[D_HOOK]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/useLegacyPreviousCurrentness.ts#L22
[OP]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/healthWorkoutOperationScope.ts#L34
[LIFE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/useHealthWorkoutOperationLifetime.ts#L8
[MODEL]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/healthWorkoutParentAvailability.ts#L298
[P2_ACCEPTANCE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-producer-capability-decision.md#L258
[F0_ROUTE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-finite-admission-contract.md#L211
[POST_C]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-post-characterization-decision.md#L165
[SLICES]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-parent-partial-source-availability-integration-design.md#L618
[PUBLIC_ACCEPTANCE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-parent-partial-source-availability-integration-design.md#L700
[WRITER_LIST]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G5B-product-cutover-prep.md#L62
[PROVENANCE_FREEZE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-id-prospective-provenance-capability-product-architecture-decision.md#L395
[BIND_BASE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/localDatabase/repository.ts#L968
[PERSIST]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/healthWorkoutPersistence.ts#L104
[F0_RESTART]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-finite-admission-contract.md#L303
[EXPORT_CONTRACT]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/K-320-recovery-export-package.md#L20
[EXPORT_DATASETS]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/recoveryExportPackage.ts#L110
[ARCHIVE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/recoveryExportPackage.ts#L791
[ARCHIVE_TEST]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/recoveryExportPackage.test.ts#L54
[HISTORICAL_ZIP]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-parent-legacy-prevdata-freshness-implementation.md#L223
[FIXTURE_REPLACE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/localDatabase/protocol/transactionEvidenceProtocol.test.ts#L283
[FIXTURE_TEST]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/localDatabase/protocol/transactionEvidenceProtocol.test.ts#L701
[HISTORICAL_FIXTURE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-parent-legacy-prevdata-freshness-implementation.md#L210
[REOPEN]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/docs/REL-05G-health-owner-post-characterization-decision.md#L187
[READALL]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/healthLocalRepository.ts#L1060
[AUTHORITATIVE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/healthLocalRepository.ts#L612
[RECOVERY]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/healthLocalRepository.ts#L563
[RESTORE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/healthLocalRepository.ts#L700
[DAY_GATE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/healthSelectedDayCompositeConfig.ts#L2
[RANGE_GATE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts#L4
[COMPARISON_GATE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts#L2
[HOME_GATE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/home/homeWorkoutCompositeConfig.ts#L4
[SEARCH_GATE]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/components/views/features/search/searchWorkoutCompositeConfig.ts#L4
[DB_VERSION]: https://github.com/Absinthe-6785/Absinthe/blob/7d76193ddfe9e24df0974f762f09bef97343abba/frontend/src/lib/localDatabase/types.ts#L2
