// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const services = vi.hoisted(() => ({ create: vi.fn() }));
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
  services.create.mockImplementation(() => ({ compare: vi.fn().mockResolvedValue(report()), cancel: vi.fn(), isCurrent: () => true }));
});
afterEach(() => { act(() => root.unmount()); host.remove(); useAppStore.setState(state => ({ ...state, appSettings: { ...state.appSettings, language: originalLanguage } })); });
const render = (id = 'A') => act(() => root.render(createElement(HealthWorkoutCloudComparisonPanel, { accountId: id })));
const click = async () => { await act(async () => { host.querySelector<HTMLButtonElement>('button')!.click(); }); };

describe('manual Health cloud comparison UI', () => {
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
    expect(host.querySelectorAll('button')).toHaveLength(1);
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
});
