import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-279-notes-overview-signal-panel-data-boundary-audit.md',
);
const k278DocPath = join(process.cwd(), 'docs', 'K-278-notes-overview-signal-panel-concept-plan.md');
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

describe('K-279 notes overview signal panel data boundary audit', () => {
  it('exists and defines docs/audit-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-279 Notes Overview / Signal Panel Data Boundary Audit',
      'K-279 audits data boundaries for a future Notes Overview / Signal Panel.',
      'K-279 follows K-278',
      'K-279 is docs/audit plus audit test only.',
      'K-279 does not implement UI.',
      'K-279 does not add route/nav/panel behavior.',
      'K-279 does not wire runtime data.',
      'K-279 does not change Notes stores, schemas, persistence, providers, sync, backup, graph builders, or editor internals.',
      'K-279 does not implement Runtime Cosmos Map.',
      'K-279 chooses the K-280 next path: Notes Overview / Signal Panel Data Contract Plan.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state and preserves existing surface boundaries', () => {
    const doc = readDoc();

    for (const required of [
      'K-278 defined Signal Panel as an orientation/readout surface',
      'K-265 through K-269 closed the Notes Empty State Pixel-Cosmos product polish line.',
      'Empty State remains the primary surface for an empty vault.',
      'K-270 through K-277 closed the isolated Static Preview visual grammar/accessibility/viewport proof line.',
      '`NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, unwired, and not product data.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'Backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines local-first data boundary principles', () => {
    const doc = readDoc();

    for (const required of [
      'The future Signal Panel should read from existing local-first Notes runtime data only.',
      'a new store field.',
      'a schema or persistence migration.',
      'remote-first hydrate/fetch.',
      'Supabase, OAuth, Google Drive, or provider state.',
      'backup/export/import/restore data.',
      'graph builder changes.',
      '`KnowledgeIndexService` coupling.',
      'persisted coordinates, orbits, spatial metadata, or map layout state.',
      'editor-internal coupling.',
      'Every signal must be explainable, reversible, and safe for empty, small, and large vaults.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('approves only existing local note metadata and active-note orientation for the first contract', () => {
    const doc = readDoc();

    for (const required of [
      '## Approved Read Sources For First Data Contract',
      '### Local Notes Collection',
      '`frontend/src/components/views/NoteView.tsx` already selects `notes` from `useNotesStore`.',
      'count active local notes.',
      'filter out deleted notes with `deletedAt`.',
      'derive recent note candidates from local metadata.',
      'cap output to a small deterministic list.',
      '### Note Metadata',
      '`frontend/src/components/views/noteUtils.ts` defines `NoteBase`',
      '`id`.',
      'display title derived from `title`.',
      '`updatedAt`.',
      '`createdAt` when present.',
      '`deletedAt` for exclusion.',
      '`folderId` only as optional lightweight context.',
      '`starred` only as optional lightweight context.',
      'raw `body` content.',
      '`relations` intelligence.',
      '### Display Title Fallback',
      '`frontend/src/components/views/noteDisplayTitle.ts` already provides display title fallback behavior',
      '### Existing Sorting Semantics',
      '`frontend/src/components/views/noteListSort.ts` defines default updated-desc sorting semantics',
      '### Active Note Runtime State',
      '`frontend/src/components/views/NoteView.tsx` already selects `activeNoteId`',
      '`frontend/src/components/views/noteview/NoteViewEditorArea.tsx` already receives `activeNote` and `activeNoteId`.',
      'simple unavailable/empty states.',
      'editor dirty state unless separately audited.',
      'BlockEditor internals.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('marks high-coupling and non-local sources as caution or forbidden', () => {
    const doc = readDoc();

    for (const required of [
      '## Caution Sources Requiring Separate Audit',
      '`frontend/src/components/views/noteview/useNoteViewState.ts` exposes local UI state',
      '`frontend/src/components/views/noteview/useNoteViewDashboard.ts` uses history, timeline, discovery, dashboard, and `knowledgeIndexService` helpers.',
      'These are high-coupling sources and are not approved for first MVP Signal Panel data.',
      '`frontend/src/components/views/NoteGraphView.tsx` and `frontend/src/components/views/features/knowledge/graph/LocalGraphView.tsx` remain existing graph surfaces.',
      'They are not data dependencies for the first Signal Panel contract.',
      'Neglected notes, isolated notes, resurfacing, clusters, themes, local/context relationships, and graph intelligence need a future graph/index data audit',
      'Attachment traces, reference traces, blob/provider state, and backup-adjacent signals are deferred.',
      '## Forbidden Sources For First MVP',
      'Supabase reads or writes.',
      'remote provider state.',
      'Google Drive OAuth/session/upload/recovery state.',
      'backup/export/import/restore/preflight diagnostics.',
      'Data Safety status.',
      'attachment blob inventory, recovery, cleanup, or sync queue state.',
      '`KnowledgeIndexService`.',
      'graph builders.',
      '`NoteGraphView` implementation details.',
      '`LocalGraphView` implementation details.',
      'Runtime Cosmos Map data.',
      'BlockEditor internals.',
      'new persistence fields.',
      'new indexes.',
      'new background sync.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('records recent notes and active writing boundary decisions', () => {
    const doc = readDoc();

    for (const required of [
      '## Recent Notes Boundary Decision',
      'Recent notes are approved as the safest first Signal Panel signal if K-280 defines a narrow data contract.',
      'input: local notes array.',
      'filter: exclude notes with `deletedAt`.',
      'sort: `updatedAt` descending',
      'shape: `id`, display title, `updatedAt`, optional `createdAt`, optional lightweight folder/starred labels.',
      'limit: small fixed count.',
      'body scans.',
      'relationship scoring.',
      'provider metadata.',
      'backup metadata.',
      'remote fetch.',
      'graph/index dependency.',
      '## Active Writing Boundary Decision',
      'Active writing readout is approved only as a simple current-note orientation signal.',
      'input: `activeNoteId` plus local notes array, or already-derived `activeNote`.',
      'shape: active/unavailable, note id, display title, `updatedAt`, optional deleted-state guard.',
      'dirty/editor state.',
      'cursor position.',
      'editor selection.',
      'BlockEditor coupling.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines graph/index boundary, product surface boundaries, and the K-280 next path', () => {
    const doc = readDoc();

    for (const required of [
      '## Graph And Index Boundary',
      'K-279 does not approve any graph or index dependency for the first Signal Panel MVP.',
      '`NoteGraphView` remains the full-vault graph.',
      '`LocalGraphView` remains the local/context graph.',
      'Signal Panel must not call graph builders or `KnowledgeIndexService` for the first data contract.',
      '## Product Surface Boundaries',
      'Signal Panel is Notes-scoped and should remain separate from:',
      'Empty State first-note onboarding.',
      'Static Preview fixture/component.',
      'full-vault graph.',
      'local/context graph.',
      'Runtime Cosmos Map.',
      'Home Signal Board.',
      'Archive Voyager.',
      'Data Safety / Backup Health.',
      '## K-280 Decision',
      '**K-280 Notes Overview / Signal Panel Data Contract Plan**',
      'docs/plan plus audit test.',
      'define exact first contract for recent notes and active writing.',
      'no UI implementation.',
      'no runtime mounting.',
      'no store/schema/persistence/provider changes.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('proposes a first contract without forbidden fields', () => {
    const doc = readDoc();

    for (const required of [
      'type NotesOverviewSignalPanelData = {',
      'empty: boolean;',
      'recentNotes: Array<{',
      'id: string;',
      'title: string;',
      'updatedAt: number;',
      'createdAt?: number;',
      'folderId?: string | null;',
      'starred?: boolean;',
      'activeWriting: {',
      "status: 'empty' | 'inactive' | 'active';",
      'The contract should not include raw note body, provider ids, backup status, graph coordinates, graph score, cluster id, relationship score, attachment blobs, sync status, or editor-internal state.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('anchors the audit to current source facts without changing runtime files', () => {
    expect(existsSync(k278DocPath)).toBe(true);
    expect(existsSync(noteViewPath)).toBe(true);
    expect(existsSync(noteUtilsPath)).toBe(true);
    expect(existsSync(noteListSortPath)).toBe(true);
    expect(existsSync(noteDisplayTitlePath)).toBe(true);
    expect(existsSync(noteViewEditorAreaPath)).toBe(true);
    expect(existsSync(noteGraphPath)).toBe(true);
    expect(existsSync(localGraphPath)).toBe(true);

    const noteView = readSource(noteViewPath);
    expect(noteView).toContain('const notes = useNotesStore(s => s.notes);');
    expect(noteView).toContain('const folders = useNotesStore(s => s.folders);');
    expect(noteView).toContain('const activeNoteId = useNotesStore(s => s.activeNoteId);');
    expect(noteView).toContain('const activeNote = useMemo(');
    expect(noteView).toContain('notes.find(n => n.id === activeNoteId) ?? null');
    expect(noteView).toContain('notes.filter(n => !n.deletedAt)');

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
    expect(sortSource).toContain("export type NoteSortField = 'updated' | 'title' | 'created' | 'folder';");
    expect(sortSource).toContain("export const DEFAULT_NOTE_SORT_FIELD: NoteSortField = 'updated';");
    expect(sortSource).toContain('return sign * (a.updatedAt - b.updatedAt);');

    const displayTitleSource = readSource(noteDisplayTitlePath);
    expect(displayTitleSource).toContain('export function displayNoteTitle(');
    expect(displayTitleSource).toContain('resolveUntitledNoteLabel(language)');

    const editorArea = readSource(noteViewEditorAreaPath);
    expect(editorArea).toContain('activeNote: Note | null;');
    expect(editorArea).toContain('activeNoteId: string | null;');
    expect(editorArea).toContain('<NotesPixelCosmosEmptyState');
  });

  it('keeps generated static harness output absent', () => {
    expect(existsSync(staticPreviewHarnessOutputPath)).toBe(false);
  });

  it('records non-goals and closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no runtime UI implementation.',
      'no Notes Overview component.',
      'no Signal Panel component.',
      'no route/nav/panel behavior.',
      'no live runtime mounting.',
      'no `NotesCosmosStaticPreview` changes.',
      'no `NotesPixelCosmosEmptyState` changes.',
      'no `NoteGraphView` changes.',
      'no `LocalGraphView` changes.',
      'no graph builder changes.',
      'no `KnowledgeIndexService` coupling.',
      'no Notes store changes.',
      'no schema changes.',
      'no persistence changes.',
      'no provider/sync changes.',
      'no backup/export/import/restore changes.',
      'no Data Safety UI.',
      'no attachment/blob behavior.',
      'no BlockEditor changes.',
      'no browser QA requirement.',
      '## Closure Statement',
      'K-279 approves only a narrow future data boundary: local recent-note metadata plus simple active-note orientation.',
      'Everything else remains deferred or forbidden until separately audited.',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
