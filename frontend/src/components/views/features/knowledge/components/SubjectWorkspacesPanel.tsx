import { useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SubjectWorkspaceData } from '../maps/buildSubjectWorkspace';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import { SubjectWorkspacePanel } from './SubjectWorkspacePanel';

export interface SubjectWorkspacesPanelProps {
  colors: NoteChromeColors;
  subjects: readonly SubjectWorkspaceData[];
  onNavigateToNote: (noteId: string) => void;
  onActivateSubjectWorkspace?: (collectionId: SmartCollectionId) => void;
}

/** Tabbed subject workspaces — one coherent panel per subject. */
export function SubjectWorkspacesPanel({
  colors: c,
  subjects,
  onNavigateToNote,
  onActivateSubjectWorkspace,
}: SubjectWorkspacesPanelProps) {
  const [activeId, setActiveId] = useState(subjects[0]?.subject.id ?? '');
  const active = subjects.find(s => s.subject.id === activeId) ?? subjects[0];

  if (subjects.length === 0) {
    return <div style={{ fontSize: 10, color: c.textFaint }}>주제 워크스페이스 없음</div>;
  }

  return (
    <div className="be-subject-workspaces" aria-label="주제 워크스페이스">
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {subjects.map(subject => {
          const isActive = subject.subject.id === active?.subject.id;
          return (
            <button
              key={subject.subject.id}
              type="button"
              onClick={() => setActiveId(subject.subject.id)}
              style={{
                padding: '3px 8px',
                fontSize: 9,
                fontWeight: isActive ? 700 : 500,
                borderRadius: 5,
                border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
                background: isActive ? c.accentBg : c.cardHov,
                color: isActive ? c.accent : c.textMuted,
                cursor: 'pointer',
              }}
            >
              {subject.subject.name}
              {subject.noteCount > 0 && (
                <span style={{ marginLeft: 4, opacity: 0.8 }}>({subject.noteCount})</span>
              )}
            </button>
          );
        })}
      </div>
      {active && (
        <SubjectWorkspacePanel
          colors={c}
          data={active}
          onNavigateToNote={onNavigateToNote}
          onOpenWorkspace={
            active.workspaceCollectionId && onActivateSubjectWorkspace
              ? () => onActivateSubjectWorkspace(active.workspaceCollectionId!)
              : undefined
          }
        />
      )}
    </div>
  );
}
