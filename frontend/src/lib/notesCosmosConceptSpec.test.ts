import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const specPath = join(process.cwd(), 'docs', 'K-214-notes-cosmos-concept-spec.md');

function readSpec(): string {
  return readFileSync(specPath, 'utf8');
}

describe('K-214 Notes/Cosmos concept spec', () => {
  it('exists and defines the docs-only spec scope', () => {
    expect(existsSync(specPath)).toBe(true);
    const text = readSpec();

    for (const required of [
      'K-214 Notes/Cosmos Concept Spec',
      'K-214 defines the Notes/Cosmos conceptual model',
      'K-214 is docs/spec only',
      'does not implement graph/cosmos navigation',
      'create boundaries before any future interactive Notes/Cosmos work',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines the pixel-cosmos product identity and major surfaces', () => {
    const text = readSpec();

    for (const required of [
      'pixel-cosmos personal OS',
      'personal space archive',
      'observing how personal records move through time',
      'Home = Signal Board',
      'Notes = Cosmos Map / Living Cosmos',
      'Archive = Voyager View / Time-Distance Archive',
      'Attachments = Inventory Bay',
      'Health = Status Core',
      'Schedule = Mission Orbit',
      'current signals',
      'present meaning space',
      'time as distance',
      'stored capsules and items',
      'workout-first',
      'future time',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('sets Notes, Archive, Home, and time boundaries', () => {
    const text = readSpec();

    for (const required of [
      'Notes/Cosmos is the living map of current notes and meaning',
      'meaning, relationship, and active knowledge space',
      'Archive carries the stronger time-distance / Voyager metaphor',
      'account-age or elapsed time causing the viewpoint to move farther is better suited to Archive than Notes',
      'Notes should not make active notes feel unreachable',
      'Notes = relationship space',
      'Archive = time-distance space',
      'Home = current signal surface',
      'Time is allowed to become a main Absinthe concept',
      'Chronos = actual timestamps',
      'Distance = old records becoming farther signals',
      'Signal = old records resurfacing or becoming relevant again',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines Notes visual metaphor terms', () => {
    const text = readSpec();

    for (const required of [
      '### Node',
      'individual note or record point',
      '### Signal',
      'activity, update, or relevance',
      '### Orbit',
      'relationship path, recurring theme, or tag-like grouping',
      '### Cluster',
      'group of related notes',
      '### Planet / Body',
      'larger or more central note/group',
      '### Satellite Viewpoint',
      'observes the note system from a controlled distance',
      '### Trace',
      'record left behind by note edits',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines future interaction, data, and accessibility boundaries', () => {
    const text = readSpec();

    for (const required of [
      'Readability before spectacle.',
      'Cosmos view is an alternate/exploratory layer',
      'No node should become inaccessible.',
      'Zoom/pan must be keyboard and pointer accessible.',
      'Graph/canvas should not be introduced until data model and accessibility strategy are defined.',
      'Relationship inference must be explicit and reversible if added.',
      'Do not rely on animation for meaning.',
      'Do not hide note content behind metaphor.',
      'automatic note relationship inference',
      'new data fields without a migration plan',
      'graph persistence',
      'canvas state persistence',
      'AI clustering',
      'account-age distance calculation in Notes',
      'remote sync behavior changes',
      'Local-first Notes remain the source of truth',
      'keyboard navigation for nodes',
      'visible focus for selected node',
      'list fallback required',
      'screen-reader accessible labels',
      'reduced motion support',
      'no color-only edges/status',
      'mobile fallback designed early',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines future phases and recommends K-215 IA/data boundary work', () => {
    const text = readSpec();

    for (const required of [
      'K-214: Notes/Cosmos Concept Spec',
      'K-215: Notes/Cosmos IA and Data Boundary Spec',
      'K-216: Notes/Cosmos Static Preview / Non-interactive Prototype',
      'K-217: Notes/Cosmos Accessibility and Navigation Plan',
      'K-218: Notes/Cosmos Minimal Interactive Pilot',
      'Implementation should not jump directly to canvas/graph.',
      'Preferred K-215 target: **K-215 Notes/Cosmos IA and Data Boundary Spec**.',
      'prevents graph/canvas work from touching persistence casually',
      'K-215 Notes/Cosmos Static Preview Spike',
      'non-interactive, mocked/static only',
      'no persistence changes',
      'no editor changes',
      'no graph engine',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and closes with narrow reversible implementation guidance', () => {
    const text = readSpec();

    for (const required of [
      '## Non-Goals',
      'no runtime UI implementation in K-214',
      'no graph/canvas/navigation implementation',
      'no node/orbit interaction',
      'no Archive/Voyager implementation',
      'no Home Signal Board implementation',
      'no editor changes',
      'no note persistence changes',
      'no routing changes',
      'no stores/schemas/providers changes',
      'no generated assets',
      'no fonts',
      'no dependencies',
      'no global theme rollout',
      'no Health/Schedule changes',
      'no attachment/OAuth/Supabase changes',
      'no Google Drive QA work',
      'Future implementation must proceed through narrow, reversible phases.',
      'Archive should carry the stronger Voyager/time-distance concept.',
      'Home should carry Signal Board/current traces.',
      'Notes should remain the living relationship map.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('does not contain obvious committed credential material', () => {
    const text = readSpec();

    for (const forbidden of [
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE ' + 'KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'access_' + 'token=',
      'refresh_' + 'token=',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
