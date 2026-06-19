import type { Schedule, Todo, Routine, Workout, WeeklySchedule, ExerciseBlock } from '../../../../types';
import type { Recipe } from '../recipe/recipeTypes';
import type { NoteBase } from '../../noteUtils';
import { displayNoteTitle } from '../../noteDisplayTitle';
import type { SearchResultItem } from './searchProjectionModels';

function matchScore(haystack: string, needle: string): number | null {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return null;
  if (h === n) return 0;
  if (h.startsWith(n)) return 1;
  if (h.includes(n)) return 2;
  return null;
}

function relativeLabel(at: number | undefined, now: Date): string {
  if (!at) return '';
  const diffMs = now.getTime() - at;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${Math.max(diffMin, 1)}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function buildPlannerSearchResults(
  query: string,
  schedules: readonly Schedule[],
  todos: readonly Todo[],
  routines: readonly Routine[],
  weeklySchedules: readonly WeeklySchedule[],
  _now: Date,
): SearchResultItem[] {
  const q = query.trim();
  if (!q) return [];
  const out: SearchResultItem[] = [];

  for (const sch of schedules) {
    const m = matchScore(sch.text, q) ?? matchScore(sch.category, q);
    if (m === null) continue;
    out.push({
      id: `schedule-${sch.id}`,
      domain: 'planner',
      kind: 'schedule',
      title: sch.text,
      subtitle: `${sch.start_time}–${sch.end_time}`,
      categoryLabel: sch.category,
      score: m,
      plannerItemId: sch.id,
    });
  }

  for (const todo of todos) {
    const m = matchScore(todo.text, q);
    if (m === null) continue;
    out.push({
      id: `todo-${todo.id}`,
      domain: 'planner',
      kind: 'todo',
      title: todo.text,
      categoryLabel: todo.done ? 'Done' : 'Todo',
      score: m + 1,
      plannerItemId: todo.id,
    });
  }

  for (const routine of routines) {
    const m = matchScore(routine.text, q);
    if (m === null) continue;
    out.push({
      id: `routine-${routine.id}`,
      domain: 'planner',
      kind: 'routine',
      title: routine.text,
      categoryLabel: 'Routine',
      score: m + 2,
      plannerItemId: routine.id,
    });
  }

  for (const ws of weeklySchedules) {
    const m = matchScore(ws.title, q);
    if (m === null) continue;
    out.push({
      id: `weekly-${ws.id}`,
      domain: 'planner',
      kind: 'weekly-schedule',
      title: ws.title,
      subtitle: `${ws.start_time}–${ws.end_time}`,
      categoryLabel: 'Weekly',
      score: m + 3,
      plannerItemId: ws.id,
    });
  }

  out.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
  return out.slice(0, 12);
}

export function buildHealthSearchResults(
  query: string,
  workouts: readonly Workout[],
  healthBlocks: readonly ExerciseBlock[],
  _now: Date,
): SearchResultItem[] {
  const q = query.trim();
  if (!q) return [];
  const out: SearchResultItem[] = [];

  for (const w of workouts) {
    const name = w.exercise_blocks?.name ?? '';
    const m = matchScore(name, q);
    if (m === null) continue;
    out.push({
      id: `workout-${w.id}`,
      domain: 'health',
      kind: 'workout',
      title: name,
      categoryLabel: w.exercise_blocks?.type ?? 'Workout',
      score: m,
      plannerItemId: w.id,
    });
  }

  for (const block of healthBlocks) {
    const m = matchScore(block.name, q) ?? (block.tags?.some(t => matchScore(t, q) !== null) ? 2 : null);
    if (m === null) continue;
    out.push({
      id: `block-${block.id}`,
      domain: 'health',
      kind: 'exercise-block',
      title: block.name,
      categoryLabel: block.type,
      score: m + 1,
      plannerItemId: block.id,
    });
  }

  out.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
  return out.slice(0, 12);
}

export function buildRecipeSearchResults(
  query: string,
  recipes: readonly Recipe[],
  now: Date,
): SearchResultItem[] {
  const q = query.trim();
  if (!q) return [];
  const out: SearchResultItem[] = [];

  for (const recipe of recipes) {
    const title = recipe.title ?? '';
    const m = matchScore(title, q)
      ?? matchScore(recipe.ingredients ?? '', q)
      ?? matchScore(recipe.category, q)
      ?? matchScore(recipe.memo ?? '', q);
    if (m === null) continue;
    const created = recipe.created_at ? new Date(recipe.created_at).getTime() : undefined;
    out.push({
      id: `recipe-${recipe.id}`,
      domain: 'recipe',
      kind: 'recipe',
      title,
      subtitle: recipe.category,
      categoryLabel: recipe.category,
      relativeDate: relativeLabel(created, now),
      timestamp: created,
      score: m,
      recipeId: recipe.id,
    });
  }

  out.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
  return out.slice(0, 12);
}

export function buildArchiveSearchResults(
  query: string,
  notes: readonly NoteBase[],
  now: Date,
): SearchResultItem[] {
  const q = query.trim();
  if (!q) return [];
  const out: SearchResultItem[] = [];

  for (const note of notes) {
    if (!note.deletedAt) continue;
    const title = displayNoteTitle(note.title);
    const m = matchScore(title, q) ?? matchScore(note.body ?? '', q);
    if (m === null) continue;
    out.push({
      id: `archive-${note.id}`,
      domain: 'archive',
      kind: 'deleted-note',
      title,
      relativeDate: relativeLabel(note.deletedAt, now),
      timestamp: note.deletedAt,
      categoryLabel: 'Deleted',
      score: m,
      noteId: note.id,
    });
  }

  out.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return out.slice(0, 12);
}
