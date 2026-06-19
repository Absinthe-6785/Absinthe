import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface RecipeCollapsibleSectionProps {
  sectionId: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  theme: { card: string; textMuted: string };
  dark: boolean;
  children: ReactNode;
  emptyHint?: string;
  isEmpty?: boolean;
  lazy?: boolean;
}

/** K-110 lazy recipe panel with persisted collapse. */
export function RecipeCollapsibleSection({
  sectionId,
  title,
  collapsed,
  onToggle,
  theme,
  dark,
  children,
  emptyHint,
  isEmpty = false,
  lazy = false,
}: RecipeCollapsibleSectionProps) {
  return (
    <section
      className={`rounded-[16px] lg:rounded-[20px] shadow-sm p-3 lg:p-4 flex flex-col transition-colors ${theme.card}`}
      data-k110-recipe-section={sectionId}
      data-k110-collapsed={collapsed ? 'true' : 'false'}
      data-k110-lazy-section={lazy ? sectionId : undefined}
    >
      <button
        type="button"
        className="flex items-center justify-between gap-2 w-full text-left min-h-[44px] lg:min-h-0"
        onClick={onToggle}
        aria-expanded={!collapsed}
        data-k110-section-toggle={sectionId}
      >
        <h2 className="font-heading text-sm font-bold">{title}</h2>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''} ${theme.textMuted}`}
        />
      </button>
      {!collapsed && (
        <div className="mt-1.5" data-k110-section-body={sectionId}>
          {isEmpty && emptyHint ? (
            <p className={`text-xs py-2 ${theme.textMuted}`} data-k110-empty-state={sectionId}>
              {emptyHint}
            </p>
          ) : children}
        </div>
      )}
    </section>
  );
}
