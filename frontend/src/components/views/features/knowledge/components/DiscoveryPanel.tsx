import type { ReactNode } from 'react';
import { useTranslation, type TranslationKey } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { DiscoveryFeed, DiscoveryItem, DiscoveryKind } from '../discovery';
import { formatDiscoveryReasonLines } from '../discovery/discoveryReasons';
import {
  CosmosConfidenceBadge,
  CosmosDiscoveryKindBadge,
  CosmosReasonBlock,
  CosmosSuiteHeader,
} from '../cosmos/cosmosPanelUi';
import { KnowledgePanelSection, KnowledgePanelEmpty } from './KnowledgePanelSection';
import { ActionButton } from '../cosmos/actions/actionUi';

const SECTION_KEYS: Record<DiscoveryKind, TranslationKey> = {
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
  const reasons = formatDiscoveryReasonLines(item, t, lang as 'en');
  const confidence = item.confidence ?? 'medium';
  let actions = null;

  if (item.kind === 'forgotten-knowledge' || item.kind === 'knowledge-drift') {
    actions = item.noteId ? (
      <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)}>
        {t('k38ActionRevisit')}
      </ActionButton>
    ) : null;
  } else if (item.kind === 'missing-connection' && item.noteId && item.targetNoteId) {
    const title = item.targetNoteTitle
      ? `${item.title} ↔ ${item.targetNoteTitle}`
      : item.title;
    return (
      <DiscoveryCardShell c={c} item={item} title={title} confidence={confidence} t={t} reasons={reasons} actions={(
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
      )}
      />
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
    <DiscoveryCardShell
      c={c}
      item={item}
      title={item.title}
      confidence={confidence}
      t={t}
      reasons={reasons}
      actions={actions}
    />
  );
}

function DiscoveryCardShell({
  c,
  item,
  title,
  confidence,
  t,
  reasons,
  actions,
}: {
  c: NoteChromeColors;
  item: DiscoveryItem;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  t: (key: TranslationKey) => string;
  reasons: string[];
  actions: ReactNode;
}) {
  return (
    <div
      style={{
        margin: '0 8px 6px',
        padding: '8px 9px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <CosmosDiscoveryKindBadge c={c} kind={item.kind} t={t} />
            <CosmosConfidenceBadge c={c} tier={confidence} t={t} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{title}</div>
          {reasons.length > 0 && (
            <CosmosReasonBlock c={c}>
              <div style={{ fontSize: 8, fontWeight: 700, color: c.textFaint, marginBottom: 3, textTransform: 'uppercase' }}>
                {t('k39ReasonLabel')}
              </div>
              {reasons.map(line => (
                <div key={line}>{line}</div>
              ))}
            </CosmosReasonBlock>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
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
        <CosmosSuiteHeader c={c} active="discover" t={t} />
        <KnowledgePanelEmpty colors={c}>{t('k38NoDiscoveries')}</KnowledgePanelEmpty>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <CosmosSuiteHeader c={c} active="discover" t={t} />
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
