import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const docsRoot = join(root, 'docs');
const srcRoot = join(root, 'src');
const componentsRoot = join(srcRoot, 'components');
const notesRoot = join(componentsRoot, 'notes');
const libRoot = join(srcRoot, 'lib');

const docPath = join(docsRoot, 'K-310-notes-overview-signal-panel-authenticated-visual-qa-closure.md');
const k309DocPath = join(docsRoot, 'K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md');
const k309TestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts');
const k307DocPath = join(docsRoot, 'K-307-notes-overview-signal-panel-runtime-mount-plan.md');
const k307TestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountPlan.test.ts');
const containerPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.tsx');
const containerTestPath = join(notesRoot, 'NotesOverviewSignalPanelContainer.test.ts');
const runtimeMountBoundaryTestPath = join(libRoot, 'notesOverviewSignalPanelRuntimeMountBoundaryAudit.test.ts');
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

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

describe('K-310 notes overview signal panel authenticated visual QA closure', () => {
  it('adds the K-310 closure doc and preserves prerequisite source artifacts', () => {
    [
      docPath,
      k309DocPath,
      k309TestPath,
      k307DocPath,
      k307TestPath,
      containerPath,
      containerTestPath,
      runtimeMountBoundaryTestPath,
      adapterPath,
      adapterTestPath,
      signalPanelPath,
      signalPanelTestPath,
      noteViewSidebarPath,
      workspaceDashboardPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('states K-310 scope and explicit non-goals', () => {
    const doc = readDoc();

    [
      'K-310 is docs/QA checklist closure plus audit test only.',
      'K-310 does not add auth bypass.',
      'K-310 does not modify runtime UI.',
      'K-310 does not claim authenticated visual QA completion without real evidence.',
      'no fake production session.',
      'no storageState artifact.',
      'no test credentials.',
      'no Signal Panel UI feature expansion.',
      'no Signal Panel layout redesign.',
      'no selector optimization implementation.',
      'no Supabase/provider/sync connection.',
      'no graph/Cosmos connection.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('summarizes the current mounted Signal Panel posture from source-grounded paths', () => {
    const doc = readDoc();

    [
      '## Current Mounted Signal Panel Posture',
      'NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> NotesOverviewSignalPanel',
      'frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx',
      'frontend/src/components/notes/NotesOverviewSignalPanel.tsx',
      'frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts',
      'The mount remains local-only and read-only.',
      'The adapter remains pure.',
      'The Signal Panel remains props-only and read-only.',
      '`AppContent` is unchanged by the Signal Panel mount.',
      '`NoteViewEditorArea` is unchanged by the Signal Panel mount.',
      'The full notes-array subscription note remains a future optimization candidate only.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('records authenticated QA status without claiming unavailable evidence', () => {
    const doc = readDoc();

    [
      '## Authenticated QA Status',
      'Authenticated protected-shell visual QA is not completed in K-310',
      'real authenticated session, credentials, and release QA environment are not available',
      'K-310 does not add auth bypass.',
      'K-310 does not add a fake production session.',
      'K-310 does not commit a storageState artifact.',
      'K-310 does not add test credentials.',
      'Authenticated protected-shell visual QA remains a release/manual QA gap.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines the authenticated visual QA checklist for auth Notes layout viewports and observations', () => {
    const doc = readDoc();

    [
      '## Authenticated Visual QA Checklist',
      '### Access And Auth',
      'Use a real authenticated Supabase session.',
      'Verify the protected shell opens without bypass.',
      'Verify login behavior is not modified.',
      'Verify auth callback behavior is not modified.',
      'Verify logout behavior is not modified.',
      '### Notes Workspace',
      'Open the Notes workspace.',
      'Verify the NoteView / Notes Overview route renders.',
      'Verify the Signal Panel is visible in the intended WorkspaceDashboardView slot.',
      'Verify empty local notes state does not crash.',
      'Verify recent local notes render in the Signal Panel.',
      'Verify deleted notes remain hidden from recent signal content.',
      'Verify the panel is read-only and does not add action buttons.',
      '### Layout',
      'Verify editor and NoteViewEditorArea remain usable.',
      'Verify NoteGraphView remains visible and usable where expected.',
      'Verify the Signal Panel does not replace the graph.',
      '### Viewports',
      'Desktop: 1440 x 900.',
      'Laptop/tablet: 1024 x 768.',
      'Mobile: 390 x 844.',
      'Verify no horizontal overflow.',
      '### Console And Network',
      'Verify no new console errors are caused by the Signal Panel mount.',
      'Verify no unexpected Supabase calls are caused by the Signal Panel mount.',
      'Verify no provider calls are caused by the Signal Panel mount.',
      'Verify no sync calls are caused by the Signal Panel mount.',
      '### Evidence To Record',
      'Commit or deploy identifier.',
      'Console observations.',
      'Network observations.',
      'Pass, fail, blocker, or partial status.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('defines release gap policy browser execution notes runtime non-change audit and CI evidence audit', () => {
    const doc = readDoc();

    [
      '## Release / Manual QA Gap Policy',
      'Authenticated protected-shell visual QA must be completed before release',
      'Lack of credentials must not be solved by bypassing auth.',
      'Release QA must use a real project and a real authenticated session.',
      'Failures should create a targeted K-ticket, not a broad rewrite.',
      '## Browser QA Execution Notes',
      'K-310 does not perform authenticated browser QA.',
      'K-310 only creates the authenticated visual QA closure checklist',
      'No real authenticated browser session was used.',
      'No production auth bypass was used.',
      'No fake production session was used.',
      'No storageState artifact was committed.',
      '## Runtime Non-change Audit',
      'K-310 changes no runtime UI files.',
      'K-310 changes no container behavior.',
      'K-310 changes no adapter behavior.',
      'K-310 changes no Signal Panel component behavior.',
      'K-310 changes no AppContent behavior.',
      'K-310 changes no NoteViewEditorArea behavior.',
      'K-310 adds no Supabase, provider, sync, backup, graph, or Cosmos connection.',
      '## Test And CI Evidence Audit',
      'K-310 should run the K-310 audit test.',
      'K-310 should rerun the K-309 runtime mount closure audit test.',
      'K-310 should run `npm run typecheck`.',
      'K-310 should run `npm run build`.',
      'K-310 should run `git diff --check`.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('lists remaining gaps recommends K-311 path non-goals inspected files and closure statement', () => {
    const doc = readDoc();

    [
      '## Remaining Gaps',
      'Authenticated protected-shell visual QA remains a release/manual QA gap.',
      'Full notes-array subscription remains a future optimization candidate.',
      'Cosmos and graph integration remain future work.',
      '## K-311 Decision',
      'K-311 Notes Overview / Signal Panel Release QA Evidence Capture',
      'docs/QA evidence update only after real authenticated testing.',
      'Not recommended:',
      'auth bypass for QA.',
      'Supabase or provider-backed Signal Panel.',
      '## Non-goals',
      '## Files Inspected',
      'frontend/src/components/views/noteview/NoteViewSidebar.tsx',
      'frontend/src/components/views/features/knowledge/components/WorkspaceDashboardView.tsx',
      '## Closure Statement',
      'K-310 defines authenticated visual QA closure requirements.',
      'K-310 does not modify runtime behavior.',
      'Authenticated QA is preserved honestly as a release/manual gap.',
      'No auth bypass or fake session is introduced.',
      'Signal Panel runtime mount remains narrow and local-only.',
      'Future work should be driven by QA evidence.',
      'Remote systems remain support layers.',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('verifies current source still exposes the intended slot and local-only container facts', () => {
    const sidebar = read(noteViewSidebarPath);
    const dashboard = read(workspaceDashboardPath);
    const container = read(containerPath);
    const adapter = read(adapterPath);
    const signalPanel = read(signalPanelPath);

    expect(sidebar).toContain('../../notes/NotesOverviewSignalPanelContainer');
    expect(sidebar).toContain('signalPanel={<NotesOverviewSignalPanelContainer />}');
    expect(dashboard).toContain('signalPanel?: React.ReactNode');
    expect(dashboard).toContain('data-testid="notes-overview-signal-panel-slot"');
    expect(container).toContain("import { useNotesStore } from '../../store/useNotesStore'");
    expect(container).toContain('createNotesOverviewSignalPanelProps(adapterInput)');
    expect(adapter).toContain('export function createNotesOverviewSignalPanelProps');
    expect(adapter).toContain("generatedFrom: 'local-note-metadata'");
    expect(signalPanel).toContain('export function NotesOverviewSignalPanel');
  });

  it('keeps K-310 test deterministic without git ref topology or committed auth artifacts', () => {
    const testSource = read(__filename);
    const doc = readDoc();

    [
      'origin' + '/main',
      'HEAD' + '^',
      'exec' + 'Sync',
      'spawn' + 'Sync',
      'child' + '_process',
    ].forEach(forbidden => {
      expect(testSource).not.toContain(forbidden);
    });

    expect(doc).toContain('No storageState artifact was committed.');
    expect(doc).toContain('K-310 does not add test credentials.');
    expect(doc).toContain('No production auth bypass was used.');
  });
});
