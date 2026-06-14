# K-49 Scientific Notes

## Overview

K-49 adds first-class mathematical notation to Absinthe Notes. Users can write, edit, view, copy, and search LaTeX equations inside normal note content without external tools, AI, cloud rendering, or backend support.

## User capabilities

| Capability | Status |
|------------|--------|
| Inline math `$…$` in paragraph blocks | ✅ |
| Display math `$$…$$` in paragraph blocks | ✅ |
| Dedicated `MathBlock` (`/math`, `$$` fence) | ✅ (unified renderer) |
| Offline rendering | ✅ (bundled KaTeX) |
| Currency false-positive protection | ✅ |
| Search on raw LaTeX source | ✅ |
| Click-to-edit (MathBlock) | ✅ |
| Inline edit via contentEditable source chips | ✅ |

## Architecture

```
Note body (raw markdown / block JSON)
        │
        ▼
┌───────────────────┐
│  mathParse.ts     │  tokenize $…$ / $$…$$, currency guard
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
editableRender   noteUtils.parseMarkdown
(block editor)   (legacy HTML preview)
    │           │
    └─────┬─────┘
          ▼
   katexRender.ts  →  katex npm (bundled)
          │
          ▼
   KaTeX HTML + katex.min.css (main.tsx)
```

## Module layout

| Path | Role |
|------|------|
| `src/lib/math/mathParse.ts` | Delimiter tokenization, false-positive rules |
| `src/lib/math/katexRender.ts` | Bundled KaTeX `renderToString` wrapper |
| `src/components/views/mathRendering.ts` | Re-export for MathBlock + legacy imports |
| `src/components/views/editableRender.ts` | Block editor inline HTML (read + live) |
| `src/components/views/MathBlock.tsx` | Dedicated math block UI |
| `src/components/views/noteUtils.ts` | Markdown export / preview math restore |

## Editing workflow

1. **Paragraph text** — type `$a^2+b^2=c^2$` or `$$\frac{1}{2}$$` directly in a text block.
2. **Live edit** — math segments render as delimiter markers + monospace source chips (`be-live-code`); raw LaTeX stays in `block.content` for undo/redo and copy.
3. **Read mode** — KaTeX renders inline and display math.
4. **MathBlock** — click rendered output → textarea with live preview; uses same `renderKatexHtml`.

## Bundle impact

KaTeX is imported as an npm dependency (`katex@0.16.9`). CSS loads once from `main.tsx`. Vite code-splits KaTeX into the main JS chunk (see `K-49-math-rendering.md` for build numbers).

## Related docs

- [K-49-math-rendering.md](./K-49-math-rendering.md)
- [K-49-latex-parsing-rules.md](./K-49-latex-parsing-rules.md)
- [K-49-search-compatibility.md](./K-49-search-compatibility.md)
- [K-49-mathblock-audit.md](./K-49-mathblock-audit.md)
- [K-49-validation-checklist.md](./K-49-validation-checklist.md)

## Future (K-50+)

Documented in each spec file — `align`, `cases`, matrices, chemistry, physics notation. Not implemented in K-49.
