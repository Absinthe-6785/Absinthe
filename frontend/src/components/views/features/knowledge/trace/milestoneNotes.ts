import type { NoteBase } from '../../../noteUtils';
import { getProperty, removeProperty, setProperty } from '../properties/noteProperties';
import { parseDatabaseDate, toDateKey } from '../databaseViews/parseDatabaseDate';
import { TRACE_PROPERTY_KEYS } from './dailyTraceModels';

export interface MilestoneFormValues {
  milestoneDate: string;
  milestoneLabel?: string;
}

const MILESTONE_PROPERTY_KEYS = [
  TRACE_PROPERTY_KEYS.MILESTONE_DATE,
  TRACE_PROPERTY_KEYS.MILESTONE_LABEL,
  TRACE_PROPERTY_KEYS.MILESTONE_KIND,
] as const;

function normalizeOptionalDate(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = parseDatabaseDate(trimmed);
  return parsed ? toDateKey(parsed) : undefined;
}

function normalizeOptionalLabel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isMilestoneNote(note: NoteBase): boolean {
  return Boolean(getProperty(note, TRACE_PROPERTY_KEYS.MILESTONE_DATE)?.trim());
}

export function validateMilestoneForm(values: MilestoneFormValues): string | null {
  const milestoneDate = normalizeOptionalDate(values.milestoneDate);
  if (!milestoneDate) return 'Date is required';
  return null;
}

export function readMilestoneFromNote(note: NoteBase): MilestoneFormValues | null {
  if (!isMilestoneNote(note)) return null;

  const milestoneDate = normalizeOptionalDate(getProperty(note, TRACE_PROPERTY_KEYS.MILESTONE_DATE));
  if (!milestoneDate) return null;

  return {
    milestoneDate,
    milestoneLabel: normalizeOptionalLabel(getProperty(note, TRACE_PROPERTY_KEYS.MILESTONE_LABEL)),
  };
}

function setOptionalProperty(
  note: NoteBase,
  key: string,
  value: string | undefined,
): NoteBase {
  if (value) return setProperty(note, key, value);
  return removeProperty(note, key);
}

export function applyMilestoneToNote(note: NoteBase, values: MilestoneFormValues): NoteBase {
  const error = validateMilestoneForm(values);
  if (error) throw new Error(error);

  const milestoneDate = normalizeOptionalDate(values.milestoneDate)!;
  const milestoneLabel = normalizeOptionalLabel(values.milestoneLabel);

  let result = note;
  result = setProperty(result, TRACE_PROPERTY_KEYS.MILESTONE_DATE, milestoneDate);
  result = setOptionalProperty(result, TRACE_PROPERTY_KEYS.MILESTONE_LABEL, milestoneLabel);
  return result;
}

export function clearMilestoneFromNote(note: NoteBase): NoteBase {
  let result = note;
  for (const key of MILESTONE_PROPERTY_KEYS) {
    result = removeProperty(result, key);
  }
  return result;
}

export function milestoneFormValuesFromNote(note: NoteBase, defaultDate: string): MilestoneFormValues {
  return readMilestoneFromNote(note) ?? {
    milestoneDate: defaultDate,
    milestoneLabel: undefined,
  };
}
