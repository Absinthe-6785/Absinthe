# UX-5E.1A — Virtualization Architecture Audit

## Scope

Analysis-only design phase for large-document virtualization. **No implementation, no dependencies, no runtime changes.**

Evidence base: UX-5D mount benchmarks (`editorPerformanceAudit.ts`) and full editor subsystem review.

| Blocks | Mount (UX-5D) |
| ------ | ------------- |
| 100    | 377 ms        |
| 500    | 1,135 ms      |
| 1000   | 3,010 ms      |
| 2000   | 15,585 ms     |

Primary bottleneck: **synchronous full-tree React + DOM mount** (`blocks.map` → `SingleBlock` × N).

---

## Area 1 — Render Ownership Mapping

### Render tree

```
BlockEditor [React.memo]
└── BlockEditorInner [NOT memoized]
    ├── BlocksCtx / SelectionCtx / DragCtx (depth 0)
    └── div.be-editor-root
        └── blocks.map → SingleBlock [React.memo] × N
            ├── [toggle] ToggleBlock → renderToggleNested → BlockEditorInner(depth+1)
            │                        └── blocks.map → SingleBlock × children
            └── [other] div.be-block[data-drag-id]
                ├── BlockGutter / BlockHandles / grip
                └── SafeBlockRenderer → renderBlockContent
                    ├── EditableBlock (text types) — contentEditable + innerHTML paint
                    ├── CodeBlock / MathBlock / ImageBlock / TableBlock
                    └── read-only inline() spans
```

### Ownership of mount cost

| Component | Share of mount cost | Evidence |
| --------- | ------------------- | -------- |
| **BlockEditorInner `blocks.map`** | **Structural fan-out** — O(n) subtrees per nesting level | ```420:465:frontend/src/components/views/BlockEditor.tsx``` — no virtualization |
| **SingleBlock** | **Per-block chrome** — ~8–15 DOM nodes (gutter, grip, shell, indicators) | `data-drag-id` on every block; audit: `domBlockCount ≈ 1.14× block count` |
| **EditableBlock** | **Per-text-block interactive cost** — contentEditable + `paintEditableLive` innerHTML | One `.be-editable` per text block; dominant in paragraph-heavy docs |
| **Toggle recursion** | **Multiplicative** — each open toggle spawns nested `BlockEditorInner` | ```90:141:frontend/src/components/views/features/block-editor/hooks/useEditorToggle.ts``` |

**Majority owner:** `BlockEditorInner` owns the render fan-out. `SingleBlock` + `EditableBlock` own per-node DOM and paint cost. `BlockEditor` wrapper is negligible (0 blocks rendered directly).

### Propagation hotspots (pre-virtualization)

| Prop | Fan-out |
| ---- | ------- |
| `dragState` | All root `SingleBlock`s on every pointer move (`singleBlockPropsEqual` line 104) |
| `searchQuery` / `searchQueryFor` | All blocks on query or `activeBlockId` change |
| `focusCmd` | All blocks receive prop; only target acts |
| `isSelected` | 1–N blocks on selection change (low); `activeBlockId` amplifies to N |

---

## Area 2 — Virtualization Models

### Model A — Root block virtualization only

Root-level `blocks.map` replaced with virtual window. Toggle children always fully mounted when toggle is open.

| Dimension | Assessment |
| --------- | ---------- |
| **Complexity** | Medium — one virtual list, nested editors unchanged |
| **Implementation risk** | Medium — root drag/gutter/search must integrate with one scroller |
| **Maintenance risk** | Low–Medium — clear boundary at root |
| **Expected gain** | **High for flat/large root lists** (~70–90% mount reduction @ 2k blocks). Diminished when many open toggles with large child lists |

### Model B — Recursive virtualization

Every `blocks.map` (root + each toggle's `BlockEditorInner`) uses a virtualizer.

| Dimension | Assessment |
| --------- | ---------- |
| **Complexity** | Very high — nested scrollers, nested coordinate spaces, nested drag hit-test |
| **Implementation risk** | **High** — toggle expand/collapse changes parent height; drag across nesting levels |
| **Maintenance risk** | High — every nested editor path must stay virtualizer-aware |
| **Expected gain** | Maximum theoretical gain for deeply nested large toggles |

### Model C — Hybrid (recommended)

- **Root blocks virtualized** (primary win).
- **Toggle children virtualized only when child count ≥ threshold** (e.g. 20–30).
- Small toggle groups remain fully mounted.
- Collapsed toggles: header only (already true today).

| Dimension | Assessment |
| --------- | ---------- |
| **Complexity** | Medium–High — two code paths with shared abstractions |
| **Implementation risk** | Medium — threshold tuning; nested virtualizer is optional Phase 2 |
| **Maintenance risk** | Medium — documented thresholds and shared `VirtualBlockList` primitive |
| **Expected gain** | **~80–95% mount reduction** on typical large docs; handles toggle edge cases without full recursion |

---

## Area 3 — Drag Compatibility

### Current architecture

- **State:** `useDragDrop` at depth 0; shared via `DragCtx` to nested editors.
- **Hit-test:** `resolveDragOverFromPoint` → `document.elementsFromPoint` → `.be-block[data-drag-id]` + `getBoundingClientRect` for before/after/inside.
- **Commit:** `commitDragDrop` — pure data (`dragHierarchy`, `multiBlockDrag`); **virtualization-safe**.
- **Autoscroll:** `applyDragAutoscroll` on `.editor-drop-zone` scroll container.
- **Indicators:** `DropInsertIndicator` rendered inside each `SingleBlock` when `dragState.overId` matches.

### Answers

| Question | Answer |
| -------- | ------ |
| Can drag targets be virtualized? | **Yes, with constraints** — off-screen blocks cannot be hit-test targets unless placeholders or index-based hit-test exist |
| Can off-screen blocks disappear? | **Yes** — today they are always mounted; after virtualization they are unmounted by default |
| Autoscroll behavior? | Scroll container unchanged; **new rows must mount as scroll reveals them** or hit-test uses virtual metrics |
| Insertion indicators? | Today tied to mounted `SingleBlock`; should move to **portal overlay positioned from virtual row metrics** |

### Required changes before implementation

1. **Dual hit-test:** virtual row index map (`clientY` → blockId + position) **or** mount buffer + lightweight placeholders with correct height and `data-drag-id`.
2. **Pin mount set during drag:** dragged ids, `overId` neighbors, toggle headers on path, ±buffer rows.
3. **Decouple `dragState` from every `SingleBlock`** — context selector / overlay subscriber (fixes UX-5D O(N) drag rerender).
4. **Portal-level drop indicator** — single DOM node, not per-block.
5. **Replace `pulseDragReject` querySelector** with ref map or drag overlay CSS.
6. **Nested toggles:** hit-test uses **root tree coordinates**, not per-nested-editor DOM isolation.

---

## Area 4 — Selection Compatibility

### Current architecture

- **State:** `selectedBlockIds: Set<string>`, `anchorBlockId` — **data-layer, virtualization-safe**.
- **Logic:** `applyPointerSelection`, `selectRange`, `toggleInSelection` in `blockSelection.ts` — pure tree, no DOM.
- **Gutter range:** `useEditorGutterDrag` + `hitTestBlockIdFromPoint` → `elementFromPoint` + `closest('[data-drag-id]')` — **DOM-dependent**.
- **Visual:** `isSelected` → `be-block-selected` on mounted `SingleBlock` only.

### Answers

| Question | Answer |
| -------- | ------ |
| Can selection span unmounted blocks? | **State yes, interaction no** — Set can hold off-screen ids; user cannot click/shift-range to unmounted blocks |
| Must selection become index-based? | **No** — block-id Set is correct; virtualizer needs `scrollToBlockId(id)` on programmatic select |
| DOM assumptions? | Gutter marquee, `documentFocus.listRootBlockRows`, `SelectionToolbar` (active `.be-editable` mounted) |

### Selection virtualization constraints

1. Keep `selectedBlockIds` as block-id Set; restore `isSelected` styling on remount.
2. **Scroll into view** on `selectBlock`, search navigate, paste focus.
3. Gutter hit-test: Y-index from virtual metrics or gutter-only placeholder stripes.
4. **`listRootBlockRows`:** feed from virtualizer cumulative offsets, not `querySelector` per id.
5. **Pending focus queue** for off-screen selection targets (see Area 6).

---

## Area 5 — Search Compatibility

### Current architecture

- **Index:** `collectEditorSearchMatches` — O(n) flatten × `findBlockById`; data-only, works unmounted.
- **Navigation:** `searchMatchIndex` effect → `selectBlock` + `setFocusCmd({ blockId, offset })` — **no scrollIntoView**.
- **Highlight:** `searchQueryFor` → `applySearchHighlight` in `EditableBlock` paint — requires mounted DOM.

### Answers

| Question | Answer |
| -------- | ------ |
| Jump to unmounted block? | **Not today** — `dispatchFocusCommand` no-ops if handler unregistered |
| Should virtualization own scrolling? | **Yes** — virtualizer `scrollToIndex(blockId)` is the correct owner |
| Should search force materialization? | **Yes** — expand collapsed toggles, scroll into view, mount target row before focus |

### Recommended search strategy

1. **Keep data-layer match collection** (optionally cache flat index + id→block map — UX-5D P2).
2. **On navigate:** (a) expand ancestor toggles, (b) `virtualizer.scrollToBlockId`, (c) await mount, (d) replay pending focus.
3. **Highlight scope:** default to **active match + viewport** (not all 286 blocks @ 2k); full-document highlight optional read-only mode.
4. **Add explicit scroll** — search currently lacks `scrollIntoView` even without virtualization.

---

## Area 6 — Focus Compatibility

### Current architecture

- **Registry:** `registerFocusHandler` / `dispatchFocusCommand` — in-memory Map, cleared on unmount.
- **Commands:** `focusCmd` prop with **100ms TTL** (`FOCUS_CMD_RESET_MS`).
- **EditableBlock:** `editableRef` + `setCaretOffset` on focus.
- **Document chrome:** `documentFocus.listRootBlockRows` queries each `[data-drag-id]` rect.

### Focus virtualization contract

| Event | Contract |
| ----- | -------- |
| Programmatic focus (search, paste, split, navigate) | Enqueue `{ blockId, offset, source }` in **pending focus queue** |
| Virtualizer scroll | `scrollToBlockId` then mount row |
| On row mount | `SingleBlock` registers handler → drain queue for that id |
| TTL | Extend or remove 100ms cap; replay until handler fires or timeout (e.g. 2s) |
| Collapsed toggle target | Expand toggle **before** scroll/focus |
| `documentFocus` pointer | Use virtual row metrics; mount proximate row on append/toggle-footer |

---

## Area 7 — Variable Height Strategy

| Block type | Fixed height? | Strategy |
| ---------- | ------------- | -------- |
| Paragraph | No | Estimate: `minHeight 26px`, `lineHeight 1.75`; measure with ResizeObserver |
| Heading 1/2/3 | No | Estimate from font-size + margins; measure on first paint |
| Bullet / numbered / todo / quote | No | Estimate ~paragraph; list markers add ~4px |
| Code | No | `minHeight 72px`; user `resize: vertical` — **must observe resize** |
| Math | No | Variable read/edit heights |
| Image | No | Intrinsic aspect ratio; optional width 80–900px — measure on `onLoad` |
| Table | No | Dynamic rows/cols; `tableLayout: auto` — **highest measurement risk** |
| Toggle | **Bimodal** | Collapsed: header only; expanded: header + children — discontinuous height change |
| Divider | ~Yes | ~1px + margins — can use fixed estimate |

### Recommended measurement approach

**Phase 1 (POC):** `@tanstack/react-virtual` with `estimateSize` per block type + `measureElement` (ResizeObserver) for dynamic correction.

**Phase 2:** Cache measured heights in a `Map<blockId, height>` invalidated on content/type/collapse change.

**Not recommended:** Fixed-height-only virtualizer — tables, images, code, and toggles will cause scroll drift and focus misalignment.

---

## Area 8 — Library Evaluation

### react-window

| Pros | Cons |
| ---- | ---- |
| Mature, small API surface | `FixedSizeList` inadequate; `VariableSizeList` needs manual `resetAfterIndex` on every height change |
| Wide adoption | Less flexible for nested lists + custom gutter/drag chrome |
| | No built-in `measureElement`; more boilerplate for Absinthe's mixed block types |

### @tanstack/react-virtual

| Pros | Cons |
| ---- | ---- |
| Headless — fits existing `SingleBlock` markup | New dependency (acceptable in 5E.1B POC) |
| `estimateSize` + `measureElement` + dynamic overscan | Team must own scroll container wiring |
| Works with any scroll parent (`.editor-drop-zone`) | Nested virtualizers need careful scroll chaining |
| Active maintenance, React 19 compatible | |
| `scrollToOffset` / `scrollToIndex` for search navigation | |

### Custom virtualizer

| Pros | Cons |
| ---- | ---- |
| Zero dependency | Reinvents overscan, scroll anchoring, resize handling |
| Full control | High implementation and test cost |
| | Ongoing maintenance burden |

### Library recommendation

**`@tanstack/react-virtual`** — headless design preserves `SingleBlock` / `EditableBlock` ownership; built-in dynamic measurement matches variable block heights; `scrollToIndex` aligns with search/focus contract. `react-window` is viable but fights toggle/table/image dynamics. Custom is not justified given TanStack's fit.

---

## Deliverables

### Virtualization feasibility

**Feasible with constraints.**

The editor can be virtualized without rewriting block semantics. Data-layer operations (tree mutations, selection Set, search index, clipboard block data) are ready. Pointer pipelines (drag hit-test, gutter marquee, document focus, focus registry) require coordinated contract changes documented above.

### Recommended model

**Model C — Hybrid**

- Virtualize root block list immediately (UX-5E.1B POC scope).
- Defer nested toggle virtualization until child count exceeds threshold.
- Collapsed toggles already avoid child mount — preserve this.

Evidence: UX-5D shows mount scales 41× for 20× blocks; root flat list is the dominant cost. Full recursion (Model B) adds risk disproportionate to gain for typical notes. Model A alone leaves large toggle children as a secondary bottleneck — hybrid addresses both.

### Compatibility matrix

| System | Compatible | Changes required | Risk |
| ------ | ---------- | ---------------- | ---- |
| **Drag** | With constraints | Virtual hit-test or placeholders; portal indicator; pin drag mounts; decouple `dragState` rerender | **HIGH** |
| **Selection** | Yes | Scroll-to-selected; gutter Y-index hit-test; virtual `listRootBlockRows` | **MEDIUM** |
| **Search** | Yes | `scrollToBlockId`; expand toggles; pending focus; scoped highlights | **MEDIUM** |
| **Focus** | With constraints | Pending focus queue; remove 100ms TTL; virtual row metrics for document focus | **HIGH** |
| **Clipboard** | Partial | Multi-block range copy needs data-layer fallback when DOM sparse; paste focus needs pending queue | **MEDIUM** |
| **Toggles** | With constraints | Expand-before-focus; optional nested virtualizer; height discontinuity on collapse | **HIGH** |
| **Tables** | With constraints | ResizeObserver per table row; remeasure on cell edit | **MEDIUM** |

### Library recommendation

**`@tanstack/react-virtual`** — see Area 8.

---

## UX-5E.1B — Proof of Concept Plan

### Goal

Validate virtualization safely before production rollout.

### Scope (limited)

| In scope | Out of scope |
| -------- | ------------ |
| Root-level virtual list in **edit mode** | Nested toggle virtualization |
| Flat documents (no toggles) first | Full drag refactor |
| `measureElement` for paragraphs + headings | Search highlight scoping |
| Mount benchmark @ 500/1000/2000 | Production feature flag rollout |
| Scroll-to-index API stub | Clipboard copy fallback |

### POC steps

1. **5E.1B.1 — Virtual list shell**
   - Add `@tanstack/react-virtual` (dev/POC branch only).
   - Replace root `blocks.map` with `useVirtualizer` inside `BlockEditorInner` (depth 0 only).
   - Feature flag: `VIRTUAL_BLOCKS_POC` env or prop.

2. **5E.1B.2 — Measurement baseline**
   - `estimateSize` per `BlockType` (paragraph 46px, heading1 56px, etc.).
   - `measureElement` on `.be-block` shell ref.
   - Re-run `editorPerformanceAudit` mount tests; target **<500ms @ 2000 blocks**.

3. **5E.1B.3 — Interaction stubs**
   - `scrollToBlockId(id)` wrapper on virtualizer.
   - Pending focus queue (no TTL) + replay on mount.
   - Disable drag in POC flag (`readOnly` drag guard or noop `bindGripPointer`).

4. **5E.1B.4 — Regression suite**
   - Typing in first/middle/last visible block.
   - Paste single block at caret.
   - Search navigate to match (with scroll).
   - Existing 755 tests PASS with flag off.

### Success criteria

| Metric | Target |
| ------ | ------ |
| Mount @ 2000 blocks | < 500 ms (vs 15,585 ms baseline) |
| DOM `[data-drag-id]` count | ≤ overscan window (~20–40), not 2000 |
| Typing latency | No regression vs non-virtual @ 500 blocks |
| Test suite | 755+ PASS, flag off = identical behavior |

### Production path (post-POC)

1. **5E.1C** — Drag portal indicator + virtual hit-test
2. **5E.1D** — Gutter selection Y-index
3. **5E.1E** — Toggle expand + nested threshold virtualization
4. **5E.1F** — Feature flag on by default; remove flag

---

## Risk assessment

**Implementation risk: HIGH**

| Factor | Rationale |
| ------ | --------- |
| Drag + focus coupling | DOM hit-test and 100ms focus TTL are entrenched |
| Variable heights | Tables, images, code resize break naive estimates |
| Toggle nesting | Height discontinuity and nested coordinate spaces |
| Mitigation | Hybrid model, POC with drag disabled, incremental production phases |

Confidence is **high that virtualization is the correct direction** (UX-5D evidence). Confidence in **low-regression delivery** depends on phased rollout and POC validation.

---

## How Absinthe should implement virtualization

1. **Adopt Model C (hybrid)** with root virtual list first.
2. **Use `@tanstack/react-virtual`** with per-type `estimateSize` + `measureElement`.
3. **Introduce virtualization contracts** before wiring features:
   - `scrollToBlockId(id)`
   - `pendingFocusQueue`
   - `getRowMetrics()` for drag/gutter/document-focus
4. **Decouple drag indicator and `dragState` fan-out** in parallel with virtual list (UX-5E.1C).
5. **Ship POC (UX-5E.1B)** on flat 500–2000 block fixtures with flag off by default; prove mount target before enabling drag/search in virtual mode.

This path preserves the existing `Block` tree, `SingleBlock` renderer, and clipboard data pipelines while addressing the measured 41× mount scaling that blocks large-document use.

---

## Key file references

| Subsystem | Files |
| --------- | ----- |
| Render fan-out | `BlockEditor.tsx`, `SingleBlock.tsx`, `useEditorToggle.ts` |
| Drag | `editorDragDrop.tsx`, `DragContext.tsx`, `dragAutoscroll.ts` |
| Selection | `useEditorSelection.ts`, `blockSelection.ts`, `useEditorGutterDrag.ts` |
| Search | `editorSearch.ts` |
| Focus | `selectionState.ts`, `documentFocus.ts`, `useEditorDocumentFocus.ts` |
| Clipboard | `copySelection.ts`, `useEditorPaste.ts` |
| Benchmarks | `editorPerformanceAudit.ts` |
