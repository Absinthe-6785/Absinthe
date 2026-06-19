import { describe, expect, it } from 'vitest';
import { auditTimeLens, K108A_TIMELINE_REMOVED_HOOKS } from './k108aTimeLensAudit';
import { auditEditorFocus } from './k108aEditorFocusAudit';
import { auditNewNotePlacement, K108A_NEW_NOTE_REMOVED_HOOKS } from './k108aNewNoteAudit';
import { auditHeaderClock } from './k108aHeaderAudit';
import { auditImageBlock } from './k108aImageBlockAudit';
import {
  auditSmartCollections,
  isUserNamedSmartCollection,
  resolveSmartCollectionName,
} from './k108aSmartCollectionAudit';
import { auditHeaderLayout } from './k108aHeaderLayoutAudit';
import { findSmartCollection } from './features/knowledge/collections/smartCollections';

const tEn = (key: string) => key;

describe('k108a audits', () => {
  it('timeline lens — single section collapse, all rows visible', () => {
    const hooks = auditTimeLens();
    expect(hooks).toContain('data-k108-timeline-section');
    expect(hooks).toContain('data-k108-timeline-week');
    expect(hooks).toContain('data-k108-timeline-custom');
    expect(K108A_TIMELINE_REMOVED_HOOKS).toContain('data-k101-week-section-toggle');
  });

  it('editor focus hooks and transitions', () => {
    const entries = auditEditorFocus();
    expect(entries).toContain('focusEditor');
    expect(entries).toContain('scheduleEditorFocus');
    expect(entries).toContain('data-k108-editor-focus');
    expect(entries).toContain('double-click-reading-mode');
  });

  it('new note — sidebar only', () => {
    expect(auditNewNotePlacement()).toEqual(['data-noteview-new-note-btn']);
    expect(K108A_NEW_NOTE_REMOVED_HOOKS).toContain('data-k106-new-note-btn');
  });

  it('header clock removed', () => {
    const { removed } = auditHeaderClock();
    expect(removed).toContain('savedAt-clock-display');
  });

  it('image block compact hooks', () => {
    const hooks = auditImageBlock();
    expect(hooks).toContain('data-k108-image-controls');
    expect(hooks).toContain('data-k108-image-more');
  });

  it('smart collections — system i18n, subject names preserved', () => {
    const { systemIds, subjectIds } = auditSmartCollections();
    expect(systemIds.length).toBeGreaterThan(10);
    expect(subjectIds.every(id => id.startsWith('subject-'))).toBe(true);

    const recent = findSmartCollection('recent')!;
    expect(resolveSmartCollectionName(recent, tEn)).toBe('k108ScRecent');
    expect(isUserNamedSmartCollection('subject-japanese-history')).toBe(true);
    const subject = findSmartCollection('subject-japanese-history')!;
    expect(resolveSmartCollectionName(subject, tEn)).toBe('일본사 작업공간');
  });

  it('header layout normalization', () => {
    const layout = auditHeaderLayout();
    expect(layout.btnSizePx).toBe(24);
    expect(layout.gapPx).toBe(8);
    expect(layout.mobileTouchTargetPx).toBe(44);
    expect(layout.hooks).toContain('data-k108-header-actions');
  });
});
