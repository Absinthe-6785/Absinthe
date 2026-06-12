import { useMemo } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import {
  buildAreaTraceProjection,
  hasAreaTraceMarks,
} from './buildAreaTraceProjection';

export interface AreaTraceViewProps {
  colors: NoteChromeColors;
  areaNoteId: string;
  notes: readonly NoteBase[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
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

export function AreaTraceView({
  colors: c,
  areaNoteId,
  notes,
  activeNoteId,
  onSelectNote,
}: AreaTraceViewProps) {
  const projection = useMemo(
    () => buildAreaTraceProjection(areaNoteId, notes),
    [areaNoteId, notes],
  );

  const hasMarks = hasAreaTraceMarks(projection);

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
          {projection.areaTitle}
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
          No traces linked to this area yet.
        </div>
      ) : (
        <>
          {projection.linkedNotes.length > 0 && (
            <TraceSection colors={c} title="Linked Notes">
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
        </>
      )}
    </div>
  );
}
