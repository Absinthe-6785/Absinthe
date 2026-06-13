/**
 * WikiMenu.tsx — Wiki link autocomplete popup (Korean labels)
 */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from '../../../../../../../lib/i18n';
import type { BlockEditorColors } from '../../../../../editorTypes';
import { filterWikiTargets } from '../utils/wikiSearch';

export interface WikiMenuProps {
  query: string;
  targets: string[];
  anchorY: number;
  anchorX: number;
  colors: BlockEditorColors;
  onSelect: (title: string) => void;
  onClose: () => void;
}

export function WikiMenu({ query, targets, anchorY, anchorX, colors: c, onSelect, onClose }: WikiMenuProps) {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => filterWikiTargets(query, targets), [query, targets]);

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(v => Math.min(v + 1, items.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(v => Math.max(v - 1, 0)); }
      if (e.key === 'Enter') { if (items[cursor]) { e.preventDefault(); onSelect(items[cursor]); } }
      if (e.key === 'Escape') { onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [items, cursor, onSelect, onClose]);

  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const top = Math.min(anchorY + 8, window.innerHeight - 300);
  const left = Math.min(anchorX, window.innerWidth - 240);

  return (
    <div ref={menuRef} style={{
      position: 'fixed', top, left, zIndex: 400,
      background: c.card, border: `1px solid ${c.border}`,
      borderRadius: c.radiusModal ?? 16, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
      width: 230, maxHeight: 300, overflowY: 'auto', padding: '6px 0',
    }}>
      <div style={{ padding: '3px 12px 6px', fontSize: 10, color: c.textFaint, borderBottom: `1px solid ${c.border}`, marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>
        {t('wikiMenuTitle')}
      </div>
      {items.length === 0 && (
        <div style={{ padding: 12, color: c.textFaint, fontSize: 13, textAlign: 'center' }}>
          {query ? t('wikiMenuNoMatch') : t('wikiMenuEmpty')}
        </div>
      )}
      {items.map((title, idx) => {
        const active = cursor === idx;
        return (
          <button key={title + idx} data-idx={idx}
            onMouseDown={e => { e.preventDefault(); onSelect(title); }}
            onMouseEnter={() => setCursor(idx)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '7px 12px', background: active ? c.accentBg : 'none',
              border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 11, color: c.textFaint, flexShrink: 0 }}>📄</span>
            <span style={{ fontSize: 13, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
