# K-243 Local Backup Manifest Export Diagnostic Hook Plan

## Purpose

K-243 plans the future export diagnostic hook for the K-241 helper.

K-243 is docs/plan plus audit test only.

K-243 does not implement a runtime export hook.

K-243 does not wire the helper into export path.

K-243 does not change exportVaultBackup behavior.

K-243 does not change ZIP output.

K-243 does not change manifest.json.

K-243 does not add ZIP sidecar output.

K-243 does not change import/restore behavior.

K-243 defines the K-244 implementation or audit path.

## Current State Summary

Source-verified current state:

- K-238 manifest generator/validator exists.
- K-241 export diagnostic helper exists.
- K-241 helper is output-neutral.
- K-241 helper is not wired into export path.
- K-242 closed helper boundary.
- supported scopes are diagnostic-manifest / 0 and core-data / 1.
- Level 2/3/4 hard-fail.
- createdAt / backupId safe overrides are covered.
- unsafe override escalation hard-fails.
- existing ZIP manifest.json remains unchanged.
- VaultBackupManifest v3 remains unchanged.
- no sidecar output exists.
- importVaultBackup remains unchanged.
- vaultRestorePipeline remains unchanged.
- backupBeforeRestore remains safety context only.
- local runtime data remains source of truth.
- remote systems remain support layers.

## Source Inspection Findings

### exportVaultBackup

File inspected:

- `frontend/src/lib/exportVaultBackup.ts`

Current behavior:

- defines `VaultBackupManifest`.
- defines `buildVaultBackupManifestV3`.
- `buildVaultBackupManifestV3` filters deleted notes, maps active notes to backup entries, builds scope, computes content fingerprint source, and returns the current payload-bearing VaultBackupManifest.
- `buildVaultBackupManifest` delegates to `buildVaultBackupManifestV3` with no cloud block.
- `downloadVaultBackup` serializes the current VaultBackupManifest JSON directly.

Candidate hook implication:

- the cleanest future hook candidate is after `buildVaultBackupManifestV3` assembles the current VaultBackupManifest and before any JSON/ZIP writer consumes it.
- the K-241 helper can accept this existing VaultBackupManifest without duplicating note/folder/count derivation.

Output-neutral risk:

- any hook that mutates the manifest would change JSON export and ZIP manifest.json.
- any hook that changes return type would affect existing callers.

K-244 implication:

- K-244 should call the K-241 helper only after current VaultBackupManifest assembly and must prove the manifest object and export result shape are unchanged.

### VaultBackupManifest v3

File inspected:

- `frontend/src/lib/exportVaultBackup.ts`

Current behavior:

- VaultBackupManifest v3 is the current backup artifact contract.
- fields include schemaVersion, kind, exportedAt, app, appVersion, counts, folders, notes, optional extensions, optional scope, optional contentFingerprint, and optional cloud block.
- the shape is payload-bearing and import-facing.

Candidate hook implication:

- LocalFirstBackupManifest must remain diagnostic metadata.
- the future hook can read VaultBackupManifest metadata but must not replace it.

Output-neutral risk:

- nesting LocalFirstBackupManifest into VaultBackupManifest would change manifest.json.

K-244 implication:

- VaultBackupManifest v3 must remain unchanged.

### ZIP manifest.json generation

File inspected:

- `frontend/src/lib/vaultBackupZip.ts`

Current behavior:

- `buildVaultBackupZip` creates a JSZip archive.
- `buildVaultBackupZip` writes `manifest.json` as `JSON.stringify(manifest, null, 2)` where manifest is the current VaultBackupManifest.
- it writes README.txt.
- it writes note Markdown sidecars under notes/.
- it writes cloud CSV sidecars only when a cloud block is present and not skipped.
- `parseVaultBackupZip` reads manifest.json and normalizes it as VaultBackupManifest.

Candidate hook implication:

- the diagnostic hook should run before `buildVaultBackupZip` receives the manifest or inside a wrapper that does not touch the JSZip object.
- touching the zip object is unnecessary for diagnostics and increases sidecar risk.

Output-neutral risk:

- any added zip.file call would add sidecar output.
- any manifest mutation would alter manifest.json.

K-244 implication:

- K-244 must prove ZIP entry list unchanged and parsed manifest.json unchanged.

### Export result shape

Files inspected:

- `frontend/src/lib/exportVaultBackup.ts`
- `frontend/src/lib/vaultBackupZip.ts`

Current behavior:

- JSON export uses `downloadVaultBackup(manifest)` with the current VaultBackupManifest.
- ZIP export uses `downloadVaultBackupZip(manifest)` and `buildVaultBackupZip(manifest)`.
- current export helpers do not return a diagnostic result.

Candidate hook implication:

- diagnostic result usage should be internal/test-only in K-244 unless an already-existing internal extension point is found.

Output-neutral risk:

- adding a returned diagnostic object would be a behavior/API change.

K-244 implication:

- existing export function return type must remain unchanged.

### importVaultBackup

File inspected:

- `frontend/src/lib/importVaultBackup.ts`

Current behavior:

- parses JSON into VaultBackupManifest.
- validates current manifest shape for restore preview.
- supports per-item conflict strategies: skip / replace / duplicate.
- applies selected notes/folders only through explicit restore execution.

Candidate hook implication:

- import remains out of scope for diagnostic export hook work.

Output-neutral risk:

- changing manifest.json shape would require import parser changes.

K-244 implication:

- importVaultBackup tests must still pass.
- per-item skip / duplicate / replace must remain distinct from destructive whole-vault restore.

### vaultRestorePipeline

File inspected:

- `frontend/src/lib/vaultRestorePipeline.ts`

Current behavior:

- builds full restore previews from VaultBackupManifest.
- can derive a manifest from a snapshot.
- executes selected restore only through explicit execution options.
- records last export timestamps through the existing vault restore support path.

Candidate hook implication:

- restore pipeline does not need diagnostic export hook results.

Output-neutral risk:

- using diagnostics as restore readiness would blur export validation with restore mutation.

K-244 implication:

- vaultRestorePipeline remains unchanged.

### backupBeforeRestore

File inspected:

- `frontend/src/lib/vaultRestorePipeline.ts`

Current behavior:

- `backupBeforeRestore` can create a safety snapshot before restore execution.
- it is not permission for silent destructive restore.

Candidate hook implication:

- export diagnostics should not alter backup-before-restore behavior.

Output-neutral risk:

- none if restore files remain untouched.

K-244 implication:

- backupBeforeRestore remains safety context only.

### Attachment Metadata And Blob Export Handling

Files inspected:

- `frontend/src/lib/attachmentRepository.ts`
- `frontend/src/lib/exportVaultBackup.ts`
- `frontend/src/lib/vaultBackupZip.ts`

Current behavior:

- AttachmentMetadata is separate from AttachmentBlobRecord.
- BlobStorageAdapter exposes blob put/get/delete/object-url/list helpers.
- current VaultBackupManifest does not include attachment repository inventory.
- current vaultBackupZip does not write attachment blob payload sidecars.

Candidate hook implication:

- diagnostic markers may continue to say attachment metadata and blobs are absent from current export metadata.
- Level 3 blob support must not be claimed.

Output-neutral risk:

- any attachment inventory read or blob operation would widen scope beyond K-244 diagnostic hook.

K-244 implication:

- no attachment metadata export change.
- no attachment blob movement.
- provider-aware recovery remains non-goal.

## Candidate Hook Locations

### Option A: Before Export Metadata Assembly

Pros:

- can run before payload-bearing manifest exists.

Cons:

- low access to final counts/manifest.
- may require duplicate data derivation.
- may drift from current export logic.

Decision:

- not preferred unless export metadata becomes unavailable later.

### Option B: After Current VaultBackupManifest Is Assembled, Before ZIP Write

Pros:

- preferred if source confirms metadata is complete.
- diagnostic helper can use existing metadata.
- avoids duplicate count/folder/note derivation.
- output-neutral if result is not written.

Cons:

- must guard against manifest mutation.
- must guard against return-shape changes.

Decision:

- preferred K-244 path.

### Option C: After ZIP Entries Are Assembled, Before Final Write/Download

Pros:

- useful for output-neutral byte/entry comparison in tests.

Cons:

- riskier if hook touches the archive object.
- too late for clean metadata mapping.
- unnecessary for K-241 helper input.

Decision:

- not preferred for production hook.
- useful only for tests that compare output before/after.

### Option D: Test-Only Export Metadata Harness

Pros:

- safest if export path is too coupled.
- no production export hook.

Cons:

- less real integration confidence.
- K-241 helper remains outside the real export path.

Decision:

- fallback if Option B implementation cannot preserve output shape.

## Chosen Hook Plan

K-243 chooses Option B as the preferred K-244 path.

Exact function/file candidate:

- `frontend/src/lib/exportVaultBackup.ts`
- candidate position: immediately after `buildVaultBackupManifestV3` constructs the current VaultBackupManifest and before any JSON/ZIP writer consumes that manifest.

Diagnostic helper input mapping:

- pass the assembled VaultBackupManifest as `vaultManifest`.
- default to diagnostic-manifest / 0.
- use createdAt / backupId overrides only if tests require deterministic diagnostics.
- do not request core-data / 1 unless K-244 explicitly justifies that core-data claim.
- do not request Level 2/3/4 scopes.

Helper calls:

- call createLocalFirstBackupManifest through existing K-241 helper.
- call validateLocalFirstBackupManifest through existing K-241 helper.
- do not call generator/validator directly from export path while bypassing K-241 scope hardening.

Output behavior:

- do not write diagnostic output into ZIP.
- do not alter manifest.json.
- do not add sidecar.
- do not alter export return shape unless an existing internal-only diagnostic extension point is found and documented.
- do not change import/restore.

If implementation cannot stay output-neutral:

- K-244 should downgrade to Option D: test-only export metadata harness.

## Output-Neutral Proof Plan

Mandatory K-244 proof if implementation proceeds:

- ZIP entry list before/after unchanged.
- manifest.json byte content or parsed shape unchanged.
- no sidecar file appears.
- export result shape unchanged.
- importVaultBackup tests still pass.
- vaultRestorePipeline tests still pass if present.
- helper does not mutate input metadata.
- no generated artifacts committed.
- no package/Vite/dependency changes.

Stable proof preference:

- compare ZIP entry lists.
- parse manifest.json before/after and assert structural equality.
- assert no `local-first-manifest.json`.
- assert no `diagnostic-manifest.json`.
- assert no `localFirstBackupManifest` field in manifest.json.
- assert no `backupKind` field in manifest.json.

Byte comparison note:

- byte-for-byte ZIP comparison may be unstable because archive metadata or compression details can vary.
- parsed manifest equality plus ZIP entry equality is acceptable if byte comparison proves flaky.

## Helper Result Usage Plan

Diagnostic result usage:

- diagnostic result may be used for tests/internal diagnostics only.
- no user-visible UI in K-244.
- no ZIP artifact output in K-244.
- no manifest.json field added in K-244.
- no sidecar file in K-244.
- hard-fail behavior must be minimal.

No new user options:

- no settings toggle.
- no backup dialog copy change.
- no background export behavior.
- no route/navigation change.

## Hard-Fail Versus Warning Plan

Hard-fail candidates:

- credentials/tokens/secrets detected.
- destructiveWholeVaultReplaceAllowed true.
- invalid backupKind/scopeLevel.
- Level 2/3/4 escalation.
- raw blob payload embedded.
- generated/dev-test artifacts included.
- unsafe override escalation.

Warnings/diagnostic-only:

- checksum not computed.
- optional domain gaps.
- attachment blob payload not included under diagnostic/core-data scope.
- provider metadata unresolved.
- schema/app version unknown if current export metadata cannot provide it.
- domain counts incomplete.

Decision:

- K-244 should only hard-fail privacy/security and scope-escalation cases if tests prove errors do not leak sensitive values.
- Otherwise K-244 should keep results test-only.
- Compatibility warnings must not block export.

## Export Result Shape Preservation

K-244 must preserve:

- export function return type unchanged unless source already has an internal diagnostic extension point.
- exported ZIP/blob/file output unchanged.
- existing callers require no updates.
- no UI notification introduced.
- no new options exposed to users.
- no background export behavior introduced.

If a diagnostic result must be returned:

- stop and create a new plan first.
- do not sneak an API shape change into the hook PR.

## ZIP Manifest.json Preservation

Rules:

- existing manifest.json remains the package contract.
- K-244 must not replace manifest.json.
- K-244 must not nest LocalFirstBackupManifest inside manifest.json.
- K-244 must not add a local-first sidecar file.
- sidecar/wrapper requires later separate plan.
- VaultBackupManifest v3 remains unchanged.

Required tests:

- manifest.json parses as VaultBackupManifest.
- manifest.json does not include local-first fields.
- ZIP entry list does not include local-first sidecar names.

## Import/Restore Preservation

K-244 must preserve:

- importVaultBackup unchanged.
- vaultRestorePipeline unchanged.
- backupBeforeRestore unchanged.
- no restore preview change.
- no restore/import mutation.
- per-item skip / duplicate / replace remains distinct from destructive whole-vault restore.
- destructive whole-vault restore remains forbidden as early/default path.

Import/restore tests:

- importVaultBackup tests pass.
- vaultBackupZip parse tests pass.
- vaultRestorePipeline tests pass if present.

## Attachment Boundary

K-244 must preserve:

- must not claim Level 3 blob support.
- must not copy/delete/upload/download attachment blobs.
- must not change attachment metadata export.
- diagnostic markers can state metadata-only/core-data limitations.
- provider-aware recovery remains non-goal.
- Google Drive appDataFolder QA remains separate and externally blocked.

Any future attachment packaging work requires a separate attachment backup plan.

## Security/Privacy Guardrails

Required guardrails:

- key-level and value-level guards remain required.
- nested arrays/objects recursively inspected.
- safe createdAt / backupId overrides remain the only allowed overrides.
- no broad manifestInputOverrides.
- errors must not include secret values.
- no Supabase imports.
- no Google Drive/OAuth imports.
- no fetch/network.
- no IndexedDB/localStorage reads/writes beyond current export behavior, if any.
- no credentials/tokens/secrets/session cookies.
- no generated/dev-test artifacts.

K-244 source audit must confirm:

- helper isolation remains.
- export hook does not import remote providers.
- export hook does not read attachment blobs.
- export hook does not call background jobs.

## K-244 Recommendation

Recommended primary next milestone:

**K-244 Local Backup Manifest Export Diagnostic Hook**

Scope:

- implementation.
- wire K-241 helper at chosen output-neutral hook point.
- do not change ZIP output.
- do not change manifest.json.
- no sidecar.
- no import/restore changes.
- prove output-neutrality with tests.
- hard-fail only privacy/security/scope escalation if safe.

Reason:

- Option B is source-grounded.
- `buildVaultBackupManifestV3` already has the assembled VaultBackupManifest needed by the K-241 helper.
- K-241/K-242 closed scope hardening, override hardening, and output-neutral helper boundaries.
- K-243 defines the required proof before implementation.

Fallback:

**K-244 Local Backup Manifest Export Diagnostic Harness**

Scope:

- test-only.
- simulate export metadata.
- prove helper mapping and output-neutral assumptions before production hook.

Alternative:

**K-244 VaultBackupManifest Export Hook Compatibility Audit**

Scope:

- docs/audit only.
- deeper source grounding if export/import coupling proves riskier during implementation review.

## Non-Goals

- no runtime export hook in K-243.
- no exportVaultBackup behavior change.
- no ZIP output change.
- no manifest.json replacement/change.
- no ZIP sidecar.
- no VaultBackupManifest type change.
- no backup/export payload changes.
- no restore/import mutation.
- no importVaultBackup change.
- no vaultRestorePipeline change.
- no backupBeforeRestore change.
- no schema migration.
- no IndexedDB migration.
- no Supabase sync changes.
- no Google Drive changes.
- no OAuth changes.
- no attachment remote upload/recovery changes.
- no attachment blob movement.
- no background sync/upload.
- no auto backup.
- no destructive whole-vault restore.
- no conflict resolver.
- no UI implementation.
- no route/navigation changes.
- no Health/Schedule behavior changes.
- no Notes/Cosmos changes.
- no assets/fonts/dependencies.
- no Google Drive QA work.

## Closure Statement

K-243 plans the hook but does not implement it.

K-241 helper remains output-neutral and unwired.

ZIP manifest.json and VaultBackupManifest v3 remain unchanged.

Import/restore behavior remains unchanged.

K-244 must prove output-neutrality before any production export hook is accepted.

Local runtime data remains source of truth.

Remote systems remain support layers.
