# Vault snapshot failure-model and commit-contract decision

## Status and decision boundary

- Task: `VAULT_SNAPSHOT_FAILURE_MODEL_AND_COMMIT_CONTRACT_DECISION_01`.
- Repository: `Absinthe-6785/Absinthe`.
- Inspected main: `a714fa3f94e620d52c12e8de43809a72dcbd29ba`.
- Canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`; never `D:\Projects\Absinthe`.
- `VAULT_SNAPSHOT_DECISION = BOUNDED_CORRECTION_READY`.
- Recommended design: Option A, under the explicitly bounded model M1 below.
- Decision/contract review: **PENDING**. This is a proposed architecture contract, not a recorded human approval.
- `IMPLEMENTATION_AUTHORIZATION = NOT_GRANTED`.
- Existing recovery-copy-loss defect: **OPEN / NOT FIXED**.

The bounded decision concerns failure-safe replacement in one synchronous save invocation. It does not certify all browser failure modes, arbitrary structurally compatible adapters, cross-tab serializability, or crash-durable commits. Accepting this document must not be reported as closing the implementation defect. A separate approved implementation and independent review are required.

## 1. Baseline and evidence provenance

Main was checked against the remote; tracked worktree/index were clean and there were no open PRs at inspection. Production store/test blobs were respectively `497f6a724cbfcf05afc2b2a25849675c0c56dd08` and `3888928f87a95a29da3f4b831acbfe87849dc10c`. This task changes only this Markdown file. No snapshot storage, production code, tests, reader gates, or primary Notes data are modified.

### Observed baseline reproduction, not a new browser experiment

The preceding `ABSINTHE_VAULT_SNAPSHOT_REPLACEMENT_FAILURE_ATOMICITY_01` execution used a temporary Vitest probe and isolated Map-backed `SnapshotStorageAdapter`; it was removed after execution. Its results are carried forward as execution evidence, not represented as checked-in regression tests or physical-browser qualification. This documentation task does not rerun storage-writing probes.

Preparation: save an unrelated daily snapshot, save an old same-slot snapshot, read the old snapshot back, check exact serialized equality, and require `valid`, `restoreReady`, and `fingerprintMatch`. The old snapshot had metadata plus two chunks; the changed replacement had three chunks. Inject one throw-before-write at the selected new key.

| Case | Injected failure | Result | Old index bytes | Old payload keys left | New keys left | New readable/valid |
|---|---|---|---|---:|---:|---|
| F01 | New metadata | `saved=false`, `skipped=false`, `reason=quota` | Unchanged | 0/3 | 0 | No |
| F02 | First new chunk | Same | Unchanged | 0/3 | 1 | No |
| F03 | Middle new chunk | Same | Unchanged | 0/3 | 2 | No |
| F04 | Final new chunk | Same | Unchanged | 0/3 | 3 | No |
| F05 | Index publication | Same | Unchanged | 0/3 | 4 | Yes, but unindexed |

In all five cases the old snapshot was no longer readable or valid. Enumeration still returned its stale ID with `noteCount=0`, not a usable recovery copy. Unrelated snapshot bytes remained unchanged. Five old-readable safety oracles failed against the untouched baseline. A separate adapter-boundary counterexample passed: even ideal verified staging could not restore the old index after mutate-then-throw publication followed by permanent refusal of index writes/removal. Old payload remained valid, old ID was absent from enumeration, and new ID was visible despite the exception.

The prior final baseline run passed 30 tests across `vaultSnapshot.test.ts`, `snapshotCompaction.test.ts`, and `vaultRestoreSnapshot.test.ts`. That is baseline compatibility evidence only, not evidence of a fix. No payloads, note bodies, or archives were logged.

### Current mutation order

The authoritative path is [vaultSnapshotStore.ts](../src/lib/vaultSnapshotStore.ts), especially `saveVaultSnapshot`, `writeChunkedPayload`, `pruneIndex`, and `saveSnapshotIndex`.

| Order | Current mutation | Consequence |
|---:|---|---|
| 1 | Remove same-slot old legacy key, metadata, and chunks, outside the new-write `try` | Recovery copy is destroyed before replacement exists |
| 2 | Remove keys for the incoming snapshot ID | An ID collision can overwrite/delete another existing copy |
| 3 | Set new chunk metadata | Metadata may exist without all chunks |
| 4 | Set each new chunk | Partial preparation is possible |
| 5 | Delete count/byte-retention victims | More indexed payloads can disappear before publication |
| 6 | Set index JSON | First publication of the replacement; no new-payload readback verification |

These operations concern an auxiliary local Vault recovery copy. They are not deletion of the primary Notes database. The distinction does not reduce the severity of losing the prior recovery copy.

## 2. Browser, adapter, and adversary evidence

Evidence labels: **NORMATIVE** = specification algorithm; **HISTORICAL** = superseded specification; **SOURCE_OBSERVED** = inspected implementation, not an executed browser test; **OBSERVED** = prior synthetic execution; **PROPOSED** = this decision's contract or inference.

- **NORMATIVE, S1:** WHATWG's current `setItem` algorithm checks inability to store and throws before assigning the map entry. Its `removeItem` algorithm removes a present entry and specifies no mutate-then-throw failure branch. The `localStorage` getter can reject access. Cross-agent-cluster locking is not supplied. This supports per-operation logical failure reasoning, not a multi-key transaction. [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface).
- **HISTORICAL, S2:** The superseded W3C Web Storage Second Edition explicitly required failed `setItem`/`removeItem` calls to leave storage unchanged. It also distinguished script-visible consistency from physical disk completion. This is historical corroboration, not a replacement for the Living Standard. [W3C 2021 superseded publication, section 4.1](https://www.w3.org/TR/2021/SPSD-webstorage-20210128/#the-storage-interface).
- **SOURCE_OBSERVED, S3:** Chromium's `StorageArea::setItem`, `removeItem`, and `getItem` check access before delegation; failed cached `SetItem` becomes a quota exception. [Chromium storage_area.cc, inspected main](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/storage/storage_area.cc). The moving source is corroboration, not a claim about an installed browser build.
- **SOURCE_OBSERVED, S4:** At pinned Chromium revision `fc2f25945c9bae30b9bae672ae4b7c648bacf322`, cached writes check quota, update the map, and dispatch backend work; `KeyChangeFailed` and connection reset handle later discrepancies. A synchronous return/readback is therefore not proof of durable backend acknowledgement. [CachedStorageArea source](https://chromium.googlesource.com/chromium/src/+/fc2f25945c9bae30b9bae672ae4b7c648bacf322/third_party/blink/renderer/modules/storage/cached_storage_area.cc).
- **SOURCE_OBSERVED, R1:** `SnapshotStorageAdapter` is a structural TypeScript interface. It has no documented failure semantics, CAS, transaction, durability acknowledgement, or capability attestation. An arbitrary implementation does not inherit S1/S2. Default storage resolves to native `localStorage`; supplied adapters are also used by tests/audits and other helpers.
- **OBSERVED:** The prior mutate-then-throw/permanent-refusal counterexample is valid against that unconstrained interface. It is not an observation that native browsers normally behave that way.

Answer to the atomic-failure question: individual specified storage operations have failure-safe logical semantics as above; the historical text names this explicitly. There is no supported inference that an arbitrary JS wrapper, asynchronous backend, multiple keys, disk flush, or concurrent read/modify/write sequence has the same guarantee. In this document, **per-call failure atomicity** means only that a synchronous failed method call makes no logical change to its target key.

## 3. Proposed supported model M1

M1 is a semantic precondition for the future correction, not something proven by the TypeScript shape or a one-time test write.

1. Use native, unmodified Web Storage methods or a deliberately browser-faithful adapter. Successful writes replace one whole string; synchronous write/removal failure leaves that key unchanged. Methods have no unrelated-key side effects, silent partial success, or application reentry.
2. Storage reads may reject access. A successful read accurately reflects the current logical map. All required preparation/readback reads happen before index publication; any such failure aborts without touching old committed keys.
3. The save is synchronous and non-reentrant, with ordinary built snapshot data, no yield/`await`, adapter callback dispatch, or competing writer/cleaner touching the namespace during the invocation. Other same-agent calls run sequentially. Another tab/frame/process is not assumed locked out by the platform.
4. Previously committed bytes remain stable except for this invocation. Browser eviction, user clearing, extension tampering, backend rollback, process/power-loss durability, and concurrent external deletion are separate failure domains.
5. Existing index and replacement source pass the internal trust checks below. All keys this attempt writes are proven non-conflicting. This is checked, not inferred from UUID probability.
6. No assumption that later writes or removals recover: permanent throw-before-mutation refusal is supported. Safety must not depend on successful rollback. Availability of future reads and capacity is conditional, not guaranteed.

This explicit model is the proposed replacement for the earlier blanket requirement, subject to independent contract review and separate implementation approval. FM02/FM04 and FM12 remain visible, unsupported stronger cases, not renamed quota failures or silently marked passing.

## 4. Failure-model matrix

`IN` means supported under M1; `OUT` means no end-to-end preservation claim under that model. Recoverability never assumes an unlimited retry loop.

| ID | Scenario / applicability | Evidence | Recoverability and required guarantee | Implementation consequence |
|---|---|---|---|---|
| FM01 | `setItem` throws without mutation: IN | S1/S2; prior F01-F05 | Old bytes/index survive before commit even if writes never resume | Abort preparation/publication; exact owned staging cleanup only |
| FM02 | Set mutates then throws: OUT, stronger synthetic adversary | R1 and prior counterexample; not S1's specified quota path | A readable exact old/new index can bound knowledge; unavailable/divergent reads or denied rollback cannot promise restoration | Do not label as clean failure or browser-faithful PASS; Option C/D decision required for support |
| FM03 | Remove throws without mutation: IN as access/fault-adapter refusal | S2/S3; PROPOSED cleanup oracle | Old committed keys are never cleanup targets precommit; postcommit residue is possible | Catch within cleanup phase; do not undo a confirmed commit |
| FM04 | Remove removes then throws: OUT as a method contract | R1, PROPOSED adversary | An exact nonreferenced cleanup target can harmlessly already be gone; no general adapter guarantee follows | Include adversary test, classify unsupported; never delete an old/retained target to probe behavior |
| FM05 | Later writes available: IN, not required | PROPOSED recovery condition | A new invocation may retry after fresh trusted reads | No destructive space reclamation or stale-index retry |
| FM06 | Later writes permanently fail: IN if failure precedes mutation | M1 + PROPOSED oracle | Old index/payload survive an uncommitted save; preparation residue may persist; success/liveness not promised | No rollback dependency; no infinite retry or old-copy deletion |
| FM07 | `getItem` throws: IN as rejection, not proof of emptiness | S3/R1 | Before commit: fail closed and preserve bytes; after confirmed commit: cleanup may be skipped. Immediate readability is unavailable while access is denied | Private strict reads; no mandatory postcommit verification that reclassifies confirmed publication |
| FM08 | Quota exhausted before staging: IN | S1/S3 | Old remains; no new publication | Return known quota failure, never free the old copy first |
| FM09 | Quota after some staging: IN | M1, prior partial-key counts | Old/index remain; only attempt-owned keys may be cleaned | Partial new payload must remain unindexed |
| FM10 | Interruption between keys: conditional boundary | S4; PROPOSED cut-point oracle | Logical-map cut points preserve old view before commit or new complete view after commit; orphan residue possible. Process/power crash with lost accepted writes is OUT | No return after termination; no disk-durability claim or automatic startup repair promise |
| FM11 | Same-tab callers: sequential IN; reentrant/interleaved OUT | Synchronous store/auto source; M1 | Sequential invocations reread index. Callback/getter reentry or future async interleaving invalidates proof | Keep save synchronous; STOP if coordination becomes necessary |
| FM12 | Concurrent tabs/agents/cleaners: OUT | S1; `persistenceCleanup.ts` alternate index writer | Stale index overwrite, collision race, or deleting another writer's data can occur | No CAS/lock promise, no cross-tab fix in this slice; stronger requirement reopens architecture |
| FM13 | Malformed/unsupported index: IN as rejected input | R1 public reader fallback | Preserve raw bytes; no stage, index overwrite, prune, or repair | Save-private trusted-index gate; public Recovery Center API unchanged |
| FM14 | Preexisting incomplete payload: IN as rejected replacement base; repair OUT | R1; `vaultSnapshotValidate.ts` | Cannot preserve a validity property already absent; preserve remaining bytes and index for investigation | Fail closed for incomplete/corrupt same-slot base; do not claim a recovery copy was repaired |

## 5. Publication state machine and truthful results

Proposed sequence: trusted index -> non-conflicting stage -> exact readback/integrity verification -> pure retention plan -> index publication -> bounded cleanup.

```text
PRE_COMMIT -- preparation/read/validation failure --> unchanged committed view
PRE_COMMIT -- M1 index set throws -----------------> unchanged committed view
PRE_COMMIT -- M1 index set returns normally -------> COMMIT_CONFIRMED
COMMIT_CONFIRMED ---------------------------------> POST_COMMIT_CLEANUP
unknown/non-M1 publication semantics -------------> COMMIT_OUTCOME_UNKNOWN
```

The visibility commit point in M1 is successful synchronous return from setting the complete candidate index, after the trusted-index, ownership, and new-payload proofs. Unchanged historical references are not newly certified as valid. It is a **logical publication** point, not a disk flush. Do not require a fallible postcommit read to turn this known result back into failure. A cleanup read rejection affects cleanup only.

| State | Meaning and allowed result using today's interface |
|---|---|
| PRE_COMMIT unchanged skip | `saved=false`, `skipped=true`, `reason='unchanged'`; no writes, pruning, or deletion; base must be trusted/usable |
| PRE_COMMIT aborted | `saved=false`, `skipped=false`; `reason='quota'` only for a known quota failure, otherwise omit the optional reason; omit committed `snapshotId`/counts |
| COMMIT_CONFIRMED | `saved=true`, `skipped=false`, correct `snapshotId`, `chunkCount`, `writeCount`; counts retain existing payload-plan meaning, not cleanup or index-write counts |
| POST_COMMIT_CLEANUP interrupted/rejected | Same committed success. `saved` means verified payload publication, not complete physical garbage collection. No rollback, no quota-failure result after committed success |
| COMMIT_OUTCOME_UNKNOWN | No existing tuple truthfully expresses an unknown commit. Neither `saved=false` nor `saved=true` is a safe generic answer. Not a supported M1 return path; do not introduce an outward state or exception behavior here |

For Option C analysis only: one bounded index read after an ambiguous call could show exact candidate bytes (candidate visible) or exact prior bytes (prior view visible) in a stable logical map. Another value or read failure remains unknown; even matching readback is not disk durability or proof that a competing writer did nothing. Do not blindly roll back an index, and never delete either possible committed payload in the unknown state. Requiring this scenario in production needs a separately approved public contract and consumer handling before implementation.

### Complete current result-consumer inventory

Repository search covered `saveVaultSnapshot`, `SaveSnapshotResult`, all four create helpers, and `saveSnapshotIndex` outside tests/docs. No production consumer inspects snapshot-result `reason`, ID, or counts; tests inspect some of them.

| Consumer | Current use | Consequence of M1 / impact of adding unknown result |
|---|---|---|
| [vaultSnapshotAuto.ts](../src/lib/vaultSnapshotAuto.ts): four create helpers | Return the store result | Keep result shape; no new type required for M1 |
| Same file: `flushDebouncedSnapshot` | `saved || skipped` advances last flushed fingerprint; pending inputs are cleared afterwards, including current failures | Confirmed publication including cleanup residue must be success. Unknown must not be folded into success/skip; no automatic retry or scheduling change is authorized |
| Same file: `runPeriodicSnapshotSlots` | Ignores daily/weekly/monthly return values | New unknown state would otherwise be ignored; requires explicit design if Option C is selected |
| [vaultRestorePipeline.ts](../src/lib/vaultRestorePipeline.ts): `executeVaultRestorePipeline` | Calls `createLastSnapshot`, ignores result, sets `backedUp=true` | Existing separate reporting limitation, not a new save guarantee. This slice does not certify destructive-restore safety or alter the distinct verified undo snapshot |
| [k96dPersistenceAudit.ts](../src/components/views/k96dPersistenceAudit.ts) | Audit creates snapshot and then measures storage | No new result handling; do not infer physical cleanup from success |
| [useRecoveryCenter.ts](../src/hooks/useRecoveryCenter.ts) and [RecoveryCenterPanel.tsx](../src/components/views/features/settings/RecoveryCenterPanel.tsx) | Enumerate index, display counts/dates, load/validate selection; do not consume save result | Unknown state would not be represented. Do not redesign these readers/UI |
| [vaultStorageMetrics.ts](../src/lib/vaultStorageMetrics.ts) | Snapshot bytes/counts come from indexed entries; separate vault key measurement; warnings may inspect latest payload | Indexed payload budget is not total orphan-key usage. Empty/invalid ambiguity stays separate |
| [persistenceCleanup.ts](../src/lib/persistenceCleanup.ts): `cleanupPersistenceOrphans` | Independent index writer via exported `saveSnapshotIndex`, plus namespace-wide cleanup | Must not interleave with this save; do not reuse its scan as staging cleanup or claim it safely repairs every crash/index failure |

The optional `reason` already permits nonquota failure without adding a public field. Its omission must not become evidence of quota exhaustion. This decision does not add a new enum, change caller behavior, introduce throw-based unknown outcomes, or treat the pipeline's `backedUp` flag as proof of a valid snapshot.

## 6. Option comparison

| Option | Assumptions / failure and index consistency | Capacity / interruption / retention | Compatibility, scope, migration, safety gaps |
|---|---|---|---|
| A: stage, verify, commit, postcommit cleanup | M1; old index unchanged on precommit rejection; verified new view on confirmed commit | Old+new staging headroom required; stopped cleanup can leave nonindexed keys. Candidate index retains existing logical policy | Recommended; store + focused tests, optional tightly coupled internal helper only; same keys/schema/result. No migration. Does not solve non-M1 unknown commits or concurrent writers |
| B: stage, verify, commit, deferred cleanup | Same publication assumptions as A; never defer verification | Greater/longer duplicate storage; restart loses an in-memory cleanup plan. Persistent queue/scanner needs separate design | Logical retention compatible, physical reclamation timing changes. Not recommended to invoke/add root scans; durable queue adds persistence scope |
| C: explicit unknown state, bounded readback | Can represent FM02/read ambiguity honestly but cannot force restoration under FM06 | Preserve both candidates until resolved; pressure and orphan retention increase; crash resolution needs durable evidence | Existing result/callers/UI lack unknown handling. Public contract changes and reviewed recovery policy needed; not authorized by this decision |
| D: transactional capability/storage migration | One transaction could group index/payload operations if the selected storage supports it | Durability still depends on actual transaction guarantees; capacity/migration/interruption need protocol | Larger adapter/data migration, legacy reads and consumers must be designed; no DB/schema migration authorized. Not a bounded localStorage correction |

Option A is ready to be proposed for a separately scoped correction because it avoids rollback-dependent success/failure semantics for M1. If FM02, cross-tab preservation, guaranteed physical cleanup, or durable crash recovery are mandatory, this recommendation no longer applies: require a product/storage-contract decision rather than widening the implementation silently.

## 7. Trusted index, staging ownership, and verification preconditions

### Private trusted-index gate

`loadSnapshotIndex` currently turns read exceptions, malformed JSON, unsupported schema, and several wrong shapes into an empty index, but does not validate entries. It cannot be the save path's proof of emptiness.

The future save must directly retain the raw index bytes and distinguish a successful `null` read (absent) from an empty string, unreadable value, malformed JSON, and unsupported schema. Validate object/array shape, schema 1, nonempty IDs/slot keys/fingerprints, supported slot values, usable timestamps, finite nonnegative payload byte counts, positive integer optional chunk/write counts, and unique snapshot IDs/slot keys. Preserve the prior raw bytes on rejection; do not normalize a bad index into empty or repair it while saving. Any unknown fields must not become deletion authority.

Verify an existing same-slot replacement base is readable, has matching identity/index metadata, and passes the existing validation contract. If it is incomplete, leave it unchanged and fail closed rather than silently skipping on an untrusted fingerprint. Unrelated preexisting corruption is not repaired or claimed valid: the correction must not create a dangling retained reference. A broader requirement to certify every historical entry needs separate scope. This internal gate is feasible without changing public `loadSnapshotIndex`, Recovery Center, or the next read-model characterization.

### Non-conflicting identity and exact ownership

[vaultSnapshotBuild.ts](../src/lib/vaultSnapshotBuild.ts) uses `crypto.randomUUID()` when available, otherwise timestamp plus random suffix. `VaultSnapshot.snapshotId` is also a mutable supplied string. Neither provides permission to overwrite existing keys.

Required future rule: reject an indexed incoming ID collision, even in another slot; reject occupied legacy/meta keys and any occupied planned chunk key before staging. Same-slot changed content uses a different, non-conflicting incoming ID or fails closed. Unchanged content with a valid base can skip before staging without needing a new ID. No in-place same-ID replacement, silent ID rewrite, new namespace, or global identity model.

Keep an exact attempt-owned key list, including the target of a failing write after absence was checked. Cleanup may remove only proven fresh keys for that attempt; no prefixes, `length`/`key` enumeration, unrelated chunks, or old keys. A stray chunk outside the planned range is not owned and must not be removed; absence checks do not claim a root-wide orphan census. All ownership assertions are conditional on no concurrent external writer (FM12).

### New-payload proof before publication

Validate the input envelope, then freeze serialized bytes and expected ID/slot/slotKey/fingerprint. Read back the exact expected metadata and each chunk, compare chunk count/order and individual/assembled string equality, verify total UTF-8 bytes, parse the envelope, match identity, and run [validateVaultSnapshot](../src/lib/vaultSnapshotValidate.ts) for integrity/restore readiness. Check legacy-key absence so legacy read precedence cannot shadow the new chunks. Missing/truncated/reordered/changed chunks or read exceptions abort before commit. No new read of live Notes, Health, or source-of-truth stores is needed. Fingerprints keep their current semantics, not a new cryptographic guarantee.

## 8. Retention, cleanup, quota, and retry boundary

[vaultSnapshotConstants.ts](../src/lib/vaultSnapshotConstants.ts) is authoritative: last 1, daily 30, weekly 12, monthly 12, and 4,000,000 indexed payload bytes as a soft cap. Old K-88A prose has historical smaller counts; do not adopt them. Existing byte pruning drops oldest non-last entries and can leave a last snapshot above the soft cap. Preserve that exception and existing ordering/tie behavior; do not redefine policy or equate UTF-8 estimates with browser quota accounting.

Compute the entire candidate index and victim list **without storage deletion**. Preserve prior payloads until publication returns successfully. Keep retained historical references unchanged and never delete their payloads; the only newly introduced reference must be to the verified replacement. This does not repair a preexisting dangling unrelated reference. The replacement must actually remain in the computed retained set, otherwise return uncommitted failure with no index rewrite. An oversized droppable new entry must not produce `saved=true` for an ID that retention immediately discarded.

After commit, remove only the captured superseded/pruned IDs absent from the committed candidate index, using validated exact key plans. Never delete retained/new keys. Capture old chunk ownership before removing metadata; malformed/unreadable metadata is not authority for an unbounded removal loop. Postcommit rejection cannot invalidate the published new copy or be converted into `saved=false`. Stop unsafe cleanup and leave residue if ownership cannot be proven.

Precommit staging cleanup and postcommit victim cleanup are **BEST_EFFORT**. A failed removal or tab interruption can leave duplicates/partial orphans. The bound is the finite known key set of one attempt, **not a global bound across repeated failures**. Do not promise eventual reclamation, automatic retry, a durable cleanup ledger, or root-wide orphan scans. Existing startup `cleanupPersistenceOrphans` remains a separate implementation with its own reader/error behavior; it is not used to prove this contract.

Logical retention applies to the committed index; successful cleanup makes physical key retention agree afterwards. Physical usage may exceed the indexed soft cap while old/new copies coexist or after cleanup failure. If space cannot accommodate staging or the candidate index, preserve the old copy and fail. Never delete it to make room. Retry is a fresh invocation with fresh trusted reads and fresh/non-conflicting owned keys; failed cleanup can require a new ID and can prevent progress until capacity/access recovers. No automatic destructive retry is implied.

## 9. Preservation guarantees for the proposed implementation

These are acceptance obligations, not currently implemented properties. `HARD_GUARANTEE` is always scoped to M1 and the stated phase; it is not a claim about arbitrary adapters or disk durability.

| Property | Classification | Exact scope / boundary |
|---|---|---|
| Prior payload bytes on uncommitted failure | HARD_GUARANTEE | No old-key writes/removals before commit; valid initial copy required |
| Prior raw index on precommit/index-write rejection | HARD_GUARANTEE | M1 failed index call leaves its key unchanged; no rollback required |
| Prior discoverability/readability after failure | CONDITIONAL_GUARANTEE | Its valid index/payload bytes remain; reads must be available and no outside mutation/eviction |
| New completeness at publication | HARD_GUARANTEE | Exact storage readback + existing validator before candidate index publication |
| New discoverability after commit | CONDITIONAL_GUARANTEE | Candidate index published under M1; access and subsequent storage stability required |
| Unrelated retained snapshot bytes | HARD_GUARANTEE | Save/cleanup never target them; declared retention victims after success are intentional, not unrelated loss |
| Logical retention policy | HARD_GUARANTEE | Candidate index follows existing count/order/soft-budget rules; no new orphan accounting claim |
| Physical cleanup completion | BEST_EFFORT | Known-key cleanup only; interruptions/refusals may leave residue |
| Retry eventually succeeds | CONDITIONAL_GUARANTEE | Valid base, fresh identity, capacity, access, and successful required operations must become available |
| Cross-tab serializability / unknown-adapter restoration / physical crash durability | NOT_GUARANTEED | Reopen for separate storage/coordination/public-result design |

## 10. Future acceptance oracle (not executed by this task)

Use synthetic content only. Tests record key identities/counts and equality/integrity booleans, not payloads or bodies. Label every adapter `ACTUAL_BROWSER_CONTRACT` (a deliberately faithful semantic simulation, not browser execution) or `STRONGER_SYNTHETIC_ADVERSARY`. Any real browser tests must separately identify engine/version/profile and isolated origin; none were run here. A stronger unsupported failure is reported as unsupported, not hidden or counted as a supported PASS.

| Oracle | Required assertion |
|---|---|
| T01: preexisting old + unrelated copies | Verify initial readback/integrity; capture raw index and exact old/unrelated bytes |
| T02: metadata / every chunk write rejects | Inject at metadata and each chunk, including first/middle/final; old/index unchanged, readable/discoverable when reads resume, no new indexed ID |
| T03: index rejects before mutation, then all writes refuse | Same preservation; no dependence on restoring index; staging residue cannot invalidate old |
| T04: preparation `getItem` rejects / corrupted readback | Abort before publication; no old deletion, no false success, incomplete payload never accepted |
| T05: trusted-index failures | Null absent is distinct from empty string, malformed JSON, unsupported schema, bad/null/duplicate entries, or read failure; no writes on rejection |
| T06: ID collisions | Same-ID changed content, unrelated indexed ID, occupied legacy/meta/each planned chunk all fail closed; unchanged valid fingerprint skip performs zero mutations |
| T07: successful replacement | Exact payload equality and validation; new ID retained/indexed; old/victim removal occurs only after successful publication |
| T08: precommit cleanup removal rejects | Old/index/unrelated bytes remain; any residue belongs only to this attempt; retry does not delete it indiscriminately |
| T09: superseded/prune cleanup rejects; reads fail after commit | `saved=true` remains truthful publication result, new/retained payloads remain usable when reads resume; no rollback or index references to deleted retained data |
| T10: quota before and after partial staging / index growth | Old copy never used for destructive space reclamation; failure is truthful; capacity-dependent retry tested |
| T11: legacy and chunked previous copies | Both replacement bases are preserved on each supported fault; successful reads remain compatible; schema/IDs/fingerprints unchanged |
| T12: retention and automation | Last/daily/weekly/monthly rotations and byte soft cap including oversized last; new candidate pruned out is not reported saved; exact unchanged skip; scheduler behavior unchanged |
| T13: retry | After transient refusal, fresh save succeeds without unrelated loss; same-ID residue collision fails safely; no assumed progress under permanent refusal |
| T14: logical interruption cut points | Stop between completed metadata/chunk/index/cleanup calls while retaining the logical map; old view precommit, complete new view postcommit; known orphan residue allowed; no returned result after termination |
| T15: concurrency boundary | Multiple same-agent scheduled calls remain sequential/fresh-index; model reentry and cross-tab race explicitly as unsupported without claiming a lock. If such races become acceptance requirements, STOP |
| T16: stronger adversaries | Mutate-then-throw, truncated write returning success, wrong-key side effects, ambiguous publication + denied read/rollback, remove-then-throw: retain explicit expected contract-violation/counterexample outcomes; no assertion that generic `saved=false` restored old view |
| T17: sensitivity | Untouched delete-before-write baseline fails T02/T03. Intentional early deletion, incomplete readback acceptance, unreadable published payload, unrelated deletion, false success, and old-key staging cleanup must each fail the relevant oracle in isolation; leave no faults behind |
| T18: regressions | Snapshot store/automation/verification/retention/legacy, relevant recovery, complete frontend suite, typecheck, build, diff check, exact-head CI in the separately authorized implementation task |

## 11. Implementation boundary, STOP and reopening conditions

If this contract is independently accepted and a separate implementation task is approved, the bounded target is `vaultSnapshotStore.ts` and `vaultSnapshot.test.ts`, with a tightly coupled helper only if necessary. Keep snapshot/index schema 1, current key namespace and read formats, content fingerprint semantics, DB v7, backend, and caller authority unchanged. Do not implement anything in this publication task.

STOP/reopen if any of the following becomes necessary or is discovered:

- The selected runtime adapter can synchronously mutate and throw, lie on successful reads/writes, or reenter; interface shape is not sufficient certification.
- Supporting `COMMIT_OUTCOME_UNKNOWN` requires a new public result, new exceptions relied on by consumers, durable reconciliation, or automatic retry.
- A single-call proof is presented as cross-tab, browser-backend-acknowledged, disk-crash, user-clear, or eviction-safe preservation.
- Hard physical retention or guaranteed eventual cleanup is required despite permanent refusal/interruption; only in-memory known-key plans are available.
- Trusted save preparation requires changing public `loadSnapshotIndex`, Recovery Center UX, independent startup cleanup, or primary-data persistence.
- New keys/stores/indexes/schema/migration/transaction capability, root-wide orphan scans, Health authority, or rollout changes are proposed.
- Readback cannot establish the full new payload/identity/integrity, candidate index drops the new ID, or cleanup ownership cannot exclude retained/old-before-commit keys.
- Main differs from the qualified baseline before implementation, or evidence of browser behavior conflicts with S1/M1; requalify rather than widening assumptions.

`BOUNDED_CORRECTION_READY` means the narrow, source-supported contract can be reviewed and used to frame a future correction. It does not approve exclusion of stronger cases on behalf of a human product owner, authorize implementation, close the defect, or imply review/Ready/merge completion. Requiring stronger guarantees changes the decision to a separate product/storage-contract task, not a partial implementation reported as atomic.

## 12. Authority freeze and publication validation

```text
RECOVERY_ZIP_TIMESTAMP_DETERMINISM = CLOSED_IN_MAIN
K333B_PORTABILITY = CLOSED_IN_MAIN
DECISION_POLICY = MAINTAIN_OPTION_C
F1_P2 = NOT_AUTHORIZED
F2 = NOT_STARTED
SLICE_C = BLOCKED_BY_CONTRACT_GAP
ALL_FIVE_READER_GATES = false
WRITER_AUTHORITY_CHANGED = NO
WRITER_SEMANTICS_CHANGED = NO
LIVE_WRITER_BLOCKERS = 7 OPEN
PUBLIC_ACTIVATION = NOT_AUTHORIZED
IMPLEMENTATION_AUTHORIZATION = NOT_GRANTED
VAULT_RECOVERY_COPY_LOSS_DEFECT = OPEN
```

No G6, production/test edits, storage mutation, DB/schema/backend change, or public activation. Publication validation is a one-file Markdown diff, source/reference review, and `git diff --check`. No runtime test result is claimed for this docs-only change. Draft publication is not independent review; review remains pending, with no Ready, merge, or auto-merge authorization.

### Repository source references

All relative source references were inspected at the baseline SHA above. In addition to the links beside each claim: [existing snapshot tests](../src/lib/vaultSnapshot.test.ts), [chunk planner](../src/lib/snapshotCompaction.ts), [snapshot scope](../src/lib/vaultSnapshotScope.ts), [primary Notes caller](../src/store/useNotesStore.ts), [distinct verified undo snapshot](../src/lib/vaultRestoreSnapshot.ts), and [startup cleanup caller](../src/lib/notePersistence.ts). These are evidence references, not additional edit targets.
