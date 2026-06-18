import { describe, expect, it } from 'vitest';
import { auditTrashUi, formatK102TrashReport } from './k102TrashAudit';

describe('k102TrashAudit', () => {
  it('documents trash icon actions', () => {
    const rows = auditTrashUi();
    expect(rows.some(r => r.feature === 'icon-restore')).toBe(true);
    expect(rows.some(r => r.dataHook === 'data-k102-trash-delete')).toBe(true);
  });

  it('prints trash report', () => {
    const report = formatK102TrashReport(auditTrashUi());
    console.log('\n' + report);
    expect(report).toContain('K-102 trash audit');
  });
});
