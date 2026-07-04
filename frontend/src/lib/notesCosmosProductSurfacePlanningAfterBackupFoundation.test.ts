import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-263-notes-cosmos-product-surface-planning-after-backup-foundation.md',
);
const noteGraphPath = join(process.cwd(), 'src', 'components', 'views', 'NoteGraphView.tsx');
const localGraphPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'features',
  'knowledge',
  'graph',
  'LocalGraphView.tsx',
);
const staticPreviewPath = join(
  process.cwd(),
  'src',
  'components',
  'notes',
  'NotesCosmosStaticPreview.tsx',
);
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-263 notes cosmos product surface planning after backup foundation', () => {
  it('documents docs/plan plus audit test scope and runtime non-implementation', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-263 Notes/Cosmos Product Surface Planning after Backup Foundation',
      'K-263 is docs/plan plus audit test only.',
      'K-263 does not implement UI.',
      'K-263 does not wire a runtime route/panel.',
      'K-263 does not mount `NotesCosmosStaticPreview`.',
      'K-263 does not replace existing graph surfaces.',
      'K-263 does not implement Cosmos Map.',
      'K-263 does not change persistence/schema.',
      'K-263 chooses the K-264 next path.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes backup foundation status and carry-forward guardrails', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-235 through K-261 established and closed the backup/export/preflight safety foundation.',
      'K-262 decided not to proceed directly into production backup runtime/productization.',
      'Production export preflight, export blocking, restore preview, Data Safety UI, attachment blob backup, provider-aware recovery, and `attachmentMetadataOnly` warning escalation remain deferred.',
      'local runtime data remains source of truth.',
      'no destructive restore default.',
      'no raw token/content/blob leakage.',
      'no silent provider/blob behavior changes.',
      'no backup safety claims beyond implementation.',
      'no production backup/preflight claims in Notes/Cosmos UI.',
      'no backup surface implementation in K-263.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current Notes/Cosmos state from K-214 through K-234', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-214 defined the conceptual model for Home, Notes/Cosmos, Archive, Attachments, Health, and Schedule.',
      'K-215 preserved IA/data boundaries',
      'K-216 audited current runtime surfaces.',
      '`NoteView` as the current Notes shell',
      '`NotesPixelCosmosEmptyState` as the empty-vault pixel-cosmos pilot',
      '`NoteGraphView` as the shipped full-vault graph surface',
      '`LocalGraphView` as the shipped local/context graph surface',
      'K-217 preserved `NoteGraphView` as the shipped full-vault graph and `LocalGraphView` as the local/context graph.',
      'Cosmos Map is not implemented.',
      'Cosmos Map must not replace `NoteGraphView` or `LocalGraphView` without a future migration decision.',
      'K-220 created the static fixture/mock contract.',
      'K-222 through K-224 created and polished the isolated `NotesCosmosStaticPreview`.',
      'K-225 through K-227 did not approve normal navigation/runtime panel wiring.',
      'K-228 through K-234 produced the viewport/static HTML harness proof path while keeping `NotesCosmosStaticPreview` unwired.',
      'Current product-facing Notes runtime should not be assumed changed',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines product direction and candidate Notes/Cosmos surfaces', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'Notes/Cosmos surface planning.',
      'Pixel/Cosmos product identity.',
      'surface-level clarity before implementation.',
      'small, reversible UI steps.',
      'no large graph/routing/persistence jumps.',
      'Absinthe is not generic productivity SaaS.',
      'Absinthe is a pixel-cosmos OS for observing personal records over time and meaning.',
      'Notes/Cosmos should express relationship/meaning space, not backup internals.',
      '### Option A: Notes Empty State product polish',
      '### Option B: Static Preview dev/test surface continuation',
      '### Option C: Notes Overview / Signal Panel concept',
      '### Option D: Cosmos navigation concept spec',
      '### Option E: Replace or modify NoteGraphView',
      '### Option F: Runtime Cosmos Map',
      'Not recommended.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('chooses K-264 product surface boundary audit and rejects risky next steps', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-263 chooses K-264 Notes/Cosmos Product Surface Boundary Audit as the primary next path.',
      'K-264 Notes/Cosmos Product Surface Boundary Audit.',
      'compare Option A Notes Empty State polish versus Option B Static Preview dev/test surface continuation.',
      'inspect current Notes runtime surfaces.',
      'choose one implementation candidate.',
      'preserve graph/runtime/persistence boundaries.',
      'no implementation.',
      'K-264 Notes Empty State Pixel-Cosmos Product Polish Plan.',
      'K-264 Notes/Cosmos Static Preview Productization Boundary Plan.',
      'runtime Cosmos Map.',
      'NoteGraphView replacement.',
      'LocalGraphView replacement.',
      'route/panel wiring.',
      'persistence/schema/spatial metadata.',
      'canvas/SVG/WebGL graph engine.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines Pixel/Cosmos grammar, concept boundary, static/runtime boundary, graph preservation, and local-first guardrails', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'Pixel is grammar, not decoration.',
      'Layout remains information-first.',
      'Typography remains readable.',
      'Interactions remain productive.',
      'cozy sci-fi.',
      'pixel observatory.',
      'personal space archive.',
      'Avoid overdecorated cosmic UI.',
      'Notes/Cosmos represents meaning/relationship space.',
      'Archive/Voyager/Time-Distance belongs primarily to Archive.',
      'Home Signal Board surfaces current signals.',
      'Satellite/cosmos metaphor should not make notes unreachable.',
      'Static preview remains fixture-driven unless explicitly changed.',
      'Static preview does not imply live graph data.',
      'Static preview does not imply persisted coordinates.',
      'Static preview does not imply runtime navigation.',
      '390px/mobile proof remains required before runtime surface exposure.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Cosmos Map does not replace either surface.',
      'K-263 adds no `KnowledgeIndexService` coupling.',
      'K-263 adds no persisted spatial metadata.',
      'local runtime data remains source of truth.',
      'no remote-first hydrate/fetch.',
      'no backup safety UI claims.',
      'no Supabase/OAuth/Google Drive behavior changes.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and closure statements', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Non-goals',
      'no UI implementation in K-263.',
      'no route/panel wiring.',
      'no `NotesCosmosStaticPreview` mounting.',
      'no normal Notes navigation change.',
      'no hidden panel.',
      'no Cosmos Map implementation.',
      'no graph replacement.',
      'no `NoteGraphView` change.',
      'no `LocalGraphView` change.',
      'no graph builder change.',
      'no `KnowledgeIndexService` coupling.',
      'no persistence/schema change.',
      'no coordinates/orbits/spatial metadata persistence.',
      'no canvas/SVG/WebGL graph engine.',
      'no backup/preflight runtime implementation.',
      'no Data Safety / Backup Health UI.',
      'no restore preview/dry-run.',
      'no attachment blob backup.',
      'no provider-aware recovery.',
      'no Health/Schedule behavior change.',
      'K-263 returns Absinthe from backup foundation work to Notes/Cosmos product surface planning.',
      'Existing Notes graph surfaces remain preserved.',
      'Static preview remains isolated unless a future milestone changes it.',
      'K-264 should choose the first small Notes/Cosmos product surface step.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-263 does not alter runtime graph, preview, export, or restore sources', () => {
    const sources = [
      readFileSync(noteGraphPath, 'utf8'),
      readFileSync(localGraphPath, 'utf8'),
      readFileSync(staticPreviewPath, 'utf8'),
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('notesCosmosProductSurfacePlanningAfterBackupFoundation');
      expect(source).not.toContain('K-263 Notes/Cosmos Product Surface Planning');
      expect(source).not.toContain('K-264 Notes/Cosmos Product Surface Boundary Audit');
      expect(source).not.toContain('product-surface-planning-after-backup-foundation');
    }
  });
});
