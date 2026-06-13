import type { NoteBase } from '../../../noteUtils';
import { getProperty, removeProperty, setProperty } from '../properties/noteProperties';

/** Lightweight note kind — stored in properties, no DB redesign. */
export const NOTE_KIND_PROPERTY = 'noteKind';
export const NOTE_KIND_PROMOTED_AT_PROPERTY = 'noteKindPromotedAt';

export type NoteKind = 'source' | 'literature' | 'permanent';

export const NOTE_KINDS: readonly NoteKind[] = ['source', 'literature', 'permanent'];

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  source: 'Source',
  literature: 'Literature',
  permanent: 'Permanent',
};

export const NOTE_KIND_LABELS_KO: Record<NoteKind, string> = {
  source: '출처',
  literature: '문헌',
  permanent: '영구',
};

export function isNoteKind(value: string): value is NoteKind {
  return NOTE_KINDS.includes(value as NoteKind);
}

export function getNoteKind(note: NoteBase): NoteKind | null {
  const raw = getProperty(note, NOTE_KIND_PROPERTY)?.trim().toLowerCase();
  return raw && isNoteKind(raw) ? raw : null;
}

export function setNoteKind(note: NoteBase, kind: NoteKind | null): NoteBase {
  if (!kind) return removeProperty(note, NOTE_KIND_PROPERTY);
  return setProperty(note, NOTE_KIND_PROPERTY, kind);
}

export function filterNotesByKind(notes: readonly NoteBase[], kind: NoteKind): NoteBase[] {
  return notes.filter(n => !n.deletedAt && getNoteKind(n) === kind);
}

/** Workflow step index for visual pipeline (0 = source … 2 = permanent). */
export function noteKindWorkflowStep(kind: NoteKind | null): number {
  if (kind === 'source') return 0;
  if (kind === 'literature') return 1;
  if (kind === 'permanent') return 2;
  return -1;
}

/** Next kind in Source → Literature → Permanent pipeline. */
export function nextNoteKind(kind: NoteKind | null): NoteKind | null {
  if (kind === 'source') return 'literature';
  if (kind === 'literature') return 'permanent';
  return null;
}

export function canPromoteNoteKind(note: NoteBase): boolean {
  return nextNoteKind(getNoteKind(note)) !== null;
}

export function canPromoteKind(kind: NoteKind | null): boolean {
  return nextNoteKind(kind) !== null;
}

export function getNoteKindPromotedAt(note: NoteBase): number | null {
  const raw = getProperty(note, NOTE_KIND_PROMOTED_AT_PROPERTY)?.trim();
  if (!raw) return null;
  const ts = Number(raw);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}

/** One-click promotion with optional timestamp — no automation beyond user action. */
export function promoteNoteKind(note: NoteBase): NoteBase {
  const next = nextNoteKind(getNoteKind(note));
  if (!next) return note;
  let result = setNoteKind(note, next);
  result = setProperty(result, NOTE_KIND_PROMOTED_AT_PROPERTY, String(Date.now()));
  return result;
}

export function promoteNoteKindLabel(kind: NoteKind | null): string | null {
  const next = nextNoteKind(kind);
  if (!next) return null;
  return NOTE_KIND_LABELS_KO[next];
}
