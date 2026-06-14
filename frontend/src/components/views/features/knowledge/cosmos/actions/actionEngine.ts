import type { NoteBase } from '../../../../noteUtils';
import { displayNoteTitle } from '../../../../noteDisplayTitle';
import { normalizeWikiTitle } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { buildNoteGalaxyMap } from '../../graph/knowledgeUniverse/galaxyClustering';
import { listAreaNotes } from '../../trace/areaNotes';
import { getProperty } from '../../properties/noteProperties';
import type { NoteIntelligenceSnapshot } from '../intelligence/cosmosAnalysis';
import type { KnowledgeOpportunity } from '../intelligence/knowledgeOpportunities';
import type { SuggestedConnection, SuggestionSignal } from '../intelligence/suggestedConnections';
import type { AreaHealthSummary } from '../intelligence/areaHealth';
import type { KnowledgeGap } from '../intelligence/knowledgeGaps';
import type { AreaHealthCategory } from '../intelligence/areaHealth';

export type CosmosActionKind =
  | 'connect'
  | 'view-candidates'
  | 'assign-area'
  | 'create-hub'
  | 'add-relation'
  | 'resolve-isolated'
  | 'link-related';

export interface CosmosActionItem {
  id: string;
  kind: CosmosActionKind;
  priority: number;
  title: string;
  description: string;
  targetNoteId?: string;
  targetNoteTitle?: string;
  areaLabel?: string;
  areaGalaxyId?: string;
  areaNoteId?: string;
}

export interface EnrichedConnectionRecommendation extends SuggestedConnection {
  sharedTags: readonly string[];
  mutualReferenceCount: number;
  commonBacklinkCount: number;
}

export interface SuggestedAreaAssignment {
  galaxyId: string;
  label: string;
  confidence: number;
  areaNoteId?: string;
}

export interface AreaGuidanceItem {
  galaxyId: string;
  label: string;
  score: number;
  category: AreaHealthCategory;
  recommendations: readonly AreaGuidanceRecommendation[];
}

export type AreaGuidanceRecommendation =
  | 'create-hub'
  | 'add-milestones'
  | 'connect-isolated';

export interface HubAssistantState {
  areaLabel: string;
  galaxyId: string;
  suggestedTitle: string;
}

export interface CosmosActionPlan {
  actions: CosmosActionItem[];
  areaGuidance: AreaGuidanceItem | null;
  suggestedArea: SuggestedAreaAssignment | null;
  hubAssistant: HubAssistantState | null;
  connections: EnrichedConnectionRecommendation[];
  hasActionableItems: boolean;
}

function sharedTagsBetween(
  sourceId: string,
  targetId: string,
  service: KnowledgeIndexService,
): string[] {
  const sourceTags = new Set(service.getTags(sourceId));
  return service.getTags(targetId).filter(tag => sourceTags.has(tag));
}

function mutualReferenceCount(
  sourceId: string,
  targetId: string,
  service: KnowledgeIndexService,
): number {
  let count = 0;
  if (service.getMentioningNotes(sourceId).some(m => m.noteId === targetId)) count += 1;
  if (service.getMentioningNotes(targetId).some(m => m.noteId === sourceId)) count += 1;
  const sourceTitle = normalizeWikiTitle(service.getNoteTitle(sourceId));
  const targetTitle = normalizeWikiTitle(service.getNoteTitle(targetId));
  if (sourceTitle && service.getIncoming(sourceTitle).some(r => r.noteId === targetId)) count += 1;
  if (targetTitle && service.getIncoming(targetTitle).some(r => r.noteId === sourceId)) count += 1;
  return count;
}

function commonBacklinkCount(
  sourceId: string,
  targetId: string,
  service: KnowledgeIndexService,
): number {
  const sourceTitle = normalizeWikiTitle(service.getNoteTitle(sourceId));
  const targetTitle = normalizeWikiTitle(service.getNoteTitle(targetId));
  if (!sourceTitle || !targetTitle) return 0;
  const sourceBacklinkIds = new Set(service.getIncoming(sourceTitle).map(ref => ref.noteId));
  return service.getIncoming(targetTitle).filter(ref => sourceBacklinkIds.has(ref.noteId)).length;
}

export function enrichConnectionRecommendations(
  noteId: string,
  connections: readonly SuggestedConnection[],
  service: KnowledgeIndexService,
): EnrichedConnectionRecommendation[] {
  return connections.map(conn => ({
    ...conn,
    sharedTags: sharedTagsBetween(noteId, conn.noteId, service),
    mutualReferenceCount: mutualReferenceCount(noteId, conn.noteId, service),
    commonBacklinkCount: commonBacklinkCount(noteId, conn.noteId, service),
  }));
}

export function suggestAreaForNote(
  note: NoteBase,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  areaHealthRows: readonly AreaHealthSummary[],
): SuggestedAreaAssignment | null {
  if (getProperty(note, 'area')?.trim()) return null;

  const galaxyMap = buildNoteGalaxyMap(notes, service);
  const current = galaxyMap.get(note.id);
  if (current && current.galaxyId !== 'uncategorized' && !current.galaxyId.startsWith('folder:')) {
    return null;
  }

  const sourceTags = new Set(service.getTags(note.id));
  const sourceTitle = (note.title ?? '').toLowerCase();
  const areaNotes = listAreaNotes(notes.filter(n => !n.deletedAt));
  let best: SuggestedAreaAssignment | null = null;

  for (const row of areaHealthRows) {
    if (row.galaxyId === 'uncategorized') continue;
    const members = notes.filter(
      n => !n.deletedAt && (galaxyMap.get(n.id)?.galaxyId ?? 'uncategorized') === row.galaxyId,
    );
    if (members.length === 0) continue;

    let tagHits = 0;
    let titleHits = 0;
    for (const member of members) {
      for (const tag of service.getTags(member.id)) {
        if (sourceTags.has(tag)) tagHits += 1;
      }
      const memberTitle = (member.title ?? '').toLowerCase();
      if (memberTitle && sourceTitle.includes(memberTitle.split(' ')[0] ?? '')) titleHits += 1;
    }

    const labelTokens = row.label.toLowerCase().split(/\s+/).filter(Boolean);
    const labelMatch = labelTokens.some(token => token.length > 2 && sourceTitle.includes(token));

    let score = tagHits * 15 + titleHits * 10 + (labelMatch ? 20 : 0) + row.score * 0.3;
    const areaNote = areaNotes.find(a => a.id === row.galaxyId);
    if (areaNote) score += 10;

    const confidence = Math.min(99, Math.round(score));
    if (confidence < 40) continue;

    if (!best || confidence > best.confidence) {
      best = {
        galaxyId: row.galaxyId,
        label: row.label,
        confidence,
        areaNoteId: areaNote?.id,
      };
    }
  }

  return best;
}

function buildAreaRecommendations(
  areaHealth: AreaHealthSummary | null,
  gaps: readonly KnowledgeGap[],
): AreaGuidanceRecommendation[] {
  const recs: AreaGuidanceRecommendation[] = [];
  if (!areaHealth) return recs;

  if (gaps.some(g => g.kind === 'missing-hub')) recs.push('create-hub');
  if (gaps.some(g => g.kind === 'missing-milestone')) recs.push('add-milestones');
  if (gaps.some(g => g.kind === 'isolated-cluster' || g.kind === 'weak-linking')) {
    recs.push('connect-isolated');
  }

  if (
    recs.length === 0
    && (areaHealth.category === 'fragmented' || areaHealth.category === 'critical')
  ) {
    recs.push('connect-isolated');
  }

  return recs;
}

function opportunityToAction(opp: KnowledgeOpportunity, index: number): CosmosActionItem {
  if (opp.kind === 'connect') {
    return {
      id: `opp-connect-${opp.noteId}-${index}`,
      kind: 'connect',
      priority: opp.priority,
      title: opp.noteTitle,
      description: opp.targetNoteTitle
        ? `Connect to ${opp.targetNoteTitle}`
        : 'Weakly connected — add a wiki link',
      targetNoteId: opp.targetNoteId,
      targetNoteTitle: opp.targetNoteTitle,
    };
  }
  if (opp.kind === 'add-backlink') {
    return {
      id: `opp-backlink-${opp.noteId}-${index}`,
      kind: 'view-candidates',
      priority: opp.priority - 5,
      title: opp.noteTitle,
      description: 'Missing backlinks — review link candidates',
      targetNoteId: opp.noteId,
    };
  }
  return {
    id: `opp-area-${opp.noteId}-${index}`,
    kind: 'assign-area',
    priority: opp.priority,
    title: opp.noteTitle,
    description: 'Unassigned area — assign to a knowledge domain',
    targetNoteId: opp.noteId,
  };
}

/** Build prioritized actionable plan from K-36 intelligence snapshot. */
export function buildCosmosActionPlan(
  note: NoteBase,
  snapshot: NoteIntelligenceSnapshot,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  areaHealthRows: readonly AreaHealthSummary[],
  labels: {
    connectDesc: (target: string) => string;
    backlinkDesc: string;
    assignDesc: string;
    createHubDesc: string;
    resolveDesc: string;
    relationDesc: (target: string) => string;
  },
): CosmosActionPlan {
  const actions: CosmosActionItem[] = [];

  for (const [index, opp] of snapshot.opportunities.entries()) {
    const action = opportunityToAction(opp, index);
    if (action.kind === 'connect' && action.targetNoteTitle) {
      action.description = labels.connectDesc(action.targetNoteTitle);
    } else if (action.kind === 'view-candidates') {
      action.description = labels.backlinkDesc;
    } else if (action.kind === 'assign-area') {
      action.description = labels.assignDesc;
    }
    actions.push(action);
  }

  const suggestedArea = suggestAreaForNote(note, notes, service, areaHealthRows);

  if (suggestedArea) {
    actions.push({
      id: `assign-suggested-${suggestedArea.galaxyId}`,
      kind: 'assign-area',
      priority: 85,
      title: displayNoteTitle(note.title),
      description: labels.assignDesc,
      areaLabel: suggestedArea.label,
      areaGalaxyId: suggestedArea.galaxyId,
      areaNoteId: suggestedArea.areaNoteId,
      targetNoteId: note.id,
    });
  }

  const hubAssistant = snapshot.gaps.some(g => g.kind === 'missing-hub') && snapshot.areaHealth
    ? {
      areaLabel: snapshot.areaHealth.label,
      galaxyId: snapshot.areaHealth.galaxyId,
      suggestedTitle: `${snapshot.areaHealth.label} Hub`,
    }
    : null;

  if (hubAssistant) {
    actions.push({
      id: `create-hub-${hubAssistant.galaxyId}`,
      kind: 'create-hub',
      priority: 75,
      title: hubAssistant.suggestedTitle,
      description: labels.createHubDesc,
      areaLabel: hubAssistant.areaLabel,
      areaGalaxyId: hubAssistant.galaxyId,
    });
  }

  if (snapshot.importance.classification === 'isolated') {
    actions.push({
      id: `resolve-isolated-${note.id}`,
      kind: 'resolve-isolated',
      priority: 70,
      title: displayNoteTitle(note.title),
      description: labels.resolveDesc,
      targetNoteId: note.id,
    });
  }

  const connections = enrichConnectionRecommendations(
    note.id,
    snapshot.suggestedConnections,
    service,
  );

  for (const conn of connections.slice(0, 3)) {
    actions.push({
      id: `relation-${conn.noteId}`,
      kind: 'add-relation',
      priority: 55 + Math.min(conn.score, 20),
      title: conn.noteTitle,
      description: labels.relationDesc(conn.noteTitle),
      targetNoteId: conn.noteId,
      targetNoteTitle: conn.noteTitle,
    });
  }

  const sorted = actions.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));

  const areaGuidance = snapshot.areaHealth
    ? {
      galaxyId: snapshot.areaHealth.galaxyId,
      label: snapshot.areaHealth.label,
      score: snapshot.areaHealth.score,
      category: snapshot.areaHealth.category,
      recommendations: buildAreaRecommendations(snapshot.areaHealth, snapshot.gaps),
    }
    : null;

  return {
    actions: sorted,
    areaGuidance,
    suggestedArea,
    hubAssistant,
    connections,
    hasActionableItems: sorted.length > 0,
  };
}

export function countActionsForNote(
  snapshot: NoteIntelligenceSnapshot,
): number {
  return snapshot.opportunities.length
    + (snapshot.gaps.some(g => g.kind === 'missing-hub') ? 1 : 0)
    + Math.min(snapshot.suggestedConnections.length, 3);
}

export function formatConnectionReasons(
  conn: EnrichedConnectionRecommendation,
  labels: {
    sharedTags: (tags: string) => string;
    mutualRefs: (count: number) => string;
    signal: (signal: SuggestionSignal) => string;
  },
): string[] {
  const lines: string[] = [];
  if (conn.sharedTags.length > 0) {
    lines.push(labels.sharedTags(conn.sharedTags.join(', ')));
  }
  if (conn.mutualReferenceCount > 0) {
    lines.push(labels.mutualRefs(conn.mutualReferenceCount));
  }
  if (conn.commonBacklinkCount > 0) {
    lines.push(labels.signal('common-backlink'));
  }
  for (const signal of conn.signals) {
    if (signal === 'shared-tag' || signal === 'mutual-mention' || signal === 'common-backlink') continue;
    lines.push(labels.signal(signal));
  }
  return lines;
}
