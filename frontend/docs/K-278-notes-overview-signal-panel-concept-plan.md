# K-278 Notes Overview / Signal Panel Concept Plan

## Purpose

K-278 defines a concept plan for a future Notes Overview / Signal Panel. K-278 follows closure of the Notes Empty State Pixel-Cosmos polish line and the isolated Static Preview visual grammar line.

K-278 is docs/plan plus audit test only. K-278 does not implement runtime UI. K-278 does not add route/nav/panel behavior. K-278 does not implement Runtime Cosmos Map. K-278 does not replace graph surfaces. K-278 does not modify `NotesCosmosStaticPreview`.

K-278 chooses the K-279 next path: Notes Overview / Signal Panel Data Boundary Audit.

## Current State Summary

K-265 through K-269 closed the Notes Empty State Pixel-Cosmos polish line. `NotesPixelCosmosEmptyState` is the productized empty-vault Notes/Cosmos surface, and Empty State remains the primary first-note onboarding surface when no notes exist.

K-270 through K-277 closed the isolated Static Preview visual grammar/accessibility/viewport proof line. `NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, and unwired. Static Preview lessons are available as visual/product grammar, not runtime product behavior.

`NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface. Runtime Cosmos Map is not implemented. Existing graph surfaces are not replaced. Backup/preflight guardrails remain infrastructure and are not productized here.

## Product Problem Definition

Users need a lightweight way to understand the current state of their note space without entering a graph. They need recent, resurfacing, and meaningful note signals summarized in a readable panel. They need orientation, not a full Cosmos Map.

The surface should help answer:

- what is currently active?
- what did I recently touch?
- what may be worth continuing?
- what should I return to before opening a graph or search flow?

Signal Panel is an orientation surface. Signal Panel is not a graph replacement. Signal Panel is not a Cosmos Map. Signal Panel is not backup/Data Safety UI. Signal Panel is not Archive Voyager.

The goal is to help users return to writing and thinking, not browse a decorative dashboard.

## Concept Definition

Notes Overview / Signal Panel is a future Notes product surface that may summarize:

- recent notes.
- active writing signals.
- resurfacing records.
- isolated or neglected notes.
- lightweight clusters or themes.
- local/contextual relationships.
- empty or low-activity states.
- attachment/reference traces only if separately scoped.

The concept should start as a plan. It should not require live graph implementation yet. It should not require new persistence/schema. It should not require remote/provider data. It should not claim global graph intelligence before source audit.

Signal Panel should be smaller, list/panel/readout-oriented, and reversible. It should make the note space legible without becoming a second full graph surface.

## Lessons From Static Preview

K-270 through K-277 produced reusable grammar lessons:

- signal hierarchy should be primary/secondary/faint.
- hierarchy should be text/structure based, not color-only.
- visual grammar must clarify meaning.
- fallback/accessibility must not be visual-only.
- 390px/narrow viewport proof matters before runtime exposure.
- generated artifacts must not be committed.
- isolated preview evidence does not imply runtime readiness.
- fixture-driven concepts must not be mistaken for live data.

For Signal Panel, these lessons mean the first runtime concept should be plain, semantic, readable, and data-audited before any visual ambition grows around it.

## Relationship To Existing Surfaces

### Empty State

Empty State handles empty vault / first-note onboarding. Signal Panel should not duplicate empty-state CTA behavior. If no notes exist, Empty State remains primary.

### Static Preview

Static Preview remains an isolated concept artifact. Signal Panel may borrow grammar lessons but not component/runtime code directly. Static Preview fixture is not product data.

### NoteGraphView

`NoteGraphView` remains the full-vault graph. Signal Panel must not replace it. Signal Panel should not require graph builder changes unless a future audit approves that boundary.

### LocalGraphView

`LocalGraphView` remains the local/context graph. Signal Panel must not replace it. Signal Panel may conceptually summarize local/context signals only after data audit.

### Cosmos Map

Runtime Cosmos Map remains unimplemented. Signal Panel is not Cosmos Map. Signal Panel should be smaller, list/panel/readout-oriented, and reversible.

### Home Signal Board

Home Signal Board is broader cross-surface orientation. Notes Overview / Signal Panel is Notes-scoped. Avoid overlap unless future IA chooses otherwise.

### Archive Voyager

Archive handles time-distance / old record resurfacing. Signal Panel may mention resurfacing, but should not become Archive Voyager.

## Candidate Signal Categories

### Candidate 1: Recent Notes

Recent notes have low conceptual complexity and are likely easier to source from local notes. Product value: quick re-entry.

### Candidate 2: Active Writing / Current Note Signals

Active writing signals are useful for orientation and may be tied to editor state. This candidate requires careful runtime boundary because editor state, active note state, drafts, and navigation history are different concepts.

### Candidate 3: Resurfacing Notes

Resurfacing notes are a strong Cosmos/Signal concept, but they carry data definition risk and may overlap Archive. They should not be first unless K-279 proves a simple local definition.

### Candidate 4: Neglected Or Isolated Notes

Neglected or isolated notes may be useful, but they may require relationship/index data. Risk: overclaiming without graph or `KnowledgeIndexService` audit.

### Candidate 5: Lightweight Clusters / Themes

Lightweight clusters/themes have strong product identity but high graph/index coupling risk. They are likely not the first implementation candidate.

### Candidate 6: Attachment / Reference Traces

Attachment/reference traces may be useful, but they should be deferred unless attachment boundaries are audited. Avoid backup/provider implications.

## Data Boundary Questions

K-279 must answer these before implementation:

- What local source of truth can be read safely?
- Which note metadata is already available in the current Notes runtime?
- Are recent notes already computed or must they be queried?
- Are active note and editor state safe to summarize without coupling to editor internals?
- Are relationships available without rebuilding graph/runtime index?
- Does any candidate require `KnowledgeIndexService`?
- Does any candidate require graph builders?
- Does any candidate require persisted coordinates/spatial metadata?
- Does any candidate require provider/network data?
- Does any candidate touch backup/export/import?
- How does this work offline/local-first?
- What is safe for empty, small, and large vaults?

Current source context suggests candidate data may exist around local notes, active note state, note sorting, recent/dashboard machinery, and knowledge/dashboard helpers. K-278 does not approve using any of it; it only identifies the boundary K-279 must audit.

## Runtime Placement Questions

K-279 or later planning must answer:

- Where could a future Signal Panel appear?
- Is it inside Notes overview area, editor-adjacent, or separate dev/test surface?
- Would it appear only when notes exist?
- How does it coexist with Empty State?
- How does it avoid route/nav/panel changes at first?
- Can first implementation be component-isolated before mounting?
- What browser/390px QA would be required before runtime exposure?

K-278 does not answer by implementing. K-278 does not add route/nav/panel behavior.

## Product Grammar Criteria

Signal Panel should follow these criteria:

- signal hierarchy: primary/secondary/faint.
- information-first layout.
- readable typography.
- native accessibility and semantic grouping.
- pixel is grammar, not decoration.
- cozy sci-fi / pixel observatory / personal archive tone.
- signal/readout language should clarify state.
- avoid overdecorated cosmic UI.
- avoid generic AI SaaS look.
- do not hide writing actions behind spectacle.
- panel should help users return to notes.

The panel should feel like a quiet readout for a personal workspace, not a dashboard that adds more work.

## Initial Scope Recommendation

Recommended first candidate for future implementation:

**Recent notes + active writing signal readout only.**

Reason:

- likely simpler than clusters/resurfacing/isolated-note intelligence.
- product-visible orientation.
- does not require graph replacement.
- may be auditable from local note metadata.

Defer:

- clusters/themes.
- neglected/isolated relationship intelligence.
- Runtime Cosmos Map.
- Archive-style time-distance resurfacing.
- attachment/reference traces.
- provider/remote signals.
- backup/Data Safety claims.

## K-279 Decision

Recommended primary path:

**K-279 Notes Overview / Signal Panel Data Boundary Audit**

Scope:

- docs/audit plus audit test only.
- inspect current Notes local data sources and runtime surfaces.
- determine whether recent notes + active writing signal readout can be implemented without graph/store/schema/provider changes.
- no UI implementation.

Alternative:

**K-279 Notes Overview / Signal Panel Component Boundary Plan**

Scope:

- docs/plan plus audit test.
- define isolated component boundary before data audit.

Alternative:

**K-279 Notes Overview / Signal Panel Concept Closure Audit**

Scope:

- docs/audit only.
- use if K-278 finds the concept is premature.

Not recommended:

- immediate runtime implementation.
- route/nav/panel.
- Runtime Cosmos Map.
- graph replacement.
- live graph intelligence.
- backup/Data Safety UI.

## Non-goals

K-278 has these explicit non-goals:

- no runtime UI implementation in K-278.
- no Notes Overview component.
- no Signal Panel component.
- no route/nav/panel change.
- no NotesCosmosStaticPreview changes.
- no NotesCosmosStaticPreview mounting.
- no Runtime Cosmos Map implementation.
- no graph replacement.
- no NoteGraphView change.
- no LocalGraphView change.
- no graph builder change.
- no KnowledgeIndexService coupling.
- no live Notes data integration.
- no Notes store changes.
- no persistence/schema change.
- no coordinates/orbits/spatial metadata persistence.
- no provider/network/background sync.
- no backup/preflight runtime implementation.
- no Data Safety / Backup Health UI.
- no export/import/restore behavior change.
- no attachment blob/provider behavior.
- no Supabase/OAuth/Google Drive behavior change.
- no Health/Schedule behavior change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-278 defines Notes Overview / Signal Panel as a concept, not implementation. Static Preview lessons may inform signal hierarchy, but isolated preview does not become runtime surface. Signal Panel is an orientation/readout surface, not Cosmos Map or graph replacement.

The first future scope should be recent notes + active writing signal readout, pending K-279 data boundary audit. Existing graph surfaces remain preserved. Runtime Cosmos Map and graph replacement remain rejected.

Backup/preflight guardrails remain carried forward but not productized here. Local runtime data remains source of truth. Remote systems remain support layers.
