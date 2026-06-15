# K-63 Backup Ecosystem

## Overview

K-63 upgrades vault backup from a single JSON download into a complete backup workflow: ZIP archives, rich manifest metadata, pre-restore validation, selective restore, and automatic pre-restore snapshots.

## Backup Formats

| Format | Extension | Contents |
|--------|-----------|----------|
| **ZIP bundle** (primary) | `.zip` | `manifest.json`, `notes/*.md`, `README.txt` |
| **JSON only** (secondary) | `.json` | Full manifest inline |

Download names:

- `absinthe-backup-YYYY-MM-DD.zip`
- `absinthe-vault-backup-YYYY-MM-DD.json`

## Manifest Schema (v2)

```json
{
  "schemaVersion": 2,
  "exportedAt": "2026-06-15T12:00:00.000Z",
  "app": "absinthe",
  "appVersion": "1.0.0",
  "noteCount": 42,
  "folderCount": 5,
  "relationCount": 128,
  "folders": [...],
  "notes": [...]
}
```

Schema v1 backups (K-61/K-62) are normalized on import via `normalizeVaultBackupManifest()`.

## ZIP Structure

```
absinthe-backup-2026-06-15.zip
├── manifest.json
├── README.txt
└── notes/
    ├── Alpha-n1abc1.md
    └── Beta-n2def2.md
```

## Entry Points

- **Settings → Data Management** — ZIP (primary), JSON, Import, Undo last restore
- **Notes sidebar** — Archive icon (ZIP), Restore icon (JSON/ZIP)

## Core Modules

| Module | Role |
|--------|------|
| `exportVaultBackup.ts` | Manifest builder, JSON download |
| `vaultBackupZip.ts` | ZIP build/parse (JSZip) |
| `vaultBackupConstants.ts` | `ABSINTHE_APP_VERSION`, schema version |
| `importVaultBackup.ts` | Parse, validate, preview, selective filter, apply |
| `vaultRestoreSnapshot.ts` | localStorage snapshot for undo |
| `useVaultRestoreFlow.ts` | UI flow hook |
| `VaultRestoreModal.tsx` | Validation + selection + conflict UI |

## Compatibility

- Imports accept `.json` and `.zip`
- Deleted notes are excluded from export
- Trash notes are not included in backup counts
