import type { NoteBase } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { getNoteGalaxyMap } from '../../graph/knowledgeUniverse/galaxyClustering';
import { buildAreaHealthSummaries, type AreaHealthSummary } from './areaHealth';
import { buildKnowledgeGaps, type KnowledgeGap } from './knowledgeGaps';
import {
  buildKnowledgeOpportunities,
  type KnowledgeOpportunity,
} from './knowledgeOpportunities';
import {
  evaluateKnowledgeImportance,
  type ImportanceClassification,
  type KnowledgeImportanceResult,
} from './knowledgeImportance';
import { buildImportanceInputForNote } from './knowledgeOpportunities';
import {
  buildSuggestedConnections,
  type SuggestedConnection,
} from './suggestedConnections';
import { OPPORTUNITY_LIMITS } from './importanceWeights';
import { getProperty } from '../../properties/noteProperties';

export interface NoteIntelligenceSnapshot {
  noteId: string;
  importance: KnowledgeImportanceResult;
  connectionCount: number;
  backlinkCount: number;
  galaxyLabel: string;
  galaxyId: string;
  areaLabel: string | null;
  opportunities: KnowledgeOpportunity[];
  suggestedConnections: SuggestedConnection[];
  gaps: KnowledgeGap[];
  areaHealth: AreaHealthSummary | null;
}

export interface CosmosVaultAnalysis {
  coreHubCount: number;
  majorHubCount: number;
  isolatedCount: number;
  opportunityCount: number;
  weakAreaCount: number;
  topOpportunities: KnowledgeOpportunity[];
  areaHealthRows: AreaHealthSummary[];
  gaps: KnowledgeGap[];
}

export function buildNoteIntelligenceSnapshot(
  note: NoteBase,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): NoteIntelligenceSnapshot {
  const galaxyMap = getNoteGalaxyMap(notes, service);
  const galaxy = galaxyMap.get(note.id);
  const input = buildImportanceInputForNote(note, service, galaxy);
  const importance = evaluateKnowledgeImportance(input);
  const areaHealthRows = buildAreaHealthSummaries(notes, service, galaxyMap);
  const galaxyId = galaxy?.galaxyId ?? 'uncategorized';

  return {
    noteId: note.id,
    importance,
    connectionCount: service.getConnectionScore(note.id),
    backlinkCount: service.getIncoming(note.title ?? '').length,
    galaxyLabel: galaxy?.galaxyLabel ?? 'Uncategorized',
    galaxyId,
    areaLabel: getProperty(note, 'area')?.trim() ?? galaxy?.galaxyLabel ?? null,
    opportunities: buildKnowledgeOpportunities(notes, service, galaxyMap, {
      noteId: note.id,
      limit: OPPORTUNITY_LIMITS.NOTE_DEFAULT,
    }),
    suggestedConnections: buildSuggestedConnections(note.id, notes, service, galaxyMap),
    gaps: buildKnowledgeGaps(notes, service, areaHealthRows, {
      galaxyId,
      limit: 3,
    }),
    areaHealth: areaHealthRows.find(row => row.galaxyId === galaxyId) ?? null,
  };
}

export function buildCosmosVaultAnalysis(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): CosmosVaultAnalysis {
  const active = notes.filter(n => !n.deletedAt);
  const galaxyMap = getNoteGalaxyMap(active, service);
  const areaHealthRows = buildAreaHealthSummaries(active, service, galaxyMap);

  let coreHubCount = 0;
  let majorHubCount = 0;
  let isolatedCount = 0;

  for (const note of active) {
    const input = buildImportanceInputForNote(note, service, galaxyMap.get(note.id));
    const { classification } = evaluateKnowledgeImportance(input);
    if (classification === 'core-hub') coreHubCount += 1;
    else if (classification === 'major-hub') majorHubCount += 1;
    else if (classification === 'isolated') isolatedCount += 1;
  }

  const topOpportunities = buildKnowledgeOpportunities(active, service, galaxyMap, {
    limit: OPPORTUNITY_LIMITS.VAULT_DEFAULT,
  });

  const weakAreaCount = areaHealthRows.filter(
    row => row.category === 'fragmented' || row.category === 'critical',
  ).length;

  return {
    coreHubCount,
    majorHubCount,
    isolatedCount,
    opportunityCount: topOpportunities.length,
    weakAreaCount,
    topOpportunities,
    areaHealthRows: areaHealthRows.slice(0, 8),
    gaps: buildKnowledgeGaps(active, service, areaHealthRows),
  };
}

export function countNotesByClassification(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  classification: ImportanceClassification,
): number {
  const galaxyMap = getNoteGalaxyMap(notes.filter(n => !n.deletedAt), service);
  let count = 0;
  for (const note of notes) {
    if (note.deletedAt) continue;
    const input = buildImportanceInputForNote(note, service, galaxyMap.get(note.id));
    if (evaluateKnowledgeImportance(input).classification === classification) count += 1;
  }
  return count;
}
