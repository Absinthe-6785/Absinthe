import { describe, expect, it } from 'vitest';
import { buildSearchProjection } from './buildSearchProjection';

const now = new Date('2026-08-26T12:00:00.000Z');
const schedule = { id: 'schedule-a', text: 'Morning planning', category: 'Work', start_time: '09:00', end_time: '10:00', color: '#fff' } as any;
const workout = { id: 'workout-a', exercise_blocks: { name: 'Morning workout', type: 'strength' } } as any;

function projection(overrides: Record<string, unknown> = {}) {
  return buildSearchProjection({
    query: 'morning',
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

describe('LEAN_04B production Search readiness projection', () => {
  it('keeps pending, ready-empty, and failure states distinct for deferred groups', () => {
    const pending = projection({
      todosState: { status: 'LOADING', validating: true },
      healthBlocksState: { status: 'LOADING', validating: true },
    });
    const readyEmpty = projection({
      todosState: { status: 'READY_EMPTY', validating: false },
      healthBlocksState: { status: 'READY_EMPTY', validating: false },
    });
    const failed = projection({
      todosState: { status: 'ERROR', validating: false, error: new Error('todos offline') },
      healthBlocksState: { status: 'ERROR', validating: false, error: new Error('health offline') },
    });

    expect(pending.groupStates.planner?.status).toBe('LOADING');
    expect(readyEmpty.groupStates.planner?.status).toBe('READY_EMPTY');
    expect(failed.groupStates.planner?.status).toBe('ERROR');
    expect(pending.groupedResults.find(group => group.domain === 'planner')?.state?.status).toBe('LOADING');
    expect(readyEmpty.groupStates.health?.status).toBe('READY_EMPTY');
    expect(readyEmpty.groupedResults.find(group => group.domain === 'health')).toBeUndefined();
  });

  it('keeps available results usable while a deferred group is pending', () => {
    const result = projection({
      schedules: [schedule],
      todosState: { status: 'LOADING', validating: true },
      healthBlocksState: { status: 'READY_EMPTY', validating: false },
    });

    expect(result.results.map(item => item.id)).toContain('schedule-schedule-a');
    expect(result.groupStates.planner?.status).toBe('LOADING');
    expect(result.empty.noResults).toBe(false);
  });

  it('keeps available results usable while the Health group is pending', () => {
    const result = projection({
      schedules: [schedule],
      todosState: { status: 'READY_EMPTY', validating: false },
      healthBlocksState: { status: 'LOADING', validating: true },
    });

    expect(result.results.map(item => item.id)).toContain('schedule-schedule-a');
    expect(result.groupStates.health?.status).toBe('LOADING');
    expect(result.empty.noResults).toBe(false);
  });

  it('does not let Health failure remove non-Health results', () => {
    const result = projection({
      schedules: [schedule],
      workouts: [workout],
      todosState: { status: 'READY_EMPTY', validating: false },
      healthBlocksState: { status: 'ERROR', validating: false, error: new Error('health offline') },
    });

    expect(result.results.map(item => item.domain)).toEqual(expect.arrayContaining(['planner', 'health']));
    expect(result.groupStates.health?.status).toBe('ERROR');
    expect(result.groupStates.planner?.status).toBe('READY_WITH_RESULTS');
  });

  it('keeps a Recipe fetch failure explicit without removing other domain results', () => {
    const error = new Error('recipes offline');
    const result = projection({
      schedules: [schedule],
      recipeState: { status: 'ERROR', validating: false, error },
    });

    expect(result.results.map(item => item.id)).toContain('schedule-schedule-a');
    expect(result.groupStates.recipe).toEqual({ status: 'ERROR', validating: false, error });
    expect(result.groupedResults.find(group => group.domain === 'recipe')?.state?.status).toBe('ERROR');
  });

  it('does not collapse cached-empty plus Recipe error into a confirmed empty group', () => {
    const error = new Error('recipes offline');
    const result = projection({
      recipeState: { status: 'READY_EMPTY', validating: false, error },
    });

    expect(result.groupStates.recipe).toEqual({ status: 'READY_EMPTY', validating: false, error });
    expect(result.groupedResults.find(group => group.domain === 'recipe')?.state?.error).toBe(error);
  });

  it('preserves warm data metadata during background revalidation', () => {
    const result = projection({
      todos: [{ id: 'todo-a', text: 'Morning todo', done: false }],
      todosState: { status: 'READY_WITH_RESULTS', validating: true },
    });

    expect(result.groupStates.planner).toEqual({ status: 'READY_WITH_RESULTS', validating: true });
    expect(result.results.map(item => item.kind)).toContain('todo');
  });

  it('keeps ordinary no-match searches on the existing no-results path', () => {
    const result = projection({
      todos: [{ id: 'todo-a', text: 'Evening todo', done: false }],
      todosState: { status: 'READY_WITH_RESULTS', validating: false },
    });

    expect(result.empty.noResults).toBe(true);
    expect(result.groupedResults.some(group => group.domain === 'planner')).toBe(false);
  });

  it.each(['NOT_READY', 'LOADING', 'ERROR'] as const)(
    'does not project unverified weekly rows or claim no matches when the weekly source is %s', status => {
      const readiness = { status, validating: status === 'LOADING' };
      const weeklySchedules = [{ id: 'old-slot', title: 'Morning old slot', day: 0, start_time: '09:00', end_time: '10:00' }];
      const input = { weeklySchedules, weeklySchedulesState: readiness, todosState: { status: 'READY_EMPTY', validating: false } };
      const noOtherMatches = projection(input);
      expect(noOtherMatches.results).toEqual([]);
      expect(noOtherMatches.empty.noResults).toBe(false);
      expect(noOtherMatches.groupedResults.find(group => group.domain === 'planner')?.state?.status).toBe(status);
      const withDailyMatch = projection({ ...input, schedules: [schedule] });
      expect(withDailyMatch.results.map(item => item.id)).toEqual(['schedule-schedule-a']);
    },
  );

  it('reports no matches after the weekly source is verified empty', () => {
    const result = projection({ weeklySchedulesState: { status: 'READY_EMPTY', validating: false } });
    expect(result.empty.noResults).toBe(true);
    expect(result.groupStates.planner?.status).toBe('READY_EMPTY');
  });

  it.each(['NOT_READY', 'LOADING', 'ERROR'] as const)(
    'does not show stale Routine IDs or claim no matches while Routine is %s', status => {
      const result = projection({
        routines: [{ id: 'old-routine', text: 'Morning old routine', done: false }],
        routinesState: { status, validating: status === 'LOADING' },
        todosState: { status: 'READY_EMPTY', validating: false },
        weeklySchedulesState: { status: 'READY_EMPTY', validating: false },
      });
      expect(result.results).toEqual([]);
      expect(result.empty.noResults).toBe(false);
      expect(result.groupedResults.find(group => group.domain === 'planner')?.state?.status).toBe(status);
    },
  );

  it('keeps the exact Routine navigation result on a warm refresh error and preserves Schedule matches', () => {
    const error = new Error('routine refresh failed');
    const result = projection({
      schedules: [schedule],
      routines: [{ id: 'original-routine-id', text: 'Morning routine', done: false }],
      routinesState: { status: 'READY_WITH_RESULTS', validating: false, error },
    });
    expect(result.results.map(row => [row.kind, row.plannerItemId])).toEqual([
      ['schedule', 'schedule-a'], ['routine', 'original-routine-id'],
    ]);
    expect(result.groupStates.planner?.error).toBe(error);
    expect(projection({ routinesState: { status: 'READY_EMPTY', validating: false } }).empty.noResults).toBe(true);
  });

  it('does not hide an existing Todo error while Routine is still loading', () => {
    const error = new Error('todo read failed');
    const result = projection({
      todosState: { status: 'ERROR', validating: false, error },
      weeklySchedulesState: { status: 'READY_EMPTY', validating: false },
      routinesState: { status: 'LOADING', validating: true },
    });
    expect(result.groupStates.planner).toEqual({ status: 'ERROR', validating: false, error });
    expect(result.empty.noResults).toBe(false);
  });

  it.each(['NOT_READY', 'LOADING', 'ERROR'] as const)(
    'does not show unverified selected-day rows or claim no matches when Schedule is %s', status => {
      const result = projection({
        schedules: [schedule],
        schedulesState: { status, validating: status === 'LOADING' },
        todosState: { status: 'READY_EMPTY', validating: false },
        routinesState: { status: 'READY_EMPTY', validating: false },
        weeklySchedulesState: { status: 'READY_EMPTY', validating: false },
      });
      expect(result.results).toEqual([]);
      expect(result.empty.noResults).toBe(false);
      expect(result.groupedResults.find(group => group.domain === 'planner')?.state?.status).toBe(status);
    },
  );

  it('preserves exact Schedule IDs from verified warm data and reports failed reads separately from no matches', () => {
    const error = new Error('Schedule refresh failed');
    const active = projection({
      schedules: [schedule],
      schedulesState: { status: 'READY_WITH_RESULTS', validating: false, error },
      todosState: { status: 'LOADING', validating: true },
    });
    expect(active.results.map(result => [result.kind, result.plannerItemId])).toEqual([['schedule', 'schedule-a']]);
    expect(active.groupStates.planner?.error).toBe(error);
    expect(projection({ schedulesState: { status: 'READY_EMPTY', validating: true } }).empty.noResults).toBe(false);
    expect(projection({ schedulesState: { status: 'READY_EMPTY', validating: false } }).empty.noResults).toBe(true);
  });
});
