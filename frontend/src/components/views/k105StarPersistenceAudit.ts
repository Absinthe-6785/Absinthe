/** K-105 — Star persistence audit surfaces. */
export const K105_STAR_PERSISTENCE_SURFACES = [
  'mergeNotePair-star-or',
  'mergeNotesFromStorageJson',
  'mapDbNote-star-or',
  'noteSyncPayload-starred',
  'toggleStar-persist',
  'vault-backup-starred',
] as const;

export function auditStarPersistence(): readonly string[] {
  return K105_STAR_PERSISTENCE_SURFACES;
}

export function formatK105StarPersistenceReport(surfaces: readonly string[]): string {
  return [
    'K-105 star persistence audit',
    '',
    ...surfaces.map(s => `  ${s}`),
  ].join('\n');
}
