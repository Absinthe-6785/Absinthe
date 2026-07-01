import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NOTES_COSMOS_PREVIEW_NODE_KINDS,
  NOTES_COSMOS_PREVIEW_NODE_STATUSES,
  NOTES_COSMOS_PREVIEW_NODE_TONES,
  NOTES_COSMOS_PREVIEW_POSITION_DENSITIES,
  NOTES_COSMOS_PREVIEW_POSITION_RINGS,
  NOTES_COSMOS_PREVIEW_RELATIONSHIP_KINDS,
  NOTES_COSMOS_PREVIEW_RELATIONSHIP_STRENGTHS,
  NOTES_COSMOS_PREVIEW_SIZE_BUDGET,
  notesCosmosStaticPreviewFixture,
  validateNotesCosmosPreviewFixture,
} from './notesCosmosStaticPreviewMockContract';

const sourcePath = join(process.cwd(), 'src', 'lib', 'notesCosmosStaticPreviewMockContract.ts');

function readSource(): string {
  return readFileSync(sourcePath, 'utf8');
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

describe('K-220 Notes/Cosmos static preview mock contract', () => {
  it('exports a static fixture and avoids runtime service imports', () => {
    expect(notesCosmosStaticPreviewFixture.id).toBe('notes-cosmos-static-preview-fixture-v1');
    expect(validateNotesCosmosPreviewFixture(notesCosmosStaticPreviewFixture)).toEqual({
      valid: true,
      errors: [],
    });

    const source = readSource();
    for (const forbiddenImport of [
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*buildGlobalGraphData/,
      /from ['"].*buildExpandedGraphData/,
      /from ['"].*useNotesStore/,
      /from ['"].*notePersistence/,
      /from ['"].*supabase/i,
      /from ['"].*googleDrive/i,
      /from ['"].*attac.*hment/i,
      /from ['"].*NoteView/,
      /from ['"].*NoteGraphView/,
      /from ['"].*LocalGraphView/,
    ]) {
      expect(source).not.toMatch(forbiddenImport);
    }
  });

  it('keeps node and relationship counts inside the static preview budget', () => {
    expect(notesCosmosStaticPreviewFixture.nodes.length).toBeGreaterThanOrEqual(
      NOTES_COSMOS_PREVIEW_SIZE_BUDGET.minNodes,
    );
    expect(notesCosmosStaticPreviewFixture.nodes.length).toBeLessThanOrEqual(
      NOTES_COSMOS_PREVIEW_SIZE_BUDGET.maxNodes,
    );
    expect(notesCosmosStaticPreviewFixture.relationships.length).toBeGreaterThanOrEqual(
      NOTES_COSMOS_PREVIEW_SIZE_BUDGET.minRelationships,
    );
    expect(notesCosmosStaticPreviewFixture.relationships.length).toBeLessThanOrEqual(
      NOTES_COSMOS_PREVIEW_SIZE_BUDGET.maxRelationships,
    );
  });

  it('keeps top-level-only relationship representation with unique references', () => {
    const nodeIds = new Set(notesCosmosStaticPreviewFixture.nodes.map(node => node.id));
    const relationshipIds = new Set(
      notesCosmosStaticPreviewFixture.relationships.map(relationship => relationship.id),
    );

    expect(nodeIds.size).toBe(notesCosmosStaticPreviewFixture.nodes.length);
    expect(relationshipIds.size).toBe(notesCosmosStaticPreviewFixture.relationships.length);

    for (const node of notesCosmosStaticPreviewFixture.nodes) {
      expect('relationships' in node).toBe(false);
      expect('relationshipIds' in node).toBe(false);
    }

    for (const relationship of notesCosmosStaticPreviewFixture.relationships) {
      expect(nodeIds.has(relationship.sourceId)).toBe(true);
      expect(nodeIds.has(relationship.targetId)).toBe(true);
    }
  });

  it('keeps required node fields literal and bounded', () => {
    for (const node of notesCosmosStaticPreviewFixture.nodes) {
      expect(node.id).toBeTruthy();
      expect(node.label).toBeTruthy();
      expect(node.summary).toBeTruthy();
      expect(NOTES_COSMOS_PREVIEW_NODE_KINDS).toContain(node.kind);
      expect(NOTES_COSMOS_PREVIEW_NODE_TONES).toContain(node.tone);
      expect(NOTES_COSMOS_PREVIEW_NODE_STATUSES).toContain(node.status);
      expect(node.clusterId).toBeTruthy();
      expect(node.clusterLabel).toBeTruthy();
      expect(node.createdAtLabel).toBeTruthy();
      expect(node.updatedAtLabel).toBeTruthy();
    }
  });

  it('keeps relationship fields literal and bounded', () => {
    for (const relationship of notesCosmosStaticPreviewFixture.relationships) {
      expect(relationship.id).toBeTruthy();
      expect(relationship.sourceId).toBeTruthy();
      expect(relationship.targetId).toBeTruthy();
      expect(relationship.label).toBeTruthy();
      expect(NOTES_COSMOS_PREVIEW_RELATIONSHIP_KINDS).toContain(relationship.kind);
      expect(NOTES_COSMOS_PREVIEW_RELATIONSHIP_STRENGTHS).toContain(relationship.strength);
    }
  });

  it('keeps position hints fixture-only and free of coordinate fields', () => {
    const forbiddenKeys = [
      'x',
      'y',
      'vx',
      'vy',
      'coordinate',
      'coordinates',
      'orbitCoordinate',
      'savedLayout',
      'layoutState',
    ];
    const keys = collectKeys(notesCosmosStaticPreviewFixture);

    for (const forbiddenKey of forbiddenKeys) {
      expect(keys.has(forbiddenKey)).toBe(false);
    }

    for (const node of notesCosmosStaticPreviewFixture.nodes) {
      expect(node.positionHint).toBeTruthy();
      if (!node.positionHint) continue;
      expect(Object.keys(node.positionHint).sort()).toEqual(['density', 'order', 'ring']);
      expect(NOTES_COSMOS_PREVIEW_POSITION_RINGS).toContain(node.positionHint.ring);
      expect(NOTES_COSMOS_PREVIEW_POSITION_DENSITIES).toContain(node.positionHint.density);
      expect(Number.isInteger(node.positionHint.order)).toBe(true);
    }
  });

  it('includes deterministic accessibility fallback text for every node and relationship', () => {
    const fixture = notesCosmosStaticPreviewFixture;
    const nodeIds = fixture.nodes.map(node => node.id);
    const relationshipIds = fixture.relationships.map(relationship => relationship.id);

    expect(fixture.fallback.title).toBeTruthy();
    expect(fixture.fallback.description).toBeTruthy();
    expect(fixture.fallback.mobileNote).toContain('390px');
    expect(fixture.fallback.nodeOrder).toEqual(nodeIds);
    expect(fixture.fallback.relationshipOrder).toEqual(relationshipIds);

    for (const node of fixture.nodes) {
      const fallback = fixture.fallback.nodeSummaries.find(summary => summary.id === node.id);
      expect(fallback).toBeTruthy();
      expect(fallback?.label).toBe(node.label);
      expect(fallback?.summary).toContain(node.status);
    }

    for (const relationship of fixture.relationships) {
      const fallback = fixture.fallback.relationshipSummaries.find(
        summary => summary.id === relationship.id,
      );
      expect(fallback).toBeTruthy();
      expect(fallback?.sourceId).toBe(relationship.sourceId);
      expect(fallback?.targetId).toBe(relationship.targetId);
      expect(fallback?.label).toBe(relationship.label);
    }
  });

  it('represents mobile and responsive acceptance metadata', () => {
    expect(notesCosmosStaticPreviewFixture.responsiveAcceptance).toEqual({
      minMobileWidthPx: 390,
      noHorizontalOverflow: true,
      readableLabels: true,
      noClippedPrimaryContent: true,
      textFallbackRemainsUsable: true,
    });
  });

  it('records non-goals without runtime, credential, transfer, or graph replacement claims', () => {
    expect(notesCosmosStaticPreviewFixture.nonGoals).toContain('No runtime UI implementation.');
    expect(notesCosmosStaticPreviewFixture.nonGoals).toContain('No graph or canvas rendering.');
    expect(notesCosmosStaticPreviewFixture.nonGoals).toContain(
      'No replacement of NoteGraphView or LocalGraphView.',
    );
    expect(notesCosmosStaticPreviewFixture.nonGoals).toContain('No remote data transfer behavior.');

    const source = readSource();
    for (const forbidden of [
      'K-220 implements',
      'runtime Cosmos Map is implemented',
      'new graph engine is implemented',
      'up' + 'load queue execution',
      'Upload ' + 'all',
      'Run ' + 'queue',
      'sy' + 'nc now',
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE ' + 'KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'access_' + 'token=',
      'refresh_' + 'token=',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
