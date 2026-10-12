import type { LegacyImpact } from './legacyPreviousCurrentness';

type Mutation = Readonly<{ token: object; accountId: string; impact: LegacyImpact }>;
type Listener = (phase: 'begin' | 'end', mutation: Mutation) => void;
const active = new Set<Mutation>();
const listeners = new Set<Listener>();

/** Same-JS-context coverage, not a durable or cross-device epoch. No readers when OFF. */
export function subscribeLegacyWorkoutMutations(listener: Listener): () => void {
  listeners.add(listener);
  for (const mutation of active) listener('begin', mutation);
  return () => { listeners.delete(listener); };
}
export function beginLegacyWorkoutMutation(accountId: string, impact: LegacyImpact): () => void {
  const mutation = { token: {}, accountId, impact };
  active.add(mutation);
  for (const listener of listeners) listener('begin', mutation);
  return () => {
    if (!active.delete(mutation)) return;
    for (const listener of listeners) listener('end', mutation);
  };
}
