# K-283 Notes Overview / Signal Panel Isolated Component Plan

## Purpose

K-283 plans a future isolated Notes Overview / Signal Panel component skeleton. K-283 follows the K-282 fixture spec, K-281 component boundary, and K-280 data contract.

K-283 is docs/plan plus audit test only. K-283 does not implement UI. K-283 does not add runtime fixture modules. K-283 does not create runtime types/exports. K-283 does not wire runtime data. K-283 does not add route/nav/panel behavior. K-283 does not create a data adapter. K-283 does not change stores, schemas, persistence, providers, sync, graph builders, backup, or BlockEditor internals.

K-283 chooses the K-284 next path: Notes Overview / Signal Panel Isolated Component Skeleton.

## Current State Summary

K-278 defined Notes Overview / Signal Panel as a concept-only product surface. Signal Panel remains an orientation/readout surface, not Cosmos Map, not a graph replacement, not backup/Data Safety UI, and not Archive Voyager.

K-279 audited local-first data boundaries for a future Signal Panel MVP. K-279 approved only future local-note metadata plus simple active-note orientation as safe first boundaries.

K-280 defined a draft recent notes plus active writing data contract in docs only. K-280 did not add runtime type/export, runtime data wiring, or implementation.

K-281 defined a props-first component boundary in docs only. K-281 did not add a Signal Panel runtime component, runtime type/export, data adapter, route/nav/panel, or runtime mount.

K-282 defined deterministic fixture cases in docs only. K-282 did not add runtime fixture modules, runtime types/exports, components, adapters, or wiring.

No Signal Panel runtime component exists. No Signal Panel runtime type/export exists. No Signal Panel runtime fixture module exists. No Signal Panel data adapter exists.

The Empty State line remains closed. `NotesPixelCosmosEmptyState` remains the productized empty-vault Notes/Cosmos surface, and Empty State remains primary when no notes exist.

The Static Preview line remains closed. `NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, unwired, and not product data.

`NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface. Runtime Cosmos Map is not implemented. Backup/preflight guardrails remain infrastructure and are not productized here.

## Implementation Readiness Decision

A small isolated component skeleton is reasonable for K-284 only if it remains:

- unmounted.
- props-driven.
- read-only.
- fixture/test-driven.
- no adapter.
- no route/nav/panel.
- no runtime data wiring.
- no store/schema/persistence changes.
- no graph/KIS/provider/backup/BlockEditor internals.

K-283 itself does not approve runtime exposure. K-283 itself does not approve data wiring. K-283 itself does not approve callbacks/navigation.

## Proposed Component Path

Recommended future path:

```text
frontend/src/components/notes/NotesOverviewSignalPanel.tsx
```

Why this path fits:

- `frontend/src/components/notes` already exists.
- `NotesCosmosStaticPreview.tsx` lives there as an isolated Notes/Cosmos component.
- the Signal Panel should remain isolated from runtime `NoteView` mounting.
- the path avoids graph, provider, backup, store, and editor directories.

Rejected paths:

- `frontend/src/features/notes/...` because `frontend/src/features/notes` does not currently exist.
- `frontend/src/components/views/noteview/...` because that tree is tied to runtime NoteView surfaces.
- graph/KIS/provider/backup directories because the component must not inherit those boundaries.

K-284 must not mount this component from `NoteView`, routing, or `NoteViewEditorArea`.

## Proposed Test Path

Recommended future test path:

```text
frontend/src/components/notes/NotesOverviewSignalPanel.test.tsx
```

Tests should cover:

- active fixture.
- idle fixture.
- unavailable fixture.
- empty/degraded fixture.
- recent notes cap.
- title fallback display.
- forbidden fields not rendered.
- semantic headings/groups.
- no callback behavior if read-only first.
- no route/nav/store/provider/graph import assumptions.
- 390px wrapper expectation if existing test style supports it.

## Proposed Fixture Location

Recommended K-284 default:

- keep fixtures test-local inside `NotesOverviewSignalPanel.test.tsx`.

Reason:

- avoids production fixture exports.
- keeps the first component skeleton read-only and isolated.
- prevents fixture data from becoming app data.
- reduces surface area for implementation drift.

Only create a shared test fixture module later if duplication justifies it.

Future fixture rules:

- fixture must not be imported by production runtime.
- fixture must not contain real user data.
- fixture must not contain raw note bodies.
- fixture must not contain provider/backup/graph/editor internals.
- fixture follows K-282 cases.

## Props-first API Plan

Documentation-only future API:

```ts
type NotesOverviewSignalPanelProps = {
  data: SignalPanelDataDraft;
};
```

Read-only first means:

- no callbacks in K-284 skeleton.
- no `onSelectRecentNote`.
- no `onCreateNote`.
- no navigation.
- no mutation.
- no adapter.
- no store object.
- no service object.
- no provider client.
- no graph object.
- no editor instance.

The component should render only from passed props.

## Rendering Scope For K-284

Minimal rendering if K-284 proceeds:

- panel heading.
- orientation summary.
- recent notes section.
- active writing section.
- empty/unavailable fallback section.
- signal tier labels if meaningful.
- title fallback display.
- capped recent notes list.
- accessible text/labels.
- no raw content/body.
- no graph/provider/backup claims.

Do not include:

- real navigation.
- create note action.
- route links unless future mount approves them.
- graph visualizations.
- Cosmos Map.
- animations requiring new assets/dependencies.
- provider status.
- sync status.

## Semantic / Accessibility Expectations

Expectations:

- headings and sections are semantic.
- signal hierarchy is represented through text/structure, not color-only.
- active, idle, and unavailable states are readable.
- empty/degraded state is readable.
- no essential information is visual-only.
- keyboard expectations remain simple because component is read-only.
- no hidden interactive controls.
- no fake disabled buttons.
- aria labels are used only where they add clarity.
- content remains readable at 390px/narrow width.

## Visual / Product Grammar Expectations

Expectations:

- pixel is grammar, not decoration.
- information-first layout.
- readable typography.
- cozy sci-fi / pixel observatory / personal archive tone.
- signal/readout language clarifies state.
- primary/secondary/faint hierarchy may be used if meaningful.
- avoid overdecorated cosmic UI.
- avoid generic AI SaaS look.
- do not imply Cosmos Map.
- do not imply graph intelligence.
- do not hide writing actions behind spectacle.

## Runtime Isolation Requirements

For any future K-284 skeleton:

- component must remain unmounted.
- no route/nav/panel changes.
- no `NoteView` insertion.
- no `NoteViewEditorArea` insertion.
- no Empty State integration.
- no `NotesCosmosStaticPreview` reuse/mount.
- no adapter.
- no store subscription.
- no provider/network calls.
- no graph/KIS calls.
- no backup/preflight reads.
- no BlockEditor internals.
- no persistence/schema changes.
- no generated artifacts.
- no assets/fonts/dependencies.

## K-284 Implementation Acceptance Criteria

If K-284 is implementation, require:

- Codex 5.5 high.
- exactly small isolated component skeleton.
- no runtime mount.
- no data adapter.
- props-only.
- read-only.
- test-local fixtures or explicitly test-only fixture.
- no production fixture export unless explicitly justified.
- tests for active/idle/unavailable/empty-degraded.
- tests for title fallback.
- tests for recent notes cap.
- tests that forbidden terms/fields do not render.
- tests or source scan for no store/provider/graph/backup/editor imports.
- typecheck/build/diff-check.
- no package/vite changes.
- no generated artifacts.
- no route/nav/panel files touched.

## K-284 Decision

Recommended primary path:

**K-284 Notes Overview / Signal Panel Isolated Component Skeleton**

Scope:

- small implementation.
- isolated/unmounted component.
- props-only.
- read-only.
- test-local fixtures.
- no adapter.
- no runtime data wiring.
- no route/nav/panel.
- no graph/KIS/provider/backup/BlockEditor.
- requires Codex 5.5 high.

Alternative:

**K-284 Notes Overview / Signal Panel Fixture Module Spec**

Scope:

- docs/spec plus audit test.
- only if K-283 finds shared fixture module should be planned before component.

Alternative:

**K-284 Notes Overview / Signal Panel Isolated Component Closure Audit**

Scope:

- docs/audit only.
- use if implementation is still premature.

Not recommended:

- runtime mounting.
- route/nav/panel.
- adapter plus component in the same PR.
- callbacks/navigation.
- graph/KIS/provider/backup integration.
- Runtime Cosmos Map.

## Non-goals

K-283 has these explicit non-goals:

- no Signal Panel UI implementation in K-283.
- no Notes Overview component.
- no Signal Panel component.
- no runtime fixture module.
- no runtime type/export.
- no runtime data wiring.
- no data adapter.
- no route/nav/panel change.
- no NoteView changes.
- no NoteViewEditorArea changes.
- no noteUtils changes.
- no noteListSort changes.
- no noteDisplayTitle changes.
- no Notes store changes.
- no persistence/schema change.
- no NotesCosmosStaticPreview changes.
- no Empty State changes.
- no Runtime Cosmos Map implementation.
- no graph replacement.
- no NoteGraphView change.
- no LocalGraphView change.
- no graph builder change.
- no KnowledgeIndexService coupling.
- no live graph/index integration.
- no provider/network/background sync.
- no Supabase/OAuth/Google Drive behavior change.
- no backup/preflight runtime implementation.
- no Data Safety / Backup Health UI.
- no export/import/restore behavior change.
- no attachment blob/provider behavior.
- no BlockEditor internals.
- no Health/Schedule behavior change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-283 plans an isolated component skeleton only. K-283 does not implement or mount Signal Panel.

K-284 may implement a small read-only, props-only, unmounted component skeleton if acceptance criteria are met. Adapter/runtime wiring must be separate and later. Callbacks/navigation must be deferred.

Graph/KIS/provider/backup/BlockEditor internals remain forbidden. Signal Panel remains orientation/readout, not Cosmos Map or graph replacement.

Existing graph surfaces remain preserved. Empty State and Static Preview lines remain closed. Local runtime data remains source of truth. Remote systems remain support layers.
