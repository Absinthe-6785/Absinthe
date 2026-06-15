# K-85 Metadata Consistency

Cleanup pass for predictable metadata behavior and unified 24px header chrome in the Notes workspace.

## Metadata ownership model

| Concern | Owner field | Mutators |
|---------|-------------|----------|
| Body content | `body` | Block editor, paste, import body |
| Title | `title` | Title input |
| Tags | `properties.tags` | Tag panel, inline tag chips |
| Classification | `properties.noteKind` | `NoteClassificationSelector` |
| Weak topic | `properties.weakTopic` + tag `weak-topic` | `WeakTopicToggle`, header menu |
| Favorite | `starred` | `toggleStar()` |
| Relations | `relations` | Link panels, relation editors |
| Folder | `folderId` | Sidebar drag, folder picker |

## Content vs metadata changes

**Content changes** advance `updatedAt` (the single user-visible “last edited” timestamp):

- Typing, paste, delete in blocks
- Title edits
- Block reorder (body serialization changes)
- Mixed patches that include `title` or `body`

**Metadata-only changes** preserve `updatedAt`:

- Add/remove/rename tags
- Classification change
- Weak topic toggle
- Favorite toggle
- Relations patch
- Folder move

Implementation: `frontend/src/store/notePatchPolicy.ts`

```ts
mergeNotePatch(note, patch) // bumps updatedAt only when shouldBumpContentUpdatedAt(patch)
```

No separate `contentUpdatedAt` / `metadataUpdatedAt` columns — avoids schema migration while restoring semantic meaning of `updatedAt`.

### Store integration

- `useNotesStore.updateNote()` uses `mergeNotePatch()` instead of unconditional `Date.now()`
- `toggleStar()` no longer sets `updatedAt`
- Body-only debounced sync (K-83A) unchanged; content edits still bump immediately

## Timestamp rules (tests)

`frontend/src/store/noteTimestampIntegrity.test.ts` covers:

| Action | `updatedAt` |
|--------|-------------|
| Body edit | Bumps |
| Title edit | Bumps |
| Tag add/remove | Preserved |
| Classification | Preserved |
| Weak toggle | Preserved |
| Favorite | Preserved |

## Visual consistency rationale

### 24px metadata chip system

Shared target: **height 24px**, pill radius, 10px type, 8px horizontal padding.

Used by:

- `TagChip`
- `NoteClassificationSelector`
- `WeakTopicToggle`
- `NoteContextStrip` context chips
- `LiteratureWorkflowIndicator` step pills

Constants/helpers: `frontend/src/components/views/noteview/metadataChipStyles.ts`

### Context chip fix

Root cause: interactive context chips used `.btbtn` (40×40px), forcing circular truncation (`Sup...`, `C...`).

Fix:

- Replace with `.be-context-chip-btn` (inherits inline 24px chip layout)
- Short tier labels (`Support`, `Core`, `Star`) with full tier name in tooltip

### Editor toolbar alignment

Static editor toolbar (`NoteViewEditorArea`) and floating `SelectionToolbar`:

- Icon buttons: 24×24px, 6px radius, 12px icons
- Scope pills: 24px height, shared border/hover tokens
- Row gap: 6px (`EDITOR_TOOLBAR_GAP`)

CSS classes in `useNoteViewStyles.ts`: `.be-editor-toolbar-btn`, `.be-editor-toolbar-scope`

## Existing note audit

See [K-85-metadata-audit.md](./K-85-metadata-audit.md) for migration-path findings. Key takeaway: weak-topic dual storage is reconciled on every `normalizeNote()` without touching `updatedAt`.

## Definition of done

- [x] Tag/metadata edits do not affect `updatedAt`
- [x] `toggleStar` does not affect `updatedAt`
- [x] Weak-topic property/tag reconciled on load
- [x] Context chips match 24px pill system
- [x] Header metadata + literature workflow chips aligned
- [x] Editor toolbars normalized
- [x] Timestamp tests added
- [x] Audit + consistency docs

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```
