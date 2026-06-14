import type { NoteBase } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import type { GalaxyAssignment } from '../../graph/knowledgeUniverse/galaxyClustering';
import { listAreaNotes, isAreaNote } from '../../trace/areaNotes';
import { isMilestoneNote } from '../../trace/milestoneNotes';
import { isProjectMilestone } from '../../academic/projectMilestoneModels';
import {
  AREA_HEALTH_CATEGORY_THRESHOLDS,
  AREA_HEALTH_WEIGHTS,
} from './importanceWeights';
import { evaluateKnowledgeImportance } from './knowledgeImportance';
import { buildImportanceInputForNote } from './knowledgeOpportunities';

export type AreaHealthCategory =
  | 'thriving'
  | 'healthy'
  | 'growing'
  | 'fragmented'
  | 'critical';

export interface AreaHealthSummary {
  galaxyId: string;
  label: string;
  score: number;
  category: AreaHealthCategory;
  noteCount: number;
  averageConnections: number;
  orphanRatio: number;
  hubCoverage: boolean;
  milestoneCoverage: boolean;
}

function classifyAreaHealth(score: number): AreaHealthCategory {
  if (score >= AREA_HEALTH_CATEGORY_THRESHOLDS.THRIVING) return 'thriving';
  if (score >= AREA_HEALTH_CATEGORY_THRESHOLDS.HEALTHY) return 'healthy';
  if (score >= AREA_HEALTH_CATEGORY_THRESHOLDS.GROWING) return 'growing';
  if (score >= AREA_HEALTH_CATEGORY_THRESHOLDS.FRAGMENTED) return 'fragmented';
  return 'critical';
}

function computeAreaScore(
  noteCount: number,
  averageConnections: number,
  orphanRatio: number,
  hubCoverage: boolean,
  milestoneCoverage: boolean,
): number {
  const connectionPart = Math.min(40, averageConnections * AREA_HEALTH_WEIGHTS.CONNECTION);
  const orphanPart = (1 - orphanRatio) * AREA_HEALTH_WEIGHTS.ORPHAN;
  const hubPart = hubCoverage ? AREA_HEALTH_WEIGHTS.HUB : 0;
  const milestonePart = milestoneCoverage ? AREA_HEALTH_WEIGHTS.MILESTONE : 0;
  const sizePart = Math.min(AREA_HEALTH_WEIGHTS.SIZE, noteCount * 2);
  return Math.round(Math.min(100, connectionPart + orphanPart + hubPart + milestonePart + sizePart));
}

/** Per-galaxy / area health metrics — 0–100 score with category label. */
export function buildAreaHealthSummaries(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap: ReadonlyMap<string, GalaxyAssignment>,
): AreaHealthSummary[] {
  const active = notes.filter(n => !n.deletedAt);
  const byGalaxy = new Map<string, { label: string; noteIds: string[] }>();

  for (const note of active) {
    const galaxy = galaxyMap.get(note.id);
    const galaxyId = galaxy?.galaxyId ?? 'uncategorized';
    const label = galaxy?.galaxyLabel ?? 'Uncategorized';
    const bucket = byGalaxy.get(galaxyId) ?? { label, noteIds: [] };
    bucket.noteIds.push(note.id);
    byGalaxy.set(galaxyId, bucket);
  }

  const areaIds = new Set(listAreaNotes(active).map(a => a.id));
  const summaries: AreaHealthSummary[] = [];

  for (const [galaxyId, { label, noteIds }] of byGalaxy) {
    if (noteIds.length === 0) continue;

    let connectionSum = 0;
    let orphanCount = 0;
    let hasHub = areaIds.has(galaxyId);
    let hasMilestone = false;

    for (const noteId of noteIds) {
      const note = active.find(n => n.id === noteId);
      if (!note) continue;
      const score = service.getConnectionScore(noteId);
      connectionSum += score;
      if (score <= 1) orphanCount += 1;

      const input = buildImportanceInputForNote(note, service, galaxyMap.get(noteId));
      const { classification } = evaluateKnowledgeImportance(input);
      if (classification === 'core-hub' || classification === 'major-hub') {
        hasHub = true;
      }
      if (isMilestoneNote(note) || isProjectMilestone(note)) {
        hasMilestone = true;
      }
      if (isAreaNote(note)) hasHub = true;
    }

    const noteCount = noteIds.length;
    const averageConnections = noteCount > 0 ? connectionSum / noteCount : 0;
    const orphanRatio = noteCount > 0 ? orphanCount / noteCount : 1;
    const score = computeAreaScore(noteCount, averageConnections, orphanRatio, hasHub, hasMilestone);

    summaries.push({
      galaxyId,
      label,
      score,
      category: classifyAreaHealth(score),
      noteCount,
      averageConnections: Math.round(averageConnections * 10) / 10,
      orphanRatio: Math.round(orphanRatio * 100) / 100,
      hubCoverage: hasHub,
      milestoneCoverage: hasMilestone,
    });
  }

  return summaries.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}
