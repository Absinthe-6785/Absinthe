/**
 * useBlockEditor.ts — body(마크다운) ↔ Block[] binding + undo/redo
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  type Block,
  blocksToMarkdown,
  markdownToBlocks,
  insertImageAfter,
} from './blockUtils';
import { loadValidatedBlocks } from './documentRecovery';

const COALESCE_MS = 500;
const HISTORY_LIMIT = 200;

/** NoteView ref API — re-exported from BlockEditor for stable import path */
export interface BlockEditorHandle {
  insertImage: (src?: string, alt?: string) => void;
  insertEmptyImageBlock: () => void;
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

  const setActiveBlockId = useCallback((id: string | null) => {
    activeBlockIdRef.current = id;
  }, []);

  const insertImage = useCallback((src: string = '', alt: string = '') => {
    const { blocks: next, imageId } = insertImageAfter(blocks, activeBlockIdRef.current, src, alt);
    handleBlockChange(next);
    activeBlockIdRef.current = imageId;
    setExternalFocusId(imageId);
  }, [blocks, handleBlockChange]);

  const insertEmptyImageBlock = useCallback(() => insertImage('', ''), [insertImage]);

  const clearExternalFocus = useCallback(() => setExternalFocusId(null), []);

  return {
    blocks, handleBlockChange, undo, redo,
    insertImage, insertEmptyImageBlock, setActiveBlockId, externalFocusId, clearExternalFocus,
  };
}
