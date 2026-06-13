import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ReviewNoteEntry } from '../review/buildKnowledgeReview';
import type { StaleNotesBuckets } from '../review/staleNotes';

export interface StaleNotesPanelProps {
  colors: NoteChromeColors;
  buckets: StaleNotesBuckets;
  onNavigateToNote: (noteId: string) => void;
  compact?: boolean;
}

function TierSection({
  c,
  title,
  items,
  onNavigate,
}: {
  c: NoteChromeColors;
  title: string;
  items: readonly ReviewNoteEntry[];
  onNavigate: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>없음</div>
      ) : (
        items.map(item => (
          <button
            key={item.noteId}
            type="button"
            onClick={() => onNavigate(item.noteId)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '5px 8px',
              marginBottom: 3,
              cursor: 'pointer',
              color: c.text,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.noteTitle}
            </div>
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
          </button>
        ))
      )}
    </div>
  );
}

export function StaleNotesPanel({ colors: c, buckets, onNavigateToNote, compact }: StaleNotesPanelProps) {
  return (
    <section className="be-stale-notes" style={{ padding: compact ? '0' : '0 0 8px' }} aria-label="오래된 노트">
      {!compact && (
        <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 8 }}>
          오래된 노트
        </div>
      )}
      <TierSection c={c} title="90일+" items={buckets.days90} onNavigate={onNavigateToNote} />
      <TierSection c={c} title="60일+" items={buckets.days60} onNavigate={onNavigateToNote} />
      <TierSection c={c} title="30일+" items={buckets.days30} onNavigate={onNavigateToNote} />
    </section>
  );
}
