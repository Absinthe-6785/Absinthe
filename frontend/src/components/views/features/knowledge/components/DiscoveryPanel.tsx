import type { ReactNode } from 'react';
import { useTranslation, type TranslationKey } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { DiscoveryFeed, DiscoveryItem, DiscoveryKind } from '../discovery';
import type { VaultHealthMetrics } from '../health/vaultHealthMetrics';
import { formatDiscoveryReasonLines } from '../discovery/discoveryReasons';
import { VaultHealthStrip } from './VaultHealthStrip';
import {
  CosmosDiscoveryKindBadge,
  CosmosSuiteHeader,
} from '../cosmos/cosmosPanelUi';
import type { CosmosVaultPhase } from '../cosmos/onboarding';
import {
  CosmosEmptyStatePanel,
  FirstDiscoveryBanner,
  WhyThisRecommendation,
} from '../cosmos/onboarding';
import { KnowledgePanelSection, KnowledgePanelEmpty } from './KnowledgePanelSection';
import { ActionButton } from '../cosmos/actions/actionUi';
import { touchMinSize } from '../../../../../lib/responsiveLayout';

const SECTION_KEYS: Record<DiscoveryKind, TranslationKey> = {
  'isolated-notes': 'k38SectionIsolatedNotes',
  'recently-active-area': 'k38SectionRecentlyActiveArea',
  'stale-area': 'k38SectionStaleArea',
  'forgotten-knowledge': 'k38SectionForgotten',
  'missing-connection': 'k38SectionMissingConnections',
  'emerging-topic': 'k38SectionEmergingTopics',
  'weak-hub': 'k38SectionWeakHubs',
  'knowledge-drift': 'k38SectionKnowledgeDrift',
};

export interface DiscoveryPanelProps {
  colors: NoteChromeColors;
  feed: DiscoveryFeed;
  vaultHealth?: VaultHealthMetrics;
  vaultPhase?: CosmosVaultPhase;
  onNavigateToNote: (noteId: string) => void;
  onCreateRelation: (sourceNoteId: string, targetNoteId: string) => void;
  onCreateHub: (areaLabel: string) => void;
  onLearnLinking?: () => void;
  onOpenGraph?: () => void;
  compact?: boolean;
}

function DiscoveryCard({
  c,
  item,
  t,
  lang,
  compact,
  onNavigateToNote,
  onCreateRelation,
  onCreateHub,
}: {
  c: NoteChromeColors;
  item: DiscoveryItem;
  t: (key: TranslationKey) => string;
  lang: string;
  compact?: boolean;
  onNavigateToNote: (noteId: string) => void;
  onCreateRelation: (sourceNoteId: string, targetNoteId: string) => void;
  onCreateHub: (areaLabel: string) => void;
}) {
  const reasons = formatDiscoveryReasonLines(item, t, lang as 'en');
  const confidence = item.confidence ?? 'medium';
  const touch = touchMinSize(!!compact);
  let actions = null;

  if (item.kind === 'forgotten-knowledge' || item.kind === 'knowledge-drift') {
    actions = item.noteId ? (
      <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)} style={{ minHeight: touch }}>
        {t('k38ActionRevisit')}
      </ActionButton>
    ) : null;
  } else if (item.kind === 'missing-connection' && item.noteId && item.targetNoteId) {
    const title = item.targetNoteTitle
      ? `${item.title} ↔ ${item.targetNoteTitle}`
      : item.title;
    return (
      <DiscoveryCardShell c={c} item={item} title={title} t={t} reasons={reasons} confidence={confidence} compact={compact} actions={(
        <>
          <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)} style={{ minHeight: touch }}>
            {t('k37ActionOpen')}
          </ActionButton>
          <ActionButton
            c={c}
            variant="secondary"
            onClick={() => onCreateRelation(item.noteId!, item.targetNoteId!)}
            style={{ minHeight: touch }}
          >
            {t('k37ActionCreateRelation')}
          </ActionButton>
        </>
      )}
      />
    );
  } else if (item.kind === 'emerging-topic' && item.noteId) {
    actions = (
      <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)} style={{ minHeight: touch }}>
        {t('k37ActionOpen')}
      </ActionButton>
    );
  } else if (item.kind === 'weak-hub' && item.areaLabel) {
    actions = (
      <ActionButton c={c} onClick={() => onCreateHub(item.areaLabel!)} style={{ minHeight: touch }}>
        {t('k37ActionCreateHub')}
      </ActionButton>
    );
  } else if (item.kind === 'isolated-notes' && item.noteId) {
    actions = (
      <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)} style={{ minHeight: touch }}>
        {t('k37ActionOpen')}
      </ActionButton>
    );
  } else if ((item.kind === 'recently-active-area' || item.kind === 'stale-area') && item.areaLabel) {
    actions = item.noteId ? (
      <ActionButton c={c} onClick={() => onNavigateToNote(item.noteId!)} style={{ minHeight: touch }}>
        {t('k37ActionOpen')}
      </ActionButton>
    ) : null;
  }

  return (
    <DiscoveryCardShell
      c={c}
      item={item}
      title={item.title}
      t={t}
      reasons={reasons}
      confidence={confidence}
      compact={compact}
      actions={actions}
    />
  );
}

function DiscoveryCardShell({
  c,
  item,
  title,
  t,
  reasons,
  confidence,
  compact,
  actions,
}: {
  c: NoteChromeColors;
  item: DiscoveryItem;
  title: string;
  t: (key: TranslationKey) => string;
  reasons: string[];
  confidence: 'high' | 'medium' | 'low';
  compact?: boolean;
  actions: ReactNode;
}) {
  return (
    <div
      style={{
        margin: '0 8px 6px',
        padding: compact ? '10px' : '8px 9px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <CosmosDiscoveryKindBadge c={c} kind={item.kind} t={t} />
          </div>
          <div style={{ fontSize: compact ? 12 : 11, fontWeight: 600, color: c.text }}>{title}</div>
          <WhyThisRecommendation
            colors={c}
            reasons={reasons}
            confidence={confidence}
            score={item.score}
            compact={compact}
          />
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
  vaultHealth,
  vaultPhase,
  onNavigateToNote,
  onCreateRelation,
  onCreateHub,
  onLearnLinking,
  onOpenGraph,
  compact,
}: DiscoveryPanelProps) {
  const { t, lang } = useTranslation();
  const kinds: DiscoveryKind[] = [
    'isolated-notes',
    'recently-active-area',
    'stale-area',
    'forgotten-knowledge',
    'missing-connection',
    'emerging-topic',
    'weak-hub',
    'knowledge-drift',
  ];
  const topItem = feed.items[0] ?? null;

  if (feed.summary.totalCount === 0) {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <CosmosSuiteHeader c={c} active="discover" t={t} />
        {vaultPhase === 'linked-healthy' ? (
          <CosmosEmptyStatePanel
            colors={c}
            compact={compact}
            headline={t('k41DiscoverHealthyTitle')}
            body={t('k41DiscoverHealthyBody')}
            action={onOpenGraph ? (
              <ActionButton c={c} onClick={onOpenGraph}>{t('k53ContextOpenCosmos')}</ActionButton>
            ) : undefined}
          />
        ) : (
          <>
            <KnowledgePanelEmpty
              colors={c}
              actionLabel={onLearnLinking ? t('k53ContextCreateWikiLink') : undefined}
              onAction={onLearnLinking}
              secondaryActionLabel={onOpenGraph ? t('k53ContextOpenCosmos') : undefined}
              onSecondaryAction={onOpenGraph}
            >
              {t('k38NoDiscoveries')}
            </KnowledgePanelEmpty>
            {vaultPhase === 'no-links' && (
              <CosmosEmptyStatePanel
                colors={c}
                compact={compact}
                headline={t('k41EmptyCosmosUnlinkedTitle')}
                body={t('k41DiscoverNoLinksHint')}
                action={onLearnLinking ? (
                  <ActionButton c={c} onClick={onLearnLinking}>{t('k53ContextCreateWikiLink')}</ActionButton>
                ) : undefined}
              />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <CosmosSuiteHeader c={c} active="discover" t={t} />
      {vaultHealth && <VaultHealthStrip colors={c} metrics={vaultHealth} compact={compact} />}
      <FirstDiscoveryBanner colors={c} topItem={topItem} />
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
                compact={compact}
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
