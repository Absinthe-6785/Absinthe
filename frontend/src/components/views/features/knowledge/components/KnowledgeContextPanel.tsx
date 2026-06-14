import type { ReactNode } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export type KnowledgeContextTab =
  | 'toc'
  | 'links'
  | 'graph'
  | 'insights'
  | 'actions'
  | 'discover'
  | 'timeline'
  | 'properties'
  | 'tags'
  | 'relations'
  | 'stats';

export interface KnowledgeContextTabDef {
  key: KnowledgeContextTab;
  label: string;
  icon: ReactNode;
  /** Longer tooltip when tab label is ambiguous (e.g. Timeline vs Archive). */
  hint?: string;
}

export interface KnowledgeContextPanelProps {
  colors: NoteChromeColors;
  compact?: boolean;
  tablet?: boolean;
  activeTab: KnowledgeContextTab;
  tabs: readonly KnowledgeContextTabDef[];
  onTabChange: (tab: KnowledgeContextTab) => void;
  children: ReactNode;
}

/** Unified right-side Knowledge Context shell — tab bar, header, scroll body. */
export function KnowledgeContextPanel({
  colors: c,
  compact,
  tablet,
  activeTab,
  tabs,
  onTabChange,
  children,
}: KnowledgeContextPanelProps) {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t('nvSidePanel')}
      className={compact ? 'mobile-panel-drawer' : undefined}
      style={{
        width: compact ? undefined : (tablet ? 210 : 230),
        minWidth: compact ? undefined : (tablet ? 210 : 230),
        background: c.sidebar,
        borderLeft: `1px solid ${c.sideBdr}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: compact ? 150 : undefined,
      }}
    >
      <div
        style={{
          padding: '8px 10px 6px',
          borderBottom: `1px solid ${c.sideBdr}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: c.textMuted,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {t('k35ContextPanelTitle')}
        </div>
        <div style={{ fontSize: 9, color: c.textFaint, lineHeight: 1.4 }}>
          {t('k35ContextPanelSubtitle')}
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t('k35ContextPanelTabs')}
        style={{
          display: 'flex',
          borderBottom: `1px solid ${c.sideBdr}`,
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {tabs.map(({ key, label, icon, hint }) => {
          const selected = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              title={hint ?? label}
              onClick={() => onTabChange(key)}
              style={{
                flex: '1 0 auto',
                minWidth: 0,
                background: 'none',
                border: 'none',
                borderBottom: selected ? `2px solid ${c.accent}` : '2px solid transparent',
                padding: '8px 4px',
                cursor: 'pointer',
                color: selected ? c.accent : c.textMuted,
                fontSize: 9,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}>
                {icon}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </aside>
  );
}
