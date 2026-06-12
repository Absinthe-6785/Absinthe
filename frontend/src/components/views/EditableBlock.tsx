/**
 * EditableBlock.tsx — contentEditable inline editor (extracted from BlockEditor)
 */
import React, { useRef, useCallback, useEffect, type CSSProperties } from 'react';
import type { Block, BlockType } from './blockUtils';
import { readBlockText, deleteBeforeCaret } from './editableDom';
import {
  applyWrapToBlockSelection,
  getCaretOffset,
  getSelectionOffsets,
} from './features/block-editor/features/selection';
import { paintEditableLive } from './editableLive';
import { insertNewlineInBlock, splitBlockContent } from './blockContent';
import { blockPlaceholder } from './blockPlaceholders';
import {
  clipboardToBlocks,
  extractClipboardText,
  isDocumentLevelPaste,
} from './features/block-editor/features/clipboard';
import {
  beginPastePipelineTrace,
  traceClipboardToBlocks,
} from './pastePipelineTrace';
import { detectWikiQuery, findWikiLinkAtOffset } from './features/block-editor/features/menus';
import type { BlockEditorColors, SlashMenuState, WikiMenuState } from './editorTypes';

const getElText = readBlockText;

export interface EditableBlockProps {
  block: Block;
  colors: BlockEditorColors;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
  editableRef: React.MutableRefObject<HTMLElement | null>;
  onSplitBlock: (id: string, before: string, after: string) => void;
  onMergeWithPrev: (id: string, selfContent: string) => void;
  onContentChange: (id: string, content: string) => void;
  tag?: keyof React.JSX.IntrinsicElements;
  onSlashOpen: (state: SlashMenuState) => void;
  onSlashClose: () => void;
  onWikiOpen: (state: WikiMenuState) => void;
  onWikiClose: () => void;
  isMenuOpen: boolean;
  onWikiNavigate?: (title: string) => void;
  onEnterOverride?: (before: string, after: string) => void;
  onNavigateBlock: (fromId: string, dir: 'up' | 'down') => void;
  onActiveBlockChange?: (id: string | null) => void;
  wikiTargets?: string[];
  searchQuery?: string;
  onConvertBlock?: (id: string, type: BlockType) => void;
  onIndentBlock?: (id: string) => void;
  onOutdentBlock?: (id: string) => void;
  onPasteAt?: (id: string, start: number, end: number, text: string) => void;
  onPasteBlocksAt?: (id: string, start: number, end: number, blocks: import('./blockUtils').Block[]) => void;
  persistentPlaceholder?: boolean;
  /** When false in edit mode, renders static selectable text for cross-block selection. */
  isActive?: boolean;
  onActivate?: (offset?: 'start' | 'end' | number) => void;
}

export function EditableBlock({
  block, colors: c, placeholder = blockPlaceholder(block.type),
  style, className, editableRef,
  onSplitBlock, onMergeWithPrev, onContentChange, tag = 'p',
  onSlashOpen, onSlashClose,
  onWikiOpen, onWikiClose, isMenuOpen, onWikiNavigate,
  onEnterOverride, onNavigateBlock, onActiveBlockChange,
  wikiTargets = [], searchQuery = '',
  onConvertBlock,
  onIndentBlock,
  onOutdentBlock,
  onPasteAt,
  onPasteBlocksAt,
  persistentPlaceholder = false,
  isActive = true,
  onActivate,
}: EditableBlockProps) {
  const Tag = tag as React.ElementType;
  const composingRef = useRef(false);
  const liveRafRef = useRef<number | null>(null);
  const staticMouseRef = useRef<{ x: number; y: number } | null>(null);
  const isEditing = isActive || readOnly;

  const paintLive = useCallback((el: HTMLElement, restoreCaret = true) => {
    const plain = getElText(el);
    const caret = restoreCaret ? getCaretOffset(el) : undefined;
    paintEditableLive(el, plain, c, wikiTargets, searchQuery, caret);
  }, [c, wikiTargets, searchQuery]);

  const lastContent = useRef(block.content);
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    if (block.content !== lastContent.current) {
      if (!isEditing || document.activeElement !== el) {
        paintEditableLive(el, block.content, c, wikiTargets, searchQuery);
        lastContent.current = block.content;
      }
    }
  }, [block.content, editableRef, c, wikiTargets, searchQuery, isEditing]);

  useEffect(() => {
    const el = editableRef.current;
    if (!el || el.innerHTML) return;
    paintEditableLive(el, block.content, c, wikiTargets, searchQuery);
    lastContent.current = block.content;
  }, [block.content, editableRef, c, wikiTargets, searchQuery]);

  useEffect(() => () => {
    if (liveRafRef.current != null) cancelAnimationFrame(liveRafRef.current);
  }, []);

  const handleInput = useCallback((e: React.FormEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const text = getElText(el);
    lastContent.current = text;
    onContentChange(block.id, text);

    if (!composingRef.current) {
      if (liveRafRef.current != null) cancelAnimationFrame(liveRafRef.current);
      liveRafRef.current = requestAnimationFrame(() => {
        liveRafRef.current = null;
        paintLive(el, true);
      });
    }

    const offset = getCaretOffset(el);
    const before = text.slice(0, offset);

    if (composingRef.current) return;

    const wikiQuery = detectWikiQuery(before);
    if (wikiQuery !== null) {
      const rect = el.getBoundingClientRect();
      onWikiOpen({ blockId: block.id, query: wikiQuery, anchorY: rect.bottom, anchorX: rect.left });
      onSlashClose();
      return;
    }
    onWikiClose();

    const slashIdx = before.lastIndexOf('/');
    if (slashIdx !== -1) {
      const charBefore = before[slashIdx - 1];
      if (slashIdx === 0 || charBefore === ' ' || charBefore === '\n') {
        const query = before.slice(slashIdx + 1);
        if (!query.includes(' ')) {
          const rect = el.getBoundingClientRect();
          onSlashOpen({ blockId: block.id, query, anchorY: rect.bottom, anchorX: rect.left });
          return;
        }
      }
    }
    onSlashClose();
  }, [block.id, onContentChange, onSlashOpen, onSlashClose, onWikiOpen, onWikiClose, paintLive]);

  const applyInlineFormat = useCallback((before: string, after: string) => {
    const el = editableRef.current;
    if (!el) return;
    const blockText = lastContent.current;
    applyWrapToBlockSelection(el, blockText, before, after, (text) => {
      lastContent.current = text;
      onContentChange(block.id, text);
    }, (target, text, selection) => {
      paintEditableLive(target, text, c, wikiTargets, searchQuery, undefined, selection);
    });
  }, [block.id, onContentChange, c, wikiTargets, searchQuery, editableRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !isMenuOpen) {
      const key = e.key.toLowerCase();
      if (key === 'b') { e.preventDefault(); applyInlineFormat('**', '**'); return; }
      if (key === 'i') { e.preventDefault(); applyInlineFormat('*', '*'); return; }
      if (e.code === 'Backquote') { e.preventDefault(); applyInlineFormat('`', '`'); return; }
      if (key === 'k' && e.shiftKey) { e.preventDefault(); applyInlineFormat('[[', ']]'); return; }
      if (key === 'h' && e.shiftKey) { e.preventDefault(); applyInlineFormat('#', ''); return; }
      if (e.shiftKey && onConvertBlock) {
        if (key === '0') { e.preventDefault(); onConvertBlock(block.id, 'paragraph'); return; }
        if (key === '1') { e.preventDefault(); onConvertBlock(block.id, 'heading1'); return; }
        if (key === '2') { e.preventDefault(); onConvertBlock(block.id, 'heading2'); return; }
        if (key === '3') { e.preventDefault(); onConvertBlock(block.id, 'heading3'); return; }
        if (key === '7') { e.preventDefault(); onConvertBlock(block.id, 'todo'); return; }
        if (key === '8') { e.preventDefault(); onConvertBlock(block.id, 'toggle'); return; }
        if (key === '9') { e.preventDefault(); onConvertBlock(block.id, 'callout'); return; }
        if (key === 'c') { e.preventDefault(); onConvertBlock(block.id, 'code'); return; }
      }
    }

    if (isMenuOpen) {
      if (e.key === 'Enter') { e.preventDefault(); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); return; }
      if (e.key === 'Escape') { onSlashClose(); onWikiClose(); return; }
    }

    if (composingRef.current && e.key === 'Enter') return;

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onSlashClose();
      onWikiClose();
      const text = getElText(el);
      const offset = getCaretOffset(el);
      const { content: next, caret } = insertNewlineInBlock(text, offset);
      lastContent.current = next;
      onContentChange(block.id, next);
      paintEditableLive(el, next, c, wikiTargets, searchQuery, caret);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSlashClose();
      onWikiClose();
      if (onEnterOverride) {
        const text = getElText(el);
        const offset = getCaretOffset(el);
        const { before, after } = splitBlockContent(text, offset);
        onEnterOverride(before, after);
        return;
      }
      const text = getElText(el);
      const offset = getCaretOffset(el);
      const { before, after } = splitBlockContent(text, offset);
      onSplitBlock(block.id, before, after);
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = getSelectionOffsets(el);
      if (selection) {
        e.preventDefault();
        onSlashClose();
        onWikiClose();
        const text = getElText(el);
        const next = text.slice(0, selection.start) + text.slice(selection.end);
        lastContent.current = next;
        onContentChange(block.id, next);
        paintEditableLive(el, next, c, wikiTargets, searchQuery, selection.start);
        return;
      }

      if (e.key === 'Backspace') {
        const text = getElText(el);
        const offset = getCaretOffset(el);
        if (offset === 0) {
          e.preventDefault();
          onSlashClose();
          onWikiClose();
          onMergeWithPrev(block.id, text);
          return;
        }
        if (text[offset - 1] === '\n') {
          e.preventDefault();
          onSlashClose();
          onWikiClose();
          const deleted = deleteBeforeCaret(text, offset);
          if (!deleted) return;
          lastContent.current = deleted.text;
          onContentChange(block.id, deleted.text);
          paintEditableLive(el, deleted.text, c, wikiTargets, searchQuery, deleted.caret);
          return;
        }
      }
    }

    if (e.key === 'Tab' && !mod && !isMenuOpen) {
      if (e.shiftKey) {
        if (onOutdentBlock) { e.preventDefault(); onOutdentBlock(block.id); }
      } else if (onIndentBlock) {
        e.preventDefault();
        onIndentBlock(block.id);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      const offset = getCaretOffset(el);
      if (offset === 0) { e.preventDefault(); onNavigateBlock(block.id, 'up'); return; }
    }
    if (e.key === 'ArrowDown') {
      const text = getElText(el);
      if (getCaretOffset(el) === text.length) { e.preventDefault(); onNavigateBlock(block.id, 'down'); return; }
    }

    if (e.key === 'Escape') {
      onSlashClose();
      onWikiClose();
    }
  }, [block.id, onSplitBlock, onMergeWithPrev, onSlashClose, onWikiClose, onEnterOverride, isMenuOpen, onNavigateBlock, applyInlineFormat, onConvertBlock, c, wikiTargets, searchQuery, onContentChange, onIndentBlock, onOutdentBlock]);

  const handleFocus = useCallback(() => {
    onActiveBlockChange?.(block.id);
    const el = editableRef.current;
    if (el && getElText(el) !== block.content) {
      paintEditableLive(el, block.content, c, wikiTargets, searchQuery);
    }
  }, [block.content, editableRef, block.id, onActiveBlockChange, c, wikiTargets, searchQuery]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const text = getElText(el);
    if (text !== lastContent.current) {
      lastContent.current = text;
      onContentChange(block.id, text);
    }
    paintEditableLive(el, lastContent.current, c, wikiTargets, searchQuery);
  }, [block.id, onContentChange, c, wikiTargets, searchQuery]);

  const handleCompositionStart = useCallback(() => { composingRef.current = true; }, []);
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLElement>) => {
    composingRef.current = false;
    paintLive(e.currentTarget, true);
  }, [paintLive]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const sel = getSelectionOffsets(el);
    const start = sel?.start ?? getCaretOffset(el);
    const end = sel?.end ?? start;

    const docBlocks = clipboardToBlocks(e.clipboardData);
    if (docBlocks && isDocumentLevelPaste(e.clipboardData, docBlocks) && onPasteBlocksAt) {
      beginPastePipelineTrace(`paste-at-${block.id}`);
      traceClipboardToBlocks(docBlocks);
      onPasteBlocksAt(block.id, start, end, docBlocks);
      return;
    }

    const raw = extractClipboardText(e.clipboardData);
    if (!raw) return;
    if (!onPasteAt) {
      document.execCommand('insertText', false, raw);
      return;
    }
    onPasteAt(block.id, start, end, raw);
  }, [block.id, onPasteAt, onPasteBlocksAt]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!onWikiNavigate || !(e.ctrlKey || e.metaKey)) return;
    const el = e.currentTarget;
    const text = getElText(el);
    const offset = getCaretOffset(el);
    const title = findWikiLinkAtOffset(text, offset);
    if (title) {
      e.preventDefault();
      onWikiNavigate(title);
    }
  }, [onWikiNavigate]);

  const handleStaticMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    staticMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleStaticMouseUp = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!onActivate) return;
    const start = staticMouseRef.current;
    staticMouseRef.current = null;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return;
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      onActivate('end');
    });
  }, [onActivate]);

  const handleStaticDoubleClick = useCallback(() => {
    onActivate?.('end');
  }, [onActivate]);

  if (!readOnly && !isActive) {
    return (
      <Tag
        ref={(el: HTMLElement | null) => { editableRef.current = el; }}
        contentEditable={false}
        suppressContentEditableWarning
        className={`be-editable be-editable-static${className ? ` ${className}` : ''}`}
        style={{
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          cursor: 'text',
          userSelect: 'text',
          ...style,
        }}
        onMouseDown={handleStaticMouseDown}
        onMouseUp={handleStaticMouseUp}
        onDoubleClick={handleStaticDoubleClick}
        data-block-id={block.id}
        data-block-type={block.type}
        data-placeholder={placeholder}
      />
    );
  }

  return (
    <Tag
      ref={(el: HTMLElement | null) => { editableRef.current = el; }}
      contentEditable
      suppressContentEditableWarning
      className={`be-editable${persistentPlaceholder ? ' be-persistent-placeholder' : ''}${className ? ` ${className}` : ''}`}
      style={{
        outline: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...style,
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onPaste={handlePaste}
      onClick={handleClick}
      data-block-id={block.id}
      data-block-type={block.type}
      data-placeholder={placeholder}
    />
  );
}
