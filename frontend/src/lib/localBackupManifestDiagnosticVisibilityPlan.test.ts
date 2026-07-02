import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-246-local-backup-manifest-diagnostic-visibility-plan.md');

describe('K-246 local backup manifest diagnostic visibility plan', () => {
  it('documents plan scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-246 Local Backup Manifest Diagnostic Visibility Plan',
      'K-246 plans whether and how local backup manifest diagnostics should become visible later.',
      'K-246 is docs/plan plus audit test only.',
      'K-246 does not expose diagnostics',
      'does not implement UI',
      'does not implement developer console/logging',
      'does not change export result shape',
      'does not change public API',
      'does not change ZIP output',
      'does not change `manifest.json`',
      'does not add sidecar output',
      'does not change import/restore behavior',
      'no Google Drive QA work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state and compares visibility options', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-238 generator/validator exists.',
      'K-241 diagnostic helper exists.',
      'K-244 output-neutral export hook exists.',
      'K-245 closed the hook boundary.',
      'The diagnostic result is internal/ignored.',
      'The diagnostic result is not returned publicly.',
      'The diagnostic result is not written to ZIP.',
      'The diagnostic result is not written to `manifest.json`.',
      'The diagnostic result is not written as sidecar.',
      'The diagnostic result is not shown in UI.',
      'The diagnostic result is not connected to import/restore.',
      'ZIP `manifest.json` and `VaultBackupManifest` v3 remain the current artifact contract.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
      '## Visibility Options',
      '### Option A: Keep Diagnostics Internal/Test-Only',
      '### Option B: Developer-Only Diagnostic Harness',
      '### Option C: Maintenance/Diagnostics UI Plan',
      '### Option D: Export Result Metadata',
      '### Option E: ZIP Sidecar Or Manifest Extension',
      '### Option F: Logging/Console',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('chooses the visibility path and defines future hard failure and warning visibility', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Chosen Visibility Path',
      'K-246 chooses Option B as the primary future path: Developer-only diagnostic harness planning.',
      'K-247 should not expose diagnostics to users or backup artifacts yet.',
      'no ZIP artifact changes',
      'no `manifest.json` changes',
      'no sidecar',
      'no public export result shape changes',
      'no user UI',
      'no console/log output',
      'no import/restore validation connection',
      '## Hard Failures Versus Warnings Visibility',
      'credentials/tokens/secrets detected',
      '`destructiveWholeVaultReplaceAllowed` true',
      'invalid `backupKind` / `scopeLevel`',
      'Level 2/3/4 escalation',
      'raw blob payload embedded',
      'generated/dev-test artifacts included',
      'unsafe override escalation',
      'checksums not computed',
      'optional domain gaps',
      'attachment blob payload not included under diagnostic/core-data scope',
      'provider metadata unresolved',
      'domain counts incomplete',
      'hard failures may be summarized by category only',
      'warnings may be summarized by category/count only',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines privacy, export artifact, export API, UI, logging, import/restore, and attachment boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Privacy/Redaction Policy',
      'Diagnostic visibility must be redacted by default.',
      'Show categories, not values.',
      'Show counts, not content.',
      'Do not show token-like substrings.',
      'Do not show `accessToken`, `refreshToken`, `idToken`, or `clientSecret` values.',
      'Do not show Supabase service keys.',
      'Do not show Google Drive OAuth material.',
      'Do not show raw blob data URLs.',
      'Logs are not safe by default.',
      '## Export Artifact Boundary',
      'K-247 should not write diagnostics into ZIP.',
      'K-247 should not write diagnostics into `manifest.json`.',
      'K-247 should not add a sidecar.',
      'K-247 should not write a local-first manifest artifact.',
      '`VaultBackupManifest` v3 remains the artifact contract.',
      '## Export Result/API Boundary',
      'The export return shape remains unchanged for now.',
      'Public API should not grow diagnostic fields without a plan.',
      'The current K-244 hook result remains ignored/internal.',
      'K-247 should avoid export result shape changes.',
      '## UI/Maintenance Boundary',
      'K-247 should not implement UI unless a separate plan approves it.',
      'UI must show redacted summary only.',
      'UI must distinguish hard failures from warnings.',
      'UI should not encourage destructive restore.',
      '## Logging Boundary',
      'K-247 should add no console/log output.',
      'Log messages must not include values.',
      'Log messages must not include raw manifest JSON.',
      '## Import/Restore Boundary',
      'K-247 should add no import/restore validation connection.',
      'no `importVaultBackup` change',
      'no `vaultRestorePipeline` change',
      'no `backupBeforeRestore` change',
      'Destructive whole-vault restore remains forbidden as an early/default path.',
      '## Attachment Boundary',
      'no Level 3 support claim',
      'There should be no blob movement, copy, upload, download, delete, provider-aware recovery, or attachment sync change.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends K-247, lists non-goals, and closes without exposure', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## K-247 Recommendation',
      'K-247 Local Backup Manifest Diagnostic Harness Plan',
      'docs/plan or test-only',
      'define a developer/test-only diagnostic harness',
      'no UI',
      'no ZIP/manifest output',
      'no export result shape change',
      'no import/restore validation',
      'Not recommended yet:',
      'user-facing maintenance UI',
      'ZIP sidecar',
      '`manifest.json` extension',
      'export result metadata',
      'logging/console output',
      '## Non-Goals',
      'no diagnostic exposure in K-246',
      'no UI implementation',
      'no developer console/logging implementation',
      'no export result shape change',
      'no public API change',
      'no ZIP output change',
      'no `manifest.json` replacement/change',
      'no local-first manifest written to ZIP',
      'no ZIP sidecar',
      'no restore/import validation',
      'no Google Drive QA work',
      '## Closure Statement',
      'K-246 plans visibility but does not expose diagnostics.',
      'Diagnostics remain internal/ignored unless a future milestone changes it.',
      'Backup artifacts, `manifest.json`, sidecar, export result shape, import/restore path, UI, and logs remain unchanged.',
      'Any future diagnostic visibility must be redacted/category-only and separately approved.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
