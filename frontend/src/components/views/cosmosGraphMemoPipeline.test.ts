import { describe, expect, it } from 'vitest';
import {
  buildGalaxyVisualTopology,
  buildOrbitPathTopology,
  buildVisibleGraphSnapshot,
  resolveGalaxyVisualsFromTopology,
  resolveOrbitPathsFromTopology,
} from './cosmosGraphMemoPipeline';

const nodes = [
  {
    id: 'a',
    title: 'A',
    folderId: null,
    x: 0,
    y: 0,
    links: 2,
    backlinkCount: 1,
    importance: 10,
    radius: 12,
    tier: 'star' as const,
    galaxyId: 'g1',
    galaxyLabel: 'Alpha',
    isAreaNote: true,
    orbitParentId: null,
    orbitRadius: 0,
    orbitAngle: 0,
    orbitSpeed: 0,
  },
  {
    id: 'b',
    title: 'B',
    folderId: null,
    x: 40,
    y: 10,
    links: 1,
    backlinkCount: 0,
    importance: 5,
    radius: 8,
    tier: 'moon' as const,
    galaxyId: 'g1',
    galaxyLabel: 'Alpha',
    isAreaNote: false,
    orbitParentId: 'a',
    orbitRadius: 30,
    orbitAngle: 0,
    orbitSpeed: 0,
  },
  {
    id: 'c',
    title: 'C',
    folderId: null,
    x: 200,
    y: 200,
    links: 0,
    backlinkCount: 0,
    importance: 1,
    radius: 6,
    tier: 'moon' as const,
    galaxyId: 'g2',
    galaxyLabel: 'Beta',
    isAreaNote: false,
    orbitParentId: null,
    orbitRadius: 0,
    orbitAngle: 0,
    orbitSpeed: 0,
  },
];

const edges = [{ from: 'a', to: 'b', relationshipType: 'reference' as const, weight: 1 }];

describe('cosmosGraphMemoPipeline', () => {
  it('filters isolated nodes unless showIsolated', () => {
    const hidden = buildVisibleGraphSnapshot(nodes, edges, false);
    expect(hidden.visibleNodes.map(n => n.id)).toEqual(['a', 'b']);
    const shown = buildVisibleGraphSnapshot(nodes, edges, true);
    expect(shown.visibleNodes.map(n => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('builds stable galaxy topology independent of moved positions', () => {
    const topology = buildGalaxyVisualTopology(nodes);
    expect(topology).toHaveLength(2);
    const moved = nodes.map(node => ({ ...node, x: node.x + 500, y: node.y + 500 }));
    expect(buildGalaxyVisualTopology(moved)).toEqual(topology);
  });

  it('resolves galaxy visuals from live positions', () => {
    const topology = buildGalaxyVisualTopology(nodes);
    const visuals = resolveGalaxyVisualsFromTopology(topology, id => nodes.find(n => n.id === id));
    expect(visuals[0]?.centerX).toBe(0);
    const moved = nodes.map(node => ({ ...node, x: node.x + 100 }));
    const movedVisuals = resolveGalaxyVisualsFromTopology(
      topology,
      id => moved.find(n => n.id === id),
    );
    expect(movedVisuals[0]?.centerX).toBe(100);
  });

  it('builds orbit topology and resolves parent positions', () => {
    const topology = buildOrbitPathTopology(nodes);
    expect(topology).toHaveLength(1);
    const paths = resolveOrbitPathsFromTopology(topology, id => nodes.find(n => n.id === id));
    expect(paths[0]?.cx).toBe(0);
    expect(paths[0]?.cy).toBe(0);
  });
});
