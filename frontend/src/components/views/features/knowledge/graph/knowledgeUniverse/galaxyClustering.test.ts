import { describe, expect, it } from 'vitest';
import type { NoteBase } from '../../../../noteUtils';
import { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { applyAreaToNote } from '../../trace/areaNotes';
import { buildNoteGalaxyMap, computeGalaxyCenters, interGalaxyRepulsionMultiplier } from './galaxyClustering';

function note(id: string, title: string, body = ''): NoteBase {
  return {
    id,
    title,
    body,
    createdAt: 1,
    updatedAt: 1,
    folderId: null,
    starred: false,
    deletedAt: null,
  };
}

describe('galaxyClustering', () => {
  it('anchors galaxies to area notes and linked members', () => {
    const history = applyAreaToNote(note('area-h', 'History'));
    const napoleon = note('n1', 'Napoleon', '[[History]]');
    const notes = [history, napoleon];
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    const map = buildNoteGalaxyMap(notes, service);

    expect(map.get('area-h')?.galaxyId).toBe('area-h');
    expect(map.get('n1')?.galaxyId).toBe('area-h');
    expect(map.get('n1')?.galaxyLabel).toBe('History');
  });

  it('computes galaxy centroids', () => {
    const centers = computeGalaxyCenters([
      { id: 'a', x: 0, y: 0, galaxyId: 'g1' },
      { id: 'b', x: 10, y: 10, galaxyId: 'g1' },
      { id: 'c', x: 100, y: 100, galaxyId: 'g2' },
    ]);
    expect(centers.get('g1')).toEqual({ x: 5, y: 5 });
    expect(centers.get('g2')).toEqual({ x: 100, y: 100 });
  });

  it('boosts repulsion across galaxies in universe mode', () => {
    expect(interGalaxyRepulsionMultiplier('a', 'b', true)).toBeGreaterThan(1);
    expect(interGalaxyRepulsionMultiplier('a', 'a', true)).toBe(1);
    expect(interGalaxyRepulsionMultiplier('a', 'b', false)).toBe(1);
  });
});
