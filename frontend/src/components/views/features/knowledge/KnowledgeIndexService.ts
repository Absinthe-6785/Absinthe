import type { NoteBase } from '../../noteUtils';
import { extractLinks, findNoteByTitle, normalizeWikiTitle } from '../../noteUtils';
import type { IncomingLinksOptions, OutgoingReference, PageReference } from './backlinks';

/**
 * KnowledgeIndexService — shared indexing layer for knowledge features.
 *
 * Phase 1: wiki link backlinks (incoming / outgoing).
 * Future: tags, properties, mentions, graph edges.
 */
export class KnowledgeIndexService {
  /** normalized target title → source note id → reference */
  private incomingByTitle = new Map<string, Map<string, PageReference>>();
  /** source note id → outgoing link titles */
  private outgoingByNoteId = new Map<string, string[]>();
  /** note id → page properties (extension point for tags/queries/graph) */
  private propertiesByNoteId = new Map<string, Readonly<Record<string, string>>>();

  /** Cold start / bulk sync — full rebuild */
  buildFromNotes(notes: NoteBase[]): void {
    this.incomingByTitle.clear();
    this.outgoingByNoteId.clear();
    this.propertiesByNoteId.clear();

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.upsertNoteEdges(note);
      this.upsertNoteProperties(note);
    }
  }

  /** Incremental update for a single note create/edit/restore */
  updateNote(note: NoteBase): void {
    if (note.deletedAt) {
      this.removeNote(note.id);
      return;
    }
    this.removeNoteEdges(note.id);
    this.upsertNoteEdges(note);
    this.upsertNoteProperties(note);
  }

  /** Remove a note from the index (trash / permanent delete) */
  removeNote(noteId: string): void {
    this.removeNoteEdges(noteId);
    this.propertiesByNoteId.delete(noteId);
  }

  /** Page properties for a note — O(1). Future: tag/property queries build on this. */
  getProperties(noteId: string): Readonly<Record<string, string>> {
    return this.propertiesByNoteId.get(noteId) ?? {};
  }

  /** Reverse link lookup — pages linking to targetTitle. O(1) */
  getIncoming(title: string, opts: IncomingLinksOptions = {}): PageReference[] {
    const key = normalizeWikiTitle(title);
    if (!key) return [];

    const bucket = this.incomingByTitle.get(key);
    if (!bucket) return [];

    const refs = [...bucket.values()];
    if (!opts.excludeNoteId) return refs;
    return refs.filter(r => r.noteId !== opts.excludeNoteId);
  }

  /** Forward link lookup — [[titles]] from a note. O(1) */
  getOutgoing(noteId: string): string[] {
    return [...(this.outgoingByNoteId.get(noteId) ?? [])];
  }

  getBacklinkCount(title: string, excludeNoteId?: string): number {
    return this.getIncoming(title, { excludeNoteId }).length;
  }

  /** Combined incoming/outgoing references for a page */
  getPageReferences(
    note: NoteBase,
    allNotes: NoteBase[],
  ): { incoming: PageReference[]; outgoing: OutgoingReference[] } {
    const incoming = this.getIncoming(note.title ?? '', { excludeNoteId: note.id });

    const outgoing = this.getOutgoing(note.id).map(title => {
      const target = findNoteByTitle(title, allNotes);
      return target ? { title, targetNoteId: target.id } : { title };
    });

    return { incoming, outgoing };
  }

  resolveBacklinkNavigation(ref: PageReference): string {
    return ref.noteId;
  }

  private removeNoteEdges(noteId: string): void {
    const outgoing = this.outgoingByNoteId.get(noteId);
    if (!outgoing) return;

    for (const title of outgoing) {
      const key = normalizeWikiTitle(title);
      const bucket = this.incomingByTitle.get(key);
      if (!bucket) continue;
      bucket.delete(noteId);
      if (bucket.size === 0) this.incomingByTitle.delete(key);
    }

    this.outgoingByNoteId.delete(noteId);
  }

  private upsertNoteEdges(note: NoteBase): void {
    const outgoing = extractLinks(note.body ?? '');
    this.outgoingByNoteId.set(note.id, outgoing);

    const ref: PageReference = { noteId: note.id, noteTitle: note.title ?? '' };
    for (const title of outgoing) {
      const key = normalizeWikiTitle(title);
      if (!key) continue;

      let bucket = this.incomingByTitle.get(key);
      if (!bucket) {
        bucket = new Map();
        this.incomingByTitle.set(key, bucket);
      }
      bucket.set(note.id, ref);
    }
  }

  private upsertNoteProperties(note: NoteBase): void {
    if (note.properties && Object.keys(note.properties).length > 0) {
      this.propertiesByNoteId.set(note.id, { ...note.properties });
    } else {
      this.propertiesByNoteId.delete(note.id);
    }
  }
}

/** Process-wide knowledge index singleton */
export const knowledgeIndexService = new KnowledgeIndexService();
