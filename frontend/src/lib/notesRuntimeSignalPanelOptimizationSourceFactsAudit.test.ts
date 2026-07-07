import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const srcRoot = join(root, 'src');
const componentsRoot = join(srcRoot, 'components');
const notesRoot = join(componentsRoot, 'notes');
const noteViewsRoot = join(componentsRoot, 'views');
const noteviewRoot = join(noteViewsRoot, 'noteview');
const libRoot = join(srcRoot, 'lib');
const storeRoot = join(srcRoot, 'store');

const docPath = join(docsRoot, 'K-311-notes-runtime-signal-panel-optimization-source-facts-audit.md');
const k310DocPath = join(docsRoot, 'K-310-notes-overview-signal-panel-authenticated-visual-qa-closure.md');
const k309DocPath = join(docsRoot, 'K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md');
const containerPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.tsx');
const containerTestPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.test.ts');
const adapterPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.ts');
const adapterTestPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.test.ts');
const signalPanelPath = join(notesRoot, 'NotesOverviewSignalPanel.tsx');
const signalPanelTestPath = join(notesRoot, 'NotesOverviewSignalPanel.test.ts');
const noteViewSidebarPath = join(noteviewRoot, 'NoteViewSidebar.tsx');
const workspaceDashboardPath = join(
  noteViewsRoot,
  'features',
  'knowledge',
  'components',
  'WorkspaceDashboardView.tsx',
);
const noteViewPath = join(noteViewsRoot, 'NoteView.tsx');
const noteViewEditorAreaPath = join(noteviewRoot, 'NoteViewEditorArea.tsx');
const useNotesStorePath = join(storeRoot, 'useNotesStore.ts');
const k310TestPath = join(libRoot, 'notesOverviewSignalPanelAuthenticatedVisualQaClosure.test.ts');
const k309TestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-311 notes runtime signal panel optimization source facts audit', () => {
  it('adds the K-311 source facts audit doc and preserves inspected source artifacts', () => {
    [
      docPath,
      k310DocPath,
      k309DocPath,
      containerPath,
      containerTestPath,
      adapterPath,
      adapterTestPath,
      signalPanelPath,
      signalPanelTestPath,
      noteViewSidebarPath,
      workspaceDashboardPath,
      noteViewPath,
      noteViewEditorAreaPath,
      useNotesStorePath,
      k310TestPath,
      k309TestPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states source-facts-only scope and forbids implementation work', () => {
    const doc = readDoc();

    [
      'K-311 is docs/source-facts audit plus deterministic audit test only.',
      'K-311 does not implement selector optimization.',
      'K-311 does not implement memoization beyond what already exists.',
      'K-311 does not split runtime components.',
      'K-311 does not change UI, layout, runtime behavior, stores, persistence, schema, auth, Supabase, provider, sync, backup, graph, or Cosmos behavior.',
      'No optimization is implemented in K-311.',
      'No runtime behavior is changed in K-311.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('documents current container subscription and mapping facts', () => {
    const doc = readDoc();
    const container = read(containerPath);

    [
      '## Signal Panel Container Subscription Facts',
      '`useNotesStore(state => state.notes)`.',
      '`useNotesStore(state => state.activeNoteId)`.',
      '[notes, activeNoteId]',
      'map the full local notes array again',
      'This is acceptable for the current stage',
      'The minimal future optimization target is a narrower container selector',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });

    expect(container).toContain('const notes = useNotesStore(state => state.notes);');
    expect(container).toContain('const activeNoteId = useNotesStore(state => state.activeNoteId);');
    expect(container).toContain('[notes, activeNoteId]');
    expect(container).toContain('state.notes.map(({ id, title, updatedAt, createdAt, deletedAt, starred })');
  });

  it('documents metadata boundary and local-only runtime mount path', () => {
    const doc = readDoc();

    [
      '## Metadata Mapping Boundary Facts',
      '`id`.',
      '`title`.',
      '`updatedAt`.',
      '`createdAt`.',
      '`deletedAt`.',
      '`starred`.',
      'The runtime container does not pass:',
      'note body.',
      'properties.',
      'relations.',
      'IndexedDB handles.',
      'Supabase data.',
      'provider data.',
      'graph data.',
      'Cosmos data.',
      "data.generatedFrom: 'local-note-metadata'",
      '## Runtime Mount Path Facts',
      'NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> notesOverviewSignalPanelAdapter -> NotesOverviewSignalPanel',
      'There is no AppContent wiring.',
      'There is no NoteViewEditorArea wiring.',
      'There is no graph replacement.',
      'There is no Cosmos runtime connection.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('documents sidebar dashboard slot store local-first and editor graph boundaries', () => {
    const doc = readDoc();

    [
      '## NoteViewSidebar Responsibility Audit',
      'K-308 added one import and one dashboard slot prop to `NoteViewSidebar`.',
      'Immediate refactor is premature',
      '## WorkspaceDashboardView Slot Quality Audit',
      '`WorkspaceDashboardView` keeps `signalPanel` optional.',
      "The dashboard root uses `overflowY: 'auto'` and `overflowX: 'hidden'`.",
      'Future authenticated QA should cover:',
      'horizontal overflow.',
      '## NoteView And Editor Boundary Facts',
      '`NoteView` already reads many `useNotesStore` selectors',
      '`NoteViewEditorArea` owns editor and graph rendering.',
      '`NoteViewEditorArea` imports and renders `NoteGraphViewLazy` for graph mode.',
      '`NoteViewEditorArea` does not import `NotesOverviewSignalPanelContainer`.',
      '## Store And Local-first Boundary Facts',
      'The local Notes store remains the source of truth for the Signal Panel.',
      'The Signal Panel container reads store state but does not call store write actions.',
      'The container does not read IndexedDB directly.',
      'The container does not introduce remote-first behavior.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('documents test maintenance cost and build warning relevance without changing either', () => {
    const doc = readDoc();

    [
      '## Test And Audit Maintenance Cost',
      'isolated component tests.',
      'adapter tests.',
      'runtime mount closure audits.',
      'authenticated visual QA closure audits.',
      'the duplication is still justified',
      'K-311 does not delete, merge, or weaken tests.',
      '## Build And Chunk Warning Relevance',
      '`copyToClipboard.ts` being both dynamically and statically imported.',
      '`notePersistence.ts` being both dynamically and statically imported.',
      'these warnings do not appear directly caused by the Notes Overview / Signal Panel mount.',
      'Build chunk investigation should remain separate',
      'K-311 does not change build configuration.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('ranks optimization candidates and recommends K-312 planning', () => {
    const doc = readDoc();

    [
      '## Optimization Candidate Ranking',
      '### Safe / Likely Next',
      'Plan a narrow Signal Panel metadata selector.',
      'Preserve authenticated visual QA as the next evidence gate for layout.',
      '### Needs Evidence',
      'Implement the narrow metadata selector.',
      'Memoize metadata mapping more aggressively.',
      'Layout polish for the dashboard slot.',
      '### Defer',
      'Extract a smaller dashboard owner from `NoteViewSidebar`.',
      'Consolidate Signal Panel audit tests.',
      'Build chunk investigation.',
      '### Do Not Do Yet',
      'Do not connect Supabase, provider, sync, backup, graph, or Cosmos to the Signal Panel.',
      'Do not redesign the Notes layout before authenticated visual QA evidence.',
      'Do not optimize selectors directly in K-311.',
      '## K-312 Recommendation',
      'K-312 Notes Runtime / Signal Panel Optimization Implementation Plan',
      'docs/plan plus audit test only.',
      'define whether to implement a narrow metadata selector.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('confirms runtime non-change boundaries and CI-safe audit style', () => {
    const doc = readDoc();
    const testSource = read(__filename);

    [
      '## Runtime Non-change Confirmation',
      'K-311 changes no runtime behavior.',
      'K-311 changes no UI or layout behavior.',
      'K-311 changes no `NotesOverviewSignalPanelContainer` behavior.',
      'K-311 changes no `NoteViewSidebar` behavior.',
      'K-311 changes no `WorkspaceDashboardView` behavior.',
      'K-311 changes no `NoteView` behavior.',
      'K-311 changes no `NoteViewEditorArea` behavior.',
      'K-311 changes no `NotesOverviewSignalPanel` behavior.',
      'K-311 changes no adapter implementation behavior.',
      'K-311 changes no `useNotesStore` behavior.',
      'K-311 adds no dependencies, generated artifacts, package changes, Vite changes, credentials, env files, auth bypass, fake sessions, or storageState artifacts.',
      '## Closure Statement',
      'Future work should proceed through K-312 planning or authenticated QA evidence, not broad runtime rewrites.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });

    [
      'exec' + 'Sync',
      'spawn' + 'Sync',
      'child' + '_process',
      'origin' + '/main',
      'HEAD' + '^',
    ].forEach(forbidden => {
      expect(testSource).not.toContain(forbidden);
    });
  });

  it('verifies source boundaries still show no Signal Panel import in editor or app shell', () => {
    const noteViewEditorArea = read(noteViewEditorAreaPath);
    const noteViewSidebar = read(noteViewSidebarPath);
    const workspaceDashboard = read(workspaceDashboardPath);
    const container = read(containerPath);

    expect(noteViewEditorArea).toContain('NoteGraphViewLazy');
    expect(noteViewEditorArea).not.toContain('NotesOverviewSignalPanelContainer');
    expect(noteViewEditorArea).not.toContain('notesOverviewSignalPanelAdapter');
    expect(noteViewSidebar).toContain('../../notes/NotesOverviewSignalPanelContainer');
    expect(noteViewSidebar).toContain('signalPanel={<NotesOverviewSignalPanelContainer />}');
    expect(workspaceDashboard).toContain('signalPanel?: React.ReactNode');
    expect(workspaceDashboard).toContain('data-testid="notes-overview-signal-panel-slot"');
    expect(container).not.toContain('authFetch');
    expect(container).not.toContain('supabase');
    expect(container).not.toContain('noteIndexedDb');
    expect(container).not.toContain('NoteGraphView');
    expect(container).not.toContain('Cosmos');
  });
});
