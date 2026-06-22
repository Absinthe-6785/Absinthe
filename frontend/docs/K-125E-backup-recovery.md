# K-125E — Backup & Recovery Reliability

Improve backup/restore confidence and clarity in Settings.
UI and validation messaging only — no schema, store, hydration, or persistence changes.

## Settings cleanup

- **Removed:** Default category section from General settings
- **Compressed:** Storage card, snapshot cards, export section
- **Hierarchy:** Backup → Recovery → Export (no duplicated export buttons)

## Snapshot list redesign

Dense `SnapshotCard` / `SnapshotList` components show:

- Timestamp, note count, folder count, size, schema version
- Status badges: Valid, Warning, Corrupted, Unverified
- Verify + Preview grouped; Restore visually separated (amber)

## Validation

`recoveryExport.ts` maps raw errors to actionable i18n keys:

- Validation failed
- Missing fields
- Storage unavailable
- Schema mismatch
- Not enough space

`VaultRestoreModal` uses friendly messages and requires an explicit acknowledgment checkbox before restore.

## Restore flow

Emphasized steps: **Preview → Verify → Restore**

- Invalid backups show guidance instead of raw error codes
- Confirm button disabled until user acknowledges overwrite risk
- Snapshot restore uses distinct confirm label

## Files

| File | Role |
|------|------|
| `SettingsView.tsx` | Remove default category; compact storage; Backup/Recovery/Export hierarchy |
| `RecoveryCenterPanel.tsx` | Compact recovery status, import, snapshot list |
| `SnapshotList.tsx` | Dense snapshot list wrapper |
| `SnapshotCard.tsx` | Dense snapshot card with badges and grouped actions |
| `recoveryExport.ts` | Validation error → i18n mapping, status badges |
| `VaultRestoreModal.tsx` | Flow emphasis, acknowledgment, validation UX |
| `k125eRecoveryAudit.ts` | Structural audit |
| `k125eAudits.test.ts` | K-125E + K-120/K-119/K-121 regression |

## Untouched

- Note / snapshot / block schema
- Stores, hydration, providers, sync model
- Migrations and persistence keys

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm test -- k125e k120MemoryAudit k119EmptyStateAudit k121EmptyStateAudit
```
