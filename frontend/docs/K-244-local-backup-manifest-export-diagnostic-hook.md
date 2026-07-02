# K-244 Local Backup Manifest Export Diagnostic Hook

K-244 implements the K-243 Gate A plan as a narrow, output-neutral export-adjacent hook.

## Hook Location

The hook lives in `frontend/src/lib/exportVaultBackup.ts`.

`buildVaultBackupManifestV3` now assembles the existing `VaultBackupManifest` v3 object, attaches the optional cloud block when present, then calls `runVaultBackupManifestExportDiagnostic(manifest)` immediately before returning the manifest.

The diagnostic result is intentionally not written anywhere in K-244.

## Diagnostic Mapping

The hook calls `createLocalBackupManifestExportDiagnostic` from `localBackupManifestExportDiagnostic.ts`.

It maps the current export metadata into the K-241 diagnostic helper:

- `noteCount` -> `counts.notes`
- `folderCount` -> `counts.noteMetadata`
- `relationCount` -> `counts.noteRelationships`
- attachment metadata and blob payloads remain excluded
- default diagnostic scope remains `diagnostic-manifest` / `0`

## Output Neutrality

K-244 does not change the export artifact contract.

- no `VaultBackupManifest` fields were added
- no `manifest.json` replacement
- no local-first manifest sidecar
- no ZIP entry changes
- no import/restore behavior changes
- no UI changes
- no persistence, IndexedDB, localStorage, network, Supabase, OAuth, or Google Drive changes

The tests compare ZIP entry lists and parsed `manifest.json` before and after an explicit diagnostic run. Parsed equality is used because ZIP archive metadata and compression details are not part of the product contract.

## Hard-Fail Behavior

K-244 preserves the K-241 helper hard-fail classification for privacy/security/scope escalation:

- unsupported Level 2/3/4 scopes remain hard failures in the helper
- unsafe override escalation remains blocked in the helper
- credential-like values remain hard failures without leaking detected secret values
- raw blob payloads remain hard failures in the helper

The runtime export hook does not block or alter export output in K-244. The result is available for internal diagnostics and tests only.

## Attachment Boundary

K-244 does not claim Level 3 blob support.

The hook does not copy, delete, upload, download, enumerate, or recover attachment blobs. Attachment metadata and blob payload export remain outside this milestone.

## Verification

Required focused coverage:

- `localBackupManifestExportDiagnosticHook.test.ts`
- `localBackupManifestExportDiagnosticHookPlan.test.ts`
- `localBackupManifestExportDiagnosticClosureAudit.test.ts`
- `localBackupManifestExportDiagnostic.test.ts`
- local-first manifest spec/fixture/boundary tests
- export/import/ZIP/restore pipeline tests

K-245 recommendation: Local Backup Manifest Export Diagnostic Hook Closure Audit.
