# Sprint UX-2 — AI Paste & Block Selection (Planning)

**Branch:** `cursor/sprint-ux2-ai-paste-selection-aafa`  
**Base:** `cursor/editor-next-aafa` (synced with `main` @ F-3B+F-4+F-5.0+UX-1)  
**Status:** Planning only — **do not implement until approved**

---

## Success criteria

| ID | Criteria |
|----|----------|
| UX-2A | Gemini timeline / ChatGPT article / Claude notes paste preserves full structure |
| UX-2A | No block loss, no editor crash (F-5.0 boundaries remain) |
| UX-2B | Gutter drag selects multiple same-parent blocks |
| UX-2B | Delete / Duplicate / group Drag work on drag-selection |
| Both | 400+ tests, typecheck + build green, no F-3B/F-4/F-5.0/UX-1 regression |

---

# UX-2A (P0) — Structured AI Paste

## 1. Current paste pipeline map

```text
EditableBlock.handlePaste
  └─ e.preventDefault()
  └─ extractClipboardText(clipboard)          [blockPaste.ts]
       └─ prepareStructuredPasteText(html, plain)   [pasteStructure.ts]  ⚠️
            ├─ if html has <table> → htmlTableToMarkdown(html)  ← RETURNS FIRST TABLE ONLY
            ├─ else if plain is TSV → tsvToMarkdownTable(plain)
            ├─ else if plain → return plain
            └─ else if html → htmlArticleToMarkdown(html)   ← no <table>, no <pre>, no <hr>
       └─ fallback: htmlToPlainText(html)

BlockEditor.handlePasteAt
  └─ applyPasteAtBlock(blocks, id, start, end, raw, context)   [blockPaste.ts]
       ├─ single line → inline merge
       └─ multiline → markdownToBlocks(raw) → splice into tree
            └─ adaptPastedBlocks (list context inheritance)
            └─ renumberNumberedListsDeep

document load (separate path)
  └─ loadValidatedBlocks → markdownToBlocks → validateDocument   [documentRecovery.ts]
```

### Root cause of AI paste data loss

**`prepareStructuredPasteText` (lines 149–151):**

```ts
if (html && /<table/i.test(html)) {
  const tableMd = htmlTableToMarkdown(html);  // querySelector('table') — first table only
  if (tableMd) return tableMd;              // entire clipboard reduced to one table
}
```

When Gemini/ChatGPT/Claude copy rich HTML that includes a `<table>`:

1. HTML branch wins **before** `text/plain` (which often has the full article).
2. Only the **first** `<table>` is converted; headings, paragraphs, lists before/after are **discarded**.
3. `applyPasteAtBlock` never sees the full document — it correctly splices whatever string it receives.

Secondary gaps:

| Gap | Effect |
|-----|--------|
| `htmlArticleToMarkdown` skips `<table>`, `<pre>`, `<hr>`, `<h4>`–`<h6>` | Partial structure loss on HTML-only clipboard |
| TSV detection on plain can misclassify tab-indented text | Wrong path for some plain pastes |
| No `validateDocument` on paste output | Corrupt nodes possible (F-5E covers load, not paste) |
| Roundtrip HTML→markdown→blocks | Loses table cell inline formatting; acceptable for v1 |

### What already works

- `markdownToBlocks` handles multi-block markdown (headings, lists, tables, code, quote, divider, toggle, math, image) when given **full** markdown string.
- `applyPasteAtBlock` correctly replaces caret block with N parsed blocks.
- `geminiChronologyPaste.test.ts` covers **markdown-only** and **table-only** HTML — not **mixed** HTML article.

---

## 2. Proposed parser architecture

### Principle

**Parse the entire document in DOM order → `Block[]`**, never “first structure wins”.

```text
Clipboard (html + plain)
        │
        ▼
┌───────────────────────┐
│  pasteOrchestrator.ts │  NEW — single entry, pure
└───────────┬───────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
html has block-    plain looks like
level structure?   full markdown?
     │             │
     ▼             ▼
htmlDocumentToBlocks   markdownToBlocks
     │             │
     └──────┬──────┘
            ▼
   validateDocument(blocks)     [documentRecovery.ts — reuse]
            ▼
   applyPasteAtBlock splice      [blockPaste.ts — unchanged logic]
```

### New module: `htmlDocumentToBlocks.ts`

Sequential walker over `document.body` children (depth-first for lists):

| HTML | Block type |
|------|------------|
| `h1`–`h3` | `heading1`–`heading3` |
| `h4`–`h6` | `heading3` (fallback) or paragraph with bold — **decision in impl** |
| `p`, bare `div` text | `paragraph` |
| `ul` / `ol` | `bullet` / `numbered` (+ nested `indent`) |
| `li` with checkbox patterns | `todo` |
| `table` | `table` (direct `tableHeaders` / `tableRows`, no markdown roundtrip) |
| `pre` / `code` | `code` |
| `blockquote` | `quote` |
| `hr` | `divider` |
| `img` | `image` |
| unknown wrapper | recurse children; leaf text → `paragraph` |

Output: ordered `Block[]` preserving document order.

### New module: `pasteOrchestrator.ts`

```ts
export function clipboardToBlocks(
  clipboard: Pick<DataTransfer, 'getData'>,
): Block[] | null
```

Decision tree:

1. If `text/html` has multiple block-level siblings (or article wrapper with mixed types) → `htmlDocumentToBlocks(html)`
2. Else if `text/plain` is multiline markdown → `markdownToBlocks(plain)`
3. Else if TSV only (no conflicting html) → table via existing `tsvToMarkdownTable`
4. Else fallback → `htmlArticleToMarkdown` → `markdownToBlocks`
5. Always `validateDocument` before return

### Integration point (minimal touch to frozen files)

**`blockPaste.ts`** — change `extractClipboardText` OR add parallel `extractClipboardBlocks`:

```ts
// Preferred: new function, keep extractClipboardText for inline/single-line
export function extractClipboardBlocks(clipboard): Block[] | null {
  return pasteOrchestrator(clipboard);
}
```

**`applyPasteAtBlock`** — add overload or sibling `applyPasteBlocksAt(blocks, blockId, start, end)` that splices pre-parsed `Block[]` without re-parsing markdown (avoids double conversion).

**`EditableBlock.handlePaste`** — call blocks path when `extractClipboardBlocks` returns length > 0.

### Deprecate (not delete) dangerous path

`prepareStructuredPasteText` table-first branch → redirect to orchestrator; keep exported for tests with deprecation comment.

---

## 3. Files to modify

| File | Change |
|------|--------|
| `blockPaste.ts` | Add `extractClipboardBlocks`, `applyPasteBlocksAt`; wire orchestrator |
| `EditableBlock.tsx` | Paste handler prefers block array path |
| `BlockEditor.tsx` | `handlePasteAt` accepts pre-parsed blocks (thin wrapper) |
| `pasteStructure.ts` | **Minimal** — re-export or delegate; mark table-first branch deprecated |
| `editor-architecture.md` | Document new modules; unfreeze paste extension point |

## 4. New files

| File | Purpose |
|------|---------|
| `htmlDocumentToBlocks.ts` | DOM-order HTML → `Block[]` |
| `pasteOrchestrator.ts` | Clipboard routing + validation |
| `htmlDocumentToBlocks.test.ts` | Unit: mixed article, table sandwich, nested lists |
| `pasteOrchestrator.test.ts` | Gemini/ChatGPT/Claude fixture pastes |
| `aiPasteFixtures.ts` | Shared HTML/plain samples (test only) |

---

## 5. Migration risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking inline single-line paste | Medium | Keep `applyPasteAtBlock` single-line path unchanged |
| List context inheritance (`adaptPastedBlocks`) | Low | Apply after orchestrator for plain-line-into-list only |
| Frozen module policy | Low | New files + 1-line hook in `blockPaste.ts` (per F-5.1 pattern) |
| HTML variance across AI providers | High | Fixture tests per provider; fallback to paragraph |
| Double tables / nested tables | Medium | One table block per `<table>`; nested → flatten or paragraph fallback |
| Performance on 500+ block paste | Low | Benchmark in `editorBenchmark.test.ts`; batch insert |
| Toggle/list indent on HTML paste | Medium | v1: flat lists with indent; toggle from HTML deferred |

---

## 6. Test plan (UX-2A)

| Test | Fixture |
|------|---------|
| Mixed HTML: H1 + P + table + P + UL | 5+ blocks, correct order |
| Gemini timeline HTML (table only) | 1 table — regression |
| Gemini article HTML (table + prose) | **currently fails** — must pass |
| ChatGPT markdown plain (full article) | headings + lists + code |
| Claude HTML notes | bullets + paragraphs |
| TSV excel paste | still 1 table (regression) |
| Inline URL paste in paragraph | unchanged |
| Empty clipboard | no-op |
| `applyPasteBlocksAt` + `validateDocument` | no crash, min 1 block |
| `geminiChronologyPaste.test.ts` | extend mixed HTML case |
| Render smoke after paste | `blockRenderSmoke` on result |

**Target:** +25–35 tests → 400+ total.

---

# UX-2B (P1) — Block Drag Selection

## 1. Selection architecture (current)

```text
BlockEditorInner (depth === 0)
  ├─ selectedBlockIds: Set<string>
  ├─ anchorBlockId: string | null
  ├─ activeBlockId: string | null
  ├─ SelectionCtx → SingleBlock / ToggleBlock children
  │
  ├─ Click selection: applyPointerSelection [blockSelection.ts]
  │    ├─ shift → selectRange (same parent only)
  │    └─ ctrl/cmd → toggleInSelection
  │
  ├─ Keyboard: Delete/Duplicate [blockKeyboard.ts, multiBlockOps.ts]
  └─ Drag: useDragDrop → resolveDraggingIds(selected) [editorDragDrop.tsx, multiBlockDrag.ts]
```

**Exists:** multi-select ops, group drag, shift-click range, per-block `isSelected` styling.

**Missing:** pointer drag through gutter to select a range (marquee by block rows).

### Gutter hit area

`.be-block::before` — 44px wide left pseudo-element (see `editorChromeStyles.ts`). Currently no `pointer-events`; clicks pass through to content or miss.

---

## 2. Interaction model (proposed)

```text
pointerdown on gutter zone (clientX within block rect left − 44px)
  AND NOT on .be-handles / contentEditable
        ↓
  set marqueeAnchorBlockId = block.id
  set isGutterDragging = true
  clear text selection (preventDefault)
        ↓
pointermove (document)
        ↓
  hit-test block rows under cursor (elementFromPoint / data-block-id)
  selectedBlockIds = selectRange(anchor, hover)   [same-parent only]
        ↓
pointerup
        ↓
  isGutterDragging = false
  keep selectedBlockIds
```

### Conflict avoidance

| Scenario | Behavior |
|----------|----------|
| Drag starts in `contentEditable` | Normal text selection — **no change** |
| Drag starts in gutter | Block marquee — `user-select: none` on `.be-editor-root` while active |
| Shift/Ctrl click | Unchanged (`applyPointerSelection`) |
| Grip pointerdown | Unchanged (drag reorder); gutter drag starts left of handles |
| Nested toggle children | Same-parent rule: only select siblings within same `children` array |
| Cross-parent drag | v1: clamp to anchor's sibling list; no cross-toggle |

### Optional (P2, not UX-2B v1)

- Alt + drag anywhere on block row
- Cross-toggle selection

---

## 3. Files to modify

| File | Change |
|------|--------|
| `editorChromeStyles.ts` | `.be-block--gutter-active`, pointer-events on gutter zone during drag |
| `BlockEditor.tsx` | Gutter pointer listeners on `.be-editor-root`; marquee state |
| `blockSelection.ts` | `hitTestBlockId(clientY)`, `selectRangeByPointer` helpers |
| `editorTypes.ts` | Optional `SelectionCtx.isGutterDragging` |
| `SingleBlock` | `data-block-id` already via shell; ensure hit-test target |

## 4. New files

| File | Purpose |
|------|---------|
| `blockGutterSelection.ts` | Pure: gutter hit zone, range from anchor to hover |
| `blockGutterSelection.test.ts` | Unit tests with mock sibling lists |
| `editorGutterSelection.test.ts` | Integration: pointer sequence → selectedBlockIds |

---

## 5. Test plan (UX-2B)

| Test | Assert |
|------|--------|
| Gutter mousedown on block B, move to D | `{B,C,D}` selected (same parent) |
| Gutter drag across toggle boundary | selection clamped to siblings |
| Text mousedown + drag | text selected, `selectedBlockIds` unchanged |
| Shift-click after gutter select | extends range |
| Delete after gutter select | `deleteSelectedBlocks` |
| Duplicate after gutter select | `duplicateSelectedBlocks` |
| Drag grip with multi selected | `applyMultiBlockDragDrop` (regression) |

**Target:** +12–18 tests.

---

## 6. Risk assessment (UX-2B)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Text selection regression | High | Strict gutter X threshold; only activate left of content |
| Toggle nested confusion | Medium | Same-parent enforcement; visual feedback |
| Pointer capture on scroll | Medium | `setPointerCapture` on editor root during drag |
| Mobile / touch | Low | defer; desktop-first (matches Notion web) |
| Conflict with UX-1 row mousedown focus | Medium | Gutter zone excludes content click path |

---

# Implementation sequencing (after approval)

```text
Phase 1 — UX-2A (P0)
  1. htmlDocumentToBlocks + tests
  2. pasteOrchestrator + fixtures
  3. applyPasteBlocksAt + EditableBlock wire
  4. Mixed HTML regression tests
  5. editor-next CI green

Phase 2 — UX-2B (P1)
  1. blockGutterSelection pure logic
  2. BlockEditor pointer wiring + styles
  3. Integration tests
  4. Manual QA checklist update
```

---

# Open decisions (need approval)

1. **H4–H6 mapping:** downgrade to `heading3` vs new heading types?
2. **HTML callout divs** (ChatGPT styled boxes): paragraph fallback vs `callout` detection?
3. **Gutter width:** keep 44px `::before` vs dedicated `.be-gutter` element?
4. **Unfreeze `pasteStructure.ts`:** delegate only vs inline deprecation?

---

# References

- `pasteStructure.ts:145-160` — table-first bug
- `geminiChronologyPaste.test.ts` — partial coverage
- `blockSelection.ts` — shift range (reuse for gutter)
- `multiBlockDrag.ts` / `multiBlockOps.ts` — ops already wired
- `F-5.1-design.md` F-5D — superseded by UX-2A scope
