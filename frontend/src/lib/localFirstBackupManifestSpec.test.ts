import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-236-local-first-backup-manifest-spec.md');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-236 local-first backup manifest spec', () => {
  it('adds the K-236 manifest spec and docs-only local-first stance', () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc();
    for (const required of [
      'K-236 Local-first Backup Manifest Spec',
      'K-236 is docs/spec only.',
      'K-236 does not implement manifest generation.',
      'local runtime data remains source of truth.',
      'Supabase is not runtime source of truth.',
      'Google Drive/remote providers are not runtime source of truth.',
      'remote systems are support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents existing implementation relationship and replace terminology', () => {
    const doc = readDoc();
    for (const required of [
      '## Existing Implementation Relationship',
      '### VaultBackupManifest',
      '`exportVaultBackup.ts` defines `VaultBackupManifest`.',
      '### importVaultBackup',
      '`importVaultBackup.ts` exists.',
      '`importVaultBackup.ts` defines `VaultRestoreConflictStrategy` as `skip`, `replace`, or `duplicate`.',
      'Existing per-note or per-item `replace` conflict strategy is not the same as whole-vault destructive replace restore.',
      'K-236 must not reinterpret current import behavior as approval for full destructive restore.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines manifest goals and top-level shape', () => {
    const doc = readDoc();
    for (const required of [
      '## Manifest Goals',
      'identifying backup format/version.',
      'declaring domains included and excluded.',
      'supporting dry-run preview.',
      'making backup contents inspectable before mutation.',
      '## Proposed Manifest Top-level Shape',
      'manifestVersion',
      'formatVersion',
      'createdAt',
      'appVersion',
      'schemaVersion',
      'backupId',
      'backupKind',
      'scopeLevel',
      'domains',
      'attachments',
      'integrity',
      'compatibility',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines versioning, backup kind, and scope levels', () => {
    const doc = readDoc();
    for (const required of [
      '## Versioning Fields',
      '`manifestVersion`: version of the manifest schema.',
      '`formatVersion`: version of the backup package format.',
      '`schemaVersion`: local data schema/version captured.',
      'restore preview must reject or warn on unsupported manifest versions.',
      '## Backup Kind and Scope Level',
      '### diagnostic-manifest',
      '### core-data',
      '### full-content',
      '### attachment-aware',
      '### provider-aware',
      'K-236 recommends manifest-first / Level 0 or Level 1 dry-run preview before any restore mutation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines domain inventory and inclusion/exclusion boundaries', () => {
    const doc = readDoc();
    for (const required of [
      '## Domain Inventory in Manifest',
      '| notes | include when scope allows |',
      '| note metadata | include when scope allows |',
      '| note relationships/links | include when scope allows |',
      '| attachment metadata | include when attachment-aware scope allows |',
      '| attachment blobs | exclude unless Level 3 or equivalent |',
      '| generated/dev-test artifacts | exclude |',
      'generated/dev-test artifacts excluded.',
      'credentials/tokens/secrets excluded.',
      'attachment blobs require explicit Level 3 or equivalent.',
      'sync queue metadata should not be blindly restored.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines attachment manifest and integrity/checksum boundaries', () => {
    const doc = readDoc();
    for (const required of [
      '## Attachment Manifest Boundary',
      'attachment metadata count.',
      'blob reference count.',
      'blob payload included yes/no.',
      'missing blob markers.',
      'orphaned blob markers.',
      'remote provider metadata must not be treated as sufficient proof that blob payload exists locally.',
      '## Integrity/Checksum Boundary',
      'manifest checksum.',
      'per-domain checksum.',
      'attachment blob checksum if available.',
      'K-236 does not require immediate cryptographic implementation.',
      'Restore preview should report integrity warnings.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines privacy/security exclusions and source metadata boundary', () => {
    const doc = readDoc();
    for (const required of [
      '## Privacy/Security Exclusions',
      'Manifest must never include:',
      'OAuth access tokens.',
      'OAuth refresh tokens.',
      'client secrets.',
      'Supabase service keys.',
      'session tokens.',
      'cookies.',
      'raw credentials.',
      'local generated dev/test HTML artifacts.',
      'provider auth material.',
      '## Source Device/Session Metadata Boundary',
      'Source device metadata is optional.',
      'no stable hardware fingerprint.',
      'no credentials.',
      'no secrets.',
      'session id should generally be excluded.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines restore compatibility, conflict, export/import, and remote sync relationships', () => {
    const doc = readDoc();
    for (const required of [
      '## Restore Compatibility Hints',
      '`supportedManifestVersion`.',
      '`supportedFormatVersion`.',
      '`requiresMigration`.',
      '`attachmentPayloadMissing`.',
      '`providerUnavailable`.',
      '`conflictPolicyRequired`.',
      '`destructiveRestoreForbidden`.',
      '## Conflict Policy Boundary',
      'record ids may collide.',
      '`updatedAt` comparisons are insufficient alone.',
      'per-item `skip`.',
      'per-item `duplicate`.',
      'per-item `replace`.',
      'whole-vault destructive replace restore.',
      '## Export/Import Relationship',
      'Export manifest may be different from restore backup manifest.',
      'Machine restore backup must include manifest/integrity/compatibility data.',
      '## Supabase/Remote Sync Relationship',
      'Manifest is not Supabase sync state.',
      'Provider metadata in manifest should not trigger remote writes.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends K-237 and lists non-goals including no Google Drive QA work', () => {
    const doc = readDoc();
    for (const required of [
      '## Recommended First Implementation Target',
      '**K-237 Local-first Backup Manifest Audit Test / Fixture Spec**',
      'define an example manifest fixture.',
      'no export implementation.',
      'no restore implementation.',
      '## Non-Goals',
      'no runtime implementation.',
      'no manifest generator implementation.',
      'no backup/export implementation.',
      'no restore/import implementation.',
      'no schema migration.',
      'no IndexedDB migration.',
      'no Supabase sync changes.',
      'no Google Drive changes.',
      'no OAuth changes.',
      'no attachment remote upload/recovery changes.',
      'no background sync/upload.',
      'no auto backup.',
      'no destructive whole-vault restore.',
      'no conflict resolver.',
      'no UI implementation.',
      'no route/navigation changes.',
      'no Health/Schedule behavior changes.',
      'no Notes/Cosmos changes.',
      'no assets/fonts/dependencies.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('ends with the required closure statement', () => {
    const doc = readDoc();
    for (const required of [
      'K-236 defines the manifest contract boundary before implementation.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
      'Existing per-item replace strategies must not be confused with destructive whole-vault restore.',
      'First implementation should be manifest/dry-run oriented.',
      'Google Drive/remote attachment QA remains a separate external-blocked line.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
