import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { AcademicDashboardData } from '../academic/buildAcademicDashboard';
import type { ProjectMilestoneEntry } from '../academic/projectMilestoneModels';
import type { ResearchNoteEntry } from '../research/buildResearchDashboard';
import type { StudyNoteEntry } from '../study/buildStudyDashboard';

export interface AcademicDashboardPanelProps {
  colors: NoteChromeColors;
  data: AcademicDashboardData;
  onNavigateToNote: (noteId: string) => void;
}

function ListSection({
  c,
  title,
  items,
  onNavigate,
  renderMeta,
}: {
  c: NoteChromeColors;
  title: string;
  items: readonly { noteId: string; noteTitle: string; meta?: string }[];
  onNavigate: (id: string) => void;
  renderMeta?: (item: { meta?: string }) => string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title}
        {items.length > 0 && (
          <span style={{ color: c.accent, marginLeft: 4 }}>({items.length})</span>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>없음</div>
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
            {(renderMeta?.(item) ?? item.meta) && (
              <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>
                {renderMeta?.(item) ?? item.meta}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
}

/** Unified academic activity dashboard — composes existing surfaces. */
export function AcademicDashboardPanel({ colors: c, data, onNavigateToNote }: AcademicDashboardPanelProps) {
  const projectItems = data.activeProjects.map(p => ({
    noteId: p.noteId,
    noteTitle: p.title,
    meta: `${p.progressLabel} · ${p.linkedNoteCount} 노트`,
  }));

  const milestoneItems: ProjectMilestoneEntry[] = data.upcomingMilestones;
  const studyItems: StudyNoteEntry[] = data.studyNotes;
  const researchItems: ResearchNoteEntry[] = data.researchNotes;
  const weakItems: StudyNoteEntry[] = data.weakTopics;

  return (
    <div className="be-academic-dashboard" aria-label="학술 대시보드">
      <ListSection
        c={c}
        title="진행 중 프로젝트"
        items={projectItems}
        onNavigate={onNavigateToNote}
      />
      <ListSection
        c={c}
        title="다가오는 마일스톤"
        items={milestoneItems}
        onNavigate={onNavigateToNote}
        renderMeta={item => item.meta ?? ''}
      />
      <ListSection c={c} title="학습 노트" items={studyItems} onNavigate={onNavigateToNote} />
      <ListSection c={c} title="연구 노트" items={researchItems} onNavigate={onNavigateToNote} />
      <ListSection c={c} title="약점 주제" items={weakItems} onNavigate={onNavigateToNote} />
    </div>
  );
}
