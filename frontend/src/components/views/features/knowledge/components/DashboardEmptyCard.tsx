import type { LucideIcon } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { DashboardCardHeader } from './DashboardCardHeader';

export interface DashboardEmptyCardProps {
  colors: NoteChromeColors;
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  compact?: boolean;
}

/** Placeholder dashboard card when a section has no data yet (K-53). */
export function DashboardEmptyCard({
  colors: c,
  icon,
  title,
  message,
  actionLabel,
  onAction,
  compact,
}: DashboardEmptyCardProps) {
  return (
    <div
      style={{
        marginBottom: compact ? 10 : 12,
        padding: compact ? '10px 12px' : '12px 14px',
        borderRadius: 8,
        border: `1px dashed ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <DashboardCardHeader colors={c} icon={icon} title={title} compact={compact} />
      <p style={{ fontSize: 10, color: c.textFaint, lineHeight: 1.5, margin: '0 0 8px' }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onAction}
        style={{
          fontSize: 9,
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: 5,
          border: `1px solid ${c.accent}`,
          background: c.accentBg,
          color: c.accent,
          cursor: 'pointer',
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}
