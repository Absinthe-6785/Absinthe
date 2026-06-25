import type { ElementType, ReactNode } from 'react';
import type { Theme } from '../../types';
import type { NoteChromeColors } from '../views/noteEditorTheme';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';
import { UI_DENSITY } from '../../lib/uiDensityTokens';
import { WORKSPACE_BTN_PRIMARY_CLASS, WORKSPACE_BTN_SECONDARY_CLASS } from './workspaceCardSizes';

export interface ProductEmptyAction {
  label: string;
  onClick: () => void;
}

export interface ProductEmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  primaryAction?: ProductEmptyAction;
  secondaryAction?: ProductEmptyAction;
  /** Audit / test hook, e.g. data-notes-empty */
  dataHook?: string;
  variant?: 'tailwind' | 'note-chrome';
  theme?: Theme;
  colors?: NoteChromeColors;
  children?: ReactNode;
}

/** K-99 / K-127 — friendly empty state with icon, copy, and primary CTA. */
export function ProductEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  dataHook,
  variant = 'tailwind',
  theme,
  colors,
  children,
}: ProductEmptyStateProps) {
  if (variant === 'note-chrome' && colors) {
    const c = colors;
    const btnPrimary = {
      background: c.accent,
      color: '#fff',
      border: 'none',
      borderRadius: UI_INTERACTION.btnRadiusPx,
      padding: '8px 16px',
      fontSize: UI_DENSITY.sectionLabelFontPx,
      fontWeight: 700,
      cursor: 'pointer',
      minHeight: UI_INTERACTION.touchTargetMinPx,
    } as const;
    const btnSecondary = {
      ...btnPrimary,
      background: 'transparent',
      color: c.textMuted,
      border: `1px solid ${c.inputBdr}`,
      fontWeight: 600,
    } as const;

    return (
      <div
        role="status"
        data-product-empty={dataHook ?? true}
        data-k127-empty-state
        {...(dataHook ? { [`data-${dataHook}`]: 'true' } : {})}
        style={{
          padding: UI_DENSITY.emptyStatePaddingPx,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: UI_DENSITY.emptyStateGapPx,
          color: c.textFaint,
        }}
      >
        <Icon size={UI_DENSITY.emptyStateIconSizePx} strokeWidth={1.5} style={{ opacity: 0.45, color: c.textMuted }} />
        <p style={{ fontSize: UI_DENSITY.emptyStateTitleFontPx, fontWeight: 600, color: c.textMuted, margin: 0 }}>{title}</p>
        {description ? (
          <p style={{ fontSize: UI_DENSITY.emptyStateDescFontPx, lineHeight: 1.5, margin: 0, maxWidth: UI_DENSITY.emptyStateDescMaxWidthPx }}>{description}</p>
        ) : null}
        {children}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: UI_INTERACTION.toolbarActionGapPx, justifyContent: 'center', marginTop: 4 }}>
          {primaryAction ? (
            <button type="button" className="bwbg k99-interactive" onClick={primaryAction.onClick} style={btnPrimary}>
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button type="button" className="k99-interactive" onClick={secondaryAction.onClick} style={btnSecondary}>
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const muted = theme?.textMuted ?? 'text-muted-foreground';
  return (
    <div
      role="status"
      data-product-empty={dataHook ?? true}
      data-k127-empty-state
      {...(dataHook ? { [`data-${dataHook}`]: 'true' } : {})}
      className={`flex flex-col items-center justify-center min-h-[120px] p-4 text-center ${muted}`}
      data-k119-empty-state
    >
      <Icon size={UI_DENSITY.emptyStateIconSizePx} strokeWidth={1.5} className="mb-2 opacity-50" />
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="text-xs opacity-80 mt-1 max-w-xs leading-relaxed">{description}</p> : null}
      {children}
      <div className={`flex flex-wrap gap-2 justify-center mt-3`}>
        {primaryAction ? (
          <button type="button" onClick={primaryAction.onClick} className={`${WORKSPACE_BTN_PRIMARY_CLASS} px-4 py-2.5`}>
            {primaryAction.label}
          </button>
        ) : null}
        {secondaryAction ? (
          <button type="button" onClick={secondaryAction.onClick} className={`${WORKSPACE_BTN_SECONDARY_CLASS} px-4 py-2.5 opacity-80 hover:opacity-100`}>
            {secondaryAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
