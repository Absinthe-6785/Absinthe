import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { WORKSPACE_CARD_RADIUS_CLASS } from '../../../../common/workspaceCardSizes';

export interface ArchiveCollapsibleSectionProps {
  sectionId: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  theme: { card: string; textMuted: string; border?: string };
  dark: boolean;
  children: ReactNode;
  emptyHint?: string;
  isEmpty?: boolean;
  tone?: 'primary' | 'secondary' | 'utility';
}

/** K-109 lazy archive panel with persisted collapse. */
export function ArchiveCollapsibleSection({
  sectionId,
  title,
  collapsed,
  onToggle,
  theme,
  dark,
  children,
  emptyHint,
  isEmpty = false,
  tone = 'secondary',
}: ArchiveCollapsibleSectionProps) {
  const shellClass = tone === 'primary'
    ? `${WORKSPACE_CARD_RADIUS_CLASS} shadow-md p-4 lg:p-5`
    : tone === 'utility'
      ? 'rounded-2xl border shadow-sm p-3 lg:p-4'
      : `${WORKSPACE_CARD_RADIUS_CLASS} shadow-sm p-3.5 lg:p-4`;
  const titleClass = tone === 'primary'
    ? 'font-heading text-base lg:text-lg font-bold'
    : 'font-heading text-sm font-bold';

  return (
    <section
      className={`${shellClass} flex flex-col transition-colors ${theme.card} ${tone === 'utility' ? theme.border ?? '' : ''}`}
      data-k109-archive-section={sectionId}
      data-k109-collapsed={collapsed ? 'true' : 'false'}
      data-k133c-archive-tone={tone}
      {...(sectionId === 'browse' ? { 'data-archive-browse': true } : {})}
    >
      <button
        type="button"
        className="flex items-center justify-between gap-2 w-full text-left min-h-[44px] lg:min-h-0"
        onClick={onToggle}
        aria-expanded={!collapsed}
        data-k109-section-toggle={sectionId}
      >
        <h2 className={titleClass}>{title}</h2>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''} ${theme.textMuted}`}
        />
      </button>
      {!collapsed && (
        <div className={tone === 'primary' ? 'mt-3' : 'mt-2.5'} data-k109-section-body={sectionId}>
          {isEmpty && emptyHint ? (
            <p className={`text-xs py-2 ${theme.textMuted}`} data-k109-empty-state={sectionId}>
              {emptyHint}
            </p>
          ) : children}
        </div>
      )}
    </section>
  );
}
