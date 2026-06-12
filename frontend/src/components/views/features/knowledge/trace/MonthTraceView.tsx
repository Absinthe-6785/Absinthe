import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { buildMonthTraceProjection, formatTraceMonthHeading, hasMonthTraceMarks, shiftTraceMonth } from './buildMonthTraceProjection';
import type { TraceMonthKey } from './buildMonthTraceProjection';

export interface MonthTraceViewProps {
  colors: NoteChromeColors;
  month: TraceMonthKey;
  notes: readonly NoteBase[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onMonthChange: (month: TraceMonthKey) => void;
}

function TraceSection({
  colors: c,
  title,
  children,
}: {
  colors: NoteChromeColors;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h3 style={{
        margin: 0,
        fontSize: 10,
        fontWeight: 700,
        color: c.textMuted,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function TraceNoteButton({
  colors: c,
  active,
  prefix,
  title,
  onClick,
}: {
  colors: NoteChromeColors;
  active: boolean;
  prefix?: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: active ? c.cardAct : 'transparent',
        border: active ? `1px solid ${c.cardActBdr}` : '1px solid transparent',
        borderRadius: 6,
        padding: '5px 8px',
        cursor: 'pointer',
        color: c.text,
        fontSize: 12,
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
      }}
    >
      {prefix && (
        <span style={{ color: c.textMuted, flexShrink: 0, fontSize: 11 }}>{prefix}</span>
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
    </button>
  );
}

export function MonthTraceView({
  colors: c,
  month,
  notes,
  activeNoteId,
  onSelectNote,
  onMonthChange,
}: MonthTraceViewProps) {
  const currentMonth = useMemo(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  }, []);

  const projection = useMemo(
    () => buildMonthTraceProjection(month.year, month.month, notes),
    [month.year, month.month, notes],
  );

  const hasMarks = hasMonthTraceMarks(projection);

  const goPreviousMonth = () => onMonthChange(shiftTraceMonth(month.year, month.month, -1));
  const goNextMonth = () => onMonthChange(shiftTraceMonth(month.year, month.month, 1));

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      background: c.notelist,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
          {formatTraceMonthHeading(month.year, month.month)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <button type="button" className="btbtn" onClick={goPreviousMonth} title="Previous month">
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="bwbg"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onMonthChange(currentMonth)}
          >
            This Month
          </button>
          <input
            type="month"
            className="bwi"
            value={projection.month}
            onChange={e => {
              const match = /^(\d{4})-(\d{2})$/.exec(e.target.value);
              if (!match) return;
              onMonthChange({ year: Number(match[1]), month: Number(match[2]) });
            }}
            style={{ fontSize: 10, padding: '2px 6px', maxWidth: 130 }}
            aria-label="Select month"
          />
          <button type="button" className="btbtn" onClick={goNextMonth} title="Next month">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {!hasMarks ? (
        <div style={{
          padding: '24px 12px',
          textAlign: 'center',
          color: c.textFaint,
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          No traces recorded for this month.
        </div>
      ) : (
        <>
          {projection.milestones.length > 0 && (
            <TraceSection colors={c} title="Milestones">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {projection.milestones.map(item => (
                  <TraceNoteButton
                    key={`milestone-${item.noteId}-${item.date}`}
                    colors={c}
                    active={item.noteId === activeNoteId}
                    prefix="●"
                    title={item.label}
                    onClick={() => onSelectNote(item.noteId)}
                  />
                ))}
              </div>
            </TraceSection>
          )}

          {projection.events.length > 0 && (
            <TraceSection colors={c} title="Events">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {projection.events.map(item => (
                  <TraceNoteButton
                    key={`event-${item.noteId}`}
                    colors={c}
                    active={item.noteId === activeNoteId}
                    prefix="•"
                    title={item.title}
                    onClick={() => onSelectNote(item.noteId)}
                  />
                ))}
              </div>
            </TraceSection>
          )}

          {(projection.activityOverview.notesTouched > 0
            || projection.activityOverview.notesCreated > 0) && (
            <TraceSection colors={c} title="Activity Overview">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: c.textMuted }}>
                {projection.activityOverview.notesTouched > 0 && (
                  <div>{projection.activityOverview.notesTouched} notes touched</div>
                )}
                {projection.activityOverview.notesCreated > 0 && (
                  <div>{projection.activityOverview.notesCreated} notes created</div>
                )}
              </div>
            </TraceSection>
          )}
        </>
      )}
    </div>
  );
}
