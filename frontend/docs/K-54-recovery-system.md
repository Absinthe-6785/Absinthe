# K-54 Recovery System

## Storage

- Key: `absinthe:recovery-log`
- Shape: `Record<dateStr, RecoveryLogEntry>`
- Fields: `sleepHours`, `sleepQuality` (1–5), `note`, `restDayNote`
- Event: `absinthe:recovery-log-changed`

## API (`recoveryNotes.ts`)

| Function | Purpose |
|----------|---------|
| `getRecoveryEntry` | Read single day |
| `setRecoveryEntry` | Upsert / prune empty |
| `getRecoveryHistory` | Last N days |
| `getRecoveryWeekSummary` | Avg sleep, latest sleep, trend vs prior week |

## UI

- **Recovery section** (`HealthView` → Recovery tab): `RecoveryLogPanel` + InBody sidebar
- **Dashboard card**: latest sleep, 7-day avg, trend label, latest note

## Trend logic

Compare 7-day average sleep to the prior 7 days:

- `up` if +0.2h or more
- `down` if −0.2h or more
- `steady` otherwise

## Compatibility

Existing entries with only `sleepHours` and `note` remain valid. New fields are optional.
