import type { SWRConfiguration } from 'swr';

/**
 * Previous history is a bounded range. Keep normal stale-on-remount
 * revalidation so a cached range cannot become permanently authoritative
 * after an included historical workout changes.
 */
export const previousWorkoutSWRConfig = {
  revalidateOnFocus: false,
} satisfies SWRConfiguration;
