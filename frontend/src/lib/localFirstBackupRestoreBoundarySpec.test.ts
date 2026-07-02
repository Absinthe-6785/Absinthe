import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-235-local-first-backup-restore-boundary-spec.md');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-235 local-first backup/restore boundary spec', () => {
  it('adds the K-235 boundary spec and core local-first stance', () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc();
    expect(doc).toContain('K-235 Local-first Backup/Restore Boundary Spec');
    expect(doc).toContain('K-235 is docs/spec only.');
    expect(doc).toContain('local IndexedDB/runtime persistence is the source of truth.');
    expect(doc).toContain('Supabase is not the runtime source of truth.');
    expect(doc).toContain('Google Drive and other remote providers are not the runtime source of truth.');
    expect(doc).toContain('local data must remain usable offline.');
  });

  it('defines terminology for backup, restore, export, import, sync, recovery, and snapshot', () => {
    const doc = readDoc();

    for (const required of [
      '### Local Runtime Data',
      '### Backup',
      'A backup is a point-in-time or versioned copy used for recovery.',
      '### Restore',
      'Restore applies backup data back into local runtime data.',
      '### Export',
      'Export is user-portable output.',
      '### Import',
      'Import brings external data into Absinthe.',
      '### Sync',
      'Sync is ongoing reconciliation between local and remote state.',
      '### Recovery',
      'Recovery is guided repair after corruption, missing blobs, failed sync, partial restore, or inconsistent metadata.',
      '### Snapshot',
      'A snapshot is a captured state at a point in time.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines the data domain inventory and key inclusion/exclusion boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Data Domain Inventory',
      '| notes | should be included in backup |',
      '| note metadata | should be included in backup |',
      '| attachment metadata | should be included in backup |',
      '| attachment blob references | should be included in backup |',
      '| attachment blobs | requires separate policy |',
      '| generated/dev-test artifacts | should be excluded |',
      '| credentials/tokens/session data | should be excluded |',
      'generated/dev-test artifacts are excluded.',
      'credentials/tokens are excluded.',
      'attachment blobs are handled separately from note JSON and attachment metadata.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines backup scope levels and recommends a safe first target', () => {
    const doc = readDoc();

    for (const required of [
      '## Backup Scope Levels',
      '### Level 0: Metadata-only Diagnostic Snapshot',
      '### Level 1: Core Notes/Tasks/Settings Backup',
      '### Level 2: Full Local Content Backup',
      '### Level 3: Full Content + Attachment Blobs',
      '### Level 4: Provider-aware Recovery Package',
      'start with a manifest/metadata boundary and dry-run preview before any full restore mutation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines restore modes and forbids destructive replace restore early/default', () => {
    const doc = readDoc();

    for (const required of [
      '## Restore Modes',
      '### Preview Restore',
      'Preview restore is the first required step.',
      '### Additive Import-style Restore',
      'This is the safest first mutation mode.',
      '### Merge Restore',
      'Merge restore requires conflict policy before implementation.',
      '### Replace Restore',
      'Destructive replace restore is forbidden as an early implementation path.',
      'Destructive replace restore must never be the default.',
      '### Recovery Repair',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines safety principles and conflict policy boundary', () => {
    const doc = readDoc();

    for (const required of [
      '## Safety Principles',
      'preview before mutation.',
      'explicit user confirmation.',
      'no silent overwrite.',
      'no destructive restore by default.',
      'backup format versioning.',
      'restore dry-run summary.',
      'rollback snapshot before mutation.',
      'attachment blob integrity checks.',
      'manifest checksums or equivalent integrity plan.',
      'no credentials in backup.',
      'no generated artifacts in backup.',
      'restore must not trigger background sync/upload automatically unless explicitly approved.',
      '## Conflict Policy Boundary',
      'K-235 does not implement conflict resolution.',
      'if local and backup both contain the same note id with different `updatedAt`, what happens?',
      'is there a tombstone model for each data domain?',
      'K-236 or later should create a Conflict Policy Spec before merge restore or replace restore.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines attachment and Supabase/remote sync boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Attachment Boundary',
      'notes metadata and attachment blobs are separate.',
      'attachment metadata is lightweight.',
      'attachment metadata cannot contain raw blob data.',
      'attachment blobs are stored separately from metadata.',
      'backup manifest may reference blobs.',
      'blob payload backup requires separate storage, size, privacy, and integrity policy.',
      'Google Drive appDataFolder QA remains blocked until an external environment exists.',
      'restore must not upload blobs automatically without explicit user action.',
      '## Supabase / Remote Sync Boundary',
      'Supabase is not the runtime source of truth.',
      'Remote sync and backup/restore must not be conflated.',
      'Restore should not automatically push restored data to Supabase unless separately approved.',
      'Local mode must remain usable without Supabase.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines export/import, backup format, restore UX, diagnostics, and security boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Export / Import Boundary',
      'Export is for portability.',
      'Backup is for recovery.',
      'Import is additive and external-data oriented.',
      'Restore is backup-to-local recovery.',
      'Machine restore backup must include version, manifest, domain inventory, and integrity metadata.',
      '## Backup Format Boundary',
      'K-235 does not define or implement a concrete schema.',
      'formatVersion.',
      'domains included.',
      'checksums/integrity markers.',
      'attachment manifest.',
      'no credentials/tokens.',
      'no generated artifacts.',
      '## Restore UX Boundary',
      'Restore starts from preview.',
      'User can cancel before mutation.',
      'Destructive restore requires separate future approval, rollback snapshot, and explicit confirmation.',
      '## Diagnostics / Maintenance Boundary',
      'missing attachment blobs.',
      'orphaned blobs.',
      'failed queue entries.',
      'K-235 does not implement diagnostics.',
      '## Security / Privacy Boundary',
      'No OAuth tokens in backup.',
      'No Supabase keys/secrets in backup.',
      'No Google Drive credentials in backup.',
      'Backups may contain sensitive user content and must be treated as private.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and recommends K-236 Local-first Backup Manifest Spec', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-Goals',
      'no runtime implementation.',
      'no backup/export implementation.',
      'no restore/import implementation.',
      'no schema migration.',
      'no IndexedDB migration.',
      'no Supabase sync changes.',
      'no Google Drive changes.',
      'no attachment remote upload/recovery changes.',
      'no background sync/upload.',
      'no auto backup.',
      'no destructive replace restore.',
      'no conflict resolver.',
      'no UI implementation.',
      'no route/navigation changes.',
      'no Health/Schedule behavior changes.',
      'no Notes/Cosmos changes.',
      'no assets/fonts/dependencies.',
      'no Google Drive QA work.',
      '## Recommended Next Milestones',
      '**K-236 Local-first Backup Manifest Spec**',
      'define manifest fields.',
      'no runtime implementation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('ends with a local-first closure statement', () => {
    const doc = readDoc();

    for (const required of [
      'K-235 defines the safety boundary before backup/restore implementation.',
      'Local runtime data remains the source of truth.',
      'Remote systems remain support layers.',
      'First implementation should be manifest/dry-run oriented, not destructive restore.',
      'Google Drive/remote attachment QA remains a separate external-blocked line.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
