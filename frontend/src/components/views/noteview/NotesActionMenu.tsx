import { useState, useRef, useEffect, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';

export interface NotesActionMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
}

export interface NotesActionMenuProps {
  colors: NoteChromeColors;
  isMobile: boolean;
  title: string;
  items: NotesActionMenuItem[];
  iconBtnStyle: React.CSSProperties;
  trailing?: ReactNode;
}

/** K-126C — overflow menu for secondary note header actions. */
export function NotesActionMenu({
  colors: c,
  isMobile,
  title,
  items,
  iconBtnStyle,
  trailing,
}: NotesActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const menuItemStyle = {
    width: '100%' as const,
    textAlign: 'left' as const,
    fontSize: 11,
    padding: '8px 10px',
    minHeight: isMobile ? UI_INTERACTION.touchTargetMinPx : UI_INTERACTION.toolbarBtnSizePx,
    boxSizing: 'border-box' as const,
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }} data-k126c-notes-more-menu>
      <button
        type="button"
        className="btbtn"
        aria-expanded={open}
        aria-haspopup="menu"
        title={title}
        onClick={() => setOpen(v => !v)}
        style={{ ...iconBtnStyle, color: open ? c.accent : c.textMuted }}
        data-k126c-notes-more-trigger
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            zIndex: 200,
            background: c.card,
            border: `1px solid ${c.sideBdr}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 168,
            padding: '4px 0',
          }}
        >
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              className="btbtn"
              role="menuitem"
              style={{
                ...menuItemStyle,
                color: item.danger ? c.danger : item.accent ? c.accent : undefined,
              }}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
