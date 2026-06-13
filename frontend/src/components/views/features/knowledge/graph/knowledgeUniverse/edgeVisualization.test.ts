import { describe, expect, it } from 'vitest';
import { getEdgeVisualStyle, resolveEdgeStrokeOpacity } from './edgeVisualization';

describe('edgeVisualization', () => {
  it('styles parent backlinks as solid thicker lines', () => {
    const style = getEdgeVisualStyle('backlink', 2);
    expect(style.category).toBe('parent');
    expect(style.strokeDasharray).toBeUndefined();
    expect(style.strokeWidth).toBeGreaterThan(1);
  });

  it('styles mentions as dashed reference edges', () => {
    const style = getEdgeVisualStyle('mention', 1);
    expect(style.category).toBe('reference');
    expect(style.strokeDasharray).toBeDefined();
  });

  it('emphasizes hovered and active edges', () => {
    const style = getEdgeVisualStyle('relation', 2);
    expect(resolveEdgeStrokeOpacity(style, { isActive: false, isHovered: false, isDim: false }))
      .toBeLessThan(
        resolveEdgeStrokeOpacity(style, { isActive: true, isHovered: false, isDim: false }),
      );
  });
});
