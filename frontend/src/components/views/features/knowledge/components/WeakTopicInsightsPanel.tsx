import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { WeakTopicInsightsData } from '../analytics/buildWeakTopicInsights';

export interface WeakTopicInsightsPanelProps {
  colors: NoteChromeColors;
  data: WeakTopicInsightsData;
  onNavigateToNote: (noteId: string) => void;
}

/** Weak-topic insights by subject — no recommendations. */
export function WeakTopicInsightsPanel({ colors: c, data, onNavigateToNote }: WeakTopicInsightsPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="be-weak-topic-insights" aria-label={t('knWeakTopicInsightsAria')}>
      <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 6 }}>
        {t('knUnresolvedWeakCount').replace('{count}', String(data.unresolvedCount))}
      </div>
      {data.bySubject.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>{t('knBySubject')}</div>
          {data.bySubject.map(s => (
            <div key={s.subjectId} style={{ fontSize: 10, color: c.text, marginBottom: 2 }}>
              {s.subjectName} <span style={{ color: c.accent }}>({s.count})</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>{t('knTopWeakTopics')}</div>
      {data.frequentAreas.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>{t('knNone')}</div>
      ) : (
        data.frequentAreas.map(item => (
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
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
          </button>
        ))
      )}
    </div>
  );
}
