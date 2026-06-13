import { Plus, Pencil } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { LearningPathOverviewData, LearningPathOverviewEntry } from '../maps/buildLearningPathOverview';

export interface LearningPathOverviewPanelProps {
  colors: NoteChromeColors;
  data: LearningPathOverviewData;
  onNavigateToNote: (noteId: string) => void;
  onCreatePath?: () => void;
  onOpenPathEditor?: (pathId: string) => void;
}

function PathCard({
  c,
  entry,
  onNavigate,
  onOpenPathEditor,
}: {
  c: NoteChromeColors;
  entry: LearningPathOverviewEntry;
  onNavigate: (noteId: string) => void;
  onOpenPathEditor?: (pathId: string) => void;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.text, flex: 1 }}>{entry.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: c.textMuted }}>
            {entry.stepCount}단계
          </span>
          {onOpenPathEditor && (
            <button
              type="button"
              onClick={() => onOpenPathEditor(entry.pathId)}
              title="경로 편집"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${c.sideBdr}`,
                background: c.card,
                color: c.accent,
                cursor: 'pointer',
              }}
            >
              <Pencil size={9} /> 편집
            </button>
          )}
        </div>
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

/** Learning path overview with create/edit entry points. */
export function LearningPathOverviewPanel({
  colors: c,
  data,
  onNavigateToNote,
  onCreatePath,
  onOpenPathEditor,
}: LearningPathOverviewPanelProps) {
  return (
    <div className="be-learning-path-overview" aria-label="학습 경로 개요">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: c.textFaint }}>
          경로 {data.totalPathCount}개 · vault 기준
        </div>
        {onCreatePath && (
          <button
            type="button"
            onClick={onCreatePath}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 5,
              border: `1px solid ${c.sideBdr}`,
              background: c.cardHov,
              color: c.accent,
              cursor: 'pointer',
            }}
          >
            <Plus size={10} /> 경로 만들기
          </button>
        )}
      </div>
      {data.paths.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>학습 경로가 없습니다</div>
      ) : (
        data.paths.map(entry => (
          <PathCard
            key={entry.pathId}
            c={c}
            entry={entry}
            onNavigate={onNavigateToNote}
            onOpenPathEditor={onOpenPathEditor}
          />
        ))
      )}
    </div>
  );
}
