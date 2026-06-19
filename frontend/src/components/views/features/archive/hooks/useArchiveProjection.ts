import { useMemo } from 'react';
import type { Language } from '../../../../../lib/i18n';
import { resolveIntlLocale } from '../../../../../lib/i18n';
import { useNotesStore } from '../../../../../store/useNotesStore';
import { enumerateVaultSnapshots } from '@/lib/vaultSnapshotStore';
import {
  buildArchiveProjection,
  type ArchiveProjection,
} from '../../knowledge/archive';
import { useArchiveDomainMarks } from './useArchiveDomainMarks';
import { readArchiveRestoreRecents } from '../../knowledge/archive/archiveRestoreRecents';

export interface UseArchiveProjectionResult {
  projection: ArchiveProjection;
  isLoading: boolean;
  error: unknown;
}

/**
 * K-109 — unified Archive projection hook (history + trash + snapshots + timeline).
 */
export function useArchiveProjection(
  now: Date,
  language?: Language | null,
): UseArchiveProjectionResult {
  const vaultStructureVersion = useNotesStore(s => s.vaultStructureVersion);
  const canUndoRestore = useNotesStore(s => s.vaultRestoreCanUndo);
  const { data: domainMarks, isLoading, error } = useArchiveDomainMarks();
  const locale = resolveIntlLocale(language);

  const projection = useMemo(
    () => buildArchiveProjection({
      notes: useNotesStore.getState().notes,
      now,
      domainMarks: domainMarks ?? [],
      snapshots: enumerateVaultSnapshots(),
      restoreRecents: readArchiveRestoreRecents(),
      canUndoRestore,
      options: { locale },
    }),
    [vaultStructureVersion, canUndoRestore, now, domainMarks, locale],
  );

  return { projection, isLoading, error };
}

/** Test helper — mirrors hook without React. */
export function buildArchiveProjectionForHook(
  notes: Parameters<typeof buildArchiveProjection>[0]['notes'],
  now: Date,
  domainMarks: Parameters<typeof buildArchiveProjection>[0]['domainMarks'],
  language?: Language | null,
): ArchiveProjection {
  return buildArchiveProjection({
    notes,
    now,
    domainMarks: domainMarks ?? [],
    snapshots: enumerateVaultSnapshots(),
    restoreRecents: readArchiveRestoreRecents(),
    options: { locale: resolveIntlLocale(language) },
  });
}
