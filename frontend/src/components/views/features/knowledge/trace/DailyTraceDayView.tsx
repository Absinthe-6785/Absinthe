import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useTranslation } from '../../../../../lib/i18n';
import { toDateKey } from '../databaseViews/parseDatabaseDate';
import { buildDailyTraceProjection } from './buildDailyTraceProjection';
import type { TraceActivity } from './dailyTraceModels';
import {
  findDailyAnchorNote,
  formatTraceDayHeading,
  hasDailyTraceMarks,
  shiftDateKey,
} from './dailyTraceDayHelpers';

export interface DailyTraceDayViewProps {
  colors: NoteChromeColors;
  date: string;
  notes: readonly NoteBase[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onDateChange: (date: string) => void;
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

function groupActivities(activities: readonly TraceActivity[]) {
  const created = activities.filter(item => item.kind === 'created');
  const edited = activities.filter(item => item.kind === 'edited');
  return { created, edited };
}

export function DailyTraceDayView({
  colors: c,
  date,
  notes,
  activeNoteId,
  onSelectNote,
  onDateChange,
}: DailyTraceDayViewProps) {
  const { t } = useTranslation();
  const todayKey = toDateKey(new Date());
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const projection = useMemo(
    () => buildDailyTraceProjection(date, notes),
    [date, notes],
  );
  const dailyAnchor = useMemo(
    () => findDailyAnchorNote(notes, date),
    [notes, date],
  );
  const { created, edited } = useMemo(
    () => groupActivities(projection.activities),
    [projection.activities],
  );
  const hasMarks = hasDailyTraceMarks(projection, dailyAnchor);

  const goPreviousDay = () => onDateChange(shiftDateKey(date, -1));
  const goNextDay = () => onDateChange(shiftDateKey(date, 1));

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
          {formatTraceDayHeading(date)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <button type="button" className="btbtn" onClick={goPreviousDay} title={t('traceNavPrevDay')}>
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="bwbg"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onDateChange(todayKey)}
          >
            {t('traceNavToday')}
          </button>
          <button
            type="button"
            className="bwbg"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onDateChange(yesterdayKey)}
          >
            {t('traceNavYesterday')}
          </button>
          <input
            type="date"
            className="bwi"
            value={date}
            onChange={e => {
              if (e.target.value) onDateChange(e.target.value);
            }}
            style={{ fontSize: 10, padding: '2px 6px', maxWidth: 130 }}
            aria-label="Select date"
          />
          <button type="button" className="btbtn" onClick={goNextDay} title={t('traceNavNextDay')}>
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
          {t('traceEmptyDay')}
        </div>
      ) : (
        <>
          {projection.milestones.length > 0 && (
            <TraceSection colors={c} title={t('traceSectionMilestones')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {projection.milestones.map(item => (
                  <TraceNoteButton
                    key={`milestone-${item.noteId}`}
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
            <TraceSection colors={c} title={t('traceSectionEvents')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {projection.events.map(item => (
                  <TraceNoteButton
                    key={`event-${item.noteId}`}
                    colors={c}
                    active={item.noteId === activeNoteId}
                    prefix={item.time}
                    title={item.title}
                    onClick={() => onSelectNote(item.noteId)}
                  />
                ))}
              </div>
            </TraceSection>
          )}

          {projection.activities.length > 0 && (
            <TraceSection colors={c} title={t('traceSectionActivityShort')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {created.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted }}>Created</div>
                    {created.map(item => (
                      <TraceNoteButton
                        key={`created-${item.noteId}`}
                        colors={c}
                        active={item.noteId === activeNoteId}
                        prefix="•"
                        title={item.title}
                        onClick={() => onSelectNote(item.noteId)}
                      />
                    ))}
                  </div>
                )}
                {edited.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted }}>Edited</div>
                    {edited.map(item => (
                      <TraceNoteButton
                        key={`edited-${item.noteId}`}
                        colors={c}
                        active={item.noteId === activeNoteId}
                        prefix="•"
                        title={item.title}
                        onClick={() => onSelectNote(item.noteId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TraceSection>
          )}

          {dailyAnchor && (
            <TraceSection colors={c} title={t('traceSectionDailyNote')}>
              <TraceNoteButton
                colors={c}
                active={dailyAnchor.id === activeNoteId}
                title={`[[${dailyAnchor.title}]]`}
                onClick={() => onSelectNote(dailyAnchor.id)}
              />
            </TraceSection>
          )}
        </>
      )}
    </div>
  );
}
