import React from 'react';
import { useTranslation } from '../../lib/i18n';
import type { BlockEditorColors } from './editorTypes';
import { EDITOR_SHORTCUT_SECTIONS } from './editorShortcuts';

export interface ShortcutHelpOverlayProps {
  open: boolean;
  colors: BlockEditorColors;
  onClose: () => void;
}

export function ShortcutHelpOverlay({ open, colors: c, onClose }: ShortcutHelpOverlayProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="be-shortcut-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label={t('shortcutsOverlayAria')}
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)', maxHeight: '80vh', overflowY: 'auto',
          background: c.card, border: `1px solid ${c.border}`, borderRadius: c.radiusModal ?? 16,
          boxShadow: c.menuShadow ?? '0 12px 40px rgba(0,0,0,0.15)', padding: '16px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.text }}>키보드 단축키</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', fontSize: 13 }}
          >
            Esc 닫기
          </button>
        </div>
        {EDITOR_SHORTCUT_SECTIONS.map(section => (
          <div key={section.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.textFaint, letterSpacing: 0.8, marginBottom: 6 }}>
              {section.title.toUpperCase()}
            </div>
            {section.items.map(item => (
              <div
                key={`${section.id}-${item.keys}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', gap: 12 }}
              >
                <span style={{ fontSize: 13, color: c.text }}>{item.label}</span>
                <kbd style={{
                  fontSize: 11, fontFamily: 'ui-monospace, monospace', color: c.textMuted,
                  background: c.toolbar, border: `1px solid ${c.border}`, borderRadius: 5, padding: '2px 7px',
                }}>
                  {item.keys}
                </kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Returns true when the overlay consumed the shortcut toggle key. */
export function isShortcutHelpKey(e: KeyboardEvent): boolean {
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return false;
    return true;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    return true;
  }
  return false;
}
