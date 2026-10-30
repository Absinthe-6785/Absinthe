import { describe, expect, it } from 'vitest';
import { buildUnifiedAgendaItems } from './agendaItemModel';
import type { PlannerCountdownRow, PlannerScheduleRow } from '../../calendar';

const schedule = (id: string, dateKey: string): PlannerScheduleRow => ({
  id, dateKey, title: 'Same title', startTime: '23:00', endTime: '01:00',
  endNextDay: true, category: 'Personal', color: 'purple', source: 'schedule',
});

describe('Home agenda Schedule navigation metadata', () => {
  it('retains actual block and carry-over dates alongside stable IDs', () => {
    const items = buildUnifiedAgendaItems({
      blocks: [schedule('today-id', '2026-06-12')],
      carryOverBlocks: [schedule('overnight-id', '2026-06-11')],
      allDayEvents: [], timedEvents: [],
    });
    expect(items.find(item => item.blockId === 'today-id')).toMatchObject({
      kind: 'block', blockId: 'today-id', eventDate: '2026-06-12',
    });
    expect(items.find(item => item.blockId === 'overnight-id')).toMatchObject({
      kind: 'block', blockId: 'overnight-id', eventDate: '2026-06-11', carryOver: true,
    });
  });

  it('preserves explicit dates for Schedule countdowns but does not make Note countdowns Schedule targets', () => {
    const countdowns: PlannerCountdownRow[] = [
      { id: 'schedule-dday:dday-id', title: 'Same title', targetDate: '2026-06-20', daysUntil: 8,
        source: 'schedule-dday', sourceRefId: 'dday-id' },
      { id: 'event:note-id', title: 'Note event', targetDate: '2026-06-21', daysUntil: 9,
        source: 'note-event', sourceRefId: 'note-id' },
    ];
    const items = buildUnifiedAgendaItems({ blocks: [], allDayEvents: [], timedEvents: [], countdowns });
    expect(items.find(item => item.key === 'schedule-dday:dday-id')).toMatchObject({
      kind: 'countdown', blockId: 'dday-id', eventDate: '2026-06-20',
    });
    expect(items.find(item => item.key === 'event:note-id')).toMatchObject({
      kind: 'countdown', noteId: 'note-id', eventDate: '2026-06-21',
    });
    expect(items.find(item => item.key === 'event:note-id')?.blockId).toBeUndefined();
  });
});
