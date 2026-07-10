import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');
const componentsRoot = join(srcRoot, 'components');
const notesRoot = join(componentsRoot, 'notes');
const libRoot = join(srcRoot, 'lib');

const adapterPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.ts');
const adapterTestPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.test.ts');
const boundaryAuditTestPath = join(
  libRoot,
  'notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts',
);
const k304PlanDocPath = join(
  docsRoot,
  'K-304-notes-overview-signal-panel-adapter-implementation-plan.md',
);
const k303BoundaryDocPath = join(
  docsRoot,
  'K-303-notes-overview-signal-panel-adapter-boundary-audit.md',
);
const signalPanelComponentPath = join(notesRoot, 'NotesOverviewSignalPanel.tsx');
const signalPanelTestPath = join(notesRoot, 'NotesOverviewSignalPanel.test.ts');
const appContentPath = join(componentsRoot, 'AppContent.tsx');
const noteViewPath = join(componentsRoot, 'views', 'NoteView.tsx');
const noteViewEditorAreaPath = join(
  componentsRoot,
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const noteGraphViewPath = join(componentsRoot, 'views', 'NoteGraphView.tsx');
const noteGraphViewLazyPath = join(
  componentsRoot,
  'views',
  'noteview',
  'NoteGraphViewLazy.tsx',
);
const staticPreviewPath = join(notesRoot, 'NotesCosmosStaticPreview.tsx');

const adapterStem = 'notesOverviewSignalPanelAdapter';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return collectSourceFiles(path);
    }

    if (/\.(ts|tsx)$/.test(path)) {
      return [path];
    }

    return [];
  });
}

function relativeSourcePath(path: string): string {
  return relative(root, path).replaceAll('\\', '/');
}

describe('K-305 notes overview signal panel adapter implementation boundary', () => {
  it('adds adapter implementation artifacts while keeping prerequisite artifacts present', () => {
    [
      adapterPath,
      adapterTestPath,
      boundaryAuditTestPath,
      k304PlanDocPath,
      k303BoundaryDocPath,
      signalPanelComponentPath,
      signalPanelTestPath,
      appContentPath,
      noteViewPath,
      noteViewEditorAreaPath,
      noteGraphViewPath,
      noteGraphViewLazyPath,
      staticPreviewPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('keeps the adapter module free of runtime, store, persistence, remote, graph, backup, and browser imports', () => {
    const adapter = read(adapterPath);

    [
      /from ['"].*AppContent/,
      /from ['"].*NoteView/,
      /from ['"].*NoteViewEditorArea/,
      /from ['"].*useNotesStore/,
      /from ['"].*store/,
      /from ['"].*noteIndexedDb/i,
      /from ['"].*notePersistence/i,
      /from ['"].*IndexedDB/i,
      /from ['"].*supabase/i,
      /from ['"].*authFetch/i,
      /from ['"].*provider/i,
      /from ['"].*sync/i,
      /from ['"].*backup/i,
      /from ['"].*export/i,
      /from ['"].*import/i,
      /from ['"].*restore/i,
      /from ['"].*NoteGraphView/,
      /from ['"].*LocalGraphView/,
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*Cosmos/i,
      /from ['"].*route/i,
      /from ['"].*navigation/i,
      /from ['"].*react/i,
    ].forEach(forbiddenImport => {
      expect(adapter).not.toMatch(forbiddenImport);
    });

    [
      'window',
      'document',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'fetch(',
      'XMLHttpRequest',
      'setTimeout',
      'setInterval',
      'useEffect',
      'useMemo',
      'console.',
    ].forEach(forbiddenSource => {
      expect(adapter).not.toContain(forbiddenSource);
    });
  });

  it('keeps current runtime surfaces from importing the adapter or mounting Signal Panel', () => {
    [
      appContentPath,
      noteViewPath,
      noteViewEditorAreaPath,
      staticPreviewPath,
    ].forEach(path => {
      const source = read(path);

      expect(source, path).not.toContain(adapterStem);
      expect(source, path).not.toContain('NotesOverviewSignalPanel');
    });

    expect(read(appContentPath)).toContain("<NoteView showToast={showToast} />");
    expect(read(noteViewEditorAreaPath)).toContain('NoteGraphViewLazy');
  });

  it('keeps graph, store, and persistence files from depending on the adapter', () => {
    [
      join(srcRoot, 'store', 'useNotesStore.ts'),
      join(libRoot, 'notePersistence.ts'),
      join(libRoot, 'noteIndexedDb.ts'),
      noteGraphViewPath,
      noteGraphViewLazyPath,
    ].forEach(path => {
      expect(read(path), path).not.toContain(adapterStem);
    });
  });

  it('keeps the Signal Panel component independent from the adapter', () => {
    const component = read(signalPanelComponentPath);

    expect(component).toContain('export function NotesOverviewSignalPanel');
    expect(component).not.toContain(adapterStem);
    expect(component).not.toContain('createNotesOverviewSignalPanelProps');
  });

  it('limits adapter source references to implementation, tests, and planning/audit artifacts', () => {
    const matches = new Set(collectSourceFiles(srcRoot)
      .filter(path => read(path).includes(adapterStem))
      .map(relativeSourcePath));
    matches.add(relativeSourcePath(adapterPath));

    expect([...matches].sort()).toEqual([
      'src/components/notes/NotesOverviewSignalPanelContainer.tsx',
      'src/components/notes/notesOverviewSignalPanelAdapter.test.ts',
      'src/components/notes/notesOverviewSignalPanelAdapter.ts',
      'src/lib/notesOverviewSignalPanelAdapterBoundaryAudit.test.ts',
      'src/lib/notesOverviewSignalPanelAdapterClosureAudit.test.ts',
      'src/lib/notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts',
      'src/lib/notesOverviewSignalPanelAdapterImplementationPlan.test.ts',
      'src/lib/notesOverviewSignalPanelAuthenticatedVisualQaClosure.test.ts',
      'src/lib/notesOverviewSignalPanelIsolatedComponentClosureAudit.test.ts',
      'src/lib/notesOverviewSignalPanelRuntimeMountBoundaryAudit.test.ts',
      'src/lib/notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts',
      'src/lib/notesOverviewSignalPanelRuntimeMountPlan.test.ts',
      'src/lib/notesRuntimeSignalPanelOptimizationImplementationPlan.test.ts',
      'src/lib/notesRuntimeSignalPanelOptimizationSourceFactsAudit.test.ts',
      'src/lib/notesSignalPanelOptimizationClosureAudit.test.ts',
      'src/lib/notesSignalPanelOptimizationLineClosureAudit.test.ts',
    ]);
  });

  it('keeps K-305 implementation source free of forbidden data-shape fields', () => {
    const adapter = read(adapterPath);

    [
      'bodyPreview',
      'tags',
      'body:',
      'content',
      'markdown',
      'relations',
      'graphCoordinates',
      'providerState',
      'syncState',
      'backupState',
      'editorState',
    ].forEach(forbiddenField => {
      expect(adapter).not.toContain(forbiddenField);
    });
  });

  it('uses deterministic source assertions without shelling out to git or depending on branch refs', () => {
    const testSource = read(__filename);

    [
      'git' + ' diff',
      'origin' + '/main',
      'HEAD' + '^',
      'exec' + 'Sync',
      'spawn' + 'Sync',
      'child' + '_process',
    ].forEach(forbidden => {
      expect(testSource).not.toContain(forbidden);
    });
  });
});
