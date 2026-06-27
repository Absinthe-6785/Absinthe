import { authFetch } from './supabase';
import { API_URL } from './config';
import { shouldUseRemoteData } from './remoteBoundary';
import { applyEventToNote, readEventFromNote } from '../components/views/features/knowledge/trace/eventNotes';
import { useNotesStore } from '../store/useNotesStore';
import type { NoteBase } from '../components/views/noteUtils';

const MIGRATION_KEY = 'absinthe:dday-migration-v1';

interface LegacyDdayRow {
  id: string;
  text: string;
  date: string;
}

function normalizeCountdownKey(date: string, title: string): string {
  return `${date}:${title.trim().toLowerCase()}`;
}

function eventNoteExists(notes: readonly NoteBase[], date: string, title: string): boolean {
  const key = normalizeCountdownKey(date, title);
  return notes.some(note => {
    const event = readEventFromNote(note);
    if (!event) return false;
    return normalizeCountdownKey(event.eventDate, event.title) === key;
  });
}

/**
 * One-time migration: legacy schedules.is_dday rows → event notes, then delete legacy rows.
 * Idempotent — safe to call on every app boot; skips when flag is set or API returns empty.
 */
export async function migrateLegacyDdays(
  onMigrated?: (count: number) => void,
): Promise<number> {
  if (!shouldUseRemoteData()) {
    return 0;
  }

  if (typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATION_KEY)) {
    return 0;
  }

  try {
    const res = await authFetch(`${API_URL}/api/schedules/ddays`);
    if (!res.ok) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(MIGRATION_KEY, 'done');
      return 0;
    }

    const ddays = (await res.json()) as LegacyDdayRow[];
    if (!Array.isArray(ddays) || ddays.length === 0) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(MIGRATION_KEY, 'done');
      return 0;
    }

    let migrated = 0;
    const { createNote, updateNote } = useNotesStore.getState();

    for (const dday of ddays) {
      if (!dday.date || !dday.text?.trim()) continue;

      const currentNotes = useNotesStore.getState().notes;
      if (!eventNoteExists(currentNotes, dday.date, dday.text)) {
        const id = createNote({ title: dday.text.trim() });
        const created = useNotesStore.getState().notes.find(n => n.id === id);
        if (created) {
          const withEvent = applyEventToNote(created, {
            title: dday.text.trim(),
            eventDate: dday.date,
          });
          updateNote(id, {
            title: withEvent.title,
            properties: withEvent.properties,
          });
        }
      }

      await authFetch(`${API_URL}/api/schedules/${dday.id}`, { method: 'DELETE' });
      migrated++;
    }

    if (typeof localStorage !== 'undefined') localStorage.setItem(MIGRATION_KEY, 'done');
    if (migrated > 0) onMigrated?.(migrated);
    return migrated;
  } catch {
    return 0;
  }
}

/** Test helper — reset migration flag. */
export function resetDdayMigrationFlag(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(MIGRATION_KEY);
  }
}
