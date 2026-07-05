import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-266-notes-empty-state-pixel-cosmos-product-polish-closure-audit.md');
const emptyStatePath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NotesPixelCosmosEmptyState.tsx',
);
const emptyStateTestPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NotesPixelCosmosEmptyState.test.ts',
);
const editorAreaPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const staticPreviewPath = join(
  process.cwd(),
  'src',
  'components',
  'notes',
  'NotesCosmosStaticPreview.tsx',
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
const exportVaultBackupPath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const importVaultBackupPath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const vaultRestorePipelinePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

describe('K-266 notes empty state pixel-cosmos product polish closure audit', () => {
  it('exists and defines docs/audit-only closure scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-266 Notes Empty State Pixel-Cosmos Product Polish Closure Audit',
      'K-266 closes K-265 as a docs/audit milestone only.',
      'K-266 does not change runtime UI',
      'does not change `NotesPixelCosmosEmptyState.tsx`',
      'does not change empty-state callback behavior',
      'does not add any product surface',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes K-265 as narrow empty-vault runtime UI polish with exact changed files', () => {
    const doc = readDoc();

    for (const required of [
      'K-265 was a narrow Notes empty-vault runtime UI polish.',
      'already mounted from the empty-vault branch in `NoteViewEditorArea`',
      '`frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`',
      '`frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`',
      '`frontend/docs/K-265-notes-empty-state-pixel-cosmos-product-polish.md`',
      'did not change the mount point',
      'Notes navigation',
      'graph surfaces',
      'stores, schemas, persistence, providers',
      'backup flows',
      'attachment flows',
      'package config, assets, fonts, Health, or Schedule',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('closes product polish, CTA/callback preservation, accessibility, and browser QA', () => {
    const doc = readDoc();

    for (const required of [
      '## Product Polish Closed',
      '`Notes / Living Cosmos`',
      '`Empty vault`',
      '`Start with one signal`',
      'first-step guidance',
      'Pixel/Cosmos language stayed product grammar rather than decoration.',
      '## CTA And Callback Preservation',
      '`Create note`',
      "`Open today's note`",
      '`Import backup`',
      '`onCreateNote`',
      '`onOpenTodaysNote`',
      '`onImportVault`',
      'did not introduce new behavior',
      '## Accessibility And Semantics',
      'role="status"',
      'aria-label="Notes empty state"',
      'native `button` elements',
      'visible text',
      'no action is icon-only',
      'no action depends on color-only or motion-only meaning',
      '`abs-focus-ring`',
      'decorative pixel motif elements remain `aria-hidden`',
      '## Browser QA Closure',
      '390px Notes empty-vault state was verified',
      'primary CTA visible',
      'primary CTA unique',
      'primary CTA enabled',
      'primary CTA is a native button',
      'no horizontal overflow',
      'no clipping',
      'no `NotesCosmosStaticPreview` surface appeared',
      'no graph surface appeared',
      'no Data Safety surface appeared',
      'no Backup Health surface appeared',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents browser QA low note and backup/Data Safety non-claims', () => {
    const doc = readDoc();

    for (const required of [
      'Low note: `Create note` was not clicked during browser QA to avoid creating local data.',
      'Callback invocation is covered by the focused unit test',
      'acceptable for K-265 closure',
      '## Backup And Data Safety Non-Claims',
      'backup is safe or complete',
      'restore is ready',
      'cloud sync is ready',
      'Data Safety is available',
      'Backup Health is available',
      'production preflight is active',
      'attachment backup is available',
      'provider recovery is available',
      '`Import backup` remains the existing action label and existing callback.',
      'not expanded into new backup, restore, or Data Safety behavior',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms static preview, graph, route/nav/panel, provider/blob, and backup/runtime boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Boundary Closure',
      'no routes added',
      'no panels added',
      'no Notes navigation changes',
      'no `NotesCosmosStaticPreview` runtime wiring',
      'no static preview fixture runtime mount',
      'no Cosmos Map implementation',
      'no `NoteGraphView` changes',
      'no `LocalGraphView` changes',
      'no graph builder changes',
      'no `KnowledgeIndexService` changes',
      'no Notes store changes',
      'no Notes schema changes',
      'no Notes persistence changes',
      'no provider changes',
      'no backup/export/import/restore behavior changes',
      'no Data Safety / Backup Health UI',
      'no provider/blob/OAuth/Supabase behavior changes',
      'no package.json changes',
      'no Vite config changes',
      'no dependency changes',
      'no asset changes',
      'no font changes',
      'no Health changes',
      'no Schedule changes',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('records verification closure and recommends a narrow K-267 next step', () => {
    const doc = readDoc();

    for (const required of [
      '## Verification Closure',
      'focused empty-state test passed',
      'K-264 product surface boundary audit passed',
      'K-263 product surface planning audit passed',
      'K-213 notes empty-state closure audit passed',
      'static preview test passed',
      'local graph test passed',
      'export/import/restore guard tests passed',
      '`npm run typecheck` passed',
      '`npm run build` passed with existing Vite chunk warnings',
      '`git diff --check` passed',
      'full `npm test` passed',
      '## K-267 Recommendation',
      '**K-267: Notes/Cosmos Surface Polish Next Candidate Plan**',
      'K-267 should remain docs/plan only unless explicitly approved.',
      'should select the next small product surface candidate rather than becoming a broad Notes UI overhaul',
      '**K-267: Notes Empty State Pixel-Cosmos Follow-up Boundary Plan**',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and closes K-265 without runtime implementation', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-Goals',
      'no runtime UI implementation in K-266',
      'no `NotesPixelCosmosEmptyState.tsx` change',
      'no empty-state callback change',
      'no route change',
      'no panel change',
      'no Notes navigation change',
      'no `NotesCosmosStaticPreview` runtime wiring',
      'no graph runtime change',
      'no graph builder change',
      'no `KnowledgeIndexService` change',
      'no Notes store/schema/persistence/provider change',
      'no backup/export/import/restore change',
      'no Data Safety / Backup Health UI',
      'no provider/blob/OAuth/Supabase change',
      'no Health/Schedule change',
      'no package/config/dependency/asset/font change',
      'no broad UI overhaul',
      '## Closure Statement',
      'K-265 is closed as a narrow Notes empty-vault Pixel/Cosmos product polish.',
      'preserving existing CTAs, callbacks, accessibility semantics, mobile behavior, and product/runtime boundaries',
      'Future Notes/Cosmos work should proceed through a narrow candidate plan',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms source facts for the K-265 runtime surface and callback tests', () => {
    const emptyState = readFileSync(emptyStatePath, 'utf8');
    const emptyStateTest = readFileSync(emptyStateTestPath, 'utf8');
    const editorArea = readFileSync(editorAreaPath, 'utf8');

    for (const required of [
      'Start with one signal',
      'Create note',
      "Open today's note",
      'Import backup',
      'onCreateNote',
      'onOpenTodaysNote',
      'onImportVault',
      'role="status"',
      'aria-label="Notes empty state"',
      'abs-focus-ring',
      'aria-hidden="true"',
    ]) {
      expect(emptyState).toContain(required);
    }

    for (const required of [
      'expect(onCreateNote).toHaveBeenCalledTimes(1)',
      'expect(onOpenTodaysNote).toHaveBeenCalledTimes(1)',
      'expect(onImportVault).toHaveBeenCalledTimes(1)',
      'expect(html).not.toContain(\'NotesCosmosStaticPreview\')',
      'expect(html).not.toContain(\'Graph View\')',
      'expect(html).not.toContain(\'Data Safety\')',
    ]) {
      expect(emptyStateTest).toContain(required);
    }

    expect(editorArea).toContain('isEmptyVault ?');
    expect(editorArea).toContain('<NotesPixelCosmosEmptyState');
    expect(editorArea).toContain('onCreateNote={() => createNote()}');
    expect(editorArea).toContain('onOpenTodaysNote={onOpenTodaysNote}');
    expect(editorArea).toContain('onImportVault={onImportVault}');
  });

  it('confirms K-266 symbols are not referenced from runtime or backup files', () => {
    const runtimeSources = [
      readFileSync(emptyStatePath, 'utf8'),
      readFileSync(editorAreaPath, 'utf8'),
      readFileSync(staticPreviewPath, 'utf8'),
      readFileSync(noteGraphPath, 'utf8'),
      readFileSync(localGraphPath, 'utf8'),
      readFileSync(exportVaultBackupPath, 'utf8'),
      readFileSync(importVaultBackupPath, 'utf8'),
      readFileSync(vaultRestorePipelinePath, 'utf8'),
    ];

    for (const source of runtimeSources) {
      expect(source).not.toContain('notesEmptyStatePixelCosmosProductPolishClosureAudit');
      expect(source).not.toContain('K-266 Notes Empty State Pixel-Cosmos Product Polish Closure Audit');
      expect(source).not.toContain('K-267: Notes/Cosmos Surface Polish Next Candidate Plan');
      expect(source).not.toContain('K-266-notes-empty-state-pixel-cosmos-product-polish-closure-audit');
    }
  });

  it('does not contain obvious committed credential material', () => {
    const doc = readDoc();

    for (const forbidden of [
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE ' + 'KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'access_' + 'token=',
      'refresh_' + 'token=',
    ]) {
      expect(doc).not.toContain(forbidden);
    }
  });
});
