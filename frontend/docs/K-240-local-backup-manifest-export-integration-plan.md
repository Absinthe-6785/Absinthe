# K-240 Local Backup Manifest Export Integration Plan

## Purpose

K-240 chooses the first safe export integration path for the K-238 local-first manifest generator/validator.

K-240 is docs/plan only.

K-240 does not change export behavior.

K-240 does not replace ZIP manifest.json.

K-240 does not change restore/import behavior.

K-240 defines K-241 implementation scope.

## Current State Summary

Source-verified prior milestones:

- K-238 `localFirstBackupManifest` generator/validator exists.
- K-238 is metadata-only.
- K-238 enforces key-level and value-level privacy guards.
- K-238 recursively inspects nested arrays and objects for obvious credential/token/secret-like values.
- K-238 validates backupKind/scopeLevel mapping.
- K-239 concluded direct ZIP manifest.json replacement is not recommended.
- Existing `VaultBackupManifest` v3 remains unchanged.
- Existing ZIP manifest.json remains unchanged.
- Existing `importVaultBackup` and `vaultRestorePipeline` behavior remains unchanged.
- local runtime data remains source of truth.
- remote systems remain support layers.

## Source Inspection Findings

### localFirstBackupManifest

File inspected: `frontend/src/lib/localFirstBackupManifest.ts`.

Current behavior:

- exports `createLocalFirstBackupManifest`.
- exports `validateLocalFirstBackupManifest`.
- defines `LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL`.
- maps `diagnostic-manifest` to `0`.
- maps `core-data` to `1`.
- maps `full-content-metadata` to `2`.
- maps `full-content-with-blobs` to `3`.
- maps `provider-aware-recovery` to `4`.
- creates metadata-only local-first manifest objects from explicit input.
- validates forbidden keys, raw blob data URLs, credential-like string values, generated artifacts, attachment scope, compatibility, and privacy markers.
- does not import export, ZIP, import, restore, persistence, Supabase, OAuth, Google Drive, or attachment blob adapters.

Plan implication:

- safe to call from an export-adjacent diagnostic helper if output shape is unchanged.
- not safe to treat as a ZIP manifest.json replacement.

Risk for K-241:

- mapping current export metadata into K-238 fields must not claim domains or blob scopes that the export does not actually include.

### exportVaultBackup

File inspected: `frontend/src/lib/exportVaultBackup.ts`.

Current behavior:

- defines `VaultBackupManifest`.
- builds current v3 portable vault manifests with `buildVaultBackupManifestV3`.
- filters deleted notes.
- serializes active notes and folders into payload-bearing backup entries.
- includes optional extensions, scope, content fingerprint, and optional cloud block.
- `downloadVaultBackup` writes the current manifest as JSON.

Plan implication:

- K-241 may construct diagnostic local-first metadata after `VaultBackupManifest` is assembled.
- K-241 must not alter `downloadVaultBackup` output.

Risk for K-241:

- current export contains user content, while K-238 local-first diagnostic metadata should not leak sensitive values in validation errors.

### VaultBackupManifest

File inspected: `frontend/src/lib/exportVaultBackup.ts`.

Current behavior:

- `VaultBackupManifest` is the current implementation-facing backup contract.
- current schema version is `VAULT_BACKUP_SCHEMA_VERSION`.
- current source-verified schema version is `3`.
- current export kind is `VAULT_EXPORT_KIND`.
- current source-verified export kind is `absinthe-vault-export`.
- fields include `schemaVersion`, optional `kind`, `exportedAt`, `app`, `appVersion`, counts, folders, notes, optional extensions, optional scope, optional fingerprint, and optional cloud block.

Plan implication:

- `VaultBackupManifest` v3 remains the current ZIP manifest contract.
- `LocalFirstBackupManifest` remains diagnostic/integration metadata first.

Risk for K-241:

- direct type merging would blur payload-bearing export data with metadata-only local-first validation.

### ZIP manifest.json generation

File inspected: `frontend/src/lib/vaultBackupZip.ts`.

Current behavior:

- `buildVaultBackupZip` writes `manifest.json` from the current `VaultBackupManifest`.
- ZIP also writes `README.txt`.
- ZIP writes note Markdown sidecars under `notes/`.
- ZIP may write cloud CSV sidecars under `cloud/`.
- `parseVaultBackupZip` reads `manifest.json` and normalizes it as `VaultBackupManifest`.

Plan implication:

- K-241 must preserve ZIP compatibility by leaving manifest.json unchanged.
- K-241 must not add a sidecar file in the first implementation.

Risk for K-241:

- any package shape change risks import compatibility and must be a separate plan.

### importVaultBackup

File inspected: `frontend/src/lib/importVaultBackup.ts`.

Current behavior:

- parses JSON into `VaultBackupManifest`.
- validates current manifest shape for restore preview.
- builds restore preview counts and conflict lists.
- defines per-item conflict strategies `skip`, `replace`, and `duplicate`.
- applies selected notes/folders only when restore execution is requested.

Plan implication:

- K-241 must not change import parsing or restore preview.
- K-241 must keep per-item replace distinct from destructive whole-vault restore.

Risk for K-241:

- adding local-first validation to import prematurely could imply unsupported restore semantics.

### vaultRestorePipeline

File inspected: `frontend/src/lib/vaultRestorePipeline.ts`.

Current behavior:

- builds full restore previews from `VaultBackupManifest`.
- executes selected restore with `strategy`, `selection`, `restoreCore`, `restoreExtensions`, `restoreCloud`, and `backupBeforeRestore`.
- records last vault export in localStorage through `recordLastVaultExport`.

Plan implication:

- K-241 must not touch restore pipeline.
- K-241 must not introduce restore preview or mutation.

Risk for K-241:

- export diagnostics should not become a restore readiness signal.

### backupBeforeRestore

File inspected: `frontend/src/lib/vaultRestorePipeline.ts`.

Current behavior:

- `VaultRestorePipelineOptions` includes `backupBeforeRestore`.
- `executeVaultRestorePipeline` creates a last snapshot when `backupBeforeRestore` is true.

Plan implication:

- K-241 does not change `backupBeforeRestore`.
- backup-before-restore remains safety context only.

Risk for K-241:

- no export diagnostic outcome should weaken the destructive restore boundary.

### attachment export behavior

Files inspected:

- `frontend/src/lib/attachmentRepository.ts`.
- `frontend/src/lib/exportVaultBackup.ts`.
- `frontend/src/lib/vaultBackupZip.ts`.

Current behavior:

- `AttachmentMetadata` is separate from `AttachmentBlobRecord`.
- attachment metadata and blob payloads have separate repository/adapter concepts.
- current `VaultBackupManifest` does not directly include attachment repository inventory.
- current ZIP export writes manifest, README, notes, and optional cloud CSV sidecars.
- current source inspection did not find attachment blob payload sidecar export in `vaultBackupZip.ts`.

Plan implication:

- K-241 diagnostic metadata must not claim attachment blob payload inclusion.
- attachment metadata markers should remain diagnostic-only until source-grounded.

Risk for K-241:

- overclaiming Level 3/full-content-with-blobs would misrepresent backup completeness.

## Integration Options

### Option A: Diagnostic-only export integration

Shape:

- export path constructs local-first manifest metadata.
- validator runs.
- results are logged/reported internally or returned to tests.
- ZIP output remains unchanged.
- no sidecar file added.
- no import compatibility impact.

Pros:

- safest first implementation.
- no ZIP shape change.
- no import risk.
- validates privacy/security boundary.
- gives K-238 generator its first export-adjacent use without changing backup artifacts.

Cons:

- local-first manifest is not yet part of backup artifact.
- user-visible backup package remains unchanged.

### Option B: ZIP sidecar manifest

Shape:

- keep existing manifest.json unchanged.
- add local-first manifest as a separate sidecar file.
- import ignores sidecar until future support.

Pros:

- preserves existing manifest.json compatibility.
- stores local-first metadata in package.

Cons:

- ZIP shape changes.
- import behavior must tolerate sidecar.
- versioning/documentation required.
- package tests must prove no older import path breaks.

### Option C: Wrapper/nested manifest

Shape:

- existing manifest.json wraps or nests `localFirstBackupManifest`.
- import remains compatible only if parser tolerates the new field.

Pros:

- single manifest source.
- clearer long-term direction.

Cons:

- higher compatibility risk.
- requires import parser audit.
- risks confusing payload-bearing `VaultBackupManifest` with metadata-only local-first manifest.

### Option D: Direct manifest.json replacement

Shape:

- replace current `VaultBackupManifest`/manifest.json with `LocalFirstBackupManifest`.

Pros:

- clean future model.

Cons:

- high risk.
- not recommended now.
- could break import/restore compatibility.
- requires parser, preview, and compatibility migration work.

K-240 choice:

**Option A: diagnostic-only export integration first.**

## Chosen First Path

K-241 should implement diagnostic-only export integration first.

Justification:

- current ZIP import requires manifest.json to normalize as `VaultBackupManifest`.
- direct replacement would be risky.
- sidecar and wrapper approaches both change artifact shape.
- diagnostic-only integration validates K-238 mapping and privacy behavior without changing backup output.
- existing users see no export/import behavior change.

Chosen constraints:

- no ZIP output shape change.
- no manifest.json replacement.
- no sidecar file yet.
- no import/restore behavior change.
- export path may construct local-first manifest metadata and validate it.
- hard fail only for privacy/security violations if implementation can guarantee no sensitive value leakage.
- otherwise validation result should remain test/diagnostic-only.
- output should not include secrets or user content in errors.

## K-241 Exact Implementation Boundary

Candidate milestone:

**K-241 Local Backup Manifest Export Diagnostic Integration**

Scope:

- implementation.
- call `createLocalFirstBackupManifest` from export path or an export-adjacent helper.
- call `validateLocalFirstBackupManifest`.
- do not change ZIP payload shape.
- do not replace manifest.json.
- do not add ZIP sidecar.
- do not alter `importVaultBackup`.
- do not alter `vaultRestorePipeline`.
- no restore/import mutation.
- no persistence mutation.
- no Supabase/OAuth/Google Drive/attachment sync changes.
- no attachment blob movement.

Fallback:

- if export path cannot safely call the generator without behavior change, K-241 should become **Local Backup Manifest Export Diagnostic Harness**, test-only.

## Validator Call Timing

Options:

1. Before ZIP manifest creation.
2. After current manifest metadata is assembled.
3. After ZIP package assembly but before write.
4. Test-only simulation.

Recommendation:

- prefer after current export metadata is assembled but before ZIP write, if implementation can avoid output changes.
- otherwise use test-only simulation first.
- validation should not mutate export data.
- validation should not alter generated JSON.
- validation should not add files to ZIP.
- validation should not read or write persistence.

## Failure Behavior

Hard fail only for:

- credentials/tokens/secrets detected.
- `destructiveWholeVaultReplaceAllowed` true.
- invalid backupKind/scopeLevel.
- raw blob payload embedded in manifest JSON.
- generated/dev-test artifacts included.

Warnings only for:

- unsupported optional domains.
- attachment blob payload missing when scope is metadata-only.
- provider metadata unresolved.
- checksums not computed.
- compatibility hints incomplete.

Diagnostic-only initially for:

- schemaVersion unknown.
- appVersion unknown.
- optional source metadata absent.
- domain count limitations.

Rules:

- errors must identify path/key/category, not secret value.
- privacy failures must not print detected sensitive values.
- validation must not trigger restore/import mutation.
- validation must not trigger remote writes.
- validation must not trigger background jobs.

## ZIP Compatibility Preservation

K-241 must preserve ZIP compatibility:

- K-241 must not alter ZIP manifest.json.
- K-241 must not add sidecar unless a later plan explicitly chooses that path.
- K-241 must not break `importVaultBackup`.
- K-241 must not require import parser changes.
- K-241 must keep `VaultBackupManifest` v3 intact.
- K-241 must not claim `LocalFirstBackupManifest` replaces existing manifest.

## VaultBackupManifest v3 Relationship

Current relationship:

- existing `VaultBackupManifest` v3 remains current ZIP manifest contract.
- local-first manifest remains diagnostic/integration metadata first.

Future sidecar/wrapper plan may map:

- `VaultBackupManifest` version -> `manifestVersion` / `formatVersion` / `schemaVersion`.
- current note/task/settings counts -> `domains` / `counts`.
- current attachment metadata -> attachment markers.
- current import strategy data -> compatibility hints.
- current scope/exclusion block -> domain and privacy markers.
- current content fingerprint -> integrity markers after checksum policy is explicit.

Policy:

- direct replacement requires separate compatibility plan.
- local-first manifest must not become artifact contract until import compatibility is specified.

## Attachment Blob Scope Boundary

K-241 constraints:

- K-241 must not claim Level 3 unless actual blob payload export is source-verified and included.
- K-241 must not copy attachment blobs.
- K-241 must not delete attachment blobs.
- K-241 must not upload attachment blobs.
- K-241 must not download attachment blobs.
- K-241 must not alter attachment sync.
- attachment metadata markers may be diagnostic-only.
- blob payload inclusion must remain false unless explicitly proven.
- provider-aware recovery remains non-goal.
- Google Drive appDataFolder QA remains separate and externally blocked.

## Import/Restore Boundary

K-241 constraints:

- K-241 must not change `importVaultBackup`.
- K-241 must not change `vaultRestorePipeline`.
- K-241 must not change `backupBeforeRestore`.
- K-241 must not introduce restore preview.
- K-241 must not introduce restore mutation.
- per-item `skip`, `duplicate`, and `replace` remains distinct from destructive whole-vault restore.
- destructive whole-vault restore remains forbidden as early/default path.

## Security/Privacy Boundary

Requirements:

- no credentials/tokens/secrets in manifest or validation errors.
- value-level secret guard remains required.
- nested arrays/objects remain recursively inspected.
- raw blob data URL guard remains required.
- generated artifact exclusion remains required.
- no Supabase service role keys.
- no Google Drive OAuth material.
- no session cookies.
- no network calls.
- no background jobs.
- no validation error should print the detected secret value.

## K-241 Acceptance Criteria Preview

K-241 should be accepted only if:

- `createLocalFirstBackupManifest` invoked only in export diagnostic path or test harness.
- `validateLocalFirstBackupManifest` invoked.
- ZIP output unchanged.
- manifest.json unchanged.
- no sidecar added.
- import tests unchanged/pass.
- privacy hard-fail tests added.
- invalid backupKind/scopeLevel still rejected.
- no attachment blob movement.
- no restore/import mutation.
- no persistence mutation.
- no remote behavior changes.
- no package dependency changes.

## Non-Goals

- no export behavior change in K-240.
- no K-238 generator changes unless documentation-only reference.
- no ZIP manifest.json replacement.
- no ZIP sidecar implementation.
- no VaultBackupManifest type change.
- no backup/export payload implementation.
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

K-240 chooses diagnostic-only export integration as the safest first implementation path unless source inspection disproves it.

Existing ZIP manifest.json and VaultBackupManifest v3 remain the current backup package contract.

LocalFirstBackupManifest remains diagnostic/validation metadata before becoming an artifact contract.

ZIP sidecar/wrapper/replacement requires a separate future plan.

Local runtime data remains source of truth.

Remote systems remain support layers.
