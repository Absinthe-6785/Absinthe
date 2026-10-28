// @vitest-environment happy-dom
import type { RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockEditorHandle } from '../BlockEditor';
import { cancelScheduledEditorModeFocus, scheduleEditorModeFocus } from './editorFocus';

function rect(top: number, bottom: number): DOMRect {
  return {
    x: 0, y: top, top, bottom, left: 0, right: 640,
    width: 640, height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect;
}

afterEach(() => vi.unstubAllGlobals());

describe('editor mode focus scheduling', () => {
  it('cancels a stale focus from another mode-entry path on the same scroll root', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));

    const scrollRoot = document.createElement('div');
    const visibleBlock = document.createElement('div');
    visibleBlock.className = 'be-block';
    visibleBlock.dataset.dragId = 'visible-block';
    scrollRoot.append(visibleBlock);
    document.body.append(scrollRoot);
    vi.spyOn(scrollRoot, 'getBoundingClientRect').mockReturnValue(rect(100, 200));
    vi.spyOn(visibleBlock, 'getBoundingClientRect').mockReturnValue(rect(120, 160));

    const scrollRef = { current: scrollRoot } as RefObject<HTMLElement | null>;
    const staleFocus = vi.fn();
    const currentFocus = vi.fn();
    const staleEditor = { current: { focusEditor: staleFocus } } as unknown as RefObject<BlockEditorHandle | null>;
    const currentEditor = { current: { focusEditor: currentFocus } } as unknown as RefObject<BlockEditorHandle | null>;

    scrollRoot.scrollTop = 560;
    scheduleEditorModeFocus(staleEditor, scrollRef, { focus: true, isCurrent: () => true });

    // A separate entry point changes mode and schedules its own focus before
    // the previous entry point's animation-frame callbacks have completed.
    scrollRoot.scrollTop = 44;
    scheduleEditorModeFocus(currentEditor, scrollRef, { focus: true, isCurrent: () => true });

    let drainedFrames = 0;
    while (frames.size && drainedFrames < 8) {
      drainedFrames += 1;
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach(callback => callback(drainedFrames));
    }

    expect(staleFocus).not.toHaveBeenCalled();
    expect(currentFocus).toHaveBeenCalledOnce();
    expect(currentFocus).toHaveBeenCalledWith('visible-block', { preventScroll: true });
    expect(scrollRoot.scrollTop).toBe(44);

    cancelScheduledEditorModeFocus(scrollRoot);
    scrollRoot.remove();
  });
});
