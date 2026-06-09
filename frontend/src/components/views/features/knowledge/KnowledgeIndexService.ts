import type { NoteBase } from '../../noteUtils';
import { extractLinks, findNoteByTitle, normalizeWikiTitle } from '../../noteUtils';
import { listTags } from './tags/noteTags';
import { normalizeTagName } from './tags/tagConstants';
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
  /** note id → tag display names */
  private tagsByNoteId = new Map<string, readonly string[]>();
  /** normalized tag → note id → display tag name */
  private notesByTag = new Map<string, Map<string, string>>();

  /** Cold start / bulk sync — full rebuild */
  buildFromNotes(notes: NoteBase[]): void {
    this.incomingByTitle.clear();
    this.outgoingByNoteId.clear();
    this.propertiesByNoteId.clear();
    this.tagsByNoteId.clear();
    this.notesByTag.clear();

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.upsertNoteEdges(note);
      this.upsertNoteProperties(note);
      this.upsertNoteTags(note);
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
    this.upsertNoteTags(note);
  }

  /** Remove a note from the index (trash / permanent delete) */
  removeNote(noteId: string): void {
    this.removeNoteEdges(noteId);
    this.removeNoteTags(noteId);
    this.propertiesByNoteId.delete(noteId);
  }

  /** Page properties for a note — O(1). Future: tag/property queries build on this. */
  getProperties(noteId: string): Readonly<Record<string, string>> {
    return this.propertiesByNoteId.get(noteId) ?? {};
  }

  /** Tags on a note — O(1) */
  getTags(noteId: string): readonly string[] {
    return this.tagsByNoteId.get(noteId) ?? [];
  }

  /** Note ids carrying a tag — O(1) */
  getNotesWithTag(tag: string): string[] {
    const bucket = this.notesByTag.get(normalizeTagName(tag));
    return bucket ? [...bucket.keys()] : [];
  }

  /** Count of notes with a tag — O(1) */
  getTagCount(tag: string): number {
    return this.getNotesWithTag(tag).length;
  }

  /** All tags with counts for lightweight vault views */
  getAllTags(): { tag: string; count: number }[] {
    const result: { tag: string; count: number }[] = [];
    for (const bucket of this.notesByTag.values()) {
      const display = bucket.values().next().value as string | undefined;
      if (!display) continue;
      result.push({ tag: display, count: bucket.size });
    }
    return result.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
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

  private removeNoteTags(noteId: string): void {
    const oldTags = this.tagsByNoteId.get(noteId) ?? [];
    for (const tag of oldTags) {
      const key = normalizeTagName(tag);
      const bucket = this.notesByTag.get(key);
      if (!bucket) continue;
      bucket.delete(noteId);
      if (bucket.size === 0) this.notesByTag.delete(key);
    }
    this.tagsByNoteId.delete(noteId);
  }

  private upsertNoteTags(note: NoteBase): void {
    this.removeNoteTags(note.id);
    const tags = listTags(note);
    if (tags.length === 0) return;

    this.tagsByNoteId.set(note.id, tags);
    for (const tag of tags) {
      const key = normalizeTagName(tag);
      let bucket = this.notesByTag.get(key);
      if (!bucket) {
        bucket = new Map();
        this.notesByTag.set(key, bucket);
      }
      bucket.set(note.id, tag);
    }
  }
}

/** Process-wide knowledge index singleton */
export const knowledgeIndexService = new KnowledgeIndexService();
