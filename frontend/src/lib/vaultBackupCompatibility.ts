import type { NoteBase } from '@/components/views/noteUtils';
import { normalizeNoteProperties } from '@/components/views/noteUtils';
import { normalizeNoteRelations } from '@/components/views/features/knowledge/relations/relationNormalize';
import { parseNoteMarkdown, serializeNoteMarkdown } from '@/components/views/features/knowledge/properties/noteProperties';
import type { VaultBackupManifest, VaultBackupNoteEntry } from './exportVaultBackup';
import type { NoteFolder } from '@/store/useNotesStore';

export const BACKUP_FALLBACK_TITLE = 'Untitled';

export type VaultBackupNoteIssueCode =
  | 'missing_id'
  | 'missing_title'
  | 'markdown_unparseable'
  | 'legacy_body_field'
  | 'legacy_properties_shape'
  | 'legacy_relations_shape';

export interface VaultBackupNoteIssue {
  noteId: string;
  title: string;
  field: string;
  reason: VaultBackupNoteIssueCode;
  validator: string;
  message: string;
  repaired: boolean;
}

export interface VaultBackupNoteValidation {
  valid: boolean;
  corruptedNoteIds: string[];
  repairedNoteIds: string[];
  issues: VaultBackupNoteIssue[];
}

type LegacyBackupNote = VaultBackupNoteEntry & { body?: string };

export function safeParseNoteMarkdown(raw: string): {
  ok: true;
  body: string;
} | {
  ok: false;
  reason: string;
} {
  try {
    const parsed = parseNoteMarkdown(raw);
    return { ok: true, body: parsed.body };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'markdown_parse_failed',
    };
  }
}

export function deriveBackupNoteTitle(
  title: string | undefined | null,
  markdown: string,
  bodyFallback?: string,
): string {
  const trimmed = (title ?? '').trim();
  if (trimmed) return trimmed;

  const parsed = safeParseNoteMarkdown(markdown);
  const text = parsed.ok ? parsed.body : (bodyFallback ?? markdown);
  const firstLine = text.split('\n').map(line => line.trim()).find(Boolean) ?? '';
  const fromHeading = firstLine.replace(/^#+\s*/, '').trim();
  if (fromHeading) return fromHeading.slice(0, 120);
  return BACKUP_FALLBACK_TITLE;
}

function normalizeBackupProperties(raw: unknown): Record<string, string> {
  return normalizeNoteProperties(raw as Record<string, unknown>) ?? {};
}

function normalizeBackupRelations(raw: unknown): Record<string, string[]> {
  return normalizeNoteRelations(raw) ?? {};
}

function issue(
  noteId: string,
  title: string,
  field: string,
  reason: VaultBackupNoteIssueCode,
  message: string,
  repaired: boolean,
): VaultBackupNoteIssue {
  return {
    noteId,
    title,
    field,
    reason,
    validator: 'vaultBackupCompatibility',
    message,
    repaired,
  };
}

/** Ensure a single backup note entry is restore-safe. */
export function repairVaultBackupNoteEntry(
  raw: LegacyBackupNote,
): { entry: VaultBackupNoteEntry; issues: VaultBackupNoteIssue[] } {
  const issues: VaultBackupNoteIssue[] = [];
  const noteId = String(raw.id ?? '').trim();

  let markdown = String(raw.markdown ?? '');
  if (!markdown.trim() && typeof raw.body === 'string' && raw.body.trim()) {
    markdown = raw.body;
    issues.push(issue(noteId || 'unknown', raw.title ?? '', 'markdown', 'legacy_body_field', 'Promoted legacy body field to markdown', true));
  }

  const parsed = safeParseNoteMarkdown(markdown);
  if (!parsed.ok) {
    issues.push(issue(noteId || 'unknown', raw.title ?? '', 'markdown', 'markdown_unparseable', parsed.reason, true));
    markdown = markdown.trim() ? markdown : '';
  }

  const properties = normalizeBackupProperties(raw.properties);
  if (raw.properties && Object.keys(raw.properties).length > 0 && Object.keys(properties).length === 0) {
    issues.push(issue(noteId || 'unknown', raw.title ?? '', 'properties', 'legacy_properties_shape', 'Normalized legacy properties', true));
  }

  const relations = normalizeBackupRelations(raw.relations);
  if (raw.relations && Object.keys(raw.relations).length > 0 && Object.keys(relations).length === 0) {
    issues.push(issue(noteId || 'unknown', raw.title ?? '', 'relations', 'legacy_relations_shape', 'Normalized legacy relations', true));
  }

  const title = deriveBackupNoteTitle(raw.title, markdown, raw.body);
  if (!(raw.title ?? '').trim() && title) {
    issues.push(issue(noteId || 'unknown', title, 'title', 'missing_title', 'Derived missing title from note content', true));
  }

  const entry: VaultBackupNoteEntry = {
    id: noteId,
    title,
    folderId: raw.folderId ?? null,
    starred: Boolean(raw.starred),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    markdown,
    properties,
    relations,
  };

  return { entry, issues };
}

export function noteToBackupEntry(note: NoteBase): VaultBackupNoteEntry {
  const { entry } = repairVaultBackupNoteEntry({
    id: note.id,
    title: note.title,
    folderId: note.folderId,
    starred: note.starred ?? false,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    markdown: serializeNoteMarkdown(note),
    properties: normalizeBackupProperties(note.properties),
    relations: normalizeBackupRelations(note.relations),
    body: note.body,
  });
  return entry;
}

export function migrateVaultBackupManifest(manifest: VaultBackupManifest): {
  manifest: VaultBackupManifest;
  issues: VaultBackupNoteIssue[];
} {
  const issues: VaultBackupNoteIssue[] = [];
  const notes: VaultBackupNoteEntry[] = [];

  for (const raw of manifest.notes) {
    const repaired = repairVaultBackupNoteEntry(raw as LegacyBackupNote);
    notes.push(repaired.entry);
    issues.push(...repaired.issues);
  }

  logBackupRepairs(issues);

  return {
    manifest: {
      ...manifest,
      notes,
      noteCount: notes.length,
      relationCount: countRelationsInEntries(notes),
    },
    issues,
  };
}

function logBackupRepairs(issues: readonly VaultBackupNoteIssue[]): void {
  if (issues.length === 0) return;
  const repaired = issues.filter(item => item.repaired);
  if (repaired.length === 0) return;
  console.warn(
    `[vault-backup] auto-repaired ${repaired.length} note entr${repaired.length === 1 ? 'y' : 'ies'}`,
    repaired.map(item => ({ id: item.noteId, field: item.field, reason: item.reason })),
  );
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

export function validateVaultBackupNotes(
  notes: readonly VaultBackupNoteEntry[],
): VaultBackupNoteValidation {
  const issues: VaultBackupNoteIssue[] = [];
  const corruptedNoteIds: string[] = [];
  const repairedNoteIds = new Set<string>();

  for (const note of notes) {
    if (!note.id?.trim()) {
      const id = note.id || 'unknown';
      corruptedNoteIds.push(id);
      issues.push(issue(id, note.title ?? '', 'id', 'missing_id', 'Note is missing a stable id', false));
      continue;
    }

    if (!note.title?.trim()) {
      corruptedNoteIds.push(note.id);
      issues.push(issue(note.id, note.title ?? '', 'title', 'missing_title', 'Note is missing a title', false));
      continue;
    }

    const parsed = safeParseNoteMarkdown(note.markdown ?? '');
    if (!parsed.ok) {
      corruptedNoteIds.push(note.id);
      issues.push(issue(note.id, note.title, 'markdown', 'markdown_unparseable', parsed.reason, false));
    }
  }

  for (const item of issues) {
    if (item.repaired) repairedNoteIds.add(item.noteId);
  }

  return {
    valid: corruptedNoteIds.length === 0,
    corruptedNoteIds,
    repairedNoteIds: [...repairedNoteIds],
    issues,
  };
}

export function formatVaultBackupNoteIssues(issues: readonly VaultBackupNoteIssue[]): string {
  return issues.slice(0, 5).map(item => (
    [
      'Restore validation',
      '',
      `Note: ${item.noteId}`,
      `Title: ${item.title || BACKUP_FALLBACK_TITLE}`,
      `Reason: ${item.message}`,
      `Field: ${item.field}`,
      `Validator: ${item.validator}`,
    ].join('\n')
  )).join('\n\n');
}
