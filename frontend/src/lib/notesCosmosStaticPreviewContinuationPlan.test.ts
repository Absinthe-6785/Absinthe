import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-270-notes-cosmos-static-preview-continuation-plan.md');
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

describe('K-270 notes cosmos static preview continuation plan', () => {
  it('exists and defines docs/plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-270 Notes/Cosmos Static Preview Continuation Plan',
      'K-270 plans how the Notes/Cosmos Static Preview line should continue after empty-state polish closure.',
      'K-270 is docs/plan plus audit test only.',
      'K-270 does not implement UI.',
      'K-270 does not implement Static Preview changes.',
      'K-270 does not wire Static Preview into runtime.',
      'K-270 does not change route/nav/panel behavior.',
      'K-270 does not mount `NotesCosmosStaticPreview`.',
      'K-270 does not implement Runtime Cosmos Map.',
      'K-270 does not replace graph surfaces.',
      'K-270 chooses the K-271 next path.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-269', () => {
    const doc = readDoc();

    for (const required of [
      'K-269 closed the Notes Empty State Pixel-Cosmos polish line.',
      'K-265 empty-vault polish remains the first runtime product-surface Pixel/Cosmos polish.',
      'K-270 now evaluates Static Preview continuation as the next product/visual grammar track.',
      '`NotesCosmosStaticPreview` remains isolated/unwired.',
      'Static Preview remains fixture-driven.',
      'current Static Preview does not use live graph data.',
      'current Static Preview does not read Notes stores.',
      'current Static Preview does not persist coordinates/orbits/spatial metadata.',
      'current Static Preview is not mounted in normal Notes navigation.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Cosmos Map is not implemented.',
      'backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents Static Preview lineage', () => {
    const doc = readDoc();

    for (const required of [
      '## Static Preview Lineage',
      'K-218 planned the Static Preview posture',
      'K-219 defined the fixture-first direction',
      'K-220 created the mock/fixture contract',
      '`frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`',
      '10 nodes, 12 relationships, 3 clusters',
      '`positionHint` is fixture-only and non-persistent',
      'K-221 planned the component skeleton',
      'K-222 through K-224 created and polished the isolated component',
      '`frontend/src/components/notes/NotesCosmosStaticPreview.tsx`',
      'K-225 through K-227 did not approve normal runtime navigation/panel',
      'K-227 selected a real viewport test harness plan',
      'K-228 through K-234 built the viewport/static HTML proof path',
      'generated HTML remains ephemeral and uncommitted',
      'safe visual/product grammar exploration, not runtime graph replacement',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents current preview contract', () => {
    const doc = readDoc();

    for (const required of [
      '## Current Preview Contract',
      'fixture-driven',
      'deterministic',
      'isolated/unwired',
      'no live graph data',
      'no Notes store reads',
      'no `KnowledgeIndexService` coupling',
      'no graph builder coupling',
      'no persisted coordinates',
      'no route/nav/panel',
      'no hidden/default panel',
      'no backup/Data Safety claims',
      'accessibility/fallback expectations remain required',
      '390px/mobile proof remains required before runtime exposure',
      '`notesCosmosStaticPreviewFixture`',
      '`NotesCosmosStaticPreview`',
      'renders ordered fixture nodes from fallback order',
      'renders text fallback sections',
      'no runtime product placement',
      'no product claim that Cosmos Map exists',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares continuation candidates', () => {
    const doc = readDoc();

    for (const required of [
      '## Continuation Candidate 1: Static Preview Visual Grammar Polish',
      'refine atmosphere, hierarchy, signal/orbit language, empty/cluster feel',
      'likely safest next implementation if small',
      'best K-271 direction as a plan',
      '## Continuation Candidate 2: Static Preview Accessibility/Fallback Hardening',
      'improve text fallback, semantics, keyboard/readability expectations',
      'good fallback if source audit finds accessibility/fallback evidence weaker',
      '## Continuation Candidate 3: Static Preview Viewport Proof Refresh',
      'update or rerun static HTML/390px evidence path',
      'do not commit generated HTML',
      '## Continuation Candidate 4: Static Preview Dev/Test Showcase Plan',
      'K-227 found no safe route/panel convention',
      '## Continuation Candidate 5: Runtime Static Preview Mounting',
      'not recommended now',
      'too close to product runtime exposure',
      '## Continuation Candidate 6: Runtime Cosmos Map / Graph Replacement',
      'explicitly rejected',
      'violates preserved graph surface boundary',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('includes side-by-side comparison and recommends K-271 path', () => {
    const doc = readDoc();

    for (const required of [
      '## Side-by-side Comparison',
      'Visual grammar polish',
      'Accessibility/fallback hardening',
      'Viewport proof refresh',
      'Dev/test showcase plan',
      'Runtime mounting',
      'Runtime Cosmos Map / graph replacement',
      'product identity gain',
      'implementation risk',
      'runtime coupling',
      'responsive/mobile QA need',
      'accessibility QA need',
      'graph/persistence risk',
      'reversibility',
      'alignment with isolated preview contract',
      'suitability for K-271',
      '## Recommended K-271 Path',
      '**K-271 Notes/Cosmos Static Preview Visual Grammar Polish Plan**',
      'docs/plan plus audit test',
      'choose one tiny isolated preview refinement',
      'no runtime wiring',
      '**K-271 Notes/Cosmos Static Preview Visual Grammar Polish**',
      '**K-271 Notes/Cosmos Static Preview Accessibility/Fallback Audit**',
      '**K-271 Notes Overview / Signal Panel Concept Plan**',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines K-271 boundaries if visual polish is chosen', () => {
    const doc = readDoc();

    for (const required of [
      '## K-271 Boundaries If Static Preview Visual Polish Is Chosen',
      'touch only `NotesCosmosStaticPreview` and directly related isolated tests if implementing',
      'keep fixture-driven',
      'keep isolated/unwired',
      'no normal Notes navigation',
      'no route/nav/panel',
      'no live graph data',
      'no graph builders',
      'no `KnowledgeIndexService`',
      'no Notes store/persistence/schema changes',
      'no persisted coordinates/spatial metadata',
      'no canvas/SVG/WebGL engine unless already part of isolated component and explicitly audited',
      'preserve fallback/accessibility',
      'preserve 390px/mobile proof expectations',
      'no backup/preflight claims',
      'no product claim that Cosmos Map exists',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines product grammar, runtime boundary, graph preservation, and backup guardrails', () => {
    const doc = readDoc();

    for (const required of [
      '## Pixel/Cosmos Product Grammar Criteria',
      'pixel is grammar, not decoration',
      'information-first layout',
      'readable typography',
      'productive interactions',
      'native accessibility and semantics remain first-class',
      'cozy sci-fi / pixel observatory / personal space archive tone',
      'avoid overdecorated cosmic UI',
      'avoid generic AI SaaS look',
      'visual preview should clarify future product direction, not imply shipped navigation',
      '## Static Preview / Runtime Boundary',
      '`NotesCosmosStaticPreview` remains isolated unless a future milestone explicitly mounts it.',
      'static fixture remains deterministic',
      'no live note graph',
      'no persisted coordinates/orbits/spatial metadata',
      'no hidden/default panel',
      'no normal Notes navigation wiring',
      'runtime surface changes require a separate gate',
      'dev/test surface, if ever considered, requires a separate plan',
      '## Existing Graph Surface Preservation',
      '`NoteGraphView` remains full-vault graph.',
      '`LocalGraphView` remains local/context graph.',
      'Cosmos Map does not replace either.',
      'K-271 must not alter graph builders.',
      'K-271 must not couple to `KnowledgeIndexService`.',
      'K-271 must not introduce live graph data into static preview.',
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

  it('defines K-271 validation expectations and K-270 non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Expectations For K-271',
      'If K-271 chooses Static Preview visual polish implementation:',
      'static preview component tests',
      'fixture contract tests',
      'fallback/accessibility assertions',
      '390px/static HTML or wrapper-level responsive validation if existing',
      'no runtime import/wiring source audit',
      'typecheck/build',
      'no route/navigation diffs',
      'no graph/store/persistence diffs',
      'If K-271 remains plan/audit-only:',
      'doc/source audit test',
      'source-facts check for isolation where useful',
      'no browser QA required',
      'no runtime diffs',
      '## Non-goals',
      'no UI implementation in K-270.',
      'no Static Preview implementation in K-270.',
      'no Static Preview runtime wiring.',
      'no route/nav/panel change.',
      'no `NotesCosmosStaticPreview` mounting.',
      'no hidden panel.',
      'no Runtime Cosmos Map implementation.',
      'no graph replacement.',
      'no `NoteGraphView` change.',
      'no `LocalGraphView` change.',
      'no `KnowledgeIndexService` coupling.',
      'no persistence/schema change.',
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
      'K-270 selects Static Preview continuation as an isolated visual/product grammar track without implementing it.',
      'Empty-state polish remains closed from K-269.',
      'Static Preview remains fixture-driven and unwired.',
      'Existing graph surfaces remain preserved.',
      'Runtime Cosmos Map and graph replacement remain rejected.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'K-271 should remain small, isolated, and reversible.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-270 symbols are not referenced from runtime preview or graph files', () => {
    const sources = [
      readFileSync(previewPath, 'utf8'),
      readFileSync(fixturePath, 'utf8'),
      readFileSync(noteGraphPath, 'utf8'),
      readFileSync(localGraphPath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('notesCosmosStaticPreviewContinuationPlan');
      expect(source).not.toContain('K-270 Notes/Cosmos Static Preview Continuation Plan');
      expect(source).not.toContain('K-271 Notes/Cosmos Static Preview Visual Grammar Polish Plan');
      expect(source).not.toContain('K-270-notes-cosmos-static-preview-continuation-plan');
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
