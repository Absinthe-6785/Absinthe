import type { NoteBase } from '../../../noteUtils';
import { findNoteByTitle } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import {
  buildBacklinkIndex,
  getIncomingLinks,
  getOutgoingLinks,
} from '../backlinks/buildBacklinkIndex';
import { isAreaNote } from './areaNotes';
import type {
  AreaClusterSuggestion,
  AreaDiscoveryProjection,
  AreaHubSuggestion,
} from './areaDiscoveryModels';
import {
  MAX_DISCOVERY_CLUSTERS,
  MAX_DISCOVERY_HUBS,
  MIN_CLUSTER_SIZE,
  MIN_HUB_REFERENCES,
} from './areaDiscoveryModels';

function buildUndirectedLinkGraph(
  notes: readonly NoteBase[],
): Map<string, Set<string>> {
  const activeNotes = notes.filter(note => note.deletedAt == null);
  const index = buildBacklinkIndex(activeNotes as NoteBase[]);
  const graph = new Map<string, Set<string>>();

  for (const note of activeNotes) {
    if (!graph.has(note.id)) graph.set(note.id, new Set());

    for (const title of getOutgoingLinks(index, note.id)) {
      const target = findNoteByTitle(title, activeNotes as NoteBase[]);
      if (!target || target.id === note.id || target.deletedAt != null) continue;

      if (!graph.has(target.id)) graph.set(target.id, new Set());
      graph.get(note.id)!.add(target.id);
      graph.get(target.id)!.add(note.id);
    }
  }

  return graph;
}

function findConnectedComponents(graph: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const startId of graph.keys()) {
    if (visited.has(startId)) continue;

    const queue = [startId];
    const component: string[] = [];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      for (const neighbor of graph.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

function buildPotentialHubs(notes: readonly NoteBase[]): AreaHubSuggestion[] {
  const activeNotes = notes.filter(note => note.deletedAt == null);
  const index = buildBacklinkIndex(activeNotes as NoteBase[]);

  return activeNotes
    .filter(note => !isAreaNote(note))
    .map(note => ({
      noteId: note.id,
      title: displayNoteTitle(note.title),
      referenceCount: getIncomingLinks(index, note.title ?? '', {
        excludeNoteId: note.id,
      }).length,
    }))
    .filter(item => item.referenceCount >= MIN_HUB_REFERENCES)
    .sort((a, b) =>
      b.referenceCount - a.referenceCount
      || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    )
    .slice(0, MAX_DISCOVERY_HUBS);
}

function buildRecurringConnections(
  notes: readonly NoteBase[],
): AreaClusterSuggestion[] {
  const activeNotes = notes.filter(note => note.deletedAt == null);
  const notesById = new Map(activeNotes.map(note => [note.id, note]));
  const graph = buildUndirectedLinkGraph(activeNotes);

  return findConnectedComponents(graph)
    .filter(component => component.length >= MIN_CLUSTER_SIZE)
    .map(component => {
      const members = component
        .map(noteId => notesById.get(noteId))
        .filter((note): note is NoteBase => note != null && !isAreaNote(note));

      return {
        noteIds: members.map(note => note.id),
        titles: members.map(note => displayNoteTitle(note.title)),
      };
    })
    .filter(cluster => cluster.noteIds.length >= MIN_CLUSTER_SIZE)
    .sort((a, b) =>
      b.noteIds.length - a.noteIds.length
      || a.titles.join(', ').localeCompare(b.titles.join(', '), undefined, { sensitivity: 'base' }),
    )
    .slice(0, MAX_DISCOVERY_CLUSTERS);
}

/**
 * Observe recurring link patterns without creating areas or assigning membership.
 * Pure projection — suggestions only, no actions.
 */
export function buildAreaDiscoveryProjection(
  notes: readonly NoteBase[],
): AreaDiscoveryProjection {
  return {
    potentialHubs: buildPotentialHubs(notes),
    recurringConnections: buildRecurringConnections(notes),
  };
}

export function hasAreaDiscoveryObservations(projection: AreaDiscoveryProjection): boolean {
  return projection.potentialHubs.length > 0
    || projection.recurringConnections.length > 0;
}

export function areaDiscoveryObservationCount(projection: AreaDiscoveryProjection): number {
  return projection.potentialHubs.length + projection.recurringConnections.length;
}
