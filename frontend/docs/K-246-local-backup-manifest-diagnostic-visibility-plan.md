# K-246 Local Backup Manifest Diagnostic Visibility Plan

K-246 plans whether and how local backup manifest diagnostics should become visible later.

K-246 is docs/plan plus audit test only. K-246 does not expose diagnostics, does not implement UI, does not implement developer console/logging, does not change export result shape, does not change public API, does not change ZIP output, does not change `manifest.json`, does not add sidecar output, and does not change import/restore behavior.

K-246 chooses the K-247 path without changing runtime behavior.

## Current State Summary

- K-238 generator/validator exists.
- K-241 diagnostic helper exists.
- K-244 output-neutral export hook exists.
- K-245 closed the hook boundary.
- The diagnostic result is internal/ignored.
- The diagnostic result is not returned publicly.
- The diagnostic result is not written to ZIP.
- The diagnostic result is not written to `manifest.json`.
- The diagnostic result is not written as sidecar.
- The diagnostic result is not shown in UI.
- The diagnostic result is not connected to import/restore.
- ZIP `manifest.json` and `VaultBackupManifest` v3 remain the current artifact contract.
- Local runtime data remains source of truth.
- Remote systems remain support layers.

## Visibility Options

### Option A: Keep Diagnostics Internal/Test-Only

Diagnostics remain internal or test-only.

There is no user surface, no developer surface, no output change, no export API change, no ZIP artifact change, no log output, and no import/restore connection.

This is the safest option.

### Option B: Developer-Only Diagnostic Harness

Diagnostics become visible only in tests or dev-only tooling.

There is no production UI, no export artifact change, no public export result shape change, and no log/console output. This can help CI/audit workflows prove category-only diagnostics and redaction rules.

This is the preferred first visibility path if the project needs more evidence than internal-only tests.

### Option C: Maintenance/Diagnostics UI Plan

A future maintenance or diagnostics surface could show redacted diagnostic summaries.

This requires UX review, privacy review, and wording review. It is higher risk because users may mistake diagnostics for backup/restore guarantees.

### Option D: Export Result Metadata

Diagnostics could be attached to internal return metadata or a developer API.

This risks public API shape changes and is not recommended until the export result contract is explicitly planned.

### Option E: ZIP Sidecar Or Manifest Extension

Diagnostics could be written into a backup artifact as a sidecar or manifest extension.

This risks compatibility and privacy. It is not recommended now.

### Option F: Logging/Console

Diagnostics could be emitted to logs or console output.

Logs are not safe by default and may leak sensitive values. This is not recommended unless redaction is separately proven and the output is opt-in/dev-only.

## Chosen Visibility Path

K-246 chooses Option B as the primary future path: Developer-only diagnostic harness planning.

K-247 should not expose diagnostics to users or backup artifacts yet. Diagnostics should remain internal/test-only unless a developer-only harness is explicitly planned and proven safe.

K-247 should preserve:

- no ZIP artifact changes
- no `manifest.json` changes
- no sidecar
- no public export result shape changes
- no user UI
- no console/log output
- no import/restore validation connection

If the project needs visibility, it should start with a developer-only harness, not user UI or artifact output.

## Hard Failures Versus Warnings Visibility

Future visibility may summarize hard failures by category only:

- credentials/tokens/secrets detected
- `destructiveWholeVaultReplaceAllowed` true
- invalid `backupKind` / `scopeLevel`
- Level 2/3/4 escalation
- raw blob payload embedded
- generated/dev-test artifacts included
- unsafe override escalation

Future visibility may summarize warnings by category/count only:

- checksums not computed
- optional domain gaps
- attachment blob payload not included under diagnostic/core-data scope
- provider metadata unresolved
- schema/app version unknown
- domain counts incomplete

Visibility rules:

- hard failures may be summarized by category only
- warnings may be summarized by category/count only
- never show secret values
- never show raw record content
- never show raw note content
- never show raw attachment payloads
- never show OAuth/session/provider credentials
- errors should identify safe path/category only

## Privacy/Redaction Policy

Diagnostic visibility must be redacted by default.

Show categories, not values. Show counts, not content. Show domain names, not payload.

Do not show token-like substrings. Do not show `accessToken`, `refreshToken`, `idToken`, or `clientSecret` values. Do not show Supabase service keys. Do not show Google Drive OAuth material. Do not show session cookies. Do not show raw blob data URLs. Do not show generated HTML/dev-test artifact content. Do not show real user email/id unless an explicit future policy approves it.

Logs are not safe by default.

## Export Artifact Boundary

K-247 should not write diagnostics into ZIP.

K-247 should not write diagnostics into `manifest.json`.

K-247 should not add a sidecar.

K-247 should not write a local-first manifest artifact.

`VaultBackupManifest` v3 remains the artifact contract. Sidecar/wrapper work requires a separate future plan. Artifact evolution must preserve import compatibility.

## Export Result/API Boundary

The export return shape remains unchanged for now.

Public API should not grow diagnostic fields without a plan. If future internal diagnostics are returned, they must be internal-only and type-safe. The current K-244 hook result remains ignored/internal.

K-247 should avoid export result shape changes.

## UI/Maintenance Boundary

K-247 should not implement UI unless a separate plan approves it.

If UI is considered later, it should be maintenance/diagnostics-only. UI must show redacted summary only. UI must not expose raw note data, attachment data, tokens, provider data, or manifest payloads.

UI must distinguish hard failures from warnings. UI must not imply backup/restore safety beyond what is validated. UI should not encourage destructive restore.

## Logging Boundary

K-247 should add no console/log output.

Logs are not safe by default. If future dev logging is added, it must be opt-in/dev-only. Log messages must not include values. Log messages must not include raw manifest JSON. CI/test output should avoid secrets.

## Import/Restore Boundary

K-247 should add no import/restore validation connection.

There should be no restore preview change, no restore/import mutation, no `importVaultBackup` change, no `vaultRestorePipeline` change, and no `backupBeforeRestore` change.

Per-item `skip`, `duplicate`, and `replace` remain distinct from destructive whole-vault restore. Destructive whole-vault restore remains forbidden as an early/default path.

## Attachment Boundary

K-247 should make no attachment blob export claim and no Level 3 support claim.

There should be no blob movement, copy, upload, download, delete, provider-aware recovery, or attachment sync change.

Diagnostic visibility may mention attachment marker warnings only. Google Drive appDataFolder QA remains separate and externally blocked.

## K-247 Recommendation

Recommended next milestone: K-247 Local Backup Manifest Diagnostic Harness Plan.

Scope:

- docs/plan or test-only
- define a developer/test-only diagnostic harness
- no UI
- no ZIP/manifest output
- no export result shape change
- no import/restore validation

Alternative: K-247 Local Backup Manifest Diagnostic Test Hardening.

Scope:

- test-only
- strengthen redaction/category-only assertions
- no behavior/output change

Alternative: K-247 Local Backup Manifest Diagnostic Visibility Closure Audit.

Scope:

- docs/audit only
- close visibility decision if no exposure is needed now

Not recommended yet:

- user-facing maintenance UI
- ZIP sidecar
- `manifest.json` extension
- export result metadata
- logging/console output

## Non-Goals

- no diagnostic exposure in K-246
- no UI implementation
- no developer console/logging implementation
- no export result shape change
- no public API change
- no ZIP output change
- no `manifest.json` replacement/change
- no local-first manifest written to ZIP
- no ZIP sidecar
- no `VaultBackupManifest` type change
- no backup/export payload changes
- no restore/import validation
- no restore/import mutation
- no `importVaultBackup` change
- no `vaultRestorePipeline` change
- no `backupBeforeRestore` change
- no schema migration
- no IndexedDB migration
- no Supabase sync changes
- no Google Drive changes
- no OAuth changes
- no attachment remote upload/recovery changes
- no attachment blob movement
- no background sync/upload
- no auto backup
- no destructive whole-vault restore
- no conflict resolver
- no route/navigation changes
- no Health/Schedule behavior changes
- no Notes/Cosmos changes
- no assets/fonts/dependencies
- no Google Drive QA work

## Closure Statement

K-246 plans visibility but does not expose diagnostics.

Diagnostics remain internal/ignored unless a future milestone changes it. Backup artifacts, `manifest.json`, sidecar, export result shape, import/restore path, UI, and logs remain unchanged.

Any future diagnostic visibility must be redacted/category-only and separately approved. Local runtime data remains source of truth. Remote systems remain support layers.
