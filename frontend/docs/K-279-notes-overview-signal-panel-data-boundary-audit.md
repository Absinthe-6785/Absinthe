# K-279 Notes Overview / Signal Panel Data Boundary Audit

## Purpose

K-279 audits data boundaries for a future Notes Overview / Signal Panel. K-279 follows K-278, which chose recent notes plus active writing signal readout as the safest initial direction.

K-279 is docs/audit plus audit test only. K-279 does not implement UI. K-279 does not add route/nav/panel behavior. K-279 does not wire runtime data. K-279 does not change Notes stores, schemas, persistence, providers, sync, backup, graph builders, or editor internals. K-279 does not implement Runtime Cosmos Map.

K-279 chooses the K-280 next path: Notes Overview / Signal Panel Data Contract Plan.

## Current State Summary

K-278 defined Signal Panel as an orientation/readout surface, not a dashboard, graph replacement, Cosmos Map, Data Safety surface, or Archive Voyager.

K-265 through K-269 closed the Notes Empty State Pixel-Cosmos product polish line. Empty State remains the primary surface for an empty vault.

K-270 through K-277 closed the isolated Static Preview visual grammar/accessibility/viewport proof line. `NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, unwired, and not product data.

`NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface. Runtime Cosmos Map is not implemented. Backup/preflight guardrails remain infrastructure and are not productized here.

## Data Boundary Principles

The future Signal Panel should read from existing local-first Notes runtime data only.

The first implementation should not require:

- a new store field.
- a schema or persistence migration.
- remote-first hydrate/fetch.
- Supabase, OAuth, Google Drive, or provider state.
- backup/export/import/restore data.
- graph builder changes.
- `KnowledgeIndexService` coupling.
- persisted coordinates, orbits, spatial metadata, or map layout state.
- editor-internal coupling.

Every signal must be explainable, reversible, and safe for empty, small, and large vaults. If no notes exist, Signal Panel should yield to the existing Empty State rather than duplicating first-note CTAs.

## Approved Read Sources For First Data Contract

### Local Notes Collection

`frontend/src/components/views/NoteView.tsx` already selects `notes` from `useNotesStore`. A future Signal Panel data contract may read a passed local notes collection, provided it treats IndexedDB-backed local Notes runtime state as the source of truth and does not fetch or hydrate remotely.

Approved first-pass use:

- count active local notes.
- filter out deleted notes with `deletedAt`.
- derive recent note candidates from local metadata.
- cap output to a small deterministic list.

Not approved:

- full-vault body scans for first MVP.
- remote reads.
- full graph/index rebuilds.
- replacing local notes with remote data.

### Note Metadata

`frontend/src/components/views/noteUtils.ts` defines `NoteBase` with note fields including `id`, `title`, `body`, `createdAt`, `updatedAt`, `folderId`, `deletedAt`, `starred`, `properties`, and `relations`.

Approved first-pass metadata:

- `id`.
- display title derived from `title`.
- `updatedAt`.
- `createdAt` when present.
- `deletedAt` for exclusion.
- `folderId` only as optional lightweight context.
- `starred` only as optional lightweight context.

Not approved for first MVP:

- raw `body` content.
- body-derived tags, links, citations, or outlines.
- `relations` intelligence.
- arbitrary `properties` interpretation beyond separately audited display labels.

### Display Title Fallback

`frontend/src/components/views/noteDisplayTitle.ts` already provides display title fallback behavior for untitled notes. A future Signal Panel may use this display-only fallback instead of inventing another untitled-note rule.

### Existing Sorting Semantics

`frontend/src/components/views/noteListSort.ts` defines default updated-desc sorting semantics for note lists. A future recent-notes readout may use an equivalent local metadata sort:

1. exclude deleted notes.
2. sort by `updatedAt` descending.
3. cap to a small count.

This approval is for a small readout contract only. It does not approve changing note list sorting, persistence, or sidebar behavior.

### Active Note Runtime State

`frontend/src/components/views/NoteView.tsx` already selects `activeNoteId` from `useNotesStore` and derives `activeNote` from the local notes collection. `frontend/src/components/views/noteview/NoteViewEditorArea.tsx` already receives `activeNote` and `activeNoteId`.

Approved first-pass active writing readout:

- active note exists.
- active note display title.
- active note `updatedAt`.
- active note deleted state.
- simple unavailable/empty states.

Not approved:

- editor dirty state unless separately audited.
- cursor position, selection, keystroke activity, draft buffers, or BlockEditor internals.
- new writing activity persistence.
- app-wide activity tracking.

### Empty Vault State

`frontend/src/components/views/NoteView.tsx` derives an empty-vault condition from active non-deleted note count. `frontend/src/components/views/noteview/NoteViewEditorArea.tsx` renders `NotesPixelCosmosEmptyState` when the vault is empty.

Approved first-pass behavior:

- Signal Panel may report `empty: true` in an isolated data contract.
- Product runtime should continue to let Empty State lead when no notes exist.

## Caution Sources Requiring Separate Audit

### UI State

`frontend/src/components/views/noteview/useNoteViewState.ts` exposes local UI state such as view mode, note list filters, right panel state, timeline mode, and mobile editor state. These may be useful later, but K-279 does not approve coupling Signal Panel data to transient UI controls.

### Dashboard And Knowledge Helpers

`frontend/src/components/views/noteview/useNoteViewDashboard.ts` uses history, timeline, discovery, dashboard, and `knowledgeIndexService` helpers. These are high-coupling sources and are not approved for first MVP Signal Panel data.

### Graph Surfaces

`frontend/src/components/views/NoteGraphView.tsx` and `frontend/src/components/views/features/knowledge/graph/LocalGraphView.tsx` remain existing graph surfaces. They are not data dependencies for the first Signal Panel contract.

### Relationships, Resurfacing, Clusters, And Themes

Neglected notes, isolated notes, resurfacing, clusters, themes, local/context relationships, and graph intelligence need a future graph/index data audit before runtime use.

### Attachment And Reference Traces

Attachment traces, reference traces, blob/provider state, and backup-adjacent signals are deferred. They must not enter the Notes Overview / Signal Panel first contract.

## Forbidden Sources For First MVP

The first Signal Panel data contract must not use:

- Supabase reads or writes.
- remote provider state.
- Google Drive OAuth/session/upload/recovery state.
- backup/export/import/restore/preflight diagnostics.
- Data Safety status.
- attachment blob inventory, recovery, cleanup, or sync queue state.
- `KnowledgeIndexService`.
- graph builders.
- `NoteGraphView` implementation details.
- `LocalGraphView` implementation details.
- Runtime Cosmos Map data.
- persisted coordinates, orbit positions, spatial metadata, or visual map layout.
- BlockEditor internals.
- new persistence fields.
- new indexes.
- new background sync.

## Recent Notes Boundary Decision

Recent notes are approved as the safest first Signal Panel signal if K-280 defines a narrow data contract.

Allowed definition:

- input: local notes array.
- filter: exclude notes with `deletedAt`.
- sort: `updatedAt` descending, with deterministic tie behavior if needed.
- shape: `id`, display title, `updatedAt`, optional `createdAt`, optional lightweight folder/starred labels.
- limit: small fixed count.
- empty result: graceful empty copy, not a failure.

Disallowed:

- body scans.
- relationship scoring.
- provider metadata.
- backup metadata.
- remote fetch.
- graph/index dependency.

## Active Writing Boundary Decision

Active writing readout is approved only as a simple current-note orientation signal.

Allowed definition:

- input: `activeNoteId` plus local notes array, or already-derived `activeNote`.
- shape: active/unavailable, note id, display title, `updatedAt`, optional deleted-state guard.
- empty vault: inactive/empty state.

Disallowed:

- dirty/editor state.
- cursor position.
- editor selection.
- document search state.
- note navigation history.
- keyboard or pointer telemetry.
- persisted writing sessions.
- BlockEditor coupling.

## Deferred Signals

These concepts remain product-interesting but are deferred:

- resurfacing notes.
- neglected notes.
- isolated notes.
- lightweight clusters.
- themes.
- relationship summaries.
- attachment/reference traces.
- Archive-style time-distance summaries.
- cross-workspace Home Signal Board data.

Each deferred signal needs a separate source audit before implementation.

## Graph And Index Boundary

K-279 does not approve any graph or index dependency for the first Signal Panel MVP.

`NoteGraphView` remains the full-vault graph. `LocalGraphView` remains the local/context graph. Signal Panel must not replace either surface. Signal Panel must not call graph builders or `KnowledgeIndexService` for the first data contract.

Future graph-derived signals may be reconsidered only after a milestone explicitly audits:

- source of truth.
- performance on large vaults.
- offline behavior.
- stale index behavior.
- empty/small vault behavior.
- accessibility/fallback copy.
- relationship to existing graph surfaces.

## Product Surface Boundaries

Signal Panel is Notes-scoped and should remain separate from:

- Empty State first-note onboarding.
- Static Preview fixture/component.
- full-vault graph.
- local/context graph.
- Runtime Cosmos Map.
- Home Signal Board.
- Archive Voyager.
- Data Safety / Backup Health.

Future runtime placement should be component-isolated before mounting into normal Notes. Browser/mobile proof is required before any runtime exposure, but K-279 does not require browser QA because it changes no UI.

## Proposed First Data Contract Draft

K-280 should define a small contract similar to:

```ts
type NotesOverviewSignalPanelData = {
  empty: boolean;
  recentNotes: Array<{
    id: string;
    title: string;
    updatedAt: number;
    createdAt?: number;
    folderId?: string | null;
    starred?: boolean;
  }>;
  activeWriting: {
    status: 'empty' | 'inactive' | 'active';
    noteId?: string;
    title?: string;
    updatedAt?: number;
  };
};
```

The contract should not include raw note body, provider ids, backup status, graph coordinates, graph score, cluster id, relationship score, attachment blobs, sync status, or editor-internal state.

## Runtime Placement Implications

The safest next path is to define pure data preparation outside runtime UI first. A future implementation can then pass prepared data into an isolated component.

K-280 should not mount a panel. K-280 should not change normal Notes navigation. K-280 should not add route/nav/panel behavior. K-280 should not alter `NoteGraphView`, `LocalGraphView`, `NotesCosmosStaticPreview`, `NotesPixelCosmosEmptyState`, stores, schemas, persistence, providers, sync, or backup behavior.

## K-280 Decision

Recommended primary path:

**K-280 Notes Overview / Signal Panel Data Contract Plan**

Scope:

- docs/plan plus audit test.
- define exact first contract for recent notes and active writing.
- define input/output shape.
- define empty/small/large vault behavior.
- define deterministic sort/limit behavior.
- define forbidden fields.
- no UI implementation.
- no runtime mounting.
- no store/schema/persistence/provider changes.

Not recommended for K-280:

- runtime Signal Panel UI.
- route/nav/panel changes.
- graph/index integration.
- Runtime Cosmos Map.
- backup/Data Safety integration.
- attachment/reference signals.

## Non-goals

K-279 has these explicit non-goals:

- no runtime UI implementation.
- no Notes Overview component.
- no Signal Panel component.
- no route/nav/panel behavior.
- no live runtime mounting.
- no `NotesCosmosStaticPreview` changes.
- no `NotesPixelCosmosEmptyState` changes.
- no `NoteGraphView` changes.
- no `LocalGraphView` changes.
- no graph builder changes.
- no `KnowledgeIndexService` coupling.
- no Notes store changes.
- no schema changes.
- no persistence changes.
- no provider/sync changes.
- no backup/export/import/restore changes.
- no Data Safety UI.
- no attachment/blob behavior.
- no BlockEditor changes.
- no browser QA requirement.

## Closure Statement

K-279 approves only a narrow future data boundary: local recent-note metadata plus simple active-note orientation. Everything else remains deferred or forbidden until separately audited.
