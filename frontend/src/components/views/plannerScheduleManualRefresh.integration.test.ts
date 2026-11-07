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
  confirmAction: null as (() => unknown) | null,
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
  useConfirm: () => ({
    confirm: null,
    showConfirm: (_message: string, action: () => unknown) => { harness.confirmAction = action; },
    clearConfirm: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));
vi.mock('../../hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('../../store/useNotesStore', () => ({ useNotesStore: (selector: (state: { notes: [] }) => unknown) => selector({ notes: [] }) }));
vi.mock('../../lib/i18n', () => ({
  resolveIntlLocale: () => 'en',
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
      scheduleMonthMutationRefreshing: "Refreshing this month's schedules after the change…",
      scheduleMonthMutationRefreshed: "This month's Schedule view was refreshed.",
      scheduleMonthMutationRefreshIncomplete: "The Schedule change succeeded, but this month's list could not be verified. Previous complete data is still shown.",
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
    schedules = [], monthSchedules = [], previousDaySchedules = [], ddaySchedules = [], onAddSchedule, dayScheduleActions,
  }: {
    schedules: Array<{ id: string; text: string }>;
    monthSchedules: Array<{ id: string; text: string; date: string }>;
    previousDaySchedules: Array<{ id: string; text: string }>;
    ddaySchedules: Array<{ id: string; text: string }>;
    onAddSchedule: () => void;
    dayScheduleActions?: { onView?: (id: string) => void };
  }) => createElement('section', { 'data-testid': 'calendar' },
    createElement('div', { 'data-testid': 'selected-source' }, schedules.map(item => item.text).join('|')),
    createElement('div', { 'data-testid': 'month-source' }, monthSchedules.map(item => item.text).join('|')),
    ...monthSchedules.map(item => createElement('button', {
      key: item.id,
      type: 'button',
      'data-month-schedule-id': item.id,
      onClick: () => dayScheduleActions?.onView?.(item.id),
    }, item.text)),
    createElement('div', { 'data-testid': 'previous-source' }, previousDaySchedules.map(item => item.text).join('|')),
    createElement('div', { 'data-testid': 'dday-source' }, ddaySchedules.map(item => item.text).join('|')),
    createElement('button', { type: 'button', 'data-testid': 'open-create-form', onClick: onAddSchedule }, 'Create'),
  ),
}));
vi.mock('./features/planner/calendar-ui/day/ScheduleEventDetailPanel', () => ({
  ScheduleEventDetailPanel: ({
    block,
    onEdit,
    onDelete,
    onClose,
  }: {
    block: { title: string };
    onEdit: (titleDraft?: string) => void;
    onDelete: () => void;
    onClose: () => void;
  }) => createElement('section', { 'data-testid': 'schedule-detail' },
    createElement('span', null, block.title),
    createElement('button', { type: 'button', 'data-testid': 'edit-month-schedule', onClick: () => onEdit() }, 'Edit'),
    createElement('button', { type: 'button', 'data-testid': 'delete-month-schedule', onClick: onDelete }, 'Delete'),
    createElement('button', { type: 'button', onClick: onClose }, 'Close'),
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
const monthRange = (date: string) => ({
  start_date: `${date.slice(0, 7)}-01`,
  end_date: `${date.slice(0, 7)}-${String(new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate()).padStart(2, '0')}`,
});
const monthRangePath = (date: string, cursor?: string) => {
  const range = monthRange(date);
  return `/api/schedules/range?start_date=${range.start_date}&end_date=${range.end_date}&page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
};
const serverKey = (account: string, path: string) => `${account}|${path}`;
const schedule = (id: string, text: string, date?: string, isDday = false): ScheduleRow => ({
  id, text, start_time: isDday ? '00:00' : '10:00', end_time: isDday ? '23:59' : '11:00',
  end_next_day: false, is_dday: isDday, category: 'Work', color: 'purple', ...(date ? { date } : {}),
});
const monthPage = (items: ScheduleRow[], date = '2026-09-18', cursor: string | null = null, remainingCount = items.length) => ({
  protocol_version: 1,
  ...monthRange(date),
  page_size: 100,
  order_by: 'id_ascending',
  items,
  remaining_count: remainingCount,
  complete: remainingCount === items.length,
  next_cursor: cursor,
  completion_evidence: remainingCount === items.length
    ? 'exact_count_equals_returned_items'
    : 'exact_count_exceeds_returned_items',
  snapshot_consistency: 'per_request_not_cross_page_snapshot',
});
const initialServerState = (account: string, date: string) => {
  const previousDate = new Date(`${date}T12:00:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}-${String(previousDate.getDate()).padStart(2, '0')}`;
  harness.server[serverKey(account, datePath(date))] = [schedule(`${account}-selected-old`, `${account} selected old`, date)];
  harness.server[serverKey(account, datePath(previousDateKey))] = [schedule(`${account}-previous-old`, `${account} previous old`, previousDateKey)];
  harness.server[serverKey(account, ddayPath)] = [schedule(`${account}-dday-old`, `${account} dday old`, '2026-09-20', true)];
  harness.server[serverKey(account, monthRangePath(date))] = monthPage([
    schedule(`${account}-month-old`, `${account} month old`, `${date.slice(0, 7)}-23`),
  ], date);
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

async function setInputValue(selector: string, value: string): Promise<void> {
  const input = host.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Missing Schedule input: ${selector}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function clickSaveSchedule(): Promise<void> {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .find(candidate => candidate.textContent?.trim() === 'saveSchedule');
  if (!button) throw new Error('Missing Schedule save button.');
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
  harness.confirmAction = null;
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
  it('opens and edits a non-selected month Schedule by its exact ID and date', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('month-event-id', 'Month event', '2026-09-21'),
    ], date);
    await render('account-a', date);
    await flush();

    await click('[data-month-schedule-id="month-event-id"]');
    expect(host.querySelector('[data-testid="schedule-detail"]')?.textContent).toContain('Month event');
    await click('[data-testid="edit-month-schedule"]');
    expect(host.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe('Month event');
    expect(host.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe('2026-09-21');
    expect(harness.apiMutation).not.toHaveBeenCalled();
  });

  it('refreshes the complete displayed month after a successful create without optimistic publication', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    await render('account-a', date);
    await flush();
    await click('[data-testid="open-create-form"]');
    await setInputValue('input[type="text"]', 'Created Schedule');
    await setInputValue('input[type="date"]', '2026-09-19');

    const monthResponse = deferred<unknown>();
    harness.deferNextPath = monthRangePath(date);
    harness.deferredResponse = monthResponse.promise;
    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('created-event', 'Created Schedule', '2026-09-19'),
    ], date);
    harness.requests = [];
    harness.apiMutation.mockResolvedValue(true);

    await clickSaveSchedule();
    await flush();

    expect(harness.apiMutation).toHaveBeenCalledWith('POST', '/api/schedules', expect.objectContaining({
      text: 'Created Schedule', date: '2026-09-19',
    }), expect.any(Object));
    expect(harness.requests.filter(request => request.path === monthRangePath(date))).toHaveLength(1);
    expect(harness.requests.some(request => request.path === datePath(date) || request.path === datePath('2026-09-17'))).toBe(false);
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('account-a month old');
    expect(host.querySelector('[data-schedule-month-mutation-status]')?.getAttribute('data-schedule-month-mutation-status')).toBe('refreshing');

    monthResponse.resolve(harness.server[serverKey('account-a', monthRangePath(date))]);
    await flush();

    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('Created Schedule');
    expect(host.querySelector('[data-schedule-month-mutation-status]')?.getAttribute('data-schedule-month-mutation-status')).toBe('success');
    expect(harness.requests.every(request => request.account === 'account-a' && request.method === 'GET')).toBe(true);
  });

  it('refreshes after an edit moves a Schedule out of the displayed month', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('moving-event', 'Moving Schedule', '2026-09-23'),
    ], date);
    await render('account-a', date);
    await flush();
    await click('[data-month-schedule-id="moving-event"]');
    await click('[data-testid="edit-month-schedule"]');
    await setInputValue('input[type="date"]', '2026-10-03');

    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([], date);
    harness.requests = [];
    harness.apiMutation.mockResolvedValue(true);
    await clickSaveSchedule();
    await flush();

    expect(harness.apiMutation).toHaveBeenCalledWith('PUT', '/api/schedules/moving-event', expect.objectContaining({
      date: '2026-10-03',
    }), expect.any(Object));
    expect(harness.requests.map(request => request.path)).toContain(monthRangePath(date));
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('');
    expect(host.textContent).not.toContain('Moving Schedule');
    expect(host.querySelector('[data-schedule-month-mutation-status]')?.getAttribute('data-schedule-month-mutation-status')).toBe('success');
  });

  it('refreshes the displayed month after a confirmed delete', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('deleted-event', 'Deleted Schedule', '2026-09-23'),
    ], date);
    await render('account-a', date);
    await flush();
    await click('[data-month-schedule-id="deleted-event"]');
    await click('[data-testid="delete-month-schedule"]');
    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([], date);
    harness.requests = [];
    harness.apiMutation.mockResolvedValue(true);
    expect(harness.confirmAction).not.toBeNull();
    await act(async () => { await harness.confirmAction?.(); });
    await flush();

    expect(harness.apiMutation).toHaveBeenCalledWith('DELETE', '/api/schedules/deleted-event', undefined, expect.any(Object));
    expect(harness.requests.map(request => request.path)).toContain(monthRangePath(date));
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('');
    expect(host.querySelector('[data-schedule-month-mutation-status]')?.getAttribute('data-schedule-month-mutation-status')).toBe('success');
  });

  it('keeps the previous complete month cache when the post-save read fails', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    await render('account-a', date);
    await flush();
    await click('[data-testid="open-create-form"]');
    await setInputValue('input[type="text"]', 'Will save but refresh fails');
    await setInputValue('input[type="date"]', '2026-09-19');
    harness.failNextPath = monthRangePath(date);
    harness.apiMutation.mockResolvedValue(true);
    await clickSaveSchedule();
    await flush();

    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('account-a month old');
    expect(host.querySelector('[data-schedule-month-mutation-status]')?.getAttribute('data-schedule-month-mutation-status')).toBe('incomplete');
    expect(host.textContent).toContain("The Schedule change succeeded, but this month's list could not be verified.");
    expect(host.textContent).not.toContain('Will save but refresh fails');
  });

  it('supersedes a pre-mutation manual month read and reuses the verified post-mutation result', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    await render('account-a', date);
    await flush();
    await click('[data-testid="open-create-form"]');
    await setInputValue('input[type="text"]', 'Overlap mutation');
    await setInputValue('input[type="date"]', '2026-09-19');

    const staleMonth = deferred<unknown>();
    harness.deferNextPath = monthRangePath(date);
    harness.deferredResponse = staleMonth.promise;
    harness.requests = [];
    await click('[data-schedule-manual-refresh]');
    await flush();
    expect(harness.requests.filter(request => request.path === monthRangePath(date))).toHaveLength(1);

    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('post-mutation-event', 'Post mutation Schedule', '2026-09-26'),
    ], date);
    harness.apiMutation.mockResolvedValue(true);
    await clickSaveSchedule();
    await flush();
    expect(harness.requests.filter(request => request.path === monthRangePath(date))).toHaveLength(2);
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('Post mutation Schedule');

    staleMonth.resolve(monthPage([
      schedule('stale-event', 'Stale pre-mutation Schedule', '2026-09-25'),
    ], date));
    await flush();

    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('Post mutation Schedule');
    expect(host.textContent).not.toContain('Stale pre-mutation Schedule');
    expect(harness.requests.filter(request => request.path === monthRangePath(date))).toHaveLength(2);
    expect(host.querySelector('[data-schedule-month-mutation-status]')?.getAttribute('data-schedule-month-mutation-status')).toBe('success');
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('success');
  });

  it('shares a safe in-flight post-mutation month read with a later manual refresh', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    await render('account-a', date);
    await flush();
    await click('[data-testid="open-create-form"]');
    await setInputValue('input[type="text"]', 'Saved before shared refresh');
    await setInputValue('input[type="date"]', '2026-09-19');

    const monthResponse = deferred<unknown>();
    harness.deferNextPath = monthRangePath(date);
    harness.deferredResponse = monthResponse.promise;
    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('shared-refresh-event', 'Shared post-mutation result', '2026-09-19'),
    ], date);
    harness.requests = [];
    harness.apiMutation.mockResolvedValue(true);
    await clickSaveSchedule();
    await flush();
    expect(harness.requests.filter(request => request.path === monthRangePath(date))).toHaveLength(1);

    await click('[data-schedule-manual-refresh]');
    await flush();
    expect(harness.requests.filter(request => request.path === monthRangePath(date))).toHaveLength(1);

    monthResponse.resolve(harness.server[serverKey('account-a', monthRangePath(date))]);
    await flush();
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('Shared post-mutation result');
    expect(host.querySelector('[data-schedule-month-mutation-status]')?.getAttribute('data-schedule-month-mutation-status')).toBe('success');
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('success');
  });

  it('uses the currently displayed month when a save completes after month navigation', async () => {
    const september = '2026-09-18';
    const october = '2026-10-02';
    initialServerState('account-a', september);
    initialServerState('account-a', october);
    await render('account-a', september);
    await flush();
    await click('[data-testid="open-create-form"]');
    await setInputValue('input[type="text"]', 'Pending September save');
    await setInputValue('input[type="date"]', '2026-09-19');
    const saveResult = deferred<boolean>();
    harness.apiMutation.mockReturnValue(saveResult.promise);
    await clickSaveSchedule();
    await flush();

    harness.server[serverKey('account-a', monthRangePath(october))] = monthPage([
      schedule('october-after-save', 'October after save', '2026-10-12'),
    ], october);
    await render('account-a', october);
    await flush();
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('October after save');
    harness.requests = [];

    saveResult.resolve(true);
    await flush();

    expect(harness.requests.filter(request => request.path === monthRangePath(october))).toHaveLength(1);
    expect(harness.requests.some(request => request.path === monthRangePath(september))).toBe(false);
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('October after save');
    expect(host.querySelector('[data-schedule-month-mutation-status]')?.getAttribute('data-schedule-month-mutation-status')).toBe('success');
  });

  it('does not refresh a stale mutation after account A-B-A or after unmount', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    initialServerState('account-b', date);
    await render('account-a', date);
    await flush();
    await click('[data-testid="open-create-form"]');
    await setInputValue('input[type="text"]', 'Account A pending save');
    await setInputValue('input[type="date"]', '2026-09-19');
    const accountAResult = deferred<boolean>();
    harness.apiMutation.mockReturnValue(accountAResult.promise);
    await clickSaveSchedule();
    await flush();

    await render('account-b', date);
    await flush();
    await render('account-a', date);
    await flush();
    harness.requests = [];
    accountAResult.resolve(true);
    await flush();
    expect(harness.requests.some(request => request.path === monthRangePath(date))).toBe(false);
    expect(host.querySelector('[data-schedule-month-mutation-status]')).toBeNull();
    expect(host.textContent).not.toContain('Account A pending save');

    await click('[data-testid="open-create-form"]');
    await setInputValue('input[type="text"]', 'Unmount pending save');
    await setInputValue('input[type="date"]', '2026-09-19');
    const unmountedResult = deferred<boolean>();
    harness.apiMutation.mockReturnValue(unmountedResult.promise);
    await clickSaveSchedule();
    await flush();
    await act(async () => { root.render(createElement('div', null, 'Unmounted Planner')); });
    harness.requests = [];
    unmountedResult.resolve(true);
    await flush();
    expect(harness.requests.some(request => request.path === monthRangePath(date))).toBe(false);
  });

  it('refreshes the selected day, previous day, D-day, and displayed month without writes', async () => {
    const date = '2026-09-18';
    const previousDate = initialServerState('account-a', date);
    await render('account-a', date);
    await flush();
    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('account-a selected old');
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('account-a month old');
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
    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('a-month-new', 'account-a month new on another date', '2026-09-24'),
    ]);
    harness.requests = [];
    const beforeStorage = storageSnapshot();

    const refresh = host.querySelector<HTMLButtonElement>('[data-schedule-manual-refresh]')!;
    expect(refresh.getAttribute('aria-label')).toBe('Refresh schedules');
    expect(refresh.tabIndex).toBe(0);
    await click('[data-schedule-manual-refresh]');
    await flush();

    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('account-a selected new');
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('account-a month new on another date');
    expect(host.querySelector('[data-testid="previous-source"]')?.textContent).toBe('account-a previous new');
    expect(host.querySelector('[data-testid="dday-source"]')?.textContent).toBe('account-a dday new');
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('success');
    expect(harness.requests).toHaveLength(4);
    expect(harness.requests.map(request => request.path).sort()).toEqual([
      datePath(date), datePath(previousDate), ddayPath, monthRangePath(date),
    ].sort());
    expect(harness.requests.every(request => request.account === 'account-a' && request.method === 'GET')).toBe(true);
    expect(Array.from(cache.keys()).filter(key => typeof key === 'string' && key.includes('/api/schedules'))
      .every(key => key.includes('\u0000absinthe-account=account-a'))).toBe(true);
    expect(harness.apiMutation).not.toHaveBeenCalled();
    expect(storageSnapshot()).toBe(beforeStorage);
  });

  it('does not mistake a pre-existing mount read for a newly requested manual month refresh', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    const mountResponse = deferred<unknown>();
    harness.deferNextPath = monthRangePath(date);
    harness.deferredResponse = mountResponse.promise;
    await render('account-a', date);
    await flush();
    expect(harness.requests.filter(request => request.path === monthRangePath(date))).toHaveLength(1);

    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('fresh-manual-row', 'Fresh manual month', '2026-09-24'),
    ], date);
    await click('[data-schedule-manual-refresh]');
    await flush();
    expect(harness.requests.filter(request => request.path === monthRangePath(date))).toHaveLength(2);
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('Fresh manual month');

    mountResponse.resolve(monthPage([
      schedule('stale-mount-row', 'Stale mount month', '2026-09-25'),
    ], date));
    await flush();
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('Fresh manual month');
    expect(host.textContent).not.toContain('Stale mount month');
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
    expect(harness.requests).toHaveLength(4);
    expect(titleInput?.value).toBe('Unsaved editor draft');

    gate.resolve([schedule('selected-refresh', 'selected refreshed', date)]);
    await flush();
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('incomplete');
    expect(host.querySelector('[data-testid="dday-source"]')?.textContent).toBe('account-a dday old');
    expect(host.querySelector('[data-testid="selected-source"]')?.textContent).toBe('selected refreshed');
    expect(host.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe('Unsaved editor draft');
    expect(harness.requests).toHaveLength(4);
    expect(harness.apiMutation).not.toHaveBeenCalled();
    expect(harness.requests.every(request => request.method === 'GET')).toBe(true);
  });

  it('keeps the prior complete month when a later page fails', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    await render('account-a', date);
    await flush();
    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('partial-month-row', 'Partial page must not publish', '2026-09-24'),
    ], date, 'after-first-page', 2);
    harness.failNextPath = monthRangePath(date, 'after-first-page');
    harness.requests = [];

    await click('[data-schedule-manual-refresh]');
    await flush();

    expect(harness.requests.map(request => request.path)).toContain(monthRangePath(date));
    expect(harness.requests.map(request => request.path)).toContain(monthRangePath(date, 'after-first-page'));
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('account-a month old');
    expect(host.textContent).not.toContain('Partial page must not publish');
    expect(host.querySelector('[data-schedule-refresh-status]')?.getAttribute('data-schedule-refresh-status')).toBe('incomplete');
    expect(harness.apiMutation).not.toHaveBeenCalled();
  });

  it('does not publish a month refresh after navigating to another month', async () => {
    const september = '2026-09-18';
    const october = '2026-10-02';
    initialServerState('account-a', september);
    await render('account-a', september);
    await flush();

    const staleSeptember = deferred<unknown>();
    harness.deferNextPath = monthRangePath(september);
    harness.deferredResponse = staleSeptember.promise;
    harness.requests = [];
    await click('[data-schedule-manual-refresh]');
    await flush();
    expect(harness.requests.some(request => request.path === monthRangePath(september))).toBe(true);

    harness.server[serverKey('account-a', monthRangePath(october))] = monthPage([
      schedule('october-current', 'October current', '2026-10-18'),
    ], october);
    await render('account-a', october);
    await flush();
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('October current');

    staleSeptember.resolve(monthPage([
      schedule('september-stale', 'Stale September result', '2026-09-24'),
    ], september));
    await flush();
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('October current');
    expect(host.textContent).not.toContain('Stale September result');
  });

  it('rejects an old account-A month completion after an A/B/A transition', async () => {
    const date = '2026-09-18';
    initialServerState('account-a', date);
    initialServerState('account-b', date);
    await render('account-a', date);
    await flush();

    const staleAccountA = deferred<unknown>();
    harness.deferNextPath = monthRangePath(date);
    harness.deferredResponse = staleAccountA.promise;
    harness.requests = [];
    await click('[data-schedule-manual-refresh]');
    await flush();

    harness.server[serverKey('account-a', monthRangePath(date))] = monthPage([
      schedule('account-a-current', 'Account A current', '2026-09-25'),
    ], date);
    await render('account-b', date);
    await flush();
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('account-b month old');
    await render('account-a', date);
    await flush();
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('Account A current');

    staleAccountA.resolve(monthPage([
      schedule('account-a-stale', 'Stale account A result', '2026-09-26'),
    ], date));
    await flush();
    expect(host.querySelector('[data-testid="month-source"]')?.textContent).toBe('Account A current');
    expect(host.textContent).not.toContain('Stale account A result');
    expect(harness.requests.filter(request => request.path === monthRangePath(date))
      .every(request => request.account === 'account-a' || request.account === 'account-b')).toBe(true);
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
      datePath(dateB), datePath('2026-09-18'), ddayPath, monthRangePath(dateB),
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
