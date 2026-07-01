import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createLogger, createServer, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const outputDir = path.resolve(frontendRoot, 'dist', 'notes-cosmos-static-preview');
const outputFile = path.join(outputDir, 'index.html');
const previewModulePath = normalizePath(
  path.join(frontendRoot, 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx'),
);
const fixtureModulePath = normalizePath(
  path.join(frontendRoot, 'src', 'lib', 'notesCosmosStaticPreviewMockContract.ts'),
);

function createHarnessLogger() {
  const logger = createLogger('error');
  const originalError = logger.error.bind(logger);
  logger.error = (message, options) => {
    if (String(message).includes('Failed to scan for dependencies')) {
      return;
    }
    originalError(message, options);
  };
  return logger;
}

function assertInsideFrontendDist(targetPath) {
  const distRoot = path.resolve(frontendRoot, 'dist');
  const relative = path.relative(distRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside frontend/dist: ${targetPath}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildHarnessCss() {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html {
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      background: #f6f3ee;
      color: #1f2937;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    body {
      margin: 0;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      background: #f6f3ee;
    }
    .harness-shell {
      width: 100%;
      max-width: 1120px;
      min-width: 0;
      margin: 0 auto;
      padding: 20px;
    }
    .harness-banner,
    .harness-checklist {
      width: 100%;
      min-width: 0;
      border: 1px solid #d8d3ca;
      border-radius: 12px;
      background: #fffaf3;
      padding: 14px;
      margin-bottom: 16px;
      overflow-wrap: anywhere;
    }
    .harness-eyebrow {
      margin: 0 0 4px;
      color: #6b7280;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .harness-title {
      margin: 0;
      font-size: clamp(20px, 5vw, 28px);
      line-height: 1.2;
      color: #111827;
      overflow-wrap: anywhere;
    }
    .harness-note,
    .harness-checklist li {
      color: #4b5563;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .harness-note {
      margin: 8px 0 0;
    }
    .harness-checklist {
      margin-top: 16px;
      margin-bottom: 0;
    }
    .harness-checklist h2 {
      margin: 0 0 8px;
      color: #111827;
      font-size: 15px;
    }
    .harness-checklist ol {
      margin: 0;
      padding-left: 20px;
    }
    .notes-cosmos-static-preview,
    [data-notes-cosmos-static-preview] {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      overflow: hidden;
      border: 1px solid #d8d3ca;
      border-radius: 12px;
      background: #f8fafc;
      color: #111827;
      padding: 16px;
    }
    [data-notes-cosmos-static-preview] *,
    [data-notes-cosmos-static-preview] *::before,
    [data-notes-cosmos-static-preview] *::after {
      box-sizing: border-box;
      max-width: 100%;
      min-width: 0;
    }
    [data-notes-cosmos-static-preview] header {
      border-bottom: 1px solid #d8d3ca;
      padding-bottom: 16px;
    }
    [data-notes-cosmos-static-preview] h2,
    [data-notes-cosmos-static-preview] h3,
    [data-notes-cosmos-static-preview] h4,
    [data-notes-cosmos-static-preview] p,
    [data-notes-cosmos-static-preview] strong,
    [data-notes-cosmos-static-preview] span,
    [data-notes-cosmos-static-preview] li {
      overflow-wrap: anywhere;
      word-break: normal;
    }
    [data-notes-cosmos-static-preview] h2 {
      margin: 4px 0 0;
      font-size: clamp(20px, 5vw, 26px);
      line-height: 1.25;
      color: #0f172a;
    }
    [data-notes-cosmos-static-preview] h3 {
      margin: 0 0 10px;
      font-size: 15px;
      color: #0f172a;
    }
    [data-notes-cosmos-static-preview] h4 {
      margin: 0;
      font-size: 14px;
      color: #1f2937;
    }
    [data-notes-cosmos-static-preview] p {
      margin: 6px 0 0;
      color: #475569;
      font-size: 13px;
    }
    [data-notes-cosmos-static-preview] section {
      width: 100%;
      min-width: 0;
      margin-top: 16px;
    }
    [data-notes-cosmos-static-preview] ol {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
      gap: 10px;
      width: 100%;
      min-width: 0;
      margin: 10px 0 0;
      padding: 0;
      list-style-position: inside;
    }
    [data-notes-cosmos-static-preview] [class~="grid"] {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
      gap: 12px;
      width: 100%;
      min-width: 0;
    }
    [data-node-id],
    [data-relationship-id],
    [data-notes-cosmos-static-preview] section > section,
    [data-notes-cosmos-static-preview] section > div {
      min-width: 0;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #ffffff;
      padding: 12px;
    }
    [data-node-id] > div {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }
    [data-node-id] span {
      display: inline-flex;
      max-width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 999px;
      background: #f8fafc;
      color: #475569;
      padding: 2px 7px;
      font-size: 11px;
    }
    @media (max-width: 430px) {
      .harness-shell { padding: 10px; }
      .harness-banner,
      .harness-checklist,
      [data-notes-cosmos-static-preview] { border-radius: 10px; padding: 12px; }
      [data-notes-cosmos-static-preview] ol,
      [data-notes-cosmos-static-preview] [class~="grid"] { grid-template-columns: 1fr; }
    }
  `;
}

function buildHtml({ renderedPreview, fixture }) {
  const title = 'Notes/Cosmos Static Preview Harness';
  const generatedAt = new Date().toISOString();
  const nodeCount = fixture.nodes.length;
  const relationshipCount = fixture.relationships.length;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>${buildHarnessCss()}</style>
  </head>
  <body>
    <main class="harness-shell" data-notes-cosmos-static-harness>
      <section class="harness-banner" aria-labelledby="harness-title">
        <p class="harness-eyebrow">Dev/Test Harness - Not a runtime app route</p>
        <h1 id="harness-title" class="harness-title">${title}</h1>
        <p class="harness-note">
          This static artifact uses mock fixture data only and is not connected to Notes runtime.
          It contains ${nodeCount} nodes and ${relationshipCount} relationships from the K-220 fixture.
        </p>
        <p class="harness-note">
          CSS limitation: this file uses minimal inline structural CSS for overflow/readability proof.
          It does not claim full app visual parity.
        </p>
        <p class="harness-note">Generated at ${escapeHtml(generatedAt)}.</p>
      </section>

      ${renderedPreview}

      <section class="harness-checklist" aria-labelledby="harness-checklist-title">
        <h2 id="harness-checklist-title">Manual 390px QA checklist</h2>
        <ol>
          <li>Set viewport width to 390px.</li>
          <li>Confirm the Dev/Test Harness label, fixture title, and description are visible.</li>
          <li>Confirm all 10 nodes and all 12 relationships render.</li>
          <li>Confirm tone, kind, status, and cluster text is readable.</li>
          <li>Confirm no horizontal overflow, clipped primary content, canvas, SVG, WebGL, or live user data appears.</li>
          <li>Clean up with: Remove-Item -Recurse -Force .\\dist\\notes-cosmos-static-preview</li>
        </ol>
      </section>
    </main>
  </body>
</html>
`;
}

async function main() {
  assertInsideFrontendDist(outputDir);

  let server;
  try {
    server = await createServer({
      configFile: false,
      root: frontendRoot,
      mode: 'production',
      logLevel: 'error',
      customLogger: createHarnessLogger(),
      appType: 'custom',
      plugins: [react()],
      server: {
        fs: {
          allow: [frontendRoot],
        },
        middlewareMode: true,
      },
    });

    const [{ NotesCosmosStaticPreview }, { notesCosmosStaticPreviewFixture }] = await Promise.all([
      server.ssrLoadModule(previewModulePath),
      server.ssrLoadModule(fixtureModulePath),
    ]);

    const renderedPreview = renderToStaticMarkup(
      createElement(NotesCosmosStaticPreview, { fixture: notesCosmosStaticPreviewFixture }),
    );
    const html = buildHtml({
      renderedPreview,
      fixture: notesCosmosStaticPreviewFixture,
    });

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(outputFile, html, 'utf8');

    console.log([
      'Notes/Cosmos static preview harness generated.',
      `Output: ${outputFile}`,
      'Command: node scripts/renderNotesCosmosStaticPreview.mjs',
      'Manual QA: open the output file, set viewport width to 390px, and check no horizontal overflow.',
      'Expected content: Dev/Test Harness label, 10 nodes, 12 relationships, readable tone/kind/status/cluster text.',
      'Cleanup (PowerShell): Remove-Item -Recurse -Force .\\dist\\notes-cosmos-static-preview',
      'Cleanup (POSIX): rm -rf dist/notes-cosmos-static-preview',
      'Do not commit generated HTML.',
    ].join('\n'));

    await new Promise(resolve => setTimeout(resolve, 1500));
  } catch (error) {
    console.error('Failed to generate Notes/Cosmos static preview harness.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (server) {
      await server.close();
    }
  }
}

await main();
