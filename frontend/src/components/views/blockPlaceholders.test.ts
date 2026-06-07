import { describe, expect, it } from 'vitest';
import { blockPlaceholder } from './blockPlaceholders';

describe('blockPlaceholder', () => {
  it('returns slash hint for paragraph', () => {
    expect(blockPlaceholder('paragraph')).toContain('/');
  });

  it('returns short label for headings', () => {
    expect(blockPlaceholder('heading1')).toBe('제목 1');
  });
});
