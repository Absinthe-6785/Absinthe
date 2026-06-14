# K-49 Math Rendering

## Strategy

All math rendering flows through **one bundled KaTeX instance** — no CDN, no `window.katex`, no runtime network requests.

### Entry points

1. **`katexRender.ts`** — `renderKatexHtml(expr, displayMode)` wraps `katex.renderToString` with `throwOnError: false`.
2. **`editableRender.ts`** — block editor read/live HTML.
3. **`noteUtils.parseMarkdown`** — legacy full-note HTML preview.
4. **`MathBlock.tsx`** — dedicated block via re-exported `renderKatexHtml`.

### CSS

```ts
// main.tsx
import 'katex/dist/katex.min.css';
```

Loaded once at app bootstrap. Dark mode uses `--be-text` override on `.katex` inside the block editor (see `editorChromeStyles.ts`).

## Display modes

| Delimiter | KaTeX mode | DOM wrapper |
|-----------|------------|-------------|
| `$…$` | `displayMode: false` | `.be-math-inline` |
| `$$…$$` | `displayMode: true` | `.be-math-display` (centered, overflow-x auto) |
| MathBlock | `displayMode: true` | centered div in component |

## Error handling

Invalid LaTeX returns empty string from KaTeX (`throwOnError: false`). Fallback:

- **Read-only inline** — red code chip showing raw delimiters
- **MathBlock** — monospace error styling
- **parseMarkdown** — `.bmerr` code element

## CDN removal

Removed from `NoteView.tsx`:

- `useKaTeX()` hook (jsdelivr CSS + JS injection)
- Unused `katexReady` state

## Bundle impact (K-49 build, `npm run build`)

| Asset | Size | gzip |
|-------|------|------|
| `index-*.js` (app + KaTeX) | 1,973 kB | 543 kB |
| `index-*.css` (app + KaTeX CSS) | 74 kB | 17 kB |
| KaTeX fonts (`KaTeX_*.woff2/woff/ttf`) | ~600 kB total | — |

KaTeX fonts are emitted as separate static assets (20 files). No runtime CDN requests.

**Before K-49:** KaTeX loaded from jsDelivr at runtime (~same library size, but network-dependent).

**Trade-off:** Larger initial JS bundle, fully offline-capable production builds.

## Tree-shaking notes

- Static `import katex from 'katex'` — bundler includes KaTeX core.
- No dynamic CDN load — predictable offline behavior.
- MathBlock + inline share the same import path → single chunk.

## Roadmap (not implemented)

See [K-49-scientific-notes.md](./K-49-scientific-notes.md) K-50 section and [K-49-latex-parsing-rules.md](./K-49-latex-parsing-rules.md).
