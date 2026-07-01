import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const specPath = join(process.cwd(), 'docs', 'K-215-notes-cosmos-ia-data-boundary-spec.md');

function readSpec(): string {
  return readFileSync(specPath, 'utf8');
}

describe('K-215 Notes/Cosmos IA and data boundary spec', () => {
  it('exists and defines docs-only scope with no runtime implementation', () => {
    expect(existsSync(specPath)).toBe(true);
    const text = readSpec();

    for (const required of [
      'K-215 Notes/Cosmos IA and Data Boundary Spec',
      'K-215 translates the K-214 Notes/Cosmos concept into information architecture and data boundaries',
      'K-215 is docs/spec only',
      'K-215 does not implement runtime UI',
      'K-215 does not change the data model, stores, providers, persistence, routing, editor behavior',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents current shipped Notes surfaces', () => {
    const text = readSpec();

    for (const required of [
      '## Current Shipped Notes Surfaces',
      'Current runtime: `NoteView` is the primary Notes workspace shell.',
      'Notes List / Editor Surface',
      'Notes Empty State Pixel-Cosmos Pilot',
      'Current runtime: `NotesPixelCosmosEmptyState` is the K-212 empty-vault pixel-cosmos pilot.',
      'Existing NoteGraphView',
      'Current runtime: `NoteGraphView` is an existing shipped graph/relationship view.',
      'search and filter the sidebar note list',
      'create, open, edit, duplicate, star, trash, restore, and permanently delete notes',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines the existing NoteGraphView relationship to future Cosmos Map', () => {
    const text = readSpec();

    for (const required of [
      'Existing NoteGraphView remains the current shipped graph/relationship view.',
      'Future Cosmos Map is a broader product concept, not automatically a replacement for NoteGraphView.',
      'Cosmos Map may later reuse, wrap, visually reinterpret, or replace NoteGraphView',
      'Future work must avoid duplicate graph/navigation responsibilities.',
      'NoteGraphView owns the current shipped graph behavior.',
      'Cosmos Map is a future concept and not yet implemented as a separate surface.',
      'does not authorize a new graph engine',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines Notes IA and cross-surface boundaries', () => {
    const text = readSpec();

    for (const required of [
      '## Notes IA Boundary',
      'list/search/filter',
      'editor/detail',
      'empty state',
      'current graph view',
      'future Cosmos preview/map',
      'Cosmos must not replace list/editor.',
      'Cosmos must have a list fallback.',
      '## Cross-Surface IA Boundary',
      'Home = Signal Board',
      'Home should not become full graph navigation',
      'Notes = Cosmos Map / Living Cosmos',
      'Archive = Voyager View / Time-Distance Archive',
      'Archive owns the stronger Voyager / Pale Blue Dot metaphor',
      'Attachments = Inventory Bay',
      'Health = Status Core',
      'Schedule = Mission Orbit',
      'Schedule should not become a graph/cosmos surface',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines data inventory and data boundary rules', () => {
    const text = readSpec();

    for (const required of [
      '## Data Inventory',
      'note id',
      'note title',
      'note body/content',
      'createdAt',
      'updatedAt',
      'tags/labels',
      'links/backlinks',
      'explicit relations',
      'graph layout positions',
      'user account age',
      'AI clusters',
      '## Data Boundary Rules',
      'Local-first Notes remain source of truth.',
      'No remote-first graph hydration.',
      'No new Note fields in K-215.',
      'No Supabase sync changes.',
      'No IndexedDB migration.',
      'No schema/provider/store changes.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines relationship model options and prefers observable relationships', () => {
    const text = readSpec();

    for (const required of [
      '## Relationship Model Options',
      '### 1. Explicit Links',
      '### 2. Tags / Topics',
      '### 3. Temporal Adjacency',
      '### 4. Attachment Co-occurrence',
      '### 5. Search / Session Context',
      '### 6. AI Semantic Clustering',
      'early Cosmos should prefer explicit/observable relationships before opaque AI inference',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines spatial metadata, time/Voyager, and accessibility boundaries', () => {
    const text = readSpec();

    for (const required of [
      '## Spatial / Visual Metadata Boundary',
      'K-215 does not add spatial metadata.',
      'Any persisted node position requires a separate data model and migration spec.',
      'Computed/non-persistent layout is safest for a first preview.',
      '## Time / Voyager Boundary',
      'Account-age satellite distance is better suited to Archive than Notes.',
      'Notes should not make active notes feel far away simply because they are old.',
      'account-age zoom-out mechanic in active Notes',
      'replacing list sort with visual distance',
      '## Accessibility / Navigation Boundary',
      'keyboard navigation required for nodes',
      'list fallback required',
      'screen-reader labels required for nodes and edges',
      'zoom/pan controls must be keyboard accessible',
      'graph/canvas must have a non-canvas fallback or accessible equivalent',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines phases, K-216 recommendation, non-goals, and closure guidance', () => {
    const text = readSpec();

    for (const required of [
      'K-215: Notes/Cosmos IA and Data Boundary Spec',
      'K-216: Notes/Cosmos Current Surface Audit',
      'K-217: Notes/Cosmos Static Preview Plan',
      'K-218: Notes/Cosmos Accessibility and Navigation Plan',
      'K-219: Notes/Cosmos Non-Interactive Static Preview Pilot',
      'K-220: Notes/Cosmos Minimal Interactive Pilot',
      'Recommended K-216 target: **K-216 Notes/Cosmos Current Surface Audit**.',
      '## Non-Goals',
      'no runtime UI implementation in K-215',
      'no NoteGraphView changes',
      'no NoteView changes',
      'no NotesPixelCosmosEmptyState changes',
      'no generated assets',
      'no fonts',
      'no dependencies',
      'no attachment/OAuth/Supabase changes',
      'Future implementation must be narrow, reversible, and accessible.',
      'current-surface audit before any graph/canvas pilot',
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
