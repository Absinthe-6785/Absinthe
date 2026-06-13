import { useEffect, type RefObject } from 'react';
import type { TocItem } from './noteUtils';
import { resolveHeadingScrollTarget } from './outlineNavigation';
import { measureHeadingPositionsHybrid, resolveActiveTocIndex } from './outlineScrollSpy';

export function useTocScrollSpy(
  scrollRootRef: RefObject<HTMLElement | null>,
  body: string,
  toc: TocItem[],
  enabled: boolean,
  pausedRef: RefObject<boolean>,
  onActiveIdx: (idx: number | null) => void,
  getBlockScrollTop?: (blockId: string) => number | null,
): void {
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!enabled || !root || toc.length === 0) return;

    const entries = toc.map((_item, idx) => {
      const target = resolveHeadingScrollTarget(body, idx);
      return {
        idx,
        selector: target.selector,
        blockId: target.blockId,
      };
    });

    let raf = 0;
    const update = () => {
      if (pausedRef.current) return;
      const positions = getBlockScrollTop
        ? measureHeadingPositionsHybrid(root, entries, getBlockScrollTop)
        : measureHeadingPositionsHybrid(root, entries);
      if (!positions.length) return;
      onActiveIdx(resolveActiveTocIndex(root.scrollTop, positions));
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(root);
    update();

    return () => {
      root.removeEventListener('scroll', onScroll);
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [scrollRootRef, body, toc, enabled, pausedRef, onActiveIdx, getBlockScrollTop]);
}
