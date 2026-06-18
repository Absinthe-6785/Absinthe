import type { NoteBase } from '../../noteUtils';
import { extractLinks, findNoteByTitle, normalizeWikiTitle } from '../../noteUtils';
import { containsWholeWordMention, bodyTextWithoutWikiLinks } from './mentions/mentionDetection';
import { computeRelatedScore, RELATED_SCORE, type RelatedReason } from './related/relatedNotesScoring';
import {
  decodeRelatedReasonFlags,
  toCompactRelatedRef,
  type CompactRelatedRef,
} from './related/relatedCompactRef';
import { listTags } from './tags/noteTags';
import { isTagsPropertyKey, normalizeTagName } from './tags/tagConstants';
import { normalizePropertyKey } from './properties/noteProperties';
import { normalizeQueryValue } from './query/parseQuery';
import type { RelationEdge, ResolvedRelationTarget } from './relations/relationModels';
import { normalizeRelationPropertyKey, relationEdgeKey, toRelationEdges } from './relations/relationNormalize';
import type { IncomingLinksOptions, OutgoingReference, PageReference } from './backlinks';
import {
  collectGlobalGraphEdges,
  type BuildGlobalGraphOptions,
} from './graph/buildGlobalGraphData';
import { createMemAuditThrottle } from '../../../../lib/memAudit';

const logIndexMemAudit = createMemAuditThrottle(2000);

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
  /** normalized target title → source note ids linking to title */
  private incomingByTitle = new Map<string, Set<string>>();
  /** source note id → outgoing link titles */
  private outgoingByNoteId = new Map<string, string[]>();
  /** note id → page properties (extension point for tags/queries/graph) */
  private propertiesByNoteId = new Map<string, Readonly<Record<string, string>>>();
  /** note id → tag display names */
  private tagsByNoteId = new Map<string, readonly string[]>();
  /** normalized tag → note id → display tag name */
  private notesByTag = new Map<string, Map<string, string>>();
  /** active note id → title/updatedAt metadata (body read via bodyProvider — K-83A) */
  private activeNotes = new Map<string, { title: string; updatedAt: number }>();
  private bodyProvider: ((noteId: string) => string) | null = null;
  /** target note id → source note ids with unlinked mentions */
  private mentionsByTargetId = new Map<string, Set<string>>();
  /** source note id → target note ids mentioned as plain text */
  private mentionsFromSourceId = new Map<string, string[]>();
  /** normalized title → note id for O(1) link resolution */
  private noteIdByTitleKey = new Map<string, string>();
  /** note id → precomputed structural related notes (links, mentions, relations — not tag-only) */
  private relatedByNoteId = new Map<string, CompactRelatedRef[]>();
  /** tag key → note ids sorted by title ascending for O(k) shared-tag related merge */
  private tagMembersByTitle = new Map<string, string[]>();
  /** normalized property key → normalized value → note ids */
  private notesByProperty = new Map<string, Map<string, Set<string>>>();
  /** normalized property key → normalized value → display value */
  private propertyValueLabels = new Map<string, Map<string, string>>();
  /** source note id → outgoing relation edges */
  private outgoingRelationsByNoteId = new Map<string, RelationEdge[]>();
  /** target note id → incoming relation edges */
  private incomingRelationsByTargetId = new Map<string, RelationEdge[]>();
  /** normalized relation property key → source note ids with outgoing relation */
  private notesWithOutgoingRelationKey = new Map<string, Set<string>>();
  /** Suppresses per-tag sort/count refresh during bulk cold builds */
  private deferTagRelatedRefresh = false;
  /** Cached note ids with titles for O(1) mention candidate scans during bulk indexing */
  private titleSearchIndex: string[] = [];

  /** Resolve note body from Zustand store — avoids duplicating bodies in the index. */
  setBodyProvider(provider: (noteId: string) => string): void {
    this.bodyProvider = provider;
  }

  private resolveBody(noteId: string, fallback = ''): string {
    return this.bodyProvider?.(noteId) ?? fallback;
  }

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
    this.tagMembersByTitle.clear();
    this.notesByProperty.clear();
    this.propertyValueLabels.clear();
    this.outgoingRelationsByNoteId.clear();
    this.incomingRelationsByTargetId.clear();
    this.notesWithOutgoingRelationKey.clear();

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.activeNotes.set(note.id, {
        title: note.title ?? '',
        updatedAt: note.updatedAt ?? 0,
      });
      const titleKey = normalizeWikiTitle(note.title ?? '');
      if (titleKey) this.noteIdByTitleKey.set(titleKey, note.id);
    }

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.upsertNoteEdges(note);
      this.upsertNoteProperties(note);
      this.upsertNoteRelations(note);
    }

    this.deferTagRelatedRefresh = true;
    try {
      for (const note of notes) {
        if (note.deletedAt) continue;
        this.upsertNoteTags(note);
      }
    } finally {
      this.deferTagRelatedRefresh = false;
    }

    this.rebuildTitleSearchIndex();
    for (const note of notes) {
      if (note.deletedAt) continue;
      this.indexMentionsFromSource(note);
    }

    for (const note of notes) {
      if (note.deletedAt) continue;
      this.rebuildStructuralRelatedForNote(note.id);
    }

    this.rebuildAllTagMemberSorts();

    logIndexMemAudit({
      source: 'KnowledgeIndexService.buildFromNotes',
      notes: this.activeNotes.size,
      links: this.incomingByTitle.size + this.outgoingByNoteId.size,
      relatedCandidates: this.estimateTotalUniqueRelatedCount(),
    });
  }

  /** Incremental update for a single note create/edit/restore */
  updateNote(note: NoteBase): void {
    if (note.deletedAt) {
      this.removeNote(note.id);
      return;
    }

    const affected = this.collectStructuralNeighbors(note.id);
    const oldTitleKey = normalizeWikiTitle(this.activeNotes.get(note.id)?.title ?? '');

    this.removeNoteEdges(note.id);
    this.removeNoteRelations(note.id);
    this.removeMentionsFromSource(note.id);
    this.activeNotes.set(note.id, {
      title: note.title ?? '',
      updatedAt: note.updatedAt ?? 0,
    });

    const newTitleKey = normalizeWikiTitle(note.title ?? '');
    if (oldTitleKey && oldTitleKey !== newTitleKey) {
      this.noteIdByTitleKey.delete(oldTitleKey);
    }
    if (newTitleKey) this.noteIdByTitleKey.set(newTitleKey, note.id);

    this.upsertNoteEdges(note);
    this.upsertNoteProperties(note);
    this.upsertNoteTags(note);
    this.upsertNoteRelations(note);
    this.indexMentionsFromSource(note);
    this.rebuildMentionsForTarget(note.id);

    affected.add(note.id);
    for (const id of this.collectStructuralNeighbors(note.id)) {
      affected.add(id);
    }
    for (const id of affected) {
      this.rebuildStructuralRelatedForNote(id);
    }

    logIndexMemAudit({
      source: 'KnowledgeIndexService.updateNote',
      notes: this.activeNotes.size,
      links: this.incomingByTitle.size + this.outgoingByNoteId.size,
      relatedCandidates: this.estimateTotalUniqueRelatedCount(),
      affectedNeighbors: affected.size,
    });
  }

  /** Remove a note from the index (trash / permanent delete) */
  removeNote(noteId: string): void {
    const neighbors = this.collectStructuralNeighbors(noteId);
    const titleKey = normalizeWikiTitle(this.activeNotes.get(noteId)?.title ?? '');

    this.removeNoteEdges(noteId);
    this.removeNoteRelations(noteId);
    this.removeMentionsFromSource(noteId);
    this.removeNoteTags(noteId);
    this.removeNoteFromPropertyIndex(noteId);
    this.propertiesByNoteId.delete(noteId);
    this.mentionsByTargetId.delete(noteId);
    this.activeNotes.delete(noteId);
    this.relatedByNoteId.delete(noteId);
    if (titleKey) this.noteIdByTitleKey.delete(titleKey);

    for (const id of neighbors) {
      this.rebuildStructuralRelatedForNote(id);
    }
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

  /** Note ids with a property value — O(1) bucket lookup */
  getNotesWithProperty(key: string, value: string): string[] {
    const normKey = normalizePropertyKey(key);
    const normValue = normalizeQueryValue(value);
    const bucket = this.notesByProperty.get(normKey)?.get(normValue);
    return bucket ? [...bucket] : [];
  }

  /** Distinct indexed values for a property key */
  getPropertyValues(key: string): string[] {
    const normKey = normalizePropertyKey(key);
    const values = this.notesByProperty.get(normKey);
    if (!values) return [];

    const labels = this.propertyValueLabels.get(normKey);
    return [...values.keys()]
      .map(normValue => labels?.get(normValue) ?? normValue)
      .sort((a, b) => a.localeCompare(b));
  }

  /** All indexed note ids — O(N) */
  getAllNoteIds(): string[] {
    return [...this.activeNotes.keys()];
  }

  /** Global vault edge count without building graph nodes — O(N + E). */
  getGlobalEdgeCount(options?: BuildGlobalGraphOptions): number {
    return collectGlobalGraphEdges(this, options).length;
  }

  /** Outgoing relation edges from a note — O(1) */
  getOutgoingRelations(noteId: string): readonly RelationEdge[] {
    return this.outgoingRelationsByNoteId.get(noteId) ?? [];
  }

  /** Alias for outgoing relations on a note */
  getRelations(noteId: string): readonly RelationEdge[] {
    return this.getOutgoingRelations(noteId);
  }

  /** Incoming relation edges to a note — O(1) bucket lookup */
  getIncomingRelations(noteId: string): readonly RelationEdge[] {
    return this.incomingRelationsByTargetId.get(noteId) ?? [];
  }

  /** Outgoing target note ids for a relation property key — O(k) over outgoing edges */
  getRelationTargets(sourceId: string, propertyKey: string): string[] {
    const normKey = normalizeRelationPropertyKey(propertyKey);
    return this.getOutgoingRelations(sourceId)
      .filter(edge => normalizeRelationPropertyKey(edge.propertyKey) === normKey)
      .map(edge => edge.targetId);
  }

  /** Source note ids with an outgoing relation to target via property key */
  getNotesWithRelation(propertyKey: string, targetId: string): string[] {
    const normKey = normalizeRelationPropertyKey(propertyKey);
    return (this.incomingRelationsByTargetId.get(targetId) ?? [])
      .filter(edge => normalizeRelationPropertyKey(edge.propertyKey) === normKey)
      .map(edge => edge.sourceId);
  }

  /** Reverse relation lookup — sources linking to target via property key */
  getRelatedNotesByRelation(targetId: string, propertyKey: string): string[] {
    return this.getNotesWithRelation(propertyKey, targetId);
  }

  /** Notes with any outgoing relation for property key — O(1) bucket lookup */
  getNotesWithOutgoingRelation(propertyKey: string): string[] {
    const normKey = normalizeRelationPropertyKey(propertyKey);
    return [...(this.notesWithOutgoingRelationKey.get(normKey) ?? [])];
  }

  /** Notes linked to target title via any relation key — O(1) title resolve + bucket */
  getNotesLinkedTo(title: string): string[] {
    const targetId = this.resolveNoteId(title);
    if (!targetId) return [];

    const seen = new Set<string>();
    const result: string[] = [];
    for (const edge of this.incomingRelationsByTargetId.get(targetId) ?? []) {
      if (seen.has(edge.sourceId)) continue;
      seen.add(edge.sourceId);
      result.push(edge.sourceId);
    }
    return result;
  }

  /** Notes with relation key pointing to target title — O(1) resolve + reverse bucket */
  getNotesWithRelationToTitle(propertyKey: string, title: string): string[] {
    const targetId = this.resolveNoteId(title);
    if (!targetId) return [];
    return this.getNotesWithRelation(propertyKey, targetId);
  }

  /** Resolve outgoing relation targets with titles; missing when target absent */
  resolveRelationTargets(sourceId: string, propertyKey?: string): ResolvedRelationTarget[] {
    const filterKey = propertyKey ? normalizeRelationPropertyKey(propertyKey) : null;
    const edges = this.getOutgoingRelations(sourceId).filter(edge =>
      !filterKey || normalizeRelationPropertyKey(edge.propertyKey) === filterKey,
    );

    const seen = new Set<string>();
    const resolved: ResolvedRelationTarget[] = [];
    for (const edge of edges) {
      const identity = relationEdgeKey(edge.sourceId, edge.targetId, edge.propertyKey);
      if (seen.has(identity)) continue;
      seen.add(identity);

      const active = this.activeNotes.get(edge.targetId);
      resolved.push({
        targetId: edge.targetId,
        propertyKey: edge.propertyKey,
        targetTitle: active?.title ?? '',
        missing: !active,
      });
    }
    return resolved;
  }

  /**
   * Relationship count from precomputed indexes — O(1) per neighbor bucket.
   * Used by highly-connected smart collections.
   */
  getConnectionScore(noteId: string): number {
    const title = this.getNoteTitle(noteId);
    const incomingLinks = this.getIncoming(title).length;
    const outgoingLinks = this.getOutgoing(noteId).length;
    const incomingMentions = this.getMentioningNotes(noteId).length;
    const outgoingMentions = (this.mentionsFromSourceId.get(noteId) ?? []).length;
    const relatedCount = this.deriveUniqueRelatedCount(noteId);
    return incomingLinks + outgoingLinks + incomingMentions + outgoingMentions + relatedCount;
  }

  /**
   * Unique related neighbor count (structural ∪ tag-only) — derived on demand (K-95C).
   */
  deriveUniqueRelatedCount(noteId: string): number {
    if (!this.activeNotes.has(noteId)) return 0;
    const structural = this.relatedByNoteId.get(noteId) ?? [];
    let tagOnly = this.countTagTouchForNote(noteId);
    for (const rel of structural) {
      if (this.hasSharedTag(noteId, rel.noteId)) {
        tagOnly = Math.max(0, tagOnly - 1);
      }
    }
    return structural.length + tagOnly;
  }

  private estimateTotalUniqueRelatedCount(): number {
    let total = 0;
    for (const noteId of this.activeNotes.keys()) {
      total += this.deriveUniqueRelatedCount(noteId);
    }
    return total;
  }

  private hydratePageReference(noteId: string): PageReference {
    return { noteId, noteTitle: this.getNoteTitle(noteId) };
  }

  private hydrateRelatedNote(ref: CompactRelatedRef): RelatedNote {
    return {
      noteId: ref.noteId,
      noteTitle: this.getNoteTitle(ref.noteId),
      score: ref.score,
      reasons: decodeRelatedReasonFlags(ref.reasonFlags),
    };
  }

  private compareCompactRelated(a: CompactRelatedRef, b: CompactRelatedRef): number {
    const scoreCmp = b.score - a.score;
    if (scoreCmp !== 0) return scoreCmp;
    return this.getNoteTitle(a.noteId).localeCompare(this.getNoteTitle(b.noteId));
  }

  /** Notes with no wiki backlinks and no unlinked mentions — O(N) over indexes */
  getOrphanNoteIds(): string[] {
    const result: string[] = [];
    for (const noteId of this.getAllNoteIds()) {
      const title = this.getNoteTitle(noteId);
      if (this.getIncoming(title).length > 0) continue;
      if (this.getOutgoing(noteId).length > 0) continue;
      if (this.getMentioningNotes(noteId).length > 0) continue;
      if ((this.mentionsFromSourceId.get(noteId) ?? []).length > 0) continue;
      result.push(noteId);
    }
    return result;
  }

  /** Notes with no indexed tags — O(N) */
  getUntaggedNoteIds(): string[] {
    return this.getAllNoteIds().filter(noteId => this.getTags(noteId).length === 0);
  }

  /** Notes with incoming or outgoing wiki links — O(N) */
  getNoteIdsWithBacklinks(): string[] {
    return this.getAllNoteIds().filter(noteId => {
      const title = this.getNoteTitle(noteId);
      return this.getIncoming(title).length > 0 || this.getOutgoing(noteId).length > 0;
    });
  }

  /** Notes with incoming or outgoing unlinked mentions — O(N) */
  getNoteIdsWithMentions(): string[] {
    return this.getAllNoteIds().filter(noteId =>
      this.getMentioningNotes(noteId).length > 0
      || (this.mentionsFromSourceId.get(noteId) ?? []).length > 0,
    );
  }

  /** Notes ranked by connection score — O(N log N) */
  getHighlyConnectedNoteIds(minScore = 2): string[] {
    return this.getAllNoteIds()
      .map(noteId => ({ noteId, score: this.getConnectionScore(noteId) }))
      .filter(entry => entry.score >= minScore)
      .sort((a, b) => b.score - a.score || a.noteId.localeCompare(b.noteId))
      .map(entry => entry.noteId);
  }

  /** Indexed note title — O(1) */
  getNoteTitle(noteId: string): string {
    return this.activeNotes.get(noteId)?.title ?? '';
  }

  /** Resolve wiki link title to note id — O(1) */
  resolveNoteId(title: string): string | undefined {
    return this.noteIdByTitleKey.get(normalizeWikiTitle(title));
  }

  /** Reverse link lookup — pages linking to targetTitle. O(1) */
  getIncoming(title: string, opts: IncomingLinksOptions = {}): PageReference[] {
    const key = normalizeWikiTitle(title);
    if (!key) return [];

    const bucket = this.incomingByTitle.get(key);
    if (!bucket) return [];

    const refs = [...bucket].map(sourceId => this.hydratePageReference(sourceId));
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

    const refs = [...bucket].map(sourceId => this.hydratePageReference(sourceId));
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
    return targetIds.map(targetId => this.hydratePageReference(targetId));
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

  /** Precomputed related notes for a page — merges structural index with shared-tag neighbors */
  getRelatedNotes(noteId: string, limit = 12): readonly RelatedNote[] {
    const structural = this.relatedByNoteId.get(noteId) ?? [];
    if (limit <= 0) {
      const exclude = new Set(structural.map(r => r.noteId));
      const tagFill = this.getTopSharedTagRelated(noteId, Number.MAX_SAFE_INTEGER, exclude);
      return this.mergeRelatedLists(structural, tagFill, Number.MAX_SAFE_INTEGER)
        .map(ref => this.hydrateRelatedNote(ref));
    }
    if (structural.length >= limit) {
      return structural.slice(0, limit).map(ref => this.hydrateRelatedNote(ref));
    }
    const exclude = new Set(structural.map(r => r.noteId));
    const tagFill = this.getTopSharedTagRelated(noteId, limit - structural.length, exclude);
    return this.mergeRelatedLists(structural, tagFill, limit)
      .map(ref => this.hydrateRelatedNote(ref));
  }

  /** Score between two notes — O(1) from cache or on-demand pair evaluation */
  getRelatedScore(sourceId: string, targetId: string): number {
    const related = this.relatedByNoteId.get(sourceId) ?? [];
    const cached = related.find(r => r.noteId === targetId);
    if (cached) return cached.score;
    return this.computePairRelatedScore(sourceId, targetId).score;
  }

  resolveRelatedNavigation(ref: RelatedNote): string {
    return ref.noteId;
  }

  private removeNoteEdges(noteId: string): void {
    const outgoing = this.outgoingByNoteId.get(noteId);
    if (!outgoing) return;

    for (const title of outgoing) {
      const key = normalizeWikiTitle(title);
      if (!key) continue;
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

    for (const title of outgoing) {
      const key = normalizeWikiTitle(title);
      if (!key) continue;

      let bucket = this.incomingByTitle.get(key);
      if (!bucket) {
        bucket = new Set();
        this.incomingByTitle.set(key, bucket);
      }
      bucket.add(note.id);
    }
  }

  private upsertNoteProperties(note: NoteBase): void {
    this.removeNoteFromPropertyIndex(note.id);

    if (note.properties && Object.keys(note.properties).length > 0) {
      this.propertiesByNoteId.set(note.id, { ...note.properties });
      for (const [key, value] of Object.entries(note.properties)) {
        if (isTagsPropertyKey(key)) continue;
        this.indexProperty(note.id, key, value);
      }
    } else {
      this.propertiesByNoteId.delete(note.id);
    }
  }

  private indexProperty(noteId: string, key: string, value: string): void {
    const normKey = normalizePropertyKey(key);
    const normValue = normalizeQueryValue(value);
    if (!normKey || !normValue) return;

    let values = this.notesByProperty.get(normKey);
    if (!values) {
      values = new Map();
      this.notesByProperty.set(normKey, values);
    }

    let noteIds = values.get(normValue);
    if (!noteIds) {
      noteIds = new Set();
      values.set(normValue, noteIds);
    }
    noteIds.add(noteId);

    let labels = this.propertyValueLabels.get(normKey);
    if (!labels) {
      labels = new Map();
      this.propertyValueLabels.set(normKey, labels);
    }
    if (!labels.has(normValue)) {
      labels.set(normValue, value.trim());
    }
  }

  private unindexProperty(noteId: string, key: string, value: string): void {
    const normKey = normalizePropertyKey(key);
    const normValue = normalizeQueryValue(value);
    const values = this.notesByProperty.get(normKey);
    const bucket = values?.get(normValue);
    if (!bucket) return;

    bucket.delete(noteId);
    if (bucket.size === 0) {
      values?.delete(normValue);
      const labels = this.propertyValueLabels.get(normKey);
      labels?.delete(normValue);
      if (values && values.size === 0) this.notesByProperty.delete(normKey);
      if (labels && labels.size === 0) this.propertyValueLabels.delete(normKey);
    }
  }

  private removeNoteFromPropertyIndex(noteId: string): void {
    const props = this.propertiesByNoteId.get(noteId);
    if (!props) return;
    for (const [key, value] of Object.entries(props)) {
      if (isTagsPropertyKey(key)) continue;
      this.unindexProperty(noteId, key, value);
    }
  }

  private removeNoteTags(noteId: string): void {
    const oldTags = this.tagsByNoteId.get(noteId) ?? [];
    for (const tag of oldTags) {
      const key = normalizeTagName(tag);
      const bucket = this.notesByTag.get(key);
      if (!bucket) continue;
      bucket.delete(noteId);
      if (bucket.size === 0) {
        this.notesByTag.delete(key);
        this.tagMembersByTitle.delete(key);
      } else if (!this.deferTagRelatedRefresh) {
        this.rebuildTagMemberSortForKey(key);
      }
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
      if (!this.deferTagRelatedRefresh) {
        this.rebuildTagMemberSortForKey(key);
      }
    }

    if (this.deferTagRelatedRefresh) return;
  }

  private removeNoteRelations(sourceId: string): void {
    for (const edge of this.outgoingRelationsByNoteId.get(sourceId) ?? []) {
      this.removeIncomingRelationEdge(edge);
      const normKey = normalizeRelationPropertyKey(edge.propertyKey);
      const bucket = this.notesWithOutgoingRelationKey.get(normKey);
      if (!bucket) continue;
      bucket.delete(sourceId);
      if (bucket.size === 0) this.notesWithOutgoingRelationKey.delete(normKey);
    }
    this.outgoingRelationsByNoteId.delete(sourceId);
  }

  private removeIncomingRelationEdge(edge: RelationEdge): void {
    const incoming = this.incomingRelationsByTargetId.get(edge.targetId);
    if (!incoming) return;

    const normKey = normalizeRelationPropertyKey(edge.propertyKey);
    const next = incoming.filter(existing =>
      !(existing.sourceId === edge.sourceId
        && normalizeRelationPropertyKey(existing.propertyKey) === normKey),
    );

    if (next.length === 0) {
      this.incomingRelationsByTargetId.delete(edge.targetId);
    } else {
      this.incomingRelationsByTargetId.set(edge.targetId, next);
    }
  }

  private upsertNoteRelations(note: NoteBase): void {
    this.removeNoteRelations(note.id);
    const edges = toRelationEdges(note.id, note.relations);
    if (edges.length === 0) return;

    this.outgoingRelationsByNoteId.set(note.id, edges);
    for (const edge of edges) {
      const normKey = normalizeRelationPropertyKey(edge.propertyKey);
      let bucket = this.notesWithOutgoingRelationKey.get(normKey);
      if (!bucket) {
        bucket = new Set();
        this.notesWithOutgoingRelationKey.set(normKey, bucket);
      }
      bucket.add(note.id);

      const incoming = this.incomingRelationsByTargetId.get(edge.targetId) ?? [];
      const identity = relationEdgeKey(edge.sourceId, edge.targetId, edge.propertyKey);
      if (incoming.some(existing =>
        relationEdgeKey(existing.sourceId, existing.targetId, existing.propertyKey) === identity,
      )) {
        continue;
      }
      this.incomingRelationsByTargetId.set(edge.targetId, [...incoming, edge]);
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

  private rebuildTitleSearchIndex(): void {
    this.titleSearchIndex = [];
    for (const [id, meta] of this.activeNotes) {
      if (meta.title.trim()) this.titleSearchIndex.push(id);
    }
  }

  private indexMentionsFromSource(note: NoteBase): void {
    const body = note.body ?? '';
    if (!body) return;

    const plainBody = bodyTextWithoutWikiLinks(body);
    const plainLower = plainBody.toLowerCase();
    const targetIds: string[] = [];

    for (const targetId of this.titleSearchIndex) {
      if (targetId === note.id) continue;
      const title = this.activeNotes.get(targetId)?.title ?? '';
      const titleLower = title.toLowerCase();
      if (!titleLower || !plainLower.includes(titleLower)) continue;
      if (!containsWholeWordMention(plainBody, title)) continue;

      let bucket = this.mentionsByTargetId.get(targetId);
      if (!bucket) {
        bucket = new Set();
        this.mentionsByTargetId.set(targetId, bucket);
      }
      bucket.add(note.id);
      targetIds.push(targetId);
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

    const nextBucket = new Set<string>();
    const plainTarget = target.title.trim();
    const plainTargetLower = plainTarget.toLowerCase();
    for (const [sourceId, source] of this.activeNotes) {
      if (sourceId === targetId) continue;
      const body = this.resolveBody(sourceId);
      if (!body) continue;
      const plainBody = bodyTextWithoutWikiLinks(body);
      if (!plainBody.toLowerCase().includes(plainTargetLower)) continue;
      if (!containsWholeWordMention(plainBody, plainTarget)) continue;
      nextBucket.add(sourceId);
      const existing = this.mentionsFromSourceId.get(sourceId) ?? [];
      if (!existing.includes(targetId)) {
        this.mentionsFromSourceId.set(sourceId, [...existing, targetId]);
      }
    }

    if (nextBucket.size > 0) {
      this.mentionsByTargetId.set(targetId, nextBucket);
    } else {
      this.mentionsByTargetId.delete(targetId);
    }
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

  private hasRelationEdge(aId: string, bId: string): boolean {
    return this.getOutgoingRelations(aId).some(e => e.targetId === bId)
      || this.getIncomingRelations(aId).some(e => e.sourceId === bId);
  }

  private hasSharedRelationTarget(aId: string, bId: string): boolean {
    const aTargets = new Set(this.getOutgoingRelations(aId).map(e => e.targetId));
    const bTargets = new Set(this.getOutgoingRelations(bId).map(e => e.targetId));
    for (const t of aTargets) {
      if (t !== aId && t !== bId && bTargets.has(t)) return true;
    }
    return false;
  }

  private collectStructuralNeighbors(noteId: string): Set<string> {
    const neighbors = new Set<string>();
    const title = this.activeNotes.get(noteId)?.title ?? '';

    for (const ref of this.getIncoming(title, { excludeNoteId: noteId })) {
      neighbors.add(ref.noteId);
    }

    for (const linkTitle of this.getOutgoing(noteId)) {
      const tid = this.resolveNoteId(linkTitle);
      if (tid && tid !== noteId) neighbors.add(tid);
    }

    for (const ref of this.getMentioningNotes(noteId, { excludeNoteId: noteId })) {
      neighbors.add(ref.noteId);
    }

    for (const tid of this.mentionsFromSourceId.get(noteId) ?? []) {
      if (tid !== noteId) neighbors.add(tid);
    }

    for (const edge of this.getOutgoingRelations(noteId)) {
      if (edge.targetId !== noteId) neighbors.add(edge.targetId);
    }
    for (const edge of this.getIncomingRelations(noteId)) {
      if (edge.sourceId !== noteId) neighbors.add(edge.sourceId);
    }

    return neighbors;
  }

  private rebuildTagMemberSortForKey(tagKey: string): void {
    const bucket = this.notesByTag.get(tagKey);
    if (!bucket || bucket.size === 0) {
      this.tagMembersByTitle.delete(tagKey);
      return;
    }
    const sorted = [...bucket.keys()].sort((a, b) => {
      const titleA = this.activeNotes.get(a)?.title ?? '';
      const titleB = this.activeNotes.get(b)?.title ?? '';
      return titleA.localeCompare(titleB);
    });
    this.tagMembersByTitle.set(tagKey, sorted);
  }

  private rebuildAllTagMemberSorts(): void {
    this.tagMembersByTitle.clear();
    for (const key of this.notesByTag.keys()) {
      this.rebuildTagMemberSortForKey(key);
    }
  }

  private countTagTouchForNote(noteId: string): number {
    let touch = 0;
    for (const tag of this.tagsByNoteId.get(noteId) ?? []) {
      const bucket = this.notesByTag.get(normalizeTagName(tag));
      if (bucket) touch += bucket.size - 1;
    }
    return touch;
  }

  private getTopSharedTagRelated(
    noteId: string,
    limit: number,
    exclude: Set<string>,
  ): CompactRelatedRef[] {
    if (limit <= 0) return [];

    const iterators: { ids: string[]; idx: number }[] = [];
    for (const tag of this.tagsByNoteId.get(noteId) ?? []) {
      const key = normalizeTagName(tag);
      const ids = this.tagMembersByTitle.get(key)
        ?? (this.notesByTag.has(key) ? (this.rebuildTagMemberSortForKey(key), this.tagMembersByTitle.get(key)!) : []);
      if (ids.length > 0) iterators.push({ ids, idx: 0 });
    }
    if (iterators.length === 0) return [];

    const result: CompactRelatedRef[] = [];
    const seen = new Set<string>(exclude);
    seen.add(noteId);

    while (result.length < limit) {
      let bestId: string | null = null;
      let bestTitle = '';
      let bestIter = -1;

      for (let i = 0; i < iterators.length; i += 1) {
        const it = iterators[i]!;
        while (it.idx < it.ids.length) {
          const candidateId = it.ids[it.idx]!;
          if (candidateId === noteId || seen.has(candidateId)) {
            it.idx += 1;
            continue;
          }
          break;
        }
        if (it.idx >= it.ids.length) continue;

        const candidateId = it.ids[it.idx]!;
        const title = this.activeNotes.get(candidateId)?.title ?? '';
        if (bestId == null || title.localeCompare(bestTitle) < 0) {
          bestId = candidateId;
          bestTitle = title;
          bestIter = i;
        }
      }

      if (bestId == null || bestIter < 0) break;
      iterators[bestIter]!.idx += 1;
      seen.add(bestId);
      result.push(toCompactRelatedRef(bestId, RELATED_SCORE.SHARED_TAG, ['shared tag']));
    }

    return result;
  }

  private mergeRelatedLists(
    structural: readonly CompactRelatedRef[],
    tagFill: readonly CompactRelatedRef[],
    limit: number,
  ): CompactRelatedRef[] {
    const merged = [...structural, ...tagFill];
    merged.sort((a, b) => this.compareCompactRelated(a, b));
    return merged.slice(0, limit);
  }

  private computePairRelatedScore(noteId: string, otherId: string): { score: number; reasons: RelatedReason[] } {
    if (noteId === otherId || !this.activeNotes.has(noteId) || !this.activeNotes.has(otherId)) {
      return { score: 0, reasons: [] };
    }

    const aLinksB = this.hasWikiLinkTo(noteId, otherId);
    const bLinksA = this.hasWikiLinkTo(otherId, noteId);
    const directOutgoing = this.getOutgoing(noteId).some(t => this.resolveNoteId(t) === otherId);
    const otherMeta = this.activeNotes.get(otherId);
    const recentActivity = otherMeta
      ? otherMeta.updatedAt > Date.now() - 14 * 86_400_000
      : false;

    return computeRelatedScore({
      sharedTag: this.hasSharedTag(noteId, otherId),
      backlink: aLinksB || bLinksA,
      mutualBacklink: aLinksB && bLinksA,
      mention: this.hasMentionBetween(noteId, otherId),
      relation: this.hasRelationEdge(noteId, otherId),
      sharedRelation: this.hasSharedRelationTarget(noteId, otherId),
      directLink: directOutgoing && !aLinksB,
      recentActivity,
    });
  }

  private rebuildStructuralRelatedForNote(noteId: string): void {
    const source = this.activeNotes.get(noteId);
    if (!source) {
      this.relatedByNoteId.delete(noteId);
      return;
    }

    const candidates = this.collectStructuralNeighbors(noteId);
    const related: CompactRelatedRef[] = [];

    for (const otherId of candidates) {
      if (otherId === noteId) continue;
      if (!this.activeNotes.has(otherId)) continue;

      const aLinksB = this.hasWikiLinkTo(noteId, otherId);
      const bLinksA = this.hasWikiLinkTo(otherId, noteId);
      const hasRelation = this.hasRelationEdge(noteId, otherId);
      const hasSharedRelation = this.hasSharedRelationTarget(noteId, otherId);
      const directOutgoing = this.getOutgoing(noteId).some(t => this.resolveNoteId(t) === otherId);
      const otherMeta = this.activeNotes.get(otherId);
      const recentActivity = otherMeta
        ? otherMeta.updatedAt > Date.now() - 14 * 86_400_000
        : false;

      const { score, reasons } = computeRelatedScore({
        sharedTag: this.hasSharedTag(noteId, otherId),
        backlink: aLinksB || bLinksA,
        mutualBacklink: aLinksB && bLinksA,
        mention: this.hasMentionBetween(noteId, otherId),
        relation: hasRelation,
        sharedRelation: hasSharedRelation,
        directLink: directOutgoing && !aLinksB,
        recentActivity,
      });

      if (score <= 0) continue;

      related.push(toCompactRelatedRef(otherId, score, reasons));
    }

    related.sort((a, b) => this.compareCompactRelated(a, b));
    this.relatedByNoteId.set(noteId, related);
  }
}

/** Process-wide knowledge index singleton */
export const knowledgeIndexService = new KnowledgeIndexService();
