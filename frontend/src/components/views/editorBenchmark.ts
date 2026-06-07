/**
 * editorBenchmark.ts — Editor performance helpers (200 / 500 / 1000 blocks)
 */
import { makeBlock, markdownToBlocks, blocksToMarkdown, type Block } from './blockUtils';

export const BENCHMARK_SIZES = [200, 500, 1000] as const;
export type BenchmarkSize = (typeof BENCHMARK_SIZES)[number];

/** Generate a realistic mixed document for perf measurement. */
export function generateBenchmarkBlocks(count: number): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < count; i++) {
    const mod = i % 7;
    if (mod === 0) blocks.push(makeBlock('heading2', { content: `Section ${i}` }));
    else if (mod === 1) blocks.push(makeBlock('paragraph', { content: `Paragraph ${i} with **bold** and [[Wiki]] links.` }));
    else if (mod === 2) blocks.push(makeBlock('todo', { content: `Task ${i}`, checked: i % 2 === 0 }));
    else if (mod === 3) blocks.push(makeBlock('bullet', { content: `Bullet ${i}` }));
    else if (mod === 4) blocks.push(makeBlock('toggle', { content: `Toggle ${i}`, children: [makeBlock('paragraph', { content: 'Nested content' })] }));
    else if (mod === 5) blocks.push(makeBlock('code', { code: `const x = ${i};\n` }));
    else blocks.push(makeBlock('numbered', { content: `Item ${i}` }));
  }
  return blocks;
}

export function measureMs(fn: () => void, iterations = 3): number {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

export interface BenchmarkRow {
  blocks: number;
  parseMs: number;
  serializeMs: number;
  roundTripMs: number;
}

export function runEditorBenchmark(size: number): BenchmarkRow {
  const blocks = generateBenchmarkBlocks(size);
  const md = blocksToMarkdown(blocks);

  const parseMs = measureMs(() => { markdownToBlocks(md); });
  const serializeMs = measureMs(() => { blocksToMarkdown(blocks); });
  const roundTripMs = measureMs(() => {
    const parsed = markdownToBlocks(md);
    blocksToMarkdown(parsed);
  });

  return { blocks: size, parseMs, serializeMs, roundTripMs };
}

export function runAllBenchmarks(): BenchmarkRow[] {
  return BENCHMARK_SIZES.map(runEditorBenchmark);
}
