// @vitest-environment happy-dom
/**
 * UX-5D — Large document performance audit benchmarks.
 * Run: npm test -- editorPerformanceAudit
 *
 * Tests validate benchmark structure and finite measurements only.
 * Timing values are informational (see console output); no ordering or thresholds.
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
  type DataLayerMetrics,
  type MountMetrics,
  type PerformanceAuditRow,
} from './editorPerformanceAudit';
import { generateBenchmarkBlocks } from './editorBenchmark';

const MOUNT_SIZES = [100, 250, 500, 1000] as const;
const VIRTUAL_MOUNT_SIZES = [100, 500, 1000, 2000] as const;
const PROFILER_SIZES = [100, 500, 1000] as const;

const DATA_LAYER_TIMING_KEYS = [
  'parseMs', 'serializeMs', 'keystrokeMs', 'backspaceMs', 'tableEditMs',
  'searchIndexMs', 'searchNavigateMs', 'copy1Ms', 'copy50Ms', 'copy200Ms',
  'paste1Ms', 'paste50Ms', 'paste200Ms', 'validateTreeMs', 'dragCommitMs',
] as const satisfies readonly (keyof DataLayerMetrics)[];

const MOUNT_TIMING_KEYS = ['mountMs', 'profilerCommitMs'] as const satisfies readonly (keyof MountMetrics)[];

function expectFiniteNonNegative(value: number, label: string): void {
  expect(Number.isFinite(value), `${label} should be finite`).toBe(true);
  expect(value, `${label} should be non-negative`).toBeGreaterThanOrEqual(0);
}

function expectDataLayerRow(row: DataLayerMetrics, size: number): void {
  expect(row.blocks).toBe(size);
  expect(row.totalNodes).toBeGreaterThanOrEqual(size);
  expect(row.markdownBytes).toBeGreaterThan(0);
  for (const key of DATA_LAYER_TIMING_KEYS) {
    expectFiniteNonNegative(row[key], key);
  }
}

function expectLegacyMountRow(row: MountMetrics, size: number): void {
  for (const key of MOUNT_TIMING_KEYS) {
    expectFiniteNonNegative(row[key], key);
  }
  expect(row.domBlockCount).toBeGreaterThanOrEqual(size * 0.9);
  expect(row.domEditableCount).toBeGreaterThan(0);
  expect(Number.isFinite(row.profilerRenderCount)).toBe(true);
  expect(row.profilerRenderCount).toBeGreaterThanOrEqual(0);
}

function expectVirtualMountRow(row: MountMetrics, size: number): void {
  for (const key of MOUNT_TIMING_KEYS) {
    expectFiniteNonNegative(row[key], key);
  }
  expect(row.domBlockCount).toBeGreaterThan(0);
  expect(row.domBlockCount).toBeLessThan(Math.min(size, 150));
  expect(row.domEditableCount).toBeGreaterThan(0);
  expect(Number.isFinite(row.profilerRenderCount)).toBe(true);
  expect(row.profilerRenderCount).toBeGreaterThanOrEqual(0);
}

function expectFullAuditRow(row: PerformanceAuditRow, size: number): void {
  expectDataLayerRow(row, size);
  expect(row.selectionChangeRerenders).toBe(2);
  expect(row.dragStateRerenders).toBe(0);
  expect(row.searchHighlightRerenders).toBeGreaterThan(0);
}

describe('editorPerformanceAudit', () => {
  it('generates benchmark blocks for all audit sizes', () => {
    for (const size of AUDIT_SIZES) {
      const blocks = generateBenchmarkBlocks(size);
      expect(blocks).toHaveLength(size);
    }
  });

  it('data layer audit returns structured metrics', () => {
    const row100 = runDataLayerAudit(100);
    const row250 = runDataLayerAudit(250);
    expectDataLayerRow(row100, 100);
    expectDataLayerRow(row250, 250);
  });

  it.each(AUDIT_SIZES.map(s => [s]))('data layer audit @ %i blocks', (size) => {
    expectDataLayerRow(runDataLayerAudit(size), size);
  });

  it.each(MOUNT_SIZES.map(s => [s]))('default virtual mount audit @ %i blocks', (size) => {
    expectVirtualMountRow(measureMount(generateBenchmarkBlocks(size)), size);
  }, 60_000);

  it.each(MOUNT_SIZES.map(s => [s]))('legacy full mount audit @ %i blocks', (size) => {
    expectLegacyMountRow(measureMount(generateBenchmarkBlocks(size), { virtualBlocksPoc: false }), size);
  }, 60_000);

  it.each(PROFILER_SIZES.map(s => [s]))('profiler mount @ %i blocks', (size) => {
    const row = measureMountWithProfiler(generateBenchmarkBlocks(size));
    expectLegacyMountRow(row, size);
    expect(row.profilerRenderCount).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`[profiler @${size}] commit=${row.profilerCommitMs.toFixed(1)}ms renders=${row.profilerRenderCount}`);
  }, 60_000);

  it('simulateKeystroke returns updated blocks', () => {
    const blocks = generateBenchmarkBlocks(100);
    const id = blocks[50].id;
    const before = blocks[50].content;
    const next = simulateKeystroke(blocks, id);
    expect(next[50].content).toBe(`${before}x`);
  });

  it.each(VIRTUAL_MOUNT_SIZES.map(s => [s]))('virtual mount audit @ %i blocks', (size) => {
    const blocks = generateBenchmarkBlocks(size);
    const virtual = measureMount(blocks);
    expectFiniteNonNegative(virtual.mountMs, 'mountMs');
    expect(virtual.domBlockCount).toBeGreaterThan(0);
    expect(virtual.domBlockCount).toBeLessThan(Math.min(size, 150));
    // eslint-disable-next-line no-console
    console.log(`[virtual mount @${size}] ${virtual.mountMs.toFixed(0)}ms dom=${virtual.domBlockCount}`);
  }, 90_000);

  it('prints benchmark table for UX-5D report', () => {
    const dataRows = AUDIT_SIZES.map(s => runFullAudit(s, false));
    for (let i = 0; i < dataRows.length; i++) {
      expectFullAuditRow(dataRows[i], AUDIT_SIZES[i]);
    }
    const table = formatAuditTable(dataRows);
    // eslint-disable-next-line no-console
    console.log('\n=== UX-5D Performance Audit (data layer) ===\n' + table + '\n');
    expect(table).toContain('Keystroke (ms)');
    expect(table).toContain('| 100 |');
    expect(table).toContain('| 2000 |');
    expect(dataRows).toHaveLength(5);
  }, 180_000);
});
