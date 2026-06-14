import { useTranslation } from '../../../../../lib/i18n';
import type { RelatedNote } from '../KnowledgeIndexService';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { KnowledgePanelEmpty } from './KnowledgePanelSection';
import { formatRelatedReasonsLocalized, relatedReasonLabel } from '../knowledgeLabels';

export interface RelatedNotesPanelProps {
  colors: NoteChromeColors;
  related: readonly RelatedNote[];
  onNavigateToNote: (noteId: string) => void;
  onLinkToNote?: (noteId: string, noteTitle: string) => void;
  onOpenGraph?: () => void;
  onLearnLinking?: () => void;
  onCreateRelatedNote?: () => void;
}

/** Lightweight related-note suggestions from tags, backlinks, mentions, trace. */
export function RelatedNotesPanel({
  colors: c,
  related,
  onNavigateToNote,
  onLinkToNote,
  onOpenGraph,
  onLearnLinking,
  onCreateRelatedNote,
}: RelatedNotesPanelProps) {
  const { t, lang } = useTranslation();

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
        {t('knRelatedNotes')}{' '}
        {related.length > 0 && (
          <span style={{ color: c.accent }}>({related.length})</span>
        )}
      </div>

      {related.length === 0 ? (
        <KnowledgePanelEmpty
          colors={c}
          actionLabel={onLearnLinking ? t('k53ContextCreateWikiLink') : undefined}
          onAction={onLearnLinking}
          secondaryActionLabel={
            onCreateRelatedNote ? t('k54ContextCreateRelatedNote')
              : onOpenGraph ? t('k53ContextOpenCosmos') : undefined
          }
          onSecondaryAction={onCreateRelatedNote ?? onOpenGraph}
        >
          {t('knNoRelatedNotes')}
        </KnowledgePanelEmpty>
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                role="button"
                tabIndex={0}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: c.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
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
                {item.noteTitle}
              </div>
              {onLinkToNote && (
                <button
                  type="button"
                  className="btbtn"
                  onClick={() => onLinkToNote(item.noteId, item.noteTitle)}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 5,
                    border: `1px solid ${c.accent}`,
                    background: c.accentBg,
                    color: c.accent,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {t('k37ActionLink')}
                </button>
              )}
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
                  {relatedReasonLabel(reason, lang)}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 9, color: c.textFaint, marginTop: 3 }}>
              {formatRelatedReasonsLocalized(item.reasons, lang)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
