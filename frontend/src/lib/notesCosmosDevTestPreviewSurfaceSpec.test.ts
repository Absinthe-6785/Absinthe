import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const specPath = join(process.cwd(), 'docs', 'K-226-notes-cosmos-dev-test-preview-surface-spec.md');

function readSpec(): string {
  return readFileSync(specPath, 'utf8');
}

describe('K-226 Notes/Cosmos dev/test preview surface spec', () => {
  it('exists and defines docs/spec-only scope without implementing a surface', () => {
    expect(existsSync(specPath)).toBe(true);
    const text = readSpec();

    for (const required of [
      'K-226 Notes/Cosmos Dev/Test Preview Surface Spec',
      'K-226 is docs/spec only.',
      'It does not implement a viewing surface',
      'does not implement a viewing surface, route, navigation entry, hidden experimental panel, or normal Notes runtime wiring',
      'creates a gate before any dev/test surface implementation',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('summarizes current state and keeps NotesCosmosStaticPreview unwired and fixture-only', () => {
    const text = readSpec();

    for (const required of [
      '## Current State Summary',
      'K-220 mock fixture contract exists',
      'K-222 isolated component skeleton exists',
      'K-224 polish, mobile, and accessibility hardening is complete.',
      'K-225 decided that a surface decision/spec must come before implementation.',
      '`NotesCosmosStaticPreview` remains unwired',
      'no normal Notes navigation connection exists',
      'no hidden experimental panel exists',
      'no live graph data is used',
      'NoteGraphView and LocalGraphView remain preserved',
      'K-220 fixture-only input remains the only approved input',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents source inspection findings and K-227 implications', () => {
    const text = readSpec();

    for (const required of [
      '## Source Inspection Findings',
      'Route/dev-only route conventions:',
      'Status: not found as a reusable convention.',
      '`AppContent` uses tab state and lazy-loaded workspace views',
      'Route guard or environment gate conventions:',
      'Status: partially present.',
      '`import.meta.env.DEV`',
      'Feature flag conventions:',
      'not as a generic preview-surface system',
      'Test-only component harness convention:',
      'Status: present.',
      'Vitest and `renderToStaticMarkup`',
      'Storybook/story-like convention:',
      'Status: not found.',
      'Browser E2E setup:',
      'no Playwright or Cypress dependency appeared',
      'Manual QA docs:',
      'Production build exclusion/gating conventions:',
      'requires future verification',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('compares all required surface options', () => {
    const text = readSpec();

    for (const required of [
      '### Option A: Keep SSR/Unit Test Harness Only',
      'no real browser/390px viewport proof',
      '### Option B: Isolated Dev-Only Preview Route/Page',
      'enables real 390px viewport proof',
      'route gating must be correct',
      '### Option C: Storybook / Story-Like Isolated Surface',
      'do not use Storybook for K-227',
      '### Option D: Test-Only Internal Harness Component',
      'no user-facing route',
      '### Option E: Hidden Experimental Panel',
      'remains deferred',
      '### Option F: Normal Notes Navigation / NoteView Placement',
      'explicitly forbidden for K-227',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('recommends a safe K-227 path and defines gating requirements', () => {
    const text = readSpec();

    for (const required of [
      '## Recommended Path',
      'Preferred K-227 path: **K-227 Notes/Cosmos Isolated Dev Preview Surface**',
      'not appear in normal Notes navigation',
      'use K-220 fixture only',
      'include a removal/rollback path',
      'clearly label the surface as `Dev/Test Preview`',
      'If route gating cannot be guaranteed',
      'K-227 Notes/Cosmos Real Viewport Test Harness Plan',
      '## Gating Requirements',
      'be inaccessible from normal app navigation',
      'not appear in sidebar/top nav',
      'not appear in production builds',
      'not read user notes',
      'not read stores or persistence',
      'not import graph builders or KnowledgeIndexService',
      'not trigger sync, upload, or background work',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines browser/manual QA and 390px real viewport proof strategy', () => {
    const text = readSpec();

    for (const required of [
      '## Browser / Manual QA Strategy',
      'open the dev/test preview surface',
      'confirm it is not reachable from normal Notes navigation',
      'confirm all 10 nodes render',
      'confirm all 12 relationships render',
      'confirm tone, kind, status, and cluster text render',
      'set viewport to 390px',
      'confirm no horizontal overflow',
      'confirm no clipped primary content',
      'confirm long labels remain readable or wrapped',
      'confirm no canvas/WebGL/interactive graph behavior',
      'confirm no user notes or live graph data appear',
      '## 390px Real Viewport Proof',
      'K-224 currently has component-level/mobile intent coverage.',
      'Real 390px proof requires a browser-visible surface or browser test harness.',
      'K-226 does not provide that surface.',
      'Normal Notes navigation should not be used just to obtain viewport QA.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('preserves existing surfaces and defines security/privacy boundaries', () => {
    const text = readSpec();

    for (const required of [
      '## Relationship To Existing Surfaces',
      'NoteGraphView remains the shipped full-vault graph surface.',
      'LocalGraphView remains the local/context graph surface.',
      'NotesCosmosStaticPreview remains the fixture-driven static preview.',
      'NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.',
      'ProductEmptyState remains the generic/product empty state.',
      'The dev/test preview must not replace any of these.',
      '## Security / Privacy Boundary',
      'live user notes',
      'persisted data',
      'local IndexedDB reads',
      'Supabase reads or writes',
      'Google Drive or attachment reads or writes',
      'background sync or upload',
      'credentials',
      'graph builder reads',
      'KnowledgeIndexService reads',
      'user-facing production claims that Cosmos Map exists',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines K-227 implementation acceptance and recommended next milestones', () => {
    const text = readSpec();

    for (const required of [
      '## Future Implementation Acceptance For K-227',
      'isolated surface only',
      'not in normal Notes navigation',
      'dev/test label visible',
      'K-220 fixture-only input',
      'no live graph data',
      'no NoteGraphView/LocalGraphView replacement',
      'no ProductEmptyState/NotesPixelCosmosEmptyState replacement',
      'no stores/persistence/providers',
      'no new dependencies/assets/fonts',
      'no canvas/WebGL',
      'browser QA at 390px',
      'forbidden import grep',
      'removal/rollback instructions',
      '## Recommended K-227',
      'K-227 Notes/Cosmos Isolated Dev Preview Surface',
      'K-227 Notes/Cosmos Real Viewport Test Harness Plan',
      'K-227 Notes/Cosmos Story/Test Preview Surface',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and closes without normal Notes runtime wiring', () => {
    const text = readSpec();

    for (const required of [
      '## Non-Goals',
      'no runtime implementation in K-226',
      'no dev/test surface implementation in K-226',
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
      'No normal Notes runtime wiring should occur yet.',
      'NoteGraphView and LocalGraphView remain preserved.',
      'NotesCosmosStaticPreview remains fixture-only until an explicitly approved dev/test surface implementation.',
    ]) {
      expect(text).toContain(required);
    }
  });
});
