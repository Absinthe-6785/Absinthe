import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const specPath = join(process.cwd(), 'docs', 'K-217-notegraphview-cosmos-relationship-decision-spec.md');

function readSpec(): string {
  return readFileSync(specPath, 'utf8');
}

describe('K-217 NoteGraphView/Cosmos relationship decision spec', () => {
  it('exists and defines docs-only decision-spec scope', () => {
    expect(existsSync(specPath)).toBe(true);
    const text = readSpec();

    for (const required of [
      'K-217 NoteGraphView/Cosmos Relationship Decision Spec',
      'K-217 is a relationship decision spec.',
      'K-217 is docs/spec only.',
      'K-217 does not implement Cosmos Map.',
      'K-217 does not change runtime UI.',
      'prevent the future Cosmos Map concept from accidentally duplicating, replacing, or confusing the existing shipped graph surfaces',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('represents current shipped graph surfaces and K-212 empty-state difference', () => {
    const text = readSpec();

    for (const required of [
      '## Current Shipped Graph Surfaces',
      '### NoteGraphView',
      '`NoteGraphView` is the current shipped full-vault graph surface for Notes.',
      '### NoteGraphViewLazy',
      '`NoteGraphViewLazy` is the current lazy-load boundary for the full-vault graph surface.',
      '### LocalGraphView',
      '`LocalGraphView` is the current local/context graph surface.',
      '### Graph Data Builders',
      '`buildGlobalGraphData`',
      '`buildExpandedGraphData`',
      '### KnowledgeIndexService',
      '`KnowledgeIndexService` is the current knowledge/relationship indexing source',
      '### Current Graph Tests',
      '### K-212 NotesPixelCosmosEmptyState Difference',
      '`NotesPixelCosmosEmptyState` is the current empty-vault pixel-cosmos identity surface.',
      'It is not a graph, canvas, node map, or relationship navigation surface.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines the decision question and all relationship options', () => {
    const text = readSpec();

    for (const required of [
      '## Decision Question',
      'What is the future relationship between the current shipped Notes graph surfaces and a future Cosmos Map?',
      '## Relationship Options',
      '### Option A: Keep NoteGraphView and future Cosmos Map separate',
      '### Option B: Cosmos Map composes or wraps current graph infrastructure',
      '### Option C: Cosmos Map becomes the future evolution of NoteGraphView',
      '### Option D: Cosmos Map is deferred',
      '### Option E: Replace NoteGraphView with Cosmos Map',
      'This is not recommended unless a future migration spec proves safety.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('records the recommended decision not to replace current graph surfaces now', () => {
    const text = readSpec();

    for (const required of [
      '## Recommended Decision',
      'Do not replace `NoteGraphView` now.',
      'future Cosmos Map should be treated as separate or composable',
      '`NoteGraphView` remains current shipped full-vault graph surface.',
      '`LocalGraphView` remains separate local/context graph surface.',
      'Cosmos Map is not implemented.',
      'Cosmos Map must not replace either surface without future migration decision.',
      'Future Cosmos preview must be read-only/static first and must not change graph data, persistence, or navigation semantics.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines LocalGraphView, data, and IA boundaries', () => {
    const text = readSpec();

    for (const required of [
      '## LocalGraphView Boundary',
      '`NoteGraphView`:',
      'full-vault/global',
      '`LocalGraphView`:',
      'local/contextual',
      'Cosmos Map must not collapse both into an unclear surface.',
      '## Data Boundary',
      'Current graph data sources include local Notes data',
      'Conceptually reusable:',
      'Must not be assumed:',
      'persisted spatial metadata',
      'saved node coordinates',
      'orbit state',
      'AI cluster data',
      'K-217 adds no coordinates, orbits, layout state, schema fields, store fields, provider behavior, persistence migration',
      'Local-first Notes remain the source of truth.',
      '## IA Boundary',
      'list/search/filter supports fast retrieval',
      'editor/detail supports writing and reading',
      'Future Cosmos Map could sit as:',
      'Writing and reading remain primary.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines accessibility, non-goals, and K-218 recommendation', () => {
    const text = readSpec();

    for (const required of [
      '## Accessibility And Readability',
      'provide a text/list equivalent for nodes, relationships, and important status',
      'support keyboard navigation and visible focus',
      'avoid visual-only critical information',
      'avoid gesture-only critical paths',
      'support reduced motion',
      'preserve mobile and tablet fallbacks',
      'use literal-first titles, dates, actions, and statuses before metaphor',
      '## Non-Goals',
      'no runtime implementation in K-217',
      'no static preview implementation in K-217',
      'no interactive graph/canvas implementation',
      'no replacement of `NoteGraphView`',
      'no replacement of `LocalGraphView`',
      'no store changes',
      'no schema changes',
      'no provider changes',
      'no persistence changes',
      'no OAuth, Supabase, attachment, or Google Drive changes',
      '## Next Milestone',
      'Recommended next target: **K-218 Notes/Cosmos Static Preview Plan**.',
      'K-218 should be docs/plan only or a static preview spec first.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('does not claim runtime, credential, upload, or sync implementation behavior', () => {
    const text = readSpec();

    for (const forbidden of [
      'K-217 implements',
      'runtime Cosmos Map is implemented',
      'new graph engine is implemented',
      'upload queue execution',
      'Upload ' + 'all',
      'Run ' + 'queue',
      'sync ' + 'now',
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE ' + 'KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'access_' + 'token=',
      'refresh_' + 'token=',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
