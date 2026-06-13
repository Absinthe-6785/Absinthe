/** Resolve which TOC heading index is active based on scroll position. */
export function resolveActiveTocIndex(
  scrollTop: number,
  headings: { idx: number; top: number }[],
  offset = 48,
): number | null {
  if (!headings.length) return null;
  const probe = scrollTop + offset;
  let active: number | null = headings[0]?.idx ?? null;
  for (const h of headings) {
    if (h.top <= probe) active = h.idx;
    else break;
  }
  return active;
}

/** Build heading positions from DOM nodes mapped to TOC indices. */
export function measureHeadingPositions(
  scrollRoot: HTMLElement,
  entries: { idx: number; selector: string }[],
): { idx: number; top: number }[] {
  const rootTop = scrollRoot.getBoundingClientRect().top;
  const scrollTop = scrollRoot.scrollTop;
  const out: { idx: number; top: number }[] = [];
  for (const entry of entries) {
    const el = scrollRoot.querySelector(entry.selector);
    if (!el) continue;
    const top = scrollTop + el.getBoundingClientRect().top - rootTop;
    out.push({ idx: entry.idx, top });
  }
  return out.sort((a, b) => a.top - b.top);
}

/** DOM-first heading positions with virtual-list fallback for off-screen blocks. */
export function measureHeadingPositionsHybrid(
  scrollRoot: HTMLElement,
  entries: { idx: number; selector: string; blockId: string | null }[],
  getBlockScrollTop?: (blockId: string) => number | null,
): { idx: number; top: number }[] {
  const rootTop = scrollRoot.getBoundingClientRect().top;
  const scrollTop = scrollRoot.scrollTop;
  const out: { idx: number; top: number }[] = [];

  for (const entry of entries) {
    const el = scrollRoot.querySelector(entry.selector);
    if (el) {
      out.push({
        idx: entry.idx,
        top: scrollTop + el.getBoundingClientRect().top - rootTop,
      });
      continue;
    }
    if (entry.blockId && getBlockScrollTop) {
      const top = getBlockScrollTop(entry.blockId);
      if (top != null) out.push({ idx: entry.idx, top });
    }
  }

  return out.sort((a, b) => a.top - b.top);
}
