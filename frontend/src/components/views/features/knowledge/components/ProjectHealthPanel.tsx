import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ProjectHealthData, ProjectHealthEntry } from '../analytics/buildProjectHealth';

export interface ProjectHealthPanelProps {
  colors: NoteChromeColors;
  data: ProjectHealthData;
  onNavigateToNote: (noteId: string) => void;
}

const INDICATOR_LABELS: Record<ProjectHealthEntry['indicator'], string> = {
  active: '활동 중',
  stalled: '정체',
  'on-track': '진행',
};

function ProjectRow({
  c,
  entry,
  onNavigate,
}: {
  c: NoteChromeColors;
  entry: ProjectHealthEntry;
  onNavigate: (id: string) => void;
}) {
  const indicatorColor = entry.indicator === 'stalled' ? c.accent : c.textMuted;
  return (
    <button
      type="button"
      onClick={() => onNavigate(entry.noteId)}
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
      <div style={{ fontSize: 11, fontWeight: 600 }}>{entry.title}</div>
      <div style={{ fontSize: 9, color: indicatorColor, marginTop: 1 }}>
        {INDICATOR_LABELS[entry.indicator]} · {entry.milestoneLabel} · {entry.daysSinceActivity}일 전
      </div>
    </button>
  );
}

/** Project health indicators — no health score. */
export function ProjectHealthPanel({ colors: c, data, onNavigateToNote }: ProjectHealthPanelProps) {
  return (
    <div className="be-project-health" aria-label="프로젝트 상태">
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>진행 중</div>
      {data.activeProjects.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint, marginBottom: 8 }}>없음</div>
      ) : (
        data.activeProjects.map(p => (
          <ProjectRow key={p.noteId} c={c} entry={p} onNavigate={onNavigateToNote} />
        ))
      )}
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, marginTop: 6 }}>정체 프로젝트</div>
      {data.stalledProjects.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>없음</div>
      ) : (
        data.stalledProjects.map(p => (
          <ProjectRow key={`stalled-${p.noteId}`} c={c} entry={p} onNavigate={onNavigateToNote} />
        ))
      )}
    </div>
  );
}
