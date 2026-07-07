# K-307 Notes Overview / Signal Panel Runtime Mount Plan

## Purpose

K-307 plans the future runtime mount of `NotesOverviewSignalPanel`.

K-307 follows K-305/K-306 adapter implementation and closure.

K-307 is docs/plan plus audit test only.

K-307 does not mount Signal Panel.

K-307 does not import adapter into runtime.

K-307 does not connect live Notes data.

K-307 chooses the K-308 next path: Notes Overview / Signal Panel Minimal Runtime Mount Implementation.

## Current Adapter And Component Recap

`NotesOverviewSignalPanel` is isolated, props-only, read-only, and unmounted.

The pure adapter module exists at:

```text
frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts
```

The adapter maps caller-provided local note metadata to panel props through:

```text
createNotesOverviewSignalPanelProps(input)
```

The adapter remains unmounted.

No runtime import/wiring exists.

The local-first boundary remains preserved.

The adapter and component have no Supabase/provider/sync/graph imports.

The current runtime shape remains `AppContent -> NoteView -> NoteViewEditorArea`, with graph owned by `NoteGraphViewLazy` / `NoteGraphView`.

## Mount Objective

The future mount should show the Signal Panel in Notes Overview as a read-only signal summary.

The future mount should use adapter-generated props from local Notes-derived metadata.

The future mount should preserve the current Notes workflow.

The future mount should avoid graph replacement.

The future mount should avoid layout rewrite.

The future mount should avoid remote traffic.

The future mount should avoid persistence writes.

The future mount should stay reversible and small.

## Mount Owner Candidates

### Candidate 1: AppContent

Pros:

- already owns top-level tab selection.
- already renders `NoteView`.

Risks:

- too high in the app tree for Notes-specific local metadata.
- would make Signal Panel feel like app shell behavior instead of Notes Overview behavior.
- increases import boundary risk by pulling Notes-specific adapter/component concerns into the shell.
- has no natural ownership of editor, graph, or Notes overview layout slots.

Access to local Notes metadata: indirect only.

Layout ownership: app shell, not Notes workspace.

Graph ownership risk: low direct risk, but poor placement can bypass Notes layout decisions.

Import boundary risk: high.

Testability: broad and noisy.

Recommendation: avoid `AppContent`.

### Candidate 2: NoteView

Pros:

- already owns `useNotesStore` selectors for notes, folders, and `activeNoteId`.
- already coordinates Notes sidebar, editor area, dashboard mode, and right context panel.
- can create narrow local note metadata without adding store reads to the adapter or panel.
- can pass a slot/props to a small child container if needed.

Risks:

- large file with many existing responsibilities.
- direct mount inside `NoteView` could add more layout weight if not isolated.
- easy to accidentally couple with dashboard, trace, or graph logic.

Access to local Notes metadata: direct and already established.

Layout ownership: Notes workspace-level.

Graph ownership risk: manageable if the mount is a separate overview slot and does not touch graph mode.

Import boundary risk: medium.

Testability: acceptable if K-308 uses a small container and boundary tests.

Recommendation: acceptable owner when paired with a small container/slot.

### Candidate 3: NoteViewEditorArea

Pros:

- owns the visible main Notes content area.
- already receives `notes`, `activeNoteId`, and layout state as props.
- already contains empty-state and graph branches.

Risks:

- primarily owns editing, reading, empty-state, and graph-mode rendering.
- adding Signal Panel here can couple the overview readout to editor internals.
- higher risk of graph displacement because `NoteGraphViewLazy` is mounted here.
- more likely to create layout churn.

Access to local Notes metadata: via props.

Layout ownership: editor/graph surface.

Graph ownership risk: high.

Import boundary risk: medium.

Testability: moderate, but too close to editor internals.

Recommendation: avoid as the default K-308 mount owner.

### Candidate 4: Notes Overview Route/Page/Container

Pros:

- best semantic owner if a concrete Notes Overview surface exists at runtime.
- keeps Signal Panel tied to overview/readout behavior instead of editor behavior.
- can be tested as a local-only overview surface.

Risks:

- current Notes runtime is concentrated in `NoteView`; a separate concrete route/page may not exist.
- creating a new route or navigation path would exceed minimal runtime mount scope.

Access to local Notes metadata: good if receiving data from `NoteView`; risky if it reaches into store independently without a boundary.

Layout ownership: best fit when available.

Graph ownership risk: low.

Import boundary risk: low to medium.

Testability: good.

Recommendation: prefer this semantic slot if it can be implemented without new route/nav work.

### Candidate 5: Small NotesOverviewSignalPanelContainer Or Slot Component

Pros:

- keeps adapter import and panel mount in one narrow Notes-owned boundary.
- can receive already-selected local note metadata from `NoteView`.
- keeps adapter and Signal Panel store-free.
- avoids `AppContent` and `NoteViewEditorArea`.
- makes K-308 easy to test and easy to remove.

Risks:

- requires one small runtime container/slot file.
- still needs careful layout placement from `NoteView`.

Access to local Notes metadata: passed in by `NoteView` or a Notes Overview parent.

Layout ownership: small bounded slot, not app shell or editor internals.

Graph ownership risk: low if not mounted in graph mode.

Import boundary risk: low.

Testability: best.

Recommendation: preferred default for K-308.

## Recommended Mount Owner

Avoid `AppContent`.

Avoid `NoteViewEditorArea` as the first mount owner because it owns editor and graph concerns.

Prefer the narrowest Notes Overview/page/container-level owner. If no concrete Notes Overview page exists, use a small `NotesOverviewSignalPanelContainer` or slot component invoked from `NoteView`.

The runtime mount should not live inside `NotesOverviewSignalPanel`.

The runtime mount should not live inside `notesOverviewSignalPanelAdapter`.

## Adapter Input Ownership

The runtime caller, not the adapter, creates local note metadata input.

The future caller may use `useNotesStore` only if it is already the mount owner or receives store state from `NoteView`.

The adapter should remain store-free.

The Signal Panel should remain store-free.

Avoid IndexedDB direct reads.

Avoid persistence module imports.

Avoid Supabase/provider/sync calls.

No writes are allowed.

Local note metadata should be selected near `NoteView` because `NoteView` already owns `notes` and `activeNoteId`.

Needed fields are:

- `id`.
- `title`.
- `updatedAt`.
- `createdAt`.
- `deletedAt`.
- `starred` if caller wants to preserve that current adapter field.
- `activeNoteId`.

`activeNoteId` should come from the existing Notes runtime state, not from persistence.

Empty state should be passed through adapter output when no eligible local notes exist.

Invalid or missing local fields should be tolerated by the adapter and should not trigger remote fallback.

## useNotesStore Boundary

`useNotesStore` may be used only by the future runtime mount owner/container.

`useNotesStore` must not be used by the adapter.

`useNotesStore` must not be used by `NotesOverviewSignalPanel`.

The selector should be narrow and read-only.

No store writes are allowed.

No persistence/schema changes are allowed.

Avoid broad subscriptions where a smaller selector or already-owned `NoteView` data can be used.

Avoid pulling full note bodies if only title, timestamps, delete status, and active note identity are needed.

No remote fallback is allowed.

## Persistence / IndexedDB Boundary

No direct IndexedDB import is allowed in the adapter.

No direct IndexedDB import is allowed in `NotesOverviewSignalPanel`.

No direct IndexedDB import should be added in the mount unless it is already established by current Notes runtime ownership.

The mount should consume already-available local store state.

No new persistence reads are allowed.

No new persistence writes are allowed.

No schema change is allowed.

The local-first source of truth remains unchanged.

## Signal Panel Props Delivery Plan

K-308 should call `createNotesOverviewSignalPanelProps` with local note metadata.

The adapter should return props compatible with `NotesOverviewSignalPanel`.

The future container should pass adapter output directly to `NotesOverviewSignalPanel`.

The path should be:

```text
NoteView or Notes Overview parent
  -> narrow local metadata selection
  -> createNotesOverviewSignalPanelProps(input)
  -> NotesOverviewSignalPanel props
```

There should be no runtime side effects.

There should be no mutation.

There should be no logging.

There should be no remote request.

There should be no fallback to Supabase.

## Empty / Loading / Error State Posture

Empty Notes state should render the safe Signal Panel empty state.

Loading state should not trigger remote fetch.

Error state should be local-only and non-destructive.

Unavailable local metadata should not mount remote calls.

The panel should not fake a success state.

The panel should not block NoteView editing.

If local notes are not hydrated yet, K-308 should prefer a quiet unavailable or empty readout over a remote fetch.

## Responsive / Layout Boundary

The runtime mount should preserve the current Notes Overview layout.

K-308 should not rewrite layout in the first mount.

K-308 should not replace `NoteGraphView`.

The panel should appear in a bounded slot if available.

Desktop should place the panel where it supports overview orientation without competing with the editor.

Tablet should preserve readable width and avoid two competing scroll regions.

Mobile should place the panel below the main notes surface or in a clearly bounded read-only section.

Mobile must avoid horizontal overflow.

Mobile must not displace graph mode without an explicit plan.

K-308 should include layout guard tests only if implementation touches layout.

Manual/browser QA belongs to K-308 because K-307 has no runtime/browser behavior.

## Graph / Cosmos Boundary

The mount must not replace `NoteGraphView`.

The mount must not mutate graph state.

The mount must not connect Cosmos runtime.

The mount must not consume graph edges unless a later plan defines that scope.

Signal Panel remains a readout, not graph navigation.

`NoteGraphViewLazy` remains the graph surface.

`LocalGraphView` remains separate from this Signal Panel mount.

## Supabase / Provider / Sync / Backup Boundary

The runtime mount must not introduce Supabase calls.

The runtime mount must not introduce `authFetch` calls.

The runtime mount must not introduce provider/sync reads.

The runtime mount must not introduce backup/export/import/restore behavior.

The runtime mount must not introduce attachment/provider traffic.

The runtime mount must not change Supabase usage guardrails.

The runtime mount should be local-only.

## K-308 Implementation Boundary

Recommended K-308: Notes Overview / Signal Panel Minimal Runtime Mount Implementation.

K-308 scope:

- add a small runtime container or slot at the chosen Notes owner.
- import adapter and Signal Panel only in that owner/container.
- use narrow local Notes metadata selector if needed.
- pass adapter props to Signal Panel.
- preserve existing graph/Notes layout.
- no Supabase/provider/sync.
- no persistence/schema writes.
- no graph/Cosmos connection.
- add tests for mount and import boundary.

Expected files, to adjust after K-308 source inspection:

- `frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx` or equivalent small slot.
- optional container test.
- optional narrow `NoteView` mount if no cleaner Notes Overview parent exists.
- runtime mount boundary audit test.
- existing adapter/Signal Panel tests updated only if necessary.

## K-308 Tests

K-308 should test:

- mount renders panel in the selected Notes Overview/container context.
- empty notes state.
- recent notes state.
- active note state if source-grounded.
- no store writes.
- no Supabase/provider/sync calls.
- adapter still pure.
- Signal Panel still props-only.
- `NoteGraphView` still present if relevant.
- no horizontal overflow/layout guard if layout changes.
- import-boundary audit.

## K-309 Outlook

Possible K-309 paths after K-308:

- K-309 Runtime Mount Closure Audit.
- K-309 Layout Polish Plan.
- K-309 Signal Panel Contract Hardening.
- K-309 Notes Overview UX Copy/Empty State Polish.

Recommended default: K-309 Runtime Mount Closure Audit if K-308 implements the minimal mount.

## Non-goals

- no Signal Panel runtime mount in K-307.
- no adapter runtime import.
- no AppContent / NoteView code change.
- no NoteViewEditorArea change.
- no live Notes data connection.
- no useNotesStore implementation.
- no IndexedDB/persistence import.
- no store/persistence/schema change.
- no Supabase/provider/sync connection.
- no authFetch usage.
- no graph/Cosmos connection.
- no NoteGraphView replacement.
- no layout rewrite.
- no route/nav rewrite.
- no static preview generator change.
- no backup/export/import/restore behavior change.
- no auth change.
- no Supabase traffic guardrail change.
- no Health/Schedule change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Files Inspected

- `frontend/docs/K-306-notes-overview-signal-panel-adapter-closure-audit.md`.
- `frontend/src/lib/notesOverviewSignalPanelAdapterClosureAudit.test.ts`.
- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts`.
- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.test.ts`.
- `frontend/src/lib/notesOverviewSignalPanelAdapterImplementationBoundaryAudit.test.ts`.
- `frontend/docs/K-304-notes-overview-signal-panel-adapter-implementation-plan.md`.
- `frontend/docs/K-303-notes-overview-signal-panel-adapter-boundary-audit.md`.
- `frontend/src/components/notes/NotesOverviewSignalPanel.tsx`.
- `frontend/src/components/notes/NotesOverviewSignalPanel.test.ts`.
- `frontend/src/components/AppContent.tsx`.
- `frontend/src/components/views/NoteView.tsx`.
- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- `frontend/src/components/views/noteview/NoteGraphViewLazy.tsx`.
- `frontend/src/components/views/NoteGraphView.tsx`.
- `frontend/src/store/useNotesStore.ts`.
- `frontend/src/lib/notePersistence.ts`.
- `frontend/src/lib/noteIndexedDb.ts`.

## Closure Statement

K-307 defines runtime mount boundary only.

No runtime mount is implemented.

Adapter remains pure and unmounted.

Signal Panel remains isolated and unmounted.

Notes runtime remains local-first.

K-308 may implement the smallest local-only runtime mount if this plan is accepted.

Remote systems remain support layers.
