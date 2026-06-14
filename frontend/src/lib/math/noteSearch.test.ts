import { describe, expect, it } from 'vitest';
import { noteMatchesPlainSearch } from './noteSearch';

describe('noteSearch', () => {
  it('finds notes by LaTeX source in body', () => {
    const body = 'The formula uses $$\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$';
    expect(noteMatchesPlainSearch(body, 'b^2-4ac')).toBe(true);
    expect(noteMatchesPlainSearch(body, 'discriminant')).toBe(false);
  });

  it('finds inline math source', () => {
    const body = 'Pythagorean: $a^2+b^2=c^2$';
    expect(noteMatchesPlainSearch(body, 'a^2+b^2')).toBe(true);
  });

  it('does not confuse currency with math search', () => {
    const body = 'Budget is $100 for supplies.';
    expect(noteMatchesPlainSearch(body, '100')).toBe(true);
    expect(noteMatchesPlainSearch(body, 'a^2')).toBe(false);
  });
});
