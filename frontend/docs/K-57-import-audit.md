# K-57 Import Audit

Branch: `k57-noteview-knowledge-refactor`  
Date: 2026-06-15

## Path alias adoption

| Scope | `@/` imports (approx.) | Status |
|-------|-------------------------|--------|
| Planner calendar-ui | ~25 files | K-56 ✓ |
| Health panels + nutrition | 4 files | K-56 ✓ |
| Block editor menus/selection | 4 files | **K-57 partial** |
| Common dashboard | 1 file | K-56 ✓ |
| NoteView noteview hooks | 1 file (`useNoteViewDashboard`) | K-57 partial |

## Block editor migration (K-57 partial)

Migrated to `@/`:

| File | Alias used |
|------|------------|
| `SlashMenu.tsx` | `@/lib/i18n` |
| `WikiMenu.tsx` | `@/lib/i18n` |
| `BlockContextMenu.tsx` | `@/lib/i18n` |
| `SelectionToolbar.tsx` | `@/lib/i18n` |
| `slashCommands.ts` | `@/lib/i18n` |

Remaining deep imports in block-editor: test fixture path resolution only (`copyListener.test.ts` — 7 segments, acceptable for test).

## Knowledge module imports

### Barrel consumers (unchanged API)

These files import from `features/knowledge` root barrel — still valid after K-57 split:

| Consumer | Import style |
|----------|--------------|
| `NoteView.tsx` | Root barrel |
| `noteview/useNoteViewActions.ts` | Root barrel |
| `noteview/useNoteViewPanels.ts` | Root barrel |
| `noteview/useNoteViewState.ts` | Root barrel |
| `noteview/NoteContextPanelBody.tsx` | Root barrel + deep panel/history paths |
| `NoteGraphView.tsx` | Root barrel |
| `useNotesStore.ts` | Root barrel (`knowledgeIndexService`) |

### Deep imports still in use (acceptable)

| Path pattern | Count | Notes |
|--------------|-------|-------|
| `knowledge/components/*` | NoteContextPanelBody | Panel shell types |
| `knowledge/history` | NoteContextPanelBody, useNoteViewDashboard | History-specific types |
| `knowledge/cosmos/intelligence` | NoteContextPanelBody | Importance input type |

## Import depth audit (6+ segments)

| Area | Files | Status |
|------|-------|--------|
| Cosmos onboarding | 7 | K-58 target |
| Cosmos actions | 5 | K-58 target |
| Database view controls | 5 | K-58 target |
| Block editor (runtime) | 0 | **K-57 done** |

## Circular dependency check

| Edge | Result |
|------|--------|
| Domain barrels → root `index.ts` | None |
| Root → domain barrels → subfolders | One-way ✓ |
| `noteview/` → `features/knowledge` | One-way ✓ |
| `common/dashboard` → knowledge headers | Unchanged from K-56 |

## Convention going forward

1. New knowledge domain code: export through domain barrel (`maps/`, `academic/`, etc.), re-export at root
2. New files under `src/`: prefer `@/types`, `@/lib/i18n`, `@/hooks/*`
3. Cross-feature: `@/components/views/features/...` or feature root barrel
4. Panel-specific types: deep import from component file is OK when not part of public barrel

## Related docs

- [K-56-import-structure.md](./K-56-import-structure.md)
- [K-57-knowledge-module-review.md](./K-57-knowledge-module-review.md)
