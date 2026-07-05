# K-280 Notes Overview / Signal Panel Data Contract Plan

## Purpose

K-280 defines a data contract plan for a future Notes Overview / Signal Panel MVP. K-280 follows the K-279 data boundary audit, which approved only a future local-first boundary for recent notes plus active writing signal readout.

K-280 is docs/plan plus audit test only. K-280 does not implement UI. K-280 does not wire runtime data. K-280 does not add route/nav/panel behavior. K-280 does not change Notes stores, schemas, persistence, providers, sync, graph builders, backup, or BlockEditor internals. K-280 does not approve graph/KIS/provider/backup/BlockEditor integration.

K-280 chooses the K-281 next path: Notes Overview / Signal Panel Component Boundary Plan.

## Current State Summary

K-278 defined Notes Overview / Signal Panel as a concept-only product surface. Signal Panel remains an orientation/readout surface, not Cosmos Map, not a graph replacement, not backup/Data Safety UI, and not Archive Voyager.

K-279 audited data boundaries and approved only a future local-first boundary for recent notes plus active writing signal readout. K-279 did not implement runtime UI, did not wire runtime data, and did not approve graph/KIS/provider/backup/BlockEditor sources.

The Empty State line remains closed. `NotesPixelCosmosEmptyState` remains the productized empty-vault Notes/Cosmos surface, and Empty State remains primary when no notes exist.

The Static Preview line remains closed. `NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, unwired, and not product data.

`NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface. Runtime Cosmos Map is not implemented. Backup/preflight guardrails remain infrastructure and are not productized here.

## Contract Principles

The first Signal Panel data contract should be:

- local-first only.
- deterministic.
- minimal.
- serializable.
- derived from already-available note metadata or current note orientation state only.
- readable without raw note content.
- safe for empty, small, and large vaults.
- reversible and component-isolated before runtime mounting.

The contract must not require:

- raw note body.
- provider ids.
- sync status.
- backup/preflight fields.
- Data Safety state.
- graph/KIS fields.
- BlockEditor internals.
- schema migration.
- new persistence.
- new indexes.
- remote fetch.
- background sync.

Unavailable data should produce an explicit empty or unavailable state rather than fake signals.

## Source-grounded Inputs

### `frontend/src/components/views/NoteView.tsx`

Source facts:

- selects `notes` from `useNotesStore`.
- selects `folders` from `useNotesStore`.
- selects `activeNoteId` from `useNotesStore`.
- derives `activeNote` from local `notes` and `activeNoteId`.
- derives `activeNotes` by filtering out notes with `deletedAt`.
- derives `isEmptyVault` from the active non-deleted note count.
- already imports `sortNotes` and `displayNoteTitle`.

What this may inform:

- future contract input may include a passed local notes array.
- future contract input may include a passed active note id or already-derived active note.
- future contract input may include lightweight folder metadata only if separately passed.
- empty-state logic may be represented as data, while Empty State remains the product surface.

What this does not approve:

- changing `NoteView.tsx`.
- querying global stores inside a future component.
- using `syncError`, `isSyncing`, `savedAt`, dashboard state, graph state, or editor internals.
- runtime panel mounting.

### `frontend/src/components/views/noteUtils.ts`

Source facts:

- `NoteBase` includes `id`, `title`, `body`, `createdAt`, `updatedAt`, `folderId`, `deletedAt`, `starred`, `properties`, and `relations`.
- note normalization can fill `updatedAt`, normalize `folderId`, `deletedAt`, and `starred`, and normalize `properties` and `relations`.

What this may inform:

- first contract fields may include `id`, display title, `updatedAt`, optional `createdAt`, optional `folderId`, and optional `starred`.
- `deletedAt` may be used only for exclusion or deleted-state guard.

What this does not approve:

- raw `body` in the contract.
- body-derived tags, links, citations, headings, or summaries.
- arbitrary `properties` interpretation.
- `relations` intelligence.
- note utility changes.

### `frontend/src/components/views/noteListSort.ts`

Source facts:

- default note sort field is `updated`.
- default note sort direction is `desc`.
- updated sorting compares `updatedAt`.
- created sorting currently derives from the note id timestamp, not directly from `createdAt`.

What this may inform:

- `recentNotes` should use deterministic updated-desc ordering.
- K-280 should not invent semantic ranking or graph scoring.
- if a future adapter needs tie behavior, K-281/K-282 should define it explicitly.

What this does not approve:

- changing note list sort behavior.
- using starred-first sidebar preferences for Signal Panel ranking.
- semantic, random, remote, graph, or `KnowledgeIndexService` ranking.

### `frontend/src/components/views/noteDisplayTitle.ts`

Source facts:

- `displayNoteTitle` trims note titles.
- blank titles and legacy `Untitled` use the existing localized untitled-note fallback.
- `displayNoteTitleForLocale` exists for locale-based fallback.

What this may inform:

- Signal Panel should use existing display-title fallback behavior or an equivalent adapter call.
- Signal Panel should never expose a blank title when fallback behavior exists.

What this does not approve:

- inspecting raw note body to generate titles.
- AI summaries.
- new title fallback rules.
- title utility changes.

### `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`

Source facts:

- receives `activeNote` and `activeNoteId`.
- renders `NotesPixelCosmosEmptyState` for empty vault.
- contains BlockEditor usage through editor-specific props and body updates.

What this may inform:

- active writing can be represented as current-note orientation only.
- empty vault should defer to Empty State.

What this does not approve:

- BlockEditor internals.
- cursor position.
- selection state.
- dirty state.
- active keystroke/activity tracking.
- changing `NoteViewEditorArea.tsx`.

## RecentNotes Contract

Draft type:

```ts
type SignalPanelRecentNote = {
  id: string;
  title: string;
  updatedAt: number;
  createdAt?: number;
  folderId?: string | null;
  starred?: boolean;
  signalLabel: 'recent';
};
```

Rules:

- `id` comes from existing local note metadata.
- `title` uses existing display title fallback behavior.
- `updatedAt` comes from existing local note metadata and is required for the first contract.
- `createdAt` is optional and used only if already present.
- `folderId` is optional lightweight context only.
- `starred` is optional lightweight context only.
- `signalLabel` is literal and explains why the item appears.
- notes with `deletedAt` are excluded.
- output is capped to a small count.
- default cap recommendation is 5.
- sorting is deterministic updated-desc by `updatedAt`.
- if `updatedAt` is missing or invalid, the item should be omitted or marked unavailable by the adapter plan rather than guessed.
- if no notes exist, Signal Panel should defer to Empty State.

Forbidden:

- raw body/content.
- body excerpt.
- generated summary.
- provider id.
- Supabase row metadata.
- graph fields.
- relationship fields.
- attachment blob fields.
- backup fields.
- sync state.
- semantic score.

## ActiveWriting Contract

Draft type:

```ts
type SignalPanelActiveWriting = {
  state: 'active' | 'idle' | 'unavailable';
  currentNoteId?: string;
  currentNoteTitle?: string;
  lastEditedAt?: number;
};
```

Rules:

- derived only from already-exposed current note orientation state.
- `active` means a non-deleted active note is available.
- `idle` means notes exist but no safe current note is available.
- `unavailable` means the future adapter cannot safely determine current note orientation.
- `currentNoteId` comes from `activeNoteId` or already-derived `activeNote`.
- `currentNoteTitle` uses existing display title fallback behavior.
- `lastEditedAt` may use active note `updatedAt`.
- no raw body inspection.
- no BlockEditor internals.
- no cursor position.
- no editor selection.
- no dirty-state coupling.
- no keystroke/activity tracking.
- no analytics.
- no background sync.
- no new persistence.
- unavailable is valid and should not be treated as an error.

## Empty / Unavailable States

Draft type:

```ts
type SignalPanelEmptyState = {
  hasNotes: boolean;
  noteCount: number;
  reason: 'empty-vault' | 'ready' | 'unavailable';
};
```

Rules:

- no notes: Signal Panel should not duplicate Empty State; Empty State remains primary.
- notes exist but recent data is unavailable: show unavailable/degraded state, not fake signals.
- active writing unavailable: show unavailable or omit the active writing readout.
- loading-like state is allowed only if current runtime already exposes a safe local loading state; K-280 does not invent async/provider loading.
- error-like state is allowed only for local read failure; do not claim provider, backup, OAuth, or remote errors.
- all states must be accessible and readable.
- empty/unavailable copy should be calm and specific.

## Display Title Fallback Rule

Use existing `displayNoteTitle` or equivalent behavior confirmed by `noteDisplayTitle.ts`.

Rules:

- trim note titles.
- treat blank titles as untitled.
- treat legacy `Untitled` as untitled.
- use the existing localized untitled-note fallback.
- never expose blank title when fallback exists.
- do not inspect raw body just to generate a title.
- do not invent AI summaries.
- keep fallback deterministic.
- keep titles readable at narrow viewport.

## Sort / Limit Rule

Recent notes sorting should be deterministic:

1. start from local notes only.
2. exclude notes with `deletedAt`.
3. require valid `updatedAt`.
4. sort by `updatedAt` descending.
5. break ties deterministically in a future adapter plan, preferably by stable id or title.
6. cap to a small fixed count.

K-280 recommended default cap:

```ts
const SIGNAL_PANEL_RECENT_NOTES_LIMIT = 5;
```

Forbidden ranking behavior:

- randomized ordering.
- remote scoring.
- semantic ranking.
- graph relationship ranking.
- `KnowledgeIndexService` ranking.
- provider freshness ranking.
- backup/preflight ranking.
- sync status ranking.

If `updatedAt` is missing or invalid, do not guess from raw body or provider state. K-281/K-282 should either omit that item, use an explicitly audited source fallback, or mark recent notes unavailable.

## Forbidden Fields

The first contract must not include:

- raw note body/content.
- body excerpts.
- AI summaries.
- embeddings.
- vector fields.
- semantic similarity score.
- graph coordinates.
- orbit coordinates.
- spatial coordinates.
- relationship strength.
- cluster ids.
- theme ids.
- `KnowledgeIndexService` output.
- graph builder output.
- provider ids.
- Supabase row ids unless separately audited and identical to local ids.
- sync status.
- backup/preflight diagnostics.
- Data Safety state.
- OAuth state.
- Google Drive state.
- attachment blob data.
- restore/import/export state.
- BlockEditor internal document model.
- cursor position.
- editor selection.
- dirty-state internals.
- keystroke/activity analytics.
- background sync metadata.

## Draft Data Contract

Draft combined contract:

```ts
type SignalPanelDataDraft = {
  generatedFrom: 'local-note-metadata';
  emptyState: SignalPanelEmptyState;
  recentNotes: SignalPanelRecentNote[];
  activeWriting: SignalPanelActiveWriting;
};
```

Rules:

- `generatedFrom` must not imply provider, remote, backup, graph, or editor-internal sources.
- contract is draft and not yet runtime-wired.
- K-281 must decide exact component props and component boundary.
- K-282 or later may decide an adapter implementation if explicitly scoped.
- keep the contract serializable and deterministic.
- no functions in the data contract.
- no React component state in the data contract.
- no raw store object exposure.
- no raw note objects.
- no raw folder objects.
- no source service instances.

## Contract-to-component Boundary

Plan-only boundary:

- future Signal Panel should receive prepared data via props first.
- a future adapter may be planned separately.
- the component should not query global stores directly in its first implementation.
- no route/nav/panel change for first isolated implementation.
- no runtime exposure until boundary and QA are approved.
- 390px/browser QA is required before runtime mounting.
- accessibility and semantic grouping are required before runtime mounting.
- Empty State remains primary for empty vault.
- `NotesCosmosStaticPreview` remains isolated.
- `NoteGraphView` and `LocalGraphView` remain preserved.

## Validation Expectations For Future Implementation

If K-281/K-282 implements a contract or component later, validation should include:

- unit tests for contract transformation.
- recent notes filter tests.
- updated-desc sort tests.
- limit tests.
- display title fallback tests.
- active writing active/idle/unavailable tests.
- empty vault tests.
- no raw body/provider/backup/graph fields test.
- component render tests if UI is added later.
- accessibility/semantic grouping tests if UI is added later.
- 390px/browser QA before runtime exposure.
- typecheck.
- build.
- `git diff --check`.
- diff check for no route/nav/panel/store/schema changes unless explicitly scoped.

## K-281 Decision

Recommended primary path:

**K-281 Notes Overview / Signal Panel Component Boundary Plan**

Scope:

- docs/plan plus audit test only.
- define isolated component props using the K-280 data contract.
- define component states and semantic grouping.
- define browser/390px QA expectations before runtime exposure.
- no implementation.
- no runtime data wiring.

Alternative:

**K-281 Notes Overview / Signal Panel Data Adapter Source Facts Audit**

Scope:

- docs/audit plus source test.
- inspect exact future adapter source path and transformation feasibility.
- no implementation.

Alternative:

**K-281 Notes Overview / Signal Panel Contract Fixture Spec**

Scope:

- docs/spec plus audit test.
- define deterministic test fixture for contract before component.
- no implementation.

Not recommended:

- immediate runtime implementation.
- route/nav/panel.
- global store querying inside component.
- graph/KIS/provider/backup integration.
- Runtime Cosmos Map.

## Non-goals

K-280 has these explicit non-goals:

- no Signal Panel UI implementation in K-280.
- no Notes Overview component.
- no Signal Panel component.
- no runtime data wiring.
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
- no Health/Schedule behavior change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-280 defines a draft data contract only. K-280 does not approve runtime wiring. The first future Signal Panel scope remains recent notes plus active writing signal readout.

Graph/KIS/provider/backup/BlockEditor internals remain forbidden. The contract should feed a future isolated component via props before any runtime mount. Existing graph surfaces remain preserved. Empty State and Static Preview lines remain closed.

Signal Panel remains orientation/readout, not Cosmos Map or graph replacement. Local runtime data remains source of truth. Remote systems remain support layers.
