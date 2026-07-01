import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const planPath = join(process.cwd(), 'docs', 'K-218-notes-cosmos-static-preview-plan.md');

function readPlan(): string {
  return readFileSync(planPath, 'utf8');
}

describe('K-218 Notes/Cosmos static preview plan', () => {
  it('exists and defines docs-only static-preview planning scope', () => {
    expect(existsSync(planPath)).toBe(true);
    const text = readPlan();

    for (const required of [
      'K-218 Notes/Cosmos Static Preview Plan',
      'K-218 is a static preview plan for a future Notes/Cosmos surface.',
      'It is not a runtime implementation.',
      'K-218 is docs/plan only.',
      'K-218 does not change runtime UI.',
      'K-218 does not modify NoteView, NoteGraphView, NoteGraphViewLazy, LocalGraphView',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('represents the K-217 relationship decision and preserves current graph surfaces', () => {
    const text = readPlan();

    for (const required of [
      '## Relationship To K-217',
      '`NoteGraphView` remains preserved as the shipped full-vault graph surface.',
      '`LocalGraphView` remains preserved as the local/context graph surface.',
      'Cosmos Map is not implemented.',
      'Cosmos Map must not replace either graph surface without a future migration decision.',
      'K-218 does not replace, modify, wrap, fork, or re-route existing graph surfaces.',
      '`NoteGraphView` remains the current graph owner for full-vault graph exploration.',
      '`LocalGraphView` remains the current graph owner for selected-note context graph exploration.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines static/read-only preview posture and data source options', () => {
    const text = readPlan();

    for (const required of [
      '## Preview Posture',
      'The first Cosmos preview should be static or read-only.',
      'not as a new Notes navigation system',
      '## Data Source Decision',
      '### Option A: Mock/static fixture data',
      '### Option B: Read-only current graph data',
      '### Option C: Hybrid fixture derived from current graph shape',
      '### Option D: Defer preview until additional audit',
      '### Recommended Data Source Path',
      'Start with mock/static fixture data or a static fixture derived from current graph concepts.',
      'Do not start with live graph mutation.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines read-only data boundaries and ephemeral versus persisted layout distinction', () => {
    const text = readPlan();

    for (const required of [
      'Hard data boundaries:',
      'no writes',
      'no store migration',
      'no schema migration',
      'no persisted spatial metadata',
      'no saved coordinates',
      'no saved orbit state',
      'no new sync behavior',
      'no dependency on Google Drive, Supabase, OAuth, or attachments',
      'Local-first Notes remain the source of truth.',
      '## Ephemeral Vs Persisted Layout',
      'Allowed:',
      'ephemeral layout concepts in docs',
      'Not allowed:',
      'persisted coordinates',
      'remote layout state',
      '`LocalGraphView` may compute ephemeral layout positions at runtime today',
      'K-218 does not convert that behavior into stored Cosmos metadata.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines IA placement and empty-state relationship', () => {
    const text = readPlan();

    for (const required of [
      '## IA Placement',
      'separate preview surface',
      'docs-only mock',
      'behind a dev or experimental route in a later approved milestone',
      'replace `NoteGraphView`',
      'replace `LocalGraphView`',
      'replace writing or reading flow',
      'The strongest initial placement is a separate static preview plan or fixture spec',
      '## Empty-State Relationship',
      'K-212 `NotesPixelCosmosEmptyState` remains the empty-vault pixel-cosmos identity surface.',
      '`ProductEmptyState` is for literal no-results, no-notes, trash, and select-note states.',
      'The select-a-note empty state should remain action-oriented',
      'Loading fallback behavior should remain explicit and literal.',
      'replace the K-212 empty-state pilot',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines visual/content boundaries and accessibility/readability requirements', () => {
    const text = readPlan();

    for (const required of [
      '## Visual And Content Boundaries',
      'note nodes',
      'clusters',
      'orbit or trace vocabulary',
      'readable note labels and titles',
      'dates',
      'statuses',
      'relationship hints',
      'hide note titles',
      'make critical meaning visual-only',
      'imply real spatial metadata',
      'imply live sync',
      '## Accessibility And Readability Requirements',
      'text/list fallback for nodes and relationships',
      'keyboard and focus plan',
      'no visual-only critical information',
      'no gesture-only critical path',
      'reduced-motion path',
      'mobile 390px constraint',
      'no horizontal overflow',
      'readable labels',
      'literal-first actions and statuses',
      'Notes reading and writing remains primary',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines performance budget, non-goals, and K-219 recommendation', () => {
    const text = readPlan();

    for (const required of [
      '## Performance Budget',
      'start with a small fixture size',
      'define a clear node count budget before implementation',
      'prefer approximately 8 to 16 nodes for the first static fixture',
      'avoid heavy canvas or WebGL dependency in the plan',
      'add no new dependency in K-218',
      'future implementation must measure render cost',
      'must not slow normal Notes editor/list usage',
      'preserve the current `NoteGraphViewLazy` lazy-loading boundary',
      '## Non-Goals',
      'no runtime implementation in K-218',
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
      'no assets',
      'no fonts',
      'no dependencies',
      '## Next Milestone',
      'Recommended next target: **K-219 Notes/Cosmos Static Preview Fixture Spec**.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('does not claim runtime, credential, upload, or sync implementation behavior', () => {
    const text = readPlan();

    for (const forbidden of [
      'K-218 implements',
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
