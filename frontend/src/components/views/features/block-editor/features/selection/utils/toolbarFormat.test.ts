// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { deriveToolbarFormats, EMPTY_FORMATS } from './toolbarFormat';
import type { BlockType } from '../../../../../blockUtils';

describe('toolbarFormat', () => {
  it('EMPTY_FORMATS defaults', () => {
    expect(EMPTY_FORMATS.bold).toBe(false);
    expect(EMPTY_FORMATS.headingLevel).toBeNull();
    expect(EMPTY_FORMATS.isToggleHeading).toBe(false);
  });

  it('deriveToolbarFormats returns empty when block mismatch', () => {
    const host = document.createElement('div');
    host.textContent = 'hello';
    expect(deriveToolbarFormats(host, 'a', 'b', () => 'paragraph')).toEqual(EMPTY_FORMATS);
  });

  it('deriveToolbarFormats detects bold selection', () => {
    const host = document.createElement('div');
    host.textContent = '**bold**';
    const getType = (id: string): BlockType | undefined => id === 'blk' ? 'paragraph' : undefined;
    const range = document.createRange();
    range.setStart(host.firstChild!, 2);
    range.setEnd(host.firstChild!, 6);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    const formats = deriveToolbarFormats(host, 'blk', 'blk', getType);
    expect(formats.bold).toBe(true);
    sel.removeAllRanges();
  });

  it('deriveToolbarFormats detects toggle heading block', () => {
    const host = document.createElement('div');
    host.textContent = 'Section';
    const getType = (id: string): BlockType | undefined => id === 'blk' ? 'toggleHeading2' : undefined;
    const range = document.createRange();
    range.selectNodeContents(host);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    const formats = deriveToolbarFormats(host, 'blk', 'blk', getType);
    expect(formats.headingLevel).toBe(2);
    expect(formats.isToggleHeading).toBe(true);
    sel.removeAllRanges();
  });
});
