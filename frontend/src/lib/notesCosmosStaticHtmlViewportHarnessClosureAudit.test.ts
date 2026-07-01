import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-233-notes-cosmos-static-html-viewport-harness-closure-audit.md',
);

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-233 Notes/Cosmos static HTML viewport harness closure audit', () => {
  it('adds the K-233 closure audit document', () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc();
    expect(doc).toContain('K-233 Notes/Cosmos Static HTML Viewport Harness Closure Audit');
    expect(doc).toContain('K-233 is docs/audit only.');
    expect(doc).toContain('K-233 does not expand the generator.');
    expect(doc).toContain('K-233 does not add route, panel, hidden panel, Sidebar, `TabId`, `AppContent`, or normal Notes runtime wiring.');
  });

  it('summarizes current state and preserves existing Notes/Cosmos surfaces', () => {
    const doc = readDoc();

    for (const required of [
      'K-220 added the mock fixture contract',
      'K-222 added the isolated `NotesCosmosStaticPreview` component skeleton.',
      'K-224 completed polish, mobile fallback, and accessibility hardening',
      'K-227 blocked route/panel implementation',
      'K-232 implemented the static HTML viewport harness generator.',
      '`NotesCosmosStaticPreview` remains unwired.',
      'No normal Notes navigation connection exists.',
      'No hidden experimental panel exists.',
      '`NoteGraphView` and `LocalGraphView` remain preserved.',
      '`ProductEmptyState` and `NotesPixelCosmosEmptyState` remain preserved.',
      'K-220 fixture-only input remains the only approved input',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents the K-232 generator command, output, render strategy, and artifact policy', () => {
    const doc = readDoc();

    for (const required of [
      'frontend/scripts/renderNotesCosmosStaticPreview.mjs',
      'cd frontend',
      'node scripts/renderNotesCosmosStaticPreview.mjs',
      'frontend/dist/notes-cosmos-static-preview/index.html',
      'React `renderToStaticMarkup`.',
      'Vite `ssrLoadModule`.',
      'minimal inline structural CSS.',
      'generated output is ephemeral.',
      'generated HTML is not committed.',
      '`package.json`: unchanged.',
      '`vite.config.ts`: unchanged.',
      'dev/test-only.',
      'not a runtime app route.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents generated HTML safety results', () => {
    const doc = readDoc();

    for (const required of [
      'Dev/Test Harness label present.',
      '`Not a runtime app route` text present.',
      '10 nodes rendered.',
      '12 relationships rendered.',
      'fallback/list content present.',
      'tone/kind/status/cluster text present.',
      'script-tags=0.',
      'svg-tags=0.',
      'canvas-tags=0.',
      'no app route/nav/sidebar shell.',
      'no live notes or user data.',
      'no Supabase/OAuth/attachment behavior.',
      'no `KnowledgeIndexService` usage.',
      'no graph builder usage.',
      'no production Cosmos Map claim.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents artifact hygiene and 390px QA evidence', () => {
    const doc = readDoc();

    for (const required of [
      'K-232 created the generated artifact during validation.',
      'K-232 removed the generated artifact after browser QA.',
      'final git status must not include generated HTML.',
      'no generated HTML, image assets, font files, or screenshots are committed.',
      'K-232 completed manual browser QA for the generated static HTML at 390px width.',
      'no horizontal overflow.',
      'preview root did not overflow.',
      'readable labels.',
      'unclipped primary content.',
      'fallback/list usability.',
      'no canvas/SVG/WebGL/interactive graph.',
      'no app runtime nav text detected.',
      'K-232 provides sufficient first viewport proof for the static HTML harness.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents runtime exposure, import, and data boundaries', () => {
    const doc = readDoc();

    for (const required of [
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
      '`NotesCosmosStaticPreview`.',
      'K-220 fixture/mock contract.',
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

  it('documents remaining risks and recommends the K-234 path', () => {
    const doc = readDoc();

    for (const required of [
      'The generator/script workflow is Medium-risk by milestone type',
      'Runtime exposure risk remains Low',
      'CSS fidelity is intentionally limited to minimal inline structural CSS.',
      'The static HTML harness does not prove full app visual parity.',
      'Manual QA repeatability could be improved later.',
      'The static harness should not be mistaken for a runtime Cosmos Map.',
      'The product placement decision remains separate from harness closure.',
      '**K-234 Notes/Cosmos Static HTML Viewport QA Evidence Audit**',
      'no generator changes unless a bug is found.',
      'no route/panel/runtime wiring.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and closure guardrails', () => {
    const doc = readDoc();

    for (const required of [
      'no generator expansion in K-233.',
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
      'no component code changes.',
      'no graph/canvas/orbit map.',
      'no live graph data.',
      'no `KnowledgeIndexService` or graph builder coupling.',
      'no stores/schemas/providers/persistence changes.',
      'no editor changes.',
      'no OAuth/Supabase/attachment behavior.',
      'no Google Drive QA work.',
      'no Health/Schedule behavior.',
      'no assets/fonts/dependencies.',
      'no Playwright/Cypress/Storybook addition.',
      'K-232 static HTML viewport harness generator is closed if audit checks pass.',
      'Static HTML harness remains dev/test-only and ephemeral.',
      'No normal Notes runtime wiring should occur yet.',
      'Next product decision should be made separately from harness closure.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
