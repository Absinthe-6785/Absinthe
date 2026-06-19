import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface SearchCollapsibleSectionProps {
  sectionId: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  colors: NoteChromeColors;
  children: ReactNode;
}

export function SearchCollapsibleSection({
  sectionId,
  title,
  count,
  collapsed,
  onToggle,
  colors: c,
  children,
}: SearchCollapsibleSectionProps) {
  return (
    <section
      data-k111-search-section={sectionId}
      data-k111-collapsed={collapsed ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        data-k111-section-toggle={sectionId}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: 36,
          padding: '4px 10px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: c.textMuted,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {title} ({count})
        </span>
        <ChevronDown
          size={12}
          style={{ transform: collapsed ? 'rotate(-90deg)' : undefined, transition: 'transform 0.15s' }}
        />
      </button>
      {!collapsed && (
        <div data-k111-section-body={sectionId}>
          {children}
        </div>
      )}
    </section>
  );
}
