import { describe, expect, it } from 'vitest';
import { runHealthBootstrapSingleFlight } from './healthBootstrapSingleFlight';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('account-scoped Health bootstrap single-flight', () => {
  it('shares one durable execution for repeated same-account callers', async () => {
    const gate = deferred<string>();
    let starts = 0;
    const start = () => { starts += 1; return gate.promise; };

    const first = runHealthBootstrapSingleFlight('account-a', start);
    const second = runHealthBootstrapSingleFlight('account-a', start);

    expect(second).toBe(first);
    await Promise.resolve();
    expect(starts).toBe(1);
    gate.resolve('ready');
    await expect(first).resolves.toBe('ready');
    await expect(second).resolves.toBe('ready');
  });

  it('keeps different accounts independent', async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    const starts: string[] = [];
    const first = runHealthBootstrapSingleFlight('account-a', () => { starts.push('a'); return a.promise; });
    const second = runHealthBootstrapSingleFlight('account-b', () => { starts.push('b'); return b.promise; });

    await Promise.resolve();
    expect(starts).toEqual(['a', 'b']);
    a.resolve('a-ready');
    b.resolve('b-ready');
    await expect(first).resolves.toBe('a-ready');
    await expect(second).resolves.toBe('b-ready');
  });

  it('releases after failure so a later retry starts fresh', async () => {
    let starts = 0;
    const first = runHealthBootstrapSingleFlight('account-a', async () => {
      starts += 1;
      throw new Error('temporary_failure');
    });

    await expect(first).rejects.toThrow('temporary_failure');
    await expect(runHealthBootstrapSingleFlight('account-a', async () => {
      starts += 1;
      return 'retry-ready';
    })).resolves.toBe('retry-ready');
    expect(starts).toBe(2);
  });

  it('does not let an older settlement remove a newer account flight', async () => {
    const firstGate = deferred<string>();
    const secondGate = deferred<string>();
    let starts = 0;
    const first = runHealthBootstrapSingleFlight('account-a', () => {
      starts += 1;
      return firstGate.promise;
    });
    expect(runHealthBootstrapSingleFlight('account-a', () => {
      starts += 1;
      return secondGate.promise;
    })).toBe(first);
    firstGate.resolve('first-ready');
    await expect(first).resolves.toBe('first-ready');
    await expect(runHealthBootstrapSingleFlight('account-a', async () => {
      starts += 1;
      return 'second-ready';
    })).resolves.toBe('second-ready');
    expect(starts).toBe(2);
  });
});
