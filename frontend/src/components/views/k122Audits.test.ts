import { describe, expect, it } from 'vitest';
import { auditGlobalSearchRc } from './k122GlobalSearchAudit';
import { auditSearchOverlayRc } from './k122SearchOverlayAudit';
import { auditFindInNoteRc } from './k122FindInNoteAudit';
import { auditDismissRc } from './k122DismissAudit';
import { auditKeyboardRc } from './k122KeyboardAudit';
import { auditHighlightRc } from './k122HighlightAudit';
import { auditSearchDensityRc } from './k122SearchDensityAudit';
import { auditMobileRc } from './k122MobileAudit';

describe('k122 search ux recovery audits', () => {
  it('A — remove top-center global search bar', () => {
    expect(auditGlobalSearchRc()).toBe(true);
  });

  it('B — search overlay / palette behavior', () => {
    expect(auditSearchOverlayRc()).toBe(true);
  });

  it('C — find-in-note panel redesign', () => {
    expect(auditFindInNoteRc()).toBe(true);
  });

  it('D — outside click dismissal', () => {
    expect(auditDismissRc()).toBe(true);
  });

  it('E — keyboard flow', () => {
    expect(auditKeyboardRc()).toBe(true);
  });

  it('F — highlight behavior', () => {
    expect(auditHighlightRc()).toBe(true);
  });

  it('G — search density', () => {
    expect(auditSearchDensityRc()).toBe(true);
  });

  it('H — mobile', () => {
    expect(auditMobileRc()).toBe(true);
  });
});
