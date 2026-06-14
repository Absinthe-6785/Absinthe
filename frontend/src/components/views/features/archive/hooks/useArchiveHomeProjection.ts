import { useMemo } from 'react';
import type { Language } from '../../../../../lib/i18n';
import { resolveIntlLocale } from '../../../../../lib/i18n';
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
export function useArchiveHomeProjection(
  now: Date,
  language?: Language | null,
): UseArchiveHomeProjectionResult {
  const notes = useNotesStore(state => state.notes);
  const { data: domainMarks, isLoading, error } = useArchiveDomainMarks();
  const locale = resolveIntlLocale(language);

  const projection = useMemo(
    () => buildArchiveHomeProjection({
      notes,
      now,
      domainMarks: domainMarks ?? [],
      options: { locale },
    }),
    [notes, now, domainMarks, locale],
  );

  return { projection, isLoading, error };
}

/** Pure helper for tests — mirrors hook composition without React stores. */
export function buildArchiveHomeProjectionForHook(
  notes: Parameters<typeof buildArchiveHomeProjection>[0]['notes'],
  now: Date,
  domainMarks: Parameters<typeof buildArchiveHomeProjection>[0]['domainMarks'],
  language?: Language | null,
): ArchiveHomeProjection {
  return buildArchiveHomeProjection({
    notes,
    now,
    domainMarks: domainMarks ?? [],
    options: { locale: resolveIntlLocale(language) },
  });
}
