import type { Block } from './blockUtils';
import { markdownToBlocks } from './blockUtils';

export interface CitationFields {
  title: string;
  author: string;
  year: string;
  page?: string;
  url?: string;
}

export interface CitationEntry extends CitationFields {
  blockId: string;
}

const PAGE_PREFIX = /^page:\s*(.+)$/i;
const URL_PREFIX = /^url:\s*(.+)$/i;

/** Parse ```citation fence body into structured fields. */
export function parseCitationBody(body: string): CitationFields {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  const first = lines[0] ?? '';
  const parts = first.split('|').map(p => p.trim());
  const fields: CitationFields = {
    title: parts[0] ?? '',
    author: parts[1] ?? '',
    year: parts[2] ?? '',
  };
  for (const line of lines.slice(1)) {
    const pageMatch = line.match(PAGE_PREFIX);
    if (pageMatch) {
      fields.page = pageMatch[1].trim();
      continue;
    }
    const urlMatch = line.match(URL_PREFIX);
    if (urlMatch) fields.url = urlMatch[1].trim();
  }
  return fields;
}

/** Serialize citation fields to fence body text. */
export function serializeCitationBody(fields: CitationFields): string {
  const lines = [`${fields.title} | ${fields.author} | ${fields.year}`];
  if (fields.page?.trim()) lines.push(`page: ${fields.page.trim()}`);
  if (fields.url?.trim()) lines.push(`url: ${fields.url.trim()}`);
  return lines.join('\n');
}

export function blockToCitationFields(block: Block): CitationFields {
  return {
    title: block.citationTitle ?? '',
    author: block.citationAuthor ?? '',
    year: block.citationYear ?? '',
    page: block.citationPage,
    url: block.citationUrl,
  };
}

export function citationFieldsToBlockPatch(fields: CitationFields): Partial<Block> {
  return {
    citationTitle: fields.title,
    citationAuthor: fields.author,
    citationYear: fields.year,
    citationPage: fields.page?.trim() || undefined,
    citationUrl: fields.url?.trim() || undefined,
  };
}

/** Compact display line for bibliography / inline preview. */
export function formatCitationLine(fields: CitationFields): string {
  const main = [fields.author, fields.year].filter(Boolean).join(', ');
  const title = fields.title.trim();
  let line = main ? `${main}. ${title}` : title;
  if (fields.page?.trim()) line += `, p. ${fields.page.trim()}`;
  return line.trim() || 'Citation';
}

export function formatCitationCompact(fields: CitationFields): string {
  const bits = [fields.author, `(${fields.year})`, fields.title].filter(Boolean);
  return bits.join(' · ') || 'Citation';
}

/** Walk block tree and collect citation blocks in document order. */
export function collectCitationBlocks(blocks: Block[]): CitationEntry[] {
  const out: CitationEntry[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.type === 'citation') {
        out.push({ blockId: b.id, ...blockToCitationFields(b) });
      }
      if (b.children.length) walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

/** Parse markdown body and collect citations. */
export function collectCitationsFromMarkdown(body: string): CitationEntry[] {
  return collectCitationBlocks(markdownToBlocks(body));
}
