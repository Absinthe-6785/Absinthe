import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeClusterData } from '../maps/buildKnowledgeClusters';

export interface KnowledgeClusterPanelProps {
  colors: NoteChromeColors;
  data: KnowledgeClusterData;
  onNavigateToNote: (noteId: string) => void;
}

/** Identify major topic areas from graph/index infrastructure. */
export function KnowledgeClusterPanel({ colors: c, data, onNavigateToNote }: KnowledgeClusterPanelProps) {
  const { t } = useTranslation();
  return (
    <section className="be-knowledge-clusters" style={{ padding: '0 0 8px' }} aria-label={t('wsKnowledgeClusters')}>
      <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 700, borderTop: `1px solid ${c.sideBdr}` }}>
        {t('wsKnowledgeClusters')}
        <span style={{ color: c.accent, marginLeft: 6 }}>{data.conceptCount} concepts</span>
      </div>
      <div style={{ fontSize: 9, color: c.textFaint, padding: '0 10px 6px' }}>
        {t('knClusterSummary')
          .replace('{clusters}', String(data.clusterCount))
          .replace('{connected}', String(data.highlyConnected.length))}
      </div>
      {data.highlyConnected.length > 0 && (
        <div style={{ padding: '0 8px 8px' }}>
          <div style={{ fontSize: 9, color: c.textMuted, marginBottom: 4 }}>{t('knHighlyConnectedConcepts')}</div>
          {data.highlyConnected.map(item => (
            <button
              key={item.noteId}
              type="button"
              onClick={() => onNavigateToNote(item.noteId)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: c.cardHov,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                padding: '5px 8px',
                marginBottom: 3,
                cursor: 'pointer',
                color: c.text,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>{item.noteTitle}</div>
              <div style={{ fontSize: 9, color: c.textMuted }}>{item.meta}</div>
            </button>
          ))}
        </div>
      )}
      {data.tagClusters.length > 0 && (
        <div style={{ padding: '0 8px 8px' }}>
          <div style={{ fontSize: 9, color: c.textMuted, marginBottom: 4 }}>{t('knConceptGroupsByTag')}</div>
          {data.tagClusters.map(cluster => (
            <div
              key={cluster.tag}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '5px 8px',
                marginBottom: 3,
                background: c.cardHov,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                fontSize: 11,
              }}
            >
              <span>#{cluster.tag}</span>
              <span style={{ color: c.textMuted }}>{cluster.conceptCount} concepts · {cluster.count} notes</span>
            </div>
          ))}
        </div>
      )}
      {data.highlyConnected.length === 0 && data.tagClusters.length === 0 && (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px' }}>{t('knNoClusters')}</p>
      )}
    </section>
  );
}
