import type { MouseEvent } from 'react';
import { Pin, PinOff } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface WorkspacePinToggleProps {
  colors: NoteChromeColors;
  pinned: boolean;
  title?: string;
  onToggle: (e: MouseEvent) => void;
}

export function WorkspacePinToggle({
  colors: c,
  pinned,
  title,
  onToggle,
}: WorkspacePinToggleProps) {
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: pinned ? c.accent : c.textMuted, padding: 0 }}
      title={title ?? (pinned ? 'Unpin workspace' : 'Pin workspace')}
    >
      <Icon size={9} />
    </button>
  );
}
