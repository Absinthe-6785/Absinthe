import type { NoteBase } from '@/components/views/noteUtils';
import { serializeNoteMarkdown } from '@/components/views/features/knowledge';
import type { NoteFolder } from '@/store/useNotesStore';
import type { VaultBackupCloudBlock } from './vaultCloudExport';
import {
  ABSINTHE_APP_VERSION,
  VAULT_BACKUP_SCHEMA_VERSION,
  VAULT_BACKUP_FORMATS_DOC,
  VAULT_EXPORT_KIND,
  VAULT_SCOPE_DOC,
} from './vaultBackupConstants';
import {
  createLocalBackupManifestExportDiagnostic,
  type LocalBackupManifestExportDiagnosticResult,
} from './localBackupManifestExportDiagnostic';
import type { VaultPortableExtensions } from './vaultPortableExtensions';
import {
  PORTABLE_VAULT_EXCLUDED,
  PORTABLE_VAULT_INCLUDED,
  collectPortableVaultExtensions,
} from './vaultPortableExtensions';
import { fingerprintJson } from './vaultSnapshotFingerprint';
import { noteToBackupEntry, migrateVaultBackupManifest } from './vaultBackupCompatibility';

export {
  ABSINTHE_APP_VERSION,
  VAULT_BACKUP_SCHEMA_VERSION,
  VAULT_BACKUP_FORMATS_DOC,
  VAULT_EXPORT_KIND,
};

export interface VaultBackupNoteEntry {
  id: string;
  title: string;
  folderId: string | null;
  starred: boolean;
  createdAt?: number;
  updatedAt: number;
  markdown: string;
  properties: NoteBase['properties'];
  relations: NoteBase['relations'];
}

export interface VaultBackupScope {
  included: readonly string[];
  excluded: readonly string[];
  cloudGaps: string[];
  manifestDoc: string;
}

export interface VaultBackupManifest {
  schemaVersion: number;
  kind?: typeof VAULT_EXPORT_KIND;
  exportedAt: string;
  app: 'absinthe';
  appVersion: string;
  noteCount: number;
  folderCount: number;
  relationCount: number;
  folders: NoteFolder[];
  notes: VaultBackupNoteEntry[];
  extensions?: VaultPortableExtensions;
  scope?: VaultBackupScope;
  contentFingerprint?: string;
  cloud?: VaultBackupCloudBlock;
}

function countRelations(notes: readonly VaultBackupNoteEntry[]): number {
  let total = 0;
  for (const note of notes) {
    const rel = note.relations ?? {};
    for (const targets of Object.values(rel)) {
      if (Array.isArray(targets)) total += targets.length;
    }
  }
  return total;
}

function buildScope(cloud?: VaultBackupCloudBlock | null): VaultBackupScope {
  const cloudGaps: string[] = [];
  if (!cloud) {
    cloudGaps.push('cloud:block-not-included');
  } else if (cloud.completeness === 'skipped') {
    cloudGaps.push('cloud:skipped-not-authenticated');
  } else if (cloud.completeness === 'partial') {
    cloudGaps.push(...cloud.errors.map(e => `cloud:partial:${e}`));
  }
  if (cloud && cloud.completeness !== 'skipped') {
    cloudGaps.push('cloud:protein-intake-daily-logs-not-exported');
  }
  return {
    included: [...PORTABLE_VAULT_INCLUDED],
    excluded: [...PORTABLE_VAULT_EXCLUDED],
    cloudGaps,
    manifestDoc: VAULT_SCOPE_DOC.trim(),
  };
}

export function isVaultBackupManifestV3(manifest: VaultBackupManifest): boolean {
  return manifest.schemaVersion >= 3 || manifest.kind === VAULT_EXPORT_KIND;
}

export function runVaultBackupManifestExportDiagnostic(
  manifest: VaultBackupManifest,
): LocalBackupManifestExportDiagnosticResult {
  return createLocalBackupManifestExportDiagnostic({ vaultManifest: manifest });
}

export function buildVaultBackupManifestV3(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  cloud?: VaultBackupCloudBlock | null,
  extensions: VaultPortableExtensions = collectPortableVaultExtensions(),
): VaultBackupManifest {
  const active = notes.filter(n => !n.deletedAt);
  const entries: VaultBackupNoteEntry[] = active.map(noteToBackupEntry);

  const scope = buildScope(cloud);
  const fingerprintSource = {
    notes: entries,
    folders: [...folders],
    extensions,
    cloud: cloud ?? null,
  };

  const manifest: VaultBackupManifest = {
    schemaVersion: VAULT_BACKUP_SCHEMA_VERSION,
    kind: VAULT_EXPORT_KIND,
    exportedAt: new Date().toISOString(),
    app: 'absinthe',
    appVersion: ABSINTHE_APP_VERSION,
    noteCount: entries.length,
    folderCount: folders.length,
    relationCount: countRelations(entries),
    folders: [...folders],
    notes: entries,
    extensions,
    scope,
    contentFingerprint: fingerprintJson(fingerprintSource),
  };

  if (cloud) manifest.cloud = cloud;
  runVaultBackupManifestExportDiagnostic(manifest);
  return manifest;
}

/** Build v3 manifest with local extensions (no cloud fetch). */
export function buildVaultBackupManifest(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): VaultBackupManifest {
  return buildVaultBackupManifestV3(notes, folders, null);
}

export function downloadVaultBackup(manifest: VaultBackupManifest): void {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const date = manifest.exportedAt.slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `absinthe-vault-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeExtensions(raw: unknown): VaultPortableExtensions | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ext = raw as Partial<VaultPortableExtensions>;
  if (!ext.knowledge || !ext.health) return undefined;
  return ext as VaultPortableExtensions;
}

function normalizeCloud(raw: unknown): VaultBackupCloudBlock | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const cloud = raw as Partial<VaultBackupCloudBlock>;
  if (typeof cloud.schemaVersion !== 'number') return undefined;
  return cloud as VaultBackupCloudBlock;
}

/** Normalize manifest from older backups (schema v1/v2) and v3. */
export function normalizeVaultBackupManifest(
  raw: Partial<VaultBackupManifest>,
): VaultBackupManifest | null {
  if (raw.app !== 'absinthe') return null;
  if (typeof raw.schemaVersion !== 'number') return null;
  if (!Array.isArray(raw.folders) || !Array.isArray(raw.notes)) return null;
  if (typeof raw.exportedAt !== 'string') return null;

  const notes: VaultBackupNoteEntry[] = raw.notes.map(n => ({
    id: String(n.id),
    title: String(n.title ?? ''),
    folderId: n.folderId ?? null,
    starred: Boolean(n.starred),
    createdAt: typeof n.createdAt === 'number' ? n.createdAt : undefined,
    updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
    markdown: String(n.markdown ?? ''),
    properties: (n.properties ?? {}) as NoteBase['properties'],
    relations: (n.relations ?? {}) as NoteBase['relations'],
  }));

  const manifest: VaultBackupManifest = {
    schemaVersion: raw.schemaVersion,
    exportedAt: raw.exportedAt,
    app: 'absinthe',
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : 'unknown',
    noteCount: typeof raw.noteCount === 'number' ? raw.noteCount : notes.length,
    folderCount: typeof raw.folderCount === 'number' ? raw.folderCount : raw.folders.length,
    relationCount: typeof raw.relationCount === 'number' ? raw.relationCount : countRelations(notes),
    folders: raw.folders.map(f => ({
      id: String(f.id),
      name: String(f.name ?? ''),
      createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
    })),
    notes,
  };

  if (raw.kind === VAULT_EXPORT_KIND) manifest.kind = VAULT_EXPORT_KIND;
  const extensions = normalizeExtensions(raw.extensions);
  if (extensions) manifest.extensions = extensions;
  if (raw.scope && typeof raw.scope === 'object') manifest.scope = raw.scope as VaultBackupScope;
  if (typeof raw.contentFingerprint === 'string') manifest.contentFingerprint = raw.contentFingerprint;
  const cloud = normalizeCloud(raw.cloud);
  if (cloud) manifest.cloud = cloud;

  return migrateVaultBackupManifest(manifest).manifest;
}

/** Upgrade v2 manifest shape to v3 with empty extensions. */
export function upgradeVaultBackupToV3(manifest: VaultBackupManifest): VaultBackupManifest {
  if (isVaultBackupManifestV3(manifest) && manifest.extensions) return manifest;
  return buildVaultBackupManifestV3(
    manifest.notes.map(n => ({
      id: n.id,
      title: n.title,
      body: n.markdown,
      folderId: n.folderId,
      starred: n.starred,
      deletedAt: null,
      createdAt: n.createdAt ?? n.updatedAt,
      updatedAt: n.updatedAt,
      properties: n.properties,
      relations: n.relations,
    })),
    manifest.folders,
    manifest.cloud ?? null,
    manifest.extensions ?? collectPortableVaultExtensions(),
  );
}
