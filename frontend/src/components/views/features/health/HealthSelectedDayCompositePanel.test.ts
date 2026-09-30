import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { projectCompositeWorkoutRead } from './compositeWorkoutReadProjection';
import { HealthSelectedDayCompositePanel } from './HealthSelectedDayCompositePanel';
import type { HealthSelectedDayReadModel } from './useHealthSelectedDayComposite';

const ID = '11111111-1111-4111-8111-111111111111';
const ENTRY = '22222222-2222-4222-8222-222222222222';
const SET = '33333333-3333-4333-8333-333333333333';
const accountId = 'account-a';
const namespaceKey = 'namespace-a';
const generationId = 'g1';
const localDate = '2026-09-29';

function model(input: Parameters<typeof projectCompositeWorkoutRead>[0]): HealthSelectedDayReadModel {
  return { phase: 'settled', accountId, localDate, cacheKey: null,
    result: projectCompositeWorkoutRead(input), legacyDaily: null, isolationError: false, retry: vi.fn() };
}
function html(value: HealthSelectedDayReadModel, draftDirty = false) {
  return renderToStaticMarkup(createElement(HealthSelectedDayCompositePanel,
    { model: value, draftDirty, onPreviousDay: vi.fn(), onNextDay: vi.fn() }));
}

describe('selected-day read-only source panel', () => {
  it('shows frozen canonical fields and source identity without writer actions', () => {
    const value = model({ context: { accountId, namespaceKey, generationId },
      legacy: { status: 'success', records: [] },
      canonical: { status: 'success', records: [{ accountId, namespaceKey, generationId,
        entityId: ID, localRevision: 1, session: { version: 1, id: ID, localDate,
          entries: [{ id: ENTRY, exercise: { id: 'old-id', name: 'Frozen Name', type: 'strength',
            tags: ['OLD'], cardioMode: null }, sets: [{ id: SET, ordinal: 1, done: true,
              kind: 'strength', loadKind: 'external_weight', weightKg: '10', sourceValue: '10',
              sourceUnit: 'kg', reps: 8, assistedReps: null, dropset: false }] }] } }] },
    });
    const output = html(value);
    expect(output).toContain('Frozen Name');
    expect(output).toContain('OLD');
    expect(output).toContain(`data-canonical-entry="${ENTRY}"`);
    expect(output).toContain(`data-canonical-set="${SET}"`);
    expect(output).toContain('10 kg');
    expect(output).not.toContain('Edit');
    expect(output).not.toContain('Delete');
    expect(output).not.toContain('Save');
    expect(output).not.toContain('performedAt');
  });

  it('marks partial and both-error states, and only claims empty with clean complete sources', () => {
    const context = { accountId, namespaceKey, generationId };
    const empty = model({ context, legacy: { status: 'success', records: [] },
      canonical: { status: 'success', records: [] } });
    expect(html(empty)).toContain('data-composite-empty');
    expect(html(empty, true)).not.toContain('data-composite-empty');
    const partial = model({ context, legacy: { status: 'error' },
      canonical: { status: 'success', records: [] } });
    expect(html(partial)).toContain('data-composite-incomplete');
    expect(html(partial)).not.toContain('data-composite-empty');
    const failed = model({ context, legacy: { status: 'error' }, canonical: { status: 'error' } });
    expect(html(failed)).toContain('Local workout sources are unavailable');
    expect(html(failed)).not.toContain('data-composite-empty');
  });
});
