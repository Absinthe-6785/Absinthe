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

async function renderProjection(value: CompositePreviousWorkoutProjection, onRetry = vi.fn()) {
  await act(async () => root!.render(createElement(CompositePreviousWorkoutView, {
    projection: value, theme: { border: 'border', input: 'input', card: 'card', textMuted: 'muted' } as never,
    darkMode: false, t: t as never, formatDate: (date: string) => date,
    formatCompactDate: (date: string) => date, onRetry, onSelectDate: vi.fn(),
  })));
  return onRetry;
}

describe('Composite Previous workout view', () => {
  it('renders source-separated, read-only legacy and canonical records without editor actions', async () => {
    await renderProjection(projection);
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
    await renderProjection({ ...projection, status: 'partial_data', legacyStatus: 'error' }, retry);
    expect(host.querySelector('[data-health-composite-previous-incomplete]')).not.toBeNull();
    host.querySelector<HTMLButtonElement>('[data-health-composite-previous-incomplete] button')!.click();
    expect(retry).toHaveBeenCalledTimes(1);
    await renderProjection({ ...projection, status: 'error', dateBuckets: [], selectedBucket: null }, retry);
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['legacy', 'error', 'success'],
    ['canonical', 'success', 'error'],
  ] as const)('renders partial no-known-record truth when the %s source is unavailable', async (_source, legacyStatus, canonicalStatus) => {
    const retry = vi.fn();
    await renderProjection({
      ...projection,
      status: 'partial_data',
      legacyStatus,
      canonicalStatus,
      dateBuckets: [],
      automaticDate: null,
      effectiveDate: null,
      selectedBucket: null,
    }, retry);

    expect(host.textContent).toContain('workoutCompositePartialNoRecords');
    expect(host.textContent).not.toContain('previousWorkoutEmpty');
    expect(host.querySelector('[data-health-composite-previous-incomplete]')).not.toBeNull();
    host.querySelector<HTMLButtonElement>('[data-health-composite-previous-incomplete] button')!.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps verified complete-empty copy distinct from partial truth', async () => {
    await renderProjection({
      ...projection,
      status: 'complete',
      dateBuckets: [],
      automaticDate: null,
      effectiveDate: null,
      selectedBucket: null,
    });
    expect(host.textContent).toContain('previousWorkoutEmpty');
    expect(host.textContent).not.toContain('workoutCompositePartialNoRecords');
    expect(host.querySelector('[data-health-composite-previous-incomplete]')).toBeNull();
  });

  it('renders persisted legacy set facts and canonical technical identities without fabricating nulls', async () => {
    const detailedBucket: CompositePreviousWorkoutProjection['dateBuckets'][number] = {
      ...bucket,
      legacyGroup: {
        ...bucket.legacyGroup!,
        rows: [{
          ...bucket.legacyGroup!.rows[0]!,
          legacy: {
            ...bucket.legacyGroup!.rows[0]!.legacy,
            sets: [
              { type: 'strength', set: 1, kg: 55, weight_source_value: 121, weight_source_unit: 'lbs', reps: 8, assisted_reps: 3, is_dropset: true, done: true },
              { type: 'bodyweight', set: 2, kg: '', reps: 10, assisted_reps: 2, done: false },
              { type: 'cardio', set: 3, time: '30:00', distance: '5.2', pace: '5:46', done: true },
            ],
          },
        } as never],
      },
      canonicalSessions: [{
        ...bucket.canonicalSessions[0]!,
        canonical: {
          ...bucket.canonicalSessions[0]!.canonical,
          session: {
            ...bucket.canonicalSessions[0]!.canonical.session,
            entries: [
              {
                id: '22222222-2222-4222-8222-222222222222',
                exercise: { id: null, name: 'Canonical press', type: 'strength', tags: [], cardioMode: null },
                sets: [
                  { id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength', loadKind: 'external_weight', weightKg: null, sourceValue: null, sourceUnit: null, reps: null, assistedReps: null, dropset: false, done: false },
                  { id: '44444444-4444-4444-8444-444444444444', ordinal: 2, kind: 'strength', loadKind: 'external_weight', weightKg: '80', sourceValue: '176.37', sourceUnit: 'lbs', reps: 5, assistedReps: 1, dropset: true, done: true },
                ],
              },
              {
                id: '55555555-5555-4555-8555-555555555555',
                exercise: { id: null, name: 'Canonical run', type: 'cardio', tags: [], cardioMode: 'both' },
                sets: [{ id: '66666666-6666-4666-8666-666666666666', ordinal: 1, kind: 'cardio', durationSeconds: null, distanceMeters: '5000', done: true }],
              },
            ],
          },
        },
      } as never],
    };
    await renderProjection({ ...projection, dateBuckets: [detailedBucket], selectedBucket: detailedBucket });

    const content = host.textContent ?? '';
    for (const persistedFact of ['55', '121 lbs', '8', '3', 'bodyweight', '10', '30:00', '5.2', '5:46']) {
      expect(content).toContain(persistedFact);
    }
    for (const technicalId of [
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
    ]) expect(content).toContain(technicalId);
    expect(content).toContain('workoutCompositeCardioMode: both');
    expect(content).toContain('workoutCompositeWeightKg: —');
    expect(content).toContain('workoutCompositeReps: —');
    expect(content).not.toContain('workoutCompositeWeightKg: 0');
  });
});
