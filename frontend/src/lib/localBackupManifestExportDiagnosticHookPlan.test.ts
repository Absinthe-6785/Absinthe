import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-243-local-backup-manifest-export-diagnostic-hook-plan.md');

describe('K-243 local backup manifest export diagnostic hook plan', () => {
  it('documents plan scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-243 Local Backup Manifest Export Diagnostic Hook Plan',
      'K-243 is docs/plan plus audit test only.',
      'K-243 does not implement a runtime export hook.',
      'K-243 does not change exportVaultBackup behavior.',
      'K-243 does not change ZIP output.',
      'K-243 does not change manifest.json.',
      'K-243 does not add ZIP sidecar output.',
      'K-243 does not change import/restore behavior.',
      'no Google Drive QA work.',
      'K-243 plans the hook but does not implement it.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state and source inspection findings', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-238 manifest generator/validator exists.',
      'K-241 export diagnostic helper exists.',
      'K-242 closed helper boundary.',
      'supported scopes are diagnostic-manifest / 0 and core-data / 1.',
      'Level 2/3/4 hard-fail.',
      'createdAt / backupId safe overrides are covered.',
      'unsafe override escalation hard-fails.',
      'existing ZIP manifest.json remains unchanged.',
      'VaultBackupManifest v3 remains unchanged.',
      '## Source Inspection Findings',
      '### exportVaultBackup',
      '### VaultBackupManifest v3',
      '### ZIP manifest.json generation',
      '### importVaultBackup',
      '### vaultRestorePipeline',
      '### backupBeforeRestore',
      '### Attachment Metadata And Blob Export Handling',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares candidate hook locations and chooses a plan', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Candidate Hook Locations',
      '### Option A: Before Export Metadata Assembly',
      '### Option B: After Current VaultBackupManifest Is Assembled, Before ZIP Write',
      '### Option C: After ZIP Entries Are Assembled, Before Final Write/Download',
      '### Option D: Test-Only Export Metadata Harness',
      '## Chosen Hook Plan',
      'K-243 chooses Option B as the preferred K-244 path.',
      'frontend/src/lib/exportVaultBackup.ts',
      'immediately after `buildVaultBackupManifestV3` constructs the current VaultBackupManifest',
      'do not write diagnostic output into ZIP.',
      'do not alter manifest.json.',
      'do not add sidecar.',
      'do not change import/restore.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines output-neutral proof and helper result usage plans', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Output-Neutral Proof Plan',
      'ZIP entry list before/after unchanged.',
      'manifest.json byte content or parsed shape unchanged.',
      'no sidecar file appears.',
      'export result shape unchanged.',
      'importVaultBackup tests still pass.',
      'vaultRestorePipeline tests still pass if present.',
      'helper does not mutate input metadata.',
      'parsed manifest equality plus ZIP entry equality is acceptable if byte comparison proves flaky.',
      '## Helper Result Usage Plan',
      'diagnostic result may be used for tests/internal diagnostics only.',
      'no user-visible UI in K-244.',
      'no ZIP artifact output in K-244.',
      'no manifest.json field added in K-244.',
      'no sidecar file in K-244.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines hard-fail, warning, result-shape, ZIP, import, and restore preservation plans', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Hard-Fail Versus Warning Plan',
      'credentials/tokens/secrets detected.',
      'destructiveWholeVaultReplaceAllowed true.',
      'Level 2/3/4 escalation.',
      'raw blob payload embedded.',
      'generated/dev-test artifacts included.',
      'checksum not computed.',
      'optional domain gaps.',
      'attachment blob payload not included under diagnostic/core-data scope.',
      '## Export Result Shape Preservation',
      'export function return type unchanged',
      '## ZIP Manifest.json Preservation',
      'existing manifest.json remains the package contract.',
      'K-244 must not replace manifest.json.',
      'K-244 must not add a local-first sidecar file.',
      '## Import/Restore Preservation',
      'importVaultBackup unchanged.',
      'vaultRestorePipeline unchanged.',
      'backupBeforeRestore unchanged.',
      'per-item skip / duplicate / replace remains distinct from destructive whole-vault restore.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines attachment boundary, security/privacy guardrails, and K-244 recommendation', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Attachment Boundary',
      'must not claim Level 3 blob support.',
      'must not copy/delete/upload/download attachment blobs.',
      'must not change attachment metadata export.',
      'provider-aware recovery remains non-goal.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      '## Security/Privacy Guardrails',
      'key-level and value-level guards remain required.',
      'safe createdAt / backupId overrides remain the only allowed overrides.',
      'no broad manifestInputOverrides.',
      'errors must not include secret values.',
      'no Supabase imports.',
      'no Google Drive/OAuth imports.',
      'no fetch/network.',
      'no IndexedDB/localStorage reads/writes beyond current export behavior, if any.',
      '## K-244 Recommendation',
      'K-244 Local Backup Manifest Export Diagnostic Hook',
      'prove output-neutrality with tests.',
      'hard-fail only privacy/security/scope escalation if safe.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
