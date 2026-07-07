# K-304 Notes Overview / Signal Panel Adapter Implementation Plan

## Purpose

K-304 plans the future Notes Overview / Signal Panel adapter.

K-304 follows K-303 Notes Overview / Signal Panel Adapter Boundary Audit.

K-304 is docs/plan plus audit test only.

K-304 does not implement adapter. K-304 does not create an adapter source module. K-304 does not mount Signal Panel. K-304 does not connect live Notes data. K-304 does not wire `AppContent`, `NoteView`, or `NoteViewEditorArea`.

K-304 chooses the next path: K-305 Notes Overview / Signal Panel Pure Adapter Implementation.

## K-303 Boundary Recap

K-303 confirmed:

- Signal Panel remains isolated and unmounted.
- `NotesOverviewSignalPanel` remains props-only and read-only.
- current Notes runtime remains `AppContent -> NoteView -> NoteViewEditorArea`.
- graph surface remains `NoteGraphViewLazy` / `NoteGraphView`.
- local-first source of truth remains `useNotesStore` plus IndexedDB-primary persistence.
- no Supabase/provider/sync wiring exists.
- no backup/provider wiring exists.
- no auth/runtime gate changes were introduced.
- adapter and runtime mount remain future work.

K-303 selected K-304 as a plan before implementation so the adapter can be built without widening runtime boundaries.

## Adapter Purpose

The adapter converts local Notes-derived metadata into `NotesOverviewSignalPanel` props.

The adapter is not a data source.

The adapter is not a store.

The adapter is not a persistence layer.

The adapter is not a remote sync layer.

The adapter is not a graph replacement.

The adapter is not a runtime mount.

The adapter should be pure and deterministic. It should accept already-selected local metadata from a future caller and return a read-only prop object for `NotesOverviewSignalPanel`.

The adapter should not know whether its caller is a route, test, story, preview, or future runtime surface.

## Proposed Adapter Owner / Path

Recommended future file path:

```text
frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts
```

This location is safe because:

- it is close to the `NotesOverviewSignalPanel` component contract.
- it can be tested without mounting a runtime route.
- it does not require ownership inside `AppContent`, `NoteView`, or `NoteViewEditorArea`.
- it can avoid importing `useNotesStore`.
- it can avoid importing IndexedDB or persistence modules.
- it can avoid importing Supabase/provider/sync modules.
- it keeps graph/Cosmos runtime separate.
- it keeps backup/provider systems separate.

The adapter should not live in:

- `frontend/src/components/AppContent.tsx`.
- `frontend/src/components/views/NoteView.tsx`.
- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`.
- `frontend/src/store/useNotesStore.ts`.
- `frontend/src/lib/notePersistence.ts`.
- `frontend/src/lib/noteIndexedDb.ts`.
- Supabase/authFetch files.
- provider/sync files.
- graph/Cosmos runtime files.
- backup/provider files.

K-304 does not create this file. K-305 may create it.

## Adapter Input Shape

Future input should be a small read-only local Notes summary shape, not full store state.

Planned shape:

```ts
type NotesOverviewSignalPanelAdapterNoteInput = {
  readonly id: string;
  readonly title?: string | null;
  readonly updatedAt?: string | number | null;
  readonly createdAt?: string | number | null;
  readonly deletedAt?: string | number | null;
  readonly starred?: boolean;
};

type NotesOverviewSignalPanelAdapterInput = {
  readonly notes: readonly NotesOverviewSignalPanelAdapterNoteInput[];
  readonly activeNoteId?: string | null;
  readonly now?: number;
  readonly formatDateLabel?: (value: string | number) => string;
  readonly resolveUntitledTitle?: () => string;
};
```

Rules:

- input is provided by the future caller.
- adapter does not read store itself.
- adapter does not read IndexedDB itself.
- adapter does not call Supabase/provider/sync.
- adapter does not write.
- adapter should tolerate empty notes.
- adapter should tolerate malformed optional fields.
- adapter should omit deleted notes from recent notes.
- adapter should not expose note body content.
- adapter should not accept body previews in K-305.
- adapter should not accept tags, relations, graph coordinates, provider state, sync state, backup state, or editor state in K-305.

K-304 intentionally narrows the earlier exploratory shape: no `bodyPreview` and no `tags` for K-305. Those fields would require a separate content-safety and product-purpose decision.

## Adapter Output Shape

Future output should match the current `NotesOverviewSignalPanel` prop shape.

Planned output shape:

```ts
type SignalPanelRecentNote = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt?: string;
  readonly createdAt?: string;
  readonly signalLabel: 'recent';
};

type SignalPanelActiveWriting = {
  readonly state: 'active' | 'idle' | 'unavailable';
  readonly currentNoteId?: string;
  readonly currentNoteTitle?: string;
  readonly lastEditedAt?: string;
};

type SignalPanelData = {
  readonly generatedFrom: 'local-note-metadata';
  readonly recentNotes: readonly SignalPanelRecentNote[];
  readonly activeWriting: SignalPanelActiveWriting;
  readonly emptyState: {
    readonly hasNotes: boolean;
    readonly noteCount?: number;
    readonly reason?: 'empty-vault' | 'ready' | 'unavailable';
  };
};
```

Output rules:

- output preserves the K-282/K-284 contract.
- output is read-only.
- output includes only fields the component already accepts.
- output supports empty state.
- output supports recent notes signal.
- output supports active writing signal when source-grounded by `activeNoteId`.
- output uses conservative `unavailable` state if a signal cannot be derived safely.

Current gaps:

- `NotesOverviewSignalPanel` prop types are private to the component file.
- K-305 can duplicate a narrow local output type inside the adapter, or K-306 can harden/export shared types after adapter closure.
- date label formatting needs a deterministic rule.
- active writing is limited to current-note orientation, not editor activity.

## Mapping Rules

Deterministic mapping rules for K-305:

- filter out notes with `deletedAt`.
- sort recent notes by valid `updatedAt` descending when available.
- fallback to valid `createdAt` descending when `updatedAt` is unavailable.
- fallback to stable input order when both timestamps are unavailable or invalid.
- cap recent notes to five.
- do not mutate input arrays or objects.
- use trimmed title when present.
- missing, blank, or legacy `Untitled` titles map to a caller-provided untitled fallback or `"Untitled note"`.
- active note maps to active writing only if `activeNoteId` matches a non-deleted local note.
- no active note with non-empty notes maps to idle writing.
- empty notes maps to empty state with `reason: 'empty-vault'`.
- malformed input maps to safe empty or unavailable state, not a thrown exception.
- invalid dates do not throw.
- adapter performs no persistence writes.
- adapter performs no remote reads.
- adapter performs no graph mutation.
- adapter performs no side effects.

The adapter should keep `recentNotes` and `activeWriting` independent: a note may be active even if it is not inside the first five recent notes.

## Fixture-to-props Strategy

K-305 should reuse existing fixture ideas from `NotesOverviewSignalPanel.test.ts` where practical:

- active writing fixture.
- idle writing fixture.
- unavailable writing fixture.
- empty/degraded fixture.
- recent notes cap fixture.
- display-title fallback fixture.
- forbidden-field fixture checks.

Adapter-specific fixtures may be added only for mapping behavior:

- unsorted local notes.
- deleted notes.
- missing dates.
- invalid dates.
- blank titles.
- active note not found.
- active note deleted.
- input immutability.

Fixture data must not become runtime source of truth.

Fixture tests should compare adapter output to valid Signal Panel props.

Component tests remain separate and should continue to test rendering from passed props.

## Import Boundary Plan

Allowed future imports for the adapter:

- local TypeScript types declared in the adapter file.
- optional pure title/date utility only if it does not introduce store, locale store, route, persistence, or browser dependency.
- no React import should be necessary.

Forbidden imports:

- `AppContent`.
- `NoteView`.
- `NoteViewEditorArea`.
- `useNotesStore`.
- IndexedDB modules.
- persistence modules.
- Supabase/authFetch modules.
- provider/sync modules.
- backup/export/import/restore modules.
- `NoteGraphView`.
- `NoteGraphViewLazy`.
- graph/Cosmos mutation runtime.
- static preview generator.
- `window`.
- `document`.
- timers.
- `fetch`.
- `localStorage`.
- `sessionStorage`.

Recommended default:

- adapter imports nothing from runtime routes, stores, persistence, remote, graph, or backup paths.
- future runtime caller passes already-selected local Notes metadata to the adapter.

If K-305 needs display-title fallback, prefer a caller-provided `resolveUntitledTitle` callback over importing a utility that reads app store language.

## Runtime Mount Boundary

K-305 should not mount Signal Panel.

K-305 should only implement the pure adapter module and tests.

Runtime mount should be K-306 or later, after adapter closure.

Future mount plan must:

- preserve current Notes Overview layout.
- preserve `NoteGraphView`.
- preserve `NoteGraphViewLazy`.
- avoid `NoteViewEditorArea` graph ownership changes.
- avoid Supabase/provider/sync traffic.
- avoid auth changes.
- avoid backup/provider changes.
- include responsive/layout guard if later implemented.
- include browser proof only when UI is actually mounted.

K-304 approves no runtime exposure.

## K-305 Test Strategy

K-305 should add:

- adapter unit test.
- source-boundary audit test.
- empty notes mapping test.
- recent notes mapping test.
- active note mapping test.
- missing title fallback test.
- missing date fallback test.
- invalid date resilience test.
- deleted note exclusion test.
- input immutability test.
- no side effects test.
- no store/persistence/Supabase imports test.
- no runtime route imports test.
- no graph imports test.
- no backup/provider imports test.

Existing tests expected to continue passing:

- `notesOverviewSignalPanelAdapterBoundaryAudit.test.ts`.
- `notesOverviewSignalPanelAdapterImplementationPlan.test.ts`.
- `notesOverviewSignalPanelIsolatedComponentClosureAudit.test.ts`.
- `NotesOverviewSignalPanel.test.ts`.
- K-278 through K-285 planning/audit tests.
- Notes local-first guard tests.
- Supabase/auth guard tests.
- backup/preflight guard tests.

K-305 adapter tests should not need browser verification because the adapter is pure data mapping and the panel remains unmounted.

## K-305 Implementation Boundary

Recommended K-305:

```text
Notes Overview / Signal Panel Pure Adapter Implementation
```

Scope:

- add pure adapter module at `frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts`.
- add adapter unit tests.
- add import-boundary audit test.
- no runtime mount.
- no live Notes data connection.
- no store/persistence/schema changes.
- no Supabase/provider/sync.
- no graph/Cosmos runtime connection.
- no `NoteGraphView` replacement.
- no layout rewrite.

Expected files:

- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts`
- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.test.ts`
- optional `frontend/src/lib/notesOverviewSignalPanelAdapterBoundary.test.ts`
- optional short implementation note doc if review needs a written closure.

K-305 should avoid changing `NotesOverviewSignalPanel.tsx` unless type export becomes unavoidable. If type export is needed, keep it type-only and do not change rendering.

## K-306 Outlook

Possible K-306 paths after K-305:

- K-306 Adapter Closure Audit.
- K-306 Runtime Mount Plan.
- K-306 Signal Panel Contract Hardening.
- K-306 Notes Overview Layout Slot Plan.

Runtime mount should not happen until adapter implementation is closed.

If K-305 exposes type-contract friction, K-306 should prefer contract hardening before runtime mount.

If K-305 is clean, K-306 should still plan the runtime mount before implementation because responsive layout, graph preservation, and browser proof are separate risks.

## Non-goals

K-304 non-goals:

- no adapter implementation in K-304.
- no adapter source module.
- no Signal Panel runtime mount.
- no NoteView/AppContent wiring.
- no live Notes data connection.
- no direct store read by Signal Panel.
- no store mutation.
- no persistence write.
- no persistence/schema change.
- no Supabase/provider/sync connection.
- no authFetch usage.
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

K-304 defines the future adapter implementation boundary only.

No adapter is implemented. Signal Panel remains isolated and unmounted. Notes runtime remains local-first.

Adapter should be pure, local-derived, store-free, persistence-free, and remote-free.

K-305 may implement pure adapter module and tests only.

Runtime mount remains later work.

Remote systems remain support layers.
