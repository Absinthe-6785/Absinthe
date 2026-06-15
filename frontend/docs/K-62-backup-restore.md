# K-62 — Backup Restore

## Backup Format (schema v1)

```json
{
  "schemaVersion": 1,
  "exportedAt": "ISO-8601",
  "app": "absinthe",
  "folders": [{ "id", "name", "createdAt" }],
  "notes": [{
    "id", "title", "folderId", "starred",
    "createdAt", "updatedAt",
    "markdown": "YAML frontmatter + body",
    "properties": {},
    "relations": {}
  }]
}
```

Markdown bodies use `serializeNoteMarkdown` — tags, relations, and user properties round-trip via frontmatter.

## Restore Workflow

1. **Export** — Settings → Vault Backup (JSON) or Notes sidebar Archive icon
2. **Import** — Settings → Import Vault Backup or Notes sidebar Restore icon (↺)
3. **Preview** — modal shows note count, folder count, new items, conflicts, export date
4. **Confirm** — applies restore with selected conflict strategy
5. **Sync** — new/replaced notes sync to DB; new folders sync to API

## Conflict Strategy

| Strategy | Behavior |
|----------|----------|
| **Skip** | Keep local note; ignore backup entry |
| **Replace** | Overwrite local note with backup content/metadata |
| **Duplicate** | Import backup as new note with fresh id |

Default when conflicts exist: **Skip** (safest).

No silent overwrites.

## Implementation

- `parseVaultBackupJson()` — validates manifest
- `buildVaultRestorePreview()` — counts + conflict ids
- `applyVaultRestore()` — pure merge logic
- `useNotesStore.importVaultRestore()` — persist + index + sync

## Entry Points

| Location | Action |
|----------|--------|
| Settings → Data Management | Export + Import |
| Notes sidebar | Archive (export) + ↺ (import) |
