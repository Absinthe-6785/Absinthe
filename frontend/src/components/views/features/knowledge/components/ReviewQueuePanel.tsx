import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ReviewQueueEntry, ReviewQueueReason } from '../review/reviewQueue';

export interface ReviewQueuePanelProps {
  colors: NoteChromeColors;
  queue: readonly ReviewQueueEntry[];
  onNavigateToNote: (noteId: string) => void;
  compact?: boolean;
}

const REASON_KEYS: Record<ReviewQueueReason, 'knReviewReasonStale' | 'knReviewReasonLinked' | 'knReviewReasonRecent' | 'knReviewReasonMilestone'> = {
  stale: 'knReviewReasonStale',
  linked: 'knReviewReasonLinked',
  recent: 'knReviewReasonRecent',
  milestone: 'knReviewReasonMilestone',
};

/** Manual review queue — no flashcards, no SRS. */
export function ReviewQueuePanel({
  colors: c,
  queue,
  onNavigateToNote,
  compact,
}: ReviewQueuePanelProps) {
  const { t } = useTranslation();
  return (
    <section className="be-review-queue" style={{ padding: compact ? '0' : '0 0 8px' }} aria-label={t('knReviewQueueAria')}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>
        {t('knReviewQueueTitle')} {queue.length > 0 && <span style={{ color: c.accent }}>({queue.length})</span>}
      </div>
      <p style={{ fontSize: 9, color: c.textFaint, margin: '0 0 6px' }}>
        {t('knReviewQueueHint')}
      </p>
      {queue.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>{t('knReviewQueueEmpty')}</div>
      ) : (
        queue.map(item => (
          <button
            key={item.noteId}
            type="button"
            onClick={() => onNavigateToNote(item.noteId)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: c.accent,
                  background: c.accentBg,
                  borderRadius: 4,
                  padding: '1px 5px',
                  flexShrink: 0,
                }}
              >
                {t(REASON_KEYS[item.reason])}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.noteTitle}
              </span>
            </div>
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 2 }}>{item.meta}</div>
          </button>
        ))
      )}
    </section>
  );
}
