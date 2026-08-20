// @vitest-environment happy-dom
/**
 * EJU QA paste pipeline — gutter copy assumed correct, trace paste only.
 * Run: npm test -- ejuPastePipeline.investigation --disable-console-intercept
 */
import { createElement } from 'react';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { blocksToCopyHtml, clipboardToBlocks, isDocumentLevelPaste } from './features/block-editor/features/clipboard';
import { applyPasteBlocksAt } from './features/block-editor/features/clipboard/paste/blockPaste';
import { getPasteBlockContext } from './features/block-editor/utils/blockEditorMutations';
import {
  beginPastePipelineTrace,
  finishPastePipelineTrace,
  getLastPastePipelineTrace,
  traceApplyPasteBlocksAtInput,
  traceApplyPasteBlocksAtOutput,
  traceClipboardToBlocks,
  traceStateAfterSetStateCallback,
  traceStateBeforeSetState,
} from './pastePipelineTrace';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { findBlockById, makeBlock, type Block } from './blockUtils';
import { makeEjuBlocks } from '@/test/fixtures/ejuClipboardFixtures';

function mountNewNote(initialBlocks: Block[]) {
  let currentBlocks = initialBlocks;
  let onChangeRef: (b: Block[]) => void = () => {};

  function StatefulEditor() {
    const [blocks, setBlocks] = React.useState(initialBlocks);
    onChangeRef = (b: Block[]) => {
      currentBlocks = b;
      setBlocks(b);
    };
    return createElement(BlockEditor, {
      blocks,
      onChange: onChangeRef,
      colors: {
        bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
        accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
        cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
        danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
        toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
      },
      readOnly: false,
    });
  }

  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);
  const outer = document.createElement('div');
  document.body.appendChild(outer);
  let root: Root | null = null;
  act(() => {
    root = createRoot(outer);
    root.render(createElement(StatefulEditor));
  });
  return {
    root,
    getBlocks: () => currentBlocks,
    setBlocks: (blocks: Block[]) => act(() => { onChangeRef(blocks); }),
  };
}

/** Mirrors EditableBlock.handlePaste → useEditorPaste.handlePasteBlocksAt (happy-dom lacks React paste). */
function simulateDocumentPaste(
  editor: ReturnType<typeof mountNewNote>,
  targetBlockId: string,
  html: string,
  plain: string,
) {
  const dt = {
    getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : ''),
  };
  const docBlocks = clipboardToBlocks(dt);
  if (!docBlocks || !isDocumentLevelPaste(dt, docBlocks)) {
    throw new Error('Expected document-level paste');
  }

  beginPastePipelineTrace(`paste-at-${targetBlockId}`);
  traceClipboardToBlocks(docBlocks);

  const cur = editor.getBlocks();
  const target = findBlockById(cur, targetBlockId);
  const context = getPasteBlockContext(target);
  traceApplyPasteBlocksAtInput(targetBlockId, target?.type ?? '(missing)', 0, 0, docBlocks);

  const result = applyPasteBlocksAt(cur, targetBlockId, 0, 0, docBlocks, context);
  if (!result) {
    finishPastePipelineTrace();
    throw new Error('applyPasteBlocksAt returned null');
  }

  traceApplyPasteBlocksAtOutput(result.blocks);
  traceStateBeforeSetState(result.blocks);
  flushSync(() => { editor.setBlocks(result.blocks); });
  traceStateAfterSetStateCallback(editor.getBlocks());
  finishPastePipelineTrace();
}

describe('EJU paste pipeline trace — gutter copy → paste new note', () => {
  const ejuBlocks = makeEjuBlocks();
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;
  const semanticHtml = blocksToCopyHtml([grammarToggle]);
  const semanticPlain = `> Grammar Module\n  ## Particles\n  - は vs が`;

  let root: Root | null = null;
  let editor: ReturnType<typeof mountNewNote> | null = null;

  afterEach(() => {
    act(() => { root?.unmount(); });
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('QA reproduction — paste semantic toggle into empty new note', () => {
    const newNoteHost = makeBlock('paragraph', { id: 'new-host', content: '' });
    editor = mountNewNote([newNoteHost]);
    root = editor.root;

    simulateDocumentPaste(editor, newNoteHost.id, semanticHtml, semanticPlain);

    const trace = getLastPastePipelineTrace()!;
    const docAfterPaste = editor.getBlocks();

    // eslint-disable-next-line no-console
    console.info('\n========== EJU PASTE PIPELINE TRACE (QA) ==========');
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      A: {
        firstRootType: trace.A_clipboardToBlocks?.firstRootType,
        tree: trace.A_clipboardToBlocks?.tree,
        clipboardRootRef: trace.A_clipboardToBlocks?.clipboardRootRef,
      },
      B: trace.B_applyPasteBlocksAtInput,
      C: {
        firstRootType: trace.C_applyPasteBlocksAtOutput?.firstRootType,
        firstDivergenceFromA: trace.C_applyPasteBlocksAtOutput?.firstDivergenceFromA,
        clipboardRootRefSurvives: trace.C_applyPasteBlocksAtOutput?.clipboardRootRefSurvives,
        tree: trace.C_applyPasteBlocksAtOutput?.tree,
      },
      D: trace.D_stateUpdate,
      E: trace.E_render,
      docAfterPasteTypes: docAfterPaste.map(b => b.type),
    }, null, 2));

    expect(trace.A_clipboardToBlocks?.firstRootType).toBe('toggle');
    expect(trace.B_applyPasteBlocksAtInput?.targetBlockType).toBe('paragraph');
    expect(trace.C_applyPasteBlocksAtOutput?.firstRootType).toBe('toggle');
    expect(trace.C_applyPasteBlocksAtOutput?.firstDivergenceFromA).toBeNull();
    expect(trace.D_stateUpdate?.firstDivergenceFromC).toBeNull();
    expect(docAfterPaste[0]?.type).toBe('toggle');
    expect(trace.E_render[0]?.blockType).toBe('toggle');
    expect(trace.E_render[0]?.renderedComponent).toBe('ToggleBlock');
  });

  it('control — malformed clipboard (h3.btsummary) diverges at A', () => {
    const malformedHtml = `<h3 class="btsummary">Grammar Module</h3><div class="btbody"><h2>Particles</h2></div>`;
    const newNoteHost = makeBlock('paragraph', { id: 'new-host', content: '' });
    editor = mountNewNote([newNoteHost]);
    root = editor.root;

    simulateDocumentPaste(editor, newNoteHost.id, malformedHtml, '');

    const trace = getLastPastePipelineTrace()!;
    const docAfterPaste = editor.getBlocks();
    expect(trace.A_clipboardToBlocks?.firstRootType).toBe('heading3');
    expect(trace.C_applyPasteBlocksAtOutput?.firstRootType).toBe('heading3');
    expect(trace.E_render[0]?.blockType).toBe('heading3');
    expect(trace.E_render[0]?.renderedComponent).toBe('EditableBlock/heading3');
    expect(docAfterPaste[0]?.type).toBe('heading3');
    expect(trace.C_applyPasteBlocksAtOutput?.firstDivergenceFromA).toMatch(/length 2 vs 1/);
  });
});
