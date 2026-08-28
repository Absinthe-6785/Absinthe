// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Block } from './blockUtils';
import { copyBlocksToClipboard } from './features/block-editor/features/clipboard/copy/copyToClipboard';
import { useBlockEditor, type BlockEditorHandle } from './useBlockEditor';
import {
  getCaretOffset,
  getSelectionOffsets,
  setCaretOffset,
  setSelectionOffsets,
} from './features/block-editor/features/selection';

vi.mock('./features/block-editor/features/clipboard/copy/copyToClipboard', () => ({
  copyBlocksToClipboard: vi.fn(),
}));

type HistoryApi = BlockEditorHandle & {
  handleBlockChange: (blocks: Block[]) => void;
  getBody: () => string;
};

function HistoryHarness({
  apiRef,
  initialBody = 'A\nB\nC',
}: {
  apiRef: { current: HistoryApi | null };
  initialBody?: string;
}) {
  const [body, setBody] = useState(initialBody);
  const editor = useBlockEditor(body, setBody);
  apiRef.current = { ...editor, getBody: () => body };
  const first = editor.blocks[0];
  return createElement('div', null,
    first && createElement('div', {
      className: 'editor-drop-zone',
      children: createElement('div', {
        className: 'be-editable',
        contentEditable: true,
        suppressContentEditableWarning: true,
        'data-block-id': first.id,
        dangerouslySetInnerHTML: { __html: first.content },
      }),
    }),
    createElement('output', { 'data-body': body }),
  );
}

function mountHistoryHarness(initialBody?: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const apiRef = { current: null as HistoryApi | null };
  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(HistoryHarness, { apiRef, initialBody }));
  });
  return { apiRef, host, root };
}

function paragraphBlocks(apiRef: { current: HistoryApi | null }): Block[] {
  return apiRef.current!.getBlocks();
}

describe('useBlockEditor history transactions', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('routes document copy through the eager clipboard helper with current blocks', async () => {
    const copy = vi.mocked(copyBlocksToClipboard);
    copy.mockResolvedValue(true);
    const mounted = mountHistoryHarness('A\nB\nC');
    const api = mounted.apiRef.current!;
    const blocks = api.getBlocks();
    let result: boolean | undefined;

    await act(async () => {
      result = await api.copyDocument();
    });

    expect(result).toBe(true);
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy.mock.calls[0]?.[0]).toBe(blocks);

    act(() => mounted.root?.unmount());
  });

  it('preserves clipboard-helper rejection through the document-copy contract', async () => {
    const copy = vi.mocked(copyBlocksToClipboard);
    const error = new Error('clipboard unavailable');
    copy.mockRejectedValue(error);
    const mounted = mountHistoryHarness('A\nB\nC');
    const api = mounted.apiRef.current!;

    await expect(api.copyDocument()).rejects.toBe(error);

    act(() => mounted.root?.unmount());
  });

  it('keeps structural reorder undoable and redoable', () => {
    const mounted = mountHistoryHarness();
    const api = mounted.apiRef.current!;
    const before = paragraphBlocks(mounted.apiRef);
    const moved = [before[1]!, before[0]!, before[2]!];

    act(() => api.handleBlockChange(moved));
    expect(mounted.host.querySelector('output')?.getAttribute('data-body')).toBe('B\nA\nC');

    act(() => api.undo());
    expect(mounted.host.querySelector('output')?.getAttribute('data-body')).toBe('A\nB\nC');
    act(() => api.redo());
    expect(mounted.host.querySelector('output')?.getAttribute('data-body')).toBe('B\nA\nC');

    act(() => mounted.root?.unmount());
  });

  it('clears the redo branch after a new text edit', () => {
    const mounted = mountHistoryHarness();
    const api = mounted.apiRef.current!;
    const current = paragraphBlocks(mounted.apiRef);
    const firstEdit = current.map(block => block.id === current[0]!.id ? { ...block, content: 'AB' } : block);
    const secondEdit = firstEdit.map(block => block.id === firstEdit[0]!.id ? { ...block, content: 'ABC' } : block);
    const newEdit = firstEdit.map(block => block.id === firstEdit[0]!.id ? { ...block, content: 'AX' } : block);

    act(() => api.handleBlockChange(firstEdit));
    act(() => api.handleBlockChange(secondEdit));
    act(() => api.undo());
    expect(mounted.host.querySelector('output')?.getAttribute('data-body')).toBe('AB\nB\nC');
    act(() => api.handleBlockChange(newEdit));
    expect(api.canRedo()).toBe(false);

    act(() => mounted.root?.unmount());
  });

  it('keeps the same block focused and restores the asd caret through undo/redo', () => {
    const mounted = mountHistoryHarness('');
    const api = mounted.apiRef.current!;
    const blockId = api.getBlocks()[0]!.id;
    const editable = () => mounted.host.querySelector<HTMLElement>('.be-editable')!;
    const editableNode = editable();
    const edit = (text: string, caretBefore: number, caretAfter: number) => {
      const el = editable();
      el.focus();
      setCaretOffset(el, caretBefore);
      el.dispatchEvent(new Event('beforeinput', { bubbles: true }));
      const next = mounted.apiRef.current!.getBlocks()
        .map(block => block.id === blockId ? { ...block, content: text } : block);
      el.textContent = text;
      setCaretOffset(el, caretAfter);
      act(() => api.handleBlockChange(next));
    };

    edit('a', 0, 1);
    edit('as', 1, 2);
    edit('asd', 2, 3);

    const expectedUndo = [['as', 2], ['a', 1], ['', 0]] as const;
    for (const [text, caret] of expectedUndo) {
      act(() => api.undo());
      expect(mounted.apiRef.current!.getBlocks()[0]!.content).toBe(text);
      expect(editable().dataset.blockId).toBe(blockId);
      expect(editable()).toBe(editableNode);
      expect(document.activeElement).toBe(editable());
      expect(getCaretOffset(editable())).toBe(caret);
    }

    const expectedRedo = [['a', 1], ['as', 2], ['asd', 3]] as const;
    for (const [text, caret] of expectedRedo) {
      act(() => api.redo());
      expect(mounted.apiRef.current!.getBlocks()[0]!.content).toBe(text);
      expect(document.activeElement).toBe(editable());
      expect(getCaretOffset(editable())).toBe(caret);
    }

    act(() => mounted.root?.unmount());
  });

  it('restores middle-caret and selection-replacement transactions', () => {
    const mounted = mountHistoryHarness('abcd');
    const api = mounted.apiRef.current!;
    const blockId = api.getBlocks()[0]!.id;
    const editable = () => mounted.host.querySelector<HTMLElement>('.be-editable')!;
    const applyEdit = (
      text: string,
      before: [number, number],
      afterCaret: number,
    ) => {
      const el = editable();
      el.focus();
      setSelectionOffsets(el, before[0], before[1]);
      el.dispatchEvent(new Event('beforeinput', { bubbles: true }));
      el.textContent = text;
      setCaretOffset(el, afterCaret);
      const next = mounted.apiRef.current!.getBlocks()
        .map(block => block.id === blockId ? { ...block, content: text } : block);
      act(() => api.handleBlockChange(next));
    };

    applyEdit('abXcd', [2, 2], 3);
    act(() => api.undo());
    expect(mounted.apiRef.current!.getBlocks()[0]!.content).toBe('abcd');
    expect(document.activeElement).toBe(editable());
    expect(getCaretOffset(editable())).toBe(2);

    applyEdit('aXd', [1, 3], 2);
    act(() => api.undo());
    expect(mounted.apiRef.current!.getBlocks()[0]!.content).toBe('abcd');
    expect(document.activeElement).toBe(editable());
    expect(getSelectionOffsets(editable())).toEqual({ start: 1, end: 3 });

    act(() => mounted.root?.unmount());
  });
});
