import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ReviewNoteEntry } from '../review/buildKnowledgeReview';

export interface OrphanNotesPanelProps {
  colors: NoteChromeColors;
  orphans: readonly ReviewNoteEntry[];
  onNavigateToNote: (noteId: string) => void;
  compact?: boolean;
}

export function OrphanNotesPanel({
  colors: c,
  orphans,
  onNavigateToNote,
  compact,
}: OrphanNotesPanelProps) {
  const { t } = useTranslation();
  return (
    <section className="be-orphan-notes" style={{ padding: compact ? '0' : '0 0 8px' }} aria-label={t('knOrphanNotesAria')}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>
        {t('knOrphanNotesTitle')} {orphans.length > 0 && <span style={{ color: c.accent }}>({orphans.length})</span>}
      </div>
      <p style={{ fontSize: 9, color: c.textFaint, margin: '0 0 6px' }}>
        {t('knOrphanNotesHint')}
      </p>
      {orphans.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>{t('knNoOrphanNotes')}</div>
      ) : (
        orphans.map(item => (
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
            <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.noteTitle}
            </div>
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
          </button>
        ))
      )}
    </section>
  );
}
