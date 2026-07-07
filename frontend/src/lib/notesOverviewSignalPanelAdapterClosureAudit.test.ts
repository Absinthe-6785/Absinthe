import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const srcRoot = join(root, 'src');
const libRoot = join(srcRoot, 'lib');
const componentsRoot = join(srcRoot, 'components');
const notesRoot = join(componentsRoot, 'notes');

const docPath = join(
  docsRoot,
  'K-306-notes-overview-signal-panel-adapter-closure-audit.md',
);
const adapterPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.ts');
const adapterTestPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.test.ts');
const k305BoundaryAuditPath = join(
  libRoot,
  'notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts',
);
const k304DocPath = join(
  docsRoot,
  'K-304-notes-overview-signal-panel-adapter-implementation-plan.md',
);
const k304TestPath = join(
  libRoot,
  'notesOverviewSignalPanelAdapterImplementationPlan.test.ts',
);
const k303DocPath = join(
  docsRoot,
  'K-303-notes-overview-signal-panel-adapter-boundary-audit.md',
);
const k303TestPath = join(libRoot, 'notesOverviewSignalPanelAdapterBoundaryAudit.test.ts');
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
const notesStorePath = join(srcRoot, 'store', 'useNotesStore.ts');
const notePersistencePath = join(libRoot, 'notePersistence.ts');
const noteIndexedDbPath = join(libRoot, 'noteIndexedDb.ts');

const adapterStem = 'notesOverviewSignalPanelAdapter';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-306 notes overview signal panel adapter closure audit', () => {
  it('adds closure audit doc and keeps K-305/K-304/K-303 artifacts present', () => {
    [
      docPath,
      adapterPath,
      adapterTestPath,
      k305BoundaryAuditPath,
      k304DocPath,
      k304TestPath,
      k303DocPath,
      k303TestPath,
      signalPanelComponentPath,
      signalPanelTestPath,
      appContentPath,
      noteViewPath,
      noteViewEditorAreaPath,
      noteGraphViewPath,
      noteGraphViewLazyPath,
      notesStorePath,
      notePersistencePath,
      noteIndexedDbPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states K-306 closure-audit-only scope and explicit no-runtime boundaries', () => {
    const doc = readDoc();

    [
      'K-306 is docs/source closure audit plus audit test only.',
      'K-306 does not modify adapter.',
      'K-306 does not mount Signal Panel.',
      'K-306 does not wire live Notes data.',
      'K-306 does not connect a runtime selector.',
      'K-306 does not wire `AppContent`, `NoteView`, or `NoteViewEditorArea`.',
      'K-306 chooses the next path: K-307 Notes Overview / Signal Panel Runtime Mount Plan.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('summarizes current adapter posture and K-305 implementation source facts', () => {
    const doc = readDoc();

    [
      '## Current Adapter Posture Summary',
      'frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts',
      'frontend/src/components/notes/notesOverviewSignalPanelAdapter.test.ts',
      'frontend/src/lib/notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts',
      'The adapter is a pure selector/mapper.',
      'The adapter is unmounted.',
      'The adapter is not wired into runtime.',
      'The adapter does not read store or persistence.',
      'The adapter does not call remote/provider/sync systems.',
      'The adapter does not mutate input.',
      '## K-305 Implementation Source Audit',
      '`SIGNAL_PANEL_RECENT_NOTE_LIMIT`.',
      '`NotesOverviewSignalPanelAdapterNoteInput`.',
      '`NotesOverviewSignalPanelAdapterInput`.',
      '`createNotesOverviewSignalPanelProps`.',
      'The adapter does not accept body preview in K-305.',
      'The adapter does not accept tags in K-305.',
      "`data.generatedFrom: 'local-note-metadata'`.",
      'deleted notes are filtered out first.',
      'valid `updatedAt` is preferred.',
      'valid `createdAt` is the fallback',
      'stable input order is the fallback',
      'currently five.',
      'Component rendering behavior changed: no.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits import boundary and runtime mount absence', () => {
    const doc = readDoc();

    [
      '## Import-boundary Audit',
      'The adapter does not import `AppContent`.',
      'The adapter does not import `NoteView`.',
      'The adapter does not import `NoteViewEditorArea`.',
      'The adapter does not import `useNotesStore`.',
      'The adapter does not import IndexedDB/persistence.',
      'The adapter does not import Supabase/authFetch.',
      'The adapter does not import provider/sync.',
      'The adapter does not import backup/export/import/restore.',
      'The adapter does not import `NoteGraphView`/graph/Cosmos.',
      'The adapter does not access `window` or `document`.',
      'The adapter does not access `localStorage` or `sessionStorage`.',
      'The adapter does not call `fetch` or `XMLHttpRequest`.',
      'The adapter does not use timers.',
      'Runtime route/page/AppContent/NoteView files do not import adapter.',
      'Signal Panel component does not import adapter.',
      '## Runtime Mount Absence Audit',
      'Signal Panel remains unmounted.',
      'Adapter remains unmounted.',
      'There is no `AppContent` wiring.',
      'There is no `NoteView` wiring.',
      'There is no `NoteViewEditorArea` wiring.',
      'There is no Notes Overview route mount.',
      'There is no layout slot change.',
      'There is no user-visible behavior change.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits Signal Panel isolation Notes local-first and graph/Cosmos boundaries', () => {
    const doc = readDoc();

    [
      '## Signal Panel Isolation Audit',
      '`NotesOverviewSignalPanel` remains props-only/read-only.',
      'Component source changed in K-305: no.',
      'Component source changed in K-306: no.',
      'The component does not read store.',
      'The component does not read persistence.',
      'The component does not call Supabase/provider/sync.',
      'The component does not own route/navigation.',
      'The component does not replace `NoteGraphView`.',
      '## Notes Local-first Boundary Audit',
      'Notes source of truth remains local-first.',
      '`useNotesStore` plus IndexedDB-primary persistence posture is unchanged.',
      'The adapter accepts caller-provided local metadata only.',
      'The adapter does not make Supabase source of truth.',
      'The adapter does not trigger remote-first full fetch, hydrate, or graph rebuild.',
      'There are no note store/schema/persistence changes.',
      '## Graph/Cosmos Boundary Audit',
      'The adapter does not import `NoteGraphView`/graph/Cosmos runtime.',
      'The adapter does not mutate graph.',
      'The adapter does not replace graph surface.',
      'Future Cosmos/graph integration remains separate.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits test evidence remaining gaps K-307 decision non-goals and closure statement', () => {
    const doc = readDoc();

    [
      '## Test and CI Evidence Audit',
      'adapter tests passed: 1 file, 14 tests.',
      'boundary audit test passed: 1 file, 8 tests.',
      'full npm test passed: 556 files passed, 1 skipped; 4061 tests passed, 7 skipped.',
      'typecheck passed.',
      'build passed with existing Vite warnings.',
      'K-306 has no manual browser QA requirement',
      '## Remaining Gaps',
      'runtime mount is not implemented.',
      'live Notes data selection is not implemented.',
      'caller-side local selector is not implemented.',
      'layout slot is not implemented.',
      'adapter closure does not prove product UX.',
      '## K-307 Decision',
      'K-307 Notes Overview / Signal Panel Runtime Mount Plan',
      'docs/plan plus audit test only.',
      'no runtime mount yet.',
      'Not recommended:',
      'runtime mount implementation without mount plan.',
      'direct `useNotesStore` import inside Signal Panel.',
      'Supabase/provider-backed Signal Panel.',
      '`NoteGraphView` replacement.',
      '## Non-goals',
      'no adapter modification in K-306.',
      'no Signal Panel runtime mount.',
      'no AppContent/NoteView wiring.',
      'no live Notes store connection.',
      'no runtime selector connection.',
      'no Supabase/provider/sync connection.',
      'no graph/Cosmos connection.',
      '## Closure Statement',
      'K-306 closes the K-305 pure adapter implementation.',
      'Adapter remains pure, unmounted, store-free, persistence-free, and remote-free.',
      'K-307 should plan the runtime mount before implementation.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('confirms adapter source remains pure and free of forbidden imports or browser APIs', () => {
    const adapter = read(adapterPath);

    [
      /from ['"].*AppContent/,
      /from ['"].*NoteView/,
      /from ['"].*NoteViewEditorArea/,
      /from ['"].*useNotesStore/,
      /from ['"].*store/,
      /from ['"].*noteIndexedDb/i,
      /from ['"].*notePersistence/i,
      /from ['"].*supabase/i,
      /from ['"].*authFetch/i,
      /from ['"].*provider/i,
      /from ['"].*sync/i,
      /from ['"].*backup/i,
      /from ['"].*restore/i,
      /from ['"].*NoteGraphView/,
      /from ['"].*Cosmos/i,
      /from ['"].*route/i,
      /from ['"].*navigation/i,
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
      'Date.now',
      'Math.random',
    ].forEach(forbiddenSource => {
      expect(adapter).not.toContain(forbiddenSource);
    });
  });

  it('confirms runtime files do not import adapter or mount Signal Panel', () => {
    [
      appContentPath,
      noteViewPath,
      noteViewEditorAreaPath,
    ].forEach(path => {
      const source = read(path);

      expect(source, path).not.toContain(adapterStem);
      expect(source, path).not.toContain('NotesOverviewSignalPanel');
    });

    expect(read(appContentPath)).toContain("<NoteView showToast={showToast} />");
    expect(read(noteViewEditorAreaPath)).toContain('NoteGraphViewLazy');
  });

  it('confirms Signal Panel component store persistence remote and graph isolation', () => {
    const component = read(signalPanelComponentPath);

    expect(component).toContain('export function NotesOverviewSignalPanel');
    expect(component).toContain("readonly generatedFrom: 'local-note-metadata';");
    expect(component).not.toContain(adapterStem);

    [
      /from ['"].*useNotesStore/,
      /from ['"].*notePersistence/,
      /from ['"].*noteIndexedDb/,
      /from ['"].*supabase/i,
      /from ['"].*authFetch/i,
      /from ['"].*provider/i,
      /from ['"].*sync/i,
      /from ['"].*backup/i,
      /from ['"].*NoteGraphView/,
      /from ['"].*Cosmos/i,
      /from ['"].*route/i,
      /from ['"].*navigation/i,
    ].forEach(forbiddenImport => {
      expect(component).not.toMatch(forbiddenImport);
    });

    [
      'useEffect',
      'fetch(',
      'authFetch',
      'supabase',
      'useNotesStore',
      'indexedDB',
      'localStorage',
      'onSelectRecentNote',
      'onCreateNote',
    ].forEach(forbiddenSource => {
      expect(component).not.toContain(forbiddenSource);
    });
  });

  it('confirms store persistence and graph files do not depend on adapter', () => {
    [
      notesStorePath,
      notePersistencePath,
      noteIndexedDbPath,
      noteGraphViewPath,
      noteGraphViewLazyPath,
    ].forEach(path => {
      expect(read(path), path).not.toContain(adapterStem);
    });
  });

  it('uses deterministic source assertions without git shell or ref topology dependencies', () => {
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
