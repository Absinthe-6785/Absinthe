/**
 * Temporary K-83 memory audit diagnostics.
 * Remove after Render OOM investigation completes.
 */

export interface MemAuditPayload {
  source: string;
  notes?: number;
  links?: number;
  graphNodes?: number;
  graphEdges?: number;
  relatedCandidates?: number;
  discoveryItems?: number;
  [key: string]: string | number | boolean | undefined;
}

export function logMemAudit(payload: MemAuditPayload): void {
  const { source, notes, links, graphNodes, graphEdges, relatedCandidates, discoveryItems, ...extra } = payload;
  console.info('[MEM-AUDIT]', {
    source,
    notes,
    links,
    graphNodes,
    graphEdges,
    relatedCandidates,
    discoveryItems,
    ...extra,
  });
}

/** Throttle high-frequency paths (e.g. index update on every keystroke). */
export function createMemAuditThrottle(ms: number): (payload: MemAuditPayload) => void {
  let last = 0;
  return (payload) => {
    const now = Date.now();
    if (now - last < ms) return;
    last = now;
    logMemAudit(payload);
  };
}
