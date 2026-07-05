# K-270 Notes/Cosmos Static Preview Continuation Plan

## Purpose

K-270 plans how the Notes/Cosmos Static Preview line should continue after empty-state polish closure.

K-270 is docs/plan plus audit test only. K-270 does not implement UI. K-270 does not implement Static Preview changes. K-270 does not wire Static Preview into runtime. K-270 does not change route/nav/panel behavior. K-270 does not mount `NotesCosmosStaticPreview`. K-270 does not implement Runtime Cosmos Map. K-270 does not replace graph surfaces. K-270 chooses the K-271 next path.

## Current State Summary

K-269 closed the Notes Empty State Pixel-Cosmos polish line.

K-265 empty-vault polish remains the first runtime product-surface Pixel/Cosmos polish.

K-270 now evaluates Static Preview continuation as the next product/visual grammar track.

Current state:

- `NotesCosmosStaticPreview` remains isolated/unwired.
- Static Preview remains fixture-driven.
- current Static Preview does not use live graph data.
- current Static Preview does not read Notes stores.
- current Static Preview does not persist coordinates/orbits/spatial metadata.
- current Static Preview is not mounted in normal Notes navigation.
- `NoteGraphView` remains the shipped full-vault graph surface.
- `LocalGraphView` remains the local/context graph surface.
- Cosmos Map is not implemented.
- backup/preflight guardrails remain infrastructure and are not productized here.

## Static Preview Lineage

K-218 planned the Static Preview posture:

- static/read-only first.
- fixture-backed before live graph data.
- no runtime Cosmos Map.
- no graph replacement.
- no persistence/schema/spatial metadata.

K-219 defined the fixture-first direction:

- mock/static fixture data first.
- 8 to 16 node budget.
- fallback text required.
- 390px/mobile acceptance required.

K-220 created the mock/fixture contract:

- `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.
- 10 nodes, 12 relationships, 3 clusters.
- `positionHint` is fixture-only and non-persistent.
- `validateNotesCosmosPreviewFixture` is a guardrail/helper, not a runtime validation system.

K-221 planned the component skeleton:

- isolated component only.
- fixture-driven only.
- fallback-first.
- no route/navigation wiring.
- no graph builder or `KnowledgeIndexService` imports.

K-222 through K-224 created and polished the isolated component:

- `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.
- renders nodes, relationships, clusters, and text fallback.
- preserves mobile/fallback/readability expectations.
- remains isolated.

K-225 through K-227 did not approve normal runtime navigation/panel:

- no normal Notes navigation connection.
- no hidden experimental panel.
- no dev/test preview route proven safe.
- K-227 selected a real viewport test harness plan instead of route/panel implementation.

K-228 through K-234 built the viewport/static HTML proof path:

- static harness planning.
- generator implementation.
- closure audit.
- viewport QA evidence audit.
- generated HTML remains ephemeral and uncommitted.

The line's purpose was safe visual/product grammar exploration, not runtime graph replacement.

## Current Preview Contract

The current preview contract is:

- fixture-driven.
- deterministic.
- isolated/unwired.
- no live graph data.
- no Notes store reads.
- no `KnowledgeIndexService` coupling.
- no graph builder coupling.
- no persisted coordinates.
- no route/nav/panel.
- no hidden/default panel.
- no backup/Data Safety claims.
- accessibility/fallback expectations remain required.
- 390px/mobile proof remains required before runtime exposure.

Current approved input:

- `notesCosmosStaticPreviewFixture` from `notesCosmosStaticPreviewMockContract`.

Current component:

- `NotesCosmosStaticPreview`.
- renders ordered fixture nodes from fallback order.
- renders relationships from fixture relationships.
- renders text fallback sections.
- uses semantic headings and readable labels.
- uses responsive wrapping and max-width classes.

Current non-goals remain:

- no runtime product placement.
- no live graph or user data.
- no graph replacement.
- no saved spatial metadata.
- no product claim that Cosmos Map exists.

## Continuation Candidate 1: Static Preview Visual Grammar Polish

Scope:

- refine atmosphere, hierarchy, signal/orbit language, empty/cluster feel, and fixture presentation.
- stay isolated.
- keep fixture-driven.
- keep text/fallback truth visible.

Benefits:

- likely safest next implementation if small.
- improves product identity without runtime risk.
- continues the K-218 through K-234 visual/product grammar lane.
- can remain reversible if component-only.

Risks:

- visual polish can become overdecorated cosmic UI.
- copy or visual metaphor can imply shipped navigation.
- any visual implementation still needs responsive/static harness validation.

Recommendation:

- best K-271 direction as a plan.
- implementation is acceptable only if scoped to one tiny isolated preview refinement.

## Continuation Candidate 2: Static Preview Accessibility/Fallback Hardening

Scope:

- improve text fallback, semantics, keyboard/readability expectations, and screen-reader confidence.
- stay isolated.
- avoid visual expansion.

Benefits:

- safest if accessibility/fallback uncertainty is the main risk.
- improves long-term viability before runtime exposure.
- keeps product meaning literal and readable.

Risks:

- less visible product identity gain.
- may repeat work already covered by the current fallback unless a specific gap is identified.

Recommendation:

- good fallback if source audit finds accessibility/fallback evidence weaker than visual grammar evidence.

## Continuation Candidate 3: Static Preview Viewport Proof Refresh

Scope:

- update or rerun static HTML/390px evidence path.
- do not change runtime UI.
- do not commit generated HTML.

Benefits:

- useful before any future surface exposure.
- reinforces no-overflow and fallback readability.
- can validate that the current harness still works.

Risks:

- lower product movement.
- can become process-heavy if no component changes are planned.

Recommendation:

- choose if the team wants fresh QA evidence before visual polish implementation.

## Continuation Candidate 4: Static Preview Dev/Test Showcase Plan

Scope:

- define whether a dev/test-only viewing surface should exist.
- no normal Notes navigation.
- no product runtime surface.
- strict gate required.

Benefits:

- could make visual review easier.
- could avoid manual generator steps.

Risks:

- K-227 found no safe route/panel convention.
- dev/test surfaces can accidentally become product surfaces.
- production exposure gate would need source-verifiable proof.

Recommendation:

- not the default K-271 path.
- plan only if the team wants to revisit dev/test surface gating.

## Continuation Candidate 5: Runtime Static Preview Mounting

Scope:

- mount the preview into runtime Notes.

Status:

- not recommended now.

Reason:

- requires a separate gate and browser QA.
- too close to product runtime exposure.
- may imply navigation/product readiness that the preview does not have.
- would break the current isolated contract.

## Continuation Candidate 6: Runtime Cosmos Map / Graph Replacement

Scope:

- replace graph surfaces or implement Runtime Cosmos Map.

Status:

- explicitly rejected.

Reason:

- too large.
- violates preserved graph surface boundary.
- risks graph builders, `KnowledgeIndexService`, persistence, accessibility, performance, and mobile behavior.

## Side-by-side Comparison

| Criterion | Visual grammar polish | Accessibility/fallback hardening | Viewport proof refresh | Dev/test showcase plan | Runtime mounting | Runtime Cosmos Map / graph replacement |
| --- | --- | --- | --- | --- | --- | --- |
| product identity gain | High for the preview line. | Medium; strengthens trust more than mood. | Low; evidence-oriented. | Medium if it improves review access. | High but premature. | High conceptually, too risky. |
| implementation risk | Low if isolated and tiny. | Low if isolated. | Low if docs/audit or ephemeral harness only. | Medium because gating is unresolved. | High. | Very high. |
| runtime coupling | None if isolated. | None if isolated. | None. | None if no route/panel is implemented. | Direct runtime coupling. | Deep runtime coupling. |
| responsive/mobile QA need | Required if implemented. | Required if rendering changes. | Primary purpose. | Required if surface exists later. | Required. | Required and broad. |
| accessibility QA need | Required. | Primary purpose. | Useful. | Required if surfaced. | Required. | Required and complex. |
| graph/persistence risk | Low if fixture-only. | Low if fixture-only. | Low. | Low to medium depending on gate. | Medium. | High. |
| reversibility | Good if component-only. | Good if test/doc/component-only. | Excellent if docs/ephemeral. | Good as plan, weaker if route exists. | Lower. | Low. |
| alignment with isolated preview contract | Strong. | Strong. | Strong. | Medium; must preserve isolation. | Weak. | None. |
| suitability for K-271 | Best as a plan, possible tiny implementation later. | Good audit fallback. | Good QA fallback. | Planning only. | Not recommended. | Rejected. |

## Recommended K-271 Path

Primary recommendation:

**K-271 Notes/Cosmos Static Preview Visual Grammar Polish Plan**

Scope:

- docs/plan plus audit test.
- choose one tiny isolated preview refinement.
- no implementation yet if more specificity is needed.
- no runtime wiring.

Rationale:

- empty-state polish is closed.
- Static Preview is the safest remaining Notes/Cosmos product grammar track.
- K-271 can choose a specific small visual refinement without widening into product runtime.

Alternative if ready for implementation:

**K-271 Notes/Cosmos Static Preview Visual Grammar Polish**

Scope:

- small isolated component implementation.
- fixture-driven only.
- no runtime mounting.
- preserve fallback/accessibility.
- include responsive/static harness validation if available.
- requires Codex 5.5 high.

Alternative:

**K-271 Notes/Cosmos Static Preview Accessibility/Fallback Audit**

Scope:

- docs/audit plus audit test.
- use if accessibility/fallback uncertainty is the main risk.

Alternative:

**K-271 Notes Overview / Signal Panel Concept Plan**

Scope:

- docs/plan plus audit test.
- pivot away from Static Preview if product team wants a more functional surface.

Not recommended:

- runtime Cosmos Map.
- graph replacement.
- route/nav/panel.
- Static Preview runtime mounting.
- backup/Data Safety UI.

## K-271 Boundaries If Static Preview Visual Polish Is Chosen

If K-271 implements Static Preview visual polish:

- touch only `NotesCosmosStaticPreview` and directly related isolated tests if implementing.
- keep fixture-driven.
- keep isolated/unwired.
- no normal Notes navigation.
- no route/nav/panel.
- no live graph data.
- no graph builders.
- no `KnowledgeIndexService`.
- no Notes store/persistence/schema changes.
- no persisted coordinates/spatial metadata.
- no canvas/SVG/WebGL engine unless already part of isolated component and explicitly audited.
- preserve fallback/accessibility.
- preserve 390px/mobile proof expectations.
- no backup/preflight claims.
- no product claim that Cosmos Map exists.

If K-271 remains plan-only:

- doc/source audit test.
- source-facts check for isolation where useful.
- typecheck/build.
- no browser QA required.

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
- visual preview should clarify future product direction, not imply shipped navigation.
- text fallback remains the readable source of truth when visual density rises.

## Static Preview / Runtime Boundary

- `NotesCosmosStaticPreview` remains isolated unless a future milestone explicitly mounts it.
- static fixture remains deterministic.
- no live note graph.
- no persisted coordinates/orbits/spatial metadata.
- no hidden/default panel.
- no normal Notes navigation wiring.
- runtime surface changes require a separate gate.
- 390px/mobile proof required before runtime exposure.
- dev/test surface, if ever considered, requires a separate plan.

## Existing Graph Surface Preservation

- `NoteGraphView` remains full-vault graph.
- `LocalGraphView` remains local/context graph.
- Cosmos Map does not replace either.
- K-271 must not alter graph builders.
- K-271 must not couple to `KnowledgeIndexService`.
- K-271 must not introduce live graph data into static preview.
- any future graph migration requires explicit decision.

## Local-first / Backup Guardrails

K-270 carries forward:

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

## Validation Expectations For K-271

If K-271 chooses Static Preview visual polish implementation:

- static preview component tests.
- fixture contract tests.
- fallback/accessibility assertions where possible.
- 390px/static HTML or wrapper-level responsive validation if existing.
- no runtime import/wiring source audit.
- typecheck/build.
- no route/navigation diffs.
- no graph/store/persistence diffs.

If K-271 remains plan/audit-only:

- doc/source audit test.
- source-facts check for isolation where useful.
- typecheck/build.
- no browser QA required.
- no runtime diffs.

## Non-goals

- no UI implementation in K-270.
- no Static Preview implementation in K-270.
- no Static Preview runtime wiring.
- no route/nav/panel change.
- no `NotesCosmosStaticPreview` mounting.
- no hidden panel.
- no Runtime Cosmos Map implementation.
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

K-270 selects Static Preview continuation as an isolated visual/product grammar track without implementing it.

Empty-state polish remains closed from K-269.

Static Preview remains fixture-driven and unwired.

Existing graph surfaces remain preserved.

Runtime Cosmos Map and graph replacement remain rejected.

Backup/preflight guardrails remain carried forward but not productized here.

K-271 should remain small, isolated, and reversible.

Local runtime data remains source of truth.

Remote systems remain support layers.
