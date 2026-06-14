import type { NoteBase } from '../../../../noteUtils';
import { displayNoteTitle } from '../../../../noteDisplayTitle';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import type { GalaxyAssignment } from '../../graph/knowledgeUniverse/galaxyClustering';
import { getProperty } from '../../properties/noteProperties';
import { isAreaNote } from '../../trace/areaNotes';
import { isMilestoneNote } from '../../trace/milestoneNotes';
import { OPPORTUNITY_LIMITS } from './importanceWeights';
import { evaluateKnowledgeImportance, type KnowledgeImportanceInput } from './knowledgeImportance';

export type KnowledgeOpportunityKind =
  | 'connect'
  | 'assign-area'
  | 'add-backlink';

export interface KnowledgeOpportunity {
  noteId: string;
  noteTitle: string;
  kind: KnowledgeOpportunityKind;
  /** i18n key for recommended action — use with title placeholder */
  actionKey:
    | 'k36OppActionConnect'
    | 'k36OppActionAssignArea'
    | 'k36OppActionAddBacklink';
  /** Optional target note for connect suggestions */
  targetNoteId?: string;
  targetNoteTitle?: string;
  priority: number;
}

export interface BuildKnowledgeOpportunitiesOptions {
  noteId?: string;
  limit?: number;
}

function parseUpdatedAt(note: NoteBase): number | null {
  const raw = Number(note.id.split('-')[1] || 0);
  return raw > 0 ? raw : null;
}

export function buildImportanceInputForNote(
  note: NoteBase,
  service: KnowledgeIndexService,
  galaxy: GalaxyAssignment | undefined,
): KnowledgeImportanceInput {
  const title = note.title ?? '';
  const tags = service.getTags(note.id);
  let sharedTagNeighborCount = 0;
  const neighborIds = new Set<string>();
  for (const tag of tags) {
    for (const id of service.getNotesWithTag(tag)) {
      if (id !== note.id) neighborIds.add(id);
    }
  }
  sharedTagNeighborCount = neighborIds.size;

  return {
    backlinkCount: service.getIncoming(title).length,
    outgoingLinkCount: service.getOutgoing(note.id).length,
    incomingReferenceCount: service.getIncoming(title).length,
    mentionCount: service.getMentioningNotes(note.id).length
      + service.getMentions(note.id).length,
    sharedTagNeighborCount,
    isAreaParticipant: Boolean(galaxy?.anchorNoteId && galaxy.anchorNoteId !== note.id && galaxy.galaxyId === galaxy.anchorNoteId),
    isAreaNote: isAreaNote(note),
    isStarred: Boolean(note.starred),
    isMilestone: isMilestoneNote(note),
    updatedAt: parseUpdatedAt(note),
  };
}

function isUncategorizedGalaxy(galaxy: GalaxyAssignment | undefined): boolean {
  if (!galaxy) return true;
  return galaxy.galaxyId === 'uncategorized' || galaxy.galaxyId.startsWith('folder:');
}

function hasAreaProperty(note: NoteBase): boolean {
  return Boolean(getProperty(note, 'area')?.trim());
}

function findConnectTarget(
  noteId: string,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): { noteId: string; title: string } | null {
  const related = service.getRelatedNotes(noteId);
  if (related.length > 0) {
    return { noteId: related[0].noteId, title: related[0].noteTitle };
  }
  const hubs = service.getHighlyConnectedNoteIds(3);
  const hub = hubs.find(id => id !== noteId);
  if (hub) {
    const n = notes.find(note => note.id === hub);
    if (n) return { noteId: hub, title: displayNoteTitle(n.title) };
  }
  return null;
}

/** Rule-based opportunity detection — orphans, weak links, missing area. */
export function buildKnowledgeOpportunities(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap: ReadonlyMap<string, GalaxyAssignment>,
  options: BuildKnowledgeOpportunitiesOptions = {},
): KnowledgeOpportunity[] {
  const limit = options.limit ?? OPPORTUNITY_LIMITS.VAULT_DEFAULT;
  const active = notes.filter(n => !n.deletedAt);
  const candidates = options.noteId
    ? active.filter(n => n.id === options.noteId)
    : active;

  const opportunities: KnowledgeOpportunity[] = [];

  for (const note of candidates) {
    const title = displayNoteTitle(note.title);
    const galaxy = galaxyMap.get(note.id);
    const input = buildImportanceInputForNote(note, service, galaxy);
    const { classification } = evaluateKnowledgeImportance(input);
    const connectionScore = service.getConnectionScore(note.id);
    const backlinkCount = service.getIncoming(note.title ?? '').length;

    if (classification === 'isolated' || connectionScore <= 1) {
      const target = findConnectTarget(note.id, active, service);
      opportunities.push({
        noteId: note.id,
        noteTitle: title,
        kind: 'connect',
        actionKey: 'k36OppActionConnect',
        targetNoteId: target?.noteId,
        targetNoteTitle: target?.title,
        priority: classification === 'isolated' ? 100 : 70,
      });
    }

    if (backlinkCount === 0 && input.outgoingLinkCount > 0) {
      opportunities.push({
        noteId: note.id,
        noteTitle: title,
        kind: 'add-backlink',
        actionKey: 'k36OppActionAddBacklink',
        priority: 60,
      });
    }

    if (!isAreaNote(note) && isUncategorizedGalaxy(galaxy) && !hasAreaProperty(note)) {
      opportunities.push({
        noteId: note.id,
        noteTitle: title,
        kind: 'assign-area',
        actionKey: 'k36OppActionAssignArea',
        priority: 50,
      });
    }
  }

  return opportunities
    .sort((a, b) => b.priority - a.priority || a.noteTitle.localeCompare(b.noteTitle))
    .slice(0, limit);
}
