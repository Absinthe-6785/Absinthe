import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase } from '../noteUtils';
import { useTranslation } from '../../../lib/i18n';
import type { ListDensityMode } from '../listDensityPreference';
import { listDensityStyles } from '../listDensityPreference';
import {
  formatDailyNoteLabel,
  hasDailyNote,
  openOrCreateDailyNote,
  shiftDateKey,
} from '../k101DailyNote';

export interface K101DailyNoteSectionProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  todayKey: string;
  activeNoteId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  listDensity: ListDensityMode;
  createNote: (opts: { title: string; body: string }) => string | void;
  setActiveNoteId: (id: string) => void;
}

export function K101DailyNoteSection({
  colors: c,
  notes,
  todayKey,
  activeNoteId,
  collapsed,
  onToggleCollapse,
  listDensity,
  createNote,
  setActiveNoteId,
}: K101DailyNoteSectionProps) {
  const { t } = useTranslation();
  const densityStyle = listDensityStyles(listDensity);
  const todayExists = hasDailyNote(notes, todayKey);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const tomorrowKey = shiftDateKey(todayKey, 1);
  const todayLabel = formatDailyNoteLabel(todayKey);

  const openDay = (dateKey: string) => {
    openOrCreateDailyNote({ notes, dateKey, createNote, setActiveNoteId });
  };

  const todayAnchor = notes.find(n => !n.deletedAt && n.title.trim() === todayKey);
  const isTodayActive = todayAnchor?.id === activeNoteId;

  return (
    <div data-k101-daily-note-section>
      <div
        className="bseclbl k101-interactive"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={onToggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleCollapse();
          }
        }}
        data-k101-daily-note-toggle
      >
        <span>{t('k101DailyNote')}</span>
        <ChevronDown
          size={10}
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform .15s',
          }}
        />
      </div>
      {!collapsed ? (
        <>
          <div
            className={`bfi k101-interactive ${isTodayActive ? 'active k101-selected' : ''}`}
            onClick={() => openDay(todayKey)}
            style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding }}
            data-k101-daily-note-today
          >
            <span style={{ flex: 1, fontWeight: 600 }}>{todayLabel}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 999,
                padding: '1px 6px',
                background: todayExists ? c.accentBg : c.badge,
                color: todayExists ? c.accent : c.badgeTxt,
                flexShrink: 0,
              }}
              data-k101-daily-note-badge={todayExists ? 'exists' : 'new'}
            >
              {todayExists ? t('k101DailyNoteExists') : t('k101DailyNoteNew')}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '2px 8px 6px',
            }}
            data-k101-daily-note-jump
          >
            <button
              type="button"
              className="btbtn k101-interactive"
              onClick={() => openDay(yesterdayKey)}
              style={{
                flex: 1,
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '4px 6px',
                minHeight: densityStyle.traceRowMinHeight,
              }}
              title={formatDailyNoteLabel(yesterdayKey)}
            >
              <ChevronLeft size={10} />
              {t('nvYesterday')}
            </button>
            <button
              type="button"
              className="btbtn k101-interactive"
              onClick={() => openDay(tomorrowKey)}
              style={{
                flex: 1,
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '4px 6px',
                minHeight: densityStyle.traceRowMinHeight,
              }}
              title={formatDailyNoteLabel(tomorrowKey)}
            >
              {t('k101Tomorrow')}
              <ChevronRight size={10} />
            </button>
          </div>
        </>
      ) : (
        <div
          className="bfi"
          style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding, color: c.textMuted }}
          data-k101-daily-note-collapsed-summary
        >
          <span style={{ flex: 1 }}>{todayLabel}</span>
          {todayExists ? (
            <span style={{ fontSize: 9, color: c.accent, fontWeight: 700 }}>{t('k101DailyNoteExists')}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
