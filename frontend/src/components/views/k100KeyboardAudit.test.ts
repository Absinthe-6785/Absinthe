import { describe, expect, it } from 'vitest';
import { auditKeyboardShortcuts, formatK100KeyboardReport, K100_KEYBOARD_SHORTCUTS } from './k100KeyboardAudit';

describe('k100KeyboardAudit', () => {
  it('documents K-100 productivity shortcuts', () => {
    expect(K100_KEYBOARD_SHORTCUTS.some(s => s.keys === 'Ctrl+Shift+N')).toBe(true);
    expect(K100_KEYBOARD_SHORTCUTS.some(s => s.keys === 'Ctrl+Alt+T')).toBe(true);
  });

  it('prints keyboard report', () => {
    const report = formatK100KeyboardReport(auditKeyboardShortcuts());
    console.log('\n' + report);
    expect(report).toContain('K-100 keyboard audit');
  });
});
