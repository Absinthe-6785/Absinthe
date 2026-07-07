import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const srcRoot = join(root, 'src');
const componentsRoot = join(srcRoot, 'components');
const notesRoot = join(componentsRoot, 'notes');
const libRoot = join(srcRoot, 'lib');

const docPath = join(docsRoot, 'K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md');
const k307DocPath = join(docsRoot, 'K-307-notes-overview-signal-panel-runtime-mount-plan.md');
const k306DocPath = join(docsRoot, 'K-306-notes-overview-signal-panel-adapter-closure-audit.md');
const k304DocPath = join(docsRoot, 'K-304-notes-overview-signal-panel-adapter-implementation-plan.md');
const k303DocPath = join(docsRoot, 'K-303-notes-overview-signal-panel-adapter-boundary-audit.md');

const containerPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.tsx');
const containerTestPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.test.ts');
const runtimeMountBoundaryTestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountBoundaryAudit.test.ts');
const runtimeMountPlanTestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountPlan.test.ts');
const adapterClosureTestPath = join(libRoot, 'notesOverviewSignalPanelAdapterClosureAudit.test.ts');
const adapterPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.ts');
const adapterTestPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.test.ts');
const signalPanelPath = join(notesRoot, 'NotesOverviewSignalPanel.tsx');
const signalPanelTestPath = join(notesRoot, 'NotesOverviewSignalPanel.test.ts');
const noteViewSidebarPath = join(componentsRoot, 'views', 'noteview', 'NoteViewSidebar.tsx');
const workspaceDashboardPath = join(
  componentsRoot,
  'views',
  'features',
  'knowledge',
  'components',
  'WorkspaceDashboardView.tsx',
);
const appContentPath = join(componentsRoot, 'AppContent.tsx');
const noteViewEditorAreaPath = join(componentsRoot, 'views', 'noteview', 'NoteViewEditorArea.tsx');
const noteGraphViewPath = join(componentsRoot, 'views', 'NoteGraphView.tsx');
const noteGraphViewLazyPath = join(componentsRoot, 'views', 'noteview', 'NoteGraphViewLazy.tsx');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-309 notes overview signal panel runtime mount closure audit', () => {
  it('adds the K-309 closure audit doc and preserves prerequisite artifacts', () => {
    [
      docPath,
      k307DocPath,
      k306DocPath,
      k304DocPath,
      k303DocPath,
      containerPath,
      containerTestPath,
      runtimeMountBoundaryTestPath,
      runtimeMountPlanTestPath,
      adapterClosureTestPath,
      adapterPath,
      adapterTestPath,
      signalPanelPath,
      signalPanelTestPath,
      noteViewSidebarPath,
      workspaceDashboardPath,
      appContentPath,
      noteViewEditorAreaPath,
      noteGraphViewPath,
      noteGraphViewLazyPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states K-309 closure scope and non-goals', () => {
    const doc = readDoc();

    [
      'K-309 is docs/source closure audit plus audit test only.',
      'K-309 does not add UI features.',
      'K-309 does not redesign Signal Panel layout.',
      'K-309 does not optimize the store selector implementation.',
      'K-309 does not expand NoteView responsibility.',
      'K-309 does not implement store selector optimization.',
      'K-309 does not connect Supabase, provider, or sync systems.',
      'K-309 does not connect graph or Cosmos.',
      'K-309 does not add auth bypass.',
      'K-309 does not add production bypass.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('summarizes current runtime mount posture and K-308 source facts', () => {
    const doc = readDoc();

    [
      '## Current Runtime Mount Posture Summary',
      'NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> NotesOverviewSignalPanel',
      'frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx',
      'frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts',
      'frontend/src/components/notes/NotesOverviewSignalPanel.tsx',
      '## K-308 Implementation Source Audit',
      'new runtime container',
      'new container test',
      '`WorkspaceDashboardView` optional `signalPanel` slot',
      '`NoteViewSidebar` slot mount',
      'id',
      'title',
      'updatedAt',
      'createdAt',
      'deletedAt',
      'starred',
      'full local `notes` array',
      "data.generatedFrom: 'local-note-metadata'",
      'data-testid="notes-overview-signal-panel-container"',
      'data-testid="notes-overview-signal-panel-slot"',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits runtime mount path, store boundary, and preservation boundaries', () => {
    const doc = readDoc();

    [
      '## Runtime Mount Path Boundary Audit',
      'The Signal Panel is mounted only through the intended slot/container path',
      'There is no `AppContent` broad wiring.',
      'There is no `NoteViewEditorArea` wiring.',
      'There is no route or navigation rewrite.',
      'There is no broad layout rewrite.',
      '## Store And Local Data Boundary Audit',
      '`useNotesStore` access is limited to the container',
      'The store usage is read-only.',
      'There are no store writes in the container.',
      'There is no direct IndexedDB import.',
      'There is no remote fallback.',
      '## Adapter And Signal Panel Preservation Audit',
      'The adapter remains pure.',
      'The Signal Panel remains props-only and read-only.',
      'The Signal Panel does not write to local or remote state.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits graph Cosmos Supabase provider sync backup and auth boundaries', () => {
    const doc = readDoc();

    [
      '## Graph And Cosmos Boundary Audit',
      '`NoteGraphView` and `NoteGraphViewLazy` remain preserved.',
      'There are no graph or Cosmos imports in the container.',
      'There is no Cosmos runtime connection.',
      'There is no graph replacement.',
      '## Supabase Provider Sync Backup Auth Boundary Audit',
      'There is no Supabase import',
      'There is no `authFetch` import.',
      'There is no provider or sync import.',
      'There is no backup, export, import, restore, or preflight behavior change.',
      'There is no auth behavior change.',
      'There is no auth bypass.',
      'There is no production bypass.',
      'There are no credentials, storageState artifacts, service-role keys',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('records layout status authenticated QA gap evidence remaining gaps and K-310 path', () => {
    const doc = readDoc();

    [
      '## Layout And Responsive Audit',
      'The K-308 logged-out auth gate smoke test opened the local Vite app',
      'Authenticated protected-shell visual QA was not completed',
      'K-309 does not claim authenticated visual QA is complete.',
      '## Browser QA Gap Closure',
      'K-309 does not perform an auth bypass.',
      'Authenticated Notes workspace visual QA checklist:',
      'open the protected app shell.',
      'verify the Signal Panel is visible in the intended dashboard slot.',
      'check network activity for no new Supabase, provider, sync, or backup calls caused by the panel mount beyond existing app behavior.',
      '## Test And CI Evidence Audit',
      'full `npm test` passed: 560 files passed, 1 skipped; 4092 tests passed, 7 skipped.',
      '## Remaining Gaps',
      'authenticated protected-shell visual QA is incomplete',
      'full notes array subscription and mapping may need optimization',
      '## K-310 Decision',
      'K-310 Notes Overview / Signal Panel Authenticated Visual QA Checklist Closure',
      '## Non-goals',
      '## Closure Statement',
      'Remote systems remain support layers.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps AppContent editor graph and container source boundaries intact', () => {
    [appContentPath, noteViewEditorAreaPath, noteGraphViewPath, noteGraphViewLazyPath].forEach(path => {
      const source = read(path);
      expect(source, path).not.toContain('NotesOverviewSignalPanelContainer');
      expect(source, path).not.toContain('notesOverviewSignalPanelAdapter');
      expect(source, path).not.toContain('createNotesOverviewSignalPanelProps');
    });

    const sidebar = read(noteViewSidebarPath);
    const dashboard = read(workspaceDashboardPath);
    const container = read(containerPath);

    expect(sidebar).toContain('../../notes/NotesOverviewSignalPanelContainer');
    expect(sidebar).toContain('signalPanel={<NotesOverviewSignalPanelContainer />}');
    expect(dashboard).toContain('signalPanel?: React.ReactNode');
    expect(dashboard).toContain('data-testid="notes-overview-signal-panel-slot"');
    expect(container).toContain("import { useNotesStore } from '../../store/useNotesStore'");
    expect(container).toContain('const notes = useNotesStore(state => state.notes);');
    expect(container).toContain('const activeNoteId = useNotesStore(state => state.activeNoteId);');
    expect(container).toContain('createNotesOverviewSignalPanelProps(adapterInput)');

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
      'setInterval',
      'setTimeout',
      '.setState(',
      '.getState(',
    ].forEach(forbidden => {
      expect(container, forbidden).not.toContain(forbidden);
    });
  });

  it('keeps adapter and Signal Panel source pure after K-309 closure', () => {
    const adapter = read(adapterPath);
    const signalPanel = read(signalPanelPath);

    expect(adapter).toContain('export function createNotesOverviewSignalPanelProps');
    expect(adapter).toContain("generatedFrom: 'local-note-metadata'");
    expect(signalPanel).toContain('export function NotesOverviewSignalPanel');

    [adapter, signalPanel].forEach(source => {
      [
        'useNotesStore',
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
        'localStorage',
        'sessionStorage',
        'fetch(',
        'XMLHttpRequest',
      ].forEach(forbidden => {
        expect(source, forbidden).not.toContain(forbidden);
      });
    });
  });
});
