/**
 * useBlockEditor.ts — body(마크다운) ↔ Block[] binding + undo/redo
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  type Block,
  blocksToMarkdown,
  markdownToBlocks,
  insertImageAfter,
  makeBlock,
} from './blockUtils';
import { loadValidatedBlocks } from './documentRecovery';

const COALESCE_MS = 500;
const HISTORY_LIMIT = 200;

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

export function useBlockEditor(body: string, onBodyChange: (md: string) => void) {
  const [blocks, setBlocks] = useState<Block[]>(() => loadValidatedBlocks(body, markdownToBlocks));
  const prevBodyRef = useRef(body);
  const blocksRef = useRef(blocks);

  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const lastMdRef = useRef(body);
  const lastSnapTimeRef = useRef(0);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const pushHistorySnapshot = useCallback(() => {
    const h = historyRef.current;
    h.past.push(lastMdRef.current);
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    h.future = [];
  }, []);

  useEffect(() => {
    if (body !== prevBodyRef.current) {
      if (body !== lastMdRef.current) {
        pushHistorySnapshot();
        lastSnapTimeRef.current = Date.now();
      }
      prevBodyRef.current = body;
      lastMdRef.current = body;
      setBlocks(loadValidatedBlocks(body, markdownToBlocks));
    }
  }, [body, pushHistorySnapshot]);

  const handleBlockChange = useCallback((newBlocks: Block[]) => {
    const md = blocksToMarkdown(newBlocks);
    if (md === lastMdRef.current) return;

    const now = Date.now();
    const structural = isStructuralBlockChange(blocksRef.current, newBlocks);
    const outsideCoalesce = now - lastSnapTimeRef.current > COALESCE_MS;

    if (structural || outsideCoalesce) {
      pushHistorySnapshot();
      lastSnapTimeRef.current = now;
    }

    setBlocks(newBlocks);
    lastMdRef.current = md;
    prevBodyRef.current = md;
    onBodyChange(md);
  }, [onBodyChange, pushHistorySnapshot]);

  const applyMd = useCallback((md: string) => {
    lastMdRef.current = md;
    prevBodyRef.current = md;
    lastSnapTimeRef.current = Date.now();
    setBlocks(loadValidatedBlocks(md, markdownToBlocks));
    onBodyChange(md);
  }, [onBodyChange]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop() as string;
    h.future.push(lastMdRef.current);
    applyMd(prev);
  }, [applyMd]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop() as string;
    h.past.push(lastMdRef.current);
    applyMd(next);
  }, [applyMd]);

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
