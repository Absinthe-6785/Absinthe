// @vitest-environment happy-dom
/**
 * UX-3A — EJU paste insertion pipeline trace (no fixes).
 * Run: npm test -- ejuPasteInsertion.investigation --disable-console-intercept
 */
import { describe, expect, it } from 'vitest';
import { blockShape, type TreeShape } from './blockCopy.investigationHelpers';
import { blocksToCopyHtml } from './blockCopy';
import {
  applyPasteAtBlock,
  applyPasteBlocksAt,
  extractClipboardText,
} from './blockPaste';
import { blocksToMarkdown, findBlockById, markdownToBlocks, type Block } from './blockUtils';
import { clipboardToBlocks, isDocumentLevelPaste } from './pasteOrchestrator';

const EJU_NOTE_MD = `# EJU Study Timeline

> Grammar Module
  ## Particles
  - は vs が
  - を particle usage
    - nested bullet
  1. Drill set A
  2. Drill set B
  > Vocab nest
    ### Core kanji
    - 読む
    - 書く

> Reading Module
  ## Comprehension
  - Main idea questions
  - Detail matching
  1. Practice passage 1
  2. Practice passage 2

## Global review checklist
- Redo wrong answers
- Time yourself`;

const BROWSER_DOM_CLIPBOARD_HTML = `<meta charset='utf-8'><div class="be-toggle-wrap"><div class="be-toggle-header-block be-block"><div class="be-content"><div style="display:flex;gap:6px"><button type="button" aria-label="접기"></button><span class="be-editable" style="font-weight:600">Grammar Module</span></div></div></div><div class="be-toggle-children be-toggle-drop" data-toggle-id="GRAMMAR_ID"><div class="be-block"><div class="be-content"><h2 class="be-editable">Particles</h2></div></div><div class="be-block"><div class="be-content"><div style="display:flex;gap:8px"><span>•</span><span class="be-editable">は vs が</span></div></div></div></div></div>`;

const VARIANT_B_HTML = `<h3 class="btsummary">Grammar Module</h3><div class="btbody"><h2>Particles</h2><ul><li>は vs が</li></ul></div>`;

export interface PasteTargetContext {
  targetBlockId: string;
  targetBlockType: string;
  targetBlockContent: string;
  activeBlockId: string;
  activeBlockType: string;
  caretStart: number;
  caretEnd: number;
}

export interface PasteInsertionTrace {
  label: string;
  target: PasteTargetContext;
  clipboardHtmlLength: number;
  clipboardPlainLength: number;
  route: 'applyPasteBlocksAt' | 'applyPasteAtBlock' | 'none';
  parsedTree: TreeShape[];
  parsedRootType: string | null;
  insertedTree: TreeShape[] | null;
  insertedRootType: string | null;
  finalTree: TreeShape[] | null;
  finalRootType: string | null;
  firstDivergenceParsedVsExpected: string | null;
  firstDivergenceParsedVsInserted: string | null;
  firstDivergenceParsedVsFinal: string | null;
  firstTypeMutationFunction: string | null;
}

function firstTypeDivergence(
  orig: TreeShape[],
  parsed: TreeShape[],
  path = 'root',
): string | null {
  if (orig.length !== parsed.length) {
    return `${path}: length ${orig.length} vs ${parsed.length} (orig[0].type=${orig[0]?.type} parsed[0].type=${parsed[0]?.type})`;
  }
  for (let i = 0; i < orig.length; i++) {
    const a = orig[i];
    const b = parsed[i];
    const p = `${path}[${i}]`;
    if (a.type !== b.type) return `${p}: type ${a.type} vs ${b.type}`;
    if ((a.content ?? '') !== (b.content ?? '')) {
      return `${p}: content "${a.content ?? ''}" vs "${b.content ?? ''}"`;
    }
    const ac = a.children ?? [];
    const bc = b.children ?? [];
    const d = firstTypeDivergence(ac, bc, `${p}.children`);
    if (d) return d;
  }
  return null;
}

function insertedSlice(
  before: Block[],
  after: Block[],
  targetId: string,
  windowSize = 3,
): TreeShape[] {
  const idx = after.findIndex(b => b.id === targetId);
  if (idx < 0) return blockShape(after);
  const start = Math.max(0, idx - 1);
  const end = Math.min(after.length, idx + windowSize);
  return blockShape(after.slice(start, end));
}

function inferMutationFunction(
  parsedRootType: string | null,
  insertedRootType: string | null,
  parsedVsInserted: string | null,
): string | null {
  if (!parsedRootType) return null;
  if (parsedRootType !== 'toggle' && parsedRootType === insertedRootType) {
    return 'clipboardToBlocks → htmlDocumentToBlocks.walkNode (parse-time type assignment)';
  }
  if (parsedRootType === 'toggle' && insertedRootType !== 'toggle' && parsedVsInserted) {
    if (parsedVsInserted.includes('type toggle vs')) {
      return parsedVsInserted.includes('.children')
        ? 'applyPasteBlocksAt (sibling splice / id merge)'
        : 'applyPasteBlocksAt (target block replacement)';
    }
  }
  if (parsedRootType === insertedRootType) return null;
  return 'applyPasteBlocksAt or applyPasteAtBlock';
}

/** Mirrors EditableBlock.handlePaste → BlockEditor.handlePasteBlocksAt / handlePasteAt. */
export function tracePasteInsertion(
  label: string,
  documentBlocks: Block[],
  targetBlockId: string,
  caretStart: number,
  caretEnd: number,
  clipboard: { html: string; plain: string },
  expectedParsed?: Block[],
): PasteInsertionTrace {
  const target = findBlockById(documentBlocks, targetBlockId);
  const targetCtx: PasteTargetContext = {
    targetBlockId,
    targetBlockType: target?.type ?? '(not found)',
    targetBlockContent: target?.content ?? '',
    activeBlockId: targetBlockId,
    activeBlockType: target?.type ?? '(not found)',
    caretStart,
    caretEnd,
  };

  const dt = {
    getData: (t: string) => (t === 'text/html' ? clipboard.html : t === 'text/plain' ? clipboard.plain : ''),
  };

  const parsed = clipboardToBlocks(dt);
  const parsedTree = blockShape(parsed ?? []);
  const parsedRootType = parsed?.[0]?.type ?? null;

  const context = target ? { blockType: target.type, indent: target.indent } : undefined;
  let route: PasteInsertionTrace['route'] = 'none';
  let pasteResult: ReturnType<typeof applyPasteBlocksAt> = null;

  if (parsed && isDocumentLevelPaste(dt, parsed)) {
    route = 'applyPasteBlocksAt';
    pasteResult = applyPasteBlocksAt(
      documentBlocks,
      targetBlockId,
      caretStart,
      caretEnd,
      parsed,
      context,
    );
  } else {
    const raw = extractClipboardText(dt);
    if (raw) {
      route = 'applyPasteAtBlock';
      pasteResult = applyPasteAtBlock(
        documentBlocks,
        targetBlockId,
        caretStart,
        caretEnd,
        raw,
        context,
      );
    }
  }

  const insertedTree = pasteResult
    ? insertedSlice(documentBlocks, pasteResult.blocks, targetBlockId)
    : null;
  const finalTree = pasteResult ? blockShape(pasteResult.blocks) : null;

  const expectedShape = expectedParsed ? blockShape(expectedParsed) : null;
  const divExpected = expectedShape
    ? firstTypeDivergence(expectedShape, parsedTree)
    : null;
  const divInserted = parsed && insertedTree
    ? firstTypeDivergence(parsedTree, insertedTree.length === 1 ? parsedTree : insertedTree)
    : null;

  // Compare parsed root to what landed at target index
  const targetAfter = pasteResult
    ? findBlockById(pasteResult.blocks, targetBlockId)
    : null;
  const insertedRootType = targetAfter?.type ?? insertedTree?.[1]?.type ?? insertedTree?.[0]?.type ?? null;
  const finalRootType = pasteResult?.blocks[0]?.type ?? null;

  const divFinal = parsed && finalTree
    ? firstTypeDivergence(parsedTree, blockShape([targetAfter!].filter(Boolean)))
    : null;

  return {
    label,
    target: targetCtx,
    clipboardHtmlLength: clipboard.html.length,
    clipboardPlainLength: clipboard.plain.length,
    route,
    parsedTree,
    parsedRootType,
    insertedTree,
    insertedRootType,
    finalTree,
    finalRootType,
    firstDivergenceParsedVsExpected: divExpected,
    firstDivergenceParsedVsInserted: divInserted,
    firstDivergenceParsedVsFinal: divFinal,
    firstTypeMutationFunction: inferMutationFunction(parsedRootType, insertedRootType, divInserted),
  };
}

function dumpTrace(t: PasteInsertionTrace): void {
  // eslint-disable-next-line no-console
  console.info(`\n${'='.repeat(72)}\n${t.label}\n${'='.repeat(72)}`);
  // eslint-disable-next-line no-console
  console.info('TARGET BEFORE PASTE:', JSON.stringify(t.target, null, 2));
  // eslint-disable-next-line no-console
  console.info('ROUTE:', t.route);
  // eslint-disable-next-line no-console
  console.info('PARSED TREE (clipboardToBlocks):', JSON.stringify(t.parsedTree, null, 2));
  // eslint-disable-next-line no-console
  console.info('INSERTED SLICE (applyPaste* at target):', JSON.stringify(t.insertedTree, null, 2));
  // eslint-disable-next-line no-console
  console.info('FINAL DOCUMENT TREE:', JSON.stringify(t.finalTree, null, 2));
  // eslint-disable-next-line no-console
  console.info('SUMMARY:', JSON.stringify({
    parsedRootType: t.parsedRootType,
    insertedRootType: t.insertedRootType,
    finalRootType: t.finalRootType,
    firstDivergenceParsedVsExpected: t.firstDivergenceParsedVsExpected,
    firstDivergenceParsedVsInserted: t.firstDivergenceParsedVsInserted,
    firstTypeMutationFunction: t.firstTypeMutationFunction,
  }, null, 2));
}

describe('EJU paste insertion investigation', () => {
  const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
    b => b.type !== 'paragraph' || b.content.trim() !== '',
  );
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;
  const titleBlock = ejuBlocks[0];
  const semanticHtml = blocksToCopyHtml([grammarToggle]);
  const semanticPlain = blocksToMarkdown([grammarToggle]);

  it('1 — verified semantic copy → paste at title caret 0 (primary EJU flow)', () => {
    const trace = tracePasteInsertion(
      '1: semantic clipboard → paste at h1 offset 0',
      ejuBlocks,
      titleBlock.id,
      0,
      0,
      { html: semanticHtml, plain: semanticPlain },
      [grammarToggle],
    );
    dumpTrace(trace);

    expect(trace.parsedRootType).toBe('toggle');
    expect(trace.route).toBe('applyPasteBlocksAt');
    expect(trace.insertedRootType).toBe('toggle');
    expect(trace.firstDivergenceParsedVsExpected).toBeNull();
    expect(trace.firstTypeMutationFunction).toBeNull();
  });

  it('2 — verified semantic copy → paste at title caret end', () => {
    const trace = tracePasteInsertion(
      '2: semantic clipboard → paste at h1 end',
      ejuBlocks,
      titleBlock.id,
      titleBlock.content.length,
      titleBlock.content.length,
      { html: semanticHtml, plain: semanticPlain },
      [grammarToggle],
    );
    dumpTrace(trace);

    expect(trace.parsedRootType).toBe('toggle');
    expect(trace.insertedRootType).toBe('toggle');
    expect(trace.firstTypeMutationFunction).toBeNull();
  });

  it('3 — verified semantic copy → paste at Grammar toggle header (full select)', () => {
    const trace = tracePasteInsertion(
      '3: semantic clipboard → paste at Grammar toggle header (full header selected)',
      ejuBlocks,
      grammarToggle.id,
      0,
      grammarToggle.content.length,
      { html: semanticHtml, plain: semanticPlain },
      [grammarToggle],
    );
    dumpTrace(trace);

    expect(trace.parsedRootType).toBe('toggle');
    expect(trace.insertedRootType).toBe('toggle');
    // applyPasteAtToggleHeader: pasted toggle inserted as sibling, not type rewrite
    expect(trace.firstTypeMutationFunction).toBeNull();
  });

  it('4 — browser DOM clipboard (pre-UX-3A.3 copy failure) → paste at title', () => {
    const browserHtml = BROWSER_DOM_CLIPBOARD_HTML.replace(/GRAMMAR_ID/g, grammarToggle.id);
    const plain = 'Grammar Module\nParticles\nは vs が';
    const trace = tracePasteInsertion(
      '4: browser .be-toggle-wrap DOM → paste at h1 offset 0',
      ejuBlocks,
      titleBlock.id,
      0,
      0,
      { html: browserHtml, plain },
      [grammarToggle],
    );
    dumpTrace(trace);

    expect(trace.parsedRootType).toBe('paragraph');
    expect(trace.firstDivergenceParsedVsExpected).toMatch(/parsed\[0\]\.type=paragraph/);
    expect(trace.firstTypeMutationFunction).toContain('clipboardToBlocks');
  });

  it('5 — variant B h3.btsummary clipboard → paste at title', () => {
    const trace = tracePasteInsertion(
      '5: h3.btsummary (no details wrapper) → paste at h1 offset 0',
      ejuBlocks,
      titleBlock.id,
      0,
      0,
      { html: VARIANT_B_HTML, plain: '' },
      [grammarToggle],
    );
    dumpTrace(trace);

    expect(trace.parsedRootType).toBe('heading3');
    expect(trace.insertedRootType).toBe('heading3');
    expect(trace.firstDivergenceParsedVsExpected).toMatch(/parsed\[0\]\.type=heading3/);
    expect(trace.firstTypeMutationFunction).toContain('clipboardToBlocks');
  });

  it('6 — verdict: insertion does NOT rewrite semantic toggle to heading3', () => {
    const semantic = tracePasteInsertion(
      'VERDICT semantic path',
      ejuBlocks,
      titleBlock.id,
      0,
      0,
      { html: semanticHtml, plain: semanticPlain },
      [grammarToggle],
    );
    const variantB = tracePasteInsertion(
      'VERDICT variant B path',
      ejuBlocks,
      titleBlock.id,
      0,
      0,
      { html: VARIANT_B_HTML, plain: '' },
      [grammarToggle],
    );

    // eslint-disable-next-line no-console
    console.info('\n========== PASTE INSERTION VERDICT ==========');
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      semanticPath: {
        A_clipboardToBlocks_returns_heading3: semantic.parsedRootType === 'heading3',
        B_insertion_rewrites_toggle: semantic.parsedRootType === 'toggle' && semantic.insertedRootType === 'heading3',
        parsedRootType: semantic.parsedRootType,
        insertedRootType: semantic.insertedRootType,
        mutationFunction: semantic.firstTypeMutationFunction,
      },
      variantBPath: {
        A_clipboardToBlocks_returns_heading3: variantB.parsedRootType === 'heading3',
        B_insertion_rewrites_toggle: variantB.parsedRootType === 'toggle' && variantB.insertedRootType === 'heading3',
        parsedRootType: variantB.parsedRootType,
        mutationFunction: variantB.firstTypeMutationFunction,
      },
      nestedH3InSemanticTree: semantic.parsedTree[0]?.children?.find(c => c.content === 'Vocab nest')
        ?.children?.find(c => c.type === 'heading3')?.content,
      note: 'Nested "Core kanji" heading3 inside toggle children is expected — not root toggle loss',
    }, null, 2));

    expect(semantic.parsedRootType).toBe('toggle');
    expect(semantic.insertedRootType).toBe('toggle');
    expect(variantB.parsedRootType).toBe('heading3');
    expect(variantB.firstTypeMutationFunction).toContain('clipboardToBlocks');
  });
});
