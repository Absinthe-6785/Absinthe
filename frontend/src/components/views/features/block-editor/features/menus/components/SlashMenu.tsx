/**
 * SlashMenu.tsx — Slash command popup (extracted from BlockEditor)
 */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { blockTypeDesc, blockTypeLabel } from '../../../blockEditorLabels';
import type { BlockTypeMeta } from '../../../../../blockUtils';
import { slashMenuItemKey } from '../../../../../blockUtils';
import { buildSlashPalette } from '../utils/slashPalette';
import type { BlockEditorColors } from '../../../../../editorTypes';

export interface SlashMenuProps {
  query: string;
  anchorY: number;
  anchorX: number;
  colors: BlockEditorColors;
  onSelect: (meta: BlockTypeMeta) => void;
  onClose: () => void;
}

export function SlashMenu({ query, anchorY, anchorX, colors: c, onSelect, onClose }: SlashMenuProps) {
  const { t, lang } = useTranslation();
  const [cursor, setCursor] = useState(0);
  const palette = useMemo(() => buildSlashPalette(query), [query]);
  const menuRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const g: Record<string, typeof palette.items> = {};
    palette.items.forEach(item => { (g[item.group] ??= []).push(item); });
    return g;
  }, [palette.items]);

  const flatItems = useMemo(
    () => [...palette.recent, ...Object.values(grouped).flat()],
    [palette.recent, grouped],
  );

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(v => Math.min(v + 1, flatItems.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(v => Math.max(v - 1, 0)); }
      if (e.key === 'Enter') { e.preventDefault(); if (flatItems[cursor]) onSelect(flatItems[cursor]); }
      if (e.key === 'Escape') { onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [flatItems, cursor, onSelect, onClose]);

  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const groupLabels: Record<string, string> = {
    text: t('slashGroupText'),
    list: t('slashGroupList'),
    media: t('slashGroupMedia'),
    embed: t('slashGroupEmbed'),
  };
  const top = Math.min(anchorY + 8, window.innerHeight - 380);
  const left = Math.min(anchorX, window.innerWidth - 260);

  const renderItem = (item: BlockTypeMeta, idx: number) => {
    const active = cursor === idx;
    const shortcut = item.menuKey ?? item.type;
    const label = blockTypeLabel(item.type, lang, item.menuKey);
    const desc = blockTypeDesc(item.type, lang, item.menuKey);
    return (
      <button
        key={slashMenuItemKey(item)}
        data-idx={idx}
        type="button"
        onClick={() => onSelect(item)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '7px 12px', background: active ? c.accentBg : 'none',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
        onMouseEnter={() => setCursor(idx)}
      >
        <span style={{
          width: 28, height: 28, borderRadius: 6, background: c.toolbar,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0, color: c.accent,
        }}>
          {item.icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{label}</div>
          <div style={{ fontSize: 11, color: c.textMuted }}>{desc}</div>
        </span>
        {shortcut && (
          <span style={{
            fontSize: 10, color: c.textFaint, fontFamily: 'ui-monospace, monospace', flexShrink: 0,
          }}>
            /{shortcut}
          </span>
        )}
      </button>
    );
  };

  return (
    <div ref={menuRef} className="be-slash-menu" style={{
      position: 'fixed', top, left, zIndex: 400,
      background: c.card, border: `1px solid ${c.border}`,
      borderRadius: c.radiusModal ?? 16, boxShadow: c.menuShadow ?? '0 8px 24px rgba(0,0,0,0.1)',
      width: 248, maxHeight: 360, overflowY: 'auto', padding: '6px 0',
    }}>
      <div style={{ padding: '6px 12px 8px', borderBottom: `1px solid ${c.border}`, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: c.accent, background: c.accentBg,
            borderRadius: 4, padding: '2px 6px', fontFamily: 'ui-monospace, monospace',
          }}>/</span>
          <span style={{ fontSize: 10, color: c.textFaint, fontWeight: 700, letterSpacing: 0.8 }}>
            {query ? t('slashMenuQuery').replace('{query}', query) : t('slashMenuTitle')}
          </span>
        </div>
        <div style={{ fontSize: 11, color: c.textMuted }}>
          {query ? t('slashMenuHintSearch') : t('slashMenuHintEmpty')}
        </div>
      </div>
      {flatItems.length === 0 && (
        <div style={{ padding: 12, color: c.textFaint, fontSize: 13, textAlign: 'center' }}>{t('slashMenuNoResults')}</div>
      )}
      {palette.recent.length > 0 && (
        <div>
          <div style={{
            padding: '4px 12px 2px', fontSize: 9, color: c.textFaint, fontWeight: 700,
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
            {t('slashGroupRecent')}
          </div>
          {palette.recent.map((item, idx) => renderItem(item, idx))}
        </div>
      )}
      {Object.entries(grouped).map(([group, gItems]) => (
        <div key={group}>
          {!query && (
            <div style={{
              padding: '4px 12px 2px', fontSize: 9, color: c.textFaint, fontWeight: 700,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>
              {groupLabels[group] ?? group}
            </div>
          )}
          {gItems.map(item => {
            const idx = flatItems.findIndex(f => slashMenuItemKey(f) === slashMenuItemKey(item));
            return renderItem(item, idx);
          })}
        </div>
      ))}
    </div>
  );
}
