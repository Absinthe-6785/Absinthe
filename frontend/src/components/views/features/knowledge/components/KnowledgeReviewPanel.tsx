import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeReviewLists, ReviewNoteEntry } from '../review/buildKnowledgeReview';

export interface KnowledgeReviewPanelProps {
  colors: NoteChromeColors;
  lists: KnowledgeReviewLists;
  onNavigateToNote: (noteId: string) => void;
  compact?: boolean;
}

function ReviewSection({
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
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>{t('knReviewNoNotes')}</div>
      ) : (
        items.map(item => (
          <button
            key={`${title}-${item.noteId}`}
            type="button"
            onClick={() => onNavigate(item.noteId)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '6px 9px',
              marginBottom: 4,
              cursor: 'pointer',
              color: c.text,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.noteTitle}
            </div>
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 2 }}>{item.meta}</div>
          </button>
        ))
      )}
    </div>
  );
}

/** Lightweight review dashboard — rediscovery without SRS or AI. */
export function KnowledgeReviewPanel({
  colors: c,
  lists,
  onNavigateToNote,
  compact = false,
}: KnowledgeReviewPanelProps) {
  const { t } = useTranslation();
  const padding = compact ? '8px 10px' : '10px 12px';

  return (
    <section
      className="be-knowledge-review"
      style={{ padding, overflowY: 'auto' }}
      aria-label={t('wsKnowledgeReview')}
    >
      {!compact && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: c.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 10,
          }}
        >
          {t('wsKnowledgeReview')}
        </div>
      )}

      <ReviewSection
        c={c}
        title={t('nvSortUpdated')}
        items={lists.recentlyEdited}
        onNavigate={onNavigateToNote}
      />
      <ReviewSection
        c={c}
        title={t('nvSortCreated')}
        items={lists.recentlyCreated}
        onNavigate={onNavigateToNote}
      />
      <ReviewSection
        c={c}
        title={t('knMostLinked')}
        items={lists.mostLinked}
        onNavigate={onNavigateToNote}
      />
      <ReviewSection
        c={c}
        title={t('knStaleNotesTitle')}
        items={lists.leastRevisited}
        onNavigate={onNavigateToNote}
      />
    </section>
  );
}
