# K-67 Breadcrumb

## Design

Lightweight session breadcrumb — no URL or router changes.

### Storage

`sessionStorage` key `absinthe.noteNav.breadcrumb`:

```json
[
  { "type": "key", "key": "archiveHomeTitle" },
  { "type": "key", "key": "archiveRecentMilestonesTitle" }
]
```

Segments:

- `{ type: 'key', key: TranslationKey }` — resolved via `t()` at render time
- `{ type: 'label', label: string }` — plain text (e.g. planner countdown name)

### API (`lib/noteBreadcrumb.ts`)

| Function | Purpose |
|----------|---------|
| `setNoteBreadcrumb(segments)` | Replace trail |
| `getNoteBreadcrumb()` | Read current |
| `clearNoteBreadcrumb()` | Remove |
| `subscribeNoteBreadcrumb(fn)` | React/store sync |

Set automatically by `openNote` / `navigateToNote` when `breadcrumb` option is provided.

### UI (`NoteBreadcrumbBar`)

Rendered below the note header in `NoteViewEditorArea`:

- Joins breadcrumb segments with chevrons
- Appends current note title as final segment
- `aria-label` from `nvBreadcrumb`

## Example trails

| Flow | Trail |
|------|-------|
| Health workout day log | Health → Workout → Open day log → `2026-06-14` |
| Schedule countdown note | Schedule → Countdowns → [event title] |
| Cosmos graph pick | Cosmos → [note title] |
| Archive milestone | Archive → Recent transitions → [note title] |
| Discovery panel | Today's discoveries → [note title] |
| Timeline panel | Timeline → [note title] |

## i18n keys added

- `nvBreadcrumb` — aria label
- `nvReturnToArchive` — analytics return chip

## Tests

`noteBreadcrumb.test.ts` — persist, clear, subscribe

## Future (K-68)

Make non-terminal segments tappable to jump back to originating workspace views.
