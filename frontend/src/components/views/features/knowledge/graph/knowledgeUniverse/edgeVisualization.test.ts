import { describe, expect, it } from 'vitest';
import { getEdgeVisualStyle, EDGE_LEGEND } from './edgeVisualization';

describe('edgeVisualization semantic language', () => {
  it('maps backlinks to hierarchy strokes', () => {
    const style = getEdgeVisualStyle('backlink', 2);
    expect(style.kind).toBe('hierarchy');
    expect(style.strokeDasharray).toBeUndefined();
  });

  it('maps mentions to reference dashes', () => {
    const style = getEdgeVisualStyle('mention', 1);
    expect(style.kind).toBe('reference');
    expect(style.strokeDasharray).toBeDefined();
  });

  it('maps relations to temporal dots', () => {
    const style = getEdgeVisualStyle('relation', 2);
    expect(style.kind).toBe('temporal');
  });

  it('exposes hover legend entries', () => {
    expect(EDGE_LEGEND.length).toBeGreaterThanOrEqual(4);
  });
});
