// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { shouldDeleteSelectedBlocks } from './blockKeyboard';
import * as selection from './features/block-editor/features/selection';
import * as editableDom from './editableDom';

function keyEvt(
  key: string,
  target: Partial<HTMLElement> | null,
): KeyboardEvent {
  return {
    key,
    target: target as HTMLElement | null,
  } as KeyboardEvent;
}

function editableTarget(blockId?: string): Partial<HTMLElement> {
  return {
    isContentEditable: true,
    closest: (selector: string) => (
      selector === '[data-drag-id]' && blockId
        ? { getAttribute: () => blockId } as unknown as Element
        : null
    ),
  };
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

  it('returns false when focus is a form control (e.g. tag rename input)', () => {
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', { tagName: 'INPUT', isContentEditable: false }),
      new Set(['a']),
    )).toBe(false);
  });

  it('preserves editing keys in a different editable block than the sole selection', () => {
    const spySel = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue(null);
    const spyText = vi.spyOn(editableDom, 'readBlockText').mockReturnValue('hello');
    const otherBlock = {
      isContentEditable: true,
      closest: (sel: string) => (sel === '[data-drag-id]' ? { getAttribute: () => 'other' } : null),
    };
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Delete', otherBlock),
      new Set(['selected']),
    )).toBe(false);
    spySel.mockRestore();
    spyText.mockRestore();
  });

  it('preserves editing keys in an unrelated editable without a block id', () => {
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Delete', editableTarget()),
      new Set(['selected']),
    )).toBe(false);
  });

  it('still deletes the selected block when a different non-editable shell has focus', () => {
    const otherBlockShell = {
      isContentEditable: false,
      closest: (sel: string) => (sel === '[data-drag-id]' ? { getAttribute: () => 'other' } : null),
    };
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Delete', otherBlockShell),
      new Set(['selected']),
    )).toBe(true);
  });

  it('returns false for non-empty editable block even when selected', () => {
    const spySel = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue(null);
    const spyText = vi.spyOn(editableDom, 'readBlockText').mockReturnValue('hello');
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', editableTarget('a')),
      new Set(['a']),
    )).toBe(false);
    spySel.mockRestore();
    spyText.mockRestore();
  });

  it('delegates single empty Backspace to EditableBlock merge (not block delete)', () => {
    const spySel = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue(null);
    const spyText = vi.spyOn(editableDom, 'readBlockText').mockReturnValue('');
    const spyCaret = vi.spyOn(selection, 'getCaretOffset').mockReturnValue(0);
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', editableTarget('a')),
      new Set(['a']),
    )).toBe(false);
    spySel.mockRestore();
    spyText.mockRestore();
    spyCaret.mockRestore();
  });

  it('returns true for Delete on empty editable block at caret start', () => {
    const spySel = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue(null);
    const spyText = vi.spyOn(editableDom, 'readBlockText').mockReturnValue('');
    const spyCaret = vi.spyOn(selection, 'getCaretOffset').mockReturnValue(0);
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Delete', editableTarget('a')),
      new Set(['a']),
    )).toBe(true);
    spySel.mockRestore();
    spyText.mockRestore();
    spyCaret.mockRestore();
  });

  it('returns false when a text range is selected inside editable', () => {
    const spy = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue({ start: 0, end: 3 });
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Delete', editableTarget('a')),
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

  it('does not delete non-empty block on second Backspace regression', () => {
    const spySel = vi.spyOn(selection, 'getSelectionOffsets').mockReturnValue(null);
    const spyText = vi.spyOn(editableDom, 'readBlockText').mockReturnValue('content remains');
    const spyCaret = vi.spyOn(selection, 'getCaretOffset').mockReturnValue(3);
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', editableTarget('block-1')),
      new Set(['block-1']),
    )).toBe(false);
    expect(shouldDeleteSelectedBlocks(
      keyEvt('Backspace', editableTarget('block-1')),
      new Set(['block-1']),
    )).toBe(false);
    spySel.mockRestore();
    spyText.mockRestore();
    spyCaret.mockRestore();
  });
});
