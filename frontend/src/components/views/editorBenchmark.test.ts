import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_SIZES,
  generateBenchmarkBlocks,
  runAllBenchmarks,
  runEditorBenchmark,
} from './editorBenchmark';
import { blocksToMarkdown, markdownToBlocks } from './blockUtils';

describe('editorBenchmark', () => {
  it('generates requested block counts', () => {
    expect(generateBenchmarkBlocks(200)).toHaveLength(200);
    expect(generateBenchmarkBlocks(500)).toHaveLength(500);
  });

  it('round-trip preserves block count', () => {
    const blocks = generateBenchmarkBlocks(100);
    const md = blocksToMarkdown(blocks);
    const parsed = markdownToBlocks(md);
    expect(parsed.length).toBeGreaterThanOrEqual(90);
  });

  it('benchmark sizes are 200, 500, 1000', () => {
    expect([...BENCHMARK_SIZES]).toEqual([200, 500, 1000]);
  });

  it('runEditorBenchmark returns timing rows', () => {
    const row = runEditorBenchmark(200);
    expect(row.blocks).toBe(200);
    expect(row.parseMs).toBeGreaterThanOrEqual(0);
    expect(row.serializeMs).toBeGreaterThanOrEqual(0);
    expect(row.roundTripMs).toBeGreaterThanOrEqual(0);
  });

  it('runAllBenchmarks covers all sizes', () => {
    const rows = runAllBenchmarks();
    expect(rows.map(r => r.blocks)).toEqual([200, 500, 1000]);
    rows.forEach(r => {
      expect(r.roundTripMs).toBeLessThan(5000);
    });
  });
});
