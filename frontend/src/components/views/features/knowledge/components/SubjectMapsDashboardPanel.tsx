import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import { SUBJECT_DASHBOARDS, type SubjectDashboardData } from '../maps/subjectDashboards';

export interface SubjectMapsDashboardPanelProps {
  colors: NoteChromeColors;
  subjects: readonly SubjectDashboardData[];
  onNavigateToNote: (noteId: string) => void;
  onActivateSubjectWorkspace?: (collectionId: SmartCollectionId) => void;
}

/** Tag-based subject organization with optional workspace activation. */
export function SubjectMapsDashboardPanel({
  colors: c,
  subjects,
  onNavigateToNote,
  onActivateSubjectWorkspace,
}: SubjectMapsDashboardPanelProps) {
  const active = subjects.filter(s => s.noteCount > 0);
  return (
    <div className="be-subject-maps" aria-label="주제 대시보드">
      {SUBJECT_DASHBOARDS.map(def => {
        const data = subjects.find(s => s.subject.id === def.id);
        const noteCount = data?.noteCount ?? 0;
        const conceptCount = data?.conceptCount ?? 0;
        const projectCount = data?.linkedProjectCount ?? 0;
        const workspaceId = data?.workspaceCollectionId;
        return (
          <div key={def.id} style={{ marginBottom: 10, padding: '8px 10px', background: c.cardHov, border: `1px solid ${c.sideBdr}`, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{def.name}</div>
                <div style={{ fontSize: 9, color: c.textMuted, marginBottom: 4 }}>#{def.tag} · {def.description}</div>
              </div>
              {workspaceId && onActivateSubjectWorkspace && (
                <button
                  type="button"
                  onClick={() => onActivateSubjectWorkspace(workspaceId)}
                  style={{
                    flexShrink: 0,
                    fontSize: 9,
                    padding: '3px 8px',
                    background: c.card,
                    border: `1px solid ${c.sideBdr}`,
                    borderRadius: 5,
                    color: c.accent,
                    cursor: 'pointer',
                  }}
                >
                  작업공간
                </button>
              )}
            </div>
            <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 6 }}>
              노트 {noteCount} · 개념 {conceptCount} · 프로젝트 {projectCount}
            </div>
            {data && data.recentNotes.length > 0 ? (
              data.recentNotes.slice(0, 3).map(entry => (
                <button
                  key={entry.noteId}
                  type="button"
                  onClick={() => onNavigateToNote(entry.noteId)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: c.card,
                    border: `1px solid ${c.sideBdr}`,
                    borderRadius: 5,
                    padding: '4px 8px',
                    marginBottom: 3,
                    cursor: 'pointer',
                    fontSize: 10,
                    color: c.text,
                  }}
                >
                  {entry.noteTitle}
                </button>
              ))
            ) : (
              <div style={{ fontSize: 10, color: c.textFaint }}>태그된 노트 없음</div>
            )}
          </div>
        );
      })}
      {active.length === 0 && (
        <div style={{ fontSize: 10, color: c.textFaint }}>주제 태그를 노트에 추가하면 여기에 표시됩니다.</div>
      )}
    </div>
  );
}
