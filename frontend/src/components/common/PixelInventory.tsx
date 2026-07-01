import type { CSSProperties, ReactNode } from 'react';

export type PixelInventoryState =
  | 'ready'
  | 'blocked'
  | 'manual-review'
  | 'synced'
  | 'missing'
  | 'recoverable'
  | 'neutral';

export interface PixelInventoryColors {
  readonly card: string;
  readonly sideBdr: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textFaint: string;
  readonly accent: string;
  readonly accentBg: string;
  readonly danger: string;
  readonly green: string;
}

interface StateTone {
  readonly label: string;
  readonly motif: string;
  readonly border: string;
  readonly marker: string;
  readonly background: string;
}

function hexWithAlpha(hex: string, alpha: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${alpha}`;
  return hex;
}

function stateTone(state: PixelInventoryState, colors: PixelInventoryColors): StateTone {
  switch (state) {
    case 'ready':
      return {
        label: 'Ready',
        motif: 'Inventory slot',
        border: colors.green,
        marker: 'slot-ready',
        background: hexWithAlpha(colors.green, '0f'),
      };
    case 'blocked':
      return {
        label: 'Blocked',
        motif: 'Locked slot',
        border: colors.danger,
        marker: 'slot-locked',
        background: hexWithAlpha(colors.danger, '0d'),
      };
    case 'manual-review':
      return {
        label: 'Manual Review',
        motif: 'Review slot',
        border: colors.accent,
        marker: 'slot-review',
        background: hexWithAlpha(colors.accent, '0f'),
      };
    case 'synced':
      return {
        label: 'Synced',
        motif: 'Archived slot',
        border: colors.green,
        marker: 'slot-synced',
        background: hexWithAlpha(colors.green, '0a'),
      };
    case 'missing':
      return {
        label: 'Missing Local',
        motif: 'Broken slot',
        border: colors.danger,
        marker: 'slot-missing',
        background: hexWithAlpha(colors.danger, '0a'),
      };
    case 'recoverable':
      return {
        label: 'Recoverable',
        motif: 'Remote signal',
        border: colors.accent,
        marker: 'signal-recoverable',
        background: hexWithAlpha(colors.accent, '0d'),
      };
    case 'neutral':
    default:
      return {
        label: 'Inventory',
        motif: 'Neutral slot',
        border: colors.sideBdr,
        marker: 'slot-neutral',
        background: colors.card,
      };
  }
}

export function PixelStatusBadge({
  state,
  colors,
  label,
}: {
  readonly state: PixelInventoryState;
  readonly colors: PixelInventoryColors;
  readonly label?: string;
}) {
  const tone = stateTone(state, colors);
  const text = label ?? tone.label;
  const motif = label ? tone.label : tone.motif;
  return (
    <span
      data-pixel-status-badge
      data-pixel-inventory-state={state}
      data-pixel-marker={tone.marker}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 24,
        maxWidth: '100%',
        border: `1px solid ${hexWithAlpha(tone.border, '80')}`,
        borderRadius: 4,
        padding: '3px 7px',
        background: tone.background,
        color: colors.text,
        fontSize: 9.5,
        fontWeight: 800,
        lineHeight: 1.25,
        whiteSpace: 'normal',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          flexShrink: 0,
          border: `1px solid ${tone.border}`,
          background: tone.background,
          boxShadow: `2px 0 0 ${hexWithAlpha(tone.border, '55')}`,
        }}
      />
      <span style={{ minWidth: 0 }}>
        <span>{text}</span>
        <span style={{ color: colors.textMuted, fontWeight: 700 }}> · {motif}</span>
      </span>
    </span>
  );
}

export function PixelInventoryCard({
  state,
  colors,
  title,
  count,
  children,
  testId,
  style,
}: {
  readonly state: PixelInventoryState;
  readonly colors: PixelInventoryColors;
  readonly title: string;
  readonly count?: number;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly style?: CSSProperties;
}) {
  const tone = stateTone(state, colors);
  return (
    <div
      data-testid={testId}
      data-pixel-inventory-card
      data-pixel-inventory-state={state}
      data-pixel-marker={tone.marker}
      style={{
        border: `1px solid ${hexWithAlpha(tone.border, '66')}`,
        borderRadius: 4,
        padding: 9,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: `linear-gradient(135deg, ${tone.background}, ${colors.card} 48%)`,
        boxShadow: `inset 3px 0 0 ${hexWithAlpha(tone.border, '66')}`,
        minWidth: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: colors.text, minWidth: 0, overflowWrap: 'anywhere' }}>{title}</div>
          {count !== undefined ? (
            <div
              data-pixel-inventory-count
              data-testid={testId ? `${testId}-count` : undefined}
              style={{
                marginLeft: 6,
                border: `1px solid ${hexWithAlpha(tone.border, '55')}`,
                borderRadius: 4,
                padding: '1px 5px',
                background: colors.card,
                fontSize: 10,
                color: colors.textMuted,
                fontWeight: 800,
                lineHeight: 1.25,
                flexShrink: 0,
              }}
            >
              {count}
            </div>
          ) : null}
        </div>
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-start', minWidth: 0, paddingTop: 1 }}>
        <PixelStatusBadge state={state} colors={colors} />
      </div>
    </div>
  );
}
