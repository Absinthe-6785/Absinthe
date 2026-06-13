import { makeBlock, type Block, type BlockType } from '../../../blockUtils';
import { renumberNumberedLists } from '../../../listBlocks';
import type { RepairAction } from './repairAnalysis';

export type RepairCode = Extract<
  RepairAction,
  | 'clamp_indent'
  | 'renumber_lists'
  | 'strip_field'
  | 'reset_indent'
  | 'insert_default_block'
>;

export interface RepairResult {
  blocks: Block[];
  repairsApplied: RepairCode[];
}

const REPAIR_ORDER: RepairCode[] = [
  'insert_default_block',
  'clamp_indent',
  'strip_field',
  'reset_indent',
  'renumber_lists',
];

const ZERO_INDENT_TYPES = new Set<BlockType>([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'divider',
  'code',
  'image',
  'table',
  'quote',
  'callout',
  'math',
]);

function orderedRepairs(repairs: Set<RepairCode>): RepairCode[] {
  return REPAIR_ORDER.filter(code => repairs.has(code));
}

function repairBlockNode(block: Block, repairs: Set<RepairCode>): Block {
  let next = block;
  let changed = false;

  if ((next.indent ?? 0) < 0) {
    next = { ...next, indent: 0 };
    repairs.add('clamp_indent');
    changed = true;
  }

  if (next.type !== 'numbered' && next.listIndex !== undefined) {
    const { listIndex: _listIndex, ...rest } = next;
    next = rest as Block;
    repairs.add('strip_field');
    changed = true;
  }

  if (next.type !== 'todo' && next.checked !== undefined) {
    const { checked: _checked, ...rest } = next;
    next = rest as Block;
    repairs.add('strip_field');
    changed = true;
  }

  if (ZERO_INDENT_TYPES.has(next.type) && (next.indent ?? 0) > 0) {
    next = { ...next, indent: 0 };
    repairs.add('reset_indent');
    changed = true;
  }

  if (next.children.length > 0) {
    const repairedChildren: Block[] = [];
    let childrenChanged = false;
    for (const child of next.children) {
      const repairedChild = repairBlockNode(child, repairs);
      repairedChildren.push(repairedChild);
      if (repairedChild !== child) childrenChanged = true;
    }
    if (childrenChanged) {
      next = { ...next, children: repairedChildren };
      changed = true;
    }
  }

  return changed ? next : block;
}

function repairNodeTree(blocks: Block[], repairs: Set<RepairCode>): { blocks: Block[]; changed: boolean } {
  let changed = false;
  const result = blocks.map(block => {
    const repaired = repairBlockNode(block, repairs);
    if (repaired !== block) changed = true;
    return repaired;
  });
  return { blocks: changed ? result : blocks, changed };
}

function repairListContinuityDeep(
  blocks: Block[],
  repairs: Set<RepairCode>,
): { blocks: Block[]; changed: boolean } {
  const renumbered = renumberNumberedLists(blocks);
  const renumberChanged = blocks.some((block, index) => block.listIndex !== renumbered[index].listIndex);

  const source = renumberChanged ? renumbered : blocks;
  let changed = renumberChanged;

  const result = source.map(block => {
    if (block.children.length === 0) return block;
    const childResult = repairListContinuityDeep(block.children, repairs);
    if (!childResult.changed) return block;
    changed = true;
    return { ...block, children: childResult.blocks };
  });

  if (changed) {
    repairs.add('renumber_lists');
    return { blocks: result, changed: true };
  }

  return { blocks, changed: false };
}

export function repairBlockTree(blocks: Block[]): RepairResult {
  if (blocks.length === 0) {
    return {
      blocks: [makeBlock('paragraph', { content: '' })],
      repairsApplied: ['insert_default_block'],
    };
  }

  const repairs = new Set<RepairCode>();
  const nodeResult = repairNodeTree(blocks, repairs);
  const listResult = repairListContinuityDeep(nodeResult.blocks, repairs);

  const finalBlocks = listResult.changed
    ? listResult.blocks
    : nodeResult.changed
      ? nodeResult.blocks
      : blocks;

  return {
    blocks: finalBlocks,
    repairsApplied: orderedRepairs(repairs),
  };
}
