import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-276-notes-cosmos-static-preview-viewport-proof-refresh.md',
);
const previewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const previewTestPath = join(
  process.cwd(),
  'src',
  'components',
  'notes',
  'NotesCosmosStaticPreview.test.ts',
);
const harnessScriptPath = join(process.cwd(), 'scripts', 'renderNotesCosmosStaticPreview.mjs');
const staticHarnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-276 notes cosmos static preview viewport proof refresh', () => {
  it('exists and defines proof-refresh-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-276 Notes/Cosmos Static Preview Viewport Proof Refresh',
      'K-276 refreshes Static Preview viewport proof after the K-272 signal hierarchy polish.',
      'K-276 uses the existing static HTML/viewport harness',
      'K-276 is proof refresh plus docs/audit plus audit test only.',
      'K-276 does not modify `NotesCosmosStaticPreview`.',
      'K-276 does not implement another Static Preview change.',
      'K-276 does not commit generated static harness artifacts.',
      'K-276 does not wire Static Preview into runtime.',
      'K-276 does not change route/nav/panel behavior.',
      'K-276 does not mount `NotesCosmosStaticPreview`.',
      'K-276 does not implement Runtime Cosmos Map.',
      'K-276 does not replace graph surfaces.',
      'K-276 chooses the K-277 next path',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes the current state after K-272 through K-275', () => {
    const doc = readDoc();

    for (const required of [
      'K-270 selected Static Preview continuation as an isolated visual/product grammar track.',
      'K-271 planned Static Preview visual grammar polish.',
      'K-272 implemented isolated signal readout / hierarchy polish.',
      'K-273 closed K-272.',
      'K-274 found no blocking accessibility/fallback gap for isolated Static Preview closure.',
      'K-275 planned viewport proof refresh and locked source-grounded harness/output/cleanup policy.',
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

  it('documents the harness command, output path, browser proof path, and cleanup', () => {
    const doc = readDoc();

    for (const required of [
      '## Harness Command And Output',
      'cd C:\\Users\\이도현\\GitRepos\\Absinthe\\frontend',
      'node .\\scripts\\renderNotesCosmosStaticPreview.mjs',
      'node scripts/renderNotesCosmosStaticPreview.mjs',
      'frontend/dist/notes-cosmos-static-preview/index.html',
      'C:\\Users\\이도현\\GitRepos\\Absinthe\\frontend\\dist\\notes-cosmos-static-preview\\index.html',
      'The harness command passed.',
      'The output was generated and inspected.',
      'Browser proof used a temporary localhost server',
      'direct `file://` navigation was blocked by browser safety policy.',
      'The generated output was then deleted.',
      'Git status after cleanup did not include generated output.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents 390px viewport proof results and signal hierarchy readability', () => {
    const doc = readDoc();

    for (const required of [
      '## Viewport Proof Results',
      '390px/narrow viewport proof passed',
      'viewport width: 390px.',
      'document scroll width: 375px.',
      'body scroll width: 375px.',
      'preview client width: 353px.',
      'preview scroll width: 353px.',
      'No horizontal overflow was observed.',
      'The overflow scan returned no overflowing elements.',
      '10 nodes and 12 relationships.',
      'The signal readout remained readable at 390px.',
      "primary signal: `Today's note`.",
      'secondary/supporting signal: `7 supporting records`.',
      'faint/background signal: `2 archive traces`.',
      'signal tier counts: 1 primary, 7 secondary, 2 faint.',
      '`Signal tier: Primary signal`, `Signal tier: Secondary signal`, and `Signal tier: Faint signal`',
      'It does not imply runtime readiness.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents fallback and semantic proof results', () => {
    const doc = readDoc();

    for (const required of [
      '## Fallback / Semantic Proof Results',
      'Fallback and semantic proof passed',
      '`Dev/Test Harness - Not a runtime app route`.',
      '`Signal readout`.',
      '`Primary signal`.',
      '`Secondary signals`.',
      '`Faint signals`.',
      '`Text fallback`.',
      '`Node order`.',
      '`Relationship order`.',
      '`390px minimum`, `no horizontal overflow`, `readable labels`, and `no clipped primary content`',
      'Essential information was not visual-only.',
      '`data-signal-tier`',
      'Fixture-driven content rendered.',
      'No canvas, SVG, WebGL',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents generated artifact cleanup and keeps output absent from the tree', () => {
    const doc = readDoc();

    for (const required of [
      '## Generated Artifact Cleanup',
      'Generated static HTML was temporary.',
      'Remove-Item -LiteralPath frontend\\dist\\notes-cosmos-static-preview -Recurse -Force',
      'No generated image asset was committed.',
      'No screenshot was committed.',
      'No font asset was committed.',
      'No package, Vite, or config change was made.',
      'No static harness output was committed.',
      'Git status after cleanup did not include generated output.',
    ]) {
      expect(doc).toContain(required);
    }

    expect(existsSync(staticHarnessOutputPath)).toBe(false);
  });

  it('audits isolation, graph preservation, and backup/provider boundaries', () => {
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
      'K-276 does not mount `NotesCosmosStaticPreview`.',
      '## Graph Surface Preservation',
      '`NoteGraphView` remains the full-vault graph.',
      '`LocalGraphView` remains the local/context graph.',
      'Cosmos Map does not replace either.',
      'K-276 does not alter graph builders.',
      'K-276 does not introduce live graph data into Static Preview.',
      '## Backup / Provider Boundary',
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

  it('documents validation and recommends the K-277 closure path', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Audit',
      '`node .\\scripts\\renderNotesCosmosStaticPreview.mjs` passed.',
      '390px viewport proof passed.',
      'generated output was deleted before commit.',
      'npm test -- src/lib/notesCosmosStaticPreviewViewportProofRefresh.test.ts',
      'npm test -- src/lib/notesCosmosStaticPreviewViewportProofRefreshPlan.test.ts',
      'npm test -- src/components/notes/NotesCosmosStaticPreview.test.ts',
      'npm run typecheck',
      'npm run build',
      'git diff --check',
      '## K-277 Decision',
      '**K-277 Notes/Cosmos Static Preview Visual Grammar Closure Audit**',
      'docs/audit plus audit test only.',
      'close current Static Preview visual polish/proof line.',
      'recommend next product surface planning.',
      'no component implementation.',
      'no runtime wiring.',
      '**K-277 Notes/Cosmos Static Preview Viewport Proof Closure Audit**',
      '**K-277 Notes/Cosmos Static Preview Viewport Fix Plan**',
      'runtime mounting.',
      'Runtime Cosmos Map.',
      'graph replacement.',
      'route/nav/panel.',
      'live Notes data.',
      'backup/Data Safety UI.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists explicit non-goals and closure statements', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no NotesCosmosStaticPreview changes in K-276.',
      'no Static Preview implementation in K-276.',
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
      'K-276 refreshes viewport proof after K-272 without changing the component.',
      'Static Preview remains fixture-driven, deterministic, isolated, and unwired.',
      'Accessibility/fallback has no blocking gap for isolated closure from K-274.',
      'Generated proof artifacts remain temporary and uncommitted.',
      'Viewport proof refresh does not imply runtime readiness.',
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

  it('keeps the source-grounded harness and component facts intact', () => {
    expect(existsSync(previewPath)).toBe(true);
    expect(existsSync(previewTestPath)).toBe(true);
    expect(existsSync(harnessScriptPath)).toBe(true);

    const previewSource = readSource(previewPath);
    const previewTestSource = readSource(previewTestPath);
    const harnessSource = readSource(harnessScriptPath);

    expect(previewSource).toContain('Signal readout');
    expect(previewSource).toContain('data-signal-tier');
    expect(previewSource).toContain('Text fallback');
    expect(previewSource).toContain('data-min-mobile-width={fixture.responsiveAcceptance.minMobileWidthPx}');
    expect(previewSource).not.toContain('KnowledgeIndexService');

    expect(previewTestSource).toContain('keeps all fixture content present in a 390px narrow-container render');
    expect(previewTestSource).toContain('data-signal-tier="primary"');
    expect(previewTestSource).toContain('data-signal-tier="secondary"');
    expect(previewTestSource).toContain('data-signal-tier="faint"');

    expect(harnessSource).toContain("path.resolve(frontendRoot, 'dist', 'notes-cosmos-static-preview')");
    expect(harnessSource).toContain('node scripts/renderNotesCosmosStaticPreview.mjs');
    expect(harnessSource).toContain('Manual 390px QA checklist');
    expect(harnessSource).toContain('Do not commit generated HTML.');
  });
});
