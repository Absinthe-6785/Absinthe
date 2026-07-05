# K-268 Notes Empty State Pixel-Cosmos Follow-up Polish Plan

## Purpose

K-268 plans whether a small Notes Empty State follow-up polish is needed after K-265, K-266, and K-267.

K-268 is docs/plan plus audit test only. K-268 does not implement UI. K-268 does not make a broad Notes UI overhaul. K-268 does not change route/nav/panel behavior. K-268 does not wire Static Preview into runtime. K-268 does not mount `NotesCosmosStaticPreview`. K-268 does not implement Cosmos Map. K-268 does not replace graph surfaces. K-268 chooses the K-269 next path or recommends pausing empty state polish.

## Current State Summary

K-263 restarted Notes/Cosmos product surface planning after the backup foundation line.

K-264 selected Notes Empty State polish as the first bounded implementation candidate.

K-265 implemented empty-vault UI polish on the existing `NotesPixelCosmosEmptyState` runtime surface.

K-266 closed K-265 with a source-facts closure audit.

K-267 selected a narrow empty state follow-up plan as the default next candidate.

Current state:

- `NotesPixelCosmosEmptyState` is now the first product-surface Pixel/Cosmos polish.
- `Create note`, `Open today's note`, and `Import backup` CTA/callback behavior is preserved.
- accessibility and semantics are documented.
- 390px browser QA evidence exists.
- the Create note unclicked browser QA low note remains non-blocking but can be considered for manual QA follow-up.
- `NotesCosmosStaticPreview` remains isolated/unwired.
- `NoteGraphView` and `LocalGraphView` remain preserved.
- backup/preflight guardrails remain infrastructure and are not productized here.

## K-265/K-266 Source-grounded Facts

Current empty state component path:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.

Current mount/wiring path:

- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- Empty-vault branch: `isEmptyVault ? <NotesPixelCosmosEmptyState ... />`.
- The mount passes `onCreateNote={() => createNote()}`, `onOpenTodaysNote={onOpenTodaysNote}`, and `onImportVault={onImportVault}`.

Current CTA/callback behavior:

- `Create note` remains a native button and calls `onCreateNote`.
- `Open today's note` remains optional and calls `onOpenTodaysNote`.
- `Import backup` remains optional and calls `onImportVault`.
- K-265 did not introduce new behavior behind the actions.

Current accessibility/semantic state:

- empty-state container remains `role="status"`.
- empty-state container keeps `aria-label="Notes empty state"`.
- actions remain native `button` elements.
- action labels remain visible text.
- actions preserve `abs-focus-ring`.
- decorative pixel motif elements remain `aria-hidden`.
- copy remains text-first and does not require color-only, icon-only, or motion-only meaning.

Current mobile/390px status:

- K-266 records 390px browser QA evidence.
- primary CTA was visible, unique, enabled, and a native button.
- secondary actions were visible and usable.
- no horizontal overflow or clipping was recorded.
- no `NotesCosmosStaticPreview`, graph surface, Data Safety surface, or Backup Health surface appeared.

Current tests covering empty state behavior:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`.
- The test covers product copy, native buttons, callback invocation, focus-ring classes, CSS-only motif behavior, absence of Static Preview/graph/Data Safety copy, and mobile empty-vault pane behavior.
- `frontend/src/lib/notesEmptyStatePixelCosmosProductPolishClosureAudit.test.ts` records the K-266 source-facts closure.
- `frontend/src/lib/notesCosmosSurfacePolishNextCandidatePlan.test.ts` records the K-267 next-candidate decision.

Known low note from K-266:

- `Create note` was not clicked during browser QA to avoid creating local data.
- callback invocation is covered by focused unit tests.
- this remains a manual QA question, not a source-grounded UI defect.

Files that should remain untouched by K-268:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.
- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.
- `frontend/src/components/views/NoteGraphView.tsx`.
- `frontend/src/components/views/features/knowledge/graph/LocalGraphView.tsx`.
- graph builders and `KnowledgeIndexService`.
- Notes stores, schemas, persistence, and providers.
- backup/export/import/restore runtime files.
- attachment, OAuth, Supabase, Health, and Schedule runtime files.

## Follow-up Candidate 1: Copy Refinement

Question:

- Does the current copy feel too generic, too verbose, unclear, or sufficiently good?

Source-grounded status:

- current copy is specific and literal: `Notes / Living Cosmos`, `Empty vault`, `Start with one signal`, and direct guidance to create a note, open today's page, or import a vault.
- the guidance links Pixel/Cosmos language to writing, linking, and returning to traces.
- CTAs remain literal and are not hidden behind metaphor.

Potential benefit:

- a tiny copy refinement could slightly improve Pixel/Cosmos identity if a specific awkward phrase is identified.

Risk:

- copy refinement can obscure the core `Create note` action.
- copy refinement can accidentally imply backup safety, restore readiness, cloud sync, or graph behavior that does not exist.
- repeated copy polishing risks overworking a surface that is already clear enough.

Likely files touched if implemented:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.
- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`.

Tests needed:

- product copy assertions.
- callback preservation assertions.
- negative assertions for Static Preview, graph, Data Safety, Backup Health, cloud sync, and restore claims.

Recommendation:

- do not implement copy refinement unless a specific source-grounded copy issue is identified.
- no source-grounded copy defect is identified in K-268.

## Follow-up Candidate 2: Visual Hierarchy / Rhythm Refinement

Question:

- Do spacing, grouping, pixel/cosmos tokens, or hierarchy need a small polish?

Source-grounded status:

- current layout has a single framed empty-state section with capped width, internal gap rhythm, a compact identity/header cluster, a guidance panel, and wrapped CTAs.
- the layout remains information-first.
- pixel/cosmos tokens are CSS-only and decorative elements are hidden from assistive technology.

Potential benefit:

- a tiny hierarchy adjustment could improve polish if a real screenshot or browser QA note identifies uneven rhythm.

Risk:

- visual polish can become overdecorated cosmic UI.
- a runtime edit requires 390px/manual browser QA.
- repeated visual edits can make the empty state feel like a showcase instead of a writing entry point.

Likely files touched if implemented:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.
- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`.

Tests/browser QA needed:

- component tests for required copy/actions.
- 390px browser QA.
- horizontal overflow and clipping check.
- keyboard/focus check.

Recommendation:

- implement only if a single bounded hierarchy issue is confirmed by source audit, screenshot, or browser QA.
- no confirmed visual hierarchy defect is identified in K-268.

## Follow-up Candidate 3: CTA Grouping / Affordance Refinement

Question:

- Does `Create note` remain obvious, and do secondary actions need grouping clarification?

Source-grounded status:

- `Create note` is the first CTA, styled as the primary action, and remains literal.
- secondary actions are optional, visible, native buttons.
- all actions use `abs-focus-ring`.
- callback behavior is covered by tests.

Potential benefit:

- a small focus/hover or grouping refinement could help if browser QA shows unclear action hierarchy.

Risk:

- changing affordance can accidentally change action behavior.
- grouping secondary actions too aggressively can hide `Open today's note` or `Import backup`.
- backup/import copy must not become Data Safety or restore productization.

Likely files touched if implemented:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.
- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`.

Tests/browser QA needed:

- `Create note`, `Open today's note`, and `Import backup` callback preservation.
- native button and focus-ring assertions.
- 390px visible action check.
- manual Create note click QA if that is the specific target.

Recommendation:

- preserve callback behavior and avoid behavior changes.
- no CTA grouping code change is recommended by K-268.

## Follow-up Candidate 4: Responsive / 390px Polish

Question:

- Does K-265/K-266 evidence show any 390px issue?

Source-grounded status:

- K-266 records 390px browser QA as passing for visibility, native primary CTA, secondary actions, overflow, clipping, and absence of forbidden surfaces.
- current component uses `width: min(100%, 620px)`, clamped margins/padding, wrapping CTA row, and text overflow wrapping.
- the K-265 test also verifies mobile empty-vault pane behavior in `NoteView.tsx`.

Potential benefit:

- responsive polish would be useful if a new screenshot shows overflow, clipped buttons, or awkward stacking.

Risk:

- responsive runtime changes require browser QA and can disturb the already verified mobile behavior.
- mobile polish without evidence can churn a stable surface.

Likely files touched if implemented:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`.
- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`.

Tests/browser QA needed:

- component tests.
- manual/browser 390px QA.
- no horizontal overflow.
- no clipping.
- no note-list/editor split regression for empty mobile vault.

Recommendation:

- only implement if there is a confirmed mobile issue.
- K-268 finds no confirmed mobile issue.

## Follow-up Candidate 5: Manual QA Follow-up Only

Question:

- Should the Create note unclicked low note from K-266 be handled as manual QA rather than code?

Source-grounded status:

- K-266 explicitly records that `Create note` was not clicked during browser QA to avoid creating local data.
- the focused unit test clicks `Create note` and verifies `onCreateNote` is called once.
- there is no source evidence that the action is broken.

Potential benefit:

- a small QA/audit milestone could close the only remaining low note without touching runtime code.
- it can verify the browser click path in a controlled local vault.

Risk:

- manual QA creates local data unless the test vault is disposable.
- it should not become a UI implementation PR.

Likely files touched if chosen:

- a K-269 QA/audit doc.
- a K-269 audit test if the milestone records source-facts.
- no runtime files.

Recommendation:

- if the team wants to close the only known low note, choose QA/audit-only.
- otherwise, consider the empty-state polish line sufficiently closed and move to Static Preview continuation or another product surface plan.

## Explicitly Rejected Candidates

K-269 should not choose:

- broad Notes UI overhaul.
- changing the main Notes editor layout.
- route/nav/panel additions.
- Static Preview runtime wiring.
- runtime Cosmos Map.
- graph replacement.
- `NoteGraphView` changes.
- `LocalGraphView` changes.
- live graph data integration.
- `KnowledgeIndexService` coupling.
- persistence/schema/spatial metadata.
- backup/Data Safety product UI.
- backup runtime productization.
- export blocking.
- restore/import validation.
- restore preview/dry-run.
- attachment blob backup.
- provider-aware recovery.
- Supabase/OAuth/Google Drive behavior change.
- Health/Schedule behavior change.
- assets/fonts/dependencies.

## Decision Matrix

| Criterion | Copy refinement | Visual hierarchy / rhythm | CTA grouping / affordance | Responsive / 390px polish | Manual QA follow-up only |
| --- | --- | --- | --- | --- | --- |
| user-visible impact | Low unless a specific copy issue exists. | Low to medium if a visible rhythm defect exists. | Low to medium if action hierarchy is unclear. | Medium only if a mobile issue exists. | Low visually, useful for confidence. |
| implementation risk | Low, but copy can imply unsupported behavior. | Medium because runtime layout changes need QA. | Medium because actions are core entry points. | Medium because mobile behavior was already verified. | Very low; no runtime code. |
| runtime coupling | Existing empty-vault component only if implemented. | Existing empty-vault component only if implemented. | Existing empty-vault component only if implemented. | Existing empty-vault component and mobile pane expectations. | None. |
| responsive/mobile QA need | Needed if UI copy affects wrapping. | Required. | Required. | Required. | Only if manually verifying browser click path. |
| accessibility QA need | Needed for readable text and labels. | Needed to preserve semantics and focus. | Needed for native buttons and focus. | Needed for mobile readability. | Source audit only unless browser click QA is performed. |
| CTA/callback risk | Low if text-only; still must preserve literal action. | Low if layout-only. | Highest among candidates. | Low to medium if button wrapping changes. | None to runtime behavior. |
| product identity gain | Low; current copy is already specific. | Low unless screenshot evidence supports it. | Low; current primary action is clear. | Low unless mobile evidence supports it. | Low product identity gain, high closure value. |
| over-polish risk | Medium. | High. | Medium. | Medium. | Low. |
| reversibility | Good if component-only. | Good if component-only. | Good if behavior unchanged. | Good but QA-heavy. | Excellent. |
| suitability for K-269 | Not recommended without a specific issue. | Not recommended without a specific issue. | Not recommended without a specific issue. | Not recommended without a confirmed mobile issue. | Best if K-269 remains on the empty-state line. |

## Recommended K-269 Path

Primary recommendation:

**K-269 Notes Empty State Pixel-Cosmos Follow-up Closure Audit**

Scope:

- docs/audit plus audit test only.
- close empty state polish line.
- record that no further immediate UI polish is source-grounded.
- optionally include a controlled manual QA checklist for the `Create note` browser click path.
- recommend moving next to Static Preview continuation or Notes Overview / Signal Panel planning.

Rationale:

- K-268 does not identify a specific copy, hierarchy, CTA, or 390px defect that justifies another runtime edit.
- K-265/K-266 already proved the empty-vault surface can be shipped and audited.
- the only known low note is QA confidence around not clicking `Create note` in browser QA, not an implementation defect.

Alternative if the team wants one manual confidence step:

**K-269 Notes Empty State Create Note Manual QA Audit**

Scope:

- docs/audit or QA note only.
- verify `Create note` click path manually in a controlled disposable local vault.
- no UI changes.

Alternative if new source evidence appears:

**K-269 Notes Empty State Pixel-Cosmos Follow-up Polish**

Scope:

- small UI implementation.
- empty state only.
- preserve CTA/callback behavior.
- preserve accessibility/semantics.
- include 390px/browser QA.
- no route/nav/panel.
- no graph/store/persistence changes.
- requires Codex 5.5 high.

Alternative after closing empty-state line:

**K-269 Notes/Cosmos Static Preview Continuation Plan**

Scope:

- docs/plan plus audit test.
- move away from empty state and continue isolated static preview work.
- keep preview fixture-driven and unwired.

Not recommended:

- runtime Cosmos Map.
- graph replacement.
- route/nav/panel.
- backup/Data Safety UI.
- broad Notes UI overhaul.

## K-269 Implementation Boundaries If UI Follow-up Is Chosen

If K-269 implements an empty-state UI follow-up:

- touch only `NotesPixelCosmosEmptyState` and directly related tests if needed.
- preserve `NoteViewEditorArea` mount/wiring.
- preserve `Create note` callback.
- preserve `Open today's note` callback when available.
- preserve `Import backup` callback when available.
- preserve keyboard/focus behavior.
- preserve accessible labels/semantics.
- preserve readable typography.
- preserve mobile 390px behavior.
- avoid horizontal overflow.
- avoid large layout rewrite.
- avoid global visual overhaul.
- no route/nav/panel changes.
- no `NoteGraphView` changes.
- no `LocalGraphView` changes.
- no `NotesCosmosStaticPreview` mounting.
- no backup/preflight claims.
- no new import/restore behavior.
- no store/schema/persistence changes.

## Pixel/Cosmos Product Grammar Criteria

- pixel is grammar, not decoration.
- information-first layout.
- readable typography.
- productive interactions.
- native accessibility and semantics remain first-class.
- cozy sci-fi / pixel observatory / personal space archive tone.
- avoid overdecorated cosmic UI.
- avoid generic AI SaaS look.
- use signal/orbit/observatory language only where it clarifies state.
- do not hide core Notes actions behind spectacle.
- keep writing and retrieval more important than visual metaphor.

## Existing Graph Surface Preservation

- `NoteGraphView` remains full-vault graph.
- `LocalGraphView` remains local/context graph.
- Cosmos Map does not replace either.
- K-269 must not alter graph builders.
- K-269 must not couple to `KnowledgeIndexService`.
- K-269 must not introduce live graph data into static preview.
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

K-268 carries forward:

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

## Validation Expectations For K-269

If K-269 chooses Empty State follow-up implementation:

- targeted component/unit tests.
- CTA/callback preservation test.
- accessibility/semantic assertions where possible.
- 390px/manual browser QA.
- Create note click manual QA if relevant.
- no horizontal overflow.
- typecheck/build.
- no graph/store/persistence diffs.
- no route/navigation diffs.

If K-269 chooses closure/QA-only:

- doc/source audit test.
- source-facts check for unchanged runtime behavior.
- typecheck/build.
- no browser QA unless manually verifying Create note click path.
- no runtime diffs.

## Non-goals

- no UI implementation in K-268.
- no broad Notes UI overhaul.
- no Notes Empty State implementation in K-268.
- no Static Preview runtime wiring.
- no route/nav/panel change.
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

K-268 decides whether a tiny Notes Empty State follow-up is needed without implementing it.

K-265/K-266 already proved the empty-vault polish can be safely shipped and audited.

K-269 should either implement one tiny source-grounded follow-up or close the empty state polish line.

Existing graph surfaces remain preserved.

Static preview remains isolated.

Backup/preflight guardrails remain carried forward but not productized here.

Local runtime data remains source of truth.

Remote systems remain support layers.
