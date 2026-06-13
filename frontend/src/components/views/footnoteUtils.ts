import type { Block } from './blockUtils';

export function normalizeFootnoteId(raw: string): string {
  return raw.trim();
}

export function footnoteAnchorId(id: string): string {
  return `fn-${normalizeFootnoteId(id).replace(/[^\w-]/g, '-')}`;
}

/** Collect footnote definition blocks in document order (includes nested). */
export function collectFootnoteBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.type === 'footnote') out.push(b);
      if (b.children.length) walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

export function compareFootnoteIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}
