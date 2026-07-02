import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-239-local-backup-manifest-integration-boundary-audit.md');
const localFirstManifestPath = join(process.cwd(), 'src', 'lib', 'localFirstBackupManifest.ts');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-239 local backup manifest integration boundary audit', () => {
  it('adds the K-239 integration boundary audit doc with no-runtime-change stance', () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc();
    for (const required of [
      'K-239 Local Backup Manifest Integration Boundary Audit',
      'K-239 is docs/audit or test-only.',
      'K-239 does not implement integration.',
      'K-239 does not change ZIP export behavior.',
      'K-239 does not change restore/import behavior.',
      'K-239 does not mutate persistence.',
      'K-239 decides the K-240 path before export or import behavior changes.',
      'no exportVaultBackup integration in K-239.',
      'no ZIP manifest.json behavior change.',
      'no restore/import mutation.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes the K-238 generator/validator state and mapping', () => {
    const doc = readDoc();
    for (const required of [
      'K-238 generator/validator prototype exists.',
      'K-238 is metadata-only.',
      'K-238 has key-level and value-level secret guards.',
      'K-238 scans nested arrays and objects for obvious credential/token/secret-like values.',
      'K-238 validates backupKind/scopeLevel mapping.',
      '`diagnostic-manifest` => `0`.',
      '`core-data` => `1`.',
      '`full-content-metadata` => `2`.',
      '`full-content-with-blobs` => `3`.',
      '`provider-aware-recovery` => `4`.',
      '`destructiveWholeVaultReplaceAllowed` must remain false.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents source inspection findings for the required implementation surfaces', () => {
    const doc = readDoc();
    for (const required of [
      '## Source Inspection Findings',
      '### localFirstBackupManifest',
      'File inspected: `frontend/src/lib/localFirstBackupManifest.ts`.',
      '### localFirstBackupManifest tests',
      'File inspected: `frontend/src/lib/localFirstBackupManifest.test.ts`.',
      '### exportVaultBackup',
      'File inspected: `frontend/src/lib/exportVaultBackup.ts`.',
      '### VaultBackupManifest',
      '### ZIP manifest.json creation',
      'File inspected: `frontend/src/lib/vaultBackupZip.ts`.',
      '### importVaultBackup',
      'File inspected: `frontend/src/lib/importVaultBackup.ts`.',
      '### vaultRestorePipeline',
      'File inspected: `frontend/src/lib/vaultRestorePipeline.ts`.',
      '### backupBeforeRestore',
      '### attachment metadata/blob export handling',
      'File inspected: `frontend/src/lib/attachmentRepository.ts`.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines VaultBackupManifest and ZIP manifest.json relationships without choosing replacement', () => {
    const doc = readDoc();
    for (const required of [
      '## Existing VaultBackupManifest Relationship',
      'current implementation-facing manifest is `VaultBackupManifest`.',
      'source-verified `VAULT_BACKUP_SCHEMA_VERSION` is `3`.',
      'source-verified `VAULT_EXPORT_KIND` is `absinthe-vault-export`.',
      'it already acts as the JSON export payload and ZIP `manifest.json` payload.',
      'Wrap existing `VaultBackupManifest` inside `LocalFirstBackupManifest`.',
      'Extend existing `VaultBackupManifest` toward `LocalFirstBackupManifest`.',
      'Keep `LocalFirstBackupManifest` separate as diagnostic/validation metadata.',
      'Replace ZIP `manifest.json` later.',
      'prefer wrapper or sidecar/diagnostic-first.',
      '## ZIP manifest.json Relationship',
      '`parseVaultBackupZip` reads `manifest.json`.',
      '`parseVaultBackupZip` calls `normalizeVaultBackupManifest`.',
      'direct replacement by `LocalFirstBackupManifest` would fail current import without parser and restore preview changes.',
      'do not change ZIP `manifest.json` in K-239.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines export integration, validator usage, and failure behavior boundaries', () => {
    const doc = readDoc();
    for (const required of [
      '## exportVaultBackup Integration Boundary',
      'dry-run diagnostic validation only.',
      'no output shape change.',
      'do not block user export unless validation detects severe privacy/security violations.',
      '## Validator Usage Boundary',
      'Unit-test-only validator.',
      'Export diagnostic validator.',
      'Hard gate before writing ZIP.',
      'Restore preview validator.',
      'use as export diagnostic validator first.',
      'credentials/tokens/secrets present.',
      'invalid backupKind/scopeLevel pair.',
      'raw blob payload embedded in manifest JSON.',
      'do not use validator to perform mutation.',
      '## Failure Behavior',
      'privacy/security violations should fail hard.',
      'compatibility warnings may not block export initially.',
      'validation errors must not print sensitive values.',
      'restore/import mutation remains out of scope.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines attachment and import/restore boundaries', () => {
    const doc = readDoc();
    for (const required of [
      '## Attachment Scope Boundary',
      'do not move, copy, delete, upload, or download blobs in K-239.',
      'do not claim blob payload inclusion unless source-verified.',
      'attachment blob scopeLevel 3+ remains non-goal unless explicitly approved later.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      '## Import/Restore Boundary',
      '`importVaultBackup` relationship:',
      '`vaultRestorePipeline` relationship:',
      '`backupBeforeRestore` relationship:',
      'per-item `skip`, `duplicate`, and `replace` remain distinct from destructive whole-vault replace restore.',
      'per-item replace is an explicit conflict strategy for selected records.',
      'future manifest integration must not make restore destructive by default.',
      'restore preview/dry-run must exist before any broad restore mutation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines security/privacy and K-240 option boundaries', () => {
    const doc = readDoc();
    for (const required of [
      '## Security/Privacy Boundary',
      'no credentials/tokens/secrets in manifest or errors.',
      'K-238 value-level guard should remain.',
      'validation errors should identify key/path, not secret value.',
      'no OAuth material.',
      'no Supabase service role keys.',
      'no Google Drive auth material.',
      'no raw blob data URL inside manifest JSON.',
      'no network calls.',
      'no background jobs.',
      '## Integration Options for K-240',
      'Option A: Manifest export diagnostic audit',
      'Option B: Manifest sidecar/wrapper plan',
      'Option C: Export path diagnostic integration',
      'Option D: Replace ZIP manifest.json',
      'Preferred K-240:',
      'K-240 Local Backup Manifest Export Integration Plan',
      'K-240 VaultBackupManifest Compatibility Audit',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and closes the local-first boundary', () => {
    const doc = readDoc();
    for (const required of [
      '## Non-Goals',
      'no VaultBackupManifest type change.',
      'no backup/export payload implementation.',
      'no importVaultBackup change.',
      'no vaultRestorePipeline change.',
      'no backupBeforeRestore change.',
      'no schema migration.',
      'no IndexedDB migration.',
      'no Supabase sync changes.',
      'no Google Drive changes.',
      'no OAuth changes.',
      'no attachment remote upload/recovery changes.',
      'no UI implementation.',
      'no route/navigation changes.',
      'no Health/Schedule behavior changes.',
      'no Notes/Cosmos changes.',
      'no assets/fonts/dependencies.',
      'K-239 decides the integration boundary before touching export/import behavior.',
      'K-238 manifest generator remains metadata-only.',
      'Existing per-item replace strategies remain distinct from destructive whole-vault restore.',
      'ZIP manifest.json changes require a separate plan or integration PR.',
      'Remote systems remain support layers.',
      'Local runtime data remains source of truth.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('keeps the K-238 manifest generator isolated from export/import/restore runtime modules', () => {
    const source = readFileSync(localFirstManifestPath, 'utf8');
    for (const forbidden of [
      'exportVaultBackup',
      'importVaultBackup',
      'vaultRestorePipeline',
      'vaultBackupZip',
      'JSZip',
      'fetch(',
      'localStorage',
      'indexedDB',
      'Google' + 'Drive',
      'O' + 'Auth',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/from\s+['"][^'"]*supabase/i);
    expect(source).not.toMatch(/import\s*\([^)]*supabase/i);
  });
});
