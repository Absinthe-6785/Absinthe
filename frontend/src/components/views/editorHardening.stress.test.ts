import { describe, expect, it } from 'vitest';
import { flattenBlockIds, makeBlock } from './blockUtils';
import { generateBenchmarkBlocks } from './editorBenchmark';
import { indentSelectedBlocks, outdentSelectedBlocks, deleteSelectedBlocks } from './multiBlockOps';
import { getDocumentOrderedIds } from './features/block-editor/features/selection';
import { measureMs } from './editorBenchmark';

describe('K-90 editor hardening stress', () => {
  it('shift-range selection over 1000+ blocks completes quickly', () => {
    const blocks = generateBenchmarkBlocks(1200);
    const ordered = getDocumentOrderedIds(blocks);
    expect(ordered.length).toBeGreaterThan(1200);

    const ms = measureMs(() => {
      const anchor = ordered[0]!;
      const target = ordered[ordered.length - 1]!;
      const a = ordered.indexOf(anchor);
      const b = ordered.indexOf(target);
      const slice = ordered.slice(Math.min(a, b), Math.max(a, b) + 1);
      expect(slice.length).toBe(ordered.length);
    }, 5);

    expect(ms).toBeLessThan(50);
  });

  it('multi-block indent on 500 selected paragraphs stays responsive', () => {
    const blocks = Array.from({ length: 500 }, (_, i) =>
      makeBlock('paragraph', { id: `p-${i}`, content: `Line ${i}` }),
    );
    const ids = blocks.slice(100, 300).map(b => b.id);
    const ms = measureMs(() => {
      const next = indentSelectedBlocks(blocks, ids);
      expect(next).not.toBeNull();
      expect(flattenBlockIds(next!).length).toBe(blocks.length);
    }, 3);
    expect(ms).toBeLessThan(500);
  });

  it('multi-block delete on 200 blocks stays responsive', () => {
    const blocks = generateBenchmarkBlocks(200);
    const ordered = getDocumentOrderedIds(blocks);
    const toDelete = ordered.slice(50, 150);
    const ms = measureMs(() => {
      const next = deleteSelectedBlocks(blocks, toDelete);
      expect(flattenBlockIds(next).length).toBeLessThan(ordered.length);
    }, 3);
    expect(ms).toBeLessThan(300);
  });

  it('nested toggle outdent preserves tree integrity', () => {
    const deep = makeBlock('paragraph', { id: 'deep', content: 'deep' });
    const mid = makeBlock('toggle', { id: 'mid', content: 'mid', children: [deep] });
    const outer = makeBlock('toggle', { id: 'outer', content: 'outer', children: [mid] });
    const next = outdentSelectedBlocks([outer], ['deep', 'mid']);
    expect(next).not.toBeNull();
    const flat = flattenBlockIds(next!);
    expect(flat).toEqual(['outer', 'mid', 'deep']);
    expect(flat.length).toBe(new Set(flat).size);
  });
});
