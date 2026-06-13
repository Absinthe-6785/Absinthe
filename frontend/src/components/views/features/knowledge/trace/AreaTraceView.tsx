import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { AreaRangeTraceProjection, AreaTraceProjection } from './areaTraceModels';
import {
  buildAreaRangeLensProjection,
  buildAreaRangeTraceProjection,
  hasAreaRangeTraceMarks,
} from './buildAreaRangeTraceProjection';
import {
  buildAreaTraceProjection,
  hasAreaTraceMarks,
} from './buildAreaTraceProjection';
import {
  currentTraceMonth,
  currentTraceQuarter,
  currentTraceYear,
  enumerateDateKeys,
  formatRangeLensHeading,
  shiftTraceMonth,
  shiftTraceQuarter,
  shiftTraceYear,
  toMonthKey,
} from './buildRangeTraceProjection';
import type { TraceRangeLens } from './rangeTraceModels';
import { useTranslation } from '../../../../../lib/i18n';

export interface AreaTraceViewProps {
  colors: NoteChromeColors;
  areaNoteId: string;
  areaRange: TraceRangeLens | null;
  notes: readonly NoteBase[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onAreaRangeChange: (range: TraceRangeLens | null) => void;
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

function isCustomRangeReady(range: TraceRangeLens): boolean {
  if (range.kind !== 'custom') return true;
  if (!range.startDate.trim() || !range.endDate.trim()) return false;
  try {
    enumerateDateKeys(range.startDate, range.endDate);
    return true;
  } catch {
    return false;
  }
}

function AreaTraceBody({
  colors: c,
  projection,
  areaRange,
  activeNoteId,
  onSelectNote,
}: {
  colors: NoteChromeColors;
  projection: AreaTraceProjection | AreaRangeTraceProjection;
  areaRange: TraceRangeLens | null;
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}) {
  const { t } = useTranslation();
  const activity = 'notesTouched' in projection
    ? { notesTouched: projection.notesTouched, notesCreated: projection.notesCreated }
    : null;

  return (
    <>
      {projection.milestones.length > 0 && (
        <TraceSection colors={c} title={t('traceSectionMilestones')}>
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
        <TraceSection colors={c} title={t('traceSectionEvents')}>
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

      {areaRange && activity && (activity.notesTouched > 0 || activity.notesCreated > 0) && (
        <TraceSection colors={c} title={t('traceSectionActivity')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: c.textMuted }}>
            {activity.notesTouched > 0 && (
              <div>{activity.notesTouched} notes touched</div>
            )}
            {activity.notesCreated > 0 && (
              <div>{activity.notesCreated} notes created</div>
            )}
          </div>
        </TraceSection>
      )}

      {projection.linkedNotes.length > 0 && (
        <TraceSection colors={c} title={t('traceSectionLinkedNotes')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {projection.linkedNotes.map(item => (
              <TraceNoteButton
                key={`linked-${item.noteId}`}
                colors={c}
                active={item.noteId === activeNoteId}
                title={item.title}
                onClick={() => onSelectNote(item.noteId)}
              />
            ))}
          </div>
        </TraceSection>
      )}
    </>
  );
}

export function AreaTraceView({
  colors: c,
  areaNoteId,
  areaRange,
  notes,
  activeNoteId,
  onSelectNote,
  onAreaRangeChange,
}: AreaTraceViewProps) {
  const { t } = useTranslation();
  const currentMonth = useMemo(() => currentTraceMonth(), []);
  const currentQuarter = useMemo(() => currentTraceQuarter(), []);
  const currentYear = useMemo(() => currentTraceYear(), []);

  const [customDraft, setCustomDraft] = useState(() => ({
    startDate: areaRange?.kind === 'custom' ? areaRange.startDate : '',
    endDate: areaRange?.kind === 'custom' ? areaRange.endDate : '',
    label: areaRange?.kind === 'custom' ? (areaRange.label ?? '') : '',
  }));
  const [customError, setCustomError] = useState<string | null>(null);

  const projection = useMemo(() => {
    if (areaRange && (areaRange.kind !== 'custom' || isCustomRangeReady(areaRange))) {
      try {
        return buildAreaRangeLensProjection(areaNoteId, areaRange, notes);
      } catch {
        return null;
      }
    }
    try {
      return buildAreaTraceProjection(areaNoteId, notes);
    } catch {
      return null;
    }
  }, [areaNoteId, areaRange, notes]);

  function isAreaRangeProjection(
    value: AreaTraceProjection | AreaRangeTraceProjection,
  ): value is AreaRangeTraceProjection {
    return 'startDate' in value && 'endDate' in value;
  }

  const hasMarks = projection
    ? (isAreaRangeProjection(projection) ? hasAreaRangeTraceMarks(projection) : hasAreaTraceMarks(projection))
    : false;

  const handleCustomGenerate = () => {
    try {
      buildAreaRangeTraceProjection(areaNoteId, customDraft.startDate, customDraft.endDate, notes);
      setCustomError(null);
      onAreaRangeChange({
        kind: 'custom',
        startDate: customDraft.startDate,
        endDate: customDraft.endDate,
        label: customDraft.label.trim() || undefined,
      });
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : t('traceInvalidRange'));
    }
  };

  const renderRangeNav = () => {
    if (!areaRange) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="bwbg"
            style={{ fontSize: 10, padding: '2px 8px', background: c.cardAct }}
            onClick={() => onAreaRangeChange(null)}
          >
            {t('traceAllTime')}
          </button>
          <button
            type="button"
            className="bwbg"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onAreaRangeChange({ kind: 'month', ...currentMonth })}
          >
            {t('traceNavThisMonth')}
          </button>
          <button
            type="button"
            className="bwbg"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onAreaRangeChange({ kind: 'quarter', ...currentQuarter })}
          >
            {t('nvThisQuarter')}
          </button>
          <button
            type="button"
            className="bwbg"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onAreaRangeChange({ kind: 'year', year: currentYear })}
          >
            {t('traceNavThisYear')}
          </button>
          <button
            type="button"
            className="bwbg"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onAreaRangeChange({ kind: 'custom', startDate: '', endDate: '', label: '' })}
          >
            {t('traceCustomRange')}
          </button>
        </div>
      );
    }

    if (areaRange.kind === 'custom' && !isCustomRangeReady(areaRange)) {
      return null;
    }

    switch (areaRange.kind) {
      case 'month': {
        const monthKey = toMonthKey(areaRange.year, areaRange.month);
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button type="button" className="bwbg" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => onAreaRangeChange(null)}>
              {t('traceAllTime')}
            </button>
            <button type="button" className="btbtn" onClick={() => onAreaRangeChange(shiftTraceMonth(areaRange.year, areaRange.month, -1))} title={t('traceNavPrevMonth')}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" className="bwbg" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => onAreaRangeChange({ kind: 'month', ...currentMonth })}>
              {t('traceNavThisMonth')}
            </button>
            <input
              type="month"
              className="bwi"
              value={monthKey}
              onChange={e => {
                const match = /^(\d{4})-(\d{2})$/.exec(e.target.value);
                if (!match) return;
                onAreaRangeChange({ kind: 'month', year: Number(match[1]), month: Number(match[2]) });
              }}
              style={{ fontSize: 10, padding: '2px 6px', maxWidth: 130 }}
              aria-label={t('traceSelectMonth')}
            />
            <button type="button" className="btbtn" onClick={() => onAreaRangeChange(shiftTraceMonth(areaRange.year, areaRange.month, 1))} title={t('traceNavNextMonth')}>
              <ChevronRight size={14} />
            </button>
          </div>
        );
      }
      case 'quarter':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button type="button" className="bwbg" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => onAreaRangeChange(null)}>
              {t('traceAllTime')}
            </button>
            <button type="button" className="btbtn" onClick={() => onAreaRangeChange(shiftTraceQuarter(areaRange.year, areaRange.quarter, -1))} title={t('traceNavPrevQuarter')}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" className="bwbg" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => onAreaRangeChange({ kind: 'quarter', ...currentQuarter })}>
              {t('nvThisQuarter')}
            </button>
            <select
              className="bwi"
              value={areaRange.quarter}
              onChange={e => onAreaRangeChange({ kind: 'quarter', year: areaRange.year, quarter: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              style={{ fontSize: 10, padding: '2px 6px' }}
              aria-label={t('traceSelectQuarter')}
            >
              {[1, 2, 3, 4].map(q => (
                <option key={q} value={q}>Q{q}</option>
              ))}
            </select>
            <input
              type="number"
              className="bwi"
              value={areaRange.year}
              onChange={e => onAreaRangeChange({ kind: 'quarter', year: Number(e.target.value), quarter: areaRange.quarter })}
              style={{ fontSize: 10, padding: '2px 6px', width: 64 }}
              aria-label={t('traceSelectYear')}
            />
            <button type="button" className="btbtn" onClick={() => onAreaRangeChange(shiftTraceQuarter(areaRange.year, areaRange.quarter, 1))} title={t('traceNavNextQuarter')}>
              <ChevronRight size={14} />
            </button>
          </div>
        );
      case 'year':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button type="button" className="bwbg" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => onAreaRangeChange(null)}>
              {t('traceAllTime')}
            </button>
            <button type="button" className="btbtn" onClick={() => onAreaRangeChange({ kind: 'year', year: shiftTraceYear(areaRange.year, -1) })} title={t('traceNavPrevYear')}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" className="bwbg" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => onAreaRangeChange({ kind: 'year', year: currentYear })}>
              {t('traceNavThisYear')}
            </button>
            <input
              type="number"
              className="bwi"
              value={areaRange.year}
              onChange={e => onAreaRangeChange({ kind: 'year', year: Number(e.target.value) })}
              style={{ fontSize: 10, padding: '2px 6px', width: 72 }}
              aria-label={t('traceSelectYear')}
            />
            <button type="button" className="btbtn" onClick={() => onAreaRangeChange({ kind: 'year', year: shiftTraceYear(areaRange.year, 1) })} title={t('traceNavNextYear')}>
              <ChevronRight size={14} />
            </button>
          </div>
        );
      case 'custom':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button type="button" className="bwbg" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => onAreaRangeChange(null)}>
              {t('traceAllTime')}
            </button>
            <span style={{ fontSize: 11, color: c.textMuted }}>
              {formatRangeLensHeading(areaRange)}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

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
          {projection?.areaTitle ?? 'Area'}
          {areaRange && areaRange.kind !== 'custom' && (
            <span style={{ fontWeight: 500, color: c.textMuted }}> · {formatRangeLensHeading(areaRange)}</span>
          )}
        </div>
        {renderRangeNav()}
      </div>

      {areaRange?.kind === 'custom' && !isCustomRangeReady(areaRange) && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 8,
          border: `1px solid ${c.sideBdr}`,
          background: c.card,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {t('traceCustomRange')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: c.textMuted }}>
              {t('labelStart')}
              <input className="bwi" type="date" value={customDraft.startDate} onChange={e => setCustomDraft(d => ({ ...d, startDate: e.target.value }))} style={{ fontSize: 11, padding: '4px 6px' }} />
            </label>
            <span style={{ color: c.textFaint, fontSize: 11, paddingTop: 18 }}>~</span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: c.textMuted }}>
              {t('labelEnd')}
              <input className="bwi" type="date" value={customDraft.endDate} onChange={e => setCustomDraft(d => ({ ...d, endDate: e.target.value }))} style={{ fontSize: 11, padding: '4px 6px' }} />
            </label>
          </div>
          {customError && <div style={{ fontSize: 11, color: c.danger }}>{customError}</div>}
          <button type="button" className="bwbg" style={{ alignSelf: 'flex-start', fontSize: 11, padding: '4px 10px' }} onClick={handleCustomGenerate}>
            {t('traceGenerate')}
          </button>
        </div>
      )}

      {!projection || !hasMarks ? (
        areaRange?.kind === 'custom' && !isCustomRangeReady(areaRange) ? null : (
          <div style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: c.textFaint,
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            {areaRange ? t('traceEmptyAreaPeriod') : t('traceEmptyArea')}
          </div>
        )
      ) : (
        <AreaTraceBody
          colors={c}
          projection={projection}
          areaRange={areaRange}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
        />
      )}
    </div>
  );
}
