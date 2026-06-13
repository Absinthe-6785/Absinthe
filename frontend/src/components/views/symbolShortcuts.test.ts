import { describe, it, expect } from 'vitest';
import { applySymbolShortcut, SYMBOL_SHORTCUTS } from './symbolShortcuts';

describe('symbolShortcuts', () => {
  it('defines expected shortcuts', () => {
    expect(SYMBOL_SHORTCUTS.some(s => s.trigger === '->' && s.replacement === '→')).toBe(true);
    expect(SYMBOL_SHORTCUTS.some(s => s.trigger === '<=>' && s.replacement === '⇔')).toBe(true);
  });

  it('replaces arrow sequences in plain text', () => {
    expect(applySymbolShortcut('A ->', 'paragraph').text).toBe('A →');
    expect(applySymbolShortcut('x <=', 'paragraph').text).toBe('x ≤');
  });

  it('skips code blocks', () => {
    expect(applySymbolShortcut('->', 'code').applied).toBe(false);
  });

  it('prefers longer triggers', () => {
    expect(applySymbolShortcut('a <=>', 'paragraph').text).toBe('a ⇔');
  });
});
