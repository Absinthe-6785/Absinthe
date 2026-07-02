# K-236 Local-first Backup Manifest Spec

## Purpose

K-236 defines the local-first backup manifest shape and boundary for future Absinthe backup work.

K-236 is docs/spec only.

K-236 does not implement manifest generation.

K-236 does not implement backup, export, restore, import, sync, conflict resolution, migration, UI, routes, or recovery behavior.

K-236 prepares a safe manifest-first path before any future backup or restore mutation.

K-236 follows the K-235 local-first backup/restore boundary.

## Current Stance From K-235

Source-verified prior spec:

- local runtime data remains source of truth.
- Supabase is not runtime source of truth.
- Google Drive/remote providers are not runtime source of truth.
- remote systems are support layers.
- backup is not live sync.
- restore is not import.
- export is not automatically a restore backup.
- destructive whole-vault replace restore is forbidden as an early/default path.
- per-item conflict strategies are separate from destructive whole-vault restore.
- local data must remain usable offline.
- backup and restore work must be preview-first before mutation.

Source-verified current implementation:

- `syncMode.ts` resolves Notes runtime sync mode to `local` by default.
- `notePersistence.ts` keeps IndexedDB as the primary Notes runtime storage with localStorage fallback/rescue behavior.
- attachment metadata and attachment blobs are separate IndexedDB-backed resources.
- attachment metadata rejects raw blob payload data.
- existing vault backup/export code already has a `VaultBackupManifest` type.
- existing vault restore/import code already has preview and per-note conflict strategies.
- current ZIP backup support stores a `manifest.json` plus note Markdown sidecars and optional cloud CSV sidecars.

Unresolved / requires future audit:

- final cross-domain backup inventory.
- final backup package schema.
- final attachment blob packaging policy.
- final checksum and encryption policy.
- final Supabase backup metadata contract.
- final Google Drive/provider-aware recovery package policy.
- final cross-domain conflict policy.

## Existing Implementation Relationship

### VaultBackupManifest

Source-verified current implementation:

- `exportVaultBackup.ts` defines `VaultBackupManifest`.
- current `VaultBackupManifest` includes `schemaVersion`, optional `kind`, `exportedAt`, `app`, `appVersion`, `noteCount`, `folderCount`, `relationCount`, `folders`, `notes`, optional `extensions`, optional `scope`, optional `contentFingerprint`, and optional `cloud`.
- `buildVaultBackupManifestV3` creates the current v3 portable vault manifest for active notes, folders, extensions, and optional cloud data.
- `VAULT_BACKUP_SCHEMA_VERSION` is currently `3`.
- `VAULT_EXPORT_KIND` is currently `absinthe-vault-export`.
- current portable vault scope includes local knowledge core, workspace extensions, and health-local state.
- current portable vault scope excludes derived indexes, session UI, and snapshot payloads by design.

K-236 relationship:

- K-236 does not replace the existing `VaultBackupManifest` type in code.
- K-236 defines a future manifest contract boundary that may extend, replace, or wrap the existing `VaultBackupManifest`.
- That implementation choice must be explicit in a later implementation spec.
- The future manifest must not silently reinterpret current export behavior as a complete local-first restore contract.

### importVaultBackup

Source-verified current implementation:

- `importVaultBackup.ts` exists.
- `importVaultBackup.ts` defines `VaultRestoreConflictStrategy` as `skip`, `replace`, or `duplicate`.
- `buildVaultRestorePreview` previews note/folder counts, new records, conflicts, and validation before restore mutation.
- `applyVaultRestore` applies the selected current manifest to notes/folders using per-note conflict behavior.
- `replace` replaces an active conflicting note with backup content for that item.
- `duplicate` imports a conflicting note under a fresh id.
- `skip` leaves the local note unchanged.

Required distinction:

- Existing per-note or per-item `replace` conflict strategy is not the same as whole-vault destructive replace restore.
- Existing `importVaultBackup` behavior must not be treated as approval for full destructive restore.
- K-236 must not reinterpret current import behavior as approval for full destructive restore.
- A future whole-vault restore must remain preview-first and must not silently overwrite active local runtime state.

### ZIP and Sidecar Relationship

Source-verified current implementation:

- `vaultBackupZip.ts` writes `manifest.json` into the ZIP.
- current ZIP output also includes `README.txt`.
- current ZIP output writes note Markdown sidecars under `notes/`.
- current ZIP output can include human-readable cloud CSV sidecars when cloud data is exported.
- ZIP import currently reads `manifest.json` and normalizes it as a `VaultBackupManifest`.

K-236 relationship:

- a future local-first backup package may keep the `manifest.json` convention if it remains compatible.
- sidecars and payload locations must be declared by the manifest before restore preview trusts them.
- user-readable sidecars are not sufficient restore integrity data by themselves.

## Manifest Goals

The manifest is for:

- identifying backup format/version.
- declaring domains included and excluded.
- providing item counts.
- providing compatibility hints.
- providing integrity/checksum markers.
- describing attachment metadata/blob coverage.
- supporting dry-run preview.
- supporting safe restore planning.
- avoiding reading or storing secrets.
- making backup contents inspectable before mutation.
- distinguishing metadata-only, core-data, attachment-aware, and provider-aware backups.

The manifest is not:

- not a runtime database schema.
- not live sync state.
- not credentials storage.
- not Google Drive provider state.
- not Supabase runtime state.
- not a restore mutation plan by itself.
- not a UI contract by itself.
- not a background queue.
- not proof that remote provider payloads are locally available.

## Proposed Manifest Top-level Shape

This is a conceptual contract, not implemented TypeScript.

```ts
interface LocalFirstBackupManifestConcept {
  manifestVersion: string;
  formatVersion: string;
  createdAt: string;
  appVersion: string;
  schemaVersion: string | number;
  backupId: string;
  backupKind: string;
  scopeLevel: number;
  source?: BackupSourceConcept;
  domains: BackupDomainEntryConcept[];
  counts: BackupCountsConcept;
  attachments?: BackupAttachmentManifestConcept;
  integrity?: BackupIntegrityConcept;
  compatibility?: BackupCompatibilityConcept;
  privacy?: BackupPrivacyConcept;
  warnings?: string[];
  limitations?: string[];
}
```

### manifestVersion

Purpose:

- version of the manifest schema itself.

Requirement:

- required.

Future implementation notes:

- restore preview must reject or warn on unsupported manifest versions.
- exact numeric/string versioning policy should be finalized before implementation.

Security/privacy note:

- safe metadata.

### formatVersion

Purpose:

- version of the backup package format that contains the manifest and payloads.

Requirement:

- required.

Future implementation notes:

- package format version may differ from manifest schema version.
- ZIP, JSON-only, or future package formats must state their formatVersion clearly.

Security/privacy note:

- safe metadata.

### createdAt

Purpose:

- ISO timestamp for when the backup manifest was created.

Requirement:

- required.

Future implementation notes:

- use an ISO timestamp.
- preview should report invalid or missing timestamps.

Security/privacy note:

- timestamp can be privacy-sensitive because it reveals user activity timing.

### appVersion

Purpose:

- Absinthe app version that created the backup.

Requirement:

- required.

Future implementation notes:

- use for compatibility hints, not as the only validation gate.

Security/privacy note:

- safe metadata.

### schemaVersion

Purpose:

- local data schema/version captured by the backup.

Requirement:

- required.

Future implementation notes:

- may need domain-level schema versions in addition to this top-level marker.
- restore preview must warn when migration is required.

Security/privacy note:

- safe metadata.

### backupId

Purpose:

- generated identifier for this backup.

Requirement:

- required.

Future implementation notes:

- must be generated as a backup identifier, not derived from user secrets.
- should support audit logs and restore preview correlation.

Security/privacy note:

- backupId must not encode user identity, credentials, hardware ids, or raw file paths.

### backupKind

Purpose:

- high-level kind of backup package.

Requirement:

- required.

Conceptual values:

- `diagnostic-manifest`
- `core-data`
- `full-content`
- `attachment-aware`
- `provider-aware`

Future implementation notes:

- kind should guide preview expectations, not bypass validation.

Security/privacy note:

- safe metadata.

### scopeLevel

Purpose:

- K-235 backup scope level captured by this package.

Requirement:

- required.

Future implementation notes:

- values should map to Level 0 through Level 4.
- restore preview should reject packages whose claimed scope contradicts domain/payload markers.

Security/privacy note:

- safe metadata, but higher scope implies higher privacy risk.

### source

Purpose:

- optional source device/session metadata boundary.

Requirement:

- optional.

Future implementation notes:

- source metadata must be minimal and user-visible.
- no stable hardware fingerprint.
- no credentials.
- no secrets.
- no session token.

Security/privacy note:

- device labels, timezone, locale, and installation ids may identify the user/device and must be treated as privacy-sensitive.

### domains

Purpose:

- inventory of every included/excluded domain.

Requirement:

- required.

Future implementation notes:

- domain inventory must support dry-run preview without reading payload bodies when possible.

Security/privacy note:

- counts and domain names may reveal sensitive habits or content categories.

### counts

Purpose:

- top-level count summary for preview and integrity checks.

Requirement:

- required.

Future implementation notes:

- counts should be cross-checked against domain entries and payload records.

Security/privacy note:

- counts can be privacy-sensitive.

### attachments

Purpose:

- attachment metadata/blob coverage summary.

Requirement:

- optional for Level 0/1, required when attachment metadata or blobs are in scope.

Future implementation notes:

- attachment metadata and attachment blob payload inclusion must be declared separately.

Security/privacy note:

- attachment names, mime types, checksums, and byte sizes can be sensitive.

### integrity

Purpose:

- checksum/count validation boundary.

Requirement:

- optional at first, expected for restore-grade packages.

Future implementation notes:

- K-236 does not require immediate cryptographic implementation.
- future implementation should start with counts and optional checksums before relying on destructive mutation.

Security/privacy note:

- checksums can be identifying for known files and must not be exposed casually.

### compatibility

Purpose:

- hints for restore preview compatibility.

Requirement:

- optional at first, expected for restore-grade packages.

Future implementation notes:

- compatibility hints are for preview, not mutation.

Security/privacy note:

- safe metadata unless it includes environment labels.

### privacy

Purpose:

- declare privacy-sensitive manifest characteristics and exclusions.

Requirement:

- optional at first, recommended for all restore-grade packages.

Future implementation notes:

- should state whether note bodies, attachment names, blobs, provider ids, or diagnostics are present.

Security/privacy note:

- this section helps the user understand backup sensitivity before sharing or restoring.

### warnings

Purpose:

- non-fatal issues discovered during manifest generation.

Requirement:

- optional.

Future implementation notes:

- warnings must be visible in dry-run preview.

Security/privacy note:

- warnings must avoid raw sensitive content unless explicitly user-approved.

### limitations

Purpose:

- known limitations of the backup package.

Requirement:

- optional.

Future implementation notes:

- examples include omitted blob payloads, partial provider state, missing checksums, or unsupported domains.

Security/privacy note:

- limitations may reveal sensitive domain usage.

## Versioning Fields

Required conceptual fields:

- `manifestVersion`: version of the manifest schema.
- `formatVersion`: version of the backup package format.
- `schemaVersion`: local data schema/version captured.
- `appVersion`: Absinthe version that created the backup.
- `createdAt`: ISO timestamp.
- `backupId`: generated backup identifier, not user secret.

Compatibility fields:

- `compatibility.minAppVersion` if needed.
- `compatibility.supportedManifestVersion` if needed.
- `compatibility.supportedFormatVersion` if needed.
- `compatibility.requiresMigration` if needed.

Policy:

- exact numeric/string versioning policy should be finalized before implementation.
- restore preview must reject or warn on unsupported manifest versions.
- restore preview must reject or warn on unsupported format versions.
- restore preview must warn when migration is required.
- version fields must not be used to bypass domain-level integrity checks.

## Backup Kind and Scope Level

### diagnostic-manifest

Typical scope:

- Level 0: metadata-only diagnostic snapshot.

Included:

- domain inventory.
- counts.
- versions.
- warnings.
- compatibility hints.

Excluded:

- raw note bodies.
- raw attachment blobs.
- credentials/tokens/secrets.
- generated/dev-test artifacts.

Restore risk:

- no mutation by itself.

Privacy/storage risk:

- lowest, but counts and domain names may still be sensitive.

First implementation suitability:

- suitable first implementation.

### core-data

Typical scope:

- Level 1: core notes/tasks/settings backup.

Included:

- core structured local app data.
- notes and folders when policy-approved.
- user-owned settings/preferences when policy-approved.

Excluded:

- attachment blobs.
- credentials/tokens/secrets.
- generated/dev-test artifacts.

Restore risk:

- moderate because structured records may conflict.

Privacy/storage risk:

- high if note bodies are included.

First implementation suitability:

- suitable after manifest preview and fixture validation exist.

### full-content

Typical scope:

- Level 2: full local content metadata backup.

Included:

- notes.
- structured app data.
- attachment metadata.
- attachment references.

Excluded:

- attachment blob payloads unless explicitly elevated.

Restore risk:

- high without attachment warning policy.

Privacy/storage risk:

- high.

First implementation suitability:

- not first mutation target.

### attachment-aware

Typical scope:

- Level 3: full content + attachment blobs.

Included:

- attachment metadata.
- blob references.
- blob payloads.
- byte counts and checksum markers where available.

Excluded:

- credentials/tokens/secrets.
- provider auth material.

Restore risk:

- high because payloads can be large, missing, duplicated, or corrupted.

Privacy/storage risk:

- highest local-content privacy/storage risk.

First implementation suitability:

- not first implementation target.

### provider-aware

Typical scope:

- Level 4: provider-aware recovery package.

Included:

- explicitly allowed provider metadata.
- recovery references.
- local payload state where available.

Excluded:

- OAuth access tokens.
- OAuth refresh tokens.
- client secrets.
- Supabase service keys.
- session tokens.
- cookies.
- raw credentials.

Restore risk:

- very high if confused with sync or remote overwrite.

Privacy/storage risk:

- high because provider ids and metadata can identify the user.

First implementation suitability:

- unsuitable until provider policy and real QA are complete.

Recommendation:

- K-236 recommends manifest-first / Level 0 or Level 1 dry-run preview before any restore mutation.

## Domain Inventory in Manifest

Each domain entry should conceptually include:

- domain id.
- included boolean.
- count.
- payload location or inline/sidecar marker.
- schema version.
- integrity marker if available.
- warnings.
- restore eligibility.
- privacy level.

Conceptual domain list:

| Domain | Default manifest stance | Notes |
| --- | --- | --- |
| notes | include when scope allows | Source-verified current `VaultBackupManifest` includes notes. |
| note metadata | include when scope allows | Titles, folders, timestamps, properties, relations, restore metadata where applicable. |
| note relationships/links | include when scope allows | Source-verified current manifests count relations; future link model still needs audit. |
| tags/categories | include only when source-grounded | Current portable vault included list mentions tags/classifications. Final owner needs audit. |
| tasks | unresolved | Include only if source-grounded local persistence is audited. |
| schedule/local calendar-like records | unresolved | Must not be assumed complete until source audit. |
| health/workout records | unresolved/partial | Current extensions include health-local data; final health/workout domain needs audit. |
| settings/preferences | include when user-owned | Must exclude secrets and sessions. Current extensions include some settings-like storage. |
| attachment metadata | include when attachment-aware scope allows | Source-verified metadata is lightweight and separate from blobs. |
| attachment blob references | include when attachment-aware scope allows | Needed to connect notes/metadata to payloads. |
| attachment blobs | exclude unless Level 3 or equivalent | Blob payloads need explicit size, privacy, integrity, and packaging rules. |
| remote provider metadata | unresolved; explicit policy required | Must not be treated as user content without policy. |
| diagnostics state | usually exclude raw logs | Diagnostic summaries may be safe; raw logs may expose sensitive content. |
| sync queue metadata | usually exclude or mark unresolved | Useful for recovery, risky for replay; must not auto-run after restore. |
| local-only UI state | usually exclude | Include only if user-owned and useful across restore. |
| generated/dev-test artifacts | exclude | Static harness outputs, screenshots, build artifacts, and dev/test files are not user data. |

Expected boundaries:

- generated/dev-test artifacts excluded.
- credentials/tokens/secrets excluded.
- attachment blobs require explicit Level 3 or equivalent.
- local-only UI state should usually be excluded or marked unresolved.
- remote provider metadata requires explicit policy.
- sync queue metadata should not be blindly restored.

## Attachment Manifest Boundary

Attachment-related manifest fields should include:

- attachment metadata count.
- blob reference count.
- blob payload included yes/no.
- missing blob markers.
- orphaned blob markers.
- total byte estimate if available.
- checksum markers if available.
- provider reference markers if any.
- storage location marker.

Source-verified current implementation:

- `AttachmentMetadata` includes local blob and remote provider metadata fields.
- `AttachmentMetadata` is lightweight and rejects raw blob data.
- `LocalAttachmentMetadataRepository` stores metadata separately from blob payloads.
- `LocalAttachmentBlobAdapter` stores blob payload records separately.
- blob inventory can expose local blob key, size, mime type, timestamps, checksum, and partial inventory marker.

Policy:

- note metadata should reference attachments by stable ids or explicit references.
- blob payloads should not be embedded inside note JSON.
- blob inclusion must be separate from metadata inclusion.
- restore preview must warn if metadata references blobs that are not included.
- remote provider metadata must not be treated as sufficient proof that blob payload exists locally.
- Google Drive appDataFolder QA remains separate and externally blocked.
- remote provider metadata must not trigger remote writes.

## Integrity/Checksum Boundary

Conceptual integrity fields:

- manifest checksum.
- per-domain checksum.
- per-record checksum if future-approved.
- attachment blob checksum if available.
- payload byte counts.
- count validation.
- warning list.

Policy:

- K-236 does not require immediate cryptographic implementation.
- future implementation should start with counts and optional checksums before relying on destructive mutation.
- Restore preview should report integrity warnings.
- count mismatches should block or warn before any mutation.
- checksum failures should block payload restore until policy explicitly says otherwise.
- checksums can identify known files and must be treated as privacy-sensitive.

## Privacy/Security Exclusions

Manifest must never include:

- OAuth access tokens.
- OAuth refresh tokens.
- client secrets.
- Supabase service keys.
- session tokens.
- cookies.
- raw credentials.
- local generated dev/test HTML artifacts.
- generated/dev-test artifacts.
- logs containing raw sensitive content unless explicitly user-approved.
- background queue secrets.
- provider auth material.
- passwords.
- API keys.

Manifest may include only safe metadata such as:

- provider kind.
- provider record id if policy allows.
- backup creation device label if policy allows.
- app version.
- schema version.
- domain counts.
- package format version.

Privacy-sensitive metadata:

- provider record ids.
- device labels.
- timezone.
- locale.
- timestamps.
- file names.
- attachment mime types.
- byte counts.
- checksums.

If any metadata could identify the user/device, mark it as privacy-sensitive.

## Source Device/Session Metadata Boundary

Source device metadata is optional.

Allowed only with explicit future policy:

- user-visible device label.
- app version.
- broad platform label.
- local installation id only if already policy-approved.

Forbidden:

- stable hardware fingerprint.
- credentials.
- secrets.
- OAuth session id.
- Supabase session id.
- cookies.
- refresh tokens.
- access tokens.
- raw local file paths unless explicitly user-approved.

Guidance:

- no stable hardware fingerprint.
- no credentials.
- no secrets.
- local installation id only if already policy-approved.
- user-visible device label only if user-approved.
- timezone/locale can be privacy-sensitive.
- session id should generally be excluded.

## Restore Compatibility Hints

Conceptual compatibility hints:

- `supportedManifestVersion`.
- `supportedFormatVersion`.
- `sourceSchemaVersion`.
- `targetSchemaVersion`.
- `requiresMigration`.
- `unsupportedDomains`.
- `partialRestoreOnly`.
- `attachmentPayloadMissing`.
- `providerUnavailable`.
- `conflictPolicyRequired`.
- `destructiveRestoreForbidden`.
- `minAppVersion`.
- `warnings`.

Policy:

- these are hints for preview, not mutation.
- restore preview should work offline if the backup package is local.
- preview must warn on unsupported domains.
- preview must warn when attachment metadata references missing blobs.
- preview must warn when provider metadata is present but provider access is unavailable.
- preview must require a separate conflict policy before merge or replace mutation.
- `destructiveRestoreForbidden` must remain true for early/default restore paths.

## Conflict Policy Boundary

K-236 supports conflict preview concepts without implementing a resolver.

Conflict facts:

- record ids may collide.
- `updatedAt` comparisons are insufficient alone.
- deleted records/tombstones need policy.
- attachment conflicts need separate policy.
- settings conflicts need separate policy.
- sync queue conflicts need separate policy.
- provider metadata conflicts need separate policy.

Allowed later, only with explicit policy:

- per-item `skip`.
- per-item `duplicate`.
- per-item `replace`.

Forbidden as early/default path:

- whole-vault destructive replace restore.
- silent overwrite of active local runtime state.
- remote overwrite triggered by restore.
- automatic sync queue replay after restore.

Required distinction:

- current per-note `replace` in `importVaultBackup` is a selected item-level conflict strategy.
- current per-note `replace` is not destructive whole-vault replace restore.
- future docs and UI must not describe per-item replacement as full-vault replacement.

## Export/Import Relationship

Backup manifest may share serialization concepts with export/import.

Export manifest may be different from restore backup manifest.

Import should be additive/preview-first by default.

Restore should be backup-to-local recovery and require stronger safety.

User-readable export may omit restore metadata.

Machine restore backup must include manifest/integrity/compatibility data.

Policy:

- export is for portability.
- backup is for recovery.
- import is for external data entering Absinthe.
- restore is for backup-to-local recovery.
- existing portable vault export code is useful source context, not the final local-first manifest implementation.
- future implementation must explicitly decide whether to extend, replace, or wrap `VaultBackupManifest`.

## Supabase/Remote Sync Relationship

Manifest is not Supabase sync state.

Supabase is not runtime source of truth.

Google Drive/remote providers are not runtime source of truth.

Restore preview should work offline if backup package is local.

Restore mutation should not automatically push restored records to Supabase.

Remote sync after restore requires separate policy.

Provider metadata in manifest should not trigger remote writes.

Failed remote sync must not block local manifest validation.

Google Drive appDataFolder QA remains separate and externally blocked.

Policy:

- remote systems are support layers.
- backup is not live sync.
- provider metadata is not proof of local blob availability.
- provider-aware packages must exclude credentials/tokens/secrets.
- no background sync/upload is introduced by K-236.

## Recommended First Implementation Target

Primary next milestone:

**K-237 Local-first Backup Manifest Audit Test / Fixture Spec**

Scope:

- docs/spec or fixture-only.
- define an example manifest fixture.
- validate manifest fields at the document/fixture level.
- no export implementation.
- no restore implementation.
- no runtime mutation.

Then:

**K-238 Local Backup Manifest Generator Prototype**

Scope:

- generate manifest only.
- no user data payload export yet, or limited metadata-only dry-run.
- no restore mutation.

Then:

**K-239 Backup Dry-run Preview Plan**

Scope:

- parse manifest/package and show summary without mutation.
- define unsupported-domain, missing-attachment, and incompatible-version preview copy.

Alternative if K-237 discovers insufficient source grounding:

**K-237 Local Data Domain Inventory Audit**

Scope:

- audit final domain owners and local persistence boundaries before fixture work.

K-236 chooses **K-237 Local-first Backup Manifest Audit Test / Fixture Spec** as the primary next milestone.

## Non-Goals

- no runtime implementation.
- no manifest generator implementation.
- no backup/export implementation.
- no restore/import implementation.
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

K-236 defines the manifest contract boundary before implementation.

Local runtime data remains source of truth.

Remote systems remain support layers.

Existing per-item replace strategies must not be confused with destructive whole-vault restore.

First implementation should be manifest/dry-run oriented.

Google Drive/remote attachment QA remains a separate external-blocked line.
