import { ARCHIVE_PROJECTION_SLICES, buildArchiveProjection } from './features/knowledge/archive';

/** K-109 — ArchiveProjection single-pass audit. */
export { ARCHIVE_PROJECTION_SLICES };

export function auditArchiveProjection(): readonly string[] {
  return ARCHIVE_PROJECTION_SLICES;
}

export function auditArchiveProjectionSinglePass(): boolean {
  const notes = [
    {
      id: 'a',
      title: 'Alpha',
      body: '',
      updatedAt: Date.now(),
      lastOpenedAt: Date.now(),
      folderId: null,
      deletedAt: null,
    },
    {
      id: 'b',
      title: 'Trashed',
      body: '',
      updatedAt: Date.now(),
      folderId: null,
      deletedAt: Date.now() - 1000,
    },
  ];
  const projection = buildArchiveProjection({
    notes,
    now: new Date('2026-06-18T12:00:00'),
    snapshots: [],
    restoreRecents: [],
  });
  return ARCHIVE_PROJECTION_SLICES.every(slice => slice in projection);
}

export function auditArchiveProjectionConsumers(): readonly string[] {
  return [
    'ArchiveUnifiedView.tsx',
    'useArchiveProjection.ts',
    'ArchiveHistorySection.tsx',
    'ArchiveDeletedSection.tsx',
    'ArchiveSnapshotsSection.tsx',
    'ArchiveTimelineSection.tsx',
    'ArchiveRestoreToolsSection.tsx',
  ];
}
