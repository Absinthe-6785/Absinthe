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

  it('includes toggle heading markers (#>, ##>!, etc.)', () => {
    const body = ['#> Toggle section', '##>! Collapsed'].join('\n');
    const toc = extractTOC(body);
    expect(toc).toHaveLength(2);
    expect(toc[0]).toMatchObject({ level: 1, text: 'Toggle section', isToggleHeading: true });
    expect(toc[1]).toMatchObject({ level: 2, text: 'Collapsed', collapsed: true, isToggleHeading: true });
  });
});
