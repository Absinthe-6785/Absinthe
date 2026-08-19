// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { type Block } from './blockUtils';
import { useBlockEditor, type BlockEditorHandle } from './useBlockEditor';

type HistoryApi = BlockEditorHandle & {
  handleBlockChange: (blocks: Block[]) => void;
  getBody: () => string;
};

function HistoryHarness({ apiRef }: { apiRef: { current: HistoryApi | null } }) {
  const [body, setBody] = useState('A\nB\nC');
  const editor = useBlockEditor(body, setBody);
  apiRef.current = { ...editor, getBody: () => body };
  return createElement('output', { 'data-body': body });
}

function mountHistoryHarness() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const apiRef = { current: null as HistoryApi | null };
  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(HistoryHarness, { apiRef }));
  });
  return { apiRef, host, root };
}

function paragraphBlocks(apiRef: { current: HistoryApi | null }): Block[] {
  return apiRef.current!.getBlocks();
}

describe('useBlockEditor history transactions', () => {
  afterEach(() => { document.body.innerHTML = ''; });

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
});
