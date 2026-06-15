// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  openNote,
  peekNotesTabSwitcher,
  registerNotesTabSwitcher,
  registerAppTabSwitcher,
  getNoteReturnTab,
  returnFromNote,
  clearNoteReturnTab,
  getNoteBreadcrumb,
  openHealthDayNote,
} from './noteNavigation';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
  key: () => null,
  length: 0,
});
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => storage.get(`s:${k}`) ?? null,
  setItem: (k: string, v: string) => { storage.set(`s:${k}`, v); },
  removeItem: (k: string) => { storage.delete(`s:${k}`); },
  clear: () => { storage.clear(); },
  key: () => null,
  length: 0,
});

vi.mock('./supabase', () => ({
  authFetch: vi.fn(),
}));

const { useNotesStore } = await import('../store/useNotesStore');
const { resetNoteNavigationStack } = await import('./noteNavigationStack');
const { resetNoteBreadcrumb } = await import('./noteBreadcrumb');

describe('noteNavigation', () => {
  beforeEach(() => {
    storage.clear();
    registerNotesTabSwitcher(() => {})();
    registerAppTabSwitcher(() => {})();
    resetNoteNavigationStack();
    resetNoteBreadcrumb();
    useNotesStore.setState({ notes: [], folders: [], activeNoteId: null });
  });

  it('openNote sets activeNoteId via the notes store', () => {
    openNote('note-abc');
    expect(useNotesStore.getState().activeNoteId).toBe('note-abc');
  });

  it('openNote ignores empty note ids', () => {
    openNote('');
    expect(useNotesStore.getState().activeNoteId).toBeNull();
  });

  it('openNote invokes the registered Notes tab switcher', () => {
    const switcher = vi.fn();
    registerNotesTabSwitcher(switcher);
    openNote('note-xyz');
    expect(switcher).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().activeNoteId).toBe('note-xyz');
  });

  it('openNote with returnTab stores schedule return path', () => {
    openNote('note-sched', { returnTab: 'planner' });
    expect(getNoteReturnTab()).toBe('planner');
  });

  it('returnFromNote switches tab and clears return path', () => {
    const appSwitcher = vi.fn();
    registerAppTabSwitcher(appSwitcher);
    openNote('note-health', { returnTab: 'health' });
    expect(returnFromNote()).toBe(true);
    expect(appSwitcher).toHaveBeenCalledWith('health');
    expect(getNoteReturnTab()).toBeNull();
  });

  it('openNote works without a registered switcher (note selection only)', () => {
    expect(peekNotesTabSwitcher()).toBeNull();
    openNote('note-solo');
    expect(useNotesStore.getState().activeNoteId).toBe('note-solo');
  });

  it('unregisterNotesTabSwitcher clears the active switcher', () => {
    const switcher = vi.fn();
    const unregister = registerNotesTabSwitcher(switcher);
    unregister();
    expect(peekNotesTabSwitcher()).toBeNull();
    openNote('note-after');
    expect(switcher).not.toHaveBeenCalled();
    expect(useNotesStore.getState().activeNoteId).toBe('note-after');
  });

  it('clearNoteReturnTab removes stored tab', () => {
    openNote('n', { returnTab: 'planner' });
    clearNoteReturnTab();
    expect(getNoteReturnTab()).toBeNull();
  });

  it('openNote with analytics returnTab stores archive return path', () => {
    openNote('note-arch', { returnTab: 'analytics' });
    expect(getNoteReturnTab()).toBe('analytics');
  });

  it('returnFromNote returns to analytics tab', () => {
    const appSwitcher = vi.fn();
    registerAppTabSwitcher(appSwitcher);
    openNote('note-arch', { returnTab: 'analytics' });
    expect(returnFromNote()).toBe(true);
    expect(appSwitcher).toHaveBeenCalledWith('analytics');
  });

  it('openNote with breadcrumb persists segments', () => {
    const crumbs = [
      { type: 'key' as const, key: 'archiveHomeTitle' as const },
      { type: 'key' as const, key: 'archiveRecentMilestonesTitle' as const },
    ];
    openNote('note-bc', { breadcrumb: crumbs });
    expect(getNoteBreadcrumb()).toEqual(crumbs);
  });

  it('openHealthDayNote creates dated note with health return path', () => {
    const createNote = vi.fn(() => 'new-health-note');
    const updateNote = vi.fn();
    openHealthDayNote('2026-06-14', createNote, updateNote, [
      { type: 'key', key: 'healthNavNutrition' },
      { type: 'key', key: 'healthOpenDayNote' },
    ]);
    expect(createNote).toHaveBeenCalled();
    expect(updateNote).toHaveBeenCalledWith('new-health-note', { title: '2026-06-14' });
    expect(getNoteReturnTab()).toBe('health');
    expect(getNoteBreadcrumb()).toEqual([
      { type: 'key', key: 'healthNavNutrition' },
      { type: 'key', key: 'healthOpenDayNote' },
    ]);
    expect(useNotesStore.getState().activeNoteId).toBe('new-health-note');
  });

  it('openHealthDayNote reuses existing day note', () => {
    useNotesStore.setState({
      notes: [{ id: 'existing', title: '2026-06-14', body: '', updatedAt: 0, folderId: null, deletedAt: null }],
      folders: [],
      activeNoteId: null,
    });
    const createNote = vi.fn();
    openHealthDayNote('2026-06-14', createNote, vi.fn());
    expect(createNote).not.toHaveBeenCalled();
    expect(useNotesStore.getState().activeNoteId).toBe('existing');
  });
});
