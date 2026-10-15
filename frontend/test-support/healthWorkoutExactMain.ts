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
export async function runCandidateStateFault(file: string, pattern: string, fault: string, marker = 'H08_STATE_ORACLE:') {
  const { execFile } = await import('node:child_process');
  const program = `
    import { startVitest } from 'vitest/node'; import react from '@vitejs/plugin-react';
    const fault = ${JSON.stringify(fault)};
    const plugin = { name: 'bounded-date-aba-state-fault', enforce: 'pre', transform(source, id) {
      id = id.replaceAll('\\\\', '/');
      if (id.includes('/test-support/healthWorkoutExactMain.ts')) {
        const anchor = /const candidateFault(?:\\s*:\\s*string \\| null)? = null;/;
        if (!anchor.test(source)) throw new Error('CANDIDATE_FAULT_ANCHOR_MISSING');
        return source.replace(anchor, 'const candidateFault = ' + JSON.stringify(fault) + ';');
      }
      if (!id.endsWith('/views/HealthView.tsx')) return;
      source = source.replace(/\\r\\n/g, '\\n');
      if (fault === 'reset-saving') return source.replaceAll('setIsSaving(false);', 'setIsSaving(true);');
      const setter = fault === 'relock' ? 'setIsWorkoutLocked(true)' :
        fault === 'unlock' ? 'setIsWorkoutLocked(false)' : 'setIsSaving(false)';
      for (const suffix of ['\\n      if (persistence.status', '\\n        if (result.status']) {
        const anchor = 'if (!currentWorkoutOperation(operationScope)) return;' + suffix;
        if (!source.includes(anchor)) throw new Error('FAULT_ANCHOR_MISSING');
        source = source.replace(anchor, 'if (!currentWorkoutOperation(operationScope)) { ' + setter + '; return; }' + suffix);
      }
      return source;
    } };
    const ctx = await startVitest('test', [${JSON.stringify(file)}],
      { config: false, watch: false, maxWorkers: 1, testNamePattern: ${JSON.stringify(pattern)} },
      { plugins: [plugin, react()], resolve: { alias: { '@': process.cwd() + '/src' } },
        test: { environment: 'node', setupFiles: ['./src/test/setup.ts'] } });
    await ctx.close();
  `;
  return new Promise<string>((resolve, reject) => {
    execFile(process.execPath, ['--input-type=module', '-e', program],
      { cwd: process.cwd(), timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = stdout + stderr;
        if (!error || error.killed || !output.includes(marker)) {
          reject(new Error('Fault did not fail the real H08 state oracle: ' + output)); return;
        }
        resolve(output);
      });
  });
}
const BASELINE_REVERSE_HUNKS = [
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
  if (healthBlob !== '78a39b7e743457085b6cefec5890265a0e72ecfa') throw new Error('CANDIDATE_PRODUCTION_BLOB_CHANGED');
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
  return { HealthView: exports.HealthView, healthBlob,
    savingLine: lines.findIndex(line => line.includes('const [isSaving, setIsSaving]')) + 3,
    lockedLine: lines.findIndex(line => line.includes('const [isWorkoutLocked, setIsWorkoutLocked]')) + 3 };
}
