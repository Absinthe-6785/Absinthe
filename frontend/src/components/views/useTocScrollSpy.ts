import { useEffect, type RefObject } from 'react';
import type { Block } from './blockUtils';
import type { TocItem } from './noteUtils';
import { resolveHeadingScrollTargetFromBlocks } from './outlineNavigation';
import { measureHeadingPositionsHybrid, resolveActiveTocIndex } from './outlineScrollSpy';

export function useTocScrollSpy(
  scrollRootRef: RefObject<HTMLElement | null>,
  getBlocks: () => readonly Block[],
  toc: TocItem[],
  enabled: boolean,
  pausedRef: RefObject<boolean>,
  onActiveIdx: (idx: number | null) => void,
  getBlockScrollTop?: (blockId: string) => number | null,
): void {
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!enabled || !root || toc.length === 0) return;

    const buildEntries = () => {
      const blocks = getBlocks();
      return toc.map((_item, idx) => {
        const target = resolveHeadingScrollTargetFromBlocks(blocks, idx);
        return {
          idx,
          selector: target.selector,
          blockId: target.blockId,
        };
      });
    };

    let raf = 0;
    const update = () => {
      if (pausedRef.current) return;
      const entries = buildEntries();
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
  }, [scrollRootRef, getBlocks, toc, enabled, pausedRef, onActiveIdx, getBlockScrollTop]);
}
