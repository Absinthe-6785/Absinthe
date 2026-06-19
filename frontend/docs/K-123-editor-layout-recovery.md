# K-123 — Editor Layout Recovery

Recover comfortable centered writing experience after K-122 search cleanup.

**Scope:** layout and CSS only. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

## K-122 regression

K-122 removed the always-visible header search bar and moved find-in-note to a temporary overlay. Side effects:

- Editor body lost horizontal centering cues on wide monitors
- Block gutters clipped against the left edge
- Toolbar stretched full viewport width
- Find panel anchored to screen edge instead of editor column

## Fixes

| Area | Change |
|------|--------|
| **Centering** | `k123-editor-column-shell` — max 1036px shell, `be-document` 980px centered |
| **Gutter** | 56px gutter column + matching `padding-left` on edit mode |
| **Toolbar** | `k123-editor-toolbar-shell` follows column width; Find button in toolbar |
| **Wide docs** | Column capped at 980px; images/tables may extend slightly on desktop |
| **Handles** | Wider menu hit pad; `overflow: visible` on edit root |
| **Find panel** | Desktop: floating top-right inside editor column; mobile: bottom sheet |

## Width guidelines

- **Writing column:** 980px (`K123_EDITOR_COLUMN_MAX_PX`)
- **Shell (column + gutter):** 1036px (`K123_EDITOR_SHELL_MAX_PX`)
- **Wide embeds:** up to `calc(var(--be-doc-width) + 80px)` on desktop
- **Mobile:** 100% width with 12px safe padding

## Block interaction zone

- Gutter: 56px left column per block row
- Drag strip inset: `-6px -10px` (unchanged)
- Handle menu: 20px invisible hit pad to the left
- Multi-select and gutter drag unchanged

## Before / after screenshots

> Capture manually after merge:
>
> - Desktop centered editor with visible gutters
> - Toolbar aligned to content column
> - Anchored find panel top-right in column
> - Mobile 375px — no horizontal scroll

## Verification

```powershell
npm run typecheck
npm test -- k123
npm test
npm run build
```

## Audit modules

| Letter | Module |
|--------|--------|
| A | `k123EditorCenterAudit.ts` |
| B | `k123BlockGutterAudit.ts` |
| C | `k123ToolbarAudit.ts` |
| D | `k123WidthAudit.ts` |
| E | `k123HandleAudit.ts` |
| F | `k123FindPanelAudit.ts` |
| G | `k123ResponsiveAudit.ts` |
