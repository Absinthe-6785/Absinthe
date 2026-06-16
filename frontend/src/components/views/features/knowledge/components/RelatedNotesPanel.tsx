import { useTranslation } from '../../../../../lib/i18n';
import type { RelatedNote } from '../KnowledgeIndexService';
import type { GroupedRelatedNotes } from '../related/groupRelatedNotes';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { KnowledgePanelEmpty, KnowledgePanelSection } from './KnowledgePanelSection';
import { relatedReasonLabel } from '../knowledgeLabels';
import type { TranslationKey } from '../../../../../lib/i18n';

const SECTION_TITLE_KEYS: Record<keyof GroupedRelatedNotes, TranslationKey> = {
  mostRelated: 'k70RelatedMostRelated',
  worthRevisiting: 'k75RelatedWorthRevisiting',
};

export interface RelatedNotesPanelProps {
  colors: NoteChromeColors;
  grouped: GroupedRelatedNotes;
  onNavigateToNote: (noteId: string) => void;
  onLinkToNote?: (noteId: string, noteTitle: string) => void;
  onOpenGraph?: () => void;
  onLearnLinking?: () => void;
  onCreateRelatedNote?: () => void;
}

function RelatedNoteCard({
  c,
  item,
  onNavigateToNote,
  onLinkToNote,
  lang,
  t,
}: {
  c: NoteChromeColors;
  item: RelatedNote;
  onNavigateToNote: (noteId: string) => void;
  onLinkToNote?: (noteId: string, noteTitle: string) => void;
  lang: string;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div
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
            {relatedReasonLabel(reason, lang as 'en')}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Grouped related-note suggestions — most related, recently connected, frequently referenced. */
export function RelatedNotesPanel({
  colors: c,
  grouped,
  onNavigateToNote,
  onLinkToNote,
  onOpenGraph,
  onLearnLinking,
  onCreateRelatedNote,
}: RelatedNotesPanelProps) {
  const { t, lang } = useTranslation();
  const totalCount = grouped.mostRelated.length + grouped.worthRevisiting.length;
  const sections = (Object.keys(SECTION_TITLE_KEYS) as (keyof GroupedRelatedNotes)[])
    .map(key => ({ key, items: grouped[key] }))
    .filter(s => s.items.length > 0);

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
        {totalCount > 0 && (
          <span style={{ color: c.accent }}>({totalCount})</span>
        )}
      </div>

      {totalCount === 0 ? (
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
        sections.map((section, index) => (
          <KnowledgePanelSection
            key={section.key}
            colors={c}
            first={index === 0}
            title={t(SECTION_TITLE_KEYS[section.key])}
            count={section.items.length}
            collapsible={section.key === 'worthRevisiting'}
            defaultCollapsed={section.key === 'worthRevisiting' && grouped.mostRelated.length >= 3}
          >
            {section.items.map(item => (
              <RelatedNoteCard
                key={`${section.key}-${item.noteId}`}
                c={c}
                item={item}
                onNavigateToNote={onNavigateToNote}
                onLinkToNote={onLinkToNote}
                lang={lang}
                t={t}
              />
            ))}
          </KnowledgePanelSection>
        ))
      )}
    </div>
  );
}
