import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-254-local-backup-export-preflight-diagnostic-boundary-plan.md',
);

describe('K-254 local backup export preflight diagnostic boundary plan', () => {
  it('documents plan scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-254 Local Backup Export Preflight Diagnostic Boundary Plan',
      'K-254 plans export preflight diagnostic boundaries.',
      'K-254 is docs/plan plus audit test only.',
      'K-254 does not implement preflight',
      'K-254 does not wire diagnostics into export runtime',
      'K-254 does not expose diagnostics',
      'K-254 does not add UI/logging implementation',
      'K-254 does not change ZIP output',
      'K-254 does not change `manifest.json`',
      'K-254 does not add sidecar output',
      'K-254 does not change export result shape',
      'K-254 does not change import/restore validation',
      '## Non-Goals',
      'no export preflight implementation in K-254',
      'no runtime wiring',
      'no helper behavior change',
      'no diagnostic exposure',
      'no UI implementation',
      'no developer console/logging implementation',
      'no export result shape change',
      'no ZIP output change',
      'no `manifest.json` replacement/change',
      'no ZIP sidecar',
      'no Google Drive QA work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents current state and preflight definition', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-244 output-neutral export diagnostic hook exists.',
      'K-245 closed the hook.',
      'K-248 diagnostic harness/helper exists.',
      'K-249 closed backupKind redaction.',
      'K-251 hardened scopeLevel.',
      'K-252 closed scopeLevel redaction.',
      'K-253 closed the consolidated harness hardening line.',
      'Diagnostic harness summary is redacted category/count-only.',
      'backupKind is `diagnostic-manifest` / `core-data` / `unknown`.',
      'scopeLevel is numeric `0` / `1` / `unknown`.',
      'Level 2 / 3 / 4 remain unsupported.',
      'Diagnostic result is not shown in UI.',
      'Diagnostic result is not logged.',
      'Diagnostic result is not written to ZIP.',
      'Diagnostic result is not written to `manifest.json`.',
      'Diagnostic result is not sidecar output.',
      'Diagnostic result is not returned in export result shape.',
      'Diagnostic result is not connected to import/restore validation.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
      '## Preflight Definition',
      'pre-export diagnostic check that may evaluate whether export metadata is safe enough to proceed.',
      'may summarize redacted hard failures and warnings.',
      'must not mutate export payload',
      'must not write artifacts',
      'must not change import/restore behavior',
      'must not claim Level 3 blob/provider-aware recovery',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares preflight surface options and chooses a boundary', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Preflight Surface Options',
      'Option A: Dev/test-only preflight harness',
      'runs in tests or developer-only harness.',
      'no production runtime wiring.',
      'no UI/logging/artifact output.',
      'safest first step.',
      'Option B: Output-neutral export-adjacent preflight check',
      'runs before or near export flow.',
      'may block only privacy/security/scope escalation if safe.',
      'no ZIP/manifest/export result changes.',
      'Option C: User-facing Data Safety / Backup Health UI',
      'requires separate UX/privacy plan.',
      'Option D: Console/logging preflight',
      'risks sensitive leakage.',
      'Option E: ZIP sidecar / manifest extension',
      'artifact-level exposure.',
      'Option F: Import/restore validation',
      'restore mutation-adjacent.',
      'K-254 chooses Option A as the primary near-term path.',
      '## Chosen Boundary',
      'The first preflight should be dev/test-only.',
      'It should not run automatically in user export runtime.',
      'It should not expose diagnostics in UI/logging.',
      'It should not write anything to ZIP/manifest/sidecar.',
      'It should not change export result shape.',
      'It should not connect to import/restore validation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines production criteria, hard failure policy, warning policy, and no-raw-value policy', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Future Production Preflight Criteria',
      'redacted summary contract remains enforced.',
      'backupKind remains `diagnostic-manifest` / `core-data` / `unknown`.',
      'scopeLevel remains `0` / `1` / `unknown`.',
      'hard failures are category-only.',
      'warnings are category/count-only.',
      'no raw values are emitted.',
      'output-neutral proof exists.',
      'export result shape remains unchanged.',
      'ZIP entries remain unchanged.',
      'parsed `manifest.json` remains unchanged.',
      'no sidecar exists.',
      '`importVaultBackup` tests remain green.',
      '`vaultRestorePipeline` tests remain green if present.',
      'no UI/logging introduced.',
      'no provider/blob behavior change.',
      'no Level 3/4 overclaim.',
      '## Hard Failure Policy',
      'credentials/tokens/secrets detected.',
      '`destructiveWholeVaultReplaceAllowed` true.',
      'invalid backupKind/scopeLevel.',
      'unsupported Level 2/3/4 escalation.',
      'raw blob payload embedded.',
      'generated/dev-test artifacts included.',
      'unsafe override escalation.',
      'raw backupKind/scopeLevel echo regression.',
      'hard failures must not include raw values.',
      'hard failure handling should be test-only first.',
      'production blocking requires a separate implementation PR and additional proof.',
      '## Warning Policy',
      'checksums not computed.',
      'optional domain gaps.',
      'attachment blob payload not included under diagnostic/core-data scope.',
      'provider metadata unresolved.',
      'schema/app version unknown.',
      'domain counts incomplete.',
      'Level 3/4 not supported.',
      'provider-aware recovery not supported.',
      'warnings should be category/count-only.',
      'warnings should not block export in early preflight.',
      'warnings should not appear in UI/logs until a visibility plan approves them.',
      'warnings should not be written to artifacts.',
      '## No-Raw-Value Policy',
      'no raw diagnostic messages.',
      'no raw user content.',
      'no raw note content.',
      'no raw attachment content.',
      'no raw manifest JSON.',
      'no raw backupKind unknown values.',
      'no raw scopeLevel malformed values.',
      'no token-like substrings.',
      'no OAuth/session material.',
      'no data URLs.',
      'no file paths unless explicitly safe and redacted.',
      'no stack traces.',
      'no JSON payload echo.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines output-neutrality, storage lifecycle, export/import/ZIP, UI/logging, and attachment boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Output-Neutrality Policy',
      'preflight must not change ZIP output.',
      'preflight must not change `manifest.json`.',
      'preflight must not add sidecar.',
      'preflight must not change export result shape.',
      'preflight must not mutate export payload.',
      'preflight must not change import/restore behavior.',
      'preflight must not change persistence.',
      'preflight must not perform network/provider/blob actions.',
      '## Storage and Lifecycle Policy',
      'preflight result is not persisted.',
      'preflight result is not stored in IndexedDB.',
      'preflight result is not stored in localStorage.',
      'preflight result is not written to files.',
      'preflight result is not written to logs.',
      'preflight result is not written to backup artifacts.',
      'ephemeral in-memory test/harness output',
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
      'per-item `skip`, `duplicate`, and `replace` remains separate from destructive whole-vault restore.',
      '## UI/Logging Boundary',
      'no UI in K-255 unless a later plan changes direction.',
      'no console logging.',
      'no logger output.',
      'no developer panel.',
      'no maintenance UI.',
      'no notification/toast.',
      'no export modal changes.',
      'no user-facing language about backup safety.',
      'UI requires separate Data Safety / Backup Health plan.',
      '## Attachment/Provider Boundary',
      'no attachment blob export claim.',
      'no Level 3 support claim.',
      'no `full-content-with-blobs` support claim.',
      'no `provider-aware-recovery` support claim.',
      'no blob movement/copy/upload/download.',
      'no attachment sync change.',
      'no Supabase behavior change.',
      'no Google Drive/OAuth behavior change.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents K-255 recommendation and closure statement', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## K-255 Recommendation',
      'K-255 Local Backup Export Preflight Diagnostic Test Harness Plan',
      'docs/plan plus audit test, or test-only prototype if source is already clear.',
      'define a dev/test-only preflight harness.',
      'no production runtime export wiring.',
      'no UI/logging.',
      'no ZIP/manifest/output changes.',
      'no import/restore validation.',
      'K-255 Local Backup Export Preflight Diagnostic Prototype',
      'K-255 Local Backup Export Preflight Boundary Closure Audit',
      'Not recommended yet:',
      'production export preflight blocking.',
      'user-facing UI.',
      'logging/console output.',
      'export result metadata.',
      'ZIP sidecar.',
      '`manifest.json` extension.',
      'import/restore validation.',
      '## Closure Statement',
      'K-254 plans export preflight boundaries but does not implement preflight.',
      'The first preflight step should remain dev/test-only unless a later milestone proves production safety.',
      'Diagnostics remain unexposed to UI/logs/ZIP/manifest/export result/import/restore.',
      'Output-neutrality, no-raw-value policy, and local-first boundaries remain required.',
      'Any future production preflight, UI, visibility, or artifact evolution requires a separate milestone.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
