import type { NoteChromeColors } from '../../../noteEditorTheme';
import {
  formatProjectStatusLabel,
  type ProjectDashboardData,
  type ProjectDashboardEntry,
  type ProjectNoteEntry,
} from '../academic/buildProjectDashboard';

export interface ProjectDashboardPanelProps {
  colors: NoteChromeColors;
  data: ProjectDashboardData;
  onNavigateToNote: (noteId: string) => void;
}

function Section({
  c,
  title,
  items,
  onNavigate,
}: {
  c: NoteChromeColors;
  title: string;
  items: readonly ProjectNoteEntry[];
  onNavigate: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 6, marginBottom: 4 }}>
      <div style={{ fontSize: 9, color: c.textMuted, marginBottom: 2 }}>{title}</div>
      {items.slice(0, 3).map(item => (
        <button
          key={`${title}-${item.noteId}`}
          type="button"
          onClick={() => onNavigate(item.noteId)}
          style={{
            width: '100%',
            textAlign: 'left',
            background: c.card,
            border: `1px solid ${c.sideBdr}`,
            borderRadius: 5,
            padding: '3px 6px',
            marginBottom: 2,
            cursor: 'pointer',
            fontSize: 10,
            color: c.text,
          }}
        >
          {item.noteTitle}
        </button>
      ))}
    </div>
  );
}

function ProjectCard({
  c,
  project,
  onNavigate,
}: {
  c: NoteChromeColors;
  project: ProjectDashboardEntry;
  onNavigate: (id: string) => void;
}) {
  return (
    <div
      style={{
        marginBottom: 8,
        padding: '8px 10px',
        background: c.cardHov,
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 8,
      }}
    >
      <button
        type="button"
        onClick={() => onNavigate(project.noteId)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{project.title}</div>
        {project.description && (
          <div style={{ fontSize: 9, color: c.textMuted, marginTop: 2 }}>{project.description}</div>
        )}
      </button>
      <div style={{ fontSize: 9, color: c.textFaint, marginTop: 4 }}>
        {formatProjectStatusLabel(project.status)} · {project.progressLabel}
        {project.milestoneCount > 0 && project.progressPercent > 0 && (
          <span style={{ color: c.accent, marginLeft: 4 }}>{project.progressPercent}%</span>
        )}
      </div>
      <Section c={c} title="연결 노트" items={project.linkedNotes} onNavigate={onNavigate} />
      <Section c={c} title="관련 개념" items={project.conceptNotes} onNavigate={onNavigate} />
      <Section c={c} title="학습 활동" items={project.studyNotes} onNavigate={onNavigate} />
    </div>
  );
}

/** Project-level progress dashboard — no task manager. */
export function ProjectDashboardPanel({ colors: c, data, onNavigateToNote }: ProjectDashboardPanelProps) {
  return (
    <div className="be-project-dashboard" aria-label="프로젝트 대시보드">
      {data.activeProjects.length === 0 && data.plannedProjects.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>
          studyProject 속성이 있는 노트로 장기 프로젝트를 만드세요. 사이드바 → 프로젝트 컬렉션에서 시작할 수 있습니다.
        </div>
      ) : (
        <>
          {data.activeProjects.map(p => (
            <ProjectCard key={p.noteId} c={c} project={p} onNavigate={onNavigateToNote} />
          ))}
          {data.plannedProjects.slice(0, 2).map(p => (
            <ProjectCard key={p.noteId} c={c} project={p} onNavigate={onNavigateToNote} />
          ))}
        </>
      )}
    </div>
  );
}
