import type { NoteChromeColors } from '../../views/noteEditorTheme';

export interface DashboardSectionTitleProps {
  colors: NoteChromeColors;
  children: string;
  first?: boolean;
}

/** Section heading for knowledge dashboard layouts (K-56). */
export function DashboardSectionTitle({ colors: c, children, first }: DashboardSectionTitleProps) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: c.textMuted,
      margin: first ? '0 0 6px' : '12px 0 6px',
    }}>
      {children}
    </div>
  );
}
