import { FolderKanban, Flag, Orbit } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface ProjectQuickActionsProps {
  colors: NoteChromeColors;
  onCreateProject: () => void;
  onCreateMilestone: () => void;
  onOpenProjectNotes: () => void;
}

function ActionButton({
  c,
  icon: Icon,
  label,
  onClick,
}: {
  c: NoteChromeColors;
  icon: typeof Orbit;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        minWidth: 120,
        padding: '8px 10px',
        fontSize: 10,
        fontWeight: 600,
        borderRadius: 6,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
        color: c.text,
        cursor: 'pointer',
      }}
    >
      <Icon size={12} color={c.accent} />
      {label}
    </button>
  );
}

/** Property-driven project shortcuts — no modal or schema changes. */
export function ProjectQuickActions({
  colors: c,
  onCreateProject,
  onCreateMilestone,
  onOpenProjectNotes,
}: ProjectQuickActionsProps) {
  return (
    <div
      className="be-project-quick-actions"
      aria-label="프로젝트 빠른 작업"
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}
    >
      <ActionButton c={c} icon={Orbit} label="프로젝트 만들기" onClick={onCreateProject} />
      <ActionButton c={c} icon={Flag} label="마일스톤 만들기" onClick={onCreateMilestone} />
      <ActionButton c={c} icon={FolderKanban} label="프로젝트 노트 열기" onClick={onOpenProjectNotes} />
    </div>
  );
}
