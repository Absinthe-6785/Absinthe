/**
 * K-97F — Onboarding marker: welcome notes only on first vault setup, never on empty vault.
 */
export const NOTES_SEEDED_KEY = 'notes-seeded-v1';

export function isNotesOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(NOTES_SEEDED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markNotesOnboardingComplete(): void {
  try {
    localStorage.setItem(NOTES_SEEDED_KEY, '1');
  } catch { /**/ }
}

export function clearNotesOnboardingMarker(): void {
  try {
    localStorage.removeItem(NOTES_SEEDED_KEY);
  } catch { /**/ }
}

/** True only when starter notes should be created (first setup, marker absent). */
export function shouldSeedOnboardingNotes(): boolean {
  return !isNotesOnboardingComplete();
}
