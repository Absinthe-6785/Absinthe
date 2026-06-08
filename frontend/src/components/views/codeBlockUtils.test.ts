import { describe, expect, it } from 'vitest';
import { CODE_TAB_INSERT, insertTabAt, shouldSyncCodeDraft } from './codeBlockUtils';

describe('codeBlockUtils', () => {
  it('insertTabAt inserts two spaces at caret', () => {
    const { next, caret } = insertTabAt('ab', 1, 1);
    expect(next).toBe(`a${CODE_TAB_INSERT}b`);
    expect(caret).toBe(3);
  });

  it('insertTabAt replaces selection', () => {
    const { next, caret } = insertTabAt('hello', 1, 3);
    expect(next).toBe(`h${CODE_TAB_INSERT}lo`);
    expect(caret).toBe(3);
  });

  it('shouldSyncCodeDraft is false when textarea is active element', () => {
    const ta = {} as HTMLTextAreaElement;
    expect(shouldSyncCodeDraft('new', ta, ta)).toBe(false);
  });

  it('shouldSyncCodeDraft is true when another element is active', () => {
    const ta = {} as HTMLTextAreaElement;
    const other = {} as HTMLDivElement;
    expect(shouldSyncCodeDraft('new', other, ta)).toBe(true);
  });
});
