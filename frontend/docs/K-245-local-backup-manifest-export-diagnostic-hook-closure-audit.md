# K-245 Local Backup Manifest Export Diagnostic Hook Closure Audit

K-245 closes the K-244 export diagnostic hook milestone.

K-245 is docs/audit plus audit test only. K-245 does not change hook behavior, expose diagnostic output, change ZIP output, change `manifest.json`, add sidecar output, change import/restore behavior, or change persistence/network/remote/blob behavior.

K-245 decides that future diagnostic visibility, package sidecar/wrapper work, or restore/import validation must remain separate milestones.

## Current State Summary

- K-238 manifest generator/validator exists.
- K-241 export diagnostic helper exists.
- K-244 calls the diagnostic helper from the export-adjacent path.
- The hook is output-neutral.
- The hook is after `VaultBackupManifest` assembly in `buildVaultBackupManifestV3`.
- The hook is before JSON/ZIP writing.
- The diagnostic result is internal/ignored.
- ZIP entries are unchanged.
- Parsed `manifest.json` is unchanged.
- No sidecar output exists.
- Public export return shape is unchanged.
- `VaultBackupManifest` v3 remains the current package contract.
- `importVaultBackup` remains unchanged.
- `vaultRestorePipeline` remains unchanged.
- `backupBeforeRestore` remains safety context only.
- Local runtime data remains source of truth.
- Remote systems remain support layers.

## K-244 Hook Placement Audit

The hook file is `frontend/src/lib/exportVaultBackup.ts`.

The exact call site is inside `buildVaultBackupManifestV3`, after the current `VaultBackupManifest` object is assembled and after the optional cloud block is attached:

```ts
if (cloud) manifest.cloud = cloud;
runVaultBackupManifestExportDiagnostic(manifest);
return manifest;
```

K-244 uses a single localized choke point at the manifest assembly boundary. It does not scatter diagnostic calls across `buildVaultBackupManifest`, cloud-aware callers, ZIP generation, JSON download, import, or restore paths.

The hook runs before JSON/ZIP writing because `downloadVaultBackup` serializes an already-built manifest and `buildVaultBackupZip` writes an already-built manifest to `manifest.json`.

## Output-Neutral Proof Audit

K-244 proves output neutrality through tests and source boundaries:

- ZIP entry list before/after the diagnostic call is unchanged.
- Parsed `manifest.json` before/after the diagnostic call is unchanged.
- No local-first manifest sidecar is written.
- No diagnostic manifest sidecar is written.
- Export return shape is unchanged.
- The diagnostic result is internal/ignored.
- The helper does not write files.
- The helper does not create ZIPs.
- The helper does not mutate export payload.
- Export/import tests remained green.

Byte-for-byte ZIP equality is not required for K-244 because ZIP archive metadata and compression details can be unstable. Parsed `manifest.json` equality plus ZIP entry equality is the accepted proof for this output-neutral hook.

## Field Mapping Audit

The source export type uses concrete `VaultBackupManifest` fields:

- `noteCount` is the source note count from `VaultBackupManifest.notes`.
- `folderCount` is the source folder count from `VaultBackupManifest.folders`.
- `relationCount` is the source relation count computed from note relationships.

The source type does not expose a generic `counts` object. K-244 uses `noteCount`, `folderCount`, and `relationCount` directly and does not invent additional export counts.

Unsupported domains are not overclaimed. Attachment metadata and attachment blobs remain excluded from the current export diagnostic mapping. The selected default scope remains `diagnostic-manifest` / `0`; the helper also supports `core-data` / `1`. Level 2, Level 3, and Level 4 requests remain hard failures.

## Export/Import Pipeline Preservation

`exportVaultBackup` behavior is unchanged except for the output-neutral diagnostic hook.

`vaultBackupZip` output is unchanged. `VaultBackupManifest` v3 is unchanged. Existing `manifest.json` remains the package contract and is not replaced.

`importVaultBackup` is unchanged. `vaultRestorePipeline` is unchanged. `backupBeforeRestore` is unchanged. K-245 does not connect restore/import validation and does not add destructive whole-vault restore.

Per-item `skip`, `duplicate`, and `replace` restore strategies remain separate from any destructive whole-vault restore concept.

## Diagnostic Result Boundary

The diagnostic result is internal/ignored.

It is not added to ZIP, not added to `manifest.json`, not added as a sidecar, not returned publicly, not shown in UI, and not logged with sensitive values. K-245 does not add a developer-facing or user-facing diagnostic surface.

## Failure Behavior Audit

Hard-fail candidates remain:

- credentials/tokens/secrets detected
- `destructiveWholeVaultReplaceAllowed` true
- invalid `backupKind` / `scopeLevel`
- Level 2/3/4 escalation
- raw blob payload embedded
- generated/dev-test artifacts included
- unsafe override escalation

Warning/diagnostic-only items remain:

- checksums not computed
- optional domain gaps
- attachment blob payload not included under diagnostic/core-data scope
- provider metadata unresolved
- schema/app version unknown if applicable

K-244 should not broaden hard-fail behavior beyond privacy/security/scope escalation. Errors must not leak sensitive values.

## Privacy/Security Audit

Key-level forbidden guard is preserved. Value-level secret guard is preserved. Nested arrays/objects remain recursively inspected. Benign warning/metadata strings pass. Errors do not leak sensitive values.

K-245 adds no Supabase imports, no Google Drive/OAuth imports, no fetch/network calls, no new IndexedDB/localStorage usage, no raw blob data URL allowance, and no generated artifact allowance.

## Attachment Boundary Audit

K-245 confirms no Level 3 blob support claim.

There is no attachment blob movement, copy, upload, download, delete, recovery, or sync change. Diagnostic markers remain metadata/core-data only. Provider-aware recovery remains non-goal. Google Drive appDataFolder QA remains separate and externally blocked.

## K-246 Decision

Recommended next milestone: K-246 Local Backup Manifest Diagnostic Visibility Plan.

Scope:

- docs/plan only
- decide whether diagnostics should remain internal, become developer-only, appear in maintenance UI, or become test-only forever
- no ZIP output change
- no `manifest.json` change
- no sidecar
- no restore/import changes

Output parity harness, sidecar/wrapper planning, and dry-run restore preview planning remain alternative future paths only if a later review finds a stronger need.

## Non-Goals

- no hook behavior change in K-245
- no diagnostic output exposure
- no UI/developer panel
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

K-245 closes the K-244 export diagnostic hook if audit checks pass.

The hook remains output-neutral. ZIP `manifest.json` and `VaultBackupManifest` v3 remain unchanged. No sidecar/local-first manifest is written to backup artifacts. Import/restore behavior remains unchanged.

Diagnostics visibility or artifact evolution requires a separate future plan. Local runtime data remains source of truth. Remote systems remain support layers.
