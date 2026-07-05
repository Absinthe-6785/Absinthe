# K-264 Notes/Cosmos Product Surface Boundary Audit

## Purpose

K-264 audits Notes/Cosmos product surface boundaries before implementation.

K-264 is docs/audit plus audit test only. K-264 does not implement UI. K-264 does not implement Notes Empty State polish. K-264 does not wire runtime routes/panels/navigation. K-264 does not mount `NotesCosmosStaticPreview`. K-264 does not replace graph surfaces. K-264 does not implement Cosmos Map. K-264 chooses the K-265 next path.

## Current State Summary

K-263 restarted Notes/Cosmos product surface planning after the backup foundation.

Notes/Cosmos work from K-214 through K-234 established concept, IA, static fixture, isolated static preview, and viewport proof path.

Current state:

- `NoteGraphView` remains the shipped full-vault graph surface.
- `LocalGraphView` remains the local/context graph surface.
- Cosmos Map is not implemented.
- `NotesCosmosStaticPreview` remains isolated/unwired.
- normal Notes navigation has not been changed by K-263.
- backup/preflight work remains infrastructure and is not productized here.

Source-grounded runtime snapshot:

- Empty-vault Notes currently renders `NotesPixelCosmosEmptyState` from `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- The empty state component lives at `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.
- `NotesCosmosStaticPreview` lives at `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.
- The static preview fixture/mock contract lives at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.
- `NoteGraphView` lives at `frontend/src/components/views/NoteGraphView.tsx`.
- `LocalGraphView` lives at `frontend/src/components/views/features/knowledge/graph/LocalGraphView.tsx`.

## Option A Audit: Notes Empty State Polish

Current empty state component/file path:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.

Current rendering surface:

- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- Empty-vault branch: `isEmptyVault ? <NotesPixelCosmosEmptyState ... />`.

Current user-facing status:

- Already user-facing.
- Bounded to the true empty Notes vault state.
- Uses existing create note, open today's note, and import backup callbacks.
- Does not require route/navigation changes.

Likely files K-265 would touch:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.
- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.tsx` if created, or the existing nearest empty-state tests.
- Possibly docs/audit tests for K-265.
- Avoid touching `NoteViewEditorArea.tsx` unless a tiny prop or test hook change is required.

Visual/product opportunity:

- Strongest immediate user-visible product movement.
- Refines the already-shipped "Notes / Living Cosmos" identity.
- Keeps product progress close to the writing entry point.
- Can improve first-run clarity without creating graph ownership conflict.

Responsive risk:

- Real but likely bounded.
- Existing component uses `width: min(100%, 560px)`, wrapping actions, `overflowWrap: anywhere`, and compact spacing.
- K-265 must preserve 390px/mobile behavior and avoid horizontal overflow.
- Browser/manual QA is required if Option A becomes implementation.

Accessibility risk:

- Moderate and bounded.
- Current component uses `role="status"`, an `aria-label`, visible buttons, and real button elements.
- K-265 must preserve keyboard/focus behavior and avoid visual-only meaning.
- Text must remain readable and actions must remain literal.

Runtime coupling risk:

- Low to moderate.
- The component is already mounted in the empty-vault runtime path.
- K-265 must avoid store/persistence changes and avoid widening beyond empty-vault rendering.
- K-265 can avoid route/navigation changes.

Graph/persistence preservation:

- No graph changes should be needed.
- No `NoteGraphView` or `LocalGraphView` changes should be needed.
- No `NotesCosmosStaticPreview` mounting should be needed.
- No persistence/store/schema changes should be needed.

Audit conclusion:

- Option A is preferred for K-265 if the implementation remains empty-state-only.
- It has stronger product impact than Option B while keeping risk bounded.
- The required tradeoff is that K-265 must include browser/manual QA because it touches a user-facing UI surface.

## Option B Audit: Static Preview Continuation

Current static preview component/file path:

- `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.

Current fixture/mock path:

- `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

Current isolation status:

- Fixture-driven.
- Read-only.
- Unwired from normal Notes runtime.
- Not mounted into normal Notes navigation.
- Covered by static preview, static HTML, and viewport-proof planning/audit milestones.

Likely files K-265 would touch:

- `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.
- `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts` only if fixture wording or structure needs polish.
- `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`.
- Static HTML harness tests/docs only if the preview output changes.

Visual/product opportunity:

- Strong for Cosmos visual grammar refinement.
- Useful for QA and concept confidence.
- Allows iteration on fixture language, fallback text, tone labels, and responsive layout without normal runtime risk.

Responsive proof status:

- Stronger isolated proof path than Option A.
- K-224 provided wrapper-level mobile coverage.
- K-232 through K-234 produced the static HTML viewport harness proof path.
- Future changes still need static preview tests and, if visual output changes, static HTML/viewport verification.

Accessibility/fallback status:

- Existing preview includes text fallback sections, semantic headings, literal tone/status text, readable labels, and no canvas/SVG/WebGL graph engine.
- K-265 Option B must preserve fallback/accessibility and 390px/mobile expectations.

Runtime risk:

- Lowest if kept isolated.
- No route/navigation changes are needed.
- No live graph data should be introduced.
- No graph builders or `KnowledgeIndexService` should be imported.

Product impact:

- Weaker immediate user-facing impact because it remains dev/test-only or isolated.
- Stronger for visual grammar refinement before product exposure.

Audit conclusion:

- Option B is the fallback if Option A appears too coupled or risky.
- Option B should remain fixture-driven and isolated unless a separate future milestone explicitly approves mounting.

## Side-by-side Comparison

| Criterion | Option A: Notes Empty State polish | Option B: Static Preview continuation |
| --- | --- | --- |
| user-visible product impact | High. Improves an existing product-facing empty-vault surface. | Low to medium. Improves isolated/dev-test preview rather than normal product flow. |
| implementation risk | Low to moderate if limited to the empty state. | Low if kept fixture-driven and unwired. |
| runtime coupling | Existing runtime path, but bounded to empty vault. | No runtime coupling if isolation is preserved. |
| responsive/mobile QA | Required browser/manual QA because it changes shipped UI. | Static preview tests plus static HTML/wrapper proof can cover most risk. |
| accessibility QA | Must preserve buttons, focus, readable text, and non-visual meaning. | Must preserve fallback, readable labels, and no visual-only meaning. |
| graph/persistence risk | Low if it avoids graph and store changes. | Very low if it avoids live graph data and graph builders. |
| product identity gain | Strong. Directly improves first-run Notes/Cosmos identity. | Strong for visual grammar, weaker for user-facing product progress. |
| reversibility | Good if component-only. | Excellent if fixture/component-only. |
| alignment with K-263 product surface return | Strongest. It returns to a product-facing surface. | Good but less product-facing. |
| required K-265 validation | Component tests, accessibility/focus assertions where possible, 390px/browser QA, typecheck/build, no runtime widening. | Static preview tests, fixture contract tests, SSR/static HTML or wrapper-level responsive tests, source audit, typecheck/build. |

## Recommended K-265 Path

Primary recommendation:

K-265 Notes Empty State Pixel-Cosmos Product Polish.

Scope:

- small user-facing UI polish.
- empty Notes state only.
- no route/panel/navigation changes.
- no graph changes.
- no persistence/store/schema changes.
- no backup/preflight changes.
- browser/manual QA required.

Rationale:

- Option A is already a bounded user-facing surface.
- It gives product-visible movement after the backup foundation line.
- It can preserve graph, static preview, routing, persistence, and backup boundaries.

Fallback:

K-265 Notes/Cosmos Static Preview Continuation Polish.

Scope:

- isolated/static preview only.
- fixture-driven.
- no runtime mounting.
- no route/navigation changes.
- useful if empty state surface is too coupled.

Alternative:

K-265 Notes Empty State Pixel-Cosmos Polish Plan.

Scope:

- docs/plan only.
- use if implementation needs one more plan before UI change.

## K-265 Implementation Boundaries If Option A

If K-265 implements Option A:

- touch only empty state/product polish files.
- preserve current notes data behavior.
- preserve existing actions/buttons.
- preserve keyboard/focus behavior.
- preserve readable typography.
- preserve mobile 390px behavior.
- avoid horizontal overflow.
- avoid large layout rewrite.
- avoid global visual overhaul.
- no route/panel/navigation changes.
- no `NoteGraphView` changes.
- no `LocalGraphView` changes.
- no `NotesCosmosStaticPreview` mounting.
- no backup/preflight claims.

Likely implementation files:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.
- focused tests around `NotesPixelCosmosEmptyState` or existing Notes empty-state behavior.

Avoid unless explicitly justified:

- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- `frontend/src/components/views/NoteView.tsx`.
- graph runtime files.
- Notes stores/persistence/schema.

## K-265 Implementation Boundaries If Option B

If K-265 implements Option B:

- keep fixture-driven.
- keep isolated/unwired.
- no normal Notes navigation.
- no route/panel/navigation.
- no live graph data.
- no graph builders.
- no `KnowledgeIndexService`.
- no persisted coordinates/spatial metadata.
- no canvas/SVG/WebGL engine.
- preserve fallback/accessibility.
- preserve 390px/mobile proof expectations.

Likely implementation files:

- `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.
- `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`.
- possibly `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts` if fixture copy changes.

Avoid:

- `NoteView`.
- `NoteViewEditorArea`.
- `NoteGraphView`.
- `LocalGraphView`.
- runtime routes/navigation.

## Pixel/Cosmos Product Grammar Criteria

Acceptance criteria for either option:

- pixel is grammar, not decoration.
- information-first layout.
- readable typography.
- productive interactions.
- cozy sci-fi / pixel observatory / personal space archive tone.
- avoid overdecorated cosmic UI.
- avoid generic AI SaaS look.
- use signal/orbit/observatory language where it clarifies state.
- do not hide core Notes actions behind spectacle.

## Existing Graph Surface Preservation

- `NoteGraphView` remains full-vault graph.
- `LocalGraphView` remains local/context graph.
- Cosmos Map does not replace either.
- K-265 must not alter graph builders.
- K-265 must not couple to `KnowledgeIndexService`.
- K-265 must not introduce live graph data into static preview.
- any future graph migration requires explicit decision.

## Static Preview / Runtime Boundary

- `NotesCosmosStaticPreview` remains isolated unless a future milestone explicitly mounts it.
- static fixture remains deterministic.
- no persisted coordinates/orbits/spatial metadata.
- no hidden/default panel.
- no normal Notes navigation wiring.
- runtime surface changes must be scoped separately.
- 390px/mobile proof required before runtime exposure.

## Local-first / Backup Guardrails

K-264 carries forward:

- local runtime data remains source of truth.
- no remote-first hydrate/fetch.
- no production backup/preflight claims.
- no Data Safety / Backup Health UI.
- no restore/import behavior.
- no attachment blob/provider behavior.
- no raw token/content/blob leakage.
- no destructive restore default.
- no silent provider/blob changes.
- no Supabase/OAuth/Google Drive behavior changes.
- no `attachmentMetadataOnly` escalation.

Remote systems remain support layers.

## Validation Expectations For K-265

If K-265 chooses Option A:

- targeted component/unit tests.
- accessibility/focus assertions where existing conventions support them.
- 390px/manual browser QA.
- no horizontal overflow.
- typecheck/build.
- no graph/store/persistence diffs.
- no route/navigation diffs.

If K-265 chooses Option B:

- static preview tests.
- fixture contract tests.
- SSR/static HTML or wrapper-level responsive tests if existing.
- no runtime import/wiring source audit.
- typecheck/build.
- no route/navigation diffs.

## Non-goals

- no UI implementation in K-264.
- no Notes Empty State implementation in K-264.
- no Static Preview runtime wiring.
- no route/panel/navigation change.
- no `NotesCosmosStaticPreview` mounting.
- no hidden panel.
- no Cosmos Map implementation.
- no graph replacement.
- no `NoteGraphView` change.
- no `LocalGraphView` change.
- no graph builder change.
- no `KnowledgeIndexService` coupling.
- no persistence/schema change.
- no coordinates/orbits/spatial metadata persistence.
- no canvas/SVG/WebGL graph engine.
- no backup/preflight runtime implementation.
- no Data Safety / Backup Health UI.
- no export blocking.
- no restore/import validation.
- no restore preview/dry-run.
- no attachment blob backup.
- no provider-aware recovery.
- no Supabase/OAuth/Google Drive behavior change.
- no Health/Schedule behavior change.
- no assets/fonts/dependencies.

## Closure Statement

K-264 chooses the first small Notes/Cosmos product surface implementation path without implementing it.

Option A Notes Empty State polish is preferred because source audit confirms a bounded, already user-facing surface.

Option B Static Preview continuation remains fallback if runtime empty state risk is too high.

Existing graph surfaces remain preserved.

Static preview remains isolated.

Backup/preflight guardrails remain carried forward but not productized here.

Local runtime data remains source of truth.

Remote systems remain support layers.
