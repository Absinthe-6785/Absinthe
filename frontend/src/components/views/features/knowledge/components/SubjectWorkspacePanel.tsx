import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SubjectWorkspaceData } from '../maps/buildSubjectWorkspace';
import type { SubjectDashboardEntry } from '../maps/subjectDashboards';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import { responsiveStatGridColumns, touchMinSize } from '../../../../../lib/responsiveLayout';

export interface SubjectWorkspacePanelProps {
  colors: NoteChromeColors;
  data: SubjectWorkspaceData;
  onNavigateToNote: (noteId: string) => void;
  onOpenWorkspace?: () => void;
  onEditProject?: (projectId: string) => void;
}

function EntryList({
  c,
  title,
  items,
  onNavigate,
  onEditProject,
}: {
  c: NoteChromeColors;
  title: string;
  items: readonly SubjectDashboardEntry[];
  onNavigate: (noteId: string) => void;
  onEditProject?: (projectId: string) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title}
        {items.length > 0 && <span style={{ color: c.accent, marginLeft: 4 }}>({items.length})</span>}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>없음</div>
      ) : (
        items.map(item => (
          <div key={`${title}-${item.noteId}`} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
            <button
              type="button"
              onClick={() => onNavigate(item.noteId)}
              style={{
                flex: 1,
                textAlign: 'left',
                background: c.cardHov,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                padding: '5px 8px',
                cursor: 'pointer',
                color: c.text,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.noteTitle}
              </div>
              <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
            </button>
            {onEditProject && title === '프로젝트' && (
              <button
                type="button"
                onClick={() => onEditProject(item.noteId)}
                title="프로젝트 편집"
                style={{
                  flexShrink: 0,
                  padding: '5px 10px',
                  fontSize: 9,
                  borderRadius: 6,
                  border: `1px solid ${c.sideBdr}`,
                  background: c.card,
                  color: c.accent,
                  cursor: 'pointer',
                  minHeight: touch,
                }}
              >
                편집
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/** Per-subject coherent workspace — reuses existing tag-based data. */
export function SubjectWorkspacePanel({
  colors: c,
  data,
  onNavigateToNote,
  onOpenWorkspace,
  onEditProject,
}: SubjectWorkspacePanelProps) {
  const { isMobile, isTablet } = useViewportLayout();
  const touch = touchMinSize(isMobile);
  return (
    <div className="be-subject-workspace" aria-label={`${data.subject.name} 작업공간`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{data.subject.name}</div>
          <div style={{ fontSize: 9, color: c.textFaint, marginTop: 2 }}>{data.subject.description}</div>
        </div>
        {onOpenWorkspace && (
          <button
            type="button"
            onClick={onOpenWorkspace}
            style={{
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 5,
              border: `1px solid ${c.sideBdr}`,
              background: c.cardHov,
              color: c.accent,
              cursor: 'pointer',
              flexShrink: 0,
              minHeight: touch,
            }}
          >
            작업공간 열기
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: responsiveStatGridColumns(isMobile, isTablet, 4), gap: 4, marginBottom: 10 }}>
        {[
          { label: '노트', count: data.noteCount },
          { label: '개념', count: data.conceptCount },
          { label: '프로젝트', count: data.linkedProjectCount },
          { label: '약점', count: data.weakTopics.length },
        ].map(row => (
          <div
            key={row.label}
            style={{
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '6px 4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: c.accent }}>{row.count}</div>
            <div style={{ fontSize: 9, color: c.textMuted }}>{row.label}</div>
          </div>
        ))}
      </div>
      <EntryList c={c} title="프로젝트" items={data.linkedProjects} onNavigate={onNavigateToNote} onEditProject={onEditProject} />
      <EntryList c={c} title="약점 주제" items={data.weakTopics} onNavigate={onNavigateToNote} />
      <EntryList c={c} title="학습 노트" items={data.studyNotes} onNavigate={onNavigateToNote} />
      <EntryList c={c} title="개념" items={data.conceptNotes} onNavigate={onNavigateToNote} />
      <EntryList c={c} title="최근 활동" items={data.activity} onNavigate={onNavigateToNote} />
    </div>
  );
}
