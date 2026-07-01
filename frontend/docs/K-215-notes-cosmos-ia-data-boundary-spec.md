# K-215 Notes/Cosmos IA and Data Boundary Spec

## Purpose

K-215 translates the K-214 Notes/Cosmos concept into information architecture and data boundaries. It exists before any new Notes/Cosmos implementation so future work does not accidentally widen into graph, canvas, navigation, persistence, or schema rewrites.

K-215 is docs/spec only. K-215 does not implement runtime UI. K-215 does not change the data model, stores, providers, persistence, routing, editor behavior, graph behavior, assets, fonts, or dependencies.

The goal is to define what is current runtime, what is an existing shipped surface, what is a future concept, and what is not yet implemented.

## Current Shipped Notes Surfaces

This section is based on source inspection of the current Notes runtime. It is a boundary snapshot, not an implementation request.

### Notes List / Editor Surface

Current runtime: `NoteView` is the primary Notes workspace shell. It owns the list/editor workflow through `NoteViewSidebar`, `NoteViewEditorArea`, `useNoteViewState`, `useNoteViewActions`, and the shared Notes store.

Existing shipped surface responsibilities:

- create, open, edit, duplicate, star, trash, restore, and permanently delete notes
- browse folders, trash, favorites, recent notes, tags, saved views, collections, database views, focus workspaces, and trace lenses
- search and filter the sidebar note list through `sidebarSearchQuery`, `noteListFilter`, `activeFolderId`, `activeTag`, and knowledge-query helpers
- edit note title/body through the existing editor area and BlockEditor integration
- expose the context panel with table of contents, links, graph, discover, properties, insights, actions, timeline, tags, relations, and stats tabs

K-215 does not change these behaviors.

### Notes Empty State Pixel-Cosmos Pilot

Current runtime: `NotesPixelCosmosEmptyState` is the K-212 empty-vault pixel-cosmos pilot. It is an onboarding/identity surface for the empty Notes workspace.

Existing shipped surface responsibilities:

- show the "Notes / Living Cosmos" identity in the empty vault state
- offer compact actions such as create note, open today's note, and import backup when available
- remain a static empty-state component, not a graph, canvas, node map, or navigation system

K-215 does not change this component.

### Existing NoteGraphView

Current runtime: `NoteGraphView` is an existing shipped graph/relationship view. It is reachable from the Notes graph view mode and from graph/context paths in the Notes workspace.

Existing shipped surface responsibilities visible from source inspection:

- render a full-vault graph from `buildGlobalGraphData` and `knowledgeIndexService`
- use SVG, zoom/pan controls, node selection, search, relationship filters, galaxy/orbit visual layers, and a universe/cosmos view mode
- derive graph nodes and edges from current indexed note relationships
- expose relationship filters for backlinks, mentions, relations, and all relationships
- use current note metadata such as title, folder, starred state, updatedAt, and derived graph degree/importance/tier data
- display HUD, discovery, empty-universe, and preview-panel concepts tied to current graph data

Current data inputs used by `NoteGraphView` include `notes`, `folders`, `activeNoteId`, `onSelect`, current app theme, `knowledgeIndexService`, `buildGlobalGraphData`, `buildCosmosVaultAnalysis`, `buildDiscoveryRefreshBundle`, graph relationship filters, and store version counters.

Important boundary: because `NoteGraphView` already uses graph/cosmos/universe language and is already shipped, future Cosmos Map work must treat it as an existing product surface, not as a blank space.

### Current Note Relationship Inputs

Current runtime data and derived indexes include:

- wiki-style links from note body text, extracted from `[[...]]`
- incoming and outgoing backlinks derived by `KnowledgeIndexService`
- plain-text mentions derived by the knowledge index
- tags stored in note `properties.tags` and derived through tag helpers
- explicit relations stored in note `relations` as property key to target note ids
- shared-tag and relationship scoring derived at render/index time
- local graph and expanded graph data derived from the knowledge index

K-215 does not add relationship fields or persist graph layout.

## Existing NoteGraphView Relationship To Future Cosmos Map

Existing NoteGraphView remains the current shipped graph/relationship view.

Future Cosmos Map is a broader product concept, not automatically a replacement for NoteGraphView. Cosmos Map may later reuse, wrap, visually reinterpret, or replace NoteGraphView, but only after a separate implementation spec chooses that direction.

K-215 does not choose a final implementation path because the source already contains meaningful graph/cosmos behavior. The safe decision path is:

1. audit the current NoteGraphView responsibilities in detail
2. decide whether Cosmos Map is a visual redesign of NoteGraphView
3. decide whether Cosmos Map is a higher-level landing/preview around NoteGraphView
4. decide whether Cosmos Map is a separate exploratory mode
5. decide whether Cosmos Map is a future replacement after migration

Future work must avoid duplicate graph/navigation responsibilities. Do not create two competing graph surfaces unless an IA spec defines which surface owns global graph navigation, local graph navigation, search, selection, editor handoff, mobile fallback, and accessibility.

Until that separate implementation decision exists:

- NoteGraphView owns the current shipped graph behavior.
- Cosmos Map is a future concept and not yet implemented as a separate surface.
- Cosmos language in empty states and current graph code does not authorize a new graph engine.
- A future Cosmos preview must be layered, optional, and reversible.

## Notes IA Boundary

Core Notes surfaces:

- list/search/filter
- editor/detail
- empty state
- current graph view
- future Cosmos preview/map

Responsibilities:

| Surface | Responsibility | Boundary |
| --- | --- | --- |
| List/search/filter | Fast retrieval and management | Must remain the baseline way to find notes. |
| Editor/detail | Writing, editing, reading, and note-level actions | Must remain reachable from every exploratory layer. |
| Empty state | Onboarding and product identity seed | Must not become a hidden setup wizard or graph engine. |
| NoteGraphView | Current relationship visualization | Must not be duplicated by another graph surface without an IA decision. |
| Future Cosmos Map | Broader pixel-cosmos relationship and meaning exploration | Not yet implemented; must stay optional until proven. |

Rules:

- Cosmos must not replace list/editor.
- Cosmos must not make note creation, opening, editing, or search slower.
- Cosmos must remain optional or layered until proven.
- Cosmos must not hide the editor.
- Cosmos must have a list fallback.
- Cosmos must not turn Notes into a dashboard.
- Cosmos must not treat metaphor as navigation unless navigation is accessible and reversible.

## Cross-Surface IA Boundary

### Home = Signal Board

Home is the present signal surface. It should show current summaries, recent traces, and "what changed" signals. Home should not become full graph navigation and should not become a second Notes graph.

### Notes = Cosmos Map / Living Cosmos

Notes is the meaning, relationship, and current thought space. It owns active notes, writing, links, tags, relations, clusters, and the future Cosmos concept. It is not the primary time-distance archive.

### Archive = Voyager View / Time-Distance Archive

Archive is the past-record surface. Archive owns the stronger Voyager / Pale Blue Dot metaphor, time as distance, resurfacing old signals, and deep historical context. Do not mix Archive's time-distance concept into Notes runtime by default.

### Attachments = Inventory Bay

Attachments represent file, capsule, item, local blob, remote blob, sync, upload, recovery, and maintenance status. Attachment work should remain separate from Notes/Cosmos IA unless a note needs to show attachment co-occurrence as derived context.

### Health = Status Core

Health is body, routine, workout, and accumulated rhythm. It remains workout-first and should not become a graph/cosmos surface.

### Schedule = Mission Orbit

Schedule is future time, events, routines, and timetable paths. Schedule should not become a graph/cosmos surface and should not inherit Notes graph navigation.

## Data Inventory

| Category | Current status | Notes/Cosmos boundary |
| --- | --- | --- |
| note id | Current runtime data | May identify nodes; already persisted as note identity. |
| note title | Current runtime data | May label nodes and search results. |
| note body/content | Current runtime data | Source for writing, wiki links, mentions, and rendered content. |
| createdAt | Current runtime data when present | May support light freshness/trace context; not a distance mechanic by default. |
| updatedAt | Current runtime data | May support recent edit pulse or sorting; not enough for Voyager distance in Notes. |
| folderId | Current runtime data | May color/group current graph nodes; not a Cosmos schema change. |
| deletedAt | Current runtime data | Excludes trashed notes from active graph/list surfaces unless a separate trash/archive spec says otherwise. |
| starred | Current runtime data | May be shown as importance or favorite state; not a graph layout rule by itself. |
| properties | Current runtime data | Existing string metadata container; no new K-215 fields. |
| tags/labels | Current runtime data through `properties.tags` and derived indexes | Useful for clusters; explicit/observable relationship source. |
| links/backlinks | Derived at render/index time from note body wiki links | Current relationship source; safe early Cosmos input. |
| mentions | Derived at render/index time | Current relationship source; must remain explainable. |
| explicit relations | Current runtime data in `relations` | Strongest explicit graph relationship source. |
| attachments | Current runtime data in attachment metadata systems and note content references | Possible future co-occurrence input; not part of K-215 implementation. |
| search/filter state | Current runtime UI state | Must remain available outside any Cosmos view. |
| graph layout positions | Derived UI state in current graph runtime | No persisted node positions in K-215. |
| graph view mode | Existing UI preference/runtime behavior in NoteGraphView | Do not broaden without implementation spec. |
| user account age | Out of scope / not a Notes data field | Better suited to Archive/Voyager than Notes. |
| archive status | Partly represented through trace/archive projections, not a Notes/Cosmos field | Do not add Archive/Voyager data model inside Notes by default. |
| resurfacing/echo state | Future derived data | Requires product/spec decision before persistence. |
| AI clusters | Out of scope | Requires explicit opt-in, privacy, explainability, and data-boundary spec. |
| spatial node positions | Future data if persisted | Requires separate schema/persistence/migration spec. |

If a future implementation needs a detail not listed here, it requires source verification before implementation.

## Data Boundary Rules

- Local-first Notes remain source of truth.
- No remote-first graph hydration.
- No full-vault remote graph replacement.
- No large graph persistence without a spec.
- No new Note fields in K-215.
- No graph layout persistence without a migration plan.
- No persisted node positions without separate spec.
- No account-age satellite distance in Notes without product decision.
- No automatic AI clustering without explicit user control and a separate spec.
- No relationship inference that cannot be explained or reversed.
- No Archive/Voyager data model inside Notes by default.
- No Supabase sync changes.
- No IndexedDB migration.
- No schema/provider/store changes.
- No new persistence keys.
- No new background sync behavior.

## Relationship Model Options

K-215 defines possible future relationship models without implementing them.

### 1. Explicit Links

User-created wiki links and backlinks are the safest early relationship source. They are visible in note content, user-controlled, and explainable.

### 2. Tags / Topics

Tags and topics can create clusters from user labels. They are useful for group visualization because they already map to observable user intent.

### 3. Temporal Adjacency

Notes created or edited near each other can suggest proximity. This may be useful, but it should not dominate Notes because time-distance belongs more strongly to Archive.

### 4. Attachment Co-occurrence

Notes sharing files, images, or PDFs can imply context. This should remain derived and optional until attachment metadata behavior is explicitly included in a future spec.

### 5. Search / Session Context

Notes visited, searched, or opened together can imply workflow context. This requires a privacy and product decision before persistence or durable inference.

### 6. AI Semantic Clustering

AI semantic clustering may be powerful, but it is not a default relationship source. It requires explicit opt-in, local/remote boundary decisions, explainability, reversibility, and separate design.

Recommendation: early Cosmos should prefer explicit/observable relationships before opaque AI inference.

## Spatial / Visual Metadata Boundary

Future Cosmos may need spatial metadata, but K-215 does not add it.

Possible options:

- no persisted positions: layout computed each render
- local UI-only layout cache
- persisted user-arranged layout
- derived cluster layout
- imported or adapted from current NoteGraphView if a future spec proves that is safe

Boundary:

- K-215 does not add spatial metadata.
- Any persisted node position requires a separate data model and migration spec.
- Computed/non-persistent layout is safest for a first preview.
- Mobile fallback must be designed before persistent layout.
- Current NoteGraphView layout behavior must be audited before any Cosmos layout persistence proposal.

## Time / Voyager Boundary

Time is a main Absinthe concept, but each surface owns a different expression of time.

Notes can show freshness and activity lightly:

- recent edit pulse
- resurfaced signal indicator
- stale or dimmed optional cue
- relationship age as secondary metadata

Archive should carry the strong time-distance/Voyager metaphor. Account-age satellite distance is better suited to Archive than Notes. Notes should not make active notes feel far away simply because they are old.

Home may later surface old signals as echoes. Schedule handles future time. Health handles accumulated body rhythm and routine time.

Not allowed in Notes without separate spec:

- account-age zoom-out mechanic in active Notes
- automatic deep-time archive migration
- making note access harder based on age
- replacing list sort with visual distance
- moving Archive/Voyager semantics into the active editor workflow

## Accessibility / Navigation Boundary

Any future node map must satisfy these requirements before interactive launch:

- keyboard navigation required for nodes
- list fallback required
- screen-reader labels required for nodes and edges
- search/filter remains available
- editor remains reachable
- visible focus for selected nodes
- zoom/pan controls must be keyboard accessible
- reduced motion support
- no color-only node/status meaning
- mobile fallback required before interactive launch
- no tiny node-only hit targets
- graph/canvas must have a non-canvas fallback or accessible equivalent

The list/editor remains the baseline accessibility path. A Cosmos layer can enhance discovery, but it must not strand keyboard, screen-reader, reduced-motion, or mobile users.

## Future Implementation Phases

- K-215: Notes/Cosmos IA and Data Boundary Spec
- K-216: Notes/Cosmos Current Surface Audit
- K-217: Notes/Cosmos Static Preview Plan
- K-218: Notes/Cosmos Accessibility and Navigation Plan
- K-219: Notes/Cosmos Non-Interactive Static Preview Pilot
- K-220: Notes/Cosmos Minimal Interactive Pilot

Do not jump directly to full graph/canvas implementation. The first implementation should be a non-interactive/static preview or a current-surface audit. Persistence and data changes require a separate spec.

## Recommended Next PR

Recommended K-216 target: **K-216 Notes/Cosmos Current Surface Audit**.

Reason:

- K-215 defines IA and data boundaries.
- K-216 should inspect current NoteGraphView, Notes empty state, list/editor/search, tests, graph data builders, knowledge index paths, and runtime navigation in detail.
- K-216 should determine the safest static preview path.
- This avoids implementing Cosmos on top of uncertain current graph responsibilities.

Alternative: **K-216 Notes/Cosmos Static Preview Plan**.

Use the alternative only if the current surface audit is already sufficient. The plan must remain non-interactive and must not change persistence, editor, routing, graph engine, assets, fonts, or dependencies.

## Non-Goals

- no runtime UI implementation in K-215
- no NoteGraphView changes
- no NoteView changes
- no NotesPixelCosmosEmptyState changes
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

K-215 establishes IA and data boundaries for future Notes/Cosmos work. Existing NoteGraphView remains current shipped graph functionality until a separate implementation spec says otherwise. Future Cosmos work must avoid duplicating NoteGraphView responsibilities. Future implementation must be narrow, reversible, and accessible. Notes/Cosmos should proceed through current-surface audit before any graph/canvas pilot.
