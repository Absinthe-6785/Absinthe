/**
 * DEV-only render diagnostics for K-92A1 before/after comparison.
 */
import { useEffect, useRef } from 'react';

const ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'test';

type Counter = { renders: number; rerenders: number };

const counters = new Map<string, Counter>();

function getCounter(label: string): Counter {
  let c = counters.get(label);
  if (!c) {
    c = { renders: 0, rerenders: 0 };
    counters.set(label, c);
  }
  return c;
}

/** Count mount + update renders for a component label (DEV/test only). */
export function useRenderDiagnostic(label: string): void {
  const mountedRef = useRef(false);

  if (ENABLED) {
    const c = getCounter(label);
    c.renders += 1;
    if (mountedRef.current) c.rerenders += 1;
  }

  useEffect(() => {
    mountedRef.current = true;
  });
}

export function getRenderDiagnostics(): Record<string, Counter> {
  return Object.fromEntries(counters.entries());
}

export function resetRenderDiagnostics(): void {
  counters.clear();
}

export function logRenderDiagnostics(prefix = '[K-92A1 render]'): void {
  if (!ENABLED) return;
  const rows = Object.entries(getRenderDiagnostics())
    .map(([label, c]) => `${label}: renders=${c.renders} rerenders=${c.rerenders}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.log(`${prefix}\n${rows}`);
}
