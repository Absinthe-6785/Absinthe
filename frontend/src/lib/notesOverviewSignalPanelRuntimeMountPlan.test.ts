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
  'K-307-notes-overview-signal-panel-runtime-mount-plan.md',
);
const k306DocPath = join(
  docsRoot,
  'K-306-notes-overview-signal-panel-adapter-closure-audit.md',
);
const k306TestPath = join(libRoot, 'notesOverviewSignalPanelAdapterClosureAudit.test.ts');
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

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-307 notes overview signal panel runtime mount plan', () => {
  it('adds K-307 plan doc and keeps prerequisite source artifacts present', () => {
    [
      docPath,
      k306DocPath,
      k306TestPath,
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

  it('states K-307 plan-only scope and explicit no-runtime boundaries', () => {
    const doc = readDoc();

    [
      'K-307 is docs/plan plus audit test only.',
      'K-307 does not mount Signal Panel.',
      'K-307 does not import adapter into runtime.',
      'K-307 does not connect live Notes data.',
      'K-307 chooses the K-308 next path: Notes Overview / Signal Panel Minimal Runtime Mount Implementation.',
      'no AppContent / NoteView code change.',
      'no NoteViewEditorArea change.',
      'no useNotesStore implementation.',
      'no IndexedDB/persistence import.',
      'no Supabase/provider/sync connection.',
      'no graph/Cosmos connection.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('recaps current adapter and component posture', () => {
    const doc = readDoc();

    [
      '## Current Adapter And Component Recap',
      '`NotesOverviewSignalPanel` is isolated, props-only, read-only, and unmounted.',
      'The pure adapter module exists at:',
      'frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts',
      'createNotesOverviewSignalPanelProps(input)',
      'The adapter remains unmounted.',
      'No runtime import/wiring exists.',
      'The local-first boundary remains preserved.',
      'The adapter and component have no Supabase/provider/sync/graph imports.',
      'The current runtime shape remains `AppContent -> NoteView -> NoteViewEditorArea`',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines mount objective and evaluates mount owner candidates', () => {
    const doc = readDoc();

    [
      '## Mount Objective',
      'show the Signal Panel in Notes Overview as a read-only signal summary.',
      'use adapter-generated props from local Notes-derived metadata.',
      'preserve the current Notes workflow.',
      'avoid graph replacement.',
      'avoid layout rewrite.',
      'avoid remote traffic.',
      'avoid persistence writes.',
      '## Mount Owner Candidates',
      '### Candidate 1: AppContent',
      'Recommendation: avoid `AppContent`.',
      '### Candidate 2: NoteView',
      'Recommendation: acceptable owner when paired with a small container/slot.',
      '### Candidate 3: NoteViewEditorArea',
      'Recommendation: avoid as the default K-308 mount owner.',
      '### Candidate 4: Notes Overview Route/Page/Container',
      'Recommendation: prefer this semantic slot if it can be implemented without new route/nav work.',
      '### Candidate 5: Small NotesOverviewSignalPanelContainer Or Slot Component',
      'Recommendation: preferred default for K-308.',
      '## Recommended Mount Owner',
      'Prefer the narrowest Notes Overview/page/container-level owner.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines adapter input ownership useNotesStore and persistence boundaries', () => {
    const doc = readDoc();

    [
      '## Adapter Input Ownership',
      'The runtime caller, not the adapter, creates local note metadata input.',
      'The adapter should remain store-free.',
      'The Signal Panel should remain store-free.',
      'Avoid IndexedDB direct reads.',
      'Avoid persistence module imports.',
      'Avoid Supabase/provider/sync calls.',
      'No writes are allowed.',
      'Local note metadata should be selected near `NoteView`',
      '`activeNoteId` should come from the existing Notes runtime state, not from persistence.',
      '## useNotesStore Boundary',
      '`useNotesStore` may be used only by the future runtime mount owner/container.',
      '`useNotesStore` must not be used by the adapter.',
      '`useNotesStore` must not be used by `NotesOverviewSignalPanel`.',
      'The selector should be narrow and read-only.',
      'No store writes are allowed.',
      'No remote fallback is allowed.',
      '## Persistence / IndexedDB Boundary',
      'No direct IndexedDB import is allowed in the adapter.',
      'No direct IndexedDB import is allowed in `NotesOverviewSignalPanel`.',
      'The mount should consume already-available local store state.',
      'No new persistence reads are allowed.',
      'No new persistence writes are allowed.',
      'The local-first source of truth remains unchanged.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines props delivery empty/loading/error and responsive/layout boundaries', () => {
    const doc = readDoc();

    [
      '## Signal Panel Props Delivery Plan',
      'K-308 should call `createNotesOverviewSignalPanelProps` with local note metadata.',
      'NoteView or Notes Overview parent',
      'narrow local metadata selection',
      'NotesOverviewSignalPanel props',
      'There should be no runtime side effects.',
      'There should be no mutation.',
      'There should be no remote request.',
      'There should be no fallback to Supabase.',
      '## Empty / Loading / Error State Posture',
      'Empty Notes state should render the safe Signal Panel empty state.',
      'Loading state should not trigger remote fetch.',
      'Error state should be local-only and non-destructive.',
      'The panel should not block NoteView editing.',
      '## Responsive / Layout Boundary',
      'The runtime mount should preserve the current Notes Overview layout.',
      'K-308 should not rewrite layout in the first mount.',
      'K-308 should not replace `NoteGraphView`.',
      'Mobile must avoid horizontal overflow.',
      'Manual/browser QA belongs to K-308 because K-307 has no runtime/browser behavior.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines graph Cosmos remote backup boundaries K-308 tests and K-309 outlook', () => {
    const doc = readDoc();

    [
      '## Graph / Cosmos Boundary',
      'The mount must not replace `NoteGraphView`.',
      'The mount must not mutate graph state.',
      'The mount must not connect Cosmos runtime.',
      'Signal Panel remains a readout, not graph navigation.',
      '## Supabase / Provider / Sync / Backup Boundary',
      'The runtime mount must not introduce Supabase calls.',
      'The runtime mount must not introduce `authFetch` calls.',
      'The runtime mount must not introduce provider/sync reads.',
      'The runtime mount must not introduce backup/export/import/restore behavior.',
      'The runtime mount should be local-only.',
      '## K-308 Implementation Boundary',
      'Recommended K-308: Notes Overview / Signal Panel Minimal Runtime Mount Implementation.',
      'add a small runtime container or slot at the chosen Notes owner.',
      'import adapter and Signal Panel only in that owner/container.',
      '## K-308 Tests',
      'mount renders panel in the selected Notes Overview/container context.',
      'no Supabase/provider/sync calls.',
      'adapter still pure.',
      'Signal Panel still props-only.',
      '`NoteGraphView` still present if relevant.',
      '## K-309 Outlook',
      'K-309 Runtime Mount Closure Audit.',
      'Recommended default: K-309 Runtime Mount Closure Audit if K-308 implements the minimal mount.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('lists non-goals and closes with runtime mount absence', () => {
    const doc = readDoc();

    [
      '## Non-goals',
      'no Signal Panel runtime mount in K-307.',
      'no adapter runtime import.',
      'no AppContent / NoteView code change.',
      'no NoteViewEditorArea change.',
      'no live Notes data connection.',
      'no useNotesStore implementation.',
      'no IndexedDB/persistence import.',
      'no store/persistence/schema change.',
      'no Supabase/provider/sync connection.',
      'no authFetch usage.',
      'no graph/Cosmos connection.',
      'no NoteGraphView replacement.',
      'no layout rewrite.',
      'no route/nav rewrite.',
      'no static preview generator change.',
      'no backup/export/import/restore behavior change.',
      'no auth change.',
      'no Supabase traffic guardrail change.',
      'no Health/Schedule change.',
      'no assets/fonts/dependencies.',
      'no generated artifacts.',
      '## Closure Statement',
      'K-307 defines runtime mount boundary only.',
      'No runtime mount is implemented.',
      'Adapter remains pure and unmounted.',
      'Signal Panel remains isolated and unmounted.',
      'Notes runtime remains local-first.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('confirms runtime AppContent and NoteView surfaces do not import the adapter or panel for mount', () => {
    const appContent = read(appContentPath);
    const noteView = read(noteViewPath);
    const noteViewEditorArea = read(noteViewEditorAreaPath);

    [appContent, noteView, noteViewEditorArea].forEach(source => {
      expect(source).not.toMatch(/notesOverviewSignalPanelAdapter/);
      expect(source).not.toMatch(/createNotesOverviewSignalPanelProps/);
      expect(source).not.toMatch(/NotesOverviewSignalPanel/);
    });
  });

  it('confirms K-307 audit test avoids git ref topology and shell-driven diff checks', () => {
    const source = read(__filename);
    const childProcessToken = ['child', 'process'].join('_');
    const execToken = ['exec', 'Sync'].join('');
    const spawnToken = ['spawn', 'Sync'].join('');
    const gitDiffToken = ['git', 'diff'].join(' ');
    const gitRevParseToken = ['git', 'rev-parse'].join(' ');
    const mainHeadToken = ['main', 'HEAD'].join('...');
    const originMainToken = ['origin', 'main'].join('/');
    const headParentToken = ['HEAD', '^'].join('');

    [
      `node:${childProcessToken}`,
      execToken,
      spawnToken,
      gitDiffToken,
      gitRevParseToken,
      mainHeadToken,
      originMainToken,
      headParentToken,
    ].forEach(forbidden => {
      expect(source).not.toContain(forbidden);
    });
  });
});
