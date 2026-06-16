/** Bounded-concurrency worker pool — K-91F prev-workout mitigation. */

export function createConcurrencyPool(limit: number) {
  const max = Math.max(1, limit);
  let active = 0;
  const queue: Array<() => void> = [];

  const acquire = (): Promise<void> => new Promise(resolve => {
    if (active < max) {
      active += 1;
      resolve();
      return;
    }
    queue.push(() => {
      active += 1;
      resolve();
    });
  });

  const release = (): void => {
    active = Math.max(0, active - 1);
    const next = queue.shift();
    if (next) next();
  };

  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

/** Run async work over items with at most `limit` concurrent executions. */
export async function runWithConcurrencyLimit<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const pool = Math.max(1, limit);
  let nextIndex = 0;

  async function drain(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index]!, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(pool, items.length) }, () => drain()),
  );
}
