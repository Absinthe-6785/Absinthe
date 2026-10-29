// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NOTES_CORE_DOMAIN, NOTES_FOLDERS_DOMAIN, type NotesAuthorityRequest } from '../../lib/notesAccountAuthority';
import type { NoteBase } from './noteUtils';
import type { NotesPersistenceInitResult } from '../../lib/notePersistence';
import { serializeIdWikiLink, parseIdWikiLink } from './wikiLinks';
import { captureWikiPublication } from './wikiNoteAuthority';
import { buildWikiInsertText } from './features/block-editor/features/menus/utils/wikiNavigation';
import { buildSelectedWikiInsertText } from './features/block-editor/features/selection/utils/selectionWikiLink';
import { filterWikiTargets } from './features/block-editor/features/menus/utils/wikiSearch';
import { renderInlineMarkdownHtml } from './editableRender';
import { useNoteKeyboardActions } from './noteview/actions/useNoteKeyboardActions';
import { resetNoteNavigationStack, seedNoteNavigationStack, goBackNote, goForwardNote } from '../../lib/noteNavigationStack';
import type { BlockEditorColors } from './editorTypes';

const persistence = vi.hoisted(() => ({ initialize: vi.fn(), save: vi.fn(async () => ({ status: 'persisted' })) }));
vi.mock('../../lib/notePersistence', async original => ({
  ...await original<typeof import('../../lib/notePersistence')>(),
  initNotesPersistence: persistence.initialize, saveNotesAsync: persistence.save,
}));
vi.mock('../../lib/supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('../../lib/vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
const { useNotesStore, observePublishedNotesHydration } = await import('../../store/useNotesStore');
const { resetNotesPersistenceForTests } = await import('../../lib/notePersistence');
const { setRecoveryModeActiveForTest } = await import('../../lib/recoverySafetyPolicy');
const { NOTES_RUNTIME_SYNC_MODE_KEY } = await import('../../lib/notesSyncClient');
const note = (id: string, title: string): NoteBase => ({ id, title, body: '', updatedAt: 1, folderId: null, deletedAt: null });
function hydrated(account: string, request: NotesAuthorityRequest): NotesPersistenceInitResult {
  const notes = account === 'A'
    ? [note('source', 'Source A'), note('wrong', 'Duplicate'), note('target', 'Duplicate')]
    : [note('source-B', 'Source B'), note('B-secret', 'Private B')];
  const domain = (domainId: typeof NOTES_CORE_DOMAIN | typeof NOTES_FOLDERS_DOMAIN, count: number) => ({
    accountId: account, domainId, schemaVersion: 1, state: count ? 'LOADED_POPULATED' as const : 'LOADED_EMPTY' as const,
    recordCount: count, verifiedAt: 1, legacyGlobalDataPresent: false,
  });
  return { notes, mode: 'accountScoped', accountId: account, requestGeneration: request.generation,
    migrated: false, migrationMs: 0, loadMs: 0,
    notesAuthorityState: domain(NOTES_CORE_DOMAIN, notes.length), foldersAuthorityState: domain(NOTES_FOLDERS_DOMAIN, 0) };
}
let root: Root | undefined;
let container: HTMLDivElement;
let navigate: ReturnType<typeof useNoteKeyboardActions>['navigateToWiki'];
const createNote = vi.fn();
const idTarget = (id: string, label = '') => parseIdWikiLink(serializeIdWikiLink(id, label))!;
const setViewMode = vi.fn();
function Host() {
  const notes = useNotesStore(s => s.notes);
  const activeNoteId = useNotesStore(s => s.activeNoteId);
  const params = {
    notes, activeNote: notes.find(n => n.id === activeNoteId), activeNoteId, viewMode: 'edit', showSortMenu: false,
    searchInputRef: { current: null }, blockEditorRef: { current: null }, editorScrollRef: { current: null },
    setViewMode, setShowShortcuts: vi.fn(), setShowSortMenu: vi.fn(), setFocusMode: vi.fn(),
    setSearchScope: vi.fn(), setDocumentSearchOpen: vi.fn(), setActiveNoteId: useNotesStore.getState().setActiveNoteId,
    flushPendingSync: vi.fn(), syncNoteToDB: vi.fn(),
  } as unknown as Parameters<typeof useNoteKeyboardActions>[0];
  navigate = useNoteKeyboardActions(params, createNote, vi.fn()).navigateToWiki;
  return null;
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useNotesStore.getState().detachNotesStorage();
  resetNotesPersistenceForTests();
  setRecoveryModeActiveForTest(false);
  localStorage.clear();
  localStorage.setItem(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
  persistence.initialize.mockImplementation(async (account: string, request: NotesAuthorityRequest) => hydrated(account, request));
  createNote.mockClear();
  resetNoteNavigationStack();
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  useNotesStore.getState().detachNotesStorage();
});
async function publish(account: string) {
  await act(async () => { await useNotesStore.getState().initNotesStorage(account); });
  expect(observePublishedNotesHydration().status).toBe('CURRENT');
}
async function mount() {
  root = createRoot(container);
  await act(async () => root!.render(React.createElement(Host)));
}

describe('ID Wiki authorized publication and navigation', () => {
  it('navigates to the exact ID and retains existing back/forward history', async () => {
    await publish('A'); await mount();
    seedNoteNavigationStack('source');
    await act(async () => navigate(idTarget('target'), { preferReading: true }));
    expect(useNotesStore.getState().activeNoteId).toBe('target');
    expect(createNote).not.toHaveBeenCalled();
    expect(setViewMode).toHaveBeenCalledWith('reading');
    await act(async () => { expect(goBackNote()).toBe('source'); });
    await act(async () => { expect(goForwardNote()).toBe('target'); });
  });
  it('rejects stale candidates and link clicks for A -> B -> A', async () => {
    await publish('A'); await mount();
    const oldNavigate = navigate;
    const oldPublication = captureWikiPublication();
    const oldTarget = oldPublication.targets.find(t => t.id === 'target')!;
    const body = idTarget('target');
    await publish('B');
    await act(async () => oldNavigate(body));
    expect(useNotesStore.getState().activeNoteId).not.toBe('target');
    expect(filterWikiTargets('', oldPublication.targets)).toEqual([]);
    expect(buildWikiInsertText('[[', 2, oldTarget)).toBeNull();
    expect(buildSelectedWikiInsertText('Label', 0, 5, oldTarget)).toBeNull();
    const rendered = renderInlineMarkdownHtml(body.raw, {} as BlockEditorColors, '', oldPublication.targets);
    expect(rendered).not.toContain('Duplicate');
    expect(rendered).not.toContain('data-note-link=');
    await publish('A');
    await act(async () => oldNavigate(body));
    expect(useNotesStore.getState().activeNoteId).not.toBe('target');
    expect(oldPublication.resolve(body)).toBeUndefined();
    expect(buildSelectedWikiInsertText('Label', 0, 5, oldTarget)).toBeNull();
    expect(buildSelectedWikiInsertText('Label', 0, 5, captureWikiPublication().targets.find(t => t.id === 'target')!)?.newText)
      .toBe('[Label](absinthe-note:target)');
    await act(async () => navigate(body));
    expect(useNotesStore.getState().activeNoteId).toBe('target');
  });
  it('fails closed during replacement hydration and without authority', async () => {
    await publish('A'); await mount();
    const old = captureWikiPublication();
    const oldNavigate = navigate;
    let settle!: (result: NotesPersistenceInitResult) => void;
    persistence.initialize.mockImplementationOnce((_account: string, request: NotesAuthorityRequest) =>
      new Promise<NotesPersistenceInitResult>(resolve => { settle = result => resolve(result); void request; }));
    let pending!: Promise<void>;
    await act(async () => { pending = useNotesStore.getState().initNotesStorage('B'); });
    expect(captureWikiPublication().targets).toEqual([]);
    await act(async () => oldNavigate(idTarget('target')));
    expect(old.isCurrent()).toBe(false);
    useNotesStore.getState().detachNotesStorage();
    expect(captureWikiPublication().targets).toEqual([]);
    await act(async () => { settle({ notes: [], migrated: false, migrationMs: 0, loadMs: 0 }); await pending; });
    expect(createNote).not.toHaveBeenCalled();
  });
  it('does not create missing/deleted IDs, but retains legacy title creation', async () => {
    await publish('B'); await mount();
    const before = JSON.stringify(useNotesStore.getState().notes);
    await act(async () => { navigate(idTarget('missing', 'Private B')); navigate({ ...idTarget('missing'), raw: '[](absinthe-note:%ZZ)' }); });
    expect(JSON.stringify(useNotesStore.getState().notes)).toBe(before);
    expect(createNote).not.toHaveBeenCalled();
    await act(async () => navigate('Missing legacy title'));
    expect(createNote).toHaveBeenCalledWith({ title: 'Missing legacy title', body: '' });
    await act(async () => navigate('[](absinthe-note:target)'));
    expect(createNote).toHaveBeenCalledWith({ title: '[](absinthe-note:target)', body: '' });
  });
});
