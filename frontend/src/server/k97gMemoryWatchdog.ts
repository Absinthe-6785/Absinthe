/**
 * K-97G — Server memory watchdog (Node mirror of backend/memory_watchdog.py).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_HEAP_WARN_BYTES = 350 * 1024 * 1024;
export const DEFAULT_RSS_WARN_BYTES = 450 * 1024 * 1024;
export const DEFAULT_SAMPLE_INTERVAL_MS = 1000;

export interface MemorySample {
  rss: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  sampledAt: number;
}

export interface MemoryWatchdogOptions {
  heapThreshold?: number;
  rssThreshold?: number;
  minIntervalMs?: number;
  onWarning?: (message: string) => void;
}

export function sampleProcessMemory(now = Date.now()): MemorySample {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers ?? 0,
    sampledAt: now,
  };
}

export function formatMemoryWarning(
  sample: MemorySample,
  options: {
    heapThreshold?: number;
    rssThreshold?: number;
    context?: string;
  } = {},
): string | null {
  const heapThreshold = options.heapThreshold ?? DEFAULT_HEAP_WARN_BYTES;
  const rssThreshold = options.rssThreshold ?? DEFAULT_RSS_WARN_BYTES;
  const overHeap = sample.heapUsed > heapThreshold;
  const overRss = sample.rss > rssThreshold;
  if (!overHeap && !overRss) return null;
  const ctx = options.context ? ` context=${options.context}` : '';
  return (
    `[memory-watchdog] high memory${ctx} `
    + `rss=${sample.rss} heapUsed=${sample.heapUsed} `
    + `external=${sample.external} arrayBuffers=${sample.arrayBuffers} `
    + `thresholds(rss=${rssThreshold},heap=${heapThreshold})`
  );
}

export class MemoryWatchdog {
  private lastSampleAt = 0;
  private readonly heapThreshold: number;
  private readonly rssThreshold: number;
  private readonly minIntervalMs: number;
  private readonly onWarning: (message: string) => void;
  readonly warnings: string[] = [];

  constructor(options: MemoryWatchdogOptions = {}) {
    this.heapThreshold = options.heapThreshold ?? DEFAULT_HEAP_WARN_BYTES;
    this.rssThreshold = options.rssThreshold ?? DEFAULT_RSS_WARN_BYTES;
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
    this.onWarning = options.onWarning ?? (message => this.warnings.push(message));
  }

  sampleIfDue(context = ''): MemorySample | null {
    const now = Date.now();
    if (now - this.lastSampleAt < this.minIntervalMs) return null;
    this.lastSampleAt = now;
    const sample = sampleProcessMemory(now);
    const warning = formatMemoryWarning(sample, {
      heapThreshold: this.heapThreshold,
      rssThreshold: this.rssThreshold,
      context,
    });
    if (warning) this.onWarning(warning);
    return sample;
  }
}

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function readK97gMemoryWatchdogPolicy(): {
  pythonModulePresent: boolean;
  middlewareRegistered: boolean;
  heapThreshold350Mb: boolean;
  rssThreshold450Mb: boolean;
  doesNotCrashProcess: boolean;
} {
  const pySrc = readFileSync(join(repoRoot(), 'backend', 'memory_watchdog.py'), 'utf8');
  const mainSrc = readFileSync(join(repoRoot(), 'backend', 'main.py'), 'utf8');
  return {
    pythonModulePresent: pySrc.includes('class MemoryWatchdog'),
    middlewareRegistered: mainSrc.includes('memory_watchdog_middleware'),
    heapThreshold350Mb: pySrc.includes('350 * 1024 * 1024'),
    rssThreshold450Mb: pySrc.includes('450 * 1024 * 1024'),
    doesNotCrashProcess: !pySrc.includes('sys.exit') && !pySrc.includes('raise SystemExit'),
  };
}

export function formatK97gWatchdogSampleLog(sample: MemorySample, warning: string | null): string {
  const base = `[memory-watchdog] sample rss=${sample.rss} heapUsed=${sample.heapUsed} at=${sample.sampledAt}`;
  return warning ? `${base}\n${warning}` : base;
}
