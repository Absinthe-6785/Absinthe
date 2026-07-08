# K-314 Notes Signal Panel Optimization Closure Audit

## Purpose

K-314 closes the K-313 Notes Signal Panel selector optimization line.

K-314 follows the K-311 source-facts audit and the K-312 implementation plan.

K-314 is docs/source closure audit plus audit test only.

K-314 does not implement additional selector optimization.

K-314 does not optimize further.

K-314 does not change runtime behavior.

K-314 documents what K-313 optimized and what K-313 did not optimize.

K-314 chooses the next K-315 path.

## Files Inspected

- `frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx`.
- `frontend/src/components/notes/NotesOverviewSignalPanelContainer.test.ts`.
- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts`.
- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.test.ts`.
- `frontend/src/components/notes/NotesOverviewSignalPanel.tsx`.
- `frontend/src/components/notes/NotesOverviewSignalPanel.test.ts`.
- `frontend/src/lib/notesOverviewSignalPanelRuntimeMountBoundaryAudit.test.ts`.
- `frontend/src/lib/notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts`.
- `frontend/src/lib/notesRuntimeSignalPanelOptimizationImplementationPlan.test.ts`.
- `frontend/src/lib/notesRuntimeSignalPanelOptimizationSourceFactsAudit.test.ts`.
- `frontend/docs/K-312-notes-runtime-signal-panel-optimization-implementation-plan.md`.
- `frontend/docs/K-311-notes-runtime-signal-panel-optimization-source-facts-audit.md`.
- `frontend/docs/K-310-notes-overview-signal-panel-authenticated-visual-qa-closure.md`.
- `frontend/docs/K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md`.
- `frontend/src/components/views/noteview/NoteViewSidebar.tsx`.
- `frontend/src/components/views/features/knowledge/components/WorkspaceDashboardView.tsx`.
- `frontend/src/components/AppContent.tsx`.
- `frontend/src/components/views/NoteView.tsx`.
- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- `frontend/src/store/useNotesStore.ts`.
- `frontend/src/lib/notePersistence.ts`.
- `frontend/src/lib/noteIndexedDb.ts`.
- `frontend/src/components/views/NoteGraphView.tsx`.
- `frontend/src/components/views/noteview/NoteGraphViewLazy.tsx`.
- `frontend/vite.config.ts`.

## K-313 Implementation Recap

The runtime path remains:

`NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> notesOverviewSignalPanelAdapter -> NotesOverviewSignalPanel`.

K-313 changed `frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx`.

K-313 added `createNotesOverviewSignalPanelInputSelector()`.

K-313 added `selectNotesOverviewSignalPanelMetadata()`.

K-313 added `noteMatchesSignalPanelMetadata()`.

The container now creates one selector instance with `useMemo`, passes it to `useNotesStore(selectSignalPanelInput)`, sends the selected adapter input to `createNotesOverviewSignalPanelProps(adapterInput)`, and renders `NotesOverviewSignalPanel` with adapter-generated props.

The metadata shape is:

- `id`.
- `title`.
- `updatedAt`.
- `createdAt`.
- `deletedAt`.
- `starred`.

`activeNoteId` remains part of the adapter input and is compared separately from note metadata.

K-313 uses `Object.is` for timestamp fields to keep repeated `NaN` timestamp values stable and to avoid accidental stale snapshots around exact timestamp identity.

K-313 reuses the previous adapter input snapshot only when `activeNoteId` is unchanged and every note has matching Signal Panel metadata in the same order.

K-313 returns a new adapter input when panel-relevant metadata changes, note insertion/removal changes the metadata array length, note order changes, or `activeNoteId` changes.

K-313 updated focused component tests for:

- empty local notes.
- recent local notes.
- missing optional fields and `NaN` timestamp safety.
- no store writes while rendering.
- adapter-safe metadata selection.
- non-panel field reuse.
- metadata and active-note invalidation.

K-313 updated source-boundary audit assertions for the new selector source.

K-313 did not change `NotesOverviewSignalPanel`.

K-313 did not change `notesOverviewSignalPanelAdapter`.

K-313 did not change the adapter contract.

K-313 did not add Signal Panel UI.

## Optimization Semantics Audit

K-313 reduces adapter input churn.

K-313 does not eliminate notes store subscription churn.

`NotesOverviewSignalPanelContainer` still subscribes to local Notes state through `useNotesStore`.

The container still reacts when the store changes.

The optimization is narrower: when the store changes but Signal Panel metadata is unchanged, the selector can return the previous adapter input snapshot.

Non-panel note fields such as body, content, properties, relations, graph edges, and remote/provider metadata should not create a new Signal Panel adapter input while the comparator-visible metadata remains unchanged.

This is acceptable current scope because the Signal Panel adapter currently consumes only local note metadata and `activeNoteId`.

Store subscription architecture remains future work only if authenticated QA or performance evidence shows it is needed.

K-314 prevents future overclaiming: K-313 solved adapter input churn pressure, not store subscription churn.

## Comparator Field Coverage Audit

The comparator-covered note fields are:

- `id`.
- `title`.
- `updatedAt`.
- `createdAt`.
- `deletedAt`.
- `starred`.

The separately compared adapter input field is:

- `activeNoteId`.

These fields match the current local metadata boundary and the current adapter contract.

`id` is needed for identity, active-note lookup, recent-note keys, and stable ordering around note insertion/removal.

`title` is needed for recent note and active writing labels.

`updatedAt` is needed for recent-note sort order, visible updated labels, and active writing last-edited labels.

`createdAt` is needed as the adapter fallback timestamp when `updatedAt` is unavailable.

`deletedAt` is needed because the adapter filters deleted notes before recent-note and active-writing projection.

`starred` is preserved because it is part of the current container metadata boundary, even though the current adapter does not render a starred badge.

`activeNoteId` is required because active writing state depends on it.

Excluded fields are:

- `body`.
- `content`.
- `tags`.
- `properties`.
- `relations`.
- graph edges.
- editor state.
- remote/provider fields.
- sync status fields.
- backup fields.
- large/full note payload.

Excluded fields should not invalidate Signal Panel props today because the adapter and component do not consume them.

K-313 tests do not individually assert every comparator field, but the implementation is direct and source-boundary tests assert the comparator shape.

Future tests should add field-by-field invalidation if the adapter contract grows.

## Stale Snapshot Risk Audit

Stale snapshot risk exists when a comparator omits a field that affects adapter output.

The current comparator is acceptable only because it matches the current adapter input contract and local metadata boundary.

Future adapter contract changes must update:

- `NotesOverviewSignalPanelStoreNote`.
- `selectNotesOverviewSignalPanelMetadata()`.
- `noteMatchesSignalPanelMetadata()`.
- `NotesOverviewSignalPanelContainer.test.ts`.
- source-boundary audit tests.

Future fields such as tags, previews, body-derived excerpts, backlinks, graph data, remote provider status, or sync state would require comparator updates before they are shown in the Signal Panel.

Stale snapshot risk should remain guarded by component tests and source-boundary audits.

K-314 does not claim performance evidence.

K-314 does not claim authenticated visual QA evidence.

## Runtime Behavior Preservation Audit

Signal Panel user-visible behavior should remain unchanged after K-313.

Empty local notes behavior is preserved.

Recent local notes behavior is preserved.

Active note behavior is preserved.

Deleted note filtering is preserved.

Starred metadata remains available in the metadata boundary.

K-313 did not change layout.

K-313 did not change dashboard/sidebar mount files.

K-313 did not change `AppContent`.

K-313 did not change `App.tsx`.

K-313 did not change `NoteView`.

K-313 did not change `NoteViewEditorArea`.

K-313 did not rewrite routes or navigation.

K-313 did not change Vite/build config.

## Adapter And Signal Panel Contract Audit

The adapter contract is unchanged.

`notesOverviewSignalPanelAdapter` remains pure and store-free.

`NotesOverviewSignalPanel` is unchanged.

`NotesOverviewSignalPanel` remains props-only and read-only.

`NotesOverviewSignalPanel` does not import the Notes store.

`NotesOverviewSignalPanel` does not import persistence.

`NotesOverviewSignalPanel` does not import Supabase, provider, sync, backup, graph, or Cosmos code.

There is no UI feature expansion.

There is no new chart, dashboard, graph, provider state, or remote status display.

## Store Local-first Persistence Audit

`useNotesStore` access remains container-local.

The container's store usage remains read-only.

The store subscription remains.

K-313 does not write to the store.

K-313 does not change `useNotesStore`.

K-313 does not change note schema.

K-313 does not change persistence.

K-313 does not import IndexedDB directly.

K-313 does not change hydration.

IndexedDB and local persistence remain the local-first Notes runtime source.

There is no remote-first hydration.

There is no full remote replacement.

## Supabase Provider Sync Backup Auth Audit

K-313 does not import Supabase.

K-313 does not import `authFetch`.

K-313 does not connect provider code.

K-313 does not connect sync code.

K-313 does not change backup, export, import, restore, or preflight behavior.

K-313 does not change auth behavior.

K-313 does not add auth bypass.

K-313 does not add production bypass.

K-313 does not add credentials.

K-313 does not add storageState artifacts.

K-313 does not add service-role artifacts.

K-313 does not change Supabase usage guardrails.

## Graph And Cosmos Audit

K-313 does not replace `NoteGraphView`.

K-313 does not change `NoteGraphViewLazy`.

K-313 does not import graph code into the Signal Panel container.

K-313 does not mutate graph data.

K-313 does not import Cosmos.

K-313 does not create a Cosmos runtime connection.

Future Cosmos integration remains separate.

## Test And CI Evidence Audit

K-313 reported and review re-ran focused tests.

Container tests passed: 1 file, 7 tests.

Signal Panel focused review group passed: 6 files, 60 tests.

Signal Panel implementation reported runtime boundary / Signal Panel focused coverage: 7 files, 69 tests.

Signal Panel lineage coverage passed: 12 files, 135 tests.

Notes/local-first review group passed: 6 files, 71 tests.

Notes/local-first implementation coverage reported: 7 files, 78 tests.

Auth/Supabase guard coverage reported: 5 files, 28 tests.

Backup/preflight guard coverage reported: 6 files, 35 tests.

`npm run typecheck` passed.

`npm run build` passed.

`git diff --check` passed.

Full `npm test` passed: 564 files passed, 1 skipped; 4131 tests passed, 7 skipped.

Existing Vite warnings remain separate and are not attributed to Signal Panel selector behavior.

## Remaining Gaps

Authenticated protected-shell visual QA evidence remains the release/manual gap preserved by K-310.

K-313 and K-314 do not claim performance evidence.

Store subscription churn remains.

Selector architecture/store-level derivation is unchanged.

Adapter-level caching remains unimplemented.

Store-level derived metadata remains unimplemented.

Vite chunk/import warnings remain separate.

Future optimization should pause until authenticated QA or performance evidence requires more work.

## K-315 Decision

Recommended:

K-315 Notes Signal Panel Optimization Line Closure Audit.

Scope:

- docs/source line-closure audit plus audit test only.
- close the K-311 through K-314 optimization line.
- no runtime changes.
- preserve authenticated QA and performance evidence gaps.

Alternative:

K-315 Notes Signal Panel Authenticated QA Evidence Capture.

Scope:

- docs/QA evidence update only if real authenticated testing is available.
- no runtime changes.

Alternative:

K-315 Notes Signal Panel Store Subscription Architecture Plan.

Scope:

- docs/plan plus audit test only.
- only if K-314 or later evidence shows store subscription churn is a real problem.
- no implementation yet.

Not recommended:

- additional selector optimization without evidence.
- store architecture refactor.
- layout redesign.
- adapter contract expansion.
- graph/Cosmos integration.
- Supabase/provider-backed Signal Panel.
- Vite/build config changes for unrelated warnings.

## Non-goals

- no additional selector optimization.
- no store subscription architecture change.
- no memoization layer.
- no container behavior change.
- no adapter contract change.
- no Signal Panel UI change.
- no layout redesign.
- no AppContent change.
- no NoteView change.
- no NoteViewEditorArea change.
- no store/schema/persistence change.
- no IndexedDB direct import.
- no Supabase/provider/sync connection.
- no graph/Cosmos connection.
- no Vite/build config change.
- no auth bypass.
- no backup/export/import/restore behavior change.
- no Health/Schedule change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-314 closes K-313 optimization source boundary.

K-313 reduced adapter input churn only.

K-313 did not remove notes store subscription.

The adapter contract remains unchanged.

The Signal Panel component remains unchanged.

The local-first boundary remains preserved.

No remote/provider/graph/auth/build config changes are introduced.

Future optimization should stop until authenticated QA or performance evidence requires more work.

Remote systems remain support layers.
