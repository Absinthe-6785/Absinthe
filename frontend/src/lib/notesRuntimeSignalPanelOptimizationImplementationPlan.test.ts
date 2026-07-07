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

const docPath = join(docsRoot, 'K-312-notes-runtime-signal-panel-optimization-implementation-plan.md');
const k311DocPath = join(docsRoot, 'K-311-notes-runtime-signal-panel-optimization-source-facts-audit.md');
const k310DocPath = join(docsRoot, 'K-310-notes-overview-signal-panel-authenticated-visual-qa-closure.md');
const k309DocPath = join(docsRoot, 'K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md');
const k307DocPath = join(docsRoot, 'K-307-notes-overview-signal-panel-runtime-mount-plan.md');
const k311TestPath = join(libRoot, 'notesRuntimeSignalPanelOptimizationSourceFactsAudit.test.ts');
const k310TestPath = join(libRoot, 'notesOverviewSignalPanelAuthenticatedVisualQaClosure.test.ts');
const k309TestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts');
const k308BoundaryTestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountBoundaryAudit.test.ts');
const k305AdapterImplementationTestPath = join(libRoot, 'notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts');
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
const noteViewEditorAreaPath = join(noteviewRoot, 'NoteViewEditorArea.tsx');
const appContentPath = join(componentsRoot, 'AppContent.tsx');
const useNotesStorePath = join(storeRoot, 'useNotesStore.ts');
const notePersistencePath = join(libRoot, 'notePersistence.ts');
const noteIndexedDbPath = join(libRoot, 'noteIndexedDb.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-312 notes runtime signal panel optimization implementation plan', () => {
  it('adds the K-312 plan doc and preserves required source artifacts', () => {
    [
      docPath,
      k311DocPath,
      k311TestPath,
      k310DocPath,
      k310TestPath,
      k309DocPath,
      k309TestPath,
      k307DocPath,
      k308BoundaryTestPath,
      k305AdapterImplementationTestPath,
      containerPath,
      containerTestPath,
      adapterPath,
      adapterTestPath,
      signalPanelPath,
      signalPanelTestPath,
      noteViewSidebarPath,
      workspaceDashboardPath,
      noteViewEditorAreaPath,
      appContentPath,
      useNotesStorePath,
      notePersistencePath,
      noteIndexedDbPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states docs-plan-only scope and forbids implementation work', () => {
    const doc = readDoc();

    [
      'K-312 is docs/plan plus audit test only.',
      'K-312 does not implement selector optimization.',
      'K-312 does not implement memoization.',
      'K-312 does not change runtime behavior.',
      'K-312 does not change container code.',
      'K-312 does not change layout.',
      'K-312 does not change Signal Panel UI.',
      'K-312 does not change store, schema, persistence, auth, Supabase, provider, sync, backup, graph, Cosmos, Health, or Schedule behavior.',
      'No optimization is implemented.',
      'No memoization is implemented.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('recaps K-311 source facts and current runtime boundaries', () => {
    const doc = readDoc();

    [
      '## K-311 Source Facts Recap',
      'NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> notesOverviewSignalPanelAdapter -> NotesOverviewSignalPanel',
      '`useNotesStore(state => state.notes)`.',
      '`useNotesStore(state => state.activeNoteId)`.',
      'maps the full local notes array',
      '`id`.',
      '`title`.',
      '`updatedAt`.',
      '`createdAt`.',
      '`deletedAt`.',
      '`starred`.',
      'The adapter remains pure.',
      'The Signal Panel remains props-only and read-only.',
      'There is no Supabase, provider, sync, backup, graph, or Cosmos connection.',
      'Authenticated protected-shell visual QA remains a release/manual QA gap from K-310.',
      'Existing Vite chunk and dynamic-import warnings are not directly attributed to Signal Panel',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines optimization decision criteria and when not to optimize', () => {
    const doc = readDoc();

    [
      '## Optimization Decision Criteria',
      'Large note count causes measurable render delay',
      'Repeated unnecessary re-renders occur from unrelated note fields',
      'React DevTools or browser performance tools show avoidable recomputation',
      'Authenticated protected-shell QA shows sluggish panel behavior',
      'Optimization is not needed when:',
      'Small or medium note counts behave well.',
      'No visual lag appears in authenticated QA.',
      'The only concern is theoretical.',
      'The available evidence is only unrelated Vite chunk or dynamic-import warnings.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('evaluates candidate optimization strategies and chooses a narrow default', () => {
    const doc = readDoc();

    [
      '## Candidate Optimization Strategies',
      '### 1. Keep Current Full Notes Array Subscription Until Evidence',
      '### 2. Narrow Selector In Container',
      '### 3. Memoize Metadata Mapping',
      '### 4. Store-level Derived Metadata Selector',
      '### 5. Adapter-level Memoization',
      '### 6. Runtime Split Between Active Note Selector And Notes Metadata Selector',
      '### 7. Virtualization Or List Truncation',
      '### 8. Broad Store Or Schema Change',
      '## Recommended Default',
      'Do not jump to broad store, schema, persistence, or architecture changes.',
      'If K-313 implements anything, choose a narrow container-local selector/mapping plan only.',
      'Avoid adapter-level cache',
      'Avoid store-level derived state',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines the narrow metadata selector shape and activeNoteId plan', () => {
    const doc = readDoc();

    [
      '## Narrow Metadata Selector Shape',
      'type NotesSignalPanelMetadata = {',
      'id: string;',
      'title?: string | null;',
      'updatedAt?: string | number | null;',
      'createdAt?: string | number | null;',
      'deletedAt?: string | number | null;',
      'starred?: boolean;',
      'Avoid full note body.',
      'Avoid content-heavy fields.',
      'Avoid tags, properties, relations, editor state, and graph edges.',
      'Keep `activeNoteId` separate from the note metadata array.',
      '## activeNoteId Plan',
      '`activeNoteId` is currently source-grounded in `useNotesStore`.',
      '`activeNoteId` should be selected separately and read-only.',
      'Do not derive `activeNoteId` from route state.',
      'Do not call `setActiveNoteId` from the Signal Panel path.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines memoization useNotesStore local-first and remote boundary plans', () => {
    const doc = readDoc();

    [
      '## Memoization Plan',
      'Memoization should be container-local if needed.',
      'Memoization must not change adapter purity.',
      'Memoization must not add global caches.',
      'Memoization must not hide stale data.',
      'Memoization must not add dependencies.',
      '## useNotesStore Boundary',
      '`useNotesStore` import remains allowed only in the runtime container or selected Notes owner.',
      '`NotesOverviewSignalPanel` remains store-free.',
      '`notesOverviewSignalPanelAdapter` remains store-free.',
      'Any selector must be read-only.',
      'No store writes are allowed.',
      'No direct IndexedDB imports are allowed.',
      '## Persistence And Local-first Boundary',
      'IndexedDB remains the underlying local persistence source for Notes.',
      'K-313 must not import IndexedDB directly.',
      'K-313 must not make Supabase the source of truth.',
      '## Supabase Provider Sync Graph Boundary',
      'Optimization must not introduce Supabase imports.',
      'Optimization must not introduce `authFetch`.',
      'Optimization must not introduce provider or sync imports.',
      'Optimization must not introduce graph or Cosmos imports.',
      'Optimization must not add network traffic.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines K-313 implementation boundary tests QA evidence plan and non-goals', () => {
    const doc = readDoc();

    [
      '## K-313 Implementation Boundary',
      'K-313 Notes Runtime / Signal Panel Selector Optimization Implementation',
      'Modify only `frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx` if implementation is approved.',
      'Keep Signal Panel UI unchanged.',
      'Keep adapter behavior unchanged.',
      'Do not change store, schema, persistence, hydration, Supabase, provider, sync, backup, graph, Cosmos, auth, Health, or Schedule behavior.',
      'K-313 Notes Runtime / Signal Panel Optimization Closure Audit',
      'K-312 chooses the primary K-313 selector optimization implementation plan',
      '## K-313 Tests',
      'Container uses a narrowed metadata shape.',
      'Full note body is not selected or mapped.',
      'Active note behavior is unchanged for active, missing, and deleted active notes.',
      'No direct IndexedDB import is added.',
      'No Supabase, provider, sync, backup, graph, or Cosmos imports are added.',
      '## QA And Performance Evidence Plan',
      'Authenticated protected-shell visual QA remains a release/manual gap',
      'Record the note count.',
      'Record viewport size.',
      'Do not claim authenticated QA or performance evidence unless it is actually performed.',
      '## Non-goals',
      'no selector optimization implementation in K-312.',
      'no memoization implementation in K-312.',
      'no container code change in K-312.',
      'no graph or Cosmos connection.',
      'no auth bypass.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps the K-312 audit test CI-safe and free of git topology assumptions', () => {
    const testSource = read(__filename);

    [
      'exec' + 'Sync',
      'spawn' + 'Sync',
      'child' + '_process',
      'git' + ' diff',
      'origin' + '/main',
      'HEAD' + '^',
      'main...' + 'HEAD',
    ].forEach(forbidden => {
      expect(testSource).not.toContain(forbidden);
    });
  });

  it('verifies current source still reflects the planned optimization target', () => {
    const container = read(containerPath);
    const adapter = read(adapterPath);
    const signalPanel = read(signalPanelPath);
    const sidebar = read(noteViewSidebarPath);
    const dashboard = read(workspaceDashboardPath);
    const editorArea = read(noteViewEditorAreaPath);
    const appContent = read(appContentPath);

    expect(container).toContain('const notes = useNotesStore(state => state.notes);');
    expect(container).toContain('const activeNoteId = useNotesStore(state => state.activeNoteId);');
    expect(container).toContain('state.notes.map(({ id, title, updatedAt, createdAt, deletedAt, starred })');
    expect(container).toContain('[notes, activeNoteId]');
    expect(adapter).toContain("generatedFrom: 'local-note-metadata'");
    expect(signalPanel).toContain('export function NotesOverviewSignalPanel');
    expect(sidebar).toContain('signalPanel={<NotesOverviewSignalPanelContainer />}');
    expect(dashboard).toContain('signalPanel?: React.ReactNode');
    expect(dashboard).toContain('data-testid="notes-overview-signal-panel-slot"');
    expect(editorArea).not.toContain('NotesOverviewSignalPanelContainer');
    expect(appContent).not.toContain('NotesOverviewSignalPanelContainer');
  });

  it('confirms source boundaries remain free of forbidden runtime connections', () => {
    const container = read(containerPath);
    const adapter = read(adapterPath);
    const signalPanel = read(signalPanelPath);

    [container, adapter, signalPanel].forEach(source => {
      [
        'noteIndexedDb',
        'notePersistence',
        'authFetch',
        'supabase',
        'provider',
        'sync',
        'backup',
        'restore',
        'NoteGraphView',
        'Cosmos',
        'cosmos',
        'localStorage',
        'sessionStorage',
        'fetch(',
        'XMLHttpRequest',
        '.setState(',
        '.getState(',
      ].forEach(forbidden => {
        expect(source, forbidden).not.toContain(forbidden);
      });
    });
  });
});
