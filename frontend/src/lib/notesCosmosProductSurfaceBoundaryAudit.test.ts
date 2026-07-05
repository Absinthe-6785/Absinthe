import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-264-notes-cosmos-product-surface-boundary-audit.md');
const editorAreaPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const emptyStatePath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NotesPixelCosmosEmptyState.tsx',
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

describe('K-264 notes cosmos product surface boundary audit', () => {
  it('documents audit-only scope and runtime non-implementation', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-264 Notes/Cosmos Product Surface Boundary Audit',
      'K-264 audits Notes/Cosmos product surface boundaries before implementation.',
      'K-264 is docs/audit plus audit test only.',
      'K-264 does not implement UI.',
      'K-264 does not implement Notes Empty State polish.',
      'K-264 does not wire runtime routes/panels/navigation.',
      'K-264 does not mount `NotesCosmosStaticPreview`.',
      'K-264 does not replace graph surfaces.',
      'K-264 does not implement Cosmos Map.',
      'K-264 chooses the K-265 next path.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current Notes/Cosmos and backup foundation state', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-263 restarted Notes/Cosmos product surface planning after the backup foundation.',
      'Notes/Cosmos work from K-214 through K-234 established concept, IA, static fixture, isolated static preview, and viewport proof path.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Cosmos Map is not implemented.',
      '`NotesCosmosStaticPreview` remains isolated/unwired.',
      'normal Notes navigation has not been changed by K-263.',
      'backup/preflight work remains infrastructure and is not productized here.',
      'Empty-vault Notes currently renders `NotesPixelCosmosEmptyState`',
      '`frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.',
      '`frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.',
      '`frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits Option A Notes Empty State polish', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Option A Audit: Notes Empty State Polish',
      'Current empty state component/file path:',
      '`frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.',
      'Already user-facing.',
      'Bounded to the true empty Notes vault state.',
      'Uses existing create note, open today',
      'Does not require route/navigation changes.',
      'Visual/product opportunity:',
      'Strongest immediate user-visible product movement.',
      'Responsive risk:',
      'K-265 must preserve 390px/mobile behavior and avoid horizontal overflow.',
      'Browser/manual QA is required if Option A becomes implementation.',
      'Accessibility risk:',
      'K-265 must preserve keyboard/focus behavior and avoid visual-only meaning.',
      'Runtime coupling risk:',
      'No graph changes should be needed.',
      'Option A is preferred for K-265 if the implementation remains empty-state-only.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits Option B Static Preview continuation', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Option B Audit: Static Preview Continuation',
      'Current static preview component/file path:',
      '`frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.',
      'Current fixture/mock path:',
      '`frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.',
      'Fixture-driven.',
      'Read-only.',
      'Unwired from normal Notes runtime.',
      'Not mounted into normal Notes navigation.',
      'Strong for Cosmos visual grammar refinement.',
      'K-224 provided wrapper-level mobile coverage.',
      'K-232 through K-234 produced the static HTML viewport harness proof path.',
      'Existing preview includes text fallback sections',
      'No route/navigation changes are needed.',
      'No live graph data should be introduced.',
      'Option B is the fallback if Option A appears too coupled or risky.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('compares options and recommends K-265 Option A with Option B fallback', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Side-by-side Comparison',
      'user-visible product impact',
      'implementation risk',
      'runtime coupling',
      'responsive/mobile QA',
      'accessibility QA',
      'graph/persistence risk',
      'product identity gain',
      'reversibility',
      'alignment with K-263 product surface return',
      'required K-265 validation',
      'K-265 Notes Empty State Pixel-Cosmos Product Polish.',
      'small user-facing UI polish.',
      'empty Notes state only.',
      'no route/panel/navigation changes.',
      'no graph changes.',
      'no persistence/store/schema changes.',
      'browser/manual QA required.',
      'K-265 Notes/Cosmos Static Preview Continuation Polish.',
      'isolated/static preview only.',
      'fixture-driven.',
      'no runtime mounting.',
      'K-265 Notes Empty State Pixel-Cosmos Polish Plan.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines K-265 boundaries, grammar criteria, graph preservation, static/runtime boundary, and guardrails', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## K-265 Implementation Boundaries If Option A',
      'touch only empty state/product polish files.',
      'preserve current notes data behavior.',
      'preserve existing actions/buttons.',
      'preserve keyboard/focus behavior.',
      'preserve readable typography.',
      'avoid horizontal overflow.',
      'no `NoteGraphView` changes.',
      'no `LocalGraphView` changes.',
      'no `NotesCosmosStaticPreview` mounting.',
      '## K-265 Implementation Boundaries If Option B',
      'keep fixture-driven.',
      'keep isolated/unwired.',
      'no normal Notes navigation.',
      'no live graph data.',
      'no graph builders.',
      'no `KnowledgeIndexService`.',
      'no persisted coordinates/spatial metadata.',
      'preserve fallback/accessibility.',
      '## Pixel/Cosmos Product Grammar Criteria',
      'pixel is grammar, not decoration.',
      'information-first layout.',
      'readable typography.',
      'productive interactions.',
      'cozy sci-fi / pixel observatory / personal space archive tone.',
      'avoid overdecorated cosmic UI.',
      '## Existing Graph Surface Preservation',
      '`NoteGraphView` remains full-vault graph.',
      '`LocalGraphView` remains local/context graph.',
      'Cosmos Map does not replace either.',
      'K-265 must not alter graph builders.',
      '## Static Preview / Runtime Boundary',
      '`NotesCosmosStaticPreview` remains isolated unless a future milestone explicitly mounts it.',
      'no normal Notes navigation wiring.',
      '390px/mobile proof required before runtime exposure.',
      '## Local-first / Backup Guardrails',
      'local runtime data remains source of truth.',
      'no remote-first hydrate/fetch.',
      'no Data Safety / Backup Health UI.',
      'no Supabase/OAuth/Google Drive behavior changes.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines validation expectations and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Validation Expectations For K-265',
      'If K-265 chooses Option A:',
      'targeted component/unit tests.',
      'accessibility/focus assertions where existing conventions support them.',
      '390px/manual browser QA.',
      'no graph/store/persistence diffs.',
      'If K-265 chooses Option B:',
      'static preview tests.',
      'fixture contract tests.',
      'SSR/static HTML or wrapper-level responsive tests if existing.',
      'no runtime import/wiring source audit.',
      '## Non-goals',
      'no UI implementation in K-264.',
      'no Notes Empty State implementation in K-264.',
      'no Static Preview runtime wiring.',
      'no route/panel/navigation change.',
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
      'no restore preview/dry-run.',
      'no assets/fonts/dependencies.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms source facts for empty-state and static-preview boundaries', () => {
    const editorArea = readFileSync(editorAreaPath, 'utf8');
    const emptyState = readFileSync(emptyStatePath, 'utf8');
    const staticPreview = readFileSync(staticPreviewPath, 'utf8');

    expect(editorArea).toContain('NotesPixelCosmosEmptyState');
    expect(editorArea).toContain('isEmptyVault ?');
    expect(emptyState).toContain('data-notes-pixel-cosmos-empty');
    expect(emptyState).toContain('onCreateNote');
    expect(emptyState).toContain('onOpenTodaysNote');
    expect(emptyState).toContain('onImportVault');
    expect(staticPreview).toContain('notesCosmosStaticPreviewFixture');
    expect(staticPreview).toContain('data-notes-cosmos-static-preview');
    expect(staticPreview).toContain('Text fallback');
  });

  it('confirms K-264 symbols are not referenced from runtime graph or surface files', () => {
    const sources = [
      readFileSync(noteGraphPath, 'utf8'),
      readFileSync(localGraphPath, 'utf8'),
      readFileSync(emptyStatePath, 'utf8'),
      readFileSync(staticPreviewPath, 'utf8'),
      readFileSync(editorAreaPath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('notesCosmosProductSurfaceBoundaryAudit');
      expect(source).not.toContain('K-264 Notes/Cosmos Product Surface Boundary Audit');
      expect(source).not.toContain('K-265 Notes Empty State Pixel-Cosmos Product Polish');
      expect(source).not.toContain('product-surface-boundary-audit');
    }
  });
});
