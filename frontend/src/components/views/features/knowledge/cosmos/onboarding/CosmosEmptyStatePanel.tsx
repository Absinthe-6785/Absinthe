import type { ReactNode } from 'react';
import type { NoteChromeColors } from '../../../../noteEditorTheme';

export interface CosmosEmptyStatePanelProps {
  colors: NoteChromeColors;
  headline: string;
  body: string;
  action?: ReactNode;
  compact?: boolean;
}

/** Dedicated empty-state block for Cosmos onboarding scenarios. */
export function CosmosEmptyStatePanel({
  colors: c,
  headline,
  body,
  action,
  compact,
}: CosmosEmptyStatePanelProps) {
  return (
    <div
      style={{
        margin: compact ? '4px 8px' : '8px 10px',
        padding: compact ? '12px 10px' : '16px 14px',
        borderRadius: 10,
        border: `1px solid ${c.sideBdr}`,
        background: `linear-gradient(160deg, ${c.accentBg} 0%, ${c.cardHov} 100%)`,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: c.text, marginBottom: 6 }}>
        {headline}
      </div>
      <div style={{ fontSize: compact ? 10 : 11, color: c.textMuted, lineHeight: 1.55, marginBottom: action ? 10 : 0 }}>
        {body}
      </div>
      {action}
    </div>
  );
}
