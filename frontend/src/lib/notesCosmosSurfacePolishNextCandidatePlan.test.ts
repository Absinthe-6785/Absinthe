import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-267-notes-cosmos-surface-polish-next-candidate-plan.md');
const emptyStatePath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NotesPixelCosmosEmptyState.tsx',
);
const editorAreaPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const staticPreviewPath = join(
  process.cwd(),
  'src',
  'components',
  'notes',
  'NotesCosmosStaticPreview.tsx',
);
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

describe('K-267 notes cosmos surface polish next candidate plan', () => {
  it('exists and defines plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-267 Notes/Cosmos Surface Polish Next Candidate Plan',
      'K-267 selects the next Notes/Cosmos surface polish candidate after K-265 and K-266.',
      'K-267 is docs/plan plus audit test only.',
      'K-267 does not implement UI.',
      'K-267 does not make a broad Notes UI overhaul.',
      'K-267 does not change route/nav/panel behavior.',
      'K-267 does not wire Static Preview into runtime.',
      'K-267 does not mount `NotesCosmosStaticPreview`.',
      'K-267 does not implement Cosmos Map.',
      'K-267 does not replace graph surfaces.',
      'K-267 chooses the K-268 next path.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-265 and K-266', () => {
    const doc = readDoc();

    for (const required of [
      'K-263 restarted Notes/Cosmos product surface planning',
      'K-264 audited Option A Notes Empty State polish',
      'K-265 implemented narrow empty-vault UI polish',
      'K-266 closed K-265',
      '`NotesPixelCosmosEmptyState` is now the first product-surface Pixel/Cosmos polish.',
      '`Create note`, `Open today',
      'CTA/callback behavior is preserved',
      'accessibility and semantics are documented',
      '390px browser QA evidence exists',
      'Create note unclicked browser QA low note remains non-blocking',
      '`NotesCosmosStaticPreview` remains isolated/unwired.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the shipped local/context graph surface.',
      'backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents lessons from K-265/K-266', () => {
    const doc = readDoc();

    for (const required of [
      '## Lessons From K-265/K-266',
      'small bounded runtime UI polish worked',
      'source-facts closure audit was useful',
      'CTA/callback preservation must remain explicit',
      '390px/mobile QA is important',
      'visual identity changes should remain small and reversible',
      'accessibility and semantics must be preserved',
      'no backup/Data Safety claims should leak',
      'broad UI overhaul should still be avoided',
      'core writing actions remain literal',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares Notes Empty State follow-up polish', () => {
    const doc = readDoc();

    for (const required of [
      '## Candidate 1: Notes Empty State Follow-up Polish',
      'microcopy refinement',
      'empty-vault visual rhythm refinement',
      'CTA affordance/focus state refinement',
      'small responsive polish',
      'manual QA for Create note click behavior',
      'immediate user-facing product impact',
      'builds on K-265 safely',
      'low conceptual ambiguity',
      'touches runtime UI again',
      'browser/manual QA needed',
      'no route/nav/panel',
      'no graph/store/persistence changes',
      'no Static Preview runtime wiring',
      'no broad Notes UI overhaul',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares Static Preview continuation', () => {
    const doc = readDoc();

    for (const required of [
      '## Candidate 2: Static Preview Continuation, Still Isolated',
      '`NotesCosmosStaticPreview` is fixture-driven',
      'fixture lives in `notesCosmosStaticPreviewMockContract`',
      'read-only',
      'isolated/unwired from normal Notes navigation',
      'visual grammar refinement',
      'accessibility/fallback polish',
      'static HTML/viewport proof refresh',
      'dev/test-only showcase polish',
      'low runtime risk',
      'strengthens Cosmos concept',
      'weaker immediate user-facing impact',
      'must not become a hidden runtime panel',
      'no runtime mounting',
      'no route/nav/panel',
      'no live graph data',
      'no graph builders',
      'no `KnowledgeIndexService`',
      'no persisted coordinates/spatial metadata',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares Notes Overview / Signal Panel and Cosmos navigation concepts', () => {
    const doc = readDoc();

    for (const required of [
      '## Candidate 3: Notes Overview / Signal Panel Concept',
      'recent notes',
      'resurfacing records',
      'clusters/signals',
      'current writing orbit',
      'strong product direction',
      'higher data boundary risk',
      'may need live note queries/index state',
      'may overlap Home Signal Board',
      'planning/spec only if chosen',
      '## Candidate 4: Cosmos Navigation Concept, Planning Only',
      'observation/navigation language',
      'not a graph replacement',
      'not a runtime Cosmos Map',
      'clarifies long-term IA',
      'planning only if chosen',
      'no implementation',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('explicitly rejects graph replacement, runtime Cosmos Map, route/nav/panel, and broad work', () => {
    const doc = readDoc();

    for (const required of [
      '## Explicitly Not Recommended',
      'broad Notes UI overhaul',
      'runtime Cosmos Map',
      'route/nav/panel addition',
      'graph replacement',
      '`NoteGraphView` replacement',
      '`LocalGraphView` replacement',
      'Static Preview runtime wiring',
      'live graph data integration',
      '`KnowledgeIndexService` coupling',
      'persistence/schema/spatial metadata',
      'backup runtime productization',
      'Data Safety / Backup Health UI',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('includes side-by-side comparison and recommends K-268 path', () => {
    const doc = readDoc();

    for (const required of [
      '## Side-by-side Comparison',
      'user-visible impact',
      'implementation risk',
      'runtime coupling',
      'responsive/mobile QA need',
      'accessibility QA need',
      'graph/persistence risk',
      'product identity gain',
      'reversibility',
      'alignment with product surface return',
      'suitability for K-268',
      '## Recommended K-268 Path',
      '**K-268 Notes Empty State Pixel-Cosmos Follow-up Polish Plan**',
      'docs/plan plus audit test',
      'choose one tiny follow-up from K-265/K-266',
      'no implementation yet',
      'browser Create note click QA',
      '**K-268 Notes Empty State Pixel-Cosmos Follow-up Polish**',
      '**K-268 Notes/Cosmos Static Preview Continuation Plan**',
      'runtime Cosmos Map',
      'graph replacement',
      'backup/Data Safety UI',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines K-268 empty state and static preview boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## K-268 Implementation Boundaries If Empty State Follow-up',
      'touch only empty state and directly related tests',
      'preserve `Create note` callback',
      "`Open today's note` callback",
      '`Import backup` callback',
      'preserve keyboard/focus behavior',
      'preserve accessible labels/semantics',
      'preserve mobile 390px behavior',
      'avoid horizontal overflow',
      'no route/nav/panel changes',
      'no `NoteGraphView` changes',
      'no `LocalGraphView` changes',
      'no `NotesCosmosStaticPreview` mounting',
      'no backup/preflight claims',
      '## K-268 Boundaries If Static Preview Continuation',
      'fixture-driven only',
      'isolated/unwired',
      'no normal Notes navigation',
      'no live graph data',
      'no graph builders',
      'no `KnowledgeIndexService`',
      'no persisted coordinates/spatial metadata',
      'no canvas/SVG/WebGL engine',
      'preserve fallback/accessibility',
      'preserve 390px/mobile proof expectations',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines product grammar, graph preservation, static/runtime boundary, and local-first guardrails', () => {
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
      'do not hide core Notes actions behind spectacle',
      '## Existing Graph Surface Preservation',
      '`NoteGraphView` remains full-vault graph.',
      '`LocalGraphView` remains local/context graph.',
      'Cosmos Map does not replace either.',
      'K-268 must not alter graph builders.',
      'K-268 must not couple to `KnowledgeIndexService`.',
      'K-268 must not introduce live graph data into static preview.',
      '## Static Preview / Runtime Boundary',
      '`NotesCosmosStaticPreview` remains isolated unless a future milestone explicitly mounts it.',
      'static fixture remains deterministic',
      'no persisted coordinates/orbits/spatial metadata',
      'no hidden/default panel',
      'no normal Notes navigation wiring',
      '390px/mobile proof required before runtime exposure',
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

  it('defines K-268 validation expectations and K-267 non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Expectations For K-268',
      'If K-268 chooses Empty State follow-up implementation:',
      'targeted component/unit tests',
      'CTA/callback preservation test',
      'accessibility/semantic assertions',
      '390px/manual browser QA',
      'Create note click manual QA if relevant',
      'no horizontal overflow',
      'typecheck/build',
      'no graph/store/persistence diffs',
      'If K-268 chooses Static Preview continuation:',
      'static preview tests',
      'fixture contract tests',
      'no runtime import/wiring source audit',
      'If K-268 remains docs/plan:',
      'doc audit test',
      'source isolation audit if practical',
      'no runtime diffs',
      '## Non-goals',
      'no UI implementation in K-267.',
      'no broad Notes UI overhaul.',
      'no Notes Empty State implementation in K-267.',
      'no Static Preview runtime wiring.',
      'no route/nav/panel change.',
      'no `NotesCosmosStaticPreview` mounting.',
      'no hidden panel.',
      'no Cosmos Map implementation.',
      'no graph replacement.',
      'no `NoteGraphView` change.',
      'no `LocalGraphView` change.',
      'no graph builder change.',
      'no `KnowledgeIndexService` coupling.',
      'no persistence/schema change.',
      'no coordinates/orbits/spatial metadata persistence.',
      'no canvas/SVG/WebGL graph engine.',
      'no backup/preflight runtime implementation.',
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
      'K-267 selects the next small Notes/Cosmos surface polish candidate without implementing it.',
      'K-265/K-266 proved a small empty-vault polish can be safely shipped and audited.',
      'K-268 should remain small, bounded, and reversible.',
      'Existing graph surfaces remain preserved.',
      'Static preview remains isolated.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-267 symbols are not referenced from runtime surface files', () => {
    const sources = [
      readFileSync(emptyStatePath, 'utf8'),
      readFileSync(editorAreaPath, 'utf8'),
      readFileSync(staticPreviewPath, 'utf8'),
      readFileSync(noteGraphPath, 'utf8'),
      readFileSync(localGraphPath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('notesCosmosSurfacePolishNextCandidatePlan');
      expect(source).not.toContain('K-267 Notes/Cosmos Surface Polish Next Candidate Plan');
      expect(source).not.toContain('K-268 Notes Empty State Pixel-Cosmos Follow-up Polish Plan');
      expect(source).not.toContain('K-267-notes-cosmos-surface-polish-next-candidate-plan');
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
