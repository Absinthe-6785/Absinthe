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
}

export function useBlockEditor(body: string, onBodyChange: (md: string) => void) {
  const [blocks, setBlocks] = useState<Block[]>(() => loadValidatedBlocks(body, markdownToBlocks));
  const prevBodyRef = useRef(body);

  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const lastMdRef = useRef(body);
  const lastSnapTimeRef = useRef(0);

  useEffect(() => {
    if (body !== prevBodyRef.current) {
      if (body !== lastMdRef.current) {
        historyRef.current.past.push(lastMdRef.current);
        if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift();
        historyRef.current.future = [];
        lastSnapTimeRef.current = Date.now();
      }
      prevBodyRef.current = body;
      lastMdRef.current = body;
      setBlocks(loadValidatedBlocks(body, markdownToBlocks));
    }
  }, [body]);

  const handleBlockChange = useCallback((newBlocks: Block[]) => {
    const md = blocksToMarkdown(newBlocks);
    if (md !== lastMdRef.current) {
      const now = Date.now();
      if (now - lastSnapTimeRef.current > COALESCE_MS) {
        historyRef.current.past.push(lastMdRef.current);
        if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift();
        historyRef.current.future = [];
        lastSnapTimeRef.current = now;
      }
    }
    setBlocks(newBlocks);
    lastMdRef.current = md;
    prevBodyRef.current = md;
    onBodyChange(md);
  }, [onBodyChange]);

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

  const getBlocks = useCallback(() => blocks, [blocks]);

  const copyDocument = useCallback(async () => {
    const { copyBlocksToClipboard } = await import(
      './features/block-editor/features/clipboard/copy/copyToClipboard'
    );
    return copyBlocksToClipboard(blocks);
  }, [blocks]);

  return {
    blocks, handleBlockChange, undo, redo,
    insertImage, insertEmptyImageBlock, insertWikiLinkDraft,
    setActiveBlockId, externalFocusId, externalFocusOffset, clearExternalFocus,
    getBlocks, copyDocument,
  };
}
