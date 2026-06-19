# K-116 — Real Usage Debt Cleanup

UX polish from real-world use after K-115 RC. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

**Branch:** `k116-real-usage-cleanup`

---

## Summary

| Area | Before | After |
|------|--------|-------|
| Sort menu | Wide panel, no outside dismiss | 220px max, backdrop dismiss, Esc, focus trap, mobile sheet |
| Protein UI | White/gray hardcoded | `--bg-panel`, `--text-primary`, `--border-color` tokens |
| Workspaces | Auto subject tabs (일본사, 정치, …) | User rule collections; legacy pinned subjects kept |
| Image copy | Text/URL only | `image/png` + `text/html` + `text/plain` for single image |
| Image preview | `!image(data:image/png;base64,...)` | `Image`, `Screenshot`, or caption |
| Smart collections | Many 0-count rows + icons | Empty rows hidden; icons reduced when list is long |

---

## A — Floating menus & popovers

**File:** `NoteListSortMenu.tsx`

- `SORT_MENU_MAX_WIDTH_PX = 220`
- Desktop: invisible backdrop (`data-k116-sort-backdrop`) closes on click
- Esc closes (menu + global keyboard handler)
- Tab focus trap within menu
- Mobile: bottom sheet unchanged (`data-k104-sort-sheet`)

**Audit:** `k116PopoverAudit.ts`

---

## B — Protein theme consistency

**File:** `ProteinTracker.tsx`, `index.css`

CSS aliases:

```css
--bg-panel: var(--color-surface);
--text-primary: var(--color-text);
--border-color: var(--color-border);
```

Replaced `bg-gray-*`, `border-gray-*`, `hover:bg-gray-800` with `bg-surface-alt`, `border-border`, `theme.input`, `hover:opacity-90`.

**Audit:** `k116NutritionThemeAudit.ts`

---

## C — User-owned workspaces

**Removed from sidebar**

- Automatic display of all `subject-*` smart collections
- `subjects` group in `SMART_COLLECTION_GROUPS`
- Per-subject built-in Lucide icons

**Kept for migration**

- `subject-*` entries in `SMART_COLLECTIONS` (pinned refs still resolve)
- `evaluateSmartCollection` subject cases

**User workflows**

- Create / rename / delete: **Rule collections** (`RuleCollectionsSection`)
- Reorder: `reorderRuleCollections()` + pin reorder on dashboard
- Auto subject dashboard card removed (`buildAllSubjectWorkspaces` no longer called)

**Audit:** `k116WorkspaceAudit.ts`, `sidebarSmartCollections.ts`

---

## D — Image clipboard

**Files:** `blockCopy.ts`, `copyToClipboard.ts`

Single selected image block with `src`:

1. Sync `text/html` + compact `text/plain` (`formatImageDisplayLabel`)
2. Async `ClipboardItem` with `image/png` via `copyBlocksToClipboard`

Paste targets: Discord, Slack, KakaoTalk, Obsidian, browsers (Clipboard API permitting).

**Audit:** `k116ImageClipboardAudit.ts`

---

## E — Image preview simplification

**File:** `blockUtils.ts` — `formatImageDisplayLabel`, `formatImageMarkdownAlt`

Priority: caption → safe alt → filename → `Screenshot` / `Image` / `Image (n)`

Markdown export uses compact alt; data URLs never appear in alt text.

**Audit:** `k116ImagePreviewAudit.ts`

---

## F — Smart collections cleanup

**File:** `SmartCollectionsSection.tsx`

- `hideZeroCount` (default true): hide rows with 0 notes unless active or pinned
- Empty groups collapsed
- Icons hidden when primary list has more than 8 items

**Audit:** `k116CollectionAudit.ts`

---

## G — Responsive sizing

- Sort menu capped at 220px
- Block context menu uses `computeFixedMenuPosition`
- Editor header actions remain 24px with 44px mobile targets

**Audit:** `k116ResponsiveAudit.ts`

---

## Migration notes

1. **Pinned subject workspaces** — Still work; pin state unchanged.
2. **Unpinned subject presets** — No longer listed in sidebar; create a rule collection (e.g. `tag:politics`) instead.
3. **Dashboard subject tabs** — Removed; use rule collections or tags.
4. **Existing notes** — Image markdown on disk unchanged; display/copy uses new labels.

---

## UX debt checklist

- [x] Sort menu dismisses on outside click
- [x] Sort menu Esc + focus trap
- [x] Protein panels follow global theme
- [x] No auto-generated subject workspace list
- [x] Image Ctrl+C includes PNG
- [x] Image previews show concise labels
- [x] Smart collections hide zero-count clutter
- [x] Menu widths bounded

---

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm test -- k116
```

---

## Known limitations

1. **Image PNG copy** requires secure context + `ClipboardItem` support; falls back to text/html + plain.
2. **Rule collections vs smart collections** — Two concepts remain; subjects merged into rule-collection workflow.
3. **Screenshots** — Before/after captures are manual (no CI visual diff in this pass).
