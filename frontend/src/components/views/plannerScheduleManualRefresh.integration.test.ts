// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRuntimeAccountSyncAccount } from '../../lib/remoteBoundary';
import { useDailyData } from '../../hooks/useDaily';
import type { PlannerViewProps } from './PlannerView';
import { PlannerView } from './PlannerView';

const harness = vi.hoisted(() => ({
  activeAccount: null as string | null,
  server: {} as Record<string, unknown>,
  requests: [] as Array<{ account: string | null; path: string; method: 'GET' }>,
  failNextPath: null as string | null,
  deferNextPath: null as string | null,
  deferredResponse: null as Promise<unknown> | null,
  apiMutation: vi.fn(),
}));

vi.mock('../../lib/config', () => ({ API_URL: 'https://example.invalid' }));
vi.mock('../../lib/fetcher', () => ({
  fetcher: <T,>(url: string): Promise<T> => {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    const account = harness.activeAccount;
    harness.requests.push({ account, path, method: 'GET' });
    if (harness.deferNextPath === path && harness.deferredResponse) {
      harness.deferNextPath = null;
      return harness.deferredResponse as Promise<T>;
    }
    if (harness.failNextPath === path) {
      harness.failNextPath = null;
      return Promise.reject(new Error('simulated Schedule read failure'));
    }
    const response = harness.server[`${account ?? '<anonymous>'}|${path}`] ?? [];
    return Promise.resolve(structuredClone(response) as T);
  },
  isLocalOnlyRemotePausedError: () => false,
}));
vi.mock('../../hooks/useApiMutation', () => ({
  useApiMutation: () => ({ mutate: harness.apiMutation }),
}));
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: null, showConfirm: vi.fn(), clearConfirm: vi.fn(), handleConfirm: vi.fn() }),
}));
vi.mock('../../hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('../../store/useNotesStore', () => ({ useNotesStore: (selector: (state: { notes: [] }) => unknown) => selector({ notes: [] }) }));
vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({
    lang: 'en',
    t: (key: string) => ({
      planner: 'Planner',
      k125ScheduleSubtitle: 'Schedule',
      refreshSchedules: 'Refresh schedules',
      refreshingSchedules: 'Refreshing schedules…',
      schedulesRefreshed: 'Schedules refreshed.',
      schedulesRefreshIncomplete: 'Some schedule sources could not be refreshed. Their previous data was kept.',
      schedulesRefreshOffline: "You're offline. Existing schedules were kept.",
      schedulesRefreshUnavailable: 'Schedule refresh is unavailable right now.',
    }[key] ?? key),
  }),
}));
vi.mock('./features/planner/hooks/usePlannerScheduleEventActions', () => ({
  usePlannerScheduleEventActions: () => ({
    eventDialog: null,
    setEventDialog: vi.fn(),
    agendaEventActions: {},
    handleEventDialogSave: vi.fn(),
    handleRemoveEventStatus: vi.fn(),
  }),
}));
vi.mock('./features/planner/calendar-ui', () => ({
  CalendarShell: ({
    schedules = [], previousDaySchedules = [], ddaySchedules = [], onAddSchedule,
  }: {
    schedules: Array<{ id: string; text: string }>;
    previousDaySchedules: Array<{ id: string; text: string }>;
    ddaySchedules: Array<{ id: string; text: string }>;
    onAddSchedule: () => void;
  }) => createElement('section', { 'data-testid': 'calendar' },
    createElement('div', { 'data-testid': 'selected-source' }, schedules.map(item => item.text).join('|')),
    createElement('div', { 'data-testid': 'previous-source' }, previousDaySchedules.map(item => item.text).join('|')),
    createElement('div', { 'data-testid': 'dday-source' }, ddaySchedules.map(item => item.text).join('|')),
    createElement('button', { type: 'button', 'data-testid': 'open-create-form', onClick: onAddSchedule }, 'Create'),
  ),
}));
vi.mock('./features/knowledge/trace/EventNoteDialog', () => ({ EventNoteDialog: () => null }));
vi.mock('./features/search/searchDomainNavigation', () => ({ registerSearchDomainHandlers: () => () => undefined }));
vi.mock('../../lib/noteNavigation', () => ({ openNote: vi.fn() }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ScheduleRow = {
  id: string;
  text: string;
  start_time: string;
  end_time: string;
  end_next_day: boolean;
  is_dday: boolean;
  category: string;
  color: string;
  date?: string;
};

const datePath = (date: string) => `/api/schedules?date=${date}`;
const ddayPath = '/api/schedules/ddays';
const serverKey = (account: string, path: string) => `${account}|${path}`;
const schedule = (id: string, text: string, date?: string, isDday = false): ScheduleRow => ({
  id, text, start_time: isDday ? '00:00' : '10:00', end_time: isDday ? '23:59' : '11:00',
  end_next_day: false, is_dday: isDday, category: 'Work', color: 'purple', ...(date ? { date } : {}),
});
const initialServerState = (account: string, date: string) => {
  const previousDate = new Date(`${date}T12:00:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}-${String(previousDate.getDate()).padStart(2, '0')}`;
  harness.server[serverKey(account, datePath(date))] = [schedule(`${account}-selected-old`, `${account} selected old`, date)];
  harness.server[serverKey(account, datePath(previousDateKey))] = [schedule(`${account}-previous-old`, `${account} previous old`, previousDateKey)];
  harness.server[serverKey(account, ddayPath)] = [schedule(`${account}-dday-old`, `${account} dday old`, '2026-09-20', true)];
  return previousDateKey;
};

const localDate = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12);
};
const formatDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function RefreshHarness({ account, date }: { account: string | null; date: string }) {
  const daily = useDailyData(date, undefined, account ?? undefined, false, false, false);
  const selectedDate = localDate(date);
  const props: PlannerViewProps = {
    now: { toFormat: () => date } as never,
    currentDate: selectedDate,
    setCurrentDate: () => undefined,
    selectedDate,
    setSelectedDate: () => undefined,
    formatDate,
    isToday: () => false,
    schedules: daily.schedules,
    todos: daily.todos,
    routines: daily.routines,
    weeklySchedules: [],
    markedDates: [],
    user: account ? { id: account, name: account } : undefined,
    theme: { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' },
    appSettings: { darkMode: false, defaultCategory: 'Personal', defaultColor: 'purple', language: 'en' },
    THEME_COLORS: [],
    showToast: vi.fn(),
    updateSetting: vi.fn(),
    mutateDaily: daily.mutate,
    mutateStatic: vi.fn(),
    mutateTodos: daily.mutateTodos,
    mutateRoutines: daily.mutateRoutines,
    isScheduleLoading: daily.isScheduleLoading,
    revalidateSelectedDaySchedules: daily.revalidateSelectedDaySchedules,
  } as PlannerViewProps;
  return createElement(PlannerView, props);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
}

let root: Root;
let host: HTMLDivElement;
let cache: Map<unknown, unknown>;
let onlineDescriptor: PropertyDescriptor | undefined;
const swrConfig = {
  provider: () => cache,
  dedupingInterval: 0,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

async function render(account: string | null, date = '2026-09-18') {
  harness.activeAccount = account;
  setRuntimeAccountSyncAccount(account);
  await act(async () => root.render(createElement(SWRConfig, { value: swrConfig },
    createElement(RefreshHarness, { key: account ?? 'anonymous', account, date }))));
}

async function flush(): Promise<void> {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

async function click(selector: string): Promise<void> {
  const button = host.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing Schedule refresh test target: ${selector}`);
  await act(async () => button.click());
}

function storageSnapshot(): string {
  return JSON.stringify(Array.from({ length: localStorage.length }, (_, index) => {
    const key = localStorage.key(index)!;
    return [key, localStorage.getItem(key)];
  }));
}

beforeEach(() => {
  onlineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  harness.activeAccount = 'account-a';
  harness.server = {};
  harness.requests = [];
  harness.failNextPath = null;
  harness.deferNextPath = null;
  harness.deferredResponse = null;
  harness.apiMutation.mockReset();
  setRuntimeAccountSyncAccount('account-a');
  cache = new Map();
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setRuntimeAccountSyncAccount(null);
  if (onlineDescriptor) Object.defineProperty(window.navigator, 'onLine', onlineDescriptor);
  else Reflect.deleteProperty(window.navigator, 'onLine');
});

describe('Schedule explicit cross-device refresh', () => {
  it('refreshes only the selected day, previous day, and D-day and shows server changes without writes', async () => {
    const date = '2026-09-18';
    const previousDate = initialServerState('account-a', date);
    await render('account-a', date);
    await flush();
    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('account-a selected old');
    expect(host.querySelector('[data-testid="previous-source"]')?.textContent).toBe('account-a previous old');
    expect(host.querySelector('[data-testid="dday-source"]')?.textContent).toBe('account-a dday old');

    harness.requests = [];
    await act(async () => window.dispatchEvent(new Event('focus')));
    await flush();
    expect(harness.requests).toHaveLength(0);

    // Device A changes the authoritative server snapshot; device B's cache stays old until its explicit action.
    harness.server[serverKey('account-a', datePath(date))] = [schedule('a-selected-new', 'account-a selected new', date)];
    harness.server[serverKey('account-a', datePath(previousDate))] = [schedule('a-previous-new', 'account-a previous new', previousDate)];
    harness.server[serverKey('account-a', ddayPath)] = [schedule('a-dday-new', 'account-a dday new', '2026-09-21', true)];
    harness.requests = [];
    const beforeStorage = storageSnapshot();

    const refresh = host.querySelector<HTMLButtonElement>('[data-schedule-manual-refresh]')!;
    expect(refresh.getAttribute('aria-label')).toBe('Refresh schedules');
    expect(refresh.tabIndex).toBe(0);
    await click('[data-schedule-manual-refresh]');
    await flush();

    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('account-a selected new');
    expect(host.querySelector('[data-testid="previous-source"]')?.textContent).toBe('account-a previous new');
    expect(host.querySelector('[data-testid="dday-source"]')?.textContent).toBe('account-a dday new');
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('success');
    expect(harness.requests).toHaveLength(3);
    expect(harness.requests.map(request => request.path).sort()).toEqual([
      datePath(date), datePath(previousDate), ddayPath,
    ].sort());
    expect(harness.requests.every(request => request.account === 'account-a' && request.method === 'GET')).toBe(true);
    expect(Array.from(cache.keys()).filter(key => typeof key === 'string' && key.includes('/api/schedules'))
      .every(key => key.includes('\u0000absinthe-account=account-a'))).toBe(true);
    expect(harness.apiMutation).not.toHaveBeenCalled();
    expect(storageSnapshot()).toBe(beforeStorage);
  });

  it('coalesces duplicate clicks, preserves an open editor draft, and leaves prior data for a failed source', async () => {
    const date = '2026-09-18';
    const previousDate = initialServerState('account-a', date);
    await render('account-a', date);
    await flush();
    await click('[data-testid="open-create-form"]');
    const titleInput = host.querySelector<HTMLInputElement>('input[type="text"]');
    expect(titleInput).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(titleInput, 'Unsaved editor draft');
      titleInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(titleInput?.value).toBe('Unsaved editor draft');

    const gate = deferred<unknown>();
    harness.deferNextPath = datePath(date);
    harness.deferredResponse = gate.promise;
    harness.failNextPath = ddayPath;
    harness.requests = [];
    await click('[data-schedule-manual-refresh]');
    await flush();
    const refreshButton = host.querySelector<HTMLButtonElement>('[data-schedule-manual-refresh]')!;
    expect(refreshButton.disabled).toBe(true);
    await click('[data-schedule-manual-refresh]');
    expect(harness.requests).toHaveLength(3);
    expect(titleInput?.value).toBe('Unsaved editor draft');

    gate.resolve([schedule('selected-refresh', 'selected refreshed', date)]);
    await flush();
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('incomplete');
    expect(host.querySelector('[data-testid="dday-source"]')?.textContent).toBe('account-a dday old');
    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('selected refreshed');
    expect(host.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe('Unsaved editor draft');
    expect(harness.requests).toHaveLength(3);
    expect(harness.apiMutation).not.toHaveBeenCalled();
    expect(harness.requests.every(request => request.method === 'GET')).toBe(true);
  });

  it('rejects stale A completion through A/B/A and date changes without exposing its data or status', async () => {
    const dateA = '2026-09-18';
    const previousA = initialServerState('account-a', dateA);
    initialServerState('account-b', dateA);
    await render('account-a', dateA);
    await flush();
    harness.requests = [];

    const staleA = deferred<unknown>();
    harness.deferNextPath = datePath(dateA);
    harness.deferredResponse = staleA.promise;
    await click('[data-schedule-manual-refresh]');
    await flush();
    expect(harness.requests.some(request => request.account === 'account-a' && request.path === datePath(dateA))).toBe(true);

    harness.server[serverKey('account-a', datePath(dateA))] = [schedule('a-current', 'account-a current', dateA)];
    setRuntimeAccountSyncAccount('account-b');
    staleA.resolve([schedule('a-stale-before-render', 'STALE BEFORE ACCOUNT RENDER', dateA)]);
    await flush();
    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('account-a selected old');
    expect(host.querySelector('[data-schedule-refresh-status]')).toBeNull();

    await render('account-b', dateA);
    await flush();
    expect(host.textContent).toContain('account-b selected old');
    expect(host.textContent).not.toContain('account-a');
    await render('account-a', dateA);
    await flush();
    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('account-a current');

    expect(host.querySelector('[data-schedule-refresh-status]')).toBeNull();
    expect(Array.from(cache.keys()).filter(key => typeof key === 'string' && key.includes('/api/schedules'))
      .every(key => key.includes('\u0000absinthe-account=account-a') || key.includes('\u0000absinthe-account=account-b'))).toBe(true);

    // A separate pending result becomes stale when the same mounted workspace changes its selected date.
    const staleDate = deferred<unknown>();
    harness.requests = [];
    harness.deferNextPath = datePath(dateA);
    harness.deferredResponse = staleDate.promise;
    await click('[data-schedule-manual-refresh]');
    await flush();
    const dateB = '2026-09-19';
    initialServerState('account-a', dateB);
    harness.server[serverKey('account-a', datePath(dateB))] = [schedule('date-b-current', 'new date current', dateB)];
    await render('account-a', dateB);
    await flush();
    const newDateButton = host.querySelector<HTMLButtonElement>('[data-schedule-manual-refresh]')!;
    expect(newDateButton.disabled).toBe(false);

    harness.requests = [];
    const currentDate = deferred<unknown>();
    harness.deferNextPath = datePath(dateB);
    harness.deferredResponse = currentDate.promise;
    await click('[data-schedule-manual-refresh]');
    await flush();
    expect(host.querySelector<HTMLButtonElement>('[data-schedule-manual-refresh]')?.disabled).toBe(true);
    expect(harness.requests.map(request => request.path).sort()).toEqual([
      datePath(dateB), datePath('2026-09-18'), ddayPath,
    ].sort());

    staleDate.resolve([schedule('date-a-stale', 'STALE OLD DATE RESULT', dateA)]);
    await flush();
    expect(host.querySelector<HTMLButtonElement>('[data-schedule-manual-refresh]')?.disabled).toBe(true);
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('refreshing');
    expect(host.textContent).not.toContain('STALE OLD DATE RESULT');

    currentDate.resolve([schedule('date-b-confirmed', 'new date confirmed', dateB)]);
    await flush();
    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('new date confirmed');
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('success');
    expect(host.textContent).not.toContain('STALE OLD DATE RESULT');
    expect(harness.requests.every(request => request.account === 'account-a' || request.account === 'account-b')).toBe(true);
    expect(previousA).toBe('2026-09-17');
  });

  it('keeps the button accessible and performs no read while offline or unauthenticated', async () => {
    initialServerState('account-a', '2026-09-18');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    await render('account-a');
    await flush();
    const button = host.querySelector<HTMLButtonElement>('[data-schedule-manual-refresh]')!;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Refresh schedules');
    harness.requests = [];
    await click('[data-schedule-manual-refresh]');
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('offline');
    expect(harness.requests).toHaveLength(0);

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    await render(null);
    await flush();
    const unauthenticatedButton = host.querySelector<HTMLButtonElement>('[data-schedule-manual-refresh]')!;
    expect(unauthenticatedButton.disabled).toBe(true);
    harness.requests = [];
    await click('[data-schedule-manual-refresh]');
    expect(harness.requests).toHaveLength(0);
    expect(host.querySelector('[data-schedule-refresh-status]')).toBeNull();
  });
});
