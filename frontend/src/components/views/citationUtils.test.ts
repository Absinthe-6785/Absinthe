import { describe, it, expect } from 'vitest';
import {
  parseCitationBody,
  serializeCitationBody,
  formatCitationLine,
  collectCitationsFromMarkdown,
} from './citationUtils';

describe('citationUtils', () => {
  it('parses and serializes citation fence body', () => {
    const body = 'Deep Work | Newport | 2016\npage: 42\nurl: https://example.com';
    const fields = parseCitationBody(body);
    expect(fields.title).toBe('Deep Work');
    expect(fields.author).toBe('Newport');
    expect(fields.year).toBe('2016');
    expect(fields.page).toBe('42');
    expect(fields.url).toBe('https://example.com');
    expect(serializeCitationBody(fields)).toBe(body);
  });

  it('formats compact bibliography line', () => {
    expect(formatCitationLine({ title: 'Title', author: 'Author', year: '2020', page: '10' }))
      .toBe('Author, 2020. Title, p. 10');
  });

  it('collects citations from markdown', () => {
    const md = '```citation\nPaper | Lee | 2024\npage: 3\n```';
    const cites = collectCitationsFromMarkdown(md);
    expect(cites).toHaveLength(1);
    expect(cites[0].author).toBe('Lee');
  });
});
