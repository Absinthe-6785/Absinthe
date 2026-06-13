import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { LearningPathOverviewData, LearningPathOverviewEntry } from '../maps/buildLearningPathOverview';

export interface LearningPathOverviewPanelProps {
  colors: NoteChromeColors;
  data: LearningPathOverviewData;
  onNavigateToNote: (noteId: string) => void;
}

function PathCard({
  c,
  entry,
  onNavigate,
}: {
  c: NoteChromeColors;
  entry: LearningPathOverviewEntry;
  onNavigate: (noteId: string) => void;
}) {
  return (
    <div
      style={{
        background: c.cardHov,
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{entry.label}</div>
        <span style={{ fontSize: 9, color: c.textMuted }}>
          {entry.stepCount}단계
          {entry.maxStep > 0 ? ` · 최대 ${entry.maxStep}` : ''}
        </span>
      </div>
      {entry.currentStep && (
        <div style={{ fontSize: 9, color: c.accent, marginBottom: 4 }}>
          현재: {entry.currentStep.noteTitle} (단계 {entry.currentStep.step})
        </div>
      )}
      {entry.steps.length === 0 ? (
        <div style={{ fontSize: 9, color: c.textFaint }}>단계 없음</div>
      ) : (
        entry.steps.map(step => (
          <button
            key={step.noteId}
            type="button"
            onClick={() => onNavigate(step.noteId)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: c.card,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 4,
              padding: '3px 6px',
              marginBottom: 2,
              cursor: 'pointer',
              fontSize: 10,
              color: c.text,
            }}
          >
            <span style={{ color: c.textMuted, marginRight: 4 }}>{step.step}.</span>
            {step.noteTitle}
          </button>
        ))
      )}
    </div>
  );
}

/** Learning path visibility — display only, no editor UI. */
export function LearningPathOverviewPanel({ colors: c, data, onNavigateToNote }: LearningPathOverviewPanelProps) {
  return (
    <div className="be-learning-path-overview" aria-label="학습 경로 개요">
      <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 8 }}>
        경로 {data.totalPathCount}개 · vault 기준
      </div>
      {data.paths.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>학습 경로가 없습니다</div>
      ) : (
        data.paths.map(entry => (
          <PathCard key={entry.pathId} c={c} entry={entry} onNavigate={onNavigateToNote} />
        ))
      )}
    </div>
  );
}
