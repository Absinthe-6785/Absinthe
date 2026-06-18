import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HEAP_WARN_BYTES,
  DEFAULT_RSS_WARN_BYTES,
  MemoryWatchdog,
  formatK97gWatchdogSampleLog,
  formatMemoryWarning,
  readK97gMemoryWatchdogPolicy,
  sampleProcessMemory,
} from './k97gMemoryWatchdog';

describe('k97gMemoryWatchdog', () => {
  it('reads Python watchdog policy', () => {
    const policy = readK97gMemoryWatchdogPolicy();
    expect(policy.pythonModulePresent).toBe(true);
    expect(policy.middlewareRegistered).toBe(true);
    expect(policy.heapThreshold350Mb).toBe(true);
    expect(policy.rssThreshold450Mb).toBe(true);
    expect(policy.doesNotCrashProcess).toBe(true);
  });

  it('samples process.memoryUsage fields', () => {
    const sample = sampleProcessMemory();
    expect(sample.rss).toBeGreaterThan(0);
    expect(sample.heapUsed).toBeGreaterThan(0);
    expect(sample.sampledAt).toBeGreaterThan(0);
  });

  it('emits warning above thresholds without throwing', () => {
    const warnings: string[] = [];
    const watchdog = new MemoryWatchdog({
      heapThreshold: 1,
      rssThreshold: 1,
      minIntervalMs: 0,
      onWarning: msg => warnings.push(msg),
    });
    expect(() => watchdog.sampleIfDue('test-op')).not.toThrow();
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('[memory-watchdog]');
  });

  it('documents warning format and thresholds', () => {
    const sample = sampleProcessMemory();
    const warning = formatMemoryWarning(sample, {
      heapThreshold: DEFAULT_HEAP_WARN_BYTES,
      rssThreshold: DEFAULT_RSS_WARN_BYTES,
      context: 'login-hydration',
    });
    const log = formatK97gWatchdogSampleLog(sample, warning);
    expect(log).toContain('rss=');
    expect(DEFAULT_HEAP_WARN_BYTES).toBe(350 * 1024 * 1024);
    expect(DEFAULT_RSS_WARN_BYTES).toBe(450 * 1024 * 1024);
    // eslint-disable-next-line no-console
    console.log(log);
  });
});
