# UX-5E.1B — Virtualization Proof of Concept

## Scope

Historical root-level block virtualization proof of concept. This document
retains the original POC context; the production runtime is now default-on
and no longer reads `VITE_VIRTUAL_BLOCKS_POC`.

## Historical POC controls

| Mechanism | Historical behavior |
| --------- | ------------------- |
| `VITE_VIRTUAL_BLOCKS_POC` | Retired; no longer controls production virtualization |
| `BlockEditor` prop `virtualBlocksPoc` | explicit test/performance override |
| `setVirtualBlocksPocOverride()` | test-only |

## Architecture

- **`useVirtualBlockList`** — `@tanstack/react-virtual` hook with per-type `estimateSize` + `measureElement`
- **`VirtualBlockList`** — replaced root `blocks.map` when the POC flag was on (`depth === 0` only)
- **`BlockHeightCache`** — `Map<blockId, height>` updated on measure
- **`scrollToBlockId`** — exposed via `virtualScrollApiRef` on `BlockEditor`
- **Scroll parent** — `.editor-drop-zone` (NoteView) or audit scroll wrapper

## POC limitations (UX-5E.1C)

| Area | Status |
| ---- | ------ |
| Block reorder drag | **Disabled** when flag on (`DISABLED_DRAG_API`) |
| Focus off-screen | No pending focus queue; 100ms `focusCmd` TTL unchanged |
| Search navigate | No `scrollToBlockId` integration yet |
| Nested toggles | Children still fully mounted when open |
| Gutter range select | Works only over mounted visible rows |

## Benchmark results (UX-5E.1B POC)

| Size | Before mount (ms) | After mount (ms) | DOM before | DOM after |
| ---- | ----------------- | ---------------- | ---------- | --------- |
| 100  | 307               | 57               | 114        | 22        |
| 250  | 701               | 60               | 286        | 22        |
| 500  | 1441              | 87               | 571        | 22        |
| 1000 | 3743              | 115              | 1143       | 22        |
| 2000 | 14640             | **303**          | 2286       | 22        |

2000-block target **<500ms** met (303ms measured). DOM nodes bounded to viewport overscan (~22).

## Run benchmarks

```bash
cd frontend && npm test -- editorPerformanceAudit -t "virtual mount"
```

```bash
cd frontend && npm test -- virtualBlockList
```
