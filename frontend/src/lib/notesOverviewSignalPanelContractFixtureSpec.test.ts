import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
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
const k278DocPath = join(process.cwd(), 'docs', 'K-278-notes-overview-signal-panel-concept-plan.md');
const k277DocPath = join(
  process.cwd(),
  'docs',
  'K-277-notes-cosmos-static-preview-visual-grammar-closure-audit.md',
);
const k269DocPath = join(
  process.cwd(),
  'docs',
  'K-269-notes-empty-state-pixel-cosmos-follow-up-closure-audit.md',
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
const noteUtilsPath = join(process.cwd(), 'src', 'components', 'views', 'noteUtils.ts');
const noteListSortPath = join(process.cwd(), 'src', 'components', 'views', 'noteListSort.ts');
const noteDisplayTitlePath = join(process.cwd(), 'src', 'components', 'views', 'noteDisplayTitle.ts');
const staticPreviewFixturePath = join(
  process.cwd(),
  'src',
  'lib',
  'notesCosmosStaticPreviewMockContract.ts',
);
const noteGraphPath = join(process.cwd(), 'src', 'components', 'views', 'NoteGraphView.tsx');
const localGraphPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'features',
  'knowledge',
  'graph',
  'LocalGraphView.tsx',
);
const staticPreviewHarnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-282 notes overview signal panel contract fixture spec', () => {
  it('exists and defines docs/spec-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-282 Notes Overview / Signal Panel Contract Fixture Spec',
      'K-282 defines a deterministic contract fixture spec for a future Notes Overview / Signal Panel.',
      'K-282 follows the K-280 data contract plan and the K-281 component boundary plan.',
      'K-282 is docs/spec plus audit test only.',
      'K-282 does not implement UI.',
      'K-282 does not add runtime fixture files.',
      'K-282 does not create runtime types/exports.',
      'K-282 does not wire runtime data.',
      'K-282 does not add route/nav/panel behavior.',
      'K-282 does not create a data adapter.',
      'K-282 does not change stores, schemas, persistence, providers, sync, graph builders, backup, or BlockEditor internals.',
      'K-282 chooses the K-283 next path: Notes Overview / Signal Panel Isolated Component Plan.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-281', () => {
    const doc = readDoc();

    for (const required of [
      'K-278 defined Notes Overview / Signal Panel as a concept-only product surface.',
      'K-279 audited local-first data boundaries for a future Signal Panel MVP.',
      'K-280 defined a draft recent notes plus active writing data contract in docs only.',
      'K-281 defined a props-first component boundary in docs only.',
      'No Signal Panel runtime component exists.',
      'No Signal Panel runtime type/export exists.',
      'No Signal Panel data adapter exists.',
      'Signal Panel remains an orientation/readout surface, not Cosmos Map',
      'The Empty State line remains closed.',
      '`NotesPixelCosmosEmptyState` remains the productized empty-vault Notes/Cosmos surface',
      'The Static Preview line remains closed.',
      '`NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, unwired, and not product data.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'Backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines fixture principles and forbidden object categories', () => {
    const doc = readDoc();

    for (const required of [
      '## Fixture Principles',
      'deterministic.',
      'local-first.',
      'contract-shaped.',
      'plain serializable objects.',
      'safe for isolated component tests later.',
      'bounded to recent notes plus active writing signal readout.',
      'functions.',
      'React component state.',
      'raw store objects.',
      'service/client objects.',
      'provider/client objects.',
      'graph/KIS objects.',
      'editor instances.',
      'BlockEditor document models.',
      'raw note body/content.',
      'backup/preflight data.',
      'generated artifacts.',
      'real user data.',
      'secrets.',
      'Fixture data must not imply runtime mounting.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines proposed documentation-only fixture contract shape', () => {
    const doc = readDoc();

    for (const required of [
      '## Proposed Fixture Contract Shape',
      'type SignalPanelRecentNoteFixture = {',
      'id: string;',
      'title: string;',
      'updatedAt?: string;',
      'createdAt?: string;',
      "signalLabel: 'recent';",
      'type SignalPanelActiveWritingFixture = {',
      "state: 'active' | 'idle' | 'unavailable';",
      'currentNoteId?: string;',
      'currentNoteTitle?: string;',
      'lastEditedAt?: string;',
      'type SignalPanelDataFixture = {',
      "generatedFrom: 'local-note-metadata';",
      'recentNotes: SignalPanelRecentNoteFixture[];',
      'activeWriting: SignalPanelActiveWritingFixture;',
      'hasNotes: boolean;',
      'noteCount?: number;',
      "reason: 'empty-vault' | 'ready' | 'unavailable';",
      'documentation only.',
      'not runtime exports.',
      'no callbacks in fixture data.',
      'no store references.',
      'no provider references.',
      'no graph references.',
      'no backup references.',
      'no editor references.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines required fixture cases', () => {
    const doc = readDoc();

    for (const required of [
      '## Required Fixture Cases',
      '### 1. Active Writing Fixture',
      '`emptyState.hasNotes` is `true`.',
      '`recentNotes` contains 2-5 items.',
      '`activeWriting.state` is `active`.',
      '`currentNoteId` is present.',
      '`currentNoteTitle` is present and follows the display title fallback rule.',
      'verifies current-note orientation without editor internals.',
      '### 2. Idle Writing Fixture',
      '`activeWriting.state` is `idle`.',
      'no keystroke/activity tracking.',
      'avoids fake active-writing claims.',
      '### 3. Unavailable Writing Fixture',
      '`activeWriting.state` is `unavailable`.',
      'no fake current note.',
      'no fake timestamps.',
      '### 4. Empty / Degraded Fixture',
      '`emptyState.hasNotes` is `false` or `recentNotes` is empty.',
      'the fixture does not duplicate full Empty State onboarding.',
      'the fixture does not fake note signals.',
      'no provider/loading implication.',
      'no backup/provider error implication.',
      '### 5. Recent Notes Cap Fixture',
      'fixture output caps to 5.',
      'deterministic order.',
      'no semantic ranking.',
      'no graph ranking.',
      '### 6. Display Title Fallback Fixture',
      'at least one untitled or blank-title note case.',
      'title is resolved through existing display title fallback rule.',
      'no AI-generated title.',
      '### 7. Forbidden Fields Fixture Check',
      'fixture must not contain forbidden fields.',
      'forbidden fields listed in K-280 remain excluded.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines recent notes, active writing, and empty/degraded fixture rules', () => {
    const doc = readDoc();

    for (const required of [
      '## RecentNotes Fixture Rules',
      'cap to 5.',
      'use deterministic order.',
      'use display-ready titles.',
      'use fallback title deterministically.',
      'use `updatedAt` and `createdAt` only if source-supported.',
      'use existing noteListSort behavior if later implementation source-confirms it.',
      'keep `signalLabel` as `recent`.',
      'relationship strength.',
      'cluster/theme data.',
      'provider ids.',
      'raw content/body.',
      'attachment blob data.',
      'backup state.',
      'sync status.',
      'semantic ranking.',
      'graph ranking.',
      '## ActiveWriting Fixture Rules',
      '`active`.',
      '`idle`.',
      '`unavailable`.',
      'unavailable is a valid safe fallback.',
      'no empty state inside `activeWriting`; empty vault belongs to `emptyState` and the Empty State boundary.',
      'no BlockEditor internals.',
      'no editor document model.',
      'no keystroke/activity analytics.',
      'no raw editor content.',
      'no background sync.',
      'no persistence mutation.',
      '## Empty / Degraded Fixture Rules',
      'true empty vault defers to Empty State.',
      'Signal Panel fixture may include minimal empty/degraded case only for component resilience.',
      'no duplicate Empty State CTA.',
      'no provider loading state.',
      'no backup/import/export error state.',
      'no fake signals.',
      'readable fallback text required in future rendering.',
      'accessibility-friendly state label required in future rendering.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists forbidden fixture fields', () => {
    const doc = readDoc();

    for (const required of [
      '## Forbidden Fields',
      '`body`.',
      '`content`.',
      '`rawContent`.',
      '`markdown`.',
      '`editorState`.',
      '`blockEditorState`.',
      '`documentModel`.',
      '`embedding`.',
      '`vector`.',
      '`semanticScore`.',
      '`similarityScore`.',
      '`graphCoordinates`.',
      '`coordinates`.',
      '`orbit`.',
      '`spatialPosition`.',
      '`relationshipStrength`.',
      '`clusterId`.',
      '`themeId`.',
      '`knowledgeIndexResult`.',
      '`providerId`.',
      '`supabaseRowId`.',
      '`syncStatus`.',
      '`backupStatus`.',
      '`preflightStatus`.',
      '`dataSafetyStatus`.',
      '`oauthState`.',
      '`googleDriveState`.',
      '`attachmentBlob`.',
      '`restoreState`.',
      '`importState`.',
      '`exportState`.',
      '`activityEvents`.',
      '`keystrokeEvents`.',
      '`analytics`.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines fixture-to-component testing expectations and runtime fixture boundary', () => {
    const doc = readDoc();

    for (const required of [
      '## Fixture-to-component Testing Expectations',
      'renders active fixture.',
      'renders idle fixture.',
      'renders unavailable fixture.',
      'renders empty/degraded fixture.',
      'caps recent notes to 5.',
      'uses fallback title.',
      'does not render forbidden raw fields.',
      'exposes semantic headings/groups.',
      'signal hierarchy is text/structure based, not color-only.',
      'no graph/provider/backup claims.',
      'no route/nav/panel mount.',
      'no runtime store reads.',
      'wrapper-level 390px/static proof before runtime exposure.',
      '## Runtime Fixture Boundary',
      'K-282 does not add a fixture module.',
      'should live near component tests or test utilities only.',
      'must not be imported by production runtime.',
      'must not be used as app data.',
      'must not be committed as generated artifact.',
      'must not include real user data.',
      'must not include secrets.',
      'must not include provider ids.',
      'must not include raw note bodies.',
      'must not include graph/KIS objects.',
      'must not include backup/preflight state.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines relationship to K-280/K-281 and K-283 recommendation', () => {
    const doc = readDoc();

    for (const required of [
      '## Relationship To K-280 / K-281',
      'K-280 defines the draft data contract.',
      'K-281 defines the props-first component boundary.',
      'K-282 defines deterministic fixture cases.',
      'K-282 does not change the K-280 contract at runtime.',
      'K-282 does not implement the K-281 component.',
      'K-282 prepares for a later isolated component skeleton only if K-283 approves that path.',
      'data contract plan.',
      'component boundary plan.',
      'fixture spec.',
      'isolated component plan or skeleton.',
      'data adapter audit.',
      'runtime mount only after explicit gate and browser/390px QA.',
      '## K-283 Decision',
      '**K-283 Notes Overview / Signal Panel Isolated Component Plan**',
      'docs/plan plus audit test only.',
      'lock exact component file path.',
      'lock exact test path.',
      'lock fixture location.',
      'no implementation yet.',
      'Fixture Closure Audit',
      'Isolated Component Skeleton',
      'small component implementation.',
      'fixture-driven props only.',
      'read-only.',
      'no runtime mount.',
      'no data adapter.',
      'requires Codex 5.5 high.',
      'Not recommended:',
      'immediate runtime mounting.',
      'adapter plus component in the same PR.',
      'graph/KIS/provider/backup integration.',
      'Runtime Cosmos Map.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no Signal Panel UI implementation in K-282.',
      'no Notes Overview component.',
      'no Signal Panel component.',
      'no runtime fixture module.',
      'no runtime type/export.',
      'no runtime data wiring.',
      'no data adapter.',
      'no route/nav/panel change.',
      'no NoteView changes.',
      'no NoteViewEditorArea changes.',
      'no noteUtils changes.',
      'no noteListSort changes.',
      'no noteDisplayTitle changes.',
      'no Notes store changes.',
      'no persistence/schema change.',
      'no NotesCosmosStaticPreview changes.',
      'no Empty State changes.',
      'no Runtime Cosmos Map implementation.',
      'no graph replacement.',
      'no NoteGraphView change.',
      'no LocalGraphView change.',
      'no graph builder change.',
      'no KnowledgeIndexService coupling.',
      'no live graph/index integration.',
      'no provider/network/background sync.',
      'no Supabase/OAuth/Google Drive behavior change.',
      'no backup/preflight runtime implementation.',
      'no Data Safety / Backup Health UI.',
      'no export/import/restore behavior change.',
      'no attachment blob/provider behavior.',
      'no BlockEditor internals.',
      'no Health/Schedule behavior change.',
      'no assets/fonts/dependencies.',
      'no generated artifacts.',
      '## Closure Statement',
      'K-282 defines deterministic fixture cases only.',
      'K-282 does not implement or mount Signal Panel.',
      'Future fixture data must be contract-shaped, local-first, serializable, and test-only.',
      'A future component should remain isolated, read-only first, and deterministic from fixture/props data.',
      'Adapter/runtime wiring must be separate and later.',
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

  it('anchors to prior docs and current source files without adding runtime fixtures', () => {
    for (const path of [
      k281DocPath,
      k280DocPath,
      k279DocPath,
      k278DocPath,
      k277DocPath,
      k269DocPath,
      noteViewPath,
      noteViewEditorAreaPath,
      noteUtilsPath,
      noteListSortPath,
      noteDisplayTitlePath,
      staticPreviewFixturePath,
      noteGraphPath,
      localGraphPath,
    ]) {
      expect(existsSync(path)).toBe(true);
    }

    const k281Doc = readSource(k281DocPath);
    expect(k281Doc).toContain('K-281 chooses the K-282 next path: Notes Overview / Signal Panel Contract Fixture Spec.');
    expect(k281Doc).toContain('Future testing should start with deterministic fixtures based on the K-280 contract.');

    const k280Doc = readSource(k280DocPath);
    expect(k280Doc).toContain("type SignalPanelDataDraft = {");
    expect(k280Doc).toContain("generatedFrom: 'local-note-metadata';");

    const noteUtils = readSource(noteUtilsPath);
    expect(noteUtils).toContain('export interface NoteBase');
    expect(noteUtils).toContain('updatedAt: number;');
    expect(noteUtils).toContain('body: string;');
    expect(noteUtils).toContain('relations?: Record<string, string[]>;');

    const sortSource = readSource(noteListSortPath);
    expect(sortSource).toContain("export const DEFAULT_NOTE_SORT_FIELD: NoteSortField = 'updated';");
    expect(sortSource).toContain("export const DEFAULT_NOTE_SORT_DIRECTION: NoteSortDirection = 'desc';");

    const titleSource = readSource(noteDisplayTitlePath);
    expect(titleSource).toContain('export function displayNoteTitle(');
    expect(titleSource).toContain('resolveUntitledNoteLabel(language)');

    const fixtureSource = readSource(staticPreviewFixturePath);
    expect(fixtureSource).toContain('This module is static fixture data only.');
    expect(fixtureSource).toContain('It does not render UI, read stores,');
  });

  it('does not leave generated static harness output in the working tree', () => {
    expect(existsSync(staticPreviewHarnessOutputPath)).toBe(false);
  });
});
