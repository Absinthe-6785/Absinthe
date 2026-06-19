# K-119 — Workspace Polish & Long-Term Maintainability

Branch: `k119-workspace-polish`

## Summary

K-119 unifies interaction primitives, tightens visual density, and adds a maintenance token layer after K-118 mobile/media work. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

## A — Global popover system

**Before:** Sort menu inlined outside-click, Escape, and focus-trap logic; other menus duplicated patterns.

**After:** Shared `PopoverRoot`, `PopoverPortal`, `PopoverDismiss`, and `PopoverPanel` in `components/common/popover/Popover.tsx`.

| Behavior | Implementation |
|----------|----------------|
| Outside click dismiss | `mousedown` on `data-k119-popover-dismiss` |
| Escape close | `UI_INTERACTION.escapeKey` |
| Focus trap | Tab wrap inside panel |
| Max width | `220px` via `UI_INTERACTION.popoverMaxWidthPx` |
| Mobile sheet | `PopoverDismiss variant="sheet"` + bottom panel |

`NoteListSortMenu` migrated to the shared popover stack (legacy `data-k104-*` / `data-k116-*` hooks preserved).

## B — Toolbar consistency

`WorkspaceToolbar` + `WorkspaceToolbarPrimary` standardize sticky workspace actions:

- 44px touch targets (`min-h-[44px]` + token)
- 16px icons, 2.5 stroke
- Focus-visible rings
- Planner sticky actions delegate to `WorkspaceToolbar`

Notes header actions read icon/gap sizes from `UI_INTERACTION`.

## C — Empty-state polish

`ProductEmptyState` uses `UI_DENSITY` tokens:

| Token | Value |
|-------|-------|
| Padding | 16px (was 24px) |
| Icon | 28px (was 32px) |
| Gap | 8px |

Tailwind variant: `p-4`, `mt-3`, `data-k119-empty-state`.

## D — Scroll behavior

`WorkspaceLayout`:

- `data-k119-workspace-layout` / `data-k119-scroll-primary`
- `overscroll-contain` on primary scroll zone
- Shared `WORKSPACE_GAP_CLASS` (`gap-3 lg:gap-4`)

Settings: `data-k119-settings-scroll`, reduced bottom padding on mobile.

## E — Settings cleanup

- Card radius `lg:rounded-[24px]`, padding `lg:p-5`
- Section spacing `space-y-3`
- Removed redundant sign-out description copy
- `data-k119-settings-card` on card sections

## F — Accessibility matrix

| Check | Status |
|-------|--------|
| Escape dismisses popovers | Yes |
| Focus trap in popovers | Yes |
| `role="dialog"` + `aria-modal` | Yes |
| 44px touch targets (toolbars) | Yes |
| `role="status"` empty states | Yes |
| Focus-visible rings | Yes |

## G — Typography & density

Density tokens in `uiDensityTokens.ts`; workspace gaps in `uiSpacingTokens.ts`. Settings headers keep `text-lg`; empty-state title `13px` (note-chrome).

## H — Performance observation

Reuses K-114 vault matrix (1000 / 3000 / 5000 / 10000 notes) and K-115 domain probes. Verifies search virtualization and gallery viewer remain wired — no K-118 regression surface removed.

## I — Maintenance layer

| File | Purpose |
|------|---------|
| `lib/uiInteractionTokens.ts` | Popover, focus, toolbar interaction |
| `lib/uiDensityTokens.ts` | Empty states, cards, tables |
| `lib/uiSpacingTokens.ts` | Workspace gaps, sticky toolbar spacing |

## Audits

```powershell
npm test -- k119
```

Files: `k119PopoverAudit.ts` … `k119TokenAudit.ts`, `k119Audits.test.ts`.

## Spacing matrix

| Surface | Mobile gap | Desktop gap |
|---------|------------|-------------|
| Workspace zones | 12px (`gap-3`) | 16px (`lg:gap-4`) |
| Settings sections | 12px | 16px |
| Empty state | 8px internal | 8px |
| Toolbar sticky | 8px bottom pad | 8px |

## Known limitations

- Block editor context menu still uses its own positioning (`computeFixedMenuPosition`); popover migration deferred to avoid editor regression risk.
- Health / Recipe / Search toolbars not fully migrated to `WorkspaceToolbar` — tokens applied where sticky patterns already exist.
- Performance audit is observational (synthetic matrix), not CI timing gates.

## Maintenance notes

1. New dropdowns: compose `PopoverRoot` → `PopoverPortal` → `PopoverDismiss` + `PopoverPanel`.
2. New sticky actions: use `WorkspaceToolbar` + `WorkspaceToolbarPrimary`.
3. Visual tweaks: prefer token edits in `ui*Tokens.ts` over scattered magic numbers.
4. K-116 popover audit updated to read `Popover.tsx` instead of inlined sort-menu logic.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm test -- k119
```

## Screenshots

_Screenshot placeholders — capture before/after in Notes sort menu, Settings cards, and empty states during QA._
