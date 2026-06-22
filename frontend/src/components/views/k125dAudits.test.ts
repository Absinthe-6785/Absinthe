import { describe, expect, it } from 'vitest';
import {
  auditK125dArchiveUxRc,
  K125D_ARCHIVE_MAJOR_SECTIONS,
} from './k125dArchiveAudit';
import { auditArchiveLayoutRc } from './k121ArchiveLayoutAudit';
import { auditScrollRc } from './k120ScrollAudit';
import { auditEmptyStateRc } from './k119EmptyStateAudit';
import { readArchiveSectionPrefs } from './features/knowledge/archive/archiveSectionPrefs';

describe('k125d archive UX audits', () => {
  it('K-125D — single-expand accordion, compact layout, 1200px width', () => {
    expect(auditK125dArchiveUxRc()).toBe(true);
    expect(K125D_ARCHIVE_MAJOR_SECTIONS).toEqual(['history', 'deleted', 'snapshots', 'timeline']);
  });

  it('archive section prefs default history expanded (K-125D)', () => {
    const prefs = readArchiveSectionPrefs();
    expect(prefs.historyCollapsed).toBe(false);
    expect(prefs.deletedCollapsed).toBe(true);
    expect(prefs.snapshotsCollapsed).toBe(true);
    expect(prefs.timelineCollapsed).toBe(true);
  });

  it('K-121 — archive layout recovery (regression)', () => {
    expect(auditArchiveLayoutRc()).toBe(true);
  });

  it('K-120 — scroll container cleanup (regression)', () => {
    expect(auditScrollRc()).toBe(true);
  });

  it('K-119 — empty state density (regression)', () => {
    expect(auditEmptyStateRc()).toBe(true);
  });
});
