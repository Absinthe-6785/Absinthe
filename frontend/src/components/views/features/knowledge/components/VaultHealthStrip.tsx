import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { VaultHealthMetrics } from '../health/vaultHealthMetrics';

export interface VaultHealthStripProps {
  colors: NoteChromeColors;
  metrics: VaultHealthMetrics;
  compact?: boolean;
}

/** Lightweight vault health indicators — K-70. */
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
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '4px 10px',
          fontSize: 10,
          color: c.textMuted,
          lineHeight: 1.5,
        }}
      >
        <div>{t('k70VaultHealthConnected').replace('{count}', String(metrics.connectedNotes))}</div>
        <div>{t('k70VaultHealthIsolated').replace('{count}', String(metrics.isolatedNotes))}</div>
        <div>{t('k70VaultHealthAvgLinks').replace('{value}', String(metrics.averageLinksPerNote))}</div>
        <div>{t('k70VaultHealthRecent').replace('{count}', String(metrics.recentlyActiveNotes))}</div>
      </div>
    </div>
  );
}
