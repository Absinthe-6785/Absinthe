# K-221 Notes/Cosmos Static Preview Component Plan

## Purpose

K-221 is a static preview component plan only. It is not implementation.

K-221 plans where and how a future read-only/static Notes/Cosmos preview component could render from the K-220 mock contract without changing runtime behavior.

K-221 does not implement runtime UI. K-221 does not add component code, routes, navigation, graph/canvas/orbit rendering, runtime Cosmos Map, persistence, schema fields, stored coordinates, live graph coupling, assets, fonts, dependencies, or background transfer behavior.

## Relationship To K-220

K-220 created the only approved preview input for this planning lane: `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

K-220 contract boundaries:

- `notesCosmosStaticPreviewFixture` is static mock data, not live graph data.
- `NotesCosmosPreviewFixture` is the fixture contract for future preview planning.
- K-220 relationship kinds are authoritative: `related`, `supports`, `contrasts`, `continues`, and `archives`.
- K-219 vocabulary examples must not override K-220 contract types.
- Relationships are top-level only through `relationships: NotesCosmosPreviewRelationship[]`.
- Nodes do not include `relationships` or `relationshipIds`.
- `positionHint` uses only `ring`, `order`, and `density`.
- `positionHint` is fixture-only and non-persistent.
- `validateNotesCosmosPreviewFixture` is a guardrail/helper, not a runtime data validation system.

K-221 must not modify the K-220 fixture contract unless a later milestone explicitly scopes that change.

## Component Posture

The future component should be:

- static
- read-only
- fixture-driven
- fallback-first
- non-navigational at first
- isolated from normal Notes routing
- isolated from live graph services

The future component must not be:

- an interactive graph
- a canvas implementation
- a WebGL implementation
- a force-directed simulation
- a replacement for `NoteGraphView`
- a replacement for `LocalGraphView`
- a replacement for Notes empty states
- a route or navigation change in K-221
- a runtime Cosmos Map implementation

The component should render the K-220 fixture as a readable preview, not as a new graph engine.

## IA Placement Options

### Option A: Docs/dev-only preview page

A docs/dev-only surface can render the static fixture outside normal product navigation.

Strengths:

- lowest risk to Notes workspace
- easiest to delete or revise
- avoids confusion with shipped graph surfaces
- keeps reviewers focused on readability, fallback text, mobile acceptance, and density

Risks:

- not visible to normal users
- may need a later integration decision

### Option B: Hidden experimental panel

A hidden experimental panel could render the static fixture in the app while staying outside normal navigation.

Strengths:

- closer to runtime UI constraints
- can test real CSS and responsive behavior later

Risks:

- can accidentally become a product surface
- may invite routing or state coupling too early

### Option C: Story/test-only component surface

A story/test-only component can validate rendering through tests without app routing.

Strengths:

- isolated
- easy to test
- does not change product navigation
- compatible with fixture-first development

Risks:

- may not reveal all workspace layout issues until later

### Option D: Future Notes empty-state adjacent preview

A future preview could appear near an empty or low-content Notes state.

Strengths:

- aligns with K-212 language
- may help explain the Cosmos identity

Risks:

- can confuse true empty-vault onboarding with graph/cosmos preview
- can make `NotesPixelCosmosEmptyState` responsibilities unclear
- too risky before an isolated component exists

### Option E: Inside existing graph view

A future preview could be placed inside or near `NoteGraphView`.

Strengths:

- graph-adjacent placement may feel conceptually close

Risks:

- highest risk of confusing or replacing `NoteGraphView`
- can blur current graph ownership
- can bypass the K-217 decision if done too early

### Recommended Placement

Recommended next step: use a docs/dev/test-only or isolated preview surface first.

Do not place the preview inside `NoteGraphView` or `LocalGraphView` yet. Do not attach it to normal Notes navigation yet. Do not place it inside Notes empty states yet.

The first runtime component, if approved later, should be isolated and fixture-driven.

## Rendering Model

A future component may render:

- fixture title and description
- nodes as static labeled items
- relationships as static labeled links or list rows
- cluster grouping
- optional non-persistent visual arrangement using `positionHint`
- fallback list/text representation
- mobile fallback note
- node kind and status labels
- relationship kind and strength labels

Rendering boundaries:

- no canvas requirement
- no WebGL requirement
- no force-directed simulation
- no live layout engine
- no runtime graph mutation
- no persisted coordinates
- no stored layout state
- no imported graph builders
- no `KnowledgeIndexService` reads

`positionHint` can inform a static visual arrangement, but it must remain fixture-only metadata.

## Fallback-First Requirement

The future preview must render a complete text/list fallback.

Fallback requirements:

- every node visible in fallback
- every relationship visible in fallback
- deterministic node order
- deterministic relationship order
- keyboard-readable structure
- screen-reader-friendly labels
- semantic headings
- no visual-only critical information
- literal node labels
- literal relationship labels
- literal dates and statuses

If a visual layout becomes too dense, the text/list fallback remains the source of readable truth.

## Mobile And Responsive Acceptance

Future implementation must pass 390px width acceptance before product integration.

Acceptance requirements:

- no horizontal overflow
- no clipped primary content
- readable labels
- fallback list usable on mobile
- visual density reduction if needed
- no reliance on hover-only controls
- no hidden primary actions
- no scroll trap
- preview must not break Notes editor/list

The preview should remain secondary to writing and reading.

## Performance Budget

The first component plan is limited to the K-220 fixture size:

- 10 nodes expected
- 12 relationships expected
- must remain within the K-219 8 to 16 node budget
- no large vault simulation
- no heavy dependency
- no canvas/WebGL in the first component plan
- no impact to normal Notes editor/list load
- no full-vault graph rendering
- no live graph data derivation

If runtime implementation is approved later, the component should remain lazy/isolated and should not load with the normal Notes writing path by default.

## Accessibility Requirements

Future implementation must include:

- keyboard/focus plan
- semantic headings and labels
- text alternatives for visual grouping
- reduced motion by default or no animation initially
- color not sole carrier of meaning
- literal labels for node kind
- literal labels for node status
- literal labels for relationship kind
- literal labels for relationship strength
- visible focus for any future control
- reading/writing remains primary

The first implementation should prefer no animation.

## Future Testing Plan

If a K-222 component skeleton is approved, it should add tests for:

- fixture import smoke
- renders fixture title and description
- renders all nodes
- renders all relationships
- renders all clusters
- renders fallback text coverage
- deterministic fallback order
- mobile 390px no-overflow check if browser/unit feasible
- no runtime service imports
- no graph builder imports
- no `KnowledgeIndexService` imports
- no `x`, `y`, or coordinate fields
- no mutation of fixture data
- no route or navigation wiring

The future tests should treat the K-220 fixture as immutable input.

## Non-Goals

- no runtime implementation in K-221
- no component code in K-221
- no route/navigation change
- no interactive graph/canvas/orbit map
- no runtime Cosmos Map
- no replacement of `NoteGraphView`
- no replacement of `LocalGraphView`
- no replacement of Notes empty states
- no live graph data
- no graph builder imports
- no `KnowledgeIndexService` imports
- no schema changes
- no store changes
- no provider changes
- no persistence changes
- no saved coordinates
- no spatial metadata
- no OAuth, Supabase, attachment, or Google Drive behavior
- no background remote-transfer behavior
- no assets
- no fonts
- no dependencies
- no full Notes cosmos navigation

## Next Milestone

Recommended next target: **K-222 Notes/Cosmos Static Preview Component Skeleton**.

K-222 should happen only if explicitly approved.

K-222 constraints:

- isolated component only
- fixture-driven only
- use K-220 fixture contract only
- no route/navigation wiring unless separately scoped
- no graph builder imports
- no `KnowledgeIndexService` imports
- fallback-first rendering required
- mobile 390px acceptance required
- preserve `NoteGraphView`
- preserve `LocalGraphView`
- no interactive graph/canvas/orbit behavior unless separately approved

## Closure Statement

K-221 keeps the future Notes/Cosmos preview in an isolated, fixture-driven, fallback-first lane. The safe next step is a component skeleton plan-to-code milestone only after explicit approval, not integration into the shipped Notes workspace.
