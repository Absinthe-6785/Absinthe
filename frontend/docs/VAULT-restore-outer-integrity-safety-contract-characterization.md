# Vault restore outer-integrity safety contract characterization

## 1. Status, scope, and exact baseline

- Task: `VAULT_RESTORE_OUTER_INTEGRITY_SAFETY_CONTRACT_CHARACTERIZATION_01`.
- Repository: `Absinthe-6785/Absinthe`; canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`.
- Qualified main: `6468c5145098a03200c2a41a64cc17cf4b965b54`.
- Branch: `codex/vault-restore-outer-integrity-safety-contract`.
- `VAULT_RESTORE_OUTER_INTEGRITY_CHARACTERIZATION = COMPLETE_REVIEW_PENDING`.
- `CONTRACT_RECOMMENDATION = CONTRACT_RECOMMENDATION_READY`: the authority boundary and layered contract direction are supported for independent review. This is **not** an implementation-ready API, product approval, a working integrity capability, or proof of safe restore execution.
- `REVIEW_STATUS = PENDING`; `RESTORE_SAFETY_IMPLEMENTATION_AUTHORIZATION = NOT_GRANTED`.

At kickoff, remote main, `origin/main`, and local HEAD matched the qualified SHA; tracked worktree/index were clean. The open-PR listing was empty and the proposed branch did not exist locally/remotely. A normal fetch and new topic branch creation followed. [PR #787](https://github.com/Absinthe-6785/Absinthe/pull/787) was merged at `0fe0625d81e24b735deaaf6ca9b235366f606b32`, `CLOSED_IN_MAIN_UNDER_M1`; [PR #788](https://github.com/Absinthe-6785/Absinthe/pull/788) was merged at the qualified main, `CLOSED_IN_MAIN`. [Actual main push CI 39128558451](https://github.com/Absinthe-6785/Absinthe/actions/runs/39128558451) was SUCCESS on that exact merge SHA: `test`, `typecheck`, `build`, `backend-rel05g1`, `backend-recovery`, all 5/5. Topic CI is not substituted for this baseline evidence.

Both authoritative documents were read completely: [pre262 characterization](VAULT-pre262-fingerprint-compatibility-characterization.md) and [snapshot failure-model / commit-contract decision](VAULT-snapshot-failure-model-commit-contract-decision.md). Their in-artifact pending-review/baseline wording records their publication history; the merged lifecycle facts above are separately verified. Neither document is evidence of an executed real restore.

This task adds only this Markdown. No production/test/config changes, validator relaxation, legacy recognition, source rewrite, actual restore/import, real Notes/storage/archive/account/origin access, migration, DB/schema/backend change, G6, activation, Ready, merge, or auto-merge. Synthetic storage reads are isolated from any browser profile. Publication and existing hosted CI are distinct from runtime implementation authorization.

## 2. Evidence vocabulary and central finding

| Label | Meaning |
|---|---|
| `OBSERVED_PURE_PREDICATE` | Actual policy/sync-mode functions evaluated against synthetic inputs and isolated storage; not import authorization completion |
| `SYNTHETIC_REPRODUCTION` | Pinned actual-source build/parse/load/validation/conversion/preview functions executed in memory; no restore/import execution |
| `SOURCE_DERIVED_PATH` | Inspected call graph and conditional consequences; not an executed UI, account transition, persistence, or data-loss incident |
| `NOT_PROVEN` | No sufficient execution or provenance evidence for the stronger claim |

`SYNTHETIC_REPRODUCTION`: deliberately altered H06 fails both historical/current outer snapshot validators, but current conversion yields valid core/export previews. `OBSERVED_PURE_PREDICATE`: its manifest-derived validation can satisfy the exact local/core-only recovery exception while normal `mayRestore()` is false. `SOURCE_DERIVED_PATH`: the snapshot-origin outer report is not an enforced input to the current confirmation, pipeline, or private Notes import authority. Remaining policy/account/epoch/verified-undo/persistence gates are **not** proven bypassed. A successful live import and actual data loss are `NOT_PROVEN` / not observed.

The required future invariant is conjunctive, not a replacement policy:

```text
snapshot-origin import authority requires
  approved original-source integrity + identity/profile evidence
  AND current source/selection/transform/options binding
  AND existing policy eligibility
  AND existing account/epoch authority
  AND independently verified prior-state Undo
  AND existing payload/persistence capability checks.

Preview validity, a policy boolean, and Undo success cannot mint
the missing original-source integrity authority.
```

## 3. Complete source call graph and propagation

Line anchors below are one-based at the qualified baseline. Linked source files are evidence, not edit targets.

| Stage / owner | Actual inputs and behavior | Propagation / authority boundary |
|---|---|---|
| Indexed listing: [vaultSnapshotStore.ts](../src/lib/vaultSnapshotStore.ts):118,150; [useRecoveryCenter.ts](../src/hooks/useRecoveryCenter.ts):38 | Tolerant `loadSnapshotIndex`; enumerate entry IDs, load payload to count notes/folders, display entry time/size | Enumeration is not validity. Malformed index becomes empty; entries are not strictly validated here. Timestamp-based protection status is not integrity certification. |
| UI selection: [RecoveryCenterPanel.tsx](../src/components/views/features/settings/RecoveryCenterPanel.tsx):193 | Indexed card calls `openSnapshotRestore(snap.snapshotId)` | No validation-report-based disable on this card route. The separately exposed `useRecoveryCenter.validateSnapshot`:54 can compute a report but does not gate this route. |
| Public payload load: store :87,138; [vaultSnapshotBuild.ts](../src/lib/vaultSnapshotBuild.ts):121 | Truthy legacy JSON wins; otherwise concatenate metadata-declared chunks, parse kind/schema-1/vault/extensions/truthy ID | Missing chunk/malformed metadata can return null. No required index lookup or requested-ID/payload-ID, slot/key/time, indexed-byte-total proof; truthiness is not strict ID validation. Returned object is not a source capability. |
| Outer assessment: [vaultSnapshotValidate.ts](../src/lib/vaultSnapshotValidate.ts):32,109 | Kind/schema ceiling, required blocks/time, portable fingerprint of stored notes/folders/extensions, inner manifest validation; `ready = restoreReady` | Computed report has `valid`, `fingerprintMatch`, `restoreReady`. Assessment returns `manifest` even when `ready=false`. Malformed objects can throw during dereference; this is not a total untrusted-input parser. Shape/parser constraints and index identity are additional, not subsumed by this boolean. |
| Conversion: [vaultRestorePipeline.ts](../src/lib/vaultRestorePipeline.ts):162 | Calls assessment, takes `readiness.manifest`, adds portable extensions if absent, upgrades non-v3 manifest | **Ignores `readiness.ready` and validation.** `toRestoreReadyManifest` returns the original `snapshot.vault` reference ([vaultSnapshotBuild.ts](../src/lib/vaultSnapshotBuild.ts):113), so extension insertion mutates that in-memory object. Upgrade may rebuild inner fingerprint. Original storage bytes are not rewritten. |
| Preview: [useVaultRestoreFlow.ts](../src/hooks/useVaultRestoreFlow.ts):84,127; pipeline :203 | Loaded payload -> conversion -> core preview, export validation, impact, selected IDs and options | Retains manifest/core/export reports and display `restoreSource`, not selected raw payload/index/outer admission proof. Initial extension option is often true; the exception requires the user/options to select core only. No claim that default UI options automatically allow H06. |
| Modal: [VaultRestoreModal.tsx](../src/components/views/features/knowledge/VaultRestoreModal.tsx):102,108,336 | Invalid core preview shows failure; valid branch confirm disabled for importing/no applicable selection | Display origin/title and manifest validation are not original snapshot integrity. Confirm is not disabled by original outer failure because that evidence is absent. |
| Confirm: hook :207-253 | `preview.valid && fullPreview.exportValidation.valid`, options, selection count, runtime mode -> exception OR normal `mayRestore` | Original outer evidence is not required. Captures initiating account/generation **at confirm**, not a preview-source admission binding; Health/callback guards do not establish snapshot integrity. |
| Execution policy: pipeline :225-264 | Revalidates supplied manifest export, same options/count profile; captures operation epoch; before backup/core calls assert current epoch; filters selected manifest | API accepts manifest/options/deps, no source-integrity argument. Backup-before-restore is separate below. No claim that this pipeline was executed by the probe. |
| Private import: [useNotesStore.ts](../src/store/useNotesStore.ts):1565-1604 | Canonicalizes manifest, validates canonical export/core shape, rebuilds exact local/core profile; account-scoped persistence requires recovery context; creates verified Undo | Still no original snapshot ID/raw/index/profile/report. Independent checks remain mandatory and were not invoked in the probes. |
| Staging / authority: store :1607-1638, :501-600, :702 | Apply manifest in memory, recovery replace filters IDs; private WeakMap restore/rollback capabilities bind notes/folders/prior-snapshot digests, purpose, namespace, epoch, recovery context and lifecycle | Payload-bound authority is not source-origin authority: a digest of transformed content does not establish the original snapshot's integrity. Capabilities are invalidated in `finally`. |
| Durable write/readback: store :606-700, :754-819; [notesAccountAuthority.ts](../src/lib/notesAccountAuthority.ts):1286,1311,1659 | Validate payload/context/epoch, persist Notes, persist Folders, exact readback, complete capability; separate prior-state rollback capability on error | Account-scoped writes use account authority, not legacy global replacement. Nonaccount localStorage/legacy IDB modes have different storage mechanics. No multi-store physical/crash atomicity promise. |
| In-memory publication/result: store :1642-1696 | Require active recovery context and verified persisted result, then Zustand replacement/index rebuild; error reports durability/rollback status | Live import success is not inferred from the earlier previews or predicates. Ordinary Undo remains independently restricted (:1700). |

The save-private M1 path is deliberately different: store :248 `readTrustedIndex`, :271 `requireUsablePayload`, :288 `readValidatedPayloadKeys`, and :346 `saveVaultSnapshot` enforce exact indexed identity/bytes and integrity before skip/replacement. Public restore loading does **not** call that private proof. Do not claim M1 publication closes restore admission, or weaken M1 to make old restore inputs appear accepted.

## 4. Integrity versus authority: seven independent concepts

All current behavior in this table is `SOURCE_DERIVED_PATH`; pure observations are specified separately in section 6.

| Concept / current owner and function | Input evidence / failure / caller propagation | Authority granted and missing enforcement |
|---|---|---|
| `OUTER_SNAPSHOT_INTEGRITY`: snapshot validator | Original envelope projection/hash and inner validity; reports false/errors. JSON wrapper first parses supported envelope. Assessment always returns manifest | Diagnostic/readiness result, not import authority. Original bytes/identity/profile need an enforced link through conversion; outer report alone does not validate requested/index identity or authenticate producer. |
| `MANIFEST_STRUCTURAL_VALIDITY`: [importVaultBackup.ts](../src/lib/importVaultBackup.ts):170,186,238; [vaultBackupCompatibility.ts](../src/lib/vaultBackupCompatibility.ts):179 | Canonicalize supported schemas/arrays/folder identity, repair compatible note representations, validate core records; invalid core yields invalid preview/null manifest or private-import rejection | Eligibility of canonical content shape, not original snapshot integrity/provenance. Migration/repair can change the representation being validated. |
| `CORE_EXPORT_VALIDITY`: [vaultExportValidate.ts](../src/lib/vaultExportValidate.ts):26,33 | Migrated notes/folders/app/schema/date/extensions/cloud; report errors/warnings. Inner `contentFingerprint` mismatch is a **warning**, not included in `valid` | Callers use `.valid`, not original outer integrity. A converted/upgraded inner fingerprint match cannot retroactively validate an outer-invalid source. |
| `RESTORE_POLICY_ELIGIBILITY`: [recoverySafetyPolicy.ts](../src/lib/recoverySafetyPolicy.ts):575,598; [syncMode.ts](../src/lib/syncMode.ts):19 | Exact own-data-key profile, local runtime, replace, requested verified snapshot, core only, manifest-validation label, positive count, no cutover fence. Otherwise false/block | Conditional permission to attempt the bounded restore workflow. Does not prove actual Undo, account admission, persistence, original source validity, or successful import. `verified_valid` is a caller-derived manifest label here. |
| `VERIFIED_UNDO_AVAILABILITY`: [vaultRestoreSnapshot.ts](../src/lib/vaultRestoreSnapshot.ts):84 | Previous local notes/folders serialized, written, exact readback and usable/unique-ID shape required; otherwise typed throw and best-effort prior-backup restoration | Required recoverable prior-state evidence before applying replacement. Not incoming-content validation, new last-slot backup evidence, or permission for H06. UI Undo availability is a different policy question. |
| `IMPORT_AUTHORIZATION`: private store/capability functions above | Canonical validation + exception + account context + Undo + bound payload/epoch/lifecycle; rejection/throw/null on unmet checks | Allows exact target-state writes under existing private authority. Missing original source admission is not fixed by those target-payload digests. Unforgeable origin-preserving admission at this owner is a future contract, not present. |
| `DURABLE_COMMIT_SUCCESS`: `persistAndVerifyRestoreState`, final store continuation | Notes/Folders writes, exact readback, capability completion/current context, then in-memory publication; durability error attempts rollback and reports verified status | Script-visible verified persistence, not disk flush, crash-proof all-or-nothing Notes+Folders or universal rollback. No proof of execution in this task; not a surrogate input validator. |

## 5. Historical classes, origin, and compatibility

Pinned historical producer/validator: [#260 merge `9d96fe2ce2f2eb46366584de1fc7c97c5b872d13`](https://github.com/Absinthe-6785/Absinthe/blob/9d96fe2ce2f2eb46366584de1fc7c97c5b872d13/frontend/src/lib/vaultSnapshotBuild.ts). Its actual builder hashes full `{vault, extensions}`; current builder/validator hashes `{notes, folders, extensions}`. Both use the 32-bit UTF-16 xor/djb2-style primitive over unsorted `JSON.stringify`, not cryptographic authentication. Snapshot schema 1 has no reliable algorithm-generation/provenance marker. Storage format (legacy versus chunks), shape, time, appVersion, a historical hash match, and exclusion of one algorithm cannot authenticate provenance.

| Independent class | Provenance evidence in this task | Historical / current outer result | Proposed snapshot admission disposition, NOT current behavior |
|---|---|---|---|
| Current-valid positive | Actual pinned current builder + synthetic input + retained raw bytes | Current true | Can proceed to normal preview/eligible path under the separately approved supported-source profile; still needs policy/account/Undo/persistence |
| H01 | Actual pinned #260 builder/serializer and original validator, exact raw SHA | Historical true; current false, only `fingerprint_mismatch` | **Remains rejected/unrecognized by current-only integrity admission** until separate compatibility policy approval. Not called corrupt merely because today's check fails |
| H06 | Separate H01 copy with markdown changed, original hash retained | Both false | Deny source authority even when converted preview is valid; never an old-generation positive |
| UNKNOWN | Unsupported/unverified generation, provenance, identity or integrity | Cannot infer historical validity; may fail parser or may match current checksum | No authority by elimination/fallback. Recognized checksum is not producer authentication; insufficient evidence stays unknown at the boundary requiring that evidence |

`SNAPSHOT_ORIGIN` means indexed local envelope/identity/storage evidence, not merely a manifest with a UI string. `DIRECT_MANIFEST_ORIGIN` currently enters through JSON `parseVaultBackupJson` / normalization and its own core/export policy. `OTHER_SUPPORTED_ORIGIN` includes the ZIP transport that reads `manifest.json` via [vaultBackupZip.ts](../src/lib/vaultBackupZip.ts):61 and normalizes to a direct manifest. It has no Vault Snapshot outer envelope requirement today. No extra unsupported origin is invented.

A future discriminator must be established by the owning entry/admission path and preserved to private import, not supplied as an arbitrary caller label. It must not default a snapshot that lost its envelope to "direct manifest". Direct imported JSON/ZIP retains its **independently approved** validation/permission rules; absence of snapshot fields is legitimate there. Intentional user provision of an external manifest under that path is not certified as historically authentic by this contract. Unknown/corrupt snapshot conversion may not silently acquire the direct path's authority. A caller inventory and explicit origin-admission API decision are prerequisites; this task adds neither an enum nor a capability.

`PRE262_COMPATIBILITY_DISPOSITION = REQUIRES_POLICY_DECISION`. No Option B historical recognition, recomputation on originals, in-place rehash, fallback by historical shape, migration or cleanup authority is approved. A future policy must distinguish generation recognition, integrity evidence and producer authenticity, accepted usage (preview/export/import/save-base/cleanup), H06/UNKNOWN denial, and byte preservation. It is separate from fixing propagation of already-rejected sources.

## 6. Executed isolated probes: method and N01-N10

### Reproducible method and boundaries

Node `v24.14.0`, installed esbuild `write:false`, pinned source from `git show <sha>:<path>`, isolated VM contexts, Map-backed storage. Current context loaded 59 repository modules; historical context 39. Knowledge barrel was resolved to the same era's actual `properties/noteProperties.ts` exports, avoiding unrelated UI initialization. Installed package dependencies (including an unused KaTeX dependency) were resolved normally; no claim to historical third-party package execution beyond these plain-text fixtures.

For current **pure conversion/preview only**, unused write dependencies `vaultExtensionApply`, `healthRoutineSync`, `vaultCloudRestore`, `vaultSnapshotAuto` were deny/throw shims. Actual `recoverySafetyPolicy`, `syncMode`, builders, hash, validators, public readers, manifest conversion and preview bodies were **not** shimmed. The policy input was JSON-created inside its source VM realm to satisfy the actual plain-object prototype check; no guard was removed. Module defaults remained recovery active, runtime local, empty synthetic cutover storage. Private store/capability/account/Undo/persistence functions and `executeVaultRestorePipeline` were never called or bypassed.

Initial harness setup attempts failed on define syntax, dependency resolution, and cross-realm policy-object rejection. Only the corrected successful run is positive evidence; these were harness adjustments, no production fixes. Same-realm actual policy evaluation produced the profile below. Global storage set/remove attempts, denied external-I/O attempts, restore-pipeline calls and import calls: **all zero**. Seeded maps were host-created fixtures, not writes through application storage; builder contexts ended with empty maps. Conversion received parsed copies; original immutable strings remained untouched. No probe/code/bundle file was written to the repository or evidence directory.

Fixture recipe (same as authoritative historical evidence): fix `Date.now`/new Date at `2026-06-16T00:00:00.000Z`, sequential UUIDs starting `00000000-0000-4000-8000-000000000001` per VM, empty extension storage. One note: id `synthetic-pre262-note`, title `Synthetic note`, body `Synthetic body 한글 😀`, null folder/deletion, false starred, created/updated `1700000000000`, empty properties/relations; no folders. Call each era's actual `buildVaultSnapshot(...,'last','last')` and serializer. H06 appends `\nACTUAL_CORRUPTION` to a parsed H01 copy's first markdown without changing stored hash. Historical validator was actually rerun for H01/H06; no current builder with pasted old hash was used as historical evidence.

| Raw fixture | UTF-8 bytes | SHA-256 of retained original serialized string |
|---|---:|---|
| Current positive | 3791 | `df67dd2abc64a711fbf5e8b0cbccd2ffa6f24cc2447c2c002ff84fb153f4a5d6` |
| H01 | 2179 | `7367df4a479860e269fb001020bbb123e598a58b7f7bb3d83472ff2fcc291ec0` |
| H06 | 2198 | `e4366c5cb0ebb32e232773e7de53c5530e4adbb91deac1b1787493c291e4b388` |

These match #788's retained fixture recipe/hashes. Harness bundle SHA-256: current `729359033a782f5c6f5bca58572ba1bf1945cd59c153d3da3e1aa601fb61fd8c`; historical `d83f5f0975ff8cdf76a357d0d5e404c926fe29404cd994ca8cc3e67beeccb823`. These are reproducibility metadata, not signatures or checked-in tests.

### Exact conditional policy profile

```text
operation = LOCAL_CORE_JSON_NOTES_FOLDERS_RESTORE
syncMode = local
strategy = replace
createVerifiedSnapshot = true
restoreCore = true
restoreExtensions = false
restoreCloud = false
backupValidation = verified_valid
selectedNoteCount = 1

actual recovery mode = true; runtime mode = local; cutover blocked = false
mayRestore() = false
mayUndoRestore() = false
mayRestoreLocalCoreJsonBackup(profile) = true
```

`OBSERVED_PURE_PREDICATE`: changing strategy to skip, requested snapshot to false, cloud to true, or validation to invalid returned false. This is not an all-permission predicate. `createVerifiedSnapshot=true` is an input request here, not proof that any snapshot was persisted. `backupValidation=verified_valid` comes from core/export manifest validation in the observed route, not original outer integrity. For H06, that permits the *attempted* local/core workflow conditionally; it does not satisfy remaining private gates or demonstrate a completed import.

### Required controls and actual observations

`SYNTHETIC_REPRODUCTION` for load/validation/preview; policy columns are `OBSERVED_PURE_PREDICATE`. "true preview" means core and export `.valid=true`, not authorized import. Future safety-oracle satisfaction is not claimed.

| Control | Exact fixture/entry | Observed result |
|---|---|---|
| N01 current valid | Current raw -> parse/assess/convert/full preview -> actual policy input | Outer/ready true, core/export true, inner fingerprint true, exact exception true; no import |
| N02 H01 | Authentic old raw, historical validator then current route | Historical valid true; current outer/ready false, only fingerprint mismatch; core/export true, inner fingerprint true after conversion/upgrade, exception true |
| N03 H06 | Changed markdown retaining H01 hash, both validators then same route | Historical false; current outer/ready false, only fingerprint mismatch; core/export true, converted inner fingerprint true, exception true |
| N04 UNKNOWN generation | Copy of current envelope, `snapshotSchemaVersion=99` -> actual parser | Parse rejected, no conversion; no fallback. This one rejection does not prove all unknown provenance is detectable |
| N04b UNKNOWN provenance limit | Copy of current raw with unverified `appVersion='unknown-producer'`, hash untouched | Parser/outer/ready/core/export/exception all true: appVersion is outside outer hash. A fabricated producer assertion is not authenticated. Proposed contract must not pretend this is detected by today's checksum |
| N05 missing chunk | Metadata chunkCount=2; only first 10 characters in chunk 0, chunk 1 absent -> load | Null payload; no conversion |
| N06 malformed metadata/index | Invalid JSON metadata; separately invalid JSON index plus known valid payload key; separately chunkCount=1, totalBytes=1 but full valid JSON chunk | Invalid metadata rejected; malformed index reports empty yet known-key load succeeds; wrong byte total also loads. Tolerant reader is not indexed-byte proof |
| N07 identity mismatch | Valid payload placed under `different-index-id` and index entry for that requested ID | List uses different-index-id, load returns payload's UUID, outer true, core preview true. Identity mismatch is not covered by content projection |
| N08 fp mismatch / valid notes | Current copy with outer hash `00000000` -> same pure route | Outer/ready false, core/export/inner fingerprint true, exception true |
| N09 preview-valid / outer-invalid | Independently repeat H06 assessment/conversion/preview/policy | Outer false, core/export true, exception true, no pipeline/import call; directly demonstrates the nonimplication |
| N10 outer-valid / policy-ineligible | N01 plus `restoreExtensions=true` in exact policy profile | Outer true; normal mayRestore false; exception false. Integrity is not policy eligibility |

Additional direct JSON control: parse the current fixture's inner manifest as JSON and build export preview -> core/export valid true without a Vault Snapshot envelope. ZIP was source-traced, not extracted/executed in this probe. Unsupported schema, missing chunk and invalid JSON are finite inputs; no pathological unbounded chunk loop was executed. N04b exposes an evidence limitation, not a successful unknown-source safety test.

## 7. Verified Undo, backup-before-restore truth, and replacement

### Verified Undo is a mandatory prior-state gate, not input validation

`SOURCE_DERIVED_PATH`: store :1603 calls `saveVaultRestoreSnapshot(currentNotes,currentFolders)` **before** `applyVaultRestore`. [vaultRestoreSnapshot.ts](../src/lib/vaultRestoreSnapshot.ts):84 captures prior local notes/folders, serializes, writes `absinthe-vault-restore-snapshot`, requires exact serialized readback and usable parsed records with unique IDs; savedAt must be parseable. Missing/failed/mismatched readback or serialization failure throws `VaultRestoreSnapshotError` (`VAULT_RESTORE_SNAPSHOT_NOT_DURABLE`). It best-effort restores the preceding backup value; import is aborted regardless of that cleanup's success. This code saves a local prior-state copy, not the incoming outer envelope; an H06 input cannot become valid because prior local data was safely saved.

Normal `mayUndoRestore()` is false with recovery active, and store `undoLastVaultRestore` rechecks it before loading/applying the copy. The private failure rollback capability has a distinct purpose/lifecycle; it is not ordinary user Undo permission. A retained usable copy must not be described as immediately available ordinary Undo in recovery mode. No actual Undo, write/readback, rollback or import was executed here.

### Separate last-slot result-truth defect

`SOURCE_DERIVED_PATH`: [vaultSnapshotAuto.ts](../src/lib/vaultSnapshotAuto.ts):51 `createLastSnapshot` returns `saveVaultSnapshot`'s `{saved, skipped, reason?, ...}`. Under M1, saved means verified logical publication; skipped/unchanged means a verified valid base, not a newly created copy; `saved=false,skipped=false` is failure (quota only when identified). Pipeline :250-253 ignores the returned result and sets `backedUp=true` after normal return, including a reported failure. Hook :283 appends `vaultRestoreBackupCreated` when that boolean is true. The flag currently means "helper returned", not proof of creation or valid protection.

This is a distinct P2 result-truth issue. The authorization predicate uses the **requested** backup option, not its outcome, so the flag does not decide the earlier policy check. Later private import still must create its separate verified Undo, whose failure stops import; that safeguard neither corrects the misleading flag nor validates the incoming source. A future reporting contract must distinguish created, verified-existing skip and failed (and no false new-backup toast); whether last-slot failure should additionally abort restore is an explicit separate decision, not inferred here. No last-slot save was called by the probes.

### Precisely bounded destructive potential

`SOURCE_DERIVED_PATH`: [importVaultBackup.ts](../src/lib/importVaultBackup.ts):337 `applyVaultRestore` ordinarily merges folders and applies note conflict strategy to arrays. Private store :1615-1620 then, **when recovery active and strategy replace**, filters resulting notes to incoming canonical manifest note IDs and folders to incoming canonical manifest folder IDs. Pipeline :263 first filters by selected IDs (and folders used by selected notes), so the private store's incoming manifest may already be a subset. Existing local IDs absent from that subset can be omitted from the replacement target. Do not describe this as append-only merge or assume all old Notes/Folders survive.

Staging is in-memory target construction after verified Undo. Restore/rollback capabilities bind target/prior digests and epoch/context. Notes write is awaited, Folders write follows, exact Notes/Folders readback and capability completion precede returned verified target; store then checks context and publishes Zustand replacement. Errors in persistence attempt purpose-bound prior-state rollback and exact readback, then throw durability error carrying `rollbackVerified`; failed rollback results require recovery rather than a success claim. Account-scoped operations address their captured account authority. Legacy IDB replacement uses clear/put within its own transaction; that is not a contract authorizing snapshot-store-wide clear or a new migration.

This call chain establishes **conditional replacement potential if every remaining gate passes**, not a demonstrated live destructive operation. Undo + two-store readback is not universal transaction/crash/eviction safety. No claim about how many real users, deployments, accounts or snapshots are affected is supported.

## 8. Minimum source/currentness contract for a future decision

Proposed obligations, **not implemented guarantees**:

1. Preserve original snapshot identity and exact raw/index/metadata/chunk evidence before conversion or normalization. Strict finite assembly/identity/byte checks must accompany the approved outer-validator profile; known-key load, card count/time and hash alone are insufficient. Treat read failure as unavailable/denied, not verified empty. Never rewrite originals to pass validation.
2. Distinguish an integrity checksum/projection match from an approved source-generation/provenance classification. No v1 algorithm marker or authentication is available today. N04b cannot be solved by trusting appVersion. The future decision must state which evidence is sufficient for its bounded current-source profile, and how unsupported/unprovable evidence fails closed. If stronger producer authentication is required, that is an evidence/architecture blocker, not an invented property of this proposal.
3. Source admission is operation-local, nontransferable, nonserializable and invalidated on completion/cancel/error/replacement. Bind origin and approved profile to original bytes/identity evidence and exact derived canonical/filtered target relation; a display tag or caller assertion cannot mint it. Bind account namespace/generation and operation epoch in addition to preserving existing private capability authority.
4. Selection of a different snapshot or payload/index/meta/chunk replacement invalidates prior admission. Resolve the TOCTOU choice explicitly: either consume the exact immutable validated captured source or reread/revalidate and compare before authorization; never silently use current storage with an old proof. Any claim that admission means "still the current stored selection" requires the latter check. Cross-tab locking/serializability is not supplied by M1 or proposed implicitly.
5. Account switch (including A->B->A generation), epoch change, recovery transition, preview regeneration, manifest upgrade/repair/extension insertion/filtering, selection change or option/strategy change cannot reuse mismatched proof. Recompute/derive under the same validated origin and require new confirmation where intent changes. A transformed manifest hash match cannot authorize its original source. A legitimate deterministic transform must preserve the original denial/unknown state rather than reset it.
6. Recheck account/epoch/source binding at authoritative use points after every relevant asynchronous suspension and before side effects; invalidate on stale evidence. Do not substitute the hook's confirm-time account capture for preview-time binding. Retain existing private checks and bounded error rollback; adding source currentness must not accidentally authorize rollback into another account or turn stale operations into success.
7. `DIRECT_MANIFEST_ORIGIN` and ZIP/direct entry retain separate rules, with their own typed admission. No global requirement for absent snapshot fingerprints, no manifest-only overload that silently launders converted snapshot denial, and no new permissions for unrelated extensions/cloud. Inventory all callers before changing a private API.

The implementation plan must choose ownership, immutable versus reread source lifetime, bounded evidence representation, cancellation/reuse rules, transform derivation and origin-specific API coverage. Those choices, supported-source/provenance policy, typed result handling and negative tests need independent review and explicit implementation authorization. No new runtime capability or retry permission is minted here.

## 9. Contract option comparison and recommendation

All options below are **candidates**, not changes already made. Each preserves existing recovery policy, account/epoch, verified Undo and persistence checks; H01 recognition remains separately unapproved.

| Candidate | Invariant / current authority owner / proposed gate | Binding, lifetime, caller/API impact | Failure, compatibility, tests and remaining limits |
|---|---|---|---|
| A: pre-conversion gate | Original supported snapshot integrity + indexed identity required before losing envelope; hook/loader/converter currently own access but not import authority | Validate original bytes before mutation/upgrade; retain source/derived relation. Converter/read-admission result likely changes; no global manifest gate | Fail before normal success preview, preserve diagnostics and raw bytes. O01/O02/O05/O13. Good early UX, but alone cannot cover private callers, stale proof or origin laundering; current validator alone misses N07 and provenance. Direct JSON/ZIP must not be routed through it. |
| B: confirmation/authorization gate | Current user intent/source must still match; hook/pipeline currently own option and policy checks | Bind selection, options, preview generation, account/epoch and exact source; pipeline API needs source evidence or validated operation admission, not report booleans | Reject stale/denied before backup/import, distinguish policy and source errors. O03/O07/O08/O12. Rechecking only a transformed manifest or a UI origin string is insufficient. Other callers can bypass a hook-only fix; async use still needs rechecks. |
| C: explicit validated-source capability | No loss of original denial/unknown state through transforms; no existing source capability owner (private target-payload capability exists separately) | Owning entry validates and mints opaque, operation-bound proof; pipeline carries/derives it, no caller-supplied boolean/tag; limited lifetime, account/epoch/origin/raw/target binding | Requires reviewed API and issuer/consumer inventory. O02/O04/O06/O07/O08/O14. Capability name/shape alone proves nothing; leaked/reusable/digest-only proof remains unsafe. No serialization, broad fallback, new fingerprint or implied authenticity. |
| D: private import admission | No destructive write authority from manifest shape alone; private Notes import/WeakMap authority is the decisive target-state owner today | Require origin-specific source admission **before** minting existing write capabilities, preserving their digest/purpose/currentness checks; all private callers must explicitly classify origin | O02/O03/O06/O09/O10/O12/O14. Deny unsupported/missing/stale evidence; typed errors propagate to UI. Alone without original evidence cannot reconstruct it; treating any raw manifest as direct is unsafe. Do not broaden direct path rules or weaken rollback/Undo. |

No current single boolean/enforcement location is sufficient. A+B alone leaves alternative private callers/API origins unproven; C without a trustworthy issuer/consumer and D does not enforce anything; D without preserved original evidence cannot recover provenance. Conversely, one future centrally owned admission mechanism could discharge several obligations without four duplicate validators. Judge invariant coverage, not the number of gates.

**Recommendation: `CONTRACT_RECOMMENDATION_READY` for a layered A + B + origin-preserving C/D contract decision, not selection of a concrete implementation.** Fast fail on rejected original snapshot before normal preview; preserve original source proof through legitimate transforms; revalidate current intent/context at confirmation and authoritative use; private import must require origin-specific admission before existing write authority. Keep direct JSON/ZIP rules independent, H01 unrecognized, H06 denied, UNKNOWN without sufficient approved evidence denied. Reviewable invariant coverage is supported by the observed call graph and controls.

`RECOMMENDED_NEXT_DECISION`: separately approve supported-source/provenance classification, the issuer/private-admission API and lifetime/TOCTOU choice, error/result propagation, compatibility boundaries and a bounded implementation/test plan. Exact source API implementation is **not authorized**. If required UNKNOWN discrimination/authentication or account/currentness proof cannot be supplied within that proposed scope, return `BLOCKED_BY_EVIDENCE_GAP` at that decision instead of accepting all schema-1/current-hash inputs. H01 recognition requires its own product compatibility decision even if this safety contract is approved.

## 10. Future acceptance oracles O01-O15 (not implemented/executed)

Use isolated synthetic storage, dependency spies and source-level/private-admission tests only in a separately authorized implementation task. These are test specifications, not results of this characterization. "No import" means no import/write-authority issuance or persistence side effect, not just a rejected UI message. For denial oracles assert source admission separately from preview, policy, Undo and persistence.

| Oracle | Fixture / entry point | Expected result / failure injection | Invariant / negative sensitivity | M1 applicability |
|---|---|---|---|---|
| O01 current-valid | Actual current producer, coherent indexed legacy/chunked copy; card->source admission->preview->eligible confirm/private boundary | Admit normal preview and eligible path with all independent prerequisites. Inject no source fault; separately deny account/policy to prove source PASS is not total authorization | No blanket deny regression. A deny-all or snapshot-fingerprint-required-on-direct mutant must fail positive controls; no successful import asserted from preview alone | Stable logical map IN; no physical durability claim |
| O02 H06 | Actual #260 H01 modified as above, retained original hash; converter and private snapshot-origin entry | Outer false, preview may be diagnostically readable, **no import authority**. Inject structurally valid markdown alteration, optionally valid recomputed derived inner fingerprint | Valid manifest cannot erase original denial. Mutant discarding readiness/source admission must fail, even with mocked independent policy/Undo PASS | Integrity rejection IN; no write/cleanup |
| O03 exact exception | N03/N08 plus exact section 6 local/core-only profile; confirm/pipeline/private admission | Normal policy false, exception true, source denied, no write authority. Inject omission/substitution of outer proof, not change policy | Policy label `verified_valid` is not original-source proof. Manifest-only exception mutant must fail | IN_AS_REJECTED_INPUT; no authority expansion |
| O04 UNKNOWN | Unsupported schema plus unverified producer/profile/identity fixtures including N04b; owning source admission | Unknown evidence cannot gain snapshot authority. Inject arbitrary generation/appVersion/current checksum and incomplete provenance; approved classifier must justify any recognized control | No historical-by-elimination or checksum authentication. Accept-all-schema/hash/old-shape fallback must fail. N04b must expose insufficient classifier evidence, not be renamed proven-current | Rejected inputs IN; stronger authenticity guarantee needs separate decision |
| O05 H01 | Authentic unchanged #260 raw and historical validator; current-only snapshot admission | Historical true, current false; preserve bytes and report compatibility decision needed, no recognition/import/save-base bypass. Inject historical-hash fallback | Denial is not corruption claim. Automatic rehash/recognition mutant fails; old raw SHA stays unchanged | No M1 relaxation; legacy data preserved, not repaired |
| O06 direct manifests | Supported direct JSON and ZIP manifest fixtures, with no snapshot envelope; direct entry + private admission | Retain independently approved validation/permissions; source kind established by entry. Inject missing outer fields legitimately and converted snapshot mislabeled direct | No blanket snapshot check on direct files; no default/direct fallback for lost snapshot proof. Both blanket-deny and origin-laundering mutants fail | Reader-only source split; no store migration |
| O07 selection/source changes | Two coherent snapshots; captured payload then replaced bytes/index/chunks; selection/preview/options regenerated; confirm/use | Prior admission cannot authorize changed source/target/options. Inject each change between preview, confirm and use; either exact captured immutable source or explicit fresh verification per approved lifetime | No stale proof applied to different data; no trust in ID equality alone. Omit-binding/reuse mutant fails; safe immutable-source semantics explicitly tested | Stable invocation IN; external mutation modeled as currentness adversary, not cross-tab M1 guarantee |
| O08 account/epoch | Same source under account A, then B/A generation or recovery epoch transition, including during await; private gate/use | Stale admission denied before writes/publication; existing account isolation and bound rollback retained. Inject transition at every suspension/use boundary | Source proof not transferable across contexts. Remove generation/epoch/current checks mutant fails | Account protocol separate from snapshot M1; no claim of global transaction |
| O09 Undo separation | Source-valid + source-invalid inputs, usable prior Notes/Folders; private admission/Undo order spies | Valid path requires verified prior snapshot; invalid source never gains authority merely when Undo succeeds. Inject unconditional "Undo succeeded" response on denied source | Input integrity AND Undo, not OR. Undo-as-source-proof mutant fails | Undo storage contract is separate; do not borrow M1 atomicity |
| O10 Undo failure | Valid/eligible source; synthetic prior-state serialization/write/readback failures; private import entry | No apply/write authority/import after required Undo failure. Inject missing/mismatched/unusable readback and write throw; prior-backup cleanup may also fail | Failed backup cleanup cannot reopen import. Ignore Undo error or proceed-on-requested-backup mutant fails | Separate prior-state helper contract, not snapshot index commit |
| O11 backup truth | Last-slot helper saved, valid unchanged skip, reported failure/quota/nonquota; pipeline result/UI | Created vs verified-existing vs failed reported truthfully; never claim newly created backup on failure/skip. Inject each helper result without actual restore | `backedUp=true` cannot mean helper merely returned. Ignore-result mutant fails. Abort-on-last-failure policy must be separately decided; required verified Undo still independent | Use existing M1 `SaveSnapshotResult`; no new unknown-commit guarantee |
| O12 unauthorized replacement | Extra prior IDs absent from selected incoming manifest; invalid/missing/stale source admission under recovery replace | Deny before replacement authority/staging/persistence. Separately authorized positive asserts exact selected-ID semantics and verified prior state | No absent-ID omission from unauthorized source. Replace-before-source-admission mutant fails; zero writes on denial | Primary-state restore protocol separate from M1; no real-data probe |
| O13 malformed evidence | Missing/truncated/reordered chunks, bad count/byte/meta/index, duplicate entries, requested/index/envelope identity/slot/time mismatch, legacy shadow cases; load/admission/conversion | No success authority from partial/tolerant load; preserve raw bytes. Inject each finite malformed input and read exception; valid authoritative legacy blob with untrusted shadow remains distinct from shadow ownership | N06/N07 must be detected at admission, not by assuming outer hash covers identity. Trust-loader/manifest-only or delete-shadow mutant fails | Preserve M1 exact identity/ownership; no invalid-index-empty overwrite or inferred shadow deletion |
| O14 sensitivity | O02/O03/O07/O13 fixtures; isolated future in-memory mutants at preconvert, confirm and private consumption | Removing/bypassing decisive source gate must fail no-authority oracle; record surviving alternative gates rather than claiming a UI-only mutant proves all paths | Test private bypass and lost-proof direct fallback as well as happy UI; policy/Undo PASS cannot hide source loss. Remove every mutant afterwards | Sensitivity only; no product-source mutation retained, no stronger guarantee renamed PASS |
| O15 M1 regressions | Existing snapshot store/auto/chunk/verified-Undo tests, legacy/current positives, original prior copies; separate implementation validation | Run M1 T01-T18, invalid-old-base T04-OLD-01..06, valid unchanged vs invalid rejection, T17-SKIP-01, retention/collision/shadow ownership and relevant recovery/full-suite checks | No precommit deletion, false skip/success, occupied-key overwrite, original rehash, retained/unrelated cleanup or accepted incomplete payload. Early-delete/fingerprint-only-skip mutants fail | M1 supported model only; mutate-then-throw/cross-tab/crash-durability remain explicit unsupported stronger cases |

## 11. Result/error truth and observability contract

These are **conceptual distinctions for a future reviewed API**, not production error codes added by this task:

| Proposed distinction | Meaning / current expression gap |
|---|---|
| `INVALID_SOURCE_INTEGRITY` | Proven rejected original envelope/identity/assembly; today outer report exists but identified restore path drops it, while missing payload/generic invalid toast are not a full typed admission result |
| `UNKNOWN_SOURCE_GENERATION` | Required generation/provenance evidence insufficient, not historical-valid by exclusion; no complete current classifier, especially N04b |
| `SOURCE_CHANGED` | Admission binding/lifetime no longer matches selected bytes/context/derived intent; current source admission does not exist; epoch/account failures are narrower existing signals |
| `POLICY_DENIED` | Existing predicates/`RecoveryModeBlockedError` can block policy; distinguish from source invalidity and unavailable storage |
| `UNDO_UNAVAILABLE` | Existing typed `VaultRestoreSnapshotError` covers this prior-state durability failure, not incoming invalidity |
| `PERSISTENCE_FAILED` | Existing `VaultRestoreDurabilityError` includes stage/rollback verification; current UI mostly uses generic failure, not this full taxonomy |
| `RESTORE_COMMITTED` | Only verified authorized persistence and appropriate final current-context publication, not preview/allow/backup request or helper return; no universal disk/crash guarantee |

Keep diagnostics bounded and metadata-only; no note bodies, raw backups, account credentials or opaque authority objects in logs. Preview may explain why an original source is unavailable/invalid, but must not present core-preview validity as safe restore permission. Error ordering should preserve original denial while still checking policy/context independently; no generic recovery fallback that converts UNKNOWN to success.

## 12. Risks, STOP conditions, unknowns, and validation

| Priority | Evidence / risk | Bounded disposition |
|---|---|---|
| P0 | `NOT_PROVEN`: actual irreversible/user-wide data loss, account compromise or successful live corrupt restore | No incident or exposure count established; do not claim observed P0 harm |
| P1 | `SYNTHETIC_REPRODUCTION` + `OBSERVED_PURE_PREDICATE` + `SOURCE_DERIVED_PATH`: outer-invalid H06 can reach valid preview/conditional policy profile, without original proof required by private import; recovery replace can omit prior IDs if all remaining gates pass | High-priority source-admission contract gap, not observed end-to-end data loss; separately reviewed bounded implementation needed |
| P2 | `SOURCE_DERIVED_PATH`: last-slot save failure can still report backedUp/created; `SYNTHETIC_REPRODUCTION`: tolerant restore reader accepts identity/byte mismatch | Separate result-truth and admission evidence obligations; do not conflate with verified Undo or reopen M1 closure |
| P3 | `SOURCE_DERIVED_PATH`: generic failure/preview/protection messaging can obscure distinction between valid content, available copy and permission | Future result/UX mapping requires reviewed taxonomy, not a cosmetic fix that grants authority |

STOP before implementation/publication of any claimed fix if:

- Source authority is unclear, origin is merely a caller tag, or snapshot conversion silently defaults to direct-manifest authority.
- UNKNOWN or historical-shaped data gains fallback acceptance, H06 is reclassified as legitimate, or v1 checksum/appVersion is treated as provenance authentication.
- Acceptance requires stronger provenance detection not present in the record/evidence; require a separate decision, do not invent a classifier.
- Originals/index/chunks must be deleted/rewritten/rehash-migrated to pass, or save-private M1 validation/ownership/skip/retention guarantees are weakened.
- Scope requires DB v7/schema v1/store/index/keyPath/backend changes, unrelated reader/writer activation, G6, root storage scans, real data access or recovery permission expansion.
- Account/epoch/currentness binding, async invalidation, private caller coverage or rollback purpose isolation is unresolved in the proposed implementation plan.
- H01/H06/UNKNOWN/current positive controls or private-boundary/gate-removal negative sensitivity are absent; green previews/CI alone are not a safety oracle.
- Required main differs, the Markdown contains accidental source/test/config changes, or publication would imply runtime safety closure/approval that has not occurred.

Known unknowns: actual affected artifacts/users/deployed settings; real browser/archive/account histories; arbitrary v1 producer provenance and checksum collisions; acceptable current-profile evidence under future policy; supported transform/lifetime API design; physical crash/eviction/cross-tab behavior; runtime failure ordering and rollback outcomes in a real restore. No current-source fingerprint can prove cryptographic authenticity. All remain explicit; none was resolved by accessing real data.

Validation in this task: actual-source isolated N01-N10 plus N04b and direct JSON controls completed with zero write/I/O/import/pipeline attempts; policy positives/negatives as section 6. These reproduce current gaps, **not** passing future O01-O15 tests. Separately, the unchanged existing `vaultSnapshot.test.ts`, `snapshotCompaction.test.ts`, and `vaultRestoreSnapshot.test.ts` suites passed **3 files / 98 tests** in isolated synthetic storage. Those regressions exercise snapshot publication and the prior-state backup helper, not the product restore pipeline/private import or a real browser profile. No new checked-in test was added. All 23 local reference links resolved and O01-O15 specifications were enumerated. Publication checks require exactly this Markdown, valid baseline anchors, `git diff --check`, normal docs-only commit and clean tracked/index afterwards. Exact-head Push and PR five-job CI are separately reported in the delivery report; no precommit CI result is fabricated here. Hosted regression tests are not physical qualification or proof that the unimplemented safety oracles pass.

## 13. Frozen authorities

```text
VAULT_SNAPSHOT_CONTRACT_DECISION = CLOSED_IN_MAIN
VAULT_SNAPSHOT_FAILURE_SAFETY = CLOSED_IN_MAIN_UNDER_M1
PRE262_CHARACTERIZATION = CLOSED_IN_MAIN
PRE262_COMPATIBILITY_DISPOSITION = REQUIRES_POLICY_DECISION
PRE262_IMPLEMENTATION_AUTHORIZATION = NOT_GRANTED
RESTORE_SAFETY_IMPLEMENTATION_AUTHORIZATION = NOT_GRANTED
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
LIVE_WRITER_BLOCKERS = 7 OPEN
PUBLIC_ACTIVATION = NOT_AUTHORIZED
PR_LIFECYCLE = DRAFT_OPEN_UNMERGED
REVIEW_STATUS = PENDING
```

One Draft publication and independent review are the next lifecycle boundary. No runtime correction, historical recognition, product approval, Ready, merge, auto-merge or G6 follows from this characterization.
