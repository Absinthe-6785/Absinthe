/** K-91F — temporary request fan-out instrumentation (DEV/test only). */

export interface HealthRequestMetric {
  source: string;
  endpoint: string;
  count: number;
  parallelism: number;
  durationMs: number;
  peakParallelism?: number;
  label?: string;
}

export function isHealthRequestInstrumentationEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'test';
}

export function logHealthRequest(metric: HealthRequestMetric): void {
  if (!isHealthRequestInstrumentationEnabled()) return;
  console.info('[K-91F health-request]', metric);
}

export function startHealthRequestBatch(source: string, endpoint: string, count: number): {
  source: string;
  endpoint: string;
  count: number;
  startedAt: number;
  peakParallelism: number;
  trackStart: () => void;
  trackEnd: () => void;
} {
  const batch = {
    source,
    endpoint,
    count,
    startedAt: performance.now(),
    peakParallelism: 0,
    inFlight: 0,
    trackStart() {
      batch.inFlight += 1;
      batch.peakParallelism = Math.max(batch.peakParallelism, batch.inFlight);
    },
    trackEnd() {
      batch.inFlight = Math.max(0, batch.inFlight - 1);
    },
  };
  return batch;
}

export function finishHealthRequestBatch(
  batch: ReturnType<typeof startHealthRequestBatch>,
  parallelism: number,
  label?: string,
): void {
  logHealthRequest({
    source: batch.source,
    endpoint: batch.endpoint,
    count: batch.count,
    parallelism,
    peakParallelism: batch.peakParallelism,
    durationMs: Math.round(performance.now() - batch.startedAt),
    label,
  });
}
