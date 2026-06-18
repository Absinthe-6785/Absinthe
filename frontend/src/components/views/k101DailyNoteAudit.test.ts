import { describe, expect, it } from 'vitest';
import { findAllDailyAnchorNotes, hasDailyNote, openOrCreateDailyNote } from './k101DailyNote';
import { auditDailyNoteFeatures, formatK101DailyNoteReport } from './k101DailyNoteAudit';
import type { NoteBase } from './noteUtils';

function note(id: string, title: string): NoteBase {
  return { id, title, body: '', folderId: null, deletedAt: null, updatedAt: 1 };
}

describe('k101DailyNote', () => {
  it('finds all daily anchors and prevents duplicate create', () => {
    const notes = [note('a', '2026-06-18'), note('b', '2026-06-18')];
    expect(findAllDailyAnchorNotes(notes, '2026-06-18')).toHaveLength(2);
    expect(hasDailyNote(notes, '2026-06-18')).toBe(true);

    let created = 0;
    const result = openOrCreateDailyNote({
      notes,
      dateKey: '2026-06-18',
      createNote: () => { created += 1; return 'new'; },
      setActiveNoteId: () => {},
    });
    expect(result).toBe('opened');
    expect(created).toBe(0);
  });

  it('creates when absent', () => {
    let createdId = '';
    openOrCreateDailyNote({
      notes: [],
      dateKey: '2026-06-19',
      createNote: opts => { createdId = 'n1'; return createdId; },
      setActiveNoteId: id => { expect(id).toBe('n1'); },
    });
    expect(createdId).toBe('n1');
  });
});

describe('k101DailyNoteAudit', () => {
  it('prints daily note report', () => {
    const report = formatK101DailyNoteReport(auditDailyNoteFeatures());
    console.log('\n' + report);
    expect(report).toContain('K-101 daily note audit');
    expect(auditDailyNoteFeatures().some(r => r.feature === 'sidebar-badge')).toBe(true);
  });
});
