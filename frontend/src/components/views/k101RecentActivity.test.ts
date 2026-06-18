import { describe, expect, it } from 'vitest';
import {
  buildActivityToday,
  buildLastOpenedActivity,
  buildRecentEditedActivity,
} from './k101RecentActivity';
import type { NoteBase } from './noteUtils';

function note(id: string, title: string, updatedAt: number, lastOpenedAt?: number): NoteBase {
  return { id, title, body: '', folderId: null, deletedAt: null, updatedAt, lastOpenedAt };
}

describe('k101RecentActivity', () => {
  const todayKey = '2026-06-18';
  const dayStart = new Date(`${todayKey}T15:00:00`).getTime();

  it('builds today and last-opened lists', () => {
    const notes = [
      note('a', 'A', dayStart, dayStart),
      note('b', 'B', 1, 2),
    ];
    expect(buildActivityToday(notes, todayKey).map(n => n.id)).toContain('a');
    expect(buildLastOpenedActivity(notes)[0]?.id).toBe('a');
    expect(buildRecentEditedActivity(notes)[0]?.id).toBe('a');
  });
});
