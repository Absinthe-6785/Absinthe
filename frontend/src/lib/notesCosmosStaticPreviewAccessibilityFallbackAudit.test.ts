import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-274-notes-cosmos-static-preview-accessibility-fallback-audit.md',
);
const previewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const fixturePath = join(process.cwd(), 'src', 'lib', 'notesCosmosStaticPreviewMockContract.ts');
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
const staticHarnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-274 notes cosmos static preview accessibility fallback audit', () => {
  it('exists and defines docs/audit-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-274 Notes/Cosmos Static Preview Accessibility/Fallback Audit',
      'K-274 audits accessibility and fallback strength after the K-272 Static Preview visual grammar polish.',
      'K-274 is docs/audit plus audit test only.',
      'K-274 does not modify `NotesCosmosStaticPreview`.',
      'K-274 does not implement another Static Preview change.',
      'K-274 does not wire Static Preview into runtime.',
      'K-274 does not change route/nav/panel behavior.',
      'K-274 does not mount `NotesCosmosStaticPreview`.',
      'K-274 does not implement Runtime Cosmos Map.',
      'K-274 does not replace graph surfaces.',
      'K-274 chooses the K-275 next path',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-272 and K-273', () => {
    const doc = readDoc();

    for (const required of [
      'K-270 selected Static Preview continuation as an isolated visual/product grammar track.',
      'K-271 planned signal hierarchy polish.',
      'K-272 implemented isolated signal readout / hierarchy polish.',
      'K-273 closed K-272 with a docs/audit plus source-facts closure audit.',
      '`NotesCosmosStaticPreview` remains isolated/unwired.',
      'Static Preview remains fixture-driven and deterministic.',
      'Static Preview does not use live graph data.',
      'Static Preview does not read Notes stores.',
      'Static Preview does not persist coordinates/orbits/spatial metadata.',
      'Static Preview is not mounted in normal Notes navigation.',
      '`NoteGraphView` remains the shipped full-vault graph surface.',
      '`LocalGraphView` remains the local/context graph surface.',
      'Runtime Cosmos Map is not implemented.',
      'Backup/preflight guardrails remain infrastructure',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits accessibility and fallback status', () => {
    const doc = readDoc();

    for (const required of [
      '## Accessibility / Fallback Audit',
      'Fallback text remains present.',
      'Fallback text remains meaningful',
      'Semantic grouping remains preserved',
      'Essential information is not visual-only.',
      'The signal readout can be understood through text/structure, not only color.',
      'Readable typography expectations remain preserved',
      'Keyboard/readability expectations remain intact',
      'does not introduce buttons, links, canvas controls, hidden panels, or graph application roles',
      'No hidden runtime interaction is implied.',
      'No core Notes action is hidden behind visual spectacle.',
      'read-only static fixture',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits signal hierarchy as non-color-only', () => {
    const doc = readDoc();

    for (const required of [
      '## Signal Hierarchy Non-color-only Audit',
      'The primary signal is represented through source-visible text, label, data attribute, and grouping.',
      'Primary signal',
      'Signal tier: Primary signal',
      'data-signal-tier="primary"',
      'Secondary/supporting signals are represented through source-visible text, label, data attribute, and grouping.',
      'Secondary signals',
      'Signal tier: Secondary signal',
      'data-signal-tier="secondary"',
      'Faint/background signals are represented through source-visible text, label, data attribute, and grouping.',
      'Faint signals',
      'Signal tier: Faint signal',
      'data-signal-tier="faint"',
      '`data-signal-tier` exists as a source-visible non-color-only marker.',
      'The hierarchy does not rely only on color.',
      'The hierarchy remains meaning-bearing, not ornamental-only.',
      'The signal readout does not imply live graph data or shipped runtime navigation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits fallback content and semantic structure', () => {
    const doc = readDoc();

    for (const required of [
      '## Fallback Content Audit',
      'a fallback title.',
      'a fallback description.',
      'a mobile fallback note that names the 390px readable-text expectation.',
      'deterministic node order.',
      'node fallback summaries with labels, summaries, statuses, and dates.',
      'deterministic relationship order.',
      'relationship fallback summaries with labels, source IDs, and target IDs.',
      'Fallback covers the same conceptual information as the visual preview',
      'Fallback avoids claiming live graph/runtime features.',
      'Fallback avoids backup/Data Safety claims.',
      'No blocking fallback gap was found.',
      '## Semantic Structure Audit',
      'semantic top-level `article`',
      'aria-label="Static signal hierarchy readout"',
      'Nodes and relationships are grouped under headings.',
      'collections use ordered lists.',
      'each node renders literal kind, status, tone, signal tier, summary, cluster, created date, and freshness.',
      'Screen-reader-readable text exists for key preview concepts',
      '`data-node-status`, `data-node-tone`, and `data-signal-tier`',
      'Visual-only ornaments are avoided for essential meaning.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits responsive status and runtime isolation', () => {
    const doc = readDoc();

    for (const required of [
      '## Responsive / Viewport Audit',
      '390px/mobile expectations remain preserved',
      'No source-obvious horizontal overflow risk was introduced by K-272',
      '`break-words`, `min-w-0`, `max-w-full`',
      'Static HTML / viewport harness artifact is not committed.',
      'Browser visual QA was not rerun for K-273.',
      'K-274 is audit-only, so browser visual QA is not required',
      'Future runtime exposure would require fresh browser/390px proof.',
      '## Isolation / Runtime Wiring Audit',
      '`NotesCosmosStaticPreview` remains isolated.',
      'There is no normal Notes navigation wiring.',
      'There is no route/nav/panel.',
      'There is no hidden/default panel.',
      'There is no production runtime exposure.',
      'There is no Runtime Cosmos Map.',
      'There is no live Notes data.',
      'There are no Notes store reads.',
      'There is no graph builder coupling.',
      'There is no `KnowledgeIndexService` coupling.',
      'There is no provider/network/background sync.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('audits graph preservation and backup/provider boundary', () => {
    const doc = readDoc();

    for (const required of [
      '## Graph Surface Preservation Audit',
      '`NoteGraphView` remains the full-vault graph.',
      '`LocalGraphView` remains the local/context graph.',
      'Cosmos Map does not replace either.',
      'K-274 does not alter graph builders.',
      'K-274 does not couple to `KnowledgeIndexService`.',
      'K-274 does not introduce live graph data into Static Preview.',
      'Any future graph migration still requires an explicit decision.',
      '## Backup / Provider Boundary Audit',
      'no backup/preflight runtime implementation',
      'no Data Safety / Backup Health UI',
      'no export/import/restore behavior',
      'no restore preview/dry-run',
      'no attachment blob backup',
      'no provider-aware recovery',
      'no Supabase/OAuth/Google Drive behavior',
      'no provider/network/background sync behavior',
      'no attachment blob/provider behavior',
      'Backup/preflight guardrails remain carried forward but not productized here.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents validation status, gap decision, and K-275 path', () => {
    const doc = readDoc();

    for (const required of [
      '## Validation Audit',
      'K-273 audit/source checks passed.',
      'K-272 component/static preview tests passed.',
      'K-270/K-271/K-273 doc/audit tests passed.',
      'typecheck/build passed.',
      '`git diff --check` passed.',
      'no generated static harness artifact was committed.',
      'Manual browser QA is not required for K-274 because K-274 has no UI/browser runtime changes.',
      '## Accessibility / Fallback Gap Decision',
      'Option A is selected.',
      'No blocking accessibility/fallback gap was found.',
      'K-275 may move to viewport proof refresh plan or fixture semantics plan.',
      '## K-275 Decision',
      '**K-275 Notes/Cosmos Static Preview Viewport Proof Refresh Plan**',
      'docs/plan plus audit test only.',
      'decide whether to refresh static HTML/390px proof after the visual polish.',
      'no component implementation.',
      'no runtime wiring.',
      '**K-275 Notes/Cosmos Static Preview Accessibility/Fallback Polish Plan**',
      'Runtime Cosmos Map',
      'graph replacement',
      'route/nav/panel',
      'live Notes data',
      'backup/Data Safety UI',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and ends with the closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no NotesCosmosStaticPreview changes in K-274.',
      'no Static Preview implementation in K-274.',
      'no Static Preview runtime wiring.',
      'no route/nav/panel change.',
      'no NotesCosmosStaticPreview mounting.',
      'no hidden panel.',
      'no Runtime Cosmos Map implementation.',
      'no graph replacement.',
      'no NoteGraphView change.',
      'no LocalGraphView change.',
      'no graph builder change.',
      'no KnowledgeIndexService coupling.',
      'no live Notes data integration.',
      'no persistence/schema change.',
      'no coordinates/orbits/spatial metadata persistence.',
      'no canvas/SVG/WebGL graph engine.',
      'no backup/preflight runtime implementation.',
      'no Data Safety / Backup Health UI.',
      'no export blocking.',
      'no restore/import validation.',
      'no restore preview/dry-run.',
      'no attachment blob backup.',
      'no provider-aware recovery.',
      'no Supabase/OAuth/Google Drive behavior change.',
      'no Health/Schedule behavior change.',
      'no assets/fonts/dependencies.',
      'no generated static harness artifact commit.',
      '## Closure Statement',
      'K-274 audits accessibility and fallback after K-272/K-273 without changing the component.',
      'Static Preview remains fixture-driven, deterministic, isolated, and unwired.',
      'Signal hierarchy remains meaning-bearing and not color-only.',
      'Fallback/accessibility and 390px expectations remain preserved with no blocking gap.',
      'Existing graph surfaces remain preserved.',
      'Runtime Cosmos Map and graph replacement remain rejected.',
      'Future runtime exposure requires a separate gate and fresh browser/390px proof.',
      'Backup/preflight guardrails remain carried forward but not productized here.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms source accessibility and fallback markers remain present', () => {
    const source = readSource(previewPath);

    for (const required of [
      'aria-label="Static signal hierarchy readout"',
      'Signal readout',
      'Read-only signal preview',
      'Text fallback',
      'Node order',
      'Relationship order',
      'data-signal-tier',
      'data-node-status',
      'data-node-tone',
      'Primary signal',
      'Secondary signal',
      'Faint signal',
      'Signal tier:',
      'break-words',
      'min-w-0',
      'max-w-full',
    ]) {
      expect(source).toContain(required);
    }
  });

  it('confirms fixture fallback contract remains deterministic and text-first', () => {
    const source = readSource(fixturePath);

    for (const required of [
      'fallback:',
      'title:',
      'description:',
      'mobileNote:',
      'nodeOrder:',
      'nodeSummaries:',
      'relationshipOrder:',
      'relationshipSummaries:',
      'At 390px width',
      'text list remains the primary readable representation',
      'textFallbackRemainsUsable: true',
      'No runtime UI implementation.',
      'No graph or canvas rendering.',
      'No persisted spatial metadata.',
      'No replacement of NoteGraphView or LocalGraphView.',
    ]) {
      expect(source).toContain(required);
    }
  });

  it('confirms source boundaries stay preview-only and graph surfaces are not coupled to K-274', () => {
    const previewSource = readSource(previewPath);
    const fixtureSource = readSource(fixturePath);
    const graphSources = [readSource(noteGraphPath), readSource(localGraphPath)];

    for (const forbiddenImport of [
      /from ['"].*NoteGraphView/,
      /from ['"].*LocalGraphView/,
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
    ]) {
      expect(previewSource).not.toMatch(forbiddenImport);
      expect(fixtureSource).not.toMatch(forbiddenImport);
    }

    for (const source of graphSources) {
      expect(source).not.toContain('notesCosmosStaticPreviewAccessibilityFallbackAudit');
      expect(source).not.toContain('K-274 Notes/Cosmos Static Preview Accessibility/Fallback Audit');
      expect(source).not.toContain('K-275 Notes/Cosmos Static Preview Viewport Proof Refresh Plan');
    }
  });

  it('confirms generated static harness output is not committed', () => {
    expect(existsSync(staticHarnessOutputPath)).toBe(false);
  });

  it('does not contain obvious committed credential material', () => {
    const doc = readDoc();

    for (const forbidden of [
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE ' + 'KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'access_' + 'token=',
      'refresh_' + 'token=',
    ]) {
      expect(doc).not.toContain(forbidden);
    }
  });
});
