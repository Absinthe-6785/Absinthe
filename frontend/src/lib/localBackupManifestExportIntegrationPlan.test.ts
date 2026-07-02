import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-240-local-backup-manifest-export-integration-plan.md');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-240 local backup manifest export integration plan', () => {
  it('adds the K-240 export integration plan with docs-only boundaries', () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc();
    for (const required of [
      'K-240 Local Backup Manifest Export Integration Plan',
      'K-240 is docs/plan only.',
      'K-240 does not change export behavior.',
      'K-240 does not replace ZIP manifest.json.',
      'K-240 does not change restore/import behavior.',
      'K-240 defines K-241 implementation scope.',
      'no export behavior change in K-240.',
      'no ZIP manifest.json replacement.',
      'no restore/import mutation.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes the current K-238 and K-239 state', () => {
    const doc = readDoc();
    for (const required of [
      'K-238 `localFirstBackupManifest` generator/validator exists.',
      'K-238 is metadata-only.',
      'K-238 enforces key-level and value-level privacy guards.',
      'K-238 recursively inspects nested arrays and objects for obvious credential/token/secret-like values.',
      'K-238 validates backupKind/scopeLevel mapping.',
      'K-239 concluded direct ZIP manifest.json replacement is not recommended.',
      'Existing `VaultBackupManifest` v3 remains unchanged.',
      'Existing ZIP manifest.json remains unchanged.',
      'Existing `importVaultBackup` and `vaultRestorePipeline` behavior remains unchanged.',
      'local runtime data remains source of truth.',
      'remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents source inspection findings for export, ZIP, import, restore, and attachment surfaces', () => {
    const doc = readDoc();
    for (const required of [
      '## Source Inspection Findings',
      '### localFirstBackupManifest',
      'File inspected: `frontend/src/lib/localFirstBackupManifest.ts`.',
      '### exportVaultBackup',
      'File inspected: `frontend/src/lib/exportVaultBackup.ts`.',
      '### VaultBackupManifest',
      '### ZIP manifest.json generation',
      'File inspected: `frontend/src/lib/vaultBackupZip.ts`.',
      '### importVaultBackup',
      'File inspected: `frontend/src/lib/importVaultBackup.ts`.',
      '### vaultRestorePipeline',
      'File inspected: `frontend/src/lib/vaultRestorePipeline.ts`.',
      '### backupBeforeRestore',
      '### attachment export behavior',
      'Files inspected:',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares all integration options and chooses diagnostic-only first', () => {
    const doc = readDoc();
    for (const required of [
      '## Integration Options',
      '### Option A: Diagnostic-only export integration',
      'export path constructs local-first manifest metadata.',
      'ZIP output remains unchanged.',
      'no sidecar file added.',
      'no import compatibility impact.',
      '### Option B: ZIP sidecar manifest',
      'keep existing manifest.json unchanged.',
      'add local-first manifest as a separate sidecar file.',
      '### Option C: Wrapper/nested manifest',
      'existing manifest.json wraps or nests `localFirstBackupManifest`.',
      '### Option D: Direct manifest.json replacement',
      'replace current `VaultBackupManifest`/manifest.json with `LocalFirstBackupManifest`.',
      'K-240 choice:',
      '**Option A: diagnostic-only export integration first.**',
      '## Chosen First Path',
      'K-241 should implement diagnostic-only export integration first.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines the K-241 implementation boundary and validator call timing', () => {
    const doc = readDoc();
    for (const required of [
      '## K-241 Exact Implementation Boundary',
      'K-241 Local Backup Manifest Export Diagnostic Integration',
      'call `createLocalFirstBackupManifest` from export path or an export-adjacent helper.',
      'call `validateLocalFirstBackupManifest`.',
      'do not change ZIP payload shape.',
      'do not replace manifest.json.',
      'do not add ZIP sidecar.',
      'do not alter `importVaultBackup`.',
      'do not alter `vaultRestorePipeline`.',
      'Local Backup Manifest Export Diagnostic Harness',
      '## Validator Call Timing',
      'Before ZIP manifest creation.',
      'After current manifest metadata is assembled.',
      'After ZIP package assembly but before write.',
      'Test-only simulation.',
      'prefer after current export metadata is assembled but before ZIP write',
      'validation should not mutate export data.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines failure behavior and ZIP compatibility preservation', () => {
    const doc = readDoc();
    for (const required of [
      '## Failure Behavior',
      'credentials/tokens/secrets detected.',
      '`destructiveWholeVaultReplaceAllowed` true.',
      'invalid backupKind/scopeLevel.',
      'raw blob payload embedded in manifest JSON.',
      'generated/dev-test artifacts included.',
      'unsupported optional domains.',
      'checksums not computed.',
      'errors must identify path/key/category, not secret value.',
      'validation must not trigger restore/import mutation.',
      'validation must not trigger remote writes.',
      '## ZIP Compatibility Preservation',
      'K-241 must not alter ZIP manifest.json.',
      'K-241 must not add sidecar unless a later plan explicitly chooses that path.',
      'K-241 must not break `importVaultBackup`.',
      'K-241 must not require import parser changes.',
      'K-241 must keep `VaultBackupManifest` v3 intact.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines VaultBackupManifest v3 relationship and attachment scope boundary', () => {
    const doc = readDoc();
    for (const required of [
      '## VaultBackupManifest v3 Relationship',
      'existing `VaultBackupManifest` v3 remains current ZIP manifest contract.',
      'local-first manifest remains diagnostic/integration metadata first.',
      '`VaultBackupManifest` version -> `manifestVersion` / `formatVersion` / `schemaVersion`.',
      'current note/task/settings counts -> `domains` / `counts`.',
      'current attachment metadata -> attachment markers.',
      'direct replacement requires separate compatibility plan.',
      '## Attachment Blob Scope Boundary',
      'K-241 must not claim Level 3 unless actual blob payload export is source-verified and included.',
      'K-241 must not copy attachment blobs.',
      'K-241 must not delete attachment blobs.',
      'K-241 must not upload attachment blobs.',
      'K-241 must not download attachment blobs.',
      'provider-aware recovery remains non-goal.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines import/restore and security/privacy boundaries', () => {
    const doc = readDoc();
    for (const required of [
      '## Import/Restore Boundary',
      'K-241 must not change `importVaultBackup`.',
      'K-241 must not change `vaultRestorePipeline`.',
      'K-241 must not change `backupBeforeRestore`.',
      'K-241 must not introduce restore preview.',
      'K-241 must not introduce restore mutation.',
      'per-item `skip`, `duplicate`, and `replace` remains distinct from destructive whole-vault restore.',
      'destructive whole-vault restore remains forbidden as early/default path.',
      '## Security/Privacy Boundary',
      'no credentials/tokens/secrets in manifest or validation errors.',
      'value-level secret guard remains required.',
      'nested arrays/objects remain recursively inspected.',
      'raw blob data URL guard remains required.',
      'generated artifact exclusion remains required.',
      'no Google Drive OAuth material.',
      'no network calls.',
      'no background jobs.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines K-241 acceptance criteria, non-goals, and closure', () => {
    const doc = readDoc();
    for (const required of [
      '## K-241 Acceptance Criteria Preview',
      '`createLocalFirstBackupManifest` invoked only in export diagnostic path or test harness.',
      '`validateLocalFirstBackupManifest` invoked.',
      'ZIP output unchanged.',
      'manifest.json unchanged.',
      'no sidecar added.',
      'import tests unchanged/pass.',
      'privacy hard-fail tests added.',
      'no restore/import mutation.',
      'no persistence mutation.',
      'no remote behavior changes.',
      '## Non-Goals',
      'no K-238 generator changes unless documentation-only reference.',
      'no ZIP sidecar implementation.',
      'no VaultBackupManifest type change.',
      'no importVaultBackup change.',
      'no vaultRestorePipeline change.',
      'no backupBeforeRestore change.',
      'no schema migration.',
      'no IndexedDB migration.',
      'no Supabase sync changes.',
      'no Google Drive changes.',
      'no OAuth changes.',
      'no attachment remote upload/recovery changes.',
      'no Health/Schedule behavior changes.',
      'no Notes/Cosmos changes.',
      'no assets/fonts/dependencies.',
      'K-240 chooses diagnostic-only export integration as the safest first implementation path unless source inspection disproves it.',
      'Existing ZIP manifest.json and VaultBackupManifest v3 remain the current backup package contract.',
      'LocalFirstBackupManifest remains diagnostic/validation metadata before becoming an artifact contract.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
