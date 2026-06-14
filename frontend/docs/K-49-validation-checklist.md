# K-49 Validation Checklist

## Automated

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

### Unit tests

- [ ] `lib/math/mathParse.test.ts` — delimiter + currency rules
- [ ] `lib/math/editableRenderMath.test.ts` — render + highlight
- [ ] `lib/math/noteSearch.test.ts` — body search on LaTeX
- [ ] `components/views/mathRendering.test.ts` — bundled KaTeX wrapper
- [ ] Existing suite still passes

## Manual — inline math

- [ ] `The Pythagorean theorem is $a^2+b^2=c^2$.` renders in read mode
- [ ] Edit mode shows `$` markers and source chip
- [ ] Undo/redo preserves `$a^2+b^2=c^2$` string
- [ ] Copy/paste retains raw LaTeX

## Manual — display math

- [ ] `$$\frac{-b\pm\sqrt{b^2-4ac}}{2a}$$` centered, scrolls on narrow viewport
- [ ] Dark mode: equation readable (inherits text color)

## Manual — false positives

- [ ] `$5`, `$10`, `$100` in prose stay plain text
- [ ] `Price is $5 today` (unclosed) stays plain

## Manual — LaTeX tokens

- [ ] `\frac`, `\sqrt`, `\sum`, `\int`, `\sin`, `\cos`, `\tan`, `\log` render

## Manual — MathBlock

- [ ] `/math` inserts block; click edits; preview matches inline renderer
- [ ] `$$` fence round-trip export/import

## Manual — search

- [ ] Workspace search `b^2-4ac` finds note with quadratic formula
- [ ] In-note highlight marks math when query matches LaTeX source

## Manual — offline

- [ ] DevTools → Offline → equations still render (no CDN requests)

## Bundle

- [ ] `npm run build` succeeds
- [ ] Record JS/CSS size delta in K-49-math-rendering.md

## K-50 backlog (not in scope)

- [ ] `\begin{align}` / `\begin{cases}`
- [ ] Matrix editor helpers
- [ ] mhchem / chemistry
- [ ] Physics notation macros
