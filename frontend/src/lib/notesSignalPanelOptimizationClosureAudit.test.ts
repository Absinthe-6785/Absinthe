import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const srcRoot = join(root, 'src');
const libRoot = join(srcRoot, 'lib');
const componentsRoot = join(srcRoot, 'components');
const notesRoot = join(componentsRoot, 'notes');
const viewsRoot = join(componentsRoot, 'views');
const noteviewRoot = join(viewsRoot, 'noteview');
const storeRoot = join(srcRoot, 'store');

const docPath = join(docsRoot, 'K-314-notes-signal-panel-optimization-closure-audit.md');
const k312DocPath = join(docsRoot, 'K-312-notes-runtime-signal-panel-optimization-implementation-plan.md');
const k311DocPath = join(docsRoot, 'K-311-notes-runtime-signal-panel-optimization-source-facts-audit.md');
const k310DocPath = join(docsRoot, 'K-310-notes-overview-signal-panel-authenticated-visual-qa-closure.md');
const k309DocPath = join(docsRoot, 'K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md');
const k307DocPath = join(docsRoot, 'K-307-notes-overview-signal-panel-runtime-mount-plan.md');

const k312TestPath = join(libRoot, 'notesRuntimeSignalPanelOptimizationImplementationPlan.test.ts');
const k311TestPath = join(libRoot, 'notesRuntimeSignalPanelOptimizationSourceFactsAudit.test.ts');
const k310TestPath = join(libRoot, 'notesOverviewSignalPanelAuthenticatedVisualQaClosure.test.ts');
const k309TestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts');
const k308BoundaryTestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountBoundaryAudit.test.ts');
const k305AdapterImplementationTestPath = join(libRoot, 'notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts');
const k305AdapterTestPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.test.ts');
const k284IsolatedComponentTestPath = join(notesRoot, 'NotesOverviewSignalPanel.test.ts');

const containerPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.tsx');
const containerTestPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.test.ts');
const adapterPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.ts');
const adapterTestPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.test.ts');
const signalPanelPath = join(notesRoot, 'NotesOverviewSignalPanel.tsx');
const signalPanelTestPath = join(notesRoot, 'NotesOverviewSignalPanel.test.ts');
const noteViewSidebarPath = join(noteviewRoot, 'NoteViewSidebar.tsx');
const workspaceDashboardPath = join(
  viewsRoot,
  'features',
  'knowledge',
  'components',
  'WorkspaceDashboardView.tsx',
);
const appContentPath = join(componentsRoot, 'AppContent.tsx');
const noteViewPath = join(viewsRoot, 'NoteView.tsx');
const noteViewEditorAreaPath = join(noteviewRoot, 'NoteViewEditorArea.tsx');
const useNotesStorePath = join(storeRoot, 'useNotesStore.ts');
const notePersistencePath = join(libRoot, 'notePersistence.ts');
const noteIndexedDbPath = join(libRoot, 'noteIndexedDb.ts');
const noteGraphViewPath = join(viewsRoot, 'NoteGraphView.tsx');
const noteGraphViewLazyPath = join(noteviewRoot, 'NoteGraphViewLazy.tsx');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

function expectNone(source: string, forbidden: readonly string[]) {
  forbidden.forEach(term => {
    expect(source).not.toContain(term);
  });
}

describe('K-314 notes signal panel optimization closure audit', () => {
  it('adds the K-314 closure audit doc and preserves prerequisite artifacts', () => {
    [
      docPath,
      k312DocPath,
      k312TestPath,
      k311DocPath,
      k311TestPath,
      k310DocPath,
      k310TestPath,
      k309DocPath,
      k309TestPath,
      k307DocPath,
      k308BoundaryTestPath,
      k305AdapterImplementationTestPath,
      k305AdapterTestPath,
      k284IsolatedComponentTestPath,
      containerPath,
      containerTestPath,
      adapterPath,
      adapterTestPath,
      signalPanelPath,
      signalPanelTestPath,
      noteViewSidebarPath,
      workspaceDashboardPath,
      appContentPath,
      noteViewPath,
      noteViewEditorAreaPath,
      useNotesStorePath,
      notePersistencePath,
      noteIndexedDbPath,
      noteGraphViewPath,
      noteGraphViewLazyPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states closure scope and non-goals without approving more optimization', () => {
    const doc = readDoc();

    [
      'K-314 is docs/source closure audit plus audit test only.',
      'K-314 does not implement additional selector optimization.',
      'K-314 does not change runtime behavior.',
      'K-314 does not optimize further.',
      'no additional selector optimization.',
      'no store subscription architecture change.',
      'no memoization layer.',
      'no adapter contract change.',
      'no Signal Panel UI change.',
      'no layout redesign.',
      'no Supabase/provider/sync connection.',
      'no graph/Cosmos connection.',
      'no Vite/build config change.',
      'no auth bypass.',
      'no backup/export/import/restore behavior change.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('recaps K-313 implementation and optimization semantics accurately', () => {
    const doc = readDoc();

    [
      '## K-313 Implementation Recap',
      'NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> notesOverviewSignalPanelAdapter -> NotesOverviewSignalPanel',
      'createNotesOverviewSignalPanelInputSelector()',
      'selectNotesOverviewSignalPanelMetadata()',
      'noteMatchesSignalPanelMetadata()',
      'useNotesStore(selectSignalPanelInput)',
      'createNotesOverviewSignalPanelProps(adapterInput)',
      '## Optimization Semantics Audit',
      'K-313 reduces adapter input churn.',
      'K-313 does not eliminate notes store subscription churn.',
      'The container still reacts when the store changes.',
      'K-313 solved adapter input churn pressure, not store subscription churn.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits comparator field coverage and excluded fields', () => {
    const doc = readDoc();

    [
      '## Comparator Field Coverage Audit',
      '`id` is needed for identity',
      '`title` is needed for recent note and active writing labels.',
      '`updatedAt` is needed for recent-note sort order',
      '`createdAt` is needed as the adapter fallback timestamp',
      '`deletedAt` is needed because the adapter filters deleted notes',
      '`starred` is preserved because it is part of the current container metadata boundary',
      '`activeNoteId` is required because active writing state depends on it.',
      'body',
      'content',
      'tags',
      'properties',
      'relations',
      'graph edges',
      'remote/provider fields',
      'large/full note payload',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits stale snapshot risk and future comparator maintenance', () => {
    const doc = readDoc();

    [
      '## Stale Snapshot Risk Audit',
      'Stale snapshot risk exists when a comparator omits a field that affects adapter output.',
      'The current comparator is acceptable only because it matches the current adapter input contract and local metadata boundary.',
      'Future adapter contract changes must update:',
      'NotesOverviewSignalPanelStoreNote',
      'selectNotesOverviewSignalPanelMetadata()',
      'noteMatchesSignalPanelMetadata()',
      'Future fields such as tags, previews, body-derived excerpts, backlinks, graph data, remote provider status, or sync state would require comparator updates',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits runtime behavior preservation and contracts', () => {
    const doc = readDoc();

    [
      '## Runtime Behavior Preservation Audit',
      'Signal Panel user-visible behavior should remain unchanged after K-313.',
      'Empty local notes behavior is preserved.',
      'Recent local notes behavior is preserved.',
      'Active note behavior is preserved.',
      'Deleted note filtering is preserved.',
      'K-313 did not change layout.',
      'K-313 did not change dashboard/sidebar mount files.',
      'K-313 did not change `AppContent`.',
      'K-313 did not change `NoteViewEditorArea`.',
      '## Adapter And Signal Panel Contract Audit',
      'The adapter contract is unchanged.',
      '`notesOverviewSignalPanelAdapter` remains pure and store-free.',
      '`NotesOverviewSignalPanel` remains props-only and read-only.',
      'There is no UI feature expansion.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits local-first Supabase auth backup graph and Cosmos boundaries', () => {
    const doc = readDoc();

    [
      '## Store Local-first Persistence Audit',
      '`useNotesStore` access remains container-local.',
      "The container's store usage remains read-only.",
      'The store subscription remains.',
      'K-313 does not write to the store.',
      'K-313 does not change `useNotesStore`.',
      'K-313 does not import IndexedDB directly.',
      'There is no remote-first hydration.',
      '## Supabase Provider Sync Backup Auth Audit',
      'K-313 does not import Supabase.',
      'K-313 does not import `authFetch`.',
      'K-313 does not connect provider code.',
      'K-313 does not connect sync code.',
      'K-313 does not change backup, export, import, restore, or preflight behavior.',
      'K-313 does not add auth bypass.',
      'K-313 does not add storageState artifacts.',
      '## Graph And Cosmos Audit',
      'K-313 does not replace `NoteGraphView`.',
      'K-313 does not import Cosmos.',
      'K-313 does not create a Cosmos runtime connection.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits test evidence remaining gaps K-315 decision and closure statement', () => {
    const doc = readDoc();

    [
      '## Test And CI Evidence Audit',
      'Container tests passed: 1 file, 7 tests.',
      'Signal Panel focused review group passed: 6 files, 60 tests.',
      'Full `npm test` passed: 564 files passed, 1 skipped; 4131 tests passed, 7 skipped.',
      'Existing Vite warnings remain separate and are not attributed to Signal Panel selector behavior.',
      '## Remaining Gaps',
      'Authenticated protected-shell visual QA evidence remains the release/manual gap preserved by K-310.',
      'K-313 and K-314 do not claim performance evidence.',
      'Store subscription churn remains.',
      'Future optimization should pause until authenticated QA or performance evidence requires more work.',
      '## K-315 Decision',
      'K-315 Notes Signal Panel Optimization Line Closure Audit.',
      '## Closure Statement',
      'K-314 closes K-313 optimization source boundary.',
      'K-313 reduced adapter input churn only.',
      'K-313 did not remove notes store subscription.',
      'Future optimization should stop until authenticated QA or performance evidence requires more work.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('confirms current source invariants for the K-313 selector boundary', () => {
    const container = read(containerPath);

    [
      'createNotesOverviewSignalPanelInputSelector',
      'selectNotesOverviewSignalPanelMetadata',
      'noteMatchesSignalPanelMetadata',
      'Object.is(note.updatedAt, metadata.updatedAt)',
      'Object.is(note.createdAt, metadata.createdAt)',
      'Object.is(note.deletedAt, metadata.deletedAt)',
      'previousInput.activeNoteId === state.activeNoteId',
      'notesMatchSignalPanelMetadata(state.notes, previousInput.notes ?? [])',
      'useNotesStore(selectSignalPanelInput)',
      'createNotesOverviewSignalPanelProps(adapterInput)',
    ].forEach(expected => {
      expect(container).toContain(expected);
    });

    [
      'id',
      'title',
      'updatedAt',
      'createdAt',
      'deletedAt',
      'starred',
    ].forEach(expected => {
      expect(container).toContain(expected);
    });
  });

  it('confirms container adapter and panel stay free of forbidden runtime couplings', () => {
    const container = read(containerPath);
    const adapter = read(adapterPath);
    const signalPanel = read(signalPanelPath);

    expect(container).toContain("import { useNotesStore } from '../../store/useNotesStore'");
    expect(container).not.toContain('useNotesStore.setState');
    expect(container).not.toContain('.setState(');

    expectNone(container, [
      'noteIndexedDb',
      'IndexedDB',
      'supabase',
      'authFetch',
      'provider',
      'syncQueue',
      'backup',
      'NoteGraphView',
      'Cosmos',
      'localStorage',
      'sessionStorage',
      'fetch(',
      'storageState',
    ]);

    [adapter, signalPanel].forEach(source => {
      expectNone(source, [
        'useNotesStore',
        'noteIndexedDb',
        'IndexedDB',
        'supabase',
        'authFetch',
        'provider',
        'syncQueue',
        'backup',
        'NoteGraphView',
        'Cosmos',
        'localStorage',
        'sessionStorage',
        'fetch(',
        'storageState',
      ]);
    });
  });

  it('confirms mounted path and editor/AppContent boundaries remain source-grounded', () => {
    const sidebar = read(noteViewSidebarPath);
    const dashboard = read(workspaceDashboardPath);
    const appContent = read(appContentPath);
    const noteViewEditorArea = read(noteViewEditorAreaPath);

    expect(sidebar).toContain("import { NotesOverviewSignalPanelContainer } from '../../notes/NotesOverviewSignalPanelContainer'");
    expect(sidebar).toContain('signalPanel={<NotesOverviewSignalPanelContainer />}');
    expect(dashboard).toContain('signalPanel?: React.ReactNode');
    expect(dashboard).toContain('data-testid="notes-overview-signal-panel-slot"');
    expect(appContent).not.toContain('NotesOverviewSignalPanelContainer');
    expect(noteViewEditorArea).not.toContain('NotesOverviewSignalPanelContainer');
  });
});
