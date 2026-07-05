import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
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
const noteUtilsPath = join(process.cwd(), 'src', 'components', 'views', 'noteUtils.ts');
const noteListSortPath = join(process.cwd(), 'src', 'components', 'views', 'noteListSort.ts');
const noteDisplayTitlePath = join(process.cwd(), 'src', 'components', 'views', 'noteDisplayTitle.ts');
const noteViewEditorAreaPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const staticPreviewHarnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-280 notes overview signal panel data contract plan', () => {
  it('exists and defines docs/plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-280 Notes Overview / Signal Panel Data Contract Plan',
      'K-280 defines a data contract plan for a future Notes Overview / Signal Panel MVP.',
      'K-280 follows the K-279 data boundary audit',
      'K-280 is docs/plan plus audit test only.',
      'K-280 does not implement UI.',
      'K-280 does not wire runtime data.',
      'K-280 does not add route/nav/panel behavior.',
      'K-280 does not change Notes stores, schemas, persistence, providers, sync, graph builders, backup, or BlockEditor internals.',
      'K-280 does not approve graph/KIS/provider/backup/BlockEditor integration.',
      'K-280 chooses the K-281 next path: Notes Overview / Signal Panel Component Boundary Plan.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-279', () => {
    const doc = readDoc();

    for (const required of [
      'K-278 defined Notes Overview / Signal Panel as a concept-only product surface.',
      'Signal Panel remains an orientation/readout surface, not Cosmos Map',
      'K-279 audited data boundaries and approved only a future local-first boundary for recent notes plus active writing signal readout.',
      'K-279 did not implement runtime UI, did not wire runtime data',
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

  it('defines local-first deterministic contract principles', () => {
    const doc = readDoc();

    for (const required of [
      '## Contract Principles',
      'local-first only.',
      'deterministic.',
      'minimal.',
      'serializable.',
      'derived from already-available note metadata or current note orientation state only.',
      'readable without raw note content.',
      'reversible and component-isolated before runtime mounting.',
      'raw note body.',
      'provider ids.',
      'sync status.',
      'backup/preflight fields.',
      'Data Safety state.',
      'graph/KIS fields.',
      'BlockEditor internals.',
      'schema migration.',
      'new persistence.',
      'remote fetch.',
      'Unavailable data should produce an explicit empty or unavailable state rather than fake signals.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists source-grounded inputs and their limits', () => {
    const doc = readDoc();

    for (const required of [
      '## Source-grounded Inputs',
      '### `frontend/src/components/views/NoteView.tsx`',
      'selects `notes` from `useNotesStore`.',
      'selects `activeNoteId` from `useNotesStore`.',
      'derives `activeNote` from local `notes` and `activeNoteId`.',
      'derives `activeNotes` by filtering out notes with `deletedAt`.',
      'derives `isEmptyVault` from the active non-deleted note count.',
      'What this does not approve:',
      'changing `NoteView.tsx`.',
      'querying global stores inside a future component.',
      '### `frontend/src/components/views/noteUtils.ts`',
      '`NoteBase` includes `id`, `title`, `body`, `createdAt`, `updatedAt`, `folderId`, `deletedAt`, `starred`, `properties`, and `relations`.',
      'raw `body` in the contract.',
      '`relations` intelligence.',
      '### `frontend/src/components/views/noteListSort.ts`',
      'default note sort field is `updated`.',
      'default note sort direction is `desc`.',
      'updated sorting compares `updatedAt`.',
      '### `frontend/src/components/views/noteDisplayTitle.ts`',
      '`displayNoteTitle` trims note titles.',
      'blank titles and legacy `Untitled` use the existing localized untitled-note fallback.',
      '### `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`',
      'receives `activeNote` and `activeNoteId`.',
      'renders `NotesPixelCosmosEmptyState` for empty vault.',
      'BlockEditor internals.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines RecentNotes contract and rules', () => {
    const doc = readDoc();

    for (const required of [
      '## RecentNotes Contract',
      'type SignalPanelRecentNote = {',
      'id: string;',
      'title: string;',
      'updatedAt: number;',
      'createdAt?: number;',
      'folderId?: string | null;',
      'starred?: boolean;',
      "signalLabel: 'recent';",
      '`id` comes from existing local note metadata.',
      '`title` uses existing display title fallback behavior.',
      '`updatedAt` comes from existing local note metadata and is required for the first contract.',
      'notes with `deletedAt` are excluded.',
      'default cap recommendation is 5.',
      'sorting is deterministic updated-desc by `updatedAt`.',
      'raw body/content.',
      'provider id.',
      'graph fields.',
      'relationship fields.',
      'attachment blob fields.',
      'backup fields.',
      'sync state.',
      'semantic score.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines ActiveWriting contract and rules', () => {
    const doc = readDoc();

    for (const required of [
      '## ActiveWriting Contract',
      'type SignalPanelActiveWriting = {',
      "state: 'active' | 'idle' | 'unavailable';",
      'currentNoteId?: string;',
      'currentNoteTitle?: string;',
      'lastEditedAt?: number;',
      'derived only from already-exposed current note orientation state.',
      '`active` means a non-deleted active note is available.',
      '`idle` means notes exist but no safe current note is available.',
      '`unavailable` means the future adapter cannot safely determine current note orientation.',
      '`currentNoteTitle` uses existing display title fallback behavior.',
      '`lastEditedAt` may use active note `updatedAt`.',
      'no raw body inspection.',
      'no BlockEditor internals.',
      'no cursor position.',
      'no editor selection.',
      'no dirty-state coupling.',
      'no keystroke/activity tracking.',
      'unavailable is valid and should not be treated as an error.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines empty and unavailable states', () => {
    const doc = readDoc();

    for (const required of [
      '## Empty / Unavailable States',
      'type SignalPanelEmptyState = {',
      'hasNotes: boolean;',
      'noteCount: number;',
      "reason: 'empty-vault' | 'ready' | 'unavailable';",
      'no notes: Signal Panel should not duplicate Empty State; Empty State remains primary.',
      'notes exist but recent data is unavailable: show unavailable/degraded state, not fake signals.',
      'active writing unavailable: show unavailable or omit the active writing readout.',
      'loading-like state is allowed only if current runtime already exposes a safe local loading state',
      'error-like state is allowed only for local read failure',
      'all states must be accessible and readable.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines display title fallback and sort limit rules', () => {
    const doc = readDoc();

    for (const required of [
      '## Display Title Fallback Rule',
      'Use existing `displayNoteTitle` or equivalent behavior confirmed by `noteDisplayTitle.ts`.',
      'trim note titles.',
      'treat blank titles as untitled.',
      'treat legacy `Untitled` as untitled.',
      'use the existing localized untitled-note fallback.',
      'never expose blank title when fallback exists.',
      'do not inspect raw body just to generate a title.',
      'do not invent AI summaries.',
      'keep fallback deterministic.',
      '## Sort / Limit Rule',
      'start from local notes only.',
      'exclude notes with `deletedAt`.',
      'require valid `updatedAt`.',
      'sort by `updatedAt` descending.',
      'break ties deterministically in a future adapter plan',
      'cap to a small fixed count.',
      'const SIGNAL_PANEL_RECENT_NOTES_LIMIT = 5;',
      'randomized ordering.',
      'remote scoring.',
      'semantic ranking.',
      'graph relationship ranking.',
      '`KnowledgeIndexService` ranking.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists forbidden fields explicitly', () => {
    const doc = readDoc();

    for (const required of [
      '## Forbidden Fields',
      'raw note body/content.',
      'body excerpts.',
      'AI summaries.',
      'embeddings.',
      'vector fields.',
      'semantic similarity score.',
      'graph coordinates.',
      'orbit coordinates.',
      'spatial coordinates.',
      'relationship strength.',
      'cluster ids.',
      'theme ids.',
      '`KnowledgeIndexService` output.',
      'graph builder output.',
      'provider ids.',
      'Supabase row ids unless separately audited and identical to local ids.',
      'sync status.',
      'backup/preflight diagnostics.',
      'Data Safety state.',
      'OAuth state.',
      'Google Drive state.',
      'attachment blob data.',
      'restore/import/export state.',
      'BlockEditor internal document model.',
      'keystroke/activity analytics.',
      'background sync metadata.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines combined draft data contract and component boundary', () => {
    const doc = readDoc();

    for (const required of [
      '## Draft Data Contract',
      'type SignalPanelDataDraft = {',
      "generatedFrom: 'local-note-metadata';",
      'emptyState: SignalPanelEmptyState;',
      'recentNotes: SignalPanelRecentNote[];',
      'activeWriting: SignalPanelActiveWriting;',
      '`generatedFrom` must not imply provider, remote, backup, graph, or editor-internal sources.',
      'contract is draft and not yet runtime-wired.',
      'keep the contract serializable and deterministic.',
      'no functions in the data contract.',
      'no React component state in the data contract.',
      'no raw store object exposure.',
      'no raw note objects.',
      '## Contract-to-component Boundary',
      'future Signal Panel should receive prepared data via props first.',
      'a future adapter may be planned separately.',
      'the component should not query global stores directly in its first implementation.',
      'no route/nav/panel change for first isolated implementation.',
      'no runtime exposure until boundary and QA are approved.',
      '390px/browser QA is required before runtime mounting.',
      'accessibility and semantic grouping are required before runtime mounting.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines future validation expectations and K-281 recommendation', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Expectations For Future Implementation',
      'unit tests for contract transformation.',
      'recent notes filter tests.',
      'updated-desc sort tests.',
      'limit tests.',
      'display title fallback tests.',
      'active writing active/idle/unavailable tests.',
      'empty vault tests.',
      'no raw body/provider/backup/graph fields test.',
      '390px/browser QA before runtime exposure.',
      'diff check for no route/nav/panel/store/schema changes unless explicitly scoped.',
      '## K-281 Decision',
      '**K-281 Notes Overview / Signal Panel Component Boundary Plan**',
      'docs/plan plus audit test only.',
      'define isolated component props using the K-280 data contract.',
      'no implementation.',
      'no runtime data wiring.',
      'Data Adapter Source Facts Audit',
      'Contract Fixture Spec',
      'Not recommended:',
      'immediate runtime implementation.',
      'global store querying inside component.',
      'graph/KIS/provider/backup integration.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no Signal Panel UI implementation in K-280.',
      'no Notes Overview component.',
      'no Signal Panel component.',
      'no runtime data wiring.',
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
      'no Health/Schedule behavior change.',
      'no assets/fonts/dependencies.',
      'no generated artifacts.',
      '## Closure Statement',
      'K-280 defines a draft data contract only.',
      'K-280 does not approve runtime wiring.',
      'The first future Signal Panel scope remains recent notes plus active writing signal readout.',
      'Graph/KIS/provider/backup/BlockEditor internals remain forbidden.',
      'The contract should feed a future isolated component via props before any runtime mount.',
      'Existing graph surfaces remain preserved.',
      'Empty State and Static Preview lines remain closed.',
      'Signal Panel remains orientation/readout, not Cosmos Map or graph replacement.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('anchors to K-279/K-278/K-277/K-269 docs and current source files', () => {
    expect(existsSync(k279DocPath)).toBe(true);
    expect(existsSync(k278DocPath)).toBe(true);
    expect(existsSync(k277DocPath)).toBe(true);
    expect(existsSync(k269DocPath)).toBe(true);
    expect(existsSync(noteViewPath)).toBe(true);
    expect(existsSync(noteUtilsPath)).toBe(true);
    expect(existsSync(noteListSortPath)).toBe(true);
    expect(existsSync(noteDisplayTitlePath)).toBe(true);
    expect(existsSync(noteViewEditorAreaPath)).toBe(true);

    const k279Doc = readSource(k279DocPath);
    expect(k279Doc).toContain('K-279 chooses the K-280 next path: Notes Overview / Signal Panel Data Contract Plan.');
    expect(k279Doc).toContain('K-279 approves only a narrow future data boundary: local recent-note metadata plus simple active-note orientation.');

    const noteView = readSource(noteViewPath);
    expect(noteView).toContain('const notes = useNotesStore(s => s.notes);');
    expect(noteView).toContain('const activeNoteId = useNotesStore(s => s.activeNoteId);');
    expect(noteView).toContain('notes.find(n => n.id === activeNoteId) ?? null');
    expect(noteView).toContain('const activeNotes = useMemo(() => notes.filter(n => !n.deletedAt), [notes]);');
    expect(noteView).toContain('const isEmptyVault = activeNoteCount === 0 && activeFolderId !== \'trash\';');

    const noteUtils = readSource(noteUtilsPath);
    for (const required of [
      'export interface NoteBase',
      'id: string;',
      'title: string;',
      'body: string;',
      'createdAt?: number;',
      'updatedAt: number;',
      'folderId: string | null;',
      'deletedAt: number | null;',
      'starred?: boolean;',
      'properties?: Record<string, string>;',
      'relations?: Record<string, string[]>;',
    ]) {
      expect(noteUtils).toContain(required);
    }

    const sortSource = readSource(noteListSortPath);
    expect(sortSource).toContain("export const DEFAULT_NOTE_SORT_FIELD: NoteSortField = 'updated';");
    expect(sortSource).toContain("export const DEFAULT_NOTE_SORT_DIRECTION: NoteSortDirection = 'desc';");
    expect(sortSource).toContain('return sign * (a.updatedAt - b.updatedAt);');

    const titleSource = readSource(noteDisplayTitlePath);
    expect(titleSource).toContain('export function displayNoteTitle(');
    expect(titleSource).toContain('resolveUntitledNoteLabel(language)');

    const editorArea = readSource(noteViewEditorAreaPath);
    expect(editorArea).toContain('activeNote: Note | null;');
    expect(editorArea).toContain('activeNoteId: string | null;');
    expect(editorArea).toContain('<NotesPixelCosmosEmptyState');
    expect(editorArea).toContain('<BlockEditor');
  });

  it('does not leave generated static harness output in the working tree', () => {
    expect(existsSync(staticPreviewHarnessOutputPath)).toBe(false);
  });
});
