import { useEffect, type RefObject } from 'react';
import type { Block } from '../../../blockUtils';
import { shouldDeleteSelectedBlocks } from '../../../blockKeyboard';
import {
  isEditorDocumentSearchFocused,
  isSidebarNoteSearchFocused,
  shouldSuppressEditorKeyboardShortcuts,
} from '../../../searchFocusIsolation';
import { extendSelectionByArrow, getDocumentOrderedIds } from '../features/selection';
import { handleSelectAllKeydown } from '../features/selection/utils/documentSelectAll';
import { blurActiveEditorFocus } from '../../../documentFocus';

function elementClosest(el: HTMLElement | null, selector: string): Element | null {
  if (!el || typeof el.closest !== 'function') return null;
  return el.closest(selector);
}

function editorMenuOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('.be-slash-menu, .be-wiki-menu'));
}

function editorDragActive(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('.be-editor-root.be-drag-active, .be-block.be-dragging'));
}

function firstSelectedInOrder(blocks: Block[], selected: Set<string>): string | null {
  const ordered = getDocumentOrderedIds(blocks);
  const ids = [...selected].sort((a, b) => ordered.indexOf(a) - ordered.indexOf(b));
  return ids[0] ?? null;
}

function documentOrderEndpoints(blocks: Block[], selected: Set<string>): { first: string; last: string } | null {
  const ordered = getDocumentOrderedIds(blocks);
  const indices = [...selected]
    .map(id => ordered.indexOf(id))
    .filter(i => i >= 0)
    .sort((a, b) => a - b);
  if (!indices.length) return null;
  return { first: ordered[indices[0]!]!, last: ordered[indices[indices.length - 1]!]! };
}

export interface UseEditorKeyboardOptions {
  readOnly: boolean;
  depth: number;
  getSelectedIds: () => Set<string>;
  getRootBlocks?: () => Block[];
  anchorBlockId?: string | null;
  activeBlockId?: string | null;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onExtendSelection?: (selected: Set<string>, anchorId: string) => void;
  onSelectBlock?: (id: string) => void;
  onEnterEditBlock?: (id: string) => void;
  onIndentSelected?: () => void;
  onOutdentSelected?: () => void;
  documentRootRef?: RefObject<HTMLElement | null>;
}

export function useEditorKeyboard({
  readOnly,
  depth,
  getSelectedIds,
  getRootBlocks,
  anchorBlockId = null,
  activeBlockId = null,
  onClearSelection,
  onDeleteSelected,
  onExtendSelection,
  onSelectBlock,
  onEnterEditBlock,
  onIndentSelected,
  onOutdentSelected,
  documentRootRef,
}: UseEditorKeyboardOptions): void {
  useEffect(() => {
    if (readOnly || depth !== 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (handleSelectAllKeydown(e, documentRootRef?.current ?? null)) return;

      if (e.key === 'Escape') {
        if (editorMenuOpen() || editorDragActive()) return;
        if (isEditorDocumentSearchFocused() || isSidebarNoteSearchFocused()) return;
        const target = e.target as HTMLElement | null;
        const inEditorRoot = elementClosest(target, '.be-editor-root');
        if (
          target
          && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
          && !inEditorRoot
        ) {
          return;
        }
        const editing = elementClosest(target, '.be-editable[contenteditable="true"]')
          ? inEditorRoot
          : null;
        if (editing && onSelectBlock) {
          const blockId = elementClosest(target, '[data-drag-id]')?.getAttribute('data-drag-id');
          if (blockId) {
            e.preventDefault();
            (elementClosest(target, '.be-editable[contenteditable="true"]') as HTMLElement | null)?.blur();
            blurActiveEditorFocus(documentRootRef?.current ?? null);
            onSelectBlock(blockId);
            return;
          }
        }
        if (getSelectedIds().size > 0) {
          e.preventDefault();
          onClearSelection();
        }
        return;
      }

      if (shouldSuppressEditorKeyboardShortcuts()) return;

      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const selected = getSelectedIds();
        if (selected.size === 0) return;
        const target = e.target as HTMLElement | null;
        const editingInBlock = elementClosest(target, '.be-editable[contenteditable="true"]');
        if (selected.size === 1 && editingInBlock) return;
        e.preventDefault();
        if (e.shiftKey) onOutdentSelected?.();
        else onIndentSelected?.();
        return;
      }

      if (
        e.key === 'Enter'
        && !e.shiftKey
        && !e.ctrlKey
        && !e.metaKey
        && !e.altKey
        && getRootBlocks
        && onEnterEditBlock
      ) {
        const selected = getSelectedIds();
        if (selected.size > 0) {
          const target = e.target as HTMLElement | null;
          if (!elementClosest(target, '.be-editable[contenteditable="true"]')) {
            const id = firstSelectedInOrder(getRootBlocks(), selected);
            if (id) {
              e.preventDefault();
              onEnterEditBlock(id);
              return;
            }
          }
        }
      }

      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && getRootBlocks && onExtendSelection) {
        const selected = getSelectedIds();
        const blocks = getRootBlocks();
        const endpoints = selected.size > 0 ? documentOrderEndpoints(blocks, selected) : null;
        const focusId = endpoints
          ? (e.key === 'ArrowDown' ? endpoints.last : endpoints.first)
          : activeBlockId;
        if (!focusId) return;
        const target = e.target as HTMLElement | null;
        if (!elementClosest(target, '.be-editor-root')) return;
        const extended = extendSelectionByArrow(
          blocks,
          anchorBlockId,
          focusId,
          e.key === 'ArrowUp' ? 'up' : 'down',
        );
        if (extended) {
          e.preventDefault();
          onExtendSelection(extended.selected, extended.anchorId);
        }
        return;
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!shouldDeleteSelectedBlocks(e, getSelectedIds())) return;
      e.preventDefault();
      onDeleteSelected();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    readOnly,
    depth,
    onDeleteSelected,
    onClearSelection,
    getSelectedIds,
    getRootBlocks,
    anchorBlockId,
    activeBlockId,
    onExtendSelection,
    onSelectBlock,
    onEnterEditBlock,
    onIndentSelected,
    onOutdentSelected,
    documentRootRef,
  ]);
}
