import { describe, expect, it } from 'vitest';
import { insertMathSnippetAt } from './mathSnippets';

describe('insertMathSnippetAt', () => {
  it('inserts at caret', () => {
    const result = insertMathSnippetAt('E=', 'mc^2', 2, 2);
    expect(result.value).toBe('E= mc^2');
    expect(result.selectionStart).toBe(3);
  });

  it('wraps selection with snippet', () => {
    const result = insertMathSnippetAt('x + y', '\\frac{a}{b}', 0, 1);
    expect(result.value).toBe('\\frac{a}{b} + y');
  });
});
