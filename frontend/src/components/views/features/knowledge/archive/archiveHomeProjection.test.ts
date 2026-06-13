import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { setProperty } from '../properties/noteProperties';
import { applyAreaToNote } from '../trace/areaNotes';
import { collectNoteActivityDateKeys } from '../trace/buildDailyTraceProjection';
import { buildDailyTraceProjection } from '../trace/buildDailyTraceProjection';
import { TRACE_PROPERTY_KEYS } from '../trace/dailyTraceModels';
import { applyEventToNote } from '../trace/eventNotes';
import { applyMilestoneToNote } from '../trace/milestoneNotes';
import {
  archivePeriodRefToTraceRangeLens,
  buildArchiveAreaPills,
  buildArchiveBrowseLinks,
  buildArchiveHomeProjection,
  buildArchiveMarkCalendarProjection,
  buildArchiveRecentMilestones,
  buildArchiveYouAreHere,
  buildNoteMarkIndex,
  computeMarkDensity,
  domainMarkDayToTypes,
  archiveCalendarBounds,
} from './index';

function ts(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime();
}

function note(
  id: string,
  overrides: Partial<NoteBase> & { createdAt?: number } = {},
): NoteBase {
  const { createdAt, ...rest } = overrides;
  const base: NoteBase = {
    id,
    title: 'Note',
    body: '',
    updatedAt: ts(2026, 6, 11),
    folderId: null,
    deletedAt: null,
    ...rest,
  };
  if (createdAt != null) {
    return { ...base, createdAt } as NoteBase & { createdAt: number };
  }
  return base;
}

const NOW = new Date(2026, 5, 12, 12, 0, 0);

describe('domainMarkDayToTypes and computeMarkDensity', () => {
  it('maps domain rows to mark types without weighting', () => {
    const types = domainMarkDayToTypes({
      date: '2026-06-11',
      workout_count: 2,
      routine_done: 3,
      routine_total: 5,
      study_mins: 120,
      is_exception: true,
    });
    expect(types).toEqual(['workout', 'routine', 'scheduled-study', 'exception']);
    expect(computeMarkDensity(types)).toBe(3);
  });

  it('does not treat routine_total alone as a mark', () => {
    const types = domainMarkDayToTypes({
      date: '2026-06-11',
      workout_count: 0,
      routine_done: 0,
      routine_total: 5,
      study_mins: 0,
      is_exception: false,
    });
    expect(types).toEqual([]);
    expect(computeMarkDensity(types)).toBe(0);
  });
});

describe('buildNoteMarkIndex', () => {
  it('collects milestone, event, and activity marks in one pass', () => {
    const milestone = applyMilestoneToNote(
      note('m1', { title: 'N1 Passed' }),
      { milestoneDate: '2026-03-15', milestoneLabel: 'N1 Passed' },
    );
    const event = applyEventToNote(
      note('e1', { title: 'Exam Day' }),
      { title: 'Exam Day', eventDate: '2026-04-01' },
    );
    const activity = note('a1', {
      title: 'Journal',
      createdAt: ts(2026, 5, 10),
      updatedAt: ts(2026, 5, 10),
    });

    const index = buildNoteMarkIndex([milestone, event, activity], '2026-01-01', '2026-12-31');

    expect(index.get('2026-03-15')).toEqual(new Set(['milestone']));
    expect(index.get('2026-04-01')).toEqual(new Set(['event']));
    expect(index.get('2026-05-10')).toEqual(new Set(['note-activity']));
  });

  it('matches buildDailyTraceProjection activity rules via collectNoteActivityDateKeys', () => {
    const edited = note('n1', { title: 'Edited', updatedAt: ts(2026, 6, 11) });
    expect(collectNoteActivityDateKeys(edited)).toEqual(['2026-06-11']);
    const daily = buildDailyTraceProjection('2026-06-11', [edited]);
    expect(daily.activities).toHaveLength(1);
  });

  it('enumerates multi-day event spans within bounds', () => {
    const event = applyEventToNote(
      note('e1', { title: 'Trip', updatedAt: ts(2026, 6, 10) }),
      { title: 'Trip', eventDate: '2026-06-10', eventEndDate: '2026-06-12' },
    );
    const index = buildNoteMarkIndex([event], '2026-06-01', '2026-06-30');
    expect(index.get('2026-06-10')).toEqual(new Set(['event', 'note-activity']));
    expect(index.get('2026-06-11')).toEqual(new Set(['event']));
    expect(index.get('2026-06-12')).toEqual(new Set(['event']));
  });
});

describe('buildArchiveMarkCalendarProjection', () => {
  it('merges note marks with domain marks and computes density', () => {
    const milestone = applyMilestoneToNote(
      note('m1', { title: 'Shipped', updatedAt: ts(2026, 6, 11) }),
      { milestoneDate: '2026-06-11' },
    );

    const projection = buildArchiveMarkCalendarProjection(
      [milestone],
      [{
        date: '2026-06-11',
        workout_count: 1,
        routine_done: 1,
        routine_total: 3,
        study_mins: 60,
        is_exception: false,
      }],
      { now: NOW, calendarYears: 1 },
    );

    const day = projection.days.find(d => d.date === '2026-06-11');
    expect(day?.types).toContain('milestone');
    expect(day?.types).toContain('workout');
    expect(day?.types).toContain('routine');
    expect(day?.types).toContain('scheduled-study');
    expect(day?.density).toBe(5);
    expect(projection.hasAnyMarks).toBe(true);
  });

  it('uses calendar year bounds ending at now', () => {
    const projection = buildArchiveMarkCalendarProjection([], [], { now: NOW, calendarYears: 5 });
    expect(projection.startDate).toBe('2022-01-01');
    expect(projection.endDate).toBe('2026-06-12');
    expect(projection.years).toEqual([2022, 2023, 2024, 2025, 2026]);
  });
});

describe('buildArchiveRecentMilestones', () => {
  it('returns newest milestones first with limit', () => {
    const notes = [
      applyMilestoneToNote(note('m1', { title: 'Old' }), { milestoneDate: '2024-01-01' }),
      applyMilestoneToNote(note('m2', { title: 'New' }), { milestoneDate: '2026-06-01' }),
      applyMilestoneToNote(note('m3', { title: 'Mid' }), { milestoneDate: '2025-06-01' }),
    ];

    const milestones = buildArchiveRecentMilestones(notes, { limit: 2 });
    expect(milestones.map(m => m.date)).toEqual(['2026-06-01', '2025-06-01']);
    expect(milestones[0].displayLabel).toBe('New');
    expect(milestones[0].periodRef.kind).toBe('month');
  });

  it('uses milestone label override when present', () => {
    const milestone = applyMilestoneToNote(
      note('m1', { title: 'Note Title' }),
      { milestoneDate: '2026-01-15', milestoneLabel: 'Custom Label' },
    );
    const [entry] = buildArchiveRecentMilestones([milestone]);
    expect(entry.displayLabel).toBe('Custom Label');
  });
});

describe('buildArchiveAreaPills', () => {
  it('includes areas with linked note marks in lookback window', () => {
    const area = applyAreaToNote(note('area', { title: 'Japanese', updatedAt: ts(2026, 4, 1) }));
    const linked = note('linked', {
      title: 'Study Log',
      body: '[[Japanese]]',
      updatedAt: ts(2026, 5, 1),
    });
    const dormant = applyAreaToNote(note('area2', { title: 'Dormant', updatedAt: ts(2020, 1, 1) }));

    const pills = buildArchiveAreaPills([area, linked, dormant], {
      now: NOW,
      lookbackMonths: 24,
      limit: 8,
    });

    expect(pills).toHaveLength(1);
    expect(pills[0].title).toBe('Japanese');
    expect(pills[0].lastMarkDate).toBe('2026-05-01');
    expect(pills[0].markCount).toBeGreaterThan(0);
  });

  it('excludes areas with no marks in lookback window', () => {
    const area = applyAreaToNote(note('area', { title: 'Old Area', updatedAt: ts(2020, 1, 1) }));
    const linked = note('linked', {
      title: 'Ancient Log',
      body: '[[Old Area]]',
      updatedAt: ts(2020, 1, 1),
    });

    const pills = buildArchiveAreaPills([area, linked], {
      now: NOW,
      lookbackMonths: 24,
    });

    expect(pills).toEqual([]);
  });
});

describe('buildArchiveYouAreHere', () => {
  it('anchors to local calendar position on now', () => {
    const anchor = buildArchiveYouAreHere(NOW);
    expect(anchor.today).toBe('2026-06-12');
    expect(anchor.year).toBe(2026);
    expect(anchor.quarter).toBe(2);
    expect(anchor.month).toBe(6);
    expect(anchor.labels.quarter).toBe('Q2');
    expect(anchor.openPeriod.kind).toBe('month');
    expect(anchor.openPeriod.month).toBe(6);
  });
});

describe('buildArchiveBrowseLinks', () => {
  it('derives current period links from now', () => {
    const browse = buildArchiveBrowseLinks(NOW);
    expect(browse.thisYear.year).toBe(2026);
    expect(browse.thisQuarter.quarter).toBe(2);
    expect(browse.thisMonth.month).toBe(6);
    expect(browse.timeline.defaultPeriod).toEqual(browse.thisMonth);
  });

  it('uses English browse labels when locale is en-US', () => {
    const browse = buildArchiveBrowseLinks(NOW, undefined, 'en-US');
    expect(browse.custom.label).toBe('Custom range');
    expect(browse.allAreas.label).toBe('All areas');
    expect(browse.timeline.label).toBe('Timeline');
    expect(browse.thisMonth.label).toMatch(/June|6/);
  });

  it('includes recentYearsWithMarks when calendar has marks', () => {
    const calendar = buildArchiveMarkCalendarProjection(
      [applyMilestoneToNote(note('m1'), { milestoneDate: '2025-03-01' })],
      [],
      { now: NOW, calendarYears: 2 },
    );
    const browse = buildArchiveBrowseLinks(NOW, calendar);
    expect(browse.recentYearsWithMarks?.map(ref => ref.year)).toContain(2025);
  });
});

describe('archivePeriodRefToTraceRangeLens', () => {
  it('bridges archive period refs to trace lenses', () => {
    expect(archivePeriodRefToTraceRangeLens({
      kind: 'month',
      year: 2026,
      month: 6,
      label: 'June 2026',
    })).toEqual({ kind: 'month', year: 2026, month: 6 });

    expect(archivePeriodRefToTraceRangeLens({
      kind: 'areas-index',
      label: '전체 영역',
    } as never)).toBeNull();
  });
});

describe('buildArchiveHomeProjection', () => {
  it('returns empty flags for an empty vault', () => {
    const projection = buildArchiveHomeProjection({ notes: [], now: NOW });
    expect(projection.empty.isEmpty).toBe(true);
    expect(projection.empty.noMarks).toBe(true);
    expect(projection.empty.noMilestones).toBe(true);
    expect(projection.empty.noAreas).toBe(true);
    expect(projection.recentMilestones).toEqual([]);
    expect(projection.areaPills).toEqual([]);
    expect(projection.frame.title).toBe('아카이브');
  });

  it('assembles all sections without scores or percentages', () => {
    const area = applyAreaToNote(note('area', { title: 'Japanese' }));
    const linked = note('linked', {
      title: 'Log',
      body: '[[Japanese]]',
      updatedAt: ts(2026, 6, 1),
    });
    const milestone = applyMilestoneToNote(
      note('m1', { title: 'K-30 complete' }),
      { milestoneDate: '2026-06-12', milestoneLabel: 'K-30 complete' },
    );

    const projection = buildArchiveHomeProjection({
      notes: [area, linked, milestone],
      now: NOW,
      domainMarks: [{
        date: '2026-06-12',
        workout_count: 1,
        routine_done: 0,
        routine_total: 0,
        study_mins: 0,
        is_exception: false,
      }],
    });

    expect(projection.markCalendar.hasAnyMarks).toBe(true);
    expect(projection.recentMilestones[0]?.date).toBe('2026-06-12');
    expect(projection.areaPills[0]?.title).toBe('Japanese');
    expect(projection.youAreHere.today).toBe('2026-06-12');
    expect(projection.browse.thisMonth.month).toBe(6);
    expect(projection.empty.isEmpty).toBe(false);

    const serialized = JSON.stringify(projection);
    expect(serialized).not.toMatch(/percent|streak|score|completion/i);
  });

  it('defaults domainMarks to empty when omitted', () => {
    const projection = buildArchiveHomeProjection({
      notes: [],
      now: NOW,
    });
    expect(projection.markCalendar.hasAnyMarks).toBe(false);
  });
});

describe('archiveCalendarBounds', () => {
  it('spans inclusive calendar years ending at now', () => {
    expect(archiveCalendarBounds(NOW, 5)).toEqual({
      startDate: '2022-01-01',
      endDate: '2026-06-12',
    });
  });
});
