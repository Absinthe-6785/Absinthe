import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-250-local-backup-manifest-diagnostic-harness-integration-boundary-plan.md');

describe('K-250 local backup manifest diagnostic harness integration boundary plan', () => {
  it('documents plan scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-250 Local Backup Manifest Diagnostic Harness Integration Boundary Plan',
      'K-250 is docs/plan plus audit test only.',
      'K-250 does not integrate the helper anywhere.',
      'K-250 does not change helper behavior',
      'K-250 does not expose diagnostics',
      'K-250 does not add UI/logging implementation',
      'K-250 does not change ZIP output',
      'K-250 does not change `manifest.json`',
      'K-250 does not add sidecar output',
      'K-250 does not change export result shape',
      'K-250 does not change import/restore validation',
      'K-250 chooses K-251 next path.',
      '## Non-Goals',
      'no helper behavior change in K-250',
      'no scopeLevel sanitizer implementation in K-250',
      'no diagnostic exposure',
      'no UI implementation',
      'no developer console/logging implementation',
      'no export result shape change',
      'no ZIP output change',
      'no `manifest.json` replacement/change',
      'no Google Drive QA work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents current state and helper contract', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-248 diagnostic harness/helper exists.',
      'K-248 backupKind redaction patch is merged.',
      'K-249 closure audit is complete.',
      'The helper remains pure/isolated.',
      'Diagnostic summary is not runtime-wired.',
      'Diagnostic summary is not shown in UI.',
      'Diagnostic summary is not logged.',
      'Diagnostic summary is not written to ZIP.',
      'Diagnostic summary is not written to `manifest.json`.',
      'Diagnostic summary is not sidecar output.',
      'Diagnostic summary is not returned in export result shape.',
      'Diagnostic summary is not connected to import/restore validation.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
      '## Current Helper Contract',
      'backupKind allowlist:',
      '`diagnostic-manifest`',
      '`core-data`',
      'unknown/future/adversarial backupKind becomes `unknown`.',
      'raw backupKind echo path is closed.',
      '`scopeSummary.backupKind` may be always present as `diagnostic-manifest | core-data | unknown`.',
      'no UI/logging/ZIP/manifest/export/import/restore exposure exists.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents scopeLevel boundary options and chosen sanitizer recommendation', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## scopeLevel Boundary Question',
      '`scopeLevel` appears in summary today.',
      'K-249 did not block on it.',
      'Option A: Keep Current scopeLevel Behavior Until Future Integration',
      'risk: future summary consumers may over-trust raw or unexpected scopeLevel.',
      'Option B: Plan A K-251 scopeLevel Sanitizer Patch',
      'scopeLevel must be number-only.',
      'allowed values should be 0 and 1 for current harness.',
      'future levels 2/3/4 should summarize as `unknown` or hard-fail',
      'malformed/non-number/string/object values should summarize as `unknown`.',
      'Option C: Treat scopeLevel As Validation-Only And Remove It From Public Summary Later',
      'Recommendation: prefer K-251 scopeLevel sanitizer patch before any integration or visibility.',
      '## scopeLevel Sanitizer Future Requirements',
      '`0`',
      '`1`',
      'future levels 2/3/4 should not be summarized as supported by current harness.',
      'non-number values become `unknown`.',
      'string values become `unknown`.',
      'NaN/Infinity become `unknown`.',
      'negative numbers become `unknown`.',
      'objects/arrays/null/undefined become `unknown`.',
      'raw input must not appear in summary/errors/warnings.',
      'scopeLevel summary should not imply Level 3 blob support.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents integration options, chosen boundary, and forbidden surfaces', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Integration Surface Options',
      'Option A: Keep Harness Test-Only/Internal',
      'Option B: Dev/Test-Only Diagnostic API',
      'Option C: Export-Adjacent Diagnostic Validation',
      'Option D: Maintenance/Diagnostics UI',
      'Option E: Console/Logging',
      'Option F: ZIP Sidecar / manifest.json Extension',
      'Option G: Import/Restore Validation',
      'K-250 chooses Option A as the primary near-term path',
      'Do not proceed to Option C, D, E, F, or G until scopeLevel and redaction boundaries are fully closed.',
      '## Chosen Near-Term Boundary',
      'The diagnostic harness remains internal/test-only for now.',
      'Do not connect to UI/logging/ZIP/manifest/export result/import/restore.',
      'Before any integration, run K-251 scopeLevel sanitizer patch or equivalent test hardening.',
      '## Forbidden Integration Surfaces',
      'user UI',
      'developer panel',
      'console logging',
      'export result shape',
      'public API',
      'ZIP artifact',
      '`manifest.json`',
      'sidecar JSON',
      'import validation',
      'restore validation',
      'restore mutation',
      'Supabase/Google Drive/OAuth provider surfaces',
      'attachment blob export/provider-aware recovery',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents future redaction rules and export/import/ZIP plus attachment/provider boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Visibility/Redaction Rules For Any Future Integration',
      'category-only summaries.',
      'count-only where possible.',
      'known allowlist labels only.',
      '`unknown` for malformed/untrusted input.',
      'no raw user content.',
      'no raw note content.',
      'no raw attachment content.',
      'no raw backupKind unknown values.',
      'no unsafe scopeLevel values.',
      'no tokens/secrets/provider credentials.',
      'no raw manifest JSON in logs.',
      'errors must identify safe category/path only, not sensitive values.',
      '## Export/Import/ZIP Boundary',
      'no ZIP output change.',
      'no `manifest.json` change.',
      'no sidecar.',
      'no export result shape change.',
      'no `importVaultBackup` change.',
      'no `vaultRestorePipeline` change.',
      'no `backupBeforeRestore` change.',
      'no restore/import validation.',
      'no destructive whole-vault restore.',
      '## Attachment/Provider Boundary',
      'no attachment blob export claim.',
      'no Level 3 support claim.',
      'no `full-content-with-blobs` support claim in current harness integration.',
      'no provider-aware recovery claim.',
      'no blob movement/copy/upload/download.',
      'no attachment sync change.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents K-251 recommendation and closure statement', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## K-251 Recommendation',
      'K-251 Local Backup Manifest Diagnostic Harness scopeLevel Redaction Patch',
      'narrow helper/test patch.',
      'sanitize scopeLevel summary.',
      'allow only current supported scope levels 0 and 1.',
      '`unknown` for malformed/future/adversarial values.',
      'no runtime/UI/logging/export/ZIP/import/restore changes.',
      'K-251 Local Backup Manifest Diagnostic Harness Integration Closure Audit',
      'K-251 Local Backup Manifest Developer Harness Plan',
      'Not recommended yet:',
      'UI visibility.',
      'console logging.',
      'export result metadata.',
      'ZIP sidecar.',
      '`manifest.json` extension.',
      'import/restore validation.',
      '## Closure Statement',
      'K-250 plans integration boundaries but does not integrate the harness.',
      'Diagnostic harness remains internal/test-only.',
      'backupKind redaction remains closed.',
      'scopeLevel should be hardened before broader integration.',
      'UI/logging/ZIP/manifest/export result/import/restore surfaces remain forbidden.',
      'Any future visibility or integration requires a separate milestone.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
