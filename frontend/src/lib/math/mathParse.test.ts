import { describe, expect, it } from 'vitest';
import {
  isCurrencyLikeInlineMath,
  isValidInlineMath,
  protectMathInMarkdown,
  tokenizeMathInText,
} from './mathParse';

describe('mathParse', () => {
  describe('isCurrencyLikeInlineMath', () => {
    it('treats pure numbers as currency-like', () => {
      expect(isCurrencyLikeInlineMath('5')).toBe(true);
      expect(isCurrencyLikeInlineMath('10')).toBe(true);
      expect(isCurrencyLikeInlineMath('100')).toBe(true);
      expect(isCurrencyLikeInlineMath('1,234.56')).toBe(true);
    });

    it('does not treat LaTeX as currency-like', () => {
      expect(isCurrencyLikeInlineMath('a^2+b^2=c^2')).toBe(false);
      expect(isCurrencyLikeInlineMath('\\frac{1}{2}')).toBe(false);
    });
  });

  describe('isValidInlineMath', () => {
    it('rejects currency false positives', () => {
      expect(isValidInlineMath('5')).toBe(false);
      expect(isValidInlineMath('100')).toBe(false);
    });

    it('accepts scientific expressions', () => {
      expect(isValidInlineMath('a^2+b^2=c^2')).toBe(true);
      expect(isValidInlineMath('\\sin(x)')).toBe(true);
    });

    it('accepts simple variables', () => {
      expect(isValidInlineMath('x')).toBe(true);
      expect(isValidInlineMath('xy')).toBe(true);
    });

    it('rejects natural-language spans between dollars', () => {
      expect(isValidInlineMath('5 and ')).toBe(false);
    });
  });

  describe('tokenizeMathInText', () => {
    it('parses inline math', () => {
      const tokens = tokenizeMathInText('The theorem is $a^2+b^2=c^2$.');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ kind: 'text', value: 'The theorem is ' });
      expect(tokens[1]).toMatchObject({ kind: 'inline', expr: 'a^2+b^2=c^2' });
      expect(tokens[2]).toEqual({ kind: 'text', value: '.' });
    });

    it('parses display math', () => {
      const tokens = tokenizeMathInText('$$\\frac{1}{2}$$');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: 'display', expr: '\\frac{1}{2}' });
    });

    it('leaves currency amounts as plain text', () => {
      const tokens = tokenizeMathInText('Costs $5 and $10 and $100.');
      expect(tokens).toEqual([{ kind: 'text', value: 'Costs $5 and $10 and $100.' }]);
    });

    it('leaves $5 without closing delimiter as text', () => {
      const tokens = tokenizeMathInText('Price is $5 today');
      expect(tokens).toEqual([{ kind: 'text', value: 'Price is $5 today' }]);
    });

    it('handles escaped dollar signs', () => {
      const tokens = tokenizeMathInText('Literal \\$5 and math $x^2$');
      expect(tokens[0]).toEqual({ kind: 'text', value: 'Literal $5 and math ' });
      expect(tokens[1]).toMatchObject({ kind: 'inline', expr: 'x^2' });
    });

    it('prefers display math before inline', () => {
      const tokens = tokenizeMathInText('$$a+b$$ then $c$');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: 'display', expr: 'a+b' });
      expect(tokens[2]).toMatchObject({ kind: 'inline', expr: 'c' });
    });
  });

  describe('protectMathInMarkdown', () => {
    it('replaces math with placeholders preserving order', () => {
      const { text, mathBlocks } = protectMathInMarkdown('$x$ and $$y$$');
      expect(text).toBe('%%M0%% and %%M1%%');
      expect(mathBlocks).toEqual(['$x$', '$$y$$']);
    });
  });
});
