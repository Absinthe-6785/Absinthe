import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { LearningActivityData, LearningActivityKind } from '../analytics/buildLearningActivity';

export interface LearningActivityPanelProps {
  colors: NoteChromeColors;
  data: LearningActivityData;
  onNavigateToNote: (noteId: string) => void;
}

const KIND_LABELS: Record<LearningActivityKind, string> = {
  study: '학습',
  research: '연구',
  review: '복습',
  project: '프로젝트',
};

/** Recent learning activity timeline from note timestamps. */
export function LearningActivityPanel({ colors: c, data, onNavigateToNote }: LearningActivityPanelProps) {
  if (data.items.length === 0) {
    return <div style={{ fontSize: 10, color: c.textFaint }}>최근 학습 활동 없음</div>;
  }
  return (
    <div className="be-learning-activity" aria-label="학습 활동">
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
            {KIND_LABELS[item.kind]} · {item.meta}
          </div>
        </button>
      ))}
    </div>
  );
}
