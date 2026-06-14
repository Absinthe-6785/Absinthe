import type { CSSProperties, ReactNode } from 'react';
import type { NoteChromeColors } from '../../../../noteEditorTheme';

export function ActionButton({
  c,
  children,
  onClick,
  variant = 'primary',
  style,
}: {
  c: NoteChromeColors;
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  style?: CSSProperties;
}) {
  const primary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      className="btbtn"
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 5,
        border: `1px solid ${primary ? c.accent : c.sideBdr}`,
        background: primary ? c.accentBg : c.cardHov,
        color: primary ? c.accent : c.textMuted,
        cursor: 'pointer',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ActionCard({
  c,
  title,
  description,
  actions,
}: {
  c: NoteChromeColors;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        margin: '0 8px 6px',
        padding: '7px 9px',
        borderRadius: 7,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{title}</div>
          {description && (
            <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>{description}</div>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
