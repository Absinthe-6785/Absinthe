import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { DiscoverySummary } from '../discovery';
import { DashboardCardHeader } from './DashboardCardHeader';
import { DashboardEmptyCard } from './DashboardEmptyCard';
import { Compass } from 'lucide-react';

export interface DiscoveryDashboardCardProps {
  colors: NoteChromeColors;
  summary: DiscoverySummary;
  onOpenDiscover: () => void;
  compact?: boolean;
}

/** Dashboard widget — today's discovery counts with link to Discover panel. */
export function DiscoveryDashboardCard({
  colors: c,
  summary,
  onOpenDiscover,
  compact,
}: DiscoveryDashboardCardProps) {
  const { t } = useTranslation();

  if (summary.totalCount === 0) {
    return (
      <DashboardEmptyCard
        colors={c}
        icon={Compass}
        title={t('k38DashboardTitle')}
        message={t('k53DiscoveryDashboardEmpty')}
        actionLabel={t('k38ActionOpenDiscover')}
        onAction={onOpenDiscover}
        compact={compact}
      />
    );
  }

  const lines = [
    summary.forgottenCount > 0
      ? t('k38DashboardForgotten').replace('{count}', String(summary.forgottenCount))
      : null,
    summary.missingConnectionCount > 0
      ? t('k38DashboardMissingConnections').replace('{count}', String(summary.missingConnectionCount))
      : null,
    summary.weakHubCount > 0
      ? t('k38DashboardWeakHubs').replace('{count}', String(summary.weakHubCount))
      : null,
    summary.emergingTopicCount > 0
      ? t('k38DashboardEmergingTopics').replace('{count}', String(summary.emergingTopicCount))
      : null,
    summary.knowledgeDriftCount > 0
      ? t('k38DashboardDrift').replace('{count}', String(summary.knowledgeDriftCount))
      : null,
  ].filter(Boolean) as string[];

  return (
    <div
      style={{
        marginBottom: compact ? 10 : 12,
        padding: compact ? '10px 12px' : '12px 14px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DashboardCardHeader colors={c} icon={Compass} title={t('k38DashboardTitle')} compact={compact} />
          {lines.map(line => (
            <div key={line} style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.5 }}>
              {line}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenDiscover}
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 5,
            border: `1px solid ${c.accent}`,
            background: c.accentBg,
            color: c.accent,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {t('k38ActionOpenDiscover')}
        </button>
      </div>
    </div>
  );
}
