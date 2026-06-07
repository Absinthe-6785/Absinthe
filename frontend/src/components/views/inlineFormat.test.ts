import { describe, expect, it } from 'vitest';
import { selectionHasFormat } from './inlineFormat';

describe('selectionHasFormat', () => {
  it('detects bold markers outside selection', () => {
    expect(selectionHasFormat('**hello**', 2, 7, '**', '**')).toBe(true);
    expect(selectionHasFormat('hello', 0, 5, '**', '**')).toBe(false);
  });

  it('detects italic without matching bold markers', () => {
    expect(selectionHasFormat('*hello*', 1, 6, '*', '*')).toBe(true);
    expect(selectionHasFormat('**hello**', 2, 7, '*', '*')).toBe(false);
  });
});
