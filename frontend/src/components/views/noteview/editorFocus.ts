import type { RefObject } from 'react';
import type { BlockEditorHandle } from '../BlockEditor';

const pendingModeFocusByRoot = new WeakMap<HTMLElement, () => void>();

/** Focus editor after entering edit mode — K-108A. */
export function scheduleEditorFocus(
  ref: RefObject<BlockEditorHandle | null>,
  blockId?: string,
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ref.current?.focusEditor(blockId);
    });
  });
}

/**
 * Preserve the visible editor position across a reading/edit mode transition.
 * Mode changes must never use focusEditor's implicit first-block fallback.
 */
export function scheduleEditorModeFocus(
  editorRef: RefObject<BlockEditorHandle | null>,
  scrollRef: RefObject<HTMLElement | null>,
  options: {
    focus: boolean;
    isCurrent: () => boolean;
    preferredBlockId?: string;
  },
): () => void {
  const scrollRoot = scrollRef.current;
  if (!scrollRoot) return () => {};
  cancelScheduledEditorModeFocus(scrollRoot);

  const scrollTop = scrollRoot.scrollTop;
  const scrollLeft = scrollRoot.scrollLeft;
  const viewport = scrollRoot.getBoundingClientRect();
  const visibleBlocks = Array.from(
    scrollRoot.querySelectorAll<HTMLElement>('.be-block[data-drag-id]'),
  )
    .map(element => ({
      id: element.dataset.dragId,
      rect: element.getBoundingClientRect(),
    }))
    .filter(({ id, rect }) => Boolean(id) && rect.bottom > viewport.top && rect.top < viewport.bottom)
    .sort((a, b) => a.rect.top - b.rect.top);
  const preferred = options.preferredBlockId
    ? visibleBlocks.find(block => block.id === options.preferredBlockId)
    : undefined;
  const focusBlockId = options.focus ? (preferred ?? visibleBlocks[0])?.id : undefined;

  let cancelled = false;
  const pendingFrames = new Set<number>();
  const nextFrame = (callback: () => void) => {
    let frame = 0;
    frame = requestAnimationFrame(() => {
      pendingFrames.delete(frame);
      if (!cancelled) callback();
    });
    pendingFrames.add(frame);
  };
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    pendingFrames.forEach(frame => cancelAnimationFrame(frame));
    pendingFrames.clear();
    if (pendingModeFocusByRoot.get(scrollRoot) === cancel) pendingModeFocusByRoot.delete(scrollRoot);
  };
  const isCurrent = () => {
    if (cancelled) return false;
    if (scrollRef.current !== scrollRoot || !options.isCurrent()) {
      cancel();
      return false;
    }
    return true;
  };
  const restoreViewport = () => {
    if (!isCurrent()) return;
    scrollRoot.scrollTop = scrollTop;
    scrollRoot.scrollLeft = scrollLeft;
    if (pendingModeFocusByRoot.get(scrollRoot) === cancel) pendingModeFocusByRoot.delete(scrollRoot);
  };

  nextFrame(() => nextFrame(() => {
    if (!isCurrent()) return;
    if (!focusBlockId) {
      restoreViewport();
      return;
    }
    editorRef.current?.focusEditor(focusBlockId, { preventScroll: true });
    // Let editor/virtual-list focus settle before restoring the captured viewport.
    nextFrame(() => nextFrame(restoreViewport));
  }));

  pendingModeFocusByRoot.set(scrollRoot, cancel);
  return cancel;
}

/** Cancel a pending mode-focus restore before any other navigation or mode change. */
export function cancelScheduledEditorModeFocus(scrollRoot: HTMLElement | null): void {
  if (scrollRoot) pendingModeFocusByRoot.get(scrollRoot)?.();
}

export const K108A_EDITOR_FOCUS_HOOKS = [
  'focusEditor',
  'scheduleEditorFocus',
  'scheduleEditorModeFocus',
  'data-k108-editor-focus',
] as const;
