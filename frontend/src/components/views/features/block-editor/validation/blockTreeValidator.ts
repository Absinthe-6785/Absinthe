import type { Block, BlockType } from '../../../blockUtils';
import { isKnownBlockType } from '../../../blockTypeGuards';
import { isListType } from '../../../listBlocks';

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
  | 'STALE_LIST_FIELDS'
  | 'LIST_CONTINUITY'
  | 'TYPE_FIELD_MISMATCH'
  | 'INVALID_INDENT_RELATIONSHIP';

export interface BlockTreeViolation {
  code: ViolationCode;
  severity: ViolationSeverity;
  blockId?: string;
  path: string;
  message: string;
  expected?: string;
  actual?: string;
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

const TYPE_SPECIFIC_FIELDS: { field: keyof Block; allowedTypes: Set<BlockType> }[] = [
  { field: 'src', allowedTypes: new Set(['image']) },
  { field: 'alt', allowedTypes: new Set(['image']) },
  { field: 'caption', allowedTypes: new Set(['image']) },
  { field: 'width', allowedTypes: new Set(['image']) },
  { field: 'language', allowedTypes: new Set(['code']) },
  { field: 'code', allowedTypes: new Set(['code']) },
  { field: 'tableHeaders', allowedTypes: new Set(['table']) },
  { field: 'tableRows', allowedTypes: new Set(['table']) },
  { field: 'calloutIcon', allowedTypes: new Set(['callout']) },
  { field: 'math', allowedTypes: new Set(['math']) },
  { field: 'mathBlock', allowedTypes: new Set(['math']) },
  { field: 'collapsed', allowedTypes: new Set(['toggle']) },
];

function fieldIsPresent(block: Block, field: keyof Block): boolean {
  const value = block[field];
  if (value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

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

function validateListContinuity(
  blocks: Block[],
  parentPath: string,
  violations: BlockTreeViolation[],
): void {
  const counters = new Map<number, number>();

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.type === 'numbered') {
      const indent = block.indent ?? 0;
      const expected = (counters.get(indent) ?? 0) + 1;
      counters.set(indent, expected);
      const actual = block.listIndex ?? expected;
      if (actual !== expected) {
        pushViolation(violations, {
          code: 'LIST_CONTINUITY',
          severity: 'warning',
          blockId: block.id,
          path: `${parentPath}[${index}]`,
          message: `Numbered list index ${actual} breaks continuity (expected ${expected})`,
          expected: String(expected),
          actual: String(actual),
        });
      }
    } else if (!isListType(block.type)) {
      counters.clear();
    }
  }
}

function validateTypeFieldMismatch(
  block: Block,
  path: string,
  violations: BlockTreeViolation[],
): void {
  if (block.type === 'image' && !fieldIsPresent(block, 'src')) {
    pushViolation(violations, {
      code: 'TYPE_FIELD_MISMATCH',
      severity: 'warning',
      blockId: block.id,
      path,
      message: 'Image block must have a non-empty src',
      expected: 'src',
      actual: 'missing',
    });
  }

  for (const { field, allowedTypes } of TYPE_SPECIFIC_FIELDS) {
    if (!fieldIsPresent(block, field)) continue;
    if (!isKnownBlockType(block.type) || allowedTypes.has(block.type)) continue;

    pushViolation(violations, {
      code: 'TYPE_FIELD_MISMATCH',
      severity: 'warning',
      blockId: block.id,
      path,
      message: `Block type "${block.type}" must not carry ${field}`,
      expected: `no ${field}`,
      actual: String(field),
    });
  }
}

function validateIndentRelationship(
  block: Block,
  path: string,
  violations: BlockTreeViolation[],
): void {
  if (!isKnownBlockType(block.type) || !ZERO_INDENT_TYPES.has(block.type)) return;

  const indent = block.indent ?? 0;
  if (indent <= 0) return;

  pushViolation(violations, {
    code: 'INVALID_INDENT_RELATIONSHIP',
    severity: 'warning',
    blockId: block.id,
    path,
    message: `Block type "${block.type}" should not use indent > 0 (got ${indent})`,
    expected: '0',
    actual: String(indent),
  });
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
    validateTypeFieldMismatch(block, path, violations);
    validateIndentRelationship(block, path, violations);
  }

  validateListContinuity(blocks, parentPath, violations);
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
