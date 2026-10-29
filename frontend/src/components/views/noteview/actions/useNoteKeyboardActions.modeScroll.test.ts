// @vitest-environment happy-dom
import { act, createElement, createRef, useLayoutEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockEditorHandle } from '../../BlockEditor';
import type { UseNoteViewActionsParams } from './types';
import { useNoteKeyboardActions } from './useNoteKeyboardActions';

vi.mock('../../../../store/useNotesStore', () => ({
  useNotesStore: { getState: () => ({ notes: [] }) },
  observePublishedNotesHydration: () => ({ status: 'UNAVAILABLE', reason: 'NO_PUBLISHED_HYDRATION' }),
}));
vi.mock('../../../../hooks/useNoteNavigationStack', () => ({
  useNoteNavigationStack: () => ({ canBack: false, canForward: false, goBack: vi.fn(), goForward: vi.fn() }),
}));

function rect(top: number, bottom: number): DOMRect {
  return {
    x: 0, y: top, top, bottom, left: 0, right: 640,
    width: 640, height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect;
}

async function flushAnimationFrames() {
  await act(async () => {
    await new Promise<void>(resolve => {
      let remaining = 8;
      const next = () => {
        remaining -= 1;
        if (remaining === 0) resolve();
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    });
  });
}

function renderKeyboardHarness() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const editorScrollRef = createRef<HTMLDivElement>();
  const focusedIds: string[] = [];
  const blockEditorRef = {
    current: {
      focusEditor: vi.fn((blockId?: string, options?: { preventScroll?: boolean }) => {
        if (blockId) focusedIds.push(blockId);
        if (!options?.preventScroll && editorScrollRef.current) editorScrollRef.current.scrollTop = 0;
      }),
    },
  } as unknown as React.RefObject<BlockEditorHandle | null>;
  let changeNoteId: (id: string) => void = () => {};

  function Harness() {
    const [viewMode, setViewMode] = useState<'edit' | 'reading'>('reading');
    const [activeNoteId, setActiveNoteId] = useState('note-a');
    changeNoteId = setActiveNoteId;
    useNoteKeyboardActions({
      notes: [],
      activeNote: { id: activeNoteId } as never,
      activeNoteId,
      viewMode,
      showSortMenu: false,
      searchInputRef: createRef<HTMLInputElement>(),
      blockEditorRef,
      editorScrollRef,
      setViewMode,
      setShowShortcuts: vi.fn(),
      setShowSortMenu: vi.fn(),
      setFocusMode: vi.fn(),
      setSearchScope: vi.fn(),
      setDocumentSearchOpen: vi.fn(),
      setActiveNoteId: vi.fn(),
      flushPendingSync: vi.fn(),
      syncNoteToDB: vi.fn(),
    } as unknown as UseNoteViewActionsParams, vi.fn(), vi.fn());

    useLayoutEffect(() => {
      if (viewMode === 'reading' && editorScrollRef.current?.scrollTop) {
        editorScrollRef.current.scrollTop = 0;
      }
    }, [viewMode]);

    return createElement('div', { 'data-mode': viewMode },
      createElement('div', { className: 'editor-drop-zone', ref: editorScrollRef },
        createElement('div', { className: 'be-block', 'data-drag-id': 'first' }),
        createElement('div', { className: 'be-block', 'data-drag-id': 'visible' }),
        createElement('div', { className: 'be-block', 'data-drag-id': 'last' }),
      ),
    );
  }

  act(() => root.render(createElement(Harness)));
  return { host, root, editorScrollRef, focusedIds, changeNoteId: (id: string) => changeNoteId(id) };
}

function pressEditorModeShortcut() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'e', ctrlKey: true, bubbles: true, cancelable: true,
    }));
  });
}

afterEach(() => vi.unstubAllEnvs());

describe('Notes keyboard mode scroll preservation', () => {
  it('keeps the visible block focused without scrolling on both Ctrl+E transitions', async () => {
    const mounted = renderKeyboardHarness();
    const scroll = mounted.editorScrollRef.current!;
    const blocks = Array.from(scroll.querySelectorAll<HTMLElement>('[data-drag-id]'));
    vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue(rect(100, 300));
    vi.spyOn(blocks[0], 'getBoundingClientRect').mockReturnValue(rect(20, 60));
    vi.spyOn(blocks[1], 'getBoundingClientRect').mockReturnValue(rect(130, 170));
    vi.spyOn(blocks[2], 'getBoundingClientRect').mockReturnValue(rect(220, 260));
    scroll.scrollTop = 560;

    pressEditorModeShortcut();
    await flushAnimationFrames();
    expect(mounted.host.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('edit');
    expect(mounted.focusedIds).toEqual(['visible']);
    expect(mounted.editorScrollRef.current?.scrollTop).toBe(560);
    expect(mounted.focusedIds).toHaveLength(1);

    scroll.scrollTop = 720;
    pressEditorModeShortcut();
    await flushAnimationFrames();
    expect(mounted.host.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('reading');
    expect(mounted.editorScrollRef.current?.scrollTop).toBe(720);
    expect(mounted.focusedIds).toHaveLength(1);

    cleanup(mounted.root, mounted.host);
  });

  it('does not apply a pending mode focus or old scroll snapshot after the active note changes', async () => {
    const mounted = renderKeyboardHarness();
    const scroll = mounted.editorScrollRef.current!;
    const blocks = Array.from(scroll.querySelectorAll<HTMLElement>('[data-drag-id]'));
    vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue(rect(100, 300));
    blocks.forEach((block, index) => vi.spyOn(block, 'getBoundingClientRect').mockReturnValue(rect(120 + index * 50, 160 + index * 50)));
    scroll.scrollTop = 500;

    pressEditorModeShortcut();
    act(() => mounted.changeNoteId('note-b'));
    act(() => mounted.changeNoteId('note-a'));
    scroll.scrollTop = 44;
    await flushAnimationFrames();

    expect(mounted.focusedIds).toHaveLength(0);
    expect(mounted.editorScrollRef.current?.scrollTop).toBe(44);
    expect(mounted.host.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('edit');
    cleanup(mounted.root, mounted.host);
  });
});

function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove();
}
