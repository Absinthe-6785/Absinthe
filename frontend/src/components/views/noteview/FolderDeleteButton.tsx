import { Trash2 } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { folderDeleteActionLabel } from './folderDeletionPresentation';

interface FolderDeleteButtonProps {
  folderName: string;
  color: string;
  onRequestDelete: () => void;
}

export function FolderDeleteButton({ folderName, color, onRequestDelete }: FolderDeleteButtonProps) {
  const { t } = useTranslation();
  const accessibleName = folderDeleteActionLabel(t, folderName);
  return (
    <button
      type="button"
      aria-label={accessibleName}
      title={accessibleName}
      onClick={event => {
        event.stopPropagation();
        onRequestDelete();
      }}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color,
        padding: 0,
        borderRadius: 4,
        minWidth: 24,
        minHeight: 24,
      }}
      className="folder-del abs-focus-ring"
      data-folder-delete-action
    >
      <Trash2 size={12} aria-hidden/>
    </button>
  );
}
