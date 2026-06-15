import type { LucideIcon } from 'lucide-react';
import { CARD_HEADER_ICON_SIZE } from '../../../../../theme/actionTokens';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface DashboardCardHeaderProps {
  colors: NoteChromeColors;
  icon: LucideIcon;
  title: string;
  compact?: boolean;
}

/** Shared Lucide header for knowledge dashboard cards (K-51). */
export function DashboardCardHeader({
  colors: c,
  icon: Icon,
  title,
  compact,
}: DashboardCardHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        color: c.text,
        marginBottom: compact ? 4 : 6,
      }}
    >
      <Icon size={CARD_HEADER_ICON_SIZE} strokeWidth={2.25} style={{ color: c.accent, flexShrink: 0 }} />
      <span>{title}</span>
    </div>
  );
}
