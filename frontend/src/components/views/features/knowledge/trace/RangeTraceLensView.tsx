import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import {
  buildRangeLensProjection,
  buildRangeTraceProjection,
  currentTraceMonth,
  currentTraceQuarter,
  currentTraceYear,
  formatRangeLensHeading,
  hasRangeTraceMarks,
  shiftTraceMonth,
  shiftTraceQuarter,
  shiftTraceYear,
  toMonthKey,
} from './buildRangeTraceProjection';
import type { TraceRangeLens } from './rangeTraceModels';

export interface RangeTraceLensViewProps {
  colors: NoteChromeColors;
  lens: TraceRangeLens;
  notes: readonly NoteBase[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onLensChange: (lens: TraceRangeLens) => void;
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

function formatRangeEmptyMessage(lens: TraceRangeLens): string {
  switch (lens.kind) {
    case 'month':
      return 'No traces recorded for this month.';
    case 'quarter':
      return 'No traces recorded for this quarter.';
    case 'year':
      return 'No traces recorded for this year.';
    case 'custom':
      return 'No traces recorded for this period.';
    default:
      return 'No traces recorded for this period.';
  }
}

function isCustomRangeReady(lens: TraceRangeLens): boolean {
  if (lens.kind !== 'custom') return true;
  if (!lens.startDate.trim() || !lens.endDate.trim()) return false;
  try {
    buildRangeTraceProjection(lens.startDate, lens.endDate, []);
    return true;
  } catch {
    return false;
  }
}

function CustomRangeForm({
  colors: c,
  draft,
  error,
  onDraftChange,
  onGenerate,
}: {
  colors: NoteChromeColors;
  draft: { startDate: string; endDate: string; label: string };
  error: string | null;
  onDraftChange: (draft: { startDate: string; endDate: string; label: string }) => void;
  onGenerate: () => void;
}) {
  return (
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
        Custom Range
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: c.textMuted }}>
        Name (optional)
        <input
          className="bwi"
          type="text"
          value={draft.label}
          onChange={e => onDraftChange({ ...draft, label: e.target.value })}
          placeholder="N1 Preparation"
          style={{ fontSize: 11, padding: '4px 8px' }}
        />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: c.textMuted }}>
          Start
          <input
            className="bwi"
            type="date"
            value={draft.startDate}
            onChange={e => onDraftChange({ ...draft, startDate: e.target.value })}
            style={{ fontSize: 11, padding: '4px 6px' }}
          />
        </label>
        <span style={{ color: c.textFaint, fontSize: 11, paddingTop: 18 }}>~</span>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: c.textMuted }}>
          End
          <input
            className="bwi"
            type="date"
            value={draft.endDate}
            onChange={e => onDraftChange({ ...draft, endDate: e.target.value })}
            style={{ fontSize: 11, padding: '4px 6px' }}
          />
        </label>
      </div>
      {error && (
        <div style={{ fontSize: 11, color: c.danger }}>{error}</div>
      )}
      <button
        type="button"
        className="bwbg"
        style={{ alignSelf: 'flex-start', fontSize: 11, padding: '4px 10px' }}
        onClick={onGenerate}
      >
        Generate
      </button>
    </div>
  );
}

function RangeTraceBody({
  colors: c,
  projection,
  activeNoteId,
  onSelectNote,
}: {
  colors: NoteChromeColors;
  projection: ReturnType<typeof buildRangeLensProjection>;
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}) {
  return (
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

      {(projection.notesTouched > 0 || projection.notesCreated > 0) && (
        <TraceSection colors={c} title="Activity Overview">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: c.textMuted }}>
            {projection.notesTouched > 0 && (
              <div>{projection.notesTouched} notes touched</div>
            )}
            {projection.notesCreated > 0 && (
              <div>{projection.notesCreated} notes created</div>
            )}
          </div>
        </TraceSection>
      )}
    </>
  );
}

export function RangeTraceLensView({
  colors: c,
  lens,
  notes,
  activeNoteId,
  onSelectNote,
  onLensChange,
}: RangeTraceLensViewProps) {
  const currentMonth = useMemo(() => currentTraceMonth(), []);
  const currentQuarter = useMemo(() => currentTraceQuarter(), []);
  const currentYear = useMemo(() => currentTraceYear(), []);

  const [customDraft, setCustomDraft] = useState(() => ({
    startDate: lens.kind === 'custom' ? lens.startDate : '',
    endDate: lens.kind === 'custom' ? lens.endDate : '',
    label: lens.kind === 'custom' ? (lens.label ?? '') : '',
  }));
  const [customError, setCustomError] = useState<string | null>(null);

  const projection = useMemo(() => {
    if (!isCustomRangeReady(lens)) return null;
    return buildRangeLensProjection(lens, notes);
  }, [lens, notes]);

  const hasMarks = projection ? hasRangeTraceMarks(projection) : false;

  const handleCustomGenerate = () => {
    try {
      buildRangeTraceProjection(customDraft.startDate, customDraft.endDate, notes);
      setCustomError(null);
      onLensChange({
        kind: 'custom',
        startDate: customDraft.startDate,
        endDate: customDraft.endDate,
        label: customDraft.label.trim() || undefined,
      });
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : 'Invalid range');
    }
  };

  const renderNav = () => {
    switch (lens.kind) {
      case 'month': {
        const monthKey = toMonthKey(lens.year, lens.month);
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btbtn"
              onClick={() => onLensChange(shiftTraceMonth(lens.year, lens.month, -1))}
              title="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="bwbg"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={() => onLensChange({ kind: 'month', ...currentMonth })}
            >
              This Month
            </button>
            <input
              type="month"
              className="bwi"
              value={monthKey}
              onChange={e => {
                const match = /^(\d{4})-(\d{2})$/.exec(e.target.value);
                if (!match) return;
                onLensChange({ kind: 'month', year: Number(match[1]), month: Number(match[2]) });
              }}
              style={{ fontSize: 10, padding: '2px 6px', maxWidth: 130 }}
              aria-label="Select month"
            />
            <button
              type="button"
              className="btbtn"
              onClick={() => onLensChange(shiftTraceMonth(lens.year, lens.month, 1))}
              title="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        );
      }
      case 'quarter':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btbtn"
              onClick={() => onLensChange(shiftTraceQuarter(lens.year, lens.quarter, -1))}
              title="Previous quarter"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="bwbg"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={() => onLensChange({ kind: 'quarter', ...currentQuarter })}
            >
              This Quarter
            </button>
            <select
              className="bwi"
              value={lens.quarter}
              onChange={e => onLensChange({ kind: 'quarter', year: lens.year, quarter: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              style={{ fontSize: 10, padding: '2px 6px' }}
              aria-label="Select quarter"
            >
              {[1, 2, 3, 4].map(q => (
                <option key={q} value={q}>Q{q}</option>
              ))}
            </select>
            <input
              type="number"
              className="bwi"
              value={lens.year}
              onChange={e => onLensChange({ kind: 'quarter', year: Number(e.target.value), quarter: lens.quarter })}
              style={{ fontSize: 10, padding: '2px 6px', width: 64 }}
              aria-label="Select year"
            />
            <button
              type="button"
              className="btbtn"
              onClick={() => onLensChange(shiftTraceQuarter(lens.year, lens.quarter, 1))}
              title="Next quarter"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        );
      case 'year':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btbtn"
              onClick={() => onLensChange({ kind: 'year', year: shiftTraceYear(lens.year, -1) })}
              title="Previous year"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="bwbg"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={() => onLensChange({ kind: 'year', year: currentYear })}
            >
              This Year
            </button>
            <input
              type="number"
              className="bwi"
              value={lens.year}
              onChange={e => onLensChange({ kind: 'year', year: Number(e.target.value) })}
              style={{ fontSize: 10, padding: '2px 6px', width: 72 }}
              aria-label="Select year"
            />
            <button
              type="button"
              className="btbtn"
              onClick={() => onLensChange({ kind: 'year', year: shiftTraceYear(lens.year, 1) })}
              title="Next year"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        );
      case 'custom':
        return null;
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
        {lens.kind !== 'custom' && (
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
            {formatRangeLensHeading(lens)}
          </div>
        )}
        {renderNav()}
      </div>

      {lens.kind === 'custom' && (
        <CustomRangeForm
          colors={c}
          draft={customDraft}
          error={customError}
          onDraftChange={setCustomDraft}
          onGenerate={handleCustomGenerate}
        />
      )}

      {lens.kind === 'custom' && isCustomRangeReady(lens) && (
        <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
          {formatRangeLensHeading(lens)}
        </div>
      )}

      {!projection ? (
        lens.kind === 'custom' ? null : (
          <div style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: c.textFaint,
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            {formatRangeEmptyMessage(lens)}
          </div>
        )
      ) : !hasMarks ? (
        <div style={{
          padding: '24px 12px',
          textAlign: 'center',
          color: c.textFaint,
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          {formatRangeEmptyMessage(lens)}
        </div>
      ) : (
        <RangeTraceBody
          colors={c}
          projection={projection}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
        />
      )}
    </div>
  );
}
