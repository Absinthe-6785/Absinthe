# K-237 Local-first Backup Manifest Audit Test / Fixture Spec

## Purpose

K-237 makes the K-236 manifest concept testable through fixture/spec/audit coverage.

K-237 is docs/spec or fixture-only.

K-237 does not implement manifest generation.

K-237 does not implement backup/export/restore/import mutation.

K-237 does not change ZIP creation, import parsing, restore execution, persistence, schemas, stores, providers, Supabase, Google Drive, OAuth, attachment sync, UI, routes, Health, Schedule, or Notes/Cosmos runtime behavior.

K-237 prepares a safe manifest fixture/audit path before any generator prototype.

K-237 follows K-235/K-236 local-first boundaries.

## Current Stance From K-235/K-236

Source-verified prior spec:

- local runtime data remains source of truth.
- remote systems are support layers.
- Supabase is not runtime source of truth.
- Google Drive/remote providers are not runtime source of truth.
- backup is not live sync.
- restore is not import.
- export is not automatically a restore backup.
- destructive whole-vault replace restore is forbidden as an early/default path.
- per-item skip / replace / duplicate conflict strategies are separate and must not be confused with whole-vault destructive restore.
- credentials/tokens/secrets must never be included in backup manifests or fixtures.
- generated/dev-test artifacts must be excluded from backup manifests or fixtures.

Fixture/spec decision:

- K-237 uses a docs-only example manifest fixture plus a test-local fixture object.
- K-237 does not add a dedicated runtime fixture file.
- K-237 does not add any app-visible import path.

## Existing Implementation Relationship

### VaultBackupManifest

Source-verified current implementation:

- `exportVaultBackup.ts` defines `VaultBackupManifest`.
- existing `VaultBackupManifest` is the current implementation-facing concept.
- existing `VaultBackupManifest` includes `schemaVersion`, optional `kind`, `exportedAt`, `app`, `appVersion`, `noteCount`, `folderCount`, `relationCount`, `folders`, `notes`, optional `extensions`, optional `scope`, optional `contentFingerprint`, and optional `cloud`.
- `buildVaultBackupManifestV3` creates the current v3 portable vault manifest for active notes, folders, extensions, and optional cloud data.
- `VAULT_BACKUP_SCHEMA_VERSION` is currently `3`.
- current `kind` is `absinthe-vault-export` when present.

Fixture/spec decision:

- conceptual `LocalFirstBackupManifest` is a future/expanded boundary contract from K-236.
- K-237 fixture should show how the future concept maps to or wraps the existing manifest without changing runtime code.
- K-237 does not rename, replace, or edit `VaultBackupManifest`.

Example mapping:

| Existing implementation field | Future fixture field | K-237 stance |
| --- | --- | --- |
| `schemaVersion` | `schemaVersion` | direct source schema marker. |
| `kind` | `backupKind` or `formatVersion` context | maps to package/export kind, not by itself enough for local-first restore policy. |
| `exportedAt` | `createdAt` | direct timestamp mapping. |
| `appVersion` | `appVersion` | direct app version mapping. |
| `noteCount` | `counts.notes` | count mapping. |
| `folderCount` | `counts.noteMetadata` or domain detail | folder count belongs to note metadata/domain detail. |
| `relationCount` | `counts.noteRelationships` | count mapping. |
| `notes` | `domains.notes` payload marker | current payload exists; future manifest should declare payload location/eligibility. |
| `folders` | `domains.noteMetadata` payload marker | current payload exists; future manifest should declare domain semantics. |
| `scope.included` / `scope.excluded` | `domains` and `privacy` | future manifest should make inclusion/exclusion explicit per domain. |
| `contentFingerprint` | `integrity.manifestChecksum` or domain checksum placeholder | future checksum policy requires separate implementation. |
| missing privacy fields | `privacy` | future fixture supplies explicit exclusions. |
| missing compatibility fields | `compatibility` | future fixture supplies preview/destructive restore policy. |

Unresolved / requires future audit:

- whether a future implementation extends, replaces, or wraps `VaultBackupManifest`.
- final package format versioning policy.
- final payload sidecar layout beyond current ZIP `manifest.json`, `notes/`, and optional `cloud/`.

### ZIP manifest.json

Source-verified current implementation:

- `vaultBackupZip.ts` writes `manifest.json` into ZIP backups.
- current ZIP output also writes `README.txt`.
- current ZIP output writes note Markdown sidecars under `notes/`.
- current ZIP output can write cloud CSV sidecars under `cloud/`.
- `parseVaultBackupZip` reads `manifest.json` and normalizes it as a `VaultBackupManifest`.

Fixture/spec decision:

- ZIP `manifest.json` is the package-level manifest if current implementation uses it.
- future ZIP `manifest.json` may contain or wrap the future `LocalFirstBackupManifest` shape.
- ZIP `manifest.json` should be validated before payload restore/import.
- ZIP `manifest.json` should declare domains, counts, version, compatibility, and exclusions.
- ZIP `manifest.json` should not include credentials/tokens/secrets.
- ZIP `manifest.json` should not embed raw blobs in manifest JSON.
- ZIP `manifest.json` should support dry-run preview before mutation.
- K-237 does not change ZIP creation/import behavior.

### importVaultBackup

Source-verified current implementation:

- `importVaultBackup.ts` exists.
- `importVaultBackup.ts` defines `VaultRestoreConflictStrategy` as `skip`, `replace`, or `duplicate`.
- `buildVaultRestorePreview` previews note/folder counts, new records, conflicts, validation, folder options, and note options before restore mutation.
- `applyVaultRestore` applies selected notes/folders and uses the selected per-note conflict strategy.
- per-item `replace` replaces an active conflicting note with backup content for that item.
- per-item `duplicate` imports a conflicting note with a fresh id.
- per-item `skip` keeps the local note unchanged.

Required clarification:

- importVaultBackup per-item replace strategy is not approval for whole-vault destructive replace restore.
- per-item skip / replace / duplicate conflict strategies are separate and must not be confused with whole-vault destructive restore.
- K-237 fixtures must keep `compatibility.destructiveWholeVaultReplaceAllowed` false.

### vaultRestorePipeline

Source-verified current implementation:

- `vaultRestorePipeline.ts` exists.
- `VaultRestorePipelineOptions` includes `strategy`, `selection`, `restoreCore`, `restoreExtensions`, `restoreCloud`, and `backupBeforeRestore`.
- `buildFullVaultRestorePreview` combines core restore preview, impact summary, and export validation.
- `manifestFromSnapshot` can derive a `VaultBackupManifest` from a snapshot.
- `executeVaultRestorePipeline` calls `createLastSnapshot` when `backupBeforeRestore` is true.
- `executeVaultRestorePipeline` filters the manifest by selection before importing core notes/folders.
- `executeVaultRestorePipeline` can apply extensions and cloud blocks when selected.

Required clarification:

- vaultRestorePipeline preview/snapshot/backupBeforeRestore behavior is safety-related context.
- backupBeforeRestore is not a reason to allow silent destructive restore.
- snapshot creation does not turn restore into live sync or remote source-of-truth.
- K-237 does not change `vaultRestorePipeline`.

## Fixture Strategy

K-237 selects:

**Option B: docs-only example plus audit-test-local fixture object.**

Reasons:

- keeps runtime import paths unchanged.
- avoids a new fixture file that app code could accidentally import.
- allows audit tests to validate required, optional, and forbidden fields.
- makes the K-236 concept testable before any generator prototype.

K-237 does not choose:

- Option A alone, because a docs-only fixture is less testable.
- Option C dedicated non-runtime fixture file, because current needs are satisfied by a test-local synthetic object.

If a dedicated fixture file is added in a future milestone:

- it must live outside runtime import paths or be clearly test-only.
- it must not be used by app runtime.
- it must not contain user data.
- it must not contain credentials/tokens/secrets.
- it must not imply implementation readiness.

## Example Manifest Fixture Shape

This example is conceptual and synthetic.

It is not an implementation type.

It contains no user content, no real ids, no real emails, no credentials, no tokens, no sessions, no raw attachment blob data, and no generated/dev-test artifacts.

```json
{
  "manifestVersion": "0.1-fixture",
  "formatVersion": "local-first-backup-fixture-v0",
  "createdAt": "2026-07-02T00:00:00.000Z",
  "appVersion": "fixture-app-version",
  "schemaVersion": "fixture-schema-version",
  "backupId": "fixture-backup-001",
  "backupKind": "diagnostic-manifest",
  "scopeLevel": 1,
  "domains": [
    {
      "id": "notes",
      "included": true,
      "count": 2,
      "payload": "sidecar-or-existing-vault-manifest",
      "schemaVersion": "fixture-note-schema",
      "restoreEligibility": "preview-only",
      "privacyLevel": "sensitive-content"
    },
    {
      "id": "attachmentMetadata",
      "included": true,
      "count": 1,
      "payload": "metadata-marker-only",
      "schemaVersion": "fixture-attachment-metadata-schema",
      "restoreEligibility": "preview-only",
      "privacyLevel": "sensitive-metadata"
    },
    {
      "id": "attachmentBlobs",
      "included": false,
      "count": 0,
      "payload": "not-included",
      "schemaVersion": "fixture-attachment-blob-schema",
      "restoreEligibility": "not-eligible",
      "privacyLevel": "binary-content"
    },
    {
      "id": "generatedDevTestArtifacts",
      "included": false,
      "count": 0,
      "payload": "excluded",
      "restoreEligibility": "not-eligible",
      "privacyLevel": "excluded"
    }
  ],
  "counts": {
    "notes": 2,
    "noteMetadata": 2,
    "noteRelationships": 1,
    "tags": 0,
    "tasks": 0,
    "schedule": 0,
    "health": 0,
    "settings": 1,
    "attachmentMetadata": 1,
    "attachmentBlobReferences": 1,
    "attachmentBlobs": 0,
    "remoteProviderMetadata": 0,
    "diagnostics": 0,
    "syncQueue": 0,
    "localOnlyUiState": 0,
    "generatedDevTestArtifacts": 0
  },
  "attachments": {
    "attachmentMetadataIncluded": true,
    "attachmentBlobPayloadIncluded": false,
    "blobReferenceCount": 1,
    "blobPayloadCount": 0,
    "missingBlobCount": 1,
    "orphanedBlobCount": 0,
    "totalBytesEstimate": 0,
    "checksumAvailable": false,
    "providerReferenceIncluded": false
  },
  "integrity": {
    "manifestChecksum": "placeholder:not-generated-in-k237",
    "domainChecksums": {},
    "attachmentBlobChecksums": {},
    "byteCounts": {
      "declaredTotalBytes": 0,
      "attachmentBlobBytes": 0
    },
    "recordCountsValidated": false,
    "warnings": ["fixture-only-counts-not-generated"]
  },
  "compatibility": {
    "restorePreviewRequired": true,
    "destructiveWholeVaultReplaceAllowed": false,
    "requiresMigration": false,
    "unsupportedDomains": [],
    "partialRestoreOnly": true,
    "attachmentPayloadMissing": true,
    "providerUnavailable": false,
    "conflictPolicyRequired": true,
    "sourceSchemaVersion": "fixture-schema-version",
    "targetSchemaVersion": "unknown",
    "minimumSupportedAppVersion": "unknown"
  },
  "privacy": {
    "excludesCredentials": true,
    "excludesGeneratedArtifacts": true,
    "containsUserContent": false,
    "containsAttachmentNames": false,
    "containsProviderRecordIds": false,
    "privacySensitiveFields": ["createdAt", "counts", "attachment byte estimates"]
  },
  "warnings": ["fixture-only-no-runtime-generator"],
  "limitations": ["metadata-only-example", "no-blob-payloads"]
}
```

## Required Fields

Future manifest required fields:

- `manifestVersion`.
- `formatVersion`.
- `createdAt`.
- `appVersion` or explicit unknown marker.
- `schemaVersion` or explicit unknown marker.
- `backupKind`.
- `scopeLevel`.
- `domains`.
- `counts`.
- `privacy.excludesCredentials`.
- `privacy.excludesGeneratedArtifacts`.
- `compatibility.restorePreviewRequired`.
- `compatibility.destructiveWholeVaultReplaceAllowed`.

Expected values:

- `compatibility.restorePreviewRequired` should be true.
- `compatibility.destructiveWholeVaultReplaceAllowed` should be false for early/default fixtures.
- `privacy.excludesCredentials` should be true.
- `privacy.excludesGeneratedArtifacts` should be true.

## Optional Fields

Optional fields:

- `backupId`.
- `source.deviceLabel`.
- `source.installationId` if policy-approved.
- `source.locale` if policy-approved.
- `source.timezone` if policy-approved.
- `integrity.manifestChecksum`.
- `integrity.domainChecksums`.
- `integrity.attachmentChecksums`.
- `integrity.attachmentBlobChecksums`.
- `warnings`.
- `limitations`.
- provider metadata markers.
- attachment byte estimates.
- unsupportedDomains.
- migration hints.

Policy:

- optional source/device fields can be privacy-sensitive.
- optional provider metadata must not include credentials.
- optional checksum fields are placeholders until a generator implements real checksum production.
- optional fields must not imply restore mutation readiness.

## Forbidden Fields

Manifest/fixture must not include:

- `accessToken`.
- `access_token`.
- `refreshToken`.
- `refresh_token`.
- `idToken`.
- `id_token`.
- `clientSecret`.
- `client_secret`.
- `supabaseServiceRoleKey`.
- `serviceRoleKey`.
- `sessionCookie`.
- `password`.
- `rawCredential`.
- `oauthCredential`.
- Google Drive OAuth token values.
- raw attachment blob payloads inside manifest JSON.
- generated static HTML content.
- local dev/test artifact payloads.
- background queue secrets.
- cookies.
- sessions.
- real user emails.
- real user IDs.

Fixture rules:

- fixture contains no credentials/tokens/secrets.
- fixture contains no raw blob payload.
- fixture excludes generated/dev-test artifacts.
- fixture does not contain a credential count field.

## ZIP manifest.json Relationship

ZIP `manifest.json` is the package-level manifest if current implementation uses it.

ZIP `manifest.json` may contain or wrap the future `LocalFirstBackupManifest` shape.

ZIP `manifest.json` should be validated before payload restore/import.

ZIP `manifest.json` should declare:

- domains.
- counts.
- version fields.
- compatibility hints.
- privacy/security exclusions.
- attachment metadata/blob markers.
- integrity marker placeholders.

ZIP `manifest.json` should not include:

- credentials/tokens/secrets.
- raw blobs in manifest JSON.
- generated/dev-test artifact payloads.
- background queue secrets.

ZIP `manifest.json` should support dry-run preview before mutation.

K-237 does not change ZIP creation/import behavior.

## VaultBackupManifest Relationship

Existing `VaultBackupManifest`, if present, remains the current implementation contract.

Future `LocalFirstBackupManifest` may be an expanded contract.

K-237 example mapping:

- existing format/version fields map to future `manifestVersion` / `formatVersion` / `schemaVersion` with explicit policy still unresolved.
- existing notes/folders fields map to `domains`, `counts.notes`, `counts.noteMetadata`, and payload markers.
- existing relation counts map to `counts.noteRelationships`.
- existing extension scope maps to domain inclusion/exclusion markers.
- existing attachment metadata, when future-supported, maps to `attachments.attachmentMetadataIncluded` and `counts.attachmentMetadata`.
- missing fields map to future `compatibility`, `privacy`, and `integrity` placeholders.

K-237 does not rename or change existing types.

## Attachment Metadata/Blob Fixture Boundary

Fixture examples:

- `attachmentMetadataIncluded`: true/false.
- `attachmentBlobPayloadIncluded`: true/false.
- `blobReferenceCount`.
- `blobPayloadCount`.
- `missingBlobCount`.
- `orphanedBlobCount`.
- `totalBytesEstimate`.
- `checksumAvailable`.
- `providerReferenceIncluded`.

Rules:

- note records may reference attachment ids.
- attachment metadata may be included at Level 2.
- blob payload inclusion requires Level 3 or explicit policy.
- raw blob data must not be inside manifest JSON.
- metadata-only restore preview must warn when blob payloads are missing.
- Google Drive provider references are not proof that blobs are available locally.
- attachment metadata and blob payload markers must remain separate.

Source-verified current implementation:

- `AttachmentMetadata` includes metadata fields such as `id`, `noteId`, `fileName`, `mimeType`, `size`, checksum fields, local blob keys, and remote provider markers.
- `AttachmentBlobRecord` includes `key`, `blob`, `mimeType`, `size`, and optional checksum.
- `AttachmentBlobInventoryRecord` includes local blob inventory markers without requiring blob payload reads.
- attachment metadata is checked for raw blob data through lightweight metadata guards.

## Domain Inventory/Count Fixture Boundary

Expected domain count fields:

- `notes`.
- `noteMetadata`.
- `noteRelationships`.
- `tags`.
- `tasks`.
- `schedule`.
- `health`.
- `settings`.
- `attachmentMetadata`.
- `attachmentBlobReferences`.
- `attachmentBlobs`.
- `remoteProviderMetadata`.
- `diagnostics`.
- `syncQueue`.
- `localOnlyUiState`.
- `generatedDevTestArtifacts`.

Expected defaults:

- `generatedDevTestArtifacts` count should be 0 or excluded.
- credentials/tokens count should not exist.
- `syncQueue` should be excluded or unresolved by default.
- `localOnlyUiState` should be excluded or unresolved by default.
- `remoteProviderMetadata` should be policy-gated.

Fixture/spec decision:

- K-237 fixture sets `generatedDevTestArtifacts` to 0 and excluded.
- K-237 fixture sets `syncQueue` to 0 and does not mark queue replay eligible.
- K-237 fixture sets `remoteProviderMetadata` to 0.

## Integrity Marker Placeholders

Integrity marker placeholders:

- `manifestChecksum`.
- `domainChecksums`.
- `attachmentBlobChecksums`.
- `byteCounts`.
- `recordCountsValidated`.
- `warnings`.

Policy:

- K-237 does not implement checksum generation.
- future generator may start with count validation before cryptographic checksums.
- restore preview must show integrity warnings.
- placeholders must be visibly placeholders and must not be mistaken for generated checksums.

## Compatibility Hints Fixture Boundary

Compatibility hints:

- `restorePreviewRequired`: true.
- `destructiveWholeVaultReplaceAllowed`: false.
- `requiresMigration`.
- `unsupportedDomains`.
- `partialRestoreOnly`.
- `attachmentPayloadMissing`.
- `providerUnavailable`.
- `conflictPolicyRequired`.
- `sourceSchemaVersion`.
- `targetSchemaVersion` if known.
- `minimumSupportedAppVersion` if known.

Policy:

- compatibility hints are preview inputs, not mutation permission.
- `destructiveWholeVaultReplaceAllowed` should be false.
- restore preview must be required before any import/restore mutation.
- conflict policy must be required when ids collide or item-level replacement is possible.

## Audit-test Expectations

Audit tests should check:

- doc exists.
- doc states K-237 is docs/spec or fixture-only.
- doc states no manifest generator implementation.
- doc states no backup/export/import/restore implementation.
- doc states local runtime data is source of truth.
- doc states remote systems are support layers.
- doc distinguishes per-item replace from destructive whole-vault restore.
- doc mentions `VaultBackupManifest`.
- doc mentions ZIP `manifest.json`.
- doc mentions `importVaultBackup`.
- doc mentions `vaultRestorePipeline`.
- doc mentions preview/snapshot/backupBeforeRestore relationship or marks unresolved.
- doc defines fixture strategy.
- doc defines example manifest fixture shape.
- doc defines required fields.
- doc defines optional fields.
- doc defines forbidden fields.
- fixture shape includes required fields.
- fixture excludes forbidden fields.
- fixture marks destructive whole-vault restore as false.
- fixture distinguishes per-item replace from destructive whole-vault restore.
- fixture includes domains/counts.
- fixture includes attachment metadata/blob markers.
- fixture includes compatibility hints.
- fixture includes privacy/security exclusions.
- fixture references `VaultBackupManifest` / `importVaultBackup` relationship.
- fixture references ZIP `manifest.json` relationship.
- fixture does not include credentials/tokens/secrets.
- fixture contains no raw blob payload.

## Recommended K-238

K-237 chooses:

**K-238 Local Backup Manifest Generator Prototype**

Scope:

- implementation.
- generate manifest only.
- no user data payload export yet, or metadata-only dry-run.
- no restore/import mutation.
- no destructive restore.
- no Supabase/Google Drive behavior changes.
- no attachment blob export unless explicitly approved.

Reason:

- K-237 source inspection found the current implementation relationships clear enough for a manifest-only generator prototype.
- attachment blob export remains separately gated.

Alternative if implementation relationship becomes unclear during K-238:

**K-238 Local Backup Manifest Implementation Relationship Audit**

Scope:

- docs/audit only.
- source-ground existing `VaultBackupManifest` / `importVaultBackup` / `vaultRestorePipeline` relationships before generator.

Alternative if attachment policy becomes the blocker:

**K-238 Attachment Backup Manifest Boundary Audit**

Scope:

- docs/audit only.
- clarify attachment metadata/blob/provider markers before generator.

## Non-Goals

- no runtime implementation.
- no manifest generator implementation.
- no backup/export implementation.
- no restore/import implementation.
- no ZIP creation changes.
- no importVaultBackup changes.
- no vaultRestorePipeline changes.
- no schema migration.
- no IndexedDB migration.
- no persistence change.
- no store/provider changes.
- no Supabase sync changes.
- no Google Drive changes.
- no OAuth changes.
- no attachment remote upload/recovery changes.
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

K-237 makes the manifest concept auditable before implementation.

Local runtime data remains source of truth.

Remote systems remain support layers.

Existing per-item replace strategies must not be confused with destructive whole-vault restore.

First implementation should generate or validate manifest metadata only.

Google Drive/remote attachment QA remains a separate external-blocked line.
