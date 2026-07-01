# K-225 Notes/Cosmos Static Preview Dev/Test Surface Decision

## Purpose

K-225 decides where the isolated Notes/Cosmos static preview component can be safely viewed next.

K-225 is docs/decision only. It does not implement any viewing surface, route, navigation entry, hidden experimental panel, or runtime Notes integration.

K-225 creates a decision gate before any dev/test surface implementation so the K-222/K-224 component remains isolated until the viewing path is explicitly approved.

## Current State Summary

K-220 created the static mock fixture contract at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

K-222 added the isolated `NotesCosmosStaticPreview` component skeleton at `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.

K-224 completed polish, mobile, and accessibility hardening:

- node tone renders as literal visible text
- 390px SSR wrapper-level test coverage exists
- fallback and semantic structure are strengthened
- the K-222 test path typo is fixed

Current state:

- component remains fixture-only
- component remains unwired
- no runtime Notes surface imports it
- NoteGraphView and LocalGraphView remain preserved
- no live graph data is read
- no KnowledgeIndexService or graph builder coupling exists
- no `x`, `y`, coordinates, saved layout, or persisted spatial metadata exists
- no canvas/SVG/WebGL graph engine exists

## Source-Verified Repo Conventions

Source-verified existing conventions:

- Vitest exists and is used for docs/audit tests and SSR component rendering.
- `NotesCosmosStaticPreview.test.ts` renders the component through `renderToStaticMarkup`.
- Existing K-214 through K-224 milestones use docs plus focused audit tests to preserve boundaries.
- `AppContent` uses tab state and lazy-loaded workspace views, not a general route file.
- Some development diagnostics use `import.meta.env.DEV` or `import.meta.env.MODE === 'test'`, but no reusable dev-only preview route convention was found.

Not found in inspected sources:

- Storybook dependency or `.stories.*` convention
- Cypress setup
- Playwright setup
- existing isolated component preview route convention
- safe generic docs/dev-only preview page convention
- approved hidden experimental panel convention for this component

Requires future verification:

- whether the team wants a minimal dev-only route convention
- whether browser verification should be handled by a temporary dev/test surface or a browser test harness
- whether a story-like convention should be introduced later without adding Storybook

## Decision Criteria

A safe viewing surface must:

1. Be isolated from normal Notes navigation.
2. Not replace NoteGraphView or LocalGraphView.
3. Not replace NotesPixelCosmosEmptyState or ProductEmptyState.
4. Use only K-220 fixture input.
5. Not read runtime stores or persistence.
6. Not import KnowledgeIndexService or graph builders.
7. Allow browser/manual QA, including a 390px viewport.
8. Support fallback-first rendering verification.
9. Be easy to remove.
10. Not ship as a user-facing default accidentally.
11. Not require assets, fonts, or dependencies.
12. Not imply Cosmos Map runtime is complete.

## Surface Options

### Option A: Test-Only Component Rendering

The component is rendered only in unit/integration tests.

Strengths:

- safest for isolation
- already matches the K-222/K-224 implementation state
- requires no runtime route, navigation, or app shell changes
- easy to remove

Limits:

- limited visual/browser QA
- does not prove real viewport overflow beyond SSR and test-environment checks
- cannot satisfy final 390px browser proof by itself

### Option B: Docs/Dev-Only Preview Page

A dev-only route or docs preview surface could render the static fixture outside normal product navigation.

Strengths:

- enables browser/manual QA
- can test real 390px viewport behavior
- can remain isolated from normal Notes navigation if gate rules are strict

Risks:

- route or environment gating must be correct
- could become accidental product navigation if surfaced carelessly
- no reusable dev-only preview route convention was found in inspected sources

Decision:

- acceptable only after K-226 defines exact gate, removal, and no-navigation rules
- should not be implemented directly in K-225

### Option C: Storybook / Story-Like Isolated Surface

A story-like surface would be good for component review if the repo already had Storybook or an equivalent convention.

Finding:

- Storybook and `.stories.*` conventions were not found in inspected sources
- adding Storybook or another dependency is too large for this line

Decision:

- do not add Storybook in K-225
- K-226 may consider a story-like no-dependency harness only if it can remain isolated

### Option D: Hidden Experimental Panel

A hidden experimental panel would make the preview easy to view inside the app.

Risks:

- it can become an accidental runtime feature
- it increases pressure to connect live data too early
- it is harder to prove separation from normal Notes navigation

Decision:

- hidden experimental panel remains deferred
- it is not the default next step

### Option E: Notes Empty-State Adjacent Preview

An empty-state adjacent preview is identity-aligned with the Notes/Cosmos direction.

Risks:

- it is too close to the runtime user flow
- it could replace or confuse the K-212 NotesPixelCosmosEmptyState
- it could blur ProductEmptyState responsibilities

Decision:

- defer until component placement is decided separately
- do not use this path for the first viewable surface

### Option F: Inside NoteGraphView / LocalGraphView

This option is not acceptable for the next step.

Reasons:

- it risks graph ownership conflict
- it violates the K-217 and K-221 boundaries
- it can imply the static preview is a graph replacement

Decision:

- NoteGraphView and LocalGraphView placement remains off-limits without a future migration decision

## Recommended Decision

K-225 recommends an isolated docs/dev/test-only surface first, but only after a K-226 spec defines the exact safe convention.

Do not use normal Notes navigation.

Do not use NoteGraphView or LocalGraphView.

Do not use a hidden experimental panel as the default path.

Because no existing safe dev-only route or Storybook convention was found, K-226 should first define the minimal safe convention before implementation.

If the team decides implementation is appropriate after K-226, the likely path is a tightly gated dev/test preview surface that renders only the K-220 fixture and includes an obvious removal path.

## 390px / Real Viewport Strategy

K-224 has SSR/narrow-wrapper-level mobile coverage.

Real browser 390px proof requires either a viewable surface or a browser test harness. K-225 does not add that surface.

K-226 should define how to perform real viewport QA safely without using the normal Notes route just to get browser coverage.

Required future acceptance:

- 390px width
- no horizontal overflow
- all nodes and relationships readable or fallback-accessible
- no clipped primary content
- no hover-only meaning
- no tiny touch targets
- browser manual QA steps once a safe surface exists

## Tone / Fallback Parity Strategy

K-224 renders tone on node cards as literal text.

K-226 or K-227 should decide whether tone should also appear in fallback summaries for parity.

If tone is used in the fallback, it must remain literal text and must not become color-only.

Fallback summaries should not lag behind visible cards if they are treated as the accessibility source of truth.

## K-223 Audit Staleness / Supersession Policy

K-223 remains a historical audit of the K-222 skeleton.

K-224 supersedes some K-223 findings, including tone handling and the K-222 doc typo.

K-225 does not rewrite K-223. Future docs should refer to the latest milestone state when making implementation decisions.

Historical audit docs can remain as evidence of decision progression.

## Runtime Boundary

K-225 reconfirms:

- no NoteView wiring yet
- no route/navigation yet
- no graph view replacement
- no hidden experimental panel yet
- no live graph data
- no KnowledgeIndexService
- no graph builders
- no stores/persistence/providers
- no Supabase or attachment behavior
- no assets/fonts/dependencies
- no global theme changes

## Future Implementation Guardrails

If K-226 later implements a dev/test surface, it must:

- remain isolated
- be gated or test-only
- not appear in normal user navigation
- not replace any Notes empty state
- not replace NoteGraphView or LocalGraphView
- use K-220 fixture only
- include a removal path
- include browser/manual QA steps
- include 390px viewport checks
- include forbidden import checks
- include no-runtime-data checks

## Recommended K-226

Recommended next target: **K-226 Notes/Cosmos Dev/Test Preview Surface Spec**.

Scope:

- define exact dev/test surface option
- define gating/removal strategy
- define browser QA plan
- define 390px viewport proof method
- define no-runtime-navigation guardrails
- still no implementation unless explicitly approved

Alternative implementation target: **K-226 Notes/Cosmos Isolated Dev Preview Surface**.

This alternative is allowed only if:

- the team approves implementation directly
- scope remains isolated
- no normal Notes navigation is added
- no graph view replacement occurs
- no live data is introduced

## Non-Goals

- no runtime implementation in K-225
- no dev/test surface implementation in K-225
- no route/navigation wiring
- no hidden experimental panel
- no NoteView changes
- no NoteGraphView changes
- no LocalGraphView changes
- no ProductEmptyState changes
- no NotesPixelCosmosEmptyState changes
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

K-225 keeps the static preview component isolated.

The next safe step is to define a dev/test preview surface before implementing it.

No normal Notes runtime wiring should occur until dev/test viewing and 390px browser QA are proven.

NoteGraphView and LocalGraphView remain preserved.
