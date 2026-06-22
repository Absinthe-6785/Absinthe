import type { ElementType, ReactNode } from 'react';
import type { Theme } from '../../types';
import type { NoteChromeColors } from '../views/noteEditorTheme';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';
import { UI_DENSITY } from '../../lib/uiDensityTokens';

export interface WorkspacePageHeaderProps {
  /** Workspace identifier for tests and analytics */
  workspace: string;
  title: string;
  subtitle?: string;
  icon?: ElementType;
  trailing?: ReactNode;
  className?: string;
  variant?: 'tailwind' | 'note-chrome';
  theme?: Theme;
  colors?: NoteChromeColors;
  dark?: boolean;
  legacyHook?: string;
}

/** K-125G — unified workspace page title row (icon + title + subtitle + optional actions). */
export function WorkspacePageHeader({
  workspace,
  title,
  subtitle,
  icon: Icon,
  trailing,
  className = '',
  variant = 'tailwind',
  theme,
  colors,
  dark = false,
  legacyHook,
}: WorkspacePageHeaderProps) {
  if (variant === 'note-chrome' && colors) {
    const c = colors;
    return (
      <header
        className={className}
        data-k125-workspace-header={workspace}
        {...(legacyHook ? { [legacyHook]: true } : {})}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, width: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: UI_DENSITY.sectionTitleFontPx,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: c.text,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {Icon ? <Icon size={UI_INTERACTION.toolbarIconSizePx} strokeWidth={2.25} style={{ color: c.accent, flexShrink: 0 }} /> : null}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          </h1>
          {subtitle ? (
            <p style={{ margin: 0, fontSize: UI_DENSITY.emptyStateDescFontPx, fontWeight: 500, color: c.textMuted }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {trailing ? <div style={{ flexShrink: 0 }}>{trailing}</div> : null}
      </header>
    );
  }

  const headingClass = dark ? 'text-white' : 'text-gray-900';
  const muted = theme?.textMuted ?? 'text-muted-foreground';

  return (
    <header
      className={`flex items-start justify-between gap-3 w-full ${className}`}
      data-k125-workspace-header={workspace}
      {...(legacyHook ? { [legacyHook]: true } : {})}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <h1 className={`font-heading text-xl lg:text-2xl font-black tracking-tight flex items-center gap-2 ${headingClass}`}>
          {Icon ? <Icon size={UI_INTERACTION.toolbarIconSizePx} strokeWidth={UI_INTERACTION.toolbarIconStroke} className="text-primary shrink-0" /> : null}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle ? <p className={`text-xs font-medium ${muted}`}>{subtitle}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}
