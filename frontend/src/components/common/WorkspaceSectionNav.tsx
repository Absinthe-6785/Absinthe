import type { ElementType } from 'react';
import type { Theme } from '../../types';
import type { NoteChromeColors } from '../views/noteEditorTheme';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';

export interface WorkspaceSectionNavItem {
  id: string;
  icon?: ElementType;
  label: string;
}

export interface WorkspaceSectionNavProps {
  items: readonly WorkspaceSectionNavItem[];
  /** Toggle switches sections; anchor scrolls to in-page targets. */
  mode: 'toggle' | 'anchor';
  active?: string;
  onSelect?: (id: string) => void;
  theme?: Theme;
  colors?: NoteChromeColors;
  compact?: boolean;
  /** K-126C — tighter filter chips for notes sidebar. */
  dense?: boolean;
  ariaLabel: string;
  dataHook: string;
  legacyHook?: string;
  className?: string;
  variant?: 'tailwind' | 'note-chrome';
}

/** K-125G — shared in-workspace section navigation (toggle tabs or anchor links). */
export function WorkspaceSectionNav({
  items,
  mode,
  active,
  onSelect,
  theme,
  colors,
  compact = false,
  dense = false,
  ariaLabel,
  dataHook,
  legacyHook,
  className = '',
  variant = 'tailwind',
}: WorkspaceSectionNavProps) {
  if (variant === 'note-chrome' && colors) {
    const c = colors;
    return (
      <nav
        aria-label={ariaLabel}
        role={mode === 'toggle' ? 'tablist' : undefined}
        className={className}
        data-k125-section-nav={dataHook}
        {...(legacyHook ? { [legacyHook]: true } : {})}
        style={{ display: 'flex', gap: dense ? 3 : 4, flexShrink: 0 }}
      >
        {items.map(({ id, label }) => {
          const selected = mode === 'toggle' && active === id;
          const chipPad = dense ? '4px 6px' : compact ? '6px 8px' : '4px 10px';
          const chipMinH = dense ? 28 : UI_INTERACTION.touchTargetMinPx;
          return (
            <button
              key={id}
              type="button"
              role={mode === 'toggle' ? 'tab' : undefined}
              aria-selected={mode === 'toggle' ? selected : undefined}
              onClick={() => onSelect?.(id)}
              data-k125-section-nav-item={id}
              style={{
                flex: compact ? 1 : undefined,
                minWidth: compact ? 0 : undefined,
                minHeight: chipMinH,
                fontSize: dense ? 9 : 10,
                fontWeight: 700,
                padding: chipPad,
                borderRadius: dense ? 6 : 8,
                border: `1px solid ${selected ? c.accent : c.sideBdr}`,
                background: selected ? c.accentBg : 'transparent',
                color: selected ? c.accent : c.textMuted,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>
    );
  }

  const muted = theme?.textMuted ?? 'text-muted-foreground';
  const input = theme?.input ?? 'bg-muted/40';

  return (
    <nav
      aria-label={ariaLabel}
      className={`flex shrink-0 overflow-x-auto pb-0.5 ${mode === 'toggle' ? 'gap-1.5' : 'gap-1'} ${compact ? 'overflow-x-auto pb-1' : ''} ${className}`}
      data-k125-section-nav={dataHook}
      {...(legacyHook ? { [legacyHook]: true } : {})}
    >
      {items.map(({ id, icon: Icon, label }) => {
        const selected = mode === 'toggle' && active === id;
        const anchor = mode === 'anchor';
        const unselectedToggle = `${input} ${muted} hover:text-foreground`;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect?.(id)}
            aria-current={selected ? 'page' : undefined}
            data-k125-section-nav-item={id}
            className={`flex items-center font-bold transition-colors whitespace-nowrap shrink-0
              ${anchor
                ? `gap-1 rounded-lg ${compact ? 'min-h-[36px] px-2 py-1.5 text-[10px]' : 'min-h-[32px] px-2.5 py-1.5 text-[11px]'} ${input} ${muted} hover:text-foreground hover:bg-muted/50`
                : `gap-1.5 rounded-xl ${compact ? 'flex-1 min-w-0 min-h-[44px] px-2 py-2.5 text-[10px] justify-center' : 'px-3 py-2 text-xs'} ${
                  selected ? 'bg-primary text-primary-foreground shadow-sm' : unselectedToggle
                }`}`}
          >
            {Icon ? <Icon size={compact ? 12 : anchor ? 13 : 15} strokeWidth={2.25} className="shrink-0" /> : null}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
