# K-57 Context Panel Architecture

Branch: `k57-noteview-knowledge-refactor`  
Date: 2026-06-15

## Overview

The note editor right panel ("context panel") is orchestrated by `KnowledgeContextPanel` (shell) and now rendered by `NoteContextPanelBody` (tab content). K-57 moves ~580 lines of tab-switch JSX out of `NoteView.tsx`.

```
NoteView.tsx
├── useNoteViewPanels()     → openContextPanel, handler callbacks
├── useNoteViewDashboard()  → history, timeline, evolution data
└── <KnowledgeContextPanel>
      └── <NoteContextPanelBody />   ← K-57 extraction
```

## Tab routing

`NoteContextPanelBody` switches on `rightPanel: KnowledgeContextTab`:

| Tab | Component(s) | Data source |
|-----|--------------|-------------|
| `toc` | `OutlinePanel` | `visibleToc`, scroll handlers |
| `links` | `LinksContextPanel`, backlink/reference panels | `knowledgeIndexService`, wiki targets |
| `graph` | `LocalGraphView` | `buildExpandedGraphData`, expand/collapse |
| `insights` | `CosmosInsightsPanel` | intelligence snapshot, history context |
| `actions` | `CosmosActionsPanel` | vault phase, connect/assign handlers |
| `discover` | `DiscoveryPanel` | discovery feed, relation creation |
| `timeline` | `TimelinePanel` | knowledge timeline, evolution exports |
| `properties` | `NotePropertiesPanel` | note properties CRUD |
| `tags` | `NoteTagsPanel` | tag list, folder/search navigation |
| `relations` | `NoteRelationsPanel` | resolved outgoing + incoming relations |
| Project/milestone | `ProjectEditorPanel`, `MilestoneEditorPanel` | academic models |

Tabs requiring an active note are guarded by `NOTE_REQUIRED_CONTEXT_TABS`.

## Data flow

```
useNotesStore ──► NoteView ──► useNoteViewPanels / useNoteViewDashboard
                                    │
                                    ▼
                         NoteContextPanelBody (props)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            knowledgeIndex    features/knowledge   history/
            Service           barrel imports       deep types
```

- **Handlers** (`navigateToWiki`, `handleCosmosConnect`, etc.) are defined in `useNoteViewPanels` / `useNoteViewActions` and passed down as props
- **Derived data** (concept hub, learning path, local graph) is computed in `NoteView` memos and passed as nullable props
- **Deep type imports** for history/export kinds use subpath imports to avoid pulling unused barrel surface

## Props contract

`NoteContextPanelBodyProps` is intentionally flat (~80 fields) to keep a single render function without intermediate context providers. Grouping candidates for K-58:

| Group | Fields (approx.) |
|-------|------------------|
| `linksData` | page refs, backlinks, related, bibliography |
| `cosmosData` | intelligence, history, evolution, journey |
| `projectData` | project editor, milestone editor |
| `navigation` | wiki navigate, open panel, folder/tag setters |

## Shell vs body boundary

| Layer | File | Role |
|-------|------|------|
| Shell | `KnowledgeContextPanel.tsx` | Tab strip, resize, mobile dismiss |
| Body | `NoteContextPanelBody.tsx` | Tab content rendering |
| Handlers | `useNoteViewPanels.ts` | Panel open/close, cosmos/link actions |
| Actions | `useNoteViewActions.ts` | Note mutations triggered from panel flows |

## Related docs

- [K-57-noteview-decomposition.md](./K-57-noteview-decomposition.md)
- [K-57-knowledge-module-review.md](./K-57-knowledge-module-review.md)
