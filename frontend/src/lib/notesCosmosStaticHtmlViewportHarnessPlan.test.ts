import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-230-notes-cosmos-static-html-viewport-harness-plan.md',
);

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-230 Notes/Cosmos static HTML viewport harness plan', () => {
  it('exists and defines docs/plan-only scope without implementation', () => {
    expect(existsSync(docPath)).toBe(true);
    const text = readDoc();

    for (const required of [
      'K-230 Notes/Cosmos Static HTML Viewport Harness Plan',
      'K-230 is docs/plan only.',
      'It does not implement a generator',
      'add scripts, generate or commit HTML artifacts',
      'add routes, add panels, add navigation, or wire runtime UI',
      'K-230 keeps `NotesCosmosStaticPreview` unwired',
      'prepares a safe K-231 decision',
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
      'K-229 identified static HTML/render target as the most feasible path',
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

  it('documents source inspection findings for component, fixture, CSS, tooling, and artifacts', () => {
    const text = readDoc();

    for (const required of [
      '## Source Inspection Findings',
      '### NotesCosmosStaticPreview Component',
      '`frontend/src/components/notes/NotesCosmosStaticPreview.tsx`',
      'The component renders text-first React markup.',
      'Current tests use `renderToStaticMarkup`',
      '### K-220 Fixture / Mock Contract',
      '`frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`',
      'The fixture has 10 nodes, 12 relationships, 3 clusters',
      '### Tailwind / CSS Setup',
      '`frontend/src/index.css`',
      '`frontend/tailwind.config.cjs`',
      '`frontend/postcss.config.cjs`',
      'Do not change global CSS, Tailwind config, PostCSS config, fonts, or assets.',
      '### Package Scripts',
      '`frontend/package.json`',
      'No static HTML viewport harness script exists.',
      '### Vite Config',
      '`frontend/vite.config.ts`',
      'No multi-entry static harness config',
      '### productQaCapture / Puppeteer Tooling',
      '`frontend/scripts/productQaCapture.mjs`',
      '`frontend/scripts/verifyBackupRestoreBrowser.mjs`',
      'not suitable as-is',
      '### Test Setup',
      '### Generated Artifact / Output Folder Conventions',
      'No dedicated ignored `frontend/artifacts`, `frontend/tmp`, or static-preview output folder was found.',
      '### .gitignore / Artifact Handling Convention',
      '`dist/` is ignored globally.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines the static HTML harness concept and artifact policy', () => {
    const text = readDoc();

    for (const required of [
      '## Static HTML Harness Concept',
      'render `NotesCosmosStaticPreview` with K-220 fixture-only input.',
      'generate an isolated static HTML target outside normal app routing.',
      'include enough CSS for meaningful layout verification.',
      'allow browser render at 390px width.',
      'avoid live app navigation.',
      'avoid runtime user data.',
      'avoid routes, panels, Sidebar, `TabId`, and `AppContent`.',
      'not Cosmos Map runtime',
      'not user-facing',
      'not normal Notes navigation',
      'not a replacement for `NoteGraphView` or `LocalGraphView`',
      '## Artifact Policy',
      'generated HTML artifacts are ephemeral and not committed.',
      'K-231 must verify `.gitignore` or use a safe non-committed path.',
      'screenshots are not committed unless explicitly approved.',
      'K-231 should prefer ephemeral local output first.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('compares CSS fidelity options and static render strategies', () => {
    const text = readDoc();

    for (const required of [
      '## CSS Fidelity Plan',
      '### Option 1: Existing Built CSS Or Vite-Transformed CSS',
      'Highest, because Tailwind utilities and product variables can match the app.',
      '### Option 2: Inline Minimal Component-Scoped CSS',
      'Good enough for text wrapping, max-width, borders, spacing, and grid fallback',
      '### Option 3: Static Render Without Full CSS',
      'Too weak for product-quality viewport proof.',
      '### Option 4: App Shell CSS, Not App Route',
      'K-231 should first define an exact minimal approach',
      '## Static Render Strategy',
      '### Option A: React `renderToStaticMarkup` Output',
      'Use this as the core future generation strategy.',
      '### Option B: Vite-Built Isolated Entry',
      '### Option C: Existing Puppeteer / productQaCapture Consumes Generated Static File',
      'Do not reuse directly.',
      '### Option D: Manual Open Generated HTML',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines 390px proof criteria and no-overflow measurement plan', () => {
    const text = readDoc();

    for (const required of [
      '## 390px Proof Criteria',
      'browser-rendered viewport at 390px width.',
      'no horizontal scroll caused by `NotesCosmosStaticPreview`.',
      'fixture title and description readable.',
      'all 10 nodes visible or represented in fallback list.',
      'all 12 relationships visible or represented in fallback list.',
      'tone/kind/status/cluster text readable.',
      'no canvas, SVG, or WebGL.',
      'Non-proof:',
      'JSDOM class assertions.',
      'desktop-only screenshots.',
      'app route hidden behind navigation.',
      '## No-Overflow Measurement Plan',
      '### Option 1: Manual Browser Check',
      '### Option 2: Puppeteer Measurement',
      'document.documentElement.scrollWidth <= window.innerWidth',
      '### Option 3: CSS/Layout Smoke',
      '### Option 4: Hybrid',
      'Do not claim automated proof until it exists.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines data/security boundaries and preserves existing surfaces', () => {
    const text = readDoc();

    for (const required of [
      '## Data / Security Boundary',
      'K-220 fixture only.',
      'no live notes.',
      'no IndexedDB reads.',
      'no Supabase reads/writes.',
      'no Google Drive/attachment reads/writes.',
      'no background sync/upload.',
      'no credentials.',
      'no telemetry changes.',
      'no graph builder or KnowledgeIndexService reads.',
      'no production claim that Cosmos Map exists.',
      'no saved coordinates or spatial metadata.',
      'no routes, panels, Sidebar, `TabId`, or `AppContent`.',
      '## Relationship To Existing Surfaces',
      'NoteGraphView remains the shipped full-vault graph surface.',
      'LocalGraphView remains the local/context graph surface.',
      'NotesCosmosStaticPreview remains the fixture-driven static preview.',
      'NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.',
      'ProductEmptyState remains the generic/product empty state.',
      'K-231 must not replace or mount inside any of these.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('chooses a K-231 generator-plan milestone and lists guardrails/non-goals', () => {
    const text = readDoc();

    for (const required of [
      '## K-231 Decision',
      'Recommended next milestone: **K-231 Notes/Cosmos Static HTML Viewport Harness Generator Plan**.',
      'Direct generator implementation is promising but not yet crisp enough.',
      '**K-231 Notes/Cosmos Static HTML CSS Fidelity Audit**',
      '**K-231 Notes/Cosmos Static HTML Viewport Harness Generator**',
      'Choose the generator-plan milestone first.',
      '## K-231 Guardrails',
      'add a route.',
      'add Sidebar, `TabId`, or `AppContent` changes.',
      'mount inside normal Notes runtime.',
      'import live data.',
      'commit generated HTML unless explicitly approved.',
      'define a 390px proof path.',
      '## Non-Goals',
      'no generator implementation in K-230.',
      'no script additions.',
      'no package changes.',
      'no Vite config changes.',
      'no generated HTML artifacts.',
      'no committed screenshots.',
      'no route/navigation wiring.',
      'no component code changes.',
      'no assets/fonts/dependencies.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('closes with no normal Notes runtime wiring', () => {
    const text = readDoc();

    for (const required of [
      '## Closure',
      'K-230 plans the static HTML viewport proof path without implementing it.',
      'NotesCosmosStaticPreview remains unwired.',
      'K-231 must not introduce route, panel, navigation, or runtime wiring.',
      'If CSS fidelity, artifact policy, or browser runtime remains unclear, K-231 should remain plan/audit.',
      'No normal Notes runtime wiring should occur yet.',
      'NoteGraphView and LocalGraphView remain preserved.',
    ]) {
      expect(text).toContain(required);
    }
  });
});
