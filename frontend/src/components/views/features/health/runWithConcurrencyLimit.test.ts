import { describe, expect, it } from 'vitest';
import { createConcurrencyPool, runWithConcurrencyLimit } from './runWithConcurrencyLimit';

describe('runWithConcurrencyLimit', () => {
  it('createConcurrencyPool caps in-flight work at the limit', async () => {
    const pool = createConcurrencyPool(4);
    let inFlight = 0;
    let peak = 0;
    const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

    await Promise.all(
      Array.from({ length: 12 }, () =>
        pool(async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await delay(15);
          inFlight -= 1;
        }),
      ),
    );

    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBe(4);
  });

  it('runWithConcurrencyLimit processes every item', async () => {
    const seen: number[] = [];
    let peak = 0;
    let inFlight = 0;

    await runWithConcurrencyLimit([0, 1, 2, 3, 4, 5], 2, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise<void>(resolve => setTimeout(resolve, 5));
      seen.push(item);
      inFlight -= 1;
    });

    expect(seen.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
