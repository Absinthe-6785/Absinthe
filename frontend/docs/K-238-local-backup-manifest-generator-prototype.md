# K-238 Local Backup Manifest Generator Prototype

## Purpose

K-238 implements a metadata-only manifest generator prototype.

K-238 does not implement backup/export payloads.

K-238 does not implement restore/import mutation.

K-238 does not mutate persistence.

K-238 does not create ZIP files, move blobs, read notes, upload data, download data, or start background work.

K-238 follows K-235/K-236/K-237 boundaries.

## Files

- generator module: `frontend/src/lib/localFirstBackupManifest.ts`
- test path: `frontend/src/lib/localFirstBackupManifest.test.ts`
- doc path: `frontend/docs/K-238-local-backup-manifest-generator-prototype.md`

## Prototype Scope

The prototype scope is manifest metadata only.

The generator accepts synthetic/metadata input only.

The generator does not read user note payloads.

The generator does not export note payload data.

The generator does not create ZIP payloads.

The generator does not run restore mutation.

The generator does not mutate runtime persistence.

The generator does not import Supabase, Google Drive, OAuth, ZIP, restore pipeline, or attachment blob adapters.

## Source Findings

Source-verified current implementation/type:

- `exportVaultBackup.ts` defines the current `VaultBackupManifest`.
- existing `VaultBackupManifest` includes `schemaVersion`, optional `kind`, `exportedAt`, `app`, `appVersion`, counts, folders, notes, optional extensions, optional scope, optional fingerprint, and optional cloud block.
- `vaultBackupZip.ts` writes `manifest.json` into ZIP backups and parses `manifest.json` back into `VaultBackupManifest`.
- `importVaultBackup.ts` defines per-item `skip`, `replace`, and `duplicate` conflict strategies.
- `vaultRestorePipeline.ts` has preview, selection, impact, snapshot conversion, and `backupBeforeRestore` safety context.
- attachment metadata and blob payload types are separate in `attachmentRepository.ts`.

Prototype decision:

- K-238 introduces a new pure module instead of editing existing backup/export/restore files.
- K-238 generates the future local-first manifest shape from explicit metadata input.
- K-238 validates required fields, forbidden fields, backupKind/scopeLevel mapping, privacy exclusions, attachment markers, and compatibility hints.

Unresolved issues:

- final integration with existing `VaultBackupManifest`.
- final ZIP `manifest.json` wrapper/extension strategy.
- final checksum implementation.
- final domain inventory source of truth.
- final attachment blob export policy.

## backupKind/scopeLevel Mapping

Explicit mapping:

- `diagnostic-manifest` => `0`
- `core-data` => `1`
- `full-content-metadata` => `2`
- `full-content-with-blobs` => `3`
- `provider-aware-recovery` => `4`

Clarifications:

- `diagnostic-manifest` + `scopeLevel: 1` is invalid.
- `core-data` + `scopeLevel: 1` is valid.
- `destructiveWholeVaultReplaceAllowed` remains false.
- blob payload markers require `full-content-with-blobs` or a higher explicit scope.

## Required Fields

Generated manifests include:

- `manifestVersion`
- `formatVersion`
- `createdAt`
- `appVersion`
- `schemaVersion`
- `backupId`
- `backupKind`
- `scopeLevel`
- `domains`
- `counts`
- `attachments`
- `integrity`
- `compatibility`
- `privacy`
- `warnings`
- `limitations`

Privacy includes:

- `excludesCredentials: true`
- `excludesTokens: true`
- `excludesSecrets: true`
- `excludesGeneratedArtifacts: true`

Compatibility includes:

- `restorePreviewRequired: true`
- `destructiveWholeVaultReplaceAllowed: false`
- `conflictPolicyRequired`
- `partialRestoreOnly`

## Forbidden Fields

The validator rejects forbidden keys/patterns in manifest objects:

- `accessToken`
- `refreshToken`
- `idToken`
- `clientSecret`
- `client_secret`
- `supabaseServiceRoleKey`
- `serviceRoleKey`
- `sessionCookie`
- `password`
- `rawCredential`
- `oauthCredential`
- `token`
- `secret`
- `credential`
- `rawBlobPayload`
- `blobPayload`
- `generatedHtml`
- `staticHtmlArtifact`

The validator also rejects raw data URL blob payload values.

The validation helper operates on manifest objects, not docs.

## Attachment Boundary

Attachment markers are separate from blob payload markers:

- `attachmentMetadataIncluded`
- `attachmentBlobPayloadIncluded`
- `blobReferenceCount`
- `blobPayloadCount`
- `missingBlobCount`
- `orphanedBlobCount`
- `totalBytesEstimate`
- `checksumAvailable`
- `providerReferenceIncluded`

Boundary:

- no raw blob payload in manifest.
- blob inclusion requires higher scope and future policy.
- no attachment movement/copy/upload/download.
- provider references are metadata markers, not proof of local payload availability.

## Existing Implementation Relationship

`VaultBackupManifest` relationship:

- existing `VaultBackupManifest` remains the current backup/export implementation contract.
- K-238 does not rename or alter that type.
- future work must decide whether local-first manifests wrap, extend, or replace that implementation-facing shape.

ZIP `manifest.json` relationship:

- current ZIP backups already place `manifest.json` at package level.
- K-238 does not change ZIP creation or parsing.
- future ZIP work may place the local-first manifest in `manifest.json` or wrap it explicitly.

`importVaultBackup` relationship:

- current per-item `skip`, `replace`, and `duplicate` behavior remains untouched.
- per-item replace is not whole-vault destructive replace restore.
- K-238 validation keeps `destructiveWholeVaultReplaceAllowed` false.

`vaultRestorePipeline` / `backupBeforeRestore` relationship:

- current `backupBeforeRestore` is safety context.
- snapshot creation is not permission for silent destructive restore.
- K-238 does not import or modify `vaultRestorePipeline`.

## Safety/Security

K-238 introduces:

- no credentials/tokens/secrets.
- no Supabase behavior.
- no Google Drive behavior.
- no OAuth behavior.
- no network.
- no background jobs.
- no generated artifacts.
- no app-visible runtime wiring.

## Validation Result Summary

Local verification:

- targeted K-238 test result: `npm test -- src/lib/localFirstBackupManifest.test.ts` passed.
- related K-237/K-236/K-235 tests: `npm test -- src/lib/localFirstBackupManifestFixtureSpec.test.ts src/lib/localFirstBackupManifestSpec.test.ts src/lib/localFirstBackupRestoreBoundarySpec.test.ts src/lib/notesCosmosStaticHtmlViewportQaEvidenceAudit.test.ts src/components/notes/NotesCosmosStaticPreview.test.ts` passed.
- typecheck/build: `npm run typecheck` and `npm run build` passed.
- diff check: `git diff --check` passed.
- full test suite: `npm test` passed.

## Recommended K-239

K-238 recommends:

**K-239 Local Backup Manifest Generator Closure Audit**

Scope:

- docs/audit only.
- verify prototype purity, field validation, forbidden key handling, and no runtime mutation.
- decide whether the next implementation should be metadata-only manifest export or dry-run preview.

Alternative:

**K-239 Local Backup Manifest Export Plan**

Scope:

- docs/plan only.
- plan how to write manifest-only output without payload export/mutation.

Alternative:

**K-239 Backup Dry-run Preview Plan**

Scope:

- docs/plan only.
- parse manifest/package and show summary without mutation.

## Non-Goals

- no ZIP backup/export payload implementation.
- no restore/import mutation.
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
