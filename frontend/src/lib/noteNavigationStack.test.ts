import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionStore = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => sessionStore.get(k) ?? null,
  setItem: (k: string, v: string) => { sessionStore.set(k, v); },
  removeItem: (k: string) => { sessionStore.delete(k); },
  clear: () => { sessionStore.clear(); },
  key: () => null,
  length: 0,
});

vi.mock('../store/useNotesStore', () => ({
  useNotesStore: {
    getState: () => ({ setActiveNoteId: vi.fn() }),
  },
}));

import {
  getNoteNavigationSnapshot,
  getNoteNavigationStack,
  goBackNote,
  goForwardNote,
  navigateToNoteWithHistory,
  pruneNoteNavigationStack,
  pushNoteNavigation,
  resetNoteNavigationStack,
  seedNoteNavigationStack,
} from './noteNavigationStack';

describe('noteNavigationStack', () => {
  beforeEach(() => {
    sessionStore.clear();
    resetNoteNavigationStack();
  });

  it('getNoteNavigationSnapshot returns a stable reference when values unchanged', () => {
    const a = getNoteNavigationSnapshot();
    const b = getNoteNavigationSnapshot();
    expect(a).toBe(b);
  });

  it('seeds initial note', () => {
    seedNoteNavigationStack('a');
    expect(getNoteNavigationSnapshot().canBack).toBe(false);
    expect(getNoteNavigationStack()[0]?.source).toBe('panel');
  });

  it('supports back and forward', () => {
    seedNoteNavigationStack('a');
    pushNoteNavigation('b', 'wiki');
    pushNoteNavigation('c', 'cosmos');
    expect(getNoteNavigationSnapshot().canBack).toBe(true);
    expect(goBackNote()).toBe('b');
    expect(getNoteNavigationSnapshot().canForward).toBe(true);
    expect(goForwardNote()).toBe('c');
  });

  it('truncates forward history on new navigation', () => {
    seedNoteNavigationStack('a');
    pushNoteNavigation('b', 'wiki');
    pushNoteNavigation('c', 'search');
    goBackNote();
    pushNoteNavigation('d', 'panel');
    expect(goForwardNote()).toBeNull();
    expect(getNoteNavigationSnapshot().canForward).toBe(false);
  });

  it('navigateToNoteWithHistory pushes and updates store', () => {
    seedNoteNavigationStack('n1');
    navigateToNoteWithHistory('n2', 'wiki');
    expect(getNoteNavigationSnapshot().canBack).toBe(true);
  });

  it('persists stack to sessionStorage', () => {
    seedNoteNavigationStack('a');
    pushNoteNavigation('b', 'schedule');
    const raw = sessionStore.get('absinthe.noteNav.v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.stack[1].source).toBe('schedule');
    expect(parsed.index).toBe(1);
  });

  it('does not clear stack when seeding with null', () => {
    seedNoteNavigationStack('a');
    pushNoteNavigation('b', 'wiki');
    seedNoteNavigationStack(null);
    expect(getNoteNavigationStack()).toHaveLength(2);
  });

  it('removes deleted note ids from history', () => {
    pushNoteNavigation('a');
    pushNoteNavigation('b');
    pushNoteNavigation('c');

    pruneNoteNavigationStack(new Set(['b']));

    expect(getNoteNavigationStack().map(entry => entry.id)).toEqual(['a', 'c']);
  });
});
