import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { VaultHealthMetrics } from '../health/vaultHealthMetrics';

export interface VaultHealthStripProps {
  colors: NoteChromeColors;
  metrics: VaultHealthMetrics;
  compact?: boolean;
}

/** Actionable vault health summary — K-75. */
export function VaultHealthStrip({ colors: c, metrics, compact }: VaultHealthStripProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        margin: '0 8px 8px',
        padding: compact ? '8px 10px' : '10px 12px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {t('k70VaultHealthTitle')}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 10,
          color: c.textMuted,
          lineHeight: 1.5,
        }}
      >
        <div>{t('k75VaultHealthConnectedPct').replace('{pct}', String(metrics.connectedPercent))}</div>
        <div style={{ color: metrics.isolatedNotes > 0 ? c.accent : c.textMuted }}>
          {t('k70VaultHealthIsolated').replace('{count}', String(metrics.isolatedNotes))}
        </div>
        <div>{t('k75VaultHealthActiveWeek').replace('{count}', String(metrics.recentlyActiveNotes))}</div>
      </div>
    </div>
  );
}
