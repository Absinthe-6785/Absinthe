/**
 * Browser-style note navigation history within the Notes tab (K-65).
 */
import { useNotesStore } from '../store/useNotesStore';

export type NoteNavigationSource =
  | 'wiki'
  | 'relation'
  | 'backlink'
  | 'cosmos'
  | 'search'
  | 'panel'
  | 'external';

const MAX_STACK = 50;

let stack: string[] = [];
let index = -1;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(fn => fn());
}

export function subscribeNoteNavigationStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNoteNavigationSnapshot(): { canBack: boolean; canForward: boolean } {
  return {
    canBack: index > 0,
    canForward: index >= 0 && index < stack.length - 1,
  };
}

/** Seed stack when hydrating an existing active note (no history push). */
export function seedNoteNavigationStack(noteId: string | null): void {
  if (!noteId) {
    stack = [];
    index = -1;
    notify();
    return;
  }
  if (stack.length === 0) {
    stack = [noteId];
    index = 0;
    notify();
  }
}

export function pushNoteNavigation(toId: string, _source?: NoteNavigationSource): void {
  if (!toId) return;
  if (stack[index] === toId) return;

  stack = stack.slice(0, index + 1);
  stack.push(toId);
  if (stack.length > MAX_STACK) {
    const trim = stack.length - MAX_STACK;
    stack = stack.slice(trim);
    index = stack.length - 1;
  } else {
    index = stack.length - 1;
  }
  notify();
}

export function navigateToNoteWithHistory(
  toId: string,
  source: NoteNavigationSource = 'panel',
): void {
  if (!toId) return;
  pushNoteNavigation(toId, source);
  useNotesStore.getState().setActiveNoteId(toId);
}

export function goBackNote(): string | null {
  if (index <= 0) return null;
  index -= 1;
  const id = stack[index] ?? null;
  if (id) {
    useNotesStore.getState().setActiveNoteId(id);
  }
  notify();
  return id;
}

export function goForwardNote(): string | null {
  if (index < 0 || index >= stack.length - 1) return null;
  index += 1;
  const id = stack[index] ?? null;
  if (id) {
    useNotesStore.getState().setActiveNoteId(id);
  }
  notify();
  return id;
}

/** Test-only reset. */
export function resetNoteNavigationStack(): void {
  stack = [];
  index = -1;
  notify();
}
