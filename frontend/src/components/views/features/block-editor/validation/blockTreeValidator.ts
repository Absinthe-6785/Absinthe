import type { Block, BlockType } from '../../../blockUtils';
import { isKnownBlockType } from '../../../blockTypeGuards';

export type ViolationSeverity = 'error' | 'warning';

export type ViolationCode =
  | 'MISSING_ID'
  | 'DUPLICATE_ID'
  | 'UNKNOWN_TYPE'
  | 'EMPTY_DOCUMENT'
  | 'NEGATIVE_INDENT'
  | 'INVALID_TABLE_SHAPE'
  | 'NON_NESTABLE_IN_TOGGLE'
  | 'NON_TOGGLE_HAS_CHILDREN'
  | 'STALE_LIST_FIELDS';

export interface BlockTreeViolation {
  code: ViolationCode;
  severity: ViolationSeverity;
  blockId?: string;
  path: string;
  message: string;
}

export interface BlockTreeValidationResult {
  valid: boolean;
  violations: BlockTreeViolation[];
  stats: {
    blockCount: number;
    maxDepth: number;
    idCount: number;
    uniqueIdCount: number;
  };
}

const NON_NESTABLE_IN_TOGGLE_TYPES = new Set<BlockType>(['image', 'divider', 'table']);

function pushViolation(
  violations: BlockTreeViolation[],
  violation: BlockTreeViolation,
): void {
  violations.push(violation);
}

function validateTableShape(
  block: Block,
  path: string,
  violations: BlockTreeViolation[],
): void {
  const headers = block.tableHeaders;
  if (!headers || headers.length === 0) {
    pushViolation(violations, {
      code: 'INVALID_TABLE_SHAPE',
      severity: 'error',
      blockId: block.id,
      path,
      message: 'Table block must have at least one header column',
    });
    return;
  }

  const colCount = headers.length;
  const rows = block.tableRows ?? [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!Array.isArray(row) || row.length !== colCount) {
      pushViolation(violations, {
        code: 'INVALID_TABLE_SHAPE',
        severity: 'error',
        blockId: block.id,
        path,
        message: `Table row ${rowIndex} must have ${colCount} cell(s)`,
      });
    }
  }
}

function validateStaleListFields(
  block: Block,
  path: string,
  violations: BlockTreeViolation[],
): void {
  if (block.type !== 'numbered' && block.listIndex !== undefined) {
    pushViolation(violations, {
      code: 'STALE_LIST_FIELDS',
      severity: 'warning',
      blockId: block.id,
      path,
      message: `Block type "${block.type}" must not carry listIndex`,
    });
  }

  if (block.type !== 'todo' && block.checked !== undefined) {
    pushViolation(violations, {
      code: 'STALE_LIST_FIELDS',
      severity: 'warning',
      blockId: block.id,
      path,
      message: `Block type "${block.type}" must not carry checked`,
    });
  }
}

function walkBlocks(
  blocks: Block[],
  parentPath: string,
  parentType: BlockType | null,
  depth: number,
  seenIds: Set<string>,
  violations: BlockTreeViolation[],
  stats: BlockTreeValidationResult['stats'],
): void {
  stats.maxDepth = Math.max(stats.maxDepth, depth);

  for (let index = 0; index < blocks.length; index++) {
    const path = `${parentPath}[${index}]`;
    const block = blocks[index] as Block | null | undefined;

    if (!block || typeof block !== 'object') {
      pushViolation(violations, {
        code: 'MISSING_ID',
        severity: 'error',
        path,
        message: 'Block node must be an object with a non-empty id',
      });
      continue;
    }

    stats.blockCount++;
    stats.idCount++;

    const rawId = block.id;
    if (typeof rawId !== 'string' || rawId.trim() === '') {
      pushViolation(violations, {
        code: 'MISSING_ID',
        severity: 'error',
        path,
        message: 'Block id must be a non-empty string',
      });
    } else {
      if (seenIds.has(rawId)) {
        pushViolation(violations, {
          code: 'DUPLICATE_ID',
          severity: 'error',
          blockId: rawId,
          path,
          message: `Duplicate block id "${rawId}"`,
        });
      } else {
        seenIds.add(rawId);
      }
    }

    if (!isKnownBlockType(block.type)) {
      pushViolation(violations, {
        code: 'UNKNOWN_TYPE',
        severity: 'error',
        blockId: typeof rawId === 'string' ? rawId : undefined,
        path,
        message: `Unknown block type "${String(block.type)}"`,
      });
    }

    const indent = block.indent;
    if (typeof indent === 'number' && indent < 0) {
      pushViolation(violations, {
        code: 'NEGATIVE_INDENT',
        severity: 'error',
        blockId: typeof rawId === 'string' ? rawId : undefined,
        path,
        message: `Indent must be >= 0 (got ${indent})`,
      });
    }

    if (block.type === 'table') {
      validateTableShape(block, path, violations);
    }

    if (parentType === 'toggle' && isKnownBlockType(block.type)
      && NON_NESTABLE_IN_TOGGLE_TYPES.has(block.type)) {
      pushViolation(violations, {
        code: 'NON_NESTABLE_IN_TOGGLE',
        severity: 'error',
        blockId: typeof rawId === 'string' ? rawId : undefined,
        path,
        message: `Block type "${block.type}" cannot be nested inside a toggle`,
      });
    }

    const children = block.children;
    if (Array.isArray(children) && children.length > 0) {
      if (block.type !== 'toggle') {
        pushViolation(violations, {
          code: 'NON_TOGGLE_HAS_CHILDREN',
          severity: 'warning',
          blockId: typeof rawId === 'string' ? rawId : undefined,
          path,
          message: `Block type "${block.type}" must not have children`,
        });
      }

      walkBlocks(children, `${path}.children`, block.type, depth + 1, seenIds, violations, stats);
    }

    validateStaleListFields(block, path, violations);
  }
}

export function validateBlockTree(blocks: Block[]): BlockTreeValidationResult {
  const violations: BlockTreeViolation[] = [];
  const seenIds = new Set<string>();
  const stats: BlockTreeValidationResult['stats'] = {
    blockCount: 0,
    maxDepth: 0,
    idCount: 0,
    uniqueIdCount: 0,
  };

  if (blocks.length === 0) {
    pushViolation(violations, {
      code: 'EMPTY_DOCUMENT',
      severity: 'error',
      path: 'root',
      message: 'Document must contain at least one block',
    });
  } else {
    walkBlocks(blocks, 'root', null, 0, seenIds, violations, stats);
  }

  stats.uniqueIdCount = seenIds.size;

  const valid = violations.every(v => v.severity !== 'error');

  return { valid, violations, stats };
}
