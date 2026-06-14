# K-54 Context Actions

## Improvements

| CTA | Before (K-53) | After (K-54) |
|-----|---------------|--------------|
| Create first wiki link | Open Links tab only | Insert `[[` in editor + focus caret inside brackets |
| Create related note | — | `createNote()` with immediate title focus |
| Open Cosmos | Full-screen graph, hides editor | Local graph in context panel; active note preserved |

## Implementation

### Wiki link draft

- `BlockEditorHandle.insertWikiLinkDraft()` in `useBlockEditor.ts`
- Appends `[[` to last text block or new paragraph
- `externalFocusOffset` prop on `BlockEditor` for precise caret placement

### Handlers (`NoteView.tsx`)

- `handleStartWikiLink` — edit mode + Links panel + `insertWikiLinkDraft`
- `handleCreateRelatedNote` — `createNote({ title: '', body: '' })` (title focused)
- `handleOpenCosmosGraph` — `setRightPanel('graph')` instead of `setViewMode('graph')`

### Wired surfaces

- Links empty state primary CTA
- Insights empty secondary CTA
- RelatedNotesPanel primary + secondary (related note)
- DiscoveryPanel `onLearnLinking`

## Full Cosmos

`CosmosContextFooter` still offers full-screen graph from local panel — intentional escape hatch.
