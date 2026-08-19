/**
 * useBlockEditor.ts — body(마크다운) ↔ Block[] binding + undo/redo
 */
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import {
  type Block,
  blocksToMarkdown,
  markdownToBlocks,
  insertImageAfter,
  makeBlock,
} from './blockUtils';
import { loadValidatedBlocks } from './documentRecovery';
import { readBlockText } from './editableDom';
import {
  getCaretOffset,
  getSelectionOffsets,
  setSelectionOffsets,
} from './features/block-editor/features/selection';

const COALESCE_MS = 500;
const HISTORY_LIMIT = 200;

interface EditorSelectionSnapshot {
  blockId: string;
  anchorOffset: number;
  focusOffset: number;
}

interface HistoryEntry {
  md: string;
  blocks: Block[];
  selection: EditorSelectionSnapshot | null;
}

function editableTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const editable = target.closest<HTMLElement>('.be-editable[data-block-id]');
  return editable && isEditableElement(editable) ? editable : null;
}

function isEditableElement(el: HTMLElement): boolean {
  return el.isContentEditable || el.getAttribute('contenteditable') === ''
    || el.getAttribute('contenteditable') === 'true';
}

function captureSelectionFor(el: HTMLElement): EditorSelectionSnapshot | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
  const ordered = getSelectionOffsets(el);
  const caret = getCaretOffset(el);
  return {
    blockId: el.dataset.blockId ?? '',
    anchorOffset: ordered?.start ?? caret,
    focusOffset: ordered?.end ?? caret,
  };
}

function captureEditorSelection(): EditorSelectionSnapshot | null {
  const active = document.activeElement instanceof HTMLElement
    ? activeElementEditable(document.activeElement)
    : null;
  if (active) return captureSelectionFor(active);
  const selection = window.getSelection();
  const anchor = selection?.anchorNode instanceof Node
    ? selection.anchorNode.parentElement?.closest<HTMLElement>('.be-editable[data-block-id]')
    : null;
  return anchor && isEditableElement(anchor) ? captureSelectionFor(anchor) : null;
}

function activeElementEditable(el: HTMLElement): HTMLElement | null {
  const editable = el.closest<HTMLElement>('.be-editable[data-block-id]');
  return editable && isEditableElement(editable) ? editable : null;
}

function restoreEditorSelection(snapshot: EditorSelectionSnapshot | null): void {
  if (!snapshot) return;
  const editable = findEditableForSnapshot(snapshot);
  if (!editable) return;

  const scrollContainer = editable.closest<HTMLElement>('.editor-drop-zone');
  const scrollTop = scrollContainer?.scrollTop;
  const scrollLeft = scrollContainer?.scrollLeft;
  const length = readBlockText(editable).length;
  const anchor = Math.max(0, Math.min(length, snapshot.anchorOffset));
  const focus = Math.max(0, Math.min(length, snapshot.focusOffset));
  try {
    editable.focus({ preventScroll: true });
  } catch {
    editable.focus();
  }
  setSelectionOffsets(editable, anchor, focus);
  if (scrollContainer && typeof scrollTop === 'number') scrollContainer.scrollTop = scrollTop;
  if (scrollContainer && typeof scrollLeft === 'number') scrollContainer.scrollLeft = scrollLeft;
}

function findEditableForSnapshot(snapshot: EditorSelectionSnapshot): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('.be-editable[data-block-id]'))
    .find(el => el.dataset.blockId === snapshot.blockId && isEditableElement(el)) ?? null;
}

/** NoteView ref API — re-exported from BlockEditor for stable import path */
export interface BlockEditorHandle {
  insertImage: (src?: string, alt?: string) => void;
  insertEmptyImageBlock: () => void;
  insertWikiLinkDraft: () => void;
  getBlocks: () => Block[];
  copyDocument: () => Promise<boolean>;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Focus first or specified block — K-108A */
  focusEditor: (blockId?: string) => void;
}

function isStructuralBlockChange(prev: Block[], next: Block[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].id !== next[i].id || prev[i].type !== next[i].type) return true;
    if ((prev[i].indent ?? 0) !== (next[i].indent ?? 0)) return true;
  }
  return false;
}

/**
 * ContentEditable emits one normalized content update per user edit. Keep
 * those updates as bounded typing transactions so a short sequence can be
 * undone incrementally, while structural operations continue to be grouped by
 * their own operation boundary.
 */
function isTextContentChange(prev: Block[], next: Block[]): boolean {
  if (isStructuralBlockChange(prev, next) || prev.length !== next.length) return false;
  return prev.some((block, index) => block.content !== next[index]?.content);
}

export function useBlockEditor(body: string, onBodyChange: (md: string) => void) {
  const [blocks, setBlocks] = useState<Block[]>(() => loadValidatedBlocks(body, markdownToBlocks));
  const prevBodyRef = useRef(body);
  const blocksRef = useRef(blocks);

  const historyRef = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] });
  const lastMdRef = useRef(body);
  const lastSnapTimeRef = useRef(0);
  const pendingBeforeSelectionRef = useRef<EditorSelectionSnapshot | null>(null);
  const pendingRestoreSelectionRef = useRef<EditorSelectionSnapshot | null>(null);
  const currentSelectionRef = useRef<EditorSelectionSnapshot | null>(null);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Capture the browser selection before the native edit mutates the DOM. This
  // keeps selection history editor-local without threading DOM state through
  // every block editing callback.
  useEffect(() => {
    const captureBeforeEdit = (event: Event) => {
      const editable = editableTarget(event.target);
      const snapshot = editable ? captureSelectionFor(editable) : null;
      if (snapshot) pendingBeforeSelectionRef.current = snapshot;
    };
    const clearForPointerOutsideEditor = (event: Event) => {
      if (!editableTarget(event.target)) pendingBeforeSelectionRef.current = null;
    };
    document.addEventListener('beforeinput', captureBeforeEdit, true);
    document.addEventListener('keydown', captureBeforeEdit, true);
    document.addEventListener('paste', captureBeforeEdit, true);
    document.addEventListener('compositionstart', captureBeforeEdit, true);
    document.addEventListener('pointerdown', clearForPointerOutsideEditor, true);
    return () => {
      document.removeEventListener('beforeinput', captureBeforeEdit, true);
      document.removeEventListener('keydown', captureBeforeEdit, true);
      document.removeEventListener('paste', captureBeforeEdit, true);
      document.removeEventListener('compositionstart', captureBeforeEdit, true);
      document.removeEventListener('pointerdown', clearForPointerOutsideEditor, true);
    };
  }, []);

  useLayoutEffect(() => {
    const snapshot = pendingRestoreSelectionRef.current;
    if (!snapshot) return undefined;
    pendingRestoreSelectionRef.current = null;
    const editable = findEditableForSnapshot(snapshot);
    const expectedContent = blocks.find(block => block.id === snapshot.blockId)?.content;
    if (editable && expectedContent != null && readBlockText(editable) === expectedContent) {
      restoreEditorSelection(snapshot);
      return undefined;
    }
    if (!editable || typeof window.requestAnimationFrame !== 'function') {
      restoreEditorSelection(snapshot);
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => restoreEditorSelection(snapshot));
    return () => window.cancelAnimationFrame(frame);
  }, [blocks]);

  const pushHistorySnapshot = useCallback((selection?: EditorSelectionSnapshot | null) => {
    const h = historyRef.current;
    h.past.push({
      md: lastMdRef.current,
      blocks: blocksRef.current,
      selection: selection === undefined ? captureEditorSelection() : selection,
    });
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    h.future = [];
  }, []);

  useEffect(() => {
    if (body !== prevBodyRef.current) {
      if (body !== lastMdRef.current) {
        pushHistorySnapshot(captureEditorSelection());
        lastSnapTimeRef.current = Date.now();
      }
      prevBodyRef.current = body;
      lastMdRef.current = body;
      const nextBlocks = loadValidatedBlocks(body, markdownToBlocks);
      blocksRef.current = nextBlocks;
      setBlocks(nextBlocks);
    }
  }, [body, pushHistorySnapshot]);

  const handleBlockChange = useCallback((newBlocks: Block[]) => {
    const md = blocksToMarkdown(newBlocks);
    if (md === lastMdRef.current) {
      pendingBeforeSelectionRef.current = null;
      return;
    }

    const now = Date.now();
    const structural = isStructuralBlockChange(blocksRef.current, newBlocks);
    const textEdit = isTextContentChange(blocksRef.current, newBlocks);
    const outsideCoalesce = now - lastSnapTimeRef.current > COALESCE_MS;

    if (structural || textEdit || outsideCoalesce) {
      pushHistorySnapshot(pendingBeforeSelectionRef.current ?? captureEditorSelection());
      lastSnapTimeRef.current = now;
    }

    currentSelectionRef.current = captureEditorSelection();
    pendingBeforeSelectionRef.current = null;
    blocksRef.current = newBlocks;
    setBlocks(newBlocks);
    lastMdRef.current = md;
    prevBodyRef.current = md;
    onBodyChange(md);
  }, [onBodyChange, pushHistorySnapshot]);

  const applyHistoryEntry = useCallback((entry: HistoryEntry) => {
    lastMdRef.current = entry.md;
    prevBodyRef.current = entry.md;
    lastSnapTimeRef.current = Date.now();
    blocksRef.current = entry.blocks;
    currentSelectionRef.current = entry.selection;
    pendingRestoreSelectionRef.current = entry.selection;
    setBlocks(entry.blocks);
    onBodyChange(entry.md);
  }, [onBodyChange]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop() as HistoryEntry;
    h.future.push({
      md: lastMdRef.current,
      blocks: blocksRef.current,
      selection: currentSelectionRef.current ?? captureEditorSelection(),
    });
    applyHistoryEntry(prev);
  }, [applyHistoryEntry]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop() as HistoryEntry;
    h.past.push({
      md: lastMdRef.current,
      blocks: blocksRef.current,
      selection: currentSelectionRef.current ?? captureEditorSelection(),
    });
    applyHistoryEntry(next);
  }, [applyHistoryEntry]);

  const canUndo = useCallback(() => historyRef.current.past.length > 0, []);
  const canRedo = useCallback(() => historyRef.current.future.length > 0, []);

  const activeBlockIdRef = useRef<string | null>(null);
  const [externalFocusId, setExternalFocusId] = useState<string | null>(null);
  const [externalFocusOffset, setExternalFocusOffset] = useState<'start' | 'end' | number>('start');

  const setActiveBlockId = useCallback((id: string | null) => {
    activeBlockIdRef.current = id;
  }, []);

  const queueFocus = useCallback((blockId: string, offset: 'start' | 'end' | number = 'start') => {
    activeBlockIdRef.current = blockId;
    setExternalFocusOffset(offset);
    setExternalFocusId(blockId);
  }, []);

  const insertImage = useCallback((src: string = '', alt: string = '') => {
    const { blocks: next, imageId } = insertImageAfter(blocks, activeBlockIdRef.current, src, alt);
    handleBlockChange(next);
    queueFocus(imageId, 'start');
  }, [blocks, handleBlockChange, queueFocus]);

  const insertEmptyImageBlock = useCallback(() => insertImage('', ''), [insertImage]);

  const insertWikiLinkDraft = useCallback(() => {
    const textTypes = new Set(['paragraph', 'heading1', 'heading2', 'heading3', 'heading4', 'bullet', 'numbered', 'quote']);
    let nextBlocks = [...blocks];
    let targetIdx = nextBlocks.length - 1;
    while (targetIdx >= 0 && !textTypes.has(nextBlocks[targetIdx].type)) targetIdx--;

    if (targetIdx >= 0) {
      const block = nextBlocks[targetIdx];
      const prefix = block.content && !block.content.endsWith('\n') ? '\n' : '';
      const content = `${block.content}${prefix}[[`;
      nextBlocks = nextBlocks.map((b, i) => (i === targetIdx ? { ...b, content } : b));
      handleBlockChange(nextBlocks);
      queueFocus(block.id, content.length);
      return;
    }

    const newBlock = makeBlock('paragraph', { content: '[[' });
    nextBlocks = [...nextBlocks, newBlock];
    handleBlockChange(nextBlocks);
    queueFocus(newBlock.id, 2);
  }, [blocks, handleBlockChange, queueFocus]);

  const clearExternalFocus = useCallback(() => {
    setExternalFocusId(null);
    setExternalFocusOffset('start');
  }, []);

  const focusEditor = useCallback((blockId?: string) => {
    const id = blockId ?? blocksRef.current[0]?.id;
    if (id) queueFocus(id, 'end');
  }, [queueFocus]);

  const getBlocks = useCallback(() => blocks, [blocks]);

  const copyDocument = useCallback(async () => {
    const { copyBlocksToClipboard } = await import(
      './features/block-editor/features/clipboard/copy/copyToClipboard'
    );
    return copyBlocksToClipboard(blocks);
  }, [blocks]);

  return {
    blocks, handleBlockChange, undo, redo, canUndo, canRedo,
    insertImage, insertEmptyImageBlock, insertWikiLinkDraft,
    setActiveBlockId, externalFocusId, externalFocusOffset, clearExternalFocus,
    getBlocks, copyDocument, focusEditor,
  };
}
