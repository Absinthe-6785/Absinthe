import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-268-notes-empty-state-pixel-cosmos-follow-up-polish-plan.md');
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

describe('K-268 notes empty state pixel-cosmos follow-up polish plan', () => {
  it('exists and defines docs/plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-268 Notes Empty State Pixel-Cosmos Follow-up Polish Plan',
      'K-268 plans whether a small Notes Empty State follow-up polish is needed after K-265, K-266, and K-267.',
      'K-268 is docs/plan plus audit test only.',
      'K-268 does not implement UI.',
      'K-268 does not make a broad Notes UI overhaul.',
      'K-268 does not change route/nav/panel behavior.',
      'K-268 does not wire Static Preview into runtime.',
      'K-268 does not mount `NotesCosmosStaticPreview`.',
      'K-268 does not implement Cosmos Map.',
      'K-268 does not replace graph surfaces.',
      'K-268 chooses the K-269 next path or recommends pausing empty state polish.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-265, K-266, and K-267', () => {
    const doc = readDoc();

    for (const required of [
      'K-263 restarted Notes/Cosmos product surface planning',
      'K-264 selected Notes Empty State polish as the first bounded implementation candidate.',
      'K-265 implemented empty-vault UI polish',
      'K-266 closed K-265 with a source-facts closure audit.',
      'K-267 selected a narrow empty state follow-up plan as the default next candidate.',
      '`NotesPixelCosmosEmptyState` is now the first product-surface Pixel/Cosmos polish.',
      '`Create note`, `Open today',
      'CTA/callback behavior is preserved',
      'accessibility and semantics are documented',
      '390px browser QA evidence exists',
      'Create note unclicked browser QA low note remains non-blocking',
      '`NotesCosmosStaticPreview` remains isolated/unwired.',
      '`NoteGraphView` and `LocalGraphView` remain preserved.',
      'backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('records K-265/K-266 source-grounded facts', () => {
    const doc = readDoc();

    for (const required of [
      '## K-265/K-266 Source-grounded Facts',
      '`frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`',
      '`frontend/src/components/views/noteview/NoteViewEditorArea.tsx`',
      'Empty-vault branch: `isEmptyVault ? <NotesPixelCosmosEmptyState ... />`',
      '`onCreateNote={() => createNote()}`',
      '`onOpenTodaysNote={onOpenTodaysNote}`',
      '`onImportVault={onImportVault}`',
      '`Create note` remains a native button and calls `onCreateNote`.',
      '`Open today',
      '`Import backup` remains optional and calls `onImportVault`.',
      'role="status"',
      'aria-label="Notes empty state"',
      'actions preserve `abs-focus-ring`',
      '390px browser QA evidence',
      'no horizontal overflow or clipping',
      '`frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`',
      '`frontend/src/lib/notesEmptyStatePixelCosmosProductPolishClosureAudit.test.ts`',
      '`frontend/src/lib/notesCosmosSurfacePolishNextCandidatePlan.test.ts`',
      'this remains a manual QA question, not a source-grounded UI defect',
      'Files that should remain untouched by K-268',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares copy refinement with source-grounded recommendation', () => {
    const doc = readDoc();

    for (const required of [
      '## Follow-up Candidate 1: Copy Refinement',
      'Does the current copy feel too generic, too verbose, unclear, or sufficiently good?',
      'current copy is specific and literal',
      '`Notes / Living Cosmos`',
      '`Empty vault`',
      '`Start with one signal`',
      'CTAs remain literal',
      'copy refinement can obscure the core `Create note` action',
      'can accidentally imply backup safety',
      'do not implement copy refinement unless a specific source-grounded copy issue is identified',
      'no source-grounded copy defect is identified in K-268',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares visual hierarchy and rhythm refinement', () => {
    const doc = readDoc();

    for (const required of [
      '## Follow-up Candidate 2: Visual Hierarchy / Rhythm Refinement',
      'spacing, grouping, pixel/cosmos tokens, or hierarchy',
      'single framed empty-state section',
      'layout remains information-first',
      'pixel/cosmos tokens are CSS-only',
      'visual polish can become overdecorated cosmic UI',
      'runtime edit requires 390px/manual browser QA',
      'implement only if a single bounded hierarchy issue is confirmed',
      'no confirmed visual hierarchy defect is identified in K-268',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares CTA grouping and affordance refinement', () => {
    const doc = readDoc();

    for (const required of [
      '## Follow-up Candidate 3: CTA Grouping / Affordance Refinement',
      'Does `Create note` remain obvious',
      '`Create note` is the first CTA',
      'secondary actions are optional, visible, native buttons',
      'all actions use `abs-focus-ring`',
      'callback behavior is covered by tests',
      'changing affordance can accidentally change action behavior',
      'backup/import copy must not become Data Safety or restore productization',
      '`Create note`, `Open today',
      '`Import backup` callback preservation',
      'preserve callback behavior and avoid behavior changes',
      'no CTA grouping code change is recommended by K-268',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares responsive and 390px polish', () => {
    const doc = readDoc();

    for (const required of [
      '## Follow-up Candidate 4: Responsive / 390px Polish',
      'Does K-265/K-266 evidence show any 390px issue?',
      'K-266 records 390px browser QA as passing',
      'width: min(100%, 620px)',
      'wrapping CTA row',
      'mobile empty-vault pane behavior',
      'new screenshot shows overflow',
      'responsive runtime changes require browser QA',
      'only implement if there is a confirmed mobile issue',
      'K-268 finds no confirmed mobile issue',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares manual QA follow-up only', () => {
    const doc = readDoc();

    for (const required of [
      '## Follow-up Candidate 5: Manual QA Follow-up Only',
      'Create note unclicked low note from K-266',
      '`Create note` was not clicked during browser QA',
      'focused unit test clicks `Create note`',
      'there is no source evidence that the action is broken',
      'a small QA/audit milestone could close the only remaining low note',
      'no runtime files',
      'choose QA/audit-only',
      'consider the empty-state polish line sufficiently closed',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('explicitly rejects broad UI, runtime Cosmos Map, graph replacement, and backup productization', () => {
    const doc = readDoc();

    for (const required of [
      '## Explicitly Rejected Candidates',
      'broad Notes UI overhaul',
      'changing the main Notes editor layout',
      'route/nav/panel additions',
      'Static Preview runtime wiring',
      'runtime Cosmos Map',
      'graph replacement',
      '`NoteGraphView` changes',
      '`LocalGraphView` changes',
      'live graph data integration',
      '`KnowledgeIndexService` coupling',
      'persistence/schema/spatial metadata',
      'backup/Data Safety product UI',
      'backup runtime productization',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('includes decision matrix and recommends K-269 path', () => {
    const doc = readDoc();

    for (const required of [
      '## Decision Matrix',
      'Copy refinement',
      'Visual hierarchy / rhythm',
      'CTA grouping / affordance',
      'Responsive / 390px polish',
      'Manual QA follow-up only',
      'user-visible impact',
      'implementation risk',
      'runtime coupling',
      'responsive/mobile QA need',
      'accessibility QA need',
      'CTA/callback risk',
      'product identity gain',
      'over-polish risk',
      'reversibility',
      'suitability for K-269',
      '## Recommended K-269 Path',
      '**K-269 Notes Empty State Pixel-Cosmos Follow-up Closure Audit**',
      'docs/audit plus audit test only',
      'no further immediate UI polish is source-grounded',
      '**K-269 Notes Empty State Create Note Manual QA Audit**',
      '**K-269 Notes Empty State Pixel-Cosmos Follow-up Polish**',
      '**K-269 Notes/Cosmos Static Preview Continuation Plan**',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines K-269 UI implementation boundaries if a follow-up is chosen', () => {
    const doc = readDoc();

    for (const required of [
      '## K-269 Implementation Boundaries If UI Follow-up Is Chosen',
      'touch only `NotesPixelCosmosEmptyState` and directly related tests if needed',
      'preserve `NoteViewEditorArea` mount/wiring',
      'preserve `Create note` callback',
      "`Open today's note` callback",
      '`Import backup` callback',
      'preserve keyboard/focus behavior',
      'preserve accessible labels/semantics',
      'preserve readable typography',
      'preserve mobile 390px behavior',
      'avoid horizontal overflow',
      'avoid large layout rewrite',
      'avoid global visual overhaul',
      'no route/nav/panel changes',
      'no `NoteGraphView` changes',
      'no `LocalGraphView` changes',
      'no `NotesCosmosStaticPreview` mounting',
      'no backup/preflight claims',
      'no store/schema/persistence changes',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines Pixel/Cosmos grammar, graph preservation, static preview boundary, and local-first guardrails', () => {
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
      'K-269 must not alter graph builders.',
      'K-269 must not couple to `KnowledgeIndexService`.',
      'K-269 must not introduce live graph data into static preview.',
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

  it('defines K-269 validation expectations and K-268 non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Expectations For K-269',
      'If K-269 chooses Empty State follow-up implementation:',
      'targeted component/unit tests',
      'CTA/callback preservation test',
      'accessibility/semantic assertions',
      '390px/manual browser QA',
      'Create note click manual QA if relevant',
      'no horizontal overflow',
      'typecheck/build',
      'no graph/store/persistence diffs',
      'If K-269 chooses closure/QA-only:',
      'doc/source audit test',
      'source-facts check for unchanged runtime behavior',
      'no browser QA unless manually verifying Create note click path',
      'no runtime diffs',
      '## Non-goals',
      'no UI implementation in K-268.',
      'no broad Notes UI overhaul.',
      'no Notes Empty State implementation in K-268.',
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
      'K-268 decides whether a tiny Notes Empty State follow-up is needed without implementing it.',
      'K-265/K-266 already proved the empty-vault polish can be safely shipped and audited.',
      'K-269 should either implement one tiny source-grounded follow-up or close the empty state polish line.',
      'Existing graph surfaces remain preserved.',
      'Static preview remains isolated.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-268 symbols are not referenced from runtime surface files', () => {
    const sources = [
      readFileSync(emptyStatePath, 'utf8'),
      readFileSync(editorAreaPath, 'utf8'),
      readFileSync(staticPreviewPath, 'utf8'),
      readFileSync(noteGraphPath, 'utf8'),
      readFileSync(localGraphPath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('notesEmptyStatePixelCosmosFollowUpPolishPlan');
      expect(source).not.toContain('K-268 Notes Empty State Pixel-Cosmos Follow-up Polish Plan');
      expect(source).not.toContain('K-269 Notes Empty State Pixel-Cosmos Follow-up Closure Audit');
      expect(source).not.toContain('K-268-notes-empty-state-pixel-cosmos-follow-up-polish-plan');
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
