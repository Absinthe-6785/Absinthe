/**
 * pastePipelineTrace.ts — Live paste pipeline instrumentation (QA)
 * Traces clipboardToBlocks → applyPasteBlocksAt → setState → render.
 */
import type { Block } from './blockUtils';
import { blockShape } from './blockCopy.investigationHelpers';

export interface BlockIdentityNode {
  id: string;
  type: string;
  objectRef: string;
  contentPreview: string;
  children?: BlockIdentityNode[];
}

export interface PastePipelineTrace {
  label: string;
  timestamp: number;
  A_clipboardToBlocks: {
    tree: ReturnType<typeof blockShape>;
    identity: BlockIdentityNode[];
    firstRootType: string | null;
    clipboardRootRef: string | null;
  } | null;
  B_applyPasteBlocksAtInput: {
    targetBlockId: string;
    targetBlockType: string;
    caretStart: number;
    caretEnd: number;
    pastedBlocksJson: ReturnType<typeof blockShape>;
    pastedIdentity: BlockIdentityNode[];
  } | null;
  C_applyPasteBlocksAtOutput: {
    tree: ReturnType<typeof blockShape>;
    identity: BlockIdentityNode[];
    firstRootType: string | null;
    firstDivergenceFromA: string | null;
    clipboardRootRefSurvives: boolean;
  } | null;
  D_stateUpdate: {
    beforeSetState: ReturnType<typeof blockShape>;
    beforeIdentity: BlockIdentityNode[];
    afterSetStateCallback: ReturnType<typeof blockShape>;
    afterIdentity: BlockIdentityNode[];
    firstDivergenceFromC: string | null;
  } | null;
  E_render: Array<{
    blockId: string;
    blockType: string;
    objectRef: string;
    renderedComponent: string;
    clipboardRootRefMatch: boolean;
  }>;
}

let refCounter = 0;
const blockRefIds = new WeakMap<object, string>();

function refTag(obj: object): string {
  let tag = blockRefIds.get(obj);
  if (!tag) {
    refCounter += 1;
    tag = `ref-${refCounter}`;
    blockRefIds.set(obj, tag);
  }
  return tag;
}

function identityTree(blocks: Block[]): BlockIdentityNode[] {
  return blocks.map(b => ({
    id: b.id,
    type: b.type,
    objectRef: refTag(b),
    contentPreview: (b.content ?? '').slice(0, 48),
    children: b.children?.length ? identityTree(b.children) : undefined,
  }));
}

function firstTypeDivergence(
  a: ReturnType<typeof blockShape>,
  b: ReturnType<typeof blockShape>,
  path = 'root',
): string | null {
  if (a.length !== b.length) {
    return `${path}: length ${a.length} vs ${b.length} (a[0].type=${a[0]?.type} b[0].type=${b[0]?.type})`;
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    const p = `${path}[${i}]`;
    if (x.type !== y.type) return `${p}: type ${x.type} vs ${y.type}`;
    if ((x.content ?? '') !== (y.content ?? '')) {
      return `${p}: content "${x.content ?? ''}" vs "${y.content ?? ''}"`;
    }
    const ac = x.children ?? [];
    const bc = y.children ?? [];
    const d = firstTypeDivergence(ac, bc, `${p}.children`);
    if (d) return d;
  }
  return null;
}

function findRefInTree(nodes: BlockIdentityNode[], ref: string): boolean {
  for (const n of nodes) {
    if (n.objectRef === ref) return true;
    if (n.children && findRefInTree(n.children, ref)) return true;
  }
  return false;
}

let activeTrace: PastePipelineTrace | null = null;
let lastTrace: PastePipelineTrace | null = null;

export function isPasteTraceActive(): boolean {
  return activeTrace !== null;
}

export function getLastPastePipelineTrace(): PastePipelineTrace | null {
  return lastTrace;
}

export function beginPastePipelineTrace(label: string): void {
  refCounter = 0;
  activeTrace = {
    label,
    timestamp: Date.now(),
    A_clipboardToBlocks: null,
    B_applyPasteBlocksAtInput: null,
    C_applyPasteBlocksAtOutput: null,
    D_stateUpdate: null,
    E_render: [],
  };
}

export function traceClipboardToBlocks(blocks: Block[] | null): void {
  if (!activeTrace || !blocks) return;
  const identity = identityTree(blocks);
  activeTrace.A_clipboardToBlocks = {
    tree: blockShape(blocks),
    identity,
    firstRootType: blocks[0]?.type ?? null,
    clipboardRootRef: identity[0]?.objectRef ?? null,
  };
}

export function traceApplyPasteBlocksAtInput(
  targetBlockId: string,
  targetBlockType: string,
  caretStart: number,
  caretEnd: number,
  pastedBlocks: Block[],
): void {
  if (!activeTrace) return;
  activeTrace.B_applyPasteBlocksAtInput = {
    targetBlockId,
    targetBlockType,
    caretStart,
    caretEnd,
    pastedBlocksJson: blockShape(pastedBlocks),
    pastedIdentity: identityTree(pastedBlocks),
  };
}

export function traceApplyPasteBlocksAtOutput(resultBlocks: Block[]): void {
  if (!activeTrace || !activeTrace.A_clipboardToBlocks) return;
  const identity = identityTree(resultBlocks);
  const tree = blockShape(resultBlocks);
  const rootRef = activeTrace.A_clipboardToBlocks.clipboardRootRef;
  activeTrace.C_applyPasteBlocksAtOutput = {
    tree,
    identity,
    firstRootType: resultBlocks[0]?.type ?? null,
    firstDivergenceFromA: firstTypeDivergence(
      activeTrace.A_clipboardToBlocks.tree,
      tree.slice(0, 1),
    ),
    clipboardRootRefSurvives: rootRef ? findRefInTree(identity, rootRef) : false,
  };
}

export function traceStateBeforeSetState(blocks: Block[]): void {
  if (!activeTrace) return;
  if (!activeTrace.D_stateUpdate) {
    activeTrace.D_stateUpdate = {
      beforeSetState: blockShape(blocks),
      beforeIdentity: identityTree(blocks),
      afterSetStateCallback: [],
      afterIdentity: [],
      firstDivergenceFromC: null,
    };
  } else {
    activeTrace.D_stateUpdate.beforeSetState = blockShape(blocks);
    activeTrace.D_stateUpdate.beforeIdentity = identityTree(blocks);
  }
}

export function traceStateAfterSetStateCallback(blocks: Block[]): void {
  if (!activeTrace?.D_stateUpdate) return;
  activeTrace.D_stateUpdate.afterSetStateCallback = blockShape(blocks);
  activeTrace.D_stateUpdate.afterIdentity = identityTree(blocks);
  activeTrace.D_stateUpdate.firstDivergenceFromC = activeTrace.C_applyPasteBlocksAtOutput
    ? firstTypeDivergence(activeTrace.C_applyPasteBlocksAtOutput.tree, blockShape(blocks))
    : null;
}

export function traceRenderBlock(
  block: Block,
  renderedComponent: string,
): void {
  if (!activeTrace) return;
  const rootRef = activeTrace.A_clipboardToBlocks?.clipboardRootRef ?? null;
  const objectRef = refTag(block);
  activeTrace.E_render.push({
    blockId: block.id,
    blockType: block.type,
    objectRef,
    renderedComponent,
    clipboardRootRefMatch: rootRef === objectRef,
  });
}

function dumpTrace(t: PastePipelineTrace): void {
  // eslint-disable-next-line no-console
  console.warn('[UX-3A paste:pipeline-trace]', {
    label: t.label,
    A_firstRootType: t.A_clipboardToBlocks?.firstRootType,
    C_firstRootType: t.C_applyPasteBlocksAtOutput?.firstRootType,
    C_firstDivergenceFromA: t.C_applyPasteBlocksAtOutput?.firstDivergenceFromA,
    C_clipboardRootRefSurvives: t.C_applyPasteBlocksAtOutput?.clipboardRootRefSurvives,
    D_firstDivergenceFromC: t.D_stateUpdate?.firstDivergenceFromC,
    renderRoot: t.E_render[0] ?? null,
  });
  // eslint-disable-next-line no-console
  console.warn('[UX-3A paste:A:clipboardToBlocks:FULL]', JSON.stringify(t.A_clipboardToBlocks, null, 2));
  // eslint-disable-next-line no-console
  console.warn('[UX-3A paste:B:applyPasteBlocksAt-input:FULL]', JSON.stringify(t.B_applyPasteBlocksAtInput, null, 2));
  // eslint-disable-next-line no-console
  console.warn('[UX-3A paste:C:applyPasteBlocksAt-output:FULL]', JSON.stringify(t.C_applyPasteBlocksAtOutput, null, 2));
  // eslint-disable-next-line no-console
  console.warn('[UX-3A paste:D:state-update:FULL]', JSON.stringify(t.D_stateUpdate, null, 2));
  // eslint-disable-next-line no-console
  console.warn('[UX-3A paste:E:render:FULL]', JSON.stringify(t.E_render, null, 2));
}

export function finishPastePipelineTrace(): PastePipelineTrace | null {
  if (!activeTrace) return null;
  lastTrace = activeTrace;
  dumpTrace(activeTrace);
  const done = activeTrace;
  activeTrace = null;
  return done;
}
