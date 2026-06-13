import { formatRelatedReasons } from '../related';
import type { RelatedNote } from '../KnowledgeIndexService';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface RelatedNotesPanelProps {
  colors: NoteChromeColors;
  related: readonly RelatedNote[];
  onNavigateToNote: (noteId: string) => void;
}

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
          fontWeight: 600,
          borderTop: `1px solid ${c.sideBdr}`,
        }}
      >
        Related Notes{' '}
        {related.length > 0 && (
          <span style={{ color: c.accent }}>({related.length})</span>
        )}
      </div>

      {related.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '10px 8px' }}>
          관련 노트 없음
        </p>
      ) : (
        related.map(item => (
          <div
            key={item.noteId}
            style={{
              margin: '0 8px 6px',
              borderRadius: 7,
              border: `1px solid ${c.sideBdr}`,
              background: c.cardHov,
              padding: '6px 9px',
              cursor: 'pointer',
            }}
            onClick={() => onNavigateToNote(item.noteId)}
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
            <div style={{ fontSize: 10, color: c.accent, marginTop: 2 }}>
              score: {item.score}
            </div>
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 2 }}>
              Reason: {formatRelatedReasons(item.reasons)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
