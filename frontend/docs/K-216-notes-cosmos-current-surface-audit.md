# K-216 Notes/Cosmos Current Surface Audit

## Purpose

K-216 audits the current Notes runtime surfaces after K-214 and K-215. It is a source-grounded audit that prepares for a future static preview plan, graph/canvas decision, or Cosmos Map implementation plan.

K-216 is docs/audit only. K-216 does not implement Cosmos Map. K-216 does not change runtime UI. K-216 does not modify NoteView, NoteGraphView, NotesPixelCosmosEmptyState, ProductEmptyState, stores, schemas, providers, persistence, routing, assets, fonts, dependencies, Health, Schedule, attachments, OAuth, Supabase, or Google Drive behavior.

The audit goal is to identify current shipped/runtime surfaces, current shared components, current empty/loading states, current graph/runtime surfaces, the future Cosmos Map concept, unimplemented concepts, source-verified facts, and assumptions requiring future verification.

## LEAN_03 Current-State Reconciliation

The inventory below preserves the historical K-216 observation that
`frontend/src/components/common/EmptyState.tsx` was present as an older wrapper
around `ProductEmptyState`. LEAN_03 revalidated that the wrapper has no current
runtime, test, or tooling import and removed only that obsolete file.
`ProductEmptyState.tsx` remains the active shared empty-state surface.

## Source Inspection Scope

| Source / surface | Current role | Runtime UI? | Docs/test only? | Direct relationship to future Cosmos Map |
| --- | --- | --- | --- | --- |
| `frontend/src/components/views/NoteView.tsx` | Main Notes workspace shell, store selectors, derived note state, mobile split, graph mode wiring, context panel gating | Yes | No | Hosts the current graph mode and decides empty-vault vs select-note state. |
| `frontend/src/components/views/noteview/NoteViewSidebar.tsx` | Sidebar chrome, list filters, search input, workspace/dashboard surfaces, attachment maintenance panel, note list routing | Yes | No | Provides retrieval/navigation baseline that Cosmos must not replace. |
| `frontend/src/components/views/noteview/NoteViewEditorArea.tsx` | Editor/detail pane, selected-note placeholder, empty-vault state, full-area graph rendering, editor toolbar/body | Yes | No | Contains `NoteGraphViewLazy`, `NotesPixelCosmosEmptyState`, and `ProductEmptyState` select-note fallback. |
| `frontend/src/components/views/NoteGraphView.tsx` | Current shipped full-vault graph/relationship view with SVG, zoom/pan, search, filters, HUD, universe/cosmos concepts | Yes | No | Current graph-related surface; future Cosmos must not duplicate it accidentally. |
| `frontend/src/components/views/noteview/NoteGraphViewLazy.tsx` | Lazy-load wrapper for `NoteGraphView` with `ViewLoadingFallback` | Yes | No | Confirms graph is deferred until graph view mounts. |
| `frontend/src/components/views/features/knowledge/graph/LocalGraphView.tsx` | Current local/context graph panel for a selected note using radial SVG layout | Yes | No | Separate graph surface from full-area NoteGraphView; future Cosmos must account for both. |
| `frontend/src/components/views/features/knowledge/graph/buildGlobalGraphData.ts` | Builds global graph nodes/edges from `KnowledgeIndexService` | No | No | Source-verified graph data derivation for current NoteGraphView. |
| `frontend/src/components/views/features/knowledge/graph/buildExpandedGraphData.ts` | Builds local/expanded graph data around a selected note | No | No | Source-verified local graph data derivation. |
| `frontend/src/components/views/features/knowledge/KnowledgeIndexService.ts` | Indexes notes, links, mentions, tags, properties, relations, and graph accessors | No | No | Current knowledge data source; future Cosmos should reuse current explicit/derived indexes before new data. |
| `frontend/src/components/views/noteview/NoteSidebarVirtualList.tsx` | Virtualized note list and list empty states | Yes | No | Defines no-notes/no-results/trash empty states separate from Cosmos empty vault. |
| `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx` | K-212 empty-vault pixel-cosmos identity component | Yes | No | Current empty-vault Cosmos language; not a graph/navigation surface. |
| `frontend/src/components/common/ProductEmptyState.tsx` | Shared empty-state component with Tailwind and note-chrome variants | Yes | No | Used for Notes select-note, list no-results/no-notes/trash states; future empty states may reuse it when literal. |
| `frontend/src/components/common/EmptyState.tsx` | Thin wrapper around ProductEmptyState for older/shared surfaces | Yes | No | No direct Cosmos relationship found in audited Notes path. |
| `frontend/src/components/common/ViewLoadingFallback.tsx` | Lazy-load loading fallback | Yes | No | Used by `NoteGraphViewLazy`; future graph/cosmos loading should remain clear. |
| `frontend/src/components/views/noteview/useNoteViewState.ts` | Local UI state for view mode, search, mobile editor, panels, filters, trace modes | No | No | Source-verified current UI state; future Cosmos should not add persistence casually. |
| `frontend/src/components/views/noteview/useNoteViewPanelConfig.tsx` | Declares reading/graph view modes and context panel tabs | No | No | Shows graph exists as current view mode and context panel tab. |
| `frontend/src/components/views/noteview/sidebarNoteListFilter.ts` | Sidebar plain text / knowledge query filtering | No | No | Search/filter baseline; Cosmos must not hide it. |
| `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.test.ts` | K-212 runtime tests for empty-vault callbacks, hooks, and mobile guard | No | Yes | Confirms empty-vault behavior and mobile K-212/K-213 fix. |
| `frontend/src/lib/notesCosmosConceptSpec.test.ts` | K-214 doc audit test | No | Yes | Concept spec lineage. |
| `frontend/src/lib/notesCosmosIaDataBoundarySpec.test.ts` | K-215 doc audit test | No | Yes | IA/data-boundary lineage. |
| Current graph tests under `frontend/src/components/views/features/knowledge/graph/*test.ts` and `frontend/src/components/views/k92*Cosmos*Audit*.test.ts` | Graph data, local graph, global graph, relation graph, and performance/memo audit coverage | No | Yes | Confirms graph behavior and performance concerns already exist. |

## Current Notes Surface Inventory

### 1. Notes Shell / NoteView

`NoteView` is the current runtime shell for the Notes workspace. It reads notes, folders, active note id, sync state, CRUD actions, and workspace state from `useNotesStore` and related hooks. It composes sidebar, editor area, context panel, dialogs, restore modal, and graph view.

Source-verified responsibilities:

- owns the overall Notes split layout
- derives `activeNote`, `activeNoteCount`, `isEmptyVault`, and trash/starred counts
- passes `isEmptyVault` to `NoteViewEditorArea`
- hides the list or editor on mobile based on `isMobile`, `mobileShowEditor`, active note state, and `isMobileEmptyVault`
- hosts `NoteGraphView` through `NoteGraphViewLazy` via the editor area
- prevents right context panel rendering while full graph mode is active
- closes mobile sidebar on scope changes
- collapses sidebar on tablet through `isTablet && !isMobile`

Empty/non-empty behavior:

- empty vault is `activeNoteCount === 0 && activeFolderId !== 'trash'`
- mobile empty vault has a special guard: `isMobileEmptyVault = activeFolderId !== 'trash' && notes.every(n => n.deletedAt)`
- non-empty but no active note flows to a select-a-note `ProductEmptyState`
- graph mode can render even with no active note

### 2. Notes List / Search / Filter

The list/search/filter surface is centered in `NoteViewSidebar`, `NoteSidebarVirtualList`, `sidebarNoteListFilter`, and workspace state.

Source-verified responsibilities:

- retrieve and navigate notes
- filter by all/recent/favorites
- filter by folder, trash, active tag, saved views, smart collections, rule collections, database views, dashboard modes, trace lenses, and workspace activation
- search sidebar notes via plain text scoring or knowledge-query syntax
- virtualize list rows when note count reaches the virtualizer threshold
- provide row preview, folder badge, tags, starred indicator, and date labels

Empty states:

- trash empty: `ProductEmptyState` with trash copy
- search empty: `ProductEmptyState` with clear-query action
- list no-notes: `ProductEmptyState` with create-first-note action

This surface is the fast retrieval baseline. Future Cosmos must not replace it.

### 3. Editor / Detail Surface

`NoteViewEditorArea` owns the selected-note reading/editing experience. It renders title/header actions, metadata/context chips, image attachments, find-in-note, editor toolbar, and BlockEditor-backed body editing.

Source-verified responsibilities:

- writing and editing selected notes
- reading mode and edit mode toggling
- graph mode switching through header actions
- document search panel
- image attachment insertion/display
- note trash restore/delete affordances
- select-a-note placeholder when the vault has notes but no active note

Select-a-note behavior:

- if there is no active note and the vault is not empty, `ProductEmptyState` renders a literal select-note/continue-recent surface
- this is not the same as empty vault and should not inherit full Cosmos no-signals language

### 4. NotesPixelCosmosEmptyState

`NotesPixelCosmosEmptyState` is the K-212 runtime pilot for an empty vault. It carries the "Notes / Living Cosmos" identity language.

Source-verified responsibilities:

- render empty-vault identity copy
- expose create note, open today's note, and import backup callbacks when available
- use CSS-only motif elements
- avoid image/SVG/font assets
- preserve hooks such as `data-notes-pixel-cosmos-empty`, `data-product-empty="vault-empty"`, and K-212/K-127 hooks

It has no persistence/data behavior. It is not a graph, canvas, node map, or navigation implementation.

Mobile note: K-212/K-213 tests confirm the mobile empty-vault layout hides the note list and lets the empty state take the editor pane width through the `isMobileEmptyVault` guard.

### 5. ProductEmptyState / Generic Empty-State Components

`ProductEmptyState` is a shared empty-state component with Tailwind and note-chrome variants. It supports icon, title, description, primary/secondary actions, children, and data hooks.

Source-verified Notes usage:

- `NoteSidebarVirtualList` uses it for no notes, no search results, and empty trash
- `NoteViewEditorArea` uses it for the non-empty select-a-note placeholder

`EmptyState` wraps `ProductEmptyState` for shared/older surfaces. No direct `EmptyState` use was found in the audited primary Notes path.

Future Cosmos empty states should reuse `ProductEmptyState` when the state is literal, such as no search results or select a note. The K-212 pixel-cosmos empty-vault component should remain reserved for true empty vault onboarding unless a later spec says otherwise.

### 6. NoteGraphView

`NoteGraphView` is the current full-area graph/relationship view. It is not a future-only concept; it is already shipped runtime UI.

Source-verified responsibilities:

- render a full-vault graph using SVG
- build graph data from `buildGlobalGraphData` and `knowledgeIndexService`
- support graph relationship filters for all, backlinks, mentions, and relations
- support search/matching, isolated-node toggle, zoom/pan, node selection, node drag, and preview panel
- include galaxy/orbit/universe/cosmos visual language and HUD
- use current notes, folders, active note id, dark mode, compact chrome, recent evolution, and shared discovery feed
- derive node metadata from current note/index state, including degree, title, folder, starred, updatedAt, importance/tier, galaxy, orbit, and backlink counts
- lazy-load through `NoteGraphViewLazy` with `ViewLoadingFallback`

Current limitations / risks visible from source:

- it is already a complex graph/cosmos-like surface
- it carries performance history through existing K-92 graph/cosmos audit tests
- it uses current UI state and derived graph layout, not persisted user-arranged positions
- it should not be duplicated by a new Cosmos Map without a decision spec

### 7. LocalGraphView / Context Graph

`LocalGraphView` is a separate current graph surface for local/context graph exploration around a selected note.

Source-verified responsibilities:

- render radial local/expanded graph data
- allow relationship filtering
- support node selection, double-click/open button navigation, expand/collapse of hop-one nodes, reset zoom, and pan/zoom
- show a literal empty state when the graph has no connected notes

This means future Cosmos work must account for both the full-vault `NoteGraphView` and the local/context `LocalGraphView`.

### 8. Loading / Skeleton / Error States

Source-verified loading state:

- `NoteGraphViewLazy` uses `ViewLoadingFallback`
- `AppContent` uses `ViewLoadingFallback` for lazy workspace loading

Source-verified error states in the audited Notes path are mostly operational rather than Cosmos-specific:

- `syncError` and `retrySync` are passed into the editor area
- attachment maintenance has its own diagnostics states, but K-216 does not audit attachment behavior beyond acknowledging the panel is hosted in the sidebar

Future pixel/cosmos work should not theme loading/error states before preserving clear status language.

## Current Graph / Cosmos / Knowledge Data Inventory

| Category | Audit classification | Source-grounded notes |
| --- | --- | --- |
| note id | Source-verified current runtime data | `NoteBase.id`, store selectors, graph node ids, navigation ids. |
| note title | Source-verified current runtime data | Used by list rows, editor title, wiki title resolution, graph labels. |
| note body/content | Source-verified current runtime data | Used by editor, previews, wiki link extraction, mentions, images. |
| createdAt | Source-verified current runtime data when present | Exists on `NoteBase`; used by trace/archive projections and preview context. |
| updatedAt | Source-verified current runtime data | Used for sorting, row dates, graph metadata, recency. |
| folderId | Source-verified current runtime data | Used by list filtering and graph color/grouping. |
| deletedAt | Source-verified current runtime data | Used for trash and active-note filtering. |
| starred | Source-verified current runtime data | Used by favorites/list rows and graph metadata. |
| properties | Source-verified current runtime data | Indexed by `KnowledgeIndexService`; includes tags and other string metadata. |
| tags / labels | Source-verified current runtime data via properties and derived indexes | `listTags`, tag panels, tag filters, shared-tag related scoring. |
| links / backlinks | Derived current runtime data | Extracted from `[[...]]` links and indexed by `KnowledgeIndexService`. |
| mentions | Derived current runtime data | Plain-text mention indexing in `KnowledgeIndexService`. |
| explicit relationship edges | Source-verified current runtime data plus derived graph edges | `relations` stored on notes; graph edges derived from relation index. |
| attachments | Source-verified current runtime data outside Cosmos scope | Notes host image attachments and maintenance panel; K-216 does not change it. |
| graph data derivation | Derived current runtime data | `buildGlobalGraphData`, `buildExpandedGraphData`, `buildNoteNeighborhood`, `LocalGraphView`, `NoteGraphView`. |
| selected note state | Current UI/store state | `activeNoteId`, active note selector, navigation stack. |
| search/filter state | Current UI state only | `searchQuery`, `sidebarSearchQuery`, `noteListFilter`, `activeTag`, workspace activation. |
| empty vault state | Derived current runtime state | `activeNoteCount === 0 && activeFolderId !== 'trash'`. |
| mobile viewport state | Current UI state/hook result | `useViewportLayout`, `isMobile`, `isTablet`, `mobileShowEditor`, `mobileSidebarOpen`. |
| persisted node positions | Not found in audited sources; requires separate schema/persistence spec if added | Current graph positions appear computed/runtime; any persistence requires separate spec. |
| account-age / satellite-distance data | Not found in audited Notes sources | Future concept only; better suited to Archive/Voyager. |
| archive/time-distance data | Future concept for Notes; current Archive/trace projections exist elsewhere | Do not import Archive/Voyager semantics into active Notes by default. |
| AI cluster data | Not found in audited sources | Future concept only; requires separate product/data/privacy spec. |

Classification note: Requires separate schema/persistence spec applies to any future field that changes persisted note, graph, spatial, account-age, archive, or AI cluster data before implementation.

## NoteGraphView vs Future Cosmos Map Audit

NoteGraphView is the current shipped graph-related surface. Future Cosmos Map is not implemented by K-216 and should not be assumed to replace NoteGraphView.

Future work must decide whether Cosmos Map:

1. visually reinterprets NoteGraphView,
2. wraps NoteGraphView in a broader landing/preview,
3. becomes a separate exploratory mode,
4. or replaces NoteGraphView after a separate migration/implementation spec.

K-216 does not choose a replacement path. The current source shows enough graph/cosmos behavior that choosing a replacement would be premature without a focused decision spec.

Boundary:

- Avoid duplicate graph/navigation responsibilities.
- Do not create a second full-vault graph that competes with NoteGraphView.
- Do not create a second local graph that competes with LocalGraphView.
- Do not move editor/search/list responsibilities into Cosmos.
- Do not persist spatial/layout data without a separate data spec.

## Empty-State Findings

Current Notes has several distinct empty or placeholder states. They should not be collapsed into one metaphor.

### No Notes / Empty Vault

The empty vault state uses `NotesPixelCosmosEmptyState`. It can carry pixel-cosmos identity because it is onboarding the entire Notes workspace.

### No Search Results

The note list search-empty state uses `ProductEmptyState` in `NoteSidebarVirtualList` with search-focused copy and a clear-query action. It should remain literal and search-focused.

### Select A Note Placeholder

The non-empty, no-active-note editor placeholder uses `ProductEmptyState` in `NoteViewEditorArea`. It can show recent traces and actions, but it should remain action-oriented and should not imply the vault is empty.

### Empty Trash

The trash list empty state uses `ProductEmptyState` with trash-specific copy. It should remain literal.

### Graph Empty / No Connected Notes

`LocalGraphView` shows a literal text state when the local graph has no connected notes. `NoteGraphView` also has empty-universe onboarding for no notes or no links. These are graph-specific and should not be merged with list/search empty states without a separate spec.

### Loading State

`ViewLoadingFallback` handles lazy loading for the graph and workspace loading. Loading states should remain explicit before visual theming.

### Error State

K-216 did not find a single Cosmos-specific error state in the audited Notes graph path. Sync and attachment diagnostics are separate operational surfaces and require source verification before implementation if future Cosmos wants to surface errors.

Rules:

- Do not collapse all empty states into one metaphor.
- No-notes empty state can carry pixel-cosmos identity.
- No-results empty state should remain literal/search-focused.
- Select-a-note placeholder should remain action-oriented and not imply empty vault.
- Loading/error states should remain clear before visual theming.

## Current Mobile / Responsive Findings

Source-verified mobile behavior:

- `useViewportLayout` provides `isMobile` and `isTablet`
- `isCompactChrome = isMobile || isTablet`
- tablet collapses sidebar through `if (isTablet && !isMobile) setSidebarCollapsed(true)`
- active note selection toggles `mobileShowEditor`
- mobile scope changes close the mobile sidebar
- mobile empty vault uses `isMobileEmptyVault` to hide the note list and keep the empty state full-width
- graph components receive `compactChrome` on mobile/tablet
- mobile editor back behavior returns to list unless note navigation/history applies

Risks for future Cosmos work:

- mobile must not be treated as a smaller desktop graph
- full graph/canvas interaction needs a separate mobile navigation/accessibility plan
- future Cosmos preview needs a mobile fallback before interactive launch
- empty-vault mobile behavior is sensitive because it intentionally hides the note list
- selected-note and empty-vault states should not be confused on small screens

## Runtime Risk Findings

- NoteGraphView responsibilities may overlap with Cosmos Map if future work is not scoped.
- LocalGraphView adds a second current graph surface, so future Cosmos must account for full-vault and local/context graph ownership.
- Notes empty states can be confused if no-notes, no-results, select-a-note, graph-empty, loading, and error states are merged.
- Mobile layout is sensitive, especially empty-vault behavior.
- Relationship data may be missing or derived; future implementation should prefer explicit/observable data before inference.
- Persisted spatial metadata was not found in audited sources.
- Graph/canvas implementation could pressure persistence/schema changes.
- Time/Voyager concepts could overload active Notes if not kept to Archive.
- Home Signal Board concept should not become another graph.
- Existing graph performance tests indicate graph rendering has meaningful cost; a new Cosmos surface must not duplicate that cost casually.

## Implementation-Safe Next Options

### Preferred: K-217 Notes/Cosmos Static Preview Plan

Scope:

- docs/plan only
- uses K-216 audit findings
- chooses where a non-interactive preview could live
- decides whether preview is empty-state-adjacent, dashboard-adjacent, graph-adjacent, or context-panel-adjacent
- no runtime implementation yet
- no persistence changes

### Alternative: K-217 NoteGraphView/Cosmos Relationship Decision Spec

Use this if the team wants to resolve ambiguity before preview planning. It should decide whether Cosmos reuses, wraps, replaces, or separates from NoteGraphView and LocalGraphView.

### Alternative: K-217 Notes Empty State / Select-a-note State Boundary Polish

Use this only if empty states are confusing in review. This should remain small and should not implement Cosmos Map.

## Recommended Next PR

Recommended K-217 target: **K-217 NoteGraphView/Cosmos Relationship Decision Spec**.

Reason: K-216 found that the current code already contains a substantial full-vault `NoteGraphView`, a local/context `LocalGraphView`, current cosmos/universe graph language, and graph performance audit history. The NoteGraphView/Cosmos relationship remains ambiguous enough that a decision spec should happen before even a static preview plan.

If reviewers decide current graph ownership is already clear enough, the fallback next step is **K-217 Notes/Cosmos Static Preview Plan**.

## Non-Goals

- no runtime UI implementation in K-216
- no NoteView changes
- no NoteGraphView changes
- no NotesPixelCosmosEmptyState changes
- no ProductEmptyState changes
- no graph/canvas/navigation implementation
- no node/orbit interaction
- no Archive/Voyager implementation
- no Home Signal Board implementation
- no editor changes
- no note persistence changes
- no routing changes
- no stores/schemas/providers changes
- no generated assets
- no fonts
- no dependencies
- no global theme rollout
- no Health/Schedule changes
- no attachment/OAuth/Supabase changes
- no Google Drive QA work

## Closure Statement

K-216 audits current Notes surfaces and identifies the safe boundary for future Cosmos work. Future implementation must not duplicate NoteGraphView responsibilities. Future Cosmos work must proceed through a static preview plan or explicit NoteGraphView/Cosmos decision spec. No graph/canvas implementation should start until current surface responsibilities are clear.
