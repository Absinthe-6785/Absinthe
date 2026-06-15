# K-67 Feedback Consistency

## Toast types

`useToast.ts` defines:

```typescript
type ToastType = 'success' | 'error' | 'warning' | 'info';
```

`AppContent.tsx` renders distinct styling and icons per type.

## Audit: hardcoded notifications

Scanned all `showToast(` call sites under `frontend/src`.

| Before | After |
|--------|-------|
| `SettingsView` — `'Export feature coming soon!'` (error) | `t('settingsExportComingSoon')` (info) |
| `AppContent` — `` `Migrated ${count} countdown(s)...` `` | `t('scheduleCountdownMigrated')` (info) |

All other call sites already use `t('...')` keys.

## CI lint (optional, low risk)

```bash
npm run lint:hardcoded-toasts
```

`scripts/lint-hardcoded-toasts.mjs` fails when `showToast('literal')` or `showToast("literal")` is found.

Not wired into default `typecheck` — run manually or add to CI when desired.

## i18n key added

- `settingsExportComingSoon` — en / ko / ja
- `scheduleCountdownMigrated` — en / ko / ja (`{count}` placeholder)

## Guidelines for new toasts

1. Always pass message through `t('key')`
2. Pick type by intent: `success` save OK, `error` failure, `warning` partial/degraded, `info` coming-soon/neutral
3. Run `npm run lint:hardcoded-toasts` before PR
