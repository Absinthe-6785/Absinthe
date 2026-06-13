import type { NoteBase } from './noteUtils';
import type { CitationEntry, CitationFields } from './citationUtils';
import { collectCitationsFromMarkdown } from './citationUtils';

/** Generate a stable BibTeX cite key from citation fields. */
export function citationBibTeXKey(fields: CitationFields, blockId?: string): string {
  const authorPart = (fields.author || 'unknown')
    .split(/\s+/)[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase() || 'unknown';
  const yearPart = (fields.year || 'nd').replace(/[^0-9]/g, '') || 'nd';
  const suffix = blockId ? blockId.slice(-4) : '';
  return `${authorPart}${yearPart}${suffix}`;
}

/** APA-style reference line (export only — simplified author string). */
export function formatCitationAPA(fields: CitationFields): string {
  const author = fields.author.trim();
  const year = fields.year.trim() || 'n.d.';
  const title = fields.title.trim() || 'Untitled';
  let line = author ? `${author} (${year}). ${title}.` : `${title}. (${year}).`;
  if (fields.page?.trim()) line += ` pp. ${fields.page.trim()}`;
  if (fields.url?.trim()) line += ` ${fields.url.trim()}`;
  return line;
}

/** BibTeX @misc entry (export only). */
export function formatCitationBibTeX(fields: CitationFields, key?: string): string {
  const citeKey = key ?? citationBibTeXKey(fields);
  const lines = [`@misc{${citeKey},`];
  if (fields.author.trim()) lines.push(`  author = {${fields.author.trim()}},`);
  if (fields.title.trim()) lines.push(`  title = {${fields.title.trim()}},`);
  if (fields.year.trim()) lines.push(`  year = {${fields.year.trim()}},`);
  if (fields.page?.trim()) lines.push(`  pages = {${fields.page.trim()}},`);
  if (fields.url?.trim()) lines.push(`  url = {${fields.url.trim()}},`);
  lines.push('}');
  return lines.join('\n');
}

export function exportCitationsAsAPA(citations: readonly CitationFields[]): string {
  return citations.map(formatCitationAPA).join('\n\n');
}

export function exportCitationsAsBibTeX(citations: readonly CitationEntry[]): string {
  return citations
    .map(cite => formatCitationBibTeX(cite, citationBibTeXKey(cite, cite.blockId)))
    .join('\n\n');
}

/** Collect all citation blocks from active notes in document order per note. */
export function collectAllCitationsFromNotes(notes: readonly NoteBase[]): CitationEntry[] {
  const out: CitationEntry[] = [];
  for (const note of notes) {
    if (note.deletedAt) continue;
    out.push(...collectCitationsFromMarkdown(note.body ?? ''));
  }
  return out;
}
