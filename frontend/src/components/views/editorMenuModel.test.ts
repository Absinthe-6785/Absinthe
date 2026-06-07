import { describe, expect, it } from 'vitest';
import { CONTEXT_MENU, TINT_LABELS } from './editorMenuModel';

describe('editorMenuModel', () => {
  it('context menu labels are English', () => {
    expect(CONTEXT_MENU.duplicate).toBe('Duplicate');
    expect(CONTEXT_MENU.transform).toBe('Transform');
    expect(CONTEXT_MENU.indent).toBe('Indent');
    expect(CONTEXT_MENU.delete).toBe('Delete');
  });

  it('tint labels are English', () => {
    expect(TINT_LABELS.purple).toBe('Purple');
    expect(TINT_LABELS.default).toBe('Default');
  });
});
