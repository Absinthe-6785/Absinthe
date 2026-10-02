import type { WorkoutRangePreviewRead } from '../health/useHealthWorkoutRangeSnapshot';
import type { SearchResultItem } from './searchProjectionModels';

type PreviewProof = Readonly<{
  accountId: string;
  localDate: string;
  read: WorkoutRangePreviewRead;
  capability: 'read_only';
}>;
export type SearchWorkoutPreviewEvidence = PreviewProof & (
  | Readonly<{ source: 'legacy'; rowId: string }>
  | Readonly<{ source: 'canonical'; namespaceKey: string; generationId: string;
    sessionId: string; entryId: string }>
);
export type SearchWorkoutPreviewProjection = Readonly<{
  localDate: string;
  state: 'loading' | 'unavailable' | 'isolation_error' | 'source_error'
    | 'partial' | 'verified_no_match' | 'matches';
  legacyMatches: number;
  canonicalMatches: number;
  legacyStatus: 'success' | 'error' | 'unavailable';
  canonicalStatus: 'success' | 'error' | 'unavailable';
  results: readonly SearchResultItem[];
}>;

/** Pure name-only technical observations. Catalog definitions are a separate dataset. */
export function buildSearchWorkoutPreview(
  query: string, read: WorkoutRangePreviewRead,
): SearchWorkoutPreviewProjection {
  const localDate = read.scope.localDate;
  const base = { localDate, legacyMatches: 0, canonicalMatches: 0, results: [],
    legacyStatus: 'unavailable' as const, canonicalStatus: 'unavailable' as const };
  if (!read.scope.isCurrent()) return { ...base, state: 'unavailable' };
  if (read.phase === 'loading') return { ...base, state: 'loading' };
  if (read.isolationError) return { ...base, state: 'isolation_error' };
  if (read.publication && !read.isCurrent()) return { ...base, state: 'unavailable' };
  if (!read.view || !read.publication) return { ...base, state: 'unavailable' };
  const view = read.view;
  if (view.result.status === 'error') return { ...base, state: 'source_error', legacyStatus: 'error', canonicalStatus: 'error' };
  const q = query.trim().toLocaleLowerCase();
  const results: SearchResultItem[] = [];
  const add = (name: string, identity: readonly string[], evidence: SearchWorkoutPreviewEvidence) => {
    const lowered = name.toLocaleLowerCase();
    if (!q || !lowered.includes(q)) return;
    results.push({
      id: `workout-preview:${JSON.stringify(identity)}`,
      domain: 'health', kind: 'workout-observation', title: name,
      subtitle: `${localDate} · ${evidence.source} · read-only diagnostic`,
      score: lowered === q ? 0 : lowered.startsWith(q) ? 1 : 2,
      workoutPreview: evidence,
    });
  };
  for (const record of view.result.records) {
    if (record.localDate !== localDate) continue;
    if (record.source === 'legacy') {
      const row = record.legacy;
      const name = row.exerciseDisplay.kind === 'current_catalog'
        ? row.exerciseDisplay.block.name : row.exerciseDisplay.name;
      add(name, ['legacy', row.accountId, row.rowId], {
        accountId: row.accountId, localDate, read, capability: 'read_only',
        source: 'legacy', rowId: row.rowId,
      });
    } else {
      const row = record.canonical;
      for (const entry of row.session.entries) {
        add(entry.exercise.name, ['canonical', row.accountId, row.namespaceKey,
          row.generationId, row.entityId.toLowerCase(), entry.id.toLowerCase()], {
          accountId: row.accountId, localDate, read, capability: 'read_only',
          source: 'canonical', namespaceKey: row.namespaceKey, generationId: row.generationId,
          sessionId: row.entityId, entryId: entry.id,
        });
      }
    }
  }
  // Technical identity tie-break, not performedAt/chronology or content dedupe.
  results.sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    localDate, results,
    legacyStatus: view.result.legacyStatus, canonicalStatus: view.result.canonicalStatus,
    legacyMatches: results.filter(row => row.workoutPreview?.source === 'legacy').length,
    canonicalMatches: results.filter(row => row.workoutPreview?.source === 'canonical').length,
    state: view.result.status === 'partial_data' ? 'partial'
      : results.length ? 'matches' : 'verified_no_match',
  };
}
