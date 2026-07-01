import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const auditPath = join(
  process.cwd(),
  'docs',
  'K-223-notes-cosmos-static-preview-skeleton-isolation-audit.md',
);
const componentPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const srcPath = join(process.cwd(), 'src');

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      collectSourceFiles(path, files);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

function importedModules(source: string): string[] {
  return [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
}

describe('K-223 Notes/Cosmos static preview skeleton isolation audit', () => {
  it('exists and defines docs/audit-only closure scope', () => {
    expect(existsSync(auditPath)).toBe(true);
    const text = readText(auditPath);

    for (const required of [
      'K-223 Notes/Cosmos Static Preview Skeleton Isolation Audit',
      'K-223 audits the K-222 Notes/Cosmos static preview skeleton',
      'K-223 is docs/audit only.',
      'It does not implement runtime UI',
      'does not implement runtime UI, expand the component, wire the component into Notes',
      'recommends whether K-224 should be polish/mobile hardening',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('summarizes K-222 and identifies the audited component, test, doc, and fixture paths', () => {
    const text = readText(auditPath);

    for (const required of [
      '## K-222 Summary',
      'isolated component skeleton added',
      'fixture-driven from the K-220 mock contract',
      'renders 10 nodes and 12 relationships',
      'fallback text/list rendering exists',
      'Component path: `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`',
      'Test path: `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`',
      'K-222 doc path: `frontend/docs/K-222-notes-cosmos-static-preview-component-skeleton.md`',
      'Fixture contract path: `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`',
      '`notesCosmosStaticPreviewFixture` as static mock data, not live graph data.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents forbidden import and runtime wiring audit conclusions', () => {
    const text = readText(auditPath);

    for (const required of [
      '## Forbidden Import Audit',
      'NoteView',
      'NoteGraphView',
      'NoteGraphViewLazy',
      'LocalGraphView',
      'ProductEmptyState',
      'NotesPixelCosmosEmptyState',
      'KnowledgeIndexService',
      'graph data builders',
      'stores',
      'providers',
      'persistence',
      'Supabase',
      'Google Drive',
      'attachment upload/recovery',
      'routing/app shell',
      'Health/Schedule',
      'Runtime surfaces also do not import the K-222 component.',
      'no stores/persistence/schema/provider changes',
      'no assets/fonts/dependencies',
      'no route/navigation wiring',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents fixture coverage, relationship boundaries, spatial metadata, and fallback accessibility', () => {
    const text = readText(auditPath);

    for (const required of [
      '## Fixture Coverage Audit',
      'fixture title and description',
      'all 10 nodes',
      'all 12 relationships',
      'Cluster labels',
      'Relationships are top-level only',
      'Nodes do not introduce `relationships` or `relationshipIds`.',
      'No `x`, `y`, coordinate fields',
      'persisted spatial metadata',
      '`positionHint` remains fixture-only',
      'Relationship kinds from K-220 remain authoritative',
      '## Fallback And Accessibility Audit',
      'All nodes have text/list representation.',
      'All relationships have text/list representation.',
      'Color is not the only meaning.',
      'no hover-only critical meaning',
      'no fake interactive graph control',
      'Reduced motion is satisfied by no motion.',
      'Screen-reader fallback remains a future verification point',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents K-222 follow-up findings and recommends K-224 polish/mobile hardening', () => {
    const text = readText(auditPath);

    for (const required of [
      '## Tone Field Finding',
      'K-222 does not render `tone` visibly/accessibly as literal node text.',
      'K-224 should either render tone as literal text or document why tone remains non-visual',
      '## Mobile / 390px Finding',
      '390px mobile acceptance',
      'No browser-level 390px no-overflow smoke',
      'K-224 should strengthen mobile/no-overflow verification',
      '## Tailwind / CSS Scope Finding',
      'component-scoped',
      'No global CSS, theme tokens, assets, fonts, or dependencies changed.',
      '## Doc Typo / Manual QA Finding',
      'NotesCosmosStaticPreview.test.tsx',
      'NotesCosmosStaticPreview.test.ts',
      'browser QA was not required because the component is unwired.',
      'K-222 risk is Medium because component code exists.',
      'Recommended next target: **K-224 Notes/Cosmos Static Preview Skeleton Polish and Mobile Hardening**.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and blocks runtime integration before a separate placement decision', () => {
    const text = readText(auditPath);

    for (const required of [
      '## Non-Goals',
      'no runtime UI implementation in K-223',
      'no component expansion in K-223',
      'no route/navigation wiring',
      'no NoteView changes',
      'no NoteGraphView changes',
      'no LocalGraphView changes',
      'no ProductEmptyState changes',
      'no NotesPixelCosmosEmptyState changes',
      'no graph/canvas/orbit map',
      'no live graph data',
      'no KnowledgeIndexService or graph builder coupling',
      'no stores/schemas/providers/persistence changes',
      'no editor changes',
      'no OAuth/Supabase/attachment behavior',
      'no Health/Schedule behavior',
      'no assets/fonts/dependencies',
      'No Notes/Cosmos runtime integration should occur until a separate dev/test surface or runtime placement decision is approved.',
      'NoteGraphView and LocalGraphView remain preserved.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('confirms the component import boundary stays fixture-only and runtime surfaces do not import it', () => {
    const componentSource = readText(componentPath);

    expect(importedModules(componentSource)).toEqual([
      'react',
      '../../lib/notesCosmosStaticPreviewMockContract',
    ]);

    for (const forbiddenImport of [
      /from ['"].*NoteView/,
      /from ['"].*NoteGraphView/,
      /from ['"].*NoteGraphViewLazy/,
      /from ['"].*LocalGraphView/,
      /from ['"].*ProductEmptyState/,
      /from ['"].*NotesPixelCosmosEmptyState/,
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*buildGlobalGraphData/,
      /from ['"].*buildExpandedGraphData/,
      /from ['"].*useNotesStore/,
      /from ['"].*store/,
      /from ['"].*provider/i,
      /from ['"].*persistence/i,
      /from ['"].*supabase/i,
      /from ['"].*google/i,
      /from ['"].*attac.*hment/i,
      /from ['"].*\.(png|jpg|jpeg|webp|woff|woff2|ttf)/,
    ]) {
      expect(componentSource).not.toMatch(forbiddenImport);
    }

    const importLocations = collectSourceFiles(srcPath)
      .filter(path => !path.endsWith('NotesCosmosStaticPreview.tsx'))
      .filter(path => !path.endsWith('.test.ts'))
      .filter(path => !path.endsWith('.test.tsx'))
      .filter(path => readText(path).includes('NotesCosmosStaticPreview'));

    expect(importLocations).toEqual([]);
  });
});
