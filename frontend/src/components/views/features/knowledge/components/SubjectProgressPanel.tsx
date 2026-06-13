import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SubjectProgressData } from '../analytics/buildSubjectProgress';

export interface SubjectProgressPanelProps {
  colors: NoteChromeColors;
  data: SubjectProgressData;
}

/** Informational subject-level progress metrics. */
export function SubjectProgressPanel({ colors: c, data }: SubjectProgressPanelProps) {
  const visible = data.subjects.filter(
    s => s.noteCount > 0 || s.projectCount > 0,
  );
  if (visible.length === 0) {
    return <div style={{ fontSize: 10, color: c.textFaint }}>주제 태그가 있는 노트가 없습니다.</div>;
  }
  return (
    <div className="be-subject-progress" aria-label="주제별 진행">
      {visible.map(s => (
        <div
          key={s.subjectId}
          style={{
            marginBottom: 8,
            padding: '6px 8px',
            background: c.cardHov,
            border: `1px solid ${c.sideBdr}`,
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{s.subjectName}</div>
          <div style={{ fontSize: 9, color: c.textMuted, marginTop: 3 }}>
            노트 {s.noteCount} · 학습 {s.studyNoteCount} · 약점 {s.weakTopicCount} · 개념 {s.conceptCount} · 프로젝트 {s.projectCount}
          </div>
        </div>
      ))}
    </div>
  );
}
