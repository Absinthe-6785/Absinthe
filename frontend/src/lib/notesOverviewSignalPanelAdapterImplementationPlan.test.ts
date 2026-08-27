import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const srcRoot = join(root, 'src');
const libRoot = join(srcRoot, 'lib');
const componentsRoot = join(srcRoot, 'components');

const docPath = join(
  docsRoot,
  'K-304-notes-overview-signal-panel-adapter-implementation-plan.md',
);
const k303DocPath = join(
  docsRoot,
  'K-303-notes-overview-signal-panel-adapter-boundary-audit.md',
);
const k303TestPath = join(libRoot, 'notesOverviewSignalPanelAdapterBoundaryAudit.test.ts');
const k285DocPath = join(
  docsRoot,
  'K-285-notes-overview-signal-panel-isolated-component-closure-audit.md',
);
const k285TestPath = join(
  libRoot,
  'notesOverviewSignalPanelIsolatedComponentClosureAudit.test.ts',
);
const signalPanelComponentPath = join(
  componentsRoot,
  'notes',
  'NotesOverviewSignalPanel.tsx',
);
const signalPanelTestPath = join(
  componentsRoot,
  'notes',
  'NotesOverviewSignalPanel.test.ts',
);
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
const chosenAdapterPath = join(
  componentsRoot,
  'notes',
  'notesOverviewSignalPanelAdapter.ts',
);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-304 notes overview signal panel adapter implementation plan', () => {
  it('adds K-304 plan doc and keeps prerequisite artifacts present', () => {
    [
      docPath,
      k303DocPath,
      k303TestPath,
      k285DocPath,
      k285TestPath,
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

  it('states docs/plan-only scope and explicit no-implementation boundaries', () => {
    const doc = readDoc();

    [
      'K-304 is docs/plan plus audit test only.',
      'K-304 does not implement adapter.',
      'K-304 does not create an adapter source module.',
      'K-304 does not mount Signal Panel.',
      'K-304 does not connect live Notes data.',
      'K-304 does not wire `AppContent`, `NoteView`, or `NoteViewEditorArea`.',
      'no adapter implementation in K-304.',
      'no adapter source module.',
      'no Signal Panel runtime mount.',
      'no NoteView/AppContent wiring.',
      'no live Notes data connection.',
      'no persistence/schema change.',
      'no Supabase/provider/sync connection.',
      'no graph/Cosmos runtime connection.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('recaps K-303 boundary facts', () => {
    const doc = readDoc();

    [
      '## K-303 Boundary Recap',
      'Signal Panel remains isolated and unmounted.',
      '`NotesOverviewSignalPanel` remains props-only and read-only.',
      'current Notes runtime remains `AppContent -> NoteView -> NoteViewEditorArea`.',
      'graph surface remains `NoteGraphViewLazy` / `NoteGraphView`.',
      'local-first source of truth remains `useNotesStore` plus IndexedDB-primary persistence.',
      'no Supabase/provider/sync wiring exists.',
      'adapter and runtime mount remain future work.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines adapter purpose and primary owner path', () => {
    const doc = readDoc();

    [
      '## Adapter Purpose',
      'The adapter converts local Notes-derived metadata into `NotesOverviewSignalPanel` props.',
      'The adapter is not a data source.',
      'The adapter is not a store.',
      'The adapter is not a persistence layer.',
      'The adapter is not a remote sync layer.',
      'The adapter is not a graph replacement.',
      'The adapter is not a runtime mount.',
      'The adapter should be pure and deterministic.',
      '## Proposed Adapter Owner / Path',
      'frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts',
      'it is close to the `NotesOverviewSignalPanel` component contract.',
      'it can be tested without mounting a runtime route.',
      'it can avoid importing `useNotesStore`.',
      'K-304 does not create this file. K-305 may create it.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines adapter input and output shapes', () => {
    const doc = readDoc();

    [
      '## Adapter Input Shape',
      'type NotesOverviewSignalPanelAdapterNoteInput = {',
      'readonly id: string;',
      'readonly title?: string | null;',
      'readonly updatedAt?: string | number | null;',
      'readonly createdAt?: string | number | null;',
      'readonly deletedAt?: string | number | null;',
      'readonly activeNoteId?: string | null;',
      'adapter does not read store itself.',
      'adapter does not read IndexedDB itself.',
      'adapter should not expose note body content.',
      'no `bodyPreview` and no `tags` for K-305.',
      '## Adapter Output Shape',
      'output should match the current `NotesOverviewSignalPanel` prop shape.',
      "readonly generatedFrom: 'local-note-metadata';",
      "readonly signalLabel: 'recent';",
      "readonly state: 'active' | 'idle' | 'unavailable';",
      'Output rules:',
      'output preserves the K-282/K-284 contract.',
      '`NotesOverviewSignalPanel` prop types are private to the component file.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines deterministic mapping rules and fixture-to-props strategy', () => {
    const doc = readDoc();

    [
      '## Mapping Rules',
      'filter out notes with `deletedAt`.',
      'sort recent notes by valid `updatedAt` descending when available.',
      'fallback to valid `createdAt` descending',
      'fallback to stable input order',
      'cap recent notes to five.',
      'do not mutate input arrays or objects.',
      'missing, blank, or legacy `Untitled` titles map',
      'active note maps to active writing only if `activeNoteId` matches',
      'empty notes maps to empty state',
      'invalid dates do not throw.',
      'adapter performs no persistence writes.',
      'adapter performs no remote reads.',
      'adapter performs no graph mutation.',
      '## Fixture-to-props Strategy',
      'K-305 should reuse existing fixture ideas',
      'Fixture data must not become runtime source of truth.',
      'Component tests remain separate',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines import boundary and runtime mount boundary', () => {
    const doc = readDoc();

    [
      '## Import Boundary Plan',
      'Allowed future imports for the adapter:',
      'Forbidden imports:',
      '`AppContent`.',
      '`NoteView`.',
      '`NoteViewEditorArea`.',
      '`useNotesStore`.',
      'IndexedDB modules.',
      'persistence modules.',
      'Supabase/authFetch modules.',
      'provider/sync modules.',
      'backup/export/import/restore modules.',
      '`NoteGraphView`.',
      '`NoteGraphViewLazy`.',
      '`window`.',
      '`document`.',
      '`fetch`.',
      '`localStorage`.',
      'future runtime caller passes already-selected local Notes metadata to the adapter.',
      '## Runtime Mount Boundary',
      'K-305 should not mount Signal Panel.',
      'Runtime mount should be K-306 or later',
      'K-304 approves no runtime exposure.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines K-305 test strategy, K-305 implementation boundary, K-306 outlook, and closure', () => {
    const doc = readDoc();

    [
      '## K-305 Test Strategy',
      'adapter unit test.',
      'source-boundary audit test.',
      'empty notes mapping test.',
      'recent notes mapping test.',
      'active note mapping test.',
      'missing title fallback test.',
      'invalid date resilience test.',
      'input immutability test.',
      'no store/persistence/Supabase imports test.',
      'no runtime route imports test.',
      'K-305 adapter tests should not need browser verification',
      '## K-305 Implementation Boundary',
      'Notes Overview / Signal Panel Pure Adapter Implementation',
      'add pure adapter module at `frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts`.',
      'no runtime mount.',
      'no live Notes data connection.',
      'no store/persistence/schema changes.',
      '## K-306 Outlook',
      'K-306 Adapter Closure Audit.',
      'K-306 Runtime Mount Plan.',
      'Runtime mount should not happen until adapter implementation is closed.',
      '## Closure Statement',
      'K-304 defines the future adapter implementation boundary only.',
      'No adapter is implemented.',
      'Adapter should be pure, local-derived, store-free, persistence-free, and remote-free.',
      'K-305 may implement pure adapter module and tests only.',
      'Runtime mount remains later work.',
      'Remote systems remain support layers.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps runtime files from importing the planned adapter path', () => {
    expect(existsSync(chosenAdapterPath)).toBe(true);

    const adapterStem = 'notesOverviewSignalPanelAdapter';
    [
      appContentPath,
      noteViewPath,
      noteViewEditorAreaPath,
      noteGraphViewPath,
      noteGraphViewLazyPath,
      notesStorePath,
      notePersistencePath,
      noteIndexedDbPath,
      signalPanelComponentPath,
    ].forEach(path => {
      expect(read(path), path).not.toContain(adapterStem);
    });
  });

  it('confirms current source facts used by the plan', () => {
    const signalPanel = read(signalPanelComponentPath);
    const signalPanelTest = read(signalPanelTestPath);
    const appContent = read(appContentPath);
    const noteView = read(noteViewPath);
    const noteViewEditorArea = read(noteViewEditorAreaPath);
    const notePersistence = read(notePersistencePath);

    expect(signalPanel).toContain('export function NotesOverviewSignalPanel');
    expect(signalPanel).toContain("readonly generatedFrom: 'local-note-metadata';");
    expect(signalPanelTest).toContain('caps recent notes to five without sorting the input array');
    expect(signalPanelTest).toContain('remains unmounted from runtime Notes and Static Preview surfaces');
    expect(appContent).toContain("import { NotesRouteBoundary } from './NotesRouteBoundary';");
    expect(appContent).toContain('<NotesRouteBoundary');
    expect(noteView).toContain('const notes = useNotesStore');
    expect(noteView).toContain('const activeNoteId = useNotesStore');
    expect(noteViewEditorArea).toContain('NoteGraphViewLazy');
    expect(notePersistence).toContain("export type NotesPersistenceMode = 'accountScoped' | 'indexeddb' | 'localStorage';");
  });

  it('uses deterministic source assertions without git, shell, or ref topology dependencies', () => {
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
