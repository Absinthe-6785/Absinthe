import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { setTags } from '../tags/noteTags';
import { RELATED_SCORE, computeRelatedScore } from './relatedNotesScoring';
import { KnowledgeIndexService } from '../KnowledgeIndexService';

function note(
  id: string,
  title: string,
  body: string,
  tags: string[] = [],
): NoteBase {
  let n: NoteBase = { id, title, body, updatedAt: 0, folderId: null, deletedAt: null };
  if (tags.length > 0) n = setTags(n, tags);
  return n;
}

describe('computeRelatedScore', () => {
  it('combines shared tag and backlink scores', () => {
    const result = computeRelatedScore({
      sharedTag: true,
      backlink: true,
      mutualBacklink: false,
      mention: false,
    });
    expect(result.score).toBe(RELATED_SCORE.SHARED_TAG + RELATED_SCORE.BACKLINK);
    expect(result.reasons).toEqual(['shared tag', 'backlink']);
  });

  it('uses mutual backlink instead of single backlink', () => {
    const result = computeRelatedScore({
      sharedTag: false,
      backlink: true,
      mutualBacklink: true,
      mention: false,
    });
    expect(result.score).toBe(RELATED_SCORE.MUTUAL_BACKLINK);
    expect(result.reasons).toContain('mutual backlink');
  });
});

describe('KnowledgeIndexService related notes', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('ranks shared tag relationships', () => {
    service.buildFromNotes([
      note('genki', 'Genki', '', ['japanese', 'textbook']),
      note('grammar', 'Japanese Grammar', '', ['japanese']),
    ]);

    const related = service.getRelatedNotes('genki');
    expect(related).toHaveLength(1);
    expect(related[0].noteId).toBe('grammar');
    expect(related[0].score).toBe(RELATED_SCORE.SHARED_TAG);
    expect(related[0].reasons).toContain('shared tag');
  });

  it('scores backlink relationships', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('study', 'Japanese Study', 'See [[Genki]] for details.'),
    ]);

    const related = service.getRelatedNotes('genki');
    expect(related[0].noteId).toBe('study');
    expect(related[0].score).toBe(RELATED_SCORE.BACKLINK);
  });

  it('scores mention relationships', () => {
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('study', 'Japanese Study', 'Genki is useful.'),
    ]);

    const related = service.getRelatedNotes('genki');
    expect(related[0].reasons).toContain('mention');
    expect(related[0].score).toBe(RELATED_SCORE.MENTION);
  });

  it('ranks combined signals higher', () => {
    service.buildFromNotes([
      note('genki', 'Genki', '', ['japanese']),
      note('grammar', 'Japanese Grammar', '[[Genki]] and shared topic.', ['japanese']),
    ]);

    const related = service.getRelatedNotes('genki');
    expect(related[0].score).toBe(RELATED_SCORE.SHARED_TAG + RELATED_SCORE.BACKLINK);
  });

  it('getRelatedScore returns indexed score', () => {
    service.buildFromNotes([
      note('a', 'A', '', ['x']),
      note('b', 'B', '', ['x']),
    ]);
    expect(service.getRelatedScore('a', 'b')).toBe(RELATED_SCORE.SHARED_TAG);
  });

  it('updates incrementally', () => {
    service.buildFromNotes([
      note('genki', 'Genki', '', ['japanese']),
      note('b', 'B', ''),
    ]);
    expect(service.getRelatedNotes('genki')).toHaveLength(0);

    service.updateNote(note('b', 'B', '', ['japanese']));
    expect(service.getRelatedNotes('genki')[0]?.noteId).toBe('b');
  });

  it('removes relationships when note trashed', () => {
    service.buildFromNotes([
      note('genki', 'Genki', '', ['japanese']),
      note('b', 'B', '', ['japanese']),
    ]);
    service.removeNote('b');
    expect(service.getRelatedNotes('genki')).toHaveLength(0);
  });

  it('deduplicates to one entry per related note', () => {
    service.buildFromNotes([
      note('genki', 'Genki', '', ['japanese']),
      note('b', 'B', 'Genki and [[Genki]]', ['japanese']),
    ]);
    const related = service.getRelatedNotes('genki');
    expect(related.filter(r => r.noteId === 'b')).toHaveLength(1);
  });

  it('excludes self from related notes', () => {
    service.buildFromNotes([note('genki', 'Genki', '', ['japanese'])]);
    expect(service.getRelatedNotes('genki')).toHaveLength(0);
  });
});
