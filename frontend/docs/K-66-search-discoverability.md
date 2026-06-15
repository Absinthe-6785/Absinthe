# K-66 Search Discoverability

## Entry points audit

| Entry | Shortcut | Visibility (K-66) |
|-------|----------|---------------------|
| Sidebar note filter | — | Always in sidebar search input |
| Workspace palette | Ctrl+K | Desktop: button beside sidebar search |
| Workspace palette | Ctrl+K | Mobile: search icon in note list header |
| Workspace palette | Ctrl+K | Mobile hint: `nvSearchShortcutHint` under search row |
| In-note body search | Ctrl+F | Editor header (unchanged) |
| Cosmos graph filter | — | Graph toolbar (unchanged) |
| Shortcuts modal | — | Lists Ctrl+K (`nvScWorkspaceSearch`) |

## K-66 improvements

1. **Mobile workspace search button** — visible whenever `isMobile` in note list chrome (not only `compactChrome`).
2. **Ctrl+K hint** — one-line helper under sidebar search on mobile.
3. **Graph search empty** — tap overlay clears query (`nvClearQuery`).

## Unchanged (by design)

- No new search subsystem
- Ranking still `noteSearchScore` for sidebar + workspace (K-65)
- Cosmos uses highlight model, not ranked list

## i18n

- `nvSearchShortcutHint` — "Ctrl+K opens workspace search"

## K-67 candidates

- Global search trigger in app shell (outside Notes tab)
- `/` command palette pattern
