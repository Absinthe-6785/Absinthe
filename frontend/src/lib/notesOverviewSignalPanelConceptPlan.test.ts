import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-278-notes-overview-signal-panel-concept-plan.md');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-278 notes overview signal panel concept plan', () => {
  it('exists and defines docs/plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-278 Notes Overview / Signal Panel Concept Plan',
      'K-278 defines a concept plan for a future Notes Overview / Signal Panel.',
      'K-278 follows closure of the Notes Empty State Pixel-Cosmos polish line',
      'K-278 is docs/plan plus audit test only.',
      'K-278 does not implement runtime UI.',
      'K-278 does not add route/nav/panel behavior.',
      'K-278 does not implement Runtime Cosmos Map.',
      'K-278 does not replace graph surfaces.',
      'K-278 does not modify `NotesCosmosStaticPreview`.',
      'K-278 chooses the K-279 next path: Notes Overview / Signal Panel Data Boundary Audit.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-277', () => {
    const doc = readDoc();

    for (const required of [
      'K-265 through K-269 closed the Notes Empty State Pixel-Cosmos polish line.',
      '`NotesPixelCosmosEmptyState` is the productized empty-vault Notes/Cosmos surface',
      'K-270 through K-277 closed the isolated Static Preview visual grammar/accessibility/viewport proof line.',
      '`NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, and unwired.',
      'Static Preview lessons are available as visual/product grammar, not runtime product behavior.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'Existing graph surfaces are not replaced.',
      'Backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines the product problem and Signal Panel concept', () => {
    const doc = readDoc();

    for (const required of [
      '## Product Problem Definition',
      'Users need a lightweight way to understand the current state of their note space without entering a graph.',
      'They need orientation, not a full Cosmos Map.',
      'what is currently active?',
      'what did I recently touch?',
      'what may be worth continuing?',
      'Signal Panel is an orientation surface.',
      'Signal Panel is not a graph replacement.',
      'Signal Panel is not a Cosmos Map.',
      'Signal Panel is not backup/Data Safety UI.',
      'Signal Panel is not Archive Voyager.',
      '## Concept Definition',
      'Notes Overview / Signal Panel is a future Notes product surface',
      'recent notes.',
      'active writing signals.',
      'resurfacing records.',
      'isolated or neglected notes.',
      'lightweight clusters or themes.',
      'local/contextual relationships.',
      'empty or low-activity states.',
      'attachment/reference traces only if separately scoped.',
      'It should not require live graph implementation yet.',
      'It should not require new persistence/schema.',
      'It should not require remote/provider data.',
      'It should not claim global graph intelligence before source audit.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('translates lessons from Static Preview', () => {
    const doc = readDoc();

    for (const required of [
      '## Lessons From Static Preview',
      'signal hierarchy should be primary/secondary/faint.',
      'hierarchy should be text/structure based, not color-only.',
      'visual grammar must clarify meaning.',
      'fallback/accessibility must not be visual-only.',
      '390px/narrow viewport proof matters before runtime exposure.',
      'generated artifacts must not be committed.',
      'isolated preview evidence does not imply runtime readiness.',
      'fixture-driven concepts must not be mistaken for live data.',
      'plain, semantic, readable, and data-audited',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('separates Signal Panel from existing surfaces', () => {
    const doc = readDoc();

    for (const required of [
      '## Relationship To Existing Surfaces',
      '### Empty State',
      'Empty State handles empty vault / first-note onboarding.',
      'Signal Panel should not duplicate empty-state CTA behavior.',
      'If no notes exist, Empty State remains primary.',
      '### Static Preview',
      'Static Preview remains an isolated concept artifact.',
      'Signal Panel may borrow grammar lessons but not component/runtime code directly.',
      'Static Preview fixture is not product data.',
      '### NoteGraphView',
      '`NoteGraphView` remains the full-vault graph.',
      'Signal Panel must not replace it.',
      '### LocalGraphView',
      '`LocalGraphView` remains the local/context graph.',
      'Signal Panel must not replace it.',
      '### Cosmos Map',
      'Runtime Cosmos Map remains unimplemented.',
      'Signal Panel is not Cosmos Map.',
      '### Home Signal Board',
      'Home Signal Board is broader cross-surface orientation.',
      'Notes Overview / Signal Panel is Notes-scoped.',
      '### Archive Voyager',
      'Archive handles time-distance / old record resurfacing.',
      'Signal Panel may mention resurfacing, but should not become Archive Voyager.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares candidate signal categories', () => {
    const doc = readDoc();

    for (const required of [
      '## Candidate Signal Categories',
      '### Candidate 1: Recent Notes',
      'low conceptual complexity',
      'Product value: quick re-entry.',
      '### Candidate 2: Active Writing / Current Note Signals',
      'useful for orientation',
      'requires careful runtime boundary',
      '### Candidate 3: Resurfacing Notes',
      'strong Cosmos/Signal concept',
      'may overlap Archive',
      '### Candidate 4: Neglected Or Isolated Notes',
      'may require relationship/index data',
      'overclaiming without graph or `KnowledgeIndexService` audit',
      '### Candidate 5: Lightweight Clusters / Themes',
      'high graph/index coupling risk',
      '### Candidate 6: Attachment / Reference Traces',
      'should be deferred unless attachment boundaries are audited',
      'Avoid backup/provider implications.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists data boundary and runtime placement questions', () => {
    const doc = readDoc();

    for (const required of [
      '## Data Boundary Questions',
      'What local source of truth can be read safely?',
      'Which note metadata is already available in the current Notes runtime?',
      'Are recent notes already computed or must they be queried?',
      'Are active note and editor state safe to summarize without coupling to editor internals?',
      'Are relationships available without rebuilding graph/runtime index?',
      'Does any candidate require `KnowledgeIndexService`?',
      'Does any candidate require graph builders?',
      'Does any candidate require persisted coordinates/spatial metadata?',
      'Does any candidate require provider/network data?',
      'Does any candidate touch backup/export/import?',
      'How does this work offline/local-first?',
      'What is safe for empty, small, and large vaults?',
      'K-278 does not approve using any of it; it only identifies the boundary K-279 must audit.',
      '## Runtime Placement Questions',
      'Where could a future Signal Panel appear?',
      'Is it inside Notes overview area, editor-adjacent, or separate dev/test surface?',
      'Would it appear only when notes exist?',
      'How does it coexist with Empty State?',
      'How does it avoid route/nav/panel changes at first?',
      'Can first implementation be component-isolated before mounting?',
      'What browser/390px QA would be required before runtime exposure?',
      'K-278 does not answer by implementing.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines product grammar criteria and initial future scope', () => {
    const doc = readDoc();

    for (const required of [
      '## Product Grammar Criteria',
      'signal hierarchy: primary/secondary/faint.',
      'information-first layout.',
      'readable typography.',
      'native accessibility and semantic grouping.',
      'pixel is grammar, not decoration.',
      'cozy sci-fi / pixel observatory / personal archive tone.',
      'signal/readout language should clarify state.',
      'avoid overdecorated cosmic UI.',
      'avoid generic AI SaaS look.',
      'do not hide writing actions behind spectacle.',
      'panel should help users return to notes.',
      '## Initial Scope Recommendation',
      '**Recent notes + active writing signal readout only.**',
      'likely simpler than clusters/resurfacing/isolated-note intelligence.',
      'product-visible orientation.',
      'does not require graph replacement.',
      'may be auditable from local note metadata.',
      'clusters/themes.',
      'neglected/isolated relationship intelligence.',
      'Runtime Cosmos Map.',
      'Archive-style time-distance resurfacing.',
      'attachment/reference traces.',
      'provider/remote signals.',
      'backup/Data Safety claims.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends the K-279 path and lists non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## K-279 Decision',
      '**K-279 Notes Overview / Signal Panel Data Boundary Audit**',
      'docs/audit plus audit test only.',
      'inspect current Notes local data sources and runtime surfaces.',
      'determine whether recent notes + active writing signal readout can be implemented without graph/store/schema/provider changes.',
      'no UI implementation.',
      '**K-279 Notes Overview / Signal Panel Component Boundary Plan**',
      '**K-279 Notes Overview / Signal Panel Concept Closure Audit**',
      'immediate runtime implementation.',
      'route/nav/panel.',
      'Runtime Cosmos Map.',
      'graph replacement.',
      'live graph intelligence.',
      'backup/Data Safety UI.',
      '## Non-goals',
      'no runtime UI implementation in K-278.',
      'no Notes Overview component.',
      'no Signal Panel component.',
      'no route/nav/panel change.',
      'no NotesCosmosStaticPreview changes.',
      'no NotesCosmosStaticPreview mounting.',
      'no Runtime Cosmos Map implementation.',
      'no graph replacement.',
      'no NoteGraphView change.',
      'no LocalGraphView change.',
      'no graph builder change.',
      'no KnowledgeIndexService coupling.',
      'no live Notes data integration.',
      'no Notes store changes.',
      'no persistence/schema change.',
      'no coordinates/orbits/spatial metadata persistence.',
      'no provider/network/background sync.',
      'no backup/preflight runtime implementation.',
      'no Data Safety / Backup Health UI.',
      'no export/import/restore behavior change.',
      'no attachment blob/provider behavior.',
      'no Supabase/OAuth/Google Drive behavior change.',
      'no Health/Schedule behavior change.',
      'no assets/fonts/dependencies.',
      'no generated artifacts.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('closes with concept-only boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Closure Statement',
      'K-278 defines Notes Overview / Signal Panel as a concept, not implementation.',
      'Static Preview lessons may inform signal hierarchy, but isolated preview does not become runtime surface.',
      'Signal Panel is an orientation/readout surface, not Cosmos Map or graph replacement.',
      'The first future scope should be recent notes + active writing signal readout, pending K-279 data boundary audit.',
      'Existing graph surfaces remain preserved.',
      'Runtime Cosmos Map and graph replacement remain rejected.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
