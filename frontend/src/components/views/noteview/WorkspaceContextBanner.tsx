import { Activity, Calendar, Archive, FileText } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';
import { isEventNote, isMilestoneNote } from '../features/knowledge';
import { isHealthDayNoteTitle } from '../../../lib/healthDayNotes';

export interface WorkspaceContextBannerProps {
  colors: NoteChromeColors;
  note: Note;
  onReturnSchedule?: () => void;
  onReturnHealth?: () => void;
  onReturnArchive?: () => void;
  hasReturnSchedule?: boolean;
  hasReturnHealth?: boolean;
  hasReturnArchive?: boolean;
}

function HintChip({
  c,
  icon: Icon,
  label,
  onClick,
}: {
  c: NoteChromeColors;
  icon: typeof FileText;
  label: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 9,
        padding: '3px 8px',
        borderRadius: 999,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
        color: c.textMuted,
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 24,
      }}
    >
      <Icon size={10} />
      {label}
    </Tag>
  );
}

export function WorkspaceContextBanner({
  colors: c,
  note,
  onReturnSchedule,
  onReturnHealth,
  onReturnArchive,
  hasReturnSchedule,
  hasReturnHealth,
  hasReturnArchive,
}: WorkspaceContextBannerProps) {
  const { t } = useTranslation();
  const hints: { key: string; icon: typeof FileText; label: string; onClick?: () => void }[] = [];

  if (isEventNote(note)) {
    hints.push({
      key: 'event',
      icon: Calendar,
      label: t('wsContextScheduleEvent'),
      onClick: hasReturnSchedule ? onReturnSchedule : undefined,
    });
  }
  if (isHealthDayNoteTitle(note.title)) {
    hints.push({
      key: 'health',
      icon: Activity,
      label: t('wsContextHealthDayLog'),
      onClick: hasReturnHealth ? onReturnHealth : undefined,
    });
  }
  if (isMilestoneNote(note)) {
    hints.push({
      key: 'milestone',
      icon: Archive,
      label: t('wsContextArchiveMilestone'),
      onClick: hasReturnArchive ? onReturnArchive : undefined,
    });
  }

  if (hints.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '4px 10px 6px',
        borderBottom: `1px solid ${c.sideBdr}`,
        background: c.editor,
      }}
      data-workspace-context-banner
    >
      {hints.map(h => (
        <HintChip key={h.key} c={c} icon={h.icon} label={h.label} onClick={h.onClick} />
      ))}
    </div>
  );
}
