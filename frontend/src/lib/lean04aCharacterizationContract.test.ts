import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Activation = 'active' | 'inactive' | 'health-ready' | 'shared-cache' | 'evidence-gated' | 'none';

const FUTURE_ACTIVATION_CONTRACT: Record<string, Record<string, Activation>> = {
  HOME: {
    schedules: 'active',
    routines: 'active',
    workouts: 'active',
    weeklySchedules: 'active',
    todos: 'inactive',
    inbody: 'inactive',
    markedDates: 'inactive',
    healthBlocks: 'inactive',
    healthRoutines: 'inactive',
  },
  PLANNER: {
    schedules: 'active',
    todos: 'active',
    routines: 'active',
    weeklySchedules: 'active',
    workouts: 'inactive',
    inbody: 'inactive',
    markedDates: 'inactive',
    healthBlocks: 'inactive',
    healthRoutines: 'inactive',
  },
  HEALTH: {
    schedules: 'evidence-gated',
    routines: 'shared-cache',
    workouts: 'active',
    inbody: 'health-ready',
    healthBlocks: 'health-ready',
    healthRoutines: 'health-ready',
    weeklySchedules: 'evidence-gated',
    markedDates: 'inactive',
    todos: 'inactive',
  },
  NOTES: {
    schedules: 'none',
    routines: 'none',
    workouts: 'none',
    weeklySchedules: 'none',
    todos: 'none',
    inbody: 'none',
    markedDates: 'none',
    healthBlocks: 'none',
    healthRoutines: 'none',
  },
  SETTINGS: {
    schedules: 'none',
    routines: 'none',
    workouts: 'none',
    weeklySchedules: 'none',
    todos: 'none',
    inbody: 'none',
    markedDates: 'none',
    healthBlocks: 'none',
    healthRoutines: 'none',
  },
  RECIPE: {
    schedules: 'none',
    routines: 'none',
    workouts: 'none',
    weeklySchedules: 'none',
    todos: 'none',
    inbody: 'none',
    markedDates: 'none',
    healthBlocks: 'none',
    healthRoutines: 'none',
  },
};

const CURRENT_KEY_CLASSIFICATION = {
  schedules: 'URL_ONLY',
  todos: 'URL_ONLY',
  routines: 'URL_ONLY',
  workouts: 'URL_ONLY',
  inbody: 'URL_ONLY',
  markedDates: 'ACCOUNT_NAMESPACED',
  healthBlocks: 'ACCOUNT_NAMESPACED',
  healthRoutines: 'ACCOUNT_NAMESPACED',
  weeklySchedules: 'ACCOUNT_NAMESPACED',
} as const;

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), 'src', relativePath), 'utf8');
}

describe('LEAN_04A characterization contract and protected boundaries', () => {
  it('records the bounded MODEL_A future activation contract without wiring it into production', () => {
    expect(FUTURE_ACTIVATION_CONTRACT.HOME).toEqual({
      schedules: 'active', routines: 'active', workouts: 'active', weeklySchedules: 'active',
      todos: 'inactive', inbody: 'inactive', markedDates: 'inactive', healthBlocks: 'inactive', healthRoutines: 'inactive',
    });
    expect(FUTURE_ACTIVATION_CONTRACT.PLANNER).toEqual({
      schedules: 'active', todos: 'active', routines: 'active', weeklySchedules: 'active',
      workouts: 'inactive', inbody: 'inactive', markedDates: 'inactive', healthBlocks: 'inactive', healthRoutines: 'inactive',
    });
    expect(FUTURE_ACTIVATION_CONTRACT.HEALTH).toEqual({
      schedules: 'evidence-gated', routines: 'shared-cache', workouts: 'active',
      inbody: 'health-ready', healthBlocks: 'health-ready', healthRoutines: 'health-ready',
      weeklySchedules: 'evidence-gated', markedDates: 'inactive', todos: 'inactive',
    });
    expect(FUTURE_ACTIVATION_CONTRACT.NOTES).toEqual(expect.objectContaining({ schedules: 'none', healthBlocks: 'none' }));
    expect(FUTURE_ACTIVATION_CONTRACT.SETTINGS).toEqual(expect.objectContaining({ schedules: 'none', healthBlocks: 'none' }));
    expect(FUTURE_ACTIVATION_CONTRACT.RECIPE).toEqual(expect.objectContaining({ schedules: 'none', healthBlocks: 'none' }));
  });

  it('keeps Home/Search-shared data eager and defers Search-dependent conditional data to LEAN_04B', () => {
    const app = source('components/AppContent.tsx');
    const search = source('components/views/features/search/GlobalSearchHost.tsx');
    expect(app).toContain("useState<TabId>('home')");
    expect(app).toContain('useDailyData(dateStr, showToast, authUser.id, healthRuntimeReady)');
    expect(app).toContain('useStaticData(monthStart, monthEnd, showToast, authUser.id, healthRuntimeReady)');
    expect(app).toContain('<GlobalSearchHost');
    expect(app).toContain('schedules={schedules}');
    expect(app).toContain('routines={routines}');
    expect(app).toContain('workouts={workouts}');
    expect(app).toContain('weeklySchedules={weeklySchedules}');
    expect(app).toContain('todos={todos}');
    expect(app).toContain('healthBlocks={healthBlocks}');
    expect(search).toContain('buildDiscoveryFeed(notes, knowledgeIndexService)');
    expect(search).toContain('useSearchProjection({');
    expect(search).toContain('todos,');
    expect(search).toContain('healthBlocks,');
    expect(FUTURE_ACTIVATION_CONTRACT.HOME.schedules).toBe('active');
    expect(FUTURE_ACTIVATION_CONTRACT.HOME.healthBlocks).toBe('inactive');
  });

  it('classifies cache-key identity separately from endpoint URLs', () => {
    expect(CURRENT_KEY_CLASSIFICATION).toEqual({
      schedules: 'URL_ONLY',
      todos: 'URL_ONLY',
      routines: 'URL_ONLY',
      workouts: 'URL_ONLY',
      inbody: 'URL_ONLY',
      markedDates: 'ACCOUNT_NAMESPACED',
      healthBlocks: 'ACCOUNT_NAMESPACED',
      healthRoutines: 'ACCOUNT_NAMESPACED',
      weeklySchedules: 'ACCOUNT_NAMESPACED',
    });
    const daily = source('hooks/useDaily.ts');
    const statics = source('hooks/useStatic.ts');
    expect(daily).toContain('remoteSWRKey(`${base}/schedules?date=${dateStr}`)');
    expect(daily).toContain('remoteSWRKey(`${base}/todos?date=${dateStr}`)');
    expect(daily).toContain('remoteSWRKey(`${base}/routines_with_logs?date=${dateStr}`)');
    expect(daily).toContain('remoteSWRKey(`${base}/workouts?date=${dateStr}`)');
    expect(daily).toContain('remoteSWRKey(`${base}/inbody?date=${dateStr}`)');
    expect(statics).toContain("['health-static', accountId, remoteKey]");
    expect(statics).toContain('accountBoundHealthStaticKey(');
    expect(FUTURE_ACTIVATION_CONTRACT.HOME.todos).toBe('inactive');
    expect(FUTURE_ACTIVATION_CONTRACT.HOME.healthBlocks).toBe('inactive');
  });

  it('pins Health readiness, event invalidation, spinner, and shell mutation ownership', () => {
    const app = source('components/AppContent.tsx');
    const bootstrap = source('lib/healthSupabaseBootstrap.ts');
    expect(app).toContain("const healthRuntimeReady = !healthBootstrapRequired || startupState.health.status === 'ready';");
    expect(app).toContain('HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT');
    expect(app).toContain('window.addEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, refreshLocalHealth)');
    expect(app).toContain('mutateDaily();');
    expect(app).toContain('mutateStatic();');
    expect(app).toContain("isDailyLoading && (activeTab === 'home' || activeTab === 'health')");
    expect(app).toContain('mutateDaily, mutateStatic');
    expect(app).toContain('mutateTodos, mutateRoutines');
    expect(app).toContain('<PlannerView   {...globalProps} />');
    expect(app).toContain('<HealthView {...globalProps} />');
    expect(bootstrap).toContain('window.dispatchEvent(new Event(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT))');
    expect(source('hooks/useDaily.ts')).toContain('revalidateOnFocus: false');
    expect(source('hooks/useStatic.ts')).toContain('revalidateOnFocus: false');
  });

  it('pins local readAll observability and protects the closed Health startup authority', () => {
    const localRuntime = source('lib/healthLocalRuntime.ts');
    expect(localRuntime.match(/\.readAll\(\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(localRuntime).toContain('readLocalHealthDaily');
    expect(localRuntime).toContain('readLocalHealthStatic');
    expect(localRuntime).toContain('readLocalHealthWorkoutRange');
    expect(localRuntime).toContain('readLocalPreviousWorkoutRows');
    expect(localRuntime).toContain('readLocalHealthProtein');
    const startupTests = source('hooks/healthReadiness.integration.test.ts');
    const appTests = source('components/AppContent.startup.integration.test.ts');
    expect(startupTests).toContain('does not read Health before ready');
    expect(appTests).toContain('keeps the unrelated Home surface clear while Health startup is pending');
    expect(appTests).toContain('keeps a fatal Health startup boundary');
    expect(appTests).toContain('local authority is preserved');
    expect(appTests).toContain('does not show daily fetch feedback on the unrelated Notes surface');
  });

  it('defines the one future search boundary and does not alter Search production behavior', () => {
    const doNotActivateForSearch = ['todos', 'healthBlocks'];
    expect(doNotActivateForSearch).toEqual(['todos', 'healthBlocks']);
    expect(source('components/AppContent.tsx')).toContain('<GlobalSearchHost');
    expect(source('components/views/features/search/GlobalSearchHost.tsx')).toContain('open ? remoteSWRKey(`${API_URL}/api/recipes`) : null');
    expect(source('components/views/features/search/hooks/useSearchProjection.ts')).toContain('buildSearchProjection({ ...input, now })');
    expect('LEAN_04B readiness dependency').toContain('LEAN_04B');
  });
});
