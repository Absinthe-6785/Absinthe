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
  return (
    <section
      className="be-knowledge-health"
      style={{ padding: compact ? '0' : '0 0 8px' }}
      aria-label="지식 건강"
    >
      {!compact && (
        <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>
          지식 건강
        </div>
      )}
      <MetricRow c={c} label="전체 노트" value={metrics.totalNotes} />
      <MetricRow c={c} label="연결된 노트" value={metrics.linkedNotes} />
      <MetricRow c={c} label="고립 노트" value={metrics.orphanNotes} />
      <MetricRow c={c} label="태그된 노트" value={metrics.taggedNotes} />
      <MetricRow c={c} label="30일+ 미방문·미수정" value={metrics.staleNotes} />
      <MetricRow c={c} label="백링크 합계" value={metrics.totalBacklinks} />
      <MetricRow c={c} label="평균 연결" value={metrics.averageConnections} />
    </section>
  );
}
