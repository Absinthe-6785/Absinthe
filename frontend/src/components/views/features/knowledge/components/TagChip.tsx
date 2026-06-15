import type { CSSProperties, ReactNode } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface TagChipProps {
  colors: NoteChromeColors;
  tag: string;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  title?: string;
  /** Compact size for note list / header rows */
  size?: 'sm' | 'md';
  /** When true, long tag text wraps instead of clipping */
  wrap?: boolean;
  onDoubleClick?: () => void;
  /** Muted count or extra label after tag name */
  suffix?: ReactNode;
}

/** Reusable tag pill — avoids vertical/horizontal clipping in headers and panels. */
export function TagChip({
  colors: c,
  tag,
  selected = false,
  onClick,
  onRemove,
  title,
  size = 'md',
  wrap = false,
  onDoubleClick,
  suffix,
}: TagChipProps) {
  const fontSize = size === 'sm' ? 10 : 10;
  const padding = size === 'sm' ? '0 8px' : '0 8px';
  const chipHeight = 24;

  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: chipHeight,
    maxWidth: wrap ? '100%' : undefined,
    fontSize,
    lineHeight: 1,
    color: selected ? c.accent : c.tagTxt,
    background: selected ? c.cardAct : c.tag,
    border: `1px solid ${selected ? c.cardActBdr : 'transparent'}`,
    borderRadius: 999,
    padding,
    cursor: onClick ? 'pointer' : 'default',
    verticalAlign: 'middle',
    flexShrink: wrap ? 1 : 0,
    minWidth: 0,
    boxSizing: 'border-box',
  };

  const labelStyle: CSSProperties = wrap
    ? { wordBreak: 'break-word', overflowWrap: 'anywhere' }
    : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 };

  const inner = (
    <>
      <span style={labelStyle}>#{tag}</span>
      {suffix}
      {onRemove && (
        <RemoveButton colors={c} onClick={onRemove} />
      )}
    </>
  );

  const sharedProps = {
    className: 'be-tag-chip-ui' as const,
    style: base,
    title,
    onDoubleClick,
  };

  if (onClick) {
    return (
      <span
        {...sharedProps}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {inner}
      </span>
    );
  }

  return (
    <span {...sharedProps}>
      {inner}
    </span>
  );
}

function RemoveButton({ colors: c, onClick }: { colors: NoteChromeColors; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        display: 'flex',
        flexShrink: 0,
        color: c.textMuted,
        cursor: 'pointer',
        lineHeight: 1,
      }}
      aria-label="Remove tag"
    >
      <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>×</span>
    </button>
  );
}

export function TagChipRow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="be-tag-chip-row"
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
