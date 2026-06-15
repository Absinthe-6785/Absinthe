# K-63 Validation Checklist

## Backup Ecosystem

- [ ] Settings → **Download ZIP Backup** produces `absinthe-backup-YYYY-MM-DD.zip`
- [ ] ZIP contains `manifest.json`, `README.txt`, `notes/*.md`
- [ ] Manifest shows `schemaVersion: 2`, `appVersion`, `noteCount`, `folderCount`, `relationCount`
- [ ] Settings → **Download JSON** still works
- [ ] Notes sidebar Archive icon downloads ZIP
- [ ] Empty vault shows toast (no backup)

## Restore Validation

- [ ] Import valid `.zip` — modal shows validation grid
- [ ] Import valid `.json` — same behavior
- [ ] Invalid/corrupt file — error modal, no vault mutation
- [ ] Validation shows Notes, Folders, Relations, Conflicts counts
- [ ] Export date and app version displayed

## Selective Restore

- [ ] Folder checkbox toggles all notes in folder
- [ ] Individual note checkboxes work
- [ ] Select all / Select none work
- [ ] Import disabled with zero notes selected
- [ ] Partial restore imports only selected notes
- [ ] Skip / Replace / Duplicate still work on conflicts

## Restore Safety

- [ ] After restore, **Undo last restore** appears in Settings
- [ ] Undo reverts vault to pre-import state
- [ ] Undo button disappears after use
- [ ] Corrupt backup does not create undo snapshot

## Cosmos Navigation

- [ ] Arrow keys navigate previewed nodes
- [ ] Escape closes preview
- [ ] Selected node auto-centers on keyboard nav
- [ ] Keyboard hint visible during preview

## Mobile Consistency

- [ ] Notes sidebar backup/restore buttons ≥ 44px touch target
- [ ] Restore modal usable on narrow viewport
- [ ] Settings vault buttons stack on mobile

## Automated Verification

```bash
cd frontend
npm run typecheck   # 0 errors
npm run build       # PASS
npm run test        # PASS (~1900+ tests)
```

## Regression

- [ ] K-62 conflict handling unchanged for full restore
- [ ] Cosmos preview workflow unchanged
- [ ] Schedule swipe still works
- [ ] Per-note markdown export/import unchanged
