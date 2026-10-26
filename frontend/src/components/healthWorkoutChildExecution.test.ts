import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyCandidateStateFault, createFaultChildObserver, runCandidateStateFault } from '../../test-support/healthWorkoutExactMain';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const child = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: child.execFile }));

const file = 'src/components/healthWorkoutFullMountedRace.integration.test.ts';
const pattern = 'S06/D06/H08 save pending X2:';
const marker = 'H08_STATE_ORACLE:saving';
const selectedTestId = 'case-1';
const expectation = { file, pattern, fault: 'unsaving', marker, expectedCount: 1, markerMode: 'exact' as const };
const expectedName = 'REL-05G5B2B2B fully mounted save/delete ABA races > S06/D06/H08 save pending X2: stale completion cannot clear saving';
const skipped = Array.from({ length: 14 }, (_, index) => ({
  id: 'skipped-' + index, fullName: 'unselected case ' + index, state: 'skipped', errors: [], annotations: [],
}));

function report(overrides: Record<string, unknown> = {}) {
  return {
    runEndCount: 1,
    runReason: 'failed',
    unhandledErrors: [],
    shutdownErrors: [],
    modules: [{
      relativeModuleId: file,
      errors: [],
      tests: [{ id: selectedTestId, fullName: expectedName, state: 'failed', errors: [marker],
        annotations: ['H08_FAULT_APPLIED:unsaving'] }, ...skipped],
    }],
    ...overrides,
  };
}

function envelope(overrides: Record<string, unknown> = {}) {
  return { faultConfigured: true, report: report(), lifecycleError: null,
    finalState: { collectedAfterShutdown: true as const, unhandledErrors: [], shutdownErrors: [] }, ...overrides };
}

const failedExit = { code: 1, signal: null, killed: false };

function completeChild(error: Error | null, output: string) {
  child.execFile.mockImplementation((_file: string, _args: string[], _options: unknown,
    callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    callback(error, output, '');
  });
}

beforeEach(() => { child.execFile.mockReset(); });

describe('H08 child execution result classification', () => {
  it('accepts one selected test failing only with its exact state-oracle error', () => {
    expect(classifyCandidateStateFault(envelope(), failedExit, expectation, '')).toBeNull();
  });

  it('rejects zero exit even when the selected test report contains the marker', () => {
    expect(classifyCandidateStateFault(envelope(), { ...failedExit, code: 0 }, expectation, ''))
      .toBe('unexpected_process_exit');
  });

  it('rejects signal termination after the marker was reported', () => {
    expect(classifyCandidateStateFault(envelope(), { ...failedExit, signal: 'SIGTERM' }, expectation, ''))
      .toBe('unexpected_process_exit');
  });

  it('rejects a timed-out child after the marker was reported', () => {
    expect(classifyCandidateStateFault(envelope(), { code: null, signal: 'SIGTERM', killed: true }, expectation, ''))
      .toBe('unexpected_process_exit');
  });

  it('rejects a shutdown error after the selected oracle failure', () => {
    const childReport = report({ shutdownErrors: ['error during close: worker still active'] });
    expect(classifyCandidateStateFault(envelope({ report: childReport }), failedExit, expectation, ''))
      .toBe('child_shutdown_error');
  });

  it('rejects absent or incomplete final error collection', () => {
    expect(classifyCandidateStateFault(envelope({ finalState: null }), failedExit, expectation, ''))
      .toBe('missing_or_incomplete_final_state');
    expect(classifyCandidateStateFault(envelope({ finalState: { collectedAfterShutdown: true } }), failedExit, expectation, ''))
      .toBe('missing_or_incomplete_final_state');
    const observer = createFaultChildObserver();
    expect(observer.finalize(true).finalState).toBeNull();
  });

  it('rejects an unrelated failure containing the oracle marker elsewhere in output', () => {
    const module = report().modules[0] as { tests: Array<{ id: string; fullName: string; state: string; errors: string[]; annotations: string[] }> };
    module.tests[0].errors = ['selected test failed during mount'];
    module.tests.push({ id: 'other', fullName: 'unrelated test', state: 'failed', errors: [marker], annotations: [] });
    expect(classifyCandidateStateFault(envelope({ report: report({ modules: [module] }) }), failedExit, expectation, ''))
      .toBe('unexpected_unselected_test_execution');
  });

  it('rejects a failure from the wrong selected-test identity', () => {
    const module = report().modules[0] as { tests: Array<{ id: string; fullName: string; state: string; errors: string[]; annotations: string[] }> };
    module.tests[0].fullName = 'another test with a matching marker';
    expect(classifyCandidateStateFault(envelope({ report: report({ modules: [module] }) }), failedExit, expectation, ''))
      .toBe('wrong_selected_test_count');
  });

  it('rejects a selected failure without its expected marker', () => {
    const module = report().modules[0] as { tests: Array<{ id: string; fullName: string; state: string; errors: string[]; annotations: string[] }> };
    module.tests[0].errors = ['mount readiness failed'];
    expect(classifyCandidateStateFault(envelope({ report: report({ modules: [module] }) }), failedExit, expectation, ''))
      .toBe('selected_test_failed_for_wrong_reason');
  });

  it('rejects multiple errors attached to the selected test', () => {
    const module = report().modules[0] as { tests: Array<{ id: string; fullName: string; state: string; errors: string[]; annotations: string[] }> };
    module.tests[0].errors = [marker, 'cleanup failed'];
    expect(classifyCandidateStateFault(envelope({ report: report({ modules: [module] }) }), failedExit, expectation, ''))
      .toBe('selected_test_has_ambiguous_errors');
  });

  it('rejects a selected failure without its task-bound fault-applied annotation', () => {
    const module = report().modules[0] as { tests: Array<{ id: string; fullName: string; state: string; errors: string[]; annotations: string[] }> };
    module.tests[0].annotations = [];
    const childReport = report({ modules: [module] });
    expect(classifyCandidateStateFault(envelope({ report: childReport }), failedExit, expectation, ''))
      .toBe('fault_not_applied_for_selected_test');
  });

  it('accepts the structured child record only with the expected failing process status', async () => {
    const output = 'Tests 1 failed | 14 skipped (15)\n' +
      'H08_STATE_ORACLE:saving\nH08_CHILD_RESULT:' + JSON.stringify(envelope()) + '\n';
    completeChild(Object.assign(new Error('exit'), failedExit), output);
    await expect(runCandidateStateFault(file, pattern, 'unsaving', marker, 1, 'exact')).resolves.toBe(output);
  });

  it('rejects output without exactly one structured child result', async () => {
    completeChild(Object.assign(new Error('exit'), failedExit), 'H08_STATE_ORACLE:saving\n');
    await expect(runCandidateStateFault(file, pattern, 'unsaving', marker, 1, 'exact'))
      .rejects.toThrow('H08_CHILD_RESULT_MISSING_OR_AMBIGUOUS');
  });

  it.each(['error during close Error: unexpected', '\x1b[31merror during close\x1b[39m Error: unexpected',
    '[vitest-pool]: Failed to terminate worker', 'close timed out after 10000ms'])(
    'rejects completed process diagnostics despite an otherwise valid oracle: %s', async diagnostic => {
      const output = marker + '\nH08_CHILD_RESULT:' + JSON.stringify(envelope()) + '\n' + diagnostic;
      completeChild(Object.assign(new Error('exit'), failedExit), output);
      await expect(runCandidateStateFault(file, pattern, 'unsaving', marker, 1, 'exact'))
        .rejects.toThrow('H08_CHILD_REJECTED (child_shutdown_error;');
    });
});

// These are real Vitest worker runs, not prefilled error envelopes. The
// environment cannot finish teardown until onTestRunEnd has taken its snapshot.
// Synthetic oracle fixtures test finalization only; the real six H08 mutations
// remain covered by the unchanged R01 integration sensitivity test.
describe('H08 finalization through the actual Vitest shutdown lifecycle', () => {
  it.each(['clean', 'late-error', 'slow-stop', 'close-error', 'setup-error', 'suite-error'] as const)(
    'collects the final outcome after %s teardown', async mode => {
      const { execFile } = await vi.importActual<typeof import('node:child_process')>('node:child_process');
      const require = createRequire(import.meta.url);
      const fixture = mkdtempSync(join(tmpdir(), 'absinthe-h08-finalization-'));
      const signal = join(fixture, 'run-end');
      const spec = join(fixture, 'oracle.test.ts');
      const environment = join(fixture, 'environment.mjs');
      try {
        writeFileSync(spec, `
          import { afterAll, describe, it } from ${JSON.stringify(new URL('./dist/index.js', pathToFileURL(require.resolve('vitest/package.json'))).href)};
          describe('outer suite', () => {
            describe('nested suite', () => {
              if (${JSON.stringify(mode)} === 'suite-error') afterAll(() => {
                throw new Error('H08_UNRELATED_SUITE_TEARDOWN');
              });
              it('selected oracle fixture', async ({ annotate }) => {
                await annotate('H08_FAULT_APPLIED:unsaving');
                throw new Error(${JSON.stringify(marker)});
              });
            });
          });
        `);
        writeFileSync(environment, `
          import { existsSync, writeSync } from 'node:fs';
          import { builtinEnvironments } from ${JSON.stringify(pathToFileURL(require.resolve('vitest/runtime')).href)};
          export default {
            name: 'h08-finalization-regression', viteEnvironment: 'ssr',
            async setup(global) {
              if (${JSON.stringify(mode)} === 'setup-error') {
                writeSync(2, 'H08_SETUP_FAILURE_INJECTED\\n');
                throw new Error('H08_UNEXPECTED_SETUP_ERROR');
              }
              const normal = await builtinEnvironments.node.setup(global, {});
              return { async teardown() {
                while (!existsSync(${JSON.stringify(signal)}))
                  await new Promise(resolve => setTimeout(resolve, 1));
                await normal.teardown(global);
                if (${JSON.stringify(mode)} === 'late-error') throw new Error('H08_LATE_WORKER_TEARDOWN');
                if (${JSON.stringify(mode)} === 'slow-stop') await new Promise(resolve => setTimeout(resolve, 150));
              } };
            },
          };
        `);
        const program = `
          import { startVitest } from 'vitest/node';
          import { writeFileSync, writeSync } from 'node:fs';
          const observer = (${createFaultChildObserver.toString()})();
          process.on('uncaughtExceptionMonitor', error => observer.observeProcessError(error));
          process.once('exit', () => writeSync(1, 'H08_CHILD_RESULT:' + JSON.stringify(observer.finalize(true)) + '\\n'));
          const reporter = {
            ...observer.reporter,
            onInit(vitest) {
              observer.reporter.onInit(vitest);
              if (${JSON.stringify(mode)} === 'close-error') vitest.onClose(() => {
                writeSync(1, 'H08_CLOSE_CALLBACK_REACHED\\n');
                return Promise.reject(new Error('H08_UNRELATED_CLOSE_ERROR'));
              });
            },
            onTestRunEnd(...args) {
              observer.reporter.onTestRunEnd(...args);
              writeFileSync(${JSON.stringify(signal)}, 'run-end-observed');
            },
          };
          try {
            const vitest = await startVitest('test', ['oracle.test.ts'], {
              root: ${JSON.stringify(fixture)}, config: false, watch: false,
              maxWorkers: 1, include: ['oracle.test.ts'], environment: ${JSON.stringify(environment)},
              // Only the synthetic slow-stop fixture has a shorter deadline.
              // Existing H08/R02 timeout constraints are never changed.
              ...(${JSON.stringify(mode)} === 'slow-stop' ? { teardownTimeout: 50 } : {}),
              reporters: ['default', reporter],
            }, undefined, { stdout: process.stdout, stderr: process.stderr });
            await observer.afterRun(vitest);
          } catch (error) { observer.recordLifecycleError(error); process.exitCode = 2; }
        `;
        const result = await new Promise<{ error: (Error & { code?: number | string; signal?: string; killed?: boolean }) | null; output: string }>(resolve => {
          execFile(process.execPath, ['--input-type=module', '-e', program],
            { cwd: process.cwd(), timeout: 5_000, maxBuffer: 2 * 1024 * 1024 },
            (error, stdout, stderr) => resolve({ error, output: stdout + stderr }));
        });
        const lines = result.output.split(/\r?\n/).filter(line => line.startsWith('H08_CHILD_RESULT:'));
        expect(lines, result.output).toHaveLength(1);
        const collected = JSON.parse(lines[0].slice('H08_CHILD_RESULT:'.length));
        const disposition = classifyCandidateStateFault(collected, {
          code: result.error?.code ?? 0, signal: result.error?.signal ?? null, killed: result.error?.killed ?? false,
        }, { ...expectation, file: 'oracle.test.ts', pattern: 'selected oracle fixture' }, result.output);
        if (mode === 'setup-error') {
          expect(result.output).toContain('H08_SETUP_FAILURE_INJECTED');
          expect(collected.report.unhandledErrors, result.output).toEqual([
            expect.stringContaining('[vitest-pool]: Failed to start forks worker'),
          ]);
          expect(collected.report.modules, result.output).toEqual([]);
          expect(result.error?.code, result.output).toBe(1);
          expect(disposition, result.output).toBe('unhandled_child_errors');
          return;
        }
        expect(collected.lifecycleError, result.output).toBeNull();
        expect(collected.report.unhandledErrors, result.output).toEqual([]);
        expect(collected.report.modules, result.output).toHaveLength(1);
        expect(collected.report.modules[0].errors, result.output).toEqual(
          mode === 'suite-error' ? ['H08_UNRELATED_SUITE_TEARDOWN'] : []);
        expect(collected.report.modules[0].tests, result.output).toHaveLength(1);
        expect(collected.report.modules[0].tests[0].errors, result.output).toEqual([marker]);
        expect(collected.finalState?.collectedAfterShutdown, result.output).toBe(true);
        if (mode === 'clean') {
          expect(disposition, result.output).toBeNull();
        } else if (mode === 'late-error') {
          expect(collected.finalState.unhandledErrors, result.output).toContain('H08_LATE_WORKER_TEARDOWN');
          expect(disposition, result.output).toBe('unhandled_child_errors');
        } else if (mode === 'suite-error') {
          expect(disposition, result.output).toBe('test_module_collection_or_teardown_error');
        } else {
          if (mode === 'close-error') {
            expect(result.output).toContain('H08_CLOSE_CALLBACK_REACHED');
            expect(result.output).toContain('error during close');
            expect(result.output).toContain('H08_UNRELATED_CLOSE_ERROR');
          } else expect(result.output).toContain('[vitest-pool]: Timeout terminating');
          expect(disposition, result.output).toBe('child_shutdown_error');
        }
      } finally {
        // Only this test's generated temporary fixtures, never worktree files.
        rmSync(fixture, { recursive: true, force: true });
      }
    }, 10_000);
});
