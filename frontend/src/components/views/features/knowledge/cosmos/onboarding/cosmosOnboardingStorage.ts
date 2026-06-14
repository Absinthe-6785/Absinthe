const STORAGE_KEY = 'absinthe:cosmos-onboarding:v1';

export interface CosmosOnboardingState {
  firstDiscoveryCelebrated: boolean;
  productTourCompleted: boolean;
  productTourStep: number;
}

const DEFAULT_STATE: CosmosOnboardingState = {
  firstDiscoveryCelebrated: false,
  productTourCompleted: false,
  productTourStep: 0,
};

function readState(): CosmosOnboardingState {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return { ...DEFAULT_STATE };
  }
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<CosmosOnboardingState>;
    return {
      firstDiscoveryCelebrated: Boolean(parsed.firstDiscoveryCelebrated),
      productTourCompleted: Boolean(parsed.productTourCompleted),
      productTourStep: typeof parsed.productTourStep === 'number' ? parsed.productTourStep : 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state: CosmosOnboardingState): void {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return;
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadCosmosOnboardingState(): CosmosOnboardingState {
  return readState();
}

export function markFirstDiscoveryCelebrated(): void {
  const state = readState();
  writeState({ ...state, firstDiscoveryCelebrated: true });
}

export function shouldShowFirstDiscoveryBanner(): boolean {
  return !readState().firstDiscoveryCelebrated;
}

export function shouldShowProductTour(): boolean {
  return !readState().productTourCompleted;
}

export function advanceProductTour(step: number): void {
  const state = readState();
  writeState({ ...state, productTourStep: step });
}

export function completeProductTour(): void {
  const state = readState();
  writeState({ ...state, productTourCompleted: true, productTourStep: 0 });
}
