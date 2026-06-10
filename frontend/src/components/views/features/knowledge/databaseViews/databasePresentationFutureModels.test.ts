import { describe, it, expect } from 'vitest';
import {
  isDatabaseGalleryConfig,
  isDatabasePresentationConfigFuture,
  isDatabaseTimelineConfig,
  normalizeGalleryConfig,
  normalizeTimelineConfig,
  presentationConfigTypeForPresentation,
  type DatabasePresentationConfigFuture,
} from './databasePresentationFutureModels';

describe('databasePresentationFutureModels', () => {
  it('narrows timeline config', () => {
    const config: DatabasePresentationConfigFuture = {
      type: 'timeline',
      startDateProperty: 'startDate',
      endDateProperty: 'dueDate',
      sortBy: 'start',
    };
    expect(isDatabaseTimelineConfig(config)).toBe(true);
    expect(isDatabaseGalleryConfig(config)).toBe(false);
  });

  it('narrows gallery config', () => {
    const config: DatabasePresentationConfigFuture = {
      type: 'gallery',
      coverProperty: 'cover',
      cardFields: ['status', 'priority'],
      cardSize: 'medium',
    };
    expect(isDatabaseGalleryConfig(config)).toBe(true);
    expect(isDatabaseTimelineConfig(config)).toBe(false);
  });

  it('normalizes timeline config', () => {
    expect(normalizeTimelineConfig({
      type: 'timeline',
      startDateProperty: ' startDate ',
      sortBy: 'title',
    })).toEqual({
      type: 'timeline',
      startDateProperty: 'startDate',
      sortBy: 'title',
    });
    expect(normalizeTimelineConfig({ type: 'timeline' })).toBeNull();
  });

  it('normalizes gallery config', () => {
    expect(normalizeGalleryConfig({
      type: 'gallery',
      coverProperty: ' thumbnail ',
      cardFields: [' status ', ''],
      cardSize: 'large',
    })).toEqual({
      type: 'gallery',
      coverProperty: 'thumbnail',
      cardFields: ['status'],
      cardSize: 'large',
    });
  });

  it('accepts all presentation config types in future union guard', () => {
    const types: DatabasePresentationConfigFuture['type'][] = [
      'table', 'board', 'calendar', 'timeline', 'gallery',
    ];
    for (const type of types) {
      expect(isDatabasePresentationConfigFuture({ type })).toBe(true);
    }
    expect(isDatabasePresentationConfigFuture({ type: 'chart' })).toBe(false);
  });

  it('maps future presentation enums to config types', () => {
    expect(presentationConfigTypeForPresentation('timeline')).toBe('timeline');
    expect(presentationConfigTypeForPresentation('gallery')).toBe('gallery');
    expect(presentationConfigTypeForPresentation('table')).toBe('table');
  });
});
