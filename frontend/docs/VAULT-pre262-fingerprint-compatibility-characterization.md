# Vault pre-#262 fingerprint compatibility characterization

## Status and boundary

- Task: `PRE_262_FINGERPRINT_COMPATIBILITY_CHARACTERIZATION_01`.
- Repository: `Absinthe-6785/Absinthe`.
- Qualified main: `0fe0625d81e24b735deaaf6ca9b235366f606b32`.
- Canonical workspace: `C:\Users\이도현\GitRepos\Absinthe`; the alternate `D:\Projects\Absinthe` was not used.
- `PRE262_CHARACTERIZATION = COMPLETE_REVIEW_PENDING`.
- Separate compatibility correction disposition: `REQUIRES_POLICY_DECISION`.
- `REVIEW_STATUS = PENDING`; `IMPLEMENTATION_AUTHORIZATION = NOT_GRANTED`.
- This is a docs-only characterization, not a new validator, migration, restore authorization, or product-owner option selection.

An intact snapshot produced at #260 passes its original validator but fails today's snapshot validator with **only** `fingerprint_mismatch`. The same-slot save gate added in #787 therefore rejects replacement without modifying the old recovery copy. Repeating the invocation does not repair the mismatch. This is a demonstrated compatibility/liveness limitation, not evidence that those historical bytes were corrupt.

Do not infer that every restore path is blocked: the current snapshot-to-manifest preview path **does not enforce the outer snapshot readiness result**. It produced valid core/export previews for both the authentic historical fixture and an actually altered-payload negative control. Execution remains subject to separate runtime policy and import safeguards; no restore was executed. A compatibility decision must address this diagnostic-versus-preview inconsistency, not merely make a validator return true.

The approved [M1 commit contract](VAULT-snapshot-failure-model-commit-contract-decision.md) is unchanged. #787 remains `CLOSED_IN_MAIN_UNDER_M1`; that closure is not an all-generations compatibility or universal storage-atomicity guarantee.

## 1. Baseline and evidence labels

At kickoff, remote main and local `origin/main` were the qualified SHA, #786 was merged as `51a68acea2ba9a454969d14a210ade4ddda4fa21`, #787 was merged/closed as the qualified SHA, tracked worktree/index were clean, and the open-PR listing was empty. The delayed [actual merge-commit push/main CI, run 39103822236](https://github.com/Absinthe-6785/Absinthe/actions/runs/39103822236) completed SUCCESS on that exact SHA: `test`, `typecheck`, `build`, `backend-rel05g1`, `backend-recovery`, all 5/5. This supersedes the preceding gate's observation that the run had not yet appeared; it is not reuse of topic-head CI.

Evidence labels used below:

- `OBSERVED_IN_SYNTHETIC_PROBE`: executed exact-source functions against isolated in-memory storage, not a browser or user profile.
- `SOURCE_DERIVED`: follows the pinned implementation/call chain, without executing product UI or data mutation.
- `INFERENCE_ONLY`: explicitly conditional consequence, not an observed user incident.
- `NOT_PROVEN`: no evidence sufficient to claim the property.

No user Notes, browser localStorage, archives, IndexedDB, credentials, or production origins were accessed. No affected-user count, incidence rate, deployment reach, or browser/platform qualification is claimed.

## 2. Exact historical provenance and timeline

Each SHA below was verified from the corresponding GitHub PR and inspected through local Git objects. Source links are pinned to the actual merge commits, not a moving branch.

| PR / date (UTC) | Exact merge SHA | Actual source behavior |
|---|---|---|
| [#260](https://github.com/Absinthe-6785/Absinthe/pull/260), 2026-06-16 | `9d96fe2ce2f2eb46366584de1fc7c97c5b872d13` | Snapshot schema 1; full `{vault, extensions}` fingerprint; single legacy JSON payload; last/daily/weekly slots |
| [#262](https://github.com/Absinthe-6785/Absinthe/pull/262), 2026-06-16 | `a9a962a1bee1b43519e8ccac7861bdce6242c13b` | Builder and validator switch together to `{notes, folders, extensions}`; snapshot schema remains 1; no fingerprint-generation marker or old-algorithm fallback |
| [#308](https://github.com/Absinthe-6785/Absinthe/pull/308), 2026-06-18 | `444b6d006ab3157a3d4594da1d3ac8bfdb2f5aca` | Note compaction and chunked persistence; legacy read precedence retained; portable fingerprint continues |
| [#309](https://github.com/Absinthe-6785/Absinthe/pull/309), 2026-06-18 | `2713c2d9f91bf61c6b5fdf2b65e54edb8d479b99` | Monthly retention and cleanup changes; portable fingerprint and both read formats continue |
| [#787](https://github.com/Absinthe-6785/Absinthe/pull/787), 2026-10-18 | `0fe0625d81e24b735deaaf6ca9b235366f606b32` | M1 save-private validation of existing same-slot payload before skip/replacement; public readers and fingerprint validator unchanged |

Primary historical source anchors:

- #260 [builder, lines 75-110](https://github.com/Absinthe-6785/Absinthe/blob/9d96fe2ce2f2eb46366584de1fc7c97c5b872d13/frontend/src/lib/vaultSnapshotBuild.ts#L75), [validator](https://github.com/Absinthe-6785/Absinthe/blob/9d96fe2ce2f2eb46366584de1fc7c97c5b872d13/frontend/src/lib/vaultSnapshotValidate.ts#L32), [hash primitive](https://github.com/Absinthe-6785/Absinthe/blob/9d96fe2ce2f2eb46366584de1fc7c97c5b872d13/frontend/src/lib/vaultSnapshotFingerprint.ts), [manifest producer](https://github.com/Absinthe-6785/Absinthe/blob/9d96fe2ce2f2eb46366584de1fc7c97c5b872d13/frontend/src/lib/exportVaultBackup.ts), [store](https://github.com/Absinthe-6785/Absinthe/blob/9d96fe2ce2f2eb46366584de1fc7c97c5b872d13/frontend/src/lib/vaultSnapshotStore.ts#L162), [constants](https://github.com/Absinthe-6785/Absinthe/blob/9d96fe2ce2f2eb46366584de1fc7c97c5b872d13/frontend/src/lib/vaultSnapshotConstants.ts), [extension collector](https://github.com/Absinthe-6785/Absinthe/blob/9d96fe2ce2f2eb46366584de1fc7c97c5b872d13/frontend/src/lib/vaultSnapshotScope.ts).
- #262 [builder](https://github.com/Absinthe-6785/Absinthe/blob/a9a962a1bee1b43519e8ccac7861bdce6242c13b/frontend/src/lib/vaultSnapshotBuild.ts#L82), [validator](https://github.com/Absinthe-6785/Absinthe/blob/a9a962a1bee1b43519e8ccac7861bdce6242c13b/frontend/src/lib/vaultSnapshotValidate.ts#L47), [portable fingerprint](https://github.com/Absinthe-6785/Absinthe/blob/a9a962a1bee1b43519e8ccac7861bdce6242c13b/frontend/src/lib/vaultSnapshotFingerprint.ts#L14).
- #308 [chunk writer and legacy/chunk readers](https://github.com/Absinthe-6785/Absinthe/blob/444b6d006ab3157a3d4594da1d3ac8bfdb2f5aca/frontend/src/lib/vaultSnapshotStore.ts#L105), [compaction/chunk boundaries](https://github.com/Absinthe-6785/Absinthe/blob/444b6d006ab3157a3d4594da1d3ac8bfdb2f5aca/frontend/src/lib/snapshotCompaction.ts).
- #309 [monthly retention](https://github.com/Absinthe-6785/Absinthe/blob/2713c2d9f91bf61c6b5fdf2b65e54edb8d479b99/frontend/src/lib/vaultSnapshotStore.ts#L214).

The #262 commit message describes stabilizing dedupe after the v3 export envelope. The code proves a narrower fact: it changes the hash input projection in both producer and validator without a snapshot schema bump. It does **not** establish an approved retroactive migration policy. The current validator blob is still `033a8dd082edd1d9e3a47b9acb386bd4de0df0ae`, introduced at #262; #787 did not introduce the algorithm incompatibility.

### Serialization, storage, identity, and generation are different axes

At #260 `serializeVaultSnapshot` uses compact `JSON.stringify(snapshot)`. The hash also uses `JSON.stringify` without sorted-key canonicalization. The primitive starts at 5381, applies `((hash << 5) + hash) ^ charCodeAt(i)` over JavaScript UTF-16 code units, then returns unsigned 32-bit padded hex. It is not a cryptographic authenticity proof.

The index is `{schemaVersion: 1, entries: [...]}`. Entries freeze `snapshotId`, `slot`, `slotKey`, `createdAt`, `contentFingerprint`, and UTF-8 `payloadBytes = new TextEncoder().encode(serialized).length`. Legacy index entries legitimately lack `chunkCount` and `writeCount`. The legacy key is `absinthe:vault-snapshot:payload:<id>:v1`. Index timestamps are copied from the envelope, not recomputed on read. Replacement identity is `slotKey`, not merely `slot`; `last` uses `last`, daily uses `daily-YYYY-MM-DD`, weekly uses `weekly-YYYY-Www`.

#308 adds `absinthe:vault-snapshot:meta:<id>:v1` and `absinthe:vault-snapshot:chunk:<id>:<i>:v1`. Metadata records `storageFormat: 'chunked-v1'`, `chunkCount`, and UTF-8 `totalBytes`; index counts are optional. Despite the constant's name, chunk slicing is **384 * 1024 UTF-16 code units**, not UTF-8 bytes. Public loading tries a truthy legacy blob before chunk metadata/assembly. Missing chunks return null. Legacy storage does not imply pre-#262 hashing: H02/H04 are legitimate portable-fingerprint legacy blobs. Conversely, adding chunk packaging cannot turn an old fingerprint into a current one.

The original #260 slot type/producer has no monthly slot. H05B is an authentic later monthly control. No pre-#262 monthly production occurrence is claimed.

## 3. Root cause: replay identical bytes through both validators

For the very same H01 envelope:

```text
stored outer contentFingerprint                    = 7a0c2e5a
#260 fingerprintJson({vault, extensions})           = 7a0c2e5a
current fingerprintPortableVaultContent({
  notes: vault.notes, folders: vault.folders,
  extensions
})                                                  = ab9fcb03
historical valid / fingerprintMatch / restoreReady  = true / true / true
current valid / fingerprintMatch / restoreReady     = false / false / false
current inner vault validation                     = true
current errors                                     = [fingerprint_mismatch]
```

`OBSERVED_IN_SYNTHETIC_PROBE`: changing only `vault.exportedAt` changes the historical hash but leaves the portable projection hash unchanged. The historical projection includes the entire vault envelope: schema, export timestamp, app metadata, counts, folders, and notes. The portable projection omits those vault-envelope fields while still including the complete snapshot `extensions` value. Outer snapshot ID/slot/time were not in either projection. New inner export fingerprints and extension layouts from #262 are additional historical producer changes, but cannot explain away this direct comparison of **one immutable H01 object**.

Therefore the reproduced root cause is **field inclusion/projection change**, with timestamp inclusion as a demonstrated example; not a change of hash primitive, byte decoding, JSON damage, chunk ordering, or rebuilding/compacting the old notes. Insertion order still matters to both algorithms; neither is sorted canonical JSON. Later compaction can legitimately change a newly built note representation, but current validation hashes stored arrays directly and does not compact H01 during this reproduction. Snapshot schema 1 does not disambiguate the two fingerprint generations.

H06 is different: its markdown was deliberately changed while retaining H01's original hash. Both algorithms' validators reject it. That is `CORRUPT` in this controlled experiment, not an authentic old-generation positive control. A hash mismatch in an unknown user's artifact alone cannot distinguish compatibility from corruption; provenance and strict structure checks are required.

## 4. Isolated reproduction and fixture matrix

### Executed method and repeatable fixture recipe

Node `v24.14.0`, repository-installed esbuild, `write:false`, source from `git show <exact-sha>:<path>`, isolated VM contexts and Map-backed storage were used. No probe file or compiled output was written. Historical modules and their dependencies were loaded from their own era, not current builders with an old hash pasted on.

The knowledge barrel was resolved directly to that era's actual `properties/noteProperties.ts` exports for markdown parsing/serialization, avoiding unrelated UI module initialization. Actual extension collectors read **empty synthetic** storage. Date construction and `Date.now()` were fixed at `2026-06-16T00:00:00.000Z`; `crypto.randomUUID` returned sequential `00000000-0000-4000-8000-000000000001`, etc., per source context. `import.meta.env.MODE` was `characterization`. No real timers or network calls were allowed.

For the current pure preview witness only, unused write/authority dependencies (`vaultExtensionApply`, `healthRoutineSync`, `vaultCloudRestore`, `recoverySafetyPolicy`, `syncMode`) were isolated with deny/throw stubs. **No restore, authorization, account transition, or live Notes import was exercised or certified by this harness.** The actual snapshot/manifest builders, parsers, hashes, validators, stores, compaction, automation, `manifestFromSnapshot`, and `buildFullVaultRestorePreview` bodies were not replaced. Failed harness setup attempts (dependency resolution and `import.meta.env`) were corrected in memory before the successful run; they are not counted as passing evidence.

Base input, one synthetic note and no folders:

```js
const notes = [{
  id: 'synthetic-pre262-note', title: 'Synthetic note',
  body: 'Synthetic body 한글 😀', folderId: null, starred: false,
  createdAt: 1700000000000, updatedAt: 1700000000000,
  deletedAt: null, properties: {}, relations: {},
}];
const folders = [];
```

For each positive fixture, call its era's `buildVaultSnapshot`, serialize, then its **actual** `saveVaultSnapshot` into an empty Map and capture the writer's complete index/payload key map. Use `last` / `last`, except H05B (`monthly` / `monthly-2026-06`). H04 appends `\nLegacy encoding control` to the base body; H05 instead uses `'chunk 한글😀\n'.repeat(42000)`, forcing two actual historical chunks. H04 uses the second UUID in the shared #262 context; the other positives use the first UUID of their contexts. H06 is a separate parsed copy of H01, appending `\nACTUAL_CORRUPTION` to `vault.notes[0].markdown` without changing its fingerprint; its synthetic index byte length is adjusted so corruption is not confused with an index-length mismatch. H01's original string remains unchanged.

Each save attempt starts from an independent copy of the captured key map. The same-content candidate is a separate envelope copy with a fresh candidate ID and the **current projection** hash over the unchanged stored notes/folders/extensions; it passes current validation before invocation. This is a synthetic input control, **not** an implemented migration or rewrite of the original. For H06 this control uses the legitimate H01 content. The changed-content candidate comes from today's actual builder with title `Changed synthetic note`, base body plus `\nChanged`, the original slot/key and a fresh ID. These definitions avoid mistaking later default-extension differences for an unchanged-content skip. Every original fixture string's SHA-256 is checked after the attempts.

### H01-H06 results

All cells in these two tables are `OBSERVED_IN_SYNTHETIC_PROBE`. `Historical` means the pinned era's validator; H03 is the current positive control and H06 uses the #260 validator. `F/F` = `saved=false, skipped=false`, without a quota reason; `F/T unchanged` = validated unchanged skip; `T/F` = committed save.

| Fixture | Producer / representation | Historical valid / hash match | Current valid / hash match | Listed / exactly readable | Snapshot restoreReady | Same-content save / mutations | Changed-content save |
|---|---|---|---|---|---|---|---|
| H01 | #260 / legacy | true / true | false / false | yes / yes | false | F/F / 0 | F/F, 0 mutations |
| H02 | #262 / legacy | true / true | true / true | yes / yes | true | F/T unchanged / 0 | T/F |
| H03 | qualified main / chunked (1) | true / true | true / true | yes / yes | true | F/T unchanged / 0 | T/F |
| H04 | #262 Unicode legacy control | true / true | true / true | yes / yes | true | F/T unchanged / 0 | T/F |
| H05 | #308 / chunked (2) | true / true | true / true | yes / yes | true | F/T unchanged / 0 | T/F |
| H05B | #309 / monthly chunked (1) | true / true | true / true | yes / yes | true | F/T unchanged / 0 | T/F |
| H06 | altered H01 / legacy | false / false | false / false | yes / yes | false | F/F / 0 | F/F, 0 mutations |

Successful replacements of the current-valid controls produced a readable, validated newly indexed candidate and removed the superseded known payload keys. Old-key/index equality is required only on rejected attempts and unchanged skips, not on intentional successful replacement. Rejected H01/H06 attempts preserved the exact old index and every seeded payload byte. A separate mixed index with a valid unrelated current daily copy also remained byte-for-byte unchanged and that unrelated copy still validated.

| Fixture | Serialized UTF-8 bytes / UTF-16 units | Immutable original raw SHA-256 |
|---|---:|---|
| H01 | 2179 / 2173 | `7367df4a479860e269fb001020bbb123e598a58b7f7bb3d83472ff2fcc291ec0` |
| H02 | 3713 / 3707 | `bdcb5938b4f3db90de417206c54fc87c7cb92d68834908a7e1dade83b7f12625` |
| H03 | 3791 / 3785 | `df67dd2abc64a711fbf5e8b0cbccd2ffa6f24cc2447c2c002ff84fb153f4a5d6` |
| H04 | 3738 / 3732 | `e6280c3886d67cd06cc79edbc8dca323f9a2f266a1ac21bd6e3b7775f3838233` |
| H05 | 759685 / 507685 | `8e65d251e717a1f7d8bbd6e2311c46184aa7ed978e78c4264966958af7623950` |
| H05B | 3727 / 3721 | `4fe6dc8d41bd9967d296ee1017c865d21f18c1ea457e6a28429ea4c1cab676d7` |
| H06 | 2198 / 2192 | `e4366c5cb0ebb32e232773e7de53c5530e4adbb91deac1b1787493c291e4b388` |

### Reproduction assertions (recipe, not new production tests)

```text
old = producer260.build -> producer260.serialize -> producer260.store(Map)
assert validator260(load(old)).valid
assert current.load(old) serializes to the identical original raw string
assert current.validate(load(old)).errors == [fingerprint_mismatch]
assert current.validate(load(old)).vaultValidation.valid
before = exact raw index + every payload key/value
attempt current-valid same-content candidate, then changed candidate on fresh Maps
assert each == {saved:false, skipped:false}, mutation count == 0
assert each Map == before
assert original raw SHA-256 unchanged
repeat with post262 legacy, current, and historical chunked positives
assert valid unchanged skip and successful changed-content replacement
repeat with deliberately altered markdown and retained old fingerprint
assert both historical/current outer validators reject; never call it historical-valid
```

## 5. Current reader, restore, and save paths

Source anchors below refer to the qualified main; relative links are repository references, not additional edit targets.

| Path | Observed or source-derived behavior for intact H01 |
|---|---|
| A. Enumeration | `OBSERVED_IN_SYNTHETIC_PROBE`: [enumerateVaultSnapshots](../src/lib/vaultSnapshotStore.ts) maps index entries and counts loaded inner notes without validating the outer fingerprint. H01 is listed with one note. Listing is not usability proof. |
| B. Loading | `OBSERVED_IN_SYNTHETIC_PROBE`: `loadSnapshotPayload` parses the legacy envelope and returns its unchanged data. Schema 1 passes the parser; fingerprint validation is separate. |
| C. Validation | `OBSERVED_IN_SYNTHETIC_PROBE`: [validateVaultSnapshot](../src/lib/vaultSnapshotValidate.ts) yields false / false / false and only fingerprint_mismatch. [useRecoveryCenter](../src/hooks/useRecoveryCenter.ts):54 delegates to that validator on request. |
| D. Restore preview | `OBSERVED_IN_SYNTHETIC_PROBE`: [manifestFromSnapshot](../src/lib/vaultRestorePipeline.ts):162 calls assessSnapshotRestoreReadiness but consumes only `readiness.manifest`, not `readiness.ready`; it adds portable extensions to its in-memory manifest copy/normalizes to v3. `buildFullVaultRestorePreview` returns core valid=true and export valid=true for H01. It also does so for H06. Original persisted bytes are not changed by these probes. |
| E. Restore selection / execution eligibility | `SOURCE_DERIVED`: [RecoveryCenterPanel](../src/components/views/features/settings/RecoveryCenterPanel.tsx):193 exposes indexed cards directly to `openSnapshotRestore`; [useVaultRestoreFlow](../src/hooks/useVaultRestoreFlow.ts):127 does not call/enforce the hook's snapshot validation. Its confirm path checks core/export validation and `mayRestoreLocalCoreJsonBackup(...) || mayRestore()`, not the outer snapshot report. [VaultRestoreModal](../src/components/views/features/knowledge/VaultRestoreModal.tsx):108 rejects invalid core preview, not this outer mismatch. Actual permission/import success in a live account is `NOT_PROVEN`; no restore was executed. |
| F. Same-content save | `OBSERVED_IN_SYNTHETIC_PROBE`: [saveVaultSnapshot](../src/lib/vaultSnapshotStore.ts):374-380 validates the incoming envelope and then existing same-slot payload **before** unchanged-skip comparison. The historical base fails in `requireUsablePayload`; return F/F, no reason, zero mutations. Passing H01 itself as the input would fail even earlier at incoming validation (`SOURCE_DERIVED`), not gain a legacy bypass. |
| G. Changed-content replacement | `OBSERVED_IN_SYNTHETIC_PROBE`: same existing-base check rejects; no staging, deletion, index publication, pruning, or silent conversion occurs. Valid post262/current bases can be replaced. |
| H. Periodic autosave | `OBSERVED_IN_SYNTHETIC_PROBE`: [vaultSnapshotAuto](../src/lib/vaultSnapshotAuto.ts):117 calls daily/weekly/monthly independently; matching historical daily/weekly slot keys fail, but a new monthly key saves. The wrapper ignores the individual results (`SOURCE_DERIVED`). New-period helpers saved all three current-valid snapshots. |
| I. Last-slot autosave | `OBSERVED_IN_SYNTHETIC_PROBE`: direct `createLastSnapshot` and three schedule/flush cycles against an H01 last base leave every stored byte unchanged, with F/F from the direct helper. `SOURCE_DERIVED`: flush advances `lastFlushedFingerprint` only on saved/skipped, clears pending inputs after failure, and schedules no self-retry; a later schedule reattempt still meets the same invalid base. |

Additional boundary: `executeVaultRestorePipeline` calls `createLastSnapshot` for backup-before-restore but ignores its result and sets `backedUp=true` at lines 250-253. This is **not** proof of a newly created/valid last snapshot. Distinct verified-undo and import-core safeguards still exist; their end-to-end effectiveness with historical inputs is `NOT_PROVEN` here. This task does not alter or authorize bypassing them.

`SOURCE_DERIVED`: `assessRecoveryProtectionStatus` uses existence of a snapshot timestamp to report partial protection, not snapshot validation. An enumerated timestamp or note count must not be presented as proof of this old copy's current restore readiness.

## 6. Slot and autosave impact matrix

| Slot | Legitimate pre262 producer? | List / read / validate | Restore selection | Same-slot replace / autosave | Persistence / other indexed content | Evidence |
|---|---|---|---|---|---|---|
| last (`last`) | Yes | yes / yes / current false | Card/preview may open; outer readiness false; execution policy separate | F/F, zero mutations; no new last copy | Three repeated saves and three debounce retries preserve old bytes but cannot progress. Valid unrelated indexed copy preserved. No period rollover for `last`. | `OBSERVED_IN_SYNTHETIC_PROBE`; selection/policy `SOURCE_DERIVED` |
| daily (old date key) | Yes | yes / yes / current false | Same split | Same-key F/F; independent new date key saves | Three same-key retries fail identically. Later dates need not replace this base. Old raw payload preserved during new-period probes. | `OBSERVED_IN_SYNTHETIC_PROBE` |
| weekly (old ISO-week key) | Yes | yes / yes / current false | Same split | Same-key F/F; independent new week key saves | Three same-key retries fail identically. Later weeks can progress without repairing this old copy. | `OBSERVED_IN_SYNTHETIC_PROBE` |
| monthly | Not in #260 producer/type | A genuine later #309 monthly control lists/reads/validates | H05B outer and preview readiness positive | H05B unchanged skip and changed replacement succeed; absent/new month succeeds | No legitimate pre262 monthly artifact was established. A manually rekeyed old envelope would be a hypothetical case, not production provenance. | H05B/new month `OBSERVED_IN_SYNTHETIC_PROBE`; absence in #260 `SOURCE_DERIVED`; user occurrence `NOT_PROVEN` |

The period helpers used the fixed date 2026-06-16 for historical daily/weekly keys and 2026-07-01 for fresh keys. With only three original entries and ample synthetic capacity, each fresh-period save succeeded; this does not promise progress under quota or retention pressure. `INFERENCE_ONLY`: in a real much-later run, ordinary new daily/weekly keys may avoid the affected same-slot base while last remains pinned. No deployment/user chronology was measured.

`SOURCE_DERIVED`: normal count/byte retention may eventually remove an unrelated old periodic entry from the **index** after another successful save. Cleanup validates a victim before deleting its payload; an old-hash victim fails that check, so residue can remain and cleanup stops. This is not a repair/migration, guaranteed garbage collection, or a reason to delete it manually. M1 does not promise eventual physical reclamation or retry liveness.

## 7. Safety analysis and option comparison

No proposed option may weaken trusted index/identity checks, skip on fingerprint equality alone, accept an incomplete/unknown-generation payload, publish unverified bytes, overwrite occupied keys, delete old bytes before commit, treat malformed index as empty, delete retained data, or classify corruption as quota. Retention remains last 1 / daily 30 / weekly 12 / monthly 12, indexed soft cap 4,000,000 UTF-8 bytes with oversized-last exception. Physical cleanup remains best effort. No new DB, schema, store, index, keyPath, backend, or real-data mutation is implied.

The letters below belong to **this compatibility comparison**, not the separate approved M1 storage Option A or frozen Health Option C policy.

| Candidate | Required evidence and tests | Data safety / false acceptance / restore implications | Migration and runtime scope / M1 impact / unknowns |
|---|---|---|---|
| A. Maintain fail closed; document limitation | Keep H01/H06 distinguished, retry/slot/preview evidence and user-facing limitation accurate | Lowest new acceptance risk; preserves old bytes, but last updates remain blocked and outer-validation/preview discrepancy remains. Documentation alone cannot certify a usable restore. | No migration or validator change; preserves existing M1. Unknown affected population and operational recovery needs remain. |
| B. Recognize strictly verified historical generations | Pin producer/validator fixtures; define exact shape/provenance and algorithm eligibility; test corrupt/unknown/identity negatives, both storage forms, callers/preview, current regressions and mutations | Could recognize H01 without declaring H06 valid, but schema 1 and an 8-hex hash do not authenticate generation or ownership. Do not accept every mismatch by trying arbitrary hashes. Restore paths must agree on what recognized means. | Separate policy and bounded implementation authorization required. Might be read/validation-only, with new saves still current format; no in-place rewrite presumed. Requalify M1's existing-base/new-payload predicates and cleanup authority; keep publication invariants. Unknown acceptable legacy profile, evidence strength, and allowed consumer scope. |
| C. Separately authorized non-destructive migration | First prove readable intact owned index/payload, recognized generation, recoverability, staging headroom, idempotency, interruption/collision/rollback independence; retain original immutable evidence and compare restored semantics | Greatest mutation/cleanup exposure. Rehashing must not launder corruption or overwrite the only original copy. Current blocked base cannot simply be deleted to force progress. Restore equivalence must be proved, including extensions. | Needs explicit migration identity/protocol/publication contract, not merely calling today's save with altered bytes. No version/key change is preapproved. M1 may constrain per-invocation publication but is not a cross-tab/crash-durable migration guarantee. Unknown restart and ownership protocol. |
| D. Recovery/export-only legacy handling | Prove exact raw extraction and provenance labels, separate preview/restore permissions; authentic positive plus actual corruption and unknown negatives; export byte preservation | Can preserve evidence/access without silently blessing normal save/restore. Export is not validation or restored usability; 32-bit fingerprint is not authentication. Must not feed a privileged restore path without a distinct gate. | Separate read-only/export scope/UX authorization; no automatic replacement or migration. M1 store unchanged. Unknown whether raw or normalized export is desired, what provenance can be shown, and who may approve a restore. |

### Recommended next decision, not implementation permission

`REQUIRES_POLICY_DECISION`: independently review this characterization, then decide whether to retain A or authorize design of a **strict historical-generation recognition contract** (B), with D as a separately bounded evidence-preservation alternative. B is the recommended next design question, not a selected product policy or implementation-ready fix. Do not select it solely for increased acceptance. C is not justified as an automatic first step given absent real-data census/ownership/restart evidence.

The decision must explicitly define: accepted generations/provenance, `HISTORICALLY_VALID` versus `CURRENTLY_VALID`, unknown/corrupt handling, whether recognition confers save-base/cleanup and/or restore authority, consistent enforcement by all consumers, raw-byte preservation, result/report semantics, and whether the current preview discrepancy needs a separate safety correction. No silent validator relaxation, fingerprint recomputation on originals, delete-and-retry workaround, or product activation is approved.

## 8. Future correction acceptance oracle (not implemented here)

These are requirements for a separately reviewed and authorized correction. The characterization probes are not replacements for checked-in acceptance tests.

| Oracle | Required distinction / assertion |
|---|---|
| P01 Authentic provenance | Generate exact #260/#262/#308/#309 fixtures with their actual producer/serializer/store, preserve raw strings, hashes, index and key maps; never emulate old validity by today's builder alone. |
| P02 Classifications | H01: HISTORICALLY_VALID, currently rejected. H02-H05B: CURRENTLY_VALID. H06: CORRUPT under both generation checks. Unrecognized shapes/algorithms/provenance: UNKNOWN, not historical-valid by elimination. Recognition is not cryptographic authentication. |
| P03 Strict identity | Wrong snapshotId, slot/slotKey, timestamp, fingerprint/index mismatch, byte counts, schema, duplicate IDs/slot keys, malformed index, occupied legacy/meta/planned chunk keys all reject without writes. Same notes in another slot do not prove ownership. |
| P04 Legacy / chunked | Cover optional historical counts, Unicode/emoji and UTF-16 chunk seams vs UTF-8 byte totals; missing/middle/final/truncated/reordered chunks and legacy shadows fail closed. Preserve original byte identity; no automatic normalization in a read path. |
| P05 Unchanged | A known valid recognized base may skip only after the entire approved validity/identity proof. Preserve all six T04-OLD rejection categories and T17-SKIP-01 sensitivity from the M1 contract. Equal fingerprint alone never warrants skipped=true. |
| P06 Changed replacement | If policy authorizes recognized bases: fresh nonconflicting current candidate, exact stored-byte validation, pure retention, single index publication, then exact unretained cleanup. If recognition is export-only: ordinary replacement remains rejected truthfully. |
| P07 Restore parity | Test both snapshot diagnostic/readiness and actual card -> hook -> manifest -> core/export preview -> policy/verified-undo/import gates. H01 acceptance requires an explicit policy; H06/UNKNOWN must not gain authorized execution through a manifest-only shortcut. No test may infer permission from preview.valid alone. |
| P08 No precommit loss | Throw-before-write at metadata/every chunk/index; permanent refusal; read failures; retain old raw index/payload, unrelated data and conditional discoverability; no dependence on successful rollback or deletion to gain capacity. |
| P09 Retention / cleanup | 1/30/12/12 and indexed byte cap/oversized last; retained original keys never cleanup targets. An ambiguous/corrupt historical victim is not deletion authority. Cleanup refusal after known commit stays saved=true; no guaranteed physical reclamation. |
| P10 Automation | Last same-base retries, same/next daily/weekly/monthly periods, saved-or-skipped flush marker, failure pending-clear behavior, no false success or unauthorized self-retry. Repeated corrupted/unknown inputs never become accepted merely to improve liveness. |
| P11 No unauthorized migration | Repeated reads/validation/export/preview leave exact original bytes/index unchanged. No fingerprint rewrite, schema bump, key replacement, DB/storage migration, restore execution or activation unless independently authorized. |
| P12 Current regressions | Existing snapshot/compaction/restore/recovery suites, full frontend test/typecheck/build and exact-head Push/PR five-job CI remain green; do not broaden unrelated Health authority. |
| P13 Negative sensitivity | In-memory mutants must be caught: accept-all historical fallback (H06/UNKNOWN); fingerprint-only early skip; remove-before-commit; accept missing chunk; trust index identity alone; rehash original in place; ignore failed outer classification on an allegedly gated restore path; wrong-generation preference. Remove every intentional fault. Stronger non-M1 adversaries remain explicitly unsupported, not renamed PASS. |

## 9. Validation, unknowns, and reporting limits

Successful isolated characterization assertions: seven fixture rows (H01-H06 plus #309 H05B), exact old/current hash counterfactual, historical validation, current validation, enumeration/loading, unchanged and changed save controls, original SHA preservation, three repeated same-slot attempts per historical last/daily/weekly slot, unrelated indexed-copy preservation, direct last and three debounced attempts, periodic same-key failures/new-month success and next-period helper success. Final probe result: `ALL_CHARACTERIZATION_ASSERTIONS_PASS`.

Existing production tests were not edited. `npm test -- src/lib/vaultSnapshot.test.ts src/lib/snapshotCompaction.test.ts src/lib/vaultRestoreSnapshot.test.ts` passed **3 files / 98 tests**. The first sandboxed attempt could not start esbuild because parent-directory access was denied; rerunning the identical command outside that sandbox restriction passed. This was an environment startup failure, not a failed test assertion or a source fix.

Publication validation requires this single Markdown file only, resolving local references, verifying pinned historical Git paths/line anchors, `git diff --check`, a normal docs commit, clean tracked worktree/index and one Draft PR. Exact-head Push and PR CI are reported separately in the publication report/PR body, not invented in this precommit document. Independent review remains pending. Probes created no repository artifacts and their Maps/VMs ended with the Node process; no real storage residue exists.

Remaining unknowns and risks:

- `NOT_PROVEN`: prevalence of surviving pre262 copies, legitimate real-user variants, account/browser histories, deployed runtime settings, storage capacity and current restore policy state. No user data census was authorized.
- Synthetic positives establish specific historical producer outputs, not every v1 envelope ever written, third-party adapters, tampered copies, every extension shape, or arbitrary schema-compatible data.
- Matching the historical 32-bit hash plus structure is not authentication or complete provenance; malicious/colliding objects and generation ambiguity need policy and negative tests.
- Actual UI interaction, restore execution, verified undo, import side effects and physical-browser behavior were not run. Pure preview success must not be represented as safe end-to-end restore.
- Last-slot freshness can remain blocked; periodic rollover can progress but does not validate/repair old copies. Quota, unavailable reads, cleanup residue and out-of-M1 concurrent/crash failures remain separately bounded.
- The inconsistent outer-validator versus manifest-preview path and ignored backup-before-restore result are explicit source-derived risks, not fixed by this document. Any correction needs separate scoped authorization.

## 10. Authority freeze

```text
PRE262_CHARACTERIZATION = COMPLETE_REVIEW_PENDING
REVIEW_STATUS = PENDING
IMPLEMENTATION_AUTHORIZATION = NOT_GRANTED
VAULT_SNAPSHOT_CONTRACT_DECISION = CLOSED_IN_MAIN
VAULT_SNAPSHOT_FAILURE_SAFETY = CLOSED_IN_MAIN_UNDER_M1
PRE_262_FINGERPRINT_COMPATIBILITY = KNOWN_SEPARATE_LIMITATION
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
```

No runtime/product/test/config/backend/DB/schema edits, no historical data mutation, no validator or restore-permission change, no G6, no Ready/merge/auto-merge, and no compatibility implementation are included or authorized.
