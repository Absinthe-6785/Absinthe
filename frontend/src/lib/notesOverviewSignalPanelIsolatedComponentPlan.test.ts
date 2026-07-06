import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-283-notes-overview-signal-panel-isolated-component-plan.md',
);
const k282DocPath = join(
  process.cwd(),
  'docs',
  'K-282-notes-overview-signal-panel-contract-fixture-spec.md',
);
const k281DocPath = join(
  process.cwd(),
  'docs',
  'K-281-notes-overview-signal-panel-component-boundary-plan.md',
);
const k280DocPath = join(
  process.cwd(),
  'docs',
  'K-280-notes-overview-signal-panel-data-contract-plan.md',
);
const k279DocPath = join(
  process.cwd(),
  'docs',
  'K-279-notes-overview-signal-panel-data-boundary-audit.md',
);
const componentDirPath = join(process.cwd(), 'src', 'components', 'notes');
const runtimeNoteViewDirPath = join(process.cwd(), 'src', 'components', 'views', 'noteview');
const staticPreviewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const emptyStatePath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NotesPixelCosmosEmptyState.tsx',
);
const staticPreviewHarnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-283 notes overview signal panel isolated component plan', () => {
  it('exists and defines docs/plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-283 Notes Overview / Signal Panel Isolated Component Plan',
      'K-283 plans a future isolated Notes Overview / Signal Panel component skeleton.',
      'K-283 follows the K-282 fixture spec, K-281 component boundary, and K-280 data contract.',
      'K-283 is docs/plan plus audit test only.',
      'K-283 does not implement UI.',
      'K-283 does not add runtime fixture modules.',
      'K-283 does not create runtime types/exports.',
      'K-283 does not wire runtime data.',
      'K-283 does not add route/nav/panel behavior.',
      'K-283 does not create a data adapter.',
      'K-283 does not change stores, schemas, persistence, providers, sync, graph builders, backup, or BlockEditor internals.',
      'K-283 chooses the K-284 next path: Notes Overview / Signal Panel Isolated Component Skeleton.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-282', () => {
    const doc = readDoc();

    for (const required of [
      'K-278 defined Notes Overview / Signal Panel as a concept-only product surface.',
      'K-279 audited local-first data boundaries for a future Signal Panel MVP.',
      'K-280 defined a draft recent notes plus active writing data contract in docs only.',
      'K-281 defined a props-first component boundary in docs only.',
      'K-282 defined deterministic fixture cases in docs only.',
      'No Signal Panel runtime component exists.',
      'No Signal Panel runtime type/export exists.',
      'No Signal Panel runtime fixture module exists.',
      'No Signal Panel data adapter exists.',
      'Signal Panel remains an orientation/readout surface, not Cosmos Map',
      'The Empty State line remains closed.',
      'The Static Preview line remains closed.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'Backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('states implementation readiness decision', () => {
    const doc = readDoc();

    for (const required of [
      '## Implementation Readiness Decision',
      'A small isolated component skeleton is reasonable for K-284 only if it remains:',
      'unmounted.',
      'props-driven.',
      'read-only.',
      'fixture/test-driven.',
      'no adapter.',
      'no route/nav/panel.',
      'no runtime data wiring.',
      'no store/schema/persistence changes.',
      'no graph/KIS/provider/backup/BlockEditor internals.',
      'K-283 itself does not approve runtime exposure.',
      'K-283 itself does not approve data wiring.',
      'K-283 itself does not approve callbacks/navigation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends component path, test path, and fixture location', () => {
    const doc = readDoc();

    for (const required of [
      '## Proposed Component Path',
      'frontend/src/components/notes/NotesOverviewSignalPanel.tsx',
      '`frontend/src/components/notes` already exists.',
      '`NotesCosmosStaticPreview.tsx` lives there as an isolated Notes/Cosmos component.',
      'Rejected paths:',
      '`frontend/src/features/notes/...` because `frontend/src/features/notes` does not currently exist.',
      '`frontend/src/components/views/noteview/...` because that tree is tied to runtime NoteView surfaces.',
      'K-284 must not mount this component from `NoteView`, routing, or `NoteViewEditorArea`.',
      '## Proposed Test Path',
      'frontend/src/components/notes/NotesOverviewSignalPanel.test.tsx',
      'active fixture.',
      'idle fixture.',
      'unavailable fixture.',
      'empty/degraded fixture.',
      'recent notes cap.',
      'title fallback display.',
      'forbidden fields not rendered.',
      'semantic headings/groups.',
      '390px wrapper expectation',
      '## Proposed Fixture Location',
      'keep fixtures test-local inside `NotesOverviewSignalPanel.test.tsx`.',
      'avoids production fixture exports.',
      'fixture must not be imported by production runtime.',
      'fixture follows K-282 cases.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines props-first API and rendering scope for K-284', () => {
    const doc = readDoc();

    for (const required of [
      '## Props-first API Plan',
      'type NotesOverviewSignalPanelProps = {',
      'data: SignalPanelDataDraft;',
      'no callbacks in K-284 skeleton.',
      'no `onSelectRecentNote`.',
      'no `onCreateNote`.',
      'no navigation.',
      'no mutation.',
      'no adapter.',
      'no store object.',
      'no service object.',
      'no provider client.',
      'no graph object.',
      'no editor instance.',
      'The component should render only from passed props.',
      '## Rendering Scope For K-284',
      'panel heading.',
      'orientation summary.',
      'recent notes section.',
      'active writing section.',
      'empty/unavailable fallback section.',
      'signal tier labels if meaningful.',
      'title fallback display.',
      'capped recent notes list.',
      'accessible text/labels.',
      'no raw content/body.',
      'no graph/provider/backup claims.',
      'real navigation.',
      'create note action.',
      'graph visualizations.',
      'Cosmos Map.',
      'provider status.',
      'sync status.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines semantic accessibility and visual product grammar expectations', () => {
    const doc = readDoc();

    for (const required of [
      '## Semantic / Accessibility Expectations',
      'headings and sections are semantic.',
      'signal hierarchy is represented through text/structure, not color-only.',
      'active, idle, and unavailable states are readable.',
      'empty/degraded state is readable.',
      'no essential information is visual-only.',
      'keyboard expectations remain simple because component is read-only.',
      'no hidden interactive controls.',
      'no fake disabled buttons.',
      'aria labels are used only where they add clarity.',
      'content remains readable at 390px/narrow width.',
      '## Visual / Product Grammar Expectations',
      'pixel is grammar, not decoration.',
      'information-first layout.',
      'readable typography.',
      'cozy sci-fi / pixel observatory / personal archive tone.',
      'signal/readout language clarifies state.',
      'primary/secondary/faint hierarchy may be used if meaningful.',
      'avoid overdecorated cosmic UI.',
      'avoid generic AI SaaS look.',
      'do not imply Cosmos Map.',
      'do not imply graph intelligence.',
      'do not hide writing actions behind spectacle.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines runtime isolation requirements and K-284 acceptance criteria', () => {
    const doc = readDoc();

    for (const required of [
      '## Runtime Isolation Requirements',
      'component must remain unmounted.',
      'no route/nav/panel changes.',
      'no `NoteView` insertion.',
      'no `NoteViewEditorArea` insertion.',
      'no Empty State integration.',
      'no `NotesCosmosStaticPreview` reuse/mount.',
      'no adapter.',
      'no store subscription.',
      'no provider/network calls.',
      'no graph/KIS calls.',
      'no backup/preflight reads.',
      'no BlockEditor internals.',
      'no persistence/schema changes.',
      'no generated artifacts.',
      'no assets/fonts/dependencies.',
      '## K-284 Implementation Acceptance Criteria',
      'Codex 5.5 high.',
      'exactly small isolated component skeleton.',
      'no runtime mount.',
      'no data adapter.',
      'props-only.',
      'read-only.',
      'test-local fixtures or explicitly test-only fixture.',
      'no production fixture export unless explicitly justified.',
      'tests for active/idle/unavailable/empty-degraded.',
      'tests for title fallback.',
      'tests for recent notes cap.',
      'tests that forbidden terms/fields do not render.',
      'tests or source scan for no store/provider/graph/backup/editor imports.',
      'typecheck/build/diff-check.',
      'no package/vite changes.',
      'no route/nav/panel files touched.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends K-284 path and lists non-goals', () => {
    const doc = readDoc();

    for (const required of [
      '## K-284 Decision',
      '**K-284 Notes Overview / Signal Panel Isolated Component Skeleton**',
      'small implementation.',
      'isolated/unmounted component.',
      'props-only.',
      'read-only.',
      'test-local fixtures.',
      'no adapter.',
      'no runtime data wiring.',
      'no route/nav/panel.',
      'no graph/KIS/provider/backup/BlockEditor.',
      'requires Codex 5.5 high.',
      'Fixture Module Spec',
      'Isolated Component Closure Audit',
      'Not recommended:',
      'runtime mounting.',
      'adapter plus component in the same PR.',
      'callbacks/navigation.',
      'Runtime Cosmos Map.',
      '## Non-goals',
      'no Signal Panel UI implementation in K-283.',
      'no Notes Overview component.',
      'no Signal Panel component.',
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
      'no BlockEditor internals.',
      'no Health/Schedule behavior change.',
      'no assets/fonts/dependencies.',
      'no generated artifacts.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('anchors to prior docs and existing directories', () => {
    for (const path of [
      k282DocPath,
      k281DocPath,
      k280DocPath,
      k279DocPath,
      componentDirPath,
      runtimeNoteViewDirPath,
      staticPreviewPath,
      emptyStatePath,
    ]) {
      expect(existsSync(path)).toBe(true);
    }

    expect(existsSync(join(process.cwd(), 'src', 'features', 'notes'))).toBe(false);

    const k282Doc = readSource(k282DocPath);
    expect(k282Doc).toContain('K-282 chooses the K-283 next path: Notes Overview / Signal Panel Isolated Component Plan.');
    expect(k282Doc).toContain('K-282 defines deterministic fixture cases.');

    const k281Doc = readSource(k281DocPath);
    expect(k281Doc).toContain('K-281 defines a props-first component boundary only.');
    expect(k281Doc).toContain('props are plain serializable data plus optional callbacks.');

    const staticPreview = readSource(staticPreviewPath);
    expect(staticPreview).toContain('type NotesCosmosStaticPreviewProps');
    expect(staticPreview).toContain('fixture?: NotesCosmosPreviewFixture;');
  });

  it('records closure statement and keeps generated static harness output absent', () => {
    const doc = readDoc();

    for (const required of [
      '## Closure Statement',
      'K-283 plans an isolated component skeleton only.',
      'K-283 does not implement or mount Signal Panel.',
      'K-284 may implement a small read-only, props-only, unmounted component skeleton if acceptance criteria are met.',
      'Adapter/runtime wiring must be separate and later.',
      'Callbacks/navigation must be deferred.',
      'Graph/KIS/provider/backup/BlockEditor internals remain forbidden.',
      'Signal Panel remains orientation/readout, not Cosmos Map or graph replacement.',
      'Existing graph surfaces remain preserved.',
      'Empty State and Static Preview lines remain closed.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }

    expect(existsSync(staticPreviewHarnessOutputPath)).toBe(false);
  });
});
