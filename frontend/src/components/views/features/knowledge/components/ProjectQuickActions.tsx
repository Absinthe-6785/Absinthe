import { FolderKanban, Flag, Orbit, Pencil } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface ProjectQuickActionsProps {
  colors: NoteChromeColors;
  onCreateProject: () => void;
  onCreateMilestone: () => void;
  onOpenProjectNotes: () => void;
  onEditProject?: () => void;
  compact?: boolean;
}

function ActionButton({
  c,
  icon: Icon,
  label,
  onClick,
  compact,
}: {
  c: NoteChromeColors;
  icon: typeof Orbit;
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: compact ? '1 1 100%' : 1,
        minWidth: compact ? undefined : 120,
        width: compact ? '100%' : undefined,
        minHeight: compact ? 44 : undefined,
        padding: compact ? '10px 12px' : '8px 10px',
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
  onEditProject,
  compact,
}: ProjectQuickActionsProps) {
  return (
    <div
      className="be-project-quick-actions"
      aria-label="프로젝트 빠른 작업"
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, flexDirection: compact ? 'column' : 'row' }}
    >
      <ActionButton c={c} icon={Orbit} label="프로젝트 만들기" onClick={onCreateProject} compact={compact} />
      <ActionButton c={c} icon={Flag} label="마일스톤 만들기" onClick={onCreateMilestone} compact={compact} />
      {onEditProject && (
        <ActionButton c={c} icon={Pencil} label="프로젝트 편집" onClick={onEditProject} compact={compact} />
      )}
      <ActionButton c={c} icon={FolderKanban} label="프로젝트 노트 열기" onClick={onOpenProjectNotes} compact={compact} />
    </div>
  );
}
