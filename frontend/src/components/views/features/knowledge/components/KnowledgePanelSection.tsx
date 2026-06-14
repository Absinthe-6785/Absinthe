import type { CSSProperties, ReactNode } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface KnowledgePanelSectionProps {
  colors: NoteChromeColors;
  title: string;
  count?: number;
  /** Omit top border on first section in a panel */
  first?: boolean;
  hint?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

/** Shared section header for NoteView context panels — consistent rhythm and counts. */
export function KnowledgePanelSection({
  colors: c,
  title,
  count,
  first = false,
  hint,
  children,
  style,
}: KnowledgePanelSectionProps) {
  return (
    <section
      className="be-knowledge-panel-section"
      style={{
        padding: '0 0 6px',
        borderTop: first ? undefined : `1px solid ${c.sideBdr}`,
        ...style,
      }}
    >
      <div
        style={{
          padding: first ? '8px 10px 4px' : '10px 10px 4px',
          fontSize: 10,
          color: c.textMuted,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        <span>{title}</span>
        {count !== undefined && (
          <span style={{ color: count > 0 ? c.accent : c.textFaint, fontWeight: 700, textTransform: 'none' }}>
            ({count})
          </span>
        )}
        {hint && (
          <span style={{ fontWeight: 400, textTransform: 'none', color: c.textFaint, fontSize: 9, marginLeft: 'auto' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function KnowledgePanelEmpty({
  colors: c,
  children,
  actionLabel,
  onAction,
}: {
  colors: NoteChromeColors;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 10px 8px' }}>
      <p style={{ fontSize: 11, color: c.textFaint, margin: '0 0 8px', lineHeight: 1.5 }}>
        {children}
      </p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: `1px solid ${c.accent}`,
            background: c.accentBg,
            color: c.accent,
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
