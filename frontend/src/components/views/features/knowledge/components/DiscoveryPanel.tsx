import { useTranslation, type TranslationKey } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { DiscoveryFeed, DiscoveryItem, DiscoveryKind } from '../discovery';
import { importanceClassificationLabel } from '../knowledgeLabels';
import { KnowledgePanelSection, KnowledgePanelEmpty } from './KnowledgePanelSection';
import { ActionButton, ActionCard } from '../cosmos/actions/actionUi';

const SECTION_KEYS: Record<DiscoveryKind, 'k38SectionForgotten' | 'k38SectionMissingConnections' | 'k38SectionEmergingTopics' | 'k38SectionWeakHubs' | 'k38SectionKnowledgeDrift'> = {
  'forgotten-knowledge': 'k38SectionForgotten',
  'missing-connection': 'k38SectionMissingConnections',
  'emerging-topic': 'k38SectionEmergingTopics',
  'weak-hub': 'k38SectionWeakHubs',
  'knowledge-drift': 'k38SectionKnowledgeDrift',
};

export interface DiscoveryPanelProps {
  colors: NoteChromeColors;
  feed: DiscoveryFeed;
  onNavigateToNote: (noteId: string) => void;
  onCreateRelation: (sourceNoteId: string, targetNoteId: string) => void;
  onCreateHub: (areaLabel: string) => void;
}

function formatSubtitle(item: DiscoveryItem, t: (key: TranslationKey) => string, lang: string): string {
  if (item.kind === 'forgotten-knowledge' && item.daysSinceActivity != null) {
    return t('k38ForgottenDetail')
      .replace('{days}', String(item.daysSinceActivity))
      .replace('{tier}', item.importanceClass
        ? importanceClassificationLabel(item.importanceClass, lang as 'en')
        : '');
  }
  if (item.kind === 'missing-connection' && item.targetNoteTitle) {
    return t('k38MissingConnectionDetail').replace('{target}', item.targetNoteTitle);
  }
  if (item.kind === 'emerging-topic' && item.noteCount != null) {
    return t('k38EmergingTopicDetail')
      .replace('{count}', String(item.noteCount))
      .replace('{days}', String(14));
  }
  if (item.kind === 'weak-hub' && item.noteCount != null) {
    return t('k38WeakHubDetail').replace('{count}', String(item.noteCount));
  }
  if (item.kind === 'knowledge-drift' && item.daysSinceActivity != null) {
    return t('k38DriftDetail').replace('{days}', String(item.daysSinceActivity));
  }
  return item.subtitle;
}

function DiscoveryCard({
  c,
  item,
  t,
  lang,
  onNavigateToNote,
  onCreateRelation,
  onCreateHub,
}: {
  c: NoteChromeColors;
  item: DiscoveryItem;
  t: (key: TranslationKey) => string;
  lang: string;
  onNavigateToNote: (noteId: string) => void;
  onCreateRelation: (sourceNoteId: string, targetNoteId: string) => void;
  onCreateHub: (areaLabel: string) => void;
}) {
  const description = formatSubtitle(item, t, lang);
  let actions = null;

  if (item.kind === 'forgotten-knowledge' || item.kind === 'knowledge-drift') {
    actions = item.noteId ? (
      <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)}>
        {t('k38ActionRevisit')}
      </ActionButton>
    ) : null;
  } else if (item.kind === 'missing-connection' && item.noteId && item.targetNoteId) {
    actions = (
      <>
        <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)}>
          {t('k37ActionOpen')}
        </ActionButton>
        <ActionButton
          c={c}
          variant="secondary"
          onClick={() => onCreateRelation(item.noteId!, item.targetNoteId!)}
        >
          {t('k37ActionCreateRelation')}
        </ActionButton>
      </>
    );
  } else if (item.kind === 'emerging-topic' && item.noteId) {
    actions = (
      <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)}>
        {t('k37ActionOpen')}
      </ActionButton>
    );
  } else if (item.kind === 'weak-hub' && item.areaLabel) {
    actions = (
      <ActionButton c={c} onClick={() => onCreateHub(item.areaLabel!)}>
        {t('k37ActionCreateHub')}
      </ActionButton>
    );
  }

  return (
    <ActionCard c={c} title={item.title} description={description} actions={actions} />
  );
}

/** Vault-wide discovery feed — forgotten notes, connections, topics, weak hubs, drift. */
export function DiscoveryPanel({
  colors: c,
  feed,
  onNavigateToNote,
  onCreateRelation,
  onCreateHub,
}: DiscoveryPanelProps) {
  const { t, lang } = useTranslation();
  const kinds: DiscoveryKind[] = [
    'forgotten-knowledge',
    'missing-connection',
    'emerging-topic',
    'weak-hub',
    'knowledge-drift',
  ];

  if (feed.summary.totalCount === 0) {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <KnowledgePanelEmpty colors={c}>{t('k38NoDiscoveries')}</KnowledgePanelEmpty>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {kinds.map((kind, index) => {
        const section = feed.sections[kind];
        if (section.length === 0) return null;
        return (
          <KnowledgePanelSection
            key={kind}
            colors={c}
            first={index === 0}
            title={t(SECTION_KEYS[kind])}
            count={section.length}
          >
            {section.map(item => (
              <DiscoveryCard
                key={item.id}
                c={c}
                item={item}
                t={t}
                lang={lang}
                onNavigateToNote={onNavigateToNote}
                onCreateRelation={onCreateRelation}
                onCreateHub={onCreateHub}
              />
            ))}
          </KnowledgePanelSection>
        );
      })}
    </div>
  );
}
