import { describe, expect, it } from 'vitest';
import {
  graphScaleTier,
  shouldShowGraphNodeLabel,
} from './graphScalePolicy';

describe('graphScalePolicy', () => {
  it('classifies graph size tiers', () => {
    expect(graphScaleTier(50)).toBe('normal');
    expect(graphScaleTier(100)).toBe('large');
    expect(graphScaleTier(250)).toBe('xlarge');
  });

  it('suppresses ambient labels on large graphs', () => {
    expect(shouldShowGraphNodeLabel({
      nodeCount: 120,
      isActive: false,
      isHovered: false,
      isSearchMatch: false,
      isHub: false,
      inFocusCluster: true,
      hasSearchFilter: false,
    })).toBe(false);

    expect(shouldShowGraphNodeLabel({
      nodeCount: 120,
      isActive: false,
      isHovered: false,
      isSearchMatch: false,
      isHub: true,
      inFocusCluster: true,
      hasSearchFilter: false,
    })).toBe(true);
  });

  it('always shows labels for stars regardless of graph size', () => {
    expect(shouldShowGraphNodeLabel({
      nodeCount: 300,
      isActive: false,
      isHovered: false,
      isSearchMatch: false,
      isHub: false,
      nodeTier: 'star',
      inFocusCluster: false,
      hasSearchFilter: false,
    })).toBe(true);
  });

  it('always shows labels for active, hover, and search match', () => {
    const base = {
      nodeCount: 300,
      isSearchMatch: false,
      isHub: false,
      inFocusCluster: false,
      hasSearchFilter: false,
    };
    expect(shouldShowGraphNodeLabel({ ...base, isActive: true, isHovered: false })).toBe(true);
    expect(shouldShowGraphNodeLabel({ ...base, isActive: false, isHovered: true })).toBe(true);
    expect(shouldShowGraphNodeLabel({
      ...base,
      isActive: false,
      isHovered: false,
      isSearchMatch: true,
    })).toBe(true);
  });
});
