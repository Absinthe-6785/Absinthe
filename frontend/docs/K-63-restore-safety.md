# K-63 Restore Safety

## Automatic Snapshot

Before every vault restore, the current vault state is saved to `localStorage`:

```
Key: absinthe-vault-restore-snapshot
```

Snapshot contents:

```typescript
{
  savedAt: string;   // ISO timestamp
  notes: NoteBase[];
  folders: NoteFolder[];
}
```

## Flow

```
Current Vault
     ↓
saveVaultRestoreSnapshot()   ← automatic, no user action
     ↓
importVaultRestore(filtered manifest)
     ↓
Optional: Undo last restore
```

## Undo Last Restore

- **Settings → Data Management** shows **Undo last restore** when a snapshot exists
- `undoLastVaultRestore()` restores notes + folders from snapshot, re-indexes knowledge graph, syncs to DB
- Snapshot is cleared after undo (one-level undo only)
- If `localStorage` quota is exceeded, restore proceeds without undo safety net

## Store API

| Method | Description |
|--------|-------------|
| `importVaultRestore(manifest, strategy)` | Saves snapshot, then restores |
| `undoLastVaultRestore()` | Reverts to pre-restore state |
| `canUndoVaultRestore()` | Checks snapshot presence |
| `vaultRestoreCanUndo` | Reactive flag for UI |

## Recovery Guarantees

| Scenario | Guarantee |
|----------|-----------|
| Accidental full restore | One-click undo via Settings |
| Corrupt backup file | Blocked at validation — no snapshot consumed |
| Partial selective restore | Snapshot covers full pre-restore vault |
| Browser data cleared | Snapshot lost — use external backup |

## Limitations

- Single undo level (no undo history stack)
- Snapshot stored in same browser profile only
- Large vaults may hit localStorage quota (~5 MB typical)

## Recommendations

1. Export ZIP backup before major restores
2. Use selective restore to limit blast radius
3. Review validation report before confirming
