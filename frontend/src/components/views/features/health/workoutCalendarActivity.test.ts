import { describe, expect, it, vi } from 'vitest';
import type { CompositeWorkoutRecord, CompositeWorkoutReadResult } from './compositeWorkoutReadProjection';
import type { WorkoutRangeView } from './verifiedWorkoutRangeSnapshot';
import { buildWorkoutCalendarActivity } from './workoutCalendarActivity';

function record(source: 'legacy' | 'canonical', date: string, key: string): CompositeWorkoutRecord {
  if (source === 'legacy') return { source, readId: `legacy-${key}`, localDate: date, capability: 'read_only',
    legacy: { accountId: 'a', rowId: key, localDate: date, blockId: 'b', sortOrder: 0,
      exerciseDisplay: { kind: 'historical_fallback', name: 'Legacy' }, sets: [] } } as never;
  return { source, readId: `canonical-${key}`, localDate: date, capability: 'read_only_in_G5B2',
    canonical: { accountId: 'a', namespaceKey: 'ns', generationId: 'g', entityId: key,
      localRevision: 1, session: { version: 1, id: key, localDate: date, entries: [] } } } as never;
}

function range(status: 'complete' | 'partial_data' | 'error', legacyStatus: 'success' | 'error',
  canonicalStatus: 'success' | 'error', dates: WorkoutRangeView['dates']): WorkoutRangeView {
  const records = dates.flatMap(date => [...date.legacyRows, ...date.canonicalSessions]);
  return { accountId: 'a', scope: null, startDate: '2026-09-01', endDate: '2026-09-30',
    result: { status, legacyStatus, canonicalStatus, records } as CompositeWorkoutReadResult, dates };
}

describe('composite calendar activity', () => {
  it('marks legacy, canonical, mixed and zero-set dates present without session counts', () => {
    const l = record('legacy', '2026-09-01', 'l') as Extract<CompositeWorkoutRecord, { source: 'legacy' }>;
    const c1 = record('canonical', '2026-09-02', '11111111-1111-4111-8111-111111111111') as Extract<CompositeWorkoutRecord, { source: 'canonical' }>;
    const c2 = record('canonical', '2026-09-02', '22222222-2222-4222-8222-222222222222') as Extract<CompositeWorkoutRecord, { source: 'canonical' }>;
    const model = buildWorkoutCalendarActivity({ phase: 'settled', monthStart: '2026-09-01', monthEnd: '2026-09-30', onRetry: vi.fn(),
      view: range('complete', 'success', 'success', [
        { localDate: '2026-09-01', legacyRows: [l], canonicalSessions: [] },
        { localDate: '2026-09-02', legacyRows: [], canonicalSessions: [c1, c2] },
      ]) });
    expect(model.stateForDate('2026-09-01')).toBe('present');
    expect(model.stateForDate('2026-09-02')).toBe('present');
    expect([...model.knownPresentDates]).toEqual(['2026-09-01', '2026-09-02']);
    expect(model.stateForDate('2026-09-03')).toBe('absent');
  });

  it('uses unknown for missing partial evidence, loading, error, isolation and out-of-bounds dates', () => {
    const c = record('canonical', '2026-09-02', '11111111-1111-4111-8111-111111111111') as Extract<CompositeWorkoutRecord, { source: 'canonical' }>;
    const partial = buildWorkoutCalendarActivity({ phase: 'settled', monthStart: '2026-09-01', monthEnd: '2026-09-30', onRetry: vi.fn(),
      view: range('partial_data', 'error', 'success', [{ localDate: c.localDate, legacyRows: [], canonicalSessions: [c] }]) });
    expect(partial.stateForDate('2026-09-02')).toBe('present');
    expect(partial.stateForDate('2026-09-03')).toBe('unknown');
    expect(partial.stateForDate('2026-10-01')).toBe('unknown');
    expect(buildWorkoutCalendarActivity({ phase: 'loading', view: null, monthStart: '2026-09-01', monthEnd: '2026-09-30', onRetry: vi.fn() }).stateForDate('2026-09-03')).toBe('unknown');
    expect(buildWorkoutCalendarActivity({ phase: 'settled', view: range('error', 'error', 'error', []), monthStart: '2026-09-01', monthEnd: '2026-09-30', onRetry: vi.fn() }).stateForDate('2026-09-03')).toBe('unknown');
    expect(buildWorkoutCalendarActivity({ phase: 'settled', view: range('complete', 'success', 'success', []), isolationError: true, monthStart: '2026-09-01', monthEnd: '2026-09-30', onRetry: vi.fn() }).stateForDate('2026-09-03')).toBe('unknown');
  });

  it('does not claim absence outside the exact complete derived coverage', () => {
    const incompleteCoverage = range('complete', 'success', 'success', []);
    const narrowed = { ...incompleteCoverage, startDate: '2026-09-10' };
    const model = buildWorkoutCalendarActivity({ phase: 'settled', view: narrowed,
      monthStart: '2026-09-01', monthEnd: '2026-09-30', onRetry: vi.fn() });
    expect(model.stateForDate('2026-09-05')).toBe('unknown');
    expect(model.stateForDate('2026-09-10')).toBe('absent');
  });
});
