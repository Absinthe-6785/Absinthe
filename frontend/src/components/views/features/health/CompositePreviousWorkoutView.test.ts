// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompositePreviousWorkoutProjection } from './compositePreviousWorkoutProjection';
import { CompositePreviousWorkoutView } from './CompositePreviousWorkoutView';

const canonicalId = '11111111-1111-4111-8111-111111111111';
const bucket: CompositePreviousWorkoutProjection['dateBuckets'][number] = {
  localDate: '2026-09-22', legacyGroup: { source: 'legacy',
    presentationKey: '["presentation-only","legacy-date-group","a","2026-09-22"]', rows: [{
      source: 'legacy', readId: '["legacy","a","legacy-1"]', localDate: '2026-09-22', capability: 'read_only',
      legacy: { accountId: 'a', rowId: 'legacy-1', localDate: '2026-09-22', blockId: 'bench', sortOrder: 0,
        exerciseDisplay: { kind: 'historical_fallback', name: 'Legacy bench' }, sets: [{ type: 'strength', set: 1, kg: 20, reps: 5, done: true }] },
    } as never] }, canonicalSessions: [{
      source: 'canonical', readId: '["canonical","ns","g","session"]', localDate: '2026-09-22', capability: 'read_only_in_G5B2',
      canonical: { accountId: 'a', namespaceKey: 'ns', generationId: 'g', entityId: canonicalId, localRevision: 1,
        session: { version: 1, id: canonicalId, localDate: '2026-09-22', entries: [{
          id: '22222222-2222-4222-8222-222222222222', exercise: { id: null, name: 'Canonical squat', type: 'strength', tags: [], cardioMode: null },
          sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength', loadKind: 'external_weight', weightKg: '80', sourceValue: '80', sourceUnit: 'kg', reps: 5, assistedReps: null, dropset: false, done: true }],
        }] } },
    } as never],
};
const projection: CompositePreviousWorkoutProjection = {
  phase: 'settled', status: 'complete', legacyStatus: 'success', canonicalStatus: 'success',
  automaticDate: '2026-09-22', effectiveDate: '2026-09-22',
  dateBuckets: [bucket],
  selectedBucket: bucket,
};

let root: Root | null;
let host: HTMLDivElement;
const t = (key: string) => key;

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root?.unmount()); root = null; host.remove(); });

describe('Composite Previous workout view', () => {
  it('renders source-separated, read-only legacy and canonical records without editor actions', async () => {
    await act(async () => root!.render(createElement(CompositePreviousWorkoutView, {
      projection, theme: { border: 'border', input: 'input', card: 'card', textMuted: 'muted' } as never,
      darkMode: false, t: t as never, formatDate: (date: string) => date,
      formatCompactDate: (date: string) => date, onRetry: vi.fn(), onSelectDate: vi.fn(),
    })));
    expect(host.textContent).toContain('Legacy bench');
    expect(host.textContent).toContain('Canonical squat');
    expect(host.textContent).toContain(canonicalId);
    expect(host.querySelectorAll('[data-canonical-read-id]')).toHaveLength(1);
    expect(host.querySelectorAll('[data-legacy-read-id]')).toHaveLength(1);
    expect(host.textContent).toContain('workoutCompositeLegacyComparisonScope');
    expect(host.textContent?.toLowerCase()).not.toMatch(/edit|delete|apply|copy to editor/);
  });

  it('renders truthful partial/error controls through the shared retry callback', async () => {
    const retry = vi.fn();
    await act(async () => root!.render(createElement(CompositePreviousWorkoutView, {
      projection: { ...projection, status: 'partial_data', legacyStatus: 'error' },
      theme: { border: 'border', input: 'input', card: 'card', textMuted: 'muted' } as never,
      darkMode: false, t: t as never, formatDate: (date: string) => date,
      formatCompactDate: (date: string) => date, onRetry: retry, onSelectDate: vi.fn(),
    })));
    expect(host.querySelector('[data-health-composite-previous-incomplete]')).not.toBeNull();
    await act(async () => root!.render(createElement(CompositePreviousWorkoutView, {
      projection: { ...projection, status: 'error', dateBuckets: [], selectedBucket: null },
      theme: { border: 'border', input: 'input', card: 'card', textMuted: 'muted' } as never,
      darkMode: false, t: t as never, formatDate: (date: string) => date,
      formatCompactDate: (date: string) => date, onRetry: retry, onSelectDate: vi.fn(),
    })));
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
