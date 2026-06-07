/**
 * blockTypeGuards.ts — Runtime block type validation (F-5B)
 */
import type { BlockType } from './blockUtils';

export const KNOWN_BLOCK_TYPES = new Set<BlockType>([
  'paragraph', 'heading1', 'heading2', 'heading3',
  'bullet', 'numbered', 'todo', 'toggle',
  'code', 'image', 'divider', 'table', 'quote', 'callout', 'math',
]);

export function isKnownBlockType(raw: unknown): raw is BlockType {
  return typeof raw === 'string' && KNOWN_BLOCK_TYPES.has(raw as BlockType);
}

/** Coerce unknown/corrupt types to paragraph — never throw */
export function sanitizeBlockType(raw: unknown): BlockType {
  return isKnownBlockType(raw) ? raw : 'paragraph';
}
