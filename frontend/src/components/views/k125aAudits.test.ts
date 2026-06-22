import { describe, expect, it } from 'vitest';
import { auditK125aNotesHeaderRc } from './k125aNotesHeaderAudit';
import { auditNotesHeaderRc } from './k121NotesHeaderAudit';
import { auditNewNoteRc } from './k117NewNoteAudit';
import { auditSearchDensityRc } from './k122SearchDensityAudit';
import { auditHeaderLayout } from './k108aHeaderLayoutAudit';
import { auditToolbarRc } from './k119ToolbarAudit';

describe('k125a notes workspace polish audits', () => {
  it('K-125A — notes header polish', () => {
    expect(auditK125aNotesHeaderRc()).toBe(true);
  });

  it('K-121 — notes header recovery (regression)', () => {
    expect(auditNotesHeaderRc()).toBe(true);
  });

  it('K-117 — new note top placement (regression)', () => {
    expect(auditNewNoteRc()).toBe(true);
  });

  it('K-122 — search density (regression)', () => {
    expect(auditSearchDensityRc()).toBe(true);
  });

  it('K-108A — header layout hooks (regression)', () => {
    const layout = auditHeaderLayout();
    expect(layout.btnSizePx).toBe(24);
    expect(layout.gapPx).toBe(8);
    expect(layout.hooks.length).toBeGreaterThan(0);
  });

  it('K-119 — toolbar consistency (regression)', () => {
    expect(auditToolbarRc()).toBe(true);
  });
});
