# K-267 Notes/Cosmos Surface Polish Next Candidate Plan

## Purpose

K-267 selects the next Notes/Cosmos surface polish candidate after K-265 and K-266.

K-267 is docs/plan plus audit test only. K-267 does not implement UI. K-267 does not make a broad Notes UI overhaul. K-267 does not change route/nav/panel behavior. K-267 does not wire Static Preview into runtime. K-267 does not mount `NotesCosmosStaticPreview`. K-267 does not implement Cosmos Map. K-267 does not replace graph surfaces. K-267 chooses the K-268 next path.

## Current State Summary

K-263 restarted Notes/Cosmos product surface planning after the backup foundation line.

K-264 audited Option A Notes Empty State polish against Option B Static Preview continuation and selected Notes Empty State polish as the first bounded implementation candidate.

K-265 implemented narrow empty-vault UI polish on the existing `NotesPixelCosmosEmptyState` runtime surface.

K-266 closed K-265 with a docs/audit plus source-facts closure audit.

Current state:

- `NotesPixelCosmosEmptyState` is now the first product-surface Pixel/Cosmos polish.
- `Create note`, `Open today's note`, and `Import backup` CTA/callback behavior is preserved.
- accessibility and semantics are documented.
- 390px browser QA evidence exists.
- the Create note unclicked browser QA low note remains non-blocking because callback invocation is covered by unit tests.
- `NotesCosmosStaticPreview` remains isolated/unwired.
- `NoteGraphView` remains the shipped full-vault graph surface.
- `LocalGraphView` remains the shipped local/context graph surface.
- backup/preflight guardrails remain infrastructure and are not productized here.

## Lessons From K-265/K-266

- small bounded runtime UI polish worked.
- source-facts closure audit was useful.
- CTA/callback preservation must remain explicit.
- 390px/mobile QA is important for user-facing UI.
- visual identity changes should remain small and reversible.
- accessibility and semantics must be preserved.
- no backup/Data Safety claims should leak into Notes/Cosmos product surfaces.
- broad UI overhaul should still be avoided.
- product language works best when core writing actions remain literal.

## Candidate 1: Notes Empty State Follow-up Polish

This candidate builds directly on the K-265 empty-vault product surface.

Possible follow-up examples:

- microcopy refinement.
- empty-vault visual rhythm refinement.
- CTA affordance/focus state refinement.
- small responsive polish.
- manual QA for Create note click behavior if the team wants browser-level confirmation beyond unit tests.

Recommended milestone type:

- plan/audit first if the team wants one more safety step.
- implementation is acceptable only if the follow-up is tiny and empty-state-only.

Likely implementation files if approved later:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`
- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts`
- optional narrow follow-up doc/audit test.

Benefits:

- immediate user-facing product impact.
- builds on K-265 safely.
- low conceptual ambiguity.
- preserves product momentum without graph ownership conflict.

Risks:

- touches runtime UI again.
- browser/manual QA needed.
- could over-polish the empty state while other Notes surfaces remain generic.
- can accidentally make backup/import promises if copy is not careful.

Boundaries:

- no route/nav/panel.
- no graph/store/persistence changes.
- no Static Preview runtime wiring.
- no broad Notes UI overhaul.
- no backup/Data Safety claims.

## Candidate 2: Static Preview Continuation, Still Isolated

This candidate continues `NotesCosmosStaticPreview` without wiring it into runtime Notes.

Current state:

- `NotesCosmosStaticPreview` is fixture-driven.
- the fixture lives in `notesCosmosStaticPreviewMockContract`.
- the preview is read-only.
- the preview is isolated/unwired from normal Notes navigation.
- the preview uses deterministic text fallback and responsive acceptance language.

Possible follow-up examples:

- visual grammar refinement.
- accessibility/fallback polish.
- static HTML/viewport proof refresh.
- dev/test-only showcase polish.
- fixture copy refinement.

Recommended milestone type:

- docs/plan plus audit test.
- implementation only if it remains fixture-driven and isolated.

Benefits:

- low runtime risk.
- strengthens Cosmos concept.
- can stay isolated.
- allows more visual grammar exploration without touching user data.

Risks:

- weaker immediate user-facing impact.
- may delay product surface progress.
- must not become a hidden runtime panel accidentally.
- can drift away from daily writing usefulness.

Boundaries:

- no runtime mounting.
- no route/nav/panel.
- no live graph data.
- no graph builders.
- no `KnowledgeIndexService`.
- no persisted coordinates/spatial metadata.
- no replacement of `NoteGraphView` or `LocalGraphView`.

## Candidate 3: Notes Overview / Signal Panel Concept

Concept:

- recent notes.
- resurfacing records.
- clusters/signals.
- current writing orbit.
- a quiet overview of what is active and worth returning to.

Benefits:

- strong product direction.
- connects Notes/Cosmos to daily use.
- could make the product feel more alive for non-empty vaults.
- could bridge Home Signal Board and Notes without implementing a graph.

Risks:

- higher data boundary risk.
- may need live note queries/index state.
- may overlap Home Signal Board.
- may imply new panel/navigation IA.
- likely too large for immediate K-268 implementation.

Recommendation:

- planning/spec only if chosen.
- not implementation yet.
- keep it separate from Home Signal Board until boundaries are clearer.

## Candidate 4: Cosmos Navigation Concept, Planning Only

Concept:

- observation/navigation language for Notes/Cosmos.
- define how signals, orbits, clusters, and traces are named.
- define navigation posture without replacing existing graph surfaces.
- not a graph replacement.
- not a runtime Cosmos Map.

Benefits:

- clarifies long-term IA.
- reduces risk before any route/panel/navigation work.
- preserves `NoteGraphView` and `LocalGraphView` by naming their current roles.

Risks:

- may remain abstract.
- not immediate product polish.
- can distract from small runtime improvements.
- may invite premature Cosmos Map implementation.

Recommendation:

- planning only if chosen.
- no implementation.

## Explicitly Not Recommended

K-268 should not choose:

- broad Notes UI overhaul.
- runtime Cosmos Map.
- route/nav/panel addition.
- graph replacement.
- `NoteGraphView` replacement.
- `LocalGraphView` replacement.
- Static Preview runtime wiring.
- live graph data integration.
- `KnowledgeIndexService` coupling.
- persistence/schema/spatial metadata.
- backup runtime productization.
- Data Safety / Backup Health UI.
- canvas/SVG/WebGL graph engine.
- attachment/provider recovery productization.

## Side-by-side Comparison

| Criterion | Notes Empty State follow-up | Static Preview continuation | Notes Overview / Signal Panel concept | Cosmos navigation concept |
| --- | --- | --- | --- | --- |
| user-visible impact | High if implemented; already product-facing. | Low to medium; isolated/dev-test unless later mounted. | High eventually, but not yet bounded. | Low immediate; helps future IA. |
| implementation risk | Low to medium if empty-state-only. | Low if fixture-driven and unwired. | Medium to high because live note context may be needed. | Low as docs, high if rushed into runtime. |
| runtime coupling | Existing bounded empty-vault runtime path. | None if isolation is preserved. | Potentially substantial. | None if planning only. |
| responsive/mobile QA need | Required for implementation; 390px proof needed. | Static/wrapper proof unless mounted. | Required and likely broader. | Not needed for docs-only. |
| accessibility QA need | Required; buttons/focus/copy must remain literal. | Required for fallback/readability. | Required for live overview semantics. | Required later if implemented. |
| graph/persistence risk | Low if empty-state-only. | Very low if fixture-only. | Medium because live data boundaries matter. | Low as docs, high if it becomes graph work. |
| product identity gain | Strong and immediate. | Strong conceptually, weaker in product. | Strong, but needs more boundary work. | Strong for language and IA. |
| reversibility | Good if component-only. | Excellent if fixture/component-only. | Lower until scoped. | Excellent as docs. |
| alignment with product surface return | Strongest for immediate product polish. | Good for visual grammar. | Strong for future product direction. | Good for long-term IA. |
| suitability for K-268 | Best as a plan, possible tiny implementation. | Good fallback as plan. | Planning/spec only. | Planning/spec only. |

## Recommended K-268 Path

Primary recommendation:

**K-268 Notes Empty State Pixel-Cosmos Follow-up Polish Plan**

Scope:

- docs/plan plus audit test.
- choose one tiny follow-up from K-265/K-266.
- no implementation yet if the team wants another safety step.
- explicitly decide whether browser Create note click QA should be performed in a controlled local vault.

Rationale:

- K-265/K-266 proved the empty-vault surface can be safely polished and audited.
- one more planning pass can choose a single tiny improvement without widening scope.
- this keeps product momentum while avoiding broad Notes UI overhaul.

Alternative if ready for implementation:

**K-268 Notes Empty State Pixel-Cosmos Follow-up Polish**

Scope:

- small UI implementation.
- empty state only.
- preserve CTA/callback behavior.
- preserve accessibility/semantics.
- include 390px/browser QA.
- no route/nav/panel.
- no graph/store/persistence changes.
- requires Codex 5.5 high.

Alternative:

**K-268 Notes/Cosmos Static Preview Continuation Plan**

Scope:

- docs/plan plus audit test.
- keep preview isolated.
- no runtime mounting.

Not recommended:

- runtime Cosmos Map.
- graph replacement.
- route/nav/panel.
- backup/Data Safety UI.

## K-268 Implementation Boundaries If Empty State Follow-up

If K-268 implements an empty-state follow-up:

- touch only empty state and directly related tests.
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

## K-268 Boundaries If Static Preview Continuation

If K-268 chooses Static Preview continuation:

- fixture-driven only.
- isolated/unwired.
- no normal Notes navigation.
- no route/nav/panel.
- no live graph data.
- no graph builders.
- no `KnowledgeIndexService`.
- no persisted coordinates/spatial metadata.
- no canvas/SVG/WebGL engine.
- preserve fallback/accessibility.
- preserve 390px/mobile proof expectations.
- do not replace `NotesPixelCosmosEmptyState`.
- do not replace `NoteGraphView` or `LocalGraphView`.

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
- K-268 must not alter graph builders.
- K-268 must not couple to `KnowledgeIndexService`.
- K-268 must not introduce live graph data into static preview.
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

K-267 carries forward:

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

## Validation Expectations For K-268

If K-268 chooses Empty State follow-up implementation:

- targeted component/unit tests.
- CTA/callback preservation test.
- accessibility/semantic assertions where possible.
- 390px/manual browser QA.
- Create note click manual QA if relevant.
- no horizontal overflow.
- typecheck/build.
- no graph/store/persistence diffs.
- no route/navigation diffs.

If K-268 chooses Static Preview continuation:

- static preview tests.
- fixture contract tests.
- SSR/static HTML or wrapper-level responsive tests if existing.
- no runtime import/wiring source audit.
- typecheck/build.
- no route/navigation diffs.

If K-268 remains docs/plan:

- doc audit test.
- source isolation audit if practical.
- no runtime diffs.
- typecheck/build.

## Non-goals

- no UI implementation in K-267.
- no broad Notes UI overhaul.
- no Notes Empty State implementation in K-267.
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

K-267 selects the next small Notes/Cosmos surface polish candidate without implementing it.

K-265/K-266 proved a small empty-vault polish can be safely shipped and audited.

K-268 should remain small, bounded, and reversible.

Existing graph surfaces remain preserved.

Static preview remains isolated.

Backup/preflight guardrails remain carried forward but not productized here.

Local runtime data remains source of truth.

Remote systems remain support layers.
