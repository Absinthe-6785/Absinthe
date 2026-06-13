import type { NoteBase } from '../../../noteUtils';
import type { OutgoingReference, PageReference } from '../backlinks';
import { getPageReferences } from '../backlinks';
import { buildBacklinkIndex } from '../backlinks/buildBacklinkIndex';

export interface FootnoteDefinition {
  id: string;
  content: string;
}

export interface NoteReferenceSummary {
  incoming: PageReference[];
  outgoing: OutgoingReference[];
  footnotes: FootnoteDefinition[];
  /** Inline [^id] markers excluding definition lines */
  inlineFootnoteRefs: string[];
  wikiLinkCount: number;
  citationCount: number;
}

const FOOTNOTE_DEF_RE = /^\[\^([^\]]+)\]:\s*(.+)$/;
const INLINE_FOOTNOTE_RE = /\[\^([^\]]+)\]/g;

/** Extract footnote definitions from markdown body lines. */
export function extractFootnoteDefinitions(body: string): FootnoteDefinition[] {
  const out: FootnoteDefinition[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(FOOTNOTE_DEF_RE);
    if (m) out.push({ id: m[1].trim(), content: m[2].trim() });
  }
  return out;
}

/** Collect inline footnote reference ids from body (excludes definition lines). */
export function extractInlineFootnoteRefs(body: string): string[] {
  const ids = new Set<string>();
  for (const line of body.split('\n')) {
    if (FOOTNOTE_DEF_RE.test(line)) continue;
    let m: RegExpExecArray | null;
    INLINE_FOOTNOTE_RE.lastIndex = 0;
    while ((m = INLINE_FOOTNOTE_RE.exec(line))) {
      ids.add(m[1].trim());
    }
  }
  return [...ids];
}

/** Unified read-only reference summary for a note. */
export function extractNoteReferenceSummary(
  note: NoteBase,
  allNotes: readonly NoteBase[],
): NoteReferenceSummary {
  const body = note.body ?? '';
  const index = buildBacklinkIndex(allNotes);
  const { incoming, outgoing } = getPageReferences(index, note, allNotes);
  const footnotes = extractFootnoteDefinitions(body);
  const inlineFootnoteRefs = extractInlineFootnoteRefs(body);
  const wikiLinkCount = outgoing.length;
  const citationCount = wikiLinkCount + inlineFootnoteRefs.length + footnotes.length;

  return {
    incoming,
    outgoing,
    footnotes,
    inlineFootnoteRefs,
    wikiLinkCount,
    citationCount,
  };
}
