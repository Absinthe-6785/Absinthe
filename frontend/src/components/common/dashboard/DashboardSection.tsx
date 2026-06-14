import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import type { Theme } from '@/types';

export interface DashboardSectionProps {
  theme: Theme;
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  sectionId?: string;
}

/** Navigable dashboard section card for health/schedule workspaces (K-56). */
export function DashboardSection({
  theme,
  icon: Icon,
  title,
  onClick,
  children,
  sectionId,
}: DashboardSectionProps) {
  const cardClass = `rounded-[20px] p-4 ${theme.card} border ${theme.border}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${cardClass} text-left w-full hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
      data-health-dashboard-section={sectionId}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-sm font-bold flex items-center gap-2">
          <Icon size={16} strokeWidth={2.25} className="text-primary" />
          {title}
        </h3>
        <ChevronRight size={14} className={theme.textMuted} />
      </div>
      {children}
    </button>
  );
}
