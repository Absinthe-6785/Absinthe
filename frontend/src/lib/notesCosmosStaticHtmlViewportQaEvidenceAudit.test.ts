import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-234-notes-cosmos-static-html-viewport-qa-evidence-audit.md',
);

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-234 Notes/Cosmos static HTML viewport QA evidence audit', () => {
  it('adds the K-234 QA evidence audit document and purpose guardrails', () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc();
    expect(doc).toContain('K-234 Notes/Cosmos Static HTML Viewport QA Evidence Audit');
    expect(doc).toContain('K-234 is docs/audit only.');
    expect(doc).toContain('K-234 does not change the generator.');
    expect(doc).toContain('K-234 does not change the component.');
    expect(doc).toContain('K-234 does not add route, panel, hidden panel, navigation, Sidebar, `TabId`, `AppContent`, or runtime Notes wiring.');
    expect(doc).toContain('K-234 separates QA evidence closure from any product placement decision.');
  });

  it('summarizes current state and preserved surfaces', () => {
    const doc = readDoc();

    for (const required of [
      'K-220 mock fixture contract exists.',
      'K-222 isolated component skeleton exists.',
      'K-224 polish, mobile fallback, and accessibility hardening completed.',
      'K-232 implemented the static HTML viewport harness generator.',
      'K-233 closed generator implementation safety.',
      '`NotesCosmosStaticPreview` remains unwired.',
      'Generated output is ephemeral.',
      'No normal Notes navigation connection exists.',
      'No hidden experimental panel exists.',
      '`NoteGraphView` and `LocalGraphView` remain preserved.',
      '`ProductEmptyState` and `NotesPixelCosmosEmptyState` remain preserved.',
      'K-220 fixture-only input remains the only approved input.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents evidence sources and what was repeated in K-234', () => {
    const doc = readDoc();

    for (const required of [
      'K-232 generator doc:',
      'K-232 generator script:',
      'K-232 generator test:',
      'K-233 closure audit doc:',
      'K-233 closure audit test:',
      'Generated HTML inspection in K-234:',
      'Manual 390px QA evidence from K-232:',
      'K-234 reviewed this prior evidence.',
      'K-234 repeated generator execution.',
      'K-234 reviewed this evidence and did not repeat browser QA.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents generator command and output evidence', () => {
    const doc = readDoc();

    for (const required of [
      'frontend/scripts/renderNotesCosmosStaticPreview.mjs',
      'cd frontend',
      'node scripts/renderNotesCosmosStaticPreview.mjs',
      'frontend/dist/notes-cosmos-static-preview/index.html',
      '`renderToStaticMarkup` + Vite `ssrLoadModule`.',
      'minimal inline structural CSS.',
      'generated output is ephemeral.',
      'generated HTML is not committed.',
      '`package.json` unchanged.',
      '`vite.config.ts` unchanged.',
      'no route/panel/runtime wiring.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents 390px viewport QA evidence and K-232 versus K-234 status', () => {
    const doc = readDoc();

    for (const required of [
      'K-232 manual 390px browser QA was completed.',
      'K-234 did not repeat browser QA.',
      'K-234 reviewed K-232 evidence, not repeated browser QA',
      'Viewport width:',
      '390px.',
      'no horizontal overflow.',
      'title/description readability.',
      'node readability.',
      'relationship readability.',
      'tone/kind/status/cluster readability.',
      'fallback/list usability.',
      'unclipped primary content.',
      'no canvas/SVG/WebGL/interactive graph.',
      'no live data.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents count interpretation for content and attribute scans', () => {
    const doc = readDoc();

    for (const required of [
      'Content-level nodes: 10.',
      'Content-level relationships: 12.',
      'K-220 fixture remains authoritative for intended fixture size.',
      'Content-level count is the user-visible fixture count.',
      'Attribute-match count is a scan implementation detail, not a product data count.',
      'Raw `data-node-id` or `data-relationship-id` attribute match counts may differ from content-level counts.',
      'Duplicate attribute occurrences, wrapper elements, repeated fallback rows, serialized markup, or test selectors can inflate raw match counts.',
      '`data-node-id` match count should not be interpreted as actual node count if it differs from content-level nodes.',
      'Relationship count should be based on rendered relationship content/list rows and the K-220 fixture, not arbitrary attribute string count.',
      'raw `data-node-id` matches: 10.',
      'raw `data-relationship-id` matches: 12.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents generated HTML safety and forbidden scan wording', () => {
    const doc = readDoc();

    for (const required of [
      'Dev/Test Harness label present.',
      '`Not a runtime app route` warning present.',
      'content-level nodes: 10.',
      'content-level relationships: 12.',
      'fallback/list content present.',
      'tone/kind/status/cluster text present.',
      'script-tags=0.',
      'svg-tags=0.',
      'canvas-tags=0.',
      'no app route/nav/sidebar shell.',
      'no live notes/user data.',
      'no Supabase/OAuth/attachment behavior.',
      'no `KnowledgeIndexService` usage.',
      'no graph builder usage.',
      'no production Cosmos Map claim.',
      'Forbidden generated-HTML scan means:',
      'scan generated HTML for executable script tags.',
      'scan generated HTML for svg/canvas graph surfaces.',
      'scan generated HTML for app runtime nav/sidebar text.',
      'scan generated HTML for obvious credential/token strings.',
      'scan source files for forbidden imports/wiring.',
      'Docs/tests mentioning forbidden terms as guardrails are not runtime imports.',
      'Source grep results should be interpreted by file context.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents artifact lifecycle, runtime exposure, and import/data boundaries', () => {
    const doc = readDoc();

    for (const required of [
      'K-232 artifact lifecycle:',
      'generated artifact was created during validation.',
      'generated artifact was inspected.',
      'generated artifact was removed.',
      'final working tree was clean.',
      'K-234 repeated generation.',
      'K-234 inspected generated output.',
      'K-234 cleaned generated output after inspection.',
      '`dist/notes-cosmos-static-preview` cleanup confirmed.',
      'no route added.',
      'no panel added.',
      'no normal Notes navigation added.',
      'no Sidebar / `TabId` / `AppContent` changes.',
      '`NotesCosmosStaticPreview` remains unwired.',
      '`NoteView` unchanged.',
      '`NoteGraphView` unchanged.',
      '`LocalGraphView` unchanged.',
      '`ProductEmptyState` unchanged.',
      '`NotesPixelCosmosEmptyState` unchanged.',
      'no stores/persistence/schemas/providers changes.',
      'K-220 fixture-only input is used.',
      'no live notes.',
      'no IndexedDB reads.',
      'no Supabase reads/writes.',
      'no Google Drive/attachment reads/writes.',
      'no background sync/upload.',
      'no credentials.',
      'no telemetry changes.',
      'no `KnowledgeIndexService`.',
      'no graph builders.',
      'no saved coordinates/spatial metadata.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents limitations, K-235 recommendation, non-goals, and closure', () => {
    const doc = readDoc();

    for (const required of [
      'Minimal inline structural CSS does not prove full app visual parity.',
      'Static HTML harness is not a product surface.',
      'Viewport QA is manual/evidence-based, not fully automated.',
      'No runtime placement decision has been made.',
      'No route/panel convention has been approved.',
      'Cosmos Map runtime remains unimplemented.',
      'Harness output must remain ephemeral.',
      '**K-235 Local-first Backup/Restore Boundary Spec**',
      'define Absinthe-wide backup/restore/sync boundary.',
      'no generator changes in K-234.',
      'no component changes.',
      'no static HTML committed.',
      'no scripts added.',
      'no package.json changes.',
      'no vite.config changes.',
      'no route/navigation wiring.',
      'no hidden experimental panel.',
      'no Sidebar / `TabId` / `AppContent` changes.',
      'no normal Notes navigation connection.',
      'no normal Notes runtime wiring.',
      'no `NoteView` changes.',
      'no `NoteGraphView` changes.',
      'no `LocalGraphView` changes.',
      'no `ProductEmptyState` changes.',
      'no `NotesPixelCosmosEmptyState` changes.',
      'no graph/canvas/orbit map.',
      'no live graph data.',
      'no `KnowledgeIndexService` or graph builder coupling.',
      'no stores/schemas/providers/persistence changes.',
      'no editor changes.',
      'no OAuth/Supabase/attachment behavior.',
      'no Health/Schedule behavior.',
      'no assets/fonts/dependencies.',
      'no Playwright/Cypress/Storybook addition.',
      'no Google Drive QA work.',
      'K-234 consolidates the QA evidence chain for the static HTML viewport harness.',
      'Static HTML harness remains dev/test-only and ephemeral.',
      'No normal Notes runtime wiring should occur yet.',
      'If current viewport evidence is sufficient, the project can safely shift to the next core reliability line.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
