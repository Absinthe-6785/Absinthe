# K-49 MathBlock Audit

## Existing implementation

**File:** `src/components/views/MathBlock.tsx`

| Aspect | Before K-49 | After K-49 |
|--------|-------------|------------|
| Renderer | `renderKatexHtml` → `window.katex` (CDN) | Same API → bundled `katex` npm |
| Storage | `block.math` + optional `mathBlock: true` | Unchanged |
| Parse | `blockUtils.tryMathBlock()` for `$$` fences | Unchanged |
| Edit UX | Click → textarea + snippet toolbar + preview | Unchanged |
| Snippets | `mathSnippets.ts` | Unchanged |

## Overlap with inline math

| Concern | MathBlock | Inline `$…$` in text blocks |
|---------|-----------|----------------------------|
| Use case | Standalone equation | Equations in prose |
| Serialization | `$$\nexpr\n$$` block | `$expr$` in paragraph markdown |
| Live preview while typing | textarea + KaTeX preview | monospace chips in contentEditable |
| Renderer | `renderKatexHtml(display=true)` | `renderMathTokenHtml` |

**Duplication removed:** three separate `window.katex` call sites (`mathRendering.ts`, `editableRender.ts`, `noteUtils.ts`) consolidated to `katexRender.ts`.

**Intentional duplication kept:** MathBlock edit UI (textarea) vs inline contentEditable chips — different interaction models; not a second math editor product.

## Migration path

1. ✅ **Phase 1 (K-49):** Unified KaTeX bundle + shared parser for delimiters.
2. **Phase 2 (optional):** Convert standalone `$$…$$` fences to inline display math in paragraph blocks when pasted as single-line `$$expr$$`.
3. **Phase 3 (K-50+):** MathBlock could embed the same live chip UX for consistency — low priority.

## Recommendation

- Keep MathBlock for `/math` slash command and multi-line display equations.
- Prefer inline `$…$` / `$$…$$` for equations inside sentences.
- Do not add a third math system (no AI, no server render).

## blockUtils reference

```ts
// Fence block
$$ 
\frac{1}{2}
$$

// Inline line → math block with mathBlock: false
$expr$
```

Paragraph text with `$expr$` stays as `type: 'paragraph'` — parser does not promote to MathBlock.

## Tests

- `mathRendering.test.ts` — bundled renderer
- `mathSnippets.test.ts` — snippet insertion (existing)
- `editableRenderMath.test.ts` — inline/display in paragraphs
