import { isStrengthSet, type StrengthSet, type WorkoutSet } from '../types';

export const ASSISTED_REPS_VALIDATION_ERROR = 'health_assisted_reps_invalid';

type AssistedRepsRecord = Readonly<{ reps?: unknown; assisted_reps?: unknown }>;

export type AssistedRepsBreakdown = Readonly<{
  total: number;
  assisted: number;
  unassisted: number;
}>;

export function supportsAssistedReps(set: WorkoutSet): set is StrengthSet {
  return isStrengthSet(set);
}

function ownsAssistedReps(value: object): boolean {
  return Object.prototype.hasOwnProperty.call(value, 'assisted_reps');
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

/** Property presence owns the optional disclosure, including its empty draft state. */
export function hasAssistedRepsField(value: object): boolean {
  return ownsAssistedReps(value);
}

/** Return a valid assisted split. Invalid or empty draft values do not fabricate a breakdown. */
export function getAssistedRepsBreakdown(set: AssistedRepsRecord): AssistedRepsBreakdown | null {
  if (!ownsAssistedReps(set)) return null;
  const total = integer(set.reps);
  const assisted = integer(set.assisted_reps);
  if (total === null || assisted === null || assisted <= 0 || total < assisted) return null;
  return { total, assisted, unassisted: total - assisted };
}

/** Durable validators accept only a canonical numeric assisted subset. */
export function hasValidDurableAssistedReps(set: AssistedRepsRecord): boolean {
  if (!ownsAssistedReps(set)) return true;
  return typeof set.assisted_reps === 'number' && getAssistedRepsBreakdown(set) !== null;
}

/** Previous-best ordering compares the user's unassisted work while preserving legacy reps. */
export function unassistedRepsForComparison(set: AssistedRepsRecord): number | null {
  if (ownsAssistedReps(set)) return getAssistedRepsBreakdown(set)?.unassisted ?? null;
  const reps = finiteNumber(set.reps);
  return reps !== null && reps > 0 ? reps : null;
}

/** Canonicalize a draft StrengthSet without changing the existing total-reps field. */
export function normalizeAssistedRepsForSave(set: StrengthSet): StrengthSet {
  if (!ownsAssistedReps(set)) return set;

  const rawAssisted = set.assisted_reps;
  const assisted = integer(rawAssisted);
  if (rawAssisted === '' || (typeof rawAssisted === 'string' && rawAssisted.trim() === '') || assisted === 0) {
    const { assisted_reps: _omitted, ...withoutAssistance } = set;
    return withoutAssistance;
  }

  const total = integer(set.reps);
  if (assisted === null || assisted < 1 || total === null || total < assisted) {
    throw new Error(ASSISTED_REPS_VALIDATION_ERROR);
  }
  return { ...set, assisted_reps: assisted };
}

export function fillAssistedRepsTemplate(
  template: string,
  breakdown: Pick<AssistedRepsBreakdown, 'unassisted' | 'assisted'>,
): string {
  return template
    .replace('{unassisted}', String(breakdown.unassisted))
    .replace('{assisted}', String(breakdown.assisted));
}

export function formatWorkoutSummaryStrengthSetLine(input: {
  set: StrengthSet;
  weight: string;
  bodyweightLabel: string;
  assistedTemplate: string;
}): string {
  const { set, bodyweightLabel, assistedTemplate } = input;
  const breakdown = getAssistedRepsBreakdown(set);
  const weight = breakdown && set.type === 'bodyweight' ? bodyweightLabel : input.weight;
  const reps = breakdown
    ? fillAssistedRepsTemplate(assistedTemplate, breakdown)
    : set.reps !== '' ? `${set.reps}reps` : '-';
  const drop = set.is_dropset ? ' [DROP]' : '';
  return `   Set ${set.set}${drop}  ${weight} × ${reps}`;
}
