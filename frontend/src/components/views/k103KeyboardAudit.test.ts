import { describe, expect, it } from 'vitest';
import { auditKeyboardInteractions, formatK103KeyboardReport } from './k103KeyboardAudit';

describe('k103KeyboardAudit', () => {
  it('covers keyboard shortcuts', () => {
    expect(auditKeyboardInteractions().some(r => r.keys === 'Ctrl+Alt+T')).toBe(true);
  });

  it('prints keyboard report', () => {
    const report = formatK103KeyboardReport(auditKeyboardInteractions());
    console.log('\n' + report);
    expect(report).toContain('K-103 keyboard audit');
  });
});
