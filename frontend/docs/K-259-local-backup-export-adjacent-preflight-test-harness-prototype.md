# K-259 Local Backup Export-adjacent Preflight Test Harness Prototype

K-259 implements a pure/test-only export-adjacent metadata fixture builder.

The prototype feeds safe metadata into the existing K-256 preflight harness. It does not wire anything into production export runtime, does not add export blocking, does not add UI, does not add logging, does not change ZIP output, does not change `manifest.json`, does not add sidecar output, does not change export result shape, does not add import/restore validation, and does not change provider/blob behavior.

## Purpose

- add a pure/test-only export-adjacent metadata fixture builder.
- feed safe metadata into the existing K-256 preflight harness.
- return the existing redacted K-256 preflight summary shape.
- preserve category/count-only output.
- preserve lifecycle/output-neutrality.
- keep production export runtime unwired.

## Implementation Contract

- helper is pure.
- helper is deterministic.
- helper is side-effect-free.
- helper is test-only/dev-only by contract.
- helper is output-neutral.
- helper is not production-wired.
- helper calls `createLocalBackupExportPreflightDiagnosticTestHarnessSummary`.
- helper does not duplicate or bypass backupKind redaction.
- helper does not duplicate or bypass scopeLevel redaction.
- helper does not duplicate or bypass status semantics.
- helper does not duplicate or bypass lifecycle/output-neutrality flags.

## Allowed Metadata Categories

Allowed metadata categories:

The fixture builder accepts only safe export-adjacent metadata:

- counts: noteCount, folderCount, relationCount.
- diagnostics: hardFailureCategories, warningCategories, hardFailureCount, warningCount.
- scope: allowlisted backupKind and allowlisted scopeLevel.
- attachments: metadataOnly and blobPayloadIncluded coerced to false.
- compatibility: warningCategories and warningCount.
- lifecycle: persisted false, artifactWritten false, exportRuntimeWired false.

Allowed metadata is count/category/allowlist/lifecycle-only.

## Forbidden Raw Values

Forbidden raw values:

The fixture builder must not accept, read, propagate, or return:

- raw note content.
- raw attachment blob payloads.
- raw manifest JSON.
- raw ZIP payloads.
- tokens.
- secrets.
- credentials.
- provider session data.
- sensitive paths.
- stack traces.
- raw warning/failure messages.
- raw file contents.
- live provider data.
- live storage dumps.
- OAuth/session material.
- Supabase session material.
- Google Drive connection state values beyond redacted availability/category labels.

Unknown, malformed, future, or adversarial values must become `unknown`, category-only output, or be ignored rather than echoed.

## Output Shape

K-259 returns the existing K-256 redacted preflight summary shape:

- status: `pass | warning | hard-fail`.
- counts: hardFailures and warnings.
- summary: backupKind, scopeLevel, sourceCounts.
- hardFailures: category-only codes.
- warnings: category-only codes.
- attachmentSummary: metadata-only boundary with blobPayloadIncluded false.
- compatibilitySummary: category/count-only warning state.
- metadata: generatedFor test-harness, persisted false, artifactWritten false, exportRuntimeWired false.

No raw diagnostic values are returned.

## Status Semantics

K-259 uses existing K-256 status semantics:

- hard-fail if hard failures exist.
- warning if warnings exist and no hard failures.
- pass only when clean.
- warnings do not pass.
- hard failures and warnings remain category/count-only.
- production blocking is not implemented.

## Lifecycle And Output-neutrality

- persisted false.
- artifactWritten false.
- exportRuntimeWired false.
- result is ephemeral.
- result is not stored in IndexedDB.
- result is not stored in localStorage.
- result is not written to files.
- result is not written to logs.
- result is not written to backup artifacts.
- result is not returned from production export.
- result is not stored in app state.

## Runtime Boundary

K-259 does not:

- call `exportVaultBackup`.
- call `buildVaultBackupManifestV3`.
- call ZIP writers.
- call `importVaultBackup`.
- call `vaultRestorePipeline`.
- read/write storage.
- call network/provider APIs.
- log to console.
- mutate inputs.
- read attachment blobs.
- wire into production export runtime.
- add export blocking.
- add import/restore validation.

## Export/Import/ZIP Boundary

- ZIP output remains unchanged.
- ZIP `manifest.json` remains unchanged.
- sidecar output remains absent.
- export result shape remains unchanged.
- import behavior remains unchanged.
- restore behavior remains unchanged.
- provider/blob behavior remains unchanged.
- backup/export payloads remain unchanged.
- `VaultBackupManifest` shape remains unchanged.

## Visibility Boundary

- no UI.
- no user-facing preflight.
- no developer panel.
- no maintenance UI.
- no export modal changes.
- no notification/toast.
- no console logging.
- no logger output.
- no public API exposure.
- no route/navigation change.

## Attachment/Provider Boundary

- no attachment blob export claim.
- no Level 3 support claim.
- `full-content-with-blobs` remains unsupported.
- `provider-aware-recovery` remains unsupported.
- no blob movement/copy/upload/download.
- no attachment sync change.
- no Supabase behavior change.
- no Google Drive/OAuth behavior change.
- no Google Drive QA work.

## Test Coverage

K-259 tests cover:

- clean export-adjacent metadata returns pass.
- warning-only metadata returns warning.
- hard-failure metadata returns hard-fail.
- hard failures and warnings are category/count-only.
- counts are copied safely.
- backupKind redaction is preserved.
- scopeLevel redaction is preserved.
- attachment metadata-only boundary.
- blobPayloadIncluded remains false.
- raw blob-like values are not returned.
- compatibility category/count boundary.
- lifecycle flags remain false.
- input object is not mutated.
- no console logging.
- raw token/secret/content/blob/path/stack/manifest/ZIP/provider/session strings do not appear in output.
- helper imports only the K-256 preflight harness.
- helper does not import export/ZIP/import/restore/UI/provider/storage/network modules.

## K-260 Recommendation

K-260 should be closure audit or export-adjacent integration boundary closure.

Recommended:

- K-260 Local Backup Export-adjacent Preflight Test Harness Closure Audit.
- K-260 Local Backup Export-adjacent Preflight Integration Boundary Closure Audit.

Not recommended yet:

- production export preflight.
- production export runtime wiring.
- user-facing UI.
- logging/console output.
- export result metadata.
- ZIP sidecar.
- `manifest.json` extension.
- import/restore validation.
- provider/blob behavior changes.

## Non-Goals

- no production export runtime wiring.
- no export blocking.
- no UI implementation.
- no logging.
- no developer console/logging implementation.
- no export result shape change.
- no export result shape changes.
- no public API change.
- no ZIP output change.
- no ZIP output changes.
- no `manifest.json` replacement/change.
- no `manifest.json` changes.
- no local-first diagnostic written to ZIP.
- no ZIP sidecar.
- no sidecar.
- no `VaultBackupManifest` type change.
- no backup/export payload changes.
- no export preflight production implementation.
- no import/restore validation.
- no restore/import validation.
- no restore/import mutation.
- no `exportVaultBackup` change.
- no `importVaultBackup` change.
- no `vaultRestorePipeline` change.
- no `backupBeforeRestore` change.
- no schema migration.
- no IndexedDB migration.
- no Supabase sync changes.
- no Google Drive changes.
- no OAuth changes.
- no attachment remote upload/recovery changes.
- no attachment blob movement.
- no provider/blob behavior.
- no persistence/network/remote/blob behavior change.
- no background sync/upload.
- no auto backup.
- no destructive whole-vault restore.
- no conflict resolver.
- no route/navigation changes.
- no Health/Schedule behavior changes.
- no Notes/Cosmos changes.
- no assets/fonts/dependencies.
- no package.json change.
- no vite config change.
- no Google Drive QA work.

## Closure Statement

K-259 adds a pure/test-only export-adjacent metadata fixture builder that delegates to the existing K-256 preflight harness.

The helper remains output-neutral and production-unwired. Output remains redacted category/count-only. Lifecycle flags remain false. Diagnostics remain unexposed to UI/logs/ZIP/manifest/export result/import/restore.

Production export preflight, production runtime wiring, UI, visibility, artifact evolution, import/restore validation, and provider/blob behavior changes require a separate milestone.
