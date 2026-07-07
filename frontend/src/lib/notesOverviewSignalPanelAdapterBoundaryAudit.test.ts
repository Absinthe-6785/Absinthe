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
  'K-303-notes-overview-signal-panel-adapter-boundary-audit.md',
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
const staticPreviewPath = join(componentsRoot, 'notes', 'NotesCosmosStaticPreview.tsx');
const appContentPath = join(componentsRoot, 'AppContent.tsx');
const noteViewPath = join(componentsRoot, 'views', 'NoteView.tsx');
const noteViewEditorAreaPath = join(
  componentsRoot,
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const noteGraphViewLazyPath = join(
  componentsRoot,
  'views',
  'noteview',
  'NoteGraphViewLazy.tsx',
);
const noteGraphViewPath = join(componentsRoot, 'views', 'NoteGraphView.tsx');
const notesStorePath = join(srcRoot, 'store', 'useNotesStore.ts');
const notePersistencePath = join(libRoot, 'notePersistence.ts');
const noteIndexedDbPath = join(libRoot, 'noteIndexedDb.ts');

const priorSignalPanelArtifacts = [
  join(docsRoot, 'K-278-notes-overview-signal-panel-concept-plan.md'),
  join(docsRoot, 'K-279-notes-overview-signal-panel-data-boundary-audit.md'),
  join(docsRoot, 'K-280-notes-overview-signal-panel-data-contract-plan.md'),
  join(docsRoot, 'K-281-notes-overview-signal-panel-component-boundary-plan.md'),
  join(docsRoot, 'K-282-notes-overview-signal-panel-contract-fixture-spec.md'),
  join(docsRoot, 'K-283-notes-overview-signal-panel-isolated-component-plan.md'),
  join(docsRoot, 'K-285-notes-overview-signal-panel-isolated-component-closure-audit.md'),
  join(libRoot, 'notesOverviewSignalPanelConceptPlan.test.ts'),
  join(libRoot, 'notesOverviewSignalPanelDataBoundaryAudit.test.ts'),
  join(libRoot, 'notesOverviewSignalPanelDataContractPlan.test.ts'),
  join(libRoot, 'notesOverviewSignalPanelComponentBoundaryPlan.test.ts'),
  join(libRoot, 'notesOverviewSignalPanelContractFixtureSpec.test.ts'),
  join(libRoot, 'notesOverviewSignalPanelIsolatedComponentPlan.test.ts'),
  join(libRoot, 'notesOverviewSignalPanelIsolatedComponentClosureAudit.test.ts'),
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-303 notes overview signal panel adapter boundary audit', () => {
  it('adds K-303 audit doc and keeps prior Signal Panel artifacts present', () => {
    [
      docPath,
      signalPanelComponentPath,
      signalPanelTestPath,
      staticPreviewPath,
      appContentPath,
      noteViewPath,
      noteViewEditorAreaPath,
      noteGraphViewLazyPath,
      noteGraphViewPath,
      notesStorePath,
      notePersistencePath,
      noteIndexedDbPath,
      ...priorSignalPanelArtifacts,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states audit-only scope and explicit non-implementation boundaries', () => {
    const doc = readDoc();

    [
      'K-303 is docs/source boundary audit plus audit test only.',
      'K-303 does not implement adapter.',
      'K-303 does not mount Signal Panel.',
      'K-303 does not connect Notes runtime data.',
      'K-303 does not connect Supabase/provider/sync data.',
      'K-303 does not change layout, route, graph, persistence, auth, backup, or traffic guardrail behavior.',
      'no adapter implementation.',
      'no Signal Panel runtime mount.',
      'no Notes runtime data connection.',
      'no Supabase/provider/sync connection.',
      'no layout rewrite.',
      'no graph/Cosmos runtime connection.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('summarizes K-278 through K-302 continuity and product resumption', () => {
    const doc = readDoc();

    [
      'K-278 defined Notes Overview / Signal Panel as a concept-only orientation/readout surface.',
      'K-279 audited the data boundary',
      'K-280 planned the data contract',
      'K-281 planned a props-first component boundary',
      'K-282 specified deterministic contract fixtures',
      'K-283 planned the isolated component skeleton',
      'K-284 implemented the isolated component and its component test.',
      'K-285 closed the isolated component line',
      'K-286 through K-295 closed auth restoration and test/dev verification.',
      'K-296 through K-302 closed Supabase usage/quota source facts',
      'Product work can resume',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits current Signal Panel and Notes Overview postures', () => {
    const doc = readDoc();

    [
      '## Current Signal Panel Posture',
      'frontend/src/components/notes/NotesOverviewSignalPanel.tsx',
      'frontend/src/components/notes/NotesOverviewSignalPanel.test.ts',
      'Signal Panel is props-only.',
      'Signal Panel is read-only.',
      'Signal Panel is isolated and unmounted.',
      'Signal Panel has no store reads.',
      'Signal Panel has no provider reads.',
      'Signal Panel has no Supabase reads.',
      'Signal Panel has no authFetch calls.',
      'Signal Panel has no route/nav ownership.',
      'Signal Panel has no graph/KIS ownership.',
      'Signal Panel does not replace `NoteGraphView`.',
      'Signal Panel has no runtime data source.',
      '## Current Notes Overview Posture',
      'frontend/src/components/AppContent.tsx',
      'frontend/src/components/views/NoteView.tsx',
      'frontend/src/components/views/noteview/NoteViewEditorArea.tsx',
      'AppContent.tsx` renders `<NoteView showToast={showToast} />`',
      'NoteViewEditorArea.tsx` mounts `NoteGraphViewLazy`',
      'NotesOverviewSignalPanel` is not imported or mounted',
      'useNotesStore.ts` owns Notes runtime state',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits local-first source of truth and static fixture boundaries', () => {
    const doc = readDoc();

    [
      '## Local-first Source-of-truth Audit',
      'Notes runtime source of truth remains local-first.',
      'notePersistence.ts` uses IndexedDB primary and localStorage fallback.',
      'adapter must read from local Notes runtime data or derived local selectors only.',
      'adapter must not make Supabase the source of truth.',
      'provider/sync/backup systems remain support layers',
      'Signal Panel may summarize local metadata.',
      '## Static / Fixture Data Boundary Audit',
      'test-local fixtures',
      "generatedFrom: 'local-note-metadata'",
      '`recentNotes` with id, title, optional updated/created labels',
      '`activeWriting` with `active`, `idle`, or `unavailable`.',
      '`emptyState` with note presence',
      'Fields safe for future adapter:',
      'Missing for runtime adapter:',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('identifies safe adapter seam, forbidden flows, and runtime mount boundary', () => {
    const doc = readDoc();

    [
      '## Safe Adapter Seam Audit',
      'create a pure selector/mapper from local Notes-derived data to `NotesOverviewSignalPanel` props.',
      'frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts',
      'frontend/src/lib/notesOverviewSignalPanelAdapter.ts',
      'avoid React hooks.',
      'avoid store subscriptions.',
      'avoid Supabase/authFetch/provider/sync/backup calls.',
      'Adapter implementation and runtime mount should remain separate PRs',
      '## Forbidden Data-flow Audit',
      'Signal Panel directly reading Notes store.',
      'Signal Panel directly reading IndexedDB.',
      'Signal Panel directly calling Supabase.',
      'Signal Panel directly calling `authFetch`.',
      'Signal Panel directly calling provider APIs.',
      'Signal Panel directly calling sync APIs.',
      'Signal Panel replacing `NoteGraphView`.',
      'adapter performing writes.',
      'adapter causing remote fetch.',
      'adapter changing persistence schema.',
      '## Runtime Mount Boundary',
      'K-303 does not mount Signal Panel.',
      'runtime mount requires a separate plan/implementation.',
      'runtime mount should happen only after adapter contract is implemented and tested.',
      'runtime mount should not change Supabase usage posture.',
      'K-303 approves no runtime exposure.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines future adapter tests, K-304 matrix, recommendation, and closure', () => {
    const doc = readDoc();

    [
      '## Future Adapter Test Strategy',
      'pure adapter unit tests.',
      'local notes to props mapping.',
      'no Supabase/provider calls.',
      'no sync/backup calls.',
      'no store writes.',
      'no graph mutation.',
      'no runtime mount.',
      '## K-304 Implementation Candidate Matrix',
      '| Notes Overview / Signal Panel Adapter Implementation Plan | docs/plan plus audit test only |',
      '| Pure adapter/selector implementation | small pure mapper, no runtime mount |',
      '| Runtime mount implementation | mount Signal Panel with adapter data |',
      'Recommended K-304 path:',
      'K-304 Notes Overview / Signal Panel Adapter Implementation Plan',
      'Not recommended:',
      'runtime mount before adapter plan.',
      'provider/Supabase-backed Signal Panel.',
      '## Closure Statement',
      'K-303 locks current adapter boundary facts only.',
      'Signal Panel remains isolated and unmounted.',
      'Notes runtime remains local-first.',
      'future adapter should be pure, local-derived, and tested before mount.',
      'Remote systems remain support layers.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps the Signal Panel component props-only and free of forbidden runtime imports', () => {
    const component = read(signalPanelComponentPath);

    expect(component).toContain('export function NotesOverviewSignalPanel');
    expect(component).toContain("readonly generatedFrom: 'local-note-metadata';");
    expect(component).toContain('data-notes-overview-signal-panel');

    [
      /from ['"].*useNotesStore/,
      /from ['"].*store/,
      /from ['"].*notePersistence/,
      /from ['"].*noteIndexedDb/,
      /from ['"].*supabase/i,
      /from ['"].*authFetch/i,
      /from ['"].*provider/i,
      /from ['"].*sync/i,
      /from ['"].*backup/i,
      /from ['"].*restore/i,
      /from ['"].*NoteGraphView/,
      /from ['"].*LocalGraphView/,
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*BlockEditor/,
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

  it('keeps Signal Panel unmounted from current runtime and static preview surfaces', () => {
    [
      appContentPath,
      noteViewPath,
      noteViewEditorAreaPath,
      staticPreviewPath,
    ].forEach(path => {
      expect(read(path), path).not.toContain('NotesOverviewSignalPanel');
    });

    expect(read(appContentPath)).toContain("<NoteView showToast={showToast} />");
    expect(read(noteViewEditorAreaPath)).toContain('NoteGraphViewLazy');
  });

  it('confirms local-first and graph source facts without changing them', () => {
    const notesStore = read(notesStorePath);
    const notePersistence = read(notePersistencePath);
    const noteGraphLazy = read(noteGraphViewLazyPath);
    const noteGraph = read(noteGraphViewPath);

    expect(notesStore).toContain('hydrateFromDB');
    expect(notesStore).toContain('initNotesStorage');
    expect(notesStore).toContain('loadNotesAsync');
    expect(notesStore).toContain('saveNotesAsync');
    expect(notePersistence).toContain("export type NotesPersistenceMode = 'indexeddb' | 'localStorage';");
    expect(notePersistence).toContain('saveNotesToIndexedDb');
    expect(notePersistence).toContain('saveNotesToLocalStorage');
    expect(noteGraphLazy).toContain("import('../NoteGraphView')");
    expect(noteGraph).toContain('export function NoteGraphView');
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
