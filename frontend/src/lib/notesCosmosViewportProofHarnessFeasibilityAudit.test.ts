import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-229-notes-cosmos-viewport-proof-harness-feasibility-audit.md',
);

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-229 Notes/Cosmos viewport proof harness feasibility audit', () => {
  it('exists and defines docs/audit-only scope without implementation', () => {
    expect(existsSync(docPath)).toBe(true);
    const text = readDoc();

    for (const required of [
      'K-229 Notes/Cosmos Viewport Proof Harness Feasibility Audit',
      'K-229 is docs/audit only.',
      'It does not implement a harness',
      'app route, panel, Sidebar entry, `TabId`, `AppContent` branch',
      'K-229 does not mount `NotesCosmosStaticPreview` anywhere in runtime.',
      'decides whether K-230 can implement a harness safely',
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
      'K-227 blocked a dev route/panel because a safe convention was not proven.',
      'K-228 defined the real viewport harness plan',
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

  it('documents source inspection findings for tooling, QA, route, and production gates', () => {
    const text = readDoc();

    for (const required of [
      '## Source Inspection Findings',
      '### Package Scripts',
      '`frontend/package.json`',
      'Absent: browser-test, component-preview, Storybook, Cypress, Playwright, Puppeteer QA',
      '### Vite / Dev Server Setup',
      '`frontend/vite.config.ts`',
      'No multi-entry Vite harness config, dev-only route exclusion',
      '### productQaCapture / Puppeteer Tooling',
      '`frontend/scripts/productQaCapture.mjs`',
      'sets four viewports including mobile `390x844`',
      'reads `frontend/.env`, requires Supabase URL/key',
      '`frontend/package.json` does not declare `puppeteer`',
      '### Backup Browser Verification Script',
      '`frontend/scripts/verifyBackupRestoreBrowser.mjs`',
      '### Test Setup',
      '`renderToStaticMarkup`',
      '### QA Docs / Manual QA Conventions',
      '### Static HTML / Render Target Possibility',
      '### Route Registration / Navigation Convention',
      '`TabId` is a fixed shipped workspace union',
      '### Production Exclusion / Dev-Only Entry Patterns',
      'No production build exclusion pattern for a dev-only preview page',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('compares all required feasibility options', () => {
    const text = readDoc();

    for (const required of [
      '### Option A: Reuse Existing productQaCapture / Puppeteer Tooling',
      'Can it capture a local static HTML target? Not as written',
      'Can it set viewport to 390px? Yes, source-verified.',
      'Can it avoid normal app navigation? No',
      'Can it avoid live user notes/data? No as-is',
      'Can it run without new dependencies? Unclear',
      '### Option B: Local-Only Isolated Vite Harness',
      'production exclusion must be proven',
      '### Option C: Test-Only Static HTML / Render Target',
      'Can React render static markup for the component? Yes, source-verified.',
      'Most feasible next path, but plan first.',
      '### Option D: Add Browser Tooling Later',
      'Do not add Playwright, Cypress, Storybook, or Puppeteer dependency in K-229.',
      '### Option E: Defer Real Viewport Proof Until Safe Surface Exists',
      'leaves 390px proof unresolved',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('states the feasibility decision and recommended K-230 path', () => {
    const text = readDoc();

    for (const required of [
      '## Feasibility Decision',
      'Chosen outcome: **Outcome B: Static HTML/render target is most feasible but needs a plan first**.',
      'Do not choose a route/panel implementation as the K-230 default.',
      'Do not choose direct productQaCapture reuse as the K-230 default',
      '## Recommended K-230',
      'Recommended next milestone: **K-230 Notes/Cosmos Static HTML Viewport Harness Plan**.',
      'Prefer plan over implementation for K-230',
      'Only a later K-231-style implementation should proceed',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines future implementation guardrails and 390px proof requirements', () => {
    const text = readDoc();

    for (const required of [
      '## K-230 Implementation Guardrails If Later Approved',
      'not add app route.',
      'not add Sidebar / `TabId` / `AppContent` changes.',
      'not add hidden panel.',
      'not mount in normal Notes runtime.',
      'use K-220 fixture-only input.',
      'not import KnowledgeIndexService or graph builders.',
      'not add assets/fonts/dependencies unless separately approved.',
      'provide 390px viewport proof.',
      'preserve NoteGraphView/LocalGraphView and existing empty states.',
      '## 390px Proof Requirements',
      'browser-rendered at 390px width.',
      'no horizontal scroll caused by `NotesCosmosStaticPreview`.',
      'all 10 nodes visible or represented in fallback list.',
      'all 12 relationships visible or represented in fallback list.',
      'tone/kind/status/cluster text readable.',
      'screenshot or automated result can be reported in PR.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines data/security boundaries and preserves existing surfaces', () => {
    const text = readDoc();

    for (const required of [
      '## Data / Security Boundary',
      'no live user notes.',
      'no IndexedDB reads.',
      'no Supabase reads/writes.',
      'no Google Drive/attachment reads/writes.',
      'no background sync/upload.',
      'no credentials.',
      'no telemetry changes.',
      'no graph builder or KnowledgeIndexService reads.',
      'no production claim that Cosmos Map exists.',
      '## Relationship To Existing Surfaces',
      'NoteGraphView remains the shipped full-vault graph surface.',
      'LocalGraphView remains the local/context graph surface.',
      'NotesCosmosStaticPreview remains the fixture-driven static preview.',
      'NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.',
      'ProductEmptyState remains the generic/product empty state.',
      'K-230 must not replace or mount inside any of these.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and closes with no normal Notes runtime wiring', () => {
    const text = readDoc();

    for (const required of [
      '## Non-Goals',
      'no harness implementation in K-229.',
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
      '## Closure',
      'K-229 decides whether real viewport proof can be pursued without route/panel exposure.',
      'NotesCosmosStaticPreview remains unwired.',
      'If no safe no-route path exists, K-230 must defer implementation.',
      'No normal Notes runtime wiring should occur yet.',
      'NoteGraphView and LocalGraphView remain preserved.',
    ]) {
      expect(text).toContain(required);
    }
  });
});
