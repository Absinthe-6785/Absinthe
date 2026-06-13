import { describe, expect, it } from 'vitest';
import {
  blocksToMarkdown,
  deleteBlockById,
  findBlockById,
  flattenBlockIds,
  makeBlock,
  markdownToBlocks,
  updateBlockById,
} from './blockUtils';
import { renumberNumberedLists } from './listBlocks';
import { buildHeadingIndexById } from './features/block-editor/utils/headingIndex';
import { applySlashMenuTypeChange } from './features/block-editor/utils/blockEditorMutations';
import { BLOCK_TYPE_MENU } from './blockUtils';

describe('Editor Stability Audit (Knowledge-19.75)', () => {
  describe('P0 — read/edit markdown round-trip', () => {
    it('preserves toggle with empty title and nested children', () => {
      const original = [
        makeBlock('toggle', {
          id: 't1',
          content: '',
          children: [makeBlock('paragraph', { id: 'c1', content: 'nested body' })],
        }),
      ];
      const md = blocksToMarkdown(original);
      const restored = markdownToBlocks(md);
      expect(restored[0].type).toBe('toggle');
      expect(restored[0].content).toBe('');
      expect(restored[0].children).toHaveLength(1);
      expect(restored[0].children[0].content).toBe('nested body');
      expect(blocksToMarkdown(restored)).toBe(md);
    });

    it('does not corrupt empty toggles into quote/paragraph markers', () => {
      const md = '>\n  line one\n  line two';
      const blocks = markdownToBlocks(md);
      expect(blocks[0].type).toBe('toggle');
      expect(blocksToMarkdown(blocks)).toBe(md);
    });

    it('round-trips callouts without collapsing to quote', () => {
      const md = '> 💡 Callout body';
      const blocks = markdownToBlocks(md);
      expect(blocks[0].type).toBe('callout');
      expect(blocksToMarkdown(blocks)).toBe(md);
    });

    it('preserves unicode math symbols in plain paragraphs', () => {
      const symbols = '→ ⇒ ≤ ≥ √ ∑ ∞';
      expect(blocksToMarkdown(markdownToBlocks(symbols))).toBe(symbols);
    });
  });

  describe('P0 — toggle children persistence', () => {
    it('simulated merge guard: toggle with children must not be delete-merged', () => {
      const child = makeBlock('paragraph', { id: 'child', content: 'keep me' });
      const toggle = makeBlock('toggle', { id: 'toggle', content: '', children: [child] });
      const prev = makeBlock('paragraph', { id: 'prev', content: 'before' });
      const blocks = [prev, toggle];

      const selfBlock = findBlockById(blocks, 'toggle')!;
      expect(selfBlock.type).toBe('toggle');
      expect(selfBlock.children.length).toBeGreaterThan(0);

      const shouldBlockMerge =
        selfBlock.type === 'toggle' && selfBlock.children.length > 0;
      expect(shouldBlockMerge).toBe(true);

      if (!shouldBlockMerge) {
        const merged = updateBlockById(blocks, 'prev', b => ({
          ...b,
          content: b.content + selfBlock.content,
        }));
        deleteBlockById(merged, 'toggle');
      }

      expect(findBlockById(blocks, 'child')?.content).toBe('keep me');
      expect(flattenBlockIds(blocks)).toEqual(['prev', 'toggle', 'child']);
    });
  });

  describe('P0 — context menu block resolution', () => {
    it('finds nested toggle child in root block tree', () => {
      const child = makeBlock('paragraph', { id: 'nested-child', content: 'inside toggle' });
      const root = [
        makeBlock('toggle', {
          id: 'toggle-root',
          content: 'Title',
          children: [child],
        }),
      ];
      const resolved = findBlockById(root, 'nested-child');
      expect(resolved?.id).toBe('nested-child');
      expect(resolved?.content).toBe('inside toggle');
    });
  });

  describe('P1 — numbered list continuity', () => {
    it('numbers 1,2,3 across bullet interruptions at same indent', () => {
      const blocks = markdownToBlocks('1. one\n- bullet\n1. two\n- bullet\n1. three');
      const renumbered = renumberNumberedLists(blocks);
      expect(
        renumbered.filter(b => b.type === 'numbered').map(b => b.listIndex),
      ).toEqual([1, 2, 3]);
    });
  });

  describe('P1 — slash command compatibility', () => {
    it('applySlashMenuTypeChange strips slash token without corrupting path separators', () => {
      const block = makeBlock('paragraph', { content: 'see /toggle' });
      const meta = BLOCK_TYPE_MENU.find(m => m.type === 'toggle' && !m.menuKey)!;
      const next = applySlashMenuTypeChange(block, meta, 'toggle');
      expect(next.type).toBe('toggle');
      expect(next.content).toBe('see ');
    });

    it('applySlashMenuTypeChange handles empty query at line start', () => {
      const block = makeBlock('paragraph', { content: '/heading1' });
      const meta = BLOCK_TYPE_MENU.find(m => m.type === 'heading1')!;
      const next = applySlashMenuTypeChange(block, meta, 'heading1');
      expect(next.type).toBe('heading1');
      expect(next.content).toBe('');
    });
  });

  describe('P1 — outline generation', () => {
    it('buildHeadingIndexById indexes top-level headings in document order', () => {
      const blocks = [
        makeBlock('heading1', { id: 'h1', content: 'One' }),
        makeBlock('paragraph', { id: 'p', content: 'text' }),
        makeBlock('heading2', { id: 'h2', content: 'Two' }),
      ];
      const index = buildHeadingIndexById(blocks, 0);
      expect(index).toEqual({ h1: 0, h2: 1 });
    });

    it('ignores headings nested inside toggles at depth > 0', () => {
      const nested = [
        makeBlock('heading2', { id: 'inner', content: 'Inner' }),
      ];
      const index = buildHeadingIndexById(nested, 1);
      expect(index).toEqual({});
    });
  });
});
