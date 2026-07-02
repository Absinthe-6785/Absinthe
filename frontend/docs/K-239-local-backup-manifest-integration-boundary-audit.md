# K-239 Local Backup Manifest Integration Boundary Audit

## Purpose

K-239 audits how the K-238 manifest generator/validator should integrate with the existing backup/export pipeline.

K-239 is docs/audit or test-only.

K-239 does not implement integration.

K-239 does not change ZIP export behavior.

K-239 does not change restore/import behavior.

K-239 does not mutate persistence.

K-239 decides the K-240 path before export or import behavior changes.

## Current State Summary

Source-verified prior milestones:

- K-235 local-first backup/restore boundary exists.
- K-236 manifest spec exists.
- K-237 fixture/spec exists.
- K-238 generator/validator prototype exists.
- K-238 is metadata-only.
- K-238 has key-level and value-level secret guards.
- K-238 scans nested arrays and objects for obvious credential/token/secret-like values.
- K-238 validates backupKind/scopeLevel mapping.
- K-238 preserves forbidden key, raw blob data URL, generated artifact, and destructive restore guards.
- K-238 does not generate ZIPs.
- K-238 does not export note payloads.
- K-238 does not restore, import, or mutate persistence.
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
- creates metadata markers for domains, counts, attachments, integrity, compatibility, privacy, warnings, and limitations.
- forces `restorePreviewRequired: true`.
- forces `destructiveWholeVaultReplaceAllowed: false`.
- forces credential/token/secret/generated-artifact exclusions to true.
- validates required fields, backupKind/scopeLevel, attachment markers, compatibility markers, privacy markers, forbidden keys, raw blob values, and obvious credential-like string values.
- does not import `exportVaultBackup`, `importVaultBackup`, `vaultRestorePipeline`, Supabase, OAuth, Google Drive, ZIP, attachment blob adapters, stores, providers, or persistence modules.

Integration risk:

- safe as a pure generator/validator.
- not yet mapped to the current payload-bearing `VaultBackupManifest`.
- not yet wired into export, ZIP, import, restore, or persistence paths.

K-240 implication:

- future integration should start with diagnostic validation or a wrapper/sidecar plan.
- direct replacement of current ZIP `manifest.json` is risky without compatibility work.

### localFirstBackupManifest tests

File inspected: `frontend/src/lib/localFirstBackupManifest.test.ts`.

Current behavior:

- tests valid and invalid backupKind/scopeLevel mappings.
- tests privacy exclusions.
- tests forbidden key rejection.
- tests credential-like value rejection in nested allowed fields.
- tests raw blob data URL rejection.
- tests generated/dev-test artifact rejection.
- tests attachment blob payload scope boundary.
- tests source purity against runtime service imports.

Integration risk:

- coverage locks generator purity, but does not validate export pipeline behavior.

K-240 implication:

- retain tests as a pure boundary suite.
- add integration tests only when K-240 explicitly chooses an export diagnostic or sidecar plan.

### exportVaultBackup

File inspected: `frontend/src/lib/exportVaultBackup.ts`.

Current behavior:

- defines `VaultBackupManifest`.
- builds the current portable vault manifest through `buildVaultBackupManifestV3`.
- includes `schemaVersion`, optional `kind`, `exportedAt`, `app`, `appVersion`, note/folder/relation counts, folders, notes, optional extensions, optional scope, optional content fingerprint, and optional cloud block.
- filters out deleted notes.
- serializes note content into backup entries.
- `downloadVaultBackup` writes a JSON file from the current manifest.
- `normalizeVaultBackupManifest` accepts older and current shapes and migrates them.
- `upgradeVaultBackupToV3` upgrades earlier manifest shape toward v3.

Integration risk:

- `VaultBackupManifest` is payload-bearing and import-facing.
- it includes note Markdown content and folder data.
- it is not the same shape as `LocalFirstBackupManifest`.
- replacing it directly would affect JSON export, ZIP export, and import parsing.

K-240 implication:

- do not replace `VaultBackupManifest` in-place first.
- prefer wrapper, sidecar, or diagnostic-only integration.

### VaultBackupManifest

File inspected: `frontend/src/lib/exportVaultBackup.ts`.

Current behavior:

- current implementation-facing manifest is `VaultBackupManifest`.
- current schema version is source-verified through `VAULT_BACKUP_SCHEMA_VERSION`.
- `VAULT_BACKUP_SCHEMA_VERSION` is currently `3`.
- `VAULT_EXPORT_KIND` is currently `absinthe-vault-export`.
- existing fields include app/version/counts/payload records/scope/fingerprint/cloud.
- it already acts as the JSON export payload and ZIP `manifest.json` payload.

Integration risk:

- it lacks explicit local-first compatibility markers such as `restorePreviewRequired`, `destructiveWholeVaultReplaceAllowed`, `privacy`, `integrity`, `backupKind`, and `scopeLevel`.
- it also contains user content, so it is not metadata-only.

K-240 implication:

- a local-first manifest should not be treated as a drop-in type alias for `VaultBackupManifest`.

### ZIP manifest.json creation

File inspected: `frontend/src/lib/vaultBackupZip.ts`.

Current behavior:

- imports `JSZip`.
- `buildVaultBackupZip` writes `manifest.json` as `JSON.stringify(manifest, null, 2)` where `manifest` is a `VaultBackupManifest`.
- writes `README.txt`.
- writes note Markdown sidecars under `notes/`.
- writes cloud CSV sidecars when cloud data is present and not skipped.
- `parseVaultBackupZip` reads `manifest.json` and normalizes it as a `VaultBackupManifest`.

Integration risk:

- current import depends on `manifest.json` being parseable as `VaultBackupManifest`.
- replacing `manifest.json` with the K-238 shape would break import unless the parser changes in the same planned PR.

K-240 implication:

- do not change ZIP `manifest.json` in K-239.
- K-240 should choose a sidecar/wrapper plan or diagnostic-only plan before implementation.

### importVaultBackup

File inspected: `frontend/src/lib/importVaultBackup.ts`.

Current behavior:

- parses JSON into `VaultBackupManifest`.
- validates schema/app/export date and notes through compatibility validators.
- builds restore previews with counts, conflicts, folder options, and note options.
- defines `VaultRestoreConflictStrategy` as `skip`, `replace`, or `duplicate`.
- applies selected notes/folders through `applyVaultRestore`.
- per-item `replace` replaces one conflicting active note.
- per-item `duplicate` creates a fresh note id.
- per-item `skip` leaves local data unchanged.

Integration risk:

- current restore behavior expects a `VaultBackupManifest`, not a `LocalFirstBackupManifest`.
- current item-level `replace` could be confused with destructive whole-vault replace if docs are vague.

K-240 implication:

- future local-first manifest restore preview must preserve the distinction between per-item replace and destructive whole-vault restore.

### vaultRestorePipeline

File inspected: `frontend/src/lib/vaultRestorePipeline.ts`.

Current behavior:

- builds full restore previews from a `VaultBackupManifest`.
- combines core preview, impact summary, and export validation.
- can derive a `VaultBackupManifest` from a snapshot.
- executes selected restore with `strategy`, `selection`, `restoreCore`, `restoreExtensions`, `restoreCloud`, and `backupBeforeRestore`.
- calls `createLastSnapshot` when `backupBeforeRestore` is true.
- applies extensions and cloud blocks only when selected.
- records last vault export in localStorage through `recordLastVaultExport`.

Integration risk:

- pipeline performs restore mutation when explicitly executed.
- local-first manifest validation must not be wired here until preview and compatibility behavior are specified.
- `backupBeforeRestore` is safety context, not permission for silent destructive restore.

K-240 implication:

- keep restore/import out of the first integration.
- use manifest validation first in export diagnostics or preview-only planning.

### backupBeforeRestore

File inspected: `frontend/src/lib/vaultRestorePipeline.ts`.

Current behavior:

- `VaultRestorePipelineOptions` includes `backupBeforeRestore`.
- `executeVaultRestorePipeline` creates a snapshot before restore when this flag is true.

Integration risk:

- a pre-restore snapshot can reduce risk, but it does not make destructive whole-vault restore acceptable by default.

K-240 implication:

- future docs must continue to distinguish backup-before-restore safety from restore mutation permission.

### attachment metadata/blob export handling

Files inspected:

- `frontend/src/lib/attachmentRepository.ts`.
- `frontend/src/lib/exportVaultBackup.ts`.
- `frontend/src/lib/vaultBackupZip.ts`.

File inspected: `frontend/src/lib/attachmentRepository.ts`.

Current behavior:

- `AttachmentMetadata` is separate from `AttachmentBlobRecord`.
- attachment metadata may include local blob keys, remote blob keys, provider markers, verification markers, timestamps, names, mime types, and sizes.
- blob payloads are represented through `BlobStorageAdapter`.
- current `VaultBackupManifest` does not directly include the attachment repository inventory.
- current ZIP export writes note Markdown sidecars and optional cloud CSV sidecars, not attachment blob payload sidecars.

Integration risk:

- K-238 attachment markers can describe intent, but current export does not source attachment metadata/blob inventory for the local-first manifest.
- Level 3/full-content-with-blobs cannot be claimed unless blob payload export is explicitly implemented and verified.

K-240 implication:

- attachment blob scopeLevel 3+ remains a non-goal until a separate attachment packaging policy exists.

## Existing VaultBackupManifest Relationship

Current `VaultBackupManifest` role:

- implementation-facing export/import manifest.
- JSON backup payload.
- ZIP `manifest.json` payload.
- restore preview input after normalization.

Current version:

- source-verified `VAULT_BACKUP_SCHEMA_VERSION` is `3`.
- source-verified `VAULT_EXPORT_KIND` is `absinthe-vault-export`.

Current fields:

- `schemaVersion`.
- optional `kind`.
- `exportedAt`.
- `app`.
- `appVersion`.
- `noteCount`.
- `folderCount`.
- `relationCount`.
- `folders`.
- `notes`.
- optional `extensions`.
- optional `scope`.
- optional `contentFingerprint`.
- optional `cloud`.

What it has:

- payload metadata.
- note and folder counts.
- app version.
- schema version.
- content fingerprint.
- scope block.
- optional cloud block.

What it lacks compared to K-238 local-first manifest:

- `manifestVersion`.
- `formatVersion`.
- `backupId`.
- `backupKind`.
- `scopeLevel`.
- explicit `domains` inventory.
- explicit attachment markers.
- explicit `integrity` markers by domain/blob.
- explicit `compatibility.restorePreviewRequired`.
- explicit `compatibility.destructiveWholeVaultReplaceAllowed`.
- explicit privacy exclusions.
- value-level credential guard validation.

Decision options:

1. Wrap existing `VaultBackupManifest` inside `LocalFirstBackupManifest`.
2. Extend existing `VaultBackupManifest` toward `LocalFirstBackupManifest`.
3. Keep `LocalFirstBackupManifest` separate as diagnostic/validation metadata.
4. Replace ZIP `manifest.json` later.

Recommendation:

- prefer wrapper or sidecar/diagnostic-first.
- do not replace ZIP `manifest.json` until import compatibility is planned and tested.

## ZIP manifest.json Relationship

Current ZIP `manifest.json` generation path:

- `downloadVaultBackupZip` calls `buildVaultBackupZip`.
- `buildVaultBackupZip` writes `manifest.json`.
- the value is the current `VaultBackupManifest`.

Current ZIP `manifest.json` import path:

- `parseVaultBackupZip` reads `manifest.json`.
- `parseVaultBackupZip` parses JSON.
- `parseVaultBackupZip` calls `normalizeVaultBackupManifest`.

What would break if shape changed:

- existing ZIP import expects `manifest.json` to normalize as `VaultBackupManifest`.
- direct replacement by `LocalFirstBackupManifest` would fail current import without parser and restore preview changes.

Possible future relationship:

- add `LocalFirstBackupManifest` as a sidecar.
- nest `VaultBackupManifest` in a wrapper after compatibility planning.
- keep current `manifest.json` unchanged and run K-238 validation as export diagnostics.
- eventually make `LocalFirstBackupManifest` top-level only after parser compatibility and migration are explicit.

Decision:

- do not change ZIP `manifest.json` in K-239.
- recommend K-240 as a sidecar/wrapper plan or diagnostic-only integration plan.
- direct replacement is not recommended yet.

## exportVaultBackup Integration Boundary

Current export path has access to:

- notes.
- folders.
- optional cloud block.
- optional portable extensions.
- current `VaultBackupManifest` counts and payload records.

Current export path does not obviously have access to:

- local attachment repository inventory.
- local blob inventory.
- attachment blob byte/checksum policy for export.
- final local-first domain inventory source of truth.

Future generator position options:

- run before current ZIP manifest creation as diagnostic metadata.
- run after current `VaultBackupManifest` creation using the current manifest as input context.
- run as a separate dry-run validation with no output shape change.

Validation failure behavior in export:

- validation failure must not print sensitive values.
- validation errors should identify key/path only.
- severe privacy/security violations should block export.
- compatibility warnings should initially be diagnostic-only.

Recommended first integration mode:

- dry-run diagnostic validation only.
- no output shape change.
- do not block user export unless validation detects severe privacy/security violations.
- no restore/import dependency yet.

## Validator Usage Boundary

Future options:

1. Unit-test-only validator.
2. Export diagnostic validator.
3. Hard gate before writing ZIP.
4. Restore preview validator.

Recommendation:

- use as export diagnostic validator first.
- only hard-block export for severe privacy/security violations:
  - credentials/tokens/secrets present.
  - `destructiveWholeVaultReplaceAllowed` is true.
  - invalid backupKind/scopeLevel pair.
  - raw blob payload embedded in manifest JSON.
- do not use validator to perform mutation.
- do not use validator to infer complete attachment blob coverage.
- do not use validator to trigger remote provider work.

## Failure Behavior

Future validation states:

- validation ok.
- warnings only.
- hard failure.
- unsupported manifest version.
- privacy violation.
- attachment policy violation.
- incompatible backupKind/scopeLevel.
- incomplete metadata.

Expected behavior:

- privacy/security violations should fail hard.
- compatibility warnings may not block export initially.
- attachment blob scope mismatch should warn unless output claims Level 3.
- invalid backupKind/scopeLevel should fail.
- unsupported manifest version should fail or require explicit compatibility handling.
- incomplete metadata should warn in diagnostic integration and fail only when restore-grade output claims completeness.
- validation errors must not print sensitive values.
- restore/import mutation remains out of scope.

## backupKind/scopeLevel Integration Decision

Required mapping:

- `diagnostic-manifest` => `0`.
- `core-data` => `1`.
- `full-content-metadata` => `2`.
- `full-content-with-blobs` => `3`.
- `provider-aware-recovery` => `4`.

Early export integration default:

- use `diagnostic-manifest` => `0` for metadata-only diagnostic validation.
- use `core-data` => `1` only after the export mapping intentionally includes core payload claims.
- do not claim Level 3 unless attachment blobs are actually included.
- do not claim `provider-aware-recovery` unless provider metadata policy is approved.
- `destructiveWholeVaultReplaceAllowed` must remain false.

## Attachment Scope Boundary

Current export attachment behavior:

- current ZIP export writes `manifest.json`, `README.txt`, note Markdown sidecars, and optional cloud CSV sidecars.
- current source inspection did not find attachment blob payload sidecar export in `vaultBackupZip.ts`.
- current `VaultBackupManifest` does not directly include the attachment repository inventory.

How K-238 markers can describe current behavior:

- `attachmentMetadataIncluded` should be false unless source-verified metadata inventory is included.
- `attachmentBlobPayloadIncluded` should be false unless source-verified blob payload export exists.
- `blobPayloadCount` should remain zero unless payload sidecars are written.
- `providerReferenceIncluded` should remain false unless provider reference policy is approved.

Rules:

- do not move, copy, delete, upload, or download blobs in K-239.
- do not change attachment export behavior.
- do not claim blob payload inclusion unless source-verified.
- attachment blob scopeLevel 3+ remains non-goal unless explicitly approved later.
- Google Drive appDataFolder QA remains separate and externally blocked.

## Import/Restore Boundary

`importVaultBackup` relationship:

- parses and validates the current `VaultBackupManifest`.
- previews counts and conflicts.
- applies selected note/folder records through item-level conflict strategy.

`vaultRestorePipeline` relationship:

- orchestrates preview impact and selected restore execution.
- can apply core, extensions, and cloud blocks when selected.
- can create a snapshot when `backupBeforeRestore` is true.

`backupBeforeRestore` relationship:

- safety context before mutation.
- not approval for silent destructive restore.

Required distinction:

- per-item `skip`, `duplicate`, and `replace` remain distinct from destructive whole-vault replace restore.
- per-item replace is an explicit conflict strategy for selected records.
- destructive whole-vault replace restore remains disallowed as an early/default path.

K-239 behavior:

- K-239 does not change import/restore behavior.
- future manifest integration must not make restore destructive by default.
- restore preview/dry-run must exist before any broad restore mutation.

## Security/Privacy Boundary

Requirements:

- no credentials/tokens/secrets in manifest or errors.
- K-238 value-level guard should remain.
- validation errors should identify key/path, not secret value.
- no session cookies.
- no OAuth material.
- no Supabase service role keys.
- no Google Drive auth material.
- no generated/dev-test artifacts.
- no raw blob data URL inside manifest JSON.
- no network calls.
- no background jobs.

Privacy note:

- local-first backup packages can still contain sensitive user content when scope allows.
- diagnostic manifests may reveal sensitive counts, timestamps, provider markers, or file names.
- future UI copy must not imply metadata-only manifests are public.

## Integration Options for K-240

### Option A: Manifest export diagnostic audit

Scope:

- docs/audit or test-only.
- simulate export metadata and run validator.
- no ZIP behavior change.

Pros:

- lowest risk.
- keeps K-238 pure.
- sharpens mapping from current `VaultBackupManifest` to local-first metadata.

Cons:

- still does not exercise real export path.

### Option B: Manifest sidecar/wrapper plan

Scope:

- docs/plan.
- define exact ZIP manifest nesting or sidecar relationship.
- no behavior change.

Pros:

- directly addresses the current `manifest.json` coupling.
- prepares compatibility tests before behavior changes.

Cons:

- delays runtime integration.

### Option C: Export path diagnostic integration

Scope:

- implementation.
- call `createLocalFirstBackupManifest` in export path.
- validate but do not alter ZIP payload shape.
- hard fail only on privacy/security violations.
- no restore/import change.

Pros:

- first runtime use of the validator.
- no output shape change if implemented carefully.

Cons:

- requires careful failure behavior to avoid surprising users.
- still needs a mapping from current manifest to local-first metadata.

### Option D: Replace ZIP manifest.json

Scope:

- high-risk implementation.
- change package top-level manifest shape.
- update import/parser/restore compatibility together.

Pros:

- eventually may produce a cleaner package contract.

Cons:

- high risk.
- would affect import compatibility.
- not recommended yet.

Preferred K-240:

**K-240 Local Backup Manifest Export Integration Plan**.

Reason:

- source relationship is clear, but current ZIP/import coupling makes direct replacement risky.
- K-240 should define the wrapper/sidecar/diagnostic output relationship before runtime integration.
- after K-240, a later milestone can implement export path diagnostic integration without changing ZIP `manifest.json`.

Fallback K-240 if compatibility concerns dominate:

**K-240 VaultBackupManifest Compatibility Audit**.

## Non-Goals

- no exportVaultBackup integration in K-239.
- no ZIP manifest.json behavior change.
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

K-239 decides the integration boundary before touching export/import behavior.

K-238 manifest generator remains metadata-only.

Existing per-item replace strategies remain distinct from destructive whole-vault restore.

ZIP manifest.json changes require a separate plan or integration PR.

Remote systems remain support layers.

Local runtime data remains source of truth.
