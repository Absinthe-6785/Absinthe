import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { setNoteKind, promoteNoteKind } from './noteClassification';
import { buildResearchDashboard } from './buildResearchDashboard';
import { buildReadingNote } from './readingNoteTemplate';

function note(id: string, body = '', title = id): NoteBase {
  return { id, title, body, updatedAt: 100, folderId: null, deletedAt: null };
}

describe('buildResearchDashboard', () => {
  it('groups research notes and citation activity', () => {
    const notes = [
      setNoteKind(note('s1', '', 'Source A'), 'source'),
      setNoteKind(note('l1', '', 'Lit B'), 'literature'),
      setNoteKind(note('p1', '', 'Perm C'), 'permanent'),
      buildReadingNote(note('r1'), { title: 'Reading X' }),
      note('c1', '```citation\nBook | Author | 2020\n```'),
    ];
    const data = buildResearchDashboard(notes, { limit: 5 });
    expect(data.recentSources.length).toBeGreaterThan(0);
    expect(data.literatureNotes.length).toBeGreaterThan(0);
    expect(data.permanentNotes.length).toBeGreaterThan(0);
    expect(data.readingNotes.length).toBeGreaterThan(0);
    expect(data.citationCount).toBe(1);
    expect(data.citationActivity[0].meta).toContain('인용');
  });

  it('includes promotion activity and source pipeline', () => {
    const promoted = promoteNoteKind(setNoteKind(note('s', ''), 'source'));
    const data = buildResearchDashboard([promoted, note('x', '')], { limit: 5 });
    expect(data.promotionActivity.length).toBe(1);
    expect(data.sourcePipeline.source).toBe(0);
    expect(data.sourcePipeline.literature).toBe(1);
    expect(data.sourcePipeline.unclassified).toBe(1);
  });
});
