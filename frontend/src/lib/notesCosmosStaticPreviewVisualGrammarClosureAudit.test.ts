import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-277-notes-cosmos-static-preview-visual-grammar-closure-audit.md',
);
const previewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const harnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');
const packagePath = join(process.cwd(), 'package.json');
const viteConfigPath = join(process.cwd(), 'vite.config.ts');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-277 notes cosmos static preview visual grammar closure audit', () => {
  it('exists and defines docs/audit-only closure scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-277 Notes/Cosmos Static Preview Visual Grammar Closure Audit',
      'K-277 closes the K-270 through K-276 Static Preview visual grammar / accessibility / viewport proof line.',
      'K-277 is docs/audit plus audit test only.',
      'K-277 does not modify `NotesCosmosStaticPreview`.',
      'K-277 does not implement another Static Preview change.',
      'K-277 does not generate or commit static harness artifacts.',
      'K-277 does not wire Static Preview into runtime.',
      'K-277 does not change route/nav/panel behavior.',
      'K-277 does not mount `NotesCosmosStaticPreview`.',
      'K-277 does not implement Runtime Cosmos Map.',
      'K-277 does not replace graph surfaces.',
      'K-277 chooses the next product surface planning direction',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-276', () => {
    const doc = readDoc();

    for (const required of [
      'K-270 selected Static Preview continuation as an isolated visual/product grammar track.',
      'K-271 planned signal hierarchy polish.',
      'K-272 implemented isolated signal readout / hierarchy polish.',
      'K-273 closed K-272 implementation.',
      'K-274 audited accessibility/fallback and found no blocking gap for isolated closure.',
      'K-275 planned viewport proof refresh.',
      'K-276 refreshed viewport proof and documented 390px evidence.',
      '`NotesCosmosStaticPreview` remains isolated/unwired.',
      'Static Preview remains fixture-driven and deterministic.',
      'Static Preview does not use live graph data.',
      'Static Preview does not read Notes stores.',
      'Static Preview does not persist coordinates/orbits/spatial metadata.',
      'Static Preview is not mounted in normal Notes navigation.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'Backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits K-270 through K-276 closure status', () => {
    const doc = readDoc();

    for (const required of [
      '## K-270 Through K-276 Closure Audit',
      'K-270: continuation plan selected the isolated Static Preview track.',
      'K-271: narrowed visual grammar work to signal hierarchy.',
      'K-272: implemented isolated signal hierarchy polish inside `NotesCosmosStaticPreview`.',
      'K-273: closed K-272 implementation with source-facts audit.',
      'K-274: audited accessibility/fallback and found no blocking gap for isolated closure.',
      'K-275: planned viewport proof refresh with harness command/output/artifact policy.',
      'K-276: refreshed viewport proof and kept generated artifact uncommitted.',
      'isolated, deterministic Static Preview grammar/proof track',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits signal hierarchy closure', () => {
    const doc = readDoc();

    for (const required of [
      '## Signal Hierarchy Closure',
      'K-272 signal readout / hierarchy polish is complete for the isolated preview.',
      'Primary, secondary, and faint hierarchy is documented and source-verified from K-273 and K-276.',
      'The hierarchy is not color-only.',
      '`Signal readout`.',
      '`Primary signal`.',
      '`Secondary signals`.',
      '`Faint signals`.',
      '`Signal tier: Primary signal`.',
      '`Signal tier: Secondary signal`.',
      '`Signal tier: Faint signal`.',
      '`data-signal-tier`.',
      'meaning-bearing rather than ornamental-only',
      'without implying shipped runtime navigation or live graph data',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits accessibility/fallback and viewport proof closure', () => {
    const doc = readDoc();

    for (const required of [
      '## Accessibility / Fallback Closure',
      'K-274 found no blocking accessibility/fallback gap for isolated Static Preview closure.',
      'Fallback/summary content remains present.',
      'Essential information is not visual-only.',
      'Semantic/readout content remains present',
      'Readable typography and keyboard/readability expectations remain acceptable',
      'This is not a production accessibility certification.',
      'Future runtime exposure would require fresh accessibility review',
      '## Viewport Proof Closure',
      'K-276 refreshed viewport proof after K-272.',
      'The 390px/narrow viewport proof was documented.',
      'Signal readout, tier labels, fallback, node order, and relationship order were confirmed.',
      'viewport width: 390px.',
      'no horizontal overflow.',
      '10 rendered nodes.',
      '12 rendered relationships.',
      'primary/secondary/faint tier counts of 1/7/2.',
      'The proof is sufficient for isolated Static Preview closure.',
      'The proof does not imply runtime readiness.',
      'Browser proof is manual evidence and is not fully replayed by the audit test',
      'Future runtime exposure requires fresh browser/390px proof.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits generated artifact policy closure and keeps output absent', () => {
    const doc = readDoc();

    for (const required of [
      '## Generated Artifact Policy Closure',
      'Static harness output remains temporary.',
      'The generated static harness artifact was not committed.',
      'frontend/dist/notes-cosmos-static-preview',
      'No generated screenshots, image assets, or font assets were committed.',
      'No package, Vite, or config changes were needed.',
      'This policy must continue for future proof refresh work.',
    ]) {
      expect(doc).toContain(required);
    }

    expect(existsSync(harnessOutputPath)).toBe(false);
  });

  it('audits isolation/runtime wiring, graph preservation, and backup/provider boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Isolation / Runtime Wiring Audit',
      '`NotesCosmosStaticPreview` remains isolated.',
      'There is no normal Notes navigation wiring.',
      'There is no route/nav/panel.',
      'There is no hidden/default panel.',
      'There is no production runtime exposure.',
      'There is no Runtime Cosmos Map.',
      'There is no live Notes data.',
      'There are no Notes store reads.',
      'There is no graph builder coupling.',
      'There is no `KnowledgeIndexService` coupling.',
      'K-277 does not mount `NotesCosmosStaticPreview`.',
      '## Graph Surface Preservation Audit',
      '`NoteGraphView` remains the full-vault graph.',
      '`LocalGraphView` remains the local/context graph.',
      'Cosmos Map does not replace either.',
      'K-270 through K-276 did not alter graph builders.',
      'K-270 through K-276 did not couple to `KnowledgeIndexService`.',
      'K-270 through K-276 did not introduce live graph data into Static Preview.',
      '## Backup / Provider Boundary Audit',
      'no backup/preflight runtime implementation',
      'no Data Safety / Backup Health UI',
      'no export/import/restore behavior',
      'no restore preview/dry-run',
      'no attachment blob backup',
      'no provider-aware recovery',
      'no Supabase/OAuth/Google Drive behavior',
      'no provider/network/background sync behavior',
      'no attachment blob/provider behavior',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents validation status and the closure decision', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Audit',
      'K-276 proof/audit test passed',
      'K-275, K-274, K-273, and K-272 related tests passed as reported.',
      '`NotesCosmosStaticPreview` tests passed as reported.',
      'Graph/backup/provider guard tests passed as reported.',
      'Typecheck/build passed.',
      '`git diff --check` passed.',
      'K-276 browser proof is manual evidence and not fully replayed by audit test.',
      'K-276 full `npm test` was author-reported as passed and not rerun by reviewer before merge',
      'npm test -- src/lib/notesCosmosStaticPreviewVisualGrammarClosureAudit.test.ts',
      'npm test -- src/lib/notesCosmosStaticPreviewViewportProofRefresh.test.ts',
      'npm test -- src/components/notes/NotesCosmosStaticPreview.test.ts',
      'npm run typecheck',
      'npm run build',
      'git diff --check',
      'Manual browser QA is not required for K-277 because K-277 has no UI/browser runtime changes.',
      '## Static Preview Line Closure Decision',
      'Static Preview visual grammar / accessibility / viewport proof line is closed for now.',
      'No immediate Static Preview component edit is needed.',
      'No immediate additional proof refresh is needed.',
      'No runtime exposure is approved.',
      'No Runtime Cosmos Map is approved.',
      'Future Static Preview work should require a new source-grounded issue',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends next product surface planning', () => {
    const doc = readDoc();

    for (const required of [
      '## Next Product Surface Planning',
      '**K-278 Notes Overview / Signal Panel Concept Plan**',
      'docs/plan plus audit test only.',
      'define whether a Notes Overview / Signal Panel should become the next product surface.',
      'inspect data boundary before any implementation.',
      'no runtime implementation.',
      'no route/nav/panel unless explicitly scoped in a future milestone.',
      'no live graph or `KnowledgeIndexService` coupling yet.',
      '**K-278 Cosmos Navigation Concept Plan**',
      'clarify observation/navigation metaphor.',
      'no Runtime Cosmos Map.',
      'no graph replacement.',
      '**K-278 Notes/Cosmos Product Surface Next Candidate Audit**',
      'compare Notes Overview / Signal Panel versus Cosmos Navigation Concept versus Archive Voyager planning.',
      'runtime mounting of Static Preview.',
      'Runtime Cosmos Map.',
      'graph replacement.',
      'route/nav/panel.',
      'live notes data.',
      'backup/Data Safety UI.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and closure statements', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no NotesCosmosStaticPreview changes in K-277.',
      'no Static Preview implementation in K-277.',
      'no generated static harness artifact commit.',
      'no Static Preview runtime wiring.',
      'no route/nav/panel change.',
      'no NotesCosmosStaticPreview mounting.',
      'no hidden panel.',
      'no Runtime Cosmos Map implementation.',
      'no graph replacement.',
      'no NoteGraphView change.',
      'no LocalGraphView change.',
      'no graph builder change.',
      'no KnowledgeIndexService coupling.',
      'no live Notes data integration.',
      'no persistence/schema change.',
      'no coordinates/orbits/spatial metadata persistence.',
      'no canvas/SVG/WebGL graph engine.',
      'no backup/preflight runtime implementation.',
      'no Data Safety / Backup Health UI.',
      'no export blocking.',
      'no restore/import validation.',
      'no restore preview/dry-run.',
      'no attachment blob backup.',
      'no provider-aware recovery.',
      'no Supabase/OAuth/Google Drive behavior change.',
      'no Health/Schedule behavior change.',
      'no assets/fonts/dependencies.',
      '## Closure Statement',
      'K-277 closes the Static Preview visual grammar / accessibility / viewport proof line for now.',
      'Static Preview remains fixture-driven, deterministic, isolated, and unwired.',
      'K-272 signal hierarchy polish is covered by closure, accessibility/fallback, and viewport proof.',
      'Generated proof artifacts remain temporary and uncommitted.',
      'Viewport proof does not imply runtime readiness.',
      'Existing graph surfaces remain preserved.',
      'Runtime Cosmos Map and graph replacement remain rejected.',
      'Next work should move to product surface planning, preferably Notes Overview / Signal Panel.',
      'Future runtime exposure requires a separate gate and fresh browser/390px proof.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('keeps source facts and behavior boundaries intact', () => {
    expect(existsSync(previewPath)).toBe(true);
    expect(existsSync(packagePath)).toBe(true);
    expect(existsSync(viteConfigPath)).toBe(true);

    const previewSource = readSource(previewPath);

    expect(previewSource).toContain('Signal readout');
    expect(previewSource).toContain('Primary signal');
    expect(previewSource).toContain('Secondary signals');
    expect(previewSource).toContain('Faint signals');
    expect(previewSource).toContain('Signal tier: {signalTier.label}');
    expect(previewSource).toContain('data-signal-tier={signalTier.id}');
    expect(previewSource).toContain('Text fallback');
    expect(previewSource).toContain('data-min-mobile-width={fixture.responsiveAcceptance.minMobileWidthPx}');
    expect(previewSource).not.toContain('KnowledgeIndexService');
    expect(previewSource).not.toContain('NoteGraphView');
    expect(previewSource).not.toContain('LocalGraphView');
  });
});
