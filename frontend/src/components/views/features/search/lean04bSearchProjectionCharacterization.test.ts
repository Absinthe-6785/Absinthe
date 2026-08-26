import { describe, expect, it } from 'vitest';

import { buildSearchProjection } from './buildSearchProjection';

const now = new Date('2026-08-26T12:00:00.000Z');

const schedules = [{
  id: 'schedule-a', text: 'Schedule A', category: 'Work', start_time: '09:00', end_time: '10:00', color: '#fff',
}] as any;
const todos = [{ id: 'todo-a', text: 'Todo A', done: false }] as any;
const routines = [{ id: 'routine-a', text: 'Routine A' }] as any;
const workouts = [{ id: 'workout-a', exercise_blocks: { name: 'Workout A', type: 'strength' } }] as any;
const healthBlocks = [{ id: 'block-a', name: 'Block A', type: 'strength', tags: [] }] as any;
const weeklySchedules = [{
  id: 'weekly-a', title: 'Weekly A', day: 1, start_time: '09:00', end_time: '10:00', color: '#fff',
}] as any;
const recipes = [{
  id: 'recipe-a', title: 'Recipe A', category: 'Dinner', ingredients: '', memo: '', created_at: '2026-08-25T12:00:00.000Z',
}] as any;

const FUTURE_SEARCH_CONTRACT = {
  activationModel: 'MODEL_SEARCH_B',
  activationTrigger: 'NONEMPTY_QUERY',
  deferredDatasets: { todos: 'NONEMPTY_QUERY', healthBlocks: 'NONEMPTY_QUERY' },
  readinessModel: 'SEARCH_READINESS_MODEL_C',
  partialResultsAllowed: true,
  globalLoadingRequired: false,
  perGroupLoadingRequired: true,
  trueEmptyDistinct: true,
  datasetErrorDistinct: true,
  accountSafeKeyOrBarrierRequired: true,
  healthGroupIndependentReadiness: true,
  appContentRemainsDataAuthority: true,
  requiredShellSignal: 'searchHasQuery',
  hookOwnershipMovesIntoSearch: false,
} as const;

function projection(overrides: Record<string, unknown> = {}) {
  return buildSearchProjection({
    query: 'a',
    notes: [],
    folders: [],
    schedules: [],
    todos: [],
    routines: [],
    workouts: [],
    healthBlocks: [],
    weeklySchedules: [],
    recipes: [],
    recentSearches: [],
    now,
    ...overrides,
  } as any);
}

describe('LEAN_04B Search projection characterization', () => {
  it('records one evidence-based future contract without wiring deferred activation into production', () => {
    expect(FUTURE_SEARCH_CONTRACT).toEqual({
      activationModel: 'MODEL_SEARCH_B',
      activationTrigger: 'NONEMPTY_QUERY',
      deferredDatasets: { todos: 'NONEMPTY_QUERY', healthBlocks: 'NONEMPTY_QUERY' },
      readinessModel: 'SEARCH_READINESS_MODEL_C',
      partialResultsAllowed: true,
      globalLoadingRequired: false,
      perGroupLoadingRequired: true,
      trueEmptyDistinct: true,
      datasetErrorDistinct: true,
      accountSafeKeyOrBarrierRequired: true,
      healthGroupIndependentReadiness: true,
      appContentRemainsDataAuthority: true,
      requiredShellSignal: 'searchHasQuery',
      hookOwnershipMovesIntoSearch: false,
    });
  });

  it('consumes each current dataset only when a non-empty query is entered', () => {
    const empty = projection({
      query: '   ', schedules, todos, routines, workouts, healthBlocks, weeklySchedules, recipes,
    });
    expect(empty.empty).toMatchObject({ noQuery: true, noResults: false });
    expect(empty.results).toEqual([]);

    const result = projection({
      query: 'a', schedules, todos, routines, workouts, healthBlocks, weeklySchedules, recipes,
    });
    expect(result.groupedResults.map(group => group.domain)).toEqual(expect.arrayContaining(['planner', 'health', 'recipe']));
    expect(result.results.map(item => item.kind)).toEqual(expect.arrayContaining([
      'schedule', 'todo', 'routine', 'weekly-schedule', 'workout', 'exercise-block', 'recipe',
    ]));
    expect(result.counts).toMatchObject({ planner: 4, health: 2, recipe: 1 });
  });

  it('shows that a partial result can coexist with an unobservable missing deferred dataset', () => {
    const scheduleOnly = projection({ query: 'a', schedules });
    expect(scheduleOnly.results.filter(item => item.kind === 'schedule')).toHaveLength(1);

    const todosNotReady = projection({ query: 'todo', todos: [] });
    const todosReadyEmpty = projection({ query: 'todo', todos: [] });
    expect(todosNotReady).toEqual(todosReadyEmpty);
    expect(todosNotReady.empty.noResults).toBe(true);

    const healthBlocksNotReady = projection({ query: 'block', healthBlocks: [] });
    const healthBlocksReadyEmpty = projection({ query: 'block', healthBlocks: [] });
    expect(healthBlocksNotReady).toEqual(healthBlocksReadyEmpty);
    expect(healthBlocksNotReady.empty.noResults).toBe(true);
  });

  it('has no projection-level loading, error, inactive, or account-generation state', () => {
    const result = projection({ query: 'todo' });
    expect(result).not.toHaveProperty('loading');
    expect(result).not.toHaveProperty('error');
    expect(result).not.toHaveProperty('inactive');
    expect(result).not.toHaveProperty('accountId');
    expect(result.empty.noResults).toBe(true);
  });

  it('can combine values from different account generations because the current projection has no barrier', () => {
    const mixed = projection({
      query: 'a',
      schedules: [{ ...schedules[0], id: 'schedule-account-a', text: 'Account A schedule' }],
      todos: [{ ...todos[0], id: 'todo-account-b', text: 'Account B todo' }],
    });
    expect(mixed.results.map(item => item.id)).toEqual(expect.arrayContaining([
      'schedule-schedule-account-a', 'todo-todo-account-b',
    ]));
  });

  it('characterizes local-mode-shaped data without making Search perform local reads', () => {
    const local = projection({
      query: 'a',
      routines,
      workouts,
      healthBlocks,
      todos: [],
      schedules: [],
      weeklySchedules: [],
      recipes: [],
    });
    expect(local.results.map(item => item.kind)).toEqual(expect.arrayContaining(['routine', 'workout', 'exercise-block']));
  });
});
