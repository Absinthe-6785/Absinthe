import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { WORKSPACE_CARD_SURFACE } from '../../../../common/workspaceCardSizes';

export interface ArchiveCollapsibleSectionProps {
  sectionId: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  theme: { card: string; textMuted: string };
  dark: boolean;
  children: ReactNode;
  emptyHint?: string;
  isEmpty?: boolean;
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
}: ArchiveCollapsibleSectionProps) {
  return (
    <section
      className={`${WORKSPACE_CARD_SURFACE} flex flex-col transition-colors ${theme.card}`}
      data-k109-archive-section={sectionId}
      data-k109-collapsed={collapsed ? 'true' : 'false'}
      {...(sectionId === 'browse' ? { 'data-archive-browse': true } : {})}
    >
      <button
        type="button"
        className="flex items-center justify-between gap-2 w-full text-left min-h-[44px] lg:min-h-0"
        onClick={onToggle}
        aria-expanded={!collapsed}
        data-k109-section-toggle={sectionId}
      >
        <h2 className="font-heading text-sm font-bold">{title}</h2>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''} ${theme.textMuted}`}
        />
      </button>
      {!collapsed && (
        <div className="mt-2" data-k109-section-body={sectionId}>
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
