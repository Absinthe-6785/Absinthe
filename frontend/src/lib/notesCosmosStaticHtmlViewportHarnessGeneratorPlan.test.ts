import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-231-notes-cosmos-static-html-viewport-harness-generator-plan.md',
);

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-231 Notes/Cosmos static HTML viewport harness generator plan', () => {
  it('exists and defines docs/plan-only scope without generator implementation', () => {
    expect(existsSync(docPath)).toBe(true);
    const text = readDoc();

    for (const required of [
      'K-231 Notes/Cosmos Static HTML Viewport Harness Generator Plan',
      'K-231 is docs/plan only.',
      'It does not implement the generator',
      'add scripts, generate or commit HTML artifacts',
      'add routes, add panels, add navigation, or wire runtime UI',
      'K-231 keeps `NotesCosmosStaticPreview` unwired',
      'prepares K-232 implementation or a fallback audit',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('summarizes current state and preserves fixture-only isolation', () => {
    const text = readDoc();

    for (const required of [
      '## Current State Summary',
      'K-220 mock fixture contract exists',
      'K-222 isolated component skeleton exists',
      'K-224 polish, mobile, and accessibility hardening is complete.',
      'K-227 blocked route/panel because safe convention was not proven.',
      'K-228 defined real viewport harness needs.',
      'K-229 identified static HTML/render target as the most feasible path.',
      'K-230 planned static HTML viewport proof and required K-231 to lock exact generator details.',
      '`NotesCosmosStaticPreview` remains unwired.',
      'no normal Notes navigation connection exists.',
      'no hidden experimental panel exists.',
      'no live graph/user data is used.',
      'NoteGraphView and LocalGraphView remain preserved.',
      'K-220 fixture-only input remains the only approved input.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents source inspection findings for component, fixture, CSS, scripts, Vite, TS, QA, and artifacts', () => {
    const text = readDoc();

    for (const required of [
      '## Source Inspection Findings',
      '### NotesCosmosStaticPreview Component',
      '`frontend/src/components/notes/NotesCosmosStaticPreview.tsx`',
      '### K-220 Fixture / Mock Contract',
      '`frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`',
      'The fixture contains 10 nodes, 12 relationships, 3 clusters',
      '### Tailwind / CSS Setup',
      '`frontend/src/index.css`',
      '`frontend/tailwind.config.cjs`',
      '`frontend/postcss.config.cjs`',
      '### Package Scripts',
      '`frontend/package.json`',
      'No static HTML harness script exists.',
      '### Vite Config',
      '`frontend/vite.config.ts`',
      '### TypeScript / Node Script Conventions',
      'There is no `tsx`, `ts-node`, or custom TypeScript runner dependency.',
      '### productQaCapture / Puppeteer Tooling',
      '`frontend/scripts/productQaCapture.mjs`',
      '`frontend/scripts/verifyBackupRestoreBrowser.mjs`',
      '### Test Setup',
      '### .gitignore / Generated Artifact Policy',
      'Root `.gitignore` ignores `dist/`',
      '### Docs / Manual QA Artifact Conventions',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines exact future file list, command shape, and output cleanup policy', () => {
    const text = readDoc();

    for (const required of [
      '## Exact Future File List',
      '`frontend/scripts/renderNotesCosmosStaticPreview.mjs`',
      '`frontend/docs/K-232-notes-cosmos-static-html-viewport-harness-generator.md`',
      '`frontend/src/lib/notesCosmosStaticHtmlViewportHarnessGenerator.test.ts`',
      '`frontend/dist/notes-cosmos-static-preview/index.html`',
      'Generated output should not be committed.',
      '## Exact Command Shape',
      'node scripts/renderNotesCosmosStaticPreview.mjs',
      'Use `.mjs`.',
      'Do not use `.ts` or `.tsx` because the repo has no Node TypeScript runner dependency.',
      'Do not add a `package.json` script at first.',
      'use Vite\'s programmatic SSR loader',
      'server.ssrLoadModule',
      '## Output Path And Cleanup Policy',
      'Exact output directory:',
      '`frontend/dist/notes-cosmos-static-preview`',
      'Root `.gitignore` already ignores `dist/`.',
      'It must not delete all of `frontend/dist`.',
      'Generated output is ephemeral.',
      'Generated output is not committed.',
      'Remove-Item -LiteralPath frontend\\dist\\notes-cosmos-static-preview -Recurse -Force',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines static render strategy and CSS fidelity strategy', () => {
    const text = readDoc();

    for (const required of [
      '## Static Render Strategy',
      'Use React `renderToStaticMarkup`.',
      'Render only `NotesCosmosStaticPreview`.',
      'Use K-220 fixture-only input.',
      'Include a visible "Dev/Test Harness" label.',
      'It loads `NotesCosmosStaticPreview.tsx` through Vite `ssrLoadModule`',
      'Do not add a React wrapper component under `src`.',
      '**K-232 Notes/Cosmos Static HTML Harness Import and CSS Fidelity Audit**',
      '## CSS Fidelity Strategy',
      '### Option 1: Minimal Inline Harness CSS',
      'Preferred first K-232 implementation path.',
      'This proves structural overflow/readability, not final app visual parity.',
      '### Option 2: Include Existing Built CSS',
      'Defer.',
      '### Option 3: Use Vite Transform/Build For Isolated Entry',
      '### Option 4: Render Without Full CSS',
      'Use minimal inline harness CSS in generated HTML.',
      'Do not change Tailwind config, PostCSS config, global CSS, fonts, or assets.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines 390px browser/manual QA and no-overflow failure criteria', () => {
    const text = readDoc();

    for (const required of [
      '## 390px Browser / Manual QA Procedure',
      'Run the generator command:',
      'Open `frontend/dist/notes-cosmos-static-preview/index.html` in a browser.',
      'Set viewport width to 390px.',
      'Confirm the Dev/Test Harness label is visible.',
      'Confirm fixture title and description render.',
      'Confirm all 10 nodes render.',
      'Confirm all 12 relationships render.',
      'Confirm tone/kind/status/cluster text renders.',
      'Confirm no horizontal overflow.',
      'Confirm no canvas/SVG/WebGL/interactive graph appears.',
      'Confirm generated artifact is not committed.',
      'Browser QA is not required for K-231',
      '## No-Overflow Measurement Criteria',
      'browser shows horizontal page scroll at 390px due to preview content.',
      'preview root `scrollWidth` exceeds viewport/client width',
      'title, description, node labels, or relationship labels are clipped.',
      'fallback/list content is missing.',
      'document.documentElement.scrollWidth <= window.innerWidth',
      'Do not claim this scripted check exists until implemented.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines artifact reporting, data/security boundary, and existing surface preservation', () => {
    const text = readDoc();

    for (const required of [
      '## Artifact Reporting Policy',
      'generator command run.',
      'generated output path.',
      'browser and viewport used.',
      '390px result.',
      'overflow result.',
      'nodes count.',
      'relationships count.',
      'confirmation that generated HTML was not committed.',
      '## Data / Security Boundary',
      'K-220 fixture-only input.',
      'no live user notes.',
      'no IndexedDB reads.',
      'no Supabase reads/writes.',
      'no Google Drive/attachment reads/writes.',
      'no background sync/upload.',
      'no credentials.',
      'no telemetry changes.',
      'no graph builder or KnowledgeIndexService reads.',
      'no production claim that Cosmos Map exists.',
      'no saved coordinates/spatial metadata.',
      'no routes/panels/sidebar entries.',
      'no OAuth/client secret/env values.',
      'no access token.',
      'no refresh token.',
      '## Relationship To Existing Surfaces',
      'NoteGraphView remains the shipped full-vault graph surface.',
      'LocalGraphView remains the local/context graph surface.',
      'NotesCosmosStaticPreview remains the fixture-driven static preview.',
      'NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.',
      'ProductEmptyState remains the generic/product empty state.',
      'K-232 must not replace or mount inside any of these.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('chooses K-232 generator path and defines implementation guardrails', () => {
    const text = readDoc();

    for (const required of [
      '## K-232 Decision',
      'Chosen primary next milestone: **K-232 Notes/Cosmos Static HTML Viewport Harness Generator**.',
      'implement minimal generator at `frontend/scripts/renderNotesCosmosStaticPreview.mjs`.',
      'no route/panel.',
      'no package.json script unless K-232 proves direct command is impossible.',
      'no generated HTML committed.',
      'minimal inline structural CSS.',
      'Fallback if Vite SSR import fails:',
      '**K-232 Notes/Cosmos Static HTML Harness Import and CSS Fidelity Audit**.',
      '**K-232 Notes/Cosmos Static HTML Harness Artifact Policy Audit**.',
      '## K-232 Implementation Guardrails',
      'not add app route.',
      'not add Sidebar / `TabId` / `AppContent` changes.',
      'not mount in normal Notes runtime.',
      'not read user notes or live graph data.',
      'use K-220 fixture-only input.',
      'not import KnowledgeIndexService or graph builders.',
      'not add assets/fonts/dependencies unless separately approved.',
      'not commit generated HTML.',
      'write output only to ignored/ephemeral path.',
      'verify no horizontal overflow.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and closes with no normal Notes runtime wiring', () => {
    const text = readDoc();

    for (const required of [
      '## Non-Goals',
      'no generator implementation in K-231.',
      'no static HTML generated.',
      'no generated HTML committed.',
      'no scripts added.',
      'no package.json changes.',
      'no vite.config changes.',
      'no route/navigation wiring.',
      'no hidden experimental panel.',
      'no Sidebar / `TabId` / `AppContent` changes.',
      'no normal Notes navigation connection.',
      'no NoteView changes.',
      'no NoteGraphView changes.',
      'no LocalGraphView changes.',
      'no ProductEmptyState changes.',
      'no NotesPixelCosmosEmptyState changes.',
      'no component code changes.',
      'no graph/canvas/orbit map.',
      'no live graph data.',
      'no KnowledgeIndexService or graph builder coupling.',
      'no stores/schemas/providers/persistence changes.',
      'no editor changes.',
      'no OAuth/Supabase/attachment behavior.',
      'no Health/Schedule behavior.',
      'no assets/fonts/dependencies.',
      'no Playwright/Cypress/Storybook addition.',
      'no Google Drive QA work.',
      '## Closure',
      'K-231 makes K-232 implementation-ready without implementing the generator.',
      'NotesCosmosStaticPreview remains unwired.',
      'K-232 must not introduce route/panel/runtime wiring.',
      'If import/CSS/artifact handling remains unclear, K-232 should remain an audit/plan.',
      'No normal Notes runtime wiring should occur yet.',
      'NoteGraphView and LocalGraphView remain preserved.',
    ]) {
      expect(text).toContain(required);
    }
  });
});
