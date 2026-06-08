# UX-3A Implementation Plan — Toggle Preservation

**Branch:** `cursor/sprint-ux3a-toggle-preservation-aafa`  
**Target PR:** → `cursor/editor-next-aafa`

## Approved decisions

1. `<details>/<summary>` → `toggle` blocks
2. Nested `<details>` preserved in `children`
3. `.btoggle` / `.btbody` Absinthe reading HTML supported
4. Empty toggle `children: []`
5. Toggle header paste → **siblings after toggle**, not into `children`
6. Markdown `> single line` remains **quote**

## Architecture

```text
htmlDocumentToBlocks.walkNode
  └─ DETAILS → htmlToggleParser.toggleBlockFromDetails
        ├─ summary → toggle.content
        ├─ !open → collapsed
        └─ body (.btbody or non-summary children) → recursive walkNode → children

blockPaste.applyPasteBlocksAt
  └─ cur.type === 'toggle' → applyPasteBlocksAtToggleHeader
        ├─ single inline paragraph → merge header text only (keep children)
        └─ else → insert pasted blocks as siblings after toggle
```

## Files

| File | Action |
|------|--------|
| `htmlToggleParser.ts` | NEW |
| `htmlToggleParser.test.ts` | NEW |
| `togglePaste.test.ts` | NEW |
| `htmlDocumentToBlocks.ts` | MODIFY — wire DETAILS |
| `blockPaste.ts` | MODIFY — toggle header splice |
| `blockPaste.test.ts` | MODIFY — toggle header cases |
| `htmlDocumentToBlocks.test.ts` | MODIFY — details → toggle |

## Tests (+~20)

- Notion-style details HTML
- Nested details
- Absinthe `.btoggle` round-trip
- Toggle header multi-block paste → siblings
- Collapsed `open` attribute

## Risks

- False-positive details without summary → paragraph fallback
- Toggle header single-line vs multi-block paste paths must stay distinct
