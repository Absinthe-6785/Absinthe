# K-241 Local Backup Manifest Export Diagnostic Integration

## Purpose

K-241 implements output-neutral export diagnostic integration for the K-238 local-first backup manifest generator/validator.

K-241 does not change ZIP output.

K-241 does not replace manifest.json.

K-241 does not add a ZIP sidecar.

K-241 does not change import/restore.

K-241 does not mutate persistence.

K-241 keeps `VaultBackupManifest` v3 as the current backup artifact contract.

## Decision Gate Result

K-241 chooses Gate A: output-neutral export-adjacent diagnostic helper.

The export path itself was not touched.

Reasoning:

- current export metadata is available as `VaultBackupManifest`.
- a pure helper can accept that manifest and build local-first diagnostic metadata.
- the helper can call `createLocalFirstBackupManifest`.
- the helper can call `validateLocalFirstBackupManifest`.
- the helper does not need to alter JSON export output.
- the helper does not need to alter ZIP output.
- the helper does not need to alter manifest.json.
- the helper does not need to add a sidecar.
- the helper does not need to alter import/restore behavior.

Output-neutral proof:

- targeted tests compare ZIP entry lists before and after running diagnostics.
- targeted tests assert `manifest.json` remains the current `VaultBackupManifest` shape.
- targeted tests assert no local-first sidecar entry appears.
- targeted source-audit tests assert the helper is not wired into `exportVaultBackup.ts` or `vaultBackupZip.ts`.

## Files

Helper path:

- `frontend/src/lib/localBackupManifestExportDiagnostic.ts`

Test path:

- `frontend/src/lib/localBackupManifestExportDiagnostic.test.ts`

Doc path:

- `frontend/docs/K-241-local-backup-manifest-export-diagnostic-integration.md`

Export path touched:

- none.

ZIP path touched:

- none.

Import/restore path touched:

- none.

## Diagnostic Behavior

The diagnostic helper:

- accepts an existing `VaultBackupManifest`.
- maps source metadata into a `LocalFirstBackupManifest`.
- defaults to `diagnostic-manifest` with scope level `0`.
- optionally supports `core-data` with scope level `1` for diagnostic tests.
- calls `createLocalFirstBackupManifest`.
- calls `validateLocalFirstBackupManifest`.
- returns the generated manifest when validation has no hard-failure category.
- returns validation errors and warnings.
- classifies hard failures separately from warning-only diagnostics.
- does not mutate the input manifest.
- does not write files.
- does not create ZIP entries.
- does not read or write IndexedDB.
- does not read or write localStorage.
- does not call fetch/network.
- does not move/copy/delete/upload/download blobs.

Hard failure categories:

- credentials/tokens/secrets detected.
- forbidden credential-like keys detected.
- raw blob payload embedded in manifest JSON.
- `destructiveWholeVaultReplaceAllowed` true.
- invalid backupKind/scopeLevel.
- generated/dev-test artifacts included or counted.
- privacy exclusion markers not true.

Warning categories:

- manifest checksum not computed.
- optional domains unresolved.
- attachment blob payload not included under metadata-only scope.
- provider metadata unresolved.
- compatibility gaps that do not claim restore-grade completeness.

No output shape change:

- helper results are diagnostics only.
- helper results are not written into JSON export.
- helper results are not written into ZIP manifest.json.
- helper results are not written as ZIP sidecar.

## ZIP Compatibility

ZIP compatibility is preserved:

- manifest.json unchanged.
- `VaultBackupManifest` v3 unchanged.
- no sidecar file.
- no ZIP entry changes.
- `importVaultBackup` unchanged.
- `vaultRestorePipeline` unchanged.
- `backupBeforeRestore` unchanged.

Current artifact relationship:

- existing ZIP manifest.json remains the current package contract.
- local-first manifest remains diagnostic/validation metadata.
- sidecar/wrapper/replacement remains a future plan, not K-241 behavior.

## Attachment Boundary

K-241 does not claim Level 3 blob support.

K-241 does not copy blobs.

K-241 does not delete blobs.

K-241 does not upload blobs.

K-241 does not download blobs.

K-241 does not alter attachment sync.

K-241 marks attachment metadata and blob payload coverage as diagnostic-only.

Blob payload inclusion remains false.

Provider-aware recovery remains non-goal.

Google Drive appDataFolder QA remains separate and externally blocked.

## Security/Privacy

K-241 preserves K-238 privacy validation:

- key-level credential guard remains.
- value-level credential guard remains.
- nested arrays/objects remain recursively inspected.
- raw blob data URL guard remains.
- generated artifact exclusion remains.
- validation errors identify path/key/category.
- validation errors do not print detected sensitive values.
- no credentials/tokens/secrets are introduced.
- no OAuth material is introduced.
- no Supabase service role key is introduced.
- no Google Drive auth material is introduced.
- no session cookies are introduced.
- no network calls are introduced.
- no remote behavior is introduced.

## Validation Result Summary

Local verification:

- targeted K-241 test result: `npm test -- src/lib/localBackupManifestExportDiagnostic.test.ts` passed with 13 tests.
- ZIP output unchanged proof: targeted K-241 tests compare ZIP entries and manifest.json shape before/after diagnostics.
- related K-240/K-239/K-238/K-237/K-236/K-235 tests passed.
- export/import related tests passed.
- typecheck/build passed.
- diff check passed.

## Recommended K-242

K-241 recommends:

**K-242 Local Backup Manifest Export Diagnostic Closure Audit**

Scope:

- docs/audit only.
- verify output-neutral diagnostic behavior.
- verify test coverage.
- verify no ZIP/import changes.
- decide whether future K-243 can plan sidecar/wrapper artifact integration.

Alternative if compatibility questions remain:

**K-242 VaultBackupManifest Compatibility Audit**

Scope:

- docs/audit only.
- clarify current v3 fields, import coupling, and wrapper/sidecar safety before artifact changes.

## Non-Goals

- no ZIP output change.
- no manifest.json replacement.
- no ZIP sidecar.
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

## Closure

K-241 adds local-first backup manifest export diagnostics without changing backup artifacts.

Existing ZIP manifest.json remains the current `VaultBackupManifest` v3 package contract.

The local-first manifest remains diagnostic metadata.

Future sidecar/wrapper/replacement work requires a separate plan.

Local runtime data remains source of truth.

Remote systems remain support layers.
