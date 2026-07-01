import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const specPath = join(process.cwd(), 'docs', 'K-219-notes-cosmos-static-preview-fixture-spec.md');

function readSpec(): string {
  return readFileSync(specPath, 'utf8');
}

describe('K-219 Notes/Cosmos static preview fixture spec', () => {
  it('exists and defines docs-only fixture-spec scope', () => {
    expect(existsSync(specPath)).toBe(true);
    const text = readSpec();

    for (const required of [
      'K-219 Notes/Cosmos Static Preview Fixture Spec',
      'K-219 defines the static preview fixture specification',
      'It is not a runtime implementation.',
      'K-219 is docs/fixture-spec only.',
      'K-219 does not change runtime UI.',
      'K-219 does not modify NoteView, NoteGraphView, NoteGraphViewLazy, LocalGraphView',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('represents the K-218 relationship and preserves current graph surfaces', () => {
    const text = readSpec();

    for (const required of [
      '## Relationship To K-218',
      'K-218 recommended fixture-first planning',
      'K-219 chooses that fixture posture:',
      'preserve existing `NoteGraphView`',
      'preserve existing `LocalGraphView`',
      'keep Cosmos Map unimplemented',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('selects Option A mock/static fixture-first posture and defers live graph data', () => {
    const text = readSpec();

    for (const required of [
      '## Fixture Source Decision',
      '### Selected Posture: Option A Mock/Static Fixture Data First',
      'K-219 selects **Option A: mock/static fixture data first**.',
      'lowest ownership risk',
      'avoids coupling to `KnowledgeIndexService`',
      'avoids coupling to graph data builders',
      'avoids live graph performance risk',
      'avoids implying Cosmos Map uses persisted spatial metadata',
      'Option B, read-only current graph data, is deferred.',
      'Option C, hybrid-derived fixture data, may be revisited later.',
      'no live graph mutation',
      'no writes',
      'no schema migration',
      'no store migration',
      'no persistence migration',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines fixture shape fields and non-persistent layout hints', () => {
    const text = readSpec();

    for (const required of [
      '## Fixture Shape',
      'NotesCosmosStaticPreviewFixture',
      'id: string;',
      'title: string;',
      'description: string;',
      'nodes: NotesCosmosPreviewNode[];',
      'relationships: NotesCosmosPreviewRelationship[];',
      'clusters: NotesCosmosPreviewCluster[];',
      'fallback: NotesCosmosPreviewFallback;',
      'label: string;',
      'kind: NotesCosmosPreviewNodeKind;',
      'summary: string;',
      'tone:',
      'status:',
      'clusterId: string;',
      'clusterLabel: string;',
      'createdAtLabel: string;',
      'updatedAtLabel: string;',
      'positionHint?: NotesCosmosFixturePositionHint;',
      '`positionHint` is fixture-only and non-persistent.',
      'This spec does not create TypeScript runtime types.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines node kinds and relationship fixture fields', () => {
    const text = readSpec();

    for (const required of [
      '## Node Kinds',
      '`note`',
      '`cluster`',
      '`anchor`',
      '`signal`',
      '`archiveTrace`',
      'These are fixture labels, not existing runtime object types',
      '## Relationship Fixture',
      'sourceId: string;',
      'targetId: string;',
      'strength:',
      "kind: 'link' | 'theme' | 'sequence' | 'reference' | 'trace';",
      'relationships are fixture-only',
      'relationships do not rewrite current graph data builders',
      'relationships do not require new indexes',
      'relationships do not require `KnowledgeIndexService` changes',
      'Every relationship must have a readable `label`.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines fixture size budget and accessibility fallback text', () => {
    const text = readSpec();

    for (const required of [
      '## Fixture Size Budget',
      'minimum 8 nodes',
      'maximum 16 nodes',
      'prefer 3 or fewer clusters',
      'prefer 10 to 24 relationships',
      'no large vault simulation',
      'future implementation must measure render cost',
      '## Accessibility Fallback Text',
      'title',
      'short description',
      'text/list representation of every node',
      'text/list representation of every relationship',
      'keyboard-readable order',
      'literal labels',
      'readable dates',
      'readable actions',
      'readable statuses',
      'NotesCosmosPreviewFallback',
      'No critical information may be visual-only.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines mobile acceptance, visual constraints, empty-state relationship, non-goals, and K-220 recommendation', () => {
    const text = readSpec();

    for (const required of [
      '## Mobile And Responsive Acceptance',
      'works at 390px width',
      'no horizontal overflow',
      'readable labels',
      'no clipped primary content',
      'list fallback remains usable',
      'touch targets are considered',
      'preview must not break the Notes editor/list',
      '## Visual Vocabulary Constraints',
      'nodes',
      'clusters',
      'orbit vocabulary',
      'trace vocabulary',
      'no hidden meaning by color alone',
      'no animation requirement',
      'no WebGL dependency in K-219',
      'no canvas dependency in K-219',
      'no generated images',
      'no assets',
      'no fonts',
      'no full navigation metaphor yet',
      '## Relationship To Empty States',
      'K-212 `NotesPixelCosmosEmptyState` remains the empty-vault pilot.',
      '`ProductEmptyState` remains the generic/product empty-state component',
      'The select-a-note empty state remains separate',
      'K-219 fixture work does not replace:',
      '## Non-Goals',
      'no runtime implementation in K-219',
      'no static preview component yet',
      'no interactive graph/canvas/orbit map',
      'no replacement of `NoteGraphView`',
      'no replacement of `LocalGraphView`',
      'no store changes',
      'no schema changes',
      'no provider changes',
      'no persistence changes',
      'no saved coordinates',
      'no spatial metadata',
      'no OAuth, Supabase, attachment, or Google Drive behavior',
      '## Next Milestone',
      'Recommended next target: **K-220 Notes/Cosmos Static Preview Mock Contract**.',
      'keep fixture size within 8 to 16 nodes',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('does not claim runtime, credential, upload, or sync implementation behavior', () => {
    const text = readSpec();

    for (const forbidden of [
      'K-219 implements',
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
