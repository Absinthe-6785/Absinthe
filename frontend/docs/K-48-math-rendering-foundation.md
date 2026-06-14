# K-48 Math Rendering Foundation (K-49 Proposal)

Investigation only — **no new rendering shipped in K-48**.

## Current state

| Path | Syntax | Engine | Mode |
|------|--------|--------|------|
| `MathBlock.tsx` + `mathRendering.ts` | Dedicated math block | KaTeX CDN via `useKaTeX()` in `NoteView` | Display (`displayMode: true`) |
| `editableRender.ts` | `$...$` single-line | KaTeX if `window.katex` | Read-only inline |
| `editableRender.ts` | `$...$` in live edit | Raw `<code class="be-live-code">` placeholder | Edit |
| `noteUtils.ts` (~407+) | `$...$`, `$$...$$` | KaTeX CDN | Legacy markdown preview path |

**Gap:** User-requested `$$...$$` block math in flowing markdown/notes is only partially covered (legacy preview + math block type). Inline `$...$` works read-only in blocks but not as a unified markdown pipeline.

## K-49 recommendation

### Libraries

| Option | Bundle | Pros | Cons |
|--------|--------|------|------|
| **KaTeX** (current CDN → npm) | ~300KB min+fonts | Already integrated; fast | CDN dependency; upgrade to bundled |
| MathJax 3 | ~400KB+ | `\ce{}` chemistry | Heavier, slower TTFP |
| remark-math + rehype-katex | +KaTeX | Unified markdown AST | New pipeline parallel to block editor |

**Recommend:** Keep KaTeX; move from CDN to `katex` npm package with lazy `import()` in read paths. Add `remark-math` only if unified markdown export is required.

### Inline `$...$`

- Extend `protectInlineMathLive` to show KaTeX preview on blur or after debounced pause (optional).
- Escape rules: `\$` for literal dollar; disallow `$` spanning newlines (already enforced).
- **Risk:** Dollar amounts (`$5`) — require non-word boundary or `\$` escape in parser.

### Block `$$...$$`

- Map to existing `MathBlock` on paste/import.
- In markdown round-trip, serialize math blocks as `$$...$$` fenced lines.
- Read path: detect `$$` paragraphs in `noteUtils` preview and block editor paste handler.

### Editing workflow

1. Slash menu / block type: Math (exists).
2. Inline: type `$E=mc^2$` — live shows code chip; reading mode renders KaTeX.
3. K-49: optional math preview toggle in reading mode without entering read-only.

### Bundle size

- Lazy-load KaTeX CSS+JS on first math block or first `$` in view (~120KB gz JS + fonts).
- Avoid loading on Schedule/Health tabs.

### Compatibility risks

| Risk | Mitigation |
|------|------------|
| CDN offline | Bundle KaTeX in K-49 |
| XSS via `\htmlRaw` | KaTeX `strict: 'warn'`, trust:false |
| Block editor undo | Math as opaque block payload (already) |
| Search/highlight | Strip math placeholders before index (existing `\u0000M` pattern) |
| i18n / CJK inside math | KaTeX unicode support; test `\text{}` |

## K-49 roadmap (see deliverable summary)

1. Bundle KaTeX locally; remove CDN dependency.
2. Unified `$$` block detection in paste + markdown export.
3. Inline math live preview (debounced).
4. Tests: `$5` false positive, nested delimiters, block merge on backspace.
