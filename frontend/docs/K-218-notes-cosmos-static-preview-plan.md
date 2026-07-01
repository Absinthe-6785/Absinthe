# K-218 Notes/Cosmos Static Preview Plan

## Purpose

K-218 is a static preview plan for a future Notes/Cosmos surface. It is not a runtime implementation.

K-218 defines how a future preview could be explored safely before any graph/canvas/orbit implementation, runtime Cosmos Map, new graph engine, routing change, persistence change, or data-model change begins.

K-218 is docs/plan only. K-218 does not change runtime UI. K-218 does not modify NoteView, NoteGraphView, NoteGraphViewLazy, LocalGraphView, graph data builders, KnowledgeIndexService, NotesPixelCosmosEmptyState, ProductEmptyState, stores, schemas, providers, persistence, routing, editor behavior, assets, fonts, dependencies, Health, Schedule, attachments, OAuth, Supabase, or Google Drive behavior.

## Relationship To K-217

K-217 made the current relationship decision:

- `NoteGraphView` remains preserved as the shipped full-vault graph surface.
- `LocalGraphView` remains preserved as the local/context graph surface.
- Cosmos Map is not implemented.
- Cosmos Map must not replace either graph surface without a future migration decision.
- Future Cosmos preview must be read-only/static first and must not change graph data, persistence, or navigation semantics.

K-218 follows that decision. K-218 does not replace, modify, wrap, fork, or re-route existing graph surfaces.

K-218 planning rule:

- `NoteGraphView` remains the current graph owner for full-vault graph exploration.
- `LocalGraphView` remains the current graph owner for selected-note context graph exploration.
- A future Cosmos preview is a separate planning concept until a later approved milestone defines its fixture, placement, and implementation boundary.

## Preview Posture

The first Cosmos preview should be static or read-only.

Allowed posture:

- static plan
- read-only visual concept
- docs-only mock
- fixture-backed prototype in a later approved milestone
- non-interactive presentation
- minimally interactive only in a later PR after accessibility and data boundaries are accepted

Not allowed in K-218:

- navigation replacement
- graph engine replacement
- runtime Cosmos Map
- interactive graph/canvas/orbit map
- persistence or schema change
- live note mutation
- background data job
- editor/list slowdown

The preview should be treated as a product-quality sketch with explicit boundaries, not as a new Notes navigation system.

## Data Source Decision

### Option A: Mock/static fixture data

Use hand-authored fixture data that resembles current note relationship concepts but does not read or mutate live Notes data.

Strengths:

- safest first preview path
- no store reads or writes
- no schema pressure
- no dependency on graph runtime behavior
- easy to keep small and accessible

Risks:

- may drift from current graph reality
- requires careful labeling so reviewers understand it is fixture data

### Option B: Read-only current graph data

Use read-only data derived from existing graph builders and `KnowledgeIndexService`.

Strengths:

- closer to current Notes relationship behavior
- tests a realistic data shape
- may reveal real label and density constraints

Risks:

- can accidentally depend on runtime graph behavior
- may blur ownership between preview and `NoteGraphView`
- requires stronger performance and lazy-loading guardrails

### Option C: Hybrid fixture derived from current graph shape

Define a static fixture format that is conceptually derived from current graph builders but stored as a docs/test fixture rather than live Notes data.

Strengths:

- preserves source-grounded shape without live mutation
- keeps preview deterministic
- easier to audit for labels, node count, mobile, and fallback text

Risks:

- still needs a clear statement that it is not live graph state
- requires K-219 to define exact fixture fields

### Option D: Defer preview until additional audit

Wait until more source, UX, accessibility, or performance audit work is complete.

Strengths:

- safest if graph ownership or IA remains unclear
- avoids premature visual implementation

Risks:

- delays visible progress on the Notes/Cosmos direction
- may leave design language abstract for too long

### Recommended Data Source Path

Start with mock/static fixture data or a static fixture derived from current graph concepts. Do not start with live graph mutation.

Recommended K-219 direction:

- define a small fixture shape
- include note-like nodes, labels, dates, statuses, and relationship hints
- keep the fixture deterministic and read-only
- optionally mirror concepts from existing graph builders without importing or mutating graph runtime data

Hard data boundaries:

- no writes
- no store migration
- no schema migration
- no persisted spatial metadata
- no saved coordinates
- no saved orbit state
- no new sync behavior
- no new background behavior
- no dependency on Google Drive, Supabase, OAuth, or attachments
- no remote-first graph hydration

Local-first Notes remain the source of truth.

## Ephemeral Vs Persisted Layout

Future preview discussion may use ephemeral runtime layout concepts, such as temporary positions, clusters, rings, or ordering in a mock/static preview.

Allowed:

- ephemeral layout concepts in docs
- fixture-only node ordering
- non-persistent visual grouping
- mock orbit or cluster vocabulary when labels remain readable
- read-only layout discussion for a later static prototype

Not allowed:

- persisted coordinates
- saved orbit state
- schema fields
- store fields
- migrations
- IndexedDB layout records
- remote layout state
- canvas viewport persistence

`LocalGraphView` may compute ephemeral layout positions at runtime today, but K-218 does not convert that behavior into stored Cosmos metadata.

## IA Placement

A future static preview could live in one of these locations:

- separate preview surface
- docs-only mock
- behind a dev or experimental route in a later approved milestone
- adjacent to but not replacing the current graph surface
- a read-only product preview used to validate language, density, and accessibility

It must not:

- replace `NoteGraphView`
- replace `LocalGraphView`
- replace Notes empty states
- replace list/search/filter
- replace the editor
- replace writing or reading flow
- become the default Notes landing surface
- become a hidden routing change

The strongest initial placement is a separate static preview plan or fixture spec, not a runtime route.

## Empty-State Relationship

K-212 `NotesPixelCosmosEmptyState` remains the empty-vault pixel-cosmos identity surface. It is separate from any future Cosmos Map preview.

Current empty-state boundaries:

- `NotesPixelCosmosEmptyState` is for true empty-vault onboarding.
- `ProductEmptyState` is for literal no-results, no-notes, trash, and select-note states.
- The select-a-note empty state should remain action-oriented and should not imply the vault is empty.
- Loading fallback behavior should remain explicit and literal.

Future Cosmos preview must not:

- replace the K-212 empty-state pilot
- turn no-results into a cosmos map
- turn select-a-note into a fake empty vault
- hide loading behind metaphor
- merge graph-empty, search-empty, trash-empty, select-note, and empty-vault states into one visual story

## Visual And Content Boundaries

A static preview may show:

- note nodes
- clusters
- orbit or trace vocabulary
- readable note labels and titles
- dates
- statuses
- relationship hints
- small groups of related notes
- literal fallback summaries

A static preview must not:

- hide note titles
- make critical meaning visual-only
- require color-only interpretation
- replace list/editor navigation
- imply real spatial metadata
- imply saved coordinates
- imply live sync
- imply remote graph hydration
- imply background upload, recovery, or attachment behavior
- imply AI clustering unless a later spec authorizes it

Content should remain literal-first. Metaphor can support orientation, but note titles, dates, actions, and statuses must stay readable.

## Accessibility And Readability Requirements

Any future preview or fixture spec must define:

- text/list fallback for nodes and relationships
- keyboard and focus plan
- visible focus state
- no visual-only critical information
- no gesture-only critical path
- reduced-motion path
- mobile 390px constraint
- no horizontal overflow
- readable labels
- literal-first actions and statuses
- screen-reader-friendly labels for nodes and relationship hints
- pointer and keyboard parity for any future controls
- Notes reading and writing remains primary

Mobile rule: a static preview must fit a 390px-wide viewport without clipping labels, hiding controls, or requiring horizontal scrolling.

## Performance Budget

K-218 does not implement runtime code, but it sets planning constraints for future implementation.

Initial constraints:

- start with a small fixture size
- define a clear node count budget before implementation
- prefer approximately 8 to 16 nodes for the first static fixture
- avoid heavy canvas or WebGL dependency in the plan
- add no new dependency in K-218
- future implementation must measure render cost
- future implementation must not slow normal Notes editor/list usage
- preserve the current `NoteGraphViewLazy` lazy-loading boundary if referencing graph surfaces
- avoid duplicating full-vault graph rendering cost

Future implementation must prove that the normal Notes writing path remains fast before any interactive graph/canvas work is accepted.

## Non-Goals

- no runtime implementation in K-218
- no interactive graph/canvas/orbit map
- no runtime Cosmos Map
- no replacement of `NoteGraphView`
- no replacement of `LocalGraphView`
- no changes to `NoteGraphViewLazy`
- no changes to graph data builders
- no changes to `KnowledgeIndexService`
- no changes to `NotesPixelCosmosEmptyState`
- no changes to `ProductEmptyState`
- no NoteView changes
- no editor changes
- no routing changes
- no store changes
- no schema changes
- no provider changes
- no persistence changes
- no saved coordinates
- no spatial metadata
- no saved orbit state
- no OAuth, Supabase, attachment, or Google Drive behavior
- no new sync, upload, or background transfer behavior
- no assets
- no fonts
- no dependencies
- no generated images
- no global theme changes
- no full Notes cosmos navigation

## Next Milestone

Recommended next target: **K-219 Notes/Cosmos Static Preview Fixture Spec**.

K-219 should:

- define exact fixture shape
- choose mock/static fixture data vs read-only derived fixture data
- define labels, dates, statuses, relationship hints, and node count
- define accessibility fallback text
- define responsive acceptance
- define 390px mobile acceptance
- preserve `NoteGraphView` and `LocalGraphView`
- avoid runtime implementation unless separately approved

K-219 should still be a planning/fixture boundary unless the team explicitly approves a narrow runtime static preview pilot.

## Closure Statement

K-218 keeps Cosmos Map in a safe planning lane. The next safe step is not a runtime graph. The next safe step is a fixture spec that can prove labels, density, fallback text, mobile behavior, and performance boundaries before any implementation touches the shipped Notes workspace.
