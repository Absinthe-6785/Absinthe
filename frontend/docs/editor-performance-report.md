# Editor Performance Report (Sprint F-2E)

## Scope

Benchmarks measure **markdown parse + serialize round-trip** for mixed block documents at:

| Blocks | Priority |
|--------|----------|
| 200    | Baseline |
| 500    | **Primary** — input latency target |
| 1000   | Stress |

2000-block measurement is deferred until 500-block editing feels instant.

## Methodology

- Harness: `editorBenchmark.ts` + `editorBenchmark.test.ts`
- Document mix: headings, paragraphs, todos, bullets, toggles (nested), code, numbered lists
- Metric: median of 3 runs (`performance.now()`)
- Operations:
  - **parseMs** — markdown → `Block[]`
  - **serializeMs** — `Block[]` → markdown
  - **roundTripMs** — parse + serialize

Run locally:

```bash
cd frontend && npm test -- editorBenchmark
```

## Targets (guidance)

| Blocks | roundTripMs (soft) |
|--------|-------------------|
| 200    | < 50 ms           |
| 500    | < 150 ms          |
| 1000   | < 400 ms          |

No optimization work unless 500-block round-trip exceeds ~200 ms or typing lag is observed in manual QA.

## BlockEditor modularization (F-2)

| Module | Role |
|--------|------|
| `BlockContextMenu.tsx` | Grip context menu (English) |
| `SelectionToolbar.tsx` | Selection format toolbar |
| `slashPalette.ts` / `slashRecent.ts` | Slash ranking + global recency |
| `editorReading.ts` | Reading / Focus Mode CSS |
| `editableLive.ts` | Live preview HTML |

`BlockEditor.tsx` line count reduced by extracting menus and toolbar (~3640 → ~3150; further shrink in F-3).

## Manual QA checklist additions

- [ ] Reading mode: 720px width, line-height 1.8, no handles/menus
- [ ] Slash recent persists across notes (same browser)
- [ ] Context menu labels in English
- [ ] 500-block note: type / paste / scroll without noticeable delay
