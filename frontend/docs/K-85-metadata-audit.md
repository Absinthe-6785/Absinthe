# K-85 Metadata Audit

Audit of note metadata consistency across legacy migration, import, and current normalization paths.

## Scope

| Field | Storage | Normalization entry |
|-------|---------|---------------------|
| Tags | `properties.tags` (canonical key) | `normalizeNoteProperties()` → `normalizeTagsPropertyValue()` |
| Classification | `properties.noteKind` | `setNoteKind()` / `normalizeNoteProperties()` |
| Weak topic | `properties.weakTopic` **and** tag `weak-topic` | `setWeakTopic()` / `reconcileWeakTopicNote()` on load |
| Favorite | `starred` boolean | store `toggleStar()` |
| Relations | `relations` object | `normalizeNoteRelations()` |
| Folder | `folderId` | `normalizeNoteFolderId()` |

## Migration paths reviewed

### 1. Legacy localStorage merge (`migrateLegacyStorageIfNeeded`)

- Sources: `noteview-notes`, `planner-notes`, `planner-notes-v1`
- Merge: `mergeNoteArrays()` — newer `updatedAt` wins per id
- Each note passes through `normalizeNote()` on load
- **Finding:** Legacy notes may have used alternate tag property keys; these are collapsed to `tags` via `isTagsPropertyKey()`. No data loss, but tag order may differ from author intent.

### 2. Fresh vault (`notes-v2` already present)

- Skips legacy merge; loads raw JSON → `normalizeNote()` per row
- **Finding:** Consistent with post-K-83 schema; weak-topic dual storage is the main drift risk (see below).

### 3. Import / vault restore

- `useNoteImportExportActions` creates notes with `updatedAt: Date.now()` (expected for new content)
- Vault restore replays full note objects; `normalizeNote()` runs on next `loadNotes()`
- **Finding:** Imported notes inherit tag normalization rules; relations normalized on load.

### 4. Cloud sync (`mapDbNote`)

- Server `updated_at` vs local `updatedAt`: newer local wins for title/body/properties
- Metadata-only local edits no longer advance `updatedAt` (K-85), so server may appear newer until next content edit — acceptable; sync still posts full note payload.

## Inconsistency findings

### Weak topic dual representation

`isWeakTopic()` returns true if **either**:

- `properties.weakTopic` is `true` / `yes` / `1`, or
- tag `weak-topic` is present

Historical edits could set only one side. **Mitigation (K-85):** `reconcileWeakTopicNote()` runs inside `normalizeNote()` on every load/save path so property and tag stay aligned without bumping `updatedAt`.

### Classification vs literature workflow chips

Classification lives in `properties.noteKind`. Literature workflow UI is derived from the same field — no separate storage. **No corruption risk.**

### Tags alias keys

Pre-normalization keys like `Tags`, `tag`, etc. merge into `tags`. Legacy notes with duplicate alias keys: last writer in `normalizeNoteProperties` iteration order wins. **Rare; document only.**

### Favorites

`starred` is independent of `properties`. Prior K-84 bug: `toggleStar` bumped `updatedAt`. **Fixed in K-85.**

### Relations

Normalized structurally; empty relation objects stripped. Orphan relation targets are not auto-pruned (by design).

## Verification matrix

| Note source | Tags | Classification | Weak | Favorite | Relations |
|-------------|------|----------------|------|----------|-----------|
| Legacy NV/PL | Normalized on load | Preserved string | Reconciled on load | Preserved | Normalized |
| Seed default | Empty | None | Off | false | undefined |
| User-created | Canonical | Via selector | Via toggle | Via star | Via panels |
| Import MD | From frontmatter if present | If frontmatter | If tagged | false default | N/A |

## Recommendations (implemented in K-85)

1. Treat `updatedAt` as **content timestamp** only (`notePatchPolicy.ts`).
2. Reconcile weak-topic property/tag on `normalizeNote()`.
3. Use short tier chip labels in context strip; full tier name in `title` tooltip.
4. No schema migration required — behavioral fix at store + normalization layer.

## Files audited

- `frontend/src/components/views/noteUtils.ts`
- `frontend/src/store/useNotesStore.ts`
- `frontend/src/store/notePatchPolicy.ts`
- `frontend/src/components/views/features/knowledge/tags/noteTags.ts`
- `frontend/src/components/views/features/knowledge/study/weakTopicTracking.ts`
- `frontend/src/components/views/features/knowledge/relations/relationNormalize.ts`
- `frontend/src/components/views/noteview/actions/useNoteImportExportActions.ts`
