import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterConceptNotes } from './conceptRelations';
import { hasTag, listTags } from '../tags/noteTags';

export interface ClusterEntry {
  noteId: string;
  noteTitle: string;
  connectionScore: number;
  meta: string;
}

export interface TagCluster {
  tag: string;
  count: number;
  conceptCount: number;
}

export interface KnowledgeClusterData {
  highlyConnected: ClusterEntry[];
  tagClusters: TagCluster[];
  conceptCount: number;
  clusterCount: number;
}

export interface BuildKnowledgeClusterOptions {
  limit?: number;
  minScore?: number;
}

export function buildKnowledgeClusters(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  opts: BuildKnowledgeClusterOptions = {},
): KnowledgeClusterData {
  const limit = opts.limit ?? 8;
  const minScore = opts.minScore ?? 2;
  const concepts = filterConceptNotes(notes);
  const conceptIds = new Set(concepts.map(n => n.id));

  const highlyConnected = service.getHighlyConnectedNoteIds(minScore)
    .filter(id => conceptIds.has(id))
    .slice(0, limit)
    .map(id => {
      const note = notes.find(n => n.id === id);
      const related = service.getRelatedNotes(id);
      return {
        noteId: id,
        noteTitle: displayNoteTitle(note?.title),
        connectionScore: related.length,
        meta: `연결 ${related.length}`,
      };
    });

  const tagCounts = new Map<string, { total: number; concepts: number }>();
  for (const note of concepts) {
    for (const tag of listTags(note)) {
      const row = tagCounts.get(tag) ?? { total: 0, concepts: 0 };
      row.total += 1;
      row.concepts += 1;
      tagCounts.set(tag, row);
    }
  }
  for (const note of notes) {
    if (note.deletedAt || conceptIds.has(note.id)) continue;
    for (const tag of listTags(note)) {
      const row = tagCounts.get(tag) ?? { total: 0, concepts: 0 };
      row.total += 1;
      tagCounts.set(tag, row);
    }
  }

  const tagClusters = [...tagCounts.entries()]
    .filter(([, v]) => v.concepts >= 2)
    .sort((a, b) => b[1].concepts - a[1].concepts || b[1].total - a[1].total)
    .slice(0, limit)
    .map(([tag, v]) => ({ tag, count: v.total, conceptCount: v.concepts }));

  return {
    highlyConnected,
    tagClusters,
    conceptCount: concepts.length,
    clusterCount: tagClusters.length,
  };
}
