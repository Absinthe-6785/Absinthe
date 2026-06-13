import { describe, it, expect } from 'vitest';
import {
  citationBibTeXKey,
  exportCitationsAsAPA,
  exportCitationsAsBibTeX,
  formatCitationAPA,
  formatCitationBibTeX,
} from './citationExport';
import type { CitationEntry } from './citationUtils';

describe('citationExport', () => {
  const fields = {
    title: 'Deep Work',
    author: 'Newport, Cal',
    year: '2016',
    page: '42',
    url: 'https://example.com/book',
  };

  it('formats APA reference', () => {
    expect(formatCitationAPA(fields)).toContain('Newport, Cal (2016). Deep Work.');
    expect(formatCitationAPA(fields)).toContain('pp. 42');
    expect(formatCitationAPA(fields)).toContain('https://example.com/book');
  });

  it('formats BibTeX entry', () => {
    const bib = formatCitationBibTeX(fields, 'newport2016');
    expect(bib).toContain('@misc{newport2016,');
    expect(bib).toContain('author = {Newport, Cal}');
    expect(bib).toContain('year = {2016}');
  });

  it('exports multiple citations', () => {
    const cites: CitationEntry[] = [
      { blockId: 'a', ...fields },
      { blockId: 'b', title: 'Other', author: 'Lee', year: '2020' },
    ];
    expect(exportCitationsAsAPA(cites).split('\n\n')).toHaveLength(2);
    expect(exportCitationsAsBibTeX(cites)).toContain(citationBibTeXKey(fields, 'a'));
  });
});
