/**
 * Scroll-driven TOC active index — isolated from NoteView React state.
 * Subscribers (OutlinePanel) update without NoteView rerenders.
 */

type Listener = () => void;

let activeIdx: number | null = null;
const listeners = new Set<Listener>();

let devUpdateCount = 0;
let devSkippedDuplicateCount = 0;

export function getTocScrollActiveIdx(): number | null {
  return activeIdx;
}

export function subscribeTocScrollActiveIdx(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function setTocScrollActiveIdx(next: number | null): void {
  if (next === activeIdx) {
    if (import.meta.env.DEV) devSkippedDuplicateCount += 1;
    return;
  }
  activeIdx = next;
  if (import.meta.env.DEV) devUpdateCount += 1;
  emit();
}

export function resetTocScrollStore(): void {
  if (activeIdx === null) return;
  activeIdx = null;
  if (import.meta.env.DEV) devUpdateCount += 1;
  emit();
}

/** DEV/test — reset counters and state. */
export function resetTocScrollDiagnostics(): void {
  activeIdx = null;
  devUpdateCount = 0;
  devSkippedDuplicateCount = 0;
  listeners.clear();
}

export function getTocScrollDiagnostics(): {
  activeIdx: number | null;
  updateCount: number;
  skippedDuplicateCount: number;
  subscriberCount: number;
} {
  return {
    activeIdx,
    updateCount: devUpdateCount,
    skippedDuplicateCount: devSkippedDuplicateCount,
    subscriberCount: listeners.size,
  };
}
