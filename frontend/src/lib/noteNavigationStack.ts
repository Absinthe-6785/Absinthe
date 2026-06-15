/**
 * Browser-style note navigation history within the Notes tab (K-65, K-66 session persistence).
 */
import { useNotesStore } from '../store/useNotesStore';

export type NoteNavigationSource =
  | 'wiki'
  | 'relation'
  | 'backlink'
  | 'cosmos'
  | 'search'
  | 'panel'
  | 'external'
  | 'schedule'
  | 'health'
  | 'archive'
  | 'discovery'
  | 'timeline';

export interface NoteNavigationEntry {
  id: string;
  source: NoteNavigationSource;
}

const MAX_STACK = 50;
const STORAGE_KEY = 'absinthe.noteNav.v1';

let stack: NoteNavigationEntry[] = [];
let index = -1;
const listeners = new Set<() => void>();

function canUseSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function persistStack(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ stack, index }));
  } catch {
    /* quota / private mode */
  }
}

function loadPersistedStack(): void {
  if (!canUseSessionStorage()) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { stack?: NoteNavigationEntry[]; index?: number };
    if (!Array.isArray(parsed.stack)) return;
    stack = parsed.stack.filter((e): e is NoteNavigationEntry => Boolean(e?.id));
    index = typeof parsed.index === 'number'
      ? Math.min(Math.max(-1, parsed.index), Math.max(0, stack.length - 1))
      : stack.length > 0 ? 0 : -1;
  } catch {
    stack = [];
    index = -1;
  }
}

function notify(): void {
  persistStack();
  listeners.forEach(fn => fn());
}

loadPersistedStack();

export function subscribeNoteNavigationStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let cachedNavigationSnapshot: { canBack: boolean; canForward: boolean } = {
  canBack: false,
  canForward: false,
};

export function getNoteNavigationSnapshot(): { canBack: boolean; canForward: boolean } {
  const canBack = index > 0;
  const canForward = index >= 0 && index < stack.length - 1;
  if (
    cachedNavigationSnapshot.canBack !== canBack
    || cachedNavigationSnapshot.canForward !== canForward
  ) {
    cachedNavigationSnapshot = { canBack, canForward };
  }
  return cachedNavigationSnapshot;
}

export function getNoteNavigationStack(): readonly NoteNavigationEntry[] {
  return stack;
}

export function getCurrentNavigationEntry(): NoteNavigationEntry | null {
  return stack[index] ?? null;
}

/** Seed stack when hydrating an existing active note (no history push). */
export function seedNoteNavigationStack(noteId: string | null): void {
  if (!noteId) return;
  if (stack.length === 0) {
    stack = [{ id: noteId, source: 'panel' }];
    index = 0;
    notify();
  }
}

export function pushNoteNavigation(toId: string, source: NoteNavigationSource = 'panel'): void {
  if (!toId) return;
  if (stack[index]?.id === toId) return;

  stack = stack.slice(0, index + 1);
  stack.push({ id: toId, source });
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
  const id = stack[index]?.id ?? null;
  if (id) {
    useNotesStore.getState().setActiveNoteId(id);
  }
  notify();
  return id;
}

export function goForwardNote(): string | null {
  if (index < 0 || index >= stack.length - 1) return null;
  index += 1;
  const id = stack[index]?.id ?? null;
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
  cachedNavigationSnapshot = { canBack: false, canForward: false };
  if (canUseSessionStorage()) {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  }
  notify();
}
