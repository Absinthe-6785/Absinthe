# K-44 Knowledge History

**Branch:** `k44-knowledge-history`

---

## Goal

Add a deterministic, local-only Knowledge History layer so Cosmos and Timeline can represent **actual** knowledge growth — not only inferred snapshots from `createdAt` / current graph state.

---

## Architecture

```
frontend/src/components/views/features/knowledge/history/
├── eventTypes.ts       # Event model + summary types
├── historyStorage.ts   # Versioned localStorage persistence
├── historyRecorder.ts  # Append-only recording API
├── historyQueries.ts   # Read/query helpers (no UI)
└── index.ts
```

**Storage key:** `absinthe:knowledge-history:v1`  
**Cap:** `MAX_HISTORY_EVENTS = 5000` (oldest trimmed)

---

## Event types

| Type | Trigger |
|------|---------|
| `NOTE_CREATED` | `createNote`, `duplicateNote` |
| `NOTE_DELETED` | `permanentDeleteNote` |
| `LINK_CREATED` | Wiki link added to note body |
| `LINK_REMOVED` | Wiki link removed from body |
| `AREA_ASSIGNED` | `area` property set/changed |
| `AREA_REMOVED` | `area` property cleared |
| `HUB_CREATED` | Note becomes area hub |
| `DISCOVERY_RESOLVED` | K-37 Actions / Discover resolution handlers |

---

## Integrations

| Surface | Change |
|---------|--------|
| `useNotesStore` | Records create/update/delete diffs |
| `NoteView` | Passes history to timeline, discovery, dashboard, insights |
| `buildKnowledgeTimeline` | Event-based growth when history exists; K-42 fallback otherwise |
| `buildDiscoveryFeed` | History confidence boosts (no new categories) |
| `CosmosInsightsPanel` | First seen, last linked, activity score |
| `KnowledgeActivityCard` | Dashboard 30-day summary |

---

## Limitations

- History starts at K-44 install — no backfill for pre-existing vaults
- localStorage only (per browser, not synced)
- Trash delete does not emit `NOTE_DELETED` (permanent delete only)
- Relation edges (non-wiki) are not `LINK_*` events unless they add `[[wiki]]` tokens

See companion docs for timeline upgrade, discovery, dashboard, and validation.
