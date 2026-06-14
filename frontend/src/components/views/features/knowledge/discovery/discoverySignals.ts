import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildNoteGalaxyMap } from '../graph/knowledgeUniverse/galaxyClustering';
import {
  evaluateKnowledgeImportance,
  type ImportanceClassification,
} from '../cosmos/intelligence/knowledgeImportance';
import { buildImportanceInputForNote } from '../cosmos/intelligence/knowledgeOpportunities';
import { buildSuggestedConnections } from '../cosmos/intelligence/suggestedConnections';
import { buildAreaHealthSummaries } from '../cosmos/intelligence/areaHealth';
import { buildKnowledgeGaps } from '../cosmos/intelligence/knowledgeGaps';
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

function noteCreatedAt(note: NoteBase): number {
  if (note.createdAt && note.createdAt > 0) return note.createdAt;
  const fromId = Number(note.id.split('-')[1] || 0);
  return fromId > 0 ? fromId : note.updatedAt;
}

function hasExistingLink(
  sourceId: string,
  targetId: string,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): boolean {
  const target = notes.find(n => n.id === targetId);
  if (!target) return true;
  const targetTitle = (target.title ?? '').trim();
  if (!targetTitle) return true;

  const outgoing = service.getOutgoing(sourceId);
  if (outgoing.some(t => t.toLowerCase() === targetTitle.toLowerCase())) return true;

  const source = notes.find(n => n.id === sourceId);
  if (source && getRelationTargets(source, 'related-to').includes(targetId)) return true;

  const reverseOutgoing = service.getOutgoing(targetId);
  const sourceTitle = (source?.title ?? '').trim();
  if (sourceTitle && reverseOutgoing.some(t => t.toLowerCase() === sourceTitle.toLowerCase())) {
    return true;
  }
  return getRelationTargets(target, 'related-to').includes(sourceId);
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

export function collectForgottenKnowledgeSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  now: number,
): DiscoveryItem[] {
  const galaxyMap = buildNoteGalaxyMap(notes, service);
  const active = notes.filter(n => !n.deletedAt);
  const ranked = active
    .map(note => {
      const input = buildImportanceInputForNote(note, service, galaxyMap.get(note.id));
      const result = evaluateKnowledgeImportance(input);
      return { note, result };
    })
    .filter(({ result }) => result.classification === 'core-hub' || result.classification === 'major-hub')
    .sort((a, b) => b.result.importanceScore - a.result.importanceScore)
    .slice(0, DISCOVERY_WEIGHTS.FORGOTTEN_SCAN_LIMIT);

  const items: DiscoveryItem[] = [];
  for (const { note, result } of ranked) {
    const inactivityDays = daysSince(noteLastOpenedAt(note), now);
    if (inactivityDays < DISCOVERY_WEIGHTS.MIN_FORGOTTEN_DAYS) continue;
    const score = scoreForgottenKnowledge(result.importanceScore, inactivityDays);
    if (score <= 0) continue;
    items.push({
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
  return items.sort((a, b) => b.score - a.score);
}

export function collectMissingConnectionSignals(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): DiscoveryItem[] {
  const galaxyMap = buildNoteGalaxyMap(notes, service);
  const active = notes.filter(n => !n.deletedAt);
  const sources = active
    .map(note => {
      const input = buildImportanceInputForNote(note, service, galaxyMap.get(note.id));
      return { note, importance: evaluateKnowledgeImportance(input).importanceScore };
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, DISCOVERY_WEIGHTS.CONNECTION_SOURCE_LIMIT)
    .map(row => row.note);

  const seen = new Set<string>();
  const items: DiscoveryItem[] = [];

  for (const source of sources) {
    const suggestions = buildSuggestedConnections(
      source.id,
      notes,
      service,
      galaxyMap,
      { limit: DISCOVERY_WEIGHTS.CONNECTIONS_PER_SOURCE + 2 },
    );
    for (const suggestion of suggestions) {
      if (suggestion.signals.includes('related')) continue;
      if (suggestion.score < DISCOVERY_WEIGHTS.MIN_CONNECTION_SCORE) continue;
      if (hasExistingLink(source.id, suggestion.noteId, notes, service)) continue;

      const pairKey = [source.id, suggestion.noteId].sort().join(':');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const relevance = importanceRank(
        evaluateKnowledgeImportance(
          buildImportanceInputForNote(source, service, galaxyMap.get(source.id)),
        ).classification,
      ) * suggestion.score;
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
): DiscoveryItem[] {
  const galaxyMap = buildNoteGalaxyMap(notes, service);
  const areaHealth = buildAreaHealthSummaries(notes, service, galaxyMap);
  const gaps = buildKnowledgeGaps(notes, service, areaHealth, { limit: 12 })
    .filter(g => g.kind === 'missing-hub');

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
): DiscoveryItem[] {
  const galaxyMap = buildNoteGalaxyMap(notes, service);
  const active = notes.filter(n => !n.deletedAt);
  const items: DiscoveryItem[] = [];

  for (const note of active) {
    const isHub = isAreaNote(note);
    const input = buildImportanceInputForNote(note, service, galaxyMap.get(note.id));
    const result = evaluateKnowledgeImportance(input);
    const isImportant = isHub || result.classification === 'core-hub' || result.classification === 'major-hub';
    if (!isImportant) continue;

    const inactivityDays = daysSince(note.updatedAt, now);
    if (inactivityDays < DISCOVERY_WEIGHTS.MIN_DRIFT_DAYS) continue;

    const score = scoreKnowledgeDrift(result.importanceScore, inactivityDays);
    if (score <= 0) continue;

    items.push({
      id: `drift-${note.id}`,
      kind: 'knowledge-drift',
      score,
      title: displayNoteTitle(note.title),
      subtitle: `last-update:${inactivityDays}`,
      noteId: note.id,
      daysSinceActivity: inactivityDays,
      importanceClass: result.classification,
      areaLabel: galaxyMap.get(note.id)?.galaxyLabel,
    });
  }

  return items.sort((a, b) => b.score - a.score);
}
