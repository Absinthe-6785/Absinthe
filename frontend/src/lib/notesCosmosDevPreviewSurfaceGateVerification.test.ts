import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-227-notes-cosmos-dev-preview-surface-gate-verification.md',
);

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-227 Notes/Cosmos dev preview surface gate verification', () => {
  it('exists and defines docs/audit/spec-only scope without implementation', () => {
    expect(existsSync(docPath)).toBe(true);
    const text = readDoc();

    for (const required of [
      'K-227 Notes/Cosmos Dev Preview Surface Gate Verification',
      'K-227 is docs/audit/spec only.',
      'It does not implement a route, panel, preview surface',
      'keeps `NotesCosmosStaticPreview` unwired',
      'creates a go/no-go gate for K-228',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('summarizes current state and preserves the fixture-only preview boundary', () => {
    const text = readDoc();

    for (const required of [
      '## Current State Summary',
      'K-220 mock fixture contract exists',
      'K-222 isolated component skeleton exists',
      'K-224 polish, mobile, and accessibility hardening is complete.',
      'K-225 decided the viewing surface strategy',
      'K-226 specified dev/test preview surface requirements',
      '`NotesCosmosStaticPreview` remains unwired',
      'no normal Notes navigation connection exists',
      'no hidden experimental panel exists',
      'no live graph/user data is used',
      'NoteGraphView and LocalGraphView remain preserved',
      'K-220 fixture-only input remains the only approved input',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents source inspection findings for build, env, route, nav, QA, and production gates', () => {
    const text = readDoc();

    for (const required of [
      '## Source Inspection Findings',
      '### Build Scripts / Vite Config',
      '`frontend/package.json`',
      '`frontend/vite.config.ts`',
      'no production route exclusion plugin or preview-surface build convention was found',
      '### Environment Variable Usage',
      "`import.meta.env.DEV || import.meta.env.MODE === 'test'`",
      '`import.meta.env.PROD`',
      'no generic dev-preview-route gate convention was found',
      '### Router / Route Registration',
      'no React Router, BrowserRouter, HashRouter, or central route table was found',
      '### Normal App Navigation / Sidebar',
      '`TabId` is a fixed union of shipped workspaces',
      'no dev-only nav slot or hidden preview nav convention was found',
      '### Dev-Only Route / Page Convention',
      'no reusable dev-only route/page convention was found',
      '### Feature Flag Convention',
      'no generic feature flag framework for preview surfaces was found',
      '### Browser Test / Story/Test Surface Convention',
      'no Storybook dependency or `.stories.*` convention was found',
      'no Playwright/Cypress dependency was found',
      '### Manual QA Docs Convention',
      'manual localhost QA docs exist',
      '### Production Build Exclusion Pattern',
      'no route/module production exclusion pattern for dev preview pages was found',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines all required gate criteria and findings', () => {
    const text = readDoc();

    for (const required of [
      '## Gate Criteria',
      '### 1. Production Exposure Gate',
      'surface must not become a normal production user feature',
      'not satisfied yet',
      '### 2. Navigation Exposure Gate',
      'surface must not appear in normal Notes navigation',
      'satisfied only if K-228 avoids normal navigation entirely',
      '### 3. Data Boundary Gate',
      'must use K-220 fixture only',
      'must not read user notes',
      'must not import KnowledgeIndexService or graph builders',
      'satisfied by the current unwired component',
      '### 4. Safety / Removal Gate',
      'surface must have clear removal/rollback strategy',
      'surface must be labeled `Dev/Test Preview`',
      'not yet satisfied for a route/panel',
      '### 5. QA Gate',
      'must allow real browser viewport QA',
      'must include 390px width proof',
      'not satisfied yet',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('states Outcome B and recommends K-228 real viewport test harness plan', () => {
    const text = readDoc();

    for (const required of [
      '## Gate Verification Result',
      'Outcome B: Not safe enough to implement route/panel yet.',
      'K-228 should be **K-228 Notes/Cosmos Real Viewport Test Harness Plan**.',
      'current repo conventions do not strongly prove safe dev-only route gating',
      'no production route exclusion convention was found',
      'no Storybook/Cypress/Playwright/browser harness convention was found',
      '## Recommended K-228 Path',
      'Recommended next milestone: **K-228 Notes/Cosmos Real Viewport Test Harness Plan**.',
      'docs/test-plan only',
      'keep `NotesCosmosStaticPreview` unwired',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines route strategy constraints if Outcome A is revisited later', () => {
    const text = readDoc();

    for (const required of [
      '## Route / Gating Strategy If Outcome A Later Applies',
      'K-227 does not recommend Outcome A now.',
      'route must be dev/test-only',
      'route must be inaccessible from normal nav',
      'route must import only `NotesCosmosStaticPreview` and K-220 fixture input',
      'route must not import NoteGraphView or LocalGraphView',
      'route must not import stores/persistence/providers',
      'production exposure must be testable or source-verifiable',
      'remain future constraints rather than implementation approval',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines real viewport QA and security/privacy boundaries', () => {
    const text = readDoc();

    for (const required of [
      '## Real Viewport QA Strategy',
      '390px viewport',
      'no horizontal overflow',
      'all nodes and relationships visible or fallback-readable',
      'long labels wrap',
      'no canvas/WebGL/interactive graph behavior',
      'normal Notes navigation remains unchanged',
      '## Security / Privacy Boundary',
      'no live user notes',
      'no IndexedDB reads',
      'no Supabase reads/writes',
      'no Google Drive/attachment reads/writes',
      'no background sync/upload',
      'no credentials',
      'no telemetry changes',
      'no graph builder or KnowledgeIndexService reads',
      'no production claim that Cosmos Map exists',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('preserves existing graph, empty-state, and product empty-state surfaces', () => {
    const text = readDoc();

    for (const required of [
      '## Relationship To Existing Surfaces',
      'NoteGraphView remains the shipped full-vault graph surface.',
      'LocalGraphView remains the local/context graph surface.',
      'NotesCosmosStaticPreview remains the fixture-driven static preview.',
      'NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.',
      'ProductEmptyState remains the generic/product empty state.',
      'K-228 must not replace any of these.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and closes with no normal Notes runtime wiring', () => {
    const text = readDoc();

    for (const required of [
      '## Non-Goals',
      'no runtime implementation in K-227',
      'no dev/test surface implementation in K-227',
      'no route/navigation wiring',
      'no hidden experimental panel',
      'no normal Notes navigation connection',
      'no NoteView changes',
      'no NoteGraphView changes',
      'no LocalGraphView changes',
      'no ProductEmptyState changes',
      'no NotesPixelCosmosEmptyState changes',
      'no component code changes',
      'no graph/canvas/orbit map',
      'no live graph data',
      'no KnowledgeIndexService or graph builder coupling',
      'no stores/schemas/providers/persistence changes',
      'no editor changes',
      'no OAuth/Supabase/attachment behavior',
      'no Health/Schedule behavior',
      'no assets/fonts/dependencies',
      'If gating is not strongly proven, K-228 must remain a real viewport test harness plan.',
      'No normal Notes runtime wiring should occur yet.',
      'NoteGraphView and LocalGraphView remain preserved.',
      'NotesCosmosStaticPreview remains fixture-only until an explicitly approved and safely gated dev/test surface exists.',
    ]) {
      expect(text).toContain(required);
    }
  });
});
