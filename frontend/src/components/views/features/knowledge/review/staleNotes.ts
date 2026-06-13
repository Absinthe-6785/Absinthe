import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { ReviewNoteEntry } from './buildKnowledgeReview';

export const STALE_DAY_THRESHOLDS = [30, 60, 90] as const;
export type StaleDayTier = typeof STALE_DAY_THRESHOLDS[number];

export interface StaleNotesBuckets {
  /** 30–59 days without open + edit */
  days30: ReviewNoteEntry[];
  /** 60–89 days */
  days60: ReviewNoteEntry[];
  /** 90+ days */
  days90: ReviewNoteEntry[];
}

export interface BuildStaleNotesOptions {
  limitPerTier?: number;
  activeOnly?: boolean;
  now?: number;
}

const MS_PER_DAY = 86_400_000;

export function daysSince(timestamp: number, now: number): number {
  return Math.floor(Math.max(0, now - timestamp) / MS_PER_DAY);
}

/** Last time the note was opened — falls back to updatedAt for legacy notes. */
export function noteLastOpenedAt(note: NoteBase): number {
  return note.lastOpenedAt ?? note.updatedAt;
}

/** Stale when neither opened nor edited within threshold days. */
export function isStaleNote(note: NoteBase, thresholdDays: number, now = Date.now()): boolean {
  if (note.deletedAt) return false;
  if (!(note.body ?? '').trim() && !(note.title ?? '').trim()) return false;
  const openedDays = daysSince(noteLastOpenedAt(note), now);
  const editedDays = daysSince(note.updatedAt, now);
  return openedDays >= thresholdDays && editedDays >= thresholdDays;
}

export function staleTierForNote(note: NoteBase, now = Date.now()): StaleDayTier | null {
  if (isStaleNote(note, 90, now)) return 90;
  if (isStaleNote(note, 60, now)) return 60;
  if (isStaleNote(note, 30, now)) return 30;
  return null;
}

function toStaleEntry(note: NoteBase, now: number): ReviewNoteEntry {
  const openedDays = daysSince(noteLastOpenedAt(note), now);
  const editedDays = daysSince(note.updatedAt, now);
  return {
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    metric: Math.max(openedDays, editedDays),
    meta: `열기 ${openedDays}일 · 수정 ${editedDays}일 전`,
  };
}

export function buildStaleNotesBuckets(
  notes: readonly NoteBase[],
  opts: BuildStaleNotesOptions = {},
): StaleNotesBuckets {
  const limit = opts.limitPerTier ?? 8;
  const activeOnly = opts.activeOnly !== false;
  const now = opts.now ?? Date.now();

  const buckets: StaleNotesBuckets = { days30: [], days60: [], days90: [] };

  for (const note of notes) {
    if (activeOnly && note.deletedAt) continue;
    const tier = staleTierForNote(note, now);
    if (!tier) continue;
    const entry = toStaleEntry(note, now);
    if (tier === 30) buckets.days30.push(entry);
    else if (tier === 60) buckets.days60.push(entry);
    else buckets.days90.push(entry);
  }

  const sortByMetric = (a: ReviewNoteEntry, b: ReviewNoteEntry) => b.metric - a.metric;
  buckets.days30.sort(sortByMetric).splice(limit);
  buckets.days60.sort(sortByMetric).splice(limit);
  buckets.days90.sort(sortByMetric).splice(limit);

  return buckets;
}

export function countStaleNotes(notes: readonly NoteBase[], minDays = 30, now = Date.now()): number {
  return notes.filter(n => !n.deletedAt && isStaleNote(n, minDays, now)).length;
}
