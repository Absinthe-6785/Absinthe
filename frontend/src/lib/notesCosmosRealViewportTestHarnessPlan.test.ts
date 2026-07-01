import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-228-notes-cosmos-real-viewport-test-harness-plan.md',
);

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-228 Notes/Cosmos real viewport test harness plan', () => {
  it('exists and defines docs/test-plan-only scope without implementing a harness', () => {
    expect(existsSync(docPath)).toBe(true);
    const text = readDoc();

    for (const required of [
      'K-228 Notes/Cosmos Real Viewport Test Harness Plan',
      'K-228 is docs/test-plan only.',
      'It does not implement a harness',
      'app route, panel, Sidebar entry, `TabId`, `AppContent` branch',
      'K-228 keeps `NotesCosmosStaticPreview` unwired',
      'follows K-227 Outcome B',
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
      'K-227 concluded that route/panel is not safe enough yet.',
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

  it('documents source inspection findings and current test limitations', () => {
    const text = readDoc();

    for (const required of [
      '## Source Inspection Findings',
      '### Package Scripts',
      '`frontend/package.json`',
      'no browser test script, Storybook script, Cypress script, Playwright script',
      '### Vitest / DOM Setup',
      '`frontend/vite.config.ts`',
      'Vitest uses `environment: \'node\'` by default',
      'many targeted tests opt into `happy-dom`',
      '`NotesCosmosStaticPreview.test.ts` uses `renderToStaticMarkup`',
      'current tests do not prove real browser layout',
      '### React Testing Library Usage',
      '### Browser-Mode Testing',
      'no configured Vitest browser-mode setup was found',
      '### Playwright / Cypress Presence',
      'no Playwright or Cypress dependency/script was found',
      '### Storybook / Story-Like Surface',
      'no Storybook dependency, Storybook script, or `.stories.*` convention was found',
      '### Vite Dev / Manual QA Patterns',
      '`npm run dev` starts Vite for the normal app',
      '### Local-Only Harness Patterns',
      'no existing no-route browser page for isolated React component visual QA was found',
      '### Can Current Tests Prove Real Layout Overflow?',
      'current SSR/JSDOM coverage is not enough for the requested real viewport proof',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines the real viewport problem statement and compares all harness options', () => {
    const text = readDoc();

    for (const required of [
      '## Real Viewport Problem Statement',
      'K-224 SSR/narrow-wrapper tests prove DOM/fallback intent, not full real browser layout.',
      'Real 390px viewport proof requires browser rendering or an equivalent visual harness.',
      'K-227 blocked route/panel because safe convention was not proven.',
      '### Option A: Continue SSR/JSDOM Constrained-Container Tests Only',
      'cannot fully prove real browser overflow',
      '### Option B: Test-Only Browser Harness Using Existing Tooling',
      'not currently available based on inspected sources',
      '### Option C: Local-Only Vite Harness Outside Normal App Routing',
      'must be clearly excluded from production/user flow',
      '### Option D: Story/Test Surface If Existing Tooling Already Exists',
      'not acceptable if it requires adding Storybook or dependencies',
      '### Option E: Screenshot / Manual HTML Fixture Generated From Test',
      'may not reflect real app CSS accurately',
      '### Option F: Normal App Route / Hidden Panel',
      'explicitly rejected by K-227 Outcome B',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('chooses the K-229 feasibility audit path and defines future harness acceptance', () => {
    const text = readDoc();

    for (const required of [
      '## Recommended Approach',
      'Chosen K-229 outcome: **Outcome B: Existing tooling is insufficient**.',
      'Recommended next milestone: **K-229 Notes/Cosmos Viewport Proof Harness Feasibility Audit**.',
      'docs/audit only.',
      'keep `NotesCosmosStaticPreview` unwired',
      'Do not recommend normal app route or hidden experimental panel as the K-229 default.',
      '## Future Harness Acceptance Criteria',
      'not add app route.',
      'not add Sidebar / `TabId` / `AppContent` changes.',
      'not add hidden panel.',
      'not appear in normal Notes navigation.',
      'use K-220 fixture-only input.',
      'not import KnowledgeIndexService or graph builders.',
      'not add assets/fonts/dependencies.',
      'provide 390px viewport proof.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines browser/manual QA strategy and 390px proof', () => {
    const text = readDoc();

    for (const required of [
      '## Browser / Manual QA Strategy',
      'Open the test harness using its documented command.',
      'Confirm the page/surface is not reachable from normal app navigation.',
      'Confirm all 10 nodes render.',
      'Confirm all 12 relationships render.',
      'Set viewport to 390px width.',
      'Confirm no horizontal overflow.',
      'Confirm fallback list remains usable.',
      'Confirm no user notes/live graph data appear.',
      '## 390px Proof Definition',
      'browser-rendered viewport at 390px width.',
      'no horizontal scroll caused by `NotesCosmosStaticPreview`.',
      'all primary text readable or available in fallback list.',
      'no clipped title/description/node/relationship labels.',
      'Non-proof:',
      'JSDOM-only assertion without documented limitation.',
      'desktop-only screenshot.',
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
      'no OAuth/client secret/env values.',
      'no access token.',
      'no refresh token.',
      'no graph builder or KnowledgeIndexService reads.',
      'no production claim that Cosmos Map exists.',
      '## Relationship To Existing Surfaces',
      'NoteGraphView remains the shipped full-vault graph surface.',
      'LocalGraphView remains the local/context graph surface.',
      'NotesCosmosStaticPreview remains the fixture-driven static preview.',
      'NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.',
      'ProductEmptyState remains the generic/product empty state.',
      'K-229 must not replace or mount inside any of these.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and closes with no normal Notes runtime wiring', () => {
    const text = readDoc();

    for (const required of [
      '## Non-Goals',
      'no harness implementation in K-228.',
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
      '## Closure',
      'K-228 defines how real viewport proof should be obtained without app route exposure.',
      'NotesCosmosStaticPreview remains unwired.',
      'If no safe harness path exists, K-229 must not implement route/panel.',
      'No normal Notes runtime wiring should occur yet.',
      'NoteGraphView and LocalGraphView remain preserved.',
    ]) {
      expect(text).toContain(required);
    }
  });
});
