# K-231 Notes/Cosmos Static HTML Viewport Harness Generator Plan

## Purpose

K-231 defines the implementation-ready plan for a static HTML viewport harness generator for `NotesCosmosStaticPreview`.

K-231 is docs/plan only. It does not implement the generator, add scripts, generate or commit HTML artifacts, add routes, add panels, add navigation, or wire runtime UI.

K-231 keeps `NotesCosmosStaticPreview` unwired and prepares K-232 implementation or a fallback audit if the final import/CSS/artifact boundary proves unclear.

## Current State Summary

K-220 mock fixture contract exists at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

K-222 isolated component skeleton exists at `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.

K-224 polish, mobile, and accessibility hardening is complete.

K-227 blocked route/panel because safe convention was not proven.

K-228 defined real viewport harness needs.

K-229 identified static HTML/render target as the most feasible path.

K-230 planned static HTML viewport proof and required K-231 to lock exact generator details.

Current state:

- `NotesCosmosStaticPreview` remains unwired.
- no normal Notes navigation connection exists.
- no hidden experimental panel exists.
- no live graph/user data is used.
- NoteGraphView and LocalGraphView remain preserved.
- ProductEmptyState and NotesPixelCosmosEmptyState remain separate runtime surfaces.
- K-220 fixture-only input remains the only approved input.

## Source Inspection Findings

### NotesCosmosStaticPreview Component

Inspected:

- `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`
- `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`

Status: Present.

Finding:

- The component renders a text-first React article.
- It imports only `notesCosmosStaticPreviewFixture` and types from the K-220 mock contract.
- It renders all fixture nodes, relationships, and text fallback.
- It uses Tailwind utility classes for `w-full`, `max-w-full`, `min-w-0`, `overflow-hidden`, `break-words`, grid layout, spacing, borders, and background.
- It exposes `data-notes-cosmos-static-preview` and `data-min-mobile-width`.
- It does not render canvas, SVG, WebGL, buttons, links, app navigation, routes, stores, providers, or live data hooks.
- Current tests use `renderToStaticMarkup`, including a 390px constrained wrapper, but they do not prove browser layout.

Risk:

- Low for static fixture rendering.
- CSS fidelity remains the main limitation because Tailwind classes need generated or approximated CSS.

Implication for K-232:

- Use this component as the only UI import.
- Do not modify the component.
- Do not mount it in normal app runtime.
- Use browser/manual QA before claiming 390px proof.

### K-220 Fixture / Mock Contract

Inspected:

- `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`

Status: Present.

Finding:

- The fixture contains 10 nodes, 12 relationships, 3 clusters, deterministic fallback order, and `responsiveAcceptance.minMobileWidthPx: 390`.
- The module header explicitly rejects stores, graph builders, KnowledgeIndexService, persisted layout metadata, and replacing NoteGraphView/LocalGraphView.
- The fixture includes readable node labels, summaries, kinds, tones, statuses, cluster labels, date labels, relationship labels, relationship kinds, strengths, and fallback summaries.

Risk:

- Low if K-232 imports only this fixture through `NotesCosmosStaticPreview`.
- Medium if K-232 derives data from live notes, stores, graph builders, IndexedDB, Supabase, Drive, or attachments.

Implication for K-232:

- K-220 fixture-only input remains the only approved data source.
- No live graph/user data should enter the harness.

### Tailwind / CSS Setup

Inspected:

- `frontend/src/index.css`
- `frontend/tailwind.config.cjs`
- `frontend/postcss.config.cjs`

Status: Present.

Finding:

- `frontend/src/index.css` imports Tailwind base/components/utilities and defines Absinthe CSS variables plus shared base/scroll classes.
- `frontend/tailwind.config.cjs` scans `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`.
- `frontend/postcss.config.cjs` runs `tailwindcss` and `autoprefixer`.
- The static preview uses mostly Tailwind structural utility classes, not custom component CSS.

Risk:

- Full Tailwind/app CSS inclusion requires a build/extraction decision.
- Minimal inline CSS proves structural overflow/readability, not final app visual parity.

Implication for K-232:

- Do not change `src/index.css`, Tailwind config, PostCSS config, fonts, or assets.
- Use minimal inline harness CSS first unless K-232 explicitly proves a safer full Tailwind inclusion path.

### Package Scripts

Inspected:

- `frontend/package.json`

Status: Present.

Finding:

- Existing scripts are `dev`, `build`, `preview`, `test`, `test:watch`, `audit:discovery`, `lint:hardcoded-toasts`, and typecheck variants.
- No static HTML harness script exists.
- No Playwright, Cypress, Storybook, Puppeteer, browser-test, or component-preview package script exists.
- The package is ESM via `"type": "module"`.

Risk:

- Adding a package script is unnecessary for the first generator and would widen scope.

Implication for K-232:

- Do not change `package.json` by default.
- Run the generator directly with Node.

### Vite Config

Inspected:

- `frontend/vite.config.ts`

Status: Present.

Finding:

- Vite uses React plugin and the `@` alias.
- Vitest uses `environment: 'node'` and includes `src/**/*.test.ts`.
- No multi-entry harness config, app route, or dev-only preview convention exists.

Risk:

- Direct Node cannot import TSX source by itself.
- Editing Vite config is unnecessary if the generator uses Vite programmatically for SSR loading.

Implication for K-232:

- Do not change `vite.config.ts`.
- Use Vite's existing config through a script if TSX imports are needed.

### TypeScript / Node Script Conventions

Inspected:

- `frontend/package.json`
- `frontend/tsconfig.json`
- `frontend/tsconfig.app.json`
- `frontend/tsconfig.editor.json`
- `frontend/scripts/typecheck-bare-identifiers.mjs`
- `frontend/scripts/lint-hardcoded-toasts.mjs`
- `frontend/scripts/run-discovery-rediscovery-audit.mjs`

Status: Present.

Finding:

- Existing scripts are `.mjs` Node scripts.
- There is no `tsx`, `ts-node`, or custom TypeScript runner dependency.
- `tsconfig.json` uses `jsx: "react-jsx"`, `moduleResolution: "bundler"`, and `noEmit: true`.
- App/editor typechecks do not emit runnable JavaScript.

Risk:

- A plain `.mjs` script cannot import `src/components/notes/NotesCosmosStaticPreview.tsx` directly with Node.
- Adding a TS runner dependency is out of scope.

Implication for K-232:

- Proposed generator file should be `.mjs`.
- It should use Vite's `createServer` and `ssrLoadModule` to load TSX source through existing Vite/React tooling, then close the server.
- Avoid adding package scripts or dependencies.

### productQaCapture / Puppeteer Tooling

Inspected:

- `frontend/scripts/productQaCapture.mjs`
- `frontend/scripts/verifyBackupRestoreBrowser.mjs`
- `frontend/package.json`

Status: Present, but unsuitable as-is.

Finding:

- `productQaCapture.mjs` imports Puppeteer, opens an app URL, uses four viewports including mobile `390x844`, reads `frontend/.env`, manages Supabase auth, navigates app workspaces, and writes screenshots/report JSON under `/opt/cursor/artifacts/k135c-qa`.
- `verifyBackupRestoreBrowser.mjs` imports Puppeteer, opens app runtime, and evaluates browser-side backup/restore modules.
- Puppeteer is not declared in `frontend/package.json`.

Risk:

- Direct reuse violates fixture-only, no-auth, no-runtime, and no-normal-app-navigation boundaries.
- Browser automation dependency availability is unclear.

Implication for K-232:

- Do not use or edit these scripts for the first generator.
- Manual browser QA against a generated local HTML file is the first proof path.

### Test Setup

Inspected:

- `frontend/vite.config.ts`
- `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`
- K-228, K-229, and K-230 docs/audit tests under `frontend/src/lib`

Status: Present.

Finding:

- Docs/audit tests read markdown files and assert required planning sections.
- Component tests use `renderToStaticMarkup`.
- Vitest default environment is node.
- Some targeted tests opt into happy-dom, but no real browser layout test exists.

Risk:

- K-231 audit tests can lock documentation scope only.
- K-232 generator tests can inspect generated HTML shape, but cannot replace browser QA unless a real browser harness is added.

Implication for K-232:

- Add a focused generator test if implementation proceeds.
- Keep browser QA as manual unless browser tooling is separately approved.

### .gitignore / Generated Artifact Policy

Inspected:

- `.gitignore`
- `frontend/docs/K-135C-product-qa-report.md`
- `frontend/scripts/productQaCapture.mjs`

Status: Present, with no harness-specific path.

Finding:

- Root `.gitignore` ignores `dist/`, `node_modules/`, `.env`, `.env*.local`, `.next/`, and common generated files.
- No dedicated ignored `frontend/tmp`, `frontend/artifacts`, or Notes/Cosmos static output folder exists.
- Existing product QA artifacts are written outside the repo at `/opt/cursor/artifacts/k135c-qa`.

Risk:

- A new `frontend/tmp/...` path would be tracked unless K-232 adds a `.gitignore` rule.
- Generated HTML could be accidentally committed if written outside ignored paths.

Implication for K-232:

- Use `frontend/dist/notes-cosmos-static-preview/index.html` because `dist/` is already ignored.
- Do not add `.gitignore` unless this output path changes.
- Confirm no generated HTML appears in `git status`.

### Docs / Manual QA Artifact Conventions

Inspected:

- `frontend/docs/K-135C-product-qa-report.md`
- K-203 through K-206 Google Drive manual QA docs
- K-228 through K-230 Notes/Cosmos harness planning docs

Status: Present.

Finding:

- Manual QA reports commonly record method, viewport, artifacts, blocked/not-run status, and limitations.
- K-135C records desktop/laptop/tablet/mobile verification and artifact path.
- Recent Notes/Cosmos docs require explicit no-route/no-panel/no-runtime wording.

Risk:

- Future PRs could overclaim automated/browser proof if reporting is vague.

Implication for K-232:

- Report generator command, output path, browser viewport, overflow result, node/relationship counts, cleanup status, and final git status.
- Screenshots are optional and must not be committed unless explicitly approved.

## Exact Future File List

K-232 should create only these source/doc/test files if implementation proceeds:

- `frontend/scripts/renderNotesCosmosStaticPreview.mjs`
- `frontend/docs/K-232-notes-cosmos-static-html-viewport-harness-generator.md`
- `frontend/src/lib/notesCosmosStaticHtmlViewportHarnessGenerator.test.ts`

K-232 generated output path:

- `frontend/dist/notes-cosmos-static-preview/index.html`

K-231 must not create these K-232 files except this K-231 plan and its audit test.

K-232 may create the generator file only after this plan.

Generated output should not be committed.

If K-232 changes output away from `frontend/dist/notes-cosmos-static-preview/index.html`, it must either use an already ignored path or add a narrow ignore rule only if justified.

## Exact Command Shape

K-232 command:

```bash
cd frontend
node scripts/renderNotesCosmosStaticPreview.mjs
```

PowerShell equivalent:

```powershell
cd frontend
node .\scripts\renderNotesCosmosStaticPreview.mjs
```

Generator extension:

- Use `.mjs`.
- Do not use `.ts` or `.tsx` because the repo has no Node TypeScript runner dependency.
- Do not add a `package.json` script at first.

Execution strategy:

- Direct Node execution is enough for the script itself.
- The script should use Vite's programmatic SSR loader to import TSX source:
  - create a Vite server in middleware mode or another non-listening SSR-load configuration.
  - use `server.ssrLoadModule('/src/components/notes/NotesCosmosStaticPreview.tsx')`.
  - render the component with React `createElement` and `renderToStaticMarkup`.
  - close the Vite server in `finally`.

Command output should print:

- generated output path.
- cleanup command.
- 390px browser/manual QA checklist summary.
- reminder that the generated HTML must not be committed.

Recommendation:

- Avoid `package.json` changes in K-232 unless absolutely necessary.

## Output Path And Cleanup Policy

Exact output directory:

- `frontend/dist/notes-cosmos-static-preview`

Exact generated file:

- `frontend/dist/notes-cosmos-static-preview/index.html`

Ignore status:

- Root `.gitignore` already ignores `dist/`.
- No additional ignore rule is needed if K-232 uses this path.

Cleanup policy:

- The generator should delete/recreate only `frontend/dist/notes-cosmos-static-preview`.
- It must not delete all of `frontend/dist`.
- It must not delete any path outside the target output directory.
- It should write one HTML file and no images/fonts/assets.
- Generated output is ephemeral.
- Generated output is not committed.

Cleanup command:

```bash
rm -rf frontend/dist/notes-cosmos-static-preview
```

PowerShell cleanup command:

```powershell
Remove-Item -LiteralPath frontend\dist\notes-cosmos-static-preview -Recurse -Force
```

PR author confirmation:

- run `git status --short`.
- confirm no generated HTML appears.
- run `git diff --name-status origin/main...HEAD`.
- confirm only source/doc/test files are listed.

## Static Render Strategy

Chosen future generator approach:

- Use React `renderToStaticMarkup`.
- Render only `NotesCosmosStaticPreview`.
- Use K-220 fixture-only input.
- Write a complete HTML document with a root container.
- Include a visible "Dev/Test Harness" label.
- Include no app route, app nav shell, Sidebar, `TabId`, or `AppContent`.
- Include no live data hooks, stores, providers, persistence, graph builders, KnowledgeIndexService, Supabase, Drive, attachments, sync, upload, or recovery behavior.

Import strategy:

- The generator file is `.mjs`.
- It imports Node modules directly.
- It imports React and `react-dom/server` directly.
- It loads `NotesCosmosStaticPreview.tsx` through Vite `ssrLoadModule`, not through raw Node TSX import.

Wrapper strategy:

- K-232 may create a tiny wrapper element inside the script with:
  - harness label.
  - 390px acceptance notes.
  - generated timestamp if useful.
  - the static preview component.
- The wrapper must stay inside the generated HTML only.
- Do not add a React wrapper component under `src`.

Generator test:

- K-232 should add a focused test that source-inspects the generator and/or invokes it in a temp-safe way if practical.
- The test should assert no app route/panel/imports, the output path, fixture-only boundary, and no generated artifacts committed.

If Vite `ssrLoadModule` cannot import the component cleanly:

- K-232 should stop and become **K-232 Notes/Cosmos Static HTML Harness Import and CSS Fidelity Audit** instead of forcing a workaround.

## CSS Fidelity Strategy

### Option 1: Minimal Inline Harness CSS

Decision:

- Preferred first K-232 implementation path.

Purpose:

- Prove structural overflow/readability at 390px.

Content:

- box sizing.
- body margin/background/text defaults.
- a constrained harness root.
- full-width/min-width-zero preview root handling.
- grid collapse behavior.
- border, padding, gap, and readable text defaults.
- wrapping rules for labels, chips, node rows, and relationship rows.

Limitation:

- This proves structural overflow/readability, not final app visual parity.
- It does not prove full Tailwind utility output.

Risk:

- Lower implementation risk.
- Lower visual fidelity.

### Option 2: Include Existing Built CSS

Decision:

- Defer.

Reason:

- Higher fidelity, but requires exact app CSS extraction/output ordering.
- It may rely on a full app build and dist asset names.
- It increases coupling to app build output.

### Option 3: Use Vite Transform/Build For Isolated Entry

Decision:

- Defer.

Reason:

- Better CSS fidelity, but likely requires an entrypoint/config/script convention.
- K-227/K-229/K-230 repeatedly rejected route-like/dev-surface exposure until proven safe.

### Option 4: Render Without Full CSS

Decision:

- Reject except as a clearly labeled emergency fallback.

Reason:

- Too weak for product-quality viewport proof.

K-232 CSS recommendation:

- Use minimal inline harness CSS in generated HTML.
- Clearly state the limitation in the generated HTML and PR report.
- Do not change Tailwind config, PostCSS config, global CSS, fonts, or assets.
- Do not rely on normal app shell.

## 390px Browser / Manual QA Procedure

K-232 manual QA steps:

1. Run the generator command:
   `cd frontend && node scripts/renderNotesCosmosStaticPreview.mjs`
2. Open `frontend/dist/notes-cosmos-static-preview/index.html` in a browser.
3. Set viewport width to 390px.
4. Confirm the Dev/Test Harness label is visible.
5. Confirm fixture title and description render.
6. Confirm all 10 nodes render.
7. Confirm all 12 relationships render.
8. Confirm tone/kind/status/cluster text renders.
9. Confirm no horizontal overflow.
10. Confirm no clipped primary content.
11. Confirm long labels wrap or remain readable.
12. Confirm relationship rows wrap or remain readable.
13. Confirm fallback/list content remains usable.
14. Confirm no canvas/SVG/WebGL/interactive graph appears.
15. Confirm no user notes/live graph data appear.
16. Confirm generated artifact is not committed.
17. Run cleanup command.
18. Confirm git status is clean except intended source/doc/test changes.

Browser QA is required for K-232 because K-232 will generate a viewable HTML target. Browser QA is not required for K-231 because K-231 changes no runtime UI and generates no HTML.

## No-Overflow Measurement Criteria

Fail K-232 manual/browser QA if:

- browser shows horizontal page scroll at 390px due to preview content.
- preview root `scrollWidth` exceeds viewport/client width in a way caused by preview content.
- title, description, node labels, or relationship labels are clipped.
- node or relationship content requires horizontal scrolling to read.
- any fixed-width canvas/container appears.
- fallback/list content is missing.
- tone/kind/status/cluster text is absent from rendered output.
- output relies on hover-only meaning.
- user/live data appears.

Optional future scripted check:

```js
document.documentElement.scrollWidth <= window.innerWidth
previewRoot.scrollWidth <= previewRoot.clientWidth
```

Record screenshot or console result in PR notes only if capture tooling exists.

Do not claim this scripted check exists until implemented.

## Artifact Reporting Policy

K-232 PR should report:

- generator command run.
- generated output path.
- browser and viewport used.
- 390px result.
- overflow result.
- nodes count.
- relationships count.
- whether artifact was cleaned.
- git status after cleanup.
- whether screenshots were taken.
- confirmation that screenshots were not committed unless approved.
- confirmation that generated HTML was not committed.

Screenshots are optional and must not be committed unless explicitly approved.

## Data / Security Boundary

K-231 and any future K-232 implementation must preserve:

- K-220 fixture-only input.
- no live user notes.
- no IndexedDB reads.
- no Supabase reads/writes.
- no Google Drive/attachment reads/writes.
- no background sync/upload.
- no credentials.
- no telemetry changes.
- no graph builder or KnowledgeIndexService reads.
- no production claim that Cosmos Map exists.
- no saved coordinates/spatial metadata.
- no routes/panels/sidebar entries.
- no OAuth/client secret/env values.
- no access token.
- no refresh token.
- no Upload all / Run queue / Sync now / Recover all behavior.

## Relationship To Existing Surfaces

NoteGraphView remains the shipped full-vault graph surface.

LocalGraphView remains the local/context graph surface.

NotesCosmosStaticPreview remains the fixture-driven static preview.

NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.

ProductEmptyState remains the generic/product empty state.

K-232 must not replace or mount inside any of these.

## K-232 Decision

Chosen primary next milestone: **K-232 Notes/Cosmos Static HTML Viewport Harness Generator**.

Scope:

- implement minimal generator at `frontend/scripts/renderNotesCosmosStaticPreview.mjs`.
- no route/panel.
- no package.json script unless K-232 proves direct command is impossible.
- no generated HTML committed.
- output to `frontend/dist/notes-cosmos-static-preview/index.html`.
- fixture-only.
- minimal inline structural CSS.
- manual 390px QA instructions.
- no live data.

Fallback if Vite SSR import fails:

- **K-232 Notes/Cosmos Static HTML Harness Import and CSS Fidelity Audit**.

Fallback if output ignore policy changes:

- **K-232 Notes/Cosmos Static HTML Harness Artifact Policy Audit**.

K-231 chooses the generator path because:

- Vite is already a dependency.
- existing scripts use `.mjs`.
- Vite can load TSX source through SSR module loading without package or Vite config changes.
- `frontend/dist/...` is already ignored.
- minimal inline CSS is sufficient for first structural overflow proof with clearly documented limitations.

## K-232 Implementation Guardrails

Any future generator/harness implementation must:

- not add app route.
- not add Sidebar / `TabId` / `AppContent` changes.
- not add hidden panel.
- not mount in normal Notes runtime.
- not read user notes or live graph data.
- use K-220 fixture-only input.
- not import KnowledgeIndexService or graph builders.
- not read stores/persistence/providers.
- not trigger sync/upload/background work.
- not add assets/fonts/dependencies unless separately approved.
- not commit generated HTML.
- write output only to ignored/ephemeral path.
- be removable.
- be clearly labeled test/harness-only.
- provide 390px viewport proof path.
- verify no horizontal overflow.
- verify all nodes/relationships visible or fallback-readable.
- verify long labels wrap/read.
- verify no canvas/WebGL/interactive graph behavior.
- preserve NoteGraphView/LocalGraphView and existing empty states.

## Non-Goals

- no generator implementation in K-231.
- no static HTML generated.
- no generated HTML committed.
- no scripts added.
- no package.json changes.
- no vite.config changes.
- no route/navigation wiring.
- no hidden experimental panel.
- no Sidebar / `TabId` / `AppContent` changes.
- no normal Notes navigation connection.
- no NoteView changes.
- no NoteGraphView changes.
- no LocalGraphView changes.
- no ProductEmptyState changes.
- no NotesPixelCosmosEmptyState changes.
- no component code changes.
- no graph/canvas/orbit map.
- no live graph data.
- no KnowledgeIndexService or graph builder coupling.
- no stores/schemas/providers/persistence changes.
- no editor changes.
- no OAuth/Supabase/attachment behavior.
- no Health/Schedule behavior.
- no assets/fonts/dependencies.
- no Playwright/Cypress/Storybook addition.
- no Google Drive QA work.

## Closure

K-231 makes K-232 implementation-ready without implementing the generator.

NotesCosmosStaticPreview remains unwired.

K-232 must not introduce route/panel/runtime wiring.

If import/CSS/artifact handling remains unclear, K-232 should remain an audit/plan.

No normal Notes runtime wiring should occur yet.

NoteGraphView and LocalGraphView remain preserved.
