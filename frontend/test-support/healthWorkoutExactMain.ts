// Test-only exact-main loader shared by direct, real-parent and gated-parent pairs.
// Frozen reverse hunks work in shallow CI; both Git blob identities are mandatory.
// Only immutable source text is shared. Every call evaluates fresh module exports.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

export const EXACT_MAIN = 'cef60e40ee16e2b4677280c86a9b1ebb2896656b';
export const BASELINE_HEALTH_BLOB = '4e7bdd8b5d0808f02e9f9bc5c3c580ae7f0c8b97';
export const BASELINE_SCOPE_BLOB = 'b8ca520297a6b8ecb6543222969e4da5bf4c2f29';

// Isolated Vitest child: fault exists only in Vite's in-memory candidate module.
// No source/config/baseline blob is changed and no report file is emitted.
const CHILD_RESULT_PREFIX = 'H08_CHILD_RESULT:';

interface FaultChildReport {
  runEndCount: number;
  runReason: string;
  unhandledErrors: string[];
  shutdownErrors: string[];
  modules: Array<{
    relativeModuleId: string;
    errors: string[];
    tests: Array<{ id: string; fullName: string; state: string; errors: string[]; annotations: string[] }>;
  }>;
}

interface FaultChildEnvelope {
  faultConfigured: boolean;
  report: FaultChildReport | null;
  lifecycleError: string | null;
  finalState: {
    collectedAfterShutdown: true;
    unhandledErrors: string[];
    shutdownErrors: string[];
  } | null;
}

interface FaultChildContext {
  version: string;
  close(): Promise<void>;
  state: { getUnhandledErrors(): unknown[] };
}

interface FaultChildModule {
  relativeModuleId: string;
  errors(): Array<{ message?: string }>;
  children: { allTests(): Iterable<{
    id: string;
    fullName: string;
    result(): { state: string; errors?: Array<{ message?: string }> };
    annotations(): Array<{ message: string }>;
  }>; allSuites(): Iterable<{ errors(): Array<{ message?: string }> }> };
}

// Self-contained so the actual child and the execution-level regression use
// the same collector. No Vitest methods are replaced. The State API is
// experimental: fail closed unless the inspected 4.1.8 lifecycle is present.
export function createFaultChildObserver() {
  let context: FaultChildContext | null = null;
  let shutdownSettled = false;
  let report: FaultChildReport | null = null;
  let runEndCount = 0;
  let lifecycleError: string | null = null;
  let diagnosticOutput = '';
  const processErrors: string[] = [];
  const message = (error: unknown) => String((error as { message?: unknown })?.message ?? error);
  return {
    reporter: {
      onInit(vitest: FaultChildContext) { context = vitest; },
      onTestRunEnd(modules: FaultChildModule[], errors: unknown[], reason: string) {
        runEndCount++;
        report = {
          runEndCount, runReason: reason,
          unhandledErrors: errors.map(message), shutdownErrors: [],
          modules: modules.map(module => ({
            relativeModuleId: module.relativeModuleId.replaceAll('\\', '/'),
            errors: [...module.errors(), ...[...module.children.allSuites()]
              .flatMap(suite => suite.errors())].map(message),
            tests: [...module.children.allTests()].map(test => ({
              id: test.id, fullName: test.fullName, state: test.result().state,
              errors: (test.result().errors ?? []).map(message),
              annotations: test.annotations().map(annotation => annotation.message),
            })),
          })),
        };
      },
      onProcessTimeout() { diagnosticOutput += '\nclose timed out after Vitest teardown deadline\n'; },
    },
    observeProcessError(error: unknown) { processErrors.push(message(error)); },
    recordLifecycleError(error: unknown) { lifecycleError = message(error); },
    async afterRun(vitest: FaultChildContext) {
      if (context !== vitest || vitest.version !== '4.1.8' ||
        typeof vitest.state?.getUnhandledErrors !== 'function')
        throw new Error('H08_FINAL_STATE_API_UNAVAILABLE');
      // startVitest already awaits close in non-watch mode. Await its cached
      // close promise explicitly, including pool.cancel's worker exitPromises.
      await vitest.close();
      // This is not final output evidence. The parent must also inspect the
      // complete original process stdio after execFile reports child exit.
      shutdownSettled = true;
    },
    finalize(faultConfigured: boolean): FaultChildEnvelope {
      let finalState: FaultChildEnvelope['finalState'] = null;
      try {
        if (shutdownSettled && context) {
          const errors = context.state.getUnhandledErrors();
          if (!Array.isArray(errors)) throw new Error('H08_FINAL_ERRORS_NOT_AN_ARRAY');
          // Reporter timeout diagnostics supplement State; close errors logged
          // outside State are checked in the parent's completed process output.
          const shutdownErrors = diagnosticOutput.split(/\r?\n/).filter(line =>
            /error during close|\[vitest-pool\]: (?:Timeout terminating|Failed to terminate)|close timed out after/i.test(line));
          finalState = {
            collectedAfterShutdown: true,
            unhandledErrors: [...errors.map(message), ...processErrors],
            shutdownErrors,
          };
        }
      } catch (error) { lifecycleError = message(error); }
      return { faultConfigured, report, lifecycleError, finalState };
    },
  };
}

interface FaultChildStatus {
  code: number | string | null;
  signal: string | null;
  killed: boolean;
}

export function classifyCandidateStateFault(
  envelope: FaultChildEnvelope,
  status: FaultChildStatus,
  expectation: { file: string; pattern: string; fault: string; marker: string; expectedCount: number; markerMode: 'exact' | 'prefix' },
  completedOutput: string,
): string | null {
  if (status.code !== 1 || status.signal !== null || status.killed) return 'unexpected_process_exit';
  if (typeof completedOutput !== 'string') return 'missing_completed_process_output';
  // Only the parent execFile callback has the complete output after child exit.
  // Vitest 4.1.8 can log a close-hook rejection without rejecting close() or
  // adding it to State. Never let a clean reporter snapshot hide that error.
  const diagnostics = completedOutput.replace(/\x1b\[[0-9;]*m/g, '');
  if (/^\s*(?:error during close\b|\[vitest-pool\]:|close timed out after\b)/im.test(diagnostics))
    return 'child_shutdown_error';
  if (!envelope.faultConfigured) return 'fault_not_applied';
  if (envelope.lifecycleError) return 'child_lifecycle_error';
  const report = envelope.report;
  if (!report || report.runEndCount !== 1) return 'missing_or_duplicate_test_report';
  const finalState = envelope.finalState;
  if (finalState?.collectedAfterShutdown !== true || !Array.isArray(finalState.unhandledErrors) ||
    !Array.isArray(finalState.shutdownErrors)) return 'missing_or_incomplete_final_state';
  if (report.runReason !== 'failed') return 'unexpected_test_run_reason';
  if (report.unhandledErrors.length || finalState.unhandledErrors.length) return 'unhandled_child_errors';
  if (report.shutdownErrors.length || finalState.shutdownErrors.length) return 'child_shutdown_error';
  if (report.modules.length !== 1) return 'unexpected_test_module_count';
  const module = report.modules[0];
  const expectedFile = expectation.file.replaceAll('\\', '/').replace(/^\.\//, '');
  if (module.relativeModuleId.replaceAll('\\', '/') !== expectedFile) return 'wrong_test_module';
  if (module.errors.length) return 'test_module_collection_or_teardown_error';
  let selectedPattern: RegExp;
  try { selectedPattern = new RegExp(expectation.pattern); }
  catch { return 'invalid_selected_test_pattern'; }
  const selected = module.tests.filter(test => selectedPattern.test(test.fullName));
  if (selected.length !== expectation.expectedCount) return 'wrong_selected_test_count';
  if (module.tests.some(test => !selectedPattern.test(test.fullName) && test.state !== 'skipped'))
    return 'unexpected_unselected_test_execution';
  if (selected.some(test => test.state !== 'failed')) return 'selected_test_did_not_fail';
  for (const test of selected) {
    if (expectation.markerMode === 'exact' && !test.annotations.includes('H08_FAULT_APPLIED:' + expectation.fault))
      return 'fault_not_applied_for_selected_test';
    if (test.errors.length !== 1) return 'selected_test_has_ambiguous_errors';
    const matches = expectation.markerMode === 'exact'
      ? test.errors[0] === expectation.marker
      : test.errors[0].startsWith(expectation.marker);
    if (!matches) return 'selected_test_failed_for_wrong_reason';
  }
  return null;
}

export async function runCandidateStateFault(
  file: string,
  pattern: string,
  fault: string,
  marker: string,
  expectedCount: number,
  markerMode: 'exact' | 'prefix' = 'exact',
) {
  const { execFile } = await import('node:child_process');
  const expectation = { file, pattern, fault, marker, expectedCount, markerMode };
  const program = `
    import { startVitest } from 'vitest/node'; import react from '@vitejs/plugin-react';
    import { writeSync } from 'node:fs';
    const observer = (${createFaultChildObserver.toString()})();
    const fault = ${JSON.stringify(fault)};
    let faultConfigured = false;
    process.on('uncaughtExceptionMonitor', error => observer.observeProcessError(error));
    // A forced exit before close settles cannot emit complete evidence. Emit
    // synchronously at process exit, not at run-end, so late errors are included.
    process.once('exit', () => writeSync(1, ${JSON.stringify(CHILD_RESULT_PREFIX)} +
      JSON.stringify(observer.finalize(faultConfigured)) + '\\n'));
    const plugin = { name: 'bounded-date-aba-state-fault', enforce: 'pre', transform(source, id) {
      id = id.replaceAll('\\\\', '/');
      if (id.includes('/test-support/healthWorkoutExactMain.ts')) {
        const anchor = /const candidateFault(?:\\s*:\\s*string \\| null)? = null;/;
        if (!anchor.test(source)) throw new Error('CANDIDATE_FAULT_ANCHOR_MISSING');
        faultConfigured = true;
        return source.replace(anchor, 'const candidateFault = ' + JSON.stringify(fault) + ';');
      }
      if (!id.endsWith('/views/HealthView.tsx')) return;
      source = source.replace(/\\r\\n/g, '\\n');
      if (fault === 'reset-saving') {
        const transformed = source.replaceAll('setIsSaving(false);', 'setIsSaving(true);');
        return transformed;
      }
      const setter = fault === 'relock' ? 'setIsWorkoutLocked(true)' :
        fault === 'unlock' ? 'setIsWorkoutLocked(false)' : 'setIsSaving(false)';
      let replacementCount = 0;
      for (const suffix of ['\\n      if (persistence.status', '\\n        if (result.status']) {
        const anchor = 'if (!currentWorkoutOperation(operationScope)) return;' + suffix;
        if (!source.includes(anchor)) throw new Error('FAULT_ANCHOR_MISSING');
        source = source.replace(anchor, 'if (!currentWorkoutOperation(operationScope)) { ' + setter + '; return; }' + suffix);
        replacementCount++;
      }
      if (replacementCount !== 2) throw new Error('FAULT_ANCHOR_COUNT_MISMATCH');
      return source;
    } };
    try {
      const vitest = await startVitest('test', [${JSON.stringify(file)}],
        { config: false, watch: false, maxWorkers: 1, testNamePattern: ${JSON.stringify(pattern)}, reporters: ['default', observer.reporter] },
        { plugins: [plugin, react()], resolve: { alias: { '@': process.cwd() + '/src' } },
          test: { environment: 'node', setupFiles: ['./src/test/setup.ts'] } },
        // Custom Writable destinations can be ended by 4.1.8's worker pipes,
        // hiding later close errors. Node's original stdio is not ended by pipe.
        { stdout: process.stdout, stderr: process.stderr });
      await observer.afterRun(vitest);
    } catch (error) { observer.recordLifecycleError(error); process.exitCode = 2; }
  `;
  return new Promise<string>((resolve, reject) => {
    execFile(process.execPath, ['--input-type=module', '-e', program],
      { cwd: process.cwd(), timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = stdout + stderr;
        const context = `fault=${fault}, pattern=${pattern}`;
        const records = output.split(/\r?\n/).filter(line => line.startsWith(CHILD_RESULT_PREFIX));
        if (records.length !== 1) { reject(new Error('H08_CHILD_RESULT_MISSING_OR_AMBIGUOUS (' + context + '): ' + output)); return; }
        let envelope: FaultChildEnvelope;
        try { envelope = JSON.parse(records[0].slice(CHILD_RESULT_PREFIX.length)) as FaultChildEnvelope; }
        catch { reject(new Error('H08_CHILD_RESULT_INVALID (' + context + '): ' + output)); return; }
        let disposition: string | null;
        try {
          disposition = classifyCandidateStateFault(envelope, {
            code: error?.code ?? (error ? null : 0),
            signal: error?.signal ?? null,
            killed: error?.killed ?? false,
          }, expectation, output);
        } catch {
          reject(new Error('H08_CHILD_RESULT_INVALID (' + context + '): ' + output)); return;
        }
        if (disposition) {
          reject(new Error('H08_CHILD_REJECTED (' + disposition + '; ' + context + '): ' + output)); return;
        }
        resolve(output);
      });
  });
}
const BASELINE_REVERSE_HUNKS = [
  {
    candidate: "                  <WorkoutPrBadge\n                    badge={prBadgeMap[w.block_id] ?? null}\n                    darkMode={appSettings.darkMode}\n                    legacyScopeLabel={t('healthWorkoutBadgeLegacyScope')}\n                    prDescription={t('healthWorkoutBadgePrDescription')}\n                    diffDescription={t('healthWorkoutBadgeDiffDescription')}\n                  />",
    baseline: "                  <WorkoutPrBadge badge={prBadgeMap[w.block_id] ?? null} darkMode={appSettings.darkMode} />",
  },
  {
    "candidate": "import { buildPreviousWorkoutHistoryProjection } from './features/health/previousWorkoutProjection';\nimport { useHealthWorkoutDraft } from './features/health/useHealthWorkoutDraft';\nimport {\n  captureHealthWorkoutOperationScope,\n  isCurrentHealthWorkoutOperationScope,\n  type HealthWorkoutOperationScope,\n} from './features/health/healthWorkoutOperationScope';\nimport { useHealthWorkoutOperationLifetime } from './features/health/useHealthWorkoutOperationLifetime';\nimport { readHealthSectionPrefs } from './features/health/healthSectionPrefs';\nimport { buildSetsFromPlannedCount, buildSetsFromPrevCount } from './features/health/workoutSetCount';\nimport { fetchPrevWorkoutForBlocks } from './features/health/prevWorkoutFetch';",
    "baseline": "import { buildPreviousWorkoutHistoryProjection } from './features/health/previousWorkoutProjection';\nimport { useHealthWorkoutDraft } from './features/health/useHealthWorkoutDraft';\nimport {\n  isCurrentHealthWorkoutOperationScope,\n  type HealthWorkoutOperationScope,\n} from './features/health/healthWorkoutOperationScope';\nimport { readHealthSectionPrefs } from './features/health/healthSectionPrefs';\nimport { buildSetsFromPlannedCount, buildSetsFromPrevCount } from './features/health/workoutSetCount';\nimport { fetchPrevWorkoutForBlocks } from './features/health/prevWorkoutFetch';"
  },
  {
    "candidate": "    : legacyPrevData;\n  const previousState = (id: string) => previousCurrentness.current\n    ? previousOwner.evidence(id).state : 'STALE_OR_SUPPRESSED' as const;\n  const workoutAccountOperation = Object.freeze({ accountId: user.id, generation: accountGenerationRef.current });\n  const workoutLifetime = useHealthWorkoutOperationLifetime(\n    workoutAccountOperation.accountId, workoutAccountOperation.generation, selectedDateDraftKey,\n  );\n  const captureWorkoutOperation = () => captureHealthWorkoutOperationScope(\n    workoutLifetime.publication, workoutAccountOperation, selectedDateDraftKey,\n    workoutLifetime.getCurrent(), currentAccountOperation,\n  );\n  const currentWorkoutOperation = (scope: HealthWorkoutOperationScope): boolean =>\n    isCurrentHealthWorkoutOperationScope(\n      scope,\n      workoutLifetime.getCurrent(),\n      currentAccountOperation,\n    );\n  const memoKey = localHealthMemoKey(user.id, selectedDateDraftKey);",
    "baseline": "    : legacyPrevData;\n  const previousState = (id: string) => previousCurrentness.current\n    ? previousOwner.evidence(id).state : 'STALE_OR_SUPPRESSED' as const;\n  const activeWorkoutDateKeyRef = useRef(selectedDateDraftKey);\n  activeWorkoutDateKeyRef.current = selectedDateDraftKey;\n  const currentWorkoutOperation = (scope: HealthWorkoutOperationScope): boolean =>\n    isCurrentHealthWorkoutOperationScope(\n      scope,\n      activeWorkoutDateKeyRef.current,\n      currentAccountOperation,\n    );\n  const memoKey = localHealthMemoKey(user.id, selectedDateDraftKey);"
  },
  {
    "candidate": "  };\n\n  const handleRemoveWorkout = async (index: number, dbId: string) => {\n    const operationScope = captureWorkoutOperation();\n    if (!operationScope) return;\n    if (previousEnabled) {\n      const blockId = localWorkouts[index]?.block_id;\n      if (blockId) routineLoadIntentRef.current?.removed.add(blockId);\n    }\n    try {\n      // 세션 구분선은 DB에 없으므로 API 호출 없이 바로 제거\n      if (dbId !== 'session' && !dbId.startsWith('session-') && !dbId.startsWith('temp')) {\n        const expectedVersion = localWorkouts[index]?.local_version;\n        if (localMode && !expectedVersion) throw new Error('health_local_workout_expected_version_missing');\n        if (!currentWorkoutOperation(operationScope)) return;\n        const result = await deleteHealthWorkout({\n          mode: localMode ? 'local' : 'remote',\n          accountId: operationScope.accountOperation.accountId,",
    "baseline": "  };\n\n  const handleRemoveWorkout = async (index: number, dbId: string) => {\n    if (previousEnabled) {\n      const blockId = localWorkouts[index]?.block_id;\n      if (blockId) routineLoadIntentRef.current?.removed.add(blockId);\n    }\n    const operationScope: HealthWorkoutOperationScope = {\n      accountOperation: {\n        accountId: user.id,\n        generation: accountGenerationRef.current,\n      },\n      dateKey: selectedDateDraftKey,\n    };\n    try {\n      // 세션 구분선은 DB에 없으므로 API 호출 없이 바로 제거\n      if (dbId !== 'session' && !dbId.startsWith('session-') && !dbId.startsWith('temp')) {\n        const expectedVersion = localWorkouts[index]?.local_version;\n        if (localMode && !expectedVersion) throw new Error('health_local_workout_expected_version_missing');\n        const result = await deleteHealthWorkout({\n          mode: localMode ? 'local' : 'remote',\n          accountId: operationScope.accountOperation.accountId,"
  },
  {
    "candidate": "    toggleWeightUnit(blockId);\n  };\n  const handleSaveWorkouts = async () => {\n    const operationScope = captureWorkoutOperation();\n    if (!operationScope) return;\n    if (localWorkouts.filter(w => w.block_id !== '__session__').length === 0)\n      return showToast(t('noWorkouts'), 'error');\n    setIsSaving(true);\n\n    try {",
    "baseline": "    toggleWeightUnit(blockId);\n  };\n  const handleSaveWorkouts = async () => {\n    if (localWorkouts.filter(w => w.block_id !== '__session__').length === 0)\n      return showToast(t('noWorkouts'), 'error');\n    const operationScope: HealthWorkoutOperationScope = {\n      accountOperation: {\n        accountId: user.id,\n        generation: accountGenerationRef.current,\n      },\n      dateKey: selectedDateDraftKey,\n    };\n    setIsSaving(true);\n\n    try {"
  },
  {
    "candidate": "          return normalizeStrengthSetForSave(set, getUnit(workout.block_id));\n        }),\n      }));\n      if (!currentWorkoutOperation(operationScope)) return;\n      const persistence = await saveHealthWorkouts({\n        mode: localMode ? 'local' : 'remote',\n        accountId: operationScope.accountOperation.accountId,",
    "baseline": "          return normalizeStrengthSetForSave(set, getUnit(workout.block_id));\n        }),\n      }));\n      const persistence = await saveHealthWorkouts({\n        mode: localMode ? 'local' : 'remote',\n        accountId: operationScope.accountOperation.accountId,"
  },
  {
    "candidate": "        if (localMode) mutateStatic();\n        if (isMobile) {\n          requestAnimationFrame(() => {\n            if (!currentWorkoutOperation(operationScope)) return;\n            inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n          });\n        }",
    "baseline": "        if (localMode) mutateStatic();\n        if (isMobile) {\n          requestAnimationFrame(() => {\n            inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n          });\n        }"
  },
  {
    "candidate": "        if (localMode) mutateStatic();\n        if (isMobile) {\n          requestAnimationFrame(() => {\n            if (!currentWorkoutOperation(operationScope)) return;\n            inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n          });\n        }",
    "baseline": "        if (localMode) mutateStatic();\n        if (isMobile) {\n          requestAnimationFrame(() => {\n            inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n          });\n        }"
  }
];
const BASELINE_SCOPE_SOURCE = "import type { HealthAccountGenerationToken } from '../../../../lib/healthBackfillUiSafety';\n\nexport interface HealthWorkoutOperationScope {\n  accountOperation: HealthAccountGenerationToken;\n  dateKey: string;\n}\n\nexport function isCurrentHealthWorkoutOperationScope(\n  scope: HealthWorkoutOperationScope,\n  currentDateKey: string,\n  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean,\n): boolean {\n  return scope.dateKey === currentDateKey && isCurrentAccountOperation(scope.accountOperation);\n}\n";

export async function loadExactMainHealthView(importer: (specifier: string) => Promise<unknown>) {
  const blob = (text: string) => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
  let source = readFileSync('src/components/views/HealthView.tsx', 'utf8').replace(/\r\n/g, '\n');
  for (const hunk of BASELINE_REVERSE_HUNKS) {
    if (!source.includes(hunk.candidate)) throw new Error('Exact-main reconstruction hunk missing');
    source = source.replace(hunk.candidate, hunk.baseline);
  }
  if (blob(source) !== BASELINE_HEALTH_BLOB || blob(BASELINE_SCOPE_SOURCE) !== BASELINE_SCOPE_BLOB)
    throw new Error('EXACT_MAIN_BASELINE_IDENTITY');
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const code = compile(source), baselineScope: any = {};
  new Function('exports', compile(BASELINE_SCOPE_SOURCE))(baselineScope);
  const modules = new Map<string, unknown>();
  for (const match of code.matchAll(/require\("([^"]+)"\)/g)) {
    const specifier = match[1];
    modules.set(specifier, specifier === './features/health/healthWorkoutOperationScope'
      ? baselineScope : await importer(specifier));
  }
  const lines = code.split('\n'), exports: any = {};
  new Function('require', 'exports', code + '\n//# sourceURL=HealthViewBaseline.js')(
    (specifier: string) => modules.get(specifier), exports);
  return { HealthView: exports.HealthView,
    savingLine: lines.findIndex(line => line.includes('const [isSaving, setIsSaving]')) + 3,
    lockedLine: lines.findIndex(line => line.includes('const [isWorkoutLocked, setIsWorkoutLocked]')) + 3,
    identity: { main: EXACT_MAIN, healthBlob: blob(source), scopeBlob: blob(BASELINE_SCOPE_SOURCE) } };
}

// Same compiler/dependency resolution as exact main, but the unmodified
// candidate bytes. A named sourceURL permits reliable read-only state
// observation even when Vitest's resetModules retires Vite source maps.
export async function loadCandidateHealthView(importer: (specifier: string) => Promise<unknown>) {
  const source = readFileSync('src/components/views/HealthView.tsx', 'utf8').replace(/\r\n/g, '\n');
  const healthBlob = createHash('sha1').update('blob ' + Buffer.byteLength(source) + '\0').update(source).digest('hex');
  if (healthBlob !== '6f957f441779656317253d3d47773d73a6c92bc7') throw new Error('CANDIDATE_PRODUCTION_BLOB_CHANGED');
  const candidateFault: string | null = null; // bounded in-memory child transform only
  let observedSource = source;
  if (candidateFault === 'reset-saving') observedSource = source.replaceAll('setIsSaving(false);', 'setIsSaving(true);');
  else if (candidateFault) {
    const setter = candidateFault === 'relock' ? 'setIsWorkoutLocked(true)' :
      candidateFault === 'unlock' ? 'setIsWorkoutLocked(false)' : 'setIsSaving(false)';
    for (const suffix of ['\n      if (persistence.status', '\n        if (result.status']) {
      const anchor = 'if (!currentWorkoutOperation(operationScope)) return;' + suffix;
      if (!observedSource.includes(anchor)) throw new Error('CANDIDATE_FAULT_ANCHOR_MISSING');
      observedSource = observedSource.replace(anchor,
        'if (!currentWorkoutOperation(operationScope)) { ' + setter + '; return; }' + suffix);
    }
  }
  const code = ts.transpileModule(observedSource, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modules = new Map<string, unknown>();
  for (const match of code.matchAll(/require\("([^"]+)"\)/g)) modules.set(match[1], await importer(match[1]));
  const exports: any = {}, lines = code.split('\n');
  new Function('require', 'exports', code + '\n//# sourceURL=HealthViewCandidate.js')(
    (specifier: string) => modules.get(specifier), exports);
  return { HealthView: exports.HealthView, healthBlob, fault: candidateFault,
    faultApplied: candidateFault !== null && observedSource !== source,
    savingLine: lines.findIndex(line => line.includes('const [isSaving, setIsSaving]')) + 3,
    lockedLine: lines.findIndex(line => line.includes('const [isWorkoutLocked, setIsWorkoutLocked]')) + 3 };
}
