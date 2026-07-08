import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');
const componentsRoot = join(srcRoot, 'components');
const notesRoot = join(componentsRoot, 'notes');
const libRoot = join(srcRoot, 'lib');

const containerPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.tsx');
const containerTestPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.test.ts');
const workspaceDashboardPath = join(
  componentsRoot,
  'views',
  'features',
  'knowledge',
  'components',
  'WorkspaceDashboardView.tsx',
);
const noteViewSidebarPath = join(componentsRoot, 'views', 'noteview', 'NoteViewSidebar.tsx');
const noteViewEditorAreaPath = join(
  componentsRoot,
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const appContentPath = join(componentsRoot, 'AppContent.tsx');
const noteViewPath = join(componentsRoot, 'views', 'NoteView.tsx');
const noteGraphViewPath = join(componentsRoot, 'views', 'NoteGraphView.tsx');
const noteGraphViewLazyPath = join(
  componentsRoot,
  'views',
  'noteview',
  'NoteGraphViewLazy.tsx',
);
const adapterPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.ts');
const signalPanelPath = join(notesRoot, 'NotesOverviewSignalPanel.tsx');
const k307DocPath = join(docsRoot, 'K-307-notes-overview-signal-panel-runtime-mount-plan.md');
const k307TestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountPlan.test.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function collectSourceFiles(rootPath: string): string[] {
  if (!existsSync(rootPath)) return [];

  return readdirSync(rootPath).flatMap(entry => {
    const path = join(rootPath, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function relativeSourcePath(path: string): string {
  return relative(root, path).replaceAll('\\', '/');
}

describe('K-308 notes overview signal panel runtime mount boundary', () => {
  it('adds the narrow runtime container and keeps prerequisite artifacts present', () => {
    [
      containerPath,
      containerTestPath,
      workspaceDashboardPath,
      noteViewSidebarPath,
      noteViewEditorAreaPath,
      appContentPath,
      noteViewPath,
      noteGraphViewPath,
      noteGraphViewLazyPath,
      adapterPath,
      signalPanelPath,
      k307DocPath,
      k307TestPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('limits runtime adapter and Signal Panel imports to the narrow container path', () => {
    const adapterImportMatches = collectSourceFiles(srcRoot)
      .filter(path => read(path).includes('./notesOverviewSignalPanelAdapter'))
      .map(relativeSourcePath)
      .filter(path => !path.startsWith('src/lib/'))
      .sort();
    const signalPanelImportMatches = collectSourceFiles(srcRoot)
      .filter(path => read(path).includes("from './NotesOverviewSignalPanel'"))
      .map(relativeSourcePath)
      .filter(path => !path.startsWith('src/lib/'))
      .sort();

    expect(adapterImportMatches).toEqual([
      'src/components/notes/NotesOverviewSignalPanelContainer.tsx',
      'src/components/notes/notesOverviewSignalPanelAdapter.test.ts',
    ]);
    expect(signalPanelImportMatches).toEqual([
      'src/components/notes/NotesOverviewSignalPanel.test.ts',
      'src/components/notes/NotesOverviewSignalPanelContainer.tsx',
      'src/components/notes/notesOverviewSignalPanelAdapter.test.ts',
    ]);
  }, 15000);

  it('mounts through NoteViewSidebar and WorkspaceDashboardView without AppContent or editor-area wiring', () => {
    const sidebar = read(noteViewSidebarPath);
    const workspaceDashboard = read(workspaceDashboardPath);

    expect(sidebar).toContain('../../notes/NotesOverviewSignalPanelContainer');
    expect(sidebar).toContain('signalPanel={<NotesOverviewSignalPanelContainer />}');
    expect(workspaceDashboard).toContain('signalPanel?: React.ReactNode');
    expect(workspaceDashboard).toContain('data-testid="notes-overview-signal-panel-slot"');

    [appContentPath, noteViewEditorAreaPath, noteGraphViewPath, noteGraphViewLazyPath].forEach(path => {
      const source = read(path);
      expect(source, path).not.toContain('NotesOverviewSignalPanelContainer');
      expect(source, path).not.toContain('notesOverviewSignalPanelAdapter');
      expect(source, path).not.toContain('createNotesOverviewSignalPanelProps');
    });
  });

  it('keeps the container local-only read-only and free of persistence remote graph or browser APIs', () => {
    const container = read(containerPath);

    expect(container).toContain("import { useNotesStore } from '../../store/useNotesStore'");
    expect(container).toContain('selectNotesOverviewSignalPanelInput');
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

  it('keeps adapter and Signal Panel source pure after runtime mount', () => {
    [adapterPath, signalPanelPath].forEach(path => {
      const source = read(path);
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
        expect(source, `${relativeSourcePath(path)} ${forbidden}`).not.toContain(forbidden);
      });
    });
  });
});
