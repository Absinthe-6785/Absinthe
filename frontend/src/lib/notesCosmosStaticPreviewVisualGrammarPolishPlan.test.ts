import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-271-notes-cosmos-static-preview-visual-grammar-polish-plan.md',
);
const previewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const fixturePath = join(process.cwd(), 'src', 'lib', 'notesCosmosStaticPreviewMockContract.ts');
const noteGraphPath = join(process.cwd(), 'src', 'components', 'views', 'NoteGraphView.tsx');
const localGraphPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'features',
  'knowledge',
  'graph',
  'LocalGraphView.tsx',
);

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-271 notes cosmos static preview visual grammar polish plan', () => {
  it('exists and defines docs/plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-271 Notes/Cosmos Static Preview Visual Grammar Polish Plan',
      'K-271 plans the next isolated Notes/Cosmos Static Preview visual grammar polish.',
      'K-271 is docs/plan plus audit test only.',
      'K-271 does not implement UI.',
      'K-271 does not implement Static Preview changes.',
      'K-271 does not modify `NotesCosmosStaticPreview`.',
      'K-271 does not wire Static Preview into runtime.',
      'K-271 does not change route/nav/panel behavior.',
      'K-271 does not mount `NotesCosmosStaticPreview`.',
      'K-271 does not implement Runtime Cosmos Map.',
      'K-271 does not replace graph surfaces.',
      'K-271 chooses the K-272 next path.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-270 and K-269', () => {
    const doc = readDoc();

    for (const required of [
      'K-270 selected Static Preview continuation as the isolated visual/product grammar track.',
      'K-269 closed the Notes Empty State Pixel-Cosmos polish line.',
      '`NotesCosmosStaticPreview` remains isolated/unwired.',
      'Static Preview remains fixture-driven and deterministic.',
      'Static Preview does not use live graph data.',
      'Static Preview does not read Notes stores.',
      'Static Preview does not persist coordinates/orbits/spatial metadata.',
      'Static Preview is not mounted in normal Notes navigation.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'backup/preflight guardrails remain infrastructure',
      'Static Preview component: `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.',
      'Static HTML viewport harness generator: `frontend/scripts/renderNotesCosmosStaticPreview.mjs`.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents the current visual grammar audit', () => {
    const doc = readDoc();

    for (const required of [
      '## Current Visual Grammar Audit',
      'The current Static Preview is strong as an isolated, readable skeleton.',
      'semantic `article`, `section`, heading, ordered-list, and list-item structure',
      'literal node labels, summaries, kind, status, tone, cluster, and date text',
      'literal relationship labels, source/target text, kind, and strength text',
      'deterministic text fallback for every node and relationship',
      '10 nodes, 12 relationships, and 3 clusters from the K-220 fixture',
      '`positionHint` as fixture-only non-persistent planning metadata',
      'no canvas, SVG, WebGL, absolute graph layout, route wiring, or live data',
      'clusters: `Writing rhythm`, `Health context`, and `Long memory`',
      'node kinds: `note`, `cluster`, `anchor`, `signal`, and `archiveTrace`',
      'node tones: `quiet`, `active`, `reference`, and `archival`',
      'relationship kinds: `related`, `supports`, `contrasts`, `continues`, and `archives`',
      'the preview reads more like a neutral inventory table than a designed product grammar',
      'improve information structure first, not decoration',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares visual grammar polish candidates', () => {
    const doc = readDoc();

    for (const required of [
      '## Visual Grammar Polish Candidates',
      '### Candidate 1: Signal hierarchy polish',
      'Clarify primary signal, secondary signals, faint/background signals, and archive traces.',
      'recommended K-272 path',
      '### Candidate 2: Orbit/cluster language polish',
      'can imply saved spatial metadata',
      '### Candidate 3: Observatory/inventory framing polish',
      'could add lore noise instead of clarity',
      '### Candidate 4: Accessibility/fallback polish',
      'Improve text fallback, semantic labels, readable summary, keyboard/readability expectations',
      '### Candidate 5: Viewport/390px proof refresh',
      'required after a K-272 implementation changes the rendered preview',
      '### Candidate 6: Runtime mounting / product route',
      'not recommended',
      '### Candidate 7: Runtime Cosmos Map / graph replacement',
      'explicitly rejected',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('includes side-by-side comparison and recommends K-272 path', () => {
    const doc = readDoc();

    for (const required of [
      '## Side-by-side Comparison',
      'Signal hierarchy polish',
      'Orbit/cluster polish',
      'Observatory/inventory framing',
      'Accessibility/fallback polish',
      'Viewport proof refresh',
      'Runtime mounting',
      'Runtime Cosmos Map / graph replacement',
      'product identity gain',
      'information clarity',
      'implementation risk',
      'runtime coupling',
      'fixture contract risk',
      'accessibility value',
      'responsive/mobile QA need',
      'graph/persistence risk',
      'suitability for K-272',
      '## Recommended K-272 Path',
      '**K-272 Notes/Cosmos Static Preview Visual Grammar Polish**',
      'refine signal hierarchy only',
      'no runtime mounting',
      '**K-272 Notes/Cosmos Static Preview Accessibility/Fallback Audit**',
      '**K-272 Notes/Cosmos Static Preview Visual Grammar Fixture Spec**',
      '**K-272 Notes/Cosmos Static Preview Viewport Proof Refresh Plan**',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines K-272 boundaries and product grammar acceptance criteria', () => {
    const doc = readDoc();

    for (const required of [
      '## K-272 Visual Polish Boundaries',
      'touch only `NotesCosmosStaticPreview` and directly related isolated tests.',
      'keep fixture-driven',
      'keep deterministic',
      'keep isolated/unwired',
      'no normal Notes navigation',
      'no route/nav/panel',
      'no live graph data',
      'no Notes store reads',
      'no graph builders',
      'no `KnowledgeIndexService`',
      'no Notes persistence/schema changes',
      'no persisted coordinates/spatial metadata',
      'preserve fallback/accessibility',
      'preserve 390px/mobile proof expectations',
      '## Product Grammar Acceptance Criteria',
      'pixel is grammar, not decoration',
      'information-first layout',
      'readable typography',
      'productive interactions',
      'native accessibility and semantics remain first-class',
      'cozy sci-fi / pixel observatory / personal space archive tone',
      'visual hierarchy should make signal importance clearer',
      'avoid overdecorated cosmic UI',
      'avoid generic AI SaaS look',
      'fallback text remains the literal readable equivalent of the visual preview',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines static preview boundary, graph preservation, fixture preservation, and guardrails', () => {
    const doc = readDoc();

    for (const required of [
      '## Static Preview / Runtime Boundary',
      '`NotesCosmosStaticPreview` remains isolated unless a future milestone explicitly mounts it.',
      'static fixture remains deterministic',
      'no live note graph',
      'no persisted coordinates/orbits/spatial metadata',
      'no hidden/default panel',
      'no normal Notes navigation wiring',
      'runtime surface changes require a separate gate',
      '390px/mobile proof required before runtime exposure',
      '## Existing Graph Surface Preservation',
      '`NoteGraphView` remains full-vault graph.',
      '`LocalGraphView` remains local/context graph.',
      'Cosmos Map does not replace either.',
      'K-272 must not alter graph builders.',
      'K-272 must not couple to `KnowledgeIndexService`.',
      'K-272 must not introduce live graph data into static preview.',
      '## Fixture Contract Preservation',
      'K-220 fixture/mock contract remains the source for preview data.',
      'no new persisted spatial metadata',
      'no x/y coordinate persistence unless separately approved',
      'no live note IDs required',
      'no remote/provider IDs required',
      'fixture changes, if any, must remain deterministic and test-only/preview-only',
      '## Local-first / Backup Guardrails',
      'local runtime data remains source of truth',
      'no remote-first hydrate/fetch',
      'no production backup/preflight claims',
      'no Data Safety / Backup Health UI',
      'no restore/import behavior',
      'no attachment blob/provider behavior',
      'no raw token/content/blob leakage',
      'no Supabase/OAuth/Google Drive behavior changes',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines K-272 validation expectations and K-271 non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Expectations For K-272',
      'If K-272 implements Static Preview visual polish:',
      'static preview component tests',
      'fixture contract tests if touched',
      'fallback/accessibility assertions where possible',
      '390px/static HTML or wrapper-level responsive validation if existing',
      'no runtime import/wiring source audit',
      'typecheck/build',
      'no route/navigation diffs',
      'no graph/store/persistence diffs',
      'no backup/export/import diffs',
      'If K-272 remains plan/audit-only:',
      'doc/source audit test',
      'no browser QA required',
      '## Non-goals',
      'no UI implementation in K-271.',
      'no Static Preview implementation in K-271.',
      'no `NotesCosmosStaticPreview` changes.',
      'no Static Preview runtime wiring.',
      'no route/nav/panel change.',
      'no `NotesCosmosStaticPreview` mounting.',
      'no hidden panel.',
      'no Runtime Cosmos Map implementation.',
      'no graph replacement.',
      'no `NoteGraphView` change.',
      'no `LocalGraphView` change.',
      'no graph builder change.',
      'no `KnowledgeIndexService` coupling.',
      'no live Notes data integration.',
      'no persistence/schema change.',
      'no coordinates/orbits/spatial metadata persistence.',
      'no canvas/SVG/WebGL graph engine.',
      'no Data Safety / Backup Health UI.',
      'no Supabase/OAuth/Google Drive behavior change.',
      'no Health/Schedule behavior change.',
      'no assets/fonts/dependencies.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('ends with the required closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Closure Statement',
      'K-271 chooses signal hierarchy as the next isolated Static Preview visual grammar polish direction without implementing it.',
      'Static Preview remains fixture-driven, deterministic, isolated, and unwired.',
      'Empty-state polish remains closed.',
      'Existing graph surfaces remain preserved.',
      'Runtime Cosmos Map and graph replacement remain rejected.',
      'K-272 should remain small, isolated, and reversible.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-271 planning symbols are absent from runtime preview and graph files', () => {
    const sources = [
      readFileSync(previewPath, 'utf8'),
      readFileSync(fixturePath, 'utf8'),
      readFileSync(noteGraphPath, 'utf8'),
      readFileSync(localGraphPath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('notesCosmosStaticPreviewVisualGrammarPolishPlan');
      expect(source).not.toContain('K-271 Notes/Cosmos Static Preview Visual Grammar Polish Plan');
      expect(source).not.toContain('K-271-notes-cosmos-static-preview-visual-grammar-polish-plan');
      expect(source).not.toContain('K-272 Notes/Cosmos Static Preview Visual Grammar Polish');
    }
  });

  it('does not contain obvious committed credential material', () => {
    const doc = readDoc();

    for (const forbidden of [
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE ' + 'KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'access_' + 'token=',
      'refresh_' + 'token=',
    ]) {
      expect(doc).not.toContain(forbidden);
    }
  });
});
