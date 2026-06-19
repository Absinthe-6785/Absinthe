import { describe, expect, it } from 'vitest';
import { auditPopoverRc } from './k116PopoverAudit';
import { auditNutritionThemeRc } from './k116NutritionThemeAudit';
import { auditWorkspaceRc } from './k116WorkspaceAudit';
import { auditImageClipboardRc } from './k116ImageClipboardAudit';
import { auditImagePreviewRc } from './k116ImagePreviewAudit';
import { auditCollectionRc } from './k116CollectionAudit';
import { auditResponsiveRc } from './k116ResponsiveAudit';
import { filterSidebarSmartCollections, isSubjectSmartCollectionId } from '../components/views/features/knowledge/collections/sidebarSmartCollections';
import { SMART_COLLECTIONS } from '../components/views/features/knowledge/collections/smartCollections';
import { reorderRuleCollections } from '../components/views/features/knowledge/collections/ruleCollections';

describe('k116 real usage cleanup audits', () => {
  it('A — popover / sort menu', () => {
    expect(auditPopoverRc()).toBe(true);
  });

  it('B — nutrition theme', () => {
    expect(auditNutritionThemeRc()).toBe(true);
  });

  it('C — user-owned workspaces', () => {
    expect(auditWorkspaceRc()).toBe(true);
    const filtered = filterSidebarSmartCollections(SMART_COLLECTIONS, new Set());
    expect(filtered.some(c => isSubjectSmartCollectionId(c.id))).toBe(false);
    const pinned = filterSidebarSmartCollections(SMART_COLLECTIONS, new Set(['subject-politics']));
    expect(pinned.some(c => c.id === 'subject-politics')).toBe(true);
  });

  it('D — image clipboard', () => {
    expect(auditImageClipboardRc()).toBe(true);
  });

  it('E — image preview labels', () => {
    expect(auditImagePreviewRc()).toBe(true);
  });

  it('F — smart collections cleanup', () => {
    expect(auditCollectionRc()).toBe(true);
  });

  it('G — responsive sizing', () => {
    expect(auditResponsiveRc()).toBe(true);
  });

  it('rule collection reorder', () => {
    const cols = [
      { id: 'a', name: 'A', query: 'tag:a' },
      { id: 'b', name: 'B', query: 'tag:b' },
    ];
    const reordered = reorderRuleCollections(cols, 0, 1);
    expect(reordered[0]?.id).toBe('b');
  });
});
