export const COUNTDOWN_REVIEWED_CHANGED = 'absinthe:countdown-reviewed-changed';

function dispatchReviewedChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COUNTDOWN_REVIEWED_CHANGED));
  }
}
