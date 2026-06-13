import { RELATED_REASON_LABELS, formatRelatedReasons } from '../related';
import type { RelatedNote } from '../KnowledgeIndexService';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface RelatedNotesPanelProps {
  colors: NoteChromeColors;
  related: readonly RelatedNote[];
  onNavigateToNote: (noteId: string) => void;
}

/** Lightweight related-note suggestions from tags, backlinks, mentions, trace. */
export function RelatedNotesPanel({
  colors: c,
  related,
  onNavigateToNote,
}: RelatedNotesPanelProps) {
  return (
    <div style={{ padding: '0 0 8px' }}>
      <div
        style={{
          padding: '8px 10px 4px',
          fontSize: 10,
          color: c.textMuted,
          fontWeight: 700,
          borderTop: `1px solid ${c.sideBdr}`,
        }}
      >
        관련 노트{' '}
        {related.length > 0 && (
          <span style={{ color: c.accent }}>({related.length})</span>
        )}
      </div>

      {related.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '10px 8px' }}>
          태그·링크·언급 기준 관련 노트 없음
        </p>
      ) : (
        related.map(item => (
          <div
            key={item.noteId}
            role="button"
            tabIndex={0}
            style={{
              margin: '0 8px 6px',
              borderRadius: 7,
              border: `1px solid ${c.sideBdr}`,
              background: c.cardHov,
              padding: '6px 9px',
              cursor: 'pointer',
            }}
            onClick={() => onNavigateToNote(item.noteId)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigateToNote(item.noteId);
              }
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: c.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.noteTitle}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {item.reasons.map(reason => (
                <span
                  key={reason}
                  style={{
                    fontSize: 9,
                    color: c.accent,
                    background: c.accentBg,
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontWeight: 600,
                  }}
                >
                  {RELATED_REASON_LABELS[reason] ?? reason}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 9, color: c.textFaint, marginTop: 3 }}>
              {formatRelatedReasons(item.reasons)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
