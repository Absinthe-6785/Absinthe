# K-63 Data Confidence Audit

## Backup

| Aspect | Status |
|--------|--------|
| Format | ZIP (manifest + markdown) and JSON |
| Schema | v2 with counts and app version |
| Deleted notes | Excluded |
| Relations | Serialized per note in manifest |
| Folders | Full metadata included |
| Recovery | User-owned file on disk |

**Limitation:** No automatic cloud backup; user must download manually.

## Restore

| Aspect | Status |
|--------|--------|
| Input | `.json`, `.zip` |
| Validation | Pre-import report (notes, folders, relations, conflicts) |
| Corrupt notes | Blocked if markdown parse fails or missing id/title |
| Schema | v1 and v2 supported; future versions rejected |
| Selective | Folder/note checkboxes |
| Undo | One-level via localStorage snapshot |

**Limitation:** Orphan folder references (note points to missing folder) are allowed.

## Export (per-note / bulk)

| Type | Format | Notes |
|------|--------|-------|
| Single note | `.md` | Frontmatter + body via `serializeNoteMarkdown` |
| All notes | Multiple `.md` downloads | Staggered 200ms apart |
| Vault ZIP | `.zip` | Includes all active notes as markdown |

## Import (per-note)

| Type | Format | Notes |
|------|--------|-------|
| Markdown | `.md` | `parseNoteMarkdown`; creates new note in active folder |

## Health CSV

| Aspect | Status |
|--------|--------|
| Location | Settings → Export Data (CSV) |
| Scope | Date-range filtered health records |
| Recovery | External file; not part of vault backup |

**Limitation:** Health data not included in vault ZIP; separate export required.

## Markdown Export Fidelity

- Properties serialized as YAML frontmatter
- Relations stored in manifest JSON (not duplicated in per-note `.md` inside ZIP)
- Images embedded as data URLs in markdown where applicable

## Migration Compatibility

| From | To | Support |
|------|-----|---------|
| K-61 JSON v1 | K-63 | ✓ via normalization |
| K-63 ZIP v2 | K-63 | ✓ |
| External `.md` | Vault | ✓ per-file import only |
| Other apps | Vault | Partial — depends on frontmatter compatibility |

## Recovery Guarantees Summary

1. **ZIP backup** — Full portable archive; human-readable markdown + machine manifest
2. **Pre-restore snapshot** — One undo in same browser session
3. **Validation gate** — Corrupt backups blocked before mutation
4. **No silent data loss** — Skip strategy preserves local notes on conflict

## Gaps for K-64

- Scheduled/automatic backup reminders
- Health + Schedule data in unified backup bundle
- Cloud backup integration
- Multi-level undo history
