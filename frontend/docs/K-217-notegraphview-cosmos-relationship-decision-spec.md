# K-217 NoteGraphView/Cosmos Relationship Decision Spec

## Purpose

K-217 is a relationship decision spec. It decides how the current shipped Notes graph surfaces should relate to a future Cosmos Map before any static preview, graph/canvas work, or runtime UI implementation begins.

K-217 is docs/spec only. K-217 does not implement Cosmos Map. K-217 does not change runtime UI. K-217 does not modify NoteView, NoteGraphView, NoteGraphViewLazy, LocalGraphView, graph data builders, KnowledgeIndexService, NotesPixelCosmosEmptyState, ProductEmptyState, stores, schemas, providers, persistence, routing, editor behavior, assets, fonts, dependencies, Health, Schedule, attachments, OAuth, Supabase, or Google Drive behavior.

The purpose is to prevent the future Cosmos Map concept from accidentally duplicating, replacing, or confusing the existing shipped graph surfaces.

## Current Shipped Graph Surfaces

### NoteGraphView

`NoteGraphView` is the current shipped full-vault graph surface for Notes. It is not a placeholder for a future feature.

Current responsibility:

- render a full-vault/global note relationship graph
- use current notes, folders, active note state, and relationship data
- support graph filters, search, zoom, pan, node selection, drag, and preview behavior
- present existing graph/cosmos visual language in the current product

Boundary:

- `NoteGraphView` remains the current shipped full-vault graph surface.
- Future Cosmos work must not replace `NoteGraphView` without a later migration decision.
- Future Cosmos work must not create a second competing full-vault graph surface casually.

### NoteGraphViewLazy

`NoteGraphViewLazy` is the current lazy-load boundary for the full-vault graph surface.

Current responsibility:

- defer graph code until graph view is mounted
- preserve loading behavior through the existing Notes loading fallback
- keep the full graph out of the default writing path until requested

Boundary:

- A future Cosmos preview must not bypass this existing performance boundary unless a later implementation spec proves that doing so is safe.
- K-217 does not change lazy-loading, fallback, or graph mount behavior.

### LocalGraphView

`LocalGraphView` is the current local/context graph surface. It is separate from `NoteGraphView`.

Current responsibility:

- show relationships around a selected note or focused context
- support local exploration rather than full-vault overview
- provide a contextual graph panel with its own local empty state and controls

Boundary:

- `LocalGraphView` remains a separate local/context graph surface.
- Future Cosmos Map must not collapse `NoteGraphView` and `LocalGraphView` into one unclear surface.
- K-218 or a later implementation plan must inspect `LocalGraphView` data shape, controls, navigation behavior, empty states, accessibility, and mobile behavior before reusing any LocalGraphView concept.

### Graph Data Builders

Current graph data builders include `buildGlobalGraphData`, `buildExpandedGraphData`, local graph neighborhood builders, and graph model helpers.

Current responsibility:

- derive graph nodes and edges from current Notes and knowledge data
- support the full-vault graph and local/context graph paths
- keep graph data derived from observable local Notes data

Boundary:

- Future Cosmos Map may reuse these concepts only after deciding whether it is separate, composable, or a later evolution of graph surfaces.
- K-217 adds no coordinates, orbit state, spatial metadata, canvas state, or graph persistence.

### KnowledgeIndexService

`KnowledgeIndexService` is the current knowledge/relationship indexing source used by graph builders and related Notes surfaces.

Current responsibility:

- index note links, backlinks, mentions, tags, properties, and explicit relations
- expose observable relationship data for graph derivation
- support current local-first knowledge discovery without new remote data assumptions

Boundary:

- Future Cosmos Map should prefer existing explicit and observable relationship data before introducing new inference.
- K-217 does not add new indexes, new storage, remote-first hydration, or persistence behavior.

### Current Graph Tests

Existing graph and graph-audit tests cover current graph data, local graph behavior, relation graph behavior, performance/memo concerns, and earlier cosmos/graph audits.

Relevant current coverage includes tests around:

- `buildGlobalGraphData`
- `buildExpandedGraphData`
- `LocalGraphView`
- relation UI graph behavior
- K-92 graph/cosmos audit and memo/performance guardrails
- K-214, K-215, and K-216 Notes/Cosmos docs/audit lineage

Boundary:

- Future Cosmos work must preserve current graph tests.
- A future replacement path must include explicit migration and regression coverage before changing graph ownership.

### K-212 NotesPixelCosmosEmptyState Difference

`NotesPixelCosmosEmptyState` is the current empty-vault pixel-cosmos identity surface. It is not a graph, canvas, node map, or relationship navigation surface.

Current responsibility:

- introduce the empty Notes workspace with pixel-cosmos identity
- provide literal first actions such as creating a note, opening today's note, or importing a backup
- preserve empty-vault mobile layout behavior

Boundary:

- `NotesPixelCosmosEmptyState` is separate from `NoteGraphView`, `NoteGraphViewLazy`, and `LocalGraphView`.
- Future Cosmos Map must not treat the K-212 empty state as proof that a graph/canvas Cosmos runtime already exists.

## Decision Question

What is the future relationship between the current shipped Notes graph surfaces and a future Cosmos Map?

The decision must answer whether Cosmos Map is separate from, composed from, evolved from, deferred relative to, or a replacement for current graph surfaces.

## Relationship Options

### Option A: Keep NoteGraphView and future Cosmos Map separate

Cosmos Map becomes a separate surface with its own entry, purpose, and accessibility plan while `NoteGraphView` remains the current shipped full-vault graph.

Strengths:

- lowest risk to current graph behavior
- avoids accidental replacement
- keeps writing and reading paths stable

Risks:

- could duplicate graph/navigation concepts if not tightly scoped
- requires clear IA so users understand why both surfaces exist

### Option B: Cosmos Map composes or wraps current graph infrastructure

Cosmos Map becomes a broader read-only or static layer that may compose current graph data builders, `KnowledgeIndexService`, or existing graph concepts without replacing the current graph surface.

Strengths:

- reuses source-verified relationship data
- keeps current graph ownership intact
- supports a static preview path before interactive work

Risks:

- must avoid bypassing graph performance boundaries
- must not imply that current graph data supports spatial/orbit persistence

### Option C: Cosmos Map becomes the future evolution of NoteGraphView

Cosmos Map eventually becomes the next version of `NoteGraphView`, but only after a later migration decision and implementation plan.

Strengths:

- reduces long-term duplication if the product chooses one full-vault visual relationship surface
- gives Cosmos Map a clear graph-owner role

Risks:

- high risk without migration tests
- may disrupt current graph navigation, accessibility, and performance behavior
- could turn a visual direction into a product replacement before the IA is proven

### Option D: Cosmos Map is deferred

Cosmos Map remains a concept until writing, reading, empty states, graph ownership, mobile behavior, and accessibility constraints are fully resolved.

Strengths:

- safest near-term path
- lets current Notes surfaces stabilize
- avoids premature canvas/graph architecture

Risks:

- delays visible Cosmos progress
- may leave product language broader than implemented runtime surfaces

### Option E: Replace NoteGraphView with Cosmos Map

Cosmos Map replaces `NoteGraphView`.

This is not recommended unless a future migration spec proves safety.

Risks:

- highest risk to current shipped graph behavior
- risks data, navigation, accessibility, and performance regressions
- requires explicit migration coverage for `NoteGraphView`, `NoteGraphViewLazy`, `LocalGraphView`, graph data builders, and current graph tests

## Recommended Decision

Do not replace `NoteGraphView` now.

Recommended posture: future Cosmos Map should be treated as separate or composable until a later implementation spec proves a safer evolution path.

Decision statements:

- `NoteGraphView` remains current shipped full-vault graph surface.
- `LocalGraphView` remains separate local/context graph surface.
- Cosmos Map is not implemented.
- Cosmos Map must not replace either surface without future migration decision.
- Future Cosmos preview must be read-only/static first and must not change graph data, persistence, or navigation semantics.

This recommendation keeps K-214/K-215/K-216 product direction alive while protecting current runtime behavior.

## LocalGraphView Boundary

`LocalGraphView` and `NoteGraphView` answer different questions.

`NoteGraphView`:

- full-vault/global
- overview and relationship discovery across the Notes vault
- broad graph search/filter/exploration

`LocalGraphView`:

- local/contextual
- selected-note neighborhood
- focused relationship exploration

Cosmos Map must not collapse both into an unclear surface. If future Cosmos work wants to borrow LocalGraphView concepts, K-218 or a later milestone must inspect:

- source data and graph shape
- local empty-state behavior
- selected-note navigation
- keyboard and pointer interaction
- focus management
- mobile and tablet behavior
- fallback text/list equivalent
- performance implications

## Data Boundary

Current graph data sources include local Notes data, folders, note metadata, explicit note relations, wiki-style links, backlinks, mentions, tags, properties, `KnowledgeIndexService`, and graph data builders.

Conceptually reusable:

- explicit links and backlinks
- explicit relations
- tags and properties
- note title, updated date, folder, and starred status
- derived local graph and full-vault graph data
- existing graph test expectations

Must not be assumed:

- persisted spatial metadata
- saved node coordinates
- orbit state
- galaxy layout state
- canvas viewport persistence
- account-age distance
- AI cluster data
- remote-first graph hydration

K-217 adds no coordinates, orbits, layout state, schema fields, store fields, provider behavior, persistence migration, background task, or remote data path.

Local-first Notes remain the source of truth.

## IA Boundary

Current Notes IA:

- list/search/filter supports fast retrieval
- editor/detail supports writing and reading
- `NotesPixelCosmosEmptyState` supports true empty-vault onboarding
- `ProductEmptyState` supports literal no-results, no-notes, trash, and select-note states
- `NoteGraphView` supports full-vault graph exploration
- `LocalGraphView` supports local/context graph exploration

Future Cosmos Map could sit as:

- a read-only overview
- a static preview
- a discovery layer
- an atmospheric identity layer
- a later graph evolution path after migration decision

Future Cosmos Map must not:

- replace writing or reading
- hide list/search/filter
- create duplicate navigation stories
- make empty vault, no search results, select-note, graph-empty, loading, and error states feel like the same state
- make current Notes feel like an analytics dashboard

Writing and reading remain primary. Cosmos is supporting context unless a later product decision changes that boundary.

## Accessibility And Readability

Future graph/cosmos surfaces need accessibility and readability boundaries before interactive implementation.

Requirements for any future preview or map:

- provide a text/list equivalent for nodes, relationships, and important status
- support keyboard navigation and visible focus
- avoid visual-only critical information
- avoid gesture-only critical paths
- support reduced motion
- preserve mobile and tablet fallbacks before interactive graph launch
- keep writing and reading primary
- use literal-first titles, dates, actions, and statuses before metaphor
- do not rely on color alone for node, edge, or status meaning
- keep controls reachable without horizontal scrolling

## Non-Goals

- no runtime implementation in K-217
- no static preview implementation in K-217
- no interactive graph/canvas implementation
- no node/orbit interaction
- no replacement of `NoteGraphView`
- no replacement of `LocalGraphView`
- no changes to `NoteGraphViewLazy`
- no changes to graph data builders
- no changes to `KnowledgeIndexService`
- no changes to `NotesPixelCosmosEmptyState`
- no changes to `ProductEmptyState`
- no NoteView changes
- no editor changes
- no store changes
- no schema changes
- no provider changes
- no persistence changes
- no routing changes
- no new indexes
- no remote data behavior
- no new sync or upload behavior
- no OAuth, Supabase, attachment, or Google Drive changes
- no Health or Schedule changes
- no generated assets
- no fonts
- no dependencies
- no global theme rollout

## Next Milestone

Recommended next target: **K-218 Notes/Cosmos Static Preview Plan**.

K-218 should be docs/plan only or a static preview spec first. It should not implement an interactive graph, canvas, orbit map, new graph engine, or runtime Cosmos Map.

K-218 should decide:

- whether the first preview uses mock/static data or read-only current graph data
- where the preview sits in Notes IA
- how it preserves `NoteGraphView` and `LocalGraphView`
- what accessibility fallback is required
- what mobile and tablet constraints apply
- what performance budget applies before any graph/canvas work

## Closure Statement

K-217 keeps current graph ownership stable. `NoteGraphView` remains the current shipped full-vault graph surface, `LocalGraphView` remains the current local/context graph surface, and Cosmos Map remains a future concept until a later static preview plan or migration decision proves a safe path.
