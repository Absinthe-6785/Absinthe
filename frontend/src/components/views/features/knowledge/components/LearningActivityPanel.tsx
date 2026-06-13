import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { LearningActivityData, LearningActivityKind } from '../analytics/buildLearningActivity';

export interface LearningActivityPanelProps {
  colors: NoteChromeColors;
  data: LearningActivityData;
  onNavigateToNote: (noteId: string) => void;
}

const KIND_KEYS: Record<LearningActivityKind, 'knActivityStudy' | 'knActivityResearch' | 'knActivityReview' | 'knActivityProject'> = {
  study: 'knActivityStudy',
  research: 'knActivityResearch',
  review: 'knActivityReview',
  project: 'knActivityProject',
};

/** Recent learning activity timeline from note timestamps. */
export function LearningActivityPanel({ colors: c, data, onNavigateToNote }: LearningActivityPanelProps) {
  const { t } = useTranslation();
  if (data.items.length === 0) {
    return <div style={{ fontSize: 10, color: c.textFaint }}>{t('knNoRecentLearningActivity')}</div>;
  }
  return (
    <div className="be-learning-activity" aria-label={t('knStudyActivity')}>
      {data.items.map(item => (
        <button
          key={`${item.kind}-${item.noteId}`}
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
          <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.noteTitle}
          </div>
          <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>
            {t(KIND_KEYS[item.kind])} · {item.meta}
          </div>
        </button>
      ))}
    </div>
  );
}
