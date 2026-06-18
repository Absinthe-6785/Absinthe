import { describe, expect, it } from 'vitest';
import { auditNoteListFeatures, formatK100NoteListReport } from './k100NoteListAudit';

describe('k100NoteListAudit', () => {
  it('covers sort persistence and collapse prefs', () => {
    const rows = auditNoteListFeatures();
    expect(rows.some(r => r.feature === 'sort-persisted')).toBe(true);
    expect(rows.some(r => r.feature === 'pinned-collapse')).toBe(true);
  });

  it('prints note list report', () => {
    const report = formatK100NoteListReport(auditNoteListFeatures());
    console.log('\n' + report);
    expect(report).toContain('K-100 note list audit');
  });
});
