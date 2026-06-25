import { Archive, CalendarDays, FileText, Search, StickyNote } from 'lucide-react';
import type { NoteBase } from '../../noteUtils';
import { noteSearchScore } from '../../../../lib/math/noteSearch';
import type { ExerciseBlock, Schedule, Theme, WeeklySchedule } from '../../../../types';
import type { RangeWorkoutRow } from './workout/workoutMetrics';
import { useTranslation } from '../../../../lib/i18n';

export interface HealthConnectionsPanelProps {
  dateLabel: string;
  exercises: readonly ExerciseBlock[];
  notes: readonly NoteBase[];
  schedules: readonly Schedule[];
  weeklySchedules: readonly WeeklySchedule[];
  monthWorkouts: readonly RangeWorkoutRow[];
  theme: Theme;
  darkMode: boolean;
  onOpenDayNote: () => void;
  onOpenNote: (noteId: string) => void;
  onOpenSchedule: () => void;
  onOpenArchive: () => void;
  onOpenSearch: () => void;
}

function includesAny(text: string, terms: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some(term => term && lower.includes(term.toLowerCase()));
}

function compactDate(date: string): string {
  return date.slice(5) || date;
}

export function HealthConnectionsPanel({
  dateLabel,
  exercises,
  notes,
  schedules,
  weeklySchedules,
  monthWorkouts,
  theme,
  darkMode,
  onOpenDayNote,
  onOpenNote,
  onOpenSchedule,
  onOpenArchive,
  onOpenSearch,
}: HealthConnectionsPanelProps) {
  const { t } = useTranslation();
  const exerciseNames = exercises.map(e => e.name).filter(Boolean);
  const searchTerms = [dateLabel, ...exerciseNames, 'workout', 'training', 'program'];

  const relatedNotes = notes
    .filter(note => !note.deletedAt)
    .map(note => {
      const scores = searchTerms
        .map(term => noteSearchScore(note, term))
        .filter((score): score is number => score !== null);
      return scores.length > 0
        ? { note, score: Math.min(...scores) }
        : null;
    })
    .filter((row): row is { note: NoteBase; score: number } => !!row)
    .sort((a, b) => a.score - b.score || b.note.updatedAt - a.note.updatedAt)
    .slice(0, 3);

  const scheduleTerms = ['workout', 'training', 'gym', 'exercise', ...exerciseNames];
  const linkedSchedules = schedules
    .filter(s => includesAny(`${s.text} ${s.category}`, scheduleTerms))
    .slice(0, 2);
  const day = new Date(`${dateLabel}T12:00:00`).getDay();
  const linkedWeekly = weeklySchedules
    .filter(s => s.day === day && includesAny(s.title, scheduleTerms))
    .slice(0, 2);

  const previousSessions = monthWorkouts
    .filter(row => row.date && row.date < dateLabel && includesAny(row.exercise_blocks?.name ?? '', exerciseNames))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 3);

  const chipClass = `inline-flex min-h-[34px] max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${theme.border} ${theme.textMuted} hover:text-foreground`;

  return (
    <div className={`rounded-xl border px-3 py-2 ${theme.border} ${darkMode ? 'bg-surface/45' : 'bg-gray-50/60'}`} data-k130a-health-connections data-k134a-health-connections-support>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide">{t('healthConnectionsTitle')}</p>
          <p className={`text-[10px] font-medium ${theme.textMuted}`}>{t('healthConnectionsSubtitle')}</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <button type="button" onClick={onOpenDayNote} className={chipClass}><StickyNote size={12} />{t('healthConnectionNotesChip')}</button>
          <button type="button" onClick={onOpenSchedule} className={chipClass}><CalendarDays size={12} />{t('healthConnectionScheduleChip')}</button>
          <button type="button" onClick={onOpenArchive} className={chipClass}><Archive size={12} />{t('healthConnectionArchiveChip')}</button>
          <button type="button" onClick={onOpenSearch} className={chipClass}><Search size={12} />{t('healthConnectionSearchChip')}</button>
        </div>
      </div>

      <div className={`mt-2 grid gap-2 border-t pt-2 ${theme.border} lg:grid-cols-3`}>
        <div className="min-w-0" data-k130a-related-notes>
          <p className={`mb-1 text-[10px] font-black uppercase tracking-wide ${theme.textMuted}`}>{t('healthRelatedNotes')}</p>
          {relatedNotes.length > 0 ? relatedNotes.map(({ note }) => (
            <button key={note.id} type="button" onClick={() => onOpenNote(note.id)} className={`flex w-full items-center gap-1.5 rounded-lg py-0.5 text-left text-xs font-bold hover:bg-muted/40 ${theme.text}`}>
              <FileText size={12} className="shrink-0" />
              <span className="truncate">{note.title || t('untitledNote')}</span>
            </button>
          )) : (
            <p className={`text-xs font-medium ${theme.textMuted}`}>{t('healthNoRelatedNotes')}</p>
          )}
        </div>

        <div className="min-w-0" data-k130a-schedule-connections>
          <p className={`mb-1 text-[10px] font-black uppercase tracking-wide ${theme.textMuted}`}>{t('healthLinkedSchedule')}</p>
          {[...linkedSchedules.map(s => `${s.start_time}-${s.end_time} ${s.text}`), ...linkedWeekly.map(s => `${s.start_time}-${s.end_time} ${s.title}`)].slice(0, 3).map(item => (
            <button key={item} type="button" onClick={onOpenSchedule} className={`block w-full truncate rounded-lg py-0.5 text-left text-xs font-bold hover:bg-muted/40 ${theme.text}`}>
              {item}
            </button>
          ))}
          {linkedSchedules.length === 0 && linkedWeekly.length === 0 ? (
            <p className={`text-xs font-medium ${theme.textMuted}`}>{t('healthNoLinkedSchedules')}</p>
          ) : null}
        </div>

        <div className="min-w-0" data-k130a-archive-awareness>
          <p className={`mb-1 text-[10px] font-black uppercase tracking-wide ${theme.textMuted}`}>{t('healthArchiveAwareness')}</p>
          {previousSessions.length > 0 ? previousSessions.map(row => (
            <button key={`${row.date}-${row.block_id}`} type="button" onClick={onOpenArchive} className={`block w-full truncate rounded-lg py-0.5 text-left text-xs font-bold hover:bg-muted/40 ${theme.text}`}>
              {compactDate(row.date ?? '')} - {row.exercise_blocks?.name}
            </button>
          )) : (
            <p className={`text-xs font-medium ${theme.textMuted}`}>{t('healthNoArchiveReferences')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
