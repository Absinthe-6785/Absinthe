import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useTranslation } from '../../../../../lib/i18n';
import type { StudyDashboardData, StudyNoteEntry } from '../study/buildStudyDashboard';

export interface StudyDashboardPanelProps {
  colors: NoteChromeColors;
  data: StudyDashboardData;
  onNavigateToNote: (noteId: string) => void;
  onOpenStudyCollection?: () => void;
}

function Section({
  c,
  title,
  count,
  items,
  onNavigate,
  emptyAction,
}: {
  c: NoteChromeColors;
  title: string;
  count?: number;
  items: readonly StudyNoteEntry[];
  onNavigate: (id: string) => void;
  emptyAction?: { label: string; onClick: () => void };
}) {
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title}
        {count !== undefined && count > 0 && (
          <span style={{ color: c.accent, marginLeft: 4 }}>({count})</span>
        )}
      </div>
      {items.length === 0 ? (
        emptyAction ? (
          <div>
            <div style={{ fontSize: 10, color: c.textFaint, marginBottom: 6 }}>{t('emptyStudyNotes')}</div>
            <button
              type="button"
              onClick={emptyAction.onClick}
              style={{
                fontSize: 10,
                padding: '5px 8px',
                borderRadius: 6,
                border: `1px solid ${c.sideBdr}`,
                background: c.accentBg,
                color: c.accent,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {emptyAction.label}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: c.textFaint }}>{t('emptySectionNone')}</div>
        )
      ) : (
        items.map(item => (
          <button
            key={`${title}-${item.noteId}`}
            type="button"
            onClick={() => onNavigate(item.noteId)}
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
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
          </button>
        ))
      )}
    </div>
  );
}

/** Informational study dashboard — no scoring, no scheduling. */
export function StudyDashboardPanel({ colors: c, data, onNavigateToNote, onOpenStudyCollection }: StudyDashboardPanelProps) {
  const { t } = useTranslation();
  const studyEmptyAction = onOpenStudyCollection
    ? { label: t('emptyStudyAction'), onClick: onOpenStudyCollection }
    : undefined;
  return (
    <div className="be-study-dashboard" aria-label="학습 대시보드">
      <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 8 }}>
        질문 {data.questionCount}개 · 전체 노트 기준
      </div>
      <Section c={c} title="최근 학습 노트" items={data.recentStudyNotes} onNavigate={onNavigateToNote} emptyAction={studyEmptyAction} />
      <Section c={c} title="복습 후보" count={data.reviewCandidates.length} items={data.reviewCandidates} onNavigate={onNavigateToNote} />
      <Section c={c} title="약점 주제" count={data.weakTopics.length} items={data.weakTopics} onNavigate={onNavigateToNote} />
      <Section c={c} title="최다 복습" items={data.mostReviewed} onNavigate={onNavigateToNote} />
    </div>
  );
}
