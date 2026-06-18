import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useResizablePanelWidth } from '../../../../../hooks/useResizablePanelWidth';

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

/** Primary tabs — high-frequency navigation (K-81, K-89B1: Discover promoted). */
export const KNOWLEDGE_CONTEXT_PRIMARY_TABS: readonly KnowledgeContextTab[] = [
  'toc', 'links', 'graph', 'discover', 'properties',
];

const PRIMARY_TAB_KEYS = KNOWLEDGE_CONTEXT_PRIMARY_TABS;

export interface KnowledgeContextPanelProps {
  colors: NoteChromeColors;
  compact?: boolean;
  tablet?: boolean;
  activeTab: KnowledgeContextTab;
  tabs: readonly KnowledgeContextTabDef[];
  onTabChange: (tab: KnowledgeContextTab) => void;
  children: ReactNode;
}

/** Unified right-side Knowledge Context shell — resizable width (K-79). */
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
  const { width, onResizeDrag } = useResizablePanelWidth(compact, tablet);
  const asideRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const primaryTabs = tabs.filter(tab => PRIMARY_TAB_KEYS.includes(tab.key));
  const moreTabs = tabs.filter(tab => !PRIMARY_TAB_KEYS.includes(tab.key));
  const activeInMore = moreTabs.some(tab => tab.key === activeTab);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = moreRef.current;
      if (el && !el.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = moreRef.current;
      if (el && !el.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [moreOpen]);

  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const aside = asideRef.current;
    if (!aside) return;
    const right = aside.getBoundingClientRect().right;
    const pointerId = e.pointerId;
    aside.setPointerCapture(pointerId);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      onResizeDrag(ev.clientX, right);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      aside.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [onResizeDrag]);

  return (
    <aside
      ref={asideRef}
      aria-label={t('nvSidePanel')}
      className={compact ? 'mobile-panel-drawer' : undefined}
      style={{
        width: compact ? undefined : width,
        minWidth: compact ? undefined : width,
        background: c.sidebar,
        borderLeft: `1px solid ${c.sideBdr}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        zIndex: compact ? 150 : undefined,
      }}
    >
      {!compact ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('k79ContextPanelResize')}
          onPointerDown={startResize}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            cursor: 'col-resize',
            zIndex: 2,
          }}
          data-knowledge-panel-resize
        />
      ) : null}

      <div
        className="bsticky-header"
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
        className="bsticky-header"
        style={{
          display: 'flex',
          borderBottom: `1px solid ${c.sideBdr}`,
          flexShrink: 0,
          overflowX: 'auto',
          position: 'relative',
          flexWrap: 'nowrap',
        }}
      >
        {primaryTabs.map(({ key, label, icon, hint }) => {
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
                minHeight: compact ? 44 : undefined,
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
        {moreTabs.length > 0 ? (
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              role="tab"
              aria-selected={activeInMore}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title={t('k81ContextMoreTabs')}
              onClick={() => setMoreOpen(v => !v)}
              style={{
                minHeight: compact ? 44 : undefined,
                background: 'none',
                border: 'none',
                borderBottom: activeInMore ? `2px solid ${c.accent}` : '2px solid transparent',
                padding: '8px 8px',
                cursor: 'pointer',
                color: activeInMore ? c.accent : c.textMuted,
                fontSize: 9,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <ChevronDown size={12}/>
              <span>{t('k81ContextMore')}</span>
            </button>
            {moreOpen ? (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  zIndex: 20,
                  minWidth: 140,
                  maxHeight: 'min(280px, 50vh)',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  background: c.card,
                  border: `1px solid ${c.sideBdr}`,
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                  padding: 4,
                }}
              >
                {moreTabs.map(({ key, label, icon, hint }) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    title={hint ?? label}
                    onClick={() => { onTabChange(key); setMoreOpen(false); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 8px',
                      border: 'none',
                      borderRadius: 6,
                      background: activeTab === key ? c.accentBg : 'transparent',
                      color: activeTab === key ? c.accent : c.text,
                      fontSize: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="bscroll-pane" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain' }}>
        {children}
      </div>
    </aside>
  );
}
