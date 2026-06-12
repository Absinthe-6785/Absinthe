// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { shouldDeleteSelectedBlocks } from './blockKeyboard';
import * as selection from './features/block-editor/features/selection';

function keyEvt(
  key: string,
  target: Partial<HTMLElement> | null,
): KeyboardEvent {
  return {
    key,
    target: target as HTMLElement | null,
  } as KeyboardEvent;
}

describe('shouldDeleteSelectedBlocks', () => {
  it('returns false when nothing selected', () => {
    expect(shouldDeleteSelectedBlocks(keyEvt('Delete', {}), new Set())).toBe(false);
  });

  it('returns true for multi-select', () => {
    expect(shouldDeleteSelectedBlocks(keyEvt('Delete', {}), new Set(['a', 'b']))).toBe(true);
  });

  it('returns true when focus is not contentEditable', () => {
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Delete', { isContentEditable: false }),
      new Set(['a']),
    )).toBe(true);
  });

  it('returns true for Delete in editable when block is selected and no text range', () => {
    const spy = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue(null);
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Delete', { isContentEditable: true }),
      new Set(['a']),
    )).toBe(true);
    spy.mockRestore();
  });

  it('returns true for Backspace in editable when block is selected and no text range', () => {
    const spy = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue(null);
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', { isContentEditable: true }),
      new Set(['a']),
    )).toBe(true);
    spy.mockRestore();
  });

  it('returns false when a text range is selected inside editable', () => {
    const spy = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue({ start: 0, end: 3 });
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Delete', { isContentEditable: true }),
      new Set(['a']),
    )).toBe(false);
    spy.mockRestore();
  });

  it('returns true for Backspace when shell focused (e.g. divider)', () => {
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', { isContentEditable: false }),
      new Set(['a']),
    )).toBe(true);
  });
});
