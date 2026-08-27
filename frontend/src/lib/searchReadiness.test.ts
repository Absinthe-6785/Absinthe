import { describe, expect, it } from 'vitest';
import {
  resolveSearchDatasetState,
  searchDatasetStateFromData,
} from './searchReadiness';

describe('Search deferred dataset readiness', () => {
  it('keeps an inactive source distinct from a confirmed empty response', () => {
    expect(resolveSearchDatasetState({ enabled: false })).toEqual({
      status: 'NOT_READY',
      validating: false,
    });
    expect(searchDatasetStateFromData([])).toEqual({
      status: 'READY_EMPTY',
      validating: false,
    });
  });

  it('represents pending and failure without losing warm data semantics', () => {
    expect(resolveSearchDatasetState({ enabled: true, isLoading: true })).toMatchObject({
      status: 'LOADING',
      validating: true,
    });
    expect(resolveSearchDatasetState({ enabled: true, error: new Error('offline') })).toMatchObject({
      status: 'ERROR',
      validating: false,
    });
    expect(resolveSearchDatasetState({
      enabled: true,
      data: [{ id: 'warm' }],
      isValidating: true,
    })).toEqual({
      status: 'READY_WITH_RESULTS',
      validating: true,
    });
  });

  it('represents a ready-empty warm cache while it revalidates', () => {
    expect(resolveSearchDatasetState({ enabled: true, data: [], isValidating: true })).toEqual({
      status: 'READY_EMPTY',
      validating: true,
    });
  });
});
