import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeHealthMetrics } from '../review/knowledgeHealth';

export interface KnowledgeHealthPanelProps {
  colors: NoteChromeColors;
  metrics: KnowledgeHealthMetrics;
  compact?: boolean;
}

function MetricRow({ c, label, value }: { c: NoteChromeColors; label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
      <span style={{ color: c.textMuted }}>{label}</span>
      <span style={{ color: c.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/** Vault quality metrics — informational only, no gamification. */
export function KnowledgeHealthPanel({ colors: c, metrics, compact }: KnowledgeHealthPanelProps) {
  const { t } = useTranslation();
  return (
    <section
      className="be-knowledge-health"
      style={{ padding: compact ? '0' : '0 0 8px' }}
      aria-label={t('knKnowledgeHealthAria')}
    >
      {!compact && (
        <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>
          {t('knKnowledgeHealthTitle')}
        </div>
      )}
      <MetricRow c={c} label={t('knHealthTotalNotes')} value={metrics.totalNotes} />
      <MetricRow c={c} label={t('knHealthLinkedNotes')} value={metrics.linkedNotes} />
      <MetricRow c={c} label={t('knHealthOrphanNotes')} value={metrics.orphanNotes} />
      <MetricRow c={c} label={t('knHealthTaggedNotes')} value={metrics.taggedNotes} />
      <MetricRow c={c} label={t('knHealthStaleNotes')} value={metrics.staleNotes} />
      <MetricRow c={c} label={t('knHealthTotalBacklinks')} value={metrics.totalBacklinks} />
      <MetricRow c={c} label={t('knHealthAvgConnections')} value={metrics.averageConnections} />
    </section>
  );
}
