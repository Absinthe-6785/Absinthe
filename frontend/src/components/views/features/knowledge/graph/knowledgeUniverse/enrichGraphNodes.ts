import type { NoteBase } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { isAreaNote } from '../../trace/areaNotes';
import { buildNoteGalaxyMap, getNoteGalaxyMap, type GalaxyAssignment } from './galaxyClustering';
import { classifyGraphNodeTier, type GraphNodeTier } from './graphNodeTier';
import { calculateKnowledgeImportance, nodeRadiusFromImportance } from './knowledgeImportance';
import { assignOrbitHierarchy, type OrbitAssignment } from './orbitalLayout';

export interface EnrichedGraphNodeMeta {
  tier: GraphNodeTier;
  importance: number;
  radius: number;
  backlinkCount: number;
  galaxy: GalaxyAssignment;
  orbit: OrbitAssignment;
  isAreaNote: boolean;
  updatedAt: number | null;
}

export interface EnrichGraphNodesInput {
  noteIds: readonly string[];
  notesById: Map<string, NoteBase>;
  service: KnowledgeIndexService;
  edges: ReadonlyArray<{ from: string; to: string }>;
  galaxyCacheKey?: string;
}

export function enrichGraphNodeMeta(input: EnrichGraphNodesInput): Map<string, EnrichedGraphNodeMeta> {
  const { noteIds, notesById, service, edges, galaxyCacheKey } = input;
  const galaxyMap = galaxyCacheKey
    ? getNoteGalaxyMap([...notesById.values()], service, galaxyCacheKey)
    : buildNoteGalaxyMap([...notesById.values()], service);
  const metaById = new Map<string, EnrichedGraphNodeMeta>();

  const orbitNodes = noteIds.map(id => {
    const note = notesById.get(id);
    const backlinkCount = service.getBacklinkCount(note?.title ?? '', id);
    const area = note ? isAreaNote(note) : false;
    const tier = classifyGraphNodeTier({
      backlinkCount,
      isAreaNote: area,
      isPinnedHub: note?.starred ?? false,
    });
    const importance = calculateKnowledgeImportance({
      backlinkCount,
      updatedAt: note?.updatedAt ?? null,
      isAreaNote: area,
    });
    const galaxy = galaxyMap.get(id) ?? {
      galaxyId: 'uncategorized',
      galaxyLabel: 'Uncategorized',
      anchorNoteId: null,
    };
    return { id, tier, importance, galaxyId: galaxy.galaxyId };
  });

  const orbitByGalaxy = new Map<string, ReturnType<typeof assignOrbitHierarchy>>();
  for (const node of orbitNodes) {
    if (!orbitByGalaxy.has(node.galaxyId)) {
      const galaxyNodes = orbitNodes.filter(n => n.galaxyId === node.galaxyId);
      const anchor = galaxyMap.get(galaxyNodes[0]?.id ?? '')?.anchorNoteId ?? null;
      orbitByGalaxy.set(node.galaxyId, assignOrbitHierarchy(galaxyNodes, edges, anchor));
    }
  }

  for (const id of noteIds) {
    const note = notesById.get(id);
    const backlinkCount = service.getBacklinkCount(note?.title ?? '', id);
    const area = note ? isAreaNote(note) : false;
    const tier = classifyGraphNodeTier({
      backlinkCount,
      isAreaNote: area,
      isPinnedHub: note?.starred ?? false,
    });
    const importance = calculateKnowledgeImportance({
      backlinkCount,
      updatedAt: note?.updatedAt ?? null,
      isAreaNote: area,
    });
    const galaxy = galaxyMap.get(id) ?? {
      galaxyId: 'uncategorized',
      galaxyLabel: 'Uncategorized',
      anchorNoteId: null,
    };
    const orbit = orbitByGalaxy.get(galaxy.galaxyId)?.get(id) ?? {
      parentId: null,
      orbitRadius: 0,
      orbitAngle: 0,
      orbitSpeed: 0,
    };

    metaById.set(id, {
      tier,
      importance,
      radius: nodeRadiusFromImportance(importance, tier),
      backlinkCount,
      galaxy,
      orbit,
      isAreaNote: area,
      updatedAt: note?.updatedAt ?? null,
    });
  }

  return metaById;
}
