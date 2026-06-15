import { describe, it, expect } from 'vitest';
import { normalizeProteinCategory } from './proteinConstants';

describe('normalizeProteinCategory', () => {
  it('maps Korean legacy category to Other', () => {
    expect(normalizeProteinCategory('기타')).toBe('Other');
  });

  it('maps emoji-prefixed categories', () => {
    expect(normalizeProteinCategory('🐟 Fish')).toBe('Fish');
  });

  it('preserves exact English keys', () => {
    expect(normalizeProteinCategory('White Fish')).toBe('Other');
    expect(normalizeProteinCategory('Fish')).toBe('Fish');
  });
});
