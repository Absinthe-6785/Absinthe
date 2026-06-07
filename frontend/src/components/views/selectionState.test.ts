// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  dispatchFocusCommand,
  registerFocusHandler,
  saveSelectionRange,
  restoreSelectionRange,
  type FocusCmd,
} from './selectionState';

describe('selectionState', () => {
  it('registerFocusHandler dispatches commands', () => {
    const calls: FocusCmd[] = [];
    const unregister = registerFocusHandler('b1', cmd => { calls.push(cmd); });
    dispatchFocusCommand({ blockId: 'b1', offset: 'start' });
    expect(calls).toEqual([{ blockId: 'b1', offset: 'start' }]);
    unregister();
    dispatchFocusCommand({ blockId: 'b1', offset: 'end' });
    expect(calls).toHaveLength(1);
  });

  it('saveSelectionRange returns null for collapsed selection', () => {
    const el = document.createElement('div');
    el.textContent = 'hello';
    document.body.appendChild(el);
    const range = document.createRange();
    range.setStart(el.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    expect(saveSelectionRange()).toBeNull();
    sel.removeAllRanges();
    document.body.removeChild(el);
  });

  it('save and restore expanded selection', () => {
    const el = document.createElement('div');
    el.textContent = 'hello world';
    document.body.appendChild(el);
    const range = document.createRange();
    range.setStart(el.firstChild!, 0);
    range.setEnd(el.firstChild!, 5);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    const saved = saveSelectionRange();
    expect(saved).not.toBeNull();
    sel.removeAllRanges();
    expect(restoreSelectionRange(saved)).toBe(true);
    expect(sel.toString()).toBe('hello');
    sel.removeAllRanges();
    document.body.removeChild(el);
  });
});
