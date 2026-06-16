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
    categoryBreakdown?: Record<string, number>;
    estimatedVaultBytes?: number;
  };
}

export type LargeVaultCategory = 'eju' | 'toefl' | 'japanese' | 'workout' | 'reference';

const LARGE_VAULT_CATEGORIES: LargeVaultCategory[] = [
  'eju', 'toefl', 'japanese', 'workout', 'reference',
];

const CATEGORY_FOLDER: Record<LargeVaultCategory, string> = {
  eju: 'folder-eju',
  toefl: 'folder-toefl',
  japanese: 'folder-japanese',
  workout: 'folder-workout',
  reference: 'folder-reference',
};

const CATEGORY_TITLES: Record<LargeVaultCategory, string[]> = {
  eju: ['EJU Math Drill', 'EJU Physics Notes', 'EJU Reading Passage', 'EJU Kanji List', 'EJU Mock Exam'],
  toefl: ['TOEFL Listening Practice', 'TOEFL Essay Template', 'TOEFL Vocabulary Deck', 'TOEFL Speaking Prompts'],
  japanese: ['Japanese Grammar N2', 'Kanji Review', 'Reading Practice', 'JLPT Listening Log', 'Vocab Cluster'],
  workout: ['Workout Log', 'Bench Press PR', 'Leg Day Notes', 'Recovery Checklist', 'Program Week 4'],
  reference: ['API Reference', 'Book Summary', 'Meeting Notes', 'Research Link', 'Cheat Sheet'],
};

function estimateNotesBytes(notes: readonly NoteBase[]): number {
  return new TextEncoder().encode(JSON.stringify(notes)).length;
}

function categoryForIndex(i: number): LargeVaultCategory {
  return LARGE_VAULT_CATEGORIES[i % LARGE_VAULT_CATEGORIES.length]!;
}

function titleForCategory(category: LargeVaultCategory, i: number): string {
  const pool = CATEGORY_TITLES[category];
  const base = pool[i % pool.length]!;
  return `${base} ${Math.floor(i / pool.length) + 1}`;
}

function bodyForCategory(category: LargeVaultCategory, i: number, linkTarget?: string): string {
  const link = linkTarget ? `\n\nSee also [[${linkTarget}]].` : '';
  switch (category) {
    case 'eju':
      return `# EJU Study ${i}\n\nProblem set and worked solutions for section ${i % 5}.\n\n- Key formula\n- Common trap${link}`;
    case 'toefl':
      return `# TOEFL Session ${i}\n\nListening transcript excerpt and vocabulary notes.\n\n**Score target:** 100+\n\nPractice paragraph ${i}.${link}`;
    case 'japanese':
      return `# 日本語ノート ${i}\n\nGrammar point and example sentences.\n\n- 例文\n- 復習メモ${link}`;
    case 'workout':
      return `# Workout ${i}\n\nSets, reps, RPE.\n\n| Exercise | Weight | Reps |\n| Squat | ${60 + (i % 20)}kg | 5 |${link}`;
    default:
      return `# Reference ${i}\n\nSummary and citations for topic ${i}.\n\n> Quick reference block${link}`;
  }
}

/**
 * K-89 — Representative large vault for performance and workflow validation.
 * Distributes notes across EJU / TOEFL / Japanese / Workout / Reference with wiki links.
 */
export function buildLargeVaultDataset(options: { noteCount: number }): RealisticUsageDataset {
  const noteCount = options.noteCount;
  const notes: NoteBase[] = [];
  let relationCount = 0;
  const categoryBreakdown: Record<string, number> = {};

  for (let i = 0; i < noteCount; i++) {
    const category = categoryForIndex(i);
    categoryBreakdown[category] = (categoryBreakdown[category] ?? 0) + 1;
    const id = `lv-${category}-${i}`;
    const title = titleForCategory(category, i);
    let linkTarget: string | undefined;
    if (i > 0 && i % 4 === 0) {
      const prevCategory = categoryForIndex(i - 1);
      linkTarget = titleForCategory(prevCategory, i - 1);
      relationCount += 1;
    }
    const body = bodyForCategory(category, i, linkTarget);
    notes.push(baseNote(id, title, {
      body,
      folderId: CATEGORY_FOLDER[category],
      properties: {
        tags: category === 'workout' ? 'workout' : category === 'japanese' || category === 'eju' ? 'study' : 'reference',
        category,
      },
      updatedAt: Date.now() - i * 60_000,
      lastOpenedAt: i % 10 === 0 ? Date.now() - i * 30_000 : undefined,
    }));
  }

  return {
    notes,
    scheduleBlocks: [],
    weeklySchedules: [],
    stats: {
      noteCount: notes.length,
      eventCount: 0,
      milestoneCount: 0,
      relationCount,
      scheduleBlockCount: 0,
      countdownCount: 0,
      categoryBreakdown,
      estimatedVaultBytes: estimateNotesBytes(notes),
    },
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
