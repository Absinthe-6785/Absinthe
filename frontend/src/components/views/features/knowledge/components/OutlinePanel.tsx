import { ChevronDown, ChevronRight } from 'lucide-react';
import type { KeyboardEvent, RefObject } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { TocItem } from '../../../noteUtils';
import { KnowledgePanelEmpty, KnowledgePanelSection } from './KnowledgePanelSection';

export interface OutlinePanelItem extends TocItem {
  idx: number;
  hasChildren: boolean;
}

export interface OutlinePanelProps {
  colors: NoteChromeColors;
  panelRef: RefObject<HTMLDivElement | null>;
  items: readonly OutlinePanelItem[];
  highlightedIdx: number | null;
  collapsed: Readonly<Record<number, boolean>>;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onToggleCollapse: (idx: number) => void;
  onNavigate: (idx: number) => void;
}

/** Note outline (TOC) — keyboard navigable, collapsible sections. */
export function OutlinePanel({
  colors: c,
  panelRef,
  items,
  highlightedIdx,
  collapsed,
  onKeyDown,
  onToggleCollapse,
  onNavigate,
}: OutlinePanelProps) {
  const { t } = useTranslation();

  return (
    <KnowledgePanelSection
      colors={c}
      first
      title={t('nvPanelToc')}
      count={items.length}
      hint={items.length > 0 ? t('nvTocKeyboardHint') : undefined}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0, borderTop: 'none' }}
    >
      <div
        ref={panelRef}
        role="listbox"
        tabIndex={0}
        aria-label={t('nvTocKeyboardHint')}
        onKeyDown={onKeyDown}
        style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px', outline: 'none' }}
      >
        {items.length === 0 ? (
          <>
            <KnowledgePanelEmpty colors={c}>{t('k35OutlineEmpty')}</KnowledgePanelEmpty>
            <p style={{ fontSize: 10, color: c.textFaint, textAlign: 'center', padding: '0 10px 12px', margin: 0, lineHeight: 1.5 }}>
              {t('k35OutlineToggleHint')}
            </p>
          </>
        ) : (
          items.map(item => (
            <div
              key={item.idx}
              role="option"
              aria-selected={highlightedIdx === item.idx}
              data-toc-idx={item.idx}
              className={`btoc${highlightedIdx === item.idx ? ' active' : ''}`}
              style={{ paddingLeft: 8 + (item.level - 1) * 12 }}
              onClick={() => onNavigate(item.idx)}
            >
              {item.hasChildren ? (
                <button
                  type="button"
                  aria-label={collapsed[item.idx] ? t('nvExpandSection') : t('nvCollapseSection')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                  onClick={e => { e.stopPropagation(); onToggleCollapse(item.idx); }}
                >
                  {collapsed[item.idx]
                    ? <ChevronRight size={10} style={{ color: c.textFaint }}/>
                    : <ChevronDown size={10} style={{ color: c.textFaint }}/>}
                </button>
              ) : (
                <span style={{ width: 10, display: 'inline-block', flexShrink: 0 }}/>
              )}
              <span style={{ fontSize: 8, color: item.level === 1 ? c.accent : c.textFaint, marginRight: 3, fontWeight: 700 }}>
                H{item.level}{item.isToggleHeading ? '▼' : ''}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: 11 }}>
                {item.text || t('outlineUntitled')}
              </span>
            </div>
          ))
        )}
      </div>
    </KnowledgePanelSection>
  );
}
