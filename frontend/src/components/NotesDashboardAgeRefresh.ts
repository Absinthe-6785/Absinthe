import { createContext } from 'react';

// A Notes-route-only invalidation signal for relative age labels. The shell
// provides it on its existing renders; it does not schedule any clock work.
export const NotesDashboardAgeRefresh = createContext<number | null>(null);
