import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';
import {
  calendarBucketsToMap,
  NO_DATE_KEY,
  type CalendarDateBucket,
} from '../databaseViews/bucketNotesByDate';
import {
  addMonths,
  buildCalendarMonthGrid,
  formatCalendarMonthLabel,
} from '../databaseViews/parseDatabaseDate';

export interface DatabaseCalendarViewProps {
  colors: NoteChromeColors;
  buckets: readonly CalendarDateBucket[];
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CalendarCard({
  note,
  colors: c,
  service,
  isActive,
  onSelect,
}: {
  note: NoteBase;
  colors: NoteChromeColors;
  service: KnowledgeIndexService;
  isActive: boolean;
  onSelect: () => void;
}) {
  const title = getDatabaseFieldValue(note, 'title', service);
  const tags = getDatabaseFieldValue(note, 'tags', service);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: isActive ? `${c.accent}15` : c.card,
        border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
        borderRadius: 4,
        padding: '3px 4px',
        marginBottom: 3,
        cursor: 'pointer',
        color: c.text,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      {tags && (
        <div style={{ fontSize: 8, color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tags}
        </div>
      )}
    </button>
  );
}

export function DatabaseCalendarView({
  colors: c,
  buckets,
  service,
  activeNoteId,
  onSelectNote,
}: DatabaseCalendarViewProps) {
  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);

  const bucketMap = useMemo(() => calendarBucketsToMap(buckets), [buckets]);
  const noDateNotes = bucketMap.get(NO_DATE_KEY) ?? [];
  const monthGrid = useMemo(
    () => buildCalendarMonthGrid(visibleYear, visibleMonth),
    [visibleYear, visibleMonth],
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

  const goToCurrentMonth = () => {
    goToMonth(today.getFullYear(), today.getMonth() + 1);
  };

  const hasScheduledNotes = buckets.some(bucket => bucket.dateKey !== NO_DATE_KEY && bucket.notes.length > 0);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.notelist, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="btbtn" onClick={goPreviousMonth} title="Previous month">
          <ChevronLeft size={14} />
        </button>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.text, textAlign: 'center', flex: 1 }}>
          {formatCalendarMonthLabel(visibleYear, visibleMonth)}
        </div>
        <button type="button" className="btbtn" onClick={goNextMonth} title="Next month">
          <ChevronRight size={14} />
        </button>
        <button type="button" className="bwbg" style={{ fontSize: 9, padding: '2px 6px' }} onClick={goToCurrentMonth}>
          Today
        </button>
      </div>

      {!hasScheduledNotes && noDateNotes.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: c.textFaint, fontSize: 12 }}>
          No matching notes
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 4,
          }}>
            {WEEKDAY_LABELS.map(label => (
              <div key={label} style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, textAlign: 'center', padding: '2px 0' }}>
                {label}
              </div>
            ))}
            {monthGrid.map(cell => {
              const notes = bucketMap.get(cell.dateKey) ?? [];
              return (
                <div
                  key={cell.dateKey}
                  style={{
                    minHeight: 72,
                    background: cell.inMonth ? c.toolbar : c.cardHov,
                    border: `1px solid ${c.sideBdr}`,
                    borderRadius: 6,
                    padding: 4,
                    opacity: cell.inMonth ? 1 : 0.55,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, marginBottom: 3 }}>
                    {cell.day}
                  </div>
                  {notes.map(note => (
                    <CalendarCard
                      key={note.id}
                      note={note}
                      colors={c}
                      service={service}
                      isActive={note.id === activeNoteId}
                      onSelect={() => onSelectNote(note.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {noDateNotes.length > 0 && (
            <div style={{
              borderTop: `1px solid ${c.sideBdr}`,
              paddingTop: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>
                No Date ({noDateNotes.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {noDateNotes.map(note => (
                  <CalendarCard
                    key={note.id}
                    note={note}
                    colors={c}
                    service={service}
                    isActive={note.id === activeNoteId}
                    onSelect={() => onSelectNote(note.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
