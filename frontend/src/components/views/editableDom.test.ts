// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  domToPlainText,
  getCaretOffset,
  setCaretOffset,
  insertNewlineAtCaret,
  deleteBeforeCaret,
  nodePlainLength,
} from './editableDom';

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

  it('does not leave last char on wrong line after newline insert', () => {
    const text = 'hello';
    const { text: next, caret } = insertNewlineAtCaret(mount(''), text, 5);
    expect(next).toBe('hello\n');
    expect(caret).toBe(6);
    el = mount('hello\n'); // pre-wrap text node (preferred DOM)
    selectAt(el, caret);
    expect(getCaretOffset(el)).toBe(6);
    expect(domToPlainText(el)).toBe('hello'); // trailing \n stripped like getElText
  });
});

describe('insertNewlineAtCaret / deleteBeforeCaret', () => {
  it('inserts at end without stealing last character', () => {
    const { text, caret } = insertNewlineAtCaret(document.createElement('div'), 'abc', 3);
    expect(text).toBe('abc\n');
    expect(caret).toBe(4);
  });

  it('inserts in middle', () => {
    const { text, caret } = insertNewlineAtCaret(document.createElement('div'), 'abcdef', 3);
    expect(text).toBe('abc\ndef');
    expect(caret).toBe(4);
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
