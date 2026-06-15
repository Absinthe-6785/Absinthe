import type { NoteBase } from '@/components/views/noteUtils';
import { parseNoteMarkdown } from '@/components/views/features/knowledge';
import type { NoteFolder } from '@/store/useNotesStore';
import {
  VAULT_BACKUP_SCHEMA_VERSION,
  type VaultBackupManifest,
  type VaultBackupNoteEntry,
} from './exportVaultBackup';

export type VaultRestoreConflictStrategy = 'skip' | 'replace' | 'duplicate';

export const VAULT_RESTORE_CONFLICT_DOC = `
When an imported note id already exists in the vault:
- skip: keep the local note unchanged
- replace: overwrite the local note with backup content and metadata
- duplicate: import as a new note with a fresh id (title unchanged)
`;

export interface VaultRestorePreview {
  valid: boolean;
  error?: string;
  manifest: VaultBackupManifest | null;
  noteCount: number;
  folderCount: number;
  newNoteCount: number;
  newFolderCount: number;
  conflictCount: number;
  conflictNoteIds: string[];
  exportedAt: string | null;
}

export interface VaultRestoreResult {
  importedNotes: number;
  replacedNotes: number;
  duplicatedNotes: number;
  skippedNotes: number;
  importedFolders: number;
}

export function parseVaultBackupJson(raw: string): VaultBackupManifest | null {
  try {
    const data = JSON.parse(raw) as Partial<VaultBackupManifest>;
    if (data.app !== 'absinthe') return null;
    if (typeof data.schemaVersion !== 'number') return null;
    if (!Array.isArray(data.folders) || !Array.isArray(data.notes)) return null;
    if (typeof data.exportedAt !== 'string') return null;
    return {
      schemaVersion: data.schemaVersion,
      exportedAt: data.exportedAt,
      app: 'absinthe',
      folders: data.folders.map(f => ({
        id: String(f.id),
        name: String(f.name ?? ''),
        createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
      })),
      notes: data.notes.map(n => ({
        id: String(n.id),
        title: String(n.title ?? ''),
        folderId: n.folderId ?? null,
        starred: Boolean(n.starred),
        createdAt: typeof n.createdAt === 'number' ? n.createdAt : undefined,
        updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
        markdown: String(n.markdown ?? ''),
        properties: (n.properties ?? {}) as NoteBase['properties'],
        relations: (n.relations ?? {}) as NoteBase['relations'],
      })),
    };
  } catch {
    return null;
  }
}

function activeNotes(notes: readonly NoteBase[]): NoteBase[] {
  return notes.filter(n => !n.deletedAt);
}

export function buildVaultRestorePreview(
  manifest: VaultBackupManifest,
  existingNotes: readonly NoteBase[],
  existingFolders: readonly NoteFolder[],
): VaultRestorePreview {
  if (manifest.schemaVersion > VAULT_BACKUP_SCHEMA_VERSION) {
    return {
      valid: false,
      error: 'unsupported_schema',
      manifest: null,
      noteCount: 0,
      folderCount: 0,
      newNoteCount: 0,
      newFolderCount: 0,
      conflictCount: 0,
      conflictNoteIds: [],
      exportedAt: manifest.exportedAt,
    };
  }

  const existingIds = new Set(activeNotes(existingNotes).map(n => n.id));
  const existingFolderIds = new Set(existingFolders.map(f => f.id));
  const conflictNoteIds = manifest.notes.filter(n => existingIds.has(n.id)).map(n => n.id);

  return {
    valid: true,
    manifest,
    noteCount: manifest.notes.length,
    folderCount: manifest.folders.length,
    newNoteCount: manifest.notes.length - conflictNoteIds.length,
    newFolderCount: manifest.folders.filter(f => !existingFolderIds.has(f.id)).length,
    conflictCount: conflictNoteIds.length,
    conflictNoteIds,
    exportedAt: manifest.exportedAt,
  };
}

export function backupEntryToNote(entry: VaultBackupNoteEntry, idOverride?: string): NoteBase {
  const parsed = parseNoteMarkdown(entry.markdown);
  const properties = {
    ...(parsed.properties ?? {}),
    ...(entry.properties ?? {}),
  };
  const relations = Object.keys(parsed.relations ?? {}).length > 0
    ? parsed.relations
    : entry.relations;

  return {
    id: idOverride ?? entry.id,
    title: entry.title,
    body: parsed.body,
    folderId: entry.folderId,
    starred: entry.starred,
    createdAt: entry.createdAt ?? entry.updatedAt,
    updatedAt: entry.updatedAt,
    deletedAt: null,
    properties: Object.keys(properties).length > 0 ? properties : undefined,
    relations: relations && Object.keys(relations).length > 0 ? relations : undefined,
  };
}

function newDuplicateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function applyVaultRestore(
  manifest: VaultBackupManifest,
  existingNotes: readonly NoteBase[],
  existingFolders: readonly NoteFolder[],
  strategy: VaultRestoreConflictStrategy,
): { notes: NoteBase[]; folders: NoteFolder[]; result: VaultRestoreResult } {
  const result: VaultRestoreResult = {
    importedNotes: 0,
    replacedNotes: 0,
    duplicatedNotes: 0,
    skippedNotes: 0,
    importedFolders: 0,
  };

  const notes = [...existingNotes];
  const folders = [...existingFolders];
  const noteById = new Map(notes.map(n => [n.id, n]));
  const folderIds = new Set(folders.map(f => f.id));

  for (const folder of manifest.folders) {
    if (!folderIds.has(folder.id)) {
      folders.push({ ...folder });
      folderIds.add(folder.id);
      result.importedFolders += 1;
    }
  }

  const toPrepend: NoteBase[] = [];

  for (const entry of manifest.notes) {
    const existing = noteById.get(entry.id);
    const isActiveConflict = existing && !existing.deletedAt;

    if (isActiveConflict) {
      if (strategy === 'skip') {
        result.skippedNotes += 1;
        continue;
      }
      if (strategy === 'replace') {
        const restored = backupEntryToNote(entry);
        const idx = notes.findIndex(n => n.id === entry.id);
        if (idx >= 0) {
          notes[idx] = { ...restored, id: entry.id };
          noteById.set(entry.id, notes[idx]!);
          result.replacedNotes += 1;
        }
        continue;
      }
      const dup = backupEntryToNote(entry, newDuplicateId());
      toPrepend.push(dup);
      noteById.set(dup.id, dup);
      result.duplicatedNotes += 1;
      continue;
    }

    const restored = backupEntryToNote(entry);
    if (existing?.deletedAt) {
      const idx = notes.findIndex(n => n.id === entry.id);
      if (idx >= 0) {
        notes[idx] = restored;
        noteById.set(entry.id, restored);
      } else {
        toPrepend.push(restored);
        noteById.set(entry.id, restored);
      }
    } else {
      toPrepend.push(restored);
      noteById.set(entry.id, restored);
    }
    result.importedNotes += 1;
  }

  return { notes: [...toPrepend, ...notes], folders, result };
}
