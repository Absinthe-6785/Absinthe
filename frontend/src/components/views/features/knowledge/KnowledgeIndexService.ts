import type { NoteBase } from '../../noteUtils';
import { extractLinks, findNoteByTitle, normalizeWikiTitle } from '../../noteUtils';
import { hasUnlinkedMention } from './mentions/mentionDetection';
import { listTags } from './tags/noteTags';
import { normalizeTagName } from './tags/tagConstants';
import type { IncomingLinksOptions, OutgoingReference, PageReference } from './backlinks';

export interface MentionLookupOptions {
  /** Exclude self when viewing mentions on active page */
  excludeNoteId?: string;
}

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
  /** active note id → title/body snapshot for mention indexing */
  private activeNotes = new Map<string, { title: string; body: string }>();
  /** target note id → source note id → reference (unlinked mentions) */
  private mentionsByTargetId = new Map<string, Map<string, PageReference>>();
  /** source note id → target note ids mentioned as plain text */
  private mentionsFromSourceId = new Map<string, string[]>();

  /** Cold start / bulk sync — full rebuild */
  buildFromNotes(notes: NoteBase[]): void {
    this.incomingByTitle.clear();
    this.outgoingByNoteId.clear();
    this.propertiesByNoteId.clear();
    this.tagsByNoteId.clear();
    this.notesByTag.clear();
    this.activeNotes.clear();
    this.mentionsByTargetId.clear();
    this.mentionsFromSourceId.clear();

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.activeNotes.set(note.id, { title: note.title ?? '', body: note.body ?? '' });
    }

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.upsertNoteEdges(note);
      this.upsertNoteProperties(note);
      this.upsertNoteTags(note);
      this.indexMentionsFromSource(note);
    }
  }

  /** Incremental update for a single note create/edit/restore */
  updateNote(note: NoteBase): void {
    if (note.deletedAt) {
      this.removeNote(note.id);
      return;
    }
    this.removeNoteEdges(note.id);
    this.removeMentionsFromSource(note.id);
    this.activeNotes.set(note.id, { title: note.title ?? '', body: note.body ?? '' });
    this.upsertNoteEdges(note);
    this.upsertNoteProperties(note);
    this.upsertNoteTags(note);
    this.indexMentionsFromSource(note);
    this.rebuildMentionsForTarget(note.id);
  }

  /** Remove a note from the index (trash / permanent delete) */
  removeNote(noteId: string): void {
    this.removeNoteEdges(noteId);
    this.removeMentionsFromSource(noteId);
    this.removeNoteTags(noteId);
    this.propertiesByNoteId.delete(noteId);
    this.mentionsByTargetId.delete(noteId);
    this.activeNotes.delete(noteId);
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

  /** Notes that mention this page as plain text — O(1) */
  getMentioningNotes(targetNoteId: string, opts: MentionLookupOptions = {}): PageReference[] {
    const bucket = this.mentionsByTargetId.get(targetNoteId);
    if (!bucket) return [];

    const refs = [...bucket.values()];
    if (!opts.excludeNoteId) return refs;
    return refs.filter(r => r.noteId !== opts.excludeNoteId);
  }

  /** Alias for incoming unlinked mentions */
  getMentions(targetNoteId: string, opts: MentionLookupOptions = {}): PageReference[] {
    return this.getMentioningNotes(targetNoteId, opts);
  }

  getMentionCount(targetNoteId: string, excludeNoteId?: string): number {
    return this.getMentioningNotes(targetNoteId, { excludeNoteId }).length;
  }

  resolveMentionNavigation(ref: PageReference): string {
    return ref.noteId;
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

  private removeMentionsFromSource(sourceId: string): void {
    for (const targetId of this.mentionsFromSourceId.get(sourceId) ?? []) {
      const bucket = this.mentionsByTargetId.get(targetId);
      if (!bucket) continue;
      bucket.delete(sourceId);
      if (bucket.size === 0) this.mentionsByTargetId.delete(targetId);
    }
    this.mentionsFromSourceId.delete(sourceId);
  }

  private indexMentionsFromSource(note: NoteBase): void {
    const ref: PageReference = { noteId: note.id, noteTitle: note.title ?? '' };
    const body = note.body ?? '';
    const targetIds: string[] = [];

    for (const [targetId, target] of this.activeNotes) {
      if (targetId === note.id || !target.title.trim()) continue;
      if (hasUnlinkedMention(body, target.title)) {
        let bucket = this.mentionsByTargetId.get(targetId);
        if (!bucket) {
          bucket = new Map();
          this.mentionsByTargetId.set(targetId, bucket);
        }
        bucket.set(note.id, ref);
        targetIds.push(targetId);
      }
    }

    if (targetIds.length > 0) {
      this.mentionsFromSourceId.set(note.id, targetIds);
    }
  }

  private rebuildMentionsForTarget(targetId: string): void {
    const target = this.activeNotes.get(targetId);
    if (!target?.title.trim()) {
      this.mentionsByTargetId.delete(targetId);
      return;
    }

    for (const [sourceId, targets] of this.mentionsFromSourceId) {
      if (!targets.includes(targetId)) continue;
      const next = targets.filter(id => id !== targetId);
      if (next.length > 0) this.mentionsFromSourceId.set(sourceId, next);
      else this.mentionsFromSourceId.delete(sourceId);
    }

    const nextBucket = new Map<string, PageReference>();
    for (const [sourceId, source] of this.activeNotes) {
      if (sourceId === targetId) continue;
      if (hasUnlinkedMention(source.body, target.title)) {
        nextBucket.set(sourceId, { noteId: sourceId, noteTitle: source.title });
        const existing = this.mentionsFromSourceId.get(sourceId) ?? [];
        if (!existing.includes(targetId)) {
          this.mentionsFromSourceId.set(sourceId, [...existing, targetId]);
        }
      }
    }

    if (nextBucket.size > 0) {
      this.mentionsByTargetId.set(targetId, nextBucket);
    } else {
      this.mentionsByTargetId.delete(targetId);
    }
  }
}

/** Process-wide knowledge index singleton */
export const knowledgeIndexService = new KnowledgeIndexService();
