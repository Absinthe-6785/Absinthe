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

const docPath = join(docsRoot, 'K-315-notes-signal-panel-optimization-line-closure-audit.md');
const k314DocPath = join(docsRoot, 'K-314-notes-signal-panel-optimization-closure-audit.md');
const k312DocPath = join(docsRoot, 'K-312-notes-runtime-signal-panel-optimization-implementation-plan.md');
const k311DocPath = join(docsRoot, 'K-311-notes-runtime-signal-panel-optimization-source-facts-audit.md');
const k310DocPath = join(docsRoot, 'K-310-notes-overview-signal-panel-authenticated-visual-qa-closure.md');
const k309DocPath = join(docsRoot, 'K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md');
const k307DocPath = join(docsRoot, 'K-307-notes-overview-signal-panel-runtime-mount-plan.md');

const k315TestPath = join(libRoot, 'notesSignalPanelOptimizationLineClosureAudit.test.ts');
const k314TestPath = join(libRoot, 'notesSignalPanelOptimizationClosureAudit.test.ts');
const k312TestPath = join(libRoot, 'notesRuntimeSignalPanelOptimizationImplementationPlan.test.ts');
const k311TestPath = join(libRoot, 'notesRuntimeSignalPanelOptimizationSourceFactsAudit.test.ts');
const k310TestPath = join(libRoot, 'notesOverviewSignalPanelAuthenticatedVisualQaClosure.test.ts');
const k309TestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts');
const k308BoundaryTestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountBoundaryAudit.test.ts');
const k305AdapterImplementationTestPath = join(libRoot, 'notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts');
const k305AdapterTestPath = join(notesRoot, 'notesOverviewSignalPanelAdapter.test.ts');

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
const viteConfigPath = join(root, 'vite.config.ts');

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

describe('K-315 notes signal panel optimization line closure audit', () => {
  it('adds the K-315 line closure doc and preserves line artifacts', () => {
    [
      docPath,
      k315TestPath,
      k314DocPath,
      k314TestPath,
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
      viteConfigPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states docs/source-only scope and non-goals', () => {
    const doc = readDoc();

    [
      'K-315 is docs/source line closure audit plus audit test only.',
      'K-315 does not implement additional optimization.',
      'K-315 does not change runtime behavior.',
      'no additional selector optimization.',
      'no store subscription architecture change.',
      'no memoization layer.',
      'no layout polish.',
      'no adapter contract change.',
      'no Signal Panel UI change.',
      'no Supabase/provider/sync connection.',
      'no graph/Cosmos connection.',
      'no Vite/build config change.',
      'no auth bypass.',
      'no generated artifacts.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('includes the K-311 through K-315 timeline', () => {
    const doc = readDoc();

    [
      '## Optimization Line Timeline',
      '### K-311 Source Facts Audit',
      '### K-312 Implementation Plan',
      '### K-313 Narrow Selector Optimization',
      '### K-314 Optimization Closure Audit',
      '### K-315 Line Closure Audit',
      'Changed behavior: none.',
      'K-313 optimized adapter input churn only.',
      'K-313 did not remove notes store subscription churn.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('summarizes final posture and the exact optimization boundary', () => {
    const doc = readDoc();

    [
      '## Final Current Posture',
      'NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> notesOverviewSignalPanelAdapter -> NotesOverviewSignalPanel',
      'K-313 introduced a container-local selector optimization.',
      'Adapter input churn is reduced.',
      'Notes store subscription churn remains.',
      'The adapter contract is unchanged.',
      'The Signal Panel component is unchanged.',
      'Layout is unchanged.',
      'Store, schema, and persistence are unchanged.',
      '## What Was Optimized',
      'K-313 reduced adapter input snapshot churn.',
      'When local Notes state changes but Signal Panel metadata is unchanged, the selector can reuse the previous adapter input snapshot.',
      'The optimization is behavior-preserving.',
      'The optimization is local-only.',
      'The optimization is container-local.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('states what was not optimized and prevents churn overclaiming', () => {
    const doc = readDoc();

    [
      '## What Was Not Optimized',
      'Notes store subscription churn was not removed.',
      'Store architecture was not changed.',
      'No store-level derived selector was added.',
      'No new memoization layer was added beyond the K-313 container selector snapshot reuse.',
      'No adapter-level cache was added.',
      'No UI/layout optimization was done.',
      'No Vite/build config optimization was done.',
      'No graph/Cosmos optimization was done.',
      'No remote/provider optimization was done.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines comparator stale snapshot and evidence policy', () => {
    const doc = readDoc();

    [
      '## Comparator And Stale Snapshot Policy',
      'The comparator is valid only as long as the adapter input contract remains limited to the current local note metadata fields.',
      'Future adapter fields require comparator and test updates.',
      'Future Signal Panel fields require comparator and test updates.',
      '`body`, `content`, `tags`, `properties`, `relations`, graph edges, editor state, provider state, sync state, and backup state remain excluded today.',
      'Stale snapshot risk is known and bounded by the current adapter contract.',
      'Future contract expansion must not bypass comparator review.',
      '## Evidence Policy',
      'Authenticated visual QA evidence remains the release/manual gap preserved by K-310 unless completed later.',
      'Performance evidence is not claimed by K-311, K-312, K-313, K-314, or K-315.',
      'Vite chunk and dynamic-import warnings are not attributed to Signal Panel without proof.',
      'Future optimization must be evidence-based.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('states stop-go decision and next path', () => {
    const doc = readDoc();

    [
      '## Stop Go Decision',
      'Stop additional Signal Panel optimization now.',
      'Do not implement store subscription architecture changes without evidence.',
      'Do not implement layout polish under the optimization banner.',
      'Do not modify Vite/build config for unrelated warnings.',
      'Only reopen Signal Panel optimization if QA/performance evidence shows a real issue.',
      '## Next Path',
      'K-316 Notes Signal Panel Line Hold / Release QA Evidence Gate.',
      'docs/QA gate or release checklist update only.',
      'no runtime changes.',
      'further Signal Panel work is paused until authenticated QA/performance evidence exists.',
      'Not recommended:',
      'additional selector optimization.',
      'store subscription architecture refactor.',
      'memoization layer.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('audits runtime source boundaries and test evidence', () => {
    const doc = readDoc();

    [
      '## Runtime Source Boundary Audit',
      'Container boundary: `NotesOverviewSignalPanelContainer` remains the only runtime bridge from local Notes state to Signal Panel props.',
      'Adapter boundary: `notesOverviewSignalPanelAdapter` remains pure, store-free, and local metadata driven.',
      'Signal Panel component boundary: `NotesOverviewSignalPanel` remains props-only and read-only.',
      '`useNotesStore` boundary: store access remains container-local and read-only.',
      '`AppContent` and `App.tsx` boundary: no broad app-shell wiring is part of this optimization line.',
      '`NoteViewEditorArea` boundary: editor and graph surfaces remain separate.',
      'Supabase/provider/sync/backup/auth boundary: no Supabase, `authFetch`, provider, sync, backup, export, import, restore, preflight, auth, auth bypass, production bypass, credentials, service-role artifact, or storageState artifact is added.',
      'Graph/Cosmos boundary: no `NoteGraphView` replacement, no graph mutation, no Cosmos import, and no Cosmos runtime connection is introduced.',
      'Vite/build config boundary: no build config change is introduced.',
      '## Test And CI Evidence Audit',
      'K-314 audit test passed: 1 file, 11 tests.',
      'K-313 container/runtime-boundary focused group passed: 8 files, 76 tests.',
      'Notes/local-first tests passed: 7 files, 78 tests.',
      'Existing Vite warnings remain separate and are not attributed to Signal Panel selector behavior.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('lists remaining gaps and closes the line', () => {
    const doc = readDoc();

    [
      '## Remaining Gaps',
      'Authenticated visual QA evidence remains incomplete unless a real authenticated QA run is completed.',
      'Performance evidence is not claimed.',
      'Notes store subscription churn remains.',
      'Future comparator expansion risk remains if the adapter contract grows.',
      'Vite warnings remain separate.',
      '## Closure Statement',
      'K-315 closes the Notes Signal Panel optimization line.',
      'K-313 optimized adapter input churn only.',
      'Notes store subscription churn remains.',
      'Further Signal Panel optimization is paused until authenticated QA/performance evidence requires it.',
      'Remote systems remain support layers.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('confirms current source invariants for the K-313 container selector', () => {
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

  it('confirms mount path and broad runtime boundaries remain source-grounded', () => {
    const sidebar = read(noteViewSidebarPath);
    const dashboard = read(workspaceDashboardPath);
    const appContent = read(appContentPath);
    const noteViewEditorArea = read(noteViewEditorAreaPath);
    const viteConfig = read(viteConfigPath);

    expect(sidebar).toContain("import { NotesOverviewSignalPanelContainer } from '../../notes/NotesOverviewSignalPanelContainer'");
    expect(sidebar).toContain('signalPanel={<NotesOverviewSignalPanelContainer />}');
    expect(dashboard).toContain('signalPanel?: React.ReactNode');
    expect(dashboard).toContain('data-testid="notes-overview-signal-panel-slot"');
    expect(appContent).not.toContain('NotesOverviewSignalPanelContainer');
    expect(noteViewEditorArea).not.toContain('NotesOverviewSignalPanelContainer');
    expect(viteConfig).not.toContain('NotesOverviewSignalPanel');
  });
});
