import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveIntlLocale, useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseEmptyMessage } from '../databaseViews/databasePresentationMeta';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';
import {
  addMonths,
  formatCalendarMonthLabel,
} from '../databaseViews/parseDatabaseDate';
import {
  daysInMonth,
  formatTimelineDateRange,
  timelineItemOverlapsMonth,
  type TimelineItem,
} from '../databaseViews/timelineModels';

export interface DatabaseTimelineViewProps {
  colors: NoteChromeColors;
  items: readonly TimelineItem[];
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

export function DatabaseTimelineView({
  colors: c,
  items,
  service,
  activeNoteId,
  onSelectNote,
}: DatabaseTimelineViewProps) {
  const { t, lang } = useTranslation();
  const intlLocale = resolveIntlLocale(lang);
  const emptyMessage = getDatabaseEmptyMessage(lang);
  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);

  const visibleItems = useMemo(
    () => items.filter(item => timelineItemOverlapsMonth(item, visibleYear, visibleMonth)),
    [items, visibleYear, visibleMonth],
  );

  const dayCount = daysInMonth(visibleYear, visibleMonth);
  const dayNumbers = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => index + 1),
    [dayCount],
  );

  const goToMonth = (year: number, month: number) => {
    setVisibleYear(year);
    setVisibleMonth(month);
  };

  const goPreviousMonth = () => {
    const next = addMonths(visibleYear, visibleMonth, -1);
    goToMonth(next.year, next.month);
  };

  const goNextMonth = () => {
    const next = addMonths(visibleYear, visibleMonth, 1);
    goToMonth(next.year, next.month);
  };

  const goToToday = () => {
    goToMonth(today.getFullYear(), today.getMonth() + 1);
  };

  const todayDay = today.getFullYear() === visibleYear && today.getMonth() + 1 === visibleMonth
    ? today.getDate()
    : null;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.notelist, padding: 8 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
      }}>
        <button type="button" className="btbtn" onClick={goPreviousMonth} aria-label="Previous month">
          <ChevronLeft size={14} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: c.text }}>
          {formatCalendarMonthLabel(visibleYear, visibleMonth, intlLocale)}
        </div>
        <button type="button" className="btbtn" onClick={goNextMonth} aria-label="Next month">
          <ChevronRight size={14} />
        </button>
        <button type="button" className="bwbg" style={{ fontSize: 10, padding: '2px 8px' }} onClick={goToToday}>
          Today
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 8,
        borderBottom: `1px solid ${c.sideBdr}`,
      }}>
        {dayNumbers.map(day => (
          <div
            key={day}
            style={{
              flex: '0 0 28px',
              textAlign: 'center',
              fontSize: 9,
              color: day === todayDay ? c.accent : c.textMuted,
              fontWeight: day === todayDay ? 700 : 500,
              padding: '4px 0',
              borderRadius: 4,
              background: day === todayDay ? `${c.accent}15` : 'transparent',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: c.textFaint, fontSize: 12 }}>
          {items.length === 0 ? emptyMessage : t('dbTimelineEmptyMonth')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibleItems.map(item => {
            const tags = getDatabaseFieldValue(item.note, 'tags', service);
            const isActive = item.noteId === activeNoteId;
            return (
              <button
                key={item.noteId}
                type="button"
                onClick={() => onSelectNote(item.noteId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: isActive ? `${c.accent}15` : c.card,
                  border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  color: c.text,
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: 9, color: c.accent, whiteSpace: 'nowrap' }}>
                    {formatTimelineDateRange(item.startDate, item.endDate)}
                  </span>
                </div>
                {tags && (
                  <div style={{
                    fontSize: 9,
                    color: c.textMuted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {tags}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
