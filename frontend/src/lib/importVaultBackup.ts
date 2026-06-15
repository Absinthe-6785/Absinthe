import type { NoteBase } from '@/components/views/noteUtils';
import { parseNoteMarkdown } from '@/components/views/features/knowledge';
import type { NoteFolder } from '@/store/useNotesStore';
import {
  normalizeVaultBackupManifest,
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

export interface VaultRestoreSelection {
  /** Note ids to include in restore. Empty = none. */
  noteIds: ReadonlySet<string>;
  /** Folder ids to import (folder metadata). Notes filtered by noteIds. */
  folderIds: ReadonlySet<string>;
}

export function createFullRestoreSelection(manifest: VaultBackupManifest): VaultRestoreSelection {
  return {
    noteIds: new Set(manifest.notes.map(n => n.id)),
    folderIds: new Set(manifest.folders.map(f => f.id)),
  };
}

export function filterManifestBySelection(
  manifest: VaultBackupManifest,
  selection: VaultRestoreSelection,
): VaultBackupManifest {
  const notes = manifest.notes.filter(n => selection.noteIds.has(n.id));
  const folderIdsUsed = new Set(notes.map(n => n.folderId).filter(Boolean) as string[]);
  const folders = manifest.folders.filter(
    f => selection.folderIds.has(f.id) && folderIdsUsed.has(f.id),
  );
  return {
    ...manifest,
    noteCount: notes.length,
    folderCount: folders.length,
    relationCount: countRelationsInEntries(notes),
    folders,
    notes,
  };
}

export interface VaultRestoreValidationReport {
  valid: boolean;
  errors: string[];
  noteCount: number;
  folderCount: number;
  relationCount: number;
  conflictCount: number;
  corruptedNoteIds: string[];
  appVersion: string | null;
  schemaVersion: number | null;
  exportedAt: string | null;
}

export interface VaultRestorePreview {
  valid: boolean;
  error?: string;
  manifest: VaultBackupManifest | null;
  validation: VaultRestoreValidationReport | null;
  noteCount: number;
  folderCount: number;
  newNoteCount: number;
  newFolderCount: number;
  conflictCount: number;
  conflictNoteIds: string[];
  relationCount: number;
  exportedAt: string | null;
  appVersion: string | null;
  /** Folder id → display name for selection UI */
  folderOptions: { id: string; name: string; noteCount: number }[];
  /** Note id → title for selection UI */
  noteOptions: { id: string; title: string; folderId: string | null }[];
}

export interface VaultRestoreResult {
  importedNotes: number;
  replacedNotes: number;
  duplicatedNotes: number;
  skippedNotes: number;
  importedFolders: number;
}

function countRelationsInEntries(notes: readonly VaultBackupNoteEntry[]): number {
  let total = 0;
  for (const note of notes) {
    const rel = note.relations ?? {};
    for (const targets of Object.values(rel)) {
      if (Array.isArray(targets)) total += targets.length;
    }
  }
  return total;
}

function activeNotes(notes: readonly NoteBase[]): NoteBase[] {
  return notes.filter(n => !n.deletedAt);
}

export function parseVaultBackupJson(raw: string): VaultBackupManifest | null {
  try {
    const data = JSON.parse(raw) as Partial<VaultBackupManifest>;
    return normalizeVaultBackupManifest(data);
  } catch {
    return null;
  }
}

export function validateVaultBackupManifest(
  manifest: VaultBackupManifest,
  existingNotes: readonly NoteBase[],
  existingFolders: readonly NoteFolder[],
): VaultRestoreValidationReport {
  const errors: string[] = [];
  const corruptedNoteIds: string[] = [];

  if (manifest.schemaVersion > VAULT_BACKUP_SCHEMA_VERSION) {
    errors.push('unsupported_schema');
  }
  if (manifest.app !== 'absinthe') {
    errors.push('invalid_app');
  }
  if (!manifest.exportedAt) {
    errors.push('missing_export_date');
  }

  const folderIds = new Set(manifest.folders.map(f => f.id));
  for (const note of manifest.notes) {
    if (!note.id || !note.title) {
      corruptedNoteIds.push(note.id || 'unknown');
      continue;
    }
    if (note.folderId && !folderIds.has(note.folderId)) {
      // Orphan folder references are allowed — folder metadata may be missing from backup
    }
    try {
      parseNoteMarkdown(note.markdown);
    } catch {
      corruptedNoteIds.push(note.id);
    }
  }

  const existingIds = new Set(activeNotes(existingNotes).map(n => n.id));
  const conflictCount = manifest.notes.filter(n => existingIds.has(n.id)).length;

  return {
    valid: errors.length === 0 && corruptedNoteIds.length === 0,
    errors,
    noteCount: manifest.notes.length,
    folderCount: manifest.folders.length,
    relationCount: countRelationsInEntries(manifest.notes),
    conflictCount,
    corruptedNoteIds,
    appVersion: manifest.appVersion ?? null,
    schemaVersion: manifest.schemaVersion,
    exportedAt: manifest.exportedAt,
  };
}

export function buildVaultRestorePreview(
  manifest: VaultBackupManifest,
  existingNotes: readonly NoteBase[],
  existingFolders: readonly NoteFolder[],
): VaultRestorePreview {
  const validation = validateVaultBackupManifest(manifest, existingNotes, existingFolders);

  if (!validation.valid) {
    return {
      valid: false,
      error: validation.errors[0] ?? 'validation_failed',
      manifest: null,
      validation,
      noteCount: manifest.notes.length,
      folderCount: manifest.folders.length,
      newNoteCount: 0,
      newFolderCount: 0,
      conflictCount: validation.conflictCount,
      conflictNoteIds: [],
      relationCount: validation.relationCount,
      exportedAt: manifest.exportedAt,
      appVersion: manifest.appVersion ?? null,
      folderOptions: [],
      noteOptions: [],
    };
  }

  const existingIds = new Set(activeNotes(existingNotes).map(n => n.id));
  const existingFolderIds = new Set(existingFolders.map(f => f.id));
  const conflictNoteIds = manifest.notes.filter(n => existingIds.has(n.id)).map(n => n.id);

  const folderNoteCounts = new Map<string, number>();
  for (const note of manifest.notes) {
    const fid = note.folderId ?? '__unfiled__';
    folderNoteCounts.set(fid, (folderNoteCounts.get(fid) ?? 0) + 1);
  }

  const folderOptions = [
    ...manifest.folders.map(f => ({
      id: f.id,
      name: f.name,
      noteCount: folderNoteCounts.get(f.id) ?? 0,
    })),
    ...(folderNoteCounts.has('__unfiled__')
      ? [{ id: '__unfiled__', name: '__unfiled__', noteCount: folderNoteCounts.get('__unfiled__')! }]
      : []),
  ];

  return {
    valid: true,
    manifest,
    validation,
    noteCount: manifest.notes.length,
    folderCount: manifest.folders.length,
    newNoteCount: manifest.notes.length - conflictNoteIds.length,
    newFolderCount: manifest.folders.filter(f => !existingFolderIds.has(f.id)).length,
    conflictCount: conflictNoteIds.length,
    conflictNoteIds,
    relationCount: validation.relationCount,
    exportedAt: manifest.exportedAt,
    appVersion: manifest.appVersion ?? null,
    folderOptions,
    noteOptions: manifest.notes.map(n => ({
      id: n.id,
      title: n.title,
      folderId: n.folderId,
    })),
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
