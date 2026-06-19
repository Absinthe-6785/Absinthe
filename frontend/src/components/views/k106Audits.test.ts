import { describe, expect, it } from 'vitest';
import { auditNewNoteAccess } from './k106NewNoteAudit';
import { auditBlockHover } from './k106BlockHoverAudit';
import { auditBlockSelection } from './k106BlockSelectionAudit';
import { auditUndoRedo } from './k106UndoRedoAudit';
import { auditKeyboardConsistency } from './k106KeyboardAudit';
import { auditMobileEditor } from './k106MobileEditorAudit';
import { isStructuralBlockChangeForTest } from './useBlockEditor.test-helpers';

describe('k106 audits', () => {
  it('new note hooks', () => {
    expect(auditNewNoteAccess()).toContain('data-k106-new-note-btn');
  });

  it('block hover rules', () => {
    expect(auditBlockHover()).toContain('be-block-hover-bg-tint');
  });

  it('block selection hitbox', () => {
    expect(auditBlockSelection().leftSelectZonePx).toBeGreaterThanOrEqual(72);
  });

  it('undo/redo config', () => {
    expect(auditUndoRedo().shortcuts).toContain('Ctrl+Z');
  });

  it('keyboard matrix', () => {
    expect(auditKeyboardConsistency().some(s => s.keys === 'Ctrl+Y')).toBe(true);
    expect(auditKeyboardConsistency().some(s => s.keys === 'Ctrl+N')).toBe(true);
  });

  it('mobile editor hooks', () => {
    expect(auditMobileEditor().length).toBeGreaterThan(0);
  });

  it('structural block changes detected', () => {
    const a = [{ id: '1', type: 'paragraph' as const, content: 'a' }];
    const b = [{ id: '1', type: 'paragraph' as const, content: 'b' }];
    expect(isStructuralBlockChangeForTest(a, b)).toBe(false);
    expect(isStructuralBlockChangeForTest(a, [{ id: '2', type: 'paragraph' as const, content: 'b' }])).toBe(true);
  });
});
