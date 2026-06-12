// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  openNote,
  peekNotesTabSwitcher,
  registerNotesTabSwitcher,
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

vi.mock('./supabase', () => ({
  authFetch: vi.fn(),
}));

const { useNotesStore } = await import('../store/useNotesStore');

describe('noteNavigation', () => {
  beforeEach(() => {
    storage.clear();
    registerNotesTabSwitcher(() => {})();
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
});
