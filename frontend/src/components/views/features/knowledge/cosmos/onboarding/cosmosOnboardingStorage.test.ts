import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  completeProductTour,
  loadCosmosOnboardingState,
  markFirstDiscoveryCelebrated,
  shouldShowFirstDiscoveryBanner,
  shouldShowProductTour,
} from './cosmosOnboardingStorage';

describe('cosmosOnboardingStorage', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    });
  });

  it('tracks first discovery celebration', () => {
    expect(shouldShowFirstDiscoveryBanner()).toBe(true);
    markFirstDiscoveryCelebrated();
    expect(shouldShowFirstDiscoveryBanner()).toBe(false);
  });

  it('tracks product tour completion', () => {
    expect(shouldShowProductTour()).toBe(true);
    completeProductTour();
    expect(shouldShowProductTour()).toBe(false);
    expect(loadCosmosOnboardingState().productTourCompleted).toBe(true);
  });
});
