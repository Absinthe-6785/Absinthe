// @vitest-environment happy-dom
/**
 * UX-5D — Large document performance audit benchmarks.
 * Run: npm test -- editorPerformanceAudit
 */
import { describe, expect, it } from 'vitest';
import {
  AUDIT_SIZES,
  formatAuditTable,
  measureMount,
  measureMountWithProfiler,
  runDataLayerAudit,
  runFullAudit,
  simulateKeystroke,
} from './editorPerformanceAudit';
import { generateBenchmarkBlocks } from './editorBenchmark';

const MOUNT_SIZES = [100, 250, 500, 1000, 2000] as const;
const PROFILER_SIZES = [100, 500, 1000] as const;

describe('editorPerformanceAudit', () => {
  it('data layer scales linearly at small sizes', () => {
    const row100 = runDataLayerAudit(100);
    const row250 = runDataLayerAudit(250);
    expect(row100.keystrokeMs).toBeGreaterThan(0);
    expect(row250.keystrokeMs).toBeGreaterThan(row100.keystrokeMs * 0.8);
    expect(row250.serializeMs).toBeGreaterThan(row100.serializeMs);
  });

  it.each(AUDIT_SIZES.map(s => [s]))('data layer audit @ %i blocks', (size) => {
    const row = runDataLayerAudit(size);
    expect(row.blocks).toBe(size);
    expect(row.totalNodes).toBeGreaterThanOrEqual(size);
    expect(row.keystrokeMs).toBeLessThan(size * 2);
    expect(row.searchIndexMs).toBeLessThan(size * 3);
    expect(row.copy200Ms).toBeLessThan(size * 20);
    expect(row.paste200Ms).toBeLessThan(size * 30);
  });

  it.each(MOUNT_SIZES.map(s => [s]))('mount audit @ %i blocks', (size) => {
    const row = measureMount(generateBenchmarkBlocks(size));
    expect(row.domBlockCount).toBeGreaterThanOrEqual(size * 0.9);
    expect(row.mountMs).toBeLessThan(size * 50);
  }, 60_000);

  it.each(PROFILER_SIZES.map(s => [s]))('profiler mount @ %i blocks', (size) => {
    const row = measureMountWithProfiler(generateBenchmarkBlocks(size));
    expect(row.profilerRenderCount).toBeGreaterThan(0);
    expect(row.profilerCommitMs).toBeGreaterThan(0);
    expect(row.domBlockCount).toBeGreaterThanOrEqual(size * 0.9);
    // eslint-disable-next-line no-console
    console.log(`[profiler @${size}] commit=${row.profilerCommitMs.toFixed(1)}ms renders=${row.profilerRenderCount}`);
  }, 60_000);

  it('keystroke path is O(n) serialize dominated', () => {
    const b100 = generateBenchmarkBlocks(100);
    const b500 = generateBenchmarkBlocks(500);
    const id100 = b100[50].id;
    const id500 = b500[250].id;
    const row100 = runDataLayerAudit(100);
    const row500 = runDataLayerAudit(500);
    simulateKeystroke(b100, id100);
    simulateKeystroke(b500, id500);
    expect(row500.serializeMs / row100.serializeMs).toBeGreaterThan(3);
  });

  it('prints benchmark table for UX-5D report', () => {
    const dataRows = AUDIT_SIZES.map(s => runFullAudit(s, false));
    const table = formatAuditTable(dataRows);
    // eslint-disable-next-line no-console
    console.log('\n=== UX-5D Performance Audit (data layer) ===\n' + table + '\n');
    expect(table).toContain('Keystroke (ms)');
    expect(dataRows).toHaveLength(5);
  }, 180_000);
});
