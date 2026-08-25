# K-303 Notes Overview / Signal Panel Adapter Boundary Audit

## Purpose

K-303 audits the future adapter boundary between the current Notes Overview runtime and the isolated Notes Overview / Signal Panel component.

K-303 follows the K-278 through K-285 Signal Panel line and the K-302 Supabase usage guardrail runbook closure.

K-303 is docs/source boundary audit plus audit test only.

K-303 does not implement adapter. K-303 does not mount Signal Panel. K-303 does not connect Notes runtime data. K-303 does not connect Supabase/provider/sync data. K-303 does not change layout, route, graph, persistence, auth, backup, or traffic guardrail behavior.

K-303 chooses the next path: K-304 Notes Overview / Signal Panel Adapter Implementation Plan.

## Current Line Recap

K-278 defined Notes Overview / Signal Panel as a concept-only orientation/readout surface.

K-279 audited the data boundary and approved only local-first recent-note metadata plus active writing orientation as a future safe source.

K-280 planned the data contract for recent notes, active writing, empty/degraded state, and forbidden raw/provider/graph/backup/editor fields.

K-281 planned a props-first component boundary with no store, route, graph, provider, backup, or BlockEditor ownership.

K-282 specified deterministic contract fixtures for active, idle, unavailable, empty/degraded, recent-cap, title-fallback, and forbidden-field cases.

K-283 planned the isolated component skeleton and selected `frontend/src/components/notes/NotesOverviewSignalPanel.tsx`.

K-284 implemented the isolated component and its component test.

K-285 closed the isolated component line and confirmed Signal Panel remains isolated, unmounted, props-only, read-only, and not approved for runtime exposure.

K-286 through K-295 closed auth restoration and test/dev verification.

K-296 through K-302 closed Supabase usage/quota source facts, guardrail strategy, route metadata boundary, and runbook/monitoring planning.

Product work can resume because the auth and Supabase interruption lines are closed.

## Current Signal Panel Posture

Component path:

```text
frontend/src/components/notes/NotesOverviewSignalPanel.tsx
```

Component test path:

```text
frontend/src/components/notes/NotesOverviewSignalPanel.test.ts
```

Related closure audit:

```text
frontend/docs/K-285-notes-overview-signal-panel-isolated-component-closure-audit.md
frontend/src/lib/notesOverviewSignalPanelIsolatedComponentClosureAudit.test.ts
```

Current posture:

- Signal Panel is props-only.
- Signal Panel is read-only.
- Signal Panel is isolated and unmounted.
- Signal Panel renders deterministic data passed through props.
- Signal Panel has no store reads.
- Signal Panel has no provider reads.
- Signal Panel has no Supabase reads.
- Signal Panel has no authFetch calls.
- Signal Panel has no route/nav ownership.
- Signal Panel has no graph/KIS ownership.
- Signal Panel does not replace `NoteGraphView`.
- Signal Panel does not replace `LocalGraphView`.
- Signal Panel has no BlockEditor coupling.
- Signal Panel has no backup/provider coupling.
- Signal Panel has no runtime data source.
- Signal Panel does not create notes, mutate notes, navigate, or expose callbacks.

The current component is safe as an isolated readout component. It is not yet product runtime.

## Current Notes Overview Posture

Current runtime shell path:

```text
frontend/src/components/AppContent.tsx
```

Current Notes workspace path:

```text
frontend/src/components/views/NoteView.tsx
```

Current editor/graph surface path:

```text
frontend/src/components/views/noteview/NoteViewEditorArea.tsx
```

Current graph paths:

```text
frontend/src/components/views/noteview/NoteGraphViewLazy.tsx
frontend/src/components/views/NoteGraphView.tsx
```

Current mount tree:

- `AppContent.tsx` renders `<NoteView showToast={showToast} accountId={authUser.id} />` when `activeTab === 'note'`.
- `NoteView.tsx` owns the Notes workspace state composition and passes child props into `NoteViewSidebar`, `NoteViewEditorArea`, and context panels.
- `NoteViewEditorArea.tsx` mounts `NoteGraphViewLazy` for graph/Cosmos surfaces.
- `NotesOverviewSignalPanel` is not imported or mounted by `AppContent.tsx`, `NoteView.tsx`, `NoteViewEditorArea.tsx`, or `NotesCosmosStaticPreview.tsx`.

Current Notes data source:

- `NoteView.tsx` reads `notes`, `folders`, and `activeNoteId` from `useNotesStore`.
- `useNotesStore.ts` owns Notes runtime state and CRUD.
- `notePersistence.ts` initializes local-first Notes persistence with IndexedDB primary and localStorage fallback.
- `noteIndexedDb.ts` provides the local IndexedDB notes storage path.

Safe slot/seam:

- A future adapter can live outside the Signal Panel component and map already-local Notes metadata into Signal Panel props.
- The safest first seam is a pure selector/mapper module under `frontend/src/components/notes/` or `frontend/src/lib/`.
- The future adapter should be implemented and tested before any runtime mount.
- The runtime mount location should remain a later decision, likely in a Notes-owned parent after the adapter contract is stable.

Ambiguities:

- Notes runtime is already broad and state-heavy.
- `NoteView.tsx` currently owns many product surfaces, graph panels, and knowledge context flows.
- K-303 does not approve adding another runtime surface into that tree yet.

## Local-first Source-of-truth Audit

Notes runtime source of truth remains local-first.

Current source facts:

- `useNotesStore.ts` owns Notes runtime state.
- `notePersistence.ts` uses IndexedDB primary and localStorage fallback.
- `AppContent.tsx` calls `initNotesStorage()` and `hydrateFromDB()` during authenticated app startup.
- local persistence remains the runtime source where applicable.
- remote Notes sync foundation exists as a support path, not as a Signal Panel source.

Future adapter rules:

- adapter must read from local Notes runtime data or derived local selectors only.
- adapter must not make Supabase the source of truth.
- adapter must not perform remote-first full fetch, full hydrate, graph rebuild, or remote overwrite.
- provider/sync/backup systems remain support layers and must not feed Signal Panel directly.
- adapter must not read provider state, backup state, Google Drive state, attachment state, or Supabase usage state.
- adapter must not change persistence, schema, hydration, sync, or backup behavior.

Signal Panel may summarize local metadata. It must not become a remote status dashboard.

## Static / Fixture Data Boundary Audit

The isolated Signal Panel component currently uses test-local fixtures in:

```text
frontend/src/components/notes/NotesOverviewSignalPanel.test.ts
```

Current fixture/contract shape:

- `generatedFrom: 'local-note-metadata'`.
- `recentNotes` with id, title, optional updated/created labels, and `signalLabel: 'recent'`.
- `activeWriting` with `active`, `idle`, or `unavailable`.
- `emptyState` with note presence, optional count, and empty/ready/unavailable reason.

Fields safe for future adapter:

- note id.
- display title.
- updated/created timestamp or formatted label.
- active note id/title where already local and source-grounded.
- local note count.
- empty/degraded state.
- literal signal labels such as `recent`.

Mock-only/static-only fields:

- hand-written fixture dates.
- fixture-specific ids.
- fixture ordering not derived from real local notes.
- fixture active-writing state not derived from current runtime state.

Missing for runtime adapter:

- source-grounded sorting rule implementation.
- display-title fallback mapping.
- deleted-note exclusion.
- empty-vault mapping.
- active-note availability mapping.
- unavailable/degraded mapping when local state is incomplete.
- import-boundary proof that no remote/provider/graph services are called.

Fixture naming makes runtime ownership reasonably clear because the component data source is labelled `local-note-metadata`, but runtime derivation still needs an explicit adapter plan.

## Safe Adapter Seam Audit

Recommended future seam:

- create a pure selector/mapper from local Notes-derived data to `NotesOverviewSignalPanel` props.
- keep the adapter separate from `NotesOverviewSignalPanel.tsx`.
- keep the adapter separate from Supabase/provider/sync/backup files.
- keep the adapter separate from graph/KIS mutation paths.
- implement adapter tests before runtime mount.

Recommended owner path candidates:

- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts`
- or `frontend/src/lib/notesOverviewSignalPanelAdapter.ts`

The adapter should:

- accept local notes, optional active note id, and optional locale/title formatter inputs.
- produce the existing Signal Panel prop shape.
- be deterministic.
- be read-only.
- be side-effect free.
- avoid React hooks.
- avoid store subscriptions.
- avoid Supabase/authFetch/provider/sync/backup calls.
- avoid graph/KIS mutation.
- avoid layout ownership.
- be testable without mounting `NoteView`.

The adapter should not live in:

- `NotesOverviewSignalPanel.tsx`.
- `NoteView.tsx` as inline mapping logic.
- `NoteViewEditorArea.tsx`.
- `useNotesStore.ts`.
- persistence, sync, provider, backup, auth, or graph modules.

Adapter implementation and runtime mount should remain separate PRs unless a later plan explicitly approves a tiny combined step.

## Forbidden Data-flow Audit

Forbidden future shortcuts:

- Signal Panel directly reading Notes store.
- Signal Panel directly reading IndexedDB.
- Signal Panel directly calling Supabase.
- Signal Panel directly calling `authFetch`.
- Signal Panel directly calling provider APIs.
- Signal Panel directly calling sync APIs.
- Signal Panel directly calling backup/export/import/restore APIs.
- Signal Panel directly owning route/navigation.
- Signal Panel replacing `NoteGraphView`.
- Signal Panel replacing `LocalGraphView`.
- Signal Panel triggering graph rebuild.
- Signal Panel mutating graph/KIS state.
- Signal Panel mounting inside static preview runtime.
- adapter performing writes.
- adapter causing remote fetch.
- adapter causing background sync.
- adapter causing backup/export/import behavior.
- adapter changing persistence schema.
- adapter reading raw note body/content.
- adapter reading BlockEditor internals.
- adapter reading attachment/provider state.
- adapter reading auth/session state.
- adapter reading Supabase usage metadata as runtime input.

The adapter may map local metadata. It must not become a hidden integration hub.

## Runtime Mount Boundary

K-303 does not mount Signal Panel.

Future runtime mount rules:

- runtime mount requires a separate plan/implementation.
- runtime mount should happen only after adapter contract is implemented and tested.
- runtime mount should preserve existing Notes Overview layout.
- runtime mount should preserve existing graph behavior.
- runtime mount should not replace `NoteGraphView`.
- runtime mount should not change `NoteViewEditorArea` graph ownership without a separate graph plan.
- runtime mount should include desktop/mobile layout guard if needed.
- runtime mount should include browser/390px/accessibility smoke proof.
- runtime mount should not change Supabase usage posture.
- runtime mount should not change local-first data ownership.

K-303 approves no runtime exposure.

## Future Adapter Test Strategy

Future adapter tests should cover:

- pure adapter unit tests.
- local notes to props mapping.
- display title fallback mapping.
- deleted notes excluded.
- recent notes sorted deterministically.
- recent notes capped to five.
- empty Notes state.
- recent notes state.
- active writing signal state if source-grounded.
- idle writing signal state.
- unavailable writing signal state.
- no raw note body/content in output.
- no Supabase/provider calls.
- no sync/backup calls.
- no store writes.
- no graph mutation.
- no runtime mount.
- import-boundary audit.
- local-first boundary audit.

Adapter tests should not require browser proof because the adapter should be pure data mapping. Runtime mount tests and browser QA belong to a later mount milestone.

## K-304 Implementation Candidate Matrix

| Candidate | Scope | Expected files | Benefit | Risk | Tests | Recommended now? |
| --- | --- | --- | --- | --- | --- | --- |
| Notes Overview / Signal Panel Adapter Implementation Plan | docs/plan plus audit test only | K-304 doc + audit test | chooses exact adapter path, source selectors, props mapping, and tests | Low | source-invariant audit | Yes |
| Pure adapter/selector implementation | small pure mapper, no runtime mount | adapter module + adapter tests | creates usable contract bridge without UI exposure | Medium-low | adapter unit tests, import-boundary audit | Maybe after plan |
| Adapter fixture expansion | test fixture expansion only | component test or adapter fixture tests | clarifies edge states before implementation | Low | fixture validation tests | Optional |
| Runtime mount plan | docs/plan plus audit test only | mount plan doc + audit test | defines layout and browser proof before UI exposure | Low | source-invariant audit | Later |
| Runtime mount implementation | mount Signal Panel with adapter data | Notes runtime files + browser proof | productizes Signal Panel | Medium-high | unit, integration, browser/mobile/accessibility proof | Not now |
| Signal Panel contract hardening | export shared types or refine props | component/type/test files | reduces adapter/component drift | Medium-low | component and type tests | After adapter plan |
| Cosmos graph integration plan | docs/source plan only | graph integration plan doc + audit test | explores future graph relation | Medium | graph/source audit | Not now |

Recommended K-304 path:

```text
K-304 Notes Overview / Signal Panel Adapter Implementation Plan
```

Scope:

- docs/plan plus audit test only.
- choose exact adapter path.
- choose local Notes source selectors.
- choose props mapping rules.
- choose test matrix.
- no implementation yet.
- no runtime mount.

Alternative if K-303 review finds the boundary already precise enough:

```text
K-304 Notes Overview / Signal Panel Pure Adapter Implementation
```

Scope:

- small pure adapter implementation.
- no runtime mount.
- no Supabase/provider/sync.
- requires higher scrutiny.

Not recommended:

- runtime mount before adapter plan.
- adapter implementation and runtime mount in the same PR.
- graph/Cosmos integration.
- provider/Supabase-backed Signal Panel.
- layout rewrite.
- replacing `NoteGraphView`.

## Non-goals

K-303 non-goals:

- no adapter implementation.
- no Signal Panel runtime mount.
- no Notes runtime data connection.
- no Supabase/provider/sync connection.
- no local persistence change.
- no Notes store/schema change.
- no graph/Cosmos runtime connection.
- no NoteGraphView replacement.
- no route/nav rewrite.
- no layout rewrite.
- no static preview generator change.
- no backup/export/import/restore behavior change.
- no auth change.
- no Supabase traffic guardrail change.
- no monitoring/enforcement implementation.
- no Health/Schedule change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-303 locks current adapter boundary facts only.

Signal Panel remains isolated and unmounted. Notes runtime remains local-first. No Supabase/provider/sync data connection is introduced. No graph/Cosmos runtime connection is introduced.

future adapter should be pure, local-derived, and tested before mount.

K-304 should plan or implement the smallest safe adapter step.

Remote systems remain support layers.
