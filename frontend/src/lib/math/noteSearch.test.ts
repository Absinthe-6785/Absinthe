import { describe, expect, it } from 'vitest';
import { noteMatchesPlainSearch, noteMatchesSearch } from './noteSearch';

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

  it('finds matrix LaTeX in body', () => {
    const body = '$$\n\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n$$';
    expect(noteMatchesPlainSearch(body, 'pmatrix')).toBe(true);
  });

  it('does not confuse currency with math search', () => {
    const body = 'Budget is $100 for supplies.';
    expect(noteMatchesPlainSearch(body, '100')).toBe(true);
    expect(noteMatchesPlainSearch(body, 'a^2')).toBe(false);
  });

  it('noteMatchesSearch prefers body over title', () => {
    const note = { title: 'Calculus intro', body: 'We study the Fourier transform today.' };
    expect(noteMatchesSearch(note, 'Fourier')).toBe(true);
    expect(noteMatchesSearch(note, 'Calculus')).toBe(true);
    expect(noteMatchesSearch(note, 'transform')).toBe(true);
    expect(noteMatchesSearch(note, 'nonexistent')).toBe(false);
  });

  it('noteMatchesSearch matches tags in body', () => {
    const note = { title: 'Notes', body: 'Some content #analysis #math' };
    expect(noteMatchesSearch(note, 'analysis')).toBe(true);
    expect(noteMatchesSearch(note, 'physics')).toBe(false);
  });

  it('noteMatchesSearch returns true for empty query', () => {
    expect(noteMatchesSearch({ title: 'A', body: 'B' }, '')).toBe(true);
    expect(noteMatchesSearch({ title: 'A', body: 'B' }, '   ')).toBe(true);
  });
});
