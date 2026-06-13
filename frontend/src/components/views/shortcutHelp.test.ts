// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { isShortcutHelpKey } from './ShortcutHelpOverlay';

describe('isShortcutHelpKey', () => {
  it('detects ? outside editable fields', () => {
    const e = new KeyboardEvent('keydown', { key: '?' });
    Object.defineProperty(e, 'target', { value: document.body });
    expect(isShortcutHelpKey(e)).toBe(true);
  });

  it('ignores ? inside contenteditable', () => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    const e = new KeyboardEvent('keydown', { key: '?' });
    Object.defineProperty(e, 'target', { value: el });
    expect(isShortcutHelpKey(e)).toBe(false);
  });

  it('detects Ctrl+/', () => {
    const e = new KeyboardEvent('keydown', { key: '/', ctrlKey: true });
    expect(isShortcutHelpKey(e)).toBe(true);
  });
});
