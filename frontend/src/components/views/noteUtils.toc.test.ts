import { describe, expect, it } from 'vitest';
import { extractTOC } from './noteUtils';

describe('extractTOC', () => {
  it('includes h1–h4 markdown headings', () => {
    const body = [
      '# One',
      '## Two',
      '### Three',
      '#### Four',
    ].join('\n');

    const toc = extractTOC(body);
    expect(toc.map(t => t.level)).toEqual([1, 2, 3, 4]);
    expect(toc[3].text).toBe('Four');
  });
});
