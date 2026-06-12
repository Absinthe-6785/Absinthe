import type { NoteBase } from '../../../noteUtils';
import { getProperty } from '../properties/noteProperties';
import { TRACE_PROPERTY_KEYS } from '../trace/dailyTraceModels';
import { isMilestoneNote, readMilestoneFromNote } from '../trace/milestoneNotes';
import type { ArchiveMilestoneEntry } from './archiveHomeModels';
import { archivePeriodRefFromDateKey } from './archivePeriodRefHelpers';

export function buildArchiveRecentMilestones(
  notes: readonly NoteBase[],
  options?: { limit?: number; now?: Date },
): ArchiveMilestoneEntry[] {
  const limit = options?.limit ?? 5;
  const activeNotes = notes.filter(note => note.deletedAt == null);

  const entries: ArchiveMilestoneEntry[] = [];

  for (const note of activeNotes) {
    if (!isMilestoneNote(note)) continue;
    const milestone = readMilestoneFromNote(note);
    if (!milestone?.milestoneDate) continue;

    const labelOverride = milestone.milestoneLabel?.trim();
    const displayLabel = labelOverride || note.title.trim() || 'Untitled';
    const kind = getProperty(note, TRACE_PROPERTY_KEYS.MILESTONE_KIND)?.trim() ?? '';

    entries.push({
      noteId: note.id,
      label: displayLabel,
      kind,
      date: milestone.milestoneDate,
      displayLabel,
      periodRef: archivePeriodRefFromDateKey(milestone.milestoneDate),
    });
  }

  entries.sort((a, b) =>
    b.date.localeCompare(a.date)
    || a.displayLabel.localeCompare(b.displayLabel, undefined, { sensitivity: 'base' }),
  );

  return entries.slice(0, limit);
}
