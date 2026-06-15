import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { buildPlannerCalendarProjection, formatPlannerCalendarPresentation } from '@/components/views/features/planner/calendar';
import {
  buildDenseMonthDayEvents,
  buildRealisticUsageDataset,
  REALISTIC_USAGE_ANCHOR,
} from '@/dev/realisticUsageFixture';
import { buildMonthCellDisplayModel } from '@/components/views/features/planner/calendar-ui/month/monthCalendarPresentation';

describe('K-69 realistic usage audit', () => {
  it('builds dataset meeting minimum scale targets', () => {
    const data = buildRealisticUsageDataset();
    expect(data.stats.noteCount).toBeGreaterThanOrEqual(100);
    expect(data.stats.eventCount).toBeGreaterThanOrEqual(50);
    expect(data.stats.relationCount).toBeGreaterThanOrEqual(30);
    expect(data.stats.scheduleBlockCount).toBeGreaterThanOrEqual(50);
    expect(data.stats.countdownCount).toBeGreaterThanOrEqual(15);
  });

  it('projects month view under 200ms with realistic data', () => {
    const data = buildRealisticUsageDataset();
    const start = performance.now();
    const projection = buildPlannerCalendarProjection({
      notes: data.notes,
      scheduleBlocks: data.scheduleBlocks,
      weeklySchedules: data.weeklySchedules,
      todos: [],
      routines: [],
      anchorDate: '2027-02-15',
      viewMode: 'month',
      now: REALISTIC_USAGE_ANCHOR,
    });
    const elapsed = performance.now() - start;

    expect(projection.views.month.cells).toHaveLength(42);
    expect(elapsed).toBeLessThan(200);
  });

  it('projects day view with dense events under 200ms', () => {
    const denseDay = '2027-02-10';
    const notes = buildDenseMonthDayEvents(denseDay, 25);
    const start = performance.now();
    const projection = buildPlannerCalendarProjection({
      notes,
      scheduleBlocks: [],
      weeklySchedules: [],
      todos: [],
      routines: [],
      anchorDate: denseDay,
      viewMode: 'day',
      now: REALISTIC_USAGE_ANCHOR,
    });
    const elapsed = performance.now() - start;

    expect(projection.views.day.timedEvents.length + projection.views.day.allDayEvents.length).toBeGreaterThanOrEqual(20);
    expect(elapsed).toBeLessThan(200);
  });

  it('caps month cell overflow at configured visible limits', () => {
    const denseDay = '2027-02-10';
    const notes = buildDenseMonthDayEvents(denseDay, 50);
    const projection = buildPlannerCalendarProjection({
      notes,
      scheduleBlocks: [],
      weeklySchedules: [],
      todos: [],
      routines: [],
      anchorDate: '2027-02-10',
      viewMode: 'month',
      now: REALISTIC_USAGE_ANCHOR,
    });

    const cell = projection.views.month.cells.find(c => c.dateKey === denseDay);
    expect(cell).toBeDefined();
    const model = buildMonthCellDisplayModel(cell!);
    expect(model.eventRows.length).toBeLessThanOrEqual(3);
    expect(model.overflowCount).toBeGreaterThan(0);
  });
});
