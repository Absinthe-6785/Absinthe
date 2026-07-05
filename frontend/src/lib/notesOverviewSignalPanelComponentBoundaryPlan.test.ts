import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-281-notes-overview-signal-panel-component-boundary-plan.md',
);
const k280DocPath = join(
  process.cwd(),
  'docs',
  'K-280-notes-overview-signal-panel-data-contract-plan.md',
);
const k279DocPath = join(
  process.cwd(),
  'docs',
  'K-279-notes-overview-signal-panel-data-boundary-audit.md',
);
const k278DocPath = join(process.cwd(), 'docs', 'K-278-notes-overview-signal-panel-concept-plan.md');
const k277DocPath = join(
  process.cwd(),
  'docs',
  'K-277-notes-cosmos-static-preview-visual-grammar-closure-audit.md',
);
const k269DocPath = join(
  process.cwd(),
  'docs',
  'K-269-notes-empty-state-pixel-cosmos-follow-up-closure-audit.md',
);
const noteViewPath = join(process.cwd(), 'src', 'components', 'views', 'NoteView.tsx');
const noteViewEditorAreaPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const noteUtilsPath = join(process.cwd(), 'src', 'components', 'views', 'noteUtils.ts');
const noteListSortPath = join(process.cwd(), 'src', 'components', 'views', 'noteListSort.ts');
const noteDisplayTitlePath = join(process.cwd(), 'src', 'components', 'views', 'noteDisplayTitle.ts');
const emptyStatePath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NotesPixelCosmosEmptyState.tsx',
);
const staticPreviewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
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
const staticPreviewHarnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-281 notes overview signal panel component boundary plan', () => {
  it('exists and defines docs/plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-281 Notes Overview / Signal Panel Component Boundary Plan',
      'K-281 defines the component boundary for a future Notes Overview / Signal Panel.',
      'K-281 follows the K-280 data contract plan',
      'K-281 is docs/plan plus audit test only.',
      'K-281 does not implement UI.',
      'K-281 does not create runtime types/exports.',
      'K-281 does not wire runtime data.',
      'K-281 does not add route/nav/panel behavior.',
      'K-281 does not create a data adapter.',
      'K-281 does not change stores, schemas, persistence, providers, sync, graph builders, backup, or BlockEditor internals.',
      'K-281 chooses the K-282 next path: Notes Overview / Signal Panel Contract Fixture Spec.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-280', () => {
    const doc = readDoc();

    for (const required of [
      'K-278 defined Notes Overview / Signal Panel as a concept-only product surface.',
      'Signal Panel remains an orientation/readout surface, not Cosmos Map',
      'K-279 audited local-first data boundaries for a future Signal Panel MVP.',
      'K-280 defined a draft recent notes plus active writing data contract in docs only.',
      'K-280 did not add runtime type/export.',
      'K-280 did not implement UI.',
      'K-280 did not wire runtime data.',
      'The Empty State line remains closed.',
      '`NotesPixelCosmosEmptyState` remains the productized empty-vault Notes/Cosmos surface',
      'The Static Preview line remains closed.',
      '`NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, unwired, and not product data.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'Backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines component boundary principles', () => {
    const doc = readDoc();

    for (const required of [
      '## Component Boundary Principles',
      'props-first.',
      'deterministic from passed props.',
      'presentational by default.',
      'isolated before any runtime mount.',
      'accessible through semantic grouping.',
      'responsive by default.',
      'explicit about empty and unavailable states.',
      'readable without raw note content.',
      'read global stores directly.',
      'create a runtime data adapter inside the component.',
      'call provider/network APIs.',
      'read backup/preflight diagnostics.',
      'read graph builders.',
      'read `KnowledgeIndexService`.',
      'read BlockEditor internals.',
      'inspect raw note body/content.',
      'mutate persistence.',
      'mutate Notes stores.',
      'mount itself into normal Notes runtime.',
      'Mounting requires a later explicit gate and fresh browser/390px QA.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines proposed component role and provisional naming', () => {
    const doc = readDoc();

    for (const required of [
      '## Proposed Component Role',
      'NotesOverviewSignalPanel',
      'NotesSignalPanel',
      'render recent notes signal readout.',
      'render active writing signal readout.',
      'render empty/unavailable states.',
      'communicate orientation, not graph intelligence.',
      'help users return to writing and thinking.',
      'avoid dashboard bloat.',
      'avoid duplicate Empty State onboarding.',
      'avoid Cosmos Map implications.',
      'avoid graph replacement implications.',
      'name is provisional.',
      'no component is created in K-281.',
      'no runtime export is created in K-281.',
      'no runtime type is created in K-281.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines proposed props boundary', () => {
    const doc = readDoc();

    for (const required of [
      '## Proposed Props Boundary',
      'type NotesSignalPanelProps = {',
      'data: SignalPanelDataDraft;',
      'onSelectRecentNote?: (noteId: string) => void;',
      'onCreateNote?: () => void;',
      '`data` follows the K-280 draft contract.',
      'props are plain serializable data plus optional callbacks.',
      'callbacks are optional and may be deferred.',
      'first isolated implementation may be read-only.',
      'no navigation behavior should be assumed.',
      'no callbacks should be wired until mount/routing is approved.',
      'no store object.',
      'no service object.',
      'no graph object.',
      'no provider client.',
      'no editor instance.',
      'no BlockEditor object.',
      'no backup/preflight object.',
      'no raw note object.',
      'no raw folder object.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends read-only first', () => {
    const doc = readDoc();

    for (const required of [
      '## Read-only First Recommendation',
      'The first component prototype should be read-only.',
      'create callbacks unless explicitly scoped.',
      'select callbacks unless explicitly scoped.',
      'route/navigation behavior.',
      'panel mounting.',
      'editor coupling.',
      'persistence mutation.',
      'analytics.',
      'provider calls.',
      'keeps component isolated.',
      'allows visual and semantic testing.',
      'avoids route/nav/data-wiring risk.',
      'preserves the K-280 contract boundary.',
      'allows a fixture-first proof before product runtime exposure.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines semantic structure plan and empty/unavailable display boundary', () => {
    const doc = readDoc();

    for (const required of [
      '## Semantic Structure Plan',
      'a panel heading.',
      'a short orientation summary.',
      'a recent notes group.',
      'an active writing group.',
      'an empty/unavailable fallback group.',
      'source/fixture status if using fixtures.',
      'accessible labels for signal tiers.',
      'primary/secondary/faint hierarchy through text and structure.',
      'use sections or grouped regions with readable headings.',
      'expose signal meaning as text, not color-only.',
      'no essential information should be purely visual.',
      'content must remain readable at narrow viewport.',
      '## Empty / Unavailable Display Boundary',
      'True empty vault should defer to Empty State.',
      'Signal Panel should not duplicate full Empty State onboarding.',
      'show a minimal unavailable/empty note, not the full first-note onboarding surface.',
      'active writing unavailable is valid.',
      'recent notes unavailable is valid.',
      'unavailable states should not fake signals.',
      'loading should not imply remote/provider fetch.',
      'error should not imply backup/provider failure.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines visual product grammar boundary and fixture test strategy', () => {
    const doc = readDoc();

    for (const required of [
      '## Visual / Product Grammar Boundary',
      'pixel is grammar, not decoration.',
      'information-first layout.',
      'readable typography.',
      'native accessibility.',
      'signal hierarchy: primary/secondary/faint.',
      'signal/readout language clarifies state.',
      'cozy sci-fi / pixel observatory / personal archive tone.',
      'avoid overdecorated cosmic UI.',
      'avoid generic AI SaaS look.',
      'do not hide writing actions behind spectacle.',
      'do not imply Cosmos Map.',
      'do not imply graph intelligence before graph/index audit.',
      '## Fixture And Test Strategy',
      'deterministic fixtures based on the K-280 contract.',
      'recent notes fixture with 2-4 items.',
      'active writing active fixture.',
      'active writing idle fixture.',
      'active writing unavailable fixture.',
      'empty/unavailable fixture.',
      'untitled recent note fixture for title fallback behavior.',
      'forbidden-fields-absent fixture check.',
      'render tests for panel heading.',
      'render tests for recent notes group.',
      'render tests for active writing group.',
      'render tests that raw body/provider/graph/backup fields are absent.',
      'wrapper-level 390px/static proof before runtime exposure.',
      'Browser QA is not required until UI implementation or runtime mount.',
      'Generated static proof artifacts must not be committed.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines runtime placement and data adapter boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Runtime Placement Boundary',
      'K-281 approves no runtime placement.',
      'normal Notes runtime mount.',
      'route/nav/panel.',
      'normal Notes navigation change.',
      'hidden/default panel.',
      '`NoteView.tsx` insertion.',
      '`NoteViewEditorArea.tsx` insertion.',
      'product runtime exposure.',
      'Static Preview runtime mounting.',
      'graph surface replacement.',
      'Future mount requires:',
      'separate K milestone.',
      'browser/390px QA.',
      'accessibility review.',
      'The first implementation, if any, should remain isolated and unmounted.',
      '## Data Adapter Boundary',
      'K-281 does not create an adapter.',
      'adapter should be separate from the presentational component.',
      'adapter must be audited before runtime wiring.',
      'adapter must use K-280 allowed fields only.',
      'adapter must not query graph builders.',
      'adapter must not query `KnowledgeIndexService`.',
      'adapter must not query provider/sync state.',
      'adapter must not query backup/preflight diagnostics.',
      'adapter must not inspect BlockEditor internals.',
      'adapter must not mutate stores.',
      'adapter must not mutate persistence.',
      'adapter must be deterministic and local-first.',
      'adapter must output the props contract, not raw store objects.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines relationship to existing surfaces and K-282 recommendation', () => {
    const doc = readDoc();

    for (const required of [
      '## Relationship To Existing Surfaces',
      'Empty State remains primary for empty vault.',
      'Static Preview remains an isolated concept artifact.',
      'Signal Panel does not reuse, mount, or depend on `NotesCosmosStaticPreview`.',
      '`NoteGraphView` remains the full-vault graph.',
      'Signal Panel does not replace it and does not depend on its implementation details.',
      '`LocalGraphView` remains the local/context graph.',
      'Home Signal Board is a broader cross-surface concept.',
      'Signal Panel remains Notes-scoped orientation/readout.',
      'Archive Voyager remains a time-distance/archive concept.',
      '## K-282 Decision',
      '**K-282 Notes Overview / Signal Panel Contract Fixture Spec**',
      'docs/spec plus audit test.',
      'define deterministic fixture for future isolated component.',
      'define active, idle, unavailable, and empty fixture cases.',
      'define forbidden fixture fields.',
      'no implementation.',
      'no runtime wiring.',
      'Isolated Component Plan',
      'Isolated Component Skeleton',
      'small component implementation.',
      'fixture-driven props only.',
      'read-only.',
      'no runtime mount.',
      'no data adapter.',
      'requires Codex 5.5 high.',
      'Not recommended:',
      'immediate runtime mounting.',
      'adapter plus component in the same PR.',
      'graph/KIS/provider/backup integration.',
      'Runtime Cosmos Map.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no Signal Panel UI implementation in K-281.',
      'no Notes Overview component.',
      'no Signal Panel component.',
      'no runtime type/export.',
      'no runtime data wiring.',
      'no data adapter.',
      'no route/nav/panel change.',
      'no NoteView changes.',
      'no NoteViewEditorArea changes.',
      'no noteUtils changes.',
      'no noteListSort changes.',
      'no noteDisplayTitle changes.',
      'no Notes store changes.',
      'no persistence/schema change.',
      'no NotesCosmosStaticPreview changes.',
      'no Empty State changes.',
      'no Runtime Cosmos Map implementation.',
      'no graph replacement.',
      'no NoteGraphView change.',
      'no LocalGraphView change.',
      'no graph builder change.',
      'no KnowledgeIndexService coupling.',
      'no live graph/index integration.',
      'no provider/network/background sync.',
      'no Supabase/OAuth/Google Drive behavior change.',
      'no backup/preflight runtime implementation.',
      'no Data Safety / Backup Health UI.',
      'no export/import/restore behavior change.',
      'no attachment blob/provider behavior.',
      'no BlockEditor internals.',
      'no Health/Schedule behavior change.',
      'no assets/fonts/dependencies.',
      'no generated artifacts.',
      '## Closure Statement',
      'K-281 defines a props-first component boundary only.',
      'K-281 does not implement or mount Signal Panel.',
      'A future component should be isolated, read-only first, and deterministic from K-280 contract data.',
      'Adapter/runtime wiring must be separate and later.',
      'Graph/KIS/provider/backup/BlockEditor internals remain forbidden.',
      'Signal Panel remains orientation/readout, not Cosmos Map or graph replacement.',
      'Existing graph surfaces remain preserved.',
      'Empty State and Static Preview lines remain closed.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('anchors to prior docs and existing source files without adding runtime code', () => {
    for (const path of [
      k280DocPath,
      k279DocPath,
      k278DocPath,
      k277DocPath,
      k269DocPath,
      noteViewPath,
      noteViewEditorAreaPath,
      noteUtilsPath,
      noteListSortPath,
      noteDisplayTitlePath,
      emptyStatePath,
      staticPreviewPath,
      noteGraphPath,
      localGraphPath,
    ]) {
      expect(existsSync(path)).toBe(true);
    }

    const k280Doc = readSource(k280DocPath);
    expect(k280Doc).toContain('K-280 chooses the K-281 next path: Notes Overview / Signal Panel Component Boundary Plan.');
    expect(k280Doc).toContain('future Signal Panel should receive prepared data via props first.');
    expect(k280Doc).toContain('the component should not query global stores directly in its first implementation.');

    const noteView = readSource(noteViewPath);
    expect(noteView).toContain('const notes = useNotesStore(s => s.notes);');
    expect(noteView).toContain('const activeNoteId = useNotesStore(s => s.activeNoteId);');
    expect(noteView).toContain('notes.find(n => n.id === activeNoteId) ?? null');

    const editorArea = readSource(noteViewEditorAreaPath);
    expect(editorArea).toContain('activeNote: Note | null;');
    expect(editorArea).toContain('activeNoteId: string | null;');
    expect(editorArea).toContain('<NotesPixelCosmosEmptyState');
    expect(editorArea).toContain('<BlockEditor');

    const emptyState = readSource(emptyStatePath);
    expect(emptyState).toContain('export interface NotesPixelCosmosEmptyStateProps');
    expect(emptyState).toContain('role="status"');
    expect(emptyState).toContain('aria-label="Notes empty state"');

    const staticPreview = readSource(staticPreviewPath);
    expect(staticPreview).toContain('type NotesCosmosStaticPreviewProps');
    expect(staticPreview).toContain('fixture?: NotesCosmosPreviewFixture;');
    expect(staticPreview).toContain('Signal readout');
  });

  it('does not leave generated static harness output in the working tree', () => {
    expect(existsSync(staticPreviewHarnessOutputPath)).toBe(false);
  });
});
