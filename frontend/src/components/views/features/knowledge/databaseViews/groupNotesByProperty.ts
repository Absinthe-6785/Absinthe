import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getNoteGroupValue } from './databaseFieldValues';
import {
  UNASSIGNED_LANE_KEY,
  UNASSIGNED_LANE_LABEL,
} from './databasePresentationConfig';

export interface BoardLane {
  key: string;
  label: string;
  notes: NoteBase[];
}

/**
 * Group filtered notes into board lanes by a property key.
 * Lane order comes from fixed lanes, then distinct indexed property values.
 */
export function groupNotesByProperty(
  notes: readonly NoteBase[],
  groupBy: string,
  service: KnowledgeIndexService,
  fixedLanes?: readonly string[],
): BoardLane[] {
  const trimmedGroupBy = groupBy.trim();
  if (!trimmedGroupBy) {
    return [{
      key: UNASSIGNED_LANE_KEY,
      label: UNASSIGNED_LANE_LABEL,
      notes: [...notes],
    }];
  }

  const buckets = new Map<string, NoteBase[]>();
  const labels = new Map<string, string>();

  const ensureLane = (key: string, label: string) => {
    if (!buckets.has(key)) {
      buckets.set(key, []);
      labels.set(key, label);
    }
  };

  if (fixedLanes && fixedLanes.length > 0) {
    for (const lane of fixedLanes) {
      ensureLane(lane, lane);
    }
  } else {
    for (const value of service.getPropertyValues(trimmedGroupBy)) {
      ensureLane(value, value);
    }
  }

  for (const note of notes) {
    const rawValue = getNoteGroupValue(note, trimmedGroupBy, service);
    if (!rawValue) {
      ensureLane(UNASSIGNED_LANE_KEY, UNASSIGNED_LANE_LABEL);
      buckets.get(UNASSIGNED_LANE_KEY)!.push(note);
      continue;
    }
    ensureLane(rawValue, rawValue);
    buckets.get(rawValue)!.push(note);
  }

  const orderedKeys: string[] = [];
  if (fixedLanes && fixedLanes.length > 0) {
    orderedKeys.push(...fixedLanes);
    if (buckets.has(UNASSIGNED_LANE_KEY) && !orderedKeys.includes(UNASSIGNED_LANE_KEY)) {
      orderedKeys.push(UNASSIGNED_LANE_KEY);
    }
  } else {
    const indexed = service.getPropertyValues(trimmedGroupBy);
    orderedKeys.push(...indexed);
    for (const key of buckets.keys()) {
      if (key !== UNASSIGNED_LANE_KEY && !orderedKeys.includes(key)) {
        orderedKeys.push(key);
      }
    }
    if (buckets.has(UNASSIGNED_LANE_KEY)) {
      orderedKeys.push(UNASSIGNED_LANE_KEY);
    }
  }

  if (orderedKeys.length === 0 && notes.length === 0) {
    return [];
  }

  if (orderedKeys.length === 0) {
    return [{
      key: UNASSIGNED_LANE_KEY,
      label: UNASSIGNED_LANE_LABEL,
      notes: [],
    }];
  }

  return orderedKeys.map(key => ({
    key,
    label: labels.get(key) ?? key,
    notes: buckets.get(key) ?? [],
  }));
}
