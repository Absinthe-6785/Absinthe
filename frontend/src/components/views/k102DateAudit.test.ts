import { describe, expect, it } from 'vitest';
import {
  formatRelativeDate,
  formatNoteRowDate,
  classifyRelativeDate,
} from './k102DateFormat';
import { buildRelativeDateLabels } from './k102RelativeDateLabels';
import { auditDateSurfaces, formatK102DateReport } from './k102DateAudit';

const labels = {
  today: 'Today',
  yesterday: 'Yesterday',
  daysAgo: (n: number) => `${n} days ago`,
};

describe('k102DateFormat', () => {
  const todayKey = '2026-06-18';

  it('formats today, yesterday, and days ago', () => {
    expect(formatRelativeDate({ value: todayKey, todayKey, labels })).toBe('Today');
    expect(formatRelativeDate({ value: '2026-06-17', todayKey, labels })).toBe('Yesterday');
    expect(formatRelativeDate({ value: '2026-06-15', todayKey, labels })).toBe('3 days ago');
  });

  it('formats older years with full date', () => {
    const out = formatNoteRowDate(new Date('2025-12-31').getTime(), todayKey, 'en', labels);
    expect(out).toContain('2025');
  });

  it('classifies relative buckets', () => {
    const ts = new Date(`${todayKey}T12:00:00`).getTime();
    expect(classifyRelativeDate(ts, todayKey)).toBe('today');
  });
});

describe('k102RelativeDateLabels', () => {
  it('builds labels from i18n keys', () => {
    const built = buildRelativeDateLabels(k => (k === 'k102DaysAgo' ? '{count} days ago' : k));
    expect(built.daysAgo(2)).toBe('2 days ago');
  });
});

describe('k102DateAudit', () => {
  it('prints date audit report', () => {
    const report = formatK102DateReport(auditDateSurfaces());
    console.log('\n' + report);
    expect(report).toContain('K-102 date audit');
    expect(auditDateSurfaces().length).toBe(6);
  });
});
