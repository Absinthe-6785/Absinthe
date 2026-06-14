# K-44 History Architecture

---

## Layer boundaries

```
useNotesStore / NoteView handlers
        ↓ record*
historyRecorder → historyStorage (localStorage)
        ↓ load
historyQueries → timeline / discovery / insights / dashboard
```

**No UI in history layer.** Components consume query results only.

---

## Persistence

```typescript
interface KnowledgeHistoryPayload {
  version: 1;
  events: KnowledgeHistoryEvent[];
}
```

- Safe JSON parse with empty fallback
- Invalid events filtered on load
- Trim to 5000 on save; retry with half cap if quota exceeded
- `subscribeKnowledgeHistory()` notifies React memos after writes
- `clearKnowledgeHistory()` on settings reset

---

## Recording strategy

**Diff-based** on `updateNote`:
- Compare `extractLinks(before.body)` vs `after.body`
- Compare `area` property before/after
- Detect hub transition via `isAreaNote`

**Explicit** on lifecycle:
- Create / duplicate → `NOTE_CREATED`
- Permanent delete → `NOTE_DELETED`
- Action handlers → `DISCOVERY_RESOLVED` with `metadata.action`

---

## Query API

| Function | Purpose |
|----------|---------|
| `getRecentEvents(limit)` | Latest events |
| `getEventsForNote(noteId)` | Note-scoped feed |
| `getEventsByType(type)` | Filter by type |
| `getEventsInWindow(start, end)` | Time range |
| `getActivitySummary(days)` | Dashboard card |
| `getGrowthMetrics(start, end)` | Timeline period growth |
| `getNoteHistoryContext(noteId)` | Insights panel |
| `hasRecordedHistory()` | Fallback gate |

---

## Migration

No migration from K-42 estimates. Empty history → full K-42 fallback. History accumulates forward from first K-44 session action.
