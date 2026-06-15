import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store/useNotesStore', () => ({
  useNotesStore: {
    getState: () => ({ setActiveNoteId: vi.fn() }),
  },
}));

import {
  getNoteNavigationSnapshot,
  goBackNote,
  goForwardNote,
  navigateToNoteWithHistory,
  pushNoteNavigation,
  resetNoteNavigationStack,
  seedNoteNavigationStack,
} from './noteNavigationStack';

describe('noteNavigationStack', () => {
  beforeEach(() => {
    resetNoteNavigationStack();
  });

  it('seeds initial note', () => {
    seedNoteNavigationStack('a');
    expect(getNoteNavigationSnapshot().canBack).toBe(false);
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
});
