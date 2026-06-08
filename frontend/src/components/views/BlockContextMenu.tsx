/**
 * BlockContextMenu.tsx — Block grip context menu (extracted from BlockEditor)
 */
import React, { useState, useRef, useMemo, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { computeFixedMenuPosition } from './menuViewport';
import {
  Plus, Copy, Indent, Outdent, Link2, Palette,
  Trash2, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  BLOCK_TYPE_MENU, TURN_INTO_TYPES,
  type BlockType,
} from './blockUtils';
import { slashDisplayLabel } from './slashCommands';
import { BLOCK_TINT_OPTIONS, type BlockTint } from './blockColors';
import { blockIcon } from './blockIcons';
import type { BlockEditorColors } from './editorTypes';
import { CONTEXT_MENU, TINT_LABELS } from './editorMenuModel';

export interface BlockContextMenuProps {
  blockId: string;
  currentType: BlockType;
  anchorY: number;
  anchorX: number;
  colors: BlockEditorColors;
  /** When > 1, shows multi-select header and simplified actions */
  selectionCount?: number;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onDuplicate: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onMoveIntoToggle: () => void;
  onMoveOutOfToggle: () => void;
  canMoveIntoToggle: boolean;
  canMoveOutOfToggle: boolean;
  onSetTint: (tint: BlockTint) => void;
  onCopyLink: () => void;
  onSelect: (type: BlockType) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
  onChromeEnter?: (id: string) => void;
  onChromeLeave?: () => void;
}

export function BlockContextMenu({
  blockId, currentType, anchorY, anchorX, colors: c, selectionCount,
  onAddAbove, onAddBelow, onDuplicate, onIndent, onOutdent,
  onMoveIntoToggle, onMoveOutOfToggle, canMoveIntoToggle, canMoveOutOfToggle,
  onSetTint, onCopyLink,
  onSelect, onDelete, onMoveUp, onMoveDown, onClose,
  onChromeEnter, onChromeLeave,
}: BlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<'turn' | 'color' | null>(null);
  const turnIntoItems = useMemo(
    () => TURN_INTO_TYPES.map(t => BLOCK_TYPE_MENU.find(m => m.type === t)).filter((m): m is NonNullable<typeof m> => m != null),
    [],
  );

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const [menuPos, setMenuPos] = useState({ top: anchorY, left: anchorX });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setMenuPos(computeFixedMenuPosition(anchorX, anchorY, width, height));
  }, [anchorX, anchorY, submenu, selectionCount]);

  const mi = (icon: ReactNode, label: string, fn: () => void, danger = false, disabled = false) => (
    <button type="button" disabled={disabled} onClick={() => { if (!disabled) fn(); }} style={{
      display:'flex', alignItems:'center', gap:8, width:'100%',
      padding:'7px 12px', background:'none', border:'none',
      cursor: disabled ? 'default' : 'pointer', fontSize:13,
      color: disabled ? c.textFaint : danger ? c.danger : c.text,
      textAlign:'left', opacity: disabled ? 0.45 : 1,
    }}
    onMouseEnter={e => (e.currentTarget.style.background = c.cardHov)}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      {icon}{label}
    </button>
  );
  const sec = (label: string) => (
    <div style={{ padding:'5px 12px 2px', fontSize:9, fontWeight:700, color:c.textFaint, letterSpacing:1, textTransform:'uppercase' }}>
      {label}
    </div>
  );

  return (
    <div
      ref={menuRef}
      className="be-block-handle-menu"
      onMouseEnter={() => onChromeEnter?.(blockId)}
      onMouseLeave={() => onChromeLeave?.()}
      style={{
        position:'fixed', top: menuPos.top, left: menuPos.left, zIndex:400,
        background:c.card, border:`1px solid ${c.border}`,
        borderRadius: c.radiusModal ?? 16, boxShadow: c.menuShadow ?? '0 8px 24px rgba(0,0,0,0.1)',
        minWidth:210, maxWidth:240, overflow:'hidden', padding:'6px 0',
      }}
    >
      {submenu === 'turn' ? (
        <>
          <button type="button" onClick={() => setSubmenu(null)} style={{
            display:'flex', alignItems:'center', gap:6, width:'100%', padding:'6px 12px',
            background:'none', border:'none', cursor:'pointer', fontSize:12, color:c.textMuted, textAlign:'left',
          }}>← {CONTEXT_MENU.transform}</button>
          <div style={{ maxHeight:240, overflowY:'auto' }}>
            {turnIntoItems.map(item => {
              const active = item.type === currentType;
              return (
                <button key={item.type} type="button"
                  onMouseDown={e => { e.preventDefault(); onSelect(item.type); }}
                  style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    padding:'6px 12px', background: active ? c.accentBg : 'none',
                    border:'none', cursor:'pointer', textAlign:'left',
                  }}>
                  <span style={{ width:22, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent }}>{blockIcon(item.type)}</span>
                  <span style={{ fontSize:13, fontWeight: active ? 700 : 500, color:c.text }}>{slashDisplayLabel(item.type)}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : submenu === 'color' ? (
        <>
          <button type="button" onClick={() => setSubmenu(null)} style={{
            display:'flex', alignItems:'center', gap:6, width:'100%', padding:'6px 12px',
            background:'none', border:'none', cursor:'pointer', fontSize:12, color:c.textMuted, textAlign:'left',
          }}>← {CONTEXT_MENU.color}</button>
          {BLOCK_TINT_OPTIONS.map(opt => (
            <button key={opt.id} type="button" onClick={() => onSetTint(opt.id)}
              style={{
                display:'flex', alignItems:'center', gap:10, width:'100%', padding:'6px 12px',
                background:'none', border:'none', cursor:'pointer', textAlign:'left',
              }}>
              <span style={{ width:16, height:16, borderRadius:4, background:opt.bg, border:`2px solid ${opt.border}` }}/>
              <span style={{ fontSize:13, color:c.text }}>{TINT_LABELS[opt.id] ?? opt.label}</span>
            </button>
          ))}
        </>
      ) : selectionCount && selectionCount > 1 ? (
        <>
          <div style={{ padding:'8px 12px 6px', fontSize:12, fontWeight:600, color:c.textMuted }}>
            {selectionCount} blocks selected
          </div>
          <div style={{ borderTop:`1px solid ${c.border}`, margin:'4px 0' }}/>
          {mi(<Copy size={13}/>, CONTEXT_MENU.duplicate, onDuplicate)}
          {mi(<Trash2 size={12}/>, CONTEXT_MENU.delete, onDelete, true)}
        </>
      ) : (
        <>
          {sec(CONTEXT_MENU.sectionBlock)}
          {mi(<Plus size={13}/>, CONTEXT_MENU.addAbove, onAddAbove)}
          {mi(<Plus size={13}/>, CONTEXT_MENU.addBelow, onAddBelow)}
          {mi(<Copy size={13}/>, CONTEXT_MENU.duplicate, onDuplicate)}
          <div style={{ borderTop:`1px solid ${c.border}`, margin:'4px 0' }}/>
          <button type="button" onClick={() => setSubmenu('turn')} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%',
            padding:'7px 12px', background:'none', border:'none', cursor:'pointer', fontSize:13, color:c.text,
          }}>
            <span>{CONTEXT_MENU.transform}</span><span style={{ color:c.textFaint }}>›</span>
          </button>
          <button type="button" onClick={() => setSubmenu('color')} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%',
            padding:'7px 12px', background:'none', border:'none', cursor:'pointer', fontSize:13, color:c.text,
          }}>
            <span style={{ display:'flex', alignItems:'center', gap:8 }}><Palette size={13}/>{CONTEXT_MENU.color}</span>
            <span style={{ color:c.textFaint }}>›</span>
          </button>
          <div style={{ borderTop:`1px solid ${c.border}`, margin:'4px 0' }}/>
          {sec(CONTEXT_MENU.sectionStructure)}
          {mi(<Indent size={13}/>, CONTEXT_MENU.indent, onIndent)}
          {mi(<Outdent size={13}/>, CONTEXT_MENU.outdent, onOutdent)}
          {mi(<Indent size={13}/>, CONTEXT_MENU.moveIntoToggle, onMoveIntoToggle, false, !canMoveIntoToggle)}
          {mi(<Outdent size={13}/>, CONTEXT_MENU.moveOutOfToggle, onMoveOutOfToggle, false, !canMoveOutOfToggle)}
          <div style={{ borderTop:`1px solid ${c.border}`, margin:'4px 0' }}/>
          {mi(<Link2 size={13}/>, CONTEXT_MENU.copyLink, onCopyLink)}
          {mi(<ArrowUp size={12}/>, CONTEXT_MENU.moveUp, onMoveUp)}
          {mi(<ArrowDown size={12}/>, CONTEXT_MENU.moveDown, onMoveDown)}
          <div style={{ borderTop:`1px solid ${c.border}`, margin:'4px 0' }}/>
          {mi(<Trash2 size={12}/>, CONTEXT_MENU.delete, onDelete, true)}
        </>
      )}
    </div>
  );
}
