import { useMemo } from 'react';
import { useNotesStore } from '../../../../../store/useNotesStore';
import { buildArchiveHomeProjection } from '../../knowledge/archive';
import type { ArchiveHomeProjection } from '../../knowledge/archive';
import { useArchiveDomainMarks } from './useArchiveDomainMarks';

export interface UseArchiveHomeProjectionResult {
  projection: ArchiveHomeProjection;
  isLoading: boolean;
  error: unknown;
}

/**
 * Thin hook — assembles Archive Home read model from notes vault + domain marks.
 * All business logic lives in buildArchiveHomeProjection.
 */
export function useArchiveHomeProjection(now: Date): UseArchiveHomeProjectionResult {
  const notes = useNotesStore(state => state.notes);
  const { data: domainMarks, isLoading, error } = useArchiveDomainMarks();

  const projection = useMemo(
    () => buildArchiveHomeProjection({
      notes,
      now,
      domainMarks: domainMarks ?? [],
    }),
    [notes, now, domainMarks],
  );

  return { projection, isLoading, error };
}

/** Pure helper for tests — mirrors hook composition without React stores. */
export function buildArchiveHomeProjectionForHook(
  notes: Parameters<typeof buildArchiveHomeProjection>[0]['notes'],
  now: Date,
  domainMarks: Parameters<typeof buildArchiveHomeProjection>[0]['domainMarks'],
): ArchiveHomeProjection {
  return buildArchiveHomeProjection({
    notes,
    now,
    domainMarks: domainMarks ?? [],
  });
}
