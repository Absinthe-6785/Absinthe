/**
 * SelectionToolbar.tsx — Floating format toolbar for text selection (extracted from BlockEditor)
 */
import React, { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  Bold, Italic, Hash, Code2, Heading1, Heading2, Heading3, Heading4,
  Strikethrough, Highlighter,
} from 'lucide-react';
import { readBlockText } from '../../../../../editableDom';
import type { BlockType } from '../../../../../blockUtils';
import { headingConvertTarget } from '../../../../../headingToolbar';
import type { BlockEditorColors } from '../../../../../editorTypes';
import { paintEditableLive } from '../../../../../editableLive';
import {
  deriveToolbarFormats, applyWrapToBlockSelection,
  EMPTY_FORMATS, type ToolbarFormatState,
} from '../utils/toolbarFormat';
import { saveSelectionRange } from '../utils/selectionState';

export interface SelectionToolbarProps {
  colors: BlockEditorColors;
  wikiTargets: string[];
  searchQuery: string;
  activeBlockId: string | null;
  onContentChange: (blockId: string, content: string) => void;
  onConvertBlock: (blockId: string, type: BlockType) => void;
  getBlockType: (blockId: string) => BlockType | undefined;
}

function ToolbarTip({
  label, hint, children, colors: c, radius,
}: { label: string; hint?: string; children: ReactNode; colors: BlockEditorColors; radius?: number }) {
  const tipRadius = radius ?? c.radiusBtn ?? 8;
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: 'relative', display: 'flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: c.card, border: `1px solid ${c.border}`, borderRadius: tipRadius,
          padding: '4px 8px', whiteSpace: 'nowrap', zIndex: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{label}</div>
          {hint && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 1 }}>{hint}</div>}
        </div>
      )}
    </div>
  );
}

export function SelectionToolbar({
  colors: c, wikiTargets, searchQuery, activeBlockId, onContentChange, onConvertBlock, getBlockType,
}: SelectionToolbarProps) {
  const { t } = useTranslation();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [formats, setFormats] = useState<ToolbarFormatState>(EMPTY_FORMATS);
  const blockIdRef = useRef<string | null>(null);
  const editableRef = useRef<HTMLElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null);
        blockIdRef.current = null;
        editableRef.current = null;
        savedRangeRef.current = null;
        setFormats(EMPTY_FORMATS);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const host = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement)
        ?.closest('[contenteditable="true"]') as HTMLElement | null;
      if (!host?.closest('.be-editor-root')) {
        setPos(null);
        blockIdRef.current = null;
        editableRef.current = null;
        savedRangeRef.current = null;
        setFormats(EMPTY_FORMATS);
        return;
      }
      const blockEl = host.closest('.be-block') as HTMLElement | null;
      const blockId = blockEl?.getAttribute('data-drag-id') ?? null;
      if (!blockId || blockId !== activeBlockId) {
        setPos(null);
        blockIdRef.current = null;
        editableRef.current = null;
        savedRangeRef.current = null;
        setFormats(EMPTY_FORMATS);
        return;
      }
      blockIdRef.current = blockId;
      editableRef.current = host;
      savedRangeRef.current = saveSelectionRange() ?? range.cloneRange();

      setFormats(deriveToolbarFormats(host, blockId, activeBlockId, getBlockType));

      const rect = range.getBoundingClientRect();
      let top = rect.top - 46;
      let left = rect.left + rect.width / 2;
      if (rect.width === 0 && rect.height === 0) {
        const hostRect = host.getBoundingClientRect();
        top = hostRect.top - 46;
        left = hostRect.left + hostRect.width / 2;
      }
      if (top < 8 && host) {
        const hostRect = host.getBoundingClientRect();
        top = hostRect.bottom + 8;
      }
      const margin = 120;
      left = Math.max(margin, Math.min(window.innerWidth - margin, left));
      setPos({ top: Math.max(8, top), left });
    };
    document.addEventListener('selectionchange', update);
    document.addEventListener('keyup', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('keyup', update);
    };
  }, [getBlockType, activeBlockId]);

  const applyFormat = useCallback((before: string, after: string) => {
    const blockId = blockIdRef.current;
    const el = editableRef.current;
    if (!el || !blockId || blockId !== activeBlockId) return;

    const blockText = readBlockText(el);

    el.focus();
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current.cloneRange());
      } catch {
        // stale range
      }
    }

    applyWrapToBlockSelection(el, blockText, before, after, (text) => {
      onContentChange(blockId, text);
    }, (target, text, selection) => {
      paintEditableLive(target, text, c, wikiTargets, searchQuery, undefined, selection);
      requestAnimationFrame(() => {
        setFormats(deriveToolbarFormats(target, blockId, activeBlockId, getBlockType));
        savedRangeRef.current = saveSelectionRange();
      });
    });
  }, [c, wikiTargets, searchQuery, onContentChange, getBlockType, activeBlockId]);

  if (!pos) return null;

  const activeFg = c.toolbarActiveFg ?? '#FFFFFF';
  const btnRadius = c.radiusBtn ?? 8;

  const iconBtn = (icon: ReactNode, label: string, hint: string | undefined, active: boolean, fn: () => void) => (
    <ToolbarTip label={label} hint={hint} colors={c} radius={btnRadius}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onMouseDown={e => { e.preventDefault(); fn(); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32,
          border: active ? `2px solid ${c.accent}` : '2px solid transparent',
          borderRadius: btnRadius, cursor: 'pointer',
          background: active ? c.accent : 'transparent',
          color: active ? activeFg : c.textMuted,
          boxShadow: active ? `0 0 0 2px ${c.accentBg}` : 'none',
          transition: 'background .12s, color .12s, box-shadow .12s',
        }}
        onMouseEnter={e => {
          if (active) return;
          (e.currentTarget as HTMLButtonElement).style.background = c.cardHov;
          (e.currentTarget as HTMLButtonElement).style.color = c.text;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = active ? c.accent : 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = active ? activeFg : c.textMuted;
        }}
      >
        {icon}
      </button>
    </ToolbarTip>
  );

  const convertHeading = (level: 1 | 2 | 3 | 4) => {
    const blockId = blockIdRef.current;
    if (!blockId) return;
    const current = getBlockType(blockId);
    onConvertBlock(blockId, headingConvertTarget(current, level));
  };

  const headingActive = (level: 1 | 2 | 3 | 4) => formats.headingLevel === level;

  return (
    <div
      className="be-selection-toolbar"
      style={{
        position:'fixed', top: Math.max(8, pos.top), left: pos.left,
        transform:'translateX(-50%)', zIndex:400,
        display:'flex', alignItems:'center', gap:3, flexWrap:'nowrap',
        padding:'5px 8px', borderRadius: c.radiusCard ?? 12,
        background:c.card, border:`1px solid ${c.border}`,
        boxShadow:'0 4px 12px rgba(0,0,0,0.08)',
      }}
      onMouseDown={e => e.preventDefault()}
    >
      <span style={{ fontSize:9, fontWeight:700, color:c.textFaint, padding:'0 4px', letterSpacing:0.6 }}>{t('selectionFormat')}</span>
      {iconBtn(<Bold size={14}/>, t('editorToolbarBold'), 'Ctrl+B', formats.bold, () => applyFormat('**', '**'))}
      {iconBtn(<Italic size={14}/>, t('editorToolbarItalic'), 'Ctrl+I', formats.italic, () => applyFormat('*', '*'))}
      {iconBtn(<Strikethrough size={14}/>, t('editorToolbarStrike'), 'Ctrl+Shift+S', formats.strike, () => applyFormat('~~', '~~'))}
      {iconBtn(<Highlighter size={14}/>, t('editorToolbarHighlight'), 'Ctrl+Shift+M', formats.highlight, () => applyFormat('==', '=='))}
      {iconBtn(<Code2 size={14}/>, t('editorToolbarCode'), 'Ctrl+`', formats.code, () => applyFormat('`', '`'))}
      <span style={{ width:1, height:18, background:c.border, margin:'0 2px', flexShrink:0 }}/>
      <span style={{ fontSize:9, fontWeight:700, color:c.textFaint, padding:'0 4px', letterSpacing:0.6 }}>
        {formats.isToggleHeading ? t('editorToolbarToggleHeading') : t('editorToolbarHeading')}
      </span>
      {iconBtn(<Heading1 size={14}/>, formats.isToggleHeading ? t('editorToolbarToggleHeadingN').replace('{n}', '1') : t('editorToolbarHeadingN').replace('{n}', '1'), 'Ctrl+Shift+1', headingActive(1), () => convertHeading(1))}
      {iconBtn(<Heading2 size={14}/>, formats.isToggleHeading ? t('editorToolbarToggleHeadingN').replace('{n}', '2') : t('editorToolbarHeadingN').replace('{n}', '2'), 'Ctrl+Shift+2', headingActive(2), () => convertHeading(2))}
      {iconBtn(<Heading3 size={14}/>, formats.isToggleHeading ? t('editorToolbarToggleHeadingN').replace('{n}', '3') : t('editorToolbarHeadingN').replace('{n}', '3'), 'Ctrl+Shift+3', headingActive(3), () => convertHeading(3))}
      {iconBtn(<Heading4 size={14}/>, formats.isToggleHeading ? t('editorToolbarToggleHeadingN').replace('{n}', '4') : t('editorToolbarHeadingN').replace('{n}', '4'), 'Ctrl+Shift+4', headingActive(4), () => convertHeading(4))}
      <span style={{ width:1, height:18, background:c.border, margin:'0 2px', flexShrink:0 }}/>
      <span style={{ fontSize:9, fontWeight:700, color:c.textFaint, padding:'0 4px', letterSpacing:0.6 }}>{t('editorToolbarLinks')}</span>
      {iconBtn(<span style={{ fontSize:11, fontWeight:700 }}>[[]]</span>, t('editorToolbarWikiLink'), 'Ctrl+Shift+K', formats.wiki, () => applyFormat('[[', ']]'))}
      <span style={{ width:1, height:18, background:c.border, margin:'0 2px', flexShrink:0 }}/>
      <span style={{ fontSize:9, fontWeight:700, color:c.textFaint, padding:'0 4px', letterSpacing:0.6 }}>{t('editorToolbarTags')}</span>
      {iconBtn(<Hash size={14}/>, t('editorToolbarTags'), 'Ctrl+Shift+H', formats.tag, () => applyFormat('#', ''))}
    </div>
  );
}
