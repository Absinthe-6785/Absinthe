import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-273-notes-cosmos-static-preview-visual-grammar-polish-closure-audit.md',
);
const previewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const fixturePath = join(process.cwd(), 'src', 'lib', 'notesCosmosStaticPreviewMockContract.ts');
const noteGraphPath = join(process.cwd(), 'src', 'components', 'views', 'NoteGraphView.tsx');
const localGraphPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'features',
  'knowledge',
  'graph',
  'LocalGraphView.tsx',
);
const staticHarnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-273 notes cosmos static preview visual grammar polish closure audit', () => {
  it('exists and defines docs/audit-only closure scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-273 Notes/Cosmos Static Preview Visual Grammar Polish Closure Audit',
      'K-273 closes the K-272 isolated Static Preview visual grammar polish.',
      'K-273 is docs/audit plus audit test only.',
      'K-273 does not modify `NotesCosmosStaticPreview`.',
      'K-273 does not implement another Static Preview change.',
      'K-273 does not wire Static Preview into runtime.',
      'K-273 does not change route/nav/panel behavior.',
      'K-273 does not mount `NotesCosmosStaticPreview`.',
      'K-273 does not implement Runtime Cosmos Map.',
      'K-273 does not replace graph surfaces.',
      'K-273 chooses the K-274 next path',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-272', () => {
    const doc = readDoc();

    for (const required of [
      'K-270 selected Static Preview continuation as an isolated visual/product grammar track.',
      'K-271 narrowed K-272 to a small isolated signal hierarchy polish.',
      'K-272 implemented the signal readout / signal hierarchy polish inside `NotesCosmosStaticPreview`.',
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

  it('audits the K-272 implementation closure', () => {
    const doc = readDoc();

    for (const required of [
      '## K-272 Implementation Closure Audit',
      'K-272 changed files were limited to Static Preview component/test/doc',
      'frontend/src/components/notes/NotesCosmosStaticPreview.tsx',
      'frontend/src/components/notes/NotesCosmosStaticPreview.test.ts',
      'frontend/docs/K-272-notes-cosmos-static-preview-visual-grammar-polish.md',
      'K-272 changed `NotesCosmosStaticPreview` only within isolated preview scope.',
      'The signal readout / signal hierarchy polish was applied.',
      'Component tests passed.',
      'Graph/export/import/restore guard tests passed.',
      'Typecheck/build/diff-check passed.',
      'Generated static harness artifact was not committed.',
      'No route/nav/panel mounting was introduced.',
      'initial sandbox build failure caused by a Vite/esbuild filesystem boundary',
      'Build passed outside the sandbox.',
      'not a K-272 code regression.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits the signal hierarchy and non-color-only semantics', () => {
    const doc = readDoc();

    for (const required of [
      '## Signal Hierarchy Audit',
      'The primary signal is easier to identify.',
      'Secondary/supporting signals read as subordinate.',
      'Faint/background signals do not compete with primary content.',
      'The signal hierarchy is meaning-bearing, not ornamental-only.',
      'The hierarchy is not color-only.',
      'Signal readout',
      'Primary signal',
      'Secondary signal',
      'Faint signal',
      'Signal tier: Primary signal',
      'Signal tier: Secondary signal',
      'Signal tier: Faint signal',
      'data-signal-tier',
      'semantic grouping',
      'Preview grouping clarifies meaning rather than adding decoration.',
      'No shipped runtime navigation is implied.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits fixture contract and accessibility/fallback preservation', () => {
    const doc = readDoc();

    for (const required of [
      '## Fixture Contract Audit',
      'The fixture-driven contract is preserved.',
      'Deterministic preview data remains intact.',
      'No live note IDs are required.',
      'No provider/remote IDs are required.',
      'No persisted coordinates are introduced.',
      'No x/y coordinate persistence is introduced.',
      'No fixture semantics were broadened beyond preview-only use.',
      'No live graph/store coupling was introduced.',
      'The K-220 fixture/mock contract remains the only preview data source.',
      '`positionHint` remains fixture-only planning metadata',
      '## Accessibility / Fallback Audit',
      'Fallback text remains present.',
      'Semantic structure remains preserved',
      'Essential information is not visual-only.',
      'Readable typography is preserved.',
      'Keyboard/readability expectations remain intact',
      'Signal hierarchy should be understandable beyond color',
      'No blocking accessibility gap was found for this closure audit.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits responsive status and runtime isolation', () => {
    const doc = readDoc();

    for (const required of [
      '## Responsive / Viewport Audit',
      '390px/mobile expectations remain preserved',
      'No source-obvious horizontal overflow risk was introduced',
      'Static HTML / viewport harness artifact was not committed.',
      'Browser visual QA was not rerun in the K-272 review.',
      'Browser visual QA is non-blocking for K-273 because the component remains isolated/unwired',
      'Future runtime exposure would require fresh browser/390px proof.',
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
      'There is no provider/network/background sync.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits graph surface preservation and backup/provider boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Graph Surface Preservation Audit',
      '`NoteGraphView` remains the full-vault graph.',
      '`LocalGraphView` remains the local/context graph.',
      'Cosmos Map does not replace either.',
      'K-272 did not alter graph builders.',
      'K-272 did not couple to `KnowledgeIndexService`.',
      'K-272 did not introduce live graph data into Static Preview.',
      'Any future graph migration still requires an explicit decision.',
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
      'Backup/preflight guardrails remain carried forward but not productized here.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents validation status and selects the K-274 path', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Audit',
      'component tests passed.',
      'K-270/K-271 doc/audit tests passed.',
      'graph/export/import/restore guard tests passed.',
      'typecheck/build passed.',
      '`git diff --check` passed.',
      'Manual browser QA is not required for K-273 because K-273 has no UI/browser runtime changes.',
      '## K-274 Decision',
      '**K-274 Notes/Cosmos Static Preview Accessibility/Fallback Audit**',
      'docs/audit plus audit test only.',
      'verify after visual hierarchy polish that fallback/accessibility remains strong.',
      'no component implementation.',
      'no runtime wiring.',
      'Runtime Cosmos Map',
      'graph replacement',
      'route/nav/panel',
      'live Notes data',
      'backup/Data Safety UI',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and ends with the closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no NotesCosmosStaticPreview changes in K-273.',
      'no Static Preview implementation in K-273.',
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
      'no generated static harness artifact commit.',
      '## Closure Statement',
      'K-273 closes K-272 if audit checks pass.',
      'K-272 remains an isolated Static Preview signal hierarchy polish.',
      'Static Preview remains fixture-driven, deterministic, isolated, and unwired.',
      'Signal hierarchy is meaning-bearing and not color-only.',
      'Fallback/accessibility and 390px expectations remain preserved.',
      'Existing graph surfaces remain preserved.',
      'Runtime Cosmos Map and graph replacement remain rejected.',
      'Future runtime exposure requires a separate gate and fresh browser/390px proof.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-272 source signal hierarchy markers remain present', () => {
    const source = readSource(previewPath);

    for (const required of [
      'function SignalReadout',
      'Signal readout',
      'Static signal hierarchy readout',
      'Read-only signal preview',
      'data-signal-tier',
      'Primary signal',
      'Secondary signal',
      'Faint signal',
      'Signal tier:',
      'signalTierForNode',
    ]) {
      expect(source).toContain(required);
    }
  });

  it('confirms source boundaries stay preview-only and free of forbidden runtime coupling', () => {
    const previewSource = readSource(previewPath);
    const fixtureSource = readSource(fixturePath);
    const graphSources = [readSource(noteGraphPath), readSource(localGraphPath)];

    for (const forbiddenImport of [
      /from ['"].*NoteGraphView/,
      /from ['"].*LocalGraphView/,
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*buildGlobalGraphData/,
      /from ['"].*buildExpandedGraphData/,
      /from ['"].*useNotesStore/,
      /from ['"].*store/,
      /from ['"].*provider/i,
      /from ['"].*persistence/i,
      /from ['"].*supabase/i,
      /from ['"].*google/i,
      /from ['"].*attac.*hment/i,
    ]) {
      expect(previewSource).not.toMatch(forbiddenImport);
      expect(fixtureSource).not.toMatch(forbiddenImport);
    }

    for (const source of graphSources) {
      expect(source).not.toContain('notesCosmosStaticPreviewVisualGrammarPolishClosureAudit');
      expect(source).not.toContain('K-273 Notes/Cosmos Static Preview Visual Grammar Polish Closure Audit');
      expect(source).not.toContain('K-274 Notes/Cosmos Static Preview Accessibility/Fallback Audit');
    }
  });

  it('confirms generated static harness output is not committed', () => {
    expect(existsSync(staticHarnessOutputPath)).toBe(false);
  });

  it('does not contain obvious committed credential material', () => {
    const doc = readDoc();

    for (const forbidden of [
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE ' + 'KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'access_' + 'token=',
      'refresh_' + 'token=',
    ]) {
      expect(doc).not.toContain(forbidden);
    }
  });
});
