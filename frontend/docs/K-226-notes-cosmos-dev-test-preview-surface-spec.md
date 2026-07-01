# K-226 Notes/Cosmos Dev/Test Preview Surface Spec

## Purpose

K-226 defines a safe dev/test preview surface strategy for the isolated `NotesCosmosStaticPreview` component.

K-226 is docs/spec only. It does not implement a viewing surface, route, navigation entry, hidden experimental panel, or normal Notes runtime wiring.

K-226 creates a gate before any dev/test surface implementation so future work can prove 390px browser behavior without making the static preview a product feature.

## Current State Summary

K-220 mock fixture contract exists at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

K-222 isolated component skeleton exists at `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.

K-224 polish, mobile, and accessibility hardening is complete.

K-225 decided that a surface decision/spec must come before implementation.

Current state:

- `NotesCosmosStaticPreview` remains unwired
- no normal Notes navigation connection exists
- no hidden experimental panel exists
- no live graph data is used
- NoteGraphView and LocalGraphView remain preserved
- K-220 fixture-only input remains the only approved input
- ProductEmptyState and NotesPixelCosmosEmptyState remain separate runtime surfaces

## Source Inspection Findings

Route/dev-only route conventions:

- Status: not found as a reusable convention.
- Source finding: `AppContent` uses tab state and lazy-loaded workspace views rather than a general route table.
- Implication for K-227: a dev route/page must not be assumed safe; gating and removal rules need an explicit implementation plan.

Route guard or environment gate conventions:

- Status: partially present.
- Source finding: some diagnostics use `import.meta.env.DEV`, `import.meta.env.MODE === 'test'`, or production no-op guards.
- Implication for K-227: these patterns can inform a gate, but they do not by themselves define a safe preview route convention.

Feature flag conventions:

- Status: present in narrow areas, not as a generic preview-surface system.
- Source finding: existing flags are feature-specific, such as editor diagnostics or virtual block behavior.
- Implication for K-227: do not invent a broad feature flag system for this preview.

Test-only component harness convention:

- Status: present.
- Source finding: Vitest and `renderToStaticMarkup` are already used for the static preview component and docs/audit tests.
- Implication for K-227: SSR/unit tests remain the safest baseline but cannot prove real browser 390px behavior alone.

Storybook/story-like convention:

- Status: not found.
- Source finding: no Storybook dependency or `.stories.*` convention was found in inspected sources.
- Implication for K-227: do not add Storybook or story tooling for this line unless separately approved.

Docs-only preview convention:

- Status: present for decisions/audits, not for live visual component preview.
- Source finding: K-214 through K-225 use docs plus audit tests.
- Implication for K-227: docs can specify behavior, but a docs-only PR cannot provide browser-visible QA.

Browser E2E setup:

- Status: not found in active package tooling.
- Source finding: no Playwright or Cypress dependency appeared in `frontend/package.json`.
- Implication for K-227: browser QA should be manual or use a future explicitly approved harness.

Manual QA docs:

- Status: present in other domains.
- Source finding: previous Google Drive QA docs define manual localhost checks.
- Implication for K-227: a manual browser QA checklist is acceptable if a safe viewable surface exists.

Production build exclusion/gating conventions:

- Status: requires future verification.
- Source finding: environment gates exist in isolated modules, but no preview-surface production exclusion pattern was found.
- Implication for K-227: if a route/page is implemented, production access must be explicitly blocked or justified.

## Surface Options

### Option A: Keep SSR/Unit Test Harness Only

Pros:

- safest isolation
- no runtime exposure
- already close to current state
- no route, navigation, or app shell change

Cons:

- no real browser/390px viewport proof
- no manual visual review surface
- does not resolve the K-225 real viewport gap

Decision:

- keep this as the baseline, not the final viewing strategy.

### Option B: Isolated Dev-Only Preview Route/Page

Pros:

- enables browser/manual QA
- enables real 390px viewport proof
- can remain outside normal Notes navigation
- can be removed after review

Cons:

- route gating must be correct
- risk of accidental production/user exposure
- needs removal/rollback strategy
- no reusable route convention was found, so the implementation must define the convention locally and cautiously

Decision:

- this is the preferred future path only if K-227 can define strict gating, no-normal-navigation rules, and removal instructions.

### Option C: Storybook / Story-Like Isolated Surface

Pros:

- ideal for isolated component review if convention exists
- avoids app routing concerns

Cons:

- not acceptable if it requires adding dependency/tooling
- no Storybook or story-like convention was found

Decision:

- do not use Storybook for K-227 unless the team separately approves tooling.

### Option D: Test-Only Internal Harness Component

Pros:

- no user-facing route
- can support component tests
- preserves isolation

Cons:

- still limited for manual/browser QA unless paired with test runner visual mode
- no existing browser visual mode convention was found

Decision:

- acceptable as a fallback plan if route gating cannot be guaranteed.

### Option E: Hidden Experimental Panel

Pros:

- easy to view in app

Cons:

- too risky as default
- can become accidental runtime feature
- may create normal navigation expectations
- can pressure live-data wiring too early

Decision:

- remains deferred.

### Option F: Normal Notes Navigation / NoteView Placement

Pros:

- realistic user context

Cons:

- not acceptable yet
- risks premature runtime exposure
- risks conflict with NotesPixelCosmosEmptyState, ProductEmptyState, NoteGraphView, and LocalGraphView

Decision:

- explicitly forbidden for K-227 unless a later milestone changes the product placement decision.

## Recommended Path

Preferred K-227 path: **K-227 Notes/Cosmos Isolated Dev Preview Surface** if strict gating can be defined in the implementation PR.

The future surface must:

- not appear in normal Notes navigation
- not replace or modify NoteGraphView or LocalGraphView
- not replace ProductEmptyState or NotesPixelCosmosEmptyState
- use K-220 fixture only
- include a removal/rollback path
- include browser/manual QA steps
- include 390px real viewport checks
- include forbidden import checks
- clearly label the surface as `Dev/Test Preview`, not shipped Cosmos Map

If route gating cannot be guaranteed, preferred fallback: **K-227 Notes/Cosmos Real Viewport Test Harness Plan**.

If Storybook already exists in a future repo state, an alternative K-227 path may be **K-227 Notes/Cosmos Story/Test Preview Surface**, but K-226 did not find that convention.

## Gating Requirements

If a future dev-only route/page is chosen, it must:

- be inaccessible from normal app navigation
- not appear in sidebar/top nav
- not replace Notes empty state
- not appear in production builds unless an existing convention allows safe dev-only inclusion
- be clearly labeled `Dev/Test Preview`
- use static fixture only
- have a clear removal path
- not read user notes
- not read stores or persistence
- not import graph builders or KnowledgeIndexService
- not trigger sync, upload, or background work
- not create routes that look like finished product features

If route gating cannot be guaranteed, do not implement a route. Use a test-only harness or keep SSR/unit-only until a safer convention exists.

## Browser / Manual QA Strategy

Future K-227/K-228 browser QA should:

- open the dev/test preview surface
- confirm it is not reachable from normal Notes navigation
- confirm title and description render
- confirm all 10 nodes render
- confirm all 12 relationships render
- confirm tone, kind, status, and cluster text render
- set viewport to 390px
- confirm no horizontal overflow
- confirm no clipped primary content
- confirm long labels remain readable or wrapped
- confirm fallback text/list remains usable
- confirm no hover-only meaning
- confirm no canvas/WebGL/interactive graph behavior
- confirm no user notes or live graph data appear
- smoke normal Notes, NoteGraphView, and LocalGraphView if accessible
- confirm the dev/test surface can be removed cleanly

## 390px Real Viewport Proof

K-224 currently has component-level/mobile intent coverage.

Real 390px proof requires a browser-visible surface or browser test harness. K-226 does not provide that surface.

K-227 should define or implement the minimum safe way to perform real viewport QA.

Normal Notes navigation should not be used just to obtain viewport QA.

## Relationship To Existing Surfaces

NoteGraphView remains the shipped full-vault graph surface.

LocalGraphView remains the local/context graph surface.

NotesCosmosStaticPreview remains the fixture-driven static preview.

NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.

ProductEmptyState remains the generic/product empty state.

The dev/test preview must not replace any of these.

## Security / Privacy Boundary

The future dev/test surface must not use:

- live user notes
- persisted data
- local IndexedDB reads
- Supabase reads or writes
- Google Drive or attachment reads or writes
- background sync or upload
- credentials
- graph builder reads
- KnowledgeIndexService reads
- user-facing production claims that Cosmos Map exists

Telemetry must not be added. If existing global app behavior applies, it must be explicitly understood before implementation.

## Future Implementation Acceptance For K-227

If K-227 implements an isolated dev/test preview surface, it must meet:

- isolated surface only
- not in normal Notes navigation
- dev/test label visible
- K-220 fixture-only input
- no live graph data
- no NoteGraphView/LocalGraphView replacement
- no ProductEmptyState/NotesPixelCosmosEmptyState replacement
- no stores/persistence/providers
- no new dependencies/assets/fonts
- no canvas/WebGL
- browser QA at 390px
- forbidden import grep
- removal/rollback instructions
- tests covering route/surface absence from normal nav if applicable

## Recommended K-227

Preferred if route gating can be made safe: **K-227 Notes/Cosmos Isolated Dev Preview Surface**.

Scope:

- implement minimal dev/test-only preview surface
- not linked from normal navigation
- fixture-only
- browser QA at 390px
- no live data
- no graph surface replacement

Preferred if route gating cannot be guaranteed: **K-227 Notes/Cosmos Real Viewport Test Harness Plan**.

Scope:

- define how to obtain real viewport proof without a runtime app route
- no implementation yet

If Storybook already exists in a later repo state: **K-227 Notes/Cosmos Story/Test Preview Surface**.

Scope:

- story/test-only
- no new tooling/dependencies

## Non-Goals

- no runtime implementation in K-226
- no dev/test surface implementation in K-226
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

K-226 defines the safe viewing strategy before implementation.

No normal Notes runtime wiring should occur yet.

The next step depends on whether a safe dev/test surface convention exists.

NoteGraphView and LocalGraphView remain preserved.

NotesCosmosStaticPreview remains fixture-only until an explicitly approved dev/test surface implementation.
