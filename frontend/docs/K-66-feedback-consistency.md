# K-66 Feedback Consistency

## Toast audit

| Area | Pattern | K-66 status |
|------|---------|-------------|
| Planner API | `successMsg: t('…')` | OK |
| Health API | `successMsg: t('…')` | OK |
| Settings CSV export | `settingsExportComplete` | OK (K-65) |
| Settings reset (views/) | `resetSuccess` / `resetFailed` | OK |
| Settings reset (common/) | Was hardcoded English | Fixed K-66 |
| Vault backup | `vaultBackup*` keys | OK |

## Severity model (existing)

- **Success** — green check icon, `bg-surface-alt text-primary`
- **Error** — `AlertCircle`, `bg-danger text-white`

Consistent via `useToast` + `AppContent` toast renderer.

## Delete confirmations

- Trash permanent delete — `nvDeleteNotePermanentMsg` (K-65)
- Planner/Health deletes — `useConfirm` + i18n keys

## Remaining debt

| Location | Issue |
|----------|-------|
| `common/SettingsView.tsx` | `Export feature coming soon!` still English (example file) |
| Archive views | Some toasts via API layer only |

## Recommendation (K-67)

- Grep CI rule: no `successMsg: '` string literals
- Standardize save toasts: `{entity}Saved` / `{entity}Deleted`
