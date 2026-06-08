import { describe, expect, it } from 'vitest';
import { shouldDeleteSelectedBlocks } from './blockKeyboard';

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

  it('returns false for Backspace in editable (merge path)', () => {
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', { isContentEditable: true }),
      new Set(['a']),
    )).toBe(false);
  });

  it('returns true for Backspace when shell focused (e.g. divider)', () => {
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', { isContentEditable: false }),
      new Set(['a']),
    )).toBe(true);
  });
});
