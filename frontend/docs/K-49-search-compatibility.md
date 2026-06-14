# K-49 Search Compatibility

## Principle

Search operates on **raw note body text** stored in the notes store. Math rendering is a view-layer transform and does not alter stored content.

## Note list filtering

In `NoteView.tsx`, plain-text search:

```ts
(n.body ?? '').toLowerCase().includes(q)
```

LaTeX delimiters and commands remain in `body`, so queries like `b^2-4ac` or `quadratic formula` match the stored markdown.

## In-editor highlight

`editableRender.ts` applies two highlight paths:

1. **Plain text** — `applySearchHighlight` on HTML after `escHtml`.
2. **Math segments** — if `searchQuery` is a substring of the raw `expr`, wrap rendered KaTeX in `<mark class="be-search-hl be-math-search-hl">`.

Math placeholders are extracted **before** text highlight, so queries matching inside `$…$` or `$$…$$` still surface in read mode.

## Live edit mode

Search match inside math shows `be-math-search-hl` on the live chip wrapper; source remains editable.

## What search does NOT do

- Does not expand KaTeX to Unicode equivalents for fuzzy match.
- Does not search rendered HTML output of equations.
- Knowledge query syntax (`tag:`, property filters) is unchanged.

## Tests

| File | Coverage |
|------|----------|
| `lib/math/noteSearch.test.ts` | Body substring on LaTeX source |
| `lib/math/editableRenderMath.test.ts` | In-editor math highlight |

## Copy / export

Copy from contentEditable reads raw text including `$…$` delimiters — search index and clipboard stay aligned.
