# K-311 Notes Runtime / Signal Panel Optimization Source Facts Audit

## Purpose

K-311 audits the current Notes runtime and Notes Overview / Signal Panel mount path for optimization and product-debt candidates.

K-311 follows K-310 authenticated visual QA checklist closure.

K-311 is docs/source-facts audit plus deterministic audit test only.

K-311 does not implement selector optimization.

K-311 does not implement memoization beyond what already exists.

K-311 does not split runtime components.

K-311 does not change UI, layout, runtime behavior, stores, persistence, schema, auth, Supabase, provider, sync, backup, graph, or Cosmos behavior.

## Files Inspected

- `frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx`.
- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts`.
- `frontend/src/components/notes/NotesOverviewSignalPanel.tsx`.
- `frontend/src/components/notes/NotesOverviewSignalPanelContainer.test.ts`.
- `frontend/src/components/views/noteview/NoteViewSidebar.tsx`.
- `frontend/src/components/views/features/knowledge/components/WorkspaceDashboardView.tsx`.
- `frontend/src/components/views/NoteView.tsx`.
- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- `frontend/src/store/useNotesStore.ts`.
- `frontend/src/lib/notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts`.
- `frontend/src/lib/notesOverviewSignalPanelAuthenticatedVisualQaClosure.test.ts`.
- `frontend/src/lib/notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts`.
- `frontend/docs/K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md`.
- `frontend/docs/K-310-notes-overview-signal-panel-authenticated-visual-qa-closure.md`.

## Signal Panel Container Subscription Facts

`NotesOverviewSignalPanelContainer` currently subscribes to:

- `useNotesStore(state => state.notes)`.
- `useNotesStore(state => state.activeNoteId)`.

The container does not subscribe to folders, sync state, persistence state, auth state, Supabase state, provider state, graph state, backup state, Health state, or Schedule state.

The container builds `adapterInput` with `useMemo`.

The `useMemo` dependency array is:

```text
[notes, activeNoteId]
```

This means `selectNotesOverviewSignalPanelInput({ notes, activeNoteId })` can rerun whenever the `notes` array reference changes or the active note id changes.

Because the selector reads the full `notes` array, any store update that replaces `notes` can make the container map the full local notes array again, even if only one note changed.

This is acceptable for the current stage because K-308 was a minimal runtime mount, K-309 preserved the boundary, and K-310 kept authenticated visual QA as the next evidence step.

The minimal future optimization target is a narrower container selector or derived metadata selector that returns only the Signal Panel metadata shape:

- `id`.
- `title`.
- `updatedAt`.
- `createdAt`.
- `deletedAt`.
- `starred`.
- `activeNoteId`.

K-311 does not implement that optimization.

## Metadata Mapping Boundary Facts

The runtime container maps each note to:

- `id`.
- `title`.
- `updatedAt`.
- `createdAt`.
- `deletedAt`.
- `starred`.

The runtime container does not pass:

- note body.
- markdown content.
- tags.
- properties.
- relations.
- folders.
- store methods.
- persistence handles.
- IndexedDB handles.
- Supabase data.
- provider data.
- sync data.
- backup data.
- graph data.
- Cosmos data.

The container test verifies the metadata-only behavior by checking that `body`, `properties`, and `relations` do not appear in serialized adapter input.

The adapter accepts caller-provided local metadata, filters deleted notes through `deletedAt`, sorts recent notes by timestamp, limits recent notes to `SIGNAL_PANEL_RECENT_NOTE_LIMIT`, and returns props with `data.generatedFrom: 'local-note-metadata'`.

The adapter remains pure and does not import React, store, persistence, Supabase, provider, sync, backup, graph, or Cosmos modules.

## Runtime Mount Path Facts

The current runtime mount path is:

```text
NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> notesOverviewSignalPanelAdapter -> NotesOverviewSignalPanel
```

`NoteViewSidebar` imports `NotesOverviewSignalPanelContainer` and passes:

```text
signalPanel={<NotesOverviewSignalPanelContainer />}
```

`WorkspaceDashboardView` accepts:

```text
signalPanel?: React.ReactNode
```

and renders the optional slot with:

```text
data-testid="notes-overview-signal-panel-slot"
```

`NotesOverviewSignalPanelContainer` owns the runtime adapter import.

There is no AppContent wiring.

There is no NoteViewEditorArea wiring.

There is no graph replacement.

There is no Cosmos runtime connection.

There is no editor ownership change.

## NoteViewSidebar Responsibility Audit

`NoteViewSidebar` is already a large owner of Notes sidebar, dashboard, trace, database view, recent work, knowledge workspace, list controls, and mobile list behavior.

K-308 added one import and one dashboard slot prop to `NoteViewSidebar`.

That addition is meaningful but bounded.

K-308 did not add Signal Panel data mapping to `NoteViewSidebar`.

K-308 did not add adapter logic to `NoteViewSidebar`.

K-308 did not change `NoteViewEditorArea`.

K-308 did not add `AppContent` wiring.

Future debt candidate: if `NoteViewSidebar` continues to accumulate dashboard-only concerns, a smaller dashboard owner or slot coordinator could reduce responsibility.

Immediate refactor is premature because the current Signal Panel owner is bounded and no authenticated visual QA evidence has shown layout or responsibility pressure.

## WorkspaceDashboardView Slot Quality Audit

`WorkspaceDashboardView` keeps `signalPanel` optional.

Existing callers remain safe because the slot renders only when a `signalPanel` node is provided.

The slot sits above the existing dashboard cards.

The dashboard root uses `overflowY: 'auto'` and `overflowX: 'hidden'`.

Source-visible layout risk is limited to stacking, vertical density, and mobile readability of the inserted slot.

There is no source-visible evidence that K-311 should change layout.

Future authenticated QA should cover:

- slot placement.
- vertical stacking.
- mobile readability.
- horizontal overflow.
- interaction with existing dashboard cards.

## NoteView And Editor Boundary Facts

`NoteView` already reads many `useNotesStore` selectors, including `notes`, `folders`, `activeNoteId`, sync state, and note actions.

`NoteView` passes the sidebar props to `NoteViewSidebar` and editor props to `NoteViewEditorArea`.

`NoteViewEditorArea` owns editor and graph rendering.

`NoteViewEditorArea` imports and renders `NoteGraphViewLazy` for graph mode.

`NoteViewEditorArea` does not import `NotesOverviewSignalPanelContainer`.

`NoteViewEditorArea` does not import `notesOverviewSignalPanelAdapter`.

The Signal Panel mount does not replace `NoteGraphViewLazy`.

The Signal Panel mount does not move editor ownership.

## Store And Local-first Boundary Facts

The local Notes store remains the source of truth for the Signal Panel.

`useNotesStore` owns `notes` and `activeNoteId`.

The Signal Panel container reads store state but does not call store write actions.

The container does not import `notePersistence`, `noteIndexedDb`, `authFetch`, Supabase, provider, sync, backup, graph, or Cosmos modules.

The container does not read IndexedDB directly.

The container does not write persistence directly.

The container does not introduce remote-first behavior.

Existing Notes store persistence, local-first, delta sync, and hydration behavior are outside K-311 scope.

## Test And Audit Maintenance Cost

The Signal Panel line currently has multiple safety artifacts:

- isolated component tests.
- adapter tests.
- adapter boundary audits.
- adapter implementation audits.
- adapter closure audits.
- runtime mount plan tests.
- runtime mount boundary audits.
- runtime mount closure audits.
- authenticated visual QA closure audits.

This is duplicated in places, but the duplication is still justified by the recent transition from isolated component to mounted runtime surface.

Future consolidation may be safe after authenticated visual QA evidence exists and after the runtime mount line is stable across one or more follow-up milestones.

K-311 does not delete, merge, or weaken tests.

K-311 does not consolidate audits.

## Build And Chunk Warning Relevance

Recent `npm run build` output shows existing Vite warnings about:

- `copyToClipboard.ts` being both dynamically and statically imported.
- `notePersistence.ts` being both dynamically and statically imported.
- the main bundle being larger than 500 kB after minification.

From available source facts, these warnings do not appear directly caused by the Notes Overview / Signal Panel mount.

The Signal Panel files are small local component/adapter/container files.

The container imports the store, but K-308 did not add new dynamic import behavior or build configuration.

There is not enough source-visible evidence in K-311 to connect chunk warnings to the Signal Panel mount.

Build chunk investigation should remain separate from Signal Panel selector or layout work.

K-311 does not change build configuration.

## Optimization Candidate Ranking

### Safe / Likely Next

1. Plan a narrow Signal Panel metadata selector.

   Source facts show the container currently subscribes to the full `notes` array and maps all notes to safe metadata on note-array changes. A future plan could define a selector that returns only local Signal Panel metadata plus `activeNoteId`.

2. Preserve authenticated visual QA as the next evidence gate for layout.

   K-310 explicitly kept authenticated visual QA incomplete. Layout polish should follow real protected-shell evidence.

### Needs Evidence

1. Implement the narrow metadata selector.

   This is probably the lowest-risk implementation candidate, but it still touches runtime container/store selection behavior and should get a plan first.

2. Memoize metadata mapping more aggressively.

   Current `useMemo` already avoids remapping unless `notes` or `activeNoteId` changes. More memoization may add complexity unless large-vault evidence shows pressure.

3. Layout polish for the dashboard slot.

   Source facts show possible stacking/readability risk, but no authenticated visual evidence is available yet.

### Defer

1. Extract a smaller dashboard owner from `NoteViewSidebar`.

   `NoteViewSidebar` is large, but K-308 added a bounded slot only. A refactor would be broader than the current evidence supports.

2. Consolidate Signal Panel audit tests.

   The audit volume is high, but recent runtime mounting still justifies it. Consolidation can wait until the line stabilizes.

3. Build chunk investigation.

   Existing Vite warnings do not appear Signal Panel-specific from available facts.

### Do Not Do Yet

1. Do not connect Supabase, provider, sync, backup, graph, or Cosmos to the Signal Panel.

2. Do not redesign the Notes layout before authenticated visual QA evidence.

3. Do not optimize selectors directly in K-311.

4. Do not change store, persistence, schema, hydration, or IndexedDB behavior for this audit.

5. Do not add auth bypass, fake session, credentials, env files, or storageState artifacts.

## K-312 Recommendation

Recommended next task:

```text
K-312 Notes Runtime / Signal Panel Optimization Implementation Plan
```

Recommended K-312 scope:

- docs/plan plus audit test only.
- define whether to implement a narrow metadata selector.
- define exact container/store boundary.
- define tests for unchanged local-only behavior.
- define rollback and non-goals.
- no implementation unless a later milestone explicitly approves it.

K-312 should not immediately implement selector optimization unless K-311 review identifies a clear, low-risk target and explicitly approves implementation scope.

Alternative next task if release readiness is preferred:

```text
K-312 Notes Overview / Signal Panel Release QA Evidence Capture
```

This alternative should record real authenticated protected-shell visual QA evidence and should not change runtime code.

## Runtime Non-change Confirmation

K-311 changes no runtime behavior.

K-311 changes no UI or layout behavior.

K-311 changes no `NotesOverviewSignalPanelContainer` behavior.

K-311 changes no `NoteViewSidebar` behavior.

K-311 changes no `WorkspaceDashboardView` behavior.

K-311 changes no `NoteView` behavior.

K-311 changes no `NoteViewEditorArea` behavior.

K-311 changes no `NotesOverviewSignalPanel` behavior.

K-311 changes no adapter implementation behavior.

K-311 changes no `useNotesStore` behavior.

K-311 changes no persistence, IndexedDB, schema, hydration, auth, Supabase, provider, sync, backup, graph, Cosmos, Health, or Schedule behavior.

K-311 adds no dependencies, generated artifacts, package changes, Vite changes, credentials, env files, auth bypass, fake sessions, or storageState artifacts.

## Closure Statement

K-311 documents the current Notes runtime and Signal Panel optimization source facts.

The only clear near-term optimization candidate is a planned narrow metadata selector for the Signal Panel container.

No optimization is implemented in K-311.

No runtime behavior is changed in K-311.

The local-first and read-only Signal Panel boundaries remain intact.

Future work should proceed through K-312 planning or authenticated QA evidence, not broad runtime rewrites.
