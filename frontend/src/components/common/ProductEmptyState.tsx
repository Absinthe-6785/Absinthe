import type { ElementType, ReactNode } from 'react';
import type { Theme } from '../../types';
import type { NoteChromeColors } from '../views/noteEditorTheme';
import { TOUCH_TARGET_MIN_PX } from '../../lib/responsiveLayout';

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

/** K-99 — friendly empty state with icon, copy, and primary CTA. */
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
      borderRadius: 10,
      padding: '8px 16px',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      minHeight: TOUCH_TARGET_MIN_PX,
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
        {...(dataHook ? { [`data-${dataHook}`]: 'true' } : {})}
        style={{
          padding: 24,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          color: c.textFaint,
        }}
      >
        <Icon size={32} strokeWidth={1.5} style={{ opacity: 0.45, color: c.textMuted }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: c.textMuted, margin: 0 }}>{title}</p>
        {description ? (
          <p style={{ fontSize: 11, lineHeight: 1.5, margin: 0, maxWidth: 240 }}>{description}</p>
        ) : null}
        {children}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
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
      {...(dataHook ? { [`data-${dataHook}`]: 'true' } : {})}
      className={`flex flex-col items-center justify-center h-full p-6 text-center ${muted}`}
    >
      <Icon size={32} strokeWidth={1.5} className="mb-3 opacity-50" />
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="text-xs opacity-80 mt-1 max-w-xs leading-relaxed">{description}</p> : null}
      {children}
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {primaryAction ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="bg-primary text-primary-foreground font-bold rounded-xl px-4 py-2.5 text-sm min-h-[44px]"
          >
            {primaryAction.label}
          </button>
        ) : null}
        {secondaryAction ? (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="border border-border rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[44px] opacity-80 hover:opacity-100"
          >
            {secondaryAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
