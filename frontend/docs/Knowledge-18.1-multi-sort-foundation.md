# Knowledge-18.1 — Multi-Sort Foundation

## Scope

Adds multi-column sorting to Database Table views via `DatabaseViewSortRule[]` on `DatabaseTableConfig`, with lexicographic compare and full backward compatibility for legacy `sort`.

## Architecture

```
filterByDatabaseView
  ↓
resolveDatabaseViewSortRules(table)
  ↓
sortDatabaseViewRows(notes, sortRules, service, table)
  ↓
DatabaseTableView
```

| Component | Role |
| --------- | ---- |
| `DatabaseViewSortRule` | `{ key, direction }` ordered rule |
| `DatabaseTableConfig.sortRules` | Persisted multi-sort priority list |
| `DatabaseTableConfig.sort` | Legacy shorthand — synced to `sortRules[0]` |
| `sortDatabaseViewRows` | Lexicographic compare with per-row value cache |
| `DatabaseViewControls` | Priority list UI — add/remove/reorder rules |

## Backward compatibility

- Legacy views with `sort` only auto-migrate to `sortRules: [sort]` on load
- `sort` root field stays synced for old clients
- Single-rule behavior unchanged

## Supported sort keys

Built-ins (`title`, `updatedAt`, `tags`), custom properties, rollup columns, and formula columns — resolved via existing field helpers with values cached once per row.

## Validation

- `npm run typecheck` PASS
- `npm test` PASS
- `npm run build` PASS
