import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

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
  /** K-125D — major accordion panel (history, deleted, snapshots, timeline). */
  major?: boolean;
}

/** K-109 lazy archive panel with persisted collapse. K-125D compact density. */
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
  major = false,
}: ArchiveCollapsibleSectionProps) {
  return (
    <section
      className={`rounded-[16px] lg:rounded-[20px] shadow-sm p-3 lg:p-3.5 flex flex-col transition-colors scroll-mt-2 ${theme.card}`}
      data-k109-archive-section={sectionId}
      data-k109-collapsed={collapsed ? 'true' : 'false'}
      {...(major ? { 'data-k125d-archive-major': sectionId } : {})}
      {...(sectionId === 'browse' ? { 'data-archive-browse': true } : {})}
    >
      <button
        type="button"
        className="flex items-center justify-between gap-2 w-full text-left min-h-[40px] lg:min-h-[36px]"
        onClick={onToggle}
        aria-expanded={!collapsed}
        data-k109-section-toggle={sectionId}
        data-k125d-section-toggle={sectionId}
      >
        <h2 className="font-heading text-sm font-bold">{title}</h2>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''} ${theme.textMuted}`}
        />
      </button>
      {!collapsed && (
        <div className="mt-1.5" data-k109-section-body={sectionId}>
          {isEmpty && emptyHint ? (
            <p className={`text-xs py-1 ${theme.textMuted}`} data-k109-empty-state={sectionId} data-k125d-empty-compact>
              {emptyHint}
            </p>
          ) : children}
        </div>
      )}
    </section>
  );
}
