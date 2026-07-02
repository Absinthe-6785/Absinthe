# K-235 Local-first Backup/Restore Boundary Spec

## Purpose

K-235 defines local-first backup/restore boundaries for Absinthe.

K-235 is docs/spec only.

K-235 does not implement backup, restore, export, import, sync, conflict resolution, migration, or recovery behavior.

K-235 creates a safety gate before any future mutation or remote backup implementation.

K-235 separates local runtime source-of-truth from remote backup/sync support layers.

## Current Product Stance

Source-verified current direction:

- local IndexedDB/runtime persistence is the source of truth.
- `notePersistence.ts` describes hybrid note persistence with IndexedDB primary and localStorage fallback.
- `syncMode.ts` defaults Notes runtime sync mode to `local`.
- local data must remain usable offline.
- existing vault backup code already uses manifest-based export/import concepts.
- existing restore flow already has preview, conflict strategies, and snapshot support for the current vault pipeline.
- attachment metadata and attachment blobs are separate local IndexedDB-backed resources.
- attachment metadata rejects raw blob data.
- remote attachment upload/recovery is explicit, manual, and local-first.
- Google Drive appDataFolder QA remains externally blocked until a real OAuth/manual QA environment exists.

Inferred boundary from prior specs:

- Supabase is not the runtime source of truth.
- Supabase may support auth, sync metadata, backup metadata, change logs, or account identity.
- Google Drive and other remote providers are not the runtime source of truth.
- remote providers are support layers for backup, recovery, and sync, not the app runtime.
- restore/import must not silently destroy existing local data.
- raw blobs must not be embedded into note JSON.

Unknown / requires future audit:

- final cross-domain backup domain list.
- final backup package schema.
- final conflict policy for cross-device restore.
- final attachment blob packaging policy.
- final encryption/compression policy.
- final Supabase backup metadata contract.

## Terminology

### Local Runtime Data

Local runtime data is data the app reads and writes during normal use.

It is the source of truth for the current session and device.

Examples include local notes, local note metadata, local attachment metadata, local attachment blobs, local settings, and other local workspace state when those domains are persisted locally.

### Backup

A backup is a point-in-time or versioned copy used for recovery.

Backup is not the same as live sync.

A backup may include metadata, structured records, and payloads depending on the selected scope.

### Restore

Restore applies backup data back into local runtime data.

Restore must be explicit, previewable, and reversible where possible.

Restore must not silently overwrite current local data.

### Export

Export is user-portable output.

Export may be human-readable or machine-readable.

Export is not automatically a restore backup because user-readable exports may omit internal metadata needed for safe restore.

### Import

Import brings external data into Absinthe.

Import should be additive and preview-first by default.

Import is not the same as restore because imported data may not come from an Absinthe recovery backup.

### Sync

Sync is ongoing reconciliation between local and remote state.

Sync is not the same as backup or restore.

Sync requires its own conflict policy, cursors, retry rules, and remote boundary.

### Recovery

Recovery is guided repair after corruption, missing blobs, failed sync, partial restore, or inconsistent metadata.

Recovery may use backups, snapshots, diagnostics, or remote support layers.

Recovery is not automatically a full restore.

### Snapshot

A snapshot is a captured state at a point in time.

Snapshots may support backup, diagnostics, rollback, restore preview, or pre-mutation safety.

## Data Domain Inventory

This inventory is a boundary map, not an implementation schema.

| Domain | Boundary classification | Notes |
| --- | --- | --- |
| notes | should be included in backup | Source-verified current backup manifests include notes. |
| note metadata | should be included in backup | Includes titles, folders, timestamps, properties, relations, and restore metadata where applicable. |
| note relationships / links | should be included in backup | Source-verified current manifests count relations. Exact future link model needs audit. |
| tags/categories | requires separate policy | Tags may exist through note properties/frontmatter; final domain owner needs audit. |
| tasks | requires separate policy | Include when task domain is locally persisted and source-grounded. |
| schedule/calendar-like local data | requires separate policy | Must not be assumed complete until source audit. |
| health/workout data | requires separate policy | Existing vault extensions mention health, but final backup domain requires source audit. |
| settings/preferences | should be included in backup where user-owned | Must exclude secrets and sessions. |
| attachment metadata | should be included in backup | Source-verified metadata is lightweight and separate from blobs. |
| attachment blob references | should be included in backup | References are necessary to connect notes/metadata to blobs. |
| attachment blobs | requires separate policy | Blob payloads require size, privacy, integrity, and packaging rules. |
| remote provider metadata | requires separate policy | Must not be treated as user content without explicit policy. |
| diagnostics state | requires separate policy | Diagnostic summaries may be safe; raw logs may expose sensitive content. |
| sync queue metadata | requires separate policy | Useful for recovery, risky for replay; must not auto-run after restore. |
| local-only UI state | should usually be excluded | Include only if user-owned and useful across restore. |
| generated/dev-test artifacts | should be excluded | Static harness outputs, screenshots, build artifacts, and dev/test files are not user data. |
| credentials/tokens/session data | should be excluded | No OAuth tokens, Supabase secrets, Google Drive credentials, or sessions. |
| raw local cache internals | should usually be excluded | Include only when explicitly needed for integrity/recovery and documented. |

Expected boundaries:

- generated/dev-test artifacts are excluded.
- credentials/tokens are excluded.
- raw local cache internals are excluded unless a future spec makes a narrow exception.
- attachment blobs are handled separately from note JSON and attachment metadata.
- remote provider metadata is not user content until policy says otherwise.

## Backup Scope Levels

### Level 0: Metadata-only Diagnostic Snapshot

Purpose:

- safe debugging.
- domain inventory.
- counts, versions, warnings, and integrity markers.

Boundary:

- no raw note body.
- no raw blobs.
- no credentials.
- no user-sensitive logs unless explicitly approved.

### Level 1: Core Notes/Tasks/Settings Backup

Purpose:

- structured app data backup without binary blob payloads.

Boundary:

- notes and structured local app data.
- settings/preferences that are user-owned.
- no attachment blobs yet.
- no credentials.

### Level 2: Full Local Content Backup

Purpose:

- notes, tasks, settings, attachment metadata, and references.

Boundary:

- may include blob references.
- blob payloads may still be separate payloads.
- requires explicit missing-blob warnings.

### Level 3: Full Content + Attachment Blobs

Purpose:

- complete local content recovery including binary payloads.

Boundary:

- includes binary blobs.
- highest storage and privacy risk.
- requires explicit user consent, size handling, checksums, and partial failure reporting.

### Level 4: Provider-aware Recovery Package

Purpose:

- includes enough provider metadata to reconcile remote backups.

Boundary:

- must exclude credentials/tokens.
- must not treat remote provider state as complete source of truth.
- must not trigger remote mutation automatically.

Recommended first implementation target:

- start with a manifest/metadata boundary and dry-run preview before any full restore mutation.
- K-236 should specify the manifest before implementation.

## Restore Modes

### Preview Restore

Preview restore parses backup data and shows a summary without mutation.

Preview restore is the first required step.

### Additive Import-style Restore

Additive restore adds missing records and avoids overwriting existing records.

This is the safest first mutation mode.

### Merge Restore

Merge restore compares current local data and backup data.

Merge restore requires conflict policy before implementation.

### Replace Restore

Replace restore is destructive.

Destructive replace restore is forbidden as an early implementation path.

Destructive replace restore must never be the default.

Destructive replace restore should remain blocked until strong snapshot, rollback, preview, and conflict policy exist.

### Recovery Repair

Recovery repair targets missing blobs, broken metadata, failed queues, or partial restore leftovers.

Recovery repair is not a full restore.

## Safety Principles

Required principles:

- preview before mutation.
- explicit user confirmation.
- no silent overwrite.
- no destructive restore by default.
- backup format versioning.
- restore dry-run summary.
- rollback snapshot before mutation.
- idempotency where possible.
- partial failure reporting.
- attachment blob integrity checks.
- manifest checksums or equivalent integrity plan.
- no credentials in backup.
- no generated artifacts in backup.
- local app remains usable if remote is unavailable.
- restore must not trigger background sync/upload automatically unless explicitly approved.
- restore must not alter remote providers without separate confirmation.
- restore must not auto-run attachment upload/recovery queues.
- unsupported backup versions must fail safely.
- restore results must report skipped records.

## Conflict Policy Boundary

K-235 does not implement conflict resolution.

Unresolved conflict questions:

- if local and backup both contain the same note id with different `updatedAt`, what happens?
- are note ids stable across devices?
- should restore preserve original ids or remap?
- how are deleted records represented?
- is there a tombstone model for each data domain?
- how should attachment reference conflicts be handled?
- how should missing local blobs but present remote blob references be handled?
- how should settings conflicts be handled?
- how should health data conflicts be handled?
- how should schedule data conflicts be handled?
- how should remote provider metadata conflicts be handled?
- should conflict choices be per-domain or per-record?

Recommendation:

- K-236 or later should create a Conflict Policy Spec before merge restore or replace restore.
- additive restore can be planned earlier because it avoids overwriting existing records.

## Attachment Boundary

Source-verified attachment boundary:

- notes metadata and attachment blobs are separate.
- attachment metadata is lightweight.
- attachment metadata cannot contain raw blob data.
- attachment blobs are stored separately from metadata.
- attachment references use an `attachment://` reference scheme.
- remote attachment upload/recovery remains explicit and manually gated.

Future backup boundary:

- backup manifest may reference blobs.
- blob payload backup requires separate storage, size, privacy, and integrity policy.
- missing blob recovery must be explicit.
- orphaned blob handling should be diagnostic-first.
- remote provider state should not be trusted as complete source of truth.
- Google Drive appDataFolder QA remains blocked until an external environment exists.
- restore must not upload blobs automatically without explicit user action.
- restore must not delete local blobs automatically.
- restore must not delete remote blobs automatically.

## Supabase / Remote Sync Boundary

Supabase is not the runtime source of truth.

Supabase may support:

- auth.
- account identity.
- sync metadata.
- backup metadata.
- change log.
- remote support for explicitly enabled sync modes.

Remote sync and backup/restore must not be conflated.

Restore should not automatically push restored data to Supabase unless separately approved.

Failed remote sync must not block local restore preview.

Conflict policy must exist before bidirectional sync/restore mutation.

Local mode must remain usable without Supabase.

Remote systems remain support layers.

## Export / Import Boundary

Export is for portability.

Backup is for recovery.

Import is additive and external-data oriented.

Restore is backup-to-local recovery.

Export/import can share serialization primitives with backup/restore.

Export/import and backup/restore must have different UX and safety rules.

User-readable export may omit internal metadata.

Machine restore backup must include version, manifest, domain inventory, and integrity metadata.

Import should default to preview/additive behavior.

Restore should default to preview and must not silently replace local data.

## Backup Format Boundary

K-235 does not define or implement a concrete schema.

Expected future package shape:

- manifest.
- formatVersion.
- createdAt.
- appVersion.
- deviceId or local installation id if policy allows.
- domains included.
- counts per domain.
- checksums/integrity markers.
- records payload.
- attachment manifest.
- blob payload references.
- warnings/limitations.
- no credentials/tokens.
- no generated artifacts.
- no raw diagnostics logs unless explicitly approved.

Exact schema should be defined in a future K-236/K-237 before implementation.

## Restore UX Boundary

Restore starts from preview.

User sees:

- backup format version.
- created/exported date.
- app version.
- included domains.
- counts and affected domains.
- attachment/blob warnings.
- unsupported domains or unsupported backup version warnings.
- conflicts before mutation.
- skipped records.
- expected mutation mode.

User can cancel before mutation.

Restore result shows:

- success.
- partial failure.
- skipped records.
- failed records.
- post-restore warnings.

Destructive restore requires separate future approval, rollback snapshot, and explicit confirmation.

## Diagnostics / Maintenance Boundary

Backup/restore should connect to diagnostics later.

Local data health checks should be able to detect:

- missing attachment blobs.
- orphaned blobs.
- broken note-to-attachment references.
- stale remote metadata.
- failed queue entries.
- unsupported backup version.
- partial restore leftovers.
- missing domain payloads.
- checksum mismatches.
- metadata/blob count mismatches.

K-235 does not implement diagnostics.

## Security / Privacy Boundary

No OAuth tokens in backup.

No Supabase keys/secrets in backup.

No Google Drive credentials in backup.

No session data in backup.

No generated HTML/dev artifacts in backup.

No logs containing raw sensitive content unless explicitly user-approved.

Backups may contain sensitive user content and must be treated as private.

Encryption and compression are future policy decisions.

Redaction rules are needed for diagnostics exports.

Backup file names and metadata should avoid leaking unnecessary sensitive details.

Provider errors and diagnostics must not include credentials, tokens, authorization headers, callback URLs, or raw provider response bodies.

## Non-Goals

- no runtime implementation.
- no backup/export implementation.
- no restore/import implementation.
- no schema migration.
- no IndexedDB migration.
- no Supabase sync changes.
- no Google Drive changes.
- no attachment remote upload/recovery changes.
- no background sync/upload.
- no auto backup.
- no destructive replace restore.
- no conflict resolver.
- no UI implementation.
- no route/navigation changes.
- no Health/Schedule behavior changes.
- no Notes/Cosmos changes.
- no assets/fonts/dependencies.
- no Google Drive QA work.

## Recommended Next Milestones

Recommended:

**K-236 Local-first Backup Manifest Spec**

Scope:

- docs/spec only.
- define manifest fields.
- define `formatVersion`.
- define domain inventory.
- define counts.
- define integrity markers.
- define warnings/limitations.
- no runtime implementation.

Then:

**K-237 Backup Dry-run Preview Plan**

Scope:

- docs/plan only.
- define how to parse and summarize backup without mutation.
- define preview result shape.
- define unsupported-domain reporting.

Then:

**K-238 Local Backup Export Prototype**

Scope:

- implementation only if specs are ready.
- no restore mutation yet.
- no destructive replace restore.

Alternative:

**K-236 Local Data Domain Inventory Audit**

Use this instead if current data domains are not sufficiently source-grounded before manifest design.

## Closure Statement

K-235 defines the safety boundary before backup/restore implementation.

Local runtime data remains the source of truth.

Remote systems remain support layers.

First implementation should be manifest/dry-run oriented, not destructive restore.

Google Drive/remote attachment QA remains a separate external-blocked line.
