import type { NoteBase } from '../../noteUtils';
import { extractLinks, findNoteByTitle, normalizeWikiTitle } from '../../noteUtils';
import { hasUnlinkedMention } from './mentions/mentionDetection';
import { computeRelatedScore, type RelatedReason } from './related/relatedNotesScoring';
import { listTags } from './tags/noteTags';
import { normalizeTagName } from './tags/tagConstants';
import type { IncomingLinksOptions, OutgoingReference, PageReference } from './backlinks';

export interface RelatedNote {
  noteId: string;
  noteTitle: string;
  score: number;
  reasons: RelatedReason[];
}

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
  /** normalized title → note id for O(1) link resolution */
  private noteIdByTitleKey = new Map<string, string>();
  /** note id → precomputed related notes */
  private relatedByNoteId = new Map<string, RelatedNote[]>();

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
    this.noteIdByTitleKey.clear();
    this.relatedByNoteId.clear();

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.activeNotes.set(note.id, { title: note.title ?? '', body: note.body ?? '' });
      const titleKey = normalizeWikiTitle(note.title ?? '');
      if (titleKey) this.noteIdByTitleKey.set(titleKey, note.id);
    }

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.upsertNoteEdges(note);
      this.upsertNoteProperties(note);
      this.upsertNoteTags(note);
      this.indexMentionsFromSource(note);
    }

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.rebuildRelatedForNote(note.id);
    }
  }

  /** Incremental update for a single note create/edit/restore */
  updateNote(note: NoteBase): void {
    if (note.deletedAt) {
      this.removeNote(note.id);
      return;
    }

    const affected = this.collectRelationshipNeighbors(note.id);
    const oldTitleKey = normalizeWikiTitle(this.activeNotes.get(note.id)?.title ?? '');

    this.removeNoteEdges(note.id);
    this.removeMentionsFromSource(note.id);
    this.activeNotes.set(note.id, { title: note.title ?? '', body: note.body ?? '' });

    const newTitleKey = normalizeWikiTitle(note.title ?? '');
    if (oldTitleKey && oldTitleKey !== newTitleKey) {
      this.noteIdByTitleKey.delete(oldTitleKey);
    }
    if (newTitleKey) this.noteIdByTitleKey.set(newTitleKey, note.id);

    this.upsertNoteEdges(note);
    this.upsertNoteProperties(note);
    this.upsertNoteTags(note);
    this.indexMentionsFromSource(note);
    this.rebuildMentionsForTarget(note.id);

    affected.add(note.id);
    for (const id of this.collectRelationshipNeighbors(note.id)) {
      affected.add(id);
    }
    for (const id of affected) this.rebuildRelatedForNote(id);
  }

  /** Remove a note from the index (trash / permanent delete) */
  removeNote(noteId: string): void {
    const neighbors = this.collectRelationshipNeighbors(noteId);
    const titleKey = normalizeWikiTitle(this.activeNotes.get(noteId)?.title ?? '');

    this.removeNoteEdges(noteId);
    this.removeMentionsFromSource(noteId);
    this.removeNoteTags(noteId);
    this.propertiesByNoteId.delete(noteId);
    this.mentionsByTargetId.delete(noteId);
    this.activeNotes.delete(noteId);
    this.relatedByNoteId.delete(noteId);
    if (titleKey) this.noteIdByTitleKey.delete(titleKey);

    for (const id of neighbors) this.rebuildRelatedForNote(id);
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

  /** Notes mentioned as plain text from a source note — O(1) */
  getMentionedNotes(sourceNoteId: string): PageReference[] {
    const targetIds = this.mentionsFromSourceId.get(sourceNoteId) ?? [];
    return targetIds.map(targetId => ({
      noteId: targetId,
      noteTitle: this.activeNotes.get(targetId)?.title ?? '',
    }));
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

  /** Precomputed related notes for a page — O(1) */
  getRelatedNotes(noteId: string): readonly RelatedNote[] {
    return this.relatedByNoteId.get(noteId) ?? [];
  }

  /** Score between two notes from precomputed index — O(n) of related list, typically small */
  getRelatedScore(sourceId: string, targetId: string): number {
    const related = this.relatedByNoteId.get(sourceId) ?? [];
    return related.find(r => r.noteId === targetId)?.score ?? 0;
  }

  resolveRelatedNavigation(ref: RelatedNote): string {
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

  private resolveNoteIdByTitle(title: string): string | undefined {
    return this.noteIdByTitleKey.get(normalizeWikiTitle(title));
  }

  private hasWikiLinkTo(fromId: string, toId: string): boolean {
    const toTitle = this.activeNotes.get(toId)?.title ?? '';
    if (!toTitle.trim()) return false;
    const key = normalizeWikiTitle(toTitle);
    return (this.outgoingByNoteId.get(fromId) ?? []).some(t => normalizeWikiTitle(t) === key);
  }

  private hasSharedTag(aId: string, bId: string): boolean {
    const aTags = this.tagsByNoteId.get(aId) ?? [];
    const bTagKeys = new Set((this.tagsByNoteId.get(bId) ?? []).map(normalizeTagName));
    return aTags.some(t => bTagKeys.has(normalizeTagName(t)));
  }

  private hasMentionBetween(aId: string, bId: string): boolean {
    return (this.mentionsFromSourceId.get(aId) ?? []).includes(bId)
      || (this.mentionsFromSourceId.get(bId) ?? []).includes(aId);
  }

  private collectRelationshipNeighbors(noteId: string): Set<string> {
    const neighbors = new Set<string>();
    const title = this.activeNotes.get(noteId)?.title ?? '';

    for (const tag of this.tagsByNoteId.get(noteId) ?? []) {
      for (const id of this.getNotesWithTag(tag)) {
        if (id !== noteId) neighbors.add(id);
      }
    }

    for (const ref of this.getIncoming(title, { excludeNoteId: noteId })) {
      neighbors.add(ref.noteId);
    }

    for (const linkTitle of this.getOutgoing(noteId)) {
      const tid = this.resolveNoteIdByTitle(linkTitle);
      if (tid && tid !== noteId) neighbors.add(tid);
    }

    for (const ref of this.getMentioningNotes(noteId, { excludeNoteId: noteId })) {
      neighbors.add(ref.noteId);
    }

    for (const tid of this.mentionsFromSourceId.get(noteId) ?? []) {
      if (tid !== noteId) neighbors.add(tid);
    }

    return neighbors;
  }

  private rebuildRelatedForNote(noteId: string): void {
    const source = this.activeNotes.get(noteId);
    if (!source) {
      this.relatedByNoteId.delete(noteId);
      return;
    }

    const candidates = this.collectRelationshipNeighbors(noteId);
    const related: RelatedNote[] = [];

    for (const otherId of candidates) {
      if (otherId === noteId) continue;
      const other = this.activeNotes.get(otherId);
      if (!other) continue;

      const aLinksB = this.hasWikiLinkTo(noteId, otherId);
      const bLinksA = this.hasWikiLinkTo(otherId, noteId);
      const { score, reasons } = computeRelatedScore({
        sharedTag: this.hasSharedTag(noteId, otherId),
        backlink: aLinksB || bLinksA,
        mutualBacklink: aLinksB && bLinksA,
        mention: this.hasMentionBetween(noteId, otherId),
      });

      if (score <= 0) continue;

      related.push({
        noteId: otherId,
        noteTitle: other.title,
        score,
        reasons,
      });
    }

    related.sort((a, b) => b.score - a.score || a.noteTitle.localeCompare(b.noteTitle));
    this.relatedByNoteId.set(noteId, related);
  }
}

/** Process-wide knowledge index singleton */
export const knowledgeIndexService = new KnowledgeIndexService();
