# K-230 Notes/Cosmos Static HTML Viewport Harness Plan

## Purpose

K-230 plans a static HTML/render target viewport harness for `NotesCosmosStaticPreview`.

K-230 is docs/plan only. It does not implement a generator, add scripts, generate or commit HTML artifacts, add routes, add panels, add navigation, or wire runtime UI.

K-230 keeps `NotesCosmosStaticPreview` unwired and prepares a safe K-231 decision.

The planned harness is not Cosmos Map runtime, not user-facing, not normal Notes navigation, and not a replacement for `NoteGraphView` or `LocalGraphView`.

## Current State Summary

K-220 mock fixture contract exists at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

K-222 isolated component skeleton exists at `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.

K-224 polish, mobile, and accessibility hardening is complete.

K-227 blocked route/panel because safe convention was not proven.

K-228 defined real viewport harness needs.

K-229 identified static HTML/render target as the most feasible path, but required a plan first.

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

- The component renders text-first React markup.
- It imports only the K-220 fixture/types from `notesCosmosStaticPreviewMockContract`.
- It uses Tailwind utility classes such as `w-full`, `max-w-full`, `min-w-0`, `overflow-hidden`, `break-words`, `grid`, `rounded-lg`, `border-slate-200`, and `bg-slate-50`.
- It exposes `data-notes-cosmos-static-preview` and `data-min-mobile-width`.
- It renders nodes, relationships, and text fallback.
- It does not render canvas, SVG, WebGL, routes, buttons, or app navigation.
- Current tests use `renderToStaticMarkup` and a 390px constrained wrapper, but they do not provide real browser layout proof.

Risk:

- Static markup is feasible, but Tailwind classes need CSS to make the viewport proof meaningful.
- SSR/JSDOM class assertions are not enough to prove browser overflow or clipping.

Implication for K-231:

- A future generator can use `renderToStaticMarkup` as the safest render source.
- K-231 must define CSS inclusion and browser proof before claiming visual verification.

### K-220 Fixture / Mock Contract

Inspected:

- `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`

Status: Present.

Finding:

- The fixture has 10 nodes, 12 relationships, 3 clusters, deterministic fallback order, and responsive acceptance with `minMobileWidthPx: 390`.
- The module header explicitly states no stores, graph builders, KnowledgeIndexService, persisted layout metadata, or replacement of NoteGraphView/LocalGraphView.
- The fixture includes readable labels, summaries, kinds, tones, statuses, cluster labels, created/updated labels, and relationship summaries.

Risk:

- Low if a future harness imports only this contract and the static preview component.
- Medium if K-231 tries to derive data from live notes, graph builders, stores, IndexedDB, Supabase, or Drive/attachments.

Implication for K-231:

- K-220 fixture-only input remains the only approved data source.
- The harness must not introduce live graph/user data.

### Tailwind / CSS Setup

Inspected:

- `frontend/src/index.css`
- `frontend/tailwind.config.cjs`
- `frontend/postcss.config.cjs`

Status: Present.

Finding:

- `frontend/src/index.css` imports Tailwind base, components, and utilities and defines product-level CSS variables and base styles.
- `frontend/tailwind.config.cjs` scans `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`.
- `frontend/postcss.config.cjs` runs `tailwindcss` and `autoprefixer`.
- `NotesCosmosStaticPreview` depends on Tailwind utility classes for responsive wrapping, spacing, borders, and grid behavior.

Risk:

- A plain static HTML file without generated CSS would be a weak proof.
- Reusing full app CSS may require Vite/Tailwind output decisions and artifact rules.
- Inline minimal CSS may prove overflow behavior but lower visual fidelity.

Implication for K-231:

- Do not change global CSS, Tailwind config, PostCSS config, fonts, or assets.
- K-231 must explicitly choose between built CSS/Vite-transformed CSS and a minimal component-scoped CSS fallback.

### Package Scripts

Inspected:

- `frontend/package.json`

Status: Present.

Finding:

- Existing scripts include `dev`, `build`, `preview`, `test`, `test:watch`, `audit:discovery`, and typecheck.
- No static HTML viewport harness script exists.
- No browser-test, Storybook, Cypress, Playwright, Puppeteer QA, or component-preview script exists.

Risk:

- Adding a script in K-230 would be implementation, not planning.
- Adding browser tooling would broaden scope.

Implication for K-231:

- If K-231 implements a generator, it must justify any script addition.
- Prefer an explicit one-off command or documented generator file before package-script integration.

### Vite Config

Inspected:

- `frontend/vite.config.ts`

Status: Present.

Finding:

- Vite uses React plugin and the `@` alias.
- Vitest uses `environment: 'node'` and includes `src/**/*.test.ts`.
- No multi-entry static harness config, dev-only preview route, or production exclusion convention was found.

Risk:

- A Vite entrypoint could provide better CSS fidelity, but it risks becoming a route-like surface without a proven exclusion pattern.

Implication for K-231:

- Do not edit Vite config unless the K-231 plan explicitly proves why it is required and safe.
- Avoid `AppContent`, Sidebar, `TabId`, or normal app shell.

### productQaCapture / Puppeteer Tooling

Inspected:

- `frontend/scripts/productQaCapture.mjs`
- `frontend/scripts/verifyBackupRestoreBrowser.mjs`
- `frontend/package.json`

Status: Present, but not suitable as-is.

Finding:

- `productQaCapture.mjs` imports Puppeteer, opens `ABSINTHE_URL` or `http://127.0.0.1:5173`, sets four viewports including `390x844`, reads `frontend/.env`, manages Supabase auth, navigates normal app workspaces, captures screenshots, and writes reports.
- `verifyBackupRestoreBrowser.mjs` also imports Puppeteer and opens app runtime before evaluating modules.
- `frontend/package.json` does not declare a Puppeteer dependency or script.

Risk:

- Direct reuse would violate the fixture-only/no-runtime/no-auth boundary.
- Browser runtime availability is unclear from package scripts.

Implication for K-231:

- The viewport/reporting shape can inform future proof, but K-231 must not reuse app-authenticated navigation for this preview.
- Browser capture can be manual first unless existing browser runtime is explicitly available.

### Test Setup

Inspected:

- `frontend/vite.config.ts`
- `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`
- K-228 and K-229 docs/audit tests under `frontend/src/lib`

Status: Present.

Finding:

- Existing tests can read docs, verify source boundaries, and render static markup.
- Some targeted tests opt into `happy-dom`, but the default Vitest environment is node.
- Existing static preview tests do not prove real browser scroll width, clipping, or CSS layout.

Risk:

- K-230 tests can lock the plan, but cannot claim browser proof.

Implication for K-231:

- Future implementation should add a browser/manual proof result only after a real render target exists.

### Generated Artifact / Output Folder Conventions

Inspected:

- `.gitignore`
- `frontend/docs/K-135C-product-qa-report.md`
- `frontend/scripts/productQaCapture.mjs`

Status: Partially present.

Finding:

- Root `.gitignore` ignores `node_modules/`, `dist/`, `.env`, and other broad build/environment outputs.
- No dedicated ignored `frontend/artifacts`, `frontend/tmp`, or static-preview output folder was found.
- `productQaCapture.mjs` writes artifacts outside the repo at `/opt/cursor/artifacts/k135c-qa`.

Risk:

- Generated HTML or screenshots could be accidentally committed if K-231 writes into a tracked path.
- A repo-local artifact directory needs `.gitignore` verification before use.

Implication for K-231:

- Prefer ephemeral output outside the repo or a verified ignored path.
- Do not commit generated HTML or screenshots unless explicitly approved.

### .gitignore / Artifact Handling Convention

Inspected:

- `.gitignore`

Status: Present, but no harness-specific entry.

Finding:

- `dist/` is ignored globally.
- Environment files are ignored.
- No specific Notes/Cosmos harness artifact path is ignored.

Risk:

- K-231 needs an output policy before creating generated files.

Implication for K-231:

- If a generator writes inside the repo, it must use an already ignored path or add a narrow ignore rule with justification.
- Ephemeral OS temp output is the safest first choice.

## Static HTML Harness Concept

A future harness should:

- render `NotesCosmosStaticPreview` with K-220 fixture-only input.
- generate an isolated static HTML target outside normal app routing.
- include enough CSS for meaningful layout verification.
- allow browser render at 390px width.
- support manual and/or scripted no-overflow checks.
- be ephemeral by default.
- avoid live app navigation.
- avoid runtime user data.
- avoid routes, panels, Sidebar, `TabId`, and `AppContent`.
- avoid new dependencies unless separately approved.

The harness must not be:

- Cosmos Map runtime.
- a user-facing feature.
- normal Notes navigation.
- a replacement for NoteGraphView or LocalGraphView.
- a graph builder or KnowledgeIndexService surface.
- a canvas, SVG, WebGL, or orbit-map implementation.

## Artifact Policy

Preferred policy:

- generated HTML artifacts are ephemeral and not committed.
- output should use an ignored temp/artifacts directory if K-231 later creates one.
- K-231 must verify `.gitignore` or use a safe non-committed path.
- PR reports can include command output and screenshots only if generated locally.
- screenshots are not committed unless explicitly approved.

Artifact alternatives:

1. Ephemeral local output only.
   - Best first step.
   - Lowest repo churn.
   - Requires clear command output and manual cleanup.
2. Committed sample HTML fixture.
   - Not recommended by default.
   - Risks stale visual proof and artifact churn.
3. CI artifact.
   - Better later, but requires workflow/tooling decisions.
4. Screenshot artifact.
   - Useful for review, but should remain local/PR-attached unless approved.

Recommendation:

- K-231 should prefer ephemeral local output first.
- Do not commit generated HTML or screenshots in the first implementation.

## CSS Fidelity Plan

### Option 1: Existing Built CSS Or Vite-Transformed CSS

Fidelity:

- Highest, because Tailwind utilities and product variables can match the app.

Risk:

- Requires an exact build/output strategy.
- May depend on `dist/` output or Vite internals.
- Must avoid booting the app shell or normal routes.

Complexity:

- Medium.

Dependency/tooling impact:

- Potentially no new dependency if using existing Vite/Tailwind build path.

Tailwind class behavior:

- Strongest chance that component utility classes render correctly.

Meaningful no-overflow proof:

- Strong if browser-rendered at 390px.

### Option 2: Inline Minimal Component-Scoped CSS

Fidelity:

- Moderate. Good enough for text wrapping, max-width, borders, spacing, and grid fallback, but not full product styling.

Risk:

- Could drift from Tailwind/app CSS.
- Must be clearly labeled limited fidelity.

Complexity:

- Low.

Dependency/tooling impact:

- No new dependency.

Tailwind class behavior:

- Does not prove Tailwind utility output directly unless classes are mapped by the inline CSS.

Meaningful no-overflow proof:

- Useful for layout safety if it reproduces the component's responsive constraints.

### Option 3: Static Render Without Full CSS

Fidelity:

- Low.

Risk:

- Too weak for product-quality viewport proof.

Complexity:

- Low.

Dependency/tooling impact:

- No new dependency.

Tailwind class behavior:

- Not proven.

Meaningful no-overflow proof:

- Weak. Use only as fallback with explicit limitation.

### Option 4: App Shell CSS, Not App Route

Fidelity:

- High if CSS is extracted without app runtime.

Risk:

- Could accidentally couple to app shell, stores, or runtime boot.

Complexity:

- Medium/high.

Dependency/tooling impact:

- May require careful Vite output handling.

Tailwind class behavior:

- Strong if CSS is the real app CSS.

Meaningful no-overflow proof:

- Strong if isolated from app runtime.

Preferred CSS path:

- K-231 should first define an exact minimal approach that preserves component styling enough for 390px proof.
- If full Tailwind/app CSS cannot safely be included, K-231 must document that limitation.
- Do not change global CSS, Tailwind config, PostCSS config, fonts, or assets.

## Static Render Strategy

### Option A: React `renderToStaticMarkup` Output

Pros:

- Source-verified by existing tests.
- Does not require app shell.
- Can import only `NotesCosmosStaticPreview` and K-220 fixture.
- Keeps runtime user data out.

Cons:

- CSS still needs a separate decision.
- Browser proof still needs a manual or scripted render step.

Recommendation:

- Use this as the core future generation strategy.

### Option B: Vite-Built Isolated Entry

Pros:

- Better CSS/module fidelity.

Cons:

- Needs entrypoint/config/output policy.
- Could become route-like without strong guardrails.

Recommendation:

- Defer unless K-231 proves production exclusion and artifact handling.

### Option C: Existing Puppeteer / productQaCapture Consumes Generated Static File

Pros:

- Existing source proves 390px viewport capture is possible in principle.

Cons:

- Current scripts are app-authenticated and not fixture-only.
- Puppeteer is not declared in package scripts/dependencies.

Recommendation:

- Do not reuse directly.
- Consider only as a later browser-capture layer if dependency/runtime availability is explicit.

### Option D: Manual Open Generated HTML

Pros:

- Simple.
- No route/panel.
- Good first proof path.

Cons:

- Manual unless a browser script is later added.
- Requires precise reporting to avoid overclaiming.

Recommendation:

- Accept as first K-231/K-232 proof path if generator output is clear and ephemeral.

## 390px Proof Criteria

Future proof must show:

- browser-rendered viewport at 390px width.
- no horizontal scroll caused by `NotesCosmosStaticPreview`.
- fixture title and description readable.
- all 10 nodes visible or represented in fallback list.
- all 12 relationships visible or represented in fallback list.
- tone/kind/status/cluster text readable.
- long labels wrap or remain readable.
- relationships wrap or remain readable.
- no fixed wide canvas/container.
- no clipped primary content.
- no hover-only meaning.
- no canvas, SVG, or WebGL.
- output, screenshot, or test result can be reported.

Non-proof:

- JSDOM class assertions.
- desktop-only screenshots.
- reading classes without browser render.
- app route hidden behind navigation.
- visual assumption without viewport setup.

## No-Overflow Measurement Plan

### Option 1: Manual Browser Check

Method:

- Open generated static HTML.
- Set viewport to 390px width.
- Inspect horizontal scrolling and clipped content.

Pros:

- No new dependency.
- Good enough for first proof when paired with screenshots/reporting.

Cons:

- Manual and repeatability depends on reviewer discipline.

### Option 2: Puppeteer Measurement

Method:

- Browser render at 390px.
- Check `document.documentElement.scrollWidth <= window.innerWidth`.
- Check the preview root `scrollWidth <= clientWidth` where reliable.
- Capture screenshot.

Pros:

- Stronger and repeatable.

Cons:

- Existing Puppeteer scripts are not suitable as-is.
- Dependency/runtime availability is unclear.

### Option 3: CSS/Layout Smoke

Method:

- Assert generated HTML contains key wrapper classes and fixture text.

Pros:

- Cheap guardrail.

Cons:

- Not a real viewport proof.

### Option 4: Hybrid

Method:

- Manual browser proof first.
- Add scripted measurement only after browser runtime is approved.

Recommendation:

- Use hybrid sequencing.
- K-231 should specify generator/output/CSS and manual proof.
- Add automated browser measurement only when existing browser tooling is safe or separately approved.
- Do not claim automated proof until it exists.

## Data / Security Boundary

K-230 and any future harness must preserve:

- K-220 fixture only.
- no live notes.
- no IndexedDB reads.
- no Supabase reads/writes.
- no Google Drive/attachment reads/writes.
- no background sync/upload.
- no credentials.
- no telemetry changes.
- no graph builder or KnowledgeIndexService reads.
- no production claim that Cosmos Map exists.
- no saved coordinates or spatial metadata.
- no routes, panels, Sidebar, `TabId`, or `AppContent`.

## Relationship To Existing Surfaces

NoteGraphView remains the shipped full-vault graph surface.

LocalGraphView remains the local/context graph surface.

NotesCosmosStaticPreview remains the fixture-driven static preview.

NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.

ProductEmptyState remains the generic/product empty state.

K-231 must not replace or mount inside any of these.

## K-231 Decision

Recommended next milestone: **K-231 Notes/Cosmos Static HTML Viewport Harness Generator Plan**.

Reason:

- Static markup rendering is source-verified and likely safe.
- The component and fixture boundaries are clear.
- CSS fidelity, output path, command shape, and browser-runtime policy still need exact implementation design.
- Direct generator implementation is promising but not yet crisp enough.

Alternative if K-231 inspection finds CSS/tooling still unclear:

- **K-231 Notes/Cosmos Static HTML CSS Fidelity Audit**.

Alternative if implementation details become fully clear before K-231 starts:

- **K-231 Notes/Cosmos Static HTML Viewport Harness Generator**.

K-230 recommendation:

- Choose the generator-plan milestone first.
- Use K-231 to define exact files, command, output path, CSS strategy, and manual/browser QA steps.
- Implement the generator only after that contract is unambiguous.

## K-231 Guardrails

K-231 must not:

- add a route.
- add Sidebar, `TabId`, or `AppContent` changes.
- add a panel.
- mount inside normal Notes runtime.
- import live data.
- read stores, providers, persistence, IndexedDB, Supabase, Drive, or attachments.
- import KnowledgeIndexService or graph builders.
- add a new dependency unless separately approved.
- commit generated HTML unless explicitly approved.
- commit screenshots unless explicitly approved.
- create a canvas, SVG, WebGL, or orbit map.
- replace NoteGraphView or LocalGraphView.
- change NotesPixelCosmosEmptyState or ProductEmptyState.

K-231 must:

- keep output ignored or ephemeral.
- keep the harness removable.
- label the result test/harness-only.
- preserve K-220 fixture-only input.
- define a 390px proof path.
- define no-overflow criteria.
- require nodes and relationships to be visible or fallback-readable.
- require long labels to wrap/read.

## Non-Goals

- no generator implementation in K-230.
- no script additions.
- no package changes.
- no Vite config changes.
- no generated HTML artifacts.
- no committed screenshots.
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

## Closure

K-230 plans the static HTML viewport proof path without implementing it.

NotesCosmosStaticPreview remains unwired.

K-231 must not introduce route, panel, navigation, or runtime wiring.

If CSS fidelity, artifact policy, or browser runtime remains unclear, K-231 should remain plan/audit.

No normal Notes runtime wiring should occur yet.

NoteGraphView and LocalGraphView remain preserved.
