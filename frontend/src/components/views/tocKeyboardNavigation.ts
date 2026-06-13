export interface VisibleTocNavEntry {
  idx: number;
}

/**
 * Move keyboard selection among visible TOC rows (respects collapsed sections).
 * Returns the underlying heading index (`item.idx`), not the visible list position.
 */
export function resolveNextTocKeyboardIndex(
  visibleToc: readonly VisibleTocNavEntry[],
  currentIdx: number | null,
  direction: 'next' | 'prev',
): number | null {
  if (visibleToc.length === 0) return null;

  let pos = currentIdx === null
    ? -1
    : visibleToc.findIndex(entry => entry.idx === currentIdx);

  if (pos < 0 && currentIdx !== null) {
    if (direction === 'next') {
      const nextEntry = visibleToc.find(entry => entry.idx > currentIdx);
      return nextEntry?.idx ?? visibleToc[visibleToc.length - 1]?.idx ?? null;
    }
    const prevEntry = [...visibleToc].reverse().find(entry => entry.idx < currentIdx);
    return prevEntry?.idx ?? visibleToc[0]?.idx ?? null;
  }

  if (pos < 0) {
    pos = direction === 'next' ? -1 : visibleToc.length;
  }

  const nextPos = direction === 'next'
    ? Math.min(pos + 1, visibleToc.length - 1)
    : Math.max(pos - 1, 0);

  return visibleToc[nextPos]?.idx ?? null;
}

export function resolveTocOpenIndex(
  visibleToc: readonly VisibleTocNavEntry[],
  keyboardIdx: number | null,
  activeIdx: number | null,
): number | null {
  if (keyboardIdx !== null) return keyboardIdx;
  if (activeIdx !== null) return activeIdx;
  return visibleToc[0]?.idx ?? null;
}
