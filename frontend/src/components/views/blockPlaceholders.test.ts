import { describe, expect, it } from 'vitest';
import { blockPlaceholder } from './blockPlaceholders';

describe('blockPlaceholder', () => {
  it('returns slash hint for paragraph', () => {
    expect(blockPlaceholder('paragraph')).toContain('/');
    expect(blockPlaceholder('paragraph')).toContain('드래그');
  });

  it('returns short label for headings', () => {
    expect(blockPlaceholder('heading1')).toBe('제목 1');
  });
});
