import { describe, expect, it } from 'vitest';
import {
  startIndependentStartup,
  type StartupDomain,
  type StartupDomainState,
} from './startupBootstrapCoordinator';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function stateLog() {
  const log: Array<{ domain: StartupDomain; state: StartupDomainState }> = [];
  return { log, onStateChange: (domain: StartupDomain, state: StartupDomainState) => log.push({ domain, state }) };
}

describe('independent authenticated startup orchestration', () => {
  it('starts Health before a pending Notes bootstrap completes', async () => {
    const notes = deferred();
    const events: string[] = [];
    const states = stateLog();

    startIndependentStartup({
      startNotes: () => { events.push('notes-start'); return notes.promise; },
      startHealth: async () => { events.push('health-start'); },
      onStateChange: states.onStateChange,
    });

    expect(events).toEqual(['notes-start', 'health-start']);
    await Promise.resolve();
    expect(states.log.find(entry => entry.domain === 'health' && entry.state.status === 'ready')).toBeDefined();
    expect(states.log.some(entry => entry.domain === 'notes' && entry.state.status === 'ready')).toBe(false);

    notes.resolve();
    await notes.promise;
    await Promise.resolve();
    expect(states.log.at(-1)).toEqual({ domain: 'notes', state: { status: 'ready', error: null } });
  });

  it('keeps Notes usable while Health remains pending', async () => {
    const health = deferred();
    const states = stateLog();

    startIndependentStartup({
      startNotes: async () => undefined,
      startHealth: () => health.promise,
      onStateChange: states.onStateChange,
    });
    await Promise.resolve();

    expect(states.log).toContainEqual({ domain: 'notes', state: { status: 'ready', error: null } });
    expect(states.log).toContainEqual({ domain: 'health', state: { status: 'pending', error: null } });
    expect(states.log.some(entry => entry.domain === 'health' && entry.state.status === 'ready')).toBe(false);

    health.resolve();
    await health.promise;
    await Promise.resolve();
    expect(states.log.at(-1)).toEqual({ domain: 'health', state: { status: 'ready', error: null } });
  });

  it('publishes a bounded Health failure without changing Notes readiness', async () => {
    const states = stateLog();
    const healthError = new Error('health_bootstrap_unavailable');

    startIndependentStartup({
      startNotes: async () => undefined,
      startHealth: async () => { throw healthError; },
      onStateChange: states.onStateChange,
    });
    await Promise.resolve();

    expect(states.log).toContainEqual({ domain: 'notes', state: { status: 'ready', error: null } });
    expect(states.log).toContainEqual({
      domain: 'health',
      state: { status: 'failed', error: 'health_bootstrap_unavailable' },
    });
  });

  it('does not publish stale Account A completion after cancellation', async () => {
    const notes = deferred();
    const health = deferred();
    const states = stateLog();
    const run = startIndependentStartup({
      startNotes: () => notes.promise,
      startHealth: () => health.promise,
      onStateChange: states.onStateChange,
    });

    run.cancel();
    notes.resolve();
    health.resolve();
    await Promise.all([notes.promise, health.promise]);
    await Promise.resolve();

    expect(states.log).toEqual([
      { domain: 'notes', state: { status: 'pending', error: null } },
      { domain: 'health', state: { status: 'pending', error: null } },
    ]);
  });

  it('retries only the failed domain', async () => {
    const states = stateLog();
    let healthAttempts = 0;
    const run = startIndependentStartup({
      startNotes: async () => undefined,
      startHealth: async () => {
        healthAttempts += 1;
        if (healthAttempts === 1) throw new Error('temporary_health_failure');
      },
      onStateChange: states.onStateChange,
    });
    await Promise.resolve();
    expect(healthAttempts).toBe(1);
    const notesReadyCount = states.log.filter(entry => entry.domain === 'notes' && entry.state.status === 'ready').length;

    run.retry('health');
    await Promise.resolve();
    expect(healthAttempts).toBe(2);
    expect(states.log.filter(entry => entry.domain === 'notes' && entry.state.status === 'ready')).toHaveLength(notesReadyCount);
    expect(states.log.at(-1)).toEqual({ domain: 'health', state: { status: 'ready', error: null } });
  });
});
