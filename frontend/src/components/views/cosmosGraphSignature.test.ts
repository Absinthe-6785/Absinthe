import { describe, expect, it } from 'vitest';
import { buildGraphTopologySignature } from './cosmosGraphSignature';

describe('cosmosGraphSignature', () => {
  const base = {
    nodeIds: ['a', 'b', 'c'],
    edges: [
      { sourceId: 'a', targetId: 'b', relationshipType: 'backlink' },
      { sourceId: 'b', targetId: 'c', relationshipType: 'mention' },
    ],
  };

  it('is stable regardless of node/edge input order', () => {
    const sigA = buildGraphTopologySignature(base);
    const sigB = buildGraphTopologySignature({
      nodeIds: ['c', 'a', 'b'],
      edges: [
        { sourceId: 'b', targetId: 'c', relationshipType: 'mention' },
        { sourceId: 'a', targetId: 'b', relationshipType: 'backlink' },
      ],
    });
    expect(sigA).toBe(sigB);
  });

  it('changes when a node is added', () => {
    const before = buildGraphTopologySignature(base);
    const after = buildGraphTopologySignature({
      ...base,
      nodeIds: [...base.nodeIds, 'd'],
    });
    expect(before).not.toBe(after);
  });

  it('changes when an edge is added', () => {
    const before = buildGraphTopologySignature(base);
    const after = buildGraphTopologySignature({
      ...base,
      edges: [...base.edges, { sourceId: 'a', targetId: 'c', relationshipType: 'backlink' }],
    });
    expect(before).not.toBe(after);
  });

  it('changes when an edge is removed', () => {
    const before = buildGraphTopologySignature(base);
    const after = buildGraphTopologySignature({
      ...base,
      edges: base.edges.slice(0, 1),
    });
    expect(before).not.toBe(after);
  });

  it('is unchanged for metadata-only scenarios (same ids and edges)', () => {
    const sig = buildGraphTopologySignature(base);
    expect(buildGraphTopologySignature({ ...base })).toBe(sig);
  });
});
