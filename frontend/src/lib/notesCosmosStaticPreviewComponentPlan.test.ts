import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const planPath = join(process.cwd(), 'docs', 'K-221-notes-cosmos-static-preview-component-plan.md');

function readPlan(): string {
  return readFileSync(planPath, 'utf8');
}

describe('K-221 Notes/Cosmos static preview component plan', () => {
  it('exists and defines docs-only component-plan scope', () => {
    expect(existsSync(planPath)).toBe(true);
    const text = readPlan();

    for (const required of [
      'K-221 Notes/Cosmos Static Preview Component Plan',
      'K-221 is a static preview component plan only.',
      'It is not implementation.',
      'K-221 plans where and how a future read-only/static Notes/Cosmos preview component could render',
      'K-221 does not implement runtime UI.',
      'K-221 does not add component code',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('represents the K-220 fixture contract and authoritative relationship kinds', () => {
    const text = readPlan();

    for (const required of [
      '## Relationship To K-220',
      '`notesCosmosStaticPreviewFixture` is static mock data, not live graph data.',
      '`NotesCosmosPreviewFixture` is the fixture contract',
      'K-220 relationship kinds are authoritative: `related`, `supports`, `contrasts`, `continues`, and `archives`.',
      'K-219 vocabulary examples must not override K-220 contract types.',
      'Relationships are top-level only',
      'Nodes do not include `relationships` or `relationshipIds`.',
      '`positionHint` uses only `ring`, `order`, and `density`.',
      '`validateNotesCosmosPreviewFixture` is a guardrail/helper, not a runtime data validation system.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines static read-only fixture-driven posture and graph preservation', () => {
    const text = readPlan();

    for (const required of [
      '## Component Posture',
      'static',
      'read-only',
      'fixture-driven',
      'fallback-first',
      'non-navigational at first',
      'not be:',
      'an interactive graph',
      'a canvas implementation',
      'a replacement for `NoteGraphView`',
      'a replacement for `LocalGraphView`',
      'a replacement for Notes empty states',
      'a route or navigation change in K-221',
      'a runtime Cosmos Map implementation',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents IA placement options and recommends isolated/dev/test-only placement', () => {
    const text = readPlan();

    for (const required of [
      '## IA Placement Options',
      '### Option A: Docs/dev-only preview page',
      '### Option B: Hidden experimental panel',
      '### Option C: Story/test-only component surface',
      '### Option D: Future Notes empty-state adjacent preview',
      '### Option E: Inside existing graph view',
      '### Recommended Placement',
      'use a docs/dev/test-only or isolated preview surface first',
      'Do not place the preview inside `NoteGraphView` or `LocalGraphView` yet.',
      'Do not attach it to normal Notes navigation yet.',
      'The first runtime component, if approved later, should be isolated and fixture-driven.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines rendering model and fallback-first requirements', () => {
    const text = readPlan();

    for (const required of [
      '## Rendering Model',
      'fixture title and description',
      'nodes as static labeled items',
      'relationships as static labeled links or list rows',
      'cluster grouping',
      'optional non-persistent visual arrangement using `positionHint`',
      'fallback list/text representation',
      'no canvas requirement',
      'no WebGL requirement',
      'no force-directed simulation',
      'no live layout engine',
      'no runtime graph mutation',
      'no persisted coordinates',
      '## Fallback-First Requirement',
      'every node visible in fallback',
      'every relationship visible in fallback',
      'deterministic node order',
      'deterministic relationship order',
      'keyboard-readable structure',
      'screen-reader-friendly labels',
      'no visual-only critical information',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines mobile, performance, accessibility, future testing, non-goals, and K-222 recommendation', () => {
    const text = readPlan();

    for (const required of [
      '## Mobile And Responsive Acceptance',
      '390px width acceptance',
      'no horizontal overflow',
      'no clipped primary content',
      'readable labels',
      'fallback list usable on mobile',
      'no reliance on hover-only controls',
      'preview must not break Notes editor/list',
      '## Performance Budget',
      '10 nodes expected',
      '12 relationships expected',
      'must remain within the K-219 8 to 16 node budget',
      'no large vault simulation',
      'no heavy dependency',
      'no canvas/WebGL in the first component plan',
      'no impact to normal Notes editor/list load',
      'lazy/isolated',
      '## Accessibility Requirements',
      'keyboard/focus plan',
      'semantic headings and labels',
      'text alternatives for visual grouping',
      'reduced motion by default or no animation initially',
      'color not sole carrier of meaning',
      'literal labels for node kind',
      'reading/writing remains primary',
      '## Future Testing Plan',
      'fixture import smoke',
      'renders fixture title and description',
      'renders all nodes',
      'renders all relationships',
      'fallback text coverage',
      'mobile 390px no-overflow check',
      'no runtime service imports',
      'no graph builder imports',
      'no `KnowledgeIndexService` imports',
      'no `x`, `y`, or coordinate fields',
      'no mutation of fixture data',
      '## Non-Goals',
      'no runtime implementation in K-221',
      'no component code in K-221',
      'no route/navigation change',
      'no replacement of `NoteGraphView`',
      'no replacement of `LocalGraphView`',
      'no live graph data',
      'no schema changes',
      'no store changes',
      'no provider changes',
      'no persistence changes',
      '## Next Milestone',
      'Recommended next target: **K-222 Notes/Cosmos Static Preview Component Skeleton**.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('does not claim runtime, credential, upload, or sync implementation behavior', () => {
    const text = readPlan();

    for (const forbidden of [
      'K-221 implements',
      'runtime Cosmos Map is implemented',
      'new graph engine is implemented',
      'up' + 'load queue execution',
      'Upload ' + 'all',
      'Run ' + 'queue',
      'sy' + 'nc now',
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
