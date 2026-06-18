import { describe, expect, it } from 'vitest';
import {
  addSuggestionSignal,
  createCompactSuggestedRef,
  decodeSuggestionSignals,
  encodeSuggestionSignalFlags,
} from './discoveryCompactCandidate';

describe('discoveryCompactCandidate', () => {
  it('round-trips suggestion signal flags in stable order', () => {
    let ref = createCompactSuggestedRef('n1', 5, 'shared-tag');
    ref = addSuggestionSignal(ref, 10, 'title-similarity');
    ref = addSuggestionSignal(ref, 3, 'common-backlink');
    expect(decodeSuggestionSignals(ref.signalFlags)).toEqual([
      'title-similarity',
      'shared-tag',
      'common-backlink',
    ]);
  });

  it('merges duplicate signal flags without double counting flags', () => {
    const ref = addSuggestionSignal(
      createCompactSuggestedRef('n1', 1, 'shared-area'),
      2,
      'shared-area',
    );
    expect(decodeSuggestionSignals(ref.signalFlags)).toEqual(['shared-area']);
    expect(encodeSuggestionSignalFlags('shared-area')).toBeGreaterThan(0);
  });
});
