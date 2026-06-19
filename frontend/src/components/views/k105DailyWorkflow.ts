import { switchToTab } from '../../lib/noteNavigation';
import { useNotesStore } from '../../store/useNotesStore';
import { toDateKey } from './features/knowledge/databaseViews/parseDatabaseDate';
import { openOrCreateDailyNote } from './k101DailyNote';

/** K-105 — open or create today's daily note and switch to Notes tab. */
export function openTodaysDailyNoteFromApp(): void {
  const store = useNotesStore.getState();
  const todayKey = toDateKey(new Date());
  if (!todayKey) return;
  openOrCreateDailyNote({
    notes: store.notes,
    dateKey: todayKey,
    createNote: opts => store.createNote({ title: opts.title, body: opts.body }),
    setActiveNoteId: id => store.setActiveNoteId(id),
  });
  switchToTab('note');
}
