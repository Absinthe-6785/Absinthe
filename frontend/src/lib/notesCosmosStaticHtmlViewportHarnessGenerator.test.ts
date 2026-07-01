import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = join(process.cwd(), 'scripts', 'renderNotesCosmosStaticPreview.mjs');
const docPath = join(
  process.cwd(),
  'docs',
  'K-232-notes-cosmos-static-html-viewport-harness-generator.md',
);

function readScript(): string {
  return readFileSync(scriptPath, 'utf8');
}

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-232 Notes/Cosmos static HTML viewport harness generator', () => {
  it('adds the generator and K-232 documentation', () => {
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc();
    expect(doc).toContain('K-232 Notes/Cosmos Static HTML Viewport Harness Generator');
    expect(doc).toContain('It does not add route, panel, Sidebar, `TabId`, `AppContent`, or normal Notes runtime wiring.');
    expect(doc).toContain('It keeps `NotesCosmosStaticPreview` fixture-only through the K-220 mock contract.');
  });

  it('uses the isolated preview, K-220 fixture, renderToStaticMarkup, and Vite ssrLoadModule', () => {
    const source = readScript();

    for (const required of [
      'NotesCosmosStaticPreview',
      'notesCosmosStaticPreviewFixture',
      'renderToStaticMarkup',
      'createServer',
      'server.ssrLoadModule',
      "'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx'",
      "'src', 'lib', 'notesCosmosStaticPreviewMockContract.ts'",
    ]) {
      expect(source).toContain(required);
    }
  });

  it('writes only the ignored static preview output and prints cleanup instructions', () => {
    const source = readScript();

    for (const required of [
      "'dist', 'notes-cosmos-static-preview'",
      "'index.html'",
      'assertInsideFrontendDist(outputDir)',
      'await rm(outputDir, { recursive: true, force: true })',
      'await writeFile(outputFile, html, \'utf8\')',
      'Remove-Item -Recurse -Force .\\\\dist\\\\notes-cosmos-static-preview',
      'rm -rf dist/notes-cosmos-static-preview',
      'Do not commit generated HTML.',
    ]) {
      expect(source).toContain(required);
    }

    expect(source).not.toContain("rm(path.resolve(frontendRoot, 'dist')");
  });

  it('includes Dev/Test Harness label, minimal inline CSS, and manual QA text', () => {
    const source = readScript();

    for (const required of [
      'Dev/Test Harness - Not a runtime app route',
      'This static artifact uses mock fixture data only and is not connected to Notes runtime.',
      'CSS limitation: this file uses minimal inline structural CSS',
      'box-sizing: border-box',
      'overflow-wrap: anywhere',
      'Manual 390px QA checklist',
      'Set viewport width to 390px.',
      'Confirm all 10 nodes and all 12 relationships render.',
    ]) {
      expect(source).toContain(required);
    }
  });

  it('does not import route, graph, store, provider, persistence, remote, or asset modules', () => {
    const source = readScript();

    for (const forbiddenImport of [
      /from ['"].*NoteView/,
      /from ['"].*NoteGraphView/,
      /from ['"].*LocalGraphView/,
      /from ['"].*ProductEmptyState/,
      /from ['"].*NotesPixelCosmosEmptyState/,
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*buildGlobalGraphData/,
      /from ['"].*buildExpandedGraphData/,
      /from ['"].*useNotesStore/,
      /from ['"].*store/i,
      /from ['"].*provider/i,
      /from ['"].*persistence/i,
      /from ['"].*supabase/i,
      /from ['"].*google/i,
      /from ['"].*attac.*hment/i,
      /from ['"].*\.png/,
      /from ['"].*\.jpg/,
      /from ['"].*\.webp/,
      /from ['"].*\.woff/,
      /from ['"].*\.ttf/,
    ]) {
      expect(source).not.toMatch(forbiddenImport);
    }
  });

  it('does not include secret-token strings or queue/recovery action copy', () => {
    const source = readScript();

    for (const forbidden of [
      'client_secret',
      'access_token',
      'refresh_token',
      'Upload all',
      'Run queue',
      'Sync now',
      'Recover all',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('documents command, output, cleanup, CSS limits, and 390px manual QA', () => {
    const doc = readDoc();

    for (const required of [
      'node scripts/renderNotesCosmosStaticPreview.mjs',
      'frontend/dist/notes-cosmos-static-preview/index.html',
      'Generated output must not be committed.',
      'Remove-Item -Recurse -Force .\\dist\\notes-cosmos-static-preview',
      'minimal inline structural CSS',
      'It does not claim full app visual parity.',
      'Set viewport width to 390px.',
      'Confirm all 10 nodes render.',
      'Confirm all 12 relationships render.',
      'Confirm no horizontal overflow.',
      'Confirm no canvas/SVG/WebGL/interactive graph.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents no-overflow failure criteria, security boundaries, and existing surface preservation', () => {
    const doc = readDoc();

    for (const required of [
      '## No-Overflow Failure Criteria',
      'horizontal page scroll appears at 390px due to preview content.',
      'fixed-width canvas/container appears.',
      'fallback/list content is missing.',
      '## Security / Data Boundary',
      'K-220 fixture-only input.',
      'no live user notes.',
      'no IndexedDB reads.',
      'no Supabase reads/writes.',
      'no Google Drive/attachment reads/writes.',
      'no background sync/upload.',
      'no credentials.',
      'no KnowledgeIndexService/graph builder reads.',
      '## Relationship To Existing Surfaces',
      'NoteGraphView remains the shipped full-vault graph surface.',
      'LocalGraphView remains the local/context graph surface.',
      'NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.',
      'ProductEmptyState remains the generic/product empty state.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('records results, next milestone, and non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## Results',
      'PASS. `node scripts/renderNotesCosmosStaticPreview.mjs` generated the static HTML output.',
      'PASS. Browser rendered the static HTML at 390px width.',
      'Nodes: 10.',
      'Relationships: 12.',
      'Artifact committed:',
      'No.',
      '**K-233 Notes/Cosmos Static HTML Viewport QA Result Audit**',
      '## Non-Goals',
      'no route/navigation wiring.',
      'no Sidebar / `TabId` / `AppContent` changes.',
      'no NoteGraphView changes.',
      'no LocalGraphView changes.',
      'no ProductEmptyState changes.',
      'no NotesPixelCosmosEmptyState changes.',
      'no assets/fonts/dependencies.',
      'no Playwright/Cypress/Storybook.',
      'no generated HTML committed.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
