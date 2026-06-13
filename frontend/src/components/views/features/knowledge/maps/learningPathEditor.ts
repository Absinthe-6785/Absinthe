import type { NoteBase } from '../../../noteUtils';
import {
  LEARNING_PATH_PROPERTY,
  LEARNING_PATH_STEP_PROPERTY,
  buildLearningPath,
  getLearningPathId,
  getLearningPathStep,
  setLearningPathStep,
  clearLearningPath,
  listLearningPathIds,
  type LearningPath,
} from '../maps/subjectDashboards';

export function slugifyLearningPathId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^\w\uAC00-\uD7A3\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'learning-path';
}

export function formatLearningPathLabel(pathId: string): string {
  return pathId.replace(/-/g, ' ');
}

export function learningPathIdExists(notes: readonly NoteBase[], pathId: string): boolean {
  return listLearningPathIds(notes).includes(pathId.trim());
}

export function collectNotesInLearningPath(
  notes: readonly NoteBase[],
  pathId: string,
): NoteBase[] {
  const slug = pathId.trim();
  return notes.filter(n => !n.deletedAt && getLearningPathId(n) === slug);
}

/** Property patches for renaming a path across all member notes. */
export function buildLearningPathRenamePatches(
  notes: readonly NoteBase[],
  oldPathId: string,
  newPathId: string,
): ReadonlyMap<string, Record<string, string>> {
  const nextId = newPathId.trim();
  const patches = new Map<string, Record<string, string>>();
  if (!nextId || nextId === oldPathId.trim()) return patches;

  for (const note of collectNotesInLearningPath(notes, oldPathId)) {
    const props = { ...(note.properties ?? {}) };
    props[LEARNING_PATH_PROPERTY] = nextId;
    patches.set(note.id, props);
  }
  return patches;
}

/** Renumber steps sequentially starting at 1. */
export function buildLearningPathNormalizePatches(
  notes: readonly NoteBase[],
  pathId: string,
): ReadonlyMap<string, Record<string, string>> {
  const path = buildLearningPath(notes, pathId);
  const patches = new Map<string, Record<string, string>>();
  if (!path) return patches;

  path.steps.forEach((step, index) => {
    const note = notes.find(n => n.id === step.noteId);
    if (!note) return;
    const props = { ...(note.properties ?? {}) };
    props[LEARNING_PATH_PROPERTY] = pathId.trim();
    props[LEARNING_PATH_STEP_PROPERTY] = String(index + 1);
    patches.set(note.id, props);
  });
  return patches;
}

export function buildLearningPathMovePatches(
  notes: readonly NoteBase[],
  pathId: string,
  noteId: string,
  direction: 'up' | 'down',
): ReadonlyMap<string, Record<string, string>> {
  const path = buildLearningPath(notes, pathId);
  const patches = new Map<string, Record<string, string>>();
  if (!path) return patches;

  const index = path.steps.findIndex(s => s.noteId === noteId);
  if (index < 0) return patches;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= path.steps.length) return patches;

  const current = path.steps[index]!;
  const target = path.steps[targetIndex]!;
  const currentNote = notes.find(n => n.id === current.noteId);
  const targetNote = notes.find(n => n.id === target.noteId);
  if (!currentNote || !targetNote) return patches;

  const currentStep = getLearningPathStep(currentNote) ?? index + 1;
  const targetStep = getLearningPathStep(targetNote) ?? targetIndex + 1;

  patches.set(currentNote.id, {
    ...(currentNote.properties ?? {}),
    [LEARNING_PATH_PROPERTY]: pathId.trim(),
    [LEARNING_PATH_STEP_PROPERTY]: String(targetStep),
  });
  patches.set(targetNote.id, {
    ...(targetNote.properties ?? {}),
    [LEARNING_PATH_PROPERTY]: pathId.trim(),
    [LEARNING_PATH_STEP_PROPERTY]: String(currentStep),
  });
  return patches;
}

export function buildAddNoteToLearningPathProperties(
  note: NoteBase,
  pathId: string,
  step: number,
): Record<string, string> {
  return setLearningPathStep(note, pathId, step).properties ?? {};
}

export function buildRemoveNoteFromLearningPathProperties(
  note: NoteBase,
): Record<string, string> {
  return clearLearningPath(note).properties ?? {};
}

export function nextLearningPathStep(notes: readonly NoteBase[], pathId: string): number {
  const path = buildLearningPath(notes, pathId);
  if (!path || path.steps.length === 0) return 1;
  const max = path.steps.reduce((m, s) => Math.max(m, s.step), 0);
  return max + 1;
}

export function buildLearningPathEditorModel(
  notes: readonly NoteBase[],
  pathId: string,
): LearningPath | null {
  return buildLearningPath(notes, pathId);
}

export {
  listLearningPathIds,
  formatLearningPathLabel as learningPathLabelFromId,
};
