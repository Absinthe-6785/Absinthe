import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const decisionPath = join(
  process.cwd(),
  'docs',
  'K-225-notes-cosmos-static-preview-dev-test-surface-decision.md',
);

function readDecision(): string {
  return readFileSync(decisionPath, 'utf8');
}

describe('K-225 Notes/Cosmos static preview dev/test surface decision', () => {
  it('exists and defines docs/decision-only scope without implementing a surface', () => {
    expect(existsSync(decisionPath)).toBe(true);
    const text = readDecision();

    for (const required of [
      'K-225 Notes/Cosmos Static Preview Dev/Test Surface Decision',
      'K-225 is docs/decision only.',
      'It does not implement any viewing surface',
      'does not implement any viewing surface, route, navigation entry, hidden experimental panel, or runtime Notes integration',
      'creates a decision gate before any dev/test surface implementation',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('summarizes current K-220, K-222, and K-224 state and preserves graph boundaries', () => {
    const text = readDecision();

    for (const required of [
      '## Current State Summary',
      'K-220 created the static mock fixture contract',
      'K-222 added the isolated `NotesCosmosStaticPreview` component skeleton',
      'K-224 completed polish, mobile, and accessibility hardening',
      'component remains fixture-only',
      'component remains unwired',
      'no runtime Notes surface imports it',
      'NoteGraphView and LocalGraphView remain preserved',
      'no live graph data is read',
      'no KnowledgeIndexService or graph builder coupling exists',
      'no `x`, `y`, coordinates, saved layout, or persisted spatial metadata exists',
      'no canvas/SVG/WebGL graph engine exists',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents source-verified repo conventions and missing surface conventions', () => {
    const text = readDecision();

    for (const required of [
      '## Source-Verified Repo Conventions',
      'Vitest exists',
      'SSR component rendering',
      'docs plus focused audit tests',
      '`AppContent` uses tab state and lazy-loaded workspace views',
      'no reusable dev-only preview route convention was found',
      'Storybook dependency or `.stories.*` convention',
      'Cypress setup',
      'Playwright setup',
      'existing isolated component preview route convention',
      'safe generic docs/dev-only preview page convention',
      'Requires future verification',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines decision criteria for a safe viewing surface', () => {
    const text = readDecision();

    for (const required of [
      '## Decision Criteria',
      'Be isolated from normal Notes navigation.',
      'Not replace NoteGraphView or LocalGraphView.',
      'Not replace NotesPixelCosmosEmptyState or ProductEmptyState.',
      'Use only K-220 fixture input.',
      'Not read runtime stores or persistence.',
      'Not import KnowledgeIndexService or graph builders.',
      'Allow browser/manual QA, including a 390px viewport.',
      'Support fallback-first rendering verification.',
      'Be easy to remove.',
      'Not ship as a user-facing default accidentally.',
      'Not require assets, fonts, or dependencies.',
      'Not imply Cosmos Map runtime is complete.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('compares candidate surface options and defers risky runtime placements', () => {
    const text = readDecision();

    for (const required of [
      '### Option A: Test-Only Component Rendering',
      'safest for isolation',
      'does not prove real viewport overflow',
      '### Option B: Docs/Dev-Only Preview Page',
      'enables browser/manual QA',
      'can test real 390px viewport behavior',
      'acceptable only after K-226 defines exact gate',
      '### Option C: Storybook / Story-Like Isolated Surface',
      'Storybook and `.stories.*` conventions were not found',
      'do not add Storybook in K-225',
      '### Option D: Hidden Experimental Panel',
      'hidden experimental panel remains deferred',
      'not the default next step',
      '### Option E: Notes Empty-State Adjacent Preview',
      'defer until component placement is decided separately',
      '### Option F: Inside NoteGraphView / LocalGraphView',
      'not acceptable for the next step',
      'NoteGraphView and LocalGraphView placement remains off-limits',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('recommends isolated docs/dev/test-only surface first through a K-226 spec gate', () => {
    const text = readDecision();

    for (const required of [
      '## Recommended Decision',
      'recommends an isolated docs/dev/test-only surface first',
      'only after a K-226 spec defines the exact safe convention',
      'Do not use normal Notes navigation.',
      'Do not use NoteGraphView or LocalGraphView.',
      'Do not use a hidden experimental panel as the default path.',
      'no existing safe dev-only route or Storybook convention was found',
      'K-226 should first define the minimal safe convention before implementation',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines 390px real viewport and tone/fallback parity strategy', () => {
    const text = readDecision();

    for (const required of [
      '## 390px / Real Viewport Strategy',
      'K-224 has SSR/narrow-wrapper-level mobile coverage.',
      'Real browser 390px proof requires either a viewable surface or a browser test harness.',
      'K-225 does not add that surface.',
      'without using the normal Notes route',
      '390px width',
      'no horizontal overflow',
      'all nodes and relationships readable or fallback-accessible',
      'browser manual QA steps once a safe surface exists',
      '## Tone / Fallback Parity Strategy',
      'K-224 renders tone on node cards as literal text.',
      'K-226 or K-227 should decide whether tone should also appear in fallback summaries for parity.',
      'must not become color-only',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents K-223 supersession policy, runtime boundaries, future guardrails, and K-226 target', () => {
    const text = readDecision();

    for (const required of [
      '## K-223 Audit Staleness / Supersession Policy',
      'K-223 remains a historical audit of the K-222 skeleton.',
      'K-224 supersedes some K-223 findings',
      'K-225 does not rewrite K-223.',
      '## Runtime Boundary',
      'no NoteView wiring yet',
      'no route/navigation yet',
      'no graph view replacement',
      'no hidden experimental panel yet',
      'no live graph data',
      'no KnowledgeIndexService',
      'no graph builders',
      'no stores/persistence/providers',
      'no Supabase or attachment behavior',
      'no assets/fonts/dependencies',
      '## Future Implementation Guardrails',
      'remain isolated',
      'be gated or test-only',
      'not appear in normal user navigation',
      'use K-220 fixture only',
      'include browser/manual QA steps',
      'include 390px viewport checks',
      '## Recommended K-226',
      'Recommended next target: **K-226 Notes/Cosmos Dev/Test Preview Surface Spec**.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and blocks normal Notes runtime wiring until QA is proven', () => {
    const text = readDecision();

    for (const required of [
      '## Non-Goals',
      'no runtime implementation in K-225',
      'no dev/test surface implementation in K-225',
      'no route/navigation wiring',
      'no hidden experimental panel',
      'no NoteView changes',
      'no NoteGraphView changes',
      'no LocalGraphView changes',
      'no ProductEmptyState changes',
      'no NotesPixelCosmosEmptyState changes',
      'no graph/canvas/orbit map',
      'no live graph data',
      'no KnowledgeIndexService or graph builder coupling',
      'no stores/schemas/providers/persistence changes',
      'no editor changes',
      'no OAuth/Supabase/attachment behavior',
      'no Health/Schedule behavior',
      'no assets/fonts/dependencies',
      'No normal Notes runtime wiring should occur until dev/test viewing and 390px browser QA are proven.',
      'NoteGraphView and LocalGraphView remain preserved.',
    ]) {
      expect(text).toContain(required);
    }
  });
});
