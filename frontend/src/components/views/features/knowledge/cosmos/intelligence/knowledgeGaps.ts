import type { NoteBase } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { buildNoteGalaxyMap } from '../../graph/knowledgeUniverse/galaxyClustering';
import type { AreaHealthSummary } from './areaHealth';
import { listAreaNotes } from '../../trace/areaNotes';
import { isMilestoneNote } from '../../trace/milestoneNotes';
import { isProjectMilestone } from '../../academic/projectMilestoneModels';

export type KnowledgeGapKind =
  | 'isolated-cluster'
  | 'missing-hub'
  | 'missing-milestone'
  | 'weak-linking';

export interface KnowledgeGap {
  galaxyId: string;
  galaxyLabel: string;
  noteCount: number;
  linkCount: number;
  kind: KnowledgeGapKind;
  messageKey:
    | 'k36GapIsolatedCluster'
    | 'k36GapMissingHub'
    | 'k36GapMissingMilestone'
    | 'k36GapWeakLinking';
  priority: number;
}

export interface BuildKnowledgeGapsOptions {
  galaxyId?: string;
  limit?: number;
}

/** Rule-based structural gap detection per galaxy / area. */
export function buildKnowledgeGaps(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  areaHealth: readonly AreaHealthSummary[],
  options: BuildKnowledgeGapsOptions = {},
): KnowledgeGap[] {
  const limit = options.limit ?? 8;
  const active = notes.filter(n => !n.deletedAt);
  const galaxyMap = buildNoteGalaxyMap(active, service);
  const areaNoteIds = new Set(listAreaNotes(active).map(a => a.id));
  const gaps: KnowledgeGap[] = [];

  const targets = options.galaxyId
    ? areaHealth.filter(a => a.galaxyId === options.galaxyId)
    : areaHealth.filter(a => a.noteCount >= 3);

  for (const area of targets) {
    const members = active.filter(
      n => (galaxyMap.get(n.id)?.galaxyId ?? 'uncategorized') === area.galaxyId,
    );

    let linkCount = 0;
    let hasMilestone = false;
    for (const note of members) {
      linkCount += service.getOutgoing(note.id).length;
      if (isMilestoneNote(note) || isProjectMilestone(note)) hasMilestone = true;
    }

    if (area.orphanRatio >= 0.5 && area.noteCount >= 4) {
      gaps.push({
        galaxyId: area.galaxyId,
        galaxyLabel: area.label,
        noteCount: area.noteCount,
        linkCount,
        kind: 'isolated-cluster',
        messageKey: 'k36GapIsolatedCluster',
        priority: 90,
      });
    }

    if (!area.hubCoverage && !areaNoteIds.has(area.galaxyId) && area.noteCount >= 3) {
      gaps.push({
        galaxyId: area.galaxyId,
        galaxyLabel: area.label,
        noteCount: area.noteCount,
        linkCount,
        kind: 'missing-hub',
        messageKey: 'k36GapMissingHub',
        priority: 80,
      });
    }

    if (!hasMilestone && area.noteCount >= 5 && area.galaxyId !== 'uncategorized') {
      gaps.push({
        galaxyId: area.galaxyId,
        galaxyLabel: area.label,
        noteCount: area.noteCount,
        linkCount,
        kind: 'missing-milestone',
        messageKey: 'k36GapMissingMilestone',
        priority: 60,
      });
    }

    if (area.averageConnections < 1.5 && area.noteCount >= 4) {
      gaps.push({
        galaxyId: area.galaxyId,
        galaxyLabel: area.label,
        noteCount: area.noteCount,
        linkCount,
        kind: 'weak-linking',
        messageKey: 'k36GapWeakLinking',
        priority: 70,
      });
    }
  }

  return gaps
    .sort((a, b) => b.priority - a.priority || a.galaxyLabel.localeCompare(b.galaxyLabel))
    .slice(0, limit);
}
