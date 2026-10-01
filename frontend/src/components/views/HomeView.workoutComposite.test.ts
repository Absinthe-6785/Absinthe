// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectCompositeWorkoutRead, type ActiveCanonicalWorkoutReadInput,
  type LegacyWorkoutReadInput } from './features/health/compositeWorkoutReadProjection';
import type { HealthSelectedDayReadModel } from './features/health/useHealthSelectedDayComposite';
import { validateWorkoutSessionV1 } from '../../lib/workoutSessionV1';

const mocks = vi.hoisted(() => ({ open: vi.fn(), retry: vi.fn(), legacyNavigate: vi.fn() }));
vi.mock('swr', () => ({ default: () => ({ data: [] }) }));
vi.mock('../../lib/accountBoundRemote', () => ({ accountBoundRemoteKey: () => null, accountBoundRemoteFetcher: vi.fn() }));
vi.mock('../../lib/noteNavigation', () => ({ switchToTab: mocks.legacyNavigate, openNote: vi.fn() }));
vi.mock('../../store/useNotesStore', () => {
  const state = { notes: [], vaultStructureVersion: 0, createNote: vi.fn() };
  return { useNotesStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }) };
});
vi.mock('../../lib/i18n', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/i18n')>();
  return { ...actual, useTranslation: () => ({ t: actual.getTranslator('en'), lang: 'en' }) };
});
vi.mock('./features/planner/calendar-ui/usePlannerCalendarProjection', () => ({ usePlannerCalendarProjection: () => ({ projection: {}, presentation: {} }) }));
vi.mock('./features/planner/calendar/buildPlannerProjection', () => ({ buildPlannerProjection: () => ({ todayItems: [], timetableToday: [] }) }));
vi.mock('./features/planner/hooks/useCountdownReviewed', () => ({ useCountdownReviewed: () => ({ isReviewed: () => false }) }));
vi.mock('./features/archive/hooks/useArchiveProjection', () => ({ useArchiveProjection: () => ({ projection: { historyItems: { groups: [] } } }) }));
vi.mock('../common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));

import { HomeView, type HomeViewProps } from './HomeView';

const accountId = 'a', localDate = '2026-10-01';
const context = { accountId, namespaceKey: 'ns-a', generationId: 'g1' };
function canonical(): ActiveCanonicalWorkoutReadInput {
  const session = { version: 1, id: '11111111-1111-4111-8111-111111111111', localDate,
    entries: [{ id: '22222222-2222-4222-8222-222222222222',
      exercise: { id: 'bench', name: 'Frozen', type: 'strength', tags: [], cardioMode: null },
      sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength',
        loadKind: 'external_weight', weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8,
        assistedReps: null, dropset: false, done: false }] }] };
  validateWorkoutSessionV1(session);
  return { ...context, entityId: session.id, localRevision: 1, session };
}
const legacy: LegacyWorkoutReadInput = { accountId, rowId: 'l1', localDate, blockId: 'bench', sortOrder: 0,
  exerciseDisplay: { kind: 'historical_fallback', name: 'Bench' }, sets: [] };
const props = (): HomeViewProps => ({ user: { id: accountId, name: 'A' }, now: DateTime.local(2026, 10, 1, 12),
  selectedDate: new Date(2020, 0, 2), formatDate: (d: Date) => DateTime.fromJSDate(d).toISODate()!,
  schedules: [], routines: [], workouts: [], weeklySchedules: [],
  appSettings: { darkMode: false, language: 'en' }, theme: {}, isDailyLoading: true,
  onOpenTodayWorkout: mocks.open } as HomeViewProps);
function model(l = false, c = false): HealthSelectedDayReadModel {
  return { phase: 'settled', accountId, localDate, cacheKey: null, legacyDaily: null,
    isolationError: false, retry: mocks.retry, result: projectCompositeWorkoutRead({ context,
      legacy: { status: 'success', records: l ? [legacy] : [] }, canonical: { status: 'success', records: c ? [canonical()] : [] } }) };
}
let root: Root, host: HTMLDivElement;
async function render(read?: HealthSelectedDayReadModel, overrides: Partial<HomeViewProps> = {}) {
  await act(async () => root.render(createElement(HomeView, { ...props(), homeWorkoutComposite: read, ...overrides })));
}
function card() { return host.querySelector<HTMLElement>('[data-k132a-home-section="workout"]')!; }
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('real Home current-day Workout card (unmocked foundation and projection)', () => {
  it('renders canonical-only local/read-only evidence with zero completed sets, independent of global daily loading', async () => {
    await render(model(false, true));
    expect(card().textContent).toContain('canonical sessions (read-only): 1');
    expect(card().textContent).toContain('1 exercise entries · 1 sets · 0 completed sets');
    expect(card().querySelector('[data-home-workout-presence="present"]')).not.toBeNull();
    expect(card().querySelector('[data-home-workout-verified-empty]')).toBeNull();
    expect(card().querySelector('input')).toBeNull();
  });
  it.each([[false, false], [true, false], [false, true], [true, true]])
  ('shows draft separately from persisted sources L=%s C=%s without touching bytes', async (l, c) => {
    const raw = '[{"block_id":"bench","sets":[{"done":false}]}]';
    localStorage.setItem(`healthDraft:${accountId}:${localDate}`, raw);
    await render(model(l, c));
    expect(card().textContent).toContain('Unsaved legacy draft');
    expect(Boolean(card().querySelector('[data-home-workout-legacy]'))).toBe(l);
    expect(Boolean(card().querySelector('[data-home-workout-canonical]'))).toBe(c);
    expect(localStorage.getItem(`healthDraft:${accountId}:${localDate}`)).toBe(raw);
    expect(card().querySelector('[data-home-workout-verified-empty]')).toBeNull();
  });
  it('distinguishes complete empty, loading, partial with/without survivors, error and retry accessibly', async () => {
    await render(model()); expect(card().querySelector('[data-home-workout-verified-empty]')).not.toBeNull();
    const partial = { ...model(true), result: { status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error',
      records: model(true).result!.records } } as HealthSelectedDayReadModel;
    for (const read of [{ ...model(), phase: 'loading' as const }, partial,
      { ...partial, result: { ...partial.result!, records: [] } } as HealthSelectedDayReadModel,
      { ...model(), result: null }]) {
      await render(read);
      expect(card().querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
      expect(card().querySelector('[data-home-workout-verified-empty]')).toBeNull();
    }
    await act(async () => card().querySelector<HTMLButtonElement>('[data-home-workout-retry]')!.click());
    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });
  it('preserves malformed draft and cannot claim whole-card empty; refresh rereads the scoped draft', async () => {
    localStorage.setItem(`healthDraft:${accountId}:${localDate}`, '{broken');
    await render(model());
    expect(card().textContent).toContain('Draft unavailable');
    expect(card().querySelector('[data-home-workout-verified-empty]')).toBeNull();
    expect(localStorage.getItem(`healthDraft:${accountId}:${localDate}`)).toBe('{broken');
    localStorage.setItem(`healthDraft:${accountId}:${localDate}`, '[]');
    await render({ ...model(), phase: 'loading' }); await render(model());
    expect(card().querySelector('[data-home-workout-verified-empty]')).not.toBeNull();
  });
  it('routes both gated Workout actions through the supplied today callback', async () => {
    await render(model(false, true));
    await act(async () => {
      card().querySelector<HTMLButtonElement>('[data-k132a-home-open-health]')!.click();
      host.querySelector<HTMLButtonElement>('[data-k132a-home-open-health-action]')!.click();
    });
    expect(mocks.open).toHaveBeenCalledTimes(2); expect(mocks.legacyNavigate).not.toHaveBeenCalled();
  });
  it('preserves the legacy OFF card and original navigation', async () => {
    await render(undefined, { isDailyLoading: false, onOpenTodayWorkout: undefined,
      workouts: [{ id: 'l1', block_id: 'bench', exercise_blocks: { id: 'bench', name: 'Bench', type: 'strength' }, sets: [] }] });
    expect(card().querySelector('[data-home-workout-composite]')).toBeNull();
    await act(async () => card().querySelector<HTMLButtonElement>('[data-k132a-home-open-health]')!.click());
    expect(mocks.legacyNavigate).toHaveBeenCalledWith('health');
  });
});
