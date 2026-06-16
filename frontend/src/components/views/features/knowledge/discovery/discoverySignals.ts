import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildNoteGalaxyMap, type GalaxyAssignment } from '../graph/knowledgeUniverse/galaxyClustering';
import type { ImportanceClassification } from '../cosmos/intelligence/knowledgeImportance';
import { buildKnowledgeGaps } from '../cosmos/intelligence/knowledgeGaps';
import { collectIsolatedNoteIds } from '../isolation/vaultIsolation';
import { getRelationTargets } from '../relations/noteRelations';
import { noteLastOpenedAt, daysSince } from '../review/staleNotes';
import { isAreaNote } from '../trace/areaNotes';
import type { DiscoveryItem } from './discoveryTypes';
import {
  DISCOVERY_WEIGHTS,
  scoreEmergingTopic,
  scoreForgottenKnowledge,
  scoreKnowledgeDrift,
  scoreMissingConnection,
  scoreWeakHub,
} from './discoveryScoring';
import {
  createDiscoveryFeedContext,
  getDiscoveryAreaHealth,
  getDiscoveryImportance,
  getGalaxyMemberIds,
  type DiscoveryFeedContext,
} from './discoveryFeedContext';
import { buildDiscoveryConnectionSuggestions } from './discoveryConnectionSuggestions';

function noteCreatedAt(note: NoteBase): number {
  if (note.createdAt && note.createdAt > 0) return note.createdAt;
  const fromId = Number(note.id.split('-')[1] || 0);
  return fromId > 0 ? fromId : note.updatedAt;
}

function hasExistingLink(
  sourceId: string,
  targetId: string,
  ctx: DiscoveryFeedContext,
): boolean {
  const target = ctx.noteById.get(targetId);
  if (!target) return true;
  const targetTitle = (target.title ?? '').trim();
  if (!targetTitle) return true;

  const { service } = ctx;
  const outgoing = service.getOutgoing(sourceId);
  if (outgoing.some(t => t.toLowerCase() === targetTitle.toLowerCase())) return true;

  const source = ctx.noteById.get(sourceId);
  if (source && getRelationTargets(source, 'related-to').includes(targetId)) return true;

  const reverseOutgoing = service.getOutgoing(targetId);
  const sourceTitle = (source?.title ?? '').trim();
  if (sourceTitle && reverseOutgoing.some(t => t.toLowerCase() === sourceTitle.toLowerCase())) {
    return true;
  }
  return getRelationTargets(target, 'related-to').includes(sourceId);
}

function resolveGalaxyMap(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap?: Map<string, GalaxyAssignment>,
): Map<string, GalaxyAssignment> {
  return galaxyMap ?? buildNoteGalaxyMap(notes, service);
}

function resolveContext(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  now: number,
  galaxyMap?: Map<string, GalaxyAssignment>,
  ctx?: DiscoveryFeedContext,
): DiscoveryFeedContext {
  if (ctx) return ctx;
  const map = resolveGalaxyMap(notes, service, galaxyMap);
  return createDiscoveryFeedContext(notes, service, map, now);
}

function importanceRank(classification: ImportanceClassification): number {
  switch (classification) {
    case 'core-hub': return 5;
    case 'major-hub': return 4;
    case 'supporting': return 3;
    case 'satellite': return 2;
    default: return 1;
  }
}

export interface HubActivitySignals {
  forgotten: DiscoveryItem[];
  drift: DiscoveryItem[];
}

/** Single-pass hub activity scan — shared importance cache for forgotten + drift. */
export function collectHubActivitySignals(
  ctx: DiscoveryFeedContext,
): HubActivitySignals {
  const hubRankPool: { note: NoteBase; result: ReturnType<typeof getDiscoveryImportance> }[] = [];
  const driftItems: DiscoveryItem[] = [];

  for (const note of ctx.activeNotes) {
    const isHub = isAreaNote(note);
    const updateDays = daysSince(note.updatedAt, ctx.now);
    const connectionScore = ctx.service.getConnectionScore(note.id);

    if (!isHub && connectionScore <= 1 && updateDays < DISCOVERY_WEIGHTS.MIN_DRIFT_DAYS) {
      continue;
    }

    const result = getDiscoveryImportance(ctx, note.id);
    const isMajorHub = result.classification === 'core-hub' || result.classification === 'major-hub';

    if (isMajorHub) {
      hubRankPool.push({ note, result });
    }

    if (updateDays < DISCOVERY_WEIGHTS.MIN_DRIFT_DAYS) continue;
    if (!isHub && !isMajorHub) continue;

    const score = scoreKnowledgeDrift(result.importanceScore, updateDays);
    if (score <= 0) continue;

    driftItems.push({
      id: `drift-${note.id}`,
      kind: 'knowledge-drift',
      score,
      title: displayNoteTitle(note.title),
      subtitle: `last-update:${updateDays}`,
      noteId: note.id,
      daysSinceActivity: updateDays,
      importanceClass: result.classification,
      areaLabel: ctx.galaxyMap.get(note.id)?.galaxyLabel,
    });
  }

  const forgottenItems: DiscoveryItem[] = [];
  const ranked = hubRankPool
    .sort((a, b) => b.result.importanceScore - a.result.importanceScore)
    .slice(0, DISCOVERY_WEIGHTS.FORGOTTEN_SCAN_LIMIT);

  for (const { note, result } of ranked) {
    const inactivityDays = daysSince(noteLastOpenedAt(note), ctx.now);
    if (inactivityDays < DISCOVERY_WEIGHTS.MIN_FORGOTTEN_DAYS) continue;
    const score = scoreForgottenKnowledge(result.importanceScore, inactivityDays);
    if (score <= 0) continue;
    forgottenItems.push({
      id: `forgotten-${note.id}`,
      kind: 'forgotten-knowledge',
      score,
      title: displayNoteTitle(note.title),
      subtitle: `last-opened:${inactivityDays}`,
      noteId: note.id,
      daysSinceActivity: inactivityDays,
      importanceClass: result.classification,
    });
  }

  return {
    forgotten: forgottenItems.sort((a, b) => b.score - a.score),
    drift: driftItems.sort((a, b) => b.score - a.score),
  };
}

export function collectForgottenKnowledgeSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  now: number,
  galaxyMap?: Map<string, GalaxyAssignment>,
  ctx?: DiscoveryFeedContext,
): DiscoveryItem[] {
  const context = resolveContext(notes, service, now, galaxyMap, ctx);
  return collectHubActivitySignals(context).forgotten;
}

export function collectMissingConnectionSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap?: Map<string, GalaxyAssignment>,
  ctx?: DiscoveryFeedContext,
): DiscoveryItem[] {
  const context = resolveContext(notes, service, Date.now(), galaxyMap, ctx);
  const sources = context.activeNotes
    .map(note => ({
      note,
      importance: getDiscoveryImportance(context, note.id).importanceScore,
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, DISCOVERY_WEIGHTS.CONNECTION_SOURCE_LIMIT)
    .map(row => row.note);

  const seen = new Set<string>();
  const items: DiscoveryItem[] = [];

  for (const source of sources) {
    const sourceImportance = getDiscoveryImportance(context, source.id);
    const suggestions = buildDiscoveryConnectionSuggestions(
      source.id,
      context,
      DISCOVERY_WEIGHTS.CONNECTIONS_PER_SOURCE + 2,
    );
    for (const suggestion of suggestions) {
      if (suggestion.score < DISCOVERY_WEIGHTS.MIN_CONNECTION_SCORE) continue;
      if (hasExistingLink(source.id, suggestion.noteId, context)) continue;

      const pairKey = [source.id, suggestion.noteId].sort().join(':');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const relevance = importanceRank(sourceImportance.classification) * suggestion.score;
      const score = scoreMissingConnection(suggestion.score, relevance);
      items.push({
        id: `missing-conn-${pairKey}`,
        kind: 'missing-connection',
        score,
        title: displayNoteTitle(source.title),
        subtitle: suggestion.noteTitle,
        noteId: source.id,
        targetNoteId: suggestion.noteId,
        targetNoteTitle: suggestion.noteTitle,
        signals: suggestion.signals,
      });
      if (items.length >= 24) break;
    }
    if (items.length >= 24) break;
  }

  return items.sort((a, b) => b.score - a.score);
}

export function collectEmergingTopicSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  now: number,
): DiscoveryItem[] {
  const galaxyMap = buildNoteGalaxyMap(notes, service);
  const active = notes.filter(n => !n.deletedAt);
  const recent = active.filter(note => {
    const created = noteCreatedAt(note);
    return daysSince(created, now) <= DISCOVERY_WEIGHTS.EMERGING_WINDOW_DAYS
      || daysSince(note.updatedAt, now) <= DISCOVERY_WEIGHTS.EMERGING_WINDOW_DAYS;
  }).slice(0, DISCOVERY_WEIGHTS.EMERGING_SCAN_LIMIT);

  const tagClusters = new Map<string, NoteBase[]>();
  const galaxyClusters = new Map<string, NoteBase[]>();

  for (const note of recent) {
    const tags = service.getTags(note.id);
    const primaryTag = tags[0];
    if (primaryTag) {
      const bucket = tagClusters.get(primaryTag) ?? [];
      bucket.push(note);
      tagClusters.set(primaryTag, bucket);
    }
    const galaxy = galaxyMap.get(note.id);
    if (galaxy && galaxy.galaxyId !== 'uncategorized' && !galaxy.galaxyId.startsWith('folder:')) {
      const bucket = galaxyClusters.get(galaxy.galaxyLabel) ?? [];
      bucket.push(note);
      galaxyClusters.set(galaxy.galaxyLabel, bucket);
    }
  }

  const items: DiscoveryItem[] = [];
  const addCluster = (label: string, members: NoteBase[], galaxyId?: string) => {
    if (members.length < DISCOVERY_WEIGHTS.EMERGING_MIN_NOTES) return;
    const newest = Math.min(...members.map(n => daysSince(noteCreatedAt(n), now)));
    const score = scoreEmergingTopic(newest, members.length);
    items.push({
      id: `emerging-${label.replace(/\s+/g, '-').toLowerCase()}`,
      kind: 'emerging-topic',
      score,
      title: label,
      subtitle: `notes:${members.length}:days:${DISCOVERY_WEIGHTS.EMERGING_WINDOW_DAYS}`,
      noteCount: members.length,
      galaxyId,
      areaLabel: label,
      noteId: members[0]?.id,
    });
  };

  for (const [tag, members] of tagClusters) addCluster(tag, members);
  for (const [label, members] of galaxyClusters) {
    const galaxyId = galaxyMap.get(members[0]?.id ?? '')?.galaxyId;
    addCluster(label, members, galaxyId);
  }

  return items.sort((a, b) => b.score - a.score);
}

export function collectWeakHubSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap?: Map<string, GalaxyAssignment>,
  ctx?: DiscoveryFeedContext,
): DiscoveryItem[] {
  const context = resolveContext(notes, service, Date.now(), galaxyMap, ctx);
  const areaHealth = getDiscoveryAreaHealth(context);
  const gaps = buildKnowledgeGaps(notes, service, areaHealth, {
    limit: 12,
    galaxyMap: context.galaxyMap,
    galaxyMemberIds: id => getGalaxyMemberIds(context, id),
  }).filter(g => g.kind === 'missing-hub');

  return gaps.map(gap => ({
    id: `weak-hub-${gap.galaxyId}`,
    kind: 'weak-hub' as const,
    score: scoreWeakHub(gap.noteCount),
    title: gap.galaxyLabel,
    subtitle: `notes:${gap.noteCount}:no-hub`,
    galaxyId: gap.galaxyId,
    areaLabel: gap.galaxyLabel,
    noteCount: gap.noteCount,
  })).sort((a, b) => b.score - a.score);
}

export function collectKnowledgeDriftSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  now: number,
  galaxyMap?: Map<string, GalaxyAssignment>,
  ctx?: DiscoveryFeedContext,
): DiscoveryItem[] {
  const context = resolveContext(notes, service, now, galaxyMap, ctx);
  return collectHubActivitySignals(context).drift;
}

export function collectIsolatedNotesSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): DiscoveryItem[] {
  const ids = collectIsolatedNoteIds(notes, service, 8);
  const items: DiscoveryItem[] = [];
  for (const noteId of ids) {
    const note = notes.find(n => n.id === noteId);
    if (!note) continue;
    items.push({
      id: `isolated-${noteId}`,
      kind: 'isolated-notes',
      score: 72,
      title: displayNoteTitle(note.title),
      subtitle: 'no-links',
      noteId,
    });
  }
  return items;
}

export function collectAreaInsightSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  _now: number,
  galaxyMap?: Map<string, GalaxyAssignment>,
  ctx?: DiscoveryFeedContext,
): DiscoveryItem[] {
  const context = resolveContext(notes, service, _now, galaxyMap, ctx);
  const summaries = getDiscoveryAreaHealth(context);
  const items: DiscoveryItem[] = [];

  const activeAreas = summaries
    .filter(s => s.category === 'thriving' || s.category === 'healthy' || s.category === 'growing')
    .sort((a, b) => b.noteCount - a.noteCount)
    .slice(0, 3);

  for (const area of activeAreas) {
    items.push({
      id: `active-area-${area.galaxyId}`,
      kind: 'recently-active-area',
      score: 65 + area.score * 0.2,
      title: area.label,
      subtitle: `${area.noteCount} notes`,
      areaLabel: area.label,
      galaxyId: area.galaxyId,
      noteCount: area.noteCount,
    });
  }

  const staleAreas = summaries
    .filter(s => s.category === 'fragmented' || s.category === 'critical')
    .sort((a, b) => b.orphanRatio - a.orphanRatio)
    .slice(0, 3);

  for (const area of staleAreas) {
    items.push({
      id: `stale-area-${area.galaxyId}`,
      kind: 'stale-area',
      score: 58 + area.orphanRatio * 20,
      title: area.label,
      subtitle: `orphan-ratio:${Math.round(area.orphanRatio * 100)}%`,
      areaLabel: area.label,
      galaxyId: area.galaxyId,
      noteCount: area.noteCount,
    });
  }

  return items.sort((a, b) => b.score - a.score);
}
