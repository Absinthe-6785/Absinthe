// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  blockIdAtRow,
  focusNearestEditable,
  focusOffsetForBlock,
  isBlockEmptyForFocus,
  isFirstEmptyRootParagraph,
  listRootBlockRows,
  resolveDocumentFocus,
  shouldHandleDocumentFocus,
} from './documentFocus';
import { makeBlock } from './blockUtils';

function rect(top: number, height: number): DOMRect {
  return {
    left: 0, top, width: 400, height, right: 400, bottom: top + height, x: 0, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('documentFocus', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('isBlockEmptyForFocus — empty paragraph vs content', () => {
    expect(isBlockEmptyForFocus(makeBlock('paragraph', { content: '' }))).toBe(true);
    expect(isBlockEmptyForFocus(makeBlock('paragraph', { content: 'Hi' }))).toBe(false);
    expect(isBlockEmptyForFocus(makeBlock('toggle', { content: 'T' }))).toBe(false);
  });

  it('focusOffsetForBlock — empty start, non-empty end', () => {
    expect(focusOffsetForBlock(makeBlock('paragraph', { content: '' }))).toBe('start');
    expect(focusOffsetForBlock(makeBlock('paragraph', { content: 'text' }))).toBe('end');
  });

  it('isFirstEmptyRootParagraph', () => {
    const empty = makeBlock('paragraph', { id: 'p1', content: '' });
    const filled = makeBlock('paragraph', { id: 'p2', content: 'x' });
    expect(isFirstEmptyRootParagraph([empty, filled], 'p1')).toBe(true);
    expect(isFirstEmptyRootParagraph([empty, filled], 'p2')).toBe(false);
  });

  it('listRootBlockRows reads data-drag-id rects', () => {
    const a = document.createElement('div');
    a.setAttribute('data-drag-id', 'a');
    a.getBoundingClientRect = () => rect(0, 40);
    const b = document.createElement('div');
    b.setAttribute('data-drag-id', 'b');
    b.getBoundingClientRect = () => rect(50, 40);
    root.append(a, b);

    expect(listRootBlockRows(root, ['a', 'b'])).toEqual([
      { blockId: 'a', top: 0, bottom: 40 },
      { blockId: 'b', top: 50, bottom: 90 },
    ]);
  });

  it('blockIdAtRow — nearest row and belowAll', () => {
    const a = document.createElement('div');
    a.setAttribute('data-drag-id', 'a');
    a.getBoundingClientRect = () => rect(0, 40);
    const b = document.createElement('div');
    b.setAttribute('data-drag-id', 'b');
    b.getBoundingClientRect = () => rect(50, 40);
    root.append(a, b);

    expect(blockIdAtRow(20, root, ['a', 'b'])).toEqual({ blockId: 'a', belowAll: false });
    expect(blockIdAtRow(70, root, ['a', 'b'])).toEqual({ blockId: 'b', belowAll: false });
    expect(blockIdAtRow(120, root, ['a', 'b'])).toEqual({ blockId: null, belowAll: true });
  });

  it('resolveDocumentFocus — below last empty paragraph focuses start', () => {
    const empty = makeBlock('paragraph', { id: 'last', content: '' });
    const el = document.createElement('div');
    el.setAttribute('data-drag-id', 'last');
    el.getBoundingClientRect = () => rect(0, 40);
    root.append(el);

    const action = resolveDocumentFocus(100, [empty], root);
    expect(action).toEqual({ kind: 'focus', blockId: 'last', offset: 'start' });
  });

  it('resolveDocumentFocus — below last non-empty appends paragraph', () => {
    const filled = makeBlock('paragraph', { id: 'last', content: 'Done' });
    const el = document.createElement('div');
    el.setAttribute('data-drag-id', 'last');
    el.getBoundingClientRect = () => rect(0, 40);
    root.append(el);

    const action = resolveDocumentFocus(100, [filled], root);
    expect(action.kind).toBe('append');
    if (action.kind === 'append') {
      expect(action.block.type).toBe('paragraph');
      expect(action.block.content).toBe('');
    }
  });

  it('focusNearestEditable — click near block row uses end for non-empty', () => {
    const block = makeBlock('paragraph', { id: 'p1', content: 'Hello' });
    const el = document.createElement('div');
    el.setAttribute('data-drag-id', 'p1');
    el.getBoundingClientRect = () => rect(0, 40);
    root.append(el);

    expect(focusNearestEditable(10, [block], root)).toEqual({
      kind: 'focus', blockId: 'p1', offset: 'end',
    });
  });

  it('shouldHandleDocumentFocus skips gutter and editable', () => {
    const gutter = document.createElement('div');
    gutter.className = 'be-gutter-strip';
    const editable = document.createElement('span');
    editable.className = 'be-editable';
    editable.setAttribute('contenteditable', 'true');
    const chrome = document.createElement('div');
    chrome.className = 'be-document-bottom-strip';

    expect(shouldHandleDocumentFocus(gutter)).toBe(false);
    expect(shouldHandleDocumentFocus(editable)).toBe(false);
    expect(shouldHandleDocumentFocus(chrome)).toBe(true);
  });
});
