import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { applyAreaToNote } from './areaNotes';
import {
  areaDiscoveryObservationCount,
  buildAreaDiscoveryProjection,
  hasAreaDiscoveryObservations,
} from './buildAreaDiscoveryProjection';

function note(
  id: string,
  overrides: Partial<NoteBase> = {},
): NoteBase {
  return {
    id,
    title: 'Note',
    body: '',
    updatedAt: 1000,
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('buildAreaDiscoveryProjection', () => {
  it('suggests potential hubs referenced by many notes but not marked as areas', () => {
    const japanese = note('hub', { title: 'Japanese' });
    const notes = [
      japanese,
      note('a1', { title: 'Grammar', body: 'See [[Japanese]]' }),
      note('a2', { title: 'Reading', body: 'See [[Japanese]]' }),
      note('a3', { title: 'Anki', body: 'See [[Japanese]]' }),
    ];

    const projection = buildAreaDiscoveryProjection(notes);

    expect(projection.potentialHubs).toHaveLength(1);
    expect(projection.potentialHubs[0]?.noteId).toBe('hub');
    expect(projection.potentialHubs[0]?.referenceCount).toBe(3);
  });

  it('excludes notes already marked as areas from hub suggestions', () => {
    const japanese = applyAreaToNote(note('hub', { title: 'Japanese' }));
    const notes = [
      japanese,
      note('a1', { title: 'Grammar', body: '[[Japanese]]' }),
      note('a2', { title: 'Reading', body: '[[Japanese]]' }),
      note('a3', { title: 'Anki', body: '[[Japanese]]' }),
    ];

    const projection = buildAreaDiscoveryProjection(notes);
    expect(projection.potentialHubs).toEqual([]);
  });

  it('observes recurring connections among interlinked notes', () => {
    const notes = [
      note('g', { title: 'Grammar', body: '[[Reading]] [[Vocabulary]]' }),
      note('r', { title: 'Reading', body: '[[Grammar]] [[Vocabulary]]' }),
      note('v', { title: 'Vocabulary', body: '[[Grammar]] [[Reading]]' }),
      note('solo', { title: 'Solo', body: '' }),
    ];

    const projection = buildAreaDiscoveryProjection(notes);

    expect(projection.recurringConnections).toHaveLength(1);
    expect(projection.recurringConnections[0]?.titles.sort()).toEqual(['Grammar', 'Reading', 'Vocabulary']);
    expect(hasAreaDiscoveryObservations(projection)).toBe(true);
    expect(areaDiscoveryObservationCount(projection)).toBe(1);
  });

  it('returns empty observations when no patterns meet thresholds', () => {
    const projection = buildAreaDiscoveryProjection([
      note('a', { title: 'A', body: '[[B]]' }),
      note('b', { title: 'B', body: '' }),
    ]);

    expect(projection.potentialHubs).toEqual([]);
    expect(projection.recurringConnections).toEqual([]);
    expect(hasAreaDiscoveryObservations(projection)).toBe(false);
  });
});
