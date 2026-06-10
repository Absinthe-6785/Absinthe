# Knowledge-17.75 — Gallery View Foundation

## Scope

Adds **Gallery** as a fifth database presentation on the existing `DatabaseView` + `presentationConfig` architecture. Phase 1 covers card grid layout, optional cover image URLs, configurable card fields, and note selection — no uploads, lightbox, masonry, or gallery-specific sorting/filtering.

## Architecture

```
DatabaseView { presentation: 'gallery', presentationConfig: DatabaseGalleryConfig }
        ↓
filterByDatabaseView → filterNotes (unchanged)
        ↓
prepareDatabaseGalleryItems → GalleryItem[]
        ↓
DatabaseGalleryView (responsive card grid)
        ↓
WorkspaceActivation { kind: 'database-view', id }
```

| Component | Role |
| --------- | ---- |
| `DatabaseGalleryConfig` | Persisted `coverProperty`, `cardFields`, optional `cardSize` |
| `prepareDatabaseGalleryItems` | Post-filter card resolution (cover + fields) |
| `GalleryItem` | Resolved card: noteId, title, coverImage?, fields[], tags? |
| `DatabaseGalleryView` | Responsive grid with cover placeholder fallback |
| `DatabaseNoteCard` | Reused for title/tags; extended with optional cover image |

## Config

```typescript
interface DatabaseGalleryConfig {
  type: 'gallery';
  coverProperty?: string;     // e.g. "coverImage"
  cardFields?: string[];      // e.g. ["status", "priority", "reviewDate"]
  cardSize?: 'compact' | 'medium' | 'large';
}
```

Defaults: `coverImage` / `['status', 'priority', 'reviewDate']`. Cover values must be `http://` or `https://` URLs in Phase 1. Invalid or missing covers show a placeholder when `coverProperty` is configured.

Card fields resolve via `getDatabaseFieldValue`, with rollup and formula column keys resolved through existing table config helpers.

## User capabilities

- Create database views as Table, Board, Calendar, Timeline, or Gallery
- Configure cover image property and comma-separated card fields
- Switch between all five presentations (table config preserved)
- Browse notes in a responsive card grid
- Click cards to open/select notes

## Deferred (not in K-17.75)

Image uploads/storage, lightbox, masonry layout, card resizing, grouping, gallery filters/sorting, gallery-specific formulas.

## Validation

- `npm run typecheck` PASS
- `npm test` PASS
- `npm run build` PASS
