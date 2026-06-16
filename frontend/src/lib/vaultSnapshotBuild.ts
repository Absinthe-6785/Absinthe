import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import {
  ABSINTHE_APP_VERSION,
  VAULT_SNAPSHOT_KIND,
  VAULT_SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_SCOPE_DOC,
  type VaultSnapshotSlot,
} from './vaultSnapshotConstants';
import { buildVaultBackupManifest, type VaultBackupManifest } from './exportVaultBackup';
import {
  collectVaultSnapshotExtensions,
  type VaultSnapshotExtensions,
} from './vaultSnapshotScope';
import { fingerprintPortableVaultContent } from './vaultSnapshotFingerprint';

export interface VaultSnapshotScopeSummary {
  included: string[];
  excluded: string[];
  manifestDoc: string;
}

export interface VaultSnapshot {
  snapshotSchemaVersion: typeof VAULT_SNAPSHOT_SCHEMA_VERSION;
  kind: typeof VAULT_SNAPSHOT_KIND;
  snapshotId: string;
  slot: VaultSnapshotSlot;
  slotKey: string;
  createdAt: string;
  contentFingerprint: string;
  appVersion: string;
  vault: VaultBackupManifest;
  extensions: VaultSnapshotExtensions;
  scope: VaultSnapshotScopeSummary;
}

const INCLUDED_SCOPE = [
  'notes',
  'blocks',
  'tags',
  'favorites',
  'classifications',
  'weak-topics',
  'relations',
  'wiki-links',
  'folders',
  'app-settings',
  'saved-views',
  'rule-collections',
  'database-views',
  'knowledge-history',
  'focus-presets',
  'workspace-preferences',
  'health-local',
] as const;

const EXCLUDED_SCOPE = [
  'knowledge-index',
  'graph-layouts',
  'search-caches',
  'cosmos-caches',
  'session-navigation',
  'workspace-session-ui',
  'snapshot-payloads',
] as const;

function newSnapshotId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildVaultSnapshot(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  slot: VaultSnapshotSlot,
  slotKey: string,
): VaultSnapshot {
  const vault = buildVaultBackupManifest(notes, folders);
  const extensions = collectVaultSnapshotExtensions();
  const contentFingerprint = fingerprintPortableVaultContent({
    notes: vault.notes,
    folders: vault.folders,
    extensions,
  });

  return {
    snapshotSchemaVersion: VAULT_SNAPSHOT_SCHEMA_VERSION,
    kind: VAULT_SNAPSHOT_KIND,
    snapshotId: newSnapshotId(),
    slot,
    slotKey,
    createdAt: new Date().toISOString(),
    contentFingerprint,
    appVersion: ABSINTHE_APP_VERSION,
    vault,
    extensions,
    scope: {
      included: [...INCLUDED_SCOPE],
      excluded: [...EXCLUDED_SCOPE],
      manifestDoc: SNAPSHOT_SCOPE_DOC.trim(),
    },
  };
}

/** Extract restore-ready vault manifest for future restore UI. */
export function toRestoreReadyManifest(snapshot: VaultSnapshot): VaultBackupManifest {
  return snapshot.vault;
}

export function serializeVaultSnapshot(snapshot: VaultSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseVaultSnapshotJson(raw: string): VaultSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<VaultSnapshot>;
    if (parsed.kind !== VAULT_SNAPSHOT_KIND) return null;
    if (parsed.snapshotSchemaVersion !== VAULT_SNAPSHOT_SCHEMA_VERSION) return null;
    if (!parsed.vault || !parsed.extensions || !parsed.snapshotId) return null;
    return parsed as VaultSnapshot;
  } catch {
    return null;
  }
}
