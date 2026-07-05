import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-275-notes-cosmos-static-preview-viewport-proof-refresh-plan.md',
);
const previewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');
const harnessScriptPath = join(process.cwd(), 'scripts', 'renderNotesCosmosStaticPreview.mjs');
const staticHarnessOutputPath = join(process.cwd(), 'dist', 'notes-cosmos-static-preview');

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('K-275 notes cosmos static preview viewport proof refresh plan', () => {
  it('exists and defines docs/plan-only scope', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = readDoc();

    for (const required of [
      'K-275 Notes/Cosmos Static Preview Viewport Proof Refresh Plan',
      'K-275 plans whether Static Preview viewport proof should be refreshed after the K-272 signal hierarchy polish.',
      'K-275 is docs/plan plus audit test only.',
      'K-275 does not modify `NotesCosmosStaticPreview`.',
      'K-275 does not implement another Static Preview change.',
      'K-275 does not generate or commit static harness artifacts.',
      'K-275 does not wire Static Preview into runtime.',
      'K-275 does not change route/nav/panel behavior.',
      'K-275 does not mount `NotesCosmosStaticPreview`.',
      'K-275 does not implement Runtime Cosmos Map.',
      'K-275 does not replace graph surfaces.',
      'K-275 chooses the K-276 next path',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state after K-272 through K-274', () => {
    const doc = readDoc();

    for (const required of [
      'K-270 selected Static Preview continuation as an isolated visual/product grammar track.',
      'K-271 planned signal hierarchy polish.',
      'K-272 implemented isolated signal readout / hierarchy polish.',
      'K-273 closed K-272.',
      'K-274 found no blocking accessibility/fallback gap for isolated Static Preview closure.',
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

  it('documents existing viewport proof lineage and current proof status', () => {
    const doc = readDoc();

    for (const required of [
      '## Existing Viewport Proof Lineage',
      'K-228 identified the need for real viewport proof',
      'K-229 audited feasibility',
      'K-230 planned the static HTML viewport harness.',
      'K-231 specified generator, output, command, CSS, and cleanup expectations.',
      'K-232 implemented the static HTML viewport harness generator',
      'K-233 closed the generator with no generated HTML committed.',
      'K-234 audited viewport/QA evidence',
      'generated proof artifacts are temporary and must not be committed.',
      '## Current Viewport Proof Status',
      'The previous viewport proof evidence comes from the K-232 through K-234 static HTML harness line.',
      'The previous proof predates K-272.',
      'K-272 changed visible layout, hierarchy, labels, grouping, and text',
      'K-274 accessibility/fallback audit reduced accessibility uncertainty',
      'Current proof is sufficient for isolated component closure',
      'Future runtime exposure would require fresh browser/390px proof regardless.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('states the refresh need decision and proposed proof scope', () => {
    const doc = readDoc();

    for (const required of [
      '## Refresh Need Decision',
      'Option A is selected.',
      'Refresh is recommended before closing the Static Preview visual polish line.',
      'K-272 changed enough visual hierarchy/readout structure that 390px/static proof should be refreshed.',
      'K-276 should be a viewport proof refresh/audit PR.',
      'This does not mean runtime readiness.',
      '## Proposed Viewport Proof Scope If Refreshed',
      '390px/narrow viewport check.',
      'no horizontal overflow.',
      'signal readout remains readable.',
      'primary/secondary/faint hierarchy remains distinguishable.',
      '`Signal tier` labels remain readable.',
      'fallback/summary remains present.',
      'fixture-driven static content renders.',
      'all 10 nodes render',
      'all 12 relationships render',
      'no route/nav/panel/runtime mounting.',
      'no generated artifact committed.',
      'cleanup confirmed after generation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents existing harness command plan and generated artifact policy', () => {
    const doc = readDoc();

    for (const required of [
      '## Existing Harness / Command Plan',
      '`frontend/scripts/renderNotesCosmosStaticPreview.mjs`',
      'node .\\scripts\\renderNotesCosmosStaticPreview.mjs',
      'node scripts/renderNotesCosmosStaticPreview.mjs',
      'frontend/dist/notes-cosmos-static-preview/index.html',
      'Remove-Item -LiteralPath frontend\\dist\\notes-cosmos-static-preview -Recurse -Force',
      'Generated HTML should be excluded from git because `dist/` is ignored.',
      'What counts as proof:',
      'generator command completed.',
      'viewport width was set to 390px.',
      'artifact cleanup was confirmed.',
      'What does not count as proof:',
      'JSDOM or SSR-only assertions.',
      'normal app route, hidden panel, or runtime navigation exposure.',
      '## Generated Artifact Policy',
      'Generated static HTML artifacts must be temporary.',
      'Generated artifacts must not be committed.',
      'Git status must be clean of generated output before commit.',
      'Static harness output should be deleted after inspection.',
      'must not change package.json, Vite config, Tailwind config, fonts, assets, or dependencies',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines runtime exposure, graph, and backup/provider boundaries', () => {
    const doc = readDoc();

    for (const required of [
      '## Runtime Exposure Boundary',
      'Viewport proof refresh does not imply runtime product readiness.',
      'Viewport proof refresh does not imply Static Preview can be mounted.',
      'There must be no normal Notes navigation wiring.',
      'There must be no route/nav/panel.',
      'There must be no hidden/default panel.',
      'There must be no Runtime Cosmos Map.',
      'There must be no live Notes data.',
      'There must be no Notes store reads.',
      'There must be no graph builder coupling.',
      'There must be no `KnowledgeIndexService` coupling.',
      'Future runtime exposure requires a separate gate and fresh proof.',
      '## Graph Surface Preservation',
      '`NoteGraphView` remains the full-vault graph.',
      '`LocalGraphView` remains the local/context graph.',
      'Cosmos Map does not replace either.',
      'K-275 does not alter graph builders.',
      'K-275 does not couple to `KnowledgeIndexService`.',
      'K-275 does not introduce live graph data into Static Preview.',
      '## Backup / Provider Boundary',
      'no backup/preflight runtime implementation',
      'no Data Safety / Backup Health UI',
      'no export/import/restore behavior',
      'no restore preview/dry-run',
      'no attachment blob backup',
      'no provider-aware recovery',
      'no Supabase/OAuth/Google Drive behavior',
      'no provider/network/background sync behavior',
      'no attachment blob/provider behavior',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('recommends the K-276 path and defines validation expectations', () => {
    const doc = readDoc();

    for (const required of [
      '## K-276 Decision',
      '**K-276 Notes/Cosmos Static Preview Viewport Proof Refresh**',
      'run the existing static HTML/viewport harness.',
      'document proof results.',
      'do not commit generated artifact.',
      'no component implementation.',
      'no runtime wiring.',
      '**K-276 Notes/Cosmos Static Preview Viewport Proof Command Audit**',
      '**K-276 Notes/Cosmos Static Preview Visual Grammar Closure Audit**',
      '**K-276 Notes/Cosmos Static Preview Fixture Semantics Plan**',
      'Runtime Cosmos Map',
      'graph replacement',
      'route/nav/panel',
      'live Notes data',
      'backup/Data Safety UI',
      '## Validation Expectations For K-276',
      'run the existing static HTML/viewport command.',
      'inspect 390px/narrow viewport output.',
      'document no horizontal overflow.',
      'document signal readout readability.',
      'delete generated artifact before commit.',
      'run K-270 through K-275 audit tests.',
      'confirm no runtime route/nav/panel changes.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('lists non-goals and ends with the closure statement', () => {
    const doc = readDoc();

    for (const required of [
      '## Non-goals',
      'no NotesCosmosStaticPreview changes in K-275.',
      'no Static Preview implementation in K-275.',
      'no generated static harness artifact commit.',
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
      '## Closure Statement',
      'K-275 decides whether viewport proof should be refreshed after K-272 without changing the component.',
      'Static Preview remains fixture-driven, deterministic, isolated, and unwired.',
      'Accessibility/fallback has no blocking gap for isolated closure from K-274.',
      'Generated proof artifacts remain temporary and uncommitted.',
      'Viewport proof refresh, if chosen, does not imply runtime readiness.',
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

  it('confirms source facts for the existing harness and static preview component', () => {
    expect(existsSync(previewPath)).toBe(true);
    expect(existsSync(harnessScriptPath)).toBe(true);

    const source = readSource(harnessScriptPath);

    for (const required of [
      "'dist', 'notes-cosmos-static-preview'",
      "'index.html'",
      'NotesCosmosStaticPreview',
      'notesCosmosStaticPreviewFixture',
      'renderToStaticMarkup',
      'server.ssrLoadModule',
      'Manual 390px QA checklist',
      'Do not commit generated HTML.',
      'Remove-Item -Recurse -Force .\\\\dist\\\\notes-cosmos-static-preview',
    ]) {
      expect(source).toContain(required);
    }
  });

  it('confirms no generated static harness artifact is present', () => {
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
