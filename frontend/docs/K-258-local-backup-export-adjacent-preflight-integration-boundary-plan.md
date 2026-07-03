# K-258 Local Backup Export-adjacent Preflight Integration Boundary Plan

K-258 plans the boundary for future export-adjacent preflight integration.

K-258 is docs/plan plus audit test only. K-258 does not implement export-adjacent preflight integration, does not wire preflight into production export runtime, does not expose diagnostics, does not add UI/logging, does not change ZIP/manifest/export/import/restore behavior, and chooses the K-259 next path.

## Purpose

- plan whether export-adjacent metadata may feed the test-only preflight harness.
- define safe metadata categories.
- define forbidden raw values.
- define the boundary relative to export runtime.
- preserve output-neutrality.
- choose the K-259 next path.
- keep K-258 docs/plan plus audit test only.
- K-258 does not implement export-adjacent preflight integration.
- K-258 does not wire preflight into production export runtime.
- K-258 does not expose diagnostics.
- K-258 does not add UI/logging.
- K-258 does not change ZIP/manifest/export/import/restore behavior.
- K-258 chooses the K-259 next path.

## Current State Summary

- K-244 output-neutral export diagnostic hook exists and remains internal/ignored.
- K-245 closed the hook.
- K-248 diagnostic harness/helper exists.
- backupKind redaction is closed.
- scopeLevel redaction is closed.
- K-253 closed consolidated harness hardening.
- K-254 selected dev/test-only preflight first.
- K-255 planned the test harness.
- K-256 implemented the pure/dev-test-only preflight diagnostic harness prototype.
- K-257 closed the K-256 prototype.
- diagnostic summary remains category/count-only.
- backupKind is `diagnostic-manifest` / `core-data` / `unknown`.
- scopeLevel is numeric `0` / `1` / `unknown`.
- Level 2 / 3 / 4 remain unsupported.
- preflight helper is not production export runtime wired.
- preflight result is not shown in UI.
- preflight result is not logged.
- preflight result is not written to ZIP.
- preflight result is not written to `manifest.json`.
- preflight result is not sidecar output.
- preflight result is not returned in export result shape.
- preflight result is not connected to import/restore validation.
- local runtime data remains source of truth.
- remote systems remain support layers.

## Boundary Choice

Chosen boundary:

- export-adjacent metadata may be used only in explicit dev/test harness contexts first.
- no automatic production export runtime.
- no user-facing preflight yet.
- no logging/visibility yet.
- no export blocking yet.
- no import/restore validation yet.

The next implementation, if approved, must remain pure/test-only and output-neutral until a later milestone separately proves production safety.

## Allowed Export-adjacent Metadata

Future test-only harness input may use safe export-adjacent metadata categories:

- manifest-level counts.
- note/folder/relation counts.
- diagnostic status category/counts.
- allowlisted backupKind.
- allowlisted scopeLevel.
- attachment metadata-only flags.
- compatibility warning counts/categories.
- lifecycle flags.

Allowed metadata must be explicitly constructed in tests or dev/test harness code. It must not require live export runtime execution, live storage reads, network/provider calls, or attachment blob reads.

## Forbidden Export-adjacent Data

Future export-adjacent preflight work must not feed or return:

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

Unknown, malformed, future, or adversarial metadata values must become `unknown` or category-only summaries rather than raw output.

## Output-neutrality Requirements

Future export-adjacent preflight work must not change:

- ZIP output.
- ZIP `manifest.json`.
- sidecar output.
- export result shape.
- import behavior.
- restore behavior.
- provider/blob behavior.
- backup/export payloads.
- `VaultBackupManifest` shape.

Preflight diagnostics must remain absent from backup artifacts unless a later artifact-evolution milestone explicitly approves a new contract.

## Runtime Boundary

Future export-adjacent preflight work must not add:

- production export auto-run.
- export blocking.
- UI.
- logs.
- console output.
- storage writes.
- network/provider calls.
- attachment blob reads.
- import/restore validation.
- restore blocking.
- background jobs.
- auto backup.

The production export path may be inspected by tests for source boundaries, but the preflight harness must not be called from production export runtime in K-258 or K-259 unless a later milestone explicitly changes the scope.

## Test-only Integration Shape

If K-259 implements a prototype, the integration shape should be:

- test-only fixture builder.
- explicit export-adjacent metadata object.
- no production export call.
- no export payload mutation.
- no import/restore call.
- no ZIP creation.
- no file write.
- no storage read/write.
- no network/provider/blob work.
- redacted category/count-only output.

The fixture builder may mirror safe count and allowlist fields from current export concepts, but it must not parse raw `manifest.json`, ZIP bytes, note bodies, attachment blobs, or provider sessions.

## Visibility Boundary

- no UI exposure.
- no developer panel exposure.
- no maintenance UI.
- no export modal changes.
- no notification/toast.
- no console logging.
- no logger output.
- no public API exposure.
- no route/navigation change.

Any future user-facing visibility requires a separate Data Safety / Backup Health plan with privacy review.

## Export/Import/ZIP Boundary

- `exportVaultBackup` behavior remains unchanged.
- ZIP output remains unchanged.
- `manifest.json` remains unchanged.
- sidecar remains absent.
- export result shape remains unchanged.
- `importVaultBackup` remains unchanged.
- `vaultRestorePipeline` remains unchanged.
- `backupBeforeRestore` remains unchanged.
- no restore/import mutation.
- no restore validation connection.
- per-item `skip`, `duplicate`, and `replace` remains distinct from destructive whole-vault restore.

## Attachment/Provider Boundary

- no attachment blob export claim.
- no Level 3 support claim.
- `full-content-with-blobs` remains unsupported.
- `provider-aware-recovery` remains unsupported.
- no blob movement/copy/upload/download.
- no attachment sync change.
- no Supabase behavior change.
- no Google Drive/OAuth behavior change.
- Google Drive appDataFolder QA remains separate and externally blocked.
- no Google Drive QA work.

## Security/Privacy Boundary

- hard failures remain category-only.
- warnings remain category/count-only.
- raw adversarial values must not appear in output.
- raw backupKind and scopeLevel values must not be echoed.
- fake test values may appear only in tests/docs.
- no real credentials/tokens/secrets may be introduced.
- no raw diagnostic/message/content/blob/path/stack leakage is allowed.
- no raw file contents may be captured.
- no live storage dump may be captured.
- no provider session value may be captured.

## K-259 Recommendation

Recommended next milestone:

K-259 Local Backup Export-adjacent Preflight Test Harness Prototype

Scope:

- test-only prototype.
- explicit export-adjacent metadata fixture builder.
- feed only allowed metadata into the existing test-only preflight harness.
- remain pure/test-only and output-neutral.
- no production export runtime wiring.
- no UI/logging.
- no ZIP/manifest/output changes.
- no import/restore validation.

Alternative:

K-259 Local Backup Export-adjacent Preflight Boundary Closure Audit

Scope:

- docs/audit plus audit test only.
- close K-258 before any prototype if the boundary still feels too broad.

Not recommended yet:

- production export preflight.
- user-facing UI.
- logging/console output.
- export result metadata.
- ZIP sidecar.
- `manifest.json` extension.
- import/restore validation.

## Non-Goals

- no export-adjacent preflight integration implementation in K-258.
- no preflight behavior change.
- no helper behavior change.
- no production export runtime wiring.
- no diagnostic exposure.
- no UI implementation.
- no developer console/logging implementation.
- no export result shape change.
- no public API change.
- no ZIP output change.
- no `manifest.json` replacement/change.
- no local-first diagnostic written to ZIP.
- no ZIP sidecar.
- no `VaultBackupManifest` type change.
- no backup/export payload changes.
- no export preflight production implementation.
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

K-258 plans the export-adjacent preflight integration boundary but does not implement it.

Export-adjacent metadata may be considered only for explicit dev/test harness contexts first. Allowed metadata is count/category/allowlist/lifecycle-only. Raw content, blobs, manifests, ZIP payloads, tokens, secrets, provider sessions, paths, stacks, raw messages, live provider data, and live storage dumps remain forbidden.

Production export preflight, export runtime wiring, UI, logging, artifact evolution, import/restore validation, and provider/blob behavior changes require a separate milestone.

Local runtime data remains source of truth. Remote systems remain support layers.
