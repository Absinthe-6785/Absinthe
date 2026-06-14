import type { ReactNode } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { TranslationKey } from '../../../../../lib/i18n';
import type { DiscoveryConfidence } from '../discovery/discoveryScoring';
import type { DiscoveryKind } from '../discovery/discoveryTypes';

export type CosmosSuitePanel = 'insights' | 'actions' | 'discover';

const SUITE_LABELS: Record<CosmosSuitePanel, TranslationKey> = {
  insights: 'k36PanelInsights',
  actions: 'k37PanelActions',
  discover: 'k38PanelDiscover',
};

export function CosmosSuiteHeader({
  c,
  active,
  t,
}: {
  c: NoteChromeColors;
  active: CosmosSuitePanel;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div
      style={{
        margin: '0 8px 8px',
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: `linear-gradient(135deg, ${c.accentBg} 0%, ${c.cardHov} 100%)`,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, color: c.accent, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {t('k39CosmosSuiteTitle')}
      </div>
      <div style={{ fontSize: 9, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}>
        {t('k39CosmosSuiteActive').replace('{panel}', t(SUITE_LABELS[active]))}
      </div>
    </div>
  );
}

export function CosmosConfidenceBadge({
  c,
  tier,
  t,
}: {
  c: NoteChromeColors;
  tier: DiscoveryConfidence;
  t: (key: TranslationKey) => string;
}) {
  const key: TranslationKey =
    tier === 'high' ? 'k39ConfidenceHigh'
    : tier === 'medium' ? 'k39ConfidenceMedium'
      : 'k39ConfidenceLow';
  const color = tier === 'high' ? c.accent : tier === 'medium' ? c.textMuted : c.textFaint;
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        color,
        background: tier === 'high' ? c.accentBg : c.cardHov,
        border: `1px solid ${tier === 'high' ? c.accent : c.sideBdr}`,
        borderRadius: 999,
        padding: '1px 6px',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}
    >
      {t(key)}
    </span>
  );
}

const KIND_BADGE_KEYS: Record<DiscoveryKind, TranslationKey> = {
  'forgotten-knowledge': 'k38SectionForgotten',
  'missing-connection': 'k38SectionMissingConnections',
  'emerging-topic': 'k38SectionEmergingTopics',
  'weak-hub': 'k38SectionWeakHubs',
  'knowledge-drift': 'k38SectionKnowledgeDrift',
};

export function CosmosDiscoveryKindBadge({
  c,
  kind,
  t,
}: {
  c: NoteChromeColors;
  kind: DiscoveryKind;
  t: (key: TranslationKey) => string;
}) {
  return (
    <span style={{ fontSize: 8, fontWeight: 600, color: c.textFaint, textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {t(KIND_BADGE_KEYS[kind])}
    </span>
  );
}

export function CosmosReasonBlock({
  c,
  children,
}: {
  c: NoteChromeColors;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: 6,
        padding: '5px 7px',
        borderRadius: 5,
        background: c.sidebar,
        border: `1px solid ${c.sideBdr}`,
        fontSize: 9,
        color: c.textMuted,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
