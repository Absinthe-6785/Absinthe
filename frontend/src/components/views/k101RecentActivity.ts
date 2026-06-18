import type { NoteBase } from './noteUtils';
import { toDateKey } from './features/knowledge/databaseViews/parseDatabaseDate';
import { isoWeekBounds } from './features/planner/calendar/plannerCalendarDateUtils';

export interface ActivityNoteEntry {
  id: string;
  title: string;
  timestamp: number;
}

function activeNotes(notes: readonly NoteBase[]): NoteBase[] {
  return notes.filter(n => !n.deletedAt);
}

function startOfDayMs(dateKey: string): number {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.getTime();
}

function noteTouchedOnDay(note: NoteBase, dateKey: string): boolean {
  const dayStart = startOfDayMs(dateKey);
  const dayEnd = dayStart + 86_400_000;
  const opened = note.lastOpenedAt ?? 0;
  const updated = note.updatedAt ?? 0;
  return (opened >= dayStart && opened < dayEnd) || (updated >= dayStart && updated < dayEnd);
}

export function buildActivityToday(notes: readonly NoteBase[], todayKey: string, limit = 5): ActivityNoteEntry[] {
  return activeNotes(notes)
    .filter(n => noteTouchedOnDay(n, todayKey))
    .sort((a, b) => Math.max(b.lastOpenedAt ?? 0, b.updatedAt ?? 0) - Math.max(a.lastOpenedAt ?? 0, a.updatedAt ?? 0))
    .slice(0, limit)
    .map(n => ({
      id: n.id,
      title: n.title,
      timestamp: Math.max(n.lastOpenedAt ?? 0, n.updatedAt ?? 0),
    }));
}

export function buildActivityYesterday(notes: readonly NoteBase[], todayKey: string, limit = 5): ActivityNoteEntry[] {
  const d = new Date(`${todayKey}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return buildActivityToday(notes, toDateKey(d), limit);
}

export function buildActivityThisWeek(notes: readonly NoteBase[], todayKey: string, limit = 5): ActivityNoteEntry[] {
  const bounds = isoWeekBounds(todayKey);
  if (!bounds) return [];
  const start = startOfDayMs(bounds.startDate);
  const end = startOfDayMs(bounds.endDate) + 86_400_000;
  return activeNotes(notes)
    .filter(n => {
      const t = Math.max(n.lastOpenedAt ?? 0, n.updatedAt ?? 0);
      return t >= start && t < end;
    })
    .sort((a, b) => Math.max(b.lastOpenedAt ?? 0, b.updatedAt ?? 0) - Math.max(a.lastOpenedAt ?? 0, a.updatedAt ?? 0))
    .slice(0, limit)
    .map(n => ({
      id: n.id,
      title: n.title,
      timestamp: Math.max(n.lastOpenedAt ?? 0, n.updatedAt ?? 0),
    }));
}

export function buildLastOpenedActivity(notes: readonly NoteBase[], limit = 5): ActivityNoteEntry[] {
  return activeNotes(notes)
    .filter(n => n.lastOpenedAt)
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    .slice(0, limit)
    .map(n => ({
      id: n.id,
      title: n.title,
      timestamp: n.lastOpenedAt ?? 0,
    }));
}

export function buildRecentEditedActivity(notes: readonly NoteBase[], limit = 5): ActivityNoteEntry[] {
  return activeNotes(notes)
    .filter(n => n.updatedAt)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, limit)
    .map(n => ({
      id: n.id,
      title: n.title,
      timestamp: n.updatedAt ?? 0,
    }));
}
