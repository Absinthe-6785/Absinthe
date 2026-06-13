import { FolderKanban, Flag, Orbit, Pencil } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
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
  const { t } = useTranslation();
  return (
    <div
      className="be-project-quick-actions"
      aria-label={t('knProjectQuickActionsAria')}
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, flexDirection: compact ? 'column' : 'row' }}
    >
      <ActionButton c={c} icon={Orbit} label={t('createProjectTitle')} onClick={onCreateProject} compact={compact} />
      <ActionButton c={c} icon={Flag} label={t('createMilestoneTitle')} onClick={onCreateMilestone} compact={compact} />
      {onEditProject && (
        <ActionButton c={c} icon={Pencil} label={t('knEditProject')} onClick={onEditProject} compact={compact} />
      )}
      <ActionButton c={c} icon={FolderKanban} label={t('knOpenProjectNotes')} onClick={onOpenProjectNotes} compact={compact} />
    </div>
  );
}
