# K-229 Notes/Cosmos Viewport Proof Harness Feasibility Audit

## Purpose

K-229 audits feasibility for obtaining real viewport proof for `NotesCosmosStaticPreview`.

K-229 is docs/audit only. It does not implement a harness, app route, panel, Sidebar entry, `TabId`, `AppContent` branch, hidden experimental panel, or normal Notes runtime wiring.

K-229 does not mount `NotesCosmosStaticPreview` anywhere in runtime. It decides whether K-230 can implement a harness safely, or whether another plan/audit step is required.

## Current State Summary

K-220 mock fixture contract exists at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

K-222 isolated component skeleton exists at `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.

K-224 polish, mobile, and accessibility hardening is complete.

K-227 blocked a dev route/panel because a safe convention was not proven.

K-228 defined the real viewport harness plan and concluded existing tooling is insufficient for direct implementation.

Current state:

- `NotesCosmosStaticPreview` remains unwired.
- no normal Notes navigation connection exists.
- no hidden experimental panel exists.
- no live graph/user data is used.
- NoteGraphView and LocalGraphView remain preserved.
- ProductEmptyState and NotesPixelCosmosEmptyState remain separate runtime surfaces.
- K-220 fixture-only input remains the only approved input.

## Source Inspection Findings

### Package Scripts

Inspected:

- `frontend/package.json`

Finding:

- Present: `dev`, `build`, `preview`, `test`, `test:watch`, `audit:discovery`, and typecheck scripts.
- Absent: browser-test, component-preview, Storybook, Cypress, Playwright, Puppeteer QA, static HTML generation, or isolated viewport harness scripts.

Can support no-route viewport proof:

- Not directly. Existing scripts can run Vite and tests, but none launch an isolated fixture-only viewport proof.

Route/panel exposure risk:

- Low if scripts remain unchanged.
- High if K-230 tries to use normal app navigation as a shortcut.

Live data risk:

- Low for the package scripts themselves.

Dependency risk:

- Adding a new browser script or dependency would be tooling work and is out of scope for K-229.

Implication for K-230:

- K-230 should define an explicit command only after choosing a safe static target or approved browser tool.

### Vite / Dev Server Setup

Inspected:

- `frontend/vite.config.ts`
- `frontend/package.json`

Finding:

- Vite uses React plugin and the `@` alias.
- Vitest config uses `environment: 'node'` and includes `src/**/*.test.ts`.
- No multi-entry Vite harness config, dev-only route exclusion, or preview-page production exclusion was found.

Can support no-route viewport proof:

- Possibly, but not with a source-verified existing convention.

Route/panel exposure risk:

- Medium if a local-only Vite entrypoint is added without production exclusion and removal rules.

Live data risk:

- Low if a future entrypoint imports only the K-220 fixture and component.
- Higher if it imports the app shell, Notes view, stores, or graph builders.

Dependency risk:

- No new dependency would be required for a Vite entrypoint, but config/script changes would be implementation work.

Implication for K-230:

- A local-only isolated Vite harness remains plausible, but needs a gate spec before implementation.

### productQaCapture / Puppeteer Tooling

Inspected:

- `frontend/scripts/productQaCapture.mjs`
- `frontend/docs/K-135C-product-qa-report.md`
- `frontend/package.json`
- package-lock browser-tool references

Finding:

- `productQaCapture.mjs` imports `puppeteer`, opens `ABSINTHE_URL` or `http://127.0.0.1:5173`, sets four viewports including mobile `390x844`, navigates app workspaces, captures screenshots, and writes `report.json`.
- It reads `frontend/.env`, requires Supabase URL/key, signs up or signs in a QA account, injects Supabase auth into localStorage, and navigates normal app workspaces through Sidebar/AppContent.
- `frontend/package.json` does not declare `puppeteer`, and there is no package script for this capture utility.

Can support no-route viewport proof:

- Not safely as-is.
- It proves browser capture mechanics and 390px viewport capability, but it is app-QA-oriented and assumes a reachable app URL and authenticated app state.

Route/panel exposure risk:

- High if reused by navigating to a hidden app panel or normal Notes route.
- Lower only if a future version can capture a static local target without app navigation.

Live data risk:

- High as-is because it reads Supabase env, manages auth, and opens the normal app.
- Not acceptable for `NotesCosmosStaticPreview` fixture-only proof without adaptation.

Dependency risk:

- Unclear/high because Puppeteer is not declared in `frontend/package.json`.

Implication for K-230:

- Do not directly reuse `productQaCapture.mjs` for K-230 implementation.
- Its viewport model and artifact report shape can inform a future static HTML harness plan.

### Backup Browser Verification Script

Inspected:

- `frontend/scripts/verifyBackupRestoreBrowser.mjs`

Finding:

- It imports `puppeteer`, opens the app URL, and evaluates browser-side imports for vault backup/restore logic.
- It is not an isolated component viewport harness.
- It depends on an app URL and browser execution context.

Can support no-route viewport proof:

- Not directly.

Route/panel exposure risk:

- Low by itself, but it still requires the normal app to load.

Live data risk:

- Lower than `productQaCapture.mjs` because it uses synthetic notes inside `page.evaluate`, but it still opens app runtime.

Dependency risk:

- Same Puppeteer declaration uncertainty.

Implication for K-230:

- This confirms browser-side module evaluation is possible in principle, but it is not enough to justify direct component harness implementation.

### Test Setup

Inspected:

- `frontend/vite.config.ts`
- `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`
- `frontend/src/lib/notesCosmosRealViewportTestHarnessPlan.test.ts`
- tests marked `// @vitest-environment happy-dom`

Finding:

- Current `NotesCosmosStaticPreview` coverage uses `renderToStaticMarkup`.
- Existing K-228 doc audit test follows the docs/audit test pattern.
- `happy-dom` is available for targeted tests, but real browser layout is not verified by SSR/happy-dom tests.

Can support no-route viewport proof:

- It can generate static markup and assert fixture/content boundaries.
- It cannot prove true browser viewport overflow or visual clipping.

Route/panel exposure risk:

- None if tests remain server-side/doc-audit only.

Live data risk:

- Low if tests import only fixture data and read docs/source.

Dependency risk:

- No new dependency needed for docs/audit tests.

Implication for K-230:

- Static HTML generation from SSR markup is feasible enough to plan, but CSS and browser capture details need a dedicated plan.

### QA Docs / Manual QA Conventions

Inspected:

- `frontend/docs/K-135C-product-qa-report.md`
- `frontend/docs/K-203-real-google-drive-manual-qa-checklist.md`
- `frontend/docs/K-204-real-google-drive-manual-qa-results.md`
- `frontend/docs/K-205-real-google-drive-qa-environment-setup-checklist.md`
- `frontend/docs/K-206-real-google-drive-manual-qa-retry-results.md`

Finding:

- Manual QA checklists, result logs, artifact locations, viewport tables, and explicit blocked/not-run statuses are accepted conventions.
- K-135C documents Puppeteer browser verification across 1920, 1440, 1024, and 390 viewports.

Can support no-route viewport proof:

- Yes as documentation pattern once a safe harness exists.

Route/panel exposure risk:

- Low if the QA document explicitly rejects normal app navigation exposure.

Live data risk:

- Low if future QA uses static fixture-only inputs and records no credentials.

Dependency risk:

- None for docs.

Implication for K-230:

- K-230 should include a manual QA checklist/result template, but not claim execution until a harness exists.

### Static HTML / Render Target Possibility

Inspected:

- `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`
- `frontend/src/components/common/PixelInventory.test.ts`
- render-to-static-markup test patterns across components

Finding:

- React static markup rendering is already used in tests.
- `NotesCosmosStaticPreview` can render from K-220 fixture-only input without stores/providers/live data.
- No committed static HTML generator or artifact policy was found.

Can support no-route viewport proof:

- Feasible as a future planned path.
- A static target could avoid app route/panel wiring and normal Notes navigation.

Route/panel exposure risk:

- Low if generated outside the app runtime and not committed as a user-visible route.

Live data risk:

- Low if it imports only `NotesCosmosStaticPreview` and K-220 fixture data.

Dependency risk:

- Low for SSR markup generation; browser capture may still need an approved browser runtime.

Implication for K-230:

- This is the most promising next path, but it needs a plan for CSS fidelity, generated artifact handling, command shape, and proof reporting.

### Route Registration / Navigation Convention

Inspected:

- `frontend/src/components/AppContent.tsx`
- `frontend/src/components/common/Sidebar.tsx`
- route/router scans

Finding:

- The app uses `activeTab` state and lazy-loaded workspace branches.
- `TabId` is a fixed shipped workspace union.
- Sidebar renders a literal primary tab list.
- No React Router, BrowserRouter, HashRouter, or central route table was found.
- No dev-only preview nav slot was found.

Can support no-route viewport proof:

- Only by avoiding AppContent/Sidebar entirely.

Route/panel exposure risk:

- High if K-230 edits AppContent, Sidebar, `TabId`, or Notes navigation.

Live data risk:

- High if the app shell is used, because normal app boot hydrates Notes and other workspace state.

Dependency risk:

- None, but runtime exposure risk is the blocker.

Implication for K-230:

- Do not implement a normal app route, hidden panel, or tab.

### Production Exclusion / Dev-Only Entry Patterns

Inspected:

- `frontend/src/components/views/editorQa.ts`
- `frontend/src/components/views/features/health/healthRequestInstrumentation.ts`
- `frontend/src/components/views/features/block-editor/validation/assertValidBlockTree.ts`
- `frontend/src/components/AppContent.tsx`
- `frontend/vite.config.ts`

Finding:

- Some diagnostics use `import.meta.env.DEV || import.meta.env.MODE === 'test'`.
- Some assertions no-op under `import.meta.env.PROD`.
- No production build exclusion pattern for a dev-only preview page or separate local-only entrypoint was found.

Can support no-route viewport proof:

- Not enough by itself.

Route/panel exposure risk:

- Medium/high if a dev-only entrypoint is introduced without tests proving exclusion.

Live data risk:

- Depends on imports; safe only with fixture-only imports.

Dependency risk:

- None, but guard testing would be required.

Implication for K-230:

- If local-only Vite is considered, K-230 should specify production-exclusion tests before implementation.

## Feasibility Options

### Option A: Reuse Existing productQaCapture / Puppeteer Tooling

Pros:

- may already provide browser rendering/capture.
- may avoid adding new dependencies if the local environment already has Puppeteer.
- supports real viewport sizing, including 390px.

Cons:

- app-QA-oriented.
- requires a reachable app URL.
- reads Supabase env and manages authenticated app state.
- navigates normal app workspaces.
- does not support no-route isolated component rendering as-is.
- Puppeteer is not declared in `frontend/package.json`.
- must not become a route/panel workaround.

Questions answered:

- Can it capture a local static HTML target? Not as written; it opens `ABSINTHE_URL`.
- Can it set viewport to 390px? Yes, source-verified.
- Can it avoid normal app navigation? No, source currently navigates app workspaces.
- Can it avoid live user notes/data? No as-is; it authenticates and opens app runtime.
- Can it run without new dependencies? Unclear; no declared Puppeteer dependency in `frontend/package.json`.

Decision:

- Not safe for direct K-230 implementation.
- Useful as a reference for viewport and artifact reporting shape.

### Option B: Local-Only Isolated Vite Harness

Pros:

- closer to real app CSS/browser rendering.
- can support 390px manual QA.
- could render fixture-only component.

Cons:

- may require new entrypoint/config/script.
- could become a route-like surface if not excluded.
- production exclusion must be proven.
- K-227 says route/panel convention is not safe enough yet.

Questions answered:

- Can it exist outside normal app routing? Plausible, but no current convention proves it.
- Can it be excluded from production build? Unclear; no source-verified exclusion pattern was found.
- Can it be launched only by explicit local command? Plausible, but requires a future implementation design.
- Can it avoid Sidebar/TabId/AppContent? Yes if kept as a separate entrypoint.
- Can it avoid live data? Yes if it imports fixture/component only.

Decision:

- Feasible but risky.
- Needs a gate spec before implementation.

### Option C: Test-Only Static HTML / Render Target

Pros:

- no app route.
- can be ephemeral.
- can be opened/captured by browser tooling.
- can use fixture-only static markup.
- aligns with existing `renderToStaticMarkup` tests.

Cons:

- may not reflect full app CSS accurately.
- needs clear generated-artifact rules.
- may need local script/harness implementation later.
- must avoid committing generated output unless approved.

Questions answered:

- Can React render static markup for the component? Yes, source-verified.
- Can CSS be applied sufficiently? Unclear; K-230 must decide whether to inline built CSS, load Vite CSS, or accept limited CSS fidelity.
- Can Puppeteer capture it? Plausible if a browser runtime is approved; current scripts prove Puppeteer-style capture exists but not a static target command.
- Can 390px no-overflow be checked manually or by script? Plausible; K-230 must define exact metrics and artifact format.
- Does it remain removable? Yes if generated artifacts are ephemeral and not committed.

Decision:

- Most feasible next path, but plan first.

### Option D: Add Browser Tooling Later

Pros:

- strongest path if existing tooling cannot do it.

Cons:

- too large for current line.
- dependency/tooling addition raises risk.
- should require separate proposal/approval.
- not allowed in K-229.

Decision:

- Defer. Do not add Playwright, Cypress, Storybook, or Puppeteer dependency in K-229.

### Option E: Defer Real Viewport Proof Until Safe Surface Exists

Pros:

- safest.
- avoids accidental runtime exposure.

Cons:

- leaves 390px proof unresolved.
- delays visual confidence.
- K-224/K-228 mobile assurance remains partial.

Decision:

- Acceptable fallback if K-230 cannot define static HTML artifact and browser runtime boundaries.

## Feasibility Decision

Chosen outcome: **Outcome B: Static HTML/render target is most feasible but needs a plan first**.

The source inspection supports static SSR markup as the strongest no-route path, but CSS fidelity, browser runtime availability, generated-artifact rules, and proof metrics need one more plan before implementation.

Do not choose a route/panel implementation as the K-230 default.

Do not choose direct productQaCapture reuse as the K-230 default because it is app-QA-oriented, authenticated, and not fixture-only as written.

## Recommended K-230

Recommended next milestone: **K-230 Notes/Cosmos Static HTML Viewport Harness Plan**.

K-230 should define:

- static HTML generation source and command shape.
- whether generated HTML is ephemeral, ignored, or committed only by explicit approval.
- how app/component CSS is loaded or approximated.
- whether a browser capture tool is already available or needs separate approval.
- the 390px viewport metric checks.
- the screenshot/report artifact policy.
- no-route/no-panel/no-runtime-wiring source checks.
- fixture-only import boundary.
- removal/cleanup strategy.

Prefer plan over implementation for K-230 because feasibility is promising but not strong enough for direct implementation.

Only a later K-231-style implementation should proceed if K-230 proves:

- no route/panel is needed.
- no new dependency is needed or dependency approval is explicit.
- no live data is used.
- CSS fidelity is acceptable.
- generated outputs are ephemeral or intentionally managed.
- removal strategy is clear.

## K-230 Implementation Guardrails If Later Approved

Any future harness implementation must:

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
- be removable.
- be clearly labeled test/harness-only.
- provide 390px viewport proof.
- verify no horizontal overflow.
- verify all nodes/relationships visible or fallback-readable.
- verify long labels wrap/read.
- verify no canvas/WebGL/interactive graph behavior.
- preserve NoteGraphView/LocalGraphView and existing empty states.

## 390px Proof Requirements

Minimum proof:

- browser-rendered at 390px width.
- no horizontal scroll caused by `NotesCosmosStaticPreview`.
- title/description readable.
- all 10 nodes visible or represented in fallback list.
- all 12 relationships visible or represented in fallback list.
- tone/kind/status/cluster text readable.
- long labels wrap or remain readable.
- relationship rows wrap or remain readable.
- no fixed wide canvas/container.
- no clipped primary content.
- screenshot or automated result can be reported in PR.

## Data / Security Boundary

K-229 and any future harness must preserve:

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

## Relationship To Existing Surfaces

NoteGraphView remains the shipped full-vault graph surface.

LocalGraphView remains the local/context graph surface.

NotesCosmosStaticPreview remains the fixture-driven static preview.

NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.

ProductEmptyState remains the generic/product empty state.

K-230 must not replace or mount inside any of these.

## Non-Goals

- no harness implementation in K-229.
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

K-229 decides whether real viewport proof can be pursued without route/panel exposure.

NotesCosmosStaticPreview remains unwired.

If no safe no-route path exists, K-230 must defer implementation.

No normal Notes runtime wiring should occur yet.

NoteGraphView and LocalGraphView remain preserved.
