# K-227 Notes/Cosmos Dev Preview Surface Gate Verification

## Purpose

K-227 verifies whether a dev/test preview surface can be safely implemented later for `NotesCosmosStaticPreview`.

K-227 is docs/audit/spec only. It does not implement a route, panel, preview surface, hidden experimental panel, or normal Notes runtime wiring.

K-227 keeps `NotesCosmosStaticPreview` unwired and creates a go/no-go gate for K-228.

## Current State Summary

K-220 mock fixture contract exists at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

K-222 isolated component skeleton exists at `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.

K-224 polish, mobile, and accessibility hardening is complete.

K-225 decided the viewing surface strategy must be approved before implementation.

K-226 specified dev/test preview surface requirements and cautioned that implementation is acceptable only if strict gating can be proven.

Current state:

- `NotesCosmosStaticPreview` remains unwired
- no normal Notes navigation connection exists
- no hidden experimental panel exists
- no live graph/user data is used
- NoteGraphView and LocalGraphView remain preserved
- K-220 fixture-only input remains the only approved input
- ProductEmptyState and NotesPixelCosmosEmptyState remain separate runtime surfaces

## Source Inspection Findings

### Build Scripts / Vite Config

Inspected:

- `frontend/package.json`
- `frontend/vite.config.ts`

Found:

- scripts are `dev`, `build`, `preview`, `test`, `test:watch`, audits, and typecheck
- Vite config uses React, the `@` alias, and Vitest node environment
- no production route exclusion plugin or preview-surface build convention was found

Implication for K-228:

- production exposure cannot be treated as solved by build configuration
- any viewable route/page needs explicit source-verifiable gating or should not be implemented

### Environment Variable Usage

Inspected:

- repo-wide `import.meta.env` and `process.env` usage
- editor QA and health request instrumentation
- block tree assertion gate
- virtual block feature flag usage

Found:

- `import.meta.env.DEV || import.meta.env.MODE === 'test'` is used for development/test instrumentation
- `import.meta.env.PROD` is used to disable block tree assertions in production
- `VITE_*` flags are used for specific behavior such as sync mode and virtual block flags
- no generic dev-preview-route gate convention was found

Implication for K-228:

- environment gating is source-supported for diagnostics, but not yet proven for preview routes
- route gating would need dedicated tests before implementation could be considered safe

### Router / Route Registration

Inspected:

- `frontend/src/App.tsx`
- `frontend/src/components/AppContent.tsx`
- route/router keyword scans

Found:

- the app shell uses `activeTab` state and lazy-loaded workspace views
- no React Router, BrowserRouter, HashRouter, or central route table was found
- Notes is mounted by tab selection, not URL routing

Implication for K-228:

- there is no existing route registration convention to reuse
- adding a route would introduce a new app access pattern and is not safe without a separate implementation plan

### Normal App Navigation / Sidebar

Inspected:

- `frontend/src/components/common/Sidebar.tsx`
- `frontend/src/components/AppContent.tsx`

Found:

- normal navigation is sidebar/top mobile tab driven
- `TabId` is a fixed union of shipped workspaces
- primary tabs are rendered directly from a literal tab list
- no dev-only nav slot or hidden preview nav convention was found

Implication for K-228:

- a preview must not be added to Sidebar or `TabId`
- navigation exposure gate is strong only if K-228 avoids normal app navigation entirely

### Dev-Only Route / Page Convention

Inspected:

- source route/navigation patterns
- docs around prior dev-only preview mentions

Found:

- no reusable dev-only route/page convention was found
- docs mention possible future dev/experimental routes, but no current implementation pattern was found

Implication for K-228:

- Outcome A is not justified by current evidence
- K-228 should remain a real viewport test harness plan unless a safe non-route harness is designed

### Feature Flag Convention

Inspected:

- `VITE_*` usage
- virtual block flag code
- docs mentioning rollout flags

Found:

- feature flags exist for specific systems
- no generic feature flag framework for preview surfaces was found

Implication for K-228:

- do not introduce a broad feature flag system just for the preview

### Browser Test / Story/Test Surface Convention

Inspected:

- `frontend/package.json`
- file scans for Storybook, Playwright, Cypress, `.stories.*`, and E2E setup

Found:

- Vitest exists
- no Storybook dependency or `.stories.*` convention was found
- no Playwright/Cypress dependency was found
- no browser visual test harness convention was found

Implication for K-228:

- Outcome C is not supported by current repo conventions
- browser proof requires a separately defined harness plan or a later approved safely gated route

### Manual QA Docs Convention

Inspected:

- previous Google Drive QA checklist/result docs
- K-226 QA strategy

Found:

- manual localhost QA docs exist in other domains
- no current manual QA doc is tied to a dev-only component preview route

Implication for K-228:

- a manual QA checklist is acceptable, but only after a safe viewable surface or harness exists

### Production Build Exclusion Pattern

Inspected:

- Vite config
- environment guard examples
- package scripts

Found:

- no route/module production exclusion pattern for dev preview pages was found
- diagnostics may no-op in production, but that is not equivalent to excluding a route or panel

Implication for K-228:

- production exposure gate is weak/unclear
- K-228 should not implement a route/panel until production exclusion or source-verifiable gating is designed

## Gate Criteria

### 1. Production Exposure Gate

Required:

- surface must not become a normal production user feature
- if implemented as a route, route must be safely dev/test-gated or excluded
- gate must be source-verifiable, not just documented intent

Finding:

- not satisfied yet
- no current production route exclusion convention was found

### 2. Navigation Exposure Gate

Required:

- surface must not appear in normal Notes navigation
- surface must not appear in sidebar/top nav
- surface must not replace empty state
- surface must not replace graph views

Finding:

- satisfied only if K-228 avoids normal navigation entirely
- Sidebar/AppContent make normal navigation explicit, so absence from those files is testable

### 3. Data Boundary Gate

Required:

- must use K-220 fixture only
- must not read user notes
- must not read stores/persistence/providers
- must not use live graph data
- must not import KnowledgeIndexService or graph builders

Finding:

- satisfied by the current unwired component
- any future surface must preserve this with source tests and grep checks

### 4. Safety / Removal Gate

Required:

- surface must have clear removal/rollback strategy
- surface must be labeled `Dev/Test Preview`
- surface must not look like completed Cosmos Map

Finding:

- not yet satisfied for a route/panel because no surface exists and no removal plan has been implemented
- can be specified later in K-228 if a non-route harness is chosen

### 5. QA Gate

Required:

- must allow real browser viewport QA
- must include 390px width proof
- must include no-horizontal-overflow checks
- must include fallback/list readability checks
- must include normal Notes smoke verification

Finding:

- not satisfied yet
- K-224 provides SSR/mobile-intent coverage, not real browser proof

## Gate Verification Result

Outcome B: Not safe enough to implement route/panel yet.

K-228 should be **K-228 Notes/Cosmos Real Viewport Test Harness Plan**.

Reason:

- current repo conventions do not strongly prove safe dev-only route gating
- no production route exclusion convention was found
- no Storybook/Cypress/Playwright/browser harness convention was found
- the component can remain fixture-only, but real viewport QA still needs a safer harness plan

K-228 must keep the component unwired unless it first defines a test harness that does not create normal app navigation or production route exposure.

## Recommended K-228 Path

Recommended next milestone: **K-228 Notes/Cosmos Real Viewport Test Harness Plan**.

Scope:

- docs/test-plan only
- define how to obtain browser viewport proof without an app route
- keep `NotesCosmosStaticPreview` unwired
- define 390px viewport checks
- define no-horizontal-overflow checks
- define fallback/list readability checks
- define normal Notes/graph smoke checks

Do not implement a dev route, hidden panel, normal Notes navigation entry, or story dependency in K-228 unless a new explicit approval changes this gate result.

## Route / Gating Strategy If Outcome A Later Applies

K-227 does not recommend Outcome A now.

If a later milestone revisits a dev preview route, strict requirements are:

- route must be dev/test-only
- route must be inaccessible from normal nav
- route must be clearly named as preview/dev/test
- route must not read live data
- route must import only `NotesCosmosStaticPreview` and K-220 fixture input
- route must not import NoteGraphView or LocalGraphView
- route must not import stores/persistence/providers
- route must not import KnowledgeIndexService or graph builders
- route must have a documented removal path
- production exposure must be testable or source-verifiable
- route must not be used as normal user-facing feature

Because these requirements are not source-proven today, they remain future constraints rather than implementation approval.

## Real Viewport QA Strategy

K-228 should define a safe way to prove:

- 390px viewport
- no horizontal overflow
- all nodes and relationships visible or fallback-readable
- long labels wrap
- no canvas/WebGL/interactive graph behavior
- normal Notes navigation remains unchanged
- NoteGraphView and LocalGraphView still work if easy to access

Preferred sequence:

1. Define a test harness plan that renders the isolated component without adding app navigation.
2. Define manual browser steps for 390px and desktop widths.
3. Define fallback checks for text/list readability.
4. Define source checks proving no live user data is read.
5. Only after those are accepted, consider whether an implementation milestone is safe.

## Security / Privacy Boundary

K-227 reconfirms:

- no live user notes
- no IndexedDB reads
- no Supabase reads/writes
- no Google Drive/attachment reads/writes
- no background sync/upload
- no credentials
- no telemetry changes
- no graph builder or KnowledgeIndexService reads
- no production claim that Cosmos Map exists

## Relationship To Existing Surfaces

NoteGraphView remains the shipped full-vault graph surface.

LocalGraphView remains the local/context graph surface.

NotesCosmosStaticPreview remains the fixture-driven static preview.

NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.

ProductEmptyState remains the generic/product empty state.

K-228 must not replace any of these.

## Non-Goals

- no runtime implementation in K-227
- no dev/test surface implementation in K-227
- no route/navigation wiring
- no hidden experimental panel
- no normal Notes navigation connection
- no NoteView changes
- no NoteGraphView changes
- no LocalGraphView changes
- no ProductEmptyState changes
- no NotesPixelCosmosEmptyState changes
- no component code changes
- no graph/canvas/orbit map
- no live graph data
- no KnowledgeIndexService or graph builder coupling
- no stores/schemas/providers/persistence changes
- no editor changes
- no OAuth/Supabase/attachment behavior
- no Health/Schedule behavior
- no assets/fonts/dependencies
- no Google Drive QA work

## Closure Statement

K-227 verifies whether K-228 may safely implement a dev/test viewing surface.

If gating is not strongly proven, K-228 must remain a real viewport test harness plan.

No normal Notes runtime wiring should occur yet.

NoteGraphView and LocalGraphView remain preserved.

NotesCosmosStaticPreview remains fixture-only until an explicitly approved and safely gated dev/test surface exists.
