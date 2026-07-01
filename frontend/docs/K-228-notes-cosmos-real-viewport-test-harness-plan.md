# K-228 Notes/Cosmos Real Viewport Test Harness Plan

## Purpose

K-228 defines how to obtain real viewport proof for `NotesCosmosStaticPreview`.

K-228 is docs/test-plan only. It does not implement a harness, app route, panel, Sidebar entry, `TabId`, `AppContent` branch, hidden experimental panel, or normal Notes runtime wiring.

K-228 keeps `NotesCosmosStaticPreview` unwired and follows K-227 Outcome B: not safe enough to implement route/panel yet.

## Current State Summary

K-220 mock fixture contract exists at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

K-222 isolated component skeleton exists at `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.

K-224 polish, mobile, and accessibility hardening is complete.

K-227 concluded that route/panel is not safe enough yet.

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

Found:

- scripts are `dev`, `build`, `preview`, `test`, `test:watch`, `audit:discovery`, and typecheck scripts.
- no browser test script, Storybook script, Cypress script, Playwright script, or component-visual test script was found.

Implication for K-229:

- K-229 cannot assume a supported browser-harness command already exists.
- adding new tooling would be too large for this line unless separately approved.

### Vitest / DOM Setup

Inspected:

- `frontend/vite.config.ts`
- tests marked with `// @vitest-environment happy-dom`
- `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`

Found:

- Vitest uses `environment: 'node'` by default and includes `src/**/*.test.ts`.
- many targeted tests opt into `happy-dom`.
- `NotesCosmosStaticPreview.test.ts` uses `renderToStaticMarkup`.
- the current 390px coverage renders inside a constrained `390px` wrapper and checks DOM/style intent.

Implication for K-229:

- current tests are useful for fixture coverage, text fallback coverage, and class/markup guardrails.
- current tests do not prove real browser layout, actual scroll width, clipping, or visual wrapping.

### React Testing Library Usage

Inspected:

- source scans for `@testing-library/react`
- `frontend/src/hooks/useNoteNavigationStack.test.tsx`

Found:

- React Testing Library appears in targeted tests, but it is not used by the isolated static preview.
- no RTL-based real browser layout harness convention was found.

Implication for K-229:

- RTL may help interaction-style DOM tests, but it does not provide real viewport proof by itself.

### Browser-Mode Testing

Inspected:

- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/vite.config.ts`
- source scans for Vitest browser mode, Playwright, and Cypress setup

Found:

- no configured Vitest browser-mode setup was found.
- no active Playwright/Cypress test setup was found.
- package lock includes transitive/optional Vitest browser peer references, but no project script or config uses them.

Implication for K-229:

- Outcome A is not supported.
- K-229 should not implement a browser test harness unless it first establishes or approves the tooling boundary.

### Playwright / Cypress Presence

Inspected:

- `frontend/package.json`
- repo-wide scans for Playwright and Cypress

Found:

- no Playwright or Cypress dependency/script was found in `frontend/package.json`.
- no Cypress spec folder or Playwright config was found in inspected sources.

Implication for K-229:

- do not add Playwright/Cypress as part of K-228.
- a future browser proof must either use an already-approved tool or remain a feasibility milestone.

### Storybook / Story-Like Surface

Inspected:

- `frontend/package.json`
- repo-wide scans for Storybook and `.stories.*`

Found:

- no Storybook dependency, Storybook script, or `.stories.*` convention was found.

Implication for K-229:

- Option D is not available without adding tooling.
- K-229 should not add Storybook in this line.

### Vite Dev / Manual QA Patterns

Inspected:

- `frontend/package.json`
- `frontend/scripts/productQaCapture.mjs`
- manual QA docs such as K-203 through K-206 and K-135C

Found:

- `npm run dev` starts Vite for the normal app.
- manual localhost QA docs exist.
- `productQaCapture.mjs` is app-workspace QA oriented and imports Puppeteer, but it is not a package script for isolated component viewing and is tied to authenticated app workspaces.

Implication for K-229:

- manual QA is a valid reporting pattern once a safe harness exists.
- the existing app QA script does not solve isolated, no-route `NotesCosmosStaticPreview` viewport proof.

### Local-Only Harness Patterns

Inspected:

- docs and source scans for harness, local-only test components, and QA utilities
- K-226 and K-227 dev/test surface specs

Found:

- audit harnesses exist for performance and logic.
- no local-only Vite component preview harness convention was found.
- no existing no-route browser page for isolated React component visual QA was found.

Implication for K-229:

- a local-only Vite harness remains plausible, but it is not source-verified as a current convention.
- it needs a separate feasibility or implementation gate.

### Existing Manual QA Docs

Inspected:

- `frontend/docs/K-203-real-google-drive-manual-qa-checklist.md`
- `frontend/docs/K-204-real-google-drive-manual-qa-results.md`
- `frontend/docs/K-205-real-google-drive-qa-environment-setup-checklist.md`
- `frontend/docs/K-206-real-google-drive-manual-qa-retry-results.md`
- `frontend/docs/K-135C-product-qa-report.md`

Found:

- manual QA checklists and result logs are an accepted documentation pattern.
- those docs record whether manual browser checks were run or blocked.

Implication for K-229:

- future browser/manual QA should record exact viewport, harness command, proof artifacts, and limitations.
- K-228 itself does not need browser QA because it changes no runtime UI and implements no harness.

### Can Current Tests Prove Real Layout Overflow?

Inspected:

- `NotesCosmosStaticPreview.test.ts`
- Vitest config and DOM test setup

Found:

- current tests can prove rendered content is present, fixture data is not mutated, no canvas/SVG/WebGL appears, and wrap-intent classes such as `min-w-0` and `break-words` exist.
- current tests cannot prove actual browser layout, `scrollWidth <= clientWidth`, visual clipping, real font wrapping, or screenshot-level 390px behavior.

Implication for K-229:

- current SSR/JSDOM coverage is not enough for the requested real viewport proof.
- K-229 should not claim browser proof without a browser-rendered harness.

## Real Viewport Problem Statement

K-224 SSR/narrow-wrapper tests prove DOM/fallback intent, not full real browser layout.

Real 390px viewport proof requires browser rendering or an equivalent visual harness.

K-227 blocked route/panel because safe convention was not proven.

K-228 defines a path that does not expose a runtime route prematurely.

## Harness Options

### Option A: Continue SSR/JSDOM Constrained-Container Tests Only

Pros:

- safest.
- no runtime exposure.
- no new tooling.

Cons:

- cannot fully prove real browser overflow.
- limited manual visual QA.

Decision:

- keep as baseline guardrail only.
- do not describe it as real viewport proof.

### Option B: Test-Only Browser Harness Using Existing Tooling

Pros:

- can provide stronger viewport proof if existing browser tooling supports it.
- no app route required.

Cons:

- only possible if repo already has suitable browser/component test tooling.
- should not add new tooling in this line.

Decision:

- not currently available based on inspected sources.

### Option C: Local-Only Vite Harness Outside Normal App Routing

Pros:

- can allow manual browser QA.
- avoids normal Notes navigation.

Cons:

- must be clearly excluded from production/user flow.
- still needs gating/removal strategy.
- may be too close to route/panel unless convention exists.

Decision:

- plausible future path, but requires a separate feasibility audit before implementation.

### Option D: Story/Test Surface If Existing Tooling Already Exists

Pros:

- ideal for isolated visual component QA.
- no app navigation.

Cons:

- not acceptable if it requires adding Storybook or dependencies.

Decision:

- not currently available because no Storybook/story-like convention was found.

### Option E: Screenshot / Manual HTML Fixture Generated From Test

Pros:

- no app route.
- can be ephemeral/manual.

Cons:

- may not reflect real app CSS accurately.
- requires clear generation/removal rules.
- should not commit generated artifacts unless explicitly approved.

Decision:

- acceptable only as a future feasibility candidate, not as K-228 implementation.

### Option F: Normal App Route / Hidden Panel

Pros:

- easiest manual view.

Cons:

- explicitly rejected by K-227 Outcome B.
- not allowed for K-228/K-229 unless a future gate reverses this.

Decision:

- rejected as the default.
- do not add route/navigation/panel wiring.

## Recommended Approach

Chosen K-229 outcome: **Outcome B: Existing tooling is insufficient**.

Recommended next milestone: **K-229 Notes/Cosmos Viewport Proof Harness Feasibility Audit**.

Scope:

- docs/audit only.
- compare adding browser tooling versus deferring real viewport proof.
- evaluate whether a local-only Vite harness can be created without app route exposure.
- define exact command, fixture import boundary, CSS loading boundary, artifact policy, and removal policy.
- keep `NotesCosmosStaticPreview` unwired.

Do not recommend normal app route or hidden experimental panel as the K-229 default.

If K-229 later proves a safe existing browser/test harness, the next implementation milestone may be **K-230 Notes/Cosmos Real Viewport Harness Implementation**.

## Future Harness Acceptance Criteria

If a future milestone implements any harness, it must:

- not add app route.
- not add Sidebar / `TabId` / `AppContent` changes.
- not add hidden panel.
- not appear in normal Notes navigation.
- not read user notes or live graph data.
- use K-220 fixture-only input.
- not import KnowledgeIndexService or graph builders.
- not read stores/persistence/providers.
- not trigger sync/upload/background work.
- not add assets/fonts/dependencies.
- be removable.
- be clearly labeled test/harness-only.
- provide 390px viewport proof.
- verify no horizontal overflow.
- verify all nodes/relationships visible or fallback-readable.
- verify long labels wrap/read.
- verify no canvas/WebGL/interactive graph behavior.
- preserve NoteGraphView/LocalGraphView and existing empty states.

## Browser / Manual QA Strategy

Once a safe harness exists, future manual QA should:

1. Open the test harness using its documented command.
2. Confirm the page/surface is not reachable from normal app navigation.
3. Confirm Dev/Test or Harness label is visible.
4. Confirm fixture title and description render.
5. Confirm all 10 nodes render.
6. Confirm all 12 relationships render.
7. Confirm tone/kind/status/cluster text render.
8. Set viewport to 390px width.
9. Confirm no horizontal overflow.
10. Confirm no clipped primary content.
11. Confirm long labels wrap or remain readable.
12. Confirm fallback list remains usable.
13. Confirm no hover-only meaning.
14. Confirm no canvas/SVG/WebGL graph engine.
15. Confirm no user notes/live graph data appear.
16. Confirm normal Notes navigation remains unchanged if app is also opened.
17. Confirm NoteGraphView/LocalGraphView are untouched if easy to access.
18. Confirm harness can be removed cleanly.

## 390px Proof Definition

Minimum acceptable future proof:

- browser-rendered viewport at 390px width.
- no horizontal scroll caused by `NotesCosmosStaticPreview`.
- all primary text readable or available in fallback list.
- node cards/list rows wrap safely.
- relationship rows wrap safely.
- no fixed wide canvas/container.
- no clipped title/description/node/relationship labels.
- screenshot or test output can be recorded in PR notes.

Non-proof:

- purely reading CSS class names.
- JSDOM-only assertion without documented limitation.
- visual assumption without viewport setup.
- route hidden behind normal navigation.
- desktop-only screenshot.

## Data / Security Boundary

K-228 and any future harness plan must preserve:

- no live user notes.
- no IndexedDB reads.
- no Supabase reads/writes.
- no Google Drive/attachment reads/writes.
- no background sync/upload.
- no credentials.
- no OAuth/client secret/env values.
- no access token.
- no refresh token.
- no telemetry changes.
- no graph builder or KnowledgeIndexService reads.
- no production claim that Cosmos Map exists.
- no saved coordinates/spatial metadata.
- no Upload all / Run queue / Sync now / Recover all behavior.

## Relationship To Existing Surfaces

NoteGraphView remains the shipped full-vault graph surface.

LocalGraphView remains the local/context graph surface.

NotesCosmosStaticPreview remains the fixture-driven static preview.

NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.

ProductEmptyState remains the generic/product empty state.

K-229 must not replace or mount inside any of these.

## Non-Goals

- no harness implementation in K-228.
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
- no Google Drive QA work.

## Closure

K-228 defines how real viewport proof should be obtained without app route exposure.

NotesCosmosStaticPreview remains unwired.

If no safe harness path exists, K-229 must not implement route/panel.

No normal Notes runtime wiring should occur yet.

NoteGraphView and LocalGraphView remain preserved.
