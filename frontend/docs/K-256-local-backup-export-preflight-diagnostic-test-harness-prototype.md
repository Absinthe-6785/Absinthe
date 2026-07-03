# K-256 Local Backup Export Preflight Diagnostic Test Harness Prototype

K-256 implements a pure dev/test-only preflight diagnostic test harness prototype.

The harness uses synthetic fixture input first. It returns redacted category/count-only output. It does not wire into production export runtime, UI, logging, ZIP output, `manifest.json`, sidecar output, export return shape, import/restore behavior, or persistence/network/provider/blob behavior.

## Purpose

- implement the K-255 recommended harness prototype.
- keep the harness dev/test-only.
- reuse the existing local backup manifest diagnostic summary helper.
- use synthetic fixture input first.
- return explicit test-only output.
- keep output redacted and category/count-only.
- preserve output neutrality.

## Non-Goals

- no production export runtime wiring.
- no production preflight blocking.
- no UI.
- no logging.
- no console output.
- no ZIP output change.
- no `manifest.json` change.
- no sidecar output.
- no export return shape change.
- no export payload mutation.
- no import/restore behavior change.
- no import/restore validation.
- no persistence changes.
- no network/provider/blob behavior.
- no persistence/network/provider/blob behavior.
- no Google Drive/OAuth work.
- no Supabase work.
- no attachment upload/recovery work.

## Harness Contract

The K-256 harness wraps `createLocalBackupManifestDiagnosticSummary`.

It accepts synthetic fixture input:

- hard failure codes.
- warning codes.
- manifest scope metadata.
- source counts.
- attachment fixture metadata.
- compatibility fixture metadata.

It returns redacted output:

- status: `"pass" | "warning" | "hard-fail"`
- backupKind: `"diagnostic-manifest" | "core-data" | "unknown"`
- scopeLevel: `0 | 1 | "unknown"`
- source counts: note/folder/relation count semantics only.
- hard failures: category-only codes.
- warnings: category-only codes.
- attachment summary: metadata-only and `blobPayloadIncluded: false`.
- compatibility summary: warning count only.
- generatedFor: `"test-harness"`
- persisted: `false`
- artifactWritten: `false`
- exportRuntimeWired: `false`

## Status Semantics

Pass:

- no hard failures.
- no warnings.

Warning:

- no hard failures.
- one or more warning categories.

Hard-fail:

- one or more hard failure categories.
- hard-fail wins over warning.

The harness uses `hard-fail` as the export preflight label for the existing diagnostic helper's blocked status.

## Redaction Policy

The harness output must not include:

- raw diagnostic messages.
- raw note content.
- raw attachment content.
- raw manifest JSON.
- raw backupKind unknown values.
- raw scopeLevel malformed values.
- raw paths or stacks.
- tokens or secrets.
- OAuth/session material.
- provider credentials.
- data URLs.
- ZIP payload bytes.

Unsupported `backupKind` values become `unknown`.

Unsupported, future, string, object, null, and malformed `scopeLevel` values become `unknown`.

Compatibility and attachment details remain category/count-only. Raw unsupported domain names are not returned.

## Output Neutrality

The K-256 harness is not connected to export runtime.

It does not:

- call `exportVaultBackup`.
- call `vaultBackupZip`.
- call `importVaultBackup`.
- call `vaultRestorePipeline`.
- write files.
- write IndexedDB.
- write localStorage.
- fetch network resources.
- move, copy, upload, download, or delete blobs.
- import UI or routing modules.
- log to console.

ZIP output remains unchanged.

`manifest.json` remains unchanged.

No sidecar output is created.

Export return shape remains unchanged.

Import/restore behavior remains unchanged.

## Test Coverage

K-256 locks:

- pass fixture returns pass.
- warning fixture returns warning.
- hard-fail fixture returns hard-fail.
- hard-fail wins over warning.
- counts are preserved as counts.
- hard failures and warnings are category-only.
- backupKind allowlist preserves diagnostic-manifest/core-data.
- backupKind future/adversarial values become unknown.
- scopeLevel 0/1 pass through.
- scopeLevel strings, future levels, and malformed values become unknown.
- source counts map noteCount/folderCount/relationCount correctly.
- attachment summary remains metadata-oriented and never claims blob payload output.
- compatibility summary is count-only.
- lifecycle flags remain ephemeral and unwired.
- raw sensitive values are absent from stringified output.
- input objects are not mutated.
- no console logging occurs.
- source imports remain isolated from export/import/restore/ZIP/UI/provider/persistence/blob paths.

## K-257 Recommendation

K-257 should be a closure audit or integration boundary audit.

Recommended:

- K-257 Local Backup Export Preflight Diagnostic Test Harness Closure Audit.
- K-257 Local Backup Export Preflight Diagnostic Integration Boundary Audit.

Not recommended yet:

- production export preflight.
- user-facing UI.
- logging/console output.
- export result metadata.
- ZIP sidecar.
- `manifest.json` extension.
- import/restore validation.

## Closure Statement

K-256 adds a dev/test-only preflight diagnostic harness prototype.

The harness is synthetic fixture first, output-neutral, redacted, category/count-only, and unwired from production export/import/restore paths.

Any future production preflight, visibility, artifact, or restore-validation work requires a separate milestone.
