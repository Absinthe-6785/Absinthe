/**
 * K-69 realistic usage dataset for audit tests and manual QA seeding.
 * Pure data builders — no storage writes.
 */
import { DateTime } from 'luxon';
import type { NoteBase } from '@/components/views/noteUtils';
import type { WeeklySchedule } from '@/types';
import type { PlannerDatedSchedule } from '@/components/views/features/planner/calendar/calendarModels';
import { applyEventToNote } from '@/components/views/features/knowledge/trace/eventNotes';
import { applyMilestoneToNote } from '@/components/views/features/knowledge/trace/milestoneNotes';

export interface RealisticUsageDataset {
  notes: NoteBase[];
  scheduleBlocks: PlannerDatedSchedule[];
  weeklySchedules: WeeklySchedule[];
  stats: {
    noteCount: number;
    eventCount: number;
    milestoneCount: number;
    relationCount: number;
    scheduleBlockCount: number;
    countdownCount: number;
  };
}

const ANCHOR = DateTime.fromISO('2027-02-15T12:00:00', { zone: 'Asia/Seoul' });

function baseNote(id: string, title: string, overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title,
    body: `Body for ${title}`,
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

/** Build ~200 notes with events, milestones, and wiki relations. */
export function buildRealisticUsageDataset(
  options: { noteCount?: number; eventsPerMonth?: number } = {},
): RealisticUsageDataset {
  const noteCount = options.noteCount ?? 200;
  const eventsPerMonth = options.eventsPerMonth ?? 60;
  const notes: NoteBase[] = [];
  let relationCount = 0;
  let eventCount = 0;
  let milestoneCount = 0;
  let countdownCount = 0;

  for (let i = 0; i < noteCount; i++) {
    const id = `note-${i}`;
    let note = baseNote(id, `Note ${i}`, {
      properties: i % 5 === 0 ? { tags: 'study' } : i % 7 === 0 ? { tags: 'workout' } : undefined,
    });

    if (i > 0 && i % 3 === 0) {
      const target = `note-${i - 1}`;
      note = {
        ...note,
        relations: { wiki: [target] },
      };
      relationCount += 1;
    }

    if (i < eventsPerMonth) {
      const day = (i % 28) + 1;
      const dateKey = `2027-02-${String(day).padStart(2, '0')}`;
      note = applyEventToNote(note, {
        title: `Event ${i}`,
        eventDate: dateKey,
        eventTime: `${String(8 + (i % 10)).padStart(2, '0')}:00`,
      });
      eventCount += 1;
      if (i % 4 === 0) countdownCount += 1;
    }

    if (i % 17 === 0) {
      note = applyMilestoneToNote(note, {
        milestoneDate: `2027-02-${String((i % 28) + 1).padStart(2, '0')}`,
        milestoneLabel: `Milestone ${i}`,
      });
      milestoneCount += 1;
    }

    notes.push(note);
  }

  const scheduleBlocks: PlannerDatedSchedule[] = [];
  for (let i = 0; i < 55; i++) {
    const day = (i % 28) + 1;
    scheduleBlocks.push({
      id: `sched-${i}`,
      text: `Block ${i}`,
      date: `2027-02-${String(day).padStart(2, '0')}`,
      start_time: `${String(9 + (i % 8)).padStart(2, '0')}:00`,
      end_time: `${String(10 + (i % 8)).padStart(2, '0')}:30`,
      color: 'gold',
      category: ['Study', 'Workout', 'Work', 'Personal'][i % 4]!,
      is_dday: false,
    });
  }

  return {
    notes,
    scheduleBlocks,
    weeklySchedules: [],
    stats: {
      noteCount: notes.length,
      eventCount,
      milestoneCount,
      relationCount,
      scheduleBlockCount: scheduleBlocks.length,
      countdownCount,
    },
  };
}

export function buildDenseMonthDayEvents(dayKey: string, count: number): NoteBase[] {
  return Array.from({ length: count }, (_, i) =>
    applyEventToNote(baseNote(`dense-${dayKey}-${i}`, `E${i}`), {
      title: `Event ${i}`,
      eventDate: dayKey,
      eventTime: `${String(8 + (i % 12)).padStart(2, '0')}:00`,
    }),
  );
}

export { ANCHOR as REALISTIC_USAGE_ANCHOR };
