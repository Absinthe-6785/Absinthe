# K-122 — Search UX Recovery

Recover note search usability after K111–K121: lightweight, temporary search that dismisses naturally.

**Scope:** UX only. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

## Regressions addressed

| Issue | Fix |
|-------|-----|
| Always-visible global search in note header | Removed; global search opens only via shortcut, sidebar, or command palette |
| Duplicated search entry points | Single sidebar/global palette + separate find-in-note panel |
| Find panel stuck in editor toolbar | `FindInNotePanel` — temporary overlay (desktop bar / mobile sheet) |
| Weak match highlighting | Accent active match (`.be-search-hl-current`) + subtle other matches |
| No natural dismissal | Outside click, Esc, note switch, tab leave |

## Keyboard matrix

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Open find-in-note (focus input) |
| `Ctrl+Shift+F` | Open global workspace search palette |
| `Esc` (find open, query set) | Clear query |
| `Esc` (find open, empty) | Close find panel, restore editor focus |
| `Esc` (global search) | Close palette, restore previous focus |
| `Enter` / `Shift+Enter` | Next / previous match in find panel |

## Dismissal behavior

**Global search**

- Outside click on backdrop → close
- `Esc` → close (clear query on close)
- Selecting a result → navigate + close
- Focus returns to previously focused element (`useModalA11y`)

**Find in note**

- Outside pointer down → close + clear
- `Esc` → clear query, then close
- Close button → close + restore focus
- Open another note → dismiss
- Leave Notes tab → component unmount clears state

## Focus flow

1. User presses `Ctrl+F` → store `document.activeElement` → open panel → focus find input
2. User closes panel → restore stored element, or `scheduleEditorFocus` to editor
3. Global search uses modal focus trap while open

## Before / after screenshots

> Capture manually after merge:
>
> - Note header without search bar (New Note only)
> - Global search modal palette
> - Desktop find-in-note bar with match count
> - Mobile find-in-note bottom sheet
> - Active vs inactive search highlights

## Verification

```powershell
npm run typecheck
npm test -- k122
npm test
npm run build
```

## Audit modules

| Letter | Module |
|--------|--------|
| A | `k122GlobalSearchAudit.ts` |
| B | `k122SearchOverlayAudit.ts` |
| C | `k122FindInNoteAudit.ts` |
| D | `k122DismissAudit.ts` |
| E | `k122KeyboardAudit.ts` |
| F | `k122HighlightAudit.ts` |
| G | `k122SearchDensityAudit.ts` |
| H | `k122MobileAudit.ts` |
