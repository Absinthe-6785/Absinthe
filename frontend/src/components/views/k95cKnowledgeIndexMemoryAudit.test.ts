// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { setTags } from '@/components/views/features/knowledge/tags/noteTags';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { buildBacklinkIndex, getIncomingLinks } from '@/components/views/features/knowledge/backlinks';
import { buildDiscoveryFeed } from '@/components/views/features/knowledge/discovery/discoveryEngine';
import { groupRelatedNotes } from '@/components/views/features/knowledge/related/groupRelatedNotes';
import {
  formatK95CKnowledgeIndexMemoryReport,
  measureK95CKnowledgeIndexMemoryRow,
  runK95CKnowledgeIndexMemoryMatrix,
  verifyK95CIndexBehaviorParity,
} from '@/components/views/k95cKnowledgeIndexMemoryAudit';

function note(
  id: string,
  title: string,
  body = '',
  tags: string[] = [],
): NoteBase {
  let n: NoteBase = {
    id,
    title,
    body,
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
  };
  if (tags.length > 0) n = setTags(n, tags);
  return n;
}

describe('k95cKnowledgeIndexMemoryAudit matrix', () => {
  it('measures index memory at 100 / 300 / 1000 / 3000 notes', () => {
    const rows = runK95CKnowledgeIndexMemoryMatrix();
    expect(rows).toHaveLength(4);

    for (const row of rows) {
      expect(row.indexTotalBytes).toBeGreaterThan(0);
      expect(row.relatedByNoteIdBytes).toBeGreaterThan(0);
      expect(row.relatedReductionPct).toBeGreaterThanOrEqual(30);
      expect(row.indexReductionPct).toBeGreaterThanOrEqual(10);
      expect(row.retainedObjectCount).toBeGreaterThan(row.noteCount);
    }

    // eslint-disable-next-line no-console
    console.log(formatK95CKnowledgeIndexMemoryReport(rows));
  }, 120_000);
});

describe('k95c compact related storage', () => {
  it('hydrates titles lazily for related notes', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Alpha', '[[Beta]]', ['topic']),
      note('b', 'Beta', 'Alpha mentioned here.', ['topic']),
    ]);

    const related = service.getRelatedNotes('a');
    expect(related.length).toBeGreaterThan(0);
    expect(related[0]?.noteTitle).toBe('Beta');
    expect(related[0]?.noteId).toBe('b');
  });

  it('derives unique related count on demand', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Alpha', '', ['x', 'y']),
      note('b', 'Beta', '', ['x']),
      note('c', 'Gamma', '', ['y']),
    ]);

    expect(service.deriveUniqueRelatedCount('a')).toBeGreaterThan(0);
    expect(service.getConnectionScore('a')).toBeGreaterThan(0);
  });
});

describe('k95c incremental safety', () => {
  it('updateNote keeps structural neighbors fresh', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Alpha', '[[Beta]]'),
      note('b', 'Beta', ''),
      note('c', 'Gamma', 'Alpha'),
    ]);

    service.updateNote(note('a', 'Alpha Renamed', '[[Beta]] [[Gamma]]'));
    expect(service.getIncoming('Beta').some(r => r.noteTitle === 'Alpha Renamed')).toBe(true);
    expect(service.getRelatedNotes('b').some(r => r.noteId === 'a')).toBe(true);
    expect(service.getRelatedNotes('c').some(r => r.noteId === 'a')).toBe(true);
  });

  it('removeNote clears stale relationships', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Alpha', '[[Beta]]'),
      note('b', 'Beta', 'Alpha'),
    ]);

    service.removeNote('a');
    expect(service.getRelatedNotes('b')).toHaveLength(0);
    expect(service.getMentioningNotes('b')).toHaveLength(0);
  });

  it('sequential updates match bulk rebuild', () => {
    const notes = [
      note('1', 'One', '[[Two]]', ['t']),
      note('2', 'Two', 'One and [[Three]]', ['t']),
      note('3', 'Three', ''),
    ];

    const incremental = new KnowledgeIndexService();
    for (const n of notes) incremental.updateNote(n);

    const bulk = new KnowledgeIndexService();
    bulk.buildFromNotes(notes);

    for (const n of notes) {
      expect(incremental.getOutgoing(n.id)).toEqual(bulk.getOutgoing(n.id));
      expect(incremental.getRelatedNotes(n.id).map(r => r.noteId))
        .toEqual(bulk.getRelatedNotes(n.id).map(r => r.noteId));
      expect(incremental.deriveUniqueRelatedCount(n.id))
        .toEqual(bulk.deriveUniqueRelatedCount(n.id));
    }
  });
});

describe('k95c compatibility', () => {
  it('preserves backlinks, related notes, and discovery feed output', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('hub', 'Hub', '[[Spoke A]] [[Spoke B]]', ['network']),
      note('a', 'Spoke A', 'Links [[Hub]] and [[Spoke B]]', ['network']),
      note('b', 'Spoke B', 'Back to [[Hub]]'),
    ];
    service.buildFromNotes(notes);

    const parity = verifyK95CIndexBehaviorParity(notes, service);
    expect(parity.relatedCount).toBeGreaterThan(0);
    expect(parity.backlinkCount).toBeGreaterThan(0);

    const fullIndex = buildBacklinkIndex(notes);
    expect(service.getIncoming('Hub')).toEqual(getIncomingLinks(fullIndex, 'Hub'));
    expect(groupRelatedNotes('hub', notes, service).mostRelated.length).toBeGreaterThan(0);
    const feed = buildDiscoveryFeed(notes, service, { galaxyCacheKey: 'k95c-compat' });
    expect(feed.summary).toBeDefined();
  });
});
