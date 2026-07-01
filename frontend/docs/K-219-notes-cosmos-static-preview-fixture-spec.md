# K-219 Notes/Cosmos Static Preview Fixture Spec

## Purpose

K-219 defines the static preview fixture specification for a future Notes/Cosmos preview. It is not a runtime implementation.

K-219 exists to define the fixture contract and acceptance boundaries before any runtime static preview component, graph/canvas/orbit implementation, runtime Cosmos Map, routing change, persistence change, or data-model change begins.

K-219 is docs/fixture-spec only. K-219 does not change runtime UI. K-219 does not modify NoteView, NoteGraphView, NoteGraphViewLazy, LocalGraphView, graph data builders, KnowledgeIndexService, NotesPixelCosmosEmptyState, ProductEmptyState, stores, schemas, providers, persistence, routing, editor behavior, assets, fonts, dependencies, Health, Schedule, attachments, OAuth, Supabase, or Google Drive behavior.

## Relationship To K-218

K-218 recommended fixture-first planning for Notes/Cosmos static preview work.

K-219 chooses that fixture posture:

- use mock/static fixture data first
- preserve existing `NoteGraphView`
- preserve existing `LocalGraphView`
- keep Cosmos Map unimplemented
- avoid runtime graph/canvas work
- avoid schema, store, provider, persistence, and routing changes

K-219 does not replace or modify existing graph surfaces. `NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface.

## Fixture Source Decision

### Selected Posture: Option A Mock/Static Fixture Data First

K-219 selects **Option A: mock/static fixture data first**.

Reason:

- lowest ownership risk
- avoids coupling to `KnowledgeIndexService`
- avoids coupling to graph data builders
- avoids live graph performance risk
- avoids implying Cosmos Map uses persisted graph metadata
- avoids implying Cosmos Map uses persisted spatial metadata
- easiest to test for accessibility boundaries
- easiest to test for 390px mobile acceptance
- easiest to test for fixture size and label density

The fixture may use vocabulary from the current Notes/Cosmos direction, but it must not read live Notes data, mutate live graph data, or imply that runtime graph behavior has changed.

### Deferred Options

Option B, read-only current graph data, is deferred. It may be revisited only after the mock/static fixture contract proves label, density, accessibility, mobile, and performance boundaries.

Option C, hybrid-derived fixture data, may be revisited later. If used, it should remain a static fixture derived from current graph concepts rather than a live import from graph builders.

Option D, deferring preview entirely, remains available if fixture review finds unresolved IA, accessibility, or performance risk.

Hard boundaries:

- no live graph mutation
- no writes
- no schema migration
- no store migration
- no persistence migration
- no new indexes
- no remote graph hydration
- no dependency on Google Drive, Supabase, OAuth, or attachments
- no new sync, upload, or background transfer behavior

## Fixture Shape

The future fixture should be a small, explicit object with separate node, relationship, cluster, and fallback sections.

Recommended top-level shape:

```ts
type NotesCosmosStaticPreviewFixture = {
  id: string;
  title: string;
  description: string;
  nodes: NotesCosmosPreviewNode[];
  relationships: NotesCosmosPreviewRelationship[];
  clusters: NotesCosmosPreviewCluster[];
  fallback: NotesCosmosPreviewFallback;
};
```

Recommended node fields:

```ts
type NotesCosmosPreviewNode = {
  id: string;
  label: string;
  kind: NotesCosmosPreviewNodeKind;
  summary: string;
  tone: 'quiet' | 'active' | 'reference' | 'archival';
  status: 'recent' | 'active' | 'steady' | 'archived';
  clusterId: string;
  clusterLabel: string;
  relationships: string[];
  createdAtLabel: string;
  updatedAtLabel: string;
  positionHint?: NotesCosmosFixturePositionHint;
};
```

Recommended cluster fields:

```ts
type NotesCosmosPreviewCluster = {
  id: string;
  label: string;
  summary: string;
};
```

Recommended fixture-only position hint:

```ts
type NotesCosmosFixturePositionHint = {
  ring: 'inner' | 'middle' | 'outer';
  order: number;
};
```

Important boundary: `positionHint` is fixture-only and non-persistent. It is not a saved coordinate, not an orbit state, not a note field, not a schema field, and not layout metadata for the shipped app.

This spec does not create TypeScript runtime types. It defines the future fixture contract only.

## Node Kinds

Allowed node kinds for the first fixture:

- `note`
- `cluster`
- `anchor`
- `signal`
- `archiveTrace`

Keep node kinds small and literal. These are fixture labels, not existing runtime object types and not persisted note kinds.

Definitions:

- `note`: a note-like record in the preview.
- `cluster`: a grouped concept that helps explain nearby notes.
- `anchor`: a central concept or current writing focus.
- `signal`: a recent or active trace.
- `archiveTrace`: a historical trace shown as context, not Archive data migration.

The first fixture should prefer `note`, `cluster`, and `anchor`. `signal` and `archiveTrace` should be used sparingly so the preview does not become a dashboard or Archive replacement.

## Relationship Fixture

Recommended relationship fields:

```ts
type NotesCosmosPreviewRelationship = {
  sourceId: string;
  targetId: string;
  label: string;
  strength: 'weak' | 'medium' | 'strong';
  kind: 'link' | 'theme' | 'sequence' | 'reference' | 'trace';
};
```

Boundary:

- relationships are fixture-only
- relationships do not rewrite current graph data builders
- relationships do not require new indexes
- relationships do not require `KnowledgeIndexService` changes
- relationships do not persist edges
- relationships do not change `NoteGraphView`
- relationships do not change `LocalGraphView`

Every relationship must have a readable `label`. Relationship meaning must not rely on color, line thickness, animation, or spatial distance alone.

## Fixture Size Budget

The first preview fixture should be intentionally small.

Budget:

- minimum 8 nodes
- maximum 16 nodes
- prefer 3 or fewer clusters
- prefer 10 to 24 relationships
- no large vault simulation
- no performance benchmark claims from fixture size alone
- future implementation must measure render cost

The fixture should be large enough to test labels, clusters, fallback copy, and mobile wrapping, but small enough to avoid implying that full-vault graph performance has been solved.

## Accessibility Fallback Text

The fixture must include fallback text that can represent the preview without visual layout.

Required fallback content:

- title
- short description
- text/list representation of every node
- text/list representation of every relationship
- keyboard-readable order
- literal labels
- readable titles
- readable dates
- readable actions
- readable statuses

Recommended fallback shape:

```ts
type NotesCosmosPreviewFallback = {
  title: string;
  description: string;
  nodeOrder: string[];
  nodeSummaries: Array<{
    id: string;
    label: string;
    summary: string;
    status: string;
    dateLabel: string;
  }>;
  relationshipSummaries: Array<{
    sourceId: string;
    targetId: string;
    label: string;
  }>;
};
```

No critical information may be visual-only. If a future visual preview shows a node, relationship, status, date, or cluster, the fallback must represent it in text.

## Mobile And Responsive Acceptance

The future fixture and preview must be validated against 390px width before runtime implementation is accepted.

Acceptance:

- works at 390px width
- no horizontal overflow
- readable labels
- no clipped primary content
- reduced density if needed
- list fallback remains usable
- touch targets are considered for any future controls
- preview must not break the Notes editor/list
- preview must not hide the writing path
- preview must not trap scrolling

If the visual fixture cannot remain readable at 390px, the text/list fallback becomes the primary mobile representation.

## Visual Vocabulary Constraints

Allowed visual language:

- nodes
- clusters
- orbit vocabulary
- trace vocabulary
- relationship hints
- quiet labels
- literal dates and statuses

Constraints:

- no hidden meaning by color alone
- no animation requirement
- no WebGL dependency in K-219
- no canvas dependency in K-219
- no generated images
- no assets
- no fonts
- no full navigation metaphor yet
- no real spatial metadata
- no saved coordinates

The preview can sound like Notes/Cosmos, but it must behave like a readable fixture contract first.

## Relationship To Empty States

K-212 `NotesPixelCosmosEmptyState` remains the empty-vault pilot. It is not replaced by the K-219 fixture.

`ProductEmptyState` remains the generic/product empty-state component for literal empty states.

The select-a-note empty state remains separate and action-oriented.

K-219 fixture work does not replace:

- empty vault
- no search results
- select a note
- empty trash
- graph empty
- loading fallback

The fixture may reuse vocabulary such as node, orbit, signal, trace, cluster, and cosmos, but it must not reuse callbacks, navigation behavior, or runtime empty-state behavior.

## Non-Goals

- no runtime implementation in K-219
- no static preview component yet
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

Recommended next target: **K-220 Notes/Cosmos Static Preview Mock Contract**.

K-220 should:

- create the actual TypeScript fixture contract or mock data only if explicitly approved
- still avoid runtime UI unless scoped
- preserve `NoteGraphView`
- preserve `LocalGraphView`
- include tests for fixture shape
- keep fixture size within 8 to 16 nodes
- include accessibility fallback strings
- keep mobile and responsive acceptance explicit

K-220 should not implement an interactive graph/canvas/orbit map unless separately approved.

## Closure Statement

K-219 chooses mock/static fixture data first. This keeps future Notes/Cosmos work grounded in readable labels, fallback text, mobile acceptance, and small fixture budgets before any runtime preview or graph implementation touches the shipped Notes workspace.
