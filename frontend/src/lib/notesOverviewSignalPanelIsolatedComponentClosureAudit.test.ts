import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-285-notes-overview-signal-panel-isolated-component-closure-audit.md',
);
const componentPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesOverviewSignalPanel.tsx');
const componentTestPath = join(
  process.cwd(),
  'src',
  'components',
  'notes',
  'NotesOverviewSignalPanel.test.ts',
);
const containerPath = join(
  process.cwd(),
  'src',
  'components',
  'notes',
  'NotesOverviewSignalPanelContainer.tsx',
);
const containerTestPath = join(
  process.cwd(),
  'src',
  'components',
  'notes',
  'NotesOverviewSignalPanelContainer.test.ts',
);
const noteViewPath = join(process.cwd(), 'src', 'components', 'views', 'NoteView.tsx');
const noteViewEditorAreaPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const staticPreviewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const emptyStatePath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NotesPixelCosmosEmptyState.tsx',
);
const noteViewSidebarPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NoteViewSidebar.tsx',
);
const generatedPreviewPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readDoc(): string {
  return read(docPath);
}

function collectSourceFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root);
  return entries.flatMap(entry => {
    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return collectSourceFiles(path);
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      return [path];
    }

    return [];
  });
}

describe('K-285 notes overview signal panel isolated component closure audit', () => {
  it('exists and states docs/audit only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-285 Notes Overview / Signal Panel Isolated Component Closure Audit',
      'K-285 closes the K-284 isolated Notes Overview / Signal Panel component skeleton.',
      'K-285 is docs/audit plus audit test only.',
      'K-285 does not modify the component.',
      'K-285 does not mount the component.',
      'K-285 does not add adapter/runtime data wiring.',
      'K-285 does not change route/nav/panel behavior.',
      'K-285 does not change stores, schema, persistence',
      'graph/KIS',
      'backup/Data Safety',
      'BlockEditor internals',
      'K-285 chooses the K-286 next path: Notes Overview / Signal Panel Adapter Boundary Audit.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-284', () => {
    const doc = readDoc();

    for (const required of [
      'K-278 defined Signal Panel as a concept-only orientation/readout surface.',
      'K-279 audited local-first data boundaries',
      'K-280 defined a draft data contract',
      'K-281 defined a props-first component boundary.',
      'K-282 defined deterministic contract fixture cases.',
      'K-283 planned the isolated component skeleton',
      'K-284 implemented the isolated component skeleton.',
      '`NotesOverviewSignalPanel` now exists as an isolated component',
      'Signal Panel remains unmounted.',
      'No runtime data adapter exists.',
      'No runtime data wiring exists.',
      'No route/nav/panel exists for Signal Panel.',
      'Signal Panel remains orientation/readout, not Cosmos Map.',
      'Empty State line remains closed.',
      'Static Preview line remains closed.',
      '`NoteGraphView` remains the full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'Backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits K-284 implementation closure', () => {
    const doc = readDoc();

    for (const required of [
      '## K-284 Implementation Closure Audit',
      'K-284 changed files were component plus test only:',
      'frontend/src/components/notes/NotesOverviewSignalPanel.tsx',
      'frontend/src/components/notes/NotesOverviewSignalPanel.test.ts',
      'The component is props-only.',
      'The component is read-only.',
      'The component is unmounted.',
      'The component uses no adapter.',
      'The component uses no direct store reads.',
      'The component uses no route/nav/panel helpers.',
      'The component uses no graph/KIS.',
      'The component uses no provider/sync.',
      'The component uses no backup/Data Safety.',
      'The component uses no BlockEditor/editor internals.',
      'K-284 committed no generated artifacts.',
      'Package and Vite config remained unchanged.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits props-only read-only and fixture strategy', () => {
    const doc = readDoc();

    for (const required of [
      '## Props-only / Read-only Audit',
      '`NotesOverviewSignalPanel` receives data via props.',
      'It does not query global stores.',
      'It does not create a data adapter.',
      'It does not mutate data.',
      'It does not navigate.',
      'It does not create notes.',
      'It does not expose active callbacks for K-284.',
      'It renders deterministic output from passed props.',
      'Any future callbacks',
      'require a separate explicit gate.',
      '## Fixture Strategy Audit',
      'K-284 tests use test-local fixtures',
      'No production fixture module was added.',
      'No runtime fixture export was added.',
      'Fixtures are deterministic and serializable.',
      'Fixtures do not contain real user data.',
      'Fixtures do not contain raw note bodies.',
      'Fixtures do not contain provider IDs.',
      'Fixtures do not contain graph/KIS fields.',
      'Fixtures do not contain backup/preflight fields.',
      'Fixtures do not contain BlockEditor/editor internals.',
      'K-282 fixture cases are covered:',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits rendering behavior and semantic accessibility status', () => {
    const doc = readDoc();

    for (const required of [
      '## Rendering Behavior Audit',
      'The panel heading renders.',
      'The orientation summary renders.',
      'The recent notes section renders.',
      'The active writing section renders.',
      'The active state renders clear orientation.',
      'The idle state renders clear non-active orientation.',
      'The unavailable state renders degraded/unavailable copy.',
      'The empty/degraded state renders compact copy.',
      'Recent notes cap behavior is tested.',
      'renders at most five recent notes',
      'preserves input order',
      'Display title fallback behavior is tested through a passed title.',
      'The component does not render raw body/content.',
      'The component does not imply provider/backup state.',
      'The component does not imply graph intelligence.',
      'The component does not imply Cosmos Map.',
      '## Semantic / Accessibility Audit',
      'Headings and sections are semantic.',
      'Recent notes use list semantics.',
      'text/structure based, not color-only',
      'Active, idle, and unavailable states are readable.',
      'Empty/degraded state is readable.',
      'Essential information is not visual-only.',
      'There are no hidden interactive controls.',
      'There are no fake disabled buttons.',
      'browser proof is still required before runtime exposure.',
      'K-285 is not production accessibility certification.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits runtime isolation and graph/provider/backup/editor boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Runtime Isolation Audit',
      'The component remains unmounted.',
      'No route/nav/panel files changed.',
      'There is no `NoteView` insertion.',
      'There is no `NoteViewEditorArea` insertion.',
      'There is no Empty State integration.',
      'There is no `NotesCosmosStaticPreview` reuse or mount.',
      'There is no product runtime exposure.',
      'There is no adapter.',
      'There is no store subscription.',
      'There are no persistence/schema changes.',
      'There are no generated artifacts.',
      '## Graph / Provider / Backup / Editor Boundary Audit',
      'There are no `NoteGraphView` changes.',
      'There are no `LocalGraphView` changes.',
      'There are no graph builder changes.',
      'There is no `KnowledgeIndexService` coupling.',
      'There is no live graph/index integration.',
      'There is no provider/network/background sync.',
      'There is no Supabase/OAuth/Google Drive behavior.',
      'There is no backup/preflight runtime implementation.',
      'There is no Data Safety / Backup Health UI.',
      'There is no export/import/restore behavior change.',
      'There is no attachment blob/provider behavior.',
      'There are no BlockEditor/editor internals.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits validation status and runtime exposure gate', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Audit',
      'K-284 component tests passed.',
      'K-283, K-282, K-281, and K-280 related doc/audit tests passed.',
      'Related Notes/Cosmos tests passed',
      'Graph/export/import/restore guard tests passed',
      'Typecheck passed.',
      'Build passed with existing Vite warnings.',
      '`git diff --check` passed.',
      'Full `npm test` passed as reported for K-284.',
      'Manual/browser QA is not required for K-285',
      'Browser/390px QA is required before runtime exposure.',
      '## Runtime Exposure Gate',
      'Runtime exposure is not approved.',
      'adapter boundary audit.',
      'mount location decision.',
      'route/nav/panel decision.',
      '390px viewport proof.',
      'browser QA.',
      'accessibility smoke check.',
      'data adapter tests.',
      'local-first source validation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends K-286 path and lists non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## K-286 Decision',
      '**K-286 Notes Overview / Signal Panel Adapter Boundary Audit**',
      'docs/audit plus audit test only.',
      'inspect what a future adapter would be allowed to read.',
      'keep component unmounted.',
      'no runtime data wiring.',
      'no adapter implementation.',
      'Runtime Exposure Gate Plan',
      'Isolated Component Polish Plan',
      'Not recommended:',
      'immediate runtime mounting.',
      'adapter implementation and mount in the same PR.',
      'Runtime Cosmos Map.',
      '## Non-goals',
      'no component modification in K-285.',
      'no Signal Panel UI change.',
      'no runtime fixture module.',
      'no runtime type/export.',
      'no runtime data wiring.',
      'no data adapter.',
      'no route/nav/panel change.',
      'no NoteView changes.',
      'no NoteViewEditorArea changes.',
      'no Notes store changes.',
      'no persistence/schema change.',
      'no NotesCosmosStaticPreview changes.',
      'no Empty State changes.',
      'no KnowledgeIndexService coupling.',
      'no provider/network/background sync.',
      'no backup/preflight runtime implementation.',
      'no Data Safety / Backup Health UI.',
      'no BlockEditor internals.',
      'no generated artifacts.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('records closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Closure Statement',
      'K-285 closes the K-284 isolated component skeleton.',
      '`NotesOverviewSignalPanel` remains isolated, unmounted, props-only, and read-only.',
      'Adapter/runtime wiring must be separate and later.',
      'Runtime exposure is not approved.',
      'Browser/390px/accessibility proof is required before runtime mount.',
      'Graph/KIS/provider/backup/BlockEditor internals remain forbidden.',
      'Signal Panel remains orientation/readout, not Cosmos Map or graph replacement.',
      'Existing graph surfaces remain preserved.',
      'Empty State and Static Preview lines remain closed.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('verifies K-284 component and test source facts', () => {
    expect(existsSync(componentPath)).toBe(true);
    expect(existsSync(componentTestPath)).toBe(true);

    const component = read(componentPath);
    const componentTest = read(componentTestPath);

    expect(component).toContain('export function NotesOverviewSignalPanel');
    expect(component).toContain('data-recent-note-limit={RECENT_NOTE_LIMIT}');
    expect(component).toContain("readonly generatedFrom: 'local-note-metadata';");
    expect(componentTest).toContain("describe('NotesOverviewSignalPanel'");
    expect(componentTest).toContain('caps recent notes to five without sorting the input array');
    expect(componentTest).toContain('does not import forbidden runtime services or generated assets');
  });

  it('verifies component import boundary and forbidden runtime coupling', () => {
    const component = read(componentPath);

    for (const forbiddenImport of [
      /from ['"].*NoteView/,
      /from ['"].*NoteGraphView/,
      /from ['"].*NoteGraphViewLazy/,
      /from ['"].*LocalGraphView/,
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*buildGlobalGraphData/,
      /from ['"].*buildExpandedGraphData/,
      /from ['"].*useNotesStore/,
      /from ['"].*store/,
      /from ['"].*provider/i,
      /from ['"].*sync/i,
      /from ['"].*persistence/i,
      /from ['"].*preflight/i,
      /from ['"].*backup/i,
      /from ['"].*restore/i,
      /from ['"].*supabase/i,
      /from ['"].*google/i,
      /from ['"].*attac.*hment/i,
      /from ['"].*BlockEditor/,
      /from ['"].*route/i,
      /from ['"].*navigation/i,
    ]) {
      expect(component).not.toMatch(forbiddenImport);
    }

    for (const forbiddenSource of [
      'useEffect',
      'fetch(',
      'onSelectRecentNote',
      'onCreateNote',
      'body',
      'rawContent',
      'markdown',
      'editorState',
      'blockEditorState',
      'documentModel',
      'embedding',
      'vector',
      'semanticScore',
      'graphCoordinates',
      'relationshipStrength',
      'knowledgeIndexResult',
      'providerId',
      'supabaseRowId',
      'syncStatus',
      'backupStatus',
      'preflightStatus',
      'dataSafetyStatus',
      'googleDriveState',
      'attachmentBlob',
      'activityEvents',
      'analytics',
    ]) {
      expect(component).not.toContain(forbiddenSource);
    }
  });

  it('verifies component remains unmounted from known runtime surfaces', () => {
    for (const path of [noteViewPath, noteViewEditorAreaPath, staticPreviewPath, emptyStatePath]) {
      expect(read(path)).not.toContain('NotesOverviewSignalPanel');
    }
  });

  it('verifies K-308 limits runtime component imports to the container and sidebar mount', () => {
    const srcRoot = join(process.cwd(), 'src');
    const adapterPath = join(srcRoot, 'components', 'notes', 'notesOverviewSignalPanelAdapter.ts');
    const importMatches = collectSourceFiles(srcRoot)
      .filter(path => path !== componentPath && path !== componentTestPath)
      .filter(path => read(path).includes("from './NotesOverviewSignalPanel'") || read(path).includes('NotesOverviewSignalPanel'));

    const allowedPlanningTests = importMatches.filter(path =>
      path === adapterPath ||
      path === containerPath ||
      path === containerTestPath ||
      path === noteViewSidebarPath ||
      /notesRuntimeSignalPanelOptimizationImplementationPlan\.test\.ts$/.test(path.replaceAll('\\', '/')) ||
      /notesRuntimeSignalPanelOptimizationSourceFactsAudit\.test\.ts$/.test(path.replaceAll('\\', '/')) ||
      /notesOverviewSignalPanel.*\.test\.ts$/.test(path.replaceAll('\\', '/')),
    );

    expect(importMatches).toEqual(allowedPlanningTests);
  });

  it('keeps generated static harness output absent', () => {
    expect(existsSync(generatedPreviewPath)).toBe(false);
  });
});
