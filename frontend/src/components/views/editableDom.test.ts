// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  domToPlainText,
  readBlockText,
  getCaretOffset,
  setCaretOffset,
  deleteBeforeCaret,
  nodePlainLength,
} from './editableDom';
import { insertNewlineInBlock } from './blockContent';

function mount(html: string, style?: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  Object.assign(el.style, { whiteSpace: 'pre-wrap' }, style);
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

function selectAt(el: HTMLElement, offset: number) {
  setCaretOffset(el, offset);
}

describe('domToPlainText', () => {
  it('reads text nodes with embedded newlines', () => {
    const el = mount('hello\nworld');
    expect(domToPlainText(el)).toBe('hello\nworld');
  });

  it('treats br as newline', () => {
    const el = mount('hello<br>world');
    expect(domToPlainText(el)).toBe('hello\nworld');
  });

  it('handles multiple br lines', () => {
    const el = mount('a<br><br><br>b');
    expect(domToPlainText(el)).toBe('a\n\n\nb');
  });
});

describe('caret offsets with newlines', () => {
  let el: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('roundtrips caret through text-node newlines', () => {
    el = mount('hello\nworld');
    for (const pos of [0, 5, 6, 7, 11]) {
      selectAt(el, pos);
      expect(getCaretOffset(el)).toBe(pos);
    }
  });

  it('roundtrips caret through br elements', () => {
    el = mount('hello<br>world');
    for (const pos of [0, 5, 6, 7, 11]) {
      selectAt(el, pos);
      expect(getCaretOffset(el)).toBe(pos);
    }
  });

  it('roundtrips through multiple blank lines', () => {
    el = mount('line<br><br><br>end');
    const len = domToPlainText(el).length;
    for (const pos of [0, 4, 5, 6, 7, 8, 11]) {
      if (pos > len) continue;
      selectAt(el, pos);
      expect(getCaretOffset(el)).toBe(pos);
    }
  });

  it('preserves trailing newline in block text', () => {
    el = mount('hello\n');
    expect(domToPlainText(el)).toBe('hello\n');
    selectAt(el, 6);
    expect(getCaretOffset(el)).toBe(6);
  });
});

describe('insertNewlineInBlock / deleteBeforeCaret', () => {
  it('inserts at end without stealing last character', () => {
    const { content, caret } = insertNewlineInBlock('abc', 3);
    expect(content).toBe('abc\n');
    expect(caret).toBe(4);
  });

  it('inserts in middle', () => {
    const { content, caret } = insertNewlineInBlock('abcdef', 3);
    expect(content).toBe('abc\ndef');
    expect(caret).toBe(4);
  });

  it('readBlockText keeps intentional trailing newline', () => {
    const el = mount('hello\n');
    expect(readBlockText(el)).toBe('hello\n');
  });

  it('deletes newlines one at a time from the end', () => {
    let text = 'a\n\n\nb';
    let caret = 4; // after second newline
    const d1 = deleteBeforeCaret(text, caret);
    expect(d1).toEqual({ text: 'a\n\nb', caret: 3 });
    text = d1!.text;
    caret = d1!.caret;
    const d2 = deleteBeforeCaret(text, caret);
    expect(d2).toEqual({ text: 'a\nb', caret: 2 });
    text = d2!.text;
    caret = d2!.caret;
    const d3 = deleteBeforeCaret(text, caret);
    expect(d3).toEqual({ text: 'ab', caret: 1 });
  });

  it('returns null at offset 0', () => {
    expect(deleteBeforeCaret('hello', 0)).toBeNull();
  });
});

describe('nodePlainLength', () => {
  it('counts br as one', () => {
    const el = mount('x<br>y');
    expect(nodePlainLength(el)).toBe(3);
  });
});
