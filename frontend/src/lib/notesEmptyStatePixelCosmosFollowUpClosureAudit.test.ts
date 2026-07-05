import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-269-notes-empty-state-pixel-cosmos-follow-up-closure-audit.md');
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

describe('K-269 notes empty state pixel-cosmos follow-up closure audit', () => {
  it('exists and defines docs/audit-only closure scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-269 Notes Empty State Pixel-Cosmos Follow-up Closure Audit',
      'K-269 closes the Notes Empty State Pixel-Cosmos polish line from K-265 through K-268.',
      'K-269 is docs/audit plus audit test only.',
      'K-269 does not implement UI.',
      'K-269 does not implement Notes Empty State follow-up polish.',
      'K-269 does not change route/nav/panel behavior.',
      'K-269 does not wire Static Preview into runtime.',
      'K-269 does not mount `NotesCosmosStaticPreview`.',
      'K-269 does not implement Cosmos Map.',
      'K-269 does not replace graph surfaces.',
      'K-269 chooses the next product surface direction after closing empty-state polish.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-265 through K-268', () => {
    const doc = readDoc();

    for (const required of [
      'K-263 restarted Notes/Cosmos product surface planning',
      'K-264 selected Notes Empty State polish as the first bounded implementation candidate.',
      'K-265 implemented empty-vault UI polish',
      'K-266 closed K-265 with a source-facts closure audit.',
      'K-267 selected a narrow empty state follow-up plan as the default next candidate.',
      'K-268 concluded no immediate follow-up runtime edit is required',
      '`NotesPixelCosmosEmptyState` is the first product-surface Pixel/Cosmos polish.',
      '`Create note`, `Open today',
      'CTA/callback behavior is preserved',
      'accessibility and semantics are documented',
      '390px browser QA evidence exists',
      'Create note unclicked low note remains non-blocking',
      '`NotesCosmosStaticPreview` remains isolated/unwired.',
      '`NoteGraphView` and `LocalGraphView` remain preserved.',
      'backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits K-265 implementation closure with source facts', () => {
    const doc = readDoc();

    for (const required of [
      '## Closure Audit Of K-265 Implementation',
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
      'decorative pixel motif elements remain `aria-hidden`',
      '390px browser QA evidence',
      'no horizontal overflow or clipping',
      '`frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`',
      '`frontend/src/lib/notesEmptyStatePixelCosmosProductPolishClosureAudit.test.ts`',
      '`frontend/src/lib/notesEmptyStatePixelCosmosFollowUpPolishPlan.test.ts`',
      'no additional runtime edits are needed',
      'no files should be changed by K-269 except the K-269 closure audit doc and K-269 audit test',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits K-266 source-facts closure', () => {
    const doc = readDoc();

    for (const required of [
      '## Closure Audit Of K-266 Source-facts Audit',
      'K-266 verified the K-265 scope',
      'did not change mount point, navigation, graph surfaces, stores, schemas, persistence, providers',
      'K-266 documented CTA/callback preservation',
      '`onCreateNote`, `onOpenTodaysNote`, and `onImportVault` remain existing callbacks.',
      'K-266 documented accessibility/semantics',
      'actions remain native visible text buttons',
      'K-266 documented 390px browser QA evidence',
      'forbidden Static Preview, graph, Data Safety, and Backup Health surfaces did not appear',
      'K-266 documented the Create note unclicked low note as non-blocking',
      'callback invocation is covered by the focused unit test',
      'no static preview runtime wiring',
      'no graph/runtime boundary regression',
      'no backup/runtime boundary regression',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits K-267 and K-268 planning closure', () => {
    const doc = readDoc();

    for (const required of [
      '## Closure Audit Of K-267/K-268 Planning',
      'K-267 compared next product surface candidates',
      'Notes Empty State follow-up polish',
      'Static Preview continuation, still isolated',
      'Notes Overview / Signal Panel concept',
      'Cosmos navigation concept, planning only',
      'K-267 recommended a narrow empty-state follow-up plan',
      'K-268 evaluated',
      'copy refinement',
      'visual hierarchy / rhythm refinement',
      'CTA grouping / affordance refinement',
      'responsive / 390px polish',
      'manual QA follow-up only',
      'K-268 found no source-grounded immediate runtime edit requirement',
      'the Create note low note remained QA-only',
      'K-268 recommended K-269 closure audit as the primary next path',
      'K-268 kept Create note manual QA as an optional separate path',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('states the empty-state line closure decision', () => {
    const doc = readDoc();

    for (const required of [
      '## Empty-state Line Closure Decision',
      'The empty-state polish line is closed for now.',
      'No immediate K-269 runtime UI edit is needed.',
      'No immediate broad Notes UI change is needed.',
      'No immediate route/nav/panel change is needed.',
      'No immediate Static Preview runtime wiring is needed.',
      'No immediate graph or persistence change is needed.',
      'Future empty-state work should require a new source-grounded defect',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents optional Create note manual QA as non-blocking and non-mutating', () => {
    const doc = readDoc();

    for (const required of [
      '## Optional Create Note Manual QA Note',
      '`Create note` was not clicked in manual browser QA.',
      'this remains non-blocking because callback behavior is unit/source verified',
      'future QA-only audit may verify the `Create note` click path',
      'disposable/local test vault',
      'do not use this closure audit to create data or mutate local vault state',
      'do not block empty-state line closure on this optional QA note',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares next product surface candidates and recommends next planning paths', () => {
    const doc = readDoc();

    for (const required of [
      '## Next Product Surface Candidates After Closure',
      '### Static Preview Continuation Planning',
      'isolated and fixture-driven',
      'useful for Cosmos visual grammar',
      '### Notes Overview / Signal Panel Planning',
      'stronger product direction for non-empty vaults',
      'higher data boundary risk',
      'should start as plan/spec only',
      '### Cosmos Navigation Concept Planning',
      'clarifies long-term IA',
      'must not become runtime Cosmos Map',
      '**K-270 Notes/Cosmos Static Preview Continuation Plan**',
      '**K-270 Notes Overview / Signal Panel Concept Plan**',
      '**K-270 Cosmos Navigation Concept Plan**',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('explicitly rejects runtime Cosmos Map, graph replacement, broad UI overhaul, and backup productization', () => {
    const doc = readDoc();

    for (const required of [
      '## Explicitly Rejected Next Steps',
      'runtime Cosmos Map',
      'graph replacement',
      'broad Notes UI overhaul',
      'route/nav/panel addition',
      'Static Preview runtime wiring',
      'live graph data integration',
      '`KnowledgeIndexService` coupling',
      'persistence/schema/spatial metadata',
      'backup runtime productization',
      'Data Safety / Backup Health UI',
      'restore/import validation',
      'attachment blob backup',
      'provider-aware recovery',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines Pixel/Cosmos product grammar carry-forward', () => {
    const doc = readDoc();

    for (const required of [
      '## Pixel/Cosmos Product Grammar Carry-forward',
      'pixel is grammar, not decoration',
      'information-first layout',
      'readable typography',
      'productive interactions',
      'native accessibility and semantics remain first-class',
      'cozy sci-fi / pixel observatory / personal space archive tone',
      'avoid overdecorated cosmic UI',
      'avoid generic AI SaaS look',
      'use signal/orbit/observatory language only where it clarifies state',
      'do not hide core Notes actions behind spectacle',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines graph preservation, static preview/runtime boundary, and local-first backup guardrails', () => {
    const doc = readDoc();

    for (const required of [
      '## Existing Graph Surface Preservation',
      '`NoteGraphView` remains full-vault graph.',
      '`LocalGraphView` remains local/context graph.',
      'Cosmos Map does not replace either.',
      'future work must not alter graph builders unless explicitly scoped.',
      'future work must not couple to `KnowledgeIndexService` unless explicitly scoped.',
      'future work must not introduce live graph data into static preview.',
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

  it('defines validation expectations for next milestone and non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Expectations For Next Milestone',
      'If the next milestone chooses Static Preview continuation:',
      'static preview tests',
      'fixture contract tests',
      'no runtime import/wiring source audit',
      'typecheck/build',
      'no route/navigation diffs',
      'If the next milestone chooses Notes Overview / Signal Panel planning:',
      'docs/plan plus audit test only first',
      'source audit of current note data/query boundaries',
      'no implementation until data boundary is locked',
      'If the next milestone chooses Cosmos navigation concept:',
      'docs/spec plus audit test only',
      'preserve `NoteGraphView` and `LocalGraphView`',
      'no runtime route/nav changes',
      '## Non-goals',
      'no UI implementation in K-269.',
      'no Notes Empty State implementation in K-269.',
      'no broad Notes UI overhaul.',
      'no Create note manual QA mutation in K-269.',
      'no Static Preview runtime wiring.',
      'no route/nav/panel change.',
      'no `NotesCosmosStaticPreview` mounting.',
      'no hidden panel.',
      'no Cosmos Map implementation.',
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
      'K-269 closes the Notes Empty State Pixel-Cosmos polish line for now.',
      'K-265/K-266 proved the empty-vault polish can be safely shipped and audited.',
      'K-268 found no immediate source-grounded follow-up runtime edit requirement.',
      'Optional Create note manual QA remains separate and non-blocking.',
      'The next product surface should move beyond empty-state polish unless a new defect appears.',
      'Existing graph surfaces remain preserved.',
      'Static preview remains isolated.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-269 symbols are not referenced from runtime surface files', () => {
    const sources = [
      readFileSync(emptyStatePath, 'utf8'),
      readFileSync(editorAreaPath, 'utf8'),
      readFileSync(staticPreviewPath, 'utf8'),
      readFileSync(noteGraphPath, 'utf8'),
      readFileSync(localGraphPath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('notesEmptyStatePixelCosmosFollowUpClosureAudit');
      expect(source).not.toContain('K-269 Notes Empty State Pixel-Cosmos Follow-up Closure Audit');
      expect(source).not.toContain('K-270 Notes/Cosmos Static Preview Continuation Plan');
      expect(source).not.toContain('K-269-notes-empty-state-pixel-cosmos-follow-up-closure-audit');
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
