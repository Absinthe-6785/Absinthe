# REL-05G PATH A: partial Edge normal-browser Track A evidence publication

## Publication decision

Task: `REL_05G_WORKOUT_DEVICE_LIFETIME_PATH_A_EDGE_NORMAL_BROWSER_TRACK_A_PARTIAL_EVIDENCE_PUBLICATION_01`.

`PUBLICATION_STATE = PARTIAL_PHYSICAL_EVIDENCE_PUBLICATION_READY_FOR_REVIEW`
`TRACK_A_STATUS = TRACK_PARTIAL`
`REL_05G_PATH_A_EDGE_NORMAL_BROWSER_QUALIFICATION = PATH_A_QUALIFICATION_PARTIAL`

A1-A14 have recovered attempt/observation material, not fourteen completed protocol passes.
A3 has a bounded visibility/return result; the other mandatory rows remain INCONCLUSIVE
for the particular gaps below. This is a partial Track A evidence publication, **not**
completed lifecycle/device-authority qualification, an independent review, or a merge gate.
No historical trial was recreated or raw artifact edited.

The normative authority is the [human-assisted protocol](REL-05G-workout-device-lifetime-human-assisted-physical-qualification-protocol.md),
especially sections 5-7 and 11-13. Its historical NOT_EXECUTED statements describe that
protocol-publication task, not this recovered evidence package. This package does not
overwrite earlier failed/blocked attempts.

## Repository, run and environment provenance

- Repository: `Absinthe-6785/Absinthe`; canonical workspace: the operator's
  `GitRepos/Absinthe`, not `D:/Projects/Absinthe`.
- Exact fetched main / publication base: `9dab5d44e41dbab3d6b7a457fa2b823137891970`.
- [PR #755](https://github.com/Absinthe-6785/Absinthe/pull/755): MERGED,
  reviewed head `71914619e058472659ed63bbbcdf4ec6eb2d25c5`,
  merge SHA equal to this base, mergedAt `2026-10-06T01:46:02Z`.
- Branch: `codex/rel05g-edge-normal-track-a-partial-evidence-publication-01`.
- Canonical run: `edge-a-20261005-7d3f9c6a`; protocol:
  `rel05g-patha-human-v1`; raw event schema: 1; track: A.
- Operator: human user who supplied/recovered this bundle; synthetic publication label
  `operator-A`, not a verified identity or signed execution attestation.
- Human-reported normal Microsoft Edge window: YES; InPrivate: NO;
  Edge `154.0.4258.53`, official build, 64-bit; Windows 25H2,
  OS build `26200.9457`. These are **human-reported**, not independently verified
  version/about captures. Hardware model, Windows edition, profile-container identity,
  install provenance, background/startup/session settings: UNKNOWN.
- Fixture panels/exports corroborate browser-or-other display mode and build identity;
  they do not attest the running browser/OS version or all physical surfaces.
  Physical execution is human-supplied, not agent-controlled or emulated.
- Machine wallTimeMs spans `2026-10-05T13:21:12.643Z` to
  `2026-10-06T04:18:37.675Z` **when converted as epoch milliseconds**.
  These are device-reported clocks, not independently certified UTC execution times.
  Operator start/end timestamps, timestamp source, capture timezone and global clock
  uncertainty are UNKNOWN. Recovery filename dates are not a trusted ordering clock.
  Each instance's sequence/monotonicMs is used only within that instance.

### Immutable fixture build boundary

| Label / attempt scope | sourceGitSha | buildId | manifestSha256 |
| --- | --- | --- | --- |
| B0: A1 and original failed A2 | `a282bdda00fb7cb786dbcd9f08d30798951aaf25` | `f16ce19c48917366dadac25beebb2c205d532f3989a374e674308d6c66c309ab` | `9471331c2a600d8625a61369e67f7a5ac51b78221766764e97a8f602ca73fedf` |
| B1: corrected A2 retry and A3-A14 | `71914619e058472659ed63bbbcdf4ec6eb2d25c5` | `7d965cca95189b7a4b5a19ec2f635011aa8f7be66a8931dd5dc04e65f0b14af3` | `e52ae618f0c3931da278c5a8ca4e3bc15faa8bad57e8a7ea8d29e5e69bd4943e` |

B0 origin: `https://rel05g-patha-qual-e9fx9nbhx-dhlee6785-9668s-projects.vercel.app`.
B1 origin: `https://rel05g-patha-qual-66k75jv1n-dhlee6785-9668s-projects.vercel.app`.
Role paths are `/<buildId>/old/`, `/<buildId>/current/` and
`/<buildId>/neutral/`; artifact manifest is `/<buildId>/artifact-manifest.json`.
OLD is the isolated noncooperating fixture model, not an historical Absinthe product build.

`A1_BUILD_BOUNDARY = PRE_PR755_B0`: the timer-binding correction does not invalidate
the observed localStorage byte exchange automatically, does not qualify all B0 behavior,
and does **not retroactively supply A1's missing fresh-token repeat**. B0 and B1
origins differ; no storage relationship is inferred across these deployments.

## Evidence inventory and review access

Artifact Storage Option 2: [sanitized hash/provenance manifest](REL-05G-patha-edge-normal-track-a-partial-evidence-manifest.md)
in Git; unchanged raw bytes outside Git.

Operator-approved local reference: `Desktop/evidence/REL05G_TrackA_evidence_recovery_bundle`
under the operator's Windows home. Set `EVIDENCE_ROOT` to that directory.
This is a **local review reference**, not a public download or a promise of remote access.
An independent reviewer must receive separately authorized access to the necessary
non-sensitive raw material; hashes alone never substitute for that access. If unavailable,
dependent review results become EVIDENCE_UNREVIEWABLE / INCONCLUSIVE.

Inventory: **107 evidence files: 45 JSON + 62 PNG; 95 unique SHA-256 values**.
There are 33 unique JSON hashes, 62 unique PNG hashes and 12 identical-hash pairs
(12 additional copies). Two administrative files, MANIFEST.csv and README.txt,
are separately fingerprinted, excluded from 107/95. All 107 CSV hash and byte-size
comparisons PASS. Every failed/retry/off-run/duplicate file remains indexed;
suffixes are not an identity rule.

No operator journal, continuous recording, version/settings capture, redaction recipe,
signed attestation or complete window/process inventory is present in this bundle.
Screenshots are associated by visible fixture/action/instance content where available,
not by filename ordering alone. Several contain unrelated browser chrome and stay private.
The pre-existing `crop_a1.png` is retained with derivative/original lineage UNKNOWN;
no new redaction or upload was performed.

## A1 exact derivation

`A1_VERDICT = INCONCLUSIVE`
`A1_REASON = REQUIRED_FRESH_TOKEN_REPEAT_MISSING`
`A1_BIDIRECTIONAL_STORAGE_SHARING = OBSERVED`

| Instance / evidence | Action / own sequence | Direct observation |
| --- | --- | --- |
| `641f5799-a647-4186-b61a-d618ecbe0582`, E011 | a101, write 4 / own read 6 | `qual-735afa11-4d2c-4902-8afc-07b6058d207b` |
| `5d67a31d-91d3-4780-8324-da59ce2642e1`, E008 | a102, read 4 | Same first peer token |
| E008 | a103, write 8 / own read 10 | `qual-5e730df9-b477-4a03-8378-01c8d29e6f17` |
| E011 | a104, read 8 and 10 | Same reverse peer token |

E047-E050 corroborate displayed instances/actions/token values. They depict two
side-by-side windows rather than proving an exact single-window tab/profile configuration.
Only one fresh write occurs in each A1 instance. E008 read 14 and E011 read 10
are additional **reads**, not another new-token round. No other A1 JSON supplies the
mandatory S repeat. Thus there is no final determinate S scope classification, no A1
PASS and no A1 FAIL based merely on missing controls.

## A1-A14 result matrix

PASS below concerns only the protocol's bounded measurable observation, never authority.
All rows share the unverified environment/version and recovery provenance limits above.

| Row | Final verdict | Retained bounded observation / exact gap | Evidence |
| --- | --- | --- | --- |
| A1 | INCONCLUSIVE | Bidirectional byte sharing OBSERVED; REQUIRED_FRESH_TOKEN_REPEAT_MISSING; exact tab/profile configuration also unproven | E008/E011, E046-E050 |
| A2 | INCONCLUSIVE | API/HELD/request/acquire/release observed; corrected early trials end by safety timer, not prescribed manual-release handshake; no complete reverse pair of valid L controls | E004-E005/E024/E038-E039, E051-E063 |
| A3 | PASS | Bounded tab visibility/return and same-instance bytes observable in fresh two-tab pair; initial two-window attempt has no visibility signal and is retained separately | E001/E025, E068-E069; initial E003/E037/E064-E067 |
| A4 | INCONCLUSIVE | Separate windows and bidirectional one-round storage sharing; S fresh-token repeat missing. Independent L window control supports cooperative scope but cannot complete composite S+L row | E002/E034, E070-E078 |
| A5 | INCONCLUSIVE | Hidden/visible transition and retained bytes observed; single-window viewport crops do not distinguish minimize from hiding/another window; no minimize action recording/journal | E023/E040, E079-E083 |
| A6 | INCONCLUSIVE | Peer token retained; pre/post captures still display two fixture tab labels, not a documented closed-target transition; marker alone does not prove close | E028-E029/E041-E042, E084-E088 |
| A7 | INCONCLUSIVE | Peer reads same token; later one-window crop does not distinguish target-window close from minimize/crop; exact close action missing | E035-E036/E043, E089-E091 |
| A8 | INCONCLUSIVE | Pre-close marker/export and A10 byte retention; no recorded X action, last-visible inventory, disappearance capture or whole-Edge safety attestation | E026-E027/E092; E006-E007/E094 |
| A9 | INCONCLUSIVE | Edge-named process entries OBSERVED, PROCESS_OBSERVATION_ONLY; crop lacks run/time/filter/access linkage to A8 and full identity-container mapping | E093 |
| A10 | INCONCLUSIVE | New document START/navigate reads exact A8 marker; ordinary Edge-launch action and safe A8 closure linkage absent, so full launch procedure not qualified | E006-E007/E094, E026-E027 |
| A11 | INCONCLUSIVE | Canonical back_forward/new-instance read preserves canonical marker; history vs restore-session UI path not captured. Off-run null is not canonical corruption or a pass | E009-E010/E012/E044-E045, E095-E097 |
| A12 | INCONCLUSIVE | Actual BFCache return OBSERVED via pageshow.persisted=true and retained instance/bytes; precise neutral/Back/Forward/returned-panel action sequence incomplete | E016-E018/E098-E099 |
| A13 | INCONCLUSIVE | ERR_INTERNET_DISCONNECTED / LOAD_FAILED directly visible; OFFLINE_OLD_EXECUTION=NOT_OBSERVED for failed new load; safe offline-control setup/reconnect actions absent | E013-E015/E100-E102 |
| A14 | INCONCLUSIVE | Noncooperating OLD resume/raw-write counterexample retained; CURRENT reads fresh OLD tokens inside its own held intervals. Mandatory S reverse/repeat missing; protocol-qualified lock-overlap sub-result remains INCONCLUSIVE | E019-E022/E030-E033, E103-E107 |

Additional downgraded rows: A2, A4-A14. None is silently promoted because a related
sub-result is observable. No new fixture/data-integrity failure is established from
these missing controls. The original A2 fixture failure is retained as a failed/
BLOCKED_BY_FIXTURE_DEFECT attempt, not rewritten into success.

## Row-specific evidence and ceilings

### A2 and A4: independent lock controls

A2 E038 has SAFETY_TIMER_TRIAL_END at sequences 6, 12, 21 before releases 7, 13, 22.
Its later manual actions a203-r2/a212-r2 occur **after** callback completion. E004's
first two trials similarly end by timer at 6/12 before manual actions at 8/14.
The later a209-r2 holder / a210-r2 requester trial has a valid visible HELD/REQUESTED
pair (E062), manual holder release a211-r2 (E004 22-23), and requester HELD (E063);
that one supported direction does not supply the missing reversed manual control.
Early exports and expanded exports are both retained; null storage reads in A2 are
not a failed S control or a different-scope conclusion.
E024 B0 records UI_ACTION_FAILED after request, matching E053; no successful B0
lock qualification is asserted. E051 is a wrong-role OLD setup; it cannot run L.

A4 E073 shows A HELD / B REQUESTED, E074 B HELD after a409 manual release.
E076 reverses B HELD / A REQUESTED and E077 shows A HELD after a413 manual release.
E002/E034 record matching resource, manual callback-completion releases and no
timer-end events. These action-linked side-by-side checks support the independent
L sub-result SAME_OBSERVED_WEB_LOCK_SCOPE. Storage still has only a403 and a405
fresh writes, not S's required new-token repeat; overall A4 is INCONCLUSIVE.
No A2 control is borrowed from A4's different instance pair.

### A3-A10: transition versus state

A3 fresh instance E001 writes at 10, own-reads at 12, hides/returns at 13/14,
then reads unchanged at 21/25 after further visibility transitions; E025 reads
the same bytes. E068-E069 show opposite selected tabs and their displayed
instances/tokens. This supports delivered visibility and same-document retention,
not actual OS suspension. Initial E003/E037 have no visibility events and are
not silently substituted for the later pair. A3 does not perform a complete S trial.

A5 E040 8/9 records hidden/visible and 11/13 retains the seeded token. A6/A7 peer
reads preserve the corresponding seed; none supplies an OS/window-close certificate.
A8 E026 4/6/9 and A10 E006 4/6 share
`qual-68477198-3c11-46cb-b168-710f14c6ffd4`; preservation is observed,
but raw retained bytes do not demonstrate all Edge windows were closed.

A9 E093 is a narrow Task Manager crop showing six Microsoft Edge entries including
browser/GPU/network/storage-related entries. Capture time, filter, access level,
synthetic run binding, complete PID-to-container mapping and recording of A8 are
UNKNOWN. It is PROCESS_OBSERVATION_ONLY, never TRUSTED_PROCESS_ATTESTATION.
No End task, privileged enumeration, launch fencing or complete-retirement inference
is performed by this publication. The crop does not certify zero visible windows
or the absence of other creators.

### A11: canonical versus off-run

E012 a1112 writes `qual-821d9eb7-1bec-4dbc-88ec-b1c66fff4ed4`, confirms it,
marks a1113 and exports. E009/E010 have new instance
`5f32761b-fa2e-4a59-a7af-426664a48f0e`, NAVIGATION back_forward at 2,
and a1115 reads the same token at 4/6 under the canonical run/key. This is a
supported machine history-timing / recreated-document attribute, not sufficient
UI evidence to distinguish SESSION RESTORE from a specific HISTORY RESTORE action.

E044/E095 retain an earlier canonical seed
`qual-cc01890b-0913-473a-8267-b94dad5c7d63`.
E045/E096-E097 belong to distinct run
`r-9d6122db-d090-4f64-a35d-6b15f7473164`, instance
`81ad99ad-eb33-4c42-9eda-bb0ea1e699da`; back_forward at 2 and null reads
at 4/6 use that **different key**. Retain as off-run unsuccessful control /
INCONCLUSIVE, not canonical byte loss and not canonical-run PASS.

### A12: actual persisted return, incomplete UI route

E016/E017 preserve OLD instance `79e90a8b-fe2a-45eb-9502-538176e06bbb`
and `qual-08f8b5da-4d3a-4ceb-9337-6d07dbbc8763`.
Pagehide at 12/18 has persisted=true; **pageshow at 15/21 also has persisted=true**.
Reads 17/23 retain the exact seed. Therefore `BFCACHE_SUBRESULT = OBSERVED`,
not merely inferred eligibility or timing back_forward. The returned event's
navigationType navigate does not erase its actual persisted=true return.

E098 shows OLD pre-state; E099 shows the same deployment's NEUTRAL page with a
different default run and no started run. It is not a second canonical-run log.
No capture/journal records the complete Back/Forward/return UI route. Row A12
is consequently INCONCLUSIVE despite its determinate BFCache sub-result.
Logger action/persistence handlers and UI reads may affect the episode; no
universal BFCache eligibility, other-surface behavior or product restoration claim.

### A13: failed network load is retained

E101 visibly shows the exact B1 OLD path with ERR_INTERNET_DISCONNECTED, alongside
a retained OLD tab. `NETWORK_FAILURE = OBSERVED`;
`OFFLINE_OLD_EXECUTION = NOT_OBSERVED / LOAD_FAILED` for that new-load attempt.
E015 is the online pre-export; E013/E014 keep the same original instance
`6eb0a1c1-f674-4a91-ba37-53fef1c17bdf` and seeded token in later reads.
E102 corroborates retained OLD bytes, not a newly executed offline OLD document.
The chosen offline control, isolation/no-live-work condition, safe reconnection
and linkage of the failed document to a started run are UNKNOWN. No claim of safe
F completion is made. A failed load does not exclude all future stale-code entry.

### A14: retain the counterexample without upgrading its controls

E019/E020 OLD instance `7a66dd0c-6030-4b59-831d-5dd6336dee64` has no
LOCK_REQUEST. It marks a1405, hides at 8, returns at 9 without a new START,
then raw-writes a1408 at 11 and visible-control a1412 at 19. The same OLD remains
able to write despite having no membership response: a bounded COUNTEREXAMPLE
to interpreting silence/visibility as exclusion of that known model.

E030/E031 CURRENT instance `c8d1c963-2902-4292-a7b3-926017ce015e`:
- a1407 acquire at 8, a1409 fresh-token read at 10, a1410 manual release at 12;
- a1411 acquire at 19, a1413 fresh-token read at 21, a1414 manual release at 23.

Read 10 matches OLD 11's `qual-81d17533-0137-4134-b157-2a1d3fbc2eec`;
read 21 matches OLD 19's `qual-08c1e268-b751-472e-8844-5ff381b1555b`.
E105 shows CURRENT HELD; E106/E107 show the new matching token while CURRENT
still displays HELD, alongside OLD. This is a bounded supporting overlap observation
using CURRENT's own acquire/read/release ordering and action-linked panels,
**not** a conclusion derived from sorting different instance clocks.

However CURRENT has zero storage writes: O's prerequisite S reverse/repeated
fresh-token measurement is incomplete. The formal raw-write-during-lock
counterexample sub-verdict remains INCONCLUSIVE; no determinate SAME storage
scope, OLD lock scope or universal lock interception result is asserted.
The preserved known-OLD counterexample is narrower than a fully controlled O PASS.
There is no continuous no-response observation journal/video; no membership
issuer, complete compatible-creator inventory or admission certificate is produced.

## P1-P7 impact (only canonical labels)

S = SUPPORTING_OBSERVATION_ONLY; C = COUNTEREXAMPLE; Q = SCOPE_CLARIFICATION;
N = NO_IMPACT; U = UNKNOWN. These abbreviations expand **only** to those five labels.
Relevant absent/ambiguous components stay UNKNOWN; this table does not close acceptance.

| Row | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | N | N | N | Q | S | N | N |
| A2 | N | N | N | U | S | N | N |
| A3 | S | U | N | U | S | S | N |
| A4 | N | N | N | Q | S | N | N |
| A5 | U | U | N | U | S | S | N |
| A6 | U | U | N | U | S | S | N |
| A7 | U | U | N | U | S | S | N |
| A8 | U | U | N | U | U | S | N |
| A9 | U | U | N | U | U | N | N |
| A10 | U | U | S | U | U | S | N |
| A11 | U | U | S | U | U | S | N |
| A12 | U | U | S | U | S | S | N |
| A13 | U | U | S | U | U | S | N |
| A14 | C | U | S | U | S | N | N |

A1/A4 Q describes bounded pair observations, not completed S. A14 P1 C refers only
to continued known OLD action after hiding/silence, not the unqualified formal
lock-overlap result. P2 remains UNKNOWN because continuous exclusion controls
are not complete. P6 support is synthetic localStorage bytes only, **not**
product deviceId, pending mutation, IndexedDB or outbox preservation. P3 support
is fixture provenance only. P1 support is visibility observation, not absence.
No P1-P7 value is PASS/PROVEN/SATISFIED. Optional IDB probes: NOT_EXECUTED.

## Frozen project states

| Item | Unchanged value |
| --- | --- |
| E3_FEASIBILITY | NOT_ESTABLISHED |
| LIFECYCLE_EVIDENCE_SOURCE | REMAINS_UNAVAILABLE |
| BOOTSTRAP_ADMISSION | BLOCKED_BY_EVIDENCE_QUALIFICATION |
| R2-U | NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF |
| [PR #745](https://github.com/Absinthe-6785/Absinthe/pull/745) | KEEP_DRAFT_BLOCKED; live Draft/Open/unmerged head `2ad2ec573490b5c0a507b23bb06e98cba34c65be`; untouched |
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
| Tracks B/C/D | NOT_EXECUTED |
| DB/schema/stores/indexes/keyPaths/backend/WorkoutSessionV1 | v7/v1/all unchanged |
| Product reader/writer/data plane, fixture, bootstrap/R2-U, G6 | unchanged / not activated or implemented by this task |

No lifecycle evidence issuer or compatible-creators-quiesced claim is introduced.
No live-writer blocker is closed. Feature removal does not transfer authority.

## Validation and next step

Recomputed all 107 SHA-256 values and byte sizes against the external recovery
MANIFEST.csv: PASS, zero mismatches; duplicates counted by exact bytes/hash,
not suffix. Administrative files fingerprinted separately. Summary/manifest
references, evidence IDs, counts, per-row matrix, build/run boundaries and frozen
states checked for consistency. No dedicated Markdown/docs validator is configured
in frontend package scripts or discovered in frontend/scripts/.github; validation
uses direct reference/inventory/format checks instead, not an invented npm command.
`git diff --check` and changed-file allowlist are publication gates.
Runtime tests are not changed or rerun to create physical qualification evidence;
hosted CI is repository regression validation only and is reported outside this
artifact on the exact publication commit to avoid self-referential commits.

Next authorized stage: **independent evidence-integrity/platform-boundary review
of this partial publication exact head**, with approved raw access and the missing
controls explicitly visible. This task does not conduct that review, repeat A1,
execute any further physical test, mark Ready, merge, enable auto-merge or begin
implementation. Remaining controls require a separately scoped future run, not
manufactured historical evidence.
