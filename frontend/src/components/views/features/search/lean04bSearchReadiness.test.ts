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
});
