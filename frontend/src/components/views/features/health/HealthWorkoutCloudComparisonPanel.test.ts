// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const services = vi.hoisted(() => ({ create: vi.fn(), write: vi.fn(), receive: vi.fn(), block: vi.fn(), mutate: vi.fn() }));
vi.mock('../../../../lib/healthExerciseBlockCloudSingleReceive', () => ({ createExerciseBlockCloudSingleReceive: services.block }));
vi.mock('../../../../lib/healthWorkoutCloudSingleReceive', () => ({ createWorkoutCloudSingleReceive: services.receive }));
vi.mock('../../../../lib/healthSupabaseBootstrap', () => ({ HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'test-health-refresh' }));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: services.mutate }) }));
vi.mock('../../../../lib/healthWorkoutCloudSingleCreate', () => ({ createWorkoutCloudSingleCreate: services.write }));
vi.mock('../../../../lib/healthWorkoutCloudComparison', () => ({
  createWorkoutCloudComparison: services.create,
  WORKOUT_COMPARISON_CATEGORIES: ['localOnly', 'remoteOnly', 'matching', 'divergent', 'unverifiable'],
}));
import { HealthWorkoutCloudComparisonPanel } from './HealthWorkoutCloudComparisonPanel';
import { useAppStore } from '../../../../store/useAppStore';
import { getTranslator } from '../../../../lib/i18n';
import type { WorkoutComparisonReport } from '../../../../lib/healthWorkoutCloudComparison';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const report = (): WorkoutComparisonReport => ({ counts: { localOnly: 1, remoteOnly: 1, matching: 1, divergent: 1, unverifiable: 1 }, details: {
  localOnly: [{ id: 'local-id', localDate: '2026-10-30' }], remoteOnly: [{ id: 'cloud-id', remoteDate: '2026-10-29' }], matching: [{ id: 'same-id' }], divergent: [{ id: 'different-id', localDate: '2026-10-28', remoteDate: '2026-10-27' }], unverifiable: [{ id: 'unknown-id' }],
} });
let host: HTMLElement, root: ReturnType<typeof createRoot>;
const originalLanguage = useAppStore.getState().appSettings.language;
beforeEach(() => {
  vi.resetAllMocks();
  useAppStore.setState(state => ({ ...state, appSettings: { ...state.appSettings, language: 'en' } }));
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  services.create.mockImplementation(() => ({ compare: vi.fn().mockResolvedValue(report()), cancel: vi.fn(), isCurrent: () => true, localOnlyRecord: (id: string) => ({ id }), remoteOnlyRecord: (id: string) => ({ id }) }));
  services.write.mockReturnValue({ transfer: vi.fn().mockResolvedValue('DENIED'), cancel: vi.fn() });
  services.receive.mockReturnValue({ receive: vi.fn().mockResolvedValue('DENIED'), cancel: vi.fn() });
  services.block.mockReturnValue({ inspect: vi.fn().mockResolvedValue(null), receive: vi.fn().mockResolvedValue('DENIED'), cancel: vi.fn() });
});
afterEach(() => { act(() => root.unmount()); host.remove(); useAppStore.setState(state => ({ ...state, appSettings: { ...state.appSettings, language: originalLanguage } })); });
const render = (id = 'A') => act(() => root.render(createElement(HealthWorkoutCloudComparisonPanel, { accountId: id })));
const click = async () => { await act(async () => { host.querySelector<HTMLButtonElement>('button')!.click(); }); };

describe('manual Health cloud comparison UI', () => {
  it.each(['en', 'ko', 'ja'] as const)('offers only a proven missing exercise and requires separate confirmation in %s', async language => {
    useAppStore.setState(state => ({ ...state, appSettings: { ...state.appSettings, language } }));
    const t = getTranslator(language), receive = vi.fn().mockResolvedValue('LOCAL_CREATE_CONFIRMED');
    services.block.mockReturnValue({ inspect: async () => ({ id: 'exact-block', name: '스쿼트' }), receive, cancel: vi.fn() });
    render(); await click();
    const inspect = Array.from(host.querySelectorAll('button')).find(button => button.textContent === t('healthCloudBlockCheck'))!;
    expect(inspect.type).toBe('button'); expect(host.querySelector('[role="group"]')).toBeNull();
    await act(async () => inspect.click());
    expect(receive).not.toHaveBeenCalled(); expect(host.querySelector('[role="group"]')?.textContent).toContain('exact-block');
    expect(host.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(t('healthCloudBlockConfirm'));
    expect(services.block.mock.calls[0].slice(0, 2)).toEqual(['A', { id: 'cloud-id' }]);
    await act(async () => { const confirm = host.querySelector<HTMLButtonElement>('[role="group"] button')!; confirm.click(); confirm.click(); });
    expect(receive).toHaveBeenCalledOnce(); expect(services.receive).not.toHaveBeenCalled(); expect(services.write).not.toHaveBeenCalled();
    expect(host.textContent).toContain(t('healthCloudBlockConfirmed')); expect(services.create).toHaveBeenCalledTimes(2); expect(services.mutate).toHaveBeenCalledOnce();
    act(() => services.create.mock.calls[1][2]());
    expect(host.textContent).toContain(t('healthCloudBlockConfirmed')); expect(host.textContent).toContain(t('healthCloudRefreshUnavailable'));
    render('B'); render('A'); expect(host.textContent).not.toContain(t('healthCloudBlockConfirmed'));
  });
  it('does not offer receipt when unavailable and ignores late inspection after A/B/A', async () => {
    render(); await click();
    const inspect = () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === getTranslator('en')('healthCloudBlockCheck'))!;
    await act(async () => inspect().click());
    expect(host.querySelector('[role="group"]')).toBeNull(); expect(host.textContent).toContain(getTranslator('en')('healthCloudBlockDenied'));
    expect(services.block.mock.results[0].value.receive).not.toHaveBeenCalled();
    let finish!: (value: unknown) => void;
    const cancel = vi.fn(); services.block.mockReturnValue({ inspect: () => new Promise(done => { finish = done; }), receive: vi.fn(), cancel });
    await act(async () => inspect().click()); render('B'); render('A');
    await act(async () => finish({ id: 'old-block', name: 'private' }));
    expect(host.textContent).not.toContain('private'); expect(host.querySelector('[role="group"]')).toBeNull(); expect(cancel).toHaveBeenCalled();
  });
  it('cancels a prepared block without writing and rejects an old confirmation', async () => {
    const cancel = vi.fn(), receive = vi.fn(); services.block.mockReturnValue({ inspect: async () => ({ id: 'exact', name: 'exercise' }), receive, cancel });
    render(); await click();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === getTranslator('en')('healthCloudBlockCheck'))!.click());
    const confirm = host.querySelector<HTMLButtonElement>('[role="group"] button')!;
    await act(async () => host.querySelectorAll<HTMLButtonElement>('[role="group"] button')[1].click());
    await act(async () => confirm.click());
    expect(cancel).toHaveBeenCalled(); expect(receive).not.toHaveBeenCalled(); expect(services.mutate).not.toHaveBeenCalled();
  });
  it.each(['DENIED', 'CONFLICT', 'INDETERMINATE'] as const)('reports block %s without refresh, retry, or workout receive', async status => {
    services.block.mockReturnValue({ inspect: async () => ({ id: 'block', name: 'exercise' }), receive: async () => status, cancel: vi.fn() });
    render(); await click();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === getTranslator('en')('healthCloudBlockCheck'))!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[role="group"] button')!.click());
    const key = { DENIED: 'healthCloudBlockDenied', CONFLICT: 'healthCloudBlockConflict', INDETERMINATE: 'healthCloudBlockIndeterminate' } as const;
    expect(host.textContent).toContain(getTranslator('en')(key[status])); expect(services.create).toHaveBeenCalledOnce();
    expect(services.receive).not.toHaveBeenCalled(); expect(services.mutate).not.toHaveBeenCalled();
  });
  it.each(['en', 'ko', 'ja'] as const)('exposes a labelled native button, bounded details, and truthful scope in %s', async language => {
    useAppStore.setState(state => ({ ...state, appSettings: { ...state.appSettings, language } }));
    render(); const t = getTranslator(language);
    expect(services.create).not.toHaveBeenCalled();
    expect(host.textContent).toContain(t('healthCloudScope'));
    expect(host.querySelector('button')?.type).toBe('button');
    await click();
    expect(host.textContent).toContain(t('healthCloudObserved'));
    expect(host.querySelectorAll('details summary')).toHaveLength(4);
    expect(host.textContent).toContain('different-id');
    expect(host.textContent).toContain(t('healthCloudLocalDate') + ': 2026-10-28');
    expect(host.textContent).toContain(t('healthCloudRemoteDate') + ': 2026-10-27');
    expect(host.textContent).not.toContain('same-id');
    expect(host.querySelectorAll('button')).toHaveLength(4);
    expect(services.write).not.toHaveBeenCalled();
  });
  it('keeps a long result limited to 30 detail rows and preserves summary counts', async () => {
    const value = report();
    services.create.mockReturnValue({ compare: async () => ({ ...value, counts: { ...value.counts, localOnly: 40 }, details: { ...value.details, localOnly: Array.from({ length: 40 }, (_, i) => ({ id: `id-${i}` })) } }), cancel: vi.fn(), isCurrent: () => true });
    render(); await click();
    expect(host.querySelector('details ul')?.children).toHaveLength(30);
    expect(host.querySelector('details summary')?.textContent).toContain('40');
    expect(host.textContent).toContain(getTranslator('en')('healthCloudPreviewLimit'));
  });
  it('discards a late A result after A/B/A, cancels on unmount, and allows a fresh manual request', async () => {
    let resolve!: (value: WorkoutComparisonReport) => void;
    const cancel = vi.fn();
    services.create.mockReturnValueOnce({ compare: () => new Promise(done => { resolve = done; }), cancel, isCurrent: () => true });
    render(); await click();
    render('B'); render('A');
    await act(async () => { resolve(report()); });
    expect(host.textContent).not.toContain('local-id'); expect(cancel).toHaveBeenCalled();
    await click(); expect(host.textContent).toContain('local-id');
    const owner = services.create.mock.results.at(-1)!.value;
    act(() => root.unmount()); expect(owner.cancel).toHaveBeenCalled();
    root = createRoot(host);
  });
  it('immediately clears an exposed result on session invalidation', async () => {
    render(); await click();
    act(() => services.create.mock.calls[0][2]());
    expect(host.textContent).not.toContain('local-id'); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('never shows incomplete source failure as zero counts or success', async () => {
    services.create.mockReturnValue({ compare: async () => { throw new Error('incomplete'); }, cancel: vi.fn(), isCurrent: () => true });
    render(); await click();
    expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(host.querySelector('dl')).toBeNull();
  });
  it('does not start duplicate requests from two clicks in one event batch', async () => {
    render();
    await act(async () => { const button = host.querySelector<HTMLButtonElement>('button')!; button.click(); button.click(); });
    expect(services.create).toHaveBeenCalledOnce();
  });
  it('requires individual confirmation and sends the exact selected ID once, then refreshes only on confirmed readback', async () => {
    services.write.mockReturnValue({ transfer: vi.fn().mockResolvedValue('REMOTE_INSERT_CONFIRMED'), cancel: vi.fn() });
    render(); await click();
    await act(async () => host.querySelector('details button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(services.write).not.toHaveBeenCalled();
    expect(host.querySelector('[role="group"]')?.textContent).toContain('local-id');
    await act(async () => {
      const confirm = host.querySelector<HTMLButtonElement>('[role="group"] button')!;
      confirm.click(); confirm.click();
    });
    expect(services.write).toHaveBeenCalledOnce();
    expect(services.write.mock.calls[0].slice(0, 2)).toEqual(['A', { id: 'local-id' }]);
    expect(services.create).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain(getTranslator('en')('healthCloudCreateConfirmed'));
  });
  it('clears confirmation on account changes and never starts a transfer from stale UI', async () => {
    render(); await click();
    await act(async () => host.querySelector('details button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const oldConfirm = host.querySelector<HTMLButtonElement>('[role="group"] button')!;
    render('B'); render('A');
    await act(async () => oldConfirm.click());
    expect(services.write).not.toHaveBeenCalled();
    expect(host.querySelector('[role="group"]')).toBeNull();
  });
  it('shows uncertainty without an automatic comparison or retry', async () => {
    services.write.mockReturnValue({ transfer: vi.fn().mockResolvedValue('INDETERMINATE'), cancel: vi.fn() });
    render(); await click();
    await act(async () => host.querySelector('details button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => host.querySelector<HTMLButtonElement>('[role="group"] button')!.click());
    expect(host.textContent).toContain(getTranslator('en')('healthCloudCreateIndeterminate'));
    expect(services.create).toHaveBeenCalledOnce(); expect(services.write).toHaveBeenCalledOnce();
  });
  it('does not let a stale write completion erase a newer same-account comparison', async () => {
    let finish!: (status: string) => void;
    services.write.mockReturnValue({ transfer: () => new Promise(done => { finish = done; }), cancel: vi.fn() });
    render(); await click();
    await act(async () => host.querySelector('details button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => host.querySelector<HTMLButtonElement>('[role="group"] button')!.click());
    act(() => services.create.mock.calls[0][2]());
    await click(); expect(host.textContent).toContain('local-id');
    await act(async () => finish('INDETERMINATE'));
    expect(host.textContent).toContain('local-id');
    expect(host.textContent).not.toContain(getTranslator('en')('healthCloudCreateIndeterminate'));
  });
  it('never claims nothing changed when auth invalidates an in-flight create', async () => {
    let finish!: (status: string) => void;
    services.write.mockReturnValue({ transfer: () => new Promise(done => { finish = done; }), cancel: vi.fn() });
    render(); await click();
    await act(async () => host.querySelector('details button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => host.querySelector<HTMLButtonElement>('[role="group"] button')!.click());
    act(() => services.create.mock.calls[0][2]());
    expect(host.textContent).not.toContain(getTranslator('en')('healthCloudUnavailable'));
    await act(async () => finish('INDETERMINATE'));
    expect(host.textContent).toContain(getTranslator('en')('healthCloudCreateIndeterminate'));
    expect(host.textContent).not.toContain(getTranslator('en')('healthCloudUnavailable'));
    act(() => services.create.mock.calls[0][2]());
    expect(host.textContent).toContain(getTranslator('en')('healthCloudCreateIndeterminate'));
    expect(host.textContent).not.toContain(getTranslator('en')('healthCloudUnavailable'));
  });
  it.each(['en', 'ko', 'ja'] as const)('confirms one remoteOnly receive by exact ID and refreshes projections only after verified completion in %s', async language => {
    useAppStore.setState(state => ({ ...state, appSettings: { ...state.appSettings, language } }));
    const t = getTranslator(language), refresh = vi.fn();
    window.addEventListener('test-health-refresh', refresh);
    services.receive.mockReturnValue({ receive: vi.fn().mockResolvedValue('LOCAL_CREATE_CONFIRMED'), cancel: vi.fn() });
    try {
      render(); await click();
      const button = Array.from(host.querySelectorAll('button')).find(button => button.textContent === t('healthCloudReceive'))!;
      expect(button.type).toBe('button');
      await act(async () => button.click());
      expect(services.receive).not.toHaveBeenCalled();
      expect(host.querySelector('[role="group"]')?.textContent).toContain('cloud-id');
      await act(async () => { const confirm = host.querySelector<HTMLButtonElement>('[role="group"] button')!; confirm.click(); confirm.click(); });
      expect(services.receive).toHaveBeenCalledOnce();
      expect(services.receive.mock.calls[0].slice(0, 2)).toEqual(['A', { id: 'cloud-id' }]);
      expect(host.textContent).toContain(t('healthCloudReceiveConfirmed')); expect(refresh).toHaveBeenCalledOnce();
      expect(services.create).toHaveBeenCalledTimes(2);
      const filter = services.mutate.mock.calls[0][0];
      expect(filter(['local-health-workout-range', 'A', '2026-11-01', '2026-11-30'])).toBe(true);
      expect(filter(['local', 'A', '2026-10-01', '2026-11-01'])).toBe(true);
      expect(filter(['local-health-workout-range', 'B'])).toBe(false);
      expect(filter(['notes', 'A'])).toBe(false);
    } finally { window.removeEventListener('test-health-refresh', refresh); }
  });
  it('clears stale receive intent and ignores old completion after A/B/A or unmount', async () => {
    let finish!: (status: string) => void; const cancel = vi.fn();
    services.receive.mockReturnValue({ receive: () => new Promise(done => { finish = done; }), cancel });
    render(); await click();
    const receiveButton = () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === getTranslator('en')('healthCloudReceive'))!;
    await act(async () => receiveButton().click());
    const oldConfirm = host.querySelector<HTMLButtonElement>('[role="group"] button')!;
    render('B'); render('A'); await act(async () => oldConfirm.click()); expect(services.receive).not.toHaveBeenCalled();
    await click(); await act(async () => receiveButton().click());
    await act(async () => host.querySelector<HTMLButtonElement>('[role="group"] button')!.click());
    render('B'); render('A'); await act(async () => finish('LOCAL_CREATE_CONFIRMED'));
    expect(services.mutate).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalled();
    expect(host.textContent).not.toContain(getTranslator('en')('healthCloudReceiveConfirmed'));
  });
  it.each(['DENIED', 'CONFLICT', 'INDETERMINATE'] as const)('reports receive %s without claiming success, remote changes, refresh or retry', async status => {
    services.receive.mockReturnValue({ receive: vi.fn().mockResolvedValue(status), cancel: vi.fn() });
    render(); await click();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === getTranslator('en')('healthCloudReceive'))!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[role="group"] button')!.click());
    const key = { DENIED: 'healthCloudReceiveDenied', CONFLICT: 'healthCloudReceiveConflict', INDETERMINATE: 'healthCloudReceiveIndeterminate' } as const;
    expect(host.textContent).toContain(getTranslator('en')(key[status]));
    expect(services.create).toHaveBeenCalledOnce(); expect(services.mutate).not.toHaveBeenCalled(); expect(services.write).not.toHaveBeenCalled();
  });
  it.each(['read failure', 'workout_comparison_limit'])('preserves confirmed receipt after refresh %s without claiming nothing changed', async reason => {
    const first = { compare: async () => report(), cancel: vi.fn(), isCurrent: () => true, remoteOnlyRecord: (id: string) => ({ id }) };
    services.create.mockReturnValueOnce(first).mockReturnValueOnce({ compare: async () => { throw new Error(reason); }, cancel: vi.fn(), isCurrent: () => true });
    services.receive.mockReturnValue({ receive: vi.fn().mockResolvedValue('LOCAL_CREATE_CONFIRMED'), cancel: vi.fn() });
    render(); await click();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === getTranslator('en')('healthCloudReceive'))!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[role="group"] button')!.click());
    expect(host.textContent).toContain(getTranslator('en')('healthCloudReceiveConfirmed'));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(getTranslator('en')('healthCloudRefreshUnavailable'));
    expect(host.textContent).not.toContain(getTranslator('en')('healthCloudUnavailable'));
    expect(services.receive).toHaveBeenCalledOnce();
  });
  it('preserves verified receipt when the second comparison is invalidated by a same-account token refresh', async () => {
    services.receive.mockReturnValue({ receive: vi.fn().mockResolvedValue('LOCAL_CREATE_CONFIRMED'), cancel: vi.fn() });
    render(); await click();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === getTranslator('en')('healthCloudReceive'))!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[role="group"] button')!.click());
    expect(services.create).toHaveBeenCalledTimes(2);
    act(() => services.create.mock.calls[1][2]());
    expect(host.textContent).toContain(getTranslator('en')('healthCloudReceiveConfirmed'));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(getTranslator('en')('healthCloudRefreshUnavailable'));
    expect(host.textContent).not.toContain(getTranslator('en')('healthCloudUnavailable'));
    expect(host.querySelector('dl')).toBeNull();
    render('B'); render('A');
    expect(host.textContent).not.toContain(getTranslator('en')('healthCloudReceiveConfirmed'));
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
