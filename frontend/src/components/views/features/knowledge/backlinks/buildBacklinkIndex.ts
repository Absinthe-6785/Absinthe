import type { NoteBase } from '../../../noteUtils';
import {
  extractLinks,
  findNoteByTitle,
  normalizeWikiTitle,
} from '../../../noteUtils';

/** A note that links to another page via [[...]] */
export interface PageReference {
  noteId: string;
  noteTitle: string;
}

/** An outgoing wiki link from a page */
export interface OutgoingReference {
  /** Title as written inside [[...]] */
  title: string;
  /** Resolved target note id when the link matches an existing page */
  targetNoteId?: string;
}

/** Reverse-link index built from all notes */
export interface BacklinkIndex {
  /** Normalized target title → notes that link to it */
  incomingByTitle: ReadonlyMap<string, readonly PageReference[]>;
  /** Source note id → outgoing link titles (deduplicated, document order) */
  outgoingByNoteId: ReadonlyMap<string, readonly string[]>;
}

/**
 * buildBacklinkIndex(notes)
 *
 * Scans all non-deleted notes and builds:
 * - reverse lookup: which pages link to each [[title]]
 * - forward lookup: which [[titles]] each page links to
 */
export function buildBacklinkIndex(notes: NoteBase[]): BacklinkIndex {
  const incomingMap = new Map<string, Map<string, PageReference>>();
  const outgoingMap = new Map<string, string[]>();

  for (const note of notes) {
    if (note.deletedAt) continue;

    const outgoing = extractLinks(note.body ?? '');
    outgoingMap.set(note.id, outgoing);

    const ref: PageReference = { noteId: note.id, noteTitle: note.title ?? '' };
    for (const title of outgoing) {
      const key = normalizeWikiTitle(title);
      if (!key) continue;
      let bucket = incomingMap.get(key);
      if (!bucket) {
        bucket = new Map();
        incomingMap.set(key, bucket);
      }
      bucket.set(note.id, ref);
    }
  }

  const incomingByTitle = new Map<string, readonly PageReference[]>();
  for (const [key, bucket] of incomingMap) {
    incomingByTitle.set(key, [...bucket.values()]);
  }

  return {
    incomingByTitle,
    outgoingByNoteId: outgoingMap,
  };
}

export interface IncomingLinksOptions {
  /** Exclude self-references when viewing a page's own backlinks */
  excludeNoteId?: string;
}

/** Reverse link lookup — pages that link to targetTitle */
export function getIncomingLinks(
  index: BacklinkIndex,
  targetTitle: string,
  opts: IncomingLinksOptions = {},
): PageReference[] {
  const key = normalizeWikiTitle(targetTitle);
  if (!key) return [];

  const refs = index.incomingByTitle.get(key) ?? [];
  if (!opts.excludeNoteId) return [...refs];
  return refs.filter(r => r.noteId !== opts.excludeNoteId);
}

/** Number of pages linking to targetTitle */
export function getBacklinkCount(
  index: BacklinkIndex,
  targetTitle: string,
  excludeNoteId?: string,
): number {
  return getIncomingLinks(index, targetTitle, { excludeNoteId }).length;
}

/** Outgoing [[...]] titles for a note */
export function getOutgoingLinks(
  index: BacklinkIndex,
  noteId: string,
): string[] {
  return [...(index.outgoingByNoteId.get(noteId) ?? [])];
}

/** Incoming and outgoing references for a single page */
export function getPageReferences(
  index: BacklinkIndex,
  note: NoteBase,
  allNotes: NoteBase[],
): { incoming: PageReference[]; outgoing: OutgoingReference[] } {
  const incoming = getIncomingLinks(index, note.title ?? '', {
    excludeNoteId: note.id,
  });

  const outgoing = getOutgoingLinks(index, note.id).map(title => {
    const target = findNoteByTitle(title, allNotes);
    return target
      ? { title, targetNoteId: target.id }
      : { title };
  });

  return { incoming, outgoing };
}

/** Resolve navigation target for a referring page */
export function resolveBacklinkNavigation(ref: PageReference): string {
  return ref.noteId;
}
